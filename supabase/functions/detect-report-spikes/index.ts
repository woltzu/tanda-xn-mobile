// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: detect-report-spikes
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 07:10 UTC (after check-repeat-offenders).
// Purpose: when a single content author has accrued ≥5 content_reports
//   in the last 24h, raise the priority of those reports to 'high', add
//   a 'spike_detected' tag, and notify every active platform admin.
//
//   The reporters surface aggregate harm; this is the cross-author
//   companion to the per-content keyword auto-flag from migration 162.
//
// Idempotency: the same content_report can be hit by both the keyword
//   trigger (priority='high' + Auto-flagged tag) and this spike pass.
//   That's fine — UPDATE … WHERE priority <> 'high' OR NOT (...) skips
//   no-op writes, and the spike tag is uniqued via array_append.
//
//   Admin notification is throttled with a contains-lookup on
//   notifications.data.spike_for_user over the last 48h.
//
// Deployment:
//   supabase functions deploy detect-report-spikes --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SPIKE_THRESHOLD = 5;
const SPIKE_WINDOW_HOURS = 24;
const DUPE_LOOKBACK_HOURS = 48;

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

    const since = new Date(
      Date.now() - SPIKE_WINDOW_HOURS * 3600 * 1000,
    ).toISOString();
    const sinceDupe = new Date(
      Date.now() - DUPE_LOOKBACK_HOURS * 3600 * 1000,
    ).toISOString();

    // Pull recent content_reports. We need to know "who authored the
    // reported content" — the reports table only has content_id, so we
    // resolve authors per content_type below.
    const { data: reports, error: rErr } = await supabase
      .from("content_reports")
      .select("id, content_type, content_id")
      .gte("created_at", since)
      .limit(10000);
    if (rErr) throw rErr;
    if (!reports || reports.length === 0) {
      return ok(started, { spikes_found: 0 });
    }

    // Group by content_type so we can dispatch the author lookup once
    // per source table instead of per row.
    const byType: Record<string, { id: string; content_id: string }[]> = {};
    for (const r of reports) {
      const list = byType[r.content_type] ?? [];
      list.push({ id: r.id, content_id: r.content_id });
      byType[r.content_type] = list;
    }
    const tableMap: Record<string, string> = {
      dream_post: "feed_posts",
      comment: "feed_comments",
      event: "community_events",
      circle_message: "circle_messages",
    };

    // content_id → author user_id.
    const authorByContent = new Map<string, string>();
    for (const [t, rows] of Object.entries(byType)) {
      const table = tableMap[t];
      if (!table) continue;
      const ids = [...new Set(rows.map((r) => r.content_id))];
      const { data: srcRows } = await supabase
        .from(table)
        .select("id, user_id")
        .in("id", ids);
      for (const s of srcRows ?? []) {
        authorByContent.set(s.id, s.user_id);
      }
    }

    // author user_id → list of report rows targeting them.
    const reportsByAuthor = new Map<string, { id: string }[]>();
    for (const r of reports) {
      const author = authorByContent.get(r.content_id);
      if (!author) continue;
      const list = reportsByAuthor.get(author) ?? [];
      list.push({ id: r.id });
      reportsByAuthor.set(author, list);
    }

    // Resolve admin audience once.
    const { data: admins } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("is_active", true);
    const adminIds = (admins ?? []).map(
      (a: { user_id: string }) => a.user_id,
    );

    let spikesFound = 0;
    let reportsRaised = 0;
    for (const [authorId, list] of reportsByAuthor) {
      if (list.length < SPIKE_THRESHOLD) continue;
      spikesFound++;

      // Bulk update the implicated reports: priority='high', add
      // 'spike_detected' tag (deduped via array_remove + append).
      const ids = list.map((r) => r.id);
      const { data: existing } = await supabase
        .from("content_reports")
        .select("id, tags, priority")
        .in("id", ids);
      for (const row of existing ?? []) {
        const tags: string[] = row.tags ?? [];
        const nextTags = tags.includes("spike_detected")
          ? tags
          : [...tags, "spike_detected"];
        const nextPriority = "high";
        if (row.priority === "high" && tags.includes("spike_detected")) continue;
        await supabase
          .from("content_reports")
          .update({ priority: nextPriority, tags: nextTags })
          .eq("id", row.id);
        reportsRaised++;
      }

      // Admin alert — throttled per (admin, target author) over 48h.
      if (adminIds.length > 0) {
        for (const adminId of adminIds) {
          const { count: prior } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", adminId)
            .eq("type", "admin_alert")
            .gte("created_at", sinceDupe)
            .contains("data", { spike_for_user: authorId });
          if ((prior ?? 0) > 0) continue;

          await supabase.from("notifications").insert({
            user_id: adminId,
            type: "admin_alert",
            title: "Report spike detected",
            body: `One user received ${list.length} content reports in the last 24 hours. Tap to review.`,
            data: {
              spike_for_user: authorId,
              report_count: list.length,
              alert_kind: "spike",
            },
            read: false,
          });
        }
      }
    }

    return ok(started, {
      spikes_found: spikesFound,
      reports_raised: reportsRaised,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[detect-report-spikes] fatal:", msg);
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
