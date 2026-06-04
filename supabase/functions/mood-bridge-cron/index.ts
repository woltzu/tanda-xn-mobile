// ═══════════════════════════════════════════════════════════════════════════
// mood-bridge-cron — Edge Function (Deno runtime)
//
// Phase D1 of feat(mood). Thin wrapper around the
// bridge_support_tickets_to_messages() PL/pgSQL RPC (migration 090).
//
// Scans support_tickets and inserts new ones into member_messages with
// channel='support_ticket' for downstream NLP analysis. The AFTER INSERT
// trigger on member_messages fires the mood-analyze-message EF for each
// new row.
//
// Why a separate bridge cron (instead of a trigger on support_tickets):
//   support_tickets is a foreign table from our perspective — we didn't
//   own its schema, can't audit all its writers. A pull-based daily cron
//   is more defensive than an ON INSERT trigger that would fire for any
//   admin tool or backfill that touches support_tickets. The cron is
//   idempotent (thread_id = ticket.id dedup) so it can run as often as
//   needed.
//
// Schedule recommendation: daily 01:30 UTC, before mood-scoring-cron at
// 04:30 UTC so today's tickets get analyzed AND scored same-day.
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
    console.log("🌉 Running bridge_support_tickets_to_messages...");
    const { data, error } = await supabase.rpc("bridge_support_tickets_to_messages");

    if (error) {
      console.error("[mood-bridge-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "mood-bridge-cron",
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
      skipped_no_profile: number;
      source: string;
      note: string;
    };

    console.log("✅ Done:", result);

    const processed = result.inserted + result.skipped_dup + result.skipped_no_profile;
    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "mood-bridge-cron",
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
        message: "Mood source bridge completed",
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
