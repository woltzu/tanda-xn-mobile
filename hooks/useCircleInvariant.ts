// ═══════════════════════════════════════════════════════════════════════════
// hooks/useCircleInvariant.ts — Doc 38 admin UI
// ═══════════════════════════════════════════════════════════════════════════
//
// Wraps the get_circle_invariant RPC (mig 373). Admin-only surface — the
// RPC itself checks admin_users.is_active, so non-admins get an error
// state here.
//
// Used by the CircleDetail admin section to render the invariant status
// card + by CloseCircleModal to gate the close action.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface CircleInvariant {
  circle_id: string;
  circle_name: string;
  status: string;
  closed_at: string | null;
  contributions_total: number;
  payouts_total: number;
  corrections_total: number;
  net_cents: number;
  balanced: boolean;
  can_close: boolean;
}

export interface UseCircleInvariantResult {
  invariant: CircleInvariant | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCircleInvariant(
  circleId: string | undefined,
): UseCircleInvariantResult {
  const [invariant, setInvariant] = useState<CircleInvariant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!circleId) {
      setInvariant(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc(
        "get_circle_invariant",
        { p_circle_id: circleId },
      );
      if (rpcErr) throw new Error(rpcErr.message);
      setInvariant((data as CircleInvariant) ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setInvariant(null);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { invariant, loading, error, refetch };
}
