/**
 * CommunityHealthService.ts
 *
 * Comprehensive Community Health Score calculator for TandaXn
 *
 * The Community Health Score is a composite metric (0-100) that measures:
 * 1. Contribution Reliability (40%) - How reliably members make payments on time
 * 2. Activity Rate (20%) - How engaged members are with the community
 * 3. Default Rate (25%) - Inverse of defaults/missed payments
 * 4. Growth Health (15%) - Sustainable growth patterns
 *
 * Health Status Levels:
 * - Thriving (85-100): Excellent community health
 * - Healthy (70-84): Good community with minor areas for improvement
 * - At Risk (50-69): Community needs attention
 * - Critical (0-49): Serious intervention needed
 */

import { supabase } from "../lib/supabase";

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = "thriving" | "healthy" | "at_risk" | "critical";

export interface ContributionMetrics {
  totalContributions: number;
  onTimeContributions: number;
  lateContributions: number;
  missedContributions: number;
  onTimeRate: number;
  averageDelayDays: number;
}

export interface ActivityMetrics {
  activeMembers: number;
  totalMembers: number;
  activeRate: number;
  activeCircles: number;
  completedCircles: number;
  averageCircleCompletionRate: number;
  recentJoins: number;
  recentLeaves: number;
  netGrowth: number;
}

export interface DefaultMetrics {
  totalDefaults: number;
  unresolvedDefaults: number;
  resolvedDefaults: number;
  recoveryRate: number;
  defaultAmount: number;
  recoveredAmount: number;
  averageResolutionDays: number;
}

export interface GrowthMetrics {
  currentMembers: number;
  previousPeriodMembers: number;
  growthRate: number;
  memberRetentionRate: number;
  newMemberQuality: number; // Average XnScore of new members
  churnRate: number;
}

export interface CommunityHealthMetrics {
  contribution: ContributionMetrics;
  activity: ActivityMetrics;
  defaults: DefaultMetrics;
  growth: GrowthMetrics;
}

export interface ComponentScore {
  score: number;
  weight: number;
  weightedScore: number;
  status: HealthStatus;
  trend: "improving" | "stable" | "declining";
  details: string;
}

export interface HealthRecommendation {
  priority: "high" | "medium" | "low";
  category: "contribution" | "activity" | "defaults" | "growth" | "general";
  title: string;
  description: string;
  actionItems: string[];
  expectedImpact: string;
}

export interface CommunityHealthScore {
  communityId: string;
  communityName?: string;
  calculatedAt: string;

  // Overall Score
  overallScore: number;
  status: HealthStatus;
  trend: "improving" | "stable" | "declining";

  // Component Scores
  contributionScore: ComponentScore;
  activityScore: ComponentScore;
  defaultScore: ComponentScore;
  growthScore: ComponentScore;

  // Raw Metrics
  metrics: CommunityHealthMetrics;

  // Recommendations
  recommendations: HealthRecommendation[];

  // Historical Context
  previousScore?: number;
  scoreDelta?: number;
  thirtyDayTrend?: number[];
}

// Configuration for score calculation
interface HealthScoreConfig {
  // Component weights (must sum to 1.0)
  contributionWeight: number;
  activityWeight: number;
  defaultWeight: number;
  growthWeight: number;

  // Thresholds
  thrivingThreshold: number;
  healthyThreshold: number;
  atRiskThreshold: number;

  // Activity thresholds
  activeThresholdDays: number;
  recentPeriodDays: number;

  // Contribution thresholds
  excellentOnTimeRate: number;
  goodOnTimeRate: number;
  poorOnTimeRate: number;

  // Default thresholds
  excellentDefaultRate: number;
  acceptableDefaultRate: number;
  criticalDefaultRate: number;

  // Growth thresholds
  healthyGrowthRate: number;
  maxHealthyGrowthRate: number;
  healthyRetentionRate: number;
}

