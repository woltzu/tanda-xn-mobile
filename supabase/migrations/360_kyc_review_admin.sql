-- ═══════════════════════════════════════════════════════════════════════════
-- 360_kyc_review_admin.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin-review plumbing for the KYC fallback flow.
--
-- Two things:
--
-- (a) Audit columns on kyc_verifications — who reviewed the row, when,
--     and any free-form notes they left. Required for compliance-side
--     audit later; also cheap to add now while we're touching the table.
--
-- (b) Two SECURITY DEFINER RPCs that admin screens call to approve or
--     reject a submission. Both:
--       * Gate on `is_admin(auth.uid())` from mig 114.
--       * Stamp reviewed_by / reviewed_at.
--       * Approve additionally accepts the four extracted_* fields the
--         reviewer captured off the ID documents, plus the kyc_tier to
--         assign. Flipping status → 'approved' fires the mig 359
--         trigger, which propagates tier + status + extracted fields
--         into profiles.
--       * Reject additionally writes rejection_code (short label) so
--         KYCDocumentScreen's rejection-banner humanizer (mig 160) can
--         surface it back to the user.
--
-- Idempotency: neither RPC touches rows that are already 'approved'
-- (approve short-circuits; reject is gated to pending states). Re-
-- calling approve on the same row is a no-op after the first success
-- because the WHERE clause excludes 'approved'.
--
-- Allowed transitions:
--   approve: {pending, provider_pending, rejected} → approved
--     (rejected is included so an admin can un-reject after finding
--      an earlier decision was wrong)
--   reject:  {pending, provider_pending} → rejected
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Audit columns ─────────────────────────────────────────────────────

ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS admin_notes  TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.kyc_verifications.admin_notes IS
  'Freeform reviewer notes. Appended to (not overwritten) on every '
  'approve/reject RPC call — each entry is prefixed with a timestamp '
  'and action label for audit legibility.';
COMMENT ON COLUMN public.kyc_verifications.reviewed_by IS
  'The admin_users user_id who most-recently approved or rejected this '
  'row. Updated on every review action.';

-- ─── 2. approve_kyc_verification ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_kyc_verification(
  p_verification_id           UUID,
  p_extracted_full_name       TEXT DEFAULT NULL,
  p_extracted_dob             DATE DEFAULT NULL,
  p_extracted_address         TEXT DEFAULT NULL,
  p_extracted_document_number TEXT DEFAULT NULL,
  p_kyc_tier                  INT  DEFAULT 1,
  p_notes                     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_row         RECORD;
BEGIN
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT public.is_admin(v_reviewer_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_kyc_tier IS NOT NULL AND p_kyc_tier NOT BETWEEN 0 AND 4 THEN
    RAISE EXCEPTION 'invalid_tier:%', p_kyc_tier;
  END IF;

  UPDATE public.kyc_verifications
     SET status                    = 'approved',
         extracted_full_name       = COALESCE(p_extracted_full_name,       extracted_full_name),
         extracted_dob             = COALESCE(p_extracted_dob,             extracted_dob),
         extracted_address         = COALESCE(p_extracted_address,         extracted_address),
         extracted_document_number = COALESCE(p_extracted_document_number, extracted_document_number),
         kyc_tier                  = COALESCE(p_kyc_tier,                  kyc_tier),
         admin_notes               = CASE
           WHEN p_notes IS NULL OR TRIM(p_notes) = '' THEN admin_notes
           ELSE COALESCE(admin_notes || E'\n', '')
                || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
                || ' [approve]: ' || p_notes
         END,
         reviewed_by = v_reviewer_id,
         reviewed_at = NOW(),
         updated_at  = NOW()
   WHERE id = p_verification_id
     AND status IN ('pending', 'provider_pending', 'rejected')
  RETURNING id, member_id, status
       INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kyc_row_not_found_or_not_reviewable';
  END IF;

  -- The mig 359 AFTER UPDATE trigger fires here, propagating tier +
  -- status + extracted fields into public.profiles.

  RETURN jsonb_build_object(
    'success',         TRUE,
    'verification_id', v_row.id,
    'member_id',       v_row.member_id,
    'status',          v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_kyc_verification(UUID, TEXT, DATE, TEXT, TEXT, INT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_kyc_verification(UUID, TEXT, DATE, TEXT, TEXT, INT, TEXT)
  TO authenticated;

-- ─── 3. reject_kyc_verification ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_kyc_verification(
  p_verification_id UUID,
  p_reason          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_row         RECORD;
BEGIN
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT public.is_admin(v_reviewer_id) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'reason_required';
  END IF;

  UPDATE public.kyc_verifications
     SET status         = 'rejected',
         rejection_code = LEFT(TRIM(p_reason), 100),
         admin_notes    = COALESCE(admin_notes || E'\n', '')
                          || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
                          || ' [reject]: ' || p_reason,
         reviewed_by    = v_reviewer_id,
         reviewed_at    = NOW(),
         updated_at     = NOW()
   WHERE id = p_verification_id
     AND status IN ('pending', 'provider_pending')
  RETURNING id, member_id
       INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'kyc_row_not_found_or_not_reviewable';
  END IF;

  RETURN jsonb_build_object(
    'success',         TRUE,
    'verification_id', v_row.id,
    'member_id',       v_row.member_id,
    'status',          'rejected'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_kyc_verification(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_kyc_verification(UUID, TEXT) TO authenticated;

-- ─── 4. Self-register ─────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '360',
  'kyc_review_admin',
  ARRAY['-- 360: kyc_verifications audit columns + approve/reject admin RPCs']
)
ON CONFLICT (version) DO NOTHING;
