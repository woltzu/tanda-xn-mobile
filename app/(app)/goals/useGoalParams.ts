/**
 * Shared hook to extract goal-related params from URL search params.
 * Used by all goal screens that receive goalId, tier, or step.
 *
 * Works in browser (window.location.search) and can be adapted for
 * Expo Router (useLocalSearchParams) when migrating to native.
 */

import { useState, useEffect } from "react";

type GoalParams = {
  goalId: string | null;
  tier: string | null;
  step: number | null;
};

export function useGoalParams(): GoalParams {
  const [params, setParams] = useState<GoalParams>({
    goalId: null,
    tier: null,
    step: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      goalId: searchParams.get("goalId"),
      tier: searchParams.get("tier"),
      step: searchParams.get("step")
        ? parseInt(searchParams.get("step")!, 10)
        : null,
    });
  }, []);

  return params;
}

/**
 * Navigate to a goal screen with params.
 * Centralized to make future migration to Expo Router easier.
 */
export function navigateToGoalScreen(
  screen: string,
  params?: Record<string, string | number>
) {
  const searchParams = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      searchParams.set(key, String(value));
    });
  }
  const query = searchParams.toString();
  const path = `/goals/${screen}${query ? `?${query}` : ""}`;

  if (typeof window !== "undefined") {
    window.location.href = path;
  }
}

/**
 * Go back in browser history.
 */
export function goBack() {
  if (typeof window !== "undefined") {
    window.history.back();
  }
}
