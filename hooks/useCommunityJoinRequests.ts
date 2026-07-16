// ═══════════════════════════════════════════════════════════════════════════
// useCommunityJoinRequests — Phase 2 community discovery client hook
// ═══════════════════════════════════════════════════════════════════════════
//
// Wraps mig 345's three RPCs and one SELECT surface:
//   * request_to_join_community(community_id, reason?) → request_id
//   * approve_community_join_request(request_id, note?) → boolean
//   * reject_community_join_request(request_id, note?) → boolean
//   * SELECT own pending requests via community_join_requests SELECT RLS
//
// Consumers:
//   * CommunityBrowserScreen — calls requestToJoin(); reads
//     myPendingCommunityIds to gate the button state (Request / Pending /
//     Joined).
//   * Future ElderDashboardScreen review section — reads the same
//     community_join_requests table filtered by (status='pending' AND
//     the caller is an elder of the community). RLS handles the
//     visibility gate server-side.
//
// Refresh model:
//   * Simple useEffect + refresh() callback for now. No realtime
//     subscription — pending requests change infrequently and the
//     screens that need them all support pull-to-refresh.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type CommunityJoinRequest = {
  id: string;
  user_id: string;
  community_id: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reason: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
};

export function useCommunityJoinRequests() {
  const { user } = useAuth();
  const [myRequests, setMyRequests] = useState<CommunityJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setMyRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });
      if (!error && data) {
        setMyRequests(data as CommunityJoinRequest[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestToJoin = useCallback(
    async (
      communityId: string,
      reason?: string,
    ): Promise<{ success: boolean; requestId?: string; error?: string }> => {
      const { data, error } = await supabase.rpc(
        "request_to_join_community",
        { p_community_id: communityId, p_reason: reason ?? null },
      );
      if (error) return { success: false, error: error.message };
      await refresh();
      return { success: true, requestId: (data as string) ?? undefined };
    },
    [refresh],
  );

  const approve = useCallback(
    async (
      requestId: string,
      note?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.rpc(
        "approve_community_join_request",
        { p_request_id: requestId, p_note: note ?? null },
      );
      if (error) return { success: false, error: error.message };
      await refresh();
      return { success: true };
    },
    [refresh],
  );

  const reject = useCallback(
    async (
      requestId: string,
      note?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.rpc(
        "reject_community_join_request",
        { p_request_id: requestId, p_note: note ?? null },
      );
      if (error) return { success: false, error: error.message };
      await refresh();
      return { success: true };
    },
    [refresh],
  );

  // Derived: set of community_ids the current user has a pending
  // request against. Used by discovery screens to gate the CTA.
  const myPendingCommunityIds = new Set(
    myRequests
      .filter((r) => r.status === "pending")
      .map((r) => r.community_id),
  );

  return {
    myRequests,
    myPendingCommunityIds,
    loading,
    refresh,
    requestToJoin,
    approve,
    reject,
  };
}
