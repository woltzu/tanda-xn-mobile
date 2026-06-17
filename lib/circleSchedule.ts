// ══════════════════════════════════════════════════════════════════════════════
// lib/circleSchedule.ts — pure helpers for circle cycle dates.
// ══════════════════════════════════════════════════════════════════════════════
//
// Single source of truth for "given a frequency, start date, and N members,
// when does each cycle fall?" Used by:
//   • CreateCircleExpressScreen — live preview chip strip on the form
//   • CreateCircleScheduleScreen — the wizard's contribution-deadline list
//   • Anywhere else that wants the same dates without re-implementing the
//     boundary math (especially the monthly case, which is annoyingly
//     edge-case-prone with calendar arithmetic).
//
// Pure functions, no React, no side effects — easy to test, easy to call
// from a render path that re-runs on every keystroke.
// ══════════════════════════════════════════════════════════════════════════════

export type CircleFrequency = "daily" | "weekly" | "biweekly" | "monthly";

export type ComputeCycleDatesParams = {
  startDate: Date;
  frequency: CircleFrequency;
  memberCount: number;
  // Defaults to memberCount when omitted. The wizard's goal-circle path
  // passes totalCycles explicitly because cycles ≠ member count for that
  // circle type.
  totalCycles?: number;
};

/**
 * Returns an array of cycle dates, one per cycle, starting at `startDate`
 * and incrementing per `frequency`. Length = totalCycles ?? memberCount.
 *
 * Monthly cycles use calendar-month math via `new Date(y, m+i, d)` so the
 * 31st-of-Jan + monthly → Feb 28/29 / Mar 31 etc. behaviour matches the
 * platform's normal "clamp to last day of month" semantics. Daily / weekly
 * / biweekly use additive day math.
 *
 * Empty array when memberCount/totalCycles is < 1 — render code can `.length
 * === 0` check and skip the preview.
 */
export function computeCycleDates(params: ComputeCycleDatesParams): Date[] {
  const { startDate, frequency, memberCount, totalCycles } = params;
  const count = totalCycles ?? memberCount;
  if (!Number.isFinite(count) || count < 1) return [];

  const dates: Date[] = [];
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const startDay = startDate.getDate();

  for (let i = 0; i < count; i++) {
    if (frequency === "monthly") {
      // Calendar-month increment. `new Date(year, month+i, day)` clamps
      // automatically when day overflows the target month.
      dates.push(new Date(startYear, startMonth + i, startDay));
    } else {
      const daysPerCycle =
        frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 14;
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i * daysPerCycle);
      dates.push(d);
    }
  }
  return dates;
}

/**
 * Compact "MMM D" format ("Aug 5") for inline preview chips. Respects the
 * device's locale but keeps the date short — these chips have to fit
 * three across a phone screen.
 */
export function formatDateForPreview(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
