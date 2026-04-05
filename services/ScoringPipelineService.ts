// ══════════════════════════════════════════════════════════════════════════════
// SCORING PIPELINE SERVICE - Real-time scoring data layer
// Provides access to default probability scores, circle health scores,
// score alerts, and pipeline run status. Thin wrapper around Supabase queries.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DefaultProbabilityScore {
  id: string;
  userId: string;
  predictedProbability: number;
  riskBucket: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
  paymentSignal: number;
  financialSignal: number;
  behavioralSignal: number;
  socialSignal: number;
  tenureSignal: number;
  modelVersion: string;
  confidenceScore: number;
  inputSignals: Record<string, any>;
  lastComputedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DefaultProbabilityHistory {
  id: string;
  userId: string;
  probability: number;
  riskBucket: string;
  modelVersion: string;
  computedAt: string;
}

export interface CircleHealthScore {
  id: string;
  circleId: string;
  healthScore: number;
  healthStatus: 'thriving' | 'healthy' | 'at_risk' | 'critical';
  contributionReliabilityScore: number;
  memberQualityScore: number;
  financialStabilityScore: number;
  socialCohesionScore: number;
  onTimeContributionPct: number;
  avgMemberXnscore: number;
  membersWithDefaults: number;
  totalMembers: number;
  avgDefaultProbability: number;
  daysSinceLastIssue: number;
  previousScore: number | null;
  trend: 'improving' | 'stable' | 'declining';
  lastComputedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CircleHealthHistory {
  id: string;
  circleId: string;
  healthScore: number;
  healthStatus: string;
  componentScores: Record<string, number>;
  computedAt: string;
}

export interface ScoreAlert {
  id: string;
  alertType: string;
  targetType: 'member' | 'circle';
  targetId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  scoreValue: number | null;
  thresholdValue: number | null;
  notificationSent: boolean;
  notificationSentAt: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  context: Record<string, any>;
  createdAt: string;
}

export interface PipelineRun {
  id: string;
  runDate: string;
  profilesComputed: number;
  defaultProbsComputed: number;
  circleScoresComputed: number;
  xnscoresRecalculated: number;
  alertsGenerated: number;
  honorScoresComputed: number;
  stepTimings: Record<string, number>;
  totalDurationMs: number | null;
  status: 'running' | 'completed' | 'partial' | 'failed';
  errors: any[];
  startedAt: string;
  completedAt: string | null;
}

export interface PipelineResult {
  runId: string;
  profiles: number;
  defaultProbs: number;
  circles: number;
  xnscores: number;
  alerts: number;
  honorScores: number;
  durationMs: number;
  errors: any[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS (snake_case → camelCase)
// ═══════════════════════════════════════════════════════════════════════════════

function mapDefaultProbability(row: any): DefaultProbabilityScore {
  return {
    id: row.id,
    userId: row.user_id,
    predictedProbability: parseFloat(row.predicted_probability) || 0,
    riskBucket: row.risk_bucket || 'low',
    paymentSignal: parseFloat(row.payment_signal) || 0,
    financialSignal: parseFloat(row.financial_signal) || 0,
    behavioralSignal: parseFloat(row.behavioral_signal) || 0,
    socialSignal: parseFloat(row.social_signal) || 0,
    tenureSignal: parseFloat(row.tenure_signal) || 0,
    modelVersion: row.model_version || 'v1_heuristic',
    confidenceScore: parseFloat(row.confidence_score) || 0,
    inputSignals: row.input_signals || {},
    lastComputedAt: row.last_computed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDefaultProbabilityHistory(row: any): DefaultProbabilityHistory {
  return {
    id: row.id,
    userId: row.user_id,
    probability: parseFloat(row.probability) || 0,
    riskBucket: row.risk_bucket || 'low',
    modelVersion: row.model_version || 'v1_heuristic',
    computedAt: row.computed_at,
  };
}

function mapCircleHealth(row: any): CircleHealthScore {
  return {
    id: row.id,
    circleId: row.circle_id,
    healthScore: parseFloat(row.health_score) || 0,
    healthStatus: row.health_status || 'healthy',
    contributionReliabilityScore: parseFloat(row.contribution_reliability_score) || 0,
    memberQualityScore: parseFloat(row.member_quality_score) || 0,
    financialStabilityScore: parseFloat(row.financial_stability_score) || 0,
    socialCohesionScore: parseFloat(row.social_cohesion_score) || 0,
    onTimeContributionPct: parseFloat(row.on_time_contribution_pct) || 0,
    avgMemberXnscore: parseFloat(row.avg_member_xnscore) || 0,
    membersWithDefaults: row.members_with_defaults || 0,
    totalMembers: row.total_members || 0,
    avgDefaultProbability: parseFloat(row.avg_default_probability) || 0,
    daysSinceLastIssue: row.days_since_last_issue || 0,
    previousScore: row.previous_score ? parseFloat(row.previous_score) : null,
    trend: row.trend || 'stable',
    lastComputedAt: row.last_computed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCircleHealthHistory(row: any): CircleHealthHistory {
  return {
    id: row.id,
    circleId: row.circle_id,
    healthScore: parseFloat(row.health_score) || 0,
    healthStatus: row.health_status || 'healthy',
    componentScores: row.component_scores || {},
    computedAt: row.computed_at,
  };
}

function mapScoreAlert(row: any): ScoreAlert {
  return {
    id: row.id,
    alertType: row.alert_type,
    targetType: row.target_type,
    targetId: row.target_id,
    severity: row.severity || 'warning',
    title: row.title,
    message: row.message,
    scoreValue: row.score_value ? parseFloat(row.score_value) : null,
    thresholdValue: row.threshold_value ? parseFloat(row.threshold_value) : null,
    notificationSent: row.notification_sent || false,
    notificationSentAt: row.notification_sent_at,
    status: row.status || 'open',
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    resolutionNotes: row.resolution_notes,
    context: row.context || {},
    createdAt: row.created_at,
  };
}

function mapPipelineRun(row: any): PipelineRun {
  return {
    id: row.id,
    runDate: row.run_date,
    profilesComputed: row.profiles_computed || 0,
    defaultProbsComputed: row.default_probs_computed || 0,
    circleScoresComputed: row.circle_scores_computed || 0,
    xnscoresRecalculated: row.xnscores_recalculated || 0,
    alertsGenerated: row.alerts_generated || 0,
    honorScoresComputed: row.honor_scores_computed || 0,
    stepTimings: row.step_timings || {},
    totalDurationMs: row.total_duration_ms,
    status: row.status || 'running',
    errors: row.errors || [],
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class ScoringPipelineService {

  // ─────────────────────────────────────────────────────────────────────────
  // Default Probability
  // ─────────────────────────────────────────────────────────────────────────

  /** Get the current default probability score for a user. */
  async getDefaultProbability(userId: string): Promise<DefaultProbabilityScore | null> {
    const { data, error } = await supabase
      .from('default_probability_scores')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ScoringPipeline] getDefaultProbability error:', error.message);
      return null;
    }
    return data ? mapDefaultProbability(data) : null;
  }

  /** Get default probability history for a user. */
  async getDefaultProbabilityHistory(
    userId: string,
    days: number = 90
  ): Promise<DefaultProbabilityHistory[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('default_probability_history')
      .select('*')
      .eq('user_id', userId)
      .gte('computed_at', since.toISOString())
      .order('computed_at', { ascending: false });

    if (error) {
      console.error('[ScoringPipeline] getDefaultProbabilityHistory error:', error.message);
      return [];
    }
    return (data || []).map(mapDefaultProbabilityHistory);
  }

  /** Trigger on-demand default probability computation for a user. */
  async refreshDefaultProbability(userId: string): Promise<boolean> {
    const { error } = await supabase.rpc('compute_default_probability', {
      p_user_id: userId,
    });
    if (error) {
      console.error('[ScoringPipeline] refreshDefaultProbability error:', error.message);
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Circle Health
  // ─────────────────────────────────────────────────────────────────────────

  /** Get the current health score for a circle. */
  async getCircleHealthScore(circleId: string): Promise<CircleHealthScore | null> {
    const { data, error } = await supabase
      .from('circle_health_scores')
      .select('*')
      .eq('circle_id', circleId)
      .maybeSingle();

    if (error) {
      console.error('[ScoringPipeline] getCircleHealthScore error:', error.message);
      return null;
    }
    return data ? mapCircleHealth(data) : null;
  }

  /** Get circle health history. */
  async getCircleHealthHistory(
    circleId: string,
    days: number = 90
  ): Promise<CircleHealthHistory[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('circle_health_history')
      .select('*')
      .eq('circle_id', circleId)
      .gte('computed_at', since.toISOString())
      .order('computed_at', { ascending: false });

    if (error) {
      console.error('[ScoringPipeline] getCircleHealthHistory error:', error.message);
      return [];
    }
    return (data || []).map(mapCircleHealthHistory);
  }

  /** Trigger on-demand circle health computation. */
  async refreshCircleHealthScore(circleId: string): Promise<boolean> {
    const { error } = await supabase.rpc('compute_circle_health_score', {
      p_circle_id: circleId,
    });
    if (error) {
      console.error('[ScoringPipeline] refreshCircleHealthScore error:', error.message);
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alerts
  // ─────────────────────────────────────────────────────────────────────────

  /** Get active alerts, optionally filtered by target. */
  async getActiveAlerts(
    targetType?: string,
    targetId?: string
  ): Promise<ScoreAlert[]> {
    let query = supabase
      .from('score_alerts')
      .select('*')
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false });

    if (targetType) query = query.eq('target_type', targetType);
    if (targetId) query = query.eq('target_id', targetId);

    const { data, error } = await query;

    if (error) {
      console.error('[ScoringPipeline] getActiveAlerts error:', error.message);
      return [];
    }
    return (data || []).map(mapScoreAlert);
  }

  /** Get alerts for a specific user (both direct member alerts and circle alerts). */
  async getUserAlerts(userId: string): Promise<ScoreAlert[]> {
    const { data, error } = await supabase
      .from('score_alerts')
      .select('*')
      .or(`and(target_type.eq.member,target_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[ScoringPipeline] getUserAlerts error:', error.message);
      return [];
    }
    return (data || []).map(mapScoreAlert);
  }

  /** Get alerts for a specific circle. */
  async getCircleAlerts(circleId: string): Promise<ScoreAlert[]> {
    const { data, error } = await supabase
      .from('score_alerts')
      .select('*')
      .eq('target_type', 'circle')
      .eq('target_id', circleId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[ScoringPipeline] getCircleAlerts error:', error.message);
      return [];
    }
    return (data || []).map(mapScoreAlert);
  }

  /** Acknowledge an alert. */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id) return false;

    const { error } = await supabase
      .from('score_alerts')
      .update({
        status: 'acknowledged',
        acknowledged_by: userData.user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      console.error('[ScoringPipeline] acknowledgeAlert error:', error.message);
      return false;
    }
    return true;
  }

  /** Resolve an alert with notes. */
  async resolveAlert(alertId: string, notes: string): Promise<boolean> {
    const { error } = await supabase
      .from('score_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', alertId);

    if (error) {
      console.error('[ScoringPipeline] resolveAlert error:', error.message);
      return false;
    }
    return true;
  }

  /** Dismiss an alert. */
  async dismissAlert(alertId: string): Promise<boolean> {
    const { error } = await supabase
      .from('score_alerts')
      .update({ status: 'dismissed' })
      .eq('id', alertId);

    if (error) {
      console.error('[ScoringPipeline] dismissAlert error:', error.message);
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Pipeline Runs
  // ─────────────────────────────────────────────────────────────────────────

  /** Get recent pipeline run history. */
  async getRecentRuns(limit: number = 10): Promise<PipelineRun[]> {
    const { data, error } = await supabase
      .from('scoring_pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[ScoringPipeline] getRecentRuns error:', error.message);
      return [];
    }
    return (data || []).map(mapPipelineRun);
  }

  /** Get the latest pipeline run. */
  async getLatestRun(): Promise<PipelineRun | null> {
    const { data, error } = await supabase
      .from('scoring_pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[ScoringPipeline] getLatestRun error:', error.message);
      return null;
    }
    return data ? mapPipelineRun(data) : null;
  }

  /** Trigger the full scoring pipeline manually (admin). */
  async triggerPipeline(): Promise<PipelineResult | null> {
    const { data, error } = await supabase.rpc('run_scoring_pipeline');

    if (error) {
      console.error('[ScoringPipeline] triggerPipeline error:', error.message);
      return null;
    }

    return {
      runId: data.run_id,
      profiles: data.profiles || 0,
      defaultProbs: data.default_probs || 0,
      circles: data.circles || 0,
      xnscores: data.xnscores || 0,
      alerts: data.alerts || 0,
      honorScores: data.honor_scores || 0,
      durationMs: data.duration_ms || 0,
      errors: data.errors || [],
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const scoringPipelineService = new ScoringPipelineService();
export { ScoringPipelineService };
