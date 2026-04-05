// ═══════════════════════════════════════════════════════════════════════════════
// CircleMatchHistoryEngine.ts — #189 Circle Match History as ML Training Seed
// ═══════════════════════════════════════════════════════════════════════════════
//
// Extends circle_match_history (migration 007 + 052) to capture ML training data:
//   - Profile snapshots at interaction time (member + circle)
//   - Session context (screen, browse count, position in feed)
//   - Algorithm version tracking for A/B testing
//   - Weekly outcome labeling (success/partial/defaulted/dissolved/exited)
//   - Weekly data quality monitoring (completeness, coverage, labeling gaps)
//
// Static class pattern following AIRecommendationFeedbackEngine.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';


// ─────────────────────────────────────────────────────────────────────────────
// Section A — Types
// ─────────────────────────────────────────────────────────────────────────────

export type MatchAction = 'viewed' | 'dismissed' | 'saved' | 'applied' | 'joined' | 'rejected' | 'returned' | 'shared';

export type OutcomeLabel = 'pending' | 'success' | 'partial' | 'defaulted' | 'circle_dissolved' | 'exited' | 'not_applicable';

export type AlgorithmVersion = string; // e.g. 'rule-v1', 'ml-v1', 'ml-v2'

export interface SessionContext {
  screen: string;              // 'discover', 'search', 'recommended', 'details'
  circlesViewedInSession: number;
  positionInFeed: number;      // 0-indexed position in the list
  sessionDurationMs: number;
  deviceType?: string;         // 'ios', 'android'
  appVersion?: string;
}

export interface MemberProfileSnapshot {
  xnScore: number;
  xnScoreTier: string;
  memberSince: string;         // ISO date
  circlesCompleted: number;
  circlesActive: number;
  defaultCount: number;
  preferredLanguage: string;
  country?: string;
  region?: string;
}

export interface CircleProfileSnapshot {
  contributionAmountCents: number;
  cycleLengthDays: number;
  memberCount: number;
  maxMembers: number;
  healthScore: number;
  cyclesCompleted: number;
  totalCycles: number;
  defaultRate: number;
  avgMemberXnScore: number;
  language: string;
  country?: string;
}

