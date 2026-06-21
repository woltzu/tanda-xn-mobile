-- ════════════════════════════════════════════════════════════════════════════
-- 221_community_post_lifecycle.sql
-- Post to Community — Bucket C
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the loop on the community-post pipeline:
--
--   1. DROP four dead tables (community_posts, community_post_likes,
--      community_post_comments, community_feed_items). Bucket A re-targeted
--      the create flow to feed_posts; these tables remained at 0 rows with
--      no readers. CASCADE removes any leftover triggers (including the
--      `trg_post_to_feed` mirror referenced in older code comments).
--
--   2. Widen CHECK constraints on ai_decisions + explanation_templates to
--      admit 'community_post_published' and 'community_post_milestone'.
--
--   3. EN + FR templates for the two new decision types. Other languages
--      fall back to 'en' until backfill.
--
--   4. Three notification triggers (all SECURITY DEFINER + pinned
--      search_path + EXCEPTION sub-blocks for fan-out safety):
--        notify_community_post_created     (feed_posts INSERT, type=community)
--        notify_feed_post_liked            (feed_likes INSERT, scoped to
--                                           community posts; self-likes skipped)
--        notify_feed_post_commented        (feed_comments INSERT, same scope)
--
--   5. Two SEPARATE record_ai_decision wrappers (same isolated-function
--      pattern as migrations 219/220):
--        record_ai_decision_for_community_post_published
--          (feed_posts INSERT, type=community, !is_auto)
--        record_ai_decision_for_community_post_milestone
--          (feed_posts UPDATE OF likes_count, comments_count — fires when
--           likes_count crosses 10 OR comments_count crosses 5)
--
-- Architectural notes:
--   - Bucket-C spec acknowledged community fan-out is murky because
--     feed_posts has no community_id column. notify_community_post_created
--     intentionally notifies ONLY the author with a "Your post is live"
--     placeholder — useful confirmation, no spam. Future enhancement: add
--     community_id to feed_posts (or join via metadata) and fan out to
--     community_memberships WHERE status='active'.
--   - is_auto=true posts (lib/autoPost.ts mirror entries) skip both the
--     "post created" notification and the ai_decision recording — the
--     user didn't author them, so neither surface should treat them as
--     a user-driven event.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Drop dead tables ─────────────────────────────────────────────
-- CASCADE removes downstream FK constraints and any triggers that may
-- still reference these tables in the schema.

DROP TABLE IF EXISTS public.community_post_likes    CASCADE;
DROP TABLE IF EXISTS public.community_post_comments CASCADE;
DROP TABLE IF EXISTS public.community_posts         CASCADE;
DROP TABLE IF EXISTS public.community_feed_items    CASCADE;

-- ─── PART 2: Widen CHECK constraints for 2 new decision types ─────────────

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
    -- New in 221
    'community_post_published',
    'community_post_milestone'
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
    -- New in 221
    'community_post_published',
    'community_post_milestone'
  ));

-- ─── PART 3: EN + FR templates ────────────────────────────────────────────

INSERT INTO public.explanation_templates
  (decision_type, language, template_text, required_variables, active, created_at, updated_at)
VALUES
  ('community_post_published', 'en',
   'You shared a post in the community — keep engaging with members.',
   ARRAY[]::text[], true, now(), now()),
  ('community_post_published', 'fr',
   'Vous avez publié dans la communauté — continuez à interagir avec les membres.',
   ARRAY[]::text[], true, now(), now()),

  ('community_post_milestone', 'en',
   'Your post is resonating — it has [LIKES] likes and [COMMENTS] comments.',
   ARRAY['LIKES','COMMENTS'], true, now(), now()),
  ('community_post_milestone', 'fr',
   'Votre publication a du succès — [LIKES] j''aime et [COMMENTS] commentaires.',
   ARRAY['LIKES','COMMENTS'], true, now(), now())
ON CONFLICT DO NOTHING;

-- ─── PART 4: notify_community_post_created ────────────────────────────────
-- Fires on every feed_posts INSERT but short-circuits unless the row is
-- a user-authored community post. Notifies the author only (placeholder
-- — see migration header for the community-fan-out follow-up note).

