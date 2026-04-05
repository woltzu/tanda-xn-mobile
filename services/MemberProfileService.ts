// ══════════════════════════════════════════════════════════════════════════════
// MEMBER PROFILE SERVICE - Consolidated behavioral profile data layer
// Fetches, refreshes, and exports AI-ready member profiles from 5 aggregation
// tables: behavioral_profiles, profile_snapshots, session_analytics,
// network_metrics, and risk_indicators.
// ══════════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MemberBehavioralProfile {
  id: string;
  userId: string;

  // Payment Behavior
  totalContributions: number;
  totalContributionAmount: number;
  avgContributionAmount: number;
  onTimePct: number;
  earlyPct: number;
  latePct: number;
  missedPct: number;
  avgDaysBeforeDue: number;
  avgLateDays: number;
  longestOnTimeStreak: number;
  currentOnTimeStreak: number;
  contributionConsistency: number;
  paymentTrend: 'improving' | 'declining' | 'stable';
  lastContributionAt: string | null;

  // Circle Engagement
  circlesJoined: number;
  circlesCompleted: number;
  circlesAbandoned: number;
  circlesActive: number;
  circleCompletionRate: number;
  avgCircleDurationDays: number;
  preferredCircleAmount: number | null;
  preferredFrequency: string | null;
  roleDistribution: Record<string, number>;
  uniqueCirclePartners: number;

  // Wallet Behavior
  avgMonthlyDeposits: number;
  avgMonthlyWithdrawals: number;
  avgWalletBalance: number;
  balanceVolatility: number;
  depositFrequencyMonthly: number;
  largestSingleTransaction: number;
  walletActivityScore: number;

  // Loan History
  loansApplied: number;
  loansApproved: number;
  loansRepaid: number;
  loansDefaulted: number;
  totalBorrowed: number;
  totalRepaid: number;
  avgRepaymentDaysVsSchedule: number;
  earlyRepaymentCount: number;
  loanUtilizationRate: number;

  // Social / Trust
  vouchesGiven: number;
  vouchesReceived: number;
  vouchesSuccessful: number;
  vouchesFailed: number;
  vouchSuccessRate: number;
  elderEndorsementCount: number;
  disputesFiled: number;
  disputesReceived: number;
  disputesWon: number;
  disputesLost: number;
  referralsMade: number;
  referralsConverted: number;
  networkQualityScore: number;

  // Engagement
  accountAgeDays: number;
  lastLoginAt: string | null;
  avgSessionsPerWeek: number;
  avgSessionDurationMs: number;
  avgScreensPerSession: number;
  featureAdoptionScore: number;
  daysSinceLastActivity: number;
  activeDaysLast30: number;
  activeDaysLast90: number;
  peakUsageHour: number | null;
  primaryDevice: string | null;

  // Risk Indicators
  defaultCount: number;
  defaultTotalAmount: number;
  defaultRecoveryRate: number;
  deviceChangeCount30d: number;
  rapidWithdrawalEvents: number;
  suspiciousPatternFlags: string[];
  riskScore: number;

  // Metadata
  profileVersion: number;
  lastComputedAt: string;
  computationDurationMs: number | null;
  dataSources: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSnapshot {
  id: string;
  userId: string;
  snapshotDate: string;
  snapshotPeriod: string;

  // Point-in-time
  xnScore: number | null;
  honorScore: number | null;
  walletBalance: number | null;
  tokenBalance: number | null;
  activeCircles: number | null;
  activeLoans: number | null;
  totalOutstandingDebt: number | null;

  // Period activity
  contributionsCount: number;
  contributionsAmount: number;
  onTimePctPeriod: number | null;
  sessionsCount: number;
  screensViewed: number;
  featuresUsed: string[];
  transactionsCount: number;
  transactionsVolume: number;

  // Computed scores
  engagementScore: number | null;
  riskScore: number | null;
  profileCompletenessPct: number | null;

  createdAt: string;
}

export interface SessionAnalytics {
  id: string;
  userId: string;
  analyticsDate: string;

  // Session metrics
  sessionCount: number;
  totalDurationMs: number;
  avgSessionDurationMs: number;
  screensViewed: number;
  uniqueScreens: number;

  // Feature engagement
  mostUsedFeatures: { feature: string; count: number }[];
  authEvents: number;
  transactionEvents: number;
  circleEvents: number;
  errorsEncountered: number;

  // Device & geo
  deviceTypes: string[];
  peakHour: number | null;
  geoCities: string[];

