// ═══════════════════════════════════════════════════════════════════════════
// hooks/useAdoptionStatus.ts — adoption-threshold gating (Bucket 10)
// ═══════════════════════════════════════════════════════════════════════════
//
// Wraps the evaluate_adoption_status RPC (migration 281). Lets screens
// branch on whether the current user has crossed the adoption threshold
// (1 completed cycle + 30 days of account age by default — both
// configurable via the public.settings 'adoption_thresholds' key).
//
// The fee logic itself runs server-side in apply_adoption_conditional_fee
// (BEFORE INSERT trigger on circles). This hook is read-only and exists
// purely so the create-circle wizard can render an explanatory banner
// while a non-adopted user is picking a premium type.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface AdoptionStatus {
  /** True once the caller has crossed both thresholds. */
  isAdopted: boolean;
  /** Count of completed cycles the caller participated in. */
  cyclesCompleted: number;
  /** Account age in whole days. */
  accountAgeDays: number;
  /** Threshold values from settings (so the UI can render "X of Y"). */
  thresholdCycles: number;
  thresholdDays: number;
}

export interface UseAdoptionStatusResult {
  status: AdoptionStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAdoptionStatus(): UseAdoptionStatusResult {
  const [status, setStatus] = useState<AdoptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "evaluate_adoption_status",
        { p_user_id: null },
      );
      if (rpcError) throw rpcError;
      if (!data || typeof data !== "object") {
        setStatus(null);
        return;
      }
      setStatus({
        isAdopted: Boolean((data as any).is_adopted),
        cyclesCompleted: Number((data as any).cycles_completed ?? 0),
        accountAgeDays: Number((data as any).account_age_days ?? 0),
        thresholdCycles: Number((data as any).threshold_cycles ?? 1),
        thresholdDays: Number((data as any).threshold_days ?? 30),
      });
    } catch (e: any) {
      setError(e?.message ?? "adoption_status_failed");
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { status, isLoading, error, refresh: fetchStatus };
}

/** Static list — mirrors the server-side trigger's premium classification. */
export const PREMIUM_CIRCLE_TYPES = new Set<string>([
  "goal",
  "goal-based",
  "emergency",
  "family-support",
  "beneficiary",
]);

export function isPremiumCircleType(circleType: string | null | undefined): boolean {
  if (!circleType) return false;
  return PREMIUM_CIRCLE_TYPES.has(circleType);
}
