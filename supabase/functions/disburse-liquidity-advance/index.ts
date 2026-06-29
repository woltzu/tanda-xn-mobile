// ═══════════════════════════════════════════════════════════════════════════
// disburse-liquidity-advance — Edge Function (Deno runtime)
//
// Dormant lending scaffold disbursement endpoint. Two gates in order:
//
//   1. Admin gate: caller must have an active admin_users row.
//   2. Feature flag: feature_gates.enabled WHERE id='lending_enabled'
//      must be TRUE. The flag defaults to FALSE per migration 280, so
//      every disburse call returns 403 until the platform owner flips
//      it. The eligibility + approval RPCs (migration 097) work
//      regardless — only money movement is gated.
//
// What this EF DOES (when both gates pass):
//   * Verify the advance is in status='approved' (the state
//     process_advance_request transitions to).
//   * Flip status='disbursed', stamp disbursed_at + disbursed_amount_cents.
//   * Write a ledger_events row event_type='loan.disbursed' linked to the
//     advance via external_reference_id + external_reference_type='liquidity_advance'.
//
// What this EF DOES NOT do (deliberately deferred to a future bucket):
//   * Stripe transfer to the recipient's connect account.
//   * Wallet credit to the recipient's TandaXn balance.
//   * Repayment scheduling (the `repay_by_date` on the advance row stays
//     authoritative; the scheduled-deduction mechanism is a separate
//     payout-time hook that doesn't exist yet).
//
// The "dormant" framing means we're standing up the lifecycle path
// (admin → approve → disburse → ledger) without moving real money.
// Once the platform commits to lending, a follow-up bucket adds the
// Stripe transfer alongside the existing state transition.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

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

  // ─── 2. Feature flag gate ─────────────────────────────────────────────
  // Migration 280 seeded id='lending_enabled' with enabled=false. Until
  // an operator flips this row to enabled=true, NO disbursement happens.
  // We return 403 (not 503) so the admin UI can surface a meaningful
  // "feature disabled" message rather than a transient-error retry.
  const { data: flag, error: flagErr } = await service
    .from("feature_gates")
    .select("enabled")
    .eq("id", "lending_enabled")
    .maybeSingle();
  if (flagErr) {
    console.error("[disburse-liquidity-advance] flag read failed:", flagErr.message);
    return jsonResponse(
      { error: "Failed to read lending flag", detail: flagErr.message },
      500,
    );
  }
  if (!flag?.enabled) {
    return jsonResponse(
      {
        error: "Lending is currently disabled",
        reason: "lending_disabled",
        flag: "lending_enabled",
      },
      403,
    );
  }

  // ─── 3. Parse + validate body ─────────────────────────────────────────
  let body: { advance_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const advanceId = typeof body.advance_id === "string" ? body.advance_id : "";
  if (!UUID_RE.test(advanceId)) {
    return jsonResponse({ error: "advance_id must be a valid UUID" }, 400);
  }

  // ─── 4. Load the advance — must be in status='approved' ──────────────
  // Status state machine (from liquidity_advances CHECK):
  //   requested → approved → disbursed → repaying → repaid
  //                       ↘ rejected / cancelled / defaulted
  // Only 'approved' → 'disbursed' is valid here. The CHECK constraint
  // would refuse other transitions even if we tried — surfacing as 409
  // is friendlier than letting the UPDATE 23514 bubble up.
  const { data: advance, error: advErr } = await service
    .from("liquidity_advances")
    .select(
      "id, member_id, circle_id, status, approved_amount_cents, requested_amount_cents, fee_amount_cents, total_repayment_cents",
    )
    .eq("id", advanceId)
    .maybeSingle();
  if (advErr || !advance) {
    return jsonResponse(
      { error: "Advance not found", detail: advErr?.message },
      404,
    );
  }
  if (advance.status !== "approved") {
    return jsonResponse(
      {
        error: `Advance is not in 'approved' state`,
        current_status: advance.status,
      },
      409,
    );
  }

  // ─── 5. Compute disbursed amount ─────────────────────────────────────
  // Prefer the admin-approved amount; fall back to requested for older
  // rows that pre-date the approved_amount_cents column being populated.
  const disbursedAmountCents = Number(
    advance.approved_amount_cents ?? advance.requested_amount_cents ?? 0,
  );
  if (!Number.isFinite(disbursedAmountCents) || disbursedAmountCents <= 0) {
    return jsonResponse(
      { error: "Advance has no valid amount to disburse" },
      400,
    );
  }

  // ─── 6. State transition ─────────────────────────────────────────────
  const disbursedAt = new Date().toISOString();
  const { error: updErr } = await service
    .from("liquidity_advances")
    .update({
      status: "disbursed",
      disbursed_amount_cents: disbursedAmountCents,
    })
    .eq("id", advanceId)
    .eq("status", "approved");
  if (updErr) {
    console.error("[disburse-liquidity-advance] update failed:", updErr.message);
    return jsonResponse(
      { error: "Failed to mark advance disbursed", detail: updErr.message },
      500,
    );
  }

  // ─── 7. Ledger event (migration 276) ─────────────────────────────────
  // Synthetic stripe_event_id derived from the advance id so the UNIQUE
  // constraint on ledger_events.stripe_event_id is satisfied without an
  // actual Stripe event. stripe_object_id reuses the advance id for
  // consistency. Disbursement isn't routed through Stripe yet (dormant
  // mode), so stripe_fee_cents stays 0.
  const { error: ledgerErr } = await service.from("ledger_events").insert({
    stripe_event_id: `liq_adv_disbursed:${advanceId}`,
    stripe_object_id: advanceId,
    event_type: "loan.disbursed",
    amount_cents: disbursedAmountCents,
    currency: "USD",
    user_id: null,
    recipient_user_id: advance.member_id,
    circle_id: advance.circle_id,
    external_reference_id: advanceId,
    external_reference_type: "liquidity_advance",
    stripe_fee_cents: 0,
    raw_payload: null,
    metadata: {
      admin_user_id: user.id,
      fee_amount_cents: advance.fee_amount_cents,
      total_repayment_cents: advance.total_repayment_cents,
      dormant: true,
    },
  });
  if (ledgerErr) {
    // Soft-fail: the state transition already succeeded. We surface the
    // ledger gap in the response but don't roll back; reconciliation can
    // backfill the ledger row from liquidity_advances + the audit trail.
    console.error(
      "[disburse-liquidity-advance] ledger insert failed (advance still marked disbursed):",
      ledgerErr.message,
    );
    return jsonResponse({
      advance_id: advanceId,
      status: "disbursed",
      disbursed_amount_cents: disbursedAmountCents,
      disbursed_at: disbursedAt,
      ledger_warning: ledgerErr.message,
    });
  }

  return jsonResponse({
    advance_id: advanceId,
    status: "disbursed",
    disbursed_amount_cents: disbursedAmountCents,
    disbursed_at: disbursedAt,
  });
});
