/**
 * ══════════════════════════════════════════════════════════════════════════════
 * AML MONITORING HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the AML monitoring engine.
 * 5 hooks: useAmlStatus, useAmlAlerts, useAlertDetails, useAmlStats, useAmlActions
 *
 * CRITICAL: AML data is service_role only. These hooks are for compliance
 * officers / admin dashboards ONLY — never for member-facing screens.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AmlMonitoringEngine,
  type RuleCode,
  type RuleCategory,
  type AlertSeverity,
  type AlertStatus,
  type AlertResolution,
  type AmlStatus,
  type ReviewAction,
  type SarStatus,
  type TriggerEvent,
  type AutoAction,
  type AmlRule,
  type AmlAlert,
  type AmlReview,
  type SarFiling,
  type RuleEvaluationResult,
  type AlertCreateResult,
  type BatchScanResult,
  type AmlStats,
} from '@/services/AmlMonitoringEngine';

// Re-export all types for consumer convenience
export type {
  RuleCode,
  RuleCategory,
  AlertSeverity,
  AlertStatus,
  AlertResolution,
  AmlStatus,
  ReviewAction,
  SarStatus,
  TriggerEvent,
  AutoAction,
  AmlRule,
  AmlAlert,
  AmlReview,
  SarFiling,
  RuleEvaluationResult,
  AlertCreateResult,
  BatchScanResult,
  AmlStats,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useAmlStatus — Member's current AML status
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmlStatus(userId?: string) {
  const [amlStatus, setAmlStatus] = useState<AmlStatus | null>(null);
  const [restrictionReason, setRestrictionReason] = useState<string | null>(null);
  const [lastAmlCheck, setLastAmlCheck] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!userId) {
      setAmlStatus(null);
      setRestrictionReason(null);
      setLastAmlCheck(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await AmlMonitoringEngine.getAmlStatus(userId);
      setAmlStatus(result.amlStatus);
      setRestrictionReason(result.restrictionReason);
      setLastAmlCheck(result.lastAmlCheck);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AML status');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Realtime subscription on profiles table
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`aml-status-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        () => { fetchStatus(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchStatus]);

  // Computed values
  const isClear = useMemo(() => amlStatus === 'clear', [amlStatus]);
  const isEnhancedMonitoring = useMemo(() => amlStatus === 'enhanced_monitoring', [amlStatus]);
  const isRestricted = useMemo(() => amlStatus === 'restricted', [amlStatus]);
  const isFrozen = useMemo(() => amlStatus === 'frozen', [amlStatus]);

  return {
    amlStatus,
    restrictionReason,
    lastAmlCheck,
    loading,
    error,
    refetch: fetchStatus,
    isClear,
    isEnhancedMonitoring,
    isRestricted,
    isFrozen,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useAmlAlerts — Alert list for compliance dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmlAlerts(filters?: {
  status?: AlertStatus;
  severity?: AlertSeverity;
  memberId?: string;
  ruleCode?: RuleCode;
  limit?: number;
}) {
  const [alerts, setAlerts] = useState<AmlAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AmlMonitoringEngine.getAlerts(filters);
      setAlerts(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AML alerts');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.severity, filters?.memberId, filters?.ruleCode, filters?.limit]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Realtime subscription on aml_alerts
  useEffect(() => {
    const channel = AmlMonitoringEngine.subscribeToAlerts(() => {
      fetchAlerts();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAlerts]);

  // Computed
  const openCount = useMemo(
    () => alerts.filter(a => a.status === 'open').length,
    [alerts]
  );

  const highSeverityCount = useMemo(
    () => alerts.filter(a => a.severity === 'high' || a.severity === 'critical').length,
    [alerts]
  );

  const pendingReviewCount = useMemo(
    () => alerts.filter(a => a.status === 'open' || a.status === 'reviewing').length,
    [alerts]
  );

  return {
    alerts,
    loading,
    error,
    refetch: fetchAlerts,
    openCount,
    highSeverityCount,
    pendingReviewCount,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useAlertDetails — Single alert with reviews
// ═══════════════════════════════════════════════════════════════════════════════

export function useAlertDetails(alertId?: string) {
  const [alert, setAlert] = useState<AmlAlert | null>(null);
  const [reviews, setReviews] = useState<AmlReview[]>([]);
  const [rule, setRule] = useState<AmlRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!alertId) {
      setAlert(null);
      setReviews([]);
      setRule(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await AmlMonitoringEngine.getAlertDetails(alertId);
      if (result) {
        setAlert(result.alert);
        setReviews(result.reviews);
        setRule(result.rule);
      } else {
        setAlert(null);
        setReviews([]);
        setRule(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch alert details');
    } finally {
      setLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Computed
  const reviewCount = useMemo(() => reviews.length, [reviews]);
  const latestReview = useMemo(() => reviews[reviews.length - 1] || null, [reviews]);

  return {
    alert,
    reviews,
    rule,
    loading,
    error,
    refetch: fetchDetails,
    reviewCount,
    latestReview,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useAmlStats — Aggregate AML statistics
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmlStats() {
  const [stats, setStats] = useState<AmlStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AmlMonitoringEngine.getAmlStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AML stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useAmlActions — Action callbacks for triggering operations
// ═══════════════════════════════════════════════════════════════════════════════

export function useAmlActions() {
  const [evaluatingLoading, setEvaluatingLoading] = useState(false);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [resolvingLoading, setResolvingLoading] = useState(false);
  const [escalatingLoading, setEscalatingLoading] = useState(false);
  const [liftingLoading, setLiftingLoading] = useState(false);
  const [sarInitLoading, setSarInitLoading] = useState(false);
  const [sarSubmitLoading, setSarSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluateTransaction = useCallback(async (
    userId: string,
    transactionType: TriggerEvent,
    amount: number,
    transactionId?: string
  ): Promise<AlertCreateResult[]> => {
    try {
      setEvaluatingLoading(true);
      setError(null);
      return await AmlMonitoringEngine.evaluateTransaction(userId, transactionType, amount, transactionId);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate transaction');
      return [];
    } finally {
      setEvaluatingLoading(false);
    }
  }, []);

  const assignAlert = useCallback(async (
    alertId: string,
    assigneeId: string
  ): Promise<boolean> => {
    try {
      setAssigningLoading(true);
      setError(null);
      await AmlMonitoringEngine.assignAlert(alertId, assigneeId);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to assign alert');
      return false;
    } finally {
      setAssigningLoading(false);
    }
  }, []);

  const resolveAlert = useCallback(async (
    alertId: string,
    reviewerId: string,
    resolution: AlertResolution,
    notes: string
  ): Promise<boolean> => {
    try {
      setResolvingLoading(true);
      setError(null);
      await AmlMonitoringEngine.resolveAlert(alertId, reviewerId, resolution, notes);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to resolve alert');
      return false;
    } finally {
      setResolvingLoading(false);
    }
  }, []);

  const escalateAlert = useCallback(async (
    alertId: string,
    reviewerId: string,
    notes: string
  ): Promise<boolean> => {
    try {
      setEscalatingLoading(true);
      setError(null);
      await AmlMonitoringEngine.escalateAlert(alertId, reviewerId, notes);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to escalate alert');
      return false;
    } finally {
      setEscalatingLoading(false);
    }
  }, []);

  const liftRestriction = useCallback(async (
    userId: string,
    reviewerId: string,
    alertId: string,
    notes: string
  ): Promise<boolean> => {
    try {
      setLiftingLoading(true);
      setError(null);
      await AmlMonitoringEngine.liftRestriction(userId, reviewerId, alertId, notes);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to lift restriction');
      return false;
    } finally {
      setLiftingLoading(false);
    }
  }, []);

  const initiateSar = useCallback(async (
    alertId: string,
    filedBy: string,
    summary: string,
    totalAmount: number,
    periodStart: string,
    periodEnd: string
  ): Promise<SarFiling | null> => {
    try {
      setSarInitLoading(true);
      setError(null);
      return await AmlMonitoringEngine.initiateSar(
        alertId, filedBy, summary, totalAmount, periodStart, periodEnd
      );
    } catch (err: any) {
      setError(err.message || 'Failed to initiate SAR');
      return null;
    } finally {
      setSarInitLoading(false);
    }
  }, []);

  const submitSar = useCallback(async (
    sarId: string,
    filingReference: string,
    fincenConfirmation?: string
  ): Promise<boolean> => {
    try {
      setSarSubmitLoading(true);
      setError(null);
      await AmlMonitoringEngine.submitSar(sarId, filingReference, fincenConfirmation);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to submit SAR');
      return false;
    } finally {
      setSarSubmitLoading(false);
    }
  }, []);

  return {
    evaluateTransaction,
    assignAlert,
    resolveAlert,
    escalateAlert,
    liftRestriction,
    initiateSar,
    submitSar,
    evaluatingLoading,
    assigningLoading,
    resolvingLoading,
    escalatingLoading,
    liftingLoading,
    sarInitLoading,
    sarSubmitLoading,
    error,
  };
}
