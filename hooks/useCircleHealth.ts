// ═══════════════════════════════════════════════════════════════════════════════
// useCircleHealth — Phase D3 of feat(circle-health)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Drives the Circle Health card on CircleDetailScreen.
//
// Data layer:
//   * Initial load + manual refresh: direct SELECT on circle_health_scores
//     for the given circle_id (one row per circle via UNIQUE(circle_id)).
//   * Manual recompute: calls migration-104's recompute_circle_health RPC
//     which re-runs compute_circle_health_score and returns the fresh
//     JSONB payload, used to update local state without a follow-up SELECT.
//   * Realtime: subscribes to UPDATE/INSERT on circle_health_scores
//     filtered by circle_id so the card stays current when the nightly
//     scoring-pipeline cron upserts.
//
// All four reads use the same column shape — circle_health_scores's row
// schema is the source of truth for what the card renders.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type HealthStatus = "thriving" | "healthy" | "at_risk" | "critical";
export type HealthTrend = "improving" | "stable" | "declining";

export interface CircleHealthRow {
  circle_id: string;
  health_score: number;
  health_status: HealthStatus;
  contribution_reliability_score: number;
  member_quality_score: number;
  financial_stability_score: number;
  social_cohesion_score: number;
  on_time_contribution_pct: number;
  avg_member_xnscore: number;
  members_with_defaults: number;
  total_members: number;
  avg_default_probability: number;
  previous_score: number | null;
  trend: HealthTrend;
  last_computed_at: string;
  updated_at: string;
}

interface RecomputeResult {
  success: boolean;
  health_score?: number;
  health_status?: HealthStatus;
  trend?: HealthTrend;
  previous_score?: number | null;
  components?: {
    contribution_reliability: number;
    member_quality: number;
    financial_stability: number;
    social_cohesion: number;
  };
  metrics?: {
    on_time_contribution_pct: number;
    avg_member_xnscore: number;
    members_with_defaults: number;
    total_members: number;
    avg_default_probability: number;
  };
  last_computed_at?: string;
  error?: string;
}

const STATUS_VISUALS: Record<
  HealthStatus,
  { emoji: string; label: string; color: string; bg: string }
> = {
  thriving: { emoji: "🌟", label: "Thriving", color: "#10B981", bg: "#D1FAE5" },
  healthy: { emoji: "💪", label: "Healthy", color: "#3B82F6", bg: "#DBEAFE" },
  at_risk: { emoji: "⚠️", label: "At Risk", color: "#F59E0B", bg: "#FEF3C7" },
  critical: { emoji: "🚨", label: "Critical", color: "#EF4444", bg: "#FEE2E2" },
};

const TREND_VISUALS: Record<
  HealthTrend,
  { emoji: string; label: string; color: string }
> = {
  improving: { emoji: "📈", label: "Improving", color: "#10B981" },
  stable: { emoji: "➡️", label: "Stable", color: "#6B7280" },
  declining: { emoji: "📉", label: "Declining", color: "#EF4444" },
};

// ── DB row → numeric coercion (supabase returns numeric as string) ──
function coerceRow(raw: any): CircleHealthRow {
  return {
    circle_id: raw.circle_id,
    health_score: Number(raw.health_score),
    health_status: raw.health_status,
    contribution_reliability_score: Number(raw.contribution_reliability_score),
    member_quality_score: Number(raw.member_quality_score),
    financial_stability_score: Number(raw.financial_stability_score),
    social_cohesion_score: Number(raw.social_cohesion_score),
    on_time_contribution_pct: Number(raw.on_time_contribution_pct),
    avg_member_xnscore: Number(raw.avg_member_xnscore),
    members_with_defaults: Number(raw.members_with_defaults),
    total_members: Number(raw.total_members),
    avg_default_probability: Number(raw.avg_default_probability),
    previous_score: raw.previous_score == null ? null : Number(raw.previous_score),
    trend: raw.trend,
    last_computed_at: raw.last_computed_at,
    updated_at: raw.updated_at,
  };
}

export interface UseCircleHealthResult {
  health: CircleHealthRow | null;
  loading: boolean;
  recomputing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recompute: () => Promise<void>;
  // Convenience derived values
  statusVisual: (typeof STATUS_VISUALS)[HealthStatus] | null;
  trendVisual: (typeof TREND_VISUALS)[HealthTrend] | null;
  // Computed values
  scoreDelta: number | null;
  hasNeverBeenComputed: boolean;
}

export function useCircleHealth(circleId?: string): UseCircleHealthResult {
  const [health, setHealth] = useState<CircleHealthRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!circleId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("circle_health_scores")
        .select("*")
        .eq("circle_id", circleId)
        .maybeSingle();
      if (err) {
        setError(err.message);
      } else if (data) {
        setHealth(coerceRow(data));
      } else {
        setHealth(null);
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load health");
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  const recompute = useCallback(async () => {
    if (!circleId) return;
    setRecomputing(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("recompute_circle_health", {
        p_circle_id: circleId,
      });
      if (err) {
        setError(err.message);
        return;
      }
      const result = data as RecomputeResult;
      if (!result.success) {
        setError(result.error ?? "Could not refresh score");
        return;
      }
      // Merge the RPC's freshly computed payload into the existing row shape.
      // Falls back to a refresh() if the RPC payload is missing any field.
      setHealth((prev) => {
        if (
          result.health_score == null ||
          result.health_status == null ||
          result.trend == null ||
          result.components == null ||
          result.metrics == null ||
          result.last_computed_at == null
        ) {
          return prev;
        }
        return {
          circle_id: circleId,
          health_score: Number(result.health_score),
          health_status: result.health_status,
          contribution_reliability_score: Number(result.components.contribution_reliability),
          member_quality_score: Number(result.components.member_quality),
          financial_stability_score: Number(result.components.financial_stability),
          social_cohesion_score: Number(result.components.social_cohesion),
          on_time_contribution_pct: Number(result.metrics.on_time_contribution_pct),
          avg_member_xnscore: Number(result.metrics.avg_member_xnscore),
          members_with_defaults: Number(result.metrics.members_with_defaults),
          total_members: Number(result.metrics.total_members),
          avg_default_probability: Number(result.metrics.avg_default_probability),
          previous_score:
            result.previous_score == null ? null : Number(result.previous_score),
          trend: result.trend,
          last_computed_at: result.last_computed_at,
          updated_at: result.last_computed_at,
        };
      });
    } catch (e: any) {
      setError(e?.message ?? "Could not refresh score");
    } finally {
      setRecomputing(false);
    }
  }, [circleId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — track upserts from the nightly scoring-pipeline cron
  useEffect(() => {
    if (!circleId) return;
    const channel = supabase
      .channel(`circle-health-${circleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circle_health_scores",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setHealth(coerceRow(payload.new));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [circleId]);

  const statusVisual = useMemo(
    () => (health ? STATUS_VISUALS[health.health_status] : null),
    [health],
  );
  const trendVisual = useMemo(
    () => (health ? TREND_VISUALS[health.trend] : null),
    [health],
  );
  const scoreDelta = useMemo(() => {
    if (!health || health.previous_score == null) return null;
    return health.health_score - health.previous_score;
  }, [health]);

  return {
    health,
    loading,
    recomputing,
    error,
    refresh,
    recompute,
    statusVisual,
    trendVisual,
    scoreDelta,
    hasNeverBeenComputed: !loading && health == null,
  };
}

// Re-export visual tables for component-level overrides if needed
export { STATUS_VISUALS, TREND_VISUALS };
