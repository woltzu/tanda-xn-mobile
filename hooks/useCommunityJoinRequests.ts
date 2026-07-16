// ═══════════════════════════════════════════════════════════════════════════
// useCommunityJoinRequests + usePendingElderRequests — mig 345 client
// ═══════════════════════════════════════════════════════════════════════════
//
// Wraps mig 345's three RPCs and two SELECT surfaces:
//   * request_to_join_community(community_id, reason?) → request_id
//   * approve_community_join_request(request_id, note?) → boolean
//   * reject_community_join_request(request_id, note?) → boolean
//   * SELECT own pending requests (as applicant)
//   * SELECT pending requests as elder (for communities the caller is
//     an elder/owner of) — RLS join_requests_select handles the gate
//     server-side (see mig 345 lines 80-91), so the client just needs
//     the join for name/avatar/community-name.
//
// Consumers:
//   * CommunityBrowserScreen — calls requestToJoin(); reads
//     myPendingCommunityIds to gate the button state.
//   * ElderDashboardScreen — usePendingElderRequests() for the
//     approve/reject list.
//
// Refresh model:
//   * useEffect + refresh() callback. No realtime for MVP.
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

// ─── usePendingElderRequests ─────────────────────────────────────────────
// Enriched pending-request rows for the elder review UI. Filters out
// the caller's OWN pending requests (they'd only appear here if the
// elder is also a pending applicant against a community they elder-
// review, which is a weird edge case; the ElderDashboard is not the
// place for the applicant view).

export type PendingElderRequest = {
  id: string;
  user_id: string;
  community_id: string;
  reason: string | null;
  requested_at: string;
  applicant: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    country_of_origin: string | null;
    city_of_origin: string | null;
  } | null;
  community: {
    id: string;
    name: string | null;
  } | null;
};

export function usePendingElderRequests() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingElderRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("community_join_requests")
        .select(
          `
            id,
            user_id,
            community_id,
            reason,
            requested_at,
            applicant:profiles!community_join_requests_user_id_fkey(
              id, full_name, avatar_url, country_of_origin, city_of_origin
            ),
            community:communities!community_join_requests_community_id_fkey(
              id, name
            )
          `,
        )
        .eq("status", "pending")
        .neq("user_id", user.id)
        .order("requested_at", { ascending: true });
      if (!error && data) {
        setPending(data as unknown as PendingElderRequest[]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const approve = useCallback(
    async (
      requestId: string,
      note?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      setPending((prev) => prev.filter((r) => r.id !== requestId));
      const { error } = await supabase.rpc(
        "approve_community_join_request",
        { p_request_id: requestId, p_note: note ?? null },
      );
      if (error) {
        await refresh();
        return { success: false, error: error.message };
      }
      return { success: true };
    },
    [refresh],
  );

  const reject = useCallback(
    async (
      requestId: string,
      note?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      setPending((prev) => prev.filter((r) => r.id !== requestId));
      const { error } = await supabase.rpc(
        "reject_community_join_request",
        { p_request_id: requestId, p_note: note ?? null },
      );
      if (error) {
        await refresh();
        return { success: false, error: error.message };
      }
      return { success: true };
    },
    [refresh],
  );

  return { pending, loading, refresh, approve, reject };
}
