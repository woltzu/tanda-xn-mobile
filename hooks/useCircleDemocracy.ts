// ══════════════════════════════════════════════════════════════════════════════
// CIRCLE DEMOCRACY HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for structured collective decision-making within circles.
// Propose → Notify → Vote → Tally → Record.
// Follows useHonorScore.ts / useMemberRemoval.ts patterns.
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  CircleDemocracyEngine,
  GovernanceSettings,
  CircleProposal,
  ProposalVote,
  ProposalType,
  ProposalStatus,
  VoteChoice,
  VotingProgress,
  CastVoteResult,
} from '@/services/CircleDemocracyEngine';


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PROPOSALS LIST HOOK                                                         │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to list proposals for a circle with realtime updates.
 */
export function useCircleProposals(circleId?: string, status?: ProposalStatus) {
  const [proposals, setProposals] = useState<CircleProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await CircleDemocracyEngine.getProposals(circleId, status);
      setProposals(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, status]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Realtime subscription
  useEffect(() => {
    if (!circleId) return;

    const subscription = CircleDemocracyEngine.subscribeToProposals(
      circleId,
      () => { fetchProposals(); }
    );

    return () => { subscription.unsubscribe(); };
  }, [circleId, fetchProposals]);

  // Computed: active proposals
  const activeProposals = useMemo(
    () => proposals.filter(p => p.status === 'open'),
    [proposals]
  );

  // Computed: closed proposals
  const closedProposals = useMemo(
    () => proposals.filter(p => p.status === 'closed' || p.status === 'executed'),
    [proposals]
  );

  return {
    proposals,
    activeProposals,
    closedProposals,
    loading,
    error,
    refetch: fetchProposals,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PROPOSAL DETAIL HOOK                                                        │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get a single proposal with its votes, voting progress, and user's vote.
 */
export function useProposalDetail(proposalId?: string) {
  const { user } = useAuth();
  const [proposal, setProposal] = useState<CircleProposal | null>(null);
  const [votes, setVotes] = useState<ProposalVote[]>([]);
  const [myVote, setMyVote] = useState<ProposalVote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!proposalId) return;

    setLoading(true);
    setError(null);

    try {
      const [proposalData, votesData, myVoteData] = await Promise.all([
        CircleDemocracyEngine.getProposal(proposalId),
        CircleDemocracyEngine.getVotes(proposalId),
        CircleDemocracyEngine.getMyVote(proposalId),
      ]);

      setProposal(proposalData);
      setVotes(votesData);
      setMyVote(myVoteData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Realtime: subscribe to proposal changes
  useEffect(() => {
    if (!proposal?.circleId) return;

    const subscription = CircleDemocracyEngine.subscribeToProposals(
      proposal.circleId,
      () => { fetchDetail(); }
    );

    return () => { subscription.unsubscribe(); };
  }, [proposal?.circleId, fetchDetail]);

  // Realtime: subscribe to vote changes
  useEffect(() => {
    if (!proposalId) return;

    const subscription = CircleDemocracyEngine.subscribeToVotes(
      proposalId,
      () => { fetchDetail(); }
    );

    return () => { subscription.unsubscribe(); };
  }, [proposalId, fetchDetail]);

  // Computed: voting progress
  const votingProgress = useMemo((): VotingProgress | null => {
    if (!proposal) return null;
    return CircleDemocracyEngine.getVotingProgress(proposal);
  }, [proposal]);

  // Computed: has user voted
  const hasVoted = useMemo(() => !!myVote, [myVote]);

  // Computed: is voting open
  const isVotingOpen = useMemo(() => {
    if (!proposal) return false;
    if (proposal.status !== 'open') return false;
    if (proposal.votingEndsAt && new Date(proposal.votingEndsAt) <= new Date()) return false;
    return true;
  }, [proposal]);

  // Computed: proposal type info
  const typeInfo = useMemo(() => {
    if (!proposal) return null;
    return CircleDemocracyEngine.getProposalTypeInfo(proposal.proposalType);
  }, [proposal]);

  return {
    proposal,
    votes,
    myVote,
    votingProgress,
    hasVoted,
    isVotingOpen,
    typeInfo,
    loading,
    error,
    refetch: fetchDetail,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CAST VOTE HOOK                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for casting votes on proposals.
 */
export function useCastVote() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CastVoteResult | null>(null);

  const castVote = async (
    proposalId: string,
    vote: VoteChoice,
    reasoning?: string
  ): Promise<CastVoteResult | null> => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await CircleDemocracyEngine.castVote(proposalId, vote, reasoning);
      setResult(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    castVote,
    loading,
    error,
    result,
    clearError: () => setError(null),
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CREATE PROPOSAL HOOK                                                        │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook for creating and opening proposals.
 */
export function useCreateProposal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProposal = async (
    circleId: string,
    proposalType: ProposalType,
    title: string,
    description?: string,
    payload?: Record<string, any>
  ): Promise<CircleProposal | null> => {
    setLoading(true);
    setError(null);

    try {
      const proposal = await CircleDemocracyEngine.createProposal(
        circleId, proposalType, title, description, payload
      );
      return proposal;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createAndOpen = async (
    circleId: string,
    proposalType: ProposalType,
    title: string,
    description?: string,
    payload?: Record<string, any>
  ): Promise<CircleProposal | null> => {
    setLoading(true);
    setError(null);

    try {
      const proposal = await CircleDemocracyEngine.createProposal(
        circleId, proposalType, title, description, payload
      );
      if (!proposal) throw new Error('Failed to create proposal');

      const opened = await CircleDemocracyEngine.openProposal(proposal.id);
      return opened;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const openProposal = async (proposalId: string): Promise<CircleProposal | null> => {
    setLoading(true);
    setError(null);

    try {
      const opened = await CircleDemocracyEngine.openProposal(proposalId);
      return opened;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const cancelProposal = async (proposalId: string): Promise<CircleProposal | null> => {
    setLoading(true);
    setError(null);

    try {
      const cancelled = await CircleDemocracyEngine.cancelProposal(proposalId);
      return cancelled;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    createProposal,
    createAndOpen,
    openProposal,
    cancelProposal,
    loading,
    error,
    clearError: () => setError(null),
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ GOVERNANCE SETTINGS HOOK                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get and update governance settings for a circle.
 */
export function useCircleGovernance(circleId?: string) {
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canPropose, setCanPropose] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!circleId) return;

    setLoading(true);
    setError(null);

    try {
      const [data, canCreate] = await Promise.all([
        CircleDemocracyEngine.getGovernanceSettings(circleId),
        CircleDemocracyEngine.canUserPropose(circleId),
      ]);
      setSettings(data);
      setCanPropose(canCreate);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (
    updates: Partial<Omit<GovernanceSettings, 'id' | 'circleId' | 'createdAt' | 'updatedAt'>>
  ): Promise<GovernanceSettings | null> => {
    if (!circleId) return null;

    setLoading(true);
    setError(null);

    try {
      const updated = await CircleDemocracyEngine.updateGovernanceSettings(circleId, updates);
      if (updated) setSettings(updated);
      return updated;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    canPropose,
    loading,
    error,
    updateSettings,
    refetch: fetchSettings,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  GovernanceSettings,
  CircleProposal,
  ProposalVote,
  ProposalType,
  ProposalStatus,
  ProposalResult,
  VoteChoice,
  VotingProgress,
  CastVoteResult,
  ProposalTypeInfo,
  ProposalPermission,
} from '@/services/CircleDemocracyEngine';
