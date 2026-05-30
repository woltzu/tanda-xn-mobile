// ═══════════════════════════════════════════════════════════════════════════
// create-payment-intent — Edge Function (Deno runtime)
//
// Creates a Stripe PaymentIntent for the authenticated user, records it in
// stripe_payment_intents, and returns the client_secret so the mobile client
// can present a PaymentSheet.
//
// Supported purposes (caller picks via `purpose` field in body):
//   - 'wallet_deposit' (default — original Path A smoke test)
//   - 'goal_deposit'   (extension, migration 074):
//        Caller passes { purpose: 'goal_deposit', goalId, applyCardFee,
//                       paymentMethodType?, paymentMethodId? }.
//        We verify the caller owns goalId, optionally add a 1.5% card fee on
//        top of the deposit amount (card path only), and stamp
//        metadata.type='goal_deposit' + metadata.goal_id +
//        metadata.deposit_amount_cents + metadata.fee_cents + metadata.source
//        so the webhook can call credit_goal_external on success.
//
//        paymentMethodType (default 'card'):
//          - 'card': automatic_payment_methods, applyCardFee respected,
//            metadata.source='card'.
//          - 'us_bank_account': payment_method=paymentMethodId (required,
//            must be a Stripe PM owned by the caller via stripe_bank_accounts),
//            confirm=true with mandate_data filled from req headers for ACH
//            authorization. No card fee. metadata.source='bank'.
//
// Auth model:
//   - JWT-scoped client (from caller's Authorization header) → used ONLY to
//     verify the user.
//   - Service-role client → used to INSERT into stripe_payment_intents
//     (RLS-bypass; the table has a service_role ALL policy).
//
// Schema notes (verified against live DB 2026-05-30):
//   - amount_cents (NOT amount), integer, CHECK (> 0)
//   - purpose NOT NULL, CHECK ∈ ('contribution', 'insurance_premium',
//     'late_fee', 'loan_repayment', 'wallet_deposit', 'membership_fee',
//     'goal_deposit')  ← 'goal_deposit' added by migration 074
//   - goal_id UUID nullable, FK -> user_savings_goals(id)  ← added by 074
//   - client_secret is NOT stored in DB (returned to client only)
//   - idempotency_key UNIQUE — we send a fresh UUID per request
//
// Card-fee model (goal_deposit only, applyCardFee=true):
//   The user-facing fee is added on TOP of the deposit. For a $100 deposit
//   the Stripe charge is $101.50; $100 is credited to the goal; $1.50 is
//   the platform's gross margin (Stripe's own card fee comes out of that —
//   the 1.5% is presented to the user as a "card processing fee"). We do
//   NOT use Stripe Connect's application_fee_amount because this is a
//   direct platform charge, not a transfer to a connected account.
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
// apiVersion omitted — using stripe@^17 SDK default per Path A plan

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth — verify caller's JWT and extract user_id ───
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // JWT-scoped client — purely to verify caller identity
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
      401
    );
  }

  // ─── 2. Parse + validate body ───
  let body: {
    amount?: unknown;
    currency?: unknown;
    purpose?: unknown;
    goalId?: unknown;
    applyCardFee?: unknown;
    paymentMethodType?: unknown;
    paymentMethodId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const amount = body.amount;
  const currency =
    typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";
  const purpose =
    typeof body.purpose === "string" ? body.purpose : "wallet_deposit";
  // Default to 'card' so existing callers (Path A smoke test, the goal
  // card-deposit screen pre-bank) keep their existing behaviour.
  const paymentMethodType =
    typeof body.paymentMethodType === "string" ? body.paymentMethodType : "card";
  const paymentMethodId =
    typeof body.paymentMethodId === "string" ? body.paymentMethodId : null;

  if (!Number.isInteger(amount) || (amount as number) < 50) {
    return jsonResponse(
      { error: "amount must be an integer number of cents ≥ 50" },
      400
    );
  }

  const ALLOWED_PAYMENT_METHODS = new Set(["card", "us_bank_account"]);
  if (!ALLOWED_PAYMENT_METHODS.has(paymentMethodType)) {
    return jsonResponse(
      { error: `paymentMethodType '${paymentMethodType}' is not supported` },
      400
    );
  }

  const ALLOWED_PURPOSES = new Set([
    "wallet_deposit",
    "goal_deposit",
    // Other live purposes (contribution / late_fee / loan_repayment / etc.)
    // are reachable through other code paths; accepting here would let any
    // authenticated caller stuff an arbitrary purpose into the table.
  ]);
  if (!ALLOWED_PURPOSES.has(purpose)) {
    return jsonResponse(
      { error: `purpose '${purpose}' is not supported by this endpoint` },
      400
    );
  }

  // ─── 2b. Goal-deposit specific validation + fee computation ──────────────
  // For non-goal purposes the deposit equals the charge; goal_id + fee
  // metadata stay null.
  let goalId: string | null = null;
  let chargeAmountCents = amount as number;          // what we charge Stripe
  let depositAmountCents = amount as number;          // what goes to the goal
  let feeCents = 0;                                   // platform card-fee
  let description = "Path A smoke test — wallet deposit";

  if (purpose === "goal_deposit") {
    const goalIdRaw = typeof body.goalId === "string" ? body.goalId : "";
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(goalIdRaw)) {
      return jsonResponse(
        { error: "goalId must be a valid UUID when purpose='goal_deposit'" },
        400
      );
    }
    goalId = goalIdRaw;

    // Verify the caller owns the goal — defends the FK at the application
    // layer rather than waiting for the DB-level insert to fail. We use the
    // auth-scoped client so the lookup is gated by user_savings_goals RLS.
    const { data: ownedGoal, error: goalErr } = await authClient
      .from("user_savings_goals")
      .select("id")
      .eq("id", goalId)
      .maybeSingle();
    if (goalErr) {
      console.error(
        "[create-payment-intent] goal ownership check failed:",
        goalErr.message
      );
      return jsonResponse(
        { error: "Failed to verify goal ownership", detail: goalErr.message },
        500
      );
    }
    if (!ownedGoal) {
      return jsonResponse(
        { error: "Goal not found or not owned by caller" },
        403
      );
    }

    if (paymentMethodType === "us_bank_account") {
      // Bank path — paymentMethodId must be present and owned by the user
      // via stripe_bank_accounts (the Financial Connections linked-banks
      // table, migration 075). No card fee on bank deposits — the screen
      // advertises "Bank transfers are free".
      if (!paymentMethodId) {
        return jsonResponse(
          { error: "paymentMethodId is required when paymentMethodType='us_bank_account'" },
          400
        );
      }
      const serviceClientForCheck = createClient(supabaseUrl, serviceRoleKey);
      const { data: bankRow, error: bankErr } = await serviceClientForCheck
        .from("stripe_bank_accounts")
        .select("id")
        .eq("user_id", user.id)
        .eq("stripe_payment_method_id", paymentMethodId)
        .maybeSingle();
      if (bankErr) {
        console.error(
          "[create-payment-intent] bank ownership check failed:",
          bankErr.message
        );
        return jsonResponse(
          { error: "Failed to verify bank payment method", detail: bankErr.message },
          500
        );
      }
      if (!bankRow) {
        return jsonResponse(
          { error: "Bank payment method not found or not owned by caller" },
          403
        );
      }
      description = `Goal deposit ${goalId} (bank)`;
      // chargeAmountCents stays = amount (no fee).
    } else {
      description = `Goal deposit ${goalId}`;
      // applyCardFee=true means the user opted into the card path; charge
      // amount + 1.5% on TOP. The deposit credited to the goal is still
      // `amount`; the fee is platform margin.
      if (body.applyCardFee === true) {
        feeCents = Math.round((amount as number) * 0.015);
        chargeAmountCents = (amount as number) + feeCents;
      }
    }
  }

  // ─── 3. Create PaymentIntent on Stripe ───
  // Fresh UUID for idempotency so accidental double-clicks don't double-charge.
  const idempotencyKey = crypto.randomUUID();

  // source is the value that lands in savings_transactions.source after the
  // webhook calls credit_goal_external. Clean values: 'card' or 'bank'.
  const goalSource = paymentMethodType === "us_bank_account" ? "bank" : "card";

  const metadata: Record<string, string> =
    purpose === "goal_deposit"
      ? {
          user_id: user.id,
          type: "goal_deposit",
          goal_id: goalId as string,
          deposit_amount_cents: String(depositAmountCents),
          fee_cents: String(feeCents),
          source: goalSource,
        }
      : {
          user_id: user.id,
          test_charge: "true",
          source: "path_a_smoke_test",
        };

  // Build PI create params. Card path uses automatic_payment_methods so
  // Stripe picks the best wallet at checkout; bank path is explicit because
  // the payment_method is pre-selected and ACH requires a mandate.
  const piCreateParams: Stripe.PaymentIntentCreateParams = {
    amount: chargeAmountCents,
    currency,
    metadata,
    description,
  };

  if (purpose === "goal_deposit" && paymentMethodType === "us_bank_account") {
    // Resolve the user's Stripe customer — PaymentIntents with an attached
    // bank PaymentMethod require a customer on the PI.
    const serviceClientForCust = createClient(supabaseUrl, serviceRoleKey);
    const { data: custRow } = await serviceClientForCust
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (!custRow?.stripe_customer_id) {
      return jsonResponse(
        { error: "No Stripe customer for user — link a bank first to create one" },
        400
      );
    }

    piCreateParams.payment_method_types = ["us_bank_account"];
    piCreateParams.payment_method = paymentMethodId as string;
    piCreateParams.customer = custRow.stripe_customer_id;
    piCreateParams.confirm = true;
    // ACH mandate. Stripe requires explicit customer acceptance for ACH
    // debits — we use 'online' acceptance with the caller's IP + UA from
    // the request headers so the consent record is tied to the user's
    // actual session. x-forwarded-for can be a comma-separated chain;
    // the first entry is the original client IP per the standard.
    piCreateParams.mandate_data = {
      customer_acceptance: {
        type: "online",
        online: {
          ip_address:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0",
          user_agent: req.headers.get("user-agent") ?? "unknown",
        },
      },
    };
  } else {
    piCreateParams.automatic_payment_methods = { enabled: true };
  }

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(piCreateParams, { idempotencyKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-payment-intent] stripe.create failed:", msg);
    return jsonResponse({ error: "Stripe error", detail: msg }, 502);
  }

  // ─── 4. Persist to stripe_payment_intents (service-role bypasses RLS) ───
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: insErr } = await serviceClient
    .from("stripe_payment_intents")
    .insert({
      stripe_payment_intent_id: intent.id,
      member_id: user.id,
      amount_cents: chargeAmountCents, // what Stripe will actually charge
      currency,
      status: intent.status,
      purpose,
      goal_id: goalId,
      idempotency_key: idempotencyKey,
      description,
      metadata: intent.metadata,
    });

  if (insErr) {
    // PI exists on Stripe but DB row failed. Log and surface — the webhook
    // can't update a row that doesn't exist, so this is worth knowing about.
    console.error(
      "[create-payment-intent] DB insert failed for PI",
      intent.id,
      ":",
      insErr.message
    );
    return jsonResponse(
      {
        error: "Failed to persist payment intent",
        detail: insErr.message,
        stripe_payment_intent_id: intent.id,
      },
      500
    );
  }

  // ─── 5. Return clientSecret for mobile PaymentSheet ───
  return jsonResponse({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amount: chargeAmountCents,
    depositAmount: depositAmountCents,
    feeCents,
    currency,
    purpose,
  });
});
