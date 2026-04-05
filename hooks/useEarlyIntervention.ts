// ══════════════════════════════════════════════════════════════════════════════
// Early Intervention Hooks — React hooks for intervention system
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  EarlyInterventionEngine,
  type MemberIntervention,
  type InterventionLevel,
  type InterventionStatus,
  type InterventionChannel,
  type InterventionLanguage,
  type InterventionOption,
  type InterventionTemplate,
  type InterventionRule,
  type InterventionDashboardRow,
  type InterventionTone,
  type MemberDefaultContext,
} from "../services/EarlyInterventionEngine";
import { useAuth } from "../context/AuthContext";

// Re-export types
export type {
  MemberIntervention,
  InterventionLevel,
  InterventionStatus,
  InterventionChannel,
  InterventionLanguage,
  InterventionOption,
  InterventionTemplate,
  InterventionRule,
  InterventionDashboardRow,
  InterventionTone,
  MemberDefaultContext,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useActiveIntervention — Show in-app intervention banner/card
// ═══════════════════════════════════════════════════════════════════════════════

export function useActiveIntervention() {
  const { user } = useAuth();
  const [intervention, setIntervention] = useState<MemberIntervention | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await EarlyInterventionEngine.getLatestPendingIntervention(user.id);
      setIntervention(data);
    } catch (err) {
      console.error("useActiveIntervention error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const sub = EarlyInterventionEngine.subscribeToInterventions(user.id, (updated) => {
      if (["sent", "viewed", "engaged"].includes(updated.status)) {
        setIntervention(updated);
      } else {
        setIntervention(null); // Resolved/expired/escalated — clear banner
      }
    });
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  // Actions
  const markViewed = useCallback(async () => {
    if (!intervention) return;
    await EarlyInterventionEngine.markViewed(intervention.id);
    setIntervention(prev => prev ? { ...prev, status: "viewed" } : null);
  }, [intervention]);

  const markEngaged = useCallback(async () => {
    if (!intervention) return;
    await EarlyInterventionEngine.markEngaged(intervention.id);
    setIntervention(prev => prev ? { ...prev, status: "engaged" } : null);
  }, [intervention]);

  const respondWithAction = useCallback(async (action: string) => {
    if (!intervention) return;
    const updated = await EarlyInterventionEngine.recordResponse(intervention.id, action);
    setIntervention(updated.status === "paid" || updated.status === "accepted" ? null : updated);
    return updated;
  }, [intervention]);

  // Computed
  const hasIntervention = intervention !== null;
  const isLevel1 = intervention?.level === 1;
  const isLevel2 = intervention?.level === 2;
  const hasOptions = (intervention?.optionsOffered?.length ?? 0) > 0;

  return {
    intervention, hasIntervention, isLevel1, isLevel2, hasOptions,
    loading, markViewed, markEngaged, respondWithAction, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useInterventionHistory — Member's past interventions
// ═══════════════════════════════════════════════════════════════════════════════

export function useInterventionHistory() {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState<MemberIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await EarlyInterventionEngine.getMemberInterventions(user.id);
      setInterventions(data);
    } catch (err) {
      console.error("useInterventionHistory error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Computed
  const totalInterventions = interventions.length;
  const defaultsPrevented = interventions.filter(i => i.defaultPrevented === true).length;
  const preventionRate = totalInterventions > 0 ? Math.round((defaultsPrevented / totalInterventions) * 100) : 0;

  return { interventions, totalInterventions, defaultsPrevented, preventionRate, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useInterventionDashboard — Admin dashboard stats
// ═══════════════════════════════════════════════════════════════════════════════

export function useInterventionDashboard() {
  const [dashboard, setDashboard] = useState<InterventionDashboardRow[]>([]);
  const [effectiveness, setEffectiveness] = useState<Awaited<ReturnType<typeof EarlyInterventionEngine.getEffectivenessMetrics>> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dashData, effData] = await Promise.all([
        EarlyInterventionEngine.getDashboard(),
        EarlyInterventionEngine.getEffectivenessMetrics(),
      ]);
      setDashboard(dashData);
      setEffectiveness(effData);
    } catch (err) {
      console.error("useInterventionDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, effectiveness, loading, refresh: fetch };
}
