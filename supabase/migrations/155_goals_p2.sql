-- ============================================================================
-- Migration 155: Goals P2 (Automation & Learning)
-- ============================================================================
-- Adds the schema-level pieces of Goals P2:
--   1. feed_posts.linked_goal_id        — typed FK to user_savings_goals,
--      replaces the stringly-typed related_id for goal-linked posts.
--   2. user_savings_goals.round_up_enabled — per-jar opt-out for the
--      Round-up Savings sweep introduced in Send-Money P2 (migration 154).
--   3. goal_auto_post_settings          — user-level opt-out for the
--      milestone auto-post-to-feed feature.
--   4. spending_patterns                — banner data for the auto-suggest
--      goal feature. Today populated by hand (or seed); a future Edge
--      Function (placeholder shipped alongside this migration) will fill
--      it from money_transfers + contributions on a weekly cron.
--   5. post_goal_milestone_to_feed()    — AFTER INSERT trigger on
--      goal_milestones that drops a feed_posts row at every 25/50/75/100
--      crossing. Honors goal_auto_post_settings.milestones_enabled and
--      skips goal_type='round_up' (the Round-up jar shouldn't spam the
--      feed every $1.80 sweep).
--   6. suggest_goal_amount()            — median target_amount_cents of
--      the caller's past goals. Powers the "Usually you save $X" chip
--      on GoalCreateExpressScreen.
--   7. dismiss_spending_pattern(uuid)   — hides a row from the suggestion
--      banner without deleting it.
--
-- The existing _record_goal_milestones() function (migration 078) is left
-- untouched — it still inserts the goal_milestones row; the new trigger
-- fires downstream of that insert.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. feed_posts.linked_goal_id
-- ----------------------------------------------------------------------------
-- Auto-posts and any future manual goal-linked dream posts can now JOIN
-- against user_savings_goals via a proper FK instead of the existing
-- text related_id column. ON DELETE SET NULL so a deleted goal doesn't
-- cascade-delete the celebration posts.
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS linked_goal_id UUID
    REFERENCES public.user_savings_goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feed_posts_linked_goal_id
  ON public.feed_posts(linked_goal_id)
  WHERE linked_goal_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. user_savings_goals.round_up_enabled
-- ----------------------------------------------------------------------------
-- Defaults to TRUE on every goal so the existing Round-up Savings jar
-- (created during P2 onboarding) starts in the "on" state. Send-Money
-- P2 checks this column before sweeping; the GoalDetailV2 toggle flips
-- it without disturbing profiles.round_up_increment (which controls the
-- per-send increment).
ALTER TABLE public.user_savings_goals
  ADD COLUMN IF NOT EXISTS round_up_enabled BOOLEAN NOT NULL DEFAULT TRUE;


