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

// Phase 2 (migration 262) — elder permission booleans synced from role
// by the BEFORE INSERT/UPDATE OF role trigger. Mirroring them here lets
// the UI gate buttons without re-deriving from role on every call site.
export interface ElderPermissions {
  canMediateDisputes: boolean;
  canVouchElder: boolean;
  canApproveElder: boolean;
  canManageCommunity: boolean;
}

export interface UseRolesResult {
  role: AppRole | null;
  isElder: boolean;
  isVerified: boolean;
  /** Latest honor_score from profiles (null if missing or not loaded yet). */
  honorScore: number | null;
  /** Per-tier permission flags (all false for non-elders). */
  permissions: ElderPermissions;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_PERMS: ElderPermissions = {
  canMediateDisputes: false,
  canVouchElder: false,
  canApproveElder: false,
  canManageCommunity: false,
};

export function useRoles(userId: string | undefined): UseRolesResult {
  const [role, setRole] = useState<AppRole | null>(null);
  const [honorScore, setHonorScore] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<ElderPermissions>(EMPTY_PERMS);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRole(null);
      setHonorScore(null);
      setPermissions(EMPTY_PERMS);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error: e } = await supabase
        .from("profiles")
        .select(
          "role, honor_score, can_mediate_disputes, can_vouch_elder, can_approve_elder, can_manage_community",
        )
        .eq("id", userId)
        .maybeSingle();
      if (e) throw new Error(e.message);
      // Default to 'member' if the column is null (rows pre-migration-248
      // got the NOT NULL DEFAULT 'member' backfill, but be defensive).
      setRole((data?.role as AppRole | null) ?? "member");
      setHonorScore(
        typeof data?.honor_score === "number" ? data.honor_score : null,
      );
      setPermissions({
        canMediateDisputes: data?.can_mediate_disputes === true,
        canVouchElder:      data?.can_vouch_elder === true,
        canApproveElder:    data?.can_approve_elder === true,
        canManageCommunity: data?.can_manage_community === true,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to load role");
      setRole(null);
      setHonorScore(null);
      setPermissions(EMPTY_PERMS);
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

  return {
    role,
    isElder,
    isVerified,
    honorScore,
    permissions,
    isLoading,
    error,
    refresh,
  };
}
