// ═══════════════════════════════════════════════════════════════════════════
// advance-signal-cron — Edge Function (Deno runtime)
//
// Signal D of feat(stress). Daily wrapper around the
// collect_advance_request_signals() PL/pgSQL RPC (migration 089). Reads
// liquidity_advances activity from the last 30 days, applies the engine's
// tier formula + urgency boost, writes member_stress_signals rows of
// signal_type='early_payout_request' (15% weight).
//
// Completes the 4-signal stress engine:
//   A contribution_delay  30% (cycle_contributions late detection)
//   B ticket_language     35% (support_tickets keyword analysis)
//   C login_drop          20% (login_events frequency drop)
//   D early_payout_request 15% (liquidity_advances request count + urgency)
//   ----
//   100% — max composite reaches 100, full status band coverage
//
// Schedule recommendation: daily at 03:45 UTC (right before the scoring
// cron at 04:00 UTC) so today's signals are scored today.
//
// Deployment:
//   supabase functions deploy advance-signal-cron --no-verify-jwt
//
// Schedule snippet (NOT auto-enabled):
//   SELECT cron.schedule(
//     'advance-signal-collection-daily',
//     '45 3 * * *',
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/advance-signal-cron',
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
    console.log("💰 Running collect_advance_request_signals...");
    const { data, error } = await supabase.rpc("collect_advance_request_signals");

    if (error) {
      console.error("[advance-signal-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "advance-signal-cron",
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
      inserted: number;
      skipped_dup: number;
      skipped_zero: number;
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      inserted: result.inserted,
      skipped_dup: result.skipped_dup,
      skipped_zero: result.skipped_zero,
    });

    const processed = result.inserted + result.skipped_dup + result.skipped_zero;

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "advance-signal-cron",
        status: "success",
        records_processed: processed,
        records_succeeded: result.inserted,
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
        message: "Advance request signal collection completed",
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
