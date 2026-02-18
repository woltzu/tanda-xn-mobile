// ══════════════════════════════════════════════════════════════════════════════
// DISSOLUTION ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// Handles circle dissolution with technical precision and emotional sensitivity
//
// Three-Tier Dissolution Triggers:
// 1. EMERGENCY: fraud_detected, catastrophic_default, regulatory_order, member_death
// 2. VOLUNTARY: member_consensus, goal_achieved, external_opportunity
// 3. ADMINISTRATIVE: natural_completion, prolonged_inactivity, membership_collapse
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPE DEFINITIONS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export type DissolutionTrigger =
  // Emergency Tier
  | 'fraud_detected'
  | 'catastrophic_default'
  | 'regulatory_order'
  | 'member_death'
  // Voluntary Tier
  | 'member_consensus'
  | 'goal_achieved'
  | 'external_opportunity'
  // Administrative Tier
  | 'natural_completion'
  | 'prolonged_inactivity'
  | 'membership_collapse';

export type DissolutionStatus =
  | 'proposed'
  | 'voting'
  | 'objection_window'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'contested';

export type VoteType = 'approve' | 'reject' | 'abstain';

export type ObjectionType =
  | 'calculation_error'
  | 'process_violation'
  | 'fraud_claim'
  | 'timing_dispute'
  | 'other';

export type DissolutionTier = 'emergency' | 'voluntary' | 'administrative';

export interface DissolutionTriggerConfig {
  trigger_type: DissolutionTrigger;
  tier: DissolutionTier;
  requires_vote: boolean;
  vote_threshold: number;
  voting_period_hours: number;
  objection_window_hours: number;
  can_be_contested: boolean;
  xn_score_impact: number;
  description: string;
  refund_priority: 'pro_rata' | 'fifo' | 'net_position';
}

