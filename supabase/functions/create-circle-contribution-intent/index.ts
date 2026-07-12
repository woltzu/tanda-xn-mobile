// ═══════════════════════════════════════════════════════════════════════════
// create-circle-contribution-intent — Edge Function (Deno runtime)
//
// Stage 2 Bucket A — real Stripe PaymentIntent for a circle contribution.
// Replaces the StripeConnectEngine._createStripePaymentIntent mock that
// previously returned `pi_test_<timestamp>` and a fake clientSecret, so
// the wallet path was the only way to actually pay before this EF.
//
// Flow:
//   1. Verify caller's JWT — derive user_id from auth, NEVER from body
//      (body-supplied user_id is a forgery vector — any authenticated user
//      could move another user's circle row to 'paid').
//   2. Validate caller is a circle_members row (status='active'). Non-
//      members can't contribute even if they know the circle UUID.
//   3. Resolve cycle_id from circle_cycles by (circle_id, cycle_number)
//      when the screen passed cycle_number. NULL is fine — the contribution
//      stays unlinked to a specific cycle row.
//   4. Write a pending_intents row BEFORE Stripe is called so we have a
//      forensic record of EVERY attempt, even ones that never get a
//      webhook (Stripe error, network drop).
//   5. Create the PaymentIntent with metadata that the stripe-webhook
//      reads back to (a) write the ledger row and (b) upsert
//      circle_contributions on success.
//   6. Persist to stripe_payment_intents so the existing
//      payment_intent.* webhook handler can update its status.
//
// metadata stamped on PI:
//   - type=circle_contribution         ← webhook branch key
//   - user_id, circle_id, cycle_id     ← copied to ledger_events row
//   - cycle_number                     ← used by webhook to upsert
//                                        circle_contributions
//   - pending_intent_id                ← used by webhook as
//                                        external_reference_id
//   - client_reference_id              ← idempotency anchor
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse(
      { error: "Unauthenticated", detail: userErr?.message },
      401,
    );
  }

  // ─── 2. Parse + validate body ─────────────────────────────────────────
  let body: {
    circle_id?: unknown;
    amount_cents?: unknown;
    currency?: unknown;
    cycle_number?: unknown;
    payment_method_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const circleId = typeof body.circle_id === "string" ? body.circle_id : "";
  if (!UUID_RE.test(circleId)) {
    return jsonResponse({ error: "circle_id must be a valid UUID" }, 400);
  }

  const amountCents = body.amount_cents;
  if (!Number.isInteger(amountCents) || (amountCents as number) < 50) {
    return jsonResponse(
      { error: "amount_cents must be an integer ≥ 50" },
      400,
    );
  }

  const currency =
    typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";

  // cycle_number is optional; when present it's an integer ≥ 1.
  let cycleNumber: number | null = null;
  if (body.cycle_number !== undefined && body.cycle_number !== null) {
    if (
      !Number.isInteger(body.cycle_number) ||
      (body.cycle_number as number) < 1
    ) {
      return jsonResponse(
        { error: "cycle_number must be a positive integer when provided" },
        400,
      );
    }
    cycleNumber = body.cycle_number as number;
  }

  const paymentMethodId =
    typeof body.payment_method_id === "string" && body.payment_method_id.length
      ? body.payment_method_id
      : null;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── 3. Load the circle to read fee config ───────────────────────────
  // Stage 2 Bucket C — premium circles (is_premium=true) charge a
  // platform fee on top of the contribution amount. Ordinary circles
  // stay free (is_premium=false → platform_fee_bps=0). We trust the
  // CHECK in migration 279 to keep platform_fee_bps in [0,1000].
  const { data: circleRow, error: circleErr } = await serviceClient
    .from("circles")
    .select("is_premium, platform_fee_bps")
    .eq("id", circleId)
    .maybeSingle();
  if (circleErr || !circleRow) {
    return jsonResponse(
      { error: "Circle not found", detail: circleErr?.message },
      404,
    );
  }
  const platformFeeBps = circleRow.is_premium
    ? Math.max(0, Number(circleRow.platform_fee_bps) || 0)
    : 0;
  const platformFeeCents = Math.round(
    ((amountCents as number) * platformFeeBps) / 10000,
  );
  // Fee is on TOP of the contribution: the member pays amount + fee,
  // the circle gets full amount, the platform retains the fee.
  const chargeAmountCents = (amountCents as number) + platformFeeCents;

  // ─── 4. Verify caller is an active member of the circle ──────────────
  // Two layers of defense: anon callers can't reach this EF (JWT-gated
  // above), and this check stops a logged-in user from contributing to a
  // circle they don't belong to.
  const { data: memberRow, error: memberErr } = await serviceClient
    .from("circle_members")
    .select("id, status")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberErr) {
    console.error("[create-circle-contribution-intent] member lookup failed:", memberErr.message);
    return jsonResponse(
      { error: "Failed to verify membership", detail: memberErr.message },
      500,
    );
  }
  if (!memberRow) {
    return jsonResponse(
      { error: "Caller is not a member of this circle" },
      403,
    );
  }
  if (memberRow.status && memberRow.status !== "active") {
    return jsonResponse(
      { error: `Membership status '${memberRow.status}' is not eligible to contribute` },
      403,
    );
  }

  // ─── 4. Resolve cycle UUID from cycle_number (when provided) ──────────
  // The screen's getCurrentCycleInfo() computes cycleNumber client-side.
  // We map it to circle_cycles.id so the ledger + contribution rows
  // can both reference a real cycle UUID. A missing row is non-fatal —
  // pre-cycle-table circles still pay; cycle_id stays NULL.
  let cycleId: string | null = null;
  if (cycleNumber !== null) {
    const { data: cycleRow } = await serviceClient
      .from("circle_cycles")
      .select("id")
      .eq("circle_id", circleId)
      .eq("cycle_number", cycleNumber)
      .maybeSingle();
    cycleId = cycleRow?.id ?? null;
  }

  // ─── 4b. Duplicate-contribution guard ────────────────────────────────
  // Block a second contribution to the same cycle. Only applied when the
  // caller passed cycle_number — with NULL we can't tell which cycle to
  // check, so we let the request through rather than risk false-positives
  // on pre-cycle-table circles (they still write to circle_contributions
  // with cycle_number defaulted to 1 on the webhook side).
  //
  // 'paid' is the only blocking status. Rows in 'pending' / 'due' /
  // 'overdue' are legitimate contribution attempts still in flight —
  // treating them as duplicates would strand any user whose first PI
  // failed at 3-D Secure or ACH decline. The webhook's own guard
  // (`neq status paid` on the update, then insert-else path) prevents
  // double-crediting the same paid row.
  if (cycleNumber !== null) {
    const { data: existingPaid, error: dupErr } = await serviceClient
      .from("circle_contributions")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .eq("cycle_number", cycleNumber)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    if (dupErr) {
      console.error(
        "[create-circle-contribution-intent] duplicate-check failed:",
        dupErr.message,
      );
      return jsonResponse(
        {
          error: "Failed to verify contribution history",
          detail: dupErr.message,
        },
        500,
      );
    }
    if (existingPaid) {
      return jsonResponse(
        {
          error: "You have already contributed to this cycle",
          code: "already_contributed",
        },
        409,
      );
    }
  }

  // ─── 5. Write pending_intents BEFORE calling Stripe ───────────────────
  // Reconciliation ledger (migration 276 + 277): a pending row exists for
  // every attempt, including ones that never reach Stripe. The
  // client_reference_id is the idempotency anchor — if the call were
  // retried, the UNIQUE on client_reference_id would block a second row.
  // We generate a fresh UUID per call rather than basing it on circle/user/
  // cycle: deliberate re-attempts (e.g. card declined → user retries) get
  // their own pending row + their own Stripe PI, so retry diagnostics stay
  // legible.
  const clientReferenceId = `client_ref_contrib_${crypto.randomUUID()}`;
  const { data: pending, error: pendingErr } = await serviceClient
    .from("pending_intents")
    .insert({
      client_reference_id: clientReferenceId,
      user_id: user.id,
      circle_id: circleId,
      cycle_id: cycleId,
      intent_type: "charge",
      // amount_cents on the pending row mirrors the actual Stripe charge
      // (contribution + platform fee) so reconciliation matches the
      // ledger row 1:1. Contribution amount + fee breakdown live in
      // metadata for downstream attribution.
      amount_cents: chargeAmountCents,
      currency: currency.toUpperCase(),
      metadata: {
        purpose: "contribution",
        cycle_number: cycleNumber,
        payment_method_id: paymentMethodId,
        contribution_cents: amountCents as number,
        platform_fee_cents: platformFeeCents,
        platform_fee_bps: platformFeeBps,
        is_premium: !!circleRow.is_premium,
      },
    })
    .select("id")
    .single();
  if (pendingErr || !pending) {
    console.error(
      "[create-circle-contribution-intent] pending_intents insert failed:",
      pendingErr?.message,
    );
    return jsonResponse(
      { error: "Failed to record pending intent", detail: pendingErr?.message },
      500,
    );
  }

  // ─── 6. Create the PaymentIntent on Stripe ────────────────────────────
  // Charge = contribution + platform fee. The fee is on top of the
  // contribution per doc 35 (member pays both; circle gets full
  // contribution; platform retains fee).
  const idempotencyKey = crypto.randomUUID();
  const metadata: Record<string, string> = {
    user_id: user.id,
    type: "circle_contribution",
    circle_id: circleId,
    cycle_id: cycleId ?? "",
    cycle_number: cycleNumber !== null ? String(cycleNumber) : "",
    pending_intent_id: pending.id,
    client_reference_id: clientReferenceId,
    contribution_cents: String(amountCents as number),
    platform_fee_cents: String(platformFeeCents),
    platform_fee_bps: String(platformFeeBps),
  };
  const description = `Circle contribution ${circleId}${
    cycleNumber !== null ? ` cycle ${cycleNumber}` : ""
  }${platformFeeCents > 0 ? ` (+${platformFeeBps} bps fee)` : ""}`;

  // Resolve the caller's Stripe customer. Stripe requires the customer
  // to be present on the PaymentIntent whenever a payment_method is
  // attached that already belongs to a customer — otherwise it rejects
  // with "The payment_method parameter supplied ... belongs to the
  // Customer ... Please include the Customer in the customer parameter
  // on the PaymentIntent." Even when no PM is passed, including the
  // customer is best-practice: PaymentSheet can then list this
  // customer's saved methods.
  const { data: custRow, error: custErr } = await serviceClient
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("member_id", user.id)
    .maybeSingle();
  if (custErr) {
    console.error(
      "[create-circle-contribution-intent] stripe_customers lookup failed:",
      custErr.message,
    );
    return jsonResponse(
      { error: "Failed to look up Stripe customer", detail: custErr.message },
      500,
    );
  }

  const piParams: Stripe.PaymentIntentCreateParams = {
    amount: chargeAmountCents,
    currency,
    metadata,
    description,
    automatic_payment_methods: { enabled: true },
  };
  if (custRow?.stripe_customer_id) {
    piParams.customer = custRow.stripe_customer_id;
  }
  // If the screen already picked a saved Stripe payment method, attach
  // it AND confirm on the server. Without confirm=true the client
  // would still have to run PaymentSheet, which re-prompts for card
  // entry even though the PM is already on the PI — the user
  // experience the change is fixing. off_session=false because the
  // user is actively tapping Confirm; return_url covers redirect-
  // based next_action steps (3-D Secure challenges on iOS).
  if (paymentMethodId) {
    piParams.payment_method = paymentMethodId;
    piParams.confirm = true;
    piParams.off_session = false;
    piParams.return_url = "tandaxn://stripe-redirect";
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(piParams, { idempotencyKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-circle-contribution-intent] stripe.create failed:", msg);
    return jsonResponse({ error: "Stripe error", detail: msg }, 502);
  }

  // Resolve the DB row uuid for the Stripe pm id. The
  // stripe_payment_intents.payment_method_id column is UUID FK to
  // stripe_payment_methods.id — inserting the raw pm_... string
  // fails with "invalid input syntax for type uuid". If the caller
  // didn't pass a payment_method (PaymentSheet-picks-later path)
  // this stays null and the insert still succeeds.
  let paymentMethodRowId: string | null = null;
  if (paymentMethodId) {
    const { data: pmRow, error: pmLookupErr } = await serviceClient
      .from("stripe_payment_methods")
      .select("id")
      .eq("stripe_payment_method_id", paymentMethodId)
      .eq("member_id", user.id)
      .maybeSingle();
    if (pmLookupErr) {
      console.warn(
        "[create-circle-contribution-intent] payment_method row lookup failed (continuing with null FK):",
        pmLookupErr.message,
      );
    } else {
      paymentMethodRowId = pmRow?.id ?? null;
    }
  }

  // ─── 7. Persist to stripe_payment_intents ────────────────────────────
  // Mirrors the create-trip-payment-intent shape so the webhook's
  // payment_intent.* handler can update the row's status on every
  // subsequent event (.processing / .succeeded / .canceled).
  const { error: insErr } = await serviceClient
    .from("stripe_payment_intents")
    .insert({
      stripe_payment_intent_id: intent.id,
      member_id: user.id,
      // amount_cents on stripe_payment_intents is the actual Stripe
      // charge (contribution + platform fee). Keeps Stripe-side and
      // DB-side amounts consistent — admin views can compare PI amount
      // to ledger amount_cents without arithmetic.
      amount_cents: chargeAmountCents,
      currency,
      status: intent.status,
      purpose: "contribution",
      circle_id: circleId,
      cycle_id: cycleId,
      payment_method_id: paymentMethodRowId,
      idempotency_key: idempotencyKey,
      description,
      metadata: intent.metadata,
    });
  if (insErr) {
    console.error(
      "[create-circle-contribution-intent] stripe_payment_intents insert failed for PI",
      intent.id,
      ":",
      insErr.message,
    );
    return jsonResponse(
      {
        error: "Failed to persist payment intent",
        detail: insErr.message,
        stripe_payment_intent_id: intent.id,
        pending_intent_id: pending.id,
      },
      500,
    );
  }

  // ─── 8. Return clientSecret + status so the client can skip
  // PaymentSheet when the server-side confirm already succeeded.
  // status='requires_action' → client runs handleNextAction (3DS).
  // status='succeeded' → done, no client Stripe call needed.
  // status='requires_payment_method' / 'requires_confirmation' →
  //   client falls back to PaymentSheet (fresh card entry path).
  return jsonResponse({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    pendingIntentId: pending.id,
    status: intent.status,
    // contribution_cents: amount that lands on the circle.
    // platform_fee_cents: what TandaXn retains (0 for ordinary circles).
    // charge_cents: what Stripe actually bills the member.
    contribution_cents: amountCents as number,
    platform_fee_cents: platformFeeCents,
    platform_fee_bps: platformFeeBps,
    charge_cents: chargeAmountCents,
    currency,
  });
});
