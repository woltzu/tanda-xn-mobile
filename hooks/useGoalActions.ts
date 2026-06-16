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
//   - addMoney / withdraw call the atomic RPCs `transfer_to_goal` /
//     `transfer_from_goal` (migration 073). Wallet ↔ goal can never drift —
//     a wallet debit never appears without the matching goal credit, and
//     a withdraw never leaves the goal without the wallet credit. The RPC
//     also enforces the `current_balance_cents >= amount` check that the
//     DB itself doesn't (no CHECK constraint on user_savings_goals).
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
  GoalMilestone,
  GoalTransaction,
  GoalWithTransactions,
  SavingsTypeV2,
  SpendingSuggestion,
  UpdateGoalInput,
} from "../types/goals";

const GOALS_TABLE = "user_savings_goals";
const TXNS_TABLE = "savings_transactions";
const MILESTONES_TABLE = "goal_milestones";

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
    roundUpEnabled: row.round_up_enabled ?? undefined,
  };
}

function mapMilestoneRow(row: any): GoalMilestone {
  return {
    id: row.id,
    goalId: row.goal_id,
    milestonePercent: row.milestone_percent,
    reachedAt: row.reached_at,
    celebrated: !!row.celebrated,
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
  //
  // Calls the atomic `create_goal` RPC (migration 143) instead of the prior
  // 3-roundtrip prep+insert chain. The RPC does the wallet + savings_type
  // resolution server-side, INSERTs the goal row, and returns the new id +
  // balance. We then refetch the row so the caller still gets a full
  // typed Goal (matches the rest of the hook's contract).
  const createGoal = async (
    goalData: CreateGoalInput
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    try {
      const { data, error } = await supabase.rpc("create_goal", {
        p_name: goalData.name,
        p_target_amount_cents:
          goalData.targetAmount != null
            ? dollarsToCents(goalData.targetAmount)
            : null,
        p_savings_type: goalData.savingsType ?? "flexible",
        p_emoji: goalData.emoji ?? null,
        p_category: goalData.category ?? null,
        p_goal_type: goalData.goalType ?? null,
        p_target_date: goalData.targetDate ?? null,
        p_monthly_contribution_cents:
          goalData.monthlyContribution != null
            ? dollarsToCents(goalData.monthlyContribution)
            : null,
        p_auto_deposit_enabled: goalData.autoDepositEnabled ?? false,
        p_auto_deposit_day: goalData.autoDepositDay ?? null,
        p_locked_until: goalData.lockEndDate ?? null,
        p_lock_period_months: goalData.lockPeriodMonths ?? null,
        p_linked_circle_id: goalData.linkedCircleId ?? null,
        p_circle_payout_action: goalData.circlePayoutAction ?? null,
        p_circle_payout_percent: goalData.circlePayoutPercent ?? null,
      });
      if (error) return { data: null, error };
      const row = Array.isArray(data) ? data[0] : data;
      const newGoalId: string | undefined = row?.goal_id;
      if (!newGoalId) {
        return {
          data: null,
          error: new Error("create_goal RPC returned no goal_id"),
        };
      }
      // Refetch the full row so the caller gets a complete Goal object with
      // the saved metadata, timestamps, savings_goal_type_id, etc.
      const { data: full, error: fetchErr } = await supabase
        .from(GOALS_TABLE)
        .select("*")
        .eq("id", newGoalId)
        .single();
      if (fetchErr || !full) {
        return { data: null, error: fetchErr ?? new Error("goal_fetch_failed") };
      }
      return { data: mapGoalRow(full), error: null };
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

    // Milestones list — empty until the goal's balance crosses a threshold
    // for the first time (handled atomically by _record_goal_milestones in
    // migration 078). Order ascending so the screen renders First → 100%.
    const { data: milestones, error: msErr } = await supabase
      .from(MILESTONES_TABLE)
      .select("id, goal_id, milestone_percent, reached_at, celebrated")
      .eq("goal_id", goalId)
      .order("milestone_percent", { ascending: true });
    if (msErr) return { data: null, error: msErr };

    return {
      data: {
        goal: mapGoalRow(goalRow),
        transactions: (txns ?? []).map(mapTxnRow),
        milestones: (milestones ?? []).map(mapMilestoneRow),
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

  // ── Money movement (atomic via RPC — see migration 073) ────────────────────
  //
  // Both deposit and withdraw are single supabase.rpc() calls into a
  // plpgsql function that mutates user_wallets + user_savings_goals +
  // savings_transactions inside one transaction. Wallet ↔ goal can never
  // drift; concurrent transfers are serialised by row locks inside the
  // function (SELECT … FOR UPDATE). The RPC returns a JSONB envelope:
  //   { success: true,  goal_balance_cents, wallet_balance_cents, … }
  //   { success: false, error: "human-readable message" }
  // We re-fetch the goal row after a successful RPC so the caller still
  // receives a typed Goal (mapGoalRow output) consistent with the rest of
  // the hook's contract.
  //
  // `source` on addMoney is currently always 'wallet' end-to-end — bank/card
  // sources are stubbed in the screen and never reach the hook. The
  // parameter is retained for future-compatibility but unused; if a non-
  // wallet source is ever passed, the deposit is rejected before hitting
  // the RPC so the failure mode is obvious.

  const refetchGoalForResult = async (
    goalId: string
  ): Promise<ActionResult<Goal>> => {
    const { data: row, error } = await supabase
      .from(GOALS_TABLE)
      .select("*")
      .eq("id", goalId)
      .maybeSingle();
    if (error) return { data: null, error };
    if (!row) return { data: null, error: new Error("Goal not found after transfer") };
    return { data: mapGoalRow(row), error: null };
  };

  const addMoney = async (
    goalId: string,
    amount: number,
    source: string
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const amountCents = dollarsToCents(amount);
    if (amountCents <= 0)
      return { data: null, error: new Error("Amount must be greater than zero") };

    // Wallet is the only source backed by an atomic RPC today. Bank / card
    // require Stripe + ACH wiring (Phase 2+) — guard so they don't silently
    // pretend to succeed if a future screen accidentally calls through.
    if (source !== "wallet") {
      return {
        data: null,
        error: new Error(`Source '${source}' is not yet supported for direct transfer`),
      };
    }

    const { data, error } = await supabase.rpc("transfer_to_goal", {
      p_goal_id: goalId,
      p_amount_cents: amountCents,
    });
    if (error) return { data: null, error };
    if (!data?.success) {
      return {
        data: null,
        error: new Error(data?.error ?? "Transfer failed"),
      };
    }

    return refetchGoalForResult(goalId);
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

    // Client computes penalty in cents from the percent so the RPC can stay
    // ignorant of pricing rules (flexible / emergency / locked logic lives
    // in the screen). The RPC then debits goal by gross and credits wallet
    // by net = gross − penalty.
    const penaltyCents = penaltyPercent
      ? Math.round(amountCents * (penaltyPercent / 100))
      : 0;

    const { data, error } = await supabase.rpc("transfer_from_goal", {
      p_goal_id: goalId,
      p_amount_cents: amountCents,
      p_penalty_amount_cents: penaltyCents,
      p_reason: reason ?? null,
    });
    if (error) return { data: null, error };
    if (!data?.success) {
      return {
        data: null,
        error: new Error(data?.error ?? "Withdrawal failed"),
      };
    }

    return refetchGoalForResult(goalId);
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

  // ── Goal P2 helpers (migration 155) ────────────────────────────────────────

  // Median target across the caller's past goals. Returns the dollar
  // amount or null when there's no history yet. Drives the "Usually you
  // save $X — use that?" chip on GoalCreateExpressScreen.
  const suggestGoalAmount = async (): Promise<ActionResult<number | null>> => {
    if (!user) return authError();
    const { data, error } = await supabase.rpc("suggest_goal_amount");
    if (error) return { data: null, error };
    const cents = (data as number | null) ?? null;
    if (cents === null) return { data: null, error: null };
    return { data: centsToDollars(cents), error: null };
  };

  // Per-jar round-up sweep toggle. Lives on user_savings_goals.round_up_enabled
  // (default true); GoalDetailV2Screen flips it for the Round-up Savings jar
  // without touching the profile-wide round_up_increment.
  const setRoundUpEnabled = async (
    goalId: string,
    enabled: boolean,
  ): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    const { error } = await supabase
      .from(GOALS_TABLE)
      .update({ round_up_enabled: enabled, updated_at: nowIso() })
      .eq("id", goalId)
      .eq("user_id", user.id);
    if (error) return { data: null, error };
    return refetchGoalForResult(goalId);
  };

  // Spending banner — pulled live so a freshly-seeded row appears without
  // the user reloading the app. Dismissed rows are filtered server-side
  // via the partial index from migration 155.
  const fetchSpendingSuggestions = async (): Promise<
    ActionResult<SpendingSuggestion[]>
  > => {
    if (!user) return authError();
    const { data, error } = await supabase
      .from("spending_patterns")
      .select("id, category, monthly_avg_cents, suggested_save_cents, last_computed_at")
      .eq("user_id", user.id)
      .is("dismissed_at", null)
      .order("monthly_avg_cents", { ascending: false })
      .limit(5);
    if (error) return { data: null, error };
    const mapped: SpendingSuggestion[] = (data ?? []).map((r: any) => ({
      id: r.id,
      category: r.category,
      monthlyAvg: centsToDollars(r.monthly_avg_cents),
      suggestedSave: centsToDollars(r.suggested_save_cents),
      lastComputedAt: r.last_computed_at,
    }));
    return { data: mapped, error: null };
  };

  const dismissSpendingSuggestion = async (
    id: string,
  ): Promise<ActionResult<boolean>> => {
    if (!user) return authError();
    const { data, error } = await supabase.rpc("dismiss_spending_pattern", {
      p_pattern_id: id,
    });
    if (error) return { data: null, error };
    return { data: !!data, error: null };
  };

  // ── Round-up jar lookup / creation (Send-Money P2) ────────────────────────
  //
  // Returns the user's dedicated "Round-up Savings" goal, creating one on
  // first call. The jar is a flexible goal with no target amount so the
  // bar never fills — it's a perpetual accumulator. Identified by goal_type
  // ='round_up' so future bookkeeping can find it without name matching.
  const ROUND_UP_TYPE = "round_up";
  const ROUND_UP_NAME = "Round-up Savings";
  // Goal P2 (2026-06-14): spec calls for the 🪙 coin marker.
  const ROUND_UP_EMOJI = "🪙";

  const ensureRoundUpGoal = async (): Promise<ActionResult<Goal>> => {
    if (!user) return authError();
    // Look up first — most calls land here after the first one created the
    // jar, so this is a single GET.
    const { data: existing, error: fetchErr } = await supabase
      .from(GOALS_TABLE)
      .select("*")
      .eq("user_id", user.id)
      .eq("goal_type", ROUND_UP_TYPE)
      .neq("goal_status", "closed")
      .maybeSingle();
    if (fetchErr) return { data: null, error: fetchErr };
    if (existing) return { data: mapGoalRow(existing), error: null };

    // Create the jar via the canonical RPC so wallet_id + savings_goal_type_id
    // are resolved server-side.
    return createGoal({
      name: ROUND_UP_NAME,
      emoji: ROUND_UP_EMOJI,
      savingsType: "flexible",
      goalType: ROUND_UP_TYPE,
      // No targetAmount — the jar accumulates indefinitely.
    });
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
    ensureRoundUpGoal,
    // Goal P2 (migration 155)
    suggestGoalAmount,
    setRoundUpEnabled,
    fetchSpendingSuggestions,
    dismissSpendingSuggestion,
  };
}
