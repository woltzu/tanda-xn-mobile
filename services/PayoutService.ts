/**
 * PayoutService.ts
 *
 * Core Payout Engine for TandaXn
 *
 * Handles the complete payout lifecycle:
 * 1. Payout Scheduling - Determine when payouts should occur
 * 2. Recipient Selection - Determine who receives the payout (rotation)
 * 3. Eligibility Validation - Ensure all contributions collected, no defaults
 * 4. Payout Execution - Process the actual payout
 * 5. Status Tracking - Track payout through completion
 * 6. Failure Handling - Retry logic and fallback mechanisms
 *
 * Rotation Methods:
 * - Random: Random selection at circle start
 * - XnScore: Highest XnScore gets priority
 * - Auction: Members bid for payout position
 * - Sequential: Fixed order based on join date
 * - Need-based: Emergency/priority situations
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type PayoutStatus =
  | "scheduled"      // Payout is scheduled for future
  | "pending"        // Ready to be processed
  | "processing"     // Currently being processed
  | "completed"      // Successfully completed
  | "failed"         // Failed (will retry)
  | "cancelled"      // Cancelled by admin/system
  | "held"           // On hold (dispute, missing contribution)
  | "refunded";      // Refunded after completion

export type RotationMethod =
  | "random"         // Randomized at circle start
  | "xnscore"        // Based on XnScore ranking
  | "auction"        // Members bid for positions
  | "sequential"     // Based on join order
  | "need_based";    // Priority for emergency needs

export type PayoutMethod =
  | "wallet"         // To TandaXn wallet
  | "bank_transfer"  // To linked bank account
  | "mobile_money"   // To mobile money (MPesa, MTN, etc.)
  | "card"           // To debit card
  | "crypto";        // To crypto wallet

export interface Payout {
  id: string;
  circleId: string;
  circleName?: string;
  recipientId: string;
  recipientName?: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  fee: number;
  netAmount: number;
  status: PayoutStatus;
  payoutMethod: PayoutMethod;
  scheduledDate: string;
  processedAt?: string;
  completedAt?: string;
  failureReason?: string;
  retryCount: number;
  transactionId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutSchedule {
  circleId: string;
  totalCycles: number;
  currentCycle: number;
  frequency: "weekly" | "biweekly" | "monthly";
  rotationMethod: RotationMethod;
  schedule: PayoutSlot[];
  nextPayoutDate: string;
}

export interface PayoutSlot {
  cycleNumber: number;
  recipientId: string;
  recipientName?: string;
  scheduledDate: string;
  status: "upcoming" | "current" | "completed" | "skipped";
  payoutId?: string;
}

export interface PayoutEligibility {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  contributionsCollected: number;
  contributionsExpected: number;
  collectionRate: number;
  missingContributors: { userId: string; name: string; amount: number }[];
  defaultsInCycle: number;
}

export interface PayoutResult {
  success: boolean;
  payoutId: string;
  status: PayoutStatus;
  transactionId?: string;
  amount: number;
  fee: number;
  netAmount: number;
  completedAt?: string;
  error?: string;
  retryScheduled?: boolean;
}

export interface CirclePayoutSummary {
  circleId: string;
  circleName: string;
  totalPayouts: number;
  completedPayouts: number;
  totalAmountPaid: number;
  nextPayout?: {
    recipientId: string;
    recipientName: string;
    scheduledDate: string;
    amount: number;
  };
  payoutHistory: Payout[];
}

export interface PayoutConfig {
  // Timing
  processingDelayMinutes: number;  // Delay before processing scheduled payout
  retryDelayMinutes: number;       // Delay between retries
  maxRetries: number;              // Maximum retry attempts

  // Fees
  platformFeePercent: number;      // Platform fee percentage
  withdrawalFeeFlat: number;       // Flat withdrawal fee
  instantPayoutFeePercent: number; // Fee for instant payout

  // Limits
  minPayoutAmount: number;
  maxPayoutAmount: number;
  dailyPayoutLimit: number;

  // Collection threshold
  minCollectionRateForPayout: number; // Minimum % of contributions needed
}

const DEFAULT_CONFIG: PayoutConfig = {
  processingDelayMinutes: 30,
  retryDelayMinutes: 60,
  maxRetries: 3,

  platformFeePercent: 1.5,
  withdrawalFeeFlat: 0,
  instantPayoutFeePercent: 2.5,

  minPayoutAmount: 10,
  maxPayoutAmount: 50000,
  dailyPayoutLimit: 100000,

  minCollectionRateForPayout: 0.90, // 90% contributions must be collected
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class PayoutService {
  private config: PayoutConfig;

  constructor(config?: Partial<PayoutConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // PAYOUT SCHEDULING
  // ============================================================================

  /**
   * Generate payout schedule for a circle
   */
  async generatePayoutSchedule(
    circleId: string,
    rotationMethod: RotationMethod = "xnscore"
  ): Promise<PayoutSchedule> {
    // Get circle details
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      throw new Error("Circle not found");
    }

    // Get circle members
    const { data: members, error: membersError } = await supabase
      .from("circle_members")
      .select(`
        *,
        profile:profiles(id, full_name, xn_score)
      `)
      .eq("circle_id", circleId)
      .eq("status", "active")
      .order("position", { ascending: true });

    if (membersError || !members || members.length === 0) {
      throw new Error("No active members found");
    }

    // Determine payout order based on rotation method
    const orderedMembers = await this.determinePayoutOrder(members, rotationMethod);

    // Generate schedule
    const schedule: PayoutSlot[] = [];
    let payoutDate = new Date(circle.start_date || new Date());

    for (let i = 0; i < orderedMembers.length; i++) {
      const member = orderedMembers[i];
      const cycleNumber = i + 1;

      schedule.push({
        cycleNumber,
        recipientId: member.user_id,
        recipientName: member.profile?.full_name || "Unknown",
        scheduledDate: payoutDate.toISOString(),
        status: cycleNumber < circle.current_cycle
          ? "completed"
          : cycleNumber === circle.current_cycle
            ? "current"
            : "upcoming",
      });

      // Advance date based on frequency
      payoutDate = this.advanceDate(payoutDate, circle.frequency);
    }

    // Update member positions in database
    for (let i = 0; i < orderedMembers.length; i++) {
      await supabase
        .from("circle_members")
        .update({ position: i + 1 })
        .eq("id", orderedMembers[i].id);
    }

    return {
      circleId,
      totalCycles: orderedMembers.length,
      currentCycle: circle.current_cycle || 1,
      frequency: circle.frequency,
      rotationMethod,
      schedule,
      nextPayoutDate: schedule.find(s => s.status === "current" || s.status === "upcoming")?.scheduledDate || "",
    };
  }

  /**
   * Determine payout order based on rotation method
   */
  private async determinePayoutOrder(
    members: any[],
    method: RotationMethod
  ): Promise<any[]> {
    switch (method) {
      case "random":
        // Fisher-Yates shuffle
        const shuffled = [...members];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;

      case "xnscore":
        // Sort by XnScore descending (highest score goes first)
        return [...members].sort((a, b) => {
          const scoreA = a.profile?.xn_score || 50;
          const scoreB = b.profile?.xn_score || 50;
          return scoreB - scoreA;
        });

      case "sequential":
        // Sort by join date
        return [...members].sort((a, b) => {
          return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
        });

      case "need_based":
        // Would integrate with financial need assessment
        // For now, use XnScore as proxy (lower score = potentially more need)
        return [...members].sort((a, b) => {
          const scoreA = a.profile?.xn_score || 50;
          const scoreB = b.profile?.xn_score || 50;
          return scoreA - scoreB;
        });

      case "auction":
        // Auction results would be stored separately
        // Fall back to sequential for now
        return [...members].sort((a, b) => {
          return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
        });

      default:
        return members;
    }
  }

  /**
   * Advance date by frequency
   */
  private advanceDate(date: Date, frequency: string): Date {
    const newDate = new Date(date);
    switch (frequency) {
      case "weekly":
        newDate.setDate(newDate.getDate() + 7);
        break;
      case "biweekly":
        newDate.setDate(newDate.getDate() + 14);
        break;
      case "monthly":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
    }
    return newDate;
  }

  // ============================================================================
  // PAYOUT ELIGIBILITY
  // ============================================================================

  /**
   * Check if a payout can be processed for current cycle
   */
  async checkPayoutEligibility(circleId: string, cycleNumber: number): Promise<PayoutEligibility> {
    const result: PayoutEligibility = {
      eligible: true,
      reasons: [],
      warnings: [],
      contributionsCollected: 0,
      contributionsExpected: 0,
      collectionRate: 0,
      missingContributors: [],
      defaultsInCycle: 0,
    };

    // Get circle and members
    const { data: circle } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (!circle) {
      result.eligible = false;
      result.reasons.push("Circle not found");
      return result;
    }

    const { data: members } = await supabase
      .from("circle_members")
      .select("*, profile:profiles(full_name)")
      .eq("circle_id", circleId)
      .eq("status", "active");

    if (!members || members.length === 0) {
      result.eligible = false;
      result.reasons.push("No active members");
      return result;
    }

    result.contributionsExpected = members.length;

    // Get contributions for this cycle
    const { data: contributions } = await supabase
      .from("contributions")
      .select("*")
      .eq("circle_id", circleId)
      .eq("cycle_number", cycleNumber)
      .eq("status", "completed");

    const contributedUserIds = new Set((contributions || []).map(c => c.user_id));
    result.contributionsCollected = contributedUserIds.size;
    result.collectionRate = result.contributionsCollected / result.contributionsExpected;

    // Find missing contributors
    for (const member of members) {
      if (!contributedUserIds.has(member.user_id)) {
        result.missingContributors.push({
          userId: member.user_id,
          name: member.profile?.full_name || "Unknown",
          amount: parseFloat(circle.amount) || 0,
        });
      }
    }

    // Check for defaults in this cycle
    const { count: defaultCount } = await supabase
      .from("defaults")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("cycle_number", cycleNumber)
      .in("status", ["unresolved", "grace_period"]);

    result.defaultsInCycle = defaultCount || 0;

    // Determine eligibility
    if (result.collectionRate < this.config.minCollectionRateForPayout) {
      result.eligible = false;
      result.reasons.push(
        `Only ${Math.round(result.collectionRate * 100)}% of contributions collected (need ${Math.round(this.config.minCollectionRateForPayout * 100)}%)`
      );
    }

    if (result.defaultsInCycle > 0) {
      result.warnings.push(`${result.defaultsInCycle} unresolved default(s) in this cycle`);
      // Don't block payout for defaults if collection rate is met
    }

    if (result.missingContributors.length > 0 && result.eligible) {
      result.warnings.push(
        `${result.missingContributors.length} member(s) haven't contributed yet`
      );
    }

    return result;
  }

  // ============================================================================
  // PAYOUT EXECUTION
  // ============================================================================

  /**
   * Create a scheduled payout
   */
  async schedulePayout(
    circleId: string,
    recipientId: string,
    cycleNumber: number,
    scheduledDate: string,
    payoutMethod: PayoutMethod = "wallet"
  ): Promise<Payout> {
    // Get circle for amount
    const { data: circle } = await supabase
      .from("circles")
      .select("amount, currency, name")
      .eq("id", circleId)
      .single();

    if (!circle) {
      throw new Error("Circle not found");
    }

    // Get member count for payout calculation
    const { count: memberCount } = await supabase
      .from("circle_members")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("status", "active");

    const payoutAmount = parseFloat(circle.amount) * (memberCount || 1);
    const fee = this.calculateFee(payoutAmount, payoutMethod);
    const netAmount = payoutAmount - fee;

    const { data: payout, error } = await supabase
      .from("payouts")
      .insert({
        circle_id: circleId,
        recipient_id: recipientId,
        cycle_number: cycleNumber,
        amount: payoutAmount,
        currency: circle.currency || "USD",
        fee,
        net_amount: netAmount,
        status: "scheduled",
        payout_method: payoutMethod,
        scheduled_date: scheduledDate,
        retry_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return this.transformPayout(payout, circle.name);
  }

  /**
   * Process a payout
   */
  async processPayout(payoutId: string): Promise<PayoutResult> {
    // Get payout
    const { data: payout, error: fetchError } = await supabase
      .from("payouts")
      .select("*, circle:circles(name, amount, currency)")
      .eq("id", payoutId)
      .single();

    if (fetchError || !payout) {
      return {
        success: false,
        payoutId,
        status: "failed",
        amount: 0,
        fee: 0,
        netAmount: 0,
        error: "Payout not found",
      };
    }

    // Check eligibility
    const eligibility = await this.checkPayoutEligibility(payout.circle_id, payout.cycle_number);
    if (!eligibility.eligible) {
      // Put payout on hold
      await supabase
        .from("payouts")
        .update({ status: "held", failure_reason: eligibility.reasons.join("; ") })
        .eq("id", payoutId);

      return {
        success: false,
        payoutId,
        status: "held",
        amount: payout.amount,
        fee: payout.fee,
        netAmount: payout.net_amount,
        error: eligibility.reasons.join("; "),
      };
    }

    // Update status to processing
    await supabase
      .from("payouts")
      .update({ status: "processing", processed_at: new Date().toISOString() })
      .eq("id", payoutId);

    try {
      // Execute payout based on method
      const result = await this.executePayoutByMethod(payout);

      if (result.success) {
        // Update payout as completed
        await supabase
          .from("payouts")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            transaction_id: result.transactionId,
          })
          .eq("id", payoutId);

        // Update circle progress
        await this.updateCircleProgress(payout.circle_id, payout.cycle_number, payout.net_amount);

        // Credit recipient's wallet (if wallet payout)
        if (payout.payout_method === "wallet") {
          await this.creditWallet(payout.recipient_id, payout.net_amount, payout.currency, payoutId);
        }

        // Send notification
        await this.sendPayoutNotification(payout.recipient_id, payout, "completed");

        return {
          success: true,
          payoutId,
          status: "completed",
          transactionId: result.transactionId,
          amount: payout.amount,
          fee: payout.fee,
          netAmount: payout.net_amount,
          completedAt: new Date().toISOString(),
        };
      } else {
        throw new Error(result.error || "Payout execution failed");
      }
    } catch (error: any) {
      // Handle failure
      const retryCount = (payout.retry_count || 0) + 1;
      const shouldRetry = retryCount < this.config.maxRetries;

      await supabase
        .from("payouts")
        .update({
          status: shouldRetry ? "pending" : "failed",
          failure_reason: error.message,
          retry_count: retryCount,
        })
        .eq("id", payoutId);

      // Schedule retry if applicable
      if (shouldRetry) {
        const retryDate = new Date();
        retryDate.setMinutes(retryDate.getMinutes() + this.config.retryDelayMinutes);
        // Would schedule retry via cron/queue
      }

      return {
        success: false,
        payoutId,
        status: shouldRetry ? "pending" : "failed",
        amount: payout.amount,
        fee: payout.fee,
        netAmount: payout.net_amount,
        error: error.message,
        retryScheduled: shouldRetry,
      };
    }
  }

  /**
   * Execute payout by method
   */
  private async executePayoutByMethod(
    payout: any
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const method = payout.payout_method as PayoutMethod;

    switch (method) {
      case "wallet":
        // Internal wallet transfer - always succeeds
        const walletTxId = `WLT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return { success: true, transactionId: walletTxId };

      case "bank_transfer":
        // Would integrate with payment processor (Stripe, Flutterwave, etc.)
        // For now, simulate processing
        return this.simulateBankTransfer(payout);

      case "mobile_money":
        // Would integrate with mobile money providers (MPesa, MTN, etc.)
        return this.simulateMobileMoneyTransfer(payout);

      case "card":
        // Would integrate with card networks
        return this.simulateCardPayout(payout);

      default:
        return { success: false, error: `Unsupported payout method: ${method}` };
    }
  }

  /**
   * Simulate bank transfer (placeholder for real integration)
   */
  private async simulateBankTransfer(
    payout: any
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // In production, this would call Stripe/Flutterwave/etc.
    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    if (success) {
      return {
        success: true,
        transactionId: `BNK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    } else {
      return {
        success: false,
        error: "Bank transfer failed - insufficient funds or invalid account",
      };
    }
  }

  /**
   * Simulate mobile money transfer (placeholder for real integration)
   */
  private async simulateMobileMoneyTransfer(
    payout: any
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    // Would integrate with MPesa, MTN Mobile Money, etc.
    const success = Math.random() > 0.03;

    if (success) {
      return {
        success: true,
        transactionId: `MMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    } else {
      return {
        success: false,
        error: "Mobile money transfer failed",
      };
    }
  }

  /**
   * Simulate card payout (placeholder for real integration)
   */
  private async simulateCardPayout(
    payout: any
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    const success = Math.random() > 0.08;

    if (success) {
      return {
        success: true,
        transactionId: `CRD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
    } else {
      return {
        success: false,
        error: "Card payout failed",
      };
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Calculate fee based on payout method
   */
  calculateFee(amount: number, method: PayoutMethod, isInstant: boolean = false): number {
    let fee = 0;

    // Platform fee
    fee += amount * (this.config.platformFeePercent / 100);

    // Method-specific fees
    switch (method) {
      case "wallet":
        // No additional fee for wallet
        break;
      case "bank_transfer":
        fee += this.config.withdrawalFeeFlat;
        break;
      case "mobile_money":
        fee += amount * 0.01; // 1% mobile money fee
        break;
      case "card":
        fee += amount * 0.015; // 1.5% card fee
        break;
    }

    // Instant payout surcharge
    if (isInstant) {
      fee += amount * (this.config.instantPayoutFeePercent / 100);
    }

    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Credit user's wallet
   */
  private async creditWallet(
    userId: string,
    amount: number,
    currency: string,
    payoutId: string
  ): Promise<void> {
    // Get or create wallet
    let { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("currency", currency)
      .single();

    if (!wallet) {
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: userId, currency, balance: 0 })
        .select()
        .single();
      wallet = newWallet;
    }

    const newBalance = parseFloat(wallet.balance || 0) + amount;

    // Update balance
    await supabase
      .from("wallets")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);

    // Record transaction
    await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "payout_received",
      amount,
      balance_after: newBalance,
      description: "Circle payout received",
      reference_id: payoutId,
      reference_type: "payout",
      status: "completed",
    });
  }

  /**
   * Update circle progress after payout
   */
  private async updateCircleProgress(
    circleId: string,
    cycleNumber: number,
    payoutAmount: number
  ): Promise<void> {
    const { data: circle } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (circle) {
      await supabase
        .from("circles")
        .update({
          current_cycle: cycleNumber + 1,
          cycles_completed: cycleNumber,
          total_payout_to_date: (parseFloat(circle.total_payout_to_date) || 0) + payoutAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", circleId);
    }
  }

  /**
   * Send payout notification
   */
  private async sendPayoutNotification(
    userId: string,
    payout: any,
    type: "scheduled" | "processing" | "completed" | "failed"
  ): Promise<void> {
    // Would integrate with notification service
    console.log(`[Payout Notification] User: ${userId}, Type: ${type}, Amount: ${payout.net_amount}`);
  }

  /**
   * Transform database row to Payout type
   */
  private transformPayout(row: any, circleName?: string): Payout {
    return {
      id: row.id,
      circleId: row.circle_id,
      circleName: circleName || row.circle?.name,
      recipientId: row.recipient_id,
      recipientName: row.recipient?.full_name,
      cycleNumber: row.cycle_number,
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || "USD",
      fee: parseFloat(row.fee) || 0,
      netAmount: parseFloat(row.net_amount) || 0,
      status: row.status as PayoutStatus,
      payoutMethod: row.payout_method as PayoutMethod,
      scheduledDate: row.scheduled_date,
      processedAt: row.processed_at,
      completedAt: row.completed_at,
      failureReason: row.failure_reason,
      retryCount: row.retry_count || 0,
      transactionId: row.transaction_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get payout by ID
   */
  async getPayout(payoutId: string): Promise<Payout | null> {
    const { data, error } = await supabase
      .from("payouts")
      .select("*, circle:circles(name), recipient:profiles(full_name)")
      .eq("id", payoutId)
      .single();

    if (error || !data) return null;
    return this.transformPayout(data);
  }

  /**
   * Get payouts for a circle
   */
  async getCirclePayouts(circleId: string): Promise<Payout[]> {
    const { data, error } = await supabase
      .from("payouts")
      .select("*, circle:circles(name), recipient:profiles(full_name)")
      .eq("circle_id", circleId)
      .order("cycle_number", { ascending: true });

    if (error) return [];
    return (data || []).map((p) => this.transformPayout(p));
  }

  /**
   * Get payouts for a user (as recipient)
   */
  async getUserPayouts(userId: string): Promise<Payout[]> {
    const { data, error } = await supabase
      .from("payouts")
      .select("*, circle:circles(name)")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false });

    if (error) return [];
    return (data || []).map((p) => this.transformPayout(p));
  }

  /**
   * Get upcoming payouts for a user
   */
  async getUpcomingPayouts(userId: string): Promise<Payout[]> {
    const { data, error } = await supabase
      .from("payouts")
      .select("*, circle:circles(name)")
      .eq("recipient_id", userId)
      .in("status", ["scheduled", "pending"])
      .gte("scheduled_date", new Date().toISOString())
      .order("scheduled_date", { ascending: true });

    if (error) return [];
    return (data || []).map((p) => this.transformPayout(p));
  }

  /**
   * Get payout summary for a circle
   */
  async getCirclePayoutSummary(circleId: string): Promise<CirclePayoutSummary> {
    const { data: circle } = await supabase
      .from("circles")
      .select("name")
      .eq("id", circleId)
      .single();

    const payouts = await this.getCirclePayouts(circleId);
    const completed = payouts.filter((p) => p.status === "completed");
    const totalPaid = completed.reduce((sum, p) => sum + p.netAmount, 0);

    const nextPayout = payouts.find((p) =>
      p.status === "scheduled" || p.status === "pending"
    );

    return {
      circleId,
      circleName: circle?.name || "Unknown Circle",
      totalPayouts: payouts.length,
      completedPayouts: completed.length,
      totalAmountPaid: totalPaid,
      nextPayout: nextPayout
        ? {
            recipientId: nextPayout.recipientId,
            recipientName: nextPayout.recipientName || "Unknown",
            scheduledDate: nextPayout.scheduledDate,
            amount: nextPayout.amount,
          }
        : undefined,
      payoutHistory: payouts,
    };
  }

  // ============================================================================
  // CRON / SCHEDULED TASKS
  // ============================================================================

  /**
   * Process all pending payouts (to be called by cron job)
   */
  async processScheduledPayouts(): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    const now = new Date().toISOString();

    // Get all scheduled payouts that are due
    const { data: duePayouts } = await supabase
      .from("payouts")
      .select("id")
      .in("status", ["scheduled", "pending"])
      .lte("scheduled_date", now)
      .order("scheduled_date", { ascending: true })
      .limit(50); // Process in batches

    let processed = 0;
    let successful = 0;
    let failed = 0;

    for (const payout of duePayouts || []) {
      const result = await this.processPayout(payout.id);
      processed++;
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return { processed, successful, failed };
  }
}

// Export default instance
export const payoutService = new PayoutService();

// Export convenience functions
export const schedulePayout = (
  circleId: string,
  recipientId: string,
  cycleNumber: number,
  scheduledDate: string,
  method?: PayoutMethod
) => payoutService.schedulePayout(circleId, recipientId, cycleNumber, scheduledDate, method);

export const processPayout = (payoutId: string) =>
  payoutService.processPayout(payoutId);

export const checkPayoutEligibility = (circleId: string, cycleNumber: number) =>
  payoutService.checkPayoutEligibility(circleId, cycleNumber);

export const generatePayoutSchedule = (circleId: string, method?: RotationMethod) =>
  payoutService.generatePayoutSchedule(circleId, method);

export const getUserPayouts = (userId: string) =>
  payoutService.getUserPayouts(userId);

export const getUpcomingPayouts = (userId: string) =>
  payoutService.getUpcomingPayouts(userId);

// ============================================================================
// ADDITIONAL TYPES FOR PAYOUT METHODS AND REQUESTS
// ============================================================================

export interface PayoutMethodDetails {
  id: string;
  userId: string;
  methodType: "wallet" | "bank_transfer" | "mobile_money" | "card" | "cash";
  isDefault: boolean;
  isVerified: boolean;
  verificationDate?: string;

  // Bank transfer
  bankName?: string;
  accountNumber?: string;
  routingNumber?: string;
  accountHolderName?: string;
  bankCountry?: string;

  // Mobile money
  mobileProvider?: string;
  mobileNumber?: string;

  // Card
  cardToken?: string;
  cardLastFour?: string;
  cardBrand?: string;

  nickname?: string;
  isActive: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Re-export as PayoutMethod for hook compatibility
export { PayoutMethodDetails as PayoutMethod };

export interface PayoutRequest {
  id: string;
  userId: string;
  payoutId?: string;
  payoutMethodId?: string;
  amount: number;
  currency: string;
  feeAmount: number;
  netAmount: number;
  status: "pending" | "approved" | "processing" | "completed" | "failed" | "cancelled" | "refunded";
  processorReference?: string;
  processedAt?: string;
  completedAt?: string;
  failureReason?: string;
  retryCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// EXTENDED PAYOUT SERVICE METHODS
// ============================================================================

// Extend the PayoutService class with additional methods
PayoutService.prototype.getUserPayoutMethods = async function(userId: string): Promise<PayoutMethodDetails[]> {
  const { data, error } = await supabase
    .from("payout_methods")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("is_default", { ascending: false });

  if (error) throw error;
  return (data || []).map(transformPayoutMethod);
};

PayoutService.prototype.addPayoutMethod = async function(
  userId: string,
  method: Omit<PayoutMethodDetails, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<PayoutMethodDetails> {
  const { data, error } = await supabase
    .from("payout_methods")
    .insert({
      user_id: userId,
      method_type: method.methodType,
      is_default: method.isDefault,
      is_verified: method.isVerified || false,
      bank_name: method.bankName,
      account_number: method.accountNumber,
      routing_number: method.routingNumber,
      account_holder_name: method.accountHolderName,
      bank_country: method.bankCountry,
      mobile_provider: method.mobileProvider,
      mobile_number: method.mobileNumber,
      card_token: method.cardToken,
      card_last_four: method.cardLastFour,
      card_brand: method.cardBrand,
      nickname: method.nickname,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return transformPayoutMethod(data);
};

PayoutService.prototype.updatePayoutMethod = async function(
  methodId: string,
  updates: Partial<PayoutMethodDetails>
): Promise<void> {
  const dbUpdates: any = {};
  if (updates.methodType) dbUpdates.method_type = updates.methodType;
  if (updates.isDefault !== undefined) dbUpdates.is_default = updates.isDefault;
  if (updates.isVerified !== undefined) dbUpdates.is_verified = updates.isVerified;
  if (updates.bankName) dbUpdates.bank_name = updates.bankName;
  if (updates.accountNumber) dbUpdates.account_number = updates.accountNumber;
  if (updates.routingNumber) dbUpdates.routing_number = updates.routingNumber;
  if (updates.accountHolderName) dbUpdates.account_holder_name = updates.accountHolderName;
  if (updates.mobileProvider) dbUpdates.mobile_provider = updates.mobileProvider;
  if (updates.mobileNumber) dbUpdates.mobile_number = updates.mobileNumber;
  if (updates.nickname) dbUpdates.nickname = updates.nickname;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { error } = await supabase
    .from("payout_methods")
    .update(dbUpdates)
    .eq("id", methodId);

  if (error) throw error;
};

PayoutService.prototype.deletePayoutMethod = async function(methodId: string): Promise<void> {
  const { error } = await supabase
    .from("payout_methods")
    .update({ is_active: false })
    .eq("id", methodId);

  if (error) throw error;
};

PayoutService.prototype.setDefaultPayoutMethod = async function(methodId: string): Promise<void> {
  // Get the method to find the user
  const { data: method } = await supabase
    .from("payout_methods")
    .select("user_id")
    .eq("id", methodId)
    .single();

  if (!method) throw new Error("Payout method not found");

  // Clear other defaults
  await supabase
    .from("payout_methods")
    .update({ is_default: false })
    .eq("user_id", method.user_id);

  // Set this one as default
  const { error } = await supabase
    .from("payout_methods")
    .update({ is_default: true })
    .eq("id", methodId);

  if (error) throw error;
};

PayoutService.prototype.getUserPayoutRequests = async function(userId: string): Promise<PayoutRequest[]> {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(transformPayoutRequest);
};

PayoutService.prototype.requestWithdrawal = async function(
  userId: string,
  payoutId: string,
  methodId: string
): Promise<PayoutRequest> {
  // Get the payout details
  const { data: payout } = await supabase
    .from("payouts")
    .select("*")
    .eq("id", payoutId)
    .single();

  if (!payout) throw new Error("Payout not found");

  // Get fee configuration for the method
  const { data: method } = await supabase
    .from("payout_methods")
    .select("method_type")
    .eq("id", methodId)
    .single();

  if (!method) throw new Error("Payout method not found");

  const { data: feeConfig } = await supabase
    .from("payout_fees")
    .select("*")
    .eq("method_type", method.method_type)
    .single();

  // Calculate fee
  let feeAmount = 0;
  if (feeConfig) {
    feeAmount = Math.max(
      feeConfig.min_fee || 0,
      feeConfig.flat_fee + (payout.net_amount * (feeConfig.percentage_fee || 0))
    );
    if (feeConfig.max_fee) {
      feeAmount = Math.min(feeAmount, feeConfig.max_fee);
    }
  }

  const netAmount = payout.net_amount - feeAmount;

  const { data: request, error } = await supabase
    .from("payout_requests")
    .insert({
      user_id: userId,
      payout_id: payoutId,
      payout_method_id: methodId,
      amount: payout.net_amount,
      currency: payout.currency,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return transformPayoutRequest(request);
};

PayoutService.prototype.cancelPayoutRequest = async function(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("payout_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) throw error;
};

// Helper functions
function transformPayoutMethod(row: any): PayoutMethodDetails {
  return {
    id: row.id,
    userId: row.user_id,
    methodType: row.method_type,
    isDefault: row.is_default,
    isVerified: row.is_verified,
    verificationDate: row.verification_date,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    routingNumber: row.routing_number,
    accountHolderName: row.account_holder_name,
    bankCountry: row.bank_country,
    mobileProvider: row.mobile_provider,
    mobileNumber: row.mobile_number,
    cardToken: row.card_token,
    cardLastFour: row.card_last_four,
    cardBrand: row.card_brand,
    nickname: row.nickname,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transformPayoutRequest(row: any): PayoutRequest {
  return {
    id: row.id,
    userId: row.user_id,
    payoutId: row.payout_id,
    payoutMethodId: row.payout_method_id,
    amount: parseFloat(row.amount) || 0,
    currency: row.currency,
    feeAmount: parseFloat(row.fee_amount) || 0,
    netAmount: parseFloat(row.net_amount) || 0,
    status: row.status,
    processorReference: row.processor_reference,
    processedAt: row.processed_at,
    completedAt: row.completed_at,
    failureReason: row.failure_reason,
    retryCount: row.retry_count || 0,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
