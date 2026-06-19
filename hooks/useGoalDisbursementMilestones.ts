// hooks/useGoalDisbursementMilestones.ts
// ─────────────────────────────────────────────────────────────────────────────
// React hooks for the Phase 2A staged-disbursement (Dream Escrow) flow.
//
// Tables are gated by SECURITY DEFINER RPCs on the write path — the client
// never INSERTs/UPDATEs goal_disbursement_milestones directly. All
// transitions flow through one of the RPCs below.
//
// Naming note: this is the staged-payment milestone concept, NOT the
// celebration milestones in `goal_milestones` (10/25/50/75/90/100%). The two
// live in different tables to avoid mixing semantics.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type DisbursementMilestoneStatus =
  | "pending"
  | "in_progress"
  | "verification_requested"
  | "verified"
  | "released"
  | "failed";

export type DisbursementEscrowStatus =
  | "not_started"
  | "funds_reserved"
  | "funds_locked"
  | "released"
  | "refunded";

export type DisbursementVerificationMethod =
  | "elder"
  | "document"
  | "admin"
  | "owner";

export type DisbursementMilestone = {
  id: string;
  goal_id: string;
  provider_id: string;
  name: string;
  description: string | null;
  order_index: number;
  amount_cents: number;
  status: DisbursementMilestoneStatus;
  verification_method: DisbursementVerificationMethod;
  escrow_status: DisbursementEscrowStatus;
  funds_reserved_at: string | null;
  funds_locked_at: string | null;
  provider_accepted_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  released_at: string | null;
  released_amount_cents: number | null;
  retention_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type DisbursementVerificationRequest = {
  id: string;
  milestone_id: string;
  requester_user_id: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  responder_user_id: string | null;
  responded_at: string | null;
  created_at: string;
};

export type CreateMilestoneInput = {
  name: string;
  description?: string;
  order_index: number;
  amount_cents: number;
  verification_method?: DisbursementVerificationMethod;
  retention_percent?: number;
};

// ─── useGoalDisbursementMilestones ──────────────────────────────────────────
export function useGoalDisbursementMilestones(goalId: string | undefined) {
  const [milestones, setMilestones] = useState<DisbursementMilestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = useCallback(async () => {
    if (!goalId) {
      setMilestones([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("goal_disbursement_milestones")
        .select("*")
        .eq("goal_id", goalId)
        .order("order_index", { ascending: true });
      if (err) throw err;
      setMilestones((data ?? []) as DisbursementMilestone[]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    void fetchMilestones();
  }, [fetchMilestones]);

  return { milestones, loading, error, refetch: fetchMilestones };
}

// ─── useDisbursementMilestone ───────────────────────────────────────────────
export function useDisbursementMilestone(milestoneId: string | undefined) {
  const [milestone, setMilestone] = useState<DisbursementMilestone | null>(null);
  const [verification, setVerification] = useState<DisbursementVerificationRequest | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOne = useCallback(async () => {
    if (!milestoneId) return;
    setLoading(true);
    setError(null);
    try {
      const [msRes, verRes] = await Promise.all([
        supabase
          .from("goal_disbursement_milestones")
          .select("*")
          .eq("id", milestoneId)
          .maybeSingle(),
        supabase
          .from("goal_disbursement_milestone_verifications")
          .select("*")
          .eq("milestone_id", milestoneId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (msRes.error) throw msRes.error;
      setMilestone((msRes.data as DisbursementMilestone) ?? null);
      setVerification((verRes.data as DisbursementVerificationRequest) ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load milestone");
    } finally {
      setLoading(false);
    }
  }, [milestoneId]);

  useEffect(() => {
    void fetchOne();
  }, [fetchOne]);

  return { milestone, verification, loading, error, refetch: fetchOne };
}

// ─── useDisbursementActions ─────────────────────────────────────────────────
// RPC wrappers. Each returns { ok, message } so callers can keep their
// UI surface consistent regardless of which action fired.
export function useDisbursementActions() {
  const [submitting, setSubmitting] = useState(false);

  const run = useCallback(
    async (rpc: string, params: Record<string, unknown>) => {
      setSubmitting(true);
      try {
        const { data, error } = await supabase.rpc(rpc, params);
        if (error) return { ok: false, message: error.message };
        return { ok: true, data };
      } catch (e: any) {
        return { ok: false, message: e?.message ?? "Unknown error" };
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const createMilestones = useCallback(
    (goalId: string, providerId: string, milestones: CreateMilestoneInput[]) =>
      run("create_goal_disbursement_milestones", {
        p_goal_id: goalId,
        p_provider_id: providerId,
        p_milestones: milestones,
      }),
    [run],
  );

  const acceptMilestone = useCallback(
    (milestoneId: string) =>
      run("accept_disbursement_milestone", { p_milestone_id: milestoneId }),
    [run],
  );

  const requestVerification = useCallback(
    (milestoneId: string, notes?: string) =>
      run("request_disbursement_verification", {
        p_milestone_id: milestoneId,
        p_notes: notes ?? null,
      }),
    [run],
  );

  const respondVerification = useCallback(
    (requestId: string, approved: boolean, notes?: string) =>
      run("respond_disbursement_verification", {
        p_request_id: requestId,
        p_approved: approved,
        p_notes: notes ?? null,
      }),
    [run],
  );

  const cancelMilestone = useCallback(
    (milestoneId: string, reason?: string) =>
      run("refund_disbursement_milestone", {
        p_milestone_id: milestoneId,
        p_reason: reason ?? null,
      }),
    [run],
  );

  return {
    submitting,
    createMilestones,
    acceptMilestone,
    requestVerification,
    respondVerification,
    cancelMilestone,
  };
}
