/**
 * ══════════════════════════════════════════════════════════════════════════════
 * PARTIAL CONTRIBUTION ENGINE
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Instead of binary pay-or-default, members can contribute 50% now with the
 * remaining 50% split 25/25 across the next two cycles. Insurance pool covers
 * the shortfall temporarily. No XnScore penalty if catch-ups are on time.
 *
 * Sections:
 *   A — Eligibility                   E — Admin / Stats
 *   B — Activation (Core)             F — Realtime
 *   C — Catch-Up Processing           G — Notification
 *   D — Plan Management
 */

import { supabase } from '@/lib/supabase';


// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanStatus = 'active' | 'completed' | 'defaulted' | 'cancelled';
export type ContributionType = 'regular' | 'partial' | 'catch_up';
export type CatchUpItemStatus = 'scheduled' | 'paid' | 'late' | 'defaulted';

export interface CatchUpScheduleItem {
  cycleNumber: number;
  amountCents: number;
  dueDate: string;
  contributionId: string | null;
  status: CatchUpItemStatus;
}

export interface PartialContributionPlan {
  id: string;
  memberId: string;
  circleId: string;
  cycleId: string;
  originalAmountCents: number;
  paidAmountCents: number;
  remainingAmountCents: number;
  catchUpSchedule: CatchUpScheduleItem[];
  feeCents: number;
  usesThisYear: number;
  status: PlanStatus;
  activatedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityCheck {
  eligible: boolean;
  reason: string | null;
  usesThisYear: number;
  feeRequired: boolean;
  feeCents: number;
}

export interface PartialContributionSummary {
  originalAmount: number;
  payNowAmount: number;
  catchUp1Amount: number;
  catchUp1Date: string;
  catchUp1CycleNumber: number;
  catchUp2Amount: number;
  catchUp2Date: string;
  catchUp2CycleNumber: number;
  regularContribution: number;
  totalNextCycle: number;
  totalCycleAfter: number;
  feeCents: number;
  usesThisYear: number;
}

export interface PartialActivationResult {
  plan: PartialContributionPlan;
  summary: PartialContributionSummary;
  catchUpContributionIds: string[];
}

// Bucket A — RPC payload shapes, matching the migration-102 server side.
// These replace the broken TS-built getActivationSummary +
// activatePartialContribution paths described in the migration header.

export interface PartialPreviewEligibility {
  eligible: boolean;
  reason: string | null;
  uses_this_year: number;
  fee_required: boolean;
  fee_cents: number;
}

export interface PartialPreviewSummary {
  current_contribution_id: string;
  original_amount_cents: number;
  pay_now_cents: number;
  catch_up_1_cents: number;
  catch_up_1_due: string;
  catch_up_1_cycle_number: number;
  catch_up_2_cents: number;
  catch_up_2_due: string;
  catch_up_2_cycle_number: number;
  regular_contribution_cents: number;
  total_next_cycle_cents: number;
  total_cycle_after_cents: number;
}

export type CoverageStatus =
  | "covered_full"
  | "covered_partial"
  | "no_balance"
  | "no_pool";

export interface PartialPreviewCoverage {
  pool_id: string | null;
  pool_balance_cents: number;
  shortfall_cents: number;
  approved_cents: number;
  coverage_status: CoverageStatus;
}

export interface PartialPreviewResult {
  success: boolean;
  eligibility: PartialPreviewEligibility;
  summary?: PartialPreviewSummary;
  coverage_preview?: PartialPreviewCoverage;
  error?: string;
}

export interface PartialActivateResult {
  success: boolean;
  plan_id?: string;
  error?: string;
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAPPERS — snake_case (DB) → camelCase (app)
// ═══════════════════════════════════════════════════════════════════════════════

function mapPlan(row: any): PartialContributionPlan {
  const schedule = (row.catch_up_schedule || []).map((item: any) => ({
    cycleNumber: item.cycle_number,
    amountCents: item.amount_cents,
    dueDate: item.due_date,
    contributionId: item.contribution_id || null,
    status: item.status,
  }));

  return {
    id: row.id,
    memberId: row.member_id,
    circleId: row.circle_id,
    cycleId: row.cycle_id,
    originalAmountCents: row.original_amount_cents,
    paidAmountCents: row.paid_amount_cents,
    remainingAmountCents: row.remaining_amount_cents,
    catchUpSchedule: schedule,
    feeCents: row.fee_cents,
    usesThisYear: row.uses_this_year,
    status: row.status,
    activatedAt: row.activated_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export class PartialContributionEngine {

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION A — Eligibility
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if a member is eligible for partial contribution mode.
   *
   * Requirements:
   * 1. No active partial plan for this member
   * 2. Max 2 uses per 12 months (first free, second $10)
   * 3. Request must be before the contribution deadline
   * 4. Member must be in good standing (active in circle)
   */
  static async checkEligibility(
    userId: string,
    circleId: string,
    cycleId: string
  ): Promise<EligibilityCheck> {
    // Check for any active plan
    const { data: activePlan } = await supabase
      .from('partial_contribution_plans')
      .select('id')
      .eq('member_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (activePlan) {
      return {
        eligible: false,
        reason: 'You already have an active partial contribution plan. Complete your current catch-up payments first.',
        usesThisYear: 0,
        feeRequired: false,
        feeCents: 0,
      };
    }

    // Count uses in last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    const { data: recentPlans, error: countErr } = await supabase
      .from('partial_contribution_plans')
      .select('id')
      .eq('member_id', userId)
      .gte('activated_at', twelveMonthsAgo.toISOString());

    if (countErr) throw new Error(`Failed to check eligibility: ${countErr.message}`);

    const usesThisYear = (recentPlans || []).length;

    if (usesThisYear >= 2) {
      return {
        eligible: false,
        reason: 'You have already used partial contribution mode twice in the last 12 months.',
        usesThisYear,
        feeRequired: false,
        feeCents: 0,
      };
    }

    // Check contribution deadline.
    // NOTE: SELECT used to include `status` (engine pre-migration-102 bug).
    // Column on circle_cycles is `cycle_status`, not `status`, and the
    // value was never read here — `cycle.status` is referenced nowhere.
    // We just need the deadline. (Server-side preview_partial_contribution
    // from migration 102 uses the correct columns.)
    const { data: cycle, error: cycleErr } = await supabase
      .from('circle_cycles')
      .select('contribution_deadline')
      .eq('id', cycleId)
      .single();

    if (cycleErr || !cycle) {
      return {
        eligible: false,
        reason: 'Cycle not found.',
        usesThisYear,
        feeRequired: false,
        feeCents: 0,
      };
    }

    const now = new Date();
    const deadline = new Date(cycle.contribution_deadline);

    if (now > deadline) {
      return {
        eligible: false,
        reason: 'The contribution deadline for this cycle has passed. Partial contribution must be requested before the due date.',
        usesThisYear,
        feeRequired: false,
        feeCents: 0,
      };
    }

    // Check member is active in circle
    const { data: member } = await supabase
      .from('circle_members')
      .select('status')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single();

    if (!member || member.status !== 'active') {
      return {
        eligible: false,
        reason: 'You must be an active circle member to use partial contribution mode.',
        usesThisYear,
        feeRequired: false,
        feeCents: 0,
      };
    }

    // Fee calculation: $0 first use, $10 (1000 cents) second use
    const feeRequired = usesThisYear >= 1;
    const feeCents = feeRequired ? 1000 : 0;

    return {
      eligible: true,
      reason: null,
      usesThisYear,
      feeRequired,
      feeCents,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION B — Activation (Core)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Preview the partial-contribution shape for (circle, cycle).
   *
   * Bucket A: replaces the broken pre-migration-102 TS implementation that
   * did 4 separate selects with wrong column names. This wraps the
   * single-transaction preview_partial_contribution RPC (migration 102),
   * which returns eligibility + 50/25/25 summary + insurance-pool coverage
   * preview in one round-trip.
   */
  static async preview(
    circleId: string,
    cycleId: string,
  ): Promise<PartialPreviewResult> {
    const { data, error } = await supabase.rpc("preview_partial_contribution", {
      p_circle_id: circleId,
      p_cycle_id: cycleId,
    });
    if (error) {
      return {
        success: false,
        eligibility: {
          eligible: false,
          reason: error.message,
          uses_this_year: 0,
          fee_required: false,
          fee_cents: 0,
        },
        error: error.message,
      };
    }
    return data as PartialPreviewResult;
  }

  /**
   * Activate the 50/25/25 partial-contribution plan for (circle, cycle).
   *
   * Bucket A: replaces the broken pre-migration-102 TS implementation. This
   * wraps the single-transaction activate_partial_contribution RPC, which
   * does eligibility re-check, 50/25/25 split, contribution UPDATE,
   * catch-up INSERTs, plan INSERT, and pool-coverage recording in one
   * transaction. No more 8-call sequence with no transaction boundary.
   */
  static async activate(
    circleId: string,
    cycleId: string,
  ): Promise<PartialActivateResult> {
    const { data, error } = await supabase.rpc("activate_partial_contribution", {
      p_circle_id: circleId,
      p_cycle_id: cycleId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return data as PartialActivateResult;
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION C — Catch-Up Processing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Process a successful catch-up payment.
   * Updates the plan's catch-up schedule and checks if plan is complete.
   */
  static async processCatchUpPayment(contributionId: string): Promise<PartialContributionPlan | null> {
    // Find the contribution and its plan
    const { data: contribution, error: contribErr } = await supabase
      .from('cycle_contributions')
      .select('partial_plan_id, contribution_type')
      .eq('id', contributionId)
      .single();

    if (contribErr || !contribution || contribution.contribution_type !== 'catch_up') {
      return null; // Not a catch-up contribution
    }

    if (!contribution.partial_plan_id) return null;

    // Get the plan
    const { data: plan, error: planErr } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('id', contribution.partial_plan_id)
      .single();

    if (planErr || !plan) return null;

    // Update catch-up schedule item status
    const updatedSchedule = (plan.catch_up_schedule || []).map((item: any) => {
      if (item.contribution_id === contributionId) {
        return { ...item, status: 'paid' };
      }
      return item;
    });

    // Check if all catch-ups are paid
    const allPaid = updatedSchedule.every((item: any) => item.status === 'paid');

    const updateData: any = {
      catch_up_schedule: updatedSchedule,
    };

    if (allPaid) {
      updateData.status = 'completed';
      updateData.completed_at = new Date().toISOString();
      updateData.remaining_amount_cents = 0;
    } else {
      // Recalculate remaining
      const paidCatchUpCents = updatedSchedule
        .filter((item: any) => item.status === 'paid')
        .reduce((sum: number, item: any) => sum + item.amount_cents, 0);
      updateData.remaining_amount_cents = plan.remaining_amount_cents - paidCatchUpCents +
        updatedSchedule.filter((item: any) => item.status !== 'paid')
          .reduce((sum: number, item: any) => sum + item.amount_cents, 0);
    }

    const { data: updated, error: updateErr } = await supabase
      .from('partial_contribution_plans')
      .update(updateData)
      .eq('id', plan.id)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to update plan: ${updateErr.message}`);
    return mapPlan(updated);
  }

  /**
   * Handle a missed catch-up payment.
   * Normal late fee rules apply. If both catch-ups default, plan status → 'defaulted'.
   */
  static async handleMissedCatchUp(contributionId: string): Promise<PartialContributionPlan | null> {
    const { data: contribution } = await supabase
      .from('cycle_contributions')
      .select('partial_plan_id, contribution_type')
      .eq('id', contributionId)
      .single();

    if (!contribution || contribution.contribution_type !== 'catch_up' || !contribution.partial_plan_id) {
      return null;
    }

    const { data: plan } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('id', contribution.partial_plan_id)
      .single();

    if (!plan) return null;

    // Update the specific catch-up item to 'late' or 'defaulted'
    const updatedSchedule = (plan.catch_up_schedule || []).map((item: any) => {
      if (item.contribution_id === contributionId) {
        return { ...item, status: 'defaulted' };
      }
      return item;
    });

    // Check if all unpaid items are defaulted
    const allDefaulted = updatedSchedule
      .filter((item: any) => item.status !== 'paid')
      .every((item: any) => item.status === 'defaulted');

    const { data: updated, error } = await supabase
      .from('partial_contribution_plans')
      .update({
        catch_up_schedule: updatedSchedule,
        status: allDefaulted ? 'defaulted' : 'active',
      })
      .eq('id', plan.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update plan: ${error.message}`);
    return mapPlan(updated);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION D — Plan Management
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a member's active plan for a specific circle.
   */
  static async getActivePlan(
    userId: string,
    circleId: string
  ): Promise<PartialContributionPlan | null> {
    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('member_id', userId)
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch active plan: ${error.message}`);
    }
    return data ? mapPlan(data) : null;
  }

  /**
   * Get all plans for a member across all circles.
   */
  static async getMemberPlans(userId: string): Promise<PartialContributionPlan[]> {
    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('member_id', userId)
      .order('activated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch member plans: ${error.message}`);
    return (data || []).map(mapPlan);
  }

  /**
   * Get all plans for a circle (admin view).
   */
  static async getCirclePlans(circleId: string): Promise<PartialContributionPlan[]> {
    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('circle_id', circleId)
      .order('activated_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch circle plans: ${error.message}`);
    return (data || []).map(mapPlan);
  }

  /**
   * Get plan details by ID.
   */
  static async getPlanDetails(planId: string): Promise<PartialContributionPlan | null> {
    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }
    return data ? mapPlan(data) : null;
  }

  /**
   * Cancel an active plan.
   * Outstanding catch-up amounts remain due as regular obligations.
   */
  static async cancelPlan(planId: string): Promise<PartialContributionPlan> {
    const plan = await this.getPlanDetails(planId);
    if (!plan) throw new Error('Plan not found.');
    if (plan.status !== 'active') throw new Error('Can only cancel active plans.');

    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) throw new Error(`Failed to cancel plan: ${error.message}`);
    return mapPlan(data);
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION E — Admin / Stats
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get active plans count and summary for a circle.
   */
  static async getActiveCirclePlans(circleId: string): Promise<{
    count: number;
    plans: PartialContributionPlan[];
    totalRemainingCents: number;
  }> {
    const { data, error } = await supabase
      .from('partial_contribution_plans')
      .select('*')
      .eq('circle_id', circleId)
      .eq('status', 'active');

    if (error) throw new Error(`Failed to fetch active plans: ${error.message}`);

    const plans = (data || []).map(mapPlan);
    const totalRemainingCents = plans.reduce((sum, p) => sum + p.remainingAmountCents, 0);

    return {
      count: plans.length,
      plans,
      totalRemainingCents,
    };
  }

  /**
   * Get complete plan history for a member (all statuses).
   */
  static async getMemberPlanHistory(userId: string): Promise<{
    plans: PartialContributionPlan[];
    totalPlans: number;
    completedPlans: number;
    activePlan: PartialContributionPlan | null;
  }> {
    const plans = await this.getMemberPlans(userId);
    const completedPlans = plans.filter((p) => p.status === 'completed').length;
    const activePlan = plans.find((p) => p.status === 'active') || null;

    return {
      plans,
      totalPlans: plans.length,
      completedPlans,
      activePlan,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION F — Realtime
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a member's partial contribution plan changes.
   */
  static subscribeToPlans(userId: string, callback: () => void) {
    return supabase
      .channel(`partial-plans-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partial_contribution_plans',
          filter: `member_id=eq.${userId}`,
        },
        () => callback()
      )
      .subscribe();
  }

  /**
   * Subscribe to circle-level plan changes (admin view).
   */
  static subscribeToCirclePlans(circleId: string, callback: () => void) {
    return supabase
      .channel(`partial-plans-circle-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partial_contribution_plans',
          filter: `circle_id=eq.${circleId}`,
        },
        () => callback()
      )
      .subscribe();
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION G — Notification
  // ─────────────────────────────────────────────────────────────────────────────
  // Bucket A: _notifyCircleAdmin and _requestInsuranceCoverage are deleted.
  // Both lived inside the broken TS activate path and wrote to schemas they
  // didn't match (insurance_coverage_claims requires default-coverage fields
  // that don't exist for partial coverage; the notification_queue write
  // duplicated work the activate_partial_contribution RPC now does
  // server-side, and will be superseded by Bucket C's notify_partial_plan_*
  // trigger).
}
