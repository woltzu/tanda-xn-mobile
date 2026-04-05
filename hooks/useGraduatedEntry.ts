// ══════════════════════════════════════════════════════════════════════════════
// GRADUATED ENTRY HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the Graduated Entry System.
// Member tier status, progression tracking, limits, fast-track workflow.
// Follows useHonorScore.ts / useMemberRemoval.ts patterns.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  GraduatedEntryEngine,
  EntryTierKey,
  TierDefinition,
  MemberTierStatus,
  TierHistoryEntry,
  FastTrackApplication,
  ActionItem,
  TierLimits,
  CircleJoinCheck,
  PositionRestrictions,
  TierEvalResult,
} from '@/services/GraduatedEntryEngine';


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MEMBER TIER HOOK                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Primary hook: current tier, tier definition, limits, progress, demotion status.
 * Includes realtime subscription for tier changes.
 */
export function useMemberTier(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  const [status, setStatus] = useState<MemberTierStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!targetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getMemberTierStatus(targetId);
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription
  useEffect(() => {
    if (!targetId) return;

    const subscription = GraduatedEntryEngine.subscribeToTierChanges(
      targetId,
      () => { fetchStatus(); }
    );

    return () => { subscription.unsubscribe(); };
  }, [targetId, fetchStatus]);

  // Computed: tier definition
  const tierDef = useMemo((): TierDefinition | null => {
    if (!status) return null;
    return GraduatedEntryEngine.getTierDefinition(status.currentTier);
  }, [status]);

  // Computed: limits
  const limits = useMemo((): TierLimits => {
    if (!status) return { maxCircleSize: 0, maxContributionCents: 0, positionAccess: 'none' };
    return {
      maxCircleSize: status.maxCircleSize,
      maxContributionCents: status.maxContributionCents,
      positionAccess: status.positionAccess,
    };
  }, [status]);

  // Computed: action items
  const actionItems = useMemo((): ActionItem[] => {
    if (!status) return [];
    return GraduatedEntryEngine.getProgressActionItems(status);
  }, [status]);

  // Computed: next tier definition
  const nextTierDef = useMemo((): TierDefinition | null => {
    if (!status?.nextTier) return null;
    return GraduatedEntryEngine.getTierDefinition(status.nextTier);
  }, [status]);

  return {
    tier: status,
    tierDef,
    nextTierDef,
    limits,
    actionItems,
    progressPct: status?.progressPct || 0,
    isDemoted: status?.isDemoted || false,
    demotionReason: status?.demotionReason || null,
    demotionPathBack: status?.demotionPathBack || null,
    loading,
    error,
    refetch: fetchStatus,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TIER PROGRESS HOOK                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Focused on progression data: current tier, next tier, progress %, action items.
 */
export function useTierProgress() {
  const { user } = useAuth();
  const [status, setStatus] = useState<MemberTierStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getMemberTierStatus(user.id);
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const currentTierDef = useMemo(() => {
    if (!status) return null;
    return GraduatedEntryEngine.getTierDefinition(status.currentTier);
  }, [status]);

  const nextTierDef = useMemo(() => {
    if (!status?.nextTier) return null;
    return GraduatedEntryEngine.getTierDefinition(status.nextTier);
  }, [status]);

  return {
    currentTier: status?.currentTier || 'critical',
    currentTierDef,
    nextTier: status?.nextTier || null,
    nextTierDef,
    progressPct: status?.progressPct || 0,
    actionItems: status?.actionItems || [],
    xnScore: status?.xnScoreAtEval || 0,
    accountAge: status?.accountAgeAtEval || 0,
    circlesCompleted: status?.circlesCompletedAtEval || 0,
    loading,
    error,
    refetch: fetchProgress,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TIER HISTORY HOOK                                                           │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Tier change history for a user.
 */
export function useTierHistory(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  const [history, setHistory] = useState<TierHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!targetId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getMemberTierHistory(targetId);
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Computed: advancement count
  const advancementCount = useMemo(
    () => history.filter(h => h.changeType === 'advancement').length,
    [history]
  );

  // Computed: was ever demoted
  const wasEverDemoted = useMemo(
    () => history.some(h => h.changeType === 'demotion'),
    [history]
  );

  return {
    history,
    advancementCount,
    wasEverDemoted,
    loading,
    error,
    refetch: fetchHistory,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ FAST-TRACK HOOK                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Fast-track application state + submit action.
 */
export function useFastTrack() {
  const { user } = useAuth();
  const [application, setApplication] = useState<FastTrackApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchApplication = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getFastTrackApplication(user.id);
      setApplication(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  // Computed: can apply (no active/pending application, and current tier is newcomer)
  const canApply = useMemo(() => {
    if (!application) return true; // No previous application
    return application.status === 'rejected' || application.status === 'expired';
  }, [application]);

  const submitApplication = async (
    signals: Record<string, any>
  ): Promise<FastTrackApplication | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.submitFastTrackApplication(signals);
      if (data) setApplication(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    application,
    canApply,
    submitApplication,
    loading,
    error,
    refetch: fetchApplication,
    clearError: () => setError(null),
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TIER LIMITS HOOK                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Current tier limits + circle eligibility check function.
 */
export function useTierLimits() {
  const { user } = useAuth();
  const [limits, setLimits] = useState<TierLimits>({
    maxCircleSize: 0,
    maxContributionCents: 0,
    positionAccess: 'none',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLimits = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getTierLimits(user.id);
      setLimits(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const canJoinCircle = useCallback(async (
    circleSize: number,
    contributionAmountCents: number
  ): Promise<CircleJoinCheck> => {
    return GraduatedEntryEngine.canJoinCircle(circleSize, contributionAmountCents, user?.id);
  }, [user?.id]);

  // Computed: position restrictions
  const positionRestrictions = useMemo((): PositionRestrictions => ({
    canTakeFirst: limits.positionAccess === 'any',
    canTakeEarly: limits.positionAccess === 'any',
    middleOnly: limits.positionAccess === 'middle_only',
  }), [limits]);

  // Computed: formatted max contribution
  const maxContributionFormatted = useMemo(() => {
    if (limits.maxContributionCents === null) return 'Unlimited';
    if (limits.maxContributionCents === 0) return '$0';
    return `$${(limits.maxContributionCents / 100).toLocaleString()}/mo`;
  }, [limits]);

  // Computed: formatted max circle size
  const maxCircleSizeFormatted = useMemo(() => {
    if (limits.maxCircleSize === null) return 'Unlimited';
    if (limits.maxCircleSize === 0) return 'None';
    return `${limits.maxCircleSize} members`;
  }, [limits]);

  return {
    maxCircleSize: limits.maxCircleSize,
    maxContributionCents: limits.maxContributionCents,
    positionAccess: limits.positionAccess,
    positionRestrictions,
    maxContributionFormatted,
    maxCircleSizeFormatted,
    canJoinCircle,
    loading,
    error,
    refetch: fetchLimits,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  EntryTierKey,
  TierChangeType,
  FastTrackStatus,
  PositionAccess,
  TierDefinition,
  MemberTierStatus,
  TierHistoryEntry,
  FastTrackApplication,
  ActionItem,
  TierLimits,
  CircleJoinCheck,
  PositionRestrictions,
  TierEvalResult,
} from '@/services/GraduatedEntryEngine';
