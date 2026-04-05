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
// useActivationSummary — Preview data for the confirmation screen
// ═══════════════════════════════════════════════════════════════════════════════

export function useActivationSummary(
  userId?: string,
  circleId?: string,
  cycleId?: string
) {
  const [summary, setSummary] = useState<PartialContributionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!userId || !circleId || !cycleId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await PartialContributionEngine.getActivationSummary(
        userId, circleId, cycleId
      );
      setSummary(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch activation summary');
    } finally {
      setLoading(false);
    }
  }, [userId, circleId, cycleId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Computed
  const payNowAmount = useMemo(() => summary?.payNowAmount ?? 0, [summary]);
  const totalNextCycle = useMemo(() => summary?.totalNextCycle ?? 0, [summary]);
  const totalCycleAfter = useMemo(() => summary?.totalCycleAfter ?? 0, [summary]);
  const catchUpDates = useMemo(() => {
    if (!summary) return [];
    return [
      { date: summary.catchUp1Date, amount: summary.catchUp1Amount, cycleNumber: summary.catchUp1CycleNumber },
      { date: summary.catchUp2Date, amount: summary.catchUp2Amount, cycleNumber: summary.catchUp2CycleNumber },
    ];
  }, [summary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchSummary,
    payNowAmount,
    totalNextCycle,
    totalCycleAfter,
    catchUpDates,
  };
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

  const activatePartialContribution = useCallback(async (
    userId: string,
    circleId: string,
    cycleId: string
  ): Promise<PartialActivationResult | null> => {
    try {
      setActivating(true);
      setError(null);
      return await PartialContributionEngine.activatePartialContribution(
        userId, circleId, cycleId
      );
    } catch (err: any) {
      setError(err.message || 'Failed to activate partial contribution');
      return null;
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
