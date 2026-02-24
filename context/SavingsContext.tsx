import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAutoPost } from "../lib/autoPost";
import { supabase } from "../lib/supabase";

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
  earlyWithdrawalPenalty?: number; // Percentage penalty

  // Auto-save settings
  autoSaveEnabled: boolean;
  autoSavePercent: number;     // Percent of payouts to auto-save
  autoSaveFromCircles: string[]; // Circle IDs to auto-save from
  autoSavePriority: number;    // Priority order (1 = highest, used for replenishment)
  autoReplenish: boolean;      // Auto-replenish from payouts when below target (for emergency funds)

  // Milestones
  milestones: GoalMilestone[];

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

// ==================== GOAL TYPE CONFIGS ====================

export const GOAL_TYPES = {
  flexible: {
    type: "flexible" as const,
    name: "Flexible Savings",
    description: "Withdraw anytime with no penalties",
    icon: "wallet-outline",
    emoji: "💰",
    color: "#10B981",
    bgColor: "#D1FAE5",
    interestRate: 0.02,        // 2% APY
    minDeposit: 5,
    maxWithdrawDelay: 0,       // Instant
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
    interestRate: 0.035,       // 3.5% APY
    minDeposit: 10,
    maxWithdrawDelay: 48,      // 48 hours
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
    interestRate: 0.05,        // 5-7% APY based on term
    minDeposit: 50,
    maxWithdrawDelay: null,    // Until maturity
    withdrawalPenalty: 0.10,   // 10% early withdrawal penalty
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

  // CRUD Operations
  createGoal: (goal: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt" | "interestEarned" | "interestUnlocked" | "lastInterestDate" | "milestones" | "status" | "autoSavePriority" | "autoReplenish"> & { autoSavePriority?: number; autoReplenish?: boolean }) => Promise<SavingsGoal>;
  updateGoal: (goalId: string, updates: Partial<SavingsGoal>) => Promise<void>;
  closeGoal: (goalId: string) => Promise<void>;
  pauseGoal: (goalId: string) => Promise<void>;
  resumeGoal: (goalId: string) => Promise<void>;

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

  // Auto-save
  processAutoSave: (circleId: string, payoutAmount: number) => Promise<void>;
}

const SavingsContext = createContext<SavingsContextType | null>(null);

const STORAGE_KEY_GOALS = "@tandaxn_savings_goals";
const STORAGE_KEY_TRANSACTIONS = "@tandaxn_savings_transactions";
const MOCK_USER_ID = "user_001";

export function SavingsProvider({ children }: { children: ReactNode }) {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [transactions, setTransactions] = useState<GoalTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [goalsData, transactionsData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_GOALS),
        AsyncStorage.getItem(STORAGE_KEY_TRANSACTIONS),
      ]);

      if (goalsData) {
        setGoals(JSON.parse(goalsData));
      } else {
        // New users start with no goals - empty state encourages them to create their own
        setGoals([]);
      }

      if (transactionsData) {
        setTransactions(JSON.parse(transactionsData));
      }
    } catch (error) {
      console.error("Failed to load savings data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveGoals = async (newGoals: SavingsGoal[]) => {
    setGoals(newGoals);
    await AsyncStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(newGoals));
  };

  const saveTransactions = async (newTransactions: GoalTransaction[]) => {
    setTransactions(newTransactions);
    await AsyncStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(newTransactions));
  };

  const createSampleGoals = (): SavingsGoal[] => {
    const now = new Date().toISOString();
    return [
      {
        id: "goal_sample_1",
        userId: MOCK_USER_ID,
        name: "First Home in Ghana",
        emoji: "🏠",
        type: "locked",
        status: "active",
        currency: "USD",
        currentBalance: 5000,
        targetAmount: 15000,
        interestRate: 0.065,
        interestEarned: 31.42,
        interestUnlocked: 0,
        lastInterestDate: now,
        lockDurationMonths: 12,
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        earlyWithdrawalPenalty: 0.10,
        autoSaveEnabled: true,
        autoSavePercent: 20,
        autoSaveFromCircles: [],
        autoSavePriority: 2,
        autoReplenish: false,
        milestones: [
          { id: "m1", targetPercent: 25, reachedAt: now, celebrated: true },
          { id: "m2", targetPercent: 50, celebrated: false },
          { id: "m3", targetPercent: 75, celebrated: false },
          { id: "m4", targetPercent: 100, celebrated: false },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "goal_sample_2",
        userId: MOCK_USER_ID,
        name: "Emergency Fund",
        emoji: "🛡️",
        type: "emergency",
        status: "active",
        currency: "USD",
        currentBalance: 2500,
        targetAmount: 5000,
        interestRate: 0.035,
        interestEarned: 16.41,
        interestUnlocked: 16.41,
        lastInterestDate: now,
        autoSaveEnabled: true,
        autoSavePercent: 15,
        autoSaveFromCircles: [],
        autoSavePriority: 1,
        autoReplenish: true,
        milestones: [
          { id: "m1", targetPercent: 25, reachedAt: now, celebrated: true },
          { id: "m2", targetPercent: 50, reachedAt: now, celebrated: true },
          { id: "m3", targetPercent: 75, celebrated: false },
          { id: "m4", targetPercent: 100, celebrated: false },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
  };

  // ==================== CRUD OPERATIONS ====================

  const createGoal = async (
    goalData: Omit<SavingsGoal, "id" | "createdAt" | "updatedAt" | "interestEarned" | "interestUnlocked" | "lastInterestDate" | "milestones" | "status" | "autoSavePriority" | "autoReplenish"> & { autoSavePriority?: number; autoReplenish?: boolean }
  ): Promise<SavingsGoal> => {
    const now = new Date().toISOString();

    // Calculate priority - highest priority (lowest number) for emergency funds with replenish
    const existingPriorities = goals
      .filter(g => g.autoSaveEnabled && g.status === "active")
      .map(g => g.autoSavePriority || 99);
    const maxPriority = existingPriorities.length > 0 ? Math.max(...existingPriorities) : 0;

    const newGoal: SavingsGoal = {
      ...goalData,
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: "active",
      interestEarned: 0,
      interestUnlocked: 0,
      lastInterestDate: now,
      autoSavePriority: goalData.autoSavePriority ?? (goalData.autoReplenish ? 1 : maxPriority + 1),
      autoReplenish: goalData.autoReplenish ?? false,
      milestones: [
        { id: "m1", targetPercent: 25, celebrated: false },
        { id: "m2", targetPercent: 50, celebrated: false },
        { id: "m3", targetPercent: 75, celebrated: false },
        { id: "m4", targetPercent: 100, celebrated: false },
      ],
      createdAt: now,
      updatedAt: now,
    };

    await saveGoals([...goals, newGoal]);

    // Auto-post: New savings goal created
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      createAutoPost(session.user.id, "goal_created", newGoal.id, "savings_goal", {
        goalName: newGoal.name,
        targetAmount: newGoal.targetAmount,
        goalType: newGoal.type,
      });
    }

    return newGoal;
  };

  const updateGoal = async (goalId: string, updates: Partial<SavingsGoal>) => {
    const updated = goals.map(g =>
      g.id === goalId
        ? { ...g, ...updates, updatedAt: new Date().toISOString() }
        : g
    );
    await saveGoals(updated);
  };

  const closeGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // For locked goals, check if matured
    if (goal.type === "locked" && goal.maturityDate) {
      const now = new Date();
      const maturity = new Date(goal.maturityDate);
      if (now < maturity) {
        // Apply early withdrawal penalty
        const penalty = goal.currentBalance * (goal.earlyWithdrawalPenalty || 0.10);
        // Penalty would be deducted in withdrawal
      }
    }

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

  // ==================== TRANSACTIONS ====================

  const deposit = async (
    goalId: string,
    amount: number,
    description?: string
  ): Promise<GoalTransaction> => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) throw new Error("Goal not found");

    const typeConfig = GOAL_TYPES[goal.type];
    if (amount < typeConfig.minDeposit) {
      throw new Error(`Minimum deposit is $${typeConfig.minDeposit}`);
    }

    const newBalance = goal.currentBalance + amount;
    const now = new Date().toISOString();

    // Create transaction
    const transaction: GoalTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      goalId,
      type: "deposit",
      amount,
      balanceAfter: newBalance,
      description: description || "Deposit",
      createdAt: now,
    };

    // Update goal balance
    const updatedGoal: Partial<SavingsGoal> = {
      currentBalance: newBalance,
      updatedAt: now,
    };

    // Check milestones
    const progress = (newBalance / goal.targetAmount) * 100;
    const updatedMilestones = goal.milestones.map(m => {
      if (!m.reachedAt && progress >= m.targetPercent) {
        return { ...m, reachedAt: now };
      }
      return m;
    });
    updatedGoal.milestones = updatedMilestones;

    // Check if goal completed
    if (newBalance >= goal.targetAmount && goal.status === "active") {
      updatedGoal.status = "completed";
      updatedGoal.completedAt = now;
    }

    await Promise.all([
      updateGoal(goalId, updatedGoal),
      saveTransactions([...transactions, transaction]),
    ]);

    // Auto-post: Check for milestones and goal completion
    const { data: { session: authSession } } = await supabase.auth.getSession();
    if (authSession?.user?.id) {
      const uid = authSession.user.id;
      if (updatedGoal.status === "completed") {
        // Goal reached!
        createAutoPost(uid, "goal_reached", goalId, "savings_goal", {
          goalName: goal.name,
          targetAmount: goal.targetAmount,
          amount: goal.targetAmount,
        });
      } else {
        // Check for milestone posts (25%, 50%, 75%)
        const newlyReached = updatedMilestones.find(
          (m, i) => m.reachedAt === now && !goal.milestones[i]?.reachedAt && m.targetPercent < 100
        );
        if (newlyReached) {
          createAutoPost(uid, "milestone", goalId, "savings_goal", {
            goalName: goal.name,
            targetAmount: goal.targetAmount,
            percentage: newlyReached.targetPercent,
          });
        }
      }
    }

    return transaction;
  };

  const withdraw = async (
    goalId: string,
    amount: number,
    description?: string
  ): Promise<GoalTransaction> => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) throw new Error("Goal not found");

    if (amount > goal.currentBalance) {
      throw new Error("Insufficient balance");
    }

    // Check if locked goal and not matured
    if (goal.type === "locked" && goal.maturityDate) {
      const now = new Date();
      const maturity = new Date(goal.maturityDate);
      if (now < maturity) {
        // Apply early withdrawal penalty
        const penalty = amount * (goal.earlyWithdrawalPenalty || 0.10);
        amount = amount - penalty;
      }
    }

    const newBalance = goal.currentBalance - amount;
    const nowStr = new Date().toISOString();

    const transaction: GoalTransaction = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      goalId,
      type: "withdrawal",
      amount: -amount,
      balanceAfter: newBalance,
      description: description || "Withdrawal",
      createdAt: nowStr,
    };

    await Promise.all([
      updateGoal(goalId, { currentBalance: newBalance }),
      saveTransactions([...transactions, transaction]),
    ]);

    return transaction;
  };

  const transfer = async (
    fromGoalId: string,
    toGoalId: string,
    amount: number
  ) => {
    const fromGoal = goals.find(g => g.id === fromGoalId);
    const toGoal = goals.find(g => g.id === toGoalId);

    if (!fromGoal || !toGoal) throw new Error("Goal not found");
    if (amount > fromGoal.currentBalance) throw new Error("Insufficient balance");

    const now = new Date().toISOString();
    const fromNewBalance = fromGoal.currentBalance - amount;
    const toNewBalance = toGoal.currentBalance + amount;

    const outTransaction: GoalTransaction = {
      id: `txn_${Date.now()}_out`,
      goalId: fromGoalId,
      type: "transfer_out",
      amount: -amount,
      balanceAfter: fromNewBalance,
      description: `Transfer to ${toGoal.name}`,
      createdAt: now,
      destinationGoalId: toGoalId,
    };

    const inTransaction: GoalTransaction = {
      id: `txn_${Date.now()}_in`,
      goalId: toGoalId,
      type: "transfer_in",
      amount,
      balanceAfter: toNewBalance,
      description: `Transfer from ${fromGoal.name}`,
      createdAt: now,
      sourceGoalId: fromGoalId,
    };

    const updatedGoals = goals.map(g => {
      if (g.id === fromGoalId) return { ...g, currentBalance: fromNewBalance, updatedAt: now };
      if (g.id === toGoalId) return { ...g, currentBalance: toNewBalance, updatedAt: now };
      return g;
    });

    await Promise.all([
      saveGoals(updatedGoals),
      saveTransactions([...transactions, outTransaction, inTransaction]),
    ]);
  };

  // ==================== QUERIES ====================

  const getGoalById = (goalId: string) => goals.find(g => g.id === goalId);

  const getGoalsByType = (type: GoalType) =>
    goals.filter(g => g.userId === MOCK_USER_ID && g.type === type);

  const getActiveGoals = () =>
    goals.filter(g => g.userId === MOCK_USER_ID && ["active", "paused"].includes(g.status));

  const getGoalTransactions = (goalId: string) =>
    transactions
      .filter(t => t.goalId === goalId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ==================== CALCULATIONS ====================

  const getTotalSavings = () =>
    goals
      .filter(g => g.userId === MOCK_USER_ID && g.status !== "closed")
      .reduce((sum, g) => sum + g.currentBalance, 0);

  const getTotalInterestEarned = () =>
    goals
      .filter(g => g.userId === MOCK_USER_ID)
      .reduce((sum, g) => sum + g.interestEarned, 0);

  const getTotalInterestUnlocked = () =>
    goals
      .filter(g => g.userId === MOCK_USER_ID)
      .reduce((sum, g) => sum + g.interestUnlocked, 0);

  const calculateInterest = (goalId: string): number => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;

    const daysSinceLastCalc = Math.floor(
      (Date.now() - new Date(goal.lastInterestDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Daily interest rate
    const dailyRate = goal.interestRate / 365;
    return goal.currentBalance * dailyRate * daysSinceLastCalc;
  };

  const getProjectedBalance = (goalId: string, months: number): number => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return 0;

    // Compound interest formula: A = P(1 + r/n)^(nt)
    const n = 12; // Monthly compounding
    const t = months / 12;
    return goal.currentBalance * Math.pow(1 + goal.interestRate / n, n * t);
  };

  // ==================== AUTO-SAVE ====================

  const processAutoSave = async (circleId: string, payoutAmount: number) => {
    let remainingPayout = payoutAmount;

    // Get all eligible goals for auto-save
    const eligibleGoals = goals.filter(
      g =>
        g.userId === MOCK_USER_ID &&
        g.autoSaveEnabled &&
        (g.autoSaveFromCircles.length === 0 || g.autoSaveFromCircles.includes(circleId)) &&
        g.status === "active"
    );

    // Sort by priority (lower number = higher priority)
    // Goals with autoReplenish that are below target get highest priority
    const sortedGoals = [...eligibleGoals].sort((a, b) => {
      // First prioritize replenish goals that are below target
      const aReplenishNeeded = a.autoReplenish && a.currentBalance < a.targetAmount;
      const bReplenishNeeded = b.autoReplenish && b.currentBalance < b.targetAmount;

      if (aReplenishNeeded && !bReplenishNeeded) return -1;
      if (!aReplenishNeeded && bReplenishNeeded) return 1;

      // Then sort by priority number
      return (a.autoSavePriority || 99) - (b.autoSavePriority || 99);
    });

    for (const goal of sortedGoals) {
      if (remainingPayout <= 0) break;

      let autoSaveAmount = (payoutAmount * goal.autoSavePercent) / 100;

      // For replenish goals, cap at the amount needed to reach target
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
            ? `Auto-replenish from circle payout`
            : `Auto-save from circle payout`
        );
        remainingPayout -= autoSaveAmount;
      }
    }

    return remainingPayout; // Return remaining payout that wasn't auto-saved
  };

  return (
    <SavingsContext.Provider
      value={{
        goals,
        transactions,
        isLoading,
        createGoal,
        updateGoal,
        closeGoal,
        pauseGoal,
        resumeGoal,
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
        processAutoSave,
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
