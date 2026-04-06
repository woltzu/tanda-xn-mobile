// ═══════════════════════════════════════════════════════════════════════════════
// CronAIJobEngine.ts — #191 CronJobHandler AI Trigger Infrastructure
// ═══════════════════════════════════════════════════════════════════════════════
//
// Extends existing cron infrastructure with 6 AI scoring/analytics jobs.
// Uses existing tables: cron_job_logs (026), user_events (034),
// member_behavioral_profiles (035), default_probability_scores (036),
// circle_health_scores (036), scoring_pipeline_runs (036), score_alerts (036).
// New tables: model_performance_logs (050), cohort_analytics (050).
//
// Sections:
//   A — Types & Interfaces
//   B — Batch Processing Utility (shared by all jobs)
//   C — Job 1: daily-behavioral-signal-update (2am UTC)
//   D — Job 2: daily-default-probability-scoring (3am UTC)
//   E — Job 3: weekly-circle-health-recalculation (Mon 4am UTC)
//   F — Job 4: weekly-model-performance-check (Sun 5am UTC)
//   G — Job 5: monthly-xnscore-full-recalibration (1st 6am UTC)
//   H — Job 6: monthly-cohort-analysis (2nd 6am UTC)
//   I — Job Execution & Logging
//   J — Admin Monitoring & Stats
//   K — Dependency Checking
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type AIJobName =
  | 'daily-behavioral-signal-update'
  | 'daily-default-probability-scoring'
  | 'weekly-circle-health-recalculation'
  | 'weekly-model-performance-check'
  | 'monthly-xnscore-full-recalibration'
  | 'monthly-cohort-analysis';

export type JobStatus = 'success' | 'partial' | 'failed' | 'running';
export type DriftSeverity = 'none' | 'minor' | 'moderate' | 'severe';
export type CohortType = 'join_date' | 'referral_source' | 'geography';

export interface AIJobResult {
  jobName: AIJobName;
  status: JobStatus;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  executionTimeMs: number;
  details: Record<string, any>;
  errors: string[];
}

export interface BatchResult<T = any> {
  succeeded: T[];
  failed: Array<{ item: any; error: string }>;
}

