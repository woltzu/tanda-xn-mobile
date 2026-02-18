// ══════════════════════════════════════════════════════════════════════════════
// CREDITWORTHINESS HOOKS
// ══════════════════════════════════════════════════════════════════════════════
// React hooks for creditworthiness assessment, loan applications, and lending.
// ══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  creditworthinessEngine,
  CreditworthinessAssessment,
  LoanProduct,
  LoanApplication,
  Loan,
  PaymentScheduleEntry,
  LoanPayment,
  LoanGuarantee,
  LoanCoSigner,
  AssessmentParams,
  RiskGrade,
  LoanPurpose,
  CREDIT_CONFIG,
} from '@/services/CreditworthinessEngine';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ QUERY KEYS                                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

const QUERY_KEYS = {
  loanProducts: ['loan-products'],
  eligibleProducts: (userId: string) => ['eligible-products', userId],
  assessment: (assessmentId: string) => ['assessment', assessmentId],
  userAssessments: (userId: string) => ['user-assessments', userId],
  latestAssessment: (userId: string) => ['latest-assessment', userId],
  loanApplication: (applicationId: string) => ['loan-application', applicationId],
  userApplications: (userId: string) => ['user-applications', userId],
  loan: (loanId: string) => ['loan', loanId],
  loanWithDetails: (loanId: string) => ['loan-details', loanId],
  userLoans: (userId: string) => ['user-loans', userId],
  userActiveLoans: (userId: string) => ['user-active-loans', userId],
  paymentSchedule: (loanId: string) => ['payment-schedule', loanId],
  loanPayments: (loanId: string) => ['loan-payments', loanId],
  upcomingPayment: (loanId: string) => ['upcoming-payment', loanId],
  elderCapacity: (userId: string) => ['elder-capacity', userId],
  coSignerCapacity: (userId: string) => ['cosigner-capacity', userId],
  userGuarantees: (userId: string) => ['user-guarantees', userId],
  userCoSigns: (userId: string) => ['user-cosigns', userId],
  portfolioSummary: ['portfolio-summary'],
  guarantorExposure: (userId: string) => ['guarantor-exposure', userId],
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ LOAN PRODUCT HOOKS                                                          │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get all active loan products
 */
export function useLoanProducts() {
  return useQuery({
    queryKey: QUERY_KEYS.loanProducts,
    queryFn: () => creditworthinessEngine.getLoanProducts(),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to get eligible loan products for a user
 */
export function useEligibleLoanProducts(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.eligibleProducts(userId!),
    queryFn: () => creditworthinessEngine.getEligibleProducts(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get a specific loan product by code
 */
export function useLoanProductByCode(code: string | undefined) {
  const { data: products } = useLoanProducts();

  return useMemo(() => {
    if (!products || !code) return null;
    return products.find((p) => p.code === code) || null;
  }, [products, code]);
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ASSESSMENT HOOKS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to assess creditworthiness
 */
export function useAssessCreditworthiness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: AssessmentParams) => creditworthinessEngine.assessCreditworthiness(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userAssessments(variables.userId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.latestAssessment(variables.userId) });
    },
  });
}

/**
 * Hook to get a specific assessment
 */
export function useAssessment(assessmentId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.assessment(assessmentId!),
    queryFn: () => creditworthinessEngine.getAssessment(assessmentId!),
    enabled: !!assessmentId,
  });
}

/**
 * Hook to get user's assessments
 */
export function useUserAssessments(userId: string | undefined, limit: number = 10) {
  return useQuery({
    queryKey: QUERY_KEYS.userAssessments(userId!),
    queryFn: () => creditworthinessEngine.getUserAssessments(userId!, limit),
    enabled: !!userId,
  });
}

/**
 * Hook to get user's latest valid assessment
 */
export function useLatestValidAssessment(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.latestAssessment(userId!),
    queryFn: () => creditworthinessEngine.getLatestValidAssessment(userId!),
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ LOAN APPLICATION HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to create loan application
 */
export function useCreateLoanApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      assessmentId,
      userId,
      purposeDescription,
    }: {
      assessmentId: string;
      userId: string;
      purposeDescription?: string;
    }) => creditworthinessEngine.createLoanApplication(assessmentId, userId, purposeDescription),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userApplications(variables.userId) });
    },
  });
}

/**
 * Hook to get a loan application
 */
export function useLoanApplication(applicationId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.loanApplication(applicationId!),
    queryFn: () => creditworthinessEngine.getLoanApplication(applicationId!),
    enabled: !!applicationId,
  });
}

/**
 * Hook to get user's loan applications
 */
