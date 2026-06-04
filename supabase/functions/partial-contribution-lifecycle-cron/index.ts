// ═══════════════════════════════════════════════════════════════════════════
// partial-contribution-lifecycle-cron — Edge Function (Deno runtime)
//
// Phase D3 of feat(partial). Thin wrapper around the
// process_partial_contribution_lifecycle() PL/pgSQL RPC (migration 103).
// Runs two idempotent batches in one transaction:
//   1. Paid catch-up sync — finds cycle_contributions where
//      contribution_type='catch_up' AND contribution_status='paid' whose
//      plan schedule item isn't yet 'paid', updates the schedule item,
//      recomputes remaining/paid totals, and completes the plan if all
//      items are paid.
//   2. Missed-catchup defaults — finds past-due unpaid catch-ups,
//      marks the schedule item 'defaulted', and if every non-paid item
//      is defaulted, flips the plan to 'defaulted' + notifies the member
//      and circle admins via notification_queue.
//
// Logs aggregate counts to cron_job_logs.
//
// Schedule recommendation: daily at 02:00 UTC. Catch-ups are due_date-bound
// (typically 14–30 day cycles), so daily is plenty. NOT auto-enabled —
// snippet only.
//
// Deployment:
//   supabase functions deploy partial-contribution-lifecycle-cron --no-verify-jwt
//
// Schedule snippet:
//   SELECT cron.schedule(
//     'partial-contribution-lifecycle-daily',
//     '0 2 * * *',         -- daily 02:00 UTC
//     $$ SELECT net.http_post(
//          url := 'https://<ref>.supabase.co/functions/v1/partial-contribution-lifecycle-cron',
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
    console.log("🪙 Running process_partial_contribution_lifecycle...");
    const { data, error } = await supabase.rpc(
      "process_partial_contribution_lifecycle",
    );

    if (error) {
      console.error("[partial-contribution-lifecycle-cron] RPC error:", error);
      try {
        await supabase.from("cron_job_logs").insert({
          job_name: "partial-contribution-lifecycle-cron",
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = data as {
      success: boolean;
      paid_catchups_synced: number;
      missed_catchups_defaulted: number;
      plans_completed: number;
      plans_defaulted: number;
      errors: Array<{
        batch: string;
        plan_id: string;
        contribution_id: string;
        error: string;
      }>;
      source: string;
      note: string;
    };

    const totalProcessed =
      result.paid_catchups_synced + result.missed_catchups_defaulted;
    const errorsCount = Array.isArray(result.errors) ? result.errors.length : 0;

    console.log("✅ Done:", {
      paid_synced: result.paid_catchups_synced,
      missed_defaulted: result.missed_catchups_defaulted,
      plans_completed: result.plans_completed,
      plans_defaulted: result.plans_defaulted,
      errors: errorsCount,
    });

    try {
      await supabase.from("cron_job_logs").insert({
        job_name: "partial-contribution-lifecycle-cron",
        status: errorsCount === 0 ? "success" : "partial",
        records_processed: totalProcessed,
        records_succeeded: totalProcessed - errorsCount,
        records_failed: errorsCount,
        execution_time_ms: Date.now() - startTime,
        details: {
          paid_catchups_synced: result.paid_catchups_synced,
          missed_catchups_defaulted: result.missed_catchups_defaulted,
          plans_completed: result.plans_completed,
          plans_defaulted: result.plans_defaulted,
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
        message: "Partial contribution lifecycle batch completed",
        result,
        processing_time_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("💥 Fatal:", err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
