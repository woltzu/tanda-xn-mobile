-- ════════════════════════════════════════════════════════════════════════════
-- Migration 238: Trip Wizard Bucket C — notification triggers + AI decision
-- ════════════════════════════════════════════════════════════════════════════
--
-- Five notification triggers + one AI-decision wrapper, all keyed to the
-- live Migration-065 trip system (trips + trip_days + trip_participants +
-- trip_payments). Spec deviations called out below — the spec's SQL had
-- multiple mismatches against the actual schema that would have crashed at
-- apply time.
--
-- Spec deviations corrected (verified against live DB 2026-06-22):
--   1. No `insert_notification` function exists. All triggers use direct
--      INSERT INTO public.notifications (the same shape that migration
--      233's notify_payout_position_assigned uses).
--   2. `trip_payments` has NO direct trip_id / user_id columns — it keys
--      via trip_participant_id. The two payment triggers JOIN
--      trip_participants to resolve both.
--   3. `record_ai_decision` signature is
--      (p_member_id, p_decision_type, p_decision_value, p_explanation_data,
--       p_source_event_id, p_source_event_type) — six positional args, not
--      the three the spec listed.
--   4. `ai_decisions.decision_type` has a CHECK that did NOT yet admit
--      'trip_published'. We widen it here.
--   5. `notifications.type` has no CHECK constraint — no widening needed.
--   6. The spec's notify_trip_itinerary_updated used
--      `PERFORM insert_notification(...) FROM trip_participants WHERE ...`
--      which is not valid PL/pgSQL syntax (PERFORM doesn't accept a FROM
--      clause). Rewritten as a single INSERT INTO ... SELECT over the
--      confirmed-participants set.
--   7. The spec's notify_trip_participant_joined had local vars
--      `trip_name text` and `organizer_id uuid` shadowing the SELECT
--      target columns. Renamed to v_trip_name / v_organizer_id.
--   8. Self-register: canonical `supabase_migrations.schema_migrations
--      (version, name, statements)` per CLAUDE.md, NOT the spec's
--      `supabase_migrations (version, name, applied_at)`.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. notify_trip_published ────────────────────────────────────────────
-- Fires when trips.status transitions into 'published'. The organizer is
-- the recipient — there's no follow/subscriber model yet, so this is the
-- only audience the trigger can confidently fan to. A future bucket can
-- broaden to circle members when trip.circle_id is set.
CREATE OR REPLACE FUNCTION public.notify_trip_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.organizer_id,
        'trip_published',
        'Trip published: ' || COALESCE(NEW.trip_name, 'Untitled'),
        'Your trip is now live for booking!',
        jsonb_build_object(
          'trip_id',       NEW.id,
          'trip_name',     NEW.trip_name,
          'slug',          NEW.slug,
          'i18n_title_key', 'trip.notification_published_title',
          'i18n_body_key',  'trip.notification_published_body'
        ),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_trip_published] failed for trip %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_published_notify ON public.trips;
CREATE TRIGGER tr_trip_published_notify
AFTER UPDATE OF status ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_published();

