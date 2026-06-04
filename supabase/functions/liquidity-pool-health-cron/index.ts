// ═══════════════════════════════════════════════════════════════════════════
// liquidity-pool-health-cron — Edge Function (Deno runtime)
//
// Phase D3 of feat(liquidity). Weekly wrapper around the
// process_liquidity_pool_health_check() PL/pgSQL RPC (migration 098).
//
// What it does:
//   1. Calls process_liquidity_pool_health_check() which reads the primary
//      liquidity pool's default_rate_pct and adjusts the two safety knobs:
//        - max_utilization_pct: -10pp if default_rate > 5% (floor 30%),
//          +5pp if default_rate = 0 AND no defaults in 30 days (cap 90%).
//        - is_accepting_requests: false if default_rate > 8% (safety circuit),
//          true again if default_rate = 0 AND no defaults in 30 days
//          (conservative resume).
//   2. Logs to cron_job_logs with the changes JSONB so ops can audit
//      every weekly adjustment.
//
// Fees stay HARDCODED in the TypeScript engine (CrossCircleLiquidityEngine.ts)
// per the approved decision — only safety knobs are AI-tuned.
//
// Schedule recommendation: weekly Sunday 05:00 UTC. Default-rate moves
// slowly so daily evaluation is wasteful. NOT auto-enabled — snippet only.
//
// Deployment:
//   supabase functions deploy liquidity-pool-health-cron --no-verify-jwt
//
// Schedule snippet:
//   SELECT cron.schedule(
//     'liquidity-pool-health-weekly',
//     '0 5 * * 0',      -- Sunday 05:00 UTC
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/liquidity-pool-health-cron',
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
    console.log("🛡️ Running process_liquidity_pool_health_check...");
    const { data, error } = await supabase.rpc("process_liquidity_pool_health_check");

    if (error) {
      console.error("[liquidity-pool-health-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "liquidity-pool-health-cron",
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
      changes_made: number;
      changes: Array<{
        change: string;
        reason: string;
        previous_value: unknown;
        new_value: unknown;
      }>;
      pool_state: {
        default_rate_pct: number;
        utilization_pct: number;
        old_max_utilization_pct: number;
        new_max_utilization_pct: number;
        old_accepting_flag: boolean;
        new_accepting_flag: boolean;
        recent_defaults_30d: number;
        available_cents: number;
        deployed_cents: number;
      };
      source: string;
      note: string;
      error?: string;
    };

    if (!result?.success) {
      console.error("[liquidity-pool-health-cron] RPC unsuccessful:", result?.error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "liquidity-pool-health-cron",
          status: "failed",
          records_processed: 0,
          records_succeeded: 0,
          records_failed: 1,
          execution_time_ms: Date.now() - startTime,
          details: { rpc_response: result },
          error_message: result?.error ?? "rpc returned success=false",
        });
      } catch (logErr: any) {
        console.log("⚠️ Could not log job:", logErr?.message);
      }
      return new Response(
        JSON.stringify({ success: false, error: result?.error ?? "rpc failed", result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Done:", {
      changes_made: result.changes_made,
      default_rate_pct: result.pool_state.default_rate_pct,
      new_max_util: result.pool_state.new_max_utilization_pct,
      new_accepting: result.pool_state.new_accepting_flag,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "liquidity-pool-health-cron",
        status: "success",
        records_processed: 1, // single pool
        records_succeeded: 1,
        records_failed: 0,
        execution_time_ms: Date.now() - startTime,
        details: {
          changes_made: result.changes_made,
          changes: result.changes,
          pool_state: result.pool_state,
          note: result.note,
        },
      });
    } catch (logErr: any) {
      console.log("⚠️ Could not log job:", logErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Liquidity pool health check completed",
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
