import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

/**
 * TANDAXN SAVINGS GOALS SYSTEM
 *
 * Three tiers of savings:
 * 1. FLEXIBLE - Withdraw anytime, lower interest (2% APY)
 * 2. EMERGENCY - 24-48hr withdrawal delay, medium interest (3.5% APY)
 * 3. LOCKED - Fixed term with maturity date, highest interest (5-7% APY)
 *
 * Key Features:
 * - Interest accrues but is only "unlocked" after meeting conditions
 * - Auto-save from circle payouts
 * - Goal tracking with targets and milestones
 * - Transfer between goal types
 *
 * Data Layer: Supabase (savings_goal_types, user_savings_goals, savings_transactions)
 * Amounts: DB stores cents (BIGINT), context exposes dollars (number)
 */

// ==================== TYPES ====================

export type GoalType = "flexible" | "emergency" | "locked";

export type GoalStatus =
  | "active"      // Currently saving
  | "paused"      // User paused contributions
  | "completed"   // Target reached
  | "matured"     // Locked goal reached maturity
  | "closed";     // Goal closed/withdrawn

export type TransactionType =
  | "deposit"           // Manual deposit
  | "auto_deposit"      // Auto-save from payout
  | "withdrawal"        // User withdrawal
  | "interest_credit"   // Interest added
  | "transfer_in"       // Transfer from another goal
  | "transfer_out"      // Transfer to another goal
  | "bonus";            // Promotional bonus

export interface GoalTransaction {
  id: string;
  goalId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  sourceGoalId?: string;      // For transfers
  destinationGoalId?: string; // For transfers
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  type: GoalType;
  status: GoalStatus;
  currency: string;

  // Balances
  currentBalance: number;
  targetAmount: number;

  // Interest
  interestRate: number;        // APY as decimal (0.05 = 5%)
  interestEarned: number;      // Total interest earned
  interestUnlocked: number;    // Interest available for withdrawal
  lastInterestDate: string;    // Last interest calculation

  // For locked goals
  lockDurationMonths?: number;
  maturityDate?: string;
  earlyWithdrawalPenalty?: number; // Percentage penalty as decimal (0.10 = 10%)

  // Auto-save settings
  autoSaveEnabled: boolean;
  autoSavePercent: number;     // Percent of payouts to auto-save
  autoSaveFromCircles: string[]; // Circle IDs to auto-save from
  autoSavePriority: number;    // Priority order (1 = highest, used for replenishment)
  autoReplenish: boolean;      // Auto-replenish from payouts when below target

  // Milestones
  milestones: GoalMilestone[];

  // DB reference
  savingsGoalTypeId?: string;
  savingsGoalTypeCode?: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  closedAt?: string;
}

export interface GoalMilestone {
  id: string;
  targetPercent: number;  // 25, 50, 75, 100
  reachedAt?: string;
  celebrated: boolean;
}

// ==================== DB ROW TYPES ====================

type SavingsGoalTypeRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  interest_rate: number;
  interest_frequency: string;
  minimum_balance_cents: number;
  lock_period_days: number;
  early_withdrawal_penalty_percent: number;
  icon: string | null;
  emoji: string | null;
  color: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type UserSavingsGoalRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  savings_goal_type_id: string;
  name: string;
  emoji: string | null;
  target_amount_cents: number | null;
  target_date: string | null;
  current_balance_cents: number;
  total_deposits_cents: number;
  total_withdrawals_cents: number;
  total_interest_earned_cents: number;
  last_interest_accrual_at: string | null;
  accrued_interest_cents: number;
  locked_until: string | null;
  goal_status: string;
  last_deposit_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined
  savings_goal_types?: SavingsGoalTypeRow;
};

type SavingsTransactionRow = {
  id: string;
  savings_goal_id: string;
  user_id: string;
  transaction_type: string;
  source: string | null;
  amount_cents: number;
  balance_before_cents: number;
  balance_after_cents: number;
  wallet_transaction_id: string | null;
  transaction_status: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

// ==================== TRANSFORM HELPERS ====================

const centsToDollars = (cents: number | null): number => (cents ?? 0) / 100;
const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);

/** Derive the 3-tier concept from DB goal type properties */
const deriveTierFromType = (goalType: SavingsGoalTypeRow): GoalType => {
  if (goalType.lock_period_days >= 365 && goalType.early_withdrawal_penalty_percent >= 5) return "locked";
  if (goalType.lock_period_days > 0 || goalType.early_withdrawal_penalty_percent > 0) return "emergency";
  return "flexible";
};

