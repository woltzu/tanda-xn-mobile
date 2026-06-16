// ═══════════════════════════════════════════════════════════════════════════
// sync-stripe-methods — Edge Function (Deno runtime)
//
// P2 (payment-methods review): background-sync any cards the user has
// attached to their Stripe Customer that haven't reached our DB yet.
// Covers the gap when:
//   - A card was added on web via the Stripe Customer Portal.
//   - The payment_method.attached webhook was missed / delayed.
//
// Triggered from PaymentContext.refreshPaymentMethods({ syncRemote: true })
// — currently only the pull-to-refresh path in LinkedAccountsScreen.
//
// Behaviour:
//   1. Verify caller's JWT, resolve their Stripe Customer.
//   2. Stripe API → list payment_methods for that customer (type='card').
//   3. For each PM, upsert into stripe_payment_methods. The uq_stripe_pm_stripe_id
//      unique index guarantees idempotency: re-running this never duplicates.
//   4. Return a small summary { synced, customerId } for telemetry.
//
// This function does NOT:
//   - Remove rows from our DB that no longer exist on Stripe. Stripe's
//     payment_method.detached webhook handles deletes — and a missing
//     webhook should be a self-healing problem (the user will see the
//     ghost row once and remove it).
//   - Sync bank accounts (us_bank_account). Banks attach via Stripe
//     Financial Connections, which has its own webhook + DB row in
//     stripe_bank_accounts.
//
// Deploy:
//   supabase functions deploy sync-stripe-methods
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth ─────────────────────────────────────────────────────────────
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
    return jsonResponse({ error: "Unauthenticated", detail: userErr?.message }, 401);
  }

  // ─── 2. Resolve Stripe customer ──────────────────────────────────────────
  // No lazy-create here — if the user has no Stripe customer yet, they
  // also can't have any payment methods to sync. Return synced=0.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: custRow, error: custErr } = await serviceClient
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("member_id", user.id)
    .maybeSingle();

  if (custErr) {
    console.error("[sync-stripe-methods] customer lookup failed:", custErr.message);
    return jsonResponse(
      { error: "Failed to look up Stripe customer", detail: custErr.message },
      500,
    );
  }
  if (!custRow?.stripe_customer_id) {
    // Nothing to sync — caller will fall through to the local read.
    return jsonResponse({ synced: 0, customerId: null });
  }

  // ─── 3. List PMs from Stripe ─────────────────────────────────────────────
  let stripeMethods: Stripe.PaymentMethod[] = [];
  try {
    // Default Stripe page size is 10; bump to 100 (the API max) so we
    // don't need a paging loop for the common case.
    const list = await stripe.paymentMethods.list({
      customer: custRow.stripe_customer_id,
      type: "card",
      limit: 100,
    });
    stripeMethods = list.data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sync-stripe-methods] stripe.list failed:", msg);
    return jsonResponse({ error: "Stripe error", detail: msg }, 502);
  }

  if (stripeMethods.length === 0) {
    return jsonResponse({ synced: 0, customerId: custRow.stripe_customer_id });
  }

  // ─── 4. Upsert into stripe_payment_methods ───────────────────────────────
  // We rely on the existing uq_stripe_pm_stripe_id unique index — onConflict
  // ignores duplicates so the same PM can be sync'd repeatedly without
  // churning is_default flags. New PMs land as is_default=false; the user
  // sets a default explicitly from LinkedAccountsScreen.
  const rows = stripeMethods.map((pm) => {
    const card = pm.card;
    return {
      member_id: user.id,
      stripe_payment_method_id: pm.id,
      type: "card",
      is_default: false,
      status: "active",
      fingerprint: card?.fingerprint ?? null,
      card_last4: card?.last4 ?? null,
      card_brand: card?.brand ?? null,
      card_exp_month: card?.exp_month ?? null,
      card_exp_year: card?.exp_year ?? null,
    };
  });

  const { error: upsertErr } = await serviceClient
    .from("stripe_payment_methods")
    .upsert(rows, {
      onConflict: "stripe_payment_method_id",
      ignoreDuplicates: false,
    });

  if (upsertErr) {
    console.error("[sync-stripe-methods] upsert failed:", upsertErr.message);
    return jsonResponse(
      { error: "Failed to persist payment methods", detail: upsertErr.message },
      500,
    );
  }

  return jsonResponse({
    synced: rows.length,
    customerId: custRow.stripe_customer_id,
  });
});
