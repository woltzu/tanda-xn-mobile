-- ════════════════════════════════════════════════════════════════════════════
-- 244 — materialize_trip_installments
-- ════════════════════════════════════════════════════════════════════════════
-- Member-trip-status Bucket C.1: when a participant joins (or transitions to
-- pending/confirmed), generate one pending trip_payments row per installment
-- in the trip's installment_schedule. Without these rows, the participant's
-- payment-schedule view is purely client-side and the existing reminder /
-- overdue cron has nothing to query.
--
-- IMPORTANT — JSONB shape correction vs. spec:
-- trips.installment_schedule is the envelope object
--   { cadence, count, installments: [ { due_date, amount_cents } ] }
-- (see services/TripOrganizerEngine.ts:extractInstallmentSchedule). It is
-- NOT a bare array, and per-installment rows expose `due_date` + `amount_cents`,
-- not `amount` or `number`. Installment numbers are derived via WITH ORDINALITY.
--
-- Misnomer alert (View-trip-dashboard A.1): the `amount_cents` field stores
-- DOLLARS, not cents — so we pass it straight into trip_payments.amount
-- (DECIMAL(10,2)) without dividing.
-- ════════════════════════════════════════════════════════════════════════════

-- Pre-req: ON CONFLICT below needs a unique index on (participant, number).
-- Partial index — installment_number is nullable on non-installment rows
-- (deposits, refunds), and a regular UNIQUE constraint would forbid more
-- than one NULL per participant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trip_payments_participant_installment
  ON trip_payments (trip_participant_id, installment_number)
  WHERE installment_number IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- RPC: generate pending trip_payments rows from the participant's schedule
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION materialize_trip_installment_payments(
  p_participant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule JSONB;
BEGIN
  -- Pull the installment_schedule from the participant's trip.
  SELECT t.installment_schedule
  INTO v_schedule
  FROM trip_participants tp
  JOIN trips t ON t.id = tp.trip_id
  WHERE tp.id = p_participant_id;

  -- Bail when the envelope is missing or empty.
  IF v_schedule IS NULL
     OR jsonb_typeof(v_schedule) <> 'object'
     OR jsonb_typeof(v_schedule -> 'installments') <> 'array'
     OR jsonb_array_length(v_schedule -> 'installments') = 0
  THEN
    RETURN;
  END IF;

  -- Insert one pending row per installment. WITH ORDINALITY gives us the
  -- 1-based installment number since the JSONB shape doesn't carry one.
  INSERT INTO trip_payments (
    trip_participant_id,
    amount,
    payment_type,
    status,
    due_date,
    installment_number
  )
  SELECT
    p_participant_id,
    (it.value->>'amount_cents')::DECIMAL,    -- already DOLLARS — see header
    'installment',
    'pending',
    (it.value->>'due_date')::DATE,
    it.ordinality::INT
  FROM jsonb_array_elements(v_schedule -> 'installments') WITH ORDINALITY AS it(value, ordinality)
  WHERE it.value ? 'due_date' AND it.value ? 'amount_cents'
  ON CONFLICT (trip_participant_id, installment_number)
    WHERE installment_number IS NOT NULL
    DO NOTHING;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- Trigger: auto-materialize on INSERT or when status flips to pending/confirmed
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_materialize_trip_installments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Fire on INSERT when row lands in a chargeable state, or on UPDATE when
  -- status transitions INTO pending/confirmed (e.g. waitlist promotion).
  IF NEW.status IN ('pending', 'confirmed')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM materialize_trip_installment_payments(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_materialize_installments
  ON trip_participants;

CREATE TRIGGER tr_trip_participant_materialize_installments
AFTER INSERT OR UPDATE OF status ON trip_participants
FOR EACH ROW
EXECUTE FUNCTION trigger_materialize_trip_installments();

-- ───────────────────────────────────────────────────────────────────────────
-- Backfill — generate rows for active participants with no payments yet
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tp.id
    FROM trip_participants tp
    WHERE tp.status IN ('pending', 'confirmed')
      AND NOT EXISTS (
        SELECT 1
        FROM trip_payments p
        WHERE p.trip_participant_id = tp.id
          AND p.payment_type = 'installment'
      )
  LOOP
    PERFORM materialize_trip_installment_payments(r.id);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- Self-register per CLAUDE.md template.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '244',
  'materialize_trip_installments',
  ARRAY['-- 244: materialize_trip_installments']
)
ON CONFLICT (version) DO NOTHING;