/** Generate milestone objects from balance/target */
const generateMilestones = (currentBalance: number, targetAmount: number, createdAt: string): GoalMilestone[] => {
  const progress = targetAmount > 0 ? (currentBalance / targetAmount) * 100 : 0;
  return [25, 50, 75, 100].map((pct, i) => ({
    id: `m${i + 1}`,
    targetPercent: pct,
    reachedAt: progress >= pct ? createdAt : undefined,
    celebrated: progress >= pct,
  }));
};

/** Transform DB row to app SavingsGoal */
const rowToGoal = (row: UserSavingsGoalRow): SavingsGoal => {
  const goalType = row.savings_goal_types;
  const tier = goalType ? deriveTierFromType(goalType) : "flexible";
  const meta = (row.metadata || {}) as Record<string, unknown>;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji || goalType?.emoji || "🎯",
    type: tier,
    status: row.goal_status as GoalStatus,
    currency: "USD",
    currentBalance: centsToDollars(row.current_balance_cents),
    targetAmount: centsToDollars(row.target_amount_cents),
    interestRate: goalType?.interest_rate ?? 0,
    interestEarned: centsToDollars(row.total_interest_earned_cents),
    interestUnlocked: centsToDollars(row.accrued_interest_cents),
    lastInterestDate: row.last_interest_accrual_at || row.created_at,
    lockDurationMonths: goalType ? Math.round(goalType.lock_period_days / 30) : undefined,
    maturityDate: row.locked_until || undefined,
    earlyWithdrawalPenalty: goalType ? goalType.early_withdrawal_penalty_percent / 100 : undefined,
    autoSaveEnabled: Boolean(meta.autoSaveEnabled),
    autoSavePercent: (meta.autoSavePercent as number) || 0,
    autoSaveFromCircles: (meta.autoSaveFromCircles as string[]) || [],
    autoSavePriority: (meta.autoSavePriority as number) || 99,
    autoReplenish: Boolean(meta.autoReplenish),
    milestones: generateMilestones(
      centsToDollars(row.current_balance_cents),
      centsToDollars(row.target_amount_cents),
      row.created_at
    ),
    savingsGoalTypeId: row.savings_goal_type_id,
    savingsGoalTypeCode: goalType?.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  };
};

/** Transform DB row to app GoalTransaction */
const rowToTransaction = (row: SavingsTransactionRow): GoalTransaction => {
  const meta = row.metadata || {};
  return {
    id: row.id,
    goalId: row.savings_goal_id,
    type: row.transaction_type as TransactionType,
    amount: centsToDollars(row.amount_cents),
    balanceAfter: centsToDollars(row.balance_after_cents),
    description: row.source || row.transaction_type,
    createdAt: row.created_at,
    sourceGoalId: (meta as Record<string, string>).sourceGoalId,
    destinationGoalId: (meta as Record<string, string>).destinationGoalId,
  };
};

// ==================== GOAL TYPE CONFIGS (kept for UI reference) ====================

export const GOAL_TYPES = {
  flexible: {
    type: "flexible" as const,
    name: "Flexible Savings",
    description: "Withdraw anytime with no penalties",
    icon: "wallet-outline",
    emoji: "💰",
    color: "#10B981",
    bgColor: "#D1FAE5",
    interestRate: 0.02,
    minDeposit: 5,
    maxWithdrawDelay: 0,
    withdrawalPenalty: 0,
    features: [
      "Withdraw anytime",
      "No penalties",
      "2% APY interest",
      "Great for short-term goals",
    ],
  },
  emergency: {
    type: "emergency" as const,
    name: "Emergency Fund",
    description: "24-48hr withdrawal delay for emergencies",
    icon: "shield-checkmark-outline",
    emoji: "🛡️",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    interestRate: 0.035,
    minDeposit: 10,
    maxWithdrawDelay: 48,
    withdrawalPenalty: 0,
    features: [
      "24-48hr withdrawal delay",
      "Higher interest (3.5% APY)",
      "Emergency access available",
      "Builds financial security",
    ],
  },
  locked: {
    type: "locked" as const,
    name: "Locked Savings",
    description: "Fixed term for maximum returns",
    icon: "lock-closed-outline",
    emoji: "🔒",
    color: "#6366F1",
    bgColor: "#EEF2FF",
    interestRate: 0.05,
    minDeposit: 50,
    maxWithdrawDelay: null,
    withdrawalPenalty: 0.10,
    features: [
      "Highest interest (5-7% APY)",
      "Fixed maturity date",
      "Early withdrawal penalty",
      "Best for long-term goals",
    ],
  },
};

