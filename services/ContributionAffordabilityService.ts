/**
 * ContributionAffordabilityService.ts
 *
 * Pre-enrollment affordability check for circle contributions.
 * Determines if a user can afford a new circle commitment.
 *
 * Uses:
 * - Existing circle commitments (normalized to monthly)
 * - Income data (from Plaid if available)
 * - XnScore as fallback indicator
 * - Bank balance check
 *
 * Thresholds:
 * - > 40% commitment-to-income → Blocked
 * - 30-40% → Warning
 * - < 30% → Approved
 */

import { supabase } from "../lib/supabase";
import { ContributionFrequency } from "./ContributionSchedulingService";

// ============================================================================
// TYPES
// ============================================================================

export type AffordabilityDecision = "approved" | "warning" | "blocked";

export interface AffordabilityResult {
  canAfford: boolean;
  decision: AffordabilityDecision;
  confidence: "low" | "medium" | "high";
  warning?: string;
  reason?: string;
  details: AffordabilityDetails;
  recommendations: string[];
}

export interface AffordabilityDetails {
  // Current commitments
  currentCircleCount: number;
  currentMonthlyCommitment: number;
  existingCircles: ExistingCommitment[];

  // New contribution
  newContributionMonthly: number;
  newContributionOriginal: number;
  newFrequency: ContributionFrequency;

  // Projections
  projectedTotal: number;
  projectedCircleCount: number;

  // Income (if available)
  estimatedMonthlyIncome: number | null;
  incomeSource: "plaid" | "manual" | "estimated" | null;

  // Ratios
  commitmentToIncomeRatio: number | null;
  currentRatio: number | null;
  projectedRatio: number | null;

  // Balance check
  currentBankBalance: number | null;
  balanceCoversMonths: number | null;
}

export interface ExistingCommitment {
  circleId: string;
  circleName: string;
  amount: number;
  frequency: ContributionFrequency;
  monthlyEquivalent: number;
  remainingCycles: number;
}

export interface AffordabilityConfig {
  // Income ratio thresholds
  blockThreshold: number;      // Block if ratio > this (default: 0.40)
  warningThreshold: number;    // Warn if ratio > this (default: 0.30)

  // Fallback rules (when no income data)
  lowXnScoreThreshold: number; // XnScore below this triggers stricter rules
  lowScoreMaxCommitment: number; // Max monthly commitment for low XnScore

  // Balance requirements
  minBalanceMonths: number;    // Minimum months of contribution covered by balance
  recommendedBalanceMonths: number;

  // Maximum circles
  maxActiveCircles: number;
}

const DEFAULT_CONFIG: AffordabilityConfig = {
  blockThreshold: 0.40,
  warningThreshold: 0.30,
  lowXnScoreThreshold: 50,
  lowScoreMaxCommitment: 50000, // 50,000 XAF
  minBalanceMonths: 1,
  recommendedBalanceMonths: 2,
  maxActiveCircles: 5,
};

// ============================================================================
// FREQUENCY NORMALIZATION
// ============================================================================

/**
 * Normalize any contribution frequency to monthly equivalent.
 *
 * Using accurate multipliers:
 * - Daily: 30.44 days/month average
 * - Weekly: 4.33 weeks/month
 * - Biweekly: 2.17 pay periods/month
 */
export function normalizeToMonthly(
  amount: number,
  frequency: ContributionFrequency
): number {
  switch (frequency) {
    case "daily":
      return amount * 30.44;
    case "weekly":
      return amount * 4.33;
    case "biweekly":
      return amount * 2.17;
    case "monthly":
      return amount;
    case "quarterly":
      return amount / 3;
    default:
      return amount;
  }
}

/**
 * Get frequency label for display
 */
