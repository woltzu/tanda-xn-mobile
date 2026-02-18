// ══════════════════════════════════════════════════════════════════════════════
// XNSCORE ENGINE SERVICE
// ══════════════════════════════════════════════════════════════════════════════
// The First Line of Defense: Time-Gated Trust System
//
// Core Principles:
// 1. Trust is EARNED over time, not manufactured overnight
// 2. Age-based caps CANNOT be bypassed by any amount of activity
// 3. Velocity limits prevent burst gaming (+5/week max)
// 4. Fraud signals are checked at signup
// 5. Permanent penalties for defaults never decay
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPE DEFINITIONS                                                            │
// └─────────────────────────────────────────────────────────────────────────────┘

export type XnScoreTier = 'elite' | 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type VouchStatus = 'active' | 'revoked' | 'expired';
export type VoucherReliability = 'good' | 'warning' | 'poor' | 'restricted';
export type FraudReviewOutcome = 'pending' | 'cleared' | 'suspicious' | 'confirmed_fraud';

export interface XnScore {
  id: string;
  user_id: string;

  // Current score
  total_score: number;
  raw_score: number;
  previous_score?: number;

  // Tier
  score_tier: XnScoreTier;

  // Component scores
  payment_history_score: number;
  completion_score: number;
  time_reliability_score: number;
  deposit_score: number;
  diversity_social_score: number;
  engagement_score: number;

  // Initial score tracking
  initial_score: number;
  initial_score_breakdown: InitialScoreBreakdown;
  initial_calculated_at?: string;

  // Age cap tracking
  age_cap_applied: boolean;
  max_allowed_score: number;
  account_age_days: number;

  // Velocity tracking
  points_gained_this_week: number;
  week_start_date: string;
  velocity_warnings: number;

  // First circle bonus
  first_circle_bonus_applied: boolean;
  first_circle_bonus_date?: string;

  // Vouching
  voucher_reliability: VoucherReliability;
  total_vouchee_defaults: number;

  // Payment stats
  on_time_payment_pct: number;
  payment_streak: number;
  best_payment_streak: number;
  has_defaults: boolean;
  default_count: number;

  // Circle stats
  completion_rate: number;
  full_cycles_completed: number;
  circles_participated: number;
  circles_abandoned: number;

  // Diversity stats
  unique_circle_members_count: number;
  unique_elders_count: number;
  unique_communities_count: number;

  // Activity tracking
  active_months: number;
  last_activity_at?: string;
  consecutive_inactive_days: number;

  // Metadata
  last_calculated_at: string;
  next_review_date?: string;
  calculation_trigger?: string;

  // Flags
  is_repeat_offender: boolean;
  has_active_restrictions: boolean;
  manual_adjustment_applied: boolean;
  score_frozen: boolean;
  score_frozen_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface InitialScoreBreakdown {
  base: number;
  email_verified: number;
  phone_verified: number;
  id_verified: number;
  profile_complete: number;
  inviter_bonus: number;
  quick_join: number;
  bank_linked: number;
  raw_total: number;
  age_cap: number;
  capped_total: number;
}

export interface XnScoreInitialSignals {
  id: string;
  user_id: string;
  base_score: number;

  email_verified: boolean;
  email_verified_points: number;

  phone_verified: boolean;
  phone_verified_points: number;

  id_verified: boolean;
  id_verified_points: number;

  profile_complete: boolean;
  profile_complete_points: number;
  profile_completion_pct: number;

  has_inviter: boolean;
  inviter_user_id?: string;
  inviter_xnscore_at_invite?: number;
  inviter_points: number;

  joined_circle_quickly: boolean;
  joined_circle_quickly_points: number;
  hours_to_first_circle?: number;

  bank_account_linked: boolean;
  bank_account_points: number;

  plaid_connected: boolean;
  plaid_account_age_days?: number;
  plaid_balance_healthy?: boolean;
  plaid_nsf_count: number;
  plaid_points: number;

  raw_initial_score: number;
  capped_initial_score: number;
  age_cap_at_creation: number;

