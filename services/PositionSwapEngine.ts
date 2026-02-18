// ══════════════════════════════════════════════════════════════════════════════
// POSITION SWAP ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// Where digital meets traditional - enabling members to trade payout positions
// with safeguards against abuse, coercion, and gaming
//
// Core Principles:
// 1. Voluntary Exchange - Both parties must explicitly agree
// 2. Anti-Coercion - Double confirmation, cooling-off periods
// 3. Transparency - All swaps are logged and visible to Elders
// 4. Fair Treatment - XnScore thresholds protect early positions
// 5. Reversibility - Swaps can be cancelled before execution
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPE DEFINITIONS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export type SwapRequestStatus =
  | 'pending_target'          // Waiting for target member response
  | 'pending_confirmation'    // Target accepted, waiting for requester to confirm
  | 'pending_elder_approval'  // Both confirmed, needs Elder approval
  | 'approved'                // Ready for execution
  | 'executing'               // Swap in progress
  | 'completed'               // Successfully swapped
  | 'rejected'                // Target rejected
  | 'cancelled'               // Requester cancelled
  | 'expired'                 // Timed out
  | 'elder_denied';           // Elder blocked the swap

export type SwapEventType =
  | 'request_created'
  | 'target_accepted'
  | 'target_rejected'
  | 'requester_confirmed'
  | 'requester_cancelled'
  | 'elder_approved'
  | 'elder_denied'
  | 'swap_executed'
  | 'swap_expired'
  | 'request_withdrawn';

export type SwapRole = 'requester' | 'target';

export interface CircleSwapConfig {
  swaps_enabled: boolean;
  require_elder_approval: boolean;
  min_xn_score_for_early_position: number;
  early_position_threshold: number;
  max_swaps_per_cycle: number;
  max_swaps_per_member_per_cycle: number;
  blackout_cycles_before_payout: number;
  request_expiry_hours: number;
  cooling_off_hours: number;
  swap_fee_percentage: number;
}

export interface PositionSwapRequest {
  id: string;
  circle_id: string;

  // Requester info
  requester_user_id: string;
  requester_position: number;
  requester_xn_score?: number;

  // Target info
  target_user_id: string;
  target_position: number;
  target_xn_score?: number;

  // Request details
  request_reason?: string;
  swap_status: SwapRequestStatus;

  // Double confirmation tracking
  target_accepted_at?: string;
  target_response_reason?: string;
  requester_confirmed_at?: string;
  requester_confirmation_reason?: string;

  // Elder approval tracking
  elder_approved_by?: string;
  elder_decision_at?: string;
  elder_decision_reason?: string;

  // Expiry and timing
  expires_at: string;
  cooling_off_ends_at?: string;

  // Fee tracking
  swap_fee_amount: number;
  swap_fee_paid_by?: 'requester' | 'target' | 'split' | 'waived';

  // Execution tracking
  executed_at?: string;
  executed_by_system: boolean;

  // Metadata
  cycle_number?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Extended fields from view
  circle_name?: string;
  requester_name?: string;
  target_name?: string;
  elder_name?: string;
  time_remaining?: string;
  cooling_off_remaining?: string;
}

export interface SwapEvent {
  id: string;
  swap_request_id: string;
  event_type: SwapEventType;
  actor_user_id?: string;
  actor_role?: string;
  event_details?: string;
  xn_score_change?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface MemberSwapHistory {
  id: string;
  user_id: string;
  circle_id: string;
  swap_request_id: string;
  swap_role: SwapRole;
  old_position: number;
  new_position: number;
  swap_partner_id: string;
  was_generous: boolean;
  xn_score_impact: number;
  cycle_number?: number;
  created_at: string;

  // Extended fields from view
  circle_name?: string;
  partner_name?: string;
  swap_direction?: 'gave_up_earlier' | 'received_earlier';
}

export interface CanSwapResult {
  allowed: boolean;
  reason: string;
}

export interface PendingSwapRequest {
  request_id: string;
  circle_id: string;
  circle_name: string;
  requester_id: string;
  requester_name: string;
  requester_position: number;
  your_position: number;
  request_reason?: string;
  expires_at: string;
  created_at: string;
}

export interface SwapAwaitingConfirmation {
  request_id: string;
  circle_id: string;
  circle_name: string;
  target_id: string;
  target_name: string;
  your_position: number;
  target_position: number;
  cooling_off_ends_at?: string;
  expires_at: string;
}

export interface SwapPendingElderApproval {
  request_id: string;
  requester_id: string;
  requester_name: string;
  requester_position: number;
  requester_xn_score: number;
  target_id: string;
  target_name: string;
  target_position: number;
  target_xn_score: number;
  request_reason?: string;
  created_at: string;
}

export interface CircleSwapStatistics {
  circle_id: string;
  total_requests: number;
  completed_swaps: number;
  rejected_swaps: number;
  cancelled_swaps: number;
  expired_swaps: number;
  avg_completion_hours: number;
}

export interface CircleMemberForSwap {
  user_id: string;
  full_name: string;
  position: number;
  xn_score: number;
  avatar_url?: string;
  can_swap_with: boolean;
  swap_blocked_reason?: string;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ POSITION SWAP ENGINE CLASS                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

export class PositionSwapEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get swap configuration for a circle
   */
  static async getCircleSwapConfig(circleId: string): Promise<CircleSwapConfig> {
    const { data, error } = await supabase.rpc('get_circle_swap_config', {
      p_circle_id: circleId
    });

    if (error) throw error;
    return data;
  }

