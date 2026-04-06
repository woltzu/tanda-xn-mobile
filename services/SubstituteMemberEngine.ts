// ═══════════════════════════════════════════════════════════════════════════════
// SubstituteMemberEngine.ts — #8 Substitute Member System
// ═══════════════════════════════════════════════════════════════════════════════
//
// Maintains a verified bench of pre-vetted substitute members. When a circle
// member exits, a substitute enters their slot — the circle continues without
// disruption. Payout entitlement transfers at 80/10/10 split when applicable.
//
// Sections:
//   A — Types & Interfaces
//   B — DB → App Mappers
//   C — Substitute Pool Management (opt-in, preferences, eligibility)
//   D — Exit Request Flow (initiate, evaluate timing, calculate split)
//   E — Matching Algorithm (geographic, contribution, language, reliability)
//   F — Substitution Lifecycle (confirm, admin approve, complete)
//   G — Reliability & Pool Quality (score updates, decline tracking)
//   H — Admin & Stats
//   I — Notifications
//   J — Realtime Subscriptions
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type PoolStatus = 'active' | 'standby' | 'suspended' | 'removed';
export type ExitReasonCategory = 'financial_hardship' | 'relocation' | 'life_change' | 'other';
export type PayoutEntitlementStatus = 'not_applicable' | 'pending_transfer' | 'transferred' | 'forfeited';
export type XnScoreImpact = 'none' | 'partial' | 'full_default';
export type ExitRequestStatus = 'pending' | 'approved' | 'matching' | 'matched' | 'substituted' | 'completed' | 'cancelled' | 'expired';
export type SubstitutionStatus = 'pending_confirmation' | 'confirmed' | 'admin_pending' | 'approved' | 'declined_substitute' | 'declined_admin' | 'expired' | 'completed' | 'cancelled';

