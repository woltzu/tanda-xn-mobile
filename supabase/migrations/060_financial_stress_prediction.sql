-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 060: Financial Stress Prediction (#33)
-- Behavioral scoring engine — 4 signals → weighted stress score → interventions
-- Signals: contribution_delay (30%), ticket_language (35%), login_drop (20%),
--          early_payout_request (15%)
-- Score range 0-100: Green (0-30), Yellow (31-60), Orange (61-80), Red (81-100)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. MEMBER STRESS SIGNALS (Raw Event Log) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS member_stress_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Signal classification
  signal_type     TEXT NOT NULL CHECK (signal_type IN (
    'contribution_delay',    -- Signal A: late payment data
    'ticket_language',       -- Signal B: stress keywords in support tickets
    'login_drop',            -- Signal C: login frequency decline
    'early_payout_request'   -- Signal D: payout change / early request
  )),

  -- Numeric value (0-100 normalized per signal type)
  signal_value    NUMERIC(6,2) NOT NULL CHECK (signal_value >= 0),

  -- Raw context for audit / ML training
  raw_data        JSONB NOT NULL DEFAULT '{}',
  -- contribution_delay: { days_late, expected_date, actual_date, consecutive_late_count, frequency_of_late }
  -- ticket_language:    { ticket_id, keywords_matched, keyword_count, urgency_level }
  -- login_drop:         { rolling_7d_avg, baseline_30d_avg, drop_pct, consecutive_weeks_dropped }
  -- early_payout_request: { request_id, reason_code, days_before_payout, requests_this_cycle }

  circle_id       UUID REFERENCES circles(id) ON DELETE SET NULL,
  cycle_id        UUID REFERENCES circle_cycles(id) ON DELETE SET NULL,

  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. MEMBER STRESS SCORES (Nightly / 6-Hourly Scoring Output) ──────────────

CREATE TABLE IF NOT EXISTS member_stress_scores (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Composite score
  stress_score            NUMERIC(5,2) NOT NULL CHECK (stress_score BETWEEN 0 AND 100),

  -- Status bucket
  status                  TEXT NOT NULL CHECK (status IN ('green', 'yellow', 'orange', 'red'))
                          DEFAULT 'green',

  -- Signal breakdown (for explainability / audit)
  signal_breakdown        JSONB NOT NULL DEFAULT '{}',
  -- {
  --   contribution_delay: { raw_value, weighted_value, weight: 0.30 },
  --   ticket_language:    { raw_value, weighted_value, weight: 0.35 },
  --   login_drop:         { raw_value, weighted_value, weight: 0.20 },
  --   early_payout_request: { raw_value, weighted_value, weight: 0.15 }
  -- }

  -- Intervention trigger
  intervention_triggered  BOOLEAN NOT NULL DEFAULT false,
  intervention_type       TEXT CHECK (intervention_type IN (
    'payment_restructure', 'counselor_referral', 'liquidity_advance', NULL
  )),

  -- Trend
  previous_score          NUMERIC(5,2),
  score_delta             NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN previous_score IS NOT NULL
         THEN stress_score - previous_score
         ELSE NULL
    END
  ) STORED,
  trend                   TEXT CHECK (trend IN ('improving', 'stable', 'worsening', NULL)),

  -- Scoring metadata
  scoring_model           TEXT NOT NULL DEFAULT 'weighted_rule_v1',
  signals_count           INTEGER NOT NULL DEFAULT 0,
  scoring_window_days     INTEGER NOT NULL DEFAULT 30,

  score_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. STRESS INTERVENTIONS (Offered Support Tracking) ───────────────────────

CREATE TABLE IF NOT EXISTS stress_interventions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stress_score_id         UUID REFERENCES member_stress_scores(id) ON DELETE SET NULL,

  -- Intervention details
  intervention_type       TEXT NOT NULL CHECK (intervention_type IN (
    'payment_restructure',   -- Split contribution into installments
    'counselor_referral',    -- CDFI / nonprofit financial counselor
    'liquidity_advance'      -- Phase 2: advance against expected payout
  )),

  stress_score_at_trigger NUMERIC(5,2) NOT NULL,
  stress_status           TEXT NOT NULL CHECK (stress_status IN ('orange', 'red')),

  -- Message content
  message_title           TEXT NOT NULL,
  message_body            TEXT NOT NULL,
  language                TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt')),

  -- Restructure details (when intervention_type = 'payment_restructure')
  original_amount_cents   INTEGER,
  installment_count       INTEGER,
  installment_amounts     JSONB,   -- [{ amount_cents, due_date }]

  -- Referral details (when intervention_type = 'counselor_referral')
  referral_partner_name   TEXT,
  referral_partner_type   TEXT CHECK (referral_partner_type IN ('cdfi', 'nonprofit', 'hud_counselor', NULL)),

  -- Lifecycle timestamps
  offered_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at               TIMESTAMPTZ,
  accepted_at             TIMESTAMPTZ,
  declined_at             TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  expired_at              TIMESTAMPTZ,

  -- Outcome
  outcome                 TEXT CHECK (outcome IN (
    'accepted', 'declined', 'expired', 'completed', 'pending', NULL
  )) DEFAULT 'pending',

  -- Did this intervention prevent a default?
  default_prevented       BOOLEAN,

  -- Admin notes
  admin_notes             TEXT,
  reviewed_by             UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ,

  circle_id               UUID REFERENCES circles(id) ON DELETE SET NULL,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. STRESS KEYWORD DICTIONARY ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stress_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword         TEXT NOT NULL UNIQUE,
  language        TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt')),
  severity_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (severity_weight BETWEEN 0.1 AND 3.0),
  category        TEXT NOT NULL DEFAULT 'general' CHECK (category IN (
    'financial', 'urgency', 'hardship', 'avoidance', 'general'
  )),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. INDEXES ────────────────────────────────────────────────────────────────

-- Signals
CREATE INDEX IF NOT EXISTS idx_stress_signals_member
  ON member_stress_signals(member_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_stress_signals_type
  ON member_stress_signals(signal_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_stress_signals_member_type
  ON member_stress_signals(member_id, signal_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_stress_signals_circle
  ON member_stress_signals(circle_id, recorded_at DESC)
  WHERE circle_id IS NOT NULL;

-- Scores
CREATE INDEX IF NOT EXISTS idx_stress_scores_member
  ON member_stress_scores(member_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_stress_scores_status
  ON member_stress_scores(status, score_date DESC)
  WHERE status IN ('orange', 'red');

CREATE INDEX IF NOT EXISTS idx_stress_scores_intervention
  ON member_stress_scores(intervention_triggered, score_date DESC)
  WHERE intervention_triggered = true;

CREATE INDEX IF NOT EXISTS idx_stress_scores_date
  ON member_stress_scores(score_date DESC);

-- Interventions
CREATE INDEX IF NOT EXISTS idx_stress_interventions_member
  ON stress_interventions(member_id, offered_at DESC);

CREATE INDEX IF NOT EXISTS idx_stress_interventions_outcome
  ON stress_interventions(outcome, offered_at DESC)
  WHERE outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_stress_interventions_type
  ON stress_interventions(intervention_type, outcome);

-- Keywords
CREATE INDEX IF NOT EXISTS idx_stress_keywords_lang
  ON stress_keywords(language, is_active)
  WHERE is_active = true;

-- ─── 6. TRIGGERS ───────────────────────────────────────────────────────────────

-- Auto-update updated_at on stress_interventions
CREATE OR REPLACE FUNCTION trg_stress_interventions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stress_interventions_updated ON stress_interventions;
CREATE TRIGGER trg_stress_interventions_updated
  BEFORE UPDATE ON stress_interventions
  FOR EACH ROW EXECUTE FUNCTION trg_stress_interventions_updated_at();

-- Auto-set outcome based on lifecycle timestamps
CREATE OR REPLACE FUNCTION trg_stress_intervention_outcome()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.outcome := 'completed';
    NEW.default_prevented := true;
  ELSIF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    NEW.outcome := 'accepted';
  ELSIF NEW.declined_at IS NOT NULL AND OLD.declined_at IS NULL THEN
    NEW.outcome := 'declined';
  ELSIF NEW.expired_at IS NOT NULL AND OLD.expired_at IS NULL THEN
    NEW.outcome := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stress_intervention_outcome ON stress_interventions;
CREATE TRIGGER trg_stress_intervention_outcome
  BEFORE UPDATE ON stress_interventions
  FOR EACH ROW EXECUTE FUNCTION trg_stress_intervention_outcome();

-- Auto-compute status bucket from stress_score
CREATE OR REPLACE FUNCTION trg_stress_score_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.stress_score <= 30 THEN 'green'
    WHEN NEW.stress_score <= 60 THEN 'yellow'
    WHEN NEW.stress_score <= 80 THEN 'orange'
    ELSE 'red'
  END;

  -- Auto-trigger intervention for Orange and Red
  IF NEW.stress_score > 60 THEN
    NEW.intervention_triggered := true;
    IF NEW.stress_score <= 80 THEN
      NEW.intervention_type := 'payment_restructure';
    ELSE
      NEW.intervention_type := 'counselor_referral';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stress_score_status ON member_stress_scores;
CREATE TRIGGER trg_stress_score_status
  BEFORE INSERT OR UPDATE OF stress_score ON member_stress_scores
  FOR EACH ROW EXECUTE FUNCTION trg_stress_score_status();

-- ─── 7. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE member_stress_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_stress_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stress_keywords ENABLE ROW LEVEL SECURITY;

-- Signals: members see own, service_role full access
CREATE POLICY stress_signals_select_own ON member_stress_signals
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY stress_signals_service ON member_stress_signals
  FOR ALL USING (auth.role() = 'service_role');

-- Scores: members see own
CREATE POLICY stress_scores_select_own ON member_stress_scores
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY stress_scores_service ON member_stress_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Interventions: members see own, can update own (accept/decline)
CREATE POLICY stress_interventions_select_own ON stress_interventions
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY stress_interventions_update_own ON stress_interventions
  FOR UPDATE USING (auth.uid() = member_id);

CREATE POLICY stress_interventions_service ON stress_interventions
  FOR ALL USING (auth.role() = 'service_role');

-- Keywords: everyone can read
CREATE POLICY stress_keywords_select ON stress_keywords
  FOR SELECT USING (true);

CREATE POLICY stress_keywords_service ON stress_keywords
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 8. REALTIME ───────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE stress_interventions;
ALTER PUBLICATION supabase_realtime ADD TABLE member_stress_scores;

-- ─── 9. STRESS DASHBOARD VIEW ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW stress_prediction_dashboard AS
SELECT
  score_date,
  COUNT(*) AS total_scored,
  COUNT(*) FILTER (WHERE status = 'green')  AS green_count,
  COUNT(*) FILTER (WHERE status = 'yellow') AS yellow_count,
  COUNT(*) FILTER (WHERE status = 'orange') AS orange_count,
  COUNT(*) FILTER (WHERE status = 'red')    AS red_count,
  ROUND(AVG(stress_score), 2) AS avg_score,
  COUNT(*) FILTER (WHERE intervention_triggered) AS interventions_triggered,
  COUNT(*) FILTER (WHERE trend = 'worsening') AS worsening_count,
  COUNT(*) FILTER (WHERE trend = 'improving') AS improving_count
FROM member_stress_scores
GROUP BY score_date
ORDER BY score_date DESC;

-- ─── 10. SEED STRESS KEYWORDS ─────────────────────────────────────────────────

INSERT INTO stress_keywords (keyword, language, severity_weight, category) VALUES
  -- English keywords
  ('struggle',    'en', 1.50, 'hardship'),
  ('can''t',      'en', 1.20, 'financial'),
  ('cannot',      'en', 1.20, 'financial'),
  ('delay',       'en', 1.00, 'urgency'),
  ('urgent',      'en', 1.80, 'urgency'),
  ('help',        'en', 1.00, 'general'),
  ('behind',      'en', 1.30, 'financial'),
  ('extension',   'en', 1.40, 'financial'),
  ('hardship',    'en', 2.00, 'hardship'),
  ('late',        'en', 1.10, 'urgency'),
  ('unable',      'en', 1.30, 'financial'),
  ('difficult',   'en', 1.20, 'hardship'),
  ('emergency',   'en', 2.50, 'urgency'),
  ('overdue',     'en', 1.40, 'financial'),
  ('broke',       'en', 1.80, 'financial'),
  ('paycheck',    'en', 1.00, 'financial'),
  ('lost job',    'en', 2.50, 'hardship'),
  ('laid off',    'en', 2.50, 'hardship'),

  -- French keywords
  ('difficulté',  'fr', 1.50, 'hardship'),
  ('retard',      'fr', 1.20, 'urgency'),
  ('urgent',      'fr', 1.80, 'urgency'),
  ('aide',        'fr', 1.00, 'general'),
  ('impossible',  'fr', 1.30, 'financial'),
  ('prolongation','fr', 1.40, 'financial'),
  ('galère',      'fr', 2.00, 'hardship'),
  ('urgence',     'fr', 1.80, 'urgency'),
  ('fauché',      'fr', 1.80, 'financial'),
  ('licencié',    'fr', 2.50, 'hardship'),
  ('payer',       'fr', 0.80, 'financial'),
  ('en retard',   'fr', 1.30, 'urgency'),
  ('délai',       'fr', 1.00, 'urgency'),
  ('détresse',    'fr', 2.00, 'hardship')
ON CONFLICT (keyword) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables: member_stress_signals, member_stress_scores, stress_interventions,
-- stress_keywords. 12 indexes, 3 triggers, 10 RLS policies, 2 realtime channels,
-- 1 dashboard view, 32 seed keywords (EN + FR).
-- ═══════════════════════════════════════════════════════════════════════════════
