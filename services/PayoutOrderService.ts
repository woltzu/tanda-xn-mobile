/**
 * PayoutOrderService.ts
 *
 * The Heart of TandaXn - The Hybrid Payout Order Determination Algorithm
 *
 * This is the algorithm that decides who gets paid when. It balances:
 * 1. Member Preference (autonomy) - 25%
 * 2. Financial Need (mission alignment) - 30%
 * 3. Platform Risk (sustainability) - 30%
 * 4. Fairness (everyone has a path to good positions) - 15%
 *
 * The algorithm ensures:
 * - Fair position assignment based on multiple factors
 * - Risk mitigation (risky members can't get early positions)
 * - Need prioritization (genuine emergencies get priority)
 * - Long-term fairness (flexibility is rewarded across circles)
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type PreferenceType =
  | "need_early"    // Strongly wants positions 1-3 (with commitments)
  | "prefer_early"  // Prefers early but flexible (1-5)
  | "flexible"      // No preference
  | "prefer_late";  // Prefers later position (bonus credits)

export type NeedCategory =
  | "emergency"
  | "medical"
  | "education"
  | "school_fees"
  | "housing"
  | "legal"
  | "wedding"
  | "ceremony"
  | "business"
  | "investment"
  | "travel"
  | "major_purchase"
  | "general";

export type RiskLevel = "low" | "medium" | "high" | "very_high";

export type OrderStatus = "draft" | "active" | "modified" | "archived" | "recalculated";

export interface PositionPreference {
  id: string;
  userId: string;
  circleId: string;
  preferenceType: PreferenceType;
  autoPayAgreed: boolean;
  positionLockAgreed: boolean;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NeedDeclaration {
  id: string;
  userId: string;
  circleId: string;
  category: NeedCategory;
  description?: string;
  targetDate?: string;
  targetAmount?: number;
  hasDeadline: boolean;
  deadlineDate?: string;
  urgencyScore: number;
  verified: boolean;
  verifiedBy?: string;
  verificationDocuments: string[];
  createdAt: string;
}

export interface FairnessCredits {
  userId: string;
  credits: number;
  creditsEarnedTotal: number;
  creditsSpentTotal: number;
  lastFlexibleCircleId?: string;
  lastFlexibleDate?: string;
}

export interface MemberProfile {
  userId: string;
  membership: any;
  xnScore: number;
  preference: PositionPreference | null;
  need: NeedDeclaration | null;
  history: MemberHistory;
  fairnessCredits: number;
  communityStanding: CommunityStanding;
}

export interface MemberHistory {
  tenureMonths: number;
  completedCircles: number;
  totalContributions: number;
  onTimePaymentRate: number;
  totalDefaults: number;
  latePayments: number;
  lastPosition: number | null;
  lastCircleSize: number | null;
  affordabilityRatio: number | null;
}

export interface CommunityStanding {
  role: string;
  isModerator: boolean;
  vouchesGiven: number;
  disputesHelpedResolve: number;
}

export interface ComponentScores {
  preference: number;  // 0-100
  need: number;        // 0-100
  risk: number;        // 0-100 (higher = less risky = can be earlier)
  fairness: number;    // 0-100
}

export interface PositionConstraints {
  minPosition: number;
  maxPosition: number;
  lockedPosition: number | null;
  mustBeLocked: boolean;
  reasons: string[];
  riskLevel: RiskLevel;
  riskScore: number;
}

export interface ScoredMember extends MemberProfile {
  scores: ComponentScores;
  compositeScore: number;
  constraints: PositionConstraints;
}

export interface PayoutOrderEntry {
  position: number;
  userId: string;
  userName?: string;
  scores: ComponentScores;
  compositeScore: number;
  assignedReason: string;
  isPaid?: boolean;
  payoutDate?: string;
}

export interface PayoutOrder {
  id: string;
  circleId: string;
  order: PayoutOrderEntry[];
  algorithmVersion: string;
  weights: AlgorithmWeights;
  status: OrderStatus;
  modifications: OrderModification[];
  calculatedAt: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderModification {
  type: "swap" | "recalculation" | "manual_adjustment";
  user1?: string;
  user1OldPosition?: number;
  user2?: string;
  user2OldPosition?: number;
  timestamp: string;
  reason?: string;
}

export interface AlgorithmWeights {
  preference: number;
  need: number;
  risk: number;
  fairness: number;
}

export interface AlgorithmConfig {
  weights: AlgorithmWeights;
  newMemberMaxPercentile: number;
  highRiskMaxPercentile: number;
  veryHighRiskMaxPercentile: number;
  lowXnScoreMaxPercentile: number;
  minXnScoreForEarly: number;
  minXnScoreForPosition1: number;
  newMemberMonths: number;
  newMemberMinCircles: number;
  flexibilityCreditBonus: number;
  preferLateCreditBonus: number;
  earlyPositionCreditCost: number;
}

const DEFAULT_CONFIG: AlgorithmConfig = {
  weights: {
    preference: 0.25,
    need: 0.30,
    risk: 0.30,
    fairness: 0.15,
  },
  newMemberMaxPercentile: 0.25,
  highRiskMaxPercentile: 0.30,
  veryHighRiskMaxPercentile: 0.50,
  lowXnScoreMaxPercentile: 0.40,
  minXnScoreForEarly: 60,
  minXnScoreForPosition1: 70,
  newMemberMonths: 3,
  newMemberMinCircles: 1,
  flexibilityCreditBonus: 5,
  preferLateCreditBonus: 7,
  earlyPositionCreditCost: 10,
};

// Need category weights for scoring
const NEED_CATEGORY_WEIGHTS: Record<NeedCategory, number> = {
  emergency: 35,
  medical: 30,
  education: 25,
  school_fees: 30,
  housing: 25,
  legal: 25,
  wedding: 20,
  ceremony: 15,
  business: 15,
  investment: 10,
  travel: 10,
  major_purchase: 10,
  general: 0,
};

// ============================================================================
// MAIN SERVICE CLASS
// ============================================================================

export class PayoutOrderService {
  private config: AlgorithmConfig;

  constructor(config?: Partial<AlgorithmConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (config?.weights) {
      this.config.weights = { ...DEFAULT_CONFIG.weights, ...config.weights };
    }
  }

  // ============================================================================
  // MAIN ALGORITHM - DETERMINE PAYOUT ORDER
  // ============================================================================

  /**
   * Generate the payout order for a circle
   * This is THE core algorithm of TandaXn
   */
  async determinePayoutOrder(circleId: string): Promise<PayoutOrder> {
    // Get circle and verify it's ready
    const { data: circle, error: circleError } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (circleError || !circle) {
      throw new Error("Circle not found");
    }

    // Get all active members
    const { data: memberships, error: membersError } = await supabase
      .from("circle_members")
      .select(`
        *,
        profile:profiles(id, full_name, xn_score, created_at, is_verified)
      `)
      .eq("circle_id", circleId)
      .eq("status", "active");

    if (membersError || !memberships || memberships.length === 0) {
      throw new Error("No active members found");
    }

    // Load custom config if exists
    await this.loadCircleConfig(circleId, circle.community_id);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Gather all data for each member
    // ═══════════════════════════════════════════════════════════════════════
    const memberProfiles = await this.gatherMemberProfiles(memberships, circleId, circle.community_id);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Calculate component scores for each member
    // ═══════════════════════════════════════════════════════════════════════
    const scoredMembers = this.calculateScores(memberProfiles, circle);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Apply hard constraints
    // ═══════════════════════════════════════════════════════════════════════
    // Sort by composite score (higher = earlier position preference)
    scoredMembers.sort((a, b) => b.compositeScore - a.compositeScore);

    // Apply constraints
    const constrainedOrder = this.applyConstraints(scoredMembers, circle);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Resolve conflicts and optimize
    // ═══════════════════════════════════════════════════════════════════════
    const optimizedOrder = this.resolveConflicts(constrainedOrder, circle);

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 5: Generate final order with positions
    // ═══════════════════════════════════════════════════════════════════════
    const finalOrder: PayoutOrderEntry[] = optimizedOrder.map((member, index) => ({
      position: index + 1,
      userId: member.userId,
      userName: member.membership.profile?.full_name,
      scores: member.scores,
      compositeScore: member.compositeScore,
      assignedReason: this.generateAssignmentReason(member, index + 1, circle.max_members),
      payoutDate: this.calculatePayoutDate(circle, index + 1),
    }));

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 6: Store and notify
    // ═══════════════════════════════════════════════════════════════════════
    const payoutOrder = await this.storePayoutOrder(circleId, finalOrder, memberProfiles, scoredMembers);

    // Update fairness credits
    await this.updateFairnessCredits(finalOrder, memberProfiles);

    // Store position constraints for reference
    await this.storePositionConstraints(scoredMembers, circleId);

    return payoutOrder;
  }

  // ============================================================================
  // STEP 1: GATHER MEMBER PROFILES
  // ============================================================================

  private async gatherMemberProfiles(
    memberships: any[],
    circleId: string,
    communityId?: string
  ): Promise<MemberProfile[]> {
    return Promise.all(
      memberships.map(async (membership) => {
        const userId = membership.user_id;

        // Get position preference
        const { data: preference } = await supabase
          .from("position_preferences")
          .select("*")
          .eq("user_id", userId)
          .eq("circle_id", circleId)
          .single();

        // Get need declaration
        const { data: need } = await supabase
          .from("need_declarations")
          .select("*")
          .eq("user_id", userId)
          .eq("circle_id", circleId)
          .single();

        // Get historical data
        const history = await this.getMemberHistory(userId);

        // Get fairness credits
        const { data: credits } = await supabase
          .from("fairness_credits")
          .select("credits")
          .eq("user_id", userId)
          .single();

        // Get community standing
        const communityStanding = await this.getCommunityStanding(userId, communityId);

        return {
          userId,
          membership,
          xnScore: membership.profile?.xn_score || 50,
          preference: preference ? this.transformPreference(preference) : null,
          need: need ? this.transformNeedDeclaration(need) : null,
          history,
          fairnessCredits: credits?.credits || 0,
          communityStanding,
        };
      })
    );
  }

  private async getMemberHistory(userId: string): Promise<MemberHistory> {
    // Get user creation date for tenure
    const { data: profile } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("id", userId)
      .single();

    const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date();
    const tenureMonths = this.monthsDifference(new Date(), createdAt);

    // Get completed circles
    const { count: completedCircles } = await supabase
      .from("circle_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    // Get contribution stats
    const { data: contributions } = await supabase
      .from("contributions")
      .select("status, due_date, paid_at")
      .eq("user_id", userId);

    const totalContributions = contributions?.length || 0;
    const onTimePayments = contributions?.filter(c => {
      if (!c.paid_at || !c.due_date) return false;
      return new Date(c.paid_at) <= new Date(c.due_date);
    }).length || 0;
    const onTimePaymentRate = totalContributions > 0 ? onTimePayments / totalContributions : 1;
    const latePayments = totalContributions - onTimePayments;

    // Get defaults
    const { count: totalDefaults } = await supabase
      .from("defaults")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // Get last position
    const { data: lastHistory } = await supabase
      .from("member_position_history")
      .select("position, total_positions")
      .eq("user_id", userId)
      .eq("circle_completed", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get affordability ratio from financial profile
    const { data: financial } = await supabase
      .from("financial_profiles")
      .select("debt_to_income_ratio")
      .eq("user_id", userId)
      .single();

    return {
      tenureMonths,
      completedCircles: completedCircles || 0,
      totalContributions,
      onTimePaymentRate,
      totalDefaults: totalDefaults || 0,
      latePayments,
      lastPosition: lastHistory?.position || null,
      lastCircleSize: lastHistory?.total_positions || null,
      affordabilityRatio: financial?.debt_to_income_ratio || null,
    };
  }

  private async getCommunityStanding(userId: string, communityId?: string): Promise<CommunityStanding> {
    if (!communityId) {
      return { role: "member", isModerator: false, vouchesGiven: 0, disputesHelpedResolve: 0 };
    }

    const { data: membership } = await supabase
      .from("community_members")
      .select("role")
      .eq("user_id", userId)
      .eq("community_id", communityId)
      .single();

    const { count: vouchesGiven } = await supabase
      .from("member_vouches")
      .select("*", { count: "exact", head: true })
      .eq("voucher_id", userId)
      .eq("community_id", communityId)
      .eq("status", "active");

    // For disputes - would need disputes table
    const disputesHelpedResolve = 0; // Placeholder

    return {
      role: membership?.role || "member",
      isModerator: ["moderator", "admin", "owner"].includes(membership?.role || ""),
      vouchesGiven: vouchesGiven || 0,
      disputesHelpedResolve,
    };
  }

  // ============================================================================
  // STEP 2: CALCULATE COMPONENT SCORES
  // ============================================================================

  private calculateScores(profiles: MemberProfile[], circle: any): ScoredMember[] {
    return profiles.map(profile => {
      const scores: ComponentScores = {
        preference: this.calculatePreferenceScore(profile),
        need: this.calculateNeedScore(profile),
        risk: this.calculateRiskScore(profile, circle),
        fairness: this.calculateFairnessScore(profile),
      };

      const compositeScore =
        (scores.preference * this.config.weights.preference) +
        (scores.need * this.config.weights.need) +
        (scores.risk * this.config.weights.risk) +
        (scores.fairness * this.config.weights.fairness);

      const constraints = this.determineConstraints(profile, circle);

      return {
        ...profile,
        scores,
        compositeScore,
        constraints,
      };
    });
  }

  /**
   * Calculate Preference Score (0-100)
   * Based on what the member wants
   */
  private calculatePreferenceScore(profile: MemberProfile): number {
    const { preference, xnScore } = profile;
    let score = 50; // Base score

    if (!preference) {
      return score; // No preference = neutral
    }

    switch (preference.preferenceType) {
      case "need_early":
        // Strongly wants early position
        if (xnScore >= this.config.minXnScoreForEarly) {
          score = 90; // High priority if qualified
        } else {
          score = 60; // Reduced priority if low XnScore
        }
        break;

      case "prefer_early":
        // Prefers early but flexible
        score = 70;
        break;

      case "flexible":
        // No preference - neutral
        score = 50;
        break;

      case "prefer_late":
        // Actually wants late position
        score = 20; // Low score = pushed toward later
        break;
    }

    return score;
  }

  /**
   * Calculate Need Score (0-100)
   * Based on urgency and category of need
   */
  private calculateNeedScore(profile: MemberProfile): number {
    const { need } = profile;
    let score = 50; // Base score

    if (!need) {
      return score; // No declared need = neutral
    }

    // Category-based scoring
    score += NEED_CATEGORY_WEIGHTS[need.category] || 0;

    // Deadline proximity bonus
    if (need.hasDeadline && need.deadlineDate) {
      const daysUntilDeadline = this.daysDifference(new Date(need.deadlineDate), new Date());

      if (daysUntilDeadline <= 30) {
        score += 15; // Urgent deadline
      } else if (daysUntilDeadline <= 60) {
        score += 10;
      } else if (daysUntilDeadline <= 90) {
        score += 5;
      }
    }

    // Target date proximity (for planned expenses)
    if (need.targetDate) {
      const daysUntilTarget = this.daysDifference(new Date(need.targetDate), new Date());

      if (daysUntilTarget <= 30) {
        score += 10;
      } else if (daysUntilTarget <= 60) {
        score += 5;
      }
    }

    // Verification bonus (documented need)
    if (need.verified) {
      score += 10;
    }

    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Calculate Risk Score (0-100)
   * HIGHER = LESS risky = CAN be earlier
   */
  private calculateRiskScore(profile: MemberProfile, circle: any): number {
    const { xnScore, history } = profile;
    let score = 50; // Base

    // XnScore contribution (major factor)
    if (xnScore >= 90) score += 30;
    else if (xnScore >= 80) score += 25;
    else if (xnScore >= 70) score += 20;
    else if (xnScore >= 60) score += 10;
    else if (xnScore >= 50) score += 0;
    else if (xnScore >= 40) score -= 15;
    else score -= 30;

    // Circle completion history
    if (history.completedCircles >= 5) score += 20;
    else if (history.completedCircles >= 3) score += 15;
    else if (history.completedCircles >= 1) score += 10;
    else score -= 10; // No completed circles

    // Payment history
    if (history.onTimePaymentRate >= 0.98) score += 15;
    else if (history.onTimePaymentRate >= 0.95) score += 10;
    else if (history.onTimePaymentRate >= 0.90) score += 5;
    else if (history.onTimePaymentRate < 0.80) score -= 20;

    // Default history (severe penalty)
    if (history.totalDefaults > 0) {
      score -= (history.totalDefaults * 25);
    }

    // Platform tenure
    if (history.tenureMonths >= 24) score += 10;
    else if (history.tenureMonths >= 12) score += 5;
    else if (history.tenureMonths < 3) score -= 10;

    // Auto-pay enabled (commitment signal)
    if (profile.membership.auto_pay_enabled) {
      score += 10;
    }

    // Affordability
    if (history.affordabilityRatio !== null) {
      if (history.affordabilityRatio < 0.20) score += 10; // Very affordable
      else if (history.affordabilityRatio > 0.40) score -= 15; // Stretched
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate Fairness Score (0-100)
   * Based on past positions and accumulated flexibility credits
   */
  private calculateFairnessScore(profile: MemberProfile): number {
    const { fairnessCredits, history, communityStanding } = profile;
    let score = 50; // Base

    // Fairness credits from being flexible in past
    score += Math.min(25, fairnessCredits * 2); // Cap at +25

    // Previous position adjustment
    if (history.lastPosition !== null && history.lastCircleSize !== null) {
      const lastPositionPercentile = history.lastPosition / history.lastCircleSize;

      // If they were in the back half last time, boost them
      if (lastPositionPercentile > 0.7) {
        score += 20; // Was late last time
      } else if (lastPositionPercentile > 0.5) {
        score += 10;
      }
    }

    // Community standing bonus
    if (communityStanding.isModerator) score += 10;
    if (communityStanding.vouchesGiven >= 3) score += 5;
    if (communityStanding.disputesHelpedResolve >= 1) score += 5;

    return Math.min(100, score);
  }

  // ============================================================================
  // STEP 3: DETERMINE CONSTRAINTS
  // ============================================================================

  private determineConstraints(profile: MemberProfile, circle: any): PositionConstraints {
    const constraints: PositionConstraints = {
      minPosition: 1,
      maxPosition: circle.max_members || 10,
      lockedPosition: null,
      mustBeLocked: false,
      reasons: [],
      riskLevel: "low",
      riskScore: 0,
    };

    const { xnScore, history, preference, need } = profile;
    const totalPositions = circle.max_members || 10;

    // Calculate risk level
    const { riskLevel, riskScore } = this.calculateRiskLevel(profile);
    constraints.riskLevel = riskLevel;
    constraints.riskScore = riskScore;

    // NEW MEMBER CONSTRAINT
    // New members (< 3 months, no completed circles) can't be in top 25%
    if (history.tenureMonths < this.config.newMemberMonths &&
        history.completedCircles < this.config.newMemberMinCircles) {
      const newMinPos = Math.ceil(totalPositions * this.config.newMemberMaxPercentile) + 1;
      constraints.minPosition = Math.max(constraints.minPosition, newMinPos);
      constraints.reasons.push("new_member");
    }

    // HIGH RISK CONSTRAINT
    if (riskLevel === "very_high") {
      const minPos = Math.ceil(totalPositions * this.config.veryHighRiskMaxPercentile) + 1;
      constraints.minPosition = Math.max(constraints.minPosition, minPos);
      constraints.reasons.push("very_high_risk");
    } else if (riskLevel === "high") {
      const minPos = Math.ceil(totalPositions * this.config.highRiskMaxPercentile) + 1;
      constraints.minPosition = Math.max(constraints.minPosition, minPos);
      constraints.reasons.push("high_risk");
    }

    // LOW XNSCORE CONSTRAINT
    if (xnScore < 50) {
      const minPos = Math.ceil(totalPositions * this.config.lowXnScoreMaxPercentile) + 1;
      constraints.minPosition = Math.max(constraints.minPosition, minPos);
      constraints.reasons.push("low_xnscore");
    }

    // PREFERENCE CONSTRAINTS
    if (preference?.preferenceType === "prefer_late") {
      // They want to be late, constrain to back 30%
      const minPos = Math.ceil(totalPositions * 0.7);
      constraints.minPosition = Math.max(constraints.minPosition, minPos);
      constraints.reasons.push("prefer_late");
    }

    // VERIFIED URGENT NEED CONSTRAINT
    if (need?.category === "emergency" &&
        need?.verified &&
        xnScore >= this.config.minXnScoreForEarly) {
      // Emergency + verified + decent score = can be locked to top 3
      constraints.maxPosition = 3;
      constraints.reasons.push("verified_emergency");
    }

    return constraints;
  }

  private calculateRiskLevel(profile: MemberProfile): { riskLevel: RiskLevel; riskScore: number } {
    const { xnScore, history } = profile;
    let riskPoints = 0;

    if (xnScore < 50) riskPoints += 30;
    if (history.tenureMonths < 3) riskPoints += 20;
    if (history.completedCircles === 0) riskPoints += 25;
    if (history.totalDefaults > 0) riskPoints += 40;
    if (history.latePayments > 2) riskPoints += 15;

    let riskLevel: RiskLevel;
    if (riskPoints >= 80) riskLevel = "very_high";
    else if (riskPoints >= 50) riskLevel = "high";
    else if (riskPoints >= 30) riskLevel = "medium";
    else riskLevel = "low";

    return { riskLevel, riskScore: riskPoints };
  }

  // ============================================================================
  // STEP 3 (cont): APPLY CONSTRAINTS
  // ============================================================================

  private applyConstraints(sortedMembers: ScoredMember[], circle: any): ScoredMember[] {
    const totalPositions = circle.max_members || sortedMembers.length;
    const positionAssignments: (ScoredMember | null)[] = new Array(totalPositions).fill(null);
    const assignedUsers = new Set<string>();

    // First pass: Assign members with locked positions
    for (const member of sortedMembers) {
      if (member.constraints.lockedPosition) {
        const pos = member.constraints.lockedPosition - 1; // 0-indexed
        if (positionAssignments[pos] === null) {
          positionAssignments[pos] = member;
          assignedUsers.add(member.userId);
        }
      }
    }

    // Second pass: Assign remaining members by score, respecting constraints
    const unassigned = sortedMembers.filter(m => !assignedUsers.has(m.userId));

    for (const member of unassigned) {
      const { minPosition, maxPosition } = member.constraints;

      // Find best available position within constraints
      for (let pos = minPosition - 1; pos < maxPosition && pos < totalPositions; pos++) {
        if (positionAssignments[pos] === null) {
          positionAssignments[pos] = member;
          assignedUsers.add(member.userId);
          break;
        }
      }
    }

    // Third pass: Handle any remaining unassigned (constraint conflicts)
    const stillUnassigned = sortedMembers.filter(m => !assignedUsers.has(m.userId));

    for (const member of stillUnassigned) {
      // Find any available position
      for (let pos = 0; pos < totalPositions; pos++) {
        if (positionAssignments[pos] === null) {
          positionAssignments[pos] = member;
          assignedUsers.add(member.userId);

          console.warn(`Constraint violation for user ${member.userId}: ` +
            `assigned position ${pos + 1}, constraints were ${member.constraints.minPosition}-${member.constraints.maxPosition}`);
          break;
        }
      }
    }

    return positionAssignments.filter((m): m is ScoredMember => m !== null);
  }

  // ============================================================================
  // STEP 4: RESOLVE CONFLICTS
  // ============================================================================

  private resolveConflicts(orderedMembers: ScoredMember[], circle: any): ScoredMember[] {
    const resolved = [...orderedMembers];

    // Detect same-household clustering (fraud prevention)
    // In production, would check IP, device, address similarity
    // For now, just return as-is

    return resolved;
  }

  // ============================================================================
  // STEP 5: GENERATE FINAL ORDER
  // ============================================================================

  private generateAssignmentReason(member: ScoredMember, position: number, totalPositions: number): string {
    const reasons: string[] = [];
    const { scores, preference, need, constraints } = member;

    // Primary reason
    if (position <= 3) {
      if (need?.category === "emergency" && need?.verified) {
        reasons.push("Verified urgent need");
      } else if (scores.risk >= 80) {
        reasons.push("High trust score");
      } else if (scores.preference >= 80) {
        reasons.push("Strong preference with qualification");
      } else if (scores.need >= 70) {
        reasons.push("High need priority");
      }
    } else if (position >= totalPositions - 2) {
      if (preference?.preferenceType === "prefer_late") {
        reasons.push("Requested later position");
      } else if (scores.risk < 40) {
        reasons.push("Risk-based placement");
      } else if (constraints.reasons.includes("new_member")) {
        reasons.push("New member placement");
      } else if (constraints.minPosition > totalPositions * 0.5) {
        reasons.push("Constraint-based placement");
      }
    }

    if (reasons.length === 0) {
      reasons.push("Balanced score placement");
    }

    return reasons.join("; ");
  }

  private calculatePayoutDate(circle: any, position: number): string {
    const startDate = new Date(circle.start_date || new Date());
    let payoutDate = new Date(startDate);

    // Add cycles based on frequency
    for (let i = 1; i < position; i++) {
      switch (circle.frequency) {
        case "weekly":
          payoutDate.setDate(payoutDate.getDate() + 7);
          break;
        case "biweekly":
          payoutDate.setDate(payoutDate.getDate() + 14);
          break;
        case "monthly":
        default:
          payoutDate.setMonth(payoutDate.getMonth() + 1);
          break;
      }
    }

    return payoutDate.toISOString();
  }

  // ============================================================================
  // STEP 6: STORE RESULTS
  // ============================================================================

  private async storePayoutOrder(
    circleId: string,
    order: PayoutOrderEntry[],
    memberProfiles: MemberProfile[],
    scoredMembers: ScoredMember[]
  ): Promise<PayoutOrder> {
    // Store the order
    const { data: payoutOrder, error } = await supabase
      .from("payout_orders")
      .upsert({
        circle_id: circleId,
        order_data: order,
        algorithm_version: "hybrid_v1",
        weights: this.config.weights,
        status: "active",
        modifications: [],
        calculated_at: new Date().toISOString(),
      }, {
        onConflict: "circle_id"
      })
      .select()
      .single();

    if (error) throw error;

    // Store audit log
    await supabase.from("payout_order_audit_log").insert({
      circle_id: circleId,
      payout_order_id: payoutOrder.id,
      member_profiles: memberProfiles.map(p => ({
        userId: p.userId,
        xnScore: p.xnScore,
        preference: p.preference?.preferenceType,
        needCategory: p.need?.category,
        scores: scoredMembers.find(s => s.userId === p.userId)?.scores,
      })),
      algorithm_inputs: {
        weights: this.config.weights,
        config: this.config,
      },
    });

    return {
      id: payoutOrder.id,
      circleId,
      order,
      algorithmVersion: "hybrid_v1",
      weights: this.config.weights,
      status: payoutOrder.status,
      modifications: payoutOrder.modifications || [],
      calculatedAt: payoutOrder.calculated_at,
      lockedAt: payoutOrder.locked_at,
      createdAt: payoutOrder.created_at,
      updatedAt: payoutOrder.updated_at,
    };
  }

  private async updateFairnessCredits(
    finalOrder: PayoutOrderEntry[],
    memberProfiles: MemberProfile[]
  ): Promise<void> {
    for (const position of finalOrder) {
      const profile = memberProfiles.find(p => p.userId === position.userId);
      if (!profile) continue;

      let creditsChange = 0;

      // Award credits for flexibility
      if (profile.preference?.preferenceType === "flexible") {
        creditsChange += this.config.flexibilityCreditBonus;
      }

      if (profile.preference?.preferenceType === "prefer_late") {
        creditsChange += this.config.preferLateCreditBonus;
      }

      // Spend credits if they requested specific position and got it
      if (profile.preference?.preferenceType === "need_early" && position.position <= 3) {
        creditsChange -= this.config.earlyPositionCreditCost;
      }

      if (creditsChange !== 0) {
        const { data: existing } = await supabase
          .from("fairness_credits")
          .select("credits, credits_earned_total, credits_spent_total")
          .eq("user_id", position.userId)
          .single();

        const currentCredits = existing?.credits || 0;
        const earnedTotal = existing?.credits_earned_total || 0;
        const spentTotal = existing?.credits_spent_total || 0;

        const newCredits = Math.max(0, currentCredits + creditsChange);
        const newEarned = creditsChange > 0 ? earnedTotal + creditsChange : earnedTotal;
        const newSpent = creditsChange < 0 ? spentTotal + Math.abs(creditsChange) : spentTotal;

        await supabase.from("fairness_credits").upsert({
          user_id: position.userId,
          credits: newCredits,
          credits_earned_total: newEarned,
          credits_spent_total: newSpent,
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  private async storePositionConstraints(scoredMembers: ScoredMember[], circleId: string): Promise<void> {
    const constraints = scoredMembers.map(member => ({
      user_id: member.userId,
      circle_id: circleId,
      min_position: member.constraints.minPosition,
      max_position: member.constraints.maxPosition,
      locked_position: member.constraints.lockedPosition,
      must_be_locked: member.constraints.mustBeLocked,
      constraint_reasons: member.constraints.reasons,
      risk_level: member.constraints.riskLevel,
      risk_score: member.constraints.riskScore,
      calculated_at: new Date().toISOString(),
    }));

    // Upsert all constraints
    for (const constraint of constraints) {
      await supabase.from("position_constraints").upsert(constraint, {
        onConflict: "user_id,circle_id"
      });
    }
  }

  // ============================================================================
  // LOAD CONFIGURATION
  // ============================================================================

  private async loadCircleConfig(circleId: string, communityId?: string): Promise<void> {
    // Try circle-specific config first
    let { data: config } = await supabase
      .from("payout_algorithm_config")
      .select("*")
      .eq("circle_id", circleId)
      .eq("is_active", true)
      .single();

    // Fall back to community config
    if (!config && communityId) {
      const { data: communityConfig } = await supabase
        .from("payout_algorithm_config")
        .select("*")
        .eq("community_id", communityId)
        .eq("is_active", true)
        .single();
      config = communityConfig;
    }

    // Fall back to platform default
    if (!config) {
      const { data: defaultConfig } = await supabase
        .from("payout_algorithm_config")
        .select("*")
        .is("circle_id", null)
        .is("community_id", null)
        .eq("is_active", true)
        .single();
      config = defaultConfig;
    }

    if (config) {
      this.config = {
        weights: {
          preference: parseFloat(config.preference_weight) || DEFAULT_CONFIG.weights.preference,
          need: parseFloat(config.need_weight) || DEFAULT_CONFIG.weights.need,
          risk: parseFloat(config.risk_weight) || DEFAULT_CONFIG.weights.risk,
          fairness: parseFloat(config.fairness_weight) || DEFAULT_CONFIG.weights.fairness,
        },
        newMemberMaxPercentile: parseFloat(config.new_member_max_percentile) || DEFAULT_CONFIG.newMemberMaxPercentile,
        highRiskMaxPercentile: parseFloat(config.high_risk_max_percentile) || DEFAULT_CONFIG.highRiskMaxPercentile,
        veryHighRiskMaxPercentile: parseFloat(config.very_high_risk_max_percentile) || DEFAULT_CONFIG.veryHighRiskMaxPercentile,
        lowXnScoreMaxPercentile: parseFloat(config.low_xnscore_max_percentile) || DEFAULT_CONFIG.lowXnScoreMaxPercentile,
        minXnScoreForEarly: parseFloat(config.min_xnscore_for_early) || DEFAULT_CONFIG.minXnScoreForEarly,
        minXnScoreForPosition1: parseFloat(config.min_xnscore_for_position_1) || DEFAULT_CONFIG.minXnScoreForPosition1,
        newMemberMonths: config.new_member_months || DEFAULT_CONFIG.newMemberMonths,
        newMemberMinCircles: config.new_member_min_circles || DEFAULT_CONFIG.newMemberMinCircles,
        flexibilityCreditBonus: config.flexibility_credit_bonus || DEFAULT_CONFIG.flexibilityCreditBonus,
        preferLateCreditBonus: config.prefer_late_credit_bonus || DEFAULT_CONFIG.preferLateCreditBonus,
        earlyPositionCreditCost: config.early_position_credit_cost || DEFAULT_CONFIG.earlyPositionCreditCost,
      };
    }
  }

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  /**
   * Get the current payout order for a circle
   */
  async getPayoutOrder(circleId: string): Promise<PayoutOrder | null> {
    const { data, error } = await supabase
      .from("payout_orders")
      .select("*")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      circleId: data.circle_id,
      order: data.order_data,
      algorithmVersion: data.algorithm_version,
      weights: data.weights,
      status: data.status,
      modifications: data.modifications || [],
      calculatedAt: data.calculated_at,
      lockedAt: data.locked_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Get a user's position in a circle
   */
  async getUserPosition(userId: string, circleId: string): Promise<PayoutOrderEntry | null> {
    const order = await this.getPayoutOrder(circleId);
    if (!order) return null;

    return order.order.find(e => e.userId === userId) || null;
  }

  /**
   * Get position details for member-facing UI
   */
  async getMyPositionDetails(userId: string, circleId: string): Promise<{
    myPosition: {
      position: number;
      totalPositions: number;
      expectedPayoutDate: string;
      cyclesUntilPayout: number;
      expectedPayoutAmount: number;
      assignmentReason: string;
    };
    circle: any;
    canSwap: boolean;
  } | null> {
    const order = await this.getPayoutOrder(circleId);
    if (!order) return null;

    const myPosition = order.order.find(e => e.userId === userId);
    if (!myPosition) return null;

    const { data: circle } = await supabase
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single();

    if (!circle) return null;

    const cyclesUntilPayout = Math.max(0, myPosition.position - (circle.current_cycle || 1));
    const totalPool = parseFloat(circle.amount) * order.order.length;
    const platformFee = totalPool * (circle.platform_fee_percent || 0.015);
    const myPayout = totalPool - platformFee;

    return {
      myPosition: {
        position: myPosition.position,
        totalPositions: order.order.length,
        expectedPayoutDate: myPosition.payoutDate || "",
        cyclesUntilPayout,
        expectedPayoutAmount: myPayout,
        assignmentReason: myPosition.assignedReason,
      },
      circle: {
        name: circle.name,
        contributionAmount: circle.amount,
        currentCycle: circle.current_cycle || 1,
        totalCycles: order.order.length,
      },
      canSwap: (circle.current_cycle || 1) <= 1, // Can only swap before circle starts
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private monthsDifference(date1: Date, date2: Date): number {
    let months = (date1.getFullYear() - date2.getFullYear()) * 12;
    months += date1.getMonth() - date2.getMonth();
    return Math.max(0, months);
  }

  private daysDifference(date1: Date, date2: Date): number {
    const diffTime = date1.getTime() - date2.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private transformPreference(row: any): PositionPreference {
    return {
      id: row.id,
      userId: row.user_id,
      circleId: row.circle_id,
      preferenceType: row.preference_type,
      autoPayAgreed: row.auto_pay_agreed,
      positionLockAgreed: row.position_lock_agreed,
      reason: row.reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private transformNeedDeclaration(row: any): NeedDeclaration {
    return {
      id: row.id,
      userId: row.user_id,
      circleId: row.circle_id,
      category: row.category,
      description: row.description,
      targetDate: row.target_date,
      targetAmount: row.target_amount ? parseFloat(row.target_amount) : undefined,
      hasDeadline: row.has_deadline,
      deadlineDate: row.deadline_date,
      urgencyScore: row.urgency_score,
      verified: row.verified,
      verifiedBy: row.verified_by,
      verificationDocuments: row.verification_documents || [],
      createdAt: row.created_at,
    };
  }
}

// Export default instance
export const payoutOrderService = new PayoutOrderService();

// Export convenience functions
export const determinePayoutOrder = (circleId: string) =>
  payoutOrderService.determinePayoutOrder(circleId);

export const getPayoutOrder = (circleId: string) =>
  payoutOrderService.getPayoutOrder(circleId);

export const getUserPosition = (userId: string, circleId: string) =>
  payoutOrderService.getUserPosition(userId, circleId);

export const getMyPositionDetails = (userId: string, circleId: string) =>
  payoutOrderService.getMyPositionDetails(userId, circleId);
