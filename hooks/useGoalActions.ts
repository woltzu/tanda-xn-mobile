// ══════════════════════════════════════════════════════════════════════════════
// hooks/useGoalActions.ts — V2 goal actions on the live savings tables
// ══════════════════════════════════════════════════════════════════════════════
//
// Phase 1 backend integration. CRUD + money movement for the V2 goals feature,
// backed by the existing live tables `user_savings_goals` / `savings_transactions`
// (extended in migration 072_goals_v2_fields.sql) — NOT a parallel goals system.
//
// Conventions (must match the existing data layer / SavingsContext):
//   - DB stores amounts in CENTS (BIGINT); this hook converts dollars↔cents.
//   - user_savings_goals.user_id and savings_transactions.user_id → profiles.id
//     (== auth.uid()); RLS (pe_usg_* / pe_st_*) scopes rows to the user.
//   - createGoal must satisfy two NOT NULL FKs: wallet_id (looked up from
//     user_wallets) and savings_goal_type_id (resolved from savings_type via a
//     type code).
//   - No DELETE RLS policy exists → deleteGoal is a soft delete (goal_status).
//   - addMoney / withdraw run as two steps (insert transaction, then update the
//     goal balance) per the MVP plan; a later pass can move this into a secure
//     RPC/Edge Function for atomicity.
//
// Every action returns { data, error } (Supabase-style). NOT yet wired into any
// screen — that's a later phase.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  ActionResult,
  CreateGoalInput,
  Goal,
  GoalTransaction,
  GoalWithTransactions,
  SavingsTypeV2,
  UpdateGoalInput,
} from "../types/goals";

const GOALS_TABLE = "user_savings_goals";
const TXNS_TABLE = "savings_transactions";

// V2 savings_type → existing savings_goal_types.code (live codes don't include
// 'flexible'; 'general' is the no/low-lock tier).
const SAVINGS_TYPE_TO_CODE: Record<SavingsTypeV2, string> = {
  flexible: "general",
  emergency: "emergency",
  locked: "locked",
};

const dollarsToCents = (d: number): number => Math.round((d || 0) * 100);
const centsToDollars = (c: number | null | undefined): number => (c ?? 0) / 100;
const nowIso = () => new Date().toISOString();

