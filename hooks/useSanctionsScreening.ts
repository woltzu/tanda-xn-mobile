/**
 * ══════════════════════════════════════════════════════════════════════════════
 * SANCTIONS SCREENING HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the sanctions screening engine.
 * 5 hooks: useMemberScreeningStatus, useMemberScreenHistory, useReviewQueue,
 *          useScreeningStats, useScreeningActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  SanctionsScreeningEngine,
  type ScreenType,
  type ListSource,
  type ScreenResult,
  type MatchType,
  type ReviewStatus,
  type ReviewPriority,
  type SanctionsStatus,
  type Resolution,
  type SanctionsScreen,
  type SanctionsMatch,
  type ReviewQueueItem,
  type ListUpdate,
  type ScreenMemberResult,
  type BatchScreenResult,
  type ScreeningStats,
} from '@/services/SanctionsScreeningEngine';

// Re-export all types for consumer convenience
export type {
  ScreenType,
  ListSource,
  ScreenResult,
  MatchType,
  ReviewStatus,
  ReviewPriority,
  SanctionsStatus,
  Resolution,
  SanctionsScreen,
  SanctionsMatch,
  ReviewQueueItem,
  ListUpdate,
  ScreenMemberResult,
  BatchScreenResult,
  ScreeningStats,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useMemberScreeningStatus — Member's current sanctions status
// ═══════════════════════════════════════════════════════════════════════════════

export function useMemberScreeningStatus(userId?: string) {
  const [sanctionsStatus, setSanctionsStatus] = useState<SanctionsStatus | null>(null);
  const [lastScreen, setLastScreen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setSanctionsStatus(null);
      setLastScreen(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await SanctionsScreeningEngine.getMemberSanctionsStatus(userId);
      setSanctionsStatus(result.sanctionsStatus);
      setLastScreen(result.lastScreen);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sanctions status');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription on profiles table
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`sanctions-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => { fetchStatus(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchStatus]);

  // Computed values
  const isClear = useMemo(() => sanctionsStatus === 'clear', [sanctionsStatus]);
  const isBlocked = useMemo(() => sanctionsStatus === 'blocked', [sanctionsStatus]);
  const isUnderReview = useMemo(() => sanctionsStatus === 'under_review', [sanctionsStatus]);

  return {
    sanctionsStatus,
    lastScreen,
    loading,
    error,
    refetch: fetchStatus,
    isClear,
    isBlocked,
    isUnderReview,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useMemberScreenHistory — Past screening results for a member
// ═══════════════════════════════════════════════════════════════════════════════

export function useMemberScreenHistory(userId?: string) {
  const [screens, setScreens] = useState<SanctionsScreen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScreens = useCallback(async () => {
    if (!userId) {
      setScreens([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await SanctionsScreeningEngine.getMemberScreenHistory(userId);
      setScreens(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch screen history');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchScreens();
  }, [fetchScreens]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = SanctionsScreeningEngine.subscribeToMemberScreens(userId, () => {
      fetchScreens();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchScreens]);

  // Computed
  const latestScreen = useMemo(() => screens[0] || null, [screens]);
  const totalScreens = useMemo(() => screens.length, [screens]);
  const hasMatches = useMemo(() => screens.some(s => s.matchCount > 0), [screens]);

  return {
    screens,
    loading,
    error,
    refetch: fetchScreens,
    latestScreen,
    totalScreens,
    hasMatches,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useReviewQueue — Sanctions review queue for reviewers
// ═══════════════════════════════════════════════════════════════════════════════

export function useReviewQueue(
  filters?: { status?: ReviewStatus; priority?: ReviewPriority }
) {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SanctionsScreeningEngine.getReviewQueue(filters);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch review queue');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.priority]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    const channel = SanctionsScreeningEngine.subscribeToReviewQueue(() => {
      fetchQueue();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  // Computed
  const pendingCount = useMemo(
    () => items.filter(i => i.status === 'pending').length,
    [items]
  );

  const criticalCount = useMemo(
    () => items.filter(i => i.priority === 'critical' && i.status !== 'resolved').length,
    [items]
  );

  const assignedCount = useMemo(
    () => items.filter(i => i.status === 'assigned').length,
    [items]
  );

  return {
    items,
    loading,
    error,
    refetch: fetchQueue,
    pendingCount,
    criticalCount,
    assignedCount,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useScreeningStats — Aggregate screening statistics
// ═══════════════════════════════════════════════════════════════════════════════

export function useScreeningStats() {
  const [stats, setStats] = useState<ScreeningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SanctionsScreeningEngine.getScreeningStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch screening stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useScreeningActions — Action callbacks for triggering operations
// ═══════════════════════════════════════════════════════════════════════════════

export function useScreeningActions() {
  const [screeningLoading, setScreeningLoading] = useState(false);
  const [resolvingLoading, setResolvingLoading] = useState(false);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [updatingStatusLoading, setUpdatingStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const screenMember = useCallback(async (
    userId: string,
    screenType: ScreenType
  ): Promise<ScreenMemberResult | null> => {
    try {
      setScreeningLoading(true);
      setError(null);
      return await SanctionsScreeningEngine.screenMember(userId, screenType);
    } catch (err: any) {
      setError(err.message || 'Failed to screen member');
      return null;
    } finally {
      setScreeningLoading(false);
    }
  }, []);

  const resolveReview = useCallback(async (
    reviewId: string,
    resolution: Resolution,
    notes: string
  ): Promise<boolean> => {
    try {
      setResolvingLoading(true);
      setError(null);
      await SanctionsScreeningEngine.resolveReview(reviewId, resolution, notes);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to resolve review');
      return false;
    } finally {
      setResolvingLoading(false);
    }
  }, []);

  const assignReview = useCallback(async (
    reviewId: string,
    assigneeId: string
  ): Promise<boolean> => {
    try {
      setAssigningLoading(true);
      setError(null);
      await SanctionsScreeningEngine.assignReview(reviewId, assigneeId);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to assign review');
      return false;
    } finally {
      setAssigningLoading(false);
    }
  }, []);

  const updateMemberStatus = useCallback(async (
    userId: string,
    status: SanctionsStatus
  ): Promise<boolean> => {
    try {
      setUpdatingStatusLoading(true);
      setError(null);
      await SanctionsScreeningEngine.updateMemberSanctionsStatus(userId, status);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update member status');
      return false;
    } finally {
      setUpdatingStatusLoading(false);
    }
  }, []);

  return {
    screenMember,
    resolveReview,
    assignReview,
    updateMemberStatus,
    screeningLoading,
    resolvingLoading,
    assigningLoading,
    updatingStatusLoading,
    error,
  };
}
