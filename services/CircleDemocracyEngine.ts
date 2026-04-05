// ══════════════════════════════════════════════════════════════════════════════
// CIRCLE DEMOCRACY ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// Static class for structured collective decision-making within circles.
// Propose → Notify → Vote → Tally → Record.
// Governance settings per circle: quorum, threshold, voting period, weighted voting.
// Follows HonorScoreEngine.ts pattern with camelCase mapped types.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { DynamicPayoutOrderingEngine } from './DynamicPayoutOrderingEngine';


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type ProposalType =
  | 'admit_member'
  | 'remove_member'
  | 'change_payout_order'
  | 'change_rules'
  | 'resolve_dispute'
  | 'dissolve_circle'
  | 'custom'
  | 'pool_rollover';

export type ProposalStatus = 'draft' | 'open' | 'closed' | 'cancelled' | 'executed';

export type ProposalResult = 'approved' | 'rejected' | 'no_quorum';

export type VoteChoice = 'yes' | 'no' | 'abstain';

export type ProposalPermission = 'creator_only' | 'admins_only' | 'any_member';

export interface GovernanceSettings {
  id: string;
  circleId: string;
  proposalPermission: ProposalPermission;
  defaultQuorumPct: number;
  defaultThresholdPct: number;
  criticalThresholdPct: number;
  defaultVotingHours: number;
  enableWeightedVoting: boolean;
  creatorVoteWeight: number;
  adminVoteWeight: number;
  allowVoteChange: boolean;
  closeOnAllVoted: boolean;
  autoExecuteApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CircleProposal {
  id: string;
  circleId: string;
  proposerId: string;
  proposalType: ProposalType;
  title: string;
  description: string | null;
  proposalPayload: Record<string, any>;
  status: ProposalStatus;
  votingStartsAt: string | null;
  votingEndsAt: string | null;
  quorumPct: number;
  thresholdPct: number;
  eligibleVoters: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVoteWeight: number;
  weightFor: number;
  weightAgainst: number;
  result: ProposalResult | null;
  resultReason: string | null;
  closedAt: string | null;
  executedAt: string | null;
  executedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalVote {
  id: string;
  proposalId: string;
  voterId: string;
  vote: VoteChoice;
  voteWeight: number;
  reasoning: string | null;
  votedAt: string;
  updatedAt: string;
}

export interface VotingProgress {
  totalEligible: number;
  totalVoted: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  quorumMet: boolean;
  thresholdMet: boolean;
  percentFor: number;
  percentVoted: number;
  timeRemaining: number | null; // milliseconds, null if no deadline
}

export interface CastVoteResult {
  success: boolean;
  vote: VoteChoice;
  weight: number;
  earlyClose: boolean;
  result?: ProposalResult;
}

export interface ProposalTypeInfo {
  type: ProposalType;
  label: string;
  description: string;
  isCritical: boolean;
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MAPPERS                                                                     │
// └─────────────────────────────────────────────────────────────────────────────┘

function mapGovernanceSettings(row: any): GovernanceSettings {
  return {
    id: row.id,
    circleId: row.circle_id,
    proposalPermission: row.proposal_permission || 'any_member',
    defaultQuorumPct: parseFloat(row.default_quorum_pct) || 0.50,
    defaultThresholdPct: parseFloat(row.default_threshold_pct) || 0.60,
    criticalThresholdPct: parseFloat(row.critical_threshold_pct) || 0.75,
    defaultVotingHours: parseInt(row.default_voting_hours) || 48,
    enableWeightedVoting: row.enable_weighted_voting || false,
    creatorVoteWeight: parseFloat(row.creator_vote_weight) || 1.00,
    adminVoteWeight: parseFloat(row.admin_vote_weight) || 1.00,
    allowVoteChange: row.allow_vote_change || false,
    closeOnAllVoted: row.close_on_all_voted ?? true,
    autoExecuteApproved: row.auto_execute_approved || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProposal(row: any): CircleProposal {
  return {
    id: row.id,
    circleId: row.circle_id,
    proposerId: row.proposer_id,
    proposalType: row.proposal_type,
    title: row.title,
    description: row.description,
    proposalPayload: row.proposal_payload || {},
    status: row.status,
    votingStartsAt: row.voting_starts_at,
    votingEndsAt: row.voting_ends_at,
    quorumPct: parseFloat(row.quorum_pct) || 0.50,
    thresholdPct: parseFloat(row.threshold_pct) || 0.60,
    eligibleVoters: parseInt(row.eligible_voters) || 0,
    votesFor: parseInt(row.votes_for) || 0,
    votesAgainst: parseInt(row.votes_against) || 0,
    votesAbstain: parseInt(row.votes_abstain) || 0,
    totalVoteWeight: parseFloat(row.total_vote_weight) || 0,
    weightFor: parseFloat(row.weight_for) || 0,
    weightAgainst: parseFloat(row.weight_against) || 0,
    result: row.result,
    resultReason: row.result_reason,
    closedAt: row.closed_at,
    executedAt: row.executed_at,
    executedBy: row.executed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVote(row: any): ProposalVote {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    voterId: row.voter_id,
    vote: row.vote,
    voteWeight: parseFloat(row.vote_weight) || 1.00,
    reasoning: row.reasoning,
    votedAt: row.voted_at,
    updatedAt: row.updated_at,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DEFAULTS                                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

const DEFAULT_GOVERNANCE: Omit<GovernanceSettings, 'id' | 'circleId' | 'createdAt' | 'updatedAt'> = {
  proposalPermission: 'any_member',
  defaultQuorumPct: 0.50,
  defaultThresholdPct: 0.60,
  criticalThresholdPct: 0.75,
  defaultVotingHours: 48,
  enableWeightedVoting: false,
  creatorVoteWeight: 1.00,
  adminVoteWeight: 1.00,
  allowVoteChange: false,
  closeOnAllVoted: true,
  autoExecuteApproved: false,
};

const CRITICAL_PROPOSAL_TYPES: ProposalType[] = ['dissolve_circle', 'remove_member'];


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ENGINE                                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

export class CircleDemocracyEngine {

  // ── Governance Settings ──────────────────────────────────────────────────

  /**
   * Get governance settings for a circle. Returns defaults if none exist.
   */
  static async getGovernanceSettings(circleId: string): Promise<GovernanceSettings> {
    const { data, error } = await supabase
      .from('circle_governance_settings')
      .select('*')
      .eq('circle_id', circleId)
      .maybeSingle();

    if (error || !data) {
      // Return defaults with placeholder values
      return {
        id: '',
        circleId,
        ...DEFAULT_GOVERNANCE,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    return mapGovernanceSettings(data);
  }

  /**
   * Update governance settings for a circle (upsert).
   */
  static async updateGovernanceSettings(
    circleId: string,
    updates: Partial<Omit<GovernanceSettings, 'id' | 'circleId' | 'createdAt' | 'updatedAt'>>
  ): Promise<GovernanceSettings | null> {
    // Map camelCase to snake_case for DB
    const dbUpdates: Record<string, any> = {};
    if (updates.proposalPermission !== undefined) dbUpdates.proposal_permission = updates.proposalPermission;
    if (updates.defaultQuorumPct !== undefined) dbUpdates.default_quorum_pct = updates.defaultQuorumPct;
    if (updates.defaultThresholdPct !== undefined) dbUpdates.default_threshold_pct = updates.defaultThresholdPct;
    if (updates.criticalThresholdPct !== undefined) dbUpdates.critical_threshold_pct = updates.criticalThresholdPct;
    if (updates.defaultVotingHours !== undefined) dbUpdates.default_voting_hours = updates.defaultVotingHours;
    if (updates.enableWeightedVoting !== undefined) dbUpdates.enable_weighted_voting = updates.enableWeightedVoting;
    if (updates.creatorVoteWeight !== undefined) dbUpdates.creator_vote_weight = updates.creatorVoteWeight;
    if (updates.adminVoteWeight !== undefined) dbUpdates.admin_vote_weight = updates.adminVoteWeight;
    if (updates.allowVoteChange !== undefined) dbUpdates.allow_vote_change = updates.allowVoteChange;
    if (updates.closeOnAllVoted !== undefined) dbUpdates.close_on_all_voted = updates.closeOnAllVoted;
    if (updates.autoExecuteApproved !== undefined) dbUpdates.auto_execute_approved = updates.autoExecuteApproved;

    const { data, error } = await supabase
      .from('circle_governance_settings')
      .upsert({
        circle_id: circleId,
        ...dbUpdates,
      }, { onConflict: 'circle_id' })
      .select()
      .single();

    if (error || !data) return null;
    return mapGovernanceSettings(data);
  }


  // ── Proposals ────────────────────────────────────────────────────────────

  /**
   * List proposals for a circle, optionally filtered by status.
   */
  static async getProposals(
    circleId: string,
    status?: ProposalStatus
  ): Promise<CircleProposal[]> {
    let query = supabase
      .from('circle_proposals')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapProposal);
  }

  /**
   * Get a single proposal by ID.
   */
  static async getProposal(proposalId: string): Promise<CircleProposal | null> {
    const { data, error } = await supabase
      .from('circle_proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (error || !data) return null;
    return mapProposal(data);
  }

  /**
   * Create a new proposal.
   * Snapshots governance settings at creation time.
   * Sets voting window based on settings.
   */
  static async createProposal(
    circleId: string,
    proposalType: ProposalType,
    title: string,
    description?: string,
    payload?: Record<string, any>
  ): Promise<CircleProposal | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    // Get governance settings to snapshot
    const settings = await CircleDemocracyEngine.getGovernanceSettings(circleId);

    // Count eligible voters (active circle members)
    const { count } = await supabase
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('status', 'active');

    const eligibleVoters = count || 0;

    // Use critical threshold for critical proposal types
    const isCritical = CircleDemocracyEngine.isCriticalProposal(proposalType);
    const thresholdPct = isCritical
      ? settings.criticalThresholdPct
      : settings.defaultThresholdPct;

    const { data, error } = await supabase
      .from('circle_proposals')
      .insert({
        circle_id: circleId,
        proposer_id: userId,
        proposal_type: proposalType,
        title,
        description: description || null,
        proposal_payload: payload || {},
        status: 'draft',
        quorum_pct: settings.defaultQuorumPct,
        threshold_pct: thresholdPct,
        eligible_voters: eligibleVoters,
      })
      .select()
      .single();

    if (error || !data) return null;
    return mapProposal(data);
  }

  /**
   * Open a draft proposal for voting.
   * Sets voting_starts_at = NOW and voting_ends_at based on settings.
   */
  static async openProposal(proposalId: string): Promise<CircleProposal | null> {
    // Get proposal to find its circle
    const proposal = await CircleDemocracyEngine.getProposal(proposalId);
    if (!proposal || proposal.status !== 'draft') return null;

    // Get settings for voting window
    const settings = await CircleDemocracyEngine.getGovernanceSettings(proposal.circleId);

    // Re-count eligible voters at open time
    const { count } = await supabase
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', proposal.circleId)
      .eq('status', 'active');

    const now = new Date();
    const votingEndsAt = new Date(now.getTime() + settings.defaultVotingHours * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('circle_proposals')
      .update({
        status: 'open',
        voting_starts_at: now.toISOString(),
        voting_ends_at: votingEndsAt.toISOString(),
        eligible_voters: count || proposal.eligibleVoters,
      })
      .eq('id', proposalId)
      .select()
      .single();

    if (error || !data) return null;
    return mapProposal(data);
  }

  /**
   * Cancel a proposal (only proposer or admin can cancel).
   */
  static async cancelProposal(proposalId: string): Promise<CircleProposal | null> {
    const { data, error } = await supabase
      .from('circle_proposals')
      .update({
        status: 'cancelled',
        closed_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
      .in('status', ['draft', 'open'])
      .select()
      .single();

    if (error || !data) return null;
    return mapProposal(data);
  }


  // ── Voting ───────────────────────────────────────────────────────────────

  /**
   * Cast a vote on a proposal via the SQL function.
   * Handles validation, weight calculation, tally update, and early close.
   */
  static async castVote(
    proposalId: string,
    vote: VoteChoice,
    reasoning?: string
  ): Promise<CastVoteResult | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase.rpc('cast_proposal_vote', {
      p_proposal_id: proposalId,
      p_voter_id: userId,
      p_vote: vote,
      p_reasoning: reasoning || null,
    });

    if (error) {
      console.error('cast_proposal_vote failed:', error.message);
      throw new Error(error.message);
    }

    const castResult: CastVoteResult = {
      success: data?.success || false,
      vote: data?.vote || vote,
      weight: parseFloat(data?.weight) || 1.00,
      earlyClose: data?.early_close || false,
      result: data?.result || undefined,
    };

    // Dynamic payout ordering callback: when a change_payout_order proposal resolves
    if (castResult.earlyClose && castResult.result) {
      try {
        const proposal = await this.getProposal(proposalId);
        if (proposal?.proposalType === 'change_payout_order') {
          await DynamicPayoutOrderingEngine.onProposalResolved(proposalId, castResult.result);
        }
      } catch (err) {
        console.error('[CircleDemocracy] Dynamic ordering callback failed (non-fatal):', err);
      }
    }

    return castResult;
  }

  /**
   * Get all votes for a proposal.
   */
  static async getVotes(proposalId: string): Promise<ProposalVote[]> {
    const { data, error } = await supabase
      .from('circle_proposal_votes')
      .select('*')
      .eq('proposal_id', proposalId)
      .order('voted_at', { ascending: true });

    if (error || !data) return [];
    return data.map(mapVote);
  }

  /**
   * Get the current user's vote on a proposal.
   */
  static async getMyVote(proposalId: string): Promise<ProposalVote | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from('circle_proposal_votes')
      .select('*')
      .eq('proposal_id', proposalId)
      .eq('voter_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapVote(data);
  }


  // ── Voting Progress (Pure Function) ──────────────────────────────────────

  /**
   * Compute voting progress from a proposal object.
   */
  static getVotingProgress(proposal: CircleProposal): VotingProgress {
    const totalVoted = proposal.votesFor + proposal.votesAgainst + proposal.votesAbstain;
    const quorumNeeded = Math.ceil(proposal.eligibleVoters * proposal.quorumPct);
    const quorumMet = totalVoted >= quorumNeeded;

    // Threshold check: for / (for + against)
    const totalDecisive = proposal.weightFor + proposal.weightAgainst;
    const percentFor = totalDecisive > 0
      ? Math.round((proposal.weightFor / totalDecisive) * 100)
      : 0;
    const thresholdMet = totalDecisive > 0
      ? (proposal.weightFor / totalDecisive) >= proposal.thresholdPct
      : false;

    const percentVoted = proposal.eligibleVoters > 0
      ? Math.round((totalVoted / proposal.eligibleVoters) * 100)
      : 0;

    // Time remaining
    let timeRemaining: number | null = null;
    if (proposal.votingEndsAt && proposal.status === 'open') {
      const endsAt = new Date(proposal.votingEndsAt).getTime();
      const now = Date.now();
      timeRemaining = Math.max(0, endsAt - now);
    }

    return {
      totalEligible: proposal.eligibleVoters,
      totalVoted,
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
      votesAbstain: proposal.votesAbstain,
      quorumMet,
      thresholdMet,
      percentFor,
      percentVoted,
      timeRemaining,
    };
  }


  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Check if a proposal type is critical (requires higher threshold).
   */
  static isCriticalProposal(type: ProposalType): boolean {
    return CRITICAL_PROPOSAL_TYPES.includes(type);
  }

  /**
   * Get display info for each proposal type.
   */
  static getProposalTypeInfo(type: ProposalType): ProposalTypeInfo {
    const info: Record<ProposalType, ProposalTypeInfo> = {
      admit_member: {
        type: 'admit_member',
        label: 'Admit Member',
        description: 'Vote to admit a new member into the circle',
        isCritical: false,
      },
      remove_member: {
        type: 'remove_member',
        label: 'Remove Member',
        description: 'Vote to remove a member from the circle',
        isCritical: true,
      },
      change_payout_order: {
        type: 'change_payout_order',
        label: 'Change Payout Order',
        description: 'Vote to change the payout order for the circle',
        isCritical: false,
      },
      change_rules: {
        type: 'change_rules',
        label: 'Change Rules',
        description: 'Vote to change circle rules or settings',
        isCritical: false,
      },
      resolve_dispute: {
        type: 'resolve_dispute',
        label: 'Resolve Dispute',
        description: 'Vote on how to resolve a dispute between members',
        isCritical: false,
      },
      dissolve_circle: {
        type: 'dissolve_circle',
        label: 'Dissolve Circle',
        description: 'Vote to dissolve the circle and settle funds',
        isCritical: true,
      },
      custom: {
        type: 'custom',
        label: 'Custom Proposal',
        description: 'Vote on a custom proposal',
        isCritical: false,
      },
      pool_rollover: {
        type: 'pool_rollover',
        label: 'Pool Rollover',
        description: 'Vote to roll over unspent insurance pool funds or distribute to members',
        isCritical: false,
      },
    };
    return info[type] || info.custom;
  }

  /**
   * Check if a user can create proposals in a circle.
   */
  static async canUserPropose(circleId: string, userId?: string): Promise<boolean> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return false;

    // Get member record
    const { data: member } = await supabase
      .from('circle_members')
      .select('role, status')
      .eq('circle_id', circleId)
      .eq('user_id', targetId)
      .eq('status', 'active')
      .maybeSingle();

    if (!member) return false;

    // Get governance settings
    const settings = await CircleDemocracyEngine.getGovernanceSettings(circleId);

    switch (settings.proposalPermission) {
      case 'creator_only':
        return member.role === 'creator';
      case 'admins_only':
        return member.role === 'creator' || member.role === 'admin';
      case 'any_member':
        return true;
      default:
        return false;
    }
  }


  // ── Realtime ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to realtime changes on proposals for a circle.
   */
  static subscribeToProposals(
    circleId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`circle_proposals_${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_proposals',
          filter: `circle_id=eq.${circleId}`,
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to realtime changes on votes for a specific proposal.
   */
  static subscribeToVotes(
    proposalId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`proposal_votes_${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_proposal_votes',
          filter: `proposal_id=eq.${proposalId}`,
        },
        callback
      )
      .subscribe();
  }
}

export default CircleDemocracyEngine;
