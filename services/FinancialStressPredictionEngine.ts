// ══════════════════════════════════════════════════════════════════════════════
// FinancialStressPredictionEngine — Feature #33: Financial Stress Prediction
// 4-signal behavioral scoring → weighted stress score → proactive interventions
// Signals: contribution_delay (30%), ticket_language (35%), login_drop (20%),
//          early_payout_request (15%)
// Score: 0-100 → Green (0-30) / Yellow (31-60) / Orange (61-80) / Red (81-100)
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type StressSignalType =
  | "contribution_delay"
  | "ticket_language"
  | "login_drop"
  | "early_payout_request";

export type StressStatus = "green" | "yellow" | "orange" | "red";
export type StressTrend = "improving" | "stable" | "worsening";

export type StressInterventionType =
  | "payment_restructure"
  | "counselor_referral"
  | "liquidity_advance";

export type InterventionOutcome =
  | "accepted"
  | "declined"
  | "expired"
  | "completed"
  | "pending";

export interface StressSignal {
  id: string;
  memberId: string;
  signalType: StressSignalType;
  signalValue: number;
  rawData: Record<string, any>;
  circleId: string | null;
  cycleId: string | null;
  recordedAt: string;
}

export interface StressScore {
  id: string;
  memberId: string;
  stressScore: number;
  status: StressStatus;
  signalBreakdown: SignalBreakdown;
  interventionTriggered: boolean;
  interventionType: StressInterventionType | null;
  previousScore: number | null;
  scoreDelta: number | null;
  trend: StressTrend | null;
  scoringModel: string;
  signalsCount: number;
  scoringWindowDays: number;
  scoreDate: string;
  createdAt: string;
}

export interface SignalBreakdown {
  contribution_delay: SignalComponent;
  ticket_language: SignalComponent;
  login_drop: SignalComponent;
  early_payout_request: SignalComponent;
}

export interface SignalComponent {
  raw_value: number;
  weighted_value: number;
  weight: number;
  signals_used: number;
}

