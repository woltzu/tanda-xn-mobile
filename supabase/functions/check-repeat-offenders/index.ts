// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: check-repeat-offenders
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 07:00 UTC.
// Purpose: scan moderation_actions for repeat offenders and apply
//   escalating auto-actions.
//
//   - 3 'warn' actions in the last 30 days for a user
//       → INSERT moderation_actions(action='auto_suspend',
//                                   duration='7 days', reason='Auto: 3 warnings in 30 days')
//       → UPDATE profiles.suspended_until = now() + 7 days
//       → notify the user
//   - 2 'suspend' or 'auto_suspend' actions in the last 90 days
//       → INSERT moderation_actions(action='auto_ban', reason='Auto: 2 suspensions in 90 days')
//       → UPDATE profiles.banned = TRUE
//       → notify the user
//
// Idempotency: before escalating, look for any auto_suspend / auto_ban
//   action already written today against the same target — skip if any.
//   This stops the cron from stacking suspensions if it runs twice or
//   if the manual admin path already auto-suspended.
//
// Deployment:
//   supabase functions deploy check-repeat-offenders --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY = 86400 * 1000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = new Date().toISOString();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const since30d = new Date(Date.now() - 30 * DAY).toISOString();
    const since90d = new Date(Date.now() - 90 * DAY).toISOString();
    const sinceToday = new Date(new Date().toISOString().slice(0, 10)).toISOString();

    // ── Pass 1: 3 warnings in 30 days → auto_suspend ─────────────────
    const { data: warnRows, error: wErr } = await supabase
      .from("moderation_actions")
      .select("target_id, created_at")
      .eq("target_type", "user")
      .eq("action", "warn")
      .gte("created_at", since30d)
      .limit(20000);
    if (wErr) throw wErr;

    const warnCount = new Map<string, number>();
    for (const r of warnRows ?? []) {
      const t = r.target_id as string;
      warnCount.set(t, (warnCount.get(t) ?? 0) + 1);
    }

    let suspended = 0;
    for (const [userId, n] of warnCount) {
      if (n < 3) continue;
      if (await alreadyAutoActed(supabase, userId, "auto_suspend", sinceToday))
        continue;

      const suspendedUntil = new Date(Date.now() + 7 * DAY).toISOString();
      const { error: aErr } = await supabase.from("moderation_actions").insert({
        admin_user_id: null,
        target_type: "user",
        target_id: userId,
        action: "auto_suspend",
        reason: "Auto: 3 warnings within 30 days",
        duration: "7 days",
      });
      if (aErr) {
        console.warn("[repeat-offenders] auto_suspend insert failed:", aErr.message);
        continue;
      }
      await supabase
        .from("profiles")
        .update({ suspended_until: suspendedUntil })
        .eq("id", userId);
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "moderation_auto_suspend",
        title: "Your account has been suspended",
        body: "You received three warnings in 30 days. Suspension ends in 7 days.",
        data: { reason: "auto_3_warnings_30d", duration_days: 7 },
        read: false,
      });
      suspended++;
    }

    // ── Pass 2: 2 suspensions in 90 days → auto_ban ──────────────────
    const { data: suspRows, error: sErr } = await supabase
      .from("moderation_actions")
      .select("target_id, action, created_at")
      .eq("target_type", "user")
      .in("action", ["suspend", "auto_suspend"])
      .gte("created_at", since90d)
      .limit(20000);
    if (sErr) throw sErr;

    const suspCount = new Map<string, number>();
    for (const r of suspRows ?? []) {
      const t = r.target_id as string;
      suspCount.set(t, (suspCount.get(t) ?? 0) + 1);
    }

    let banned = 0;
    for (const [userId, n] of suspCount) {
      if (n < 2) continue;
      if (await alreadyAutoActed(supabase, userId, "auto_ban", sinceToday))
        continue;

      const { error: aErr } = await supabase.from("moderation_actions").insert({
        admin_user_id: null,
        target_type: "user",
        target_id: userId,
        action: "auto_ban",
        reason: "Auto: 2 suspensions within 90 days",
      });
      if (aErr) {
        console.warn("[repeat-offenders] auto_ban insert failed:", aErr.message);
        continue;
      }
      await supabase
        .from("profiles")
        .update({ banned: true, suspended_until: null })
        .eq("id", userId);
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "moderation_auto_ban",
        title: "Your account has been banned",
        body: "You reached two suspensions within 90 days. Contact support if you believe this is an error.",
        data: { reason: "auto_2_suspensions_90d" },
        read: false,
      });
      banned++;
    }

    return ok(started, { suspended, banned });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-repeat-offenders] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function alreadyAutoActed(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: "auto_suspend" | "auto_ban",
  since: string,
): Promise<boolean> {
  const { count } = await supabase
    .from("moderation_actions")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "user")
    .eq("target_id", userId)
    .eq("action", action)
    .gte("created_at", since);
  return (count ?? 0) > 0;
}

function ok(started: string, extras: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ok: true,
      started,
      finished: new Date().toISOString(),
      ...extras,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
