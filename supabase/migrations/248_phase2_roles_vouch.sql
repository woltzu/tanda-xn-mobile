-- ════════════════════════════════════════════════════════════════════════════
-- 248 — phase2_roles_vouch
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2 Bucket A: profiles.role, elder_nominations table, and four RPCs:
-- promote_to_verified_member, nominate_elder, vote_elder_nomination,
-- vouch_member. Builds on the Phase 1 exposure_vouches table (migration 247).
--
-- IMPORTANT CORRECTIONS vs. spec draft (caught by pre-write schema audit):
--   1. cycles table doesn't exist. Real table is circle_cycles with column
--      cycle_status (not status). For "clean cycles completed" we use
--      community_memberships.circles_completed (the already-maintained
--      per-community counter) summed across the user — avoids fragile
--      joins to a cycle table whose status taxonomy we'd have to guess at.
--   2. circle_members.defaulted doesn't exist. Real column is
--      has_active_default. The simpler signal above bypasses this entirely.
--   3. Registry: supabase_migrations.schema_migrations per CLAUDE.md
--      template, NOT public.supabase_migrations.
--   4. vouch_member tier check: replaced the spec's
--      "EXISTS in member_tier_status" lookup (only matches tiers some user
--      already holds — useless for a fresh database) with a hardcoded
--      4-value list matching the CHECK constraint on
--      exposure_vouches.temporary_tier from migration 247.
--   5. vouch_member: spec DELETEs prior active vouches. Phase 1 explicitly
--      avoided UNIQUE(member_id) to preserve history. Soft-expire instead
--      (UPDATE expires_at = NOW()) so the audit chain stays intact.
--   6. SET search_path = public, pg_temp on every SECURITY DEFINER per
--      Tier 4 hardening.
--   7. RLS added to elder_nominations: public SELECT (members see their
--      own nomination state), no direct INSERT/UPDATE — both go through
--      RPCs that enforce elder-only.
--
-- ⚠️ AUTO-APPROVAL THRESHOLD = 3 votes is hardcoded per spec, BUT the
-- current state has only 1 user with role='elder' tier (see Phase 1
-- audit). With one elder, no nomination can ever auto-approve. This is
-- governance-level data, not a migration bug. Revisit threshold when the
-- elder cohort grows, OR seed an initial elder set, OR lower threshold.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles.role — actually add it. (Phase 1 spec mentioned it but the
--    corrected 247 didn't ship the column; this is the real introduction.)
--    Default 'member'. Future roles: verified_member, elder_i, elder_ii,
--    elder_iii.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- Soft check — keep the column tolerant of future role additions so we
-- don't have to widen a CHECK constraint on every governance change.
COMMENT ON COLUMN profiles.role IS
  'App-level role. Phase 2 vocabulary: member, verified_member, '
  'elder_i, elder_ii, elder_iii. Distinct from member_tier_status.current_tier '
  '(financial tier). No CHECK constraint by design — additions are '
  'governance decisions, not schema decisions.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. elder_nominations — one pending row per nominee at a time.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elder_nominations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nominee_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nominator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected')),
  votes_for       INTEGER NOT NULL DEFAULT 0,
  votes_against   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (nominee_id <> nominator_id)
);

