// ══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTION HOOKS
// React hooks for payout execution functionality
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  payoutEngine,
  PayoutExecution,
  PayoutDistribution,
  PayoutSuggestion,
  ExecutionResult
} from '@/services/PayoutExecutionEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// PENDING PAYOUTS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePendingPayouts(circleId?: string) {
  const { user } = useAuth();
  const [pendingPayouts, setPendingPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingPayouts = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);

      let query = supabase
        .from('circle_cycles')
        .select(`
          *,
          circle:circles(name, contribution_amount),
          recipient:profiles!circle_cycles_recipient_user_id_fkey(full_name, email)
        `)
        .eq('recipient_user_id', user.id)
        .eq('status', 'ready_payout')
        .order('payout_date', { ascending: true });

      if (circleId) {
        query = query.eq('circle_id', circleId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setPendingPayouts(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, circleId]);

  useEffect(() => {
    fetchPendingPayouts();
  }, [fetchPendingPayouts]);

  // Subscribe to cycle changes
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`pending-payouts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_cycles',
          filter: `recipient_user_id=eq.${user.id}`
        },
        () => {
          fetchPendingPayouts();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchPendingPayouts]);

  const totalPending = pendingPayouts.reduce((sum, p) => {
    return sum + parseFloat(p.payout_amount || p.collected_amount || 0);
  }, 0);

  return {
    pendingPayouts,
    loading,
    error,
    totalPending,
    totalPendingFormatted: formatCurrency(totalPending * 100),
    refresh: fetchPendingPayouts
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutExecution(cycleId: string) {
  const [execution, setExecution] = useState<PayoutExecution | null>(null);
  const [distribution, setDistribution] = useState<PayoutDistribution | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing execution if any
  useEffect(() => {
    const fetchExecution = async () => {
      const { data } = await supabase
        .from('payout_executions')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setExecution(data as PayoutExecution);
        setDistribution(data.distribution);
      }
    };

    if (cycleId) {
      fetchExecution();
    }
  }, [cycleId]);

  const execute = useCallback(async (): Promise<ExecutionResult> => {
    try {
      setIsExecuting(true);
      setError(null);

      const result = await payoutEngine.executePayout(cycleId);

      if (result.success && result.distribution) {
        setDistribution(result.distribution);
      }

      // Refresh execution data
      const { data } = await supabase
        .from('payout_executions')
        .select('*')
        .eq('id', result.executionId)
        .single();

      if (data) {
        setExecution(data as PayoutExecution);
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      return { success: false, executionId: '', reason: err.message };
    } finally {
      setIsExecuting(false);
    }
  }, [cycleId]);

  return {
    execution,
    distribution,
    isExecuting,
    error,
    execute
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT HISTORY HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutHistory(options: {
  limit?: number;
  circleId?: string;
} = {}) {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        let query = supabase
          .from('payout_executions')
          .select(`
            *,
            circle:circles(name, contribution_amount)
          `)
          .eq('recipient_user_id', user.id)
          .in('execution_status', ['completed', 'partial'])
          .order('completed_at', { ascending: false });

        if (options.circleId) {
          query = query.eq('circle_id', options.circleId);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setPayouts((data || []) as PayoutExecution[]);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.id, options.circleId, options.limit]);

  const totalReceived = payouts.reduce((sum, p) => sum + p.netAmountCents, 0);
  const totalToWallet = payouts.reduce((sum, p) => sum + (p.distribution?.toWallet || 0), 0);
  const totalToBank = payouts.reduce((sum, p) => sum + (p.distribution?.toBank?.amountCents || 0), 0);

  return {
    payouts,
    loading,
    error,
    stats: {
      totalReceived,
      totalToWallet,
      totalToBank,
      walletRetentionRate: totalReceived > 0 ? (totalReceived - totalToBank) / totalReceived : 1
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT DETAILS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutDetails(executionId: string) {
  const [execution, setExecution] = useState<PayoutExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!executionId) return;

      try {
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from('payout_executions')
          .select(`
            *,
            circle:circles(name, contribution_amount),
            cycle:circle_cycles(cycle_number, payout_date),
            recipient:profiles!payout_executions_recipient_user_id_fkey(full_name, email)
          `)
          .eq('id', executionId)
          .single();

        if (fetchError) throw fetchError;

        setExecution(data as PayoutExecution);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [executionId]);

  return {
    execution,
    loading,
    error,
    distribution: execution?.distribution || null,
    verificationChecks: execution?.verificationChecks || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT SUGGESTIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutSuggestions(payoutAmountCents: number) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<PayoutSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!user?.id || payoutAmountCents <= 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get savings goals
        const { data: savingsGoals } = await supabase
          .from('user_savings_goals')
          .select('*, savings_goal_type:savings_goal_types(*)')
          .eq('user_id', user.id)
          .eq('goal_status', 'active');

        const newSuggestions: PayoutSuggestion[] = [];

        // Suggest underfunded goals
        for (const goal of savingsGoals || []) {
          const progress = goal.current_balance_cents / (goal.target_amount_cents || 1);
          const remaining = (goal.target_amount_cents || 0) - goal.current_balance_cents;

          if (progress < 0.9 && remaining > 0) {
            const suggestedAmount = Math.min(
              Math.round(payoutAmountCents * 0.2),
              remaining
            );

            if (suggestedAmount >= 1000) {
              newSuggestions.push({
                type: 'savings_goal',
                savingsGoalId: goal.id,
                goalName: goal.name,
                suggestedAmountCents: suggestedAmount,
                reason: `Your "${goal.name}" goal is ${Math.round(progress * 100)}% funded`,
                interestRate: goal.savings_goal_type?.interest_rate,
                priority: goal.savings_goal_type?.code === 'emergency' ? 1 : 2
              });
            }
          }
        }

        // Check for emergency fund
        const hasEmergencyFund = (savingsGoals || []).some(
          g => g.savings_goal_type?.code === 'emergency'
        );

        if (!hasEmergencyFund && payoutAmountCents >= 10000) {
          newSuggestions.push({
            type: 'create_emergency_fund',
            suggestedAmountCents: Math.round(payoutAmountCents * 0.25),
            reason: 'Start building an emergency fund with 3% APY',
            interestRate: 0.03,
            priority: 1
          });
        }

        // Check for upcoming contributions
        const { data: wallet } = await supabase
          .from('user_wallets')
          .select('main_balance_cents')
          .eq('user_id', user.id)
          .single();

        const { data: upcomingReservations } = await supabase
          .from('contribution_reservations')
          .select('amount_cents')
          .eq('user_id', user.id)
          .eq('reservation_status', 'reserved');

        const totalUpcoming = (upcomingReservations || []).reduce(
          (sum, r) => sum + r.amount_cents, 0
        );

        if (totalUpcoming > (wallet?.main_balance_cents || 0)) {
          const shortfall = totalUpcoming - (wallet?.main_balance_cents || 0);
          newSuggestions.push({
            type: 'reserve_for_contributions',
            suggestedAmountCents: shortfall,
            reason: `You have $${(totalUpcoming / 100).toFixed(2)} in contributions coming up`,
            priority: 0
          });
        }

        // Sort by priority
        newSuggestions.sort((a, b) => a.priority - b.priority);

        setSuggestions(newSuggestions);
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user?.id, payoutAmountCents]);

  return {
    suggestions,
    loading,
    topSuggestion: suggestions[0] || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM PAYOUT ANALYTICS HOOK (for admin)
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutAnalytics() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from('v_payout_analytics')
          .select('*')
          .order('week', { ascending: false })
          .limit(12);

        if (fetchError) throw fetchError;

        // Calculate totals
        const totals = (data || []).reduce((acc, week) => ({
          totalPayouts: acc.totalPayouts + week.total_payouts,
          totalAmount: acc.totalAmount + week.total_amount,
          totalFees: acc.totalFees + week.total_fees,
          amountToWallets: acc.amountToWallets + week.amount_to_wallets,
          amountToBanks: acc.amountToBanks + week.amount_to_banks,
          walletOnlyPayouts: acc.walletOnlyPayouts + week.wallet_only_payouts,
          externalPayouts: acc.externalPayouts + week.external_payouts
        }), {
          totalPayouts: 0,
          totalAmount: 0,
          totalFees: 0,
          amountToWallets: 0,
          amountToBanks: 0,
          walletOnlyPayouts: 0,
          externalPayouts: 0
        });

        const walletRetentionRate = totals.totalAmount > 0
          ? (totals.totalAmount - totals.amountToBanks) / totals.totalAmount
          : 1;

        setAnalytics({
          weeklyData: data || [],
          totals,
          walletRetentionRate,
          walletRetentionPercentage: Math.round(walletRetentionRate * 100)
        });

        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return {
    analytics,
    loading,
    error
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONEY RETENTION ANALYTICS HOOK (for admin)
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoneyRetentionAnalytics() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from('v_money_retention_stats')
          .select('*')
          .single();

        if (fetchError) throw fetchError;

        setStats(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CIRCLE PAYOUT QUEUE HOOK (for circle leaders)
// ═══════════════════════════════════════════════════════════════════════════════

export function useCirclePayoutQueue(circleId: string) {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQueue = async () => {
      if (!circleId) return;

      try {
        setLoading(true);

        const { data, error: fetchError } = await supabase
          .from('circle_cycles')
          .select(`
            *,
            recipient:profiles!circle_cycles_recipient_user_id_fkey(full_name, email),
            payout_execution:payout_executions(*)
          `)
          .eq('circle_id', circleId)
          .in('status', ['collecting', 'ready_payout', 'payout_completed'])
          .order('cycle_number', { ascending: true });

        if (fetchError) throw fetchError;

        setQueue(data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, [circleId]);

  // Subscribe to changes
  useEffect(() => {
    if (!circleId) return;

    const subscription = supabase
      .channel(`payout-queue:${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_cycles',
          filter: `circle_id=eq.${circleId}`
        },
        (payload) => {
          setQueue(prev => {
            const index = prev.findIndex(c => c.id === payload.new?.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = { ...updated[index], ...payload.new };
              return updated;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [circleId]);

  const nextPayout = queue.find(c => c.status === 'ready_payout');
  const completedPayouts = queue.filter(c => c.status === 'payout_completed');
  const upcomingPayouts = queue.filter(c => c.status === 'collecting');

  return {
    queue,
    nextPayout,
    completedPayouts,
    upcomingPayouts,
    loading,
    error
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}
