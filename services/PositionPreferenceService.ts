/**
 * PositionPreferenceService.ts
 *
 * Handles member position preferences (bidding) and need declarations.
 * This is how members express what position they want and why they need the money.
 */

import { supabase } from "../lib/supabase";
import {
  PreferenceType,
  NeedCategory,
  PositionPreference,
  NeedDeclaration,
} from "./PayoutOrderService";

// ============================================================================
// TYPES
// ============================================================================

export interface SetPreferenceRequest {
  circleId: string;
  preferenceType: PreferenceType;
  autoPayAgreed?: boolean;
  positionLockAgreed?: boolean;
  reason?: string;
}

export interface SetNeedRequest {
  circleId: string;
  category: NeedCategory;
  description?: string;
  targetDate?: string;
  targetAmount?: number;
  hasDeadline?: boolean;
  deadlineDate?: string;
}

export interface PreferenceOption {
  type: PreferenceType;
  label: string;
  description: string;
  requirements: string[];
  benefits: string[];
  eligible: boolean;
  ineligibleReason?: string;
}

export interface NeedCategoryOption {
  category: NeedCategory;
  label: string;
  description: string;
  weight: number;
  requiresVerification: boolean;
  urgentClaimEligible: boolean;
}

// ============================================================================
// PREFERENCE OPTIONS CONFIGURATION
// ============================================================================

const PREFERENCE_OPTIONS: Record<PreferenceType, Omit<PreferenceOption, "eligible" | "ineligibleReason">> = {
  need_early: {
    type: "need_early",
    label: "I NEED an early position",
    description: "Request positions 1-3 with higher commitment",
    requirements: [
      "XnScore ≥ 60",
      "Agree to auto-pay from linked bank",
      "Accept position lock (can't swap later)",
    ],
    benefits: [
      "Prioritized for early positions",
      "First to receive payout",
    ],
  },
  prefer_early: {
    type: "prefer_early",
    label: "I PREFER early but am flexible",
    description: "Request positions 1-5 with moderate commitment",
    requirements: [
      "XnScore ≥ 50",
      "Recommended auto-pay",
    ],
    benefits: [
      "Considered for early positions",
      "May get middle position if oversubscribed",
    ],
  },
  flexible: {
    type: "flexible",
    label: "I'm FLEXIBLE - assign me anywhere",
    description: "Let the algorithm decide based on fairness",
    requirements: [],
    benefits: [
      "+5 fairness credits for flexibility",
      "Better position priority in next circle",
    ],
  },
  prefer_late: {
    type: "prefer_late",
    label: "I PREFER a later position",
    description: "Request positions in the last 30%",
    requirements: [],
    benefits: [
      "+7 fairness credits",
      "Priority for early position in next circle",
      '"Patient saver" recognition',
    ],
  },
};

