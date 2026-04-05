-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 050: CronJobHandler AI Trigger Infrastructure
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Extends existing cron infrastructure with AI scoring job triggers.
-- Leverages existing tables: cron_job_logs (026), user_events (034),
-- member_behavioral_profiles (035), default_probability_scores (036),
-- circle_health_scores (036), scoring_pipeline_runs (036), score_alerts (036).
--
-- NEW Tables: model_performance_logs, cohort_analytics
-- NEW pg_cron entries: 6 AI job schedules
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: model_performance_logs
-- Weekly evaluation of AI prediction accuracy. Compares predictions from
-- 30 days ago against actual outcomes. Flags accuracy degradation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_performance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT '1.0',

  -- Evaluation window
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  prediction_window_days INTEGER NOT NULL DEFAULT 30,

  -- Accuracy metrics
  predictions_evaluated INTEGER NOT NULL DEFAULT 0,
  correct_predictions INTEGER NOT NULL DEFAULT 0,
  accuracy_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,  -- 0.0000-1.0000
  precision_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  recall_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  f1_score NUMERIC(5,4) NOT NULL DEFAULT 0.0000,

  -- Confusion matrix
  true_positives INTEGER NOT NULL DEFAULT 0,
  true_negatives INTEGER NOT NULL DEFAULT 0,
  false_positives INTEGER NOT NULL DEFAULT 0,
  false_negatives INTEGER NOT NULL DEFAULT 0,

  -- Drift detection
  accuracy_delta NUMERIC(5,4) NOT NULL DEFAULT 0.0000,  -- vs previous evaluation
  drift_detected BOOLEAN NOT NULL DEFAULT false,
  drift_severity TEXT CHECK (drift_severity IN ('none', 'minor', 'moderate', 'severe')),

  -- Extended details
  details JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: cohort_analytics
-- Monthly cohort-level metrics grouped by join date, referral source,
-- or geography. Feeds strategic dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cohort_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cohort definition
  cohort_type TEXT NOT NULL CHECK (cohort_type IN (
    'join_date', 'referral_source', 'geography'
  )),
  cohort_label TEXT NOT NULL,             -- e.g., "2025-Q4", "organic", "lagos_ng"

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Core metrics
  member_count INTEGER NOT NULL DEFAULT 0,
  active_member_count INTEGER NOT NULL DEFAULT 0,
  retention_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,     -- 0.0000-1.0000
  churn_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  avg_xnscore NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  median_xnscore NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  default_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  avg_contribution_amount_cents INTEGER NOT NULL DEFAULT 0,

  -- Circle participation
  circles_joined INTEGER NOT NULL DEFAULT 0,
  circles_completed INTEGER NOT NULL DEFAULT 0,
  circle_completion_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,

  -- Extended metrics (JSONB for flexibility)
  metrics JSONB NOT NULL DEFAULT '{}',

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one row per cohort per period
ALTER TABLE cohort_analytics
  ADD CONSTRAINT uq_cohort_period UNIQUE (cohort_type, cohort_label, period_start, period_end);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- model_performance_logs
CREATE INDEX IF NOT EXISTS idx_model_perf_model_name
  ON model_performance_logs(model_name, evaluation_date DESC);

CREATE INDEX IF NOT EXISTS idx_model_perf_date
  ON model_performance_logs(evaluation_date DESC);

CREATE INDEX IF NOT EXISTS idx_model_perf_drift
  ON model_performance_logs(drift_detected)
  WHERE drift_detected = true;

-- cohort_analytics
CREATE INDEX IF NOT EXISTS idx_cohort_type_period
  ON cohort_analytics(cohort_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_cohort_label
  ON cohort_analytics(cohort_label, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_cohort_computed
  ON cohort_analytics(computed_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE model_performance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_analytics ENABLE ROW LEVEL SECURITY;

-- model_performance_logs: service role only (internal AI monitoring)
CREATE POLICY "model_perf_service_all" ON model_performance_logs
  FOR ALL USING (auth.role() = 'service_role');

-- model_performance_logs: admins can read
CREATE POLICY "model_perf_admin_select" ON model_performance_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- cohort_analytics: service role only
CREATE POLICY "cohort_service_all" ON cohort_analytics
  FOR ALL USING (auth.role() = 'service_role');

-- cohort_analytics: admins can read
CREATE POLICY "cohort_admin_select" ON cohort_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );


-- ─────────────────────────────────────────────────────────────────────────────
-- EXTEND cron_job_logs status CHECK to include 'partial_success'
-- (existing values: success, partial, failed, running)
-- 'partial' already covers partial_success semantically — no ALTER needed
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- pg_cron SCHEDULE REGISTRATION
-- 6 AI trigger jobs added to existing cron infrastructure.
-- Dependency order via time offsets:
--   2:00 AM UTC — behavioral signals
--   3:00 AM UTC — default probability scoring
--   4:00 AM UTC — (reserved for intervention queue, future)
--   Monday 4:00 AM UTC — circle health recalculation
--   Sunday 5:00 AM UTC — model performance check
--   1st of month 6:00 AM UTC — XnScore full recalibration
--   2nd of month 6:00 AM UTC — cohort analysis
--
-- NOTE: These pg_cron entries call Supabase Edge Functions via pg_net.
-- The actual edge function deployment is handled separately.
-- Schedule entries are registered here for documentation and idempotency.
-- ─────────────────────────────────────────────────────────────────────────────

-- Register job schedules (idempotent via cron.job upsert pattern)
-- These will be activated when the corresponding Edge Functions are deployed.

DO $$
BEGIN
  -- Daily: behavioral signal update at 2:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-behavioral-signal-update') THEN
    PERFORM cron.schedule(
      'daily-behavioral-signal-update',
      '0 2 * * *',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/daily-behavioral-signal-update',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;

  -- Daily: default probability scoring at 3:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-default-probability-scoring') THEN
    PERFORM cron.schedule(
      'daily-default-probability-scoring',
      '0 3 * * *',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/daily-default-probability-scoring',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;

  -- Weekly: circle health recalculation — Monday 4:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-circle-health-recalculation') THEN
    PERFORM cron.schedule(
      'weekly-circle-health-recalculation',
      '0 4 * * 1',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/weekly-circle-health-recalculation',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;

  -- Weekly: model performance check — Sunday 5:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-model-performance-check') THEN
    PERFORM cron.schedule(
      'weekly-model-performance-check',
      '0 5 * * 0',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/weekly-model-performance-check',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;

  -- Monthly: XnScore full recalibration — 1st at 6:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-xnscore-full-recalibration') THEN
    PERFORM cron.schedule(
      'monthly-xnscore-full-recalibration',
      '0 6 1 * *',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/monthly-xnscore-full-recalibration',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;

  -- Monthly: cohort analysis — 2nd at 6:00 AM UTC
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monthly-cohort-analysis') THEN
    PERFORM cron.schedule(
      'monthly-cohort-analysis',
      '0 6 2 * *',
      $$SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url') || '/monthly-cohort-analysis',
        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
        body := '{}'::jsonb
      )$$
    );
  END IF;
END $$;
