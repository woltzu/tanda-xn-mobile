// ═══════════════════════════════════════════════════════════════════════════
// hooks/useFreezeStatus.ts — mig 390
// ═══════════════════════════════════════════════════════════════════════════
//
// One source of truth for "is the current user's account frozen and why".
// Drives:
//   • FrozenBanner (top-of-app blue bar)
//   • Any per-screen blocked-state UI (contribution / wallet / send money)
//
// Reads profiles.account_frozen_at / account_frozen_reason directly.
// The freeze state changes rarely; no realtime subscription — screens
// that need a fresh read after an admin action can call refresh().
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface FreezeStatus {
  isFrozen: boolean;
  frozenAt: string | null;
  reason: string | null;
}

export interface UseFreezeStatusResult {
  isFrozen: boolean;
  frozenAt: string | null;
  reason: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFreezeStatus(
  userId: string | undefined,
): UseFreezeStatusResult {
  const [status, setStatus] = useState<FreezeStatus | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStatus({ isFrozen: false, frozenAt: null, reason: null });
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("profiles")
        .select("account_frozen_at, account_frozen_reason")
        .eq("id", userId)
        .maybeSingle();
      if (e) throw new Error(e.message);
      setStatus({
        isFrozen: Boolean(data?.account_frozen_at),
        frozenAt: (data?.account_frozen_at as string | null) ?? null,
        reason: (data?.account_frozen_reason as string | null) ?? null,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load freeze status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    isFrozen: status?.isFrozen ?? false,
    frozenAt: status?.frozenAt ?? null,
    reason: status?.reason ?? null,
    isLoading,
    error,
    refresh,
  };
}
