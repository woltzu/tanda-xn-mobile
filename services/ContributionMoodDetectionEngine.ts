// ══════════════════════════════════════════════════════════════════════════════
// ContributionMoodDetectionEngine — Feature #31: Contribution Mood Detection
// 5-signal NLP drift scoring → personal baselines → proactive interventions
// Signals: sentiment_polarity (35%), lexical_richness (25%), keyword_trigger (15%),
//          response_latency (15%), message_length (10%)
// MoodDriftScore 0-100: Stable (0-30) / Drifting (31-55) / Disengaging (56-75) /
// At Risk (76-100)
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type MessageChannel =
  | "support_ticket"
  | "circle_chat"
  | "direct_message"
  | "community_post"
  | "contribution_note";

export type MoodTier = "stable" | "drifting" | "disengaging" | "at_risk";
export type MoodTrend = "improving" | "stable" | "worsening";

export type MoodInterventionType =
  | "warm_checkin"
  | "contribution_pause"
  | "amount_reduction"
  | "human_outreach"
  | "counselor_referral";

export type MoodInterventionChannel =
  | "in_app" | "push" | "sms" | "direct_message" | "email";

export type MoodInterventionOutcome =
  | "pending" | "pending_review" | "sent" | "viewed"
  | "accepted" | "declined" | "expired" | "completed";

export interface MemberMessage {
  id: string;
  memberId: string;
  messageText: string;
  messageLength: number;
  channel: MessageChannel;
  circleId: string | null;
  threadId: string | null;
  replyToId: string | null;
  language: string;
  polarityScore: number | null;
  subjectivity: number | null;
  lexicalDiversity: number | null;
  keywordFlags: string[];
  responseLatencyHours: number | null;
  excludedFromAnalysis: boolean;
  sentAt: string;
  analyzedAt: string | null;
}

export interface MoodBaseline {
  id: string;
  memberId: string;
  baselinePolarity: number;
  baselineLexical: number;
  baselineLatency: number;
  baselineLength: number;
  messagesAnalyzed: number;
  windowStart: string;
  windowEnd: string;
  isEstablished: boolean;
  computedAt: string;
}

export interface MoodSnapshot {
  id: string;
  memberId: string;
  polarityScore: number;
  lexicalScore: number;
  latencyScore: number;
  keywordScore: number;
  lengthScore: number;
  compositeMoodScore: number;
  tier: MoodTier;
  signalBreakdown: MoodSignalBreakdown;
  previousScore: number | null;
  scoreDelta: number | null;
  trend: MoodTrend | null;
  interventionTriggered: boolean;
  interventionType: MoodInterventionType | null;
  messagesInWindow: number;
  scoringModel: string;
  snapshotDate: string;
  createdAt: string;
}

export interface MoodSignalBreakdown {
  polarity: { raw: number; baseline: number; delta_pct: number; normalized: number; weight: number };
  lexical: { raw: number; baseline: number; delta_pct: number; normalized: number; weight: number };
  keyword: { flags_count: number; severity: number; normalized: number; weight: number };
  latency: { raw_hours: number; baseline_hours: number; increase_factor: number; normalized: number; weight: number };
  length: { raw_words: number; baseline_words: number; contraction_pct: number; normalized: number; weight: number };
}

