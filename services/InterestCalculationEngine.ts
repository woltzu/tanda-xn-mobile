// ══════════════════════════════════════════════════════════════════════════════
// INTEREST CALCULATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// Daily accrual, multiple rate types, and precise payoff calculations.
//
// THE CORE FORMULA (Simple Interest, Actual/365):
// Daily Interest = Outstanding Principal × (Annual Rate ÷ 365)
// Accrued Interest = Daily Interest × Days Since Last Calculation
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type InterestRateType = 'fixed' | 'risk_based' | 'promotional' | 'tiered' | 'variable';
export type LateFeeType = 'flat' | 'percentage' | 'greater_of';
export type LateFeeStatus = 'pending' | 'paid' | 'waived' | 'written_off';
export type RateChangeReason =
  | 'promotional_period_ended'
  | 'index_adjustment'
  | 'manual_adjustment'
  | 'credit_improvement'
  | 'credit_deterioration'
  | 'rate_reset';
export type AccrualTrigger = 'payment' | 'payoff_quote' | 'daily_cron' | 'manual' | 'loan_closure';

export interface InterestAccrual {
  id: string;
  loan_id: string;
  accrual_date: string;
  period_start_date: string;
  period_end_date: string;
  days_in_period: number;
  principal_balance_cents: number;
  previous_accrued_interest_cents: number;
  rate_type: InterestRateType;
  annual_rate: number;
  daily_rate: number;
  interest_accrued_cents: number;
  cumulative_interest_cents: number;
  tier_breakdown?: TierBreakdown[];
  promotional_days?: number;
  standard_days?: number;
  triggered_by: AccrualTrigger;
  triggered_by_id?: string;
  created_at: string;
}

export interface TierBreakdown {
  tier: number;
  min_balance_cents: number;
  max_balance_cents: number;
  balance_in_tier_cents: number;
  rate: number;
  interest_cents: number;
}

export interface RateChange {
  id: string;
  loan_id: string;
  effective_date: string;
  previous_rate: number;
  previous_rate_type: InterestRateType;
  new_rate: number;
  new_rate_type: InterestRateType;
  change_reason: RateChangeReason;
  change_notes?: string;
  index_value_at_change?: number;
  borrower_notified: boolean;
  notification_sent_at?: string;
  notification_method?: string;
  changed_by?: string;
  created_at: string;
}

