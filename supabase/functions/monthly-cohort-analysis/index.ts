// ===========================================================================
// monthly-cohort-analysis — Edge Function (Deno runtime)
//
// CronAIJobEngine job #6 of #191. Runs on the 2nd of each month at 06:00 UTC.
//
// What it does:
//   1. Loads every profiles row (id, xn_score, created_at, country, referred_by).
//   2. Groups members into three cohort dimensions:
//        - join_date     → "YYYY-QN" (calendar quarter the account was created)
//        - geography     → lowercased `country` ('unknown' fallback)
//        - referral_source → 'referred' if referred_by is set, else 'organic'
//   3. For every cohort, computes:
//        member_count, active_member_count, retention/churn,
//        avg/median xnscore, default_rate, circles_joined / completed /
//        completion_rate, score-bucket histogram.
//   4. Upserts to cohort_analytics with the natural key
//        (cohort_type, cohort_label, period_start, period_end)
//      — period_start is the 1st of the prior calendar month, period_end is
//      the 1st of the current month, so the row is "the month that just
//      ended". Re-running the same day idempotently overwrites.
//   5. Always writes a cron_job_logs row (status / records / runtime).
//
// Mirrors CronAIJobEngine.runCohortAnalysis + _computeCohortMetrics
// (services/CronAIJobEngine.ts).
//
// Deployment:
//   supabase functions deploy monthly-cohort-analysis --no-verify-jwt
//
// Schedule (migration 113): 2nd of month at 06:00 UTC.
// ===========================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOB_NAME = "monthly-cohort-analysis";

type Profile = {
  id: string;
  xn_score: number | null;
  created_at: string;
  country: string | null;
  referred_by: string | null;
};

type CohortMetrics = {
  member_count: number;
  active_member_count: number;
  retention_rate: number;
  churn_rate: number;
  avg_xnscore: number;
  median_xnscore: number;
  default_rate: number;
  avg_contribution_amount_cents: number;
  circles_joined: number;
  circles_completed: number;
  circle_completion_rate: number;
  metrics: Record<string, unknown>;
};

function scoreBuckets(scores: number[]): Record<string, number> {
  return {
    emerging_0_39: scores.filter((s) => s < 40).length,
    building_40_59: scores.filter((s) => s >= 40 && s < 60).length,
    trusted_60_74: scores.filter((s) => s >= 60 && s < 75).length,
    established_75_89: scores.filter((s) => s >= 75 && s < 90).length,
    elder_90_100: scores.filter((s) => s >= 90).length,
  };
}