  createdAt: string;
}

export interface NetworkMetrics {
  id: string;
  userId: string;

  // Network size
  totalConnections: number;
  familyConnections: number;
  friendConnections: number;
  colleagueConnections: number;

  // Network quality
  avgConnectionXnScore: number;
  avgConnectionTrustScore: number;
  connectionsWithDefaults: number;
  networkDefaultRate: number;

  // Circle network
  uniqueCirclePartners: number;
  circlesSharedCount: number;
  repeatCirclePartners: number;

  // Influence
  referralsMade: number;
  referralsActive: number;
  referralsDefaulted: number;
  referralConversionRate: number;
  influenceScore: number;
  isBridgeNode: boolean;
  clusterId: string | null;

  // Elder network
  elderVouchesReceived: number;
  elderAvgScore: number;

  lastComputedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskIndicators {
  id: string;
  userId: string;

  // Overall
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  overallRiskScore: number;

  // Payment risk
  paymentDeteriorationFlag: boolean;
  paymentDeteriorationTrend: number[] | null;
  predictedDefaultProbability: number | null;

  // Activity risk
  velocityAnomalyScore: number;
  loginAnomalyScore: number;
  inactivityRiskScore: number;

  // Device/geo risk
  deviceFingerprintChanges30d: number;
  geoAnomalyScore: number;
  newDeviceFlag: boolean;

  // Social risk
  socialIsolationScore: number;
  defaultContagionRisk: number;
  networkDeteriorationFlag: boolean;

  // Early warning
  earlyWarningSignals: { signal: string; severity: string; detectedAt: string }[];
  warningsCount: number;
  lastWarningAt: string | null;

  lastAssessedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type TrendData = {
  dates: string[];
  values: number[];
  direction: 'improving' | 'declining' | 'stable';
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROW → APP TRANSFORMS
// ═══════════════════════════════════════════════════════════════════════════════

function mapProfile(row: any): MemberBehavioralProfile {
  return {
    id: row.id,
    userId: row.user_id,
    totalContributions: row.total_contributions ?? 0,
    totalContributionAmount: parseFloat(row.total_contribution_amount) || 0,
    avgContributionAmount: parseFloat(row.avg_contribution_amount) || 0,
    onTimePct: parseFloat(row.on_time_pct) || 0,
    earlyPct: parseFloat(row.early_pct) || 0,
    latePct: parseFloat(row.late_pct) || 0,
    missedPct: parseFloat(row.missed_pct) || 0,
    avgDaysBeforeDue: parseFloat(row.avg_days_before_due) || 0,
    avgLateDays: parseFloat(row.avg_late_days) || 0,
    longestOnTimeStreak: row.longest_on_time_streak ?? 0,
    currentOnTimeStreak: row.current_on_time_streak ?? 0,
    contributionConsistency: parseFloat(row.contribution_consistency) || 0,
    paymentTrend: row.payment_trend || 'stable',
    lastContributionAt: row.last_contribution_at,
    circlesJoined: row.circles_joined ?? 0,
    circlesCompleted: row.circles_completed ?? 0,
    circlesAbandoned: row.circles_abandoned ?? 0,
    circlesActive: row.circles_active ?? 0,
    circleCompletionRate: parseFloat(row.circle_completion_rate) || 0,
    avgCircleDurationDays: row.avg_circle_duration_days ?? 0,
    preferredCircleAmount: row.preferred_circle_amount ? parseFloat(row.preferred_circle_amount) : null,
    preferredFrequency: row.preferred_frequency,
    roleDistribution: row.role_distribution || {},
    uniqueCirclePartners: row.unique_circle_partners ?? 0,
    avgMonthlyDeposits: parseFloat(row.avg_monthly_deposits) || 0,
    avgMonthlyWithdrawals: parseFloat(row.avg_monthly_withdrawals) || 0,
    avgWalletBalance: parseFloat(row.avg_wallet_balance) || 0,
    balanceVolatility: parseFloat(row.balance_volatility) || 0,
    depositFrequencyMonthly: parseFloat(row.deposit_frequency_monthly) || 0,
    largestSingleTransaction: parseFloat(row.largest_single_transaction) || 0,
    walletActivityScore: parseFloat(row.wallet_activity_score) || 0,
    loansApplied: row.loans_applied ?? 0,
    loansApproved: row.loans_approved ?? 0,
    loansRepaid: row.loans_repaid ?? 0,
    loansDefaulted: row.loans_defaulted ?? 0,
    totalBorrowed: parseFloat(row.total_borrowed) || 0,
    totalRepaid: parseFloat(row.total_repaid) || 0,
    avgRepaymentDaysVsSchedule: parseFloat(row.avg_repayment_days_vs_schedule) || 0,
    earlyRepaymentCount: row.early_repayment_count ?? 0,
    loanUtilizationRate: parseFloat(row.loan_utilization_rate) || 0,
    vouchesGiven: row.vouches_given ?? 0,
    vouchesReceived: row.vouches_received ?? 0,
    vouchesSuccessful: row.vouches_successful ?? 0,
    vouchesFailed: row.vouches_failed ?? 0,
    vouchSuccessRate: parseFloat(row.vouch_success_rate) || 0,
    elderEndorsementCount: row.elder_endorsement_count ?? 0,
    disputesFiled: row.disputes_filed ?? 0,
    disputesReceived: row.disputes_received ?? 0,
    disputesWon: row.disputes_won ?? 0,
    disputesLost: row.disputes_lost ?? 0,
    referralsMade: row.referrals_made ?? 0,
    referralsConverted: row.referrals_converted ?? 0,
    networkQualityScore: parseFloat(row.network_quality_score) || 0,
    accountAgeDays: row.account_age_days ?? 0,
    lastLoginAt: row.last_login_at,
    avgSessionsPerWeek: parseFloat(row.avg_sessions_per_week) || 0,
    avgSessionDurationMs: row.avg_session_duration_ms ?? 0,
    avgScreensPerSession: parseFloat(row.avg_screens_per_session) || 0,
    featureAdoptionScore: parseFloat(row.feature_adoption_score) || 0,
    daysSinceLastActivity: row.days_since_last_activity ?? 0,
    activeDaysLast30: row.active_days_last_30 ?? 0,
    activeDaysLast90: row.active_days_last_90 ?? 0,
    peakUsageHour: row.peak_usage_hour,
    primaryDevice: row.primary_device,
    defaultCount: row.default_count ?? 0,
    defaultTotalAmount: parseFloat(row.default_total_amount) || 0,
    defaultRecoveryRate: parseFloat(row.default_recovery_rate) || 0,
    deviceChangeCount30d: row.device_change_count_30d ?? 0,
    rapidWithdrawalEvents: row.rapid_withdrawal_events ?? 0,
    suspiciousPatternFlags: row.suspicious_pattern_flags || [],
    riskScore: parseFloat(row.risk_score) || 50,
    profileVersion: row.profile_version ?? 1,
    lastComputedAt: row.last_computed_at,
    computationDurationMs: row.computation_duration_ms,
    dataSources: row.data_sources || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSnapshot(row: any): ProfileSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    snapshotDate: row.snapshot_date,
    snapshotPeriod: row.snapshot_period,
    xnScore: row.xn_score,
    honorScore: row.honor_score,
    walletBalance: row.wallet_balance ? parseFloat(row.wallet_balance) : null,
    tokenBalance: row.token_balance,
    activeCircles: row.active_circles,
    activeLoans: row.active_loans,
    totalOutstandingDebt: row.total_outstanding_debt ? parseFloat(row.total_outstanding_debt) : null,
    contributionsCount: row.contributions_count ?? 0,
    contributionsAmount: parseFloat(row.contributions_amount) || 0,
    onTimePctPeriod: row.on_time_pct_period ? parseFloat(row.on_time_pct_period) : null,
    sessionsCount: row.sessions_count ?? 0,
    screensViewed: row.screens_viewed ?? 0,
    featuresUsed: row.features_used || [],
    transactionsCount: row.transactions_count ?? 0,
    transactionsVolume: parseFloat(row.transactions_volume) || 0,
    engagementScore: row.engagement_score ? parseFloat(row.engagement_score) : null,
    riskScore: row.risk_score ? parseFloat(row.risk_score) : null,
    profileCompletenessPct: row.profile_completeness_pct ? parseFloat(row.profile_completeness_pct) : null,
    createdAt: row.created_at,
  };
}

function mapSessionAnalytics(row: any): SessionAnalytics {
  return {
    id: row.id,
    userId: row.user_id,
    analyticsDate: row.analytics_date,
    sessionCount: row.session_count ?? 0,
    totalDurationMs: row.total_duration_ms ?? 0,
    avgSessionDurationMs: row.avg_session_duration_ms ?? 0,
    screensViewed: row.screens_viewed ?? 0,
    uniqueScreens: row.unique_screens ?? 0,
    mostUsedFeatures: row.most_used_features || [],
    authEvents: row.auth_events ?? 0,
    transactionEvents: row.transaction_events ?? 0,
    circleEvents: row.circle_events ?? 0,
    errorsEncountered: row.errors_encountered ?? 0,
    deviceTypes: row.device_types || [],
    peakHour: row.peak_hour,
    geoCities: row.geo_cities || [],
    createdAt: row.created_at,
  };
}

function mapNetworkMetrics(row: any): NetworkMetrics {
  return {
    id: row.id,
    userId: row.user_id,
    totalConnections: row.total_connections ?? 0,
    familyConnections: row.family_connections ?? 0,
    friendConnections: row.friend_connections ?? 0,
    colleagueConnections: row.colleague_connections ?? 0,
    avgConnectionXnScore: parseFloat(row.avg_connection_xn_score) || 0,
    avgConnectionTrustScore: parseFloat(row.avg_connection_trust_score) || 0,
    connectionsWithDefaults: row.connections_with_defaults ?? 0,
    networkDefaultRate: parseFloat(row.network_default_rate) || 0,
    uniqueCirclePartners: row.unique_circle_partners ?? 0,
    circlesSharedCount: row.circles_shared_count ?? 0,
    repeatCirclePartners: row.repeat_circle_partners ?? 0,
    referralsMade: row.referrals_made ?? 0,
    referralsActive: row.referrals_active ?? 0,
    referralsDefaulted: row.referrals_defaulted ?? 0,
    referralConversionRate: parseFloat(row.referral_conversion_rate) || 0,
    influenceScore: parseFloat(row.influence_score) || 0,
    isBridgeNode: row.is_bridge_node ?? false,
    clusterId: row.cluster_id,
    elderVouchesReceived: row.elder_vouches_received ?? 0,
    elderAvgScore: parseFloat(row.elder_avg_score) || 0,
    lastComputedAt: row.last_computed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRiskIndicators(row: any): RiskIndicators {
  return {
    id: row.id,
    userId: row.user_id,
    overallRiskLevel: row.overall_risk_level || 'low',
    overallRiskScore: parseFloat(row.overall_risk_score) || 0,
    paymentDeteriorationFlag: row.payment_deterioration_flag ?? false,
    paymentDeteriorationTrend: row.payment_deterioration_trend,
    predictedDefaultProbability: row.predicted_default_probability
      ? parseFloat(row.predicted_default_probability)
      : null,
    velocityAnomalyScore: parseFloat(row.velocity_anomaly_score) || 0,
    loginAnomalyScore: parseFloat(row.login_anomaly_score) || 0,
    inactivityRiskScore: parseFloat(row.inactivity_risk_score) || 0,
    deviceFingerprintChanges30d: row.device_fingerprint_changes_30d ?? 0,
    geoAnomalyScore: parseFloat(row.geo_anomaly_score) || 0,
    newDeviceFlag: row.new_device_flag ?? false,
    socialIsolationScore: parseFloat(row.social_isolation_score) || 0,
    defaultContagionRisk: parseFloat(row.default_contagion_risk) || 0,
    networkDeteriorationFlag: row.network_deterioration_flag ?? false,
    earlyWarningSignals: row.early_warning_signals || [],
    warningsCount: row.warnings_count ?? 0,
    lastWarningAt: row.last_warning_at,
    lastAssessedAt: row.last_assessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STALENESS CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const PROFILE_STALENESS_HOURS = 24; // Refresh if older than 24 hours

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class MemberProfileService {

  // ─────────────────────────────────────────────────────────────────────────
  // Behavioral Profile (master profile)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the current behavioral profile for a user.
   * Returns null if no profile has been computed yet.
   */
  async getProfile(userId: string): Promise<MemberBehavioralProfile | null> {
    const { data, error } = await supabase
      .from('member_behavioral_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[MemberProfile] getProfile error:', error.message);
      return null;
    }
    if (!data) return null;
    return mapProfile(data);
  }

  /**
   * Check if profile is stale and refresh if needed.
   * Returns the profile (existing or freshly computed).
   */
  async getProfileWithRefresh(userId: string): Promise<MemberBehavioralProfile | null> {
    const profile = await this.getProfile(userId);

    if (profile && this.isStale(profile.lastComputedAt)) {
      await this.refreshProfile(userId);
      return this.getProfile(userId);
    }

    if (!profile) {
      // No profile exists — compute one
      await this.refreshProfile(userId);
      return this.getProfile(userId);
    }

    return profile;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Profile Snapshots (time-series)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get historical snapshots for trend analysis.
   * @param days Number of days to look back (default 90)
   */
  async getSnapshots(userId: string, days = 90): Promise<ProfileSnapshot[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('member_profile_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', since.toISOString().split('T')[0])
      .order('snapshot_date', { ascending: false });

    if (error) {
      console.error('[MemberProfile] getSnapshots error:', error.message);
      return [];
    }
    return (data || []).map(mapSnapshot);
  }

  /**
   * Extract trend data for a specific metric from snapshots.
   */
  getTrendFromSnapshots(snapshots: ProfileSnapshot[], metric: keyof ProfileSnapshot): TrendData {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()
    );

    const dates = sorted.map(s => s.snapshotDate);
    const values = sorted.map(s => {
      const val = s[metric];
      return typeof val === 'number' ? val : 0;
    });

    // Determine direction from first vs last third averages
    const third = Math.max(1, Math.floor(values.length / 3));
    const firstThirdAvg = values.slice(0, third).reduce((a, b) => a + b, 0) / third;
    const lastThirdAvg = values.slice(-third).reduce((a, b) => a + b, 0) / third;
    const diff = lastThirdAvg - firstThirdAvg;

    let direction: TrendData['direction'] = 'stable';
    if (Math.abs(diff) > 0.05 * Math.max(Math.abs(firstThirdAvg), 1)) {
      direction = diff > 0 ? 'improving' : 'declining';
    }

    return { dates, values, direction };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Session Analytics (daily aggregation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get session analytics for a date range.
   * @param days Number of days to look back (default 30)
   */
  async getSessionAnalytics(userId: string, days = 30): Promise<SessionAnalytics[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('member_session_analytics')
      .select('*')
      .eq('user_id', userId)
      .gte('analytics_date', since.toISOString().split('T')[0])
      .order('analytics_date', { ascending: false });

    if (error) {
      console.error('[MemberProfile] getSessionAnalytics error:', error.message);
      return [];
    }
    return (data || []).map(mapSessionAnalytics);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Network Metrics
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get social network metrics for a user.
   */
  async getNetworkMetrics(userId: string): Promise<NetworkMetrics | null> {
    const { data, error } = await supabase
      .from('member_network_metrics')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[MemberProfile] getNetworkMetrics error:', error.message);
      return null;
    }
    if (!data) return null;
    return mapNetworkMetrics(data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Risk Indicators
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get consolidated risk indicators for a user.
   */
  async getRiskIndicators(userId: string): Promise<RiskIndicators | null> {
    const { data, error } = await supabase
      .from('member_risk_indicators')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[MemberProfile] getRiskIndicators error:', error.message);
      return null;
    }
    if (!data) return null;
    return mapRiskIndicators(data);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Refresh / Compute
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Trigger a full profile recomputation via the server-side SQL function.
   * This aggregates data from 16+ raw tables into member_behavioral_profiles.
   */
  async refreshProfile(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('compute_member_profile', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[MemberProfile] refreshProfile RPC error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[MemberProfile] refreshProfile exception:', err);
      return false;
    }
  }

  /**
   * Trigger session analytics computation for a specific date.
   */
  async refreshSessionAnalytics(userId: string, date?: string): Promise<boolean> {
    try {
      const params: Record<string, any> = { p_user_id: userId };
      if (date) params.p_date = date;

      const { error } = await supabase.rpc('compute_session_analytics', params);

      if (error) {
        console.error('[MemberProfile] refreshSessionAnalytics RPC error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[MemberProfile] refreshSessionAnalytics exception:', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI Feature Vector
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a flat numeric object ready for ML model input.
   * All values are numbers — no strings, nulls, or nested objects.
   * ~50 features covering payment, engagement, risk, social, and wallet.
   */
  async getFeatureVector(userId: string): Promise<Record<string, number>> {
    const [profile, network, risk] = await Promise.all([
      this.getProfile(userId),
      this.getNetworkMetrics(userId),
      this.getRiskIndicators(userId),
    ]);

    const p = profile;
    const n = network;
    const r = risk;

    return {
      // Payment behavior (12 features)
      payment_total_contributions: p?.totalContributions ?? 0,
      payment_total_amount: p?.totalContributionAmount ?? 0,
      payment_avg_amount: p?.avgContributionAmount ?? 0,
      payment_on_time_pct: p?.onTimePct ?? 0,
      payment_late_pct: p?.latePct ?? 0,
      payment_missed_pct: p?.missedPct ?? 0,
      payment_avg_late_days: p?.avgLateDays ?? 0,
      payment_longest_streak: p?.longestOnTimeStreak ?? 0,
      payment_current_streak: p?.currentOnTimeStreak ?? 0,
      payment_consistency: p?.contributionConsistency ?? 0,
      payment_trend_numeric: p?.paymentTrend === 'improving' ? 1 : p?.paymentTrend === 'declining' ? -1 : 0,
      payment_days_since_last: p?.lastContributionAt
        ? Math.floor((Date.now() - new Date(p.lastContributionAt).getTime()) / 86400000)
        : 999,

      // Circle engagement (6 features)
      circle_joined: p?.circlesJoined ?? 0,
      circle_completed: p?.circlesCompleted ?? 0,
      circle_active: p?.circlesActive ?? 0,
      circle_completion_rate: p?.circleCompletionRate ?? 0,
      circle_abandoned: p?.circlesAbandoned ?? 0,
      circle_unique_partners: p?.uniqueCirclePartners ?? 0,

      // Wallet (6 features)
      wallet_avg_balance: p?.avgWalletBalance ?? 0,
      wallet_monthly_deposits: p?.avgMonthlyDeposits ?? 0,
      wallet_monthly_withdrawals: p?.avgMonthlyWithdrawals ?? 0,
      wallet_volatility: p?.balanceVolatility ?? 0,
      wallet_largest_tx: p?.largestSingleTransaction ?? 0,
      wallet_activity_score: p?.walletActivityScore ?? 0,

      // Loan history (7 features)
      loan_applied: p?.loansApplied ?? 0,
      loan_approved: p?.loansApproved ?? 0,
      loan_repaid: p?.loansRepaid ?? 0,
      loan_defaulted: p?.loansDefaulted ?? 0,
      loan_total_borrowed: p?.totalBorrowed ?? 0,
      loan_total_repaid: p?.totalRepaid ?? 0,
      loan_utilization_rate: p?.loanUtilizationRate ?? 0,

      // Social / Trust (7 features)
      social_vouches_given: p?.vouchesGiven ?? 0,
      social_vouches_received: p?.vouchesReceived ?? 0,
      social_vouch_success_rate: p?.vouchSuccessRate ?? 0,
      social_disputes_filed: p?.disputesFiled ?? 0,
      social_disputes_received: p?.disputesReceived ?? 0,
      social_network_quality: p?.networkQualityScore ?? 0,
      social_referrals_converted: p?.referralsConverted ?? 0,

      // Engagement (8 features)
      engagement_account_age_days: p?.accountAgeDays ?? 0,
      engagement_sessions_per_week: p?.avgSessionsPerWeek ?? 0,
      engagement_feature_adoption: p?.featureAdoptionScore ?? 0,
      engagement_days_since_activity: p?.daysSinceLastActivity ?? 0,
      engagement_active_30d: p?.activeDaysLast30 ?? 0,
      engagement_active_90d: p?.activeDaysLast90 ?? 0,
      engagement_screens_per_session: p?.avgScreensPerSession ?? 0,
      engagement_session_duration_ms: p?.avgSessionDurationMs ?? 0,

      // Network (5 features)
      network_total_connections: n?.totalConnections ?? 0,
      network_influence_score: n?.influenceScore ?? 0,
      network_default_rate: n?.networkDefaultRate ?? 0,
      network_referral_conversion: n?.referralConversionRate ?? 0,
      network_is_bridge: n?.isBridgeNode ? 1 : 0,

      // Risk (6 features)
      risk_overall_score: r?.overallRiskScore ?? 0,
      risk_payment_deterioration: r?.paymentDeteriorationFlag ? 1 : 0,
      risk_predicted_default_prob: r?.predictedDefaultProbability ?? 0,
      risk_velocity_anomaly: r?.velocityAnomalyScore ?? 0,
      risk_social_isolation: r?.socialIsolationScore ?? 0,
      risk_default_contagion: r?.defaultContagionRisk ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private isStale(lastComputedAt: string): boolean {
    const computed = new Date(lastComputedAt).getTime();
    const staleThreshold = PROFILE_STALENESS_HOURS * 60 * 60 * 1000;
    return Date.now() - computed > staleThreshold;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

export const memberProfileService = new MemberProfileService();
