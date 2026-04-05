// ═══════════════════════════════════════════════════════════════════════════════
// useCircleMatchHistory.ts — #189 Circle Match History ML Training Seed Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 hooks:
//   useMatchHistory          — member's match history with ML columns
//   useTrainingDataStats     — ML training data volume + quality dashboard
//   useDataQualityLogs       — weekly data quality monitoring
//   useAlgorithmComparison   — A/B testing comparison between algorithm versions
//   useMatchHistoryActions   — all mutation actions (log events, run jobs)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CircleMatchHistoryEngine,
  type MatchAction,
  type OutcomeLabel,
  type AlgorithmVersion,
  type SessionContext,
  type MemberProfileSnapshot,
  type CircleProfileSnapshot,
  type MatchHistoryRecord,
  type DataQualityLog,
  type DataQualityIssue,
  type TrainingDataStats,
  type OutcomeLabelingResult,
} from '../services/CircleMatchHistoryEngine';

// Re-export types for consumers
export type {
  MatchAction,
  OutcomeLabel,
  AlgorithmVersion,
  SessionContext,
  MemberProfileSnapshot,
  CircleProfileSnapshot,
  MatchHistoryRecord,
  DataQualityLog,
  DataQualityIssue,
  TrainingDataStats,
  OutcomeLabelingResult,
};


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: useMatchHistory
// ─────────────────────────────────────────────────────────────────────────────

