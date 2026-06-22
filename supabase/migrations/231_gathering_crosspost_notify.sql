-- ════════════════════════════════════════════════════════════════════════════
-- Migration 231: gathering_crosspost_notify
-- Host-a-gathering Bucket C
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the loop on gathering creation. Three triggers fire AFTER INSERT on
-- public.community_gatherings:
--
--   1. cross_post_gathering_to_community — inserts a feed_posts row with
--      type='community', is_auto=true. The community-tab Community section
--      (PC Bucket A) picks these up automatically. The community lifecycle
--      triggers in migration 221 skip notification + ai_decision recording
--      on is_auto=true, so no "you posted" spam fires for the organizer.
--      Mirrors cross_post_event_to_community from migration 223.
--
--   2. notify_gathering_created — fans out one notification per active
--      member of the gathering's community, EXCLUDING the organizer.
--      Idempotency keys on (user_id, type, data->>'gathering_id'). Unlike
--      community_events (which has no community_id and notifies every
--      community the creator belongs to), community_gatherings is already
--      scoped to a single community by FK — so the fan-out is bounded to
--      that community's active membership.
--
--   3. record_ai_decision_for_gathering_created — separate isolated wrapper
--      (same pattern as migrations 219/220/221/223). Lands a row in
--      ai_decisions so AI Insights surfaces "You hosted a {event_type}
--      gathering" — keyed off NEW.event_type, which is one of
--      'community' | 'circle' | 'elder_session' | 'service' per the
--      table's CHECK constraint.
--
-- Schema note: actual column names verified against migration 056 +
-- CommunityFeaturesEngine.createGathering — `starts_at` (not start_at),
-- `organizer_user_id` (not organizer_id), `organizer_first_name` (not
-- organizer_name). The Bucket C instruction spec had the wrong field names
-- in a few places; the SQL below uses what's actually in production.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Widen CHECK constraints to include 'gathering_created' ───────

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
    'event_created',
    -- New in 231
    'gathering_created'
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
    'event_created',
    -- New in 231
    'gathering_created'
  ));

-- ─── PART 2: EN + FR ai_decisions templates ────────────────────────────────

INSERT INTO public.explanation_templates
  (decision_type, language, template_text, required_variables, active, created_at, updated_at)
VALUES
  ('gathering_created', 'en',
   'You hosted a [TYPE] gathering — share the link to fill seats.',
   ARRAY['TYPE'], true, now(), now()),
  ('gathering_created', 'fr',
   'Vous avez organisé un rassemblement [TYPE] — partagez le lien pour remplir la salle.',
   ARRAY['TYPE'], true, now(), now())
ON CONFLICT DO NOTHING;

-- ─── PART 3: notify_gathering_created ──────────────────────────────────────
-- Fans out one notification per active community member, excluding the
-- organizer. Body carries organizer first name + formatted date. The
-- dispatcher reads data.i18n_*_key for localised render.

CREATE OR REPLACE FUNCTION public.notify_gathering_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient RECORD;
  v_existing  UUID;
  v_organizer TEXT;
  v_date_str  TEXT;
BEGIN
  -- Prefer the denormalised first name we already wrote on the row;
  -- fall back to the profile if the engine ever lands a row without it.
  v_organizer := COALESCE(
    NEW.organizer_first_name,
    (SELECT full_name FROM public.profiles WHERE id = NEW.organizer_user_id),
    'A member'
  );
  v_date_str := TO_CHAR(NEW.starts_at AT TIME ZONE 'UTC',
                        'FMMonth FMDD, HH24:MI');

  BEGIN
    FOR v_recipient IN
      SELECT m.user_id
        FROM public.community_memberships m
       WHERE m.status = 'active'
         AND m.community_id = NEW.community_id
         AND m.user_id <> NEW.organizer_user_id
    LOOP
      SELECT id INTO v_existing
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'gathering_created'
         AND data->>'gathering_id' = NEW.id::text
       LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'gathering_created',
          'New gathering in your community',
          v_organizer || ' is hosting ''' || NEW.title || ''' on ' || v_date_str || '.',
          jsonb_build_object(
            'gathering_id',    NEW.id,
            'organizer_id',    NEW.organizer_user_id,
            'organizer_name',  v_organizer,
            'title',           NEW.title,
            'event_type',      NEW.event_type,
            'community_id',    NEW.community_id,
            'starts_at',       NEW.starts_at,
            'date',            v_date_str,
            'i18n_title_key',  'gathering.notification_created_title',
            'i18n_body_key',   'gathering.notification_created_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_gathering_created] failed for gathering %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gathering_created_notify ON public.community_gatherings;
CREATE TRIGGER tr_gathering_created_notify
AFTER INSERT ON public.community_gatherings
FOR EACH ROW
EXECUTE FUNCTION public.notify_gathering_created();

-- ─── PART 4: record_ai_decision_for_gathering_created ──────────────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_gathering_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
BEGIN
  v_type := COALESCE(NEW.event_type::TEXT, 'community');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.organizer_user_id,
      'gathering_created',
      NEW.title,
      jsonb_build_object('TYPE', v_type),
      NEW.id,
      'community_gatherings'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_gathering_created] failed for gathering %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gathering_created_ai_decision ON public.community_gatherings;
CREATE TRIGGER tr_gathering_created_ai_decision
AFTER INSERT ON public.community_gatherings
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_gathering_created();

-- ─── PART 5: cross_post_gathering_to_community ─────────────────────────────
-- Auto-post into feed_posts so the gathering appears in the Community-tab
-- Community section. is_auto=true so migration 221's lifecycle triggers
-- skip the "you posted" notification + ai_decision recording.
--
-- Content body mirrors the event cross-post shape so the feed reads
-- consistently for both surfaces. Location string falls back to "Virtual"
-- when is_virtual=true.

CREATE OR REPLACE FUNCTION public.cross_post_gathering_to_community()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date_str TEXT;
  v_where    TEXT;
  v_content  TEXT;
BEGIN
  v_date_str := TO_CHAR(NEW.starts_at AT TIME ZONE 'UTC',
                        'FMMonth FMDD, HH24:MI');
  v_where := CASE
    WHEN NEW.is_virtual THEN 'Virtual'
    WHEN NEW.location_name IS NOT NULL AND length(trim(NEW.location_name)) > 0
      THEN NEW.location_name
    ELSE 'Location TBA'
  END;
  v_content := 'New gathering: ' || NEW.title || ' - ' || v_date_str
            || ' at ' || v_where;

  BEGIN
    INSERT INTO public.feed_posts (
      user_id, type, content, visibility,
      related_id, related_type, is_auto, metadata
    ) VALUES (
      NEW.organizer_user_id,
      'community',
      v_content,
      'public',
      NEW.id,
      'community_gatherings',
      TRUE,
      jsonb_build_object(
        'gathering_id',     NEW.id,
        'gathering_title',  NEW.title,
        'gathering_dt',     NEW.starts_at,
        'gathering_where',  v_where,
        'gathering_type',   NEW.event_type,
        'is_virtual',       NEW.is_virtual,
        'community_id',     NEW.community_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[cross_post_gathering_to_community] failed for gathering %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gathering_created_cross_post ON public.community_gatherings;
CREATE TRIGGER tr_gathering_created_cross_post
AFTER INSERT ON public.community_gatherings
FOR EACH ROW
EXECUTE FUNCTION public.cross_post_gathering_to_community();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '231',
  'gathering_crosspost_notify',
  ARRAY['-- 231: gathering_crosspost_notify']
)
ON CONFLICT (version) DO NOTHING;
