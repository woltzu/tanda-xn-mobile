// ══════════════════════════════════════════════════════════════════════════════
// SCORE BREAKDOWN HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for score transparency and factor breakdown features.
// ══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import {
  scoreBreakdownEngine,
  ScoreBreakdown,
  FactorDefinition,
  FactorComponentDefinition,
  ImprovementTip,
  BreakdownCache,
  FullRecalculationResult,
  FactorPerformanceSummary,
  FactorStatus,
  FactorTrend,
} from '@/services/ScoreBreakdownEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ QUERY KEYS                                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

const QUERY_KEYS = {
  breakdown: (userId: string) => ['score-breakdown', userId],
  breakdownCache: (userId: string) => ['score-breakdown-cache', userId],
  factorDefinitions: ['factor-definitions'],
  factorComponents: (factorId: string) => ['factor-components', factorId],
  factorsWithComponents: ['factors-with-components'],
  improvementTips: (userId: string, limit?: number) => ['improvement-tips', userId, limit],
  allTips: ['all-improvement-tips'],
  tipsForFactor: (factorKey: string) => ['tips-for-factor', factorKey],
  factorPerformance: ['factor-performance-summary'],
  improvementOpportunities: (limit?: number) => ['improvement-opportunities', limit],
  usersByFactorStatus: (factorKey: string, status: FactorStatus) => [
    'users-by-factor-status',
    factorKey,
    status,
  ],
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SCORE BREAKDOWN HOOKS                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get complete score breakdown for a user
 */
export function useScoreBreakdown(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.breakdown(userId!),
    queryFn: () => scoreBreakdownEngine.getScoreBreakdown(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to get cached breakdown (faster, may be stale)
 */
export function useCachedBreakdown(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.breakdownCache(userId!),
    queryFn: () => scoreBreakdownEngine.getCachedBreakdown(userId!),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to refresh breakdown cache
 */
export function useRefreshBreakdown() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => scoreBreakdownEngine.refreshBreakdownCache(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.breakdown(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.breakdownCache(userId) });
    },
  });
}

/**
 * Hook for full score recalculation
 */
export function useRecalculateScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => scoreBreakdownEngine.recalculateFullScore(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.breakdown(userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.breakdownCache(userId) });
      queryClient.invalidateQueries({ queryKey: ['xn-score', userId] });
    },
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ FACTOR DEFINITION HOOKS                                                     │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get all factor definitions
 */
export function useFactorDefinitions() {
  return useQuery({
    queryKey: QUERY_KEYS.factorDefinitions,
    queryFn: () => scoreBreakdownEngine.getFactorDefinitions(),
    staleTime: 60 * 60 * 1000, // 1 hour (rarely changes)
  });
}

/**
 * Hook to get components for a specific factor
 */