export function getFrequencyLabel(frequency: ContributionFrequency): string {
  const labels: Record<ContributionFrequency, string> = {
    daily: "Daily",
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  };
  return labels[frequency] || frequency;
}

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class ContributionAffordabilityService {
  private config: AffordabilityConfig;

  constructor(config?: Partial<AffordabilityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // MAIN CHECK
  // ============================================================================

  /**
   * Check if a user can afford a new circle contribution.
   *
   * Flow:
   * 1. Gather existing commitments
   * 2. Calculate monthly equivalents
   * 3. Check income ratio (if data available)
   * 4. Apply fallback rules (XnScore + commitments)
   * 5. Check bank balance
   * 6. Generate recommendations
   */
  async checkAffordability(
    userId: string,
    newContribution: number,
    newFrequency: ContributionFrequency
  ): Promise<AffordabilityResult> {
    // Step 1: Gather existing circle commitments
    const existingCommitments = await this.getExistingCommitments(userId);

    // Step 2: Calculate totals
    const currentMonthlyCommitment = existingCommitments.reduce(
      (sum, c) => sum + c.monthlyEquivalent,
      0
    );
    const newContributionMonthly = normalizeToMonthly(newContribution, newFrequency);
    const projectedTotal = currentMonthlyCommitment + newContributionMonthly;

    // Initialize result
    const result: AffordabilityResult = {
      canAfford: true,
      decision: "approved",
      confidence: "low",
      details: {
        currentCircleCount: existingCommitments.length,
        currentMonthlyCommitment: Math.round(currentMonthlyCommitment * 100) / 100,
        existingCircles: existingCommitments,
        newContributionMonthly: Math.round(newContributionMonthly * 100) / 100,
        newContributionOriginal: newContribution,
        newFrequency,
        projectedTotal: Math.round(projectedTotal * 100) / 100,
        projectedCircleCount: existingCommitments.length + 1,
        estimatedMonthlyIncome: null,
        incomeSource: null,
        commitmentToIncomeRatio: null,
        currentRatio: null,
        projectedRatio: null,
        currentBankBalance: null,
        balanceCoversMonths: null,
      },
      recommendations: [],
    };

    // Step 3: Check maximum circles limit
    if (existingCommitments.length >= this.config.maxActiveCircles) {
      result.canAfford = false;
      result.decision = "blocked";
      result.reason = "max_active_circles";
      result.recommendations.push(
        `You've reached the maximum of ${this.config.maxActiveCircles} active circles. Complete or leave a circle before joining a new one.`
      );
      return result;
    }

    // Step 4: Try income-based assessment
    const incomeData = await this.getEstimatedMonthlyIncome(userId);

    if (incomeData) {
      result.details.estimatedMonthlyIncome = incomeData.income;
      result.details.incomeSource = incomeData.source;
      result.confidence = incomeData.source === "plaid" ? "high" : "medium";

      const currentRatio = currentMonthlyCommitment / incomeData.income;
      const projectedRatio = projectedTotal / incomeData.income;

      result.details.currentRatio = Math.round(currentRatio * 1000) / 1000;
      result.details.projectedRatio = Math.round(projectedRatio * 1000) / 1000;
      result.details.commitmentToIncomeRatio = result.details.projectedRatio;

      // Apply income-based thresholds
      if (projectedRatio > this.config.blockThreshold) {
        result.canAfford = false;
        result.decision = "blocked";
        result.reason = "commitment_exceeds_40pct_income";
        result.recommendations.push(
          `This would bring your total commitments to ${Math.round(projectedRatio * 100)}% of your income, exceeding the 40% safety limit.`
        );
        result.recommendations.push(
          "Consider a smaller contribution amount or joining a circle with longer intervals."
        );
      } else if (projectedRatio > this.config.warningThreshold) {
        result.decision = "warning";
        result.warning = "approaching_commitment_limit";
        result.recommendations.push(
          `This would bring your commitments to ${Math.round(projectedRatio * 100)}% of income. Ensure you have a financial buffer.`
        );
      }
    } else {
      // Step 5: Fallback to XnScore-based assessment
      result.confidence = "medium";
      const fallbackResult = await this.applyFallbackRules(userId, projectedTotal);

      if (!fallbackResult.canAfford) {
        result.canAfford = false;
        result.decision = "blocked";
        result.reason = fallbackResult.reason;
        result.recommendations.push(...fallbackResult.recommendations);
      } else if (fallbackResult.warning) {
        result.decision = "warning";
        result.warning = fallbackResult.warning;
        result.recommendations.push(...fallbackResult.recommendations);
      }
    }

    // Step 6: Bank balance check
    const balanceResult = await this.checkBankBalance(userId, newContribution);

    if (balanceResult) {
      result.details.currentBankBalance = balanceResult.balance;
      result.details.balanceCoversMonths = balanceResult.coversMonths;

      if (!balanceResult.sufficient) {
        if (balanceResult.coversMonths < this.config.minBalanceMonths) {
          result.canAfford = false;
          result.decision = "blocked";
          result.reason = "insufficient_current_balance";
          result.recommendations.push(
            `Your current balance (${this.formatCurrency(balanceResult.balance)}) doesn't cover even one contribution.`
          );
        } else {
          if (result.decision === "approved") {
            result.decision = "warning";
          }
          result.warning = "low_bank_balance";
          result.recommendations.push(
            `Your balance only covers ${balanceResult.coversMonths} month(s) of contributions. We recommend having at least ${this.config.recommendedBalanceMonths} months covered.`
          );
        }
      }
    }

    // Add positive recommendations if approved
    if (result.canAfford && result.decision === "approved") {
      result.recommendations.push("You're in good financial standing for this commitment!");

      if (result.details.projectedCircleCount === 1) {
        result.recommendations.push("Welcome to your first TandaXn circle!");
      }
    }

    return result;
  }

  // ============================================================================
  // DATA GATHERING
  // ============================================================================

  /**
   * Get all existing active circle commitments for a user
   */
  private async getExistingCommitments(userId: string): Promise<ExistingCommitment[]> {
    const { data: memberships, error } = await supabase
      .from("circle_members")
      .select(`
        circle_id,
        circle:circles(
          id,
          name,
          amount,
          contribution_frequency,
          total_cycles,
          current_cycle,
          status
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    if (error || !memberships) return [];

    return memberships
      .filter((m: any) => m.circle && m.circle.status === "active")
      .map((m: any) => {
        const amount = parseFloat(m.circle.amount);
        const frequency = (m.circle.contribution_frequency || "monthly") as ContributionFrequency;
        const totalCycles = m.circle.total_cycles || m.circle.max_members || 10;
        const currentCycle = m.circle.current_cycle || 1;

        return {
          circleId: m.circle.id,
          circleName: m.circle.name,
          amount,
          frequency,
          monthlyEquivalent: normalizeToMonthly(amount, frequency),
          remainingCycles: Math.max(0, totalCycles - currentCycle + 1),
        };
      });
  }

  /**
   * Get estimated monthly income from various sources
   */
  private async getEstimatedMonthlyIncome(
    userId: string
  ): Promise<{ income: number; source: "plaid" | "manual" | "estimated" } | null> {
    // Try Plaid-connected income first
    const { data: plaidIncome } = await supabase
      .from("income_verifications")
      .select("monthly_income, verification_source")
      .eq("user_id", userId)
      .eq("status", "verified")
      .order("verified_at", { ascending: false })
      .limit(1)
      .single();

    if (plaidIncome && plaidIncome.monthly_income) {
      return {
        income: parseFloat(plaidIncome.monthly_income),
        source: "plaid",
      };
    }

    // Try manually declared income
    const { data: financialProfile } = await supabase
      .from("financial_profiles")
      .select("monthly_income, income_verified")
      .eq("user_id", userId)
      .single();

    if (financialProfile && financialProfile.monthly_income) {
      return {
        income: parseFloat(financialProfile.monthly_income),
        source: financialProfile.income_verified ? "plaid" : "manual",
      };
    }

    // Try XnScore-based estimation (very rough)
    const { data: profile } = await supabase
      .from("profiles")
      .select("xn_score")
      .eq("id", userId)
      .single();

    if (profile && profile.xn_score >= 70) {
      // High XnScore users likely have stable income
      // This is a rough estimation - should be replaced with real data
      return {
        income: 300000, // Estimated 300,000 XAF for high-score users
        source: "estimated",
      };
    }

    return null;
  }

  /**
   * Check user's current bank balance
   */
  private async checkBankBalance(
    userId: string,
    contributionAmount: number
  ): Promise<{ balance: number; coversMonths: number; sufficient: boolean } | null> {
    // Try wallet balance first
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .single();

    let balance = wallet ? parseFloat(wallet.balance || 0) : 0;

    // If Plaid is connected, get actual bank balance
    // (In production, this would call Plaid accounts/balance API)
    const { data: plaidAccount } = await supabase
      .from("linked_accounts")
      .select("current_balance")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("last_synced", { ascending: false })
      .limit(1)
      .single();

    if (plaidAccount && plaidAccount.current_balance) {
      balance = Math.max(balance, parseFloat(plaidAccount.current_balance));
    }

    if (balance === 0) return null;

    const coversMonths = Math.floor(balance / contributionAmount);

    return {
      balance,
      coversMonths,
      sufficient: coversMonths >= this.config.minBalanceMonths,
    };
  }

  /**
   * Apply fallback rules when income data is not available
   */
  private async applyFallbackRules(
    userId: string,
    projectedMonthlyCommitment: number
  ): Promise<{
    canAfford: boolean;
    reason?: string;
    warning?: string;
    recommendations: string[];
  }> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xn_score, is_verified")
      .eq("id", userId)
      .single();

    const xnScore = profile?.xn_score || 50;
    const recommendations: string[] = [];

    // Low XnScore with high commitment
    if (xnScore < this.config.lowXnScoreThreshold) {
      if (projectedMonthlyCommitment > this.config.lowScoreMaxCommitment) {
        return {
          canAfford: false,
          reason: "low_score_high_commitment",
          recommendations: [
            `Your XnScore (${xnScore}) is below ${this.config.lowXnScoreThreshold}. We recommend building your score before taking on larger commitments.`,
            "Consider starting with smaller circles or improving your payment history.",
          ],
        };
      }

      return {
        canAfford: true,
        warning: "low_score_moderate_commitment",
        recommendations: [
          `Your XnScore (${xnScore}) is moderate. Consistent on-time payments will improve your standing.`,
        ],
      };
    }

    // High commitment even for good score
    if (projectedMonthlyCommitment > this.config.lowScoreMaxCommitment * 3) {
      return {
        canAfford: true,
        warning: "high_total_commitment",
        recommendations: [
          "Your total monthly commitment is substantial. Ensure you have stable income to cover all obligations.",
        ],
      };
    }

    return {
      canAfford: true,
      recommendations: [],
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Quick check if user can afford (for UI badge)
   */
  async canUserAfford(
    userId: string,
    amount: number,
    frequency: ContributionFrequency
  ): Promise<boolean> {
    const result = await this.checkAffordability(userId, amount, frequency);
    return result.canAfford;
  }

  /**
   * Get recommended contribution amount for a user
   */
  async getRecommendedAmount(
    userId: string,
    frequency: ContributionFrequency
  ): Promise<{
    min: number;
    recommended: number;
    max: number;
  }> {
    const incomeData = await this.getEstimatedMonthlyIncome(userId);
    const existingCommitments = await this.getExistingCommitments(userId);
    const currentMonthly = existingCommitments.reduce((sum, c) => sum + c.monthlyEquivalent, 0);

    // Default recommendations
    let maxMonthly = this.config.lowScoreMaxCommitment;

    if (incomeData) {
      // Allow up to 30% of income (below warning threshold)
      const availableMonthly = incomeData.income * this.config.warningThreshold - currentMonthly;
      maxMonthly = Math.max(0, availableMonthly);
    }

    // Convert back to the specified frequency
    const toFrequency = (monthly: number): number => {
      switch (frequency) {
        case "daily": return monthly / 30.44;
        case "weekly": return monthly / 4.33;
        case "biweekly": return monthly / 2.17;
        case "monthly": return monthly;
        case "quarterly": return monthly * 3;
      }
    };

    const min = toFrequency(5000); // Minimum 5,000 XAF/month equivalent
    const max = toFrequency(maxMonthly);
    const recommended = toFrequency(maxMonthly * 0.5); // Half of max

    return {
      min: Math.round(min),
      recommended: Math.round(recommended),
      max: Math.round(max),
    };
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat("fr-CM", {
      style: "currency",
      currency: "XAF",
      minimumFractionDigits: 0,
    }).format(amount);
  }
}

// Export default instance
export const contributionAffordabilityService = new ContributionAffordabilityService();

// Export convenience functions
export const checkContributionAffordability = (
  userId: string,
  amount: number,
  frequency: ContributionFrequency
) => contributionAffordabilityService.checkAffordability(userId, amount, frequency);

export const canUserAffordContribution = (
  userId: string,
  amount: number,
  frequency: ContributionFrequency
) => contributionAffordabilityService.canUserAfford(userId, amount, frequency);

export const getRecommendedContributionAmount = (
  userId: string,
  frequency: ContributionFrequency
) => contributionAffordabilityService.getRecommendedAmount(userId, frequency);
