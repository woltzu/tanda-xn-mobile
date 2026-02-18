// ══════════════════════════════════════════════════════════════════════════════
// MONTHLY PAYMENT HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for monthly payment management
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MonthlyPaymentEngine,
  monthlyPaymentEngine,
  PaymentObligation,
  AutopayConfig,
  PaymentReminder,
  ObligationStatus,
  AutopayType,
  AutopayStatus,
  ReminderChannel,
  ReminderStatus,
  EstimatedPaymentResult,
  GenerateObligationResult,
  AutopayUpdateResult,
  ProcessAutopayResult,
  BatchResult,
  ObligationSummary,
  NextObligationInfo
} from '@/services/MonthlyPaymentEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ QUERY KEYS                                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

const QUERY_KEYS = {
  obligations: (loanId: string) => ['obligations', loanId],
  nextObligation: (loanId: string) => ['nextObligation', loanId],
  obligation: (id: string) => ['obligation', id],
  obligationSummary: (loanId: string) => ['obligationSummary', loanId],
  userOverdueObligations: (userId: string) => ['overdueObligations', userId],
  userUpcomingObligations: (userId: string) => ['upcomingObligations', userId],
  autopayConfig: (loanId: string) => ['autopayConfig', loanId],
  userAutopayConfigs: (userId: string) => ['userAutopayConfigs', userId],
  autopayQueue: ['autopayQueue'],
  userReminders: (userId: string) => ['reminders', userId],
  obligationReminders: (obligationId: string) => ['obligationReminders', obligationId],
  dueReminders: ['dueReminders'],
  paymentDashboard: ['paymentDashboard'],
  paymentCalendar: (userId: string) => ['paymentCalendar', userId],
  paymentHistory: (loanId: string) => ['paymentHistory', loanId],
  totalOutstanding: (userId: string) => ['totalOutstanding', userId],
  estimatedPayment: (principal: number, rate: number, term: number) =>
    ['estimatedPayment', principal, rate, term]
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ESTIMATED PAYMENT HOOKS                                                     │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Calculate estimated monthly payment
 */
export function useEstimatedMonthlyPayment(
  principalCents: number,
  annualRate: number,
  termMonths: number
) {
  return useQuery({
    queryKey: QUERY_KEYS.estimatedPayment(principalCents, annualRate, termMonths),
    queryFn: () => monthlyPaymentEngine.calculateEstimatedMonthlyPayment(
      principalCents,
      annualRate,
      termMonths
    ),
    enabled: principalCents > 0 && termMonths > 0,
    staleTime: Infinity // Calculation is deterministic
  });
}

/**
 * Calculate monthly payment locally (synchronous, for quick UI)
 */
export function useLocalMonthlyPaymentCalculation(
  principalCents: number,
  annualRate: number,
  termMonths: number
): number {
  return useMemo(() => {
    return monthlyPaymentEngine.calculateMonthlyPaymentLocal(
      principalCents,
      annualRate,
      termMonths
    );
  }, [principalCents, annualRate, termMonths]);
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PAYMENT OBLIGATION HOOKS                                                    │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Get all obligations for a loan
 */
export function useObligations(
  loanId: string,
  status?: ObligationStatus[],
  limit: number = 12
) {
  return useQuery({
    queryKey: [...QUERY_KEYS.obligations(loanId), status, limit],
    queryFn: () => monthlyPaymentEngine.getObligations(loanId, status, limit),
    enabled: !!loanId
  });
}

/**
 * Get next upcoming obligation for a loan
 */
export function useNextObligation(loanId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.nextObligation(loanId),
    queryFn: () => monthlyPaymentEngine.getNextObligation(loanId),
    enabled: !!loanId
  });
}

/**
 * Get single obligation by ID
 */
export function useObligation(obligationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.obligation(obligationId),
    queryFn: () => monthlyPaymentEngine.getObligation(obligationId),
    enabled: !!obligationId
  });
}

/**
 * Get obligation summary for a loan
 */
export function useObligationSummary(loanId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.obligationSummary(loanId),
    queryFn: () => monthlyPaymentEngine.getObligationSummary(loanId),
    enabled: !!loanId
  });
}

/**
 * Get overdue obligations for a user
 */
export function useOverdueObligations(userId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.userOverdueObligations(userId),
    queryFn: () => monthlyPaymentEngine.getOverdueObligations(userId),
    enabled: !!userId
  });
}

