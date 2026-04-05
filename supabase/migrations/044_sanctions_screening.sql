-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 044: Sanctions Screening Automation
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Compliance layer for OFAC SDN, EU Consolidated Sanctions, and UN Security
-- Council list screening. Screens members at onboarding, circle join,
-- transaction initiation, profile update, and weekly rolling basis.
--
-- Tables: sanctions_screens, sanctions_matches, sanctions_review_queue,
--         sanctions_list_updates
-- ALTER: profiles + 5 columns (date_of_birth, country_of_origin,
--        country_of_residence, sanctions_status, last_sanctions_screen)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER PROFILES — Add screening-related columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_of_residence TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sanctions_status TEXT DEFAULT 'clear'
    CHECK (sanctions_status IN ('clear', 'under_review', 'blocked'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_sanctions_screen TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: sanctions_screens
-- Every screening event — onboarding, circle join, transaction, rolling,
-- or profile update. Records API response and overall result.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanctions_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Screen context
  screen_type TEXT NOT NULL CHECK (screen_type IN (
    'onboarding', 'circle_join', 'transaction', 'rolling', 'profile_update'
  )),
  screen_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Lists checked (defaults to all three)
  lists_checked TEXT[] NOT NULL DEFAULT '{OFAC_SDN,EU_CONSOLIDATED,UN_SECURITY_COUNCIL}',

  -- Results
  overall_result TEXT NOT NULL DEFAULT 'clear' CHECK (overall_result IN (
    'clear', 'review', 'match', 'error'
  )),
  match_count INTEGER DEFAULT 0,
  highest_match_score DECIMAL(5,4) DEFAULT 0.0000,

  -- Raw API response for audit
  api_response JSONB DEFAULT '{}',

  -- Human review resolution
  reviewed_by UUID REFERENCES profiles(id),
  review_date TIMESTAMPTZ,
  resolution TEXT CHECK (resolution IN ('cleared', 'confirmed_match', 'escalated')),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: sanctions_matches
-- Individual match details for each screen. One screen may produce
-- multiple matches across different lists.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanctions_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES sanctions_screens(id) ON DELETE CASCADE,

  -- Which list produced this match
  list_source TEXT NOT NULL CHECK (list_source IN (
    'OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY_COUNCIL'
  )),

  -- Name comparison
  matched_name TEXT NOT NULL,
  member_name_submitted TEXT NOT NULL,
  similarity_score DECIMAL(5,4) NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact', 'fuzzy', 'alias')),

  -- Confirmation signals
  dob_match BOOLEAN DEFAULT false,
  nationality_match BOOLEAN DEFAULT false,

  -- Sanctions list entry reference
  sanctions_entry_id TEXT,
  sanctions_details JSONB DEFAULT '{}',

  -- Auto-clear: different DOB + different nationality + < 85% similarity
  auto_cleared BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: sanctions_review_queue
-- Human review workflow. Elders or compliance officers review flagged
-- screens and clear, confirm, or escalate.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanctions_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id UUID NOT NULL REFERENCES sanctions_screens(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Review workflow
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'assigned', 'resolved', 'escalated'
  )),
  assigned_to UUID REFERENCES profiles(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
    'critical', 'high', 'medium'
  )),

  -- Context snapshot (member info at time of flagging)
  member_context JSONB DEFAULT '{}',
  match_summary TEXT,

  -- Timestamps
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,

  -- Resolution
  resolution TEXT CHECK (resolution IN ('cleared', 'confirmed_match', 'escalated')),
  resolution_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: sanctions_list_updates
-- Tracks when each sanctions list was last refreshed to ensure
-- screening always runs against current data.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sanctions_list_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_name TEXT NOT NULL CHECK (list_name IN (
    'OFAC_SDN', 'EU_CONSOLIDATED', 'UN_SECURITY_COUNCIL'
  )),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  record_count INTEGER DEFAULT 0,
  update_source TEXT,
  hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- sanctions_screens
CREATE INDEX IF NOT EXISTS idx_sanctions_screens_member
  ON sanctions_screens(member_id);

CREATE INDEX IF NOT EXISTS idx_sanctions_screens_result
  ON sanctions_screens(overall_result)
  WHERE overall_result IN ('review', 'match');

CREATE INDEX IF NOT EXISTS idx_sanctions_screens_date
  ON sanctions_screens(screen_date DESC);

CREATE INDEX IF NOT EXISTS idx_sanctions_screens_type
  ON sanctions_screens(screen_type);

-- sanctions_matches
CREATE INDEX IF NOT EXISTS idx_sanctions_matches_screen
  ON sanctions_matches(screen_id);

CREATE INDEX IF NOT EXISTS idx_sanctions_matches_not_cleared
  ON sanctions_matches(auto_cleared)
  WHERE auto_cleared = false;

-- sanctions_review_queue
CREATE INDEX IF NOT EXISTS idx_sanctions_review_status
  ON sanctions_review_queue(status)
  WHERE status IN ('pending', 'assigned');

CREATE INDEX IF NOT EXISTS idx_sanctions_review_member
  ON sanctions_review_queue(member_id);

-- sanctions_list_updates
CREATE INDEX IF NOT EXISTS idx_sanctions_list_updates_name
  ON sanctions_list_updates(list_name);

-- profiles sanctions status (partial — only non-clear)
CREATE INDEX IF NOT EXISTS idx_profiles_sanctions_status
  ON profiles(sanctions_status)
  WHERE sanctions_status != 'clear';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sanctions_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sanctions_list_updates ENABLE ROW LEVEL SECURITY;

-- sanctions_screens: members see own screens
CREATE POLICY "sanctions_screens_select_own" ON sanctions_screens
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "sanctions_screens_service_all" ON sanctions_screens
  FOR ALL USING (auth.role() = 'service_role');

-- sanctions_matches: members see matches for their own screens
CREATE POLICY "sanctions_matches_select_own" ON sanctions_matches
  FOR SELECT USING (
    screen_id IN (SELECT id FROM sanctions_screens WHERE member_id = auth.uid())
  );

CREATE POLICY "sanctions_matches_service_all" ON sanctions_matches
  FOR ALL USING (auth.role() = 'service_role');

-- sanctions_review_queue: members see own reviews, assigned reviewers see theirs
CREATE POLICY "sanctions_review_select_own" ON sanctions_review_queue
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "sanctions_review_select_assigned" ON sanctions_review_queue
  FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "sanctions_review_service_all" ON sanctions_review_queue
  FOR ALL USING (auth.role() = 'service_role');

-- sanctions_list_updates: all authenticated users can read (public metadata)
CREATE POLICY "sanctions_list_updates_select_auth" ON sanctions_list_updates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "sanctions_list_updates_service_all" ON sanctions_list_updates
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE sanctions_screens;
ALTER PUBLICATION supabase_realtime ADD TABLE sanctions_review_queue;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_sanctions_screens_updated_at
  BEFORE UPDATE ON sanctions_screens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sanctions_review_updated_at
  BEFORE UPDATE ON sanctions_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- CRON SCHEDULE — Weekly sanctions screening (Sunday 02:00 UTC)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('sanctions-screening-weekly')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sanctions-screening-weekly');

SELECT cron.schedule(
  'sanctions-screening-weekly',
  '0 2 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/sanctions-screening-weekly',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
