// ===========================================================================
// weekly-model-performance-check — Edge Function (Deno runtime)
//
// CronAIJobEngine job #4 of #191. Runs Sunday 05:00 UTC weekly.
//
// What it does:
//   1. Loads default_probability_history rows predicted ~30 days ago
//      (window: now-35d to now-25d to allow ±5d slack).
//   2. Deduplicates to the latest prediction per user inside that window.
//   3. For each predicted user, checks whether they actually defaulted
//      (= any cycle_contributions row with status='missed' since the
//      window end).
//   4. Computes TP/TN/FP/FN (predictedDefault = probability >= 0.30) →
//      accuracy / precision / recall / f1.
//   5. Compares this run's accuracy to the previous model_performance_logs
//      row for model_name='default_probability'. Drift severity:
//        |Δ| > 0.15 → severe, > 0.10 → moderate, > 0.05 → minor.
//   6. INSERTs the evaluation row into model_performance_logs.
//   7. On moderate/severe drift, INSERTs a model_drift score_alerts row
//      (target_id = system sentinel 00000000-...).
//   8. Always INSERTs a cron_job_logs row (status/records/runtime/details).
//
// Mirrors CronAIJobEngine.runModelPerformanceCheck (services/CronAIJobEngine.ts)
// so the engine method and this cron-driven EF produce equivalent rows.
//
// Deployment:
//   supabase functions deploy weekly-model-performance-check --no-verify-jwt
//
// Schedule (migration 113): Sunday 05:00 UTC
// ===========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "weekly-model-performance-check";
const BATCH_SIZE = 100;
const PREDICT_THRESHOLD = 0.30;

type DriftSeverity = "none" | "minor" | "moderate" | "severe";

