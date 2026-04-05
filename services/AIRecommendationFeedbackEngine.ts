// ═══════════════════════════════════════════════════════════════════════════════
// AIRecommendationFeedbackEngine.ts — #190 AI Recommendation Feedback Loop
// ═══════════════════════════════════════════════════════════════════════════════
//
// Collects explicit member feedback on AI-driven recommendations, tracks
// outcomes, aggregates weekly for model improvement, detects drift.
//
// Sections:
//   A — Types & Interfaces
//   B — DB → App Mappers
//   C — Recommendation Recording (when shown to member)
//   D — Feedback Collection (member response)
//   E — Outcome Tracking (7-day follow-up)
//   F — Feedback Prompt Eligibility (UX rules)
//   G — Weekly Aggregation Job (model_feedback_summary)
//   H — Drift Detection & Retraining Flags
//   I — Admin Dashboard Queries
//   J — Human Review Queue
//   K — Realtime Subscriptions
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type RecommendationType =
  | 'circle_suggestion'
  | 'coaching_tip'
  | 'intervention_message'
  | 'xnscore_explanation'
  | 'payout_position_explanation';

export type FeedbackValue = 'helpful' | 'not_helpful' | 'wrong' | 'unfair' | 'unclear';

export type OutcomeValue = 'followed' | 'ignored' | 'opposite' | 'partial' | 'not_applicable' | 'pending';