/**
 * Get upcoming obligations for a user
 */
export function useUpcomingObligations(userId: string, daysAhead: number = 30) {
  return useQuery({
    queryKey: [...QUERY_KEYS.userUpcomingObligations(userId), daysAhead],
    queryFn: () => monthlyPaymentEngine.getUpcomingObligations(userId, daysAhead),
    enabled: !!userId
  });
}

/**
 * Generate monthly obligation mutation
 */
export function useGenerateObligation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ loanId, forDate }: { loanId: string; forDate?: string }) =>
      monthlyPaymentEngine.generateMonthlyObligation(loanId, forDate),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.obligations(variables.loanId)
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.nextObligation(variables.loanId)
      });
    }
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ AUTOPAY HOOKS                                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Get autopay config for a loan
 */
export function useAutopayConfig(loanId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.autopayConfig(loanId),
    queryFn: () => monthlyPaymentEngine.getAutopayConfig(loanId),
    enabled: !!loanId
  });
}

/**
 * Get all autopay configs for a user
 */
export function useUserAutopayConfigs(userId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.userAutopayConfigs(userId),
    queryFn: () => monthlyPaymentEngine.getUserAutopayConfigs(userId),
    enabled: !!userId
  });
}

/**
 * Get autopay queue (admin)
 */
export function useAutopayQueue() {
  return useQuery({
    queryKey: QUERY_KEYS.autopayQueue,
    queryFn: () => monthlyPaymentEngine.getAutopayQueue()
  });
}

/**
 * Update autopay config mutation
 */
export function useUpdateAutopay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      enabled,
      options
    }: {
      loanId: string;
      enabled: boolean;
      options?: {
        paymentMethodId?: string;
        autopayType?: AutopayType;
        fixedAmountCents?: number;
      };
    }) => monthlyPaymentEngine.updateAutopayConfig(loanId, enabled, options),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.autopayConfig(variables.loanId)
      });
    }
  });
}

/**
 * Pause autopay mutation
 */
export function usePauseAutopay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      pauseUntil,
      reason
    }: {
      loanId: string;
      pauseUntil: string;
      reason?: string;
    }) => monthlyPaymentEngine.pauseAutopay(loanId, pauseUntil, reason),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.autopayConfig(variables.loanId)
      });
    }
  });
}

/**
 * Resume autopay mutation
 */
export function useResumeAutopay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (loanId: string) => monthlyPaymentEngine.resumeAutopay(loanId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.autopayConfig(data.loan_id)
      });
    }
  });
}

/**
 * Process autopay payment mutation
 */
export function useProcessAutopayPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configId: string) =>
      monthlyPaymentEngine.processAutopayPayment(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.autopayQueue });
    }
  });
}

/**
 * Retry failed autopay mutation
 */
export function useRetryAutopay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configId: string) =>
      monthlyPaymentEngine.retryFailedAutopay(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.autopayQueue });
    }
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ REMINDER HOOKS                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Get reminders for a user
 */
export function useUserReminders(userId: string, status?: ReminderStatus) {
  return useQuery({
    queryKey: [...QUERY_KEYS.userReminders(userId), status],
    queryFn: () => monthlyPaymentEngine.getUserReminders(userId, status),
    enabled: !!userId
  });
}

/**
 * Get reminders for an obligation
 */
export function useObligationReminders(obligationId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.obligationReminders(obligationId),
    queryFn: () => monthlyPaymentEngine.getObligationReminders(obligationId),
    enabled: !!obligationId
  });
}

/**
 * Get due reminders
 */
export function useDueReminders() {
  return useQuery({
    queryKey: QUERY_KEYS.dueReminders,
    queryFn: () => monthlyPaymentEngine.getDueReminders()
  });
}

/**
 * Schedule reminders mutation
 */
export function useScheduleReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (obligationId: string) =>
      monthlyPaymentEngine.scheduleReminders(obligationId),
    onSuccess: (data, obligationId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.obligationReminders(obligationId)
      });
    }
  });
}

/**
 * Mark reminder sent mutation
 */
export function useMarkReminderSent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      reminderId,
      notificationId
    }: {
      reminderId: string;
      notificationId?: string;
    }) => monthlyPaymentEngine.markReminderSent(reminderId, notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dueReminders });
    }
  });
}

/**
 * Cancel reminder mutation
 */