export interface LateFee {
  id: string;
  loan_id: string;
  scheduled_payment_id?: string;
  fee_type: LateFeeType;
  flat_fee_cents?: number;
  percentage?: number;
  calculated_fee_cents: number;
  payment_due_date: string;
  grace_period_days: number;
  days_past_due: number;
  fee_applied_date: string;
  status: LateFeeStatus;
  paid_amount_cents: number;
  paid_at?: string;
  payment_id?: string;
  waived_at?: string;
  waived_by?: string;
  waive_reason?: string;
  written_off_at?: string;
  write_off_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface MarketIndexRate {
  id: string;
  index_name: string;
  effective_date: string;
  rate: number;
  source?: string;
  source_url?: string;
  created_at: string;
}

export interface PayoffQuote {
  id: string;
  loan_id: string;
  user_id: string;
  quote_date: string;
  valid_until: string;
  outstanding_principal_cents: number;
  accrued_interest_cents: number;
  outstanding_fees_cents: number;
  total_payoff_cents: number;
  per_diem_cents: number;
  current_rate: number;
  rate_type: InterestRateType;
  is_used: boolean;
  used_at?: string;
  payment_id?: string;
  created_at: string;
}

export interface InterestCalculationResult {
  loan_id: string;
  principal_balance_cents: number;
  accrued_interest_cents: number;
  days_in_period: number;
  period_start_date: string;
  period_end_date: string;
  daily_interest_cents: number;
  effective_rate: number;
  annual_rate_percent: number;
  rate_type: InterestRateType;
  tier_breakdown?: TierBreakdown[];
  note?: string;
}

export interface PayoffCalculation {
  loan_id: string;
  payoff_date: string;
  outstanding_principal_cents: number;
  accrued_interest_cents: number;
  previous_accrued_interest_cents: number;
  outstanding_fees_cents: number;
  total_payoff_cents: number;
  per_diem_cents: number;
  current_rate: number;
  current_rate_percent: number;
  rate_type: InterestRateType;
  valid_until: string;
  note: string;
}

export interface LateFeeCalculation {
  fee_cents: number;
  fee_type: LateFeeType;
  flat_fee_cents: number;
  percentage_fee_cents: number;
  grace_period_days: number;
  within_grace_period: boolean;
}

export interface PaymentApplication {
  payment_id: string;
  total_paid_cents: number;
  fees_paid_cents: number;
  interest_paid_cents: number;
  principal_paid_cents: number;
  remaining_principal_cents: number;
  remaining_interest_cents: number;
  remaining_fees_cents: number;
  total_remaining_cents: number;
  loan_status: string;
  is_paid_off: boolean;
  overpayment_cents: number;
}

export interface DailyAccrualResult {
  loans_processed: number;
  total_interest_accrued_cents: number;
  errors_count: number;
}

export interface OverdueCheckResult {
  payments_checked: number;
  late_fees_applied: number;
  xnscore_events: number;
  errors_count: number;
}

export interface PromotionalExpiration {
  changed: boolean;
  previous_rate?: number;
  new_rate?: number;
  effective_date?: string;
  reason: string;
}

export interface InterestConfig {
  days_per_year: number;
  round_to_cents: boolean;
  minimum_daily_interest_cents: number;
  late_fee_grace_period_days: number;
  late_fee_flat_cents: number;
  late_fee_percentage: number;
  late_fee_calculation_method: string;
  max_apr: number;
  min_apr: number;
  payoff_quote_validity_days: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INTEREST_CONFIG: InterestConfig = {
  days_per_year: 365,
  round_to_cents: true,
  minimum_daily_interest_cents: 1,
  late_fee_grace_period_days: 5,
  late_fee_flat_cents: 500, // $5
  late_fee_percentage: 5.0, // 5%
  late_fee_calculation_method: 'greater_of',
  max_apr: 36.0,
  min_apr: 0.0,
  payoff_quote_validity_days: 10,
};

// ─────────────────────────────────────────────────────────────────────────────
// INTEREST CALCULATION ENGINE CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class InterestCalculationEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  async getConfig(): Promise<InterestConfig> {
    const { data, error } = await supabase
      .from('interest_calculation_config')
      .select('config_key, config_value');

    if (error || !data) {
      return DEFAULT_INTEREST_CONFIG;
    }

    const config = { ...DEFAULT_INTEREST_CONFIG };
    data.forEach((row) => {
      const key = row.config_key as keyof InterestConfig;
      let value = row.config_value;

      // Parse JSON values
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // Keep as string
        }
      }

