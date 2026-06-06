// =============================================================================
// apply-referral -- Edge Function (Deno runtime)
//
// Called by an authenticated client (typically post-signup, before the
// first contribution). verify_jwt=true; the caller's identity comes from
// the JWT and is the ONLY referred_user_id that gets recorded -- a
// client-supplied userId in the body is intentionally ignored to prevent
// referral-credit forgery.
//
// Body: { referralCode: string }
//
// Resolution:
//   1. Find the referral_codes row for the supplied code.
//   2. Reject if not found (404).
//   3. Reject if the code's owner is the caller (self-referral).
//   4. INSERT a referrals row { referrer_id = code owner, referred_user_id
//      = caller, status='pending' }. Conflict (caller already referred)
//      surfaces as a 409 -- referrals.referred_user_id is UNIQUE.
//
// Reward at this stage: none. The DB trigger on cycle_contributions
// (migration 120) flips status to 'completed' and writes referral_rewards
// rows on the referred user's first paid contribution. This EF is only
// the linkage step.
//
// Deploy: supabase functions deploy apply-referral
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const { referralCode } = await req.json();
    if (!referralCode || typeof referralCode !== "string") {
      return new Response(JSON.stringify({ error: "Missing referralCode" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller identity.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const referredUserId = userData.user.id;

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Codes are stored uppercase-only; tolerate caller-supplied case.
    const codeNorm = referralCode.trim().toUpperCase();

    const { data: codeRow, error: codeErr } = await admin
      .from("referral_codes")
      .select("user_id")
      .eq("code", codeNorm)
      .maybeSingle();

    if (codeErr) {
      return new Response(JSON.stringify({ error: codeErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!codeRow) {
      return new Response(JSON.stringify({ error: "Code not found", code: "INVALID_CODE" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const referrerId = codeRow.user_id;
    if (referrerId === referredUserId) {
      return new Response(
        JSON.stringify({ error: "Cannot refer yourself", code: "SELF_REFERRAL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: inserted, error: insErr } = await admin
      .from("referrals")
      .insert({
        referrer_id: referrerId,
        referred_user_id: referredUserId,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();

    if (insErr) {
      const code = (insErr as { code?: string }).code;
      if (code === "23505") {
        // uq_referrals_referred_once -- this user is already referred
        // by someone (could be the same referrer or a different one).
        // Surface as a 409 with a helpful code; the client can decide
        // whether to show "already redeemed" or silently ignore.
        return new Response(
          JSON.stringify({ error: "Already referred", code: "ALREADY_REFERRED" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        referral_id: inserted.id,
        status: inserted.status,
        created_at: inserted.created_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
