// ══════════════════════════════════════════════════════════════════════════════
// GRADUATED ENTRY ENGINE
// ══════════════════════════════════════════════════════════════════════════════
// New members progress through defined tiers based on demonstrated behavior.
// Maps XnScore tiers → user-facing names + numeric access limits.
// Sits on top of XnScoreEngine (does NOT replace it).
//
// XnScore Tier → Entry Tier Mapping:
//   critical → Critical (0-24)     | Cannot join circles
//   poor     → Newcomer (25-44)    | 5 members, $100/mo, middle only
//   fair     → Established (45-59) | 10 members, $500/mo, any position
//   good     → Trusted (60-74)     | 20 members, $2,000/mo, any + admin
//   excellent→ Elder (75-89)       | Unlimited, governance
//   elite    → Elite (90-100)      | Unlimited, lowest fees
//
// Follows HonorScoreEngine.ts pattern: static class, mapper functions.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { XnScoreTier } from './XnScoreEngine';


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ TYPES                                                                       │
// └─────────────────────────────────────────────────────────────────────────────┘

export type EntryTierKey = 'critical' | 'newcomer' | 'established' | 'trusted' | 'elder' | 'elite';

export type TierChangeType = 'initial' | 'advancement' | 'demotion' | 'fast_track' | 'manual';

export type FastTrackStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export type PositionAccess = 'none' | 'middle_only' | 'any';

export interface TierDefinition {
  tierKey: EntryTierKey;
  tierNumber: number;
  label: string;
  xnScoreMin: number;
  xnScoreMax: number;
  maxCircleSize: number | null;
  maxContributionCents: number | null;
  positionAccess: PositionAccess;
  minAccountAgeDays: number;
  featuresSummary: string | null;
  fastTrackEligible: boolean;
  fastTrackMinDays: number | null;
  icon: string;
  color: string;
  description: string | null;
}

