// ══════════════════════════════════════════════════════════════════════════════
// hooks/useLoanProfile.ts
// ══════════════════════════════════════════════════════════════════════════════
//
// Single hook backing the Credit Profile screen's loan-history sections:
//   - summary card     (totalBorrowed / totalRepaid / totalOutstanding / counts)
//   - "My loans" list  (from public.loans)
//   - recent applications (from public.loan_applications, last 10)
//   - upcoming payments (next 3 unpaid from public.loan_payment_schedule,
//                        falls back to loans.next_payment_date)
//
// Architectural choice (Bucket A of Credit Profile review):
//   - Direct supabase-js reads (not RPCs) — these tables have RLS scoped on
//     user_id, so the anon-key client can SELECT only the caller's own rows.
//   - Module-level Map cache, 5-min TTL, busted by `bustLoanProfileCache(userId)`
//     so a future loan-state change trigger can prompt an immediate refetch
//     (same pattern as useExplainableAI / useDecisionHistory).
//   - One round-trip per consumer mount (within the TTL), three queries in
//     parallel. The summary is derived client-side from the loans payload —
//     no separate aggregate query — because the loans table tops out at
//     a few hundred rows per user in worst case.
//
// Status enum mapping (canonical):
//     active | defaulted | in_collections | paid_off | written_off
// These are surfaced verbatim through `LoanProfileLoan.status`; the screen
// normalises to friendlier pill labels via the loan_status_<status> i18n key.
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type LoanStatus =
  | "active"
  | "defaulted"
  | "in_collections"
  | "paid_off"
  | "written_off";

export type LoanApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "disbursed"
  | "expired"
  | "cancelled";

export type LoanProfileLoan = {
  id: string;
  status: LoanStatus;
  principalCents: number;
  outstandingCents: number;
  paymentsMade: number;
  paymentsTotal: number;
  nextPaymentDate: string | null;
  nextPaymentAmountCents: number;
  daysPastDue: number;
  isDelinquent: boolean;
  createdAt: string;
  closedAt: string | null;
  closedReason: string | null;
};

export type LoanProfileApplication = {
  id: string;
  status: LoanApplicationStatus;
  requestedAmountCents: number;
  approvedAmountCents: number;
  termMonths: number;
  apr: number | null;
  createdAt: string;
};

export type UpcomingPayment = {
  scheduleId: string | null; // null when synthesized from loans.next_payment_date
  loanId: string;
  dueDate: string;
  amountCents: number;
  paymentNumber: number | null;
};

export type LoanProfileSummary = {
  totalBorrowedCents: number;
  totalRepaidCents: number;
  totalOutstandingCents: number;
  activeCount: number;
  defaultCount: number;
  onTimeRate: number | null; // null when no completed payments yet
};

export type LoanProfile = {
  summary: LoanProfileSummary;
  loans: LoanProfileLoan[];
  applications: LoanProfileApplication[];
  upcomingPayments: UpcomingPayment[];
};

// ─── Cache ────────────────────────────────────────────────────────────────────

const LOAN_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const loanProfileCache = new Map<
  string,
  { data: LoanProfile; fetchedAt: number }
>();

export function bustLoanProfileCache(userId?: string) {
  if (!userId) {
    loanProfileCache.clear();
    return;
  }
  loanProfileCache.delete(userId);
}

function readCache(userId: string): LoanProfile | null {
  const entry = loanProfileCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt >= LOAN_PROFILE_CACHE_TTL_MS) {
    loanProfileCache.delete(userId);
    return null;
  }
  return entry.data;
}