export function useUserLoanApplications(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.userApplications(userId!),
    queryFn: () => creditworthinessEngine.getUserLoanApplications(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to accept loan terms
 */
export function useAcceptLoanTerms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, userIp }: { applicationId: string; userIp?: string }) =>
      creditworthinessEngine.acceptLoanTerms(applicationId, userIp),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanApplication(variables.applicationId) });
    },
  });
}

/**
 * Hook to cancel loan application
 */
export function useCancelLoanApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) =>
      creditworthinessEngine.cancelLoanApplication(applicationId, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanApplication(variables.applicationId) });
    },
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ LOAN HOOKS                                                                  │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to disburse a loan
 */
export function useDisburseLoan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) => creditworthinessEngine.disburseLoan(applicationId),
    onSuccess: (_, applicationId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanApplication(applicationId) });
      // Note: Would need userId to invalidate user loans, handled by caller
    },
  });
}

/**
 * Hook to get a loan
 */
export function useLoan(loanId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.loan(loanId!),
    queryFn: () => creditworthinessEngine.getLoan(loanId!),
    enabled: !!loanId,
  });
}

/**
 * Hook to get loan with full details
 */
export function useLoanWithDetails(loanId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.loanWithDetails(loanId!),
    queryFn: () => creditworthinessEngine.getLoanWithDetails(loanId!),
    enabled: !!loanId,
  });
}

/**
 * Hook to get user's loans
 */
export function useUserLoans(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.userLoans(userId!),
    queryFn: () => creditworthinessEngine.getUserLoans(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to get user's active loans
 */
export function useUserActiveLoans(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.userActiveLoans(userId!),
    queryFn: () => creditworthinessEngine.getUserActiveLoans(userId!),
    enabled: !!userId,
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ PAYMENT HOOKS                                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to record a loan payment
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      loanId,
      amountCents,
      paymentMethod,
      paymentSourceId,
    }: {
      loanId: string;
      amountCents: number;
      paymentMethod: string;
      paymentSourceId?: string;
    }) => creditworthinessEngine.recordPayment(loanId, amountCents, paymentMethod, paymentSourceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loan(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanWithDetails(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.paymentSchedule(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.loanPayments(variables.loanId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.upcomingPayment(variables.loanId) });
    },
  });
}

/**
 * Hook to get payment schedule
 */
export function usePaymentSchedule(loanId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.paymentSchedule(loanId!),
    queryFn: () => creditworthinessEngine.getPaymentSchedule(loanId!),
    enabled: !!loanId,
  });
}

/**
 * Hook to get loan payments
 */
export function useLoanPayments(loanId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.loanPayments(loanId!),
    queryFn: () => creditworthinessEngine.getLoanPayments(loanId!),
    enabled: !!loanId,
  });
}

/**
 * Hook to get upcoming payment
 */
export function useUpcomingPayment(loanId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.upcomingPayment(loanId!),
    queryFn: () => creditworthinessEngine.getUpcomingPayment(loanId!),
    enabled: !!loanId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ GUARANTEE & CO-SIGNER HOOKS                                                 │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to check Elder guarantee capacity
 */
export function useElderGuaranteeCapacity(elderUserId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.elderCapacity(elderUserId!),
    queryFn: () => creditworthinessEngine.checkElderGuaranteeCapacity(elderUserId!),
    enabled: !!elderUserId,
  });
}

/**
 * Hook to check co-signer capacity
 */
export function useCoSignerCapacity(coSignerUserId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.coSignerCapacity(coSignerUserId!),
    queryFn: () => creditworthinessEngine.checkCoSignerCapacity(coSignerUserId!),
    enabled: !!coSignerUserId,
  });
}

/**
 * Hook to get user's guarantees
 */
export function useUserGuarantees(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.userGuarantees(userId!),
    queryFn: () => creditworthinessEngine.getUserGuarantees(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to get user's co-sign agreements
 */
export function useUserCoSigns(userId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.userCoSigns(userId!),
    queryFn: () => creditworthinessEngine.getUserCoSigns(userId!),
    enabled: !!userId,
  });
}

/**
 * Hook to get guarantor exposure
 */