export interface StressIntervention {
  id: string;
  memberId: string;
  stressScoreId: string | null;
  interventionType: StressInterventionType;
  stressScoreAtTrigger: number;
  stressStatus: StressStatus;
  messageTitle: string;
  messageBody: string;
  language: string;
  originalAmountCents: number | null;
  installmentCount: number | null;
  installmentAmounts: any[] | null;
  referralPartnerName: string | null;
  referralPartnerType: string | null;
  offeredAt: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  outcome: InterventionOutcome;
  defaultPrevented: boolean | null;
  circleId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StressKeyword {
  id: string;
  keyword: string;
  language: string;
  severityWeight: number;
  category: string;
  isActive: boolean;
}

export interface MemberStressSummary {
  memberId: string;
  currentScore: StressScore | null;
  recentSignals: StressSignal[];
  activeIntervention: StressIntervention | null;
  scoreHistory: StressScore[];
  trend: StressTrend;
  signalsLast30Days: number;
}

export interface StressDashboardRow {
  scoreDate: string;
  totalScored: number;
  greenCount: number;
  yellowCount: number;
  orangeCount: number;
  redCount: number;
  avgScore: number;
  interventionsTriggered: number;
  worseningCount: number;
  improvingCount: number;
}

export interface EligibilityForIntervention {
  eligible: boolean;
  reason?: string;
  stressScore: number;
  stressStatus: StressStatus;
  suggestedType: StressInterventionType | null;
  hasPendingIntervention: boolean;
}

export interface ContributionDelayData {
  daysLate: number;
  expectedDate: string;
  actualDate: string;
  consecutiveLateCount: number;
  frequencyOfLate: number;
}

export interface TicketLanguageData {
  ticketId: string;
  keywordsMatched: string[];
  keywordCount: number;
  urgencyLevel: "low" | "medium" | "high";
  totalSeverity: number;
}

export interface LoginDropData {
  rolling7dAvg: number;
  baseline30dAvg: number;
  dropPct: number;
  consecutiveWeeksDropped: number;
}

export interface EarlyPayoutRequestData {
  requestId: string;
  reasonCode: string;
  daysBeforePayout: number;
  requestsThisCycle: number;
}

// ─── SIGNAL WEIGHTS (v1 — manually tuned) ──────────────────────────────────

const WEIGHTS = {
  contribution_delay: 0.30,
  ticket_language: 0.35,
  login_drop: 0.20,
  early_payout_request: 0.15,
} as const;

const SCORING_WINDOW_DAYS = 30;
const SCORING_MODEL = "weighted_rule_v1";

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapSignal(row: any): StressSignal {
  return {
    id: row.id,
    memberId: row.member_id,
    signalType: row.signal_type,
    signalValue: parseFloat(row.signal_value),
    rawData: row.raw_data ?? {},
    circleId: row.circle_id,
    cycleId: row.cycle_id,
    recordedAt: row.recorded_at,
  };
}

function mapScore(row: any): StressScore {
  return {
    id: row.id,
    memberId: row.member_id,
    stressScore: parseFloat(row.stress_score),
    status: row.status,
    signalBreakdown: row.signal_breakdown ?? {},
    interventionTriggered: row.intervention_triggered,
    interventionType: row.intervention_type,
    previousScore: row.previous_score != null ? parseFloat(row.previous_score) : null,
    scoreDelta: row.score_delta != null ? parseFloat(row.score_delta) : null,
    trend: row.trend,
    scoringModel: row.scoring_model,
    signalsCount: row.signals_count,
    scoringWindowDays: row.scoring_window_days,
    scoreDate: row.score_date,
    createdAt: row.created_at,
  };
}

function mapIntervention(row: any): StressIntervention {
  return {
    id: row.id,
    memberId: row.member_id,
    stressScoreId: row.stress_score_id,
    interventionType: row.intervention_type,
    stressScoreAtTrigger: parseFloat(row.stress_score_at_trigger),
    stressStatus: row.stress_status,
    messageTitle: row.message_title,
    messageBody: row.message_body,
    language: row.language,
    originalAmountCents: row.original_amount_cents,
    installmentCount: row.installment_count,
    installmentAmounts: row.installment_amounts,
    referralPartnerName: row.referral_partner_name,
    referralPartnerType: row.referral_partner_type,
    offeredAt: row.offered_at,
    viewedAt: row.viewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    completedAt: row.completed_at,
    expiredAt: row.expired_at,
    outcome: row.outcome,
    defaultPrevented: row.default_prevented,
    circleId: row.circle_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapKeyword(row: any): StressKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    language: row.language,
    severityWeight: parseFloat(row.severity_weight),
    category: row.category,
    isActive: row.is_active,
  };
}

function mapDashboardRow(row: any): StressDashboardRow {
  return {
    scoreDate: row.score_date,
    totalScored: parseInt(row.total_scored),
    greenCount: parseInt(row.green_count),
    yellowCount: parseInt(row.yellow_count),
    orangeCount: parseInt(row.orange_count),
    redCount: parseInt(row.red_count),
    avgScore: parseFloat(row.avg_score),
    interventionsTriggered: parseInt(row.interventions_triggered),
    worseningCount: parseInt(row.worsening_count),
    improvingCount: parseInt(row.improving_count),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FinancialStressPredictionEngine
// ═══════════════════════════════════════════════════════════════════════════════

export class FinancialStressPredictionEngine {

  // ─── A. SIGNAL RECORDING ─────────────────────────────────────────────────

  /** Record a contribution delay signal */
  static async recordContributionDelay(
    memberId: string,
    data: ContributionDelayData,
    circleId?: string,
    cycleId?: string
  ): Promise<StressSignal> {
    // Normalize to 0-100: cap at 30 days late = 100
    const rawValue = Math.min(100, (data.daysLate / 30) * 100);
    // Boost for consecutive late payments
    const consecutiveBonus = Math.min(30, data.consecutiveLateCount * 10);
    const signalValue = Math.min(100, rawValue + consecutiveBonus);

    const { data: row, error } = await supabase
      .from("member_stress_signals")
      .insert({
        member_id: memberId,
        signal_type: "contribution_delay",
        signal_value: signalValue,
        raw_data: {
          days_late: data.daysLate,
          expected_date: data.expectedDate,
          actual_date: data.actualDate,
          consecutive_late_count: data.consecutiveLateCount,
          frequency_of_late: data.frequencyOfLate,
        },
        circle_id: circleId ?? null,
        cycle_id: cycleId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapSignal(row);
  }

  /** Record a support ticket language signal */
  static async recordTicketLanguage(
    memberId: string,
    data: TicketLanguageData,
    circleId?: string
  ): Promise<StressSignal> {
    // Normalize: 0 keywords = 0, 5+ keywords or high urgency = 100
    let signalValue = Math.min(100, data.totalSeverity * 20);
    if (data.urgencyLevel === "high") signalValue = Math.max(signalValue, 80);
    else if (data.urgencyLevel === "medium") signalValue = Math.max(signalValue, 50);

    const { data: row, error } = await supabase
      .from("member_stress_signals")
      .insert({
        member_id: memberId,
        signal_type: "ticket_language",
        signal_value: signalValue,
        raw_data: {
          ticket_id: data.ticketId,
          keywords_matched: data.keywordsMatched,
          keyword_count: data.keywordCount,
          urgency_level: data.urgencyLevel,
          total_severity: data.totalSeverity,
        },
        circle_id: circleId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapSignal(row);
  }

  /** Record a login frequency drop signal */
  static async recordLoginDrop(
    memberId: string,
    data: LoginDropData
  ): Promise<StressSignal> {
    // Normalize: 60%+ drop = 100, linear below that
    const signalValue = Math.min(100, (data.dropPct / 60) * 100);
    // Boost for consecutive weeks
    const weekBonus = Math.min(20, (data.consecutiveWeeksDropped - 1) * 10);
    const finalValue = Math.min(100, signalValue + Math.max(0, weekBonus));

    const { data: row, error } = await supabase
      .from("member_stress_signals")
      .insert({
        member_id: memberId,
        signal_type: "login_drop",
        signal_value: finalValue,
        raw_data: {
          rolling_7d_avg: data.rolling7dAvg,
          baseline_30d_avg: data.baseline30dAvg,
          drop_pct: data.dropPct,
          consecutive_weeks_dropped: data.consecutiveWeeksDropped,
        },
      })
      .select()
      .single();
    if (error) throw error;
    return mapSignal(row);
  }

  /** Record an early payout request signal */
  static async recordEarlyPayoutRequest(
    memberId: string,
    data: EarlyPayoutRequestData,
    circleId?: string,
    cycleId?: string
  ): Promise<StressSignal> {
    // Normalize: 1 request = 40, 2 = 70, 3+ = 100
    const baseValue = data.requestsThisCycle === 1 ? 40
      : data.requestsThisCycle === 2 ? 70 : 100;
    // Urgency boost if close to payout
    const urgencyBoost = data.daysBeforePayout < 7 ? 20 : 0;
    const signalValue = Math.min(100, baseValue + urgencyBoost);

    const { data: row, error } = await supabase
      .from("member_stress_signals")
      .insert({
        member_id: memberId,
        signal_type: "early_payout_request",
        signal_value: signalValue,
        raw_data: {
          request_id: data.requestId,
          reason_code: data.reasonCode,
          days_before_payout: data.daysBeforePayout,
          requests_this_cycle: data.requestsThisCycle,
        },
        circle_id: circleId ?? null,
        cycle_id: cycleId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapSignal(row);
  }

  // ─── B. KEYWORD ANALYSIS ─────────────────────────────────────────────────

  /** Analyze text for stress keywords, returns matched keywords + severity */
  static async analyzeText(
    text: string,
    language: string = "en"
  ): Promise<TicketLanguageData & { ticketId: ""; }> {
    const { data: keywords, error } = await supabase
      .from("stress_keywords")
      .select("*")
      .eq("language", language)
      .eq("is_active", true);
    if (error) throw error;

    const lowerText = text.toLowerCase();
    const matched: string[] = [];
    let totalSeverity = 0;

    for (const kw of (keywords ?? [])) {
      if (lowerText.includes(kw.keyword.toLowerCase())) {
        matched.push(kw.keyword);
        totalSeverity += parseFloat(kw.severity_weight);
      }
    }

    const urgencyLevel: "low" | "medium" | "high" =
      totalSeverity >= 5 ? "high" : totalSeverity >= 2.5 ? "medium" : "low";

    return {
      ticketId: "",
      keywordsMatched: matched,
      keywordCount: matched.length,
      urgencyLevel,
      totalSeverity,
    };
  }

  /** Get all active stress keywords */
  static async getKeywords(language?: string): Promise<StressKeyword[]> {
    let q = supabase
      .from("stress_keywords")
      .select("*")
      .eq("is_active", true)
      .order("severity_weight", { ascending: false });
    if (language) q = q.eq("language", language);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapKeyword);
  }

  // ─── C. SCORING ENGINE (Core) ────────────────────────────────────────────

  /** Calculate stress score for a member using last 30 days of signals */
  static async calculateStressScore(memberId: string): Promise<StressScore> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - SCORING_WINDOW_DAYS);

    // Fetch all signals in window
    const { data: signals, error: sigError } = await supabase
      .from("member_stress_signals")
      .select("*")
      .eq("member_id", memberId)
      .gte("recorded_at", windowStart.toISOString())
      .order("recorded_at", { ascending: false });
    if (sigError) throw sigError;

    const signalList = (signals ?? []).map(mapSignal);

    // Group by type and compute average value per signal type
    const grouped: Record<StressSignalType, number[]> = {
      contribution_delay: [],
      ticket_language: [],
      login_drop: [],
      early_payout_request: [],
    };

    for (const s of signalList) {
      grouped[s.signalType].push(s.signalValue);
    }

    const computeAvg = (values: number[]): number => {
      if (values.length === 0) return 0;
      // Use weighted average — more recent signals count more
      // But for v1, simple average is fine
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const breakdown: SignalBreakdown = {
      contribution_delay: {
        raw_value: computeAvg(grouped.contribution_delay),
        weighted_value: computeAvg(grouped.contribution_delay) * WEIGHTS.contribution_delay,
        weight: WEIGHTS.contribution_delay,
        signals_used: grouped.contribution_delay.length,
      },
      ticket_language: {
        raw_value: computeAvg(grouped.ticket_language),
        weighted_value: computeAvg(grouped.ticket_language) * WEIGHTS.ticket_language,
        weight: WEIGHTS.ticket_language,
        signals_used: grouped.ticket_language.length,
      },
      login_drop: {
        raw_value: computeAvg(grouped.login_drop),
        weighted_value: computeAvg(grouped.login_drop) * WEIGHTS.login_drop,
        weight: WEIGHTS.login_drop,
        signals_used: grouped.login_drop.length,
      },
      early_payout_request: {
        raw_value: computeAvg(grouped.early_payout_request),
        weighted_value: computeAvg(grouped.early_payout_request) * WEIGHTS.early_payout_request,
        weight: WEIGHTS.early_payout_request,
        signals_used: grouped.early_payout_request.length,
      },
    };

    // Composite score (0-100)
    const stressScore = Math.min(100, Math.max(0,
      breakdown.contribution_delay.weighted_value +
      breakdown.ticket_language.weighted_value +
      breakdown.login_drop.weighted_value +
      breakdown.early_payout_request.weighted_value
    ));

    // Get previous score for trend
    const { data: prevRows } = await supabase
      .from("member_stress_scores")
      .select("stress_score")
      .eq("member_id", memberId)
      .order("score_date", { ascending: false })
      .limit(1);

    const previousScore = prevRows?.[0]
      ? parseFloat(prevRows[0].stress_score)
      : null;

    const trend: StressTrend | null = previousScore != null
      ? (stressScore - previousScore > 5 ? "worsening"
        : stressScore - previousScore < -5 ? "improving"
        : "stable")
      : null;

    // Insert score
    const { data: row, error } = await supabase
      .from("member_stress_scores")
      .insert({
        member_id: memberId,
        stress_score: stressScore,
        signal_breakdown: breakdown,
        previous_score: previousScore,
        trend,
        scoring_model: SCORING_MODEL,
        signals_count: signalList.length,
        scoring_window_days: SCORING_WINDOW_DAYS,
      })
      .select()
      .single();
    if (error) throw error;
    return mapScore(row);
  }

  /** Batch-score all active members (called by cron every 6 hours) */
  static async runScoringBatch(): Promise<{
    scored: number;
    interventionsTriggered: number;
    errors: string[];
  }> {
    // Get all members who have signals in the last 30 days
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - SCORING_WINDOW_DAYS);

    const { data: memberIds, error } = await supabase
      .from("member_stress_signals")
      .select("member_id")
      .gte("recorded_at", windowStart.toISOString());
    if (error) throw error;

    const uniqueIds = [...new Set((memberIds ?? []).map(r => r.member_id))];
    let scored = 0;
    let interventionsTriggered = 0;
    const errors: string[] = [];

    for (const memberId of uniqueIds) {
      try {
        const score = await this.calculateStressScore(memberId);
        scored++;

        // If intervention triggered and score > 60, create intervention offer
        if (score.interventionTriggered && score.stressScore > 60) {
          const eligibility = await this.checkInterventionEligibility(memberId);
          if (eligibility.eligible && eligibility.suggestedType) {
            await this.createIntervention(
              memberId,
              score,
              eligibility.suggestedType
            );
            interventionsTriggered++;
          }
        }
      } catch (err: any) {
        errors.push(`Member ${memberId}: ${err.message}`);
      }
    }

    return { scored, interventionsTriggered, errors };
  }

  // ─── D. INTERVENTION MANAGEMENT ──────────────────────────────────────────

  /** Check if a member is eligible for a stress intervention */
  static async checkInterventionEligibility(
    memberId: string
  ): Promise<EligibilityForIntervention> {
    // Get latest score
    const { data: latestScore } = await supabase
      .from("member_stress_scores")
      .select("*")
      .eq("member_id", memberId)
      .order("score_date", { ascending: false })
      .limit(1)
      .single();

    if (!latestScore) {
      return {
        eligible: false,
        reason: "No stress score computed yet",
        stressScore: 0,
        stressStatus: "green",
        suggestedType: null,
        hasPendingIntervention: false,
      };
    }

    const score = parseFloat(latestScore.stress_score);
    const status = latestScore.status as StressStatus;

    // Check for pending interventions
    const { data: pending } = await supabase
      .from("stress_interventions")
      .select("id")
      .eq("member_id", memberId)
      .eq("outcome", "pending")
      .limit(1);

    const hasPending = (pending?.length ?? 0) > 0;

    if (score <= 60) {
      return {
        eligible: false,
        reason: "Stress score below intervention threshold (60)",
        stressScore: score,
        stressStatus: status,
        suggestedType: null,
        hasPendingIntervention: hasPending,
      };
    }

    if (hasPending) {
      return {
        eligible: false,
        reason: "Member already has a pending intervention",
        stressScore: score,
        stressStatus: status,
        suggestedType: score <= 80 ? "payment_restructure" : "counselor_referral",
        hasPendingIntervention: true,
      };
    }

    return {
      eligible: true,
      stressScore: score,
      stressStatus: status,
      suggestedType: score <= 80 ? "payment_restructure" : "counselor_referral",
      hasPendingIntervention: false,
    };
  }

  /** Create an intervention offer for a member */
  static async createIntervention(
    memberId: string,
    score: StressScore,
    type: StressInterventionType,
    options?: {
      language?: string;
      originalAmountCents?: number;
      installmentCount?: number;
      referralPartnerName?: string;
      referralPartnerType?: string;
      circleId?: string;
    }
  ): Promise<StressIntervention> {
    const lang = options?.language ?? "en";

    // Generate message based on type
    const { title, body } = this._generateInterventionMessage(
      type, lang, options?.originalAmountCents
    );

    // Build installment schedule if payment restructure
    let installmentAmounts: any[] | null = null;
    if (type === "payment_restructure" && options?.originalAmountCents) {
      const count = options.installmentCount ?? 2;
      const perInstallment = Math.ceil(options.originalAmountCents / count);
      installmentAmounts = Array.from({ length: count }, (_, i) => ({
        amount_cents: i < count - 1 ? perInstallment
          : options.originalAmountCents! - (perInstallment * (count - 1)),
        due_date: new Date(
          Date.now() + (i + 1) * 14 * 24 * 60 * 60 * 1000 // every 2 weeks
        ).toISOString().split("T")[0],
      }));
    }

    const { data: row, error } = await supabase
      .from("stress_interventions")
      .insert({
        member_id: memberId,
        stress_score_id: score.id,
        intervention_type: type,
        stress_score_at_trigger: score.stressScore,
        stress_status: score.status,
        message_title: title,
        message_body: body,
        language: lang,
        original_amount_cents: options?.originalAmountCents ?? null,
        installment_count: options?.installmentCount ?? (type === "payment_restructure" ? 2 : null),
        installment_amounts: installmentAmounts,
        referral_partner_name: options?.referralPartnerName ?? null,
        referral_partner_type: options?.referralPartnerType ?? null,
        circle_id: options?.circleId ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(row);
  }

  /** Member views the intervention */
  static async markViewed(interventionId: string): Promise<StressIntervention> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Member accepts the intervention */
  static async acceptIntervention(interventionId: string): Promise<StressIntervention> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Member declines the intervention */
  static async declineIntervention(interventionId: string): Promise<StressIntervention> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .update({ declined_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Mark intervention as completed (outcome tracked) */
  static async completeIntervention(interventionId: string): Promise<StressIntervention> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Expire stale interventions (not responded within 7 days) */
  static async expireStaleInterventions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const { data, error } = await supabase
      .from("stress_interventions")
      .update({ expired_at: new Date().toISOString() })
      .eq("outcome", "pending")
      .lt("offered_at", cutoff.toISOString())
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }

  // ─── E. QUERIES ──────────────────────────────────────────────────────────

  /** Get the latest stress score for a member */
  static async getLatestScore(memberId: string): Promise<StressScore | null> {
    const { data, error } = await supabase
      .from("member_stress_scores")
      .select("*")
      .eq("member_id", memberId)
      .order("score_date", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapScore(data) : null;
  }

  /** Get score history for a member */
  static async getScoreHistory(
    memberId: string,
    limit: number = 30
  ): Promise<StressScore[]> {
    const { data, error } = await supabase
      .from("member_stress_scores")
      .select("*")
      .eq("member_id", memberId)
      .order("score_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapScore);
  }

  /** Get recent signals for a member */
  static async getRecentSignals(
    memberId: string,
    limit: number = 50
  ): Promise<StressSignal[]> {
    const { data, error } = await supabase
      .from("member_stress_signals")
      .select("*")
      .eq("member_id", memberId)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapSignal);
  }

  /** Get signals by type for a member */
  static async getSignalsByType(
    memberId: string,
    signalType: StressSignalType,
    limit: number = 20
  ): Promise<StressSignal[]> {
    const { data, error } = await supabase
      .from("member_stress_signals")
      .select("*")
      .eq("member_id", memberId)
      .eq("signal_type", signalType)
      .order("recorded_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapSignal);
  }

  /** Get active (pending) intervention for a member */
  static async getActiveIntervention(
    memberId: string
  ): Promise<StressIntervention | null> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .select("*")
      .eq("member_id", memberId)
      .eq("outcome", "pending")
      .order("offered_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapIntervention(data) : null;
  }

  /** Get all interventions for a member */
  static async getMemberInterventions(
    memberId: string,
    limit: number = 20
  ): Promise<StressIntervention[]> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .select("*")
      .eq("member_id", memberId)
      .order("offered_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapIntervention);
  }

  /** Get full member stress summary */
  static async getMemberSummary(memberId: string): Promise<MemberStressSummary> {
    const [currentScore, recentSignals, activeIntervention, scoreHistory] =
      await Promise.all([
        this.getLatestScore(memberId),
        this.getRecentSignals(memberId, 20),
        this.getActiveIntervention(memberId),
        this.getScoreHistory(memberId, 10),
      ]);

    return {
      memberId,
      currentScore,
      recentSignals,
      activeIntervention,
      scoreHistory,
      trend: currentScore?.trend ?? "stable",
      signalsLast30Days: recentSignals.length,
    };
  }

  // ─── F. ADMIN / DASHBOARD ────────────────────────────────────────────────

  /** Get stress prediction dashboard data */
  static async getDashboard(days: number = 30): Promise<StressDashboardRow[]> {
    const { data, error } = await supabase
      .from("stress_prediction_dashboard")
      .select("*")
      .limit(days);
    if (error) throw error;
    return (data ?? []).map(mapDashboardRow);
  }

  /** Get all members currently in Orange or Red status */
  static async getFlaggedMembers(): Promise<StressScore[]> {
    const { data, error } = await supabase
      .from("member_stress_scores")
      .select("*")
      .in("status", ["orange", "red"])
      .eq("score_date", new Date().toISOString().split("T")[0])
      .order("stress_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapScore);
  }

  /** Get intervention effectiveness metrics */
  static async getInterventionMetrics(): Promise<{
    totalOffered: number;
    accepted: number;
    declined: number;
    expired: number;
    completed: number;
    acceptanceRate: number;
    completionRate: number;
    defaultsPrevented: number;
    byType: Record<string, { offered: number; accepted: number; completed: number }>;
  }> {
    const { data, error } = await supabase
      .from("stress_interventions")
      .select("intervention_type, outcome, default_prevented");
    if (error) throw error;

    const rows = data ?? [];
    const totalOffered = rows.length;
    const accepted = rows.filter(r => r.outcome === "accepted" || r.outcome === "completed").length;
    const declined = rows.filter(r => r.outcome === "declined").length;
    const expired = rows.filter(r => r.outcome === "expired").length;
    const completed = rows.filter(r => r.outcome === "completed").length;
    const defaultsPrevented = rows.filter(r => r.default_prevented === true).length;

    const byType: Record<string, { offered: number; accepted: number; completed: number }> = {};
    for (const r of rows) {
      const t = r.intervention_type;
      if (!byType[t]) byType[t] = { offered: 0, accepted: 0, completed: 0 };
      byType[t].offered++;
      if (r.outcome === "accepted" || r.outcome === "completed") byType[t].accepted++;
      if (r.outcome === "completed") byType[t].completed++;
    }

    return {
      totalOffered,
      accepted,
      declined,
      expired,
      completed,
      acceptanceRate: totalOffered > 0 ? (accepted / totalOffered) * 100 : 0,
      completionRate: totalOffered > 0 ? (completed / totalOffered) * 100 : 0,
      defaultsPrevented,
      byType,
    };
  }

  // ─── G. REALTIME ─────────────────────────────────────────────────────────

  /** Subscribe to intervention updates for a member */
  static subscribeToInterventions(
    memberId: string,
    callback: (intervention: StressIntervention) => void
  ) {
    return supabase
      .channel(`stress-interventions-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stress_interventions",
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          if (payload.new) callback(mapIntervention(payload.new));
        }
      )
      .subscribe();
  }

  /** Subscribe to score updates for a member */
  static subscribeToScores(
    memberId: string,
    callback: (score: StressScore) => void
  ) {
    return supabase
      .channel(`stress-scores-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "member_stress_scores",
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          if (payload.new) callback(mapScore(payload.new));
        }
      )
      .subscribe();
  }

  // ─── H. PRIVATE HELPERS ──────────────────────────────────────────────────

  /** Generate intervention message based on type and language */
  private static _generateInterventionMessage(
    type: StressInterventionType,
    language: string,
    amountCents?: number
  ): { title: string; body: string } {
    const amount = amountCents
      ? `$${(amountCents / 100).toFixed(0)}`
      : "your contribution";

    const messages: Record<string, Record<string, { title: string; body: string }>> = {
      payment_restructure: {
        en: {
          title: "We're here to help",
          body: `We noticed things might be tight this month. We can split ${amount} into two payments. No penalty, no judgment. Just let us know.`,
        },
        fr: {
          title: "Nous sommes là pour vous",
          body: `Nous avons remarqué que ce mois-ci pourrait être serré. Nous pouvons diviser ${amount} en deux paiements. Pas de pénalité. Dites-le nous.`,
        },
      },
      counselor_referral: {
        en: {
          title: "Free financial support available",
          body: "We've partnered with certified financial counselors who can help — completely free and confidential. Would you like a referral?",
        },
        fr: {
          title: "Soutien financier gratuit disponible",
          body: "Nous travaillons avec des conseillers financiers certifiés qui peuvent vous aider — gratuitement et en toute confidentialité. Souhaitez-vous une recommandation?",
        },
      },
      liquidity_advance: {
        en: {
          title: "Advance on your payout",
          body: `You may be eligible for an advance of up to $500 against your expected circle payout. Repaid automatically when your payout arrives.`,
        },
        fr: {
          title: "Avance sur votre paiement",
          body: `Vous pourriez être éligible pour une avance allant jusqu'à 500$ sur votre paiement de cercle attendu. Remboursée automatiquement à la réception de votre paiement.`,
        },
      },
    };

    const langMessages = messages[type]?.[language] ?? messages[type]?.["en"];
    return langMessages ?? { title: "Support available", body: "We're here to help." };
  }
}
