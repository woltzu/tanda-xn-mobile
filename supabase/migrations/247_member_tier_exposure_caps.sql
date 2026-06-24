-- ════════════════════════════════════════════════════════════════════════════
-- 247 — member_tier_exposure_caps
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 1: Member Access Tiers — financial safety via exposure caps.
--
-- Per the schema audit (Step 1, 2026-06-23), the production DB already
-- carries a tier system in member_tier_status (live: 11 users, latest
-- update 2026-06-24 03:00 UTC) and per-feature gates in feature_gates
-- (23 enabled rows covering circles.join/create/vouch, loans, elders, …).
-- Building a parallel `member_tiers` config table + `compute_member_tier()`
-- function would duplicate ~80% of that and guarantee drift. Instead we
-- EXTEND the existing system:
--
--   1. Add max_exposure_cents to member_tier_status (the missing total-pot
--      cap, alongside existing max_circle_size + max_contribution_cents).
--   2. Create exposure_vouches — a narrow accelerator table separate from
--      the existing `vouches` XnScore system (which has a completely
--      different shape: voucher_user_id / vouchee_user_id / vouch_status
--      enum / diluted_vouch_value, …). Leave that one alone.
--   3. Backfill caps for the 4 live tiers (newcomer / established / elder /
--      critical).
--   4. RPC can_join_circle(user_id, circle_id) → BOOLEAN that computes
--      pot = circles.member_count * circles.amount * 100 cents and compares
--      against the user's effective cap (own tier OR latest active vouch).
--
-- NOT in this bucket — explicitly deferred:
--   • New RLS policies on circles / feed_posts. The existing policies
--     (circles_browse_select, read_public_posts) make these tables
--     authenticated-readable already; PostgreSQL stacks RLS with OR, so a
--     new "in your community" SELECT policy would NOT restrict — it would
--     just be another match path. Restricting requires DROPping the
--     existing permissive policies, which is a breaking change for every
--     browse surface and deserves its own bucket.
--   • member_tiers config table — the existing member_tier_status owns
--     tier state; feature_gates owns capability gates. Two of those
--     already cover the spec's "can_create_circle / can_invite / can_vouch"
--     booleans (rows: circles.create, circles.vouch, etc.).
--
-- CRITICAL-TIER SAFETY DECISION (worth a second look — flag in commit):
--   The spec's example mapping listed critical=$10,000 BUT the column
--   semantics around critical (is_demoted / demotion_reason /
--   demotion_path_back) make it the lowest, not the highest tier — a
--   member in trouble. Letting demoted members take on $10k of new risk
--   is backwards. We seed critical = 0 cents (blocked from joining new
--   circles until they recover). If governance disagrees, override with:
--     UPDATE member_tier_status SET max_exposure_cents = X WHERE current_tier = 'critical';
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Add max_exposure_cents to the live tier-status table.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE member_tier_status
  ADD COLUMN IF NOT EXISTS max_exposure_cents INTEGER;

COMMENT ON COLUMN member_tier_status.max_exposure_cents IS
  'Max total pot (circle member_count * amount * 100) the member is allowed '
  'to be exposed to when joining a circle. Seeded by migration 247 per '
  'tier. NULL = newcomer-equivalent ($500) default in can_join_circle().';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Backfill caps. Cents to avoid the dollars/cents mismatch we hit on
--    trip prices. Critical = 0 (see header note).
-- ───────────────────────────────────────────────────────────────────────────
UPDATE member_tier_status SET max_exposure_cents = CASE current_tier
  WHEN 'newcomer'    THEN 50000      -- $500
  WHEN 'established' THEN 200000     -- $2,000
  WHEN 'elder'       THEN 500000     -- $5,000
  WHEN 'critical'    THEN 0          -- blocked (demoted state)
  ELSE 50000                          -- safest default for unknown tier
