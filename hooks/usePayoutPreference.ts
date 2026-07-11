// hooks/usePayoutPreference.ts
//
// Read + write the caller's payout preference for a scope. When a
// circleId is passed we operate on the per-circle row; otherwise on
// the caller's global default. Storage lives in `payout_preferences`
// and the consumer `PayoutExecutionEngine` reads scope strings as
// 'default' / 'circle_specific' — matching those verbatim here.
//
// Save uses delete-then-insert rather than upsert so we don't need a
// unique constraint on (user_id, preference_scope, circle_id) — the
// DB shape doesn't declare one.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type PayoutDestinationKind = "wallet" | "bank" | "goal" | "split";

export type PayoutSplitEntry = {
  destination: "wallet" | "bank" | "goal";
  percentage: number;
};

export interface PayoutPreference {
  id?: string;
  user_id: string;
  preference_scope: "default" | "circle_specific";
  circle_id: string | null;
  destination: PayoutDestinationKind;
  bank_account_id: string | null;
  savings_goal_id: string | null;
  split_config: PayoutSplitEntry[] | null;
  priority?: number | null;
}

export type PayoutBankOption = {
  id: string;
  bank_name: string;
  account_last4: string | null;
  nickname: string | null;
};

export type PayoutGoalOption = {
  id: string;
  name: string;
};

export function usePayoutPreference(circleId?: string) {
  const { user } = useAuth();
  const scope: PayoutPreference["preference_scope"] = circleId
    ? "circle_specific"
    : "default";

  const [preference, setPreference] = useState<PayoutPreference | null>(null);
  const [bankOptions, setBankOptions] = useState<PayoutBankOption[]>([]);
  const [goalOptions, setGoalOptions] = useState<PayoutGoalOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Preference row for the scope + circle. maybeSingle so a missing
      // row lands as null rather than a 406.
      const q = supabase
        .from("payout_preferences")
        .select("*")
        .eq("user_id", user.id)
        .eq("preference_scope", scope);
      const { data: prefRow } = circleId
        ? await q.eq("circle_id", circleId).maybeSingle()
        : await q.is("circle_id", null).maybeSingle();

      if (prefRow) {
        setPreference(prefRow as PayoutPreference);
      } else {
        // Default to wallet — the safest destination when no row exists.
        setPreference({
          user_id: user.id,
          preference_scope: scope,
          circle_id: circleId ?? null,
          destination: "wallet",
          bank_account_id: null,
          savings_goal_id: null,
          split_config: null,
        });
      }

      const [banksRes, goalsRes] = await Promise.all([
        supabase
          .from("user_bank_accounts")
          .select("id, bank_name, account_last4, nickname")
          .eq("user_id", user.id)
          .in("status", ["active", "verified"])
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("user_savings_goals")
          .select("id, name")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      setBankOptions((banksRes.data || []) as PayoutBankOption[]);
      setGoalOptions((goalsRes.data || []) as PayoutGoalOption[]);
    } catch (err) {
      console.warn("[usePayoutPreference] refresh failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, scope, circleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const savePreference = useCallback(
    async (payload: Omit<PayoutPreference, "id" | "user_id">) => {
      if (!user?.id) throw new Error("Not authenticated");
      // Delete-then-insert so we don't require a unique constraint on
      // (user_id, preference_scope, circle_id). At most one row per
      // scope should exist for a user; the delete makes that true.
      const del = supabase
        .from("payout_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("preference_scope", payload.preference_scope);
      const { error: delErr } = payload.circle_id
        ? await del.eq("circle_id", payload.circle_id)
        : await del.is("circle_id", null);
      if (delErr) throw new Error(delErr.message);

      const insertRow = {
        user_id: user.id,
        preference_scope: payload.preference_scope,
        circle_id: payload.circle_id,
        destination: payload.destination,
        bank_account_id:
          payload.destination === "bank" ||
          payload.split_config?.some((s) => s.destination === "bank")
            ? payload.bank_account_id
            : null,
        savings_goal_id:
          payload.destination === "goal" ||
          payload.split_config?.some((s) => s.destination === "goal")
            ? payload.savings_goal_id
            : null,
        split_config:
          payload.destination === "split" ? payload.split_config : null,
        priority: payload.priority ?? 100,
      };
      const { data, error } = await supabase
        .from("payout_preferences")
        .insert(insertRow)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      setPreference(data as PayoutPreference);
      return data as PayoutPreference;
    },
    [user?.id],
  );

  return {
    preference,
    bankOptions,
    goalOptions,
    isLoading,
    savePreference,
    refresh,
  };
}
