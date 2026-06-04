// ═══════════════════════════════════════════════════════════════════════════
// early-intervention-cron — Edge Function (Deno runtime)
//
// Thin wrapper around the process_member_interventions() PL/pgSQL RPC
// (migration 082). The RPC contains all the logic — this EF just invokes
// it on a schedule and writes a cron_job_logs entry so dashboard
// telemetry can see runs.
//
// Architecture choice: doing the logic in PL/pgSQL instead of Deno
// because the TypeScript engine (services/EarlyInterventionEngine.ts)
// imports a React-Native-bound supabase client that can't run on Deno.
// PL/pgSQL also gives us atomic row-level locking and avoids the
// re-implementation tax of porting ~250 LOC across runtimes.
//
// Trigger sources:
//   1. pg_cron (intended) — see schedule_early_intervention_cron() snippet
//      in the migration commit message.
//   2. Manual invocation — supabase functions invoke early-intervention-cron
//   3. Future: an admin "Run now" button in a maintenance screen.
//
// Deployed --no-verify-jwt because cron / pg_cron callers don't carry a
// Supabase JWT. The RPC itself is SECURITY DEFINER + GRANT EXECUTE TO
// service_role only, so unauthenticated calls still can't execute it
// without the service role key.
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
    console.log("🛎️ Running process_member_interventions...");
    const { data, error } = await supabase.rpc("process_member_interventions");

    if (error) {
      console.error("[early-intervention-cron] RPC error:", error);
      // Log failure to cron_job_logs so the daily metrics still capture it.
      await supabase.from("cron_job_logs").insert({
        job_name: "early-intervention-cron",
        status: "failed",
        records_processed: 0,
        records_succeeded: 0,
        records_failed: 1,
        execution_time_ms: Date.now() - startTime,
        details: { error_code: error.code },
        error_message: error.message,
      }).catch((e: any) => console.log("⚠️ Could not log job:", e.message));

      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = data as {
      success: boolean;
      candidates_evaluated: number;
      interventions_created: number;
      skipped_no_rule: number;
      skipped_level_too_high: number;
      skipped_no_template: number;
      skipped_cooldown: number;
      skipped_max_per_cycle: number;
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      evaluated: result.candidates_evaluated,
      created: result.interventions_created,
    });

    // Log success to cron_job_logs.
    await supabase.from("cron_job_logs").insert({
      job_name: "early-intervention-cron",
      status: "success",
      records_processed: result.candidates_evaluated,
      records_succeeded: result.interventions_created,
      records_failed: 0,
      execution_time_ms: Date.now() - startTime,
      details: result,
    }).catch((e: any) => console.log("⚠️ Could not log job:", e.message));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Intervention processing completed",
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
