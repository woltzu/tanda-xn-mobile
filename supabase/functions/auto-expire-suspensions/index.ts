// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: auto-expire-suspensions
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 03:30 UTC (suggested — actual scheduling via pg_cron
// or Supabase Scheduler is configured separately when this is deployed).
// Purpose:  Two independent sweeps of expired mod-state on profiles:
//           1. suspended_until — clear rows whose suspension has run out
//              (original mig-152 behavior).
//           2. chat_muted_until — clear rows whose chat mute has run out
//              (added mig 391). is_chat_muted() already returns FALSE
//              once the timestamp passes NOW(), so functional correctness
//              doesn't depend on this sweep — it's a housekeeping step
//              that keeps the columns tidy so admin surfaces show a
//              clean "not muted" state instead of "muted, but expired".
//           Sweeps are independent — one failing doesn't skip the other.
//
// Deployment:
//   supabase functions deploy auto-expire-suspensions --no-verify-jwt
//
// Authentication note: this is cron-triggered (no end-user JWT), so we
// use the SUPABASE_SERVICE_ROLE_KEY to bypass RLS on profiles. Do NOT
// expose this function via a public route.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const nowIso = new Date().toISOString();

    // ─── Sweep 1: suspended_until ──────────────────────────────────────
    const { data: expiredSuspensions, error: sSelectErr } = await supabase
      .from("profiles")
      .select("id, suspended_until")
      .lte("suspended_until", nowIso)
      .not("suspended_until", "is", null);
    if (sSelectErr) throw sSelectErr;
    const suspensionIds = (expiredSuspensions ?? []).map(
      (p: { id: string }) => p.id,
    );

    let clearedSuspensions = 0;
    if (suspensionIds.length > 0) {
      const { error: sUpdErr } = await supabase
        .from("profiles")
        .update({ suspended_until: null })
        .in("id", suspensionIds);
      if (sUpdErr) throw sUpdErr;
      clearedSuspensions = suspensionIds.length;
    }

    // ─── Sweep 2: chat_muted_until (mig 391) ──────────────────────────
    // is_chat_muted() already returns FALSE past the deadline so this
    // sweep only affects display state, not enforcement. We also clear
    // the _by / _reason columns so the admin surface shows a clean
    // "not muted" state.
    const { data: expiredMutes, error: mSelectErr } = await supabase
      .from("profiles")
      .select("id, chat_muted_until")
      .lte("chat_muted_until", nowIso)
      .not("chat_muted_until", "is", null);
    if (mSelectErr) throw mSelectErr;
    const muteIds = (expiredMutes ?? []).map((p: { id: string }) => p.id);

    let clearedMutes = 0;
    if (muteIds.length > 0) {
      const { error: mUpdErr } = await supabase
        .from("profiles")
        .update({
          chat_muted_until: null,
          chat_muted_by: null,
          chat_muted_reason: null,
        })
        .in("id", muteIds);
      if (mUpdErr) throw mUpdErr;
      clearedMutes = muteIds.length;
    }

    // No audit rows — expiration is a passive event (no admin took an
    // action). The original suspend/mute is already in moderation_actions.

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        clearedSuspensions,
        clearedChatMutes: clearedMutes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auto-expire-suspensions] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
