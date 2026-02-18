// services/PaymentPlanService.ts
// Payment Plan Service - Creates and manages payment plans for late contributions
// Handles installment scheduling, payment processing, and plan lifecycle

import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PaymentPlan {
  id: string;
  late_contribution_id: string;
  user_id: string;
  total_amount: number;
  num_installments: number;
  installment_amount: number;
  plan_status: 'proposed' | 'accepted' | 'active' | 'completed' | 'defaulted' | 'cancelled';
  proposed_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentPlanInstallment {
  id: string;
  plan_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  installment_status: 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
  paid_amount: number;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanOptions {
  lateContributionId: string;
  userId: string;
  totalAmount: number;
  numInstallments: number;
  startDate?: Date;
  includeFees?: boolean;
}

export interface PlanProposal {
  plan: PaymentPlan;
  installments: PaymentPlanInstallment[];
  monthlyPayment: number;
  totalWithFees: number;
}

export interface PaymentResult {
  success: boolean;
  installmentId: string;
  amountPaid: number;
  remainingBalance: number;
  planCompleted: boolean;
  error?: string;
}

// ============================================================================
// PAYMENT PLAN SERVICE
// ============================================================================

export class PaymentPlanService {

  // --------------------------------------------------------------------------
  // PLAN CREATION
  // --------------------------------------------------------------------------

  /**
   * Create a payment plan proposal for a late contribution
   */
  async createPlanProposal(options: CreatePlanOptions): Promise<PlanProposal> {
    const {
      lateContributionId,
      userId,
      totalAmount,
      numInstallments,
      startDate = new Date(),
      includeFees = true
    } = options;

    // Validate inputs
    if (numInstallments < 2 || numInstallments > 12) {
      throw new Error('Payment plans must have between 2 and 12 installments');
    }

    // Calculate fees if applicable
    let totalWithFees = totalAmount;
    if (includeFees) {
      // Get late fee from late_contributions
      const { data: lateContribution } = await supabase
        .from('late_contributions')
        .select('late_fee')
        .eq('id', lateContributionId)
        .single();

      if (lateContribution?.late_fee) {
        totalWithFees += lateContribution.late_fee;
      }
    }

    // Calculate installment amount (rounded up to nearest cent)
    const installmentAmount = Math.ceil((totalWithFees / numInstallments) * 100) / 100;

    // Create the payment plan
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .insert({
        late_contribution_id: lateContributionId,
        user_id: userId,
        total_amount: totalWithFees,
        num_installments: numInstallments,
        installment_amount: installmentAmount,
        plan_status: 'proposed',
        proposed_at: new Date().toISOString(),
        next_due_date: this.calculateNextDueDate(startDate)
      })
      .select()
      .single();

    if (planError) {
      throw new Error(`Failed to create payment plan: ${planError.message}`);
    }

    // Create installments
    const installments = await this.createInstallments(plan.id, numInstallments, installmentAmount, startDate);

    return {
      plan,
      installments,
      monthlyPayment: installmentAmount,
      totalWithFees
    };
  }

  /**
   * Create installment records for a payment plan
   */
  private async createInstallments(
    planId: string,
    numInstallments: number,
    installmentAmount: number,
    startDate: Date
  ): Promise<PaymentPlanInstallment[]> {
    const installments: Partial<PaymentPlanInstallment>[] = [];
    let currentDate = new Date(startDate);

    for (let i = 1; i <= numInstallments; i++) {
      // Each installment due 1 week apart
      const dueDate = new Date(currentDate);
      dueDate.setDate(dueDate.getDate() + (i * 7));

      installments.push({
        plan_id: planId,
        installment_number: i,
        amount: installmentAmount,
        due_date: dueDate.toISOString(),
        installment_status: 'pending',
        paid_amount: 0
      });
    }

    const { data, error } = await supabase
      .from('payment_plan_installments')
      .insert(installments)
      .select();

    if (error) {
      throw new Error(`Failed to create installments: ${error.message}`);
    }

    return data;
  }

  // --------------------------------------------------------------------------
  // PLAN LIFECYCLE
  // --------------------------------------------------------------------------

  /**
   * Accept a proposed payment plan
   */
  async acceptPlan(planId: string): Promise<PaymentPlan> {
    const { data: plan, error } = await supabase
      .from('payment_plans')
      .update({
        plan_status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', planId)
      .eq('plan_status', 'proposed')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to accept payment plan: ${error.message}`);
    }

    // Update late contribution status
    await supabase
      .from('late_contributions')
      .update({
        late_status: 'payment_plan',
        updated_at: new Date().toISOString()
      })
      .eq('id', plan.late_contribution_id);

    // Log event
    await this.logPlanEvent(plan.late_contribution_id, 'payment_plan_accepted', {
      plan_id: planId,
      num_installments: plan.num_installments,
      installment_amount: plan.installment_amount
    });

    return plan;
  }

  /**
   * Start a payment plan (begins the collection period)
   */
  async startPlan(planId: string): Promise<PaymentPlan> {
    // Get the first installment
    const { data: firstInstallment } = await supabase
      .from('payment_plan_installments')
      .select('due_date')
      .eq('plan_id', planId)
      .eq('installment_number', 1)
      .single();

    const { data: plan, error } = await supabase
      .from('payment_plans')
      .update({
        plan_status: 'active',
        started_at: new Date().toISOString(),
        next_due_date: firstInstallment?.due_date
      })
      .eq('id', planId)
      .eq('plan_status', 'accepted')
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to start payment plan: ${error.message}`);
    }

    // Schedule reminder notification
    await this.scheduleInstallmentReminder(planId, 1);

    return plan;
  }

  /**
   * Cancel a payment plan
   */
  async cancelPlan(planId: string, reason: string): Promise<PaymentPlan> {
    const { data: plan, error } = await supabase
      .from('payment_plans')
      .update({
        plan_status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to cancel payment plan: ${error.message}`);
    }

    // Log event
    await this.logPlanEvent(plan.late_contribution_id, 'payment_plan_cancelled', {
      plan_id: planId,
      reason
    });

    return plan;
  }

  // --------------------------------------------------------------------------
  // INSTALLMENT PROCESSING
  // --------------------------------------------------------------------------

  /**
   * Record a payment against an installment
   */
  async recordInstallmentPayment(
    installmentId: string,
    amount: number,
    paymentReference: string
  ): Promise<PaymentResult> {
    // Get installment details
    const { data: installment, error: fetchError } = await supabase
      .from('payment_plan_installments')
      .select(`
        *,
        payment_plans (
          id,
          total_amount,
          num_installments,
          late_contribution_id,
          user_id
        )
      `)
      .eq('id', installmentId)
      .single();

    if (fetchError || !installment) {
      return {
        success: false,
        installmentId,
        amountPaid: 0,
        remainingBalance: 0,
        planCompleted: false,
        error: 'Installment not found'
      };
    }

    const plan = installment.payment_plans;
    const newPaidAmount = installment.paid_amount + amount;
    const isFullyPaid = newPaidAmount >= installment.amount;

    // Update installment
    const { error: updateError } = await supabase
      .from('payment_plan_installments')
      .update({
        paid_amount: newPaidAmount,
        installment_status: isFullyPaid ? 'paid' : 'partial',
        paid_at: isFullyPaid ? new Date().toISOString() : null,
        payment_reference: paymentReference,
        updated_at: new Date().toISOString()
      })
      .eq('id', installmentId);

    if (updateError) {
      return {
        success: false,
        installmentId,
        amountPaid: 0,
        remainingBalance: installment.amount - installment.paid_amount,
        planCompleted: false,
        error: updateError.message
      };
    }

    // Log event
    await this.logPlanEvent(plan.late_contribution_id, 'installment_payment_received', {
      installment_id: installmentId,
      installment_number: installment.installment_number,
      amount_paid: amount,
      total_paid: newPaidAmount,
      fully_paid: isFullyPaid
    });

    // Check if plan is completed
    const planCompleted = await this.checkPlanCompletion(plan.id);

    // Update next due date if needed
    if (isFullyPaid && !planCompleted) {
      await this.updateNextDueDate(plan.id, installment.installment_number + 1);
    }

    // Calculate remaining balance
    const remainingBalance = await this.calculateRemainingBalance(plan.id);

    return {
      success: true,
      installmentId,
      amountPaid: amount,
      remainingBalance,
      planCompleted
    };
  }

  /**
   * Check if all installments are paid and complete the plan
   */
  private async checkPlanCompletion(planId: string): Promise<boolean> {
    const { data: unpaidInstallments, error } = await supabase
      .from('payment_plan_installments')
      .select('id')
      .eq('plan_id', planId)
      .not('installment_status', 'in', '("paid","waived")')
      .limit(1);

    if (error || !unpaidInstallments) {
      return false;
    }

    // All installments paid
    if (unpaidInstallments.length === 0) {
      // Get plan to access late_contribution_id
      const { data: plan } = await supabase
        .from('payment_plans')
        .select('late_contribution_id')
        .eq('id', planId)
        .single();

      // Complete the plan
      await supabase
        .from('payment_plans')
        .update({
          plan_status: 'completed',
          completed_at: new Date().toISOString(),
          next_due_date: null
        })
        .eq('id', planId);

      // Resolve the late contribution
      if (plan) {
        await supabase
          .from('late_contributions')
          .update({
            late_status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_type: 'payment_plan_completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', plan.late_contribution_id);

        await this.logPlanEvent(plan.late_contribution_id, 'payment_plan_completed', {
          plan_id: planId
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Calculate remaining balance on a payment plan
   */
  async calculateRemainingBalance(planId: string): Promise<number> {
    const { data: installments } = await supabase
      .from('payment_plan_installments')
      .select('amount, paid_amount')
      .eq('plan_id', planId);

    if (!installments) return 0;

    const totalOwed = installments.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = installments.reduce((sum, i) => sum + i.paid_amount, 0);

    return totalOwed - totalPaid;
  }

  // --------------------------------------------------------------------------
  // OVERDUE PROCESSING
  // --------------------------------------------------------------------------

  /**
   * Process all overdue installments
   */
  async processOverdueInstallments(): Promise<{ processed: number; defaulted: number }> {
    const now = new Date().toISOString();

    // Find overdue installments
    const { data: overdueInstallments, error } = await supabase
      .from('payment_plan_installments')
      .select(`
        *,
        payment_plans (
          id,
          late_contribution_id,
          user_id
        )
      `)
      .in('installment_status', ['pending', 'partial'])
      .lt('due_date', now);

    if (error || !overdueInstallments) {
      return { processed: 0, defaulted: 0 };
    }

    let processed = 0;
    let defaulted = 0;

    for (const installment of overdueInstallments) {
      // Mark as overdue
      await supabase
        .from('payment_plan_installments')
        .update({
          installment_status: 'overdue',
          updated_at: new Date().toISOString()
        })
        .eq('id', installment.id);

      // Check if this is the third consecutive missed payment
      const missedCount = await this.countConsecutiveMissed(installment.plan_id, installment.installment_number);

      if (missedCount >= 3) {
        // Default the entire plan
        await this.defaultPlan(installment.plan_id);
        defaulted++;
      } else {
        // Send overdue notification
        await this.sendOverdueNotification(installment);
      }

      processed++;
    }

    return { processed, defaulted };
  }

  /**
   * Count consecutive missed installments
   */
  private async countConsecutiveMissed(planId: string, upToInstallment: number): Promise<number> {
    const { data: installments } = await supabase
      .from('payment_plan_installments')
      .select('installment_number, installment_status')
      .eq('plan_id', planId)
      .lte('installment_number', upToInstallment)
      .order('installment_number', { ascending: false });

    if (!installments) return 0;

    let count = 0;
    for (const installment of installments) {
      if (installment.installment_status === 'overdue') {
        count++;
      } else if (installment.installment_status === 'paid') {
        break;
      }
    }

    return count;
  }

  /**
   * Default a payment plan due to non-payment
   */
  private async defaultPlan(planId: string): Promise<void> {
    const { data: plan } = await supabase
      .from('payment_plans')
      .update({
        plan_status: 'defaulted',
        updated_at: new Date().toISOString()
      })
      .eq('id', planId)
      .select()
      .single();

    if (!plan) return;

    // Update late contribution to defaulted
    await supabase
      .from('late_contributions')
      .update({
        late_status: 'defaulted',
        updated_at: new Date().toISOString()
      })
      .eq('id', plan.late_contribution_id);

    // Log event
    await this.logPlanEvent(plan.late_contribution_id, 'payment_plan_defaulted', {
      plan_id: planId,
      reason: 'Three consecutive missed installments'
    });

    // Apply XnScore penalty
    await this.applyDefaultPenalty(plan.user_id, plan.late_contribution_id);
  }

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------

  /**
   * Schedule a reminder for an upcoming installment
   */
  private async scheduleInstallmentReminder(planId: string, installmentNumber: number): Promise<void> {
    const { data: installment } = await supabase
      .from('payment_plan_installments')
      .select('id, due_date')
      .eq('plan_id', planId)
      .eq('installment_number', installmentNumber)
      .single();

    if (!installment) return;

    const { data: plan } = await supabase
      .from('payment_plans')
      .select('user_id, installment_amount')
      .eq('id', planId)
      .single();

    if (!plan) return;

    // Schedule reminder 2 days before due date
    const reminderDate = new Date(installment.due_date);
    reminderDate.setDate(reminderDate.getDate() - 2);

    await supabase
      .from('scheduled_notifications')
      .insert({
        user_id: plan.user_id,
        notification_type: 'installment_reminder',
        scheduled_for: reminderDate.toISOString(),
        notification_status: 'pending',
        payload: {
          plan_id: planId,
          installment_id: installment.id,
          installment_number: installmentNumber,
          amount: plan.installment_amount,
          due_date: installment.due_date
        }
      });
  }

  /**
   * Send notification for overdue installment
   */
  private async sendOverdueNotification(installment: any): Promise<void> {
    const plan = installment.payment_plans;

    await supabase
      .from('scheduled_notifications')
      .insert({
        user_id: plan.user_id,
        notification_type: 'installment_overdue',
        scheduled_for: new Date().toISOString(),
        notification_status: 'pending',
        payload: {
          plan_id: plan.id,
          installment_id: installment.id,
          installment_number: installment.installment_number,
          amount_due: installment.amount - installment.paid_amount,
          days_overdue: this.calculateDaysOverdue(installment.due_date)
        }
      });
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS
  // --------------------------------------------------------------------------

  /**
   * Calculate the next due date (next Monday)
   */
  private calculateNextDueDate(startDate: Date): string {
    const next = new Date(startDate);
    next.setDate(next.getDate() + 7); // One week from start
    return next.toISOString();
  }

  /**
   * Update the next due date on the plan
   */
  private async updateNextDueDate(planId: string, nextInstallmentNumber: number): Promise<void> {
    const { data: nextInstallment } = await supabase
      .from('payment_plan_installments')
      .select('due_date')
      .eq('plan_id', planId)
      .eq('installment_number', nextInstallmentNumber)
      .single();

    if (nextInstallment) {
      await supabase
        .from('payment_plans')
        .update({ next_due_date: nextInstallment.due_date })
        .eq('id', planId);
    }
  }

  /**
   * Calculate days overdue
   */
  private calculateDaysOverdue(dueDate: string): number {
    const due = new Date(dueDate);
    const now = new Date();
    const diff = now.getTime() - due.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Log a payment plan event
   */
  private async logPlanEvent(
    lateContributionId: string,
    eventType: string,
    eventData: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('late_contribution_events')
      .insert({
        late_contribution_id: lateContributionId,
        event_type: eventType,
        event_data: eventData
      });
  }

  /**
   * Apply XnScore penalty for payment plan default
   */
  private async applyDefaultPenalty(userId: string, lateContributionId: string): Promise<void> {
    // Additional -20 penalty for defaulting on a payment plan
    await supabase.rpc('apply_xn_score_change', {
      p_user_id: userId,
      p_change: -20,
      p_reason: 'payment_plan_default',
      p_reference_type: 'late_contribution',
      p_reference_id: lateContributionId
    });
  }

  // --------------------------------------------------------------------------
  // QUERY METHODS
  // --------------------------------------------------------------------------

  /**
   * Get a user's active payment plans
   */
  async getUserActivePlans(userId: string): Promise<PaymentPlan[]> {
    const { data, error } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('user_id', userId)
      .in('plan_status', ['proposed', 'accepted', 'active'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch payment plans: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a payment plan with its installments
   */
  async getPlanWithInstallments(planId: string): Promise<{
    plan: PaymentPlan;
    installments: PaymentPlanInstallment[];
  } | null> {
    const { data: plan, error: planError } = await supabase
      .from('payment_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) return null;

    const { data: installments, error: instError } = await supabase
      .from('payment_plan_installments')
      .select('*')
      .eq('plan_id', planId)
      .order('installment_number', { ascending: true });

    if (instError) return null;

    return { plan, installments: installments || [] };
  }

  /**
   * Get plan progress summary
   */
  async getPlanProgress(planId: string): Promise<{
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    completedInstallments: number;
    totalInstallments: number;
    percentComplete: number;
  } | null> {
    const planData = await this.getPlanWithInstallments(planId);
    if (!planData) return null;

    const { plan, installments } = planData;
    const paidAmount = installments.reduce((sum, i) => sum + i.paid_amount, 0);
    const completedInstallments = installments.filter(i => i.installment_status === 'paid').length;

    return {
      totalAmount: plan.total_amount,
      paidAmount,
      remainingAmount: plan.total_amount - paidAmount,
      completedInstallments,
      totalInstallments: plan.num_installments,
      percentComplete: Math.round((paidAmount / plan.total_amount) * 100)
    };
  }
}

// Export singleton instance
export const paymentPlanService = new PaymentPlanService();
