/**
 * WithdrawalService.ts
 *
 * Handles withdrawal requests from user wallets to external accounts.
 * Integrates with payment gateways for bank transfers, mobile money, and cards.
 *
 * Features:
 * - Withdrawal request creation and validation
 * - Fee calculation
 * - Processing queue management
 * - Status tracking and notifications
 * - Retry logic for failed withdrawals
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type WithdrawalStatus =
  | "pending"         // Awaiting processing
  | "approved"        // Approved for processing
  | "processing"      // Currently being processed
  | "completed"       // Successfully completed
  | "failed"          // Failed (will retry)
  | "cancelled"       // Cancelled by user
  | "rejected"        // Rejected by admin
  | "refunded";       // Refunded to wallet

export type WithdrawalMethod =
  | "bank_transfer"
  | "mobile_money"
  | "card"
  | "cash_pickup";

export interface Withdrawal {
  id: string;
  userId: string;
  walletId: string;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  status: WithdrawalStatus;
  method: WithdrawalMethod;

  // Destination details
  destinationId: string; // Reference to payout_methods table
  destinationDetails?: DestinationDetails;

  // Processing info
  processorReference?: string;
  processorResponse?: any;
  processedAt?: string;
  completedAt?: string;

  // Failure handling
  failureReason?: string;
  retryCount: number;
  lastRetryAt?: string;

  // Approval workflow
  requiresApproval: boolean;
  approvedBy?: string;
  approvedAt?: string;

  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DestinationDetails {
  // Bank
  bankName?: string;
  accountNumber?: string;
  accountHolderName?: string;
  routingNumber?: string;
  swiftCode?: string;
  bankCountry?: string;

  // Mobile money
  mobileProvider?: string;
  mobileNumber?: string;
  mobileAccountName?: string;

  // Card
  cardLastFour?: string;
  cardBrand?: string;

  // Cash pickup
  pickupLocation?: string;
  pickupCode?: string;
}

export interface WithdrawalRequest {
  userId: string;
  walletId: string;
  amount: number;
  destinationId: string;
  method: WithdrawalMethod;
  notes?: string;
}

export interface WithdrawalResult {
  success: boolean;
  withdrawalId: string;
  status: WithdrawalStatus;
  transactionId?: string;
  estimatedArrival?: string;
  error?: string;
}

export interface WithdrawalFeeConfig {
  method: WithdrawalMethod;
  country?: string;
  currency: string;
  flatFee: number;
  percentageFee: number; // As decimal, e.g., 0.015 = 1.5%
  minFee: number;
  maxFee?: number;
  minAmount: number;
  maxAmount?: number;
  processingTimeHours: number;
}

export interface WithdrawalLimits {
  dailyLimit: number;
  weeklyLimit: number;
  monthlyLimit: number;
  singleTransactionMax: number;
  remainingDaily: number;
  remainingWeekly: number;
  remainingMonthly: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class WithdrawalService {
  private maxRetries = 3;
  private retryDelayMinutes = 30;

  // ============================================================================
  // WITHDRAWAL CREATION
  // ============================================================================

  /**
   * Create a new withdrawal request
   */
  async createWithdrawal(request: WithdrawalRequest): Promise<Withdrawal> {
    // Validate the request
    await this.validateWithdrawalRequest(request);

    // Get fee configuration
    const feeConfig = await this.getFeeConfig(request.method, request.walletId);
    const fee = this.calculateFee(request.amount, feeConfig);
    const netAmount = request.amount - fee;

    // Check if requires approval (large withdrawals or new accounts)
    const requiresApproval = await this.checkRequiresApproval(request.userId, request.amount);

    // Get destination details
    const destination = await this.getDestinationDetails(request.destinationId);

    // Create the withdrawal record
    const { data, error } = await supabase
      .from("payout_requests")
      .insert({
        user_id: request.userId,
        payout_method_id: request.destinationId,
        amount: request.amount,
        fee_amount: fee,
        net_amount: netAmount,
        status: requiresApproval ? "pending" : "approved",
        requires_approval: requiresApproval,
        notes: request.notes,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create withdrawal: ${error.message}`);

    // Reserve funds in wallet
    await this.reserveFundsInWallet(request.walletId, request.amount);

    // If auto-approved, queue for processing
    if (!requiresApproval) {
      await this.queueForProcessing(data.id);
    }

    // Send notification
    await this.sendNotification(request.userId, "withdrawal_created", {
      amount: request.amount,
      fee,
      netAmount,
      method: request.method,
      status: requiresApproval ? "pending_approval" : "processing",
    });

    return this.transformWithdrawal(data, destination);
  }

  /**
   * Validate withdrawal request
   */
  private async validateWithdrawalRequest(request: WithdrawalRequest): Promise<void> {
    // Check wallet balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance, currency")
      .eq("id", request.walletId)
      .eq("user_id", request.userId)
      .single();

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (parseFloat(wallet.balance) < request.amount) {
      throw new Error("Insufficient balance");
    }

    // Check limits
    const limits = await this.getUserWithdrawalLimits(request.userId);
    if (request.amount > limits.singleTransactionMax) {
      throw new Error(`Amount exceeds maximum single transaction limit of ${limits.singleTransactionMax}`);
    }
    if (request.amount > limits.remainingDaily) {
      throw new Error(`Amount exceeds remaining daily limit of ${limits.remainingDaily}`);
    }

    // Check destination exists and is verified
    const { data: destination } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("id", request.destinationId)
      .eq("user_id", request.userId)
      .eq("is_active", true)
      .single();

    if (!destination) {
      throw new Error("Withdrawal destination not found or inactive");
    }

    // Check minimum amount
    const feeConfig = await this.getFeeConfig(request.method, request.walletId);
    if (request.amount < feeConfig.minAmount) {
      throw new Error(`Minimum withdrawal amount is ${feeConfig.minAmount}`);
    }

    if (feeConfig.maxAmount && request.amount > feeConfig.maxAmount) {
      throw new Error(`Maximum withdrawal amount is ${feeConfig.maxAmount}`);
    }
  }

  /**
   * Check if withdrawal requires manual approval
   */
  private async checkRequiresApproval(userId: string, amount: number): Promise<boolean> {
    // Check account age
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at, is_verified, xn_score")
      .eq("id", userId)
      .single();

    if (!profile) return true;

    const accountAge = Date.now() - new Date(profile.created_at).getTime();
    const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);

    // New accounts (< 30 days) require approval for any withdrawal
    if (accountAgeDays < 30) return true;

    // Unverified accounts require approval
    if (!profile.is_verified) return true;

    // Large withdrawals (> 10x average) require approval
    const { data: history } = await supabase
      .from("payout_requests")
      .select("amount")
      .eq("user_id", userId)
      .eq("status", "completed")
      .limit(10);

    if (history && history.length > 0) {
      const avgAmount = history.reduce((sum, w) => sum + parseFloat(w.amount), 0) / history.length;
      if (amount > avgAmount * 10) return true;
    }

    // Low XnScore requires approval for larger amounts
    if (profile.xn_score < 50 && amount > 50000) return true;

    return false;
  }

  // ============================================================================
  // FEE CALCULATION
  // ============================================================================

  /**
   * Get fee configuration for a withdrawal method
   */
  async getFeeConfig(method: WithdrawalMethod, walletId?: string): Promise<WithdrawalFeeConfig> {
    let currency = "XAF";

    if (walletId) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("currency")
        .eq("id", walletId)
        .single();
      if (wallet) currency = wallet.currency;
    }

    const { data } = await supabase
      .from("payout_fees")
      .select("*")
      .eq("method_type", method)
      .eq("currency", currency)
      .single();

    if (data) {
      return {
        method,
        country: data.country,
        currency: data.currency,
        flatFee: parseFloat(data.flat_fee) || 0,
        percentageFee: parseFloat(data.percentage_fee) || 0,
        minFee: parseFloat(data.min_fee) || 0,
        maxFee: data.max_fee ? parseFloat(data.max_fee) : undefined,
        minAmount: parseFloat(data.min_amount) || 0,
        maxAmount: data.max_amount ? parseFloat(data.max_amount) : undefined,
        processingTimeHours: data.processing_time_hours || 24,
      };
    }

    // Default fee config
    return {
      method,
      currency,
      flatFee: 500,
      percentageFee: 0.01,
      minFee: 500,
      maxFee: 10000,
      minAmount: 1000,
      maxAmount: 5000000,
      processingTimeHours: 24,
    };
  }

  /**
   * Calculate withdrawal fee
   */
  calculateFee(amount: number, config: WithdrawalFeeConfig): number {
    let fee = config.flatFee + (amount * config.percentageFee);

    // Apply min/max
    fee = Math.max(fee, config.minFee);
    if (config.maxFee) {
      fee = Math.min(fee, config.maxFee);
    }

    return Math.round(fee * 100) / 100;
  }

  /**
   * Preview withdrawal (get fee and estimated arrival)
   */
  async previewWithdrawal(
    amount: number,
    method: WithdrawalMethod,
    walletId?: string
  ): Promise<{
    amount: number;
    fee: number;
    netAmount: number;
    estimatedArrival: Date;
    processingTime: string;
  }> {
    const feeConfig = await this.getFeeConfig(method, walletId);
    const fee = this.calculateFee(amount, feeConfig);
    const netAmount = amount - fee;

    const estimatedArrival = new Date();
    estimatedArrival.setHours(estimatedArrival.getHours() + feeConfig.processingTimeHours);

    return {
      amount,
      fee,
      netAmount,
      estimatedArrival,
      processingTime: this.formatProcessingTime(feeConfig.processingTimeHours),
    };
  }

  private formatProcessingTime(hours: number): string {
    if (hours < 1) return "Instant";
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""}`;
    const days = Math.ceil(hours / 24);
    return `${days} business day${days > 1 ? "s" : ""}`;
  }

  // ============================================================================
  // LIMITS
  // ============================================================================

  /**
   * Get user's withdrawal limits and remaining amounts
   */
  async getUserWithdrawalLimits(userId: string): Promise<WithdrawalLimits> {
    // Default limits
    const defaultLimits = {
      dailyLimit: 500000,      // 500,000 XAF
      weeklyLimit: 2000000,    // 2,000,000 XAF
      monthlyLimit: 10000000,  // 10,000,000 XAF
      singleTransactionMax: 1000000, // 1,000,000 XAF
    };

    // Get user's tier/verification status for custom limits
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_verified, kyc_level, xn_score")
      .eq("id", userId)
      .single();

    let limits = { ...defaultLimits };

    // Adjust limits based on verification/tier
    if (profile) {
      if (profile.kyc_level === 2) {
        limits = {
          dailyLimit: 1000000,
          weeklyLimit: 5000000,
          monthlyLimit: 20000000,
          singleTransactionMax: 2000000,
        };
      } else if (profile.kyc_level >= 3) {
        limits = {
          dailyLimit: 5000000,
          weeklyLimit: 20000000,
          monthlyLimit: 100000000,
          singleTransactionMax: 10000000,
        };
      }
    }

    // Calculate remaining limits
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get completed withdrawals
    const { data: withdrawals } = await supabase
      .from("payout_requests")
      .select("amount, created_at")
      .eq("user_id", userId)
      .in("status", ["completed", "processing", "approved", "pending"])
      .gte("created_at", startOfMonth.toISOString());

    let dailyUsed = 0;
    let weeklyUsed = 0;
    let monthlyUsed = 0;

    for (const w of withdrawals || []) {
      const wDate = new Date(w.created_at);
      const amount = parseFloat(w.amount);

      monthlyUsed += amount;
      if (wDate >= startOfWeek) weeklyUsed += amount;
      if (wDate >= startOfDay) dailyUsed += amount;
    }

    return {
      ...limits,
      remainingDaily: Math.max(0, limits.dailyLimit - dailyUsed),
      remainingWeekly: Math.max(0, limits.weeklyLimit - weeklyUsed),
      remainingMonthly: Math.max(0, limits.monthlyLimit - monthlyUsed),
    };
  }

  // ============================================================================
  // PROCESSING
  // ============================================================================

  /**
   * Reserve funds in wallet for pending withdrawal
   */
  private async reserveFundsInWallet(walletId: string, amount: number): Promise<void> {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance, reserved_balance")
      .eq("id", walletId)
      .single();

    if (!wallet) throw new Error("Wallet not found");

    const newBalance = parseFloat(wallet.balance) - amount;
    const newReserved = (parseFloat(wallet.reserved_balance) || 0) + amount;

    await supabase
      .from("wallets")
      .update({
        balance: newBalance,
        reserved_balance: newReserved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId);

    // Record the hold transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "withdrawal_hold",
      amount: -amount,
      balance_after: newBalance,
      description: "Funds reserved for withdrawal",
      status: "completed",
    });
  }

  /**
   * Release reserved funds back to wallet (for cancelled/failed withdrawals)
   */
  async releaseFundsToWallet(walletId: string, amount: number, reason: string): Promise<void> {
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance, reserved_balance")
      .eq("id", walletId)
      .single();

    if (!wallet) throw new Error("Wallet not found");

    const newBalance = parseFloat(wallet.balance) + amount;
    const newReserved = Math.max(0, (parseFloat(wallet.reserved_balance) || 0) - amount);

    await supabase
      .from("wallets")
      .update({
        balance: newBalance,
        reserved_balance: newReserved,
        updated_at: new Date().toISOString(),
      })
      .eq("id", walletId);

    // Record the release transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: walletId,
      type: "withdrawal_release",
      amount: amount,
      balance_after: newBalance,
      description: `Withdrawal funds released: ${reason}`,
      status: "completed",
    });
  }

  /**
   * Queue withdrawal for processing
   */
  private async queueForProcessing(withdrawalId: string): Promise<void> {
    // In production, this would add to a job queue (Bull, AWS SQS, etc.)
    // For now, we'll just update status
    await supabase
      .from("payout_requests")
      .update({ status: "processing" })
      .eq("id", withdrawalId);
  }

  /**
   * Process a withdrawal (to be called by payment processor)
   */
  async processWithdrawal(withdrawalId: string): Promise<WithdrawalResult> {
    const { data: withdrawal } = await supabase
      .from("payout_requests")
      .select("*, payout_method:payout_methods(*)")
      .eq("id", withdrawalId)
      .single();

    if (!withdrawal) {
      return {
        success: false,
        withdrawalId,
        status: "failed",
        error: "Withdrawal not found",
      };
    }

    // Update to processing
    await supabase
      .from("payout_requests")
      .update({
        status: "processing",
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    try {
      // Execute the withdrawal based on method
      const result = await this.executeWithdrawal(withdrawal);

      if (result.success) {
        // Mark as completed
        await supabase
          .from("payout_requests")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            processor_reference: result.transactionId,
          })
          .eq("id", withdrawalId);

        // Clear reserved balance
        await this.finalizeWithdrawal(withdrawal);

        // Send success notification
        await this.sendNotification(withdrawal.user_id, "withdrawal_completed", {
          amount: withdrawal.net_amount,
          transactionId: result.transactionId,
        });

        return {
          success: true,
          withdrawalId,
          status: "completed",
          transactionId: result.transactionId,
          estimatedArrival: result.estimatedArrival,
        };
      } else {
        throw new Error(result.error || "Withdrawal processing failed");
      }
    } catch (error: any) {
      const retryCount = (withdrawal.retry_count || 0) + 1;
      const shouldRetry = retryCount < this.maxRetries;

      await supabase
        .from("payout_requests")
        .update({
          status: shouldRetry ? "pending" : "failed",
          failure_reason: error.message,
          retry_count: retryCount,
          last_retry_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId);

      // If failed permanently, release funds
      if (!shouldRetry) {
        // Get wallet ID
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id")
          .eq("user_id", withdrawal.user_id)
          .single();

        if (wallet) {
          await this.releaseFundsToWallet(wallet.id, withdrawal.amount, "Withdrawal failed");
        }

        await this.sendNotification(withdrawal.user_id, "withdrawal_failed", {
          amount: withdrawal.amount,
          reason: error.message,
        });
      }

      return {
        success: false,
        withdrawalId,
        status: shouldRetry ? "pending" : "failed",
        error: error.message,
      };
    }
  }

  /**
   * Execute withdrawal through payment gateway
   */
  private async executeWithdrawal(
    withdrawal: any
  ): Promise<{ success: boolean; transactionId?: string; estimatedArrival?: string; error?: string }> {
    const methodType = withdrawal.payout_method?.method_type;

    // In production, this would call actual payment gateway APIs
    // For now, simulate processing
    switch (methodType) {
      case "bank_transfer":
        return this.executeBankTransfer(withdrawal);
      case "mobile_money":
        return this.executeMobileMoneyTransfer(withdrawal);
      case "card":
        return this.executeCardPayout(withdrawal);
      default:
        return { success: false, error: "Unsupported withdrawal method" };
    }
  }

  private async executeBankTransfer(withdrawal: any): Promise<{
    success: boolean;
    transactionId?: string;
    estimatedArrival?: string;
    error?: string;
  }> {
    // Simulate bank transfer processing
    // In production: Call Flutterwave, Paystack, or direct bank API

    const success = Math.random() > 0.05; // 95% success rate

    if (success) {
      const arrival = new Date();
      arrival.setDate(arrival.getDate() + 1); // Next business day

      return {
        success: true,
        transactionId: `BNK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        estimatedArrival: arrival.toISOString(),
      };
    }

    return {
      success: false,
      error: "Bank transfer failed - please verify account details",
    };
  }

  private async executeMobileMoneyTransfer(withdrawal: any): Promise<{
    success: boolean;
    transactionId?: string;
    estimatedArrival?: string;
    error?: string;
  }> {
    // Simulate mobile money transfer
    // In production: Call MTN MoMo API, Orange Money API, etc.

    const success = Math.random() > 0.03; // 97% success rate (mobile money is reliable)

    if (success) {
      return {
        success: true,
        transactionId: `MMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        estimatedArrival: new Date().toISOString(), // Instant
      };
    }

    return {
      success: false,
      error: "Mobile money transfer failed - network error",
    };
  }

  private async executeCardPayout(withdrawal: any): Promise<{
    success: boolean;
    transactionId?: string;
    estimatedArrival?: string;
    error?: string;
  }> {
    // Simulate card payout
    // In production: Call Visa Direct, Mastercard Send, etc.

    const success = Math.random() > 0.08; // 92% success rate

    if (success) {
      const arrival = new Date();
      arrival.setDate(arrival.getDate() + 2); // 2 business days

      return {
        success: true,
        transactionId: `CRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        estimatedArrival: arrival.toISOString(),
      };
    }

    return {
      success: false,
      error: "Card payout failed - card may be inactive",
    };
  }

  /**
   * Finalize withdrawal after successful processing
   */
  private async finalizeWithdrawal(withdrawal: any): Promise<void> {
    // Get wallet and clear reserved balance
    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (wallet) {
      const newReserved = Math.max(0, (parseFloat(wallet.reserved_balance) || 0) - withdrawal.amount);

      await supabase
        .from("wallets")
        .update({
          reserved_balance: newReserved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
    }
  }

  // ============================================================================
  // APPROVAL WORKFLOW
  // ============================================================================

  /**
   * Approve a withdrawal (admin action)
   */
  async approveWithdrawal(withdrawalId: string, approvedBy: string): Promise<void> {
    const { error } = await supabase
      .from("payout_requests")
      .update({
        status: "approved",
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId)
      .eq("status", "pending");

    if (error) throw error;

    // Queue for processing
    await this.queueForProcessing(withdrawalId);

    // Get withdrawal for notification
    const { data: withdrawal } = await supabase
      .from("payout_requests")
      .select("user_id, amount")
      .eq("id", withdrawalId)
      .single();

    if (withdrawal) {
      await this.sendNotification(withdrawal.user_id, "withdrawal_approved", {
        amount: withdrawal.amount,
      });
    }
  }

  /**
   * Reject a withdrawal (admin action)
   */
  async rejectWithdrawal(withdrawalId: string, rejectedBy: string, reason: string): Promise<void> {
    const { data: withdrawal } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("id", withdrawalId)
      .eq("status", "pending")
      .single();

    if (!withdrawal) throw new Error("Withdrawal not found or not pending");

    await supabase
      .from("payout_requests")
      .update({
        status: "rejected",
        failure_reason: reason,
      })
      .eq("id", withdrawalId);

    // Release funds back to wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", withdrawal.user_id)
      .single();

    if (wallet) {
      await this.releaseFundsToWallet(wallet.id, withdrawal.amount, `Rejected: ${reason}`);
    }

    await this.sendNotification(withdrawal.user_id, "withdrawal_rejected", {
      amount: withdrawal.amount,
      reason,
    });
  }

  /**
   * Cancel a withdrawal (user action)
   */
  async cancelWithdrawal(withdrawalId: string, userId: string): Promise<void> {
    const { data: withdrawal } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("id", withdrawalId)
      .eq("user_id", userId)
      .in("status", ["pending", "approved"])
      .single();

    if (!withdrawal) {
      throw new Error("Withdrawal not found or cannot be cancelled");
    }

    await supabase
      .from("payout_requests")
      .update({ status: "cancelled" })
      .eq("id", withdrawalId);

    // Release funds
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (wallet) {
      await this.releaseFundsToWallet(wallet.id, withdrawal.amount, "Cancelled by user");
    }
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get user's withdrawal history
   */
  async getUserWithdrawals(userId: string, limit = 50): Promise<Withdrawal[]> {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*, payout_method:payout_methods(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((w) => this.transformWithdrawal(w));
  }

  /**
   * Get withdrawal by ID
   */
  async getWithdrawal(withdrawalId: string): Promise<Withdrawal | null> {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*, payout_method:payout_methods(*)")
      .eq("id", withdrawalId)
      .single();

    if (error || !data) return null;
    return this.transformWithdrawal(data);
  }

  /**
   * Get pending withdrawals awaiting approval
   */
  async getPendingApprovals(limit = 100): Promise<Withdrawal[]> {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("*, payout_method:payout_methods(*), user:profiles(full_name)")
      .eq("status", "pending")
      .eq("requires_approval", true)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data || []).map((w) => this.transformWithdrawal(w));
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Get destination details from payout method
   */
  private async getDestinationDetails(destinationId: string): Promise<DestinationDetails | undefined> {
    const { data } = await supabase
      .from("payout_methods")
      .select("*")
      .eq("id", destinationId)
      .single();

    if (!data) return undefined;

    return {
      bankName: data.bank_name,
      accountNumber: data.account_number ? `****${data.account_number.slice(-4)}` : undefined,
      accountHolderName: data.account_holder_name,
      routingNumber: data.routing_number,
      bankCountry: data.bank_country,
      mobileProvider: data.mobile_provider,
      mobileNumber: data.mobile_number ? `****${data.mobile_number.slice(-4)}` : undefined,
      cardLastFour: data.card_last_four,
      cardBrand: data.card_brand,
    };
  }

  /**
   * Send notification
   */
  private async sendNotification(userId: string, type: string, data: any): Promise<void> {
    // Would integrate with notification service
    console.log(`[Withdrawal Notification] User: ${userId}, Type: ${type}`, data);
  }

  /**
   * Transform database row to Withdrawal type
   */
  private transformWithdrawal(row: any, destinationDetails?: DestinationDetails): Withdrawal {
    return {
      id: row.id,
      userId: row.user_id,
      walletId: row.wallet_id || "",
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || "XAF",
      fee: parseFloat(row.fee_amount) || 0,
      netAmount: parseFloat(row.net_amount) || 0,
      status: row.status as WithdrawalStatus,
      method: row.payout_method?.method_type as WithdrawalMethod || "bank_transfer",
      destinationId: row.payout_method_id,
      destinationDetails: destinationDetails || this.extractDestinationDetails(row.payout_method),
      processorReference: row.processor_reference,
      processorResponse: row.processor_response,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      failureReason: row.failure_reason,
      retryCount: row.retry_count || 0,
      lastRetryAt: row.last_retry_at,
      requiresApproval: row.requires_approval || false,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private extractDestinationDetails(payoutMethod: any): DestinationDetails | undefined {
    if (!payoutMethod) return undefined;

    return {
      bankName: payoutMethod.bank_name,
      accountNumber: payoutMethod.account_number ? `****${payoutMethod.account_number.slice(-4)}` : undefined,
      accountHolderName: payoutMethod.account_holder_name,
      mobileProvider: payoutMethod.mobile_provider,
      mobileNumber: payoutMethod.mobile_number ? `****${payoutMethod.mobile_number.slice(-4)}` : undefined,
      cardLastFour: payoutMethod.card_last_four,
      cardBrand: payoutMethod.card_brand,
    };
  }
}

// Export default instance
export const withdrawalService = new WithdrawalService();

// Export convenience functions
export const createWithdrawal = (request: WithdrawalRequest) =>
  withdrawalService.createWithdrawal(request);

export const previewWithdrawal = (amount: number, method: WithdrawalMethod, walletId?: string) =>
  withdrawalService.previewWithdrawal(amount, method, walletId);

export const getUserWithdrawals = (userId: string, limit?: number) =>
  withdrawalService.getUserWithdrawals(userId, limit);

export const getWithdrawalLimits = (userId: string) =>
  withdrawalService.getUserWithdrawalLimits(userId);

export const cancelWithdrawal = (withdrawalId: string, userId: string) =>
  withdrawalService.cancelWithdrawal(withdrawalId, userId);
