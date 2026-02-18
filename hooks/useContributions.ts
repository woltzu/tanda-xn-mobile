/**
 * useContributions Hook
 *
 * A comprehensive React hook for managing contributions, schedules,
 * payment processing, and affordability checks.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  contributionSchedulingService,
  Contribution,
  ContributionSchedule,
  ContributionFrequency,
  ContributionStatus,
  PaymentProcessingResult,
} from "../services/ContributionSchedulingService";
import {
  contributionAffordabilityService,
  AffordabilityResult,
  AffordabilityDecision,
  normalizeToMonthly,
  getFrequencyLabel,
} from "../services/ContributionAffordabilityService";

// ============================================================================
// TYPES
// ============================================================================

export interface UseContributionsResult {
  // State
  contributions: Contribution[];
  pendingContributions: Contribution[];
  schedule: ContributionSchedule[];
  stats: ContributionStats | null;
  affordability: AffordabilityResult | null;
  isLoading: boolean;
  error: string | null;

  // Contribution Actions
  loadContributions: (circleId: string) => Promise<void>;
  loadPendingContributions: () => Promise<void>;
  loadCircleSchedule: (circleId: string) => Promise<void>;
  processPayment: (contributionId: string) => Promise<PaymentProcessingResult>;

  // Affordability Actions
  checkAffordability: (
    amount: number,
    frequency: ContributionFrequency
  ) => Promise<AffordabilityResult>;
  getRecommendedAmount: (frequency: ContributionFrequency) => Promise<{
    min: number;
    recommended: number;
    max: number;
  }>;

  // Helpers
  getStatusLabel: (status: ContributionStatus) => string;
  getStatusColor: (status: ContributionStatus) => string;
  formatAmount: (amount: number) => string;
  formatDueDate: (date: string) => string;
  getDaysUntilDue: (dueDate: string) => number;
  isOverdue: (dueDate: string) => boolean;
  isInGracePeriod: (dueDate: string) => boolean;
  getFrequencyLabel: (frequency: ContributionFrequency) => string;
  normalizeToMonthly: (amount: number, frequency: ContributionFrequency) => number;

  // Computed
  totalPending: number;
  totalDueThisWeek: number;
  nextDueContribution: Contribution | null;
}

export interface ContributionStats {
  totalDue: number;
  totalPaid: number;
  totalPending: number;
  onTimePayments: number;
  latePayments: number;
  lateFeesPaid: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  payoutPosition: number | null;
  payoutReceived: boolean;
  onTimeRate: number;
}

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_LABELS: Record<ContributionStatus, string> = {
  pending: "Pending",
  completed: "Paid",
  late: "Paid Late",
  defaulted: "Defaulted",
  waived: "Waived",
  covered: "Covered",
};

const STATUS_COLORS: Record<ContributionStatus, string> = {
  pending: "#F59E0B", // amber
  completed: "#10B981", // green
  late: "#EF4444", // red
  defaulted: "#7F1D1D", // dark red
  waived: "#6B7280", // gray
  covered: "#3B82F6", // blue
};

// Grace period constant (matches service)
const GRACE_PERIOD_DAYS = 2;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const useContributions = (): UseContributionsResult => {
  const { user } = useAuth();

  // State
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [pendingContributions, setPendingContributions] = useState<Contribution[]>([]);
  const [schedule, setSchedule] = useState<ContributionSchedule[]>([]);
  const [stats, setStats] = useState<ContributionStats | null>(null);
  const [affordability, setAffordability] = useState<AffordabilityResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // CONTRIBUTION ACTIONS
  // ============================================================================

  /**
   * Load contributions for a specific circle
   */
  const loadContributions = useCallback(async (circleId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const userContributions = await contributionSchedulingService.getUserContributions(
        user.id,
        circleId
      );
      setContributions(userContributions);

      // Also load stats
      const userStats = await contributionSchedulingService.getUserContributionStats(
        user.id,
        circleId
      );

      setStats({
        ...userStats,
        onTimeRate:
          userStats.onTimePayments + userStats.latePayments > 0
            ? userStats.onTimePayments /
              (userStats.onTimePayments + userStats.latePayments)
            : 1,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Load all pending contributions across circles
   */
  const loadPendingContributions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const pending = await contributionSchedulingService.getUserPendingContributions(user.id);
      setPendingContributions(pending);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Load contribution schedule for a circle
   */
  const loadCircleSchedule = useCallback(async (circleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const circleSchedule = await contributionSchedulingService.getCircleSchedule(circleId);
      setSchedule(circleSchedule);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Process a contribution payment
   */
  const processPayment = useCallback(async (
    contributionId: string
  ): Promise<PaymentProcessingResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await contributionSchedulingService.processPayment(contributionId);

      // Update local state
      setContributions((prev) =>
        prev.map((c) =>
          c.id === contributionId
            ? {
                ...c,
                status: result.isLate ? "late" : "completed",
                isLate: result.isLate,
                daysLate: result.daysLate,
                lateFee: result.lateFee,
                totalCharged: result.totalCharged,
                paidAt: new Date().toISOString(),
              }
            : c
        )
      );

      setPendingContributions((prev) => prev.filter((c) => c.id !== contributionId));

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================================
  // AFFORDABILITY ACTIONS
  // ============================================================================

  /**
   * Check if user can afford a new contribution
   */
  const checkAffordability = useCallback(async (
    amount: number,
    frequency: ContributionFrequency
  ): Promise<AffordabilityResult> => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await contributionAffordabilityService.checkAffordability(
        user.id,
        amount,
        frequency
      );
      setAffordability(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Get recommended contribution amounts
   */
  const getRecommendedAmount = useCallback(async (
    frequency: ContributionFrequency
  ): Promise<{ min: number; recommended: number; max: number }> => {
    if (!user) {
      return { min: 5000, recommended: 25000, max: 100000 };
    }

    try {
      return await contributionAffordabilityService.getRecommendedAmount(user.id, frequency);
    } catch (err: any) {
      return { min: 5000, recommended: 25000, max: 100000 };
    }
  }, [user]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getStatusLabel = useCallback((status: ContributionStatus): string => {
    return STATUS_LABELS[status] || status;
  }, []);

  const getStatusColor = useCallback((status: ContributionStatus): string => {
    return STATUS_COLORS[status] || "#6B7280";
  }, []);

  const formatAmount = useCallback((amount: number): string => {
    return new Intl.NumberFormat("fr-CM", {
      style: "currency",
      currency: "XAF",
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatDueDate = useCallback((date: string): string => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, []);

  const getDaysUntilDue = useCallback((dueDate: string): number => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const isOverdue = useCallback((dueDate: string): boolean => {
    return getDaysUntilDue(dueDate) < 0;
  }, [getDaysUntilDue]);

  const isInGracePeriod = useCallback((dueDate: string): boolean => {
    const daysUntil = getDaysUntilDue(dueDate);
    return daysUntil < 0 && Math.abs(daysUntil) <= GRACE_PERIOD_DAYS;
  }, [getDaysUntilDue]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const totalPending = pendingContributions.reduce((sum, c) => sum + c.amount, 0);

  const totalDueThisWeek = pendingContributions
    .filter((c) => {
      const daysUntil = getDaysUntilDue(c.dueDate);
      return daysUntil >= 0 && daysUntil <= 7;
    })
    .reduce((sum, c) => sum + c.amount, 0);

  const nextDueContribution = pendingContributions
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] || null;

  // Load pending contributions on mount
  useEffect(() => {
    if (user) {
      loadPendingContributions();
    }
  }, [user]);

  return {
    // State
    contributions,
    pendingContributions,
    schedule,
    stats,
    affordability,
    isLoading,
    error,

    // Contribution Actions
    loadContributions,
    loadPendingContributions,
    loadCircleSchedule,
    processPayment,

    // Affordability Actions
    checkAffordability,
    getRecommendedAmount,

    // Helpers
    getStatusLabel,
    getStatusColor,
    formatAmount,
    formatDueDate,
    getDaysUntilDue,
    isOverdue,
    isInGracePeriod,
    getFrequencyLabel,
    normalizeToMonthly,

    // Computed
    totalPending,
    totalDueThisWeek,
    nextDueContribution,
  };
};

export default useContributions;

// ============================================================================
// ADDITIONAL HOOKS
// ============================================================================

/**
 * Hook for checking contribution affordability in join circle flow
 */
export const useAffordabilityCheck = () => {
  const { user } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (amount: number, frequency: ContributionFrequency) => {
    if (!user) {
      setError("Not authenticated");
      return null;
    }

    setIsChecking(true);
    setError(null);

    try {
      const affordabilityResult = await contributionAffordabilityService.checkAffordability(
        user.id,
        amount,
        frequency
      );
      setResult(affordabilityResult);
      return affordabilityResult;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [user]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    check,
    reset,
    isChecking,
    result,
    error,
    canAfford: result?.canAfford ?? null,
    decision: result?.decision ?? null,
  };
};

/**
 * Hook for upcoming contribution reminders
 */
export const useUpcomingContributions = (daysAhead: number = 7) => {
  const { pendingContributions, loadPendingContributions, getDaysUntilDue, formatAmount, formatDueDate } =
    useContributions();

  const upcoming = pendingContributions
    .filter((c) => {
      const daysUntil = getDaysUntilDue(c.dueDate);
      return daysUntil >= 0 && daysUntil <= daysAhead;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const overdue = pendingContributions
    .filter((c) => getDaysUntilDue(c.dueDate) < 0)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const totalUpcoming = upcoming.reduce((sum, c) => sum + c.amount, 0);
  const totalOverdue = overdue.reduce((sum, c) => sum + c.amount, 0);

  return {
    upcoming,
    overdue,
    totalUpcoming,
    totalOverdue,
    hasOverdue: overdue.length > 0,
    refresh: loadPendingContributions,
    formatAmount,
    formatDueDate,
    getDaysUntilDue,
  };
};
