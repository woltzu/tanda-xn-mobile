/**
 * useAffordability Hook
 *
 * A React hook for checking circle affordability in the UI.
 * Provides loading states, results, and formatted messages.
 */

import { useState, useCallback } from "react";
import { useCommunity } from "../context/CommunityContext";
import { AffordabilityResult } from "../services/AffordabilityService";

export type AffordabilityStatus = "idle" | "checking" | "success" | "error";

export interface UseAffordabilityResult {
  // State
  status: AffordabilityStatus;
  result: AffordabilityResult | null;
  error: string | null;

  // Actions
  checkAffordability: (
    amount: number,
    frequency: "weekly" | "biweekly" | "monthly"
  ) => Promise<AffordabilityResult>;
  getMaxAffordable: (
    frequency: "weekly" | "biweekly" | "monthly",
    riskTolerance?: "safe" | "moderate" | "aggressive"
  ) => Promise<{ maxAmount: number; monthlyEquivalent: number; usedRatio: number }>;
  reset: () => void;

  // Computed values
  isChecking: boolean;
  canAfford: boolean;
  riskLevel: "low" | "medium" | "high" | "critical" | null;
  score: number;

  // Formatted display values
  formattedSummary: string;
  formattedRatio: string;
  formattedCapacity: string;
  riskColor: string;
}

export const useAffordability = (): UseAffordabilityResult => {
  const { checkCircleAffordability, getMaxAffordableContribution } = useCommunity();

  const [status, setStatus] = useState<AffordabilityStatus>("idle");
  const [result, setResult] = useState<AffordabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkAffordability = useCallback(
    async (
      amount: number,
      frequency: "weekly" | "biweekly" | "monthly"
    ): Promise<AffordabilityResult> => {
      setStatus("checking");
      setError(null);

      try {
        const affordabilityResult = await checkCircleAffordability(amount, frequency);
        setResult(affordabilityResult);
        setStatus("success");
        return affordabilityResult;
      } catch (err: any) {
        setError(err.message);
        setStatus("error");
        throw err;
      }
    },
    [checkCircleAffordability]
  );

  const getMaxAffordable = useCallback(
    async (
      frequency: "weekly" | "biweekly" | "monthly",
      riskTolerance: "safe" | "moderate" | "aggressive" = "moderate"
    ) => {
      return getMaxAffordableContribution(frequency, riskTolerance);
    },
    [getMaxAffordableContribution]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setResult(null);
    setError(null);
  }, []);

  // Computed values
  const isChecking = status === "checking";
  const canAfford = result?.canAfford ?? false;
  const riskLevel = result?.riskLevel ?? null;
  const score = result?.score ?? 0;

  // Formatted display values
  const formattedSummary = result
    ? getFormattedSummary(result)
    : "Enter an amount to check affordability";

  const formattedRatio = result
    ? `${Math.round(result.proposedRatio * 100)}% of income`
    : "N/A";

  const formattedCapacity = result
    ? `$${result.remainingCapacity.toFixed(0)}/month available`
    : "N/A";

  const riskColor = getRiskColor(riskLevel);

  return {
    status,
    result,
    error,
    checkAffordability,
    getMaxAffordable,
    reset,
    isChecking,
    canAfford,
    riskLevel,
    score,
    formattedSummary,
    formattedRatio,
    formattedCapacity,
    riskColor,
  };
};

// Helper functions
function getFormattedSummary(result: AffordabilityResult): string {
  if (result.canAfford) {
    switch (result.riskLevel) {
      case "low":
        return `You can comfortably afford this circle. Your total obligations will be ${Math.round(
          result.proposedRatio * 100
        )}% of your income.`;
      case "medium":
        return `You can afford this circle, but it will bring your obligations to ${Math.round(
          result.proposedRatio * 100
        )}% of income. Consider your other expenses carefully.`;
      case "high":
        return `This is affordable but risky. You'll be at ${Math.round(
          result.proposedRatio * 100
        )}% of income, near your limit.`;
      default:
        return `Affordability check complete. Obligations: ${Math.round(
          result.proposedRatio * 100
        )}%`;
    }
  } else {
    if (result.reasons.length > 0) {
      return result.reasons[0];
    }
    return `This circle would put you over your recommended limit of ${Math.round(
      result.maxAllowedRatio * 100
    )}% of income.`;
  }
}

function getRiskColor(riskLevel: string | null): string {
  switch (riskLevel) {
    case "low":
      return "#10B981"; // Green
    case "medium":
      return "#F59E0B"; // Yellow/Amber
    case "high":
      return "#F97316"; // Orange
    case "critical":
      return "#EF4444"; // Red
    default:
      return "#6B7280"; // Gray
  }
}

export default useAffordability;
