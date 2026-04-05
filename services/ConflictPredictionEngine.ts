// ══════════════════════════════════════════════════════════════════════════════
// ConflictPredictionEngine — Feature #35: Conflict Prediction Engine
// Pairwise friction scoring at circle formation time — 6 risk factors
// sync_stress (30%), prior_dispute (25%), payout_friction (20%),
// style_mismatch (10%), trust_gap (10%), rapid_enrollment (5%)
// PairFrictionScore 0-100: Compatible (0-29) / Watch (30-54) / Flag (55-74) /
// Separate (75-100)
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type FrictionTier = "compatible" | "watch" | "flag" | "separate";

export type ConflictType =
  | "payment_dispute"
  | "payout_dispute"
  | "contribution_complaint"
  | "trust_violation"
  | "abrupt_exit"
  | "verbal_conflict"
  | "rule_violation"
  | "other";

export type ConflictSeverity = "low" | "medium" | "high" | "critical";
export type ConflictSource = "system" | "admin_report" | "member_report" | "elder_mediation";

export type ReviewOutcome =
  | "approved"
  | "pair_separated"
  | "circle_restructured"
  | "formation_blocked"
  | "overridden";

export interface ConflictRecord {
  id: string;
  memberId: string;
  circleId: string | null;
  cycleId: string | null;
  conflictType: ConflictType;
  severity: ConflictSeverity;
  otherMemberId: string | null;
  description: string | null;
  source: ConflictSource;
  resolvedAt: string | null;
  resolutionType: string | null;
  resolutionNotes: string | null;
  resultedInExit: boolean;
  resultedInDefault: boolean;
  reportedAt: string;
}

export interface FactorBreakdown {
  sync_stress: { score: number; weight: number; detail: Record<string, any> };
  prior_dispute: { score: number; weight: number; detail: Record<string, any> };
  payout_friction: { score: number; weight: number; detail: Record<string, any> };
  style_mismatch: { score: number; weight: number; detail: Record<string, any> };
  trust_gap: { score: number; weight: number; detail: Record<string, any> };
  rapid_enrollment: { score: number; weight: number; detail: Record<string, any> };
}

export interface PairScore {
  id: string;
  memberAId: string;
  memberBId: string;
  circleId: string | null;
  formationRunId: string | null;
  frictionScore: number;
  tier: FrictionTier;
  factorBreakdown: FactorBreakdown;
  memberAXnscore: number | null;
  memberBXnscore: number | null;
  memberAStress: number | null;
  memberBStress: number | null;
  memberAMood: number | null;
  memberBMood: number | null;
  scoringModel: string;
  scoreDate: string;
  createdAt: string;
}

export interface FormationFlag {
  id: string;
  circleId: string | null;
  formationRunId: string;
  totalPairs: number;
  flaggedPairs: number;
  highestScore: number;
  circleTier: FrictionTier | "clear";
  flaggedPairIds: FlaggedPairSummary[];
  requiresReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewOutcome: ReviewOutcome | null;
  reviewNotes: string | null;
  proposedMembers: string[];
  flaggedAt: string;
  createdAt: string;
}

export interface FlaggedPairSummary {
  member_a_id: string;
  member_b_id: string;
  friction_score: number;
  tier: FrictionTier;
  top_factor: string;
}

export interface PostFormationMonitor {
  id: string;
  circleId: string;
  memberAId: string;
  memberBId: string;
  pairScoreId: string | null;
  initialTier: string;
  initialScore: number;
  currentScore: number | null;
  currentTier: string | null;
  alertCount: number;
  lastAlertAt: string | null;
  lastEvaluatedAt: string | null;
  escalated: boolean;
  escalatedAt: string | null;
  escalationReason: string | null;
  monitoringStart: string;
  monitoringEnd: string | null;
  isActive: boolean;
}

export interface FormationEvaluation {
  formationRunId: string;
  circleId: string | null;
  proposedMembers: string[];
  totalPairs: number;
  pairScores: PairScore[];
  flaggedPairs: PairScore[];
  highestScore: number;
  circleTier: FrictionTier | "clear";
  requiresReview: boolean;
  canProceed: boolean;
  flag: FormationFlag;
}

