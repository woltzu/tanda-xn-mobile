// ══════════════════════════════════════════════════════════════════════════════
// lib/tripHelpers.ts — formatters + installment status math for trip UI
// ══════════════════════════════════════════════════════════════════════════════
//
// Pure helpers shared by InstallmentScheduleView, TripPaymentScreen and the
// OrganizerTripDashboardScreen. No React, no Supabase — just shapes in / shapes
// out so they're trivially unit-testable.
//
// Currency convention note:
//   - trips.installment_schedule.installments[N].amount_cents is BIGINT cents
//     (matches the goals/wallets convention).
//   - trip_payments.amount is NUMERIC (dollars) — this is the legacy trip
//     ledger's convention. Helpers below honour both: schedule sums use cents,
//     payment sums multiply by 100 before comparing.
// ══════════════════════════════════════════════════════════════════════════════

import type {
  InstallmentSchedule,
  InstallmentScheduleItem,
} from "../services/TripOrganizerEngine";

export type InstallmentStatus = "paid" | "upcoming" | "overdue";

/**
 * Subset of a `trip_payments` row that the status math depends on. Defined
 * locally so callers don't have to import a wider row type from somewhere
 * deeper in the data layer.
 */
export interface TripPaymentRecord {
  /** 1-indexed position in trips.installment_schedule.installments. */
  installment_number?: number | null;
  /** Dollars (numeric column). */
  amount: number;
  /** ISO timestamp; null until the payment has settled. */
  paid_at?: string | null;
  /** YYYY-MM-DD. Often matches the installment's due_date. */
  due_date?: string | null;
  /** Free-form text; we look for 'succeeded' / 'completed'. */
  status?: string | null;
}

const isSuccessfulPayment = (p: TripPaymentRecord): boolean =>
  !!p.paid_at || p.status === "succeeded" || p.status === "completed";

// ─── Formatters ─────────────────────────────────────────────────────────────

/**
 * Format a "YYYY-MM-DD" (or any parseable date string) as "MMM D, YYYY".
 * Returns the input verbatim on parse failure so we never crash a render.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

/** Format a cents amount as `$X.XX`. */
export function formatMoneyCents(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Format a dollar amount (trip_payments convention) as `$X.XX`. */
export function formatMoneyDollars(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Status math ────────────────────────────────────────────────────────────

/**
 * Determine the status of a single installment given the participant's
 * payment history.
 *
 * Matching strategy:
 *   1. Match by `trip_payments.installment_number` (1-indexed). This is
 *      the most reliable join key and what create-payment-intent stamps.
 *   2. Fallback: match by `due_date` equality when installment_number is
 *      null on the payment (covers legacy / manually-recorded payments).
 *   3. No match + due_date in the past → 'overdue'.
 *   4. No match + due_date today-or-future → 'upcoming'.
 */
export function computeInstallmentStatus(
  installment: InstallmentScheduleItem,
  index: number,
  payments: TripPaymentRecord[]
): InstallmentStatus {
  const successful = payments.filter(isSuccessfulPayment);

  // (1) installment_number match.
  if (successful.some((p) => p.installment_number === index + 1)) {
    return "paid";
  }
  // (2) due_date fallback.
  if (
    successful.some(
      (p) => p.due_date && p.due_date === installment.due_date
    )
  ) {
    return "paid";
  }
  // (3) overdue check.
  try {
    const due = new Date(installment.due_date);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) return "overdue";
    }
  } catch {
    // fall through
  }
  return "upcoming";
}

// ─── Merge + totals ─────────────────────────────────────────────────────────

export interface MergedInstallment {
  /** 0-based position in the schedule's installments array. */
  index: number;
  /** Verbatim YYYY-MM-DD from the schedule. */
  dueDate: string;
  /** Cents (matches schedule convention). */
  amountCents: number;
  /** Derived. */
  status: InstallmentStatus;
}

/**
 * Walk the schedule's installments and tag each one with a status derived
 * from the supplied payments. Pass an empty payments array (or omit) for
 * the organizer view where every installment renders as 'upcoming'.
 *
 * Returns an empty array when the schedule is missing or has no
 * installments — callers can use `length === 0` to render the empty state.
 */
export function mergeInstallmentsWithPayments(
  schedule: InstallmentSchedule | null | undefined,
  payments: TripPaymentRecord[] = []
): MergedInstallment[] {
  if (!schedule || !Array.isArray(schedule.installments)) return [];
  return schedule.installments.map((it, idx) => ({
    index: idx,
    dueDate: it.due_date,
    amountCents: it.amount_cents,
    status: computeInstallmentStatus(it, idx, payments),
  }));
}

export interface InstallmentTotals {
  /** Sum of all installments in the schedule, in cents. */
  totalScheduledCents: number;
  /** Sum of successful payments, in cents (converted from dollars). */
  totalPaidCents: number;
  /** Difference, floored at zero. */
  totalRemainingCents: number;
}

/**
 * Totals headline for the participant payment screen ("$X paid of $Y").
 * Schedule amounts are in cents; payment amounts are in dollars — we
 * convert the latter before subtracting.
 */
export function computeInstallmentTotals(
  schedule: InstallmentSchedule | null | undefined,
  payments: TripPaymentRecord[] = []
): InstallmentTotals {
  const totalScheduledCents = (schedule?.installments ?? []).reduce(
    (sum, it) => sum + (it.amount_cents ?? 0),
    0
  );
  const totalPaidDollars = payments
    .filter(isSuccessfulPayment)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const totalPaidCents = Math.round(totalPaidDollars * 100);
  return {
    totalScheduledCents,
    totalPaidCents,
    totalRemainingCents: Math.max(0, totalScheduledCents - totalPaidCents),
  };
}
