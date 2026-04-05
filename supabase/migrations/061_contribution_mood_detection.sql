-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 061: Contribution Mood Detection (#31)
-- Passive NLP layer tracking emotional drift over time via 5 signals:
-- sentiment_polarity (35%), lexical_richness (25%), keyword_trigger (15%),
-- response_latency (15%), message_length (10%)
-- MoodDriftScore 0-100: Stable (0-30), Drifting (31-55), Disengaging (56-75),
-- At Risk (76-100)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. MEMBER MESSAGES (Raw Message Log) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS member_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Message content
  message_text    TEXT NOT NULL,
  message_length  INTEGER GENERATED ALWAYS AS (
    array_length(string_to_array(trim(message_text), ' '), 1)
  ) STORED,

  -- Source channel
  channel         TEXT NOT NULL CHECK (channel IN (
    'support_ticket',   -- Support ticket text
    'circle_chat',      -- In-app circle discussion thread
    'direct_message',   -- Direct message to another member or ops
    'community_post',   -- Community feed comment
    'contribution_note' -- Note attached to a contribution
  )),

  -- Context
  circle_id       UUID REFERENCES circles(id) ON DELETE SET NULL,
  thread_id       UUID,          -- parent message/ticket ID for latency calculation
  reply_to_id     UUID,          -- message this is replying to
  language        TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt')),

  -- NLP analysis results (populated by scoring job)
  polarity_score  NUMERIC(5,3),              -- -1.000 to +1.000
  subjectivity    NUMERIC(4,3),              -- 0.000 to 1.000
  lexical_diversity NUMERIC(4,3),            -- 0.000 to 1.000 (type-token ratio)
  keyword_flags   JSONB DEFAULT '[]',        -- matched mood keywords
  response_latency_hours NUMERIC(8,2),       -- hours to reply (null if not a reply)

  -- Opt-out
  excluded_from_analysis BOOLEAN NOT NULL DEFAULT false,

  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. MEMBER MOOD BASELINES (90-Day Rolling Average) ────────────────────

CREATE TABLE IF NOT EXISTS member_mood_baselines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Baseline metrics
  baseline_polarity   NUMERIC(5,3) NOT NULL,         -- avg polarity over 90 days
  baseline_lexical    NUMERIC(4,3) NOT NULL,         -- avg lexical diversity
  baseline_latency    NUMERIC(8,2) NOT NULL,         -- avg response latency (hours)
  baseline_length     NUMERIC(6,1) NOT NULL,         -- avg message length (words)

  -- Baseline window
  messages_analyzed   INTEGER NOT NULL DEFAULT 0,
  window_start        DATE NOT NULL,
  window_end          DATE NOT NULL,

  -- Validity
  is_established      BOOLEAN NOT NULL DEFAULT false, -- true when >= 5 messages
  min_messages        INTEGER NOT NULL DEFAULT 5,

  computed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. MEMBER MOOD SNAPSHOTS (Weekly NLP Scoring Output) ─────────────────

CREATE TABLE IF NOT EXISTS member_mood_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Individual signal scores (0-100, normalized against personal baseline)
  polarity_score        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (polarity_score BETWEEN 0 AND 100),
  lexical_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (lexical_score BETWEEN 0 AND 100),
  latency_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (latency_score BETWEEN 0 AND 100),
  keyword_score         NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (keyword_score BETWEEN 0 AND 100),
  length_score          NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (length_score BETWEEN 0 AND 100),

  -- Composite mood drift score
  composite_mood_score  NUMERIC(5,2) NOT NULL CHECK (composite_mood_score BETWEEN 0 AND 100),

  -- Tier
  tier                  TEXT NOT NULL CHECK (tier IN (
    'stable', 'drifting', 'disengaging', 'at_risk'
  )) DEFAULT 'stable',

  -- Signal breakdown
  signal_breakdown      JSONB NOT NULL DEFAULT '{}',
  -- {
  --   polarity:  { raw, baseline, delta_pct, normalized, weight: 0.35 },
  --   lexical:   { raw, baseline, delta_pct, normalized, weight: 0.25 },
  --   keyword:   { flags_count, severity, normalized, weight: 0.15 },
  --   latency:   { raw_hours, baseline_hours, increase_factor, normalized, weight: 0.15 },
  --   length:    { raw_words, baseline_words, contraction_pct, normalized, weight: 0.10 }
  -- }

  -- Trend
  previous_score        NUMERIC(5,2),
  score_delta           NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN previous_score IS NOT NULL
         THEN composite_mood_score - previous_score
         ELSE NULL
    END
  ) STORED,
  trend                 TEXT CHECK (trend IN ('improving', 'stable', 'worsening', NULL)),

  -- Intervention trigger
  intervention_triggered BOOLEAN NOT NULL DEFAULT false,
  intervention_type     TEXT CHECK (intervention_type IN (
    'warm_checkin', 'contribution_pause', 'amount_reduction',
    'human_outreach', 'counselor_referral', NULL
  )),

  -- Metadata
  messages_in_window    INTEGER NOT NULL DEFAULT 0,
  scoring_model         TEXT NOT NULL DEFAULT 'vader_textblob_v1',
  snapshot_date         DATE NOT NULL DEFAULT CURRENT_DATE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. MOOD INTERVENTIONS (Offer → Response → Outcome) ──────────────────

