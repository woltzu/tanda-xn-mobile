// ═══════════════════════════════════════════════════════════════════════════
// mood-scoring-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(mood). Thin wrapper around process_member_mood()
// (migration 091). Runs the 5-signal scoring batch — for every member
// with analyzed messages in the last 14 days, ensures a baseline exists,
// computes drift across polarity/lexical/keyword/latency/length, INSERTs
// member_mood_snapshots, auto-creates mood_interventions for triggered
// members.
//
// Schedule recommendation: weekly Sunday 04:30 UTC, after mood-bridge-
// cron (daily 01:30) has populated member_messages with the week's new
// content. The engine's runWeeklyScoringBatch is weekly, not daily.
//
// Deployment:
//   supabase functions deploy mood-scoring-cron --no-verify-jwt
//
// Schedule snippet (NOT auto-enabled):
//   SELECT cron.schedule(
//     'mood-scoring-weekly',
//     '30 4 * * 0',     -- Sunday 04:30 UTC
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/mood-scoring-cron',
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
    console.log("😊 Running process_member_mood...");
    const { data, error } = await supabase.rpc("process_member_mood");

    if (error) {
      console.error("[mood-scoring-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "mood-scoring-cron",
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
      baselines_computed: number;
      skipped_no_baseline: number;
      skipped_no_recent: number;
      errors: string[];
      source: string;
      note: string;
    };

    console.log("✅ Done:", {
      scored: result.scored,
      interventions: result.interventions_created,
      baselines: result.baselines_computed,
    });

    const processed = result.scored + result.skipped_no_baseline + result.skipped_no_recent;
    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "mood-scoring-cron",
        status: result.errors.length === 0 ? "success" : "partial",
        records_processed: processed,
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
        message: "Mood scoring completed",
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
