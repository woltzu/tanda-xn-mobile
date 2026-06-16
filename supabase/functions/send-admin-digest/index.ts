// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-admin-digest
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): weekly Monday 08:00 UTC.
// Purpose: roll up the last 7 days of moderation activity into a single
//   `admin_digest` notification per active platform admin.
//
// Counters:
//   - new content_reports          (created_at >= now - 7d)
//   - new user_reports             (created_at >= now - 7d)
//   - reports resolved             (resolved_at >= now - 7d AND status != 'pending')
//   - content deletions            (moderation_actions.action='delete_content')
//   - manual suspensions / bans    (moderation_actions.action in ('suspend','ban'))
//   - auto suspensions / bans      (moderation_actions.action in ('auto_suspend','auto_ban'))
//
// Idempotency: skip if an admin already has an admin_digest notification
//   created in the last 6 days. Stops a manual re-run from double-posting.
//
// Deployment:
//   supabase functions deploy send-admin-digest --no-verify-jwt
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

    const since = new Date(Date.now() - 7 * DAY).toISOString();
    const sinceDupe = new Date(Date.now() - 6 * DAY).toISOString();

    // Counters — head=true gives us count without payload.
    const [
      { count: contentNew },
      { count: userNew },
      { count: contentResolved },
      { count: userResolved },
      { data: actions },
    ] = await Promise.all([
      supabase
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("user_reports")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .gte("resolved_at", since)
        .not("status", "eq", "pending"),
      supabase
        .from("user_reports")
        .select("id", { count: "exact", head: true })
        .gte("resolved_at", since)
        .not("status", "eq", "pending"),
      supabase
        .from("moderation_actions")
        .select("action")
        .gte("created_at", since)
        .limit(20000),
    ]);

    const actionTallies = {
      delete_content: 0,
      suspend: 0,
      ban: 0,
      auto_suspend: 0,
      auto_ban: 0,
      warn: 0,
    } as Record<string, number>;
    for (const a of actions ?? []) {
      const k = a.action as string;
      if (k in actionTallies) actionTallies[k]++;
    }

    const summary = {
      content_new: contentNew ?? 0,
      user_new: userNew ?? 0,
      content_resolved: contentResolved ?? 0,
      user_resolved: userResolved ?? 0,
      ...actionTallies,
    };

    // Active admin audience.
    const { data: admins } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("is_active", true);
    const adminIds = (admins ?? []).map(
      (a: { user_id: string }) => a.user_id,
    );

    let delivered = 0;
    for (const adminId of adminIds) {
      // Dupe check — don't double-post if the cron fires twice within 6d.
      const { count: prior } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", adminId)
        .eq("type", "admin_digest")
        .gte("created_at", sinceDupe);
      if ((prior ?? 0) > 0) continue;

      const body =
        `New reports: ${summary.content_new + summary.user_new}. ` +
        `Resolved: ${summary.content_resolved + summary.user_resolved}. ` +
        `Suspended: ${summary.suspend + summary.auto_suspend}. ` +
        `Banned: ${summary.ban + summary.auto_ban}.`;

      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: adminId,
        type: "admin_digest",
        title: "Weekly moderation digest",
        body,
        data: { window: "7d", ...summary },
        read: false,
      });
      if (!nErr) delivered++;
    }

    return ok(started, { delivered, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-admin-digest] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
