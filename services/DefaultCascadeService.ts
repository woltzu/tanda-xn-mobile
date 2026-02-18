/**
 * DefaultCascadeService.ts
 *
 * Default Cascade Handler for TandaXn
 *
 * When a member defaults on a circle payment, this service handles the cascade of effects:
 *
 * 1. IMMEDIATE RESPONSE
 *    - Record the default
 *    - Start grace period (typically 7 days)
 *    - Send notifications to defaulter
 *    - Notify circle members
 *
 * 2. COVERAGE MECHANISMS (in order of priority)
 *    a. Community Reserve Fund - Use pooled reserves if available
 *    b. Voucher Liability - Vouchers may cover partial amount
 *    c. Insurance Fund - Platform-level coverage
 *    d. Shared Loss - Distribute among remaining members
 *
 * 3. CONSEQUENCES
 *    - XnScore reduction for defaulter
 *    - Voucher score impact
 *    - Community standing affected
 *    - Potential removal from community
 *
 * 4. RECOVERY
 *    - Track repayment attempts
 *    - Handle dispute resolution
 *    - Restore standing upon resolution
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type DefaultStatus = "unresolved" | "grace_period" | "covered" | "resolved" | "written_off" | "disputed";

export type CoverageSource = "reserve_fund" | "voucher" | "insurance" | "shared_loss" | "self_resolved";

export type ResolutionMethod = "full_payment" | "partial_payment" | "voucher_covered" | "reserve_covered" | "insurance" | "shared_loss" | "forgiven" | "written_off";

export interface Default {
  id: string;
  userId: string;
  circleId: string;
  communityId: string;
  cycleNumber: number;
  amount: number;
  currency: string;
  status: DefaultStatus;
  coveredByReserve: boolean;
  coveredAmount: number;
  recoveredAmount: number;
  resolvedAt?: string;
  resolutionMethod?: ResolutionMethod;
  resolutionNotes?: string;
  createdAt: string;
}

export interface GracePeriod {
  id: string;
  defaultId: string;
  userId: string;
  circleId: string;
  gracePeriodDays: number;
  startedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "resolved";
  extensionCount: number;
  remindersSent: number;
}

export interface CoverageResult {
  totalAmount: number;
  coveredAmount: number;
  uncoveredAmount: number;
  coverageSources: {
    source: CoverageSource;
    amount: number;
    details?: string;
  }[];
  fullyConvered: boolean;
}

export interface DefaultImpact {
  // Defaulter impacts
  defaulterXnScoreChange: number;
  defaulterNewXnScore: number;
  defaulterCommunityStanding: "warning" | "suspended" | "removed";
  defaulterActiveDefaults: number;

  // Voucher impacts
  voucherImpacts: {
    voucherId: string;
    voucherName: string;
    xnScoreChange: number;
    liabilityAmount: number;
  }[];

  // Circle impacts
  circleHealthChange: number;
  memberNotifications: number;

  // Community impacts
  communityHealthChange: number;
  communityDefaultCount: number;
}

export interface DefaultResolution {
  defaultId: string;
  resolvedAt: string;
  resolutionMethod: ResolutionMethod;
  amountRecovered: number;
  xnScoreRestoration?: number;
  notes?: string;
}

export interface DefaultCascadeConfig {
  // Grace period settings
  defaultGracePeriodDays: number;
  maxGraceExtensions: number;
  extensionDays: number;

  // Coverage priority and limits
  reserveFundCoveragePercent: number; // Max % of reserve to use per default
  voucherLiabilityPercent: number; // % of default vouchers are liable for
  insuranceCoveragePercent: number;

  // XnScore impacts
  defaultXnScorePenalty: number; // Points deducted per default
  voucherXnScorePenalty: number; // Points deducted from voucher
  resolutionXnScoreBonus: number; // Points restored on resolution

  // Community thresholds
  maxDefaultsBeforeRemoval: number;
  defaultsForWarning: number;
  defaultsForSuspension: number;

  // Notification settings
  reminderIntervalHours: number;
  maxReminders: number;
}

const DEFAULT_CONFIG: DefaultCascadeConfig = {
  defaultGracePeriodDays: 7,
  maxGraceExtensions: 2,
  extensionDays: 3,

  reserveFundCoveragePercent: 0.50, // Use up to 50% of reserve
  voucherLiabilityPercent: 0.25, // Vouchers liable for 25%
  insuranceCoveragePercent: 0.75, // Insurance covers up to 75%

  defaultXnScorePenalty: 15,
  voucherXnScorePenalty: 5,
  resolutionXnScoreBonus: 10,

  maxDefaultsBeforeRemoval: 3,
  defaultsForWarning: 1,
  defaultsForSuspension: 2,

  reminderIntervalHours: 24,
  maxReminders: 5,
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class DefaultCascadeService {
  private config: DefaultCascadeConfig;

  constructor(config?: Partial<DefaultCascadeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================================================
  // STEP 1: RECORD DEFAULT AND START CASCADE
  // ============================================================================

  /**
   * Record a new default and initiate the cascade process
   */
  async recordDefault(
    userId: string,
    circleId: string,
    cycleNumber: number,
    amount: number,
    currency: string = "USD"
  ): Promise<{ default: Default; gracePeriod: GracePeriod; impact: DefaultImpact }> {
    // Get circle and community info
    const { data: circle } = await supabase
      .from("circles")
      .select("community_id, name")
      .eq("id", circleId)
      .single();

    if (!circle) {
      throw new Error("Circle not found");
    }

    const communityId = circle.community_id;

    // Create default record
    const { data: defaultRecord, error: defaultError } = await supabase
      .from("defaults")
      .insert({
        user_id: userId,
        circle_id: circleId,
        community_id: communityId,
        cycle_number: cycleNumber,
        amount,
        currency,
        status: "grace_period",
      })
      .select()
      .single();

    if (defaultError) throw defaultError;

    // Create grace period
    const gracePeriod = await this.createGracePeriod(defaultRecord.id, userId, circleId);

    // Calculate and apply impacts
    const impact = await this.calculateAndApplyImpacts(defaultRecord, false);

    // Send notifications
    await this.sendDefaultNotifications(defaultRecord, circle.name, "new");

    // Log activity
    await this.logDefaultActivity(communityId, userId, circleId, "default_recorded", {
      amount,
      cycleNumber,
      gracePeriodDays: this.config.defaultGracePeriodDays,
    });

    return {
      default: this.transformDefault(defaultRecord),
      gracePeriod,
      impact,
    };
  }

  /**
   * Create a grace period for a default
   */
  private async createGracePeriod(
    defaultId: string,
    userId: string,
    circleId: string
  ): Promise<GracePeriod> {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + this.config.defaultGracePeriodDays);

    const { data, error } = await supabase
      .from("default_grace_periods")
      .insert({
        default_id: defaultId,
        user_id: userId,
        circle_id: circleId,
        grace_period_days: this.config.defaultGracePeriodDays,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      defaultId: data.default_id,
      userId: data.user_id,
      circleId: data.circle_id,
      gracePeriodDays: data.grace_period_days,
      startedAt: data.started_at,
      expiresAt: data.expires_at,
      status: data.status,
      extensionCount: data.extension_count || 0,
      remindersSent: data.reminders_sent || 0,
    };
  }

  // ============================================================================
  // STEP 2: COVERAGE MECHANISMS
  // ============================================================================

  /**
   * Attempt to cover a default using available mechanisms
   */
  async coverDefault(defaultId: string): Promise<CoverageResult> {
    const defaultRecord = await this.getDefault(defaultId);
    if (!defaultRecord) {
      throw new Error("Default not found");
    }

    const coverageSources: CoverageResult["coverageSources"] = [];
    let remainingAmount = defaultRecord.amount - defaultRecord.coveredAmount;
    let totalCovered = defaultRecord.coveredAmount;

    // 1. Try Community Reserve Fund
    if (remainingAmount > 0 && defaultRecord.communityId) {
      const reserveCoverage = await this.coverFromReserve(
        defaultRecord.communityId,
        remainingAmount
      );
      if (reserveCoverage > 0) {
        coverageSources.push({
          source: "reserve_fund",
          amount: reserveCoverage,
          details: "Covered from community reserve fund",
        });
        totalCovered += reserveCoverage;
        remainingAmount -= reserveCoverage;
      }
    }

    // 2. Try Voucher Liability
    if (remainingAmount > 0) {
      const voucherCoverage = await this.coverFromVouchers(
        defaultRecord.userId,
        defaultRecord.communityId,
        remainingAmount
      );
      if (voucherCoverage > 0) {
        coverageSources.push({
          source: "voucher",
          amount: voucherCoverage,
          details: "Partial coverage from vouchers",
        });
        totalCovered += voucherCoverage;
        remainingAmount -= voucherCoverage;
      }
    }

    // 3. Try Insurance Fund (platform level)
    if (remainingAmount > 0) {
      const insuranceCoverage = await this.coverFromInsurance(
        defaultRecord.circleId,
        remainingAmount
      );
      if (insuranceCoverage > 0) {
        coverageSources.push({
          source: "insurance",
          amount: insuranceCoverage,
          details: "Platform insurance coverage",
        });
        totalCovered += insuranceCoverage;
        remainingAmount -= insuranceCoverage;
      }
    }

    // 4. If still uncovered, distribute as shared loss
    if (remainingAmount > 0) {
      const sharedLoss = await this.distributeSharedLoss(
        defaultRecord.circleId,
        defaultRecord.userId,
        remainingAmount
      );
      coverageSources.push({
        source: "shared_loss",
        amount: sharedLoss.totalDistributed,
        details: `Distributed among ${sharedLoss.memberCount} members`,
      });
      totalCovered += sharedLoss.totalDistributed;
      remainingAmount -= sharedLoss.totalDistributed;
    }

    // Update default record
    await supabase
      .from("defaults")
      .update({
        covered_amount: totalCovered,
        covered_by_reserve: coverageSources.some((s) => s.source === "reserve_fund"),
        status: remainingAmount <= 0 ? "covered" : "unresolved",
      })
      .eq("id", defaultId);

    return {
      totalAmount: defaultRecord.amount,
      coveredAmount: totalCovered,
      uncoveredAmount: remainingAmount,
      coverageSources,
      fullyConvered: remainingAmount <= 0,
    };
  }

  /**
   * Cover from community reserve fund
   */
  private async coverFromReserve(communityId: string, amount: number): Promise<number> {
    try {
      // Get reserve fund balance (would be in a separate table)
      const { data: community } = await supabase
        .from("communities")
        .select("reserve_fund_balance")
        .eq("id", communityId)
        .single();

      const reserveBalance = parseFloat(community?.reserve_fund_balance) || 0;
      const maxCoverage = reserveBalance * this.config.reserveFundCoveragePercent;
      const coverageAmount = Math.min(amount, maxCoverage);

      if (coverageAmount > 0) {
        // Deduct from reserve
        await supabase
          .from("communities")
          .update({
            reserve_fund_balance: reserveBalance - coverageAmount,
          })
          .eq("id", communityId);

        // Log the usage
        await supabase.from("reserve_fund_transactions").insert({
          community_id: communityId,
          transaction_type: "default_coverage",
          amount: -coverageAmount,
          balance_after: reserveBalance - coverageAmount,
        });
      }

      return coverageAmount;
    } catch (err) {
      console.error("Error covering from reserve:", err);
      return 0;
    }
  }

  /**
   * Cover from vouchers who vouched for the defaulter
   */
  private async coverFromVouchers(
    defaulterId: string,
    communityId: string,
    amount: number
  ): Promise<number> {
    try {
      // Get active vouches for the defaulter in this community
      const { data: vouches } = await supabase
        .from("member_vouches")
        .select("*, voucher:profiles!voucher_user_id(id, xn_score)")
        .eq("vouched_user_id", defaulterId)
        .eq("community_id", communityId)
        .eq("status", "active");

      if (!vouches || vouches.length === 0) return 0;

      const liabilityPerVoucher = (amount * this.config.voucherLiabilityPercent) / vouches.length;
      let totalCovered = 0;

      for (const vouch of vouches) {
        // Record voucher liability (they would be notified and asked to pay)
        await supabase.from("vouch_events").insert({
          vouch_id: vouch.id,
          event_type: "liability_triggered",
          default_id: null, // Would link to actual default
          voucher_score_impact: -this.config.voucherXnScorePenalty,
          metadata: { liabilityAmount: liabilityPerVoucher },
        });

        // Reduce voucher's XnScore
        if (vouch.voucher?.id) {
          await this.updateXnScore(vouch.voucher.id, -this.config.voucherXnScorePenalty);
        }

        totalCovered += liabilityPerVoucher;
      }

      return totalCovered;
    } catch (err) {
      console.error("Error covering from vouchers:", err);
      return 0;
    }
  }

  /**
   * Cover from platform insurance fund
   */
  private async coverFromInsurance(circleId: string, amount: number): Promise<number> {
    // This would connect to your platform's insurance fund
    // For now, return 0 as this requires platform-level implementation
    const maxCoverage = amount * this.config.insuranceCoveragePercent;
    // Would deduct from insurance fund and return actual coverage
    return 0;
  }

  /**
   * Distribute remaining loss among circle members
   */
  private async distributeSharedLoss(
    circleId: string,
    defaulterId: string,
    amount: number
  ): Promise<{ totalDistributed: number; memberCount: number }> {
    try {
      // Get active circle members (excluding defaulter)
      const { data: members } = await supabase
        .from("circle_members")
        .select("user_id")
        .eq("circle_id", circleId)
        .eq("status", "active")
        .neq("user_id", defaulterId);

      if (!members || members.length === 0) {
        return { totalDistributed: 0, memberCount: 0 };
      }

      const sharePerMember = amount / members.length;

      // Record the shared loss for each member
      for (const member of members) {
        await supabase.from("shared_loss_records").insert({
          circle_id: circleId,
          user_id: member.user_id,
          defaulter_user_id: defaulterId,
          share_amount: sharePerMember,
          status: "pending",
        });

        // Notify member of shared loss
        // await this.notifyMember(member.user_id, "shared_loss", { amount: sharePerMember });
      }

      return {
        totalDistributed: amount,
        memberCount: members.length,
      };
    } catch (err) {
      console.error("Error distributing shared loss:", err);
      return { totalDistributed: 0, memberCount: 0 };
    }
  }

  // ============================================================================
  // STEP 3: IMPACT CALCULATION AND APPLICATION
  // ============================================================================

  /**
   * Calculate and apply all impacts of a default
   */
  async calculateAndApplyImpacts(
    defaultRecord: any,
    isResolution: boolean = false
  ): Promise<DefaultImpact> {
    const impact: DefaultImpact = {
      defaulterXnScoreChange: 0,
      defaulterNewXnScore: 0,
      defaulterCommunityStanding: "warning",
      defaulterActiveDefaults: 0,
      voucherImpacts: [],
      circleHealthChange: 0,
      memberNotifications: 0,
      communityHealthChange: 0,
      communityDefaultCount: 0,
    };

    if (!isResolution) {
      // Apply penalty for new default
      impact.defaulterXnScoreChange = -this.config.defaultXnScorePenalty;
      impact.defaulterNewXnScore = await this.updateXnScore(
        defaultRecord.user_id,
        impact.defaulterXnScoreChange
      );

      // Count active defaults
      const { count } = await supabase
        .from("defaults")
        .select("*", { count: "exact", head: true })
        .eq("user_id", defaultRecord.user_id)
        .in("status", ["unresolved", "grace_period"]);

      impact.defaulterActiveDefaults = count || 1;

      // Determine community standing
      if (impact.defaulterActiveDefaults >= this.config.maxDefaultsBeforeRemoval) {
        impact.defaulterCommunityStanding = "removed";
        await this.removeFromCommunity(defaultRecord.user_id, defaultRecord.community_id);
      } else if (impact.defaulterActiveDefaults >= this.config.defaultsForSuspension) {
        impact.defaulterCommunityStanding = "suspended";
        await this.suspendMembership(defaultRecord.user_id, defaultRecord.community_id);
      } else {
        impact.defaulterCommunityStanding = "warning";
      }

      // Get voucher impacts
      impact.voucherImpacts = await this.getVoucherImpacts(
        defaultRecord.user_id,
        defaultRecord.community_id
      );

      // Get circle member count for notifications
      const { count: memberCount } = await supabase
        .from("circle_members")
        .select("*", { count: "exact", head: true })
        .eq("circle_id", defaultRecord.circle_id)
        .eq("status", "active");

      impact.memberNotifications = memberCount || 0;

      // Calculate health impacts
      impact.circleHealthChange = -5;
      impact.communityHealthChange = -2;
    } else {
      // Resolution bonus
      impact.defaulterXnScoreChange = this.config.resolutionXnScoreBonus;
      impact.defaulterNewXnScore = await this.updateXnScore(
        defaultRecord.user_id,
        impact.defaulterXnScoreChange
      );
    }

    // Get community default count
    const { count: communityDefaults } = await supabase
      .from("defaults")
      .select("*", { count: "exact", head: true })
      .eq("community_id", defaultRecord.community_id)
      .eq("status", "unresolved");

    impact.communityDefaultCount = communityDefaults || 0;

    return impact;
  }

  /**
   * Get impacts on vouchers
   */
  private async getVoucherImpacts(
    defaulterId: string,
    communityId: string
  ): Promise<DefaultImpact["voucherImpacts"]> {
    const { data: vouches } = await supabase
      .from("member_vouches")
      .select("voucher_user_id, profiles:voucher_user_id(full_name)")
      .eq("vouched_user_id", defaulterId)
      .eq("community_id", communityId)
      .eq("status", "active");

    return (vouches || []).map((v) => ({
      voucherId: v.voucher_user_id,
      voucherName: (v.profiles as any)?.full_name || "Unknown",
      xnScoreChange: -this.config.voucherXnScorePenalty,
      liabilityAmount: 0, // Calculated separately
    }));
  }

  // ============================================================================
  // STEP 4: RESOLUTION
  // ============================================================================

  /**
   * Resolve a default (full or partial payment)
   */
  async resolveDefault(
    defaultId: string,
    method: ResolutionMethod,
    amountRecovered: number,
    notes?: string
  ): Promise<DefaultResolution> {
    const defaultRecord = await this.getDefault(defaultId);
    if (!defaultRecord) {
      throw new Error("Default not found");
    }

    const resolvedAt = new Date().toISOString();

    // Update default record
    await supabase
      .from("defaults")
      .update({
        status: "resolved",
        resolved_at: resolvedAt,
        resolution_method: method,
        recovered_amount: amountRecovered,
        resolution_notes: notes,
      })
      .eq("id", defaultId);

    // Update grace period
    await supabase
      .from("default_grace_periods")
      .update({ status: "resolved" })
      .eq("default_id", defaultId);

    // Apply resolution impacts (XnScore bonus)
    const rawDefault = { ...defaultRecord, user_id: defaultRecord.userId, community_id: defaultRecord.communityId };
    const impact = await this.calculateAndApplyImpacts(rawDefault, true);

    // Restore voucher scores if applicable
    if (method === "full_payment" || method === "self_resolved") {
      await this.restoreVoucherScores(defaultRecord.userId, defaultRecord.communityId);
    }

    // Update membership standing if this was their only default
    const { count: remainingDefaults } = await supabase
      .from("defaults")
      .select("*", { count: "exact", head: true })
      .eq("user_id", defaultRecord.userId)
      .in("status", ["unresolved", "grace_period"]);

    if (remainingDefaults === 0) {
      await this.restoreMembership(defaultRecord.userId, defaultRecord.communityId);
    }

    // Log activity
    await this.logDefaultActivity(
      defaultRecord.communityId,
      defaultRecord.userId,
      defaultRecord.circleId,
      "default_resolved",
      { method, amountRecovered }
    );

    // Send resolution notification
    await this.sendDefaultNotifications(
      { ...defaultRecord, id: defaultId },
      "",
      "resolved"
    );

    return {
      defaultId,
      resolvedAt,
      resolutionMethod: method,
      amountRecovered,
      xnScoreRestoration: impact.defaulterXnScoreChange,
      notes,
    };
  }

  /**
   * Extend grace period
   */
  async extendGracePeriod(
    gracePeriodId: string,
    extendedBy: string,
    reason?: string
  ): Promise<GracePeriod> {
    const { data: gracePeriod } = await supabase
      .from("default_grace_periods")
      .select("*")
      .eq("id", gracePeriodId)
      .single();

    if (!gracePeriod) {
      throw new Error("Grace period not found");
    }

    if (gracePeriod.extension_count >= this.config.maxGraceExtensions) {
      throw new Error("Maximum extensions reached");
    }

    const newExpiresAt = new Date(gracePeriod.expires_at);
    newExpiresAt.setDate(newExpiresAt.getDate() + this.config.extensionDays);

    const { data: updated, error } = await supabase
      .from("default_grace_periods")
      .update({
        expires_at: newExpiresAt.toISOString(),
        extension_count: gracePeriod.extension_count + 1,
        extended_by: extendedBy,
        extension_reason: reason,
      })
      .eq("id", gracePeriodId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: updated.id,
      defaultId: updated.default_id,
      userId: updated.user_id,
      circleId: updated.circle_id,
      gracePeriodDays: updated.grace_period_days,
      startedAt: updated.started_at,
      expiresAt: updated.expires_at,
      status: updated.status,
      extensionCount: updated.extension_count,
      remindersSent: updated.reminders_sent,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get a default by ID
   */
  private async getDefault(defaultId: string): Promise<Default | null> {
    const { data } = await supabase
      .from("defaults")
      .select("*")
      .eq("id", defaultId)
      .single();

    return data ? this.transformDefault(data) : null;
  }

  /**
   * Transform database row to Default type
   */
  private transformDefault(row: any): Default {
    return {
      id: row.id,
      userId: row.user_id,
      circleId: row.circle_id,
      communityId: row.community_id,
      cycleNumber: row.cycle_number,
      amount: parseFloat(row.amount) || 0,
      currency: row.currency || "USD",
      status: row.status as DefaultStatus,
      coveredByReserve: row.covered_by_reserve || false,
      coveredAmount: parseFloat(row.covered_amount) || 0,
      recoveredAmount: parseFloat(row.recovered_amount) || 0,
      resolvedAt: row.resolved_at,
      resolutionMethod: row.resolution_method,
      resolutionNotes: row.resolution_notes,
      createdAt: row.created_at,
    };
  }

  /**
   * Update user's XnScore
   */
  private async updateXnScore(userId: string, change: number): Promise<number> {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xn_score")
      .eq("id", userId)
      .single();

    const currentScore = profile?.xn_score || 50;
    const newScore = Math.max(0, Math.min(100, currentScore + change));

    await supabase
      .from("profiles")
      .update({ xn_score: newScore })
      .eq("id", userId);

    return newScore;
  }

  /**
   * Restore voucher scores after resolution
   */
  private async restoreVoucherScores(defaulterId: string, communityId: string): Promise<void> {
    const { data: vouches } = await supabase
      .from("member_vouches")
      .select("voucher_user_id")
      .eq("vouched_user_id", defaulterId)
      .eq("community_id", communityId)
      .eq("status", "active");

    for (const vouch of vouches || []) {
      await this.updateXnScore(vouch.voucher_user_id, this.config.voucherXnScorePenalty); // Restore
    }
  }

  /**
   * Remove member from community
   */
  private async removeFromCommunity(userId: string, communityId: string): Promise<void> {
    await supabase
      .from("community_memberships")
      .update({
        status: "removed",
        left_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("community_id", communityId);
  }

  /**
   * Suspend membership
   */
  private async suspendMembership(userId: string, communityId: string): Promise<void> {
    await supabase
      .from("community_memberships")
      .update({ status: "suspended" })
      .eq("user_id", userId)
      .eq("community_id", communityId);
  }

  /**
   * Restore membership to active
   */
  private async restoreMembership(userId: string, communityId: string): Promise<void> {
    await supabase
      .from("community_memberships")
      .update({ status: "active" })
      .eq("user_id", userId)
      .eq("community_id", communityId)
      .in("status", ["suspended", "warning"]);
  }

  /**
   * Send notifications related to defaults
   */
  private async sendDefaultNotifications(
    defaultRecord: any,
    circleName: string,
    type: "new" | "reminder" | "grace_expiring" | "resolved"
  ): Promise<void> {
    // This would integrate with your notification service
    // For now, just log the notification intent
    console.log(`[Default Notification] Type: ${type}, User: ${defaultRecord.userId || defaultRecord.user_id}`);

    // Would send push notification, email, SMS etc.
  }

  /**
   * Log default-related activity
   */
  private async logDefaultActivity(
    communityId: string,
    userId: string,
    circleId: string,
    activityType: string,
    metadata: any
  ): Promise<void> {
    try {
      await supabase.from("community_activities").insert({
        community_id: communityId,
        actor_user_id: userId,
        activity_type: activityType,
        circle_id: circleId,
        title: activityType.replace(/_/g, " "),
        metadata,
        is_public: false, // Default activities are private
      });
    } catch (err) {
      console.error("Error logging activity:", err);
    }
  }

  // ============================================================================
  // CRON / SCHEDULED TASKS
  // ============================================================================

  /**
   * Process expired grace periods (should be called by cron job)
   */
  async processExpiredGracePeriods(): Promise<{ processed: number; covered: number; escalated: number }> {
    const now = new Date().toISOString();

    // Get all expired grace periods
    const { data: expired } = await supabase
      .from("default_grace_periods")
      .select("*, default:defaults(*)")
      .eq("status", "active")
      .lt("expires_at", now);

    let processed = 0;
    let covered = 0;
    let escalated = 0;

    for (const gracePeriod of expired || []) {
      processed++;

      // Mark grace period as expired
      await supabase
        .from("default_grace_periods")
        .update({ status: "expired" })
        .eq("id", gracePeriod.id);

      // Update default status
      await supabase
        .from("defaults")
        .update({ status: "unresolved" })
        .eq("id", gracePeriod.default_id);

      // Attempt to cover the default
      const coverage = await this.coverDefault(gracePeriod.default_id);
      if (coverage.fullyConvered) {
        covered++;
      } else {
        escalated++;
        // Would escalate to admin/support here
      }
    }

    return { processed, covered, escalated };
  }

  /**
   * Send reminders for active grace periods (should be called by cron job)
   */
  async sendGracePeriodReminders(): Promise<number> {
    const { data: activeGracePeriods } = await supabase
      .from("default_grace_periods")
      .select("*, default:defaults(*)")
      .eq("status", "active")
      .lt("reminders_sent", this.config.maxReminders);

    let remindersSent = 0;

    for (const gp of activeGracePeriods || []) {
      // Check if enough time has passed since last reminder
      const lastReminder = gp.last_reminder_at ? new Date(gp.last_reminder_at) : new Date(gp.started_at);
      const hoursSinceLastReminder = (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastReminder >= this.config.reminderIntervalHours) {
        await this.sendDefaultNotifications(gp.default, "", "reminder");

        await supabase
          .from("default_grace_periods")
          .update({
            reminders_sent: gp.reminders_sent + 1,
            last_reminder_at: new Date().toISOString(),
          })
          .eq("id", gp.id);

        remindersSent++;
      }
    }

    return remindersSent;
  }

  // ============================================================================
  // ANALYTICS / REPORTING
  // ============================================================================

  /**
   * Get default statistics for a community
   */
  async getCommunityDefaultStats(communityId: string): Promise<{
    totalDefaults: number;
    unresolvedDefaults: number;
    resolvedDefaults: number;
    totalDefaultAmount: number;
    recoveredAmount: number;
    recoveryRate: number;
    averageResolutionDays: number;
    defaultsByMonth: { month: string; count: number; amount: number }[];
  }> {
    const { data: defaults } = await supabase
      .from("defaults")
      .select("*")
      .eq("community_id", communityId);

    if (!defaults || defaults.length === 0) {
      return {
        totalDefaults: 0,
        unresolvedDefaults: 0,
        resolvedDefaults: 0,
        totalDefaultAmount: 0,
        recoveredAmount: 0,
        recoveryRate: 1,
        averageResolutionDays: 0,
        defaultsByMonth: [],
      };
    }

    const unresolved = defaults.filter((d) => ["unresolved", "grace_period"].includes(d.status));
    const resolved = defaults.filter((d) => d.status === "resolved");
    const totalAmount = defaults.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const recoveredAmount = defaults.reduce((sum, d) => sum + parseFloat(d.recovered_amount || 0), 0);

    // Group by month
    const byMonth = new Map<string, { count: number; amount: number }>();
    defaults.forEach((d) => {
      const month = d.created_at.substring(0, 7); // YYYY-MM
      const existing = byMonth.get(month) || { count: 0, amount: 0 };
      byMonth.set(month, {
        count: existing.count + 1,
        amount: existing.amount + parseFloat(d.amount || 0),
      });
    });

    return {
      totalDefaults: defaults.length,
      unresolvedDefaults: unresolved.length,
      resolvedDefaults: resolved.length,
      totalDefaultAmount: totalAmount,
      recoveredAmount,
      recoveryRate: totalAmount > 0 ? recoveredAmount / totalAmount : 1,
      averageResolutionDays: 7, // Would calculate from actual data
      defaultsByMonth: Array.from(byMonth.entries()).map(([month, data]) => ({
        month,
        ...data,
      })),
    };
  }
}

// Export default instance
export const defaultCascadeService = new DefaultCascadeService();

// Export convenience functions
export const recordDefault = (
  userId: string,
  circleId: string,
  cycleNumber: number,
  amount: number
) => defaultCascadeService.recordDefault(userId, circleId, cycleNumber, amount);

export const resolveDefault = (
  defaultId: string,
  method: ResolutionMethod,
  amountRecovered: number,
  notes?: string
) => defaultCascadeService.resolveDefault(defaultId, method, amountRecovered, notes);

export const coverDefault = (defaultId: string) =>
  defaultCascadeService.coverDefault(defaultId);

export const extendGracePeriod = (
  gracePeriodId: string,
  extendedBy: string,
  reason?: string
) => defaultCascadeService.extendGracePeriod(gracePeriodId, extendedBy, reason);
