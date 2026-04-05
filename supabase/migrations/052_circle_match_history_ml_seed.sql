-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 052: Circle Match History as ML Training Seed
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Extends existing circle_match_history (007) with ML training columns:
-- session context, profile snapshots, algorithm version, outcome labeling.
-- Adds match_data_quality_logs for weekly data quality monitoring.
--
-- ALTER: circle_match_history (6 new columns)
-- NEW: match_data_quality_logs
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER circle_match_history — add ML training columns
-- ─────────────────────────────────────────────────────────────────────────────

-- Session context: what screen, how many circles viewed in session, etc.
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS session_context JSONB NOT NULL DEFAULT '{}';

-- Member profile snapshot at time of interaction (XnScore, tier, tenure, etc.)
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS member_profile_snapshot JSONB NOT NULL DEFAULT '{}';

-- Circle profile snapshot at time of interaction (contribution amount, size, health, etc.)
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS circle_profile_snapshot JSONB NOT NULL DEFAULT '{}';

-- Which algorithm version generated the match_score
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT NOT NULL DEFAULT 'rule-v1';

-- Detailed outcome: null → pending, true/false/partial after circle completes
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS outcome_label TEXT CHECK (outcome_label IN (
    'pending', 'success', 'partial', 'defaulted', 'circle_dissolved', 'exited', 'not_applicable'
  ));

-- When the outcome was labeled (by the weekly cron job)
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS outcome_labeled_at TIMESTAMPTZ;

-- Expand action CHECK constraint to include 'returned' and 'shared'
-- Drop old constraint first, add new one
ALTER TABLE circle_match_history DROP CONSTRAINT IF EXISTS circle_match_history_action_check;
ALTER TABLE circle_match_history
  ADD CONSTRAINT circle_match_history_action_check
  CHECK (action IN ('viewed', 'dismissed', 'saved', 'applied', 'joined', 'rejected', 'returned', 'shared'));

-- Add updated_at column for outcome labeling updates
ALTER TABLE circle_match_history
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: match_data_quality_logs
-- Weekly data quality monitoring for circle_match_history.
-- Checks completeness, snapshot coverage, labeling gaps.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS match_data_quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Volume metrics
  total_records INTEGER NOT NULL DEFAULT 0,
  records_with_snapshots INTEGER NOT NULL DEFAULT 0,
  records_missing_member_snapshot INTEGER NOT NULL DEFAULT 0,
  records_missing_circle_snapshot INTEGER NOT NULL DEFAULT 0,
  records_missing_session_context INTEGER NOT NULL DEFAULT 0,

  -- Action distribution
  view_count INTEGER NOT NULL DEFAULT 0,
  join_count INTEGER NOT NULL DEFAULT 0,
  dismiss_count INTEGER NOT NULL DEFAULT 0,
  return_count INTEGER NOT NULL DEFAULT 0,
  share_count INTEGER NOT NULL DEFAULT 0,

  -- Outcome labeling
  outcomes_pending INTEGER NOT NULL DEFAULT 0,
  outcomes_labeled INTEGER NOT NULL DEFAULT 0,
  outcomes_overdue INTEGER NOT NULL DEFAULT 0,   -- should have been labeled but weren't

  -- Quality scores (0-100)
  snapshot_completeness_score INTEGER NOT NULL DEFAULT 0,
  outcome_labeling_score INTEGER NOT NULL DEFAULT 0,
  overall_quality_score INTEGER NOT NULL DEFAULT 0,

  -- Issues found
  issues JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- NEW INDEXES on circle_match_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_match_history_outcome_pending
  ON circle_match_history(outcome_label, created_at)
  WHERE outcome_label IS NULL OR outcome_label = 'pending';

CREATE INDEX IF NOT EXISTS idx_match_history_algorithm
  ON circle_match_history(algorithm_version, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_joined
  ON circle_match_history(user_id, circle_id)
  WHERE action = 'joined';

CREATE INDEX IF NOT EXISTS idx_match_history_created
  ON circle_match_history(created_at DESC);

-- match_data_quality_logs indexes
CREATE INDEX IF NOT EXISTS idx_quality_logs_date
  ON match_data_quality_logs(check_date DESC);

CREATE INDEX IF NOT EXISTS idx_quality_logs_score
  ON match_data_quality_logs(overall_quality_score)
  WHERE overall_quality_score < 80;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY for match_data_quality_logs
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE match_data_quality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quality_logs_service_all" ON match_data_quality_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Service role policy for circle_match_history (for outcome labeling cron)
CREATE POLICY "match_history_service_all" ON circle_match_history
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGER for updated_at on circle_match_history
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_match_history_updated_at
  BEFORE UPDATE ON circle_match_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