export interface ConflictDashboardRow {
  scoreDate: string;
  totalPairsScored: number;
  compatibleCount: number;
  watchCount: number;
  flagCount: number;
  separateCount: number;
  avgFriction: number;
  maxFriction: number;
}

// ─── FACTOR WEIGHTS (v1) ───────────────────────────────────────────────────

const WEIGHTS = {
  sync_stress: 0.30,
  prior_dispute: 0.25,
  payout_friction: 0.20,
  style_mismatch: 0.10,
  trust_gap: 0.10,
  rapid_enrollment: 0.05,
} as const;

const SCORING_MODEL = "pairwise_v1";

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapConflict(row: any): ConflictRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    circleId: row.circle_id,
    cycleId: row.cycle_id,
    conflictType: row.conflict_type,
    severity: row.severity,
    otherMemberId: row.other_member_id,
    description: row.description,
    source: row.source,
    resolvedAt: row.resolved_at,
    resolutionType: row.resolution_type,
    resolutionNotes: row.resolution_notes,
    resultedInExit: row.resulted_in_exit,
    resultedInDefault: row.resulted_in_default,
    reportedAt: row.reported_at,
  };
}

function mapPairScore(row: any): PairScore {
  return {
    id: row.id,
    memberAId: row.member_a_id,
    memberBId: row.member_b_id,
    circleId: row.circle_id,
    formationRunId: row.formation_run_id,
    frictionScore: parseFloat(row.friction_score),
    tier: row.tier,
    factorBreakdown: row.factor_breakdown ?? {},
    memberAXnscore: row.member_a_xnscore != null ? parseFloat(row.member_a_xnscore) : null,
    memberBXnscore: row.member_b_xnscore != null ? parseFloat(row.member_b_xnscore) : null,
    memberAStress: row.member_a_stress != null ? parseFloat(row.member_a_stress) : null,
    memberBStress: row.member_b_stress != null ? parseFloat(row.member_b_stress) : null,
    memberAMood: row.member_a_mood != null ? parseFloat(row.member_a_mood) : null,
    memberBMood: row.member_b_mood != null ? parseFloat(row.member_b_mood) : null,
    scoringModel: row.scoring_model,
    scoreDate: row.score_date,
    createdAt: row.created_at,
  };
}

function mapFormationFlag(row: any): FormationFlag {
  return {
    id: row.id,
    circleId: row.circle_id,
    formationRunId: row.formation_run_id,
    totalPairs: row.total_pairs,
    flaggedPairs: row.flagged_pairs,
    highestScore: parseFloat(row.highest_score),
    circleTier: row.circle_tier,
    flaggedPairIds: row.flagged_pair_ids ?? [],
    requiresReview: row.requires_review,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewOutcome: row.review_outcome,
    reviewNotes: row.review_notes,
    proposedMembers: row.proposed_members ?? [],
    flaggedAt: row.flagged_at,
    createdAt: row.created_at,
  };
}

function mapMonitor(row: any): PostFormationMonitor {
  return {
    id: row.id,
    circleId: row.circle_id,
    memberAId: row.member_a_id,
    memberBId: row.member_b_id,
    pairScoreId: row.pair_score_id,
    initialTier: row.initial_tier,
    initialScore: parseFloat(row.initial_score),
    currentScore: row.current_score != null ? parseFloat(row.current_score) : null,
    currentTier: row.current_tier,
    alertCount: row.alert_count,
    lastAlertAt: row.last_alert_at,
    lastEvaluatedAt: row.last_evaluated_at,
    escalated: row.escalated,
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
    monitoringStart: row.monitoring_start,
    monitoringEnd: row.monitoring_end,
    isActive: row.is_active,
  };
}

function mapDashboardRow(row: any): ConflictDashboardRow {
  return {
    scoreDate: row.score_date,
    totalPairsScored: parseInt(row.total_pairs_scored),
    compatibleCount: parseInt(row.compatible_count),
    watchCount: parseInt(row.watch_count),
    flagCount: parseInt(row.flag_count),
    separateCount: parseInt(row.separate_count),
    avgFriction: parseFloat(row.avg_friction),
    maxFriction: parseFloat(row.max_friction),
  };
}

/** Ensure member_a_id < member_b_id for canonical pair ordering */
function orderPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ConflictPredictionEngine
// ═══════════════════════════════════════════════════════════════════════════════

