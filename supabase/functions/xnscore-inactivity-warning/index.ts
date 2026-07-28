// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-inactivity-warning
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: daily 08:00 UTC (mig 385 pg_cron: xnscore-inactivity-warning-daily).
//
// Purpose: preventive nudge before the weekly xnscore-decay-check applies
//   inactivity decay. Fires for members who are 27-29 days inactive (3-day
//   preemption before the 30-day decay threshold used by
//   process_all_inactivity_decays).
//
// Coverage vs. other reminder crons:
//   * send-payment-reminders (every 4h)       — contribution due
//   * payout-reminder (daily 09:00 UTC)       — payout landing tomorrow
//   * check-advance-repayments (daily)        — advance due / overdue
//   * partial_catch_up_reminder_daily (10:00) — grace period / catchup
//   * xnscore-decay-check (Sun 00:00 UTC)     — applies decay silently
//   * THIS EF (daily 08:00 UTC)               — WARN before decay hits
//
// The gap this fills: xnscore-decay-check just deducts points on Sundays
// with no prior warning. Members had no opportunity to prevent it. This EF
// gives them ~3 days' notice.
//
// Preferences respected (existing schema, no migration):
//   * notification_preferences.push_enabled = FALSE   → skip entirely
//   * notification_preferences.push_reminders = FALSE → skip
//
// Dedup: mig 385 stamps xn_scores.last_inactivity_warning_at on send. The
// RPC's WHERE clause enforces a 30-day cooldown. Re-runs are safe.
//
// Deployment:
//   supabase functions deploy xnscore-inactivity-warning --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  user_id: string;
  display_name: string;
  last_financial_activity_at: string;
  days_since_activity: number;
  total_score: number;
  last_inactivity_warning_at: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = Date.now();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("🔔 xnscore-inactivity-warning: fetching candidates…");

    const { data: candidates, error: rpcErr } = await supabase.rpc(
      "list_xnscore_inactivity_warnings",
    );
    if (rpcErr) throw new Error(`RPC failed: ${rpcErr.message}`);

    const rows: Candidate[] = (candidates as Candidate[]) ?? [];
    console.log(`   found ${rows.length} candidate(s)`);

    if (rows.length === 0) {
      await logJob(supabase, {
        records_processed: 0,
        records_succeeded: 0,
        records_failed: 0,
        execution_time_ms: Date.now() - started,
        details: { note: "no candidates in the 27-29 day inactivity window" },
      });
      return jsonOk({ candidates: 0, sent: 0, skipped: 0, elapsed_ms: Date.now() - started });
    }

    // Batch-fetch preferences for all candidates in one round-trip.
    const userIds = rows.map((r) => r.user_id);
    const { data: prefs, error: prefErr } = await supabase
      .from("notification_preferences")
      .select("user_id, push_enabled, push_reminders")
      .in("user_id", userIds);
    if (prefErr) {
      console.warn("[warning] prefs read failed:", prefErr.message);
    }
    const prefsByUser = new Map<string, { push_enabled: boolean; push_reminders: boolean }>();
    for (const p of (prefs ?? []) as any[]) {
      prefsByUser.set(p.user_id, {
        push_enabled: p.push_enabled !== false,     // default TRUE if row missing
        push_reminders: p.push_reminders !== false, // default TRUE if row missing
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ user_id: string; error: string }> = [];

    for (const c of rows) {
      const p = prefsByUser.get(c.user_id) ?? { push_enabled: true, push_reminders: true };
      if (!p.push_enabled || !p.push_reminders) {
        skipped++;
        continue;
      }

      const daysUntilDecay = Math.max(0, 30 - c.days_since_activity);
      const body =
        `You haven't been active in ${c.days_since_activity} days. ` +
        `Make a contribution, receive a payout, or add funds within the next ` +
        `${daysUntilDecay} day${daysUntilDecay === 1 ? "" : "s"} to keep your ` +
        `XnScore from dropping.`;

      // Insert the notification. type='xnscore_inactivity_warning' is a new
      // type — the notifications table has no CHECK on type, so no schema
      // change needed.
      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: c.user_id,
        type: "xnscore_inactivity_warning",
        title: "Your XnScore is at risk",
        body,
        data: {
          last_financial_activity_at: c.last_financial_activity_at,
          days_since_activity: c.days_since_activity,
          days_until_decay: daysUntilDecay,
          current_score: c.total_score,
          threshold_days: 30,
        },
        read: false,
      });
      if (insErr) {
        failed++;
        errors.push({ user_id: c.user_id, error: insErr.message });
        console.error(`[warning] notification insert failed for ${c.user_id}:`, insErr.message);
        continue;
      }

      // Stamp the dedup anchor. If this UPDATE fails the notification still
      // landed — the RPC's 30-day cooldown WON'T re-arm without the stamp,
      // so on tomorrow's run the same user would be picked again. Log
      // loudly so we can catch persistent failures.
      const { error: stampErr } = await supabase
        .from("xn_scores")
        .update({ last_inactivity_warning_at: new Date().toISOString() })
        .eq("user_id", c.user_id);
      if (stampErr) {
        console.warn(
          `[warning] last_inactivity_warning_at stamp failed for ${c.user_id} ` +
            `(notification sent, would re-send tomorrow):`,
          stampErr.message,
        );
      }
      sent++;
    }

    await logJob(supabase, {
      records_processed: rows.length,
      records_succeeded: sent,
      records_failed: failed,
      execution_time_ms: Date.now() - started,
      details: {
        candidates: rows.length,
        sent,
        skipped_prefs: skipped,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    console.log(`✅ done — sent ${sent}, skipped ${skipped}, failed ${failed}`);

    return jsonOk({
      candidates: rows.length,
      sent,
      skipped_prefs: skipped,
      failed,
      elapsed_ms: Date.now() - started,
    });
  } catch (err: any) {
    console.error("💥 fatal:", err?.message ?? err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function logJob(supabase: any, row: {
  records_processed: number;
  records_succeeded: number;
  records_failed: number;
  execution_time_ms: number;
  details: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await supabase.from("cron_job_logs").insert({
      job_name: "xnscore-inactivity-warning",
      status: row.records_failed > 0 ? "partial" : "success",
      records_processed: row.records_processed,
      records_succeeded: row.records_succeeded,
      records_failed: row.records_failed,
      execution_time_ms: row.execution_time_ms,
      details: row.details,
    });
    if (error) console.log("⚠️ cron_job_logs insert failed:", error.message);
  } catch (e: any) {
    console.log("⚠️ cron_job_logs insert threw:", e?.message ?? e);
  }
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify({ success: true, ...(body as object) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
