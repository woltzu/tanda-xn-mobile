// ══════════════════════════════════════════════════════════════════════════════
// POSITION SWAP HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for the Position Swapping system
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  PositionSwapEngine,
  PositionSwapRequest,
  SwapEvent,
  MemberSwapHistory,
  CircleSwapConfig,
  CircleMemberForSwap,
  PendingSwapRequest,
  SwapAwaitingConfirmation,
  SwapPendingElderApproval,
  CircleSwapStatistics,
  SwapRequestStatus,
  CanSwapResult
} from '@/services/PositionSwapEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CONFIGURATION HOOKS                                                         │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get and update circle swap configuration
 */
export function useCircleSwapConfig(circleId: string | null) {
  const [config, setConfig] = useState<CircleSwapConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getCircleSwapConfig(circleId);
      setConfig(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (updates: Partial<CircleSwapConfig>) => {
    if (!circleId) return;

    setLoading(true);
    try {
      await PositionSwapEngine.updateCircleSwapConfig(circleId, {
        ...config,
        ...updates
      });
      await fetchConfig();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { config, loading, error, refetch: fetchConfig, updateConfig };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SWAP REQUEST HOOKS                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a single swap request with full details
 */
export function useSwapRequest(requestId: string | null) {
  const [request, setRequest] = useState<PositionSwapRequest | null>(null);
  const [events, setEvents] = useState<SwapEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError(null);

    try {
      const [requestData, eventsData] = await Promise.all([
        PositionSwapEngine.getSwapRequestFull(requestId),
        PositionSwapEngine.getSwapEvents(requestId)
      ]);
      setRequest(requestData);
      setEvents(eventsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!requestId) return;

    const requestSub = PositionSwapEngine.subscribeToSwapRequest(requestId, () => {
      fetchRequest();
    });

    const eventsSub = PositionSwapEngine.subscribeToSwapEvents(requestId, () => {
      fetchRequest();
    });

    return () => {
      requestSub.unsubscribe();
      eventsSub.unsubscribe();
    };
  }, [requestId, fetchRequest]);

  return { request, events, loading, error, refetch: fetchRequest };
}

/**
 * Hook for circle swap requests
 */
export function useCircleSwapRequests(circleId: string | null, status?: SwapRequestStatus) {
  const [requests, setRequests] = useState<PositionSwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getCircleSwapRequests(circleId, status);
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests };
}

/**
 * Hook for pending swap requests (where user is target)
 */
export function usePendingSwapRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingSwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getPendingSwapRequestsForUser();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const sub = PositionSwapEngine.subscribeToUserPendingSwaps(user.id, () => {
      fetchRequests();
    });

    return () => {
      sub.unsubscribe();
    };
  }, [user?.id, fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, count: requests.length };
}

/**
 * Hook for swap requests awaiting confirmation (where user is requester)
 */
export function useSwapRequestsAwaitingConfirmation() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<SwapAwaitingConfirmation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getSwapRequestsAwaitingConfirmation();
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, count: requests.length };
}

/**
 * Hook for swap requests pending Elder approval
 */
export function useSwapRequestsPendingElderApproval(circleId: string | null) {
  const [requests, setRequests] = useState<SwapPendingElderApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getSwapRequestsPendingElderApproval(circleId);
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests, count: requests.length };
}

/**
 * Hook for user's own swap requests (initiated by user)
 */
export function useMySwapRequests(status?: SwapRequestStatus) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PositionSwapRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getUserSwapRequests(status);
      setRequests(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refetch: fetchRequests };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SWAP ACTION HOOKS                                                           │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for swap request actions
 */
