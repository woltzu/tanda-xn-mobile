-- =====================================================
-- 035: MEMBER FINANCIAL PROFILE DATABASE
-- AI-ready behavioral profiles aggregated from 20+
-- raw transactional tables. Designed for ML feature
-- engineering, credit scoring, fraud detection.
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- TABLE 1: member_behavioral_profiles
-- Master behavioral profile — one row per member.
-- Pre-aggregated signals from contributions, circles,
-- wallet, loans, social, engagement, and risk data.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_behavioral_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- ═══ PAYMENT BEHAVIOR ═══
  total_contributions INTEGER DEFAULT 0,
  total_contribution_amount DECIMAL(15,2) DEFAULT 0,
  avg_contribution_amount DECIMAL(12,2) DEFAULT 0,
  on_time_pct DECIMAL(5,2) DEFAULT 0,
  early_pct DECIMAL(5,2) DEFAULT 0,
  late_pct DECIMAL(5,2) DEFAULT 0,
  missed_pct DECIMAL(5,2) DEFAULT 0,
  avg_days_before_due DECIMAL(5,2) DEFAULT 0,
  avg_late_days DECIMAL(5,2) DEFAULT 0,
  longest_on_time_streak INTEGER DEFAULT 0,
  current_on_time_streak INTEGER DEFAULT 0,
  contribution_consistency DECIMAL(5,2) DEFAULT 0,
  payment_trend TEXT DEFAULT 'stable',
  last_contribution_at TIMESTAMPTZ,

  -- ═══ CIRCLE ENGAGEMENT ═══
  circles_joined INTEGER DEFAULT 0,
  circles_completed INTEGER DEFAULT 0,
  circles_abandoned INTEGER DEFAULT 0,
  circles_active INTEGER DEFAULT 0,
  circle_completion_rate DECIMAL(5,2) DEFAULT 0,
  avg_circle_duration_days INTEGER DEFAULT 0,
  preferred_circle_amount DECIMAL(12,2),
  preferred_frequency TEXT,
  role_distribution JSONB DEFAULT '{}',
  unique_circle_partners INTEGER DEFAULT 0,

  -- ═══ WALLET BEHAVIOR ═══
  avg_monthly_deposits DECIMAL(12,2) DEFAULT 0,
  avg_monthly_withdrawals DECIMAL(12,2) DEFAULT 0,
  avg_wallet_balance DECIMAL(12,2) DEFAULT 0,
  balance_volatility DECIMAL(8,2) DEFAULT 0,
  deposit_frequency_monthly DECIMAL(5,2) DEFAULT 0,
  largest_single_transaction DECIMAL(12,2) DEFAULT 0,
  wallet_activity_score DECIMAL(5,2) DEFAULT 0,

  -- ═══ LOAN HISTORY ═══
  loans_applied INTEGER DEFAULT 0,
  loans_approved INTEGER DEFAULT 0,
  loans_repaid INTEGER DEFAULT 0,
  loans_defaulted INTEGER DEFAULT 0,
  total_borrowed DECIMAL(15,2) DEFAULT 0,
  total_repaid DECIMAL(15,2) DEFAULT 0,
  avg_repayment_days_vs_schedule DECIMAL(5,2) DEFAULT 0,
  early_repayment_count INTEGER DEFAULT 0,
  loan_utilization_rate DECIMAL(5,2) DEFAULT 0,

  -- ═══ SOCIAL / TRUST ═══
  vouches_given INTEGER DEFAULT 0,
  vouches_received INTEGER DEFAULT 0,
  vouches_successful INTEGER DEFAULT 0,
  vouches_failed INTEGER DEFAULT 0,
  vouch_success_rate DECIMAL(5,2) DEFAULT 0,
  elder_endorsement_count INTEGER DEFAULT 0,
  disputes_filed INTEGER DEFAULT 0,
  disputes_received INTEGER DEFAULT 0,
  disputes_won INTEGER DEFAULT 0,
  disputes_lost INTEGER DEFAULT 0,
  referrals_made INTEGER DEFAULT 0,
  referrals_converted INTEGER DEFAULT 0,
  network_quality_score DECIMAL(5,2) DEFAULT 0,

  -- ═══ ENGAGEMENT ═══
  account_age_days INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  avg_sessions_per_week DECIMAL(5,2) DEFAULT 0,
  avg_session_duration_ms INTEGER DEFAULT 0,
  avg_screens_per_session DECIMAL(5,2) DEFAULT 0,
  feature_adoption_score DECIMAL(5,2) DEFAULT 0,
  days_since_last_activity INTEGER DEFAULT 0,
  active_days_last_30 INTEGER DEFAULT 0,
  active_days_last_90 INTEGER DEFAULT 0,
  peak_usage_hour INTEGER,
  primary_device TEXT,

  -- ═══ RISK INDICATORS ═══
  default_count INTEGER DEFAULT 0,
  default_total_amount DECIMAL(15,2) DEFAULT 0,
  default_recovery_rate DECIMAL(5,2) DEFAULT 0,
  device_change_count_30d INTEGER DEFAULT 0,
  rapid_withdrawal_events INTEGER DEFAULT 0,
  suspicious_pattern_flags JSONB DEFAULT '[]',
  risk_score DECIMAL(5,2) DEFAULT 50,

  -- ═══ METADATA ═══
  profile_version INTEGER DEFAULT 1,
  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  computation_duration_ms INTEGER,
  data_sources JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ═══════════════════════════════════════════════════════
