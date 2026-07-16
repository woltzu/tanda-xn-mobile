// ═══════════════════════════════════════════════════════════════════════════
// useBlockedUsers — Phase 3 mutual-blocking client hook
// ═══════════════════════════════════════════════════════════════════════════
//
// Wraps the mig 346 surface:
//   * blocked_users table (SELECT own via RLS, INSERT own, DELETE own)
//   * is_user_blocked(a, b) SECURITY DEFINER helper — symmetric check
//
// Server-side filtering. Feed posts and feed comments are already
// hidden by RLS whenever either party has blocked the other, so
// consumers do NOT need to filter feed data themselves. The hook is
// only needed for:
//   * UI state ("Block" vs "Unblock" on a user profile)
//   * Manual member-list filtering where the raw list bypasses RLS
//     (e.g. circle rosters populated via community_memberships joins,
//     which are separate tables and not affected by mig 346's filters)
//
// Refresh model: simple useEffect on auth uid change; consumers call
// refresh() after a block/unblock action if they want an immediate
// re-read. blockUser/unblockUser already refresh internally.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type BlockedUserRow = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
};

export function useBlockedUsers() {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setBlocked([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blocked_users")
        .select("*")
        .eq("blocker_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setBlocked(data as BlockedUserRow[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blockUser = useCallback(
    async (
      targetId: string,
      reason?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user?.id) return { success: false, error: "not signed in" };
      if (targetId === user.id) {
        return { success: false, error: "cannot block yourself" };
      }
      const { error } = await supabase.from("blocked_users").insert({
        blocker_id: user.id,
        blocked_id: targetId,
        reason: reason ?? null,
      });
      if (error) {
        // ignore duplicate — already blocked
        if (error.code !== "23505") {
          return { success: false, error: error.message };
        }
      }
      await refresh();
      return { success: true };
    },
    [user?.id, refresh],
  );

  const unblockUser = useCallback(
    async (
      targetId: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user?.id) return { success: false, error: "not signed in" };
      const { error } = await supabase
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetId);
      if (error) return { success: false, error: error.message };
      await refresh();
      return { success: true };
    },
    [user?.id, refresh],
  );

  // Local-side: "have I blocked this user?"
  const isUserBlocked = useCallback(
    (targetId: string): boolean =>
      blocked.some((b) => b.blocked_id === targetId),
    [blocked],
  );

  // Server-side: "am I blocked by this user?" — needs the SECURITY
  // DEFINER helper because RLS hides the block row from the blocked
  // party. Callers use this sparingly (a single button state check).
  const isBlockedByUser = useCallback(
    async (targetId: string): Promise<boolean> => {
      if (!user?.id) return false;
      const { data, error } = await supabase.rpc("is_user_blocked", {
        p_user_id: targetId,
        p_target_id: user.id,
      });
      if (error) return false;
      return Boolean(data);
    },
    [user?.id],
  );

  // Derived helper for member-list filtering.
  const blockedIds = useMemo(
    () => new Set(blocked.map((b) => b.blocked_id)),
    [blocked],
  );
  const getBlockedIds = useCallback(() => blockedIds, [blockedIds]);

  return {
    blocked,
    loading,
    refresh,
    blockUser,
    unblockUser,
    isUserBlocked,
    isBlockedByUser,
    getBlockedIds,
  };
}