export interface MatchHistoryRecord {
  id: string;
  userId: string;
  circleId: string;
  matchScore: number;
  affordabilityScore: number | null;
  trustScore: number | null;
  compatibilityScore: number | null;
  action: MatchAction;
  actionReason: string | null;
  completedSuccessfully: boolean | null;
  sessionContext: SessionContext;
  memberProfileSnapshot: MemberProfileSnapshot;
  circleProfileSnapshot: CircleProfileSnapshot;
  algorithmVersion: string;
  outcomeLabel: OutcomeLabel | null;
  outcomeLabeledAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface DataQualityLog {
  id: string;
  checkDate: string;
  periodStart: string;
  periodEnd: string;
  totalRecords: number;
  recordsWithSnapshots: number;
  recordsMissingMemberSnapshot: number;
  recordsMissingCircleSnapshot: number;
  recordsMissingSessionContext: number;
  viewCount: number;
  joinCount: number;
  dismissCount: number;
  returnCount: number;
  shareCount: number;
  outcomesPending: number;
  outcomesLabeled: number;
  outcomesOverdue: number;
  snapshotCompletenessScore: number;
  outcomeLabelingScore: number;
  overallQualityScore: number;
  issues: DataQualityIssue[];
  createdAt: string;
}

export interface DataQualityIssue {
  type: 'missing_snapshot' | 'missing_session' | 'overdue_labeling' | 'low_volume' | 'action_imbalance';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  count?: number;
}

export interface TrainingDataStats {
  totalRecords: number;
  labeledRecords: number;
  unlabeledRecords: number;
  recordsWithSnapshots: number;
  actionDistribution: Record<MatchAction, number>;
  outcomeDistribution: Record<string, number>;
  algorithmVersions: { version: string; count: number }[];
  dateRange: { earliest: string; latest: string } | null;
  qualityScore: number;
}

export interface OutcomeLabelingResult {
  processed: number;
  labeled: number;
  skipped: number;
  errors: number;
  details: {
    success: number;
    partial: number;
    defaulted: number;
    circleDissolved: number;
    exited: number;
    notApplicable: number;
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Section B — Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapRecord(row: any): MatchHistoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    circleId: row.circle_id,
    matchScore: row.match_score,
    affordabilityScore: row.affordability_score,
    trustScore: row.trust_score,
    compatibilityScore: row.compatibility_score,
    action: row.action,
    actionReason: row.action_reason,
    completedSuccessfully: row.completed_successfully,
    sessionContext: row.session_context ?? {},
    memberProfileSnapshot: row.member_profile_snapshot ?? {},
    circleProfileSnapshot: row.circle_profile_snapshot ?? {},
    algorithmVersion: row.algorithm_version ?? 'rule-v1',
    outcomeLabel: row.outcome_label,
    outcomeLabeledAt: row.outcome_labeled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapQualityLog(row: any): DataQualityLog {
  return {
    id: row.id,
    checkDate: row.check_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalRecords: row.total_records,
    recordsWithSnapshots: row.records_with_snapshots,
    recordsMissingMemberSnapshot: row.records_missing_member_snapshot,
    recordsMissingCircleSnapshot: row.records_missing_circle_snapshot,
    recordsMissingSessionContext: row.records_missing_session_context,
    viewCount: row.view_count,
    joinCount: row.join_count,
    dismissCount: row.dismiss_count,
    returnCount: row.return_count,
    shareCount: row.share_count,
    outcomesPending: row.outcomes_pending,
    outcomesLabeled: row.outcomes_labeled,
    outcomesOverdue: row.outcomes_overdue,
    snapshotCompletenessScore: row.snapshot_completeness_score,
    outcomeLabelingScore: row.outcome_labeling_score,
    overallQualityScore: row.overall_quality_score,
    issues: row.issues ?? [],
    createdAt: row.created_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Section C — Engine
// ─────────────────────────────────────────────────────────────────────────────

export class CircleMatchHistoryEngine {

  // ───────────────────────────────────────────────────────────────────────────
  // Section D — Event Logging (enhanced with ML columns)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log a circle match interaction with full ML training context.
   * Called from recommendation screens when a user views/dismisses/saves/etc.
   */
  static async logInteraction(
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
    algorithmVersion: string = 'rule-v1',
    actionReason?: string
  ): Promise<MatchHistoryRecord> {
    // Capture profile snapshots at interaction time
    const [memberSnapshot, circleSnapshot] = await Promise.all([
      this._captureMemberSnapshot(userId),
      this._captureCircleSnapshot(circleId),
    ]);

    const { data, error } = await supabase
      .from('circle_match_history')
      .insert({
        user_id: userId,
        circle_id: circleId,
        match_score: matchScores.matchScore,
        affordability_score: matchScores.affordabilityScore ?? null,
        trust_score: matchScores.trustScore ?? null,
        compatibility_score: matchScores.compatibilityScore ?? null,
        action,
        action_reason: actionReason ?? null,
        session_context: {
          screen: sessionContext.screen ?? 'unknown',
          circlesViewedInSession: sessionContext.circlesViewedInSession ?? 0,
          positionInFeed: sessionContext.positionInFeed ?? 0,
          sessionDurationMs: sessionContext.sessionDurationMs ?? 0,
          deviceType: sessionContext.deviceType,
          appVersion: sessionContext.appVersion,
        },
        member_profile_snapshot: memberSnapshot,
        circle_profile_snapshot: circleSnapshot,
        algorithm_version: algorithmVersion,
        outcome_label: action === 'joined' ? 'pending' : null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to log interaction: ${error.message}`);
    return mapRecord(data);
  }

  /**
   * Log a simple view event (lightweight, called from feed rendering).
   */
  static async logView(
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion: string = 'rule-v1'
  ): Promise<MatchHistoryRecord> {
    return this.logInteraction(
      userId, circleId, 'viewed',
      { matchScore },
      sessionContext,
      algorithmVersion
    );
  }

  /**
   * Log a return visit (user came back to a previously viewed circle).
   */
  static async logReturn(
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion: string = 'rule-v1'
  ): Promise<MatchHistoryRecord> {
    return this.logInteraction(
      userId, circleId, 'returned',
      { matchScore },
      sessionContext,
      algorithmVersion
    );
  }

  /**
   * Log a share event.
   */
  static async logShare(
    userId: string,
    circleId: string,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion: string = 'rule-v1'
  ): Promise<MatchHistoryRecord> {
    return this.logInteraction(
      userId, circleId, 'shared',
      { matchScore },
      sessionContext,
      algorithmVersion
    );
  }

  /**
   * Update an existing record's action (e.g., viewed → saved → applied → joined).
   * Creates a NEW record rather than updating, to preserve the full action chain.
   */
  static async logFollowUpAction(
    userId: string,
    circleId: string,
    action: MatchAction,
    matchScore: number,
    sessionContext: Partial<SessionContext>,
    algorithmVersion: string = 'rule-v1',
    actionReason?: string
  ): Promise<MatchHistoryRecord> {
    return this.logInteraction(
      userId, circleId, action,
      { matchScore },
      sessionContext,
      algorithmVersion,
      actionReason
    );
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section E — Profile Snapshot Capture
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Capture member profile at current point in time for ML training data.
   * Prevents data contamination — model trains on snapshot, not current state.
   */
  private static async _captureMemberSnapshot(userId: string): Promise<MemberProfileSnapshot> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('xn_score, created_at, preferred_language, country, region')
      .eq('id', userId)
      .single();

    // Count completed + active circles
    const { count: completedCircles } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed');

    const { count: activeCircles } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Count defaults
    const { count: defaults } = await supabase
      .from('cycle_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'defaulted');

    const xnScore = profile?.xn_score ?? 50;

    return {
      xnScore,
      xnScoreTier: this._getXnScoreTier(xnScore),
      memberSince: profile?.created_at ?? new Date().toISOString(),
      circlesCompleted: completedCircles ?? 0,
      circlesActive: activeCircles ?? 0,
      defaultCount: defaults ?? 0,
      preferredLanguage: profile?.preferred_language ?? 'en',
      country: profile?.country,
      region: profile?.region,
    };
  }

  /**
   * Capture circle profile at current point in time.
   */
  private static async _captureCircleSnapshot(circleId: string): Promise<CircleProfileSnapshot> {
    const { data: circle } = await supabase
      .from('circles')
      .select('contribution_amount, cycle_length_days, max_members, language, country')
      .eq('id', circleId)
      .single();

    // Member count
    const { count: memberCount } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'active');

    // Cycles completed
    const { count: cyclesCompleted } = await supabase
      .from('circle_cycles')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'completed');

    const { count: totalCycles } = await supabase
      .from('circle_cycles')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    // Default rate from contributions
    const { count: totalContributions } = await supabase
      .from('cycle_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId);

    const { count: defaultedContributions } = await supabase
      .from('cycle_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'defaulted');

    const defaultRate = (totalContributions ?? 0) > 0
      ? (defaultedContributions ?? 0) / (totalContributions ?? 1)
      : 0;

    // Average member XnScore
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('status', 'active');

    let avgXnScore = 50;
    if (members && members.length > 0) {
      const memberIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('xn_score')
        .in('id', memberIds);

      if (profiles && profiles.length > 0) {
        avgXnScore = Math.round(
          profiles.reduce((sum, p) => sum + (p.xn_score ?? 50), 0) / profiles.length
        );
      }
    }

    // Health score from circle_health_scores if available
    const { data: healthData } = await supabase
      .from('circle_health_scores')
      .select('overall_score')
      .eq('circle_id', circleId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      contributionAmountCents: circle?.contribution_amount ?? 0,
      cycleLengthDays: circle?.cycle_length_days ?? 30,
      memberCount: memberCount ?? 0,
      maxMembers: circle?.max_members ?? 12,
      healthScore: healthData?.overall_score ?? 50,
      cyclesCompleted: cyclesCompleted ?? 0,
      totalCycles: totalCycles ?? 0,
      defaultRate: Math.round(defaultRate * 10000) / 10000,
      avgMemberXnScore: avgXnScore,
      language: circle?.language ?? 'en',
      country: circle?.country,
    };
  }

  private static _getXnScoreTier(score: number): string {
    if (score >= 90) return 'Elder';
    if (score >= 75) return 'Established';
    if (score >= 60) return 'Trusted';
    if (score >= 40) return 'Building';
    return 'Emerging';
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section F — Outcome Labeling (Weekly Cron Job)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Weekly cron job: label outcomes for 'joined' records where outcome is pending.
   * Checks circle status, member status, and contribution history to determine outcome.
   */
  static async runOutcomeLabeling(): Promise<OutcomeLabelingResult> {
    const result: OutcomeLabelingResult = {
      processed: 0,
      labeled: 0,
      skipped: 0,
      errors: 0,
      details: { success: 0, partial: 0, defaulted: 0, circleDissolved: 0, exited: 0, notApplicable: 0 },
    };

    // Get all joined records with pending or null outcome
    const { data: pendingRecords, error } = await supabase
      .from('circle_match_history')
      .select('id, user_id, circle_id, created_at')
      .eq('action', 'joined')
      .or('outcome_label.is.null,outcome_label.eq.pending')
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) throw new Error(`Failed to fetch pending records: ${error.message}`);
    if (!pendingRecords || pendingRecords.length === 0) return result;

    // Process in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < pendingRecords.length; i += BATCH_SIZE) {
      const batch = pendingRecords.slice(i, i + BATCH_SIZE);

      for (const record of batch) {
        result.processed++;
        try {
          const label = await this._evaluateOutcome(record.user_id, record.circle_id, record.created_at);

          if (label === null) {
            // Not enough time has passed or still active — keep pending
            result.skipped++;
            continue;
          }

          const { error: updateError } = await supabase
            .from('circle_match_history')
            .update({
              outcome_label: label,
              outcome_labeled_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          if (updateError) {
            result.errors++;
            continue;
          }

          result.labeled++;
          switch (label) {
            case 'success': result.details.success++; break;
            case 'partial': result.details.partial++; break;
            case 'defaulted': result.details.defaulted++; break;
            case 'circle_dissolved': result.details.circleDissolved++; break;
            case 'exited': result.details.exited++; break;
            case 'not_applicable': result.details.notApplicable++; break;
          }
        } catch {
          result.errors++;
        }
      }
    }

    return result;
  }

  /**
   * Evaluate outcome for a single joined record.
   * Returns null if not enough data yet (keep as pending).
   */
  private static async _evaluateOutcome(
    userId: string,
    circleId: string,
    joinedAt: string
  ): Promise<OutcomeLabel | null> {
    // Check circle status
    const { data: circle } = await supabase
      .from('circles')
      .select('status')
      .eq('id', circleId)
      .single();

    if (!circle) return 'not_applicable';

    // If circle is dissolved/cancelled
    if (circle.status === 'dissolved' || circle.status === 'cancelled') {
      return 'circle_dissolved';
    }

    // Check if member is still in the circle
    const { data: membership } = await supabase
      .from('circle_members')
      .select('status')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!membership) return 'not_applicable';

    // If member exited
    if (membership.status === 'exited' || membership.status === 'removed') {
      return 'exited';
    }

    // If circle is completed
    if (circle.status === 'completed') {
      // Check for defaults during participation
      const { count: defaults } = await supabase
        .from('cycle_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('circle_id', circleId)
        .eq('user_id', userId)
        .eq('status', 'defaulted');

      if ((defaults ?? 0) === 0) return 'success';

      // Check total contributions for this member
      const { count: totalContribs } = await supabase
        .from('cycle_contributions')
        .select('*', { count: 'exact', head: true })
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      const defaultRate = (totalContribs ?? 0) > 0
        ? (defaults ?? 0) / (totalContribs ?? 1)
        : 0;

      // >50% defaulted = defaulted, otherwise partial
      return defaultRate > 0.5 ? 'defaulted' : 'partial';
    }

    // If circle is still active — check if enough time has passed (30+ days)
    const joinDate = new Date(joinedAt);
    const daysSinceJoin = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceJoin < 30) {
      return null; // Too early to label, keep pending
    }

    // Active circle, 30+ days: check current contribution status
    const { count: defaults } = await supabase
      .from('cycle_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .eq('status', 'defaulted');

    if ((defaults ?? 0) > 0) {
      return 'defaulted';
    }

    // Still active after 30 days with no defaults — keep as pending until circle completes
    // Unless 90+ days have passed, then label as success (interim)
    if (daysSinceJoin >= 90) {
      return 'success';
    }

    return null; // Keep pending
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section G — Data Quality Monitoring (Weekly Cron Job)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Weekly data quality check. Writes to match_data_quality_logs.
   * Checks: snapshot completeness, action distribution balance, labeling coverage.
   */
  static async runDataQualityCheck(
    periodStart?: string,
    periodEnd?: string
  ): Promise<DataQualityLog> {
    const end = periodEnd ?? new Date().toISOString().split('T')[0];
    const start = periodStart ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Total records in period
    const { count: totalRecords } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`);

    const total = totalRecords ?? 0;

    // Records with non-empty snapshots
    const { count: withMemberSnapshot } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`)
      .neq('member_profile_snapshot', '{}');

    const { count: withCircleSnapshot } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`)
      .neq('circle_profile_snapshot', '{}');

    const { count: withSessionContext } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`)
      .neq('session_context', '{}');

    // Action distribution
    const actions: Record<string, number> = {};
    for (const action of ['viewed', 'joined', 'dismissed', 'returned', 'shared'] as const) {
      const { count } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', start)
        .lte('created_at', `${end}T23:59:59Z`)
        .eq('action', action);
      actions[action] = count ?? 0;
    }

    // Outcome labeling stats (for 'joined' records)
    const { count: outcomesLabeled } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'joined')
      .not('outcome_label', 'is', null)
      .neq('outcome_label', 'pending')
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`);

    const { count: outcomesPending } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'joined')
      .or('outcome_label.is.null,outcome_label.eq.pending')
      .gte('created_at', start)
      .lte('created_at', `${end}T23:59:59Z`);

    // Overdue: joined 90+ days ago with no outcome
    const overdueDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { count: outcomesOverdue } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'joined')
      .or('outcome_label.is.null,outcome_label.eq.pending')
      .lte('created_at', overdueDate);

    // Compute quality scores
    const missingMember = total - (withMemberSnapshot ?? 0);
    const missingCircle = total - (withCircleSnapshot ?? 0);
    const missingSession = total - (withSessionContext ?? 0);
    const recordsWithSnapshots = Math.min(withMemberSnapshot ?? 0, withCircleSnapshot ?? 0);

    const snapshotScore = total > 0
      ? Math.round(((withMemberSnapshot ?? 0) + (withCircleSnapshot ?? 0) + (withSessionContext ?? 0)) / (total * 3) * 100)
      : 100;

    const totalJoined = (outcomesLabeled ?? 0) + (outcomesPending ?? 0);
    const labelingScore = totalJoined > 0
      ? Math.round((outcomesLabeled ?? 0) / totalJoined * 100)
      : 100;

    const overallScore = Math.round((snapshotScore * 0.6) + (labelingScore * 0.4));

    // Identify issues
    const issues: DataQualityIssue[] = [];

    if (missingMember > 0) {
      issues.push({
        type: 'missing_snapshot',
        severity: missingMember / total > 0.1 ? 'warning' : 'info',
        message: `${missingMember} records missing member profile snapshot`,
        count: missingMember,
      });
    }
    if (missingCircle > 0) {
      issues.push({
        type: 'missing_snapshot',
        severity: missingCircle / total > 0.1 ? 'warning' : 'info',
        message: `${missingCircle} records missing circle profile snapshot`,
        count: missingCircle,
      });
    }
    if (missingSession > 0) {
      issues.push({
        type: 'missing_session',
        severity: missingSession / total > 0.2 ? 'warning' : 'info',
        message: `${missingSession} records missing session context`,
        count: missingSession,
      });
    }
    if ((outcomesOverdue ?? 0) > 0) {
      issues.push({
        type: 'overdue_labeling',
        severity: (outcomesOverdue ?? 0) > 50 ? 'critical' : 'warning',
        message: `${outcomesOverdue} joined records overdue for outcome labeling (90+ days)`,
        count: outcomesOverdue ?? 0,
      });
    }
    if (total < 100) {
      issues.push({
        type: 'low_volume',
        severity: total < 10 ? 'critical' : 'warning',
        message: `Only ${total} records in period (target: 10,000 total for ML training)`,
        count: total,
      });
    }

    // Check action imbalance (views > 90% of all actions)
    if (total > 0 && actions['viewed'] / total > 0.9) {
      issues.push({
        type: 'action_imbalance',
        severity: 'warning',
        message: `View actions are ${Math.round(actions['viewed'] / total * 100)}% of total — consider enriching join/dismiss/share actions`,
        count: actions['viewed'],
      });
    }

    // Write quality log
    const { data, error } = await supabase
      .from('match_data_quality_logs')
      .insert({
        check_date: new Date().toISOString().split('T')[0],
        period_start: start,
        period_end: end,
        total_records: total,
        records_with_snapshots: recordsWithSnapshots,
        records_missing_member_snapshot: missingMember,
        records_missing_circle_snapshot: missingCircle,
        records_missing_session_context: missingSession,
        view_count: actions['viewed'] ?? 0,
        join_count: actions['joined'] ?? 0,
        dismiss_count: actions['dismissed'] ?? 0,
        return_count: actions['returned'] ?? 0,
        share_count: actions['shared'] ?? 0,
        outcomes_pending: outcomesPending ?? 0,
        outcomes_labeled: outcomesLabeled ?? 0,
        outcomes_overdue: outcomesOverdue ?? 0,
        snapshot_completeness_score: snapshotScore,
        outcome_labeling_score: labelingScore,
        overall_quality_score: overallScore,
        issues,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to write quality log: ${error.message}`);
    return mapQualityLog(data);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section H — Query: Member History
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get a member's match history with all ML columns.
   */
  static async getMemberHistory(userId: string, limit: number = 50): Promise<MatchHistoryRecord[]> {
    const { data, error } = await supabase
      .from('circle_match_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch member history: ${error.message}`);
    return (data ?? []).map(mapRecord);
  }

  /**
   * Get history for a specific circle.
   */
  static async getCircleHistory(circleId: string, limit: number = 100): Promise<MatchHistoryRecord[]> {
    const { data, error } = await supabase
      .from('circle_match_history')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch circle history: ${error.message}`);
    return (data ?? []).map(mapRecord);
  }

  /**
   * Get records by action type (for ML feature analysis).
   */
  static async getRecordsByAction(
    action: MatchAction,
    limit: number = 100
  ): Promise<MatchHistoryRecord[]> {
    const { data, error } = await supabase
      .from('circle_match_history')
      .select('*')
      .eq('action', action)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch records by action: ${error.message}`);
    return (data ?? []).map(mapRecord);
  }

  /**
   * Get records by algorithm version (for A/B testing comparison).
   */
  static async getRecordsByAlgorithm(
    algorithmVersion: string,
    limit: number = 200
  ): Promise<MatchHistoryRecord[]> {
    const { data, error } = await supabase
      .from('circle_match_history')
      .select('*')
      .eq('algorithm_version', algorithmVersion)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch records by algorithm: ${error.message}`);
    return (data ?? []).map(mapRecord);
  }

  /**
   * Get labeled records for ML training export.
   * Only returns records with non-null outcome_label (excluding 'pending').
   */
  static async getLabeledTrainingData(
    limit: number = 1000,
    algorithmVersion?: string
  ): Promise<MatchHistoryRecord[]> {
    let query = supabase
      .from('circle_match_history')
      .select('*')
      .not('outcome_label', 'is', null)
      .neq('outcome_label', 'pending')
      .neq('member_profile_snapshot', '{}')
      .neq('circle_profile_snapshot', '{}')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (algorithmVersion) {
      query = query.eq('algorithm_version', algorithmVersion);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch labeled training data: ${error.message}`);
    return (data ?? []).map(mapRecord);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section I — Training Data Stats (Admin / ML Pipeline)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get overall training data statistics for the ML pipeline dashboard.
   */
  static async getTrainingDataStats(): Promise<TrainingDataStats> {
    // Total records
    const { count: totalRecords } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true });

