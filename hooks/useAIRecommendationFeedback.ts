// ═══════════════════════════════════════════════════════════════════════════════
// useAIRecommendationFeedback.ts — #190 AI Recommendation Feedback Loop Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 hooks:
//   usePendingFeedbackPrompts — prompts awaiting member response
//   useFeedbackHistory        — member's feedback history
//   useFeedbackDashboard      — admin dashboard stats per type
//   useHumanReviewQueue       — admin queue of "unfair" flags
//   useFeedbackActions        — all mutation actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AIRecommendationFeedbackEngine,
  type RecommendationType,
  type FeedbackValue,
  type OutcomeValue,
  type AIFeedbackRecord,
  type FeedbackSummary,
  type PendingFeedbackPrompt,
  type FeedbackDashboardStats,
  type HumanReviewItem,
} from '../services/AIRecommendationFeedbackEngine';

// Re-export types for consumers
export type {
  RecommendationType,
  FeedbackValue,
  OutcomeValue,
  AIFeedbackRecord,
  FeedbackSummary,
  PendingFeedbackPrompt,
  FeedbackDashboardStats,
  HumanReviewItem,
};


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: usePendingFeedbackPrompts
// ─────────────────────────────────────────────────────────────────────────────

export function usePendingFeedbackPrompts(userId?: string) {
  const [prompts, setPrompts] = useState<PendingFeedbackPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await AIRecommendationFeedbackEngine.getPendingPrompts(userId);
      setPrompts(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = AIRecommendationFeedbackEngine.subscribeToMemberFeedback(userId, () => {
      fetchPrompts();
    });
    return () => { channel.unsubscribe(); };
  }, [userId, fetchPrompts]);

  const computed = useMemo(() => ({
    hasPrompts: prompts.length > 0,
    promptCount: prompts.length,
    nextPrompt: prompts[0] ?? null,
  }), [prompts]);

  return { prompts, loading, error, refresh: fetchPrompts, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useFeedbackHistory
// ─────────────────────────────────────────────────────────────────────────────

export function useFeedbackHistory(userId?: string, limit: number = 20) {
  const [history, setHistory] = useState<AIFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await AIRecommendationFeedbackEngine.getMemberFeedbackHistory(userId, limit);
      setHistory(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const computed = useMemo(() => ({
    totalFeedback: history.length,
    helpfulCount: history.filter(h => h.feedback === 'helpful').length,
    notHelpfulCount: history.filter(h => h.feedback === 'not_helpful' || h.feedback === 'wrong').length,
    positiveFeedbackRate: history.length > 0
      ? Math.round(history.filter(h => h.feedback === 'helpful').length / history.length * 100)
      : 0,
  }), [history]);

  return { history, loading, error, refresh: fetchHistory, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useFeedbackDashboard
// ─────────────────────────────────────────────────────────────────────────────

export function useFeedbackDashboard() {
  const [stats, setStats] = useState<FeedbackDashboardStats[]>([]);
  const [overallStats, setOverallStats] = useState<{
    totalRecorded: number;
    totalWithFeedback: number;
    totalWithOutcome: number;
    pendingOutcomes: number;
    humanReviewPending: number;
  } | null>(null);
  const [retrainingFlags, setRetrainingFlags] = useState<FeedbackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashStats, overall, flags] = await Promise.all([
        AIRecommendationFeedbackEngine.getDashboardStats(),
        AIRecommendationFeedbackEngine.getOverallStats(),
        AIRecommendationFeedbackEngine.getRetrainingFlags(),
      ]);
      setStats(dashStats);
      setOverallStats(overall);
      setRetrainingFlags(flags);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const computed = useMemo(() => ({
    hasDrift: stats.some(s => s.driftFlagged),
    needsRetraining: retrainingFlags.length > 0,
    avgAcceptanceRate: stats.length > 0
      ? Math.round(stats.reduce((sum, s) => sum + s.acceptanceRate, 0) / stats.length * 10000) / 100
      : 0,
    avgFeedbackRate: stats.length > 0
      ? Math.round(stats.reduce((sum, s) => sum + s.feedbackRate, 0) / stats.length * 10000) / 100
      : 0,
    decliningTypes: stats.filter(s => s.trend === 'declining').map(s => s.recommendationType),
    humanReviewCount: overallStats?.humanReviewPending ?? 0,
  }), [stats, retrainingFlags, overallStats]);

  return { stats, overallStats, retrainingFlags, loading, error, refresh: fetchData, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useHumanReviewQueue
// ─────────────────────────────────────────────────────────────────────────────

export function useHumanReviewQueue() {
  const [reviews, setReviews] = useState<HumanReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await AIRecommendationFeedbackEngine.getPendingHumanReviews();
      setReviews(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Realtime
  useEffect(() => {
    const channel = AIRecommendationFeedbackEngine.subscribeToHumanReviews(() => {
      fetchReviews();
    });
    return () => { channel.unsubscribe(); };
  }, [fetchReviews]);

  const computed = useMemo(() => ({
    pendingCount: reviews.length,
    hasPending: reviews.length > 0,
    byType: reviews.reduce((acc, r) => {
      acc[r.recommendationType] = (acc[r.recommendationType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  }), [reviews]);

  return { reviews, loading, error, refresh: fetchReviews, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useFeedbackActions
// ─────────────────────────────────────────────────────────────────────────────

export function useFeedbackActions() {
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState(false);

  const recordRecommendationShown = useCallback(async (
    userId: string,
    recommendationType: RecommendationType,
    recommendationData: Record<string, any>,
    recommendationId?: string,
    modelVersion?: string
  ) => {
    setRecording(true);
    try {
      return await AIRecommendationFeedbackEngine.recordRecommendationShown(
        userId, recommendationType, recommendationData, recommendationId, modelVersion
      );
    } finally {
      setRecording(false);
    }
  }, []);

  const submitFeedback = useCallback(async (
    feedbackRecordId: string,
    userId: string,
    feedback: FeedbackValue,
    feedbackText?: string,
    feedbackCategory?: string
  ) => {
    setSubmitting(true);
    try {
      return await AIRecommendationFeedbackEngine.submitFeedback(
        feedbackRecordId, userId, feedback, feedbackText, feedbackCategory
      );
    } finally {
      setSubmitting(false);
    }
  }, []);

  const dismissPrompt = useCallback(async (feedbackRecordId: string, userId: string) => {
    return AIRecommendationFeedbackEngine.dismissPrompt(feedbackRecordId, userId);
  }, []);

  const resolveHumanReview = useCallback(async (feedbackRecordId: string) => {
    return AIRecommendationFeedbackEngine.resolveHumanReview(feedbackRecordId);
  }, []);

  const acknowledgeRetraining = useCallback(async (summaryId: string) => {
    return AIRecommendationFeedbackEngine.acknowledgeRetraining(summaryId);
  }, []);

  const shouldShowPrompt = useCallback(async (userId: string, type: RecommendationType) => {
    return AIRecommendationFeedbackEngine.shouldShowFeedbackPrompt(userId, type);
  }, []);

  return {
    recordRecommendationShown,
    submitFeedback,
    dismissPrompt,
    resolveHumanReview,
    acknowledgeRetraining,
    shouldShowPrompt,
    submitting,
    recording,
  };
}
