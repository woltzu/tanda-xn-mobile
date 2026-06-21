-- ════════════════════════════════════════════════════════════════════════════
-- 223_community_event_lifecycle.sql
-- Create an event — Bucket C
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the loop on event creation:
--
--   1. DROP the stale community_events_auto_cross_post trigger + its
--      post_event_to_community() body. Recon confirmed the function does
--      NOT reference feed_posts (it likely targets the community_posts
--      family that migration 221 dropped). Bucket C replaces it with a
--      proper feed_posts insert via cross_post_event_to_community below.
--
--   2. notify_event_created — fans out to every active member of every
--      community the event creator belongs to, via the live
--      community_memberships table (77 rows in prod). Idempotency keys
--      on (user_id, type, data->>'event_id') so each member gets at most
--      one notification per event, even if a trigger re-fires.
--
--   3. record_ai_decision_for_event_created — separate isolated wrapper
--      (same pattern as migrations 219/220/221). Lands a row in
--      ai_decisions so AI Insights surfaces "You created an event in
--      {category}".
--
--   4. cross_post_event_to_community — new isolated wrapper that inserts
--      a feed_posts row with type='community', is_auto=true. The
--      community-tab Community section we built in PC Bucket A picks
--      these up automatically. The community lifecycle triggers in
--      migration 221 skip notification + ai_decision recording on
--      is_auto=true, so no "you posted" spam fires.
--
--   5. CHECK widening on ai_decisions + explanation_templates to admit
--      'event_created'. EN+FR templates with [CATEGORY] placeholder.
--
-- Membership fan-out note: an event created by a user who belongs to N
-- communities notifies (member_count_per_community × N) people. The
-- creator themselves is excluded via a NOT (m.user_id = NEW.user_id)
-- guard. With 77 total memberships and small communities, the fan-out
-- is bounded — but real growth means we should add a community_id
-- column on community_events later so the fan-out scopes to the chosen
-- community instead of all of the creator's memberships. Tracked as a
-- separate follow-up.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Drop the stale cross-post path ───────────────────────────────
-- The community_events_auto_cross_post trigger calls
-- post_event_to_community() — recon showed the function body has no
-- reference to feed_posts (position 0 from a substring probe). The
-- target was the community_posts family we dropped in migration 221.
-- Dropping the trigger and function here cleans up the dangling write
-- before our replacement lands.

DROP TRIGGER IF EXISTS community_events_auto_cross_post ON public.community_events;
DROP FUNCTION IF EXISTS public.post_event_to_community() CASCADE;

-- ─── PART 2: Widen CHECK constraints to include 'event_created' ───────────

ALTER TABLE public.ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;
ALTER TABLE public.ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease',
    'circle_join_rejection', 'liquidity_denial',
    'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message',
    'honor_score_change', 'stress_score_change', 'mood_drift_change',
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved',
    'loan_disbursed',
    'loan_default',
    'community_post_published',
    'community_post_milestone',
    -- New in 223
    'event_created'
  ));

ALTER TABLE public.explanation_templates
  DROP CONSTRAINT IF EXISTS explanation_templates_decision_type_check;
ALTER TABLE public.explanation_templates
  ADD CONSTRAINT explanation_templates_decision_type_check
  CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease',
    'circle_join_rejection', 'liquidity_denial',
    'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message',
    'honor_score_change', 'stress_score_change', 'mood_drift_change',
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved',
    'loan_disbursed',
    'loan_default',
    'community_post_published',
    'community_post_milestone',
    -- New in 223
    'event_created'
  ));

-- ─── PART 3: EN + FR templates ────────────────────────────────────────────

INSERT INTO public.explanation_templates
  (decision_type, language, template_text, required_variables, active, created_at, updated_at)
VALUES
  ('event_created', 'en',
   'You created an event in [CATEGORY] — share the link to fill seats.',
   ARRAY['CATEGORY'], true, now(), now()),
  ('event_created', 'fr',
   'Vous avez créé un événement dans [CATEGORY] — partagez le lien pour remplir la salle.',
   ARRAY['CATEGORY'], true, now(), now())
ON CONFLICT DO NOTHING;

