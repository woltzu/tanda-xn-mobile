// ══════════════════════════════════════════════════════════════════════════════
// hooks/useScoreHubBadge.ts — drives the colored dot on the HomeScreen
// Score Hub icon.
// ══════════════════════════════════════════════════════════════════════════════
//
// Why this hook exists:
//   The Score Hub icon used to be a flat glyph that gave the user no signal
//   about whether anything inside actually needed attention. The bucket A
//   "Open Score Hub" review identified this as the biggest discoverability
//   gap: the app already knows when stress goes red, mood drifts at-risk,
//   honor demotes to Novice, etc. — but until the user opened the hub,
//   they had no way to know.
//
// What this hook returns:
//   • urgency: 'critical' | 'attention' | 'none' — drives the dot color
//   • hasUrgentAlert: an in-bundle red/orange signal exists (drives a11y
//     copy "attention needed")
//   • hasUnreadInsight: there's an unread ai_insight or ai_weekly_digest
//     notification (drives "new insight available")
//   • unreadInsightCount: raw count if the caller wants to surface "N new"
//
// Data sources (zero new RPCs):
//   1. lib/scoreCache — populated by ScoreHubScreen on focus, read here.
//      Subscribed via subscribeToScoreCache so the badge updates the
//      moment the cache mutates (realtime score update inside ScoreHub
//      → realtime triggers loadScores → setCachedScoreBundle →
//      listeners fire → HomeScreen re-renders).
//   2. NotificationContext — already has a realtime subscription for the
//      user's notifications; we filter on type + read flag.
//
// Critical vs. attention thresholds match the hero-card priority order in
// ScoreHubScreen.pickHeroAlert():
//   critical:  stress_status='red' OR mood_tier='at_risk'
//   attention: stress_status='orange' OR mood_tier='disengaging' OR
//              honor_tier='Novice' OR xnscore<60 OR hasUnreadInsight
//
// Cold-cache behaviour: until the user opens ScoreHubScreen at least
// once in this session, the score bundle is null. The unread-insight
// path still drives 'attention' when applicable; an absence of cached
// scores is NOT treated as urgent — it just falls through to 'none'.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";
import {
  getCachedScoreBundle,
  subscribeToScoreCache,
} from "../lib/scoreCache";

export type ScoreHubUrgency = "critical" | "attention" | "none";

export type ScoreHubBadge = {
  hasUrgentAlert: boolean;
  hasUnreadInsight: boolean;
  urgency: ScoreHubUrgency;
  unreadInsightCount: number;
};

// Notification types that should drive the badge. Keep aligned with the
// SWEEPABLE_TYPES list in supabase/functions/ai-insight-notification.
const INSIGHT_NOTIFICATION_TYPES = new Set<string>([
  "ai_insight",
  "ai_weekly_digest",
]);

export function useScoreHubBadge(): ScoreHubBadge {
  const { user } = useAuth();
  const { notifications } = useNotifications();

  // Bump a counter when the cache mutates so the memo below recomputes.
  // We don't store the bundle in state because the cache itself is the
  // source of truth and may evict on TTL — we want to re-read it on
  // every notification batch too.
  const [cacheVersion, setCacheVersion] = useState(0);
  useEffect(() => {
    return subscribeToScoreCache(() => {
      setCacheVersion((v) => v + 1);
    });
  }, []);

  return useMemo<ScoreHubBadge>(() => {
    const userId = user?.id ?? null;
    const bundle = userId ? getCachedScoreBundle(userId) : null;

    // ── Critical band: red stress or at-risk mood ──
    const isCritical =
      bundle?.stress_status === "red" || bundle?.mood_tier === "at_risk";

    // ── Attention band: orange/disengaging/novice/low-xnscore ──
    const hasModerateAlert =
      bundle?.stress_status === "orange" ||
      bundle?.mood_tier === "disengaging" ||
      bundle?.honor_tier === "Novice" ||
      (bundle?.xnscore != null && bundle.xnscore < 60);

    // ── Unread AI insights ──
    let unreadInsightCount = 0;
    for (const n of notifications) {
      if (n.read) continue;
      if (INSIGHT_NOTIFICATION_TYPES.has(n.type)) {
        unreadInsightCount++;
      }
    }
    const hasUnreadInsight = unreadInsightCount > 0;

    const hasUrgentAlert = isCritical || hasModerateAlert;

    let urgency: ScoreHubUrgency = "none";
    if (isCritical) {
      urgency = "critical";
    } else if (hasModerateAlert || hasUnreadInsight) {
      urgency = "attention";
    }

    return {
      hasUrgentAlert,
      hasUnreadInsight,
      urgency,
      unreadInsightCount,
    };
    // cacheVersion is intentionally in the deps even though it isn't read
    // directly — it's how cache mutations propagate into this memo.
  }, [user?.id, notifications, cacheVersion]);
}
