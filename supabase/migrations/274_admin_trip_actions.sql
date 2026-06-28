-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 274: admin_trip_actions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin-only cancel-trip + per-payment refund flows. Together with the
-- process-refunds Edge Function (admin-triggered, JWT-verified), this
-- gives super_admin/admin the ability to halt a published trip and
-- queue refunds for any of its succeeded/pending payments.
--
-- Two-phase refund: admin_refund_payment only marks the row 'pending'.
-- The actual Stripe Refund happens in process-refunds (cron-friendly,
-- never blocks the admin's HTTP request, and survives Stripe API
-- transients via retry on next invocation).
--
-- Schema additions on trip_payments:
--   refund_status     TEXT  CHECK IN (none|pending|refunded|failed)
--   refunded_at       TIMESTAMPTZ
--   refund_reason     TEXT
--   stripe_refund_id  TEXT
--
-- RPCs (both SECURITY DEFINER + admin gate via admin_users):
--   admin_cancel_trip(p_trip_id, p_reason)
--   admin_refund_payment(p_payment_id, p_reason)
--
-- Audit: uses log_elder_action() from migration 254. Despite the name,
-- the function is used generically across admin actions — the table
-- name is "elder_audit_log" only because elders were the first
-- workflow that needed it.
--
-- Spec deviations:
--   * Registry insert targets supabase_migrations.schema_migrations
--     (per CLAUDE.md; the spec template named the wrong table).
--   * Removed `updated_at = NOW()` writes on trip_payments — the
--     column is not in scope here; refund_status itself is the state
--     change and re-introducing an updated_at write would require
--     adding the column (a separate concern).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Refund columns on trip_payments (all idempotent).
ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

-- CHECK constraint added in a separate step so re-runs don't error
-- on "constraint already exists". Drop-then-recreate keeps it idempotent.
ALTER TABLE trip_payments DROP CONSTRAINT IF EXISTS trip_payments_refund_status_check;
ALTER TABLE trip_payments
  ADD CONSTRAINT trip_payments_refund_status_check
  CHECK (refund_status IN ('none', 'pending', 'refunded', 'failed'));

CREATE INDEX IF NOT EXISTS idx_trip_payments_refund_status
  ON trip_payments(refund_status)
  WHERE refund_status IN ('pending', 'failed');

-- 2. admin_cancel_trip RPC
CREATE OR REPLACE FUNCTION admin_cancel_trip(
  p_trip_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_status TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can cancel trips';
  END IF;

  SELECT status INTO v_trip_status FROM trips WHERE id = p_trip_id;
  IF v_trip_status IS NULL THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;
  IF v_trip_status IN ('cancelled', 'completed') THEN
    RAISE EXCEPTION 'Trip is already %', v_trip_status;
  END IF;

  UPDATE trips
     SET status = 'cancelled', updated_at = NOW()
   WHERE id = p_trip_id;

  -- Queue refunds for every eligible payment on the trip. process-refunds
  -- picks these up on its next invocation; we never block the admin's
  -- request on a Stripe API call.
  UPDATE trip_payments
     SET refund_status = 'pending',
         refund_reason = COALESCE(p_reason, 'Trip cancelled')
   WHERE trip_participant_id IN (
     SELECT id FROM trip_participants WHERE trip_id = p_trip_id
   )
     AND status IN ('pending', 'succeeded')
     AND refund_status = 'none';

  PERFORM log_elder_action(
    auth.uid(),
    'admin_cancel_trip',
    p_trip_id,
    'trip',
    jsonb_build_object('reason', p_reason)
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_cancel_trip(UUID, TEXT) TO authenticated;

-- 3. admin_refund_payment RPC (queues a single payment for refund)
CREATE OR REPLACE FUNCTION admin_refund_payment(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_status TEXT;
  v_refund_status TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can issue refunds';
  END IF;

  SELECT status, refund_status
    INTO v_payment_status, v_refund_status
    FROM trip_payments
   WHERE id = p_payment_id;

  IF v_payment_status IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_payment_status NOT IN ('succeeded', 'pending') THEN
    RAISE EXCEPTION 'Payment cannot be refunded (status: %)', v_payment_status;
  END IF;
  IF v_refund_status IN ('refunded', 'pending') THEN
    RAISE EXCEPTION 'Payment is already refunded or refund pending';
  END IF;

  UPDATE trip_payments
     SET refund_status = 'pending',
         refund_reason = p_reason
   WHERE id = p_payment_id;

  PERFORM log_elder_action(
    auth.uid(),
    'admin_refund_payment',
    p_payment_id,
    'trip_payment',
    jsonb_build_object('reason', p_reason)
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_refund_payment(UUID, TEXT) TO authenticated;

-- 4. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '274',
  'admin_trip_actions',
  ARRAY['-- 274: admin_trip_actions']
)
ON CONFLICT (version) DO NOTHING;
