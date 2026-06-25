// ═══════════════════════════════════════════════════════════════════════════
// hooks/useDisputes.ts — Phase 2, migration 261
// ═══════════════════════════════════════════════════════════════════════════
//
// Three hooks for dispute mediation:
//   • useDisputes(circleId?)      — list of disputes the user can see
//   • useDispute(disputeId)        — single dispute + its messages
//   • useFileDispute()             — mutation to file a new one
//
// Visibility is enforced by the existing RLS (disputes_select +
// dispute_messages_select). Field names match the prod schema:
//   reporter_user_id, against_user_id, assigned_to, resolution,
//   resolved_by, dispute_messages.sender_user_id / message / is_private.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type DisputeStatus =
  | "open"
  | "under_review"
  | "resolved"
  | "rejected"
  | "closed";

export interface Dispute {
  id: string;
  reporter_user_id: string;
  against_user_id: string | null;
  circle_id: string | null;
  type: string;
  title: string;
  description: string;
  priority: string | null;
  status: DisputeStatus;
  assigned_to: string | null;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  sender_user_id: string;
  message: string;
  is_private: boolean;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// useDisputes — list, optionally scoped to one circle.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseDisputesResult {
  disputes: Dispute[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDisputes(circleId?: string): UseDisputesResult {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let q = supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (circleId) q = q.eq("circle_id", circleId);
      const { data, error: e } = await q;
      if (e) throw new Error(e.message);
      setDisputes((data ?? []) as Dispute[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load disputes");
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { disputes, isLoading, error, refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// useDispute — single dispute + its messages.
// ─────────────────────────────────────────────────────────────────────────────

export interface UseDisputeResult {
  dispute: Dispute | null;
  messages: DisputeMessage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  postMessage: (content: string, isPrivate?: boolean) => Promise<void>;
}

export function useDispute(disputeId: string | undefined): UseDisputeResult {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [messages, setMessages] = useState<DisputeMessage[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!disputeId) {
      setDispute(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [{ data: d, error: dErr }, { data: m, error: mErr }] = await Promise.all([
        supabase.from("disputes").select("*").eq("id", disputeId).maybeSingle(),
        supabase
          .from("dispute_messages")
          .select("*")
          .eq("dispute_id", disputeId)
          .order("created_at", { ascending: true }),
      ]);
      if (dErr) throw new Error(dErr.message);
      if (mErr) throw new Error(mErr.message);
      setDispute((d ?? null) as Dispute | null);
      setMessages((m ?? []) as DisputeMessage[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load dispute");
      setDispute(null);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const postMessage = useCallback(
    async (content: string, isPrivate: boolean = false) => {
      if (!disputeId) throw new Error("No dispute");
      const { error: e } = await supabase.rpc("add_dispute_message", {
        p_dispute_id: disputeId,
        p_content: content,
        p_is_private: isPrivate,
      });
      if (e) throw new Error(e.message);
      await refresh();
    },
    [disputeId, refresh],
  );

  return { dispute, messages, isLoading, error, refresh, postMessage };
}

// ─────────────────────────────────────────────────────────────────────────────
// useFileDispute — one-shot file mutation. Returns the new dispute id.
// ─────────────────────────────────────────────────────────────────────────────

export interface FileDisputeArgs {
  circleId: string | null;
  againstUserId: string;
  title: string;
  description: string;
  type?: string;
}

export interface UseFileDisputeResult {
  fileDispute: (args: FileDisputeArgs) => Promise<string>;
  isSubmitting: boolean;
  error: string | null;
}

export function useFileDispute(): UseFileDisputeResult {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileDispute = useCallback(async (args: FileDisputeArgs) => {
    try {
      setSubmitting(true);
      setError(null);
      const { data, error: e } = await supabase.rpc("file_dispute", {
        p_circle_id: args.circleId,
        p_against_user_id: args.againstUserId,
        p_title: args.title,
        p_description: args.description,
        p_type: args.type ?? "member_complaint",
      });
      if (e) throw new Error(e.message);
      return data as string;
    } catch (err: any) {
      setError(err?.message ?? "Failed to file dispute");
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { fileDispute, isSubmitting, error };
}
