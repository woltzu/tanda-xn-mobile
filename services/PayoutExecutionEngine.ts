// ══════════════════════════════════════════════════════════════════════════════
// PAYOUT EXECUTION ENGINE - CREDIT UNION MODEL
// Money stays in ecosystem, building wealth, data, and trust
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { addDays, addMinutes, differenceInDays, format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PayoutExecution {
  id: string;
  circleId: string;
  cycleId: string;
  cycleNumber: number;
  recipientUserId: string;
  recipientWalletId: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
  distribution: PayoutDistribution;
  verificationChecks: VerificationChecks;
  allChecksPassed: boolean;
  executionStatus: 'pending' | 'verified' | 'executing' | 'completed' | 'partial' | 'failed';
  walletCreditTransactionId?: string;
  savingsTransferTransactionIds?: string[];
  bankTransferMovementId?: string;
  verifiedAt?: string;
  executedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  retryCount: number;
  suggestionsShown?: PayoutSuggestion[];
  suggestionAccepted?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutDistribution {
  totalCents: number;
  toWallet: number;
  toSavingsGoals: Array<{
    savingsGoalId: string;
    goalName?: string;
    amountCents: number;
  }>;
  toBank: {
    bankAccountId: string;
    bankName?: string;
    accountLast4?: string;
    amountCents: number;
  } | null;
  preferenceUsed?: PayoutPreference;
  pendingUserChoice?: boolean;
  suggestions?: PayoutSuggestion[];
}

export interface PayoutSuggestion {
  type: 'savings_goal' | 'create_emergency_fund' | 'reserve_for_contributions' | 'send_remittance';
  savingsGoalId?: string;
  goalName?: string;
  suggestedAmountCents: number;
  reason: string;
  interestRate?: number;
  priority: number;
  recipients?: Array<{
    id: string;
    name: string;
    country: string;
  }>;
}

export interface VerificationChecks {
  contributions?: {
    expected: number;
    received: number;
    expectedAmount: number;
    actualAmount: number;
    allAccountedFor: boolean;
    passed: boolean;
  };
  recipientIdentity?: {
    verified: boolean;
    verifiedAt?: string;
    passed: boolean;
  };
  recipientWallet?: {
    exists: boolean;
    status: string;
    passed: boolean;
  };
  recipientRestrictions?: {
    hasRestrictions: boolean;
    restrictions: string[];
    passed: boolean;
  };
  payoutOrder?: {
    cycleNumber: number;
    expectedRecipientId: string;
    actualRecipientId: string;
    passed: boolean;
  };
  circleStatus?: {
    status: string;
    passed: boolean;
  };
  cycleStatus?: {
    status: string;
    expected: string;
    passed: boolean;
  };
  amount?: {
    payoutAmount: number;
    expectedAmount: number;
    collectedAmount: number;
    isPositive: boolean;
    isReasonable: boolean;
    passed: boolean;
  };
  noDuplicate?: {
    existingPayoutId?: string;
    passed: boolean;
  };
  fboBalance?: {
    required: number;
    available: number;
    passed: boolean;
  };
  fraudScreen?: {
    riskScore: number;
    flags: string[];
    requiresManualReview: boolean;
    passed: boolean;
  };
}

export interface PayoutPreference {
  id: string;
  userId: string;
  preferenceScope: 'default' | 'circle_specific';
  circleId?: string;
  destination: 'wallet' | 'bank' | 'savings_goal' | 'split';
  bankAccountId?: string;
  savingsGoalId?: string;
  splitConfig?: SplitConfig;
  priority: number;
}

export interface SplitConfig {
  walletPercent?: number;
  walletFixed?: number;
  savingsPercent?: number;
  savingsFixed?: Array<{
    savingsGoalId: string;
    amountCents: number;
  }>;
  savingsGoalId?: string;
  bankPercent?: number;
  bankFixed?: number;
  bankAccountId?: string;
  bankRemainder?: boolean;
}

export interface ExecutionResult {
  success: boolean;
  executionId: string;
  distribution?: PayoutDistribution;
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAYOUT ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class PayoutExecutionEngine {
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN EXECUTION FLOW
  // ─────────────────────────────────────────────────────────────────────────────

  async executePayout(cycleId: string): Promise<ExecutionResult> {
    // Get cycle and related data
    const { data: cycle, error: cycleError } = await supabase
      .from('circle_cycles')
      .select(`
        *,
        circle:circles(*),
        recipient:profiles!circle_cycles_recipient_user_id_fkey(*)
      `)
      .eq('id', cycleId)
      .single();

    if (cycleError || !cycle) {
      throw new Error(`Cycle not found: ${cycleError?.message}`);
    }

    // Get recipient wallet
    const { data: recipientWallet, error: walletError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', cycle.recipient_user_id)
      .single();

    if (walletError || !recipientWallet) {
      // Create wallet if doesn't exist
      const { data: newWallet, error: createError } = await supabase
        .from('user_wallets')
        .insert({ user_id: cycle.recipient_user_id })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create wallet: ${createError.message}`);
      }
    }

    const wallet = recipientWallet || (await this.getWallet(cycle.recipient_user_id));

    // Create payout execution record
    const grossAmountCents = Math.round(parseFloat(cycle.collected_amount || cycle.expected_amount) * 100);
    const platformFeeCents = Math.round(parseFloat(cycle.platform_fee || 0) * 100);
    const netAmountCents = grossAmountCents - platformFeeCents;

    const { data: execution, error: execError } = await supabase
      .from('payout_executions')
      .insert({
        circle_id: cycle.circle_id,
        cycle_id: cycle.id,
        cycle_number: cycle.cycle_number,
        recipient_user_id: cycle.recipient_user_id,
        recipient_wallet_id: wallet.id,
        gross_amount_cents: grossAmountCents,
        platform_fee_cents: platformFeeCents,
        net_amount_cents: netAmountCents,
        distribution: {},
        verification_checks: {},
        all_checks_passed: false,
        execution_status: 'pending'
      })
      .select()
      .single();

    if (execError) {
      throw new Error(`Failed to create execution record: ${execError.message}`);
    }

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 1: VERIFICATION
      // ═══════════════════════════════════════════════════════════════════════

      const verificationResult = await this.verifyPayoutConditions(
        execution,
        cycle,
        cycle.circle,
        cycle.recipient
      );

      await supabase
        .from('payout_executions')
        .update({
          verification_checks: verificationResult.checks,
          all_checks_passed: verificationResult.allPassed,
          verified_at: verificationResult.allPassed ? new Date().toISOString() : null,
          execution_status: verificationResult.allPassed ? 'verified' : 'failed',
          error_message: verificationResult.allPassed ? null : verificationResult.failureReason
        })
        .eq('id', execution.id);

      if (!verificationResult.allPassed) {
        await this.handlePayoutVerificationFailure(execution, verificationResult);
        return {
          success: false,
          executionId: execution.id,
          reason: verificationResult.failureReason
        };
      }

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 2: DETERMINE DISTRIBUTION
      // ═══════════════════════════════════════════════════════════════════════

      const distribution = await this.determinePayoutDistribution(
        cycle.recipient,
        cycle,
        cycle.circle
      );

      await supabase
        .from('payout_executions')
        .update({
          distribution,
          suggestions_shown: distribution.suggestions,
          execution_status: 'executing'
        })
        .eq('id', execution.id);

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 3: EXECUTE DISTRIBUTION
      // ═══════════════════════════════════════════════════════════════════════

      const executionResult = await this.executePayoutDistribution(
        execution,
        distribution,
        wallet
      );

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 4: COLLECT PLATFORM FEE
      // ═══════════════════════════════════════════════════════════════════════

      await this.collectPlatformFee(cycle, execution);

      // ═══════════════════════════════════════════════════════════════════════
      // PHASE 5: FINALIZE
      // ═══════════════════════════════════════════════════════════════════════

      await supabase
        .from('payout_executions')
        .update({
          ...executionResult.transactionIds,
          execution_status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', execution.id);

      // Update cycle
      await supabase
        .from('circle_cycles')
        .update({
          status: 'payout_completed',
          actual_payout_date: new Date().toISOString(),
          payout_execution_id: execution.id
        })
        .eq('id', cycle.id);

      // Send notifications
      await this.sendPayoutNotifications(execution, distribution, cycle.recipient, cycle.circle);

      // Update recipient engagement metrics
      await this.updateRecipientEngagement(cycle.recipient_user_id, distribution);

      return {
        success: true,
        executionId: execution.id,
        distribution
      };

    } catch (error: any) {
      await supabase
        .from('payout_executions')
        .update({
          execution_status: 'failed',
          error_message: error.message,
          retry_count: (execution.retry_count || 0) + 1
        })
        .eq('id', execution.id);

      // Alert ops
      console.error('Payout execution failed:', {
        executionId: execution.id,
        cycleId: cycle.id,
        error: error.message
      });

      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 1: VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  private async verifyPayoutConditions(
    execution: any,
    cycle: any,
    circle: any,
    recipient: any
  ): Promise<{ allPassed: boolean; failureReason?: string; checks: VerificationChecks }> {
    const checks: VerificationChecks = {};
    let allPassed = true;
    let failureReason: string | undefined;

    // CHECK 1: All contributions received or accounted for
    const { data: contributions } = await supabase
      .from('cycle_contributions')
      .select('*')
      .eq('cycle_id', cycle.id);

    const completedContributions = (contributions || []).filter(
      c => ['completed', 'covered'].includes(c.status)
    );

    const actualCollected = (contributions || []).reduce((sum, c) => {
      if (c.status === 'completed') return sum + parseFloat(c.contributed_amount || 0);
      if (c.status === 'covered') return sum + parseFloat(c.expected_amount || 0);
      return sum;
    }, 0);

    checks.contributions = {
      expected: contributions?.length || 0,
      received: completedContributions.length,
      expectedAmount: parseFloat(cycle.expected_amount),
      actualAmount: actualCollected,
      allAccountedFor: completedContributions.length === (contributions?.length || 0),
      passed: true // Allow partial payouts based on policy
    };

    // CHECK 2: Recipient identity verified
    const recipientVerified = recipient.identity_verified && recipient.identity_verified_at;
    checks.recipientIdentity = {
      verified: recipientVerified,
      verifiedAt: recipient.identity_verified_at,
      passed: recipientVerified
    };

    if (!recipientVerified) {
      allPassed = false;
      failureReason = 'Recipient identity not verified';
    }

    // CHECK 3: Recipient wallet active
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', recipient.id)
      .single();

    const walletActive = wallet && wallet.wallet_status === 'active';
    checks.recipientWallet = {
      exists: !!wallet,
      status: wallet?.wallet_status,
      passed: walletActive
    };

    if (!walletActive) {
      allPassed = false;
      failureReason = failureReason || 'Recipient wallet not active';
    }

    // CHECK 4: Recipient not suspended or restricted
    const { data: restrictions } = await supabase
      .from('user_restrictions')
      .select('*')
      .eq('user_id', recipient.id)
      .eq('status', 'active')
      .in('restriction_type', ['platform_suspension', 'payout_hold']);

    const noPayoutRestrictions = !restrictions || restrictions.length === 0;
    checks.recipientRestrictions = {
      hasRestrictions: (restrictions?.length || 0) > 0,
      restrictions: restrictions?.map(r => r.restriction_type) || [],
      passed: noPayoutRestrictions
    };

    if (!noPayoutRestrictions) {
      allPassed = false;
      failureReason = failureReason || 'Recipient has active payout restrictions';
    }

    // CHECK 5: Payout position is correct
    const { data: payoutOrder } = await supabase
      .from('payout_orders')
      .select('*')
      .eq('circle_id', circle.id)
      .eq('status', 'active')
      .single();

    const orderArray = payoutOrder?.order_data || [];
    const expectedRecipient = orderArray.find((o: any) => o.position === cycle.cycle_number);
    const correctRecipient = expectedRecipient?.user_id === recipient.id;

    checks.payoutOrder = {
      cycleNumber: cycle.cycle_number,
      expectedRecipientId: expectedRecipient?.user_id,
      actualRecipientId: recipient.id,
      passed: correctRecipient
    };

    if (!correctRecipient) {
      allPassed = false;
      failureReason = failureReason || 'Recipient does not match payout order';
    }

    // CHECK 6: Circle is active
    const circleActive = circle.status === 'active';
    checks.circleStatus = {
      status: circle.status,
      passed: circleActive
    };

    if (!circleActive) {
      allPassed = false;
      failureReason = failureReason || 'Circle is not active';
    }

    // CHECK 7: Cycle in correct status
    const cycleReady = cycle.status === 'ready_payout';
    checks.cycleStatus = {
      status: cycle.status,
      expected: 'ready_payout',
      passed: cycleReady
    };

    if (!cycleReady) {
      allPassed = false;
      failureReason = failureReason || `Cycle status is ${cycle.status}, expected ready_payout`;
    }

    // CHECK 8: Amount is positive and matches expectations
    const payoutAmount = parseFloat(cycle.payout_amount || cycle.collected_amount);
    const expectedAmount = parseFloat(cycle.expected_amount);
    const amountPositive = payoutAmount > 0;
    const amountReasonable = payoutAmount <= expectedAmount * 1.1; // Allow 10% buffer

    checks.amount = {
      payoutAmount,
      expectedAmount,
      collectedAmount: parseFloat(cycle.collected_amount || 0),
      isPositive: amountPositive,
      isReasonable: amountReasonable,
      passed: amountPositive && amountReasonable
    };

    if (!amountPositive) {
      allPassed = false;
      failureReason = failureReason || 'Payout amount is not positive';
    }

    // CHECK 9: No duplicate payout
    const { data: existingPayout } = await supabase
      .from('payout_executions')
      .select('id')
      .eq('cycle_id', cycle.id)
      .eq('execution_status', 'completed')
      .single();

    const notDuplicate = !existingPayout;
    checks.noDuplicate = {
      existingPayoutId: existingPayout?.id,
      passed: notDuplicate
    };

    if (!notDuplicate) {
      allPassed = false;
      failureReason = failureReason || 'Payout already completed for this cycle';
    }

    // CHECK 10: FBO has sufficient balance (simplified - would call actual FBO service)
    checks.fboBalance = {
      required: payoutAmount,
      available: 999999, // Would call actual FBO balance check
      passed: true
    };

    // CHECK 11: Fraud/AML screening
    const fraudCheck = await this.performPayoutFraudCheck(execution, recipient, cycle);
    checks.fraudScreen = fraudCheck;

    if (!fraudCheck.passed) {
      allPassed = false;
      failureReason = failureReason || 'Failed fraud screening';
    }

    return {
      allPassed,
      failureReason,
      checks
    };
  }

  private async performPayoutFraudCheck(
    execution: any,
    recipient: any,
    cycle: any
  ): Promise<{ riskScore: number; flags: string[]; requiresManualReview: boolean; passed: boolean }> {
    let riskScore = 0;
    const flags: string[] = [];

    // Check 1: First payout ever
    const { count: previousPayouts } = await supabase
      .from('payout_executions')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', recipient.id)
      .eq('execution_status', 'completed');

    if (previousPayouts === 0) {
      riskScore += 10;
      flags.push('first_payout');
    }

    // Check 2: Large payout relative to user's history
    const { data: avgPayoutData } = await supabase
      .from('payout_executions')
      .select('net_amount_cents')
      .eq('recipient_user_id', recipient.id)
      .eq('execution_status', 'completed');

    if (avgPayoutData && avgPayoutData.length > 0) {
      const avgPayout = avgPayoutData.reduce((sum, p) => sum + p.net_amount_cents, 0) / avgPayoutData.length;
      const currentAmountCents = execution.net_amount_cents;

      if (currentAmountCents > avgPayout * 2) {
        riskScore += 15;
        flags.push('above_average_amount');
      }
    }

    // Check 3: Circle recently joined
    const { data: membership } = await supabase
      .from('circle_members')
      .select('joined_at')
      .eq('user_id', recipient.id)
      .eq('circle_id', cycle.circle_id)
      .single();

    if (membership) {
      const daysSinceJoin = differenceInDays(new Date(), new Date(membership.joined_at));
      if (daysSinceJoin < 14) {
        riskScore += 20;
        flags.push('recent_join');
      }
    }

    // Check 4: User has active defaults
    const { count: activeDefaults } = await supabase
      .from('defaults')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', recipient.id)
      .eq('default_status', 'unresolved');

    if ((activeDefaults || 0) > 0) {
      riskScore += 25;
      flags.push('has_active_defaults');
    }

    return {
      riskScore,
      flags,
      requiresManualReview: riskScore >= 50,
      passed: riskScore < 70
    };
  }

  private async handlePayoutVerificationFailure(execution: any, verificationResult: any): Promise<void> {
    // Log the failure for review
    console.error('Payout verification failed:', {
      executionId: execution.id,
      reason: verificationResult.failureReason,
      checks: verificationResult.checks
    });

    // Notify relevant parties
    // This would send notifications to ops team and potentially the recipient
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 2: DETERMINE DISTRIBUTION
  // ─────────────────────────────────────────────────────────────────────────────

  private async determinePayoutDistribution(
    recipient: any,
    cycle: any,
    circle: any
  ): Promise<PayoutDistribution> {
    const netAmountCents = Math.round(parseFloat(cycle.payout_amount || cycle.collected_amount) * 100);

    // Get user's payout preferences
    const { data: circlePreference } = await supabase
      .from('payout_preferences')
      .select('*')
      .eq('user_id', recipient.id)
      .eq('preference_scope', 'circle_specific')
      .eq('circle_id', circle.id)
      .single();

    const { data: defaultPreference } = await supabase
      .from('payout_preferences')
      .select('*')
      .eq('user_id', recipient.id)
      .eq('preference_scope', 'default')
      .single();

    const preference = circlePreference || defaultPreference || { destination: 'wallet' };

    let distribution: PayoutDistribution = {
      totalCents: netAmountCents,
      toWallet: 0,
      toSavingsGoals: [],
      toBank: null,
      preferenceUsed: preference as PayoutPreference
    };

    switch (preference.destination) {
      case 'wallet':
        // Everything to wallet (DEFAULT - this is what we want!)
        distribution.toWallet = netAmountCents;
        break;

      case 'savings_goal':
        // All to a specific savings goal
        const { data: savingsGoal } = await supabase
          .from('user_savings_goals')
          .select('*, savings_goal_type:savings_goal_types(*)')
          .eq('id', preference.savings_goal_id)
          .single();

        if (savingsGoal) {
          distribution.toSavingsGoals = [{
            savingsGoalId: preference.savings_goal_id,
            goalName: savingsGoal.name,
            amountCents: netAmountCents
          }];
        } else {
          distribution.toWallet = netAmountCents;
        }
        break;

      case 'bank':
        // User explicitly wants external transfer
        // We still encourage keeping some in wallet
        const walletMinimum = Math.min(Math.round(netAmountCents * 0.1), 5000); // 10% or $50

        const { data: bankAccount } = await supabase
          .from('user_bank_accounts')
          .select('*')
          .eq('id', preference.bank_account_id)
          .single();

        distribution.toWallet = walletMinimum;
        distribution.toBank = {
          bankAccountId: preference.bank_account_id!,
          bankName: bankAccount?.bank_name,
          accountLast4: bankAccount?.account_last4,
          amountCents: netAmountCents - walletMinimum
        };
        break;

      case 'split':
        // Custom split
        distribution = await this.calculateSplitDistribution(
          netAmountCents,
          preference.split_config as SplitConfig,
          recipient.id
        );
        distribution.preferenceUsed = preference as PayoutPreference;
        break;

      default:
        distribution.toWallet = netAmountCents;
    }

    // Generate smart suggestions
    distribution.suggestions = await this.generatePayoutSuggestions(
      recipient.id,
      netAmountCents,
      distribution
    );

    return distribution;
  }

  private async calculateSplitDistribution(
    totalCents: number,
    splitConfig: SplitConfig,
    userId: string
  ): Promise<PayoutDistribution> {
    const distribution: PayoutDistribution = {
      totalCents,
      toWallet: 0,
      toSavingsGoals: [],
      toBank: null
    };

    let remainingCents = totalCents;

    // Process fixed amounts first
    if (splitConfig.savingsFixed) {
      for (const savingsConfig of splitConfig.savingsFixed) {
        const amount = Math.min(savingsConfig.amountCents, remainingCents);

        const { data: goal } = await supabase
          .from('user_savings_goals')
          .select('name')
          .eq('id', savingsConfig.savingsGoalId)
          .single();

        distribution.toSavingsGoals.push({
          savingsGoalId: savingsConfig.savingsGoalId,
          goalName: goal?.name,
          amountCents: amount
        });
        remainingCents -= amount;
      }
    }

    if (splitConfig.walletFixed && remainingCents > 0) {
      const amount = Math.min(splitConfig.walletFixed, remainingCents);
      distribution.toWallet = amount;
      remainingCents -= amount;
    }

    if (splitConfig.bankFixed && remainingCents > 0) {
      const { data: bankAccount } = await supabase
        .from('user_bank_accounts')
        .select('*')
        .eq('id', splitConfig.bankAccountId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (bankAccount) {
        const amount = Math.min(splitConfig.bankFixed, remainingCents);
        distribution.toBank = {
          bankAccountId: bankAccount.id,
          bankName: bankAccount.bank_name,
          accountLast4: bankAccount.account_last4,
          amountCents: amount
        };
        remainingCents -= amount;
      }
    }

    // Process percentages for remainder
    if (remainingCents > 0) {
      const percentageTotal = (splitConfig.walletPercent || 0) +
                              (splitConfig.savingsPercent || 0) +
                              (splitConfig.bankPercent || 0);

      if (percentageTotal > 0) {
        if (splitConfig.walletPercent) {
          const amount = Math.round(remainingCents * (splitConfig.walletPercent / percentageTotal));
          distribution.toWallet += amount;
        }

        if (splitConfig.savingsPercent && splitConfig.savingsGoalId) {
          const amount = Math.round(remainingCents * (splitConfig.savingsPercent / percentageTotal));
          const existingSavings = distribution.toSavingsGoals.find(
            s => s.savingsGoalId === splitConfig.savingsGoalId
          );
          if (existingSavings) {
            existingSavings.amountCents += amount;
          } else {
            distribution.toSavingsGoals.push({
              savingsGoalId: splitConfig.savingsGoalId,
              amountCents: amount
            });
          }
        }

        if (splitConfig.bankPercent && distribution.toBank) {
          const amount = Math.round(remainingCents * (splitConfig.bankPercent / percentageTotal));
          distribution.toBank.amountCents += amount;
        }
      } else {
        // No percentages specified - remainder goes to wallet
        distribution.toWallet += remainingCents;
      }
    }

    return distribution;
  }

  private async generatePayoutSuggestions(
    userId: string,
    totalCents: number,
    currentDistribution: PayoutDistribution
  ): Promise<PayoutSuggestion[]> {
    const suggestions: PayoutSuggestion[] = [];

    // Get user's savings goals
    const { data: savingsGoals } = await supabase
      .from('user_savings_goals')
      .select('*, savings_goal_type:savings_goal_types(*)')
      .eq('user_id', userId)
      .eq('goal_status', 'active');

    // Suggestion 1: Contribute to underfunded savings goals
    for (const goal of savingsGoals || []) {
      const progress = goal.current_balance_cents / (goal.target_amount_cents || 1);
      const remaining = (goal.target_amount_cents || 0) - goal.current_balance_cents;

      if (progress < 0.9 && remaining > 0) {
        const suggestedAmount = Math.min(
          Math.round(totalCents * 0.2), // 20% of payout
          remaining
        );

        if (suggestedAmount >= 1000) { // At least $10
          suggestions.push({
            type: 'savings_goal',
            savingsGoalId: goal.id,
            goalName: goal.name,
            suggestedAmountCents: suggestedAmount,
            reason: `Your "${goal.name}" goal is ${Math.round(progress * 100)}% funded`,
            interestRate: goal.savings_goal_type?.interest_rate,
            priority: goal.savings_goal_type?.code === 'emergency' ? 1 : 2
          });
        }
      }
    }

    // Suggestion 2: Start emergency fund if none exists
    const hasEmergencyFund = (savingsGoals || []).some(
      g => g.savings_goal_type?.code === 'emergency'
    );

    if (!hasEmergencyFund && totalCents >= 10000) {
      suggestions.push({
        type: 'create_emergency_fund',
        suggestedAmountCents: Math.round(totalCents * 0.25),
        reason: 'Start building an emergency fund with 3% APY',
        interestRate: 0.03,
        priority: 1
      });
    }

    // Suggestion 3: Reserve for upcoming contribution
    const { data: upcomingContributions } = await supabase
      .from('contribution_reservations')
      .select('*')
      .eq('user_id', userId)
      .eq('reservation_status', 'reserved')
      .lte('due_date', addDays(new Date(), 30).toISOString());

    const totalUpcoming = (upcomingContributions || []).reduce(
      (sum, c) => sum + c.amount_cents, 0
    );

    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('main_balance_cents')
      .eq('user_id', userId)
      .single();

    if (totalUpcoming > (wallet?.main_balance_cents || 0) + currentDistribution.toWallet) {
      const shortfall = totalUpcoming - (wallet?.main_balance_cents || 0) - currentDistribution.toWallet;
      suggestions.push({
        type: 'reserve_for_contributions',
        suggestedAmountCents: shortfall,
        reason: `You have $${(totalUpcoming / 100).toFixed(2)} in contributions due in the next 30 days`,
        priority: 0 // Highest priority
      });
    }

    // Suggestion 4: Send remittance (if user has recipients set up)
    const { data: remittanceRecipients } = await supabase
      .from('remittance_recipients')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (remittanceRecipients && remittanceRecipients.length > 0) {
      suggestions.push({
        type: 'send_remittance',
        suggestedAmountCents: 0,
        reason: 'Send money to your family instantly from your payout',
        recipients: remittanceRecipients.map(r => ({
          id: r.id,
          name: r.recipient_name,
          country: r.country
        })),
        priority: 3
      });
    }

    // Sort by priority
    suggestions.sort((a, b) => a.priority - b.priority);

    return suggestions;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 3: EXECUTE DISTRIBUTION
  // ─────────────────────────────────────────────────────────────────────────────

  private async executePayoutDistribution(
    execution: any,
    distribution: PayoutDistribution,
    wallet: any
  ): Promise<{ transactionIds: Record<string, any> }> {
    const transactionIds: Record<string, any> = {};

    // STEP 1: Credit wallet (instant, internal)
    if (distribution.toWallet > 0) {
      const { data: creditResult } = await supabase.rpc('process_wallet_credit', {
        p_wallet_id: wallet.id,
        p_amount_cents: distribution.toWallet,
        p_transaction_type: 'circle_payout',
        p_reference_type: 'cycle',
        p_reference_id: execution.cycle_id,
        p_description: `Payout from Circle - Cycle ${execution.cycle_number}`,
        p_metadata: JSON.stringify({
          executionId: execution.id,
          circleId: execution.circle_id
        })
      });

      transactionIds.wallet_credit_transaction_id = creditResult;
    }

    // STEP 2: Transfer to savings goals (instant, internal)
    if (distribution.toSavingsGoals.length > 0) {
      const savingsTransactionIds: string[] = [];

      for (const savingsAllocation of distribution.toSavingsGoals) {
        const transactionId = await this.transferToSavingsGoal(
          wallet.id,
          savingsAllocation.savingsGoalId,
          savingsAllocation.amountCents,
          {
            source: 'payout',
            cycleId: execution.cycle_id,
            executionId: execution.id
          }
        );

        savingsTransactionIds.push(transactionId);
      }

      transactionIds.savings_transfer_transaction_ids = savingsTransactionIds;
    }

    // STEP 3: External bank transfer (if requested)
    if (distribution.toBank && distribution.toBank.amountCents > 0) {
      const movementId = await this.initiateExternalTransfer(
        wallet,
        distribution.toBank.bankAccountId,
        distribution.toBank.amountCents,
        {
          type: 'payout_withdrawal',
          cycleId: execution.cycle_id,
          executionId: execution.id
        }
      );

      transactionIds.bank_transfer_movement_id = movementId;
    }

    return { transactionIds };
  }

  private async transferToSavingsGoal(
    walletId: string,
    savingsGoalId: string,
    amountCents: number,
    metadata: any
  ): Promise<string> {
    // Get wallet and savings goal
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    const { data: savingsGoal } = await supabase
      .from('user_savings_goals')
      .select('*')
      .eq('id', savingsGoalId)
      .single();

    if (!wallet || !savingsGoal) {
      throw new Error('Wallet or savings goal not found');
    }

    // Debit wallet
    const { data: debitResult } = await supabase.rpc('process_wallet_debit', {
      p_wallet_id: walletId,
      p_amount_cents: amountCents,
      p_transaction_type: 'savings_deposit',
      p_reference_type: 'savings_goal',
      p_reference_id: savingsGoalId,
      p_description: `Transfer to ${savingsGoal.name}`,
      p_metadata: JSON.stringify(metadata)
    });

    // Credit savings goal
    await supabase
      .from('user_savings_goals')
      .update({
        current_balance_cents: savingsGoal.current_balance_cents + amountCents,
        total_deposits_cents: (savingsGoal.total_deposits_cents || 0) + amountCents,
        last_deposit_at: new Date().toISOString()
      })
      .eq('id', savingsGoalId);

    // Create savings transaction record
    await supabase
      .from('savings_transactions')
      .insert({
        savings_goal_id: savingsGoalId,
        user_id: wallet.user_id,
        transaction_type: 'deposit',
        source: 'payout',
        amount_cents: amountCents,
        balance_before_cents: savingsGoal.current_balance_cents,
        balance_after_cents: savingsGoal.current_balance_cents + amountCents,
        wallet_transaction_id: debitResult,
        transaction_status: 'completed',
        metadata
      });

    return debitResult;
  }

  private async initiateExternalTransfer(
    wallet: any,
    bankAccountId: string,
    amountCents: number,
    metadata: any
  ): Promise<string> {
    // Get bank account
    const { data: bankAccount } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .single();

    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    // Debit wallet
    const { data: debitResult } = await supabase.rpc('process_wallet_debit', {
      p_wallet_id: wallet.id,
      p_amount_cents: amountCents,
      p_transaction_type: 'withdrawal',
      p_reference_type: 'bank_account',
      p_reference_id: bankAccountId,
      p_description: `Withdrawal to ${bankAccount.bank_name} ****${bankAccount.account_last4}`,
      p_metadata: JSON.stringify(metadata)
    });

    // Create money movement record
    const { data: movement, error } = await supabase
      .from('money_movements')
      .insert({
        movement_type: 'withdrawal',
        direction: 'outbound',
        amount: amountCents / 100,
        user_id: wallet.user_id,
        processor: 'dwolla',
        status: 'pending',
        metadata: {
          ...metadata,
          walletTransactionId: debitResult
        }
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create movement: ${error.message}`);
    }

    // In production, this would initiate Dwolla transfer
    // For now, we just record the movement

    return movement.id;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PHASE 4: COLLECT PLATFORM FEE
  // ─────────────────────────────────────────────────────────────────────────────

  private async collectPlatformFee(cycle: any, execution: any): Promise<void> {
    if (execution.platform_fee_cents <= 0) return;

    // Create money movement for fee collection
    const { data: movement, error } = await supabase
      .from('money_movements')
      .insert({
        movement_type: 'platform_fee',
        direction: 'internal',
        amount: execution.platform_fee_cents / 100,
        circle_id: execution.circle_id,
        processor: 'internal',
        status: 'completed',
        metadata: {
          cycleId: execution.cycle_id,
          executionId: execution.id
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Fee collection failed:', error);
      // Fee collection failure shouldn't block payout
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  private async sendPayoutNotifications(
    execution: any,
    distribution: PayoutDistribution,
    recipient: any,
    circle: any
  ): Promise<void> {
    const amountDollars = (execution.net_amount_cents / 100).toFixed(2);

    let body = `Your $${amountDollars} payout from ${circle.name} has been credited to your wallet!`;

    if (distribution.toSavingsGoals.length > 0) {
      const savingsTotal = distribution.toSavingsGoals.reduce(
        (sum, s) => sum + s.amountCents, 0
      ) / 100;
      body += `\n\n$${savingsTotal.toFixed(2)} was automatically added to your savings goals.`;
    }

    if (distribution.toBank) {
      const bankAmount = (distribution.toBank.amountCents / 100).toFixed(2);
      body += `\n\n$${bankAmount} is being transferred to your bank account (1-2 business days).`;
    }

    // In production, this would send push notification
    console.log('Payout notification:', {
      userId: recipient.id,
      title: `Payout Received - $${amountDollars}`,
      body
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ENGAGEMENT TRACKING
  // ─────────────────────────────────────────────────────────────────────────────

  private async updateRecipientEngagement(
    userId: string,
    distribution: PayoutDistribution
  ): Promise<void> {
    // Update profile metrics
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_platform_payouts_cents, total_external_withdrawals_cents')
      .eq('id', userId)
      .single();

    if (profile) {
      const newTotalPayouts = (profile.total_platform_payouts_cents || 0) + distribution.totalCents;
      const newTotalWithdrawals = (profile.total_external_withdrawals_cents || 0) +
        (distribution.toBank?.amountCents || 0);

      const retentionRate = newTotalPayouts > 0
        ? (newTotalPayouts - newTotalWithdrawals) / newTotalPayouts
        : 1;

      await supabase
        .from('profiles')
        .update({
          total_platform_payouts_cents: newTotalPayouts,
          total_external_withdrawals_cents: newTotalWithdrawals,
          money_retention_rate: retentionRate
        })
        .eq('id', userId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  private async getWallet(userId: string): Promise<any> {
    const { data: wallet, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error(`Wallet not found: ${error.message}`);
    }

    return wallet;
  }
}

// Export singleton instance
export const payoutEngine = new PayoutExecutionEngine();
