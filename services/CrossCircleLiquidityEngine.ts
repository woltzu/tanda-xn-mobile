// ══════════════════════════════════════════════════════════════════════════════
// CrossCircleLiquidityEngine — Platform liquidity pool for payout advances
// Eligibility checking, advance lifecycle, pool utilization, concentration limits
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";

// ─── TYPES ──────────────────────────────────────────────────────────────────

export type AdvanceStatus = "requested" | "approved" | "disbursed" | "repaying" | "repaid" | "defaulted" | "rejected" | "cancelled" | "queued";
export type FeeTier = "30_day" | "60_day";
export type RepaymentMethod = "payout_offset" | "manual" | "split";

export interface LiquidityPool {
  id: string;
  poolName: string;
  totalCapitalCents: number;
  deployedCents: number;
  availableCents: number;
  reservedCents: number;
  feesEarnedCents: number;
  lossesCents: number;
  utilizationPct: number;
  maxUtilizationPct: number;
  isAcceptingRequests: boolean;
  maxCircleConcentrationPct: number;
  maxMemberExposurePct: number;
  totalAdvancesIssued: number;
  totalAdvancesRepaid: number;
  totalAdvancesDefaulted: number;
  defaultRatePct: number;
}

export interface LiquidityAdvance {
  id: string;
  poolId: string;
  memberId: string;
  circleId: string;
  requestedAmountCents: number;
  approvedAmountCents: number | null;
  expectedPayoutCents: number;
  advancePctOfPayout: number;
  feeTier: FeeTier;
  feePct: number;
  feeAmountCents: number;
  earlyRepayDiscountPct: number;
  lateFeeCents: number;
  disbursedAmountCents: number | null;
  totalRepaymentCents: number | null;
  amountRepaidCents: number;
  memberXnscore: number | null;
  memberTier: string | null;
  memberDcr: number | null;
  completedCycles: number | null;
  repaymentMethod: RepaymentMethod;
  repayByDate: string;
  payoutDate: string | null;
  actualRepaidDate: string | null;
  isEarlyRepayment: boolean;
  lateFeeApplied: boolean;
  status: AdvanceStatus;
  rejectionReason: string | null;
  queuePosition: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityResult {
  eligible: boolean;
  maxAmountCents: number;
  reasons: string[];
  memberTier: string;
  xnScore: number;
  completedCycles: number;
  hasOutstandingAdvance: boolean;
  dcr: number;
  feePct30Day: number;
  feePct60Day: number;
}

export interface AdvanceCalculation {
  requestedAmountCents: number;
  feeTier: FeeTier;
  feePct: number;
  feeAmountCents: number;
  disbursedAmountCents: number;
  totalRepaymentCents: number;
  earlyRepayFeeReduction: number;
  earlyRepayTotalCents: number;
  lateFeeCents: number;
  lateTotalCents: number;
}

export interface PoolHealthDashboard {
  poolName: string;
  totalCapitalCents: number;
  deployedCents: number;
  availableCents: number;
  utilizationPct: number;
  isAcceptingRequests: boolean;
  activeAdvances: number;
  queuedCount: number;
  feesEarnedCents: number;
  lossesCents: number;
  returnOnCapitalPct: number;
  avgFeePerAdvanceCents: number;
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ELIGIBILITY = {
  MIN_XNSCORE: 65,       // XnScore 65+ required (0-100 scale)
  MIN_TIER: 2,           // Tier 2 (Established) or above
  MIN_COMPLETED_CYCLES: 2,
  MAX_PAYOUT_PCT: 80,   // Cannot exceed 80% of expected payout
  MAX_DCR: 0.50,        // Debt-to-contribution ratio max
};

const FEES = {
  "30_day": 3.0,         // 3% flat for 30-day repayment
  "60_day": 5.0,         // 5% flat for 60-day repayment
  EARLY_REPAY_DISCOUNT: 0.5,  // 0.5% reduction for early repayment
  LATE_FEE_CENTS: 2500,       // $25 flat late fee
};

// Tier mapping from XnScore (0-100 scale used internally)
const TIER_MAP: Record<string, { minScore: number; label: string; maxPct: number }> = {
  locked:   { minScore: 0,  label: "Locked",   maxPct: 0 },
  preview:  { minScore: 25, label: "Preview",  maxPct: 0 },
  basic:    { minScore: 45, label: "Basic",    maxPct: 50 },
  standard: { minScore: 60, label: "Standard", maxPct: 65 },
  premium:  { minScore: 75, label: "Premium",  maxPct: 80 },
  elite:    { minScore: 90, label: "Elite",    maxPct: 90 },
};

// ─── MAPPERS ────────────────────────────────────────────────────────────────

function mapPool(row: any): LiquidityPool {
  return {
    id: row.id,
    poolName: row.pool_name,
    totalCapitalCents: Number(row.total_capital_cents),
    deployedCents: Number(row.deployed_cents),
    availableCents: Number(row.available_cents),
    reservedCents: Number(row.reserved_cents),
    feesEarnedCents: Number(row.fees_earned_cents),
    lossesCents: Number(row.losses_cents),
    utilizationPct: parseFloat(row.utilization_pct),
    maxUtilizationPct: parseFloat(row.max_utilization_pct),
    isAcceptingRequests: row.is_accepting_requests,
    maxCircleConcentrationPct: parseFloat(row.max_circle_concentration_pct),
    maxMemberExposurePct: parseFloat(row.max_member_exposure_pct),
    totalAdvancesIssued: row.total_advances_issued,
    totalAdvancesRepaid: row.total_advances_repaid,
    totalAdvancesDefaulted: row.total_advances_defaulted,
    defaultRatePct: parseFloat(row.default_rate_pct),
  };
}

function mapAdvance(row: any): LiquidityAdvance {
  return {
    id: row.id,
    poolId: row.pool_id,
    memberId: row.member_id,
    circleId: row.circle_id,
    requestedAmountCents: Number(row.requested_amount_cents),
    approvedAmountCents: row.approved_amount_cents ? Number(row.approved_amount_cents) : null,
    expectedPayoutCents: Number(row.expected_payout_cents),
    advancePctOfPayout: parseFloat(row.advance_pct_of_payout),
    feeTier: row.fee_tier,
    feePct: parseFloat(row.fee_pct),
    feeAmountCents: Number(row.fee_amount_cents),
    earlyRepayDiscountPct: parseFloat(row.early_repay_discount_pct),
    lateFeeCents: row.late_fee_cents,
    disbursedAmountCents: row.disbursed_amount_cents ? Number(row.disbursed_amount_cents) : null,
    totalRepaymentCents: row.total_repayment_cents ? Number(row.total_repayment_cents) : null,
    amountRepaidCents: Number(row.amount_repaid_cents),
    memberXnscore: row.member_xnscore ? parseFloat(row.member_xnscore) : null,
    memberTier: row.member_tier,
    memberDcr: row.member_dcr ? parseFloat(row.member_dcr) : null,
    completedCycles: row.completed_cycles,
    repaymentMethod: row.repayment_method,
    repayByDate: row.repay_by_date,
    payoutDate: row.payout_date,
    actualRepaidDate: row.actual_repaid_date,
    isEarlyRepayment: row.is_early_repayment ?? false,
    lateFeeApplied: row.late_fee_applied ?? false,
    status: row.status,
    rejectionReason: row.rejection_reason,
    queuePosition: row.queue_position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═════════════════════════════════════════════════════════════════════���════════
// ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class CrossCircleLiquidityEngine {

  // ═══════════════════════════════════════════════════════════════════════════
  // A. POOL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get the primary liquidity pool */
  static async getPool(): Promise<LiquidityPool> {
    const { data, error } = await supabase
      .from("liquidity_pool")
      .select("*")
      .eq("pool_name", "primary")
      .single();
    if (error) throw error;
    return mapPool(data);
  }

  /** Get pool health dashboard */
  static async getPoolDashboard(): Promise<PoolHealthDashboard> {
    const { data, error } = await supabase
      .from("pool_health_dashboard")
      .select("*")
      .limit(1)
      .single();
    if (error) throw error;
    return {
      poolName: data.pool_name,
      totalCapitalCents: Number(data.total_capital_cents),
      deployedCents: Number(data.deployed_cents),
      availableCents: Number(data.available_cents),
      utilizationPct: parseFloat(data.utilization_pct),
      isAcceptingRequests: data.is_accepting_requests,
      activeAdvances: data.active_advances ?? 0,
      queuedCount: data.queued_count ?? 0,
      feesEarnedCents: Number(data.fees_earned_cents),
      lossesCents: Number(data.losses_cents),
      returnOnCapitalPct: parseFloat(data.return_on_capital_pct) || 0,
      avgFeePerAdvanceCents: Number(data.avg_fee_per_advance_cents),
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // B. ELIGIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /** Check member eligibility for a liquidity advance */
  static async checkEligibility(
    memberId: string,
    circleId: string,
    xnScore: number,
    expectedPayoutCents: number,
    completedCycles: number,
    dcr: number = 0,
    memberTier: string = "basic"
  ): Promise<EligibilityResult> {
    const reasons: string[] = [];
    let eligible = true;

    // 1. XnScore check (65+ on 0-100 scale)
    if (xnScore < ELIGIBILITY.MIN_XNSCORE) {
      eligible = false;
      reasons.push(`XnScore must be ${ELIGIBILITY.MIN_XNSCORE}+ (current: ${Math.round(xnScore)})`);
    }

    // 2. Tier check
    const tierKeys = Object.keys(TIER_MAP);
    const tierIndex = tierKeys.indexOf(memberTier.toLowerCase());
    if (tierIndex < 2) { // basic = index 2
      eligible = false;
      reasons.push(`Must be Tier 2 (Established) or above (current: ${memberTier})`);
    }

    // 3. Completed cycles
    if (completedCycles < ELIGIBILITY.MIN_COMPLETED_CYCLES) {
      eligible = false;
      reasons.push(`Must complete at least ${ELIGIBILITY.MIN_COMPLETED_CYCLES} contribution cycles (current: ${completedCycles})`);
    }

    // 4. No outstanding advance
    const { count } = await supabase
      .from("liquidity_advances")
      .select("*", { count: "exact", head: true })
      .eq("member_id", memberId)
      .in("status", ["approved", "disbursed", "repaying"]);
    const hasOutstanding = (count ?? 0) > 0;
    if (hasOutstanding) {
      eligible = false;
      reasons.push("Cannot have an outstanding advance");
    }

    // 5. DCR check
    if (dcr >= ELIGIBILITY.MAX_DCR) {
      eligible = false;
      reasons.push(`Debt-to-contribution ratio too high (${Math.round(dcr * 100)}% — max 50%)`);
    }

    // 6. Pool availability
    const pool = await this.getPool();
    if (!pool.isAcceptingRequests) {
      eligible = false;
      reasons.push("Liquidity pool temporarily at capacity — try again soon");
    }

    // 7. Circle concentration check
    const { data: exposure } = await supabase
      .from("pool_circle_exposure")
      .select("concentration_pct")
      .eq("pool_id", pool.id)
      .eq("circle_id", circleId)
      .maybeSingle();
    if (exposure && parseFloat(exposure.concentration_pct) >= pool.maxCircleConcentrationPct) {
      eligible = false;
      reasons.push("Circle has reached maximum advance concentration");
    }

    // Calculate max advance amount
    const tierConfig = TIER_MAP[memberTier.toLowerCase()] ?? TIER_MAP.basic;
    const maxPct = Math.min(tierConfig.maxPct, ELIGIBILITY.MAX_PAYOUT_PCT);
    const maxAmountCents = Math.floor(expectedPayoutCents * (maxPct / 100));

    if (eligible && reasons.length === 0) {
      reasons.push("Eligible for advance");
    }

    return {
      eligible,
      maxAmountCents,
      reasons,
      memberTier,
      xnScore: xnScore,
      completedCycles,
      hasOutstandingAdvance: hasOutstanding,
      dcr,
      feePct30Day: FEES["30_day"],
      feePct60Day: FEES["60_day"],
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // C. ADVANCE CALCULATOR
  // ═══════════════════════════════════════════════════════════════════════════

  /** Calculate advance details before confirmation */
  static calculateAdvance(amountCents: number, feeTier: FeeTier = "30_day"): AdvanceCalculation {
    const feePct = FEES[feeTier];
    const feeAmountCents = Math.round(amountCents * (feePct / 100));
    const earlyDiscountPct = feePct - FEES.EARLY_REPAY_DISCOUNT;
    const earlyFeeAmountCents = Math.round(amountCents * (earlyDiscountPct / 100));

    return {
      requestedAmountCents: amountCents,
      feeTier,
      feePct,
      feeAmountCents,
      disbursedAmountCents: amountCents,
      totalRepaymentCents: amountCents + feeAmountCents,
      earlyRepayFeeReduction: FEES.EARLY_REPAY_DISCOUNT,
      earlyRepayTotalCents: amountCents + earlyFeeAmountCents,
      lateFeeCents: FEES.LATE_FEE_CENTS,
      lateTotalCents: amountCents + feeAmountCents + FEES.LATE_FEE_CENTS,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // D. ADVANCE LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /** Request a new advance */
  static async requestAdvance(
    memberId: string,
    circleId: string,
    amountCents: number,
    expectedPayoutCents: number,
    feeTier: FeeTier = "30_day",
    repaymentMethod: RepaymentMethod = "payout_offset",
    payoutDate?: string,
    eligibility?: EligibilityResult
  ): Promise<LiquidityAdvance> {
    const pool = await this.getPool();
    const calc = this.calculateAdvance(amountCents, feeTier);

    // Calculate repay-by date
    const repayByDays = feeTier === "30_day" ? 30 : 60;
    const repayByDate = new Date();
    repayByDate.setDate(repayByDate.getDate() + repayByDays);

    // Determine initial status
    let status: AdvanceStatus = "requested";
    let rejectionReason: string | null = null;
    let queuePosition: number | null = null;

    if (!pool.isAcceptingRequests) {
      // Queue if pool is at capacity
      const { count } = await supabase
        .from("liquidity_advances")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", pool.id)
        .eq("status", "queued");
      queuePosition = (count ?? 0) + 1;
      status = "queued";
    } else if (pool.availableCents < amountCents) {
      status = "queued";
      queuePosition = 1;
    }

    // Auto-approve if eligible and pool has capacity
    if (status === "requested" && eligibility?.eligible) {
      status = "approved";
    }

    const { data, error } = await supabase
      .from("liquidity_advances")
      .insert({
        pool_id: pool.id,
        member_id: memberId,
        circle_id: circleId,
        requested_amount_cents: amountCents,
        approved_amount_cents: status === "approved" ? amountCents : null,
        expected_payout_cents: expectedPayoutCents,
        advance_pct_of_payout: Math.round((amountCents / expectedPayoutCents) * 100 * 100) / 100,
        fee_tier: feeTier,
        fee_pct: calc.feePct,
        fee_amount_cents: calc.feeAmountCents,
        disbursed_amount_cents: status === "approved" ? amountCents : null,
        total_repayment_cents: status === "approved" ? calc.totalRepaymentCents : null,
        member_xnscore: eligibility?.xnScore,
        member_tier: eligibility?.memberTier,
        member_dcr: eligibility?.dcr,
        completed_cycles: eligibility?.completedCycles,
        repayment_method: repaymentMethod,
        repay_by_date: repayByDate.toISOString().split("T")[0],
        payout_date: payoutDate,
        status,
        rejection_reason: rejectionReason,
        queue_position: queuePosition,
      })
      .select()
      .single();

    if (error) throw error;
    return mapAdvance(data);
  }

  /** Disburse an approved advance (send funds to member wallet) */
  static async disburseAdvance(advanceId: string): Promise<LiquidityAdvance> {
    const { data, error } = await supabase
      .from("liquidity_advances")
      .update({ status: "disbursed" })
      .eq("id", advanceId)
      .eq("status", "approved")
      .select()
      .single();
    if (error) throw error;

    // Record pool transaction
    const advance = mapAdvance(data);
    await this.recordTransaction(advance.poolId, advanceId, "advance_disbursement", advance.disbursedAmountCents ?? 0, "outflow");

    return advance;
  }

  /** Record a repayment */
  static async recordRepayment(advanceId: string, amountCents: number): Promise<LiquidityAdvance> {
    // Get current advance
    const { data: current } = await supabase
      .from("liquidity_advances")
      .select("*")
      .eq("id", advanceId)
      .single();
    if (!current) throw new Error("Advance not found");

    const newRepaid = Number(current.amount_repaid_cents) + amountCents;
    const totalDue = Number(current.total_repayment_cents);
    const isFullyRepaid = newRepaid >= totalDue;

    // Check for early repayment
    const isEarly = new Date() < new Date(current.repay_by_date);

    const updates: any = {
      amount_repaid_cents: newRepaid,
      status: isFullyRepaid ? "repaid" : "repaying",
    };

    if (isFullyRepaid) {
      updates.actual_repaid_date = new Date().toISOString().split("T")[0];
      updates.is_early_repayment = isEarly;
    }

    const { data, error } = await supabase
      .from("liquidity_advances")
      .update(updates)
      .eq("id", advanceId)
      .select()
      .single();
    if (error) throw error;

    // Record transactions
    const advance = mapAdvance(data);
    await this.recordTransaction(advance.poolId, advanceId, "advance_repayment", amountCents, "inflow");

    if (isFullyRepaid) {
      await this.recordTransaction(advance.poolId, advanceId, "fee_earned", advance.feeAmountCents, "inflow");
      if (isEarly) {
        const discount = Math.round(advance.disbursedAmountCents! * (FEES.EARLY_REPAY_DISCOUNT / 100));
        await this.recordTransaction(advance.poolId, advanceId, "early_repay_discount", discount, "outflow");
      }
    }

    return advance;
  }

  /** Apply late fee to overdue advance */
  static async applyLateFee(advanceId: string): Promise<LiquidityAdvance> {
    const { data, error } = await supabase
      .from("liquidity_advances")
      .update({
        late_fee_applied: true,
        total_repayment_cents: supabase.rpc ? undefined : 0, // Will be recalculated
      })
      .eq("id", advanceId)
      .select()
      .single();
    if (error) throw error;

    // Add late fee to total
    const advance = mapAdvance(data);
    const newTotal = (advance.totalRepaymentCents ?? 0) + FEES.LATE_FEE_CENTS;
    await supabase
      .from("liquidity_advances")
      .update({ total_repayment_cents: newTotal })
      .eq("id", advanceId);

    await this.recordTransaction(advance.poolId, advanceId, "late_fee_earned", FEES.LATE_FEE_CENTS, "inflow");

    return { ...advance, lateFeeApplied: true, totalRepaymentCents: newTotal };
  }

  /** Mark advance as defaulted */
  static async markDefaulted(advanceId: string): Promise<LiquidityAdvance> {
    const { data, error } = await supabase
      .from("liquidity_advances")
      .update({ status: "defaulted" })
      .eq("id", advanceId)
      .select()
      .single();
    if (error) throw error;

    const advance = mapAdvance(data);
    const lossAmount = (advance.disbursedAmountCents ?? 0) - advance.amountRepaidCents;
    if (lossAmount > 0) {
      await this.recordTransaction(advance.poolId, advanceId, "default_writeoff", lossAmount, "outflow");
    }

    return advance;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // E. QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Get member's advances */
  static async getMemberAdvances(memberId: string): Promise<LiquidityAdvance[]> {
    const { data, error } = await supabase
      .from("liquidity_advances")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAdvance);
  }

  /** Get member's active advance (if any) */
  static async getActiveAdvance(memberId: string): Promise<LiquidityAdvance | null> {
    const { data, error } = await supabase
      .from("liquidity_advances")
      .select("*")
      .eq("member_id", memberId)
      .in("status", ["approved", "disbursed", "repaying"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapAdvance(data) : null;
  }

  /** Get overdue advances (for cron processing) */
  static async getOverdueAdvances(): Promise<LiquidityAdvance[]> {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("liquidity_advances")
      .select("*")
      .in("status", ["disbursed", "repaying"])
      .lt("repay_by_date", today);
    if (error) throw error;
    return (data ?? []).map(mapAdvance);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // F. POOL TRANSACTIONS (LEDGER)
  // ═══════════════════════════════════════════════════════════════════════════

  /** Record a pool transaction */
  private static async recordTransaction(
    poolId: string,
    advanceId: string | null,
    type: string,
    amountCents: number,
    direction: "inflow" | "outflow"
  ): Promise<void> {
    const pool = await this.getPool();
    const balanceAfter = direction === "inflow"
      ? pool.availableCents + amountCents
      : pool.availableCents - amountCents;

    await supabase.from("pool_transactions").insert({
      pool_id: poolId,
      advance_id: advanceId,
      type,
      amount_cents: amountCents,
      direction,
      balance_after_cents: balanceAfter,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // G. REALTIME
  // ═══════════════════════════════════════════════════════════════════════════

  /** Subscribe to member's advance updates */
  static subscribeToAdvances(memberId: string, callback: (advance: LiquidityAdvance) => void) {
    return supabase
      .channel(`advances_${memberId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "liquidity_advances", filter: `member_id=eq.${memberId}` },
        (payload) => callback(mapAdvance(payload.new))
      )
      .subscribe();
  }
}