export const LOCKED_TERM_OPTIONS = [
  { months: 3, interestRate: 0.05, label: "3 Months", bonus: "5% APY" },
  { months: 6, interestRate: 0.055, label: "6 Months", bonus: "5.5% APY" },
  { months: 12, interestRate: 0.065, label: "12 Months", bonus: "6.5% APY" },
  { months: 24, interestRate: 0.07, label: "24 Months", bonus: "7% APY" },
];

export const GOAL_CATEGORIES = [
  { id: "home", name: "Home", emoji: "🏠", suggestions: ["Down Payment", "Renovation", "Furniture"] },
  { id: "education", name: "Education", emoji: "📚", suggestions: ["Tuition", "Books", "Courses"] },
  { id: "emergency", name: "Emergency", emoji: "🛡️", suggestions: ["Medical Fund", "Job Loss Fund", "Car Repairs"] },
  { id: "travel", name: "Travel", emoji: "✈️", suggestions: ["Vacation", "Family Visit", "Honeymoon"] },
  { id: "vehicle", name: "Vehicle", emoji: "🚗", suggestions: ["New Car", "Motorcycle", "Car Repairs"] },
  { id: "business", name: "Business", emoji: "💼", suggestions: ["Startup Fund", "Equipment", "Inventory"] },
  { id: "wedding", name: "Wedding", emoji: "💒", suggestions: ["Ceremony", "Honeymoon", "Ring"] },
  { id: "retirement", name: "Retirement", emoji: "🏖️", suggestions: ["Pension", "Investment", "Property"] },
  { id: "other", name: "Other", emoji: "🎯", suggestions: ["Custom Goal"] },
];

// ==================== CONTEXT ====================

interface SavingsContextType {
  goals: SavingsGoal[];
  transactions: GoalTransaction[];
  isLoading: boolean;
  goalTypes: SavingsGoalTypeRow[];

  // CRUD Operations
  createGoal: (goal: {
    name: string;
    emoji?: string;
    type: GoalType;
    currency?: string;
    currentBalance?: number;
    targetAmount: number;
    autoSaveEnabled?: boolean;
    autoSavePercent?: number;
    autoSaveFromCircles?: string[];
    autoReplenish?: boolean;
    lockDurationMonths?: number;
    goalTypeCode?: string;
  }) => Promise<SavingsGoal>;
  updateGoal: (goalId: string, updates: Partial<SavingsGoal>) => Promise<void>;
  closeGoal: (goalId: string) => Promise<void>;
  pauseGoal: (goalId: string) => Promise<void>;
  resumeGoal: (goalId: string) => Promise<void>;
  deleteGoal: (goalId: string) => Promise<void>;

  // Transactions
  deposit: (goalId: string, amount: number, description?: string) => Promise<GoalTransaction>;
  withdraw: (goalId: string, amount: number, description?: string) => Promise<GoalTransaction>;
  transfer: (fromGoalId: string, toGoalId: string, amount: number) => Promise<void>;

  // Queries
  getGoalById: (goalId: string) => SavingsGoal | undefined;
  getGoalsByType: (type: GoalType) => SavingsGoal[];
  getActiveGoals: () => SavingsGoal[];
  getGoalTransactions: (goalId: string) => GoalTransaction[];

  // Calculations
  getTotalSavings: () => number;
  getTotalInterestEarned: () => number;
  getTotalInterestUnlocked: () => number;
  calculateInterest: (goalId: string) => number;
  getProjectedBalance: (goalId: string, months: number) => number;

  // Tier management
  getGoalTypesList: () => SavingsGoalTypeRow[];
  upgradeTier: (goalId: string, newTypeCode: string) => Promise<void>;

  // Auto-save
  processAutoSave: (circleId: string, payoutAmount: number) => Promise<number>;

  // Refresh
  refreshGoals: () => Promise<void>;
}

const SavingsContext = createContext<SavingsContextType | null>(null);

