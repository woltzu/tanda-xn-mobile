// ═══════════════════════════════════════════════════════════════════════════
// useCommunityMembers — Phase 8 member directory
// ═══════════════════════════════════════════════════════════════════════════
//
// Fetches every active member of a community joined with the profile
// row (full_name, avatar_url, xn_score) for the Members tab on
// CommunityHubScreen.
//
// Sorting: elders and owners first (they anchor the community), then
// members by joined_at ASC (oldest first). The role-rank map is
// stable — DB rows carry role TEXT; we translate to a numeric rank
// client-side. Community role hierarchy per mig 005: owner > admin >
// moderator > elder > member.
//
// Search: an optional term filters by full_name using
// String.prototype.includes (case-insensitive) — client-side because
// the row set is small (typical community < a few hundred members).
// If a community ever pushes past ~2k members we should switch to a
// server-side ilike filter.
//
// RLS: mig 005's memberships_select already allows every active member
// to see every other active member's row in their community, so no
// extra gate is needed.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type CommunityMemberRole =
  | "owner"
  | "admin"
  | "moderator"
  | "elder"
  | "member";

export type CommunityMemberRow = {
  id: string;
  user_id: string;
  role: CommunityMemberRole;
  status: string;
  joined_at: string | null;
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    xn_score: number | null;
  } | null;
};

const ROLE_RANK: Record<CommunityMemberRole, number> = {
  owner: 0,
  admin: 1,
  moderator: 2,
  elder: 3,
  member: 4,
};

export function useCommunityMembers(
  communityId: string | undefined,
  searchTerm: string,
) {
  const [members, setMembers] = useState<CommunityMemberRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!communityId) {
      setMembers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from("community_memberships")
        .select(
          `
            id,
            user_id,
            role,
            status,
            joined_at,
            profile:profiles!community_memberships_user_id_fkey(
              id, full_name, avatar_url, xn_score
            )
          `,
        )
        .eq("community_id", communityId)
        .eq("status", "active");
      if (e) {
        setError(e.message);
      } else if (data) {
        setMembers(data as unknown as CommunityMemberRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? members.filter((m) =>
          (m.profile?.full_name ?? "").toLowerCase().includes(term),
        )
      : members;
    return [...filtered].sort((a, b) => {
      const ra = ROLE_RANK[a.role] ?? 5;
      const rb = ROLE_RANK[b.role] ?? 5;
      if (ra !== rb) return ra - rb;
      const ja = new Date(a.joined_at ?? 0).getTime();
      const jb = new Date(b.joined_at ?? 0).getTime();
      return ja - jb;
    });
  }, [members, searchTerm]);

  return {
    members: visible,
    totalCount: members.length,
    loading,
    error,
    refresh: load,
  };
}
