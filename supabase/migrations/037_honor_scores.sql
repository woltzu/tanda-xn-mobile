-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 037: Honor Score Formalization
-- ═══════════════════════════════════════════════════════════════════════════════
-- Creates honor_scores and honor_score_history tables with three-pillar scoring:
--   Community (40%), Character (35%), Track Record (25%)
-- Primary inputs: member_vouches, vouch_events, disputes, community_memberships, xn_scores
-- Integrates with daily scoring pipeline as Step 6.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: honor_scores (one row per user)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS honor_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Total score (0-100)
  total_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  previous_score DECIMAL(5,2),
  score_tier TEXT NOT NULL DEFAULT 'Provisional',
  -- Platinum (85-100), Gold (70-84), Silver (55-69), Bronze (40-54), Provisional (0-39)

  -- Pillar scores (sum to total_score)
  community_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,     -- max 40
  character_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,      -- max 35
  track_record_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,   -- max 25

  -- Community sub-components (sum to community_score, max 40)
  vouch_success_rate_score DECIMAL(5,2) DEFAULT 0.00,      -- max 20
  vouch_volume_score DECIMAL(5,2) DEFAULT 0.00,            -- max 12
  community_service_score DECIMAL(5,2) DEFAULT 0.00,       -- max 8

  -- Character sub-components (sum to character_score, max 35)
  mediation_resolution_score DECIMAL(5,2) DEFAULT 0.00,    -- max 18
  dispute_handling_score DECIMAL(5,2) DEFAULT 0.00,        -- max 10
  fairness_score DECIMAL(5,2) DEFAULT 0.00,                -- max 7

  -- Track Record sub-components (sum to track_record_score, max 25)
  circles_completed_score DECIMAL(5,2) DEFAULT 0.00,       -- max 10
  payment_reliability_score DECIMAL(5,2) DEFAULT 0.00,     -- max 10
  elder_tenure_score DECIMAL(5,2) DEFAULT 0.00,            -- max 5

  -- Audit
  input_snapshot JSONB DEFAULT '{}',
  computation_trigger TEXT,  -- 'pipeline', 'on_demand', 'event'

  last_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: honor_score_history (append-only audit trail)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS honor_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  score DECIMAL(5,2) NOT NULL,
  previous_score DECIMAL(5,2),
  score_change DECIMAL(5,2) NOT NULL,

  trigger_event TEXT NOT NULL,
  -- 'pipeline_recompute', 'vouch_created', 'vouch_defaulted', 'case_resolved',
  -- 'training_completed', 'circle_completed', 'dispute_filed_against', 'initial_computation'
  trigger_id UUID,
  trigger_details TEXT,

  pillar_breakdown JSONB NOT NULL DEFAULT '{}',
  -- { "community": 32.5, "character": 28.0, "track_record": 22.0 }

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_honor_scores_user ON honor_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_honor_scores_tier ON honor_scores(score_tier);
CREATE INDEX IF NOT EXISTS idx_honor_scores_total ON honor_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_honor_scores_updated ON honor_scores(updated_at);

CREATE INDEX IF NOT EXISTS idx_honor_history_user_date ON honor_score_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_honor_history_trigger ON honor_score_history(trigger_event);


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE honor_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE honor_score_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own honor score
CREATE POLICY "honor_scores_select_own" ON honor_scores
  FOR SELECT USING (user_id = auth.uid());

-- Elders/admins can read community members' scores
CREATE POLICY "honor_scores_select_community" ON honor_scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
  );

-- Service role can do everything (for pipeline)
CREATE POLICY "honor_scores_service_all" ON honor_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Users can read their own history
CREATE POLICY "honor_history_select_own" ON honor_score_history
  FOR SELECT USING (user_id = auth.uid());

-- Service role can do everything
CREATE POLICY "honor_history_service_all" ON honor_score_history
  FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE honor_scores;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER: updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER honor_scores_updated_at
  BEFORE UPDATE ON honor_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_honor_score(p_user_id UUID)