export function useCancelReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reminderId: string) =>
      monthlyPaymentEngine.cancelReminder(reminderId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.obligationReminders(data.obligation_id || '')
      });
    }
  });
}

/**
 * Update reminder preferences mutation
 */
export function useUpdateReminderPreferences() {
  return useMutation({
    mutationFn: ({
      loanId,
      options
    }: {
      loanId: string;
      options: {
        daysBefore?: number[];
        channels?: ReminderChannel[];
        enabled?: boolean;
      };
    }) => monthlyPaymentEngine.updateReminderPreferences(loanId, options)
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ BATCH OPERATION HOOKS                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Generate all monthly obligations (admin cron job)
 */
export function useGenerateAllObligations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => monthlyPaymentEngine.generateAllMonthlyObligations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
    }
  });
}

/**
 * Process all autopay (admin cron job)
 */
export function useProcessAllAutopay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => monthlyPaymentEngine.processAllAutopay(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.autopayQueue });
    }
  });
}

/**
 * Send due reminders (admin cron job)
 */
export function useSendDueReminders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => monthlyPaymentEngine.sendDueReminders(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dueReminders });
    }
  });
}

/**
 * Update overdue obligations (admin cron job)
 */
export function useUpdateOverdueObligations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => monthlyPaymentEngine.updateOverdueObligations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obligations'] });
    }
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Get monthly payment dashboard data
 */
export function useMonthlyPaymentDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.paymentDashboard,
    queryFn: () => monthlyPaymentEngine.getMonthlyPaymentDashboard()
  });
}

/**
 * Get payment calendar for a user
 */
export function usePaymentCalendar(userId: string, monthsAhead: number = 6) {
  return useQuery({
    queryKey: [...QUERY_KEYS.paymentCalendar(userId), monthsAhead],
    queryFn: () => monthlyPaymentEngine.getPaymentCalendar(userId, monthsAhead),
    enabled: !!userId
  });
}

/**
 * Get payment history for a loan
 */
