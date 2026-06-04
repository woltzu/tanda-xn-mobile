// ═══════════════════════════════════════════════════════════════════════════
// graduated-entry-cron — Edge Function (Deno runtime)
//
// Phase D2 of feat(tier). Daily wrapper around the
// evaluate_all_member_tiers() PL/pgSQL function (migration 040 + 094
// patched). Re-evaluates every profile's tier and writes:
//   - member_tier_status (upserts current tier + denormalized limits)
//   - member_tier_history (audit row when tier changes)
//
// Why this cron exists (and isn't redundant with scoring-pipeline-daily):
//   Migration 040 wired tier evaluation as Step 7 of run_scoring_pipeline,
//   so in theory the existing scoring-pipeline-daily cron should run it.
//   In practice (per audit 35 and the empty member_tier_status table),
//   that cron's SQL command has been broken since at least March 2026 —
//   scoring_pipeline_runs hasn't grown in months. Until the scoring
//   pipeline is fixed, this standalone cron keeps tier evaluation alive.
//   When the scoring pipeline is fixed, this cron becomes mostly
//   redundant (the upsert pattern means double-runs are idempotent).
//
// Schedule recommendation: daily 06:00 UTC, AFTER the (currently broken)
// scoring-pipeline-daily at 03:00 — that way if/when scoring is fixed,
// today's XnScore changes get reflected in tier the same day.
//
// Deployment:
//   supabase functions deploy graduated-entry-cron --no-verify-jwt
//
// Schedule snippet (NOT auto-enabled):
//   SELECT cron.schedule(
//     'graduated-entry-daily',
//     '0 6 * * *',
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/graduated-entry-cron',
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
    console.log("🎖️ Running evaluate_all_member_tiers...");
    const { data, error } = await supabase.rpc("evaluate_all_member_tiers");

    if (error) {
      console.error("[graduated-entry-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "graduated-entry-cron",
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

    // evaluate_all_member_tiers returns INTEGER (member count). The
    // RPC client unwraps single scalars as the data value directly.
    const evaluatedCount: number = typeof data === "number" ? data : Number(data ?? 0);

    console.log("✅ Done:", { evaluated: evaluatedCount });

    // Pull the post-batch tier distribution so the cron log captures
    // the headline metric (how many members are in each tier today).
    let distribution: Record<string, number> = {};
    try {
      const { data: dist } = await supabase
        .from("member_tier_status")
        .select("current_tier");
      if (dist) {
        for (const row of dist as Array<{ current_tier: string }>) {
          distribution[row.current_tier] = (distribution[row.current_tier] ?? 0) + 1;
        }
      }
    } catch (distErr: any) {
      console.log("⚠️ Could not pull distribution:", distErr?.message);
    }

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "graduated-entry-cron",
        status: "success",
        records_processed: evaluatedCount,
        records_succeeded: evaluatedCount,
        records_failed: 0,
        execution_time_ms: Date.now() - startTime,
        details: {
          evaluated: evaluatedCount,
          distribution,
          source: "evaluate_all_member_tiers",
          note: "Patched in migration 094 to fall back to profiles.xn_score when xn_scores has no row.",
        },
      });
    } catch (logErr: any) {
      console.log("⚠️ Could not log job:", logErr?.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Graduated entry tier evaluation completed",
        evaluated: evaluatedCount,
        distribution,
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