export interface MoodIntervention {
  id: string;
  memberId: string;
  moodSnapshotId: string | null;
  interventionType: MoodInterventionType;
  tierAtTrigger: MoodTier;
  moodScoreAtTrigger: number;
  channel: MoodInterventionChannel;
  messageTitle: string;
  messageBody: string;
  language: string;
  circleId: string | null;
  currentAmountCents: number | null;
  proposedAmountCents: number | null;
  pauseDurationWeeks: number | null;
  requiresReview: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  triggeredAt: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  outcome: MoodInterventionOutcome;
  defaultPrevented: boolean | null;
  memberReEngaged: boolean | null;
  followUpScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MoodKeyword {
  id: string;
  keyword: string;
  language: string;
  severityWeight: number;
  category: string;
  isActive: boolean;
}

export interface MoodPreference {
  id: string;
  memberId: string;
  optedOut: boolean;
  optedOutAt: string | null;
  preferredLanguage: string;
}

export interface MoodDashboardRow {
  snapshotDate: string;
  totalScored: number;
  stableCount: number;
  driftingCount: number;
  disengagingCount: number;
  atRiskCount: number;
  avgScore: number;
  interventionsTriggered: number;
  worseningCount: number;
  improvingCount: number;
}

export interface MemberMoodSummary {
  memberId: string;
  currentSnapshot: MoodSnapshot | null;
  baseline: MoodBaseline | null;
  activeIntervention: MoodIntervention | null;
  snapshotHistory: MoodSnapshot[];
  recentMessages: MemberMessage[];
  tier: MoodTier;
  trend: MoodTrend;
  isOptedOut: boolean;
}

// ─── SIGNAL WEIGHTS (v1) ───────────────────────────────────────────────────

const WEIGHTS = {
  polarity: 0.35,
  lexical: 0.25,
  keyword: 0.15,
  latency: 0.15,
  length: 0.10,
} as const;

const BASELINE_WINDOW_DAYS = 90;
const SCORING_WINDOW_DAYS = 14;  // 2 weeks of recent messages vs baseline
const MIN_MESSAGES_FOR_BASELINE = 5;
const SCORING_MODEL = "vader_textblob_v1";

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapMessage(row: any): MemberMessage {
  return {
    id: row.id,
    memberId: row.member_id,
    messageText: row.message_text,
    messageLength: row.message_length ?? 0,
    channel: row.channel,
    circleId: row.circle_id,
    threadId: row.thread_id,
    replyToId: row.reply_to_id,
    language: row.language ?? "en",
    polarityScore: row.polarity_score != null ? parseFloat(row.polarity_score) : null,
    subjectivity: row.subjectivity != null ? parseFloat(row.subjectivity) : null,
    lexicalDiversity: row.lexical_diversity != null ? parseFloat(row.lexical_diversity) : null,
    keywordFlags: row.keyword_flags ?? [],
    responseLatencyHours: row.response_latency_hours != null ? parseFloat(row.response_latency_hours) : null,
    excludedFromAnalysis: row.excluded_from_analysis ?? false,
    sentAt: row.sent_at,
    analyzedAt: row.analyzed_at,
  };
}

function mapBaseline(row: any): MoodBaseline {
  return {
    id: row.id,
    memberId: row.member_id,
    baselinePolarity: parseFloat(row.baseline_polarity),
    baselineLexical: parseFloat(row.baseline_lexical),
    baselineLatency: parseFloat(row.baseline_latency),
    baselineLength: parseFloat(row.baseline_length),
    messagesAnalyzed: row.messages_analyzed,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    isEstablished: row.is_established,
    computedAt: row.computed_at,
  };
}

function mapSnapshot(row: any): MoodSnapshot {
  return {
    id: row.id,
    memberId: row.member_id,
    polarityScore: parseFloat(row.polarity_score),
    lexicalScore: parseFloat(row.lexical_score),
    latencyScore: parseFloat(row.latency_score),
    keywordScore: parseFloat(row.keyword_score),
    lengthScore: parseFloat(row.length_score),
    compositeMoodScore: parseFloat(row.composite_mood_score),
    tier: row.tier,
    signalBreakdown: row.signal_breakdown ?? {},
    previousScore: row.previous_score != null ? parseFloat(row.previous_score) : null,
    scoreDelta: row.score_delta != null ? parseFloat(row.score_delta) : null,
    trend: row.trend,
    interventionTriggered: row.intervention_triggered,
    interventionType: row.intervention_type,
    messagesInWindow: row.messages_in_window,
    scoringModel: row.scoring_model,
    snapshotDate: row.snapshot_date,
    createdAt: row.created_at,
  };
}

function mapIntervention(row: any): MoodIntervention {
  return {
    id: row.id,
    memberId: row.member_id,
    moodSnapshotId: row.mood_snapshot_id,
    interventionType: row.intervention_type,
    tierAtTrigger: row.tier_at_trigger,
    moodScoreAtTrigger: parseFloat(row.mood_score_at_trigger),
    channel: row.channel,
    messageTitle: row.message_title,
    messageBody: row.message_body,
    language: row.language,
    circleId: row.circle_id,
    currentAmountCents: row.current_amount_cents,
    proposedAmountCents: row.proposed_amount_cents,
    pauseDurationWeeks: row.pause_duration_weeks,
    requiresReview: row.requires_review,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNotes: row.review_notes,
    triggeredAt: row.triggered_at,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    completedAt: row.completed_at,
    expiredAt: row.expired_at,
    outcome: row.outcome,
    defaultPrevented: row.default_prevented,
    memberReEngaged: row.member_re_engaged,
    followUpScore: row.follow_up_score != null ? parseFloat(row.follow_up_score) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapKeyword(row: any): MoodKeyword {
  return {
    id: row.id,
    keyword: row.keyword,
    language: row.language,
    severityWeight: parseFloat(row.severity_weight),
    category: row.category,
    isActive: row.is_active,
  };
}

function mapDashboardRow(row: any): MoodDashboardRow {
  return {
    snapshotDate: row.snapshot_date,
    totalScored: parseInt(row.total_scored),
    stableCount: parseInt(row.stable_count),
    driftingCount: parseInt(row.drifting_count),
    disengagingCount: parseInt(row.disengaging_count),
    atRiskCount: parseInt(row.at_risk_count),
    avgScore: parseFloat(row.avg_score),
    interventionsTriggered: parseInt(row.interventions_triggered),
    worseningCount: parseInt(row.worsening_count),
    improvingCount: parseInt(row.improving_count),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ContributionMoodDetectionEngine
// ═══════════════════════════════════════════════════════════════════════════════

export class ContributionMoodDetectionEngine {

  // ─── A. MESSAGE LOGGING ──────────────────────────────────────────────────

  /** Log a member message for mood analysis */
  static async logMessage(
    memberId: string,
    messageText: string,
    channel: MessageChannel,
    options?: {
      circleId?: string;
      threadId?: string;
      replyToId?: string;
      language?: string;
      sentAt?: string;
    }
  ): Promise<MemberMessage> {
    // Check opt-out
    const optedOut = await this._isOptedOut(memberId);

    // Calculate response latency if reply
    let responseLatencyHours: number | null = null;
    if (options?.replyToId) {
      const { data: parent } = await supabase
        .from("member_messages")
        .select("sent_at")
        .eq("id", options.replyToId)
        .single();
      if (parent) {
        const parentTime = new Date(parent.sent_at).getTime();
        const replyTime = new Date(options?.sentAt ?? Date.now()).getTime();
        responseLatencyHours = Math.max(0, (replyTime - parentTime) / (1000 * 60 * 60));
      }
    }

    const { data: row, error } = await supabase
      .from("member_messages")
      .insert({
        member_id: memberId,
        message_text: messageText,
        channel,
        circle_id: options?.circleId ?? null,
        thread_id: options?.threadId ?? null,
        reply_to_id: options?.replyToId ?? null,
        language: options?.language ?? "en",
        response_latency_hours: responseLatencyHours,
        excluded_from_analysis: optedOut,
        sent_at: options?.sentAt ?? new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return mapMessage(row);
  }

  // ─── B. NLP ANALYSIS (Per-Message) ───────────────────────────────────────

  /**
   * Analyze a message's sentiment using rule-based approach (VADER-like).
   * In Phase 2, this would call an external NLP API.
   * Returns polarity (-1 to +1), subjectivity (0-1), lexical diversity (0-1).
   */
  static async analyzeMessage(messageId: string): Promise<MemberMessage> {
    const { data: msg, error: fetchErr } = await supabase
      .from("member_messages")
      .select("*")
      .eq("id", messageId)
      .single();
    if (fetchErr) throw fetchErr;
    if (msg.excluded_from_analysis) return mapMessage(msg);

    const text = msg.message_text ?? "";
    const lang = msg.language ?? "en";

    // 1. Polarity: simple rule-based (-1 to +1)
    const polarity = this._computePolarity(text, lang);

    // 2. Subjectivity: ratio of opinion-bearing words
    const subjectivity = this._computeSubjectivity(text);

    // 3. Lexical diversity: type-token ratio (unique words / total words)
    const lexicalDiversity = this._computeLexicalDiversity(text);

    // 4. Keyword flags
    const keywordFlags = await this._detectKeywords(text, lang);

    const { data: updated, error: upErr } = await supabase
      .from("member_messages")
      .update({
        polarity_score: polarity,
        subjectivity,
        lexical_diversity: lexicalDiversity,
        keyword_flags: keywordFlags,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", messageId)
      .select()
      .single();
    if (upErr) throw upErr;
    return mapMessage(updated);
  }

  /** Batch-analyze all unanalyzed messages */
  static async analyzeUnprocessedMessages(limit: number = 200): Promise<number> {
    const { data: msgs, error } = await supabase
      .from("member_messages")
      .select("id")
      .is("analyzed_at", null)
      .eq("excluded_from_analysis", false)
      .order("sent_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    let count = 0;
    for (const msg of (msgs ?? [])) {
      try {
        await this.analyzeMessage(msg.id);
        count++;
      } catch (err) {
        console.error(`Failed to analyze message ${msg.id}:`, err);
      }
    }
    return count;
  }

  // ─── C. BASELINE COMPUTATION ─────────────────────────────────────────────

  /** Compute or recompute the 90-day mood baseline for a member */
  static async computeBaseline(memberId: string): Promise<MoodBaseline> {
    const windowEnd = new Date();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - BASELINE_WINDOW_DAYS);

    // Fetch analyzed messages in the window
    const { data: msgs, error } = await supabase
      .from("member_messages")
      .select("polarity_score, lexical_diversity, response_latency_hours, message_length")
      .eq("member_id", memberId)
      .eq("excluded_from_analysis", false)
      .not("analyzed_at", "is", null)
      .gte("sent_at", windowStart.toISOString())
      .lte("sent_at", windowEnd.toISOString());
    if (error) throw error;

    const messages = msgs ?? [];
    const isEstablished = messages.length >= MIN_MESSAGES_FOR_BASELINE;

    // Compute averages
    const avgPolarity = messages.length > 0
      ? messages.reduce((s, m) => s + (parseFloat(m.polarity_score) || 0), 0) / messages.length
      : 0;
    const avgLexical = messages.length > 0
      ? messages.reduce((s, m) => s + (parseFloat(m.lexical_diversity) || 0), 0) / messages.length
      : 0;
    const latencyMsgs = messages.filter(m => m.response_latency_hours != null);
    const avgLatency = latencyMsgs.length > 0
      ? latencyMsgs.reduce((s, m) => s + parseFloat(m.response_latency_hours!), 0) / latencyMsgs.length
      : 0;
    const avgLength = messages.length > 0
      ? messages.reduce((s, m) => s + (m.message_length || 0), 0) / messages.length
      : 0;

    const { data: row, error: insErr } = await supabase
      .from("member_mood_baselines")
      .insert({
        member_id: memberId,
        baseline_polarity: avgPolarity,
        baseline_lexical: avgLexical,
        baseline_latency: avgLatency,
        baseline_length: avgLength,
        messages_analyzed: messages.length,
        window_start: windowStart.toISOString().split("T")[0],
        window_end: windowEnd.toISOString().split("T")[0],
        is_established: isEstablished,
      })
      .select()
      .single();
    if (insErr) throw insErr;
    return mapBaseline(row);
  }

  /** Get the latest established baseline for a member */
  static async getBaseline(memberId: string): Promise<MoodBaseline | null> {
    const { data, error } = await supabase
      .from("member_mood_baselines")
      .select("*")
      .eq("member_id", memberId)
      .eq("is_established", true)
      .order("computed_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapBaseline(data) : null;
  }

  // ─── D. MOOD DRIFT SCORING (Core) ───────────────────────────────────────

  /**
   * Calculate the MoodDriftScore for a member.
   * Compares recent 2-week message patterns against 90-day baseline.
   */
  static async calculateMoodScore(memberId: string): Promise<MoodSnapshot | null> {
    // Get baseline
    const baseline = await this.getBaseline(memberId);
    if (!baseline) return null; // No established baseline yet

    // Get recent 2-week messages
    const recentStart = new Date();
    recentStart.setDate(recentStart.getDate() - SCORING_WINDOW_DAYS);

    const { data: recentMsgs, error } = await supabase
      .from("member_messages")
      .select("polarity_score, lexical_diversity, response_latency_hours, message_length, keyword_flags")
      .eq("member_id", memberId)
      .eq("excluded_from_analysis", false)
      .not("analyzed_at", "is", null)
      .gte("sent_at", recentStart.toISOString());
    if (error) throw error;

    const msgs = recentMsgs ?? [];
    if (msgs.length === 0) return null; // No recent messages to score

    // ── Signal 1: Polarity Shift (35%) ──
    const recentPolarity = msgs.reduce((s, m) => s + (parseFloat(m.polarity_score) || 0), 0) / msgs.length;
    const polarityDelta = baseline.baselinePolarity - recentPolarity; // positive = drift down
    const polarityDeltaPct = baseline.baselinePolarity !== 0
      ? (polarityDelta / Math.abs(baseline.baselinePolarity)) * 100
      : polarityDelta * 100;
    // Normalize: full swing from +1 baseline to -1 current = 100
    const polarityNorm = Math.min(100, Math.max(0, polarityDeltaPct));

    // ── Signal 2: Lexical Richness Drop (25%) ──
    const recentLexical = msgs.reduce((s, m) => s + (parseFloat(m.lexical_diversity) || 0), 0) / msgs.length;
    const lexicalDrop = baseline.baselineLexical > 0
      ? ((baseline.baselineLexical - recentLexical) / baseline.baselineLexical) * 100
      : 0;
    // Normalize: 40%+ drop = 100 (per spec)
    const lexicalNorm = Math.min(100, Math.max(0, (lexicalDrop / 40) * 100));

    // ── Signal 3: Keyword Triggers (15%) ──
    let totalKeywordSeverity = 0;
    let keywordFlagsCount = 0;
    for (const m of msgs) {
      const flags = m.keyword_flags ?? [];
      keywordFlagsCount += flags.length;
      totalKeywordSeverity += flags.length * 1.2; // average severity per flag
    }
    // Normalize: 5+ keyword matches in 2 weeks = 100
    const keywordNorm = Math.min(100, (totalKeywordSeverity / 6) * 100);

    // ── Signal 4: Response Latency Increase (15%) ──
    const latencyMsgs = msgs.filter(m => m.response_latency_hours != null);
    const recentLatency = latencyMsgs.length > 0
      ? latencyMsgs.reduce((s, m) => s + parseFloat(m.response_latency_hours!), 0) / latencyMsgs.length
      : 0;
    const latencyFactor = baseline.baselineLatency > 0
      ? recentLatency / baseline.baselineLatency
      : 1;
    // Normalize: 3× increase = 100 (per spec)
    const latencyNorm = Math.min(100, Math.max(0, ((latencyFactor - 1) / 2) * 100));

    // ── Signal 5: Message Length Contraction (10%) ──
    const recentLength = msgs.reduce((s, m) => s + (m.message_length || 0), 0) / msgs.length;
    const contractionPct = baseline.baselineLength > 0
      ? ((baseline.baselineLength - recentLength) / baseline.baselineLength) * 100
      : 0;
    // Normalize: 50%+ contraction = 100 (per spec)
    const lengthNorm = Math.min(100, Math.max(0, (contractionPct / 50) * 100));

    // ── Composite Score ──
    const compositeMoodScore = Math.min(100, Math.max(0,
      polarityNorm * WEIGHTS.polarity +
      lexicalNorm * WEIGHTS.lexical +
      keywordNorm * WEIGHTS.keyword +
      latencyNorm * WEIGHTS.latency +
      lengthNorm * WEIGHTS.length
    ));

    // Build signal breakdown
    const signalBreakdown: MoodSignalBreakdown = {
      polarity: {
        raw: recentPolarity, baseline: baseline.baselinePolarity,
        delta_pct: polarityDeltaPct, normalized: polarityNorm, weight: WEIGHTS.polarity,
      },
      lexical: {
        raw: recentLexical, baseline: baseline.baselineLexical,
        delta_pct: lexicalDrop, normalized: lexicalNorm, weight: WEIGHTS.lexical,
      },
      keyword: {
        flags_count: keywordFlagsCount, severity: totalKeywordSeverity,
        normalized: keywordNorm, weight: WEIGHTS.keyword,
      },
      latency: {
        raw_hours: recentLatency, baseline_hours: baseline.baselineLatency,
        increase_factor: latencyFactor, normalized: latencyNorm, weight: WEIGHTS.latency,
      },
      length: {
        raw_words: recentLength, baseline_words: baseline.baselineLength,
        contraction_pct: contractionPct, normalized: lengthNorm, weight: WEIGHTS.length,
      },
    };

    // Get previous score for trend
    const { data: prevRows } = await supabase
      .from("member_mood_snapshots")
      .select("composite_mood_score")
      .eq("member_id", memberId)
      .order("snapshot_date", { ascending: false })
      .limit(1);

    const previousScore = prevRows?.[0]
      ? parseFloat(prevRows[0].composite_mood_score)
      : null;

    const trend: MoodTrend | null = previousScore != null
      ? (compositeMoodScore - previousScore > 5 ? "worsening"
        : compositeMoodScore - previousScore < -5 ? "improving"
        : "stable")
      : null;

    // Insert snapshot (trigger auto-computes tier)
    const { data: row, error: insErr } = await supabase
      .from("member_mood_snapshots")
      .insert({
        member_id: memberId,
        polarity_score: polarityNorm,
        lexical_score: lexicalNorm,
        latency_score: latencyNorm,
        keyword_score: keywordNorm,
        length_score: lengthNorm,
        composite_mood_score: compositeMoodScore,
        signal_breakdown: signalBreakdown,
        previous_score: previousScore,
        trend,
        messages_in_window: msgs.length,
        scoring_model: SCORING_MODEL,
      })
      .select()
      .single();
    if (insErr) throw insErr;
    return mapSnapshot(row);
  }

  /** Batch scoring job — called weekly by cron */
  static async runWeeklyScoringBatch(): Promise<{
    scored: number;
    interventionsCreated: number;
    baselineRecomputed: number;
    errors: string[];
  }> {
    // 1. Analyze any unprocessed messages first
    await this.analyzeUnprocessedMessages(500);

    // 2. Get members with established baselines who are not opted out
    const { data: baselines, error: bErr } = await supabase
      .from("member_mood_baselines")
      .select("member_id")
      .eq("is_established", true);
    if (bErr) throw bErr;

    const memberIds = [...new Set((baselines ?? []).map(b => b.member_id))];

    // Filter out opted-out members
    const { data: optedOut } = await supabase
      .from("member_mood_preferences")
      .select("member_id")
      .eq("opted_out", true);
    const optedOutSet = new Set((optedOut ?? []).map(o => o.member_id));
    const eligibleIds = memberIds.filter(id => !optedOutSet.has(id));

    let scored = 0;
    let interventionsCreated = 0;
    let baselineRecomputed = 0;
    const errors: string[] = [];

    for (const memberId of eligibleIds) {
      try {
        const snapshot = await this.calculateMoodScore(memberId);
        if (!snapshot) continue;
        scored++;

        // Create intervention if triggered
        if (snapshot.interventionTriggered && snapshot.interventionType) {
          const hasExisting = await this._hasPendingIntervention(memberId);
          if (!hasExisting) {
            await this.createIntervention(memberId, snapshot);
            interventionsCreated++;
          }
        }
      } catch (err: any) {
        errors.push(`Scoring ${memberId}: ${err.message}`);
      }
    }

    // 3. Recompute baselines monthly (check last computed)
    for (const memberId of eligibleIds) {
      try {
        const { data: latest } = await supabase
          .from("member_mood_baselines")
          .select("computed_at")
          .eq("member_id", memberId)
          .order("computed_at", { ascending: false })
          .limit(1)
          .single();
        if (latest) {
          const daysSince = (Date.now() - new Date(latest.computed_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince >= 30) {
            await this.computeBaseline(memberId);
            baselineRecomputed++;
          }
        }
      } catch (err: any) {
        errors.push(`Baseline ${memberId}: ${err.message}`);
      }
    }

    return { scored, interventionsCreated, baselineRecomputed, errors };
  }

  // ─── E. INTERVENTION MANAGEMENT ──────────────────────────────────────────

  /** Create a mood intervention for a member */
  static async createIntervention(
    memberId: string,
    snapshot: MoodSnapshot,
    options?: {
      language?: string;
      circleId?: string;
      currentAmountCents?: number;
      circleName?: string;
      memberName?: string;
    }
  ): Promise<MoodIntervention> {
    const type = snapshot.interventionType ?? "warm_checkin";
    const tier = snapshot.tier;
    const lang = options?.language ?? "en";
    const requiresReview = tier === "at_risk";

    const { title, body } = this._generateInterventionMessage(
      type, lang, options?.memberName ?? "there", options?.circleName
    );

    const { data: row, error } = await supabase
      .from("mood_interventions")
      .insert({
        member_id: memberId,
        mood_snapshot_id: snapshot.id,
        intervention_type: type,
        tier_at_trigger: tier,
        mood_score_at_trigger: snapshot.compositeMoodScore,
        channel: requiresReview ? "direct_message" : "in_app",
        message_title: title,
        message_body: body,
        language: lang,
        circle_id: options?.circleId ?? null,
        current_amount_cents: options?.currentAmountCents ?? null,
        requires_review: requiresReview,
        outcome: requiresReview ? "pending_review" : "pending",
        sent_at: requiresReview ? null : new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(row);
  }

  /** Mark intervention as viewed */
  static async markViewed(interventionId: string): Promise<MoodIntervention> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .update({ viewed_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Accept an intervention */
  static async acceptIntervention(interventionId: string): Promise<MoodIntervention> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Decline an intervention */
  static async declineIntervention(interventionId: string): Promise<MoodIntervention> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .update({ declined_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Complete an intervention */
  static async completeIntervention(interventionId: string): Promise<MoodIntervention> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Admin reviews and approves an At Risk intervention */
  static async reviewAndSend(
    interventionId: string,
    reviewerId: string,
    customBody?: string,
    notes?: string
  ): Promise<MoodIntervention> {
    const updates: any = {
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: notes ?? null,
      sent_at: new Date().toISOString(),
    };
    if (customBody) updates.message_body = customBody;

    const { data, error } = await supabase
      .from("mood_interventions")
      .update(updates)
      .eq("id", interventionId)
      .select()
      .single();
    if (error) throw error;
    return mapIntervention(data);
  }

  /** Expire stale interventions (not responded within 14 days) */
  static async expireStaleInterventions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);

    const { data, error } = await supabase
      .from("mood_interventions")
      .update({ expired_at: new Date().toISOString() })
      .in("outcome", ["pending", "sent", "viewed"])
      .lt("triggered_at", cutoff.toISOString())
      .select("id");
    if (error) throw error;
    return data?.length ?? 0;
  }

  // ─── F. QUERIES ──────────────────────────────────────────────────────────

  /** Get latest mood snapshot for a member */
  static async getLatestSnapshot(memberId: string): Promise<MoodSnapshot | null> {
    const { data, error } = await supabase
      .from("member_mood_snapshots")
      .select("*")
      .eq("member_id", memberId)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapSnapshot(data) : null;
  }

  /** Get mood snapshot history */
  static async getSnapshotHistory(memberId: string, limit: number = 12): Promise<MoodSnapshot[]> {
    const { data, error } = await supabase
      .from("member_mood_snapshots")
      .select("*")
      .eq("member_id", memberId)
      .order("snapshot_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapSnapshot);
  }

  /** Get active (pending) mood intervention for a member */
  static async getActiveIntervention(memberId: string): Promise<MoodIntervention | null> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .select("*")
      .eq("member_id", memberId)
      .in("outcome", ["pending", "pending_review", "sent", "viewed"])
      .order("triggered_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data ? mapIntervention(data) : null;
  }

  /** Get intervention history for a member */
  static async getMemberInterventions(memberId: string, limit: number = 20): Promise<MoodIntervention[]> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .select("*")
      .eq("member_id", memberId)
      .order("triggered_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapIntervention);
  }

  /** Get recent messages for a member */
  static async getRecentMessages(memberId: string, limit: number = 30): Promise<MemberMessage[]> {
    const { data, error } = await supabase
      .from("member_messages")
      .select("*")
      .eq("member_id", memberId)
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapMessage);
  }

  /** Get full member mood summary */
  static async getMemberSummary(memberId: string): Promise<MemberMoodSummary> {
    const [currentSnapshot, baseline, activeIntervention, snapshotHistory, recentMessages] =
      await Promise.all([
        this.getLatestSnapshot(memberId),
        this.getBaseline(memberId),
        this.getActiveIntervention(memberId),
        this.getSnapshotHistory(memberId, 8),
        this.getRecentMessages(memberId, 15),
      ]);

    const prefs = await this._getPreferences(memberId);

    return {
      memberId,
      currentSnapshot,
      baseline,
      activeIntervention,
      snapshotHistory,
      recentMessages,
      tier: currentSnapshot?.tier ?? "stable",
      trend: currentSnapshot?.trend ?? "stable",
      isOptedOut: prefs?.optedOut ?? false,
    };
  }

  // ─── G. OPT-OUT / PREFERENCES ───────────────────────────────────────────

  /** Set mood analysis opt-out for a member */
  static async setOptOut(memberId: string, optOut: boolean): Promise<void> {
    const { error } = await supabase
      .from("member_mood_preferences")
      .upsert({
        member_id: memberId,
        opted_out: optOut,
        opted_out_at: optOut ? new Date().toISOString() : null,
      }, { onConflict: "member_id" });
    if (error) throw error;
  }

  /** Get mood keywords */
  static async getKeywords(language?: string): Promise<MoodKeyword[]> {
    let q = supabase.from("mood_keywords")
      .select("*").eq("is_active", true)
      .order("severity_weight", { ascending: false });
    if (language) q = q.eq("language", language);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(mapKeyword);
  }

  // ─── H. ADMIN / DASHBOARD ───────────────────────────────────────────────

  /** Get mood detection dashboard */
  static async getDashboard(weeks: number = 12): Promise<MoodDashboardRow[]> {
    const { data, error } = await supabase
      .from("mood_detection_dashboard")
      .select("*")
      .limit(weeks);
    if (error) throw error;
    return (data ?? []).map(mapDashboardRow);
  }

  /** Get all members currently Disengaging or At Risk */
  static async getFlaggedMembers(): Promise<MoodSnapshot[]> {
    const { data, error } = await supabase
      .from("member_mood_snapshots")
      .select("*")
      .in("tier", ["disengaging", "at_risk"])
      .order("composite_mood_score", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapSnapshot);
  }

  /** Get interventions pending human review */
  static async getPendingReviews(): Promise<MoodIntervention[]> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .select("*")
      .eq("requires_review", true)
      .is("reviewed_at", null)
      .order("triggered_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapIntervention);
  }

  /** Get intervention effectiveness metrics */
  static async getInterventionMetrics(): Promise<{
    totalTriggered: number;
    accepted: number;
    declined: number;
    expired: number;
    completed: number;
    pendingReview: number;
    acceptanceRate: number;
    reEngagementRate: number;
    defaultsPrevented: number;
    byType: Record<string, { triggered: number; accepted: number; reEngaged: number }>;
  }> {
    const { data, error } = await supabase
      .from("mood_interventions")
      .select("intervention_type, outcome, default_prevented, member_re_engaged");
    if (error) throw error;

    const rows = data ?? [];
    const totalTriggered = rows.length;
    const accepted = rows.filter(r => r.outcome === "accepted" || r.outcome === "completed").length;
    const declined = rows.filter(r => r.outcome === "declined").length;
    const expired = rows.filter(r => r.outcome === "expired").length;
    const completed = rows.filter(r => r.outcome === "completed").length;
    const pendingReview = rows.filter(r => r.outcome === "pending_review").length;
    const defaultsPrevented = rows.filter(r => r.default_prevented === true).length;
    const reEngaged = rows.filter(r => r.member_re_engaged === true).length;

    const byType: Record<string, { triggered: number; accepted: number; reEngaged: number }> = {};
    for (const r of rows) {
      const t = r.intervention_type;
      if (!byType[t]) byType[t] = { triggered: 0, accepted: 0, reEngaged: 0 };
      byType[t].triggered++;
      if (r.outcome === "accepted" || r.outcome === "completed") byType[t].accepted++;
      if (r.member_re_engaged) byType[t].reEngaged++;
    }

    return {
      totalTriggered, accepted, declined, expired, completed, pendingReview,
      acceptanceRate: totalTriggered > 0 ? (accepted / totalTriggered) * 100 : 0,
      reEngagementRate: totalTriggered > 0 ? (reEngaged / totalTriggered) * 100 : 0,
      defaultsPrevented, byType,
    };
  }

  // ─── I. REALTIME ─────────────────────────────────────────────────────────

  /** Subscribe to mood intervention updates */
  static subscribeToInterventions(
    memberId: string,
    callback: (intervention: MoodIntervention) => void
  ) {
    return supabase
      .channel(`mood-interventions-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mood_interventions",
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          if (payload.new) callback(mapIntervention(payload.new));
        }
      )
      .subscribe();
  }

  /** Subscribe to mood score updates */
  static subscribeToSnapshots(
    memberId: string,
    callback: (snapshot: MoodSnapshot) => void
  ) {
    return supabase
      .channel(`mood-snapshots-${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "member_mood_snapshots",
          filter: `member_id=eq.${memberId}`,
        },
        (payload: any) => {
          if (payload.new) callback(mapSnapshot(payload.new));
        }
      )
      .subscribe();
  }

  // ─── PRIVATE HELPERS ─────────────────────────────────────────────────────

  /** Simple rule-based polarity scoring (-1 to +1) — VADER-like approach */
  private static _computePolarity(text: string, lang: string): number {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);

    // Positive / negative word lists (simplified — Phase 2 uses real VADER/API)
    const positiveEN = ["excited", "great", "love", "amazing", "wonderful", "happy",
      "glad", "thanks", "thank", "awesome", "perfect", "good", "excellent",
      "appreciate", "enjoy", "fantastic", "beautiful", "helpful", "kind"];
    const negativeEN = ["struggle", "can't", "cannot", "behind", "urgent", "late",
      "difficult", "hard", "problem", "issue", "worried", "frustrated",
      "angry", "disappointed", "confused", "stuck", "fail", "bad", "terrible"];
    const positiveFR = ["content", "super", "merci", "excellent", "formidable", "bien",
      "parfait", "génial", "heureux", "ravie", "adore", "magnifique"];
    const negativeFR = ["difficile", "problème", "retard", "urgent", "frustré",
      "déçu", "inquiet", "galère", "impossible", "pire", "nul"];

    const positive = lang === "fr" ? positiveFR : positiveEN;
    const negative = lang === "fr" ? negativeEN : negativeEN;

    let posCount = 0;
    let negCount = 0;
    for (const w of words) {
      if (positive.some(p => w.includes(p))) posCount++;
      if (negative.some(n => w.includes(n))) negCount++;
    }

    const total = posCount + negCount;
    if (total === 0) return 0;
    // Normalize to -1..+1 range
    return (posCount - negCount) / total;
  }

  /** Compute subjectivity (0-1) — ratio of opinion words */
  private static _computeSubjectivity(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return 0;
    const opinionWords = ["think", "feel", "believe", "love", "hate", "best", "worst",
      "amazing", "terrible", "hope", "wish", "want", "like", "dislike",
      "personally", "opinion", "prefer", "beautiful", "ugly"];
    const matches = words.filter(w => opinionWords.some(o => w.includes(o))).length;
    return Math.min(1, matches / Math.max(1, words.length) * 5);
  }

  /** Compute lexical diversity (type-token ratio) */
  private static _computeLexicalDiversity(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 1) return 0;
    const unique = new Set(words);
    return unique.size / words.length;
  }

  /** Detect mood keywords in text */
  private static async _detectKeywords(text: string, lang: string): Promise<string[]> {
    const { data: keywords, error } = await supabase
      .from("mood_keywords")
      .select("keyword")
      .eq("language", lang)
      .eq("is_active", true);
    if (error) return [];

    const lower = text.toLowerCase();
    return (keywords ?? [])
      .filter(kw => lower.includes(kw.keyword.toLowerCase()))
      .map(kw => kw.keyword);
  }

  /** Check if member has opted out */
  private static async _isOptedOut(memberId: string): Promise<boolean> {
    const prefs = await this._getPreferences(memberId);
    return prefs?.optedOut ?? false;
  }

  /** Get member mood preferences */
  private static async _getPreferences(memberId: string): Promise<MoodPreference | null> {
    const { data, error } = await supabase
      .from("member_mood_preferences")
      .select("*")
      .eq("member_id", memberId)
      .single();
    if (error && error.code !== "PGRST116") return null;
    if (!data) return null;
    return {
      id: data.id,
      memberId: data.member_id,
      optedOut: data.opted_out,
      optedOutAt: data.opted_out_at,
      preferredLanguage: data.preferred_language,
    };
  }

  /** Check if member already has a pending intervention */
  private static async _hasPendingIntervention(memberId: string): Promise<boolean> {
    const { data } = await supabase
      .from("mood_interventions")
      .select("id")
      .eq("member_id", memberId)
      .in("outcome", ["pending", "pending_review", "sent", "viewed"])
      .limit(1);
    return (data?.length ?? 0) > 0;
  }

  /** Generate intervention message based on type and language */
  private static _generateInterventionMessage(
    type: MoodInterventionType,
    language: string,
    memberName: string,
    circleName?: string
  ): { title: string; body: string } {
    const circle = circleName ?? "your circle";

    const messages: Record<MoodInterventionType, Record<string, { title: string; body: string }>> = {
      warm_checkin: {
        en: {
          title: "Just checking in",
          body: `Hey ${memberName}, we just wanted to check in. How are things going with you? We love having you in ${circle} and want to make sure TandaXn is working well for you. No action needed — we're just thinking of you.`,
        },
        fr: {
          title: "Juste un petit mot",
          body: `Salut ${memberName}, on voulait juste prendre de tes nouvelles. Comment ça va? On est content de t'avoir dans ${circle} et on veut s'assurer que tout se passe bien pour toi. Pas besoin de répondre — on pense à toi.`,
        },
      },
      contribution_pause: {
        en: {
          title: "Need a breather?",
          body: `${memberName}, life gets busy — we get it. If your contribution amount or schedule isn't working right now, we can adjust it. Your spot in ${circle} is safe. Just reply here or tap below and we'll sort it out together.`,
        },
        fr: {
          title: "Besoin d'une pause?",
          body: `${memberName}, la vie est parfois compliquée — on comprend. Si ton montant ou ton calendrier de contribution ne te convient plus, on peut l'ajuster. Ta place dans ${circle} est assurée. Réponds ici ou touche le bouton ci-dessous.`,
        },
      },
      amount_reduction: {
        en: {
          title: "Let's find what works",
          body: `${memberName}, if your current contribution amount feels like a stretch, we can lower it — no judgment. Your participation in ${circle} matters more than the amount. Tap below to explore options.`,
        },
        fr: {
          title: "Trouvons ce qui te convient",
          body: `${memberName}, si ton montant de contribution actuel est trop élevé, on peut le réduire — sans jugement. Ta participation dans ${circle} compte plus que le montant. Touche ci-dessous pour voir les options.`,
        },
      },
      human_outreach: {
        en: {
          title: "Personal message from the team",
          body: `Hey ${memberName}, it's the TandaXn team. We noticed you've been quieter lately and wanted to personally reach out. Is there anything we can do to make this easier for you?`,
        },
        fr: {
          title: "Message personnel de l'équipe",
          body: `Salut ${memberName}, c'est l'équipe TandaXn. On a remarqué que tu étais plus discret ces derniers temps et on voulait te contacter personnellement. Y a-t-il quelque chose qu'on peut faire pour t'aider?`,
        },
      },
      counselor_referral: {
        en: {
          title: "Free financial support available",
          body: `${memberName}, we've partnered with certified financial counselors who can help — completely free and confidential. No strings attached. Would you like us to connect you?`,
        },
        fr: {
          title: "Soutien financier gratuit disponible",
          body: `${memberName}, nous travaillons avec des conseillers financiers certifiés qui peuvent t'aider — gratuitement et en toute confidentialité. Sans engagement. Souhaites-tu qu'on te mette en contact?`,
        },
      },
    };

    return messages[type]?.[language] ?? messages[type]?.["en"]
      ?? { title: "We're here for you", body: `Hey ${memberName}, just wanted to check in.` };
  }
}
