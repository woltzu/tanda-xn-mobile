/**
 * CircleMatchingService.ts
 *
 * Circle Matching and Recommendation Engine for TandaXn
 *
 * This service provides intelligent circle recommendations based on:
 * 1. User Financial Profile - Match circles to user's affordability
 * 2. Trust Network - Prioritize circles with vouched/known members
 * 3. Community Affiliation - Recommend circles in user's communities
 * 4. User Preferences - Match contribution amount, frequency, duration
 * 5. XnScore Compatibility - Match circles where user meets requirements
 * 6. Historical Success - Prioritize circles with good completion rates
 * 7. Social Graph - Friends, family, colleagues in circles (A/B/C/D rule)
 *
 * The A/B/C/D Rule:
 * A - Close connections (family, close friends) - highest trust
 * B - Friends and colleagues - high trust
 * C - Friends of friends - moderate trust
 * D - Community members - baseline trust
 */

import { supabase } from "../lib/supabase";
import { affordabilityService, AffordabilityResult } from "./AffordabilityService";

// ============================================================================
// TYPES
// ============================================================================

export type CircleType = "traditional" | "goal" | "emergency" | "investment" | "charity";

export type CircleFrequency = "weekly" | "biweekly" | "monthly";

export type ConnectionType = "A" | "B" | "C" | "D";

export interface Circle {
  id: string;
  name: string;
  type: CircleType;
  description?: string;
  emoji?: string;
  amount: number;
  currency: string;
  frequency: CircleFrequency;
  memberCount: number;
  currentMembers: number;
  spotsAvailable: number;
  startDate?: string;
  status: string;
  minScore: number;
  maxScore: number;
  communityId?: string;
  communityName?: string;
  healthScore?: number;
  completionRate?: number;
  createdBy: string;
}

export interface UserPreferences {
  preferredAmount?: { min: number; max: number };
  preferredFrequency?: CircleFrequency[];
  preferredTypes?: CircleType[];
  preferredDuration?: { minWeeks: number; maxWeeks: number };
  avoidUsers?: string[]; // Users to avoid being in circles with
  preferCommunities?: string[]; // Preferred community IDs
}

export interface CircleMatch {
  circle: Circle;
  matchScore: number; // 0-100 overall match score
  matchReasons: MatchReason[];
  warnings: string[];
  connectionType?: ConnectionType;
  connectionCount: number;
  connectedMembers: { id: string; name: string; connectionType: ConnectionType }[];
  affordability: AffordabilityResult | null;
  eligibilityStatus: "eligible" | "conditional" | "ineligible";
  eligibilityReasons: string[];
}

export interface MatchReason {
  category: "affordability" | "trust" | "community" | "preferences" | "compatibility" | "social";
  description: string;
  impact: "high" | "medium" | "low";
  score: number; // Contribution to match score
}

export interface RecommendationConfig {
  // Weights for different factors (must sum to 1.0)
  affordabilityWeight: number;
  trustWeight: number;
  communityWeight: number;
  preferencesWeight: number;
  compatibilityWeight: number;
  socialWeight: number;

  // Minimum scores to include in recommendations
  minMatchScore: number;
  minAffordabilityScore: number;

  // Limits
  maxRecommendations: number;

  // Boost factors
  sameCommunitBoost: number;
  trustedMemberBoost: number;
  perfectFitBoost: number;
}

