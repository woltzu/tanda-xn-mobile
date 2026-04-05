// ══════════════════════════════════════════════════════════════════════════════
// HONOR SCORE ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// Static class for computing and querying honor scores.
// Three pillars: Community (30), Character (40), Expertise (30).
// Character is the HEART — vouching-centric with asymmetric risk (+5/-10).
// Tiers: Novice → Trusted → Respected → Elder → Grand Elder.
// Mirrors XnScoreEngine pattern.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type HonorScoreTier = 'Grand Elder' | 'Elder' | 'Respected' | 'Trusted' | 'Novice';

export type HonorScoreTrigger =
  | 'pipeline_recompute'
  | 'vouch_created'
  | 'vouch_defaulted'
  | 'case_resolved'
  | 'training_completed'
  | 'circle_completed'
  | 'dispute_filed_against'
  | 'initial_computation'
  | 'on_demand';

export interface HonorScore {
  id: string;
  userId: string;
  totalScore: number;
  previousScore: number | null;
  scoreTier: HonorScoreTier;

  // Pillar scores
  communityScore: number;    // max 30
  characterScore: number;    // max 40
  expertiseScore: number;    // max 30

  // Community sub-components (sum to communityScore, max 30)
  circlesParticipationScore: number;  // max 15
  communityEngagementScore: number;   // max 15

  // Character sub-components (sum to characterScore, max 40)
  vouchGivenScore: number;            // max 20
  vouchReceivedScore: number;         // max 10
  disputeInvolvementScore: number;    // max 10

  // Expertise sub-components
  expertiseTop3Avg: number;           // avg of top 3 domain scores, max 30
  expertiseDomainsActive: number;     // count of domains with score > 0

  // Audit
  inputSnapshot: Record<string, any>;
  computationTrigger: string | null;

  lastComputedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface HonorScoreHistory {
  id: string;
  userId: string;
  score: number;
  previousScore: number | null;
  scoreChange: number;
  triggerEvent: string;
  triggerId: string | null;
  triggerDetails: string | null;
  pillarBreakdown: {
    community: number;
    character: number;
    expertise: number;
  };
  createdAt: string;
}

export interface HonorScoreTierInfo {
  tier: HonorScoreTier;
  label: string;
  color: string;
  bgColor: string;
  minScore: number;
  maxScore: number;
}

export interface HonorScorePillarBreakdown {
  name: string;
  key: string;
  value: number;
  max: number;
  percentage: number;
}

export interface HonorScoreProgressInfo {
  currentTier: HonorScoreTier;
  nextTier: HonorScoreTier | null;
  pointsNeeded: number;
  progress: number;
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MAPPER                                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

function mapHonorScore(row: any): HonorScore {
  return {
    id: row.id,
    userId: row.user_id,
    totalScore: parseFloat(row.total_score) || 0,
    previousScore: row.previous_score != null ? parseFloat(row.previous_score) : null,
    scoreTier: row.score_tier || 'Novice',

    communityScore: parseFloat(row.community_score) || 0,
    characterScore: parseFloat(row.character_score) || 0,
    expertiseScore: parseFloat(row.expertise_score) || 0,

    circlesParticipationScore: parseFloat(row.circles_participation_score) || 0,
    communityEngagementScore: parseFloat(row.community_engagement_score) || 0,

    vouchGivenScore: parseFloat(row.vouch_given_score) || 0,
    vouchReceivedScore: parseFloat(row.vouch_received_score) || 0,
    disputeInvolvementScore: parseFloat(row.dispute_involvement_score) || 0,

    expertiseTop3Avg: parseFloat(row.expertise_top3_avg) || 0,
    expertiseDomainsActive: parseInt(row.expertise_domains_active) || 0,

    inputSnapshot: row.input_snapshot || {},
    computationTrigger: row.computation_trigger,

    lastComputedAt: row.last_computed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHonorScoreHistory(row: any): HonorScoreHistory {
  return {
    id: row.id,
    userId: row.user_id,
    score: parseFloat(row.score) || 0,
    previousScore: row.previous_score != null ? parseFloat(row.previous_score) : null,
    scoreChange: parseFloat(row.score_change) || 0,
    triggerEvent: row.trigger_event,
    triggerId: row.trigger_id,
    triggerDetails: row.trigger_details,
    pillarBreakdown: row.pillar_breakdown || {},
    createdAt: row.created_at,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ENGINE                                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

export class HonorScoreEngine {

  // ── Core Score Methods ─────────────────────────────────────────────────────

  /**
   * Get a user's current honor score.
   */
  static async getHonorScore(userId?: string): Promise<HonorScore | null> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase
      .from('honor_scores')
      .select('*')
      .eq('user_id', targetId)
      .maybeSingle();

    if (error || !data) return null;
    return mapHonorScore(data);
  }

  /**
   * Get honor score history for a user.
   */
  static async getScoreHistory(
    userId?: string,
    limit: number = 50
  ): Promise<HonorScoreHistory[]> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('honor_score_history')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(mapHonorScoreHistory);
  }

  /**
   * Trigger recomputation of a user's honor score via SQL function.
   */
  static async computeHonorScore(userId?: string): Promise<number | null> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase.rpc('compute_honor_score', {
      p_user_id: targetId,
    });

    if (error) {
      console.error('compute_honor_score failed:', error.message);
      return null;
    }

    return parseFloat(data) || 0;
  }


  // ── Tier Helpers (pure functions) ──────────────────────────────────────────

  /**
   * Get tier from score value.
   * Grand Elder (90-100), Elder (75-89), Respected (50-74), Trusted (25-49), Novice (0-24)
   */
  static getTierFromScore(score: number): HonorScoreTier {
    if (score >= 90) return 'Grand Elder';
    if (score >= 75) return 'Elder';
    if (score >= 50) return 'Respected';
    if (score >= 25) return 'Trusted';
    return 'Novice';
  }

  /**
   * Get display info for a tier.
   */
  static getTierInfo(tier: HonorScoreTier): HonorScoreTierInfo {
    const tiers: Record<HonorScoreTier, HonorScoreTierInfo> = {
      'Grand Elder': { tier: 'Grand Elder', label: 'Grand Elder', color: '#7C3AED', bgColor: '#EDE9FE', minScore: 90, maxScore: 100 },
      'Elder': { tier: 'Elder', label: 'Elder', color: '#00C6AE', bgColor: '#E6FAF7', minScore: 75, maxScore: 89 },
      'Respected': { tier: 'Respected', label: 'Respected', color: '#D97706', bgColor: '#FEF3C7', minScore: 50, maxScore: 74 },
      'Trusted': { tier: 'Trusted', label: 'Trusted', color: '#6B7280', bgColor: '#F3F4F6', minScore: 25, maxScore: 49 },
      'Novice': { tier: 'Novice', label: 'Novice', color: '#92400E', bgColor: '#FDE68A', minScore: 0, maxScore: 24 },
    };
    return tiers[tier] || tiers.Novice;
  }

  /**
   * Get progress toward the next tier.
   */
  static getProgressToNextTier(score: number): HonorScoreProgressInfo {
    const currentTier = HonorScoreEngine.getTierFromScore(score);

    const tierThresholds: { tier: HonorScoreTier; min: number }[] = [
      { tier: 'Novice', min: 0 },
      { tier: 'Trusted', min: 25 },
      { tier: 'Respected', min: 50 },
      { tier: 'Elder', min: 75 },
      { tier: 'Grand Elder', min: 90 },
    ];

    const currentIndex = tierThresholds.findIndex(t => t.tier === currentTier);
    const nextTierData = tierThresholds[currentIndex + 1];

    if (!nextTierData) {
      return {
        currentTier,
        nextTier: null,
        pointsNeeded: 0,
        progress: 100,
      };
    }

    const pointsNeeded = Math.max(0, nextTierData.min - score);
    const currentMin = tierThresholds[currentIndex].min;
    const range = nextTierData.min - currentMin;
    const progress = range > 0 ? Math.round(((score - currentMin) / range) * 100) : 0;

    return {
      currentTier,
      nextTier: nextTierData.tier,
      pointsNeeded: Math.round(pointsNeeded * 100) / 100,
      progress: Math.min(100, Math.max(0, progress)),
    };
  }

  /**
   * Get pillar breakdown from a score object.
   */
  static getPillarBreakdown(score: HonorScore): HonorScorePillarBreakdown[] {
    return [
      {
        name: 'Community',
        key: 'community',
        value: score.communityScore,
        max: 30,
        percentage: Math.round((score.communityScore / 30) * 100),
      },
      {
        name: 'Character',
        key: 'character',
        value: score.characterScore,
        max: 40,
        percentage: Math.round((score.characterScore / 40) * 100),
      },
      {
        name: 'Expertise',
        key: 'expertise',
        value: score.expertiseScore,
        max: 30,
        percentage: Math.round((score.expertiseScore / 30) * 100),
      },
    ];
  }


  // ── Realtime ───────────────────────────────────────────────────────────────

  /**
   * Subscribe to realtime changes on a user's honor score.
   */
  static subscribeToHonorScore(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`honor_score_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'honor_scores',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }
}

export default HonorScoreEngine;
