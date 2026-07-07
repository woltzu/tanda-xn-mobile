// ═══════════════════════════════════════════════════════════════════════════
// detach-payment-method — Edge Function (Deno runtime)
//
// Hard-delete a saved card. The prior engine-side "soft remove" set
// status='removed' on the row, but sync-stripe-methods upserts with
// status='active' on every call — so a soft-removed card came right
// back on the next focus refresh.
//
// This EF:
//   1. Verifies the caller's JWT and confirms they own the row.
//   2. Calls stripe.paymentMethods.detach on the corresponding Stripe
//      payment_method id — after this the card is unlinked from the
//      Stripe customer and sync-stripe-methods will not re-surface it.
//   3. Hard-deletes the DB row.
//
// Idempotency: if Stripe already reports the pm as detached
// (resource_missing / "No such payment_method"), we still proceed to
// the DB delete so a stale row can't be resurrected.
//
// Deploy:
//   supabase functions deploy detach-payment-method
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

  let body: { paymentMethodId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const paymentMethodId = body.paymentMethodId;
  if (!paymentMethodId || typeof paymentMethodId !== "string") {
    return jsonResponse({ error: "Missing paymentMethodId" }, 400);
  }

  const service = createClient(supabaseUrl, serviceRoleKey);
  // Confirm ownership + get the Stripe pm id.
  const { data: row, error: fetchErr } = await service
    .from("stripe_payment_methods")
    .select("id, stripe_payment_method_id, member_id")
    .eq("id", paymentMethodId)
    .eq("member_id", user.id)
    .maybeSingle();

  if (fetchErr) {
    console.error("[detach-payment-method] lookup failed:", fetchErr.message);
    return jsonResponse(
      { error: "Lookup failed", detail: fetchErr.message },
      500,
    );
  }
  if (!row) {
    return jsonResponse({ error: "Payment method not found" }, 404);
  }

  // Detach from Stripe. If Stripe already detached, resource_missing is
  // fine — we still proceed to DB cleanup so a stale row can't be
  // resurrected by the next sync.
  try {
    await stripe.paymentMethods.detach(row.stripe_payment_method_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isMissing = /resource_missing|No such payment_method|already been detached/i.test(msg);
    if (!isMissing) {
      console.error("[detach-payment-method] stripe.detach failed:", msg);
      return jsonResponse({ error: "Stripe error", detail: msg }, 502);
    }
    console.warn("[detach-payment-method] Stripe already detached, continuing:", msg);
  }

  // Hard-delete DB row.
  const { error: delErr } = await service
    .from("stripe_payment_methods")
    .delete()
    .eq("id", paymentMethodId)
    .eq("member_id", user.id);
  if (delErr) {
    console.error("[detach-payment-method] DB delete failed:", delErr.message);
    return jsonResponse(
      { error: "DB delete failed", detail: delErr.message },
      500,
    );
  }

  return jsonResponse({ success: true });
});
