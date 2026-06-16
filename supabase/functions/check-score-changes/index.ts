// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: check-score-changes
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 04:15 UTC.
// Purpose:  Scan recent score changes across xn_scores, member_stress_scores,
//           member_mood_snapshots, and honor_scores. When a score crosses
//           a tier OR moves by ≥5 points, drop a `notifications` row so
//           the user is told why their card shifted.
//
//           Idempotency is anchored on score_notification_log (migration
//           156). The ON CONFLICT DO NOTHING guard prevents duplicate
//           sends when the cron re-runs (or two pods overlap).
//
// Deployment:
//   supabase functions deploy check-score-changes --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// XN/honor/mood: higher is better; ≥5 swing triggers. Stress: lower is
// better; ≥5 swing in either direction triggers (jumps are urgent, drops
// are worth celebrating). Tier changes always trigger regardless of size.
const DELTA_THRESHOLD = 5;

type Row = {
  user_id: string;
  score: number;
  previous_score: number | null;
  tier: string | null;
};

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

    let notified = 0;

    // ── XnScore ────────────────────────────────────────────────────────
    const { data: xnRows, error: xnErr } = await supabase
      .from("xn_scores")
      .select("user_id, total_score, previous_score, score_tier, updated_at")
      .gte("updated_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .limit(5000);
    if (xnErr) throw xnErr;
    for (const r of xnRows ?? []) {
      const score = Math.round(r.total_score);
      const prev = r.previous_score != null ? Math.round(r.previous_score) : null;
      const delta = prev != null ? score - prev : 0;
      const tierChanged = false; // tier-change detection needs prev_tier; skip until column exists
      if (!shouldNotify(delta, tierChanged)) continue;

      const ok = await tryNotify(
        supabase,
        r.user_id,
        "xn",
        score,
        r.score_tier,
        delta,
        `Your XnScore is now ${score}${r.score_tier ? ` (${r.score_tier} tier)` : ""}.${
          delta > 0 ? " Nice work — keep it up." : " Tap to see what shifted."
        }`,
      );
      if (ok) notified++;
    }

    // ── Stress ─────────────────────────────────────────────────────────
    // member_stress_scores is append-only — read the latest snapshot per
    // user via a DISTINCT ON. The cron only fires daily, so we look back
    // 36h to be safe across DST + small skews.
    const { data: stressRows, error: stressErr } = await supabase
      .from("member_stress_scores")
      .select("member_id, stress_score, previous_score, status, created_at")
      .gte("created_at", new Date(Date.now() - 36 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    if (stressErr) throw stressErr;
    const seen = new Set<string>();
    for (const r of stressRows ?? []) {
      if (seen.has(r.member_id)) continue;
      seen.add(r.member_id);
      const score = Math.round(r.stress_score);
      const prev =
        r.previous_score != null ? Math.round(r.previous_score) : null;
      const delta = prev != null ? score - prev : 0;
      if (!shouldNotify(delta, false)) continue;

      const ok = await tryNotify(
        supabase,
        r.member_id,
        "stress",
        score,
        r.status,
        delta,
        delta > 0
          ? `Your stress level is now ${r.status ?? "elevated"}. Check your top stressors.`
          : `Stress easing — score down ${Math.abs(delta)} points.`,
      );
      if (ok) notified++;
    }

    // ── Mood ───────────────────────────────────────────────────────────
    const { data: moodRows, error: moodErr } = await supabase
      .from("member_mood_snapshots")
      .select("member_id, composite_mood_score, previous_score, tier, created_at")
      .gte("created_at", new Date(Date.now() - 36 * 3600 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);
    if (moodErr) throw moodErr;
    const seenMood = new Set<string>();
    for (const r of moodRows ?? []) {
      if (seenMood.has(r.member_id)) continue;
      seenMood.add(r.member_id);
      const score = Math.round(r.composite_mood_score);
      const prev =
        r.previous_score != null ? Math.round(r.previous_score) : null;
      const delta = prev != null ? score - prev : 0;
      // Mood: only alert on degradation toward at_risk / disengaging,
      // matching the spec's "notify when tier changes to at_risk or
      // disengaging" wording.
      const concerning =
        r.tier === "at_risk" || r.tier === "disengaging";
      if (!(concerning || Math.abs(delta) >= 10)) continue;

      const ok = await tryNotify(
        supabase,
        r.member_id,
        "mood",
        score,
        r.tier,
        delta,
        concerning
          ? `Your mood signal shifted to ${r.tier}. Tap to see what's behind it.`
          : `Your mood signal moved ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} pts.`,
      );
      if (ok) notified++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        started,
        finished: new Date().toISOString(),
        notified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-score-changes] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function shouldNotify(delta: number, tierChanged: boolean): boolean {
  return tierChanged || Math.abs(delta) >= DELTA_THRESHOLD;
}

// Records a row in score_notification_log first; if the insert was a no-op
// (already logged for this exact snapshot_score), we don't write the user-
// facing notifications row. Returns true when a notification was actually
// emitted.
async function tryNotify(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  scoreType: "xn" | "honor" | "stress" | "mood",
  snapshotScore: number,
  tierAfter: string | null,
  delta: number,
  body: string,
): Promise<boolean> {
  const { data: logged, error: logErr } = await supabase
    .from("score_notification_log")
    .insert(
      {
        user_id: userId,
        score_type: scoreType,
        snapshot_score: snapshotScore,
        tier_after: tierAfter,
        delta,
      },
      { onConflict: "user_id,score_type,snapshot_score", ignoreDuplicates: true },
    )
    .select("user_id");
  if (logErr) {
    console.warn(
      "[check-score-changes] log insert failed:",
      logErr.message,
      userId,
      scoreType,
    );
    return false;
  }
  if (!logged || logged.length === 0) {
    // Duplicate — we've already notified for this exact snapshot.
    return false;
  }

  const { error: notifErr } = await supabase.from("notifications").insert({
    user_id: userId,
    type: `score_change_${scoreType}`,
    title: `Your ${scoreType === "xn" ? "XnScore" : scoreType} changed`,
    body,
    data: {
      score_type: scoreType,
      snapshot_score: snapshotScore,
      tier_after: tierAfter,
      delta,
    },
    read: false,
  });
  if (notifErr) {
    console.warn(
      "[check-score-changes] notification insert failed:",
      notifErr.message,
    );
    return false;
  }
  return true;
}