/** Maps tier + optional category to a DB savings_goal_types code */
const mapToGoalTypeCode = (tier: GoalType, goalTypeCode?: string): string => {
  if (goalTypeCode) return goalTypeCode;
  if (tier === "locked") return "locked";
  if (tier === "emergency") return "emergency";
  return "general";
};

export function SavingsProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [goalTypes, setGoalTypes] = useState<SavingsGoalTypeRow[]>([]);
  const [walletId, setWalletId] = useState<string | null>(null);

  // ==================== DATA LOADING ====================

  const fetchGoals = useCallback(async () => {
    if (!session || !user?.id) {
      setGoals([]);
      setTransactions([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Fetch goal types (reference table)
      const { data: typesData } = await supabase
        .from("savings_goal_types")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (typesData) setGoalTypes(typesData);

      // Fetch user's wallet
      const { data: walletData } = await supabase
        .from("user_wallets")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (walletData) setWalletId(walletData.id);

      // Fetch goals with joined type info
      const { data: goalsData, error: goalsError } = await supabase
        .from("user_savings_goals")
        .select("*, savings_goal_types(*)")
        .eq("user_id", user.id)
        .neq("goal_status", "closed")
        .order("created_at", { ascending: false });

      if (goalsError) throw goalsError;
      setGoals((goalsData || []).map(rowToGoal));

      // Fetch transactions
      const { data: txData } = await supabase
        .from("savings_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setTransactions((txData || []).map(rowToTransaction));
    } catch (error) {
      console.error("Failed to load savings data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [session, user?.id]);

  // Load data + real-time subscription
  useEffect(() => {
    if (!session) return;
    fetchGoals();

    const channel = supabase
      .channel("savings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_savings_goals" }, () => fetchGoals())
      .on("postgres_changes", { event: "*", schema: "public", table: "savings_transactions" }, () => fetchGoals())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, fetchGoals]);

  // ==================== CRUD OPERATIONS ====================

  const createGoal = async (goalData: {
    name: string;
    emoji?: string;
    type: GoalType;
    currency?: string;
    currentBalance?: number;
    targetAmount: number;
    autoSaveEnabled?: boolean;
    autoSavePercent?: number;
    autoSaveFromCircles?: string[];
    autoReplenish?: boolean;
    lockDurationMonths?: number;
    goalTypeCode?: string;
  }): Promise<SavingsGoal> => {
    if (!user?.id) throw new Error("Must be logged in");
    if (!walletId) throw new Error("No wallet found. Please set up a wallet first.");

    const typeCode = mapToGoalTypeCode(goalData.type, goalData.goalTypeCode);
    const matchingType = goalTypes.find(t => t.code === typeCode);
    if (!matchingType) throw new Error(`Invalid goal type: ${typeCode}`);

    // Calculate locked_until for locked goals
    let lockedUntil: string | null = null;
    if (goalData.type === "locked" && goalData.lockDurationMonths) {
      const maturity = new Date();
      maturity.setMonth(maturity.getMonth() + goalData.lockDurationMonths);
      lockedUntil = maturity.toISOString().split("T")[0];
    }

    // Build metadata for auto-save settings
    const metadata: Record<string, unknown> = {};
    if (goalData.autoSaveEnabled) metadata.autoSaveEnabled = true;
    if (goalData.autoSavePercent) metadata.autoSavePercent = goalData.autoSavePercent;
    if (goalData.autoSaveFromCircles?.length) metadata.autoSaveFromCircles = goalData.autoSaveFromCircles;
    if (goalData.autoReplenish) metadata.autoReplenish = true;

    const { data, error } = await supabase
      .from("user_savings_goals")
      .insert({
        user_id: user.id,
        wallet_id: walletId,
        savings_goal_type_id: matchingType.id,
        name: goalData.name,
        emoji: goalData.emoji || null,
        target_amount_cents: dollarsToCents(goalData.targetAmount),
        current_balance_cents: dollarsToCents(goalData.currentBalance || 0),
        total_deposits_cents: dollarsToCents(goalData.currentBalance || 0),
        locked_until: lockedUntil,
        goal_status: "active",
        metadata,
      })
      .select("*, savings_goal_types(*)")
      .single();

    if (error) throw new Error(error.message);
    return rowToGoal(data);
  };

  const updateGoal = async (goalId: string, updates: Partial<SavingsGoal>) => {
    if (!user?.id) throw new Error("Must be logged in");

    const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.targetAmount !== undefined) dbUpdates.target_amount_cents = dollarsToCents(updates.targetAmount);
    if (updates.status !== undefined) dbUpdates.goal_status = updates.status;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

    // Update auto-save settings in metadata
    if (updates.autoSaveEnabled !== undefined || updates.autoSavePercent !== undefined ||
        updates.autoSaveFromCircles !== undefined || updates.autoReplenish !== undefined) {
      const goal = goals.find(g => g.id === goalId);
      const currentMeta = goal ? {
        autoSaveEnabled: goal.autoSaveEnabled,
        autoSavePercent: goal.autoSavePercent,
        autoSaveFromCircles: goal.autoSaveFromCircles,
        autoSavePriority: goal.autoSavePriority,
        autoReplenish: goal.autoReplenish,
      } : {};
      dbUpdates.metadata = {
        ...currentMeta,
        ...(updates.autoSaveEnabled !== undefined && { autoSaveEnabled: updates.autoSaveEnabled }),
        ...(updates.autoSavePercent !== undefined && { autoSavePercent: updates.autoSavePercent }),
        ...(updates.autoSaveFromCircles !== undefined && { autoSaveFromCircles: updates.autoSaveFromCircles }),
        ...(updates.autoReplenish !== undefined && { autoReplenish: updates.autoReplenish }),
      };
    }

    const { error } = await supabase
      .from("user_savings_goals")
      .update(dbUpdates)
      .eq("id", goalId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
  };

  const closeGoal = async (goalId: string) => {
    await updateGoal(goalId, {
      status: "closed",
      closedAt: new Date().toISOString(),
    });
  };

  const pauseGoal = async (goalId: string) => {
    await updateGoal(goalId, { status: "paused" });
  };

  const resumeGoal = async (goalId: string) => {
    await updateGoal(goalId, { status: "active" });
  };

  const deleteGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // If has balance, create a withdrawal transaction first
    if (goal.currentBalance > 0) {
      await withdraw(goalId, goal.currentBalance, "Goal deletion - funds returned to wallet");
    }

    // Soft delete by setting status to closed
    await closeGoal(goalId);
  };

  // ==================== TRANSACTIONS ====================

  const deposit = async (
    goalId: string,
    amount: number,
    description?: string
  ): Promise<GoalTransaction> => {
    if (!user?.id) throw new Error("Must be logged in");
    const goal = goals.find(g => g.id === goalId);
    if (!goal) throw new Error("Goal not found");

    const amountCents = dollarsToCents(amount);
    const balanceBeforeCents = dollarsToCents(goal.currentBalance);
    const balanceAfterCents = balanceBeforeCents + amountCents;

    // Insert transaction
    const { data: txData, error: txError } = await supabase
      .from("savings_transactions")
      .insert({
        savings_goal_id: goalId,
        user_id: user.id,
        transaction_type: "deposit",
        source: description || "Deposit",
        amount_cents: amountCents,
        balance_before_cents: balanceBeforeCents,
        balance_after_cents: balanceAfterCents,
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    // Update goal balance
    const newTotalDeposits = dollarsToCents(goal.currentBalance) + amountCents;
    const goalUpdate: Record<string, unknown> = {
      current_balance_cents: balanceAfterCents,
      total_deposits_cents: (goal as unknown as { totalDeposits?: number }).totalDeposits
        ? dollarsToCents((goal as unknown as { totalDeposits: number }).totalDeposits) + amountCents
        : amountCents,
      last_deposit_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Check if goal completed
    const targetCents = dollarsToCents(goal.targetAmount);
    if (balanceAfterCents >= targetCents && goal.status === "active") {
      goalUpdate.goal_status = "completed";
      goalUpdate.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("user_savings_goals")
      .update(goalUpdate)
      .eq("id", goalId);

    if (updateError) throw new Error(updateError.message);

    return rowToTransaction(txData);
  };

  const withdraw = async (
    goalId: string,
    amount: number,
    description?: string
  ): Promise<GoalTransaction> => {
    if (!user?.id) throw new Error("Must be logged in");
    const goal = goals.find(g => g.id === goalId);
    if (!goal) throw new Error("Goal not found");

    if (amount > goal.currentBalance) {
      throw new Error("Insufficient balance");
    }

    let actualAmount = amount;

    // Apply early withdrawal penalty for locked goals not yet matured
    if (goal.type === "locked" && goal.maturityDate) {
      const now = new Date();
      const maturity = new Date(goal.maturityDate);
      if (now < maturity) {
        const penalty = amount * (goal.earlyWithdrawalPenalty || 0.10);
        actualAmount = amount - penalty;
      }
    }

    const amountCents = dollarsToCents(actualAmount);
    const balanceBeforeCents = dollarsToCents(goal.currentBalance);
    const balanceAfterCents = balanceBeforeCents - dollarsToCents(amount); // Deduct full amount from balance

    const { data: txData, error: txError } = await supabase
      .from("savings_transactions")
      .insert({
        savings_goal_id: goalId,
        user_id: user.id,
        transaction_type: "withdrawal",
        source: description || "Withdrawal",
        amount_cents: -amountCents, // Negative for withdrawal
        balance_before_cents: balanceBeforeCents,
        balance_after_cents: balanceAfterCents,
        metadata: {
          requestedAmount: dollarsToCents(amount),
          penaltyAmount: dollarsToCents(amount - actualAmount),
          netAmount: amountCents,
        },
      })
      .select()
      .single();

    if (txError) throw new Error(txError.message);

    // Update goal balance
    const { error: updateError } = await supabase
      .from("user_savings_goals")
      .update({
        current_balance_cents: balanceAfterCents,
        total_withdrawals_cents: dollarsToCents(amount),
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);

    if (updateError) throw new Error(updateError.message);

    return rowToTransaction(txData);
  };

  const transfer = async (
    fromGoalId: string,
    toGoalId: string,
    amount: number
  ) => {
    if (!user?.id) throw new Error("Must be logged in");
    const fromGoal = goals.find(g => g.id === fromGoalId);
    const toGoal = goals.find(g => g.id === toGoalId);

    if (!fromGoal || !toGoal) throw new Error("Goal not found");
    if (amount > fromGoal.currentBalance) throw new Error("Insufficient balance");

    const amountCents = dollarsToCents(amount);
    const fromBalanceBefore = dollarsToCents(fromGoal.currentBalance);
    const fromBalanceAfter = fromBalanceBefore - amountCents;
    const toBalanceBefore = dollarsToCents(toGoal.currentBalance);
    const toBalanceAfter = toBalanceBefore + amountCents;

    // Insert both transactions
    const { error: txError } = await supabase
      .from("savings_transactions")
      .insert([
        {
          savings_goal_id: fromGoalId,
          user_id: user.id,
          transaction_type: "transfer_out",
          source: `Transfer to ${toGoal.name}`,
          amount_cents: -amountCents,
          balance_before_cents: fromBalanceBefore,
          balance_after_cents: fromBalanceAfter,
          metadata: { destinationGoalId: toGoalId },
        },
        {
          savings_goal_id: toGoalId,
          user_id: user.id,
          transaction_type: "transfer_in",
          source: `Transfer from ${fromGoal.name}`,
          amount_cents: amountCents,
          balance_before_cents: toBalanceBefore,
          balance_after_cents: toBalanceAfter,
          metadata: { sourceGoalId: fromGoalId },
        },
      ]);

    if (txError) throw new Error(txError.message);

    // Update both goal balances
    const now = new Date().toISOString();
    const { error: fromError } = await supabase
      .from("user_savings_goals")
      .update({ current_balance_cents: fromBalanceAfter, updated_at: now })
      .eq("id", fromGoalId);

    const { error: toError } = await supabase
      .from("user_savings_goals")
      .update({
        current_balance_cents: toBalanceAfter,
        last_deposit_at: now,
        updated_at: now,
      })
      .eq("id", toGoalId);

    if (fromError) throw new Error(fromError.message);
    if (toError) throw new Error(toError.message);
  };

  // ==================== QUERIES ====================

  const getGoalById = (goalId: string) => goals.find(g => g.id === goalId);

  const getGoalsByType = (type: GoalType) =>
    goals.filter(g => g.type === type);

  const getActiveGoals = () =>
    goals.filter(g => ["active", "paused"].includes(g.status));

  const getGoalTransactions = (goalId: string) =>
    transactions
      .filter(t => t.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ==================== CALCULATIONS ====================

  const getTotalSavings = () =>
    goals
      .filter(g => g.status !== "closed")
      .reduce((sum, g) => sum + g.currentBalance, 0);

  const getTotalInterestEarned = () =>
    goals.reduce((sum, g) => sum + g.interestEarned, 0);

  const getTotalInterestUnlocked = () =>
    goals.reduce((sum, g) => sum + g.interestUnlocked, 0);

  const calculateInterest = (goalId: string): number => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;

    const daysSinceLastCalc = Math.floor(
      (Date.now() - new Date(goal.lastInterestDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const dailyRate = goal.interestRate / 365;
    return goal.currentBalance * dailyRate * daysSinceLastCalc;
  };

  const getProjectedBalance = (goalId: string, months: number): number => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;

    const n = 12;
    const t = months / 12;
    return goal.currentBalance * Math.pow(1 + goal.interestRate / n, n * t);
  };

  // ==================== TIER MANAGEMENT ====================

  const getGoalTypesList = () => goalTypes;

  const upgradeTier = async (goalId: string, newTypeCode: string) => {
    if (!user?.id) throw new Error("Must be logged in");
    const newType = goalTypes.find(t => t.code === newTypeCode);
    if (!newType) throw new Error(`Invalid tier: ${newTypeCode}`);

    // Calculate locked_until for locked tier
    let lockedUntil: string | null = null;
    if (newType.lock_period_days > 0) {
      const maturity = new Date();
      maturity.setDate(maturity.getDate() + newType.lock_period_days);
      lockedUntil = maturity.toISOString().split("T")[0];
    }

    const { error } = await supabase
      .from("user_savings_goals")
      .update({
        savings_goal_type_id: newType.id,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
  };

  // ==================== AUTO-SAVE ====================

  const processAutoSave = async (circleId: string, payoutAmount: number): Promise<number> => {
    let remainingPayout = payoutAmount;

    const eligibleGoals = goals.filter(
      g =>
        g.autoSaveEnabled &&
        (g.autoSaveFromCircles.length === 0 || g.autoSaveFromCircles.includes(circleId)) &&
        g.status === "active"
    );

    const sortedGoals = [...eligibleGoals].sort((a, b) => {
      const aReplenishNeeded = a.autoReplenish && a.currentBalance < a.targetAmount;
      const bReplenishNeeded = b.autoReplenish && b.currentBalance < b.targetAmount;

      if (aReplenishNeeded && !bReplenishNeeded) return -1;
      if (!aReplenishNeeded && bReplenishNeeded) return 1;

      return (a.autoSavePriority || 99) - (b.autoSavePriority || 99);
    });

    for (const goal of sortedGoals) {
      if (remainingPayout <= 0) break;

      let autoSaveAmount = (payoutAmount * goal.autoSavePercent) / 100;

      if (goal.autoReplenish && goal.currentBalance < goal.targetAmount) {
        const amountNeeded = goal.targetAmount - goal.currentBalance;
        autoSaveAmount = Math.min(autoSaveAmount, amountNeeded, remainingPayout);
      } else {
        autoSaveAmount = Math.min(autoSaveAmount, remainingPayout);
      }

      if (autoSaveAmount > 0) {
        await deposit(
          goal.id,
          autoSaveAmount,
          goal.autoReplenish
            ? "Auto-replenish from circle payout"
            : "Auto-save from circle payout"
        );
        remainingPayout -= autoSaveAmount;
      }
    }

    return remainingPayout;
  };

  return (
    <SavingsContext.Provider
      value={{
        goals,
        transactions,
        isLoading,
        goalTypes,
        createGoal,
        updateGoal,
        closeGoal,
        pauseGoal,
        resumeGoal,
        deleteGoal,
        deposit,
        withdraw,
        transfer,
        getGoalById,
        getGoalsByType,
        getActiveGoals,
        getGoalTransactions,
        getTotalSavings,
        getTotalInterestEarned,
        getTotalInterestUnlocked,
        calculateInterest,
        getProjectedBalance,
        getGoalTypesList,
        upgradeTier,
        processAutoSave,
        refreshGoals: fetchGoals,
      }}
    >
      {children}
    </SavingsContext.Provider>
  );
}

export function useSavings() {
  const context = useContext(SavingsContext);
  if (!context) {
    throw new Error("useSavings must be used within a SavingsProvider");
  }
  return context;
}

export { GOAL_TYPES as SAVINGS_TYPES };
