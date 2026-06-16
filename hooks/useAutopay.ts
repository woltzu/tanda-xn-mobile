// hooks/useAutopay.ts
// ─────────────────────────────────────────────────────────────────────────────
// P2 (autopay review): centralises the loan_autopay_configs read/write
// surface so AutopaySetupScreen (and any future consumers — e.g. an
// inline toggle on AdvanceSettingsScreen) share the same code path
// and the same 60-second cache.
//
// What it owns:
//   - useAutopayConfig(loanId) — fetch + cache + return state.
//   - save({ enabled, paymentMethodId, paymentMethodType, daysBeforeDue }) —
//     real upsert backed by migration 169's UNIQUE (user_id, loan_id).
//   - remove() — soft-delete (sets status='disabled') so the user's
//     last-known payment method survives if they re-enable later.
//   - refetch() — bust the cache and re-read.
//
// What it does NOT own:
//   - The "active advance" lookup (that's useAdvanceDashboard).
//   - Notification preferences for reminder days (now lives in
//     user_preferences.advance_reminder_days, edited via
//     NotificationPrefsScreen — see migration 169).
//
// Cache: module-scope Map keyed by `${userId}:${loanId}`, 60-second
// TTL, busted by save() / remove() / refetch(). Mirrors the pattern
// used in hooks/useProfile.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// Schema-aligned constants. Both enum values verified live 2026-06-15.
export const AUTOPAY_TYPE_FULL_BALANCE = "full_balance";
export const AUTOPAY_STATUS_ACTIVE = "active";
export const AUTOPAY_STATUS_DISABLED = "disabled";

export type AutopayConfig = {
  id: string;
  status: string;
  autopay_type: string;
  payment_method_id: string | null;
  payment_method_type: string | null;
  days_before_due: number | null;
};

export type SaveAutopayParams = {
  enabled: boolean;
  paymentMethodId: string | null; // null === wallet
  paymentMethodType: string; // 'wallet' | 'card' | 'us_bank_account'
  daysBeforeDue: number;
};

type CacheEntry = { value: AutopayConfig | null; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

const SELECT_COLUMNS =
  "id, status, autopay_type, payment_method_id, payment_method_type, days_before_due";

function cacheKey(userId: string, loanId: string): string {
  return `${userId}:${loanId}`;
}

function bustCacheFor(userId: string, loanId: string): void {
  cache.delete(cacheKey(userId, loanId));
}

export type UseAutopayResult = {
  config: AutopayConfig | null;
  loading: boolean;
  error: string | null;
  save: (params: SaveAutopayParams) => Promise<AutopayConfig>;
  remove: () => Promise<void>;
  refetch: () => Promise<void>;
};

export function useAutopayConfig(loanId: string | null): UseAutopayResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const initialKey = userId && loanId ? cacheKey(userId, loanId) : null;
  const initialHit = initialKey ? cache.get(initialKey) : undefined;
  const [config, setConfig] = useState<AutopayConfig | null>(
    initialHit && initialHit.expiresAt > Date.now() ? initialHit.value : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !(initialHit && initialHit.expiresAt > Date.now()),
  );
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(
    async (
      forUserId: string,
      forLoanId: string,
      opts?: { bypassCache?: boolean },
    ) => {
      const key = cacheKey(forUserId, forLoanId);
      if (!opts?.bypassCache) {
        const hit = cache.get(key);
        if (hit && hit.expiresAt > Date.now()) {
          setConfig(hit.value);
          setLoading(false);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("loan_autopay_configs")
        .select(SELECT_COLUMNS)
        .eq("user_id", forUserId)
        .eq("loan_id", forLoanId)
        .maybeSingle();
      if (e) {
        setError(e.message);
        setLoading(false);
        return;
      }
      const value = (data as AutopayConfig | null) ?? null;
      cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      setConfig(value);
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    if (!userId || !loanId) {
      setConfig(null);
      setLoading(false);
      return;
    }
    fetchOnce(userId, loanId);
  }, [userId, loanId, fetchOnce]);

  const save = useCallback(
    async (params: SaveAutopayParams): Promise<AutopayConfig> => {
      if (!userId || !loanId) {
        throw new Error("useAutopayConfig.save called without userId/loanId");
      }
      // Real upsert — backed by the UNIQUE (user_id, loan_id) constraint
      // added in migration 169. Replaces the P0 select-then-insert dance.
      const row = {
        user_id: userId,
        loan_id: loanId,
        autopay_type: AUTOPAY_TYPE_FULL_BALANCE,
        status: params.enabled
          ? AUTOPAY_STATUS_ACTIVE
          : AUTOPAY_STATUS_DISABLED,
        payment_method_id: params.paymentMethodId,
        payment_method_type: params.paymentMethodType,
        days_before_due: params.daysBeforeDue,
      };
      const { data, error: e } = await supabase
        .from("loan_autopay_configs")
        .upsert(row, { onConflict: "user_id,loan_id" })
        .select(SELECT_COLUMNS)
        .single();
      if (e) throw e;
      const value = data as AutopayConfig;
      cache.set(cacheKey(userId, loanId), {
        value,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      setConfig(value);
      return value;
    },
    [userId, loanId],
  );

  const remove = useCallback(async () => {
    if (!userId || !loanId) return;
    // Soft delete: flip status to 'disabled' so the user's
    // payment_method_type / id sticks around for next time. The cron
    // already skips non-'active' rows.
    const { data, error: e } = await supabase
      .from("loan_autopay_configs")
      .update({ status: AUTOPAY_STATUS_DISABLED })
      .eq("user_id", userId)
      .eq("loan_id", loanId)
      .select(SELECT_COLUMNS)
      .maybeSingle();
    if (e) throw e;
    const value = (data as AutopayConfig | null) ?? null;
    cache.set(cacheKey(userId, loanId), {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    setConfig(value);
  }, [userId, loanId]);

  const refetch = useCallback(async () => {
    if (!userId || !loanId) return;
    bustCacheFor(userId, loanId);
    await fetchOnce(userId, loanId, { bypassCache: true });
  }, [userId, loanId, fetchOnce]);

  return { config, loading, error, save, remove, refetch };
}
