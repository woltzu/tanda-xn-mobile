-- ═══════════════════════════════════════════════════════════════════════════
-- 249: Resolution Center — demotion details + member-initiated review requests
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 2 Bucket B. Adds the data backbone for the Resolution Center screen
-- where critical-tier members can see why their account is restricted and
-- request an elder review. Companion to Phase 1 (247) max_exposure_cents
-- and Phase 2 Bucket A (248) roles + vouch_member.
--
-- Audit notes (verified read-only before writing):
--   • member_tier_status already has: is_demoted, demotion_reason,
--     demotion_path_back, previous_tier, tier_achieved_at. The spec's
--     ADD COLUMN IF NOT EXISTS for demotion_reason/_path_back is a
--     no-op (kept for idempotency / future tier-status drops).
--     demoted_at and reviewed_at are genuinely new columns.
--   • No CHECK constraint on current_tier — the four canonical values
--     (newcomer/established/elder/critical) are convention, not enforced.
--   • member_tier_history does NOT exist — the spec's "returning user
--     critical history" check has no table to query. Banner currently
--     fires on current_tier='critical' only; cross-account match is
--     a future-work item (privacy-sensitive, requires identity-stitch
--     design — see Bucket B follow-up note in commit message).
--
-- All new RPCs are SECURITY DEFINER with SET search_path = public,
-- pg_temp per Tier 4 hardening (Phase 4 lint cleanup).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Backfill columns. demotion_reason + demotion_path_back already exist
--    on the live schema; the IF NOT EXISTS keeps this idempotent.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE member_tier_status
  ADD COLUMN IF NOT EXISTS demotion_reason TEXT,
  ADD COLUMN IF NOT EXISTS demotion_path_back TEXT,
  ADD COLUMN IF NOT EXISTS demoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN member_tier_status.demoted_at IS
  'Timestamp the member was last demoted to critical. Distinct from '
  'tier_achieved_at, which tracks any tier transition. NULL when never '
  'demoted or after a successful review.';
COMMENT ON COLUMN member_tier_status.reviewed_at IS
  'Timestamp of the most recent elder review that resolved a demotion. '
  'Lets us distinguish a still-restricted member from one who was cleared.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. resolution_review_requests — one row per request a critical member
--    raises for elder review. Soft-state (status field) lets us preserve
--    the history of past requests + rejected ones for audit.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_review_requests (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment            TEXT,
  status             TEXT         NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'reviewed', 'resolved', 'rejected')),
  assigned_elder_id  UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  elder_comment      TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_review_user
  ON resolution_review_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resolution_review_pending
  ON resolution_review_requests (status, created_at DESC)
  WHERE status = 'pending';

-- Partial unique: at most ONE pending request per user (matches the
-- RPC's "already pending" check; the index makes it race-safe).
CREATE UNIQUE INDEX IF NOT EXISTS uq_resolution_review_one_pending
  ON resolution_review_requests (user_id)
  WHERE status = 'pending';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS — members read their own requests; elders read all (for the
--    queue screen). Writes go through SECURITY DEFINER RPCs only — no
--    direct INSERT/UPDATE policies.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE resolution_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resolution_review_requests_select ON resolution_review_requests;
CREATE POLICY resolution_review_requests_select ON resolution_review_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role LIKE 'elder%'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 4. get_demotion_details — read the live state for the Resolution Center
--    screen. Returns NULL fields gracefully if the user has no tier-status
--    row yet (e.g., brand-new account).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_demotion_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tier',                COALESCE(mts.current_tier, 'newcomer'),
    'is_demoted',          COALESCE(mts.is_demoted, false),
    'demotion_reason',     mts.demotion_reason,
    'demotion_path_back',  mts.demotion_path_back,
    'demoted_at',          mts.demoted_at,
    'reviewed_at',         mts.reviewed_at,
    'has_pending_review',  EXISTS (
      SELECT 1 FROM resolution_review_requests rrr
      WHERE rrr.user_id = p_user_id AND rrr.status = 'pending'
    ),
    'latest_request', (
      SELECT jsonb_build_object(
        'id', rrr.id,
        'status', rrr.status,
        'created_at', rrr.created_at,
        'elder_comment', rrr.elder_comment
      )
      FROM resolution_review_requests rrr
      WHERE rrr.user_id = p_user_id
      ORDER BY rrr.created_at DESC
      LIMIT 1
    )
  )
  INTO v_result
  FROM member_tier_status mts
  WHERE mts.user_id = p_user_id;

  -- If no tier-status row exists, return a synthesized baseline so the
  -- client gets a coherent shape and the banner stays hidden.
  IF v_result IS NULL THEN
    v_result := jsonb_build_object(
      'tier', 'newcomer',
      'is_demoted', false,
      'demotion_reason', NULL,
      'demotion_path_back', NULL,
      'demoted_at', NULL,
      'reviewed_at', NULL,
      'has_pending_review', false,
      'latest_request', NULL
    );
  END IF;

  RETURN v_result;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. request_resolution_review — member-initiated. Critical-tier gate +