export function useSwapActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSwapRequest = async (
    circleId: string,
    targetUserId: string,
    reason?: string
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);

    try {
      const requestId = await PositionSwapEngine.createSwapRequest(
        circleId,
        targetUserId,
        reason
      );
      return requestId;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const respondToSwapRequest = async (
    requestId: string,
    accept: boolean,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await PositionSwapEngine.respondToSwapRequest(requestId, accept, reason);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const confirmSwapRequest = async (
    requestId: string,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await PositionSwapEngine.confirmSwapRequest(requestId, reason);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const elderDecideSwap = async (
    requestId: string,
    approve: boolean,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await PositionSwapEngine.elderDecideSwap(requestId, approve, reason);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const cancelSwapRequest = async (
    requestId: string,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      await PositionSwapEngine.cancelSwapRequest(requestId, reason);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createSwapRequest,
    respondToSwapRequest,
    confirmSwapRequest,
    elderDecideSwap,
    cancelSwapRequest,
    clearError: () => setError(null)
  };
}

/**
 * Hook to check if swap is allowed with a specific member
 */
export function useCanSwap(circleId: string | null, targetUserId: string | null) {
  const [canSwap, setCanSwap] = useState<CanSwapResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSwap = async () => {
      if (!circleId || !targetUserId) {
        setCanSwap(null);
        return;
      }

      setLoading(true);
      try {
        const result = await PositionSwapEngine.canRequestSwap(circleId, targetUserId);
        setCanSwap(result);
      } catch (err) {
        setCanSwap({ allowed: false, reason: 'Error checking swap availability' });
      } finally {
        setLoading(false);
      }
    };

    checkSwap();
  }, [circleId, targetUserId]);

  return { canSwap, loading };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MEMBER SELECTION HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get circle members available for swapping
 */
export function useCircleMembersForSwap(circleId: string | null) {
  const [members, setMembers] = useState<CircleMemberForSwap[]>([]);
  const [currentPosition, setCurrentPosition] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const [membersData, position] = await Promise.all([
        PositionSwapEngine.getCircleMembersForSwap(circleId),
        PositionSwapEngine.getCurrentUserPosition(circleId)
      ]);
      setMembers(membersData);
      setCurrentPosition(position);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const availableMembers = members.filter(m => m.can_swap_with);
  const unavailableMembers = members.filter(m => !m.can_swap_with);

  return {
    members,
    availableMembers,
    unavailableMembers,
    currentPosition,
    loading,
    error,
    refetch: fetchMembers
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ HISTORY & STATISTICS HOOKS                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for user's swap history
 */
export function useSwapHistory(userId?: string) {
  const { user } = useAuth();
  const [history, setHistory] = useState<MemberSwapHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getUserSwapHistory(targetUserId);
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const generousSwaps = history.filter(h => h.was_generous);
  const totalXnImpact = history.reduce((sum, h) => sum + h.xn_score_impact, 0);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
    generousSwaps,
    totalXnImpact,
    totalSwaps: history.length
  };
}

/**
 * Hook for circle swap history
 */
export function useCircleSwapHistory(circleId: string | null) {
  const [history, setHistory] = useState<MemberSwapHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getCircleSwapHistory(circleId);
      setHistory(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error, refetch: fetchHistory };
}

/**
 * Hook for circle swap statistics
 */
export function useCircleSwapStatistics(circleId: string | null) {
  const [statistics, setStatistics] = useState<CircleSwapStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await PositionSwapEngine.getCircleSwapStatistics(circleId);
      setStatistics(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return { statistics, loading, error, refetch: fetchStatistics };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ UTILITY HOOKS                                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to check if user has pending swaps in a circle
 */
export function useHasPendingSwaps(circleId: string | null) {
  const [hasPending, setHasPending] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!circleId) {
        setHasPending(false);
        return;
      }

      setLoading(true);
      try {
        const result = await PositionSwapEngine.hasPendingSwaps(circleId);
        setHasPending(result);
      } catch {
        setHasPending(false);
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [circleId]);

  return { hasPending, loading };
}

/**
 * Hook to get swap count this cycle for current user
 */
export function useSwapCountThisCycle(circleId: string | null) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      if (!circleId || !user) {
        setCount(0);
        return;
      }

      setLoading(true);
      try {
        const result = await PositionSwapEngine.getMemberSwapCountThisCycle(circleId);
        setCount(result);
      } catch {
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();
  }, [circleId, user]);

  return { count, loading };
}

/**
 * Hook for time remaining calculation (updates every minute)
 */
export function useTimeRemaining(expiresAt: string | null) {
  const [timeInfo, setTimeInfo] = useState<{
    hours: number;
    minutes: number;
    isExpired: boolean;
    formatted: string;
  } | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setTimeInfo(null);
      return;
    }

    const update = () => {
      setTimeInfo(PositionSwapEngine.getTimeRemaining(expiresAt));
    };

    update();
    const interval = setInterval(update, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt]);

  return timeInfo;
}

/**
 * Hook for cooling off period status
 */
export function useCoolingOffStatus(coolingOffEndsAt: string | null) {
  const [isComplete, setIsComplete] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!coolingOffEndsAt) {
      setIsComplete(true);
      setTimeRemaining(null);
      return;
    }

    const update = () => {
      const endTime = new Date(coolingOffEndsAt);
      const now = new Date();

      if (endTime <= now) {
        setIsComplete(true);
        setTimeRemaining(null);
      } else {
        setIsComplete(false);
        const diffMs = endTime.getTime() - now.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setTimeRemaining(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
      }
    };

    update();
    const interval = setInterval(update, 60000);

    return () => clearInterval(interval);
  }, [coolingOffEndsAt]);

  return { isComplete, timeRemaining };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD HOOK                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive hook for swap dashboard data
 */
export function useSwapDashboard() {
  const { user } = useAuth();
  const pendingForMe = usePendingSwapRequests();
  const awaitingConfirmation = useSwapRequestsAwaitingConfirmation();
  const myRequests = useMySwapRequests();
  const myHistory = useSwapHistory();

  const loading =
    pendingForMe.loading ||
    awaitingConfirmation.loading ||
    myRequests.loading ||
    myHistory.loading;

  const totalPendingActions = pendingForMe.count + awaitingConfirmation.count;

  const activeRequests = myRequests.requests.filter(r =>
    ['pending_target', 'pending_confirmation', 'pending_elder_approval', 'approved'].includes(r.swap_status)
  );

  return {
    user,
    loading,
    pendingForMe: pendingForMe.requests,
    pendingForMeCount: pendingForMe.count,
    awaitingConfirmation: awaitingConfirmation.requests,
    awaitingConfirmationCount: awaitingConfirmation.count,
    myRequests: myRequests.requests,
    activeRequests,
    history: myHistory.history,
    totalPendingActions,
    generousSwapsCount: myHistory.generousSwaps.length,
    totalXnImpact: myHistory.totalXnImpact,
    refetchAll: () => {
      pendingForMe.refetch();
      awaitingConfirmation.refetch();
      myRequests.refetch();
      myHistory.refetch();
    }
  };
}