-- TABLE 2: member_profile_snapshots
-- Weekly/monthly time-series of behavioral metrics.
-- Powers "how did behavior change over 6 months?"
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  snapshot_period TEXT NOT NULL DEFAULT 'weekly',

  -- Point-in-time metrics
  xn_score INTEGER,
  honor_score INTEGER,
  wallet_balance DECIMAL(12,2),
  token_balance INTEGER,
  active_circles INTEGER,
  active_loans INTEGER,
  total_outstanding_debt DECIMAL(15,2),

  -- Period activity
  contributions_count INTEGER DEFAULT 0,
  contributions_amount DECIMAL(12,2) DEFAULT 0,
  on_time_pct_period DECIMAL(5,2),
  sessions_count INTEGER DEFAULT 0,
  screens_viewed INTEGER DEFAULT 0,
  features_used JSONB DEFAULT '[]',
  transactions_count INTEGER DEFAULT 0,
  transactions_volume DECIMAL(15,2) DEFAULT 0,

  -- Computed scores for period
  engagement_score DECIMAL(5,2),
  risk_score DECIMAL(5,2),
  profile_completeness_pct DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date, snapshot_period)
);

-- ═══════════════════════════════════════════════════════
-- TABLE 3: member_session_analytics
-- Daily session aggregation from user_events.
-- Login frequency, session patterns, feature usage.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  analytics_date DATE NOT NULL,

  -- Session metrics
  session_count INTEGER DEFAULT 0,
  total_duration_ms BIGINT DEFAULT 0,
  avg_session_duration_ms INTEGER DEFAULT 0,
  screens_viewed INTEGER DEFAULT 0,
  unique_screens INTEGER DEFAULT 0,

  -- Feature engagement
  most_used_features JSONB DEFAULT '[]',
  auth_events INTEGER DEFAULT 0,
  transaction_events INTEGER DEFAULT 0,
  circle_events INTEGER DEFAULT 0,
  errors_encountered INTEGER DEFAULT 0,

  -- Device & geo
  device_types JSONB DEFAULT '[]',
  peak_hour INTEGER,
  geo_cities JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, analytics_date)
);

