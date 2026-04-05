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

    // Check contribution deadline
    const { data: cycle, error: cycleErr } = await supabase
      .from('circle_cycles')
      .select('contribution_deadline, status')
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
   * Get a preview summary of what partial contribution would look like.
   * Does NOT activate — just calculates and returns the summary.
   */
  static async getActivationSummary(
    userId: string,
    circleId: string,
    cycleId: string
  ): Promise<PartialContributionSummary> {
    // Get the current contribution
    const { data: contribution, error: contribErr } = await supabase
      .from('cycle_contributions')
      .select('expected_amount')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .single();

    if (contribErr || !contribution) {
      throw new Error('Contribution record not found for this cycle.');
    }

    const originalCents = Math.round(contribution.expected_amount * 100);
    const payNowCents = Math.round(originalCents * 0.5);
    const catchUp1Cents = Math.round(originalCents * 0.25);
    const catchUp2Cents = originalCents - payNowCents - catchUp1Cents; // Remainder to avoid rounding issues

    // Get the next two cycles
    const { data: currentCycle } = await supabase
      .from('circle_cycles')
      .select('cycle_number')
      .eq('id', cycleId)
      .single();

    if (!currentCycle) throw new Error('Current cycle not found.');

    const { data: nextCycles, error: nextErr } = await supabase
      .from('circle_cycles')
      .select('cycle_number, contribution_deadline, expected_amount')
      .eq('circle_id', circleId)
      .gt('cycle_number', currentCycle.cycle_number)
      .order('cycle_number')
      .limit(2);

    if (nextErr) throw new Error(`Failed to fetch next cycles: ${nextErr.message}`);

    if (!nextCycles || nextCycles.length < 2) {
      throw new Error('Not enough future cycles available for catch-up scheduling. At least 2 more cycles are required.');
    }

    // Fee check
    const eligibility = await this.checkEligibility(userId, circleId, cycleId);
    const regularContributionCents = Math.round(nextCycles[0].expected_amount * 100);

    return {
      originalAmount: originalCents / 100,
      payNowAmount: payNowCents / 100,
      catchUp1Amount: catchUp1Cents / 100,
      catchUp1Date: nextCycles[0].contribution_deadline,
      catchUp1CycleNumber: nextCycles[0].cycle_number,
      catchUp2Amount: catchUp2Cents / 100,
      catchUp2Date: nextCycles[1].contribution_deadline,
      catchUp2CycleNumber: nextCycles[1].cycle_number,
      regularContribution: regularContributionCents / 100,
      totalNextCycle: (regularContributionCents + catchUp1Cents) / 100,
      totalCycleAfter: (regularContributionCents + catchUp2Cents) / 100,
      feeCents: eligibility.feeCents,
      usesThisYear: eligibility.usesThisYear,
    };
  }

  /**
   * Activate partial contribution mode for a member.
   *
   * 1. Checks eligibility
   * 2. Calculates 50/25/25 split
   * 3. Updates current contribution to partial
   * 4. Creates plan record with catch-up schedule
   * 5. Creates two catch-up contribution records
   * 6. Triggers insurance pool coverage for shortfall
   * 7. Notifies circle admin (identity-protected)
   */
  static async activatePartialContribution(
    userId: string,
    circleId: string,
    cycleId: string
  ): Promise<PartialActivationResult> {
    // 1. Check eligibility
    const eligibility = await this.checkEligibility(userId, circleId, cycleId);
    if (!eligibility.eligible) {
      throw new Error(eligibility.reason || 'Not eligible for partial contribution.');
    }

    // 2. Get the current contribution
    const { data: contribution, error: contribErr } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('user_id', userId)
      .single();

    if (contribErr || !contribution) {
      throw new Error('Contribution record not found.');
    }

    const originalCents = Math.round(contribution.expected_amount * 100);
    const payNowCents = Math.round(originalCents * 0.5);
    const catchUp1Cents = Math.round(originalCents * 0.25);
    const catchUp2Cents = originalCents - payNowCents - catchUp1Cents;

    // 3. Get next two cycles
    const { data: currentCycle } = await supabase
      .from('circle_cycles')
      .select('cycle_number')
      .eq('id', cycleId)
      .single();

    if (!currentCycle) throw new Error('Current cycle not found.');

    const { data: nextCycles } = await supabase
      .from('circle_cycles')
      .select('id, cycle_number, contribution_deadline, expected_amount')
      .eq('circle_id', circleId)
      .gt('cycle_number', currentCycle.cycle_number)
      .order('cycle_number')
      .limit(2);

    if (!nextCycles || nextCycles.length < 2) {
      throw new Error('Not enough future cycles for catch-up scheduling.');
    }

    // 4. Create the plan record first (needed for FK)
    const catchUpSchedule = [
      {
        cycle_number: nextCycles[0].cycle_number,
        amount_cents: catchUp1Cents,
        due_date: nextCycles[0].contribution_deadline,
        contribution_id: null, // Will be updated after creating catch-up contributions
        status: 'scheduled',
      },
      {
        cycle_number: nextCycles[1].cycle_number,
        amount_cents: catchUp2Cents,
        due_date: nextCycles[1].contribution_deadline,
        contribution_id: null,
        status: 'scheduled',
      },
    ];

    const { data: plan, error: planErr } = await supabase
      .from('partial_contribution_plans')
      .insert({
        member_id: userId,
        circle_id: circleId,
        cycle_id: cycleId,
        original_amount_cents: originalCents,
        paid_amount_cents: payNowCents,
        remaining_amount_cents: catchUp1Cents + catchUp2Cents,
        catch_up_schedule: catchUpSchedule,
        fee_cents: eligibility.feeCents,
        uses_this_year: eligibility.usesThisYear + 1,
        status: 'active',
      })
      .select()
      .single();

    if (planErr) throw new Error(`Failed to create plan: ${planErr.message}`);

    // 5. Update current contribution to partial
    const { error: updateErr } = await supabase
      .from('cycle_contributions')
      .update({
        is_partial: true,
        partial_plan_id: plan.id,
        contribution_type: 'partial',
        contributed_amount: payNowCents / 100,
        status: 'partial',
        covered_by: 'insurance_pool',
        covered_amount: (catchUp1Cents + catchUp2Cents) / 100,
      })
      .eq('id', contribution.id);

    if (updateErr) throw new Error(`Failed to update contribution: ${updateErr.message}`);

    // 6. Create two catch-up contribution records
    const catchUpContributions = [];

    for (let i = 0; i < nextCycles.length; i++) {
      const catchUpAmount = i === 0 ? catchUp1Cents : catchUp2Cents;

      const { data: catchUpContrib, error: catchErr } = await supabase
        .from('cycle_contributions')
        .insert({
          cycle_id: nextCycles[i].id,
          circle_id: circleId,
          user_id: userId,
          member_id: contribution.member_id,
          expected_amount: catchUpAmount / 100,
          due_date: nextCycles[i].contribution_deadline,
          contributed_amount: 0,
          status: 'pending',
          is_partial: false,
          partial_plan_id: plan.id,
          contribution_type: 'catch_up',
        })
        .select()
        .single();

      if (catchErr) {
        console.warn(`[PartialContribution] Failed to create catch-up ${i + 1}:`, catchErr);
        continue;
      }

      catchUpContributions.push(catchUpContrib);

      // Update the plan's catch_up_schedule with the contribution ID
      catchUpSchedule[i].contribution_id = catchUpContrib.id;
    }

    // Update plan with contribution IDs in schedule
    await supabase
      .from('partial_contribution_plans')
      .update({ catch_up_schedule: catchUpSchedule })
      .eq('id', plan.id);

    // 7. Request insurance pool coverage for the shortfall
    try {
      await this._requestInsuranceCoverage(
        circleId,
        contribution.id,
        (catchUp1Cents + catchUp2Cents) / 100
      );
    } catch (err) {
      console.warn('[PartialContribution] Insurance coverage request failed:', err);
      // Non-fatal — plan still activates
    }

    // 8. Notify circle admin (identity-protected)
    try {
      await this._notifyCircleAdmin(circleId, currentCycle.cycle_number);
    } catch (err) {
      console.warn('[PartialContribution] Admin notification failed:', err);
    }

    // Build summary for return
    const regularContributionCents = Math.round(nextCycles[0].expected_amount * 100);
    const summary: PartialContributionSummary = {
      originalAmount: originalCents / 100,
      payNowAmount: payNowCents / 100,
      catchUp1Amount: catchUp1Cents / 100,
      catchUp1Date: nextCycles[0].contribution_deadline,
      catchUp1CycleNumber: nextCycles[0].cycle_number,
      catchUp2Amount: catchUp2Cents / 100,
      catchUp2Date: nextCycles[1].contribution_deadline,
      catchUp2CycleNumber: nextCycles[1].cycle_number,
      regularContribution: regularContributionCents / 100,
      totalNextCycle: (regularContributionCents + catchUp1Cents) / 100,
      totalCycleAfter: (regularContributionCents + catchUp2Cents) / 100,
      feeCents: eligibility.feeCents,
      usesThisYear: eligibility.usesThisYear + 1,
    };

    return {
      plan: mapPlan(plan),
      summary,
      catchUpContributionIds: catchUpContributions.map((c: any) => c.id),
    };
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
  // SECTION G — Notification (Private)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Notify circle admin that a member activated partial mode.
   * Identity-protected: does NOT reveal which member.
   */
  private static async _notifyCircleAdmin(
    circleId: string,
    cycleNumber: number
  ): Promise<void> {
    // Find circle admins/creators
    const { data: admins } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .in('role', ['creator', 'admin']);

    if (!admins || admins.length === 0) return;

    const notifications = admins.map((admin: any) => ({
      member_id: admin.user_id,
      notification_type: 'circle_events',
      title: 'Contribution Flexibility Activated',
      body: `A member has activated contribution flexibility for cycle ${cycleNumber}. The circle timeline is not affected.`,
      data: {
        circle_id: circleId,
        cycle_number: cycleNumber,
        type: 'partial_contribution_activated',
      },
      status: 'pending',
    }));

    const { error } = await supabase
      .from('notification_queue')
      .insert(notifications);

    if (error) {
      console.warn('[PartialContribution] Failed to notify admins:', error);
    }
  }

  /**
   * Request insurance pool coverage for the partial contribution shortfall.
   */
  private static async _requestInsuranceCoverage(
    circleId: string,
    contributionId: string,
    shortfallAmount: number
  ): Promise<void> {
    // Insert a coverage claim into the insurance pool
    const { data: pool } = await supabase
      .from('circle_insurance_pools')
      .select('id, balance_cents, status')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .single();

    if (!pool) {
      console.warn('[PartialContribution] No active insurance pool for circle');
      return;
    }

    const shortfallCents = Math.round(shortfallAmount * 100);

    // Create coverage claim
    const { error: claimErr } = await supabase
      .from('insurance_coverage_claims')
      .insert({
        pool_id: pool.id,
        circle_id: circleId,
        claimant_contribution_id: contributionId,
        claim_amount_cents: shortfallCents,
        approved_amount_cents: Math.min(shortfallCents, pool.balance_cents),
        claim_type: 'partial_contribution',
        status: 'approved',
        reason: 'Automatic coverage for partial contribution shortfall',
      });

    if (claimErr) {
      console.warn('[PartialContribution] Failed to create coverage claim:', claimErr);
      return;
    }

    // Deduct from pool balance
    const { error: deductErr } = await supabase
      .from('circle_insurance_pools')
      .update({
        balance_cents: pool.balance_cents - Math.min(shortfallCents, pool.balance_cents),
        total_paid_out_cents: (pool.total_paid_out_cents || 0) + Math.min(shortfallCents, pool.balance_cents),
        total_claims: (pool.total_claims || 0) + 1,
        approved_claims: (pool.approved_claims || 0) + 1,
      })
      .eq('id', pool.id);

    if (deductErr) {
      console.warn('[PartialContribution] Failed to deduct from pool:', deductErr);
    }
  }
}