export class ConflictPredictionEngine {

  // ─── A. CONFLICT HISTORY ─────────────────────────────────────────────────

  /** Log a conflict / dispute / complaint / exit event */
  static async logConflict(
    memberId: string,
    conflictType: ConflictType,
    options?: {
      circleId?: string;
      cycleId?: string;
      otherMemberId?: string;
      severity?: ConflictSeverity;
      description?: string;
      source?: ConflictSource;
      resultedInExit?: boolean;
      resultedInDefault?: boolean;
    }
  ): Promise<ConflictRecord> {
    const { data: row, error } = await supabase
      .from("conflict_history")
      .insert({
        member_id: memberId,
        conflict_type: conflictType,
        circle_id: options?.circleId ?? null,
        cycle_id: options?.cycleId ?? null,
        other_member_id: options?.otherMemberId ?? null,
        severity: options?.severity ?? "medium",
        description: options?.description ?? null,
        source: options?.source ?? "system",
        resulted_in_exit: options?.resultedInExit ?? false,
        resulted_in_default: options?.resultedInDefault ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return mapConflict(row);
  }

  /** Resolve a conflict */
  static async resolveConflict(
    conflictId: string,
    resolutionType: string,
    notes?: string
  ): Promise<ConflictRecord> {
    const { data, error } = await supabase
      .from("conflict_history")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_type: resolutionType,
        resolution_notes: notes ?? null,
      })
      .eq("id", conflictId)
      .select()
      .single();
    if (error) throw error;
    return mapConflict(data);
  }