-- ═══════════════════════════════════════════════════════
-- TABLE 4: member_network_metrics
-- Social graph signals: connections, influence, risk.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_network_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Network size
  total_connections INTEGER DEFAULT 0,
  family_connections INTEGER DEFAULT 0,
  friend_connections INTEGER DEFAULT 0,
  colleague_connections INTEGER DEFAULT 0,

  -- Network quality
  avg_connection_xn_score DECIMAL(5,2) DEFAULT 0,
  avg_connection_trust_score DECIMAL(5,2) DEFAULT 0,
  connections_with_defaults INTEGER DEFAULT 0,
  network_default_rate DECIMAL(5,2) DEFAULT 0,

  -- Circle network
  unique_circle_partners INTEGER DEFAULT 0,
  circles_shared_count INTEGER DEFAULT 0,
  repeat_circle_partners INTEGER DEFAULT 0,

  -- Influence
  referrals_made INTEGER DEFAULT 0,
  referrals_active INTEGER DEFAULT 0,
  referrals_defaulted INTEGER DEFAULT 0,
  referral_conversion_rate DECIMAL(5,2) DEFAULT 0,
  influence_score DECIMAL(5,2) DEFAULT 0,
  is_bridge_node BOOLEAN DEFAULT FALSE,
  cluster_id TEXT,

  -- Elder network
  elder_vouches_received INTEGER DEFAULT 0,
  elder_avg_score DECIMAL(5,2) DEFAULT 0,

  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ═══════════════════════════════════════════════════════
-- TABLE 5: member_risk_indicators
-- Consolidated risk/fraud signals from multiple sources.
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_risk_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Overall risk
  overall_risk_level TEXT DEFAULT 'low',
  overall_risk_score DECIMAL(5,2) DEFAULT 0,

  -- Payment risk
  payment_deterioration_flag BOOLEAN DEFAULT FALSE,
  payment_deterioration_trend JSONB,
  predicted_default_probability DECIMAL(5,4),

  -- Activity risk
  velocity_anomaly_score DECIMAL(5,2) DEFAULT 0,
  login_anomaly_score DECIMAL(5,2) DEFAULT 0,
  inactivity_risk_score DECIMAL(5,2) DEFAULT 0,

  -- Device/geo risk
  device_fingerprint_changes_30d INTEGER DEFAULT 0,
  geo_anomaly_score DECIMAL(5,2) DEFAULT 0,
  new_device_flag BOOLEAN DEFAULT FALSE,

  -- Social risk
  social_isolation_score DECIMAL(5,2) DEFAULT 0,
  default_contagion_risk DECIMAL(5,2) DEFAULT 0,
  network_deterioration_flag BOOLEAN DEFAULT FALSE,

  -- Early warning signals
  early_warning_signals JSONB DEFAULT '[]',
  warnings_count INTEGER DEFAULT 0,
  last_warning_at TIMESTAMPTZ,

  last_assessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- Optimized for per-user lookup + analytics queries
-- ═══════════════════════════════════════════════════════

