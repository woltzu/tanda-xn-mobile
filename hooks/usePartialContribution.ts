/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PARTIAL CONTRIBUTION HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the Partial Contribution engine.
 * 5 hooks: usePartialEligibility, useActivationSummary, useActivePlan,
 *          useMemberPlanHistory, usePartialContributionActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PartialContributionEngine,
  type PlanStatus,
  type ContributionType,
  type CatchUpItemStatus,
  type CatchUpScheduleItem,
  type PartialContributionPlan,
  type EligibilityCheck,
  type PartialContributionSummary,
  type PartialActivationResult,
  type PartialPreviewResult,
  type PartialPreviewEligibility,
  type PartialPreviewSummary,
  type PartialPreviewCoverage,
  type PartialActivateResult,
  type CoverageStatus,
} from '@/services/PartialContributionEngine';

// Re-export all types for consumer convenience
export type {
  PlanStatus,
  ContributionType,
  CatchUpItemStatus,
  CatchUpScheduleItem,
  PartialContributionPlan,
  EligibilityCheck,
  PartialContributionSummary,
  PartialActivationResult,
  PartialPreviewResult,
  PartialPreviewEligibility,
  PartialPreviewSummary,
  PartialPreviewCoverage,
  PartialActivateResult,
  CoverageStatus,
};


// ═══════════════════════════════════════════════════════════════════════════════
// usePartialEligibility — Check if member can use partial contribution mode
// ═══════════════════════════════════════════════════════════════════════════════

