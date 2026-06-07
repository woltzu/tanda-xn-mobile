// =============================================================================
// process-referral-rewards-cron -- Edge Function (Deno runtime)
//
// Daily companion to the process_referral_rewards() RPC defined in
// migration 121. Runs at 03:30 UTC. The cron block in migration 121
// targets this EF.
//
// Each invocation:
//   1. Call public.process_referral_rewards()
//   2. Write a cron_job_logs row so cron-monitor sees it alongside
//      every other scheduled task. status=success when error_count=0,
//      status=partial when some rows failed but others processed,
//      status=failed only when the RPC itself threw.
//
// Idempotency note: the RPC itself is idempotent (WHERE processed_at
// IS NULL guards every UPDATE), so re-running the EF outside the cron
// schedule is safe. A second invocation immediately after a successful
// run finds 0 unpaid rows and writes a no-op cron log.
//
// Deploy: supabase functions deploy process-referral-rewards-cron --no-verify-jwt
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "process-referral-rewards-cron";

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
    const { data, error } = await supabase.rpc("process_referral_rewards");
    if (error) throw new Error(`process_referral_rewards RPC: ${error.message}`);

    // Returned shape per migration 121:
    //   { processed_count, total_amount_cents, errors: [...],
    //     error_count, source }
    const result = (data ?? {}) as Record<string, unknown>;
    const errorCount = Number(result.error_count ?? 0);
    const processedCount = Number(result.processed_count ?? 0);

    const status =
      errorCount === 0
        ? "success"
        : processedCount > 0
          ? "partial"
          : "failed";

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status,
      records_processed: processedCount + errorCount,
      records_succeeded: processedCount,
      records_failed: errorCount,
      execution_time_ms: Date.now() - startTime,
      details: {
        processed_count: processedCount,
        total_amount_cents: Number(result.total_amount_cents ?? 0),
        error_count: errorCount,
        // First 5 errors give an operator enough to triage without
        // dumping the whole array into the log row.
        error_sample: Array.isArray(result.errors)
          ? (result.errors as unknown[]).slice(0, 5)
          : [],
      },
      error_message: errorCount > 0
        ? `${errorCount} reward row(s) failed`
        : null,
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

    // Best-effort fail log so cron-monitor flags us.
    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
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
