// ═══════════════════════════════════════════════════════════════════════════
// hooks/useCircleRiskFlags.ts — Sensitive Signal Nudges
// ═══════════════════════════════════════════════════════════════════════════
//
// Elder-only fetch of derived risk flags for circle participants. Backed by
// get_circle_risk_flags RPC (migration 256), which:
//   • Reads LATEST stress + mood per member from the dedicated score
//     tables (member_stress_scores, member_mood_snapshots)
//   • Classifies via compute_risk_flags(stress, mood) into low/medium/high
//   • Gates on caller role LIKE 'elder%' server-side — non-elders get a
//     PostgREST error (the hook surfaces it via error state)
//
// Privacy principle (governance doc, verbatim):
//   "Even elders never see the raw numbers. What an elder receives is a
//    derived, consent-aware nudge."
//
// Never log or expose the underlying scores — only the flag + reason.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type RiskFlag = "low" | "medium" | "high";

export interface MemberRiskFlag {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
  risk_flag: RiskFlag;
  risk_reason: string | null;
}

export interface UseCircleRiskFlagsResult {
  flags: MemberRiskFlag[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCircleRiskFlags(
  circleId: string | undefined,
): UseCircleRiskFlagsResult {
  const [flags, setFlags] = useState<MemberRiskFlag[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!circleId) {
      setFlags([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("get_circle_risk_flags", {
        p_circle_id: circleId,
      });
      if (e) throw new Error(e.message);
      setFlags((data ?? []) as MemberRiskFlag[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load risk flags");
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { flags, isLoading, error, refresh };
}
