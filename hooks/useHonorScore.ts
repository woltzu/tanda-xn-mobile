// ══════════════════════════════════════════════════════════════════════════════
// HONOR SCORE HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the honor score system: score data, history, pillar breakdown,
// on-demand computation, and dashboard composite.
// Three pillars: Community (30), Character (40), Expertise (30).
// Follows useXnScore.ts pattern.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  HonorScoreEngine,
  HonorScore,
  HonorScoreHistory,
  HonorScoreTier,
  HonorScoreTierInfo,
  HonorScorePillarBreakdown,
  HonorScoreProgressInfo,
} from '@/services/HonorScoreEngine';


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MAIN SCORE HOOK                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a user's current honor score with tier info and progress.
 */
export function useHonorScore(userId?: string) {
  const { user } = useAuth();
  const [score, setScore] = useState<HonorScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchScore = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await HonorScoreEngine.getHonorScore(targetUserId);
      setScore(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  // Realtime subscription
  useEffect(() => {
    if (!targetUserId) return;

    const subscription = HonorScoreEngine.subscribeToHonorScore(
      targetUserId,
      () => { fetchScore(); }
    );

    return () => { subscription.unsubscribe(); };
  }, [targetUserId, fetchScore]);

  // Computed: tier info
  const tierInfo = useMemo((): HonorScoreTierInfo | null => {
    if (!score) return null;
    return HonorScoreEngine.getTierInfo(score.scoreTier);
  }, [score]);

  // Computed: progress to next tier
  const progressToNextTier = useMemo((): HonorScoreProgressInfo | null => {
    if (!score) return null;
    return HonorScoreEngine.getProgressToNextTier(score.totalScore);
  }, [score]);

  return {
    score,
    loading,
    error,
    refetch: fetchScore,
    tierInfo,
    progressToNextTier,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ HISTORY HOOK                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get honor score history for trend analysis.
 */
export function useHonorScoreHistory(userId?: string, limit: number = 50) {
  const { user } = useAuth();
  const [history, setHistory] = useState<HonorScoreHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await HonorScoreEngine.getScoreHistory(targetUserId, limit);
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Computed: summary stats
  const summary = useMemo(() => {
    if (history.length === 0) return null;

    const positiveEvents = history.filter(h => h.scoreChange > 0);
    const negativeEvents = history.filter(h => h.scoreChange < 0);

    return {
      totalEvents: history.length,
      positiveEvents: positiveEvents.length,
      negativeEvents: negativeEvents.length,
      totalGained: positiveEvents.reduce((sum, h) => sum + h.scoreChange, 0),
      totalLost: negativeEvents.reduce((sum, h) => sum + h.scoreChange, 0),
      latestChange: history[0]?.scoreChange || 0,
    };
  }, [history]);

  return { history, loading, error, refetch: fetchHistory, summary };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ COMPUTE HOOK                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for on-demand honor score recomputation.
 */
export function useComputeHonorScore() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compute = async (userId?: string): Promise<number | null> => {
    const targetId = userId || user?.id;
    if (!targetId) return null;

    setLoading(true);
    setError(null);

    try {
      const result = await HonorScoreEngine.computeHonorScore(targetId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, compute, clearError: () => setError(null) };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PILLAR BREAKDOWN HOOK                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get the three-pillar breakdown of a user's honor score.
 * Pillars: Community (30), Character (40), Expertise (30).
 */
export function useHonorScorePillarBreakdown(userId?: string) {
  const { score, loading, error, refetch } = useHonorScore(userId);

  const pillars = useMemo((): HonorScorePillarBreakdown[] | null => {
    if (!score) return null;
    return HonorScoreEngine.getPillarBreakdown(score);
  }, [score]);

  // Detailed sub-component breakdown
  const subComponents = useMemo(() => {
    if (!score) return null;
    return {
      community: [
        { name: 'Circles Participation', value: score.circlesParticipationScore, max: 15 },
        { name: 'Community Engagement', value: score.communityEngagementScore, max: 15 },
      ],
      character: [
        { name: 'Vouch Given', value: score.vouchGivenScore, max: 20 },
        { name: 'Vouch Received', value: score.vouchReceivedScore, max: 10 },
        { name: 'Dispute Involvement', value: score.disputeInvolvementScore, max: 10 },
      ],
      expertise: [
        { name: 'Top 3 Domain Average', value: score.expertiseTop3Avg, max: 30 },
        { name: 'Active Domains', value: score.expertiseDomainsActive, max: 8 },
      ],
    };
  }, [score]);

  return { pillars, subComponents, loading, error, refetch };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD COMPOSITE HOOK                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive dashboard hook combining score, history, pillars, and tier info.
 */
export function useHonorScoreDashboard(userId?: string) {
  const {
    score,
    loading: scoreLoading,
    tierInfo,
    progressToNextTier,
    refetch: refetchScore,
  } = useHonorScore(userId);

  const {
    history,
    loading: historyLoading,
    summary: historySummary,
  } = useHonorScoreHistory(userId, 20);

  const { pillars, subComponents } = useHonorScorePillarBreakdown(userId);

  const loading = scoreLoading || historyLoading;

  // Weakest pillar (improvement opportunity)
  const weakestPillar = useMemo(() => {
    if (!pillars) return null;
    return [...pillars].sort((a, b) => a.percentage - b.percentage)[0] || null;
  }, [pillars]);

  // Trend from recent history
  const trend = useMemo(() => {
    if (history.length < 2) return 'stable';
    const recentChange = history[0]?.scoreChange || 0;
    if (recentChange > 1) return 'improving';
    if (recentChange < -1) return 'declining';
    return 'stable';
  }, [history]);

  return {
    score,
    loading,
    tierInfo,
    progressToNextTier,
    pillars,
    subComponents,
    history,
    historySummary,
    weakestPillar,
    trend,
    refetch: refetchScore,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  HonorScore,
  HonorScoreHistory,
  HonorScoreTier,
  HonorScoreTierInfo,
  HonorScorePillarBreakdown,
  HonorScoreProgressInfo,
} from '@/services/HonorScoreEngine';