-- ─── PART 4: notify_event_created ─────────────────────────────────────────
-- Fans out one notification per active community member, excluding the
-- creator themselves. Title/body i18n keys carried in data so the
-- notification dispatcher can localise on render.

CREATE OR REPLACE FUNCTION public.notify_event_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient RECORD;
  v_existing  UUID;
  v_creator   TEXT;
  v_date_str  TEXT;
BEGIN
  SELECT COALESCE(full_name, 'A member') INTO v_creator
    FROM public.profiles WHERE id = NEW.user_id;
  v_date_str := TO_CHAR(NEW.event_datetime AT TIME ZONE 'UTC',
                        'FMMonth FMDD, HH24:MI');

  BEGIN
    FOR v_recipient IN
      -- All active members of every community the creator belongs to,
      -- DISTINCT so a user in two of the creator's communities still
      -- only gets one row.
      SELECT DISTINCT m.user_id
        FROM public.community_memberships m
       WHERE m.status = 'active'
         AND m.community_id IN (
           SELECT community_id FROM public.community_memberships
            WHERE user_id = NEW.user_id AND status = 'active'
         )
         AND m.user_id <> NEW.user_id
    LOOP
      SELECT id INTO v_existing
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'event_created'
         AND data->>'event_id' = NEW.id::text
       LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'event_created',
          'New event in your community',
          v_creator || ' created ''' || NEW.title || ''' on ' || v_date_str || '.',
          jsonb_build_object(
            'event_id',        NEW.id,
            'creator_id',      NEW.user_id,
            'creator_name',    v_creator,
            'title',           NEW.title,
            'date',            v_date_str,
            'i18n_title_key',  'event.notification_created_title',
            'i18n_body_key',   'event.notification_created_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_event_created] failed for event %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_event_created_notify ON public.community_events;
CREATE TRIGGER tr_event_created_notify
AFTER INSERT ON public.community_events
FOR EACH ROW
EXECUTE FUNCTION public.notify_event_created();

-- ─── PART 5: record_ai_decision_for_event_created ─────────────────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_event_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category TEXT;
BEGIN
  v_category := COALESCE(NEW.category::TEXT, 'other');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'event_created',
      NEW.title,
      jsonb_build_object('CATEGORY', v_category),
      NEW.id,
      'community_events'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_event_created] failed for event %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_event_created_ai_decision ON public.community_events;
CREATE TRIGGER tr_event_created_ai_decision
AFTER INSERT ON public.community_events
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_event_created();

-- ─── PART 6: cross_post_event_to_community ────────────────────────────────
-- New auto-post path. Lands the event in feed_posts so it appears in the
-- Community-tab Community section. is_auto=true so the community
-- lifecycle triggers (migration 221) skip the "you posted" notification
-- and ai_decision recording.

CREATE OR REPLACE FUNCTION public.cross_post_event_to_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date_str    TEXT;
  v_content     TEXT;
BEGIN
  v_date_str := TO_CHAR(NEW.event_datetime AT TIME ZONE 'UTC',
                        'FMMonth FMDD, HH24:MI');
  -- Use a leading calendar glyph for the auto-post body so the row reads
  -- as event-derived in the feed. Plain text body, no escape concerns.
  v_content := 'New event: ' || NEW.title || ' - ' || v_date_str
            || ' at ' || NEW.location_name;
  BEGIN
    INSERT INTO public.feed_posts (
      user_id, type, content, image_url, visibility,
      related_id, related_type, is_auto, metadata
    ) VALUES (
      NEW.user_id,
      'community',
      v_content,
      NEW.image_url,
      'public',
      NEW.id,
      'community_events',
      TRUE,
      jsonb_build_object(
        'event_id',      NEW.id,
        'event_title',   NEW.title,
        'event_dt',      NEW.event_datetime,
        'event_location', NEW.location_name,
        'event_category', NEW.category
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[cross_post_event_to_community] failed for event %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_event_created_cross_post ON public.community_events;
CREATE TRIGGER tr_event_created_cross_post
AFTER INSERT ON public.community_events
FOR EACH ROW
EXECUTE FUNCTION public.cross_post_event_to_community();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '223',
  'community_event_lifecycle',
  ARRAY['-- 223: community_event_lifecycle']
)
ON CONFLICT (version) DO NOTHING;
