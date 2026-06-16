// ══════════════════════════════════════════════════════════════════════════════
// hooks/useAdvanceDashboard.ts — batched Advance Hub fetcher
// ══════════════════════════════════════════════════════════════════════════════
//
// Single-call replacement for the four data sources the Advance V2 screens
// used to mock (DEFAULT_USER, DEFAULT_PAYOUT, AdvanceContext loans / future
// payouts). Calls the `get_advance_dashboard` RPC from migration 145 and
// hands back:
//
//   - products: per-product card payload (4 entries, UI order) with
//     eligibility, APR, min/max amount + term, disqualification reason
//   - activeAdvances: rows from `loans` with outstanding + next-payment
//   - outstandingBalanceCents, nextPaymentDue
//   - xnscore, completedCircles (for header chrome)
//
// Caching: module-level, keyed by userId, 5-minute TTL — mirrors the
// useScoreHub pattern shipped with migration 144.
//
// Two helpers exported alongside the hook:
//   - requestAdvance(): client wrapper for migration 146's RPC
//   - processAdvanceRepayment(): client wrapper for migration 147's RPC
// Both bust the cache on success so the next focus refetch sees fresh data.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// ── Shapes (match migration 145 jsonb_build_object keys) ─────────────────

export type AdvanceUiCode = "contribution" | "quick" | "flex" | "premium";

export type AdvanceProductCard = {
  ui_code: AdvanceUiCode;
  db_code: string;
  product_id: string | null;
  name: string | null;
  description: string | null;
  min_xnscore: number | null;
  min_completed_circles: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  recommended_amount_cents: number | null;
  min_term_months: number | null;
  max_term_months: number | null;
  base_apr_min: number | null;
  base_apr_max: number | null;
  estimated_apr: number | null;
  origination_fee_percent: number | null;
  eligible: boolean;
  disqualification_reason:
    | "product_not_configured"
    | "product_inactive"
    | "xnscore_too_low"
    | "not_enough_completed_circles"
    | "kyc_required"
    | "account_age_too_low"
    | "too_many_active_advances"
    | null;
  points_to_unlock: number | null;
};

export type PastAdvance = {
  entry_id: string;
  source: "loan" | "application";
  db_code: string | null;
  product_name: string | null;
  principal_cents: number;
  closed_at: string | null;
  status: string;
  reason: string | null;
};

export type ActiveAdvance = {
  loan_id: string;
  db_code: string | null;
  product_name: string | null;
  principal_cents: number;
  outstanding_cents: number;
  next_payment_date: string | null;
  next_payment_cents: number | null;
  status: string;
  days_past_due: number;
  is_delinquent: boolean;
  payments_made: number;
  payments_total: number;
};

export type AdvanceDashboard = {
  user_id: string;
  xnscore: number;
  completed_circles: number;
  products: AdvanceProductCard[];
  active_advances: ActiveAdvance[];
  past_advances: PastAdvance[];
  outstanding_balance_cents: number;
  next_payment_due: {
    loan_id: string;
    date: string | null;
    amount_cents: number | null;
  } | null;
  computed_at: string;
};

// ── 5-minute in-memory cache (process-wide, keyed by userId) ─────────────

const CACHE_TTL_MS = 5 * 60 * 1000;
let dashboardCache: {
  userId: string;
  data: AdvanceDashboard;
  fetchedAt: number;
} | null = null;

// Bucket C P1.3 — preflight cache. Keyed by `${userId}:${uiCode}:${amount}`.
// Cleared whenever requestAdvance or processAdvanceRepayment lands, since
// those change the eligibility surface (active-advance count, etc.).
type PreflightCacheEntry = {
  result: EligibilityCheckResult;
  fetchedAt: number;
};
const preflightCache = new Map<string, PreflightCacheEntry>();

function bustCache() {
  dashboardCache = null;
  preflightCache.clear();
}

async function fetchDashboard(userId: string): Promise<AdvanceDashboard> {
  if (
    dashboardCache &&
    dashboardCache.userId === userId &&
    Date.now() - dashboardCache.fetchedAt < CACHE_TTL_MS
  ) {
    return dashboardCache.data;
  }
  const { data, error } = await supabase.rpc("get_advance_dashboard", {
    p_user_id: userId,
  });
  if (error) throw error;
  // RPC returns a single jsonb; the supabase-js client surfaces it as the
  // value directly. Defensive normalization for an empty/null response.
  const payload = (data ?? {
    user_id: userId,
    xnscore: 0,
    completed_circles: 0,
    products: [],
    active_advances: [],
    past_advances: [],
    outstanding_balance_cents: 0,
    next_payment_due: null,
    computed_at: new Date().toISOString(),
  }) as AdvanceDashboard;
  dashboardCache = { userId, data: payload, fetchedAt: Date.now() };
  return payload;
}

// ── The hook ─────────────────────────────────────────────────────────────

