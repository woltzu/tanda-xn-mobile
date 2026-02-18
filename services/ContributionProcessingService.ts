/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CONTRIBUTION PROCESSING SERVICE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Handles incoming contribution payments from webhooks and processes them
 * through the cycle system.
 *
 * @module ContributionProcessingService
 */

import { supabase } from '@/lib/supabase';
import {
  differenceInDays,
  parseISO,
  isBefore,
  isAfter,
  format,
} from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PaymentWebhookPayload {
  transaction_id: string;
  user_id: string;
  circle_id: string;
  cycle_number: number;
  amount: number;
  currency: string;
  payment_method: string;
  status: 'completed' | 'failed' | 'pending';
  processor: string;
  processor_reference?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ContributionResult {
  success: boolean;
  contribution_id: string;
  status: string;
  was_on_time: boolean;
  days_late: number;
  late_fee?: number;
  message: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ContributionProcessingService {
  private static instance: ContributionProcessingService;

  private constructor() {}

  public static getInstance(): ContributionProcessingService {
    if (!ContributionProcessingService.instance) {
      ContributionProcessingService.instance = new ContributionProcessingService();
    }
    return ContributionProcessingService.instance;
  }

  /**
   * Process a contribution payment received via webhook
   */
  async processContributionReceived(payload: PaymentWebhookPayload): Promise<ContributionResult> {
    console.log(`[ContributionProcessing] Processing contribution for user ${payload.user_id} in circle ${payload.circle_id}`);

    // Validate the payment status
    if (payload.status !== 'completed') {
      return {
        success: false,
        contribution_id: '',
        status: 'failed',
        was_on_time: false,
        days_late: 0,
        message: `Payment status is ${payload.status}, expected 'completed'`,
      };
    }

    // Find the cycle
    const { data: cycle, error: cycleError } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('circle_id', payload.circle_id)
      .eq('cycle_number', payload.cycle_number)
      .single();

    if (cycleError || !cycle) {
      console.error(`[ContributionProcessing] Cycle not found for circle ${payload.circle_id}, cycle ${payload.cycle_number}`);
      return {
        success: false,
        contribution_id: '',
        status: 'error',
        was_on_time: false,
        days_late: 0,
        message: `Cycle not found for circle ${payload.circle_id}, cycle ${payload.cycle_number}`,
      };
    }

    // Find the contribution record
    const { data: contribution, error: contribError } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('user_id', payload.user_id)
      .single();

    if (contribError || !contribution) {
      console.error(`[ContributionProcessing] Contribution record not found for user ${payload.user_id} in cycle ${cycle.id}`);
      return {
        success: false,
        contribution_id: '',
        status: 'error',
        was_on_time: false,
        days_late: 0,
        message: `Contribution record not found for user ${payload.user_id} in cycle ${cycle.id}`,
      };
    }

    // Check if already completed
    if (contribution.status === 'completed') {
      return {
        success: true,
        contribution_id: contribution.id,
        status: 'already_completed',
        was_on_time: contribution.was_on_time || false,
        days_late: contribution.days_late || 0,
        message: 'Contribution already marked as completed',
      };
    }

    // Determine if on time
    const now = new Date();
    const deadline = parseISO(cycle.contribution_deadline);
    const wasOnTime = isBefore(now, deadline) || now.toDateString() === deadline.toDateString();
    const daysLate = wasOnTime ? 0 : differenceInDays(now, deadline);

    // Calculate late fee if applicable
    let lateFee = 0;
    const circle = cycle.circle;
    const gracePeriodDays = circle.grace_period_days || 2;

    if (daysLate > gracePeriodDays) {
      // Apply 5% late fee
      lateFee = payload.amount * 0.05;
    }

    // Calculate new total
    const newAmount = (parseFloat(contribution.contributed_amount) || 0) + payload.amount;
    const isComplete = newAmount >= contribution.expected_amount;

    // Determine new status
    let newStatus: string;
    if (isComplete) {
      newStatus = 'completed';
    } else if (newAmount > 0) {
      newStatus = 'partial';
    } else {
      newStatus = contribution.status;
    }

    // Update contribution record
    const { error: updateError } = await supabase
      .from('cycle_contributions')
      .update({
        contributed_amount: newAmount,
        contributed_at: now.toISOString(),
        status: newStatus,
        was_on_time: wasOnTime && isComplete,
        days_late: isComplete ? daysLate : null,
        late_fee_amount: lateFee,
        late_fee_paid: lateFee > 0 ? false : true, // Will be collected separately if needed
        transaction_id: payload.transaction_id,
        payment_method: payload.payment_method,
        in_grace_period: false,
      })
      .eq('id', contribution.id);

    if (updateError) {
      console.error(`[ContributionProcessing] Failed to update contribution:`, updateError);
      return {
        success: false,
        contribution_id: contribution.id,
        status: 'error',
        was_on_time: wasOnTime,
        days_late: daysLate,
        message: `Failed to update contribution: ${updateError.message}`,
      };
    }

    // Log the event
    await this.logCycleEvent(cycle.id, circle.id, 'contribution_received', {
      user_id: payload.user_id,
      amount: payload.amount,
      total_contributed: newAmount,
      is_complete: isComplete,
      was_on_time: wasOnTime,
      days_late: daysLate,
      late_fee: lateFee,
      transaction_id: payload.transaction_id,
    });

    // Update cycle totals (trigger will handle this, but we can also do it explicitly)
    await this.updateCycleTotals(cycle.id);

    // Check if all contributions now received
    const { data: allContributions } = await supabase
      .from('cycle_contributions')
      .select('status')
      .eq('cycle_id', cycle.id);

    const allComplete = allContributions?.every(c => c.status === 'completed' || c.status === 'covered');

    if (allComplete && ['grace_period', 'deadline_reached', 'collecting'].includes(cycle.status)) {
      // All contributions received! Transition to ready_payout
      const collectedAmount = await this.calculateCollectedAmount(cycle.id);

      await supabase
        .from('circle_cycles')
        .update({
          status: 'ready_payout',
          status_changed_at: new Date().toISOString(),
          collected_amount: collectedAmount,
          payout_amount: collectedAmount * (1 - (circle.platform_fee_percent || 0.02)),
          platform_fee: collectedAmount * (circle.platform_fee_percent || 0.02),
        })
        .eq('id', cycle.id);

      await this.logCycleEvent(cycle.id, circle.id, 'ready_for_payout', {
        collected_amount: collectedAmount,
        recipient_user_id: cycle.recipient_user_id,
        triggered_by: 'final_contribution',
      });
    }

    // Notify user
    await this.notifyUser(payload.user_id, {
      type: 'contribution_confirmed',
      title: 'Contribution Received',
      body: `Your ${payload.amount} XAF contribution to ${circle.name} has been received.` +
            (wasOnTime ? '' : ` (${daysLate} days late)`),
      data: {
        circle_id: circle.id,
        cycle_id: cycle.id,
        amount: payload.amount,
        total_contributed: newAmount,
        is_complete: isComplete,
      },
    });

    // Cancel any pending reminders for this user/cycle
    await supabase
      .from('scheduled_notifications')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: 'contribution_received',
      })
      .eq('user_id', payload.user_id)
      .eq('cycle_id', cycle.id)
      .eq('status', 'scheduled');

    console.log(`[ContributionProcessing] Successfully processed contribution ${contribution.id}: ${newStatus}`);

    return {
      success: true,
      contribution_id: contribution.id,
      status: newStatus,
      was_on_time: wasOnTime,
      days_late: daysLate,
      late_fee: lateFee,
      message: isComplete
        ? 'Contribution completed successfully'
        : `Partial contribution received (${newAmount}/${contribution.expected_amount})`,
    };
  }

  /**
   * Process a failed contribution payment
   */
  async processContributionFailed(payload: PaymentWebhookPayload): Promise<void> {
    console.log(`[ContributionProcessing] Processing failed contribution for user ${payload.user_id}`);

    // Find the cycle
    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('circle_id', payload.circle_id)
      .eq('cycle_number', payload.cycle_number)
      .single();

    if (!cycle) {
      console.error(`[ContributionProcessing] Cycle not found for failed payment`);
      return;
    }

    // Log the failed attempt
    await this.logCycleEvent(cycle.id, cycle.circle_id, 'contribution_partial', {
      user_id: payload.user_id,
      amount: payload.amount,
      status: 'payment_failed',
      error: payload.metadata?.error || 'Payment failed',
      transaction_id: payload.transaction_id,
    });

    // Notify user
    await this.notifyUser(payload.user_id, {
      type: 'contribution_failed',
      title: 'Payment Failed',
      body: `Your contribution of ${payload.amount} XAF to ${cycle.circle.name} could not be processed. Please try again.`,
      priority: 'high',
      data: {
        circle_id: cycle.circle_id,
        cycle_id: cycle.id,
        amount: payload.amount,
        error: payload.metadata?.error,
      },
    });
  }

  /**
   * Handle payout completion webhook
   */
  async processPayoutCompleted(
    cycleId: string,
    transactionId: string,
    amount: number
  ): Promise<void> {
    console.log(`[ContributionProcessing] Processing payout completion for cycle ${cycleId}`);

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('id', cycleId)
      .single();

    if (!cycle) {
      console.error(`[ContributionProcessing] Cycle not found: ${cycleId}`);
      return;
    }

    // Update cycle status
    await supabase
      .from('circle_cycles')
      .update({
        status: 'payout_completed',
        status_changed_at: new Date().toISOString(),
        actual_payout_date: new Date().toISOString().split('T')[0],
        payout_transaction_id: transactionId,
      })
      .eq('id', cycleId);

    // Log event
    await this.logCycleEvent(cycleId, cycle.circle_id, 'payout_completed', {
      transaction_id: transactionId,
      amount: amount,
      recipient_user_id: cycle.recipient_user_id,
    });

    // Notify recipient
    if (cycle.recipient_user_id) {
      await this.notifyUser(cycle.recipient_user_id, {
        type: 'payout_completed',
        title: 'Payout Received!',
        body: `Your ${amount} XAF payout from ${cycle.circle.name} has been deposited to your account.`,
        data: {
          circle_id: cycle.circle_id,
          cycle_id: cycleId,
          amount: amount,
        },
      });
    }

    // XnScore bonus for receiving payout
    if (cycle.recipient_user_id) {
      await this.adjustXnScore(cycle.recipient_user_id, {
        reason: 'payout_received',
        points: +1,
        metadata: {
          circle_id: cycle.circle_id,
          cycle_id: cycleId,
          amount: amount,
        },
      });
    }
  }

  /**
   * Handle payout failure webhook
   */
  async processPayoutFailed(
    cycleId: string,
    error: string
  ): Promise<void> {
    console.log(`[ContributionProcessing] Processing payout failure for cycle ${cycleId}`);

    const { data: cycle } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('id', cycleId)
      .single();

    if (!cycle) {
      console.error(`[ContributionProcessing] Cycle not found: ${cycleId}`);
      return;
    }

    // Check retry count
    const newAttempts = (cycle.payout_attempts || 0) + 1;
    const maxAttempts = 3;

    if (newAttempts < maxAttempts) {
      // Schedule retry
      await supabase
        .from('circle_cycles')
        .update({
          status: 'payout_retry',
          status_changed_at: new Date().toISOString(),
          payout_attempts: newAttempts,
          last_payout_error: error,
          last_payout_attempt_at: new Date().toISOString(),
        })
        .eq('id', cycleId);

      await this.logCycleEvent(cycleId, cycle.circle_id, 'payout_retried', {
        error: error,
        attempt: newAttempts,
        max_attempts: maxAttempts,
      });

    } else {
      // Mark as failed after max attempts
      await supabase
        .from('circle_cycles')
        .update({
          status: 'payout_failed',
          status_changed_at: new Date().toISOString(),
          payout_attempts: newAttempts,
          last_payout_error: error,
          last_payout_attempt_at: new Date().toISOString(),
        })
        .eq('id', cycleId);

      await this.logCycleEvent(cycleId, cycle.circle_id, 'payout_failed', {
        error: error,
        attempts: newAttempts,
      });

      // Alert operations team
      await this.alertOps('payout_failed_max_retries', {
        cycle_id: cycleId,
        circle_id: cycle.circle_id,
        recipient_user_id: cycle.recipient_user_id,
        amount: cycle.payout_amount,
        error: error,
        attempts: newAttempts,
      });

      // Notify recipient
      if (cycle.recipient_user_id) {
        await this.notifyUser(cycle.recipient_user_id, {
          type: 'payout_failed',
          title: 'Payout Issue',
          body: `There was an issue with your payout from ${cycle.circle.name}. Our team is looking into it.`,
          priority: 'high',
          data: {
            circle_id: cycle.circle_id,
            cycle_id: cycleId,
          },
        });
      }
    }
  }

  /**
   * Manually excuse a member's contribution (admin action)
   */
  async excuseContribution(
    cycleId: string,
    userId: string,
    reason: string,
    adminUserId: string
  ): Promise<{ success: boolean; message: string }> {
    const { data: contribution } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .single();

    if (!contribution) {
      return { success: false, message: 'Contribution record not found' };
    }

    if (contribution.status === 'completed') {
      return { success: false, message: 'Contribution already completed' };
    }

    await supabase
      .from('cycle_contributions')
      .update({
        status: 'excused',
        covered_by: `admin:${adminUserId}`,
      })
      .eq('id', contribution.id);

    await this.logCycleEvent(cycleId, contribution.circle_id, 'contribution_excused', {
      user_id: userId,
      reason: reason,
      admin_user_id: adminUserId,
    }, adminUserId);

    return { success: true, message: 'Contribution excused successfully' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async calculateCollectedAmount(cycleId: string): Promise<number> {
    const { data } = await supabase
      .from('cycle_contributions')
      .select('contributed_amount')
      .eq('cycle_id', cycleId)
      .in('status', ['completed', 'covered']);

    return data?.reduce((sum, c) => sum + parseFloat(c.contributed_amount || '0'), 0) || 0;
  }

  private async updateCycleTotals(cycleId: string): Promise<void> {
    const { data: contributions } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycleId);

    const completed = contributions?.filter(c =>
      ['completed', 'covered'].includes(c.status)
    ) || [];

    const collectedAmount = completed.reduce(
      (sum, c) => sum + parseFloat(c.contributed_amount || '0'),
      0
    );

    const lateFees = contributions?.reduce(
      (sum, c) => sum + (c.late_fee_paid ? parseFloat(c.late_fee_amount || '0') : 0),
      0
    ) || 0;

    await supabase
      .from('circle_cycles')
      .update({
        collected_amount: collectedAmount,
        received_contributions: completed.length,
        late_fees_collected: lateFees,
      })
      .eq('id', cycleId);
  }

  private async logCycleEvent(
    cycleId: string,
    circleId: string,
    eventType: string,
    details: Record<string, any>,
    userId?: string
  ): Promise<void> {
    await supabase
      .from('cycle_events')
      .insert({
        cycle_id: cycleId,
        circle_id: circleId,
        event_type: eventType,
        details,
        user_id: userId,
        triggered_by: userId ? 'user' : 'webhook',
      });
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

  private async adjustXnScore(
    userId: string,
    adjustment: {
      reason: string;
      points: number;
      metadata?: Record<string, any>;
    }
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

  private async alertOps(
    alertType: string,
    details: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('ops_alerts')
      .insert({
        alert_type: alertType,
        details,
        status: 'open',
      });

    console.error(`[ContributionProcessing] OPS ALERT: ${alertType}`, details);
  }
}

// Export singleton instance
export const contributionProcessingService = ContributionProcessingService.getInstance();
