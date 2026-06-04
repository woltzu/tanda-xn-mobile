// ═══════════════════════════════════════════════════════════════════════════
// login-drop-cron — Edge Function (Deno runtime)
//
// Signal C of feat(stress). Daily wrapper around the
// collect_login_drop_signals() PL/pgSQL RPC (migration 088). For each user
// with at least one login_event in the last 30 days, computes 7d-vs-23d
// rolling average drop and writes a member_stress_signals row of
// signal_type='login_drop' when the drop crosses 20%.
//
// Pairs with:
//   - login_events table (migration 087)
//   - AuthContext recording loop (records one event per session)
//   - stress-scoring-cron (consumes member_stress_signals)
//
// Schedule recommendation: daily at 04:00 UTC, AFTER:
//   stress-signal-collection-cron (02:00) and BEFORE
//   stress-scoring-cron (03:00)
// Actually 03:00 conflicts — recommend 04:00 for login-drop, then move
// scoring to 05:00 once Signals C/D are stable. For now, schedule below
// is independent of the scoring cron; the next scoring cron run picks up
// whatever signals exist.
//
// Deployment:
//   supabase functions deploy login-drop-cron --no-verify-jwt
//
// Schedule snippet (NOT auto-enabled):
//   SELECT cron.schedule(
//     'login-drop-collection-daily',
//     '0 4 * * *',
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/login-drop-cron',
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
    console.log("📉 Running collect_login_drop_signals...");
    const { data, error } = await supabase.rpc("collect_login_drop_signals");

    if (error) {
      console.error("[login-drop-cron] RPC error:", error);
      // Same try/catch pattern as the other engine crons — Supabase-js v2
      // .insert() is a thenable without .catch().
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "login-drop-cron",
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
      skipped_no_baseline: number;
      skipped_no_drop: number;
      skipped_below_threshold: number;
      skipped_dup: number;
      skipped_no_profile: number;
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      inserted: result.inserted,
      skipped_no_baseline: result.skipped_no_baseline,
      skipped_below_threshold: result.skipped_below_threshold,
      skipped_dup: result.skipped_dup,
    });

    // records_processed = inserted + all skip reasons. Users we considered.
    const processed =
      result.inserted +
      result.skipped_no_baseline +
      result.skipped_no_drop +
      result.skipped_below_threshold +
      result.skipped_dup +
      result.skipped_no_profile;

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "login-drop-cron",
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
        message: "Login drop signal collection completed",
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
