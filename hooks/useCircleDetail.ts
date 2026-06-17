// hooks/useCircleDetail.ts
// ─────────────────────────────────────────────────────────────────────────────
// Aggregate fetch + 30s cache for the View-Circle-Details surface
// (CircleDetailScreen). Bundles getCircleMembers + getCircleActivities into a
// single hook so the screen no longer reimplements the fetch lifecycle.
//
// Why a cache:
//   The screen is reachable from many surfaces (CirclesScreen, Dashboard,
//   Feed cards, push-notification deep links, etc.). Each visit was firing 3
//   round-trips on focus, and users navigating Contribute → back → Chat → back
//   were paying the same cost repeatedly. The 30 s TTL absorbs short re-entry
//   loops while still feeling fresh on a real revisit.
//
// Cache invalidation:
//   - refresh()           — explicit user gesture (pull-to-refresh) busts the
//                           entry and re-fetches.
//   - Realtime handlers   — when CircleDetailScreen receives an INSERT on
//                           `contributions` or any change on `circle_members`,
//                           it calls refresh() so the cache stays consistent.
//   - Caller-driven       — anything that mutates this circle (MakeContribution
//                           success, joinCircle/leaveCircle RPC) can call
//                           invalidateCircleDetailCache(circleId) directly.
//
// Note: circle metadata (name, amount, frequency, etc.) lives in CirclesContext
// and is not cached here — refresh() also calls refreshCircles() so the
// context-level row updates alongside the local fetch.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import {
  CircleActivity,
  CircleMember,
  useCircles,
} from "../context/CirclesContext";

type CacheEntry = {
  members: CircleMember[];
  activities: CircleActivity[];
  expiresAt: number;
};

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, CacheEntry>();

export function invalidateCircleDetailCache(circleId: string): void {
  cache.delete(circleId);
}

export type UseCircleDetailReturn = {
  members: CircleMember[];
  activities: CircleActivity[];
  isLoadingMembers: boolean;
  isLoadingActivities: boolean;
  /**
   * Fetch members + activities. Honors the cache unless `bypassCache` is set.
   * `showSpinner` controls whether the per-tab spinners flash — set false for
   * background realtime refreshes.
   */
  fetchData: (opts?: { showSpinner?: boolean; bypassCache?: boolean }) => Promise<void>;
  /** Explicit refresh — busts the cache and reruns the aggregate fetch + refreshCircles(). */
  refresh: (opts?: { skipSpinner?: boolean }) => Promise<void>;
};

export function useCircleDetail(circleId: string): UseCircleDetailReturn {
  const { getCircleMembers, getCircleActivities, refreshCircles } = useCircles();

  const initialHit = circleId ? cache.get(circleId) : undefined;
  const initialFresh = initialHit && initialHit.expiresAt > Date.now();

  const [members, setMembers] = useState<CircleMember[]>(
    initialFresh ? initialHit!.members : []
  );
  const [activities, setActivities] = useState<CircleActivity[]>(
    initialFresh ? initialHit!.activities : []
  );
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(!initialFresh);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(!initialFresh);

  const fetchData = useCallback<UseCircleDetailReturn["fetchData"]>(
    async (opts) => {
      if (!circleId) return;
      const showSpinner = opts?.showSpinner ?? true;
      const bypassCache = opts?.bypassCache ?? false;

      if (!bypassCache) {
        const hit = cache.get(circleId);
        if (hit && hit.expiresAt > Date.now()) {
          setMembers(hit.members);
          setActivities(hit.activities);
          setIsLoadingMembers(false);
          setIsLoadingActivities(false);
          return;
        }
      }

      if (showSpinner) {
        setIsLoadingMembers(true);
        setIsLoadingActivities(true);
      }
      try {
        const [m, a] = await Promise.all([
          getCircleMembers(circleId),
          getCircleActivities(circleId),
        ]);
        cache.set(circleId, {
          members: m,
          activities: a,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        setMembers(m);
        setActivities(a);
      } catch (err) {
        console.error("[useCircleDetail] fetch failed:", err);
      } finally {
        if (showSpinner) {
          setIsLoadingMembers(false);
          setIsLoadingActivities(false);
        }
      }
    },
    [circleId, getCircleMembers, getCircleActivities]
  );

  const refresh = useCallback<UseCircleDetailReturn["refresh"]>(
    async (opts) => {
      if (!circleId) return;
      cache.delete(circleId);
      await Promise.all([
        fetchData({
          showSpinner: !(opts?.skipSpinner ?? false),
          bypassCache: true,
        }),
        refreshCircles(),
      ]);
    },
    [circleId, fetchData, refreshCircles]
  );

  // Hydrate from cache on circleId change without forcing a new request when
  // the cached entry is still fresh. The caller is expected to drive the
  // first fetch via useFocusEffect (or similar) — this effect is the
  // "fast-path" sync for switching between cached circles.
  useEffect(() => {
    if (!circleId) return;
    const hit = cache.get(circleId);
    if (hit && hit.expiresAt > Date.now()) {
      setMembers(hit.members);
      setActivities(hit.activities);
      setIsLoadingMembers(false);
      setIsLoadingActivities(false);
    }
  }, [circleId]);

  return {
    members,
    activities,
    isLoadingMembers,
    isLoadingActivities,
    fetchData,
    refresh,
  };
}
