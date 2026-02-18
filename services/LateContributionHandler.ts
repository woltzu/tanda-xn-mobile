/**
 * ══════════════════════════════════════════════════════════════════════════════
 * LATE CONTRIBUTION HANDLER
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Manages the lifecycle of late payments from soft late through default.
 * Replicates traditional tontine social pressure digitally while being fair.
 *
 * TIMELINE:
 * Day 0: Due date
 * Day 1-2: Soft late (reminder, -5 XnScore, auto-retry starts)
 * Day 3-5: Grace period (late fee, -5 XnScore, daily reminders)
 * Day 5-6: Final warning (-10 XnScore, SMS, vouchers notified)
 * Day 7+: Default (-30 XnScore, restrictions applied)
 *
 * @module LateContributionHandler
 */

import { supabase } from '@/lib/supabase';
import {
  addDays,
  addHours,
  differenceInDays,
  differenceInHours,
  format,
  parseISO,
  subHours,
  isBefore,
  isAfter,
} from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type LateStatus =
  | 'soft_late'
  | 'grace_period'
  | 'final_warning'
  | 'defaulted'
  | 'paid_late'
  | 'partially_paid'
  | 'covered'
  | 'forgiven'
  | 'payment_plan';

export type ResolutionType =
  | 'paid_in_full'
  | 'paid_partial'
  | 'covered_by_reserve'
  | 'covered_by_members'
  | 'forgiven'
  | 'written_off'
  | 'paid_via_plan';

export interface LateContribution {
  id: string;
  contribution_id: string;
  cycle_id: string;
  circle_id: string;
  user_id: string;
  expected_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  late_fee_amount: number;
  original_due_date: string;
  grace_period_end: string;
  days_late: number;
  late_status: LateStatus;
  soft_late_at?: string;
  grace_period_at?: string;
  final_warning_at?: string;
  defaulted_at?: string;
  resolved_at?: string;
  resolution_type?: ResolutionType;
  resolution_notes?: string;
  auto_retry_attempts: number;
  last_auto_retry_at?: string;
  last_auto_retry_error?: string;
  payment_plan_id?: string;
  xnscore_impacts: XnScoreImpact[];
}

export interface XnScoreImpact {
  reason: string;
  points: number;
  appliedAt: string;
}

export interface GraceConfig {
  gracePeriodStartDay: number;
  finalWarningStartDay: number;
  defaultDay: number;
  softLateXnScoreImpact: number;
  gracePeriodXnScoreImpact: number;
  finalWarningXnScoreImpact: number;
  defaultXnScoreImpact: number;
}

export interface ProcessingResults {
  processed: number;
  progressed: number;
  defaulted: number;
  resolved: number;
  errors: { id: string; error: string }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// LATE CONTRIBUTION HANDLER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class LateContributionHandler {
  private static instance: LateContributionHandler;

  private constructor() {}

