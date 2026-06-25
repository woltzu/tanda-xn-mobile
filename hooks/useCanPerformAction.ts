// ═══════════════════════════════════════════════════════════════════════════
// hooks/useCanPerformAction.ts — Phase 2, migration 257
// ═══════════════════════════════════════════════════════════════════════════
//
// Calls the server-side can_perform_action(user_id, action_type) RPC.
// Returns boolean + loading state. Default value while loading is `true`
// (optimistic) to avoid disabling buttons for 99% of users who aren't
// critical — same posture as RestrictedActionGate.
//
// When to use this vs useRestrictedAction:
//   • useRestrictedAction  → boolean derived from useResolutionStatus
//     (one round-trip on screen mount, shared cache). Use for generic
//     "is this user blocked from any action" gating.
//   • useCanPerformAction  → calls the RPC for a specific action_type.
//     Use when you need future-proofing for per-action policy carve-outs
//     (e.g. "withdraw blocked but invite allowed"). Currently the RPC
//     ignores action_type and returns the same boolean as the resolution
//     status check, but the hook is the right place to evolve from.
//
// The RPC fails CLOSED on auth errors (RPC returns FALSE on network
// errors), so the UI errs on the side of blocking when we can't reach
// the DB — appropriate for a financial gate.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type ActionType =
  | "contribute"
  | "request_payout"
  | "withdraw"
  | "invite"
  | "vouch"
  | "vote";

export interface UseCanPerformActionResult {
  canPerform: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCanPerformAction(
  userId: string | undefined,
  actionType: ActionType,
): UseCanPerformActionResult {
  const [canPerform, setCanPerform] = useState(true);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCanPerform(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("can_perform_action", {
        p_user_id: userId,
        p_action_type: actionType,
      });
      if (e) throw new Error(e.message);
      setCanPerform(data === true);
    } catch (err: any) {
      // Fail closed: any RPC error → block the action. The DB trigger
      // will block it anyway; this just avoids surfacing a server error
      // to the user when we can't determine the state.
      setError(err?.message ?? "Failed to check action permission");
      setCanPerform(false);
    } finally {
      setLoading(false);
    }
  }, [userId, actionType]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { canPerform, isLoading, error, refresh };
}
