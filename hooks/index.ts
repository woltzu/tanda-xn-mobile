// ══════════════════════════════════════════════════════════════════════════════
// HOOKS INDEX - Export all hooks
// ══════════════════════════════════════════════════════════════════════════════

// Wallet Hooks
export {
  useWallet,
  useWalletBalance,
  useWalletTransactions,
  useContributionReservations,
  useSavingsGoals,
  usePayoutPreferences,
  usePayoutDestinationOptions,
  usePayoutExecutions,
  useMoneyRetentionStats,
  useWalletActions
} from './useWallet';

// Payout Execution Hooks
export {
  usePendingPayouts,
  usePayoutExecution,
  usePayoutHistory,
  usePayoutDetails,
  usePayoutSuggestions,
  usePayoutAnalytics,
  useMoneyRetentionAnalytics,
  useCirclePayoutQueue
} from './usePayoutExecution';

// Default Cascade Hooks
export {
  useUserDefaults,
  useDefaultDetails,
  useVoucherStanding,
  useVoucherImpactHistory,
  useRedistributionRequests,
  useRecoveryPlan,
  useRecoveryProgress,
  useUpcomingInstallments,
  useCircleResolutions,
  useDefaultCascadeActions,
  useSuspensionReview
} from './useDefaultCascade';

// Circle Dissolution Hooks
export {
  useDissolutionRequest,
  useCircleDissolutions,
  useActiveDissolutions,
  useUserDissolutionHistory,
  useDissolutionVoting,
  useVotingProgress,
  useDissolutionObjections,
  useUserDissolutionPosition,
  useRefundSummary,
  useDissolutionTimeline,
  useDissolutionTriggerConfigs,
  useApplicableTriggers,
  useDissolutionActions,
  useDissolutionAnalytics,
  useDissolutionStats
} from './useDissolution';

// Member Removal Mid-Circle Hooks
export {
  useRemovalRequest,
  useCircleRemovalRequests,
  useActiveRemovalRequests,
  useUserRemovalHistory,
  useMemberCirclePosition,
  useRemovalPreview,
  useRemovalVoting,
  useRemovalVotingProgress,
  useUserDebts,
  useDebtDetails,
  useHasOutstandingDebts,
  useDebtPayment,
  useCircleRemovalSettings,
  useCircleRemovalAudit,
  usePayoutOrderAdjustments,
  useRemovalActions,
  useRemovalStatistics
} from './useMemberRemoval';

// Position Swapping Hooks
export {
  useCircleSwapConfig,
  useSwapRequest,
  useCircleSwapRequests,
  usePendingSwapRequests,
  useSwapRequestsAwaitingConfirmation,
  useSwapRequestsPendingElderApproval,
  useMySwapRequests,
  useSwapActions,
  useCanSwap,
  useCircleMembersForSwap,
  useSwapHistory,
  useCircleSwapHistory,
  useCircleSwapStatistics,
  useHasPendingSwaps,
  useSwapCountThisCycle,
  useTimeRemaining,
  useCoolingOffStatus,
  useSwapDashboard
} from './usePositionSwap';

// XnScore Hooks
export {
  useXnScore,
  useXnScoreDetails,
  useInitialScoreSignals,
  useXnScoreHistory,
  useXnScoreAdjustments,
  useVelocityCap,
  useCalculateInitialScore,
  useCircleEligibility,
  useScoreRequirements,
  useVouchLimits,
  useVouchValue,
  useVouchActions,
  useVouchesReceived,
  useVouchesGiven,
  useXnScoreLeaderboard,
  useTierDistribution,
  useTierInfo,
  useAgeCap,
  useXnScoreDashboard,
  // Decay/Growth Hooks
  useDecayHistory,
  useTenureHistory,
  useRecoveryPeriods,
  useRecoveryStatus,
  useActivitySummary,
  useDecayRisk,
  useTenureProgress,
  useDecayGrowthActions,
  useDecayAtRiskUsers,
  useTenureEligibleUsers,
  useRecoveryPeriodUsers,
  useDecayGrowthDashboard
} from './useXnScore';

// Score Breakdown Hooks
export {
  useScoreBreakdown,
  useCachedBreakdown,
  useRefreshBreakdown,
  useRecalculateScore,
  useFactorDefinitions,
  useFactorComponents,
  useFactorsWithComponents,
  useImprovementTips,
  useAllImprovementTips,
  useTipsForFactor,
  useFactorPerformanceSummary,
  useImprovementOpportunities,
  useUsersByFactorStatus,
  useScoreBreakdownWithHelpers,
  useFactorBreakdown,
  useScoreComparison,
  useScoreBreakdownActions,
  useScoreBreakdownDashboard
} from './useScoreBreakdown';

