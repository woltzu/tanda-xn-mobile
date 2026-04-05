// ═══════════════════════════════════════════════════════════════════════════════
// KYCFallbackEngine.ts — #207 KYC Fallback Intelligence
// ═══════════════════════════════════════════════════════════════════════════════
//
// Risk-based interim verification while full KYC (Persona) integrates.
// Scores members on verifiable signals and assigns access tiers:
//
//   Score 0-40  → High Risk:   browse only, no transactions
//   Score 41-65 → Medium Risk: circles ≤$100, no withdrawals
//   Score 66-80 → Lower Risk:  circles ≤$300, withdrawals ≤$200, full KYC in 30d
//   Score 81-100→ Low Risk:    circles ≤$500, standard withdrawals, full KYC in 60d
//
// 7 signal types (weighted):
//   Email (15%) | Phone (20%) | Device (15%) | Referral (20%) |
//   Profile (10%) | IP Geo (10%) | Social (10%)
//
// Sections:
//   A. Types & Constants
//   B. Mappers
//   C. Score Computation (main scoring engine)
//   D. Individual Signal Evaluators
//   E. Tier Enforcement (feature gate integration)
//   F. Escalation Triggers (actions that force full KYC)
//   G. Score Recomputation (on new signal availability)
//   H. Expiration Management (deadline enforcement)
//   I. Admin Queries
//   J. Realtime
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from './supabase';


// ─────────────────────────────────────────────────────────────────────────────
// Section A — Types & Constants
// ─────────────────────────────────────────────────────────────────────────────

export type RiskTier = 'high_risk' | 'medium_risk' | 'lower_risk' | 'low_risk';

export type SignalType = 'email' | 'phone' | 'device' | 'referral' | 'profile' | 'ip_geo' | 'social';

export type PhoneCarrierType = 'mobile' | 'voip' | 'landline' | 'unknown';

export type DeviceStability = 'stable' | 'moderate' | 'unstable' | 'vpn_detected' | 'unknown';

export type EscalationTriggerType =
  | 'contribution_over_500' | 'withdrawal_over_500'
  | 'remittance_any' | 'advance_request'
  | 'tier_deadline_expired' | 'sanctions_flag'
  | 'aml_flag' | 'admin_escalation';

export interface FallbackScore {
  id: string;
  memberId: string;
  score: number;
  riskTier: RiskTier;
  emailScore: number;
  phoneScore: number;
  deviceScore: number;
  referralScore: number;
  profileScore: number;
  ipGeoScore: number;
  socialScore: number;
  signalBreakdown: Record<string, any>;
  emailVerified: boolean;
  emailDomain: string | null;
  phoneVerified: boolean;
  phoneCarrierType: PhoneCarrierType | null;
  deviceFingerprintId: string | null;
  deviceStability: DeviceStability | null;
  referralMemberId: string | null;
  referralXnScore: number | null;
  ipCountry: string | null;
  ipRegion: string | null;
  statedCountry: string | null;
  statedRegion: string | null;
  ipMatch: boolean | null;
  socialLinkedinVerified: boolean;
  profileCompletenessPct: number;
  maxContributionCents: number;
  maxWithdrawalCents: number;
  canJoinCircles: boolean;
  canWithdraw: boolean;
  canRemit: boolean;
  canRequestAdvance: boolean;
  fullKycRequiredBy: string | null;
  scoreExpiresAt: string | null;
  computedAt: string;
  recomputedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TierLimits {
  riskTier: RiskTier;
  maxContributionCents: number;
  maxWithdrawalCents: number;
  canJoinCircles: boolean;
  canWithdraw: boolean;
  canRemit: boolean;
  canRequestAdvance: boolean;
  fullKycDeadlineDays: number | null;
}

export interface SignalInput {
  emailVerified?: boolean;
  emailDomain?: string;
  phoneVerified?: boolean;
  phoneCarrierType?: PhoneCarrierType;
  deviceFingerprintId?: string;
  deviceStability?: DeviceStability;
  referralMemberId?: string;
  ipCountry?: string;
  ipRegion?: string;
  statedCountry?: string;
  statedRegion?: string;
  socialLinkedinVerified?: boolean;
  profileCompletenessPct?: number;
}

export interface GateCheckResult {
  allowed: boolean;
  reason: string | null;
  riskTier: RiskTier;
  requiredAction: 'none' | 'complete_kyc' | 'upgrade_tier' | 'contact_support';
  currentLimits: TierLimits;
}

export interface EscalationRecord {
  id: string;
  memberId: string;
  triggerType: EscalationTriggerType;
  triggerDetails: Record<string, any>;
  actionBlocked: boolean;
  memberNotified: boolean;
  triggeredAt: string;
}

// Signal weights (must sum to 1.0)
const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  email: 0.15,
  phone: 0.20,
  device: 0.15,
  referral: 0.20,
  profile: 0.10,
  ip_geo: 0.10,
  social: 0.10,
};