function mapGoalRow(row: any): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    emoji: row.emoji ?? undefined,
    goalType: row.goal_type ?? undefined,
    category: row.category ?? undefined,
    savingsType: (row.savings_type as SavingsTypeV2) ?? undefined,
    targetAmount: centsToDollars(row.target_amount_cents),
    currentBalance: centsToDollars(row.current_balance_cents),
    monthlyContribution:
      row.monthly_contribution_cents != null
        ? centsToDollars(row.monthly_contribution_cents)
        : undefined,
    interestEarned: centsToDollars(row.total_interest_earned_cents),
    autoDepositEnabled: !!row.auto_deposit_enabled,
    autoDepositDay: row.auto_deposit_day ?? undefined,
    linkedCircleId: row.linked_circle_id ?? undefined,
    circlePayoutAction: row.circle_payout_action ?? undefined,
    circlePayoutPercent: row.circle_payout_percent ?? undefined,
    lockEndDate: row.locked_until ?? undefined,
    lockPeriodMonths: row.lock_period_months ?? undefined,
    targetDate: row.target_date ?? undefined,
    status: row.goal_status,
    achievedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTxnRow(row: any): GoalTransaction {
  return {
    id: row.id,
    goalId: row.savings_goal_id,
    userId: row.user_id,
    type: row.transaction_type,
    source: row.source ?? undefined,
    amount: centsToDollars(row.amount_cents),
    fee: centsToDollars(row.fee_cents),
    penaltyAmount: centsToDollars(row.penalty_amount_cents),
    balanceAfter: centsToDollars(row.balance_after_cents),
    status: row.transaction_status,
    description: row.metadata?.description ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}

const authError = (): ActionResult<never> => ({
  data: null,
  error: new Error("Not authenticated"),
});

export function useGoalActions() {
  const { user } = useAuth();

  // ── Create ────────────────────────────────────────────────────────────────
  const createGoal = async (
    goalData: CreateGoalInput
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    try {
      // Resolve the NOT NULL savings_goal_type_id from the V2 savings_type.
      const code = SAVINGS_TYPE_TO_CODE[goalData.savingsType ?? "flexible"] ?? "general";
      const { data: typeRow, error: typeErr } = await supabase
        .from("savings_goal_types")
        .select("id")
        .eq("code", code)
        .maybeSingle();
      if (typeErr) return { data: null, error: typeErr };
      if (!typeRow)
        return { data: null, error: new Error(`Savings goal type '${code}' not found`) };

      // Resolve the NOT NULL wallet_id for this user.
      const { data: walletRow, error: walletErr } = await supabase
        .from("user_wallets")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (walletErr) return { data: null, error: walletErr };
      if (!walletRow)
        return { data: null, error: new Error("No wallet found for user") };

      const payload = {
        user_id: user.id,
        wallet_id: walletRow.id,
        savings_goal_type_id: typeRow.id,
        name: goalData.name,
        emoji: goalData.emoji ?? null,
        goal_type: goalData.goalType ?? null,
        category: goalData.category ?? null,
        savings_type: goalData.savingsType ?? null,
        target_amount_cents: dollarsToCents(goalData.targetAmount),
        monthly_contribution_cents:
          goalData.monthlyContribution != null
            ? dollarsToCents(goalData.monthlyContribution)
            : null,
        auto_deposit_enabled: goalData.autoDepositEnabled ?? false,
        auto_deposit_day: goalData.autoDepositDay ?? null,
        linked_circle_id: goalData.linkedCircleId ?? null,
        circle_payout_action: goalData.circlePayoutAction ?? null,
        circle_payout_percent: goalData.circlePayoutPercent ?? null,
        locked_until: goalData.lockEndDate ?? null,
        lock_period_months: goalData.lockPeriodMonths ?? null,
        target_date: goalData.targetDate ?? null,
        goal_status: "active",
      };

      const { data, error } = await supabase
        .from(GOALS_TABLE)
        .insert(payload)
        .select()
        .single();
      if (error) return { data: null, error };
      return { data: mapGoalRow(data), error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // ── Read ──────────────────────────────────────────────────────────────────
  const fetchGoal = async (
    goalId: string
  ): Promise<ActionResult<GoalWithTransactions>> => {
    if (!user) return authError();
    const { data: goalRow, error } = await supabase
      .from(GOALS_TABLE)
      .select("*")
      .eq("id", goalId)
      .maybeSingle();
    if (error) return { data: null, error };
    if (!goalRow) return { data: null, error: new Error("Goal not found") };

    const { data: txns, error: txnErr } = await supabase
      .from(TXNS_TABLE)
      .select("*")
      .eq("savings_goal_id", goalId)
      .order("created_at", { ascending: false });
    if (txnErr) return { data: null, error: txnErr };

    return {
      data: {
        goal: mapGoalRow(goalRow),
        transactions: (txns ?? []).map(mapTxnRow),
      },
      error: null,
    };
  };

  const fetchGoals = async (): Promise<ActionResult<Goal[]>> => {
    if (!user) return authError();
    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error };
    return { data: (data ?? []).map(mapGoalRow), error: null };
  };

  // ── Money movement (two-step: insert transaction, then update balance) ──────
  const addMoney = async (
    goalId: string,
    amount: number,
    source: string
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const amountCents = dollarsToCents(amount);
    if (amountCents <= 0)
      return { data: null, error: new Error("Amount must be greater than zero") };

    const { data: goalRow, error: gErr } = await supabase
      .from(GOALS_TABLE)
      .select("current_balance_cents, total_deposits_cents")
      .eq("id", goalId)
      .maybeSingle();
    if (gErr) return { data: null, error: gErr };
    if (!goalRow) return { data: null, error: new Error("Goal not found") };

    const balanceBefore = goalRow.current_balance_cents ?? 0;
    const balanceAfter = balanceBefore + amountCents;

    const { error: txnErr } = await supabase.from(TXNS_TABLE).insert({
      savings_goal_id: goalId,
      user_id: user.id,
      transaction_type: "deposit",
      source,
      amount_cents: amountCents,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceAfter,
      transaction_status: "completed",
    });
    if (txnErr) return { data: null, error: txnErr };

    const { data: updated, error: uErr } = await supabase
      .from(GOALS_TABLE)
      .update({
        current_balance_cents: balanceAfter,
        total_deposits_cents: (goalRow.total_deposits_cents ?? 0) + amountCents,
        last_deposit_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", goalId)
      .select()
      .single();
    if (uErr) return { data: null, error: uErr };
    return { data: mapGoalRow(updated), error: null };
  };

  const withdraw = async (
    goalId: string,
    amount: number,
    reason?: string,
    penaltyPercent?: number
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const amountCents = dollarsToCents(amount);
    if (amountCents <= 0)
      return { data: null, error: new Error("Amount must be greater than zero") };

    const { data: goalRow, error: gErr } = await supabase
      .from(GOALS_TABLE)
      .select("current_balance_cents, total_withdrawals_cents")
      .eq("id", goalId)
      .maybeSingle();
    if (gErr) return { data: null, error: gErr };
    if (!goalRow) return { data: null, error: new Error("Goal not found") };

    const balanceBefore = goalRow.current_balance_cents ?? 0;
    if (amountCents > balanceBefore)
      return { data: null, error: new Error("Amount exceeds available balance") };

    // The full withdrawal leaves the goal; the penalty is retained, so the user
    // nets (amount − penalty). balance decreases by the gross amount.
    const penaltyCents = penaltyPercent
      ? Math.round(amountCents * (penaltyPercent / 100))
      : 0;
    const balanceAfter = balanceBefore - amountCents;

    const { error: txnErr } = await supabase.from(TXNS_TABLE).insert({
      savings_goal_id: goalId,
      user_id: user.id,
      transaction_type: "withdrawal",
      source: "wallet",
      amount_cents: amountCents,
      penalty_amount_cents: penaltyCents,
      fee_cents: 0,
      balance_before_cents: balanceBefore,
      balance_after_cents: balanceAfter,
      transaction_status: "completed",
      metadata: {
        reason: reason ?? null,
        net_received_cents: amountCents - penaltyCents,
      },
    });
    if (txnErr) return { data: null, error: txnErr };

    const { data: updated, error: uErr } = await supabase
      .from(GOALS_TABLE)
      .update({
        current_balance_cents: balanceAfter,
        total_withdrawals_cents:
          (goalRow.total_withdrawals_cents ?? 0) + amountCents,
        updated_at: nowIso(),
      })
      .eq("id", goalId)
      .select()
      .single();
    if (uErr) return { data: null, error: uErr };
    return { data: mapGoalRow(updated), error: null };
  };

  // ── Mutations ───────────────────────────────────────────────────────────────
  const linkCircle = async (
    goalId: string,
    circleId: string,
    action: string,
    percent?: number
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .update({
        linked_circle_id: circleId,
        circle_payout_action: action,
        circle_payout_percent: percent ?? null,
        updated_at: nowIso(),
      })
      .eq("id", goalId)
      .select()
      .single();
    if (error) return { data: null, error };
    return { data: mapGoalRow(data), error: null };
  };

  // Direct update (mirroring linkCircle) so the call site doesn't have to
  // remember three keys at once. updateGoal does not currently expose the
  // linked_circle_* fields in its UpdateGoalInput shape, so this is the
  // cleanest path until/unless that input grows.
  const unlinkCircle = async (
    goalId: string
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .update({
        linked_circle_id: null,
        circle_payout_action: null,
        circle_payout_percent: null,
        updated_at: nowIso(),
      })
      .eq("id", goalId)
      .select()
      .single();
    if (error) return { data: null, error };
    return { data: mapGoalRow(data), error: null };
  };

  const updateGoal = async (
    goalId: string,
    updates: UpdateGoalInput
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const payload: Record<string, unknown> = { updated_at: nowIso() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.emoji !== undefined) payload.emoji = updates.emoji;
    if (updates.goalType !== undefined) payload.goal_type = updates.goalType;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.savingsType !== undefined) payload.savings_type = updates.savingsType;
    if (updates.targetAmount !== undefined)
      payload.target_amount_cents = dollarsToCents(updates.targetAmount);
    if (updates.monthlyContribution !== undefined)
      payload.monthly_contribution_cents = dollarsToCents(updates.monthlyContribution);
    if (updates.autoDepositEnabled !== undefined)
      payload.auto_deposit_enabled = updates.autoDepositEnabled;
    if (updates.autoDepositDay !== undefined)
      payload.auto_deposit_day = updates.autoDepositDay;
    if (updates.lockEndDate !== undefined) payload.locked_until = updates.lockEndDate;
    if (updates.lockPeriodMonths !== undefined)
      payload.lock_period_months = updates.lockPeriodMonths;
    if (updates.status !== undefined) payload.goal_status = updates.status;
    if (updates.targetDate !== undefined) payload.target_date = updates.targetDate;

    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .update(payload)
      .eq("id", goalId)
      .select()
      .single();
    if (error) return { data: null, error };
    return { data: mapGoalRow(data), error: null };
  };

  // Soft delete: no DELETE RLS policy exists, and the existing system models
  // removal via goal_status. We use 'closed' (a known existing value).
  const deleteGoal = async (goalId: string): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const { data, error } = await supabase
      .from(GOALS_TABLE)
      .update({ goal_status: "closed", updated_at: nowIso() })
      .eq("id", goalId)
      .select()
      .single();
    if (error) return { data: null, error };
    return { data: mapGoalRow(data), error: null };
  };

  return {
    createGoal,
    fetchGoal,
    fetchGoals,
    addMoney,
    withdraw,
    linkCircle,
    unlinkCircle,
    updateGoal,
    deleteGoal,
  };
}
