/**
 * ══════════════════════════════════════════════════════════════════════════════
 * INSURANCE POOL HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the circle insurance pool system.
 * 5 hooks: useInsurancePool, usePoolTransactions, usePoolRate,
 *          usePoolCoverage, usePoolDistribution
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  InsurancePoolEngine,
  type InsurancePool,
  type PoolTransaction,
  type PoolTransactionType,
  type PoolRateHistory,
  type CoverageClaim,
  type WithholdingResult,
  type CoverageResult,
  type DistributionResult,
  type RateCalculationResult,
  type PoolStatus,
  type ClaimStatus,
} from '@/services/InsurancePoolEngine';

// Re-export all types for consumer convenience
export type {
  InsurancePool,
  PoolTransaction,
  PoolTransactionType,
  PoolRateHistory,
  CoverageClaim,
  WithholdingResult,
  CoverageResult,
  DistributionResult,
  RateCalculationResult,
  PoolStatus,
  ClaimStatus,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useInsurancePool — Primary hook with realtime
// ═══════════════════════════════════════════════════════════════════════════════

export function useInsurancePool(circleId?: string) {
  const [pool, setPool] = useState<InsurancePool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(async () => {
    if (!circleId) {
      setPool(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await InsurancePoolEngine.getPoolStatus(circleId);
      setPool(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch insurance pool');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  // Initial fetch
  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  // Realtime subscription
  useEffect(() => {
    if (!circleId) return;

    const channel = InsurancePoolEngine.subscribeToPool(circleId, () => {
      fetchPool();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId, fetchPool]);

  // Computed values
  const balanceFormatted = useMemo(() => {
    if (!pool) return '$0.00';
    return `$${(pool.balanceCents / 100).toFixed(2)}`;
  }, [pool]);

  const rateFormatted = useMemo(() => {
    if (!pool) return '2.00%';
    return `${(pool.currentRate * 100).toFixed(2)}%`;
  }, [pool]);

  return {
    pool,
    loading,
    error,
    refetch: fetchPool,
    balanceFormatted,
    rateFormatted,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePoolTransactions — Transaction history
// ═══════════════════════════════════════════════════════════════════════════════

export function usePoolTransactions(
  circleId?: string,
  type?: PoolTransactionType
) {
  const [transactions, setTransactions] = useState<PoolTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!circleId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await InsurancePoolEngine.getPoolTransactions(circleId, {
        type,
        limit: 100,
      });
      setTransactions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pool transactions');
    } finally {
      setLoading(false);
    }
  }, [circleId, type]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Computed totals
  const totals = useMemo(() => {
    const withheld = transactions
      .filter(t => t.transactionType === 'withholding')
      .reduce((sum, t) => sum + t.amountCents, 0);
    const payouts = transactions
      .filter(t => t.transactionType === 'coverage_payout')
      .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
    const distributed = transactions
      .filter(t => t.transactionType === 'distribution')
      .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

    return {
      totalWithheldCents: withheld,
      totalPayoutsCents: payouts,
      totalDistributedCents: distributed,
    };
  }, [transactions]);

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    totals,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePoolRate — Rate management + history
// ═══════════════════════════════════════════════════════════════════════════════

export function usePoolRate(circleId?: string) {
  const [currentRate, setCurrentRate] = useState<number>(0.02);
  const [rateHistory, setRateHistory] = useState<PoolRateHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  const fetchRate = useCallback(async () => {
    if (!circleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [pool, history] = await Promise.all([
        InsurancePoolEngine.getPoolStatus(circleId),
        InsurancePoolEngine.getPoolRateHistory(circleId),
      ]);

      if (pool) setCurrentRate(pool.currentRate);
      setRateHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch rate data');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const recalculate = useCallback(async (): Promise<RateCalculationResult | null> => {
    if (!circleId) return null;

    try {
      setRecalculating(true);
      setError(null);
      const result = await InsurancePoolEngine.calculateRate(circleId);
      setCurrentRate(result.newRate);
      await fetchRate(); // Refresh history
      return result;
    } catch (err: any) {
      setError(err.message || 'Rate recalculation failed');
      return null;
    } finally {
      setRecalculating(false);
    }
  }, [circleId, fetchRate]);

  const rateFormatted = useMemo(() => {
    return `${(currentRate * 100).toFixed(2)}%`;
  }, [currentRate]);

  return {
    currentRate,
    rateFormatted,
    rateHistory,
    loading,
    error,
    recalculating,
    recalculate,
    refetch: fetchRate,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePoolCoverage — Coverage claim details for a specific default
// ═══════════════════════════════════════════════════════════════════════════════

export function usePoolCoverage(defaultId?: string) {
  const [claim, setClaim] = useState<CoverageClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClaim = useCallback(async () => {
    if (!defaultId) {
      setClaim(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await InsurancePoolEngine.getCoverageClaim(defaultId);
      setClaim(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch coverage claim');
    } finally {
      setLoading(false);
    }
  }, [defaultId]);

  useEffect(() => {
    fetchClaim();
  }, [fetchClaim]);

  // Computed values
  const coverageFormatted = useMemo(() => {
    if (!claim) return null;
    return {
      shortfall: `$${(claim.shortfallAmountCents / 100).toFixed(2)}`,
      approved: `$${(claim.approvedAmountCents / 100).toFixed(2)}`,
      coveragePct: `${(claim.coveragePct * 100).toFixed(1)}%`,
      remaining: `$${((claim.shortfallAmountCents - claim.approvedAmountCents) / 100).toFixed(2)}`,
    };
  }, [claim]);

  return {
    claim,
    loading,
    error,
    refetch: fetchClaim,
    coverageFormatted,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// usePoolDistribution — Distribution state + actions
// ═══════════════════════════════════════════════════════════════════════════════

export function usePoolDistribution(circleId?: string) {
  const [pool, setPool] = useState<InsurancePool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);

  const fetchPool = useCallback(async () => {
    if (!circleId) {
      setPool(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await InsurancePoolEngine.getPoolStatus(circleId);
      setPool(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pool');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  const canDistribute = useMemo(() => {
    return pool !== null && pool.balanceCents > 0 && pool.status === 'active';
  }, [pool]);

  const distribute = useCallback(async (
    action: 'distribute' | 'rollover'
  ): Promise<DistributionResult | null> => {
    if (!circleId) return null;

    try {
      setDistributing(true);
      setError(null);
      const result = await InsurancePoolEngine.distributePool(circleId, action);
      await fetchPool(); // Refresh pool state
      return result;
    } catch (err: any) {
      setError(err.message || 'Distribution failed');
      return null;
    } finally {
      setDistributing(false);
    }
  }, [circleId, fetchPool]);

  const createRolloverVote = useCallback(async () => {
    if (!circleId) return null;

    try {
      setError(null);
      return await InsurancePoolEngine.createRolloverProposal(circleId);
    } catch (err: any) {
      setError(err.message || 'Failed to create rollover vote');
      return null;
    }
  }, [circleId]);

  return {
    pool,
    canDistribute,
    loading,
    error,
    distributing,
    distribute,
    createRolloverVote,
    refetch: fetchPool,
  };
}
