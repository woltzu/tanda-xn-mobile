// ══════════════════════════════════════════════════════════════════════════════
// SCORING PIPELINE HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the scoring pipeline: default probability, circle health,
// score alerts, and pipeline run status.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  scoringPipelineService,
  DefaultProbabilityScore,
  DefaultProbabilityHistory,
  CircleHealthScore,
  CircleHealthHistory,
  ScoreAlert,
  PipelineRun,
  PipelineResult,
} from '@/services/ScoringPipelineService';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DEFAULT PROBABILITY HOOKS                                                   │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a user's default probability score.
 */
export function useDefaultProbability(userId?: string) {
  const { user } = useAuth();
  const [score, setScore] = useState<DefaultProbabilityScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchScore = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getDefaultProbability(targetUserId);
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

  // Computed: risk level label
  const riskLabel = useMemo(() => {
    if (!score) return 'Unknown';
    const labels: Record<string, string> = {
      very_low: 'Very Low Risk',
      low: 'Low Risk',
      moderate: 'Moderate Risk',
      high: 'High Risk',
      very_high: 'Very High Risk',
    };
    return labels[score.riskBucket] || 'Unknown';
  }, [score]);

  // Computed: risk percentage (0-100)
  const riskPercentage = useMemo(() => {
    if (!score) return 0;
    return Math.round(score.predictedProbability * 100);
  }, [score]);

  return {
    score,
    loading,
    error,
    refetch: fetchScore,
    riskLabel,
    riskPercentage,
  };
}

/**
 * Hook to get default probability history for trend analysis.
 */
