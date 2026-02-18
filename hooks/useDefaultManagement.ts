/**
 * useDefaultManagement Hook
 *
 * A React hook for managing defaults, grace periods, and resolutions.
 * Provides easy access to default cascade functionality for UI components.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  defaultCascadeService,
  Default,
  GracePeriod,
  DefaultImpact,
  CoverageResult,
  DefaultResolution,
  ResolutionMethod,
} from "../services/DefaultCascadeService";
import { supabase } from "../lib/supabase";

export interface UserDefaultSummary {
  totalDefaults: number;
  unresolvedDefaults: number;
  totalOwed: number;
  inGracePeriod: number;
  communityStanding: "good" | "warning" | "suspended" | "removed";
}

export interface UseDefaultManagementResult {
  // User's defaults
  myDefaults: Default[];
  myGracePeriods: GracePeriod[];
  summary: UserDefaultSummary | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadMyDefaults: () => Promise<void>;
  resolveDefault: (
    defaultId: string,
    method: ResolutionMethod,
    amount: number,
    notes?: string
  ) => Promise<DefaultResolution | null>;
  requestGraceExtension: (gracePeriodId: string, reason: string) => Promise<boolean>;
  disputeDefault: (defaultId: string, reason: string) => Promise<boolean>;

  // Payment plan
  createPaymentPlan: (
    defaultId: string,
    numInstallments: number,
    frequency: "weekly" | "biweekly" | "monthly"
  ) => Promise<{ success: boolean; planId?: string }>;
  makePayment: (
    defaultId: string,
    amount: number,
    paymentMethod: string
  ) => Promise<{ success: boolean; remaining?: number }>;

  // Status helpers
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  getDaysUntilGraceExpiry: (gracePeriod: GracePeriod) => number;
  canExtendGracePeriod: (gracePeriod: GracePeriod) => boolean;

  // Refresh
  refresh: () => Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  unresolved: "#EF4444",
  grace_period: "#F59E0B",
  covered: "#3B82F6",
  resolved: "#10B981",
  written_off: "#6B7280",
  disputed: "#8B5CF6",
};

const STATUS_LABELS: Record<string, string> = {
  unresolved: "Unresolved",
  grace_period: "Grace Period",
  covered: "Covered",
  resolved: "Resolved",
  written_off: "Written Off",
  disputed: "Under Dispute",
};

export const useDefaultManagement = (): UseDefaultManagementResult => {
  const { user } = useAuth();

  const [myDefaults, setMyDefaults] = useState<Default[]>([]);
  const [myGracePeriods, setMyGracePeriods] = useState<GracePeriod[]>([]);
  const [summary, setSummary] = useState<UserDefaultSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's defaults
  const loadMyDefaults = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch defaults
      const { data: defaults, error: defaultsError } = await supabase
        .from("defaults")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (defaultsError) throw defaultsError;

      const transformedDefaults: Default[] = (defaults || []).map((d) => ({
        id: d.id,
        userId: d.user_id,
        circleId: d.circle_id,
        communityId: d.community_id,
        cycleNumber: d.cycle_number,
        amount: parseFloat(d.amount) || 0,
        currency: d.currency || "USD",
        status: d.status,
        coveredByReserve: d.covered_by_reserve || false,
        coveredAmount: parseFloat(d.covered_amount) || 0,
        recoveredAmount: parseFloat(d.recovered_amount) || 0,
        resolvedAt: d.resolved_at,
        resolutionMethod: d.resolution_method,
        resolutionNotes: d.resolution_notes,
        createdAt: d.created_at,
      }));

      setMyDefaults(transformedDefaults);

      // Fetch grace periods
      const defaultIds = transformedDefaults.map((d) => d.id);
      if (defaultIds.length > 0) {
        const { data: gracePeriods } = await supabase
          .from("default_grace_periods")
          .select("*")
          .in("default_id", defaultIds)
          .eq("status", "active");

        setMyGracePeriods(
          (gracePeriods || []).map((gp) => ({
            id: gp.id,
            defaultId: gp.default_id,
            userId: gp.user_id,
            circleId: gp.circle_id,
            gracePeriodDays: gp.grace_period_days,
            startedAt: gp.started_at,
            expiresAt: gp.expires_at,
            status: gp.status,
            extensionCount: gp.extension_count || 0,
            remindersSent: gp.reminders_sent || 0,
          }))
        );
      }

      // Calculate summary
      const unresolvedDefaults = transformedDefaults.filter((d) =>
        ["unresolved", "grace_period"].includes(d.status)
      );
      const totalOwed = unresolvedDefaults.reduce(
        (sum, d) => sum + (d.amount - d.coveredAmount - d.recoveredAmount),
        0
      );
      const inGracePeriod = transformedDefaults.filter(
        (d) => d.status === "grace_period"
      ).length;

      // Determine standing
      let standing: UserDefaultSummary["communityStanding"] = "good";
      if (unresolvedDefaults.length >= 3) {
        standing = "removed";
      } else if (unresolvedDefaults.length >= 2) {
        standing = "suspended";
      } else if (unresolvedDefaults.length >= 1) {
        standing = "warning";
      }

      setSummary({
        totalDefaults: transformedDefaults.length,
        unresolvedDefaults: unresolvedDefaults.length,
        totalOwed,
        inGracePeriod,
        communityStanding: standing,
      });
    } catch (err: any) {
      setError(err.message);
      console.error("Error loading defaults:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Resolve a default
  const resolveDefault = useCallback(
    async (
      defaultId: string,
      method: ResolutionMethod,
      amount: number,
      notes?: string
    ): Promise<DefaultResolution | null> => {
      try {
        const resolution = await defaultCascadeService.resolveDefault(
          defaultId,
          method,
          amount,
          notes
        );
        await loadMyDefaults(); // Refresh
        return resolution;
      } catch (err: any) {
        setError(err.message);
        return null;
      }
    },
    [loadMyDefaults]
  );

  // Request grace period extension
  const requestGraceExtension = useCallback(
    async (gracePeriodId: string, reason: string): Promise<boolean> => {
      if (!user) return false;

      try {
        await defaultCascadeService.extendGracePeriod(gracePeriodId, user.id, reason);
        await loadMyDefaults(); // Refresh
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [user, loadMyDefaults]
  );

  // Dispute a default
  const disputeDefault = useCallback(
    async (defaultId: string, reason: string): Promise<boolean> => {
      if (!user) return false;

      try {
        // Get default details
        const defaultRecord = myDefaults.find((d) => d.id === defaultId);
        if (!defaultRecord) return false;

        // Update default status
        await supabase
          .from("defaults")
          .update({ status: "disputed" })
          .eq("id", defaultId);

        // Create dispute record
        await supabase.from("disputes").insert({
          reporter_user_id: user.id,
          community_id: defaultRecord.communityId,
          circle_id: defaultRecord.circleId,
          default_id: defaultId,
          type: "default_dispute",
          title: "Default Dispute",
          description: reason,
          priority: "high",
          status: "open",
        });

        await loadMyDefaults(); // Refresh
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [user, myDefaults, loadMyDefaults]
  );

  // Create payment plan
  const createPaymentPlan = useCallback(
    async (
      defaultId: string,
      numInstallments: number,
      frequency: "weekly" | "biweekly" | "monthly"
    ): Promise<{ success: boolean; planId?: string }> => {
      if (!user) return { success: false };

      try {
        const defaultRecord = myDefaults.find((d) => d.id === defaultId);
        if (!defaultRecord) return { success: false };

        const totalAmount =
          defaultRecord.amount - defaultRecord.coveredAmount - defaultRecord.recoveredAmount;
        const installmentAmount = totalAmount / numInstallments;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() + 7); // Start in 1 week

        const { data: plan, error: planError } = await supabase
          .from("default_payment_plans")
          .insert({
            default_id: defaultId,
            user_id: user.id,
            total_amount: totalAmount,
            num_installments: numInstallments,
            installment_amount: installmentAmount,
            frequency,
            start_date: startDate.toISOString().split("T")[0],
            next_payment_date: startDate.toISOString().split("T")[0],
            status: "active",
          })
          .select()
          .single();

        if (planError) throw planError;

        // Create installment records
        const installments = [];
        const dueDate = new Date(startDate);

        for (let i = 1; i <= numInstallments; i++) {
          installments.push({
            payment_plan_id: plan.id,
            installment_number: i,
            amount_due: installmentAmount,
            due_date: dueDate.toISOString().split("T")[0],
            status: "pending",
          });

          // Advance due date based on frequency
          if (frequency === "weekly") {
            dueDate.setDate(dueDate.getDate() + 7);
          } else if (frequency === "biweekly") {
            dueDate.setDate(dueDate.getDate() + 14);
          } else {
            dueDate.setMonth(dueDate.getMonth() + 1);
          }
        }

        await supabase.from("payment_plan_installments").insert(installments);

        await loadMyDefaults(); // Refresh
        return { success: true, planId: plan.id };
      } catch (err: any) {
        setError(err.message);
        return { success: false };
      }
    },
    [user, myDefaults, loadMyDefaults]
  );

  // Make a payment
  const makePayment = useCallback(
    async (
      defaultId: string,
      amount: number,
      paymentMethod: string
    ): Promise<{ success: boolean; remaining?: number }> => {
      try {
        // Use RPC function for atomic payment processing
        const { data, error: rpcError } = await supabase.rpc("process_default_payment", {
          p_default_id: defaultId,
          p_amount: amount,
          p_payment_method: paymentMethod,
          p_transaction_id: null,
        });

        if (rpcError) throw rpcError;

        await loadMyDefaults(); // Refresh
        return {
          success: data?.[0]?.success ?? false,
          remaining: data?.[0]?.remaining_amount ?? undefined,
        };
      } catch (err: any) {
        setError(err.message);
        return { success: false };
      }
    },
    [loadMyDefaults]
  );

  // Status helpers
  const getStatusColor = (status: string): string => {
    return STATUS_COLORS[status] || "#6B7280";
  };

  const getStatusLabel = (status: string): string => {
    return STATUS_LABELS[status] || status;
  };

  const getDaysUntilGraceExpiry = (gracePeriod: GracePeriod): number => {
    const now = new Date();
    const expiry = new Date(gracePeriod.expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const canExtendGracePeriod = (gracePeriod: GracePeriod): boolean => {
    return gracePeriod.extensionCount < 2 && gracePeriod.status === "active";
  };

  // Refresh
  const refresh = useCallback(async () => {
    await loadMyDefaults();
  }, [loadMyDefaults]);

  // Load on mount
  useEffect(() => {
    if (user) {
      loadMyDefaults();
    }
  }, [user]);

  return {
    myDefaults,
    myGracePeriods,
    summary,
    isLoading,
    error,
    loadMyDefaults,
    resolveDefault,
    requestGraceExtension,
    disputeDefault,
    createPaymentPlan,
    makePayment,
    getStatusColor,
    getStatusLabel,
    getDaysUntilGraceExpiry,
    canExtendGracePeriod,
    refresh,
  };
};

export default useDefaultManagement;
