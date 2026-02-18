import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import {
  affordabilityService,
  AffordabilityResult,
} from "../services/AffordabilityService";

// ============================================================================
// TYPES
// ============================================================================

export type CommunityType =
  | "diaspora"
  | "faith"
  | "professional"
  | "local"
  | "school"
  | "interest"
  | "general";

export type CommunityPrivacy = "public" | "private";

export type MemberRole = "member" | "elder" | "moderator" | "admin" | "owner";

export type JoinPolicy = "open" | "approval_required" | "invite_only" | "vouch_required";

export type MembershipStatus = "pending" | "active" | "suspended" | "removed" | "left";

export type Community = {
  id: string;
  name: string;
  icon: string;
  type: CommunityType;
  description: string;
  members: number;
  circles: number;
  verified: boolean;
  isJoined: boolean;
  role?: MemberRole;
  privacy: CommunityPrivacy;
  parentId?: string;
  parentName?: string;
  joinPolicy: JoinPolicy;
  requiredVouches: number;
  minimumXnScore: number;
  region?: string;
  countryOfOrigin?: string;
  stats?: {
    totalSaved: number;
    activeCircles: number;
    completedCircles: number;
    avgXnScore: number;
  };
  subCommunities?: SubCommunity[];
  createdAt: string;
  createdBy: string;
};

export type SubCommunity = {
  id: string;
  name: string;
  icon: string;
  members: number;
};

export type CommunityCircle = {
  id: string;
  name: string;
  contribution: number;
  frequency: "weekly" | "biweekly" | "monthly";
  members: number;
  maxMembers: number;
  status: "active" | "forming" | "full" | "completed";
  type?: string;
  nextPayout?: string;
  spotsLeft?: number;
};

export type CommunityMember = {
  id: string;
  name: string;
  avatar?: string;
  role: MemberRole;
  xnScore: number;
  joinedAt: string;
  circlesCompleted: number;
  totalContributed: number;
};

export type Vouch = {
  id: string;
  voucherId: string;
  voucherName: string;
  voucherXnScore: number;
  vouchMessage?: string;
  createdAt: string;
};

// Suggestion types for the A, B, C, D Rule
export type CommunitySuggestion = {
  community: Community;
  reason: string;
  connectionType: "A" | "B" | "C" | "D";
  connectionCount?: number;
};

// Similar community for anti-fragmentation
export type SimilarCommunity = {
  id: string;
  name: string;
  icon: string;
  members: number;
  similarity: number;
  matchReasons: string[];
};

export type CreateCommunityData = {
  name: string;
  icon: string;
  type: CommunityType;
  description: string;
  privacy: CommunityPrivacy;
  parentId?: string;
  joinPolicy?: JoinPolicy;
  requiredVouches?: number;
  minimumXnScore?: number;
  region?: string;
  countryOfOrigin?: string;
};

export type MemberEligibility = {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  riskLevel: "low" | "medium" | "high";
  affordability?: AffordabilityResult;
};