  /** Get conflict history for a member */
  static async getMemberConflicts(memberId: string): Promise<ConflictRecord[]> {
    const { data, error } = await supabase
      .from("conflict_history")
      .select("*")
      .or(`member_id.eq.${memberId},other_member_id.eq.${memberId}`)
      .order("reported_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapConflict);
  }

  /** Get conflicts between two specific members */
  static async getPairConflicts(idA: string, idB: string): Promise<ConflictRecord[]> {
    const { data, error } = await supabase
      .from("conflict_history")
      .select("*")
      .or(
        `and(member_id.eq.${idA},other_member_id.eq.${idB}),` +
        `and(member_id.eq.${idB},other_member_id.eq.${idA})`
      )
      .order("reported_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapConflict);
  }

  // ─── B. PAIRWISE SCORING (Core) ─────────────────────────────────────────

  /**
   * Score a single pair of members for friction potential.
   * This is the core scoring function used by evaluateCircleFormation().
   */
  static async scorePair(
    idA: string,
    idB: string,
    options?: { circleId?: string; formationRunId?: string }
  ): Promise<PairScore> {
    const [memberA, memberB] = orderPair(idA, idB);

    // Fetch all factor inputs in parallel
    const [
      stressA, stressB,
      moodA, moodB,
      xnscoreA, xnscoreB,
      pairConflicts, conflictsA, conflictsB,
      profileA, profileB,
    ] = await Promise.all([
      this._getLatestStressScore(memberA),
      this._getLatestStressScore(memberB),
      this._getLatestMoodScore(memberA),
      this._getLatestMoodScore(memberB),
      this._getXnScore(memberA),
      this._getXnScore(memberB),
      this.getPairConflicts(memberA, memberB),
      this.getMemberConflicts(memberA),
      this.getMemberConflicts(memberB),
      this._getMemberProfile(memberA),
      this._getMemberProfile(memberB),
    ]);

    // ── Factor 1: Synchronized Stress (30%) ──
    const stressValA = stressA ?? 0;
    const stressValB = stressB ?? 0;
    const bothAbove60 = stressValA > 60 && stressValB > 60;
    const syncStressScore = bothAbove60
      ? Math.min(100, ((stressValA + stressValB) / 2 - 60) * 2.5)
      : Math.min(100, Math.max(0, ((stressValA + stressValB) / 2 - 40) * 1.0));

    // ── Factor 2: Prior Dispute Record (25%) ──
    const directConflicts = pairConflicts.length;
    const totalConflictsA = conflictsA.length;
    const totalConflictsB = conflictsB.length;
    const exitConflicts = [...conflictsA, ...conflictsB].filter(c => c.resultedInExit).length;
    const highSeverity = [...conflictsA, ...conflictsB].filter(
      c => c.severity === "high" || c.severity === "critical"
    ).length;
    // Direct conflicts are most predictive; general history is secondary
    let priorDisputeScore = directConflicts * 40 + highSeverity * 10 + exitConflicts * 15;
    priorDisputeScore = Math.min(100, priorDisputeScore);

    // ── Factor 3: Payout Position Friction (20%) ──
    // Check if either member has a history of late payments
    const lateCountA = await this._getLatePaymentCount(memberA);
    const lateCountB = await this._getLatePaymentCount(memberB);
    // Friction when one is consistently late and the other is on time (or both late)
    const bothLate = lateCountA > 2 && lateCountB > 2;
    const oneLate = (lateCountA > 3 && lateCountB <= 1) || (lateCountB > 3 && lateCountA <= 1);
    const payoutFrictionScore = bothLate ? 60 : oneLate ? 80 : Math.min(100, (lateCountA + lateCountB) * 8);

    // ── Factor 4: Contribution Style Mismatch (10%) ──
    const avgDaysLateA = await this._getAvgDaysLate(memberA);
    const avgDaysLateB = await this._getAvgDaysLate(memberB);
    const styleDiff = Math.abs(avgDaysLateA - avgDaysLateB);
    // Big gap between an always-early member and a chronically late member
    const styleMismatchScore = Math.min(100, styleDiff * 15);

    // ── Factor 5: Social Connection Gap (10%) ──
    const sharedConnections = await this._getSharedConnections(memberA, memberB);
    // 0 shared = 100, 1 shared = 60, 2 shared = 30, 3+ = 0
    const trustGapScore = sharedConnections >= 3 ? 0
      : sharedConnections === 2 ? 30
      : sharedConnections === 1 ? 60 : 100;

    // ── Factor 6: Rapid Enrollment (5%) ──
    const daysOnPlatformA = profileA?.daysSinceJoin ?? 999;
    const daysOnPlatformB = profileB?.daysSinceJoin ?? 999;
    const minDays = Math.min(daysOnPlatformA, daysOnPlatformB);
    // <72 hours (3 days) = 100, <30 days = 50, <60 days = 25
    const rapidEnrollScore = minDays < 3 ? 100 : minDays < 30 ? 50 : minDays < 60 ? 25 : 0;

    // ── Composite ──
    const frictionScore = Math.min(100, Math.max(0,
      syncStressScore * WEIGHTS.sync_stress +
      priorDisputeScore * WEIGHTS.prior_dispute +
      payoutFrictionScore * WEIGHTS.payout_friction +
      styleMismatchScore * WEIGHTS.style_mismatch +
      trustGapScore * WEIGHTS.trust_gap +
      rapidEnrollScore * WEIGHTS.rapid_enrollment
    ));

    const factorBreakdown: FactorBreakdown = {
      sync_stress: {
        score: syncStressScore, weight: WEIGHTS.sync_stress,
        detail: { stress_a: stressValA, stress_b: stressValB, both_above_60: bothAbove60 },
      },
      prior_dispute: {
        score: priorDisputeScore, weight: WEIGHTS.prior_dispute,
        detail: { direct_conflicts: directConflicts, total_a: totalConflictsA, total_b: totalConflictsB, exit_conflicts: exitConflicts, high_severity: highSeverity },
      },
      payout_friction: {
        score: payoutFrictionScore, weight: WEIGHTS.payout_friction,
        detail: { late_count_a: lateCountA, late_count_b: lateCountB, both_late: bothLate, one_late: oneLate },
      },
      style_mismatch: {
        score: styleMismatchScore, weight: WEIGHTS.style_mismatch,
        detail: { avg_days_late_a: avgDaysLateA, avg_days_late_b: avgDaysLateB, style_diff: styleDiff },
      },
      trust_gap: {
        score: trustGapScore, weight: WEIGHTS.trust_gap,
        detail: { shared_connections: sharedConnections },
      },
      rapid_enrollment: {
        score: rapidEnrollScore, weight: WEIGHTS.rapid_enrollment,
        detail: { days_on_platform_a: daysOnPlatformA, days_on_platform_b: daysOnPlatformB, min_days: minDays },
      },
    };

    // Insert pair score
    const { data: row, error } = await supabase
      .from("member_pair_scores")
      .insert({
        member_a_id: memberA,
        member_b_id: memberB,
        circle_id: options?.circleId ?? null,
        formation_run_id: options?.formationRunId ?? null,
        friction_score: frictionScore,
        factor_breakdown: factorBreakdown,
        member_a_xnscore: xnscoreA,
        member_b_xnscore: xnscoreB,
        member_a_stress: stressValA,
        member_b_stress: stressValB,
        member_a_mood: moodA,
        member_b_mood: moodB,
        scoring_model: SCORING_MODEL,
      })
      .select()
      .single();
    if (error) throw error;
    return mapPairScore(row);
  }

  // ─── C. CIRCLE FORMATION EVALUATION ──────────────────────────────────────

  /**
   * Evaluate ALL pairs in a proposed circle before formation.
   * This is the main entry point — called when admin clicks "Create Circle".
   * Returns a full evaluation with tier, flagged pairs, and whether review is needed.
   */
  static async evaluateCircleFormation(
    proposedMemberIds: string[],
    circleId?: string
  ): Promise<FormationEvaluation> {
    const formationRunId = crypto.randomUUID();

    // Generate all unique pairs
    const pairs: [string, string][] = [];
    for (let i = 0; i < proposedMemberIds.length; i++) {
      for (let j = i + 1; j < proposedMemberIds.length; j++) {
        pairs.push(orderPair(proposedMemberIds[i], proposedMemberIds[j]));
      }
    }

    // Score all pairs
    const pairScores: PairScore[] = [];
    for (const [a, b] of pairs) {
      const score = await this.scorePair(a, b, { circleId, formationRunId });
      pairScores.push(score);
    }

    // Determine circle-level tier (highest pair determines)
    const highestScore = pairScores.length > 0
      ? Math.max(...pairScores.map(p => p.frictionScore))
      : 0;

    const circleTier: FrictionTier | "clear" = highestScore <= 29 ? "clear"
      : highestScore <= 54 ? "watch"
      : highestScore <= 74 ? "flag"
      : "separate";

    // Flagged pairs (Watch and above)
    const flaggedPairs = pairScores.filter(p => p.frictionScore > 29);
    const requiresReview = circleTier === "flag" || circleTier === "separate";
    const canProceed = circleTier !== "separate";

    // Build flagged pair summaries
    const flaggedPairSummaries: FlaggedPairSummary[] = flaggedPairs.map(p => {
      const breakdown = p.factorBreakdown as FactorBreakdown;
      const topFactor = Object.entries(breakdown)
        .sort(([, a], [, b]) => (b.score * b.weight) - (a.score * a.weight))[0]?.[0] ?? "unknown";
      return {
        member_a_id: p.memberAId,
        member_b_id: p.memberBId,
        friction_score: p.frictionScore,
        tier: p.tier,
        top_factor: topFactor,
      };
    });

    // Create formation flag record
    const { data: flagRow, error: flagErr } = await supabase
      .from("circle_formation_flags")
      .insert({
        circle_id: circleId ?? null,
        formation_run_id: formationRunId,
        total_pairs: pairs.length,
        flagged_pairs: flaggedPairs.length,
        highest_score: highestScore,
        circle_tier: circleTier === "clear" ? "clear" : circleTier,
        flagged_pair_ids: flaggedPairSummaries,
        requires_review: requiresReview,
        proposed_members: proposedMemberIds,
      })
      .select()
      .single();
    if (flagErr) throw flagErr;

    // Set up post-formation monitoring for Watch+ pairs
    for (const pair of flaggedPairs) {
      if (pair.tier === "watch" || pair.tier === "flag") {
        await supabase.from("post_formation_monitor").insert({
          circle_id: circleId ?? null,
          member_a_id: pair.memberAId,
          member_b_id: pair.memberBId,
          pair_score_id: pair.id,
          initial_tier: pair.tier,
          initial_score: pair.frictionScore,
          current_score: pair.frictionScore,
          current_tier: pair.tier,
        });
      }
    }

    return {
      formationRunId,
      circleId: circleId ?? null,
      proposedMembers: proposedMemberIds,
      totalPairs: pairs.length,
      pairScores,
      flaggedPairs,
      highestScore,
      circleTier,
      requiresReview,
      canProceed,
      flag: mapFormationFlag(flagRow),
    };
  }

  // ─── D. HUMAN REVIEW ────────────────────────────────────────────────────

  /** Admin reviews and approves/rejects a formation flag */
  static async reviewFormationFlag(
    flagId: string,
    reviewerId: string,
    outcome: ReviewOutcome,
    notes?: string
  ): Promise<FormationFlag> {
    const { data, error } = await supabase
      .from("circle_formation_flags")
      .update({
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        review_outcome: outcome,
        review_notes: notes ?? null,
      })
      .eq("id", flagId)
      .select()
      .single();
    if (error) throw error;
    return mapFormationFlag(data);
  }

  /** Get all formation flags pending review */
  static async getPendingReviews(): Promise<FormationFlag[]> {
    const { data, error } = await supabase
      .from("circle_formation_flags")
      .select("*")
      .eq("requires_review", true)
      .is("reviewed_at", null)
      .order("highest_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapFormationFlag);
  }

  /** Get formation flag by ID */
  static async getFormationFlag(flagId: string): Promise<FormationFlag | null> {
    const { data, error } = await supabase
      .from("circle_formation_flags")
      .select("*")
      .eq("id", flagId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapFormationFlag(data) : null;
  }

  /** Get formation flag by formation run ID */
  static async getFormationFlagByRun(runId: string): Promise<FormationFlag | null> {
    const { data, error } = await supabase
      .from("circle_formation_flags")
      .select("*")
      .eq("formation_run_id", runId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapFormationFlag(data) : null;
  }

  // ─── E. POST-FORMATION MONITORING ───────────────────────────────────────

  /** Re-evaluate all active monitored pairs (called weekly by cron) */
  static async runPostFormationMonitoring(): Promise<{
    evaluated: number;
    escalated: number;
    deescalated: number;
    errors: string[];
  }> {
    const { data: monitors, error } = await supabase
      .from("post_formation_monitor")
      .select("*")
      .eq("is_active", true)
      .eq("escalated", false);
    if (error) throw error;

    let evaluated = 0;
    let escalated = 0;
    let deescalated = 0;
    const errors: string[] = [];

    for (const mon of (monitors ?? [])) {
      try {
        // Re-score the pair with latest data
        const newScore = await this.scorePair(mon.member_a_id, mon.member_b_id, {
          circleId: mon.circle_id,
        });

        const newTier = newScore.tier;
        const updates: any = {
          current_score: newScore.frictionScore,
          current_tier: newTier,
          last_evaluated_at: new Date().toISOString(),
        };

        // Escalation: Watch pair crossed into Flag territory
        if (
          (mon.initial_tier === "watch" && (newTier === "flag" || newTier === "separate")) ||
          newScore.frictionScore > 55
        ) {
          updates.escalated = true;
          updates.escalated_at = new Date().toISOString();
          updates.escalation_reason = `Score increased from ${mon.initial_score} to ${newScore.frictionScore} (${mon.initial_tier} → ${newTier})`;
          updates.alert_count = (mon.alert_count ?? 0) + 1;
          updates.last_alert_at = new Date().toISOString();
          escalated++;
        }

        // De-escalation: score dropped below Watch
        if (newScore.frictionScore < 30 && mon.alert_count === 0) {
          updates.is_active = false;
          updates.monitoring_end = new Date().toISOString();
          deescalated++;
        }

        await supabase
          .from("post_formation_monitor")
          .update(updates)
          .eq("id", mon.id);

        evaluated++;
      } catch (err: any) {
        errors.push(`Monitor ${mon.id}: ${err.message}`);
      }
    }

    return { evaluated, escalated, deescalated, errors };
  }

  /** Get active monitors for a circle */
  static async getCircleMonitors(circleId: string): Promise<PostFormationMonitor[]> {
    const { data, error } = await supabase
      .from("post_formation_monitor")
      .select("*")
      .eq("circle_id", circleId)
      .eq("is_active", true)
      .order("current_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMonitor);
  }

  /** Get all escalated monitors */
  static async getEscalatedMonitors(): Promise<PostFormationMonitor[]> {
    const { data, error } = await supabase
      .from("post_formation_monitor")
      .select("*")
      .eq("escalated", true)
      .eq("is_active", true)
      .order("escalated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMonitor);
  }

  /** Admin manually flags a pair post-formation */
  static async manualFlagPair(
    circleId: string,
    memberAId: string,
    memberBId: string,
    reason: string
  ): Promise<PostFormationMonitor> {
    const [a, b] = orderPair(memberAId, memberBId);
    const { data, error } = await supabase
      .from("post_formation_monitor")
      .insert({
        circle_id: circleId,
        member_a_id: a,
        member_b_id: b,
        initial_tier: "flag",
        initial_score: 55,
        current_score: 55,
        current_tier: "flag",
        escalated: true,
        escalated_at: new Date().toISOString(),
        escalation_reason: `Manual flag: ${reason}`,
        alert_count: 1,
        last_alert_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return mapMonitor(data);
  }

  // ─── F. QUERIES ──────────────────────────────────────────────────────────

  /** Get pair scores for a specific circle formation */
  static async getCirclePairScores(circleId: string): Promise<PairScore[]> {
    const { data, error } = await supabase
      .from("member_pair_scores")
      .select("*")
      .eq("circle_id", circleId)
      .order("friction_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPairScore);
  }

  /** Get pair scores for a formation run */
  static async getFormationRunScores(runId: string): Promise<PairScore[]> {
    const { data, error } = await supabase
      .from("member_pair_scores")
      .select("*")
      .eq("formation_run_id", runId)
      .order("friction_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapPairScore);
  }

  /** Get score between two specific members (latest) */
  static async getLatestPairScore(idA: string, idB: string): Promise<PairScore | null> {
    const [a, b] = orderPair(idA, idB);
    const { data, error } = await supabase
      .from("member_pair_scores")
      .select("*")
      .eq("member_a_id", a)
      .eq("member_b_id", b)
      .order("score_date", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapPairScore(data) : null;
  }

  /** Get formation flags for a circle */
  static async getCircleFormationFlags(circleId: string): Promise<FormationFlag[]> {
    const { data, error } = await supabase
      .from("circle_formation_flags")
      .select("*")
      .eq("circle_id", circleId)
      .order("flagged_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapFormationFlag);
  }

  // ─── G. ADMIN DASHBOARD ─────────────────────────────────────────────────

  /** Get conflict prediction dashboard */
  static async getDashboard(days: number = 30): Promise<ConflictDashboardRow[]> {
    const { data, error } = await supabase
      .from("conflict_prediction_dashboard")
      .select("*")
      .limit(days);
    if (error) throw error;
    return (data ?? []).map(mapDashboardRow);
  }

  /** Get conflict prediction effectiveness metrics */
  static async getMetrics(): Promise<{
    totalFormationsEvaluated: number;
    formationsCleared: number;
    formationsFlagged: number;
    formationsBlocked: number;
    reviewsPending: number;
    reviewsCompleted: number;
    overrides: number;
    avgReviewTimeHours: number;
    activeMonitors: number;
    escalatedMonitors: number;
  }> {
    const { data: flags, error: fErr } = await supabase
      .from("circle_formation_flags")
      .select("circle_tier, requires_review, reviewed_at, review_outcome, flagged_at");
    if (fErr) throw fErr;

    const { data: monitors, error: mErr } = await supabase
      .from("post_formation_monitor")
      .select("is_active, escalated");
    if (mErr) throw mErr;

    const rows = flags ?? [];
    const mons = monitors ?? [];

    const reviewedRows = rows.filter(r => r.reviewed_at);
    const reviewTimes = reviewedRows.map(r => {
      const flagged = new Date(r.flagged_at).getTime();
      const reviewed = new Date(r.reviewed_at).getTime();
      return (reviewed - flagged) / (1000 * 60 * 60);
    });

    return {
      totalFormationsEvaluated: rows.length,
      formationsCleared: rows.filter(r => r.circle_tier === "clear" || r.circle_tier === "watch").length,
      formationsFlagged: rows.filter(r => r.requires_review).length,
      formationsBlocked: rows.filter(r => r.circle_tier === "separate").length,
      reviewsPending: rows.filter(r => r.requires_review && !r.reviewed_at).length,
      reviewsCompleted: reviewedRows.length,
      overrides: rows.filter(r => r.review_outcome === "overridden").length,
      avgReviewTimeHours: reviewTimes.length > 0
        ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length
        : 0,
      activeMonitors: mons.filter(m => m.is_active).length,
      escalatedMonitors: mons.filter(m => m.escalated && m.is_active).length,
    };
  }

  // ─── H. REALTIME ────────────────────────────────────────────────────────

  /** Subscribe to formation flag updates (for admin dashboard) */
  static subscribeToFormationFlags(
    callback: (flag: FormationFlag) => void
  ) {
    return supabase
      .channel("conflict-formation-flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_formation_flags" },
        (payload: any) => {
          if (payload.new) callback(mapFormationFlag(payload.new));
        }
      )
      .subscribe();
  }

  /** Subscribe to monitor escalations */
  static subscribeToEscalations(
    callback: (monitor: PostFormationMonitor) => void
  ) {
    return supabase
      .channel("conflict-monitor-escalations")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "post_formation_monitor",
          filter: "escalated=eq.true",
        },
        (payload: any) => {
          if (payload.new) callback(mapMonitor(payload.new));
        }
      )
      .subscribe();
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────────────

  /** Get latest financial stress score for a member (from Feature #33) */
  private static async _getLatestStressScore(memberId: string): Promise<number | null> {
    const { data } = await supabase
      .from("member_stress_scores")
      .select("stress_score")
      .eq("member_id", memberId)
      .order("score_date", { ascending: false })
      .limit(1)
      .single();
    return data ? parseFloat(data.stress_score) : null;
  }

  /** Get latest mood drift score for a member (from Feature #31) */
  private static async _getLatestMoodScore(memberId: string): Promise<number | null> {
    const { data } = await supabase
      .from("member_mood_snapshots")
      .select("composite_mood_score")
      .eq("member_id", memberId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();
    return data ? parseFloat(data.composite_mood_score) : null;
  }

  /** Get XnScore for a member (0-100 scale) */
  private static async _getXnScore(memberId: string): Promise<number | null> {
    const { data } = await supabase
      .from("xnscores")
      .select("score")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (!data) return null;
    const raw = parseFloat(data.score);
    // Normalize to 0-100 if on legacy 0-1000 scale
    return raw > 100 ? raw / 10 : raw;
  }

  /** Get count of late payments for a member */
  private static async _getLatePaymentCount(memberId: string): Promise<number> {
    const { count, error } = await supabase
      .from("contributions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("status", "late");
    if (error) return 0;
    return count ?? 0;
  }

  /** Get average days late for a member's contributions */
  private static async _getAvgDaysLate(memberId: string): Promise<number> {
    const { data } = await supabase
      .from("cycle_contributions")
      .select("days_late")
      .eq("member_id", memberId)
      .not("days_late", "is", null)
      .gt("days_late", 0);
    if (!data || data.length === 0) return 0;
    return data.reduce((s, r) => s + (r.days_late ?? 0), 0) / data.length;
  }

  /** Get shared social connections between two members */
  private static async _getSharedConnections(idA: string, idB: string): Promise<number> {
    // Check shared circles
    const { data: circlesA } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("member_id", idA);
    const { data: circlesB } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("member_id", idB);

    const setA = new Set((circlesA ?? []).map(c => c.circle_id));
    const shared = (circlesB ?? []).filter(c => setA.has(c.circle_id)).length;

    // Also check vouching / trust graph if available
    const { count: vouchCount } = await supabase
      .from("vouches")
      .select("id", { count: "exact", head: true })
      .or(
        `and(voucher_id.eq.${idA},vouchee_id.eq.${idB}),` +
        `and(voucher_id.eq.${idB},vouchee_id.eq.${idA})`
      );

    return shared + (vouchCount ?? 0);
  }

  /** Get member profile with join date */
  private static async _getMemberProfile(memberId: string): Promise<{ daysSinceJoin: number } | null> {
    const { data } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", memberId)
      .single();
    if (!data) return null;
    const joinDate = new Date(data.created_at).getTime();
    const daysSinceJoin = (Date.now() - joinDate) / (1000 * 60 * 60 * 24);
    return { daysSinceJoin };
  }
}