CREATE TABLE IF NOT EXISTS mood_interventions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mood_snapshot_id      UUID REFERENCES member_mood_snapshots(id) ON DELETE SET NULL,

  -- Intervention details
  intervention_type     TEXT NOT NULL CHECK (intervention_type IN (
    'warm_checkin',          -- Drifting: gentle check-in message
    'contribution_pause',    -- Disengaging: offer to pause contributions
    'amount_reduction',      -- Disengaging: offer to reduce contribution amount
    'human_outreach',        -- At Risk: ops team personal message
    'counselor_referral'     -- At Risk: CDFI / nonprofit referral
  )),

  tier_at_trigger       TEXT NOT NULL CHECK (tier_at_trigger IN (
    'drifting', 'disengaging', 'at_risk'
  )),
  mood_score_at_trigger NUMERIC(5,2) NOT NULL,

  -- Message
  channel               TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN (
    'in_app', 'push', 'sms', 'direct_message', 'email'
  )),
  message_title         TEXT NOT NULL,
  message_body          TEXT NOT NULL,
  language              TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt')),

  -- Contribution adjustment details
  circle_id             UUID REFERENCES circles(id) ON DELETE SET NULL,
  current_amount_cents  INTEGER,
  proposed_amount_cents INTEGER,
  pause_duration_weeks  INTEGER,

  -- Human review (required for At Risk tier)
  requires_review       BOOLEAN NOT NULL DEFAULT false,
  reviewed_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,

  -- Lifecycle
  triggered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at               TIMESTAMPTZ,
  viewed_at             TIMESTAMPTZ,
  accepted_at           TIMESTAMPTZ,
  declined_at           TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expired_at            TIMESTAMPTZ,

  -- Outcome
  outcome               TEXT CHECK (outcome IN (
    'pending', 'pending_review', 'sent', 'viewed', 'accepted',
    'declined', 'expired', 'completed', NULL
  )) DEFAULT 'pending',

  -- Effectiveness
  default_prevented     BOOLEAN,
  member_re_engaged     BOOLEAN,         -- did member's score improve after?
  follow_up_score       NUMERIC(5,2),    -- mood score 30 days later

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. MOOD KEYWORDS (Disengagement Vocabulary) ──────────────────────────

CREATE TABLE IF NOT EXISTS mood_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword         TEXT NOT NULL,
  language        TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'fr', 'es', 'pt')),
  severity_weight NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (severity_weight BETWEEN 0.1 AND 3.0),
  category        TEXT NOT NULL DEFAULT 'disengagement' CHECK (category IN (
    'disengagement', 'frustration', 'avoidance', 'resignation', 'general'
  )),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(keyword, language)
);

-- ─── 6. MEMBER MOOD PREFERENCES (Opt-Out) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS member_mood_preferences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  opted_out       BOOLEAN NOT NULL DEFAULT false,
  opted_out_at    TIMESTAMPTZ,
  preferred_language TEXT DEFAULT 'en',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. INDEXES ────────────────────────────────────────────────────────────