type CommunityContextType = {
  // State
  myCommunities: Community[];
  discoverCommunities: Community[];
  suggestions: CommunitySuggestion[];
  isLoading: boolean;
  error: string | null;

  // Community Actions
  joinCommunity: (communityId: string) => Promise<{ success: boolean; error?: string }>;
  leaveCommunity: (communityId: string) => Promise<{ success: boolean; error?: string }>;
  createCommunity: (data: CreateCommunityData) => Promise<{
    success: boolean;
    communityId?: string;
    similarCommunities?: SimilarCommunity[];
    error?: string;
  }>;

  // Query Methods
  getCommunityById: (communityId: string) => Community | undefined;
  getCommunityCircles: (communityId: string) => Promise<CommunityCircle[]>;
  getSubCommunities: (communityId: string) => Promise<SubCommunity[]>;
  getCommunityMembers: (communityId: string) => Promise<CommunityMember[]>;
  searchCommunities: (query: string, type?: CommunityType) => Community[];

  // Eligibility
  checkMemberEligibility: (communityId: string, circleId?: string) => Promise<MemberEligibility>;
  checkSimilarCommunities: (name: string, type: CommunityType) => SimilarCommunity[];

  // Affordability
  checkCircleAffordability: (
    circleAmount: number,
    frequency: "weekly" | "biweekly" | "monthly"
  ) => Promise<AffordabilityResult>;
  getMaxAffordableContribution: (
    frequency: "weekly" | "biweekly" | "monthly",
    riskTolerance?: "safe" | "moderate" | "aggressive"
  ) => Promise<{ maxAmount: number; monthlyEquivalent: number; usedRatio: number }>;

  // Vouching
  vouchForMember: (vouchedUserId: string, communityId: string, message?: string) => Promise<{ success: boolean; error?: string }>;
  getVouchesForUser: (userId: string, communityId: string) => Promise<Vouch[]>;
  getMyVouchesGiven: (communityId: string) => Promise<Vouch[]>;

  // Refresh
  refreshCommunities: () => Promise<void>;
};

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const useCommunity = () => {
  const context = useContext(CommunityContext);
  if (!context) {
    throw new Error("useCommunity must be used within CommunityProvider");
  }
  return context;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Transform database row to Community type
const transformCommunity = (row: any, membership?: any): Community => ({
  id: row.id,
  name: row.name,
  icon: row.icon || "👥",
  type: row.community_type as CommunityType,
  description: row.description || "",
  members: row.member_count || 0,
  circles: row.active_circles_count || 0,
  verified: row.status === "active",
  isJoined: !!membership,
  role: membership?.role as MemberRole | undefined,
  privacy: row.is_private ? "private" : "public",
  parentId: row.parent_community_id || undefined,
  parentName: row.parent_community?.name,
  joinPolicy: row.join_policy as JoinPolicy,
  requiredVouches: row.required_vouches || 0,
  minimumXnScore: row.minimum_xn_score || 0,
  region: row.region || undefined,
  countryOfOrigin: row.country_of_origin || undefined,
  stats: {
    totalSaved: parseFloat(row.total_saved) || 0,
    activeCircles: row.active_circles_count || 0,
    completedCircles: 0, // Would need to query
    avgXnScore: 75, // Would need to calculate
  },
  createdAt: row.created_at,
  createdBy: row.created_by,
});

// ============================================================================
// PROVIDER
// ============================================================================

export const CommunityProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([]);
  const [suggestions, setSuggestions] = useState<CommunitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // FETCH COMMUNITIES
  // ============================================================================

  const fetchMyCommunities = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: queryError } = await supabase
        .from("community_memberships")
        .select(`
          *,
          community:communities(
            *,
            parent_community:communities!parent_community_id(name, icon)
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active");

      if (queryError) throw queryError;

      const communities = (data || []).map((membership) =>
        transformCommunity(membership.community, membership)
      );

      setMyCommunities(communities);
    } catch (err: any) {
      console.error("Error fetching my communities:", err);
      setError(err.message);
    }
  }, [user]);

  const fetchDiscoverCommunities = useCallback(async () => {
    if (!user) return;

    try {
      // Get IDs of communities user has already joined
      const { data: myMemberships } = await supabase
        .from("community_memberships")
        .select("community_id")
        .eq("user_id", user.id)
        .in("status", ["active", "pending"]);

      const joinedIds = (myMemberships || []).map((m) => m.community_id);

      // Fetch discoverable communities the user hasn't joined
      let query = supabase
        .from("communities")
        .select(`
          *,
          parent_community:communities!parent_community_id(name, icon)
        `)
        .eq("status", "active")
        .eq("is_discoverable", true)
        .order("member_count", { ascending: false })
        .limit(50);

      if (joinedIds.length > 0) {
        query = query.not("id", "in", `(${joinedIds.join(",")})`);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const communities = (data || []).map((row) => transformCommunity(row));
      setDiscoverCommunities(communities);

      // Generate suggestions (simplified - could be more sophisticated)
      if (communities.length > 0) {
        setSuggestions([
          {
            community: communities[0],
            reason: "Popular in your area",
            connectionType: "D",
          },
        ]);
      }
    } catch (err: any) {
      console.error("Error fetching discover communities:", err);
      setError(err.message);
    }
  }, [user]);

  // Fetch communities on mount and when user changes
  useEffect(() => {
    if (user) {
      setIsLoading(true);
      Promise.all([fetchMyCommunities(), fetchDiscoverCommunities()]).finally(
        () => setIsLoading(false)
      );
    } else {
      setMyCommunities([]);
      setDiscoverCommunities([]);
    }
  }, [user, fetchMyCommunities, fetchDiscoverCommunities]);

  // ============================================================================
  // JOIN COMMUNITY
  // ============================================================================

  const joinCommunity = async (
    communityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    setIsLoading(true);
    try {
      // Get community details
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .single();

      if (communityError) throw communityError;

      // Check eligibility
      const eligibility = await checkMemberEligibility(communityId);
      if (!eligibility.eligible) {
        return {
          success: false,
          error: eligibility.reasons.join(". "),
        };
      }

      // Determine initial status based on join policy
      let status: MembershipStatus = "active";
      if (community.join_policy === "approval_required") {
        status = "pending";
      } else if (community.join_policy === "vouch_required") {
        status = "pending";
      } else if (community.join_policy === "invite_only") {
        // Check for invitation
        const { data: invitation } = await supabase
          .from("community_invitations")
          .select("*")
          .eq("community_id", communityId)
          .eq("invitee_user_id", user.id)
          .eq("status", "pending")
          .single();

        if (!invitation) {
          return { success: false, error: "This community requires an invitation" };
        }

        // Accept the invitation
        await supabase
          .from("community_invitations")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);
      }

      // Create membership
      const { error: membershipError } = await supabase
        .from("community_memberships")
        .insert({
          user_id: user.id,
          community_id: communityId,
          status,
          joined_at: status === "active" ? new Date().toISOString() : null,
        });

      if (membershipError) {
        if (membershipError.code === "23505") {
          return { success: false, error: "You are already a member of this community" };
        }
        throw membershipError;
      }

      // Log activity
      if (status === "active") {
        await supabase.rpc("log_community_activity", {
          p_community_id: communityId,
          p_actor_user_id: user.id,
          p_activity_type: "member_joined",
          p_title: `${user.name} joined the community`,
        });
      }

      // Refresh communities
      await Promise.all([fetchMyCommunities(), fetchDiscoverCommunities()]);

      return {
        success: true,
        error: status === "pending" ? "Your membership request is pending approval" : undefined,
      };
    } catch (err: any) {
      console.error("Error joining community:", err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // LEAVE COMMUNITY
  // ============================================================================

  const leaveCommunity = async (
    communityId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    setIsLoading(true);
    try {
      // Check if user is the owner
      const { data: membership } = await supabase
        .from("community_memberships")
        .select("role")
        .eq("user_id", user.id)
        .eq("community_id", communityId)
        .single();

      if (membership?.role === "owner") {
        return {
          success: false,
          error: "As the owner, you must transfer ownership before leaving",
        };
      }

      // Update membership status
      const { error: updateError } = await supabase
        .from("community_memberships")
        .update({
          status: "left",
          left_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("community_id", communityId);

      if (updateError) throw updateError;

      // Log activity
      await supabase.rpc("log_community_activity", {
        p_community_id: communityId,
        p_actor_user_id: user.id,
        p_activity_type: "member_left",
        p_title: `${user.name} left the community`,
      });

      // Refresh communities
      await Promise.all([fetchMyCommunities(), fetchDiscoverCommunities()]);

      return { success: true };
    } catch (err: any) {
      console.error("Error leaving community:", err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // CREATE COMMUNITY
  // ============================================================================

  const createCommunity = async (
    data: CreateCommunityData
  ): Promise<{
    success: boolean;
    communityId?: string;
    similarCommunities?: SimilarCommunity[];
    error?: string;
  }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    setIsLoading(true);
    try {
      // Check for similar communities (anti-fragmentation)
      const similarCommunities = checkSimilarCommunities(data.name, data.type);

      if (similarCommunities.length > 0 && similarCommunities[0].similarity >= 70) {
        return {
          success: false,
          similarCommunities,
          error: "Similar communities already exist. Consider joining them instead.",
        };
      }

      // Create the community
      const { data: newCommunity, error: createError } = await supabase
        .from("communities")
        .insert({
          name: data.name,
          icon: data.icon,
          community_type: data.type,
          description: data.description,
          is_private: data.privacy === "private",
          is_discoverable: data.privacy === "public",
          join_policy: data.joinPolicy || "open",
          required_vouches: data.requiredVouches || 0,
          minimum_xn_score: data.minimumXnScore || 0,
          region: data.region,
          country_of_origin: data.countryOfOrigin,
          parent_community_id: data.parentId || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Note: The trigger automatically adds creator as owner

      // Refresh communities
      await Promise.all([fetchMyCommunities(), fetchDiscoverCommunities()]);

      return {
        success: true,
        communityId: newCommunity.id,
        similarCommunities: similarCommunities.length > 0 ? similarCommunities : undefined,
      };
    } catch (err: any) {
      console.error("Error creating community:", err);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // QUERY METHODS
  // ============================================================================

  const getCommunityById = (communityId: string): Community | undefined => {
    return [...myCommunities, ...discoverCommunities].find((c) => c.id === communityId);
  };

  const getCommunityCircles = async (communityId: string): Promise<CommunityCircle[]> => {
    try {
      const { data, error: queryError } = await supabase
        .from("circles")
        .select("*")
        .eq("community_id", communityId)
        .in("status", ["active", "pending", "forming"]);

      if (queryError) throw queryError;

      return (data || []).map((circle) => ({
        id: circle.id,
        name: circle.name,
        contribution: parseFloat(circle.amount),
        frequency: circle.frequency as "weekly" | "biweekly" | "monthly",
        members: circle.current_members || 0,
        maxMembers: circle.member_count || 10,
        status: circle.status as "active" | "forming" | "full" | "completed",
        type: circle.type,
        spotsLeft: (circle.member_count || 10) - (circle.current_members || 0),
      }));
    } catch (err: any) {
      console.error("Error fetching community circles:", err);
      return [];
    }
  };

  const getSubCommunities = async (communityId: string): Promise<SubCommunity[]> => {
    try {
      const { data, error: queryError } = await supabase
        .from("communities")
        .select("id, name, icon, member_count")
        .eq("parent_community_id", communityId)
        .eq("status", "active");

      if (queryError) throw queryError;

      return (data || []).map((sub) => ({
        id: sub.id,
        name: sub.name,
        icon: sub.icon || "👥",
        members: sub.member_count || 0,
      }));
    } catch (err: any) {
      console.error("Error fetching sub-communities:", err);
      return [];
    }
  };

  const getCommunityMembers = async (communityId: string): Promise<CommunityMember[]> => {
    try {
      const { data, error: queryError } = await supabase
        .from("community_memberships")
        .select(`
          *,
          profile:profiles(id, full_name, avatar_url, xn_score)
        `)
        .eq("community_id", communityId)
        .eq("status", "active")
        .order("role", { ascending: true })
        .limit(100);

      if (queryError) throw queryError;

      return (data || []).map((member) => ({
        id: member.user_id,
        name: member.profile?.full_name || "Unknown",
        avatar: member.profile?.avatar_url,
        role: member.role as MemberRole,
        xnScore: member.profile?.xn_score || 50,
        joinedAt: member.joined_at,
        circlesCompleted: member.circles_completed || 0,
        totalContributed: parseFloat(member.total_contributed) || 0,
      }));
    } catch (err: any) {
      console.error("Error fetching community members:", err);
      return [];
    }
  };

  const searchCommunities = (query: string, type?: CommunityType): Community[] => {
    const allCommunities = [...myCommunities, ...discoverCommunities];
    const queryLower = query.toLowerCase();

    return allCommunities.filter((community) => {
      const matchesQuery =
        query === "" || community.name.toLowerCase().includes(queryLower);
      const matchesType = !type || community.type === type;
      return matchesQuery && matchesType;
    });
  };

  // ============================================================================
  // ELIGIBILITY CHECK
  // ============================================================================

  const checkMemberEligibility = async (
    communityId: string,
    circleId?: string
  ): Promise<MemberEligibility> => {
    if (!user) {
      return {
        eligible: false,
        reasons: ["Not authenticated"],
        warnings: [],
        riskLevel: "high",
      };
    }

    const result: MemberEligibility = {
      eligible: true,
      reasons: [],
      warnings: [],
      riskLevel: "low",
    };

    try {
      // Get user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("xn_score")
        .eq("id", user.id)
        .single();

      const userXnScore = profile?.xn_score || 50;

      // Get community details
      const { data: community } = await supabase
        .from("communities")
        .select("*")
        .eq("id", communityId)
        .single();

      if (!community) {
        return {
          eligible: false,
          reasons: ["Community not found"],
          warnings: [],
          riskLevel: "high",
        };
      }

      // Check XnScore requirement
      if (userXnScore < (community.minimum_xn_score || 0)) {
        result.eligible = false;
        result.reasons.push(
          `XnScore too low: ${userXnScore} < ${community.minimum_xn_score} required`
        );
      }

      // Check member limit
      if (community.max_members && community.member_count >= community.max_members) {
        result.eligible = false;
        result.reasons.push("Community is full");
      }

      // Check for unresolved defaults
      const { count: defaultCount } = await supabase
        .from("defaults")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "unresolved");

      if (defaultCount && defaultCount > 0) {
        result.eligible = false;
        result.reasons.push("You have unresolved defaults");
        result.riskLevel = "high";
      }

      // Check vouch requirements
      if (community.join_policy === "vouch_required" && community.required_vouches > 0) {
        const { count: vouchCount } = await supabase
          .from("member_vouches")
          .select("*", { count: "exact", head: true })
          .eq("vouched_user_id", user.id)
          .eq("community_id", communityId)
          .eq("status", "active");

        if (!vouchCount || vouchCount < community.required_vouches) {
          result.eligible = false;
          result.reasons.push(
            `Need ${community.required_vouches} vouches, have ${vouchCount || 0}`
          );
        }
      }

      // Circle-specific checks
      if (circleId) {
        const { data: circle } = await supabase
          .from("circles")
          .select("*")
          .eq("id", circleId)
          .single();

        if (circle) {
          // Check circle XnScore requirement
          if (circle.min_score && userXnScore < circle.min_score) {
            result.eligible = false;
            result.reasons.push(
              `Circle requires XnScore of ${circle.min_score}, you have ${userXnScore}`
            );
          }

          // Check if circle is full
          if (circle.current_members >= circle.member_count) {
            result.eligible = false;
            result.reasons.push("Circle is full");
          }

          // Check max active circles (limit to 5)
          const { count: activeCircles } = await supabase
            .from("circle_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("status", "active");

          if (activeCircles && activeCircles >= 5) {
            result.eligible = false;
            result.reasons.push("Maximum of 5 active circles reached");
          }

          // ============================================================================
          // AFFORDABILITY CHECK
          // Check if user can afford this circle's contributions
          // ============================================================================
          const affordabilityResult = await affordabilityService.checkAffordability(
            user.id,
            parseFloat(circle.amount) || 0,
            circle.frequency as "weekly" | "biweekly" | "monthly"
          );

          result.affordability = affordabilityResult;

          if (!affordabilityResult.canAfford) {
            result.eligible = false;
            result.reasons.push(...affordabilityResult.reasons);
          }

          // Add affordability warnings
          if (affordabilityResult.warnings.length > 0) {
            result.warnings.push(...affordabilityResult.warnings);
          }

          // Add recommendations
          if (affordabilityResult.recommendations.length > 0) {
            result.warnings.push(...affordabilityResult.recommendations);
          }

          // Adjust risk level based on affordability
          if (affordabilityResult.riskLevel === "critical" || affordabilityResult.riskLevel === "high") {
            result.riskLevel = "high";
          } else if (affordabilityResult.riskLevel === "medium" && result.riskLevel === "low") {
            result.riskLevel = "medium";
          }
        }
      }

      // Determine risk level
      if (result.reasons.length > 0) {
        result.riskLevel = "high";
      } else if (result.warnings.length > 0) {
        result.riskLevel = "medium";
      }

      return result;
    } catch (err: any) {
      console.error("Error checking eligibility:", err);
      return {
        eligible: false,
        reasons: ["Error checking eligibility"],
        warnings: [],
        riskLevel: "high",
      };
    }
  };

  // ============================================================================
  // ANTI-FRAGMENTATION: CHECK SIMILAR COMMUNITIES
  // ============================================================================

  const checkSimilarCommunities = (name: string, type: CommunityType): SimilarCommunity[] => {
    const allCommunities = [...myCommunities, ...discoverCommunities];
    const nameLower = name.toLowerCase();

    const similar: SimilarCommunity[] = [];

    allCommunities.forEach((community) => {
      const communityNameLower = community.name.toLowerCase();
      const matchReasons: string[] = [];
      let similarity = 0;

      // Check for name similarity
      const nameWords = nameLower.split(/\s+/);
      const communityWords = communityNameLower.split(/\s+/);
      const commonWords = nameWords.filter((word) =>
        communityWords.some((cw) => cw.includes(word) || word.includes(cw))
      );

      if (commonWords.length > 0) {
        similarity +=
          (commonWords.length / Math.max(nameWords.length, communityWords.length)) * 50;
        matchReasons.push(`Similar name: "${commonWords.join(", ")}"`);
      }

      // Check for same type
      if (community.type === type) {
        similarity += 30;
        matchReasons.push("Same community type");
      }

      // Check for geographic overlap
      const regions = ["atlanta", "nyc", "dc", "dmv", "houston", "chicago", "la"];
      regions.forEach((region) => {
        if (nameLower.includes(region) && communityNameLower.includes(region)) {
          similarity += 20;
          matchReasons.push(`Same location: ${region.toUpperCase()}`);
        }
      });

      if (similarity >= 50) {
        similar.push({
          id: community.id,
          name: community.name,
          icon: community.icon,
          members: community.members,
          similarity: Math.round(similarity),
          matchReasons,
        });
      }
    });

    return similar.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  };

  // ============================================================================
  // VOUCHING SYSTEM
  // ============================================================================

  const vouchForMember = async (
    vouchedUserId: string,
    communityId: string,
    message?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      // Get voucher's membership and XnScore
      const { data: voucherMembership } = await supabase
        .from("community_memberships")
        .select("*")
        .eq("user_id", user.id)
        .eq("community_id", communityId)
        .eq("status", "active")
        .single();

      if (!voucherMembership) {
        return { success: false, error: "You must be an active community member to vouch" };
      }

      const { data: voucherProfile } = await supabase
        .from("profiles")
        .select("xn_score")
        .eq("id", user.id)
        .single();

      const voucherXnScore = voucherProfile?.xn_score || 50;

      if (voucherXnScore < 60) {
        return { success: false, error: "Your XnScore must be at least 60 to vouch" };
      }

      // Check vouch limit based on XnScore
      const maxVouches =
        voucherXnScore >= 90 ? 10 : voucherXnScore >= 80 ? 6 : voucherXnScore >= 70 ? 4 : 2;

      const { count: activeVouches } = await supabase
        .from("member_vouches")
        .select("*", { count: "exact", head: true })
        .eq("voucher_user_id", user.id)
        .eq("community_id", communityId)
        .eq("status", "active");

      if (activeVouches && activeVouches >= maxVouches) {
        return {
          success: false,
          error: `You can only vouch for ${maxVouches} members at your current XnScore`,
        };
      }

      // Can't vouch for yourself
      if (user.id === vouchedUserId) {
        return { success: false, error: "You cannot vouch for yourself" };
      }

      // Create vouch
      const { error: vouchError } = await supabase.from("member_vouches").insert({
        voucher_user_id: user.id,
        vouched_user_id: vouchedUserId,
        community_id: communityId,
        voucher_xn_score_at_time: voucherXnScore,
        vouch_message: message,
      });

      if (vouchError) {
        if (vouchError.code === "23505") {
          return { success: false, error: "You have already vouched for this member" };
        }
        throw vouchError;
      }

      // Log vouch event
      await supabase.from("vouch_events").insert({
        vouch_id: null, // Would need the vouch ID
        event_type: "created",
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error vouching for member:", err);
      return { success: false, error: err.message };
    }
  };

  const getVouchesForUser = async (userId: string, communityId: string): Promise<Vouch[]> => {
    try {
      const { data, error } = await supabase
        .from("member_vouches")
        .select(`
          *,
          voucher:profiles!voucher_user_id(full_name, xn_score)
        `)
        .eq("vouched_user_id", userId)
        .eq("community_id", communityId)
        .eq("status", "active");

      if (error) throw error;

      return (data || []).map((vouch) => ({
        id: vouch.id,
        voucherId: vouch.voucher_user_id,
        voucherName: vouch.voucher?.full_name || "Unknown",
        voucherXnScore: vouch.voucher?.xn_score || 50,
        vouchMessage: vouch.vouch_message,
        createdAt: vouch.created_at,
      }));
    } catch (err: any) {
      console.error("Error fetching vouches:", err);
      return [];
    }
  };

  const getMyVouchesGiven = async (communityId: string): Promise<Vouch[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from("member_vouches")
        .select(`
          *,
          vouched:profiles!vouched_user_id(full_name, xn_score)
        `)
        .eq("voucher_user_id", user.id)
        .eq("community_id", communityId)
        .eq("status", "active");

      if (error) throw error;

      return (data || []).map((vouch) => ({
        id: vouch.id,
        voucherId: user.id,
        voucherName: user.name,
        voucherXnScore: 0, // Not relevant for given vouches
        vouchMessage: vouch.vouch_message,
        createdAt: vouch.created_at,
      }));
    } catch (err: any) {
      console.error("Error fetching given vouches:", err);
      return [];
    }
  };

  // ============================================================================
  // AFFORDABILITY METHODS
  // ============================================================================

  /**
   * Check if current user can afford a circle with given contribution
   */
  const checkCircleAffordability = async (
    circleAmount: number,
    frequency: "weekly" | "biweekly" | "monthly"
  ): Promise<AffordabilityResult> => {
    if (!user) {
      return {
        canAfford: false,
        score: 0,
        riskLevel: "critical",
        monthlyIncome: 0,
        currentObligations: 0,
        newObligation: 0,
        totalObligationsAfter: 0,
        currentRatio: 0,
        proposedRatio: 0,
        maxAllowedRatio: 0.30,
        reasons: ["Not authenticated"],
        warnings: [],
        recommendations: ["Please log in to check affordability"],
        remainingCapacity: 0,
        safeCapacity: 0,
        riskFactors: [],
      };
    }

    return affordabilityService.checkAffordability(user.id, circleAmount, frequency);
  };

  /**
   * Get the maximum contribution amount user can safely afford
   */
  const getMaxAffordableContribution = async (
    frequency: "weekly" | "biweekly" | "monthly",
    riskTolerance: "safe" | "moderate" | "aggressive" = "moderate"
  ): Promise<{ maxAmount: number; monthlyEquivalent: number; usedRatio: number }> => {
    if (!user) {
      return { maxAmount: 0, monthlyEquivalent: 0, usedRatio: 0 };
    }

    const result = await affordabilityService.calculateMaxAffordableContribution(
      user.id,
      frequency,
      riskTolerance
    );

    return {
      maxAmount: result.maxAmount,
      monthlyEquivalent: result.monthlyEquivalent,
      usedRatio: result.usedRatio,
    };
  };

  // ============================================================================
  // REFRESH
  // ============================================================================

  const refreshCommunities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await Promise.all([fetchMyCommunities(), fetchDiscoverCommunities()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <CommunityContext.Provider
      value={{
        myCommunities,
        discoverCommunities,
        suggestions,
        isLoading,
        error,
        joinCommunity,
        leaveCommunity,
        createCommunity,
        getCommunityById,
        getCommunityCircles,
        getSubCommunities,
        getCommunityMembers,
        searchCommunities,
        checkMemberEligibility,
        checkSimilarCommunities,
        checkCircleAffordability,
        getMaxAffordableContribution,
        vouchForMember,
        getVouchesForUser,
        getMyVouchesGiven,
        refreshCommunities,
      }}
    >
      {children}
    </CommunityContext.Provider>
  );
};
