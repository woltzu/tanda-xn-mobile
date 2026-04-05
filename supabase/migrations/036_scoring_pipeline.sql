-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 036: REAL-TIME SCORING PIPELINE
-- ══════════════════════════════════════════════════════════════════════════════
-- Orchestrated daily pipeline: profiles → default probability → circle health
-- → XnScore recalc → alert routing. Runs at 3 AM UTC via pg_cron.
-- ══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: default_probability_scores
-- One row per member. Heuristic default-risk model (v1).
-- Weighted signals: payment 35%, financial 20%, behavioral 20%, social 15%, tenure 10%
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS default_probability_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Probability output
  predicted_probability DECIMAL(5,4) NOT NULL DEFAULT 0.0000,  -- 0.0000 to 1.0000
  risk_bucket TEXT NOT NULL DEFAULT 'low',                      -- very_low/low/moderate/high/very_high

  -- Component signals (each 0.0000-1.0000)
  payment_signal DECIMAL(5,4) DEFAULT 0,      -- 35% weight
  financial_signal DECIMAL(5,4) DEFAULT 0,    -- 20% weight
  behavioral_signal DECIMAL(5,4) DEFAULT 0,   -- 20% weight
  social_signal DECIMAL(5,4) DEFAULT 0,       -- 15% weight
  tenure_signal DECIMAL(5,4) DEFAULT 0,       -- 10% weight

  -- Model metadata
  model_version TEXT DEFAULT 'v1_heuristic',
  confidence_score DECIMAL(3,2) DEFAULT 0.00, -- 0-1, data completeness
  input_signals JSONB DEFAULT '{}',           -- Snapshot for future ML training

  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: default_probability_history
-- Append-only audit trail of probability changes over time.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS default_probability_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  probability DECIMAL(5,4) NOT NULL,
  risk_bucket TEXT NOT NULL,
  model_version TEXT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: circle_health_scores
-- One row per circle. Composite health metric.
-- Weights: contribution reliability 40%, member quality 25%,
--          financial stability 20%, social cohesion 15%
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circle_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  -- Composite score
  health_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,  -- 0-100
  health_status TEXT NOT NULL DEFAULT 'healthy',      -- thriving/healthy/at_risk/critical

  -- Component scores (each 0-100, weighted to composite)
  contribution_reliability_score DECIMAL(5,2) DEFAULT 0,  -- 40% weight
  member_quality_score DECIMAL(5,2) DEFAULT 0,             -- 25% weight
  financial_stability_score DECIMAL(5,2) DEFAULT 0,        -- 20% weight
  social_cohesion_score DECIMAL(5,2) DEFAULT 0,            -- 15% weight

  -- Key metrics
  on_time_contribution_pct DECIMAL(5,2) DEFAULT 0,
  avg_member_xnscore DECIMAL(5,2) DEFAULT 0,
  members_with_defaults INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  avg_default_probability DECIMAL(5,4) DEFAULT 0,
  days_since_last_issue INTEGER DEFAULT 0,

  -- Trend
  previous_score DECIMAL(5,2),
  trend TEXT DEFAULT 'stable',  -- improving/stable/declining

  last_computed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circle_id)
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: circle_health_history
-- Time-series of circle health scores.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circle_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  health_score DECIMAL(5,2) NOT NULL,
  health_status TEXT NOT NULL,
  component_scores JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 5: score_alerts
