// hooks/useHasContribution.ts
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight "has this user ever made a contribution?" check. Used by
// OnboardingContext to derive the third first-launch step
// (first_contribution) without pulling in the heavy useContributions
// hook that loads the full contribution list + affordability + stats.
//
// One HEAD/count round-trip on mount, cached in-memory for 60 s per
// user id so re-mounts (tab switches, navigation focus) don't re-hit
// Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type CacheEntry = { value: boolean; expiresAt: number };
const CACHE_TTL_MS = 60_000;
// Module-scope cache survives re-mounts of the consuming hook (e.g.
// React Navigation's focus/blur) without leaking across users.
const cache = new Map<string, CacheEntry>();

export type UseHasContributionResult = {
  hasContribution: boolean;
  loading: boolean;
};

export function useHasContribution(): UseHasContributionResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [hasContribution, setHasContribution] = useState<boolean>(() => {
    if (!userId) return false;
    const hit = cache.get(userId);
    return hit && hit.expiresAt > Date.now() ? hit.value : false;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    if (!userId) return false;
    const hit = cache.get(userId);
    return !(hit && hit.expiresAt > Date.now());
  });

  useEffect(() => {
    if (!userId) {
      setHasContribution(false);
      setLoading(false);
      return;
    }
    const hit = cache.get(userId);
    if (hit && hit.expiresAt > Date.now()) {
      setHasContribution(hit.value);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { count, error } = await supabase
          .from("contributions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .limit(1);
        if (cancelled) return;
        if (error) {
          // Treat query failure as "unknown → assume false" so the
          // first-launch progress doesn't lock in a stale true. Logged
          // for observability but non-fatal.
          console.warn("[useHasContribution] count query failed", error.message);
          setHasContribution(false);
        } else {
          const value = (count ?? 0) > 0;
          cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
          setHasContribution(value);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[useHasContribution] threw", e);
          setHasContribution(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { hasContribution, loading };
}
