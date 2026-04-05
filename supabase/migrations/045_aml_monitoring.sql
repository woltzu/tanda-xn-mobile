-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 045: Real-Time AML Monitoring (Rules-Based)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Rules-based Anti-Money Laundering monitoring engine. Evaluates every
-- transaction against 8 configurable rules, generates alerts, supports
-- human review workflow and SAR filing.
--
-- CRITICAL: AML alerts, reviews, and SAR filings must NEVER be visible
-- to the subject member (Bank Secrecy Act tipping-off prohibition).
-- RLS policies enforce service_role-only access on sensitive tables.
--
-- Tables: aml_rules, aml_alerts, aml_reviews, sar_filings
-- ALTER: profiles + 3 columns (aml_status, aml_restriction_reason, last_aml_check)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER PROFILES — Add AML-related columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS aml_status TEXT DEFAULT 'clear'
    CHECK (aml_status IN ('clear', 'enhanced_monitoring', 'restricted', 'frozen'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS aml_restriction_reason TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_aml_check TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: aml_rules
-- Admin-configurable rule definitions. Thresholds stored as JSONB so
-- compliance officers can tune without code changes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aml_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  description TEXT,

  -- Classification
  category TEXT NOT NULL CHECK (category IN (
    'structuring', 'velocity', 'round_trip', 'geographic',
    'dormant', 'funding', 'beneficiary', 'layering'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- When to evaluate
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'contribution', 'payout', 'deposit', 'withdrawal',
    'transfer', 'any_transaction', 'profile_update'
  )),

  -- Rule parameters
  lookback_window_days INTEGER NOT NULL DEFAULT 30,
  thresholds JSONB NOT NULL DEFAULT '{}',

  -- What to do when triggered
  action_on_trigger TEXT NOT NULL DEFAULT 'alert_only' CHECK (action_on_trigger IN (
    'alert_only', 'enhanced_monitoring', 'restrict_account', 'freeze_account'
  )),

  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: aml_alerts
-- Generated when a rule triggers. NO member access — service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aml_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES aml_rules(id),

  -- Alert classification
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'reviewing', 'cleared', 'escalated', 'sar_filed'
  )),

  -- What triggered the alert
  trigger_details JSONB DEFAULT '{}',
  transaction_ids UUID[] DEFAULT '{}',
  risk_score DECIMAL(5,2) DEFAULT 0,

  -- Automatic action taken
  auto_action_taken TEXT,

  -- Review assignment
  assigned_to UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ,

  -- Resolution
  reviewed_by UUID REFERENCES profiles(id),
  review_date TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN (
    'false_positive', 'suspicious_confirmed', 'sar_required', 'inconclusive'
  )),
  resolution_notes TEXT,
  escalated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: aml_reviews
-- Detailed audit trail for every action taken on an alert.
-- NO member access — service_role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aml_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES aml_alerts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),

  -- What happened
  review_action TEXT NOT NULL CHECK (review_action IN (
    'note_added', 'status_changed', 'escalated',
    'restriction_applied', 'restriction_lifted',
    'sar_initiated', 'sar_filed', 'cleared'
  )),
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  evidence JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: sar_filings
-- Suspicious Activity Report records. HIGHLY RESTRICTED — service_role only.
-- Never accessible to the subject member under any circumstances.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sar_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES aml_alerts(id),

  -- Filing details
  filing_reference TEXT,
  filing_date DATE,
  reporting_period_start DATE,
  reporting_period_end DATE,
  suspicious_activity_summary TEXT,
  total_suspicious_amount DECIMAL(15,2),

  -- Who filed
  filed_by UUID REFERENCES profiles(id),
  filing_status TEXT NOT NULL DEFAULT 'draft' CHECK (filing_status IN (
    'draft', 'submitted', 'accepted', 'amended'
  )),
  fincen_confirmation TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- aml_alerts
CREATE INDEX IF NOT EXISTS idx_aml_alerts_member
  ON aml_alerts(member_id);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_status
  ON aml_alerts(status)
  WHERE status NOT IN ('cleared');

CREATE INDEX IF NOT EXISTS idx_aml_alerts_severity
  ON aml_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_rule
  ON aml_alerts(rule_id);

-- aml_reviews
CREATE INDEX IF NOT EXISTS idx_aml_reviews_alert
  ON aml_reviews(alert_id);

-- sar_filings
CREATE INDEX IF NOT EXISTS idx_sar_filings_alert
  ON sar_filings(alert_id);

-- aml_rules
CREATE INDEX IF NOT EXISTS idx_aml_rules_code
  ON aml_rules(rule_code);

CREATE INDEX IF NOT EXISTS idx_aml_rules_enabled
  ON aml_rules(enabled)
  WHERE enabled = true;

