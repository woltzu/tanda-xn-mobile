// hooks/useDefaultCascade.ts
// React hooks for default cascade handling
// Provides easy access to defaults, voucher impacts, resolutions, and recovery plans

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { defaultCascadeHandler, DefaultRecord, CascadeResult } from '@/services/DefaultCascadeHandler';
import { voucherCascadeService, VoucherStanding, VoucheeDefaultRecord } from '@/services/VoucherCascadeService';
import { circleResolutionService, CircleResolution, RedistributionRequest } from '@/services/CircleResolutionService';
import { recoveryPlanService, RecoveryPlan, RecoveryProgress, RecoveryOption } from '@/services/RecoveryPlanService';

// ============================================================================
// useUserDefaults - Get user's default history
// ============================================================================

export function useUserDefaults() {
  const { user } = useAuth();
  const [defaults, setDefaults] = useState<DefaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDefaults = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await defaultCascadeHandler.getUserDefaults(user.id);
      setDefaults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch defaults');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('user_defaults_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'defaults',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchDefaults();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchDefaults]);

  // Computed values
  const unresolvedDefaults = defaults.filter(d => d.default_status === 'unresolved');
  const totalOwed = unresolvedDefaults.reduce((sum, d) => sum + d.total_owed, 0);
  const hasActiveDefaults = unresolvedDefaults.length > 0;

  return {
    defaults,
    unresolvedDefaults,
    totalOwed,
    hasActiveDefaults,
    loading,
    error,
    refresh: fetchDefaults
  };
}

// ============================================================================
// useDefaultDetails - Get details for a specific default
// ============================================================================

export function useDefaultDetails(defaultId: string | null) {
  const [defaultRecord, setDefaultRecord] = useState<DefaultRecord | null>(null);
  const [cascadeEvents, setCascadeEvents] = useState<any[]>([]);
  const [resolution, setResolution] = useState<CircleResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!defaultId) {
      setDefaultRecord(null);
      setCascadeEvents([]);
      setResolution(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch default record
      const { data: defData, error: defError } = await supabase
        .from('defaults')
        .select('*')
        .eq('id', defaultId)
        .single();

      if (defError) throw defError;

      setDefaultRecord(defData);

      // Fetch cascade events
      if (defData?.cascade_id) {
        const events = await defaultCascadeHandler.getCascadeEvents(defData.cascade_id);
        setCascadeEvents(events);
      }

      // Fetch resolution
      const resolutionData = await circleResolutionService.getResolution(defaultId);
      setResolution(resolutionData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  }, [defaultId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    defaultRecord,
    cascadeEvents,
    resolution,
    loading,
    error,
    refresh: fetchDetails
  };
}

// ============================================================================
// useVoucherStanding - Get voucher's standing and reliability
// ============================================================================

export function useVoucherStanding() {
  const { user } = useAuth();
  const [standing, setStanding] = useState<VoucherStanding | null>(null);
  const [voucheeDefaults, setVoucheeDefaults] = useState<VoucheeDefaultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStanding = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const standingData = await voucherCascadeService.getVoucherStanding(user.id);
      setStanding(standingData);

      const defaultsData = await voucherCascadeService.getVoucheeDefaults(user.id);
      setVoucheeDefaults(defaultsData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch voucher standing');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchStanding();
  }, [fetchStanding]);

  // Real-time subscription for voucher impacts
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('voucher_impacts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voucher_default_impacts',
          filter: `voucher_user_id=eq.${user.id}`
        },
        () => {
          fetchStanding();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchStanding]);

  return {
    standing,
    voucheeDefaults,
    canVouch: standing?.canVouch ?? true,
    reliabilityStatus: standing?.reliabilityStatus ?? 'good',
    loading,
    error,
    refresh: fetchStanding
  };
}

// ============================================================================
// useVoucherImpactHistory - Get detailed voucher impact history
// ============================================================================

export function useVoucherImpactHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await voucherCascadeService.getVoucherImpactHistory(user.id);
      setHistory(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch impact history');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalImpact = history.reduce((sum, h) => sum + (h.xnscoreImpact || 0), 0);

  return {
    history,
    totalImpact,
    loading,
    error,
    refresh: fetchHistory
  };
}

// ============================================================================
// useRedistributionRequests - Get user's pending redistribution requests
// ============================================================================

export function useRedistributionRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await circleResolutionService.getUserPendingRedistributions(user.id);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch redistribution requests');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('redistribution_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'redistribution_responses',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchRequests]);

  // Actions
  const acceptRedistribution = async (responseId: string, amount?: number) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };
    const result = await circleResolutionService.acceptRedistribution(responseId, user.id, amount);
    if (result.success) fetchRequests();
    return result;
  };

  const declineRedistribution = async (responseId: string) => {
    if (!user?.id) return { success: false, error: 'Not authenticated' };
    const result = await circleResolutionService.declineRedistribution(responseId, user.id);
    if (result.success) fetchRequests();
    return result;
  };

  return {
    requests,
    pendingCount: requests.length,
    loading,
    error,
    refresh: fetchRequests,
    acceptRedistribution,
    declineRedistribution
  };
}

