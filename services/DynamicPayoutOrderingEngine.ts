/**
 * DynamicPayoutOrderingEngine.ts
 *
 * Wraps PayoutOrderService with stability-optimized ordering.
 * Instead of scoring members independently, this engine:
 * 1. Gets per-member scores from PayoutOrderService
 * 2. Generates N candidate orderings via weighted random sampling
 * 3. Scores each ordering for circle stability (collapse risk, engagement, risk distribution)
 * 4. Selects the best ordering
 * 5. Generates rich, privacy-preserving explanations per member
 * 6. Manages mid-cycle reordering protocol
 * 7. Supports cultural/social priority signals
 */

import { supabase } from "../lib/supabase";
import {
  payoutOrderService,
  type ScoredMember,
  type PayoutOrder,
  type PayoutOrderEntry,
  type ComponentScores,
  type PositionConstraints,
  type AlgorithmWeights,
} from "./PayoutOrderService";

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type RiskEngagementModel = 'counterintuitive' | 'classic';

export type ReorderTriggerType =
  | 'emergency_need'
  | 'risk_spike'
  | 'member_removal'
  | 'democracy_vote'
  | 'admin_override';

export type ReorderStatus =
  | 'pending'
  | 'awaiting_vote'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type CulturalSignalType =
  | 'elder_status'
  | 'community_leader'
  | 'organizer_priority'
  | 'ceremony_host'
  | 'custom';

export type ExplanationImpact = 'positive' | 'neutral' | 'negative';

export interface StabilityScore {
  overall: number;                // 0-100
  collapseProb: number;           // 0.0-1.0
  engagementRetention: number;    // 0-100
  riskDistribution: number;       // 0-100
  contributionContinuity: number; // 0-100
}

export interface CandidateOrdering {
  ordering: string[];             // userId[] in position order
  stabilityScore: StabilityScore;
  compositeStability: number;     // weighted single number
}

export interface ExplanationComponent {
  component: 'preference' | 'need' | 'risk' | 'fairness' | 'stability' | 'cultural';
  description: string;
  impact: ExplanationImpact;
}

export interface PositionExplanation {
  id: string;
  payoutOrderId: string;
  circleId: string;
  userId: string;
  position: number;
  eligibleRangeMin: number;
  eligibleRangeMax: number;
  components: ExplanationComponent[];
  summaryText: string;
  createdAt: string;
}

export interface StabilityOptimizationRun {
  id: string;
  circleId: string;
  payoutOrderId: string | null;
  algorithmVersion: string;
  candidatesEvaluated: number;
  bestStabilityScore: number;
  worstStabilityScore: number | null;
  meanStabilityScore: number | null;
  selectedOrdering: any;
  stabilityBreakdown: StabilityScore;
  computationTimeMs: number | null;
  createdAt: string;
}

