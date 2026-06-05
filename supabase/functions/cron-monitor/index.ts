// =============================================================================
// cron-monitor -- Edge Function (Deno runtime)
//
// Step 3 of production hardening. Runs hourly (cron schedule added in
// the migration-117 commit). Scans cron_job_logs for the last 2 hours
// and writes one row to public.alerts per detected condition.
//
// Conditions watched per job:
//   1. cron_failure       latest log row for that job is status='failed'
//   2. cron_partial       latest log row is status='partial'
//   3. cron_missed_run    no log row in the last (expected_interval *
//                         JITTER) minutes -- jitter handles "the job
//                         is scheduled at the boundary and the monitor
//                         fires a few seconds before the cron does"
//
// Dedup is enforced at the DB layer: alerts has a partial unique index
// (alert_type, source) WHERE status='open', so two open alerts for the
// same condition on the same job can never coexist. The EF treats a
// 23505 (unique_violation) as "already alerted, no-op" -- the goal is
// the alert exists, not that this run created it.
//
// Job interval table is BAKED IN -- adding a new job means updating
// JOB_INTERVALS_MINUTES below. The alternative (read from cron.job in
// the DB) would couple the monitor to pg_cron's schedule parsing and
// add latency for no real benefit at MVP scale.
//
// Deploy: supabase functions deploy cron-monitor --no-verify-jwt
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SELF_NAME = "cron-monitor";

// Expected max interval between consecutive successful runs, in minutes.
// Anything not in this map is not checked for missed runs -- it only
// gets the failure/partial check applied.
//
// Some buffer is baked in (we use the expected interval * SLA_FACTOR)
// so we don't fire false alerts on a cron that ran 30 seconds late.
const SLA_FACTOR = 1.25;

const JOB_INTERVALS_MINUTES: Record<string, number> = {
  // Hourly
  "cron-monitor":                      60,
  "cycle-progression-cron":            60,
  "substitute-lifecycle-hourly":       60,
  // Every 4-6 hours
  "send-payment-reminders":            240,
  "check-overdue-payments":            360,
  // Twice-daily / half-hourly
  "expire-swap-requests":              30,
  "process-notification-queue":         5,
  "webhook-retry-processor":            5,
  // Daily
  "scoring-pipeline-daily":            24 * 60,
  "daily-interest-accrual":            24 * 60,
  "daily-payment-reminders":           24 * 60,
  "cleanup-expired-reservations":      24 * 60,
  "cleanup-notifications":             24 * 60,
  "process-deletions":                 24 * 60,
  "process-autopay":                   24 * 60,
  "process-bank-payouts":              24 * 60,
  "update-overdue-obligations":        24 * 60,
  "advance-signal-collection-daily":   24 * 60,
  "stress-signal-collection-daily":    24 * 60,
  "stress-scoring-daily":              24 * 60,
  "login-drop-collection-daily":       24 * 60,
  "mood-bridge-daily":                 24 * 60,
  "partial-contribution-lifecycle-daily": 24 * 60,
  // Weekly
  "auto-archive-groups":               7 * 24 * 60,
  "aml-monitoring-weekly":             7 * 24 * 60,
  "sanctions-screening-weekly":        7 * 24 * 60,
  "cleanup-old-data":                  7 * 24 * 60,
  "insurance-pool-rate-weekly":        7 * 24 * 60,
  "mood-scoring-weekly":               7 * 24 * 60,
  "weekly-model-performance-check":    7 * 24 * 60,
  "data-quality-weekly":               7 * 24 * 60,
  "xnscore-decay-check":               7 * 24 * 60,
  // Monthly
  "xnscore-tenure-bonus":              31 * 24 * 60,
  "monthly-cohort-analysis":           31 * 24 * 60,
};

