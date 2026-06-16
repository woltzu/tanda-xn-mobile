// ══════════════════════════════════════════════════════════════════════════════
// Conflict Prediction Hooks — Feature #35
// ══════════════════════════════════════════════════════════════════════════════
//
// ⚠ Architecture note (Conflict P0, 2026-06-12)
// ──────────────────────────────────────────────────────────────────────────────
// This module is **Universe A** — the AI/heuristic conflict prediction layer.
// It reads from:
//   - conflict_history                   (engine-logged conflict events)
//   - conflict_prediction_dashboard      (rolled-up dashboard rows)
//   - circle_formation_flags             (pre-circle friction flags)
//   - post_formation_monitor             (live monitoring rows)
// and writes via `ConflictPredictionEngine` (logConflict / resolveConflict /
// reviewFormationFlag / manualFlagPair).
//
// **It does NOT read or write `disputes` or `mediation_cases`.** Those tables
// belong to **Universe B**, owned by `context/ElderContext.tsx` (member-
// reported disputes, elder mediation workflow).
//
// A member who taps "Report a member" in CircleDetail writes a row to
// `disputes` — that row is INVISIBLE here. Conversely, an AI-flagged
// formation issue surfaced here never lands in `disputes` until a human
// elder turns it into one manually.
//
// The two universes will be unified into a single `circle_conflicts` table
// with a `kind` enum in P2. Until then, treat each module as authoritative
// for its own table set and DO NOT cross-write. See
// `docs/architecture/conflict_resolution.md` for the consolidation plan.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ConflictPredictionEngine,
  type PairScore,
  type FormationFlag,
  type FormationEvaluation,
  type PostFormationMonitor,
  type ConflictRecord,
  type ConflictDashboardRow,
  type FrictionTier,
  type ConflictType,
  type ConflictSeverity,
  type ConflictSource,
  type ReviewOutcome,
  type FactorBreakdown,
  type FlaggedPairSummary,
} from "../services/ConflictPredictionEngine";

