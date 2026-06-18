// hooks/usePositionSwapDashboard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Aggregate fetch + 30s cache for the PositionSwapScreen surface. Mirrors
// `useCircleDetail` — same TTL, same cache shape, same invalidate-on-event
// rule. Bundles the four queries the screen used to fire (members,
// myRequests, pendingRequests, history) into a single RPC call so a tab
// switch / pull-to-refresh / realtime event doesn't fire four round-trips.
//
// Fallback: migration 191 (`get_position_swap_dashboard`) ships in the same
// release as this hook but the user applies migrations manually. Until then
// the RPC returns PostgREST's PGRST202 "function not found", we set
// `available=false`, and the screen continues to render via the legacy
// per-resource hooks. The screen-side legacy path is the safety net — once
// 191 lands in prod, `available=true` and the RPC owns the read path.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type SwapDashboardMember = {
  user_id: string;
  full_name: string;
  position: number;
  xn_score: number | null;
  payout_date: string | null;
  is_current_user: boolean;
  can_swap_with: boolean;
  swap_reason: string | null;
};

export type SwapDashboardData = {
  myPosition: number | null;
  members: SwapDashboardMember[];
  myRequests: any[];
  pendingRequests: any[];
  history: any[];
};

type CacheEntry = { data: SwapDashboardData; expiresAt: number };

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, CacheEntry>();

export function invalidatePositionSwapDashboardCache(circleId: string): void {
  cache.delete(circleId);
}

// Tracks whether the RPC was reported missing — once we know, we stop
// hammering the function and let the screen-side legacy hooks own the read
// path until the next session.
let rpcUnavailable = false;

export type UsePositionSwapDashboardReturn = {
  data: SwapDashboardData | null;
  available: boolean;
  isLoading: boolean;
  refetch: (opts?: { bypassCache?: boolean }) => Promise<void>;
};

export function usePositionSwapDashboard(
  circleId: string | undefined,
): UsePositionSwapDashboardReturn {
  const { user } = useAuth();
  const userId = user?.id;

  const cacheKey = circleId && userId ? `${circleId}:${userId}` : "";
  const initial = cacheKey ? cache.get(cacheKey) : undefined;
  const initialFresh = initial && initial.expiresAt > Date.now();

  const [data, setData] = useState<SwapDashboardData | null>(
    initialFresh ? initial!.data : null,
  );
  const [available, setAvailable] = useState<boolean>(!rpcUnavailable);
  const [isLoading, setIsLoading] = useState<boolean>(!initialFresh);
  // Guard against state updates after unmount when a fetch in flight returns.
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const refetch = useCallback<UsePositionSwapDashboardReturn["refetch"]>(
    async (opts) => {
      if (!circleId || !userId) return;
      if (rpcUnavailable) {
        // We already know the RPC isn't deployed. The screen's legacy
        // path is the source of truth — no need to re-attempt.
        if (aliveRef.current) {
          setAvailable(false);
          setIsLoading(false);
        }
        return;
      }
      const bypass = opts?.bypassCache ?? false;
      const key = `${circleId}:${userId}`;
      if (!bypass) {
        const hit = cache.get(key);
        if (hit && hit.expiresAt > Date.now()) {
          if (aliveRef.current) {
            setData(hit.data);
            setIsLoading(false);
            setAvailable(true);
          }
          return;
        }
      }
      setIsLoading(true);
      try {
        const { data: result, error } = await supabase.rpc(
          "get_position_swap_dashboard",
          { p_circle_id: circleId, p_user_id: userId },
        );
        if (error) {
          // PGRST202 = function not found. Any other error is a real
          // problem — surface it as unavailable for THIS call but keep
          // trying on subsequent refetches in case it's transient.
          const code = (error as any)?.code as string | undefined;
          const msg = String((error as any)?.message ?? "");
          const looksMissing =
            code === "PGRST202" ||
            msg.includes("Could not find the function") ||
            msg.includes("get_position_swap_dashboard");
          if (looksMissing) {
            rpcUnavailable = true;
          }
          if (aliveRef.current) {
            setAvailable(false);
            setData(null);
          }
          return;
        }
        const shaped: SwapDashboardData = {
          myPosition: (result as any)?.myPosition ?? null,
          members: ((result as any)?.members ?? []) as SwapDashboardMember[],
          myRequests: ((result as any)?.myRequests ?? []) as any[],
          pendingRequests: ((result as any)?.pendingRequests ?? []) as any[],
          history: ((result as any)?.history ?? []) as any[],
        };
        cache.set(key, { data: shaped, expiresAt: Date.now() + CACHE_TTL_MS });
        if (aliveRef.current) {
          setData(shaped);
          setAvailable(true);
        }
      } finally {
        if (aliveRef.current) setIsLoading(false);
      }
    },
    [circleId, userId],
  );

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, available, isLoading, refetch };
}