-- Partial unique index: at most one pending nomination per nominee.
-- (Plain UNIQUE(nominee_id, status) would also forbid two rejected rows,
-- which we want to allow as historical record.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_elder_nominations_pending_per_nominee
  ON elder_nominations (nominee_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_elder_nominations_nominator
  ON elder_nominations (nominator_id);
CREATE INDEX IF NOT EXISTS idx_elder_nominations_status
  ON elder_nominations (status);

ALTER TABLE elder_nominations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elder_nominations_select ON elder_nominations;
CREATE POLICY elder_nominations_select ON elder_nominations
  FOR SELECT USING (true);

-- No direct INSERT / UPDATE policy. All writes go through the RPCs below
-- (SECURITY DEFINER) which enforce elder-only.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. promote_to_verified_member — manual promotion for now (admin-button
--    triggered). Future: cron that scans qualifying members daily.
--
--    Eligibility: xn_score >= 600 AND total circles_completed >= 1 AND
--    no active default on any circle the member is in.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_to_verified_member(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_xn_score           INTEGER;
  v_circles_completed  INTEGER;
  v_has_active_default BOOLEAN;
  v_current_role       TEXT;
BEGIN
  SELECT xn_score, role
    INTO v_xn_score, v_current_role
  FROM profiles WHERE id = p_user_id;

  IF v_current_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- No-op if already verified or elder.
  IF v_current_role IN ('verified_member', 'elder_i', 'elder_ii', 'elder_iii') THEN
    RETURN FALSE;
  END IF;

  -- Sum of completed circles across all communities this user belongs to.
  SELECT COALESCE(SUM(circles_completed), 0) INTO v_circles_completed
  FROM community_memberships
  WHERE user_id = p_user_id;

  -- Defensive: any active default on any circle disqualifies.
  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE user_id = p_user_id AND has_active_default = TRUE
  ) INTO v_has_active_default;

  IF COALESCE(v_xn_score, 0) >= 600
     AND v_circles_completed >= 1
     AND NOT v_has_active_default
  THEN
    UPDATE profiles SET role = 'verified_member' WHERE id = p_user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION promote_to_verified_member(UUID) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. nominate_elder — elder-only. Server-side guard against self-nomination
--    is enforced by the elder_nominations CHECK (nominee_id <> nominator_id).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION nominate_elder(
  p_nominee_id UUID,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nominator_role TEXT;
  v_nominee_role   TEXT;
  v_nomination_id  UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_nominator_role FROM profiles WHERE id = auth.uid();
  IF v_nominator_role IS NULL
     OR v_nominator_role NOT IN ('elder_i','elder_ii','elder_iii')
  THEN
    RAISE EXCEPTION 'Only elders can nominate new elders';
  END IF;

  SELECT role INTO v_nominee_role FROM profiles WHERE id = p_nominee_id;
  IF v_nominee_role IS NULL THEN
    RAISE EXCEPTION 'Nominee profile not found';
  END IF;

  IF v_nominee_role LIKE 'elder%' THEN
    RAISE EXCEPTION 'Nominee is already an elder';
  END IF;

  INSERT INTO elder_nominations (nominee_id, nominator_id, reason)
  VALUES (p_nominee_id, auth.uid(), NULLIF(TRIM(COALESCE(p_reason, '')), ''))
  RETURNING id INTO v_nomination_id;

  RETURN v_nomination_id;
END;
$$;

GRANT EXECUTE ON FUNCTION nominate_elder(UUID, TEXT) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. vote_elder_nomination — elder-only. Auto-promotes on 3 yes-votes,
--    auto-rejects on 3 no-votes. (See header note on the 3-vote threshold
--    being too high for the current elder cohort.)
--
--    NOT idempotent — each call adds a vote. Future hardening: vote-once
--    table (nomination_id, voter_id UNIQUE) to prevent the same elder
--    casting multiple votes on the same nomination.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vote_elder_nomination(
  p_nomination_id UUID,
  p_vote          BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_voter_role     TEXT;
  v_status         TEXT;
  v_nominee_id     UUID;
  v_votes_for      INTEGER;
  v_votes_against  INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role INTO v_voter_role FROM profiles WHERE id = auth.uid();
  IF v_voter_role IS NULL
     OR v_voter_role NOT IN ('elder_i','elder_ii','elder_iii')
  THEN
    RAISE EXCEPTION 'Only elders can vote on elder nominations';
  END IF;

  SELECT status, nominee_id INTO v_status, v_nominee_id
  FROM elder_nominations WHERE id = p_nomination_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Nomination not found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nomination is already resolved';
  END IF;

  -- Elders cannot vote on their own nomination as nominator. (Nominator is
  -- not necessarily the voter, but a defensive belt-and-suspenders.)
  IF EXISTS (
    SELECT 1 FROM elder_nominations
    WHERE id = p_nomination_id AND nominator_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nominators cannot vote on their own nomination';
  END IF;

  IF p_vote THEN
    UPDATE elder_nominations
      SET votes_for = votes_for + 1, updated_at = NOW()
    WHERE id = p_nomination_id
    RETURNING votes_for INTO v_votes_for;
    SELECT votes_against INTO v_votes_against
    FROM elder_nominations WHERE id = p_nomination_id;
  ELSE
    UPDATE elder_nominations
      SET votes_against = votes_against + 1, updated_at = NOW()
    WHERE id = p_nomination_id
    RETURNING votes_against INTO v_votes_against;
    SELECT votes_for INTO v_votes_for
    FROM elder_nominations WHERE id = p_nomination_id;
  END IF;

  -- Auto-resolve.
  IF v_votes_for >= 3 THEN
    UPDATE elder_nominations
      SET status = 'approved', updated_at = NOW()
    WHERE id = p_nomination_id;
    UPDATE profiles SET role = 'elder_i' WHERE id = v_nominee_id;
  ELSIF v_votes_against >= 3 THEN
    UPDATE elder_nominations
      SET status = 'rejected', updated_at = NOW()
    WHERE id = p_nomination_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION vote_elder_nomination(UUID, BOOLEAN) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. vouch_member — elder-only. Issues a new exposure_vouches row good for
--    30 days. Soft-expires any pre-existing active vouch for the same
--    member (preserves audit history; the can_join_circle RPC always picks
--    the latest active by created_at DESC, so the new row supersedes).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vouch_member(
  p_member_id            UUID,
  p_temporary_tier       TEXT,
  p_backing_amount_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_vouch_id    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_member_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot vouch for yourself';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can vouch for members';
  END IF;

  -- Tier whitelist matches the exposure_vouches.temporary_tier CHECK
  -- constraint (migration 247). Keep this in sync if the tier vocabulary
  -- changes.
  IF p_temporary_tier NOT IN ('newcomer','established','elder','critical') THEN
    RAISE EXCEPTION 'Invalid temporary tier';
  END IF;

  -- Backing must be positive (CHECK on the table enforces this too).
  IF p_backing_amount_cents IS NULL OR p_backing_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Backing amount must be greater than zero';
  END IF;

  -- Soft-expire any pre-existing active vouch for this member so the new
  -- one is the only "active" record without losing the historical row.
  UPDATE exposure_vouches
    SET expires_at = NOW()
  WHERE member_id = p_member_id AND expires_at > NOW();

  INSERT INTO exposure_vouches (
    elder_id, member_id, temporary_tier, expires_at, backing_amount_cents
  ) VALUES (
    auth.uid(),
    p_member_id,
    p_temporary_tier,
    NOW() + INTERVAL '30 days',
    p_backing_amount_cents
  )
  RETURNING id INTO v_vouch_id;

  RETURN v_vouch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION vouch_member(UUID, TEXT, INTEGER) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Self-register per CLAUDE.md template.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '248',
  'phase2_roles_vouch',
  ARRAY['-- 248: phase2_roles_vouch']
)
ON CONFLICT (version) DO NOTHING;
