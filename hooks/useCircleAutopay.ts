// hooks/useCircleAutopay.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 0 of Circle Contribution Autopay. Two hooks:
//
//   useCircleAutopayConfig(circleId)
//     - One row for the (current user, circleId) pair.
//     - save({ enabled, paymentMethodId, paymentMethodType,
//             contributionAmountCents, scheduleType, daysBefore })
//       → upserts onConflict(user_id,circle_id) thanks to the
//         constraint added in migration 171.
//     - remove() → soft delete (status='disabled'). Keeps the user's
//                  saved method around for re-enable.
//
//   useCircleAutopayList()
//     - All configs for the current user, joined with the circle's
//       name + per-cycle amount so the management screen can render
//       rows without N+1.
//     - refetch() / mutating actions bust the cache.
//
// Cache: module-scope Maps, 60-second TTL. Mirrors useProfile +
// useAutopay patterns shipped earlier in the autopay review.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type CircleAutopayConfig = {
  id: string;
  user_id: string;
  circle_id: string;
  payment_method_id: string | null;
  payment_method_type: string;
  enabled: boolean;
  contribution_amount_cents: number;
  schedule_type: "on_due" | "days_before";
  days_before: number;
  status: "active" | "paused" | "disabled";
  last_executed_at: string | null;
  next_execution_at: string | null;
  // Phase 2 — round-up integration (migration 173).
  round_up_enabled: boolean;
  pending_round_up_credit_cents: number;
};

// Row shape returned by the management list — includes joined circle
// metadata so the screen doesn't need a second round-trip.
export type CircleAutopayListItem = CircleAutopayConfig & {
  circle: { id: string; name: string; amount: number; currency: string | null };
};

export type SaveCircleAutopayParams = {
  enabled: boolean;
  paymentMethodId: string | null; // null = wallet
  paymentMethodType: "wallet" | "card" | "us_bank_account";
  contributionAmountCents: number;
  scheduleType: "on_due" | "days_before";
  daysBefore: number;
  // Phase 2 — opt-in round-up sweep from wallet transactions.
  roundUpEnabled?: boolean;
};

const SELECT_COLUMNS =
  "id, user_id, circle_id, payment_method_id, payment_method_type, enabled, contribution_amount_cents, schedule_type, days_before, status, last_executed_at, next_execution_at, round_up_enabled, pending_round_up_credit_cents";

const LIST_SELECT = `${SELECT_COLUMNS}, circle:circles!inner(id, name, amount, currency)`;

const CACHE_TTL_MS = 60_000;

type SingleCache = { value: CircleAutopayConfig | null; expiresAt: number };
type ListCache = { value: CircleAutopayListItem[]; expiresAt: number };

const singleCache = new Map<string, SingleCache>();
const listCache = new Map<string, ListCache>();

function singleKey(userId: string, circleId: string): string {
  return `${userId}:${circleId}`;
}

function bustList(userId: string): void {
  listCache.delete(userId);
}
function bustSingle(userId: string, circleId: string): void {
  singleCache.delete(singleKey(userId, circleId));
}

// ── Single-config hook ──────────────────────────────────────────────────────

export type UseCircleAutopayConfigResult = {
  config: CircleAutopayConfig | null;
  loading: boolean;
  error: string | null;
  save: (params: SaveCircleAutopayParams) => Promise<CircleAutopayConfig>;
  remove: () => Promise<void>;
  refetch: () => Promise<void>;
};