-- profiles aml_status (non-clear only)
CREATE INDEX IF NOT EXISTS idx_profiles_aml_status
  ON profiles(aml_status)
  WHERE aml_status != 'clear';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
-- CRITICAL: aml_alerts, aml_reviews, and sar_filings have NO member-facing
-- policies. Only service_role can access them. This is a legal requirement
-- under the Bank Secrecy Act (tipping-off prohibition).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE aml_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE aml_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sar_filings ENABLE ROW LEVEL SECURITY;

-- aml_rules: authenticated can read (public rule catalog), service_role manages
CREATE POLICY "aml_rules_select_auth" ON aml_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "aml_rules_service_all" ON aml_rules
  FOR ALL USING (auth.role() = 'service_role');

-- aml_alerts: service_role ONLY — no member access
CREATE POLICY "aml_alerts_service_all" ON aml_alerts
  FOR ALL USING (auth.role() = 'service_role');

-- aml_reviews: service_role ONLY — no member access
CREATE POLICY "aml_reviews_service_all" ON aml_reviews
  FOR ALL USING (auth.role() = 'service_role');

-- sar_filings: service_role ONLY — absolutely no member access
CREATE POLICY "sar_filings_service_all" ON sar_filings
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE aml_alerts;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_aml_rules_updated_at
  BEFORE UPDATE ON aml_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_aml_alerts_updated_at
  BEFORE UPDATE ON aml_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sar_filings_updated_at
  BEFORE UPDATE ON sar_filings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA: 8 AML Rule Definitions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO aml_rules (rule_code, rule_name, description, category, severity, trigger_event, lookback_window_days, thresholds, action_on_trigger) VALUES
('STRUCTURING',
  'Transaction Structuring Detection',
  'Detects breaking large amounts into smaller transactions to stay below reporting thresholds. Pattern: multiple transactions totaling near $10,000 where no single transaction exceeds $9,000.',
  'structuring', 'high', 'any_transaction', 30,
  '{"min_transactions": 3, "total_amount": 9000, "max_single": 9000}',
  'restrict_account'),

('VELOCITY_ANOMALY',
  'Velocity Anomaly Detection',
  'Flags sudden dramatic increases in transaction frequency or volume inconsistent with established history. Triggers when 7-day volume exceeds 300% of 90-day weekly average.',
  'velocity', 'medium', 'any_transaction', 7,
  '{"multiplier": 3.0, "baseline_days": 90}',
  'enhanced_monitoring'),

('ROUND_TRIP',
  'Round-Trip Transaction Detection',
  'Identifies money entering the platform and exiting to a different destination almost immediately with no apparent savings purpose.',
  'round_trip', 'high', 'withdrawal', 7,
  '{"max_hours": 168, "min_amount": 500}',
  'restrict_account'),

('GEOGRAPHIC_INCONSISTENCY',
  'Geographic Inconsistency Detection',
  'Flags transactions initiated from IP addresses in multiple countries within a short time period, inconsistent with normal travel.',
  'geographic', 'medium', 'any_transaction', 1,
  '{"max_countries": 2, "max_hours": 6}',
  'enhanced_monitoring'),

('DORMANT_ACTIVATION',
  'Dormant Account Activation Detection',
  'Flags accounts with zero activity for 6+ months that suddenly become highly active with large transactions.',
  'dormant', 'medium', 'any_transaction', 180,
  '{"dormancy_days": 180, "min_reactivation_amount": 1000}',
  'enhanced_monitoring'),

('MULTIPLE_FUNDING',
  'Multiple Account Funding Detection',
  'Detects multiple different funding sources sending money to the same wallet within a short period.',
  'funding', 'medium', 'deposit', 1,
  '{"max_sources": 3, "window_hours": 24}',
  'enhanced_monitoring'),

('RAPID_BENEFICIARY_CHANGES',
  'Rapid Beneficiary Changes Detection',
  'Flags members who change payout destination bank accounts repeatedly in a short period before a large payout.',
  'beneficiary', 'high', 'profile_update', 7,
  '{"max_changes": 3, "window_days": 7, "min_payout_amount": 1000}',
  'restrict_account'),

('CIRCLE_LAYERING',
  'Circle Layering Detection',
  'Identifies members joining multiple circles simultaneously, contributing to all, receiving payouts, and immediately withdrawing — using the circle structure to move money rather than save.',
  'layering', 'high', 'payout', 30,
  '{"min_circles": 3, "max_days_join_to_withdraw": 30, "min_withdrawal_pct": 80}',
  'restrict_account');


-- ─────────────────────────────────────────────────────────────────────────────
-- CRON SCHEDULE — Weekly AML scan (Sunday 03:00 UTC, after sanctions at 02:00)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('aml-monitoring-weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aml-monitoring-weekly');

SELECT cron.schedule(
  'aml-monitoring-weekly',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/aml-monitoring-weekly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