function writeCache(userId: string, data: LoanProfile) {
  loanProfileCache.set(userId, { data, fetchedAt: Date.now() });
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function mapLoan(row: any): LoanProfileLoan {
  return {
    id: row.id,
    status: row.status as LoanStatus,
    principalCents: row.principal_cents ?? 0,
    outstandingCents: row.total_outstanding_cents ?? 0,
    paymentsMade: row.payments_made ?? 0,
    paymentsTotal: row.payments_total ?? 0,
    nextPaymentDate: row.next_payment_date ?? null,
    nextPaymentAmountCents: row.next_payment_amount_cents ?? 0,
    daysPastDue: row.days_past_due ?? 0,
    isDelinquent: !!row.is_delinquent,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? null,
    closedReason: row.closed_reason ?? null,
  };
}

function mapApplication(row: any): LoanProfileApplication {
  return {
    id: row.id,
    status: row.status as LoanApplicationStatus,
    requestedAmountCents: row.requested_amount_cents ?? 0,
    approvedAmountCents: row.approved_amount_cents ?? 0,
    termMonths: row.term_months ?? 0,
    apr: row.apr ?? null,
    createdAt: row.created_at,
  };
}

// ─── Summary derivation ───────────────────────────────────────────────────────

function deriveSummary(
  loans: LoanProfileLoan[],
  totalRepaidCents: number,
  paymentsTotal: number,
  paymentsOnTime: number,
): LoanProfileSummary {
  let totalBorrowedCents = 0;
  let totalOutstandingCents = 0;
  let activeCount = 0;
  let defaultCount = 0;
  for (const l of loans) {
    totalBorrowedCents += l.principalCents;
    totalOutstandingCents += l.outstandingCents;
    if (l.status === "active") activeCount += 1;
    if (l.status === "defaulted" || l.status === "in_collections") {
      defaultCount += 1;
    }
  }
  const onTimeRate =
    paymentsTotal > 0 ? Math.round((paymentsOnTime / paymentsTotal) * 100) : null;
  return {
    totalBorrowedCents,
    totalRepaidCents,
    totalOutstandingCents,
    activeCount,
    defaultCount,
    onTimeRate,
  };
}

// ─── Upcoming-payment fallback synthesis ──────────────────────────────────────
// When loan_payment_schedule has no future rows for a loan (small loan, no
// schedule yet, or schema not yet populated), synthesise an entry from the
// loan's next_payment_date / next_payment_amount_cents. Keeps the section
// useful for early-stage loans without forcing schedule backfill.

function synthesizeUpcomingFromLoans(loans: LoanProfileLoan[]): UpcomingPayment[] {
  const out: UpcomingPayment[] = [];
  for (const l of loans) {
    if (l.status !== "active") continue;
    if (!l.nextPaymentDate) continue;
    out.push({
      scheduleId: null,
      loanId: l.id,
      dueDate: l.nextPaymentDate,
      amountCents: l.nextPaymentAmountCents,
      paymentNumber: l.paymentsMade + 1,
    });
  }
  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const EMPTY_PROFILE: LoanProfile = {
  summary: {
    totalBorrowedCents: 0,
    totalRepaidCents: 0,
    totalOutstandingCents: 0,
    activeCount: 0,
    defaultCount: 0,
    onTimeRate: null,
  },
  loans: [],
  applications: [],
  upcomingPayments: [],
};

export function useLoanProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<LoanProfile>(() => {
    if (!userId) return EMPTY_PROFILE;
    return readCache(userId) ?? EMPTY_PROFILE;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!userId) {
        setProfile(EMPTY_PROFILE);
        setLoading(false);
        return;
      }
      if (!opts?.force) {
        const cached = readCache(userId);
        if (cached) {
          setProfile(cached);
          setLoading(false);
          return;
        }
      }
      try {
        setLoading(true);
        setError(null);

        // Three reads in parallel — RLS scopes each to the calling user.
        const [loansRes, applicationsRes, paymentsRes] = await Promise.all([
          supabase
            .from("loans")
            .select(
              "id, status, principal_cents, total_outstanding_cents, payments_made, payments_total, next_payment_date, next_payment_amount_cents, days_past_due, is_delinquent, created_at, closed_at, closed_reason",
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          supabase
            .from("loan_applications")
            .select(
              "id, status, requested_amount_cents, approved_amount_cents, term_months, apr, created_at",
            )
            .eq("user_id", userId)
            .in("status", ["pending", "approved", "rejected", "disbursed"])
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("loan_payments")
            .select("amount_cents, was_on_time, status")
            .eq("user_id", userId)
            .eq("status", "completed"),
        ]);

        if (loansRes.error) throw loansRes.error;
        if (applicationsRes.error) throw applicationsRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const loans = (loansRes.data ?? []).map(mapLoan);
        const applications = (applicationsRes.data ?? []).map(mapApplication);
        const paymentRows = paymentsRes.data ?? [];
        const totalRepaidCents = paymentRows.reduce(
          (acc: number, p: any) => acc + (p.amount_cents ?? 0),
          0,
        );
        const paymentsOnTime = paymentRows.filter(
          (p: any) => p.was_on_time === true,
        ).length;

        // Upcoming: prefer schedule rows if any, else synthesize from loans.
        let upcomingPayments: UpcomingPayment[] = [];
        const loanIds = loans.map((l) => l.id);
        if (loanIds.length > 0) {
          const scheduleRes = await supabase
            .from("loan_payment_schedule")
            .select("id, loan_id, payment_number, due_date, total_due_cents, total_paid_cents, status")
            .in("loan_id", loanIds)
            .neq("status", "paid")
            .order("due_date", { ascending: true })
            .limit(3);
          if (scheduleRes.error) {
            // Defensive fallback — schedule read failure should not blank
            // the whole profile; synthesise from loans instead.
            console.warn(
              "[useLoanProfile] schedule read failed, falling back to next_payment_date:",
              scheduleRes.error.message,
            );
            upcomingPayments = synthesizeUpcomingFromLoans(loans).slice(0, 3);
          } else if ((scheduleRes.data ?? []).length > 0) {
            upcomingPayments = (scheduleRes.data ?? []).map((r: any) => ({
              scheduleId: r.id,
              loanId: r.loan_id,
              dueDate: r.due_date,
              amountCents:
                (r.total_due_cents ?? 0) - (r.total_paid_cents ?? 0),
              paymentNumber: r.payment_number ?? null,
            }));
          } else {
            upcomingPayments = synthesizeUpcomingFromLoans(loans).slice(0, 3);
          }
        }

        const summary = deriveSummary(
          loans,
          totalRepaidCents,
          paymentRows.length,
          paymentsOnTime,
        );

        const next: LoanProfile = {
          summary,
          loans,
          applications,
          upcomingPayments,
        };
        writeCache(userId, next);
        setProfile(next);
      } catch (err: any) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    if (userId) bustLoanProfileCache(userId);
    await fetchProfile({ force: true });
  }, [userId, fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const hasLoans = useMemo(() => profile.loans.length > 0, [profile.loans]);
  const hasUpcoming = useMemo(
    () => profile.upcomingPayments.length > 0,
    [profile.upcomingPayments],
  );

  return {
    loading,
    error,
    profile,
    summary: profile.summary,
    loans: profile.loans,
    applications: profile.applications,
    upcomingPayments: profile.upcomingPayments,
    hasLoans,
    hasUpcoming,
    refetch: fetchProfile,
    refresh,
  };
}
