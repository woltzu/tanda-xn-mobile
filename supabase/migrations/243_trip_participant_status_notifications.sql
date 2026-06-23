-- ════════════════════════════════════════════════════════════════════════════
-- Migration 243: View-trip-dashboard Bucket C — participant status triggers
-- ════════════════════════════════════════════════════════════════════════════
--
-- Three triggers wired to status transitions on trip_participants:
--
--   1. notify_trip_participant_confirmed — notifies the PARTICIPANT
--      when their status flips to 'confirmed'. Today only
--      notify_trip_participant_joined (migration 238) fires on this
--      transition, and it notifies the ORGANIZER. The participant
--      gets nothing — that's the gap this trigger closes.
--
--   2. notify_trip_participant_cancelled — notifies BOTH the
--      participant (always) AND the organizer (if they are not the
--      cancelling participant). Today no trigger fires on the
--      cancelled transition, so neither side learns anything when a
--      manual or auto-release cancellation happens.
--
--   3. record_ai_decision_for_trip_participant_action — wrapper that
--      logs every confirm/cancel decision into ai_decisions under the
--      new 'trip_participant_action' decision_type. Lets the
--      AIInsights screen surface organizer actions in its explainable-
--      decisions feed.
--
-- Plus the CHECK constraint widen:
--   • ai_decisions_decision_type_check — adds 'trip_participant_action'
--     to the existing 26 allowed types. PRESERVES every existing value;
--     the spec's truncated list would have broken every other
--     decision_type in the system.
--
-- Spec deviations corrected:
--   1. CHECK constraint name is `ai_decisions_decision_type_check`
--      (not `decision_type_check` per spec).
--   2. CHECK constraint widens — keeps the 26 existing values, adds
--      one. The spec's REPLACE-with-10-values list would have wiped
--      out tier_advancement, swap_completed, honor_score_change, etc.
--   3. JS-style escape `'You\'re'` invalid in SQL — used `''`
--      (e.g. `'You''re'`).
--   4. Local vars renamed `trip_name`/`organizer_id` → `v_trip_name`/
--      `v_organizer_id` to avoid the column-shadowing bug that hit
--      migration 238 (the SELECT INTO target gets read as the column,
--      not the local).
--   5. Self-register uses canonical
--      `supabase_migrations.schema_migrations (version, name, statements)`
--      (NOT the spec's `supabase_migrations (version, name, applied_at)`).
--   6. Notification `data` carries i18n_title_key + i18n_body_key so
--      the client can re-render in the user's locale (mirrors 238/241/
--      242 pattern). Cancel notifications also carry `recipient_role`
--      (participant|organizer) since both recipients share the same
--      type string.
--   7. Triggers don't use WHEN clauses — they check inside the
--      function. Slightly less efficient (function call on every
--      status update) but easier to maintain when the gating logic
--      grows. Pattern matches migration 238's notify_trip_participant_
--      joined.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. notify_trip_participant_confirmed ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trip_participant_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name TEXT;
BEGIN
  IF NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'confirmed' THEN
    RETURN NEW;
  END IF;

  SELECT trip_name INTO v_trip_name FROM public.trips WHERE id = NEW.trip_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.user_id,
      'trip_participant_confirmed',
      'You''re confirmed for ' || COALESCE(v_trip_name, 'your trip'),
      'Your spot for "' || COALESCE(v_trip_name, 'your trip')
        || '" is confirmed. Get ready!',
      jsonb_build_object(
        'trip_id',         NEW.trip_id,
        'participant_id',  NEW.id,
        'trip_name',       v_trip_name,
        'i18n_title_key',  'trip.notification_participant_confirmed_title',
        'i18n_body_key',   'trip.notification_participant_confirmed_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_participant_confirmed] failed for participant %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_confirmed_notify ON public.trip_participants;
CREATE TRIGGER tr_trip_participant_confirmed_notify
AFTER UPDATE OF status ON public.trip_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_participant_confirmed();

-- ─── 2. notify_trip_participant_cancelled ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_trip_participant_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name        TEXT;
  v_participant_name TEXT;
  v_organizer_id     UUID;
BEGIN
  IF NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT NULL AND OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT trip_name, organizer_id
    INTO v_trip_name, v_organizer_id
    FROM public.trips
   WHERE id = NEW.trip_id;

  SELECT COALESCE(display_name, full_name, 'A participant')
    INTO v_participant_name
    FROM public.profiles
   WHERE id = NEW.user_id;
  v_participant_name := COALESCE(v_participant_name, 'A participant');

  -- Notify the PARTICIPANT.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.user_id,
      'trip_participant_cancelled',
      'Your spot in ' || COALESCE(v_trip_name, 'the trip') || ' was cancelled',
      'Your participation in "' || COALESCE(v_trip_name, 'the trip')
        || '" has been cancelled. Contact the organizer for details.',
      jsonb_build_object(
        'trip_id',         NEW.trip_id,
        'participant_id',  NEW.id,
        'trip_name',       v_trip_name,
        'i18n_title_key',  'trip.notification_participant_cancelled_title',
        'i18n_body_key',   'trip.notification_participant_cancelled_body',
        'recipient_role',  'participant'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_participant_cancelled:participant] failed for participant %: %',
      NEW.id, SQLERRM;
  END;

  -- Notify the ORGANIZER (skip if they are the cancelling participant).
  IF v_organizer_id IS NOT NULL AND v_organizer_id <> NEW.user_id THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_organizer_id,
        'trip_participant_cancelled',
        v_participant_name || ' was cancelled from ' || COALESCE(v_trip_name, 'your trip'),
        v_participant_name || ' was removed from "'
          || COALESCE(v_trip_name, 'your trip') || '".',
        jsonb_build_object(
          'trip_id',          NEW.trip_id,
          'participant_id',   NEW.id,
          'participant_name', v_participant_name,
          'trip_name',        v_trip_name,
          'i18n_title_key',   'trip.notification_participant_cancelled_organizer_title',
          'i18n_body_key',    'trip.notification_participant_cancelled_organizer_body',
          'recipient_role',   'organizer'
        ),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_trip_participant_cancelled:organizer] failed for participant %: %',
        NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_cancelled_notify ON public.trip_participants;
