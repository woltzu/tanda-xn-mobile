/**
 * AffordabilityService.ts
 *
 * Comprehensive affordability check algorithm for TandaXn
 *
 * This service calculates whether a member can afford to join a new circle based on:
 * 1. Monthly income (self-reported or verified via Plaid)
 * 2. Existing circle obligations (active contributions)
 * 3. The new circle's contribution requirements
 * 4. Debt-to-income style ratio for circle contributions
 * 5. Risk assessment based on payment history
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type IncomeSource = "self_reported" | "plaid_verified" | "employer_verified";

export type IncomeFrequency = "weekly" | "biweekly" | "monthly" | "annually";

export interface UserFinancialProfile {
  userId: string;
  monthlyIncome: number;
  incomeSource: IncomeSource;
  incomeVerifiedAt?: string;
  employmentStatus?: "employed" | "self_employed" | "unemployed" | "retired" | "student";
  hasEmergencyFund: boolean;
  dependents: number;
}

export interface CircleObligation {
  circleId: string;
  circleName: string;
  contributionAmount: number;
  frequency: "weekly" | "biweekly" | "monthly";
  monthlyEquivalent: number;
  remainingCycles: number;
  status: "active" | "pending";
}

export interface AffordabilityResult {
  canAfford: boolean;
  score: number; // 0-100 affordability score
  riskLevel: "low" | "medium" | "high" | "critical";

  // Financial breakdown
  monthlyIncome: number;
  currentObligations: number;
  newObligation: number;
  totalObligationsAfter: number;

  // Ratios
  currentRatio: number; // Current obligations / income
  proposedRatio: number; // Total after / income
  maxAllowedRatio: number;

  // Detailed analysis
  reasons: string[];
  warnings: string[];
  recommendations: string[];

  // Payment capacity
  remainingCapacity: number;
  safeCapacity: number; // Conservative estimate

  // Risk factors
  riskFactors: RiskFactor[];
}

export interface RiskFactor {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
}

export interface AffordabilityConfig {
  // Maximum ratio of circle obligations to monthly income
  maxObligationRatio: number;

  // Warning threshold (before max)
  warningRatio: number;

  // Safe/conservative ratio
  safeRatio: number;

  // Minimum income required for any circle
  minimumMonthlyIncome: number;

  // Buffer for emergencies (percentage of income to keep free)
  emergencyBuffer: number;

  // Adjustment factors
  unverifiedIncomeDiscount: number; // Reduce reported income by this % if unverified
  goodHistoryBonus: number; // Increase max ratio for good payment history
  defaultPenalty: number; // Reduce max ratio if user has past defaults
}

// Default configuration - can be adjusted per community
const DEFAULT_CONFIG: AffordabilityConfig = {
  maxObligationRatio: 0.30, // Max 30% of income on circle obligations
  warningRatio: 0.20, // Warn at 20%
  safeRatio: 0.15, // Safe at 15%
  minimumMonthlyIncome: 500, // Minimum $500/month income
  emergencyBuffer: 0.10, // Keep 10% free for emergencies
  unverifiedIncomeDiscount: 0.20, // Reduce unverified income by 20%
  goodHistoryBonus: 0.05, // Add 5% to max ratio for good history
  defaultPenalty: 0.10, // Reduce max ratio by 10% for past defaults
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert contribution frequency to monthly equivalent
 */
export const toMonthlyAmount = (
  amount: number,
  frequency: "weekly" | "biweekly" | "monthly"
): number => {
  switch (frequency) {
    case "weekly":
      return amount * 4.33; // Average weeks per month
    case "biweekly":
      return amount * 2.17; // Average biweekly periods per month
    case "monthly":
      return amount;
    default:
      return amount;
  }
};

/**
 * Convert income frequency to monthly
 */
export const incomeToMonthly = (
  amount: number,
  frequency: IncomeFrequency
): number => {
  switch (frequency) {
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "monthly":
      return amount;
    case "annually":
      return amount / 12;
    default:
      return amount;
  }
};

/**
 * Calculate payment history score (0-100)
 */