  /**
   * Update swap configuration for a circle
   */
  static async updateCircleSwapConfig(
    circleId: string,
    config: Partial<CircleSwapConfig>
  ): Promise<void> {
    const { error } = await supabase
      .from('circles')
      .update({ swap_config: config })
      .eq('id', circleId);

    if (error) throw error;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAP REQUEST LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if a swap is allowed between two members
   */
  static async canRequestSwap(
    circleId: string,
    targetUserId: string
  ): Promise<CanSwapResult> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    // Get positions
    const { data: members, error: membersError } = await supabase
      .from('circle_members')
      .select('user_id, position')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .in('user_id', [userId, targetUserId]);

    if (membersError) throw membersError;

    const requesterMember = members?.find(m => m.user_id === userId);
    const targetMember = members?.find(m => m.user_id === targetUserId);

    if (!requesterMember || !targetMember) {
      return { allowed: false, reason: 'One or both members not found' };
    }

    const { data, error } = await supabase.rpc('can_request_swap', {
      p_circle_id: circleId,
      p_requester_id: userId,
      p_target_id: targetUserId,
      p_requester_position: requesterMember.position,
      p_target_position: targetMember.position
    });

    if (error) throw error;
    return data?.[0] || { allowed: false, reason: 'Unknown error' };
  }