type AlertInsert = {
  alert_type: string;
  severity: "info" | "warning" | "critical";
  source: string;
  title: string;
  body: string;
  details: Record<string, unknown>;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const observations: AlertInsert[] = [];
  const skipped: string[] = [];
  let alertsInserted = 0;
  let alertsDeduped = 0;

  try {
    // --- Step A: failures + partials -----------------------------------
    // Look at every cron_job_logs row in the last 2h. Group by job_name
    // and take the LATEST row per job. If that latest row is failed or
    // partial, alert. We use the latest-per-job (not "any failure")
    // because a job that failed, then succeeded, has recovered and
    // doesn't need an alert -- only standing failures matter.
    const since2h = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabase
      .from("cron_job_logs")
      .select("id, job_name, status, error_message, execution_time_ms, created_at")
      .gte("created_at", since2h)
      .order("created_at", { ascending: false });

    if (recentErr) throw new Error(`load recent logs: ${recentErr.message}`);

    const latestByJob = new Map<string, {
      id: string;
      job_name: string;
      status: string;
      error_message: string | null;
      execution_time_ms: number | null;
      created_at: string;
    }>();
    for (const row of recent ?? []) {
      if (!latestByJob.has(row.job_name)) latestByJob.set(row.job_name, row);
    }

    for (const [jobName, row] of latestByJob) {
      if (row.status === "failed") {
        observations.push({
          alert_type: "cron_failure",
          severity: "critical",
          source: jobName,
          title: `${jobName} failed`,
          body: row.error_message
            ? `Latest run failed: ${row.error_message}`
            : "Latest run failed (no error message captured).",
          details: {
            log_id: row.id,
            failed_at: row.created_at,
            execution_time_ms: row.execution_time_ms,
            observation_window_start: since2h,
          },
        });
      } else if (row.status === "partial") {
        observations.push({
          alert_type: "cron_partial",
          severity: "warning",
          source: jobName,
          title: `${jobName} partial`,
          body: row.error_message
            ? `Latest run partial: ${row.error_message}`
            : "Latest run completed partially (some records failed).",
          details: {
            log_id: row.id,
            partial_at: row.created_at,
            execution_time_ms: row.execution_time_ms,
            observation_window_start: since2h,
          },
        });
      }
    }

    // --- Step B: missed runs -------------------------------------------
    // For every job in JOB_INTERVALS_MINUTES, check whether ANY log row
    // exists within (interval * SLA_FACTOR) minutes. If not, alert.
    //
    // We use a single query per job rather than one big OR. The job
    // count is small (~30) and the per-job queries hit the
    // (job_name, created_at) index cleanly.
    const now = Date.now();
    for (const [jobName, intervalMin] of Object.entries(JOB_INTERVALS_MINUTES)) {
      const slaWindowMin = intervalMin * SLA_FACTOR;
      const since = new Date(now - slaWindowMin * 60 * 1000).toISOString();

      const { count, error: cntErr } = await supabase
        .from("cron_job_logs")
        .select("id", { count: "exact", head: true })
        .eq("job_name", jobName)
        .gte("created_at", since);

      if (cntErr) {
        skipped.push(`${jobName}: count query failed (${cntErr.message})`);
        continue;
      }

      if ((count ?? 0) === 0) {
        // Severity scales with interval: a missing hourly is critical,
        // a missing weekly is "warning" until we're past 2x the SLA.
        const severity: AlertInsert["severity"] =
          intervalMin <= 60
            ? "critical"
            : intervalMin <= 24 * 60
              ? "warning"
              : "info";

        observations.push({
          alert_type: "cron_missed_run",
          severity,
          source: jobName,
          title: `${jobName} missed run`,
          body: `No cron_job_logs row in the last ${Math.round(slaWindowMin)} minutes (expected every ${intervalMin}m).`,
          details: {
            expected_interval_minutes: intervalMin,
            sla_window_minutes: slaWindowMin,
            sla_factor: SLA_FACTOR,
            observation_window_start: since,
          },
        });
      }
    }

    // --- Step C: insert with dedup --------------------------------------
    // The (alert_type, source) WHERE status='open' partial unique index
    // (migration 117) means a duplicate observation hits 23505 and we
    // just count it as deduped. The right place to dedup is the DB --
    // we want to alert on the CONDITION, not on every observation.
    for (const obs of observations) {
      const { error: insErr } = await supabase.from("alerts").insert(obs);

      if (!insErr) {
        alertsInserted++;
        continue;
      }

      // 23505 = unique_violation. Already an open alert for this
      // (alert_type, source) -- exactly the dedup behavior we want.
      // PostgREST surfaces this as code "23505" in error.code.
      const code = (insErr as { code?: string }).code;
      if (code === "23505") {
        alertsDeduped++;
      } else {
        skipped.push(`${obs.alert_type}/${obs.source}: ${insErr.message}`);
      }
    }

    const runtimeMs = Date.now() - startTime;
    const status: "success" | "partial" =
      skipped.length === 0 ? "success" : "partial";

    // Log THIS run into cron_job_logs so the monitor itself shows up in
    // the very dashboard it produces. If the monitor stops running, the
    // missed-run check will eventually flag it (we set its expected
    // interval to 60 below).
    await supabase.from("cron_job_logs").insert({
      job_name: SELF_NAME,
      status,
      records_processed: observations.length,
      records_succeeded: alertsInserted + alertsDeduped,
      records_failed: skipped.length,
      execution_time_ms: runtimeMs,
      details: {
        observed: observations.length,
        inserted: alertsInserted,
        deduped: alertsDeduped,
        skipped_count: skipped.length,
        skipped_sample: skipped.slice(0, 5),
      },
      error_message: skipped.length > 0 ? skipped.slice(0, 5).join("; ") : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobName: SELF_NAME,
        status,
        observed: observations.length,
        inserted: alertsInserted,
        deduped: alertsDeduped,
        skipped: skipped.length,
        runtimeMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort self-log so the failure is visible in the same
    // dashboard the monitor feeds.
    await supabase.from("cron_job_logs").insert({
      job_name: SELF_NAME,
      status: "failed",
      records_processed: 0,
      records_succeeded: 0,
      records_failed: 1,
      execution_time_ms: Date.now() - startTime,
      details: { fatal_error: msg },
      error_message: msg,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
