// hooks/useAdminVerificationQueue.ts
// ─────────────────────────────────────────────────────────────────────────────
// Admin-only feed of staged-disbursement verification requests.
//
// RLS context: goal_disbursement_milestone_verifications has a SELECT
// policy that lets admin_users (is_active=TRUE) read every row.
// Non-admins see nothing here — the hook surfaces whatever RLS returns,
// no client-side gating attempted.
//
// The list joins the milestone, the goal, the provider, and the
// requester profile so the admin can review a request without follow-up
// queries.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type AdminVerificationStatus = "pending" | "approved" | "rejected";

export type AdminVerificationItem = {
  request_id: string;
  milestone_id: string;
  milestone_name: string;
  milestone_amount_cents: number;
  milestone_status: string;
  verification_method: string;
  goal_id: string;
  goal_name: string;
  provider_id: string;
  provider_business_name: string;
  requester_user_id: string;
  requester_name: string | null;
  status: AdminVerificationStatus;
  created_at: string;
  responded_at: string | null;
};

export function useAdminVerificationQueue(filter: AdminVerificationStatus = "pending") {
  const [items, setItems] = useState<AdminVerificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("goal_disbursement_milestone_verifications")
        .select(
          // PostgREST embedded-resource syntax — each block becomes a
          // nested object that we flatten below. RLS gates the read at
          // the outer table; embedded joins inherit visibility.
          `
            id,
            status,
            created_at,
            responded_at,
            requester_user_id,
            requester:profiles!requester_user_id(full_name),
            milestone:goal_disbursement_milestones!milestone_id(
              id,
              name,
              amount_cents,
              status,
              verification_method,
              goal_id,
              provider_id,
              goal:user_savings_goals!goal_id(name),
              provider:providers!provider_id(business_name)
            )
          `,
        )
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      const rows: AdminVerificationItem[] = ((data ?? []) as any[]).map((r) => ({
        request_id: r.id,
        milestone_id: r.milestone?.id ?? "",
        milestone_name: r.milestone?.name ?? "—",
        milestone_amount_cents: r.milestone?.amount_cents ?? 0,
        milestone_status: r.milestone?.status ?? "",
        verification_method: r.milestone?.verification_method ?? "",
        goal_id: r.milestone?.goal_id ?? "",
        goal_name: r.milestone?.goal?.name ?? "—",
        provider_id: r.milestone?.provider_id ?? "",
        provider_business_name: r.milestone?.provider?.business_name ?? "—",
        requester_user_id: r.requester_user_id,
        requester_name: r.requester?.full_name ?? null,
        status: r.status as AdminVerificationStatus,
        created_at: r.created_at,
        responded_at: r.responded_at,
      }));
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  return { items, loading, error, refetch: fetchQueue };
}