async function computeCohortMetrics(
  supabase: SupabaseClient,
  memberIds: string[],
  profiles: Profile[],
): Promise<CohortMetrics> {
  const scores = profiles.map((p) => p.xn_score ?? 0).sort((a, b) => a - b);
  const avgXnscore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const medianXnscore = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0;

  // Active members
  const { data: activeMembers } = await supabase
    .from("circle_members")
    .select("user_id")
    .in("user_id", memberIds)
    .eq("status", "active");

  const activeMemberCount = new Set((activeMembers ?? []).map((m) => m.user_id)).size;

  // Defaults vs total contributions
  const { count: defaultCount } = await supabase
    .from("cycle_contributions")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds)
    .eq("status", "missed");

  const { count: totalContribCount } = await supabase
    .from("cycle_contributions")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds);

  const defaultRate =
    (totalContribCount ?? 0) > 0 ? (defaultCount ?? 0) / (totalContribCount ?? 1) : 0;

  // Circle participation
  const { count: circlesJoined } = await supabase
    .from("circle_members")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds);

  const { count: circlesCompleted } = await supabase
    .from("circle_members")
    .select("id", { count: "exact", head: true })
    .in("user_id", memberIds)
    .eq("status", "inactive");

  const circleCompletionRate =
    (circlesJoined ?? 0) > 0 ? (circlesCompleted ?? 0) / (circlesJoined ?? 1) : 0;

  const retentionRate = memberIds.length > 0 ? activeMemberCount / memberIds.length : 0;

  return {
    member_count: memberIds.length,
    active_member_count: activeMemberCount,
    retention_rate: Math.round(retentionRate * 10000) / 10000,
    churn_rate: Math.round((1 - retentionRate) * 10000) / 10000,
    avg_xnscore: Math.round(avgXnscore * 100) / 100,
    median_xnscore: Math.round(medianXnscore * 100) / 100,
    default_rate: Math.round(defaultRate * 10000) / 10000,
    avg_contribution_amount_cents: 0,
    circles_joined: circlesJoined ?? 0,
    circles_completed: circlesCompleted ?? 0,
    circle_completion_rate: Math.round(circleCompletionRate * 10000) / 10000,
    metrics: { scoreBuckets: scoreBuckets(scores) },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  const errors: string[] = [];
  let cohortsProcessed = 0;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Period: "the month that just ended" — start = 1st of prior month,
  // end = 1st of current month. Same value for every cohort row this run.
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(periodEnd);
  periodStart.setUTCMonth(periodStart.getUTCMonth() - 1);
  const periodStartStr = periodStart.toISOString().split("T")[0];
  const periodEndStr = periodEnd.toISOString().split("T")[0];

  try {
    const { data: allProfiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, xn_score, created_at, country, referred_by");

    if (profilesErr) throw new Error(`load profiles: ${profilesErr.message}`);
    const profiles = (allProfiles ?? []) as Profile[];

    // -- Cohort 1: join_date (YYYY-QN) ----------------------------------─
    const quarterCohorts = new Map<string, Profile[]>();
    for (const p of profiles) {
      const d = new Date(p.created_at);
      const q = `${d.getUTCFullYear()}-Q${Math.ceil((d.getUTCMonth() + 1) / 3)}`;
      if (!quarterCohorts.has(q)) quarterCohorts.set(q, []);
      quarterCohorts.get(q)!.push(p);
    }

    for (const [label, cohortMembers] of quarterCohorts) {
      try {
        const memberIds = cohortMembers.map((m) => m.id);
        const metrics = await computeCohortMetrics(supabase, memberIds, cohortMembers);

        const { error: upErr } = await supabase.from("cohort_analytics").upsert(
          {
            cohort_type: "join_date",
            cohort_label: label,
            period_start: periodStartStr,
            period_end: periodEndStr,
            ...metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "cohort_type,cohort_label,period_start,period_end" },
        );

        if (upErr) throw new Error(upErr.message);
        cohortsProcessed++;
      } catch (err) {
        errors.push(`join_date/${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // -- Cohort 2: geography (country) ----------------------------------─
    const geoCohorts = new Map<string, Profile[]>();
    for (const p of profiles) {
      const key = (p.country ?? "unknown").toLowerCase();
      if (!geoCohorts.has(key)) geoCohorts.set(key, []);
      geoCohorts.get(key)!.push(p);
    }

    for (const [label, cohortMembers] of geoCohorts) {
      try {
        const memberIds = cohortMembers.map((m) => m.id);
        const metrics = await computeCohortMetrics(supabase, memberIds, cohortMembers);

        const { error: upErr } = await supabase.from("cohort_analytics").upsert(
          {
            cohort_type: "geography",
            cohort_label: label,
            period_start: periodStartStr,
            period_end: periodEndStr,
            ...metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "cohort_type,cohort_label,period_start,period_end" },
        );

        if (upErr) throw new Error(upErr.message);
        cohortsProcessed++;
      } catch (err) {
        errors.push(`geography/${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // -- Cohort 3: referral_source (referred|organic) --------------------
    const refCohorts = new Map<string, Profile[]>();
    for (const p of profiles) {
      const key = p.referred_by ? "referred" : "organic";
      if (!refCohorts.has(key)) refCohorts.set(key, []);
      refCohorts.get(key)!.push(p);
    }

    for (const [label, cohortMembers] of refCohorts) {
      try {
        const memberIds = cohortMembers.map((m) => m.id);
        const metrics = await computeCohortMetrics(supabase, memberIds, cohortMembers);

        const { error: upErr } = await supabase.from("cohort_analytics").upsert(
          {
            cohort_type: "referral_source",
            cohort_label: label,
            period_start: periodStartStr,
            period_end: periodEndStr,
            ...metrics,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "cohort_type,cohort_label,period_start,period_end" },
        );

        if (upErr) throw new Error(upErr.message);
        cohortsProcessed++;
      } catch (err) {
        errors.push(`referral_source/${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const status =
      errors.length === 0 ? "success" : cohortsProcessed > 0 ? "partial" : "failed";

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status,
      records_processed: cohortsProcessed,
      records_succeeded: cohortsProcessed,
      records_failed: errors.length,
      execution_time_ms: Date.now() - startTime,
      details: {
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        cohortsProcessed,
        profileCount: profiles.length,
        quarterCohorts: quarterCohorts.size,
        geoCohorts: geoCohorts.size,
        refCohorts: refCohorts.size,
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
        cohortsProcessed,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        runtimeMs: Date.now() - startTime,
        errorCount: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    await supabase.from("cron_job_logs").insert({
      job_name: JOB_NAME,
      status: "failed",
      records_processed: cohortsProcessed,
      records_succeeded: cohortsProcessed,
      records_failed: 1,
      execution_time_ms: Date.now() - startTime,
      details: { fatalError: msg, periodStart: periodStartStr, periodEnd: periodEndStr },
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
