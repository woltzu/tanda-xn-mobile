// ══════════════════════════════════════════════════════════════════════════════
// hooks/useCycleSubstitutions.ts
// Substitution Visibility — Bucket A.2
// ══════════════════════════════════════════════════════════════════════════════
//
// Thin wrapper around the get_cycle_substitution_state RPC (migration 235).
// Returns the active (non-terminal) substitution rows for a given cycle so
// CycleDetailScreen can overlay substitution context onto its per-member
// contribution rows.
//
// No realtime subscription — substitution_records transitions are infrequent
// (one row per exit request, with a few state flips over a 48 + 24 hour
// window). The notification path from migration 208 already delivers state
// changes to the affected actor; this hook is for the "what's currently
// happening to this cycle" overview, not for live ticker latency. If finer
// granularity becomes necessary, drop in a
//   supabase.channel('substitution-records:' + cycleId).on('postgres_changes', ...)
// subscription later.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Mirror the RPC's TABLE return shape one-to-one.
export type CycleSubstitutionRow = {
  substitution_id: string;
  circle_id: string;
  exiting_member_id: string;
  exiting_member_name: string;
  substitute_member_id: string;
  substitute_member_name: string;
  original_payout_position: number | null;
  status:
    | "pending_confirmation"
    | "confirmed"
    | "admin_pending";
  confirmation_deadline: string;
  admin_notified_at: string | null;
  hours_remaining_for_actor: number | null;
  actor_role: "substitute" | "admin" | null;
};

export type CycleSubstitutionsState = {
  rows: CycleSubstitutionRow[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useCycleSubstitutions(
  cycleId: string | undefined | null,
): CycleSubstitutionsState {
  const [rows, setRows] = useState<CycleSubstitutionRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!cycleId) {
      setRows([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const { data, error: rpcErr } = await supabase.rpc(
          "get_cycle_substitution_state",
          { p_cycle_id: cycleId },
        );
        if (cancelled) return;
        if (rpcErr) {
          setError(rpcErr.message);
          setRows([]);
          return;
        }
        setRows((data ?? []) as CycleSubstitutionRow[]);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "unknown_error");
          setRows([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cycleId, refreshKey]);

  return {
    rows,
    isLoading,
    error,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
