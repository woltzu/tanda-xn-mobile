// ═══════════════════════════════════════════════════════════════════════════
// create-payment-intent — Edge Function (Deno runtime)
//
// Path A smoke test: creates a Stripe PaymentIntent for the authenticated
// user, records it in stripe_payment_intents, and returns the client_secret
// so the mobile client can present a PaymentSheet.
//
// Auth model:
//   - JWT-scoped client (from caller's Authorization header) → used ONLY to
//     verify the user.
//   - Service-role client → used to INSERT into stripe_payment_intents
//     (RLS-bypass; the table has a service_role ALL policy).
//
// Schema notes (verified against live DB 2026-05-21):
//   - amount_cents (NOT amount), integer, CHECK (> 0)
//   - purpose NOT NULL, CHECK ∈ ('contribution', 'insurance_premium',
//     'late_fee', 'loan_repayment', 'wallet_deposit', 'membership_fee')
//     → using 'wallet_deposit' for the smoke test
//   - client_secret is NOT stored in DB (returned to client only)
//   - idempotency_key UNIQUE — we send a fresh UUID per request
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
  let body: { amount?: unknown; currency?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const amount = body.amount;
  const currency =
    typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";

  if (!Number.isInteger(amount) || (amount as number) < 50) {
    return jsonResponse(
      { error: "amount must be an integer number of cents ≥ 50" },
      400
    );
  }

  // ─── 3. Create PaymentIntent on Stripe ───
  // Use a fresh UUID for idempotency so accidental double-clicks don't double-charge.
  const idempotencyKey = crypto.randomUUID();

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: amount as number,
        currency,
        metadata: {
          user_id: user.id,
          test_charge: "true",
          source: "path_a_smoke_test",
        },
        automatic_payment_methods: { enabled: true },
        description: "Path A smoke test — wallet deposit",
      },
      { idempotencyKey }
    );
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
      amount_cents: amount,
      currency,
      status: intent.status,
      purpose: "wallet_deposit",
      idempotency_key: idempotencyKey,
      description: "Path A smoke test — wallet deposit",
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
    amount: amount,
    currency,
  });
});