export function useAdvanceDashboard() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState<AdvanceDashboard | null>(
    dashboardCache && dashboardCache.userId === userId
      ? dashboardCache.data
      : null,
  );
  const [loading, setLoading] = useState<boolean>(data == null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const cached =
        dashboardCache && dashboardCache.userId === userId
          ? dashboardCache.data
          : null;
      if (!cached) setLoading(true);
      const fresh = await fetchDashboard(userId);
      setData(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Initial load — useFocusEffect only fires on focus transitions, so
  // mount-time first paint needs its own kick.
  useEffect(() => {
    if (userId && data == null && !loading) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refresh = useCallback(async () => {
    bustCache();
    await load();
  }, [load]);

  return { data, loading, error, refresh };
}

// ── Preflight eligibility check (Bucket C P1.3) ──────────────────────────
//
// Client wrapper for migration 184's `check_advance_eligibility` RPC.
// Same gates as request_advance, no side effects. The dashboard's
// `eligible` flag covers xnscore + circle activity but NOT KYC or
// account-age, so the client today only catches those by submitting.
// AdvanceHubV2 calls this on product-card tap to surface the right
// reason in the bottom sheet before opening SmartCalculator.

export type EligibilityCheckResult = {
  eligible: boolean;
  reason:
    | "kyc_required"
    | "account_age_too_low"
    | "xnscore_too_low"
    | "not_enough_completed_circles"
    | "too_many_active_advances"
    | "product_not_configured"
    | "product_inactive"
    | "amount_below_min"
    | "amount_above_max"
    | "unknown_product"
    | "auth_required"
    | null;
  product_ui_code?: AdvanceUiCode;
  product_db_code?: string;
  min_amount_cents?: number;
  max_amount_cents?: number;
  recommended_amount_cents?: number;
};

export async function checkAdvanceEligibility(
  uiCode: AdvanceUiCode,
  amountCents: number | null = null,
  userId: string | null = null,
): Promise<EligibilityCheckResult> {
  const cacheKey = `${userId ?? "self"}:${uiCode}:${amountCents ?? "na"}`;
  const cached = preflightCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.result;
  }
  const { data, error } = await supabase.rpc("check_advance_eligibility", {
    p_ui_code: uiCode,
    p_amount_cents: amountCents,
    p_user_id: userId,
  });
  if (error) throw error;
  const result = (data ?? { eligible: false, reason: null }) as EligibilityCheckResult;
  preflightCache.set(cacheKey, { result, fetchedAt: Date.now() });
  return result;
}

// ── RPC client wrappers (cache-busting) ──────────────────────────────────

export type RequestAdvanceArgs = {
  ui_code: AdvanceUiCode;
  requested_amount_cents: number;
  term_months?: number | null;
  repayment_preference?: "payout_withholding" | "manual";
};

export type RequestAdvanceResult = {
  loan_id: string;
  application_id: string;
  status: "approved";
  auto_approved: boolean;
  product_ui_code: AdvanceUiCode;
  product_db_code: string;
  approved_amount_cents: number;
  apr: number;
  term_months: number;
  origination_fee_cents: number;
  monthly_payment_cents: number;
  total_interest_cents: number;
  total_repayment_cents: number;
  first_payment_date: string;
  repayment_preference: "payout_withholding" | "manual";
  repayment_schedule: Array<{
    payment_number: number;
    due_date: string;
    total_due_cents: number;
  }>;
};

export async function requestAdvance(
  args: RequestAdvanceArgs,
): Promise<RequestAdvanceResult> {
  const { data, error } = await supabase.rpc("request_advance", {
    p_ui_code: args.ui_code,
    p_requested_amount_cents: args.requested_amount_cents,
    p_term_months: args.term_months ?? null,
    p_repayment_preference: args.repayment_preference ?? "payout_withholding",
  });
  if (error) throw error;
  bustCache();
  return data as RequestAdvanceResult;
}

export type ProcessRepaymentArgs = {
  loan_id: string;
  amount_cents: number;
  source?: "wallet" | "payout" | "manual";
  wallet_transaction_id?: string;
  external_transfer_id?: string;
};

export type ProcessRepaymentResult = {
  loan_id: string;
  payment_id: string;
  amount_requested_cents: number;
  amount_applied_cents: number;
  amount_unapplied_cents: number;
  principal_applied_cents: number;
  interest_applied_cents: number;
  fees_applied_cents: number;
  payments_made: number;
  status: string;
  next_payment_date: string | null;
  next_payment_amount_cents: number | null;
  fully_repaid: boolean;
  applied_to_schedule: Array<{
    schedule_id: string;
    payment_number: number;
    applied_cents: number;
    fully_paid: boolean;
  }>;
};

export async function processAdvanceRepayment(
  args: ProcessRepaymentArgs,
): Promise<ProcessRepaymentResult> {
  const { data, error } = await supabase.rpc("process_advance_repayment", {
    p_loan_id: args.loan_id,
    p_amount_cents: args.amount_cents,
    p_source: args.source ?? "wallet",
    p_wallet_transaction_id: args.wallet_transaction_id ?? null,
    p_external_transfer_id: args.external_transfer_id ?? null,
  });
  if (error) throw error;
  bustCache();
  return data as ProcessRepaymentResult;
}
