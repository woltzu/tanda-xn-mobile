-- ════════════════════════════════════════════════════════════════════════════
-- Migration 240: Publish-trip Bucket C — trip update notifications + AI
-- ════════════════════════════════════════════════════════════════════════════
--
-- Fires when an organizer posts a trip-wide broadcast (trip_messages with
-- recipient_type = 'all'). Fans one notification to every confirmed AND
-- pending participant, skipping the sender. Direct messages and
-- organizer-only messages are ignored — they're conversation events, not
-- broadcasts.
--
-- Spec deviations corrected (verified against live DB 2026-06-22):
--   1. notifications shape mirrors migration 238 (user_id, type, title,
--      body, data, read). Spec listed `created_at` explicitly — the table
--      has its own DEFAULT for that column, so we leave it out.
--   2. notifications has NO `type` CHECK constraint — nothing to widen on
--      that side.
--   3. trip_messages stores the body in `message_body`, not `body`. Trim
--      via LEFT(...) + ellipsis for the preview line.
--   4. trips uses `trip_name` (already verified by migration 238); the
--      spec's reference to it is correct.
--   5. profile lookup uses `display_name` with `full_name` fallback to
--      match the pattern in migration 238's notify_trip_participant_joined.
--   6. record_ai_decision signature is six positional args, per the
--      definition introduced in migration 218 and used by 219/220/223/231/
--      236/238. The spec's three-arg form would have errored at apply
--      time.
--   7. ai_decisions.decision_type CHECK now widened to admit
--      'trip_update_posted' (the constraint name is
--      `ai_decisions_decision_type_check` per migration 238).
--   8. Self-register: canonical
--      `supabase_migrations.schema_migrations (version, name, statements)`
--      per CLAUDE.md, NOT the spec's
--      `supabase_migrations (version, name, applied_at)`.
--   9. notification + AI decision land in TWO separate triggers / functions
--      so a failure on the AI side cannot roll back the participant
--      fan-out (and vice-versa). Same isolated-wrapper pattern as
--      migrations 219/220/223/231/236/238.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. notify_trip_update_posted ────────────────────────────────────────
-- Fans broadcast updates to every confirmed/pending participant minus the
-- sender. Single INSERT INTO ... SELECT keeps the fan-out atomic and avoids
-- the spec's invalid PERFORM-with-FROM construction.
CREATE OR REPLACE FUNCTION public.notify_trip_update_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name   TEXT;
  v_sender_name TEXT;
  v_preview     TEXT;
BEGIN
  -- Only broadcast messages route through this trigger.
  IF NEW.recipient_type <> 'all' THEN
    RETURN NEW;
  END IF;

  SELECT trip_name INTO v_trip_name
    FROM public.trips WHERE id = NEW.trip_id;

  SELECT COALESCE(display_name, full_name, 'The trip organizer')
    INTO v_sender_name
    FROM public.profiles WHERE id = NEW.sender_id;
  v_sender_name := COALESCE(v_sender_name, 'The trip organizer');

  -- Preview = first 60 chars + ellipsis if truncated. Title/body live in
  -- the trigger to avoid an EF round-trip for the common case; the
  -- i18n_*_key fields in `data` let the client re-render in the user's
  -- locale (same pattern migration 238 established).
  v_preview := LEFT(NEW.message_body, 60)
            || CASE WHEN LENGTH(NEW.message_body) > 60 THEN '…' ELSE '' END;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    SELECT
      tp.user_id,
      'trip_update_posted',
      'Trip update: ' || COALESCE(v_trip_name, 'your trip'),
      v_sender_name || ' posted: ' || v_preview,
      jsonb_build_object(
        'trip_id',        NEW.trip_id,
        'trip_name',      v_trip_name,
        'sender_id',      NEW.sender_id,
        'sender_name',    v_sender_name,
        'message_id',     NEW.id,
        'activity_id',    NEW.activity_id,
        'preview',        v_preview,
        'i18n_title_key', 'trip.notification_update_posted_title',
        'i18n_body_key',  'trip.notification_update_posted_body'
      ),
      FALSE
    FROM public.trip_participants tp
    WHERE tp.trip_id = NEW.trip_id
      AND tp.status IN ('confirmed', 'pending')
      AND tp.user_id <> NEW.sender_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_update_posted] failed for message %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_update_posted_notify ON public.trip_messages;
CREATE TRIGGER tr_trip_update_posted_notify
AFTER INSERT ON public.trip_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_trip_update_posted();

-- ─── 2. AI decision: widen CHECK ─────────────────────────────────────────
-- Migration 238 set the canonical CHECK; we add 'trip_update_posted' to
-- the array. Drop + re-add is the established pattern (Postgres does not
-- support ALTER ... ADD VALUE on a CHECK predicate the way it does on an
-- enum).
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
    'trip_update_posted'::text
  ]));

-- ─── 3. record_ai_decision_for_trip_update ───────────────────────────────
-- Records every broadcast as an AI decision attributed to the sender (the
-- organizer in the common case). Bound to the message, not the trip, so
-- each individual update gets its own audit row.
CREATE OR REPLACE FUNCTION public.record_ai_decision_for_trip_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name TEXT;
BEGIN
  IF NEW.recipient_type <> 'all' THEN
    RETURN NEW;
  END IF;

  SELECT trip_name INTO v_trip_name
    FROM public.trips WHERE id = NEW.trip_id;

  BEGIN
    PERFORM public.record_ai_decision(
      NEW.sender_id,                                       -- p_member_id (organizer in practice)
      'trip_update_posted',                                -- p_decision_type
      LEFT(NEW.message_body, 100),                         -- p_decision_value (compact)
      jsonb_build_object(
        'TRIP_NAME',        COALESCE(v_trip_name, ''),
        'TRIP_ID',          NEW.trip_id,
        'MESSAGE_PREVIEW',  LEFT(NEW.message_body, 200),
        'ACTIVITY_ID',      NEW.activity_id,
        'MESSAGE_LENGTH',   LENGTH(NEW.message_body)
      ),                                                   -- p_explanation_data
      NEW.id,                                              -- p_source_event_id
      'trip_message'                                       -- p_source_event_type
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_trip_update] failed for message %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_update_ai_decision ON public.trip_messages;
CREATE TRIGGER tr_trip_update_ai_decision
AFTER INSERT ON public.trip_messages
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_trip_update();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '240',
  'trip_update_notification',
  ARRAY['-- 240: trip_update_notification']
)
ON CONFLICT (version) DO NOTHING;
