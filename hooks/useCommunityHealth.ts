/**
 * useCommunityHealth Hook
 *
 * A React hook for accessing community health scores and metrics.
 * Provides loading states, caching, and formatted display values.
 */

import { useState, useCallback, useEffect } from "react";
import {
  communityHealthService,
  CommunityHealthScore,
  HealthStatus,
  HealthRecommendation,
} from "../services/CommunityHealthService";

export interface UseCommunityHealthResult {
  // State
  healthScore: CommunityHealthScore | null;
  history: { date: string; score: number; status: HealthStatus }[];
  isLoading: boolean;
  isCalculating: boolean;
  error: string | null;

  // Actions
  calculateHealth: () => Promise<CommunityHealthScore | null>;
  refreshHealth: () => Promise<void>;
  loadHistory: (days?: number) => Promise<void>;

  // Computed values
  overallScore: number;
  status: HealthStatus | null;
  trend: "improving" | "stable" | "declining" | null;
  topRecommendations: HealthRecommendation[];

  // Formatted display values
  statusLabel: string;
  statusColor: string;
  statusEmoji: string;
  scoreDescription: string;
  trendDescription: string;
}

const STATUS_CONFIG: Record<
  HealthStatus,
  { label: string; color: string; emoji: string; description: string }
> = {
  thriving: {
    label: "Thriving",
    color: "#10B981",
    emoji: "🌟",
    description: "Excellent community health! Keep up the great work.",
  },
  healthy: {
    label: "Healthy",
    color: "#3B82F6",
    emoji: "💪",
    description: "Good community health with minor areas for improvement.",
  },
  at_risk: {
    label: "At Risk",
    color: "#F59E0B",
    emoji: "⚠️",
    description: "Community needs attention. Review recommendations.",
  },
  critical: {
    label: "Critical",
    color: "#EF4444",
    emoji: "🚨",
    description: "Serious intervention needed. Take action immediately.",
  },
};

export const useCommunityHealth = (communityId: string): UseCommunityHealthResult => {
  const [healthScore, setHealthScore] = useState<CommunityHealthScore | null>(null);
  const [history, setHistory] = useState<{ date: string; score: number; status: HealthStatus }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing health score on mount
  useEffect(() => {
    if (communityId) {
      loadLatestHealth();
    }
  }, [communityId]);

  const loadLatestHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const score = await communityHealthService.getLatestHealthScore(communityId);
      setHealthScore(score);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateHealth = useCallback(async (): Promise<CommunityHealthScore | null> => {
    setIsCalculating(true);
    setError(null);
    try {
      const score = await communityHealthService.calculateHealthScore(communityId);
      setHealthScore(score);
      return score;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [communityId]);

  const refreshHealth = useCallback(async () => {
    await calculateHealth();
  }, [calculateHealth]);

  const loadHistory = useCallback(
    async (days: number = 30) => {
      try {
        const historyData = await communityHealthService.getHealthScoreHistory(communityId, days);
        setHistory(historyData);
      } catch (err: any) {
        console.error("Error loading health history:", err);
      }
    },
    [communityId]
  );

  // Computed values
  const overallScore = healthScore?.overallScore ?? 0;
  const status = healthScore?.status ?? null;
  const trend = healthScore?.trend ?? null;
  const topRecommendations = healthScore?.recommendations?.slice(0, 3) ?? [];

  // Formatted display values
  const statusConfig = status ? STATUS_CONFIG[status] : null;
  const statusLabel = statusConfig?.label ?? "Unknown";
  const statusColor = statusConfig?.color ?? "#6B7280";
  const statusEmoji = statusConfig?.emoji ?? "❓";
  const scoreDescription = statusConfig?.description ?? "No health data available";

  const trendDescription = trend
    ? trend === "improving"
      ? "Score is improving"
      : trend === "declining"
        ? "Score is declining"
        : "Score is stable"
    : "";

  return {
    healthScore,
    history,
    isLoading,
    isCalculating,
    error,
    calculateHealth,
    refreshHealth,
    loadHistory,
    overallScore,
    status,
    trend,
    topRecommendations,
    statusLabel,
    statusColor,
    statusEmoji,
    scoreDescription,
    trendDescription,
  };
};

export default useCommunityHealth;