  calculated_at: string;
  recalculated_count: number;
  last_recalculated_at?: string;
}

export interface XnScoreHistory {
  id: string;
  user_id: string;
  score: number;
  previous_score?: number;
  score_change: number;
  trigger_event: string;
  trigger_id?: string;
  trigger_details?: string;
  factor_breakdown?: Record<string, any>;
  raw_score_before_cap?: number;
  age_cap_applied: boolean;
  age_cap_value?: number;
  weekly_points_before?: number;
  weekly_points_after?: number;
  velocity_capped: boolean;
  created_at: string;
}

export interface Vouch {
  id: string;
  voucher_user_id: string;
  vouchee_user_id: string;
  voucher_xnscore_at_vouch: number;
  vouch_sequence: number;
  raw_vouch_value: number;
  diluted_vouch_value: number;
  vouch_status: VouchStatus;
  revoked_at?: string;
  revoked_reason?: string;
  expires_at?: string;
  vouchee_has_defaulted: boolean;
  vouchee_default_date?: string;
  voucher_penalty_applied: boolean;
  voucher_penalty_amount?: number;
  vouch_reason?: string;
  relationship_type?: string;
  created_at: string;

  // Extended fields from joins
  voucher_name?: string;
  vouchee_name?: string;
  voucher_avatar?: string;
  vouchee_avatar?: string;
}

export interface FraudSignals {
  id: string;
  user_id: string;
  device_fingerprint?: string;
  shared_device_users?: string[];
  ip_cluster_id?: string;
  registration_ip?: string;
  shared_ip_users?: string[];
  phone_prefix?: string;
  is_voip_number: boolean;
  shared_phone_prefix_users?: string[];
  email_domain?: string;
  is_disposable_email: boolean;
  email_pattern_match?: string;
  fraud_risk_score: number;
  risk_factors?: string[];
  flagged_for_review: boolean;
  flagged_at?: string;
  flagged_reasons?: string[];
  reviewed_by?: string;
  reviewed_at?: string;
  review_outcome: FraudReviewOutcome;
  review_notes?: string;
  score_frozen: boolean;
  score_frozen_at?: string;
  account_restricted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CircleEligibility {
  eligible: boolean;
  reason: string;
  code: string;
  current_score: number;
  required_score: number;
  position_restrictions: {
    can_take_early_position: boolean;
    can_take_first_position: boolean;
    max_early_position: number;
  };
}

export interface VouchLimits {
  can_vouch: boolean;
  reason: string;
  active_vouches: number;
  max_vouches: number;
  remaining_vouches: number;
  vouch_power: number;
}

export interface VouchValue {
  raw_value: number;
  diluted_value: number;
  dilution_factor: number;
  voucher_score: number;
  sequence_number: number;
}

export interface VelocityCheck {
  allowed: boolean;
  allowed_increase: number;
  remaining_this_week: number;
  velocity_warning: boolean;
}

export interface ScoreAdjustmentResult {
  success: boolean;
  previous_score: number;
  new_score: number;
  actual_adjustment: number;
  velocity_capped: boolean;
  queued_amount: number;
}

export interface InitialScoreResult {
  user_id: string;
  score: number;
  raw_score: number;
  tier: XnScoreTier;
  age_cap: number;
  age_cap_applied: boolean;
  breakdown: InitialScoreBreakdown;
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  total_score: number;
  score_tier: XnScoreTier;
  full_cycles_completed: number;
  on_time_payment_pct: number;
  payment_streak: number;
  rank: number;
}

export interface TierDistribution {
  score_tier: XnScoreTier;
  user_count: number;
  avg_score: number;
  avg_account_age_days: number;
  avg_cycles_completed: number;
}

// Score adjustment types
export type ScoreAdjustmentTrigger =
  | 'initial_calculation'
  | 'contribution_on_time'
  | 'contribution_early'
  | 'contribution_late'
  | 'contribution_missed'
  | 'contribution_default'
  | 'payment_streak_10'
  | 'payment_streak_25'
  | 'payment_streak_50'
  | 'circle_completed'
  | 'first_circle_bonus'
  | 'circle_abandoned'
  | 'removed_from_circle'
  | 'vouch_received'
  | 'vouch_given'
  | 'vouchee_defaulted'
  | 'savings_goal_reached'
  | 'bank_account_linked'
  | 'deposit_added'
  | 'deposit_withdrawn_early'
  | 'tenure_month'
  | 'inactivity_30d'
  | 'inactivity_60d'
  | 'inactivity_90d'
  | 'dispute_resolved_against'
  | 'manual_adjustment'
  | 'age_cap_increase'
  | 'queued_increase';

// Score adjustment values
export const SCORE_ADJUSTMENTS: Record<string, number> = {
  // Positive (subject to velocity cap)
  contribution_on_time: 1,
  contribution_early: 1.5,
  payment_streak_10: 2,
  payment_streak_25: 3,
  payment_streak_50: 5,
  circle_completed: 5,
  first_circle_bonus: 5,
  vouch_received_first: 1,
  vouch_given: 0.5,
  savings_goal_reached: 2,
  bank_account_linked: 1,
  deposit_added: 2,
  tenure_month: 1,

  // Negative (immediate, no velocity cap)
  contribution_late: -2,
  contribution_late_repeat: -3,
  contribution_missed: -5,
  contribution_default: -15,
  circle_abandoned: -10,
  removed_from_circle: -8,
  vouchee_defaulted: -5,
  dispute_resolved_against: -10,
  deposit_withdrawn_early: -3,
  inactivity_30d: -3,
  inactivity_60d: -6,
  inactivity_90d: -10,

  // Permanent penalties
  default_permanent_penalty: -5,
  fraud_confirmed: -100
};

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ XNSCORE ENGINE CLASS                                                        │
// └─────────────────────────────────────────────────────────────────────────────┘

export class XnScoreEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // INITIAL SCORE CALCULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate initial XnScore for a new user
   */
  static async calculateInitialScore(userId?: string): Promise<InitialScoreResult> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await supabase.rpc('calculate_initial_xnscore', {
      p_user_id: targetUserId
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Failed to calculate initial score');

    return data[0];
  }

  /**
   * Get initial score signals for a user
   */
  static async getInitialSignals(userId?: string): Promise<XnScoreInitialSignals | null> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return null;

    const { data, error } = await supabase
      .from('xnscore_initial_signals')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get user's XnScore
   */
  static async getXnScore(userId?: string): Promise<XnScore | null> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return null;

    const { data, error } = await supabase
      .from('xn_scores')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get XnScore with detailed user info
   */
  static async getXnScoreDetails(userId?: string): Promise<any | null> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return null;

    const { data, error } = await supabase
      .from('v_user_xnscore_details')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  /**
   * Get XnScore history
   */
  static async getScoreHistory(
    userId?: string,
    limit: number = 50
  ): Promise<XnScoreHistory[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('xnscore_history')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get leaderboard
   */
  static async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('v_xnscore_leaderboard')
      .select('*')
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get tier distribution statistics
   */
  static async getTierDistribution(): Promise<TierDistribution[]> {
    const { data, error } = await supabase
      .from('v_xnscore_tier_distribution')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE ADJUSTMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply a score adjustment
   */
  static async applyAdjustment(
    adjustment: number,
    trigger: ScoreAdjustmentTrigger,
    triggerId?: string,
    userId?: string
  ): Promise<ScoreAdjustmentResult> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await supabase.rpc('apply_xnscore_adjustment', {
      p_user_id: targetUserId,
      p_adjustment: adjustment,
      p_trigger_event: trigger,
      p_trigger_id: triggerId || null
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Failed to apply adjustment');

    return data[0];
  }

  /**
   * Apply a predefined adjustment type
   */
  static async applyPredefinedAdjustment(
    type: keyof typeof SCORE_ADJUSTMENTS,
    triggerId?: string,
    userId?: string
  ): Promise<ScoreAdjustmentResult> {
    const adjustment = SCORE_ADJUSTMENTS[type];
    if (adjustment === undefined) {
      throw new Error(`Unknown adjustment type: ${type}`);
    }

    return this.applyAdjustment(adjustment, type as ScoreAdjustmentTrigger, triggerId, userId);
  }

  /**
   * Check velocity cap
   */
  static async checkVelocityCap(
    requestedIncrease: number,
    userId?: string
  ): Promise<VelocityCheck> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await supabase.rpc('check_velocity_cap', {
      p_user_id: targetUserId,
      p_requested_increase: requestedIncrease
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return { allowed: true, allowed_increase: requestedIncrease, remaining_this_week: 5, velocity_warning: false };
    }

    return data[0];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CIRCLE ELIGIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Check if user is eligible to join a circle
   */
  static async checkCircleEligibility(
    circleId: string,
    userId?: string
  ): Promise<CircleEligibility> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await supabase.rpc('check_circle_eligibility', {
      p_user_id: targetUserId,
      p_circle_id: circleId
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        eligible: false,
        reason: 'Unable to check eligibility',
        code: 'UNKNOWN_ERROR',
        current_score: 0,
        required_score: 0,
        position_restrictions: {
          can_take_early_position: false,
          can_take_first_position: false,
          max_early_position: 999
        }
      };
    }

    return data[0];
  }

  /**
   * Get minimum score required for a contribution amount
   */
  static getMinScoreForAmount(contributionAmount: number): number {
    if (contributionAmount >= 1000) return 75;
    if (contributionAmount >= 500) return 60;
    if (contributionAmount >= 200) return 45;
    return 25;
  }

  /**
   * Get minimum account age for a contribution amount
   */
  static getMinAccountAgeForAmount(contributionAmount: number): number {
    if (contributionAmount >= 1000) return 180;
    if (contributionAmount >= 500) return 90;
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VOUCHING SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get vouch limits for current user
   */
  static async getVouchLimits(userId?: string): Promise<VouchLimits> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) throw new Error('User ID required');

    const { data, error } = await supabase.rpc('get_vouch_limits', {
      p_user_id: targetUserId
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        can_vouch: false,
        reason: 'Unable to get vouch limits',
        active_vouches: 0,
        max_vouches: 0,
        remaining_vouches: 0,
        vouch_power: 0
      };
    }

    return data[0];
  }

  /**
   * Calculate vouch value for a potential vouch
   */
  static async calculateVouchValue(
    voucheeId: string,
    voucherId?: string
  ): Promise<VouchValue> {
    const targetVoucherId = voucherId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetVoucherId) throw new Error('Voucher ID required');

    const { data, error } = await supabase.rpc('calculate_vouch_value', {
      p_voucher_id: targetVoucherId,
      p_vouchee_id: voucheeId
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return { raw_value: 0, diluted_value: 0, dilution_factor: 1, voucher_score: 0, sequence_number: 0 };
    }

    return data[0];
  }

  /**
   * Create a vouch for another user
   */
  static async createVouch(
    voucheeId: string,
    reason?: string,
    relationshipType?: string
  ): Promise<string> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await supabase.rpc('create_vouch', {
      p_voucher_id: userId,
      p_vouchee_id: voucheeId,
      p_reason: reason || null,
      p_relationship: relationshipType || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get vouches received by user
   */
  static async getVouchesReceived(userId?: string): Promise<Vouch[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('vouches')
      .select(`
        *,
        voucher:voucher_user_id(full_name, avatar_url)
      `)
      .eq('vouchee_user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(v => ({
      ...v,
      voucher_name: (v.voucher as any)?.full_name,
      voucher_avatar: (v.voucher as any)?.avatar_url
    }));
  }

  /**
   * Get vouches given by user
   */
  static async getVouchesGiven(userId?: string): Promise<Vouch[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('vouches')
      .select(`
        *,
        vouchee:vouchee_user_id(full_name, avatar_url)
      `)
      .eq('voucher_user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(v => ({
      ...v,
      vouchee_name: (v.vouchee as any)?.full_name,
      vouchee_avatar: (v.vouchee as any)?.avatar_url
    }));
  }

  /**
   * Revoke a vouch
   */
  static async revokeVouch(vouchId: string, reason?: string): Promise<boolean> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('vouches')
      .update({
        vouch_status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_reason: reason
      })
      .eq('id', vouchId)
      .eq('voucher_user_id', userId);

    if (error) throw error;
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGE CAP UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get age-based score cap
   */
  static getAgeBasedCap(accountAgeDays: number): number {
    if (accountAgeDays < 30) return 40;   // Probation
    if (accountAgeDays < 90) return 55;   // Building trust
    if (accountAgeDays < 180) return 70;  // Established
    if (accountAgeDays < 365) return 85;  // Trusted
    if (accountAgeDays < 548) return 90;  // Veteran (18 months)
    return 100;                            // Full trust (18+ months)
  }

  /**
   * Get next cap milestone
   */
  static getNextCapMilestone(accountAgeDays: number): { days: number; cap: number } | null {
    if (accountAgeDays < 30) return { days: 30, cap: 55 };
    if (accountAgeDays < 90) return { days: 90, cap: 70 };
    if (accountAgeDays < 180) return { days: 180, cap: 85 };
    if (accountAgeDays < 365) return { days: 365, cap: 90 };
    if (accountAgeDays < 548) return { days: 548, cap: 100 };
    return null; // Already at max
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get tier from score
   */
  static getTierFromScore(score: number): XnScoreTier {
    if (score >= 90) return 'elite';
    if (score >= 75) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 45) return 'fair';
    if (score >= 25) return 'poor';
    return 'critical';
  }

  /**
   * Get tier display info
   */
  static getTierInfo(tier: XnScoreTier): {
    name: string;
    emoji: string;
    color: string;
    minScore: number;
    maxScore: number;
    description: string;
  } {
    const tiers: Record<XnScoreTier, any> = {
      elite: {
        name: 'Elite',
        emoji: '⭐',
        color: '#FFD700',
        minScore: 90,
        maxScore: 100,
        description: 'Lowest fees, highest limits, maximum trust'
      },
      excellent: {
        name: 'Excellent',
        emoji: '🏆',
        color: '#8B5CF6',
        minScore: 75,
        maxScore: 89,
        description: 'Access to premium circles'
      },
      good: {
        name: 'Good',
        emoji: '✓',
        color: '#10B981',
        minScore: 60,
        maxScore: 74,
        description: 'Standard access to most circles'
      },
      fair: {
        name: 'Fair',
        emoji: '⚠️',
        color: '#F59E0B',
        minScore: 45,
        maxScore: 59,
        description: 'Limited circle options'
      },
      poor: {
        name: 'Poor',
        emoji: '⚡',
        color: '#EF4444',
        minScore: 25,
        maxScore: 44,
        description: 'Restricted, may require voucher'
      },
      critical: {
        name: 'Critical',
        emoji: '🚫',
        color: '#991B1B',
        minScore: 0,
        maxScore: 24,
        description: 'Cannot join circles'
      }
    };

    return tiers[tier];
  }

  /**
   * Get progress to next tier
   */
  static getProgressToNextTier(score: number): {
    currentTier: XnScoreTier;
    nextTier: XnScoreTier | null;
    pointsNeeded: number;
    progressPercent: number;
  } {
    const currentTier = this.getTierFromScore(score);
    const currentInfo = this.getTierInfo(currentTier);

    if (currentTier === 'elite') {
      return {
        currentTier,
        nextTier: null,
        pointsNeeded: 0,
        progressPercent: 100
      };
    }

    const tierOrder: XnScoreTier[] = ['critical', 'poor', 'fair', 'good', 'excellent', 'elite'];
    const currentIndex = tierOrder.indexOf(currentTier);
    const nextTier = tierOrder[currentIndex + 1];
    const nextInfo = this.getTierInfo(nextTier);

    const tierRange = nextInfo.minScore - currentInfo.minScore;
    const progressInTier = score - currentInfo.minScore;

    return {
      currentTier,
      nextTier,
      pointsNeeded: nextInfo.minScore - score,
      progressPercent: Math.round((progressInTier / tierRange) * 100)
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FRAUD SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get fraud signals for user (admin only - uses service role)
   */
  static async getFraudSignals(userId: string): Promise<FraudSignals | null> {
    const { data, error } = await supabase
      .from('xnscore_fraud_signals')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to XnScore changes
   */
  static subscribeToXnScore(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`xnscore_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xn_scores',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to vouches
   */
  static subscribeToVouches(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`vouches_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vouches',
          filter: `vouchee_user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
  // DECAY/GROWTH TYPE DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────────
  // Additional types for decay/growth system
  // ─────────────────────────────────────────────────────────────────────────────
}

export type DecayReason =
  | 'inactivity_30d'
  | 'inactivity_60d'
  | 'inactivity_90d'
  | 'inactivity_120d'
  | 'inactivity_180d'
  | 'inactivity_240d'
  | 'inactivity_365d'
  | 'manual_decay'
  | 'suspension_decay'
  | 'fraud_decay';

export type RecoveryTriggerType =
  | 'first_contribution_after_inactivity'
  | 'first_payout_received'
  | 'debt_fully_repaid'
  | 'suspension_lifted'
  | 'manual_recovery_granted';

export interface DecayHistory {
  id: string;
  user_id: string;
  decay_reason: DecayReason;
  decay_amount: number;
  score_before: number;
  score_after: number;
  days_inactive: number;
  last_financial_activity_at?: string;
  total_decay_this_period: number;
  decay_events_count: number;
  decay_details?: Record<string, any>;
  created_at: string;
}

export interface TenureHistory {
  id: string;
  user_id: string;
  tenure_month: number;
  bonus_amount: number;
  score_before: number;
  score_after: number;
  was_active_this_month: boolean;
  had_on_time_payment?: boolean;
  contribution_count_this_month: number;
  total_tenure_bonus_earned: number;
  created_at: string;
}

export interface RecoveryPeriod {
  id: string;
  user_id: string;
  trigger_type: RecoveryTriggerType;
  trigger_event_id?: string;
  started_at: string;
  ends_at: string;
  is_active: boolean;
  recovery_multiplier: number;
  score_at_start: number;
  decay_total_before_recovery: number;
  bonus_events_during_recovery: number;
  total_bonus_earned_during: number;
  ended_at?: string;
  ended_reason?: string;
  score_at_end?: number;
  created_at: string;
  updated_at: string;
}

export interface DecayAtRiskUser {
  user_id: string;
  full_name: string;
  email: string;
  total_score: number;
  score_tier: XnScoreTier;
  financial_inactive_days: number;
  last_financial_activity_at?: string;
  total_inactivity_penalty: number;
  risk_level: 'none' | 'low' | 'warning' | 'moderate' | 'high' | 'severe' | 'critical';
  days_until_next_decay?: number;
  next_decay_amount: number;
}

export interface TenureEligibleUser {
  user_id: string;
  full_name: string;
  email: string;
  total_score: number;
  tenure_bonus: number;
  tenure_months_earned: number;
  account_months: number;
  remaining_tenure_bonus: number;
  next_tenure_check_date?: string;
  contributions_this_month: number;
  active_this_month: boolean;
}

export interface RecoveryPeriodUser {
  user_id: string;
  full_name: string;
  email: string;
  total_score: number;
  in_recovery_period: boolean;
  recovery_ends_at: string;
  recovery_multiplier: number;
  trigger_type: RecoveryTriggerType;
  recovery_started: string;
  score_at_start: number;
  decay_total_before_recovery: number;
  bonus_events_during_recovery: number;
  total_bonus_earned_during: number;
  days_remaining: number;
}

export interface ActivitySummary {
  user_id: string;
  full_name: string;
  total_score: number;
  score_tier: XnScoreTier;
  last_financial_activity_at?: string;
  last_contribution_at?: string;
  last_payout_received_at?: string;
  last_wallet_deposit_at?: string;
  last_savings_activity_at?: string;
  financial_inactive_days: number;
  total_inactivity_penalty: number;
  decay_floor_reached: boolean;
  tenure_bonus: number;
  tenure_months_earned: number;
  in_recovery_period: boolean;
  recovery_ends_at?: string;
  recovery_multiplier: number;
  contributions_this_month: number;
  on_time_payments_this_month: number;
  activity_status: 'active' | 'inactive' | 'at_risk' | 'recovering' | 'frozen';
}

export interface DecayResult {
  success: boolean;
  decay_applied: number;
  previous_score: number;
  new_score: number;
  inactive_days: number;
  decay_reason: string;
}

export interface TenureBonusResult {
  success: boolean;
  bonus_applied: number;
  previous_score: number;
  new_score: number;
  tenure_month: number;
  reason: string;
}

export interface BatchProcessResult {
  users_processed: number;
  users_affected: number;
  total_amount: number;
}

// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ DECAY/GROWTH ENGINE EXTENSION                                               │
// └─────────────────────────────────────────────────────────────────────────────┘

export class XnScoreDecayEngine {
  // ═══════════════════════════════════════════════════════════════════════════
  // DECAY SCHEDULE CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════════

  static readonly DECAY_SCHEDULE: Record<number, number> = {
    30: -3,    // Warning
    60: -6,    // Moderate
    90: -10,   // Significant
    120: -15,  // Severe
    180: -20,  // Critical
    240: -25,  // Near-freeze
    365: -30   // Freeze at floor
  };

  static readonly SCORE_FLOOR = 15;
  static readonly MAX_TENURE_BONUS = 25;
  static readonly MONTHLY_TENURE_BONUS = 1;
  static readonly RECOVERY_DAYS = 90;
  static readonly RECOVERY_MULTIPLIER = 1.5;

  // ═══════════════════════════════════════════════════════════════════════════
  // DECAY QUERIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get decay history for a user
   */
  static async getDecayHistory(
    userId?: string,
    limit: number = 50
  ): Promise<DecayHistory[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('xnscore_decay_history')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get tenure history for a user
   */
  static async getTenureHistory(
    userId?: string,
    limit: number = 50
  ): Promise<TenureHistory[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    const { data, error } = await supabase
      .from('xnscore_tenure_history')
      .select('*')
      .eq('user_id', targetUserId)
      .order('tenure_month', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get recovery periods for a user
   */
  static async getRecoveryPeriods(
    userId?: string,
    activeOnly: boolean = false
  ): Promise<RecoveryPeriod[]> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return [];

    let query = supabase
      .from('xnscore_recovery_periods')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get current recovery period if active
   */
  static async getCurrentRecoveryPeriod(userId?: string): Promise<RecoveryPeriod | null> {
    const periods = await this.getRecoveryPeriods(userId, true);
    return periods.length > 0 ? periods[0] : null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECAY/GROWTH VIEWS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get users at risk of decay
   */
  static async getDecayAtRiskUsers(): Promise<DecayAtRiskUser[]> {
    const { data, error } = await supabase
      .from('v_decay_at_risk_users')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get users eligible for tenure bonus
   */
  static async getTenureEligibleUsers(): Promise<TenureEligibleUser[]> {
    const { data, error } = await supabase
      .from('v_tenure_eligible_users')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get users in recovery period
   */
  static async getRecoveryPeriodUsers(): Promise<RecoveryPeriodUser[]> {
    const { data, error } = await supabase
      .from('v_recovery_period_users')
      .select('*');

    if (error) throw error;
    return data || [];
  }

  /**
   * Get activity summary for a user
   */
  static async getActivitySummary(userId?: string): Promise<ActivitySummary | null> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return null;

    const { data, error } = await supabase
      .from('v_xnscore_activity_summary')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECAY OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply inactivity decay to a user
   */
  static async applyInactivityDecay(userId: string): Promise<DecayResult> {
    const { data, error } = await supabase.rpc('apply_inactivity_decay', {
      p_user_id: userId
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        success: false,
        decay_applied: 0,
        previous_score: 0,
        new_score: 0,
        inactive_days: 0,
        decay_reason: 'No result'
      };
    }

    return data[0];
  }

  /**
   * Process all users for inactivity decay (admin/scheduled job)
   */
  static async processAllDecays(): Promise<BatchProcessResult> {
    const { data, error } = await supabase.rpc('process_all_inactivity_decays');

    if (error) throw error;
    if (!data || data.length === 0) {
      return { users_processed: 0, users_affected: 0, total_amount: 0 };
    }

    return {
      users_processed: data[0].users_processed,
      users_affected: data[0].users_decayed,
      total_amount: data[0].total_decay_applied
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENURE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Apply tenure bonus to a user
   */
  static async applyTenureBonus(userId: string): Promise<TenureBonusResult> {
    const { data, error } = await supabase.rpc('apply_tenure_bonus', {
      p_user_id: userId
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        success: false,
        bonus_applied: 0,
        previous_score: 0,
        new_score: 0,
        tenure_month: 0,
        reason: 'No result'
      };
    }

    return data[0];
  }

  /**
   * Process all users for tenure bonus (admin/scheduled job)
   */
  static async processAllTenureBonuses(): Promise<BatchProcessResult> {
    const { data, error } = await supabase.rpc('process_all_tenure_bonuses');

    if (error) throw error;
    if (!data || data.length === 0) {
      return { users_processed: 0, users_affected: 0, total_amount: 0 };
    }

    return {
      users_processed: data[0].users_processed,
      users_affected: data[0].users_awarded,
      total_amount: data[0].total_bonus_applied
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOVERY PERIOD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a recovery period for a user
   */
  static async startRecoveryPeriod(
    userId: string,
    trigger: string,
    triggerId?: string
  ): Promise<string | null> {
    const { data, error } = await supabase.rpc('start_recovery_period', {
      p_user_id: userId,
      p_trigger: trigger,
      p_trigger_id: triggerId || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * End a recovery period for a user
   */
  static async endRecoveryPeriod(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('end_recovery_period', {
      p_user_id: userId
    });

    if (error) throw error;
    return data;
  }

  /**
   * Check if user is in recovery period
   */
  static async isInRecoveryPeriod(userId?: string): Promise<boolean> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return false;

    const { data, error } = await supabase
      .from('xn_scores')
      .select('in_recovery_period, recovery_ends_at')
      .eq('user_id', targetUserId)
      .single();

    if (error) return false;
    return data?.in_recovery_period && new Date(data.recovery_ends_at) > new Date();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITY TRACKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update financial activity for a user (triggers recovery if applicable)
   */
  static async updateFinancialActivity(
    userId: string,
    activityType: 'contribution' | 'payout' | 'wallet_deposit' | 'savings' | 'remittance',
    eventId?: string
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_financial_activity', {
      p_user_id: userId,
      p_activity_type: activityType,
      p_event_id: eventId || null
    });

    if (error) throw error;
    return data;
  }

  /**
   * Get last financial activity timestamp
   */
  static async getLastFinancialActivity(userId?: string): Promise<Date | null> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return null;

    const { data, error } = await supabase.rpc('get_last_financial_activity', {
      p_user_id: targetUserId
    });

    if (error) throw error;
    return data ? new Date(data) : null;
  }

  /**
   * Check if user is financially active within N days
   */
  static async isFinanciallyActive(userId?: string, days: number = 30): Promise<boolean> {
    const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetUserId) return false;

    const { data, error } = await supabase.rpc('is_user_financially_active', {
      p_user_id: targetUserId,
      p_days: days
    });

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULED JOBS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Run daily decay check (for scheduled job)
   */
  static async runDailyDecayCheck(): Promise<Record<string, any>> {
    const { data, error } = await supabase.rpc('process_daily_decay_check');

    if (error) throw error;
    return data;
  }

  /**
   * Run monthly tenure check (for scheduled job)
   */
  static async runMonthlyTenureCheck(): Promise<Record<string, any>> {
    const { data, error } = await supabase.rpc('process_monthly_tenure_check');

    if (error) throw error;
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DECAY UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get decay rate for given inactive days
   */
  static getDecayRate(inactiveDays: number): number {
    if (inactiveDays >= 365) return -30;
    if (inactiveDays >= 240) return -25;
    if (inactiveDays >= 180) return -20;
    if (inactiveDays >= 120) return -15;
    if (inactiveDays >= 90) return -10;
    if (inactiveDays >= 60) return -6;
    if (inactiveDays >= 30) return -3;
    return 0;
  }

  /**
   * Get total cumulative decay for given inactive days
   */
  static getTotalDecayPenalty(inactiveDays: number): number {
    let total = 0;
    if (inactiveDays >= 30) total += 3;
    if (inactiveDays >= 60) total += 6;
    if (inactiveDays >= 90) total += 10;
    if (inactiveDays >= 120) total += 15;
    if (inactiveDays >= 180) total += 20;
    if (inactiveDays >= 240) total += 25;
    if (inactiveDays >= 365) total += 30;
    return total;
  }

  /**
   * Get next decay threshold
   */
  static getNextDecayThreshold(currentInactiveDays: number): {
    days: number;
    decayAmount: number;
    daysUntil: number;
  } | null {
    const thresholds = [30, 60, 90, 120, 180, 240, 365];

    for (const threshold of thresholds) {
      if (currentInactiveDays < threshold) {
        return {
          days: threshold,
          decayAmount: this.getDecayRate(threshold),
          daysUntil: threshold - currentInactiveDays
        };
      }
    }

    return null;
  }

  /**
   * Get decay risk level
   */
  static getDecayRiskLevel(
    inactiveDays: number
  ): 'none' | 'low' | 'warning' | 'moderate' | 'high' | 'severe' | 'critical' {
    if (inactiveDays >= 240) return 'critical';
    if (inactiveDays >= 180) return 'severe';
    if (inactiveDays >= 120) return 'high';
    if (inactiveDays >= 90) return 'moderate';
    if (inactiveDays >= 60) return 'warning';
    if (inactiveDays >= 30) return 'low';
    return 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENURE UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate remaining tenure bonus
   */
  static getRemainingTenureBonus(currentTenureBonus: number): number {
    return Math.max(0, this.MAX_TENURE_BONUS - currentTenureBonus);
  }

  /**
   * Calculate months until max tenure
   */
  static getMonthsUntilMaxTenure(currentTenureMonths: number): number {
    return Math.max(0, this.MAX_TENURE_BONUS - currentTenureMonths);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECOVERY UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calculate recovery bonus with multiplier
   */
  static calculateRecoveryBonus(baseAmount: number, isInRecovery: boolean): number {
    return isInRecovery ? baseAmount * this.RECOVERY_MULTIPLIER : baseAmount;
  }

  /**
   * Get recovery period remaining days
   */
  static getRecoveryDaysRemaining(recoveryEndsAt: string | Date): number {
    const endDate = new Date(recoveryEndsAt);
    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Subscribe to decay history
   */
  static subscribeToDecayHistory(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`decay_history_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'xnscore_decay_history',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to recovery period changes
   */
  static subscribeToRecoveryPeriod(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`recovery_period_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'xnscore_recovery_periods',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe();
  }
}

export default XnScoreEngine;
