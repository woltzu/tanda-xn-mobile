-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 271: trip_confirmation
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Escrow + confirmation rails for organizer payouts. Before
-- confirmation, participant PaymentIntents land on the platform Stripe
-- account (escrow). When the organizer presses "Confirm trip" (≤ 60 days
-- before start), release-trip-funds transfers the held gross minus the
-- 2 % platform fee to the organizer's Stripe Connect account, stamps
-- trips.confirmed_at, and writes trip_payments.transfer_id on every
-- payment it just released. Post-confirmation PIs go direct via
-- transfer_data[destination] (no escrow leg).
--
-- Schema additions:
--   • trips.confirmed_at                — null ⇒ escrow mode, non-null
--                                         ⇒ direct-charge mode
--   • trip_payments.transfer_id         — stamped on release so we can
--                                         tell which payments have been
--                                         disbursed and avoid double-
--                                         release on a retry
--
-- RPC:
--   • can_confirm_trip(p_trip_id uuid)  — single JSON object the UI
--                                         polls to decide whether to
--                                         show the "Confirm trip" CTA
--                                         and what reason to surface
--                                         when it's hidden. SECURITY
--                                         INVOKER so RLS still applies.
--
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. trips.confirmed_at + partial index for "find pending-confirmation trips"
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trips_confirmed_at
  ON trips(confirmed_at)
  WHERE confirmed_at IS NOT NULL;

-- 2. trip_payments.transfer_id — the spec's release flow stamps this
-- on every payment it disburses so a retry can skip already-transferred
-- rows. Nullable: pre-Bucket B rows have no transfer.
ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS transfer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_trip_payments_transfer_id
  ON trip_payments(transfer_id)
  WHERE transfer_id IS NOT NULL;

-- 3. RPC: eligibility check for the Confirm CTA
--
-- Returns JSONB with:
--   eligible       boolean  — true ⇒ show the button + allow the call
--   reason         text     — short reason code the client maps to i18n
--   days_until     integer  — days from now to trips.start_date
--   has_stripe     boolean  — organizer has stripe_connect_account_id
--   has_payments   boolean  — at least one succeeded PI not-yet-released
--   gross_cents    bigint   — sum of those PI amount_cents (preview only;
--                             the EF re-derives this with FOR UPDATE)
--
-- Eligible iff:
--   trip.confirmed_at IS NULL
--   AND trip.start_date BETWEEN today AND today + 60 days
--   AND organizer.stripe_connect_account_id IS NOT NULL
--   AND at least one stripe_payment_intents row exists for this trip
--       with status='succeeded' AND no trip_payments.transfer_id yet
--
-- Reason codes the UI consumes (admin.* / trip.* i18n already include
-- these): "eligible", "already_confirmed", "too_far_out", "not_started",
-- "no_stripe", "no_payments".

CREATE OR REPLACE FUNCTION can_confirm_trip(p_trip_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip          RECORD;
  v_stripe_acct   TEXT;
  v_gross_cents   BIGINT;
  v_days_until    INTEGER;
  v_eligible      BOOLEAN := FALSE;
  v_reason        TEXT;
BEGIN
  SELECT id, organizer_id, start_date, confirmed_at, status
    INTO v_trip
    FROM trips
   WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'not_found',
      'days_until', NULL,
      'has_stripe', false,
      'has_payments', false,
      'gross_cents', 0
    );
  END IF;

  SELECT stripe_connect_account_id
    INTO v_stripe_acct
    FROM profiles
   WHERE id = v_trip.organizer_id;

  v_days_until := (v_trip.start_date::date - CURRENT_DATE);

  SELECT COALESCE(SUM(spi.amount_cents), 0)::bigint
    INTO v_gross_cents
    FROM stripe_payment_intents spi
   WHERE spi.status = 'succeeded'
     AND (spi.metadata->>'trip_id') = p_trip_id::text
     AND NOT EXISTS (
       SELECT 1 FROM trip_payments tp
        WHERE tp.stripe_payment_intent_id = spi.stripe_payment_intent_id
          AND tp.transfer_id IS NOT NULL
     );

  -- Walk the eligibility ladder; first failing rung sets reason.
  IF v_trip.confirmed_at IS NOT NULL THEN
    v_reason := 'already_confirmed';
  ELSIF v_days_until < 0 THEN
    v_reason := 'not_started';   -- start_date is in the past
  ELSIF v_days_until > 60 THEN
    v_reason := 'too_far_out';
  ELSIF v_stripe_acct IS NULL THEN
    v_reason := 'no_stripe';
  ELSIF v_gross_cents = 0 THEN
    v_reason := 'no_payments';
  ELSE
    v_eligible := TRUE;
    v_reason := 'eligible';
  END IF;

  RETURN jsonb_build_object(
    'eligible',     v_eligible,
    'reason',       v_reason,
    'days_until',   v_days_until,
    'has_stripe',   v_stripe_acct IS NOT NULL,
    'has_payments', v_gross_cents > 0,
    'gross_cents',  v_gross_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION can_confirm_trip(UUID) TO authenticated;

-- 4. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '271',
  'trip_confirmation',
  ARRAY['-- 271: trip_confirmation']
)
ON CONFLICT (version) DO NOTHING;