-- member_behavioral_profiles
CREATE INDEX IF NOT EXISTS idx_mbp_user ON member_behavioral_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_mbp_risk ON member_behavioral_profiles(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_mbp_computed ON member_behavioral_profiles(last_computed_at);
CREATE INDEX IF NOT EXISTS idx_mbp_payment_trend ON member_behavioral_profiles(payment_trend);

-- member_profile_snapshots
CREATE INDEX IF NOT EXISTS idx_mps_user_date ON member_profile_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_mps_date ON member_profile_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_mps_period ON member_profile_snapshots(snapshot_period, snapshot_date DESC);

-- member_session_analytics
CREATE INDEX IF NOT EXISTS idx_msa_user_date ON member_session_analytics(user_id, analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_msa_date ON member_session_analytics(analytics_date DESC);

-- member_network_metrics
CREATE INDEX IF NOT EXISTS idx_mnm_user ON member_network_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_mnm_influence ON member_network_metrics(influence_score DESC);

-- member_risk_indicators
CREATE INDEX IF NOT EXISTS idx_mri_user ON member_risk_indicators(user_id);
CREATE INDEX IF NOT EXISTS idx_mri_risk ON member_risk_indicators(overall_risk_level);
CREATE INDEX IF NOT EXISTS idx_mri_risk_score ON member_risk_indicators(overall_risk_score DESC);

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Users can read their own profiles.
-- No user INSERT/UPDATE — system-computed tables.
-- ═══════════════════════════════════════════════════════

ALTER TABLE member_behavioral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_profile_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_session_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_network_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_risk_indicators ENABLE ROW LEVEL SECURITY;

-- member_behavioral_profiles: SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member_behavioral_profiles' AND policyname = 'mbp_select_own'
  ) THEN
    CREATE POLICY "mbp_select_own" ON member_behavioral_profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- member_profile_snapshots: SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member_profile_snapshots' AND policyname = 'mps_select_own'
  ) THEN
    CREATE POLICY "mps_select_own" ON member_profile_snapshots
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- member_session_analytics: SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member_session_analytics' AND policyname = 'msa_select_own'
  ) THEN
    CREATE POLICY "msa_select_own" ON member_session_analytics
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- member_network_metrics: SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member_network_metrics' AND policyname = 'mnm_select_own'
  ) THEN
    CREATE POLICY "mnm_select_own" ON member_network_metrics
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- member_risk_indicators: SELECT own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'member_risk_indicators' AND policyname = 'mri_select_own'
  ) THEN
    CREATE POLICY "mri_select_own" ON member_risk_indicators
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════
-- UPDATED_AT TRIGGERS
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_member_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mbp_updated_at ON member_behavioral_profiles;
CREATE TRIGGER trg_mbp_updated_at
  BEFORE UPDATE ON member_behavioral_profiles
  FOR EACH ROW EXECUTE FUNCTION update_member_profile_updated_at();

DROP TRIGGER IF EXISTS trg_mnm_updated_at ON member_network_metrics;
CREATE TRIGGER trg_mnm_updated_at
  BEFORE UPDATE ON member_network_metrics
  FOR EACH ROW EXECUTE FUNCTION update_member_profile_updated_at();

DROP TRIGGER IF EXISTS trg_mri_updated_at ON member_risk_indicators;
CREATE TRIGGER trg_mri_updated_at
  BEFORE UPDATE ON member_risk_indicators
  FOR EACH ROW EXECUTE FUNCTION update_member_profile_updated_at();

