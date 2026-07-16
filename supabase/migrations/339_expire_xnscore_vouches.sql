-- ═══════════════════════════════════════════════════════════════════════════
-- 339_expire_xnscore_vouches.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Daily cleanup for System A vouches (mig 019 create_vouch + mig 337
-- revoke_xnscore_vouch). Vouches carry expires_at = created_at + 1 year
-- but nothing was flipping status to 'expired' when that timestamp
-- passed. Result: past-expires_at rows stayed vouch_status='active'
-- forever. The community_standing factor was still filtering them out
-- correctly (`expires_at > NOW()` guard), so scores were unaffected —
-- but the audit trail was silent on expirations and the vouches row's
-- status was misleading.
--
-- Fix: daily pg_cron at 02:00 UTC calls expire_vouches() which:
--   1. Finds all vouch_status='active' rows whose expires_at is in
--      the past.
--   2. Flips vouch_status='expired' and stamps expired_at=NOW().
--   3. Appends an audit row to xnscore_vouch_audit_log with
--      action='expired', value_numeric=0, reason='auto_expired'.
--   4. Returns the count.
--
-- Score impact: NONE (by design). The community_standing factor
-- already filters expired vouches; their score contribution naturally
-- rolls off next recalc. Unlike revoke — which is an explicit user
-- action requiring a bilateral score reversal — expiration is passive
-- housekeeping. Documented in the audit row's value_numeric=0.
--
-- Also adds:
--   * expired_at column on vouches (mig 019 had revoked_at, not
--     expired_at, so the two lifecycle end-states are now distinct).
--   * 'expired' enum value on vouch_status (defensive IF NOT EXISTS
--     since TypeScript already lists it as valid; may already be
--     present).
--
-- Deviation from spec's Option A: pg_cron calls the SQL function
-- directly (matching mig 252's vouch-expiry-reminder cron) rather
-- than going through an HTTP hop to the Edge Function. Rationale:
-- no pg_net extension dependency, no HTTP failure surface, and the
-- existing repo pattern is direct SQL calls. The Edge Function
-- (supabase/functions/expire-vouches/) is still provided as a
-- manual/admin entry point — it thin-wraps the same RPC and returns
-- the count as JSON for observability.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Enum + column additions ─────────────────────────────────────────
-- ADD VALUE cannot be USED in the same transaction where it's added,
-- but the function below only references 'expired' as a string
-- literal, coerced to enum at execution time — safe. Same pattern
-- mig 309 established when it added 'refunded' to contribution_status.

ALTER TYPE vouch_status ADD VALUE IF NOT EXISTS 'expired';

ALTER TABLE public.vouches
  ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

COMMENT ON COLUMN public.vouches.expired_at IS
  'Set by expire_vouches() when the daily cron flips a past-expires_at '
  'row from active to expired. Distinct from revoked_at (which is set '
  'only by explicit user/admin revocation via revoke_xnscore_vouch).';

-- ─── 2. expire_vouches() ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.expire_vouches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_count INTEGER := 0;
    v_row   RECORD;
BEGIN
    FOR v_row IN
        SELECT id, voucher_user_id, vouchee_user_id
          FROM public.vouches
         WHERE vouch_status = 'active'
           AND expires_at IS NOT NULL
           AND expires_at < NOW()
         FOR UPDATE
    LOOP
        UPDATE public.vouches
           SET vouch_status = 'expired',
               expired_at   = NOW()
         WHERE id = v_row.id;

        -- Audit log. Wrapped in EXCEPTION so an audit-write failure
        -- doesn't leave the vouches row half-updated (the UPDATE has
        -- already committed conceptually within this iteration).
        BEGIN
            INSERT INTO public.xnscore_vouch_audit_log
                (vouch_id, voucher_id, vouchee_id, action, value_numeric, reason)
            VALUES
                (v_row.id, v_row.voucher_user_id, v_row.vouchee_user_id,
                 'expired', 0, 'auto_expired');
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'xnscore_vouch_audit_log insert failed for expired vouch %: %',
                         v_row.id, SQLERRM;
        END;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_vouches() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_vouches() FROM anon;
GRANT EXECUTE ON FUNCTION public.expire_vouches() TO authenticated, service_role;

-- ─── 3. pg_cron schedule ────────────────────────────────────────────────
-- Daily at 02:00 UTC. Idempotent via unschedule-then-schedule.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-xnscore-vouches') THEN
    PERFORM cron.unschedule('expire-xnscore-vouches');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-xnscore-vouches',
  '0 2 * * *',
  $cron$SELECT public.expire_vouches();$cron$
);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '339',
  'expire_xnscore_vouches',
  ARRAY['-- 339: expire_vouches SQL fn + expired_at column + vouch_status expired + pg_cron 02:00 UTC + audit row per expiration']
)
ON CONFLICT (version) DO NOTHING;
