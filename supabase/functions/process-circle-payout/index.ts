// ═══════════════════════════════════════════════════════════════════════════
// process-circle-payout — Edge Function (Deno runtime)
//
// Stage 2 Bucket B — closes a cycle by transferring the pot to the
// designated recipient via Stripe Connect, with full ledger linkage
// (migrations 276 / 277 / 278).
//
// Auth model: admin-only. Same pattern as process-refunds (admin_users
// row with is_active=true). Cycle closure is a high-trust operation
// because it moves money from the platform balance to a connected
// account — we don't want it reachable by any authenticated user.
//
// Flow:
//   1. Verify caller's JWT + admin gate.
//   2. Load circle_cycles row by id (recipient_user_id, payout_amount,
//      circle_id, cycle_number — note `cycle_status` not `status`).
//   3. Bail early if is_cycle_paid_out(cycle_id) is true OR a pending
//      circle_payouts row already exists for this cycle (the second
//      check catches in-flight transfers that haven't landed yet).
//   4. Resolve recipient's stripe_connect_account_id from profiles.
//   5. Write pending_intents row (intent_type='transfer') BEFORE
//      calling Stripe — forensic trail for crashes / timeouts.
//   6. Create the Stripe Transfer with a deterministic idempotency key
//      on cycle_id so retries can't double-pay.
//   7. Insert a circle_payouts row with status='pending', stamping
//      transfer_id + pending_intent_id. The webhook flips it to
//      'completed' on transfer.paid.
//
// Status semantics: the existing circle_payouts.status CHECK permits
//   ('scheduled','pending','processing','completed','failed','cancelled')
// We use 'pending' here; the webhook will transition to 'completed' on
// transfer.paid. There is NO 'paid' — the UI label "Paid" maps to the
// 'completed' status.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth — admin only ─────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "Unauthenticated", detail: userErr?.message }, 401);
  }

  const service = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminRow } = await service
    .from("admin_users")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!adminRow) {
    return jsonResponse({ error: "Admin access required" }, 403);
  }

  // ─── 2. Parse + validate body ─────────────────────────────────────────
  let body: { cycle_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const cycleId = typeof body.cycle_id === "string" ? body.cycle_id : "";
  if (!UUID_RE.test(cycleId)) {
    return jsonResponse({ error: "cycle_id must be a valid UUID" }, 400);
  }

  // ─── 3. Load cycle ────────────────────────────────────────────────────
  // Column names are `cycle_status` and `payout_amount` (numeric dollars) —
  // NOT the spec's `status` and assumed-int cents. Recipient is
  // `recipient_user_id` on circle_cycles (matches what the spec assumes).
  const { data: cycle, error: cycleErr } = await service
    .from("circle_cycles")
    .select(
      "id, circle_id, cycle_number, payout_amount, recipient_user_id, cycle_status",
    )
    .eq("id", cycleId)
    .maybeSingle();
  if (cycleErr || !cycle) {
    return jsonResponse(
      { error: "Cycle not found", detail: cycleErr?.message },
      404,
    );
  }
  if (!cycle.recipient_user_id) {
    return jsonResponse(
      { error: "Cycle has no recipient assigned" },
      400,
    );
  }
  if (cycle.payout_amount === null || Number(cycle.payout_amount) <= 0) {
    return jsonResponse(
      { error: "Cycle has no payout_amount set" },
      400,
    );
  }

  // ─── 4. Idempotency: cycle already paid out? ──────────────────────────
  // Two checks:
  //   a. is_cycle_paid_out RPC catches completed payouts.
  //   b. Direct SELECT catches in-flight (pending/processing) rows so a
  //      double-tap doesn't stage two Stripe Transfers in quick succession.
  const { data: existingDone } = await service.rpc("is_cycle_paid_out", {
    p_cycle_id: cycleId,
  });
  if (existingDone === true) {
    return jsonResponse(
      { error: "Cycle already paid out" },
      409,
    );
  }
  const { data: inFlight } = await service
    .from("circle_payouts")
    .select("id, status, transfer_id")
    .eq("cycle_id", cycleId)
    .in("status", ["pending", "processing"])
    .maybeSingle();
  if (inFlight) {
    return jsonResponse(
      {
        error: "A payout is already in flight for this cycle",
        payout_id: inFlight.id,
        transfer_id: inFlight.transfer_id,
      },
      409,
    );
  }

  // ─── 5. Recipient's Stripe Connect account ────────────────────────────
  const { data: profile } = await service
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", cycle.recipient_user_id)
    .maybeSingle();
  if (!profile?.stripe_connect_account_id) {
    return jsonResponse(
      { error: "Recipient has not connected their Stripe account" },
      400,
    );
  }

  // ─── 6. Pending intent BEFORE Stripe ──────────────────────────────────
  // client_reference_id is deterministic on cycle_id so a retried call
  // (admin re-clicking, EF crash before insert returns) lands on the
  // UNIQUE and surfaces as an idempotent replay rather than a phantom row.
  const amountCents = Math.round(Number(cycle.payout_amount) * 100);
  const clientReferenceId = `client_ref_payout_${cycleId}`;
  const { data: pending, error: pendingErr } = await service
    .from("pending_intents")
    .insert({
      client_reference_id: clientReferenceId,
      user_id: null,
      recipient_user_id: cycle.recipient_user_id,
      circle_id: cycle.circle_id,
      cycle_id: cycleId,
      intent_type: "transfer",
      amount_cents: amountCents,
      currency: "USD",
      metadata: {
        cycle_number: cycle.cycle_number,
        admin_user_id: user.id,
      },
    })
    .select("id")
    .single();
  if (pendingErr || !pending) {
    const isDup =
      pendingErr?.code === "23505" ||
      /duplicate key|already exists/i.test(pendingErr?.message ?? "");
    if (!isDup) {
      console.error("[process-circle-payout] pending_intents insert failed:", pendingErr?.message);
      return jsonResponse(
        { error: "Failed to record pending intent", detail: pendingErr?.message },
        500,
      );
    }
    // Dup: resolve the existing id rather than failing — we still need
    // to push the Transfer through (the prior attempt may have crashed
    // before reaching Stripe).
    const { data: existing } = await service
      .from("pending_intents")
      .select("id")
      .eq("client_reference_id", clientReferenceId)
      .maybeSingle();
    if (!existing) {
      return jsonResponse(
        { error: "Pending intent UNIQUE collision but row not found" },
        500,
      );
    }
    (pending as unknown as { id: string }) = existing as { id: string };
  }

  // ─── 7. Insert circle_payouts (status='executing') BEFORE Stripe ─────
  // Doc 39 Phase 3 (Option B): row lands with status='executing' before
  // the Transfer API call so audit is preserved even if Stripe fails or
  // times out mid-call. transfer_id is NULL at this stage — populated
  // in step 9 after Stripe returns. On Stripe failure, we UPDATE the
  // row to status='failed' with an error note (step 9b).
  //
  // 'executing' is meaningful in the Payout Console — mig 380's
  // list_in_flight_payouts RPC queries status IN ('executing','processing')
  // so admins see a live row for the duration of the Transfer.
  const transferGroup = `circle_${cycle.circle_id}_cycle_${cycleId}`;
  const { data: payout, error: payoutErr } = await service
    .from("circle_payouts")
    .insert({
      circle_id: cycle.circle_id,
      cycle_id: cycleId,
      cycle_number: cycle.cycle_number,
      recipient_id: cycle.recipient_user_id,
      amount: Number(cycle.payout_amount),
      amount_cents: amountCents,
      currency: "USD",
      status: "executing",
      transfer_id: null,
      pending_intent_id: pending.id,
      payment_method: "stripe",
      metadata: {
        admin_user_id: user.id,
        transfer_group: transferGroup,
        client_reference_id: clientReferenceId,
        stage: "pre_transfer",
      },
    })
    .select("id")
    .single();
  if (payoutErr || !payout) {
    console.error(
      "[process-circle-payout] pre-Stripe circle_payouts insert failed:",
      payoutErr?.message,
    );
    return jsonResponse(
      { error: "Failed to record pre-Stripe payout row", detail: payoutErr?.message },
      500,
    );
  }

  // ─── 8. Create the Stripe Transfer ────────────────────────────────────
  // Idempotency key is deterministic on cycle_id — Stripe will return the
  // SAME Transfer object on retry rather than creating a second one. This
  // is the canonical guard against double-payouts.
  const idempotencyKey = `payout-${cycleId}`;
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: amountCents,
        currency: "usd",
        destination: profile.stripe_connect_account_id,
        transfer_group: transferGroup,
        description: `Circle payout cycle ${cycle.cycle_number}`,
        metadata: {
          type: "circle_payout",
          circle_id: cycle.circle_id,
          cycle_id: cycleId,
          cycle_number: String(cycle.cycle_number),
          recipient_user_id: cycle.recipient_user_id,
          pending_intent_id: pending.id,
          payout_id: payout.id,
          client_reference_id: clientReferenceId,
        },
      },
      { idempotencyKey },
    );
  } catch (e) {
    // ─── 8b. Stripe failed — flip the pre-inserted row to 'failed' ──────
    // Preserves the audit trail (row + reason) even though no money
    // moved. Best-effort; log if the update itself fails.
    const stripeErrMsg = (e as Error).message;
    console.error("[process-circle-payout] stripe.transfers.create failed:", stripeErrMsg);
    const { error: failUpdErr } = await service
      .from("circle_payouts")
      .update({
        status: "failed",
        notes: `Stripe transfer failed: ${stripeErrMsg.slice(0, 480)}`,
        metadata: {
          admin_user_id: user.id,
          transfer_group: transferGroup,
          client_reference_id: clientReferenceId,
          stage: "stripe_failed",
          stripe_error: stripeErrMsg,
        },
      })
      .eq("id", payout.id);
    if (failUpdErr) {
      console.error(
        "[process-circle-payout] circle_payouts fail-update also failed for payout",
        payout.id,
        ":",
        failUpdErr.message,
      );
    }
    return jsonResponse(
      {
        error: "Stripe transfer failed",
        detail: stripeErrMsg,
        payout_id: payout.id,
      },
      502,
    );
  }

  // ─── 9. Stripe accepted the Transfer — stamp transfer_id on the row ──
  // status stays 'executing' until the transfer.paid webhook flips it to
  // 'completed'. Stripe-webhook's UPDATE filter accepts both 'executing'
  // and legacy 'pending' rows (see stripe-webhook line ~834 change).
  const { error: transferStampErr } = await service
    .from("circle_payouts")
    .update({
      transfer_id: transfer.id,
      metadata: {
        admin_user_id: user.id,
        transfer_group: transferGroup,
        client_reference_id: clientReferenceId,
        stage: "stripe_accepted",
      },
    })
    .eq("id", payout.id);
  if (transferStampErr) {
    // The Transfer already exists on Stripe — we can't undo it. Row is
    // still 'executing' but without transfer_id, so the webhook can't
    // find it. Surface for manual reconciliation.
    console.error(
      "[process-circle-payout] transfer_id stamp failed AFTER Transfer creation:",
      transferStampErr.message,
      "transfer_id=",
      transfer.id,
      "payout_id=",
      payout.id,
    );
    return jsonResponse(
      {
        error: "Transfer succeeded but transfer_id stamp failed — manual reconciliation needed",
        detail: transferStampErr.message,
        transfer_id: transfer.id,
        payout_id: payout.id,
        pending_intent_id: pending.id,
      },
      500,
    );
  }

  return jsonResponse({
    transfer_id: transfer.id,
    payout_id: payout.id,
    pending_intent_id: pending.id,
    amount_cents: amountCents,
    status: "executing",
  });
});