const calculatePaymentHistoryScore = (
  onTime: number,
  late: number,
  missed: number
): number => {
  const total = onTime + late + missed;
  if (total === 0) return 50; // Neutral for new users

  const onTimeWeight = 1.0;
  const lateWeight = 0.5;
  const missedWeight = 0.0;

  const weightedScore = (onTime * onTimeWeight + late * lateWeight + missed * missedWeight) / total;
  return Math.round(weightedScore * 100);
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class AffordabilityService {
  private config: AffordabilityConfig;

  constructor(config?: Partial<AffordabilityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get user's financial profile
   */
  async getUserFinancialProfile(userId: string): Promise<UserFinancialProfile | null> {
    try {
      // First try to get from financial_profiles table if it exists
      const { data: financialProfile, error } = await supabase
        .from("financial_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (financialProfile && !error) {
        return {
          userId,
          monthlyIncome: parseFloat(financialProfile.monthly_income) || 0,
          incomeSource: financialProfile.income_source || "self_reported",
          incomeVerifiedAt: financialProfile.income_verified_at,
          employmentStatus: financialProfile.employment_status,
          hasEmergencyFund: financialProfile.has_emergency_fund || false,
          dependents: financialProfile.dependents || 0,
        };
      }

      // Fallback: Try to get from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("monthly_income, income_source, employment_status")
        .eq("id", userId)
        .single();

      if (profile) {
        return {
          userId,
          monthlyIncome: parseFloat(profile.monthly_income) || 0,
          incomeSource: profile.income_source || "self_reported",
          employmentStatus: profile.employment_status,
          hasEmergencyFund: false,
          dependents: 0,
        };
      }

      return null;
    } catch (err) {
      console.error("Error fetching financial profile:", err);
      return null;
    }
  }

  /**
   * Get user's current circle obligations
   */
  async getCurrentObligations(userId: string): Promise<CircleObligation[]> {
    try {
      const { data, error } = await supabase
        .from("circle_members")
        .select(`
          *,
          circle:circles(
            id,
            name,
            amount,
            frequency,
            total_cycles,
            current_cycle,
            status
          )
        `)
        .eq("user_id", userId)
        .in("status", ["active", "pending"]);

      if (error) throw error;

      return (data || [])
        .filter((member) => member.circle && ["active", "pending", "forming"].includes(member.circle.status))
        .map((member) => {
          const amount = parseFloat(member.circle.amount) || 0;
          const frequency = member.circle.frequency as "weekly" | "biweekly" | "monthly";

          return {
            circleId: member.circle.id,
            circleName: member.circle.name,
            contributionAmount: amount,
            frequency,
            monthlyEquivalent: toMonthlyAmount(amount, frequency),
            remainingCycles: (member.circle.total_cycles || 10) - (member.circle.current_cycle || 0),
            status: member.status as "active" | "pending",
          };
        });
    } catch (err) {
      console.error("Error fetching obligations:", err);
      return [];
    }
  }

  /**
   * Get user's payment history stats
   */
  async getPaymentHistory(userId: string): Promise<{
    onTime: number;
    late: number;
    missed: number;
    circlesCompleted: number;
    defaults: number;
  }> {
    try {
      // Aggregate from circle_members
      const { data: memberData } = await supabase
        .from("circle_members")
        .select("contributions_on_time, contributions_late, contributions_missed")
        .eq("user_id", userId);

      const aggregated = (memberData || []).reduce(
        (acc, m) => ({
          onTime: acc.onTime + (m.contributions_on_time || 0),
          late: acc.late + (m.contributions_late || 0),
          missed: acc.missed + (m.contributions_missed || 0),
        }),
        { onTime: 0, late: 0, missed: 0 }
      );

      // Count completed circles
      const { count: completedCount } = await supabase
        .from("circle_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed");

      // Count defaults
      const { count: defaultCount } = await supabase
        .from("defaults")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      return {
        ...aggregated,
        circlesCompleted: completedCount || 0,
        defaults: defaultCount || 0,
      };
    } catch (err) {
      console.error("Error fetching payment history:", err);
      return { onTime: 0, late: 0, missed: 0, circlesCompleted: 0, defaults: 0 };
    }
  }

  /**
   * Main affordability check function
   */
  async checkAffordability(
    userId: string,
    circleAmount: number,
    circleFrequency: "weekly" | "biweekly" | "monthly",
    communityConfig?: Partial<AffordabilityConfig>
  ): Promise<AffordabilityResult> {
    // Merge community-specific config
    const config = { ...this.config, ...communityConfig };

    // Initialize result
    const result: AffordabilityResult = {
      canAfford: false,
      score: 0,
      riskLevel: "high",
      monthlyIncome: 0,
      currentObligations: 0,
      newObligation: 0,
      totalObligationsAfter: 0,
      currentRatio: 0,
      proposedRatio: 0,
      maxAllowedRatio: config.maxObligationRatio,
      reasons: [],
      warnings: [],
      recommendations: [],
      remainingCapacity: 0,
      safeCapacity: 0,
      riskFactors: [],
    };

    try {
      // 1. Get financial profile
      const financialProfile = await this.getUserFinancialProfile(userId);

      if (!financialProfile || financialProfile.monthlyIncome === 0) {
        result.reasons.push("No income information available");
        result.recommendations.push("Please complete your financial profile to join circles");
        return result;
      }

      // 2. Adjust income based on verification status
      let adjustedIncome = financialProfile.monthlyIncome;
      if (financialProfile.incomeSource === "self_reported") {
        adjustedIncome *= (1 - config.unverifiedIncomeDiscount);
        result.warnings.push(
          `Income is self-reported. Using ${Math.round((1 - config.unverifiedIncomeDiscount) * 100)}% of stated income for calculation.`
        );
        result.riskFactors.push({
          factor: "Unverified Income",
          impact: "negative",
          weight: 0.8,
          description: "Self-reported income has not been verified",
        });
      } else {
        result.riskFactors.push({
          factor: "Verified Income",
          impact: "positive",
          weight: 1.2,
          description: `Income verified via ${financialProfile.incomeSource}`,
        });
      }

      result.monthlyIncome = adjustedIncome;

      // 3. Check minimum income requirement
      if (adjustedIncome < config.minimumMonthlyIncome) {
        result.reasons.push(
          `Monthly income ($${adjustedIncome.toFixed(2)}) is below minimum requirement ($${config.minimumMonthlyIncome})`
        );
        return result;
      }

      // 4. Get current obligations
      const obligations = await this.getCurrentObligations(userId);
      result.currentObligations = obligations.reduce((sum, o) => sum + o.monthlyEquivalent, 0);

      // 5. Calculate new obligation
      result.newObligation = toMonthlyAmount(circleAmount, circleFrequency);
      result.totalObligationsAfter = result.currentObligations + result.newObligation;

      // 6. Calculate ratios
      result.currentRatio = result.currentObligations / adjustedIncome;
      result.proposedRatio = result.totalObligationsAfter / adjustedIncome;

      // 7. Get payment history and adjust max ratio
      const history = await this.getPaymentHistory(userId);
      const paymentScore = calculatePaymentHistoryScore(history.onTime, history.late, history.missed);

      // Adjust max ratio based on history
      if (paymentScore >= 80 && history.circlesCompleted >= 2) {
        result.maxAllowedRatio += config.goodHistoryBonus;
        result.riskFactors.push({
          factor: "Excellent Payment History",
          impact: "positive",
          weight: 1.0,
          description: `${paymentScore}% on-time payments with ${history.circlesCompleted} completed circles`,
        });
      } else if (paymentScore < 60) {
        result.warnings.push("Payment history shows some late or missed payments");
        result.riskFactors.push({
          factor: "Payment History Concerns",
          impact: "negative",
          weight: 0.9,
          description: `${paymentScore}% payment score`,
        });
      }

      // Reduce max ratio if user has defaults
      if (history.defaults > 0) {
        result.maxAllowedRatio -= config.defaultPenalty * Math.min(history.defaults, 3);
        result.riskFactors.push({
          factor: "Past Defaults",
          impact: "negative",
          weight: 0.7,
          description: `${history.defaults} previous default(s) on record`,
        });
      }

      // 8. Emergency fund consideration
      if (!financialProfile.hasEmergencyFund) {
        result.warnings.push("No emergency fund reported - consider building savings before joining more circles");
        result.riskFactors.push({
          factor: "No Emergency Fund",
          impact: "negative",
          weight: 0.9,
          description: "User has not indicated having emergency savings",
        });
      }

      // 9. Dependents consideration
      if (financialProfile.dependents > 0) {
        const dependentAdjustment = Math.min(financialProfile.dependents * 0.02, 0.08);
        result.maxAllowedRatio -= dependentAdjustment;
        result.riskFactors.push({
          factor: "Financial Dependents",
          impact: "neutral",
          weight: 1.0,
          description: `${financialProfile.dependents} dependent(s) - obligation limit adjusted`,
        });
      }

      // 10. Calculate capacities
      const maxObligations = adjustedIncome * result.maxAllowedRatio;
      result.remainingCapacity = Math.max(0, maxObligations - result.currentObligations);
      result.safeCapacity = Math.max(0, adjustedIncome * config.safeRatio - result.currentObligations);

      // 11. Make the affordability decision
      if (result.proposedRatio <= config.safeRatio) {
        result.canAfford = true;
        result.riskLevel = "low";
        result.score = 90 + Math.round((config.safeRatio - result.proposedRatio) / config.safeRatio * 10);
      } else if (result.proposedRatio <= config.warningRatio) {
        result.canAfford = true;
        result.riskLevel = "medium";
        result.score = 70 + Math.round((config.warningRatio - result.proposedRatio) / (config.warningRatio - config.safeRatio) * 20);
        result.warnings.push("This circle will put you in the moderate risk zone for circle obligations");
      } else if (result.proposedRatio <= result.maxAllowedRatio) {
        result.canAfford = true;
        result.riskLevel = "high";
        result.score = 50 + Math.round((result.maxAllowedRatio - result.proposedRatio) / (result.maxAllowedRatio - config.warningRatio) * 20);
        result.warnings.push("This circle will bring you close to your maximum recommended obligation level");
        result.recommendations.push("Consider a smaller circle or waiting until current obligations decrease");
      } else {
        result.canAfford = false;
        result.riskLevel = "critical";
        result.score = Math.max(0, Math.round(50 * (1 - (result.proposedRatio - result.maxAllowedRatio) / 0.2)));
        result.reasons.push(
          `Total obligations (${Math.round(result.proposedRatio * 100)}% of income) would exceed maximum allowed (${Math.round(result.maxAllowedRatio * 100)}%)`
        );

        // Recommend what they CAN afford
        if (result.remainingCapacity > 0) {
          result.recommendations.push(
            `Your remaining capacity is $${result.remainingCapacity.toFixed(2)}/month. Consider a circle with contributions of $${Math.floor(result.remainingCapacity / toMonthlyAmount(1, circleFrequency))}/${circleFrequency} or less.`
          );
        } else {
          result.recommendations.push(
            "Complete your current circle obligations before joining new ones"
          );
        }
      }

      // 12. Add contextual recommendations
      if (obligations.length >= 3) {
        result.warnings.push(`You are currently in ${obligations.length} active circles`);
      }

      if (obligations.length >= 5) {
        result.canAfford = false;
        result.reasons.push("Maximum of 5 active circles allowed");
      }

      // Ensure score is bounded
      result.score = Math.max(0, Math.min(100, result.score));

      return result;
    } catch (err: any) {
      console.error("Error checking affordability:", err);
      result.reasons.push("Error checking affordability: " + err.message);
      return result;
    }
  }

  /**
   * Get affordability summary for UI display
   */
  formatAffordabilitySummary(result: AffordabilityResult): string {
    if (result.canAfford) {
      if (result.riskLevel === "low") {
        return `You can comfortably afford this circle. Your obligations will be ${Math.round(result.proposedRatio * 100)}% of income.`;
      } else if (result.riskLevel === "medium") {
        return `You can afford this circle, but it will put you at ${Math.round(result.proposedRatio * 100)}% of income. Consider your other expenses.`;
      } else {
        return `You can technically afford this, but you'll be at ${Math.round(result.proposedRatio * 100)}% obligation. Proceed with caution.`;
      }
    } else {
      return result.reasons.join(" ");
    }
  }

  /**
   * Calculate what contribution amount user can safely afford
   */
  async calculateMaxAffordableContribution(
    userId: string,
    frequency: "weekly" | "biweekly" | "monthly",
    riskTolerance: "safe" | "moderate" | "aggressive" = "moderate"
  ): Promise<{
    maxAmount: number;
    frequency: string;
    monthlyEquivalent: number;
    usedRatio: number;
  }> {
    const financialProfile = await this.getUserFinancialProfile(userId);
    const obligations = await this.getCurrentObligations(userId);

    if (!financialProfile || financialProfile.monthlyIncome === 0) {
      return { maxAmount: 0, frequency, monthlyEquivalent: 0, usedRatio: 0 };
    }

    let adjustedIncome = financialProfile.monthlyIncome;
    if (financialProfile.incomeSource === "self_reported") {
      adjustedIncome *= (1 - this.config.unverifiedIncomeDiscount);
    }

    const currentObligations = obligations.reduce((sum, o) => sum + o.monthlyEquivalent, 0);

    // Determine target ratio based on risk tolerance
    const targetRatio = riskTolerance === "safe"
      ? this.config.safeRatio
      : riskTolerance === "moderate"
        ? this.config.warningRatio
        : this.config.maxObligationRatio;

    const maxMonthly = Math.max(0, adjustedIncome * targetRatio - currentObligations);

    // Convert back to specified frequency
    let maxAmount: number;
    switch (frequency) {
      case "weekly":
        maxAmount = maxMonthly / 4.33;
        break;
      case "biweekly":
        maxAmount = maxMonthly / 2.17;
        break;
      case "monthly":
        maxAmount = maxMonthly;
        break;
      default:
        maxAmount = maxMonthly;
    }

    return {
      maxAmount: Math.floor(maxAmount), // Round down for safety
      frequency,
      monthlyEquivalent: maxMonthly,
      usedRatio: currentObligations / adjustedIncome,
    };
  }
}

// Export a default instance
export const affordabilityService = new AffordabilityService();

// Export convenience function
export const checkAffordability = (
  userId: string,
  circleAmount: number,
  circleFrequency: "weekly" | "biweekly" | "monthly",
  communityConfig?: Partial<AffordabilityConfig>
) => affordabilityService.checkAffordability(userId, circleAmount, circleFrequency, communityConfig);
