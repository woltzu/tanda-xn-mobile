// ══════════════════════════════════════════════════════════════════════════════
// lib/scoreCache.ts — shared 5-minute score cache + subscribe API.
// ══════════════════════════════════════════════════════════════════════════════
//
// Extracted from screens/ScoreHubScreen.tsx as part of the "Open Score Hub"
// Bucket A entry-point signal work. Two consumers now share the same module-
// level cache:
//
//   1. screens/ScoreHubScreen.tsx — populates the cache via get_user_scores
//      RPC on mount/focus and reads from it on the next render.
//   2. hooks/useScoreHubBadge.ts — read-only consumer. The HomeScreen icon
//      uses this to flash a colored dot when something needs attention,
//      WITHOUT triggering a second RPC. If the cache is cold (user has
//      never opened the hub this session), the badge falls back to "no
//      urgent score" — the unread-insights path still drives attention.
//
// A tiny event-emitter (`subscribeToScoreCache`) lets the badge hook re-
// evaluate when the screen mutates the cache. Without this, the hook would
// only update when its other deps (auth user, notifications) churn — a
// real ScoreHubScreen → realtime update → bundle change would not show on
// HomeScreen until the next focus.
// ══════════════════════════════════════════════════════════════════════════════

export type StressStatus = "green" | "yellow" | "orange" | "red";
export type StressTrend = "improving" | "stable" | "worsening";
export type MoodTier = "stable" | "drifting" | "disengaging" | "at_risk";
export type MoodTrend = StressTrend;
export type HonorTier =
  | "Novice"
  | "Trusted"
  | "Respected"
  | "Elder"
  | "Grand Elder";

// Mirrors the get_user_scores RPC return shape (migration 144 + 156).
export type ScoreBundle = {
  xnscore: number | null;
  xnscore_tier: string | null;
  xnscore_delta: number | null;
  xnscore_previous: number | null;
  xnscore_7d_ago: number | null;
  xnscore_percentile: number | null;

  honor_score: number | null;
  honor_tier: string | null;
  honor_delta: number | null;
  honor_previous: number | null;
  honor_7d_ago: number | null;
  honor_percentile: number | null;

  stress_score: number | null;
  stress_status: StressStatus | null;
  stress_trend: StressTrend | null;
  stress_top_signal: string | null;
  stress_delta: number | null;
  stress_previous: number | null;
  stress_7d_ago: number | null;
  stress_percentile: number | null;

  mood_score: number | null;
  mood_tier: MoodTier | null;
  mood_trend: MoodTrend | null;
  mood_delta: number | null;
  mood_previous: number | null;
  mood_7d_ago: number | null;
  mood_percentile: number | null;

  last_updated: string | null;
};

export const SCORE_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  userId: string;
  data: ScoreBundle;
  fetchedAt: number;
};

let _cache: CacheEntry | null = null;
const _listeners = new Set<() => void>();

function _notify() {
  // Snapshot the listeners first — a listener that removes itself during
  // notify (e.g. component unmount inside the callback) would otherwise
  // mutate the Set we're iterating.
  for (const listener of Array.from(_listeners)) {
    try {
      listener();
    } catch (e) {
      console.warn("[scoreCache] listener threw:", (e as Error).message);
    }
  }
}

/**
 * Returns the cached bundle for the given user if present AND still fresh.
 * `null` on miss/expiry/owner-mismatch — callers should treat the absence
 * as "fetch via RPC" or "no urgent signal", depending on the consumer.
 */
export function getCachedScoreBundle(userId: string): ScoreBundle | null {
  if (!_cache) return null;
  if (_cache.userId !== userId) return null;
  if (Date.now() - _cache.fetchedAt >= SCORE_CACHE_TTL_MS) return null;
  return _cache.data;
}

/**
 * Writes a fresh bundle to the cache and notifies subscribers. Called by
 * ScoreHubScreen after a successful get_user_scores RPC.
 */
export function setCachedScoreBundle(userId: string, data: ScoreBundle): void {
  _cache = { userId, data, fetchedAt: Date.now() };
  _notify();
}

/**
 * Clears the cache and notifies subscribers. Used by the per-card retry
 * buttons on ScoreHubScreen and by the user-change reset path.
 */
export function clearScoreCache(): void {
  if (_cache === null) return;
  _cache = null;
  _notify();
}

/**
 * Subscribe to cache mutations. Returns an unsubscribe function. Used by
 * useScoreHubBadge so HomeScreen's icon dot reacts to score changes the
 * moment ScoreHubScreen's realtime/refetch path writes them — no extra
 * RPC, no focus event needed.
 */
export function subscribeToScoreCache(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