  /**
   * Create a new swap request
   * Step 1: Requester initiates
   */
  static async createSwapRequest(
    circleId: string,
    targetUserId: string,
    reason?: string
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('create_swap_request', {
      p_circle_id: circleId,
      p_requester_id: userId,
      p_target_id: targetUserId,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Respond to a swap request (as target)
   * Step 2: Target accepts or rejects
   */
  static async respondToSwapRequest(
    requestId: string,
    accept: boolean,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('respond_to_swap_request', {
      p_request_id: requestId,
      p_target_id: userId,
      p_accept: accept,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Confirm swap request (as requester, after target accepts)
   * Step 3: Double confirmation anti-coercion measure
   */
  static async confirmSwapRequest(
    requestId: string,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('confirm_swap_request', {
      p_request_id: requestId,
      p_requester_id: userId,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Elder approves or denies a swap
   * Step 4 (optional): Elder approval
   */
  static async elderDecideSwap(
    requestId: string,
    approve: boolean,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('elder_decide_swap', {
      p_request_id: requestId,
      p_elder_id: userId,
      p_approve: approve,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Cancel a swap request
   */
  static async cancelSwapRequest(
    requestId: string,
    reason?: string
  ): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('cancel_swap_request', {
      p_request_id: requestId,
      p_user_id: userId,
      p_reason: reason || null
    });

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAP REQUEST QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get a swap request by ID
   */
  static async getSwapRequest(requestId: string): Promise<PositionSwapRequest | null> {
    const { data, error } = await supabase
      .from('position_swap_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get swap request with full details (view)
   */
  static async getSwapRequestFull(requestId: string): Promise<PositionSwapRequest | null> {
    const { data, error } = await supabase
      .from('v_swap_requests_full')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get all swap requests for a circle
   */
  static async getCircleSwapRequests(
    circleId: string,
    status?: SwapRequestStatus
  ): Promise<PositionSwapRequest[]> {
    let query = supabase
      .from('v_swap_requests_full')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('swap_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  /**
   * Get pending swap requests for current user (as target)
   */
  static async getPendingSwapRequestsForUser(): Promise<PendingSwapRequest[]> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase.rpc('get_pending_swap_requests_for_user', {
      p_user_id: userId
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get swap requests awaiting confirmation (as requester)
   */
  static async getSwapRequestsAwaitingConfirmation(): Promise<SwapAwaitingConfirmation[]> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase.rpc('get_swap_requests_awaiting_confirmation', {
      p_user_id: userId
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get swap requests pending Elder approval (for Elders)
   */
  static async getSwapRequestsPendingElderApproval(
    circleId: string
  ): Promise<SwapPendingElderApproval[]> {
    const { data, error } = await supabase.rpc('get_swap_requests_pending_elder_approval', {
      p_circle_id: circleId
    });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's swap requests (initiated by user)
   */
  static async getUserSwapRequests(
    status?: SwapRequestStatus
  ): Promise<PositionSwapRequest[]> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return [];

    let query = supabase
      .from('v_swap_requests_full')
      .select('*')
      .eq('requester_user_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('swap_status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAP EVENTS & HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get events for a swap request
   */
  static async getSwapEvents(requestId: string): Promise<SwapEvent[]> {
    const { data, error } = await supabase
      .from('position_swap_events')
      .select('*')
      .eq('swap_request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get user's swap history
   */
  static async getUserSwapHistory(userId?: string): Promise<MemberSwapHistory[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('v_swap_history_summary')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get swap history for a circle
   */
  static async getCircleSwapHistory(circleId: string): Promise<MemberSwapHistory[]> {
    const { data, error } = await supabase
      .from('v_swap_history_summary')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get swap statistics for a circle
   */
  static async getCircleSwapStatistics(circleId: string): Promise<CircleSwapStatistics | null> {
    const { data, error } = await supabase
      .from('v_circle_swap_statistics')
      .select('*')
      .eq('circle_id', circleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMBER QUERIES FOR SWAP UI
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get circle members available for swapping
   */
  static async getCircleMembersForSwap(circleId: string): Promise<CircleMemberForSwap[]> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    // Get all active members
    const { data: members, error: membersError } = await supabase
      .from('circle_members')
      .select(`
        user_id,
        position,
        profiles:user_id (
          full_name,
          xn_score,
          avatar_url
        )
      `)
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .neq('user_id', userId)
      .order('position', { ascending: true });

    if (membersError) throw membersError;

    // Check swap availability for each member
    const results: CircleMemberForSwap[] = [];

    for (const member of members || []) {
      const canSwapResult = await this.canRequestSwap(circleId, member.user_id);
      const profile = member.profiles as any;

      results.push({
        user_id: member.user_id,
        full_name: profile?.full_name || 'Unknown',
        position: member.position,
        xn_score: profile?.xn_score || 50,
        avatar_url: profile?.avatar_url,
        can_swap_with: canSwapResult.allowed,
        swap_blocked_reason: canSwapResult.allowed ? undefined : canSwapResult.reason
      });
    }

    return results;
  }

  /**
   * Get current user's position in a circle
   */
  static async getCurrentUserPosition(circleId: string): Promise<number | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    const { data, error } = await supabase
      .from('circle_members')
      .select('position')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) return null;
    return data?.position || null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Format swap status for display
   */
  static formatSwapStatus(status: SwapRequestStatus): string {
    const statusMap: Record<SwapRequestStatus, string> = {
      pending_target: 'Awaiting Response',
      pending_confirmation: 'Awaiting Your Confirmation',
      pending_elder_approval: 'Awaiting Elder Approval',
      approved: 'Approved',
      executing: 'Processing',
      completed: 'Completed',
      rejected: 'Declined',
      cancelled: 'Cancelled',
      expired: 'Expired',
      elder_denied: 'Elder Denied'
    };
    return statusMap[status] || status;
  }

  /**
   * Get color for swap status (for UI)
   */
  static getSwapStatusColor(status: SwapRequestStatus): string {
    const colorMap: Record<SwapRequestStatus, string> = {
      pending_target: '#F59E0B',      // Amber
      pending_confirmation: '#F59E0B', // Amber
      pending_elder_approval: '#8B5CF6', // Purple
      approved: '#10B981',             // Green
      executing: '#3B82F6',            // Blue
      completed: '#10B981',            // Green
      rejected: '#EF4444',             // Red
      cancelled: '#6B7280',            // Gray
      expired: '#6B7280',              // Gray
      elder_denied: '#EF4444'          // Red
    };
    return colorMap[status] || '#6B7280';
  }

  /**
   * Format event type for display
   */
  static formatEventType(eventType: SwapEventType): string {
    const eventMap: Record<SwapEventType, string> = {
      request_created: 'Request Created',
      target_accepted: 'Accepted by Target',
      target_rejected: 'Declined by Target',
      requester_confirmed: 'Confirmed by Requester',
      requester_cancelled: 'Cancelled',
      elder_approved: 'Approved by Elder',
      elder_denied: 'Denied by Elder',
      swap_executed: 'Swap Completed',
      swap_expired: 'Request Expired',
      request_withdrawn: 'Request Withdrawn'
    };
    return eventMap[eventType] || eventType;
  }

  /**
   * Get icon for event type (for UI)
   */
  static getEventTypeIcon(eventType: SwapEventType): string {
    const iconMap: Record<SwapEventType, string> = {
      request_created: '📤',
      target_accepted: '✅',
      target_rejected: '❌',
      requester_confirmed: '🔐',
      requester_cancelled: '🚫',
      elder_approved: '👍',
      elder_denied: '👎',
      swap_executed: '🔄',
      swap_expired: '⏰',
      request_withdrawn: '↩️'
    };
    return iconMap[eventType] || '📝';
  }

  /**
   * Calculate time remaining until expiry
   */
  static getTimeRemaining(expiresAt: string): {
    hours: number;
    minutes: number;
    isExpired: boolean;
    formatted: string;
  } {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();

    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, isExpired: true, formatted: 'Expired' };
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    let formatted: string;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      formatted = `${days}d ${hours % 24}h remaining`;
    } else if (hours > 0) {
      formatted = `${hours}h ${minutes}m remaining`;
    } else {
      formatted = `${minutes}m remaining`;
    }

    return { hours, minutes, isExpired: false, formatted };
  }

  /**
   * Check if cooling off period has ended
   */
  static isCoolingOffComplete(coolingOffEndsAt?: string): boolean {
    if (!coolingOffEndsAt) return true;
    return new Date(coolingOffEndsAt) <= new Date();
  }

  /**
   * Get swap direction description
   */
  static getSwapDirectionDescription(
    oldPosition: number,
    newPosition: number
  ): string {
    if (oldPosition < newPosition) {
      return `Moved back from Position ${oldPosition} to Position ${newPosition} (generous)`;
    } else {
      return `Moved forward from Position ${oldPosition} to Position ${newPosition}`;
    }
  }

  /**
   * Check if user has any pending swaps in a circle
   */
  static async hasPendingSwaps(circleId: string): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return false;

    const { count, error } = await supabase
      .from('position_swap_requests')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .in('swap_status', ['pending_target', 'pending_confirmation', 'pending_elder_approval', 'approved'])
      .or(`requester_user_id.eq.${userId},target_user_id.eq.${userId}`);

    if (error) throw error;
    return (count || 0) > 0;
  }

  /**
   * Get count of swaps this cycle for a member
   */
  static async getMemberSwapCountThisCycle(
    circleId: string,
    userId?: string
  ): Promise<number> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return 0;

    // Get current cycle
    const { data: circle } = await supabase
      .from('circles')
      .select('current_cycle')
      .eq('id', circleId)
      .single();

    const currentCycle = circle?.current_cycle || 1;

    const { count, error } = await supabase
      .from('member_swap_history')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('user_id', targetUserId)
      .eq('cycle_number', currentCycle);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Subscribe to swap request updates (realtime)
   */
  static subscribeToSwapRequest(
    requestId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`swap_request_${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'position_swap_requests',
          filter: `id=eq.${requestId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to swap events (realtime)
   */
  static subscribeToSwapEvents(
    requestId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`swap_events_${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'position_swap_events',
          filter: `swap_request_id=eq.${requestId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to pending swap requests for user
   */
  static subscribeToUserPendingSwaps(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`user_pending_swaps_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'position_swap_requests',
          filter: `target_user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
}

export default PositionSwapEngine;
