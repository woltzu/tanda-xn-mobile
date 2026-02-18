// ══════════════════════════════════════════════════════════════════════════════
// MEMBER REMOVAL ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// The most complex financial operation in a ROSCA system
//
// Core Principles:
// 1. Fairness to the Departing Member
// 2. Protection of Remaining Members
// 3. Transparency (auditable, visible to Elders)
// 4. Minimal Disruption (instant payout recalculation)
// 5. Incentive Alignment (consequences for bad behavior)
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPE DEFINITIONS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export type RemovalReason =
  | 'voluntary'           // Member chooses to leave
  | 'default'             // Removed for chronic non-payment
  | 'fraud'               // Removed for fraudulent activity
  | 'admin'               // Administrative removal (Elder decision)
  | 'emergency'           // Emergency circumstances (death, illness)
  | 'inactivity'          // Prolonged inactivity
  | 'rule_violation'      // Violated circle rules
  | 'membership_collapse'; // Circle falling below minimum members

export type SettlementType =
  | 'full_refund'         // 100% refund (no-fault removal)
  | 'partial_refund'      // Refund minus exit fee (voluntary)
  | 'forfeiture'          // No refund (default/fraud)
  | 'debt_created'        // Member owes circle (left after payout)
  | 'no_settlement';      // No financial action needed

export type RemovalStatus =
  | 'pending_approval'    // Waiting for Elder/vote approval
  | 'approved'            // Approved, pending execution
  | 'executing'           // Settlement in progress
  | 'completed'           // Successfully removed
  | 'rejected'            // Removal request rejected
  | 'cancelled'           // Cancelled by initiator
  | 'disputed';           // Under dispute review

export type VoteType = 'approve' | 'reject' | 'abstain';

export type DebtStatus = 'pending' | 'repaying' | 'settled' | 'written_off' | 'disputed';

export interface CircleRemovalSettings {
  id: string;
  circle_id: string;
  early_exit_fee_percentage: number;
  exit_fee_destination: 'pool' | 'members' | 'platform';
  require_vote_for_removal: boolean;
  vote_threshold_percentage: number;
  voting_period_hours: number;
  allow_debt_repayment_plan: boolean;
  max_repayment_installments: number;
  debt_blocks_new_circles: boolean;
  forfeit_on_default: boolean;
  forfeit_on_fraud: boolean;
  grace_period_days: number;
  created_at: string;
  updated_at: string;
}

