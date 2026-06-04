// ═══════════════════════════════════════════════════════════════════════════
// stress-signal-collection-cron — Edge Function (Deno runtime)
//
// Phase D1 of feat(stress). Thin wrapper around the collect_stress_signals()
// PL/pgSQL RPC (migration 084 Part A).
//
// What it does on each run:
//   1. Calls collect_stress_signals() which scans cycle_contributions for
//      late payments and inserts member_stress_signals rows of type
//      'contribution_delay'. Dedup window: 7 days per (member, cycle, type).
//   2. Logs the run to cron_job_logs.
//
// Scope: this EF ONLY collects Signal A (contribution_delay). The engine
// defines three more signal types (ticket_language, login_drop,
// early_payout_request) but their upstream data sources aren't online yet.
// Adding those collectors is a separate cron per source.
//
// Deployment & scheduling:
//   supabase functions deploy stress-signal-collection-cron --no-verify-jwt
//
//   Schedule daily 02:00 UTC (1 hour before the scoring cron at 03:00 UTC
//   so collected signals are available for scoring on the same day):
//     SELECT cron.schedule(
//       'stress-signal-collection-daily',
//       '0 2 * * *',
//       $$ SELECT net.http_post(
//            url := 'https://<ref>.supabase.co/functions/v1/stress-signal-collection-cron',
//            headers := jsonb_build_object(
//              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//              'Content-Type', 'application/json'),
//            body := '{}'::jsonb
//          ); $$
//     );
//
// --no-verify-jwt because pg_cron callers don't carry a JWT. The RPC is
// SECURITY DEFINER + GRANT EXECUTE service_role only, so the EF still
// requires the service-role key to do anything.
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
    console.log("📡 Running collect_stress_signals...");
    const { data, error } = await supabase.rpc("collect_stress_signals");

    if (error) {
      console.error("[stress-signal-collection-cron] RPC error:", error);
      // Wrapped in try/catch — Supabase-js v2 .insert() returns a thenable
      // PostgrestFilterBuilder without .catch(), same fix pattern as
      // early-intervention-cron / conflict-monitoring-cron.
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "stress-signal-collection-cron",
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
      signals_inserted: number;
      signals_skipped_dup: number;
      members_touched: number;
      signal_type: string;
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      inserted: result.signals_inserted,
      skipped_dup: result.signals_skipped_dup,
      members_touched: result.members_touched,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "stress-signal-collection-cron",
        status: "success",
        // records_processed counts EVERYTHING the function looked at; we
        // only know inserted + skipped, so the sum approximates that.
        records_processed: result.signals_inserted + result.signals_skipped_dup,
        records_succeeded: result.signals_inserted,
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
        message: "Stress signal collection completed",
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
