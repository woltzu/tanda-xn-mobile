// ═══════════════════════════════════════════════════════════════════════════
// create-connect-account — Edge Function (Deno runtime)
//
// Stage 1 of the Stripe Connect payout architecture.
//
// Creates a Stripe Express connected account for the authenticated member
// (or reuses an existing one), generates a Stripe-hosted onboarding link,
// and persists state to public.stripe_connected_accounts.
//
// Architecture decisions baked in:
//   - Express accounts (Stripe-hosted onboarding/KYC)
//   - capabilities: transfers only — we use Separate Charges and Transfers,
//     so the connected account never charges. Platform charges, then
//     transfers at payout.
//   - Country resolution: body.country → profiles.country → 'US'
//   - Re-onboarding supported for non-complete statuses: reuse existing
//     stripe_account_id and generate a fresh accountLink (per Stripe guidance)
//   - JWT-required (same default as create-payment-intent)
//
// Status writes use the live CHECK constraint values on
// stripe_connected_accounts.onboarding_status:
//   pending | in_progress | complete | restricted | disabled
// (NOT 'not_started' / 'verified' — those don't satisfy the constraint.)
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
// apiVersion omitted — using stripe@^17 SDK default

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const RETURN_URL = "tandaxn://linked-accounts?onboarding=complete";
const REFRESH_URL = "tandaxn://linked-accounts?onboarding=refresh";

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth — verify caller's JWT and extract user ───
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
  if (!user.email) {
    return jsonResponse({ error: "User has no email on file" }, 400);
  }

  // ─── 2. Body parsing (country override is optional) ───
  let body: { country?: unknown } = {};
  if (req.headers.get("Content-Length") !== "0") {
    try {
      body = await req.json();
    } catch {
      // empty body is fine — fall through to defaults
      body = {};
    }
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── 3. Resolve country (body → profiles → 'US') ───
  let country = (typeof body.country === "string" ? body.country : "").toUpperCase();
  if (!country) {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("country")
      .eq("id", user.id)
      .maybeSingle();
    country = (profile?.country ?? "US").toString().toUpperCase();
  }

  // ─── 4. Look up existing connected account ───
  const { data: existing, error: existingErr } = await serviceClient
    .from("stripe_connected_accounts")
    .select("id, stripe_account_id, onboarding_status, payouts_enabled, metadata")
    .eq("member_id", user.id)
    .maybeSingle();

  if (existingErr) {
    console.error("[create-connect-account] lookup failed:", existingErr.message);
    return jsonResponse({ error: "DB lookup failed", detail: existingErr.message }, 500);
  }

  // ─── 5a. Already complete — no new link needed ───
  if (existing && existing.onboarding_status === "complete" && existing.payouts_enabled) {
    return jsonResponse({
      onboardingUrl: null,
      stripeAccountId: existing.stripe_account_id,
      accountStatus: "complete",
      message: "Connected account already onboarded.",
    });
  }

  // ─── 5b. Exists but not complete — reuse stripe_account_id, fresh link ───
  let stripeAccountId: string;
  if (existing) {
    stripeAccountId = existing.stripe_account_id;
  } else {
    // ─── 5c. New account — create on Stripe ───
    try {
      const account = await stripe.accounts.create(
        {
          type: "express",
          email: user.email,
          country,
          capabilities: { transfers: { requested: true } }, // payouts only — separate charges and transfers
          business_type: "individual",
          metadata: { tanda_member_id: user.id },
        },
        { idempotencyKey: `connect-${user.id}` }
      );
      stripeAccountId = account.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[create-connect-account] stripe.accounts.create failed:", msg);
      return jsonResponse({ error: "Stripe error creating account", detail: msg }, 502);
    }

    // Insert DB row (UNIQUE on member_id prevents duplicates if this fires twice)
    const { error: insErr } = await serviceClient
      .from("stripe_connected_accounts")
      .insert({
        member_id: user.id,
        stripe_account_id: stripeAccountId,
        email: user.email,
        country,
        account_type: "express",
        onboarding_status: "pending",
        payouts_enabled: false,
        charges_enabled: false,
        details_submitted: false,
      });

    if (insErr) {
      // Stripe account exists but DB row failed — log loudly, return both
      // pieces so support can reconcile.
      console.error(
        "[create-connect-account] DB insert failed for account",
        stripeAccountId,
        ":",
        insErr.message
      );
      return jsonResponse(
        {
          error: "Failed to persist connected account",
          detail: insErr.message,
          stripeAccountId,
        },
        500
      );
    }
  }

  // ─── 6. Generate Account Link (Stripe-hosted onboarding) ───
  let onboardingUrl: string;
  try {
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      return_url: RETURN_URL,
      refresh_url: REFRESH_URL,
      type: "account_onboarding",
    });
    onboardingUrl = link.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-connect-account] stripe.accountLinks.create failed:", msg);
    return jsonResponse({ error: "Stripe error generating onboarding link", detail: msg }, 502);
  }

  // ─── 7. Update status to in_progress + stash latest URL in metadata ───
  // We don't have a top-level onboarding_url column; metadata.last_onboarding_url
  // is fine since Stripe account links expire in ~5min anyway.
  await serviceClient
    .from("stripe_connected_accounts")
    .update({
      onboarding_status: "in_progress",
      metadata: { last_onboarding_url: onboardingUrl, last_onboarding_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    })
    .eq("member_id", user.id);

  // ─── 8. Return URL to client ───
  return jsonResponse({
    onboardingUrl,
    stripeAccountId,
    accountStatus: "in_progress",
  });
});