export function usePaymentHistory(loanId: string, limit: number = 24) {
  return useQuery({
    queryKey: [...QUERY_KEYS.paymentHistory(loanId), limit],
    queryFn: () => monthlyPaymentEngine.getPaymentHistory(loanId, limit),
    enabled: !!loanId
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ UTILITY HOOKS                                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Get days until next payment
 */
export function useDaysUntilNextPayment(loanId: string) {
  const { data: nextObligation } = useNextObligation(loanId);

  return useMemo(() => {
    if (!nextObligation) return null;

    const dueDate = new Date(nextObligation.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [nextObligation]);
}

/**
 * Check if user has overdue payments
 */
export function useHasOverduePayments(userId: string) {
  const { data: overdueObligations } = useOverdueObligations(userId);

  return useMemo(() => {
    return (overdueObligations?.length || 0) > 0;
  }, [overdueObligations]);
}

/**
 * Get total outstanding across all loans
 */
export function useTotalOutstanding(userId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.totalOutstanding(userId),
    queryFn: () => monthlyPaymentEngine.getTotalOutstanding(userId),
    enabled: !!userId
  });
}

/**
 * Get reminder urgency level
 */
export function useReminderUrgency(daysUntilDue: number) {
  return useMemo(() => {
    return monthlyPaymentEngine.getReminderUrgency(daysUntilDue);
  }, [daysUntilDue]);
}

/**
 * Get obligation status info
 */
export function useObligationStatusInfo(status: ObligationStatus) {
  return useMemo(() => {
    return monthlyPaymentEngine.getStatusInfo(status);
  }, [status]);
}

/**
 * Format currency
 */
export function useFormatCurrency() {
  return useCallback((cents: number) => {
    return monthlyPaymentEngine.formatCurrency(cents);
  }, []);
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ COMPOSITE HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Combined hook for payment obligation management
 */
export function usePaymentObligationActions() {
  const generateObligation = useGenerateObligation();
  const generateAllObligations = useGenerateAllObligations();

  return {
    generateObligation: generateObligation.mutateAsync,
    isGenerating: generateObligation.isPending,
    generateAllObligations: generateAllObligations.mutateAsync,
    isGeneratingAll: generateAllObligations.isPending
  };
}

/**
 * Combined hook for autopay management
 */
export function useAutopayActions() {
  const updateAutopay = useUpdateAutopay();
  const pauseAutopay = usePauseAutopay();
  const resumeAutopay = useResumeAutopay();
  const processPayment = useProcessAutopayPayment();
  const retryAutopay = useRetryAutopay();

  return {
    enable: (loanId: string, options?: {
      paymentMethodId?: string;
      autopayType?: AutopayType;
      fixedAmountCents?: number;
    }) => updateAutopay.mutateAsync({ loanId, enabled: true, options }),
    disable: (loanId: string) =>
      updateAutopay.mutateAsync({ loanId, enabled: false }),
    pause: pauseAutopay.mutateAsync,
    resume: resumeAutopay.mutateAsync,
    processPayment: processPayment.mutateAsync,
    retry: retryAutopay.mutateAsync,
    isUpdating: updateAutopay.isPending,
    isPausing: pauseAutopay.isPending,
    isResuming: resumeAutopay.isPending,
    isProcessing: processPayment.isPending,
    isRetrying: retryAutopay.isPending
  };
}

/**
 * Combined hook for reminder management
 */
export function useReminderActions() {
  const scheduleReminders = useScheduleReminders();
  const markSent = useMarkReminderSent();
  const cancelReminder = useCancelReminder();
  const updatePreferences = useUpdateReminderPreferences();

  return {
    schedule: scheduleReminders.mutateAsync,
    markSent: markSent.mutateAsync,
    cancel: cancelReminder.mutateAsync,
    updatePreferences: updatePreferences.mutateAsync,
    isScheduling: scheduleReminders.isPending,
    isMarkingSent: markSent.isPending,
    isCancelling: cancelReminder.isPending,
    isUpdating: updatePreferences.isPending
  };
}

/**
 * Combined hook for batch operations (admin/cron)
 */
export function useBatchOperations() {
  const generateAll = useGenerateAllObligations();
  const processAutopay = useProcessAllAutopay();
  const sendReminders = useSendDueReminders();
  const updateOverdue = useUpdateOverdueObligations();

  return {
    generateAllObligations: generateAll.mutateAsync,
    processAllAutopay: processAutopay.mutateAsync,
    sendDueReminders: sendReminders.mutateAsync,
    updateOverdueObligations: updateOverdue.mutateAsync,
    isProcessing:
      generateAll.isPending ||
      processAutopay.isPending ||
      sendReminders.isPending ||
      updateOverdue.isPending
  };
}

/**
 * Complete monthly payment dashboard hook
 */
export function useMonthlyPaymentComplete(userId: string, loanId?: string) {
  const upcomingObligations = useUpcomingObligations(userId);
  const overdueObligations = useOverdueObligations(userId);
  const totalOutstanding = useTotalOutstanding(userId);
  const userAutopayConfigs = useUserAutopayConfigs(userId);
  const userReminders = useUserReminders(userId, 'scheduled');
  const paymentCalendar = usePaymentCalendar(userId);

  const nextObligation = loanId ? useNextObligation(loanId) : null;
  const autopayConfig = loanId ? useAutopayConfig(loanId) : null;
  const obligationSummary = loanId ? useObligationSummary(loanId) : null;

  const isLoading =
    upcomingObligations.isLoading ||
    overdueObligations.isLoading ||
    totalOutstanding.isLoading;

  return {
    // User-level data
    upcomingObligations: upcomingObligations.data || [],
    overdueObligations: overdueObligations.data || [],
    totalOutstanding: totalOutstanding.data || 0,
    autopayConfigs: userAutopayConfigs.data || [],
    scheduledReminders: userReminders.data || [],
    paymentCalendar: paymentCalendar.data || [],

    // Loan-specific data (if loanId provided)
    nextObligation: nextObligation?.data || null,
    autopayConfig: autopayConfig?.data || null,
    obligationSummary: obligationSummary?.data || null,

    // Status
    isLoading,
    hasOverdue: (overdueObligations.data?.length || 0) > 0,
    autopayEnabled: autopayConfig?.data?.status === 'active'
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ EXPORT ENGINE & TYPES                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export {
  monthlyPaymentEngine,
  type PaymentObligation,
  type AutopayConfig,
  type PaymentReminder,
  type ObligationStatus,
  type AutopayType,
  type AutopayStatus,
  type ReminderChannel,
  type ReminderStatus,
  type ReminderType,
  type EstimatedPaymentResult,
  type GenerateObligationResult,
  type AutopayUpdateResult,
  type ProcessAutopayResult,
  type BatchResult,
  type ObligationSummary,
  type NextObligationInfo
};