export function useMatchHistory(userId?: string, limit: number = 50) {
  const [records, setRecords] = useState<MatchHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await CircleMatchHistoryEngine.getMemberHistory(userId, limit);
      setRecords(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = CircleMatchHistoryEngine.subscribeToMemberHistory(userId, () => {
      fetchHistory();
    });
    return () => { channel.unsubscribe(); };
  }, [userId, fetchHistory]);

  const computed = useMemo(() => {
    const totalRecords = records.length;
    const viewCount = records.filter(r => r.action === 'viewed').length;
    const joinCount = records.filter(r => r.action === 'joined').length;
    const dismissCount = records.filter(r => r.action === 'dismissed').length;
    const returnCount = records.filter(r => r.action === 'returned').length;
    const shareCount = records.filter(r => r.action === 'shared').length;
    const joinRate = totalRecords > 0 ? Math.round(joinCount / totalRecords * 10000) / 100 : 0;

    const labeledRecords = records.filter(r => r.outcomeLabel && r.outcomeLabel !== 'pending');
    const successCount = labeledRecords.filter(r => r.outcomeLabel === 'success').length;
    const successRate = labeledRecords.length > 0
      ? Math.round(successCount / labeledRecords.length * 10000) / 100
      : 0;

    // Unique circles interacted with
    const uniqueCircles = new Set(records.map(r => r.circleId)).size;

    return {
      totalRecords,
      viewCount,
      joinCount,
      dismissCount,
      returnCount,
      shareCount,
      joinRate,
      successRate,
      uniqueCircles,
      hasRecords: totalRecords > 0,
    };
  }, [records]);

  return { records, loading, error, refresh: fetchHistory, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useTrainingDataStats
// ─────────────────────────────────────────────────────────────────────────────

export function useTrainingDataStats() {
  const [stats, setStats] = useState<TrainingDataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CircleMatchHistoryEngine.getTrainingDataStats();
      setStats(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const computed = useMemo(() => {
    if (!stats) return {
      hasEnoughData: false,
      labelingProgress: 0,
      snapshotCoverage: 0,
      dominantAction: null as string | null,
      volumeTarget: 10000,
      volumeProgress: 0,
    };

    const totalJoined = (stats.actionDistribution.joined ?? 0);
    const labelingProgress = totalJoined > 0
      ? Math.round(stats.labeledRecords / totalJoined * 100)
      : 0;

    const snapshotCoverage = stats.totalRecords > 0
      ? Math.round(stats.recordsWithSnapshots / stats.totalRecords * 100)
      : 0;

    // Find dominant action
    const actions = Object.entries(stats.actionDistribution) as [MatchAction, number][];
    const dominant = actions.sort((a, b) => b[1] - a[1])[0];

    return {
      hasEnoughData: stats.labeledRecords >= 10000,
      labelingProgress,
      snapshotCoverage,
      dominantAction: dominant ? dominant[0] : null,
      volumeTarget: 10000,
      volumeProgress: Math.round(stats.labeledRecords / 10000 * 100),
    };
  }, [stats]);

  return { stats, loading, error, refresh: fetchStats, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useDataQualityLogs
// ─────────────────────────────────────────────────────────────────────────────

export function useDataQualityLogs(limit: number = 12) {
  const [logs, setLogs] = useState<DataQualityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CircleMatchHistoryEngine.getQualityLogs(limit);
      setLogs(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Realtime
  useEffect(() => {
    const channel = CircleMatchHistoryEngine.subscribeToQualityLogs(() => {
      fetchLogs();
    });
    return () => { channel.unsubscribe(); };
  }, [fetchLogs]);

  const computed = useMemo(() => {
    const latestLog = logs[0] ?? null;
    const previousLog = logs[1] ?? null;

    const currentScore = latestLog?.overallQualityScore ?? 0;
    const previousScore = previousLog?.overallQualityScore ?? 0;
    const scoreTrend = latestLog && previousLog
      ? (currentScore > previousScore ? 'improving' : currentScore < previousScore ? 'declining' : 'stable')
      : 'unknown';

    const allIssues = latestLog?.issues ?? [];
    const criticalIssues = allIssues.filter(i => i.severity === 'critical');
    const warningIssues = allIssues.filter(i => i.severity === 'warning');

    return {
      latestLog,
      currentScore,
      scoreTrend: scoreTrend as 'improving' | 'declining' | 'stable' | 'unknown',
      hasCriticalIssues: criticalIssues.length > 0,
      criticalIssues,
      warningIssues,
      totalLogs: logs.length,
      avgScore: logs.length > 0
        ? Math.round(logs.reduce((sum, l) => sum + l.overallQualityScore, 0) / logs.length)
        : 0,
    };
  }, [logs]);

  return { logs, loading, error, refresh: fetchLogs, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useAlgorithmComparison
// ─────────────────────────────────────────────────────────────────────────────

export function useAlgorithmComparison(versionA?: string, versionB?: string) {
  const [comparison, setComparison] = useState<{
    versionA: { version: string; total: number; joinRate: number; dismissRate: number; successRate: number };
    versionB: { version: string; total: number; joinRate: number; dismissRate: number; successRate: number };
    winner: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!versionA || !versionB) return;
    setLoading(true);
    setError(null);
    try {
      const result = await CircleMatchHistoryEngine.compareAlgorithms(versionA, versionB);
      setComparison(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [versionA, versionB]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const computed = useMemo(() => {
    if (!comparison) return {
      hasWinner: false,
      winner: null as string | null,
      joinRateDelta: 0,
      successRateDelta: 0,
      sufficientData: false,
    };

    return {
      hasWinner: comparison.winner !== null,
      winner: comparison.winner,
      joinRateDelta: Math.round((comparison.versionA.joinRate - comparison.versionB.joinRate) * 100) / 100,
      successRateDelta: Math.round((comparison.versionA.successRate - comparison.versionB.successRate) * 100) / 100,
      sufficientData: comparison.versionA.total >= 50 && comparison.versionB.total >= 50,
    };
  }, [comparison]);

  return { comparison, loading, error, refresh: fetchComparison, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useMatchHistoryActions
// ─────────────────────────────────────────────────────────────────────────────

export function useMatchHistoryActions() {
  const [logging, setLogging] = useState(false);
  const [runningOutcomeLabeling, setRunningOutcomeLabeling] = useState(false);
  const [runningQualityCheck, setRunningQualityCheck] = useState(false);

  const logInteraction = useCallback(async (
    userId: string,
    circleId: string,
    action: MatchAction,
    matchScores: {
      matchScore: number;
      affordabilityScore?: number;
      trustScore?: number;
      compatibilityScore?: number;
    },
    sessionContext: Partial<SessionContext>,
    algorithmVersion?: string,
    actionReason?: string
  ) => {
    setLogging(true);
    try {
      return await CircleMatchHistoryEngine.logInteraction(
        userId, circleId, action, matchScores, sessionContext, algorithmVersion, actionReason
      );
    } finally {
      setLogging(false);
    }
  }, []);

  const logView = useCallback(async (
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion?: string
  ) => {
    setLogging(true);
    try {
      return await CircleMatchHistoryEngine.logView(userId, circleId, matchScore, sessionContext, algorithmVersion);
    } finally {
      setLogging(false);
    }
  }, []);

  const logReturn = useCallback(async (
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion?: string
  ) => {
    setLogging(true);
    try {
      return await CircleMatchHistoryEngine.logReturn(userId, circleId, matchScore, sessionContext, algorithmVersion);
    } finally {
      setLogging(false);
    }
  }, []);

  const logShare = useCallback(async (
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion?: string
  ) => {
    setLogging(true);
    try {
      return await CircleMatchHistoryEngine.logShare(userId, circleId, matchScore, sessionContext, algorithmVersion);
    } finally {
      setLogging(false);
    }
  }, []);

  const runOutcomeLabeling = useCallback(async () => {
    setRunningOutcomeLabeling(true);
    try {
      return await CircleMatchHistoryEngine.runOutcomeLabeling();
    } finally {
      setRunningOutcomeLabeling(false);
    }
  }, []);

  const runDataQualityCheck = useCallback(async (periodStart?: string, periodEnd?: string) => {
    setRunningQualityCheck(true);
    try {
      return await CircleMatchHistoryEngine.runDataQualityCheck(periodStart, periodEnd);
    } finally {
      setRunningQualityCheck(false);
    }
  }, []);

  const getLabeledTrainingData = useCallback(async (limit?: number, algorithmVersion?: string) => {
    return CircleMatchHistoryEngine.getLabeledTrainingData(limit, algorithmVersion);
  }, []);

  return {
    logInteraction,
    logView,
    logReturn,
    logShare,
    runOutcomeLabeling,
    runDataQualityCheck,
    getLabeledTrainingData,
    logging,
    runningOutcomeLabeling,
    runningQualityCheck,
  };
}
