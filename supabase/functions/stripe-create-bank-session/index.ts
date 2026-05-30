// ═══════════════════════════════════════════════════════════════════════════
// stripe-create-bank-session — Edge Function (Deno runtime)
//
// Phase A backend for ACH/bank deposits to Goals via Stripe Financial
// Connections (migration 075). Creates an FC session the mobile client can
// open with the Stripe React Native SDK; on completion the client passes
// the session id to stripe-attach-bank-payment-method which converts the
// linked FC account into a Stripe PaymentMethod.
//
// Atomic create-or-get of the Stripe customer:
//   FC sessions require account_holder.customer to be a real Stripe
//   customer id. We look up stripe_customers by member_id; if absent we
//   create the customer via the Stripe API (with the user's auth.users
//   email) and persist the row before issuing the session. Two parallel
//   calls from the same user could each see "no row" and try to insert;
//   the stripe_customers.member_id has a UNIQUE-equivalent (the table's
//   own constraints) and a duplicate-key error is handled by re-reading.
//
// Auth model:
//   - JWT-scoped client → user identity verification.
//   - Service-role client → bypass RLS for stripe_customers writes and
//     for auth.admin.getUserById (which needs service-role to fetch email).
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
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
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "Unauthenticated", detail: userErr?.message }, 401);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── 2. Create-or-get the Stripe customer ───
  // stripe_customers.member_id is the FK to auth.users.id.
  let customerId: string | null = null;
  {
    const { data: existing, error: lookupErr } = await serviceClient
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (lookupErr) {
      console.error("[stripe-create-bank-session] customer lookup failed:", lookupErr.message);
      return jsonResponse({ error: "Failed to look up Stripe customer", detail: lookupErr.message }, 500);
    }
    if (existing?.stripe_customer_id) {
      customerId = existing.stripe_customer_id;
    }
  }

  if (!customerId) {
    // Need the user's email to create the Stripe customer. auth.admin.*
    // requires service role; serviceClient is already that.
    const { data: adminUser, error: adminErr } = await serviceClient.auth.admin.getUserById(user.id);
    if (adminErr || !adminUser?.user?.email) {
      console.error("[stripe-create-bank-session] auth.admin.getUserById failed:", adminErr?.message);
      return jsonResponse(
        { error: "Could not resolve user email", detail: adminErr?.message },
        500
      );
    }

    try {
      const customer = await stripe.customers.create({
        email: adminUser.user.email,
        metadata: { member_id: user.id },
      });
      customerId = customer.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[stripe-create-bank-session] stripe.customers.create failed:", msg);
      return jsonResponse({ error: "Stripe customer creation failed", detail: msg }, 502);
    }

    // Persist the new customer. If a concurrent request from the same user
    // beat us to the insert, the unique constraint surfaces and we re-read.
    const { error: insErr } = await serviceClient.from("stripe_customers").insert({
      member_id: user.id,
      stripe_customer_id: customerId,
      email: adminUser.user.email,
    });
    if (insErr) {
      // 23505 = unique violation. Race: another concurrent request created
      // the customer first. Re-read to recover their customer id, then
      // (best-effort) detach the orphan we just created on Stripe to avoid
      // leaving two customers per user.
      if (insErr.code === "23505" || /duplicate key|already exists/i.test(insErr.message)) {
        const { data: refetch } = await serviceClient
          .from("stripe_customers")
          .select("stripe_customer_id")
          .eq("member_id", user.id)
          .maybeSingle();
        if (refetch?.stripe_customer_id && refetch.stripe_customer_id !== customerId) {
          // Best-effort cleanup of the orphan customer we just created.
          try { await stripe.customers.del(customerId); } catch { /* ignore */ }
          customerId = refetch.stripe_customer_id;
        }
      } else {
        console.error("[stripe-create-bank-session] customer insert failed:", insErr.message);
        return jsonResponse({ error: "Failed to persist customer", detail: insErr.message }, 500);
      }
    }
  }

  // ─── 3. Create the Financial Connections session ───
  // permissions: ['payment_method'] is what unlocks the PaymentMethod
  // creation path in stripe-attach-bank-payment-method. return_url is
  // included for parity with web flows; the React Native SDK opens an
  // in-app sheet and doesn't actually need it, but Stripe accepts it.
  let session: Stripe.FinancialConnections.Session;
  try {
    session = await stripe.financialConnections.sessions.create({
      account_holder: { type: "customer", customer: customerId },
      permissions: ["payment_method"],
      return_url: "tandaxn://financial-connections/return",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-create-bank-session] FC session create failed:", msg);
    return jsonResponse({ error: "Failed to create FC session", detail: msg }, 502);
  }

  return jsonResponse({
    clientSecret: session.client_secret,
    sessionId: session.id,
    customerId,
  });
});
