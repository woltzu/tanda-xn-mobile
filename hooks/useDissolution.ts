// ══════════════════════════════════════════════════════════════════════════════
// DISSOLUTION HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for circle dissolution functionality
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DissolutionEngine,
  DissolutionRequest,
  DissolutionTrigger,
  DissolutionTriggerConfig,
  DissolutionStatus,
  DissolutionVote,
  DissolutionObjection,
  DissolutionMemberPosition,
  DissolutionEvent,
  VoteType,
  ObjectionType,
  MemberDissolutionSummary
} from '@/services/DissolutionEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DISSOLUTION REQUEST HOOKS                                                   │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a specific dissolution request with full details
 */
export function useDissolutionRequest(dissolutionId: string | null) {
  const [request, setRequest] = useState<DissolutionRequest | null>(null);
  const [config, setConfig] = useState<DissolutionTriggerConfig | null>(null);
  const [votes, setVotes] = useState<DissolutionVote[]>([]);
  const [objections, setObjections] = useState<DissolutionObjection[]>([]);
  const [positions, setPositions] = useState<DissolutionMemberPosition[]>([]);
  const [events, setEvents] = useState<DissolutionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!dissolutionId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const details = await DissolutionEngine.getDissolutionDetails(dissolutionId);

      if (details) {
        setRequest(details.request);
        setConfig(details.config);
        setVotes(details.votes);
        setObjections(details.objections);
        setPositions(details.positions);
        setEvents(details.events);
      } else {
        setRequest(null);
      }
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [dissolutionId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time subscription
  useEffect(() => {
    if (!dissolutionId) return;

    const subscription = supabase
      .channel(`dissolution-${dissolutionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dissolution_requests',
          filter: `id=eq.${dissolutionId}`
        },
        () => fetchDetails()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dissolution_votes',
          filter: `dissolution_request_id=eq.${dissolutionId}`
        },
        () => fetchDetails()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dissolution_objections',
          filter: `dissolution_request_id=eq.${dissolutionId}`
        },
        () => fetchDetails()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dissolutionId, fetchDetails]);

  return {
    request,
    config,
    votes,
    objections,
    positions,
    events,
    loading,
    error,
    refresh: fetchDetails
  };
}

/**
 * Hook to get all dissolutions for a circle
 */
export function useCircleDissolutions(
  circleId: string | null,
  status?: DissolutionStatus
) {
  const [dissolutions, setDissolutions] = useState<DissolutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDissolutions = useCallback(async () => {
    if (!circleId) {
      setDissolutions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await DissolutionEngine.getCircleDissolutions(circleId, status);
      setDissolutions(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [circleId, status]);

  useEffect(() => {
    fetchDissolutions();
  }, [fetchDissolutions]);

  // Real-time subscription
  useEffect(() => {
    if (!circleId) return;

    const subscription = supabase
      .channel(`circle-dissolutions-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dissolution_requests',
          filter: `circle_id=eq.${circleId}`
        },
        () => fetchDissolutions()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [circleId, fetchDissolutions]);

  return { dissolutions, loading, error, refresh: fetchDissolutions };
}

/**
 * Hook to get active dissolutions across all user's circles
 */
export function useActiveDissolutions() {
  const [dissolutions, setDissolutions] = useState<DissolutionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const data = await DissolutionEngine.getActiveDissolutions();
      setDissolutions(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  return { dissolutions, loading, error, refresh: fetchActive };
}

/**
 * Hook to get user's dissolution history
 */
export function useUserDissolutionHistory(userId: string | null) {
  const [history, setHistory] = useState<MemberDissolutionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getUserDissolutionHistory(userId);
        setHistory(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId]);

  return { history, loading, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ VOTING HOOKS                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for voting on a dissolution
 */
export function useDissolutionVoting(dissolutionId: string | null) {
  const [userVote, setUserVote] = useState<DissolutionVote | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user's current vote
  useEffect(() => {
    if (!dissolutionId) {
      setUserVote(null);
      setHasVoted(false);
      setLoading(false);
      return;
    }

    const fetchUserVote = async () => {
      try {
        setLoading(true);
        const user = await supabase.auth.getUser();
        if (user.data.user) {
          const vote = await DissolutionEngine.getUserVote(
            dissolutionId,
            user.data.user.id
          );
          setUserVote(vote);
          setHasVoted(vote !== null);
        }
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserVote();
  }, [dissolutionId]);

  // Cast vote function
  const castVote = useCallback(
    async (vote: VoteType, reason?: string) => {
      if (!dissolutionId) return false;

      try {
        setSubmitting(true);
        await DissolutionEngine.castVote(dissolutionId, vote, reason);

        // Refresh user's vote
        const user = await supabase.auth.getUser();
        if (user.data.user) {
          const updatedVote = await DissolutionEngine.getUserVote(
            dissolutionId,
            user.data.user.id
          );
          setUserVote(updatedVote);
          setHasVoted(true);
        }

        setError(null);
        return true;
      } catch (err) {
        setError(err as Error);
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [dissolutionId]
  );

  return {
    userVote,
    hasVoted,
    loading,
    submitting,
    error,
    castVote
  };
}

/**
 * Hook for voting progress
 */
export function useVotingProgress(dissolutionId: string | null) {
  const [progress, setProgress] = useState<{
    votesFor: number;
    votesAgainst: number;
    votesAbstain: number;
    totalVotesCast: number;
    totalEligible: number;
    participationRate: number;
    approvalRate: number;
    threshold: number;
    isThresholdMet: boolean;
    remainingTime?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!dissolutionId) {
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await DissolutionEngine.getVotingProgress(dissolutionId);
      setProgress(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [dissolutionId]);

  useEffect(() => {
    fetchProgress();

    // Refresh every minute if voting is in progress
    const interval = setInterval(fetchProgress, 60000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  return { progress, loading, error, refresh: fetchProgress };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ OBJECTION HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for managing objections
 */
export function useDissolutionObjections(dissolutionId: string | null) {
  const [objections, setObjections] = useState<DissolutionObjection[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchObjections = useCallback(async () => {
    if (!dissolutionId) {
      setObjections([]);
      setUnresolvedCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [objData, unresolvedData] = await Promise.all([
        DissolutionEngine.getDissolutionObjections(dissolutionId),
        DissolutionEngine.getUnresolvedObjectionsCount(dissolutionId)
      ]);
      setObjections(objData);
      setUnresolvedCount(unresolvedData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [dissolutionId]);

  useEffect(() => {
    fetchObjections();
  }, [fetchObjections]);

  // File objection
  const fileObjection = useCallback(
    async (
      objectionType: ObjectionType,
      description: string,
      evidenceUrls?: string[]
    ) => {
      if (!dissolutionId) return null;

      try {
        setSubmitting(true);
        const objectionId = await DissolutionEngine.fileObjection(
          dissolutionId,
          objectionType,
          description,
          evidenceUrls
        );
        await fetchObjections();
        setError(null);
        return objectionId;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [dissolutionId, fetchObjections]
  );

  return {
    objections,
    unresolvedCount,
    loading,
    submitting,
    error,
    fileObjection,
    refresh: fetchObjections
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MEMBER POSITION HOOKS                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get user's position in a dissolution
 */
export function useUserDissolutionPosition(
  dissolutionId: string | null,
  userId: string | null
) {
  const [position, setPosition] = useState<DissolutionMemberPosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dissolutionId || !userId) {
      setPosition(null);
      setLoading(false);
      return;
    }

    const fetchPosition = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getUserPosition(dissolutionId, userId);
        setPosition(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [dissolutionId, userId]);

  return { position, loading, error };
}

/**
 * Hook to get refund summary
 */
export function useRefundSummary(dissolutionId: string | null) {
  const [summary, setSummary] = useState<{
    totalPoolAmount: number;
    totalRefundAmount: number;
    platformFeeAmount: number;
    membersToRefund: number;
    refundsCompleted: number;
    refundsPending: number;
    refundsFailed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dissolutionId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getRefundSummary(dissolutionId);
        setSummary(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [dissolutionId]);

  return { summary, loading, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TIMELINE & EVENTS HOOK                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get dissolution timeline
 */
export function useDissolutionTimeline(dissolutionId: string | null) {
  const [timeline, setTimeline] = useState<
    {
      timestamp: string;
      eventType: string;
      description: string;
      actor?: string;
      actorType: string;
      data?: Record<string, any>;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!dissolutionId) {
      setTimeline([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await DissolutionEngine.getDissolutionTimeline(dissolutionId);
      setTimeline(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [dissolutionId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Real-time subscription for events
  useEffect(() => {
    if (!dissolutionId) return;

    const subscription = supabase
      .channel(`dissolution-events-${dissolutionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dissolution_events',
          filter: `dissolution_request_id=eq.${dissolutionId}`
        },
        () => fetchTimeline()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dissolutionId, fetchTimeline]);

  return { timeline, loading, error, refresh: fetchTimeline };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TRIGGER CONFIGURATION HOOKS                                                 │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get all dissolution trigger configurations
 */
export function useDissolutionTriggerConfigs() {
  const [configs, setConfigs] = useState<DissolutionTriggerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getTriggerConfigs();
        setConfigs(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  return { configs, loading, error };
}

/**
 * Hook to get applicable triggers for a circle
 */
export function useApplicableTriggers(circleId: string | null) {
  const [triggers, setTriggers] = useState<DissolutionTriggerConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId) {
      setTriggers([]);
      setLoading(false);
      return;
    }

    const fetchTriggers = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getApplicableTriggers(circleId);
        setTriggers(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTriggers();
  }, [circleId]);

  return { triggers, loading, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DISSOLUTION ACTIONS HOOK                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for dissolution actions (initiate, cancel)
 */
export function useDissolutionActions() {
  const [initiating, setInitiating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if circle can be dissolved
  const canDissolve = useCallback(async (circleId: string) => {
    try {
      return await DissolutionEngine.canCircleBeDissolve(circleId);
    } catch (err) {
      setError(err as Error);
      return { canDissolve: false, reason: 'Error checking dissolution status' };
    }
  }, []);

  // Initiate dissolution
  const initiateDissolution = useCallback(
    async (
      circleId: string,
      triggerType: DissolutionTrigger,
      reason: string,
      evidenceUrls?: string[]
    ) => {
      try {
        setInitiating(true);
        setError(null);

        const dissolutionId = await DissolutionEngine.initiateDissolution({
          circleId,
          triggerType,
          reason,
          evidenceUrls
        });

        return dissolutionId;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setInitiating(false);
      }
    },
    []
  );

  // Cancel dissolution
  const cancelDissolution = useCallback(
    async (dissolutionId: string, reason: string) => {
      try {
        setCancelling(true);
        setError(null);

        const success = await DissolutionEngine.cancelDissolution(
          dissolutionId,
          reason
        );

        return success;
      } catch (err) {
        setError(err as Error);
        return false;
      } finally {
        setCancelling(false);
      }
    },
    []
  );

  return {
    canDissolve,
    initiateDissolution,
    cancelDissolution,
    initiating,
    cancelling,
    error
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ANALYTICS HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for dissolution analytics
 */
export function useDissolutionAnalytics() {
  const [analytics, setAnalytics] = useState<
    {
      trigger_type: DissolutionTrigger;
      total_requests: number;
      completed_count: number;
      rejected_count: number;
      cancelled_count: number;
      avg_pool_amount: number;
      avg_refund_amount: number;
      avg_resolution_hours: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getAnalytics();
        setAnalytics(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  return { analytics, loading, error };
}

/**
 * Hook for dissolution statistics over a time period
 */
export function useDissolutionStats(startDate: Date, endDate: Date) {
  const [stats, setStats] = useState<{
    totalDissolutions: number;
    completedDissolutions: number;
    rejectedDissolutions: number;
    cancelledDissolutions: number;
    totalRefunded: number;
    totalPlatformFees: number;
    byTriggerType: Record<DissolutionTrigger, number>;
    byTier: Record<string, number>;
    avgResolutionTimeHours: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await DissolutionEngine.getDissolutionStats(startDate, endDate);
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [startDate, endDate]);

  return { stats, loading, error };
}
