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

// Bucket C — module-level cache. Mirrors the pattern used by
// useAdvanceDashboard / useMemberTier. Keyed by `${userId}:${filtersKey}`
// so multiple consumers (AIInsightsScreen, ScoreExplainerSheet) with
// different filter shapes don't collide. 5-min TTL; realtime inserts
// bust the cache immediately so a fresh decision shows up on the next
// fetch without waiting for the TTL.
const DECISION_CACHE_TTL_MS = 5 * 60 * 1000;
const decisionCache = new Map<
  string,
  { data: AIDecision[]; fetchedAt: number }
>();

function cacheKey(userId: string, filters?: DecisionHistoryFilters): string {
  return `${userId}:${filters?.decisionType ?? ''}:${filters?.fromDate ?? ''}:${filters?.toDate ?? ''}:${filters?.limit ?? ''}`;
}

/**
 * Clear cached decision rows. Pass a userId to evict only that user's
 * entries; omit to clear everything. Useful when:
 *   - a notification handler consumed a new decision (realtime would
 *     normally cover this, but offline-mode notification taps can
 *     bypass realtime)
 *   - the EF dispatcher confirms a push delivery and the client wants
 *     to surface the row immediately
 */
export function bustDecisionCache(userId?: string) {
  if (!userId) {
    decisionCache.clear();
    return;
  }
  for (const key of Array.from(decisionCache.keys())) {
    if (key.startsWith(`${userId}:`)) decisionCache.delete(key);
  }
}

function readDecisionCache(
  userId: string,
  filters?: DecisionHistoryFilters,
): AIDecision[] | null {
  const entry = decisionCache.get(cacheKey(userId, filters));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= DECISION_CACHE_TTL_MS) {
    decisionCache.delete(cacheKey(userId, filters));
    return null;
  }
  return entry.data;
}

function writeDecisionCache(
  userId: string,
  filters: DecisionHistoryFilters | undefined,
  data: AIDecision[],
) {
  decisionCache.set(cacheKey(userId, filters), {
    data,
    fetchedAt: Date.now(),
  });
}

export function useDecisionHistory(
  userId?: string,
  filters?: DecisionHistoryFilters
) {
  // Seed initial state from cache so screen-switches don't blank-flash.
  const [decisions, setDecisions] = useState<AIDecision[]>(() => {
    if (!userId) return [];
    return readDecisionCache(userId, filters) ?? [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!userId) {
        setDecisions([]);
        setLoading(false);
        return;
      }

      if (!opts?.force) {
        const cached = readDecisionCache(userId, filters);
        if (cached) {
          setDecisions(cached);
          setLoading(false);
          return;
        }
      }

      try {
        setLoading(true);
        setError(null);
        const data = await ExplainableAIEngine.getDecisionHistory(userId, filters);
        writeDecisionCache(userId, filters, data);
        setDecisions(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch decision history');
      } finally {
        setLoading(false);
      }
    },
    [userId, filters?.decisionType, filters?.fromDate, filters?.toDate, filters?.limit],
  );

  /**
   * Force a refetch from the server. Used by pull-to-refresh and by
   * notification handlers that know the data has shifted.
   */
  const refresh = useCallback(async () => {
    if (userId) bustDecisionCache(userId);
    await fetchHistory({ force: true });
  }, [userId, fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Realtime subscription — bust the cache before refetching so the
  // fetch path doesn't see the now-stale entry.
  useEffect(() => {
    if (!userId) return;

    const channel = ExplainableAIEngine.subscribeToDecisions(userId, () => {
      bustDecisionCache(userId);
      fetchHistory({ force: true });
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
    refresh,
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
