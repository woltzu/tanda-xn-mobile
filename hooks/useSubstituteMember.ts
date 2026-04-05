// ═══════════════════════════════════════════════════════════════════════════════
// useSubstituteMember.ts — #8 Substitute Member System Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 7 hooks:
//   usePoolEligibility     — check if member qualifies for substitute pool
//   usePoolEntry           — member's substitute pool entry + realtime
//   useExitEvaluation      — preview exit implications before submitting
//   useExitRequests        — member's exit requests + realtime
//   useSubstitutionOffer   — pending substitution offer for a substitute
//   useCircleSubstitutions — admin view of circle substitution activity
//   useSubstituteMemberActions — all mutation actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SubstituteMemberEngine,
  type PoolStatus,
  type ExitReasonCategory,
  type PayoutEntitlementStatus,
  type XnScoreImpact,
  type ExitRequestStatus,
  type SubstitutionStatus,
  type SubstitutePoolEntry,
  type CircleExitRequest,
  type SubstitutionRecord,
  type PoolEligibilityCheck,
  type ExitEvaluation,
  type MatchCandidate,
  type SubstitutionSummary,
} from '../services/SubstituteMemberEngine';

// Re-export types for consumers
export type {
  PoolStatus,
  ExitReasonCategory,
  PayoutEntitlementStatus,
  XnScoreImpact,
  ExitRequestStatus,
  SubstitutionStatus,
  SubstitutePoolEntry,
  CircleExitRequest,
  SubstitutionRecord,
  PoolEligibilityCheck,
  ExitEvaluation,
  MatchCandidate,
  SubstitutionSummary,
};


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: usePoolEligibility
// ─────────────────────────────────────────────────────────────────────────────

