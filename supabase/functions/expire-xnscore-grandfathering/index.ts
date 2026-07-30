// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: expire-xnscore-grandfathering
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 03:00 UTC via pg_cron (registered in mig 396d).
// Purpose:  Clear xn_scores.grandfathered_score + grandfather_expires_at
//           for users whose 60-day protection window has closed.
//           The floor logic in recalculate_full_xnscore already ignores
//           expired rows via `grandfather_expires_at > NOW()`, so this
//           sweep only affects display state — keeps the columns clean
//           for admin surfaces and prevents stale data accumulating.
//
// Deployment:
//   supabase functions deploy expire-xnscore-grandfathering --no-verify-jwt
//
// Same auth + logging pattern as refresh-xnscore-rolling-averages:
//   • SUPABASE_SERVICE_ROLE_KEY bypasses RLS.
//   • Deployed --no-verify-jwt (pg_cron invokes without Auth header).
//   • Writes cron_job_logs row on success + failure.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "expire-xnscore-grandfathering";

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
      console.error(
        "[expire-xnscore-grandfathering] cron_job_logs insert failed:",
        logErr instanceof Error ? logErr.message : String(logErr),
      );
    }
  };

  try {
    const nowIso = new Date().toISOString();

    // Find rows whose grandfather window has expired.
    const { data: expiredRows, error: selectErr } = await supabase
      .from("xn_scores")
      .select("user_id")
      .lt("grandfather_expires_at", nowIso)
      .not("grandfathered_score", "is", null);
    if (selectErr) throw new Error(selectErr.message);

    const userIds = (expiredRows ?? []).map((r: { user_id: string }) => r.user_id);

    let cleared = 0;
    if (userIds.length > 0) {
      const { error: updErr } = await supabase
        .from("xn_scores")
        .update({
          grandfathered_score: null,
          grandfather_expires_at: null,
        })
        .in("user_id", userIds);
      if (updErr) throw new Error(updErr.message);
      cleared = userIds.length;
    }

    await logRun({
      status: "success",
      records_processed: cleared,
      records_succeeded: cleared,
      records_failed: 0,
      details: { cleared_at: nowIso },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        cleared,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[expire-xnscore-grandfathering] fatal:", msg);

    await logRun({
      status: "failure",
      error_message: msg,
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