export function useFactorComponents(factorId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.factorComponents(factorId!),
    queryFn: () => scoreBreakdownEngine.getFactorComponents(factorId!),
    enabled: !!factorId,
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

/**
 * Hook to get all factors with their components
 */
export function useFactorsWithComponents() {
  return useQuery({
    queryKey: QUERY_KEYS.factorsWithComponents,
    queryFn: () => scoreBreakdownEngine.getFactorsWithComponents(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ IMPROVEMENT TIPS HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get personalized improvement tips for a user
 */
export function useImprovementTips(userId: string | undefined, limit: number = 5) {
  return useQuery({
    queryKey: QUERY_KEYS.improvementTips(userId!, limit),
    queryFn: () => scoreBreakdownEngine.getImprovementTips(userId!, limit),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get all available improvement tips
 */
export function useAllImprovementTips() {
  return useQuery({
    queryKey: QUERY_KEYS.allTips,
    queryFn: () => scoreBreakdownEngine.getAllImprovementTips(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to get tips for a specific factor
 */
export function useTipsForFactor(factorKey: string) {
  return useQuery({
    queryKey: QUERY_KEYS.tipsForFactor(factorKey),
    queryFn: () => scoreBreakdownEngine.getTipsForFactor(factorKey),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ANALYTICS HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get factor performance summary
 */
export function useFactorPerformanceSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.factorPerformance,
    queryFn: () => scoreBreakdownEngine.getFactorPerformanceSummary(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get improvement opportunities across all users
 */
export function useImprovementOpportunities(limit: number = 50) {
  return useQuery({
    queryKey: QUERY_KEYS.improvementOpportunities(limit),
    queryFn: () => scoreBreakdownEngine.getImprovementOpportunities(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get users by factor status
 */
export function useUsersByFactorStatus(factorKey: string, status: FactorStatus) {
  return useQuery({
    queryKey: QUERY_KEYS.usersByFactorStatus(factorKey, status),
    queryFn: () => scoreBreakdownEngine.getUsersByFactorStatus(factorKey, status),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ COMPUTED/DERIVED HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook that provides breakdown with computed helpers
 */
export function useScoreBreakdownWithHelpers(userId: string | undefined) {
  const { data: breakdown, isLoading, error, refetch } = useScoreBreakdown(userId);

  const computedData = useMemo(() => {
    if (!breakdown) return null;

    return {
      breakdown,
      healthScore: scoreBreakdownEngine.calculateHealthScore(breakdown),
      weakestFactor: scoreBreakdownEngine.getWeakestFactor(breakdown),
      topActions: scoreBreakdownEngine.getTopImprovementActions(breakdown, 3),
      factorStatuses: Object.entries(breakdown.factors).map(([key, factor]) => ({
        key,
        name: scoreBreakdownEngine.formatFactorName(key),
        icon: scoreBreakdownEngine.getFactorIcon(key),
        score: factor.score,
        maxScore: factor.max_score,
        percentage: factor.max_score > 0 ? Math.round((factor.score / factor.max_score) * 100) : 0,
        status: factor.status,
        statusInfo: scoreBreakdownEngine.getFactorStatusInfo(factor.status),
        trend: factor.trend,
        trendInfo: scoreBreakdownEngine.getFactorTrendInfo(factor.trend),
      })),
    };
  }, [breakdown]);

  return {
    ...computedData,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to get a specific factor's breakdown
 */
export function useFactorBreakdown(userId: string | undefined, factorKey: string) {
  const { data: breakdown, isLoading, error } = useScoreBreakdown(userId);

  const factorData = useMemo(() => {
    if (!breakdown) return null;

    const factor = breakdown.factors[factorKey as keyof typeof breakdown.factors];
    if (!factor) return null;

    return {
      ...factor,
      name: scoreBreakdownEngine.formatFactorName(factorKey),
      icon: scoreBreakdownEngine.getFactorIcon(factorKey),
      percentage: factor.max_score > 0 ? Math.round((factor.score / factor.max_score) * 100) : 0,
      statusInfo: scoreBreakdownEngine.getFactorStatusInfo(factor.status),
      trendInfo: scoreBreakdownEngine.getFactorTrendInfo(factor.trend),
      componentsList: Object.entries(factor.components || {}).map(([key, comp]) => ({
        key,
        ...comp,
        percentage: comp.max > 0 ? Math.round((comp.score / comp.max) * 100) : 0,
      })),
    };
  }, [breakdown, factorKey]);

  return {
    factorData,
    isLoading,
    error,
  };
}

/**
 * Hook to compare user's scores to averages
 */
export function useScoreComparison(userId: string | undefined) {
  const { data: breakdown } = useScoreBreakdown(userId);
  const { data: performanceSummary } = useFactorPerformanceSummary();

  const comparison = useMemo(() => {
    if (!breakdown || !performanceSummary) return null;

    const comparisons: Record<
      string,
      {
        userScore: number;
        avgScore: number;
        difference: number;
        percentile: string;
      }
    > = {};

    for (const summary of performanceSummary) {
      const factorKey = summary.factor;
      const userFactor = breakdown.factors[factorKey as keyof typeof breakdown.factors];

      if (userFactor) {
        const difference = userFactor.score - summary.avg_score;
        let percentile = 'average';

        if (difference > 5) percentile = 'above average';
        else if (difference > 10) percentile = 'well above average';
        else if (difference < -5) percentile = 'below average';
        else if (difference < -10) percentile = 'well below average';

        comparisons[factorKey] = {
          userScore: userFactor.score,
          avgScore: summary.avg_score,
          difference: Math.round(difference * 100) / 100,
          percentile,
        };
      }
    }

    return comparisons;
  }, [breakdown, performanceSummary]);

  return comparison;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ACTION HOOKS                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Combined hook for score breakdown actions
 */
export function useScoreBreakdownActions() {
  const refreshBreakdown = useRefreshBreakdown();
  const recalculateScore = useRecalculateScore();

  return {
    refreshBreakdown: refreshBreakdown.mutateAsync,
    isRefreshing: refreshBreakdown.isPending,
    refreshError: refreshBreakdown.error,

    recalculateScore: recalculateScore.mutateAsync,
    isRecalculating: recalculateScore.isPending,
    recalculateError: recalculateScore.error,
    recalculateResult: recalculateScore.data,
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD HOOK                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive hook for score breakdown dashboard
 */
export function useScoreBreakdownDashboard(userId: string | undefined) {
  const breakdownQuery = useScoreBreakdownWithHelpers(userId);
  const tipsQuery = useImprovementTips(userId, 5);
  const factorsQuery = useFactorDefinitions();
  const actions = useScoreBreakdownActions();

  return {
    // Breakdown data
    breakdown: breakdownQuery.breakdown,
    healthScore: breakdownQuery.healthScore,
    weakestFactor: breakdownQuery.weakestFactor,
    topActions: breakdownQuery.topActions,
    factorStatuses: breakdownQuery.factorStatuses,
    isBreakdownLoading: breakdownQuery.isLoading,
    breakdownError: breakdownQuery.error,
    refetchBreakdown: breakdownQuery.refetch,

    // Tips
    tips: tipsQuery.data || [],
    isTipsLoading: tipsQuery.isLoading,

    // Factor definitions
    factorDefinitions: factorsQuery.data || [],
    isFactorsLoading: factorsQuery.isLoading,

    // Actions
    ...actions,
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ UTILITY EXPORTS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

export {
  scoreBreakdownEngine,
  type ScoreBreakdown,
  type FactorDefinition,
  type FactorComponentDefinition,
  type ImprovementTip,
  type BreakdownCache,
  type FullRecalculationResult,
  type FactorPerformanceSummary,
  type FactorStatus,
  type FactorTrend,
};
