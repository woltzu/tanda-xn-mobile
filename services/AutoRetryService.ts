// services/AutoRetryService.ts
// Auto Retry Service - Automatically retries failed payments with exponential backoff
// Handles retry scheduling, execution, and failure escalation

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface AutoRetryConfig {
  id: string;
  user_id: string;
  payment_method_id: string;
  enabled: boolean;
  max_retries: number;
  retry_intervals: number[]; // Hours between retries
  created_at: string;
  updated_at: string;
}

export interface AutoRetryHistory {
  id: string;
  late_contribution_id: string;
  attempt_number: number;
  payment_method_id: string;
  amount: number;
  retry_status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled';
  scheduled_for: string;
  attempted_at: string | null;
  error_message: string | null;
  payment_reference: string | null;
  created_at: string;
}

export interface RetrySchedule {
  attemptNumber: number;
  scheduledFor: Date;
  intervalHours: number;
}

export interface RetryResult {
  success: boolean;
  attemptId: string;
  paymentReference?: string;
  error?: string;
  nextRetryScheduled?: Date;
  maxRetriesReached?: boolean;
}

export interface PendingRetry {
  id: string;
  late_contribution_id: string;
  attempt_number: number;
  payment_method_id: string;
  amount: number;
  user_id: string;
  scheduled_for: string;
}

// Default retry intervals (in hours): 4h, 12h, 24h, 48h, 72h
const DEFAULT_RETRY_INTERVALS = [4, 12, 24, 48, 72];
const MAX_DEFAULT_RETRIES = 5;

// ============================================================================
// AUTO RETRY SERVICE
// ============================================================================

export class AutoRetryService {

  // --------------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------------

  /**
   * Get or create auto-retry configuration for a user
   */
  async getOrCreateConfig(userId: string, paymentMethodId: string): Promise<AutoRetryConfig> {
    // Try to get existing config
    const { data: existingConfig } = await supabase
      .from('auto_retry_config')
      .select('*')
      .eq('user_id', userId)
      .eq('payment_method_id', paymentMethodId)
      .single();

    if (existingConfig) {
      return existingConfig;
    }

    // Create default config
    const { data: newConfig, error } = await supabase
      .from('auto_retry_config')
      .insert({
        user_id: userId,
        payment_method_id: paymentMethodId,
        enabled: true,
        max_retries: MAX_DEFAULT_RETRIES,
        retry_intervals: DEFAULT_RETRY_INTERVALS
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create auto-retry config: ${error.message}`);
    }

    return newConfig;
  }

  /**
   * Update auto-retry configuration
   */
  async updateConfig(
    configId: string,
    updates: Partial<Pick<AutoRetryConfig, 'enabled' | 'max_retries' | 'retry_intervals'>>
  ): Promise<AutoRetryConfig> {
    const { data, error } = await supabase
      .from('auto_retry_config')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', configId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update auto-retry config: ${error.message}`);
    }

    return data;
  }

  /**
   * Enable auto-retry for a user's payment method
   */
  async enableAutoRetry(userId: string, paymentMethodId: string): Promise<void> {
    const config = await this.getOrCreateConfig(userId, paymentMethodId);
    if (!config.enabled) {
      await this.updateConfig(config.id, { enabled: true });
    }
  }

  /**
   * Disable auto-retry for a user's payment method
   */
  async disableAutoRetry(userId: string, paymentMethodId: string): Promise<void> {
    const { data: config } = await supabase
      .from('auto_retry_config')
      .select('id')
      .eq('user_id', userId)
      .eq('payment_method_id', paymentMethodId)
      .single();

    if (config) {
      await this.updateConfig(config.id, { enabled: false });
    }
  }

  // --------------------------------------------------------------------------
  // RETRY SCHEDULING
  // --------------------------------------------------------------------------

  /**
   * Schedule the first auto-retry for a late contribution
   */
  async scheduleFirstRetry(
    lateContributionId: string,
    userId: string,
    paymentMethodId: string,
    amount: number
  ): Promise<RetrySchedule | null> {
    // Check if auto-retry is enabled
    const config = await this.getOrCreateConfig(userId, paymentMethodId);
    if (!config.enabled) {
      return null;
    }

    // Calculate first retry time
    const firstInterval = config.retry_intervals[0] || DEFAULT_RETRY_INTERVALS[0];
    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + firstInterval);

