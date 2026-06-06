// =============================================================================
// inactive-user-cleanup-cron -- Edge Function (Deno runtime)
//
// Monthly companion to the delete_inactive_users() RPC defined in
// migration 119. Runs on the 1st of every month at 03:00 UTC (schedule
// is in the migration). For each invocation:
//
//   1. Call public.delete_inactive_users(
//        p_inactivity_months := 24,
//        p_dry_run           := false,     <-- intentional: this is the actual sweep
//        p_max_users         := 500
//      )
//   2. Write a cron_job_logs row so cron-monitor sees it like every
//      other scheduled task. status='success' on RPC success,
//      status='partial' if any per-user errors come back, status='failed'
//      on RPC error.
//
// Safety notes:
//   * 500-user batch cap per run. A larger backlog will drain over
//     consecutive monthly runs. A single run that tried to anonymize
//     tens of thousands of users could lock tables for an
//     uncomfortably long time; the cap keeps each invocation bounded.
//   * The RPC has p_dry_run defaulting to TRUE. The explicit false in
//     this EF is the only place that flips it. Anyone who calls
//     delete_inactive_users() ad-hoc gets a count-only response and
//     no row changes.
//
// Deploy: supabase functions deploy inactive-user-cleanup-cron --no-verify-jwt
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "inactive-user-cleanup-cron";
const INACTIVITY_MONTHS = 24;
const MAX_USERS_PER_RUN = 500;

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

  try {
    const { data, error } = await supabase.rpc("delete_inactive_users", {
      p_inactivity_months: INACTIVITY_MONTHS,
      p_dry_run: false,
      p_max_users: MAX_USERS_PER_RUN,
    });

    if (error) throw new Error(`delete_inactive_users RPC: ${error.message}`);

    // The RPC returns JSONB shaped like:
    //   { dry_run, cutoff, inactivity_months, candidate_count,
    //     users_processed, users_anonymized,
    //     contributions_cancelled, advances_cancelled, kyc_rows_deleted,
    //     errors: [...], source }
    const result = (data ?? {}) as Record<string, unknown>;
    const errorsArr = Array.isArray(result.errors) ? (result.errors as string[]) : [];
    const status =
      errorsArr.length === 0
        ? "success"
        : Number(result.users_anonymized ?? 0) > 0
          ? "partial"
          : "failed";

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status,
      records_processed: Number(result.users_processed ?? 0),
      records_succeeded: Number(result.users_anonymized ?? 0),
      records_failed: errorsArr.length,
      execution_time_ms: Date.now() - startTime,
      details: {
        candidate_count: result.candidate_count,
        cutoff: result.cutoff,
        inactivity_months: result.inactivity_months,
        contributions_cancelled: result.contributions_cancelled,
        advances_cancelled: result.advances_cancelled,
        kyc_rows_deleted: result.kyc_rows_deleted,
        max_users_per_run: MAX_USERS_PER_RUN,
        error_sample: errorsArr.slice(0, 5),
      },
      error_message: errorsArr.length > 0 ? errorsArr.slice(0, 5).join("; ") : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobName: JOB_NAME,
        status,
        ...result,
        runtimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort fail log
    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status: "failed",
      records_processed: 0,
      records_succeeded: 0,
      records_failed: 1,
      execution_time_ms: Date.now() - startTime,
      details: { fatal_error: msg, inactivity_months: INACTIVITY_MONTHS },
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