export interface MemberRemovalRequest {
  id: string;
  circle_id: string;
  member_user_id: string;
  reason: RemovalReason;
  reason_details?: string;
  status: RemovalStatus;
  initiated_by?: string;
  initiated_by_type: 'user' | 'elder' | 'system' | 'admin';
  is_self_removal: boolean;
  total_contributed: number;
  total_received: number;
  has_received_payout: boolean;
  member_position?: number;
  was_current_beneficiary: boolean;
  settlement_type?: SettlementType;
  settlement_amount: number;
  exit_fee_amount: number;
  debt_amount: number;
  requires_vote: boolean;
  voting_starts_at?: string;
  voting_ends_at?: string;
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  grace_period_ends_at?: string;
  can_be_cancelled_until?: string;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface RemovalVote {
  id: string;
  removal_request_id: string;
  user_id: string;
  vote: VoteType;
  reason?: string;
  voted_at: string;
  updated_at: string;
}

export interface MemberDebt {
  id: string;
  user_id: string;
  circle_id: string;
  removal_request_id?: string;
  original_amount: number;
  remaining_amount: number;
  reason: string;
  has_repayment_plan: boolean;
  repayment_plan_id?: string;
  installment_amount?: number;
  installments_remaining?: number;
  next_installment_date?: string;
  debt_status: DebtStatus;  // Renamed from 'status' to avoid conflicts
  settled_at?: string;
  written_off_at?: string;
  written_off_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Extended fields from view
  circle_name?: string;
  total_payments?: number;
  total_paid?: number;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  payment_method: string;
  payment_reference?: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded';  // Renamed from 'status'
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CircleRemovalAudit {
  id: string;
  removal_request_id?: string;
  circle_id: string;
  removed_user_id: string;
  removed_by_user_id?: string;
  action_type: string;
  reason: RemovalReason;
  reason_details?: string;
  settlement_type: SettlementType;
  settlement_amount?: number;
  exit_fee_amount?: number;
  debt_amount?: number;
  old_position?: number;
  old_payout_order?: any[];
  new_payout_order?: any[];
  xn_score_before?: number;
  xn_score_after?: number;
  xn_score_delta?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface PayoutOrderAdjustment {
  id: string;
  circle_id: string;
  adjustment_type: 'member_removed' | 'member_added' | 'order_shuffled' | 'beneficiary_skipped';
  affected_user_id?: string;
  reason?: string;
  old_order: any[];
  new_order: any[];
  old_total_cycles?: number;
  new_total_cycles?: number;
  old_beneficiary_id?: string;
  new_beneficiary_id?: string;
  cycle_skipped: boolean;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface MemberCirclePosition {
  total_contributed: number;
  total_received: number;
  has_received_payout: boolean;
  net_position: number;
  current_position: number;
  remaining_cycles_to_pay: number;
  is_current_beneficiary: boolean;
}

export interface SettlementCalculation {
  settlement_type: SettlementType;
  refund_amount: number;
  exit_fee_amount: number;
  debt_amount: number;
  xn_score_impact: number;
}

export interface InitiateRemovalParams {
  circleId: string;
  memberUserId: string;
  reason: RemovalReason;
  reasonDetails?: string;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MEMBER REMOVAL ENGINE CLASS                                                 │
// └─────────────────────────────────────────────────────────────────────────────┘

export class MemberRemovalEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // CIRCLE REMOVAL SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get removal settings for a circle
   */
  static async getCircleRemovalSettings(
    circleId: string
  ): Promise<CircleRemovalSettings | null> {
    const { data, error } = await supabase
      .from('circle_removal_settings')
      .select('*')
      .eq('circle_id', circleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Create or update removal settings for a circle
   */
  static async upsertCircleRemovalSettings(
    settings: Partial<CircleRemovalSettings> & { circle_id: string }
  ): Promise<CircleRemovalSettings> {
    const { data, error } = await supabase
      .from('circle_removal_settings')
      .upsert(settings, { onConflict: 'circle_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBER POSITION & SETTLEMENT CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get member's financial position in a circle
   */
  static async getMemberCirclePosition(
    circleId: string,
    userId: string
  ): Promise<MemberCirclePosition | null> {
    const { data, error } = await supabase.rpc('get_member_circle_position', {
      p_circle_id: circleId,
      p_user_id: userId
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  /**
   * Calculate settlement for a potential removal
   */
  static async calculateSettlement(
    circleId: string,
    userId: string,
    reason: RemovalReason
  ): Promise<SettlementCalculation | null> {
    const { data, error } = await supabase.rpc('calculate_removal_settlement', {
      p_circle_id: circleId,
      p_user_id: userId,
      p_reason: reason
    });

    if (error) throw error;
    return data?.[0] || null;
  }

  /**
   * Preview what would happen if a member is removed
   */
  static async previewRemoval(
    circleId: string,
    userId: string,
    reason: RemovalReason
  ): Promise<{
    position: MemberCirclePosition | null;
    settlement: SettlementCalculation | null;
    willCreateDebt: boolean;
    willForfeit: boolean;
    estimatedXnScoreImpact: number;
  }> {
    const [position, settlement] = await Promise.all([
      this.getMemberCirclePosition(circleId, userId),
      this.calculateSettlement(circleId, userId, reason)
    ]);

    return {
      position,
      settlement,
      willCreateDebt: settlement?.settlement_type === 'debt_created',
      willForfeit: settlement?.settlement_type === 'forfeiture',
      estimatedXnScoreImpact: settlement?.xn_score_impact || 0
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMOVAL REQUEST MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initiate a member removal request
   */
  static async initiateRemoval(
    params: InitiateRemovalParams
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('initiate_member_removal', {
      p_circle_id: params.circleId,
      p_member_user_id: params.memberUserId,
      p_reason: params.reason,
      p_reason_details: params.reasonDetails || null,
      p_initiated_by: userId
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get a removal request by ID
   */
  static async getRemovalRequest(
    requestId: string
  ): Promise<MemberRemovalRequest | null> {
    const { data, error } = await supabase
      .from('member_removal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get removal request with full details
   */
  static async getRemovalRequestDetails(requestId: string): Promise<{
    request: MemberRemovalRequest;
    votes: RemovalVote[];
    memberProfile: any;
    initiatorProfile: any;
    settings: CircleRemovalSettings | null;
  } | null> {
    const [requestResult, votesResult] = await Promise.all([
      supabase
        .from('member_removal_requests')
        .select(`
          *,
          member:profiles!member_removal_requests_member_user_id_fkey(*),
          initiator:profiles!member_removal_requests_initiated_by_fkey(*)
        `)
        .eq('id', requestId)
        .single(),
      supabase
        .from('removal_votes')
        .select('*')
        .eq('removal_request_id', requestId)
    ]);

    if (requestResult.error) return null;

    const settings = await this.getCircleRemovalSettings(requestResult.data.circle_id);

    return {
      request: requestResult.data,
      votes: votesResult.data || [],
      memberProfile: requestResult.data.member,
      initiatorProfile: requestResult.data.initiator,
      settings
    };
  }

  /**
   * Get all removal requests for a circle
   */
  static async getCircleRemovalRequests(
    circleId: string,
    status?: RemovalStatus
  ): Promise<MemberRemovalRequest[]> {
    let query = supabase
      .from('member_removal_requests')
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
   * Get active removal requests
   */
  static async getActiveRemovalRequests(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_active_removal_requests')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's removal history (times they were removed)
   */
  static async getUserRemovalHistory(userId: string): Promise<MemberRemovalRequest[]> {
    const { data, error } = await supabase
      .from('member_removal_requests')
      .select('*')
      .eq('member_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Cancel a removal request
   */
  static async cancelRemovalRequest(
    requestId: string,
    reason: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('cancel_removal_request', {
      p_removal_request_id: requestId,
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
   * Cast a vote on a removal request
   */
  static async castVote(
    requestId: string,
    vote: VoteType,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('cast_removal_vote', {
      p_removal_request_id: requestId,
      p_user_id: userId,
      p_vote: vote,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get all votes for a removal request
   */
  static async getRemovalVotes(requestId: string): Promise<RemovalVote[]> {
    const { data, error } = await supabase
      .from('removal_votes')
      .select('*')
      .eq('removal_request_id', requestId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's vote on a removal request
   */
  static async getUserVote(
    requestId: string,
    userId: string
  ): Promise<RemovalVote | null> {
    const { data, error } = await supabase
      .from('removal_votes')
      .select('*')
      .eq('removal_request_id', requestId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get voting progress for a removal request
   */
  static async getVotingProgress(requestId: string): Promise<{
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
    const request = await this.getRemovalRequest(requestId);
    if (!request) throw new Error('Removal request not found');

    const settings = await this.getCircleRemovalSettings(request.circle_id);
    const threshold = settings?.vote_threshold_percentage || 0.60;

    // Get eligible voters (active members minus the one being removed)
    const { count: eligibleCount } = await supabase
      .from('circle_members')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', request.circle_id)
      .eq('status', 'active')
      .neq('user_id', request.member_user_id);

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
      totalEligible: eligibleCount || 0,
      participationRate: (eligibleCount || 0) > 0 ? totalVotesCast / (eligibleCount || 1) : 0,
      approvalRate,
      threshold,
      isThresholdMet: approvalRate >= threshold,
      remainingTime
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEBT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user's debts
   */
  static async getUserDebts(userId: string): Promise<MemberDebt[]> {
    const { data, error } = await supabase
      .from('v_user_debts')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific debt
   */
  static async getDebt(debtId: string): Promise<MemberDebt | null> {
    const { data, error } = await supabase
      .from('v_user_debts')
      .select('*')
      .eq('id', debtId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get pending debts for a user
   */
  static async getPendingDebts(userId: string): Promise<MemberDebt[]> {
    const { data, error } = await supabase
      .from('member_debts')
      .select('*')
      .eq('user_id', userId)
      .in('debt_status', ['pending', 'repaying']);

    if (error) throw error;
    return data || [];
  }

  /**
   * Check if user has outstanding debts (blocks joining new circles)
   */
  static async hasOutstandingDebts(userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('member_debts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('debt_status', ['pending', 'repaying']);

    if (error) throw error;
    return (count || 0) > 0;
  }

  /**
   * Make a debt payment
   */
  static async makeDebtPayment(
    debtId: string,
    amount: number,
    paymentMethod: string,
    paymentReference?: string
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;

    const { data, error } = await supabase.rpc('make_debt_payment', {
      p_debt_id: debtId,
      p_user_id: userId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_payment_reference: paymentReference || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get payment history for a debt
   */
  static async getDebtPayments(debtId: string): Promise<DebtPayment[]> {
    const { data, error } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('debt_id', debtId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Setup a repayment plan for a debt
   */
  static async setupRepaymentPlan(
    debtId: string,
    installments: number
  ): Promise<MemberDebt> {
    const debt = await this.getDebt(debtId);
    if (!debt) throw new Error('Debt not found');

    const installmentAmount = Math.ceil(debt.remaining_amount / installments * 100) / 100;

    const { data, error } = await supabase
      .from('member_debts')
      .update({
        has_repayment_plan: true,
        installment_amount: installmentAmount,
        installments_remaining: installments,
        next_installment_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        debt_status: 'repaying'
      })
      .eq('id', debtId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT & HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get removal audit history for a circle
   */
  static async getCircleRemovalAudit(
    circleId: string
  ): Promise<CircleRemovalAudit[]> {
    const { data, error } = await supabase
      .from('circle_removal_audit')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get payout order adjustment history for a circle
   */
  static async getPayoutOrderAdjustments(
    circleId: string
  ): Promise<PayoutOrderAdjustment[]> {
    const { data, error } = await supabase
      .from('payout_order_adjustments')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get removal statistics
   */
  static async getRemovalStatistics(): Promise<
    {
      reason: RemovalReason;
      total_removals: number;
      completed_count: number;
      rejected_count: number;
      avg_settlement_amount: number;
      avg_exit_fee: number;
      avg_debt_created: number;
    }[]
  > {
    const { data, error } = await supabase
      .from('v_removal_statistics')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a member can be removed
   */
  static async canMemberBeRemoved(
    circleId: string,
    userId: string
  ): Promise<{
    canRemove: boolean;
    reason?: string;
    existingRequest?: MemberRemovalRequest;
  }> {
    // Check for existing pending removal
    const { data: existing } = await supabase
      .from('member_removal_requests')
      .select('*')
      .eq('circle_id', circleId)
      .eq('member_user_id', userId)
      .not('status', 'in', '("completed","rejected","cancelled")')
      .single();

    if (existing) {
      return {
        canRemove: false,
        reason: 'Member already has a pending removal request',
        existingRequest: existing
      };
    }

    // Check if member is active
    const { data: member } = await supabase
      .from('circle_members')
      .select('status')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!member || member.status !== 'active') {
      return {
        canRemove: false,
        reason: 'User is not an active member of this circle'
      };
    }

    return { canRemove: true };
  }

  /**
   * Get applicable removal reasons based on member status
   */
  static async getApplicableRemovalReasons(
    circleId: string,
    userId: string,
    isElderInitiated: boolean
  ): Promise<RemovalReason[]> {
    const reasons: RemovalReason[] = [];
    const position = await this.getMemberCirclePosition(circleId, userId);

    // Always available for self-removal
    reasons.push('voluntary');

    // Elder-only reasons
    if (isElderInitiated) {
      reasons.push('admin', 'emergency', 'default', 'fraud', 'inactivity', 'rule_violation');
    }

    return reasons;
  }

  /**
   * Format removal reason for display
   */
  static formatRemovalReason(reason: RemovalReason): string {
    const reasonMap: Record<RemovalReason, string> = {
      voluntary: 'Voluntary Exit',
      default: 'Non-Payment Default',
      fraud: 'Fraudulent Activity',
      admin: 'Administrative Decision',
      emergency: 'Emergency Circumstances',
      inactivity: 'Prolonged Inactivity',
      rule_violation: 'Rule Violation',
      membership_collapse: 'Membership Collapse'
    };
    return reasonMap[reason] || reason;
  }

  /**
   * Format settlement type for display
   */
  static formatSettlementType(type: SettlementType): string {
    const typeMap: Record<SettlementType, string> = {
      full_refund: 'Full Refund',
      partial_refund: 'Partial Refund (Exit Fee Applied)',
      forfeiture: 'Contributions Forfeited',
      debt_created: 'Debt Created',
      no_settlement: 'No Settlement Required'
    };
    return typeMap[type] || type;
  }

  /**
   * Format removal status for display
   */
  static formatRemovalStatus(status: RemovalStatus): string {
    const statusMap: Record<RemovalStatus, string> = {
      pending_approval: 'Pending Approval',
      approved: 'Approved',
      executing: 'Processing',
      completed: 'Completed',
      rejected: 'Rejected',
      cancelled: 'Cancelled',
      disputed: 'Under Dispute'
    };
    return statusMap[status] || status;
  }

  /**
   * Get color for settlement type (for UI)
   */
  static getSettlementTypeColor(type: SettlementType): string {
    const colorMap: Record<SettlementType, string> = {
      full_refund: '#10B981',     // Green
      partial_refund: '#F59E0B',  // Amber
      forfeiture: '#EF4444',      // Red
      debt_created: '#DC2626',    // Dark Red
      no_settlement: '#6B7280'    // Gray
    };
    return colorMap[type] || '#6B7280';
  }

  /**
   * Get color for removal reason (for UI)
   */
  static getRemovalReasonColor(reason: RemovalReason): string {
    const colorMap: Record<RemovalReason, string> = {
      voluntary: '#3B82F6',        // Blue
      default: '#EF4444',          // Red
      fraud: '#DC2626',            // Dark Red
      admin: '#6B7280',            // Gray
      emergency: '#8B5CF6',        // Purple
      inactivity: '#F59E0B',       // Amber
      rule_violation: '#F97316',   // Orange
      membership_collapse: '#6B7280' // Gray
    };
    return colorMap[reason] || '#6B7280';
  }
}

export default MemberRemovalEngine;
