/**
 * ══════════════════════════════════════════════════════════════════════════════
 * EXPLAINABLE AI HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the Explainable AI engine.
 * 3 hooks: useDecisionHistory, useExplanation, useExplanationActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ExplainableAIEngine,
  type DecisionType,
  type SupportedLanguage,
  type ExplanationTemplate,
  type AIDecision,
  type GenerateExplanationResult,
  type DecisionHistoryFilters,
  type DecisionStats,
} from '@/services/ExplainableAIEngine';

// Re-export all types for consumer convenience
export type {
  DecisionType,
  SupportedLanguage,
  ExplanationTemplate,
  AIDecision,
  GenerateExplanationResult,
  DecisionHistoryFilters,
  DecisionStats,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useDecisionHistory — Paginated decision history for a member
// ═══════════════════════════════════════════════════════════════════════════════

export function useDecisionHistory(
  userId?: string,
  filters?: DecisionHistoryFilters
) {
  const [decisions, setDecisions] = useState<AIDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userId) {
      setDecisions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await ExplainableAIEngine.getDecisionHistory(userId, filters);
      setDecisions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch decision history');
    } finally {
      setLoading(false);
    }
  }, [userId, filters?.decisionType, filters?.fromDate, filters?.toDate, filters?.limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = ExplainableAIEngine.subscribeToDecisions(userId, () => {
      fetchHistory();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchHistory]);

  // Computed
  const totalDecisions = useMemo(() => decisions.length, [decisions]);
  const latestDecision = useMemo(() => decisions[0] || null, [decisions]);
  const hasDecisions = useMemo(() => decisions.length > 0, [decisions]);

  return {
    decisions,
    loading,
    error,
    refetch: fetchHistory,
    totalDecisions,
    latestDecision,
    hasDecisions,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useExplanation — Single explanation lookup (by decision ID or source event)
// ═══════════════════════════════════════════════════════════════════════════════

export function useExplanation(params: {
  decisionId?: string;
  sourceEventId?: string;
  sourceEventType?: string;
}) {
  const [decision, setDecision] = useState<AIDecision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async () => {
    const { decisionId, sourceEventId, sourceEventType } = params;

    if (!decisionId && !sourceEventId) {
      setDecision(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let result: AIDecision | null = null;

      if (decisionId) {
        result = await ExplainableAIEngine.getDecisionById(decisionId);
      } else if (sourceEventId && sourceEventType) {
        result = await ExplainableAIEngine.getDecisionForEvent(sourceEventId, sourceEventType);
      }

      setDecision(result);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch explanation');
    } finally {
      setLoading(false);
    }
  }, [params.decisionId, params.sourceEventId, params.sourceEventType]);

  useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  // Computed
  const hasExplanation = useMemo(
    () => decision !== null && decision.renderedExplanation !== null,
    [decision]
  );
  const explanationText = useMemo(
    () => decision?.renderedExplanation || null,
    [decision]
  );
  const decisionType = useMemo(
    () => decision?.decisionType || null,
    [decision]
  );

  return {
    decision,
    loading,
    error,
    refetch: fetchExplanation,
    hasExplanation,
    explanationText,
    decisionType,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useExplanationActions — Action callbacks for generating explanations
// ═══════════════════════════════════════════════════════════════════════════════

export function useExplanationActions() {
  const [generatingLoading, setGeneratingLoading] = useState(false);
  const [sendingLoading, setSendingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explainScoreChange = useCallback(async (
    userId: string,
    points: number,
    newScore: number,
    trigger: string,
    isIncrease: boolean,
    recoveryAction?: string,
    scoreHistoryId?: string
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      if (isIncrease) {
        return await ExplainableAIEngine.explainScoreIncrease(
          userId, points, newScore, trigger, scoreHistoryId
        );
      } else {
        return await ExplainableAIEngine.explainScoreDecrease(
          userId, points, newScore, trigger, recoveryAction || '', scoreHistoryId
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate score explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const explainCircleRejection = useCallback(async (
    userId: string,
    condition: string,
    threshold: string,
    currentValue: string,
    action: string
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      return await ExplainableAIEngine.explainCircleRejection(
        userId, condition, threshold, currentValue, action
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate circle rejection explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const explainLiquidityDenial = useCallback(async (
    userId: string,
    condition: string,
    threshold: string,
    currentValue: string,
    action: string
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      return await ExplainableAIEngine.explainLiquidityDenial(
        userId, condition, threshold, currentValue, action
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate liquidity denial explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const explainTierChange = useCallback(async (
    userId: string,
    previousTier: string,
    newTier: string,
    isAdvancement: boolean,
    featureOrReason: string,
    recoveryAction?: string,
    tierHistoryId?: string
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      if (isAdvancement) {
        return await ExplainableAIEngine.explainTierAdvancement(
          userId, previousTier, newTier, featureOrReason, tierHistoryId
        );
      } else {
        return await ExplainableAIEngine.explainTierDemotion(
          userId, previousTier, newTier, featureOrReason, recoveryAction || '', tierHistoryId
        );
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate tier change explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const explainPayoutPosition = useCallback(async (
    userId: string,
    position: number,
    totalMembers: number,
    factorDescription: string,
    percentage: number
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      return await ExplainableAIEngine.explainPayoutPosition(
        userId, position, totalMembers, factorDescription, percentage
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate payout position explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const explainIntervention = useCallback(async (
    userId: string,
    factorDescription: string,
    timeframe: string,
    action: string
  ): Promise<GenerateExplanationResult | null> => {
    try {
      setGeneratingLoading(true);
      setError(null);
      return await ExplainableAIEngine.explainIntervention(
        userId, factorDescription, timeframe, action
      );
    } catch (err: any) {
      setError(err.message || 'Failed to generate intervention explanation');
      return null;
    } finally {
      setGeneratingLoading(false);
    }
  }, []);

  const resendNotification = useCallback(async (
    decisionId: string
  ): Promise<boolean> => {
    try {
      setSendingLoading(true);
      setError(null);
      return await ExplainableAIEngine.resendNotification(decisionId);
    } catch (err: any) {
      setError(err.message || 'Failed to resend notification');
      return false;
    } finally {
      setSendingLoading(false);
    }
  }, []);

  return {
    explainScoreChange,
    explainCircleRejection,
    explainLiquidityDenial,
    explainTierChange,
    explainPayoutPosition,
    explainIntervention,
    resendNotification,
    generatingLoading,
    sendingLoading,
    error,
  };
}