function resolveDrift(delta: number): DriftSeverity {
  const abs = Math.abs(delta);
  if (abs > 0.15) return "severe";
  if (abs > 0.10) return "moderate";
  if (abs > 0.05) return "minor";
  return "none";
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Window: predictions made ~30 days ago, ±5d
  const windowStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // -- Step 1: load predictions in window ------------------------------
    const { data: predictions, error: predErr } = await supabase
      .from("default_probability_history")
      .select("user_id, probability, risk_bucket, computed_at")
      .gte("computed_at", windowStart)
      .lte("computed_at", windowEnd);

    if (predErr) throw new Error(`load predictions: ${predErr.message}`);

    const predictionList = predictions ?? [];

    // No predictions case: write a no-op evaluation log + cron log, exit.
    if (predictionList.length === 0) {
      await supabase.from("model_performance_logs").insert({
        model_name: "default_probability",
        model_version: "rule-v1",
        prediction_window_days: 30,
        predictions_evaluated: 0,
        drift_severity: "none",
        details: { reason: "No predictions in evaluation window", windowStart, windowEnd },
      });

      await supabase.from("cron_job_logs").insert({
        job_name: JOB_NAME,
        status: "success",
        records_processed: 0,
        records_succeeded: 0,
        records_failed: 0,
        execution_time_ms: Date.now() - startTime,
        details: { noPredictions: true, windowStart, windowEnd },
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, jobName: JOB_NAME, predictions: 0, noPredictions: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -- Step 2: dedupe to latest per user ------------------------------─
    const latestByUser = new Map<string, { probability: number; risk_bucket: string }>();
    for (const p of predictionList) {
      const prev = latestByUser.get(p.user_id);
      // Engine semantics: any prediction in window — taking the last seen
      // is fine because the window is narrow (10 days).
      latestByUser.set(p.user_id, {
        probability: typeof p.probability === "string" ? parseFloat(p.probability) : p.probability,
        risk_bucket: p.risk_bucket,
      });
      void prev;
    }

    // -- Step 3: count actual outcomes ----------------------------------─
    let tp = 0, tn = 0, fp = 0, fn = 0;

    const userIds = Array.from(latestByUser.keys());
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      for (const userId of batch) {
        try {
          const prediction = latestByUser.get(userId)!;
          const predictedDefault = prediction.probability >= PREDICT_THRESHOLD;

          const { count: missedCount, error: cntErr } = await supabase
            .from("cycle_contributions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("status", "missed")
            .gte("created_at", windowEnd);

          if (cntErr) throw new Error(cntErr.message);

          const actualDefault = (missedCount ?? 0) > 0;

          if (predictedDefault && actualDefault) tp++;
          else if (!predictedDefault && !actualDefault) tn++;
          else if (predictedDefault && !actualDefault) fp++;
          else fn++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`user ${userId}: ${msg}`);
        }
      }
    }

    const total = tp + tn + fp + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    // -- Step 4: drift detection vs previous run ------------------------─
    const { data: prevEval } = await supabase
      .from("model_performance_logs")
      .select("accuracy_score")
      .eq("model_name", "default_probability")
      .order("evaluation_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevAccuracy = prevEval ? parseFloat(prevEval.accuracy_score as unknown as string) : accuracy;
    const accuracyDelta = accuracy - prevAccuracy;
    const driftSeverity = resolveDrift(accuracyDelta);
    const driftDetected = driftSeverity !== "none";

    // -- Step 5: write evaluation log ------------------------------------
    await supabase.from("model_performance_logs").insert({
      model_name: "default_probability",
      model_version: "rule-v1",
      prediction_window_days: 30,
      predictions_evaluated: total,
      correct_predictions: tp + tn,
      accuracy_score: Math.round(accuracy * 10000) / 10000,
      precision_score: Math.round(precision * 10000) / 10000,
      recall_score: Math.round(recall * 10000) / 10000,
      f1_score: Math.round(f1 * 10000) / 10000,
      true_positives: tp,
      true_negatives: tn,
      false_positives: fp,
      false_negatives: fn,
      accuracy_delta: Math.round(accuracyDelta * 10000) / 10000,
      drift_detected: driftDetected,
      drift_severity: driftSeverity,
      details: {
        windowStart,
        windowEnd,
        previousAccuracy: prevAccuracy,
        predictionsLoaded: predictionList.length,
        dedupedUsers: userIds.length,
        errorCount: errors.length,
      },
    });

    // -- Step 6: alert on moderate/severe drift --------------------------
    if (driftDetected && (driftSeverity === "moderate" || driftSeverity === "severe")) {
      await supabase.from("score_alerts").insert({
        alert_type: "model_drift",
        target_type: "member",
        // Sentinel UUID — system-level alert, not member-targeted.
        target_id: "00000000-0000-0000-0000-000000000000",
        severity: driftSeverity === "severe" ? "critical" : "warning",
        context: {
          modelName: "default_probability",
          accuracy,
          accuracyDelta,
          driftSeverity,
          windowStart,
          windowEnd,
        },
      });
    }

    // -- Step 7: cron_job_logs ------------------------------------------─
    const status =
      errors.length === 0 ? "success" : errors.length < total * 0.5 ? "partial" : "failed";

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status,
      records_processed: total,
      records_succeeded: tp + tn,
      records_failed: fp + fn,
      execution_time_ms: Date.now() - startTime,
      details: {
        accuracy,
        precision,
        recall,
        f1,
        tp,
        tn,
        fp,
        fn,
        driftDetected,
        driftSeverity,
        windowStart,
        windowEnd,
        errorCount: errors.length,
      },
      error_message: errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobName: JOB_NAME,
        status,
        predictionsEvaluated: total,
        accuracy,
        driftDetected,
        driftSeverity,
        runtimeMs: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Best-effort fail log
    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status: "failed",
      records_processed: 0,
      records_succeeded: 0,
      records_failed: 0,
      execution_time_ms: Date.now() - startTime,
      details: { fatalError: msg, windowStart, windowEnd },
      error_message: msg,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