-- ─── 2. notify_trip_participant_joined ───────────────────────────────────
-- Fires when a participant row's status flips to 'confirmed'. Recipient is
-- the organizer (lookup via trips). Body carries the participant's display
-- name with a profile fallback chain mirroring migration 236.
CREATE OR REPLACE FUNCTION public.notify_trip_participant_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name    TEXT;
  v_organizer_id UUID;
  v_who          TEXT;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT trip_name, organizer_id
    INTO v_trip_name, v_organizer_id
    FROM public.trips WHERE id = NEW.trip_id;

  IF v_organizer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, full_name, 'A new traveller')
    INTO v_who
    FROM public.profiles WHERE id = NEW.user_id;
  v_who := COALESCE(v_who, 'A new traveller');

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_organizer_id,
      'trip_participant_joined',
      'New participant joined!',
      v_who || ' has joined "' || COALESCE(v_trip_name, 'your trip') || '"',
      jsonb_build_object(
        'trip_id',          NEW.trip_id,
        'trip_name',        v_trip_name,
        'participant_id',   NEW.user_id,
        'participant_name', v_who,
        'i18n_title_key', 'trip.notification_participant_joined_title',
        'i18n_body_key',  'trip.notification_participant_joined_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_participant_joined] failed for participant %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_joined_notify ON public.trip_participants;
CREATE TRIGGER tr_trip_participant_joined_notify
AFTER UPDATE OF status ON public.trip_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_participant_joined();

-- ─── 3. notify_trip_payment_due ──────────────────────────────────────────
-- Fires when a trip_payments row lands or its due_date / status updates
-- such that due_date is exactly tomorrow AND status is still pending.
-- The Edge Function trip-payment-reminder (deployed separately) is a
-- safety net that scans the table daily; the trigger covers the
-- immediate-create case so a freshly-scheduled installment doesn't wait
-- for the next cron tick.
--
-- trip_payments has no user_id / trip_id directly — both come from
-- trip_participants via trip_participant_id.
CREATE OR REPLACE FUNCTION public.notify_trip_payment_due()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   UUID;
  v_trip_id   UUID;
  v_trip_name TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF NEW.due_date IS DISTINCT FROM (CURRENT_DATE + INTERVAL '1 day')::date THEN
    RETURN NEW;
  END IF;

  SELECT tp.user_id, tp.trip_id, t.trip_name
    INTO v_user_id, v_trip_id, v_trip_name
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
   WHERE tp.id = NEW.trip_participant_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_user_id,
      'trip_payment_due',
      'Payment due tomorrow',
      'Your payment of $' || NEW.amount::text
        || ' for "' || COALESCE(v_trip_name, 'your trip') || '" is due tomorrow.',
      jsonb_build_object(
        'trip_id',     v_trip_id,
        'trip_name',   v_trip_name,
        'payment_id',  NEW.id,
        'amount',      NEW.amount,
        'due_date',    NEW.due_date,
        'i18n_title_key', 'trip.notification_payment_due_title',
        'i18n_body_key',  'trip.notification_payment_due_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_payment_due] failed for payment %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_payment_due_notify ON public.trip_payments;
CREATE TRIGGER tr_trip_payment_due_notify
AFTER INSERT OR UPDATE OF due_date, status ON public.trip_payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_payment_due();

-- ─── 4. notify_trip_payment_late ─────────────────────────────────────────
-- Fires when a still-pending payment crosses the due_date boundary into
-- "overdue". WHEN clause filters at the row level so the function body
-- only runs in genuine state-change cases.
CREATE OR REPLACE FUNCTION public.notify_trip_payment_late()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id   UUID;
  v_trip_id   UUID;
  v_trip_name TEXT;
BEGIN
  SELECT tp.user_id, tp.trip_id, t.trip_name
    INTO v_user_id, v_trip_id, v_trip_name
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
   WHERE tp.id = NEW.trip_participant_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_user_id,
      'trip_payment_late',
      'Payment overdue',
      'Your payment of $' || NEW.amount::text
        || ' for "' || COALESCE(v_trip_name, 'your trip') || '" is now overdue.',
      jsonb_build_object(
        'trip_id',     v_trip_id,
        'trip_name',   v_trip_name,
        'payment_id',  NEW.id,
        'amount',      NEW.amount,
        'due_date',    NEW.due_date,
        'i18n_title_key', 'trip.notification_payment_late_title',
        'i18n_body_key',  'trip.notification_payment_late_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_payment_late] failed for payment %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_payment_late_notify ON public.trip_payments;
CREATE TRIGGER tr_trip_payment_late_notify
AFTER UPDATE OF status, due_date ON public.trip_payments
FOR EACH ROW
WHEN (NEW.status = 'pending' AND NEW.due_date < CURRENT_DATE)
EXECUTE FUNCTION public.notify_trip_payment_late();

-- ─── 5. notify_trip_itinerary_updated ────────────────────────────────────
-- Fires on INSERT/UPDATE of any trip_days row. Fans out one notification
-- per confirmed participant. Uses INSERT INTO ... SELECT (the spec's
-- PERFORM ... FROM ... WHERE is invalid PL/pgSQL syntax).
CREATE OR REPLACE FUNCTION public.notify_trip_itinerary_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name TEXT;
BEGIN
  SELECT trip_name INTO v_trip_name FROM public.trips WHERE id = NEW.trip_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    SELECT
      tp.user_id,
      'trip_itinerary_updated',
      'Itinerary updated',
      'The itinerary for "' || COALESCE(v_trip_name, 'your trip')
        || '" has been updated. Check the trip page for details.',
      jsonb_build_object(
        'trip_id',     NEW.trip_id,
        'trip_name',   v_trip_name,
        'day_id',      NEW.id,
        'i18n_title_key', 'trip.notification_itinerary_updated_title',
        'i18n_body_key',  'trip.notification_itinerary_updated_body'
      ),
      FALSE
    FROM public.trip_participants tp
    WHERE tp.trip_id = NEW.trip_id
      AND tp.status = 'confirmed';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_itinerary_updated] failed for trip_day %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_itinerary_updated_notify ON public.trip_days;
CREATE TRIGGER tr_trip_itinerary_updated_notify
AFTER INSERT OR UPDATE ON public.trip_days
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_itinerary_updated();

-- ─── 6. AI decision: widen CHECK + wrapper trigger ───────────────────────
-- Same isolated-wrapper pattern used by migrations 219/220/223/231/236 —
-- AI decision lands in a separate trigger so a record_ai_decision failure
-- can't roll back the notification fan-out (and vice-versa).
ALTER TABLE public.ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;

ALTER TABLE public.ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type = ANY (ARRAY[
    'xnscore_increase'::text,
    'xnscore_decrease'::text,
    'circle_join_rejection'::text,
    'liquidity_denial'::text,
    'tier_advancement'::text,
    'tier_demotion'::text,
    'payout_position'::text,
    'intervention_message'::text,
    'honor_score_change'::text,
    'stress_score_change'::text,
    'mood_drift_change'::text,
    'stress_status_change'::text,
    'swap_completed'::text,
    'cycle_state_change'::text,
    'substitution_completed'::text,
    'partial_plan_completed'::text,
    'conflict_resolved'::text,
    'loan_disbursed'::text,
    'loan_default'::text,
    'community_post_published'::text,
    'community_post_milestone'::text,
    'event_created'::text,
    'gathering_created'::text,
    'trip_published'::text
  ]));

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_trip_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published') THEN
    BEGIN
      PERFORM public.record_ai_decision(
        NEW.organizer_id,                                 -- p_member_id
        'trip_published',                                 -- p_decision_type
        COALESCE(NEW.trip_name, 'your trip'),             -- p_decision_value
        jsonb_build_object(
          'TRIP_NAME',   COALESCE(NEW.trip_name, ''),
          'DESTINATION', COALESCE(NEW.destination, ''),
          'PRICE',       COALESCE(NEW.price_per_person::text, ''),
          'DEPARTURE',   COALESCE(NEW.start_date::text, '')
        ),                                                -- p_explanation_data
        NEW.id,                                           -- p_source_event_id
        'trips'                                           -- p_source_event_type
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[record_ai_decision_for_trip_published] failed for trip %: %',
        NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_published_ai_decision ON public.trips;
CREATE TRIGGER tr_trip_published_ai_decision
AFTER UPDATE OF status ON public.trips
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'published')
EXECUTE FUNCTION public.record_ai_decision_for_trip_published();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '238',
  'trip_notification_triggers',
  ARRAY['-- 238: trip_notification_triggers']
)
ON CONFLICT (version) DO NOTHING;
