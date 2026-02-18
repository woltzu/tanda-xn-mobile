// ══════════════════════════════════════════════════════════════════════════════
// XNSCORE HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the XnScore system
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  XnScoreEngine,
  XnScore,
  XnScoreInitialSignals,
  XnScoreHistory,
  Vouch,
  XnScoreTier,
  CircleEligibility,
  VouchLimits,
  VouchValue,
  VelocityCheck,
  ScoreAdjustmentResult,
  InitialScoreResult,
  LeaderboardEntry,
  TierDistribution,
  ScoreAdjustmentTrigger,
  SCORE_ADJUSTMENTS
} from '@/services/XnScoreEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MAIN SCORE HOOKS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get user's XnScore
 */
export function useXnScore(userId?: string) {
  const { user } = useAuth();
  const [score, setScore] = useState<XnScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchScore = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getXnScore(targetUserId);
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

  // Subscribe to realtime updates
  useEffect(() => {
    if (!targetUserId) return;

    const subscription = XnScoreEngine.subscribeToXnScore(targetUserId, () => {
      fetchScore();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [targetUserId, fetchScore]);

  // Computed values
  const tierInfo = useMemo(() => {
    if (!score) return null;
    return XnScoreEngine.getTierInfo(score.score_tier);
  }, [score]);

  const progressToNextTier = useMemo(() => {
    if (!score) return null;
    return XnScoreEngine.getProgressToNextTier(score.total_score);
  }, [score]);

  const nextCapMilestone = useMemo(() => {
    if (!score) return null;
    return XnScoreEngine.getNextCapMilestone(score.account_age_days);
  }, [score]);

  return {
    score,
    loading,
    error,
    refetch: fetchScore,
    tierInfo,
    progressToNextTier,
    nextCapMilestone
  };
}

/**
 * Hook to get detailed XnScore with user info
 */
export function useXnScoreDetails(userId?: string) {
  const { user } = useAuth();
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchDetails = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getXnScoreDetails(targetUserId);
      setDetails(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { details, loading, error, refetch: fetchDetails };
}

/**
 * Hook to get initial score signals
 */
export function useInitialScoreSignals(userId?: string) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<XnScoreInitialSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchSignals = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getInitialSignals(targetUserId);
      setSignals(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return { signals, loading, error, refetch: fetchSignals };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SCORE HISTORY HOOKS                                                         │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get score history
 */
export function useXnScoreHistory(userId?: string, limit: number = 50) {
  const { user } = useAuth();
  const [history, setHistory] = useState<XnScoreHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getScoreHistory(targetUserId, limit);
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

  // Summary statistics
  const summary = useMemo(() => {
    if (history.length === 0) return null;

    const positiveChanges = history.filter(h => h.score_change > 0);
    const negativeChanges = history.filter(h => h.score_change < 0);

    return {
      totalEvents: history.length,
      positiveEvents: positiveChanges.length,
      negativeEvents: negativeChanges.length,
      totalGained: positiveChanges.reduce((sum, h) => sum + h.score_change, 0),
      totalLost: Math.abs(negativeChanges.reduce((sum, h) => sum + h.score_change, 0)),
      velocityCappedCount: history.filter(h => h.velocity_capped).length
    };
  }, [history]);

  return { history, loading, error, refetch: fetchHistory, summary };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SCORE ADJUSTMENT HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for score adjustment actions
 */
export function useXnScoreAdjustments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyAdjustment = async (
    adjustment: number,
    trigger: ScoreAdjustmentTrigger,
    triggerId?: string
  ): Promise<ScoreAdjustmentResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await XnScoreEngine.applyAdjustment(adjustment, trigger, triggerId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const applyPredefinedAdjustment = async (
    type: keyof typeof SCORE_ADJUSTMENTS,
    triggerId?: string
  ): Promise<ScoreAdjustmentResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await XnScoreEngine.applyPredefinedAdjustment(type, triggerId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    applyAdjustment,
    applyPredefinedAdjustment,
    clearError: () => setError(null)
  };
}

/**
 * Hook to check velocity cap
 */
export function useVelocityCap(requestedIncrease: number) {
  const { user } = useAuth();
  const [velocityCheck, setVelocityCheck] = useState<VelocityCheck | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user || requestedIncrease <= 0) {
        setVelocityCheck(null);
        return;
      }

      setLoading(true);
      try {
        const result = await XnScoreEngine.checkVelocityCap(requestedIncrease);
        setVelocityCheck(result);
      } catch {
        setVelocityCheck(null);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [user, requestedIncrease]);

  return { velocityCheck, loading };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ INITIAL SCORE CALCULATION HOOKS                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to calculate initial score
 */
export function useCalculateInitialScore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InitialScoreResult | null>(null);

  const calculateScore = async (userId?: string): Promise<InitialScoreResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.calculateInitialScore(userId);
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, calculateScore };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CIRCLE ELIGIBILITY HOOKS                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to check circle eligibility
 */
export function useCircleEligibility(circleId: string | null) {
  const { user } = useAuth();
  const [eligibility, setEligibility] = useState<CircleEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!circleId || !user) {
      setEligibility(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.checkCircleEligibility(circleId);
      setEligibility(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, user]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  return { eligibility, loading, error, refetch: checkEligibility };
}

/**
 * Hook to get score requirements for circle amounts
 */
export function useScoreRequirements(contributionAmount: number) {
  return useMemo(() => ({
    minScore: XnScoreEngine.getMinScoreForAmount(contributionAmount),
    minAccountAgeDays: XnScoreEngine.getMinAccountAgeForAmount(contributionAmount)
  }), [contributionAmount]);
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ VOUCHING HOOKS                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get vouch limits
 */
export function useVouchLimits(userId?: string) {
  const { user } = useAuth();
  const [limits, setLimits] = useState<VouchLimits | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchLimits = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getVouchLimits(targetUserId);
      setLimits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  return { limits, loading, error, refetch: fetchLimits };
}

/**
 * Hook to calculate potential vouch value
 */
export function useVouchValue(voucheeId: string | null) {
  const { user } = useAuth();
  const [value, setValue] = useState<VouchValue | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const calculate = async () => {
      if (!voucheeId || !user) {
        setValue(null);
        return;
      }

      setLoading(true);
      try {
        const data = await XnScoreEngine.calculateVouchValue(voucheeId);
        setValue(data);
      } catch {
        setValue(null);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [voucheeId, user]);

  return { value, loading };
}

/**
 * Hook for vouch actions
 */
export function useVouchActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createVouch = async (
    voucheeId: string,
    reason?: string,
    relationshipType?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const vouchId = await XnScoreEngine.createVouch(voucheeId, reason, relationshipType);
      return vouchId;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const revokeVouch = async (vouchId: string, reason?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await XnScoreEngine.revokeVouch(vouchId, reason);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createVouch,
    revokeVouch,
    clearError: () => setError(null)
  };
}

/**
 * Hook to get vouches received
 */
export function useVouchesReceived(userId?: string) {
  const { user } = useAuth();
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchVouches = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getVouchesReceived(targetUserId);
      setVouches(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchVouches();
  }, [fetchVouches]);

  // Subscribe to new vouches
  useEffect(() => {
    if (!targetUserId) return;

    const subscription = XnScoreEngine.subscribeToVouches(targetUserId, () => {
      fetchVouches();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [targetUserId, fetchVouches]);

  const activeVouches = useMemo(() =>
    vouches.filter(v => v.vouch_status === 'active'),
    [vouches]
  );

  return { vouches, activeVouches, loading, error, refetch: fetchVouches };
}

/**
 * Hook to get vouches given
 */
export function useVouchesGiven(userId?: string) {
  const { user } = useAuth();
  const [vouches, setVouches] = useState<Vouch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchVouches = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getVouchesGiven(targetUserId);
      setVouches(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchVouches();
  }, [fetchVouches]);

  const activeVouches = useMemo(() =>
    vouches.filter(v => v.vouch_status === 'active'),
    [vouches]
  );

  return { vouches, activeVouches, loading, error, refetch: fetchVouches };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ LEADERBOARD & STATISTICS HOOKS                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get leaderboard
 */
export function useXnScoreLeaderboard(limit: number = 100) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getLeaderboard(limit);
      setLeaderboard(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return { leaderboard, loading, error, refetch: fetchLeaderboard };
}

/**
 * Hook to get tier distribution
 */
export function useTierDistribution() {
  const [distribution, setDistribution] = useState<TierDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistribution = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreEngine.getTierDistribution();
      setDistribution(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDistribution();
  }, [fetchDistribution]);

  return { distribution, loading, error, refetch: fetchDistribution };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TIER UTILITY HOOKS                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get tier info from a score
 */
export function useTierInfo(score: number | null) {
  return useMemo(() => {
    if (score === null) return null;
    const tier = XnScoreEngine.getTierFromScore(score);
    return XnScoreEngine.getTierInfo(tier);
  }, [score]);
}

/**
 * Hook to get age cap info
 */
export function useAgeCap(accountAgeDays: number | null) {
  return useMemo(() => {
    if (accountAgeDays === null) return null;

    const currentCap = XnScoreEngine.getAgeBasedCap(accountAgeDays);
    const nextMilestone = XnScoreEngine.getNextCapMilestone(accountAgeDays);

    return {
      currentCap,
      nextMilestone,
      daysUntilNextCap: nextMilestone ? nextMilestone.days - accountAgeDays : null
    };
  }, [accountAgeDays]);
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD HOOK                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive hook for XnScore dashboard
 */
export function useXnScoreDashboard() {
  const { user } = useAuth();
  const { score, loading: scoreLoading, tierInfo, progressToNextTier, nextCapMilestone } = useXnScore();
  const { signals, loading: signalsLoading } = useInitialScoreSignals();
  const { history, summary: historySummary, loading: historyLoading } = useXnScoreHistory(undefined, 20);
  const { limits, loading: limitsLoading } = useVouchLimits();
  const { activeVouches: vouchesReceived } = useVouchesReceived();
  const { activeVouches: vouchesGiven } = useVouchesGiven();

  const loading = scoreLoading || signalsLoading || historyLoading || limitsLoading;

  // Recent score changes
  const recentChanges = useMemo(() => {
    return history.slice(0, 5);
  }, [history]);

  // Score breakdown for chart
  const scoreBreakdown = useMemo(() => {
    if (!score) return null;

    return [
      { name: 'Payment History', value: score.payment_history_score, max: 35 },
      { name: 'Circle Completion', value: score.completion_score, max: 25 },
      { name: 'Time Reliability', value: score.time_reliability_score, max: 20 },
      { name: 'Security Deposit', value: score.deposit_score, max: 10 },
      { name: 'Diversity & Social', value: score.diversity_social_score, max: 7 },
      { name: 'Engagement', value: score.engagement_score, max: 3 }
    ];
  }, [score]);

  return {
    user,
    loading,
    score,
    signals,
    tierInfo,
    progressToNextTier,
    nextCapMilestone,
    recentChanges,
    historySummary,
    vouchLimits: limits,
    vouchesReceived: vouchesReceived.length,
    vouchesGiven: vouchesGiven.length,
    scoreBreakdown,
    ageCap: score ? {
      current: score.max_allowed_score,
      accountAgeDays: score.account_age_days,
      isApplied: score.age_cap_applied
    } : null,
    velocity: score ? {
      pointsThisWeek: score.points_gained_this_week,
      weeklyLimit: 5,
      remaining: 5 - score.points_gained_this_week
    } : null
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DECAY/GROWTH HOOKS                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

import {
  XnScoreDecayEngine,
  DecayHistory,
  TenureHistory,
  RecoveryPeriod,
  DecayAtRiskUser,
  TenureEligibleUser,
  RecoveryPeriodUser,
  ActivitySummary,
  DecayResult,
  TenureBonusResult,
  BatchProcessResult
} from '@/services/XnScoreEngine';

/**
 * Hook to get decay history
 */
export function useDecayHistory(userId?: string, limit: number = 50) {
  const { user } = useAuth();
  const [history, setHistory] = useState<DecayHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getDecayHistory(targetUserId, limit);
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

  // Summary statistics
  const summary = useMemo(() => {
    if (history.length === 0) return null;

    return {
      totalDecayEvents: history.length,
      totalDecayAmount: history.reduce((sum, h) => sum + h.decay_amount, 0),
      latestDecay: history[0],
      maxSingleDecay: Math.max(...history.map(h => h.decay_amount)),
      decayReasons: [...new Set(history.map(h => h.decay_reason))]
    };
  }, [history]);

  return { history, loading, error, refetch: fetchHistory, summary };
}

/**
 * Hook to get tenure history
 */
export function useTenureHistory(userId?: string, limit: number = 50) {
  const { user } = useAuth();
  const [history, setHistory] = useState<TenureHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getTenureHistory(targetUserId, limit);
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

  // Summary
  const summary = useMemo(() => {
    if (history.length === 0) return null;

    return {
      totalMonthsEarned: history.length,
      totalBonusEarned: history.reduce((sum, h) => sum + h.bonus_amount, 0),
      remainingBonus: XnScoreDecayEngine.MAX_TENURE_BONUS - history.reduce((sum, h) => sum + h.bonus_amount, 0),
      latestMonth: history[0]?.tenure_month || 0
    };
  }, [history]);

  return { history, loading, error, refetch: fetchHistory, summary };
}

/**
 * Hook to get recovery periods
 */
export function useRecoveryPeriods(userId?: string, activeOnly: boolean = false) {
  const { user } = useAuth();
  const [periods, setPeriods] = useState<RecoveryPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchPeriods = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getRecoveryPeriods(targetUserId, activeOnly);
      setPeriods(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, activeOnly]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  // Subscribe to changes
  useEffect(() => {
    if (!targetUserId) return;

    const subscription = XnScoreDecayEngine.subscribeToRecoveryPeriod(targetUserId, () => {
      fetchPeriods();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [targetUserId, fetchPeriods]);

  const activePeriod = useMemo(() =>
    periods.find(p => p.is_active && new Date(p.ends_at) > new Date()),
    [periods]
  );

  return { periods, activePeriod, loading, error, refetch: fetchPeriods };
}

/**
 * Hook to check current recovery status
 */
export function useRecoveryStatus(userId?: string) {
  const { user } = useAuth();
  const [isInRecovery, setIsInRecovery] = useState(false);
  const [currentPeriod, setCurrentPeriod] = useState<RecoveryPeriod | null>(null);
  const [loading, setLoading] = useState(false);

  const targetUserId = userId || user?.id;

  useEffect(() => {
    const check = async () => {
      if (!targetUserId) return;

      setLoading(true);
      try {
        const inRecovery = await XnScoreDecayEngine.isInRecoveryPeriod(targetUserId);
        setIsInRecovery(inRecovery);

        if (inRecovery) {
          const period = await XnScoreDecayEngine.getCurrentRecoveryPeriod(targetUserId);
          setCurrentPeriod(period);
        } else {
          setCurrentPeriod(null);
        }
      } catch {
        setIsInRecovery(false);
        setCurrentPeriod(null);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [targetUserId]);

  const daysRemaining = useMemo(() => {
    if (!currentPeriod) return 0;
    return XnScoreDecayEngine.getRecoveryDaysRemaining(currentPeriod.ends_at);
  }, [currentPeriod]);

  return {
    isInRecovery,
    currentPeriod,
    daysRemaining,
    recoveryMultiplier: currentPeriod?.recovery_multiplier || 1,
    loading
  };
}

/**
 * Hook to get activity summary
 */
export function useActivitySummary(userId?: string) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchSummary = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getActivitySummary(targetUserId);
      setSummary(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

/**
 * Hook to get decay risk information
 */
export function useDecayRisk(userId?: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { summary } = useActivitySummary(userId || user?.id);

  const riskInfo = useMemo(() => {
    if (!summary) return null;

    const riskLevel = XnScoreDecayEngine.getDecayRiskLevel(summary.financial_inactive_days);
    const nextThreshold = XnScoreDecayEngine.getNextDecayThreshold(summary.financial_inactive_days);

    return {
      riskLevel,
      inactiveDays: summary.financial_inactive_days,
      totalPenalty: summary.total_inactivity_penalty,
      floorReached: summary.decay_floor_reached,
      nextThreshold,
      lastActivity: summary.last_financial_activity_at
        ? new Date(summary.last_financial_activity_at)
        : null,
      activityStatus: summary.activity_status
    };
  }, [summary]);

  return { riskInfo, loading };
}

/**
 * Hook to get tenure progress
 */
export function useTenureProgress(userId?: string) {
  const { score } = useXnScore(userId);
  const { summary: tenureSummary } = useTenureHistory(userId);

  const progress = useMemo(() => {
    if (!score) return null;

    const tenureBonus = (score as any).tenure_bonus || 0;
    const tenureMonths = (score as any).tenure_months_earned || 0;

    return {
      currentBonus: tenureBonus,
      monthsEarned: tenureMonths,
      maxBonus: XnScoreDecayEngine.MAX_TENURE_BONUS,
      remainingBonus: XnScoreDecayEngine.getRemainingTenureBonus(tenureBonus),
      monthsUntilMax: XnScoreDecayEngine.getMonthsUntilMaxTenure(tenureMonths),
      progressPercent: Math.round((tenureBonus / XnScoreDecayEngine.MAX_TENURE_BONUS) * 100)
    };
  }, [score]);

  return { progress, tenureSummary };
}

/**
 * Hook for decay/growth actions
 */
export function useDecayGrowthActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateActivity = async (
    activityType: 'contribution' | 'payout' | 'wallet_deposit' | 'savings' | 'remittance',
    userId?: string,
    eventId?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const currentUserId = userId || (await (await import('@/lib/supabase')).supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) throw new Error('User ID required');

      const result = await XnScoreDecayEngine.updateFinancialActivity(currentUserId, activityType, eventId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const startRecovery = async (
    trigger: string,
    userId?: string,
    triggerId?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const currentUserId = userId || (await (await import('@/lib/supabase')).supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) throw new Error('User ID required');

      const recoveryId = await XnScoreDecayEngine.startRecoveryPeriod(currentUserId, trigger, triggerId);
      return recoveryId;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const endRecovery = async (userId?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const currentUserId = userId || (await (await import('@/lib/supabase')).supabase.auth.getUser()).data.user?.id;
      if (!currentUserId) throw new Error('User ID required');

      const result = await XnScoreDecayEngine.endRecoveryPeriod(currentUserId);
      return result;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    updateActivity,
    startRecovery,
    endRecovery,
    clearError: () => setError(null)
  };
}

/**
 * Hook to get users at risk of decay (admin)
 */
export function useDecayAtRiskUsers() {
  const [users, setUsers] = useState<DecayAtRiskUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getDecayAtRiskUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Grouped by risk level
  const grouped = useMemo(() => ({
    critical: users.filter(u => u.risk_level === 'critical'),
    severe: users.filter(u => u.risk_level === 'severe'),
    high: users.filter(u => u.risk_level === 'high'),
    moderate: users.filter(u => u.risk_level === 'moderate'),
    warning: users.filter(u => u.risk_level === 'warning'),
    low: users.filter(u => u.risk_level === 'low')
  }), [users]);

  return { users, grouped, loading, error, refetch: fetchUsers };
}

/**
 * Hook to get users eligible for tenure bonus (admin)
 */
export function useTenureEligibleUsers() {
  const [users, setUsers] = useState<TenureEligibleUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getTenureEligibleUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const activeUsers = useMemo(() =>
    users.filter(u => u.active_this_month),
    [users]
  );

  return { users, activeUsers, loading, error, refetch: fetchUsers };
}

/**
 * Hook to get users in recovery period (admin)
 */
export function useRecoveryPeriodUsers() {
  const [users, setUsers] = useState<RecoveryPeriodUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await XnScoreDecayEngine.getRecoveryPeriodUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, loading, error, refetch: fetchUsers };
}

/**
 * Comprehensive hook for decay/growth dashboard
 */
export function useDecayGrowthDashboard(userId?: string) {
  const { score, loading: scoreLoading } = useXnScore(userId);
  const { summary: activitySummary, loading: activityLoading } = useActivitySummary(userId);
  const { riskInfo } = useDecayRisk(userId);
  const { progress: tenureProgress } = useTenureProgress(userId);
  const { isInRecovery, currentPeriod, daysRemaining, loading: recoveryLoading } = useRecoveryStatus(userId);
  const { history: decayHistory, summary: decaySummary } = useDecayHistory(userId, 10);
  const { history: tenureHistory, summary: tenureSummary } = useTenureHistory(userId, 10);

  const loading = scoreLoading || activityLoading || recoveryLoading;

  // Calculate health score
  const healthScore = useMemo(() => {
    if (!activitySummary || !score) return null;

    let health = 100;

    // Deduct for inactivity
    if (activitySummary.financial_inactive_days >= 30) health -= 20;
    if (activitySummary.financial_inactive_days >= 60) health -= 20;
    if (activitySummary.financial_inactive_days >= 90) health -= 20;

    // Deduct for decay penalty
    if (activitySummary.total_inactivity_penalty > 0) {
      health -= Math.min(20, activitySummary.total_inactivity_penalty);
    }

    // Add for tenure
    const tenureBonus = (score as any).tenure_bonus || 0;
    health += Math.min(20, tenureBonus);

    // Add for recovery period
    if (isInRecovery) health += 10;

    return Math.max(0, Math.min(100, health));
  }, [activitySummary, score, isInRecovery]);

  return {
    loading,
    score,
    activitySummary,
    riskInfo,
    tenureProgress,
    recovery: {
      isActive: isInRecovery,
      period: currentPeriod,
      daysRemaining
    },
    decayHistory,
    decaySummary,
    tenureHistory,
    tenureSummary,
    healthScore,
    recommendations: useMemo(() => {
      const recs: string[] = [];

      if (riskInfo?.riskLevel && ['warning', 'moderate', 'high', 'severe', 'critical'].includes(riskInfo.riskLevel)) {
        recs.push('Make a contribution to reset inactivity timer');
      }

      if (tenureProgress?.remainingBonus && tenureProgress.remainingBonus > 0) {
        recs.push(`Stay active to earn +${tenureProgress.remainingBonus} more tenure bonus`);
      }

      if (isInRecovery) {
        recs.push(`You're in recovery! Earn 1.5x bonus for ${daysRemaining} more days`);
      }

      return recs;
    }, [riskInfo, tenureProgress, isInRecovery, daysRemaining])
  };
}