    // Labeled (non-null, non-pending outcome)
    const { count: labeledRecords } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .not('outcome_label', 'is', null)
      .neq('outcome_label', 'pending');

    // Records with complete snapshots
    const { count: withSnapshots } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .neq('member_profile_snapshot', '{}')
      .neq('circle_profile_snapshot', '{}');

    // Action distribution
    const actionDist: Record<MatchAction, number> = {
      viewed: 0, dismissed: 0, saved: 0, applied: 0,
      joined: 0, rejected: 0, returned: 0, shared: 0,
    };
    for (const action of Object.keys(actionDist) as MatchAction[]) {
      const { count } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('action', action);
      actionDist[action] = count ?? 0;
    }

    // Outcome distribution
    const outcomeDist: Record<string, number> = {};
    const outcomeLabels: OutcomeLabel[] = ['pending', 'success', 'partial', 'defaulted', 'circle_dissolved', 'exited', 'not_applicable'];
    for (const label of outcomeLabels) {
      const { count } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('outcome_label', label);
      outcomeDist[label] = count ?? 0;
    }
    // Null outcomes
    const { count: nullOutcomes } = await supabase
      .from('circle_match_history')
      .select('*', { count: 'exact', head: true })
      .is('outcome_label', null);
    outcomeDist['unlabeled'] = nullOutcomes ?? 0;