export type {
  PairScore, FormationFlag, FormationEvaluation, PostFormationMonitor,
  ConflictRecord, ConflictDashboardRow, FrictionTier, ConflictType,
  ConflictSeverity, ConflictSource, ReviewOutcome, FactorBreakdown,
  FlaggedPairSummary,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useCircleFormationCheck — Run pairwise check before circle formation
// ═══════════════════════════════════════════════════════════════════════════════

export function useCircleFormationCheck() {
  const [evaluation, setEvaluation] = useState<FormationEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const evaluateFormation = useCallback(async (
    proposedMemberIds: string[],
    circleId?: string
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ConflictPredictionEngine.evaluateCircleFormation(
        proposedMemberIds, circleId
      );
      setEvaluation(result);
      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const canProceed = evaluation?.canProceed ?? true;
  const requiresReview = evaluation?.requiresReview ?? false;
  const circleTier = evaluation?.circleTier ?? "clear";
  const flaggedCount = evaluation?.flaggedPairs.length ?? 0;
  const highestScore = evaluation?.highestScore ?? 0;

  return {
    evaluation, canProceed, requiresReview, circleTier,
    flaggedCount, highestScore,
    evaluateFormation, loading, error,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useFormationReview — Admin review queue for flagged formations
// ═══════════════════════════════════════════════════════════════════════════════

export function useFormationReview() {
  const [pendingReviews, setPendingReviews] = useState<FormationFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ConflictPredictionEngine.getPendingReviews();
      setPendingReviews(data);
    } catch (err) {
      console.error("useFormationReview error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime updates
  useEffect(() => {
    const sub = ConflictPredictionEngine.subscribeToFormationFlags((flag) => {
      if (flag.requiresReview && !flag.reviewedAt) {
        setPendingReviews(prev => {
          const idx = prev.findIndex(f => f.id === flag.id);
          if (idx >= 0) { const u = [...prev]; u[idx] = flag; return u; }
          return [flag, ...prev];
        });
      } else {
        setPendingReviews(prev => prev.filter(f => f.id !== flag.id));
      }
    });
    return () => { sub.unsubscribe(); };
  }, []);

  const reviewFormation = useCallback(async (
    flagId: string,
    reviewerId: string,
    outcome: ReviewOutcome,
    notes?: string
  ) => {
    const result = await ConflictPredictionEngine.reviewFormationFlag(
      flagId, reviewerId, outcome, notes
    );
    setPendingReviews(prev => prev.filter(f => f.id !== flagId));
    return result;
  }, []);

  return {
    pendingReviews, reviewFormation, loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Module-level 5-minute caches (P0 — mirrors useAdvanceDashboard /
// useScoreHub / useUpcomingEvents). Keyed by the natural id each hook
// already keys its fetch on. `refresh()` busts the cache; `useFocusEffect`
// re-enters the cheap cached path on screen focus.
// ═══════════════════════════════════════════════════════════════════════════════

const CONFLICT_CACHE_TTL_MS = 5 * 60 * 1000;

type MonitorCacheEntry = {
  circleId: string;
  monitors: PostFormationMonitor[];
  fetchedAt: number;
};
let monitorCache: MonitorCacheEntry | null = null;
function bustMonitorCache() {
  monitorCache = null;
}

type HistoryCacheEntry = {
  memberId: string;
  conflicts: ConflictRecord[];
  fetchedAt: number;
};
let historyCache: HistoryCacheEntry | null = null;
function bustHistoryCache() {
  historyCache = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. usePostFormationMonitor — Watch active monitored pairs for a circle
// ═══════════════════════════════════════════════════════════════════════════════

export function usePostFormationMonitor(circleId: string | undefined) {
  const [monitors, setMonitors] = useState<PostFormationMonitor[]>([]);
  const [escalated, setEscalated] = useState<PostFormationMonitor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInternal = useCallback(async () => {
    if (!circleId) {
      setMonitors([]);
      setEscalated([]);
      setLoading(false);
      return;
    }
    if (
      monitorCache &&
      monitorCache.circleId === circleId &&
      Date.now() - monitorCache.fetchedAt < CONFLICT_CACHE_TTL_MS
    ) {
      setMonitors(monitorCache.monitors);
      setEscalated(monitorCache.monitors.filter((m) => m.escalated));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ConflictPredictionEngine.getCircleMonitors(circleId);
      setMonitors(data);
      setEscalated(data.filter((m) => m.escalated));
      monitorCache = { circleId, monitors: data, fetchedAt: Date.now() };
    } catch (err) {
      console.error("usePostFormationMonitor error:", err);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  // Pull-to-refresh path — busts cache then re-fetches fresh.
  const refresh = useCallback(async () => {
    bustMonitorCache();
    await fetchInternal();
  }, [fetchInternal]);

  useEffect(() => {
    fetchInternal();
  }, [fetchInternal]);

  // Cache-aware refetch on focus. Within TTL this is a no-op state set.
  useFocusEffect(
    useCallback(() => {
      fetchInternal();
    }, [fetchInternal]),
  );

  const hasEscalations = escalated.length > 0;
  const activeCount = monitors.length;

  return {
    monitors, escalated, hasEscalations, activeCount,
    loading, refresh,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. useConflictHistory — View conflict records for a member or circle
// ═══════════════════════════════════════════════════════════════════════════════

export function useConflictHistory(memberId: string | undefined) {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInternal = useCallback(async () => {
    if (!memberId) {
      setConflicts([]);
      setLoading(false);
      return;
    }
    if (
      historyCache &&
      historyCache.memberId === memberId &&
      Date.now() - historyCache.fetchedAt < CONFLICT_CACHE_TTL_MS
    ) {
      setConflicts(historyCache.conflicts);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ConflictPredictionEngine.getMemberConflicts(memberId);
      setConflicts(data);
      historyCache = { memberId, conflicts: data, fetchedAt: Date.now() };
    } catch (err) {
      console.error("useConflictHistory error:", err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  // Pull-to-refresh path — busts cache then re-fetches fresh.
  const refresh = useCallback(async () => {
    bustHistoryCache();
    await fetchInternal();
  }, [fetchInternal]);

  useEffect(() => {
    fetchInternal();
  }, [fetchInternal]);

  useFocusEffect(
    useCallback(() => {
      fetchInternal();
    }, [fetchInternal]),
  );

  const unresolvedCount = conflicts.filter(c => !c.resolvedAt).length;
  const highSeverityCount = conflicts.filter(
    c => c.severity === "high" || c.severity === "critical"
  ).length;

  return {
    conflicts, unresolvedCount, highSeverityCount, loading, refresh,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. useConflictActions — Log conflicts, resolve, manual flag
// ═══════════════════════════════════════════════════════════════════════════════

export function useConflictActions() {
  const [submitting, setSubmitting] = useState(false);

  const logConflict = useCallback(async (
    memberId: string,
    conflictType: ConflictType,
    options?: {
      circleId?: string;
      cycleId?: string;
      otherMemberId?: string;
      severity?: ConflictSeverity;
      description?: string;
      source?: ConflictSource;
    }
  ) => {
    setSubmitting(true);
    try {
      return await ConflictPredictionEngine.logConflict(memberId, conflictType, options);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolutionType: string,
    notes?: string
  ) => {
    setSubmitting(true);
    try {
      return await ConflictPredictionEngine.resolveConflict(conflictId, resolutionType, notes);
    } finally {
      setSubmitting(false);
    }
  }, []);

  const manualFlagPair = useCallback(async (
    circleId: string,
    memberAId: string,
    memberBId: string,
    reason: string
  ) => {
    setSubmitting(true);
    try {
      return await ConflictPredictionEngine.manualFlagPair(circleId, memberAId, memberBId, reason);
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { logConflict, resolveConflict, manualFlagPair, submitting };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. useConflictDashboard — Admin dashboard metrics
// ═══════════════════════════════════════════════════════════════════════════════

export function useConflictDashboard() {
  const [dashboard, setDashboard] = useState<ConflictDashboardRow[]>([]);
  const [metrics, setMetrics] = useState<Awaited<
    ReturnType<typeof ConflictPredictionEngine.getMetrics>
  > | null>(null);
  const [escalatedMonitors, setEscalatedMonitors] = useState<PostFormationMonitor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, met, esc] = await Promise.all([
        ConflictPredictionEngine.getDashboard(),
        ConflictPredictionEngine.getMetrics(),
        ConflictPredictionEngine.getEscalatedMonitors(),
      ]);
      setDashboard(dash);
      setMetrics(met);
      setEscalatedMonitors(esc);
    } catch (err) {
      console.error("useConflictDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime escalation alerts
  useEffect(() => {
    const sub = ConflictPredictionEngine.subscribeToEscalations((monitor) => {
      setEscalatedMonitors(prev => {
        const idx = prev.findIndex(m => m.id === monitor.id);
        if (idx >= 0) { const u = [...prev]; u[idx] = monitor; return u; }
        return [monitor, ...prev];
      });
    });
    return () => { sub.unsubscribe(); };
  }, []);

  return { dashboard, metrics, escalatedMonitors, loading, refresh: fetch };
}