const NEED_CATEGORIES: NeedCategoryOption[] = [
  {
    category: "emergency",
    label: "Emergency / Crisis",
    description: "Urgent unexpected situation requiring immediate funds",
    weight: 35,
    requiresVerification: true,
    urgentClaimEligible: true,
  },
  {
    category: "medical",
    label: "Medical Expenses",
    description: "Healthcare costs, treatment, medication",
    weight: 30,
    requiresVerification: true,
    urgentClaimEligible: true,
  },
  {
    category: "school_fees",
    label: "School Fees",
    description: "Education fees with specific deadline",
    weight: 30,
    requiresVerification: true,
    urgentClaimEligible: true,
  },
  {
    category: "education",
    label: "Education Costs",
    description: "Books, supplies, training courses",
    weight: 25,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "housing",
    label: "Housing / Rent",
    description: "Deposit, rent payment, housing costs",
    weight: 25,
    requiresVerification: false,
    urgentClaimEligible: true,
  },
  {
    category: "legal",
    label: "Legal / Immigration",
    description: "Legal fees, visa, documentation",
    weight: 25,
    requiresVerification: true,
    urgentClaimEligible: true,
  },
  {
    category: "wedding",
    label: "Wedding",
    description: "Wedding ceremony expenses",
    weight: 20,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "ceremony",
    label: "Other Ceremony",
    description: "Funeral, naming ceremony, religious event",
    weight: 15,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "business",
    label: "Business Investment",
    description: "Starting or growing a business",
    weight: 15,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "investment",
    label: "Other Investment",
    description: "Savings goal, investment opportunity",
    weight: 10,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "travel",
    label: "Travel",
    description: "Trip with booked dates",
    weight: 10,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "major_purchase",
    label: "Major Purchase",
    description: "Car, appliance, equipment",
    weight: 10,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
  {
    category: "general",
    label: "General Savings",
    description: "Building savings, no specific goal",
    weight: 0,
    requiresVerification: false,
    urgentClaimEligible: false,
  },
];

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class PositionPreferenceService {
  // ============================================================================
  // GET AVAILABLE OPTIONS
  // ============================================================================

  /**
   * Get available preference options for a user in a circle
   * Checks eligibility based on XnScore and other factors
   */
  async getPreferenceOptions(userId: string, circleId: string): Promise<PreferenceOption[]> {
    // Get user's XnScore
    const { data: profile } = await supabase
      .from("profiles")
      .select("xn_score")
      .eq("id", userId)
      .single();

    const xnScore = profile?.xn_score || 50;

    // Get current preference if any
    const { data: currentPref } = await supabase
      .from("position_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .single();

    const options: PreferenceOption[] = [];

    for (const [type, config] of Object.entries(PREFERENCE_OPTIONS)) {
      const option: PreferenceOption = {
        ...config,
        eligible: true,
      };

      // Check eligibility
      if (type === "need_early" && xnScore < 60) {
        option.eligible = false;
        option.ineligibleReason = `XnScore must be at least 60 (yours: ${xnScore})`;
      }

      if (type === "prefer_early" && xnScore < 50) {
        option.eligible = false;
        option.ineligibleReason = `XnScore must be at least 50 (yours: ${xnScore})`;
      }

      options.push(option);
    }

    return options;
  }

  /**
   * Get available need categories
   */
  async getNeedCategories(userId: string): Promise<NeedCategoryOption[]> {
    // Check if user can claim urgent need
    const canClaimUrgent = await this.canClaimUrgentNeed(userId);

    return NEED_CATEGORIES.map(cat => ({
      ...cat,
      urgentClaimEligible: cat.urgentClaimEligible && canClaimUrgent,
    }));
  }

  /**
   * Check if user can claim urgent need (once per 12 months)
   */
  async canClaimUrgentNeed(userId: string): Promise<boolean> {
    const { data: lastClaim } = await supabase
      .from("urgent_need_claims")
      .select("next_eligible_date")
      .eq("user_id", userId)
      .eq("verified", true)
      .order("claimed_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastClaim) return true;

    return new Date() >= new Date(lastClaim.next_eligible_date);
  }

  // ============================================================================
  // SET PREFERENCE
  // ============================================================================

  /**
   * Set position preference for a user in a circle
   */
  async setPreference(userId: string, request: SetPreferenceRequest): Promise<PositionPreference> {
    const { circleId, preferenceType, autoPayAgreed, positionLockAgreed, reason } = request;

    // Verify circle exists and is accepting preferences
    const { data: circle } = await supabase
      .from("circles")
      .select("status, current_cycle")
      .eq("id", circleId)
      .single();

    if (!circle) {
      throw new Error("Circle not found");
    }

    if ((circle.current_cycle || 1) > 1) {
      throw new Error("Cannot change preference after circle has started");
    }

    // Verify user is a member
    const { data: membership } = await supabase
      .from("circle_members")
      .select("id, status")
      .eq("circle_id", circleId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (!membership) {
      throw new Error("You are not a member of this circle");
    }

    // Validate eligibility
    const options = await this.getPreferenceOptions(userId, circleId);
    const selectedOption = options.find(o => o.type === preferenceType);

    if (!selectedOption?.eligible) {
      throw new Error(selectedOption?.ineligibleReason || "Not eligible for this preference");
    }

    // Validate requirements for need_early
    if (preferenceType === "need_early") {
      if (!autoPayAgreed) {
        throw new Error("Must agree to auto-pay for early position request");
      }
      if (!positionLockAgreed) {
        throw new Error("Must agree to position lock for early position request");
      }
    }

    // Upsert preference
    const { data, error } = await supabase
      .from("position_preferences")
      .upsert({
        user_id: userId,
        circle_id: circleId,
        preference_type: preferenceType,
        auto_pay_agreed: autoPayAgreed || false,
        position_lock_agreed: positionLockAgreed || false,
        reason,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,circle_id"
      })
      .select()
      .single();

    if (error) throw error;

    return this.transformPreference(data);
  }

  /**
   * Get current preference for a user in a circle
   */
  async getPreference(userId: string, circleId: string): Promise<PositionPreference | null> {
    const { data, error } = await supabase
      .from("position_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .single();

    if (error || !data) return null;

    return this.transformPreference(data);
  }

  /**
   * Delete preference (reset to flexible)
   */
  async clearPreference(userId: string, circleId: string): Promise<void> {
    // Verify circle hasn't started
    const { data: circle } = await supabase
      .from("circles")
      .select("current_cycle")
      .eq("id", circleId)
      .single();

    if ((circle?.current_cycle || 1) > 1) {
      throw new Error("Cannot change preference after circle has started");
    }

    await supabase
      .from("position_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("circle_id", circleId);
  }

  // ============================================================================
  // NEED DECLARATION
  // ============================================================================

  /**
   * Set need declaration for a user in a circle
   */
  async setNeedDeclaration(userId: string, request: SetNeedRequest): Promise<NeedDeclaration> {
    const {
      circleId,
      category,
      description,
      targetDate,
      targetAmount,
      hasDeadline,
      deadlineDate,
    } = request;

    // Verify circle exists
    const { data: circle } = await supabase
      .from("circles")
      .select("current_cycle")
      .eq("id", circleId)
      .single();

    if (!circle) {
      throw new Error("Circle not found");
    }

    if ((circle.current_cycle || 1) > 1) {
      throw new Error("Cannot change need declaration after circle has started");
    }

    // Calculate urgency score
    let urgencyScore = NEED_CATEGORIES.find(c => c.category === category)?.weight || 0;

    // Add deadline proximity bonus
    if (hasDeadline && deadlineDate) {
      const daysUntil = Math.ceil(
        (new Date(deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntil <= 30) urgencyScore += 15;
      else if (daysUntil <= 60) urgencyScore += 10;
      else if (daysUntil <= 90) urgencyScore += 5;
    }

    // Check if this is an urgent claim
    const categoryConfig = NEED_CATEGORIES.find(c => c.category === category);
    const isUrgentClaim = categoryConfig?.urgentClaimEligible &&
      ["emergency", "medical", "school_fees", "housing", "legal"].includes(category);

    // Validate urgent claim eligibility
    if (isUrgentClaim) {
      const canClaim = await this.canClaimUrgentNeed(userId);
      if (!canClaim) {
        throw new Error("You can only claim urgent need once per 12 months");
      }
    }

    // Upsert need declaration
    const { data, error } = await supabase
      .from("need_declarations")
      .upsert({
        user_id: userId,
        circle_id: circleId,
        category,
        description,
        target_date: targetDate,
        target_amount: targetAmount,
        has_deadline: hasDeadline || false,
        deadline_date: deadlineDate,
        urgency_score: urgencyScore,
        is_urgent_claim: isUrgentClaim,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,circle_id"
      })
      .select()
      .single();

    if (error) throw error;

    // Record urgent claim if applicable
    if (isUrgentClaim) {
      const nextEligible = new Date();
      nextEligible.setFullYear(nextEligible.getFullYear() + 1);

      await supabase.from("urgent_need_claims").insert({
        user_id: userId,
        circle_id: circleId,
        need_declaration_id: data.id,
        category,
        next_eligible_date: nextEligible.toISOString().split("T")[0],
        verified: false, // Will be verified later
      });
    }

    return this.transformNeedDeclaration(data);
  }

  /**
   * Get current need declaration for a user in a circle
   */
  async getNeedDeclaration(userId: string, circleId: string): Promise<NeedDeclaration | null> {
    const { data, error } = await supabase
      .from("need_declarations")
      .select("*")
      .eq("user_id", userId)
      .eq("circle_id", circleId)
      .single();

    if (error || !data) return null;

    return this.transformNeedDeclaration(data);
  }

  /**
   * Clear need declaration
   */
  async clearNeedDeclaration(userId: string, circleId: string): Promise<void> {
    const { data: circle } = await supabase
      .from("circles")
      .select("current_cycle")
      .eq("id", circleId)
      .single();

    if ((circle?.current_cycle || 1) > 1) {
      throw new Error("Cannot change need declaration after circle has started");
    }

    await supabase
      .from("need_declarations")
      .delete()
      .eq("user_id", userId)
      .eq("circle_id", circleId);
  }

  /**
   * Submit verification documents for need declaration
   */
  async submitVerificationDocuments(
    userId: string,
    circleId: string,
    documents: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from("need_declarations")
      .update({
        verification_documents: documents,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("circle_id", circleId);

    if (error) throw error;
  }

  /**
   * Verify a need declaration (admin action)
   */
  async verifyNeedDeclaration(
    needId: string,
    verifierId: string,
    notes?: string
  ): Promise<void> {
    const { data: declaration, error: fetchError } = await supabase
      .from("need_declarations")
      .select("*")
      .eq("id", needId)
      .single();

    if (fetchError || !declaration) {
      throw new Error("Need declaration not found");
    }

    const { error } = await supabase
      .from("need_declarations")
      .update({
        verified: true,
        verified_by: verifierId,
        verification_notes: notes,
        verified_at: new Date().toISOString(),
        // Boost urgency score for verified needs
        urgency_score: (declaration.urgency_score || 0) + 10,
      })
      .eq("id", needId);

    if (error) throw error;

    // If it was an urgent claim, mark it as verified
    if (declaration.is_urgent_claim) {
      await supabase
        .from("urgent_need_claims")
        .update({ verified: true })
        .eq("need_declaration_id", needId);
    }
  }

  // ============================================================================
  // CIRCLE SUMMARY
  // ============================================================================

  /**
   * Get preference summary for a circle (for organizers)
   */
  async getCirclePreferenceSummary(circleId: string): Promise<{
    total: number;
    needEarly: number;
    preferEarly: number;
    flexible: number;
    preferLate: number;
    noPreference: number;
    needCategories: { category: NeedCategory; count: number }[];
  }> {
    // Get all preferences
    const { data: preferences } = await supabase
      .from("position_preferences")
      .select("preference_type")
      .eq("circle_id", circleId);

    // Get member count
    const { count: totalMembers } = await supabase
      .from("circle_members")
      .select("*", { count: "exact", head: true })
      .eq("circle_id", circleId)
      .eq("status", "active");

    // Get need declarations
    const { data: needs } = await supabase
      .from("need_declarations")
      .select("category")
      .eq("circle_id", circleId);

    // Count preferences
    const prefCounts = {
      need_early: 0,
      prefer_early: 0,
      flexible: 0,
      prefer_late: 0,
    };

    (preferences || []).forEach(p => {
      if (p.preference_type in prefCounts) {
        prefCounts[p.preference_type as PreferenceType]++;
      }
    });

    // Count needs by category
    const needCounts: Record<string, number> = {};
    (needs || []).forEach(n => {
      needCounts[n.category] = (needCounts[n.category] || 0) + 1;
    });

    const needCategories = Object.entries(needCounts).map(([category, count]) => ({
      category: category as NeedCategory,
      count,
    }));

    return {
      total: totalMembers || 0,
      needEarly: prefCounts.need_early,
      preferEarly: prefCounts.prefer_early,
      flexible: prefCounts.flexible,
      preferLate: prefCounts.prefer_late,
      noPreference: (totalMembers || 0) - (preferences?.length || 0),
      needCategories,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

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
export const positionPreferenceService = new PositionPreferenceService();

// Export convenience functions
export const getPreferenceOptions = (userId: string, circleId: string) =>
  positionPreferenceService.getPreferenceOptions(userId, circleId);

export const getNeedCategories = (userId: string) =>
  positionPreferenceService.getNeedCategories(userId);

export const setPreference = (userId: string, request: SetPreferenceRequest) =>
  positionPreferenceService.setPreference(userId, request);

export const setNeedDeclaration = (userId: string, request: SetNeedRequest) =>
  positionPreferenceService.setNeedDeclaration(userId, request);