      if (key in config) {
        (config as any)[key] = value;
      }
    });

    return config;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE INTEREST CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate simple interest (no compounding)
   * Formula: Interest = Principal × (Annual Rate / 365) × Days
   */
  calculateSimpleInterest(
    principalCents: number,
    annualRate: number,
    days: number,
    config: InterestConfig = DEFAULT_INTEREST_CONFIG
  ): { interestCents: number; dailyRate: number; dailyInterestCents: number } {
    const dailyRate = annualRate / config.days_per_year;
    let interestCents = principalCents * dailyRate * days;

    if (config.round_to_cents) {
      interestCents = Math.round(interestCents);
    }

    // Apply minimum
    if (days > 0 && interestCents < config.minimum_daily_interest_cents * days) {
      interestCents = config.minimum_daily_interest_cents * days;
    }

    return {
      interestCents,
      dailyRate,
      dailyInterestCents: interestCents / Math.max(days, 1),
    };
  }

  /**
   * Calculate accrued interest for a loan via database function
   */
  async calculateAccruedInterest(
    loanId: string,
    asOfDate?: Date
  ): Promise<InterestCalculationResult | null> {
    const { data, error } = await supabase.rpc('calculate_accrued_interest', {
      p_loan_id: loanId,
      p_as_of_date: asOfDate?.toISOString() ?? new Date().toISOString(),
    });

    if (error) {
      console.error('Error calculating accrued interest:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  /**
   * Get effective rate for a loan on a specific date
   */
  async getEffectiveRate(loanId: string, asOfDate?: Date): Promise<number | null> {
    const { data, error } = await supabase.rpc('get_effective_rate', {
      p_loan_id: loanId,
      p_as_of_date: asOfDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error getting effective rate:', error);
      return null;
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYOFF CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate the total amount needed to pay off a loan
   */
  async calculatePayoffAmount(loanId: string, payoffDate?: Date): Promise<PayoffCalculation | null> {
    const { data, error } = await supabase.rpc('calculate_payoff_amount', {
      p_loan_id: loanId,
      p_payoff_date: payoffDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error calculating payoff amount:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  /**
   * Generate and store a payoff quote
   */
  async generatePayoffQuote(loanId: string, payoffDate?: Date): Promise<string | null> {
    const { data, error } = await supabase.rpc('generate_payoff_quote', {
      p_loan_id: loanId,
      p_payoff_date: payoffDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error generating payoff quote:', error);
      return null;
    }

    return data;
  }

  /**
   * Get a specific payoff quote
   */
  async getPayoffQuote(quoteId: string): Promise<PayoffQuote | null> {
    const { data, error } = await supabase
      .from('loan_payoff_quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (error) {
      console.error('Error fetching payoff quote:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all payoff quotes for a loan
   */
  async getLoanPayoffQuotes(loanId: string): Promise<PayoffQuote[]> {
    const { data, error } = await supabase
      .from('loan_payoff_quotes')
      .select('*')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching loan payoff quotes:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get valid (unused and not expired) payoff quotes for a loan
   */
  async getValidPayoffQuote(loanId: string): Promise<PayoffQuote | null> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('loan_payoff_quotes')
      .select('*')
      .eq('loan_id', loanId)
      .eq('is_used', false)
      .gte('valid_until', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LATE FEE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate late fee for an overdue payment
   */
  async calculateLateFee(
    scheduledPaymentCents: number,
    daysPastDue: number,
    loanProductId?: string
  ): Promise<LateFeeCalculation | null> {
    const { data, error } = await supabase.rpc('calculate_loan_late_fee', {
      p_scheduled_payment_cents: scheduledPaymentCents,
      p_days_past_due: daysPastDue,
      p_loan_product_id: loanProductId ?? null,
    });

    if (error) {
      console.error('Error calculating late fee:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  /**
   * Apply late fee to a loan
   */
  async applyLateFee(
    loanId: string,
    scheduledPaymentId: string,
    daysPastDue: number
  ): Promise<{ applied: boolean; feeId?: string; feeCents?: number; reason: string }> {
    const { data, error } = await supabase.rpc('apply_late_fee_to_loan', {
      p_loan_id: loanId,
      p_scheduled_payment_id: scheduledPaymentId,
      p_days_past_due: daysPastDue,
    });

    if (error) {
      console.error('Error applying late fee:', error);
      return { applied: false, reason: error.message };
    }

    const result = data?.[0];
    return {
      applied: result?.applied ?? false,
      feeId: result?.fee_id,
      feeCents: result?.fee_cents,
      reason: result?.reason ?? 'Unknown',
    };
  }

  /**
   * Get late fees for a loan
   */
  async getLoanLateFees(loanId: string, status?: LateFeeStatus): Promise<LateFee[]> {
    let query = supabase
      .from('loan_late_fees')
      .select('*')
      .eq('loan_id', loanId)
      .order('fee_applied_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching late fees:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Waive a late fee
   */
  async waiveLateFee(
    feeId: string,
    waivedBy: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('loan_late_fees')
      .update({
        status: 'waived',
        waived_at: new Date().toISOString(),
        waived_by: waivedBy,
        waive_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', feeId)
      .eq('status', 'pending');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENT APPLICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply a payment to a loan with proper interest/fee allocation
   */
  async applyPayment(
    loanId: string,
    paymentAmountCents: number,
    paymentMethod: string,
    paymentSourceId?: string,
    walletTransactionId?: string
  ): Promise<PaymentApplication | null> {
    const { data, error } = await supabase.rpc('apply_payment_to_loan', {
      p_loan_id: loanId,
      p_payment_amount_cents: paymentAmountCents,
      p_payment_method: paymentMethod,
      p_payment_source_id: paymentSourceId ?? null,
      p_wallet_transaction_id: walletTransactionId ?? null,
    });

    if (error) {
      console.error('Error applying payment:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTEREST ACCRUAL HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get interest accrual history for a loan
   */
  async getInterestAccruals(loanId: string, limit = 50): Promise<InterestAccrual[]> {
    const { data, error } = await supabase
      .from('loan_interest_accruals')
      .select('*')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching interest accruals:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get interest accrual summary view
   */
  async getInterestSummary(loanId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('v_loan_interest_summary')
      .select('*')
      .eq('loan_id', loanId)
      .single();

    if (error) {
      console.error('Error fetching interest summary:', error);
      return null;
    }

    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RATE CHANGES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get rate change history for a loan
   */
  async getRateChanges(loanId: string): Promise<RateChange[]> {
    const { data, error } = await supabase
      .from('loan_rate_changes')
      .select('*')
      .eq('loan_id', loanId)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Error fetching rate changes:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Check and handle promotional rate expiration
   */
  async checkPromotionalExpiration(loanId: string): Promise<PromotionalExpiration | null> {
    const { data, error } = await supabase.rpc('check_promotional_rate_expiration', {
      p_loan_id: loanId,
    });

    if (error) {
      console.error('Error checking promotional expiration:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET INDEX RATES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current index rate
   */
  async getCurrentIndexRate(indexName: string, asOfDate?: Date): Promise<number | null> {
    const { data, error } = await supabase.rpc('get_current_index_rate', {
      p_index_name: indexName,
      p_as_of_date: asOfDate?.toISOString().split('T')[0] ?? new Date().toISOString().split('T')[0],
    });

    if (error) {
      console.error('Error getting index rate:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all current index rates
   */
  async getAllIndexRates(): Promise<MarketIndexRate[]> {
    const { data, error } = await supabase
      .from('market_index_rates')
      .select('*')
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Error fetching index rates:', error);
      return [];
    }

    // Get most recent for each index
    const latestByIndex = new Map<string, MarketIndexRate>();
    data?.forEach((rate) => {
      if (!latestByIndex.has(rate.index_name)) {
        latestByIndex.set(rate.index_name, rate);
      }
    });

    return Array.from(latestByIndex.values());
  }

  /**
   * Get index rate history
   */
  async getIndexRateHistory(indexName: string, limit = 30): Promise<MarketIndexRate[]> {
    const { data, error } = await supabase
      .from('market_index_rates')
      .select('*')
      .eq('index_name', indexName)
      .order('effective_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching index rate history:', error);
      return [];
    }

    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BATCH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run daily interest accrual batch
   */
  async runDailyInterestAccrual(): Promise<DailyAccrualResult | null> {
    const { data, error } = await supabase.rpc('run_daily_interest_accrual');

    if (error) {
      console.error('Error running daily accrual:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  /**
   * Run overdue check and late fee application batch
   */
  async runOverdueCheck(): Promise<OverdueCheckResult | null> {
    const { data, error } = await supabase.rpc('run_overdue_check');

    if (error) {
      console.error('Error running overdue check:', error);
      return null;
    }

    return data?.[0] ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OVERDUE PAYMENTS DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get overdue payments dashboard
   */
  async getOverduePayments(): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_overdue_payments_dashboard')
      .select('*')
      .order('days_overdue', { ascending: false });

    if (error) {
      console.error('Error fetching overdue payments:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get overdue payments for a specific loan
   */
  async getLoanOverduePayments(loanId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_overdue_payments_dashboard')
      .select('*')
      .eq('loan_id', loanId)
      .order('days_overdue', { ascending: false });

    if (error) {
      console.error('Error fetching loan overdue payments:', error);
      return [];
    }

    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get interest accrual audit trail
   */
  async getInterestAuditTrail(loanId?: string, limit = 100): Promise<any[]> {
    let query = supabase
      .from('v_interest_accrual_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (loanId) {
      query = query.eq('loan_id', loanId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit trail:', error);
      return [];
    }

    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Format cents to currency string
   */
  formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  /**
   * Format rate to percentage string
   */
  formatRate(rate: number, decimals = 2): string {
    return `${(rate * 100).toFixed(decimals)}%`;
  }

  /**
   * Calculate days between two dates
   */
  daysBetween(startDate: Date, endDate: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((endDate.getTime() - startDate.getTime()) / oneDay));
  }

  /**
   * Calculate monthly payment (amortization formula)
   */
  calculateMonthlyPayment(principalCents: number, annualRate: number, termMonths: number): number {
    const monthlyRate = annualRate / 12;

    if (monthlyRate === 0) {
      return Math.round(principalCents / termMonths);
    }

    const payment =
      (principalCents * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
      (Math.pow(1 + monthlyRate, termMonths) - 1);

    return Math.round(payment);
  }

  /**
   * Generate amortization schedule
   */
  generateAmortizationSchedule(
    principalCents: number,
    annualRate: number,
    termMonths: number,
    startDate: Date
  ): Array<{
    paymentNumber: number;
    dueDate: Date;
    paymentCents: number;
    principalCents: number;
    interestCents: number;
    balanceAfterCents: number;
  }> {
    const monthlyRate = annualRate / 12;
    const monthlyPaymentCents = this.calculateMonthlyPayment(principalCents, annualRate, termMonths);

    let balance = principalCents;
    const schedule = [];

    for (let month = 1; month <= termMonths; month++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + month);

      const interestCents = Math.round(balance * monthlyRate);
      let principalPaid = monthlyPaymentCents - interestCents;

      // Last payment adjustment
      if (month === termMonths) {
        principalPaid = balance;
      }

      balance -= principalPaid;

      schedule.push({
        paymentNumber: month,
        dueDate,
        paymentCents: month === termMonths ? principalPaid + interestCents : monthlyPaymentCents,
        principalCents: principalPaid,
        interestCents,
        balanceAfterCents: Math.max(0, balance),
      });
    }

    return schedule;
  }

  /**
   * Get rate type display name
   */
  getRateTypeDisplayName(rateType: InterestRateType): string {
    const names: Record<InterestRateType, string> = {
      fixed: 'Fixed Rate',
      risk_based: 'Risk-Based Rate',
      promotional: 'Promotional Rate',
      tiered: 'Tiered Rate',
      variable: 'Variable Rate',
    };
    return names[rateType] || rateType;
  }

  /**
   * Get late fee status display
   */
  getLateFeeStatusDisplay(status: LateFeeStatus): { label: string; color: string } {
    const displays: Record<LateFeeStatus, { label: string; color: string }> = {
      pending: { label: 'Pending', color: 'yellow' },
      paid: { label: 'Paid', color: 'green' },
      waived: { label: 'Waived', color: 'blue' },
      written_off: { label: 'Written Off', color: 'gray' },
    };
    return displays[status] || { label: status, color: 'gray' };
  }
}

// Export singleton instance
export const interestCalculationEngine = new InterestCalculationEngine();