-- Three-pillar computation: Community (40), Character (35), Track Record (25)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_honor_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  -- Community pillar (40 pts max)
  v_vouch_success_rate_score DECIMAL(5,2) := 0;
  v_vouch_volume_score DECIMAL(5,2) := 0;
  v_community_service_score DECIMAL(5,2) := 0;
  v_community_score DECIMAL(5,2) := 0;

  -- Character pillar (35 pts max)
  v_mediation_resolution_score DECIMAL(5,2) := 0;
  v_dispute_handling_score DECIMAL(5,2) := 0;
  v_fairness_score DECIMAL(5,2) := 0;
  v_character_score DECIMAL(5,2) := 0;

  -- Track Record pillar (25 pts max)
  v_circles_completed_score DECIMAL(5,2) := 0;
  v_payment_reliability_score DECIMAL(5,2) := 0;
  v_elder_tenure_score DECIMAL(5,2) := 0;
  v_track_record_score DECIMAL(5,2) := 0;

  v_total_score DECIMAL(5,2) := 0;
  v_previous_score DECIMAL(5,2);
  v_score_tier TEXT;
  v_input_snapshot JSONB := '{}';

  -- Working variables
  v_total_vouches INTEGER := 0;
  v_active_vouches INTEGER := 0;
  v_defaulted_vouches INTEGER := 0;
  v_vouch_rate DECIMAL := 0;
  v_training_completed INTEGER := 0;
  v_council_votes INTEGER := 0;
  v_critical_resolved INTEGER := 0;
  v_high_resolved INTEGER := 0;
  v_medium_resolved INTEGER := 0;
  v_total_cases_resolved INTEGER := 0;
  v_total_cases_assigned INTEGER := 0;
  v_escalated_cases INTEGER := 0;
  v_disputes_against INTEGER := 0;
  v_circles_completed INTEGER := 0;
  v_on_time_pct DECIMAL := 0;
  v_elder_months INTEGER := 0;