export interface DissolutionRequest {
  id: string;
  circle_id: string;
  trigger_type: DissolutionTrigger;
  status: DissolutionStatus;
  reason: string;
  evidence_urls?: string[];
  initiated_by?: string;
  initiated_by_system: boolean;
  voting_starts_at?: string;
  voting_ends_at?: string;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  total_eligible_voters: number;
  objection_window_starts_at?: string;
  objection_window_ends_at?: string;
  objection_count: number;
  total_pool_amount: number;
  total_refund_amount: number;
  platform_fee_amount: number;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DissolutionVote {
  id: string;
  dissolution_request_id: string;
  user_id: string;
  vote: VoteType;
  vote_weight: number;
  reason?: string;
  voted_at: string;
  updated_at: string;
}

export interface DissolutionObjection {
  id: string;
  dissolution_request_id: string;
  user_id: string;
  objection_type: ObjectionType;
  description: string;
  evidence_urls?: string[];
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  upheld?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DissolutionMemberPosition {
  id: string;
  dissolution_request_id: string;
  user_id: string;
  total_contributed: number;
  total_received: number;
  net_position: number;
  refund_share_percentage: number;
  calculated_refund: number;
  adjusted_refund: number;
  refund_status: 'pending' | 'processing' | 'completed' | 'failed' | 'disputed';
  refund_method?: string;
  refund_executed_at?: string;
  refund_reference?: string;
  xn_score_before?: number;
  xn_score_after?: number;
  xn_score_change: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DissolutionEvent {
  id: string;
  dissolution_request_id: string;
  event_type: string;
  event_description: string;
  actor_id?: string;
  actor_type: 'user' | 'system' | 'admin';
  previous_state?: Record<string, any>;
  new_state?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface InitiateDissolutionParams {
  circleId: string;
  triggerType: DissolutionTrigger;
  reason: string;
  evidenceUrls?: string[];
}

export interface DissolutionAnalytics {
  trigger_type: DissolutionTrigger;
  total_requests: number;
  completed_count: number;
  rejected_count: number;
  cancelled_count: number;
  avg_pool_amount: number;
  avg_refund_amount: number;
  avg_resolution_hours: number;
}

export interface MemberDissolutionSummary {
  user_id: string;
  dissolution_id: string;
  circle_id: string;
  circle_name: string;
  trigger_type: DissolutionTrigger;
  status: DissolutionStatus;
  total_contributed: number;
  total_received: number;
  net_position: number;
  calculated_refund: number;
  adjusted_refund: number;
  refund_status: string;
  xn_score_change: number;
  user_vote?: VoteType;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DISSOLUTION ENGINE CLASS                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

export class DissolutionEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // TRIGGER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get all dissolution trigger configurations
   */
  static async getTriggerConfigs(): Promise<DissolutionTriggerConfig[]> {
    const { data, error } = await supabase
      .from('dissolution_trigger_config')
      .select('*')
      .order('tier');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get configuration for a specific trigger type
   */
  static async getTriggerConfig(
    triggerType: DissolutionTrigger
  ): Promise<DissolutionTriggerConfig | null> {
    const { data, error } = await supabase
      .from('dissolution_trigger_config')
      .select('*')
      .eq('trigger_type', triggerType)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get triggers by tier
   */
  static async getTriggersByTier(
    tier: DissolutionTier
  ): Promise<DissolutionTriggerConfig[]> {
    const { data, error } = await supabase
      .from('dissolution_trigger_config')
      .select('*')
      .eq('tier', tier);

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISSOLUTION REQUEST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initiate a new dissolution request
   */
  static async initiateDissolution(
    params: InitiateDissolutionParams
  ): Promise<string> {
    const { data, error } = await supabase.rpc('initiate_dissolution', {
      p_circle_id: params.circleId,
      p_trigger_type: params.triggerType,
      p_reason: params.reason,
      p_initiated_by: (await supabase.auth.getUser()).data.user?.id,
      p_evidence_urls: params.evidenceUrls || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get a dissolution request by ID
   */
  static async getDissolutionRequest(
    dissolutionId: string
  ): Promise<DissolutionRequest | null> {
    const { data, error } = await supabase
      .from('dissolution_requests')
      .select('*')
      .eq('id', dissolutionId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get dissolution request with full details (circle info, votes, positions)
   */
  static async getDissolutionDetails(dissolutionId: string): Promise<{
    request: DissolutionRequest;
    config: DissolutionTriggerConfig;
    votes: DissolutionVote[];
    objections: DissolutionObjection[];
    positions: DissolutionMemberPosition[];
    events: DissolutionEvent[];
  } | null> {
    const [requestResult, votesResult, objectionsResult, positionsResult, eventsResult] =
      await Promise.all([
        supabase
          .from('dissolution_requests')
          .select('*')
          .eq('id', dissolutionId)
          .single(),
        supabase
          .from('dissolution_votes')
          .select('*')
          .eq('dissolution_request_id', dissolutionId),
        supabase
          .from('dissolution_objections')
          .select('*')
          .eq('dissolution_request_id', dissolutionId),
        supabase
          .from('dissolution_member_positions')
          .select('*')
          .eq('dissolution_request_id', dissolutionId),
        supabase
          .from('dissolution_events')
          .select('*')
          .eq('dissolution_request_id', dissolutionId)
          .order('created_at', { ascending: true })
      ]);

    if (requestResult.error) return null;

    const config = await this.getTriggerConfig(requestResult.data.trigger_type);

    return {
      request: requestResult.data,
      config: config!,
      votes: votesResult.data || [],
      objections: objectionsResult.data || [],
      positions: positionsResult.data || [],
      events: eventsResult.data || []
    };
  }

  /**
   * Get all dissolution requests for a circle
   */
  static async getCircleDissolutions(
    circleId: string,
    status?: DissolutionStatus
  ): Promise<DissolutionRequest[]> {
    let query = supabase
      .from('dissolution_requests')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get active dissolution requests (not completed/rejected/cancelled)
   */
  static async getActiveDissolutions(): Promise<DissolutionRequest[]> {
    const { data, error } = await supabase
      .from('v_active_dissolution_requests')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's dissolution history across all circles
   */
  static async getUserDissolutionHistory(
    userId: string
  ): Promise<MemberDissolutionSummary[]> {
    const { data, error } = await supabase
      .from('v_member_dissolution_summary')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Cancel a dissolution request
   */
  static async cancelDissolution(
    dissolutionId: string,
    reason: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('cancel_dissolution', {
      p_dissolution_id: dissolutionId,
      p_cancelled_by: userId,
      p_reason: reason
    });

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOTING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cast a vote on a dissolution request
   */
  static async castVote(
    dissolutionId: string,
    vote: VoteType,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('cast_dissolution_vote', {
      p_dissolution_id: dissolutionId,
      p_user_id: userId,
      p_vote: vote,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get all votes for a dissolution request
   */
  static async getDissolutionVotes(
    dissolutionId: string
  ): Promise<DissolutionVote[]> {
    const { data, error } = await supabase
      .from('dissolution_votes')
      .select('*')
      .eq('dissolution_request_id', dissolutionId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's vote on a dissolution request
   */
  static async getUserVote(
    dissolutionId: string,
    userId: string
  ): Promise<DissolutionVote | null> {
    const { data, error } = await supabase
      .from('dissolution_votes')
      .select('*')
      .eq('dissolution_request_id', dissolutionId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Check if user has voted
   */
  static async hasUserVoted(
    dissolutionId: string,
    userId: string
  ): Promise<boolean> {
    const vote = await this.getUserVote(dissolutionId, userId);
    return vote !== null;
  }

  /**
   * Get voting progress
   */
  static async getVotingProgress(dissolutionId: string): Promise<{
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
  }> {
    const request = await this.getDissolutionRequest(dissolutionId);
    if (!request) throw new Error('Dissolution request not found');

    const config = await this.getTriggerConfig(request.trigger_type);
    const totalVotesCast = request.votes_for + request.votes_against + request.votes_abstain;
    const votesExcludingAbstain = request.votes_for + request.votes_against;

    const approvalRate = votesExcludingAbstain > 0
      ? request.votes_for / votesExcludingAbstain
      : 0;

    const remainingTime = request.voting_ends_at
      ? Math.max(0, new Date(request.voting_ends_at).getTime() - Date.now())
      : undefined;

    return {
      votesFor: request.votes_for,
      votesAgainst: request.votes_against,
      votesAbstain: request.votes_abstain,
      totalVotesCast,
      totalEligible: request.total_eligible_voters,
      participationRate: totalVotesCast / request.total_eligible_voters,
      approvalRate,
      threshold: config?.vote_threshold || 0.67,
      isThresholdMet: approvalRate >= (config?.vote_threshold || 0.67),
      remainingTime
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBJECTION SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * File an objection to a dissolution
   */
  static async fileObjection(
    dissolutionId: string,
    objectionType: ObjectionType,
    description: string,
    evidenceUrls?: string[]
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('file_dissolution_objection', {
      p_dissolution_id: dissolutionId,
      p_user_id: userId,
      p_objection_type: objectionType,
      p_description: description,
      p_evidence_urls: evidenceUrls || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get all objections for a dissolution request
   */
  static async getDissolutionObjections(
    dissolutionId: string
  ): Promise<DissolutionObjection[]> {
    const { data, error } = await supabase
      .from('dissolution_objections')
      .select('*')
      .eq('dissolution_request_id', dissolutionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get unresolved objections count
   */
  static async getUnresolvedObjectionsCount(
    dissolutionId: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from('dissolution_objections')
      .select('*', { count: 'exact', head: true })
      .eq('dissolution_request_id', dissolutionId)
      .eq('resolved', false);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Resolve an objection (admin only)
   */
  static async resolveObjection(
    objectionId: string,
    upheld: boolean,
    resolutionNotes: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { error } = await supabase
      .from('dissolution_objections')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: resolutionNotes,
        upheld
      })
      .eq('id', objectionId);

    if (error) throw error;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBER POSITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get member positions for a dissolution
   */
  static async getMemberPositions(
    dissolutionId: string
  ): Promise<DissolutionMemberPosition[]> {
    const { data, error } = await supabase
      .from('dissolution_member_positions')
      .select('*')
      .eq('dissolution_request_id', dissolutionId)
      .order('net_position', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's position in a dissolution
   */
  static async getUserPosition(
    dissolutionId: string,
    userId: string
  ): Promise<DissolutionMemberPosition | null> {
    const { data, error } = await supabase
      .from('dissolution_member_positions')
      .select('*')
      .eq('dissolution_request_id', dissolutionId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get refund summary for a dissolution
   */
  static async getRefundSummary(dissolutionId: string): Promise<{
    totalPoolAmount: number;
    totalRefundAmount: number;
    platformFeeAmount: number;
    membersToRefund: number;
    refundsCompleted: number;
    refundsPending: number;
    refundsFailed: number;
  }> {
    const [request, positions] = await Promise.all([
      this.getDissolutionRequest(dissolutionId),
      this.getMemberPositions(dissolutionId)
    ]);

    if (!request) throw new Error('Dissolution request not found');

    const statusCounts = positions.reduce(
      (acc, p) => {
        acc[p.refund_status] = (acc[p.refund_status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalPoolAmount: request.total_pool_amount,
      totalRefundAmount: request.total_refund_amount,
      platformFeeAmount: request.platform_fee_amount,
      membersToRefund: positions.filter((p) => p.adjusted_refund > 0).length,
      refundsCompleted: statusCounts['completed'] || 0,
      refundsPending: statusCounts['pending'] || 0,
      refundsFailed: statusCounts['failed'] || 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get dissolution event history
   */
  static async getDissolutionEvents(
    dissolutionId: string
  ): Promise<DissolutionEvent[]> {
    const { data, error } = await supabase
      .from('dissolution_events')
      .select('*')
      .eq('dissolution_request_id', dissolutionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get timeline for UI display
   */
  static async getDissolutionTimeline(dissolutionId: string): Promise<
    {
      timestamp: string;
      eventType: string;
      description: string;
      actor?: string;
      actorType: string;
      data?: Record<string, any>;
    }[]
  > {
    const events = await this.getDissolutionEvents(dissolutionId);

    return events.map((e) => ({
      timestamp: e.created_at,
      eventType: e.event_type,
      description: e.event_description,
      actor: e.actor_id,
      actorType: e.actor_type,
      data: e.new_state
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get dissolution analytics
   */
  static async getAnalytics(): Promise<DissolutionAnalytics[]> {
    const { data, error } = await supabase
      .from('v_dissolution_analytics')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get dissolution statistics for a specific time period
   */
  static async getDissolutionStats(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalDissolutions: number;
    completedDissolutions: number;
    rejectedDissolutions: number;
    cancelledDissolutions: number;
    totalRefunded: number;
    totalPlatformFees: number;
    byTriggerType: Record<DissolutionTrigger, number>;
    byTier: Record<DissolutionTier, number>;
    avgResolutionTimeHours: number;
  }> {
    const { data, error } = await supabase
      .from('dissolution_requests')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;
    const requests = data || [];

    const triggerCounts = {} as Record<DissolutionTrigger, number>;
    const tierCounts = { emergency: 0, voluntary: 0, administrative: 0 };
    let totalRefunded = 0;
    let totalFees = 0;
    let resolutionTimeSum = 0;
    let resolvedCount = 0;

    const configs = await this.getTriggerConfigs();
    const configMap = Object.fromEntries(
      configs.map((c) => [c.trigger_type, c])
    );

    requests.forEach((r) => {
      triggerCounts[r.trigger_type] = (triggerCounts[r.trigger_type] || 0) + 1;
      tierCounts[configMap[r.trigger_type]?.tier || 'administrative']++;
      totalRefunded += r.total_refund_amount || 0;
      totalFees += r.platform_fee_amount || 0;

      if (r.resolved_at) {
        const resolutionTime =
          new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime();
        resolutionTimeSum += resolutionTime;
        resolvedCount++;
      }
    });

    return {
      totalDissolutions: requests.length,
      completedDissolutions: requests.filter((r) => r.status === 'completed').length,
      rejectedDissolutions: requests.filter((r) => r.status === 'rejected').length,
      cancelledDissolutions: requests.filter((r) => r.status === 'cancelled').length,
      totalRefunded,
      totalPlatformFees: totalFees,
      byTriggerType: triggerCounts,
      byTier: tierCounts,
      avgResolutionTimeHours:
        resolvedCount > 0 ? resolutionTimeSum / resolvedCount / 3600000 : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a circle can be dissolved
   */
  static async canCircleBeDissolve(circleId: string): Promise<{
    canDissolve: boolean;
    reason?: string;
    existingRequest?: DissolutionRequest;
  }> {
    // Check for existing pending dissolution
    const existing = await this.getCircleDissolutions(circleId);
    const pendingRequest = existing.find(
      (r) => !['completed', 'rejected', 'cancelled'].includes(r.status)
    );

    if (pendingRequest) {
      return {
        canDissolve: false,
        reason: 'Circle already has a pending dissolution request',
        existingRequest: pendingRequest
      };
    }

    // Check if circle is already dissolved
    const { data: circle } = await supabase
      .from('circles')
      .select('status')
      .eq('id', circleId)
      .single();

    if (circle?.status === 'dissolved') {
      return {
        canDissolve: false,
        reason: 'Circle is already dissolved'
      };
    }

    return { canDissolve: true };
  }

  /**
   * Get appropriate triggers for a circle based on its state
   */
  static async getApplicableTriggers(
    circleId: string
  ): Promise<DissolutionTriggerConfig[]> {
    const allConfigs = await this.getTriggerConfigs();

    // Get circle info to determine applicable triggers
    const { data: circle } = await supabase
      .from('circles')
      .select('*, circle_members(count)')
      .eq('id', circleId)
      .single();

    const applicableTriggers: DissolutionTriggerConfig[] = [];

    allConfigs.forEach((config) => {
      // Filter based on circle state
      switch (config.trigger_type) {
        case 'natural_completion':
          // Only if circle has completed all cycles
          // Add logic to check cycle completion
          break;
        case 'membership_collapse':
          // Only if member count is critically low
          // Add threshold check
          break;
        default:
          // Most triggers are always applicable
          applicableTriggers.push(config);
      }
    });

    return applicableTriggers;
  }

  /**
   * Format dissolution status for display
   */
  static formatStatus(status: DissolutionStatus): string {
    const statusMap: Record<DissolutionStatus, string> = {
      proposed: 'Proposed',
      voting: 'Voting in Progress',
      objection_window: 'Objection Period',
      approved: 'Approved',
      executing: 'Processing Refunds',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      contested: 'Under Review'
    };
    return statusMap[status] || status;
  }

  /**
   * Format trigger type for display
   */
  static formatTriggerType(trigger: DissolutionTrigger): string {
    const triggerMap: Record<DissolutionTrigger, string> = {
      fraud_detected: 'Fraud Detected',
      catastrophic_default: 'Catastrophic Default',
      regulatory_order: 'Regulatory Order',
      member_death: 'Member Death',
      member_consensus: 'Member Consensus',
      goal_achieved: 'Goal Achieved',
      external_opportunity: 'External Opportunity',
      natural_completion: 'Natural Completion',
      prolonged_inactivity: 'Prolonged Inactivity',
      membership_collapse: 'Membership Collapse'
    };
    return triggerMap[trigger] || trigger;
  }

  /**
   * Get tier color for UI
   */
  static getTierColor(tier: DissolutionTier): string {
    const colorMap: Record<DissolutionTier, string> = {
      emergency: '#DC2626', // Red
      voluntary: '#2563EB', // Blue
      administrative: '#6B7280' // Gray
    };
    return colorMap[tier];
  }
}

export default DissolutionEngine;
