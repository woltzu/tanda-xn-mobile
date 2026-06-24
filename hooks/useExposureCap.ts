// ═══════════════════════════════════════════════════════════════════════════
// hooks/useExposureCap.ts — Phase 1 Member Access Tiers
// ═══════════════════════════════════════════════════════════════════════════
//
// Reads the caller's effective exposure cap from member_tier_status
// (the live tier table — migration 247 added max_exposure_cents to it) and
// exposes two checks the join + create flows need:
//
//   • canJoinCircle(circleId)            → server-truth via the
//     can_join_circle RPC (also reads any active exposure_vouches).
//   • canCreatePotCents(potCents)        → client-side gate for the create
//     wizard, which doesn't have a circle row yet. Compares pot directly
//     against the user's own cap (no vouch awareness — vouching applies
//     after the circle exists). Fail-closed when the cap is unknown.
//
// Returns the raw cap so screens can render "your max is $5,000" inline
// without an extra fetch.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Mirrors the migration 247 backfill mapping. Used as fallback when the
// caller has no member_tier_status row (brand-new user); keep in sync with
// the RPC's voucher-tier CASE.
const TIER_FALLBACK_CENTS = 50000; // newcomer

export interface UseExposureCapResult {
  /** Current cap in cents (NULL until loaded; 0 means blocked). */
  maxExposureCents: number | null;
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** Last error message from the fetch, if any. */
  error: string | null;
  /**
   * Server-truth check for joining an existing circle. Returns FALSE on any
   * RPC error (fail-closed). Uses can_join_circle RPC which also factors in
   * active exposure_vouches.
   */
  canJoinCircle: (circleId: string) => Promise<boolean>;
  /**
   * Client-side pot check for the create wizard. Pure comparison against the
   * cached cap; safe to call from input handlers. Returns FALSE while the
   * cap is still loading.
   */
  canCreatePotCents: (potCents: number) => boolean;
  refresh: () => Promise<void>;
}

export function useExposureCap(userId: string | undefined): UseExposureCapResult {
  const [maxExposureCents, setMaxExposureCents] = useState<number | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setMaxExposureCents(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("member_tier_status")
        .select("max_exposure_cents")
        .eq("user_id", userId)
        .maybeSingle();
      if (e) throw new Error(e.message);
      // No tier_status row → newcomer fallback. Existing row with NULL
      // (shouldn't happen after the backfill, but be defensive) → fallback.
      setMaxExposureCents(data?.max_exposure_cents ?? TIER_FALLBACK_CENTS);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load exposure cap");
      setMaxExposureCents(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canJoinCircle = useCallback(
    async (circleId: string): Promise<boolean> => {
      if (!userId || !circleId) return false;
      const { data, error: e } = await supabase.rpc("can_join_circle", {
        p_user_id: userId,
        p_circle_id: circleId,
      });
      if (e) {
        // Fail-closed on any RPC error — safer to over-block than to
        // accidentally let a member exceed the cap.
        console.warn("[useExposureCap] can_join_circle RPC error:", e);
        return false;
      }
      return data === true;
    },
    [userId],
  );

  const canCreatePotCents = useCallback(
    (potCents: number): boolean => {
      if (maxExposureCents == null) return false;
      return potCents <= maxExposureCents;
    },
    [maxExposureCents],
  );

  return {
    maxExposureCents,
    isLoading,
    error,
    canJoinCircle,
    canCreatePotCents,
    refresh,
  };
}