    // Algorithm versions
    const { data: versionData } = await supabase
      .from('circle_match_history')
      .select('algorithm_version')
      .not('algorithm_version', 'is', null);

    const versionCounts: Record<string, number> = {};
    for (const row of versionData ?? []) {
      const v = row.algorithm_version ?? 'rule-v1';
      versionCounts[v] = (versionCounts[v] ?? 0) + 1;
    }
    const algorithmVersions = Object.entries(versionCounts)
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count);

    // Date range
    const { data: earliest } = await supabase
      .from('circle_match_history')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    const { data: latest } = await supabase
      .from('circle_match_history')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Latest quality score
    const { data: latestQuality } = await supabase
      .from('match_data_quality_logs')
      .select('overall_quality_score')
      .order('check_date', { ascending: false })
      .limit(1)
      .single();

    const total = totalRecords ?? 0;
    const labeled = labeledRecords ?? 0;

    return {
      totalRecords: total,
      labeledRecords: labeled,
      unlabeledRecords: total - labeled,
      recordsWithSnapshots: withSnapshots ?? 0,
      actionDistribution: actionDist,
      outcomeDistribution: outcomeDist,
      algorithmVersions,
      dateRange: earliest && latest
        ? { earliest: earliest.created_at, latest: latest.created_at }
        : null,
      qualityScore: latestQuality?.overall_quality_score ?? 0,
    };
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section J — Data Quality Log Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get recent data quality logs.
   */
  static async getQualityLogs(limit: number = 12): Promise<DataQualityLog[]> {
    const { data, error } = await supabase
      .from('match_data_quality_logs')
      .select('*')
      .order('check_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch quality logs: ${error.message}`);
    return (data ?? []).map(mapQualityLog);
  }

  /**
   * Get quality logs with low scores (below threshold).
   */
  static async getLowQualityLogs(threshold: number = 80): Promise<DataQualityLog[]> {
    const { data, error } = await supabase
      .from('match_data_quality_logs')
      .select('*')
      .lt('overall_quality_score', threshold)
      .order('check_date', { ascending: false })
      .limit(20);

    if (error) throw new Error(`Failed to fetch low quality logs: ${error.message}`);
    return (data ?? []).map(mapQualityLog);
  }

  /**
   * Get the latest quality log.
   */
  static async getLatestQualityLog(): Promise<DataQualityLog | null> {
    const { data, error } = await supabase
      .from('match_data_quality_logs')
      .select('*')
      .order('check_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch latest quality log: ${error.message}`);
    }
    return data ? mapQualityLog(data) : null;
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section K — A/B Testing Support
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Compare two algorithm versions' performance.
   * Returns join rate, dismissal rate, and outcome success rate for each version.
   */
  static async compareAlgorithms(
    versionA: string,
    versionB: string
  ): Promise<{
    versionA: { version: string; total: number; joinRate: number; dismissRate: number; successRate: number };
    versionB: { version: string; total: number; joinRate: number; dismissRate: number; successRate: number };
    winner: string | null;
  }> {
    const computeStats = async (version: string) => {
      const { count: total } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('algorithm_version', version);

      const { count: joins } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('algorithm_version', version)
        .eq('action', 'joined');

      const { count: dismissals } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('algorithm_version', version)
        .eq('action', 'dismissed');

      const { count: successes } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('algorithm_version', version)
        .eq('outcome_label', 'success');

      const { count: labeled } = await supabase
        .from('circle_match_history')
        .select('*', { count: 'exact', head: true })
        .eq('algorithm_version', version)
        .not('outcome_label', 'is', null)
        .neq('outcome_label', 'pending');

      const t = total ?? 0;
      return {
        version,
        total: t,
        joinRate: t > 0 ? Math.round((joins ?? 0) / t * 10000) / 100 : 0,
        dismissRate: t > 0 ? Math.round((dismissals ?? 0) / t * 10000) / 100 : 0,
        successRate: (labeled ?? 0) > 0 ? Math.round((successes ?? 0) / (labeled ?? 1) * 10000) / 100 : 0,
      };
    };

    const [statsA, statsB] = await Promise.all([
      computeStats(versionA),
      computeStats(versionB),
    ]);

    // Winner: higher join rate AND higher success rate
    let winner: string | null = null;
    if (statsA.total >= 50 && statsB.total >= 50) {
      if (statsA.joinRate > statsB.joinRate && statsA.successRate >= statsB.successRate) {
        winner = versionA;
      } else if (statsB.joinRate > statsA.joinRate && statsB.successRate >= statsA.successRate) {
        winner = versionB;
      }
    }

    return { versionA: statsA, versionB: statsB, winner };
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section L — Realtime
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a member's match history updates.
   */
  static subscribeToMemberHistory(userId: string, callback: () => void) {
    return supabase
      .channel(`match_history_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_match_history',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to quality log updates (admin dashboard).
   */
  static subscribeToQualityLogs(callback: () => void) {
    return supabase
      .channel('match_quality_logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_data_quality_logs',
        },
        callback
      )
      .subscribe();
  }
}
