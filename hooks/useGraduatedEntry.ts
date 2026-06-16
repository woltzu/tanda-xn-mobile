// ══════════════════════════════════════════════════════════════════════════════
// GRADUATED ENTRY HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the Graduated Entry System.
// Member tier status, progression tracking, limits, fast-track workflow.
// Follows useHonorScore.ts / useMemberRemoval.ts patterns.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
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
// │ MODULE-LEVEL TIER CACHE (Bucket B)                                          │
// └─────────────────────────────────────────────────────────────────────────────┘
//
// Every screen that calls useMemberTier() used to refetch + re-subscribe
// to realtime on its own — switching screens or mounting a hub that
// rendered two consumers (Dashboard tier card + tier explain sheet)
// fired two RPCs. Same pattern we used for useAdvanceDashboard: a
// process-wide Map cache keyed by userId with a 5-min TTL.
//
// Cache busts when:
//   - realtime subscription fires a tier change (handled inline below)
//   - the tier-change notification trigger fires (caller imports
//     `bustTierCache` and clears it after handling the notification)
//   - the user pulls-to-refresh (calls hook.refetch / hook.refresh)
//
// TTL is the same 5-min window the dashboard / advance hooks use. Any
// realtime tier change invalidates instantly via the Supabase subscription
// in useMemberTier, so a stale read window is bounded by transient
// network gaps, not by the TTL.

const TIER_CACHE_TTL_MS = 5 * 60 * 1000;
const tierCache = new Map<string, { data: MemberTierStatus; fetchedAt: number }>();

/**
 * Clear the cache so the next useMemberTier() mount or refetch lands fresh.
 * Pass a userId to evict only that entry; omit to clear everything.
 *
 * Used by:
 *   - useMemberTier itself on realtime tier-change events
 *   - any caller that knows the user's tier has changed (e.g., after
 *     consuming a `tier_change` notification from the inbox)
 */
export function bustTierCache(userId?: string) {
  if (userId) tierCache.delete(userId);
  else tierCache.clear();
}

function readTierCache(userId: string): MemberTierStatus | null {
  const entry = tierCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= TIER_CACHE_TTL_MS) {
    tierCache.delete(userId);
    return null;
  }
  return entry.data;
}

function writeTierCache(userId: string, data: MemberTierStatus | null) {
  if (!data) return;
  tierCache.set(userId, { data, fetchedAt: Date.now() });
}


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

  // Seed initial state from the cache if a fresh entry exists. Avoids a
  // null-flash + skeleton render when switching between screens.
  const [status, setStatus] = useState<MemberTierStatus | null>(() => {
    if (!targetId) return null;
    return readTierCache(targetId);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (opts?: { force?: boolean }) => {
    if (!targetId) return;

    // Cache hit path. Skip the RPC entirely when the cached entry is fresh
    // and the caller hasn't requested a forced refresh.
    if (!opts?.force) {
      const cached = readTierCache(targetId);
      if (cached) {
        setStatus(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const data = await GraduatedEntryEngine.getMemberTierStatus(targetId);
      writeTierCache(targetId, data);
      setStatus(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  /**
   * Force a refetch from the server. Bypasses the cache. Used by
   * pull-to-refresh and by any caller that knows the data is stale.
   */
  const refresh = useCallback(async () => {
    if (!targetId) return;
    bustTierCache(targetId);
    await fetchStatus({ force: true });
  }, [targetId, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription — bust the cache BEFORE refetching so the
  // refetch path doesn't see the now-stale cached entry.
  useEffect(() => {
    if (!targetId) return;

    const subscription = GraduatedEntryEngine.subscribeToTierChanges(
      targetId,
      () => {
        bustTierCache(targetId);
        fetchStatus({ force: true });
      },
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
    refresh,
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
