// ═══════════════════════════════════════════════════════════════════════════
// insurance-pool-rate-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(insurance). Weekly wrapper around the
// process_pool_rate_recalculation() PL/pgSQL RPC (migration 096).
//
// What it does:
//   1. Calls process_pool_rate_recalculation() which iterates all active
//      circle_insurance_pools and runs calculate_pool_rate(circle_id) per
//      pool. The per-circle function tunes the rate from 2% base using:
//        - avg member XnScore (±0.50% / 0.30% / 0.30% buckets)
//        - count of members below 'fair' tier (+0.20% each, max +0.80%)
//        - count of historical defaults (+0.15% each, max +0.60%)
//      then clamps to [pool.rate_floor, pool.rate_ceiling] = [1%, 3%].
//   2. Logs to cron_job_logs with aggregate counts in details JSONB.
//
// Schedule recommendation: weekly Sunday 04:30 UTC. Rate changes are slow
// signals (avg XnScore moves slowly, defaults are rare events) so daily
// re-evaluation is wasteful. NOT auto-enabled — provide the snippet only.
//
// Deployment:
//   supabase functions deploy insurance-pool-rate-cron --no-verify-jwt
//
// Schedule snippet:
//   SELECT cron.schedule(
//     'insurance-pool-rate-weekly',
//     '30 4 * * 0',     -- Sunday 04:30 UTC
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/insurance-pool-rate-cron',
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
    console.log("📊 Running process_pool_rate_recalculation...");
    const { data, error } = await supabase.rpc("process_pool_rate_recalculation");

    if (error) {
      console.error("[insurance-pool-rate-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "insurance-pool-rate-cron",
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
      pools_evaluated: number;
      rates_changed: number;
      rates_increased: number;
      rates_decreased: number;
      errors: string[];
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      evaluated: result.pools_evaluated,
      changed: result.rates_changed,
      up: result.rates_increased,
      down: result.rates_decreased,
    });

    const errorsCount = Array.isArray(result.errors) ? result.errors.length : 0;
    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "insurance-pool-rate-cron",
        status: errorsCount === 0 ? "success" : "partial",
        records_processed: result.pools_evaluated,
        records_succeeded: result.pools_evaluated - errorsCount,
        records_failed: errorsCount,
        execution_time_ms: Date.now() - startTime,
        details: {
          pools_evaluated: result.pools_evaluated,
          rates_changed: result.rates_changed,
          rates_increased: result.rates_increased,
          rates_decreased: result.rates_decreased,
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
        message: "Insurance pool rate recalculation completed",
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