export function useDefaultProbabilityHistory(userId?: string, days: number = 90) {
  const { user } = useAuth();
  const [history, setHistory] = useState<DefaultProbabilityHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetUserId = userId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getDefaultProbabilityHistory(
        targetUserId,
        days
      );
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Computed: trend direction
  const trend = useMemo(() => {
    if (history.length < 2) return 'stable';
    const latest = history[0].probability;
    const previous = history[1].probability;
    if (latest > previous + 0.02) return 'worsening';
    if (latest < previous - 0.02) return 'improving';
    return 'stable';
  }, [history]);

  return { history, loading, error, refetch: fetchHistory, trend };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CIRCLE HEALTH HOOKS                                                        │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a circle's health score.
 */
export function useCircleHealth(circleId: string | null) {
  const [health, setHealth] = useState<CircleHealthScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    if (!circleId) {
      setHealth(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getCircleHealthScore(circleId);
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Computed: health breakdown for charts
  const breakdown = useMemo(() => {
    if (!health) return null;
    return [
      { name: 'Contribution Reliability', value: health.contributionReliabilityScore, weight: 40 },
      { name: 'Member Quality', value: health.memberQualityScore, weight: 25 },
      { name: 'Financial Stability', value: health.financialStabilityScore, weight: 20 },
      { name: 'Social Cohesion', value: health.socialCohesionScore, weight: 15 },
    ];
  }, [health]);

  return {
    health,
    loading,
    error,
    refetch: fetchHealth,
    breakdown,
  };
}

/**
 * Hook to get circle health history for trend analysis.
 */
export function useCircleHealthHistory(circleId: string | null, days: number = 90) {
  const [history, setHistory] = useState<CircleHealthHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!circleId) {
      setHistory([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getCircleHealthHistory(circleId, days);
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ALERT HOOKS                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get score alerts, optionally filtered.
 */
export function useScoreAlerts(targetType?: string, targetId?: string) {
  const [alerts, setAlerts] = useState<ScoreAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getActiveAlerts(targetType, targetId);
      setAlerts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Grouped by severity
  const grouped = useMemo(() => ({
    critical: alerts.filter(a => a.severity === 'critical'),
    warning: alerts.filter(a => a.severity === 'warning'),
    info: alerts.filter(a => a.severity === 'info'),
  }), [alerts]);

  return { alerts, loading, error, refetch: fetchAlerts, grouped };
}

/**
 * Hook to get the current user's alerts.
 */
export function useMyAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ScoreAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getUserAlerts(user.id);
      setAlerts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const unreadCount = useMemo(
    () => alerts.filter(a => a.status === 'open').length,
    [alerts]
  );

  return { alerts, loading, error, refetch: fetchAlerts, unreadCount };
}

/**
 * Hook to get alerts for a specific circle.
 */
export function useCircleAlerts(circleId: string) {
  const [alerts, setAlerts] = useState<ScoreAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getCircleAlerts(circleId);
      setAlerts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}

/**
 * Hook for alert actions (acknowledge, resolve, dismiss).
 */
export function useAlertActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acknowledge = async (alertId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      return await scoringPipelineService.acknowledgeAlert(alertId);
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resolve = async (alertId: string, notes: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      return await scoringPipelineService.resolveAlert(alertId, notes);
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const dismiss = async (alertId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      return await scoringPipelineService.dismissAlert(alertId);
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
    acknowledge,
    resolve,
    dismiss,
    clearError: () => setError(null),
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PIPELINE STATUS HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get recent pipeline run history (admin).
 */
export function usePipelineRuns(limit: number = 10) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.getRecentRuns(limit);
      setRuns(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const latestRun = useMemo(() => runs[0] || null, [runs]);

  // Pipeline health summary
  const health = useMemo(() => {
    if (runs.length === 0) return null;

    const last7 = runs.slice(0, 7);
    const successRate = last7.filter(r => r.status === 'completed').length / last7.length;
    const avgDuration = last7.reduce((sum, r) => sum + (r.totalDurationMs || 0), 0) / last7.length;

    return {
      successRate: Math.round(successRate * 100),
      avgDurationMs: Math.round(avgDuration),
      lastRunStatus: runs[0]?.status || 'unknown',
      lastRunAt: runs[0]?.startedAt || null,
    };
  }, [runs]);

  return { runs, loading, error, refetch: fetchRuns, latestRun, health };
}

/**
 * Hook to trigger pipeline manually (admin).
 */
export function useTriggerPipeline() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const trigger = async (): Promise<PipelineResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await scoringPipelineService.triggerPipeline();
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, result, trigger };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD COMPOSITE HOOK                                                   │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive hook for scoring dashboard — combines default probability,
 * alerts, and pipeline status for a single user.
 */
export function useScoringDashboard(userId?: string) {
  const {
    score: defaultProbability,
    loading: probLoading,
    riskLabel,
    riskPercentage,
  } = useDefaultProbability(userId);
  const { history: probHistory, trend: probTrend } = useDefaultProbabilityHistory(userId, 30);
  const { alerts, unreadCount } = useMyAlerts();
  const { latestRun, health: pipelineHealth } = usePipelineRuns(5);

  const loading = probLoading;

  // Overall risk assessment
  const riskSummary = useMemo(() => {
    if (!defaultProbability) return null;

    return {
      probability: defaultProbability.predictedProbability,
      bucket: defaultProbability.riskBucket,
      label: riskLabel,
      percentage: riskPercentage,
      trend: probTrend,
      confidence: defaultProbability.confidenceScore,
      signals: {
        payment: defaultProbability.paymentSignal,
        financial: defaultProbability.financialSignal,
        behavioral: defaultProbability.behavioralSignal,
        social: defaultProbability.socialSignal,
        tenure: defaultProbability.tenureSignal,
      },
    };
  }, [defaultProbability, riskLabel, riskPercentage, probTrend]);

  return {
    loading,
    riskSummary,
    probHistory,
    alerts,
    unreadAlertCount: unreadCount,
    latestPipelineRun: latestRun,
    pipelineHealth,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  DefaultProbabilityScore,
  DefaultProbabilityHistory,
  CircleHealthScore,
  CircleHealthHistory,
  ScoreAlert,
  PipelineRun,
  PipelineResult,
} from '@/services/ScoringPipelineService';