const DEFAULT_CONFIG: RecommendationConfig = {
  affordabilityWeight: 0.25,
  trustWeight: 0.20,
  communityWeight: 0.15,
  preferencesWeight: 0.15,
  compatibilityWeight: 0.15,
  socialWeight: 0.10,

  minMatchScore: 40,
  minAffordabilityScore: 50,

  maxRecommendations: 20,

  sameCommunitBoost: 10,
  trustedMemberBoost: 15,
  perfectFitBoost: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate duration in weeks based on circle parameters
 */
const calculateDurationWeeks = (
  memberCount: number,
  frequency: CircleFrequency
): number => {
  const cyclesPerWeek = frequency === "weekly" ? 1 : frequency === "biweekly" ? 0.5 : 0.25;
  return Math.ceil(memberCount / cyclesPerWeek);
};

/**
 * Get connection type label
 */
const getConnectionLabel = (type: ConnectionType): string => {
  switch (type) {
    case "A":
      return "Close connection";
    case "B":
      return "Friend/Colleague";
    case "C":
      return "Friend of friend";
    case "D":
      return "Community member";
  }
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class CircleMatchingService {
  private config: RecommendationConfig;

  constructor(config?: Partial<RecommendationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get user's social connections
   * Returns users categorized by connection type (A, B, C, D)
   */
  async getUserConnections(userId: string): Promise<Map<string, ConnectionType>> {
    const connections = new Map<string, ConnectionType>();

    try {
      // Type A - Close connections (explicitly marked as family/close friends)
      // This would come from a connections/relationships table
      const { data: closeConnections } = await supabase
        .from("user_connections")
        .select("connected_user_id, connection_type")
        .eq("user_id", userId)
        .in("connection_type", ["family", "close_friend"]);

      (closeConnections || []).forEach((c) => {
        connections.set(c.connected_user_id, "A");
      });

      // Type B - Friends and colleagues
      const { data: friends } = await supabase
        .from("user_connections")
        .select("connected_user_id")
        .eq("user_id", userId)
        .in("connection_type", ["friend", "colleague"]);

      (friends || []).forEach((f) => {
        if (!connections.has(f.connected_user_id)) {
          connections.set(f.connected_user_id, "B");
        }
      });

      // Type C - Friends of friends (users connected to user's B connections)
      const bConnections = Array.from(connections.entries())
        .filter(([_, type]) => type === "B")
        .map(([id]) => id);

      if (bConnections.length > 0) {
        const { data: friendsOfFriends } = await supabase
          .from("user_connections")
          .select("connected_user_id")
          .in("user_id", bConnections)
          .not("connected_user_id", "eq", userId);

        (friendsOfFriends || []).forEach((fof) => {
          if (!connections.has(fof.connected_user_id)) {
            connections.set(fof.connected_user_id, "C");
          }
        });
      }

      // Type D - Community members (handled separately when matching)
    } catch (err) {
      console.error("Error fetching user connections:", err);
    }

    return connections;
  }

  /**
   * Get user's community memberships
   */
  async getUserCommunities(userId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from("community_memberships")
        .select("community_id")
        .eq("user_id", userId)
        .eq("status", "active");

      return (data || []).map((m) => m.community_id);
    } catch (err) {
      console.error("Error fetching user communities:", err);
      return [];
    }
  }

  /**
   * Get user's XnScore
   */
  async getUserXnScore(userId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("xn_score")
        .eq("id", userId)
        .single();

      return data?.xn_score || 50;
    } catch (err) {
      console.error("Error fetching XnScore:", err);
      return 50;
    }
  }

  /**
   * Get circles user has already joined
   */
  async getUserCircles(userId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", userId)
        .in("status", ["active", "pending"]);

      return (data || []).map((m) => m.circle_id);
    } catch (err) {
      console.error("Error fetching user circles:", err);
      return [];
    }
  }

  /**
   * Get available circles for matching
   */
  async getAvailableCircles(
    excludeCircleIds: string[],
    communityIds?: string[]
  ): Promise<Circle[]> {
    try {
      let query = supabase
        .from("circles")
        .select(`
          *,
          community:communities(name)
        `)
        .in("status", ["pending", "forming", "active"])
        .gt("member_count", supabase.rpc("get_current_members_count")) // Has open spots
        .order("created_at", { ascending: false });

      // Filter by communities if specified
      if (communityIds && communityIds.length > 0) {
        query = query.or(`community_id.in.(${communityIds.join(",")}),community_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out circles user is already in and transform
      return (data || [])
        .filter((c) => !excludeCircleIds.includes(c.id))
        .filter((c) => (c.current_members || 0) < (c.member_count || 10))
        .map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type as CircleType,
          description: c.description,
          emoji: c.emoji,
          amount: parseFloat(c.amount) || 0,
          currency: c.currency || "USD",
          frequency: c.frequency as CircleFrequency,
          memberCount: c.member_count || 10,
          currentMembers: c.current_members || 0,
          spotsAvailable: (c.member_count || 10) - (c.current_members || 0),
          startDate: c.start_date,
          status: c.status,
          minScore: c.min_score || 0,
          maxScore: c.max_score || 100,
          communityId: c.community_id,
          communityName: c.community?.name,
          completionRate: 0.85, // Would need historical data
          createdBy: c.created_by,
        }));
    } catch (err) {
      console.error("Error fetching available circles:", err);
      return [];
    }
  }

  /**
   * Get members of a circle
   */
  async getCircleMembers(circleId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from("circle_members")
        .select("user_id")
        .eq("circle_id", circleId)
        .in("status", ["active", "pending"]);

      return (data || []).map((m) => m.user_id);
    } catch (err) {
      console.error("Error fetching circle members:", err);
      return [];
    }
  }

  /**
   * Calculate affordability score for a circle
   */
  async calculateAffordabilityScore(
    userId: string,
    circle: Circle
  ): Promise<{ score: number; result: AffordabilityResult }> {
    const result = await affordabilityService.checkAffordability(
      userId,
      circle.amount,
      circle.frequency
    );

    return {
      score: result.score,
      result,
    };
  }

  /**
   * Calculate trust score based on connections in circle
   */
  calculateTrustScore(
    circleMembers: string[],
    userConnections: Map<string, ConnectionType>,
    userCommunities: string[],
    circleCommunityId?: string
  ): {
    score: number;
    connectionType?: ConnectionType;
    connectionCount: number;
    connectedMembers: { id: string; name: string; connectionType: ConnectionType }[];
  } {
    let score = 0;
    let highestConnectionType: ConnectionType | undefined;
    const connectedMembers: { id: string; name: string; connectionType: ConnectionType }[] = [];

    // Check each circle member for connections
    circleMembers.forEach((memberId) => {
      const connectionType = userConnections.get(memberId);
      if (connectionType) {
        connectedMembers.push({
          id: memberId,
          name: "Member", // Would need to fetch names
          connectionType,
        });

        // Score based on connection type
        switch (connectionType) {
          case "A":
            score += 40;
            if (!highestConnectionType || highestConnectionType > "A") {
              highestConnectionType = "A";
            }
            break;
          case "B":
            score += 25;
            if (!highestConnectionType || highestConnectionType > "B") {
              highestConnectionType = "B";
            }
            break;
          case "C":
            score += 15;
            if (!highestConnectionType || highestConnectionType > "C") {
              highestConnectionType = "C";
            }
            break;
        }
      }
    });

    // Bonus for being in same community
    if (circleCommunityId && userCommunities.includes(circleCommunityId)) {
      score += 20;
      if (!highestConnectionType) {
        highestConnectionType = "D";
      }
    }

    // Cap at 100
    score = Math.min(100, score);

    return {
      score,
      connectionType: highestConnectionType,
      connectionCount: connectedMembers.length,
      connectedMembers,
    };
  }

  /**
   * Calculate compatibility score (XnScore requirements, circle health)
   */
  calculateCompatibilityScore(
    userXnScore: number,
    circle: Circle
  ): { score: number; reasons: string[] } {
    let score = 50; // Base score
    const reasons: string[] = [];

    // XnScore within range
    if (userXnScore >= circle.minScore && userXnScore <= circle.maxScore) {
      score += 30;
      reasons.push("Your XnScore qualifies for this circle");
    } else if (userXnScore < circle.minScore) {
      score -= 50;
      reasons.push(`XnScore too low (need ${circle.minScore}, have ${userXnScore})`);
    }

    // Bonus for being well above minimum
    const scoreBuffer = userXnScore - circle.minScore;
    if (scoreBuffer > 20) {
      score += 10;
      reasons.push("Strong XnScore margin");
    }

    // Circle health/completion rate bonus
    if (circle.completionRate && circle.completionRate > 0.9) {
      score += 10;
      reasons.push("High completion rate circle");
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      reasons,
    };
  }

  /**
   * Calculate preferences match score
   */
  calculatePreferencesScore(
    circle: Circle,
    preferences?: UserPreferences
  ): { score: number; reasons: string[] } {
    if (!preferences) {
      return { score: 70, reasons: ["No preferences set - using defaults"] };
    }

    let score = 50;
    const reasons: string[] = [];

    // Amount preference
    if (preferences.preferredAmount) {
      if (
        circle.amount >= preferences.preferredAmount.min &&
        circle.amount <= preferences.preferredAmount.max
      ) {
        score += 20;
        reasons.push("Contribution amount matches your preference");
      } else {
        score -= 10;
      }
    }

    // Frequency preference
    if (preferences.preferredFrequency?.length) {
      if (preferences.preferredFrequency.includes(circle.frequency)) {
        score += 15;
        reasons.push(`${circle.frequency} frequency matches your preference`);
      } else {
        score -= 10;
      }
    }

    // Type preference
    if (preferences.preferredTypes?.length) {
      if (preferences.preferredTypes.includes(circle.type)) {
        score += 15;
        reasons.push(`${circle.type} circle type matches your preference`);
      }
    }

    // Community preference
    if (preferences.preferCommunities?.length && circle.communityId) {
      if (preferences.preferCommunities.includes(circle.communityId)) {
        score += 10;
        reasons.push("Circle is in your preferred community");
      }
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      reasons,
    };
  }

  /**
   * Main recommendation function
   */
  async getRecommendations(
    userId: string,
    preferences?: UserPreferences,
    limit?: number
  ): Promise<CircleMatch[]> {
    const maxResults = limit || this.config.maxRecommendations;

    // Gather user data in parallel
    const [userConnections, userCommunities, userXnScore, userCircles] = await Promise.all([
      this.getUserConnections(userId),
      this.getUserCommunities(userId),
      this.getUserXnScore(userId),
      this.getUserCircles(userId),
    ]);

    // Get available circles (excluding ones user is already in)
    const availableCircles = await this.getAvailableCircles(userCircles, userCommunities);

    if (availableCircles.length === 0) {
      return [];
    }

    // Score each circle
    const matches: CircleMatch[] = [];

    for (const circle of availableCircles) {
      // Get circle members for trust calculation
      const circleMembers = await this.getCircleMembers(circle.id);

      // Calculate component scores
      const { score: affordabilityScore, result: affordabilityResult } =
        await this.calculateAffordabilityScore(userId, circle);

      const trustResult = this.calculateTrustScore(
        circleMembers,
        userConnections,
        userCommunities,
        circle.communityId
      );

      const compatibilityResult = this.calculateCompatibilityScore(userXnScore, circle);

      const preferencesResult = this.calculatePreferencesScore(circle, preferences);

      // Build match reasons
      const matchReasons: MatchReason[] = [];

      // Affordability reason
      if (affordabilityResult.canAfford) {
        matchReasons.push({
          category: "affordability",
          description: `You can afford $${circle.amount}/${circle.frequency} (${affordabilityResult.riskLevel} risk)`,
          impact: affordabilityResult.riskLevel === "low" ? "high" : "medium",
          score: affordabilityScore,
        });
      }

      // Trust reasons
      if (trustResult.connectionCount > 0) {
        matchReasons.push({
          category: "trust",
          description: `${trustResult.connectionCount} connection(s) in this circle`,
          impact: trustResult.connectionType === "A" ? "high" : "medium",
          score: trustResult.score,
        });
      }

      // Community reason
      if (circle.communityId && userCommunities.includes(circle.communityId)) {
        matchReasons.push({
          category: "community",
          description: `Part of your ${circle.communityName || "community"}`,
          impact: "medium",
          score: 20,
        });
      }

      // Compatibility reasons
      compatibilityResult.reasons.forEach((reason) => {
        matchReasons.push({
          category: "compatibility",
          description: reason,
          impact: "medium",
          score: compatibilityResult.score / compatibilityResult.reasons.length,
        });
      });

      // Preferences reasons
      preferencesResult.reasons.forEach((reason) => {
        matchReasons.push({
          category: "preferences",
          description: reason,
          impact: "low",
          score: preferencesResult.score / preferencesResult.reasons.length,
        });
      });

      // Calculate weighted overall score
      let overallScore =
        affordabilityScore * this.config.affordabilityWeight +
        trustResult.score * this.config.trustWeight +
        (circle.communityId && userCommunities.includes(circle.communityId) ? 100 : 50) *
          this.config.communityWeight +
        preferencesResult.score * this.config.preferencesWeight +
        compatibilityResult.score * this.config.compatibilityWeight +
        trustResult.score * this.config.socialWeight;

      // Apply boosts
      if (circle.communityId && userCommunities.includes(circle.communityId)) {
        overallScore += this.config.sameCommunitBoost;
      }
      if (trustResult.connectionType === "A" || trustResult.connectionType === "B") {
        overallScore += this.config.trustedMemberBoost;
      }
      if (
        affordabilityResult.canAfford &&
        affordabilityResult.riskLevel === "low" &&
        compatibilityResult.score >= 80
      ) {
        overallScore += this.config.perfectFitBoost;
      }

      overallScore = Math.min(100, Math.round(overallScore));

      // Determine eligibility
      let eligibilityStatus: "eligible" | "conditional" | "ineligible" = "eligible";
      const eligibilityReasons: string[] = [];

      if (!affordabilityResult.canAfford) {
        eligibilityStatus = "ineligible";
        eligibilityReasons.push("Cannot afford this circle");
      } else if (userXnScore < circle.minScore) {
        eligibilityStatus = "ineligible";
        eligibilityReasons.push(`XnScore below minimum (${circle.minScore})`);
      } else if (circle.spotsAvailable === 0) {
        eligibilityStatus = "ineligible";
        eligibilityReasons.push("No spots available");
      } else if (affordabilityResult.riskLevel === "high") {
        eligibilityStatus = "conditional";
        eligibilityReasons.push("High financial risk");
      }

      // Collect warnings
      const warnings: string[] = [];
      if (affordabilityResult.warnings.length > 0) {
        warnings.push(...affordabilityResult.warnings.slice(0, 2));
      }
      if (circle.spotsAvailable <= 2) {
        warnings.push(`Only ${circle.spotsAvailable} spot(s) left`);
      }

      // Only include if meets minimum score and affordability
      if (
        overallScore >= this.config.minMatchScore &&
        affordabilityScore >= this.config.minAffordabilityScore
      ) {
        matches.push({
          circle,
          matchScore: overallScore,
          matchReasons,
          warnings,
          connectionType: trustResult.connectionType,
          connectionCount: trustResult.connectionCount,
          connectedMembers: trustResult.connectedMembers,
          affordability: affordabilityResult,
          eligibilityStatus,
          eligibilityReasons,
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Return top N
    return matches.slice(0, maxResults);
  }

  /**
   * Get quick suggestions for homepage/dashboard
   */
  async getQuickSuggestions(
    userId: string,
    limit: number = 5
  ): Promise<{
    topMatch: CircleMatch | null;
    friendsCircles: CircleMatch[];
    communityCircles: CircleMatch[];
    affordableCircles: CircleMatch[];
  }> {
    const allMatches = await this.getRecommendations(userId, undefined, 20);

    const eligibleMatches = allMatches.filter((m) => m.eligibilityStatus !== "ineligible");

    return {
      topMatch: eligibleMatches[0] || null,
      friendsCircles: eligibleMatches
        .filter((m) => m.connectionType === "A" || m.connectionType === "B")
        .slice(0, limit),
      communityCircles: eligibleMatches
        .filter((m) => m.circle.communityId)
        .slice(0, limit),
      affordableCircles: eligibleMatches
        .filter((m) => m.affordability?.riskLevel === "low")
        .slice(0, limit),
    };
  }

  /**
   * Find circles with specific criteria
   */
  async findCircles(
    userId: string,
    criteria: {
      minAmount?: number;
      maxAmount?: number;
      frequency?: CircleFrequency;
      type?: CircleType;
      communityId?: string;
      hasConnections?: boolean;
    }
  ): Promise<CircleMatch[]> {
    let matches = await this.getRecommendations(userId);

    if (criteria.minAmount !== undefined) {
      matches = matches.filter((m) => m.circle.amount >= criteria.minAmount!);
    }
    if (criteria.maxAmount !== undefined) {
      matches = matches.filter((m) => m.circle.amount <= criteria.maxAmount!);
    }
    if (criteria.frequency) {
      matches = matches.filter((m) => m.circle.frequency === criteria.frequency);
    }
    if (criteria.type) {
      matches = matches.filter((m) => m.circle.type === criteria.type);
    }
    if (criteria.communityId) {
      matches = matches.filter((m) => m.circle.communityId === criteria.communityId);
    }
    if (criteria.hasConnections) {
      matches = matches.filter((m) => m.connectionCount > 0);
    }

    return matches;
  }

  /**
   * Get explanation for why a circle was recommended
   */
  getMatchExplanation(match: CircleMatch): string {
    const reasons = match.matchReasons
      .filter((r) => r.impact === "high" || r.impact === "medium")
      .map((r) => r.description)
      .slice(0, 3);

    if (reasons.length === 0) {
      return "This circle matches your profile";
    }

    return reasons.join(". ") + ".";
  }
}

// Export default instance
export const circleMatchingService = new CircleMatchingService();

// Export convenience functions
export const getCircleRecommendations = (userId: string, preferences?: UserPreferences) =>
  circleMatchingService.getRecommendations(userId, preferences);

export const getQuickCircleSuggestions = (userId: string) =>
  circleMatchingService.getQuickSuggestions(userId);

export const findMatchingCircles = (
  userId: string,
  criteria: Parameters<CircleMatchingService["findCircles"]>[1]
) => circleMatchingService.findCircles(userId, criteria);
