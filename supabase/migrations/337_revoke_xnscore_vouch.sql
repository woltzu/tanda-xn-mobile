-- ═══════════════════════════════════════════════════════════════════════════
-- 337_revoke_xnscore_vouch.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds revoke_xnscore_vouch(p_vouch_id UUID, p_reason TEXT) for System A
-- vouches (the XnScore ones tracked in `vouches`, created by mig 019's
-- create_vouch).
--
-- The name deviates from the spec's `revoke_vouch` to AVOID COLLISION
-- with mig 252's revoke_vouch(p_member_id UUID) for System B (elder
-- exposure_vouches). Postgres identifies functions by (name,
-- argument-types); parameter names aren't part of the signature. A
-- CREATE FUNCTION revoke_vouch(UUID) here would REPLACE mig 252's
-- function and break the elder revoke flow. Distinct name is safer.
--
-- Effects (single transaction):
--   1. Look up vouch by id; fail if missing.
--   2. Reject if vouch_status != 'active' or expires_at is in the past.
--   3. Authorize: caller must be the voucher OR have profiles.role='admin'.
--   4. Reverse both apply_xnscore_adjustment calls that create_vouch made:
--        vouchee: -diluted_vouch_value, trigger_event 'vouch_revoked'
--        voucher: -0.5,                 trigger_event 'vouch_revoked'
--      apply_xnscore_adjustment writes to xnscore_history and enforces
--      score-freeze + velocity caps internally — so a frozen or velocity-
--      capped user's row is a no-op (the revoke still lands as far as the
--      vouches row is concerned; the score reversal is skipped by design).
--   5. Flip the vouches row: vouch_status='revoked', revoked_at=NOW(),
--      revoked_reason.
--   6. Log to vouch_audit_log with action='revoked'. Semantic reuse of
--      the System B audit table because no System A audit log exists yet;
--      voucher → elder_id, vouchee → member_id, temporary_tier and
--      backing_amount_cents stay NULL. Insert wrapped in EXCEPTION so an
--      audit-write failure doesn't block the revocation itself
--      (xnscore_history still carries the score-level trail).
--
-- Idempotency:
--   * A second call on the same vouch fails at step 2 with 'vouch_not_active',
--     so we don't double-charge the score.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.revoke_xnscore_vouch(
    p_vouch_id UUID,
    p_reason   TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_caller_id   UUID := auth.uid();
    v_caller_role TEXT;
    v_vouch       RECORD;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'auth_required';
    END IF;

    SELECT * INTO v_vouch FROM public.vouches WHERE id = p_vouch_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'vouch_not_found';
    END IF;

    IF v_vouch.vouch_status != 'active' THEN
        RAISE EXCEPTION 'vouch_not_active';
    END IF;

    IF v_vouch.expires_at IS NOT NULL AND v_vouch.expires_at <= NOW() THEN
        RAISE EXCEPTION 'vouch_expired';
    END IF;

    IF v_vouch.voucher_user_id != v_caller_id THEN
        SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
        IF v_caller_role IS DISTINCT FROM 'admin' THEN
            RAISE EXCEPTION 'not_authorized';
        END IF;
    END IF;

    -- Reverse score adjustments. apply_xnscore_adjustment tolerates
    -- frozen / velocity-capped users internally (returns success=false
    -- rather than raising) so we don't need to guard here.
    PERFORM public.apply_xnscore_adjustment(
        v_vouch.vouchee_user_id,
        -v_vouch.diluted_vouch_value,
        'vouch_revoked',
        p_vouch_id
    );
    PERFORM public.apply_xnscore_adjustment(
        v_vouch.voucher_user_id,
        -0.5,
        'vouch_revoked',
        p_vouch_id
    );

    UPDATE public.vouches
       SET vouch_status   = 'revoked',
           revoked_at     = NOW(),
           revoked_reason = COALESCE(p_reason, 'revoked_by_user')
     WHERE id = p_vouch_id;

    BEGIN
        INSERT INTO public.vouch_audit_log
            (elder_id, member_id, action, temporary_tier, backing_amount_cents)
        VALUES
            (v_vouch.voucher_user_id, v_vouch.vouchee_user_id,
             'revoked', NULL, NULL);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'vouch_audit_log insert failed for vouch %: %',
                     p_vouch_id, SQLERRM;
    END;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '337',
  'revoke_xnscore_vouch',
  ARRAY['-- 337: revoke_xnscore_vouch RPC for System A — distinct name from mig 252 revoke_vouch to avoid signature collision']
)
ON CONFLICT (version) DO NOTHING;