    // Create retry record
    const { error } = await supabase
      .from('auto_retry_history')
      .insert({
        late_contribution_id: lateContributionId,
        attempt_number: 1,
        payment_method_id: paymentMethodId,
        amount,
        retry_status: 'pending',
        scheduled_for: scheduledFor.toISOString()
      });

    if (error) {
      throw new Error(`Failed to schedule retry: ${error.message}`);
    }

    // Log event
    await this.logRetryEvent(lateContributionId, 'retry_scheduled', {
      attempt_number: 1,
      scheduled_for: scheduledFor.toISOString(),
      interval_hours: firstInterval
    });

    return {
      attemptNumber: 1,
      scheduledFor,
      intervalHours: firstInterval
    };
  }

  /**
   * Schedule the next retry after a failed attempt
   */
  async scheduleNextRetry(
    lateContributionId: string,
    currentAttempt: number,
    paymentMethodId: string,
    amount: number,
    userId: string
  ): Promise<RetrySchedule | null> {
    // Get config
    const config = await this.getOrCreateConfig(userId, paymentMethodId);

    // Check if we've reached max retries
    if (currentAttempt >= config.max_retries) {
      return null;
    }

    const nextAttempt = currentAttempt + 1;
    const intervals = config.retry_intervals.length > 0 ? config.retry_intervals : DEFAULT_RETRY_INTERVALS;
    const intervalIndex = Math.min(nextAttempt - 1, intervals.length - 1);
    const intervalHours = intervals[intervalIndex];

    const scheduledFor = new Date();
    scheduledFor.setHours(scheduledFor.getHours() + intervalHours);

    // Create next retry record
    const { error } = await supabase
      .from('auto_retry_history')
      .insert({
        late_contribution_id: lateContributionId,
        attempt_number: nextAttempt,
        payment_method_id: paymentMethodId,
        amount,
        retry_status: 'pending',
        scheduled_for: scheduledFor.toISOString()
      });

    if (error) {
      throw new Error(`Failed to schedule next retry: ${error.message}`);
    }

    // Log event
    await this.logRetryEvent(lateContributionId, 'retry_scheduled', {
      attempt_number: nextAttempt,
      scheduled_for: scheduledFor.toISOString(),
      interval_hours: intervalHours
    });

    return {
      attemptNumber: nextAttempt,
      scheduledFor,
      intervalHours
    };
  }

  // --------------------------------------------------------------------------
  // RETRY EXECUTION
  // --------------------------------------------------------------------------

  /**
   * Process all pending retries that are due
   */
  async processPendingRetries(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date().toISOString();

    // Get pending retries that are due
    const { data: pendingRetries, error } = await supabase
      .from('auto_retry_history')
      .select(`
        id,
        late_contribution_id,
        attempt_number,
        payment_method_id,
        amount,
        late_contributions (
          user_id,
          cycle_contribution_id
        )
      `)
      .eq('retry_status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50); // Process in batches

    if (error || !pendingRetries) {
      console.error('Failed to fetch pending retries:', error);
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const retry of pendingRetries) {
      const result = await this.executeRetry({
        id: retry.id,
        late_contribution_id: retry.late_contribution_id,
        attempt_number: retry.attempt_number,
        payment_method_id: retry.payment_method_id,
        amount: retry.amount,
        user_id: (retry.late_contributions as any)?.user_id,
        scheduled_for: ''
      });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      processed: pendingRetries.length,
      succeeded,
      failed
    };
  }

  /**
   * Execute a single retry attempt
   */
  async executeRetry(retry: PendingRetry): Promise<RetryResult> {
    // Mark as processing
    await supabase
      .from('auto_retry_history')
      .update({
        retry_status: 'processing',
        attempted_at: new Date().toISOString()
      })
      .eq('id', retry.id);

    try {
      // Attempt the payment
      const paymentResult = await this.attemptPayment(
        retry.user_id,
        retry.payment_method_id,
        retry.amount,
        retry.late_contribution_id
      );

      if (paymentResult.success) {
        // Payment succeeded
        await supabase
          .from('auto_retry_history')
          .update({
            retry_status: 'success',
            payment_reference: paymentResult.paymentReference
          })
          .eq('id', retry.id);

        // Resolve the late contribution
        await this.resolveContribution(retry.late_contribution_id, paymentResult.paymentReference!);

        // Log success
        await this.logRetryEvent(retry.late_contribution_id, 'retry_success', {
          attempt_number: retry.attempt_number,
          payment_reference: paymentResult.paymentReference
        });

        return {
          success: true,
          attemptId: retry.id,
          paymentReference: paymentResult.paymentReference
        };
      } else {
        // Payment failed
        await supabase
          .from('auto_retry_history')
          .update({
            retry_status: 'failed',
            error_message: paymentResult.error
          })
          .eq('id', retry.id);

        // Log failure
        await this.logRetryEvent(retry.late_contribution_id, 'retry_failed', {
          attempt_number: retry.attempt_number,
          error: paymentResult.error
        });

        // Schedule next retry if possible
        const nextRetry = await this.scheduleNextRetry(
          retry.late_contribution_id,
          retry.attempt_number,
          retry.payment_method_id,
          retry.amount,
          retry.user_id
        );

        if (nextRetry) {
          return {
            success: false,
            attemptId: retry.id,
            error: paymentResult.error,
            nextRetryScheduled: nextRetry.scheduledFor
          };
        } else {
          // Max retries reached
          await this.handleMaxRetriesReached(retry);
          return {
            success: false,
            attemptId: retry.id,
            error: paymentResult.error,
            maxRetriesReached: true
          };
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await supabase
        .from('auto_retry_history')
        .update({
          retry_status: 'failed',
          error_message: errorMessage
        })
        .eq('id', retry.id);

      await this.logRetryEvent(retry.late_contribution_id, 'retry_error', {
        attempt_number: retry.attempt_number,
        error: errorMessage
      });

      return {
        success: false,
        attemptId: retry.id,
        error: errorMessage
      };
    }
  }

  /**
   * Attempt a payment through the payment gateway
   */
  private async attemptPayment(
    userId: string,
    paymentMethodId: string,
    amount: number,
    lateContributionId: string
  ): Promise<{ success: boolean; paymentReference?: string; error?: string }> {
    // Get payment method details
    const { data: paymentMethod } = await supabase
      .from('user_payment_methods')
      .select('*')
      .eq('id', paymentMethodId)
      .eq('user_id', userId)
      .single();

    if (!paymentMethod) {
      return { success: false, error: 'Payment method not found' };
    }

    if (paymentMethod.method_status !== 'active') {
      return { success: false, error: 'Payment method is not active' };
    }

    // Here you would integrate with your actual payment gateway
    // For now, we'll simulate the payment attempt
    try {
      // Simulated payment gateway call
      // In production, this would call your PaymentGatewayAdapter
      const paymentReference = `retry_${lateContributionId}_${Date.now()}`;

      // Simulate success/failure (in production, this comes from the gateway)
      const isSuccess = Math.random() > 0.3; // 70% success rate for demo

      if (isSuccess) {
        return { success: true, paymentReference };
      } else {
        return { success: false, error: 'Insufficient funds' };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment gateway error'
      };
    }
  }

  // --------------------------------------------------------------------------
  // RESOLUTION & ESCALATION
  // --------------------------------------------------------------------------

  /**
   * Resolve the late contribution after successful retry
   */
  private async resolveContribution(lateContributionId: string, paymentReference: string): Promise<void> {
    // Update late contribution
    await supabase
      .from('late_contributions')
      .update({
        late_status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolution_type: 'auto_retry',
        updated_at: new Date().toISOString()
      })
      .eq('id', lateContributionId);

    // Get contribution details to update cycle_contributions
    const { data: lateContribution } = await supabase
      .from('late_contributions')
      .select('cycle_contribution_id, amount')
      .eq('id', lateContributionId)
      .single();

    if (lateContribution) {
      // Update cycle contribution as paid
      await supabase
        .from('cycle_contributions')
        .update({
          contribution_status: 'paid',
          paid_amount: lateContribution.amount,
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference,
          updated_at: new Date().toISOString()
        })
        .eq('id', lateContribution.cycle_contribution_id);
    }
  }

  /**
   * Handle when max retries have been reached
   */
  private async handleMaxRetriesReached(retry: PendingRetry): Promise<void> {
    // Log event
    await this.logRetryEvent(retry.late_contribution_id, 'max_retries_reached', {
      total_attempts: retry.attempt_number
    });

    // Update late contribution to escalate
    const { data: lateContribution } = await supabase
      .from('late_contributions')
      .select('late_status, user_id')
      .eq('id', retry.late_contribution_id)
      .single();

    if (lateContribution && lateContribution.late_status !== 'defaulted') {
      // Progress to next late status if not already defaulted
      if (lateContribution.late_status === 'soft_late') {
        await supabase
          .from('late_contributions')
          .update({ late_status: 'grace_period' })
          .eq('id', retry.late_contribution_id);
      } else if (lateContribution.late_status === 'grace_period') {
        await supabase
          .from('late_contributions')
          .update({ late_status: 'final_warning' })
          .eq('id', retry.late_contribution_id);
      }
    }

    // Send notification about failed retries
    await this.sendMaxRetriesNotification(retry);
  }

  /**
   * Send notification when max retries reached
   */
  private async sendMaxRetriesNotification(retry: PendingRetry): Promise<void> {
    await supabase
      .from('scheduled_notifications')
      .insert({
        user_id: retry.user_id,
        notification_type: 'auto_retry_exhausted',
        scheduled_for: new Date().toISOString(),
        notification_status: 'pending',
        payload: {
          late_contribution_id: retry.late_contribution_id,
          total_attempts: retry.attempt_number,
          amount: retry.amount
        }
      });
  }

  // --------------------------------------------------------------------------
  // CANCELLATION
  // --------------------------------------------------------------------------

  /**
   * Cancel all pending retries for a late contribution
   */
  async cancelPendingRetries(lateContributionId: string): Promise<number> {
    const { data, error } = await supabase
      .from('auto_retry_history')
      .update({ retry_status: 'cancelled' })
      .eq('late_contribution_id', lateContributionId)
      .eq('retry_status', 'pending')
      .select('id');

    if (error) {
      throw new Error(`Failed to cancel retries: ${error.message}`);
    }

    if (data && data.length > 0) {
      await this.logRetryEvent(lateContributionId, 'retries_cancelled', {
        cancelled_count: data.length
      });
    }

    return data?.length || 0;
  }

  // --------------------------------------------------------------------------
  // QUERY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get retry history for a late contribution
   */
  async getRetryHistory(lateContributionId: string): Promise<AutoRetryHistory[]> {
    const { data, error } = await supabase
      .from('auto_retry_history')
      .select('*')
      .eq('late_contribution_id', lateContributionId)
      .order('attempt_number', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch retry history: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get pending retry for a late contribution
   */
  async getPendingRetry(lateContributionId: string): Promise<AutoRetryHistory | null> {
    const { data } = await supabase
      .from('auto_retry_history')
      .select('*')
      .eq('late_contribution_id', lateContributionId)
      .eq('retry_status', 'pending')
      .single();

    return data;
  }

  /**
   * Get retry statistics for a user
   */
  async getUserRetryStats(userId: string): Promise<{
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    successRate: number;
  }> {
    const { data: stats } = await supabase
      .from('auto_retry_history')
      .select(`
        retry_status,
        late_contributions!inner (user_id)
      `)
      .eq('late_contributions.user_id', userId);

    if (!stats) {
      return { totalRetries: 0, successfulRetries: 0, failedRetries: 0, successRate: 0 };
    }

    const totalRetries = stats.length;
    const successfulRetries = stats.filter(s => s.retry_status === 'success').length;
    const failedRetries = stats.filter(s => s.retry_status === 'failed').length;
    const successRate = totalRetries > 0 ? Math.round((successfulRetries / totalRetries) * 100) : 0;

    return { totalRetries, successfulRetries, failedRetries, successRate };
  }

  /**
   * Check if auto-retry is enabled for a user
   */
  async isAutoRetryEnabled(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('auto_retry_config')
      .select('enabled')
      .eq('user_id', userId)
      .eq('enabled', true)
      .limit(1);

    return (data?.length || 0) > 0;
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  /**
   * Log a retry event
   */
  private async logRetryEvent(
    lateContributionId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('late_contribution_events')
      .insert({
        late_contribution_id: lateContributionId,
        event_type: eventType,
        event_data: eventData
      });
  }
}

// Export singleton instance
export const autoRetryService = new AutoRetryService();