  public static getInstance(): LateContributionHandler {
    if (!LateContributionHandler.instance) {
      LateContributionHandler.instance = new LateContributionHandler();
    }
    return LateContributionHandler.instance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIATE LATE HANDLING
  // Called when deadline passes without full payment
  // ═══════════════════════════════════════════════════════════════════════════

  async initiateLateHandling(contributionId: string): Promise<LateContribution | null> {
    // Get contribution details
    const { data: contribution, error: contribError } = await supabase
      .from('cycle_contributions')
      .select(`
        *,
        cycle:circle_cycles(*),
        circle:circles(*)
      `)
      .eq('id', contributionId)
      .single();

    if (contribError || !contribution) {
      console.error('[LateHandler] Contribution not found:', contributionId);
      return null;
    }

    // Calculate outstanding amount
    const outstandingAmount = contribution.expected_amount - (contribution.contributed_amount || 0);

    if (outstandingAmount <= 0) {
      // Already paid - shouldn't be here
      return null;
    }

    // Check if late record already exists
    const { data: existingLate } = await supabase
      .from('late_contributions')
      .select('*')
      .eq('contribution_id', contributionId)
      .single();

    if (existingLate) {
      // Already tracking - update status if needed
      await this.progressLateStatus(existingLate);
      return existingLate;
    }

    // Calculate grace period end
    const circle = contribution.circle;
    const cycle = contribution.cycle;
    const graceDays = circle.grace_period_days || 7;
    const gracePeriodEnd = addDays(parseISO(cycle.contribution_deadline), graceDays);

    // Create late contribution record
    const { data: lateRecord, error: createError } = await supabase
      .from('late_contributions')
      .insert({
        contribution_id: contribution.id,
        cycle_id: cycle.id,
        circle_id: circle.id,
        user_id: contribution.user_id,
        expected_amount: contribution.expected_amount,
        paid_amount: contribution.contributed_amount || 0,
        outstanding_amount: outstandingAmount,
        original_due_date: cycle.contribution_deadline,
        grace_period_end: gracePeriodEnd.toISOString().split('T')[0],
        days_late: 1,
        late_status: 'soft_late',
        soft_late_at: new Date().toISOString(),
        xnscore_impacts: [],
      })
      .select()
      .single();

    if (createError) {
      console.error('[LateHandler] Failed to create late record:', createError);
      return null;
    }

    // Update contribution status
    await supabase
      .from('cycle_contributions')
      .update({
        contribution_status: 'late',
        in_grace_period: true,
      })
      .eq('id', contributionId);

    // Apply initial XnScore impact
    await this.applyXnScoreImpact(lateRecord, 'soft_late', -5);

    // Send initial notification
    await this.sendLateNotification(lateRecord, 'soft_late', circle, cycle);

    // Schedule auto-retry if enabled
    await this.scheduleAutoRetry(lateRecord);

    // Log event
    await this.logLateEvent(lateRecord.id, 'late_initiated', {
      days_late: 1,
      outstanding_amount: outstandingAmount,
      grace_period_end: gracePeriodEnd.toISOString(),
    });

    console.log(`[LateHandler] Initiated late handling for contribution ${contributionId}`);

    return lateRecord;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESS ALL LATE CONTRIBUTIONS
  // Called daily by cron job
  // ═══════════════════════════════════════════════════════════════════════════

  async processAllLateContributions(): Promise<ProcessingResults> {
    const { data: unresolvedLate } = await supabase
      .from('late_contributions')
      .select(`
        *,
        contribution:cycle_contributions(*),
        cycle:circle_cycles(*),
        circle:circles(*)
      `)
      .in('late_status', ['soft_late', 'grace_period', 'final_warning']);

    const results: ProcessingResults = {
      processed: 0,
      progressed: 0,
      defaulted: 0,
      resolved: 0,
      errors: [],
    };

    for (const lateRecord of unresolvedLate || []) {
      try {
        const result = await this.progressLateStatus(lateRecord);
        results.processed++;

        if (result.progressed) results.progressed++;
        if (result.defaulted) results.defaulted++;
        if (result.resolved) results.resolved++;

      } catch (error: any) {
        console.error(`[LateHandler] Error processing late contribution ${lateRecord.id}:`, error);
        results.errors.push({ id: lateRecord.id, error: error.message });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROGRESS LATE STATUS
  // Move through soft_late -> grace_period -> final_warning -> defaulted
  // ═══════════════════════════════════════════════════════════════════════════

  async progressLateStatus(lateRecord: any): Promise<{ progressed: boolean; defaulted: boolean; resolved: boolean }> {
    const now = new Date();
    const daysLate = differenceInDays(now, parseISO(lateRecord.original_due_date));
    const circle = lateRecord.circle;

    // Update days late
    await supabase
      .from('late_contributions')
      .update({ days_late: daysLate })
      .eq('id', lateRecord.id);

    const result = { progressed: false, defaulted: false, resolved: false };

    // Check if paid since last check
    const { data: contribution } = await supabase
      .from('cycle_contributions')
      .select('contribution_status, contributed_amount')
      .eq('id', lateRecord.contribution_id)
      .single();

    if (contribution?.contribution_status === 'completed') {
      await this.resolveLateContribution(lateRecord, 'paid_in_full');
      result.resolved = true;
      return result;
    }

    // Check if grace period expired
    if (isAfter(now, parseISO(lateRecord.grace_period_end)) && lateRecord.late_status !== 'defaulted') {
      await this.transitionToDefault(lateRecord);
      result.defaulted = true;
      return result;
    }

    // Progress through late stages
    const graceConfig = this.getGraceConfig(circle);

    // Soft Late -> Grace Period (Day 2-3)
    if (lateRecord.late_status === 'soft_late' && daysLate >= graceConfig.gracePeriodStartDay) {
      await this.transitionToGracePeriod(lateRecord, circle);
      result.progressed = true;
    }

    // Grace Period -> Final Warning (Day 5-6)
    if (lateRecord.late_status === 'grace_period' && daysLate >= graceConfig.finalWarningStartDay) {
      await this.transitionToFinalWarning(lateRecord, circle);
      result.progressed = true;
    }

    // Send daily reminders based on status
    await this.sendDailyLateReminder(lateRecord, daysLate, circle);

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS TRANSITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async transitionToGracePeriod(lateRecord: LateContribution, circle: any): Promise<void> {
    await supabase
      .from('late_contributions')
      .update({
        late_status: 'grace_period',
        grace_period_at: new Date().toISOString(),
      })
      .eq('id', lateRecord.id);

    // Apply XnScore impact
    await this.applyXnScoreImpact(lateRecord, 'grace_period', -5);

    // Calculate and apply late fee
    const lateFee = await this.calculateLateFee(lateRecord, circle);
    if (lateFee > 0) {
      await supabase
        .from('late_contributions')
        .update({
          late_fee_amount: lateFee,
          outstanding_amount: lateRecord.outstanding_amount + lateFee,
        })
        .eq('id', lateRecord.id);
    }

    // Get cycle for notification
    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('id', lateRecord.cycle_id)
      .single();

    // Send notification
    await this.sendLateNotification({ ...lateRecord, late_fee_amount: lateFee }, 'grace_period', circle, cycle);

    // Notify circle about delay (anonymized)
    await this.notifyCircleOfDelay(lateRecord, circle, cycle);

    // Log
    await this.logLateEvent(lateRecord.id, 'transitioned_to_grace_period', {
      days_late: lateRecord.days_late,
      late_fee: lateFee,
      outstanding_amount: lateRecord.outstanding_amount + lateFee,
    });

    console.log(`[LateHandler] Transitioned ${lateRecord.id} to grace_period`);
  }

  private async transitionToFinalWarning(lateRecord: LateContribution, circle: any): Promise<void> {
    await supabase
      .from('late_contributions')
      .update({
        late_status: 'final_warning',
        final_warning_at: new Date().toISOString(),
      })
      .eq('id', lateRecord.id);

    // Apply XnScore impact
    await this.applyXnScoreImpact(lateRecord, 'final_warning', -10);

    // Get user and cycle
    const { data: user } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', lateRecord.user_id)
      .single();

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('id', lateRecord.cycle_id)
      .single();

    // Send urgent notification
    await this.sendLateNotification(lateRecord, 'final_warning', circle, cycle);

    // Send SMS if enabled (user would have phone number)
    if (user?.phone_number) {
      await this.sendLateSMS(user, lateRecord, circle);
    }

    // Notify vouchers
    await this.notifyVouchersOfPotentialDefault(lateRecord, circle);

    // Reveal late member to circle if setting enabled
    if (circle.reveal_late_members) {
      await this.notifyCircleOfLateMember(lateRecord, circle, cycle);
    }

    // Offer payment plan option
    await this.offerPaymentPlanOption(lateRecord, circle);

    // Log
    await this.logLateEvent(lateRecord.id, 'transitioned_to_final_warning', {
      days_late: lateRecord.days_late,
      vouchers_notified: true,
      payment_plan_offered: true,
    });

    console.log(`[LateHandler] Transitioned ${lateRecord.id} to final_warning`);
  }

  private async transitionToDefault(lateRecord: LateContribution): Promise<void> {
    const { data: circle } = await supabase
      .from('circles')
      .select('*')
      .eq('id', lateRecord.circle_id)
      .single();

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('id', lateRecord.cycle_id)
      .single();

    await supabase
      .from('late_contributions')
      .update({
        late_status: 'defaulted',
        defaulted_at: new Date().toISOString(),
      })
      .eq('id', lateRecord.id);

    // Update contribution status
    await supabase
      .from('cycle_contributions')
      .update({
        contribution_status: 'missed',
        in_grace_period: false,
      })
      .eq('id', lateRecord.contribution_id);

    // Apply severe XnScore impact
    await this.applyXnScoreImpact(lateRecord, 'default', -30);

    // Create official default record
    const { data: defaultRecord } = await supabase
      .from('member_defaults')
      .insert({
        user_id: lateRecord.user_id,
        circle_id: lateRecord.circle_id,
        community_id: circle?.community_id,
        cycle_id: lateRecord.cycle_id,
        cycle_number: cycle?.cycle_number,
        expected_amount: lateRecord.expected_amount,
        paid_amount: lateRecord.paid_amount,
        default_amount: lateRecord.outstanding_amount,
        default_status: 'unresolved',
      })
      .select()
      .single();

    // Propagate to vouchers
    await this.propagateDefaultToVouchers(lateRecord.user_id, lateRecord.circle_id);

    // Handle circle impact based on policy
    if (circle && cycle) {
      await this.handleDefaultCircleImpact(lateRecord, defaultRecord, circle, cycle);
    }

    // Send default notification
    await this.sendLateNotification(lateRecord, 'defaulted', circle, cycle);

    // Restrict user from new circles
    await this.restrictUserFromNewCircles(lateRecord.user_id, defaultRecord);

    // Notify community admins
    if (circle) {
      await this.notifyCommunityAdminsOfDefault(lateRecord, defaultRecord, circle);
    }

    // Log
    await this.logLateEvent(lateRecord.id, 'defaulted', {
      days_late: lateRecord.days_late,
      outstanding_amount: lateRecord.outstanding_amount,
      default_record_id: defaultRecord?.id,
    });

    console.log(`[LateHandler] Transitioned ${lateRecord.id} to defaulted`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  async resolveLateContribution(
    lateRecord: LateContribution,
    resolutionType: ResolutionType,
    details: { notes?: string } = {}
  ): Promise<void> {
    const now = new Date();

    const newStatus: LateStatus = resolutionType === 'paid_in_full' ? 'paid_late' :
                                  resolutionType === 'paid_via_plan' ? 'paid_late' :
                                  resolutionType === 'covered_by_reserve' ? 'covered' :
                                  resolutionType === 'covered_by_members' ? 'covered' :
                                  resolutionType === 'forgiven' ? 'forgiven' : 'partially_paid';

    await supabase
      .from('late_contributions')
      .update({
        late_status: newStatus,
        resolved_at: now.toISOString(),
        resolution_type: resolutionType,
        resolution_notes: details.notes,
      })
      .eq('id', lateRecord.id);

    // Update contribution status
    await supabase
      .from('cycle_contributions')
      .update({
        contribution_status: resolutionType === 'paid_in_full' || resolutionType === 'paid_via_plan'
          ? 'completed' : 'partial',
        was_on_time: false,
        days_late: lateRecord.days_late,
        in_grace_period: false,
      })
      .eq('id', lateRecord.contribution_id);

    // If paid late but before default, give partial XnScore recovery
    if (['paid_in_full', 'paid_via_plan'].includes(resolutionType) && lateRecord.late_status !== 'defaulted') {
      const totalImpact = this.getTotalXnScoreImpact(lateRecord);
      const recoveryPoints = Math.min(10, Math.abs(totalImpact) * 0.3);

      await this.adjustXnScore(lateRecord.user_id, {
        reason: 'late_payment_recovery',
        points: Math.round(recoveryPoints),
        metadata: {
          late_contribution_id: lateRecord.id,
          days_late: lateRecord.days_late,
          original_impact: totalImpact,
        },
      });
    }

    // Cancel any pending reminders
    await this.cancelPendingReminders(lateRecord);

    // Get circle for notification
    const { data: circle } = await supabase
      .from('circles')
      .select('name')
      .eq('id', lateRecord.circle_id)
      .single();

    // Send resolution notification
    await this.notifyUser(lateRecord.user_id, {
      type: 'late_contribution_resolved',
      title: 'Payment Received',
      body: `Your late payment of ${lateRecord.outstanding_amount} XAF to ${circle?.name || 'your circle'} has been received. Thank you for resolving this.`,
      data: {
        late_contribution_id: lateRecord.id,
        days_late: lateRecord.days_late,
      },
    });

    // Log
    await this.logLateEvent(lateRecord.id, 'resolved', {
      resolution_type: resolutionType,
      days_late: lateRecord.days_late,
      ...details,
    });

    console.log(`[LateHandler] Resolved late contribution ${lateRecord.id} via ${resolutionType}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LATE FEE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  private async calculateLateFee(lateRecord: LateContribution, circle: any): Promise<number> {
    // Get late fee config
    const { data: feeConfig } = await supabase
      .from('late_fee_config')
      .select('*')
      .eq('circle_id', circle.id)
      .single();

    // If no circle config, get platform default
    const config = feeConfig || await this.getPlatformLateFeeConfig();

    if (!config) {
      return 0;
    }

    // Check if still in fee grace period
    const feeGraceDays = config.grace_period_days || 2;
    if (lateRecord.days_late <= feeGraceDays) {
      return 0;
    }

    let fee = 0;
    const feeType = config.fee_type || config.late_fee_type || 'percentage';

    switch (feeType) {
      case 'flat':
        fee = config.flat_fee || 500; // 500 XAF default
        break;

      case 'percentage':
        const percentage = config.late_fee_percentage || 0.05;
        fee = lateRecord.outstanding_amount * percentage;
        break;

      case 'tiered':
        if (config.tiered_fees) {
          const tiers = config.tiered_fees as { days_late: number; fee: number }[];
          for (const tier of tiers.sort((a, b) => b.days_late - a.days_late)) {
            if (lateRecord.days_late >= tier.days_late) {
              fee = tier.fee;
              break;
            }
          }
        }
        break;
    }

    // Apply max fee cap
    if (config.max_fee) {
      fee = Math.min(fee, config.max_fee);
    }

    return Math.round(fee * 100) / 100;
  }

  private async getPlatformLateFeeConfig(): Promise<any> {
    const { data } = await supabase
      .from('late_fee_config')
      .select('*')
      .is('circle_id', null)
      .single();

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async sendLateNotification(
    lateRecord: LateContribution,
    stage: LateStatus,
    circle: any,
    cycle: any
  ): Promise<void> {
    const circleName = circle?.name || 'your circle';

    const notifications: Record<string, { type: string; title: string; body: string; priority: string }> = {
      soft_late: {
        type: 'contribution_late_soft',
        title: 'Contribution Reminder',
        body: `Your ${lateRecord.outstanding_amount} XAF contribution to ${circleName} was due yesterday. Please pay soon to avoid fees.`,
        priority: 'normal',
      },
      grace_period: {
        type: 'contribution_late_grace',
        title: 'Payment Overdue',
        body: `Your contribution to ${circleName} is ${lateRecord.days_late} days overdue. ` +
              (lateRecord.late_fee_amount > 0 ? `A ${lateRecord.late_fee_amount} XAF late fee has been applied. ` : '') +
              `Pay now to avoid further penalties.`,
        priority: 'high',
      },
      final_warning: {
        type: 'contribution_late_final',
        title: 'FINAL WARNING - Default Imminent',
        body: `Your contribution to ${circleName} is ${lateRecord.days_late} days overdue. ` +
              `If not paid by ${format(parseISO(lateRecord.grace_period_end), 'MMM d')}, you will be in DEFAULT. ` +
              `This severely impacts your XnScore and ability to join future circles.`,
        priority: 'urgent',
      },
      defaulted: {
        type: 'contribution_defaulted',
        title: 'Default Recorded',
        body: `Your contribution to ${circleName} has been recorded as a DEFAULT. ` +
              `Your XnScore has been significantly impacted. ` +
              `You may still pay to partially recover your standing.`,
        priority: 'urgent',
      },
    };

    const notification = notifications[stage];
    if (!notification) return;

    await this.notifyUser(lateRecord.user_id, {
      ...notification,
      data: {
        late_contribution_id: lateRecord.id,
        circle_id: lateRecord.circle_id,
        cycle_id: lateRecord.cycle_id,
        outstanding_amount: lateRecord.outstanding_amount,
        days_late: lateRecord.days_late,
        grace_period_end: lateRecord.grace_period_end,
      },
    });
  }

  private async sendDailyLateReminder(lateRecord: LateContribution, daysLate: number, circle: any): Promise<void> {
    const daysUntilDefault = differenceInDays(parseISO(lateRecord.grace_period_end), new Date());

    // Check if we already sent a reminder recently
    const { data: recentReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', lateRecord.user_id)
      .like('type', 'contribution_late%')
      .gte('created_at', subHours(new Date(), 20).toISOString())
      .limit(1);

    if (recentReminder && recentReminder.length > 0) {
      return; // Already reminded recently
    }

    let message: string;
    let priority: string;

    if (daysUntilDefault > 3) {
      message = `Reminder: Your ${circle?.name || 'circle'} contribution is ${daysLate} days late. Pay soon to avoid additional penalties.`;
      priority = 'normal';
    } else if (daysUntilDefault > 1) {
      message = `URGENT: Only ${daysUntilDefault} days until default! Pay your ${circle?.name || 'circle'} contribution now.`;
      priority = 'high';
    } else if (daysUntilDefault === 1) {
      message = `LAST DAY: Pay your ${circle?.name || 'circle'} contribution TODAY or face default tomorrow.`;
      priority = 'urgent';
    } else {
      message = `DEFAULT IMMINENT: Your grace period ends today. Pay immediately to avoid default.`;
      priority = 'urgent';
    }

    await this.notifyUser(lateRecord.user_id, {
      type: 'contribution_late_daily_reminder',
      title: daysUntilDefault <= 1 ? 'Urgent Payment Required' : 'Payment Reminder',
      body: message,
      priority,
      data: {
        late_contribution_id: lateRecord.id,
        circle_id: lateRecord.circle_id,
        outstanding_amount: lateRecord.outstanding_amount,
        days_until_default: daysUntilDefault,
      },
    });
  }

  private async sendLateSMS(user: any, lateRecord: LateContribution, circle: any): Promise<void> {
    // TODO: Integrate with SMS provider (Twilio, Africa's Talking, etc.)
    console.log(`[LateHandler] Would send SMS to ${user.phone_number}: URGENT late payment notice`);
  }

  private async notifyCircleOfDelay(lateRecord: LateContribution, circle: any, cycle: any): Promise<void> {
    // Count total late members (anonymized)
    const { count: lateCount } = await supabase
      .from('late_contributions')
      .select('*', { count: 'exact', head: true })
      .eq('cycle_id', lateRecord.cycle_id)
      .in('late_status', ['soft_late', 'grace_period', 'final_warning']);

    // Notify recipient that payout may be delayed
    if (cycle?.recipient_user_id && cycle.recipient_user_id !== lateRecord.user_id) {
      await this.notifyUser(cycle.recipient_user_id, {
        type: 'payout_delayed_due_to_late',
        title: 'Payout Update',
        body: `Your payout from ${circle?.name || 'your circle'} may be delayed. ${lateCount || 1} member(s) have not yet contributed. We're working to collect.`,
        data: {
          circle_id: circle?.id,
          cycle_id: cycle.id,
          late_count: lateCount,
        },
      });
    }
  }

  private async notifyCircleOfLateMember(lateRecord: LateContribution, circle: any, cycle: any): Promise<void> {
    const { data: lateUser } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', lateRecord.user_id)
      .single();

    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', lateRecord.circle_id)
      .eq('status', 'active');

    const daysUntilDefault = differenceInDays(parseISO(lateRecord.grace_period_end), new Date());

    for (const member of members || []) {
      if (member.user_id === lateRecord.user_id) continue;

      await this.notifyUser(member.user_id, {
        type: 'circle_member_late_revealed',
        title: `${circle?.name || 'Circle'} - Member Payment Late`,
        body: `${lateUser?.full_name || 'A member'} has not contributed to this cycle. They have ${daysUntilDefault} days to pay before default.`,
        data: {
          circle_id: circle?.id,
          cycle_id: cycle?.id,
          late_member_name: lateUser?.full_name,
        },
      });
    }
  }

  private async notifyVouchersOfPotentialDefault(lateRecord: LateContribution, circle: any): Promise<void> {
    const { data: user } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', lateRecord.user_id)
      .single();

    // Find vouchers
    const { data: vouches } = await supabase
      .from('vouches')
      .select('*')
      .eq('vouchee_id', lateRecord.user_id)
      .eq('vouch_status', 'active');

    const daysUntilDefault = differenceInDays(parseISO(lateRecord.grace_period_end), new Date());

    for (const vouch of vouches || []) {
      await this.notifyUser(vouch.voucher_id, {
        type: 'vouchee_potential_default',
        title: 'Vouched Member at Risk',
        body: `${user?.full_name || 'A member'}, whom you vouched for, is at risk of defaulting in ${circle?.name || 'a circle'}. ` +
              `If they default, your XnScore will be impacted. Consider reaching out to them.`,
        data: {
          vouched_user_id: lateRecord.user_id,
          circle_id: lateRecord.circle_id,
          days_until_default: daysUntilDefault,
        },
      });
    }

    await this.logLateEvent(lateRecord.id, 'vouchers_notified', {
      vouchers_count: vouches?.length || 0,
    });
  }

  private async notifyCommunityAdminsOfDefault(lateRecord: LateContribution, defaultRecord: any, circle: any): Promise<void> {
    const { data: user } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', lateRecord.user_id)
      .single();

    const { data: admins } = await supabase
      .from('community_members')
      .select('user_id')
      .eq('community_id', circle.community_id)
      .in('role', ['admin', 'owner', 'leader']);

    for (const admin of admins || []) {
      await this.notifyUser(admin.user_id, {
        type: 'admin_member_defaulted',
        title: 'Member Default Alert',
        body: `${user?.full_name || 'A member'} has defaulted on their contribution in ${circle.name}. Outstanding: ${lateRecord.outstanding_amount} XAF`,
        data: {
          default_id: defaultRecord?.id,
          late_contribution_id: lateRecord.id,
          user_id: lateRecord.user_id,
          circle_id: circle.id,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT PLAN OFFER
  // ═══════════════════════════════════════════════════════════════════════════

  private async offerPaymentPlanOption(lateRecord: LateContribution, circle: any): Promise<void> {
    // Only offer for amounts over threshold
    if (lateRecord.outstanding_amount < 5000) { // 5000 XAF minimum
      return;
    }

    const planOptions = this.generatePaymentPlanOptions(lateRecord.outstanding_amount);

    await this.notifyUser(lateRecord.user_id, {
      type: 'payment_plan_offered',
      title: 'Payment Plan Available',
      body: `Can't pay ${lateRecord.outstanding_amount} XAF right now? Set up a payment plan to avoid default.`,
      data: {
        late_contribution_id: lateRecord.id,
        outstanding_amount: lateRecord.outstanding_amount,
        plan_options: planOptions,
      },
    });
  }

  private generatePaymentPlanOptions(amount: number): any[] {
    const options = [];

    // Option 1: 2 weekly payments
    if (amount >= 5000) {
      options.push({
        id: 'weekly_2',
        installments: 2,
        frequency: 'weekly',
        amount: Math.ceil(amount / 2),
        total_weeks: 2,
        description: '2 weekly payments',
      });
    }

    // Option 2: 4 weekly payments
    if (amount >= 10000) {
      options.push({
        id: 'weekly_4',
        installments: 4,
        frequency: 'weekly',
        amount: Math.ceil(amount / 4),
        total_weeks: 4,
        description: '4 weekly payments',
      });
    }

    // Option 3: 2 biweekly payments
    if (amount >= 10000) {
      options.push({
        id: 'biweekly_2',
        installments: 2,
        frequency: 'biweekly',
        amount: Math.ceil(amount / 2),
        total_weeks: 4,
        description: '2 biweekly payments',
      });
    }

    return options;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT IMPACT HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private async handleDefaultCircleImpact(
    lateRecord: LateContribution,
    defaultRecord: any,
    circle: any,
    cycle: any
  ): Promise<void> {
    const policy = circle.default_handling_policy || 'proceed_reduced';

    switch (policy) {
      case 'proceed_reduced':
        // Payout proceeds with reduced amount
        await this.notifyRecipientOfReducedPayout(lateRecord, circle, cycle);
        break;

      case 'cover_from_reserve':
        // Platform covers from reserve
        await this.attemptCoverFromReserve(lateRecord, circle, cycle);
        break;

      case 'redistribute':
        // Other members split the gap (voluntary)
        await this.requestRedistribution(lateRecord, cycle);
        break;

      case 'delay_until_covered':
        // Wait for someone to cover
        // This is handled by the cycle progression engine
        break;
    }
  }

  private async notifyRecipientOfReducedPayout(lateRecord: LateContribution, circle: any, cycle: any): Promise<void> {
    const { data: contributions } = await supabase
      .from('cycle_contributions')
      .select('contributed_amount')
      .eq('cycle_id', cycle.id)
      .in('contribution_status', ['completed', 'covered']);

    const currentCollected = contributions?.reduce((sum, c) => sum + (c.contributed_amount || 0), 0) || 0;
    const platformFee = circle.platform_fee_percent || 0.02;

    await this.notifyUser(cycle.recipient_user_id, {
      type: 'payout_reduced_due_to_default',
      title: 'Payout Amount Reduced',
      body: `Due to a member default, your payout from ${circle.name} will be ` +
            `${Math.round(currentCollected * (1 - platformFee))} XAF instead of ` +
            `${Math.round(cycle.expected_amount * (1 - platformFee))} XAF.`,
      data: {
        circle_id: circle.id,
        cycle_id: cycle.id,
        reduced_amount: currentCollected,
        original_amount: cycle.expected_amount,
      },
    });
  }

  private async attemptCoverFromReserve(lateRecord: LateContribution, circle: any, cycle: any): Promise<void> {
    // Get reserve balance
    const { data: reserve } = await supabase
      .from('reserve_funds')
      .select('*')
      .eq('community_id', circle.community_id)
      .single();

    if (!reserve || reserve.balance < lateRecord.outstanding_amount) {
      // Fall back to reduced payout
      await this.notifyRecipientOfReducedPayout(lateRecord, circle, cycle);
      return;
    }

    const maxCoverage = reserve.balance * (reserve.max_coverage_percent || 0.20);

    if (lateRecord.outstanding_amount <= maxCoverage) {
      // Cover from reserve
      await supabase
        .from('reserve_funds')
        .update({
          balance: reserve.balance - lateRecord.outstanding_amount,
        })
        .eq('id', reserve.id);

      await supabase
        .from('late_contributions')
        .update({
          late_status: 'covered',
          resolution_type: 'covered_by_reserve',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', lateRecord.id);

      await this.logLateEvent(lateRecord.id, 'covered_by_reserve', {
        amount: lateRecord.outstanding_amount,
      });
    }
  }

  private async requestRedistribution(lateRecord: LateContribution, cycle: any): Promise<void> {
    // Get other active members
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', lateRecord.circle_id)
      .eq('status', 'active')
      .neq('user_id', lateRecord.user_id);

    if (!members || members.length === 0) return;

    const additionalPerMember = lateRecord.outstanding_amount / members.length;

    // Create redistribution request
    const { data: redistribution } = await supabase
      .from('redistribution_requests')
      .insert({
        cycle_id: cycle.id,
        circle_id: lateRecord.circle_id,
        defaulted_user_id: lateRecord.user_id,
        total_amount: lateRecord.outstanding_amount,
        amount_per_member: additionalPerMember,
        members_requested: members.length,
        request_status: 'pending',
        expires_at: addDays(new Date(), 2).toISOString(),
      })
      .select()
      .single();

    const { data: circle } = await supabase
      .from('circles')
      .select('name')
      .eq('id', lateRecord.circle_id)
      .single();

    // Notify each member
    for (const member of members) {
      await supabase
        .from('redistribution_responses')
        .insert({
          redistribution_id: redistribution?.id,
          user_id: member.user_id,
          requested_amount: additionalPerMember,
          response_status: 'pending',
        });

      await this.notifyUser(member.user_id, {
        type: 'redistribution_request',
        title: `${circle?.name || 'Circle'} - Help Needed`,
        body: `A member has defaulted. Would you contribute an extra ${Math.round(additionalPerMember)} XAF to ensure the payout proceeds? This is voluntary.`,
        data: {
          redistribution_id: redistribution?.id,
          circle_id: lateRecord.circle_id,
          amount: additionalPerMember,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // USER RESTRICTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  private async restrictUserFromNewCircles(userId: string, defaultRecord: any): Promise<void> {
    // Check total unresolved defaults
    const { count: unresolvedDefaults } = await supabase
      .from('member_defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('default_status', 'unresolved');

    if ((unresolvedDefaults || 0) >= 1) {
      await supabase
        .from('user_restrictions')
        .upsert({
          user_id: userId,
          restriction_type: 'cannot_join_circles',
          reason: 'unresolved_default',
          related_default_id: defaultRecord?.id,
        }, {
          onConflict: 'user_id,restriction_type',
        });

      await this.notifyUser(userId, {
        type: 'circle_restriction_applied',
        title: 'Circle Access Restricted',
        body: 'Due to your unresolved default, you cannot join new circles. Resolve your outstanding payment to regain access.',
        data: {
          default_id: defaultRecord?.id,
          restriction: 'cannot_join_circles',
        },
      });
    }
  }

  private async propagateDefaultToVouchers(userId: string, circleId: string): Promise<void> {
    const { data: vouches } = await supabase
      .from('vouches')
      .select('*')
      .eq('vouchee_id', userId)
      .eq('vouch_status', 'active');

    for (const vouch of vouches || []) {
      // Impact voucher's XnScore
      await this.adjustXnScore(vouch.voucher_id, {
        reason: 'vouchee_default',
        points: -5,
        metadata: {
          vouchee_id: userId,
          circle_id: circleId,
        },
      });

      await this.notifyUser(vouch.voucher_id, {
        type: 'vouchee_defaulted',
        title: 'Your Vouchee Defaulted',
        body: 'A member you vouched for has defaulted on their contribution. This affects your XnScore.',
        priority: 'high',
        data: {
          vouchee_id: userId,
          circle_id: circleId,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-RETRY SCHEDULING
  // ═══════════════════════════════════════════════════════════════════════════

  private async scheduleAutoRetry(lateRecord: LateContribution): Promise<void> {
    // Check if auto-retry is enabled for this circle
    const { data: retryConfig } = await supabase
      .from('auto_retry_config')
      .select('*')
      .eq('circle_id', lateRecord.circle_id)
      .single();

    if (!retryConfig?.enabled) {
      return;
    }

    // Schedule will be handled by the AutoRetryService
    console.log(`[LateHandler] Auto-retry enabled for late contribution ${lateRecord.id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // XNSCORE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  private async applyXnScoreImpact(lateRecord: LateContribution, stage: string, points: number): Promise<void> {
    // Check if already applied for this stage
    const existingImpact = lateRecord.xnscore_impacts?.find((i: XnScoreImpact) => i.reason === stage);
    if (existingImpact) return;

    // Apply the impact
    await this.adjustXnScore(lateRecord.user_id, {
      reason: `late_${stage}`,
      points,
      metadata: {
        late_contribution_id: lateRecord.id,
        circle_id: lateRecord.circle_id,
        cycle_id: lateRecord.cycle_id,
        days_late: lateRecord.days_late,
      },
    });

    // Record in late contribution
    const impacts = lateRecord.xnscore_impacts || [];
    impacts.push({
      reason: stage,
      points,
      appliedAt: new Date().toISOString(),
    });

    await supabase
      .from('late_contributions')
      .update({ xnscore_impacts: impacts })
      .eq('id', lateRecord.id);
  }

  private getTotalXnScoreImpact(lateRecord: LateContribution): number {
    return lateRecord.xnscore_impacts?.reduce((sum, impact) => sum + impact.points, 0) || 0;
  }

  private async adjustXnScore(
    userId: string,
    adjustment: { reason: string; points: number; metadata?: Record<string, any> }
  ): Promise<void> {
    const { data: scoreData } = await supabase
      .from('xn_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentScore = scoreData?.score || 50;
    const newScore = Math.max(0, Math.min(100, currentScore + adjustment.points));

    await supabase
      .from('xn_scores')
      .upsert({
        user_id: userId,
        score: newScore,
        updated_at: new Date().toISOString(),
      });

    await supabase
      .from('xn_score_history')
      .insert({
        user_id: userId,
        score_before: currentScore,
        score_after: newScore,
        change: adjustment.points,
        reason: adjustment.reason,
        metadata: adjustment.metadata || {},
      });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getGraceConfig(circle: any): GraceConfig {
    if (circle?.grace_config) {
      return circle.grace_config;
    }

    return {
      gracePeriodStartDay: 2,
      finalWarningStartDay: 5,
      defaultDay: 7,
      softLateXnScoreImpact: -5,
      gracePeriodXnScoreImpact: -5,
      finalWarningXnScoreImpact: -10,
      defaultXnScoreImpact: -30,
    };
  }

  private async notifyUser(
    userId: string,
    notification: {
      type: string;
      title: string;
      body: string;
      priority?: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        priority: notification.priority || 'normal',
        data: notification.data || {},
        status: 'unread',
      });
  }

  private async cancelPendingReminders(lateRecord: LateContribution): Promise<void> {
    await supabase
      .from('scheduled_notifications')
      .update({
        notification_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: 'late_resolved',
      })
      .eq('user_id', lateRecord.user_id)
      .eq('cycle_id', lateRecord.cycle_id)
      .eq('notification_status', 'scheduled');
  }

  private async logLateEvent(
    lateContributionId: string,
    eventType: string,
    details: Record<string, any>
  ): Promise<void> {
    const { data: lateRecord } = await supabase
      .from('late_contributions')
      .select('cycle_id, circle_id, user_id')
      .eq('id', lateContributionId)
      .single();

    if (lateRecord) {
      await supabase
        .from('late_contribution_events')
        .insert({
          late_contribution_id: lateContributionId,
          cycle_id: lateRecord.cycle_id,
          circle_id: lateRecord.circle_id,
          user_id: lateRecord.user_id,
          event_type: eventType,
          details,
        });
    }
  }
}

// Export singleton
export const lateContributionHandler = LateContributionHandler.getInstance();