--    one-pending-per-user gate. The partial unique index (#2 above)
--    backstops the EXISTS check against races.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_resolution_review(p_comment TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id UUID;
  v_current_tier TEXT;
BEGIN
  SELECT current_tier INTO v_current_tier
  FROM member_tier_status
  WHERE user_id = auth.uid();

  IF v_current_tier IS NULL OR v_current_tier <> 'critical' THEN
    RAISE EXCEPTION 'Only critical-tier members can request a resolution review';
  END IF;

  IF EXISTS (
    SELECT 1 FROM resolution_review_requests
    WHERE user_id = auth.uid() AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending review request';
  END IF;

  INSERT INTO resolution_review_requests (user_id, comment)
  VALUES (auth.uid(), p_comment)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. resolve_review_request — elder-initiated. On 'resolved' the member's
--    tier resets to 'established' (the canonical baseline restored tier),
--    max_exposure_cents back to the Phase 1 established cap, is_demoted
--    clears, and previous_tier preserves the prior 'critical' for audit.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_review_request(
  p_request_id  UUID,
  p_status      TEXT,
  p_comment     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    UUID;
  v_elder_role TEXT;
BEGIN
  -- Caller must be an elder.
  SELECT role INTO v_elder_role FROM profiles WHERE id = auth.uid();
  IF v_elder_role IS NULL OR v_elder_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can resolve review requests';
  END IF;

  -- Status must be a terminal value (not 'pending') — moving a request to
  -- 'pending' from a closed state would re-trigger the partial unique
  -- index from a stale row and is not a meaningful action.
  IF p_status NOT IN ('reviewed', 'resolved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  SELECT user_id INTO v_user_id
  FROM resolution_review_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found or already closed';
  END IF;

  UPDATE resolution_review_requests
  SET status            = p_status,
      assigned_elder_id = auth.uid(),
      elder_comment     = p_comment,
      updated_at        = NOW()
  WHERE id = p_request_id;

  -- On resolve, restore the member to 'established' and clear demotion
  -- artifacts. Other statuses leave member_tier_status untouched.
  IF p_status = 'resolved' THEN
    UPDATE member_tier_status
    SET current_tier        = 'established',
        previous_tier       = 'critical',
        is_demoted          = false,
        demotion_reason     = NULL,
        demotion_path_back  = NULL,
        demoted_at          = NULL,
        reviewed_at         = NOW(),
        max_exposure_cents  = 200000,  -- Phase 1 established cap
        tier_achieved_at    = NOW(),
        updated_at          = NOW()
    WHERE user_id = v_user_id;
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '249',
  'resolution_center',
  ARRAY['-- 249: resolution_center']
)
ON CONFLICT (version) DO NOTHING;
