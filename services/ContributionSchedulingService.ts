/**
 * ContributionSchedulingService.ts
 *
 * TandaXn Contribution Scheduling Algorithm (Reconciled)
 *
 * DECISIONS BAKED IN:
 *   1. Frequencies: daily, weekly, biweekly, monthly, quarterly
 *   2. Late fee: 5% of contribution amount (consistent everywhere)
 *   3. Monthly/quarterly use calendar increments (not flat 30/90 days)
 *   4. No insurance deduction — trust handled by Community Feature Algorithm
 *   5. Payout = contributionAmount × memberCount (full amount)
 *
 * GRACE PERIOD: 2 days after due date — no penalty
 * ESCALATION:
 *   Day 3+  → 5% late fee
 *   Day 8+  → Security deposit applied, default recorded, XnScore hit
 *   3+ late → Tier downgrade even without formal default
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type ContributionFrequency =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly";

export type ContributionStatus =
  | "pending"
  | "completed"
  | "late"
  | "defaulted"
  | "waived"
  | "covered";

export type ScheduleStatus =
  | "upcoming"
  | "active"
  | "completed"
  | "partial"
  | "failed";

export interface Contribution {
  id: string;
  circleId: string;
  userId: string;
  memberId?: string;
  scheduleId?: string;
  roundNumber: number;
  amount: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  status: ContributionStatus;
  isLate: boolean;
  daysLate: number;
  gracePeriodUsed: boolean;
  lateFee: number;
  totalCharged: number;
  defaultRecorded: boolean;
  securityDepositApplied: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionSchedule {
  id: string;
  circleId: string;
  roundNumber: number;
  dueDate: string;
  payoutRecipientId?: string;
  payoutAmount: number;
  status: ScheduleStatus;
  expectedContributions: number;
  receivedContributions: number;
  totalCollected: number;
  totalLateFees: number;
  payoutStatus: string;
  payoutDisbursedAt?: string;
  createdAt: string;
}

export interface RoundScheduleResult {
  roundNumber: number;
  dueDate: Date;
  paymentsCreated: number;
  payoutRecipientId: string | null;
  payoutAmount: number;
}

export interface PaymentProcessingResult {
  paymentId: string;
  status: "completed" | "late_completed" | "defaulted";
  isLate: boolean;
  daysLate: number;
  lateFee: number;
  totalCharged: number;
  graceApplied: boolean;
}

export interface LateFeeConfig {
  gracePeriodDays: number;
  lateFeeType: "percentage" | "flat";
  lateFeePercentage: number;
  lateFeeFlat: number;
  lateFeeMin: number;
  lateFeeMax?: number;
  defaultThresholdDays: number;
  tierDowngradeThreshold: number;
}

// Default configuration (reconciled decisions)
const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  gracePeriodDays: 2,
  lateFeeType: "percentage",
  lateFeePercentage: 0.05,  // 5%
  lateFeeFlat: 0,
  lateFeeMin: 0,
  defaultThresholdDays: 8,
  tierDowngradeThreshold: 3,
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class ContributionSchedulingService {
  private config: LateFeeConfig;

  constructor(config?: Partial<LateFeeConfig>) {
    this.config = { ...DEFAULT_LATE_FEE_CONFIG, ...config };
  }

  // ============================================================================
  // DUE DATE CALCULATION
  // ============================================================================

  /**
   * Calculate the due date for a specific round.
   *
   * Daily/weekly/biweekly: simple day arithmetic
   * Monthly/quarterly: calendar-based (same day-of-month preserved)
   *
   * Examples (start = Jan 15):
   *   Round 1 daily      → Jan 16
   *   Round 3 weekly     → Feb 5
   *   Round 2 monthly    → Mar 15
   *   Round 1 quarterly  → Apr 15
   *   Round 1 monthly (start Jan 31, target Feb) → Feb 28 (clamped)
   */
  calculateRoundDueDate(
    startDate: Date,
    frequency: ContributionFrequency,
    round: number
  ): Date {
    const due = new Date(startDate);
    const originalDay = startDate.getDate();

    switch (frequency) {
      case "daily":
        due.setDate(due.getDate() + round);
        break;
      case "weekly":
        due.setDate(due.getDate() + round * 7);
        break;
      case "biweekly":
        due.setDate(due.getDate() + round * 14);
        break;
      case "monthly":
        due.setMonth(due.getMonth() + round);
        this.clampToValidDay(due, originalDay);
        break;
      case "quarterly":
        due.setMonth(due.getMonth() + round * 3);
        this.clampToValidDay(due, originalDay);
        break;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    return due;
  }

  /**
   * If the original day-of-month doesn't exist in the target month
   * (e.g. Jan 31 → Feb), clamp to the last valid day.
   */
  private clampToValidDay(date: Date, originalDay: number): void {
    const lastDayOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate();

    if (originalDay > lastDayOfMonth) {
      date.setDate(lastDayOfMonth);
    } else {
      date.setDate(originalDay);
    }
  }

  /**
   * Calculate the circle end date.
   */
  calculateEndDate(
    startDate: Date,
    frequency: ContributionFrequency,
    totalRounds: number
  ): Date {
    return this.calculateRoundDueDate(startDate, frequency, totalRounds);
  }

  // ============================================================================
  // ROUND SCHEDULING
  // ============================================================================

  /**
   * Generate full contribution schedule for a circle
   * Called when circle becomes active
   */
  async generateFullSchedule(circleId: string): Promise<ContributionSchedule[]> {
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select(`
        *,
        members:circle_members(*, profile:profiles(full_name))
      `)
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      throw new Error("Circle not found");
    }

    const activeMembers = circle.members.filter((m: any) => m.status === "active");
    if (activeMembers.length < 2) {
      throw new Error("Not enough active members");
    }

    const totalRounds = activeMembers.length;
    const startDate = new Date(circle.start_date || new Date());
    const frequency = (circle.contribution_frequency || "monthly") as ContributionFrequency;
    const contributionAmount = parseFloat(circle.amount);

    // Update circle with total cycles
    await supabase
      .from("circles")
      .update({
        total_cycles: totalRounds,
        contribution_frequency: frequency,
        updated_at: new Date().toISOString(),
      })
      .eq("id", circleId);

    const schedules: ContributionSchedule[] = [];

    for (let round = 1; round <= totalRounds; round++) {
      const dueDate = this.calculateRoundDueDate(startDate, frequency, round);

      // Find recipient for this round (by payout_position)
      const recipient = activeMembers.find((m: any) => m.payout_position === round);
      const payoutAmount = contributionAmount * activeMembers.length;

      // Create schedule record
      const { data: schedule, error } = await supabase
        .from("contribution_schedules")
        .insert({
          circle_id: circleId,
          round_number: round,
          due_date: dueDate.toISOString().split("T")[0],
          payout_recipient_id: recipient?.user_id,
          payout_amount: payoutAmount,
          status: round === 1 ? "active" : "upcoming",
          expected_contributions: activeMembers.length,
          received_contributions: 0,
          total_collected: 0,
          total_late_fees: 0,
          payout_status: "pending",
        })
        .select()
        .single();

      if (error) {
        console.error(`Error creating schedule for round ${round}:`, error);
        continue;
      }

      schedules.push(this.transformSchedule(schedule));

      // Create contribution records for all members
      const contributions = activeMembers.map((member: any) => ({
        circle_id: circleId,
        user_id: member.user_id,
        member_id: member.id,
        schedule_id: schedule.id,
        round_number: round,
        amount: contributionAmount,
        currency: circle.currency || "XAF",
        due_date: dueDate.toISOString().split("T")[0],
        status: "pending",
        is_late: false,
        days_late: 0,
        grace_period_used: false,
        late_fee: 0,
      }));

      await supabase.from("contributions").insert(contributions);
    }

    return schedules;
  }

  /**
   * Schedule payments for a specific round
   * (Alternative to generateFullSchedule - creates one round at a time)
   */
  async scheduleRoundPayments(
    circleId: string,
    roundNumber: number
  ): Promise<RoundScheduleResult> {
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select(`
        *,
        members:circle_members(*)
      `)
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      throw new Error("Circle not found");
    }

    if (circle.status !== "active") {
      throw new Error("Circle is not active");
    }

    const activeMembers = circle.members.filter((m: any) => m.status === "active");
    if (activeMembers.length < 2) {
      throw new Error("Not enough active members");
    }

    const startDate = new Date(circle.start_date);
    const frequency = (circle.contribution_frequency || "monthly") as ContributionFrequency;
    const contributionAmount = parseFloat(circle.amount);
    const dueDate = this.calculateRoundDueDate(startDate, frequency, roundNumber);

    // Check if schedule already exists
    const { data: existingSchedule } = await supabase
      .from("contribution_schedules")
      .select("id")
      .eq("circle_id", circleId)
      .eq("round_number", roundNumber)
      .single();

    if (existingSchedule) {
      throw new Error(`Schedule for round ${roundNumber} already exists`);
    }

    // Find recipient
    const recipient = activeMembers.find((m: any) => m.payout_position === roundNumber);
    const payoutAmount = contributionAmount * activeMembers.length;

    // Create schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("contribution_schedules")
      .insert({
        circle_id: circleId,
        round_number: roundNumber,
        due_date: dueDate.toISOString().split("T")[0],
        payout_recipient_id: recipient?.user_id,
        payout_amount: payoutAmount,
        status: "active",
        expected_contributions: activeMembers.length,
        payout_status: "scheduled",
      })
      .select()
      .single();

    if (scheduleError) throw scheduleError;

    // Create contribution records
    const contributions = activeMembers.map((member: any) => ({
      circle_id: circleId,
      user_id: member.user_id,
      member_id: member.id,
      schedule_id: schedule.id,
      round_number: roundNumber,
      amount: contributionAmount,
      currency: circle.currency || "XAF",
      due_date: dueDate.toISOString().split("T")[0],
      status: "pending",
    }));

    await supabase.from("contributions").insert(contributions);

    // Update circle's current cycle
    await supabase
      .from("circles")
      .update({ current_cycle: roundNumber })
      .eq("id", circleId);

    return {
      roundNumber,
      dueDate,
      paymentsCreated: activeMembers.length,
      payoutRecipientId: recipient?.id || null,
      payoutAmount,
    };
  }

  // ============================================================================
  // PAYMENT PROCESSING
  // ============================================================================

  /**
   * Process an individual member's contribution payment.
   *
   * Late fee logic (consistent 5%):
   *   Days 1-2:  Grace period — payment accepted, no fee, not marked late
   *   Days 3-7:  Late — 5% fee applied
   *   Day 8+:    Default — 5% fee + security deposit applied + XnScore impact
   */
  async processPayment(
    contributionId: string,
    paymentMethod?: string,
    transactionId?: string
  ): Promise<PaymentProcessingResult> {
    // Load config for this contribution's circle
    await this.loadConfig(contributionId);

    const { data: contribution, error: fetchError } = await supabase
      .from("contributions")
      .select(`
        *,
        circle:circles(*),
        member:circle_members(*)
      `)
      .eq("id", contributionId)
      .single();

    if (fetchError || !contribution) {
      throw new Error("Contribution not found");
    }

    if (contribution.status !== "pending") {
      throw new Error("Contribution already processed");
    }

    const now = new Date();
    const dueDate = new Date(contribution.due_date);
    const msDiff = now.getTime() - dueDate.getTime();
    const rawDaysLate = msDiff > 0 ? Math.ceil(msDiff / (1000 * 60 * 60 * 24)) : 0;

    // Apply grace period
    const graceApplied = rawDaysLate > 0 && rawDaysLate <= this.config.gracePeriodDays;
    const isLate = rawDaysLate > this.config.gracePeriodDays;
    const effectiveDaysLate = isLate ? rawDaysLate : 0;

    // Calculate late fee (5% flat — one rule, everywhere)
    const lateFee = isLate
      ? this.calculateLateFee(contribution.amount)
      : 0;
    const totalCharged = parseFloat(contribution.amount) + lateFee;

    // Determine status
    const isDefault = rawDaysLate >= this.config.defaultThresholdDays;
    const status: PaymentProcessingResult["status"] = isDefault
      ? "defaulted"
      : isLate
        ? "late_completed"
        : "completed";

    // Update contribution record
    const { error: updateError } = await supabase
      .from("contributions")
      .update({
        status: isDefault ? "defaulted" : isLate ? "late" : "completed",
        paid_at: now.toISOString(),
        is_late: isLate,
        days_late: effectiveDaysLate,
        grace_period_used: graceApplied,
        late_fee: lateFee,
        total_charged: totalCharged,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        default_recorded: isDefault,
        updated_at: now.toISOString(),
      })
      .eq("id", contributionId);

    if (updateError) throw updateError;

    // Record event for XnScore processing
    await this.recordPaymentEvent(contribution, {
      isLate,
      daysLate: effectiveDaysLate,
      lateFee,
      isDefault,
      graceApplied,
    });

    // Handle default escalation
    if (isDefault) {
      await this.handleDefault(
        contribution.member_id,
        contribution.circle_id,
        contribution.amount
      );
    }

    // Check for tier downgrade
    if (isLate) {
      await this.checkTierDowngrade(contribution.member_id, contribution.user_id);
    }

    return {
      paymentId: contributionId,
      status,
      isLate,
      daysLate: effectiveDaysLate,
      lateFee,
      totalCharged,
      graceApplied,
    };
  }

  /**
   * Calculate late fee
   */
  private calculateLateFee(amount: number): number {
    let fee: number;

    if (this.config.lateFeeType === "percentage") {
      fee = amount * this.config.lateFeePercentage;
    } else {
      fee = this.config.lateFeeFlat;
    }

    // Apply min/max
    fee = Math.max(fee, this.config.lateFeeMin);
    if (this.config.lateFeeMax) {
      fee = Math.min(fee, this.config.lateFeeMax);
    }

    return Math.round(fee * 100) / 100;
  }

  // ============================================================================
  // ESCALATION HANDLERS
  // ============================================================================

  /**
   * Day 8+ default: apply security deposit, record default event,
   * trigger XnScore recalculation with severe penalty.
   */
  private async handleDefault(
    memberId: string,
    circleId: string,
    contributionAmount: number
  ): Promise<void> {
    const { data: member } = await supabase
      .from("circle_members")
      .select("*, user_id")
      .eq("id", memberId)
      .single();

    if (!member) return;

    // Apply security deposit toward the missed contribution
    const depositApplied = Math.min(
      parseFloat(member.security_deposit || 0),
      parseFloat(contributionAmount)
    );

    if (depositApplied > 0) {
      await supabase
        .from("circle_members")
        .update({
          security_deposit: parseFloat(member.security_deposit) - depositApplied,
        })
        .eq("id", memberId);

      // Credit the deposit to the circle's collected pool
      const { data: circle } = await supabase
        .from("circles")
        .select("total_collected")
        .eq("id", circleId)
        .single();

      await supabase
        .from("circles")
        .update({
          total_collected: (parseFloat(circle?.total_collected || 0)) + depositApplied,
        })
        .eq("id", circleId);
    }

    // Record default event
    await supabase.from("member_events").insert({
      user_id: member.user_id,
      member_id: memberId,
      circle_id: circleId,
      event_type: "payment_defaulted",
      severity: "critical",
      details: {
        contributionAmount,
        depositApplied,
        shortfall: contributionAmount - depositApplied,
      },
    });

    // Also record in defaults table (for Default Cascade system)
    await supabase.from("defaults").insert({
      user_id: member.user_id,
      circle_id: circleId,
      cycle_number: member.circle?.current_cycle || 1,
      amount: contributionAmount - depositApplied,
      status: depositApplied >= contributionAmount ? "covered" : "unresolved",
      covered_amount: depositApplied,
    });
  }

  /**
   * Check if member should be tier downgraded (3+ late payments)
   */
  private async checkTierDowngrade(memberId: string, userId: string): Promise<void> {
    // Count total late payments across ALL circles for this user
    const { data: stats } = await supabase
      .from("circle_members")
      .select("total_late_payments")
      .eq("user_id", userId)
      .eq("status", "active");

    const totalLate = (stats || []).reduce(
      (sum, s) => sum + (s.total_late_payments || 0),
      0
    );

    if (totalLate >= this.config.tierDowngradeThreshold) {
      await supabase.from("member_events").insert({
        user_id: userId,
        member_id: memberId,
        event_type: "tier_downgrade_triggered",
        severity: "high",
        details: {
          latePaymentsTotal: totalLate,
          threshold: this.config.tierDowngradeThreshold,
        },
      });
    }
  }

  /**
   * Record payment event for XnScore processing
   */
  private async recordPaymentEvent(
    contribution: any,
    details: {
      isLate: boolean;
      daysLate: number;
      lateFee: number;
      isDefault: boolean;
      graceApplied: boolean;
    }
  ): Promise<void> {
    let eventType: string;
    let severity: string;

    if (details.isDefault) {
      eventType = "payment_defaulted";
      severity = "critical";
    } else if (details.isLate) {
      eventType = "payment_late";
      severity = "medium";
    } else if (details.graceApplied) {
      eventType = "grace_period_used";
      severity = "low";
    } else {
      eventType = "payment_on_time";
      severity = "info";
    }

    await supabase.from("member_events").insert({
      user_id: contribution.user_id,
      member_id: contribution.member_id,
      circle_id: contribution.circle_id,
      event_type: eventType,
      severity,
      details: {
        contributionId: contribution.id,
        amount: contribution.amount,
        ...details,
      },
    });
  }

  // ============================================================================
  // CIRCLE LIFECYCLE
  // ============================================================================

  /**
   * Advance circle to next round after all payments are processed
   */
  async advanceCircle(circleId: string): Promise<void> {
    const { data: circle } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (!circle) throw new Error("Circle not found");

    const currentRound = circle.current_cycle || 1;

    // Check if all payments for current round are resolved
    const { count: pendingPayments } = await supabase
      .from("contributions")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("round_number", currentRound)
      .eq("status", "pending");

    if ((pendingPayments || 0) > 0) {
      throw new Error(`Round ${currentRound} still has ${pendingPayments} pending payments`);
    }

    // Update schedule status
    await supabase
      .from("contribution_schedules")
      .update({ status: "completed" })
      .eq("circle_id", circleId)
      .eq("round_number", currentRound);

    // Disburse payout for this round
    const { data: schedule } = await supabase
      .from("contribution_schedules")
      .select("*")
      .eq("circle_id", circleId)
      .eq("round_number", currentRound)
      .single();

    if (schedule && schedule.payout_recipient_id) {
      await supabase
        .from("contribution_schedules")
        .update({
          payout_status: "disbursed",
          payout_disbursed_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);

      // Mark recipient as having received payout
      await supabase
        .from("circle_members")
        .update({ payout_received: true })
        .eq("circle_id", circleId)
        .eq("user_id", schedule.payout_recipient_id);

      // Record payout event
      await supabase.from("member_events").insert({
        user_id: schedule.payout_recipient_id,
        circle_id: circleId,
        event_type: "payout_received",
        severity: "info",
        details: {
          roundNumber: currentRound,
          amount: schedule.payout_amount,
        },
      });
    }

    // Check if circle is complete
    if (currentRound >= (circle.total_cycles || circle.max_members)) {
      await supabase
        .from("circles")
        .update({
          status: "completed",
          end_date: new Date().toISOString(),
        })
        .eq("id", circleId);
      return;
    }

    // Activate next round
    const nextRound = currentRound + 1;

    await supabase
      .from("contribution_schedules")
      .update({ status: "active" })
      .eq("circle_id", circleId)
      .eq("round_number", nextRound);

    await supabase
      .from("circles")
      .update({ current_cycle: nextRound })
      .eq("id", circleId);
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get contribution schedule for a circle
   */
  async getCircleSchedule(circleId: string): Promise<ContributionSchedule[]> {
    const { data, error } = await supabase
      .from("contribution_schedules")
      .select("*")
      .eq("circle_id", circleId)
      .order("round_number", { ascending: true });

    if (error) throw error;
    return (data || []).map(this.transformSchedule);
  }

  /**
   * Get user's contributions for a circle
   */
  async getUserContributions(userId: string, circleId: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from("contributions")
      .select("*")
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .order("round_number", { ascending: true });

    if (error) throw error;
    return (data || []).map(this.transformContribution);
  }

  /**
   * Get all pending contributions for a user (across all circles)
   */
  async getUserPendingContributions(userId: string): Promise<Contribution[]> {
    const { data, error } = await supabase
      .from("contributions")
      .select("*, circle:circles(name)")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    if (error) throw error;
    return (data || []).map(this.transformContribution);
  }

  /**
   * Get overdue contributions for processing
   */
  async getOverdueContributions(): Promise<Contribution[]> {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("contributions")
      .select("*")
      .eq("status", "pending")
      .lt("due_date", today)
      .order("due_date", { ascending: true });

    if (error) throw error;
    return (data || []).map(this.transformContribution);
  }

  /**
   * Get contribution statistics for a user in a circle
   */
  async getUserContributionStats(userId: string, circleId: string): Promise<{
    totalDue: number;
    totalPaid: number;
    totalPending: number;
    onTimePayments: number;
    latePayments: number;
    lateFeesPaid: number;
    nextDueDate: string | null;
    nextDueAmount: number;
    payoutPosition: number | null;
    payoutReceived: boolean;
  }> {
    const { data: contributions } = await supabase
      .from("contributions")
      .select("*")
      .eq("user_id", userId)
      .eq("circle_id", circleId);

    const { data: member } = await supabase
      .from("circle_members")
      .select("payout_position, payout_received")
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .single();

    const stats = (contributions || []).reduce(
      (acc, c) => {
        acc.totalDue += parseFloat(c.amount);
        if (c.status === "completed" || c.status === "late") {
          acc.totalPaid += parseFloat(c.total_charged || c.amount);
          if (c.is_late) {
            acc.latePayments++;
            acc.lateFeesPaid += parseFloat(c.late_fee || 0);
          } else {
            acc.onTimePayments++;
          }
        } else if (c.status === "pending") {
          acc.totalPending += parseFloat(c.amount);
        }
        return acc;
      },
      {
        totalDue: 0,
        totalPaid: 0,
        totalPending: 0,
        onTimePayments: 0,
        latePayments: 0,
        lateFeesPaid: 0,
      }
    );

    // Get next pending contribution
    const nextPending = (contributions || [])
      .filter(c => c.status === "pending")
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

    return {
      ...stats,
      nextDueDate: nextPending?.due_date || null,
      nextDueAmount: nextPending ? parseFloat(nextPending.amount) : 0,
      payoutPosition: member?.payout_position || null,
      payoutReceived: member?.payout_received || false,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Load configuration from database
   */
  private async loadConfig(contributionId?: string): Promise<void> {
    let circleId: string | null = null;

    if (contributionId) {
      const { data } = await supabase
        .from("contributions")
        .select("circle_id")
        .eq("id", contributionId)
        .single();
      circleId = data?.circle_id;
    }

    // Try to load circle-specific or community config
    let config: any = null;

    if (circleId) {
      const { data } = await supabase
        .from("late_fee_config")
        .select("*")
        .eq("circle_id", circleId)
        .eq("is_active", true)
        .single();
      config = data;
    }

    // Fall back to platform default
    if (!config) {
      const { data } = await supabase
        .from("late_fee_config")
        .select("*")
        .is("circle_id", null)
        .is("community_id", null)
        .eq("is_active", true)
        .single();
      config = data;
    }

    if (config) {
      this.config = {
        gracePeriodDays: config.grace_period_days,
        lateFeeType: config.late_fee_type,
        lateFeePercentage: parseFloat(config.late_fee_percentage),
        lateFeeFlat: parseFloat(config.late_fee_flat || 0),
        lateFeeMin: parseFloat(config.late_fee_min || 0),
        lateFeeMax: config.late_fee_max ? parseFloat(config.late_fee_max) : undefined,
        defaultThresholdDays: config.default_threshold_days,
        tierDowngradeThreshold: config.tier_downgrade_threshold,
      };
    }
  }

  private transformSchedule(row: any): ContributionSchedule {
    return {
      id: row.id,
      circleId: row.circle_id,
      roundNumber: row.round_number,
      dueDate: row.due_date,
      payoutRecipientId: row.payout_recipient_id,
      payoutAmount: parseFloat(row.payout_amount || 0),
      status: row.status,
      expectedContributions: row.expected_contributions,
      receivedContributions: row.received_contributions || 0,
      totalCollected: parseFloat(row.total_collected || 0),
      totalLateFees: parseFloat(row.total_late_fees || 0),
      payoutStatus: row.payout_status,
      payoutDisbursedAt: row.payout_disbursed_at,
      createdAt: row.created_at,
    };
  }

  private transformContribution(row: any): Contribution {
    return {
      id: row.id,
      circleId: row.circle_id,
      userId: row.user_id,
      memberId: row.member_id,
      scheduleId: row.schedule_id,
      roundNumber: row.round_number,
      amount: parseFloat(row.amount),
      currency: row.currency,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      status: row.status,
      isLate: row.is_late || false,
      daysLate: row.days_late || 0,
      gracePeriodUsed: row.grace_period_used || false,
      lateFee: parseFloat(row.late_fee || 0),
      totalCharged: parseFloat(row.total_charged || row.amount),
      defaultRecorded: row.default_recorded || false,
      securityDepositApplied: parseFloat(row.security_deposit_applied || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// Export default instance
export const contributionSchedulingService = new ContributionSchedulingService();

// Export convenience functions
export const generateSchedule = (circleId: string) =>
  contributionSchedulingService.generateFullSchedule(circleId);

export const processContributionPayment = (contributionId: string, method?: string, txId?: string) =>
  contributionSchedulingService.processPayment(contributionId, method, txId);

export const advanceCircle = (circleId: string) =>
  contributionSchedulingService.advanceCircle(circleId);

export const getUserPendingContributions = (userId: string) =>
  contributionSchedulingService.getUserPendingContributions(userId);

export const calculateDueDate = (
  startDate: Date,
  frequency: ContributionFrequency,
  round: number
) => contributionSchedulingService.calculateRoundDueDate(startDate, frequency, round);