export interface CronJobLog {
  id: string;
  jobName: string;
  status: JobStatus;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  executionTimeMs: number;
  details: Record<string, any>;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ModelPerformanceLog {
  id: string;
  modelName: string;
  modelVersion: string;
  evaluationDate: string;
  predictionWindowDays: number;
  predictionsEvaluated: number;
  correctPredictions: number;
  accuracyScore: number;
  precisionScore: number;
  recallScore: number;
  f1Score: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  accuracyDelta: number;
  driftDetected: boolean;
  driftSeverity: DriftSeverity | null;
  details: Record<string, any>;
  createdAt: string;
}

export interface CohortAnalyticsEntry {
  id: string;
  cohortType: CohortType;
  cohortLabel: string;
  periodStart: string;
  periodEnd: string;
  memberCount: number;
  activeMemberCount: number;
  retentionRate: number;
  churnRate: number;
  avgXnscore: number;
  medianXnscore: number;
  defaultRate: number;
  avgContributionAmountCents: number;
  circlesJoined: number;
  circlesCompleted: number;
  circleCompletionRate: number;
  metrics: Record<string, any>;
  computedAt: string;
  createdAt: string;
}

export interface AIJobSchedule {
  jobName: AIJobName;
  cronExpression: string;
  description: string;
  dependsOn?: AIJobName;
  estimatedDurationMinutes: number;
}

export interface JobHealthSummary {
  jobName: string;
  lastRunAt: string | null;
  lastStatus: JobStatus | null;
  avgExecutionTimeMs: number;
  successRate: number;
  totalRuns: number;
  recentFailures: number;
}


// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapCronJobLog(row: any): CronJobLog {
  return {
    id: row.id,
    jobName: row.job_name,
    status: row.status,
    recordsProcessed: row.records_processed,
    recordsSucceeded: row.records_succeeded,
    recordsFailed: row.records_failed,
    executionTimeMs: row.execution_time_ms,
    details: row.details ?? {},
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function mapModelPerformanceLog(row: any): ModelPerformanceLog {
  return {
    id: row.id,
    modelName: row.model_name,
    modelVersion: row.model_version,
    evaluationDate: row.evaluation_date,
    predictionWindowDays: row.prediction_window_days,
    predictionsEvaluated: row.predictions_evaluated,
    correctPredictions: row.correct_predictions,
    accuracyScore: parseFloat(row.accuracy_score),
    precisionScore: parseFloat(row.precision_score),
    recallScore: parseFloat(row.recall_score),
    f1Score: parseFloat(row.f1_score),
    truePositives: row.true_positives,
    trueNegatives: row.true_negatives,
    falsePositives: row.false_positives,
    falseNegatives: row.false_negatives,
    accuracyDelta: parseFloat(row.accuracy_delta),
    driftDetected: row.drift_detected,
    driftSeverity: row.drift_severity,
    details: row.details ?? {},
    createdAt: row.created_at,
  };
}

function mapCohortAnalytics(row: any): CohortAnalyticsEntry {
  return {
    id: row.id,
    cohortType: row.cohort_type,
    cohortLabel: row.cohort_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    memberCount: row.member_count,
    activeMemberCount: row.active_member_count,
    retentionRate: parseFloat(row.retention_rate),
    churnRate: parseFloat(row.churn_rate),
    avgXnscore: parseFloat(row.avg_xnscore),
    medianXnscore: parseFloat(row.median_xnscore),
    defaultRate: parseFloat(row.default_rate),
    avgContributionAmountCents: row.avg_contribution_amount_cents,
    circlesJoined: row.circles_joined,
    circlesCompleted: row.circles_completed,
    circleCompletionRate: parseFloat(row.circle_completion_rate),
    metrics: row.metrics ?? {},
    computedAt: row.computed_at,
    createdAt: row.created_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — Batch Processing Utility
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 100;

export const AI_JOB_SCHEDULES: AIJobSchedule[] = [
  { jobName: 'daily-behavioral-signal-update', cronExpression: '0 2 * * *', description: 'Update behavioral signals from 24h event data', estimatedDurationMinutes: 15 },
  { jobName: 'daily-default-probability-scoring', cronExpression: '0 3 * * *', description: 'Score default probability for active members', dependsOn: 'daily-behavioral-signal-update', estimatedDurationMinutes: 20 },
  { jobName: 'weekly-circle-health-recalculation', cronExpression: '0 4 * * 1', description: 'Recalculate health scores for all active circles', estimatedDurationMinutes: 10 },
  { jobName: 'weekly-model-performance-check', cronExpression: '0 5 * * 0', description: 'Evaluate AI prediction accuracy vs actual outcomes', estimatedDurationMinutes: 5 },
  { jobName: 'monthly-xnscore-full-recalibration', cronExpression: '0 6 1 * *', description: 'Full XnScore recalculation with all behavioral signals', estimatedDurationMinutes: 30 },
  { jobName: 'monthly-cohort-analysis', cronExpression: '0 6 2 * *', description: 'Compute cohort-level retention and performance metrics', estimatedDurationMinutes: 10 },
];


export class CronAIJobEngine {

  // ── B1: Process items in batches with per-item error handling ──

  private static async _processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    errors: string[]
  ): Promise<BatchResult<T>> {
    const succeeded: T[] = [];
    const failed: Array<{ item: T; error: string }> = [];

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);

      for (const item of batch) {
        try {
          await processor(item);
          succeeded.push(item);
        } catch (err: any) {
          const errorMsg = err?.message ?? 'Unknown error';
          failed.push({ item, error: errorMsg });
          errors.push(errorMsg);
        }
      }
    }

    return { succeeded, failed };
  }


  // ── B2: Determine job status from results ──

  private static _resolveStatus(total: number, failed: number): JobStatus {
    if (failed === 0) return 'success';
    if (failed < total * 0.5) return 'partial';
    return 'failed';
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION C — Job 1: daily-behavioral-signal-update
  // Runs at 2am UTC daily. Reads 24h user events, computes updated
  // behavioral signals, writes to member_behavioral_profiles.
  // ─────────────────────────────────────────────────────────────────────────

  static async runBehavioralSignalUpdate(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'daily-behavioral-signal-update';

    // Get all active members with circle obligations
    const { data: activeMembers } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('status', 'active');

    const memberIds = [...new Set((activeMembers ?? []).map(m => m.user_id))];

    if (memberIds.length === 0) {
      return this._buildResult(jobName, 'success', 0, 0, 0, startTime, {}, errors);
    }

    // 24h window
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const result = await this._processBatch(memberIds, async (userId) => {
      // Fetch user events from last 24h
      const { data: events } = await supabase
        .from('user_events')
        .select('event_type, event_category, event_action, duration_ms, created_at')
        .eq('user_id', userId)
        .gte('created_at', since);

      const userEvents = events ?? [];

      // Compute behavioral signals
      const loginEvents = userEvents.filter(e => e.event_type === 'login');
      const sessionEvents = userEvents.filter(e => e.event_category === 'navigation');
      const avgDuration = sessionEvents.length > 0
        ? sessionEvents.reduce((sum, e) => sum + (e.duration_ms ?? 0), 0) / sessionEvents.length
        : 0;

      // Get contribution timing from recent contributions
      const { data: recentContribs } = await supabase
        .from('cycle_contributions')
        .select('was_on_time, days_late, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      const contribs = recentContribs ?? [];
      const onTimePct = contribs.length > 0
        ? contribs.filter(c => c.was_on_time).length / contribs.length
        : 0;

      // Feature usage: count distinct event categories
      const distinctCategories = new Set(userEvents.map(e => e.event_category));
      const featureUsageScore = Math.min(100, distinctCategories.size * 10);

      // Update member_behavioral_profiles
      await supabase
        .from('member_behavioral_profiles')
        .upsert({
          user_id: userId,
          avg_sessions_per_week: loginEvents.length * 7, // Scale 24h to weekly
          feature_adoption_score: featureUsageScore,
          on_time_pct: Math.round(onTimePct * 100) / 100,
          active_days_last_30: Math.min(30, loginEvents.length > 0 ? 1 : 0), // Incremental
          last_computed_at: new Date().toISOString(),
          computation_duration_ms: Date.now() - startTime,
        }, { onConflict: 'user_id' });

    }, errors);

    const status = this._resolveStatus(memberIds.length, result.failed.length);

    return this._buildResult(
      jobName, status, memberIds.length,
      result.succeeded.length, result.failed.length,
      startTime,
      { eventsWindow: since, failedMemberIds: result.failed.map(f => f.item) },
      errors
    );
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION D — Job 2: daily-default-probability-scoring
  // Runs at 3am UTC daily after behavioral signals. Scores default
  // probability for all active members, populates intervention queue.
  // ─────────────────────────────────────────────────────────────────────────

  static async runDefaultProbabilityScoring(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'daily-default-probability-scoring';

    // Dependency check: behavioral signals must have completed today
    const depOk = await this._checkDependency('daily-behavioral-signal-update');
    if (!depOk) {
      return this._buildResult(jobName, 'failed', 0, 0, 0, startTime,
        { reason: 'Dependency daily-behavioral-signal-update not completed today' }, ['Dependency not met']);
    }

    // Get members with active circle obligations
    const { data: activeMembers } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('status', 'active');

    const memberIds = [...new Set((activeMembers ?? []).map(m => m.user_id))];

    if (memberIds.length === 0) {
      return this._buildResult(jobName, 'success', 0, 0, 0, startTime, {}, errors);
    }

    let alertsGenerated = 0;

    const result = await this._processBatch(memberIds, async (userId) => {
      // Get behavioral profile
      const { data: profile } = await supabase
        .from('member_behavioral_profiles')
        .select('on_time_pct, late_pct, missed_pct, contribution_consistency, risk_score, payment_trend, active_days_last_30, feature_adoption_score')
        .eq('user_id', userId)
        .single();

      if (!profile) return;

      // Rule-based scoring (v1 — no ML model yet)
      // Payment signal: 35% weight
      const paymentSignal = 1 - (profile.on_time_pct ?? 1); // Higher = riskier
      // Financial signal: 20% weight (proxy from contribution consistency)
      const financialSignal = 1 - (profile.contribution_consistency ?? 1);
      // Behavioral signal: 20% weight
      const behavioralSignal = Math.max(0, 1 - ((profile.active_days_last_30 ?? 0) / 30));
      // Social signal: 15% weight (proxy from feature adoption)
      const socialSignal = Math.max(0, 1 - ((profile.feature_adoption_score ?? 0) / 100));
      // Tenure signal: 10% weight
      const tenureSignal = 0.3; // Placeholder until tenure data is computed

      const probability =
        paymentSignal * 0.35 +
        financialSignal * 0.20 +
        behavioralSignal * 0.20 +
        socialSignal * 0.15 +
        tenureSignal * 0.10;

      const clampedProb = Math.max(0, Math.min(1, probability));

      // Determine risk bucket
      let riskBucket: string;
      if (clampedProb < 0.05) riskBucket = 'very_low';
      else if (clampedProb < 0.15) riskBucket = 'low';
      else if (clampedProb < 0.30) riskBucket = 'moderate';
      else if (clampedProb < 0.50) riskBucket = 'high';
      else riskBucket = 'very_high';

      const thresholdCrossed = clampedProb >= 0.30;

      // Upsert to default_probability_scores
      await supabase
        .from('default_probability_scores')
        .upsert({
          user_id: userId,
          predicted_probability: Math.round(clampedProb * 10000) / 10000,
          risk_bucket: riskBucket,
          payment_signal: Math.round(paymentSignal * 10000) / 10000,
          financial_signal: Math.round(financialSignal * 10000) / 10000,
          behavioral_signal: Math.round(behavioralSignal * 10000) / 10000,
          social_signal: Math.round(socialSignal * 10000) / 10000,
          tenure_signal: Math.round(tenureSignal * 10000) / 10000,
          model_version: 'rule-v1',
          confidence_score: 0.60,
          intervention_threshold_crossed: thresholdCrossed,
          input_signals: { paymentSignal, financialSignal, behavioralSignal, socialSignal, tenureSignal },
        }, { onConflict: 'user_id' });

      // Append to history
      await supabase
        .from('default_probability_history')
        .insert({
          user_id: userId,
          probability: Math.round(clampedProb * 10000) / 10000,
          risk_bucket: riskBucket,
          model_version: 'rule-v1',
        });

      // Generate alert if threshold crossed
      if (thresholdCrossed) {
        await supabase
          .from('score_alerts')
          .insert({
            alert_type: 'member_default_risk',
            target_type: 'member',
            target_id: userId,
            severity: clampedProb >= 0.50 ? 'critical' : 'warning',
            context: { probability: clampedProb, riskBucket, modelVersion: 'rule-v1' },
          });
        alertsGenerated++;
      }

    }, errors);

    const status = this._resolveStatus(memberIds.length, result.failed.length);

    return this._buildResult(
      jobName, status, memberIds.length,
      result.succeeded.length, result.failed.length,
      startTime,
      { alertsGenerated, modelVersion: 'rule-v1' },
      errors
    );
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION E — Job 3: weekly-circle-health-recalculation
  // Runs Monday 4am UTC. Calls CommunityHealthService for each circle.
  // Writes to circle_health_scores. Flags circles below threshold.
  // ─────────────────────────────────────────────────────────────────────────

  static async runCircleHealthRecalculation(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'weekly-circle-health-recalculation';

    // Get all active circles
    const { data: circles } = await supabase
      .from('circles')
      .select('id, name')
      .eq('status', 'active');

    const circleList = circles ?? [];
    let alertsGenerated = 0;

    const result = await this._processBatch(circleList, async (circle) => {
      // Calculate health metrics inline (same pattern as CommunityHealthService)
      // Get contribution reliability
      const { data: contributions } = await supabase
        .from('cycle_contributions')
        .select('status, was_on_time')
        .eq('circle_id', circle.id);

      const allContribs = contributions ?? [];
      const totalContribs = allContribs.length;
      const onTimeCount = allContribs.filter(c => c.was_on_time).length;
      const onTimePct = totalContribs > 0 ? onTimeCount / totalContribs : 1;
      const defaultCount = allContribs.filter(c => c.status === 'missed').length;

      // Get member quality
      const { data: members } = await supabase
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circle.id)
        .eq('status', 'active');

      const memberIds = (members ?? []).map(m => m.user_id);
      let avgXnScore = 0;
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('xn_score')
          .in('id', memberIds);
        const scores = (profiles ?? []).map(p => p.xn_score ?? 0);
        avgXnScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      }

      // Compute composite score (0-100)
      const contributionScore = Math.round(onTimePct * 100);
      const memberQualityScore = Math.round(avgXnScore); // Already 0-100
      const financialScore = Math.max(0, 100 - (defaultCount * 10));
      const socialScore = Math.min(100, memberIds.length * 10);

      const healthScore =
        contributionScore * 0.40 +
        memberQualityScore * 0.25 +
        financialScore * 0.20 +
        socialScore * 0.15;

      let healthStatus: string;
      if (healthScore >= 85) healthStatus = 'thriving';
      else if (healthScore >= 70) healthStatus = 'healthy';
      else if (healthScore >= 50) healthStatus = 'at_risk';
      else healthStatus = 'critical';

      // Get previous score for trend
      const { data: prev } = await supabase
        .from('circle_health_scores')
        .select('health_score')
        .eq('circle_id', circle.id)
        .single();

      const prevScore = prev?.health_score ? parseFloat(prev.health_score) : null;
      let trend = 'stable';
      if (prevScore !== null) {
        if (healthScore > prevScore + 2) trend = 'improving';
        else if (healthScore < prevScore - 2) trend = 'declining';
      }

      // Upsert circle_health_scores
      await supabase
        .from('circle_health_scores')
        .upsert({
          circle_id: circle.id,
          health_score: Math.round(healthScore * 100) / 100,
          health_status: healthStatus,
          contribution_reliability_score: contributionScore,
          member_quality_score: memberQualityScore,
          financial_stability_score: financialScore,
          social_cohesion_score: socialScore,
          on_time_contribution_pct: Math.round(onTimePct * 100) / 100,
          avg_member_xnscore: Math.round(avgXnScore * 100) / 100,
          members_with_defaults: defaultCount,
          trend,
          last_computed_at: new Date().toISOString(),
        }, { onConflict: 'circle_id' });

      // Append to history
      await supabase
        .from('circle_health_history')
        .insert({
          circle_id: circle.id,
          health_score: Math.round(healthScore * 100) / 100,
          health_status: healthStatus,
          component_scores: { contributionScore, memberQualityScore, financialScore, socialScore },
        });

      // Alert if at_risk or critical
      if (healthStatus === 'at_risk' || healthStatus === 'critical') {
        await supabase
          .from('score_alerts')
          .insert({
            alert_type: 'circle_health_decline',
            target_type: 'circle',
            target_id: circle.id,
            severity: healthStatus === 'critical' ? 'critical' : 'warning',
            context: { healthScore, healthStatus, trend, circleName: circle.name },
          });
        alertsGenerated++;
      }

    }, errors);

    const status = this._resolveStatus(circleList.length, result.failed.length);

    return this._buildResult(
      jobName, status, circleList.length,
      result.succeeded.length, result.failed.length,
      startTime,
      { alertsGenerated },
      errors
    );
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION F — Job 4: weekly-model-performance-check
  // Runs Sunday 5am UTC. Compares predictions from 30 days ago against
  // actual outcomes. Writes to model_performance_logs.
  // ─────────────────────────────────────────────────────────────────────────

  static async runModelPerformanceCheck(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'weekly-model-performance-check';

    // Get predictions from ~30 days ago
    const windowStart = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();

    const { data: predictions } = await supabase
      .from('default_probability_history')
      .select('user_id, probability, risk_bucket')
      .gte('computed_at', windowStart)
      .lte('computed_at', windowEnd);

    const predictionList = predictions ?? [];

    if (predictionList.length === 0) {
      // No predictions to evaluate
      await supabase.from('model_performance_logs').insert({
        model_name: 'default_probability',
        model_version: 'rule-v1',
        prediction_window_days: 30,
        predictions_evaluated: 0,
        drift_severity: 'none',
        details: { reason: 'No predictions in evaluation window' },
      });

      return this._buildResult(jobName, 'success', 0, 0, 0, startTime, { noPredictions: true }, errors);
    }

    // Deduplicate by user (latest prediction per user in window)
    const latestByUser = new Map<string, { probability: number; risk_bucket: string }>();
    for (const p of predictionList) {
      latestByUser.set(p.user_id, { probability: parseFloat(p.probability), risk_bucket: p.risk_bucket });
    }

    // Check actual outcomes: did they default in the 30 days after prediction?
    let tp = 0, tn = 0, fp = 0, fn = 0;

    const userIds = Array.from(latestByUser.keys());
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);

      for (const userId of batch) {
        try {
          const prediction = latestByUser.get(userId)!;
          const predictedDefault = prediction.probability >= 0.30;

          // Check for actual default (missed contributions in the last 30 days)
          const { count: missedCount } = await supabase
            .from('cycle_contributions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'missed')
            .gte('created_at', windowEnd);

          const actualDefault = (missedCount ?? 0) > 0;

          if (predictedDefault && actualDefault) tp++;
          else if (!predictedDefault && !actualDefault) tn++;
          else if (predictedDefault && !actualDefault) fp++;
          else fn++;
        } catch (err: any) {
          errors.push(`User ${userId}: ${err.message}`);
        }
      }
    }

    const total = tp + tn + fp + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    // Get previous evaluation for drift detection
    const { data: prevEval } = await supabase
      .from('model_performance_logs')
      .select('accuracy_score')
      .eq('model_name', 'default_probability')
      .order('evaluation_date', { ascending: false })
      .limit(1)
      .single();

    const prevAccuracy = prevEval ? parseFloat(prevEval.accuracy_score) : accuracy;
    const accuracyDelta = accuracy - prevAccuracy;

    let driftSeverity: DriftSeverity = 'none';
    if (Math.abs(accuracyDelta) > 0.15) driftSeverity = 'severe';
    else if (Math.abs(accuracyDelta) > 0.10) driftSeverity = 'moderate';
    else if (Math.abs(accuracyDelta) > 0.05) driftSeverity = 'minor';

    const driftDetected = driftSeverity !== 'none';

    // Write evaluation log
    await supabase
      .from('model_performance_logs')
      .insert({
        model_name: 'default_probability',
        model_version: 'rule-v1',
        prediction_window_days: 30,
        predictions_evaluated: total,
        correct_predictions: tp + tn,
        accuracy_score: Math.round(accuracy * 10000) / 10000,
        precision_score: Math.round(precision * 10000) / 10000,
        recall_score: Math.round(recall * 10000) / 10000,
        f1_score: Math.round(f1 * 10000) / 10000,
        true_positives: tp,
        true_negatives: tn,
        false_positives: fp,
        false_negatives: fn,
        accuracy_delta: Math.round(accuracyDelta * 10000) / 10000,
        drift_detected: driftDetected,
        drift_severity: driftSeverity,
        details: { windowStart, windowEnd, previousAccuracy: prevAccuracy },
      });

    // Alert on significant drift
    if (driftDetected && (driftSeverity === 'moderate' || driftSeverity === 'severe')) {
      await supabase
        .from('score_alerts')
        .insert({
          alert_type: 'model_drift',
          target_type: 'member',
          target_id: '00000000-0000-0000-0000-000000000000', // System-level alert
          severity: driftSeverity === 'severe' ? 'critical' : 'warning',
          context: { modelName: 'default_probability', accuracy, accuracyDelta, driftSeverity },
        });
    }

    return this._buildResult(
      jobName, 'success', total, tp + tn, fp + fn, startTime,
      { accuracy, precision, recall, f1, driftDetected, driftSeverity, tp, tn, fp, fn },
      errors
    );
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION G — Job 5: monthly-xnscore-full-recalibration
  // Runs 1st of month at 6am UTC. Full XnScore recalculation for all
  // members including behavioral signals from the past month.
  // ─────────────────────────────────────────────────────────────────────────

  static async runXnScoreFullRecalibration(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'monthly-xnscore-full-recalibration';

    // Get all members
    const { data: allMembers } = await supabase
      .from('profiles')
      .select('id, xn_score');

    const members = allMembers ?? [];

    const result = await this._processBatch(members, async (member) => {
      // Get contribution stats
      const { data: contribs } = await supabase
        .from('cycle_contributions')
        .select('status, was_on_time, days_late')
        .eq('user_id', member.id);

      const allContribs = contribs ?? [];
      const totalContribs = allContribs.length;
      const onTime = allContribs.filter(c => c.was_on_time).length;
      const late = allContribs.filter(c => c.status === 'late').length;
      const missed = allContribs.filter(c => c.status === 'missed').length;

      // Get circle participation
      const { count: completedCircles } = await supabase
        .from('circle_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('status', 'inactive');

      const { count: activeCircles } = await supabase
        .from('circle_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', member.id)
        .eq('status', 'active');

      // Get behavioral profile
      const { data: behavioral } = await supabase
        .from('member_behavioral_profiles')
        .select('feature_adoption_score, active_days_last_30, risk_score')
        .eq('user_id', member.id)
        .single();

      // Compute composite XnScore (0-100)
      // Payment reliability: 40% weight
      const paymentScore = totalContribs > 0
        ? ((onTime / totalContribs) * 100) : 50; // Neutral if no history

      // Circle track record: 25% weight
      const circleScore = Math.min(100,
        ((completedCircles ?? 0) * 20) + ((activeCircles ?? 0) * 10));

      // Engagement: 15% weight
      const engagementScore = behavioral?.feature_adoption_score ?? 30;

      // Default penalty: 10% weight (inverse)
      const defaultPenaltyScore = totalContribs > 0
        ? Math.max(0, 100 - (missed / totalContribs) * 200)
        : 80;

      // Tenure/consistency: 10% weight
      const tenureScore = Math.min(100, (totalContribs * 5));

      const rawScore =
        paymentScore * 0.40 +
        circleScore * 0.25 +
        engagementScore * 0.15 +
        defaultPenaltyScore * 0.10 +
        tenureScore * 0.10;

      const newScore = Math.round(Math.max(0, Math.min(100, rawScore)));
      const oldScore = member.xn_score ?? 0;

      // Update if materially different (±2 points)
      if (Math.abs(newScore - oldScore) >= 2) {
        await supabase
          .from('profiles')
          .update({ xn_score: newScore })
          .eq('id', member.id);

        // Record history
        await supabase
          .from('xn_score_history')
          .insert({
            user_id: member.id,
            score_before: oldScore,
            score_after: newScore,
            change: newScore - oldScore,
            reason: 'monthly_full_recalibration',
            metadata: {
              source: 'cron_ai_job',
              components: { paymentScore, circleScore, engagementScore, defaultPenaltyScore, tenureScore },
            },
          });
      }

    }, errors);

    const status = this._resolveStatus(members.length, result.failed.length);

    return this._buildResult(
      jobName, status, members.length,
      result.succeeded.length, result.failed.length,
      startTime,
      { recalibrated: result.succeeded.length },
      errors
    );
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION H — Job 6: monthly-cohort-analysis
  // Runs 2nd of month at 6am UTC. Groups members by join date, referral
  // source, geography. Computes cohort-level metrics.
  // ─────────────────────────────────────────────────────────────────────────

  static async runCohortAnalysis(): Promise<AIJobResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const jobName: AIJobName = 'monthly-cohort-analysis';

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of current month
    const periodStart = new Date(periodEnd);
    periodStart.setMonth(periodStart.getMonth() - 1); // 1st of previous month

    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    let cohortsProcessed = 0;

    // ── Cohort Type 1: Join Date (quarterly cohorts) ──
    try {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, xn_score, created_at, city, country, referred_by');

      const profiles = allProfiles ?? [];

      // Group by quarter
      const quarterCohorts = new Map<string, typeof profiles>();
      for (const p of profiles) {
        const d = new Date(p.created_at);
        const q = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
        if (!quarterCohorts.has(q)) quarterCohorts.set(q, []);
        quarterCohorts.get(q)!.push(p);
      }

      for (const [label, cohortMembers] of quarterCohorts) {
        try {
          const memberIds = cohortMembers.map(m => m.id);
          const metrics = await this._computeCohortMetrics(memberIds, cohortMembers);

          await supabase
            .from('cohort_analytics')
            .upsert({
              cohort_type: 'join_date',
              cohort_label: label,
              period_start: periodStartStr,
              period_end: periodEndStr,
              ...metrics,
              computed_at: new Date().toISOString(),
            }, { onConflict: 'cohort_type,cohort_label,period_start,period_end' });

          cohortsProcessed++;
        } catch (err: any) {
          errors.push(`join_date cohort ${label}: ${err.message}`);
        }
      }

      // ── Cohort Type 2: Geography (country cohorts) ──
      const geoCohorts = new Map<string, typeof profiles>();
      for (const p of profiles) {
        const key = (p.country ?? 'unknown').toLowerCase();
        if (!geoCohorts.has(key)) geoCohorts.set(key, []);
        geoCohorts.get(key)!.push(p);
      }

      for (const [label, cohortMembers] of geoCohorts) {
        try {
          const memberIds = cohortMembers.map(m => m.id);
          const metrics = await this._computeCohortMetrics(memberIds, cohortMembers);

          await supabase
            .from('cohort_analytics')
            .upsert({
              cohort_type: 'geography',
              cohort_label: label,
              period_start: periodStartStr,
              period_end: periodEndStr,
              ...metrics,
              computed_at: new Date().toISOString(),
            }, { onConflict: 'cohort_type,cohort_label,period_start,period_end' });

          cohortsProcessed++;
        } catch (err: any) {
          errors.push(`geography cohort ${label}: ${err.message}`);
        }
      }

      // ── Cohort Type 3: Referral source ──
      const refCohorts = new Map<string, typeof profiles>();
      for (const p of profiles) {
        const key = p.referred_by ? 'referred' : 'organic';
        if (!refCohorts.has(key)) refCohorts.set(key, []);
        refCohorts.get(key)!.push(p);
      }

      for (const [label, cohortMembers] of refCohorts) {
        try {
          const memberIds = cohortMembers.map(m => m.id);
          const metrics = await this._computeCohortMetrics(memberIds, cohortMembers);

          await supabase
            .from('cohort_analytics')
            .upsert({
              cohort_type: 'referral_source',
              cohort_label: label,
              period_start: periodStartStr,
              period_end: periodEndStr,
              ...metrics,
              computed_at: new Date().toISOString(),
            }, { onConflict: 'cohort_type,cohort_label,period_start,period_end' });

          cohortsProcessed++;
        } catch (err: any) {
          errors.push(`referral_source cohort ${label}: ${err.message}`);
        }
      }

    } catch (err: any) {
      errors.push(`Cohort analysis top-level: ${err.message}`);
    }

    const status = errors.length === 0 ? 'success' : (cohortsProcessed > 0 ? 'partial' : 'failed');

    return this._buildResult(
      jobName, status, cohortsProcessed, cohortsProcessed, errors.length,
      startTime,
      { periodStart: periodStartStr, periodEnd: periodEndStr, cohortsProcessed },
      errors
    );
  }


  // ── H-helper: Compute cohort metrics ──

  private static async _computeCohortMetrics(
    memberIds: string[],
    profiles: Array<{ id: string; xn_score: number }>
  ): Promise<Record<string, any>> {
    const scores = profiles.map(p => p.xn_score ?? 0).sort((a, b) => a - b);
    const avgXnscore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const medianXnscore = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0;

    // Active members (in at least one active circle)
    const { data: activeMembers } = await supabase
      .from('circle_members')
      .select('user_id')
      .in('user_id', memberIds)
      .eq('status', 'active');

    const activeMemberCount = new Set((activeMembers ?? []).map(m => m.user_id)).size;

    // Defaults
    const { count: defaultCount } = await supabase
      .from('cycle_contributions')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberIds)
      .eq('status', 'missed');

    const { count: totalContribCount } = await supabase
      .from('cycle_contributions')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberIds);

    const defaultRate = (totalContribCount ?? 0) > 0 ? (defaultCount ?? 0) / (totalContribCount ?? 1) : 0;

    // Circle participation
    const { count: circlesJoined } = await supabase
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberIds);

    const { count: circlesCompleted } = await supabase
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .in('user_id', memberIds)
      .eq('status', 'inactive');

    const circleCompletionRate = (circlesJoined ?? 0) > 0
      ? (circlesCompleted ?? 0) / (circlesJoined ?? 1) : 0;

    const retentionRate = memberIds.length > 0 ? activeMemberCount / memberIds.length : 0;

    return {
      member_count: memberIds.length,
      active_member_count: activeMemberCount,
      retention_rate: Math.round(retentionRate * 10000) / 10000,
      churn_rate: Math.round((1 - retentionRate) * 10000) / 10000,
      avg_xnscore: Math.round(avgXnscore * 100) / 100,
      median_xnscore: Math.round(medianXnscore * 100) / 100,
      default_rate: Math.round(defaultRate * 10000) / 10000,
      avg_contribution_amount_cents: 0, // Computed from contribution data if needed
      circles_joined: circlesJoined ?? 0,
      circles_completed: circlesCompleted ?? 0,
      circle_completion_rate: Math.round(circleCompletionRate * 10000) / 10000,
      metrics: { scoreBuckets: this._computeScoreBuckets(scores) },
    };
  }

  private static _computeScoreBuckets(scores: number[]): Record<string, number> {
    return {
      emerging_0_39: scores.filter(s => s < 40).length,
      building_40_59: scores.filter(s => s >= 40 && s < 60).length,
      trusted_60_74: scores.filter(s => s >= 60 && s < 75).length,
      established_75_89: scores.filter(s => s >= 75 && s < 90).length,
      elder_90_100: scores.filter(s => s >= 90).length,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION I — Job Execution & Logging
  // ─────────────────────────────────────────────────────────────────────────

  // ── I1: Execute a job by name (main entry point) ──

  static async executeJob(jobName: AIJobName): Promise<AIJobResult> {
    // Log start
    const { data: logEntry } = await supabase
      .from('cron_job_logs')
      .insert({
        job_name: jobName,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    let result: AIJobResult;

    try {
      switch (jobName) {
        case 'daily-behavioral-signal-update':
          result = await this.runBehavioralSignalUpdate();
          break;
        case 'daily-default-probability-scoring':
          result = await this.runDefaultProbabilityScoring();
          break;
        case 'weekly-circle-health-recalculation':
          result = await this.runCircleHealthRecalculation();
          break;
        case 'weekly-model-performance-check':
          result = await this.runModelPerformanceCheck();
          break;
        case 'monthly-xnscore-full-recalibration':
          result = await this.runXnScoreFullRecalibration();
          break;
        case 'monthly-cohort-analysis':
          result = await this.runCohortAnalysis();
          break;
        default:
          result = this._buildResult(jobName, 'failed', 0, 0, 0, Date.now(), {}, [`Unknown job: ${jobName}`]);
      }
    } catch (err: any) {
      result = this._buildResult(jobName, 'failed', 0, 0, 0, Date.now(), {}, [err.message]);
    }

    // Update log entry
    if (logEntry) {
      await supabase
        .from('cron_job_logs')
        .update({
          status: result.status,
          records_processed: result.recordsProcessed,
          records_succeeded: result.recordsSucceeded,
          records_failed: result.recordsFailed,
          execution_time_ms: result.executionTimeMs,
          details: result.details,
          error_message: result.errors.length > 0 ? result.errors.slice(0, 10).join('; ') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);
    }

    return result;
  }


  // ── I2: Build result object ──

  private static _buildResult(
    jobName: AIJobName,
    status: JobStatus,
    processed: number,
    succeeded: number,
    failed: number,
    startTime: number,
    details: Record<string, any>,
    errors: string[]
  ): AIJobResult {
    return {
      jobName,
      status,
      recordsProcessed: processed,
      recordsSucceeded: succeeded,
      recordsFailed: failed,
      executionTimeMs: Date.now() - startTime,
      details,
      errors: errors.slice(0, 50), // Cap error list
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION J — Admin Monitoring & Stats
  // ─────────────────────────────────────────────────────────────────────────

  // ── J1: Get recent job logs ──

  static async getRecentJobLogs(limit: number = 50): Promise<CronJobLog[]> {
    const { data } = await supabase
      .from('cron_job_logs')
      .select('*')
      .in('job_name', AI_JOB_SCHEDULES.map(s => s.jobName))
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapCronJobLog);
  }


  // ── J2: Get logs for a specific job ──

  static async getJobLogs(jobName: AIJobName, limit: number = 20): Promise<CronJobLog[]> {
    const { data } = await supabase
      .from('cron_job_logs')
      .select('*')
      .eq('job_name', jobName)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapCronJobLog);
  }


  // ── J3: Get job health summary ──

  static async getJobHealthSummary(): Promise<JobHealthSummary[]> {
    const summaries: JobHealthSummary[] = [];

    for (const schedule of AI_JOB_SCHEDULES) {
      const { data: logs } = await supabase
        .from('cron_job_logs')
        .select('status, execution_time_ms, created_at')
        .eq('job_name', schedule.jobName)
        .order('created_at', { ascending: false })
        .limit(20);

      const jobLogs = logs ?? [];
      const totalRuns = jobLogs.length;
      const successRuns = jobLogs.filter(l => l.status === 'success').length;
      const recentFailures = jobLogs.slice(0, 5).filter(l => l.status === 'failed').length;
      const avgTime = totalRuns > 0
        ? jobLogs.reduce((sum, l) => sum + (l.execution_time_ms ?? 0), 0) / totalRuns
        : 0;

      summaries.push({
        jobName: schedule.jobName,
        lastRunAt: jobLogs[0]?.created_at ?? null,
        lastStatus: jobLogs[0]?.status ?? null,
        avgExecutionTimeMs: Math.round(avgTime),
        successRate: totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) / 100 : 0,
        totalRuns,
        recentFailures,
      });
    }

    return summaries;
  }


  // ── J4: Get model performance history ──

  static async getModelPerformanceHistory(
    modelName: string = 'default_probability',
    limit: number = 12
  ): Promise<ModelPerformanceLog[]> {
    const { data } = await supabase
      .from('model_performance_logs')
      .select('*')
      .eq('model_name', modelName)
      .order('evaluation_date', { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapModelPerformanceLog);
  }


  // ── J5: Get cohort analytics ──

  static async getCohortAnalytics(
    cohortType?: CohortType,
    limit: number = 20
  ): Promise<CohortAnalyticsEntry[]> {
    let query = supabase
      .from('cohort_analytics')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(limit);

    if (cohortType) {
      query = query.eq('cohort_type', cohortType);
    }

    const { data } = await query;
    return (data ?? []).map(mapCohortAnalytics);
  }


  // ── J6: Get latest drift alerts ──

  static async getDriftAlerts(): Promise<any[]> {
    const { data } = await supabase
      .from('score_alerts')
      .select('*')
      .eq('alert_type', 'model_drift')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10);

    return data ?? [];
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION K — Dependency Checking
  // ─────────────────────────────────────────────────────────────────────────

  // ── K1: Check if a dependency job completed successfully today ──

  private static async _checkDependency(
    dependencyJobName: AIJobName,
    maxRetries: number = 3,
    retryDelayMs: number = 30 * 60 * 1000 // 30 minutes
  ): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { data } = await supabase
        .from('cron_job_logs')
        .select('status')
        .eq('job_name', dependencyJobName)
        .in('status', ['success', 'partial'])
        .gte('started_at', `${today}T00:00:00Z`)
        .limit(1)
        .single();

      if (data) return true;

      // Wait before retry (only in actual cron context, not manual execution)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.min(retryDelayMs, 5000)));
      }
    }

    return false;
  }


  // ── K2: Get all job schedules ──

  static getJobSchedules(): AIJobSchedule[] {
    return AI_JOB_SCHEDULES;
  }
}