export function usePoolEligibility(userId?: string) {
  const [eligibility, setEligibility] = useState<PoolEligibilityCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkEligibility = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await SubstituteMemberEngine.checkPoolEligibility(userId);
      setEligibility(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  const computed = useMemo(() => ({
    eligible: eligibility?.eligible ?? false,
    reason: eligibility?.reason,
    xnScore: eligibility?.xnScore ?? 0,
    completedCircles: eligibility?.completedCircles ?? 0,
    meetsScoreRequirement: (eligibility?.xnScore ?? 0) >= 60,
    meetsCircleRequirement: (eligibility?.completedCircles ?? 0) >= 1,
  }), [eligibility]);

  return { eligibility, loading, error, refresh: checkEligibility, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: usePoolEntry
// ─────────────────────────────────────────────────────────────────────────────

export function usePoolEntry(userId?: string) {
  const [entry, setEntry] = useState<SubstitutePoolEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntry = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await SubstituteMemberEngine.getPoolEntry(userId);
      setEntry(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = SubstituteMemberEngine.subscribeToPoolEntry(userId, (updated) => {
      setEntry(updated);
    });
    return () => { channel.unsubscribe(); };
  }, [userId]);

  const computed = useMemo(() => ({
    isInPool: !!entry && entry.status !== 'removed',
    isActive: entry?.status === 'active',
    isStandby: entry?.status === 'standby',
    isSuspended: entry?.status === 'suspended',
    reliabilityScore: entry?.substituteReliabilityScore ?? 0,
    totalSubstitutions: entry?.totalSubstitutions ?? 0,
    successRate: entry && entry.totalSubstitutions > 0
      ? Math.round((entry.successfulSubstitutions / entry.totalSubstitutions) * 100)
      : 100,
    declinesRemaining: Math.max(0, 3 - (entry?.declineCount90d ?? 0)),
  }), [entry]);

  return { entry, loading, error, refresh: fetchEntry, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useExitEvaluation
// ─────────────────────────────────────────────────────────────────────────────

export function useExitEvaluation(userId?: string, circleId?: string) {
  const [evaluation, setEvaluation] = useState<ExitEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    if (!userId || !circleId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await SubstituteMemberEngine.evaluateExit(userId, circleId);
      setEvaluation(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, circleId]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  const computed = useMemo(() => ({
    hasPayoutImpact: evaluation?.payoutEntitlementStatus === 'pending_transfer',
    noXnScoreImpact: evaluation?.xnscoreImpact === 'none',
    completionPercentage: evaluation?.completionPercentage ?? 0,
    exitSettlementCents: evaluation?.originalMemberSettlementCents ?? 0,
    substituteReceivesCents: evaluation?.substituteShareCents ?? 0,
    insuranceReceivesCents: evaluation?.insurancePoolShareCents ?? 0,
    isCleanExit: evaluation?.payoutAlreadyReceived ?? false,
  }), [evaluation]);

  return { evaluation, loading, error, refresh: evaluate, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useExitRequests
// ─────────────────────────────────────────────────────────────────────────────

export function useExitRequests(userId?: string) {
  const [requests, setRequests] = useState<CircleExitRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await SubstituteMemberEngine.getMemberExitRequests(userId);
      setRequests(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = SubstituteMemberEngine.subscribeToExitRequests(userId, () => {
      fetchRequests();
    });
    return () => { channel.unsubscribe(); };
  }, [userId, fetchRequests]);

  const computed = useMemo(() => ({
    activeRequest: requests.find(r => ['pending', 'approved', 'matching', 'matched', 'substituted'].includes(r.status)),
    hasActiveRequest: requests.some(r => ['pending', 'approved', 'matching', 'matched', 'substituted'].includes(r.status)),
    completedRequests: requests.filter(r => r.status === 'completed'),
    totalRequests: requests.length,
  }), [requests]);

  return { requests, loading, error, refresh: fetchRequests, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useSubstitutionOffer
// ─────────────────────────────────────────────────────────────────────────────

export function useSubstitutionOffer(userId?: string) {
  const [offers, setOffers] = useState<SubstitutionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const history = await SubstituteMemberEngine.getSubstituteHistory(userId);
      setOffers(history);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = SubstituteMemberEngine.subscribeToSubstitutionOffers(userId, () => {
      fetchOffers();
    });
    return () => { channel.unsubscribe(); };
  }, [userId, fetchOffers]);

  const computed = useMemo(() => ({
    pendingOffer: offers.find(o => o.status === 'pending_confirmation'),
    hasPendingOffer: offers.some(o => o.status === 'pending_confirmation'),
    completedSubstitutions: offers.filter(o => o.status === 'completed').length,
    totalOffers: offers.length,
    hoursUntilDeadline: (() => {
      const pending = offers.find(o => o.status === 'pending_confirmation');
      if (!pending) return null;
      const deadline = new Date(pending.confirmationDeadline);
      return Math.max(0, Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60)));
    })(),
  }), [offers]);

  return { offers, loading, error, refresh: fetchOffers, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 6: useCircleSubstitutions
// ─────────────────────────────────────────────────────────────────────────────

export function useCircleSubstitutions(circleId?: string) {
  const [records, setRecords] = useState<SubstitutionRecord[]>([]);
  const [exitRequests, setExitRequests] = useState<CircleExitRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    setError(null);
    try {
      const [subs, exits] = await Promise.all([
        SubstituteMemberEngine.getCircleSubstitutionHistory(circleId),
        SubstituteMemberEngine.getCircleExitRequests(circleId),
      ]);
      setRecords(subs);
      setExitRequests(exits);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!circleId) return;
    const channel = SubstituteMemberEngine.subscribeToCircleSubstitutions(circleId, () => {
      fetchData();
    });
    return () => { channel.unsubscribe(); };
  }, [circleId, fetchData]);

  const computed = useMemo(() => ({
    pendingAdminApproval: records.filter(r => r.status === 'admin_pending'),
    hasPendingApprovals: records.some(r => r.status === 'admin_pending'),
    activeExitRequests: exitRequests.filter(r => ['pending', 'matching', 'matched'].includes(r.status)),
    completedSubstitutions: records.filter(r => r.status === 'completed').length,
    totalExitRequests: exitRequests.length,
  }), [records, exitRequests]);

  return { records, exitRequests, loading, error, refresh: fetchData, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 7: useSubstituteMemberActions
// ─────────────────────────────────────────────────────────────────────────────

export function useSubstituteMemberActions() {
  const [optingIn, setOptingIn] = useState(false);
  const [submittingExit, setSubmittingExit] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [declining, setDeclining] = useState(false);

  const optIntoPool = useCallback(async (
    userId: string,
    preferences?: {
      status?: PoolStatus;
      availabilityRadiusMiles?: number;
      maxContributionAmountCents?: number;
      preferredLanguages?: string[];
    }
  ) => {
    setOptingIn(true);
    try {
      return await SubstituteMemberEngine.optIntoPool(userId, preferences);
    } finally {
      setOptingIn(false);
    }
  }, []);

  const updatePreferences = useCallback(async (
    userId: string,
    preferences: {
      status?: PoolStatus;
      availabilityRadiusMiles?: number;
      maxContributionAmountCents?: number;
      preferredLanguages?: string[];
    }
  ) => {
    return SubstituteMemberEngine.updatePoolPreferences(userId, preferences);
  }, []);

  const leavePool = useCallback(async (userId: string) => {
    return SubstituteMemberEngine.leavePool(userId);
  }, []);

  const submitExitRequest = useCallback(async (
    userId: string,
    circleId: string,
    reasonCategory: ExitReasonCategory,
    reasonDetails?: string
  ) => {
    setSubmittingExit(true);
    try {
      return await SubstituteMemberEngine.submitExitRequest(userId, circleId, reasonCategory, reasonDetails);
    } finally {
      setSubmittingExit(false);
    }
  }, []);

  const cancelExitRequest = useCallback(async (exitRequestId: string, userId: string) => {
    return SubstituteMemberEngine.cancelExitRequest(exitRequestId, userId);
  }, []);

  const confirmSubstitution = useCallback(async (recordId: string, userId: string) => {
    setConfirming(true);
    try {
      return await SubstituteMemberEngine.confirmSubstitution(recordId, userId);
    } finally {
      setConfirming(false);
    }
  }, []);

  const declineSubstitution = useCallback(async (recordId: string, userId: string) => {
    setDeclining(true);
    try {
      return await SubstituteMemberEngine.declineSubstitution(recordId, userId);
    } finally {
      setDeclining(false);
    }
  }, []);

  const adminApprove = useCallback(async (recordId: string) => {
    return SubstituteMemberEngine.adminApproveSubstitution(recordId);
  }, []);

  const adminDecline = useCallback(async (recordId: string) => {
    return SubstituteMemberEngine.adminDeclineSubstitution(recordId);
  }, []);

  const getSubstitutionSummary = useCallback(async (recordId: string) => {
    return SubstituteMemberEngine.getSubstitutionSummary(recordId);
  }, []);

  return {
    // Pool actions
    optIntoPool,
    updatePreferences,
    leavePool,
    // Exit actions
    submitExitRequest,
    cancelExitRequest,
    // Substitution actions
    confirmSubstitution,
    declineSubstitution,
    adminApprove,
    adminDecline,
    getSubstitutionSummary,
    // Loading states
    optingIn,
    submittingExit,
    confirming,
    declining,
  };
}
