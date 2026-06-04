// ═══════════════════════════════════════════════════════════════════════════
// data-quality-cron — Edge Function (Deno runtime)
//
// Phase C of feat(circle). Weekly wrapper around run_data_quality_check()
// (migration 093). Inspects the last 7 days of circle_match_history,
// writes a metrics row to match_data_quality_logs, logs to cron_job_logs.
//
// Schedule recommendation: weekly Monday 05:00 UTC.
//
// Deployment:
//   supabase functions deploy data-quality-cron --no-verify-jwt
//
// Schedule snippet (NOT auto-enabled):
//   SELECT cron.schedule(
//     'data-quality-weekly',
//     '0 5 * * 1',
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/data-quality-cron',
//          headers := jsonb_build_object(
//            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
//            'Content-Type', 'application/json'),
//          body := '{}'::jsonb
//        ); $$
//   );
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log("📊 Running run_data_quality_check...");
    const { data, error } = await supabase.rpc("run_data_quality_check");

    if (error) {
      console.error("[data-quality-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "data-quality-cron",
          status: "failed",
          records_processed: 0,
          records_succeeded: 0,
          records_failed: 1,
          execution_time_ms: Date.now() - startTime,
          details: { error_code: error.code },
          error_message: error.message,
        });
      } catch (logErr: any) {
        console.log("⚠️ Could not log job:", logErr?.message);
      }
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data as {
      success: boolean;
      log_id: string;
      period_start: string;
      period_end: string;
      total_records: number;
      overall_quality_score: number;
      snapshot_completeness_score: number;
      outcome_labeling_score: number;
      issues_count: number;
      source: string;
    };

    console.log("✅ Done:", {
      total: result.total_records,
      overall: result.overall_quality_score,
      issues: result.issues_count,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "data-quality-cron",
        status: "success",
        records_processed: result.total_records,
        records_succeeded: result.total_records,
        records_failed: 0,
        execution_time_ms: Date.now() - startTime,
        details: result,
      });
    } catch (logErr: any) {
      console.log("⚠️ Could not log job:", logErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data quality check completed",
        result,
        processing_time_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("💥 Fatal:", err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
