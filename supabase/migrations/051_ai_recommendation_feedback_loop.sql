-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 051: AI Recommendation Feedback Loop
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Collects explicit member feedback on AI-driven recommendations (circle
-- suggestions, coaching tips, interventions, score explanations, payout
-- position explanations). Tracks outcomes to close the recommendation →
-- feedback → behavior loop. Weekly aggregation feeds model improvement.
--
-- Tables: ai_recommendation_feedback, model_feedback_summary
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: ai_recommendation_feedback
-- One row per recommendation shown to a member. Tracks what was recommended,
-- feedback given, and actual outcome (did they follow the recommendation?).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What type of recommendation
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN (
    'circle_suggestion',
    'coaching_tip',
    'intervention_message',
    'xnscore_explanation',
    'payout_position_explanation'
  )),

  -- Link to specific recommendation instance (ai_decisions.id, etc.)
  recommendation_id UUID,

  -- Exact content that was shown (JSONB for flexibility)
  recommendation_data JSONB NOT NULL DEFAULT '{}',

  -- Model version that produced this recommendation
  model_version TEXT NOT NULL DEFAULT 'rule-v1',

  -- Member feedback
  feedback TEXT CHECK (feedback IN (
    'helpful', 'not_helpful', 'wrong', 'unfair', 'unclear'
  )),
  feedback_text TEXT,                        -- Optional free text
  feedback_category TEXT,                    -- Preset follow-up option chosen

  -- Outcome tracking (what member actually did after recommendation)
  outcome TEXT CHECK (outcome IN (
    'followed',        -- Took the recommended action
    'ignored',         -- Saw it but did nothing
    'opposite',        -- Did the opposite
    'partial',         -- Partially followed
    'not_applicable',  -- Outcome could not be determined
    'pending'          -- Still within the 7-day tracking window
  )),
  outcome_details JSONB DEFAULT '{}',

  -- Timing
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  feedback_given_at TIMESTAMPTZ,
  outcome_recorded_at TIMESTAMPTZ,
  prompt_dismissed_at TIMESTAMPTZ,
  prompt_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),

  -- State
  feedback_prompted BOOLEAN NOT NULL DEFAULT false,
  feedback_prompt_eligible BOOLEAN NOT NULL DEFAULT true,  -- false if stressful event occurred
  human_review_requested BOOLEAN NOT NULL DEFAULT false,   -- "unfair" triggers this
  human_review_resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: model_feedback_summary
-- Weekly aggregation of feedback by recommendation_type and model_version.
-- Produced by the weekly-feedback-aggregation cron job.
-- Used for drift detection and segment analysis.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_feedback_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Aggregation key
  recommendation_type TEXT NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'rule-v1',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Volume
  total_shown INTEGER NOT NULL DEFAULT 0,
  total_feedback_received INTEGER NOT NULL DEFAULT 0,
  feedback_response_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,  -- 0.0000-1.0000

  -- Acceptance metrics
  recommendations_followed INTEGER NOT NULL DEFAULT 0,
  recommendations_ignored INTEGER NOT NULL DEFAULT 0,
  recommendations_opposite INTEGER NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,         -- followed / shown

  -- Feedback sentiment
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  unfair_count INTEGER NOT NULL DEFAULT 0,
  unclear_count INTEGER NOT NULL DEFAULT 0,
  positive_feedback_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,  -- helpful / total_feedback

  -- Outcome alignment (positive feedback + positive outcome)
  aligned_positive INTEGER NOT NULL DEFAULT 0,  -- helpful feedback AND followed
  aligned_negative INTEGER NOT NULL DEFAULT 0,  -- not_helpful feedback AND ignored/opposite
  misaligned INTEGER NOT NULL DEFAULT 0,        -- helpful but ignored, or not_helpful but followed
  outcome_alignment_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0000,

  -- Drift detection
  acceptance_rate_prev_period NUMERIC(5,4),
  acceptance_rate_delta NUMERIC(5,4),
  drift_flagged BOOLEAN NOT NULL DEFAULT false,
  retraining_recommended BOOLEAN NOT NULL DEFAULT false,

  -- Segment breakdown (JSONB for flexibility)
  segment_breakdown JSONB NOT NULL DEFAULT '{}',
  -- Structure: { "by_xnscore_tier": {...}, "by_geography": {...}, "by_language": {...}, "by_tenure": {...} }

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one summary per type/version/period
ALTER TABLE model_feedback_summary
  ADD CONSTRAINT uq_feedback_summary_period
  UNIQUE (recommendation_type, model_version, period_start, period_end);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- ai_recommendation_feedback
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user
  ON ai_recommendation_feedback(user_id, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_type
  ON ai_recommendation_feedback(recommendation_type, shown_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_recommendation
  ON ai_recommendation_feedback(recommendation_id)
  WHERE recommendation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_pending_outcome
  ON ai_recommendation_feedback(outcome, shown_at)
  WHERE outcome = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_feedback_no_feedback
  ON ai_recommendation_feedback(feedback_prompt_eligible, prompt_expires_at)
  WHERE feedback IS NULL AND feedback_prompt_eligible = true;

CREATE INDEX IF NOT EXISTS idx_ai_feedback_human_review
  ON ai_recommendation_feedback(human_review_requested)
  WHERE human_review_requested = true AND human_review_resolved_at IS NULL;

-- model_feedback_summary
CREATE INDEX IF NOT EXISTS idx_feedback_summary_type
  ON model_feedback_summary(recommendation_type, period_end DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_summary_drift
  ON model_feedback_summary(drift_flagged)
  WHERE drift_flagged = true;

CREATE INDEX IF NOT EXISTS idx_feedback_summary_retraining
  ON model_feedback_summary(retraining_recommended)
  WHERE retraining_recommended = true;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE ai_recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_feedback_summary ENABLE ROW LEVEL SECURITY;

-- Members can see and submit their own feedback
CREATE POLICY "ai_feedback_select_own" ON ai_recommendation_feedback
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ai_feedback_insert_own" ON ai_recommendation_feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "ai_feedback_update_own" ON ai_recommendation_feedback
  FOR UPDATE USING (user_id = auth.uid());

-- Service role for outcome tracking, aggregation, admin
CREATE POLICY "ai_feedback_service_all" ON ai_recommendation_feedback
  FOR ALL USING (auth.role() = 'service_role');

-- model_feedback_summary: service role only (cron writes, admin reads)
CREATE POLICY "feedback_summary_service_all" ON model_feedback_summary
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE ai_recommendation_feedback;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_ai_feedback_updated_at
  BEFORE UPDATE ON ai_recommendation_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