// ============================================================================
// useRecoveryPlan - Get and manage user's recovery plan
// ============================================================================

export function useRecoveryPlan() {
  const { user } = useAuth();
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [progress, setProgress] = useState<RecoveryProgress | null>(null);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const activePlan = await recoveryPlanService.getActiveRecoveryPlan(user.id);
      setPlan(activePlan);

      if (activePlan) {
        // Generate options if plan is still in offered state
        if (activePlan.planStatus === 'offered') {
          const opts = recoveryPlanService.generateRecoveryOptions(activePlan.totalDebt);
          setOptions(opts);
        }

        // Get progress if plan is active
        if (['accepted', 'active'].includes(activePlan.planStatus)) {
          const prog = await recoveryPlanService.getRecoveryProgress(activePlan.id);
          setProgress(prog);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recovery plan');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('recovery_plan_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recovery_plans',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchPlan();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchPlan]);

  // Actions
  const acceptPlan = async (optionId: string) => {
    if (!plan || !user?.id) return { success: false, error: 'No plan available' };
    const result = await recoveryPlanService.acceptRecoveryPlan(plan.id, optionId, user.id);
    if (result.success) fetchPlan();
    return result;
  };

  const makePayment = async (amount: number, paymentReference: string) => {
    if (!plan) return { success: false, error: 'No plan available' };
    const result = await recoveryPlanService.processPayment(plan.id, amount, paymentReference);
    if (result.success) fetchPlan();
    return result;
  };

  return {
    plan,
    progress,
    options,
    hasActivePlan: !!plan,
    needsSelection: plan?.planStatus === 'offered',
    loading,
    error,
    refresh: fetchPlan,
    acceptPlan,
    makePayment
  };
}

// ============================================================================
// useRecoveryProgress - Get detailed recovery progress
// ============================================================================

export function useRecoveryProgress(planId: string | null) {
  const [progress, setProgress] = useState<RecoveryProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!planId) {
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await recoveryPlanService.getRecoveryProgress(planId);
      setProgress(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch progress');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    progress,
    loading,
    error,
    refresh: fetchProgress
  };
}

// ============================================================================
// useUpcomingInstallments - Get user's upcoming recovery installments
// ============================================================================

export function useUpcomingInstallments() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallments = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await recoveryPlanService.getUserUpcomingInstallments(user.id);
      setInstallments(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch installments');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchInstallments();
  }, [fetchInstallments]);

  // Find next due
  const nextDue = installments.length > 0 ? installments[0] : null;
  const hasOverdue = installments.some(i => new Date(i.dueDate) < new Date());

  return {
    installments,
    nextDue,
    hasOverdue,
    loading,
    error,
    refresh: fetchInstallments
  };
}

// ============================================================================
// useCircleResolutions - Get resolutions for a circle (for leaders)
// ============================================================================

export function useCircleResolutions(circleId: string | null) {
  const [resolutions, setResolutions] = useState<CircleResolution[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResolutions = useCallback(async () => {
    if (!circleId) {
      setResolutions([]);
      setStats(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await circleResolutionService.getCircleResolutions(circleId);
      setResolutions(data);

      const statsData = await circleResolutionService.getCircleResolutionStats(circleId);
      setStats(statsData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resolutions');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchResolutions();
  }, [fetchResolutions]);

  return {
    resolutions,
    stats,
    loading,
    error,
    refresh: fetchResolutions
  };
}

// ============================================================================
// useDefaultCascadeActions - Actions for managing defaults (admin/leader use)
// ============================================================================

export function useDefaultCascadeActions() {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Execute a cascade manually (for testing or manual intervention)
  const executeCascade = async (defaultId: string): Promise<CascadeResult | null> => {
    try {
      setProcessing(true);
      setError(null);
      const result = await defaultCascadeHandler.executeDefaultCascade(defaultId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute cascade');
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // Get cascade summary
  const getCascadeSummary = async (cascadeId: string) => {
    try {
      return await defaultCascadeHandler.getCascadeSummary(cascadeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get summary');
      return null;
    }
  };

  return {
    processing,
    error,
    executeCascade,
    getCascadeSummary
  };
}

// ============================================================================
// useSuspensionReview - Get user's suspension review status
// ============================================================================

export function useSuspensionReview() {
  const { user } = useAuth();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReview = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('suspension_reviews')
        .select('*')
        .eq('user_id', user.id)
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setReview(data || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch review');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  return {
    review,
    hasPendingReview: !!review,
    loading,
    error,
    refresh: fetchReview
  };
}
