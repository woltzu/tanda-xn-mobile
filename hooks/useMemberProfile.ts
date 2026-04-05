// ══════════════════════════════════════════════════════════════════════════════
// USE MEMBER PROFILE - React hooks for consolidated behavioral profiles
// Thin wrappers around MemberProfileContext + MemberProfileService.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { useMemberProfileContext } from "../context/MemberProfileContext";
import {
  memberProfileService,
  MemberBehavioralProfile,
  ProfileSnapshot,
  NetworkMetrics,
  RiskIndicators,
  TrendData,
} from "../services/MemberProfileService";

// ─────────────────────────────────────────────────────────────────────────
// Core Profile
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get the current behavioral profile.
 */
export function useMemberProfile(): MemberBehavioralProfile | null {
  const { profile } = useMemberProfileContext();
  return profile;
}

/**
 * Check if profile data is still loading.
 */
export function useProfileLoading(): boolean {
  const { isLoading } = useMemberProfileContext();
  return isLoading;
}

/**
 * Check if profile is being refreshed (recomputed).
 */
export function useProfileRefreshing(): boolean {
  const { isRefreshing } = useMemberProfileContext();
  return isRefreshing;
}

/**
 * Get the refresh function to trigger profile recomputation.
 */
export function useRefreshProfile(): () => Promise<void> {
  const { refreshProfile } = useMemberProfileContext();
  return refreshProfile;
}

// ─────────────────────────────────────────────────────────────────────────
// Snapshots (time-series)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get historical profile snapshots.
 */
export function useProfileSnapshots(): ProfileSnapshot[] {
  const { snapshots } = useMemberProfileContext();
  return snapshots;
}

/**
 * Extract trend data for a specific metric from snapshots.
 * @param metric The snapshot field to track (e.g., 'xnScore', 'engagementScore')
 */
export function useProfileTrend(metric: keyof ProfileSnapshot): TrendData {
  const { snapshots } = useMemberProfileContext();
  return useMemo(
    () => memberProfileService.getTrendFromSnapshots(snapshots, metric),
    [snapshots, metric]
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Engagement
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get a composite engagement score (0-100) from the profile.
 */
export function useEngagementScore(): number {
  const { profile } = useMemberProfileContext();
  return useMemo(() => {
    if (!profile) return 0;
    // Weighted composite: sessions (30%), feature adoption (30%), active days (40%)
    const sessionScore = Math.min(100, profile.avgSessionsPerWeek * 15);
    const featureScore = profile.featureAdoptionScore;
    const activityScore = Math.min(100, (profile.activeDaysLast30 / 30) * 100);
    return Math.round(sessionScore * 0.3 + featureScore * 0.3 + activityScore * 0.4);
  }, [profile]);
}

// ─────────────────────────────────────────────────────────────────────────
// Network
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get social network metrics.
 */
export function useNetworkMetrics(): NetworkMetrics | null {
  const { networkMetrics } = useMemberProfileContext();
  return networkMetrics;
}

// ─────────────────────────────────────────────────────────────────────────
// Risk
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get consolidated risk indicators.
 */
export function useRiskIndicators(): RiskIndicators | null {
  const { riskIndicators } = useMemberProfileContext();
  return riskIndicators;
}

/**
 * Get the overall risk level as a simple string.
 */
export function useRiskLevel(): "low" | "medium" | "high" | "critical" {
  const { riskIndicators } = useMemberProfileContext();
  return riskIndicators?.overallRiskLevel ?? "low";
}

// ─────────────────────────────────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get the last error from profile loading/refreshing.
 */
export function useProfileError(): string | null {
  const { lastError } = useMemberProfileContext();
  return lastError;
}

// ─────────────────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────────────────

export type {
  MemberBehavioralProfile,
  ProfileSnapshot,
  NetworkMetrics,
  RiskIndicators,
  TrendData,
} from "../services/MemberProfileService";
