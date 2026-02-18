// ══════════════════════════════════════════════════════════════════════════════
// INTEREST CALCULATION HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React Query hooks for interest calculation, payoff quotes, late fees, and more.
// ══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  interestCalculationEngine,
  InterestCalculationEngine,
  InterestAccrual,
  RateChange,
  LateFee,
  MarketIndexRate,
  PayoffQuote,
  InterestCalculationResult,
  PayoffCalculation,
  LateFeeCalculation,
  PaymentApplication,
  DailyAccrualResult,
  OverdueCheckResult,
  PromotionalExpiration,
  InterestConfig,
  InterestRateType,
  LateFeeStatus,
} from '@/services/InterestCalculationEngine';

// ─────────────────────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────────────────────

export const interestKeys = {
  all: ['interest'] as const,
  config: () => [...interestKeys.all, 'config'] as const,
  accrued: (loanId: string, date?: Date) => [...interestKeys.all, 'accrued', loanId, date?.toISOString()] as const,
  effectiveRate: (loanId: string, date?: Date) => [...interestKeys.all, 'effective-rate', loanId, date?.toISOString()] as const,
  payoff: (loanId: string, date?: Date) => [...interestKeys.all, 'payoff', loanId, date?.toISOString()] as const,
  payoffQuotes: (loanId: string) => [...interestKeys.all, 'payoff-quotes', loanId] as const,
  validQuote: (loanId: string) => [...interestKeys.all, 'valid-quote', loanId] as const,
  lateFees: (loanId: string, status?: LateFeeStatus) => [...interestKeys.all, 'late-fees', loanId, status] as const,
  lateFeeCalc: (amount: number, days: number, productId?: string) => [...interestKeys.all, 'late-fee-calc', amount, days, productId] as const,
  accruals: (loanId: string) => [...interestKeys.all, 'accruals', loanId] as const,
  summary: (loanId: string) => [...interestKeys.all, 'summary', loanId] as const,
  rateChanges: (loanId: string) => [...interestKeys.all, 'rate-changes', loanId] as const,
  indexRates: () => [...interestKeys.all, 'index-rates'] as const,
  indexRate: (name: string, date?: Date) => [...interestKeys.all, 'index-rate', name, date?.toISOString()] as const,
  indexHistory: (name: string) => [...interestKeys.all, 'index-history', name] as const,
  overduePayments: (loanId?: string) => [...interestKeys.all, 'overdue', loanId] as const,
  auditTrail: (loanId?: string) => [...interestKeys.all, 'audit', loanId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get interest calculation configuration
 */
export function useInterestConfig() {
  return useQuery({
    queryKey: interestKeys.config(),
    queryFn: () => interestCalculationEngine.getConfig(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEREST CALCULATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate accrued interest for a loan
 */
export function useAccruedInterest(loanId: string, asOfDate?: Date) {
  return useQuery({
    queryKey: interestKeys.accrued(loanId, asOfDate),
    queryFn: () => interestCalculationEngine.calculateAccruedInterest(loanId, asOfDate),
    enabled: !!loanId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get effective rate for a loan
 */
export function useEffectiveRate(loanId: string, asOfDate?: Date) {
  return useQuery({
    queryKey: interestKeys.effectiveRate(loanId, asOfDate),
    queryFn: () => interestCalculationEngine.getEffectiveRate(loanId, asOfDate),
    enabled: !!loanId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYOFF CALCULATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate payoff amount for a loan
 */
export function usePayoffAmount(loanId: string, payoffDate?: Date) {
  return useQuery({
    queryKey: interestKeys.payoff(loanId, payoffDate),
    queryFn: () => interestCalculationEngine.calculatePayoffAmount(loanId, payoffDate),
    enabled: !!loanId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Generate a payoff quote
 */
export function useGeneratePayoffQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ loanId, payoffDate }: { loanId: string; payoffDate?: Date }) =>
      interestCalculationEngine.generatePayoffQuote(loanId, payoffDate),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: interestKeys.payoffQuotes(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.validQuote(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.accruals(variables.loanId) });
    },
  });
}

/**
 * Get all payoff quotes for a loan
 */
export function usePayoffQuotes(loanId: string) {
  return useQuery({
    queryKey: interestKeys.payoffQuotes(loanId),
    queryFn: () => interestCalculationEngine.getLoanPayoffQuotes(loanId),
    enabled: !!loanId,
  });
}

/**
 * Get valid payoff quote for a loan
 */
export function useValidPayoffQuote(loanId: string) {
  return useQuery({
    queryKey: interestKeys.validQuote(loanId),
    queryFn: () => interestCalculationEngine.getValidPayoffQuote(loanId),
    enabled: !!loanId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// LATE FEE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate late fee
 */
export function useLateFeeCalculation(
  scheduledPaymentCents: number,
  daysPastDue: number,
  loanProductId?: string
) {
  return useQuery({
    queryKey: interestKeys.lateFeeCalc(scheduledPaymentCents, daysPastDue, loanProductId),
    queryFn: () => interestCalculationEngine.calculateLateFee(scheduledPaymentCents, daysPastDue, loanProductId),
    enabled: scheduledPaymentCents > 0 && daysPastDue >= 0,
  });
}

/**
 * Get late fees for a loan
 */
export function useLateFees(loanId: string, status?: LateFeeStatus) {
  return useQuery({
    queryKey: interestKeys.lateFees(loanId, status),
    queryFn: () => interestCalculationEngine.getLoanLateFees(loanId, status),
    enabled: !!loanId,
  });
}

/**
 * Apply late fee to a loan
 */
export function useApplyLateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      scheduledPaymentId,
      daysPastDue,
    }: {
      loanId: string;
      scheduledPaymentId: string;
      daysPastDue: number;
    }) => interestCalculationEngine.applyLateFee(loanId, scheduledPaymentId, daysPastDue),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: interestKeys.lateFees(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: ['loans', variables.loanId] });
    },
  });
}

/**
 * Waive a late fee
 */
export function useWaiveLateFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      feeId,
      waivedBy,
      reason,
      loanId,
    }: {
      feeId: string;
      waivedBy: string;
      reason: string;
      loanId: string;
    }) => interestCalculationEngine.waiveLateFee(feeId, waivedBy, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: interestKeys.lateFees(variables.loanId) });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT APPLICATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply payment to a loan with proper interest/fee allocation
 */
export function useApplyPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      paymentAmountCents,
      paymentMethod,
      paymentSourceId,
      walletTransactionId,
    }: {
      loanId: string;
      paymentAmountCents: number;
      paymentMethod: string;
      paymentSourceId?: string;
      walletTransactionId?: string;
    }) =>
      interestCalculationEngine.applyPayment(
        loanId,
        paymentAmountCents,
        paymentMethod,
        paymentSourceId,
        walletTransactionId
      ),
    onSuccess: (data, variables) => {
      // Invalidate all loan-related queries
      queryClient.invalidateQueries({ queryKey: ['loans', variables.loanId] });
      queryClient.invalidateQueries({ queryKey: interestKeys.accrued(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.payoff(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.lateFees(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.accruals(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: interestKeys.summary(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: ['loan-payments', variables.loanId] });
      queryClient.invalidateQueries({ queryKey: ['payment-schedule', variables.loanId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEREST ACCRUAL HISTORY HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get interest accrual history for a loan
 */
export function useInterestAccruals(loanId: string, limit = 50) {
  return useQuery({
    queryKey: interestKeys.accruals(loanId),
    queryFn: () => interestCalculationEngine.getInterestAccruals(loanId, limit),
    enabled: !!loanId,
  });
}

/**
 * Get interest summary for a loan
 */
export function useInterestSummary(loanId: string) {
  return useQuery({
    queryKey: interestKeys.summary(loanId),
    queryFn: () => interestCalculationEngine.getInterestSummary(loanId),
    enabled: !!loanId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE CHANGE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get rate change history for a loan
 */
export function useRateChanges(loanId: string) {
  return useQuery({
    queryKey: interestKeys.rateChanges(loanId),
    queryFn: () => interestCalculationEngine.getRateChanges(loanId),
    enabled: !!loanId,
  });
}

/**
 * Check promotional rate expiration
 */
export function useCheckPromotionalExpiration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => interestCalculationEngine.checkPromotionalExpiration(loanId),
    onSuccess: (data, loanId) => {
      if (data?.changed) {
        queryClient.invalidateQueries({ queryKey: ['loans', loanId] });
        queryClient.invalidateQueries({ queryKey: interestKeys.rateChanges(loanId) });
        queryClient.invalidateQueries({ queryKey: interestKeys.effectiveRate(loanId) });
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET INDEX RATE HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all current index rates
 */
export function useIndexRates() {
  return useQuery({
    queryKey: interestKeys.indexRates(),
    queryFn: () => interestCalculationEngine.getAllIndexRates(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Get current rate for a specific index
 */
export function useIndexRate(indexName: string, asOfDate?: Date) {
  return useQuery({
    queryKey: interestKeys.indexRate(indexName, asOfDate),
    queryFn: () => interestCalculationEngine.getCurrentIndexRate(indexName, asOfDate),
    enabled: !!indexName,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * Get index rate history
 */
export function useIndexRateHistory(indexName: string, limit = 30) {
  return useQuery({
    queryKey: interestKeys.indexHistory(indexName),
    queryFn: () => interestCalculationEngine.getIndexRateHistory(indexName, limit),
    enabled: !!indexName,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH OPERATION HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run daily interest accrual batch
 */
export function useRunDailyAccrual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => interestCalculationEngine.runDailyInterestAccrual(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}

/**
 * Run overdue check batch
 */
export function useRunOverdueCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => interestCalculationEngine.runOverdueCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: interestKeys.all });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERDUE PAYMENTS HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all overdue payments
 */
export function useOverduePayments() {
  return useQuery({
    queryKey: interestKeys.overduePayments(),
    queryFn: () => interestCalculationEngine.getOverduePayments(),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Get overdue payments for a specific loan
 */
export function useLoanOverduePayments(loanId: string) {
  return useQuery({
    queryKey: interestKeys.overduePayments(loanId),
    queryFn: () => interestCalculationEngine.getLoanOverduePayments(loanId),
    enabled: !!loanId,
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TRAIL HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get interest accrual audit trail
 */
export function useInterestAuditTrail(loanId?: string, limit = 100) {
  return useQuery({
    queryKey: interestKeys.auditTrail(loanId),
    queryFn: () => interestCalculationEngine.getInterestAuditTrail(loanId, limit),
    staleTime: 1000 * 60 * 5,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate simple interest locally (no API call)
 */
export function useSimpleInterestCalculation(
  principalCents: number,
  annualRate: number,
  days: number
) {
  const { data: config } = useInterestConfig();

  const result = interestCalculationEngine.calculateSimpleInterest(
    principalCents,
    annualRate,
    days,
    config
  );

  return {
    interestCents: result.interestCents,
    dailyRate: result.dailyRate,
    dailyInterestCents: result.dailyInterestCents,
    formatted: {
      interest: interestCalculationEngine.formatCurrency(result.interestCents),
      dailyInterest: interestCalculationEngine.formatCurrency(result.dailyInterestCents),
      dailyRate: interestCalculationEngine.formatRate(result.dailyRate),
    },
  };
}

/**
 * Calculate monthly payment locally
 */
export function useMonthlyPaymentCalculation(
  principalCents: number,
  annualRate: number,
  termMonths: number
) {
  const monthlyPaymentCents = interestCalculationEngine.calculateMonthlyPayment(
    principalCents,
    annualRate,
    termMonths
  );

  return {
    monthlyPaymentCents,
    formatted: interestCalculationEngine.formatCurrency(monthlyPaymentCents),
    totalPaymentCents: monthlyPaymentCents * termMonths,
    totalInterestCents: monthlyPaymentCents * termMonths - principalCents,
  };
}

/**
 * Generate amortization schedule locally
 */
export function useAmortizationSchedule(
  principalCents: number,
  annualRate: number,
  termMonths: number,
  startDate: Date
) {
  const schedule = interestCalculationEngine.generateAmortizationSchedule(
    principalCents,
    annualRate,
    termMonths,
    startDate
  );

  const totalInterest = schedule.reduce((sum, p) => sum + p.interestCents, 0);
  const totalPayments = schedule.reduce((sum, p) => sum + p.paymentCents, 0);

  return {
    schedule,
    summary: {
      principalCents,
      totalInterestCents: totalInterest,
      totalPaymentsCents: totalPayments,
      monthlyPaymentCents: schedule[0]?.paymentCents ?? 0,
    },
    formatted: {
      principal: interestCalculationEngine.formatCurrency(principalCents),
      totalInterest: interestCalculationEngine.formatCurrency(totalInterest),
      totalPayments: interestCalculationEngine.formatCurrency(totalPayments),
      monthlyPayment: interestCalculationEngine.formatCurrency(schedule[0]?.paymentCents ?? 0),
    },
  };
}

/**
 * Get rate type display info
 */
export function useRateTypeInfo(rateType: InterestRateType) {
  return {
    displayName: interestCalculationEngine.getRateTypeDisplayName(rateType),
    rateType,
  };
}

/**
 * Get late fee status display info
 */
export function useLateFeeStatusInfo(status: LateFeeStatus) {
  return interestCalculationEngine.getLateFeeStatusDisplay(status);
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combined actions hook for interest calculations
 */
export function useInterestActions() {
  const generatePayoffQuote = useGeneratePayoffQuote();
  const applyLateFee = useApplyLateFee();
  const waiveLateFee = useWaiveLateFee();
  const applyPayment = useApplyPayment();
  const checkPromotionalExpiration = useCheckPromotionalExpiration();
  const runDailyAccrual = useRunDailyAccrual();
  const runOverdueCheck = useRunOverdueCheck();

  return {
    generatePayoffQuote,
    applyLateFee,
    waiveLateFee,
    applyPayment,
    checkPromotionalExpiration,
    runDailyAccrual,
    runOverdueCheck,
    isLoading:
      generatePayoffQuote.isPending ||
      applyLateFee.isPending ||
      waiveLateFee.isPending ||
      applyPayment.isPending ||
      checkPromotionalExpiration.isPending ||
      runDailyAccrual.isPending ||
      runOverdueCheck.isPending,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combined dashboard hook for loan interest management
 */
export function useLoanInterestDashboard(loanId: string) {
  const accruedInterest = useAccruedInterest(loanId);
  const payoffAmount = usePayoffAmount(loanId);
  const lateFees = useLateFees(loanId);
  const interestAccruals = useInterestAccruals(loanId, 10);
  const interestSummary = useInterestSummary(loanId);
  const rateChanges = useRateChanges(loanId);
  const overduePayments = useLoanOverduePayments(loanId);
  const validQuote = useValidPayoffQuote(loanId);

  return {
    // Data
    accruedInterest: accruedInterest.data,
    payoffAmount: payoffAmount.data,
    lateFees: lateFees.data,
    interestAccruals: interestAccruals.data,
    interestSummary: interestSummary.data,
    rateChanges: rateChanges.data,
    overduePayments: overduePayments.data,
    validQuote: validQuote.data,

    // Loading states
    isLoading:
      accruedInterest.isLoading ||
      payoffAmount.isLoading ||
      lateFees.isLoading ||
      interestSummary.isLoading,

    // Computed values
    totalPendingFees:
      lateFees.data?.reduce(
        (sum, fee) => (fee.status === 'pending' ? sum + fee.calculated_fee_cents : sum),
        0
      ) ?? 0,
    hasOverduePayments: (overduePayments.data?.length ?? 0) > 0,
    hasValidQuote: !!validQuote.data,

    // Refetch functions
    refetch: () => {
      accruedInterest.refetch();
      payoffAmount.refetch();
      lateFees.refetch();
      interestAccruals.refetch();
      interestSummary.refetch();
      overduePayments.refetch();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Admin dashboard hook for interest management
 */
export function useInterestAdminDashboard() {
  const config = useInterestConfig();
  const indexRates = useIndexRates();
  const allOverduePayments = useOverduePayments();
  const auditTrail = useInterestAuditTrail(undefined, 50);
  const actions = useInterestActions();

  return {
    // Data
    config: config.data,
    indexRates: indexRates.data,
    overduePayments: allOverduePayments.data,
    auditTrail: auditTrail.data,

    // Loading
    isLoading:
      config.isLoading ||
      indexRates.isLoading ||
      allOverduePayments.isLoading,

    // Stats
    overdueCount: allOverduePayments.data?.length ?? 0,
    totalOverdueAmount:
      allOverduePayments.data?.reduce((sum, p) => sum + (p.remaining_due ?? 0), 0) ?? 0,

    // Actions
    actions,

    // Refetch
    refetch: () => {
      config.refetch();
      indexRates.refetch();
      allOverduePayments.refetch();
      auditTrail.refetch();
    },
  };
}

// Re-export types and engine
export {
  interestCalculationEngine,
  InterestCalculationEngine,
  type InterestAccrual,
  type RateChange,
  type LateFee,
  type MarketIndexRate,
  type PayoffQuote,
  type InterestCalculationResult,
  type PayoffCalculation,
  type LateFeeCalculation,
  type PaymentApplication,
  type DailyAccrualResult,
  type OverdueCheckResult,
  type PromotionalExpiration,
  type InterestConfig,
  type InterestRateType,
  type LateFeeStatus,
};
