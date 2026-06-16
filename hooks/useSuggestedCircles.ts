// hooks/useSuggestedCircles.ts
// ─────────────────────────────────────────────────────────────────────────────
// Real public-circle suggestions for a user with no circles yet, used
// by Dashboard's empty state (P2 of the first-launch onboarding review).
//
// Query strategy (adapted to live circles schema):
//   status        = 'active'                              ← still accepting
//   current_members >= 3                                  ← some traction
//   current_members < member_count                        ← not full yet
//   min_score IS NULL OR min_score <= userScore           ← user qualifies
//   community_id IS NULL                                  ← public-ish
//                                                          (not gated to
//                                                          a specific
//                                                          community)
//
// The original brief proposed `join_type = 'public'`, `member_limit`,
// `xn_score_floor` — none of those columns exist. Substituting the
// closest equivalents on the live schema.
//
// Client-side: exclude circles whose id is already in the user's
// myCircles list. The list is passed as `excludeIds` so the hook is
// decoupled from CirclesContext (caller threads it).
//
// Caching: module-scope Map keyed by `${userId}|${userScore}` with a
// 5-minute TTL. Re-mounts of Dashboard reuse the cached result; the
// query only re-fires when the cache expires or the user's xnScore
// changes.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useXnScore } from "../context/XnScoreContext";

export type SuggestedCircle = {
  id: string;
  name: string;
  amount: number;
  currency: string | null;
  frequency: string;
  emoji: string | null;
  current_members: number;
  member_count: number;
  min_score: number | null;
  invite_code: string | null;
};

type CacheEntry = { rows: SuggestedCircle[]; expiresAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function useSuggestedCircles(opts?: {
  excludeIds?: string[];
  enabled?: boolean;
}): {
  suggestions: SuggestedCircle[];
  loading: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const { score } = useXnScore();
  const userId = user?.id ?? null;
  const userScore = typeof score === "number" ? score : 0;
  const enabled = opts?.enabled ?? true;
  const excludeIds = opts?.excludeIds ?? [];

  const cacheKey = userId ? `${userId}|${userScore}` : null;

  const [suggestions, setSuggestions] = useState<SuggestedCircle[]>(() => {
    if (!cacheKey) return [];
    const hit = cache.get(cacheKey);
    return hit && hit.expiresAt > Date.now() ? hit.rows : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!enabled || !cacheKey) return false;
    const hit = cache.get(cacheKey);
    return !(hit && hit.expiresAt > Date.now());
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !cacheKey) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now()) {
      setSuggestions(hit.rows);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // Fetch a small over-pull (5) so client-side exclusion still
        // has a chance of returning 3.
        const { data, error: e } = await supabase
          .from("circles")
          .select(
            "id, name, amount, currency, frequency, emoji, current_members, member_count, min_score, invite_code",
          )
          .eq("status", "active")
          .gte("current_members", 3)
          .or(`min_score.is.null,min_score.lte.${userScore}`)
          .is("community_id", null)
          .order("current_members", { ascending: false })
          .limit(5);
        if (cancelled) return;
        if (e) {
          setError(e.message);
          setSuggestions([]);
          return;
        }
        const rows = (data ?? []) as SuggestedCircle[];
        // Drop full circles (current_members >= member_count) and any
        // the user already belongs to. Cap at 3 for the UI.
        const filtered = rows
          .filter(
            (r) =>
              typeof r.member_count === "number" &&
              r.current_members < r.member_count,
          )
          .filter((r) => !excludeIds.includes(r.id))
          .slice(0, 3);
        cache.set(cacheKey, {
          rows: filtered,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        setSuggestions(filtered);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Unknown error");
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // excludeIds is intentionally NOT a dep — we don't want to re-query
    // when the user's existing circles list shifts; we just filter
    // client-side off whatever the latest cache snapshot says.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  return { suggestions, loading, error };
}
