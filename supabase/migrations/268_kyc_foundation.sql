-- ═══════════════════════════════════════════════════════════════════════════
-- 268: KYC foundation — additive columns, requests table, status RPCs
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds the audit trail + admin-update plumbing on top of the existing
-- KYC schema. The spec was written without visibility into the 9 kyc_*
-- tables and the existing profiles.kyc_status column, so the bodies
-- here align to what's actually in prod rather than ship a vocabulary
-- clash.
--
-- Spec deviations (verified read-only before writing):
--
--   * profiles.kyc_status already exists with CHECK
--       (kyc_status = ANY (ARRAY['none','pending','verified','rejected']))
--     and DEFAULT 'none'. The spec's DEFAULT 'unverified' + new CHECK
--     would be skipped by `ADD COLUMN IF NOT EXISTS`, but the spec's
--     RPC bodies then write values ('unverified', 'tier1_verified',
--     'tier2_verified') that violate the live CHECK — submit_kyc and
--     update_kyc_status would error on every call. Rewrote the bodies
--     to use the existing vocabulary so the RPCs actually work in prod.
--     A future migration can widen the CHECK to introduce tier1/tier2
--     once readers are ready.
--
--   * profiles.kyc_level INTEGER DEFAULT 0 already exists for tier
--     tracking (0 = unverified, 1 = tier1, 2 = tier2). get_kyc_status
--     now returns it alongside the status string so callers don't need
--     a second round-trip.
--
--   * Spec's submit_kyc gate `kyc_status IN ('unverified', 'rejected')`
--     matches zero prod rows (the live default is 'none'). Rewrote to
--     `kyc_status IN ('none', 'rejected')`.
--
--   * Spec's update_kyc_status used `UPDATE … WHERE … ORDER BY … LIMIT 1`
--     which is a Postgres syntax error (UPDATE doesn't accept ORDER BY
--     or LIMIT directly). Rewrote as `UPDATE … WHERE id = (SELECT id
--     FROM … ORDER BY … LIMIT 1)`.
--
--   * Registry table corrected from spec's bare `supabase_migrations`
--     to `supabase_migrations.schema_migrations`. Recurring spec bug
--     fixed in 263 / 264 / 265 / 266 / 267.
--
--   * Tier 4 hardening: SET search_path = public, pg_temp on all three
--     function bodies. Spec only had it on the first two.
--
--   * The spec's accepted statuses for update_kyc_status was
--     ('tier1_verified', 'tier2_verified', 'rejected'). Narrowed to
--     ('verified', 'rejected') to match the live CHECK. Elders/admins
--     can move users from pending → verified or pending → rejected;
--     fine-grained tier transitions go through profiles.kyc_level
--     directly until the CHECK is widened.
--
-- Non-collision notes:
--
--   * kyc_verification_requests is genuinely new (9 existing kyc_*
--     tables, but none with this submission-queue shape). It's
--     additive — no overlap with kyc_verifications or kyc_admin_reviews
--     based on column inspection.
--
--   * No RLS policies on kyc_verification_requests in this migration —
--     access is intended through the SECURITY DEFINER RPCs. Future
--     migration can add RLS if direct table reads become a use case.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles — additive audit columns. kyc_status + kyc_level already
--    exist; we add the timestamps + the freeform jsonb data column.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kyc_data         JSONB DEFAULT '{}'::jsonb;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. kyc_verification_requests — submission queue + audit trail.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_verification_requests (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  request_type        TEXT         NOT NULL
                                   CHECK (request_type IN ('tier1', 'tier2', 'stripe_identity')),
  status              TEXT         NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'approved', 'rejected', 'error')),
  submitted_data      JSONB,
  external_reference  TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_verification_requests_user
  ON kyc_verification_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_verification_requests_pending
  ON kyc_verification_requests(user_id)
  WHERE status = 'pending';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. get_kyc_status — current user's KYC snapshot.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_kyc_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'status',       kyc_status,
    'level',        kyc_level,
    'submitted_at', kyc_submitted_at,
    'verified_at',  kyc_verified_at
  )
    INTO v_result
    FROM profiles
   WHERE id = auth.uid();

  RETURN v_result;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. submit_kyc — user-initiated submission. Gates on existing
--    vocabulary ('none' or 'rejected'). Moves status to 'pending',
--    stamps kyc_submitted_at, merges p_data into kyc_data, and queues
--    a row in kyc_verification_requests for admin review.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_kyc(p_data JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND kyc_status IN ('none', 'rejected')
  ) THEN
    RAISE EXCEPTION 'KYC cannot be submitted at this time';
  END IF;

  UPDATE profiles
  SET kyc_data         = COALESCE(kyc_data, '{}'::jsonb) || p_data,
      kyc_status       = 'pending',
      kyc_submitted_at = NOW()
  WHERE id = auth.uid();

  INSERT INTO kyc_verification_requests (user_id, request_type, submitted_data)
  VALUES (auth.uid(), 'tier1', p_data);

  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. update_kyc_status — elder/admin-only status flip.
--    Accepts the live CHECK vocabulary ('verified' | 'rejected').
--    The newest pending request for the target user gets its status
--    flipped to match ('approved' / 'rejected') and notes appended.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_kyc_status(
  p_user_id UUID,
  p_status  TEXT,
  p_notes   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Caller must be an elder (any tier) or an active admin.
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role LIKE 'elder%'
  ) AND NOT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only elders or admins can update KYC status';
  END IF;

  IF p_status NOT IN ('verified', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status — must be verified or rejected';
  END IF;

  UPDATE profiles
  SET kyc_status      = p_status,
      kyc_verified_at = CASE
                          WHEN p_status = 'verified' THEN NOW()
                          ELSE NULL
                        END
  WHERE id = p_user_id;

  -- Flip the newest pending request. Postgres doesn't accept ORDER BY
  -- + LIMIT directly on UPDATE — the subquery pattern is required.
  UPDATE kyc_verification_requests
  SET status     = CASE
                     WHEN p_status = 'verified' THEN 'approved'
                     ELSE 'rejected'
                   END,
      notes      = COALESCE(notes, '')
                   || CASE WHEN p_notes IS NOT NULL THEN '| ' || p_notes ELSE '' END,
      updated_at = NOW()
  WHERE id = (
    SELECT id FROM kyc_verification_requests
    WHERE user_id = p_user_id
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
  );

  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '268',
  'kyc_foundation',
  ARRAY['-- 268: kyc_foundation']
)
ON CONFLICT (version) DO NOTHING;
