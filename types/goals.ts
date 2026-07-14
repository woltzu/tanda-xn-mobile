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
  // P2 (migration 155): per-jar opt-out for the round-up sweep. Only
  // meaningful on goal_type='round_up' but defaulted on every goal so
  // existing rows stay valid.
  roundUpEnabled?: boolean;
  // Free-form JSONB from user_savings_goals.metadata. Currently used to
  // carry template_id / template_name / template_milestones /
  // template_cost_breakdown for goals created via a goal_templates row
  // (migration 302). Rendered by the Milestones screen to display
  // template-specific stages (Foundation 30% / Walls 25% / etc.)
  // instead of the default 10/25/50/75/90/100 arc.
  metadata?: Record<string, unknown>;
}

// P2 — banner data driving the "Save instead?" suggestion on the
// Goals hub. Populated by suggest-goals-from-spending edge function
// (placeholder shipped in 2026-06-14) and surfaced via
// fetchSpendingSuggestions.
export interface SpendingSuggestion {
  id: string;
  category: string;
  monthlyAvg: number;        // dollars
  suggestedSave: number;     // dollars
  lastComputedAt: string;
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
  /** Optional goal_templates.id. When set, the create RPC (mig 302) copies
   *  the template's milestones + cost_breakdown JSONB into the new goal's
   *  metadata so the Milestones screen can render template-specific
   *  stages. Unknown / inactive ids are silently ignored server-side. */
  templateId?: string;
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

/**
 * Achievement record from `goal_milestones`. Inserted automatically by the
 * _record_goal_milestones RPC (migration 078) whenever the goal's balance
 * crosses 10/25/50/75/90/100% for the first time. The screen-side
 * GoalMilestonesScreen renders this list with achieved / locked badges.
 */
export interface GoalMilestone {
  id: string;
  goalId: string;          // goal_id
  milestonePercent: number; // milestone_percent (one of 10/25/50/75/90/100)
  reachedAt: string;        // reached_at (timestamptz)
  celebrated: boolean;
}

/**
 * A single goal with its transaction + milestone history (returned by
 * `fetchGoal`). `milestones` is empty until the goal's balance crosses a
 * threshold for the first time.
 */
export interface GoalWithTransactions {
  goal: Goal;
  transactions: GoalTransaction[];
  milestones: GoalMilestone[];
}

/** Supabase-style result shape returned by every hook action. */
export interface ActionResult<T> {
  data: T | null;
  error: unknown;
}