CREATE OR REPLACE FUNCTION public.notify_community_post_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  IF NEW.type <> 'community' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_auto = TRUE THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'community_post_created'
       AND data->>'post_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'community_post_created',
        'Post shared',
        'Your post is now live in the community.',
        jsonb_build_object(
          'post_id',         NEW.id,
          'i18n_title_key',  'community.notification_post_created_title',
          'i18n_body_key',   'community.notification_post_created_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_community_post_created] failed for post %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_post_created_notify ON public.feed_posts;
CREATE TRIGGER tr_community_post_created_notify
AFTER INSERT ON public.feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_community_post_created();

-- ─── PART 5: notify_feed_post_liked ───────────────────────────────────────
-- Scoped to community posts. Self-likes don't notify. Idempotency on the
-- like row id (one notification per like).

CREATE OR REPLACE FUNCTION public.notify_feed_post_liked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author_id   UUID;
  v_post_type   TEXT;
  v_liker_name  TEXT;
  v_existing_id UUID;
BEGIN
  SELECT user_id, type INTO v_author_id, v_post_type
    FROM public.feed_posts
   WHERE id = NEW.post_id;
  IF v_post_type IS DISTINCT FROM 'community' THEN
    RETURN NEW;
  END IF;
  IF v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT full_name INTO v_liker_name FROM public.profiles WHERE id = NEW.user_id;
  v_liker_name := COALESCE(v_liker_name, 'A member');
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_author_id
       AND type = 'community_post_liked'
       AND data->>'like_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_author_id,
        'community_post_liked',
        'Post liked',
        v_liker_name || ' liked your post.',
        jsonb_build_object(
          'post_id',         NEW.post_id,
          'like_id',         NEW.id,
          'liker_id',        NEW.user_id,
          'liker_name',      v_liker_name,
          'i18n_title_key',  'community.notification_post_liked_title',
          'i18n_body_key',   'community.notification_post_liked_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_feed_post_liked] failed for like %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_feed_post_liked_notify ON public.feed_likes;
CREATE TRIGGER tr_feed_post_liked_notify
AFTER INSERT ON public.feed_likes
FOR EACH ROW
EXECUTE FUNCTION public.notify_feed_post_liked();

-- ─── PART 6: notify_feed_post_commented ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_feed_post_commented()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_author_id      UUID;
  v_post_type      TEXT;
  v_commenter_name TEXT;
  v_existing_id    UUID;
BEGIN
  SELECT user_id, type INTO v_author_id, v_post_type
    FROM public.feed_posts
   WHERE id = NEW.post_id;
  IF v_post_type IS DISTINCT FROM 'community' THEN
    RETURN NEW;
  END IF;
  IF v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  SELECT full_name INTO v_commenter_name FROM public.profiles WHERE id = NEW.user_id;
  v_commenter_name := COALESCE(v_commenter_name, 'A member');
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_author_id
       AND type = 'community_post_commented'
       AND data->>'comment_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_author_id,
        'community_post_commented',
        'New comment',
        v_commenter_name || ' commented on your post.',
        jsonb_build_object(
          'post_id',         NEW.post_id,
          'comment_id',      NEW.id,
          'commenter_id',    NEW.user_id,
          'commenter_name',  v_commenter_name,
          'i18n_title_key',  'community.notification_post_commented_title',
          'i18n_body_key',   'community.notification_post_commented_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_feed_post_commented] failed for comment %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_feed_post_commented_notify ON public.feed_comments;
CREATE TRIGGER tr_feed_post_commented_notify
AFTER INSERT ON public.feed_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_feed_post_commented();

-- ─── PART 7: record_ai_decision_for_community_post_published ──────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_community_post_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type <> 'community' THEN
    RETURN NEW;
  END IF;
  IF NEW.is_auto = TRUE THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'community_post_published',
      NEW.id::text,
      jsonb_build_object(),
      NEW.id,
      'feed_posts'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_community_post_published] failed for post %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_post_published_ai_decision ON public.feed_posts;
CREATE TRIGGER tr_community_post_published_ai_decision
AFTER INSERT ON public.feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_community_post_published();

-- ─── PART 8: record_ai_decision_for_community_post_milestone ──────────────
-- Threshold-edge trigger: fires only on the first UPDATE that takes
-- likes_count above 10 OR comments_count above 5 (crossing detection by
-- comparing OLD vs NEW). Stays silent on subsequent updates.

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_community_post_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_crossed_likes    BOOLEAN;
  v_crossed_comments BOOLEAN;
BEGIN
  IF NEW.type <> 'community' THEN
    RETURN NEW;
  END IF;
  v_crossed_likes := COALESCE(NEW.likes_count, 0) >= 10
                  AND COALESCE(OLD.likes_count, 0) < 10;
  v_crossed_comments := COALESCE(NEW.comments_count, 0) >= 5
                     AND COALESCE(OLD.comments_count, 0) < 5;
  IF NOT (v_crossed_likes OR v_crossed_comments) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'community_post_milestone',
      NEW.id::text,
      jsonb_build_object(
        'LIKES',    COALESCE(NEW.likes_count, 0)::text,
        'COMMENTS', COALESCE(NEW.comments_count, 0)::text
      ),
      NEW.id,
      'feed_posts'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_community_post_milestone] failed for post %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_post_milestone_ai_decision ON public.feed_posts;
CREATE TRIGGER tr_community_post_milestone_ai_decision
AFTER UPDATE OF likes_count, comments_count ON public.feed_posts
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_community_post_milestone();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '221',
  'community_post_lifecycle',
  ARRAY['-- 221: community_post_lifecycle']
)
ON CONFLICT (version) DO NOTHING;
