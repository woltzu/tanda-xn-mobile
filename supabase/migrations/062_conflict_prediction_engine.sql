-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 062: Conflict Prediction Engine (#35)
-- Pairwise friction scoring at circle formation time — 6 risk factors
-- sync_stress (30%), prior_dispute (25%), payout_friction (20%),
-- style_mismatch (10%), trust_gap (10%), rapid_enrollment (5%)
-- PairFrictionScore 0-100: Compatible (0-29), Watch (30-54), Flag (55-74),
-- Separate (75-100)
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. CONFLICT HISTORY (Historical Dispute / Complaint / Exit Record) ────

CREATE TABLE IF NOT EXISTS conflict_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id         UUID REFERENCES circles(id) ON DELETE SET NULL,
  cycle_id          UUID REFERENCES circle_cycles(id) ON DELETE SET NULL,

  -- Conflict classification
  conflict_type     TEXT NOT NULL CHECK (conflict_type IN (
    'payment_dispute',       -- Dispute over payment timing / amount
    'payout_dispute',        -- Dispute over payout order / favoritism
    'contribution_complaint',-- Complaint about another member's late contributions
    'trust_violation',       -- Broken agreement, vouching withdrawal
    'abrupt_exit',           -- Left circle without notice mid-cycle
    'verbal_conflict',       -- Hostile / aggressive messages in circle chat
    'rule_violation',        -- Broke circle rules
    'other'
  )),

  severity          TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Other party (if applicable)
  other_member_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Description
  description       TEXT,
  source            TEXT DEFAULT 'system' CHECK (source IN (
    'system',         -- Auto-detected by platform
    'admin_report',   -- Reported by admin/ops
    'member_report',  -- Reported by another member
    'elder_mediation' -- From elder mediation system
  )),

  -- Resolution
  resolved_at       TIMESTAMPTZ,
  resolution_type   TEXT CHECK (resolution_type IN (
    'mediated', 'self_resolved', 'admin_decision', 'member_removed',
    'circle_restructured', 'unresolved', NULL
  )),
  resolution_notes  TEXT,

  -- Impact
  resulted_in_exit  BOOLEAN NOT NULL DEFAULT false,
  resulted_in_default BOOLEAN NOT NULL DEFAULT false,

  reported_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. MEMBER PAIR SCORES (Pairwise Friction at Formation) ───────────────

CREATE TABLE IF NOT EXISTS member_pair_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The pair (always stored with member_a_id < member_b_id for uniqueness)
  member_a_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_b_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Context
  circle_id         UUID REFERENCES circles(id) ON DELETE SET NULL,
  formation_run_id  UUID,  -- groups all pair scores from a single formation evaluation

  -- Composite friction score
  friction_score    NUMERIC(5,2) NOT NULL CHECK (friction_score BETWEEN 0 AND 100),

  -- Tier (auto-computed by trigger)
  tier              TEXT NOT NULL CHECK (tier IN (
    'compatible', 'watch', 'flag', 'separate'
  )) DEFAULT 'compatible',

  -- Factor breakdown
  factor_breakdown  JSONB NOT NULL DEFAULT '{}',
  -- {
  --   sync_stress:      { score, weight: 0.30, detail: {...} },
  --   prior_dispute:    { score, weight: 0.25, detail: {...} },
  --   payout_friction:  { score, weight: 0.20, detail: {...} },
  --   style_mismatch:   { score, weight: 0.10, detail: {...} },
  --   trust_gap:        { score, weight: 0.10, detail: {...} },
  --   rapid_enrollment: { score, weight: 0.05, detail: {...} }
  -- }

  -- Individual context
  member_a_xnscore  NUMERIC(5,2),
  member_b_xnscore  NUMERIC(5,2),
  member_a_stress   NUMERIC(5,2),
  member_b_stress   NUMERIC(5,2),
  member_a_mood     NUMERIC(5,2),
  member_b_mood     NUMERIC(5,2),

  scoring_model     TEXT NOT NULL DEFAULT 'pairwise_v1',
  score_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure pair uniqueness per formation run
  CONSTRAINT unique_pair_per_run UNIQUE (member_a_id, member_b_id, formation_run_id)
);

-- ─── 3. CIRCLE FORMATION FLAGS (Audit Trail) ──────────────────────────────

