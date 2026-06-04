// ═══════════════════════════════════════════════════════════════════════════
// stress-scoring-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(stress). Thin wrapper around the process_member_stress()
// PL/pgSQL RPC (migration 084 Part B, shipped in D1).
//
// What it does on each run:
//   1. Calls process_member_stress() which iterates members with signals in
//      the last 30 days, groups + averages by signal type, computes the
//      weighted composite, INSERTs member_stress_scores (DB trigger from
//      migration 060 auto-fills status / intervention_triggered /
//      intervention_type), and creates a stress_interventions row when
//      intervention_triggered crosses into orange/red.
//   2. Logs to cron_job_logs.
//
// Designed to run AFTER the signal collection cron so newly-collected
// signals from the previous hour are included in the score. Recommended
// schedule: 03:00 UTC daily (collection runs 02:00 UTC).
//
// Honest scope reminder: with only Signal A (contribution_delay, 30%
// weight) actively producing data, composite scores cap at ~30 — every
// member stays in the 'green' band, no interventions ever fire. Wiring up
// Signals B/C/D unlocks the rest of the score range and the intervention
// path. The same RPC keeps working without code change once those signals
// start arriving in member_stress_signals.
//
// Deployment & scheduling:
//   supabase functions deploy stress-scoring-cron --no-verify-jwt
//
//     SELECT cron.schedule(
//       'stress-scoring-daily',
//       '0 3 * * *',
//       $$ SELECT net.http_post(
//            url := 'https://<ref>.supabase.co/functions/v1/stress-scoring-cron',
//            headers := jsonb_build_object(
//              'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
//              'Content-Type', 'application/json'),
//            body := '{}'::jsonb
//          ); $$
//     );
//
// --no-verify-jwt + SECURITY DEFINER RPC + service-role grant pattern is
// the same as the other 3 AI engine crons in this project.
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
    console.log("🧮 Running process_member_stress...");
    const { data, error } = await supabase.rpc("process_member_stress");

    if (error) {
      console.error("[stress-scoring-cron] RPC error:", error);
      // Same try/catch fix as the other engine crons (Supabase-js v2
      // .insert() is a thenable, no .catch()).
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "stress-scoring-cron",
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
      scored: number;
      interventions_created: number;
      errors: string[];
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      scored: result.scored,
      interventions_created: result.interventions_created,
      errors: result.errors.length,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "stress-scoring-cron",
        status: result.errors.length === 0 ? "success" : "partial",
        records_processed: result.scored + result.errors.length,
        records_succeeded: result.scored,
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
        message: "Stress scoring completed",
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
