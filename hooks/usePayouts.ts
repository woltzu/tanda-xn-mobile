/**
 * usePayouts Hook
 *
 * A React hook for managing payouts, payout methods, and withdrawal requests.
 * Provides easy-to-use functions for the payout UI components.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  payoutService,
  Payout,
  PayoutSchedule,
  PayoutMethodDetails as PayoutMethod,
  PayoutRequest,
  PayoutEligibility,
  CirclePayoutSummary,
  RotationMethod,
} from "../services/PayoutService";

export interface UsePayoutsResult {
  // State
  payouts: Payout[];
  upcomingPayouts: Payout[];
  payoutMethods: PayoutMethod[];
  defaultPayoutMethod: PayoutMethod | null;
  payoutRequests: PayoutRequest[];
  isLoading: boolean;
  error: string | null;

  // Payout Actions
  loadUserPayouts: () => Promise<void>;
  loadUpcomingPayouts: () => Promise<void>;
  getCircleSummary: (circleId: string) => Promise<CirclePayoutSummary | null>;
  checkEligibility: (circleId: string, cycleNumber: number) => Promise<PayoutEligibility | null>;

  // Payout Method Actions
  loadPayoutMethods: () => Promise<void>;
  addPayoutMethod: (method: Omit<PayoutMethod, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<PayoutMethod | null>;
  updatePayoutMethod: (methodId: string, updates: Partial<PayoutMethod>) => Promise<boolean>;
  deletePayoutMethod: (methodId: string) => Promise<boolean>;
  setDefaultPayoutMethod: (methodId: string) => Promise<boolean>;

  // Withdrawal/Request Actions
  loadPayoutRequests: () => Promise<void>;
  requestWithdrawal: (payoutId: string, methodId: string) => Promise<PayoutRequest | null>;
  cancelWithdrawalRequest: (requestId: string) => Promise<boolean>;

  // Computed values
  totalReceived: number;
  pendingAmount: number;
  nextPayoutDate: Date | null;
  hasDefaultMethod: boolean;

  // Helpers
  getPayoutStatusLabel: (status: Payout["status"]) => string;
  getPayoutStatusColor: (status: Payout["status"]) => string;
  getMethodTypeLabel: (type: PayoutMethod["methodType"]) => string;
  getMethodTypeIcon: (type: PayoutMethod["methodType"]) => string;
  formatPayoutAmount: (amount: number, currency?: string) => string;
}

const PAYOUT_STATUS_LABELS: Record<Payout["status"], string> = {
  scheduled: "Scheduled",
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const PAYOUT_STATUS_COLORS: Record<Payout["status"], string> = {
  scheduled: "#6B7280", // gray
  pending: "#F59E0B", // amber
  processing: "#3B82F6", // blue
  completed: "#10B981", // green
  failed: "#EF4444", // red
  cancelled: "#9CA3AF", // gray-400
};

const METHOD_TYPE_LABELS: Record<PayoutMethod["methodType"], string> = {
  wallet: "TandaXn Wallet",
  bank_transfer: "Bank Transfer",
  mobile_money: "Mobile Money",
  card: "Debit Card",
  cash: "Cash Pickup",
};

const METHOD_TYPE_ICONS: Record<PayoutMethod["methodType"], string> = {
  wallet: "wallet",
  bank_transfer: "business",
  mobile_money: "phone-portrait",
  card: "card",
  cash: "cash",
};

export const usePayouts = (): UsePayoutsResult => {
  const { user } = useAuth();

  // State
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [upcomingPayouts, setUpcomingPayouts] = useState<Payout[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's payout history
  const loadUserPayouts = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const userPayouts = await payoutService.getUserPayouts(user.id);
      setPayouts(userPayouts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load upcoming payouts
  const loadUpcomingPayouts = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const upcoming = await payoutService.getUpcomingPayouts(user.id);
      setUpcomingPayouts(upcoming);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Get circle payout summary
  const getCircleSummary = useCallback(
    async (circleId: string): Promise<CirclePayoutSummary | null> => {
      try {
        return await payoutService.getCirclePayoutSummary(circleId);
      } catch (err: any) {
        console.error("Error getting circle summary:", err);
        return null;
      }
    },
    []
  );

  // Check payout eligibility
  const checkEligibility = useCallback(
    async (circleId: string, cycleNumber: number): Promise<PayoutEligibility | null> => {
      try {
        return await payoutService.checkPayoutEligibility(circleId, cycleNumber);
      } catch (err: any) {
        console.error("Error checking eligibility:", err);
        return null;
      }
    },
    []
  );

  // Load payout methods
  const loadPayoutMethods = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const methods = await payoutService.getUserPayoutMethods(user.id);
      setPayoutMethods(methods);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Add payout method
  const addPayoutMethod = useCallback(
    async (
      method: Omit<PayoutMethod, "id" | "userId" | "createdAt" | "updatedAt">
    ): Promise<PayoutMethod | null> => {
      if (!user) return null;

      setIsLoading(true);
      setError(null);

      try {
        const newMethod = await payoutService.addPayoutMethod(user.id, method);
        setPayoutMethods((prev) => [...prev, newMethod]);
        return newMethod;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Update payout method
  const updatePayoutMethod = useCallback(
    async (methodId: string, updates: Partial<PayoutMethod>): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await payoutService.updatePayoutMethod(methodId, updates);
        setPayoutMethods((prev) =>
          prev.map((m) => (m.id === methodId ? { ...m, ...updates } : m))
        );
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Delete payout method
  const deletePayoutMethod = useCallback(async (methodId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await payoutService.deletePayoutMethod(methodId);
      setPayoutMethods((prev) => prev.filter((m) => m.id !== methodId));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Set default payout method
  const setDefaultPayoutMethod = useCallback(
    async (methodId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        await payoutService.setDefaultPayoutMethod(methodId);
        setPayoutMethods((prev) =>
          prev.map((m) => ({
            ...m,
            isDefault: m.id === methodId,
          }))
        );
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load payout requests
  const loadPayoutRequests = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const requests = await payoutService.getUserPayoutRequests(user.id);
      setPayoutRequests(requests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Request withdrawal
  const requestWithdrawal = useCallback(
    async (payoutId: string, methodId: string): Promise<PayoutRequest | null> => {
      if (!user) return null;

      setIsLoading(true);
      setError(null);

      try {
        const request = await payoutService.requestWithdrawal(user.id, payoutId, methodId);
        setPayoutRequests((prev) => [request, ...prev]);
        return request;
      } catch (err: any) {
        setError(err.message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  // Cancel withdrawal request
  const cancelWithdrawalRequest = useCallback(async (requestId: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      await payoutService.cancelPayoutRequest(requestId);
      setPayoutRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "cancelled" } : r))
      );
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadUserPayouts();
      loadUpcomingPayouts();
      loadPayoutMethods();
    }
  }, [user]);

  // Computed values
  const totalReceived = payouts
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingAmount = payouts
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  const nextPayoutDate =
    upcomingPayouts.length > 0 ? new Date(upcomingPayouts[0].scheduledDate!) : null;

  const defaultPayoutMethod = payoutMethods.find((m) => m.isDefault) || null;
  const hasDefaultMethod = defaultPayoutMethod !== null;

  // Helper functions
  const getPayoutStatusLabel = (status: Payout["status"]): string => {
    return PAYOUT_STATUS_LABELS[status];
  };

  const getPayoutStatusColor = (status: Payout["status"]): string => {
    return PAYOUT_STATUS_COLORS[status];
  };

  const getMethodTypeLabel = (type: PayoutMethod["methodType"]): string => {
    return METHOD_TYPE_LABELS[type];
  };

  const getMethodTypeIcon = (type: PayoutMethod["methodType"]): string => {
    return METHOD_TYPE_ICONS[type];
  };

  const formatPayoutAmount = (amount: number, currency: string = "XAF"): string => {
    return new Intl.NumberFormat("fr-CM", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return {
    // State
    payouts,
    upcomingPayouts,
    payoutMethods,
    defaultPayoutMethod,
    payoutRequests,
    isLoading,
    error,

    // Payout Actions
    loadUserPayouts,
    loadUpcomingPayouts,
    getCircleSummary,
    checkEligibility,

    // Payout Method Actions
    loadPayoutMethods,
    addPayoutMethod,
    updatePayoutMethod,
    deletePayoutMethod,
    setDefaultPayoutMethod,

    // Withdrawal/Request Actions
    loadPayoutRequests,
    requestWithdrawal,
    cancelWithdrawalRequest,

    // Computed values
    totalReceived,
    pendingAmount,
    nextPayoutDate,
    hasDefaultMethod,

    // Helpers
    getPayoutStatusLabel,
    getPayoutStatusColor,
    getMethodTypeLabel,
    getMethodTypeIcon,
    formatPayoutAmount,
  };
};

export default usePayouts;
