-- ════════════════════════════════════════════════════════════════════════════
-- Migration 105: Circle Reputation Inheritance — schema only
-- Step 1 of feat(circle-reputation).
-- ════════════════════════════════════════════════════════════════════════════
-- Tables + indexes + RLS + column for the trust-premium feature (#14).
--
-- Two new tables:
--   * circle_reputation       — one row per completed circle, holds the
--                               aggregated reputation snapshot
--   * circle_reputation_members — many-to-many join: each member of a
--                                  completed circle inherits its reputation
--
-- One column on existing table:
--   * circles.reputation_score — NUMERIC(5,2) NOT NULL DEFAULT 0, range
--                                [0, 100]. For a circle that has just been
--                                formed, this is the computed average
--                                inherited from its members' past completed
--                                circles. For a circle that has itself
--                                completed, the score lives in circle_reputation.
--
-- No reputation_premium_multiplier columns on circle_insurance_pools or
-- liquidity_pool. Per the user's "for simplicity" preference, the premium
-- is applied at compute-time inside calculate_pool_rate /
-- check_liquidity_advance_eligibility (Step 3) by reading the
-- circles.reputation_score for the relevant circle. That keeps reputation
-- denormalized in exactly one place (circles.reputation_score for the
-- new circle, circle_reputation for the source-of-truth completed circle).
--
-- This migration ships NO functions, NO triggers, NO data. Just shape.
-- Step 2 will land:
--   * compute_circle_reputation(p_circle_id) — fires on circle completion
--   * compute_inherited_reputation(p_circle_id) — fires when a new circle
--     activates, reads its members' past circle_reputation rows, averages,
--     writes to circles.reputation_score
-- Step 3 will modify:
--   * calculate_pool_rate — apply up to 0.5pp discount on the base rate
--     when circle.reputation_score > 80
--   * check_liquidity_advance_eligibility — raise max_payout_pct from
--     80% to 90% when circle.reputation_score > 80
-- ════════════════════════════════════════════════════════════════════════════


-- ── Table: circle_reputation ───────────────────────────────────────────────
-- One row per completed circle. UNIQUE(circle_id) so a recompute upserts.

CREATE TABLE IF NOT EXISTS circle_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL UNIQUE REFERENCES circles(id) ON DELETE CASCADE,

  -- Overall composite score, 0–100
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Components (each 0–100). The Step-2 weighted combination is:
  --   on-time pct      40%
  --   default-free     30%  (binary: full credit or 0)
  --   member count     15%  (rewards larger circles for completing)
  --   completion time  15%  (rewards finishing on schedule)
  contribution_consistency NUMERIC(5,2),
  default_free BOOLEAN NOT NULL DEFAULT false,
  avg_on_time_pct NUMERIC(5,2),

  -- Raw aggregates for transparency / audit
  members_count INTEGER,
  total_contributions INTEGER,
  total_paid_cents BIGINT,
  total_defaulted INTEGER NOT NULL DEFAULT 0,

  -- Lifecycle timestamps
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reverse-lookup index for queries like "all reputations completed in last 90d"
CREATE INDEX IF NOT EXISTS idx_circle_reputation_completed_at
  ON circle_reputation(completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_reputation_score
  ON circle_reputation(overall_score DESC)
  WHERE overall_score > 0;


-- ── Table: circle_reputation_members ───────────────────────────────────────
-- Many-to-many. Each member of a completed circle inherits its reputation.
-- Used by Step 2's compute_inherited_reputation to find past circles for a
-- prospective new-circle member.

CREATE TABLE IF NOT EXISTS circle_reputation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reputation_id UUID NOT NULL REFERENCES circle_reputation(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(reputation_id, user_id)
);

-- Per the spec, the hot lookup is by user_id: "give me all the past
-- circle reputations this user inherits"
CREATE INDEX IF NOT EXISTS idx_circle_reputation_members_user
  ON circle_reputation_members(user_id);


-- ── ALTER circles: add reputation_score ─────────────────────────────────────
-- The forward-looking score for a NEW circle, derived from its members'
-- past completed circles. Defaults to 0 (no track record yet).

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'circles_reputation_score_range'
      AND conrelid = 'public.circles'::regclass
  ) THEN
    ALTER TABLE circles
      ADD CONSTRAINT circles_reputation_score_range
      CHECK (reputation_score >= 0 AND reputation_score <= 100);
  END IF;
END $$;


-- ── updated_at trigger on circle_reputation ────────────────────────────────
-- Mirrors the pattern from earlier migrations. update_updated_at_column
-- already exists from migration 049 (substitute).

CREATE TRIGGER trg_circle_reputation_updated_at
  BEFORE UPDATE ON circle_reputation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ── Row Level Security ─────────────────────────────────────────────────────
-- Reputation is durable, member-visible signal. Members of any circle can
-- see reputation rows (so the CreateCircle preview in Step 4 can show
-- "your group's score: 85") — we use the membership predicate.

ALTER TABLE circle_reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_reputation_members ENABLE ROW LEVEL SECURITY;

-- circle_reputation: visible to anyone who is/was a member of that circle
CREATE POLICY "circle_reputation_select_member" ON circle_reputation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_reputation.circle_id
        AND cm.user_id = auth.uid()
    )
  );

-- circle_reputation: full management by service role (compute function runs
-- as service_role via SECURITY DEFINER in Step 2)
CREATE POLICY "circle_reputation_service_all" ON circle_reputation
  FOR ALL USING (auth.role() = 'service_role');

-- circle_reputation_members: visible to the user themselves (so they can
-- see their own past reputations) AND to anyone who can see the parent
-- circle_reputation row
CREATE POLICY "circle_reputation_members_select_self" ON circle_reputation_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "circle_reputation_members_select_via_reputation" ON circle_reputation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_reputation cr
      JOIN circle_members cm ON cm.circle_id = cr.circle_id
      WHERE cr.id = circle_reputation_members.reputation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "circle_reputation_members_service_all" ON circle_reputation_members
  FOR ALL USING (auth.role() = 'service_role');


-- ── Realtime ───────────────────────────────────────────────────────────────
-- The score changes infrequently (only on circle completion + on new circle
-- formation). Realtime adds noise; not enabling on these tables. Clients
-- that want freshness can refetch on demand.


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('105', 'circle_reputation_schema',
        ARRAY['-- 105: CircleReputation Step 1 — tables + RLS + circles.reputation_score column'])
ON CONFLICT (version) DO NOTHING;
