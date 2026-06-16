// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-audit-summary
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): weekly Monday 08:10 UTC (after send-admin-digest).
// Purpose: roll up the last 7 days of audit-trail activity into one
//   `admin_audit_digest` notification per active platform admin.
//
//   Counters come from the get_audit_weekly_summary(p_days) RPC
//   (migration 164) — one round-trip, all aggregation pushed to SQL.
//
//   Shape of the digest payload (notifications.data):
//     {
//       window: '7d',
//       totals:            { events, anomalies },
//       anomalies_by_type: { failed_login_burst: N, profile_churn: N, ... },
//       top_users:         [{ user_id, n }],
//       top_tables:        [{ table_name, n }],
//       action_split:      { INSERT: N, UPDATE: N, DELETE: N }
//     }
//
//   The screen renders the digest directly from this data blob — no
//   ad-hoc parsing of the body text needed.
//
// Idempotency: skip if an admin already has an admin_audit_digest
//   notification created in the last 6 days. Same pattern as
//   send-admin-digest.
//
// Deployment:
//   supabase functions deploy send-audit-summary --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DAY = 86400 * 1000;

type Summary = {
  window_days: number;
  since: string;
  totals: { events: number; anomalies: number };
  anomalies_by_type: Record<string, number>;
  top_users: Array<{ user_id: string; n: number }>;
  top_tables: Array<{ table_name: string; n: number }>;
  action_split: Record<string, number>;
};

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

    const sinceDupe = new Date(Date.now() - 6 * DAY).toISOString();

    // One round-trip → totals/anomalies/top-N/action-split JSONB.
    const { data: summaryRaw, error: sErr } = await supabase.rpc(
      "get_audit_weekly_summary",
      { p_days: 7 },
    );
    if (sErr) throw sErr;
    const summary = summaryRaw as Summary;

    // Active admin audience.
    const { data: admins } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("is_active", true);
    const adminIds = (admins ?? []).map(
      (a: { user_id: string }) => a.user_id,
    );

    const events = summary?.totals?.events ?? 0;
    const anomalies = summary?.totals?.anomalies ?? 0;
    const topTable = summary?.top_tables?.[0]?.table_name ?? null;

    const body =
      `Events: ${events}. Anomalies: ${anomalies}.` +
      (topTable ? ` Most-changed table: ${topTable}.` : "");

    let delivered = 0;
    for (const adminId of adminIds) {
      const { count: prior } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", adminId)
        .eq("type", "admin_audit_digest")
        .gte("created_at", sinceDupe);
      if ((prior ?? 0) > 0) continue;

      const { error: nErr } = await supabase.from("notifications").insert({
        user_id: adminId,
        type: "admin_audit_digest",
        title: "Weekly audit summary",
        body,
        data: { window: "7d", ...summary },
        read: false,
      });
      if (!nErr) delivered++;
    }

    return ok(started, { delivered, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-audit-summary] fatal:", msg);
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
