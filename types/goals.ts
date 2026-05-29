// ══════════════════════════════════════════════════════════════════════════════
// types/goals.ts — V2 goals types (backed by the live savings tables)
// ══════════════════════════════════════════════════════════════════════════════
//
// The V2 goals feature is backed by the existing live tables
// `user_savings_goals` / `savings_transactions` (extended in migration
// 072_goals_v2_fields.sql), NOT a separate goals/goal_transactions system.
//
// The DB stores amounts in CENTS (BIGINT). These dollar-facing types are what
// `useGoalActions` returns and accepts — the hook does the cents↔dollars
// conversion at its boundary. Column ↔ field mapping is noted inline.
// ══════════════════════════════════════════════════════════════════════════════

export type SavingsTypeV2 = "flexible" | "emergency" | "locked";

export type GoalStatus =
  | "active"
  | "paused"
  | "completed"
  | "matured"
  | "closed"
  | "abandoned";

export type GoalTransactionType =
  | "deposit"
  | "withdrawal"
  | "interest_credit"
  | "penalty"
  | "transfer_in"
  | "transfer_out"
  | "circle_payout";

export type CirclePayoutAction =
  | "deposit_all"
  | "deposit_percent"
  | "ask_each_time";

/** Dollar-facing goal, mapped from a `user_savings_goals` row. */
export interface Goal {
  id: string;
  userId: string; // user_id (→ profiles.id)
  name: string;
  emoji?: string;
  goalType?: string; // goal_type, e.g. 'first_home'
  category?: string; // category, e.g. 'financial_freedom'
  savingsType?: SavingsTypeV2; // savings_type
  targetAmount: number; // dollars  ← target_amount_cents
  currentBalance: number; // dollars  ← current_balance_cents
  monthlyContribution?: number; // dollars  ← monthly_contribution_cents
  interestEarned: number; // dollars  ← total_interest_earned_cents
  autoDepositEnabled: boolean;
  autoDepositDay?: number;
  linkedCircleId?: string;
  circlePayoutAction?: CirclePayoutAction;
  circlePayoutPercent?: number;
  lockEndDate?: string; // locked_until (DATE)
  lockPeriodMonths?: number;
  targetDate?: string;
  status: GoalStatus; // goal_status
  achievedAt?: string; // completed_at
  createdAt: string;
  updatedAt: string;
}

/** Dollar-facing transaction, mapped from a `savings_transactions` row. */
export interface GoalTransaction {
  id: string;
  goalId: string; // savings_goal_id
  userId: string;
  type: GoalTransactionType; // transaction_type
  source?: string;
  amount: number; // dollars  ← amount_cents
  fee: number; // dollars  ← fee_cents
  penaltyAmount: number; // dollars  ← penalty_amount_cents
  balanceAfter: number; // dollars  ← balance_after_cents
  status: string; // transaction_status
  description?: string; // stored in metadata.description
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Input for `createGoal` (dollar-facing). */
export interface CreateGoalInput {
  name: string;
  emoji?: string;
  goalType?: string;
  category?: string;
  savingsType?: SavingsTypeV2;
  targetAmount: number; // dollars
  monthlyContribution?: number; // dollars
  autoDepositEnabled?: boolean;
  autoDepositDay?: number;
  linkedCircleId?: string;
  circlePayoutAction?: CirclePayoutAction;
  circlePayoutPercent?: number;
  lockEndDate?: string;
  lockPeriodMonths?: number;
  targetDate?: string;
}

/** Partial update for `updateGoal` (dollar-facing). */
export interface UpdateGoalInput {
  name?: string;
  emoji?: string;
  goalType?: string;
  category?: string;
  savingsType?: SavingsTypeV2;
  targetAmount?: number; // dollars
  monthlyContribution?: number; // dollars
  autoDepositEnabled?: boolean;
  autoDepositDay?: number;
  lockEndDate?: string;
  lockPeriodMonths?: number;
  status?: GoalStatus;
  targetDate?: string;
}

/** A single goal with its transaction history (returned by `fetchGoal`). */
export interface GoalWithTransactions {
  goal: Goal;
  transactions: GoalTransaction[];
}

/** Supabase-style result shape returned by every hook action. */
export interface ActionResult<T> {
  data: T | null;
  error: unknown;
}