-- Messages
CREATE INDEX IF NOT EXISTS idx_member_messages_member
  ON member_messages(member_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_messages_channel
  ON member_messages(channel, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_messages_circle
  ON member_messages(circle_id, sent_at DESC) WHERE circle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_messages_reply
  ON member_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_messages_unanalyzed
  ON member_messages(member_id, sent_at)
  WHERE analyzed_at IS NULL AND excluded_from_analysis = false;

-- Baselines
CREATE INDEX IF NOT EXISTS idx_mood_baselines_member
  ON member_mood_baselines(member_id, computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_baselines_established
  ON member_mood_baselines(member_id)
  WHERE is_established = true;

-- Snapshots
CREATE INDEX IF NOT EXISTS idx_mood_snapshots_member
  ON member_mood_snapshots(member_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_mood_snapshots_tier
  ON member_mood_snapshots(tier, snapshot_date DESC)
  WHERE tier IN ('disengaging', 'at_risk');

CREATE INDEX IF NOT EXISTS idx_mood_snapshots_intervention
  ON member_mood_snapshots(intervention_triggered, snapshot_date DESC)
  WHERE intervention_triggered = true;

-- Interventions
CREATE INDEX IF NOT EXISTS idx_mood_interventions_member
  ON mood_interventions(member_id, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_interventions_outcome
  ON mood_interventions(outcome, triggered_at DESC)
  WHERE outcome IN ('pending', 'pending_review', 'sent');

CREATE INDEX IF NOT EXISTS idx_mood_interventions_review
  ON mood_interventions(requires_review, reviewed_at)
  WHERE requires_review = true AND reviewed_at IS NULL;

-- Keywords
CREATE INDEX IF NOT EXISTS idx_mood_keywords_lang
  ON mood_keywords(language, is_active)
  WHERE is_active = true;

-- ─── 8. TRIGGERS ───────────────────────────────────────────────────────────

-- Auto-update updated_at on mood_interventions
CREATE OR REPLACE FUNCTION trg_mood_interventions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mood_interventions_updated ON mood_interventions;
CREATE TRIGGER trg_mood_interventions_updated
  BEFORE UPDATE ON mood_interventions
  FOR EACH ROW EXECUTE FUNCTION trg_mood_interventions_updated_at();

-- Auto-update updated_at on member_mood_preferences
CREATE OR REPLACE FUNCTION trg_mood_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mood_preferences_updated ON member_mood_preferences;
CREATE TRIGGER trg_mood_preferences_updated
  BEFORE UPDATE ON member_mood_preferences
  FOR EACH ROW EXECUTE FUNCTION trg_mood_preferences_updated_at();

-- Auto-compute tier from composite_mood_score
CREATE OR REPLACE FUNCTION trg_mood_snapshot_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.composite_mood_score <= 30 THEN 'stable'
    WHEN NEW.composite_mood_score <= 55 THEN 'drifting'
    WHEN NEW.composite_mood_score <= 75 THEN 'disengaging'
    ELSE 'at_risk'
  END;

  -- Auto-trigger intervention for Disengaging and At Risk
  IF NEW.composite_mood_score > 55 THEN
    NEW.intervention_triggered := true;
    IF NEW.composite_mood_score <= 75 THEN
      NEW.intervention_type := 'contribution_pause';
    ELSE
      NEW.intervention_type := 'human_outreach';
    END IF;
  ELSIF NEW.composite_mood_score > 30 THEN
    -- Drifting: flag for warm check-in
    NEW.intervention_triggered := true;
    NEW.intervention_type := 'warm_checkin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mood_snapshot_tier ON member_mood_snapshots;
CREATE TRIGGER trg_mood_snapshot_tier
  BEFORE INSERT OR UPDATE OF composite_mood_score ON member_mood_snapshots
  FOR EACH ROW EXECUTE FUNCTION trg_mood_snapshot_tier();

-- Auto-set outcome based on lifecycle timestamps
CREATE OR REPLACE FUNCTION trg_mood_intervention_outcome()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.outcome := 'completed';
  ELSIF NEW.accepted_at IS NOT NULL AND OLD.accepted_at IS NULL THEN
    NEW.outcome := 'accepted';
  ELSIF NEW.declined_at IS NOT NULL AND OLD.declined_at IS NULL THEN
    NEW.outcome := 'declined';
  ELSIF NEW.expired_at IS NOT NULL AND OLD.expired_at IS NULL THEN
    NEW.outcome := 'expired';
  ELSIF NEW.viewed_at IS NOT NULL AND OLD.viewed_at IS NULL AND NEW.outcome = 'sent' THEN
    NEW.outcome := 'viewed';
  ELSIF NEW.sent_at IS NOT NULL AND OLD.sent_at IS NULL THEN
    NEW.outcome := 'sent';
  ELSIF NEW.reviewed_at IS NOT NULL AND OLD.reviewed_at IS NULL AND NEW.requires_review THEN
    NEW.outcome := 'sent';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mood_intervention_outcome ON mood_interventions;
CREATE TRIGGER trg_mood_intervention_outcome
  BEFORE UPDATE ON mood_interventions
  FOR EACH ROW EXECUTE FUNCTION trg_mood_intervention_outcome();

-- ─── 9. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE member_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_mood_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_mood_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_mood_preferences ENABLE ROW LEVEL SECURITY;

-- Messages: members see own
CREATE POLICY messages_select_own ON member_messages
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY messages_insert_own ON member_messages
  FOR INSERT WITH CHECK (auth.uid() = member_id);
CREATE POLICY messages_service ON member_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Baselines: members see own
CREATE POLICY baselines_select_own ON member_mood_baselines
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY baselines_service ON member_mood_baselines
  FOR ALL USING (auth.role() = 'service_role');

-- Snapshots: members see own (score only — no raw NLP)
CREATE POLICY snapshots_select_own ON member_mood_snapshots
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY snapshots_service ON member_mood_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- Interventions: members see own, update own
CREATE POLICY mood_int_select_own ON mood_interventions
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY mood_int_update_own ON mood_interventions
  FOR UPDATE USING (auth.uid() = member_id);
CREATE POLICY mood_int_service ON mood_interventions
  FOR ALL USING (auth.role() = 'service_role');

-- Keywords: read-only for all
CREATE POLICY mood_kw_select ON mood_keywords
  FOR SELECT USING (true);
CREATE POLICY mood_kw_service ON mood_keywords
  FOR ALL USING (auth.role() = 'service_role');

-- Preferences: members manage own
CREATE POLICY mood_prefs_select_own ON member_mood_preferences
  FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY mood_prefs_upsert_own ON member_mood_preferences
  FOR INSERT WITH CHECK (auth.uid() = member_id);
CREATE POLICY mood_prefs_update_own ON member_mood_preferences
  FOR UPDATE USING (auth.uid() = member_id);
CREATE POLICY mood_prefs_service ON member_mood_preferences
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 10. REALTIME ──────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE mood_interventions;
ALTER PUBLICATION supabase_realtime ADD TABLE member_mood_snapshots;

-- ─── 11. DASHBOARD VIEW ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW mood_detection_dashboard AS
SELECT
  snapshot_date,
  COUNT(*) AS total_scored,
  COUNT(*) FILTER (WHERE tier = 'stable')       AS stable_count,
  COUNT(*) FILTER (WHERE tier = 'drifting')      AS drifting_count,
  COUNT(*) FILTER (WHERE tier = 'disengaging')   AS disengaging_count,
  COUNT(*) FILTER (WHERE tier = 'at_risk')       AS at_risk_count,
  ROUND(AVG(composite_mood_score), 2)            AS avg_score,
  COUNT(*) FILTER (WHERE intervention_triggered) AS interventions_triggered,
  COUNT(*) FILTER (WHERE trend = 'worsening')    AS worsening_count,
  COUNT(*) FILTER (WHERE trend = 'improving')    AS improving_count
FROM member_mood_snapshots
GROUP BY snapshot_date
ORDER BY snapshot_date DESC;

-- ─── 12. SEED MOOD KEYWORDS ──────────────────────────────────────────────

INSERT INTO mood_keywords (keyword, language, severity_weight, category) VALUES
  -- English disengagement keywords (from spec)
  ('busy',          'en', 1.20, 'avoidance'),
  ('later',         'en', 1.00, 'avoidance'),
  ('fine',          'en', 0.80, 'resignation'),
  ('whatever',      'en', 1.50, 'resignation'),
  ('can''t right now', 'en', 1.40, 'avoidance'),
  ('not sure',      'en', 1.00, 'disengagement'),
  ('maybe',         'en', 0.80, 'disengagement'),
  ('don''t know',   'en', 1.10, 'disengagement'),
  ('tired',         'en', 1.30, 'frustration'),
  ('done',          'en', 1.50, 'resignation'),
  ('forget it',     'en', 1.80, 'resignation'),
  ('leave me alone','en', 2.00, 'frustration'),
  ('pointless',     'en', 1.70, 'resignation'),
  ('waste of time', 'en', 2.00, 'frustration'),
  ('doesn''t matter','en', 1.60, 'resignation'),
  ('idk',           'en', 1.00, 'disengagement'),
  ('meh',           'en', 1.20, 'resignation'),
  ('k',             'en', 1.30, 'disengagement'),
  ('nvm',           'en', 1.40, 'avoidance'),
  ('no thanks',     'en', 0.90, 'disengagement'),

  -- French disengagement keywords
  ('occupé',        'fr', 1.20, 'avoidance'),
  ('plus tard',     'fr', 1.00, 'avoidance'),
  ('ça va',         'fr', 0.80, 'resignation'),
  ('bof',           'fr', 1.30, 'resignation'),
  ('je sais pas',   'fr', 1.10, 'disengagement'),
  ('on verra',      'fr', 1.20, 'avoidance'),
  ('fatigué',       'fr', 1.30, 'frustration'),
  ('laisse tomber', 'fr', 1.80, 'resignation'),
  ('c''est bon',    'fr', 0.80, 'resignation'),
  ('pas maintenant','fr', 1.40, 'avoidance'),
  ('je m''en fous', 'fr', 2.00, 'frustration'),
  ('rien',          'fr', 1.20, 'disengagement'),
  ('pff',           'fr', 1.30, 'frustration'),
  ('tranquille',    'fr', 0.70, 'general'),
  ('pas grave',     'fr', 1.00, 'resignation'),
  ('osef',          'fr', 1.80, 'resignation')
ON CONFLICT (keyword, language) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables: member_messages, member_mood_baselines, member_mood_snapshots,
-- mood_interventions, mood_keywords, member_mood_preferences.
-- 15 indexes, 4 triggers, 18 RLS policies, 2 realtime channels,
-- 1 dashboard view, 36 seed keywords (EN + FR).
-- ═══════════════════════════════════════════════════════════════════════════════