-- ═══════════════════════════════════════════════════════
-- COMPUTE FUNCTION: compute_member_profile
-- Aggregates data from 20+ raw tables into the
-- member_behavioral_profiles row for a single user.
-- Called on login (if stale), daily cron, or on demand.
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_member_profile(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_account_created TIMESTAMPTZ;
  v_account_age INTEGER;

  -- Payment vars
  v_total_contributions INTEGER := 0;
  v_total_amount DECIMAL(15,2) := 0;
  v_on_time INTEGER := 0;
  v_early INTEGER := 0;
  v_late INTEGER := 0;
  v_missed INTEGER := 0;
  v_avg_late_days DECIMAL(5,2) := 0;
  v_last_contribution TIMESTAMPTZ;

  -- Circle vars
  v_circles_joined INTEGER := 0;
  v_circles_completed INTEGER := 0;
  v_circles_active INTEGER := 0;

  -- Wallet vars
  v_wallet_balance DECIMAL(12,2) := 0;
  v_deposits_3m DECIMAL(12,2) := 0;
  v_withdrawals_3m DECIMAL(12,2) := 0;
  v_largest_tx DECIMAL(12,2) := 0;

  -- Loan vars
  v_loans_applied INTEGER := 0;
  v_loans_approved INTEGER := 0;
  v_loans_repaid INTEGER := 0;
  v_loans_defaulted INTEGER := 0;
  v_total_borrowed DECIMAL(15,2) := 0;
  v_total_repaid_loans DECIMAL(15,2) := 0;

  -- Social vars
  v_vouches_given INTEGER := 0;
  v_vouches_received INTEGER := 0;
  v_disputes_filed INTEGER := 0;
  v_disputes_received INTEGER := 0;
  v_connections INTEGER := 0;
  v_avg_conn_score DECIMAL(5,2) := 0;

  -- Engagement vars
  v_sessions_week DECIMAL(5,2) := 0;
  v_last_login TIMESTAMPTZ;
  v_active_30 INTEGER := 0;
  v_active_90 INTEGER := 0;
  v_primary_device TEXT := 'web';

  -- Default vars
  v_default_count INTEGER := 0;
  v_default_amount DECIMAL(15,2) := 0;

  v_duration_ms INTEGER;
BEGIN
  -- Get account creation date
  SELECT created_at INTO v_account_created FROM profiles WHERE id = p_user_id;
  IF v_account_created IS NULL THEN RETURN; END IF;
  v_account_age := EXTRACT(DAY FROM (NOW() - v_account_created))::INTEGER;

  -- ═══ PAYMENT BEHAVIOR ═══
  SELECT
    COUNT(*),
    COALESCE(SUM(amount), 0),
    MAX(created_at)
  INTO v_total_contributions, v_total_amount, v_last_contribution
  FROM contributions WHERE user_id = p_user_id;

  -- Count on-time from member_contribution_stats
  SELECT
    COALESCE(SUM(on_time_count), 0),
    COALESCE(SUM(late_count), 0),
    COALESCE(SUM(missed_count), 0)
  INTO v_on_time, v_late, v_missed
  FROM member_contribution_stats WHERE user_id = p_user_id;

  -- Average late days
  SELECT COALESCE(AVG(days_late), 0)
  INTO v_avg_late_days
  FROM late_contributions WHERE user_id = p_user_id;

  -- ═══ CIRCLE ENGAGEMENT ═══
  SELECT COUNT(*) INTO v_circles_joined
  FROM circle_members WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_circles_completed
  FROM circle_completions WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_circles_active
  FROM circle_members cm
  JOIN circles c ON c.id = cm.circle_id
  WHERE cm.user_id = p_user_id AND cm.status = 'active' AND c.status = 'active';

  -- ═══ WALLET BEHAVIOR ═══
  SELECT COALESCE(balance, 0) INTO v_wallet_balance
  FROM wallets WHERE user_id = p_user_id;

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('deposit', 'payout') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('withdrawal', 'contribution') THEN amount ELSE 0 END), 0),
    COALESCE(MAX(amount), 0)
  INTO v_deposits_3m, v_withdrawals_3m, v_largest_tx
  FROM wallet_transactions wt
  JOIN wallets w ON w.id = wt.wallet_id
  WHERE w.user_id = p_user_id AND wt.created_at > NOW() - INTERVAL '90 days';

  -- ═══ LOAN HISTORY ═══
  SELECT COUNT(*) INTO v_loans_applied
  FROM loan_applications WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_loans_approved
  FROM loan_applications WHERE user_id = p_user_id AND status = 'approved';

  SELECT
    COUNT(CASE WHEN status = 'repaid' THEN 1 END),
    COUNT(CASE WHEN status = 'defaulted' THEN 1 END),
    COALESCE(SUM(principal_amount), 0)
  INTO v_loans_repaid, v_loans_defaulted, v_total_borrowed
  FROM loans WHERE borrower_id = p_user_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_repaid_loans
  FROM loan_payments lp
  JOIN loans l ON l.id = lp.loan_id
  WHERE l.borrower_id = p_user_id AND lp.status = 'completed';

  -- ═══ SOCIAL / TRUST ═══
  SELECT COUNT(*) INTO v_vouches_given
  FROM member_vouches WHERE voucher_user_id = p_user_id;

  SELECT COUNT(*) INTO v_vouches_received
  FROM member_vouches WHERE vouched_user_id = p_user_id;

  SELECT COUNT(*) INTO v_disputes_filed
  FROM disputes WHERE reporter_user_id = p_user_id;

  SELECT COUNT(*) INTO v_disputes_received
  FROM disputes WHERE against_user_id = p_user_id;

  SELECT COUNT(*), COALESCE(AVG(trust_score), 0)
  INTO v_connections, v_avg_conn_score
  FROM user_connections WHERE user_id = p_user_id AND status = 'active';

  -- ═══ ENGAGEMENT (from user_events) ═══
  SELECT
    COUNT(DISTINCT DATE(created_at))
  INTO v_active_30
  FROM user_events
  WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '30 days';

  SELECT
    COUNT(DISTINCT DATE(created_at))
  INTO v_active_90
  FROM user_events
  WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '90 days';

  SELECT MAX(created_at) INTO v_last_login
  FROM user_events
  WHERE user_id = p_user_id AND event_type IN ('login', 'app_open');

  -- Sessions per week (last 4 weeks)
  SELECT COALESCE(COUNT(DISTINCT session_id)::DECIMAL / 4.0, 0)
  INTO v_sessions_week
  FROM user_events
  WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '28 days';

  -- Primary device
  SELECT device_type INTO v_primary_device
  FROM user_events
  WHERE user_id = p_user_id AND device_type IS NOT NULL
  GROUP BY device_type
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- ═══ DEFAULTS ═══
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_default_count, v_default_amount
  FROM defaults WHERE user_id = p_user_id;

  -- ═══ COMPUTE DURATION ═══
  v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INTEGER;

  -- ═══ UPSERT ═══
  INSERT INTO member_behavioral_profiles (
    user_id,
    -- Payment
    total_contributions, total_contribution_amount, avg_contribution_amount,
    on_time_pct, late_pct, missed_pct, avg_late_days, last_contribution_at,
    -- Circles
    circles_joined, circles_completed, circles_active,
    circle_completion_rate,
    -- Wallet
    avg_wallet_balance, avg_monthly_deposits, avg_monthly_withdrawals,
    largest_single_transaction, wallet_activity_score,
    -- Loans
    loans_applied, loans_approved, loans_repaid, loans_defaulted,
    total_borrowed, total_repaid,
    -- Social
    vouches_given, vouches_received, disputes_filed, disputes_received,
    network_quality_score,
    -- Engagement
    account_age_days, last_login_at, avg_sessions_per_week,
    days_since_last_activity, active_days_last_30, active_days_last_90,
    primary_device,
    -- Risk
    default_count, default_total_amount, risk_score,
    -- Metadata
    last_computed_at, computation_duration_ms,
    data_sources
  ) VALUES (
    p_user_id,
    -- Payment
    v_total_contributions,
    v_total_amount,
    CASE WHEN v_total_contributions > 0 THEN v_total_amount / v_total_contributions ELSE 0 END,
    CASE WHEN v_total_contributions > 0 THEN (v_on_time::DECIMAL / v_total_contributions * 100) ELSE 0 END,
    CASE WHEN v_total_contributions > 0 THEN (v_late::DECIMAL / v_total_contributions * 100) ELSE 0 END,
    CASE WHEN v_total_contributions > 0 THEN (v_missed::DECIMAL / v_total_contributions * 100) ELSE 0 END,
    v_avg_late_days,
    v_last_contribution,
    -- Circles
    v_circles_joined,
    v_circles_completed,
    v_circles_active,
    CASE WHEN v_circles_joined > 0 THEN (v_circles_completed::DECIMAL / v_circles_joined * 100) ELSE 0 END,
    -- Wallet
    v_wallet_balance,
    v_deposits_3m / 3.0,
    v_withdrawals_3m / 3.0,
    v_largest_tx,
    LEAST(100, (v_deposits_3m + v_withdrawals_3m) / GREATEST(v_wallet_balance, 1) * 10),
    -- Loans
    v_loans_applied,
    v_loans_approved,
    v_loans_repaid,
    v_loans_defaulted,
    v_total_borrowed,
    v_total_repaid_loans,
    -- Social
    v_vouches_given,
    v_vouches_received,
    v_disputes_filed,
    v_disputes_received,
    v_avg_conn_score,
    -- Engagement
    v_account_age,
    v_last_login,
    v_sessions_week,
    CASE WHEN v_last_login IS NOT NULL THEN EXTRACT(DAY FROM (NOW() - v_last_login))::INTEGER ELSE v_account_age END,
    v_active_30,
    v_active_90,
    COALESCE(v_primary_device, 'web'),
    -- Risk
    v_default_count,
    v_default_amount,
    LEAST(100, GREATEST(0,
      50
      - CASE WHEN v_total_contributions > 0 THEN (v_on_time::DECIMAL / v_total_contributions * 25) ELSE 0 END
      + v_default_count * 15
      + v_disputes_received * 5
      - v_circles_completed * 3
      - LEAST(v_active_30, 15)
    )),
    -- Metadata
    NOW(),
    v_duration_ms,
    '["contributions","member_contribution_stats","late_contributions","circle_members","circles","circle_completions","wallets","wallet_transactions","loan_applications","loans","loan_payments","member_vouches","disputes","user_connections","user_events","defaults"]'::JSONB
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_contributions = EXCLUDED.total_contributions,
    total_contribution_amount = EXCLUDED.total_contribution_amount,
    avg_contribution_amount = EXCLUDED.avg_contribution_amount,
    on_time_pct = EXCLUDED.on_time_pct,
    late_pct = EXCLUDED.late_pct,
    missed_pct = EXCLUDED.missed_pct,
    avg_late_days = EXCLUDED.avg_late_days,
    last_contribution_at = EXCLUDED.last_contribution_at,
    circles_joined = EXCLUDED.circles_joined,
    circles_completed = EXCLUDED.circles_completed,
    circles_active = EXCLUDED.circles_active,
    circle_completion_rate = EXCLUDED.circle_completion_rate,
    avg_wallet_balance = EXCLUDED.avg_wallet_balance,
    avg_monthly_deposits = EXCLUDED.avg_monthly_deposits,
    avg_monthly_withdrawals = EXCLUDED.avg_monthly_withdrawals,
    largest_single_transaction = EXCLUDED.largest_single_transaction,
    wallet_activity_score = EXCLUDED.wallet_activity_score,
    loans_applied = EXCLUDED.loans_applied,
    loans_approved = EXCLUDED.loans_approved,
    loans_repaid = EXCLUDED.loans_repaid,
    loans_defaulted = EXCLUDED.loans_defaulted,
    total_borrowed = EXCLUDED.total_borrowed,
    total_repaid = EXCLUDED.total_repaid,
    vouches_given = EXCLUDED.vouches_given,
    vouches_received = EXCLUDED.vouches_received,
    disputes_filed = EXCLUDED.disputes_filed,
    disputes_received = EXCLUDED.disputes_received,
    network_quality_score = EXCLUDED.network_quality_score,
    account_age_days = EXCLUDED.account_age_days,
    last_login_at = EXCLUDED.last_login_at,
    avg_sessions_per_week = EXCLUDED.avg_sessions_per_week,
    days_since_last_activity = EXCLUDED.days_since_last_activity,
    active_days_last_30 = EXCLUDED.active_days_last_30,
    active_days_last_90 = EXCLUDED.active_days_last_90,
    primary_device = EXCLUDED.primary_device,
    default_count = EXCLUDED.default_count,
    default_total_amount = EXCLUDED.default_total_amount,
    risk_score = EXCLUDED.risk_score,
    last_computed_at = EXCLUDED.last_computed_at,
    computation_duration_ms = EXCLUDED.computation_duration_ms,
    data_sources = EXCLUDED.data_sources;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════
-- COMPUTE FUNCTION: compute_session_analytics
-- Aggregates user_events into daily session analytics.
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_session_analytics(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS VOID AS $$
DECLARE
  v_session_count INTEGER := 0;
  v_screens INTEGER := 0;
  v_unique_screens INTEGER := 0;
  v_auth_events INTEGER := 0;
  v_tx_events INTEGER := 0;
  v_circle_events INTEGER := 0;
  v_errors INTEGER := 0;
  v_peak_hour INTEGER := 0;
  v_devices JSONB := '[]';
  v_cities JSONB := '[]';
  v_features JSONB := '[]';
BEGIN
  -- Session count (unique session_ids for the day)
  SELECT COUNT(DISTINCT session_id) INTO v_session_count
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date;

  IF v_session_count = 0 THEN RETURN; END IF;

  -- Screen views
  SELECT COUNT(*), COUNT(DISTINCT event_label)
  INTO v_screens, v_unique_screens
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date AND event_type = 'screen_view';

  -- Category counts
  SELECT
    COUNT(CASE WHEN event_category = 'auth' THEN 1 END),
    COUNT(CASE WHEN event_category IN ('wallet', 'loan') THEN 1 END),
    COUNT(CASE WHEN event_category = 'circle' THEN 1 END),
    COUNT(CASE WHEN outcome = 'failure' THEN 1 END)
  INTO v_auth_events, v_tx_events, v_circle_events, v_errors
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date;

  -- Peak hour
  SELECT EXTRACT(HOUR FROM created_at)::INTEGER INTO v_peak_hour
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date
  GROUP BY EXTRACT(HOUR FROM created_at)
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Device types
  SELECT COALESCE(jsonb_agg(DISTINCT device_type), '[]')
  INTO v_devices
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date AND device_type IS NOT NULL;

  -- Geo cities
  SELECT COALESCE(jsonb_agg(DISTINCT geo_city), '[]')
  INTO v_cities
  FROM user_events
  WHERE user_id = p_user_id AND DATE(created_at) = p_date AND geo_city IS NOT NULL;

  -- Top features (by event_category frequency)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('feature', cat, 'count', cnt)), '[]')
  INTO v_features
  FROM (
    SELECT event_category AS cat, COUNT(*) AS cnt
    FROM user_events
    WHERE user_id = p_user_id AND DATE(created_at) = p_date
    GROUP BY event_category
    ORDER BY cnt DESC
    LIMIT 5
  ) sub;

  -- Upsert
  INSERT INTO member_session_analytics (
    user_id, analytics_date,
    session_count, screens_viewed, unique_screens,
    most_used_features, auth_events, transaction_events, circle_events, errors_encountered,
    device_types, peak_hour, geo_cities
  ) VALUES (
    p_user_id, p_date,
    v_session_count, v_screens, v_unique_screens,
    v_features, v_auth_events, v_tx_events, v_circle_events, v_errors,
    v_devices, v_peak_hour, v_cities
  )
  ON CONFLICT (user_id, analytics_date) DO UPDATE SET
    session_count = EXCLUDED.session_count,
    screens_viewed = EXCLUDED.screens_viewed,
    unique_screens = EXCLUDED.unique_screens,
    most_used_features = EXCLUDED.most_used_features,
    auth_events = EXCLUDED.auth_events,
    transaction_events = EXCLUDED.transaction_events,
    circle_events = EXCLUDED.circle_events,
    errors_encountered = EXCLUDED.errors_encountered,
    device_types = EXCLUDED.device_types,
    peak_hour = EXCLUDED.peak_hour,
    geo_cities = EXCLUDED.geo_cities;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════
-- BATCH COMPUTE: refresh all active member profiles
-- Called by daily cron job
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_all_member_profiles()
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_user_id IN
    SELECT id FROM profiles
    WHERE id IN (
      SELECT DISTINCT user_id FROM user_events
      WHERE created_at > NOW() - INTERVAL '90 days'
    )
  LOOP
    PERFORM compute_member_profile(v_user_id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
