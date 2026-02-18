// ══════════════════════════════════════════════════════════════════════════════
// MEMBER REMOVAL HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for member removal mid-circle functionality
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  MemberRemovalEngine,
  MemberRemovalRequest,
  RemovalReason,
  RemovalStatus,
  RemovalVote,
  MemberDebt,
  DebtPayment,
  CircleRemovalSettings,
  CircleRemovalAudit,
  PayoutOrderAdjustment,
  MemberCirclePosition,
  SettlementCalculation,
  VoteType,
  DebtStatus
} from '@/services/MemberRemovalEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ REMOVAL REQUEST HOOKS                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a specific removal request with full details
 */
export function useRemovalRequest(requestId: string | null) {
  const [request, setRequest] = useState<MemberRemovalRequest | null>(null);
  const [votes, setVotes] = useState<RemovalVote[]>([]);
  const [settings, setSettings] = useState<CircleRemovalSettings | null>(null);
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!requestId) {
      setRequest(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const details = await MemberRemovalEngine.getRemovalRequestDetails(requestId);

      if (details) {
        setRequest(details.request);
        setVotes(details.votes);
        setSettings(details.settings);
        setMemberProfile(details.memberProfile);
      } else {
        setRequest(null);
      }
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Real-time subscription
  useEffect(() => {
    if (!requestId) return;

    const subscription = supabase
      .channel(`removal-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_removal_requests',
          filter: `id=eq.${requestId}`
        },
        () => fetchDetails()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'removal_votes',
          filter: `removal_request_id=eq.${requestId}`
        },
        () => fetchDetails()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [requestId, fetchDetails]);

  return {
    request,
    votes,
    settings,
    memberProfile,
    loading,
    error,
    refresh: fetchDetails
  };
}

/**
 * Hook to get all removal requests for a circle
 */
export function useCircleRemovalRequests(
  circleId: string | null,
  status?: RemovalStatus
) {
  const [requests, setRequests] = useState<MemberRemovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!circleId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await MemberRemovalEngine.getCircleRemovalRequests(circleId, status);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [circleId, status]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    if (!circleId) return;

    const subscription = supabase
      .channel(`circle-removals-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_removal_requests',
          filter: `circle_id=eq.${circleId}`
        },
        () => fetchRequests()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [circleId, fetchRequests]);

  return { requests, loading, error, refresh: fetchRequests };
}

/**
 * Hook to get active removal requests across all user's circles
 */
export function useActiveRemovalRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      setLoading(true);
      const data = await MemberRemovalEngine.getActiveRemovalRequests();
      setRequests(data);
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

  return { requests, loading, error, refresh: fetchActive };
}

/**
 * Hook to get user's removal history
 */
export function useUserRemovalHistory(userId: string | null) {
  const [history, setHistory] = useState<MemberRemovalRequest[]>([]);
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
        const data = await MemberRemovalEngine.getUserRemovalHistory(userId);
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
// │ REMOVAL PREVIEW & POSITION HOOKS                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get member's circle position
 */
export function useMemberCirclePosition(
  circleId: string | null,
  userId: string | null
) {
  const [position, setPosition] = useState<MemberCirclePosition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId || !userId) {
      setPosition(null);
      setLoading(false);
      return;
    }

    const fetchPosition = async () => {
      try {
        setLoading(true);
        const data = await MemberRemovalEngine.getMemberCirclePosition(circleId, userId);
        setPosition(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [circleId, userId]);

  return { position, loading, error };
}

/**
 * Hook to preview removal consequences
 */
export function useRemovalPreview(
  circleId: string | null,
  userId: string | null,
  reason: RemovalReason | null
) {
  const [preview, setPreview] = useState<{
    position: MemberCirclePosition | null;
    settlement: SettlementCalculation | null;
    willCreateDebt: boolean;
    willForfeit: boolean;
    estimatedXnScoreImpact: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId || !userId || !reason) {
      setPreview(null);
      setLoading(false);
      return;
    }

    const fetchPreview = async () => {
      try {
        setLoading(true);
        const data = await MemberRemovalEngine.previewRemoval(circleId, userId, reason);
        setPreview(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [circleId, userId, reason]);

  return { preview, loading, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ VOTING HOOKS                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for voting on a removal
 */
export function useRemovalVoting(requestId: string | null) {
  const [userVote, setUserVote] = useState<RemovalVote | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch user's current vote
  useEffect(() => {
    if (!requestId) {
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
          const vote = await MemberRemovalEngine.getUserVote(
            requestId,
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
  }, [requestId]);

  // Cast vote function
  const castVote = useCallback(
    async (vote: VoteType, reason?: string) => {
      if (!requestId) return false;

      try {
        setSubmitting(true);
        await MemberRemovalEngine.castVote(requestId, vote, reason);

        // Refresh user's vote
        const user = await supabase.auth.getUser();
        if (user.data.user) {
          const updatedVote = await MemberRemovalEngine.getUserVote(
            requestId,
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
    [requestId]
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
export function useRemovalVotingProgress(requestId: string | null) {
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
    if (!requestId) {
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await MemberRemovalEngine.getVotingProgress(requestId);
      setProgress(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchProgress();

    // Refresh every minute if voting is in progress
    const interval = setInterval(fetchProgress, 60000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  return { progress, loading, error, refresh: fetchProgress };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DEBT HOOKS                                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get user's debts
 */
export function useUserDebts(userId: string | null) {
  const [debts, setDebts] = useState<MemberDebt[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDebts = useCallback(async () => {
    if (!userId) {
      setDebts([]);
      setTotalOwed(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await MemberRemovalEngine.getUserDebts(userId);
      setDebts(data);
      setTotalOwed(data.reduce((sum, d) => sum + d.remaining_amount, 0));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  return { debts, totalOwed, loading, error, refresh: fetchDebts };
}

/**
 * Hook to get a specific debt with payment history
 */
export function useDebtDetails(debtId: string | null) {
  const [debt, setDebt] = useState<MemberDebt | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!debtId) {
      setDebt(null);
      setPayments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [debtData, paymentsData] = await Promise.all([
        MemberRemovalEngine.getDebt(debtId),
        MemberRemovalEngine.getDebtPayments(debtId)
      ]);
      setDebt(debtData);
      setPayments(paymentsData);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [debtId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { debt, payments, loading, error, refresh: fetchDetails };
}

/**
 * Hook to check if user has outstanding debts
 */
export function useHasOutstandingDebts(userId: string | null) {
  const [hasDebts, setHasDebts] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setHasDebts(false);
      setLoading(false);
      return;
    }

    const checkDebts = async () => {
      try {
        setLoading(true);
        const result = await MemberRemovalEngine.hasOutstandingDebts(userId);
        setHasDebts(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    checkDebts();
  }, [userId]);

  return { hasDebts, loading, error };
}

/**
 * Hook for debt payment actions
 */
export function useDebtPayment(debtId: string | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const makePayment = useCallback(
    async (
      amount: number,
      paymentMethod: string,
      paymentReference?: string
    ) => {
      if (!debtId) return null;

      try {
        setSubmitting(true);
        setError(null);
        const paymentId = await MemberRemovalEngine.makeDebtPayment(
          debtId,
          amount,
          paymentMethod,
          paymentReference
        );
        return paymentId;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [debtId]
  );

  const setupRepaymentPlan = useCallback(
    async (installments: number) => {
      if (!debtId) return null;

      try {
        setSubmitting(true);
        setError(null);
        const updatedDebt = await MemberRemovalEngine.setupRepaymentPlan(
          debtId,
          installments
        );
        return updatedDebt;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [debtId]
  );

  return { makePayment, setupRepaymentPlan, submitting, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ SETTINGS HOOKS                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get and manage circle removal settings
 */
export function useCircleRemovalSettings(circleId: string | null) {
  const [settings, setSettings] = useState<CircleRemovalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!circleId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await MemberRemovalEngine.getCircleRemovalSettings(circleId);
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<CircleRemovalSettings>) => {
      if (!circleId) return null;

      try {
        setSaving(true);
        setError(null);
        const updatedSettings = await MemberRemovalEngine.upsertCircleRemovalSettings({
          ...updates,
          circle_id: circleId
        });
        setSettings(updatedSettings);
        return updatedSettings;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [circleId]
  );

  return { settings, loading, saving, error, updateSettings, refresh: fetchSettings };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ AUDIT & HISTORY HOOKS                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get removal audit history for a circle
 */
export function useCircleRemovalAudit(circleId: string | null) {
  const [audit, setAudit] = useState<CircleRemovalAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId) {
      setAudit([]);
      setLoading(false);
      return;
    }

    const fetchAudit = async () => {
      try {
        setLoading(true);
        const data = await MemberRemovalEngine.getCircleRemovalAudit(circleId);
        setAudit(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [circleId]);

  return { audit, loading, error };
}

/**
 * Hook to get payout order adjustment history
 */
export function usePayoutOrderAdjustments(circleId: string | null) {
  const [adjustments, setAdjustments] = useState<PayoutOrderAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!circleId) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    const fetchAdjustments = async () => {
      try {
        setLoading(true);
        const data = await MemberRemovalEngine.getPayoutOrderAdjustments(circleId);
        setAdjustments(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdjustments();
  }, [circleId]);

  return { adjustments, loading, error };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ REMOVAL ACTIONS HOOK                                                        │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for removal actions (initiate, cancel)
 */
export function useRemovalActions() {
  const [initiating, setInitiating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if member can be removed
  const canRemove = useCallback(async (circleId: string, userId: string) => {
    try {
      return await MemberRemovalEngine.canMemberBeRemoved(circleId, userId);
    } catch (err) {
      setError(err as Error);
      return { canRemove: false, reason: 'Error checking removal status' };
    }
  }, []);

  // Get applicable removal reasons
  const getApplicableReasons = useCallback(
    async (circleId: string, userId: string, isElderInitiated: boolean) => {
      try {
        return await MemberRemovalEngine.getApplicableRemovalReasons(
          circleId,
          userId,
          isElderInitiated
        );
      } catch (err) {
        setError(err as Error);
        return [];
      }
    },
    []
  );

  // Initiate removal
  const initiateRemoval = useCallback(
    async (
      circleId: string,
      memberUserId: string,
      reason: RemovalReason,
      reasonDetails?: string
    ) => {
      try {
        setInitiating(true);
        setError(null);

        const requestId = await MemberRemovalEngine.initiateRemoval({
          circleId,
          memberUserId,
          reason,
          reasonDetails
        });

        return requestId;
      } catch (err) {
        setError(err as Error);
        return null;
      } finally {
        setInitiating(false);
      }
    },
    []
  );

  // Cancel removal
  const cancelRemoval = useCallback(
    async (requestId: string, reason: string) => {
      try {
        setCancelling(true);
        setError(null);

        const success = await MemberRemovalEngine.cancelRemovalRequest(
          requestId,
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
    canRemove,
    getApplicableReasons,
    initiateRemoval,
    cancelRemoval,
    initiating,
    cancelling,
    error
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ STATISTICS HOOK                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for removal statistics
 */
export function useRemovalStatistics() {
  const [statistics, setStatistics] = useState<
    {
      reason: RemovalReason;
      total_removals: number;
      completed_count: number;
      rejected_count: number;
      avg_settlement_amount: number;
      avg_exit_fee: number;
      avg_debt_created: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await MemberRemovalEngine.getRemovalStatistics();
        setStatistics(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { statistics, loading, error };
}
