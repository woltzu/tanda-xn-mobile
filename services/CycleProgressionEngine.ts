/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CYCLE PROGRESSION ENGINE - THE HEARTBEAT OF TANDAXN
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * This engine runs continuously (every 15 minutes) managing the lifecycle of
 * every circle from formation through completion.
 *
 * PHASES:
 * 1. Start Due Cycles - Begin cycles scheduled for today
 * 2. Process Deadlines - Handle contribution deadlines
 * 3. Process Grace Periods - Manage late payment windows
 * 4. Execute Payouts - Initiate payout transfers
 * 5. Check Payout Statuses - Verify transfer completions
 * 6. Close Cycles - Complete cycles and advance to next
 *
 * @module CycleProgressionEngine
 */

import { supabase } from '@/lib/supabase';
import {
  addDays,
  addWeeks,
  addMonths,
  subDays,
  differenceInDays,
  differenceInHours,
  format,
  startOfDay,
  endOfMonth,
  isAfter,
  isBefore,
  parseISO,
} from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CycleStatus =
  | 'scheduled'
  | 'collecting'
  | 'deadline_reached'
  | 'grace_period'
  | 'ready_payout'
  | 'payout_pending'
  | 'payout_completed'
  | 'payout_failed'
  | 'payout_retry'
  | 'closed'
  | 'skipped'
  | 'cancelled';

export type ContributionStatus =
  | 'pending'
  | 'partial'
  | 'completed'
  | 'late'
  | 'missed'
  | 'excused'
  | 'covered';

export type IncompleteContributionPolicy =
  | 'strict_wait'
  | 'grace_then_proceed'
  | 'grace_then_cover'
  | 'immediate_proceed'
  | 'immediate_cover';

export type CycleEventType =
  | 'cycle_created'
  | 'cycle_started'
  | 'cycle_start_failed'
  | 'deadline_reached'
  | 'deadline_processing_failed'
  | 'contribution_received'
  | 'contribution_partial'
  | 'contribution_late'
  | 'contribution_missed'
  | 'contribution_excused'
  | 'contribution_covered'
  | 'grace_period_started'
  | 'grace_period_extended'
  | 'grace_period_ended'
  | 'ready_for_payout'
  | 'payout_initiated'
  | 'payout_initiation_failed'
  | 'payout_completed'
  | 'payout_failed'
  | 'payout_retried'
  | 'default_recorded'
  | 'default_resolved'
  | 'reserve_used'
  | 'reserve_partial_coverage'
  | 'cycle_closed'
  | 'cycle_skipped'
  | 'cycle_cancelled'
  | 'admin_intervention'
  | 'system_error'
  | 'webhook_received';

export interface CircleCycle {
  id: string;
  circle_id: string;
  cycle_number: number;
  start_date: string;
  contribution_deadline: string;
  grace_period_end?: string;
  expected_payout_date: string;
  actual_payout_date?: string;
  status: CycleStatus;
  status_changed_at: string;
  expected_amount: number;
  collected_amount: number;
  payout_amount?: number;
  platform_fee: number;
  late_fees_collected: number;
  recipient_user_id?: string;
  recipient_position?: number;
  expected_contributions: number;
  received_contributions: number;
  grace_extensions: number;
  max_grace_extensions: number;
  payout_transaction_id?: string;
  payout_processor?: string;
  payout_attempts: number;
  last_payout_error?: string;
  last_payout_attempt_at?: string;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  circle?: Circle;
}

export interface Circle {
  id: string;
  name: string;
  community_id?: string;
  contribution_amount: number;
  total_cycles: number;
  max_members: number;
  status: string;
  start_date: string;
  contribution_frequency: string;
  incomplete_contribution_policy: IncompleteContributionPolicy;
  grace_period_days: number;
  platform_fee_percent: number;
  current_cycle_number: number;
  current_cycle_id?: string;
}

export interface CycleContribution {
  id: string;
  cycle_id: string;
  circle_id: string;
  user_id: string;
  member_id?: string;
  expected_amount: number;
  due_date: string;
  contributed_amount: number;
  contributed_at?: string;
  status: ContributionStatus;
  was_on_time?: boolean;
  days_late: number;
  late_fee_amount: number;
  late_fee_paid: boolean;
  transaction_id?: string;
  payment_method?: string;
  in_grace_period: boolean;
  grace_reminder_sent: boolean;
  covered_by?: string;
  covered_amount: number;
  reminder_count: number;
  last_reminder_at?: string;
}