// Creditworthiness Assessment Hooks
export {
  // Product Hooks
  useLoanProducts,
  useLoanProduct,
  useEligibleLoanProducts,
  // Assessment Hooks
  useAssessCreditworthiness,
  useAssessment,
  useUserAssessments,
  useLatestAssessment,
  usePreflightCheck,
  // Application Hooks
  useCreateLoanApplication,
  useLoanApplication,
  useUserLoanApplications,
  usePendingApplications,
  useUpdateApplicationStatus,
  // Loan Hooks
  useLoan,
  useUserLoans,
  useActiveLoans,
  useLoansByStatus,
  // Payment Hooks
  useRecordPayment,
  usePaymentSchedule,
  useLoanPayments,
  useOverduePayments,
  useNextPayment,
  // Guarantee Hooks
  useCreateGuarantee,
  useGuaranteeRequest,
  useUserGuarantees,
  useGuaranteesForLoan,
  useElderGuaranteeCapacity,
  useUpdateGuaranteeStatus,
  // Co-Signer Hooks
  useAddCoSigner,
  useCoSignerRequest,
  useLoanCoSigners,
  useUserCoSignerObligations,
  useCoSignerCapacity,
  useUpdateCoSignerStatus,
  // Analytics Hooks
  useLoanPortfolioSummary,
  useGuarantorExposure,
  useActiveLoansDashboard,
  useCreditworthinessSummary,
  // Computed Hooks
  useCreditScore,
  useRiskGradeInfo,
  useLoanAmortization,
  useCanApplyForLoans,
  useTotalDebtObligations,
  // Actions Hook
  useLendingActions,
  // Dashboard Hook
  useLendingDashboard,
  // Engine & Types
  creditworthinessEngine,
  type LoanProduct,
  type CreditworthinessAssessment,
  type LoanApplication,
  type Loan,
  type PaymentScheduleItem,
  type LoanPayment,
  type LoanGuarantee,
  type LoanCoSigner,
  type RiskGrade,
  type CreditRecommendation,
  type LoanPortfolioSummary,
  type GuarantorExposure,
  type ActiveLoanDashboardItem,
  type CreditworthinessSummaryItem
} from './useCreditworthiness';

// Interest Calculation Hooks
export {
  // Configuration
  useInterestConfig,
  // Interest Calculation
  useAccruedInterest,
  useEffectiveRate,
  // Payoff Calculation
  usePayoffAmount,
  useGeneratePayoffQuote,
  usePayoffQuotes,
  useValidPayoffQuote,
  // Late Fees
  useLateFeeCalculation,
  useLateFees,
  useApplyLateFee,
  useWaiveLateFee,
  // Payment Application
  useApplyPayment,
  // Interest Accrual History
  useInterestAccruals,
  useInterestSummary,
  // Rate Changes
  useRateChanges,
  useCheckPromotionalExpiration,
  // Market Index Rates
  useIndexRates,
  useIndexRate,
  useIndexRateHistory,
  // Batch Operations
  useRunDailyAccrual,
  useRunOverdueCheck,
  // Overdue Payments
  useOverduePayments,
  useLoanOverduePayments,
  // Audit Trail
  useInterestAuditTrail,
  // Computed Hooks
  useSimpleInterestCalculation,
  useMonthlyPaymentCalculation,
  useAmortizationSchedule,
  useRateTypeInfo,
  useLateFeeStatusInfo,
  // Actions Hook
  useInterestActions,
  // Dashboard Hooks
  useLoanInterestDashboard,
  useInterestAdminDashboard,
  // Engine & Types
  interestCalculationEngine,
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
  type LateFeeStatus
} from './useInterestCalculation';

// Monthly Payment Hooks
export {
  // Estimated Payment
  useEstimatedMonthlyPayment,
  useLocalMonthlyPaymentCalculation,
  // Payment Obligations
  useObligations,
  useNextObligation,
  useObligation,
  useObligationSummary,
  useOverdueObligations,
  useUpcomingObligations,
  useGenerateObligation,
  // Autopay
  useAutopayConfig,
  useUserAutopayConfigs,
  useAutopayQueue,
  useUpdateAutopay,
  usePauseAutopay,
  useResumeAutopay,
  useProcessAutopayPayment,
  useRetryAutopay,
  // Reminders
  useUserReminders,
  useObligationReminders,
  useDueReminders,
  useScheduleReminders,
  useMarkReminderSent,
  useCancelReminder,
  useUpdateReminderPreferences,
  // Batch Operations
  useGenerateAllObligations,
  useProcessAllAutopay,
  useSendDueReminders,
  useUpdateOverdueObligations,
  // Dashboard
  useMonthlyPaymentDashboard,
  usePaymentCalendar,
  usePaymentHistory,
  // Utility
  useDaysUntilNextPayment,
  useHasOverduePayments,
  useTotalOutstanding,
  useReminderUrgency,
  useObligationStatusInfo,
  useFormatCurrency,
  // Actions
  usePaymentObligationActions,
  useAutopayActions,
  useReminderActions,
  useBatchOperations,
  // Complete Dashboard
  useMonthlyPaymentComplete,
  // Engine & Types
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
} from './useMonthlyPayment';