-- ----------------------------------------------------------------------------
-- 3. goal_auto_post_settings (user-level opt-out)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_auto_post_settings (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  milestones_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_auto_post_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gaps_select_own" ON public.goal_auto_post_settings;
DROP POLICY IF EXISTS "gaps_insert_own" ON public.goal_auto_post_settings;
DROP POLICY IF EXISTS "gaps_update_own" ON public.goal_auto_post_settings;

CREATE POLICY "gaps_select_own"
  ON public.goal_auto_post_settings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "gaps_insert_own"
  ON public.goal_auto_post_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "gaps_update_own"
  ON public.goal_auto_post_settings FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.goal_auto_post_settings IS
  'Per-user opt-out for milestone auto-posts to the dream feed. '
  'Default state (no row, or milestones_enabled=true) = posts enabled.';


-- ----------------------------------------------------------------------------
-- 4. spending_patterns (banner data)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spending_patterns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category             TEXT NOT NULL,
  monthly_avg_cents    BIGINT NOT NULL CHECK (monthly_avg_cents >= 0),
  suggested_save_cents BIGINT NOT NULL CHECK (suggested_save_cents >= 0),
  last_computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at         TIMESTAMPTZ,
  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_spending_patterns_user_active
  ON public.spending_patterns(user_id)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.spending_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_select_own" ON public.spending_patterns;
CREATE POLICY "sp_select_own"
  ON public.spending_patterns FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE policies for clients. Writes happen via the
-- SECURITY DEFINER edge function (service role) and the
-- dismiss_spending_pattern RPC below (also SECURITY DEFINER).
COMMENT ON TABLE public.spending_patterns IS
  'Server-computed spending insights that drive the "Save instead?" '
  'banner on the Goals hub. Today seeded manually for demo; a future '
  'weekly Edge Function (suggest-goals-from-spending) will populate it '
  'from money_transfers + contributions.';


-- ----------------------------------------------------------------------------
-- 5. post_goal_milestone_to_feed trigger
-- ----------------------------------------------------------------------------
-- Fires AFTER each new goal_milestones row. _record_goal_milestones
-- (migration 078) already enforces the 25/50/75/100 crossings and the
-- UNIQUE(goal_id, milestone_percent) constraint, so this trigger
-- automatically gets one fire per real crossing — no duplicates.
CREATE OR REPLACE FUNCTION public.post_goal_milestone_to_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id    UUID;
  v_goal_name  TEXT;
  v_goal_emoji TEXT;
  v_goal_type  TEXT;
  v_opted_in   BOOLEAN;
  v_content    TEXT;
BEGIN
  SELECT user_id, name, emoji, goal_type
    INTO v_user_id, v_goal_name, v_goal_emoji, v_goal_type
    FROM public.user_savings_goals
   WHERE id = NEW.goal_id;

  -- Goal vanished between the milestone insert and the trigger fire
  -- (race against goal deletion). Nothing useful to post.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't auto-post the Round-up Savings jar. It accumulates via every
  -- send and would otherwise spam the dream feed.
  IF COALESCE(v_goal_type, '') = 'round_up' THEN
    RETURN NEW;
  END IF;

  -- User-level opt-out check. Missing row OR milestones_enabled=true →
  -- posts are on (default). Only explicit false suppresses.
  SELECT milestones_enabled
    INTO v_opted_in
    FROM public.goal_auto_post_settings
   WHERE user_id = v_user_id;
  IF v_opted_in IS FALSE THEN
    RETURN NEW;
  END IF;

  v_content :=
    '🎉 I''ve reached ' || NEW.milestone_percent::TEXT
    || '% of my ' || COALESCE(v_goal_name, 'savings')
    || ' goal!'
    || COALESCE(' ' || v_goal_emoji, '');

  -- type='milestone' matches the existing FeedPostCard POST_TYPE_CONFIG
  -- so the badge ("Savings Milestone") and trophy emoji render as
  -- expected. linked_goal_id makes the post navigable back to the goal.
  INSERT INTO public.feed_posts (
    user_id, type, content, visibility, is_auto, linked_goal_id, metadata
  )
  VALUES (
    v_user_id,
    'milestone',
    v_content,
    'public',
    TRUE,
    NEW.goal_id,
    jsonb_build_object(
      'milestone_percent', NEW.milestone_percent,
      'goal_id',           NEW.goal_id,
      'goal_emoji',        v_goal_emoji,
      'auto_source',       'goal_milestone'
    )
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS goal_milestone_auto_post ON public.goal_milestones;
CREATE TRIGGER goal_milestone_auto_post
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.post_goal_milestone_to_feed();

COMMENT ON FUNCTION public.post_goal_milestone_to_feed IS
  'Trigger fired after _record_goal_milestones inserts a milestone row. '
  'Writes a celebration feed_posts row (type=milestone, is_auto=true) '
  'linked to the goal. Skips round_up goals + users opted out via '
  'goal_auto_post_settings.';


-- ----------------------------------------------------------------------------
-- 6. RPC — suggest_goal_amount (median past target)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_goal_amount()
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT (percentile_cont(0.5) WITHIN GROUP (ORDER BY target_amount_cents))::BIGINT
    FROM public.user_savings_goals
   WHERE user_id = auth.uid()
     AND target_amount_cents IS NOT NULL
     AND target_amount_cents > 0;
$function$;

REVOKE EXECUTE ON FUNCTION public.suggest_goal_amount() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.suggest_goal_amount() TO authenticated, service_role;

COMMENT ON FUNCTION public.suggest_goal_amount IS
  'Returns the median target_amount_cents across the caller''s existing '
  'goals. NULL when there are no past goals — caller hides the suggestion '
  'chip in that case.';


-- ----------------------------------------------------------------------------
-- 7. RPC — dismiss_spending_pattern
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dismiss_spending_pattern(
  p_pattern_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_rows INT;
BEGIN
  UPDATE public.spending_patterns
     SET dismissed_at = now()
   WHERE id = p_pattern_id
     AND user_id = auth.uid()
     AND dismissed_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.dismiss_spending_pattern(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.dismiss_spending_pattern(UUID) TO authenticated;

COMMENT ON FUNCTION public.dismiss_spending_pattern IS
  'Soft-dismisses one of the caller''s spending_patterns rows. Idempotent: '
  'returns false if the row is already dismissed or doesn''t belong to the '
  'caller.';


-- ----------------------------------------------------------------------------
-- 8. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '155',
  'goals_p2',
  ARRAY['-- 155: linked_goal_id + round_up_enabled + auto-post trigger + spending_patterns + RPCs']
)
ON CONFLICT (version) DO NOTHING;
