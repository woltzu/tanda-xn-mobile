// hooks/useAdminTemplateQueue.ts
// ─────────────────────────────────────────────────────────────────────────────
// Admin-only feed of community template submissions. Mirrors the
// useAdminVerificationQueue shape — single-filter (pending / approved /
// rejected), joined to the submitter profile.
//
// RLS on template_submissions grants SELECT to active admins, so a
// non-admin sees nothing. The list is ordered by created_at DESC so the
// freshest submission tops the queue.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type TemplateSubmissionStatus = "pending" | "approved" | "rejected";

export type TemplateSubmissionItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  target_cents: number | null;
  timeline_months: number | null;
  milestones: Array<{
    name: string;
    description?: string;
    default_percent: number;
    order_index?: number;
  }>;
  cost_breakdown: Array<{
    item: string;
    cost_cents: number;
    note?: string | null;
  }>;
  provider_categories: string[] | null;
  country: string | null;
  status: TemplateSubmissionStatus;
  admin_notes: string | null;
  votes: number;
  created_at: string;
  reviewed_at: string | null;
  user_id: string;
  submitter_name: string | null;
};

export function useAdminTemplateQueue(filter: TemplateSubmissionStatus = "pending") {
  const [items, setItems] = useState<TemplateSubmissionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("template_submissions")
        .select(
          `
            id, category, name, description, target_cents, timeline_months,
            milestones, cost_breakdown, provider_categories, country,
            status, admin_notes, votes, created_at, reviewed_at, user_id,
            submitter:profiles!user_id(full_name)
          `,
        )
        .eq("status", filter)
        .order("created_at", { ascending: false })
        .limit(200);
      if (err) throw err;
      const rows: TemplateSubmissionItem[] = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        category: r.category,
        name: r.name,
        description: r.description,
        target_cents: r.target_cents,
        timeline_months: r.timeline_months,
        milestones: r.milestones ?? [],
        cost_breakdown: r.cost_breakdown ?? [],
        provider_categories: r.provider_categories,
        country: r.country,
        status: r.status,
        admin_notes: r.admin_notes,
        votes: r.votes ?? 0,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        user_id: r.user_id,
        submitter_name: r.submitter?.full_name ?? null,
      }));
      setItems(rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load template queue");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  return { items, loading, error, refetch: fetchQueue };
}

// ─── Action wrappers ────────────────────────────────────────────────────────
// Thin call sites for the SECURITY DEFINER RPCs. Returns { ok, message }
// so the screen can render a single error path regardless of which verb
// fired.
export async function approveSubmission(
  submissionId: string,
  adminNotes?: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc("approve_template_submission", {
    p_submission_id: submissionId,
    p_admin_notes: adminNotes ?? null,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function rejectSubmission(
  submissionId: string,
  adminNotes: string,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc("reject_template_submission", {
    p_submission_id: submissionId,
    p_admin_notes: adminNotes,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