-- Alert events triggered by score threshold crossings.
-- Routes to notifications (user-facing) and ops_alerts (admin).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS score_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  alert_type TEXT NOT NULL,   -- member_default_risk, circle_health_decline, xnscore_drop, circle_critical
  target_type TEXT NOT NULL,  -- member, circle
  target_id UUID NOT NULL,    -- user_id or circle_id

  -- Alert details
  severity TEXT NOT NULL DEFAULT 'warning',  -- info, warning, critical
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  score_value DECIMAL(8,4),
  threshold_value DECIMAL(8,4),

  -- Routing
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMPTZ,

  -- Resolution
  status TEXT DEFAULT 'open',  -- open, acknowledged, resolved, dismissed
  acknowledged_by UUID REFERENCES profiles(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Context
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 6: scoring_pipeline_runs
-- Execution log for each daily pipeline run.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS scoring_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,

  -- Step results
  profiles_computed INTEGER DEFAULT 0,
  default_probs_computed INTEGER DEFAULT 0,
  circle_scores_computed INTEGER DEFAULT 0,
  xnscores_recalculated INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,

  -- Timing
  step_timings JSONB DEFAULT '{}',
  total_duration_ms INTEGER,

  -- Status
  status TEXT DEFAULT 'running',  -- running, completed, partial, failed
  errors JSONB DEFAULT '[]',

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- default_probability_scores
CREATE INDEX IF NOT EXISTS idx_dps_user ON default_probability_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_dps_risk_bucket ON default_probability_scores(risk_bucket);
CREATE INDEX IF NOT EXISTS idx_dps_probability ON default_probability_scores(predicted_probability DESC);

-- default_probability_history
CREATE INDEX IF NOT EXISTS idx_dph_user_date ON default_probability_history(user_id, computed_at DESC);

-- circle_health_scores
CREATE INDEX IF NOT EXISTS idx_chs_circle ON circle_health_scores(circle_id);
CREATE INDEX IF NOT EXISTS idx_chs_status ON circle_health_scores(health_status);
CREATE INDEX IF NOT EXISTS idx_chs_score ON circle_health_scores(health_score DESC);

-- circle_health_history
CREATE INDEX IF NOT EXISTS idx_chh_circle_date ON circle_health_history(circle_id, computed_at DESC);

-- score_alerts
CREATE INDEX IF NOT EXISTS idx_sa_target ON score_alerts(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_sa_status ON score_alerts(status);
CREATE INDEX IF NOT EXISTS idx_sa_severity ON score_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_sa_created ON score_alerts(created_at DESC);

-- scoring_pipeline_runs
CREATE INDEX IF NOT EXISTS idx_spr_date ON scoring_pipeline_runs(run_date DESC);
CREATE INDEX IF NOT EXISTS idx_spr_status ON scoring_pipeline_runs(status);


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE default_probability_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_probability_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_pipeline_runs ENABLE ROW LEVEL SECURITY;

-- Users can read their own default probability data
CREATE POLICY "Users can read own default probability"
  ON default_probability_scores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can read own probability history"
  ON default_probability_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can read circle health for circles they belong to
CREATE POLICY "Members can read circle health"
  ON circle_health_scores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_health_scores.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "Members can read circle health history"
  ON circle_health_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_health_history.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

-- Users can read their own score alerts
CREATE POLICY "Users can read own alerts"
  ON score_alerts FOR SELECT
  TO authenticated
  USING (
    (target_type = 'member' AND target_id = auth.uid())
    OR
    (target_type = 'circle' AND EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = score_alerts.target_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    ))
  );

-- Pipeline runs readable by all authenticated users (admin info)
CREATE POLICY "Authenticated users can read pipeline runs"
  ON scoring_pipeline_runs FOR SELECT
  TO authenticated
  USING (true);

-- Service role has full access (handled by Supabase default)


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: updated_at auto-update
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_default_probability_updated_at
  BEFORE UPDATE ON default_probability_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_circle_health_updated_at
  BEFORE UPDATE ON circle_health_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_default_probability(p_user_id UUID)
-- Heuristic v1 default-risk model.
-- Reads from: member_behavioral_profiles, member_risk_indicators,
--             member_network_metrics, xn_scores
-- Writes to: default_probability_scores, default_probability_history,
--            member_risk_indicators.predicted_default_probability
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_default_probability(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_payment DECIMAL(5,4) := 0;
  v_financial DECIMAL(5,4) := 0;
  v_behavioral DECIMAL(5,4) := 0;
  v_social DECIMAL(5,4) := 0;
  v_tenure DECIMAL(5,4) := 0;
  v_probability DECIMAL(5,4);
  v_bucket TEXT;
  v_confidence DECIMAL(3,2) := 0;
  v_data_points INTEGER := 0;

  -- Source data
  r_profile RECORD;
  r_risk RECORD;
  r_network RECORD;
  r_score RECORD;
BEGIN
  -- ── Fetch source data ──
  SELECT * INTO r_profile FROM member_behavioral_profiles WHERE user_id = p_user_id;
  SELECT * INTO r_risk FROM member_risk_indicators WHERE user_id = p_user_id;
  SELECT * INTO r_network FROM member_network_metrics WHERE user_id = p_user_id;
  SELECT * INTO r_score FROM xn_scores WHERE user_id = p_user_id;

  -- ── PAYMENT SIGNAL (35%) ──
  -- Based on missed/late payment history and trends
  IF r_profile IS NOT NULL THEN
    v_data_points := v_data_points + 1;

    -- missed_pct: >20% → high risk
    IF COALESCE(r_profile.missed_pct, 0) > 20 THEN
      v_payment := v_payment + 0.35;
    ELSIF COALESCE(r_profile.missed_pct, 0) > 10 THEN
      v_payment := v_payment + 0.20;
    ELSIF COALESCE(r_profile.missed_pct, 0) > 5 THEN
      v_payment := v_payment + 0.10;
    END IF;

    -- late_pct: >30% → moderate-high risk
    IF COALESCE(r_profile.late_pct, 0) > 30 THEN
      v_payment := v_payment + 0.25;
    ELSIF COALESCE(r_profile.late_pct, 0) > 15 THEN
      v_payment := v_payment + 0.15;
    END IF;

    -- payment_trend declining
    IF r_profile.payment_trend = 'declining' THEN
      v_payment := v_payment + 0.15;
    END IF;

    -- Current streak broken (had contributions but streak is 0)
    IF COALESCE(r_profile.total_contributions, 0) > 5
       AND COALESCE(r_profile.current_on_time_streak, 0) = 0 THEN
      v_payment := v_payment + 0.15;
    END IF;

    -- Clamp to 0-1
    v_payment := LEAST(1.0000, v_payment);
  END IF;

  -- ── FINANCIAL SIGNAL (20%) ──
  IF r_profile IS NOT NULL THEN
    v_data_points := v_data_points + 1;

    -- High balance volatility
    IF COALESCE(r_profile.balance_volatility, 0) > 80 THEN
      v_financial := v_financial + 0.30;
    ELSIF COALESCE(r_profile.balance_volatility, 0) > 50 THEN
      v_financial := v_financial + 0.15;
    END IF;

    -- Low balance relative to contribution amount
    IF COALESCE(r_profile.avg_contribution_amount, 0) > 0
       AND COALESCE(r_profile.avg_wallet_balance, 0) < r_profile.avg_contribution_amount THEN
      v_financial := v_financial + 0.35;
    END IF;

    -- High loan utilization
    IF COALESCE(r_profile.loan_utilization_rate, 0) > 80 THEN
      v_financial := v_financial + 0.15;
    ELSIF COALESCE(r_profile.loan_utilization_rate, 0) > 60 THEN
      v_financial := v_financial + 0.08;
    END IF;

    -- Has active defaults on loans
    IF COALESCE(r_profile.loans_defaulted, 0) > 0 THEN
      v_financial := v_financial + 0.30;
    END IF;

    v_financial := LEAST(1.0000, v_financial);
  END IF;

  -- ── BEHAVIORAL SIGNAL (20%) ──
  IF r_profile IS NOT NULL THEN
    v_data_points := v_data_points + 1;

    -- Inactivity
    IF COALESCE(r_profile.days_since_last_activity, 0) > 30 THEN
      v_behavioral := v_behavioral + 0.40;
    ELSIF COALESCE(r_profile.days_since_last_activity, 0) > 14 THEN
      v_behavioral := v_behavioral + 0.20;
    END IF;

    -- Device changes (possible account takeover)
    IF r_risk IS NOT NULL AND COALESCE(r_risk.device_fingerprint_changes_30d, 0) > 2 THEN
      v_behavioral := v_behavioral + 0.20;
    END IF;

    -- Velocity anomalies
    IF r_risk IS NOT NULL AND COALESCE(r_risk.velocity_anomaly_score, 0) > 50 THEN
      v_behavioral := v_behavioral + 0.25;
    ELSIF r_risk IS NOT NULL AND COALESCE(r_risk.velocity_anomaly_score, 0) > 30 THEN
      v_behavioral := v_behavioral + 0.12;
    END IF;

    -- Login anomalies
    IF r_risk IS NOT NULL AND COALESCE(r_risk.login_anomaly_score, 0) > 50 THEN
      v_behavioral := v_behavioral + 0.15;
    END IF;

    v_behavioral := LEAST(1.0000, v_behavioral);
  END IF;

  -- ── SOCIAL SIGNAL (15%) ──
  IF r_risk IS NOT NULL OR r_network IS NOT NULL THEN
    v_data_points := v_data_points + 1;

    -- Social isolation
    IF r_risk IS NOT NULL AND COALESCE(r_risk.social_isolation_score, 0) > 70 THEN
      v_social := v_social + 0.30;
    ELSIF r_risk IS NOT NULL AND COALESCE(r_risk.social_isolation_score, 0) > 50 THEN
      v_social := v_social + 0.15;
    END IF;

    -- Network default contagion
    IF r_risk IS NOT NULL AND COALESCE(r_risk.default_contagion_risk, 0) > 50 THEN
      v_social := v_social + 0.35;
    ELSIF r_risk IS NOT NULL AND COALESCE(r_risk.default_contagion_risk, 0) > 25 THEN
      v_social := v_social + 0.18;
    END IF;

    -- Network default rate
    IF r_network IS NOT NULL AND COALESCE(r_network.network_default_rate, 0) > 10 THEN
      v_social := v_social + 0.30;
    ELSIF r_network IS NOT NULL AND COALESCE(r_network.network_default_rate, 0) > 5 THEN
      v_social := v_social + 0.15;
    END IF;

    v_social := LEAST(1.0000, v_social);
  END IF;

  -- ── TENURE SIGNAL (10%) ──
  -- Newer accounts = higher risk (inverse of account age)
  IF r_profile IS NOT NULL THEN
    v_data_points := v_data_points + 1;

    IF COALESCE(r_profile.account_age_days, 0) < 30 THEN
      v_tenure := 0.5000;
    ELSIF COALESCE(r_profile.account_age_days, 0) < 90 THEN
      v_tenure := 0.3000;
    ELSIF COALESCE(r_profile.account_age_days, 0) < 180 THEN
      v_tenure := 0.1500;
    ELSE
      v_tenure := 0.0000;
    END IF;
  ELSIF r_score IS NOT NULL THEN
    -- Fallback to xn_scores.account_age_days
    v_data_points := v_data_points + 1;
    IF COALESCE(r_score.account_age_days, 0) < 30 THEN
      v_tenure := 0.5000;
    ELSIF COALESCE(r_score.account_age_days, 0) < 90 THEN
      v_tenure := 0.3000;
    ELSIF COALESCE(r_score.account_age_days, 0) < 180 THEN
      v_tenure := 0.1500;
    ELSE
      v_tenure := 0.0000;
    END IF;
  END IF;

  -- ── COMPOSITE PROBABILITY ──
  v_probability := LEAST(1.0000, GREATEST(0.0000,
    0.35 * v_payment +
    0.20 * v_financial +
    0.20 * v_behavioral +
    0.15 * v_social +
    0.10 * v_tenure
  ));

  -- ── RISK BUCKET ──
  v_bucket := CASE
    WHEN v_probability < 0.05 THEN 'very_low'
    WHEN v_probability < 0.15 THEN 'low'
    WHEN v_probability < 0.30 THEN 'moderate'
    WHEN v_probability < 0.50 THEN 'high'
    ELSE 'very_high'
  END;

  -- ── CONFIDENCE SCORE ──
  -- Based on how many data sources had data (max 5 sources)
  v_confidence := LEAST(1.00, v_data_points::DECIMAL / 5.0);

  -- ── UPSERT into default_probability_scores ──
  INSERT INTO default_probability_scores (
    user_id, predicted_probability, risk_bucket,
    payment_signal, financial_signal, behavioral_signal, social_signal, tenure_signal,
    model_version, confidence_score,
    input_signals, last_computed_at, updated_at
  ) VALUES (
    p_user_id, v_probability, v_bucket,
    v_payment, v_financial, v_behavioral, v_social, v_tenure,
    'v1_heuristic', v_confidence,
    jsonb_build_object(
      'missed_pct', COALESCE(r_profile.missed_pct, 0),
      'late_pct', COALESCE(r_profile.late_pct, 0),
      'payment_trend', COALESCE(r_profile.payment_trend, 'unknown'),
      'balance_volatility', COALESCE(r_profile.balance_volatility, 0),
      'days_since_last_activity', COALESCE(r_profile.days_since_last_activity, 0),
      'account_age_days', COALESCE(r_profile.account_age_days, COALESCE(r_score.account_age_days, 0)),
      'social_isolation', COALESCE(r_risk.social_isolation_score, 0),
      'network_default_rate', COALESCE(r_network.network_default_rate, 0),
      'xn_score', COALESCE(r_score.total_score, 0)
    ),
    NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    predicted_probability = EXCLUDED.predicted_probability,
    risk_bucket = EXCLUDED.risk_bucket,
    payment_signal = EXCLUDED.payment_signal,
    financial_signal = EXCLUDED.financial_signal,
    behavioral_signal = EXCLUDED.behavioral_signal,
    social_signal = EXCLUDED.social_signal,
    tenure_signal = EXCLUDED.tenure_signal,
    confidence_score = EXCLUDED.confidence_score,
    input_signals = EXCLUDED.input_signals,
    last_computed_at = NOW(),
    updated_at = NOW();

  -- ── APPEND to history ──
  INSERT INTO default_probability_history (
    user_id, probability, risk_bucket, model_version, computed_at
  ) VALUES (
    p_user_id, v_probability, v_bucket, 'v1_heuristic', NOW()
  );

  -- ── UPDATE member_risk_indicators.predicted_default_probability ──
  UPDATE member_risk_indicators
  SET predicted_default_probability = v_probability,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_probability;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_all_default_probabilities()
-- Batch wrapper: computes default probability for all active users.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_all_default_probabilities()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT DISTINCT p.id
    FROM profiles p
    WHERE EXISTS (
      SELECT 1 FROM member_behavioral_profiles mbp WHERE mbp.user_id = p.id
    )
  LOOP
    BEGIN
      PERFORM compute_default_probability(v_user.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'compute_default_probability failed for user %: %', v_user.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_circle_health_score(p_circle_id UUID)
-- Composite circle health from contribution reliability, member quality,
-- financial stability, and social cohesion.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_circle_health_score(p_circle_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_contribution_score DECIMAL(5,2) := 50;
  v_member_quality DECIMAL(5,2) := 50;
  v_financial_stability DECIMAL(5,2) := 50;
  v_social_cohesion DECIMAL(5,2) := 50;
  v_health_score DECIMAL(5,2);
  v_health_status TEXT;
  v_on_time_pct DECIMAL(5,2) := 0;
  v_avg_xnscore DECIMAL(5,2) := 0;
  v_members_with_defaults INTEGER := 0;
  v_total_members INTEGER := 0;
  v_avg_default_prob DECIMAL(5,4) := 0;
  v_previous_score DECIMAL(5,2);
  v_trend TEXT := 'stable';

  -- Contribution stats
  v_total_contributions INTEGER := 0;
  v_on_time_contributions INTEGER := 0;
  v_late_contributions INTEGER := 0;
  v_defaulted_contributions INTEGER := 0;
BEGIN
  -- ── Get total active members ──
  SELECT COUNT(*) INTO v_total_members
  FROM circle_members
  WHERE circle_id = p_circle_id AND status = 'active';

  IF v_total_members = 0 THEN
    RETURN 0;
  END IF;

  -- ── CONTRIBUTION RELIABILITY SCORE (40%) ──
  -- Count contributions by status for this circle
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'completed' AND is_late = false),
    COUNT(*) FILTER (WHERE status = 'late' OR is_late = true),
    COUNT(*) FILTER (WHERE status = 'defaulted')
  INTO v_total_contributions, v_on_time_contributions, v_late_contributions, v_defaulted_contributions
  FROM contributions
  WHERE circle_id = p_circle_id;

  IF v_total_contributions > 0 THEN
    v_on_time_pct := (v_on_time_contributions::DECIMAL / v_total_contributions) * 100;
    -- Scale: 95%+ on-time = 100, linear down to 0 at 50%
    v_contribution_score := LEAST(100, GREATEST(0,
      ((v_on_time_pct - 50) / 45) * 100
    ));
    -- Penalize defaults heavily
    IF v_defaulted_contributions > 0 THEN
      v_contribution_score := GREATEST(0,
        v_contribution_score - (v_defaulted_contributions * 15)
      );
    END IF;
  END IF;

  -- ── MEMBER QUALITY SCORE (25%) ──
  -- Average XnScore of active members
  SELECT COALESCE(AVG(xs.total_score), 0) INTO v_avg_xnscore
  FROM circle_members cm
  JOIN xn_scores xs ON xs.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  -- Scale: XnScore 0-100 maps to quality 0-100
  v_member_quality := v_avg_xnscore;

  -- Count members with active defaults
  SELECT COUNT(*) INTO v_members_with_defaults
  FROM circle_members
  WHERE circle_id = p_circle_id
    AND status = 'active'
    AND has_active_default = true;

  -- Penalize for members with defaults
  IF v_members_with_defaults > 0 THEN
    v_member_quality := GREATEST(0,
      v_member_quality - (v_members_with_defaults * 20)
    );
  END IF;

  -- Average default probability of members
  SELECT COALESCE(AVG(dps.predicted_probability), 0) INTO v_avg_default_prob
  FROM circle_members cm
  JOIN default_probability_scores dps ON dps.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  -- ── FINANCIAL STABILITY SCORE (20%) ──
  -- Based on default probability and defaults history
  v_financial_stability := GREATEST(0, 100 - (v_avg_default_prob * 200));

  -- Check for recent defaults in this circle
  IF EXISTS (
    SELECT 1 FROM defaults
    WHERE circle_id = p_circle_id
      AND default_status = 'unresolved'
  ) THEN
    v_financial_stability := GREATEST(0, v_financial_stability - 30);
  END IF;

  -- ── SOCIAL COHESION SCORE (15%) ──
  -- Based on how many members have shared circle history
  DECLARE
    v_shared_circles_avg DECIMAL := 0;
  BEGIN
    SELECT COALESCE(AVG(shared_count), 0) INTO v_shared_circles_avg
    FROM (
      SELECT cm1.user_id, COUNT(DISTINCT cm2.circle_id) as shared_count
      FROM circle_members cm1
      JOIN circle_members cm2 ON cm2.user_id = cm1.user_id
        AND cm2.circle_id != p_circle_id
        AND cm2.status = 'active'
      WHERE cm1.circle_id = p_circle_id AND cm1.status = 'active'
      GROUP BY cm1.user_id
    ) sub;

    -- Members in multiple circles together = higher cohesion
    v_social_cohesion := LEAST(100, v_shared_circles_avg * 20 + 30);
  END;

  -- ── COMPOSITE HEALTH SCORE ──
  v_health_score := ROUND(
    v_contribution_score * 0.40 +
    v_member_quality * 0.25 +
    v_financial_stability * 0.20 +
    v_social_cohesion * 0.15,
    2
  );

  -- ── HEALTH STATUS ──
  v_health_status := CASE
    WHEN v_health_score >= 80 THEN 'thriving'
    WHEN v_health_score >= 60 THEN 'healthy'
    WHEN v_health_score >= 40 THEN 'at_risk'
    ELSE 'critical'
  END;

  -- ── TREND (compare to previous score) ──
  SELECT health_score INTO v_previous_score
  FROM circle_health_scores
  WHERE circle_id = p_circle_id;

  IF v_previous_score IS NOT NULL THEN
    IF v_health_score > v_previous_score + 3 THEN
      v_trend := 'improving';
    ELSIF v_health_score < v_previous_score - 3 THEN
      v_trend := 'declining';
    ELSE
      v_trend := 'stable';
    END IF;
  END IF;

  -- ── UPSERT circle_health_scores ──
  INSERT INTO circle_health_scores (
    circle_id, health_score, health_status,
    contribution_reliability_score, member_quality_score,
    financial_stability_score, social_cohesion_score,
    on_time_contribution_pct, avg_member_xnscore,
    members_with_defaults, total_members,
    avg_default_probability, previous_score, trend,
    last_computed_at, updated_at
  ) VALUES (
    p_circle_id, v_health_score, v_health_status,
    v_contribution_score, v_member_quality,
    v_financial_stability, v_social_cohesion,
    v_on_time_pct, v_avg_xnscore,
    v_members_with_defaults, v_total_members,
    v_avg_default_prob, v_previous_score, v_trend,
    NOW(), NOW()
  )
  ON CONFLICT (circle_id) DO UPDATE SET
    health_score = EXCLUDED.health_score,
    health_status = EXCLUDED.health_status,
    contribution_reliability_score = EXCLUDED.contribution_reliability_score,
    member_quality_score = EXCLUDED.member_quality_score,
    financial_stability_score = EXCLUDED.financial_stability_score,
    social_cohesion_score = EXCLUDED.social_cohesion_score,
    on_time_contribution_pct = EXCLUDED.on_time_contribution_pct,
    avg_member_xnscore = EXCLUDED.avg_member_xnscore,
    members_with_defaults = EXCLUDED.members_with_defaults,
    total_members = EXCLUDED.total_members,
    avg_default_probability = EXCLUDED.avg_default_probability,
    previous_score = circle_health_scores.health_score,
    trend = EXCLUDED.trend,
    last_computed_at = NOW(),
    updated_at = NOW();

  -- ── APPEND to history ──
  INSERT INTO circle_health_history (
    circle_id, health_score, health_status,
    component_scores, computed_at
  ) VALUES (
    p_circle_id, v_health_score, v_health_status,
    jsonb_build_object(
      'contribution_reliability', v_contribution_score,
      'member_quality', v_member_quality,
      'financial_stability', v_financial_stability,
      'social_cohesion', v_social_cohesion
    ),
    NOW()
  );

  RETURN v_health_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_all_circle_health_scores()
-- Batch wrapper: computes health for all active circles.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_all_circle_health_scores()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_circle RECORD;
BEGIN
  FOR v_circle IN
    SELECT id FROM circles
    WHERE status IN ('active', 'in_progress', 'pending')
  LOOP
    BEGIN
      PERFORM compute_circle_health_score(v_circle.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'compute_circle_health_score failed for circle %: %', v_circle.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: recalculate_all_xn_scores()
-- Batch wrapper for XnScore recalculation.
-- Calls existing recalculate_xn_score() for each active user.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION recalculate_all_xn_scores()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT user_id FROM xn_scores
    WHERE score_frozen = false
  LOOP
    BEGIN
      PERFORM recalculate_xn_score(v_user.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalculate_xn_score failed for user %: %', v_user.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: evaluate_score_alerts()
-- Reads freshly computed scores and generates alerts for threshold crossings.
-- Routes to: score_alerts, notifications, ops_alerts
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION evaluate_score_alerts()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
  v_alert_id UUID;
BEGIN
  -- ── ALERT 1: High default probability (> 0.50 = critical, > 0.25 = warning) ──
  FOR v_rec IN
    SELECT dps.user_id, dps.predicted_probability, dps.risk_bucket
    FROM default_probability_scores dps
    WHERE dps.predicted_probability > 0.25
      -- Only alert if not already alerted in the last 7 days
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'member'
          AND sa.target_id = dps.user_id
          AND sa.alert_type = 'member_default_risk'
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity,
      title, message, score_value, threshold_value,
      context
    ) VALUES (
      'member_default_risk',
      'member',
      v_rec.user_id,
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 'critical' ELSE 'warning' END,
      CASE WHEN v_rec.predicted_probability > 0.50
        THEN 'Critical Default Risk'
        ELSE 'Elevated Default Risk'
      END,
      'Member default probability is ' || ROUND(v_rec.predicted_probability * 100, 1) || '% (' || v_rec.risk_bucket || ')',
      v_rec.predicted_probability,
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 0.50 ELSE 0.25 END,
      jsonb_build_object('risk_bucket', v_rec.risk_bucket)
    ) RETURNING id INTO v_alert_id;

    -- Insert user-facing notification
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_rec.user_id,
      'score_alert',
      'Your payment risk level has increased',
      'Your account shows signs of elevated default risk. Maintain on-time payments to improve your standing.',
      jsonb_build_object('alert_id', v_alert_id, 'risk_bucket', v_rec.risk_bucket)
    );

    -- Insert ops alert for admin visibility
    INSERT INTO ops_alerts (alert_type, details, priority)
    VALUES (
      'member_default_risk',
      jsonb_build_object(
        'user_id', v_rec.user_id,
        'probability', v_rec.predicted_probability,
        'risk_bucket', v_rec.risk_bucket,
        'score_alert_id', v_alert_id
      ),
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 'critical' ELSE 'high' END
    );

    v_count := v_count + 1;
  END LOOP;

  -- ── ALERT 2: Circle health decline (< 50 = critical, < 70 = warning) ──
  FOR v_rec IN
    SELECT chs.circle_id, chs.health_score, chs.health_status, chs.trend,
           c.name as circle_name
    FROM circle_health_scores chs
    JOIN circles c ON c.id = chs.circle_id
    WHERE chs.health_score < 70
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'circle'
          AND sa.target_id = chs.circle_id
          AND sa.alert_type IN ('circle_health_decline', 'circle_critical')
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity,
      title, message, score_value, threshold_value,
      context
    ) VALUES (
      CASE WHEN v_rec.health_score < 50 THEN 'circle_critical' ELSE 'circle_health_decline' END,
      'circle',
      v_rec.circle_id,
      CASE WHEN v_rec.health_score < 50 THEN 'critical' ELSE 'warning' END,
      CASE WHEN v_rec.health_score < 50
        THEN 'Critical: Circle "' || v_rec.circle_name || '" health is critical'
        ELSE 'Circle "' || v_rec.circle_name || '" health declining'
      END,
      'Circle health score is ' || ROUND(v_rec.health_score, 1) || '/100 (' || v_rec.health_status || ')',
      v_rec.health_score,
      CASE WHEN v_rec.health_score < 50 THEN 50 ELSE 70 END,
      jsonb_build_object('health_status', v_rec.health_status, 'trend', v_rec.trend)
    ) RETURNING id INTO v_alert_id;

    -- Notify circle members
    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT cm.user_id, 'score_alert',
      'Your circle needs attention',
      'Circle "' || v_rec.circle_name || '" health is ' || v_rec.health_status || '. Work together to improve on-time contributions.',
      jsonb_build_object('alert_id', v_alert_id, 'circle_id', v_rec.circle_id)
    FROM circle_members cm
    WHERE cm.circle_id = v_rec.circle_id AND cm.status = 'active';

    -- Ops alert
    INSERT INTO ops_alerts (alert_type, details, priority)
    VALUES (
      'circle_health_decline',
      jsonb_build_object(
        'circle_id', v_rec.circle_id,
        'circle_name', v_rec.circle_name,
        'health_score', v_rec.health_score,
        'health_status', v_rec.health_status,
        'score_alert_id', v_alert_id
      ),
      CASE WHEN v_rec.health_score < 50 THEN 'critical' ELSE 'high' END
    );

    v_count := v_count + 1;
  END LOOP;

  -- ── ALERT 3: XnScore significant drop (> 10 points) ──
  FOR v_rec IN
    SELECT xs.user_id, xs.total_score, xs.previous_score,
           (xs.previous_score - xs.total_score) as drop_amount
    FROM xn_scores xs
    WHERE xs.previous_score IS NOT NULL
      AND xs.previous_score - xs.total_score > 10
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'member'
          AND sa.target_id = xs.user_id
          AND sa.alert_type = 'xnscore_drop'
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity,
      title, message, score_value, threshold_value,
      context
    ) VALUES (
      'xnscore_drop',
      'member',
      v_rec.user_id,
      CASE WHEN v_rec.drop_amount > 20 THEN 'critical' ELSE 'warning' END,
      'XnScore dropped significantly',
      'Your XnScore dropped by ' || ROUND(v_rec.drop_amount, 1) || ' points (from ' || ROUND(v_rec.previous_score, 1) || ' to ' || ROUND(v_rec.total_score, 1) || ')',
      v_rec.total_score,
      v_rec.previous_score - 10,
      jsonb_build_object(
        'previous_score', v_rec.previous_score,
        'current_score', v_rec.total_score,
        'drop_amount', v_rec.drop_amount
      )
    ) RETURNING id INTO v_alert_id;

    -- Notify user
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_rec.user_id,
      'score_alert',
      'Your XnScore has dropped',
      'Your XnScore dropped by ' || ROUND(v_rec.drop_amount, 1) || ' points. Stay active and make on-time payments to recover.',
      jsonb_build_object('alert_id', v_alert_id, 'drop_amount', v_rec.drop_amount)
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: run_scoring_pipeline()
-- Master orchestrator. Runs all 5 steps sequentially with error isolation.
-- Returns JSONB summary of the run.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION run_scoring_pipeline()
RETURNS JSONB AS $$
DECLARE
  v_run_id UUID;
  v_profiles INTEGER := 0;
  v_defaults INTEGER := 0;
  v_circles INTEGER := 0;
  v_xnscores INTEGER := 0;
  v_alerts INTEGER := 0;
  v_step_timings JSONB := '{}';
  v_errors JSONB := '[]';
  v_step_start TIMESTAMPTZ;
  v_pipeline_start TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Create pipeline run record
  INSERT INTO scoring_pipeline_runs (run_date, status, started_at)
  VALUES (CURRENT_DATE, 'running', NOW())
  RETURNING id INTO v_run_id;

  -- ── Step 1: Recompute member profiles [EXISTING from migration 035] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_member_profiles() INTO v_profiles;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'profiles', 'error', SQLERRM);
    v_profiles := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'profiles_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Step 2: Compute default probabilities [NEW] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_default_probabilities() INTO v_defaults;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'default_probabilities', 'error', SQLERRM);
    v_defaults := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'default_probs_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Step 3: Compute circle health scores [NEW] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_circle_health_scores() INTO v_circles;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'circle_health', 'error', SQLERRM);
    v_circles := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'circle_health_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Step 4: Recalculate XnScores [BATCH WRAPPER] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT recalculate_all_xn_scores() INTO v_xnscores;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'xnscores', 'error', SQLERRM);
    v_xnscores := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'xnscores_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Step 5: Evaluate alerts [NEW] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT evaluate_score_alerts() INTO v_alerts;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'alerts', 'error', SQLERRM);
    v_alerts := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'alerts_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Finalize pipeline run ──
  UPDATE scoring_pipeline_runs SET
    profiles_computed = v_profiles,
    default_probs_computed = v_defaults,
    circle_scores_computed = v_circles,
    xnscores_recalculated = v_xnscores,
    alerts_generated = v_alerts,
    step_timings = v_step_timings,
    total_duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    status = CASE
      WHEN v_errors = '[]'::JSONB THEN 'completed'
      WHEN v_profiles + v_defaults + v_circles + v_xnscores > 0 THEN 'partial'
      ELSE 'failed'
    END,
    errors = v_errors,
    completed_at = NOW()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'profiles', v_profiles,
    'default_probs', v_defaults,
    'circles', v_circles,
    'xnscores', v_xnscores,
    'alerts', v_alerts,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PG_CRON: Schedule daily pipeline at 3:00 AM UTC
-- Runs after: interest (00:00), overdue (01:00), cleanup (02:00)
-- Runs before: autopay (06:00), payouts (08:00)
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'scoring-pipeline-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/scoring-pipeline-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