export function useCircleAutopayConfig(
  circleId: string | null,
): UseCircleAutopayConfigResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = userId && circleId ? singleKey(userId, circleId) : null;
  const hit = key ? singleCache.get(key) : undefined;

  const [config, setConfig] = useState<CircleAutopayConfig | null>(
    hit && hit.expiresAt > Date.now() ? hit.value : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !(hit && hit.expiresAt > Date.now()),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(
    async (
      forUserId: string,
      forCircleId: string,
      opts?: { bypass?: boolean },
    ) => {
      const k = singleKey(forUserId, forCircleId);
      if (!opts?.bypass) {
        const h = singleCache.get(k);
        if (h && h.expiresAt > Date.now()) {
          setConfig(h.value);
          setLoading(false);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("circle_autopay_configs")
        .select(SELECT_COLUMNS)
        .eq("user_id", forUserId)
        .eq("circle_id", forCircleId)
        .maybeSingle();
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      const value = (data as CircleAutopayConfig | null) ?? null;
      singleCache.set(k, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      setConfig(value);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!userId || !circleId) {
      setConfig(null);
      setLoading(false);
      return;
    }
    fetchOnce(userId, circleId);
  }, [userId, circleId, fetchOnce]);

  const save = useCallback(
    async (params: SaveCircleAutopayParams): Promise<CircleAutopayConfig> => {
      if (!userId || !circleId) {
        throw new Error("useCircleAutopayConfig.save requires userId+circleId");
      }
      const row = {
        user_id: userId,
        circle_id: circleId,
        payment_method_id: params.paymentMethodId,
        payment_method_type: params.paymentMethodType,
        enabled: params.enabled,
        contribution_amount_cents: params.contributionAmountCents,
        schedule_type: params.scheduleType,
        days_before: params.daysBefore,
        // status='active' on a fresh enable; flipping enabled=false
        // leaves status='active' so the cron can still detect manual
        // re-enables. Hard pauses go through remove().
        status: "active" as const,
        // Phase 2 — round-up opt-in. Default false to preserve
        // pre-Phase-2 behaviour for callers that don't pass the flag.
        round_up_enabled: params.roundUpEnabled ?? false,
      };
      const { data, error: e } = await supabase
        .from("circle_autopay_configs")
        .upsert(row, { onConflict: "user_id,circle_id" })
        .select(SELECT_COLUMNS)
        .single();
      if (e) throw e;
      const value = data as CircleAutopayConfig;
      singleCache.set(singleKey(userId, circleId), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      bustList(userId);
      setConfig(value);
      return value;
    },
    [userId, circleId],
  );

  const remove = useCallback(async () => {
    if (!userId || !circleId) return;
    const { data, error: e } = await supabase
      .from("circle_autopay_configs")
      .update({ status: "disabled", enabled: false })
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .select(SELECT_COLUMNS)
      .maybeSingle();
    if (e) throw e;
    const value = (data as CircleAutopayConfig | null) ?? null;
    singleCache.set(singleKey(userId, circleId), {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    bustList(userId);
    setConfig(value);
  }, [userId, circleId]);

  const refetch = useCallback(async () => {
    if (!userId || !circleId) return;
    bustSingle(userId, circleId);
    await fetchOnce(userId, circleId, { bypass: true });
  }, [userId, circleId, fetchOnce]);

  return { config, loading, error, save, remove, refetch };
}

// ── List hook (management screen) ───────────────────────────────────────────

export type UseCircleAutopayListResult = {
  items: CircleAutopayListItem[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

export function useCircleAutopayList(): UseCircleAutopayListResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const hit = userId ? listCache.get(userId) : undefined;

  const [items, setItems] = useState<CircleAutopayListItem[]>(
    hit && hit.expiresAt > Date.now() ? hit.value : [],
  );
  const [loading, setLoading] = useState<boolean>(
    !(hit && hit.expiresAt > Date.now()),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(
    async (forUserId: string, opts?: { bypass?: boolean }) => {
      if (!opts?.bypass) {
        const h = listCache.get(forUserId);
        if (h && h.expiresAt > Date.now()) {
          setItems(h.value);
          setLoading(false);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("circle_autopay_configs")
        .select(LIST_SELECT)
        .eq("user_id", forUserId)
        .neq("status", "disabled")
        .order("created_at", { ascending: false });
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      const value = (data ?? []) as CircleAutopayListItem[];
      listCache.set(forUserId, {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      setItems(value);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    fetchOnce(userId);
  }, [userId, fetchOnce]);

  const refetch = useCallback(async () => {
    if (!userId) return;
    bustList(userId);
    await fetchOnce(userId, { bypass: true });
  }, [userId, fetchOnce]);

  return { items, loading, error, refetch };
}
