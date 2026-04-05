-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 040: Graduated Entry System
-- ═══════════════════════════════════════════════════════════════════════════════
-- New members progress through defined tiers based on demonstrated behavior,
-- unlocking access to larger circles, higher contributions, and more features.
--
-- Sits ON TOP of the existing XnScore tier system (migrations 019-021).
-- XnScore tier names (critical/poor/fair/good/excellent/elite) map to
-- user-facing names (Critical/Newcomer/Established/Trusted/Elder/Elite).
--
-- Tables:
--   1. graduated_entry_tiers     — Reference config (6 seeded rows)
--   2. member_tier_status        — Current tier per user + limits + progress
--   3. member_tier_history       — Append-only tier change audit
--   4. fast_track_applications   — External trust signal evaluation
--
-- Functions:
--   1. evaluate_member_tier()    — Core tier evaluation per user
--   2. evaluate_all_member_tiers() — Batch wrapper for pipeline
--
-- Pipeline: Adds Step 7 to run_scoring_pipeline()
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: graduated_entry_tiers (reference/config — 6 seeded rows)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS graduated_entry_tiers (
  tier_key TEXT PRIMARY KEY,
  tier_number INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  xn_score_min INTEGER NOT NULL,
  xn_score_max INTEGER NOT NULL,

  -- Access limits
  max_circle_size INTEGER,               -- NULL = unlimited; 0 = cannot join
  max_contribution_cents INTEGER,         -- NULL = unlimited; 0 = cannot contribute
  position_access TEXT NOT NULL DEFAULT 'any'
    CHECK (position_access IN ('none', 'middle_only', 'any')),

  -- Time requirements
  min_account_age_days INTEGER NOT NULL DEFAULT 0,

  -- Feature summary
  features_summary TEXT,

  -- Fast-track
  fast_track_eligible BOOLEAN NOT NULL DEFAULT false,
  fast_track_min_days INTEGER,

  -- Display
  icon TEXT NOT NULL DEFAULT '🔵',
  color TEXT NOT NULL DEFAULT '#6B7280',
  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA: 6 tiers matching vision spec
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO graduated_entry_tiers (tier_key, tier_number, label, xn_score_min, xn_score_max,
  max_circle_size, max_contribution_cents, position_access, min_account_age_days,
  features_summary, fast_track_eligible, fast_track_min_days, icon, color, description)
VALUES
  ('critical', 0, 'Critical', 0, 24,
    0, 0, 'none', 0,
    'Observe only — cannot join or create circles',
    false, NULL, '🚫', '#991B1B',
    'Account restricted. Build your XnScore through verification and engagement.'),

  ('newcomer', 1, 'Newcomer', 25, 44,
    5, 10000, 'middle_only', 0,
    'Basic circles, savings goals, financial coaching',
    true, 45, '🌱', '#EF4444',
    'First 90 days. Small circles, limited contributions. Prove your reliability.'),

  ('established', 2, 'Established', 45, 59,
    10, 50000, 'any', 90,
    'Liquidity advance, referral program, marketplace basic',
    false, NULL, '⚡', '#F59E0B',
    '90+ days with clean history. Standard access, higher limits.'),

  ('trusted', 3, 'Trusted', 60, 74,
    20, 200000, 'any', 365,
    'Full marketplace, circle admin, matching pool',
    false, NULL, '✓', '#10B981',
    '12+ months, multiple completed circles. Full access and admin privileges.'),

  ('elder', 4, 'Elder', 75, 89,
    NULL, NULL, 'any', 730,
    'All features, governance privileges, reduced fees',
    false, NULL, '🏆', '#8B5CF6',
    '24+ months, exemplary history. No limits, Elder governance rights.'),

  ('elite', 5, 'Elite', 90, 100,
    NULL, NULL, 'any', 730,
    'All features, lowest fees, maximum trust, community leadership',
    false, NULL, '⭐', '#FFD700',
    'Reserved for long-term exemplary members. Maximum platform trust.')
ON CONFLICT (tier_key) DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: member_tier_status (one row per user)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_tier_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id),
  current_tier TEXT NOT NULL DEFAULT 'critical' REFERENCES graduated_entry_tiers(tier_key),
  tier_number INTEGER NOT NULL DEFAULT 0,
  previous_tier TEXT REFERENCES graduated_entry_tiers(tier_key),
  tier_achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Fast-track
  is_fast_tracked BOOLEAN NOT NULL DEFAULT false,
  fast_track_approved_at TIMESTAMPTZ,

  -- Demotion
  is_demoted BOOLEAN NOT NULL DEFAULT false,
  demotion_reason TEXT,
  demotion_path_back TEXT,

  -- Denormalized limits (from tier definition, for quick access)
  max_circle_size INTEGER,
  max_contribution_cents INTEGER,
  position_access TEXT NOT NULL DEFAULT 'none',

  -- Progress snapshot (updated by evaluate function)
  xn_score_at_eval INTEGER NOT NULL DEFAULT 0,
  account_age_at_eval INTEGER NOT NULL DEFAULT 0,
  circles_completed_at_eval INTEGER NOT NULL DEFAULT 0,
  next_tier TEXT REFERENCES graduated_entry_tiers(tier_key),
  progress_pct INTEGER NOT NULL DEFAULT 0,
  action_items JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: member_tier_history (append-only audit)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS member_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  from_tier TEXT REFERENCES graduated_entry_tiers(tier_key),
  to_tier TEXT NOT NULL REFERENCES graduated_entry_tiers(tier_key),
  change_type TEXT NOT NULL CHECK (change_type IN (
    'initial', 'advancement', 'demotion', 'fast_track', 'manual'
  )),
  reason TEXT,
  xn_score INTEGER NOT NULL DEFAULT 0,
  account_age_days INTEGER NOT NULL DEFAULT 0,
  circles_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: fast_track_applications
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fast_track_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'expired'
  )),

  -- Trust signals
  trust_signals JSONB NOT NULL DEFAULT '{}',
  plaid_account_age_days INTEGER,
  plaid_balance_healthy BOOLEAN,
  credit_score_verified INTEGER,
  employer_verified BOOLEAN NOT NULL DEFAULT false,
  platform_history_imported BOOLEAN NOT NULL DEFAULT false,

  -- Review
  review_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,

  -- Timeline override
  original_tier1_end_date DATE,
  accelerated_tier1_end_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tier_status_user ON member_tier_status(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_status_tier ON member_tier_status(current_tier);
CREATE INDEX IF NOT EXISTS idx_tier_history_user ON member_tier_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_history_created ON member_tier_history(created_at);
CREATE INDEX IF NOT EXISTS idx_fast_track_user ON fast_track_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_fast_track_status ON fast_track_applications(status);
CREATE INDEX IF NOT EXISTS idx_fast_track_pending ON fast_track_applications(status)
  WHERE status = 'pending';


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE graduated_entry_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tier_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_track_applications ENABLE ROW LEVEL SECURITY;

-- graduated_entry_tiers: all authenticated users can read (reference table)
CREATE POLICY "tiers_select_authenticated" ON graduated_entry_tiers
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tiers_service_all" ON graduated_entry_tiers
  FOR ALL USING (auth.role() = 'service_role');

-- member_tier_status: own row SELECT, service role ALL
CREATE POLICY "tier_status_select_own" ON member_tier_status
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tier_status_service_all" ON member_tier_status
  FOR ALL USING (auth.role() = 'service_role');

-- member_tier_history: own rows SELECT, service role ALL
CREATE POLICY "tier_history_select_own" ON member_tier_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tier_history_service_all" ON member_tier_history
  FOR ALL USING (auth.role() = 'service_role');

-- fast_track_applications: own SELECT + INSERT, service role ALL
CREATE POLICY "fast_track_select_own" ON fast_track_applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "fast_track_insert_own" ON fast_track_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "fast_track_service_all" ON fast_track_applications
  FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE member_tier_status;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER member_tier_status_updated_at
  BEFORE UPDATE ON member_tier_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER fast_track_applications_updated_at
  BEFORE UPDATE ON fast_track_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: evaluate_member_tier(p_user_id UUID)
-- Core evaluation: reads XnScore + profile → determines tier → upserts status
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION evaluate_member_tier(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_xn RECORD;
  v_profile RECORD;
  v_current RECORD;
  v_tier RECORD;
  v_new_tier_key TEXT;
  v_new_tier_number INTEGER;
  v_previous_tier TEXT;
  v_changed BOOLEAN := false;
  v_change_type TEXT;
  v_reason TEXT;
  v_next_tier RECORD;
  v_progress_pct INTEGER := 0;
  v_action_items JSONB := '[]';
  v_score INTEGER;
  v_age INTEGER;
  v_completed INTEGER;
  v_defaults INTEGER;
BEGIN
  -- ── Read XnScore ──
  SELECT total_score, account_age_days
  INTO v_xn
  FROM xn_scores
  WHERE user_id = p_user_id;

  IF v_xn IS NULL THEN
    -- No XnScore yet → default to critical
    v_score := 0;
    v_age := 0;
  ELSE
    v_score := COALESCE(ROUND(v_xn.total_score), 0);
    v_age := COALESCE(v_xn.account_age_days, 0);
  END IF;

  -- ── Read behavioral profile ──
  SELECT circles_completed, default_count
  INTO v_profile
  FROM member_behavioral_profiles
  WHERE user_id = p_user_id;

  v_completed := COALESCE(v_profile.circles_completed, 0);
  v_defaults := COALESCE(v_profile.default_count, 0);

  -- ── Determine tier from score ──
  SELECT * INTO v_tier
  FROM graduated_entry_tiers
  WHERE v_score >= xn_score_min AND v_score <= xn_score_max
  ORDER BY tier_number DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'critical';
  END IF;

  v_new_tier_key := v_tier.tier_key;
  v_new_tier_number := v_tier.tier_number;

  -- ── Get current status ──
  SELECT * INTO v_current FROM member_tier_status WHERE user_id = p_user_id;

  -- ── Determine if tier changed ──
  IF v_current IS NULL THEN
    -- First evaluation → initial assignment
    v_changed := true;
    v_change_type := 'initial';
    v_previous_tier := NULL;
    v_reason := format('Initial tier assignment: %s (XnScore %s)', v_tier.label, v_score);
  ELSIF v_current.current_tier != v_new_tier_key THEN
    v_changed := true;
    v_previous_tier := v_current.current_tier;

    IF v_new_tier_number > v_current.tier_number THEN
      v_change_type := 'advancement';
      v_reason := format('Advanced from %s to %s (XnScore %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    ELSE
      v_change_type := 'demotion';
      v_reason := format('Demoted from %s to %s (XnScore dropped to %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    END IF;
  ELSE
    v_previous_tier := v_current.previous_tier;
  END IF;

  -- ── Compute progress to next tier ──
  SELECT * INTO v_next_tier
  FROM graduated_entry_tiers
  WHERE tier_number = v_new_tier_number + 1;

  IF v_next_tier IS NOT NULL THEN
    -- Progress = how far through current tier score range toward next
    IF (v_next_tier.xn_score_min - v_tier.xn_score_min) > 0 THEN
      v_progress_pct := LEAST(100, GREATEST(0,
        ROUND(((v_score - v_tier.xn_score_min)::DECIMAL / (v_next_tier.xn_score_min - v_tier.xn_score_min)) * 100)
      ));
    END IF;

    -- ── Build action items ──
    -- Score gap
    IF v_score < v_next_tier.xn_score_min THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'xn_score',
        'message', format('Earn %s more XnScore points to reach %s',
          v_next_tier.xn_score_min - v_score, v_next_tier.label),
        'current', v_score,
        'required', v_next_tier.xn_score_min
      );
    END IF;

    -- Account age gap
    IF v_age < v_next_tier.min_account_age_days THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'account_age',
        'message', format('%s more days on platform needed for %s',
          v_next_tier.min_account_age_days - v_age, v_next_tier.label),
        'current', v_age,
        'required', v_next_tier.min_account_age_days
      );
    END IF;
  ELSE
    v_progress_pct := 100; -- Already at max tier
  END IF;

  -- ── UPSERT member_tier_status ──
  INSERT INTO member_tier_status (
    user_id, current_tier, tier_number, previous_tier, tier_achieved_at,
    is_demoted, demotion_reason, demotion_path_back,
    max_circle_size, max_contribution_cents, position_access,
    xn_score_at_eval, account_age_at_eval, circles_completed_at_eval,
    next_tier, progress_pct, action_items
  ) VALUES (
    p_user_id, v_new_tier_key, v_new_tier_number, v_previous_tier,
    CASE WHEN v_changed THEN NOW() ELSE COALESCE(v_current.tier_achieved_at, NOW()) END,
    CASE WHEN v_change_type = 'demotion' THEN true ELSE false END,
    CASE WHEN v_change_type = 'demotion' THEN v_reason ELSE NULL END,
    CASE WHEN v_change_type = 'demotion' THEN
      format('Raise your XnScore back to %s to regain %s status',
        v_tier.xn_score_min + (v_next_tier.xn_score_min - v_tier.xn_score_min),
        COALESCE(v_previous_tier, v_new_tier_key))
    ELSE NULL END,
    v_tier.max_circle_size, v_tier.max_contribution_cents, v_tier.position_access,
    v_score, v_age, v_completed,
    CASE WHEN v_next_tier IS NOT NULL THEN v_next_tier.tier_key ELSE NULL END,
    v_progress_pct, v_action_items
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier = EXCLUDED.current_tier,
    tier_number = EXCLUDED.tier_number,
    previous_tier = CASE WHEN v_changed THEN v_previous_tier ELSE member_tier_status.previous_tier END,
    tier_achieved_at = CASE WHEN v_changed THEN NOW() ELSE member_tier_status.tier_achieved_at END,
    is_demoted = EXCLUDED.is_demoted,
    demotion_reason = EXCLUDED.demotion_reason,
    demotion_path_back = EXCLUDED.demotion_path_back,
    max_circle_size = EXCLUDED.max_circle_size,
    max_contribution_cents = EXCLUDED.max_contribution_cents,
    position_access = EXCLUDED.position_access,
    xn_score_at_eval = EXCLUDED.xn_score_at_eval,
    account_age_at_eval = EXCLUDED.account_age_at_eval,
    circles_completed_at_eval = EXCLUDED.circles_completed_at_eval,
    next_tier = EXCLUDED.next_tier,
    progress_pct = EXCLUDED.progress_pct,
    action_items = EXCLUDED.action_items,
    updated_at = NOW();

  -- ── Record tier change in history ──
  IF v_changed THEN
    INSERT INTO member_tier_history (
      user_id, from_tier, to_tier, change_type, reason,
      xn_score, account_age_days, circles_completed
    ) VALUES (
      p_user_id, v_previous_tier, v_new_tier_key, v_change_type, v_reason,
      v_score, v_age, v_completed
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'previous_tier', v_previous_tier,
    'new_tier', v_new_tier_key,
    'tier_number', v_new_tier_number,
    'changed', v_changed,
    'change_type', COALESCE(v_change_type, 'none'),
    'xn_score', v_score,
    'account_age', v_age,
    'circles_completed', v_completed,
    'progress_pct', v_progress_pct,
    'max_circle_size', v_tier.max_circle_size,
    'max_contribution_cents', v_tier.max_contribution_cents,
    'position_access', v_tier.position_access
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: evaluate_all_member_tiers()
-- Batch wrapper for pipeline Step 7.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION evaluate_all_member_tiers()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id FROM xn_scores
  LOOP
    BEGIN
      PERFORM evaluate_member_tier(v_user.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'evaluate_member_tier failed for user %: %', v_user.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PIPELINE INTEGRATION: Add Step 7 to run_scoring_pipeline()
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add tiers_evaluated column to pipeline runs
ALTER TABLE scoring_pipeline_runs
  ADD COLUMN IF NOT EXISTS tiers_evaluated INTEGER DEFAULT 0;

-- Rewrite run_scoring_pipeline with Step 7
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
  v_tiers INTEGER := 0;
  v_step_timings JSONB := '{}';
  v_errors JSONB := '[]';
  v_step_start TIMESTAMPTZ;
  v_pipeline_start TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Create pipeline run record
  INSERT INTO scoring_pipeline_runs (run_date, status, started_at)
  VALUES (CURRENT_DATE, 'running', NOW())
  RETURNING id INTO v_run_id;

  -- ── Step 1: Recompute member profiles ──
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

  -- ── Step 6: Compute Honor Scores [migration 037] ──
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

  -- ── Step 7: Evaluate Graduated Entry Tiers [NEW - migration 040] ──
  v_step_start := clock_timestamp();
  BEGIN
    SELECT evaluate_all_member_tiers() INTO v_tiers;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'tiers', 'error', SQLERRM);
    v_tiers := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'tiers_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  -- ── Finalize pipeline run ──
  UPDATE scoring_pipeline_runs SET
    profiles_computed = v_profiles,
    default_probs_computed = v_defaults,
    circle_scores_computed = v_circles,
    xnscores_recalculated = v_xnscores,
    alerts_generated = v_alerts,
    honor_scores_computed = v_honor,
    tiers_evaluated = v_tiers,
    step_timings = v_step_timings,
    total_duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    status = CASE
      WHEN v_errors = '[]'::JSONB THEN 'completed'
      WHEN v_profiles + v_defaults + v_circles + v_xnscores + v_honor + v_tiers > 0 THEN 'partial'
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
    'tiers', v_tiers,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
