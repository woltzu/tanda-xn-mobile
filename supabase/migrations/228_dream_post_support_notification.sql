-- ════════════════════════════════════════════════════════════════════════════
-- 228_dream_post_support_notification.sql
-- Create-a-dream-post Bucket C.1 — notify author when supported
-- ════════════════════════════════════════════════════════════════════════════
--
-- Trigger: AFTER INSERT ON public.dream_supports.
--
-- dream_supports has a UNIQUE (user_id, post_id) constraint (see
-- migration 159), so each supporter can fire this trigger at most
-- once per post — no duplicate notifications by construction.
--
-- Self-support is silent: an author flipping support on their own
-- post doesn't ping themselves.
--
-- Idempotency: an explicit check against `notifications` for
-- (recipient, type, post_id, supporter_id) matches the pattern of
-- notify_event_interest (227) and friends — defends against any
-- future flow that somehow re-inserts after a delete.
--
-- Preferences: notification_preferences exists in the live DB but its
-- schema isn't in this migration set, and other notify_* triggers
-- (notify_event_interest in 227, notify_event_created in 223,
-- notify_community_post_created in 221) don't check it. Preference
-- filtering happens downstream at the notification dispatcher /
-- render layer, which is the single place that needs to know about
-- the user's per-category toggles. Keeping it out of the trigger
-- avoids drift if column names change.
--
-- public.notifications has no CHECK on `type` (verified live during
-- VED Bucket C), so 'dream_post_supported' lands without a constraint
-- widen.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_dream_post_supported()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author       UUID;
  v_post_content TEXT;
  v_supporter    TEXT;
  v_existing     UUID;
BEGIN
  -- Resolve the post's author + a short preview of the content for
  -- the notification body. Skip if the post is gone (race against a
  -- delete cascade).
  SELECT user_id, content
    INTO v_author, v_post_content
    FROM public.feed_posts
   WHERE id = NEW.post_id;
  IF v_author IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-support: silent.
  IF v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard. (recipient, type, post_id, supporter_id).
  SELECT id INTO v_existing
    FROM public.notifications
   WHERE user_id = v_author
     AND type = 'dream_post_supported'
     AND data->>'post_id' = NEW.post_id::text
     AND data->>'supporter_user_id' = NEW.user_id::text
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'Someone') INTO v_supporter
    FROM public.profiles WHERE id = NEW.user_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_author,
      'dream_post_supported',
      v_supporter || ' supports your dream',
      'They believe in your goal – check it out!',
      jsonb_build_object(
        'post_id',           NEW.post_id,
        'supporter_user_id', NEW.user_id,
        'supporter_name',    v_supporter,
        'amount_cents',      NEW.amount_cents,
        'i18n_title_key',    'dream.notification_supported_title',
        'i18n_body_key',     'dream.notification_supported_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_dream_post_supported] failed for post %, supporter %: %',
                  NEW.post_id, NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dream_post_support_notify ON public.dream_supports;
CREATE TRIGGER dream_post_support_notify
AFTER INSERT ON public.dream_supports
FOR EACH ROW
EXECUTE FUNCTION public.notify_dream_post_supported();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '228',
  'dream_post_support_notification',
  ARRAY['-- 228: dream_post_support_notification']
)
ON CONFLICT (version) DO NOTHING;
