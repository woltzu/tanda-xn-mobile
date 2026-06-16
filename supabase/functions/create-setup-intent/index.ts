// ═══════════════════════════════════════════════════════════════════════════
// create-setup-intent — Edge Function (Deno runtime)
//
// P0 (payment-methods review): backs the "+ Add card" CTA in
// LinkedAccountsScreen → PaymentContext.setupCardForLater(). Until this
// shipped, the button showed an Alert.alert dead-end.
//
// Behaviour:
//   1. Verify caller's JWT.
//   2. Look up (or create-on-demand) the caller's row in stripe_customers.
//      We REUSE the existing Stripe customer ID rather than creating a new
//      one — payment methods attach to a customer so subsequent
//      PaymentIntents can charge them silently.
//   3. Call stripe.setupIntents.create with that customer, usage='off_session',
//      automatic_payment_methods enabled so the PaymentSheet shows card +
//      whichever wallets are configured (Apple Pay / Google Pay / Link).
//   4. Return { clientSecret, customerId } to the mobile client. The
//      Stripe RN SDK passes the clientSecret as setupIntentClientSecret on
//      initPaymentSheet — after the user finishes, Stripe emits
//      `setup_intent.succeeded` and (separately) `payment_method.attached`,
//      which the existing stripe-webhook function persists into
//      stripe_payment_methods. LinkedAccountsScreen refreshes on focus and
//      the new card appears in the list.
//
// Auth model: identical to create-payment-intent — JWT-scoped client to
// verify identity; service-role client to read/insert stripe_customers.
//
// Secrets required (already set per CLAUDE.md, Stripe Integration section):
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Deploy:
//   supabase functions deploy create-setup-intent
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

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

  // ─── 1. Auth — verify caller's JWT ───
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

  // ─── 2. Resolve (or lazily create) the caller's Stripe customer ───
  // Cards must attach to a customer — that's how subsequent charges find
  // them. The mobile app's bootstrap calls createOrGetCustomer on first
  // PaymentContext mount; we re-do the lookup here defensively in case the
  // bootstrap was skipped (web cold-start, etc.).
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  let stripeCustomerId: string | null = null;
  const { data: existing, error: lookupErr } = await serviceClient
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("member_id", user.id)
    .maybeSingle();

  if (lookupErr) {
    console.error(
      "[create-setup-intent] stripe_customers lookup failed:",
      lookupErr.message,
    );
    return jsonResponse(
      { error: "Failed to look up Stripe customer", detail: lookupErr.message },
      500,
    );
  }

  if (existing?.stripe_customer_id) {
    stripeCustomerId = existing.stripe_customer_id;
  } else {
    // Create on demand. We hand Stripe the user's auth email + id metadata
    // so the customer is recognisable in the dashboard.
    try {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;
      const { error: insErr } = await serviceClient
        .from("stripe_customers")
        .insert({
          member_id: user.id,
          stripe_customer_id: customer.id,
          email: user.email ?? null,
        });
      if (insErr) {
        // Customer exists on Stripe but DB write failed — log and continue.
        // The next bootstrap will repair via createOrGetCustomer.
        console.warn(
          "[create-setup-intent] stripe_customers insert failed (continuing):",
          insErr.message,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[create-setup-intent] customer create failed:", msg);
      return jsonResponse(
        { error: "Failed to create Stripe customer", detail: msg },
        502,
      );
    }
  }

  // ─── 3. Create the SetupIntent ───
  // usage='off_session' so the saved card can be charged later without
  // user interaction (Stripe's terminology — off-session = not in front
  // of the device).
  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.create(
      {
        customer: stripeCustomerId!,
        usage: "off_session",
        automatic_payment_methods: { enabled: true },
        metadata: { user_id: user.id, source: "linked_accounts_screen" },
      },
      { idempotencyKey: crypto.randomUUID() },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-setup-intent] setupIntents.create failed:", msg);
    return jsonResponse({ error: "Stripe error", detail: msg }, 502);
  }

  // ─── 4. Return clientSecret for mobile PaymentSheet ───
  return jsonResponse({
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    customerId: stripeCustomerId,
  });
});
