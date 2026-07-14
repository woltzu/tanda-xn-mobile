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

  // Reconciliation ledger (migration 276): append-only row per confirmed
  // Stripe event. Written AFTER the legacy side-effects so a ledger-write
  // failure doesn't roll back the rest, but BEFORE the stripe_webhook_events
  // row so duplicate-event handling stays at the bottom of the function.
  // Idempotency layer: ledger_events.stripe_event_id UNIQUE — a Stripe
  // retry that gets past the existing webhook_events guard would still
  // be a no-op here. We catch the duplicate so it doesn't poison the
  // processingError flag.
  const writeLedgerEvent = async (row: {
    stripe_object_id: string;
    event_type: string;
    amount_cents: number;
    currency?: string;
    user_id?: string | null;
    recipient_user_id?: string | null;
    circle_id?: string | null;
    trip_id?: string | null;
    cycle_id?: string | null;
    external_reference_id?: string | null;
    external_reference_type?: string | null;
    stripe_fee_cents?: number;
    stripe_event_id_override?: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<string | null> => {
    // Returns the inserted ledger_events.id on success, or null on dup /
    // failure (so callers that need to link FKs can short-circuit cleanly).
    // On dup we re-query to surface the existing row's id — Stripe retries
    // still produce a usable FK target for the circle_contributions upsert.
    // stripe_event_id is UNIQUE on ledger_events. Most rows use the
    // delivered event.id; the platform-fee sidecar row (Bucket C) needs
    // a synthetic id derived from event.id so a single payment_intent
    // .succeeded event can produce TWO ledger rows (charge.succeeded +
    // platform_fee.charged) without colliding on UNIQUE.
    const stripeEventId = row.stripe_event_id_override ?? event.id;
    const { data: inserted, error: ledgerErr } = await supabase
      .from("ledger_events")
      .insert({
        stripe_event_id: stripeEventId,
        stripe_object_id: row.stripe_object_id,
        event_type: row.event_type,
        amount_cents: row.amount_cents,
        currency: row.currency ?? "USD",
        user_id: row.user_id ?? null,
        recipient_user_id: row.recipient_user_id ?? null,
        circle_id: row.circle_id ?? null,
        trip_id: row.trip_id ?? null,
        cycle_id: row.cycle_id ?? null,
        external_reference_id: row.external_reference_id ?? null,
        external_reference_type: row.external_reference_type ?? null,
        stripe_fee_cents: row.stripe_fee_cents ?? 0,
        raw_payload: event as unknown,
        metadata: row.metadata ?? null,
      })
      .select("id")
      .single();
    if (ledgerErr) {
      const isDup =
        ledgerErr.code === "23505" ||
        /duplicate key|already exists/i.test(ledgerErr.message);
      if (isDup) {
        console.log(
          "[stripe-webhook] ledger_events duplicate for event",
          stripeEventId,
          "— resolving existing row"
        );
        const { data: existing } = await supabase
          .from("ledger_events")
          .select("id")
          .eq("stripe_event_id", stripeEventId)
          .maybeSingle();
        return existing?.id ?? null;
      }
      console.error(
        "[stripe-webhook] ledger_events insert failed:",
        ledgerErr.message
      );
      // Surface as a soft-fail: the legacy side-effects already ran, but
      // we want Stripe to retry so reconciliation stays whole. The retry
      // will hit the unique constraint above and become a no-op.
      processingError = processingError ?? `ledger write failed: ${ledgerErr.message}`;
      return null;
    }
    return inserted?.id ?? null;
  };

  // Helper to coerce a Stripe metadata UUID-ish string to a UUID or null.
  // Stripe round-trips metadata as strings; an empty/malformed value would
  // explode the FK insert, so we filter to a strict UUID pattern.
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const maybeUuid = (v: unknown): string | null =>
    typeof v === "string" && UUID_RE.test(v) ? v : null;

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

    // ── Reconciliation ledger: charge.succeeded ──
    // Migration 276 — every confirmed Stripe charge gets a row. We write
    // pi.amount_received (the post-decline net) rather than pi.amount so
    // partial captures or amount-changed flows still reconcile cleanly.
    if (event.type === "payment_intent.succeeded") {
      const meta = pi.metadata ?? {};

      // ── Stripe fee retrieval (Bucket C / migration 279) ──
      // The event payload doesn't include the balance_transaction; we
      // retrieve the PI with expand=['latest_charge.balance_transaction']
      // to get the actual Stripe fee in cents. One extra API call per
      // successful charge — acceptable. If the retrieve fails (network
      // hiccup, Stripe outage), we fall back to stripe_fee_cents=0 and
      // a future cron can backfill.
      let stripeFeeCents = 0;
      try {
        const expanded = await stripe.paymentIntents.retrieve(pi.id, {
          expand: ["latest_charge.balance_transaction"],
        });
        const latestCharge = expanded.latest_charge;
        if (
          latestCharge &&
          typeof latestCharge === "object" &&
          "balance_transaction" in latestCharge
        ) {
          const bt = (latestCharge as Stripe.Charge).balance_transaction;
          if (bt && typeof bt === "object" && "fee" in bt) {
            stripeFeeCents = (bt as Stripe.BalanceTransaction).fee ?? 0;
          }
        }
      } catch (err) {
        console.warn(
          "[stripe-webhook] balance_transaction retrieve failed for",
          pi.id,
          ":",
          err instanceof Error ? err.message : String(err),
          "— ledger row gets stripe_fee_cents=0 (backfill later)"
        );
      }

      let externalReferenceType: string | null = null;
      let externalReferenceId: string | null = null;
      if (typeof meta.type === "string" && meta.type.startsWith("trip_")) {
        externalReferenceType = "trip_participant";
        externalReferenceId = maybeUuid(meta.trip_participant_id);
      } else if (meta.type === "goal_deposit") {
        externalReferenceType = "goal";
        externalReferenceId = maybeUuid(meta.goal_id);
      } else if (meta.type === "circle_contribution") {
        // Stage 2 Bucket A (migration 277) — pending_intent_id is stamped
        // on PI metadata at create-circle-contribution-intent time so the
        // ledger row can carry the FK forward to circle_contributions.
        externalReferenceType = "pending_intent";
        externalReferenceId = maybeUuid(meta.pending_intent_id);
      }
      const ledgerEventId = await writeLedgerEvent({
        stripe_object_id: pi.id,
        event_type: "charge.succeeded",
        amount_cents: pi.amount_received ?? pi.amount ?? 0,
        currency: (pi.currency ?? "usd").toUpperCase(),
        user_id: maybeUuid(meta.user_id),
        trip_id: maybeUuid(meta.trip_id),
        circle_id: maybeUuid(meta.circle_id),
        cycle_id: maybeUuid(meta.cycle_id),
        external_reference_id: externalReferenceId,
        external_reference_type: externalReferenceType,
        stripe_fee_cents: stripeFeeCents,
        metadata: meta,
      });

      // ── Platform fee sidecar (Bucket C) ──
      // When a circle_contribution PI carries platform_fee_cents > 0 in
      // metadata, write a SECOND ledger row 'platform_fee.charged' that
      // captures what TandaXn retained. Uses a synthetic stripe_event_id
      // suffixed with ':fee' so the UNIQUE constraint accepts both rows
      // from the same delivered event. This lets the reconciliation
      // RPC and the operating-costs view query fees independently from
      // the main charge.
      if (meta.type === "circle_contribution") {
        const platformFeeCentsRaw =
          typeof meta.platform_fee_cents === "string"
            ? parseInt(meta.platform_fee_cents, 10)
            : 0;
        if (Number.isFinite(platformFeeCentsRaw) && platformFeeCentsRaw > 0) {
          await writeLedgerEvent({
            stripe_event_id_override: `${event.id}:fee`,
            stripe_object_id: pi.id,
            event_type: "platform_fee.charged",
            amount_cents: platformFeeCentsRaw,
            currency: (pi.currency ?? "usd").toUpperCase(),
            user_id: maybeUuid(meta.user_id),
            circle_id: maybeUuid(meta.circle_id),
            cycle_id: maybeUuid(meta.cycle_id),
            external_reference_id: maybeUuid(meta.pending_intent_id),
            external_reference_type: "pending_intent",
            metadata: {
              platform_fee_bps: meta.platform_fee_bps,
              parent_event_id: event.id,
              parent_ledger_event_id: ledgerEventId,
            },
          });
        }
      }

      // ── Circle-contribution upsert (Stage 2 Bucket A) ──────────────────
      // The wallet payment path writes circle_contributions directly via
      // useWallet.makeContribution. The Stripe card path was previously
      // a mock (StripeConnectEngine._createStripePaymentIntent returned
      // fake PI ids and never produced a real DB row). This branch fills
      // that gap: when a real circle_contribution PI succeeds, we either
      // mark the matching pending row as paid OR insert a fresh one — and
      // either way link it to the ledger event + pending intent.
      //
      // Matching strategy: look for an unpaid row on (circle_id, user_id,
      // cycle_number). Cycle_number falls back to 1 if metadata is missing
      // (rare — the EF stamps it, but pre-A.3 PIs without it default to
      // cycle 1 which is the most common case). Status='paid' rows are
      // never updated — they represent a different cycle's payment.
      if (meta.type === "circle_contribution") {
        const circleIdMeta = maybeUuid(meta.circle_id);
        const payerUserId = maybeUuid(meta.user_id);
        const pendingIntentIdMeta = maybeUuid(meta.pending_intent_id);
        const cycleNumberRaw = typeof meta.cycle_number === "string" ? meta.cycle_number : "";
        const cycleNumber =
          /^\d+$/.test(cycleNumberRaw) ? parseInt(cycleNumberRaw, 10) : 1;
        const amountDollars =
          ((pi.amount_received ?? pi.amount ?? 0) as number) / 100;
        const currencyUpper = (pi.currency ?? "usd").toUpperCase();
        const paidAt = new Date().toISOString();

        if (!circleIdMeta || !payerUserId) {
          console.warn(
            "[stripe-webhook] circle_contribution missing circle_id/user_id in metadata for",
            pi.id,
            "— skipping upsert"
          );
        } else {
          // Try to update an existing unpaid row first. If zero rows match,
          // insert a fresh one. We don't use Postgres ON CONFLICT here
          // because there's no unique key on (circle_id, user_id,
          // cycle_number) in the live schema — the contribution table
          // permits multiple rows per (member, cycle) intentionally to
          // accommodate the partial-pool / catch-up flow.
          const { data: updated, error: ccUpdErr } = await supabase
            .from("circle_contributions")
            .update({
              status: "paid",
              paid_date: paidAt,
              payment_method: "stripe",
              pending_intent_id: pendingIntentIdMeta,
              ledger_event_id: ledgerEventId,
              amount: amountDollars,
              currency: currencyUpper,
            })
            .eq("circle_id", circleIdMeta)
            .eq("user_id", payerUserId)
            .eq("cycle_number", cycleNumber)
            .neq("status", "paid")
            .select("id");

          if (ccUpdErr) {
            console.error(
              "[stripe-webhook] circle_contributions update failed:",
              ccUpdErr.message
            );
            processingError = processingError ??
              `circle_contributions update failed: ${ccUpdErr.message}`;
          } else if (!updated || updated.length === 0) {
            // No existing pending row — this happens when the user pays
            // ahead of a contribution being scheduled. Insert a fresh
            // 'paid' row. due_date is NOT NULL on the table; use the
            // payment timestamp as a sensible default (the row reads as
            // "due today, paid today" which doesn't pollute late-stats).
            const { error: ccInsErr } = await supabase
              .from("circle_contributions")
              .insert({
                circle_id: circleIdMeta,
                user_id: payerUserId,
                cycle_number: cycleNumber,
                amount: amountDollars,
                currency: currencyUpper,
                due_date: paidAt.slice(0, 10),
                paid_date: paidAt,
                status: "paid",
                payment_method: "stripe",
                pending_intent_id: pendingIntentIdMeta,
                ledger_event_id: ledgerEventId,
              });
            if (ccInsErr) {
              console.error(
                "[stripe-webhook] circle_contributions insert failed:",
                ccInsErr.message
              );
              processingError = processingError ??
                `circle_contributions insert failed: ${ccInsErr.message}`;
            } else {
              console.log(
                "[stripe-webhook] circle_contributions inserted for PI",
                pi.id,
                "→ circle",
                circleIdMeta,
                "cycle",
                cycleNumber
              );
            }
          } else {
            console.log(
              "[stripe-webhook] circle_contributions marked paid for PI",
              pi.id,
              "→",
              updated.length,
              "row(s)"
            );
          }
        }

        // ── Auto-payout on cycle completion (REMOVED 2026-07-14) ──────
        // The webhook used to call should_auto_trigger_payout here and,
        // when it returned true, create a Stripe Transfer straight to
        // the recipient's Connect-linked bank the same second the
        // triggering contribution landed. Product decision (see
        // launch-docs Q1): payouts are wallet-first. No external money
        // movement happens automatically — funds are credited to the
        // recipient's internal wallet via cycle-progression-cron →
        // execute_cycle_payout (migration 304), and the recipient can
        // later opt into a withdraw-to-bank flow at their own timing.
        //
        // What still fires from this webhook: circle_contributions
        // upsert (above), and transfer.paid → circle_payouts.completed
        // + activity-feed wallet_transactions row (below). Those
        // remain because process-circle-payout (admin-manual) can
        // still initiate a Stripe Transfer, and its resulting
        // transfer.paid event needs its downstream bookkeeping.
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
  } else if (event.type === "transfer.paid") {
    // ── Stripe Connect Bucket C: confirm trip-payment release ──
    // release-trip-funds (Bucket B) stamps trip_payments.transfer_id
    // when it creates the Transfer; that records *intent*. transfer.paid
    // fires when Stripe confirms the funds actually landed on the
    // organizer's connected account, which can be hours later for ACH
    // payouts. We stamp transferred_at + flip status to 'transferred'
    // here so the dashboard can show a clean "paid out" state.
    //
    // Idempotency layers:
    //   Layer 1: UNIQUE on stripe_event_id catches duplicate deliveries.
    //   Layer 2: UPDATE filters on status != 'transferred' so a re-
    //     delivery (or a non-trip transfer that happens to collide on
    //     transfer_id space — Stripe ids are globally unique, so this
    //     is belt-and-braces) is a no-op rather than overwriting
    //     transferred_at.
    //
    // Non-trip transfers (e.g. future elder payouts, refunds) won't
    // match any trip_payments row — count===0 is logged and dropped,
    // NOT errored, so the webhook returns 200 and Stripe doesn't retry.
    const transfer = event.data.object as Stripe.Transfer;
    const transferredAt = new Date(event.created * 1000).toISOString();

    const { error: updErr, count } = await supabase
      .from("trip_payments")
      .update(
        { status: "transferred", transferred_at: transferredAt },
        { count: "exact" }
      )
      .eq("transfer_id", transfer.id)
      .neq("status", "transferred");

    if (updErr) {
      processingError = `transfer.paid apply failed: ${updErr.message}`;
      console.error("[stripe-webhook]", processingError);
    } else if (count === 0) {
      // Either no trip_payments row links to this transfer (non-trip
      // transfer, e.g. a future elder-payout flow), OR the row is
      // already 'transferred' (Stripe redelivery). Both are fine.
      console.log(
        "[stripe-webhook] transfer.paid no-op for",
        transfer.id,
        "(no matching trip_payments row OR already transferred)"
      );
    } else {
      console.log(
        "[stripe-webhook] transfer.paid applied for",
        transfer.id,
        "→",
        count,
        "trip_payments rows marked transferred at",
        transferredAt
      );
    }

    // ── Reconciliation ledger: transfer.paid ──
    // user_id is null (the platform is the source). recipient_user_id is
    // the connected-account owner — pulled from transfer.metadata.
    // Stage 2 Bucket B: type='circle_payout' transfers carry
    // recipient_user_id + circle_id + cycle_id + pending_intent_id
    // directly. Legacy trip transfers use organizer_id + trip_id.
    const tMeta = (transfer.metadata ?? {}) as Record<string, string>;
    const isCirclePayout = tMeta.type === "circle_payout";
    const transferLedgerEventId = await writeLedgerEvent({
      stripe_object_id: transfer.id,
      event_type: "transfer.paid",
      amount_cents: transfer.amount ?? 0,
      currency: (transfer.currency ?? "usd").toUpperCase(),
      user_id: null,
      recipient_user_id: isCirclePayout
        ? maybeUuid(tMeta.recipient_user_id)
        : maybeUuid(tMeta.organizer_id),
      trip_id: isCirclePayout ? null : maybeUuid(tMeta.trip_id),
      circle_id: isCirclePayout ? maybeUuid(tMeta.circle_id) : null,
      cycle_id: isCirclePayout ? maybeUuid(tMeta.cycle_id) : null,
      external_reference_type: isCirclePayout ? "circle_payout" : "trip",
      external_reference_id: isCirclePayout
        ? maybeUuid(tMeta.pending_intent_id)
        : maybeUuid(tMeta.trip_id),
      metadata: tMeta,
    });

    // ── Circle-payout completion (Stage 2 Bucket B) ─────────────────────
    // Flip the circle_payouts row that process-circle-payout staged from
    // 'pending' to 'completed' and stamp completed_at + ledger_event_id.
    // Also stamp circle_cycles.actual_payout_date so the cycle UI can
    // surface "paid out at" without a join. The UPDATE filter on
    // status='pending' makes a Stripe re-delivery a clean no-op.
    if (isCirclePayout) {
      const cyclePayoutCycleId = maybeUuid(tMeta.cycle_id);
      const recipientUserIdMeta = maybeUuid(tMeta.recipient_user_id);
      const circleIdMeta = maybeUuid(tMeta.circle_id);
      const cycleNumberMeta =
        typeof tMeta.cycle_number === "string" ? tMeta.cycle_number : "";

      const { data: cpUpdated, error: cpErr, count: cpCount } = await supabase
        .from("circle_payouts")
        .update(
          {
            status: "completed",
            completed_at: transferredAt,
            ledger_event_id: transferLedgerEventId,
            actual_date: transferredAt,
          },
          { count: "exact" },
        )
        .eq("transfer_id", transfer.id)
        .eq("status", "pending")
        .select("id");
      if (cpErr) {
        processingError = processingError ??
          `circle_payouts update failed: ${cpErr.message}`;
        console.error("[stripe-webhook] circle_payouts update failed:", cpErr.message);
      } else if (cpCount === 0) {
        console.log(
          "[stripe-webhook] circle_payouts no-op for transfer",
          transfer.id,
          "(already completed OR not staged)",
        );
      } else {
        console.log(
          "[stripe-webhook] circle_payouts marked completed for transfer",
          transfer.id,
        );

        // ── Recipient-side activity-feed row ─────────────────────────
        // useRecentActivity on the Home screen reads wallet_transactions
        // for the caller. Without a row here, a completed circle payout
        // never surfaces in the feed — the money lands at the recipient's
        // Stripe Connect account (bank), and the app otherwise has no
        // ledger entry visible to the recipient's UI. Insert a
        // credit-direction row now that the transfer landed, gated on
        // cpCount > 0 so a Stripe re-delivery that no-ops the update
        // above doesn't double-insert.
        //
        // wallet_transactions (migration 015) requires wallet_id FK +
        // balance_before/after. Payouts don't move app-wallet balance
        // (funds go directly to the recipient's bank via Connect), so
        // balance_before === balance_after. The row is informational for
        // the feed; the ledger_events table remains the accounting truth.
        //
        // Failure is logged, never bubbled to processingError: the money
        // is already at the bank, circle_payouts is already 'completed',
        // and a Stripe retry would just short-circuit at the
        // duplicate-event ack. Manual reconciliation covers rare misses.
        if (recipientUserIdMeta) {
          const { data: recipientWallet } = await supabase
            .from("user_wallets")
            .select("id, main_balance_cents")
            .eq("user_id", recipientUserIdMeta)
            .maybeSingle();

          let circleName = "a circle";
          if (circleIdMeta) {
            const { data: circleRow } = await supabase
              .from("circles")
              .select("name")
              .eq("id", circleIdMeta)
              .maybeSingle();
            if (circleRow?.name) circleName = circleRow.name;
          }

          if (recipientWallet) {
            const balanceCents = recipientWallet.main_balance_cents ?? 0;
            const payoutRowId = cpUpdated?.[0]?.id ?? null;
            const { error: wtErr } = await supabase
              .from("wallet_transactions")
              .insert({
                wallet_id: recipientWallet.id,
                user_id: recipientUserIdMeta,
                transaction_type: "circle_payout",
                direction: "credit",
                amount_cents: transfer.amount ?? 0,
                balance_type: "main",
                balance_before_cents: balanceCents,
                balance_after_cents: balanceCents,
                reference_type: "circle_payout",
                reference_id: payoutRowId,
                description: `Payout from ${circleName}`,
                transaction_status: "completed",
                metadata: {
                  transfer_id: transfer.id,
                  cycle_id: cyclePayoutCycleId,
                  cycle_number: cycleNumberMeta,
                  circle_id: circleIdMeta,
                },
              });
            if (wtErr) {
              console.error(
                "[stripe-webhook] wallet_transactions insert failed for payout transfer",
                transfer.id,
                ":",
                wtErr.message,
              );
            } else {
              console.log(
                "[stripe-webhook] wallet_transactions inserted for payout transfer",
                transfer.id,
                "→ recipient",
                recipientUserIdMeta,
              );
            }
          } else {
            console.warn(
              "[stripe-webhook] no user_wallets row for recipient",
              recipientUserIdMeta,
              "— skipping activity-feed insert for transfer",
              transfer.id,
            );
          }
        }

        if (cyclePayoutCycleId) {
          // Soft-fail: a missing actual_payout_date on circle_cycles is
          // a polish issue, not a money problem. The ledger + payout
          // row already capture the source of truth.
          await supabase
            .from("circle_cycles")
            .update({ actual_payout_date: transferredAt.slice(0, 10) })
            .eq("id", cyclePayoutCycleId);
        }
      }
    }
  } else if (event.type === "transfer.failed") {
    // ── Stripe Connect: transfer.failed ─────────────────────────────────
    // Fires when a previously-paid Transfer was reversed (rare in Express
    // accounts; happens for routing-number changes, account closures,
    // bank rejection). For circle_payout transfers we flip the
    // circle_payouts row to 'failed' so admins can re-schedule. Legacy
    // trip transfers don't have a failed-state in trip_payments — we
    // log and ledger-only for those.
    const transfer = event.data.object as Stripe.Transfer;
    const tMeta = (transfer.metadata ?? {}) as Record<string, string>;
    const isCirclePayout = tMeta.type === "circle_payout";
    const transferredAt = new Date(event.created * 1000).toISOString();

    await writeLedgerEvent({
      stripe_object_id: transfer.id,
      event_type: "transfer.failed",
      amount_cents: transfer.amount ?? 0,
      currency: (transfer.currency ?? "usd").toUpperCase(),
      user_id: null,
      recipient_user_id: isCirclePayout
        ? maybeUuid(tMeta.recipient_user_id)
        : maybeUuid(tMeta.organizer_id),
      circle_id: isCirclePayout ? maybeUuid(tMeta.circle_id) : null,
      cycle_id: isCirclePayout ? maybeUuid(tMeta.cycle_id) : null,
      external_reference_type: isCirclePayout ? "circle_payout" : "trip",
      external_reference_id: isCirclePayout
        ? maybeUuid(tMeta.pending_intent_id)
        : null,
      metadata: tMeta,
    });

    if (isCirclePayout) {
      const { error: cpErr } = await supabase
        .from("circle_payouts")
        .update({
          status: "failed",
          completed_at: transferredAt,
        })
        .eq("transfer_id", transfer.id)
        .neq("status", "failed");
      if (cpErr) {
        processingError = processingError ??
          `circle_payouts failure update failed: ${cpErr.message}`;
        console.error("[stripe-webhook] circle_payouts failure update failed:", cpErr.message);
      } else {
        console.log(
          "[stripe-webhook] circle_payouts marked failed for transfer",
          transfer.id,
        );
      }
    } else {
      console.log(
        "[stripe-webhook] transfer.failed ledger-only for non-circle transfer",
        transfer.id,
      );
    }
  } else if (event.type === "charge.refunded") {
    // ── Reconciliation ledger: refund.succeeded ──
    // Stripe fires charge.refunded after a successful Refund (whether
    // issued via Dashboard or our process-refunds EF). The charge object
    // exposes amount_refunded (cumulative) and a refunds.data list with
    // per-refund amounts. We log the DELTA of this delivery — for a single
    // full refund that equals amount_refunded; for partials each refund
    // creates its own event with its own delta.
    //
    // No legacy side-effects from this event (the refund row write happens
    // in process-refunds before Stripe responds). So this branch is
    // ledger-only.
    const charge = event.data.object as Stripe.Charge;
    const lastRefund =
      charge.refunds && Array.isArray(charge.refunds.data) && charge.refunds.data.length > 0
        ? charge.refunds.data[charge.refunds.data.length - 1]
        : null;
    const refundAmount = lastRefund?.amount ?? charge.amount_refunded ?? 0;
    const cMeta = (charge.metadata ?? {}) as Record<string, string>;
    await writeLedgerEvent({
      stripe_object_id: charge.id,
      event_type: "refund.succeeded",
      amount_cents: refundAmount,
      currency: (charge.currency ?? "usd").toUpperCase(),
      user_id: maybeUuid(cMeta.user_id),
      trip_id: maybeUuid(cMeta.trip_id),
      circle_id: maybeUuid(cMeta.circle_id),
      external_reference_type: "charge",
      metadata: { ...cMeta, refund_id: lastRefund?.id ?? null },
    });
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
