// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: refresh-xnscore-rolling-averages
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 02:00 UTC via pg_cron (registered in mig 396d).
// Purpose:  Refresh xn_scores.rolling_avg_60d_score for every user by
//           calling the refresh_all_xnscore_rolling_averages(60) RPC
//           (created in mig 396b). Without this cron, the column goes
//           stale after ~24h and get_effective_xn_score degrades to
//           returning the point-in-time total_score.
//
// Deployment:
//   supabase functions deploy refresh-xnscore-rolling-averages --no-verify-jwt
//
// Authentication note: cron-triggered (no end-user JWT), so we use
// SUPABASE_SERVICE_ROLE_KEY to bypass RLS. Deployed --no-verify-jwt
// because pg_cron invokes it via pg_net without an Authorization header.
// The RPC is service_role-restricted at the DB layer so unauthorized
// invocations are still blocked.
//
// Logging: writes to cron_job_logs on both success and failure so the
// admin observability dashboard (mig 394) surfaces the run history.
// Best-effort — a log-write failure doesn't mask the real error.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "refresh-xnscore-rolling-averages";
const WINDOW_DAYS = 60;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const logRun = async (row: {
    status: "success" | "failure";
    records_processed?: number;
    records_succeeded?: number;
    records_failed?: number;
    error_message?: string | null;
    details?: Record<string, unknown>;
  }) => {
    const finishedAt = new Date();
    try {
      await supabase.from("cron_job_logs").insert({
        job_name: JOB_NAME,
        status: row.status,
        records_processed: row.records_processed ?? null,
        records_succeeded: row.records_succeeded ?? null,
        records_failed: row.records_failed ?? null,
        execution_time_ms: finishedAt.getTime() - startedAt.getTime(),
        error_message: row.error_message ?? null,
        details: row.details ?? null,
        started_at: startedAt.toISOString(),
        completed_at: finishedAt.toISOString(),
      });
    } catch (logErr) {
      // Best-effort: never let a log-write failure mask the real error.
      console.error(
        "[refresh-xnscore-rolling-averages] cron_job_logs insert failed:",
        logErr instanceof Error ? logErr.message : String(logErr),
      );
    }
  };

  try {
    const { data, error } = await supabase.rpc(
      "refresh_all_xnscore_rolling_averages",
      { p_days: WINDOW_DAYS },
    );
    if (error) throw new Error(error.message);

    const updated = typeof data === "number" ? data : 0;

    await logRun({
      status: "success",
      records_processed: updated,
      records_succeeded: updated,
      records_failed: 0,
      details: { window_days: WINDOW_DAYS },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        updated,
        window_days: WINDOW_DAYS,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[refresh-xnscore-rolling-averages] fatal:", msg);

    await logRun({
      status: "failure",
      records_failed: 0,
      error_message: msg,
      details: { window_days: WINDOW_DAYS },
    });

    return new Response(
      JSON.stringify({
        ok: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        error: msg,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
