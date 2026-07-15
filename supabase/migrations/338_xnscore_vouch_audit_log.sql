-- ═══════════════════════════════════════════════════════════════════════════
-- 338_xnscore_vouch_audit_log.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Dedicated audit table for System A vouches (the XnScore ones from
-- mig 019's create_vouch + mig 337's revoke_xnscore_vouch). Splits away
-- from mig 252's vouch_audit_log which was originally built for System B
-- (elder exposure_vouches). Mig 337 was reusing that table with
-- semantic overload (voucher→elder_id, vouchee→member_id, temporary_tier
-- / backing_amount_cents stay NULL); this migration ends that overload.
--
-- Table shape carries fields the System B table couldn't (vouch_id FK,
-- signed value_numeric for the score delta, reason string). Both audit
-- tables coexist — vouch_audit_log stays untouched for the elder flow.
--
-- Both RPCs are rewritten to log to the new table:
--
--   create_vouch          → logs action='created' with value_numeric =
--                           +diluted_vouch_value on success.
--   revoke_xnscore_vouch  → swaps the vouch_audit_log INSERT for the
--                           new-table INSERT with action='revoked',
--                           value_numeric = -diluted_vouch_value,
--                           reason = whatever the caller passed.
--
-- Audit inserts are wrapped in EXCEPTION so an audit-write failure
-- never blocks the actual score/row mutation (same defensive pattern
-- mig 337 established).
--
-- Expiration logging is not wired here — vouches with expires_at in
-- the past aren't currently swept by any cron. When someone builds
-- that expiration processor, it can log action='expired' with
-- value_numeric=0 (score adjustment already happened when the vouch
-- was originally applied; expiration just retires the row).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. New audit table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.xnscore_vouch_audit_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  vouch_id     UUID         REFERENCES public.vouches(id)   ON DELETE CASCADE,
  voucher_id   UUID         REFERENCES public.profiles(id)  ON DELETE CASCADE,
  vouchee_id   UUID         REFERENCES public.profiles(id)  ON DELETE CASCADE,
  action       TEXT         NOT NULL CHECK (action IN ('created','revoked','expired')),
  value_numeric NUMERIC,
  reason       TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xnscore_vouch_audit_voucher
  ON public.xnscore_vouch_audit_log (voucher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xnscore_vouch_audit_vouchee
  ON public.xnscore_vouch_audit_log (vouchee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xnscore_vouch_audit_vouch_id
  ON public.xnscore_vouch_audit_log (vouch_id);

-- RLS — voucher and vouchee both see their own audit rows; writes
-- happen inside SECURITY DEFINER RPCs so no INSERT/UPDATE/DELETE policy
-- is needed for user roles.
ALTER TABLE public.xnscore_vouch_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS xnscore_vouch_audit_log_select ON public.xnscore_vouch_audit_log;
CREATE POLICY xnscore_vouch_audit_log_select ON public.xnscore_vouch_audit_log
  FOR SELECT USING (voucher_id = auth.uid() OR vouchee_id = auth.uid());

-- ─── 2. Replace create_vouch (mig 019 body) to log the create ───────────
-- Body preserved verbatim from mig 019 except for the new audit-log
-- INSERT at the end. Signature unchanged so CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.create_vouch(
    p_voucher_id   UUID,
    p_vouchee_id   UUID,
    p_reason       TEXT DEFAULT NULL,
    p_relationship TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limits   RECORD;
    v_value    RECORD;
    v_vouch_id UUID;
BEGIN
    SELECT * INTO v_limits FROM public.get_vouch_limits(p_voucher_id);

    IF NOT v_limits.can_vouch THEN
        RAISE EXCEPTION 'Cannot vouch: %', v_limits.reason;
    END IF;

    IF p_voucher_id = p_vouchee_id THEN
        RAISE EXCEPTION 'Cannot vouch for yourself';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.vouches
         WHERE voucher_user_id = p_voucher_id
           AND vouchee_user_id = p_vouchee_id
           AND vouch_status    = 'active'
    ) THEN
        RAISE EXCEPTION 'Already have an active vouch for this user';
    END IF;

    SELECT * INTO v_value FROM public.calculate_vouch_value(p_voucher_id, p_vouchee_id);

    INSERT INTO public.vouches (
        voucher_user_id, vouchee_user_id,
        voucher_xnscore_at_vouch,
        vouch_sequence,
        raw_vouch_value, diluted_vouch_value,
        vouch_reason, relationship_type,
        expires_at
    ) VALUES (
        p_voucher_id, p_vouchee_id,
        v_value.voucher_score,
        v_value.sequence_number,
        v_value.raw_value, v_value.diluted_value,
        p_reason, p_relationship,
        NOW() + INTERVAL '1 year'
    )
    RETURNING id INTO v_vouch_id;

    PERFORM public.apply_xnscore_adjustment(
        p_vouchee_id, v_value.diluted_value, 'vouch_received', v_vouch_id);

    PERFORM public.apply_xnscore_adjustment(
        p_voucher_id, 0.5, 'vouch_given', v_vouch_id);

    -- NEW in mig 338: log to the dedicated System A audit table.
    -- value_numeric = the diluted value applied to the vouchee (positive
    -- because a create RAISED their score). Wrapped so an audit-write
    -- failure doesn't undo the vouch itself.
    BEGIN
        INSERT INTO public.xnscore_vouch_audit_log
            (vouch_id, voucher_id, vouchee_id, action, value_numeric, reason)
        VALUES
            (v_vouch_id, p_voucher_id, p_vouchee_id,
             'created', v_value.diluted_value, p_reason);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'xnscore_vouch_audit_log insert failed for create vouch %: %',
                     v_vouch_id, SQLERRM;
    END;

    RETURN v_vouch_id;
END;
$$;

-- ─── 3. Rewrite revoke_xnscore_vouch to use the new audit table ─────────
-- Signature unchanged; body swaps the vouch_audit_log INSERT for the
-- xnscore_vouch_audit_log one. Everything else preserved from mig 337.

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

    -- Log to the dedicated System A audit table. value_numeric =
    -- -diluted_vouch_value (negative because a revoke LOWERED the
    -- vouchee's score). The +0.5 voucher-side reversal isn't captured
    -- separately here — the diluted value is the anchor; the +0.5 is a
    -- fixed protocol constant. xnscore_history has the full four-row
    -- score-level trail (given/received/revoked-both-sides) linked by
    -- trigger_id = vouch_id if a caller needs it.
    BEGIN
        INSERT INTO public.xnscore_vouch_audit_log
            (vouch_id, voucher_id, vouchee_id, action, value_numeric, reason)
        VALUES
            (p_vouch_id, v_vouch.voucher_user_id, v_vouch.vouchee_user_id,
             'revoked', -v_vouch.diluted_vouch_value,
             COALESCE(p_reason, 'revoked_by_user'));
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'xnscore_vouch_audit_log insert failed for revoke vouch %: %',
                     p_vouch_id, SQLERRM;
    END;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_xnscore_vouch(UUID, TEXT) TO authenticated;

-- ─── 4. Batch counts helper for the circle-member-list trust icon ───────
-- One round-trip: caller passes an array of user_ids, gets back rows
-- for those with ≥1 active non-expired vouch received. Avoids N+1
-- from the client and sidesteps whatever RLS shape the vouches table
-- has (SECURITY DEFINER inside a locked-down grant).

CREATE OR REPLACE FUNCTION public.get_active_vouches_received_counts(
    p_user_ids UUID[]
)
RETURNS TABLE (user_id UUID, vouch_count INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT v.vouchee_user_id, COUNT(*)::INTEGER
    FROM public.vouches v
   WHERE v.vouchee_user_id = ANY(p_user_ids)
     AND v.vouch_status    = 'active'
     AND (v.expires_at IS NULL OR v.expires_at > NOW())
   GROUP BY v.vouchee_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_active_vouches_received_counts(UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_active_vouches_received_counts(UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_active_vouches_received_counts(UUID[]) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '338',
  'xnscore_vouch_audit_log',
  ARRAY['-- 338: dedicated System A audit table + create_vouch/revoke_xnscore_vouch log to it + batch counts helper']
)
ON CONFLICT (version) DO NOTHING;
