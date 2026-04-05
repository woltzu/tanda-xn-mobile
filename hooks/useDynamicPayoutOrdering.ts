/**
 * ══════════════════════════════════════════════════════════════════════════════
 * DYNAMIC PAYOUT ORDERING HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the stability-optimized payout ordering system.
 * 5 hooks: useMyExplanation, useStabilityScore, useReorderRequests,
 *          useCulturalPriorities, useDynamicOrderActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DynamicPayoutOrderingEngine,
  type RiskEngagementModel,
  type ReorderTriggerType,
  type ReorderStatus,
  type CulturalSignalType,
  type ExplanationImpact,
  type StabilityScore,
  type CandidateOrdering,
  type ExplanationComponent,
  type PositionExplanation,
  type StabilityOptimizationRun,
  type MidCycleReorderRequest,
  type CulturalPrioritySignal,
  type DynamicOrderConfig,
} from '@/services/DynamicPayoutOrderingEngine';

// Re-export all types for consumer convenience
export type {
  RiskEngagementModel,
  ReorderTriggerType,
  ReorderStatus,
  CulturalSignalType,
  ExplanationImpact,
  StabilityScore,
  CandidateOrdering,
  ExplanationComponent,
  PositionExplanation,
  StabilityOptimizationRun,
  MidCycleReorderRequest,
  CulturalPrioritySignal,
  DynamicOrderConfig,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useMyExplanation — Position explanation for the current user
// ═══════════════════════════════════════════════════════════════════════════════

export function useMyExplanation(circleId?: string) {
  const [explanation, setExplanation] = useState<PositionExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async () => {
    if (!circleId) {
      setExplanation(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const data = await DynamicPayoutOrderingEngine.getMyExplanation(user.id, circleId);
      setExplanation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch position explanation');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  // Realtime: refresh when explanations change
  useEffect(() => {
    if (!circleId) return;

    const channel = supabase
      .channel(`explanation-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_position_explanations',
          filter: `circle_id=eq.${circleId}`,
        },
        () => { fetchExplanation(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId, fetchExplanation]);

  // Computed: human-friendly position text
  const positionText = useMemo(() => {
    if (!explanation) return null;
    const { position, eligibleRangeMin, eligibleRangeMax } = explanation;
    return {
      position: `#${position}`,
      range: `#${eligibleRangeMin}–#${eligibleRangeMax}`,
      summary: explanation.summaryText,
    };
  }, [explanation]);

  // Computed: group components by impact
  const componentsByImpact = useMemo(() => {
    if (!explanation) return null;
    const positive = explanation.components.filter(c => c.impact === 'positive');
    const neutral = explanation.components.filter(c => c.impact === 'neutral');
    const negative = explanation.components.filter(c => c.impact === 'negative');
    return { positive, neutral, negative };
  }, [explanation]);

  return {
    explanation,
    loading,
    error,
    refetch: fetchExplanation,
    positionText,
    componentsByImpact,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useStabilityScore — Latest stability optimization result
// ═══════════════════════════════════════════════════════════════════════════════

export function useStabilityScore(circleId?: string) {
  const [run, setRun] = useState<StabilityOptimizationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRun = useCallback(async () => {
    if (!circleId) {
      setRun(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await DynamicPayoutOrderingEngine.getStabilityRun(circleId);
      setRun(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stability score');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Computed: formatted stability breakdown
  const breakdown = useMemo(() => {
    if (!run) return null;
    const s = run.stabilityBreakdown;
    return {
      overall: `${s.overall.toFixed(1)}/100`,
      collapseRisk: `${(s.collapseProb * 100).toFixed(1)}%`,
      engagement: `${s.engagementRetention.toFixed(1)}/100`,
      riskDistribution: `${s.riskDistribution.toFixed(1)}/100`,
      continuity: `${s.contributionContinuity.toFixed(1)}/100`,
    };
  }, [run]);

  // Computed: stability grade (A-F)
  const grade = useMemo(() => {
    if (!run) return null;
    const score = run.stabilityBreakdown.overall;
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }, [run]);

  return {
    run,
    loading,
    error,
    refetch: fetchRun,
    breakdown,
    grade,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useReorderRequests — Mid-cycle reorder requests + realtime
// ═══════════════════════════════════════════════════════════════════════════════

export function useReorderRequests(circleId?: string) {
  const [requests, setRequests] = useState<MidCycleReorderRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!circleId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await DynamicPayoutOrderingEngine.getReorderRequests(circleId);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reorder requests');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime subscription
  useEffect(() => {
    if (!circleId) return;

    const channel = DynamicPayoutOrderingEngine.subscribeToReorderRequests(
      circleId,
      () => { fetchRequests(); }
    );

    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId, fetchRequests]);

  // Computed: active requests (pending/awaiting_vote/executing)
  const activeRequests = useMemo(() => {
    return requests.filter(r =>
      r.status === 'pending' || r.status === 'awaiting_vote' || r.status === 'executing'
    );
  }, [requests]);

  const hasActiveRequest = useMemo(() => activeRequests.length > 0, [activeRequests]);

  return {
    requests,
    activeRequests,
    hasActiveRequest,
    loading,
    error,
    refetch: fetchRequests,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useCulturalPriorities — Cultural signals for circle
// ═══════════════════════════════════════════════════════════════════════════════

export function useCulturalPriorities(circleId?: string) {
  const [signals, setSignals] = useState<CulturalPrioritySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async () => {
    if (!circleId) {
      setSignals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await DynamicPayoutOrderingEngine.getCulturalPriorities(circleId);
      setSignals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cultural priorities');
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Computed: group by signal type
  const byType = useMemo(() => {
    const grouped: Record<CulturalSignalType, CulturalPrioritySignal[]> = {
      elder_status: [],
      community_leader: [],
      organizer_priority: [],
      ceremony_host: [],
      custom: [],
    };
    for (const signal of signals) {
      grouped[signal.signalType].push(signal);
    }
    return grouped;
  }, [signals]);

  // Computed: total active signals
  const activeCount = useMemo(() => {
    const now = new Date().toISOString();
    return signals.filter(s => !s.expiresAt || s.expiresAt > now).length;
  }, [signals]);

  return {
    signals,
    loading,
    error,
    refetch: fetchSignals,
    byType,
    activeCount,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useDynamicOrderActions — Action callbacks for triggering operations
// ═══════════════════════════════════════════════════════════════════════════════

export function useDynamicOrderActions(circleId?: string) {
  const [optimizing, setOptimizing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triggerOptimizedOrder = useCallback(async () => {
    if (!circleId) return null;

    try {
      setOptimizing(true);
      setError(null);
      const result = await DynamicPayoutOrderingEngine.determineOptimizedOrder(circleId);
      return result;
    } catch (err: any) {
      setError(err.message || 'Optimization failed');
      return null;
    } finally {
      setOptimizing(false);
    }
  }, [circleId]);

  const requestReorder = useCallback(async (
    triggerType: ReorderTriggerType,
    details: Record<string, any> = {}
  ) => {
    if (!circleId) return null;

    try {
      setReordering(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const requestId = await DynamicPayoutOrderingEngine.requestMidCycleReorder(
        circleId,
        triggerType,
        user.id,
        details
      );
      return requestId;
    } catch (err: any) {
      setError(err.message || 'Reorder request failed');
      return null;
    } finally {
      setReordering(false);
    }
  }, [circleId]);

  const setCulturalPriority = useCallback(async (
    userId: string,
    signalType: CulturalSignalType,
    weight: number,
    reason?: string
  ) => {
    if (!circleId) return;

    try {
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await DynamicPayoutOrderingEngine.setCulturalPriority(
        userId,
        circleId,
        signalType,
        weight,
        user.id,
        reason
      );
    } catch (err: any) {
      setError(err.message || 'Failed to set cultural priority');
    }
  }, [circleId]);

  return {
    optimizing,
    reordering,
    error,
    triggerOptimizedOrder,
    requestReorder,
    setCulturalPriority,
  };
}
