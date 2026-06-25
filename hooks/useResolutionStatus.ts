// ═══════════════════════════════════════════════════════════════════════════
// hooks/useResolutionStatus.ts — Phase 2 Bucket B
// ═══════════════════════════════════════════════════════════════════════════
//
// One canonical source of truth for "is the current user in critical
// tier and what's their resolution-review state". Drives:
//   • CriticalBanner (top-of-app red bar)
//   • ResolutionCenterScreen (read details + submit request)
//   • RestrictedActionGate (financial-action block)
//   • Settings delete-account guard
//
// Backed by get_demotion_details RPC (migration 249). Cached per-user
// at component scope; manual refresh after request_resolution_review.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface ResolutionDetails {
  tier: string;
  is_demoted: boolean;
  demotion_reason: string | null;
  demotion_path_back: string | null;
  demoted_at: string | null;
  reviewed_at: string | null;
  has_pending_review: boolean;
  latest_request: {
    id: string;
    status: "pending" | "reviewed" | "resolved" | "rejected";
    created_at: string;
    elder_comment: string | null;
  } | null;
}

export interface UseResolutionStatusResult {
  details: ResolutionDetails | null;
  isCritical: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useResolutionStatus(
  userId: string | undefined,
): UseResolutionStatusResult {
  const [details, setDetails] = useState<ResolutionDetails | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setDetails(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("get_demotion_details", {
        p_user_id: userId,
      });
      if (e) throw new Error(e.message);
      let result = (data ?? null) as ResolutionDetails | null;

      // Phase 2 Bucket C — cross-account flag check. A user who deleted a
      // critical account and re-signed up with the same email/phone shows
      // up here as 'newcomer' (their new account is fresh). is_account_flagged
      // catches that case and we synthesize a critical state so the banner
      // + RestrictedActionGate still fire. The actual member_tier_status
      // row is untouched; only the in-memory shape changes.
      if (result && result.tier !== "critical") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, phone")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.email || profile?.phone) {
          const { data: isFlagged } = await supabase.rpc("is_account_flagged", {
            p_email: profile?.email ?? null,
            p_phone: profile?.phone ?? null,
          });
          if (isFlagged === true) {
            result = {
              ...result,
              tier: "critical",
              is_demoted: true,
              demotion_reason:
                result.demotion_reason ??
                "This account is linked to a previously restricted account. Contact support to resolve.",
            };
          }
        }
      }
      setDetails(result);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load resolution status");
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCritical = details?.tier === "critical";

  return { details, isCritical, isLoading, error, refresh };
}
