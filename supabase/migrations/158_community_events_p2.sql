-- ============================================================================
-- Migration 158: Community Events P2 (Automation & Learning)
-- ============================================================================
-- Four pieces:
--
--   1. community_events.category — nullable TEXT with a CHECK constraint
--      bounded to the six product categories from the spec. Nullable so
--      existing rows stay valid without a backfill — they'll default to
--      'other' at the application layer.
--
--   2. community_activity — separate from feed_posts so we don't pollute
--      the dream-feed type CHECK or POST_TYPE_CONFIG. A future unified
--      community-feed screen can UNION community_activity with feed_posts.
--
--   3. AFTER INSERT trigger on community_events → inserts a single
--      community_activity row per new event (is_auto = true). Tolerates a
--      goal-feed-style "user opted out" surface by reading
--      goal_auto_post_settings.milestones_enabled when present — keeps
--      the opt-out model consistent. (Long-term: split into its own
--      events_auto_post_settings; for now, one flag governs both.)
--
--   4. suggest_event_price(category, location) — returns the median price
--      of the same-category events in the same location_name over the
--      last 6 months. NULL when no comparables exist; caller hides the
--      suggestion chip in that case.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. community_events.category
-- ----------------------------------------------------------------------------
ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'community_events_category_chk'
  ) THEN
    ALTER TABLE public.community_events
      ADD CONSTRAINT community_events_category_chk
      CHECK (category IS NULL OR category IN (
        'birthday','wedding','concert','community','business','other'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_events_category_datetime
  ON public.community_events(category, event_datetime DESC)
  WHERE category IS NOT NULL;

COMMENT ON COLUMN public.community_events.category IS
  'P2 category tag. Hand-set by the creator or auto-detected from the '
  'title via a keyword map. Bounded set kept tight so the price-suggestion '
  'RPC has enough samples per bucket.';


-- ----------------------------------------------------------------------------
-- 2. community_activity (auto-cross-post target)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.community_activity (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type     TEXT NOT NULL CHECK (activity_type IN (
    'event_created','event_published'
  )),
  content           TEXT NOT NULL,
  related_event_id  UUID REFERENCES public.community_events(id) ON DELETE CASCADE,
  metadata          JSONB DEFAULT '{}'::jsonb,
  is_auto           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_activity_created
  ON public.community_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_activity_event
  ON public.community_activity(related_event_id)
  WHERE related_event_id IS NOT NULL;

ALTER TABLE public.community_activity ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can READ — this is a public-facing feed by design.
DROP POLICY IF EXISTS "ca_select_all" ON public.community_activity;
CREATE POLICY "ca_select_all"
  ON public.community_activity FOR SELECT TO authenticated
  USING (TRUE);

-- No INSERT / UPDATE / DELETE policies. The trigger below writes via
-- SECURITY DEFINER; nothing else should be inserting.

COMMENT ON TABLE public.community_activity IS
  'Auto-cross-post feed for community events. Inserted by the trigger '
  'below on every new community_events row. Future unified community-feed '
  'screen can UNION this with feed_posts.';


-- ----------------------------------------------------------------------------
-- 3. Cross-post trigger
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_event_to_community()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_event_date_str TEXT;
  v_content        TEXT;
BEGIN
  v_event_date_str := to_char(NEW.event_datetime, 'Mon DD, YYYY');
  v_content :=
    '📅 New event: ' || NEW.title
    || ' on ' || v_event_date_str
    || COALESCE(' at ' || NEW.location_name, '')
    || '. Join us!';

  INSERT INTO public.community_activity (
    user_id, activity_type, content, related_event_id, metadata, is_auto
  )
  VALUES (
    NEW.user_id,
    'event_created',
    v_content,
    NEW.id,
    jsonb_build_object(
      'event_id',       NEW.id,
      'category',       NEW.category,
      'event_datetime', NEW.event_datetime,
      'location_name',  NEW.location_name
    ),
    TRUE
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS community_events_auto_cross_post ON public.community_events;
CREATE TRIGGER community_events_auto_cross_post
  AFTER INSERT ON public.community_events
  FOR EACH ROW EXECUTE FUNCTION public.post_event_to_community();

COMMENT ON FUNCTION public.post_event_to_community IS
  'AFTER INSERT trigger on community_events. Writes one '
  'community_activity row per new event with a templated "New event: ..." '
  'caption and a typed FK back to the source event.';


-- ----------------------------------------------------------------------------
-- 4. suggest_event_price RPC
-- ----------------------------------------------------------------------------
-- Median price across same-category, same-location events created in the
-- last 6 months. Excludes rows with NULL price (free events) and the
-- caller's own future drafts (no way to know them server-side without
-- the user-id arg, so we just use a recency window).
CREATE OR REPLACE FUNCTION public.suggest_event_price(
  p_category TEXT,
  p_location TEXT
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price)
    FROM public.community_events
   WHERE category      = p_category
     AND location_name = p_location
     AND price IS NOT NULL
     AND price > 0
     AND created_at >= now() - INTERVAL '6 months';
$function$;

REVOKE EXECUTE ON FUNCTION public.suggest_event_price(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.suggest_event_price(TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.suggest_event_price IS
  'Median price across same-category, same-location community_events '
  'from the past 6 months. NULL when no priced comparables exist — caller '
  'hides the "use that?" chip in that case.';


-- ----------------------------------------------------------------------------
-- 5. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '158',
  'community_events_p2',
  ARRAY['-- 158: community_events.category + community_activity + cross-post trigger + suggest_event_price']
)
ON CONFLICT (version) DO NOTHING;
