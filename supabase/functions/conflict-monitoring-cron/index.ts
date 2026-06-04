// ═══════════════════════════════════════════════════════════════════════════
// conflict-monitoring-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(conflict). Thin wrapper around the
// process_pair_monitoring() PL/pgSQL RPC (migration 083, Part B).
//
// What it does on each run:
//   1. Calls process_pair_monitoring() which iterates active monitors,
//      re-scores each pair via the same 6-factor formula as
//      services/ConflictPredictionEngine.scorePair(), updates current
//      scores, escalates Watch→Flag transitions, and inserts conflict_history
//      entries when escalations fire.
//   2. Logs the run to cron_job_logs (success or failure) so the operations
//      dashboard can see whether the cron is firing.
//
// Architecture choice — same as 082's early-intervention-cron:
//   The TS engine (services/ConflictPredictionEngine.ts) imports a
//   React-Native-bound supabase client that cannot run on Deno. Re-implementing
//   the monitoring loop in PL/pgSQL avoids the runtime mismatch AND skips ~16
//   round-trips per pair in favor of a single function call.
//
// Deployment & scheduling:
//   supabase functions deploy conflict-monitoring-cron --no-verify-jwt
//
//   Then schedule via pg_cron weekly (Sunday 02:00 UTC). Example:
//     SELECT cron.schedule(
//       'conflict-monitoring-weekly',
//       '0 2 * * 0',
//       $$ SELECT net.http_post(
//            url := 'https://<ref>.supabase.co/functions/v1/conflict-monitoring-cron',
//            headers := jsonb_build_object(
//              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//              'Content-Type', 'application/json'),
//            body := '{}'::jsonb
//          ); $$
//     );
//
// --no-verify-jwt because pg_cron callers don't carry a Supabase JWT. The
// RPC itself is SECURITY DEFINER + GRANT EXECUTE service_role only, so
// unauthenticated callers still cannot trigger the actual work without the
// service role key.
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
    console.log("⚖️ Running process_pair_monitoring...");
    const { data, error } = await supabase.rpc("process_pair_monitoring");

    if (error) {
      console.error("[conflict-monitoring-cron] RPC error:", error);
      // Log failure to cron_job_logs. Wrapped in try/catch because
      // Supabase-js v2 .insert() returns a PostgrestFilterBuilder (thenable
      // but no .catch()) — same fix as early-intervention-cron.
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "conflict-monitoring-cron",
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
      processed: number;
      escalated: number;
      deescalated: number;
      errors: string[];
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      processed: result.processed,
      escalated: result.escalated,
      deescalated: result.deescalated,
    });

    // records_succeeded counts pairs successfully re-evaluated. Escalations
    // and de-escalations are reported in details (separate metric from
    // success — they're outcomes, not failures).
    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "conflict-monitoring-cron",
        status: result.errors.length === 0 ? "success" : "partial",
        records_processed: result.processed,
        records_succeeded: result.processed - result.errors.length,
        records_failed: result.errors.length,
        execution_time_ms: Date.now() - startTime,
        details: result,
      });
    } catch (logErr: any) {
      console.log("⚠️ Could not log job:", logErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pair monitoring completed",
        result,
        processing_time_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("💥 Fatal error:", err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