BEGIN
  -- ══════════════════════════════════════════════════
  -- COMMUNITY PILLAR (40 pts max)
  -- ══════════════════════════════════════════════════

  -- A. Vouch success rate (max 20 pts)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('active', 'expired')),
    COUNT(*) FILTER (WHERE status = 'invalidated_by_default')
  INTO v_total_vouches, v_active_vouches, v_defaulted_vouches
  FROM member_vouches
  WHERE voucher_user_id = p_user_id;

  IF v_total_vouches > 0 THEN
    v_vouch_rate := v_active_vouches::DECIMAL / v_total_vouches;
    v_vouch_success_rate_score := LEAST(20, ROUND(v_vouch_rate * 20, 2));
  ELSE
    -- No vouches yet: baseline 5/20 (not penalized for being new)
    v_vouch_success_rate_score := 5;
  END IF;

  -- B. Vouch volume (max 12 pts)
  -- Scale: 1.5 pts per successful vouch, capped at 12
  v_vouch_volume_score := LEAST(12, ROUND(v_active_vouches * 1.5, 2));

  -- C. Community service (max 8 pts)
  -- Training: count completed courses from training_progress JSONB (max 5, 1pt each)
  SELECT
    COALESCE(
      (SELECT COUNT(*)
       FROM jsonb_each(COALESCE(cm.training_progress, '{}'::jsonb)) kv
       WHERE (kv.value->>'completed')::boolean = true
      ), 0
    )
  INTO v_training_completed
  FROM community_memberships cm
  WHERE cm.user_id = p_user_id AND cm.status = 'active'
  LIMIT 1;

  -- Council votes (max 3, 0.5pt each)
  SELECT COUNT(*) INTO v_council_votes
  FROM elder_vote_records
  WHERE elder_user_id = p_user_id;

  v_community_service_score := LEAST(5, COALESCE(v_training_completed, 0))
                              + LEAST(3, ROUND(COALESCE(v_council_votes, 0) * 0.5, 2));

  v_community_score := v_vouch_success_rate_score + v_vouch_volume_score + v_community_service_score;

  -- ══════════════════════════════════════════════════
  -- CHARACTER PILLAR (35 pts max)
  -- ══════════════════════════════════════════════════

  -- A. Mediation resolution (max 18 pts)
  -- Weighted by priority: critical=3, high=2, medium/low=1
  SELECT
    COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'resolved'),
    COUNT(*) FILTER (WHERE priority = 'high' AND status = 'resolved'),
    COUNT(*) FILTER (WHERE priority IN ('medium', 'low') AND status = 'resolved'),
    COUNT(*) FILTER (WHERE status = 'resolved'),
    COUNT(*)
  INTO v_critical_resolved, v_high_resolved, v_medium_resolved, v_total_cases_resolved, v_total_cases_assigned
  FROM disputes
  WHERE assigned_to = p_user_id;

  v_mediation_resolution_score := LEAST(18,
    (v_critical_resolved * 3) + (v_high_resolved * 2) + (v_medium_resolved * 1)
  );

  -- B. Dispute handling quality (max 10 pts)
  IF v_total_cases_assigned > 0 THEN
    -- Resolution rate component (max 7)
    v_dispute_handling_score := ROUND(
      (v_total_cases_resolved::DECIMAL / v_total_cases_assigned) * 7, 2
    );

    -- Low escalation bonus (max 3)
    SELECT COUNT(*) INTO v_escalated_cases
    FROM disputes
    WHERE assigned_to = p_user_id AND status = 'escalated';

    v_dispute_handling_score := v_dispute_handling_score +
      LEAST(3, ROUND(3 * (1 - v_escalated_cases::DECIMAL / v_total_cases_assigned), 2));

    v_dispute_handling_score := LEAST(10, v_dispute_handling_score);
  ELSE
    -- No cases assigned: baseline 3/10
    v_dispute_handling_score := 3;
  END IF;

  -- C. Fairness (max 7 pts)
  -- Start at 7, deduct 2 per non-dismissed dispute filed against the user
  SELECT COUNT(*) INTO v_disputes_against
  FROM disputes
  WHERE against_user_id = p_user_id
    AND status NOT IN ('dismissed');

  v_fairness_score := GREATEST(0, 7 - (v_disputes_against * 2));

  v_character_score := v_mediation_resolution_score + v_dispute_handling_score + v_fairness_score;

  -- ══════════════════════════════════════════════════
  -- TRACK RECORD PILLAR (25 pts max)
  -- ══════════════════════════════════════════════════

  -- A. Circles completed (max 10 pts, 1pt each)
  SELECT COALESCE(circles_completed, 0) INTO v_circles_completed
  FROM community_memberships
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  v_circles_completed_score := LEAST(10, COALESCE(v_circles_completed, 0));

  -- B. Payment reliability (max 10 pts)
  -- from xn_scores.on_time_payment_pct (0-100) → scale to 0-10
  SELECT COALESCE(on_time_payment_pct, 0) INTO v_on_time_pct
  FROM xn_scores
  WHERE user_id = p_user_id;

  v_payment_reliability_score := ROUND(COALESCE(v_on_time_pct, 0) / 10, 2);

  -- C. Elder tenure (max 5 pts, 1pt per month as elder)
  SELECT COALESCE(
    EXTRACT(MONTH FROM AGE(NOW(), elder_approved_at))::INTEGER, 0
  ) INTO v_elder_months
  FROM community_memberships
  WHERE user_id = p_user_id AND status = 'active' AND role = 'elder'
  LIMIT 1;

  v_elder_tenure_score := LEAST(5, COALESCE(v_elder_months, 0));

  v_track_record_score := v_circles_completed_score + v_payment_reliability_score + v_elder_tenure_score;

  -- ══════════════════════════════════════════════════
  -- TOTAL SCORE + TIER
  -- ══════════════════════════════════════════════════

  v_total_score := LEAST(100, v_community_score + v_character_score + v_track_record_score);

  v_score_tier := CASE
    WHEN v_total_score >= 85 THEN 'Platinum'
    WHEN v_total_score >= 70 THEN 'Gold'
    WHEN v_total_score >= 55 THEN 'Silver'
    WHEN v_total_score >= 40 THEN 'Bronze'
    ELSE 'Provisional'
  END;

  -- Build input snapshot for audit
  v_input_snapshot := jsonb_build_object(
    'vouches_given', v_total_vouches,
    'active_vouches', v_active_vouches,
    'defaulted_vouches', v_defaulted_vouches,
    'vouch_success_rate', ROUND(v_vouch_rate, 4),
    'training_completed', v_training_completed,
    'council_votes', v_council_votes,
    'critical_cases_resolved', v_critical_resolved,
    'high_cases_resolved', v_high_resolved,
    'medium_cases_resolved', v_medium_resolved,
    'total_cases_assigned', v_total_cases_assigned,
    'escalated_cases', v_escalated_cases,
    'disputes_against', v_disputes_against,
    'circles_completed', v_circles_completed,
    'on_time_payment_pct', v_on_time_pct,
    'elder_months', v_elder_months
  );

  -- Get previous score for history
  SELECT total_score INTO v_previous_score FROM honor_scores WHERE user_id = p_user_id;

  -- ══════════════════════════════════════════════════
  -- UPSERT honor_scores
  -- ══════════════════════════════════════════════════

  INSERT INTO honor_scores (
    user_id, total_score, previous_score, score_tier,
    community_score, character_score, track_record_score,
    vouch_success_rate_score, vouch_volume_score, community_service_score,
    mediation_resolution_score, dispute_handling_score, fairness_score,
    circles_completed_score, payment_reliability_score, elder_tenure_score,
    input_snapshot, computation_trigger, last_computed_at
  ) VALUES (
    p_user_id, v_total_score, v_previous_score, v_score_tier,
    v_community_score, v_character_score, v_track_record_score,
    v_vouch_success_rate_score, v_vouch_volume_score, v_community_service_score,
    v_mediation_resolution_score, v_dispute_handling_score, v_fairness_score,
    v_circles_completed_score, v_payment_reliability_score, v_elder_tenure_score,
    v_input_snapshot, 'pipeline', NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_score = EXCLUDED.total_score,
    previous_score = honor_scores.total_score,
    score_tier = EXCLUDED.score_tier,
    community_score = EXCLUDED.community_score,
    character_score = EXCLUDED.character_score,
    track_record_score = EXCLUDED.track_record_score,
    vouch_success_rate_score = EXCLUDED.vouch_success_rate_score,
    vouch_volume_score = EXCLUDED.vouch_volume_score,
    community_service_score = EXCLUDED.community_service_score,
    mediation_resolution_score = EXCLUDED.mediation_resolution_score,
    dispute_handling_score = EXCLUDED.dispute_handling_score,
    fairness_score = EXCLUDED.fairness_score,
    circles_completed_score = EXCLUDED.circles_completed_score,
    payment_reliability_score = EXCLUDED.payment_reliability_score,
    elder_tenure_score = EXCLUDED.elder_tenure_score,
    input_snapshot = EXCLUDED.input_snapshot,
    computation_trigger = EXCLUDED.computation_trigger,
    last_computed_at = NOW(),
    updated_at = NOW();

  -- ══════════════════════════════════════════════════
  -- APPEND to history (only if score changed)
  -- ══════════════════════════════════════════════════

  IF v_previous_score IS NULL OR v_previous_score != v_total_score THEN
    INSERT INTO honor_score_history (
      user_id, score, previous_score, score_change,
      trigger_event, trigger_details, pillar_breakdown
    ) VALUES (
      p_user_id, v_total_score, COALESCE(v_previous_score, 0),
      v_total_score - COALESCE(v_previous_score, 0),
      'pipeline_recompute', 'Daily pipeline computation',
      jsonb_build_object(
        'community', v_community_score,
        'character', v_character_score,
        'track_record', v_track_record_score
      )
    );
  END IF;

  -- ══════════════════════════════════════════════════
  -- SYNC back to community_memberships.honor_score
  -- (keeps denormalized column working for backward compat)
  -- ══════════════════════════════════════════════════

  UPDATE community_memberships
  SET honor_score = ROUND(v_total_score)::INTEGER,
      updated_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';

  RETURN v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: compute_all_honor_scores()
-- Batch wrapper: computes honor score for all active community members.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_all_honor_scores()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM community_memberships
    WHERE status = 'active'
  LOOP
    BEGIN
      PERFORM compute_honor_score(v_user.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'compute_honor_score failed for user %: %', v_user.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PIPELINE INTEGRATION: Add Step 6 to run_scoring_pipeline()
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add honor_scores_computed column to pipeline runs
ALTER TABLE scoring_pipeline_runs
  ADD COLUMN IF NOT EXISTS honor_scores_computed INTEGER DEFAULT 0;

-- Replace run_scoring_pipeline with version that includes Step 6
CREATE OR REPLACE FUNCTION run_scoring_pipeline()
RETURNS JSONB AS $$
DECLARE
  v_run_id UUID;
  v_profiles INTEGER := 0;
  v_defaults INTEGER := 0;
  v_circles INTEGER := 0;
  v_xnscores INTEGER := 0;
  v_alerts INTEGER := 0;
  v_honor INTEGER := 0;
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

  -- ── Step 2: Compute default probabilities ──
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

  -- ── Step 3: Compute circle health scores ──
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

  -- ── Step 4: Recalculate XnScores ──
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

  -- ── Step 5: Evaluate alerts ──
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

  -- ── Step 6: Compute Honor Scores [NEW - migration 037] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_honor_scores() INTO v_honor;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'honor_scores', 'error', SQLERRM);
    v_honor := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'honor_scores_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Finalize pipeline run ──
  UPDATE scoring_pipeline_runs SET
    profiles_computed = v_profiles,
    default_probs_computed = v_defaults,
    circle_scores_computed = v_circles,
    xnscores_recalculated = v_xnscores,
    alerts_generated = v_alerts,
    honor_scores_computed = v_honor,
    step_timings = v_step_timings,
    total_duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    status = CASE
      WHEN v_errors = '[]'::JSONB THEN 'completed'
      WHEN v_profiles + v_defaults + v_circles + v_xnscores + v_honor > 0 THEN 'partial'
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
    'honor_scores', v_honor,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