CREATE TABLE IF NOT EXISTS circle_formation_flags (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id         UUID REFERENCES circles(id) ON DELETE SET NULL,
  formation_run_id  UUID NOT NULL,

  -- Flag summary
  total_pairs       INTEGER NOT NULL DEFAULT 0,
  flagged_pairs     INTEGER NOT NULL DEFAULT 0,
  highest_score     NUMERIC(5,2) NOT NULL DEFAULT 0,
  circle_tier       TEXT NOT NULL CHECK (circle_tier IN (
    'clear', 'watch', 'flag', 'separate'
  )) DEFAULT 'clear',

  -- Flagged pair details
  flagged_pair_ids  JSONB NOT NULL DEFAULT '[]',
  -- [ { member_a_id, member_b_id, friction_score, tier, top_factor } ]

  -- Human review
  requires_review   BOOLEAN NOT NULL DEFAULT false,
  reviewed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  review_outcome    TEXT CHECK (review_outcome IN (
    'approved',          -- Formation approved as-is
    'pair_separated',    -- Flagged pair moved to different circles
    'circle_restructured', -- Circle membership changed
    'formation_blocked', -- Circle not formed
    'overridden',        -- Admin overrode Separate recommendation
    NULL
  )),
  review_notes      TEXT,

  -- Members in the proposed circle
  proposed_members  JSONB NOT NULL DEFAULT '[]',  -- [member_id, ...]

  flagged_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. POST-FORMATION MONITOR (Watch-Tier Ongoing Monitoring) ────────────

CREATE TABLE IF NOT EXISTS post_formation_monitor (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id         UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  -- The watched pair
  member_a_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_b_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pair_score_id     UUID REFERENCES member_pair_scores(id) ON DELETE SET NULL,

  -- Initial state
  initial_tier      TEXT NOT NULL CHECK (initial_tier IN ('watch', 'flag')),
  initial_score     NUMERIC(5,2) NOT NULL,

  -- Current state
  current_score     NUMERIC(5,2),
  current_tier      TEXT CHECK (current_tier IN ('compatible', 'watch', 'flag', 'separate', NULL)),
  alert_count       INTEGER NOT NULL DEFAULT 0,
  last_alert_at     TIMESTAMPTZ,
  last_evaluated_at TIMESTAMPTZ,

  -- Escalation
  escalated         BOOLEAN NOT NULL DEFAULT false,
  escalated_at      TIMESTAMPTZ,
  escalation_reason TEXT,

  -- Lifecycle
  monitoring_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
  monitoring_end    TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 5. INDEXES ────────────────────────────────────────────────────────────

-- Conflict history
CREATE INDEX IF NOT EXISTS idx_conflict_history_member
  ON conflict_history(member_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_conflict_history_other
  ON conflict_history(other_member_id, reported_at DESC)
  WHERE other_member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conflict_history_circle
  ON conflict_history(circle_id, reported_at DESC)
  WHERE circle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conflict_history_type
  ON conflict_history(conflict_type, severity);

CREATE INDEX IF NOT EXISTS idx_conflict_history_unresolved
  ON conflict_history(member_id)
  WHERE resolved_at IS NULL;

-- Pair scores
CREATE INDEX IF NOT EXISTS idx_pair_scores_members
  ON member_pair_scores(member_a_id, member_b_id, score_date DESC);

CREATE INDEX IF NOT EXISTS idx_pair_scores_circle
  ON member_pair_scores(circle_id, score_date DESC)
  WHERE circle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pair_scores_formation
  ON member_pair_scores(formation_run_id);

CREATE INDEX IF NOT EXISTS idx_pair_scores_tier
  ON member_pair_scores(tier, score_date DESC)
  WHERE tier IN ('flag', 'separate');

-- Formation flags
CREATE INDEX IF NOT EXISTS idx_formation_flags_circle
  ON circle_formation_flags(circle_id, flagged_at DESC);

CREATE INDEX IF NOT EXISTS idx_formation_flags_review
  ON circle_formation_flags(requires_review, reviewed_at)
  WHERE requires_review = true AND reviewed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_formation_flags_run
  ON circle_formation_flags(formation_run_id);

-- Post-formation monitor
CREATE INDEX IF NOT EXISTS idx_post_monitor_circle
  ON post_formation_monitor(circle_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_post_monitor_pair
  ON post_formation_monitor(member_a_id, member_b_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_post_monitor_escalated
  ON post_formation_monitor(escalated, is_active)
  WHERE escalated = false AND is_active = true;

-- ─── 6. TRIGGERS ───────────────────────────────────────────────────────────

-- Auto-compute tier from friction_score
CREATE OR REPLACE FUNCTION trg_pair_score_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier := CASE
    WHEN NEW.friction_score <= 29 THEN 'compatible'
    WHEN NEW.friction_score <= 54 THEN 'watch'
    WHEN NEW.friction_score <= 74 THEN 'flag'
    ELSE 'separate'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pair_score_tier ON member_pair_scores;
CREATE TRIGGER trg_pair_score_tier
  BEFORE INSERT OR UPDATE OF friction_score ON member_pair_scores
  FOR EACH ROW EXECUTE FUNCTION trg_pair_score_tier();

-- Auto-update updated_at on circle_formation_flags
CREATE OR REPLACE FUNCTION trg_formation_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_formation_flags_updated ON circle_formation_flags;
CREATE TRIGGER trg_formation_flags_updated
  BEFORE UPDATE ON circle_formation_flags
  FOR EACH ROW EXECUTE FUNCTION trg_formation_flags_updated_at();

-- Auto-update updated_at on post_formation_monitor
CREATE OR REPLACE FUNCTION trg_post_monitor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_post_monitor_updated ON post_formation_monitor;
CREATE TRIGGER trg_post_monitor_updated
  BEFORE UPDATE ON post_formation_monitor
  FOR EACH ROW EXECUTE FUNCTION trg_post_monitor_updated_at();

-- ─── 7. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE conflict_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_pair_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_formation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_formation_monitor ENABLE ROW LEVEL SECURITY;

-- Conflict history: members see own records
CREATE POLICY conflict_hist_select_own ON conflict_history
  FOR SELECT USING (auth.uid() = member_id OR auth.uid() = other_member_id);
CREATE POLICY conflict_hist_service ON conflict_history
  FOR ALL USING (auth.role() = 'service_role');

-- Pair scores: service_role only (members never see pair scores)
CREATE POLICY pair_scores_service ON member_pair_scores
  FOR ALL USING (auth.role() = 'service_role');

-- Formation flags: service_role only (admin dashboard reads via service key)
CREATE POLICY formation_flags_service ON circle_formation_flags
  FOR ALL USING (auth.role() = 'service_role');

-- Post-formation monitor: service_role only
CREATE POLICY post_monitor_service ON post_formation_monitor
  FOR ALL USING (auth.role() = 'service_role');

-- ─── 8. REALTIME ───────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE circle_formation_flags;
ALTER PUBLICATION supabase_realtime ADD TABLE post_formation_monitor;

-- ─── 9. DASHBOARD VIEW ───────────────────────────────────────────────────

CREATE OR REPLACE VIEW conflict_prediction_dashboard AS
SELECT
  score_date,
  COUNT(*) AS total_pairs_scored,
  COUNT(*) FILTER (WHERE tier = 'compatible') AS compatible_count,
  COUNT(*) FILTER (WHERE tier = 'watch')      AS watch_count,
  COUNT(*) FILTER (WHERE tier = 'flag')       AS flag_count,
  COUNT(*) FILTER (WHERE tier = 'separate')   AS separate_count,
  ROUND(AVG(friction_score), 2) AS avg_friction,
  MAX(friction_score) AS max_friction
FROM member_pair_scores
GROUP BY score_date
ORDER BY score_date DESC;

CREATE OR REPLACE VIEW formation_review_queue AS
SELECT
  cff.id,
  cff.circle_id,
  cff.formation_run_id,
  cff.total_pairs,
  cff.flagged_pairs,
  cff.highest_score,
  cff.circle_tier,
  cff.flagged_pair_ids,
  cff.requires_review,
  cff.reviewed_by,
  cff.reviewed_at,
  cff.review_outcome,
  cff.proposed_members,
  cff.flagged_at
FROM circle_formation_flags cff
WHERE cff.requires_review = true
  AND cff.reviewed_at IS NULL
ORDER BY cff.highest_score DESC, cff.flagged_at ASC;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Done. Tables: conflict_history, member_pair_scores, circle_formation_flags,
-- post_formation_monitor. 16 indexes, 3 triggers, 6 RLS policies,
-- 2 realtime channels, 2 dashboard views.
-- ═══════════════════════════════════════════════════════════════════════════════