export function usePartialEligibility(
  userId?: string,
  circleId?: string,
  cycleId?: string
) {
  const [eligibility, setEligibility] = useState<EligibilityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!userId || !circleId || !cycleId) {
      setEligibility(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await PartialContributionEngine.checkEligibility(
        userId, circleId, cycleId
      );
      setEligibility(result);
    } catch (err: any) {
      setError(err.message || 'Failed to check eligibility');
    } finally {
      setLoading(false);
    }
  }, [userId, circleId, cycleId]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  // Computed
  const eligible = useMemo(() => eligibility?.eligible ?? false, [eligibility]);
  const reason = useMemo(() => eligibility?.reason || null, [eligibility]);
  const usesThisYear = useMemo(() => eligibility?.usesThisYear ?? 0, [eligibility]);
  const feeRequired = useMemo(() => eligibility?.feeRequired ?? false, [eligibility]);
  const feeCents = useMemo(() => eligibility?.feeCents ?? 0, [eligibility]);

  return {
    eligibility,
    loading,
    error,
    refetch: checkEligibility,
    eligible,
    reason,
    usesThisYear,
    feeRequired,
    feeCents,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePreview — Bucket A
// Wraps the working preview_partial_contribution RPC via engine.preview().
// Replaces the dead useActivationSummary hook that routed through the broken
// pre-migration-102 TS preview path.
// ═══════════════════════════════════════════════════════════════════════════════

export function usePreview(circleId?: string, cycleId?: string | null) {
  const [preview, setPreview] = useState<PartialPreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!circleId || !cycleId) {
      setPreview(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await PartialContributionEngine.preview(circleId, cycleId);
      setPreview(result);
      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch preview');
    } finally {
      setLoading(false);
    }
  }, [circleId, cycleId]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Convenience accessors — keep call sites concise.
  const eligibility = useMemo(() => preview?.eligibility ?? null, [preview]);
  const summary = useMemo(() => preview?.summary ?? null, [preview]);
  const coverage = useMemo(() => preview?.coverage_preview ?? null, [preview]);
  const catchUpDates = useMemo(() => {
    if (!summary) return [];
    return [
      {
        cycleNumber: summary.catch_up_1_cycle_number,
        date: summary.catch_up_1_due,
        amountCents: summary.catch_up_1_cents,
      },
      {
        cycleNumber: summary.catch_up_2_cycle_number,
        date: summary.catch_up_2_due,
        amountCents: summary.catch_up_2_cents,
      },
    ];
  }, [summary]);

  return {
    preview,
    eligibility,
    summary,
    coverage,
    catchUpDates,
    loading,
    error,
    refetch: fetchPreview,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// usePartialPlanSummary — Bucket A
// Lightweight count of the current user's active partial-contribution plans
// across all their circles. Drives the CirclesV2 status row. Subscribes to
// the same realtime channel as useActivePlan so the row updates without a
// manual refresh after activate / cancel.
// ═══════════════════════════════════════════════════════════════════════════════

export function usePartialPlanSummary(userId?: string) {
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    if (!userId) {
      setActiveCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { count } = await supabase
        .from('partial_contribution_plans')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', userId)
        .eq('status', 'active');
      setActiveCount(count ?? 0);
    } catch {
      setActiveCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    if (!userId) return;
    const channel = PartialContributionEngine.subscribeToPlans(userId, () =>
      fetchSummary(),
    );
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchSummary]);

  return { activeCount, loading, refresh: fetchSummary };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useActivePlan — Current active plan with catch-up progress
// ═══════════════════════════════════════════════════════════════════════════════

export function useActivePlan(userId?: string, circleId?: string) {
  const [plan, setPlan] = useState<PartialContributionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!userId || !circleId) {
      setPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await PartialContributionEngine.getActivePlan(userId, circleId);
      setPlan(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch active plan');
    } finally {
      setLoading(false);
    }
  }, [userId, circleId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = PartialContributionEngine.subscribeToPlans(userId, () => {
      fetchPlan();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchPlan]);

  // Computed
  const hasPlan = useMemo(() => plan !== null, [plan]);
  const catchUpProgress = useMemo(() => {
    if (!plan) return { paid: 0, total: 0, percentage: 0 };
    const total = plan.catchUpSchedule.length;
    const paid = plan.catchUpSchedule.filter((item) => item.status === 'paid').length;
    return { paid, total, percentage: total > 0 ? Math.round((paid / total) * 100) : 0 };
  }, [plan]);
  const nextCatchUpDate = useMemo(() => {
    if (!plan) return null;
    const nextItem = plan.catchUpSchedule.find((item) => item.status === 'scheduled');
    return nextItem?.dueDate || null;
  }, [plan]);
  const remainingAmount = useMemo(
    () => plan ? plan.remainingAmountCents / 100 : 0,
    [plan]
  );

  return {
    plan,
    loading,
    error,
    refetch: fetchPlan,
    hasPlan,
    catchUpProgress,
    nextCatchUpDate,
    remainingAmount,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useMemberPlanHistory — All plans for a member
// ═══════════════════════════════════════════════════════════════════════════════

export function useMemberPlanHistory(userId?: string) {
  const [plans, setPlans] = useState<PartialContributionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await PartialContributionEngine.getMemberPlans(userId);
      setPlans(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch plan history');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = PartialContributionEngine.subscribeToPlans(userId, () => {
      fetchHistory();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchHistory]);

  // Computed
  const totalPlans = useMemo(() => plans.length, [plans]);
  const completedPlans = useMemo(
    () => plans.filter((p) => p.status === 'completed').length,
    [plans]
  );
  const activePlan = useMemo(
    () => plans.find((p) => p.status === 'active') || null,
    [plans]
  );

  return {
    plans,
    loading,
    error,
    refetch: fetchHistory,
    totalPlans,
    completedPlans,
    activePlan,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePartialContributionActions — Action callbacks
// ═══════════════════════════════════════════════════════════════════════════════

export function usePartialContributionActions() {
  const [activating, setActivating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Activate the 50/25/25 plan for (circle, cycle).
   *
   * Bucket A — signature drops the `userId` param (the RPC infers caller
   * from auth.uid()) and the return type drops from the unreliable
   * client-built PartialActivationResult to the RPC's authoritative
   * { success, plan_id?, error? } payload. Callers re-fetch the plan via
   * useActivePlan after a success — that's the source of truth now.
   */
  const activatePartialContribution = useCallback(async (
    circleId: string,
    cycleId: string,
  ): Promise<PartialActivateResult> => {
    try {
      setActivating(true);
      setError(null);
      const result = await PartialContributionEngine.activate(circleId, cycleId);
      if (!result.success && result.error) {
        setError(result.error);
      }
      return result;
    } finally {
      setActivating(false);
    }
  }, []);

  const cancelPlan = useCallback(async (
    planId: string
  ): Promise<PartialContributionPlan | null> => {
    try {
      setCancelling(true);
      setError(null);
      return await PartialContributionEngine.cancelPlan(planId);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel plan');
      return null;
    } finally {
      setCancelling(false);
    }
  }, []);

  const processCatchUpPayment = useCallback(async (
    contributionId: string
  ): Promise<PartialContributionPlan | null> => {
    try {
      setError(null);
      return await PartialContributionEngine.processCatchUpPayment(contributionId);
    } catch (err: any) {
      setError(err.message || 'Failed to process catch-up payment');
      return null;
    }
  }, []);

  return {
    activatePartialContribution,
    cancelPlan,
    processCatchUpPayment,
    activating,
    cancelling,
    error,
  };
}
