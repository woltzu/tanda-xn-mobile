// ══════════════════════════════════════════════════════════════════════════════
// MONTHLY PAYMENT ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// Handles monthly payment disbursement, autopay, and reminders
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type ObligationStatus =
  | 'upcoming'
  | 'due'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'skipped'
  | 'waived';

export type AutopayType =
  | 'minimum'
  | 'scheduled'
  | 'fixed'
  | 'full_balance';

export type AutopayStatus =
  | 'active'
  | 'paused'
  | 'disabled'
  | 'failed';

export type ReminderChannel =
  | 'push'
  | 'email'
  | 'sms'
  | 'in_app';

export type ReminderStatus =
  | 'scheduled'
  | 'sent'
  | 'failed'
  | 'cancelled';

export type ReminderType =
  | 'upcoming'
  | 'due_soon'
  | 'due_tomorrow'
  | 'due_today'
  | 'overdue'
  | 'final_warning';

export interface PaymentObligation {
  id: string;
  loan_id: string;
  user_id: string;
  obligation_number: number;
  period_start_date: string;
  period_end_date: string;
  due_date: string;
  estimated_payment_cents: number;
  principal_due_cents: number;
  interest_due_cents: number;
  fees_due_cents: number;
  total_due_cents: number;
  principal_paid_cents: number;
  interest_paid_cents: number;
  fees_paid_cents: number;
  total_paid_cents: number;
  status: ObligationStatus;
  days_overdue: number;
  payment_id?: string;
  paid_at?: string;
  paid_via?: string;
  late_fee_id?: string;
  late_fee_applied: boolean;
  late_fee_cents: number;
  xnscore_event_triggered: boolean;
  xnscore_adjustment?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AutopayConfig {
  id: string;
  loan_id: string;
  user_id: string;
  autopay_type: AutopayType;
  fixed_amount_cents?: number;
  payment_method_id?: string;
  payment_method_type?: string;
  days_before_due: number;
  preferred_time: string;
  status: AutopayStatus;
  paused_until?: string;
  pause_reason?: string;
  max_retries: number;
  retry_interval_hours: number;
  current_retry_count: number;
  last_executed_at?: string;
  last_execution_status?: string;
  last_execution_error?: string;
  next_scheduled_at?: string;
  total_payments_made: number;
  total_amount_paid_cents: number;
  consecutive_failures: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentReminder {
  id: string;
  loan_id: string;
  user_id: string;
  obligation_id?: string;
  reminder_type: ReminderType;
  channel: ReminderChannel;
  scheduled_for: string;
  days_before_due: number;
  title: string;
  message: string;
  amount_due_cents?: number;
  due_date?: string;
  status: ReminderStatus;
  sent_at?: string;
  failed_at?: string;
  failure_reason?: string;
  notification_id?: string;
  opened_at?: string;
  clicked_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EstimatedPaymentResult {
  monthly_payment_cents: number;
  total_payments_cents: number;
  total_interest_cents: number;
  monthly_rate: number;
  effective_rate: number;
}

export interface GenerateObligationResult {
  obligation_id: string;
  obligation_number: number;
  due_date: string;
  total_due_cents: number;
  principal_cents: number;
  interest_cents: number;
  already_exists: boolean;
  message: string;
}

export interface AutopayUpdateResult {
  config_id: string;
  enabled: boolean;
  autopay_type: AutopayType;
  next_scheduled_at?: string;
  message: string;
}

export interface ProcessAutopayResult {
  success: boolean;
  payment_id?: string;
  amount_cents: number;
  obligation_id?: string;
  error_message?: string;
}

export interface BatchResult {
  processed: number;
  successful: number;
  failed: number;
  errors?: number;
}

export interface ObligationSummary {
  loan_id: string;
  user_id: string;
  monthly_payment: number;
  payment_day_of_month: number;
  autopay_enabled: boolean;
  total_obligations: number;
  paid_count: number;
  overdue_count: number;
  total_due: number;
  total_paid: number;
  total_late_fees: number;
}

export interface NextObligationInfo {
  obligation_id: string;
  obligation_number: number;
  due_date: string;
  days_until_due: number;
  total_due_cents: number;
  principal_due_cents: number;
  interest_due_cents: number;
  fees_due_cents: number;
  status: ObligationStatus;
  is_overdue: boolean;
  late_fee_cents: number;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MONTHLY PAYMENT ENGINE CLASS                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

export class MonthlyPaymentEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // ESTIMATED PAYMENT CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate estimated monthly payment using PMT formula
   */
  async calculateEstimatedMonthlyPayment(
    principalCents: number,
    annualRate: number,
    termMonths: number
  ): Promise<EstimatedPaymentResult> {
    const { data, error } = await supabase.rpc('calculate_estimated_monthly_payment', {
      p_principal_cents: principalCents,
      p_annual_rate: annualRate,
      p_term_months: termMonths
    });

    if (error) throw new Error(`Failed to calculate monthly payment: ${error.message}`);

    return data[0] as EstimatedPaymentResult;
  }

  /**
   * Calculate monthly payment locally (for quick UI calculations)
   */
  calculateMonthlyPaymentLocal(
    principalCents: number,
    annualRate: number,
    termMonths: number
  ): number {
    if (termMonths <= 0) return 0;
    if (principalCents <= 0) return 0;

    const monthlyRate = annualRate / 12;

    // Handle 0% APR
    if (annualRate === 0) {
      return Math.ceil(principalCents / termMonths);
    }

    // PMT formula
    const payment = principalCents * (
      (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
      (Math.pow(1 + monthlyRate, termMonths) - 1)
    );

    return Math.ceil(payment);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT OBLIGATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate monthly obligation for a loan
   */
  async generateMonthlyObligation(
    loanId: string,
    forDate?: string
  ): Promise<GenerateObligationResult> {
    const { data, error } = await supabase.rpc('generate_monthly_obligation', {
      p_loan_id: loanId,
      p_for_date: forDate || null
    });

    if (error) throw new Error(`Failed to generate obligation: ${error.message}`);

    return data[0] as GenerateObligationResult;
  }

  /**
   * Get all obligations for a loan
   */
  async getObligations(
    loanId: string,
    status?: ObligationStatus[],
    limit: number = 12
  ): Promise<PaymentObligation[]> {
    const { data, error } = await supabase.rpc('get_payment_obligations', {
      p_loan_id: loanId,
      p_status: status || null,
      p_limit: limit
    });

    if (error) throw new Error(`Failed to get obligations: ${error.message}`);

    return data as PaymentObligation[];
  }

  /**
   * Get the next upcoming obligation
   */
  async getNextObligation(loanId: string): Promise<NextObligationInfo | null> {
    const { data, error } = await supabase.rpc('get_next_payment_obligation', {
      p_loan_id: loanId
    });

    if (error) throw new Error(`Failed to get next obligation: ${error.message}`);

    return data?.[0] as NextObligationInfo || null;
  }

  /**
   * Get obligation by ID
   */
  async getObligation(obligationId: string): Promise<PaymentObligation | null> {
    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('*')
      .eq('id', obligationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get obligation: ${error.message}`);
    }

    return data as PaymentObligation;
  }

  /**
   * Get obligation summary for a loan
   */
  async getObligationSummary(loanId: string): Promise<ObligationSummary | null> {
    const { data, error } = await supabase
      .from('v_obligation_summary')
      .select('*')
      .eq('loan_id', loanId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get obligation summary: ${error.message}`);
    }

    return data as ObligationSummary;
  }

  /**
   * Get overdue obligations for a user
   */
  async getOverdueObligations(userId: string): Promise<PaymentObligation[]> {
    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'overdue')
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to get overdue obligations: ${error.message}`);

    return data as PaymentObligation[];
  }

  /**
   * Get upcoming obligations for a user
   */
  async getUpcomingObligations(
    userId: string,
    daysAhead: number = 30
  ): Promise<PaymentObligation[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['upcoming', 'due'])
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to get upcoming obligations: ${error.message}`);

    return data as PaymentObligation[];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTOPAY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update autopay configuration for a loan
   */
  async updateAutopayConfig(
    loanId: string,
    enabled: boolean,
    options?: {
      paymentMethodId?: string;
      autopayType?: AutopayType;
      fixedAmountCents?: number;
    }
  ): Promise<AutopayUpdateResult> {
    const { data, error } = await supabase.rpc('update_autopay_config', {
      p_loan_id: loanId,
      p_enabled: enabled,
      p_payment_method_id: options?.paymentMethodId || null,
      p_autopay_type: options?.autopayType || 'scheduled',
      p_fixed_amount_cents: options?.fixedAmountCents || null
    });

    if (error) throw new Error(`Failed to update autopay: ${error.message}`);

    return data[0] as AutopayUpdateResult;
  }

  /**
   * Get autopay config for a loan
   */
  async getAutopayConfig(loanId: string): Promise<AutopayConfig | null> {
    const { data, error } = await supabase
      .from('loan_autopay_configs')
      .select('*')
      .eq('loan_id', loanId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get autopay config: ${error.message}`);
    }

    return data as AutopayConfig;
  }

  /**
   * Get all autopay configs for a user
   */
  async getUserAutopayConfigs(userId: string): Promise<AutopayConfig[]> {
    const { data, error } = await supabase
      .from('loan_autopay_configs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get user autopay configs: ${error.message}`);

    return data as AutopayConfig[];
  }

  /**
   * Pause autopay temporarily
   */
  async pauseAutopay(
    loanId: string,
    pauseUntil: string,
    reason?: string
  ): Promise<AutopayConfig> {
    const { data, error } = await supabase
      .from('loan_autopay_configs')
      .update({
        status: 'paused',
        paused_until: pauseUntil,
        pause_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('loan_id', loanId)
      .select()
      .single();

    if (error) throw new Error(`Failed to pause autopay: ${error.message}`);

    return data as AutopayConfig;
  }

  /**
   * Resume paused autopay
   */
  async resumeAutopay(loanId: string): Promise<AutopayConfig> {
    const { data, error } = await supabase
      .from('loan_autopay_configs')
      .update({
        status: 'active',
        paused_until: null,
        pause_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('loan_id', loanId)
      .select()
      .single();

    if (error) throw new Error(`Failed to resume autopay: ${error.message}`);

    return data as AutopayConfig;
  }

  /**
   * Process a single autopay payment
   */
  async processAutopayPayment(configId: string): Promise<ProcessAutopayResult> {
    const { data, error } = await supabase.rpc('process_autopay_payment', {
      p_config_id: configId
    });

    if (error) throw new Error(`Failed to process autopay: ${error.message}`);

    return data[0] as ProcessAutopayResult;
  }

  /**
   * Retry a failed autopay
   */
  async retryFailedAutopay(configId: string): Promise<ProcessAutopayResult> {
    const { data, error } = await supabase.rpc('retry_failed_autopay', {
      p_config_id: configId
    });

    if (error) throw new Error(`Failed to retry autopay: ${error.message}`);

    return data[0] as ProcessAutopayResult;
  }

  /**
   * Get autopay queue (admin view)
   */
  async getAutopayQueue(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_autopay_queue')
      .select('*')
      .order('next_scheduled_at', { ascending: true });

    if (error) throw new Error(`Failed to get autopay queue: ${error.message}`);

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Schedule reminders for an obligation
   */
  async scheduleReminders(obligationId: string): Promise<number> {
    const { data, error } = await supabase.rpc('schedule_payment_reminders', {
      p_obligation_id: obligationId
    });

    if (error) throw new Error(`Failed to schedule reminders: ${error.message}`);

    return data as number;
  }

  /**
   * Get reminders for a user
   */
  async getUserReminders(
    userId: string,
    status?: ReminderStatus
  ): Promise<PaymentReminder[]> {
    let query = supabase
      .from('loan_payment_reminders')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to get reminders: ${error.message}`);

    return data as PaymentReminder[];
  }

  /**
   * Get reminders for an obligation
   */
  async getObligationReminders(obligationId: string): Promise<PaymentReminder[]> {
    const { data, error } = await supabase
      .from('loan_payment_reminders')
      .select('*')
      .eq('obligation_id', obligationId)
      .order('scheduled_for', { ascending: true });

    if (error) throw new Error(`Failed to get obligation reminders: ${error.message}`);

    return data as PaymentReminder[];
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(
    reminderId: string,
    notificationId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('mark_reminder_sent', {
      p_reminder_id: reminderId,
      p_notification_id: notificationId || null
    });

    if (error) throw new Error(`Failed to mark reminder sent: ${error.message}`);

    return data as boolean;
  }

  /**
   * Cancel a scheduled reminder
   */
  async cancelReminder(reminderId: string): Promise<PaymentReminder> {
    const { data, error } = await supabase
      .from('loan_payment_reminders')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel reminder: ${error.message}`);

    return data as PaymentReminder;
  }

  /**
   * Update reminder preferences for a loan
   */
  async updateReminderPreferences(
    loanId: string,
    options: {
      daysBefore?: number[];
      channels?: ReminderChannel[];
      enabled?: boolean;
    }
  ): Promise<void> {
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (options.daysBefore !== undefined) {
      updates.reminder_days_before = options.daysBefore;
    }
    if (options.channels !== undefined) {
      updates.reminder_channels = options.channels;
    }
    if (options.enabled !== undefined) {
      updates.reminders_enabled = options.enabled;
    }

    const { error } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId);

    if (error) throw new Error(`Failed to update reminder preferences: ${error.message}`);
  }

  /**
   * Get due reminders (for sending via edge function)
   */
  async getDueReminders(): Promise<PaymentReminder[]> {
    const { data, error } = await supabase
      .from('v_payment_reminders_due')
      .select('*');

    if (error) throw new Error(`Failed to get due reminders: ${error.message}`);

    return data as PaymentReminder[];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH OPERATIONS (For Cron Jobs)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Generate all monthly obligations (called on 1st of month)
   */
  async generateAllMonthlyObligations(): Promise<BatchResult> {
    const { data, error } = await supabase.rpc('generate_all_monthly_obligations');

    if (error) throw new Error(`Failed to generate obligations: ${error.message}`);

    const result = data[0];
    return {
      processed: result.loans_processed,
      successful: result.obligations_created,
      failed: result.errors_count,
      errors: result.already_existed
    };
  }

  /**
   * Process all due autopay payments (called daily)
   */
  async processAllAutopay(): Promise<BatchResult> {
    const { data, error } = await supabase.rpc('process_all_autopay');

    if (error) throw new Error(`Failed to process autopay batch: ${error.message}`);

    const result = data[0];
    return {
      processed: result.configs_processed,
      successful: result.payments_successful,
      failed: result.payments_failed
    };
  }

  /**
   * Send due reminders (called daily)
   */
  async sendDueReminders(): Promise<BatchResult> {
    const { data, error } = await supabase.rpc('send_due_reminders');

    if (error) throw new Error(`Failed to send reminders: ${error.message}`);

    const result = data[0];
    return {
      processed: result.reminders_processed,
      successful: result.reminders_marked,
      failed: result.errors_count
    };
  }

  /**
   * Update overdue obligations (called daily)
   */
  async updateOverdueObligations(): Promise<BatchResult> {
    const { data, error } = await supabase.rpc('update_overdue_obligations');

    if (error) throw new Error(`Failed to update overdue: ${error.message}`);

    const result = data[0];
    return {
      processed: result.obligations_updated,
      successful: result.xnscore_events,
      failed: result.late_fees_applied
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD DATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get monthly payment dashboard data
   */
  async getMonthlyPaymentDashboard(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_monthly_payment_dashboard')
      .select('*')
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to get dashboard: ${error.message}`);

    return data;
  }

  /**
   * Get user's payment calendar (all obligations for next N months)
   */
  async getPaymentCalendar(
    userId: string,
    monthsAhead: number = 6
  ): Promise<PaymentObligation[]> {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + monthsAhead);

    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('*, loans!inner(*)')
      .eq('user_id', userId)
      .lte('due_date', futureDate.toISOString().split('T')[0])
      .order('due_date', { ascending: true });

    if (error) throw new Error(`Failed to get payment calendar: ${error.message}`);

    return data as PaymentObligation[];
  }

  /**
   * Get payment history for a loan
   */
  async getPaymentHistory(
    loanId: string,
    limit: number = 24
  ): Promise<PaymentObligation[]> {
    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('*')
      .eq('loan_id', loanId)
      .in('status', ['paid', 'partial', 'waived'])
      .order('due_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to get payment history: ${error.message}`);

    return data as PaymentObligation[];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate days until next payment
   */
  async getDaysUntilNextPayment(loanId: string): Promise<number | null> {
    const next = await this.getNextObligation(loanId);
    if (!next) return null;

    const dueDate = new Date(next.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if user has any overdue payments
   */
  async hasOverduePayments(userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('loan_payment_obligations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'overdue');

    if (error) throw new Error(`Failed to check overdue: ${error.message}`);

    return (count || 0) > 0;
  }

  /**
   * Get total outstanding across all loans
   */
  async getTotalOutstanding(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('loan_payment_obligations')
      .select('total_due_cents, total_paid_cents')
      .eq('user_id', userId)
      .in('status', ['upcoming', 'due', 'overdue', 'partial']);

    if (error) throw new Error(`Failed to get total outstanding: ${error.message}`);

    return data.reduce((sum, o) => sum + (o.total_due_cents - o.total_paid_cents), 0);
  }

  /**
   * Format currency for display
   */
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  }

  /**
   * Get reminder urgency level
   */
  getReminderUrgency(daysUntilDue: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (daysUntilDue < 0) return 'urgent';
    if (daysUntilDue <= 1) return 'high';
    if (daysUntilDue <= 3) return 'medium';
    return 'low';
  }

  /**
   * Get obligation status display info
   */
  getStatusInfo(status: ObligationStatus): {
    label: string;
    color: string;
    icon: string;
  } {
    const statusMap: Record<ObligationStatus, { label: string; color: string; icon: string }> = {
      upcoming: { label: 'Upcoming', color: 'blue', icon: 'calendar' },
      due: { label: 'Due', color: 'yellow', icon: 'clock' },
      partial: { label: 'Partial', color: 'orange', icon: 'progress' },
      paid: { label: 'Paid', color: 'green', icon: 'check' },
      overdue: { label: 'Overdue', color: 'red', icon: 'alert' },
      skipped: { label: 'Skipped', color: 'gray', icon: 'skip' },
      waived: { label: 'Waived', color: 'purple', icon: 'gift' }
    };

    return statusMap[status];
  }
}

// Export singleton instance
export const monthlyPaymentEngine = new MonthlyPaymentEngine();
