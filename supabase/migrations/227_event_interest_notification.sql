-- ════════════════════════════════════════════════════════════════════════════
-- 227_event_interest_notification.sql
-- View-event-details Bucket C.1 — notify organiser when someone is interested
-- ════════════════════════════════════════════════════════════════════════════
--
-- Trigger: AFTER INSERT OR UPDATE OF status ON event_interest.
--
-- Fires a notification to the event's organiser (community_events.user_id)
-- whenever a member sets their interest to 'interested' or 'going'. Two
-- guards keep this from spamming:
--
--   1. The trigger no-ops when NEW.status = 'not_going' (no signal worth
--      surfacing) or when status hasn't actually changed on UPDATE.
--   2. Idempotency check on (user_id, type, data->>'event_id') — only one
--      notification per (organiser, interested-user, event) tuple, so a
--      user who toggles interested → going never produces two rows.
--
-- Self-notify is skipped: an organiser flipping interest on their own
-- event doesn't ping themselves.
--
-- public.notifications has no CHECK on `type` (confirmed 2026-06-21), so
-- no constraint widening is needed for 'event_interest'.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_event_interest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organiser   UUID;
  v_event_title TEXT;
  v_user_name   TEXT;
  v_existing    UUID;
BEGIN
  -- Only fan out on positive-signal statuses.
  IF NEW.status NOT IN ('interested', 'going') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip when status hasn't actually changed (e.g. a no-op
  -- bump). The trigger is scoped to OF status so other column updates
  -- won't reach here in the first place.
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Look up the event creator + title. Skip if the row is gone (race
  -- against an event deletion).
  SELECT user_id, title
    INTO v_organiser, v_event_title
    FROM public.community_events
   WHERE id = NEW.event_id;
  IF v_organiser IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-interest is silent.
  IF v_organiser = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Idempotency: one notification per (organiser, interested-user, event).
  -- The interested user's id is carried in data->>'user_id' so the same
  -- person flipping interested → going doesn't fire twice.
  SELECT id INTO v_existing
    FROM public.notifications
   WHERE user_id = v_organiser
     AND type = 'event_interest'
     AND data->>'event_id' = NEW.event_id::text
     AND data->>'user_id'  = NEW.user_id::text
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_user_name
    FROM public.profiles WHERE id = NEW.user_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_organiser,
      'event_interest',
      'Someone is interested in your event',
      v_user_name || ' is interested in ''' || v_event_title || '''.',
      jsonb_build_object(
        'event_id',       NEW.event_id,
        'event_title',    v_event_title,
        'user_id',        NEW.user_id,
        'user_name',      v_user_name,
        'status',         NEW.status,
        'i18n_title_key', 'event.notification_interest_title',
        'i18n_body_key',  'event.notification_interest_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_event_interest] failed for event %, user %: %',
                  NEW.event_id, NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_event_interest_notify ON public.event_interest;
CREATE TRIGGER tr_event_interest_notify
AFTER INSERT OR UPDATE OF status ON public.event_interest
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_interest();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '227',
  'event_interest_notification',
  ARRAY['-- 227: event_interest_notification']
)
ON CONFLICT (version) DO NOTHING;
