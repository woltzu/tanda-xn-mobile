// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: ai-weekly-digest
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Weekly per-user roll-up of `ai_decisions` activity.
//
// Why this exists alongside the per-decision trigger:
//   Migration 187 fires one push per AI decision via the notify_ai_insight
//   trigger + ai-insight-notification dispatcher. That's the right
//   cadence for big single events (tier moves, liquidity denials), but
//   noisy for a user racking up a dozen XnScore deltas across a week.
//   This function adds a digest: once a week per user, group the past
//   7 days by decision_type bucket and post a single summary row of
//   type `ai_weekly_digest`. The same ai-insight-notification EF picks
//   that row up on its next sweep and pushes it via Expo (the
//   dispatcher filters on type IN ('ai_insight','ai_weekly_digest')).
//
// Buckets:
//   • Score updates   — xnscore_*, honor_score_change, stress_score_change, mood_drift_change
//   • Tier changes    — tier_advancement, tier_demotion
//   • Alerts          — intervention_message
//   • Rejected requests — circle_join_rejection, liquidity_denial
//   • Payout positions — payout_position (queued for the future trigger)
//
// Idempotency:
//   `profiles.last_digest_sent_at` (added in migration 187) holds the
//   last successful digest time. We skip any user whose marker is
//   newer than `now() - 7 days`. The marker advances ONLY after the
//   notifications row lands, so a failed insert is retried next run.
//
// Schedule:
//   Weekly via pg_cron, recommended Monday 08:00 UTC. Mid-morning UTC
//   covers EU + East Africa working hours; West Africa wakes to the
//   notification around mid-morning local.
//
// Deployment:
//   supabase functions deploy ai-weekly-digest --no-verify-jwt
//
//   To schedule:
//     SELECT cron.schedule(
//       'ai-weekly-digest', '0 8 * * 1',
//       $$SELECT net.http_post(url:='https://<ref>.supabase.co/functions/v1/ai-weekly-digest', ...);$$
//     );
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// decision_type → bucket. Keep extensible: when payout_position triggers
// finally land, the bucket is already wired.
const TYPE_BUCKET: Record<string, "score" | "tier" | "alert" | "rejection" | "position"> = {
  xnscore_increase: "score",
  xnscore_decrease: "score",
  honor_score_change: "score",
  stress_score_change: "score",
  mood_drift_change: "score",
  tier_advancement: "tier",
  tier_demotion: "tier",
  intervention_message: "alert",
  circle_join_rejection: "rejection",
  liquidity_denial: "rejection",
  payout_position: "position",
};

function pluralize(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

function buildDigestBody(counts: Record<string, number>): string | null {
  const parts: string[] = [];
  if (counts.score > 0) parts.push(pluralize(counts.score, "score update", "score updates"));
  if (counts.tier > 0) parts.push(pluralize(counts.tier, "tier change", "tier changes"));
  if (counts.alert > 0) parts.push(pluralize(counts.alert, "alert", "alerts"));
  if (counts.rejection > 0)
    parts.push(pluralize(counts.rejection, "rejected request", "rejected requests"));
  if (counts.position > 0)
    parts.push(pluralize(counts.position, "payout update", "payout updates"));
  if (parts.length === 0) return null;
  return `You had ${parts.join(", ")} this week. Tap to see more.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const started = new Date().toISOString();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cutoff = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    // 1. Candidate users: anyone with ≥1 ai_decisions in the last 7 days.
    //    Bounded scan; deduped client-side because Supabase's `distinct`
    //    on REST is awkward.
    const { data: activity, error: actErr } = await supabase
      .from("ai_decisions")
      .select("member_id")
      .gte("created_at", cutoff);
    if (actErr) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage: "candidate_scan",
          error: actErr.message,
          started,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const candidateIds = Array.from(
      new Set((activity ?? []).map((r) => (r as { member_id: string }).member_id)),
    );

    let inserted = 0;
    const skipped: Array<{ id: string; reason: string }> = [];

    for (const userId of candidateIds) {
      // 2. Idempotency: skip users whose last digest is newer than 7 days.
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("last_digest_sent_at")
        .eq("id", userId)
        .maybeSingle();
      if (profErr) {
        skipped.push({ id: userId, reason: `profile_${profErr.code ?? "err"}` });
        continue;
      }
      const last = (prof as { last_digest_sent_at?: string | null } | null)
        ?.last_digest_sent_at;
      if (last && new Date(last) > new Date(cutoff)) {
        skipped.push({ id: userId, reason: "already_sent_this_week" });
        continue;
      }

      // 3. Fetch the user's recent decisions and bucket them.
      const { data: decisions, error: decErr } = await supabase
        .from("ai_decisions")
        .select("decision_type, rendered_explanation, created_at")
        .eq("member_id", userId)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false });
      if (decErr) {
        skipped.push({ id: userId, reason: `decisions_${decErr.code ?? "err"}` });
        continue;
      }
      if (!decisions || decisions.length === 0) {
        skipped.push({ id: userId, reason: "no_decisions" });
        continue;
      }

      const counts: Record<string, number> = {
        score: 0,
        tier: 0,
        alert: 0,
        rejection: 0,
        position: 0,
      };
      for (const d of decisions as Array<{ decision_type: string }>) {
        const bucket = TYPE_BUCKET[d.decision_type];
        if (bucket) counts[bucket]++;
      }

      const body = buildDigestBody(counts);
      if (!body) {
        skipped.push({ id: userId, reason: "empty_body" });
        continue;
      }

      // 4. Insert the digest notification + advance the idempotency marker.
      //    We advance the marker only on successful insert so a failure
      //    means next run retries.
      const latest = decisions[0] as { rendered_explanation: string };
      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "ai_weekly_digest",
        title: "Your weekly AI insights",
        body,
        data: {
          counts,
          window_start: cutoff,
          window_end: started,
          latest_explanation: latest.rendered_explanation,
        },
      });
      if (insErr) {
        skipped.push({ id: userId, reason: `insert_${insErr.code ?? "err"}` });
        continue;
      }
      const { error: stampErr } = await supabase
        .from("profiles")
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq("id", userId);
      if (stampErr) {
        console.warn(
          `[ai-weekly-digest] failed to stamp last_digest_sent_at on ${userId}: ${stampErr.message}`,
        );
      }
      inserted++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        started,
        finished: new Date().toISOString(),
        candidates: candidateIds.length,
        inserted,
        skipped: skipped.length,
        skipped_breakdown: skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        stage: "exception",
        error: (e as Error)?.message ?? "unknown",
        started,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
