/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CRON JOB HANDLER
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Handles scheduled tasks for TandaXn including:
 * - Cycle Progression Engine (every 15 minutes)
 * - Notification Processor (every 5 minutes)
 * - XnScore Recalculation (daily)
 * - Cleanup Tasks (weekly)
 *
 * This should be called by a cloud function (Supabase Edge Function, AWS Lambda, etc.)
 *
 * @module CronJobHandler
 */

import { supabase } from '@/lib/supabase';
import { runCycleProgressionEngine } from './CycleProgressionEngine';
import { contributionProcessingService } from './ContributionProcessingService';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CronJobType =
  | 'cycle_progression'
  | 'notification_processor'
  | 'xn_score_recalculation'
  | 'cleanup'
  | 'reminder_sender'
  | 'health_check';

export interface CronJobResult {
  job_type: CronJobType;
  success: boolean;
  duration_ms: number;
  details: Record<string, any>;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class CronJobHandler {
  private static instance: CronJobHandler;

  private constructor() {}

  public static getInstance(): CronJobHandler {
    if (!CronJobHandler.instance) {
      CronJobHandler.instance = new CronJobHandler();
    }
    return CronJobHandler.instance;
  }

  /**
   * Execute a specific cron job
   */
  async execute(jobType: CronJobType): Promise<CronJobResult> {
    const startTime = Date.now();
    console.log(`[CronJob] Starting ${jobType} at ${new Date().toISOString()}`);

    let result: CronJobResult = {
      job_type: jobType,
      success: false,
      duration_ms: 0,
      details: {},
      errors: [],
    };

    try {
      switch (jobType) {
        case 'cycle_progression':
          result = await this.runCycleProgression();
          break;

        case 'notification_processor':
          result = await this.processNotifications();
          break;

        case 'xn_score_recalculation':
          result = await this.recalculateXnScores();
          break;

        case 'cleanup':
          result = await this.runCleanupTasks();
          break;

        case 'reminder_sender':
          result = await this.sendScheduledReminders();
          break;

        case 'health_check':
          result = await this.runHealthCheck();
          break;

        default:
          throw new Error(`Unknown job type: ${jobType}`);
      }

    } catch (error: any) {
      result.errors.push(error.message);
      console.error(`[CronJob] Error in ${jobType}:`, error);
    }

    result.duration_ms = Date.now() - startTime;
    result.job_type = jobType;

    // Log the job execution
    await this.logJobExecution(result);

    console.log(`[CronJob] Completed ${jobType} in ${result.duration_ms}ms`);
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // JOB IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run the Cycle Progression Engine
   * Frequency: Every 15 minutes
   */
  private async runCycleProgression(): Promise<CronJobResult> {
    const engineResults = await runCycleProgressionEngine();

    return {
      job_type: 'cycle_progression',
      success: engineResults.errors.length === 0,
      duration_ms: 0,
      details: {
        cycles_started: engineResults.cyclesStarted,
        deadlines_processed: engineResults.deadlinesProcessed,
        grace_periods_started: engineResults.gracePeriodsStarted,
        grace_periods_ended: engineResults.gracePeriodsEnded,
        payouts_initiated: engineResults.payoutsInitiated,
        payouts_completed: engineResults.payoutsCompleted,
        cycles_closed: engineResults.cyclesClosed,
      },
      errors: engineResults.errors,
    };
  }

  /**
   * Process scheduled notifications
   * Frequency: Every 5 minutes
   */
  private async processNotifications(): Promise<CronJobResult> {
    const now = new Date().toISOString();
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Get due notifications
    const { data: dueNotifications } = await supabase
      .from('scheduled_notifications')
      .select(`
        *,
        circle:circles(name),
        cycle:circle_cycles(id, status)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(100);

    for (const notification of dueNotifications || []) {
      try {
        // Check condition
        let shouldSend = true;

        if (notification.condition_check === 'if_not_paid') {
          // Check if user has paid
          const { data: contribution } = await supabase
            .from('cycle_contributions')
            .select('status')
            .eq('cycle_id', notification.cycle_id)
            .eq('user_id', notification.user_id)
            .single();

          if (contribution?.status === 'completed' || contribution?.status === 'covered') {
            shouldSend = false;
          }
        }

        if (shouldSend) {
          // Create actual notification
          await supabase
            .from('notifications')
            .insert({
              user_id: notification.user_id,
              type: notification.notification_type,
              title: this.getNotificationTitle(notification),
              body: this.getNotificationBody(notification),
              data: notification.payload,
              status: 'unread',
            });

          // Update scheduled notification
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'sent',
              sent_at: now,
            })
            .eq('id', notification.id);

          sent++;
        } else {
          // Skip - condition not met
          await supabase
            .from('scheduled_notifications')
            .update({
              status: 'skipped',
              cancelled_reason: 'condition_not_met',
            })
            .eq('id', notification.id);

          skipped++;
        }

      } catch (error: any) {
        errors.push(`Notification ${notification.id}: ${error.message}`);

        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            cancelled_reason: error.message,
          })
          .eq('id', notification.id);
      }
    }

    return {
      job_type: 'notification_processor',
      success: errors.length === 0,
      duration_ms: 0,
      details: {
        total_processed: (dueNotifications || []).length,
        sent,
        skipped,
      },
      errors,
    };
  }

  /**
   * Send scheduled reminders
   * Frequency: Every 5 minutes (can be combined with notification processor)
   */
  private async sendScheduledReminders(): Promise<CronJobResult> {
    // This is essentially the same as notification processor
    // but kept separate for clarity
    return this.processNotifications();
  }

  /**
   * Recalculate XnScores for all users
   * Frequency: Daily at 2 AM
   */
  private async recalculateXnScores(): Promise<CronJobResult> {
    let updated = 0;
    const errors: string[] = [];

    // Get all users with activity in the last 90 days
    const { data: activeUsers } = await supabase
      .from('profiles')
      .select('id')
      .gte('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

    for (const user of activeUsers || []) {
      try {
        // Get contribution stats
        const { data: contributions } = await supabase
          .from('cycle_contributions')
          .select('status, was_on_time')
          .eq('user_id', user.id);

        const totalContribs = contributions?.length || 0;
        const completedOnTime = contributions?.filter(c =>
          c.status === 'completed' && c.was_on_time
        ).length || 0;
        const missed = contributions?.filter(c => c.status === 'missed').length || 0;

        // Get default count
        const { count: defaultCount } = await supabase
          .from('member_defaults')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'unresolved');

        // Get completed circles count
        const { count: completedCircles } = await supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'completed');

        // Calculate score
        let baseScore = 50;

        // On-time contribution bonus
        if (totalContribs > 0) {
          const onTimeRate = completedOnTime / totalContribs;
          baseScore += Math.round(onTimeRate * 30); // Up to +30 for perfect on-time
        }

        // Completed circles bonus
        baseScore += (completedCircles || 0) * 5; // +5 per completed circle

        // Penalties
        baseScore -= missed * 5; // -5 per missed contribution
        baseScore -= (defaultCount || 0) * 15; // -15 per unresolved default

        // Clamp score
        const newScore = Math.max(0, Math.min(100, baseScore));

        // Update score
        await supabase
          .from('xn_scores')
          .upsert({
            user_id: user.id,
            score: newScore,
            last_recalculated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        updated++;

      } catch (error: any) {
        errors.push(`User ${user.id}: ${error.message}`);
      }
    }

    return {
      job_type: 'xn_score_recalculation',
      success: errors.length === 0,
      duration_ms: 0,
      details: {
        users_processed: (activeUsers || []).length,
        scores_updated: updated,
      },
      errors,
    };
  }

  /**
   * Run cleanup tasks
   * Frequency: Weekly on Sundays at 3 AM
   */
  private async runCleanupTasks(): Promise<CronJobResult> {
    const errors: string[] = [];
    const details: Record<string, number> = {};

    try {
      // Clean up old scheduled notifications (sent/cancelled more than 30 days ago)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count: deletedNotifications } = await supabase
        .from('scheduled_notifications')
        .delete()
        .in('status', ['sent', 'cancelled', 'skipped', 'failed'])
        .lt('created_at', thirtyDaysAgo);

      details.deleted_notifications = deletedNotifications || 0;

    } catch (error: any) {
      errors.push(`Notification cleanup: ${error.message}`);
    }

    try {
      // Clean up old engine runs (more than 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { count: deletedRuns } = await supabase
        .from('cycle_engine_runs')
        .delete()
        .lt('started_at', ninetyDaysAgo);

      details.deleted_engine_runs = deletedRuns || 0;

    } catch (error: any) {
      errors.push(`Engine runs cleanup: ${error.message}`);
    }

    try {
      // Clean up old read notifications (more than 60 days)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { count: deletedReadNotifs } = await supabase
        .from('notifications')
        .delete()
        .eq('status', 'read')
        .lt('created_at', sixtyDaysAgo);

      details.deleted_read_notifications = deletedReadNotifs || 0;

    } catch (error: any) {
      errors.push(`Read notifications cleanup: ${error.message}`);
    }

    return {
      job_type: 'cleanup',
      success: errors.length === 0,
      duration_ms: 0,
      details,
      errors,
    };
  }

  /**
   * Run system health check
   * Frequency: Every hour
   */
  private async runHealthCheck(): Promise<CronJobResult> {
    const checks: Record<string, any> = {};
    const errors: string[] = [];

    // Check database connectivity
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      checks.database = error ? 'unhealthy' : 'healthy';
    } catch {
      checks.database = 'unhealthy';
      errors.push('Database connectivity check failed');
    }

    // Check for stuck cycles
    try {
      const { count: stuckCycles } = await supabase
        .from('circle_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'payout_pending')
        .lt('status_changed_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString());

      checks.stuck_cycles = stuckCycles || 0;

      if ((stuckCycles || 0) > 0) {
        errors.push(`${stuckCycles} cycles stuck in payout_pending`);
      }
    } catch {
      checks.stuck_cycles = 'check_failed';
    }

    // Check for failed payouts
    try {
      const { count: failedPayouts } = await supabase
        .from('circle_cycles')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'payout_failed');

      checks.failed_payouts = failedPayouts || 0;

      if ((failedPayouts || 0) > 0) {
        errors.push(`${failedPayouts} failed payouts need attention`);
      }
    } catch {
      checks.failed_payouts = 'check_failed';
    }

    // Check open ops alerts
    try {
      const { count: openAlerts } = await supabase
        .from('ops_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');

      checks.open_alerts = openAlerts || 0;
    } catch {
      checks.open_alerts = 'check_failed';
    }

    // Check last engine run
    try {
      const { data: lastRun } = await supabase
        .from('cycle_engine_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (lastRun) {
        const minutesSinceLastRun = (Date.now() - new Date(lastRun.started_at).getTime()) / 60000;
        checks.minutes_since_last_engine_run = Math.round(minutesSinceLastRun);

        if (minutesSinceLastRun > 30) {
          errors.push(`Cycle engine hasn't run in ${Math.round(minutesSinceLastRun)} minutes`);
        }
      }
    } catch {
      checks.last_engine_run = 'check_failed';
    }

    return {
      job_type: 'health_check',
      success: errors.length === 0,
      duration_ms: 0,
      details: checks,
      errors,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private getNotificationTitle(notification: any): string {
    const titles: Record<string, string> = {
      contribution_reminder_early: 'Contribution Reminder',
      contribution_reminder_midway: 'Contribution Reminder',
      contribution_reminder_urgent: 'Urgent: Contribution Due Soon',
      contribution_due_today: 'Contribution Due Today',
      grace_period_warning: 'Grace Period Warning',
      grace_period_final: 'Final Grace Period Warning',
      payout_upcoming: 'Your Payout is Coming',
      payout_received: 'Payout Received',
      cycle_starting: 'New Cycle Starting',
    };

    return titles[notification.notification_type] || 'TandaXn Notification';
  }

  private getNotificationBody(notification: any): string {
    const payload = notification.payload || {};
    const circleName = payload.circle_name || notification.circle?.name || 'your circle';
    const amount = payload.amount || 0;

    const bodies: Record<string, string> = {
      contribution_reminder_early: `Don't forget to contribute ${amount} XAF to ${circleName}. Deadline is coming up.`,
      contribution_reminder_midway: `Reminder: Your contribution of ${amount} XAF to ${circleName} is due soon.`,
      contribution_reminder_urgent: `Urgent: Your ${amount} XAF contribution to ${circleName} is due tomorrow!`,
      contribution_due_today: `Today is the deadline! Please contribute ${amount} XAF to ${circleName}.`,
      grace_period_warning: `Your contribution to ${circleName} is overdue. You're in the grace period.`,
      grace_period_final: `Last chance: Grace period for ${circleName} ends soon. Pay now to avoid default.`,
      payout_upcoming: `Great news! You're next in line for the payout from ${circleName}.`,
      payout_received: `Your payout from ${circleName} has been deposited!`,
      cycle_starting: `A new cycle is starting in ${circleName}. Get ready to contribute!`,
    };

    return bodies[notification.notification_type] || 'You have a new notification from TandaXn.';
  }

  private async logJobExecution(result: CronJobResult): Promise<void> {
    try {
      await supabase
        .from('cron_job_logs')
        .insert({
          job_type: result.job_type,
          success: result.success,
          duration_ms: result.duration_ms,
          details: result.details,
          errors: result.errors,
          executed_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[CronJob] Failed to log job execution:', error);
    }
  }
}

// Export singleton
export const cronJobHandler = CronJobHandler.getInstance();

// Export function for Supabase Edge Function
export async function handleCronJob(jobType: CronJobType): Promise<CronJobResult> {
  return cronJobHandler.execute(jobType);
}