export interface EngineRunResults {
  cyclesStarted: number;
  deadlinesProcessed: number;
  gracePeriodsStarted: number;
  gracePeriodsEnded: number;
  payoutsInitiated: number;
  payoutsCompleted: number;
  cyclesClosed: number;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class CycleProgressionEngine {
  private static instance: CycleProgressionEngine;

  private constructor() {}

  public static getInstance(): CycleProgressionEngine {
    if (!CycleProgressionEngine.instance) {
      CycleProgressionEngine.instance = new CycleProgressionEngine();
    }
    return CycleProgressionEngine.instance;
  }

  /**
   * Main entry point - runs all phases of the cycle progression engine
   * Should be called every 15 minutes via cron job
   */
  async run(): Promise<EngineRunResults> {
    const startTime = Date.now();
    console.log(`[CycleEngine] Starting cycle progression run at ${new Date().toISOString()}`);

    const results: EngineRunResults = {
      cyclesStarted: 0,
      deadlinesProcessed: 0,
      gracePeriodsStarted: 0,
      gracePeriodsEnded: 0,
      payoutsInitiated: 0,
      payoutsCompleted: 0,
      cyclesClosed: 0,
      errors: [],
    };

    // Create engine run record
    const { data: runRecord } = await supabase
      .from('cycle_engine_runs')
      .insert({
        started_at: new Date().toISOString(),
        status: 'running',
      })
      .select()
      .single();

    try {
      // PHASE 1: Start cycles that should begin today
      results.cyclesStarted = await this.startDueCycles();

      // PHASE 2: Process contribution deadlines
      results.deadlinesProcessed = await this.processContributionDeadlines();

      // PHASE 3: Handle grace period expirations
      const graceResults = await this.processGracePeriods();
      results.gracePeriodsStarted = graceResults.started;
      results.gracePeriodsEnded = graceResults.ended;

      // PHASE 4: Execute ready payouts
      results.payoutsInitiated = await this.executeReadyPayouts();

      // PHASE 5: Check payout statuses
      results.payoutsCompleted = await this.checkPayoutStatuses();

      // PHASE 6: Close completed cycles and advance
      results.cyclesClosed = await this.closeCompletedCycles();

    } catch (error: any) {
      console.error('[CycleEngine] Critical error:', error);
      results.errors.push(error.message);

      await this.alertOps('cycle_engine_error', {
        error: error.message,
        stack: error.stack,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[CycleEngine] Completed in ${duration}ms:`, results);

    // Update engine run record
    if (runRecord) {
      await supabase
        .from('cycle_engine_runs')
        .update({
          completed_at: new Date().toISOString(),
          duration_ms: duration,
          status: results.errors.length > 0 ? 'completed_with_errors' : 'success',
          cycles_started: results.cyclesStarted,
          deadlines_processed: results.deadlinesProcessed,
          grace_periods_started: results.gracePeriodsStarted,
          grace_periods_ended: results.gracePeriodsEnded,
          payouts_initiated: results.payoutsInitiated,
          payouts_completed: results.payoutsCompleted,
          cycles_closed: results.cyclesClosed,
          errors: results.errors,
        })
        .eq('id', runRecord.id);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: START DUE CYCLES
  // ═══════════════════════════════════════════════════════════════════════════

  private async startDueCycles(): Promise<number> {
    const today = startOfDay(new Date()).toISOString().split('T')[0];

    // Find cycles scheduled to start today or earlier
    const { data: dueCycles, error } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'scheduled')
      .lte('start_date', today);

    if (error) {
      console.error('[CycleEngine] Error fetching due cycles:', error);
      return 0;
    }

    let started = 0;

    for (const cycle of dueCycles || []) {
      try {
        await this.startCycle(cycle);
        started++;
      } catch (error: any) {
        console.error(`[CycleEngine] Failed to start cycle ${cycle.id}:`, error);
        await this.logCycleEvent(cycle.id, cycle.circle_id, 'cycle_start_failed', {
          error: error.message,
        });
      }
    }

    return started;
  }

  private async startCycle(cycle: CircleCycle): Promise<void> {
    const circle = cycle.circle as Circle;

    // Verify circle is still active
    if (circle.status !== 'active') {
      throw new Error(`Circle ${circle.id} is not active (status: ${circle.status})`);
    }

    // Get all active members
    const { data: members } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('status', 'active');

    if (!members || members.length === 0) {
      throw new Error(`Circle ${circle.id} has no active members`);
    }

    // Get payout recipient for this cycle from payout orders
    const { data: payoutOrder } = await supabase
      .from('payout_orders')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('is_final', true)
      .single();

    if (!payoutOrder) {
      throw new Error(`No payout order found for circle ${circle.id}`);
    }

    const orderArray = payoutOrder.order_data as any[];
    const recipient = orderArray.find((o: any) => o.position === cycle.cycle_number);

    if (!recipient) {
      throw new Error(`No recipient for position ${cycle.cycle_number} in circle ${circle.id}`);
    }

    // Create contribution records for each member
    const contributionRecords = members.map(member => ({
      cycle_id: cycle.id,
      circle_id: circle.id,
      user_id: member.user_id,
      member_id: member.id,
      expected_amount: circle.contribution_amount,
      due_date: cycle.contribution_deadline,
      status: 'pending' as ContributionStatus,
    }));

    const { error: insertError } = await supabase
      .from('cycle_contributions')
      .insert(contributionRecords);

    if (insertError) {
      throw new Error(`Failed to create contribution records: ${insertError.message}`);
    }

    // Update cycle status
    await supabase
      .from('circle_cycles')
      .update({
        status: 'collecting',
        status_changed_at: new Date().toISOString(),
        recipient_user_id: recipient.user_id,
        recipient_position: cycle.cycle_number,
        expected_contributions: members.length,
        expected_amount: circle.contribution_amount * members.length,
      })
      .eq('id', cycle.id);

    // Log event
    await this.logCycleEvent(cycle.id, circle.id, 'cycle_started', {
      cycle_number: cycle.cycle_number,
      expected_contributions: members.length,
      expected_amount: circle.contribution_amount * members.length,
      recipient_user_id: recipient.user_id,
      contribution_deadline: cycle.contribution_deadline,
    });

    // Notify all members
    for (const member of members) {
      const isRecipient = member.user_id === recipient.user_id;

      await this.notifyUser(member.user_id, {
        type: 'cycle_started',
        title: `${circle.name} - Cycle ${cycle.cycle_number} Started`,
        body: isRecipient
          ? `This is YOUR payout cycle! Contribute ${circle.contribution_amount} XAF by ${format(parseISO(cycle.contribution_deadline), 'MMM d')}.`
          : `Cycle ${cycle.cycle_number} has started. Contribute ${circle.contribution_amount} XAF by ${format(parseISO(cycle.contribution_deadline), 'MMM d')}.`,
        data: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          cycle_number: cycle.cycle_number,
          amount: circle.contribution_amount,
          deadline: cycle.contribution_deadline,
          is_recipient: isRecipient,
        },
      });
    }

    // Schedule reminder notifications
    await this.scheduleContributionReminders(cycle, circle, members);

    console.log(`[CycleEngine] Started cycle ${cycle.cycle_number} for circle ${circle.id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: PROCESS CONTRIBUTION DEADLINES
  // ═══════════════════════════════════════════════════════════════════════════

  private async processContributionDeadlines(): Promise<number> {
    const now = new Date().toISOString();

    // Find cycles past their deadline that are still collecting
    const { data: pastDeadlineCycles } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'collecting')
      .lt('contribution_deadline', now.split('T')[0]);

    let processed = 0;

    for (const cycle of pastDeadlineCycles || []) {
      try {
        await this.processDeadline(cycle);
        processed++;
      } catch (error: any) {
        console.error(`[CycleEngine] Failed to process deadline for cycle ${cycle.id}:`, error);
        await this.logCycleEvent(cycle.id, cycle.circle_id, 'deadline_processing_failed', {
          error: error.message,
        });
      }
    }

    return processed;
  }

  private async processDeadline(cycle: CircleCycle): Promise<void> {
    const circle = cycle.circle as Circle;

    // Get contribution status
    const { data: contributions } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycle.id);

    const completed = contributions?.filter(c => c.status === 'completed') || [];
    const pending = contributions?.filter(c =>
      ['pending', 'partial'].includes(c.status)
    ) || [];

    const allReceived = pending.length === 0;
    const collectedAmount = completed.reduce(
      (sum, c) => sum + parseFloat(c.contributed_amount || '0'),
      0
    );

    // Update cycle with collection status
    await supabase
      .from('circle_cycles')
      .update({
        status: 'deadline_reached',
        status_changed_at: new Date().toISOString(),
        received_contributions: completed.length,
        collected_amount: collectedAmount,
      })
      .eq('id', cycle.id);

    await this.logCycleEvent(cycle.id, circle.id, 'deadline_reached', {
      expected_contributions: contributions?.length || 0,
      received_contributions: completed.length,
      collected_amount: collectedAmount,
      missing_count: pending.length,
    });

    if (allReceived) {
      // All contributions received - proceed to payout
      await this.transitionToReadyPayout(cycle, collectedAmount);
    } else {
      // Missing contributions - handle based on policy
      await this.handleMissingContributions(cycle, pending, collectedAmount);
    }
  }

  private async handleMissingContributions(
    cycle: CircleCycle,
    pendingContributions: CycleContribution[],
    collectedAmount: number
  ): Promise<void> {
    const circle = cycle.circle as Circle;
    const policy = circle.incomplete_contribution_policy || 'grace_then_proceed';

    switch (policy) {
      case 'strict_wait':
        await this.startGracePeriod(cycle, pendingContributions, 'indefinite');
        break;

      case 'grace_then_proceed':
        await this.startGracePeriod(cycle, pendingContributions, 'standard');
        break;

      case 'grace_then_cover':
        await this.startGracePeriod(cycle, pendingContributions, 'cover_after');
        break;

      case 'immediate_proceed':
        await this.transitionToReadyPayout(cycle, collectedAmount);
        await this.recordDefaults(cycle, pendingContributions);
        break;

      case 'immediate_cover':
        const covered = await this.attemptCoverFromReserve(cycle, pendingContributions);
        if (covered.success) {
          await this.transitionToReadyPayout(cycle, cycle.expected_amount);
        } else {
          await this.transitionToReadyPayout(cycle, collectedAmount + covered.amountCovered);
        }
        await this.recordDefaults(cycle, pendingContributions);
        break;

      default:
        await this.startGracePeriod(cycle, pendingContributions, 'standard');
    }
  }

  private async startGracePeriod(
    cycle: CircleCycle,
    pendingContributions: CycleContribution[],
    graceType: 'standard' | 'indefinite' | 'cover_after'
  ): Promise<void> {
    const circle = cycle.circle as Circle;

    const graceDays = graceType === 'indefinite'
      ? 30 // Max 30 days even for indefinite
      : (circle.grace_period_days || 2);

    const graceEndDate = addDays(new Date(), graceDays).toISOString().split('T')[0];

    // Update cycle
    await supabase
      .from('circle_cycles')
      .update({
        status: 'grace_period',
        status_changed_at: new Date().toISOString(),
        grace_period_end: graceEndDate,
      })
      .eq('id', cycle.id);

    // Update pending contributions to late status
    for (const contribution of pendingContributions) {
      await supabase
        .from('cycle_contributions')
        .update({
          in_grace_period: true,
          status: 'late',
        })
        .eq('id', contribution.id);
    }

    await this.logCycleEvent(cycle.id, circle.id, 'grace_period_started', {
      grace_type: graceType,
      grace_days: graceDays,
      grace_end_date: graceEndDate,
      pending_contributions: pendingContributions.map(c => ({
        user_id: c.user_id,
        expected_amount: c.expected_amount,
        contributed_amount: c.contributed_amount,
      })),
    });

    // Notify members who haven't paid
    for (const contribution of pendingContributions) {
      await this.notifyUser(contribution.user_id, {
        type: 'contribution_overdue',
        title: 'Contribution Overdue',
        body: `Your contribution of ${contribution.expected_amount} XAF to ${circle.name} is overdue. You have ${graceDays} days to pay.`,
        priority: 'high',
        data: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          amount: contribution.expected_amount,
          grace_end_date: graceEndDate,
        },
      });

      // Impact XnScore for being late
      await this.adjustXnScore(contribution.user_id, {
        reason: 'contribution_late',
        points: -5,
        metadata: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          cycle_number: cycle.cycle_number,
        },
      });
    }

    // Notify recipient that payout is delayed
    if (cycle.recipient_user_id) {
      await this.notifyUser(cycle.recipient_user_id, {
        type: 'payout_delayed',
        title: 'Payout Delayed',
        body: `Your payout from ${circle.name} is delayed while we collect remaining contributions. Grace period ends ${format(parseISO(graceEndDate), 'MMM d')}.`,
        data: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          grace_end_date: graceEndDate,
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: PROCESS GRACE PERIODS
  // ═══════════════════════════════════════════════════════════════════════════

  private async processGracePeriods(): Promise<{ started: number; ended: number }> {
    const now = new Date();
    const results = { started: 0, ended: 0 };

    // Find cycles in grace period
    const { data: gracePeriodCycles } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'grace_period');

    for (const cycle of gracePeriodCycles || []) {
      try {
        // Check if any new contributions came in
        const { data: stillPending } = await supabase
          .from('cycle_contributions')
          .select('*')
          .eq('cycle_id', cycle.id)
          .in('status', ['pending', 'partial', 'late']);

        if (!stillPending || stillPending.length === 0) {
          // All contributions received during grace period!
          const collectedAmount = await this.calculateCollectedAmount(cycle.id);
          await this.transitionToReadyPayout(cycle, collectedAmount);
          results.ended++;
          continue;
        }

        // Check if grace period has expired
        if (cycle.grace_period_end && isAfter(now, parseISO(cycle.grace_period_end))) {
          await this.endGracePeriod(cycle, stillPending);
          results.ended++;
        }

      } catch (error: any) {
        console.error(`[CycleEngine] Failed to process grace period for cycle ${cycle.id}:`, error);
      }
    }

    return results;
  }

  private async endGracePeriod(
    cycle: CircleCycle,
    stillPending: CycleContribution[]
  ): Promise<void> {
    const circle = cycle.circle as Circle;
    const policy = circle.incomplete_contribution_policy || 'grace_then_proceed';

    await this.logCycleEvent(cycle.id, circle.id, 'grace_period_ended', {
      still_pending_count: stillPending.length,
      still_pending_users: stillPending.map(c => c.user_id),
    });

    // Record defaults for those who still haven't paid
    await this.recordDefaults(cycle, stillPending);

    // Calculate what we have
    const collectedAmount = await this.calculateCollectedAmount(cycle.id);

    // Decide whether to cover from reserve
    if (policy === 'grace_then_cover') {
      const covered = await this.attemptCoverFromReserve(cycle, stillPending);

      if (covered.success) {
        await this.transitionToReadyPayout(cycle, cycle.expected_amount);
      } else {
        await this.transitionToReadyPayout(cycle, collectedAmount + covered.amountCovered);
      }
    } else {
      // Proceed with what we have
      await this.transitionToReadyPayout(cycle, collectedAmount);
    }
  }

  private async recordDefaults(
    cycle: CircleCycle,
    pendingContributions: CycleContribution[]
  ): Promise<void> {
    const circle = cycle.circle as Circle;

    for (const contribution of pendingContributions) {
      // Update contribution status
      await supabase
        .from('cycle_contributions')
        .update({ status: 'missed' })
        .eq('id', contribution.id);

      // Create default record
      const defaultAmount = contribution.expected_amount - (contribution.contributed_amount || 0);

      await supabase
        .from('member_defaults')
        .insert({
          user_id: contribution.user_id,
          circle_id: circle.id,
          community_id: circle.community_id,
          cycle_id: cycle.id,
          cycle_number: cycle.cycle_number,
          expected_amount: contribution.expected_amount,
          paid_amount: contribution.contributed_amount || 0,
          default_amount: defaultAmount,
          status: 'unresolved',
        });

      // Severe XnScore impact
      await this.adjustXnScore(contribution.user_id, {
        reason: 'contribution_default',
        points: -30,
        metadata: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          cycle_number: cycle.cycle_number,
          amount: contribution.expected_amount,
        },
      });

      // Propagate to vouchers
      await this.propagateDefaultToVouchers(contribution.user_id, circle.id);

      // Notify the defaulter
      await this.notifyUser(contribution.user_id, {
        type: 'contribution_default_recorded',
        title: 'Default Recorded',
        body: `Your missed contribution to ${circle.name} has been recorded as a default. This significantly impacts your XnScore.`,
        priority: 'high',
        data: {
          circle_id: circle.id,
          cycle_id: cycle.id,
          amount: contribution.expected_amount,
        },
      });

      await this.logCycleEvent(cycle.id, circle.id, 'default_recorded', {
        user_id: contribution.user_id,
        amount: defaultAmount,
      });
    }
  }

  private async attemptCoverFromReserve(
    cycle: CircleCycle,
    pendingContributions: CycleContribution[]
  ): Promise<{ success: boolean; amountCovered: number }> {
    const circle = cycle.circle as Circle;

    const missingAmount = pendingContributions.reduce(
      (sum, c) => sum + (c.expected_amount - (c.contributed_amount || 0)),
      0
    );

    // Get reserve balance for this community
    const { data: reserveData } = await supabase
      .from('reserve_funds')
      .select('balance')
      .eq('community_id', circle.community_id)
      .single();

    const reserveBalance = parseFloat(reserveData?.balance || '0');

    // Reserve policy: don't use more than 20% of reserve for any single coverage
    const maxCoverage = reserveBalance * 0.20;

    if (missingAmount <= maxCoverage && missingAmount <= reserveBalance) {
      // Can cover fully

      // Update contribution records
      for (const contribution of pendingContributions) {
        const coverAmount = contribution.expected_amount - (contribution.contributed_amount || 0);

        await supabase
          .from('cycle_contributions')
          .update({
            status: 'covered',
            covered_by: 'reserve',
            covered_amount: coverAmount,
          })
          .eq('id', contribution.id);
      }

      // Update cycle
      await supabase
        .from('circle_cycles')
        .update({
          collected_amount: cycle.expected_amount,
        })
        .eq('id', cycle.id);

      // Deduct from reserve
      await supabase
        .from('reserve_funds')
        .update({
          balance: reserveBalance - missingAmount,
        })
        .eq('community_id', circle.community_id);

      await this.logCycleEvent(cycle.id, circle.id, 'reserve_used', {
        amount_covered: missingAmount,
        contributions_covered: pendingContributions.length,
      });

      return { success: true, amountCovered: missingAmount };

    } else if (reserveBalance > 0) {
      // Partial coverage
      const partialCoverage = Math.min(missingAmount, maxCoverage, reserveBalance);

      await this.logCycleEvent(cycle.id, circle.id, 'reserve_partial_coverage', {
        requested_amount: missingAmount,
        amount_covered: partialCoverage,
        reason: 'insufficient_reserve',
      });

      return { success: false, amountCovered: partialCoverage };

    } else {
      return { success: false, amountCovered: 0 };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: EXECUTE READY PAYOUTS
  // ═══════════════════════════════════════════════════════════════════════════

  private async executeReadyPayouts(): Promise<number> {
    const { data: readyPayoutCycles } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'ready_payout');

    let initiated = 0;

    for (const cycle of readyPayoutCycles || []) {
      try {
        await this.initiatePayout(cycle);
        initiated++;
      } catch (error: any) {
        console.error(`[CycleEngine] Failed to initiate payout for cycle ${cycle.id}:`, error);

        await this.logCycleEvent(cycle.id, cycle.circle_id, 'payout_initiation_failed', {
          error: error.message,
          attempt: cycle.payout_attempts + 1,
        });

        // Update retry count
        await supabase
          .from('circle_cycles')
          .update({
            payout_attempts: cycle.payout_attempts + 1,
            last_payout_error: error.message,
            last_payout_attempt_at: new Date().toISOString(),
            status: cycle.payout_attempts >= 2 ? 'payout_failed' : 'ready_payout',
          })
          .eq('id', cycle.id);

        if (cycle.payout_attempts >= 2) {
          await this.alertOps('payout_failed_multiple_attempts', {
            cycle_id: cycle.id,
            circle_id: cycle.circle_id,
            recipient_user_id: cycle.recipient_user_id,
            error: error.message,
          });
        }
      }
    }

    return initiated;
  }

  private async transitionToReadyPayout(
    cycle: CircleCycle,
    payoutAmount: number
  ): Promise<void> {
    const circle = cycle.circle as Circle;

    // Calculate fee
    const platformFeePercent = circle.platform_fee_percent || 0.02;
    const platformFee = payoutAmount * platformFeePercent;
    const netPayout = payoutAmount - platformFee;

    await supabase
      .from('circle_cycles')
      .update({
        status: 'ready_payout',
        status_changed_at: new Date().toISOString(),
        collected_amount: payoutAmount,
        payout_amount: netPayout,
        platform_fee: platformFee,
      })
      .eq('id', cycle.id);

    await this.logCycleEvent(cycle.id, circle.id, 'ready_for_payout', {
      collected_amount: payoutAmount,
      platform_fee: platformFee,
      net_payout: netPayout,
      recipient_user_id: cycle.recipient_user_id,
    });
  }

  private async initiatePayout(cycle: CircleCycle): Promise<void> {
    const circle = cycle.circle as Circle;

    if (!cycle.recipient_user_id) {
      throw new Error('No recipient user ID for payout');
    }

    // Get recipient profile
    const { data: recipient } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', cycle.recipient_user_id)
      .single();

    if (!recipient) {
      throw new Error(`Recipient ${cycle.recipient_user_id} not found`);
    }

    // Get recipient's primary payment method
    const { data: paymentMethod } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', cycle.recipient_user_id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .single();

    if (!paymentMethod) {
      throw new Error(`Recipient ${cycle.recipient_user_id} has no active payment method`);
    }

    // Update cycle to payout pending
    await supabase
      .from('circle_cycles')
      .update({
        status: 'payout_pending',
        status_changed_at: new Date().toISOString(),
        payout_attempts: cycle.payout_attempts + 1,
        last_payout_attempt_at: new Date().toISOString(),
        payout_processor: paymentMethod.provider, // e.g., 'mtn_momo', 'orange_money'
      })
      .eq('id', cycle.id);

    await this.logCycleEvent(cycle.id, circle.id, 'payout_initiated', {
      amount: cycle.payout_amount,
      recipient_user_id: cycle.recipient_user_id,
      payment_method: paymentMethod.provider,
    });

    // Notify recipient
    await this.notifyUser(cycle.recipient_user_id, {
      type: 'payout_initiated',
      title: 'Payout on the Way!',
      body: `Your ${cycle.payout_amount} XAF payout from ${circle.name} has been initiated. Expect it shortly.`,
      data: {
        circle_id: circle.id,
        cycle_id: cycle.id,
        amount: cycle.payout_amount,
      },
    });

    // Note: Actual payment processing will be handled by PaymentGatewayAdapter
    // The webhook will update the cycle status when payment completes
    console.log(`[CycleEngine] Initiated payout for cycle ${cycle.id} to ${cycle.recipient_user_id}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: CHECK PAYOUT STATUSES
  // ═══════════════════════════════════════════════════════════════════════════

  private async checkPayoutStatuses(): Promise<number> {
    const { data: pendingPayoutCycles } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'payout_pending');

    let completed = 0;

    for (const cycle of pendingPayoutCycles || []) {
      // Check if payout has been completed (via webhook)
      // This is a fallback poll - webhooks should handle most cases

      if (cycle.payout_transaction_id) {
        // Check transaction status
        const { data: transaction } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', cycle.payout_transaction_id)
          .single();

        if (transaction?.status === 'completed') {
          await supabase
            .from('circle_cycles')
            .update({
              status: 'payout_completed',
              status_changed_at: new Date().toISOString(),
              actual_payout_date: new Date().toISOString().split('T')[0],
            })
            .eq('id', cycle.id);

          completed++;

        } else if (transaction?.status === 'failed') {
          await supabase
            .from('circle_cycles')
            .update({
              status: 'payout_failed',
              status_changed_at: new Date().toISOString(),
              last_payout_error: transaction.error_message || 'Payment failed',
            })
            .eq('id', cycle.id);

          await this.alertOps('payout_failed', {
            cycle_id: cycle.id,
            transaction_id: cycle.payout_transaction_id,
            error: transaction.error_message,
          });
        }
      }

      // Check for stuck payouts (pending > 72 hours)
      if (cycle.last_payout_attempt_at) {
        const pendingHours = differenceInHours(
          new Date(),
          parseISO(cycle.last_payout_attempt_at)
        );

        if (pendingHours > 72) {
          await this.alertOps('payout_stuck', {
            cycle_id: cycle.id,
            pending_hours: pendingHours,
          });
        }
      }
    }

    return completed;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: CLOSE COMPLETED CYCLES
  // ═══════════════════════════════════════════════════════════════════════════

  private async closeCompletedCycles(): Promise<number> {
    const { data: completedPayoutCycles } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('status', 'payout_completed');

    let closed = 0;

    for (const cycle of completedPayoutCycles || []) {
      try {
        await this.closeCycleAndAdvance(cycle);
        closed++;
      } catch (error: any) {
        console.error(`[CycleEngine] Failed to close cycle ${cycle.id}:`, error);
      }
    }

    return closed;
  }

  private async closeCycleAndAdvance(cycle: CircleCycle): Promise<void> {
    const circle = cycle.circle as Circle;

    // Get completed contributions for XnScore updates
    const { data: completedContributions } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycle.id)
      .eq('status', 'completed');

    // Update XnScore for on-time payers
    for (const contribution of completedContributions || []) {
      if (contribution.was_on_time) {
        await this.adjustXnScore(contribution.user_id, {
          reason: 'contribution_on_time',
          points: +2,
          metadata: {
            circle_id: circle.id,
            cycle_id: cycle.id,
            cycle_number: cycle.cycle_number,
          },
        });
      }
    }

    // Update cycle to closed
    await supabase
      .from('circle_cycles')
      .update({
        status: 'closed',
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', cycle.id);

    // Count defaults for this cycle
    const { count: defaultCount } = await supabase
      .from('member_defaults')
      .select('*', { count: 'exact', head: true })
      .eq('cycle_id', cycle.id);

    await this.logCycleEvent(cycle.id, circle.id, 'cycle_closed', {
      cycle_number: cycle.cycle_number,
      collected_amount: cycle.collected_amount,
      payout_amount: cycle.payout_amount,
      recipient_user_id: cycle.recipient_user_id,
      defaults: defaultCount || 0,
    });

    // Check if this was the last cycle
    const isLastCycle = cycle.cycle_number >= circle.total_cycles;

    if (isLastCycle) {
      await this.completeCircle(circle);
    } else {
      await this.advanceToNextCycle(circle, cycle);
    }
  }

  private async advanceToNextCycle(
    circle: Circle,
    completedCycle: CircleCycle
  ): Promise<void> {
    const nextCycleNumber = completedCycle.cycle_number + 1;

    // Check if next cycle already exists
    const { data: nextCycle } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('cycle_number', nextCycleNumber)
      .single();

    // Update circle's current cycle pointer
    await supabase
      .from('circles')
      .update({
        current_cycle_number: nextCycleNumber,
        current_cycle_id: nextCycle?.id,
      })
      .eq('id', circle.id);

    // Notify members about upcoming cycle
    const { data: members } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('status', 'active');

    // Get next recipient
    const { data: payoutOrder } = await supabase
      .from('payout_orders')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('is_final', true)
      .single();

    const orderArray = payoutOrder?.order_data as any[] || [];
    const nextRecipient = orderArray.find((o: any) => o.position === nextCycleNumber);

    for (const member of members || []) {
      const isNextRecipient = member.user_id === nextRecipient?.user_id;

      await this.notifyUser(member.user_id, {
        type: 'cycle_completed_next_starting',
        title: `${circle.name} - Cycle ${completedCycle.cycle_number} Complete`,
        body: isNextRecipient
          ? `Cycle ${completedCycle.cycle_number} is complete. YOU are next to receive the payout in Cycle ${nextCycleNumber}!`
          : `Cycle ${completedCycle.cycle_number} is complete. Cycle ${nextCycleNumber} starts ${nextCycle ? format(parseISO(nextCycle.start_date), 'MMM d') : 'soon'}.`,
        data: {
          circle_id: circle.id,
          completed_cycle_number: completedCycle.cycle_number,
          next_cycle_number: nextCycleNumber,
          is_next_recipient: isNextRecipient,
        },
      });
    }

    console.log(`[CycleEngine] Circle ${circle.id} advanced to cycle ${nextCycleNumber}`);
  }

  private async completeCircle(circle: Circle): Promise<void> {
    // Update circle status
    await supabase
      .from('circles')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', circle.id);

    // Update all memberships
    await supabase
      .from('circle_members')
      .update({
        status: 'completed',
      })
      .eq('circle_id', circle.id)
      .eq('status', 'active');

    // Calculate final stats
    const { data: contributions } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('circle_id', circle.id);

    const totalContributions = contributions?.filter(c => c.status === 'completed') || [];
    const totalLatePayments = contributions?.filter(c => c.was_on_time === false) || [];

    const { data: cycles } = await supabase
      .from('circle_cycles')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('status', 'closed');

    const totalPayouts = cycles?.length || 0;
    const totalPayoutAmount = cycles?.reduce((sum, c) => sum + parseFloat(c.payout_amount || '0'), 0) || 0;
    const totalPlatformFees = cycles?.reduce((sum, c) => sum + parseFloat(c.platform_fee || '0'), 0) || 0;

    const { count: totalDefaults } = await supabase
      .from('member_defaults')
      .select('*', { count: 'exact', head: true })
      .eq('circle_id', circle.id);

    // Store completion record
    await supabase
      .from('circle_completions')
      .insert({
        circle_id: circle.id,
        total_cycles: circle.total_cycles,
        total_contribution_amount: totalContributions.reduce((sum, c) => sum + parseFloat(c.contributed_amount || '0'), 0),
        total_contribution_count: totalContributions.length,
        total_payout_amount: totalPayoutAmount,
        total_payout_count: totalPayouts,
        total_defaults: totalDefaults || 0,
        total_late_payments: totalLatePayments.length,
        total_platform_fees: totalPlatformFees,
        on_time_rate: totalContributions.length > 0
          ? (totalContributions.length - totalLatePayments.length) / totalContributions.length
          : 1,
        completion_rate: contributions?.length
          ? totalContributions.length / contributions.length
          : 1,
      });

    // Award XnScore bonus for completing circle
    const { data: members } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('status', 'completed');

    for (const member of members || []) {
      // Check if member had any defaults
      const { count: memberDefaults } = await supabase
        .from('member_defaults')
        .select('*', { count: 'exact', head: true })
        .eq('circle_id', circle.id)
        .eq('user_id', member.user_id);

      if (memberDefaults === 0) {
        await this.adjustXnScore(member.user_id, {
          reason: 'circle_completed',
          points: +10,
          metadata: {
            circle_id: circle.id,
            total_cycles: circle.total_cycles,
          },
        });
      }

      await this.notifyUser(member.user_id, {
        type: 'circle_completed',
        title: `${circle.name} Complete!`,
        body: memberDefaults === 0
          ? `Congratulations! You completed all ${circle.total_cycles} cycles. +10 XnScore bonus!`
          : `${circle.name} has completed all ${circle.total_cycles} cycles.`,
        data: {
          circle_id: circle.id,
          total_cycles: circle.total_cycles,
          xn_score_bonus: memberDefaults === 0 ? 10 : 0,
        },
      });
    }

    console.log(`[CycleEngine] Circle ${circle.id} completed after ${circle.total_cycles} cycles`);
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

  private async logCycleEvent(
    cycleId: string,
    circleId: string,
    eventType: CycleEventType,
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
        triggered_by: 'system',
      });
  }

  private async scheduleContributionReminders(
    cycle: CircleCycle,
    circle: Circle,
    members: any[]
  ): Promise<void> {
    const deadline = parseISO(cycle.contribution_deadline);

    for (const member of members) {
      const reminders = [
        {
          type: 'contribution_reminder_early',
          scheduled_for: subDays(deadline, 7),
          condition_check: 'if_not_paid',
        },
        {
          type: 'contribution_reminder_midway',
          scheduled_for: subDays(deadline, 3),
          condition_check: 'if_not_paid',
        },
        {
          type: 'contribution_reminder_urgent',
          scheduled_for: subDays(deadline, 1),
          condition_check: 'if_not_paid',
        },
        {
          type: 'contribution_due_today',
          scheduled_for: deadline,
          condition_check: 'if_not_paid',
        },
      ];

      const now = new Date();

      for (const reminder of reminders) {
        // Only schedule if in the future
        if (isAfter(reminder.scheduled_for, now)) {
          await supabase
            .from('scheduled_notifications')
            .insert({
              user_id: member.user_id,
              circle_id: circle.id,
              cycle_id: cycle.id,
              notification_type: reminder.type,
              scheduled_for: reminder.scheduled_for.toISOString(),
              condition_check: reminder.condition_check,
              status: 'scheduled',
              payload: {
                circle_name: circle.name,
                amount: circle.contribution_amount,
                deadline: cycle.contribution_deadline,
              },
            });
        }
      }
    }
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
    // Insert notification into database
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

    // TODO: Also send push notification via FCM/APNS
    console.log(`[CycleEngine] Notified user ${userId}: ${notification.title}`);
  }

  private async adjustXnScore(
    userId: string,
    adjustment: {
      reason: string;
      points: number;
      metadata?: Record<string, any>;
    }
  ): Promise<void> {
    // Get current score
    const { data: scoreData } = await supabase
      .from('xn_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    const currentScore = scoreData?.score || 50;
    const newScore = Math.max(0, Math.min(100, currentScore + adjustment.points));

    // Update score
    await supabase
      .from('xn_scores')
      .upsert({
        user_id: userId,
        score: newScore,
        updated_at: new Date().toISOString(),
      });

    // Log score change
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

    console.log(`[CycleEngine] XnScore for ${userId}: ${currentScore} -> ${newScore} (${adjustment.reason})`);
  }

  private async propagateDefaultToVouchers(
    userId: string,
    circleId: string
  ): Promise<void> {
    // Get vouchers who vouched for this user in this circle
    const { data: vouchers } = await supabase
      .from('vouches')
      .select('*')
      .eq('vouchee_id', userId)
      .eq('circle_id', circleId)
      .eq('status', 'active');

    for (const vouch of vouchers || []) {
      // Reduce voucher's XnScore
      await this.adjustXnScore(vouch.voucher_id, {
        reason: 'vouchee_default',
        points: -10,
        metadata: {
          vouchee_id: userId,
          circle_id: circleId,
        },
      });

      // Notify voucher
      await this.notifyUser(vouch.voucher_id, {
        type: 'vouchee_defaulted',
        title: 'Your Vouchee Defaulted',
        body: `A member you vouched for has defaulted on their contribution. This affects your XnScore.`,
        priority: 'high',
        data: {
          vouchee_id: userId,
          circle_id: circleId,
        },
      });
    }
  }

  private async alertOps(
    alertType: string,
    details: Record<string, any>
  ): Promise<void> {
    // Insert alert for operations team
    await supabase
      .from('ops_alerts')
      .insert({
        alert_type: alertType,
        details,
        status: 'open',
        created_at: new Date().toISOString(),
      });

    console.error(`[CycleEngine] OPS ALERT: ${alertType}`, details);

    // TODO: Also send to Slack/PagerDuty/etc
  }
}

// Export singleton instance
export const cycleProgressionEngine = CycleProgressionEngine.getInstance();

// Export function for cron job
export async function runCycleProgressionEngine(): Promise<EngineRunResults> {
  return cycleProgressionEngine.run();
}