export interface AIFeedbackRecord {
  id: string;
  userId: string;
  recommendationType: RecommendationType;
  recommendationId: string | null;
  recommendationData: Record<string, any>;
  modelVersion: string;
  feedback: FeedbackValue | null;
  feedbackText: string | null;
  feedbackCategory: string | null;
  outcome: OutcomeValue | null;
  outcomeDetails: Record<string, any>;
  shownAt: string;
  feedbackGivenAt: string | null;
  outcomeRecordedAt: string | null;
  promptDismissedAt: string | null;
  promptExpiresAt: string;
  feedbackPrompted: boolean;
  feedbackPromptEligible: boolean;
  humanReviewRequested: boolean;
  humanReviewResolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackSummary {
  id: string;
  recommendationType: string;
  modelVersion: string;
  periodStart: string;
  periodEnd: string;
  totalShown: number;
  totalFeedbackReceived: number;
  feedbackResponseRate: number;
  recommendationsFollowed: number;
  recommendationsIgnored: number;
  recommendationsOpposite: number;
  acceptanceRate: number;
  helpfulCount: number;
  notHelpfulCount: number;
  wrongCount: number;
  unfairCount: number;
  unclearCount: number;
  positiveFeedbackRate: number;
  alignedPositive: number;
  alignedNegative: number;
  misaligned: number;
  outcomeAlignmentRate: number;
  acceptanceRatePrevPeriod: number | null;
  acceptanceRateDelta: number | null;
  driftFlagged: boolean;
  retrainingRecommended: boolean;
  segmentBreakdown: Record<string, any>;
  computedAt: string;
  createdAt: string;
}

export interface PendingFeedbackPrompt {
  id: string;
  recommendationType: RecommendationType;
  recommendationData: Record<string, any>;
  shownAt: string;
  promptExpiresAt: string;
}

export interface FeedbackDashboardStats {
  recommendationType: string;
  totalShown: number;
  feedbackRate: number;
  acceptanceRate: number;
  positiveFeedbackRate: number;
  outcomeAlignmentRate: number;
  driftFlagged: boolean;
  retrainingRecommended: boolean;
  trend: 'improving' | 'stable' | 'declining';
}

export interface HumanReviewItem {
  id: string;
  userId: string;
  recommendationType: RecommendationType;
  recommendationData: Record<string, any>;
  feedback: FeedbackValue;
  feedbackText: string | null;
  shownAt: string;
  feedbackGivenAt: string;
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — DB → App Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapFeedbackRecord(row: any): AIFeedbackRecord {
  return {
    id: row.id,
    userId: row.user_id,
    recommendationType: row.recommendation_type,
    recommendationId: row.recommendation_id,
    recommendationData: row.recommendation_data ?? {},
    modelVersion: row.model_version,
    feedback: row.feedback,
    feedbackText: row.feedback_text,
    feedbackCategory: row.feedback_category,
    outcome: row.outcome,
    outcomeDetails: row.outcome_details ?? {},
    shownAt: row.shown_at,
    feedbackGivenAt: row.feedback_given_at,
    outcomeRecordedAt: row.outcome_recorded_at,
    promptDismissedAt: row.prompt_dismissed_at,
    promptExpiresAt: row.prompt_expires_at,
    feedbackPrompted: row.feedback_prompted,
    feedbackPromptEligible: row.feedback_prompt_eligible,
    humanReviewRequested: row.human_review_requested,
    humanReviewResolvedAt: row.human_review_resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFeedbackSummary(row: any): FeedbackSummary {
  return {
    id: row.id,
    recommendationType: row.recommendation_type,
    modelVersion: row.model_version,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    totalShown: row.total_shown,
    totalFeedbackReceived: row.total_feedback_received,
    feedbackResponseRate: parseFloat(row.feedback_response_rate),
    recommendationsFollowed: row.recommendations_followed,
    recommendationsIgnored: row.recommendations_ignored,
    recommendationsOpposite: row.recommendations_opposite,
    acceptanceRate: parseFloat(row.acceptance_rate),
    helpfulCount: row.helpful_count,
    notHelpfulCount: row.not_helpful_count,
    wrongCount: row.wrong_count,
    unfairCount: row.unfair_count,
    unclearCount: row.unclear_count,
    positiveFeedbackRate: parseFloat(row.positive_feedback_rate),
    alignedPositive: row.aligned_positive,
    alignedNegative: row.aligned_negative,
    misaligned: row.misaligned,
    outcomeAlignmentRate: parseFloat(row.outcome_alignment_rate),
    acceptanceRatePrevPeriod: row.acceptance_rate_prev_period ? parseFloat(row.acceptance_rate_prev_period) : null,
    acceptanceRateDelta: row.acceptance_rate_delta ? parseFloat(row.acceptance_rate_delta) : null,
    driftFlagged: row.drift_flagged,
    retrainingRecommended: row.retraining_recommended,
    segmentBreakdown: row.segment_breakdown ?? {},
    computedAt: row.computed_at,
    createdAt: row.created_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — Recommendation Recording
// ─────────────────────────────────────────────────────────────────────────────

export class AIRecommendationFeedbackEngine {

  // ── C1: Record that a recommendation was shown to a member ──

  static async recordRecommendationShown(
    userId: string,
    recommendationType: RecommendationType,
    recommendationData: Record<string, any>,
    recommendationId?: string,
    modelVersion: string = 'rule-v1'
  ): Promise<{ success: boolean; record?: AIFeedbackRecord; error?: string }> {
    // Check if this exact recommendation was already recorded (dedup)
    if (recommendationId) {
      const { data: existing } = await supabase
        .from('ai_recommendation_feedback')
        .select('id')
        .eq('user_id', userId)
        .eq('recommendation_id', recommendationId)
        .single();

      if (existing) {
        return { success: false, error: 'Recommendation already recorded' };
      }
    }

    const { data, error } = await supabase
      .from('ai_recommendation_feedback')
      .insert({
        user_id: userId,
        recommendation_type: recommendationType,
        recommendation_id: recommendationId ?? null,
        recommendation_data: recommendationData,
        model_version: modelVersion,
        outcome: 'pending',
        shown_at: new Date().toISOString(),
        prompt_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, record: mapFeedbackRecord(data) };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION D — Feedback Collection
  // ─────────────────────────────────────────────────────────────────────────

  // ── D1: Submit feedback for a recommendation ──

  static async submitFeedback(
    feedbackRecordId: string,
    userId: string,
    feedback: FeedbackValue,
    feedbackText?: string,
    feedbackCategory?: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('ai_recommendation_feedback')
      .select('id, feedback, user_id')
      .eq('id', feedbackRecordId)
      .eq('user_id', userId)
      .single();

    if (!record) return { success: false, error: 'Feedback record not found' };
    if (record.feedback) return { success: false, error: 'Feedback already submitted' };

    const updates: Record<string, any> = {
      feedback,
      feedback_given_at: new Date().toISOString(),
      feedback_prompted: true,
    };

    if (feedbackText) updates.feedback_text = feedbackText;
    if (feedbackCategory) updates.feedback_category = feedbackCategory;

    // "unfair" triggers human review
    if (feedback === 'unfair') {
      updates.human_review_requested = true;
    }

    const { error } = await supabase
      .from('ai_recommendation_feedback')
      .update(updates)
      .eq('id', feedbackRecordId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ── D2: Dismiss feedback prompt ──

  static async dismissPrompt(
    feedbackRecordId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('ai_recommendation_feedback')
      .update({
        prompt_dismissed_at: new Date().toISOString(),
        feedback_prompt_eligible: false,
      })
      .eq('id', feedbackRecordId)
      .eq('user_id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ── D3: Get pending feedback prompts for a member ──

  static async getPendingPrompts(userId: string): Promise<PendingFeedbackPrompt[]> {
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('ai_recommendation_feedback')
      .select('id, recommendation_type, recommendation_data, shown_at, prompt_expires_at')
      .eq('user_id', userId)
      .is('feedback', null)
      .eq('feedback_prompt_eligible', true)
      .gt('prompt_expires_at', now)
      .is('prompt_dismissed_at', null)
      .order('shown_at', { ascending: false })
      .limit(5);

    return (data ?? []).map(row => ({
      id: row.id,
      recommendationType: row.recommendation_type,
      recommendationData: row.recommendation_data ?? {},
      shownAt: row.shown_at,
      promptExpiresAt: row.prompt_expires_at,
    }));
  }


  // ── D4: Get member's feedback history ──

  static async getMemberFeedbackHistory(
    userId: string,
    limit: number = 20
  ): Promise<AIFeedbackRecord[]> {
    const { data } = await supabase
      .from('ai_recommendation_feedback')
      .select('*')
      .eq('user_id', userId)
      .not('feedback', 'is', null)
      .order('feedback_given_at', { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapFeedbackRecord);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION E — Outcome Tracking
  // ─────────────────────────────────────────────────────────────────────────

  // ── E1: Record outcome for a recommendation ──

  static async recordOutcome(
    feedbackRecordId: string,
    outcome: OutcomeValue,
    outcomeDetails?: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('ai_recommendation_feedback')
      .update({
        outcome,
        outcome_details: outcomeDetails ?? {},
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', feedbackRecordId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ── E2: Process pending outcomes (7-day window check, run by cron) ──

  static async processPendingOutcomes(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get recommendations shown > 7 days ago still pending outcome
    const { data: pending } = await supabase
      .from('ai_recommendation_feedback')
      .select('id, user_id, recommendation_type, recommendation_id, recommendation_data')
      .eq('outcome', 'pending')
      .lt('shown_at', sevenDaysAgo)
      .limit(500);

    let processed = 0;

    for (const record of pending ?? []) {
      try {
        const outcome = await this._evaluateOutcome(record);
        await this.recordOutcome(record.id, outcome.outcome, outcome.details);
        processed++;
      } catch (err: any) {
        errors.push(`Record ${record.id}: ${err.message}`);
      }
    }

    return { processed, errors };
  }


  // ── E3: Evaluate outcome based on recommendation type ──

  private static async _evaluateOutcome(
    record: any
  ): Promise<{ outcome: OutcomeValue; details: Record<string, any> }> {
    const { user_id, recommendation_type, recommendation_data } = record;

    switch (recommendation_type) {
      case 'circle_suggestion': {
        // Check if member joined the suggested circle
        const circleId = recommendation_data?.circle_id;
        if (!circleId) return { outcome: 'not_applicable', details: { reason: 'no_circle_id' } };

        const { data: membership } = await supabase
          .from('circle_members')
          .select('id')
          .eq('user_id', user_id)
          .eq('circle_id', circleId)
          .single();

        return membership
          ? { outcome: 'followed', details: { joined: true } }
          : { outcome: 'ignored', details: { joined: false } };
      }

      case 'coaching_tip': {
        // For coaching tips, check if behavioral signal improved
        // Simplified: mark as not_applicable since tips are informational
        return { outcome: 'not_applicable', details: { reason: 'informational_content' } };
      }

      case 'intervention_message': {
        // Check if member defaulted after intervention
        const { count: defaults } = await supabase
          .from('cycle_contributions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user_id)
          .eq('status', 'missed')
          .gte('created_at', record.shown_at);

        if ((defaults ?? 0) > 0) {
          return { outcome: 'ignored', details: { defaultedAfter: true } };
        }
        return { outcome: 'followed', details: { noDefaultAfter: true } };
      }

      case 'xnscore_explanation':
      case 'payout_position_explanation': {
        // Explanations are informational — outcome based on whether feedback was given
        return { outcome: 'not_applicable', details: { reason: 'explanation_content' } };
      }

      default:
        return { outcome: 'not_applicable', details: { reason: 'unknown_type' } };
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION F — Feedback Prompt Eligibility (UX Rules)
  // ─────────────────────────────────────────────────────────────────────────

  // ── F1: Check if member should see a feedback prompt ──

  static async shouldShowFeedbackPrompt(
    userId: string,
    recommendationType: RecommendationType
  ): Promise<boolean> {
    // Rule 1: No feedback during stressful events (recent default)
    const recentDefault = await this._hasRecentStressfulEvent(userId);
    if (recentDefault) return false;

    // Rule 2: Max one feedback prompt per session (check last 30 min)
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count: recentPrompts } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('feedback_prompted', true)
      .gte('feedback_given_at', thirtyMinAgo);

    if ((recentPrompts ?? 0) > 0) return false;

    // Rule 3: Check pending prompts don't exceed limit
    const pending = await this.getPendingPrompts(userId);
    if (pending.length >= 3) return false;

    return true;
  }


  // ── F2: Mark feedback prompt as ineligible (stressful event occurred) ──

  static async markIneligibleDueToStress(userId: string): Promise<void> {
    await supabase
      .from('ai_recommendation_feedback')
      .update({ feedback_prompt_eligible: false })
      .eq('user_id', userId)
      .is('feedback', null)
      .eq('feedback_prompt_eligible', true);
  }


  // ── F3: Check for recent stressful events ──

  private static async _hasRecentStressfulEvent(userId: string): Promise<boolean> {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    // Check for recent missed contributions
    const { count: missed } = await supabase
      .from('cycle_contributions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'missed')
      .gte('created_at', twoDaysAgo);

    return (missed ?? 0) > 0;
  }


  // ── F4: Expire old feedback prompts (run by cron) ──

  static async expireOldPrompts(): Promise<{ expired: number }> {
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('ai_recommendation_feedback')
      .update({ feedback_prompt_eligible: false })
      .is('feedback', null)
      .eq('feedback_prompt_eligible', true)
      .lt('prompt_expires_at', now)
      .select('id');

    return { expired: data?.length ?? 0 };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION G — Weekly Aggregation Job
  // ─────────────────────────────────────────────────────────────────────────

  // ── G1: Run weekly feedback aggregation ──

  static async runWeeklyAggregation(): Promise<{
    summariesCreated: number;
    driftFlagged: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() - periodEnd.getDay()); // Last Sunday
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    const periodStartStr = periodStart.toISOString().split('T')[0];
    const periodEndStr = periodEnd.toISOString().split('T')[0];

    const recommendationTypes: RecommendationType[] = [
      'circle_suggestion', 'coaching_tip', 'intervention_message',
      'xnscore_explanation', 'payout_position_explanation',
    ];

    let summariesCreated = 0;
    let driftFlagged = 0;

    for (const recType of recommendationTypes) {
      try {
        // Get all feedback records for this type in the period
        const { data: records } = await supabase
          .from('ai_recommendation_feedback')
          .select('*')
          .eq('recommendation_type', recType)
          .gte('shown_at', `${periodStartStr}T00:00:00Z`)
          .lt('shown_at', `${periodEndStr}T00:00:00Z`);

        const allRecords = records ?? [];
        if (allRecords.length === 0) continue;

        // Calculate metrics
        const totalShown = allRecords.length;
        const withFeedback = allRecords.filter(r => r.feedback !== null);
        const totalFeedbackReceived = withFeedback.length;
        const feedbackResponseRate = totalShown > 0 ? totalFeedbackReceived / totalShown : 0;

        // Outcome counts
        const followed = allRecords.filter(r => r.outcome === 'followed').length;
        const ignored = allRecords.filter(r => r.outcome === 'ignored').length;
        const opposite = allRecords.filter(r => r.outcome === 'opposite').length;
        const acceptanceRate = totalShown > 0 ? followed / totalShown : 0;

        // Sentiment counts
        const helpful = withFeedback.filter(r => r.feedback === 'helpful').length;
        const notHelpful = withFeedback.filter(r => r.feedback === 'not_helpful').length;
        const wrong = withFeedback.filter(r => r.feedback === 'wrong').length;
        const unfair = withFeedback.filter(r => r.feedback === 'unfair').length;
        const unclear = withFeedback.filter(r => r.feedback === 'unclear').length;
        const positiveFeedbackRate = totalFeedbackReceived > 0 ? helpful / totalFeedbackReceived : 0;

        // Outcome alignment
        const alignedPositive = allRecords.filter(r => r.feedback === 'helpful' && r.outcome === 'followed').length;
        const alignedNegative = allRecords.filter(r =>
          (r.feedback === 'not_helpful' || r.feedback === 'wrong') &&
          (r.outcome === 'ignored' || r.outcome === 'opposite')
        ).length;
        const misaligned = allRecords.filter(r =>
          (r.feedback === 'helpful' && (r.outcome === 'ignored' || r.outcome === 'opposite')) ||
          ((r.feedback === 'not_helpful' || r.feedback === 'wrong') && r.outcome === 'followed')
        ).length;
        const alignmentTotal = alignedPositive + alignedNegative + misaligned;
        const outcomeAlignmentRate = alignmentTotal > 0 ? (alignedPositive + alignedNegative) / alignmentTotal : 0;

        // Get previous period for drift detection
        const { data: prevSummary } = await supabase
          .from('model_feedback_summary')
          .select('acceptance_rate')
          .eq('recommendation_type', recType)
          .order('period_end', { ascending: false })
          .limit(1)
          .single();

        const prevAcceptanceRate = prevSummary ? parseFloat(prevSummary.acceptance_rate) : null;
        const delta = prevAcceptanceRate !== null ? acceptanceRate - prevAcceptanceRate : null;
        const isDriftFlagged = delta !== null && Math.abs(delta) > 0.15;
        const isRetrainingRecommended = isDriftFlagged && delta !== null && delta < -0.15;

        if (isDriftFlagged) driftFlagged++;

        // Build segment breakdown
        const segmentBreakdown = await this._buildSegmentBreakdown(allRecords);

        // Upsert summary
        await supabase
          .from('model_feedback_summary')
          .upsert({
            recommendation_type: recType,
            model_version: 'rule-v1',
            period_start: periodStartStr,
            period_end: periodEndStr,
            total_shown: totalShown,
            total_feedback_received: totalFeedbackReceived,
            feedback_response_rate: Math.round(feedbackResponseRate * 10000) / 10000,
            recommendations_followed: followed,
            recommendations_ignored: ignored,
            recommendations_opposite: opposite,
            acceptance_rate: Math.round(acceptanceRate * 10000) / 10000,
            helpful_count: helpful,
            not_helpful_count: notHelpful,
            wrong_count: wrong,
            unfair_count: unfair,
            unclear_count: unclear,
            positive_feedback_rate: Math.round(positiveFeedbackRate * 10000) / 10000,
            aligned_positive: alignedPositive,
            aligned_negative: alignedNegative,
            misaligned,
            outcome_alignment_rate: Math.round(outcomeAlignmentRate * 10000) / 10000,
            acceptance_rate_prev_period: prevAcceptanceRate !== null ? Math.round(prevAcceptanceRate * 10000) / 10000 : null,
            acceptance_rate_delta: delta !== null ? Math.round(delta * 10000) / 10000 : null,
            drift_flagged: isDriftFlagged,
            retraining_recommended: isRetrainingRecommended,
            segment_breakdown: segmentBreakdown,
            computed_at: new Date().toISOString(),
          }, { onConflict: 'recommendation_type,model_version,period_start,period_end' });

        summariesCreated++;

        // Alert on drift
        if (isDriftFlagged) {
          await supabase
            .from('score_alerts')
            .insert({
              alert_type: 'model_drift',
              target_type: 'member',
              target_id: '00000000-0000-0000-0000-000000000000',
              severity: isRetrainingRecommended ? 'critical' : 'warning',
              context: {
                source: 'feedback_aggregation',
                recommendationType: recType,
                acceptanceRate,
                delta,
                isRetrainingRecommended,
              },
            });
        }

      } catch (err: any) {
        errors.push(`${recType}: ${err.message}`);
      }
    }

    return { summariesCreated, driftFlagged, errors };
  }


  // ── G2: Build segment breakdown ──

  private static async _buildSegmentBreakdown(
    records: any[]
  ): Promise<Record<string, any>> {
    const userIds = [...new Set(records.map(r => r.user_id))];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, xn_score, preferred_language, country')
      .in('id', userIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // By XnScore tier
    const byTier: Record<string, { shown: number; followed: number; helpful: number }> = {
      emerging: { shown: 0, followed: 0, helpful: 0 },
      building: { shown: 0, followed: 0, helpful: 0 },
      trusted: { shown: 0, followed: 0, helpful: 0 },
      established: { shown: 0, followed: 0, helpful: 0 },
      elder: { shown: 0, followed: 0, helpful: 0 },
    };

    for (const r of records) {
      const profile = profileMap.get(r.user_id);
      const score = profile?.xn_score ?? 0;
      let tier: string;
      if (score < 40) tier = 'emerging';
      else if (score < 60) tier = 'building';
      else if (score < 75) tier = 'trusted';
      else if (score < 90) tier = 'established';
      else tier = 'elder';

      byTier[tier].shown++;
      if (r.outcome === 'followed') byTier[tier].followed++;
      if (r.feedback === 'helpful') byTier[tier].helpful++;
    }

    // By language (top 5)
    const byLanguage: Record<string, { shown: number; followed: number }> = {};
    for (const r of records) {
      const lang = profileMap.get(r.user_id)?.preferred_language ?? 'en';
      if (!byLanguage[lang]) byLanguage[lang] = { shown: 0, followed: 0 };
      byLanguage[lang].shown++;
      if (r.outcome === 'followed') byLanguage[lang].followed++;
    }

    // By geography (top 5 countries)
    const byCountry: Record<string, { shown: number; followed: number }> = {};
    for (const r of records) {
      const country = profileMap.get(r.user_id)?.country ?? 'unknown';
      if (!byCountry[country]) byCountry[country] = { shown: 0, followed: 0 };
      byCountry[country].shown++;
      if (r.outcome === 'followed') byCountry[country].followed++;
    }

    return {
      by_xnscore_tier: byTier,
      by_language: byLanguage,
      by_geography: byCountry,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION H — Drift Detection & Retraining Flags
  // ─────────────────────────────────────────────────────────────────────────

  // ── H1: Check if retraining is recommended for any model ──

  static async getRetrainingFlags(): Promise<FeedbackSummary[]> {
    const { data } = await supabase
      .from('model_feedback_summary')
      .select('*')
      .eq('retraining_recommended', true)
      .order('computed_at', { ascending: false })
      .limit(10);

    return (data ?? []).map(mapFeedbackSummary);
  }


  // ── H2: Acknowledge retraining (human marks it handled) ──

  static async acknowledgeRetraining(summaryId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('model_feedback_summary')
      .update({ retraining_recommended: false })
      .eq('id', summaryId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION I — Admin Dashboard Queries
  // ─────────────────────────────────────────────────────────────────────────

  // ── I1: Get dashboard stats per recommendation type ──

  static async getDashboardStats(): Promise<FeedbackDashboardStats[]> {
    const types: RecommendationType[] = [
      'circle_suggestion', 'coaching_tip', 'intervention_message',
      'xnscore_explanation', 'payout_position_explanation',
    ];

    const stats: FeedbackDashboardStats[] = [];

    for (const recType of types) {
      const { data: summaries } = await supabase
        .from('model_feedback_summary')
        .select('*')
        .eq('recommendation_type', recType)
        .order('period_end', { ascending: false })
        .limit(2);

      const latest = summaries?.[0];
      const previous = summaries?.[1];

      if (!latest) {
        stats.push({
          recommendationType: recType,
          totalShown: 0,
          feedbackRate: 0,
          acceptanceRate: 0,
          positiveFeedbackRate: 0,
          outcomeAlignmentRate: 0,
          driftFlagged: false,
          retrainingRecommended: false,
          trend: 'stable',
        });
        continue;
      }

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (previous) {
        const prevRate = parseFloat(previous.acceptance_rate);
        const currRate = parseFloat(latest.acceptance_rate);
        if (currRate > prevRate + 0.05) trend = 'improving';
        else if (currRate < prevRate - 0.05) trend = 'declining';
      }

      stats.push({
        recommendationType: recType,
        totalShown: latest.total_shown,
        feedbackRate: parseFloat(latest.feedback_response_rate),
        acceptanceRate: parseFloat(latest.acceptance_rate),
        positiveFeedbackRate: parseFloat(latest.positive_feedback_rate),
        outcomeAlignmentRate: parseFloat(latest.outcome_alignment_rate),
        driftFlagged: latest.drift_flagged,
        retrainingRecommended: latest.retraining_recommended,
        trend,
      });
    }

    return stats;
  }


  // ── I2: Get feedback summary history for a recommendation type ──

  static async getSummaryHistory(
    recommendationType: RecommendationType,
    limit: number = 12
  ): Promise<FeedbackSummary[]> {
    const { data } = await supabase
      .from('model_feedback_summary')
      .select('*')
      .eq('recommendation_type', recommendationType)
      .order('period_end', { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapFeedbackSummary);
  }


  // ── I3: Get overall feedback volume stats ──

  static async getOverallStats(): Promise<{
    totalRecorded: number;
    totalWithFeedback: number;
    totalWithOutcome: number;
    pendingOutcomes: number;
    humanReviewPending: number;
  }> {
    const { count: totalRecorded } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true });

    const { count: totalWithFeedback } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true })
      .not('feedback', 'is', null);

    const { count: totalWithOutcome } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true })
      .neq('outcome', 'pending')
      .not('outcome', 'is', null);

    const { count: pendingOutcomes } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('outcome', 'pending');

    const { count: humanReviewPending } = await supabase
      .from('ai_recommendation_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('human_review_requested', true)
      .is('human_review_resolved_at', null);

    return {
      totalRecorded: totalRecorded ?? 0,
      totalWithFeedback: totalWithFeedback ?? 0,
      totalWithOutcome: totalWithOutcome ?? 0,
      pendingOutcomes: pendingOutcomes ?? 0,
      humanReviewPending: humanReviewPending ?? 0,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION J — Human Review Queue
  // ─────────────────────────────────────────────────────────────────────────

  // ── J1: Get pending human reviews ──

  static async getPendingHumanReviews(): Promise<HumanReviewItem[]> {
    const { data } = await supabase
      .from('ai_recommendation_feedback')
      .select('id, user_id, recommendation_type, recommendation_data, feedback, feedback_text, shown_at, feedback_given_at')
      .eq('human_review_requested', true)
      .is('human_review_resolved_at', null)
      .order('feedback_given_at', { ascending: true })
      .limit(50);

    return (data ?? []).map(row => ({
      id: row.id,
      userId: row.user_id,
      recommendationType: row.recommendation_type,
      recommendationData: row.recommendation_data ?? {},
      feedback: row.feedback,
      feedbackText: row.feedback_text,
      shownAt: row.shown_at,
      feedbackGivenAt: row.feedback_given_at,
    }));
  }


  // ── J2: Resolve human review ──

  static async resolveHumanReview(
    feedbackRecordId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('ai_recommendation_feedback')
      .update({ human_review_resolved_at: new Date().toISOString() })
      .eq('id', feedbackRecordId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION K — Realtime Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  // ── K1: Subscribe to member's feedback records ──

  static subscribeToMemberFeedback(
    userId: string,
    callback: (record: AIFeedbackRecord) => void
  ) {
    return supabase
      .channel(`ai_feedback:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_recommendation_feedback',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) callback(mapFeedbackRecord(payload.new));
        }
      )
      .subscribe();
  }

  // ── K2: Subscribe to human review queue (admin) ──

  static subscribeToHumanReviews(
    callback: (record: AIFeedbackRecord) => void
  ) {
    return supabase
      .channel('ai_feedback_reviews')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_recommendation_feedback',
          filter: 'human_review_requested=eq.true',
        },
        (payload) => {
          if (payload.new) callback(mapFeedbackRecord(payload.new));
        }
      )
      .subscribe();
  }
}
