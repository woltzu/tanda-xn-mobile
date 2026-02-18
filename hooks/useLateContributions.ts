// hooks/useLateContributions.ts
// React hooks for late contribution handling
// Provides easy access to late contribution data and actions

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { lateContributionHandler, LateContribution, LateContributionSummary } from '@/services/LateContributionHandler';
import { paymentPlanService, PaymentPlan, PaymentPlanInstallment } from '@/services/PaymentPlanService';
import { autoRetryService, AutoRetryConfig, AutoRetryHistory } from '@/services/AutoRetryService';

// ============================================================================
// TYPES
// ============================================================================

interface LateContributionWithDetails extends LateContribution {
  circle_name?: string;
  cycle_number?: number;
  days_overdue: number;
  total_fees: number;
}

interface PaymentPlanWithProgress extends PaymentPlan {
  paidAmount: number;
  remainingAmount: number;
  completedInstallments: number;
  percentComplete: number;
}

// ============================================================================
// useLateContributions - Get user's late contributions
// ============================================================================

export function useLateContributions() {
  const { user } = useAuth();
  const [lateContributions, setLateContributions] = useState<LateContributionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLateContributions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('late_contributions')
        .select(`
          *,
          cycle_contributions (
            cycle_id,
            circle_cycles (
              cycle_number,
              circles (name)
            )
          )
        `)
        .eq('user_id', user.id)
        .not('late_status', 'eq', 'resolved')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data with computed fields
      const enriched = (data || []).map(lc => {
        const dueDate = new Date(lc.original_due_date);
        const now = new Date();
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...lc,
          circle_name: (lc.cycle_contributions as any)?.circle_cycles?.circles?.name,
          cycle_number: (lc.cycle_contributions as any)?.circle_cycles?.cycle_number,
          days_overdue: Math.max(0, daysOverdue),
          total_fees: lc.late_fee || 0
        };
      });

      setLateContributions(enriched);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch late contributions');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLateContributions();
  }, [fetchLateContributions]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('late_contributions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'late_contributions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchLateContributions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchLateContributions]);

  return {
    lateContributions,
    loading,
    error,
    refresh: fetchLateContributions
  };
}

// ============================================================================
// useLateContributionSummary - Get summary of user's late status
// ============================================================================

export function useLateContributionSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<LateContributionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await lateContributionHandler.getUserLateSummary(user.id);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary
  };
}

// ============================================================================
// useLateContributionDetails - Get details for a specific late contribution
// ============================================================================

