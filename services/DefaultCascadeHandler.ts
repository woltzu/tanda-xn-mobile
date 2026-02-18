// services/DefaultCascadeHandler.ts
// Default Cascade Handler - Where one person's failure ripples through the trust network
// This is the digital equivalent of traditional tontine social consequences

import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface DefaultRecord {
  id: string;
  user_id: string;
  circle_id: string;
  community_id: string;
  cycle_id: string;
  cycle_number: number;
  late_contribution_id: string | null;
  original_amount: number;
  late_fees: number;
  total_owed: number;
  amount_recovered: number;
  default_status: 'unresolved' | 'partial_recovery' | 'fully_recovered' | 'written_off' | 'forgiven' | 'disputed';
  cascade_id: string;
  cascade_completed: boolean;
  xnscore_impact_applied: number | null;
  voucher_impacts_applied: number;
  is_repeat_offender: boolean;
  triggered_suspension_review: boolean;
  recovery_plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CascadeResult {
  cascadeId: string;
  defaultId: string;
  steps: CascadeStep[];
  errors: CascadeError[];
  completed: boolean;
}

export interface CascadeStep {
  step: string;
  success: boolean;
  data: Record<string, any>;
  timestamp: string;
}

export interface CascadeError {
  step: string;
  error: string;
  timestamp: string;
}

export interface VoucherImpact {
  vouchId: string;
  voucherUserId: string;
  impact: number;
  previousScore: number;
  newScore: number;
  totalVoucheeDefaults: number;
  reliabilityStatus: 'good' | 'warning' | 'poor' | 'restricted';
  triggeredRestriction: boolean;
}

export interface CircleResolution {
  method: string;
  shortfallAmount: number;
  amountFromReserve: number;
  amountFromRedistribution: number;
  recipientReduction: number;
  actualPayout: number;
  redistributionId?: string;
}

export interface RecoveryOption {
  id: string;
  type: 'lump_sum' | 'installments';
  amount?: number;
  numberOfInstallments?: number;
  installmentAmount?: number;
  frequency?: string;
  duration?: string;
  xnscoreRecoveryBonus: number;
  description: string;
  benefits?: string[];
  note?: string;
}

// ============================================================================
// MAIN CASCADE ORCHESTRATOR
// ============================================================================

export class DefaultCascadeHandler {

  /**
   * Execute the complete default cascade
   * This is the main entry point when a default occurs
   */
  async executeDefaultCascade(defaultId: string): Promise<CascadeResult> {
    // Fetch the default record
    const { data: defaultRecord, error: fetchError } = await supabase
      .from('defaults')
      .select('*')
      .eq('id', defaultId)
      .single();

    if (fetchError || !defaultRecord) {
      throw new Error(`Default ${defaultId} not found`);
    }

    // Generate cascade ID to track all related events
    const cascadeId = uuidv4();

    // Update default with cascade ID
    await supabase
      .from('defaults')
      .update({
        cascade_id: cascadeId,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultId);

    // Log cascade start
    await this.logCascadeEvent(cascadeId, defaultId, 'cascade_started', 'defaulter', defaultRecord.user_id, {
      defaulterId: defaultRecord.user_id,
      circleId: defaultRecord.circle_id,
      amount: defaultRecord.total_owed
    });

    const cascadeResult: CascadeResult = {
      cascadeId,
      defaultId,
      steps: [],
      errors: [],
      completed: false
    };

    try {
      // ═══════════════════════════════════════════════════════════════════
      // STEP 1: Apply XnScore impact to defaulter
      // ═══════════════════════════════════════════════════════════════════

      const defaulterImpact = await this.applyDefaulterXnScoreImpact(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'defaulter_xnscore',
        success: true,
        data: defaulterImpact,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 2: Process voucher cascade
      // ═══════════════════════════════════════════════════════════════════

      const voucherImpacts = await this.processVoucherCascade(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'voucher_cascade',
        success: true,
        data: { impacts: voucherImpacts, count: voucherImpacts.length },
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 3: Resolve circle impact (handle the shortfall)
      // ═══════════════════════════════════════════════════════════════════

      const circleResolution = await this.resolveCircleImpact(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'circle_resolution',
        success: true,
        data: circleResolution,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 4: Apply defaulter restrictions
      // ═══════════════════════════════════════════════════════════════════

      const restrictions = await this.applyDefaulterRestrictions(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'restrictions',
        success: true,
        data: restrictions,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 5: Evaluate impact on other circles
      // ═══════════════════════════════════════════════════════════════════

      const otherCircleActions = await this.evaluateOtherCircleImpact(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'other_circles',
        success: true,
        data: otherCircleActions,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 6: Update community health metrics
      // ═══════════════════════════════════════════════════════════════════

      const communityUpdate = await this.updateCommunityHealth(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'community_health',
        success: true,
        data: communityUpdate,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 7: Check for repeat offender / suspension review
      // ═══════════════════════════════════════════════════════════════════

      const offenderCheck = await this.checkRepeatOffender(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'offender_check',
        success: true,
        data: offenderCheck,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 8: Set up recovery path
      // ═══════════════════════════════════════════════════════════════════

      const recoveryPath = await this.setupRecoveryPath(defaultRecord, cascadeId);
      cascadeResult.steps.push({
        step: 'recovery_path',
        success: true,
        data: recoveryPath,
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // STEP 9: Send all notifications
      // ═══════════════════════════════════════════════════════════════════

      const notifications = await this.sendCascadeNotifications(defaultRecord, cascadeId, cascadeResult);
      cascadeResult.steps.push({
        step: 'notifications',
        success: true,
        data: { count: notifications },
        timestamp: new Date().toISOString()
      });

      // ═══════════════════════════════════════════════════════════════════
      // FINALIZE
      // ═══════════════════════════════════════════════════════════════════

      await supabase
        .from('defaults')
        .update({
          cascade_completed: true,
          cascade_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', defaultId);

      await this.logCascadeEvent(cascadeId, defaultId, 'cascade_completed', 'system', null, {
        stepsCompleted: cascadeResult.steps.length,
        errors: cascadeResult.errors.length
      });

      cascadeResult.completed = true;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      cascadeResult.errors.push({
        step: 'cascade_execution',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });

      await this.logCascadeEvent(cascadeId, defaultId, 'cascade_error', 'system', null, {
        error: errorMessage
      });

      // Alert ops for manual intervention
      await this.alertOps('cascade_failed', {
        cascadeId,
        defaultId,
        error: errorMessage
      });
    }

    return cascadeResult;
  }

  // --------------------------------------------------------------------------
  // STEP 1: DEFAULTER XNSCORE IMPACT
  // --------------------------------------------------------------------------

  private async applyDefaulterXnScoreImpact(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{ userId: string; previousScore: number; impact: number; newScore: number; isRepeatOffender: boolean }> {

    // Get current XnScore
    const { data: xnScoreData } = await supabase
      .from('xn_score_history')
      .select('new_score')
      .eq('user_id', defaultRecord.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const currentScore = xnScoreData?.new_score || 500;

    // Base impact is -30
    let impact = -30;

    // Get circle info for high-value check
    const { data: circle } = await supabase
      .from('circles')
      .select('contribution_amount')
      .eq('id', defaultRecord.circle_id)
      .single();

    // Additional penalty for high-value circles
    if (circle && circle.contribution_amount >= 500) {
      impact -= 5;
    }

    // Check for previous defaults in last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { count: previousDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', defaultRecord.user_id)
      .neq('id', defaultRecord.id)
      .gte('created_at', twelveMonthsAgo.toISOString());

    const prevDefaultCount = previousDefaults || 0;

    // Additional penalty for repeat offenders
    if (prevDefaultCount > 0) {
      impact -= (prevDefaultCount * 5);
    }

    const newScore = Math.max(0, currentScore + impact);

    // Record XnScore change
    await supabase
      .from('xn_score_history')
      .insert({
        user_id: defaultRecord.user_id,
        previous_score: currentScore,
        change_amount: impact,
        new_score: newScore,
        change_reason: 'contribution_default',
        reference_type: 'default',
        reference_id: defaultRecord.id
      });

    // Update default record
    await supabase
      .from('defaults')
      .update({
        xnscore_impact_applied: impact,
        is_repeat_offender: prevDefaultCount > 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.id);

    // Update user profile
    await supabase
      .from('profiles')
      .update({
        total_defaults: prevDefaultCount + 1,
        is_repeat_offender: prevDefaultCount > 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.user_id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'xnscore_impact_defaulter', 'defaulter', defaultRecord.user_id, {
      previousScore: currentScore,
      impact,
      newScore,
      previousDefaults: prevDefaultCount
    });

    return {
      userId: defaultRecord.user_id,
      previousScore: currentScore,
      impact,
      newScore,
      isRepeatOffender: prevDefaultCount > 0
    };
  }

  // --------------------------------------------------------------------------
  // STEP 2: VOUCHER CASCADE
  // --------------------------------------------------------------------------

  private async processVoucherCascade(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<VoucherImpact[]> {

    // Find all active vouches for the defaulter
    const { data: vouches } = await supabase
      .from('vouches')
      .select('*')
      .eq('vouchee_id', defaultRecord.user_id)
      .eq('vouch_status', 'active');

    if (!vouches || vouches.length === 0) {
      return [];
    }

    const impacts: VoucherImpact[] = [];

    for (const vouch of vouches) {
      try {
        const impact = await this.applyVoucherImpact(vouch, defaultRecord, cascadeId);
        impacts.push(impact);
      } catch (error) {
        console.error(`Failed to apply voucher impact for vouch ${vouch.id}:`, error);
      }
    }

    // Update default record with voucher impact count
    await supabase
      .from('defaults')
      .update({
        voucher_impacts_applied: impacts.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.id);

    return impacts;
  }

  private async applyVoucherImpact(
    vouch: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<VoucherImpact> {

    const voucherUserId = vouch.voucher_id;

    // Get voucher's current XnScore
    const { data: xnScoreData } = await supabase
      .from('xn_score_history')
      .select('new_score')
      .eq('user_id', voucherUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const currentScore = xnScoreData?.new_score || 500;
    const impact = -5; // Standard voucher penalty
    const newScore = Math.max(0, currentScore + impact);

    // Record XnScore change
    await supabase
      .from('xn_score_history')
      .insert({
        user_id: voucherUserId,
        previous_score: currentScore,
        change_amount: impact,
        new_score: newScore,
        change_reason: 'vouchee_default',
        reference_type: 'default',
        reference_id: defaultRecord.id
      });

    // Count total vouchee defaults for this voucher
    const { count: existingImpacts } = await supabase
      .from('voucher_default_impacts')
      .select('*', { count: 'exact', head: true })
      .eq('voucher_user_id', voucherUserId);

    const totalVoucheeDefaults = (existingImpacts || 0) + 1;

    // Determine reliability status
    let reliabilityStatus: 'good' | 'warning' | 'poor' | 'restricted' = 'good';
    let triggeredRestriction = false;

    if (totalVoucheeDefaults >= 5) {
      reliabilityStatus = 'restricted';
      triggeredRestriction = true;
    } else if (totalVoucheeDefaults >= 3) {
      reliabilityStatus = 'poor';
    } else if (totalVoucheeDefaults >= 2) {
      reliabilityStatus = 'warning';
    }

    // Record the impact
    await supabase
      .from('voucher_default_impacts')
      .insert({
        default_id: defaultRecord.id,
        cascade_id: cascadeId,
        vouch_id: vouch.id,
        voucher_user_id: voucherUserId,
        defaulter_user_id: defaultRecord.user_id,
        community_id: defaultRecord.community_id,
        xnscore_impact: impact,
        xnscore_before: currentScore,
        xnscore_after: newScore,
        voucher_total_vouchee_defaults: totalVoucheeDefaults,
        voucher_reliability_status: reliabilityStatus,
        triggered_restriction: triggeredRestriction
      });

    // Update the vouch record
    await supabase
      .from('vouches')
      .update({
        vouchee_default_count: totalVoucheeDefaults,
        last_vouchee_default_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', vouch.id);

    // If triggered restriction, apply it
    if (triggeredRestriction) {
      await this.applyVoucherRestriction(voucherUserId, defaultRecord, cascadeId, totalVoucheeDefaults);
    }

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'voucher_impact_applied', 'voucher', voucherUserId, {
      impact,
      previousScore: currentScore,
      newScore,
      totalVoucheeDefaults,
      reliabilityStatus,
      triggeredRestriction
    });

    return {
      vouchId: vouch.id,
      voucherUserId,
      impact,
      previousScore: currentScore,
      newScore,
      totalVoucheeDefaults,
      reliabilityStatus,
      triggeredRestriction
    };
  }

  private async applyVoucherRestriction(
    voucherUserId: string,
    defaultRecord: DefaultRecord,
    cascadeId: string,
    totalVoucheeDefaults: number
  ): Promise<void> {

    const sixMonthsLater = new Date();
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    // Create restriction
    await supabase
      .from('user_restrictions')
      .insert({
        user_id: voucherUserId,
        default_id: defaultRecord.id,
        reason: 'excessive_vouchee_defaults',
        restriction_type: 'cannot_vouch',
        scope: 'platform',
        is_permanent: false,
        active_until: sixMonthsLater.toISOString(),
        status: 'active'
      });

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'voucher_restricted', 'voucher', voucherUserId, {
      totalVoucheeDefaults,
      restrictionDuration: '6 months',
      activeUntil: sixMonthsLater.toISOString()
    });
  }

  // --------------------------------------------------------------------------
  // STEP 3: CIRCLE IMPACT RESOLUTION
  // --------------------------------------------------------------------------

  private async resolveCircleImpact(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    // Get circle and cycle info
    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('id', defaultRecord.circle_id)
      .single();

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('id', defaultRecord.cycle_id)
      .single();

    if (!circle || !cycle) {
      throw new Error('Circle or cycle not found');
    }

    const shortfallAmount = defaultRecord.total_owed;
    const policy = circle.default_handling_policy || 'reduced_payout';

    // Create resolution record
    const { data: resolution, error: createError } = await supabase
      .from('circle_default_resolutions')
      .insert({
        default_id: defaultRecord.id,
        cascade_id: cascadeId,
        circle_id: circle.id,
        cycle_id: cycle.id,
        shortfall_amount: shortfallAmount,
        resolution_method: policy,
        recipient_user_id: cycle.recipient_user_id,
        original_payout_amount: cycle.expected_payout || (circle.contribution_amount * circle.member_count),
        actual_payout_amount: 0,
        resolution_status: 'pending'
      })
      .select()
      .single();

    if (createError || !resolution) {
      throw new Error('Failed to create resolution record');
    }

    let result: CircleResolution;

    switch (policy) {
      case 'reserve_full_cover':
        result = await this.attemptFullReserveCover(resolution, defaultRecord, cascadeId);
        break;

      case 'reserve_partial_cover':
        result = await this.attemptPartialReserveCover(resolution, defaultRecord, cascadeId);
        break;

      case 'redistribution':
        result = await this.initiateRedistribution(resolution, defaultRecord, cascadeId);
        break;

      case 'hybrid':
        result = await this.executeHybridResolution(resolution, defaultRecord, cascadeId);
        break;

      case 'reduced_payout':
      default:
        result = await this.executeReducedPayout(resolution, defaultRecord, cascadeId);
        break;
    }

    // Update default record
    await supabase
      .from('defaults')
      .update({
        circle_impact_type: result.method,
        circle_impact_amount: result.recipientReduction,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.id);

    return result;
  }

  private async executeReducedPayout(
    resolution: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    const actualPayout = resolution.original_payout_amount - resolution.shortfall_amount;
    const reduction = resolution.shortfall_amount;

    // Update resolution
    await supabase
      .from('circle_default_resolutions')
      .update({
        actual_payout_amount: actualPayout,
        payout_reduction: reduction,
        amount_reduced_from_payout: reduction,
        resolution_status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', resolution.id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'payout_reduced', 'recipient', resolution.recipient_user_id, {
      originalPayout: resolution.original_payout_amount,
      actualPayout,
      reduction,
      method: 'reduced_payout'
    });

    return {
      method: 'reduced_payout',
      shortfallAmount: resolution.shortfall_amount,
      amountFromReserve: 0,
      amountFromRedistribution: 0,
      recipientReduction: reduction,
      actualPayout
    };
  }

  private async attemptFullReserveCover(
    resolution: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    // Get reserve balance
    const { data: reserveFund } = await supabase
      .from('reserve_funds')
      .select('balance')
      .eq('circle_id', defaultRecord.circle_id)
      .single();

    const reserveBalance = reserveFund?.balance || 0;
    const maxReserveCover = reserveBalance * 0.25; // Max 25% of reserve

    if (resolution.shortfall_amount <= maxReserveCover && maxReserveCover > 0) {
      // Can fully cover from reserve

      // Update reserve balance
      await supabase
        .from('reserve_funds')
        .update({
          balance: reserveBalance - resolution.shortfall_amount,
          updated_at: new Date().toISOString()
        })
        .eq('circle_id', defaultRecord.circle_id);

      // Update resolution
      await supabase
        .from('circle_default_resolutions')
        .update({
          amount_from_reserve: resolution.shortfall_amount,
          actual_payout_amount: resolution.original_payout_amount,
          payout_reduction: 0,
          resolution_status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', resolution.id);

      await this.logCascadeEvent(cascadeId, defaultRecord.id, 'reserve_used', 'circle', defaultRecord.circle_id, {
        amountCovered: resolution.shortfall_amount,
        coverageType: 'full',
        reserveBalanceAfter: reserveBalance - resolution.shortfall_amount
      });

      return {
        method: 'reserve_full_cover',
        shortfallAmount: resolution.shortfall_amount,
        amountFromReserve: resolution.shortfall_amount,
        amountFromRedistribution: 0,
        recipientReduction: 0,
        actualPayout: resolution.original_payout_amount
      };
    } else {
      // Can't fully cover - fall back to reduced payout
      return this.executeReducedPayout(resolution, defaultRecord, cascadeId);
    }
  }

  private async attemptPartialReserveCover(
    resolution: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    const { data: reserveFund } = await supabase
      .from('reserve_funds')
      .select('balance')
      .eq('circle_id', defaultRecord.circle_id)
      .single();

    const reserveBalance = reserveFund?.balance || 0;
    const maxReserveCover = Math.min(reserveBalance * 0.25, resolution.shortfall_amount);

    if (maxReserveCover > 0) {
      // Update reserve balance
      await supabase
        .from('reserve_funds')
        .update({
          balance: reserveBalance - maxReserveCover,
          updated_at: new Date().toISOString()
        })
        .eq('circle_id', defaultRecord.circle_id);
    }

    const remainingShortfall = resolution.shortfall_amount - maxReserveCover;
    const actualPayout = resolution.original_payout_amount - remainingShortfall;
    const reduction = remainingShortfall;

    // Update resolution
    await supabase
      .from('circle_default_resolutions')
      .update({
        amount_from_reserve: maxReserveCover,
        amount_reduced_from_payout: reduction,
        actual_payout_amount: actualPayout,
        payout_reduction: reduction,
        resolution_status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', resolution.id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'reserve_partial_cover', 'circle', defaultRecord.circle_id, {
      amountFromReserve: maxReserveCover,
      remainingShortfall,
      actualPayout,
      reduction
    });

    return {
      method: 'reserve_partial_cover',
      shortfallAmount: resolution.shortfall_amount,
      amountFromReserve: maxReserveCover,
      amountFromRedistribution: 0,
      recipientReduction: reduction,
      actualPayout
    };
  }

  private async initiateRedistribution(
    resolution: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    // Get active members except the defaulter
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', defaultRecord.circle_id)
      .eq('member_status', 'active')
      .neq('user_id', defaultRecord.user_id);

    if (!members || members.length === 0) {
      return this.executeReducedPayout(resolution, defaultRecord, cascadeId);
    }

    const amountPerMember = resolution.shortfall_amount / members.length;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Create redistribution request
    const { data: redistribution, error } = await supabase
      .from('redistribution_requests')
      .insert({
        cycle_id: resolution.cycle_id,
        circle_id: defaultRecord.circle_id,
        defaulted_user_id: defaultRecord.user_id,
        total_amount: resolution.shortfall_amount,
        amount_per_member: amountPerMember,
        members_requested: members.length,
        members_accepted: 0,
        amount_collected: 0,
        request_status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error || !redistribution) {
      return this.executeReducedPayout(resolution, defaultRecord, cascadeId);
    }

    // Create response records for each member
    for (const member of members) {
      await supabase
        .from('redistribution_responses')
        .insert({
          redistribution_id: redistribution.id,
          user_id: member.user_id,
          requested_amount: amountPerMember,
          response_status: 'pending'
        });
    }

    // Update resolution
    await supabase
      .from('circle_default_resolutions')
      .update({
        redistribution_request_id: redistribution.id,
        resolution_status: 'pending_redistribution'
      })
      .eq('id', resolution.id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'redistribution_requested', 'circle', defaultRecord.circle_id, {
      redistributionId: redistribution.id,
      totalAmount: resolution.shortfall_amount,
      amountPerMember,
      membersRequested: members.length,
      expiresAt: expiresAt.toISOString()
    });

    return {
      method: 'redistribution_pending',
      shortfallAmount: resolution.shortfall_amount,
      amountFromReserve: 0,
      amountFromRedistribution: 0, // Pending
      recipientReduction: 0, // TBD
      actualPayout: resolution.original_payout_amount, // TBD
      redistributionId: redistribution.id
    };
  }

  private async executeHybridResolution(
    resolution: any,
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<CircleResolution> {

    const { data: reserveFund } = await supabase
      .from('reserve_funds')
      .select('balance')
      .eq('circle_id', defaultRecord.circle_id)
      .single();

    const reserveBalance = reserveFund?.balance || 0;
    const reserveCover = Math.min(reserveBalance * 0.15, resolution.shortfall_amount * 0.5);

    if (reserveCover > 0) {
      await supabase
        .from('reserve_funds')
        .update({
          balance: reserveBalance - reserveCover,
          updated_at: new Date().toISOString()
        })
        .eq('circle_id', defaultRecord.circle_id);
    }

    const remainingShortfall = resolution.shortfall_amount - reserveCover;

    // Initiate redistribution for the remainder
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', defaultRecord.circle_id)
      .eq('member_status', 'active')
      .neq('user_id', defaultRecord.user_id);

    if (!members || members.length === 0) {
      // Fall back to partial reserve + reduced
      const actualPayout = resolution.original_payout_amount - remainingShortfall;

      await supabase
        .from('circle_default_resolutions')
        .update({
          amount_from_reserve: reserveCover,
          amount_reduced_from_payout: remainingShortfall,
          actual_payout_amount: actualPayout,
          payout_reduction: remainingShortfall,
          resolution_status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', resolution.id);

      return {
        method: 'hybrid_partial',
        shortfallAmount: resolution.shortfall_amount,
        amountFromReserve: reserveCover,
        amountFromRedistribution: 0,
        recipientReduction: remainingShortfall,
        actualPayout
      };
    }

    const amountPerMember = remainingShortfall / members.length;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const { data: redistribution } = await supabase
      .from('redistribution_requests')
      .insert({
        cycle_id: resolution.cycle_id,
        circle_id: defaultRecord.circle_id,
        defaulted_user_id: defaultRecord.user_id,
        total_amount: remainingShortfall,
        amount_per_member: amountPerMember,
        members_requested: members.length,
        request_status: 'pending',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (redistribution) {
      for (const member of members) {
        await supabase
          .from('redistribution_responses')
          .insert({
            redistribution_id: redistribution.id,
            user_id: member.user_id,
            requested_amount: amountPerMember,
            response_status: 'pending'
          });
      }
    }

    await supabase
      .from('circle_default_resolutions')
      .update({
        amount_from_reserve: reserveCover,
        redistribution_request_id: redistribution?.id,
        resolution_status: 'pending_redistribution'
      })
      .eq('id', resolution.id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'hybrid_resolution_started', 'circle', defaultRecord.circle_id, {
      amountFromReserve: reserveCover,
      redistributionAmount: remainingShortfall,
      redistributionId: redistribution?.id
    });

    return {
      method: 'hybrid_pending',
      shortfallAmount: resolution.shortfall_amount,
      amountFromReserve: reserveCover,
      amountFromRedistribution: 0,
      recipientReduction: 0,
      actualPayout: resolution.original_payout_amount,
      redistributionId: redistribution?.id
    };
  }

  // --------------------------------------------------------------------------
  // STEP 4: DEFAULTER RESTRICTIONS
  // --------------------------------------------------------------------------

  private async applyDefaulterRestrictions(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{ restrictionsApplied: number; restrictions: Array<{ type: string; reason: string }> }> {

    const restrictions: Array<{ type: string; reason: string }> = [];

    // Count unresolved defaults
    const { count: unresolvedDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', defaultRecord.user_id)
      .eq('default_status', 'unresolved');

    // Restriction 1: Cannot join new circles
    await supabase
      .from('user_restrictions')
      .insert({
        user_id: defaultRecord.user_id,
        default_id: defaultRecord.id,
        reason: 'unresolved_default',
        restriction_type: 'cannot_join_circles',
        scope: 'platform',
        status: 'active'
      });
    restrictions.push({ type: 'cannot_join_circles', reason: 'unresolved_default' });

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'restriction_applied', 'defaulter', defaultRecord.user_id, {
      restrictionType: 'cannot_join_circles',
      reason: 'unresolved_default'
    });

    // Restriction 2: Cannot vouch for others
    await supabase
      .from('user_restrictions')
      .insert({
        user_id: defaultRecord.user_id,
        default_id: defaultRecord.id,
        reason: 'unresolved_default',
        restriction_type: 'cannot_vouch',
        scope: 'platform',
        status: 'active'
      });
    restrictions.push({ type: 'cannot_vouch', reason: 'unresolved_default' });

    // Restriction 3: If multiple defaults, restrict savings withdrawals
    if ((unresolvedDefaults || 0) >= 2) {
      await supabase
        .from('user_restrictions')
        .insert({
          user_id: defaultRecord.user_id,
          default_id: defaultRecord.id,
          reason: 'multiple_defaults',
          restriction_type: 'savings_withdrawal_hold',
          scope: 'platform',
          status: 'active'
        });
      restrictions.push({ type: 'savings_withdrawal_hold', reason: 'multiple_defaults' });

      await this.logCascadeEvent(cascadeId, defaultRecord.id, 'restriction_applied', 'defaulter', defaultRecord.user_id, {
        restrictionType: 'savings_withdrawal_hold',
        reason: 'multiple_defaults',
        unresolvedDefaults
      });
    }

    // Update user record
    await supabase
      .from('profiles')
      .update({
        has_active_restrictions: true,
        restriction_count: restrictions.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.user_id);

    return {
      restrictionsApplied: restrictions.length,
      restrictions
    };
  }

  // --------------------------------------------------------------------------
  // STEP 5: EVALUATE OTHER CIRCLES
  // --------------------------------------------------------------------------

  private async evaluateOtherCircleImpact(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{ circlesEvaluated: number; actions: Array<{ circleId: string; action: string; removed: boolean }> }> {

    // Find other active circles the defaulter is in
    const { data: otherMemberships } = await supabase
      .from('circle_members')
      .select(`
        id,
        circle_id,
        circles (
          id,
          name,
          member_default_policy
        )
      `)
      .eq('user_id', defaultRecord.user_id)
      .neq('circle_id', defaultRecord.circle_id)
      .eq('member_status', 'active');

    if (!otherMemberships || otherMemberships.length === 0) {
      return { circlesEvaluated: 0, actions: [] };
    }

    const actions: Array<{ circleId: string; action: string; removed: boolean }> = [];

    for (const membership of otherMemberships) {
      const circle = membership.circles as any;
      const policy = circle?.member_default_policy || 'warn_only';

      switch (policy) {
        case 'warn_only':
          await supabase
            .from('circle_members')
            .update({
              has_active_default: true,
              last_default_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', membership.id);

          actions.push({ circleId: circle.id, action: 'flagged', removed: false });
          break;

        case 'increase_scrutiny':
          await supabase
            .from('circle_members')
            .update({
              has_active_default: true,
              scrutiny_level: 'high',
              requires_balance_check: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', membership.id);

          actions.push({ circleId: circle.id, action: 'increased_scrutiny', removed: false });
          break;

        case 'remove_if_repeat':
          const { count: totalDefaults } = await supabase
            .from('defaults')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', defaultRecord.user_id)
            .eq('default_status', 'unresolved');

          if ((totalDefaults || 0) >= 2) {
            await this.removeFromCircle(membership.id, defaultRecord, cascadeId, 'repeat_defaulter');
            actions.push({ circleId: circle.id, action: 'removed', removed: true });
          } else {
            await supabase
              .from('circle_members')
              .update({
                has_active_default: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', membership.id);
            actions.push({ circleId: circle.id, action: 'flagged_first_offense', removed: false });
          }
          break;

        case 'remove_immediate':
          await this.removeFromCircle(membership.id, defaultRecord, cascadeId, 'default_in_other_circle');
          actions.push({ circleId: circle.id, action: 'removed', removed: true });
          break;
      }
    }

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'other_circles_evaluated', 'system', null, {
      circlesEvaluated: otherMemberships.length,
      actions
    });

    return {
      circlesEvaluated: otherMemberships.length,
      actions
    };
  }

  private async removeFromCircle(
    membershipId: string,
    defaultRecord: DefaultRecord,
    cascadeId: string,
    reason: string
  ): Promise<void> {

    await supabase
      .from('circle_members')
      .update({
        member_status: 'removed',
        removed_at: new Date().toISOString(),
        removal_reason: reason,
        removed_due_to_default_id: defaultRecord.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', membershipId);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'removed_from_circle', 'defaulter', defaultRecord.user_id, {
      membershipId,
      reason
    });
  }

  // --------------------------------------------------------------------------
  // STEP 6: COMMUNITY HEALTH UPDATE
  // --------------------------------------------------------------------------

  private async updateCommunityHealth(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{ communityId: string; defaultRate: number; intervention: any }> {

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Count defaults in last 90 days
    const { count: defaultsLast90Days } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', defaultRecord.community_id)
      .gte('created_at', ninetyDaysAgo.toISOString());

    // Count active members
    const { count: memberCount } = await supabase
      .from('community_members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', defaultRecord.community_id)
      .eq('membership_status', 'active');

    const defaultRate = (memberCount || 0) > 0
      ? ((defaultsLast90Days || 0) / (memberCount || 1)) * 100
      : 0;

    let intervention = null;

    // Trigger intervention if default rate is high (10%+)
    if (defaultRate >= 10) {
      intervention = {
        type: 'high_default_rate',
        defaultRate,
        action: 'community_review_required'
      };

      // Alert ops
      await this.alertOps('community_high_default_rate', {
        communityId: defaultRecord.community_id,
        defaultRate,
        defaultsLast90Days,
        memberCount
      });
    }

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'community_health_updated', 'community', defaultRecord.community_id, {
      defaultRate,
      defaultsLast90Days,
      memberCount,
      intervention
    });

    return {
      communityId: defaultRecord.community_id,
      defaultRate,
      intervention
    };
  }

  // --------------------------------------------------------------------------
  // STEP 7: REPEAT OFFENDER CHECK
  // --------------------------------------------------------------------------

  private async checkRepeatOffender(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{
    totalDefaults: number;
    defaultsLast12Months: number;
    unresolvedDefaults: number;
    suspensionReviewTriggered: boolean;
  }> {

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const { count: totalDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', defaultRecord.user_id);

    const { count: defaultsLast12Months } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', defaultRecord.user_id)
      .gte('created_at', twelveMonthsAgo.toISOString());

    const { count: unresolvedDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', defaultRecord.user_id)
      .eq('default_status', 'unresolved');

    let suspensionReviewTriggered = false;

    // Suspension review triggers
    if ((defaultsLast12Months || 0) >= 3 || (unresolvedDefaults || 0) >= 2 || (totalDefaults || 0) >= 5) {
      suspensionReviewTriggered = true;

      let reason = 'five_total_defaults';
      if ((defaultsLast12Months || 0) >= 3) {
        reason = 'three_defaults_12_months';
      } else if ((unresolvedDefaults || 0) >= 2) {
        reason = 'two_unresolved_defaults';
      }

      // Create suspension review
      await supabase
        .from('suspension_reviews')
        .insert({
          user_id: defaultRecord.user_id,
          trigger_default_id: defaultRecord.id,
          reason,
          metrics: {
            totalDefaults,
            defaultsLast12Months,
            unresolvedDefaults
          },
          review_status: 'pending'
        });

      // Update default record
      await supabase
        .from('defaults')
        .update({
          triggered_suspension_review: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', defaultRecord.id);

      await this.logCascadeEvent(cascadeId, defaultRecord.id, 'suspension_review_triggered', 'defaulter', defaultRecord.user_id, {
        reason,
        totalDefaults,
        defaultsLast12Months,
        unresolvedDefaults
      });

      // Alert ops
      await this.alertOps('suspension_review_required', {
        userId: defaultRecord.user_id,
        defaultId: defaultRecord.id,
        reason,
        metrics: { totalDefaults, defaultsLast12Months, unresolvedDefaults }
      });
    }

    return {
      totalDefaults: totalDefaults || 0,
      defaultsLast12Months: defaultsLast12Months || 0,
      unresolvedDefaults: unresolvedDefaults || 0,
      suspensionReviewTriggered
    };
  }

  // --------------------------------------------------------------------------
  // STEP 8: RECOVERY PATH SETUP
  // --------------------------------------------------------------------------

  private async setupRecoveryPath(
    defaultRecord: DefaultRecord,
    cascadeId: string
  ): Promise<{ recoveryPlanId: string; totalDebt: number; options: RecoveryOption[] }> {

    const totalDebt = defaultRecord.total_owed;
    const recoveryOptions = this.generateRecoveryOptions(totalDebt);

    const xnscoreRecoveryMilestones = [
      { pctPaid: 25, xnscoreRecovery: 5 },
      { pctPaid: 50, xnscoreRecovery: 7 },
      { pctPaid: 75, xnscoreRecovery: 8 },
      { pctPaid: 100, xnscoreRecovery: 10 }
    ];

    // Create recovery plan
    const { data: recoveryPlan, error } = await supabase
      .from('recovery_plans')
      .insert({
        user_id: defaultRecord.user_id,
        default_id: defaultRecord.id,
        total_debt: totalDebt,
        payment_type: 'pending_selection',
        xnscore_recovery_milestones: xnscoreRecoveryMilestones,
        plan_status: 'offered'
      })
      .select()
      .single();

    if (error || !recoveryPlan) {
      throw new Error('Failed to create recovery plan');
    }

    // Update default with recovery plan
    await supabase
      .from('defaults')
      .update({
        recovery_plan_id: recoveryPlan.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', defaultRecord.id);

    // Schedule follow-up outreach
    await this.scheduleRecoveryOutreach(recoveryPlan.id, defaultRecord.user_id);

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'recovery_plan_offered', 'defaulter', defaultRecord.user_id, {
      recoveryPlanId: recoveryPlan.id,
      totalDebt,
      options: recoveryOptions,
      milestones: xnscoreRecoveryMilestones
    });

    return {
      recoveryPlanId: recoveryPlan.id,
      totalDebt,
      options: recoveryOptions
    };
  }

  private generateRecoveryOptions(totalDebt: number): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    // Option 1: Pay in full (best for XnScore)
    options.push({
      id: 'full_immediate',
      type: 'lump_sum',
      amount: totalDebt,
      xnscoreRecoveryBonus: 5,
      description: 'Pay in full now',
      benefits: [
        'Immediate restriction removal',
        'Maximum XnScore recovery',
        'Clean slate'
      ]
    });

    // Option 2: 2 payments over 2 weeks
    if (totalDebt >= 50) {
      options.push({
        id: 'biweekly_2',
        type: 'installments',
        numberOfInstallments: 2,
        installmentAmount: Math.ceil(totalDebt / 2 * 100) / 100,
        frequency: 'weekly',
        duration: '2 weeks',
        xnscoreRecoveryBonus: 3,
        description: '2 weekly payments'
      });
    }

    // Option 3: 4 payments over 4 weeks
    if (totalDebt >= 100) {
      options.push({
        id: 'weekly_4',
        type: 'installments',
        numberOfInstallments: 4,
        installmentAmount: Math.ceil(totalDebt / 4 * 100) / 100,
        frequency: 'weekly',
        duration: '4 weeks',
        xnscoreRecoveryBonus: 0,
        description: '4 weekly payments'
      });
    }

    // Option 4: Monthly payments (longer term)
    if (totalDebt >= 200) {
      options.push({
        id: 'monthly_3',
        type: 'installments',
        numberOfInstallments: 3,
        installmentAmount: Math.ceil(totalDebt / 3 * 100) / 100,
        frequency: 'monthly',
        duration: '3 months',
        xnscoreRecoveryBonus: 0,
        description: '3 monthly payments',
        note: 'Restrictions remain active during payment period'
      });
    }

    return options;
  }

  private async scheduleRecoveryOutreach(recoveryPlanId: string, userId: string): Promise<void> {
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    // Schedule reminders
    await supabase.from('scheduled_notifications').insert([
      {
        user_id: userId,
        notification_type: 'recovery_reminder',
        scheduled_for: threeDaysLater.toISOString(),
        notification_status: 'pending',
        payload: {
          recoveryPlanId,
          reminderNumber: 1
        }
      },
      {
        user_id: userId,
        notification_type: 'recovery_reminder',
        scheduled_for: sevenDaysLater.toISOString(),
        notification_status: 'pending',
        payload: {
          recoveryPlanId,
          reminderNumber: 2
        }
      },
      {
        user_id: userId,
        notification_type: 'recovery_writeoff_evaluation',
        scheduled_for: thirtyDaysLater.toISOString(),
        notification_status: 'pending',
        payload: {
          recoveryPlanId
        }
      }
    ]);
  }

  // --------------------------------------------------------------------------
  // STEP 9: NOTIFICATIONS
  // --------------------------------------------------------------------------

  private async sendCascadeNotifications(
    defaultRecord: DefaultRecord,
    cascadeId: string,
    cascadeResult: CascadeResult
  ): Promise<number> {

    let notificationCount = 0;

    // Get context
    const { data: circle } = await supabase
      .from('circles')
      .select('name')
      .eq('id', defaultRecord.circle_id)
      .single();

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select('recipient_user_id')
      .eq('id', defaultRecord.cycle_id)
      .single();

    // 1. Notify the defaulter
    await supabase.from('scheduled_notifications').insert({
      user_id: defaultRecord.user_id,
      notification_type: 'default_recorded',
      scheduled_for: new Date().toISOString(),
      notification_status: 'pending',
      payload: {
        defaultId: defaultRecord.id,
        circleId: defaultRecord.circle_id,
        circleName: circle?.name,
        amount: defaultRecord.total_owed,
        xnscoreImpact: defaultRecord.xnscore_impact_applied
      }
    });
    notificationCount++;

    // 2. Notify vouchers
    const voucherStep = cascadeResult.steps.find(s => s.step === 'voucher_cascade');
    if (voucherStep?.data?.impacts) {
      for (const impact of voucherStep.data.impacts) {
        await supabase.from('scheduled_notifications').insert({
          user_id: impact.voucherUserId,
          notification_type: 'vouchee_defaulted',
          scheduled_for: new Date().toISOString(),
          notification_status: 'pending',
          payload: {
            defaulterId: defaultRecord.user_id,
            xnscoreImpact: impact.impact,
            newScore: impact.newScore,
            reliabilityStatus: impact.reliabilityStatus,
            triggeredRestriction: impact.triggeredRestriction
          }
        });
        notificationCount++;
      }
    }

    // 3. Notify payout recipient
    const circleStep = cascadeResult.steps.find(s => s.step === 'circle_resolution');
    if (circleStep && cycle?.recipient_user_id && cycle.recipient_user_id !== defaultRecord.user_id) {
      await supabase.from('scheduled_notifications').insert({
        user_id: cycle.recipient_user_id,
        notification_type: 'payout_affected_by_default',
        scheduled_for: new Date().toISOString(),
        notification_status: 'pending',
        payload: {
          circleId: defaultRecord.circle_id,
          circleName: circle?.name,
          method: circleStep.data.method,
          originalPayout: circleStep.data.originalPayoutAmount,
          actualPayout: circleStep.data.actualPayout,
          reduction: circleStep.data.recipientReduction
        }
      });
      notificationCount++;
    }

    // 4. Notify about redistribution requests (if applicable)
    if (circleStep?.data?.redistributionId) {
      const { data: responses } = await supabase
        .from('redistribution_responses')
        .select('user_id')
        .eq('redistribution_id', circleStep.data.redistributionId);

      if (responses) {
        for (const response of responses) {
          await supabase.from('scheduled_notifications').insert({
            user_id: response.user_id,
            notification_type: 'redistribution_request',
            scheduled_for: new Date().toISOString(),
            notification_status: 'pending',
            payload: {
              redistributionId: circleStep.data.redistributionId,
              circleId: defaultRecord.circle_id,
              circleName: circle?.name
            }
          });
          notificationCount++;
        }
      }
    }

    await this.logCascadeEvent(cascadeId, defaultRecord.id, 'notifications_sent', 'system', null, {
      count: notificationCount
    });

    return notificationCount;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  private async logCascadeEvent(
    cascadeId: string,
    defaultId: string,
    eventType: string,
    targetType: string,
    targetUserId: string | null,
    details: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('cascade_events')
      .insert({
        cascade_id: cascadeId,
        default_id: defaultId,
        event_type: eventType,
        target_type: targetType,
        target_user_id: targetUserId,
        details
      });
  }

  private async alertOps(alertType: string, data: Record<string, any>): Promise<void> {
    // Create ops alert
    await supabase
      .from('ops_alerts')
      .insert({
        alert_type: alertType,
        alert_status: 'pending',
        details: data,
        created_at: new Date().toISOString()
      });
  }

  // --------------------------------------------------------------------------
  // PUBLIC QUERY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get cascade summary for a default
   */
  async getCascadeSummary(cascadeId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_default_cascade_summary', { p_cascade_id: cascadeId });

    if (error) throw error;
    return data;
  }

  /**
   * Get user's default history
   */
  async getUserDefaults(userId: string): Promise<DefaultRecord[]> {
    const { data, error } = await supabase
      .from('defaults')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get cascade events for audit trail
   */
  async getCascadeEvents(cascadeId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('cascade_events')
      .select('*')
      .eq('cascade_id', cascadeId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}

// Export singleton instance
export const defaultCascadeHandler = new DefaultCascadeHandler();
