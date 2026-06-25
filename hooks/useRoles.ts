// ═══════════════════════════════════════════════════════════════════════════
// hooks/useRoles.ts — Phase 2 Bucket A
// ═══════════════════════════════════════════════════════════════════════════
//
// Reads profiles.role (added in migration 248) and exposes role-based
// gating booleans for UI checks. Role vocabulary:
//   • member            — default for new accounts
//   • verified_member   — promoted via promote_to_verified_member RPC
//   • elder_i / _ii / _iii — promoted via vote_elder_nomination quorum
//
// IMPORTANT: this is the app-level governance role, distinct from
// member_tier_status.current_tier (financial tier).
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type AppRole =
  | "member"
  | "verified_member"
  | "elder_i"
  | "elder_ii"
  | "elder_iii";

export interface UseRolesResult {
  role: AppRole | null;
  isElder: boolean;
  isVerified: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useRoles(userId: string | undefined): UseRolesResult {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (e) throw new Error(e.message);
      // Default to 'member' if the column is null (rows pre-migration-248
      // got the NOT NULL DEFAULT 'member' backfill, but be defensive).
      setRole((data?.role as AppRole | null) ?? "member");
    } catch (err: any) {
      setError(err?.message ?? "Failed to load role");
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isElder =
    role === "elder_i" || role === "elder_ii" || role === "elder_iii";
  const isVerified = isElder || role === "verified_member";

  return { role, isElder, isVerified, isLoading, error, refresh };
}
