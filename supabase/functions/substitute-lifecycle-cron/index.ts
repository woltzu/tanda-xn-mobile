// ═══════════════════════════════════════════════════════════════════════════
// substitute-lifecycle-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(substitute). Wrapper around the
// process_substitute_lifecycle() PL/pgSQL RPC (migration 100). Runs three
// batches in one transaction:
//   1. 24h admin-pending → auto-approve + execute the 7-step swap
//      (replaces exiting member with substitute in circle_members,
//       updates exit_request to 'completed', bumps total_substitutions,
//       applies XnScore adjustment, notifies remaining circle members)
//   2. 48h pending_confirmation expired → mark expired, increment decline
//      counter (suspend at 3 in 90d), find next candidate or forfeit
//   3. 90d decline counter reset for members past the rolling window
//
// Logs aggregate counts to cron_job_logs.
//
// Schedule recommendation: hourly. The 24h auto-approval and 48h
// expiration are time-sensitive; the 90d reset is cheap to evaluate
// every hour. NOT auto-enabled — provide snippet only.
//
// Deployment:
//   supabase functions deploy substitute-lifecycle-cron --no-verify-jwt
//
// Schedule snippet:
//   SELECT cron.schedule(
//     'substitute-lifecycle-hourly',
//     '0 * * * *',
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/substitute-lifecycle-cron',
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
    console.log("🔁 Running process_substitute_lifecycle...");
    const { data, error } = await supabase.rpc("process_substitute_lifecycle");

    if (error) {
      console.error("[substitute-lifecycle-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "substitute-lifecycle-cron",
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
      auto_approvals_processed: number;
      expired_confirmations_processed: number;
      next_match_attempts: number;
      exit_requests_forfeited_no_candidates: number;
      decline_counters_reset: number;
      errors: Array<{ batch: string; substitution_record_id: string; error: string }>;
      source: string;
      note: string;
    };

    const totalProcessed =
      result.auto_approvals_processed +
      result.expired_confirmations_processed +
      result.decline_counters_reset;
    const errorsCount = Array.isArray(result.errors) ? result.errors.length : 0;

    console.log("✅ Done:", {
      auto_approvals: result.auto_approvals_processed,
      expired: result.expired_confirmations_processed,
      next_match_attempts: result.next_match_attempts,
      forfeited: result.exit_requests_forfeited_no_candidates,
      decline_resets: result.decline_counters_reset,
      errors: errorsCount,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "substitute-lifecycle-cron",
        status: errorsCount === 0 ? "success" : "partial",
        records_processed: totalProcessed,
        records_succeeded: totalProcessed - errorsCount,
        records_failed: errorsCount,
        execution_time_ms: Date.now() - startTime,
        details: {
          auto_approvals_processed: result.auto_approvals_processed,
          expired_confirmations_processed: result.expired_confirmations_processed,
          next_match_attempts: result.next_match_attempts,
          exit_requests_forfeited_no_candidates: result.exit_requests_forfeited_no_candidates,
          decline_counters_reset: result.decline_counters_reset,
          errors: result.errors,
          note: result.note,
        },
      });
    } catch (logErr: any) {
      console.log("⚠️ Could not log job:", logErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Substitute lifecycle batch completed",
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