export interface SubstitutePoolEntry {
  id: string;
  memberId: string;
  status: PoolStatus;
  availabilityRadiusMiles: number;
  maxContributionAmountCents: number;
  preferredLanguages: string[];
  substituteReliabilityScore: number;
  totalSubstitutions: number;
  successfulSubstitutions: number;
  declineCount90d: number;
  lastDeclineAt: string | null;
  optedInAt: string;
  suspendedAt: string | null;
  removedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CircleExitRequest {
  id: string;
  memberId: string;
  circleId: string;
  reasonCategory: ExitReasonCategory;
  reasonDetails: string | null;
  exitDateRequested: string;
  noticeDays: number;
  cyclesCompleted: number;
  totalCycles: number;
  payoutEntitlementStatus: PayoutEntitlementStatus;
  originalPayoutAmountCents: number;
  substituteShareCents: number;
  insurancePoolShareCents: number;
  originalMemberSettlementCents: number;
  substituteMatchedId: string | null;
  xnscoreImpact: XnScoreImpact;
  xnscoreAdjustment: number;
  status: ExitRequestStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubstitutionRecord {
  id: string;
  circleId: string;
  exitRequestId: string;
  exitingMemberId: string;
  substituteMemberId: string;
  originalPayoutPosition: number;
  payoutEntitlementTransferCents: number;
  entryCycleId: string | null;
  entryCycleNumber: number;
  confirmationDeadline: string;
  confirmedAt: string | null;
  declinedAt: string | null;
  adminNotifiedAt: string | null;
  adminApprovedAt: string | null;
  adminDeclinedAt: string | null;
  autoApproved: boolean;
  status: SubstitutionStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PoolEligibilityCheck {
  eligible: boolean;
  reason?: string;
  xnScore?: number;
  completedCircles?: number;
}

export interface ExitEvaluation {
  xnscoreImpact: XnScoreImpact;
  xnscoreAdjustment: number;
  noticeDays: number;
  cyclesCompleted: number;
  totalCycles: number;
  completionPercentage: number;
  payoutAlreadyReceived: boolean;
  payoutEntitlementStatus: PayoutEntitlementStatus;
  originalPayoutAmountCents: number;
  substituteShareCents: number;
  insurancePoolShareCents: number;
  originalMemberSettlementCents: number;
}

export interface MatchCandidate {
  poolEntryId: string;
  memberId: string;
  reliabilityScore: number;
  matchScore: number;
  sameCity: boolean;
  languageMatch: boolean;
  contributionCompatible: boolean;
}

export interface SubstitutionSummary {
  record: SubstitutionRecord;
  circleName?: string;
  contributionAmount?: number;
  remainingCycles?: number;
  payoutPosition?: number;
  exitingMemberContributionHistory?: number;
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — DB → App Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapPoolEntry(row: any): SubstitutePoolEntry {
  return {
    id: row.id,
    memberId: row.member_id,
    status: row.status,
    availabilityRadiusMiles: row.availability_radius_miles,
    maxContributionAmountCents: row.max_contribution_amount_cents,
    preferredLanguages: row.preferred_languages ?? ['en'],
    substituteReliabilityScore: parseFloat(row.substitute_reliability_score),
    totalSubstitutions: row.total_substitutions,
    successfulSubstitutions: row.successful_substitutions,
    declineCount90d: row.decline_count_90d,
    lastDeclineAt: row.last_decline_at,
    optedInAt: row.opted_in_at,
    suspendedAt: row.suspended_at,
    removedAt: row.removed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExitRequest(row: any): CircleExitRequest {
  return {
    id: row.id,
    memberId: row.member_id,
    circleId: row.circle_id,
    reasonCategory: row.reason_category,
    reasonDetails: row.reason_details,
    exitDateRequested: row.exit_date_requested,
    noticeDays: row.notice_days,
    cyclesCompleted: row.cycles_completed,
    totalCycles: row.total_cycles,
    payoutEntitlementStatus: row.payout_entitlement_status,
    originalPayoutAmountCents: row.original_payout_amount_cents,
    substituteShareCents: row.substitute_share_cents,
    insurancePoolShareCents: row.insurance_pool_share_cents,
    originalMemberSettlementCents: row.original_member_settlement_cents,
    substituteMatchedId: row.substitute_matched_id,
    xnscoreImpact: row.xnscore_impact,
    xnscoreAdjustment: row.xnscore_adjustment,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubstitutionRecord(row: any): SubstitutionRecord {
  return {
    id: row.id,
    circleId: row.circle_id,
    exitRequestId: row.exit_request_id,
    exitingMemberId: row.exiting_member_id,
    substituteMemberId: row.substitute_member_id,
    originalPayoutPosition: row.original_payout_position,
    payoutEntitlementTransferCents: row.payout_entitlement_transfer_cents,
    entryCycleId: row.entry_cycle_id,
    entryCycleNumber: row.entry_cycle_number,
    confirmationDeadline: row.confirmation_deadline,
    confirmedAt: row.confirmed_at,
    declinedAt: row.declined_at,
    adminNotifiedAt: row.admin_notified_at,
    adminApprovedAt: row.admin_approved_at,
    adminDeclinedAt: row.admin_declined_at,
    autoApproved: row.auto_approved,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — Substitute Pool Management
// ─────────────────────────────────────────────────────────────────────────────

export class SubstituteMemberEngine {

  // ── C1: Check pool eligibility (XnScore ≥60 Trusted tier and ≥1 completed circle) ──

  static async checkPoolEligibility(userId: string): Promise<PoolEligibilityCheck> {
    // Get XnScore
    const { data: profile } = await supabase
      .from('profiles')
      .select('xn_score')
      .eq('id', userId)
      .single();

    const xnScore = profile?.xn_score ?? 0;

    // Count completed circles
    const { count: completedCircles } = await supabase
      .from('circle_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'inactive') // completed members are set to inactive
      .not('circle_id', 'is', null);

    const circleCount = completedCircles ?? 0;

    // Check if already in pool
    const { data: existing } = await supabase
      .from('substitute_pool')
      .select('id, status')
      .eq('member_id', userId)
      .single();

    if (existing && existing.status !== 'removed') {
      return { eligible: false, reason: 'Already in the substitute pool', xnScore, completedCircles: circleCount };
    }

    if (xnScore < 60) {
      return { eligible: false, reason: 'XnScore must be 60 or higher (Trusted tier)', xnScore, completedCircles: circleCount };
    }

    if (circleCount < 1) {
      return { eligible: false, reason: 'Must have completed at least one circle', xnScore, completedCircles: circleCount };
    }

    return { eligible: true, xnScore, completedCircles: circleCount };
  }


  // ── C2: Opt into substitute pool ──

  static async optIntoPool(
    userId: string,
    preferences: {
      status?: PoolStatus;
      availabilityRadiusMiles?: number;
      maxContributionAmountCents?: number;
      preferredLanguages?: string[];
    } = {}
  ): Promise<{ success: boolean; entry?: SubstitutePoolEntry; error?: string }> {
    const eligibility = await this.checkPoolEligibility(userId);
    if (!eligibility.eligible) {
      return { success: false, error: eligibility.reason };
    }

    const { data, error } = await supabase
      .from('substitute_pool')
      .upsert({
        member_id: userId,
        status: preferences.status ?? 'active',
        availability_radius_miles: preferences.availabilityRadiusMiles ?? 50,
        max_contribution_amount_cents: preferences.maxContributionAmountCents ?? 0,
        preferred_languages: preferences.preferredLanguages ?? ['en'],
        opted_in_at: new Date().toISOString(),
        // Reset if re-joining after removal
        decline_count_90d: 0,
        last_decline_at: null,
        suspended_at: null,
        removed_at: null,
      }, { onConflict: 'member_id' })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entry: mapPoolEntry(data) };
  }


  // ── C3: Update pool preferences ──

  static async updatePoolPreferences(
    userId: string,
    preferences: {
      status?: PoolStatus;
      availabilityRadiusMiles?: number;
      maxContributionAmountCents?: number;
      preferredLanguages?: string[];
    }
  ): Promise<{ success: boolean; entry?: SubstitutePoolEntry; error?: string }> {
    const updates: Record<string, any> = {};
    if (preferences.status !== undefined) updates.status = preferences.status;
    if (preferences.availabilityRadiusMiles !== undefined) updates.availability_radius_miles = preferences.availabilityRadiusMiles;
    if (preferences.maxContributionAmountCents !== undefined) updates.max_contribution_amount_cents = preferences.maxContributionAmountCents;
    if (preferences.preferredLanguages !== undefined) updates.preferred_languages = preferences.preferredLanguages;

    const { data, error } = await supabase
      .from('substitute_pool')
      .update(updates)
      .eq('member_id', userId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, entry: mapPoolEntry(data) };
  }


  // ── C4: Get pool entry for a member ──

  static async getPoolEntry(userId: string): Promise<SubstitutePoolEntry | null> {
    const { data } = await supabase
      .from('substitute_pool')
      .select('*')
      .eq('member_id', userId)
      .single();

    return data ? mapPoolEntry(data) : null;
  }


  // ── C5: Leave substitute pool ──

  static async leavePool(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('substitute_pool')
      .update({ status: 'removed', removed_at: new Date().toISOString() })
      .eq('member_id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION D — Exit Request Flow
  // ─────────────────────────────────────────────────────────────────────────

  // ── D1: Evaluate exit timing and implications ──

  static async evaluateExit(userId: string, circleId: string): Promise<ExitEvaluation> {
    // Get circle membership details
    const { data: membership } = await supabase
      .from('circle_members')
      .select('id, position')
      .eq('user_id', userId)
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .single();

    // Get circle cycles info
    const { data: cycles } = await supabase
      .from('circle_cycles')
      .select('id, cycle_number, status, recipient_user_id')
      .eq('circle_id', circleId)
      .order('cycle_number', { ascending: true });

    const allCycles = cycles ?? [];
    const totalCycles = allCycles.length;
    const completedCycles = allCycles.filter(c =>
      c.status === 'closed' || c.status === 'payout_pending'
    ).length;
    const completionPercentage = totalCycles > 0 ? (completedCycles / totalCycles) * 100 : 0;

    // Has member already received their payout?
    const payoutAlreadyReceived = allCycles.some(c =>
      c.recipient_user_id === userId && c.status === 'closed'
    );

    // Calculate notice days (from today to next contribution deadline)
    const currentCycle = allCycles.find(c =>
      c.status === 'collecting' || c.status === 'scheduled'
    );
    const noticeDays = 7; // Default; real calc would compare dates

    // XnScore impact evaluation
    let xnscoreImpact: XnScoreImpact = 'none';
    let xnscoreAdjustment = 0;

    if (completionPercentage >= 50 && noticeDays >= 7) {
      xnscoreImpact = 'none';
      xnscoreAdjustment = 0;
    } else if (completionPercentage >= 25) {
      xnscoreImpact = 'partial';
      xnscoreAdjustment = -5;
    } else {
      xnscoreImpact = 'partial';
      xnscoreAdjustment = -10;
    }

    // Payout entitlement — 80/10/10 split
    let payoutEntitlementStatus: PayoutEntitlementStatus = 'not_applicable';
    let originalPayoutAmountCents = 0;
    let substituteShareCents = 0;
    let insurancePoolShareCents = 0;
    let originalMemberSettlementCents = 0;

    if (!payoutAlreadyReceived) {
      // Get the expected payout amount from the member's assigned cycle
      const memberPayoutCycle = allCycles.find(c => c.recipient_user_id === userId);
      if (memberPayoutCycle) {
        const { data: cycleDetail } = await supabase
          .from('circle_cycles')
          .select('expected_amount')
          .eq('id', memberPayoutCycle.id)
          .single();

        originalPayoutAmountCents = Math.round((cycleDetail?.expected_amount ?? 0) * 100);
        substituteShareCents = Math.round(originalPayoutAmountCents * 0.80);
        insurancePoolShareCents = Math.round(originalPayoutAmountCents * 0.10);
        originalMemberSettlementCents = originalPayoutAmountCents - substituteShareCents - insurancePoolShareCents;
        payoutEntitlementStatus = 'pending_transfer';
      }
    }

    return {
      xnscoreImpact,
      xnscoreAdjustment,
      noticeDays,
      cyclesCompleted: completedCycles,
      totalCycles,
      completionPercentage,
      payoutAlreadyReceived,
      payoutEntitlementStatus,
      originalPayoutAmountCents,
      substituteShareCents,
      insurancePoolShareCents,
      originalMemberSettlementCents,
    };
  }


  // ── D2: Submit exit request ──

  static async submitExitRequest(
    userId: string,
    circleId: string,
    reasonCategory: ExitReasonCategory,
    reasonDetails?: string
  ): Promise<{ success: boolean; request?: CircleExitRequest; error?: string }> {
    // Evaluate exit implications
    const evaluation = await this.evaluateExit(userId, circleId);

    // Check for existing active exit request
    const { data: existing } = await supabase
      .from('circle_exit_requests')
      .select('id')
      .eq('member_id', userId)
      .eq('circle_id', circleId)
      .in('status', ['pending', 'approved', 'matching', 'matched'])
      .single();

    if (existing) {
      return { success: false, error: 'An active exit request already exists for this circle' };
    }

    const { data, error } = await supabase
      .from('circle_exit_requests')
      .insert({
        member_id: userId,
        circle_id: circleId,
        reason_category: reasonCategory,
        reason_details: reasonDetails ?? null,
        exit_date_requested: new Date().toISOString().split('T')[0],
        notice_days: evaluation.noticeDays,
        cycles_completed: evaluation.cyclesCompleted,
        total_cycles: evaluation.totalCycles,
        payout_entitlement_status: evaluation.payoutEntitlementStatus,
        original_payout_amount_cents: evaluation.originalPayoutAmountCents,
        substitute_share_cents: evaluation.substituteShareCents,
        insurance_pool_share_cents: evaluation.insurancePoolShareCents,
        original_member_settlement_cents: evaluation.originalMemberSettlementCents,
        xnscore_impact: evaluation.xnscoreImpact,
        xnscore_adjustment: evaluation.xnscoreAdjustment,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Notify circle admin
    await this._notifyCircleAdmin(circleId, 'exit_request', {
      exitRequestId: data.id,
      memberId: userId,
    });

    return { success: true, request: mapExitRequest(data) };
  }


  // ── D3: Approve exit request (admin or auto) ──

  static async approveExitRequest(
    exitRequestId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase
      .from('circle_exit_requests')
      .update({ status: 'matching' })
      .eq('id', exitRequestId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Auto-trigger matching
    const matches = await this.findMatches(data.circle_id, exitRequestId);
    if (matches.length > 0) {
      await this._offerToTopMatch(exitRequestId, data.circle_id, matches[0]);
    }

    return { success: true };
  }


  // ── D4: Cancel exit request ──

  static async cancelExitRequest(
    exitRequestId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('circle_exit_requests')
      .update({ status: 'cancelled' })
      .eq('id', exitRequestId)
      .eq('member_id', userId)
      .in('status', ['pending', 'approved', 'matching']);

    if (error) return { success: false, error: error.message };
    return { success: true };
  }


  // ── D5: Get exit request ──

  static async getExitRequest(exitRequestId: string): Promise<CircleExitRequest | null> {
    const { data } = await supabase
      .from('circle_exit_requests')
      .select('*')
      .eq('id', exitRequestId)
      .single();

    return data ? mapExitRequest(data) : null;
  }


  // ── D6: Get member's exit requests ──

  static async getMemberExitRequests(userId: string): Promise<CircleExitRequest[]> {
    const { data } = await supabase
      .from('circle_exit_requests')
      .select('*')
      .eq('member_id', userId)
      .order('created_at', { ascending: false });

    return (data ?? []).map(mapExitRequest);
  }


  // ── D7: Get circle's exit requests (admin view) ──

  static async getCircleExitRequests(circleId: string): Promise<CircleExitRequest[]> {
    const { data } = await supabase
      .from('circle_exit_requests')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    return (data ?? []).map(mapExitRequest);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION E — Matching Algorithm
  // ─────────────────────────────────────────────────────────────────────────

  // ── E1: Find matches for a vacancy ──

  static async findMatches(
    circleId: string,
    exitRequestId: string
  ): Promise<MatchCandidate[]> {
    // Get circle details for matching criteria
    const { data: circle } = await supabase
      .from('circles')
      .select('id, contribution_amount, city, country')
      .eq('id', circleId)
      .single();

    if (!circle) return [];

    const contributionAmountCents = Math.round((circle.contribution_amount ?? 0) * 100);

    // Get exit request for the exiting member
    const { data: exitReq } = await supabase
      .from('circle_exit_requests')
      .select('member_id')
      .eq('id', exitRequestId)
      .single();

    // Get all active/standby substitutes
    const { data: pool } = await supabase
      .from('substitute_pool')
      .select('*')
      .in('status', ['active', 'standby'])
      .order('substitute_reliability_score', { ascending: false });

    if (!pool || pool.length === 0) return [];

    // Get existing circle member IDs to exclude
    const { data: existingMembers } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('status', 'active');

    const existingMemberIds = new Set((existingMembers ?? []).map(m => m.user_id));
    if (exitReq) existingMemberIds.delete(exitReq.member_id); // exiting member excluded from filter

    // Get profiles for geographic + language matching
    const poolMemberIds = pool.map(p => p.member_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, city, country, preferred_language')
      .in('id', poolMemberIds);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Score and rank candidates
    const candidates: MatchCandidate[] = [];

    for (const entry of pool) {
      // Skip existing circle members
      if (existingMemberIds.has(entry.member_id)) continue;

      const profile = profileMap.get(entry.member_id);
      if (!profile) continue;

      let matchScore = 0;

      // Geographic proximity — same city strongly preferred
      const sameCity = !!(circle.city && profile.city &&
        circle.city.toLowerCase() === profile.city.toLowerCase());
      const sameCountry = !!(circle.country && profile.country &&
        circle.country.toLowerCase() === profile.country.toLowerCase());

      if (sameCity) matchScore += 40;
      else if (sameCountry) matchScore += 20;

      // Contribution compatibility — substitute can afford the circle amount
      const contributionCompatible = entry.max_contribution_amount_cents === 0 ||
        entry.max_contribution_amount_cents >= contributionAmountCents;
      if (contributionCompatible) matchScore += 25;
      else continue; // Hard filter: skip if can't afford

      // Language preference
      const preferredLangs: string[] = entry.preferred_languages ?? ['en'];
      const languageMatch = preferredLangs.includes(profile.preferred_language ?? 'en');
      if (languageMatch) matchScore += 15;

      // Reliability score bonus (0-20 points based on reliability)
      const reliabilityBonus = Math.round((parseFloat(entry.substitute_reliability_score) / 100) * 20);
      matchScore += reliabilityBonus;

      // Active status preferred over standby
      if (entry.status === 'active') matchScore += 5;

      candidates.push({
        poolEntryId: entry.id,
        memberId: entry.member_id,
        reliabilityScore: parseFloat(entry.substitute_reliability_score),
        matchScore,
        sameCity,
        languageMatch,
        contributionCompatible,
      });
    }

    // Sort by match score descending
    candidates.sort((a, b) => b.matchScore - a.matchScore);

    return candidates;
  }


  // ── E2: Offer vacancy to top match ──

  private static async _offerToTopMatch(
    exitRequestId: string,
    circleId: string,
    candidate: MatchCandidate
  ): Promise<{ success: boolean; record?: SubstitutionRecord; error?: string }> {
    // Get exit request details
    const { data: exitReq } = await supabase
      .from('circle_exit_requests')
      .select('*')
      .eq('id', exitRequestId)
      .single();

    if (!exitReq) return { success: false, error: 'Exit request not found' };

    // Get exiting member's position
    const { data: membership } = await supabase
      .from('circle_members')
      .select('position')
      .eq('user_id', exitReq.member_id)
      .eq('circle_id', circleId)
      .single();

    // Get current cycle
    const { data: currentCycle } = await supabase
      .from('circle_cycles')
      .select('id, cycle_number')
      .eq('circle_id', circleId)
      .in('status', ['collecting', 'scheduled'])
      .order('cycle_number', { ascending: true })
      .limit(1)
      .single();

    // Create substitution record
    const { data, error } = await supabase
      .from('substitution_records')
      .insert({
        circle_id: circleId,
        exit_request_id: exitRequestId,
        exiting_member_id: exitReq.member_id,
        substitute_member_id: candidate.memberId,
        original_payout_position: membership?.position ?? 0,
        payout_entitlement_transfer_cents: exitReq.substitute_share_cents,
        entry_cycle_id: currentCycle?.id ?? null,
        entry_cycle_number: currentCycle?.cycle_number ?? 0,
        confirmation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        status: 'pending_confirmation',
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Update exit request status
    await supabase
      .from('circle_exit_requests')
      .update({ status: 'matched', substitute_matched_id: candidate.memberId })
      .eq('id', exitRequestId);

    // Notify substitute
    await this._notifySubstitute(candidate.memberId, data.id, circleId);

    return { success: true, record: mapSubstitutionRecord(data) };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION F — Substitution Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  // ── F1: Substitute confirms acceptance (within 48h) ──

  static async confirmSubstitution(
    recordId: string,
    substituteUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .eq('substitute_member_id', substituteUserId)
      .eq('status', 'pending_confirmation')
      .single();

    if (!record) return { success: false, error: 'Record not found or already processed' };

    // Check if within 48h deadline
    if (new Date(record.confirmation_deadline) < new Date()) {
      return { success: false, error: 'Confirmation deadline has passed' };
    }

    // Update record to confirmed, move to admin pending
    const { error } = await supabase
      .from('substitution_records')
      .update({
        status: 'admin_pending',
        confirmed_at: new Date().toISOString(),
        admin_notified_at: new Date().toISOString(),
      })
      .eq('id', recordId);

    if (error) return { success: false, error: error.message };

    // Notify circle admin — 24h to approve/decline
    await this._notifyCircleAdmin(record.circle_id, 'substitution_approval', {
      substitutionRecordId: recordId,
      substituteMemberId: substituteUserId,
    });

    return { success: true };
  }


  // ── F2: Substitute declines ──

  static async declineSubstitution(
    recordId: string,
    substituteUserId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .eq('substitute_member_id', substituteUserId)
      .eq('status', 'pending_confirmation')
      .single();

    if (!record) return { success: false, error: 'Record not found or already processed' };

    // Update record
    await supabase
      .from('substitution_records')
      .update({ status: 'declined_substitute', declined_at: new Date().toISOString() })
      .eq('id', recordId);

    // Track decline for pool quality
    await this._trackDecline(substituteUserId);

    // Find next match and offer
    const matches = await this.findMatches(record.circle_id, record.exit_request_id);
    // Filter out the member who just declined
    const nextMatches = matches.filter(m => m.memberId !== substituteUserId);

    if (nextMatches.length > 0) {
      await this._offerToTopMatch(record.exit_request_id, record.circle_id, nextMatches[0]);
    } else {
      // No more matches — update exit request
      await supabase
        .from('circle_exit_requests')
        .update({ status: 'expired', payout_entitlement_status: 'forfeited' })
        .eq('id', record.exit_request_id);
    }

    return { success: true };
  }


  // ── F3: Admin approves substitution ──

  static async adminApproveSubstitution(
    recordId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .in('status', ['admin_pending', 'confirmed'])
      .single();

    if (!record) return { success: false, error: 'Record not found or already processed' };

    // Execute the substitution
    return this._executeSubstitution(record);
  }


  // ── F4: Admin declines substitution ──

  static async adminDeclineSubstitution(
    recordId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .eq('status', 'admin_pending')
      .single();

    if (!record) return { success: false, error: 'Record not found' };

    await supabase
      .from('substitution_records')
      .update({ status: 'declined_admin', admin_declined_at: new Date().toISOString() })
      .eq('id', recordId);

    // Re-enter matching with remaining candidates
    await supabase
      .from('circle_exit_requests')
      .update({ status: 'matching', substitute_matched_id: null })
      .eq('id', record.exit_request_id);

    return { success: true };
  }


  // ── F5: Auto-approve after 24h ──

  static async processAutoApprovals(): Promise<{ processed: number }> {
    // Find records awaiting admin approval past 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingRecords } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('status', 'admin_pending')
      .lt('admin_notified_at', cutoff);

    let processed = 0;
    for (const record of pendingRecords ?? []) {
      await supabase
        .from('substitution_records')
        .update({ auto_approved: true })
        .eq('id', record.id);

      const result = await this._executeSubstitution(record);
      if (result.success) processed++;
    }

    return { processed };
  }


  // ── F6: Process expired confirmation windows (48h) ──

  static async processExpiredConfirmations(): Promise<{ processed: number }> {
    const now = new Date().toISOString();

    const { data: expired } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('status', 'pending_confirmation')
      .lt('confirmation_deadline', now);

    let processed = 0;
    for (const record of expired ?? []) {
      await supabase
        .from('substitution_records')
        .update({ status: 'expired' })
        .eq('id', record.id);

      // Track as implicit decline
      await this._trackDecline(record.substitute_member_id);

      // Offer to next match
      const matches = await this.findMatches(record.circle_id, record.exit_request_id);
      const nextMatches = matches.filter(m => m.memberId !== record.substitute_member_id);

      if (nextMatches.length > 0) {
        await this._offerToTopMatch(record.exit_request_id, record.circle_id, nextMatches[0]);
      } else {
        await supabase
          .from('circle_exit_requests')
          .update({ status: 'expired', payout_entitlement_status: 'forfeited' })
          .eq('id', record.exit_request_id);
      }

      processed++;
    }

    return { processed };
  }


  // ── F7: Execute the substitution (core swap logic) ──

  private static async _executeSubstitution(
    record: any
  ): Promise<{ success: boolean; error?: string }> {
    const now = new Date().toISOString();

    // Step 1: Remove exiting member from circle
    await supabase
      .from('circle_members')
      .update({ status: 'removed' })
      .eq('user_id', record.exiting_member_id)
      .eq('circle_id', record.circle_id);

    // Step 2: Add substitute to circle at the same position
    await supabase
      .from('circle_members')
      .insert({
        circle_id: record.circle_id,
        user_id: record.substitute_member_id,
        position: record.original_payout_position,
        role: 'member',
        status: 'active',
      });

    // Step 3: Update exit request to substituted
    await supabase
      .from('circle_exit_requests')
      .update({
        status: 'substituted',
        payout_entitlement_status: record.payout_entitlement_transfer_cents > 0 ? 'transferred' : 'not_applicable',
      })
      .eq('id', record.exit_request_id);

    // Step 4: Mark substitution record as completed
    await supabase
      .from('substitution_records')
      .update({
        status: 'completed',
        admin_approved_at: record.auto_approved ? null : now,
        completed_at: now,
      })
      .eq('id', record.id);

    // Step 5: Update substitute pool stats
    await supabase
      .from('substitute_pool')
      .update({
        total_substitutions: (await this._getPoolStats(record.substitute_member_id)).total + 1,
      })
      .eq('member_id', record.substitute_member_id);

    // Step 6: Apply XnScore adjustment to exiting member if needed
    const { data: exitReq } = await supabase
      .from('circle_exit_requests')
      .select('xnscore_adjustment, member_id')
      .eq('id', record.exit_request_id)
      .single();

    if (exitReq && exitReq.xnscore_adjustment !== 0) {
      await this._applyXnScoreAdjustment(
        exitReq.member_id,
        exitReq.xnscore_adjustment,
        'circle_exit_substitute'
      );
    }

    // Step 7: Notify all circle members
    await this._notifyCircleMembers(record.circle_id, record.substitute_member_id);

    // Step 8: Complete exit request
    await supabase
      .from('circle_exit_requests')
      .update({ status: 'completed', completed_at: now })
      .eq('id', record.exit_request_id);

    return { success: true };
  }


  // ── F8: Get substitution record ──

  static async getSubstitutionRecord(recordId: string): Promise<SubstitutionRecord | null> {
    const { data } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .single();

    return data ? mapSubstitutionRecord(data) : null;
  }


  // ── F9: Get substitution summary (vacancy details for substitute) ──

  static async getSubstitutionSummary(recordId: string): Promise<SubstitutionSummary | null> {
    const { data: record } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (!record) return null;

    // Get circle details
    const { data: circle } = await supabase
      .from('circles')
      .select('name, contribution_amount')
      .eq('id', record.circle_id)
      .single();

    // Get remaining cycles
    const { count: remainingCycles } = await supabase
      .from('circle_cycles')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', record.circle_id)
      .in('status', ['scheduled', 'collecting']);

    // Get exiting member's contribution count
    const { count: contributionHistory } = await supabase
      .from('cycle_contributions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', record.exiting_member_id)
      .eq('circle_id', record.circle_id)
      .eq('status', 'completed');

    return {
      record: mapSubstitutionRecord(record),
      circleName: circle?.name,
      contributionAmount: circle?.contribution_amount,
      remainingCycles: remainingCycles ?? 0,
      payoutPosition: record.original_payout_position,
      exitingMemberContributionHistory: contributionHistory ?? 0,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION G — Reliability & Pool Quality
  // ─────────────────────────────────────────────────────────────────────────

  // ── G1: Track a decline ──

  private static async _trackDecline(memberId: string): Promise<void> {
    const { data: entry } = await supabase
      .from('substitute_pool')
      .select('decline_count_90d, last_decline_at')
      .eq('member_id', memberId)
      .single();

    if (!entry) return;

    const newCount = (entry.decline_count_90d ?? 0) + 1;

    const updates: Record<string, any> = {
      decline_count_90d: newCount,
      last_decline_at: new Date().toISOString(),
    };

    // 3 declines in 90 days → suspended
    if (newCount >= 3) {
      updates.status = 'suspended';
      updates.suspended_at = new Date().toISOString();
    }

    await supabase
      .from('substitute_pool')
      .update(updates)
      .eq('member_id', memberId);
  }


  // ── G2: Update reliability score after completed substitution ──

  static async updateReliabilityScore(
    memberId: string,
    successful: boolean
  ): Promise<void> {
    const { data: entry } = await supabase
      .from('substitute_pool')
      .select('substitute_reliability_score, total_substitutions, successful_substitutions')
      .eq('member_id', memberId)
      .single();

    if (!entry) return;

    const newSuccessful = (entry.successful_substitutions ?? 0) + (successful ? 1 : 0);
    const newTotal = (entry.total_substitutions ?? 0) + 1;
    const newScore = newTotal > 0 ? Math.round((newSuccessful / newTotal) * 10000) / 100 : 100;

    const updates: Record<string, any> = {
      successful_substitutions: newSuccessful,
      total_substitutions: newTotal,
      substitute_reliability_score: newScore,
    };

    // Failed substitution → permanent removal from pool
    if (!successful) {
      updates.status = 'removed';
      updates.removed_at = new Date().toISOString();
    }

    await supabase
      .from('substitute_pool')
      .update(updates)
      .eq('member_id', memberId);
  }


  // ── G3: Reset 90-day decline counter (run via cron) ──

  static async resetDeclineCounters(): Promise<{ reset: number }> {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('substitute_pool')
      .update({ decline_count_90d: 0 })
      .lt('last_decline_at', cutoff)
      .gt('decline_count_90d', 0)
      .select('id');

    return { reset: data?.length ?? 0 };
  }


  // ── G4: Get pool stats for a member ──

  private static async _getPoolStats(memberId: string): Promise<{ total: number; successful: number }> {
    const { data } = await supabase
      .from('substitute_pool')
      .select('total_substitutions, successful_substitutions')
      .eq('member_id', memberId)
      .single();

    return {
      total: data?.total_substitutions ?? 0,
      successful: data?.successful_substitutions ?? 0,
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION H — Admin & Stats
  // ─────────────────────────────────────────────────────────────────────────

  // ── H1: Get substitute pool overview ──

  static async getPoolOverview(): Promise<{
    totalActive: number;
    totalStandby: number;
    totalSuspended: number;
    avgReliabilityScore: number;
  }> {
    const { data } = await supabase
      .from('substitute_pool')
      .select('status, substitute_reliability_score')
      .in('status', ['active', 'standby', 'suspended']);

    const entries = data ?? [];
    const active = entries.filter(e => e.status === 'active').length;
    const standby = entries.filter(e => e.status === 'standby').length;
    const suspended = entries.filter(e => e.status === 'suspended').length;
    const activeEntries = entries.filter(e => e.status === 'active');
    const avgReliability = activeEntries.length > 0
      ? activeEntries.reduce((sum, e) => sum + parseFloat(e.substitute_reliability_score), 0) / activeEntries.length
      : 0;

    return {
      totalActive: active,
      totalStandby: standby,
      totalSuspended: suspended,
      avgReliabilityScore: Math.round(avgReliability * 100) / 100,
    };
  }


  // ── H2: Get circle substitution history ──

  static async getCircleSubstitutionHistory(circleId: string): Promise<SubstitutionRecord[]> {
    const { data } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('circle_id', circleId)
      .order('created_at', { ascending: false });

    return (data ?? []).map(mapSubstitutionRecord);
  }


  // ── H3: Get member's substitution history (as substitute) ──

  static async getSubstituteHistory(memberId: string): Promise<SubstitutionRecord[]> {
    const { data } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('substitute_member_id', memberId)
      .order('created_at', { ascending: false });

    return (data ?? []).map(mapSubstitutionRecord);
  }


  // ── H4: Get pending substitutions needing admin action ──

  static async getPendingAdminActions(circleId: string): Promise<SubstitutionRecord[]> {
    const { data } = await supabase
      .from('substitution_records')
      .select('*')
      .eq('circle_id', circleId)
      .eq('status', 'admin_pending')
      .order('admin_notified_at', { ascending: true });

    return (data ?? []).map(mapSubstitutionRecord);
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION I — Notifications
  // ─────────────────────────────────────────────────────────────────────────

  // ── I1: Notify circle admin ──

  private static async _notifyCircleAdmin(
    circleId: string,
    eventType: 'exit_request' | 'substitution_approval',
    data: Record<string, any>
  ): Promise<void> {
    // Find circle admin
    const { data: admin } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .in('role', ['admin', 'creator'])
      .limit(1)
      .single();

    if (!admin) return;

    const titles: Record<string, string> = {
      exit_request: 'A member has requested to exit your circle',
      substitution_approval: 'A substitute member is ready — your approval is needed',
    };

    const bodies: Record<string, string> = {
      exit_request: 'Review the exit request and the system will begin searching for a qualified substitute.',
      substitution_approval: 'A verified substitute has confirmed availability. You have 24 hours to approve or decline. No response will auto-approve.',
    };

    await supabase
      .from('notification_queue')
      .insert({
        member_id: admin.user_id,
        notification_type: 'circle_events',
        title: titles[eventType],
        body: bodies[eventType],
        data: { ...data, circleId, eventType },
      });
  }


  // ── I2: Notify substitute of vacancy offer ──

  private static async _notifySubstitute(
    substituteUserId: string,
    recordId: string,
    circleId: string
  ): Promise<void> {
    // Get circle name
    const { data: circle } = await supabase
      .from('circles')
      .select('name')
      .eq('id', circleId)
      .single();

    await supabase
      .from('notification_queue')
      .insert({
        member_id: substituteUserId,
        notification_type: 'circle_events',
        title: 'A circle needs a substitute — you\'re the top match',
        body: `You've been matched to a vacancy in ${circle?.name ?? 'a circle'}. You have 48 hours to review and confirm.`,
        data: { substitutionRecordId: recordId, circleId },
      });
  }


  // ── I3: Notify all circle members of completed substitution ──

  private static async _notifyCircleMembers(
    circleId: string,
    excludeSubstituteId: string
  ): Promise<void> {
    // Get all active circle members except the new substitute (they already know)
    const { data: members } = await supabase
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('status', 'active')
      .neq('user_id', excludeSubstituteId);

    if (!members || members.length === 0) return;

    // Batch insert notifications
    const notifications = members.map(m => ({
      member_id: m.user_id,
      notification_type: 'circle_events' as const,
      title: 'A new member has joined your circle',
      body: 'Your circle timeline is not affected.',
      data: { circleId, event: 'substitution_complete' },
    }));

    // Batch in groups of 100
    for (let i = 0; i < notifications.length; i += 100) {
      await supabase
        .from('notification_queue')
        .insert(notifications.slice(i, i + 100));
    }
  }


  // ── I4: Apply XnScore adjustment ──

  private static async _applyXnScoreAdjustment(
    userId: string,
    adjustment: number,
    reason: string
  ): Promise<void> {
    // Get current score
    const { data: profile } = await supabase
      .from('profiles')
      .select('xn_score')
      .eq('id', userId)
      .single();

    const currentScore = profile?.xn_score ?? 0;
    const newScore = Math.max(0, Math.min(1000, currentScore + adjustment));

    // Update score
    await supabase
      .from('profiles')
      .update({ xn_score: newScore })
      .eq('id', userId);

    // Record in history
    await supabase
      .from('xn_score_history')
      .insert({
        user_id: userId,
        score_before: currentScore,
        score_after: newScore,
        change: adjustment,
        reason,
        metadata: { source: 'substitute_member_system' },
      });
  }


  // ─────────────────────────────────────────────────────────────────────────
  // SECTION J — Realtime Subscriptions
  // ─────────────────────────────────────────────────────────────────────────

  // ── J1: Subscribe to pool entry changes ──

  static subscribeToPoolEntry(
    userId: string,
    callback: (entry: SubstitutePoolEntry) => void
  ) {
    return supabase
      .channel(`substitute_pool:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'substitute_pool',
          filter: `member_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) callback(mapPoolEntry(payload.new));
        }
      )
      .subscribe();
  }

  // ── J2: Subscribe to exit requests for a member ──

  static subscribeToExitRequests(
    userId: string,
    callback: (request: CircleExitRequest) => void
  ) {
    return supabase
      .channel(`exit_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_exit_requests',
          filter: `member_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) callback(mapExitRequest(payload.new));
        }
      )
      .subscribe();
  }

  // ── J3: Subscribe to substitution records (as substitute) ──

  static subscribeToSubstitutionOffers(
    userId: string,
    callback: (record: SubstitutionRecord) => void
  ) {
    return supabase
      .channel(`substitutions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'substitution_records',
          filter: `substitute_member_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) callback(mapSubstitutionRecord(payload.new));
        }
      )
      .subscribe();
  }

  // ── J4: Subscribe to circle substitutions (admin view) ──

  static subscribeToCircleSubstitutions(
    circleId: string,
    callback: (record: SubstitutionRecord) => void
  ) {
    return supabase
      .channel(`circle_substitutions:${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'substitution_records',
          filter: `circle_id=eq.${circleId}`,
        },
        (payload) => {
          if (payload.new) callback(mapSubstitutionRecord(payload.new));
        }
      )
      .subscribe();
  }
}
