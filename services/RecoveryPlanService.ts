// services/RecoveryPlanService.ts
// Recovery Plan Service - Manages defaulters' path back to good standing
// Handles payment plans, milestone tracking, and XnScore recovery

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RecoveryPlan {
  id: string;
  userId: string;
  defaultId: string;
  totalDebt: number;
  paymentType: 'lump_sum' | 'installments' | 'pending_selection';
  numberOfInstallments: number | null;
  installmentAmount: number | null;
  installmentFrequency: string | null;
  startDate: string | null;
  expectedCompletionDate: string | null;
  amountPaid: number;
  installmentsPaid: number;
  xnscoreRecoveryMilestones: XnScoreMilestone[];
  milestonesAchieved: number[];
  planStatus: 'offered' | 'accepted' | 'active' | 'completed' | 'defaulted_again' | 'cancelled';
  acceptedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryInstallment {
  id: string;
  recoveryPlanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  installmentStatus: 'pending' | 'paid' | 'late' | 'missed';
  paidAt: string | null;
  paidAmount: number | null;
  paymentReference: string | null;
}

export interface XnScoreMilestone {
  pctPaid: number;
  xnscoreRecovery: number;
}

export interface RecoveryOption {
  id: string;
  type: 'lump_sum' | 'installments';
  amount?: number;
  numberOfInstallments?: number;
  installmentAmount?: number;
  frequency?: string;
  duration?: string;
  xnscoreRecoveryBonus: number;
  description: string;
  benefits?: string[];
  note?: string;
}

export interface RecoveryProgress {
  planId: string;
  totalDebt: number;
  amountPaid: number;
  remainingAmount: number;
  percentComplete: number;
  installmentsPaid: number;
  totalInstallments: number;
  nextInstallment: RecoveryInstallment | null;
  milestonesAchieved: { pctPaid: number; xnscoreRecovery: number; achievedAt: string }[];
  totalXnScoreRecovered: number;
  estimatedCompletionDate: string | null;
}

// ============================================================================
// RECOVERY PLAN SERVICE
// ============================================================================

export class RecoveryPlanService {

  // --------------------------------------------------------------------------
  // PLAN RETRIEVAL
  // --------------------------------------------------------------------------

  /**
   * Get a user's active recovery plan
   */
  async getActiveRecoveryPlan(userId: string): Promise<RecoveryPlan | null> {
    const { data, error } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('user_id', userId)
      .in('plan_status', ['offered', 'accepted', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return this.mapRecoveryPlan(data);
  }

  /**
   * Get recovery plan by ID
   */
  async getRecoveryPlan(planId: string): Promise<RecoveryPlan | null> {
    const { data, error } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error || !data) return null;

    return this.mapRecoveryPlan(data);
  }

  /**
   * Get all recovery plans for a user
   */
  async getUserRecoveryPlans(userId: string): Promise<RecoveryPlan[]> {
    const { data, error } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.mapRecoveryPlan);
  }

  /**
   * Get recovery plan for a specific default
   */
  async getRecoveryPlanByDefault(defaultId: string): Promise<RecoveryPlan | null> {
    const { data, error } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('default_id', defaultId)
      .single();

    if (error || !data) return null;

    return this.mapRecoveryPlan(data);
  }

  private mapRecoveryPlan(data: any): RecoveryPlan {
    return {
      id: data.id,
      userId: data.user_id,
      defaultId: data.default_id,
      totalDebt: data.total_debt,
      paymentType: data.payment_type,
      numberOfInstallments: data.number_of_installments,
      installmentAmount: data.installment_amount,
      installmentFrequency: data.installment_frequency,
      startDate: data.start_date,
      expectedCompletionDate: data.expected_completion_date,
      amountPaid: data.amount_paid || 0,
      installmentsPaid: data.installments_paid || 0,
      xnscoreRecoveryMilestones: data.xnscore_recovery_milestones || [],
      milestonesAchieved: data.milestones_achieved || [],
      planStatus: data.plan_status,
      acceptedAt: data.accepted_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // --------------------------------------------------------------------------
  // PLAN SELECTION & ACCEPTANCE
  // --------------------------------------------------------------------------

  /**
   * Generate recovery options for a debt amount
   */
  generateRecoveryOptions(totalDebt: number): RecoveryOption[] {
    const options: RecoveryOption[] = [];

    // Option 1: Pay in full (best for XnScore)
    options.push({
      id: 'full_immediate',
      type: 'lump_sum',
      amount: totalDebt,
      xnscoreRecoveryBonus: 5,
      description: 'Pay in full now',
      benefits: [
        'Immediate restriction removal',
        'Maximum XnScore recovery (+5 bonus)',
        'Clean slate'
      ]
    });

    // Option 2: 2 payments over 2 weeks
    if (totalDebt >= 50) {
      options.push({
        id: 'biweekly_2',
        type: 'installments',
        numberOfInstallments: 2,
        installmentAmount: Math.ceil(totalDebt / 2 * 100) / 100,
        frequency: 'weekly',
        duration: '2 weeks',
        xnscoreRecoveryBonus: 3,
        description: '2 weekly payments',
        benefits: [
          'Manageable payments',
          'Good XnScore recovery (+3 bonus)',
          'Quick resolution'
        ]
      });
    }

    // Option 3: 4 payments over 4 weeks
    if (totalDebt >= 100) {
      options.push({
        id: 'weekly_4',
        type: 'installments',
        numberOfInstallments: 4,
        installmentAmount: Math.ceil(totalDebt / 4 * 100) / 100,
        frequency: 'weekly',
        duration: '4 weeks',
        xnscoreRecoveryBonus: 0,
        description: '4 weekly payments',
        benefits: [
          'Lower weekly amount',
          'Standard XnScore recovery'
        ]
      });
    }

    // Option 4: Monthly payments (longer term)
    if (totalDebt >= 200) {
      options.push({
        id: 'monthly_3',
        type: 'installments',
        numberOfInstallments: 3,
        installmentAmount: Math.ceil(totalDebt / 3 * 100) / 100,
        frequency: 'monthly',
        duration: '3 months',
        xnscoreRecoveryBonus: 0,
        description: '3 monthly payments',
        note: 'Restrictions remain active during payment period'
      });
    }

    return options;
  }

  /**
   * Accept and configure a recovery plan
   */
  async acceptRecoveryPlan(
    planId: string,
    selectedOptionId: string,
    userId: string
  ): Promise<{ success: boolean; plan?: RecoveryPlan; error?: string }> {
    // Verify plan exists and belongs to user
    const { data: plan, error: fetchError } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !plan) {
      return { success: false, error: 'Recovery plan not found' };
    }

    if (plan.plan_status !== 'offered') {
      return { success: false, error: 'Plan is no longer available for acceptance' };
    }

    // Generate options and find selected
    const options = this.generateRecoveryOptions(plan.total_debt);
    const selectedOption = options.find(o => o.id === selectedOptionId);

    if (!selectedOption) {
      return { success: false, error: 'Invalid option selected' };
    }

    // Calculate dates
    const startDate = new Date();
    let expectedCompletionDate = new Date();

    if (selectedOption.type === 'lump_sum') {
      expectedCompletionDate = startDate;
    } else {
      const weeks = selectedOption.numberOfInstallments! *
        (selectedOption.frequency === 'monthly' ? 4 : 1);
      expectedCompletionDate.setDate(expectedCompletionDate.getDate() + (weeks * 7));
    }

    // Update the plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from('recovery_plans')
      .update({
        payment_type: selectedOption.type,
        number_of_installments: selectedOption.numberOfInstallments || 1,
        installment_amount: selectedOption.installmentAmount || selectedOption.amount,
        installment_frequency: selectedOption.frequency || null,
        start_date: startDate.toISOString(),
        expected_completion_date: expectedCompletionDate.toISOString(),
        plan_status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .select()
      .single();

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Create installment schedule if not lump sum
    if (selectedOption.type === 'installments') {
      await this.createInstallmentSchedule(planId, selectedOption);
    }

    // Notify user
    await supabase.from('scheduled_notifications').insert({
      user_id: userId,
      notification_type: 'recovery_plan_accepted',
      scheduled_for: new Date().toISOString(),
      notification_status: 'pending',
      payload: {
        planId,
        paymentType: selectedOption.type,
        totalDebt: plan.total_debt,
        installmentAmount: selectedOption.installmentAmount || selectedOption.amount
      }
    });

    return {
      success: true,
      plan: this.mapRecoveryPlan(updatedPlan)
    };
  }

  /**
   * Create installment schedule for a plan
   */
  private async createInstallmentSchedule(
    planId: string,
    option: RecoveryOption
  ): Promise<void> {
    const installments: any[] = [];
    let currentDate = new Date();

    for (let i = 1; i <= (option.numberOfInstallments || 1); i++) {
      // Calculate due date
      const dueDate = new Date(currentDate);
      if (option.frequency === 'monthly') {
        dueDate.setMonth(dueDate.getMonth() + 1);
      } else if (option.frequency === 'biweekly') {
        dueDate.setDate(dueDate.getDate() + 14);
      } else {
        dueDate.setDate(dueDate.getDate() + 7);
      }

      installments.push({
        recovery_plan_id: planId,
        installment_number: i,
        amount: option.installmentAmount,
        due_date: dueDate.toISOString(),
        installment_status: 'pending'
      });

      currentDate = dueDate;
    }

    await supabase
      .from('recovery_plan_installments')
      .insert(installments);
  }

  // --------------------------------------------------------------------------
  // PAYMENT PROCESSING
  // --------------------------------------------------------------------------

  /**
   * Process a payment towards a recovery plan
   */
  async processPayment(
    planId: string,
    amount: number,
    paymentReference: string
  ): Promise<{ success: boolean; progress?: RecoveryProgress; error?: string }> {
    const plan = await this.getRecoveryPlan(planId);
    if (!plan) {
      return { success: false, error: 'Recovery plan not found' };
    }

    if (!['accepted', 'active'].includes(plan.planStatus)) {
      return { success: false, error: 'Plan is not in payable status' };
    }

    const newAmountPaid = plan.amountPaid + amount;
    const pctPaid = (newAmountPaid / plan.totalDebt) * 100;

    // Update plan status if first payment
    let newStatus = plan.planStatus;
    if (plan.planStatus === 'accepted') {
      newStatus = 'active';
    }

    // Check if completed
    if (newAmountPaid >= plan.totalDebt) {
      newStatus = 'completed';
    }

    // Update plan
    await supabase
      .from('recovery_plans')
      .update({
        amount_paid: newAmountPaid,
        installments_paid: plan.installmentsPaid + 1,
        plan_status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', planId);

    // Update corresponding installment if exists
    if (plan.paymentType === 'installments') {
      const { data: nextInstallment } = await supabase
        .from('recovery_plan_installments')
        .select('*')
        .eq('recovery_plan_id', planId)
        .eq('installment_status', 'pending')
        .order('installment_number', { ascending: true })
        .limit(1)
        .single();

      if (nextInstallment) {
        await supabase
          .from('recovery_plan_installments')
          .update({
            installment_status: 'paid',
            paid_at: new Date().toISOString(),
            paid_amount: amount,
            payment_reference: paymentReference
          })
          .eq('id', nextInstallment.id);
      }
    }

    // Check and award XnScore milestones
    await this.checkAndAwardMilestones(plan, pctPaid);

    // If completed, finalize recovery
    if (newStatus === 'completed') {
      await this.completeRecovery(plan);
    }

    // Get updated progress
    const progress = await this.getRecoveryProgress(planId);

    return { success: true, progress: progress || undefined };
  }

  /**
   * Check and award XnScore recovery milestones
   */
  private async checkAndAwardMilestones(plan: RecoveryPlan, pctPaid: number): Promise<void> {
    const achievedMilestones = plan.milestonesAchieved || [];

    for (const milestone of plan.xnscoreRecoveryMilestones) {
      // Skip if already achieved
      if (achievedMilestones.includes(milestone.pctPaid)) continue;

      // Check if milestone reached
      if (pctPaid >= milestone.pctPaid) {
        // Award XnScore recovery
        const { data: currentScore } = await supabase
          .from('xn_score_history')
          .select('new_score')
          .eq('user_id', plan.userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const prevScore = currentScore?.new_score || 500;
        const newScore = prevScore + milestone.xnscoreRecovery;

        await supabase
          .from('xn_score_history')
          .insert({
            user_id: plan.userId,
            previous_score: prevScore,
            change_amount: milestone.xnscoreRecovery,
            new_score: newScore,
            change_reason: 'recovery_milestone',
            reference_type: 'recovery_plan',
            reference_id: plan.id
          });

        // Update achieved milestones
        const newAchieved = [...achievedMilestones, milestone.pctPaid];
        await supabase
          .from('recovery_plans')
          .update({
            milestones_achieved: newAchieved,
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id);

        // Notify user
        await supabase.from('scheduled_notifications').insert({
          user_id: plan.userId,
          notification_type: 'recovery_milestone_reached',
          scheduled_for: new Date().toISOString(),
          notification_status: 'pending',
          payload: {
            planId: plan.id,
            milestone: milestone.pctPaid,
            xnscoreRecovered: milestone.xnscoreRecovery,
            newScore
          }
        });
      }
    }
  }

  /**
   * Complete the recovery process
   */
  private async completeRecovery(plan: RecoveryPlan): Promise<void> {
    // Update the default to fully recovered
    await supabase
      .from('defaults')
      .update({
        default_status: 'fully_recovered',
        amount_recovered: plan.totalDebt,
        resolved_at: new Date().toISOString(),
        resolution_type: 'paid_in_full',
        updated_at: new Date().toISOString()
      })
      .eq('id', plan.defaultId);

    // Lift restrictions
    await supabase
      .from('user_restrictions')
      .update({
        status: 'lifted',
        lifted_at: new Date().toISOString(),
        lifted_reason: 'debt_fully_repaid',
        updated_at: new Date().toISOString()
      })
      .eq('default_id', plan.defaultId)
      .eq('status', 'active');

    // Check for other unresolved defaults
    const { count: otherDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', plan.userId)
      .eq('default_status', 'unresolved');

    // If no other defaults, fully restore user
    if ((otherDefaults || 0) === 0) {
      await supabase
        .from('profiles')
        .update({
          has_active_restrictions: false,
          restriction_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', plan.userId);
    }

    // Send completion notification
    await supabase.from('scheduled_notifications').insert({
      user_id: plan.userId,
      notification_type: 'recovery_completed',
      scheduled_for: new Date().toISOString(),
      notification_status: 'pending',
      payload: {
        planId: plan.id,
        totalPaid: plan.totalDebt,
        restrictionsLifted: true
      }
    });
  }

  // --------------------------------------------------------------------------
  // PROGRESS TRACKING
  // --------------------------------------------------------------------------

  /**
   * Get detailed recovery progress
   */
  async getRecoveryProgress(planId: string): Promise<RecoveryProgress | null> {
    const plan = await this.getRecoveryPlan(planId);
    if (!plan) return null;

    // Get installments
    const { data: installments } = await supabase
      .from('recovery_plan_installments')
      .select('*')
      .eq('recovery_plan_id', planId)
      .order('installment_number', { ascending: true });

    // Find next pending installment
    const nextInstallment = (installments || []).find(i => i.installment_status === 'pending');

    // Calculate milestone achievements
    const milestonesAchieved = plan.xnscoreRecoveryMilestones
      .filter(m => (plan.milestonesAchieved || []).includes(m.pctPaid))
      .map(m => ({
        pctPaid: m.pctPaid,
        xnscoreRecovery: m.xnscoreRecovery,
        achievedAt: '' // Would need to track this
      }));

    const totalXnScoreRecovered = milestonesAchieved.reduce(
      (sum, m) => sum + m.xnscoreRecovery, 0
    );

    return {
      planId: plan.id,
      totalDebt: plan.totalDebt,
      amountPaid: plan.amountPaid,
      remainingAmount: plan.totalDebt - plan.amountPaid,
      percentComplete: Math.round((plan.amountPaid / plan.totalDebt) * 100),
      installmentsPaid: plan.installmentsPaid,
      totalInstallments: plan.numberOfInstallments || 1,
      nextInstallment: nextInstallment ? {
        id: nextInstallment.id,
        recoveryPlanId: nextInstallment.recovery_plan_id,
        installmentNumber: nextInstallment.installment_number,
        amount: nextInstallment.amount,
        dueDate: nextInstallment.due_date,
        installmentStatus: nextInstallment.installment_status,
        paidAt: nextInstallment.paid_at,
        paidAmount: nextInstallment.paid_amount,
        paymentReference: nextInstallment.payment_reference
      } : null,
      milestonesAchieved,
      totalXnScoreRecovered,
      estimatedCompletionDate: plan.expectedCompletionDate
    };
  }

  /**
   * Get upcoming installments for a user
   */
  async getUserUpcomingInstallments(userId: string): Promise<any[]> {
    // First get user's active plans
    const { data: plans } = await supabase
      .from('recovery_plans')
      .select('id')
      .eq('user_id', userId)
      .eq('plan_status', 'active');

    if (!plans || plans.length === 0) return [];

    const planIds = plans.map(p => p.id);

    // Get pending installments
    const { data: installments } = await supabase
      .from('recovery_plan_installments')
      .select(`
        *,
        recovery_plans (
          total_debt,
          defaults (
            circle_id,
            circles (name)
          )
        )
      `)
      .in('recovery_plan_id', planIds)
      .eq('installment_status', 'pending')
      .order('due_date', { ascending: true })
      .limit(5);

    return (installments || []).map(i => ({
      installmentId: i.id,
      planId: i.recovery_plan_id,
      installmentNumber: i.installment_number,
      amount: i.amount,
      dueDate: i.due_date,
      circleName: (i.recovery_plans as any)?.defaults?.circles?.name || 'Unknown',
      totalDebt: (i.recovery_plans as any)?.total_debt
    }));
  }

  // --------------------------------------------------------------------------
  // PLAN MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Cancel a recovery plan
   */
  async cancelPlan(planId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('recovery_plans')
      .update({
        plan_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .in('plan_status', ['offered', 'accepted']);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Process overdue installments (called by cron)
   */
  async processOverdueInstallments(): Promise<{ processed: number; marked: number }> {
    // Find overdue pending installments
    const { data: overdue } = await supabase
      .from('recovery_plan_installments')
      .select(`
        *,
        recovery_plans (id, user_id, plan_status)
      `)
      .eq('installment_status', 'pending')
      .lt('due_date', new Date().toISOString());

    if (!overdue || overdue.length === 0) {
      return { processed: 0, marked: 0 };
    }

    let marked = 0;

    for (const installment of overdue) {
      // Mark as late
      await supabase
        .from('recovery_plan_installments')
        .update({ installment_status: 'late' })
        .eq('id', installment.id);

      marked++;

      // Notify user
      const plan = installment.recovery_plans as any;
      if (plan && plan.user_id) {
        await supabase.from('scheduled_notifications').insert({
          user_id: plan.user_id,
          notification_type: 'recovery_installment_overdue',
          scheduled_for: new Date().toISOString(),
          notification_status: 'pending',
          payload: {
            planId: plan.id,
            installmentNumber: installment.installment_number,
            amount: installment.amount,
            dueDate: installment.due_date
          }
        });
      }
    }

    return { processed: overdue.length, marked };
  }

  /**
   * Mark plans with too many missed payments as defaulted again
   */
  async processMissedPaymentPlans(): Promise<number> {
    // Get plans with 2+ late installments
    const { data: problematicPlans } = await supabase
      .from('recovery_plans')
      .select(`
        id,
        user_id,
        default_id,
        recovery_plan_installments!inner (
          installment_status
        )
      `)
      .eq('plan_status', 'active');

    if (!problematicPlans) return 0;

    let count = 0;

    for (const plan of problematicPlans) {
      const lateCount = (plan.recovery_plan_installments as any[])
        .filter(i => i.installment_status === 'late').length;

      if (lateCount >= 2) {
        // Mark plan as defaulted again
        await supabase
          .from('recovery_plans')
          .update({
            plan_status: 'defaulted_again',
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.id);

        // Notify user
        await supabase.from('scheduled_notifications').insert({
          user_id: plan.user_id,
          notification_type: 'recovery_plan_defaulted',
          scheduled_for: new Date().toISOString(),
          notification_status: 'pending',
          payload: {
            planId: plan.id,
            missedPayments: lateCount
          }
        });

        // This might trigger additional consequences
        // Alert ops for review
        await supabase.from('ops_alerts').insert({
          alert_type: 'recovery_plan_defaulted',
          alert_status: 'pending',
          details: {
            planId: plan.id,
            userId: plan.user_id,
            defaultId: plan.default_id,
            missedPayments: lateCount
          }
        });

        count++;
      }
    }

    return count;
  }

  // --------------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------------

  /**
   * Get recovery plan statistics
   */
  async getRecoveryStats(daysPeriod: number = 90): Promise<{
    totalPlansCreated: number;
    plansAccepted: number;
    plansCompleted: number;
    plansDefaulted: number;
    totalDebtRecovered: number;
    avgRecoveryRate: number;
    avgTimeToComplete: number;
    mostChosenOption: string;
  }> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - daysPeriod);

    const { data: plans } = await supabase
      .from('recovery_plans')
      .select('*')
      .gte('created_at', periodStart.toISOString());

    if (!plans || plans.length === 0) {
      return {
        totalPlansCreated: 0,
        plansAccepted: 0,
        plansCompleted: 0,
        plansDefaulted: 0,
        totalDebtRecovered: 0,
        avgRecoveryRate: 0,
        avgTimeToComplete: 0,
        mostChosenOption: 'N/A'
      };
    }

    const completed = plans.filter(p => p.plan_status === 'completed');
    const accepted = plans.filter(p => ['accepted', 'active', 'completed'].includes(p.plan_status));
    const defaulted = plans.filter(p => p.plan_status === 'defaulted_again');

    const totalDebt = plans.reduce((sum, p) => sum + (p.total_debt || 0), 0);
    const totalPaid = plans.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    // Calculate avg time to complete
    let totalDays = 0;
    for (const plan of completed) {
      if (plan.accepted_at && plan.completed_at) {
        const acceptedDate = new Date(plan.accepted_at);
        const completedDate = new Date(plan.completed_at);
        totalDays += (completedDate.getTime() - acceptedDate.getTime()) / (1000 * 60 * 60 * 24);
      }
    }
    const avgTimeToComplete = completed.length > 0 ? totalDays / completed.length : 0;

    // Most chosen option
    const optionCounts: Record<string, number> = {};
    for (const plan of accepted) {
      const key = `${plan.payment_type}_${plan.number_of_installments || 1}`;
      optionCounts[key] = (optionCounts[key] || 0) + 1;
    }
    const mostChosenOption = Object.keys(optionCounts).length > 0
      ? Object.entries(optionCounts).sort((a, b) => b[1] - a[1])[0][0]
      : 'N/A';

    return {
      totalPlansCreated: plans.length,
      plansAccepted: accepted.length,
      plansCompleted: completed.length,
      plansDefaulted: defaulted.length,
      totalDebtRecovered: totalPaid,
      avgRecoveryRate: totalDebt > 0 ? Math.round((totalPaid / totalDebt) * 100) : 0,
      avgTimeToComplete: Math.round(avgTimeToComplete),
      mostChosenOption
    };
  }
}

// Export singleton instance
export const recoveryPlanService = new RecoveryPlanService();
