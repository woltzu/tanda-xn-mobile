// ═══════════════════════════════════════════════════════════════════════════
// hooks/useAdminScope.ts — admin role + community scope (single source of truth)
// ═══════════════════════════════════════════════════════════════════════════
//
// Before this hook, AdminOverview / AdminUsers / AdminCircles / AdminTrips
// each duplicated the admin_users → role+community_id lookup and then
// the support-scoped follow-up queries (community_memberships for
// users, circles.community_id for circles, circles join for trips).
// This consolidates all of that.
//
// Returned shape:
//   role             — 'super_admin' | 'admin' | 'support' | null
//   communityId      — admin_users.community_id (null for non-support)
//   isSupport        — role === 'support'
//   isSuperAdmin     — role === 'super_admin' OR 'admin' (i.e. NOT support)
//   isAdmin          — any active admin row at all (null role → false)
//   scopedUserIds    — null when not support-scoped; otherwise the list of
//                      user ids in the admin's community (empty array = no
//                      members, screens still render an empty list).
//   scopedCircleIds  — null when not support-scoped; otherwise the list of
//                      circle ids in the admin's community.
//   noCommunityAssigned — TRUE if role === 'support' AND communityId IS
//                      NULL. Pre-launch this was a quiet hole: support
//                      users would see global data because the inline
//                      `if (role === 'support' && communityId)` would
//                      short-circuit. Screens now block on this flag.
//
// The hook does ONE round-trip to admin_users on mount, then a parallel
// round-trip to community_memberships + circles only when support-scoped.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type AdminRole = "super_admin" | "admin" | "support" | null;

export interface AdminScope {
  role: AdminRole;
  communityId: string | null;
  isSupport: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  scopedUserIds: string[] | null;
  scopedCircleIds: string[] | null;
  noCommunityAssigned: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAdminScope(): AdminScope {
  const { user } = useAuth();
  const [role, setRole] = useState<AdminRole>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [scopedUserIds, setScopedUserIds] = useState<string[] | null>(null);
  const [scopedCircleIds, setScopedCircleIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScope = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: adminRow, error: adminErr } = await supabase
        .from("admin_users")
        .select("role, community_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (adminErr) throw new Error(adminErr.message);

      const nextRole = (adminRow?.role as AdminRole) ?? null;
      const nextCommunityId = (adminRow?.community_id as string | null) ?? null;
      setRole(nextRole);
      setCommunityId(nextCommunityId);

      if (nextRole === "support" && nextCommunityId) {
        const [membersR, circlesR] = await Promise.all([
          supabase
            .from("community_memberships")
            .select("user_id")
            .eq("community_id", nextCommunityId)
            .eq("status", "active"),
          supabase
            .from("circles")
            .select("id")
            .eq("community_id", nextCommunityId),
        ]);
        if (membersR.error) throw new Error(membersR.error.message);
        if (circlesR.error) throw new Error(circlesR.error.message);
        setScopedUserIds(
          (membersR.data ?? []).map((r: any) => r.user_id as string),
        );
        setScopedCircleIds((circlesR.data ?? []).map((r: any) => r.id as string));
      } else {
        setScopedUserIds(null);
        setScopedCircleIds(null);
      }
    } catch (err) {
      console.warn("[useAdminScope] failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRole(null);
      setCommunityId(null);
      setScopedUserIds(null);
      setScopedCircleIds(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchScope();
  }, [fetchScope]);

  const isSupport = role === "support";
  const isSuperAdmin = role === "super_admin" || role === "admin";

  return {
    role,
    communityId,
    isSupport,
    isSuperAdmin,
    isAdmin: !!role,
    scopedUserIds,
    scopedCircleIds,
    noCommunityAssigned: isSupport && !communityId,
    loading,
    error,
    refetch: fetchScope,
  };
}
