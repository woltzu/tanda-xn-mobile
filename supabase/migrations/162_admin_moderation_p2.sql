-- ============================================================================
-- Migration 162: Admin Moderation P2 (Automation & Learning)
-- ============================================================================
-- Five pieces:
--
--   1. moderation_keywords — admin-curated keyword list. New rows can be
--      added at any time without touching code; the trigger reads live.
--
--   2. content_reports + user_reports priority and tags columns.
--      priority drives queue ordering; tags carry the auto-flag reason
--      and any later admin annotation.
--
--   3. check_content_for_keywords(text) RPC — returns the matched
--      keywords. Used by the trigger and exposed for ad-hoc admin probes.
--
--   4. auto_flag_content_report BEFORE INSERT trigger on content_reports.
--      Resolves the source content polymorphically, runs the keyword
--      scan, sets priority='high' and appends an "Auto-flagged: …" tag
--      when anything hits. Idempotent because BEFORE INSERT only fires
--      once per row.
--
--   5. auto_dismiss_reports_on_content_delete AFTER DELETE triggers on
--      feed_posts / feed_comments / community_events / circle_messages.
--      The migration-152 RPC already auto-dismisses pending reports when
--      an admin uses delete_content; this trigger covers the case where
--      the author deletes their own row before review (the
--      "false-positive" case in the spec).
--
-- Plus a small CHECK extension on moderation_actions so the repeat-
-- offender Edge Function (next phase) can log auto_suspend / auto_ban
-- as distinct verbs from the manual ones.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. moderation_keywords
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_keywords (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword    TEXT NOT NULL CHECK (length(trim(keyword)) > 0),
  severity   TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (keyword)
);

ALTER TABLE public.moderation_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mk_admin_all" ON public.moderation_keywords;
-- Admins read + write. No anon / authenticated access — the keyword
-- list itself is sensitive (it reveals what we flag on).
CREATE POLICY "mk_admin_all"
  ON public.moderation_keywords FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.moderation_keywords IS
  'Admin-curated keyword list. The auto_flag_content_report trigger reads '
  'this live on every new content_reports row. Seed via the admin UI or '
  'a direct service-role INSERT.';


-- ----------------------------------------------------------------------------
-- 2. content_reports + user_reports priority and tags
-- ----------------------------------------------------------------------------
ALTER TABLE public.content_reports
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high')),
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_content_reports_priority_created
  ON public.content_reports(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_priority_created
  ON public.user_reports(priority, created_at DESC);


-- ----------------------------------------------------------------------------
-- 3. check_content_for_keywords RPC
-- ----------------------------------------------------------------------------
-- Returns the keywords that appear in the input (case-insensitive,
-- whole-word match). Bounded scan: the keyword list will stay small (<
-- a few hundred rows) for the foreseeable future, so a per-row loop is
-- fine.
CREATE OR REPLACE FUNCTION public.check_content_for_keywords(
  p_content TEXT
)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
           array_agg(DISTINCT k.keyword ORDER BY k.keyword),
           ARRAY[]::TEXT[]
         )
    FROM public.moderation_keywords k
   WHERE p_content IS NOT NULL
     AND p_content ~* ('\m' || k.keyword || '\M');
$function$;

