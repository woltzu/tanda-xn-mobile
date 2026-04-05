/**
 * Shared hook to extract circle-related params from URL search params.
 * Used by all circle screens that receive circleId, memberId, or cycleNumber.
 *
 * Works in both browser (window.location.search) and can be adapted for
 * Expo Router (useLocalSearchParams) when migrating to native.
 */

import { useState, useEffect } from "react";

type CircleParams = {
  circleId: string | null;
  memberId: string | null;
  cycleNumber: number | null;
};

export function useCircleParams(): CircleParams {
  const [params, setParams] = useState<CircleParams>({
    circleId: null,
    memberId: null,
    cycleNumber: null,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const searchParams = new URLSearchParams(window.location.search);
    setParams({
      circleId: searchParams.get("circleId"),
      memberId: searchParams.get("memberId"),
      cycleNumber: searchParams.get("cycleNumber")
        ? parseInt(searchParams.get("cycleNumber")!, 10)
        : null,
    });
  }, []);

  return params;
}

/**
 * Navigate to a circle screen with params.
 * Centralized to make future migration to Expo Router easier.
 */
export function navigateToCircleScreen(
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
  const path = `/circles/${screen}${query ? `?${query}` : ""}`;

  if (typeof window !== "undefined") {
    window.location.href = path;
  }
}

/**
 * Go back in browser history (replaces console.log("Back")).
 */
export function goBack() {
  if (typeof window !== "undefined") {
    window.history.back();
  }
}