END
WHERE max_exposure_cents IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. exposure_vouches — tier-accelerator table. Distinct from `vouches`
--    (the XnScore system) by table name + by every column. No FK or
--    foreign concept shared.
--
--    Designed to allow history: multiple rows per member can coexist
--    (e.g., one expired + one active). The RPC picks the latest active
--    via `ORDER BY created_at DESC LIMIT 1` — no UNIQUE(member_id) so
--    a fresh vouch after an old one expired doesn't conflict.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exposure_vouches (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id             UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id            UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  temporary_tier       TEXT         NOT NULL
                                    CHECK (temporary_tier IN ('newcomer','established','elder','critical')),
  expires_at           TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  backing_amount_cents INTEGER      NOT NULL CHECK (backing_amount_cents > 0),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (elder_id <> member_id)
);

CREATE INDEX IF NOT EXISTS idx_exposure_vouches_member_active
  ON exposure_vouches (member_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_exposure_vouches_elder
  ON exposure_vouches (elder_id);

-- RLS — public can SELECT (so members can see who vouched for them and
-- so elders can see their portfolio); only the elder can INSERT their
-- own vouch; no UPDATE (immutable after issuance to keep the audit
-- clean — issue a new vouch instead).
ALTER TABLE exposure_vouches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exposure_vouches_select ON exposure_vouches;
CREATE POLICY exposure_vouches_select ON exposure_vouches
  FOR SELECT USING (true);

DROP POLICY IF EXISTS exposure_vouches_insert_elder ON exposure_vouches;
CREATE POLICY exposure_vouches_insert_elder ON exposure_vouches
  FOR INSERT WITH CHECK (auth.uid() = elder_id);

DROP POLICY IF EXISTS exposure_vouches_update ON exposure_vouches;
CREATE POLICY exposure_vouches_update ON exposure_vouches
  FOR UPDATE USING (false);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. RPC: can_join_circle. SECURITY DEFINER so the client can call it
--    without needing direct access to member_tier_status (kept tight by
--    its own policies). Returns FALSE on any missing data — fail closed.
--
--    Cap resolution:
--      1. Start from the user's own member_tier_status.max_exposure_cents
--         (or 50000 default if no row).
--      2. If there's an active exposure_vouches row, look up the cap for
--         that tier (CASE expression — kept in sync with the backfill
--         above; refactor into a config table if/when a third lookup
--         site appears) and use the HIGHER of the two.
--      3. Compare circle pot (member_count * amount * 100) to the cap.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_join_circle(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_count       INTEGER;
  v_amount             NUMERIC;
  v_pot_cents          BIGINT;
  v_max_exposure_cents INTEGER;
  v_voucher_tier       TEXT;
  v_voucher_cap        INTEGER;
BEGIN
  -- Pull the circle dimensions. NULL on either side → fail closed.
  SELECT member_count, amount
    INTO v_member_count, v_amount
  FROM circles
  WHERE id = p_circle_id;

  IF v_member_count IS NULL OR v_amount IS NULL THEN
    RETURN FALSE;
  END IF;

  v_pot_cents := (v_member_count * v_amount * 100)::BIGINT;

  -- Own tier cap. No row = newcomer default.
  SELECT max_exposure_cents
    INTO v_max_exposure_cents
  FROM member_tier_status
  WHERE user_id = p_user_id;

  IF v_max_exposure_cents IS NULL THEN
    v_max_exposure_cents := 50000;
  END IF;

  -- Active vouch override.
  SELECT temporary_tier
    INTO v_voucher_tier
  FROM exposure_vouches
  WHERE member_id = p_user_id
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_voucher_tier IS NOT NULL THEN
    v_voucher_cap := CASE v_voucher_tier
      WHEN 'newcomer'    THEN 50000
      WHEN 'established' THEN 200000
      WHEN 'elder'       THEN 500000
      WHEN 'critical'    THEN 0
      ELSE 50000
    END;
    IF v_voucher_cap > v_max_exposure_cents THEN
      v_max_exposure_cents := v_voucher_cap;
    END IF;
  END IF;

  RETURN v_pot_cents <= v_max_exposure_cents;
END;
$$;

GRANT EXECUTE ON FUNCTION can_join_circle(UUID, UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register per CLAUDE.md template.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '247',
  'member_tier_exposure_caps',
  ARRAY['-- 247: member_tier_exposure_caps']
)
ON CONFLICT (version) DO NOTHING;
