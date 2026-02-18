// ══════════════════════════════════════════════════════════════════════════════
// WALLET SERVICE - Credit Union Model
// The heart of keeping money in the ecosystem
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { addDays, format } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Wallet {
  id: string;
  userId: string;
  mainBalanceCents: number;
  reservedBalanceCents: number;
  committedBalanceCents: number;
  totalBalanceCents: number;
  availableBalanceCents: number;
  totalInterestEarnedCents: number;
  walletStatus: 'active' | 'frozen' | 'suspended' | 'closed';
  frozenReason?: string;
  frozenAt?: string;
  defaultPayoutDestination: 'wallet' | 'bank' | 'ask_each_time';
  autoReserveEnabled: boolean;
  totalPayoutsReceivedCents: number;
  totalWithdrawalsCents: number;
  moneyRetentionRate: number;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSummary {
  walletId: string;
  mainBalance: number;
  reservedBalance: number;
  committedBalance: number;
  totalBalance: number;
  availableBalance: number;
  totalSavings: number;
  savingsGoalsCount: number;
  upcomingContributions: number;
  moneyRetentionRate: number;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  userId: string;
  transactionType: string;
  direction: 'credit' | 'debit' | 'internal';
  amountCents: number;
  balanceType: 'main' | 'reserved' | 'committed';
  balanceBeforeCents: number;
  balanceAfterCents: number;
  referenceType?: string;
  referenceId?: string;
  moneyMovementId?: string;
  description: string;
  transactionStatus: 'pending' | 'completed' | 'failed' | 'reversed';
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ContributionReservation {
  id: string;
  walletId: string;
  userId: string;
  circleId: string;
  cyclerId?: string;
  cycleNumber: number;
  amountCents: number;
  dueDate: string;
  reservedAt: string;
  reservationStatus: 'reserved' | 'used' | 'released' | 'expired';
  usedAt?: string;
  releasedAt?: string;
  releaseReason?: string;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  walletId: string;
  savingsGoalTypeId: string;
  savingsGoalType?: SavingsGoalType;
  name: string;
  targetAmountCents?: number;
  targetDate?: string;
  currentBalanceCents: number;
  totalDepositsCents: number;
  totalWithdrawalsCents: number;
  totalInterestEarnedCents: number;
  lastInterestAccrualAt?: string;
  accruedInterestCents: number;
  lockedUntil?: string;
  isLocked: boolean;
  goalStatus: 'active' | 'completed' | 'closed';
  lastDepositAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoalType {
  id: string;
  code: string;
  name: string;
  description?: string;
  interestRate: number;
  interestFrequency: 'daily' | 'monthly' | 'quarterly';
  minimumBalanceCents: number;
  lockPeriodDays: number;
  earlyWithdrawalPenaltyPercent: number;
  icon?: string;
  color?: string;
  displayOrder: number;
  isActive: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class WalletService {
  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async getOrCreateWallet(userId: string): Promise<Wallet> {
    // Try to get existing wallet
    const { data: existing, error: fetchError } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existing) {
      return this.mapWallet(existing);
    }

    // Create new wallet
    const { data: newWallet, error: createError } = await supabase
      .from('user_wallets')
      .insert({ user_id: userId })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create wallet: ${createError.message}`);
    }

    return this.mapWallet(newWallet);
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return this.mapWallet(data);
  }

  async getWalletSummary(userId: string): Promise<WalletSummary | null> {
    const { data, error } = await supabase
      .rpc('get_wallet_summary', { p_user_id: userId })
      .single();

    if (error || !data) return null;

    return {
      walletId: data.wallet_id,
      mainBalance: data.main_balance,
      reservedBalance: data.reserved_balance,
      committedBalance: data.committed_balance,
      totalBalance: data.total_balance,
      availableBalance: data.available_balance,
      totalSavings: data.total_savings,
      savingsGoalsCount: data.savings_goals_count,
      upcomingContributions: data.upcoming_contributions,
      moneyRetentionRate: data.money_retention_rate
    };
  }

  async updateWalletSettings(
    userId: string,
    settings: {
      defaultPayoutDestination?: 'wallet' | 'bank' | 'ask_each_time';
      autoReserveEnabled?: boolean;
    }
  ): Promise<Wallet> {
    const { data, error } = await supabase
      .from('user_wallets')
      .update({
        default_payout_destination: settings.defaultPayoutDestination,
        auto_reserve_enabled: settings.autoReserveEnabled
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update wallet settings: ${error.message}`);
    }

    return this.mapWallet(data);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // WALLET TRANSACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async creditWallet(
    walletId: string,
    amountCents: number,
    transactionType: string,
    referenceType: string,
    referenceId: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const { data: transactionId, error } = await supabase.rpc('process_wallet_credit', {
      p_wallet_id: walletId,
      p_amount_cents: amountCents,
      p_transaction_type: transactionType,
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_description: description,
      p_metadata: JSON.stringify(metadata)
    });

    if (error) {
      throw new Error(`Failed to credit wallet: ${error.message}`);
    }

    return transactionId;
  }

  async debitWallet(
    walletId: string,
    amountCents: number,
    transactionType: string,
    referenceType: string,
    referenceId: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const { data: transactionId, error } = await supabase.rpc('process_wallet_debit', {
      p_wallet_id: walletId,
      p_amount_cents: amountCents,
      p_transaction_type: transactionType,
      p_reference_type: referenceType,
      p_reference_id: referenceId,
      p_description: description,
      p_metadata: JSON.stringify(metadata)
    });

    if (error) {
      throw new Error(`Failed to debit wallet: ${error.message}`);
    }

    return transactionId;
  }

  async getTransactionHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      transactionType?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<WalletTransaction[]> {
    let query = supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options.transactionType) {
      query = query.eq('transaction_type', options.transactionType);
    }

    if (options.startDate) {
      query = query.gte('created_at', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('created_at', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get transaction history: ${error.message}`);
    }

    return (data || []).map(this.mapTransaction);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTRIBUTION RESERVATIONS (Auto-Reserve System)
  // ─────────────────────────────────────────────────────────────────────────────

  async processAutoReservations(userId: string): Promise<void> {
    // Get user's active circle memberships
    const { data: memberships } = await supabase
      .from('circle_members')
      .select(`
        *,
        circle:circles(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (!memberships || memberships.length === 0) return;

    // Get user's wallet
    const wallet = await this.getOrCreateWallet(userId);

    if (!wallet.autoReserveEnabled) return;

    for (const membership of memberships) {
      // Find upcoming cycles for this circle
      const { data: upcomingCycles } = await supabase
        .from('circle_cycles')
        .select('*')
        .eq('circle_id', membership.circle_id)
        .in('status', ['scheduled', 'collecting'])
        .gte('contribution_deadline', new Date().toISOString())
        .lte('contribution_deadline', addDays(new Date(), 14).toISOString());

      for (const cycle of upcomingCycles || []) {
        // Check if already reserved
        const { data: existingReservation } = await supabase
          .from('contribution_reservations')
          .select('id')
          .eq('wallet_id', wallet.id)
          .eq('circle_id', membership.circle_id)
          .eq('cycle_number', cycle.cycle_number)
          .eq('reservation_status', 'reserved')
          .single();

        if (existingReservation) continue;

        // Check if sufficient main balance
        const contributionCents = Math.round(parseFloat(membership.circle.contribution_amount) * 100);

        if (wallet.mainBalanceCents >= contributionCents) {
          // Create reservation
          await this.createContributionReservation(
            wallet.id,
            userId,
            membership.circle,
            cycle
          );
        } else {
          // Notify user they need to add funds
          const shortfall = contributionCents - wallet.mainBalanceCents;
          console.log('Insufficient funds for reservation:', {
            userId,
            circleId: membership.circle_id,
            shortfallCents: shortfall
          });
          // In production, would send push notification
        }
      }
    }
  }

  async createContributionReservation(
    walletId: string,
    userId: string,
    circle: any,
    cycle: any
  ): Promise<ContributionReservation> {
    const contributionCents = Math.round(parseFloat(circle.contribution_amount) * 100);

    // Get current wallet
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (!wallet || wallet.main_balance_cents < contributionCents) {
      throw new Error('Insufficient balance for reservation');
    }

    // Create reservation transaction (moves from main to reserved)
    const { data: transaction, error: txError } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: walletId,
        user_id: userId,
        transaction_type: 'reserve_allocation',
        direction: 'internal',
        amount_cents: contributionCents,
        balance_type: 'main',
        balance_before_cents: wallet.main_balance_cents,
        balance_after_cents: wallet.main_balance_cents - contributionCents,
        reference_type: 'circle',
        reference_id: circle.id,
        description: `Reserved for ${circle.name} - Cycle ${cycle.cycle_number}`,
        transaction_status: 'completed'
      })
      .select()
      .single();

    if (txError) {
      throw new Error(`Failed to create reservation transaction: ${txError.message}`);
    }

    // Update wallet balances
    await supabase
      .from('user_wallets')
      .update({
        main_balance_cents: wallet.main_balance_cents - contributionCents,
        reserved_balance_cents: wallet.reserved_balance_cents + contributionCents
      })
      .eq('id', walletId);

    // Create reservation record
    const { data: reservation, error: resError } = await supabase
      .from('contribution_reservations')
      .insert({
        wallet_id: walletId,
        user_id: userId,
        circle_id: circle.id,
        cycle_id: cycle.id,
        cycle_number: cycle.cycle_number,
        amount_cents: contributionCents,
        due_date: cycle.contribution_deadline,
        reservation_status: 'reserved'
      })
      .select()
      .single();

    if (resError) {
      throw new Error(`Failed to create reservation: ${resError.message}`);
    }

    return this.mapReservation(reservation);
  }

  async useReservationForContribution(
    userId: string,
    circleId: string,
    cycleNumber: number
  ): Promise<ContributionReservation> {
    // Find the reservation
    const { data: reservation, error: findError } = await supabase
      .from('contribution_reservations')
      .select('*')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .eq('cycle_number', cycleNumber)
      .eq('reservation_status', 'reserved')
      .single();

    if (findError || !reservation) {
      throw new Error('No reservation found for this contribution');
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', reservation.wallet_id)
      .single();

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Move from reserved to committed
    const { data: transaction } = await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: userId,
        transaction_type: 'commit',
        direction: 'internal',
        amount_cents: reservation.amount_cents,
        balance_type: 'reserved',
        balance_before_cents: wallet.reserved_balance_cents,
        balance_after_cents: wallet.reserved_balance_cents - reservation.amount_cents,
        reference_type: 'contribution_reservation',
        reference_id: reservation.id,
        description: `Contribution to circle`,
        transaction_status: 'completed'
      })
      .select()
      .single();

    // Update wallet balances
    await supabase
      .from('user_wallets')
      .update({
        reserved_balance_cents: wallet.reserved_balance_cents - reservation.amount_cents,
        committed_balance_cents: wallet.committed_balance_cents + reservation.amount_cents
      })
      .eq('id', wallet.id);

    // Update reservation status
    const { data: updatedReservation } = await supabase
      .from('contribution_reservations')
      .update({
        reservation_status: 'used',
        used_at: new Date().toISOString(),
        used_for_transaction_id: transaction?.id
      })
      .eq('id', reservation.id)
      .select()
      .single();

    return this.mapReservation(updatedReservation);
  }

  async releaseReservation(
    reservationId: string,
    reason: string
  ): Promise<ContributionReservation> {
    // Get reservation
    const { data: reservation } = await supabase
      .from('contribution_reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('reservation_status', 'reserved')
      .single();

    if (!reservation) {
      throw new Error('Reservation not found or already used');
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', reservation.wallet_id)
      .single();

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Move from reserved back to main
    await supabase
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        user_id: reservation.user_id,
        transaction_type: 'reserve_release',
        direction: 'internal',
        amount_cents: reservation.amount_cents,
        balance_type: 'reserved',
        balance_before_cents: wallet.reserved_balance_cents,
        balance_after_cents: wallet.reserved_balance_cents - reservation.amount_cents,
        reference_type: 'contribution_reservation',
        reference_id: reservation.id,
        description: `Released reservation: ${reason}`,
        transaction_status: 'completed'
      });

    // Update wallet balances
    await supabase
      .from('user_wallets')
      .update({
        reserved_balance_cents: wallet.reserved_balance_cents - reservation.amount_cents,
        main_balance_cents: wallet.main_balance_cents + reservation.amount_cents
      })
      .eq('id', wallet.id);

    // Update reservation
    const { data: updatedReservation } = await supabase
      .from('contribution_reservations')
      .update({
        reservation_status: 'released',
        released_at: new Date().toISOString(),
        release_reason: reason
      })
      .eq('id', reservationId)
      .select()
      .single();

    return this.mapReservation(updatedReservation);
  }

  async getUpcomingReservations(userId: string): Promise<ContributionReservation[]> {
    const { data, error } = await supabase
      .from('contribution_reservations')
      .select(`
        *,
        circle:circles(name)
      `)
      .eq('user_id', userId)
      .eq('reservation_status', 'reserved')
      .order('due_date', { ascending: true });

    if (error) {
      throw new Error(`Failed to get reservations: ${error.message}`);
    }

    return (data || []).map(this.mapReservation);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVINGS GOALS
  // ─────────────────────────────────────────────────────────────────────────────

  async getSavingsGoalTypes(): Promise<SavingsGoalType[]> {
    const { data, error } = await supabase
      .from('savings_goal_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) {
      throw new Error(`Failed to get savings goal types: ${error.message}`);
    }

    return (data || []).map(this.mapSavingsGoalType);
  }

  async createSavingsGoal(
    userId: string,
    walletId: string,
    goalTypeId: string,
    name: string,
    targetAmountCents?: number,
    targetDate?: string
  ): Promise<SavingsGoal> {
    // Get goal type to check lock period
    const { data: goalType } = await supabase
      .from('savings_goal_types')
      .select('*')
      .eq('id', goalTypeId)
      .single();

    const lockedUntil = goalType?.lock_period_days > 0
      ? addDays(new Date(), goalType.lock_period_days).toISOString()
      : null;

    const { data, error } = await supabase
      .from('user_savings_goals')
      .insert({
        user_id: userId,
        wallet_id: walletId,
        savings_goal_type_id: goalTypeId,
        name,
        target_amount_cents: targetAmountCents,
        target_date: targetDate,
        locked_until: lockedUntil
      })
      .select(`
        *,
        savings_goal_type:savings_goal_types(*)
      `)
      .single();

    if (error) {
      throw new Error(`Failed to create savings goal: ${error.message}`);
    }

    return this.mapSavingsGoal(data);
  }

  async getSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    const { data, error } = await supabase
      .from('user_savings_goals')
      .select(`
        *,
        savings_goal_type:savings_goal_types(*)
      `)
      .eq('user_id', userId)
      .eq('goal_status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get savings goals: ${error.message}`);
    }

    return (data || []).map(this.mapSavingsGoal);
  }

  async depositToSavingsGoal(
    walletId: string,
    savingsGoalId: string,
    amountCents: number,
    source: string = 'manual'
  ): Promise<void> {
    // Get wallet
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (!wallet || wallet.main_balance_cents < amountCents) {
      throw new Error('Insufficient wallet balance');
    }

    // Get savings goal
    const { data: goal } = await supabase
      .from('user_savings_goals')
      .select('*')
      .eq('id', savingsGoalId)
      .single();

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    // Debit wallet
    const transactionId = await this.debitWallet(
      walletId,
      amountCents,
      'savings_deposit',
      'savings_goal',
      savingsGoalId,
      `Deposit to ${goal.name}`,
      { source }
    );

    // Credit savings goal
    await supabase
      .from('user_savings_goals')
      .update({
        current_balance_cents: goal.current_balance_cents + amountCents,
        total_deposits_cents: (goal.total_deposits_cents || 0) + amountCents,
        last_deposit_at: new Date().toISOString()
      })
      .eq('id', savingsGoalId);

    // Create savings transaction
    await supabase
      .from('savings_transactions')
      .insert({
        savings_goal_id: savingsGoalId,
        user_id: wallet.user_id,
        transaction_type: 'deposit',
        source,
        amount_cents: amountCents,
        balance_before_cents: goal.current_balance_cents,
        balance_after_cents: goal.current_balance_cents + amountCents,
        wallet_transaction_id: transactionId,
        transaction_status: 'completed'
      });

    // Check if goal is completed
    if (goal.target_amount_cents &&
        goal.current_balance_cents + amountCents >= goal.target_amount_cents) {
      await supabase
        .from('user_savings_goals')
        .update({
          goal_status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', savingsGoalId);
    }
  }

  async withdrawFromSavingsGoal(
    walletId: string,
    savingsGoalId: string,
    amountCents: number
  ): Promise<void> {
    // Get savings goal
    const { data: goal } = await supabase
      .from('user_savings_goals')
      .select(`
        *,
        savings_goal_type:savings_goal_types(*)
      `)
      .eq('id', savingsGoalId)
      .single();

    if (!goal) {
      throw new Error('Savings goal not found');
    }

    if (goal.current_balance_cents < amountCents) {
      throw new Error('Insufficient savings balance');
    }

    // Check if locked
    if (goal.is_locked) {
      throw new Error(`This savings goal is locked until ${format(new Date(goal.locked_until), 'MMM d, yyyy')}`);
    }

    // Get wallet
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', walletId)
      .single();

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    // Calculate penalty if applicable (early withdrawal)
    let penaltyAmount = 0;
    if (goal.savings_goal_type?.early_withdrawal_penalty_percent > 0) {
      penaltyAmount = Math.round(
        amountCents * (goal.savings_goal_type.early_withdrawal_penalty_percent / 100)
      );
    }

    const netAmount = amountCents - penaltyAmount;

    // Debit savings goal
    await supabase
      .from('user_savings_goals')
      .update({
        current_balance_cents: goal.current_balance_cents - amountCents,
        total_withdrawals_cents: (goal.total_withdrawals_cents || 0) + amountCents
      })
      .eq('id', savingsGoalId);

    // Credit wallet
    const transactionId = await this.creditWallet(
      walletId,
      netAmount,
      'savings_withdrawal',
      'savings_goal',
      savingsGoalId,
      `Withdrawal from ${goal.name}`,
      { penalty: penaltyAmount }
    );

    // Create savings transaction
    await supabase
      .from('savings_transactions')
      .insert({
        savings_goal_id: savingsGoalId,
        user_id: wallet.user_id,
        transaction_type: 'withdrawal',
        source: 'manual',
        amount_cents: amountCents,
        balance_before_cents: goal.current_balance_cents,
        balance_after_cents: goal.current_balance_cents - amountCents,
        wallet_transaction_id: transactionId,
        transaction_status: 'completed',
        metadata: { penalty_amount: penaltyAmount, net_amount: netAmount }
      });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYOUT PREFERENCES
  // ─────────────────────────────────────────────────────────────────────────────

  async getPayoutPreferences(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('payout_preferences')
      .select(`
        *,
        circle:circles(name),
        bank_account:user_bank_accounts(bank_name, account_last4),
        savings_goal:user_savings_goals(name)
      `)
      .eq('user_id', userId)
      .order('priority', { ascending: false });

    if (error) {
      throw new Error(`Failed to get payout preferences: ${error.message}`);
    }

    return data || [];
  }

  async setPayoutPreference(
    userId: string,
    scope: 'default' | 'circle_specific',
    destination: 'wallet' | 'bank' | 'savings_goal' | 'split',
    options: {
      circleId?: string;
      bankAccountId?: string;
      savingsGoalId?: string;
      splitConfig?: any;
    } = {}
  ): Promise<void> {
    const preferenceData: any = {
      user_id: userId,
      preference_scope: scope,
      destination,
      circle_id: scope === 'circle_specific' ? options.circleId : null,
      bank_account_id: options.bankAccountId,
      savings_goal_id: options.savingsGoalId,
      split_config: options.splitConfig
    };

    // Upsert preference
    const { error } = await supabase
      .from('payout_preferences')
      .upsert(preferenceData, {
        onConflict: 'user_id,preference_scope,circle_id'
      });

    if (error) {
      throw new Error(`Failed to set payout preference: ${error.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYOUT DESTINATION OPTIONS (for UI)
  // ─────────────────────────────────────────────────────────────────────────────

  async getPayoutDestinationOptions(userId: string, payoutAmountCents: number): Promise<any[]> {
    const wallet = await this.getWallet(userId);
    const savingsGoals = await this.getSavingsGoals(userId);

    const { data: bankAccounts } = await supabase
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    const options: any[] = [];

    // Option 1: Wallet (FEATURED - this is what we want!)
    options.push({
      id: 'wallet',
      name: 'Keep in TandaXn Wallet',
      description: 'Instant access • Use for circles, savings, remittances',
      icon: 'wallet',
      featured: true,
      benefits: [
        '✓ Available immediately',
        '✓ Use for your next circle contribution',
        '✓ Send money to family instantly',
        '✓ Earn interest in savings goals',
        '✓ Build credit history for future loans'
      ],
      estimatedArrival: 'Instant'
    });

    // Option 2: Savings Goals
    for (const goal of savingsGoals) {
      const progress = goal.targetAmountCents
        ? (goal.currentBalanceCents / goal.targetAmountCents) * 100
        : 0;
      const remaining = (goal.targetAmountCents || 0) - goal.currentBalanceCents;

      options.push({
        id: `savings_${goal.id}`,
        name: `Add to "${goal.name}"`,
        description: goal.targetAmountCents
          ? `${progress.toFixed(0)}% funded • ${(goal.savingsGoalType?.interestRate || 0) * 100}% APY`
          : `${(goal.savingsGoalType?.interestRate || 0) * 100}% APY`,
        icon: 'piggy-bank',
        savingsGoalId: goal.id,
        interestRate: goal.savingsGoalType?.interestRate,
        currentBalance: goal.currentBalanceCents,
        targetAmount: goal.targetAmountCents,
        benefits: [
          `✓ Earn ${((goal.savingsGoalType?.interestRate || 0) * 100).toFixed(1)}% APY`,
          remaining > 0 ? `✓ $${(remaining / 100).toFixed(0)} more to reach your goal` : null,
          '✓ Builds savings discipline'
        ].filter(Boolean),
        estimatedArrival: 'Instant'
      });
    }

    // Option 3: External Bank (shown but not featured)
    for (const account of bankAccounts || []) {
      options.push({
        id: `bank_${account.id}`,
        name: `Transfer to ${account.bank_name}`,
        description: `****${account.account_last4}`,
        icon: 'bank',
        bankAccountId: account.id,
        benefits: [],
        warnings: [
          '⏱ Takes 1-2 business days',
          '💸 Money leaves TandaXn ecosystem',
          "📉 Won't build your TandaXn credit history"
        ],
        estimatedArrival: '1-2 business days'
      });
    }

    // Option 4: Split (advanced)
    options.push({
      id: 'split',
      name: 'Split between destinations',
      description: 'Customize how your payout is distributed',
      icon: 'pie-chart',
      isAdvanced: true
    });

    return options;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAPPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private mapWallet(data: any): Wallet {
    return {
      id: data.id,
      userId: data.user_id,
      mainBalanceCents: data.main_balance_cents,
      reservedBalanceCents: data.reserved_balance_cents,
      committedBalanceCents: data.committed_balance_cents,
      totalBalanceCents: data.total_balance_cents,
      availableBalanceCents: data.available_balance_cents,
      totalInterestEarnedCents: data.total_interest_earned_cents,
      walletStatus: data.wallet_status,
      frozenReason: data.frozen_reason,
      frozenAt: data.frozen_at,
      defaultPayoutDestination: data.default_payout_destination,
      autoReserveEnabled: data.auto_reserve_enabled,
      totalPayoutsReceivedCents: data.total_payouts_received_cents,
      totalWithdrawalsCents: data.total_withdrawals_cents,
      moneyRetentionRate: data.money_retention_rate,
      lastActivityAt: data.last_activity_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapTransaction(data: any): WalletTransaction {
    return {
      id: data.id,
      walletId: data.wallet_id,
      userId: data.user_id,
      transactionType: data.transaction_type,
      direction: data.direction,
      amountCents: data.amount_cents,
      balanceType: data.balance_type,
      balanceBeforeCents: data.balance_before_cents,
      balanceAfterCents: data.balance_after_cents,
      referenceType: data.reference_type,
      referenceId: data.reference_id,
      moneyMovementId: data.money_movement_id,
      description: data.description,
      transactionStatus: data.transaction_status,
      metadata: data.metadata,
      createdAt: data.created_at
    };
  }

  private mapReservation(data: any): ContributionReservation {
    return {
      id: data.id,
      walletId: data.wallet_id,
      userId: data.user_id,
      circleId: data.circle_id,
      cyclerId: data.cycle_id,
      cycleNumber: data.cycle_number,
      amountCents: data.amount_cents,
      dueDate: data.due_date,
      reservedAt: data.reserved_at,
      reservationStatus: data.reservation_status,
      usedAt: data.used_at,
      releasedAt: data.released_at,
      releaseReason: data.release_reason,
      createdAt: data.created_at
    };
  }

  private mapSavingsGoal(data: any): SavingsGoal {
    return {
      id: data.id,
      userId: data.user_id,
      walletId: data.wallet_id,
      savingsGoalTypeId: data.savings_goal_type_id,
      savingsGoalType: data.savings_goal_type
        ? this.mapSavingsGoalType(data.savings_goal_type)
        : undefined,
      name: data.name,
      targetAmountCents: data.target_amount_cents,
      targetDate: data.target_date,
      currentBalanceCents: data.current_balance_cents,
      totalDepositsCents: data.total_deposits_cents,
      totalWithdrawalsCents: data.total_withdrawals_cents,
      totalInterestEarnedCents: data.total_interest_earned_cents,
      lastInterestAccrualAt: data.last_interest_accrual_at,
      accruedInterestCents: data.accrued_interest_cents,
      lockedUntil: data.locked_until,
      isLocked: data.is_locked,
      goalStatus: data.goal_status,
      lastDepositAt: data.last_deposit_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  private mapSavingsGoalType(data: any): SavingsGoalType {
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description,
      interestRate: parseFloat(data.interest_rate),
      interestFrequency: data.interest_frequency,
      minimumBalanceCents: data.minimum_balance_cents,
      lockPeriodDays: data.lock_period_days,
      earlyWithdrawalPenaltyPercent: parseFloat(data.early_withdrawal_penalty_percent || 0),
      icon: data.icon,
      color: data.color,
      displayOrder: data.display_order,
      isActive: data.is_active
    };
  }
}

// Export singleton instance
export const walletService = new WalletService();