const DEFAULT_CONFIG: HealthScoreConfig = {
  contributionWeight: 0.40,
  activityWeight: 0.20,
  defaultWeight: 0.25,
  growthWeight: 0.15,

  thrivingThreshold: 85,
  healthyThreshold: 70,
  atRiskThreshold: 50,

  activeThresholdDays: 30,
  recentPeriodDays: 30,

  excellentOnTimeRate: 0.95,
  goodOnTimeRate: 0.85,
  poorOnTimeRate: 0.70,

  excellentDefaultRate: 0.02,
  acceptableDefaultRate: 0.05,
  criticalDefaultRate: 0.10,

  healthyGrowthRate: 0.05,
  maxHealthyGrowthRate: 0.30,
  healthyRetentionRate: 0.90,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getHealthStatus = (score: number, config: HealthScoreConfig): HealthStatus => {
  if (score >= config.thrivingThreshold) return "thriving";
  if (score >= config.healthyThreshold) return "healthy";
  if (score >= config.atRiskThreshold) return "at_risk";
  return "critical";
};

const getTrend = (current: number, previous: number | undefined): "improving" | "stable" | "declining" => {
  if (previous === undefined) return "stable";
  const delta = current - previous;
  if (delta > 2) return "improving";
  if (delta < -2) return "declining";
  return "stable";
};

const calculateComponentScore = (
  rawScore: number,
  weight: number,
  details: string,
  config: HealthScoreConfig,
  previousScore?: number
): ComponentScore => {
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  return {
    score,
    weight,
    weightedScore: Math.round(score * weight),
    status: getHealthStatus(score, config),
    trend: getTrend(score, previousScore),
    details,
  };
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

export class CommunityHealthService {
  private config: HealthScoreConfig;

  constructor(config?: Partial<HealthScoreConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fetch contribution metrics for a community
   */
  async getContributionMetrics(communityId: string): Promise<ContributionMetrics> {
    try {
      // Get all circle members in this community's circles
      const { data: circles } = await supabase
        .from("circles")
        .select("id")
        .eq("community_id", communityId);

      if (!circles || circles.length === 0) {
        return {
          totalContributions: 0,
          onTimeContributions: 0,
          lateContributions: 0,
          missedContributions: 0,
          onTimeRate: 1, // Default to perfect if no data
          averageDelayDays: 0,
        };
      }

      const circleIds = circles.map((c) => c.id);

      // Aggregate contribution stats from circle_members
      const { data: memberStats } = await supabase
        .from("circle_members")
        .select("contributions_on_time, contributions_late, contributions_missed")
        .in("circle_id", circleIds);

      const aggregated = (memberStats || []).reduce(
        (acc, m) => ({
          onTime: acc.onTime + (m.contributions_on_time || 0),
          late: acc.late + (m.contributions_late || 0),
          missed: acc.missed + (m.contributions_missed || 0),
        }),
        { onTime: 0, late: 0, missed: 0 }
      );

      const total = aggregated.onTime + aggregated.late + aggregated.missed;
      const onTimeRate = total > 0 ? aggregated.onTime / total : 1;

      return {
        totalContributions: total,
        onTimeContributions: aggregated.onTime,
        lateContributions: aggregated.late,
        missedContributions: aggregated.missed,
        onTimeRate,
        averageDelayDays: 0, // Would need payment timestamps to calculate
      };
    } catch (err) {
      console.error("Error fetching contribution metrics:", err);
      return {
        totalContributions: 0,
        onTimeContributions: 0,
        lateContributions: 0,
        missedContributions: 0,
        onTimeRate: 0.5,
        averageDelayDays: 0,
      };
    }
  }

  /**
   * Fetch activity metrics for a community
   */
  async getActivityMetrics(communityId: string): Promise<ActivityMetrics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.activeThresholdDays);

      // Get total members
      const { count: totalMembers } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active");

      // Get active members (have activity in last 30 days)
      const { count: activeMembers } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active")
        .gte("last_activity_at", cutoffDate.toISOString());

      // Get circle stats
      const { data: communityData } = await supabase
        .from("communities")
        .select("active_circles_count")
        .eq("id", communityId)
        .single();

      // Get completed circles count
      const { count: completedCircles } = await supabase
        .from("circles")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "completed");

      // Get recent joins (last 30 days)
      const { count: recentJoins } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active")
        .gte("joined_at", cutoffDate.toISOString());

      // Get recent leaves
      const { count: recentLeaves } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "left")
        .gte("left_at", cutoffDate.toISOString());

      const total = totalMembers || 0;
      const active = activeMembers || total; // Assume all active if no activity tracking

      return {
        activeMembers: active,
        totalMembers: total,
        activeRate: total > 0 ? active / total : 1,
        activeCircles: communityData?.active_circles_count || 0,
        completedCircles: completedCircles || 0,
        averageCircleCompletionRate: 0.8, // Would need more detailed calculation
        recentJoins: recentJoins || 0,
        recentLeaves: recentLeaves || 0,
        netGrowth: (recentJoins || 0) - (recentLeaves || 0),
      };
    } catch (err) {
      console.error("Error fetching activity metrics:", err);
      return {
        activeMembers: 0,
        totalMembers: 0,
        activeRate: 0,
        activeCircles: 0,
        completedCircles: 0,
        averageCircleCompletionRate: 0,
        recentJoins: 0,
        recentLeaves: 0,
        netGrowth: 0,
      };
    }
  }

  /**
   * Fetch default metrics for a community
   */
  async getDefaultMetrics(communityId: string): Promise<DefaultMetrics> {
    try {
      // Get all defaults for this community
      const { data: defaults } = await supabase
        .from("defaults")
        .select("*")
        .eq("community_id", communityId);

      if (!defaults || defaults.length === 0) {
        return {
          totalDefaults: 0,
          unresolvedDefaults: 0,
          resolvedDefaults: 0,
          recoveryRate: 1,
          defaultAmount: 0,
          recoveredAmount: 0,
          averageResolutionDays: 0,
        };
      }

      const unresolved = defaults.filter((d) => d.status === "unresolved").length;
      const resolved = defaults.filter((d) => d.status === "resolved").length;
      const totalAmount = defaults.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
      const recoveredAmount = defaults.reduce((sum, d) => sum + parseFloat(d.recovered_amount || 0), 0);

      return {
        totalDefaults: defaults.length,
        unresolvedDefaults: unresolved,
        resolvedDefaults: resolved,
        recoveryRate: totalAmount > 0 ? recoveredAmount / totalAmount : 1,
        defaultAmount: totalAmount,
        recoveredAmount,
        averageResolutionDays: 7, // Would need timestamps to calculate
      };
    } catch (err) {
      console.error("Error fetching default metrics:", err);
      return {
        totalDefaults: 0,
        unresolvedDefaults: 0,
        resolvedDefaults: 0,
        recoveryRate: 0,
        defaultAmount: 0,
        recoveredAmount: 0,
        averageResolutionDays: 0,
      };
    }
  }

  /**
   * Fetch growth metrics for a community
   */
  async getGrowthMetrics(communityId: string): Promise<GrowthMetrics> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get current member count
      const { count: currentMembers } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active");

      // Get members who joined before 30 days ago (approximate previous count)
      const { count: membersJoinedBefore } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "active")
        .lt("joined_at", thirtyDaysAgo.toISOString());

      // Get members who left in last 30 days
      const { count: recentlyLeft } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", communityId)
        .eq("status", "left")
        .gte("left_at", thirtyDaysAgo.toISOString());

      // Get new member quality (average XnScore of recent joins)
      const { data: newMembers } = await supabase
        .from("community_memberships")
        .select(`
          user_id,
          profile:profiles(xn_score)
        `)
        .eq("community_id", communityId)
        .gte("joined_at", thirtyDaysAgo.toISOString())
        .limit(50);

      const avgNewMemberScore =
        newMembers && newMembers.length > 0
          ? newMembers.reduce((sum, m) => sum + ((m.profile as any)?.xn_score || 50), 0) /
            newMembers.length
          : 50;

      const current = currentMembers || 0;
      const previous = membersJoinedBefore || current;
      const newJoins = current - previous + (recentlyLeft || 0);
      const growthRate = previous > 0 ? (current - previous) / previous : 0;
      const retentionRate = previous > 0 ? 1 - ((recentlyLeft || 0) / previous) : 1;

      return {
        currentMembers: current,
        previousPeriodMembers: previous,
        growthRate,
        memberRetentionRate: Math.max(0, Math.min(1, retentionRate)),
        newMemberQuality: avgNewMemberScore,
        churnRate: previous > 0 ? (recentlyLeft || 0) / previous : 0,
      };
    } catch (err) {
      console.error("Error fetching growth metrics:", err);
      return {
        currentMembers: 0,
        previousPeriodMembers: 0,
        growthRate: 0,
        memberRetentionRate: 1,
        newMemberQuality: 50,
        churnRate: 0,
      };
    }
  }

  /**
   * Calculate contribution reliability score (0-100)
   */
  calculateContributionScore(metrics: ContributionMetrics): number {
    const { onTimeRate, missedContributions, totalContributions } = metrics;

    if (totalContributions === 0) return 75; // Neutral score for new communities

    // Base score from on-time rate (0-80 points)
    let score = onTimeRate * 80;

    // Penalty for missed contributions (-20 points max)
    const missedRate = totalContributions > 0 ? missedContributions / totalContributions : 0;
    score -= missedRate * 20;

    // Bonus for perfect record
    if (onTimeRate >= 0.98 && missedContributions === 0) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate activity score (0-100)
   */
  calculateActivityScore(metrics: ActivityMetrics): number {
    const { activeRate, activeCircles, completedCircles, netGrowth } = metrics;

    // Base score from active rate (0-60 points)
    let score = activeRate * 60;

    // Bonus for active circles (0-20 points)
    const circleBonus = Math.min(20, activeCircles * 4);
    score += circleBonus;

    // Bonus for completed circles (0-10 points)
    const completionBonus = Math.min(10, completedCircles * 2);
    score += completionBonus;

    // Bonus/penalty for net growth (up to +/- 10 points)
    if (netGrowth > 0) {
      score += Math.min(10, netGrowth * 2);
    } else if (netGrowth < 0) {
      score += Math.max(-10, netGrowth * 2);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate default score (0-100, inverse of default rate)
   */
  calculateDefaultScore(
    metrics: DefaultMetrics,
    activityMetrics: ActivityMetrics
  ): number {
    const { totalDefaults, unresolvedDefaults, recoveryRate } = metrics;
    const { totalMembers } = activityMetrics;

    if (totalMembers === 0) return 75; // Neutral for new communities

    // Default rate per member
    const defaultRate = totalMembers > 0 ? totalDefaults / totalMembers : 0;

    // Base score (inverse of default rate)
    let score = 100;

    if (defaultRate <= this.config.excellentDefaultRate) {
      score = 100;
    } else if (defaultRate <= this.config.acceptableDefaultRate) {
      // Linear interpolation between 80-100
      const ratio =
        (defaultRate - this.config.excellentDefaultRate) /
        (this.config.acceptableDefaultRate - this.config.excellentDefaultRate);
      score = 100 - ratio * 20;
    } else if (defaultRate <= this.config.criticalDefaultRate) {
      // Linear interpolation between 50-80
      const ratio =
        (defaultRate - this.config.acceptableDefaultRate) /
        (this.config.criticalDefaultRate - this.config.acceptableDefaultRate);
      score = 80 - ratio * 30;
    } else {
      // Below 50 for critical rates
      score = Math.max(0, 50 - (defaultRate - this.config.criticalDefaultRate) * 500);
    }

    // Penalty for unresolved defaults
    const unresolvedPenalty = unresolvedDefaults * 5;
    score -= unresolvedPenalty;

    // Bonus for good recovery rate
    if (recoveryRate >= 0.8) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate growth health score (0-100)
   */
  calculateGrowthScore(metrics: GrowthMetrics): number {
    const { growthRate, memberRetentionRate, newMemberQuality, churnRate } = metrics;

    // Healthy growth is sustainable (5-30%)
    let growthScore = 50;
    if (growthRate >= this.config.healthyGrowthRate && growthRate <= this.config.maxHealthyGrowthRate) {
      growthScore = 90;
    } else if (growthRate > 0 && growthRate < this.config.healthyGrowthRate) {
      growthScore = 70;
    } else if (growthRate > this.config.maxHealthyGrowthRate) {
      // Too fast growth can be unstable
      growthScore = 60;
    } else if (growthRate < 0) {
      // Declining
      growthScore = Math.max(20, 50 + growthRate * 100);
    }

    // Retention factor (0-40 points)
    const retentionScore = memberRetentionRate * 40;

    // New member quality factor (0-20 points)
    const qualityScore = (newMemberQuality / 100) * 20;

    // Churn penalty
    const churnPenalty = Math.min(20, churnRate * 100);

    const score = (growthScore * 0.4) + retentionScore + qualityScore - churnPenalty;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendations based on scores
   */
  generateRecommendations(
    metrics: CommunityHealthMetrics,
    scores: {
      contribution: ComponentScore;
      activity: ComponentScore;
      defaults: ComponentScore;
      growth: ComponentScore;
    }
  ): HealthRecommendation[] {
    const recommendations: HealthRecommendation[] = [];

    // Contribution recommendations
    if (scores.contribution.score < 70) {
      recommendations.push({
        priority: scores.contribution.score < 50 ? "high" : "medium",
        category: "contribution",
        title: "Improve Payment Reliability",
        description: `On-time payment rate is ${Math.round(metrics.contribution.onTimeRate * 100)}%, which is below the target of 85%.`,
        actionItems: [
          "Send payment reminders 3 days before due date",
          "Enable automatic payment scheduling for members",
          "Identify members with repeated late payments for outreach",
          "Consider implementing grace periods with small fees",
        ],
        expectedImpact: "Improving on-time rates by 10% could increase community score by 4 points",
      });
    }

    // Activity recommendations
    if (scores.activity.score < 70) {
      recommendations.push({
        priority: scores.activity.score < 50 ? "high" : "medium",
        category: "activity",
        title: "Increase Community Engagement",
        description: `Only ${Math.round(metrics.activity.activeRate * 100)}% of members are actively participating.`,
        actionItems: [
          "Host community events or challenges",
          "Create incentives for active participation",
          "Reach out to inactive members",
          "Share success stories from active circles",
        ],
        expectedImpact: "Increasing active member rate by 15% could boost community vitality",
      });
    }

    // Default recommendations
    if (scores.defaults.score < 70) {
      recommendations.push({
        priority: scores.defaults.score < 50 ? "high" : "medium",
        category: "defaults",
        title: "Reduce Default Rate",
        description: `Community has ${metrics.defaults.unresolvedDefaults} unresolved defaults.`,
        actionItems: [
          "Implement stricter eligibility requirements",
          "Require vouches from established members",
          "Build a community reserve fund for coverage",
          "Follow up on unresolved defaults promptly",
        ],
        expectedImpact: "Resolving defaults and preventing new ones protects all members",
      });
    }

    // Growth recommendations
    if (scores.growth.score < 70) {
      if (metrics.growth.churnRate > 0.1) {
        recommendations.push({
          priority: "high",
          category: "growth",
          title: "Address Member Churn",
          description: `${Math.round(metrics.growth.churnRate * 100)}% of members have left recently.`,
          actionItems: [
            "Survey departing members on reasons for leaving",
            "Improve onboarding experience for new members",
            "Create mentorship programs for new joiners",
            "Build stronger community connections through events",
          ],
          expectedImpact: "Reducing churn improves stability and trust",
        });
      } else if (metrics.growth.growthRate < 0) {
        recommendations.push({
          priority: "medium",
          category: "growth",
          title: "Attract New Members",
          description: "Community membership is declining.",
          actionItems: [
            "Launch referral program with incentives",
            "Increase community visibility",
            "Partner with related communities",
            "Share success stories publicly",
          ],
          expectedImpact: "Sustainable growth ensures long-term community health",
        });
      }
    }

    // Sort by priority
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Main function: Calculate complete community health score
   */
  async calculateHealthScore(communityId: string): Promise<CommunityHealthScore> {
    const calculatedAt = new Date().toISOString();

    // Fetch all metrics
    const [contributionMetrics, activityMetrics, defaultMetrics, growthMetrics] = await Promise.all([
      this.getContributionMetrics(communityId),
      this.getActivityMetrics(communityId),
      this.getDefaultMetrics(communityId),
      this.getGrowthMetrics(communityId),
    ]);

    // Get community name
    const { data: community } = await supabase
      .from("communities")
      .select("name")
      .eq("id", communityId)
      .single();

    // Get previous score for trend calculation
    const { data: previousScoreData } = await supabase
      .from("community_health_scores")
      .select("score, calculated_at")
      .eq("community_id", communityId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .single();

    const previousScore = previousScoreData?.score;

    // Calculate component scores
    const contributionRawScore = this.calculateContributionScore(contributionMetrics);
    const activityRawScore = this.calculateActivityScore(activityMetrics);
    const defaultRawScore = this.calculateDefaultScore(defaultMetrics, activityMetrics);
    const growthRawScore = this.calculateGrowthScore(growthMetrics);

    const contributionScore = calculateComponentScore(
      contributionRawScore,
      this.config.contributionWeight,
      `${Math.round(contributionMetrics.onTimeRate * 100)}% on-time payments`,
      this.config
    );

    const activityScore = calculateComponentScore(
      activityRawScore,
      this.config.activityWeight,
      `${activityMetrics.activeCircles} active circles, ${Math.round(activityMetrics.activeRate * 100)}% active members`,
      this.config
    );

    const defaultScore = calculateComponentScore(
      defaultRawScore,
      this.config.defaultWeight,
      `${defaultMetrics.totalDefaults} total defaults, ${defaultMetrics.unresolvedDefaults} unresolved`,
      this.config
    );

    const growthScore = calculateComponentScore(
      growthRawScore,
      this.config.growthWeight,
      `${Math.round(growthMetrics.memberRetentionRate * 100)}% retention, ${growthMetrics.currentMembers} members`,
      this.config
    );

    // Calculate overall score
    const overallScore = Math.round(
      contributionScore.weightedScore +
        activityScore.weightedScore +
        defaultScore.weightedScore +
        growthScore.weightedScore
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      {
        contribution: contributionMetrics,
        activity: activityMetrics,
        defaults: defaultMetrics,
        growth: growthMetrics,
      },
      { contribution: contributionScore, activity: activityScore, defaults: defaultScore, growth: growthScore }
    );

    const result: CommunityHealthScore = {
      communityId,
      communityName: community?.name,
      calculatedAt,
      overallScore,
      status: getHealthStatus(overallScore, this.config),
      trend: getTrend(overallScore, previousScore),
      contributionScore,
      activityScore,
      defaultScore,
      growthScore,
      metrics: {
        contribution: contributionMetrics,
        activity: activityMetrics,
        defaults: defaultMetrics,
        growth: growthMetrics,
      },
      recommendations,
      previousScore,
      scoreDelta: previousScore !== undefined ? overallScore - previousScore : undefined,
    };

    // Save score to database
    await this.saveHealthScore(result);

    return result;
  }

  /**
   * Save health score to database
   */
  async saveHealthScore(healthScore: CommunityHealthScore): Promise<void> {
    try {
      await supabase.from("community_health_scores").insert({
        community_id: healthScore.communityId,
        calculated_at: healthScore.calculatedAt,
        score: healthScore.overallScore,
        status: healthScore.status,
        contribution_reliability_score: healthScore.contributionScore.score,
        contribution_reliability_weight: healthScore.contributionScore.weight,
        activity_rate_score: healthScore.activityScore.score,
        activity_rate_weight: healthScore.activityScore.weight,
        default_score: healthScore.defaultScore.score,
        default_weight: healthScore.defaultScore.weight,
        growth_score: healthScore.growthScore.score,
        growth_weight: healthScore.growthScore.weight,
        metrics: healthScore.metrics,
        recommendations: healthScore.recommendations,
      });
    } catch (err) {
      console.error("Error saving health score:", err);
    }
  }

  /**
   * Get historical health scores for a community
   */
  async getHealthScoreHistory(
    communityId: string,
    days: number = 30
  ): Promise<{ date: string; score: number; status: HealthStatus }[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    try {
      const { data } = await supabase
        .from("community_health_scores")
        .select("calculated_at, score, status")
        .eq("community_id", communityId)
        .gte("calculated_at", cutoff.toISOString())
        .order("calculated_at", { ascending: true });

      return (data || []).map((d) => ({
        date: d.calculated_at,
        score: d.score,
        status: d.status as HealthStatus,
      }));
    } catch (err) {
      console.error("Error fetching health score history:", err);
      return [];
    }
  }

  /**
   * Get latest health score without recalculating
   */
  async getLatestHealthScore(communityId: string): Promise<CommunityHealthScore | null> {
    try {
      const { data } = await supabase
        .from("community_health_scores")
        .select("*")
        .eq("community_id", communityId)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .single();

      if (!data) return null;

      return {
        communityId: data.community_id,
        calculatedAt: data.calculated_at,
        overallScore: data.score,
        status: data.status as HealthStatus,
        trend: "stable", // Would need more data to determine
        contributionScore: {
          score: data.contribution_reliability_score,
          weight: data.contribution_reliability_weight,
          weightedScore: Math.round(data.contribution_reliability_score * data.contribution_reliability_weight),
          status: getHealthStatus(data.contribution_reliability_score, this.config),
          trend: "stable",
          details: "",
        },
        activityScore: {
          score: data.activity_rate_score,
          weight: data.activity_rate_weight,
          weightedScore: Math.round(data.activity_rate_score * data.activity_rate_weight),
          status: getHealthStatus(data.activity_rate_score, this.config),
          trend: "stable",
          details: "",
        },
        defaultScore: {
          score: data.default_score,
          weight: data.default_weight,
          weightedScore: Math.round(data.default_score * data.default_weight),
          status: getHealthStatus(data.default_score, this.config),
          trend: "stable",
          details: "",
        },
        growthScore: {
          score: data.growth_score,
          weight: data.growth_weight,
          weightedScore: Math.round(data.growth_score * data.growth_weight),
          status: getHealthStatus(data.growth_score, this.config),
          trend: "stable",
          details: "",
        },
        metrics: data.metrics as CommunityHealthMetrics,
        recommendations: data.recommendations as HealthRecommendation[],
      };
    } catch (err) {
      console.error("Error fetching latest health score:", err);
      return null;
    }
  }
}

// Export default instance
export const communityHealthService = new CommunityHealthService();

// Export convenience functions
export const calculateCommunityHealthScore = (communityId: string) =>
  communityHealthService.calculateHealthScore(communityId);

export const getCommunityHealthHistory = (communityId: string, days?: number) =>
  communityHealthService.getHealthScoreHistory(communityId, days);

export const getLatestCommunityHealth = (communityId: string) =>
  communityHealthService.getLatestHealthScore(communityId);
