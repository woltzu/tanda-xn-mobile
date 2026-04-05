-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 038: Honor Score Realignment to Vision v3.0
-- ═══════════════════════════════════════════════════════════════════════════════
-- Realigns pillar structure from Community(40)/Character(35)/Track Record(25)
-- to Community(30)/Character(40)/Expertise(30) per the vision document.
--
-- Changes:
--   1. New tables: expertise_domains, user_expertise, elder_endorsements
--   2. ALTER honor_scores: rename track_record_score → expertise_score,
--      drop 9 old sub-components, add 7 new sub-components
--   3. Migrate existing tier names to Novice/Trusted/Respected/Elder/Grand Elder
--   4. Rewrite compute_honor_score() with vision-aligned pillar logic
--
-- Character is the HEART — vouching-centric with asymmetric risk (+5/-10).
-- Starting score for new members ≈ 20 (Novice tier).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: New Tables
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── expertise_domains (reference table, 8 domains) ─────────────────────────

CREATE TABLE IF NOT EXISTS expertise_domains (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  max_score DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 8 domains from the vision document
INSERT INTO expertise_domains (id, label, description) VALUES
  ('travel', 'Travel', 'Travel-related circles and services'),
  ('real_estate', 'Real Estate', 'Property transactions and housing circles'),
  ('business', 'Business', 'Business ventures and entrepreneurship circles'),
  ('education', 'Education', 'Educational programs and scholarship circles'),
  ('family', 'Family', 'Family support and welfare circles'),
  ('health', 'Health', 'Health and medical expense circles'),
  ('immigration', 'Immigration', 'Immigration assistance and relocation circles'),
  ('general', 'General', 'General community service and multi-domain')
ON CONFLICT (id) DO NOTHING;


-- ── user_expertise (per-user per-domain scores) ────────────────────────────

CREATE TABLE IF NOT EXISTS user_expertise (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES expertise_domains(id) ON DELETE CASCADE,

  -- Sub-component scores within each domain
  training_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,      -- max 10 (courses completed in domain)
  mediation_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,     -- max 10 (cases mediated in domain)
  facilitation_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,  -- max 9  (circles facilitated in domain)
  endorsement_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,   -- max 5  (peer endorsements in domain)

  -- Computed total: capped at 30
  total_domain_score DECIMAL(5,2) GENERATED ALWAYS AS (
    LEAST(30, training_score + mediation_score + facilitation_score + endorsement_score)
  ) STORED,

  UNIQUE(user_id, domain_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── elder_endorsements (peer endorsements for expertise) ───────────────────

CREATE TABLE IF NOT EXISTS elder_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endorser_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endorsed_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES expertise_domains(id) ON DELETE CASCADE,
  weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,

  -- One endorsement per endorser+endorsed+domain
  UNIQUE(endorser_user_id, endorsed_user_id, domain_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent self-endorsement
ALTER TABLE elder_endorsements
  ADD CONSTRAINT no_self_endorsement CHECK (endorser_user_id != endorsed_user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1B: Indexes for New Tables
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_user_expertise_user ON user_expertise(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expertise_domain ON user_expertise(domain_id);
CREATE INDEX IF NOT EXISTS idx_user_expertise_total ON user_expertise(user_id, total_domain_score DESC);

CREATE INDEX IF NOT EXISTS idx_elder_endorsements_endorsed ON elder_endorsements(endorsed_user_id);
CREATE INDEX IF NOT EXISTS idx_elder_endorsements_endorser ON elder_endorsements(endorser_user_id);
CREATE INDEX IF NOT EXISTS idx_elder_endorsements_domain ON elder_endorsements(endorsed_user_id, domain_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1C: RLS for New Tables
-- ═══════════════════════════════════════════════════════════════════════════════

-- expertise_domains: public read (reference data)
ALTER TABLE expertise_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expertise_domains_select_all" ON expertise_domains
  FOR SELECT USING (true);

CREATE POLICY "expertise_domains_service_all" ON expertise_domains
  FOR ALL USING (auth.role() = 'service_role');


-- user_expertise: own-read + service-role-all
ALTER TABLE user_expertise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_expertise_select_own" ON user_expertise
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_expertise_select_community" ON user_expertise
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
  );

CREATE POLICY "user_expertise_service_all" ON user_expertise
  FOR ALL USING (auth.role() = 'service_role');


-- elder_endorsements: own-read + service-role-all
ALTER TABLE elder_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elder_endorsements_select_own" ON elder_endorsements
  FOR SELECT USING (
    endorser_user_id = auth.uid() OR endorsed_user_id = auth.uid()
  );

CREATE POLICY "elder_endorsements_insert_endorser" ON elder_endorsements
  FOR INSERT WITH CHECK (endorser_user_id = auth.uid());

CREATE POLICY "elder_endorsements_service_all" ON elder_endorsements
  FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1D: Triggers for New Tables
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER user_expertise_updated_at
  BEFORE UPDATE ON user_expertise
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: ALTER honor_scores Table
-- ═══════════════════════════════════════════════════════════════════════════════

-- Rename Track Record → Expertise
ALTER TABLE honor_scores RENAME COLUMN track_record_score TO expertise_score;

-- Drop old sub-components (9 columns)
ALTER TABLE honor_scores
  DROP COLUMN IF EXISTS vouch_success_rate_score,
  DROP COLUMN IF EXISTS vouch_volume_score,
  DROP COLUMN IF EXISTS community_service_score,
  DROP COLUMN IF EXISTS mediation_resolution_score,
  DROP COLUMN IF EXISTS dispute_handling_score,
  DROP COLUMN IF EXISTS fairness_score,
  DROP COLUMN IF EXISTS circles_completed_score,
  DROP COLUMN IF EXISTS payment_reliability_score,
  DROP COLUMN IF EXISTS elder_tenure_score;

-- Add new sub-components (7 columns)
ALTER TABLE honor_scores
  ADD COLUMN IF NOT EXISTS circles_participation_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS community_engagement_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS vouch_given_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS vouch_received_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS dispute_involvement_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS expertise_top3_avg DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS expertise_domains_active INTEGER NOT NULL DEFAULT 0;

-- Update pillar defaults for new baselines
ALTER TABLE honor_scores
  ALTER COLUMN community_score SET DEFAULT 5.00,
  ALTER COLUMN character_score SET DEFAULT 15.00,
  ALTER COLUMN expertise_score SET DEFAULT 0.00;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: Migrate Existing Data
-- ═══════════════════════════════════════════════════════════════════════════════

-- Migrate tier names: Platinum→Grand Elder, Gold→Elder, Silver→Respected,
-- Bronze→Trusted, Provisional→Novice
UPDATE honor_scores SET score_tier = CASE
  WHEN score_tier = 'Platinum' THEN 'Grand Elder'
  WHEN score_tier = 'Gold' THEN 'Elder'
  WHEN score_tier = 'Silver' THEN 'Respected'
  WHEN score_tier = 'Bronze' THEN 'Trusted'
  WHEN score_tier = 'Provisional' THEN 'Novice'
  ELSE score_tier
END;

-- Update history pillar_breakdown keys: track_record → expertise
UPDATE honor_score_history SET pillar_breakdown =
  pillar_breakdown - 'track_record' ||
  jsonb_build_object('expertise', COALESCE((pillar_breakdown->>'track_record')::DECIMAL, 0))
WHERE pillar_breakdown ? 'track_record';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: Rewrite compute_honor_score()
-- ═══════════════════════════════════════════════════════════════════════════════
-- Three pillars: Community (30), Character (40), Expertise (30)
-- Character is the HEART — vouching-centric with +5/-10 asymmetry.
-- New members start at ≈20 (Novice).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION compute_honor_score(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  -- Community pillar (30 pts max)
  v_circles_participation DECIMAL(5,2) := 0;
  v_community_engagement DECIMAL(5,2) := 0;
  v_community_score DECIMAL(5,2) := 0;

  -- Character pillar (40 pts max) — THE HEART
  v_vouch_given DECIMAL(5,2) := 0;
  v_vouch_received DECIMAL(5,2) := 0;
  v_dispute_involvement DECIMAL(5,2) := 0;
  v_character_score DECIMAL(5,2) := 0;

  -- Expertise pillar (30 pts max)
  v_expertise_top3 DECIMAL(5,2) := 0;
  v_expertise_domains INTEGER := 0;
  v_expertise_score DECIMAL(5,2) := 0;

  v_total_score DECIMAL(5,2) := 0;
  v_previous_score DECIMAL(5,2);
  v_score_tier TEXT;
  v_input_snapshot JSONB := '{}';

  -- Working variables
  v_circles_completed INTEGER := 0;
  v_training_completed INTEGER := 0;
  v_council_votes INTEGER := 0;
  v_elder_months INTEGER := 0;

  v_vouches_given_total INTEGER := 0;
  v_vouches_given_success INTEGER := 0;
  v_vouches_given_failed INTEGER := 0;
  v_vouches_given_active INTEGER := 0;

  v_vouches_received_total INTEGER := 0;
  v_vouches_received_active INTEGER := 0;
  v_vouches_received_failed INTEGER := 0;

  v_cases_resolved INTEGER := 0;
  v_disputes_against INTEGER := 0;
BEGIN
  -- ══════════════════════════════════════════════════
  -- COMMUNITY PILLAR (30 pts max)
  -- ══════════════════════════════════════════════════

  -- A. Circles Participation (max 15 pts)
  -- 1.5 pts per circle completed, baseline 5 if no circles yet
  SELECT COALESCE(circles_completed, 0) INTO v_circles_completed
  FROM community_memberships
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF COALESCE(v_circles_completed, 0) > 0 THEN
    v_circles_participation := LEAST(15, ROUND(v_circles_completed * 1.5, 2));
  ELSE
    -- Baseline: benefit of the doubt for new members
    v_circles_participation := 5;
  END IF;

  -- B. Community Engagement (max 15 pts)
  -- Training courses (max 8, 1pt each)
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

  -- Council votes (max 4, 0.5pt each = max 2 pts)
  SELECT COUNT(*) INTO v_council_votes
  FROM elder_vote_records
  WHERE elder_user_id = p_user_id;

  -- Elder tenure (max 3, 0.5pt/month = max 1.5 pts ... but we allow up to 3 pts)
  SELECT COALESCE(
    EXTRACT(MONTH FROM AGE(NOW(), elder_approved_at))::INTEGER, 0
  ) INTO v_elder_months
  FROM community_memberships
  WHERE user_id = p_user_id AND status = 'active' AND role = 'elder'
  LIMIT 1;

  v_community_engagement := LEAST(8, COALESCE(v_training_completed, 0))
                            + LEAST(4, ROUND(COALESCE(v_council_votes, 0) * 0.5, 2))
                            + LEAST(3, ROUND(COALESCE(v_elder_months, 0) * 0.5, 2));
  v_community_engagement := LEAST(15, v_community_engagement);

  v_community_score := LEAST(30, v_circles_participation + v_community_engagement);


  -- ══════════════════════════════════════════════════
  -- CHARACTER PILLAR (40 pts max) — THE HEART
  -- Vouching-centric with asymmetric risk (+5/-10)
  -- ══════════════════════════════════════════════════

  -- A. Vouch Given Score (max 20 pts)
  -- +5 per successful vouch (active/expired), -10 per failed (invalidated_by_default)
  -- Active vouches carry -5 collateral (pending outcome)
  -- Baseline 10 if no vouches given yet
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('active', 'expired')),
    COUNT(*) FILTER (WHERE status = 'invalidated_by_default'),
    COUNT(*) FILTER (WHERE status = 'active')
  INTO v_vouches_given_total, v_vouches_given_success, v_vouches_given_failed, v_vouches_given_active
  FROM member_vouches
  WHERE voucher_user_id = p_user_id;

  IF v_vouches_given_total > 0 THEN
    v_vouch_given := GREATEST(0, LEAST(20,
      10  -- start from baseline
      + (v_vouches_given_success * 5)      -- +5 per success (completed vouches)
      - (v_vouches_given_failed * 10)      -- -10 per failure (asymmetric risk)
      - (v_vouches_given_active * 5)       -- -5 collateral per active vouch
    ));
  ELSE
    -- No vouches given yet: baseline 10/20 (benefit of the doubt)
    v_vouch_given := 10;
  END IF;

  -- B. Vouch Received Score (max 10 pts)
  -- +3 per active vouch received, -5 per failed vouch received
  -- Baseline 2 if no vouches received yet
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('active', 'expired')),
    COUNT(*) FILTER (WHERE status = 'invalidated_by_default')
  INTO v_vouches_received_total, v_vouches_received_active, v_vouches_received_failed
  FROM member_vouches
  WHERE vouched_user_id = p_user_id;

  IF v_vouches_received_total > 0 THEN
    v_vouch_received := GREATEST(0, LEAST(10,
      2   -- start from baseline
      + (v_vouches_received_active * 3)    -- +3 per active vouch received
      - (v_vouches_received_failed * 5)    -- -5 per failed vouch received
    ));
  ELSE
    -- No vouches received yet: baseline 2/10
    v_vouch_received := 2;
  END IF;

  -- C. Dispute Involvement (max 10 pts)
  -- Baseline 3. +1 per case resolved as mediator (up to +7). -2 per dispute against user.
  SELECT COUNT(*) INTO v_cases_resolved
  FROM disputes
  WHERE assigned_to = p_user_id AND status = 'resolved';

  SELECT COUNT(*) INTO v_disputes_against
  FROM disputes
  WHERE against_user_id = p_user_id AND status NOT IN ('dismissed');

  v_dispute_involvement := GREATEST(0, LEAST(10,
    3                                      -- baseline
    + LEAST(7, COALESCE(v_cases_resolved, 0))  -- +1 per resolved case, max +7
    - (COALESCE(v_disputes_against, 0) * 2)    -- -2 per non-dismissed dispute against
  ));

  v_character_score := LEAST(40, v_vouch_given + v_vouch_received + v_dispute_involvement);


  -- ══════════════════════════════════════════════════
  -- EXPERTISE PILLAR (30 pts max)
  -- Average of top 3 domain scores from user_expertise
  -- ══════════════════════════════════════════════════

  -- Count active domains
  SELECT COUNT(*) INTO v_expertise_domains
  FROM user_expertise
  WHERE user_id = p_user_id AND total_domain_score > 0;

  -- Average of top 3 domain scores
  SELECT COALESCE(AVG(top_scores.total_domain_score), 0)
  INTO v_expertise_top3
  FROM (
    SELECT total_domain_score
    FROM user_expertise
    WHERE user_id = p_user_id AND total_domain_score > 0
    ORDER BY total_domain_score DESC
    LIMIT 3
  ) top_scores;

  v_expertise_score := LEAST(30, ROUND(v_expertise_top3, 2));


  -- ══════════════════════════════════════════════════
  -- TOTAL SCORE + TIER
  -- ══════════════════════════════════════════════════

  v_total_score := LEAST(100, v_community_score + v_character_score + v_expertise_score);

  v_score_tier := CASE
    WHEN v_total_score >= 90 THEN 'Grand Elder'
    WHEN v_total_score >= 75 THEN 'Elder'
    WHEN v_total_score >= 50 THEN 'Respected'
    WHEN v_total_score >= 25 THEN 'Trusted'
    ELSE 'Novice'
  END;

  -- Build input snapshot for audit
  v_input_snapshot := jsonb_build_object(
    'circles_completed', v_circles_completed,
    'training_completed', v_training_completed,
    'council_votes', v_council_votes,
    'elder_months', v_elder_months,
    'vouches_given_total', v_vouches_given_total,
    'vouches_given_success', v_vouches_given_success,
    'vouches_given_failed', v_vouches_given_failed,
    'vouches_given_active', v_vouches_given_active,
    'vouches_received_total', v_vouches_received_total,
    'vouches_received_active', v_vouches_received_active,
    'vouches_received_failed', v_vouches_received_failed,
    'cases_resolved', v_cases_resolved,
    'disputes_against', v_disputes_against,
    'expertise_domains_active', v_expertise_domains,
    'expertise_top3_avg', v_expertise_top3
  );

  -- Get previous score for history
  SELECT total_score INTO v_previous_score FROM honor_scores WHERE user_id = p_user_id;

  -- ══════════════════════════════════════════════════
  -- UPSERT honor_scores
  -- ══════════════════════════════════════════════════

  INSERT INTO honor_scores (
    user_id, total_score, previous_score, score_tier,
    community_score, character_score, expertise_score,
    circles_participation_score, community_engagement_score,
    vouch_given_score, vouch_received_score, dispute_involvement_score,
    expertise_top3_avg, expertise_domains_active,
    input_snapshot, computation_trigger, last_computed_at
  ) VALUES (
    p_user_id, v_total_score, v_previous_score, v_score_tier,
    v_community_score, v_character_score, v_expertise_score,
    v_circles_participation, v_community_engagement,
    v_vouch_given, v_vouch_received, v_dispute_involvement,
    v_expertise_top3, v_expertise_domains,
    v_input_snapshot, 'pipeline', NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_score = EXCLUDED.total_score,
    previous_score = honor_scores.total_score,
    score_tier = EXCLUDED.score_tier,
    community_score = EXCLUDED.community_score,
    character_score = EXCLUDED.character_score,
    expertise_score = EXCLUDED.expertise_score,
    circles_participation_score = EXCLUDED.circles_participation_score,
    community_engagement_score = EXCLUDED.community_engagement_score,
    vouch_given_score = EXCLUDED.vouch_given_score,
    vouch_received_score = EXCLUDED.vouch_received_score,
    dispute_involvement_score = EXCLUDED.dispute_involvement_score,
    expertise_top3_avg = EXCLUDED.expertise_top3_avg,
    expertise_domains_active = EXCLUDED.expertise_domains_active,
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
        'expertise', v_expertise_score
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
-- PART 5: Recreate compute_all_honor_scores()
-- (No structural change, just ensures it calls the updated compute_honor_score)
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
