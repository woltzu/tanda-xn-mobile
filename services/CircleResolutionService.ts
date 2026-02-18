// services/CircleResolutionService.ts
// Circle Resolution Service - Handles how circles deal with default shortfalls
// Manages reserve coverage, redistribution requests, and payout adjustments

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CircleResolution {
  id: string;
  defaultId: string;
  cascadeId: string;
  circleId: string;
  cycleId: string;
  shortfallAmount: number;
  resolutionMethod: string;
  amountFromReserve: number;
  amountFromRedistribution: number;
  amountReducedFromPayout: number;
  recipientUserId: string;
  originalPayoutAmount: number;
  actualPayoutAmount: number;
  payoutReduction: number;
  redistributionRequestId: string | null;
  membersWhoContributed: number;
  resolutionStatus: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface RedistributionRequest {
  id: string;
  cycleId: string;
  circleId: string;
  defaultedUserId: string;
  totalAmount: number;
  amountPerMember: number;
  membersRequested: number;
  membersAccepted: number;
  amountCollected: number;
  requestStatus: string;
  expiresAt: string;
  createdAt: string;
}

export interface RedistributionResponse {
  id: string;
  redistributionId: string;
  userId: string;
  requestedAmount: number;
  responseStatus: string;
  respondedAt: string | null;
  paidAt: string | null;
  paidAmount: number | null;
}

export type ResolutionPolicy =
  | 'reduced_payout'
  | 'reserve_full_cover'
  | 'reserve_partial_cover'
  | 'redistribution'
  | 'hybrid';

// ============================================================================
// CIRCLE RESOLUTION SERVICE
// ============================================================================

export class CircleResolutionService {

  // --------------------------------------------------------------------------
  // RESOLUTION RETRIEVAL
  // --------------------------------------------------------------------------

  /**
   * Get resolution details for a default
   */
  async getResolution(defaultId: string): Promise<CircleResolution | null> {
    const { data, error } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .eq('default_id', defaultId)
      .single();

    if (error || !data) return null;

    return this.mapResolution(data);
  }

  /**
   * Get all resolutions for a circle
   */
  async getCircleResolutions(circleId: string): Promise<CircleResolution[]> {
    const { data, error } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapResolution);
  }

  /**
   * Get resolutions affecting a specific recipient
   */
  async getRecipientResolutions(recipientUserId: string): Promise<CircleResolution[]> {
    const { data, error } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .eq('recipient_user_id', recipientUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapResolution);
  }

  private mapResolution(data: any): CircleResolution {
    return {
      id: data.id,
      defaultId: data.default_id,
      cascadeId: data.cascade_id,
      circleId: data.circle_id,
      cycleId: data.cycle_id,
      shortfallAmount: data.shortfall_amount,
      resolutionMethod: data.resolution_method,
      amountFromReserve: data.amount_from_reserve || 0,
      amountFromRedistribution: data.amount_from_redistribution || 0,
      amountReducedFromPayout: data.amount_reduced_from_payout || 0,
      recipientUserId: data.recipient_user_id,
      originalPayoutAmount: data.original_payout_amount,
      actualPayoutAmount: data.actual_payout_amount,
      payoutReduction: data.payout_reduction || 0,
      redistributionRequestId: data.redistribution_request_id,
      membersWhoContributed: data.members_who_contributed || 0,
      resolutionStatus: data.resolution_status,
      resolvedAt: data.resolved_at,
      createdAt: data.created_at
    };
  }

  // --------------------------------------------------------------------------
  // REDISTRIBUTION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get redistribution request details
   */
  async getRedistributionRequest(requestId: string): Promise<RedistributionRequest | null> {
    const { data, error } = await supabase
      .from('redistribution_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      cycleId: data.cycle_id,
      circleId: data.circle_id,
      defaultedUserId: data.defaulted_user_id,
      totalAmount: data.total_amount,
      amountPerMember: data.amount_per_member,
      membersRequested: data.members_requested,
      membersAccepted: data.members_accepted,
      amountCollected: data.amount_collected,
      requestStatus: data.request_status,
      expiresAt: data.expires_at,
      createdAt: data.created_at
    };
  }

  /**
   * Get active redistribution requests for a circle
   */
  async getActiveRedistributionRequests(circleId: string): Promise<RedistributionRequest[]> {
    const { data, error } = await supabase
      .from('redistribution_requests')
      .select('*')
      .eq('circle_id', circleId)
      .in('request_status', ['pending', 'partially_filled'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(d => ({
      id: d.id,
      cycleId: d.cycle_id,
      circleId: d.circle_id,
      defaultedUserId: d.defaulted_user_id,
      totalAmount: d.total_amount,
      amountPerMember: d.amount_per_member,
      membersRequested: d.members_requested,
      membersAccepted: d.members_accepted,
      amountCollected: d.amount_collected,
      requestStatus: d.request_status,
      expiresAt: d.expires_at,
      createdAt: d.created_at
    }));
  }

  /**
   * Get user's pending redistribution responses
   */
  async getUserPendingRedistributions(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('redistribution_responses')
      .select(`
        *,
        redistribution_requests (
          id,
          circle_id,
          total_amount,
          amount_per_member,
          expires_at,
          circles (name)
        )
      `)
      .eq('user_id', userId)
      .eq('response_status', 'pending');

    if (error) throw error;

    return (data || []).map(r => ({
      responseId: r.id,
      redistributionId: r.redistribution_id,
      requestedAmount: r.requested_amount,
      circleName: (r.redistribution_requests as any)?.circles?.name || 'Unknown',
      totalShortfall: (r.redistribution_requests as any)?.total_amount,
      expiresAt: (r.redistribution_requests as any)?.expires_at
    }));
  }

  /**
   * Accept a redistribution request
   */
  async acceptRedistribution(
    responseId: string,
    userId: string,
    amount?: number
  ): Promise<{ success: boolean; error?: string }> {
    // Get the response
    const { data: response, error: fetchError } = await supabase
      .from('redistribution_responses')
      .select(`
        *,
        redistribution_requests (*)
      `)
      .eq('id', responseId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !response) {
      return { success: false, error: 'Response not found' };
    }

    if (response.response_status !== 'pending') {
      return { success: false, error: 'Response is no longer pending' };
    }

    const redistribution = response.redistribution_requests as any;

    // Check if expired
    if (new Date(redistribution.expires_at) < new Date()) {
      return { success: false, error: 'Redistribution request has expired' };
    }

    const contributionAmount = amount || response.requested_amount;

    // Update response
    await supabase
      .from('redistribution_responses')
      .update({
        response_status: 'accepted',
        responded_at: new Date().toISOString()
      })
      .eq('id', responseId);

    // Update redistribution totals
    const newAccepted = redistribution.members_accepted + 1;
    const newCollected = redistribution.amount_collected + contributionAmount;

    let newStatus = redistribution.request_status;
    if (newCollected >= redistribution.total_amount) {
      newStatus = 'filled';
    } else if (newAccepted > 0) {
      newStatus = 'partially_filled';
    }

    await supabase
      .from('redistribution_requests')
      .update({
        members_accepted: newAccepted,
        amount_collected: newCollected,
        request_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', redistribution.id);

    // If fully filled, complete the resolution
    if (newStatus === 'filled') {
      await this.completeRedistributionResolution(redistribution.id);
    }

    return { success: true };
  }

  /**
   * Decline a redistribution request
   */
  async declineRedistribution(
    responseId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('redistribution_responses')
      .update({
        response_status: 'declined',
        responded_at: new Date().toISOString()
      })
      .eq('id', responseId)
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Complete redistribution resolution
   */
  private async completeRedistributionResolution(redistributionId: string): Promise<void> {
    // Get redistribution details
    const { data: redistribution } = await supabase
      .from('redistribution_requests')
      .select('*')
      .eq('id', redistributionId)
      .single();

    if (!redistribution) return;

    // Get the resolution record
    const { data: resolution } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .eq('redistribution_request_id', redistributionId)
      .single();

    if (!resolution) return;

    // Count contributors
    const { count: contributors } = await supabase
      .from('redistribution_responses')
      .select('*', { count: 'exact', head: true })
      .eq('redistribution_id', redistributionId)
      .eq('response_status', 'accepted');

    // Update resolution
    await supabase
      .from('circle_default_resolutions')
      .update({
        amount_from_redistribution: redistribution.amount_collected,
        members_who_contributed: contributors || 0,
        actual_payout_amount: resolution.original_payout_amount,
        payout_reduction: 0,
        resolution_status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', resolution.id);

    // Notify recipient that their payout is protected
    await supabase.from('scheduled_notifications').insert({
      user_id: resolution.recipient_user_id,
      notification_type: 'payout_protected_by_redistribution',
      scheduled_for: new Date().toISOString(),
      notification_status: 'pending',
      payload: {
        circleId: redistribution.circle_id,
        originalAmount: resolution.original_payout_amount,
        contributors: contributors || 0
      }
    });
  }

  /**
   * Process expired redistribution requests (called by cron)
   */
  async processExpiredRedistributions(): Promise<{ processed: number; completed: number }> {
    // Find expired pending/partial redistributions
    const { data: expired } = await supabase
      .from('redistribution_requests')
      .select('*')
      .in('request_status', ['pending', 'partially_filled'])
      .lt('expires_at', new Date().toISOString());

    if (!expired || expired.length === 0) {
      return { processed: 0, completed: 0 };
    }

    let completed = 0;

    for (const redistribution of expired) {
      // Update status to expired
      await supabase
        .from('redistribution_requests')
        .update({
          request_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', redistribution.id);

      // Get the resolution
      const { data: resolution } = await supabase
        .from('circle_default_resolutions')
        .select('*')
        .eq('redistribution_request_id', redistribution.id)
        .single();

      if (resolution) {
        // Calculate final payout with partial coverage
        const totalCoverage = (resolution.amount_from_reserve || 0) + redistribution.amount_collected;
        const remainingShortfall = resolution.shortfall_amount - totalCoverage;
        const actualPayout = resolution.original_payout_amount - remainingShortfall;

        // Update resolution as resolved with partial coverage
        await supabase
          .from('circle_default_resolutions')
          .update({
            amount_from_redistribution: redistribution.amount_collected,
            amount_reduced_from_payout: remainingShortfall,
            actual_payout_amount: actualPayout,
            payout_reduction: remainingShortfall,
            resolution_status: redistribution.amount_collected > 0 ? 'partial' : 'resolved',
            resolved_at: new Date().toISOString()
          })
          .eq('id', resolution.id);

        // Notify recipient
        await supabase.from('scheduled_notifications').insert({
          user_id: resolution.recipient_user_id,
          notification_type: 'redistribution_expired',
          scheduled_for: new Date().toISOString(),
          notification_status: 'pending',
          payload: {
            circleId: redistribution.circle_id,
            originalAmount: resolution.original_payout_amount,
            actualAmount: actualPayout,
            reduction: remainingShortfall,
            partialCoverageCollected: redistribution.amount_collected
          }
        });

        completed++;
      }
    }

    return { processed: expired.length, completed };
  }

  // --------------------------------------------------------------------------
  // RESERVE FUND MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Get reserve fund balance for a circle
   */
  async getReserveBalance(circleId: string): Promise<number> {
    const { data } = await supabase
      .from('reserve_funds')
      .select('balance')
      .eq('circle_id', circleId)
      .single();

    return data?.balance || 0;
  }

  /**
   * Get reserve fund usage history
   */
  async getReserveUsageHistory(circleId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('circle_default_resolutions')
      .select(`
        id,
        default_id,
        shortfall_amount,
        amount_from_reserve,
        resolution_method,
        created_at,
        defaults (
          user_id,
          profiles:user_id (full_name)
        )
      `)
      .eq('circle_id', circleId)
      .gt('amount_from_reserve', 0)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(r => ({
      resolutionId: r.id,
      defaultId: r.default_id,
      defaulterName: (r.defaults as any)?.profiles?.full_name || 'Unknown',
      shortfallAmount: r.shortfall_amount,
      amountCovered: r.amount_from_reserve,
      resolutionMethod: r.resolution_method,
      date: r.created_at
    }));
  }

  /**
   * Calculate reserve coverage capacity
   */
  async calculateReserveCoverage(circleId: string, shortfallAmount: number): Promise<{
    canFullyCover: boolean;
    maxCoverage: number;
    percentageCoverable: number;
  }> {
    const balance = await this.getReserveBalance(circleId);

    // Policy: Max 25% of reserve for single default
    const maxCoverage = balance * 0.25;

    return {
      canFullyCover: shortfallAmount <= maxCoverage,
      maxCoverage: Math.min(maxCoverage, shortfallAmount),
      percentageCoverable: balance > 0
        ? Math.min(100, (maxCoverage / shortfallAmount) * 100)
        : 0
    };
  }

  // --------------------------------------------------------------------------
  // RESOLUTION STATISTICS
  // --------------------------------------------------------------------------

  /**
   * Get resolution statistics for a circle
   */
  async getCircleResolutionStats(circleId: string): Promise<{
    totalDefaults: number;
    totalShortfall: number;
    totalFromReserve: number;
    totalFromRedistribution: number;
    totalPayoutReductions: number;
    avgPayoutReductionPercent: number;
    resolutionMethodBreakdown: Record<string, number>;
  }> {
    const { data: resolutions } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .eq('circle_id', circleId);

    if (!resolutions || resolutions.length === 0) {
      return {
        totalDefaults: 0,
        totalShortfall: 0,
        totalFromReserve: 0,
        totalFromRedistribution: 0,
        totalPayoutReductions: 0,
        avgPayoutReductionPercent: 0,
        resolutionMethodBreakdown: {}
      };
    }

    const totalShortfall = resolutions.reduce((sum, r) => sum + (r.shortfall_amount || 0), 0);
    const totalFromReserve = resolutions.reduce((sum, r) => sum + (r.amount_from_reserve || 0), 0);
    const totalFromRedistribution = resolutions.reduce((sum, r) => sum + (r.amount_from_redistribution || 0), 0);
    const totalPayoutReductions = resolutions.reduce((sum, r) => sum + (r.payout_reduction || 0), 0);

    const totalOriginalPayouts = resolutions.reduce((sum, r) => sum + (r.original_payout_amount || 0), 0);
    const avgPayoutReductionPercent = totalOriginalPayouts > 0
      ? (totalPayoutReductions / totalOriginalPayouts) * 100
      : 0;

    const resolutionMethodBreakdown: Record<string, number> = {};
    for (const r of resolutions) {
      resolutionMethodBreakdown[r.resolution_method] = (resolutionMethodBreakdown[r.resolution_method] || 0) + 1;
    }

    return {
      totalDefaults: resolutions.length,
      totalShortfall,
      totalFromReserve,
      totalFromRedistribution,
      totalPayoutReductions,
      avgPayoutReductionPercent: Math.round(avgPayoutReductionPercent * 100) / 100,
      resolutionMethodBreakdown
    };
  }

  /**
   * Get platform-wide resolution statistics
   */
  async getPlatformResolutionStats(daysPeriod: number = 90): Promise<{
    totalResolutions: number;
    byMethod: Record<string, number>;
    totalRecoveredFromReserve: number;
    totalRecoveredFromRedistribution: number;
    avgRedistributionParticipation: number;
  }> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysPeriod);

    const { data: resolutions } = await supabase
      .from('circle_default_resolutions')
      .select('*')
      .gte('created_at', periodStart.toISOString());

    if (!resolutions || resolutions.length === 0) {
      return {
        totalResolutions: 0,
        byMethod: {},
        totalRecoveredFromReserve: 0,
        totalRecoveredFromRedistribution: 0,
        avgRedistributionParticipation: 0
      };
    }

    const byMethod: Record<string, number> = {};
    for (const r of resolutions) {
      byMethod[r.resolution_method] = (byMethod[r.resolution_method] || 0) + 1;
    }

    const redistributionResolutions = resolutions.filter(r => r.redistribution_request_id);
    const avgRedistributionParticipation = redistributionResolutions.length > 0
      ? redistributionResolutions.reduce((sum, r) => sum + (r.members_who_contributed || 0), 0) / redistributionResolutions.length
      : 0;

    return {
      totalResolutions: resolutions.length,
      byMethod,
      totalRecoveredFromReserve: resolutions.reduce((sum, r) => sum + (r.amount_from_reserve || 0), 0),
      totalRecoveredFromRedistribution: resolutions.reduce((sum, r) => sum + (r.amount_from_redistribution || 0), 0),
      avgRedistributionParticipation: Math.round(avgRedistributionParticipation * 100) / 100
    };
  }
}

// Export singleton instance
export const circleResolutionService = new CircleResolutionService();