REVOKE EXECUTE ON FUNCTION public.check_content_for_keywords(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.check_content_for_keywords(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.check_content_for_keywords IS
  'Returns the moderation_keywords that appear in p_content (case-'
  'insensitive whole-word match). Used by the auto_flag trigger and '
  'callable for ad-hoc admin probes.';


-- ----------------------------------------------------------------------------
-- 4. auto_flag_content_report trigger
-- ----------------------------------------------------------------------------
-- BEFORE INSERT on content_reports. Resolves NEW.content_id against the
-- right table per NEW.content_type, runs the keyword scan, and stamps
-- priority + tags before the row lands.
CREATE OR REPLACE FUNCTION public.auto_flag_content_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_content TEXT;
  v_hits    TEXT[];
  v_tags    TEXT[];
BEGIN
  v_content := CASE NEW.content_type
    WHEN 'dream_post' THEN (
      SELECT content FROM public.feed_posts WHERE id = NEW.content_id
    )
    WHEN 'comment' THEN (
      SELECT content FROM public.feed_comments WHERE id = NEW.content_id
    )
    WHEN 'event' THEN (
      SELECT title || ' ' || COALESCE(description, '')
        FROM public.community_events WHERE id = NEW.content_id
    )
    WHEN 'circle_message' THEN (
      SELECT body FROM public.circle_messages WHERE id = NEW.content_id
    )
    ELSE NULL
  END;

  IF v_content IS NULL THEN
    -- Source content gone (rare race) — leave priority + tags at the
    -- INSERT defaults and let the admin queue handle it.
    RETURN NEW;
  END IF;

  v_hits := public.check_content_for_keywords(v_content);
  IF array_length(v_hits, 1) IS NOT NULL THEN
    NEW.priority := 'high';
    -- Stamp one "Auto-flagged: kw" tag per hit on top of any tags the
    -- caller already passed in.
    SELECT NEW.tags || array_agg('Auto-flagged: ' || h)
      INTO v_tags
      FROM unnest(v_hits) AS h;
    NEW.tags := v_tags;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS content_reports_auto_flag ON public.content_reports;
CREATE TRIGGER content_reports_auto_flag
  BEFORE INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_flag_content_report();

COMMENT ON FUNCTION public.auto_flag_content_report IS
  'BEFORE INSERT on content_reports. Resolves the source content via '
  'content_type → table dispatch, scans for moderation_keywords hits, '
  'and sets priority=''high'' + appends Auto-flagged tags when any hit.';


-- ----------------------------------------------------------------------------
-- 5. auto-dismiss reports when the author deletes their content
-- ----------------------------------------------------------------------------
-- Migration 152 already auto-dismisses on the admin delete_content path.
-- This covers the "author deleted before review" case. Same content_id
-- target; same status update; only difference is the admin_notes blurb.
CREATE OR REPLACE FUNCTION public.auto_dismiss_reports_on_content_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE public.content_reports
     SET status      = 'dismissed',
         admin_notes = COALESCE(admin_notes, '')
                       || CASE WHEN admin_notes IS NULL OR admin_notes = ''
                               THEN '' ELSE E'\n' END
                       || '[Auto-dismissed: content removed by author at '
                       || now()::TEXT || ']',
         resolved_at = now(),
         tags        = tags || ARRAY['content_removed']::TEXT[]
   WHERE content_id = OLD.id
     AND status     = 'pending';
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS feed_posts_auto_dismiss_reports ON public.feed_posts;
CREATE TRIGGER feed_posts_auto_dismiss_reports
  AFTER DELETE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.auto_dismiss_reports_on_content_delete();

DROP TRIGGER IF EXISTS feed_comments_auto_dismiss_reports ON public.feed_comments;
CREATE TRIGGER feed_comments_auto_dismiss_reports
  AFTER DELETE ON public.feed_comments
  FOR EACH ROW EXECUTE FUNCTION public.auto_dismiss_reports_on_content_delete();

DROP TRIGGER IF EXISTS community_events_auto_dismiss_reports ON public.community_events;
CREATE TRIGGER community_events_auto_dismiss_reports
  AFTER DELETE ON public.community_events
  FOR EACH ROW EXECUTE FUNCTION public.auto_dismiss_reports_on_content_delete();

DROP TRIGGER IF EXISTS circle_messages_auto_dismiss_reports ON public.circle_messages;
CREATE TRIGGER circle_messages_auto_dismiss_reports
  AFTER DELETE ON public.circle_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_dismiss_reports_on_content_delete();

COMMENT ON FUNCTION public.auto_dismiss_reports_on_content_delete IS
  'AFTER DELETE on every reportable content table. Bulk-dismisses any '
  'pending content_reports for the deleted row. Idempotent because '
  'status filter only catches pending rows; second delete is a no-op.';


-- ----------------------------------------------------------------------------
-- 6. Extend moderation_actions.action CHECK with auto_suspend / auto_ban
-- ----------------------------------------------------------------------------
ALTER TABLE public.moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE public.moderation_actions
  ADD  CONSTRAINT moderation_actions_action_check
       CHECK (action IN (
         'warn','suspend','ban','delete_content','dismiss_report',
         'auto_suspend','auto_ban'
       ));


-- ----------------------------------------------------------------------------
-- 7. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '162',
  'admin_moderation_p2',
  ARRAY['-- 162: moderation_keywords + priority/tags + auto-flag trigger + auto-dismiss-on-delete + auto enum']
)
ON CONFLICT (version) DO NOTHING;