export interface MemberTierStatus {
  id: string;
  userId: string;
  currentTier: EntryTierKey;
  tierNumber: number;
  previousTier: EntryTierKey | null;
  tierAchievedAt: string;
  isFastTracked: boolean;
  fastTrackApprovedAt: string | null;
  isDemoted: boolean;
  demotionReason: string | null;
  demotionPathBack: string | null;
  maxCircleSize: number | null;
  maxContributionCents: number | null;
  positionAccess: PositionAccess;
  xnScoreAtEval: number;
  accountAgeAtEval: number;
  circlesCompletedAtEval: number;
  nextTier: EntryTierKey | null;
  progressPct: number;
  actionItems: ActionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface TierHistoryEntry {
  id: string;
  userId: string;
  fromTier: EntryTierKey | null;
  toTier: EntryTierKey;
  changeType: TierChangeType;
  reason: string | null;
  xnScore: number;
  accountAgeDays: number;
  circlesCompleted: number;
  createdAt: string;
}

export interface FastTrackApplication {
  id: string;
  userId: string;
  status: FastTrackStatus;
  trustSignals: Record<string, any>;
  plaidAccountAgeDays: number | null;
  plaidBalanceHealthy: boolean | null;
  creditScoreVerified: number | null;
  employerVerified: boolean;
  platformHistoryImported: boolean;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  originalTier1EndDate: string | null;
  acceleratedTier1EndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItem {
  type: string;
  message: string;
  current: number;
  required: number;
}

export interface TierLimits {
  maxCircleSize: number | null;
  maxContributionCents: number | null;
  positionAccess: PositionAccess;
}

export interface CircleJoinCheck {
  allowed: boolean;
  reason: string;
  limit: number | null;
}

export interface PositionRestrictions {
  canTakeFirst: boolean;
  canTakeEarly: boolean;
  middleOnly: boolean;
}

export interface TierEvalResult {
  userId: string;
  previousTier: EntryTierKey | null;
  newTier: EntryTierKey;
  tierNumber: number;
  changed: boolean;
  changeType: string;
  xnScore: number;
  accountAge: number;
  circlesCompleted: number;
  progressPct: number;
  maxCircleSize: number | null;
  maxContributionCents: number | null;
  positionAccess: string;
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ CONSTANTS                                                                   │
// └─────────────────────────────────────────────────────────────────────────────┘

/** Maps XnScore internal tier names to Graduated Entry tier keys */
const XN_TIER_TO_ENTRY_TIER: Record<XnScoreTier, EntryTierKey> = {
  critical: 'critical',
  poor: 'newcomer',
  fair: 'established',
  good: 'trusted',
  excellent: 'elder',
  elite: 'elite',
};

/** Static tier definitions (mirrors DB seed data for offline/instant access) */
const TIER_DEFINITIONS: TierDefinition[] = [
  {
    tierKey: 'critical', tierNumber: 0, label: 'Critical',
    xnScoreMin: 0, xnScoreMax: 24,
    maxCircleSize: 0, maxContributionCents: 0, positionAccess: 'none',
    minAccountAgeDays: 0,
    featuresSummary: 'Observe only — cannot join or create circles',
    fastTrackEligible: false, fastTrackMinDays: null,
    icon: '🚫', color: '#991B1B',
    description: 'Account restricted. Build your XnScore through verification and engagement.',
  },
  {
    tierKey: 'newcomer', tierNumber: 1, label: 'Newcomer',
    xnScoreMin: 25, xnScoreMax: 44,
    maxCircleSize: 5, maxContributionCents: 10000, positionAccess: 'middle_only',
    minAccountAgeDays: 0,
    featuresSummary: 'Basic circles, savings goals, financial coaching',
    fastTrackEligible: true, fastTrackMinDays: 45,
    icon: '🌱', color: '#EF4444',
    description: 'First 90 days. Small circles, limited contributions.',
  },
  {
    tierKey: 'established', tierNumber: 2, label: 'Established',
    xnScoreMin: 45, xnScoreMax: 59,
    maxCircleSize: 10, maxContributionCents: 50000, positionAccess: 'any',
    minAccountAgeDays: 90,
    featuresSummary: 'Liquidity advance, referral program, marketplace basic',
    fastTrackEligible: false, fastTrackMinDays: null,
    icon: '⚡', color: '#F59E0B',
    description: '90+ days with clean history. Standard access, higher limits.',
  },
  {
    tierKey: 'trusted', tierNumber: 3, label: 'Trusted',
    xnScoreMin: 60, xnScoreMax: 74,
    maxCircleSize: 20, maxContributionCents: 200000, positionAccess: 'any',
    minAccountAgeDays: 365,
    featuresSummary: 'Full marketplace, circle admin, matching pool',
    fastTrackEligible: false, fastTrackMinDays: null,
    icon: '✓', color: '#10B981',
    description: '12+ months, multiple completed circles. Full access.',
  },
  {
    tierKey: 'elder', tierNumber: 4, label: 'Elder',
    xnScoreMin: 75, xnScoreMax: 89,
    maxCircleSize: null, maxContributionCents: null, positionAccess: 'any',
    minAccountAgeDays: 730,
    featuresSummary: 'All features, governance privileges, reduced fees',
    fastTrackEligible: false, fastTrackMinDays: null,
    icon: '🏆', color: '#8B5CF6',
    description: '24+ months, exemplary history. Elder governance rights.',
  },
  {
    tierKey: 'elite', tierNumber: 5, label: 'Elite',
    xnScoreMin: 90, xnScoreMax: 100,
    maxCircleSize: null, maxContributionCents: null, positionAccess: 'any',
    minAccountAgeDays: 730,
    featuresSummary: 'All features, lowest fees, maximum trust',
    fastTrackEligible: false, fastTrackMinDays: null,
    icon: '⭐', color: '#FFD700',
    description: 'Reserved for long-term exemplary members.',
  },
];


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ MAPPERS                                                                     │
// └─────────────────────────────────────────────────────────────────────────────┘

function mapTierDefinition(row: any): TierDefinition {
  return {
    tierKey: row.tier_key,
    tierNumber: parseInt(row.tier_number) || 0,
    label: row.label,
    xnScoreMin: parseInt(row.xn_score_min) || 0,
    xnScoreMax: parseInt(row.xn_score_max) || 0,
    maxCircleSize: row.max_circle_size != null ? parseInt(row.max_circle_size) : null,
    maxContributionCents: row.max_contribution_cents != null ? parseInt(row.max_contribution_cents) : null,
    positionAccess: row.position_access || 'any',
    minAccountAgeDays: parseInt(row.min_account_age_days) || 0,
    featuresSummary: row.features_summary,
    fastTrackEligible: row.fast_track_eligible || false,
    fastTrackMinDays: row.fast_track_min_days != null ? parseInt(row.fast_track_min_days) : null,
    icon: row.icon || '🔵',
    color: row.color || '#6B7280',
    description: row.description,
  };
}

function mapMemberTierStatus(row: any): MemberTierStatus {
  return {
    id: row.id,
    userId: row.user_id,
    currentTier: row.current_tier,
    tierNumber: parseInt(row.tier_number) || 0,
    previousTier: row.previous_tier,
    tierAchievedAt: row.tier_achieved_at,
    isFastTracked: row.is_fast_tracked || false,
    fastTrackApprovedAt: row.fast_track_approved_at,
    isDemoted: row.is_demoted || false,
    demotionReason: row.demotion_reason,
    demotionPathBack: row.demotion_path_back,
    maxCircleSize: row.max_circle_size != null ? parseInt(row.max_circle_size) : null,
    maxContributionCents: row.max_contribution_cents != null ? parseInt(row.max_contribution_cents) : null,
    positionAccess: row.position_access || 'none',
    xnScoreAtEval: parseInt(row.xn_score_at_eval) || 0,
    accountAgeAtEval: parseInt(row.account_age_at_eval) || 0,
    circlesCompletedAtEval: parseInt(row.circles_completed_at_eval) || 0,
    nextTier: row.next_tier,
    progressPct: parseInt(row.progress_pct) || 0,
    actionItems: row.action_items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTierHistory(row: any): TierHistoryEntry {
  return {
    id: row.id,
    userId: row.user_id,
    fromTier: row.from_tier,
    toTier: row.to_tier,
    changeType: row.change_type,
    reason: row.reason,
    xnScore: parseInt(row.xn_score) || 0,
    accountAgeDays: parseInt(row.account_age_days) || 0,
    circlesCompleted: parseInt(row.circles_completed) || 0,
    createdAt: row.created_at,
  };
}

function mapFastTrack(row: any): FastTrackApplication {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    trustSignals: row.trust_signals || {},
    plaidAccountAgeDays: row.plaid_account_age_days != null ? parseInt(row.plaid_account_age_days) : null,
    plaidBalanceHealthy: row.plaid_balance_healthy,
    creditScoreVerified: row.credit_score_verified != null ? parseInt(row.credit_score_verified) : null,
    employerVerified: row.employer_verified || false,
    platformHistoryImported: row.platform_history_imported || false,
    reviewNotes: row.review_notes,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    originalTier1EndDate: row.original_tier1_end_date,
    acceleratedTier1EndDate: row.accelerated_tier1_end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ┌─────────────────────────────────────────────────────────────────────────────┐
// │ ENGINE                                                                      │
// └─────────────────────────────────────────────────────────────────────────────┘

export class GraduatedEntryEngine {

  // ── Tier Definitions ─────────────────────────────────────────────────────

  /**
   * Get all tier definitions from DB (or fallback to static constants).
   */
  static async getTierDefinitions(): Promise<TierDefinition[]> {
    const { data, error } = await supabase
      .from('graduated_entry_tiers')
      .select('*')
      .order('tier_number', { ascending: true });

    if (error || !data || data.length === 0) {
      return TIER_DEFINITIONS;
    }

    return data.map(mapTierDefinition);
  }

  /**
   * Get a single tier definition by key.
   */
  static getTierDefinition(tierKey: EntryTierKey): TierDefinition {
    return TIER_DEFINITIONS.find(t => t.tierKey === tierKey) || TIER_DEFINITIONS[0];
  }

  /**
   * Map an XnScore tier name to the user-facing Entry tier key.
   */
  static mapXnTierToEntryTier(xnTier: XnScoreTier): EntryTierKey {
    return XN_TIER_TO_ENTRY_TIER[xnTier] || 'critical';
  }


  // ── Member Tier Status ───────────────────────────────────────────────────

  /**
   * Get member's current tier status. Returns null if not yet evaluated.
   */
  static async getMemberTierStatus(userId?: string): Promise<MemberTierStatus | null> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase
      .from('member_tier_status')
      .select('*')
      .eq('user_id', targetId)
      .maybeSingle();

    if (error || !data) return null;
    return mapMemberTierStatus(data);
  }

  /**
   * Evaluate a user's tier (calls SQL function).
   */
  static async evaluateTier(userId?: string): Promise<TierEvalResult | null> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase.rpc('evaluate_member_tier', {
      p_user_id: targetId,
    });

    if (error) {
      console.error('evaluate_member_tier failed:', error.message);
      return null;
    }

    return {
      userId: data.user_id,
      previousTier: data.previous_tier,
      newTier: data.new_tier,
      tierNumber: data.tier_number,
      changed: data.changed,
      changeType: data.change_type,
      xnScore: data.xn_score,
      accountAge: data.account_age,
      circlesCompleted: data.circles_completed,
      progressPct: data.progress_pct,
      maxCircleSize: data.max_circle_size,
      maxContributionCents: data.max_contribution_cents,
      positionAccess: data.position_access,
    };
  }


  // ── Tier Limits ──────────────────────────────────────────────────────────

  /**
   * Get the current tier limits for a user.
   */
  static async getTierLimits(userId?: string): Promise<TierLimits> {
    const status = await GraduatedEntryEngine.getMemberTierStatus(userId);
    if (!status) {
      // Default to critical limits
      return { maxCircleSize: 0, maxContributionCents: 0, positionAccess: 'none' };
    }

    return {
      maxCircleSize: status.maxCircleSize,
      maxContributionCents: status.maxContributionCents,
      positionAccess: status.positionAccess as PositionAccess,
    };
  }

  /**
   * Check if a user can join a specific circle based on tier limits.
   */
  static async canJoinCircle(
    circleSize: number,
    contributionAmountCents: number,
    userId?: string
  ): Promise<CircleJoinCheck> {
    const limits = await GraduatedEntryEngine.getTierLimits(userId);

    // Cannot join any circle
    if (limits.maxCircleSize === 0) {
      return {
        allowed: false,
        reason: 'Your tier does not allow joining circles. Increase your XnScore to Newcomer (25+).',
        limit: 0,
      };
    }

    // Circle size check
    if (limits.maxCircleSize !== null && circleSize > limits.maxCircleSize) {
      return {
        allowed: false,
        reason: `Your tier allows circles of up to ${limits.maxCircleSize} members. This circle has ${circleSize}.`,
        limit: limits.maxCircleSize,
      };
    }

    // Contribution amount check
    if (limits.maxContributionCents !== null && contributionAmountCents > limits.maxContributionCents) {
      const maxDollars = limits.maxContributionCents / 100;
      const requestedDollars = contributionAmountCents / 100;
      return {
        allowed: false,
        reason: `Your tier allows contributions up to $${maxDollars}/month. This circle requires $${requestedDollars}.`,
        limit: limits.maxContributionCents,
      };
    }

    return { allowed: true, reason: 'Eligible', limit: null };
  }

  /**
   * Get position restrictions for a user.
   */
  static async getPositionRestrictions(userId?: string): Promise<PositionRestrictions> {
    const limits = await GraduatedEntryEngine.getTierLimits(userId);

    return {
      canTakeFirst: limits.positionAccess === 'any',
      canTakeEarly: limits.positionAccess === 'any',
      middleOnly: limits.positionAccess === 'middle_only',
    };
  }


  // ── Progress & Action Items ──────────────────────────────────────────────

  /**
   * Compute human-readable progress info from a MemberTierStatus.
   */
  static getProgressActionItems(status: MemberTierStatus): ActionItem[] {
    if (!status.nextTier) {
      return [{ type: 'max_tier', message: 'You have reached the highest tier!', current: 100, required: 100 }];
    }

    return status.actionItems || [];
  }


  // ── Tier History ─────────────────────────────────────────────────────────

  /**
   * Get tier change history for a user.
   */
  static async getMemberTierHistory(userId?: string): Promise<TierHistoryEntry[]> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return [];

    const { data, error } = await supabase
      .from('member_tier_history')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapTierHistory);
  }