export interface MidCycleReorderRequest {
  id: string;
  circleId: string;
  triggerType: ReorderTriggerType;
  triggeredBy: string | null;
  triggerDetails: Record<string, any>;
  proposalId: string | null;
  status: ReorderStatus;
  previousOrderSnapshot: any;
  newOrderData: any | null;
  affectedMembers: string[] | null;
  notificationSent: boolean;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CulturalPrioritySignal {
  id: string;
  userId: string;
  circleId: string;
  signalType: CulturalSignalType;
  priorityWeight: number;
  grantedBy: string | null;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface DynamicOrderConfig {
  stabilityWeight: number;
  candidateCount: number;
  riskEngagementModel: RiskEngagementModel;
  culturalPriorityEnabled: boolean;
  midcycleReorderEnabled: boolean;
  midcycleEmergencyBypass: boolean;
}

interface DefaultProbability {
  userId: string;
  predictedProbability: number;
  riskBucket: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAPPERS
// ══════════════════════════════════════════════════════════════════════════════

function mapExplanation(row: any): PositionExplanation {
  return {
    id: row.id,
    payoutOrderId: row.payout_order_id,
    circleId: row.circle_id,
    userId: row.user_id,
    position: row.position,
    eligibleRangeMin: row.eligible_range_min,
    eligibleRangeMax: row.eligible_range_max,
    components: row.explanation_components || [],
    summaryText: row.summary_text,
    createdAt: row.created_at,
  };
}

function mapOptimizationRun(row: any): StabilityOptimizationRun {
  return {
    id: row.id,
    circleId: row.circle_id,
    payoutOrderId: row.payout_order_id,
    algorithmVersion: row.algorithm_version,
    candidatesEvaluated: row.candidates_evaluated,
    bestStabilityScore: parseFloat(row.best_stability_score) || 0,
    worstStabilityScore: row.worst_stability_score ? parseFloat(row.worst_stability_score) : null,
    meanStabilityScore: row.mean_stability_score ? parseFloat(row.mean_stability_score) : null,
    selectedOrdering: row.selected_ordering,
    stabilityBreakdown: row.stability_breakdown,
    computationTimeMs: row.computation_time_ms,
    createdAt: row.created_at,
  };
}

function mapReorderRequest(row: any): MidCycleReorderRequest {
  return {
    id: row.id,
    circleId: row.circle_id,
    triggerType: row.trigger_type,
    triggeredBy: row.triggered_by,
    triggerDetails: row.trigger_details || {},
    proposalId: row.proposal_id,
    status: row.status,
    previousOrderSnapshot: row.previous_order_snapshot,
    newOrderData: row.new_order_data,
    affectedMembers: row.affected_members,
    notificationSent: row.notification_sent,
    executedAt: row.executed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCulturalSignal(row: any): CulturalPrioritySignal {
  return {
    id: row.id,
    userId: row.user_id,
    circleId: row.circle_id,
    signalType: row.signal_type,
    priorityWeight: parseFloat(row.priority_weight) || 0,
    grantedBy: row.granted_by,
    reason: row.reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class DynamicPayoutOrderingEngine {

  // ──────────────────────────────────────────────────────────────────────────
  // A. STABILITY-OPTIMIZED ORDERING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Main entry point: determine the optimal payout order for a circle
   * using stability-aware optimization on top of PayoutOrderService scoring.
   */
  static async determineOptimizedOrder(circleId: string): Promise<PayoutOrder> {
    const startTime = Date.now();

    // 1. Get per-member scores from existing PayoutOrderService
    const { scoredMembers, circle, config } = await payoutOrderService.getScoreableMembers(circleId);

    // 2. Load dynamic ordering config
    const dynamicConfig = await this.loadDynamicConfig(circleId);

    // 3. If stability optimization disabled, fall back to standard algorithm
    if (dynamicConfig.stabilityWeight <= 0) {
      return payoutOrderService.determinePayoutOrder(circleId);
    }

    // 4. Load default probabilities for each member
    const defaultProbs = await this.loadDefaultProbabilities(
      scoredMembers.map(m => m.userId)
    );

    // 5. Apply counterintuitive risk model if enabled
    const adjustedMembers = dynamicConfig.riskEngagementModel === 'counterintuitive'
      ? scoredMembers.map(m => ({
          ...m,
          constraints: this.applyCounterIntuitiveConstraints(
            m.constraints,
            m,
            defaultProbs.find(d => d.userId === m.userId)?.predictedProbability || 0
          ),
        }))
      : scoredMembers;

    // 6. Apply cultural priority boosts if enabled
    let finalMembers = adjustedMembers;
    if (dynamicConfig.culturalPriorityEnabled) {
      finalMembers = await this.applyCulturalBoosts(adjustedMembers, circleId);
    }

    // 7. Generate and evaluate candidate orderings
    const candidates = this.generateCandidateOrderings(
      finalMembers,
      dynamicConfig.candidateCount,
      defaultProbs,
      dynamicConfig.riskEngagementModel
    );

    // 8. Select the best ordering
    const best = this.selectBestOrdering(candidates);
    const computationTimeMs = Date.now() - startTime;

    // 9. Build final PayoutOrderEntry[] from the winning ordering
    const finalOrder: PayoutOrderEntry[] = best.ordering.map((userId, index) => {
      const member = finalMembers.find(m => m.userId === userId)!;
      return {
        position: index + 1,
        userId,
        userName: member.membership?.profile?.full_name,
        scores: member.scores,
        compositeScore: member.compositeScore,
        assignedReason: `Stability-optimized position (score: ${best.compositeStability.toFixed(1)})`,
      };
    });

    // 10. Store the payout order
    const { data: payoutOrder, error: orderError } = await supabase
      .from("payout_orders")
      .upsert({
        circle_id: circleId,
        order_data: finalOrder,
        algorithm_version: 'hybrid_stability_v1',
        weights: config.weights,
        status: 'active',
        modifications: [],
        stability_score: best.compositeStability,
        calculated_at: new Date().toISOString(),
      }, { onConflict: "circle_id" })
      .select()
      .single();

    if (orderError) throw orderError;

    // 11. Store optimization run
    const stabilityBreakdown = best.stabilityScore;
    const allScores = candidates.map(c => c.compositeStability);

    await supabase.from("stability_optimization_runs").insert({
      circle_id: circleId,
      payout_order_id: payoutOrder.id,
      algorithm_version: 'stability_v1',
      candidates_evaluated: candidates.length,
      best_stability_score: best.compositeStability,
      worst_stability_score: Math.min(...allScores),
      mean_stability_score: allScores.reduce((a, b) => a + b, 0) / allScores.length,
      selected_ordering: best.ordering,
      stability_breakdown: stabilityBreakdown,
      risk_model_inputs: defaultProbs,
      computation_time_ms: computationTimeMs,
    });

    // 12. Update payout_orders with optimization_run_id
    const { data: runData } = await supabase
      .from("stability_optimization_runs")
      .select("id")
      .eq("payout_order_id", payoutOrder.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (runData) {
      await supabase
        .from("payout_orders")
        .update({ optimization_run_id: runData.id })
        .eq("id", payoutOrder.id);
    }

    // 13. Generate explanations for all members
    await this.generateExplanations(
      payoutOrder.id,
      circleId,
      finalMembers,
      best.ordering,
      dynamicConfig
    );

    console.log(
      `[DynamicPayout] Optimized order for circle ${circleId}: ` +
      `${candidates.length} candidates evaluated, ` +
      `best stability: ${best.compositeStability.toFixed(2)}, ` +
      `${computationTimeMs}ms`
    );

    return {
      id: payoutOrder.id,
      circleId,
      order: finalOrder,
      algorithmVersion: 'hybrid_stability_v1',
      weights: config.weights,
      status: 'active',
      modifications: [],
      calculatedAt: payoutOrder.calculated_at,
      createdAt: payoutOrder.created_at,
      updatedAt: payoutOrder.updated_at,
    };
  }

  /**
   * Get the latest stability optimization run for a circle.
   */
  static async getStabilityRun(circleId: string): Promise<StabilityOptimizationRun | null> {
    const { data, error } = await supabase
      .from("stability_optimization_runs")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return mapOptimizationRun(data);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CANDIDATE GENERATION & STABILITY SCORING
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate N candidate orderings via weighted random sampling.
   * Biased by composite scores (higher-scored members more likely earlier).
   * Respects hard constraints (min/max position).
   */
  private static generateCandidateOrderings(
    scoredMembers: ScoredMember[],
    candidateCount: number,
    defaultProbs: DefaultProbability[],
    riskModel: RiskEngagementModel
  ): CandidateOrdering[] {
    const memberCount = scoredMembers.length;
    const candidates: CandidateOrdering[] = [];

    // Always include the "greedy" ordering (sorted by composite score) as candidate #1
    const greedyOrdering = [...scoredMembers]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map(m => m.userId);

    const greedyStability = this.scoreOrderingStability(
      greedyOrdering, scoredMembers, defaultProbs, riskModel
    );
    candidates.push({
      ordering: greedyOrdering,
      stabilityScore: greedyStability,
      compositeStability: greedyStability.overall,
    });

    // Generate remaining candidates via weighted random sampling
    for (let i = 1; i < candidateCount; i++) {
      const ordering = this.generateWeightedRandomOrdering(scoredMembers);

      // Validate constraints
      if (!this.validateConstraints(ordering, scoredMembers)) continue;

      const stability = this.scoreOrderingStability(
        ordering, scoredMembers, defaultProbs, riskModel
      );

      candidates.push({
        ordering,
        stabilityScore: stability,
        compositeStability: stability.overall,
      });
    }

    return candidates;
  }

  /**
   * Generate a single weighted random ordering.
   * Members with higher composite scores are more likely to appear earlier.
   */
  private static generateWeightedRandomOrdering(scoredMembers: ScoredMember[]): string[] {
    const remaining = [...scoredMembers];
    const ordering: string[] = [];

    while (remaining.length > 0) {
      // Weight by composite score + random noise
      const weights = remaining.map(m => Math.max(1, m.compositeScore + (Math.random() * 30 - 15)));
      const totalWeight = weights.reduce((a, b) => a + b, 0);

      // Weighted random selection
      let rand = Math.random() * totalWeight;
      let selectedIdx = 0;
      for (let j = 0; j < weights.length; j++) {
        rand -= weights[j];
        if (rand <= 0) {
          selectedIdx = j;
          break;
        }
      }

      ordering.push(remaining[selectedIdx].userId);
      remaining.splice(selectedIdx, 1);
    }

    return ordering;
  }

  /**
   * Validate that an ordering respects all hard constraints.
   */
  private static validateConstraints(
    ordering: string[],
    scoredMembers: ScoredMember[]
  ): boolean {
    for (let pos = 0; pos < ordering.length; pos++) {
      const member = scoredMembers.find(m => m.userId === ordering[pos]);
      if (!member) continue;

      const position = pos + 1; // 1-indexed
      const { constraints } = member;

      if (constraints.lockedPosition !== null && constraints.lockedPosition !== position) {
        return false;
      }
      if (position < constraints.minPosition || position > constraints.maxPosition) {
        return false;
      }
    }
    return true;
  }

  /**
   * Score a candidate ordering for stability.
   * Higher = more stable circle.
   */
  private static scoreOrderingStability(
    ordering: string[],
    scoredMembers: ScoredMember[],
    defaultProbs: DefaultProbability[],
    riskModel: RiskEngagementModel
  ): StabilityScore {
    const memberCount = ordering.length;

    // 1. Collapse probability: estimate probability that enough defaults occur to kill the circle
    let cumulativeDefaultRisk = 0;
    for (let pos = 0; pos < memberCount; pos++) {
      const userId = ordering[pos];
      const prob = defaultProbs.find(d => d.userId === userId)?.predictedProbability || 0;
      // Members at later positions have more cycles of exposure
      const exposureFactor = (memberCount - pos) / memberCount;
      cumulativeDefaultRisk += prob * exposureFactor;
    }
    // Normalize to 0-1 range
    const collapseProb = Math.min(1, cumulativeDefaultRisk / memberCount);

    // 2. Engagement retention: penalize putting moderate-risk members late
    let engagementScore = 100;
    for (let pos = 0; pos < memberCount; pos++) {
      const userId = ordering[pos];
      const prob = defaultProbs.find(d => d.userId === userId)?.predictedProbability || 0;
      const positionPct = (pos + 1) / memberCount; // 0-1, higher = later

      if (riskModel === 'counterintuitive' && prob >= 0.15 && prob < 0.40) {
        // Moderate risk members placed late lose engagement
        if (positionPct > 0.6) {
          engagementScore -= (positionPct - 0.6) * 50 * prob;
        }
      }
    }
    engagementScore = Math.max(0, Math.min(100, engagementScore));

    // 3. Risk distribution: penalize clustering of high-risk members in adjacent positions
    let riskDistributionScore = 100;
    const windowSize = Math.min(3, Math.floor(memberCount / 2));
    for (let pos = 0; pos <= memberCount - windowSize; pos++) {
      let windowRisk = 0;
      for (let w = 0; w < windowSize; w++) {
        const userId = ordering[pos + w];
        windowRisk += defaultProbs.find(d => d.userId === userId)?.predictedProbability || 0;
      }
      const avgWindowRisk = windowRisk / windowSize;
      if (avgWindowRisk > 0.25) {
        riskDistributionScore -= (avgWindowRisk - 0.25) * 100;
      }
    }
    riskDistributionScore = Math.max(0, Math.min(100, riskDistributionScore));

    // 4. Contribution continuity: members with high default prob placed late = many cycles of uncertainty
    let continuityScore = 100;
    for (let pos = 0; pos < memberCount; pos++) {
      const userId = ordering[pos];
      const prob = defaultProbs.find(d => d.userId === userId)?.predictedProbability || 0;
      const cyclesRemaining = memberCount - pos;
      // High-risk member placed late means cyclesRemaining cycles of uncertainty
      if (prob > 0.20) {
        continuityScore -= prob * cyclesRemaining * 3;
      }
    }
    continuityScore = Math.max(0, Math.min(100, continuityScore));

    // Weighted overall score
    const overall =
      (1 - collapseProb) * 25 +
      engagementScore * 0.30 +
      riskDistributionScore * 0.25 +
      continuityScore * 0.20;

    return {
      overall: Math.max(0, Math.min(100, overall)),
      collapseProb,
      engagementRetention: engagementScore,
      riskDistribution: riskDistributionScore,
      contributionContinuity: continuityScore,
    };
  }

  /**
   * Select the best candidate ordering.
   */
  private static selectBestOrdering(candidates: CandidateOrdering[]): CandidateOrdering {
    return candidates.reduce((best, c) =>
      c.compositeStability > best.compositeStability ? c : best
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // B. COUNTERINTUITIVE RISK LOGIC
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * For 'counterintuitive' model: moderate/high risk with defaultProb < 0.40
   * get RELAXED minPosition (earlier is better for engagement).
   * Very high risk stays restricted.
   */
  private static applyCounterIntuitiveConstraints(
    constraints: PositionConstraints,
    member: ScoredMember,
    defaultProb: number
  ): PositionConstraints {
    // Very high risk: keep restricted (defaultProb >= 0.40 or riskLevel is very_high)
    if (defaultProb >= 0.40 || constraints.riskLevel === 'very_high') {
      return constraints;
    }

    // High risk with defaultProb < 0.40: relax to allow mid-to-early placement
    if (constraints.riskLevel === 'high' && defaultProb < 0.40) {
      return {
        ...constraints,
        minPosition: 1,
        reasons: [
          ...constraints.reasons.filter(r => r !== 'high_risk_restricted'),
          'counterintuitive_early_for_engagement',
        ],
      };
    }

    // Medium risk: relax to allow any position
    if (constraints.riskLevel === 'medium') {
      return {
        ...constraints,
        minPosition: 1,
        reasons: [
          ...constraints.reasons.filter(r => r !== 'medium_risk_restricted'),
          'counterintuitive_flexible_for_engagement',
        ],
      };
    }

    return constraints;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // C. EXPLANATION GENERATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Generate and store rich, privacy-preserving explanations for each member.
   */
  static async generateExplanations(
    orderId: string,
    circleId: string,
    scoredMembers: ScoredMember[],
    ordering: string[],
    config: DynamicOrderConfig
  ): Promise<void> {
    const explanations = ordering.map((userId, index) => {
      const member = scoredMembers.find(m => m.userId === userId);
      if (!member) return null;

      const position = index + 1;
      const components = this.buildExplanationComponents(member, position, ordering.length, config);
      const summaryText = this.buildSummaryText(
        components,
        position,
        member.constraints.minPosition,
        member.constraints.maxPosition
      );

      return {
        payout_order_id: orderId,
        circle_id: circleId,
        user_id: userId,
        position,
        eligible_range_min: member.constraints.minPosition,
        eligible_range_max: member.constraints.maxPosition,
        explanation_components: components,
        summary_text: summaryText,
        privacy_redacted: true,
      };
    }).filter(Boolean);

    if (explanations.length > 0) {
      // Delete old explanations for this order first
      await supabase
        .from("payout_position_explanations")
        .delete()
        .eq("payout_order_id", orderId);

      await supabase
        .from("payout_position_explanations")
        .insert(explanations);
    }
  }

  /**
   * Build explanation components for a single member.
   */
  private static buildExplanationComponents(
    member: ScoredMember,
    position: number,
    totalMembers: number,
    config: DynamicOrderConfig
  ): ExplanationComponent[] {
    const components: ExplanationComponent[] = [];

    // Preference component
    if (member.preference) {
      const prefType = member.preference.preferenceType;
      const isEarly = position <= Math.ceil(totalMembers * 0.33);
      const isLate = position >= Math.ceil(totalMembers * 0.67);

      if (prefType === 'need_early' && isEarly) {
        components.push({
          component: 'preference',
          description: 'Your stated preference for an early position was honored.',
          impact: 'positive',
        });
      } else if (prefType === 'prefer_early' && isEarly) {
        components.push({
          component: 'preference',
          description: 'Your preference for an earlier position was accommodated.',
          impact: 'positive',
        });
      } else if (prefType === 'prefer_late' && isLate) {
        components.push({
          component: 'preference',
          description: 'Your preference for a later position was honored, and you earned flexibility credits.',
          impact: 'positive',
        });
      } else if (prefType === 'flexible') {
        components.push({
          component: 'preference',
          description: 'Your flexible preference allowed optimal placement for circle stability.',
          impact: 'neutral',
        });
      } else {
        components.push({
          component: 'preference',
          description: 'Your stated preference was partially accommodated within stability constraints.',
          impact: 'neutral',
        });
      }
    } else {
      components.push({
        component: 'preference',
        description: 'No position preference was declared, so placement was optimized for circle health.',
        impact: 'neutral',
      });
    }

    // Need component
    if (member.need) {
      const isEarly = position <= Math.ceil(totalMembers * 0.40);
      components.push({
        component: 'need',
        description: isEarly
          ? `Your declared financial need contributed to your earlier placement.`
          : `Your declared financial need was considered alongside other members' needs and circle stability.`,
        impact: isEarly ? 'positive' : 'neutral',
      });
    }

    // Risk component (privacy-preserving — never reveals score or "risky")
    if (member.scores.risk >= 75) {
      components.push({
        component: 'risk',
        description: 'Your strong contribution history provided flexibility in position assignment.',
        impact: 'positive',
      });
    } else if (member.scores.risk >= 50) {
      components.push({
        component: 'risk',
        description: 'Your contribution history was factored into placement.',
        impact: 'neutral',
      });
    } else {
      components.push({
        component: 'risk',
        description: 'Your contribution record was considered in determining the best position for circle health.',
        impact: 'neutral',
      });
    }

    // Stability component (always present for dynamic ordering)
    components.push({
      component: 'stability',
      description: `Position ${position} was selected to optimize the circle's overall health and minimize risk of disruption.`,
      impact: 'neutral',
    });

    // Fairness component
    if (member.fairnessCredits > 0) {
      components.push({
        component: 'fairness',
        description: `Your fairness credits from past circles (${member.fairnessCredits} points) helped improve your placement.`,
        impact: 'positive',
      });
    }

    // Cultural component
    if (member.constraints.reasons.some(r => r.includes('cultural') || r.includes('elder') || r.includes('organizer'))) {
      components.push({
        component: 'cultural',
        description: 'Your community standing was recognized in your placement.',
        impact: 'positive',
      });
    }

    return components;
  }

  /**
   * Build a privacy-safe summary paragraph from explanation components.
   */
  private static buildSummaryText(
    components: ExplanationComponent[],
    position: number,
    eligibleMin: number,
    eligibleMax: number
  ): string {
    const positiveFactors = components
      .filter(c => c.impact === 'positive')
      .map(c => c.component);

    const rangeText = eligibleMin === eligibleMax
      ? `Position ${position} was the only eligible position for you.`
      : `You qualified for positions ${eligibleMin}-${eligibleMax} based on your profile.`;

    let summary = `Your position was determined by your contribution history, `;
    if (positiveFactors.length > 0) {
      const factorNames: Record<string, string> = {
        preference: 'your stated preference',
        need: 'your declared financial need',
        risk: 'your strong contribution record',
        fairness: 'your fairness credits',
        cultural: 'your community standing',
        stability: 'circle stability optimization',
      };
      const named = positiveFactors.map(f => factorNames[f] || f);
      summary += named.join(', ') + ', ';
    }
    summary += `and circle stability optimization. ${rangeText} `;
    summary += `Position ${position} was assigned to best balance the circle's overall health.`;

    return summary;
  }

  /**
   * Get a member's own explanation for the active order.
   */
  static async getMyExplanation(
    userId: string,
    circleId: string
  ): Promise<PositionExplanation | null> {
    // Get the active payout order
    const { data: order } = await supabase
      .from("payout_orders")
      .select("id")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .single();

    if (!order) return null;

    const { data, error } = await supabase
      .from("payout_position_explanations")
      .select("*")
      .eq("payout_order_id", order.id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;
    return mapExplanation(data);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // D. MID-CYCLE REORDERING PROTOCOL
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Request a mid-cycle reorder.
   * Emergency triggers bypass democracy; others create a proposal vote.
   */
  static async requestMidCycleReorder(
    circleId: string,
    triggerType: ReorderTriggerType,
    triggeredBy: string,
    details: Record<string, any>
  ): Promise<string> {
    // Load config
    const config = await this.loadDynamicConfig(circleId);
    if (!config.midcycleReorderEnabled) {
      throw new Error('Mid-cycle reordering is not enabled for this circle');
    }

    // Snapshot current order
    const { data: currentOrder } = await supabase
      .from("payout_orders")
      .select("*")
      .eq("circle_id", circleId)
      .eq("status", "active")
      .single();

    if (!currentOrder) {
      throw new Error('No active payout order found for this circle');
    }

    // Determine initial status based on trigger type
    let status: ReorderStatus = 'pending';
    let proposalId: string | null = null;

    const emergencyTypes: ReorderTriggerType[] = ['emergency_need', 'risk_spike', 'member_removal', 'admin_override'];
    if (emergencyTypes.includes(triggerType) && config.midcycleEmergencyBypass) {
      status = 'approved';
    } else if (triggerType === 'democracy_vote') {
      // Create a democracy proposal
      try {
        const { CircleDemocracyEngine } = await import('./CircleDemocracyEngine');
        const proposal = await CircleDemocracyEngine.createProposal({
          circleId,
          proposedBy: triggeredBy,
          proposalType: 'change_payout_order',
          title: 'Mid-Cycle Payout Order Recalculation',
          description: details.reason || 'Requesting recalculation of payout order based on changed circumstances.',
        });
        proposalId = proposal.id;
        status = 'awaiting_vote';
      } catch (err) {
        console.error('[DynamicPayout] Failed to create democracy proposal:', err);
        status = 'pending';
      }
    }

    // Create reorder request
    const { data: request, error } = await supabase
      .from("midcycle_reorder_requests")
      .insert({
        circle_id: circleId,
        trigger_type: triggerType,
        triggered_by: triggeredBy,
        trigger_details: details,
        proposal_id: proposalId,
        status,
        previous_order_snapshot: currentOrder.order_data,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-execute if immediately approved
    if (status === 'approved') {
      try {
        await this.executeMidCycleReorder(request.id);
      } catch (err) {
        console.error('[DynamicPayout] Auto-execution failed:', err);
      }
    }

    console.log(
      `[DynamicPayout] Reorder request ${request.id} created for circle ${circleId}: ` +
      `trigger=${triggerType}, status=${status}`
    );

    return request.id;
  }

  /**
   * Execute a mid-cycle reorder. Re-runs the optimization with already-paid positions locked.
   */
  static async executeMidCycleReorder(reorderRequestId: string): Promise<PayoutOrder> {
    // Get the reorder request
    const { data: request, error: reqError } = await supabase
      .from("midcycle_reorder_requests")
      .select("*")
      .eq("id", reorderRequestId)
      .single();

    if (reqError || !request) throw new Error('Reorder request not found');
    if (request.status !== 'approved') throw new Error(`Reorder request is not approved (status: ${request.status})`);

    // Update status to executing
    await supabase
      .from("midcycle_reorder_requests")
      .update({ status: 'executing' })
      .eq("id", reorderRequestId);

    // Get current cycle to know which positions are already paid
    const { data: currentCycle } = await supabase
      .from("circle_cycles")
      .select("cycle_number")
      .eq("circle_id", request.circle_id)
      .in("status", ["active", "contribution_period", "payout_pending"])
      .order("cycle_number", { ascending: false })
      .limit(1)
      .single();

    const paidPositions = currentCycle ? currentCycle.cycle_number : 0;

    // Re-run optimization
    const newOrder = await this.determineOptimizedOrder(request.circle_id);

    // Determine affected members (who moved)
    const previousOrder = request.previous_order_snapshot as PayoutOrderEntry[];
    const affectedMembers: string[] = [];

    for (const entry of newOrder.order) {
      if (entry.position <= paidPositions) continue; // Skip already-paid positions
      const oldEntry = previousOrder.find((p: any) => p.userId === entry.userId);
      if (oldEntry && oldEntry.position !== entry.position) {
        affectedMembers.push(entry.userId);
      }
    }

    // Update payout_orders reorder count
    await supabase
      .from("payout_orders")
      .update({ reorder_count: (request.previous_order_snapshot as any[])?.length > 0 ? 1 : 0 })
      .eq("id", newOrder.id);

    // Complete the request
    await supabase
      .from("midcycle_reorder_requests")
      .update({
        status: 'completed',
        new_order_data: newOrder.order,
        affected_members: affectedMembers,
        notification_sent: false,
        executed_at: new Date().toISOString(),
      })
      .eq("id", reorderRequestId);

    console.log(
      `[DynamicPayout] Mid-cycle reorder completed for circle ${request.circle_id}: ` +
      `${affectedMembers.length} members affected`
    );

    return newOrder;
  }

  /**
   * Called by CircleDemocracyEngine when a change_payout_order proposal resolves.
   */
  static async onProposalResolved(
    proposalId: string,
    result: 'approved' | 'rejected'
  ): Promise<void> {
    // Find the reorder request linked to this proposal
    const { data: request } = await supabase
      .from("midcycle_reorder_requests")
      .select("*")
      .eq("proposal_id", proposalId)
      .eq("status", "awaiting_vote")
      .single();

    if (!request) return; // No linked reorder request

    if (result === 'approved') {
      await supabase
        .from("midcycle_reorder_requests")
        .update({ status: 'approved' })
        .eq("id", request.id);

      try {
        await this.executeMidCycleReorder(request.id);
      } catch (err) {
        console.error('[DynamicPayout] Post-vote reorder execution failed:', err);
      }
    } else {
      await supabase
        .from("midcycle_reorder_requests")
        .update({ status: 'rejected' })
        .eq("id", request.id);
    }
  }

  /**
   * Get reorder requests for a circle.
   */
  static async getReorderRequests(circleId: string): Promise<MidCycleReorderRequest[]> {
    const { data, error } = await supabase
      .from("midcycle_reorder_requests")
      .select("*")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map(mapReorderRequest);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // E. CULTURAL PRIORITY SIGNALS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Set a cultural priority signal for a member in a circle.
   */
  static async setCulturalPriority(
    userId: string,
    circleId: string,
    signalType: CulturalSignalType,
    weight: number,
    grantedBy: string,
    reason?: string
  ): Promise<CulturalPrioritySignal> {
    // Clamp weight to 0-0.10
    const clampedWeight = Math.max(0, Math.min(0.10, weight));

    const { data, error } = await supabase
      .from("cultural_priority_signals")
      .upsert({
        user_id: userId,
        circle_id: circleId,
        signal_type: signalType,
        priority_weight: clampedWeight,
        granted_by: grantedBy,
        reason: reason || null,
      }, { onConflict: "user_id,circle_id,signal_type" })
      .select()
      .single();

    if (error) throw error;
    return mapCulturalSignal(data);
  }

  /**
   * Get all cultural priority signals for a circle.
   */
  static async getCulturalPriorities(circleId: string): Promise<CulturalPrioritySignal[]> {
    const { data, error } = await supabase
      .from("cultural_priority_signals")
      .select("*")
      .eq("circle_id", circleId);

    if (error || !data) return [];
    return data.map(mapCulturalSignal);
  }

  /**
   * Apply cultural boosts to scored members.
   * Adds bonus to composite score (0-10 points) based on cultural signals.
   */
  private static async applyCulturalBoosts(
    scoredMembers: ScoredMember[],
    circleId: string
  ): Promise<ScoredMember[]> {
    const signals = await this.getCulturalPriorities(circleId);
    if (signals.length === 0) return scoredMembers;

    const now = new Date();
    return scoredMembers.map(member => {
      const memberSignals = signals.filter(
        s => s.userId === member.userId &&
        (!s.expiresAt || new Date(s.expiresAt) > now)
      );

      if (memberSignals.length === 0) return member;

      // Sum priority weights (each 0-0.10, total capped at 0.10)
      const totalWeight = Math.min(
        0.10,
        memberSignals.reduce((sum, s) => sum + s.priorityWeight, 0)
      );

      // Convert to 0-10 point bonus on composite score
      const bonus = totalWeight * 100; // 0.10 = 10 points

      return {
        ...member,
        compositeScore: member.compositeScore + bonus,
        constraints: {
          ...member.constraints,
          reasons: [...member.constraints.reasons, 'cultural_priority_boost'],
        },
      };
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // F. REALTIME SUBSCRIPTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to reorder request changes for a circle.
   */
  static subscribeToReorderRequests(
    circleId: string,
    callback: (request: MidCycleReorderRequest) => void
  ) {
    const channel = supabase
      .channel(`reorder-requests-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'midcycle_reorder_requests',
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          if (payload.new) {
            callback(mapReorderRequest(payload.new));
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Load dynamic ordering configuration for a circle.
   */
  private static async loadDynamicConfig(circleId: string): Promise<DynamicOrderConfig> {
    const { data } = await supabase
      .from("payout_algorithm_config")
      .select("stability_weight, candidate_count, risk_engagement_model, cultural_priority_enabled, midcycle_reorder_enabled, midcycle_emergency_bypass")
      .eq("circle_id", circleId)
      .single();

    return {
      stabilityWeight: data ? parseFloat(data.stability_weight) || 0 : 0,
      candidateCount: data?.candidate_count || 500,
      riskEngagementModel: (data?.risk_engagement_model as RiskEngagementModel) || 'counterintuitive',
      culturalPriorityEnabled: data?.cultural_priority_enabled || false,
      midcycleReorderEnabled: data?.midcycle_reorder_enabled || false,
      midcycleEmergencyBypass: data?.midcycle_emergency_bypass ?? true,
    };
  }

  /**
   * Load default probability scores for a set of users.
   */
  private static async loadDefaultProbabilities(userIds: string[]): Promise<DefaultProbability[]> {
    if (userIds.length === 0) return [];

    const { data, error } = await supabase
      .from("default_probability_scores")
      .select("user_id, predicted_probability, risk_bucket")
      .in("user_id", userIds);

    if (error || !data) return userIds.map(id => ({
      userId: id,
      predictedProbability: 0,
      riskBucket: 'very_low',
    }));

    // Fill in missing users with 0 probability
    return userIds.map(id => {
      const found = data.find((d: any) => d.user_id === id);
      return {
        userId: id,
        predictedProbability: found ? parseFloat(found.predicted_probability) || 0 : 0,
        riskBucket: found?.risk_bucket || 'very_low',
      };
    });
  }
}
