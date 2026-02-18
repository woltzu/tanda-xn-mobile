// ══════════════════════════════════════════════════════════════════════════════
// WALLET HOOKS - React hooks for wallet functionality
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  walletService,
  Wallet,
  WalletSummary,
  WalletTransaction,
  ContributionReservation,
  SavingsGoal,
  SavingsGoalType
} from '@/services/WalletService';

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [walletData, summaryData] = await Promise.all([
        walletService.getOrCreateWallet(user.id),
        walletService.getWalletSummary(user.id)
      ]);
      setWallet(walletData);
      setSummary(summaryData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  // Subscribe to wallet changes
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`wallet:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_wallets',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchWallet();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, fetchWallet]);

  const updateSettings = useCallback(async (settings: {
    defaultPayoutDestination?: 'wallet' | 'bank' | 'ask_each_time';
    autoReserveEnabled?: boolean;
  }) => {
    if (!user?.id) return;

    try {
      const updated = await walletService.updateWalletSettings(user.id, settings);
      setWallet(updated);
      return updated;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user?.id]);

  return {
    wallet,
    summary,
    loading,
    error,
    refresh: fetchWallet,
    updateSettings
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET BALANCE HOOK (Simple balance display)
// ═══════════════════════════════════════════════════════════════════════════════

export function useWalletBalance() {
  const { wallet, summary, loading } = useWallet();

  return {
    mainBalance: wallet?.mainBalanceCents ? wallet.mainBalanceCents / 100 : 0,
    reservedBalance: wallet?.reservedBalanceCents ? wallet.reservedBalanceCents / 100 : 0,
    committedBalance: wallet?.committedBalanceCents ? wallet.committedBalanceCents / 100 : 0,
    totalBalance: wallet?.totalBalanceCents ? wallet.totalBalanceCents / 100 : 0,
    availableBalance: wallet?.availableBalanceCents ? wallet.availableBalanceCents / 100 : 0,
    totalSavings: summary?.totalSavings || 0,
    loading,
    // Formatted strings
    formatted: {
      main: formatCurrency(wallet?.mainBalanceCents || 0),
      reserved: formatCurrency(wallet?.reservedBalanceCents || 0),
      committed: formatCurrency(wallet?.committedBalanceCents || 0),
      total: formatCurrency(wallet?.totalBalanceCents || 0),
      available: formatCurrency(wallet?.availableBalanceCents || 0),
      savings: formatCurrency((summary?.totalSavings || 0) * 100)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION HISTORY HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWalletTransactions(options: {
  limit?: number;
  transactionType?: string;
} = {}) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const limit = options.limit || 20;

  const fetchTransactions = useCallback(async (reset: boolean = false) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;

      const data = await walletService.getTransactionHistory(user.id, {
        limit: limit + 1, // Fetch one extra to check if there's more
        offset: currentOffset,
        transactionType: options.transactionType
      });

      const hasMoreData = data.length > limit;
      const transactionsToSet = hasMoreData ? data.slice(0, limit) : data;

      if (reset) {
        setTransactions(transactionsToSet);
        setOffset(limit);
      } else {
        setTransactions(prev => [...prev, ...transactionsToSet]);
        setOffset(prev => prev + limit);
      }

      setHasMore(hasMoreData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, offset, limit, options.transactionType]);

  useEffect(() => {
    fetchTransactions(true);
  }, [user?.id, options.transactionType]);

  // Subscribe to new transactions
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel(`transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          setTransactions(prev => [payload.new as WalletTransaction, ...prev]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  return {
    transactions,
    loading,
    error,
    hasMore,
    loadMore: () => fetchTransactions(false),
    refresh: () => fetchTransactions(true)
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRIBUTION RESERVATIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useContributionReservations() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<ContributionReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReservations = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await walletService.getUpcomingReservations(user.id);
      setReservations(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const releaseReservation = useCallback(async (reservationId: string, reason: string) => {
    try {
      await walletService.releaseReservation(reservationId, reason);
      await fetchReservations();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [fetchReservations]);

  const totalReserved = reservations.reduce((sum, r) => sum + r.amountCents, 0);

  return {
    reservations,
    loading,
    error,
    totalReserved,
    totalReservedFormatted: formatCurrency(totalReserved),
    refresh: fetchReservations,
    releaseReservation
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVINGS GOALS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useSavingsGoals() {
  const { user } = useAuth();
  const { wallet } = useWallet();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [goalTypes, setGoalTypes] = useState<SavingsGoalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [goalsData, typesData] = await Promise.all([
        walletService.getSavingsGoals(user.id),
        walletService.getSavingsGoalTypes()
      ]);
      setGoals(goalsData);
      setGoalTypes(typesData);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const createGoal = useCallback(async (
    goalTypeId: string,
    name: string,
    targetAmountCents?: number,
    targetDate?: string
  ) => {
    if (!user?.id || !wallet?.id) {
      throw new Error('Wallet not initialized');
    }

    try {
      const goal = await walletService.createSavingsGoal(
        user.id,
        wallet.id,
        goalTypeId,
        name,
        targetAmountCents,
        targetDate
      );
      setGoals(prev => [goal, ...prev]);
      return goal;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user?.id, wallet?.id]);

  const deposit = useCallback(async (savingsGoalId: string, amountCents: number) => {
    if (!wallet?.id) {
      throw new Error('Wallet not initialized');
    }

    try {
      await walletService.depositToSavingsGoal(wallet.id, savingsGoalId, amountCents);
      await fetchGoals();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [wallet?.id, fetchGoals]);

  const withdraw = useCallback(async (savingsGoalId: string, amountCents: number) => {
    if (!wallet?.id) {
      throw new Error('Wallet not initialized');
    }

    try {
      await walletService.withdrawFromSavingsGoal(wallet.id, savingsGoalId, amountCents);
      await fetchGoals();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [wallet?.id, fetchGoals]);

  const totalSavings = goals.reduce((sum, g) => sum + g.currentBalanceCents, 0);

  return {
    goals,
    goalTypes,
    loading,
    error,
    totalSavings,
    totalSavingsFormatted: formatCurrency(totalSavings),
    refresh: fetchGoals,
    createGoal,
    deposit,
    withdraw
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT PREFERENCES HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await walletService.getPayoutPreferences(user.id);
      setPreferences(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const setPreference = useCallback(async (
    scope: 'default' | 'circle_specific',
    destination: 'wallet' | 'bank' | 'savings_goal' | 'split',
    options: {
      circleId?: string;
      bankAccountId?: string;
      savingsGoalId?: string;
      splitConfig?: any;
    } = {}
  ) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    try {
      await walletService.setPayoutPreference(user.id, scope, destination, options);
      await fetchPreferences();
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user?.id, fetchPreferences]);

  const defaultPreference = preferences.find(p => p.preference_scope === 'default');

  return {
    preferences,
    defaultPreference,
    loading,
    error,
    refresh: fetchPreferences,
    setPreference
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT DESTINATION OPTIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutDestinationOptions(payoutAmountCents: number) {
  const { user } = useAuth();
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOptions = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const data = await walletService.getPayoutDestinationOptions(user.id, payoutAmountCents);
        setOptions(data);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [user?.id, payoutAmountCents]);

  const walletOption = options.find(o => o.id === 'wallet');
  const savingsOptions = options.filter(o => o.id.startsWith('savings_'));
  const bankOptions = options.filter(o => o.id.startsWith('bank_'));
  const splitOption = options.find(o => o.id === 'split');

  return {
    options,
    walletOption,
    savingsOptions,
    bankOptions,
    splitOption,
    loading,
    error
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function usePayoutExecutions(options: {
  circleId?: string;
  limit?: number;
} = {}) {
  const { user } = useAuth();
  const [executions, setExecutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);

        let query = supabase
          .from('payout_executions')
          .select(`
            *,
            circle:circles(name),
            cycle:circle_cycles(cycle_number)
          `)
          .eq('recipient_user_id', user.id)
          .order('created_at', { ascending: false });

        if (options.circleId) {
          query = query.eq('circle_id', options.circleId);
        }

        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setExecutions(data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [user?.id, options.circleId, options.limit]);

  const completedTotal = executions
    .filter(e => e.execution_status === 'completed')
    .reduce((sum, e) => sum + e.net_amount_cents, 0);

  return {
    executions,
    loading,
    error,
    completedTotal,
    completedTotalFormatted: formatCurrency(completedTotal)
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONEY RETENTION STATS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoneyRetentionStats() {
  const { wallet } = useWallet();

  const totalPayouts = wallet?.totalPayoutsReceivedCents || 0;
  const totalWithdrawals = wallet?.totalWithdrawalsCents || 0;
  const retained = totalPayouts - totalWithdrawals;
  const retentionRate = wallet?.moneyRetentionRate || 1;

  return {
    totalPayouts,
    totalWithdrawals,
    retained,
    retentionRate,
    retentionPercentage: Math.round(retentionRate * 100),
    formatted: {
      totalPayouts: formatCurrency(totalPayouts),
      totalWithdrawals: formatCurrency(totalWithdrawals),
      retained: formatCurrency(retained)
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET ACTIONS HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useWalletActions() {
  const { user } = useAuth();
  const { wallet, refresh } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(async (
    amountCents: number,
    source: string,
    metadata: Record<string, any> = {}
  ) => {
    if (!wallet?.id || !user?.id) {
      throw new Error('Wallet not initialized');
    }

    try {
      setIsProcessing(true);
      setError(null);

      // In production, this would initiate an external deposit
      // For now, we just credit the wallet
      await walletService.creditWallet(
        wallet.id,
        amountCents,
        'deposit',
        'external',
        user.id,
        `Deposit from ${source}`,
        metadata
      );

      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [wallet?.id, user?.id, refresh]);

  const withdraw = useCallback(async (
    amountCents: number,
    bankAccountId: string
  ) => {
    if (!wallet?.id || !user?.id) {
      throw new Error('Wallet not initialized');
    }

    if (wallet.mainBalanceCents < amountCents) {
      throw new Error('Insufficient balance');
    }

    try {
      setIsProcessing(true);
      setError(null);

      await walletService.debitWallet(
        wallet.id,
        amountCents,
        'withdrawal',
        'bank_account',
        bankAccountId,
        'Withdrawal to bank account',
        {}
      );

      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [wallet?.id, wallet?.mainBalanceCents, user?.id, refresh]);

  const transferToSavings = useCallback(async (
    savingsGoalId: string,
    amountCents: number
  ) => {
    if (!wallet?.id) {
      throw new Error('Wallet not initialized');
    }

    try {
      setIsProcessing(true);
      setError(null);

      await walletService.depositToSavingsGoal(wallet.id, savingsGoalId, amountCents);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [wallet?.id, refresh]);

  const processAutoReserve = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsProcessing(true);
      setError(null);

      await walletService.processAutoReservations(user.id);
      await refresh();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [user?.id, refresh]);

  return {
    deposit,
    withdraw,
    transferToSavings,
    processAutoReserve,
    isProcessing,
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