export function useGuarantorExposure(guarantorUserId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.guarantorExposure(guarantorUserId!),
    queryFn: () => creditworthinessEngine.getGuarantorExposure(guarantorUserId!),
    enabled: !!guarantorUserId,
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ANALYTICS HOOKS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get loan portfolio summary
 */
export function useLoanPortfolioSummary() {
  return useQuery({
    queryKey: QUERY_KEYS.portfolioSummary,
    queryFn: () => creditworthinessEngine.getLoanPortfolioSummary(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ COMPUTED/DERIVED HOOKS                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Hook to get credit score from XnScore
 */
export function useCreditScore(xnScore: number | undefined) {
  return useMemo(() => {
    if (xnScore === undefined) return null;
    return creditworthinessEngine.calculateCreditScore(xnScore);
  }, [xnScore]);
}

/**
 * Hook to get risk grade info
 */
export function useRiskGradeInfo(grade: RiskGrade | undefined) {
  return useMemo(() => {
    if (!grade) return null;
    return creditworthinessEngine.getRiskGradeInfo(grade);
  }, [grade]);
}

/**
 * Hook to check if user can apply for loans
 */
export function useCanApplyForLoans(userId: string | undefined) {
  const { data: activeLoans } = useUserActiveLoans(userId);
  const { data: products } = useEligibleLoanProducts(userId);

  return useMemo(() => {
    if (!activeLoans || !products) {
      return { canApply: false, reason: 'Loading...', loading: true };
    }

    if (activeLoans.length >= 2) {
      return { canApply: false, reason: 'Maximum of 2 active loans reached', loading: false };
    }

    if (products.length === 0) {
      return { canApply: false, reason: 'No eligible loan products available', loading: false };
    }

    // Check for delinquent loans
    const hasDelinquent = activeLoans.some((loan) => loan.is_delinquent);
    if (hasDelinquent) {
      return { canApply: false, reason: 'Active delinquency on existing loan', loading: false };
    }

    return { canApply: true, reason: null, loading: false };
  }, [activeLoans, products]);
}

/**
 * Hook with assessment breakdown helpers
 */
export function useAssessmentWithHelpers(assessmentId: string | undefined) {
  const { data: assessment, isLoading, error } = useAssessment(assessmentId);

  const helpers = useMemo(() => {
    if (!assessment) return null;

    const riskGradeInfo = creditworthinessEngine.getRiskGradeInfo(assessment.risk_grade);
    const isValid = creditworthinessEngine.isAssessmentValid(assessment);

    return {
      assessment,
      riskGradeInfo,
      isValid,
      formattedApprovedAmount: assessment.approved_amount_cents
        ? creditworthinessEngine.formatCurrency(assessment.approved_amount_cents)
        : null,
      formattedMonthlyPayment: assessment.monthly_payment_cents
        ? creditworthinessEngine.formatCurrency(assessment.monthly_payment_cents)
        : null,
      formattedTotalRepayment: assessment.total_repayment_cents
        ? creditworthinessEngine.formatCurrency(assessment.total_repayment_cents)
        : null,
      factors: {
        xnscoreContribution: `${assessment.xnscore_at_assessment} XnScore → ${assessment.xnscore_base_credit_score} base credit score`,
        circleHealthContribution: `${assessment.circle_health_adjustment >= 0 ? '+' : ''}${assessment.circle_health_adjustment} points`,
        loanHistoryContribution: `${assessment.loan_history_adjustment >= 0 ? '+' : ''}${assessment.loan_history_adjustment} points`,
        communityDiscount: `${assessment.total_community_discount_percent}% APR discount`,
      },
    };
  }, [assessment]);

  return {
    ...helpers,
    isLoading,
    error,
  };
}

/**
 * Hook with loan details and helpers
 */
export function useLoanWithHelpers(loanId: string | undefined) {
  const { data: loanData, isLoading, error, refetch } = useLoanWithDetails(loanId);

  const helpers = useMemo(() => {
    if (!loanData) return null;

    const healthStatus = creditworthinessEngine.getLoanHealthStatus(loanData);
    const progressPercent = Math.round((loanData.payments_made / loanData.payments_total) * 100);
    const principalPaidPercent = Math.round(
      ((loanData.principal_cents - loanData.outstanding_principal_cents) / loanData.principal_cents) * 100
    );

    return {
      loan: loanData,
      healthStatus,
      progressPercent,
      principalPaidPercent,
      formattedPrincipal: creditworthinessEngine.formatCurrency(loanData.principal_cents),
      formattedOutstanding: creditworthinessEngine.formatCurrency(loanData.total_outstanding_cents),
      formattedMonthlyPayment: creditworthinessEngine.formatCurrency(loanData.monthly_payment_cents),
      formattedNextPayment: loanData.next_payment_amount_cents
        ? creditworthinessEngine.formatCurrency(loanData.next_payment_amount_cents)
        : null,
      upcomingScheduleEntry: loanData.schedule.find(
        (s) => s.status === 'scheduled' || s.status === 'partial' || s.status === 'late'
      ),
      paidScheduleEntries: loanData.schedule.filter((s) => s.status === 'paid'),
      recentPayments: loanData.payments.slice(0, 5),
    };
  }, [loanData]);

  return {
    ...helpers,
    isLoading,
    error,
    refetch,
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ACTION HOOKS                                                                │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Combined hook for creditworthiness actions
 */
export function useCreditworthinessActions() {
  const assessCreditworthiness = useAssessCreditworthiness();
  const createApplication = useCreateLoanApplication();
  const acceptTerms = useAcceptLoanTerms();
  const cancelApplication = useCancelLoanApplication();
  const disburseLoan = useDisburseLoan();
  const recordPayment = useRecordPayment();

  return {
    // Assessment
    assessCreditworthiness: assessCreditworthiness.mutateAsync,
    isAssessing: assessCreditworthiness.isPending,
    assessmentError: assessCreditworthiness.error,

    // Application
    createApplication: createApplication.mutateAsync,
    isCreatingApplication: createApplication.isPending,
    createApplicationError: createApplication.error,

    // Accept terms
    acceptTerms: acceptTerms.mutateAsync,
    isAcceptingTerms: acceptTerms.isPending,
    acceptTermsError: acceptTerms.error,

    // Cancel
    cancelApplication: cancelApplication.mutateAsync,
    isCancelling: cancelApplication.isPending,
    cancelError: cancelApplication.error,

    // Disburse
    disburseLoan: disburseLoan.mutateAsync,
    isDisbursing: disburseLoan.isPending,
    disburseError: disburseLoan.error,

    // Payment
    recordPayment: recordPayment.mutateAsync,
    isRecordingPayment: recordPayment.isPending,
    paymentError: recordPayment.error,
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DASHBOARD HOOK                                                              │
// └─────────────────────────────────────────────────────────────────────────────┘

/**
 * Comprehensive hook for lending dashboard
 */
export function useLendingDashboard(userId: string | undefined) {
  const productsQuery = useEligibleLoanProducts(userId);
  const activeLoansQuery = useUserActiveLoans(userId);
  const applicationsQuery = useUserLoanApplications(userId);
  const latestAssessmentQuery = useLatestValidAssessment(userId);
  const guaranteesQuery = useUserGuarantees(userId);
  const coSignsQuery = useUserCoSigns(userId);
  const canApply = useCanApplyForLoans(userId);
  const actions = useCreditworthinessActions();

  const summary = useMemo(() => {
    const activeLoans = activeLoansQuery.data || [];
    const applications = applicationsQuery.data || [];

    const totalOutstanding = activeLoans.reduce((sum, loan) => sum + loan.total_outstanding_cents, 0);
    const totalPrincipal = activeLoans.reduce((sum, loan) => sum + loan.principal_cents, 0);
    const nextPaymentDue = activeLoans
      .filter((loan) => loan.next_payment_date)
      .sort((a, b) => new Date(a.next_payment_date!).getTime() - new Date(b.next_payment_date!).getTime())[0];

    const pendingApplications = applications.filter(
      (app) => app.status === 'pending' || app.status === 'approved'
    );

    return {
      activeLoansCount: activeLoans.length,
      totalOutstanding,
      totalPrincipal,
      formattedTotalOutstanding: creditworthinessEngine.formatCurrency(totalOutstanding),
      nextPaymentDue,
      pendingApplicationsCount: pendingApplications.length,
      hasDelinquentLoans: activeLoans.some((loan) => loan.is_delinquent),
    };
  }, [activeLoansQuery.data, applicationsQuery.data]);

  return {
    // Data
    eligibleProducts: productsQuery.data || [],
    activeLoans: activeLoansQuery.data || [],
    applications: applicationsQuery.data || [],
    latestAssessment: latestAssessmentQuery.data,
    guarantees: guaranteesQuery.data || [],
    coSigns: coSignsQuery.data || [],

    // Summary
    summary,

    // Can apply
    canApply: canApply.canApply,
    canApplyReason: canApply.reason,

    // Loading states
    isLoading:
      productsQuery.isLoading ||
      activeLoansQuery.isLoading ||
      applicationsQuery.isLoading ||
      canApply.loading,

    // Errors
    error:
      productsQuery.error ||
      activeLoansQuery.error ||
      applicationsQuery.error,

    // Actions
    ...actions,
  };
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ UTILITY EXPORTS                                                             │
// └─────────────────────────────────────────────────────────────────────────────┘

export {
  creditworthinessEngine,
  CREDIT_CONFIG,
  type CreditworthinessAssessment,
  type LoanProduct,
  type LoanApplication,
  type Loan,
  type PaymentScheduleEntry,
  type LoanPayment,
  type LoanGuarantee,
  type LoanCoSigner,
  type AssessmentParams,
  type RiskGrade,
  type LoanPurpose,
};