export function useLateContributionDetails(lateContributionId: string | null) {
  const [details, setDetails] = useState<{
    lateContribution: LateContribution | null;
    events: any[];
    paymentPlan: PaymentPlan | null;
    retryHistory: AutoRetryHistory[];
  }>({
    lateContribution: null,
    events: [],
    paymentPlan: null,
    retryHistory: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!lateContributionId) {
      setDetails({ lateContribution: null, events: [], paymentPlan: null, retryHistory: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch late contribution
      const { data: lc, error: lcError } = await supabase
        .from('late_contributions')
        .select('*')
        .eq('id', lateContributionId)
        .single();

      if (lcError) throw lcError;

      // Fetch events
      const { data: events } = await supabase
        .from('late_contribution_events')
        .select('*')
        .eq('late_contribution_id', lateContributionId)
        .order('created_at', { ascending: false });

      // Fetch payment plan if exists
      const { data: paymentPlan } = await supabase
        .from('payment_plans')
        .select('*')
        .eq('late_contribution_id', lateContributionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Fetch retry history
      const retryHistory = await autoRetryService.getRetryHistory(lateContributionId);

      setDetails({
        lateContribution: lc,
        events: events || [],
        paymentPlan,
        retryHistory
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  }, [lateContributionId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return {
    ...details,
    loading,
    error,
    refresh: fetchDetails
  };
}

// ============================================================================
// usePaymentPlans - Get user's payment plans
// ============================================================================

export function usePaymentPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PaymentPlanWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const activePlans = await paymentPlanService.getUserActivePlans(user.id);

      // Enrich with progress data
      const enrichedPlans = await Promise.all(
        activePlans.map(async plan => {
          const progress = await paymentPlanService.getPlanProgress(plan.id);
          return {
            ...plan,
            paidAmount: progress?.paidAmount || 0,
            remainingAmount: progress?.remainingAmount || plan.total_amount,
            completedInstallments: progress?.completedInstallments || 0,
            percentComplete: progress?.percentComplete || 0
          };
        })
      );

      setPlans(enrichedPlans);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch payment plans');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('payment_plans_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_plans',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchPlans();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchPlans]);

  return {
    plans,
    loading,
    error,
    refresh: fetchPlans
  };
}

// ============================================================================
// usePaymentPlanDetails - Get details for a specific payment plan
// ============================================================================

export function usePaymentPlanDetails(planId: string | null) {
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [installments, setInstallments] = useState<PaymentPlanInstallment[]>([]);
  const [progress, setProgress] = useState<{
    paidAmount: number;
    remainingAmount: number;
    completedInstallments: number;
    percentComplete: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!planId) {
      setPlan(null);
      setInstallments([]);
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const planData = await paymentPlanService.getPlanWithInstallments(planId);
      if (!planData) {
        throw new Error('Payment plan not found');
      }

      setPlan(planData.plan);
      setInstallments(planData.installments);

      const progressData = await paymentPlanService.getPlanProgress(planId);
      setProgress(progressData ? {
        paidAmount: progressData.paidAmount,
        remainingAmount: progressData.remainingAmount,
        completedInstallments: progressData.completedInstallments,
        percentComplete: progressData.percentComplete
      } : null);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plan details');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Actions
  const acceptPlan = async () => {
    if (!planId) return;
    await paymentPlanService.acceptPlan(planId);
    fetchDetails();
  };

  const startPlan = async () => {
    if (!planId) return;
    await paymentPlanService.startPlan(planId);
    fetchDetails();
  };

  const cancelPlan = async (reason: string) => {
    if (!planId) return;
    await paymentPlanService.cancelPlan(planId, reason);
    fetchDetails();
  };

  return {
    plan,
    installments,
    progress,
    loading,
    error,
    refresh: fetchDetails,
    acceptPlan,
    startPlan,
    cancelPlan
  };
}

// ============================================================================
// useAutoRetryConfig - Get/update auto-retry configuration
// ============================================================================

export function useAutoRetryConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AutoRetryConfig | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      // Get user's primary payment method
      const { data: paymentMethod } = await supabase
        .from('user_payment_methods')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .single();

      if (paymentMethod) {
        const configData = await autoRetryService.getOrCreateConfig(user.id, paymentMethod.id);
        setConfig(configData);
        setIsEnabled(configData.enabled);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch auto-retry config');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Actions
  const toggleAutoRetry = async (enabled: boolean) => {
    if (!config) return;

    const updated = await autoRetryService.updateConfig(config.id, { enabled });
    setConfig(updated);
    setIsEnabled(updated.enabled);
  };

  const updateMaxRetries = async (maxRetries: number) => {
    if (!config) return;

    const updated = await autoRetryService.updateConfig(config.id, { max_retries: maxRetries });
    setConfig(updated);
  };

  const updateRetryIntervals = async (intervals: number[]) => {
    if (!config) return;

    const updated = await autoRetryService.updateConfig(config.id, { retry_intervals: intervals });
    setConfig(updated);
  };

  return {
    config,
    isEnabled,
    loading,
    error,
    refresh: fetchConfig,
    toggleAutoRetry,
    updateMaxRetries,
    updateRetryIntervals
  };
}

// ============================================================================
// useRetryHistory - Get retry history for a late contribution
// ============================================================================

export function useRetryHistory(lateContributionId: string | null) {
  const [history, setHistory] = useState<AutoRetryHistory[]>([]);
  const [pendingRetry, setPendingRetry] = useState<AutoRetryHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!lateContributionId) {
      setHistory([]);
      setPendingRetry(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const historyData = await autoRetryService.getRetryHistory(lateContributionId);
      setHistory(historyData);

      const pending = await autoRetryService.getPendingRetry(lateContributionId);
      setPendingRetry(pending);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch retry history');
    } finally {
      setLoading(false);
    }
  }, [lateContributionId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Actions
  const cancelPendingRetries = async () => {
    if (!lateContributionId) return 0;
    const count = await autoRetryService.cancelPendingRetries(lateContributionId);
    fetchHistory();
    return count;
  };

  return {
    history,
    pendingRetry,
    loading,
    error,
    refresh: fetchHistory,
    cancelPendingRetries
  };
}

// ============================================================================
// useUserRestrictions - Get user's active restrictions
// ============================================================================

export function useUserRestrictions() {
  const { user } = useAuth();
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestrictions = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('user_restrictions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setRestrictions(data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch restrictions');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchRestrictions();
  }, [fetchRestrictions]);

  // Check for specific restriction
  const hasRestriction = (restrictionType: string): boolean => {
    return restrictions.some(r => r.restriction_type === restrictionType);
  };

  // Check if user can join new circles
  const canJoinCircles = !hasRestriction('no_new_circles');

  // Check if user is suspended
  const isSuspended = hasRestriction('suspended');

  return {
    restrictions,
    loading,
    error,
    refresh: fetchRestrictions,
    hasRestriction,
    canJoinCircles,
    isSuspended
  };
}

// ============================================================================
// useRedistributionRequests - Get redistribution requests for a circle
// ============================================================================

export function useRedistributionRequests(circleId: string | null) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [myResponses, setMyResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!circleId || !user?.id) {
      setRequests([]);
      setMyResponses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get active redistribution requests for the circle
      const { data: requestsData, error: requestsError } = await supabase
        .from('redistribution_requests')
        .select(`
          *,
          late_contributions (
            user_id,
            amount,
            users (display_name)
          )
        `)
        .eq('circle_id', circleId)
        .eq('redistribution_status', 'pending')
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Get my responses to these requests
      const requestIds = (requestsData || []).map(r => r.id);
      let responsesData: any[] = [];

      if (requestIds.length > 0) {
        const { data: responses } = await supabase
          .from('redistribution_responses')
          .select('*')
          .eq('contributor_id', user.id)
          .in('request_id', requestIds);

        responsesData = responses || [];
      }

      setRequests(requestsData || []);
      setMyResponses(responsesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch redistribution requests');
    } finally {
      setLoading(false);
    }
  }, [circleId, user?.id]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Actions
  const respondToRequest = async (requestId: string, amount: number) => {
    if (!user?.id) return;

    await supabase
      .from('redistribution_responses')
      .insert({
        request_id: requestId,
        contributor_id: user.id,
        amount_offered: amount
      });

    fetchRequests();
  };

  const withdrawResponse = async (responseId: string) => {
    await supabase
      .from('redistribution_responses')
      .delete()
      .eq('id', responseId);

    fetchRequests();
  };

  return {
    requests,
    myResponses,
    loading,
    error,
    refresh: fetchRequests,
    respondToRequest,
    withdrawResponse
  };
}

// ============================================================================
// useLateContributionActions - Actions for managing late contributions
// ============================================================================

export function useLateContributionActions() {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request a payment plan
  const requestPaymentPlan = async (
    lateContributionId: string,
    numInstallments: number
  ): Promise<PaymentPlan | null> => {
    if (!user?.id) return null;

    try {
      setProcessing(true);
      setError(null);

      // Get late contribution details
      const { data: lc } = await supabase
        .from('late_contributions')
        .select('amount, late_fee')
        .eq('id', lateContributionId)
        .single();

      if (!lc) throw new Error('Late contribution not found');

      const totalAmount = lc.amount + (lc.late_fee || 0);

      const proposal = await paymentPlanService.createPlanProposal({
        lateContributionId,
        userId: user.id,
        totalAmount,
        numInstallments
      });

      return proposal.plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment plan');
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // Make a manual payment
  const makePayment = async (
    lateContributionId: string,
    amount: number,
    paymentMethodId: string
  ): Promise<boolean> => {
    try {
      setProcessing(true);
      setError(null);

      // This would integrate with your payment gateway
      // For now, we'll create a placeholder
      const paymentReference = `manual_${lateContributionId}_${Date.now()}`;

      // Record the payment
      await supabase
        .from('late_contributions')
        .update({
          late_status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolution_type: 'manual_payment',
          updated_at: new Date().toISOString()
        })
        .eq('id', lateContributionId);

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Enable/disable auto-retry
  const toggleAutoRetry = async (paymentMethodId: string, enabled: boolean): Promise<void> => {
    if (!user?.id) return;

    try {
      setProcessing(true);
      setError(null);

      if (enabled) {
        await autoRetryService.enableAutoRetry(user.id, paymentMethodId);
      } else {
        await autoRetryService.disableAutoRetry(user.id, paymentMethodId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-retry');
    } finally {
      setProcessing(false);
    }
  };

  return {
    processing,
    error,
    requestPaymentPlan,
    makePayment,
    toggleAutoRetry
  };
}
