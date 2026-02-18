/**
 * useCircleMatching Hook
 *
 * A React hook for accessing circle matching and recommendations.
 * Provides loading states, caching, and easy-to-use recommendation data.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  circleMatchingService,
  CircleMatch,
  UserPreferences,
} from "../services/CircleMatchingService";

export interface UseCircleMatchingResult {
  // State
  recommendations: CircleMatch[];
  topMatch: CircleMatch | null;
  friendsCircles: CircleMatch[];
  communityCircles: CircleMatch[];
  affordableCircles: CircleMatch[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadRecommendations: (preferences?: UserPreferences) => Promise<void>;
  loadQuickSuggestions: () => Promise<void>;
  findCircles: (criteria: {
    minAmount?: number;
    maxAmount?: number;
    frequency?: "weekly" | "biweekly" | "monthly";
    type?: "traditional" | "goal" | "emergency" | "investment" | "charity";
    communityId?: string;
    hasConnections?: boolean;
  }) => Promise<CircleMatch[]>;
  refreshRecommendations: () => Promise<void>;

  // Computed values
  hasRecommendations: boolean;
  eligibleCount: number;
  topMatchScore: number;

  // Helpers
  getMatchExplanation: (match: CircleMatch) => string;
  getConnectionLabel: (type: "A" | "B" | "C" | "D") => string;
  getEligibilityColor: (status: "eligible" | "conditional" | "ineligible") => string;
}

const CONNECTION_LABELS = {
  A: "Close connection (family/best friend)",
  B: "Friend or colleague",
  C: "Friend of friend",
  D: "Community member",
};

const ELIGIBILITY_COLORS = {
  eligible: "#10B981",
  conditional: "#F59E0B",
  ineligible: "#EF4444",
};

export const useCircleMatching = (): UseCircleMatchingResult => {
  const { user } = useAuth();

  const [recommendations, setRecommendations] = useState<CircleMatch[]>([]);
  const [topMatch, setTopMatch] = useState<CircleMatch | null>(null);
  const [friendsCircles, setFriendsCircles] = useState<CircleMatch[]>([]);
  const [communityCircles, setCommunityCircles] = useState<CircleMatch[]>([]);
  const [affordableCircles, setAffordableCircles] = useState<CircleMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(
    async (preferences?: UserPreferences) => {
      if (!user) return;

      setIsLoading(true);
      setError(null);

      try {
        const matches = await circleMatchingService.getRecommendations(user.id, preferences);
        setRecommendations(matches);

        // Also update categorized lists
        if (matches.length > 0) {
          setTopMatch(matches.find((m) => m.eligibilityStatus !== "ineligible") || null);
          setFriendsCircles(
            matches.filter(
              (m) => m.connectionType === "A" || m.connectionType === "B"
            )
          );
          setCommunityCircles(matches.filter((m) => m.circle.communityId));
          setAffordableCircles(
            matches.filter((m) => m.affordability?.riskLevel === "low")
          );
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [user]
  );

  const loadQuickSuggestions = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const suggestions = await circleMatchingService.getQuickSuggestions(user.id);
      setTopMatch(suggestions.topMatch);
      setFriendsCircles(suggestions.friendsCircles);
      setCommunityCircles(suggestions.communityCircles);
      setAffordableCircles(suggestions.affordableCircles);

      // Combine all unique matches for the full list
      const allMatches = new Map<string, CircleMatch>();
      if (suggestions.topMatch) {
        allMatches.set(suggestions.topMatch.circle.id, suggestions.topMatch);
      }
      [...suggestions.friendsCircles, ...suggestions.communityCircles, ...suggestions.affordableCircles].forEach(
        (match) => {
          if (!allMatches.has(match.circle.id)) {
            allMatches.set(match.circle.id, match);
          }
        }
      );
      setRecommendations(Array.from(allMatches.values()));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const findCircles = useCallback(
    async (criteria: Parameters<typeof circleMatchingService.findCircles>[1]) => {
      if (!user) return [];

      try {
        return await circleMatchingService.findCircles(user.id, criteria);
      } catch (err: any) {
        console.error("Error finding circles:", err);
        return [];
      }
    },
    [user]
  );

  const refreshRecommendations = useCallback(async () => {
    await loadRecommendations();
  }, [loadRecommendations]);

  // Load quick suggestions on mount
  useEffect(() => {
    if (user) {
      loadQuickSuggestions();
    }
  }, [user]);

  // Computed values
  const hasRecommendations = recommendations.length > 0;
  const eligibleCount = recommendations.filter(
    (m) => m.eligibilityStatus === "eligible"
  ).length;
  const topMatchScore = topMatch?.matchScore ?? 0;

  // Helper functions
  const getMatchExplanation = (match: CircleMatch): string => {
    return circleMatchingService.getMatchExplanation(match);
  };

  const getConnectionLabel = (type: "A" | "B" | "C" | "D"): string => {
    return CONNECTION_LABELS[type];
  };

  const getEligibilityColor = (
    status: "eligible" | "conditional" | "ineligible"
  ): string => {
    return ELIGIBILITY_COLORS[status];
  };

  return {
    recommendations,
    topMatch,
    friendsCircles,
    communityCircles,
    affordableCircles,
    isLoading,
    error,
    loadRecommendations,
    loadQuickSuggestions,
    findCircles,
    refreshRecommendations,
    hasRecommendations,
    eligibleCount,
    topMatchScore,
    getMatchExplanation,
    getConnectionLabel,
    getEligibilityColor,
  };
};

export default useCircleMatching;