// Tier configuration
const TIER_CONFIG: Record<RiskTier, TierLimits> = {
  high_risk: {
    riskTier: 'high_risk',
    maxContributionCents: 0,
    maxWithdrawalCents: 0,
    canJoinCircles: false,
    canWithdraw: false,
    canRemit: false,
    canRequestAdvance: false,
    fullKycDeadlineDays: null, // No deadline — must complete KYC to do anything
  },
  medium_risk: {
    riskTier: 'medium_risk',
    maxContributionCents: 10000, // $100
    maxWithdrawalCents: 0,
    canJoinCircles: true,
    canWithdraw: false,
    canRemit: false,
    canRequestAdvance: false,
    fullKycDeadlineDays: null, // Prompted but not required
  },
  lower_risk: {
    riskTier: 'lower_risk',
    maxContributionCents: 30000, // $300
    maxWithdrawalCents: 20000,   // $200
    canJoinCircles: true,
    canWithdraw: true,
    canRemit: false,
    canRequestAdvance: false,
    fullKycDeadlineDays: 30,
  },
  low_risk: {
    riskTier: 'low_risk',
    maxContributionCents: 50000, // $500
    maxWithdrawalCents: 50000,   // $500
    canJoinCircles: true,
    canWithdraw: true,
    canRemit: false,
    canRequestAdvance: false,
    fullKycDeadlineDays: 60,
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// Section B — Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapFallbackScore(row: any): FallbackScore {
  return {
    id: row.id,
    memberId: row.member_id,
    score: row.score,
    riskTier: row.risk_tier,
    emailScore: row.email_score,
    phoneScore: row.phone_score,
    deviceScore: row.device_score,
    referralScore: row.referral_score,
    profileScore: row.profile_score,
    ipGeoScore: row.ip_geo_score,
    socialScore: row.social_score,
    signalBreakdown: row.signal_breakdown ?? {},
    emailVerified: row.email_verified,
    emailDomain: row.email_domain,
    phoneVerified: row.phone_verified,
    phoneCarrierType: row.phone_carrier_type,
    deviceFingerprintId: row.device_fingerprint_id,
    deviceStability: row.device_stability,
    referralMemberId: row.referral_member_id,
    referralXnScore: row.referral_xn_score,
    ipCountry: row.ip_country,
    ipRegion: row.ip_region,
    statedCountry: row.stated_country,
    statedRegion: row.stated_region,
    ipMatch: row.ip_match,
    socialLinkedinVerified: row.social_linkedin_verified,
    profileCompletenessPct: row.profile_completeness_pct,
    maxContributionCents: row.max_contribution_cents,
    maxWithdrawalCents: row.max_withdrawal_cents,
    canJoinCircles: row.can_join_circles,
    canWithdraw: row.can_withdraw,
    canRemit: row.can_remit,
    canRequestAdvance: row.can_request_advance,
    fullKycRequiredBy: row.full_kyc_required_by,
    scoreExpiresAt: row.score_expires_at,
    computedAt: row.computed_at,
    recomputedCount: row.recomputed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEscalation(row: any): EscalationRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    triggerType: row.trigger_type,
    triggerDetails: row.trigger_details ?? {},
    actionBlocked: row.action_blocked,
    memberNotified: row.member_notified,
    triggeredAt: row.triggered_at,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// Section C — Score Computation
// ─────────────────────────────────────────────────────────────────────────────

export class KYCFallbackEngine {

  /**
   * Compute or recompute fallback score for a member.
   * Called at registration and whenever new signals become available.
   */
  static async computeScore(memberId: string, signals: SignalInput): Promise<FallbackScore> {
    // Evaluate each signal
    const emailScore = this._evaluateEmail(signals.emailVerified, signals.emailDomain);
    const phoneScore = this._evaluatePhone(signals.phoneVerified, signals.phoneCarrierType);
    const deviceScore = this._evaluateDevice(signals.deviceFingerprintId, signals.deviceStability);
    const referralResult = await this._evaluateReferral(signals.referralMemberId);
    const profileScore = this._evaluateProfile(signals.profileCompletenessPct);
    const ipGeoScore = this._evaluateIpGeo(
      signals.ipCountry, signals.ipRegion,
      signals.statedCountry, signals.statedRegion
    );
    const socialScore = this._evaluateSocial(signals.socialLinkedinVerified);

    // Weighted aggregate
    const overallScore = Math.round(
      emailScore * SIGNAL_WEIGHTS.email +
      phoneScore * SIGNAL_WEIGHTS.phone +
      deviceScore * SIGNAL_WEIGHTS.device +
      referralResult.score * SIGNAL_WEIGHTS.referral +
      profileScore * SIGNAL_WEIGHTS.profile +
      ipGeoScore * SIGNAL_WEIGHTS.ip_geo +
      socialScore * SIGNAL_WEIGHTS.social
    );

    // Determine tier
    const riskTier = this._scoreToTier(overallScore);
    const tierConfig = TIER_CONFIG[riskTier];

    // Compute deadline
    const fullKycRequiredBy = tierConfig.fullKycDeadlineDays
      ? new Date(Date.now() + tierConfig.fullKycDeadlineDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // IP match
    const ipMatch = signals.ipCountry && signals.statedCountry
      ? signals.ipCountry.toLowerCase() === signals.statedCountry.toLowerCase()
      : null;

    const signalBreakdown = {
      email: { score: emailScore, verified: signals.emailVerified, domain: signals.emailDomain },
      phone: { score: phoneScore, verified: signals.phoneVerified, carrier: signals.phoneCarrierType },
      device: { score: deviceScore, fingerprint: !!signals.deviceFingerprintId, stability: signals.deviceStability },
      referral: { score: referralResult.score, referrerId: signals.referralMemberId, referrerXnScore: referralResult.xnScore },
      profile: { score: profileScore, completeness: signals.profileCompletenessPct },
      ip_geo: { score: ipGeoScore, match: ipMatch, ipCountry: signals.ipCountry, stated: signals.statedCountry },
      social: { score: socialScore, linkedin: signals.socialLinkedinVerified },
    };

    // Upsert fallback score
    const scoreData = {
      member_id: memberId,
      score: overallScore,
      risk_tier: riskTier,
      email_score: emailScore,
      phone_score: phoneScore,
      device_score: deviceScore,
      referral_score: referralResult.score,
      profile_score: profileScore,
      ip_geo_score: ipGeoScore,
      social_score: socialScore,
      signal_breakdown: signalBreakdown,
      email_verified: signals.emailVerified ?? false,
      email_domain: signals.emailDomain ?? null,
      phone_verified: signals.phoneVerified ?? false,
      phone_carrier_type: signals.phoneCarrierType ?? null,
      device_fingerprint_id: signals.deviceFingerprintId ?? null,
      device_stability: signals.deviceStability ?? null,
      referral_member_id: signals.referralMemberId ?? null,
      referral_xn_score: referralResult.xnScore,
      ip_country: signals.ipCountry ?? null,
      ip_region: signals.ipRegion ?? null,
      stated_country: signals.statedCountry ?? null,
      stated_region: signals.statedRegion ?? null,
      ip_match: ipMatch,
      social_linkedin_verified: signals.socialLinkedinVerified ?? false,
      profile_completeness_pct: signals.profileCompletenessPct ?? 0,
      max_contribution_cents: tierConfig.maxContributionCents,
      max_withdrawal_cents: tierConfig.maxWithdrawalCents,
      can_join_circles: tierConfig.canJoinCircles,
      can_withdraw: tierConfig.canWithdraw,
      can_remit: tierConfig.canRemit,
      can_request_advance: tierConfig.canRequestAdvance,
      full_kyc_required_by: fullKycRequiredBy,
      computed_at: new Date().toISOString(),
    };

    // Check existing
    const { data: existing } = await supabase
      .from('kyc_fallback_scores')
      .select('id, recomputed_count')
      .eq('member_id', memberId)
      .single();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from('kyc_fallback_scores')
        .update({
          ...scoreData,
          recomputed_count: (existing.recomputed_count ?? 0) + 1,
          last_signal_update: this._detectChangedSignal(signals),
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update fallback score: ${error.message}`);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('kyc_fallback_scores')
        .insert(scoreData)
        .select()
        .single();
      if (error) throw new Error(`Failed to create fallback score: ${error.message}`);
      result = data;
    }

    // Log all signal evaluations
    await this._logSignals(memberId, result.id, signalBreakdown);

    // Update kyc_verifications to reflect fallback status
    await this._syncFallbackStatus(memberId, overallScore, riskTier);

    return mapFallbackScore(result);
  }

  /**
   * Get a member's current fallback score.
   */
  static async getScore(memberId: string): Promise<FallbackScore | null> {
    const { data, error } = await supabase
      .from('kyc_fallback_scores')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch fallback score: ${error.message}`);
    }
    return data ? mapFallbackScore(data) : null;
  }

  /**
   * Get tier limits for a risk tier.
   */
  static getTierLimits(riskTier: RiskTier): TierLimits {
    return TIER_CONFIG[riskTier];
  }

  private static _scoreToTier(score: number): RiskTier {
    if (score >= 81) return 'low_risk';
    if (score >= 66) return 'lower_risk';
    if (score >= 41) return 'medium_risk';
    return 'high_risk';
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section D — Individual Signal Evaluators
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Email signal: verified + domain reputation.
   */
  private static _evaluateEmail(verified?: boolean, domain?: string): number {
    if (!verified) return 10;

    let score = 50; // Verified base

    // Domain reputation scoring
    const trustedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
    const corporateDomains = ['.edu', '.gov', '.org'];
    const suspiciousDomains = ['tempmail', 'guerrilla', 'throwaway', 'yopmail', 'mailinator'];

    if (domain) {
      const lowerDomain = domain.toLowerCase();

      if (suspiciousDomains.some(d => lowerDomain.includes(d))) {
        score = 15; // Disposable email
      } else if (corporateDomains.some(d => lowerDomain.endsWith(d))) {
        score = 90; // Institutional email
      } else if (trustedDomains.includes(lowerDomain)) {
        score = 70; // Major provider
      } else {
        score = 60; // Custom domain (could be corporate)
      }
    }

    return score;
  }

  /**
   * Phone signal: verified + carrier type.
   * VoIP numbers are significantly higher risk.
   */
  private static _evaluatePhone(verified?: boolean, carrierType?: PhoneCarrierType): number {
    if (!verified) return 5;

    switch (carrierType) {
      case 'mobile':   return 85;  // Real mobile — best signal
      case 'landline':  return 65;  // Landline — moderate (less common for apps)
      case 'voip':      return 25;  // VoIP — high risk, easy to create disposable
      case 'unknown':   return 40;  // Unknown carrier
      default:          return 50;  // Verified but no carrier info
    }
  }

  /**
   * Device signal: fingerprint consistency + VPN detection.
   */
  private static _evaluateDevice(fingerprintId?: string, stability?: DeviceStability): number {
    if (!fingerprintId) return 20; // No fingerprint — can't assess

    switch (stability) {
      case 'stable':       return 90; // Consistent device + location
      case 'moderate':     return 65; // Some variation (travel, multi-location)
      case 'unstable':     return 35; // Rotating locations (suspicious)
      case 'vpn_detected': return 20; // VPN detected (not illegal but risky)
      case 'unknown':      return 40;
      default:             return 40;
    }
  }

  /**
   * Referral signal: referred by trusted member (XnScore ≥70).
   * XnScore on 0-100 scale. ≥70 = Established tier.
   */
  private static async _evaluateReferral(
    referralMemberId?: string
  ): Promise<{ score: number; xnScore: number | null }> {
    if (!referralMemberId) return { score: 20, xnScore: null }; // No referral — baseline

    // Look up referrer's XnScore
    const { data: referrer } = await supabase
      .from('profiles')
      .select('xn_score')
      .eq('id', referralMemberId)
      .single();

    const xnScore = referrer?.xn_score ?? 0;

    // XnScore ≥70 (Established) = significant risk reduction
    if (xnScore >= 90) return { score: 95, xnScore }; // Elder referral
    if (xnScore >= 75) return { score: 85, xnScore }; // Established referral
    if (xnScore >= 70) return { score: 75, xnScore }; // Trusted+ referral
    if (xnScore >= 60) return { score: 60, xnScore }; // Trusted referral
    if (xnScore >= 40) return { score: 45, xnScore }; // Building referral
    return { score: 30, xnScore };                      // Emerging referral
  }

  /**
   * Profile completeness signal.
   */
  private static _evaluateProfile(completenessPct?: number): number {
    const pct = completenessPct ?? 0;

    if (pct >= 90) return 90;  // Full profile
    if (pct >= 70) return 70;  // Most fields
    if (pct >= 50) return 50;  // Half filled
    if (pct >= 30) return 30;  // Minimal
    return 10;                  // Almost empty
  }

  /**
   * IP geolocation vs stated location.
   */
  private static _evaluateIpGeo(
    ipCountry?: string,
    ipRegion?: string,
    statedCountry?: string,
    statedRegion?: string
  ): number {
    if (!ipCountry || !statedCountry) return 40; // Can't assess

    const countryMatch = ipCountry.toLowerCase() === statedCountry.toLowerCase();
    const regionMatch = ipRegion && statedRegion
      ? ipRegion.toLowerCase() === statedRegion.toLowerCase()
      : null;

    if (countryMatch && regionMatch) return 90;  // Exact match
    if (countryMatch) return 70;                  // Country match, different region
    return 20;                                     // Country mismatch — high risk
  }

  /**
   * Social verification signal (optional LinkedIn).
   */
  private static _evaluateSocial(linkedinVerified?: boolean): number {
    if (linkedinVerified) return 80;
    return 30; // Not provided — neutral baseline
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section E — Tier Enforcement (Feature Gate Integration)
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Check if a member can perform a specific action.
   * Called by the feature gate architecture before allowing money movement.
   */
  static async checkGate(
    memberId: string,
    action: 'join_circle' | 'contribute' | 'withdraw' | 'remit' | 'request_advance',
    amountCents?: number
  ): Promise<GateCheckResult> {
    // First check if member has full KYC
    const { data: verification } = await supabase
      .from('kyc_verifications')
      .select('status, kyc_tier')
      .eq('member_id', memberId)
      .single();

    if (verification?.status === 'approved' && verification.kyc_tier >= 2) {
      return {
        allowed: true,
        reason: null,
        riskTier: 'low_risk',
        requiredAction: 'none',
        currentLimits: TIER_CONFIG.low_risk,
      };
    }

    // Check fallback score
    const score = await this.getScore(memberId);
    if (!score) {
      return {
        allowed: false,
        reason: 'No verification on file. Please complete identity verification.',
        riskTier: 'high_risk',
        requiredAction: 'complete_kyc',
        currentLimits: TIER_CONFIG.high_risk,
      };
    }

    // Check expiration
    if (score.fullKycRequiredBy && new Date(score.fullKycRequiredBy) < new Date()) {
      // Deadline passed — downgrade to high_risk
      return {
        allowed: false,
        reason: 'Your interim verification has expired. Please complete full identity verification.',
        riskTier: 'high_risk',
        requiredAction: 'complete_kyc',
        currentLimits: TIER_CONFIG.high_risk,
      };
    }

    const limits = TIER_CONFIG[score.riskTier];

    switch (action) {
      case 'join_circle':
        if (!limits.canJoinCircles) {
          return {
            allowed: false,
            reason: 'Your current verification level does not allow joining circles. Complete identity verification to unlock this feature.',
            riskTier: score.riskTier,
            requiredAction: 'complete_kyc',
            currentLimits: limits,
          };
        }
        return { allowed: true, reason: null, riskTier: score.riskTier, requiredAction: 'none', currentLimits: limits };

      case 'contribute':
        if (!limits.canJoinCircles) {
          return {
            allowed: false,
            reason: 'Contributions require identity verification.',
            riskTier: score.riskTier,
            requiredAction: 'complete_kyc',
            currentLimits: limits,
          };
        }
        if (amountCents && amountCents > limits.maxContributionCents) {
          // Check if this triggers forced KYC escalation
          if (amountCents > 50000) {
            await this._recordEscalation(memberId, 'contribution_over_500', { amountCents });
          }
          return {
            allowed: false,
            reason: `Your current limit is $${(limits.maxContributionCents / 100).toFixed(0)} per contribution. Complete full identity verification to increase your limit.`,
            riskTier: score.riskTier,
            requiredAction: 'complete_kyc',
            currentLimits: limits,
          };
        }
        return { allowed: true, reason: null, riskTier: score.riskTier, requiredAction: 'none', currentLimits: limits };

      case 'withdraw':
        if (!limits.canWithdraw) {
          return {
            allowed: false,
            reason: 'Withdrawals require a higher verification level. Complete identity verification to unlock withdrawals.',
            riskTier: score.riskTier,
            requiredAction: 'complete_kyc',
            currentLimits: limits,
          };
        }
        if (amountCents && amountCents > limits.maxWithdrawalCents) {
          if (amountCents > 50000) {
            await this._recordEscalation(memberId, 'withdrawal_over_500', { amountCents });
          }
          return {
            allowed: false,
            reason: `Your current withdrawal limit is $${(limits.maxWithdrawalCents / 100).toFixed(0)}. Complete full identity verification to increase your limit.`,
            riskTier: score.riskTier,
            requiredAction: 'complete_kyc',
            currentLimits: limits,
          };
        }
        return { allowed: true, reason: null, riskTier: score.riskTier, requiredAction: 'none', currentLimits: limits };

      case 'remit':
        // Remittance ALWAYS requires full KYC
        await this._recordEscalation(memberId, 'remittance_any', {});
        return {
          allowed: false,
          reason: 'Remittance transactions require full identity verification.',
          riskTier: score.riskTier,
          requiredAction: 'complete_kyc',
          currentLimits: limits,
        };

      case 'request_advance':
        // Liquidity advances ALWAYS require full KYC
        await this._recordEscalation(memberId, 'advance_request', {});
        return {
          allowed: false,
          reason: 'Liquidity advances require full identity verification.',
          riskTier: score.riskTier,
          requiredAction: 'complete_kyc',
          currentLimits: limits,
        };

      default:
        return { allowed: false, reason: 'Unknown action.', riskTier: score.riskTier, requiredAction: 'complete_kyc', currentLimits: limits };
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section F — Escalation Triggers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Record an escalation trigger event.
   */
  private static async _recordEscalation(
    memberId: string,
    triggerType: EscalationTriggerType,
    details: Record<string, any>
  ): Promise<void> {
    await supabase
      .from('kyc_escalation_triggers')
      .insert({
        member_id: memberId,
        trigger_type: triggerType,
        trigger_details: details,
        action_blocked: true,
        member_notified: false,
      });
  }

  /**
   * Get escalation history for a member.
   */
  static async getEscalations(memberId: string): Promise<EscalationRecord[]> {
    const { data, error } = await supabase
      .from('kyc_escalation_triggers')
      .select('*')
      .eq('member_id', memberId)
      .order('triggered_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch escalations: ${error.message}`);
    return (data ?? []).map(mapEscalation);
  }

  /**
   * Mark escalation as member-notified.
   */
  static async markEscalationNotified(escalationId: string): Promise<void> {
    await supabase
      .from('kyc_escalation_triggers')
      .update({ member_notified: true })
      .eq('id', escalationId);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section G — Score Recomputation
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Recompute score when a new signal becomes available.
   * Gathers all existing signals + the new one and recomputes.
   */
  static async recomputeOnNewSignal(
    memberId: string,
    newSignals: Partial<SignalInput>
  ): Promise<FallbackScore> {
    // Get existing score to preserve unchanged signals
    const existing = await this.getScore(memberId);

    const mergedSignals: SignalInput = {
      emailVerified: newSignals.emailVerified ?? existing?.emailVerified ?? false,
      emailDomain: newSignals.emailDomain ?? existing?.emailDomain ?? undefined,
      phoneVerified: newSignals.phoneVerified ?? existing?.phoneVerified ?? false,
      phoneCarrierType: newSignals.phoneCarrierType ?? existing?.phoneCarrierType ?? undefined,
      deviceFingerprintId: newSignals.deviceFingerprintId ?? existing?.deviceFingerprintId ?? undefined,
      deviceStability: newSignals.deviceStability ?? existing?.deviceStability ?? undefined,
      referralMemberId: newSignals.referralMemberId ?? existing?.referralMemberId ?? undefined,
      ipCountry: newSignals.ipCountry ?? existing?.ipCountry ?? undefined,
      ipRegion: newSignals.ipRegion ?? existing?.ipRegion ?? undefined,
      statedCountry: newSignals.statedCountry ?? existing?.statedCountry ?? undefined,
      statedRegion: newSignals.statedRegion ?? existing?.statedRegion ?? undefined,
      socialLinkedinVerified: newSignals.socialLinkedinVerified ?? existing?.socialLinkedinVerified ?? false,
      profileCompletenessPct: newSignals.profileCompletenessPct ?? existing?.profileCompletenessPct ?? 0,
    };

    return this.computeScore(memberId, mergedSignals);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section H — Expiration Management
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Cron job: check for expired fallback scores and downgrade access.
   */
  static async processExpiredScores(): Promise<{ expired: number; downgraded: number }> {
    const now = new Date().toISOString();

    const { data: expired, error } = await supabase
      .from('kyc_fallback_scores')
      .select('id, member_id, risk_tier')
      .lt('full_kyc_required_by', now)
      .neq('risk_tier', 'high_risk');

    if (error) throw new Error(`Failed to fetch expired scores: ${error.message}`);
    if (!expired || expired.length === 0) return { expired: 0, downgraded: 0 };

    let downgraded = 0;
    for (const record of expired) {
      try {
        // Downgrade to high_risk — browse only
        await supabase
          .from('kyc_fallback_scores')
          .update({
            risk_tier: 'high_risk',
            max_contribution_cents: 0,
            max_withdrawal_cents: 0,
            can_join_circles: false,
            can_withdraw: false,
          })
          .eq('id', record.id);

        // Record escalation
        await this._recordEscalation(record.member_id, 'tier_deadline_expired', {
          previousTier: record.risk_tier,
        });

        downgraded++;
      } catch {
        // Continue processing others
      }
    }

    return { expired: expired.length, downgraded };
  }

  /**
   * Get members approaching their KYC deadline (for reminder notifications).
   */
  static async getMembersNearingDeadline(daysAhead: number = 7): Promise<FallbackScore[]> {
    const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('kyc_fallback_scores')
      .select('*')
      .not('full_kyc_required_by', 'is', null)
      .lt('full_kyc_required_by', futureDate)
      .gt('full_kyc_required_by', new Date().toISOString())
      .neq('risk_tier', 'high_risk');

    if (error) throw new Error(`Failed to fetch nearing deadline: ${error.message}`);
    return (data ?? []).map(mapFallbackScore);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section I — Admin Queries
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Get tier distribution across all members with fallback scores.
   */
  static async getTierDistribution(): Promise<Record<RiskTier, number>> {
    const dist: Record<RiskTier, number> = {
      high_risk: 0,
      medium_risk: 0,
      lower_risk: 0,
      low_risk: 0,
    };

    for (const tier of Object.keys(dist) as RiskTier[]) {
      const { count } = await supabase
        .from('kyc_fallback_scores')
        .select('*', { count: 'exact', head: true })
        .eq('risk_tier', tier);
      dist[tier] = count ?? 0;
    }

    return dist;
  }

  /**
   * Get members by risk tier.
   */
  static async getMembersByTier(tier: RiskTier, limit: number = 50): Promise<FallbackScore[]> {
    const { data, error } = await supabase
      .from('kyc_fallback_scores')
      .select('*')
      .eq('risk_tier', tier)
      .order('score', { ascending: true })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch members by tier: ${error.message}`);
    return (data ?? []).map(mapFallbackScore);
  }

  /**
   * Get signal logs for a member (audit trail).
   */
  static async getSignalLogs(memberId: string, limit: number = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('kyc_fallback_signal_logs')
      .select('*')
      .eq('member_id', memberId)
      .order('evaluated_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch signal logs: ${error.message}`);
    return data ?? [];
  }

  /**
   * Get all escalation triggers (admin view).
   */
  static async getAllEscalations(limit: number = 100): Promise<EscalationRecord[]> {
    const { data, error } = await supabase
      .from('kyc_escalation_triggers')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to fetch all escalations: ${error.message}`);
    return (data ?? []).map(mapEscalation);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Section J — Realtime
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Subscribe to a member's fallback score updates.
   */
  static subscribeToScore(memberId: string, callback: () => void) {
    return supabase
      .channel(`kyc_fallback_${memberId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'kyc_fallback_scores',
          filter: `member_id=eq.${memberId}`,
        },
        callback
      )
      .subscribe();
  }


  // ───────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Log all signal evaluations for audit trail.
   */
  private static async _logSignals(
    memberId: string,
    fallbackScoreId: string,
    breakdown: Record<string, any>
  ): Promise<void> {
    const logs = Object.entries(breakdown).map(([signalType, data]) => ({
      member_id: memberId,
      fallback_score_id: fallbackScoreId,
      signal_type: signalType,
      signal_score: data.score,
      signal_data: data,
    }));

    if (logs.length > 0) {
      await supabase.from('kyc_fallback_signal_logs').insert(logs);
    }
  }

  /**
   * Sync fallback status to kyc_verifications table.
   */
  private static async _syncFallbackStatus(
    memberId: string,
    score: number,
    riskTier: RiskTier
  ): Promise<void> {
    const tierConfig = TIER_CONFIG[riskTier];
    const deadlineDays = tierConfig.fullKycDeadlineDays;
    const deadline = deadlineDays
      ? new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Upsert kyc_verifications
    const { data: existing } = await supabase
      .from('kyc_verifications')
      .select('id, status')
      .eq('member_id', memberId)
      .single();

    if (existing) {
      // Only update if still in fallback/pending state (don't overwrite full KYC)
      if (['pending', 'fallback_active'].includes(existing.status)) {
        await supabase
          .from('kyc_verifications')
          .update({
            status: 'fallback_active',
            kyc_type: 'fallback',
            provider: 'fallback',
            verification_method: 'fallback_only',
            risk_level: riskTier === 'high_risk' ? 'high' :
                        riskTier === 'medium_risk' ? 'medium' :
                        riskTier === 'lower_risk' ? 'medium' : 'low',
            fallback_expires_at: deadline,
            full_kyc_deadline: deadline,
          })
          .eq('id', existing.id);
      }
    } else {
      await supabase
        .from('kyc_verifications')
        .insert({
          member_id: memberId,
          kyc_type: 'fallback',
          status: 'fallback_active',
          kyc_tier: 0,
          provider: 'fallback',
          verification_method: 'fallback_only',
          risk_level: riskTier === 'high_risk' ? 'high' :
                      riskTier === 'medium_risk' ? 'medium' : 'low',
          fallback_expires_at: deadline,
          full_kyc_deadline: deadline,
        });
    }
  }

  /**
   * Detect which signal changed (for logging).
   */
  private static _detectChangedSignal(signals: SignalInput): string {
    if (signals.emailVerified !== undefined) return 'email';
    if (signals.phoneVerified !== undefined) return 'phone';
    if (signals.deviceFingerprintId !== undefined) return 'device';
    if (signals.referralMemberId !== undefined) return 'referral';
    if (signals.profileCompletenessPct !== undefined) return 'profile';
    if (signals.ipCountry !== undefined) return 'ip_geo';
    if (signals.socialLinkedinVerified !== undefined) return 'social';
    return 'initial';
  }
}
