// ═══════════════════════════════════════════════════════════════════════════
// stripe-create-account-link — Edge Function (Deno runtime)
//
// Stripe Connect (Express) onboarding for trip organizers. Creates the
// Connect account on first call, then issues a one-shot account-link URL
// the mobile client opens in a browser sheet. When onboarding completes
// Stripe redirects back to `return_url` (a tandaxn deep-link the client
// is listening on); WebBrowser.openAuthSessionAsync sees that URL and
// resolves the promise so the client can refresh the connected state.
//
// Auth model:
//   - JWT-verified (do NOT deploy with --no-verify-jwt).
//   - user_id is derived from the JWT, NEVER from the request body — the
//     spec sample took user_id from JSON which is a forgery vector
//     (any authenticated user could create a Stripe account on another
//     user's behalf). Same pattern as stripe-create-bank-session.
//
// Migration 270 added profiles.stripe_connect_account_id. The function
// reads it to check for a prior account, writes it on first create,
// and never overwrites a non-null value (idempotent re-entry).
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

  // ─── 2. Parse body — only return_url is honored from the request ───
  let return_url: string | undefined;
  let country: string | undefined;
  try {
    const body = await req.json();
    return_url = typeof body.return_url === "string" ? body.return_url : undefined;
    country = typeof body.country === "string" ? body.country : undefined;
  } catch (_e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!return_url) {
    return jsonResponse({ error: "return_url is required" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── 3. Find or create the Stripe Connect account ───
  const { data: profile, error: profileErr } = await serviceClient
    .from("profiles")
    .select("stripe_connect_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) {
    return jsonResponse({ error: "Profile read failed", detail: profileErr.message }, 500);
  }

  let accountId = profile?.stripe_connect_account_id as string | null;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        country: country || "US",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { tandaxn_user_id: user.id },
      });
      accountId = account.id;

      const { error: upErr } = await serviceClient
        .from("profiles")
        .update({ stripe_connect_account_id: accountId })
        .eq("id", user.id);
      if (upErr) {
        return jsonResponse(
          { error: "Saved account but failed to persist id", detail: upErr.message },
          500,
        );
      }
    } catch (e) {
      return jsonResponse(
        { error: "Stripe account create failed", detail: (e as Error).message },
        502,
      );
    }
  }

  // ─── 4. Issue the one-shot account-link URL ───
  try {
    const accountLink = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${return_url}?refresh=true`,
      return_url: `${return_url}?return=true`,
      type: "account_onboarding",
    });
    return jsonResponse({ url: accountLink.url, account_id: accountId });
  } catch (e) {
    return jsonResponse(
      { error: "Stripe account link failed", detail: (e as Error).message },
      502,
    );
  }
});
