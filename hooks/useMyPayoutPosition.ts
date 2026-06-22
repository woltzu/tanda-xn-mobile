// ══════════════════════════════════════════════════════════════════════════════
// hooks/useMyPayoutPosition.ts
// payout_position audit Bucket B.1
// ══════════════════════════════════════════════════════════════════════════════
//
// Reads the auth user's `position` (canonical column after migration 233 —
// see the audit commit for context) on a specific circle. Also returns the
// total number of active members in that circle so the caller can render
// "You are #X of Y" without a second round-trip.
//
// Replaces mockPayout = { position: 2, total: 6 } that CirclesV2Screen
// hardcoded as a placeholder. With the migration in place every new circle
// gets `position` written when the Nth member joins, but circles that
// existed before migration 233 may still have NULLs — the hook returns
// three discriminated states so the caller can render appropriately:
//
//   kind: 'none'      — user is not in this circle (or no circleId)
//   kind: 'pending'   — user is a member but position is NULL (pre-233
//                       circle, or not yet full)
//   kind: 'assigned'  — user has a position; ready to display
//
// No realtime subscription today — circle_members.position changes
// infrequently (initial assignment + swaps + AI re-runs), and the existing
// notify_payout_position_assigned trigger from migration 233 will surface
// changes through the notifications channel. If we need live UI updates
// later, drop in a `supabase.channel('circle-members:'+circleId)
// .on('postgres_changes',...)` subscription.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type MyPayoutPositionState =
  | { kind: "none"; isLoading: boolean }
  | { kind: "pending"; isLoading: boolean; total: number; circleName: string | null }
  | {
      kind: "assigned";
      isLoading: boolean;
      position: number;
      total: number;
      circleName: string | null;
    };

const EMPTY_STATE: MyPayoutPositionState = { kind: "none", isLoading: false };

export function useMyPayoutPosition(
  circleId: string | undefined | null,
): MyPayoutPositionState {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<MyPayoutPositionState>(() =>
    circleId && userId
      ? { kind: "none", isLoading: true }
      : EMPTY_STATE,
  );

  useEffect(() => {
    if (!circleId || !userId) {
      setState(EMPTY_STATE);
      return;
    }
    let cancelled = false;
    setState((prev) =>
      prev.kind === "none" ? { kind: "none", isLoading: true } : { ...prev, isLoading: true },
    );

    (async () => {
      try {
        // Two parallel queries — the circle row (for name + total) and the
        // user's membership row (for position). Both are cheap and indexed.
        const [memberQ, circleQ, totalQ] = await Promise.all([
          supabase
            .from("circle_members")
            .select("position")
            .eq("user_id", userId)
            .eq("circle_id", circleId)
            .maybeSingle(),
          supabase
            .from("circles")
            .select("name")
            .eq("id", circleId)
            .maybeSingle(),
          supabase
            .from("circle_members")
            .select("id", { count: "exact", head: true })
            .eq("circle_id", circleId)
            .eq("status", "active"),
        ]);
        if (cancelled) return;

        const total = totalQ.count ?? 0;
        const circleName = (circleQ.data as any)?.name ?? null;
        const pos = (memberQ.data as any)?.position;

        if (memberQ.error || circleQ.error) {
          setState(EMPTY_STATE);
          return;
        }
        if (!memberQ.data) {
          // User isn't a member of this circle.
          setState(EMPTY_STATE);
          return;
        }
        if (pos == null) {
          setState({ kind: "pending", isLoading: false, total, circleName });
          return;
        }
        setState({
          kind: "assigned",
          isLoading: false,
          position: Number(pos),
          total,
          circleName,
        });
      } catch {
        if (!cancelled) setState(EMPTY_STATE);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [circleId, userId]);

  return useMemo(() => state, [state]);
}
