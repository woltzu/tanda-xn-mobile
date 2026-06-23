// ═══════════════════════════════════════════════════════════════════════════
// stripe-webhook — Edge Function (Deno runtime)
//
// Receives Stripe webhook deliveries, verifies the signature, mirrors the
// event into stripe_webhook_events, and (for payment_intent.* events)
// updates stripe_payment_intents.status.
//
// Deployed with --no-verify-jwt because Stripe doesn't send a Supabase JWT.
// The Stripe-Signature header IS the authentication — without a valid
// signature we 400 immediately.
//
// Idempotency:
//   - stripe_event_id is UNIQUE. Stripe retries up to ~3 days. On any retry,
//     the INSERT errors with duplicate-key — we treat that as "already
//     handled" and 200 to stop retries.
//
// Schema notes (verified against live DB 2026-05-21):
//   - payload JSONB NOT NULL → we store the full event object
//   - processed BOOLEAN DEFAULT false → flipped to true on success
//   - processing_error TEXT → set if our handler fails
//   - livemode BOOLEAN DEFAULT false → mirrored from event.livemode
//   - api_version TEXT → mirrored from event.api_version
//   - created_at default now() — we omit
//   - We do NOT set related_payment_intent_id (would require a lookup;
//     stripe_payment_intent_id in the payload is enough for the smoke test)
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
  "failed",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ─── 1. Verify Stripe signature ───
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const rawBody = await req.text(); // MUST read raw text for signature verification
  let event: Stripe.Event;
  try {
    // constructEventAsync is required on Deno (uses Web Crypto under the hood
    // — the sync version relies on Node crypto and throws on Deno).
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed:", msg);
    return new Response(`Signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  // ─── 2. Process the event (update PI status if applicable) ───
  // We do the update FIRST so the retry story is clean: if the update
  // fails we 500 and Stripe retries. The webhook row insert below is
  // a separate concern.
  let processingError: string | null = null;

  if (event.type.startsWith("payment_intent.")) {
    const pi = event.data.object as Stripe.PaymentIntent;
    if (!PI_STATUSES.has(pi.status)) {
      console.warn(
        "[stripe-webhook] unrecognized PI status",
        pi.status,
        "for",
        pi.id
      );
    }

    const { error: updErr, count } = await supabase
      .from("stripe_payment_intents")
      .update(
        {
          status: pi.status,
          updated_at: new Date().toISOString(),
          // Capture failure details if Stripe sent them
          failure_code: pi.last_payment_error?.code ?? null,
          failure_message: pi.last_payment_error?.message ?? null,
        },
        { count: "exact" }
      )
      .eq("stripe_payment_intent_id", pi.id);

    if (updErr) {
      processingError = `PI update failed: ${updErr.message}`;
      console.error("[stripe-webhook]", processingError);
    } else if (count === 0) {
      // PI not in our DB — could be a race (webhook arrived before
      // create-payment-intent's INSERT committed) or an event for a PI
      // we never recorded. Log but don't fail — the webhook row below
      // still captures the event for forensic purposes.
      console.warn(
        "[stripe-webhook] no matching PI row for",
        pi.id,
        "— event recorded but not applied"
      );
    }

    // ── Goal-deposit side-effects: .processing (pending) + .succeeded ─────
    // Migration 074 introduced the .succeeded → credit_goal_external path.
    // Migration 076 adds the .processing → record_pending_goal_deposit
    // path for ACH: Stripe fires .processing immediately when an ACH PI
    // is confirmed (typically within seconds of the user linking their
    // bank) and then .succeeded 3-5 business days later when ACH clears.
    // Recording a pending row on .processing means the user sees the
    // deposit in their activity feed immediately rather than waiting
    // days; credit_goal_external upgrades the pending row to completed
    // and credits the goal balance atomically when .succeeded arrives.
    //
    // Both branches read the credit amount + fee from PI metadata we
    // stamped at create time (NOT pi.amount): when applyCardFee=true
    // the user was charged amount+fee on the card path, but only
    // `amount` should land in the goal.
    //
    // Source of truth for the source field is also metadata.source —
    // 'card' for card, 'bank' for ACH via Stripe Financial Connections.
    // Defaults to 'card' for backward compatibility with any PI created
    // before the source field was added.
    if (
      event.type === "payment_intent.succeeded" &&
      pi.metadata?.type === "goal_deposit"
    ) {
      const goalId = pi.metadata.goal_id ?? null;
      const depositCentsRaw = pi.metadata.deposit_amount_cents ?? "";
      const feeCentsRaw = pi.metadata.fee_cents ?? "0";
      const depositCents = Number(depositCentsRaw);
      const feeCents = Number(feeCentsRaw);

      if (!goalId || !Number.isFinite(depositCents) || depositCents <= 0) {
        const msg = `Malformed goal_deposit metadata on PI ${pi.id}: goal_id=${goalId}, deposit_amount_cents=${depositCentsRaw}`;
        console.error("[stripe-webhook]", msg);
        processingError = msg;
      } else {
        // Source is set in PI metadata at create time by
        // create-payment-intent: 'card' for card / 'bank' for ACH via
        // Stripe Financial Connections. Default to 'card' for backward
        // compatibility with any PI created before the source field was
        // added (the only such PIs in flight are pre-migration-075 cards).
        const source =
          typeof pi.metadata.source === "string" && pi.metadata.source.length > 0
            ? pi.metadata.source
            : "card";

        const { data: rpcResult, error: rpcErr } = await supabase.rpc(
          "credit_goal_external",
          {
            p_goal_id: goalId,
            p_amount_cents: depositCents,
            p_fee_cents: Number.isFinite(feeCents) && feeCents > 0 ? feeCents : 0,
            p_source: source,
            p_stripe_pi_id: pi.id,
          }
        );

        if (rpcErr) {
          processingError = `credit_goal_external RPC error: ${rpcErr.message}`;
          console.error("[stripe-webhook]", processingError);
        } else if (rpcResult && rpcResult.success === false) {
          // Function-level failure (e.g. "Goal not found"). We set
          // processingError so the webhook row records the failure for
          // forensics. The existing tail of this handler will then
          // return 500 → Stripe retries. The retry will hit the
          // event-row UNIQUE check (Layer 1 in the docblock) and ack
          // with duplicate=true without re-invoking the RPC, so a
          // permanent error doesn't actually loop forever — it logs
          // once, stripe_webhook_events records the failure, and the
          // retry-train terminates at the duplicate-event ack.
          const msg = `credit_goal_external returned failure: ${rpcResult.error}`;
          console.error("[stripe-webhook]", msg);
          processingError = msg;
        } else if (rpcResult?.idempotent_replay) {
          console.log(
            "[stripe-webhook] credit_goal_external idempotent replay for PI",
            pi.id
          );
        } else {
          console.log(
            "[stripe-webhook] credit_goal_external succeeded for PI",
            pi.id,
            "→ goal_balance_cents =",
            rpcResult?.goal_balance_cents
          );
        }
      }
    }

    // ── Trip-payment side-effects: succeeded → record_trip_payment_succeeded ──
    // Join-trip Bucket A.3 — three trip_* purposes routed through the
    // central RPC (migration 241). The RPC is idempotent on
    // (stripe_payment_intent_id) so Stripe retries land on the
    // duplicate-event ack above OR the RPC's own replay branch — either
    // way we don't double-credit. The RPC also handles
    // pending→confirmed promotion when the deposit threshold is crossed
    // and computes payment_status from the recomputed total.
    //
    // We DON'T re-derive participant_id from the user — the EF that
    // staged the PI already wrote metadata.trip_participant_id, so the
    // RPC just reads it back. PIs created before A.3 (none in prod —
    // this is fresh code) without participant metadata would raise
    // inside the RPC, get logged, and the webhook would still record
    // the event for forensics.
    if (
      event.type === "payment_intent.succeeded" &&
      typeof pi.metadata?.type === "string" &&
      pi.metadata.type.startsWith("trip_")
    ) {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        "record_trip_payment_succeeded",
        {
          p_payment_intent_id: pi.id,
          // The RPC reads metadata + the top-level amount from the
          // payload itself, so we pass the whole PI object as JSONB.
          p_pi_payload: pi as unknown as Record<string, unknown>,
        }
      );

      if (rpcErr) {
        processingError = `record_trip_payment_succeeded RPC error: ${rpcErr.message}`;
        console.error("[stripe-webhook]", processingError);
      } else if (rpcResult?.idempotent_replay) {
        console.log(
          "[stripe-webhook] record_trip_payment_succeeded idempotent replay for PI",
          pi.id
        );
      } else {
        console.log(
          "[stripe-webhook] record_trip_payment_succeeded succeeded for PI",
          pi.id,
          "→ payment_id =",
          rpcResult?.payment_id,
          ", new_payment_status =",
          rpcResult?.new_payment_status,
          ", promoted_to_confirmed =",
          rpcResult?.promoted_to_confirmed
        );
      }
    }

    // ── .processing → record a pending savings_transactions row ───────────
    // Mirrors the .succeeded block's metadata-extraction shape so the two
    // branches are easy to read side by side. record_pending_goal_deposit
    // is idempotent via ON CONFLICT (stripe_payment_intent_id) DO NOTHING,
    // so a Stripe retry of .processing OR a race where .succeeded fires
    // first both leave the existing row untouched. Goal balance is NOT
    // credited here — that happens later on .succeeded via the
    // credit_goal_external upgrade path.
    if (
      event.type === "payment_intent.processing" &&
      pi.metadata?.type === "goal_deposit"
    ) {
      const goalId = pi.metadata.goal_id ?? null;
      const depositCentsRaw = pi.metadata.deposit_amount_cents ?? "";
      const feeCentsRaw = pi.metadata.fee_cents ?? "0";
      const depositCents = Number(depositCentsRaw);
      const feeCents = Number(feeCentsRaw);
      const source =
        typeof pi.metadata.source === "string" && pi.metadata.source.length > 0
          ? pi.metadata.source
          : "bank";

      if (!goalId || !Number.isFinite(depositCents) || depositCents <= 0) {
        const msg = `Malformed goal_deposit metadata on PI ${pi.id} (.processing): goal_id=${goalId}, deposit_amount_cents=${depositCentsRaw}`;
        console.error("[stripe-webhook]", msg);
        processingError = msg;
      } else {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc(
          "record_pending_goal_deposit",
          {
            p_goal_id: goalId,
            p_amount_cents: depositCents,
            p_fee_cents: Number.isFinite(feeCents) && feeCents > 0 ? feeCents : 0,
            p_source: source,
            p_stripe_pi_id: pi.id,
          }
        );

        if (rpcErr) {
          processingError = `record_pending_goal_deposit RPC error: ${rpcErr.message}`;
          console.error("[stripe-webhook]", processingError);
        } else if (rpcResult && rpcResult.success === false) {
          const msg = `record_pending_goal_deposit returned failure: ${rpcResult.error}`;
          console.error("[stripe-webhook]", msg);
          processingError = msg;
        } else {
          console.log(
            "[stripe-webhook] record_pending_goal_deposit succeeded for PI",
            pi.id
          );
        }
      }
    }
  } else if (event.type === "account.updated") {
    // ── Stage 1: Connect onboarding status updates ──
    // Connect Express accounts fire account.updated whenever their state
    // changes (during onboarding, KYC verification, requirements changes).
    // This is the ONLY source of truth for onboarding_status — the gate in
    // complete_circle_join reads onboarding_status='complete' + payouts_enabled.
    //
    // Idempotency layers:
    //   Layer 1 (existing): UNIQUE on stripe_event_id catches duplicate
    //     deliveries of the same event (Stripe retries).
    //   Layer 2 (new): the UPDATE is conditional on last_account_event_at
    //     being NULL OR <= the incoming event.created — this catches
    //     out-of-order delivery of DIFFERENT events. .lte. (not .lt.) so
    //     two events with the same second-precision timestamp both apply
    //     (the later-arriving one wins, which mirrors Stripe's behavior).
    const acct = event.data.object as Stripe.Account;
    const eventCreatedAt = new Date(event.created * 1000).toISOString();

    // Canonical "complete" — payout readiness only. charges_enabled is
    // observed but NOT a gate condition (separate charges & transfers
    // architecture means the connected account never needs to charge).
    let onboardingStatus: "pending" | "in_progress" | "complete" | "restricted" | "disabled";
    if (acct.requirements?.disabled_reason) {
      onboardingStatus = "disabled";
    } else if ((acct.requirements?.past_due?.length ?? 0) > 0) {
      onboardingStatus = "restricted";
    } else if (
      acct.payouts_enabled === true &&
      acct.details_submitted === true &&
      (acct.requirements?.currently_due?.length ?? 0) === 0
    ) {
      onboardingStatus = "complete";
    } else {
      onboardingStatus = "in_progress";
    }

    const { error: updErr, count } = await supabase
      .from("stripe_connected_accounts")
      .update(
        {
          onboarding_status: onboardingStatus,
          payouts_enabled: acct.payouts_enabled ?? false,
          charges_enabled: acct.charges_enabled ?? false, // observed for diagnostics, not gate-relevant
          details_submitted: acct.details_submitted ?? false,
          capabilities: acct.capabilities ?? {},
          requirements: acct.requirements ?? {},
          tos_accepted_at: acct.tos_acceptance?.date
            ? new Date(acct.tos_acceptance.date * 1000).toISOString()
            : null,
          last_account_event_at: eventCreatedAt,
          updated_at: new Date().toISOString(),
        },
        { count: "exact" }
      )
      .eq("stripe_account_id", acct.id)
      .or(`last_account_event_at.is.null,last_account_event_at.lte.${eventCreatedAt}`);

    if (updErr) {
      processingError = `account.updated apply failed: ${updErr.message}`;
      console.error("[stripe-webhook]", processingError);
    } else if (count === 0) {
      // Either no matching row OR the incoming event is older than the
      // last applied one. Not an error — Layer 2 correctly ignored a
      // stale delivery, OR the account was created in the dashboard
      // (not via our API) and we have no record of it.
      console.warn(
        "[stripe-webhook] account.updated skipped for",
        acct.id,
        "(no matching row OR stale event; event.created =",
        eventCreatedAt + ")"
      );
    } else {
      console.log(
        "[stripe-webhook] account.updated applied for",
        acct.id,
        "→ status =",
        onboardingStatus,
        ", payouts_enabled =",
        acct.payouts_enabled
      );
    }
  } else {
    console.log("[stripe-webhook] ignoring non-PI/non-account event", event.type);
  }

  // ─── 3. Record the event in stripe_webhook_events ───
  const { error: insErr } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    api_version: event.api_version,
    livemode: event.livemode,
    payload: event as unknown,
    processed: processingError === null,
    processed_at: new Date().toISOString(),
    processing_error: processingError,
  });

  if (insErr) {
    // UNIQUE violation on stripe_event_id means this is a Stripe retry of
    // an event we've already recorded. 200 OK so Stripe stops retrying.
    const isDuplicate =
      insErr.code === "23505" ||
      /duplicate key|already exists/i.test(insErr.message);
    if (isDuplicate) {
      console.log("[stripe-webhook] duplicate event", event.id, "— ack");
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error(
      "[stripe-webhook] event insert failed for",
      event.id,
      ":",
      insErr.message
    );
    return new Response(
      `Failed to record webhook event: ${insErr.message}`,
      { status: 500 }
    );
  }

  // ─── 4. Return success ───
  // If processingError is non-null, the event was recorded but our handler
  // failed. We return 500 so Stripe retries — the next retry will hit the
  // duplicate-event path above and we'll need manual intervention to
  // re-process. (Acceptable for a smoke test; real Path B should make
  // event processing retry-safe.)
  if (processingError) {
    return new Response(`Processed with error: ${processingError}`, {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