CREATE TRIGGER tr_trip_participant_cancelled_notify
AFTER UPDATE OF status ON public.trip_participants
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_participant_cancelled();

-- ─── 3. record_ai_decision_for_trip_participant_action ────────────────────
CREATE OR REPLACE FUNCTION public.record_ai_decision_for_trip_participant_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name    TEXT;
  v_organizer_id UUID;
  v_action       TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT trip_name, organizer_id
    INTO v_trip_name, v_organizer_id
    FROM public.trips
   WHERE id = NEW.trip_id;
  IF v_organizer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_action := CASE NEW.status
    WHEN 'confirmed' THEN 'Confirmed participant'
    WHEN 'cancelled' THEN 'Cancelled participant'
    ELSE NEW.status
  END;

  BEGIN
    PERFORM public.record_ai_decision(
      v_organizer_id,
      'trip_participant_action',
      v_action || ' for ' || COALESCE(v_trip_name, 'the trip'),
      jsonb_build_object(
        'TRIP_NAME',      v_trip_name,
        'PARTICIPANT_ID', NEW.id,
        'ACTION',         v_action,
        'NEW_STATUS',     NEW.status,
        'OLD_STATUS',     OLD.status
      ),
      NEW.id,
      'trip_participant'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_trip_participant_action] failed for participant %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_action_ai_decision ON public.trip_participants;
CREATE TRIGGER tr_trip_participant_action_ai_decision
AFTER UPDATE OF status ON public.trip_participants
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_trip_participant_action();

-- ─── 4. Widen ai_decisions_decision_type_check ────────────────────────────
-- Preserves all 26 existing decision_type values and ADDS
-- 'trip_participant_action'. The spec's truncated 10-value list would
-- have broken every existing decision recorded today.
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
    'trip_published'::text,
    'trip_update_posted'::text,
    'trip_participant_paid'::text,
    'trip_participant_action'::text
  ]));

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '243',
  'trip_participant_status_notifications',
  ARRAY['-- 243: trip_participant_status_notifications']
)
ON CONFLICT (version) DO NOTHING;
