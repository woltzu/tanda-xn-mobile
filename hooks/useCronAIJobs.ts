// ═══════════════════════════════════════════════════════════════════════════════
// useCronAIJobs.ts — #191 CronJobHandler AI Trigger Infrastructure Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 hooks for admin monitoring dashboard:
//   useAIJobHealth        — health summary for all 6 AI jobs
//   useAIJobLogs          — recent execution logs (all or per job)
//   useModelPerformance   — model accuracy history + drift detection
//   useCohortAnalytics    — cohort-level metrics
//   useAIJobActions       — manual trigger + monitoring actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CronAIJobEngine,
  AI_JOB_SCHEDULES,
  type AIJobName,
  type JobStatus,
  type DriftSeverity,
  type CohortType,
  type AIJobResult,
  type CronJobLog,
  type ModelPerformanceLog,
  type CohortAnalyticsEntry,
  type AIJobSchedule,
  type JobHealthSummary,
} from '../services/CronAIJobEngine';

// Re-export types for consumers
export type {
  AIJobName,
  JobStatus,
  DriftSeverity,
  CohortType,
  AIJobResult,
  CronJobLog,
  ModelPerformanceLog,
  CohortAnalyticsEntry,
  AIJobSchedule,
  JobHealthSummary,
};

export { AI_JOB_SCHEDULES };


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: useAIJobHealth
// ─────────────────────────────────────────────────────────────────────────────

export function useAIJobHealth() {
  const [summaries, setSummaries] = useState<JobHealthSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CronAIJobEngine.getJobHealthSummary();
      setSummaries(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const computed = useMemo(() => {
    const allHealthy = summaries.every(s => s.lastStatus === 'success' || s.lastStatus === null);
    const failingJobs = summaries.filter(s => s.lastStatus === 'failed');
    const partialJobs = summaries.filter(s => s.lastStatus === 'partial');
    const overallSuccessRate = summaries.length > 0
      ? summaries.reduce((sum, s) => sum + s.successRate, 0) / summaries.length
      : 0;
    const totalRecentFailures = summaries.reduce((sum, s) => sum + s.recentFailures, 0);

    return {
      allHealthy,
      failingJobs,
      partialJobs,
      overallSuccessRate: Math.round(overallSuccessRate * 100),
      totalRecentFailures,
      jobCount: summaries.length,
    };
  }, [summaries]);

  return { summaries, loading, error, refresh: fetchHealth, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useAIJobLogs
// ─────────────────────────────────────────────────────────────────────────────

export function useAIJobLogs(jobName?: AIJobName, limit: number = 50) {
  const [logs, setLogs] = useState<CronJobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = jobName
        ? await CronAIJobEngine.getJobLogs(jobName, limit)
        : await CronAIJobEngine.getRecentJobLogs(limit);
      setLogs(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobName, limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const computed = useMemo(() => ({
    totalLogs: logs.length,
    successCount: logs.filter(l => l.status === 'success').length,
    failureCount: logs.filter(l => l.status === 'failed').length,
    partialCount: logs.filter(l => l.status === 'partial').length,
    latestLog: logs[0] ?? null,
    avgExecutionTimeMs: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.executionTimeMs, 0) / logs.length)
      : 0,
  }), [logs]);

  return { logs, loading, error, refresh: fetchLogs, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useModelPerformance
// ─────────────────────────────────────────────────────────────────────────────

export function useModelPerformance(modelName: string = 'default_probability', limit: number = 12) {
  const [history, setHistory] = useState<ModelPerformanceLog[]>([]);
  const [driftAlerts, setDriftAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [perfHistory, alerts] = await Promise.all([
        CronAIJobEngine.getModelPerformanceHistory(modelName, limit),
        CronAIJobEngine.getDriftAlerts(),
      ]);
      setHistory(perfHistory);
      setDriftAlerts(alerts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [modelName, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const computed = useMemo(() => {
    const latestEval = history[0] ?? null;
    const previousEval = history[1] ?? null;

    return {
      latestAccuracy: latestEval?.accuracyScore ?? null,
      latestPrecision: latestEval?.precisionScore ?? null,
      latestRecall: latestEval?.recallScore ?? null,
      latestF1: latestEval?.f1Score ?? null,
      hasDrift: latestEval?.driftDetected ?? false,
      driftSeverity: latestEval?.driftSeverity ?? 'none',
      accuracyTrend: latestEval && previousEval
        ? (latestEval.accuracyScore > previousEval.accuracyScore ? 'improving' :
           latestEval.accuracyScore < previousEval.accuracyScore ? 'declining' : 'stable')
        : 'unknown',
      openDriftAlerts: driftAlerts.length,
      evaluationCount: history.length,
    };
  }, [history, driftAlerts]);

  return { history, driftAlerts, loading, error, refresh: fetchData, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useCohortAnalytics
// ─────────────────────────────────────────────────────────────────────────────

export function useCohortAnalytics(cohortType?: CohortType, limit: number = 20) {
  const [cohorts, setCohorts] = useState<CohortAnalyticsEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCohorts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await CronAIJobEngine.getCohortAnalytics(cohortType, limit);
      setCohorts(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cohortType, limit]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  const computed = useMemo(() => ({
    totalCohorts: cohorts.length,
    avgRetentionRate: cohorts.length > 0
      ? Math.round(cohorts.reduce((sum, c) => sum + c.retentionRate, 0) / cohorts.length * 10000) / 100
      : 0,
    avgDefaultRate: cohorts.length > 0
      ? Math.round(cohorts.reduce((sum, c) => sum + c.defaultRate, 0) / cohorts.length * 10000) / 100
      : 0,
    avgXnScore: cohorts.length > 0
      ? Math.round(cohorts.reduce((sum, c) => sum + c.avgXnscore, 0) / cohorts.length * 100) / 100
      : 0,
    totalMembers: cohorts.reduce((sum, c) => sum + c.memberCount, 0),
    bestRetentionCohort: cohorts.length > 0
      ? cohorts.reduce((best, c) => c.retentionRate > best.retentionRate ? c : best, cohorts[0])
      : null,
    worstRetentionCohort: cohorts.length > 0
      ? cohorts.reduce((worst, c) => c.retentionRate < worst.retentionRate ? c : worst, cohorts[0])
      : null,
  }), [cohorts]);

  return { cohorts, loading, error, refresh: fetchCohorts, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useAIJobActions
// ─────────────────────────────────────────────────────────────────────────────

export function useAIJobActions() {
  const [executing, setExecuting] = useState(false);
  const [executingJob, setExecutingJob] = useState<AIJobName | null>(null);

  const executeJob = useCallback(async (jobName: AIJobName): Promise<AIJobResult> => {
    setExecuting(true);
    setExecutingJob(jobName);
    try {
      return await CronAIJobEngine.executeJob(jobName);
    } finally {
      setExecuting(false);
      setExecutingJob(null);
    }
  }, []);

  const getSchedules = useCallback(() => {
    return CronAIJobEngine.getJobSchedules();
  }, []);

  return {
    executeJob,
    getSchedules,
    executing,
    executingJob,
  };
}
