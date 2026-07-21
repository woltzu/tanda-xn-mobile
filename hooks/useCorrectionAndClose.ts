// ═══════════════════════════════════════════════════════════════════════════
// hooks/useCorrectionAndClose.ts — Doc 38 admin UI action wrappers
// ═══════════════════════════════════════════════════════════════════════════
//
// Two small imperative wrappers around the mig 371 RPCs:
//   * applyCorrection — one-shot correction call. Handles the RPC + typed
//     error mapping. Returns the correction event id on success.
//   * closeCircle — one-shot close call. Returns success/diff either way.
//
// list_circle_ledger_events read wrapper also lives here so the two
// admin modals can share the ledger-events fetch without redundant
// state duplication.
//
// These are stateless (no hooks) — call them directly from a modal's
// submit handler, catch errors inline.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

export type CorrectionReasonCode =
  | "webhook_duplicate"
  | "stripe_refund"
  | "bug_reconciliation"
  | "member_dispute_resolved"
  | "other_documented";

export interface CorrectionArgs {
  originalEventId: string;
  reasonCode: CorrectionReasonCode;
  justification: string;
  amountCentsDelta: number;
}

export interface CorrectionResult {
  success: boolean;
  original_event_id: string;
  correction_event_id: string;
  amount_cents_delta: number;
  reason_code: string;
  admin_user_id: string;
}

export async function applyCorrection(args: CorrectionArgs): Promise<CorrectionResult> {
  const { data, error } = await supabase.rpc("apply_correction", {
    p_original_event_id: args.originalEventId,
    p_reason_code: args.reasonCode,
    p_justification: args.justification,
    p_amount_cents_delta: args.amountCentsDelta,
  });
  if (error) throw new Error(error.message);
  return data as CorrectionResult;
}

export interface CloseCircleArgs {
  circleId: string;
  reviewerNote?: string;
}

export type CloseCircleResult =
  | {
      success: true;
      circle_id: string;
      close_event_id: string;
      net_cents: number;
      closed_at: string;
    }
  | {
      success: false;
      reason: "invariant_not_zero";
      circle_id: string;
      contributions_total: number;
      payouts_total: number;
      corrections_total: number;
      net_cents: number;
      tolerance_cents: number;
    };

export async function closeCircle(args: CloseCircleArgs): Promise<CloseCircleResult> {
  const { data, error } = await supabase.rpc("close_circle", {
    p_circle_id: args.circleId,
    p_reviewer_note: args.reviewerNote ?? null,
  });
  if (error) throw new Error(error.message);
  return data as CloseCircleResult;
}

export interface LedgerEvent {
  id: string;
  event_type: string;
  amount_cents: number;
  currency: string;
  external_reference_id: string | null;
  external_reference_type: string | null;
  stripe_event_id: string;
  created_at: string;
  is_correction: boolean;
  metadata: Record<string, unknown> | null;
}

export async function listCircleLedgerEvents(circleId: string): Promise<LedgerEvent[]> {
  const { data, error } = await supabase.rpc("list_circle_ledger_events", {
    p_circle_id: circleId,
  });
  if (error) throw new Error(error.message);
  return (data as LedgerEvent[]) ?? [];
}