  // ── Fast-Track ───────────────────────────────────────────────────────────

  /**
   * Get the current user's fast-track application.
   */
  static async getFastTrackApplication(userId?: string): Promise<FastTrackApplication | null> {
    const targetId = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!targetId) return null;

    const { data, error } = await supabase
      .from('fast_track_applications')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return mapFastTrack(data);
  }

  /**
   * Submit a fast-track application with external trust signals.
   */
  static async submitFastTrackApplication(
    signals: Record<string, any>
  ): Promise<FastTrackApplication | null> {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) return null;

    // Calculate accelerated timeline (45 days instead of 90)
    const now = new Date();
    const originalEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const acceleratedEnd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('fast_track_applications')
      .insert({
        user_id: userId,
        status: 'pending',
        trust_signals: signals,
        plaid_account_age_days: signals.plaid_account_age_days || null,
        plaid_balance_healthy: signals.plaid_balance_healthy || null,
        credit_score_verified: signals.credit_score || null,
        employer_verified: signals.employer_verified || false,
        platform_history_imported: signals.platform_history_imported || false,
        original_tier1_end_date: originalEnd.toISOString().split('T')[0],
        accelerated_tier1_end_date: acceleratedEnd.toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error || !data) return null;
    return mapFastTrack(data);
  }


  // ── Realtime ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to tier status changes for a user.
   */
  static subscribeToTierChanges(
    userId: string,
    callback: (payload: any) => void
  ) {
    return supabase
      .channel(`member_tier_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_tier_status',
          filter: `user_id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  }
}

export default GraduatedEntryEngine;
