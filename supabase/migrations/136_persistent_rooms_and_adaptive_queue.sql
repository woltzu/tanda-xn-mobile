-- =============================================================================
-- 136: persistent_rooms_and_adaptive_queue
-- =============================================================================
-- Phase R6: rooms stay active until the host explicitly ends them, and the
-- content queue self-replenishes from a vibe-keyed pool when it empties.
--
-- This migration:
--   1. Unschedules the deactivate-inactive-rooms cron if present. (Live
--      DB check shows the cron is NOT currently scheduled -- the function
--      exists from migration 125 but was never wired to cron.job. This
--      block is a no-op safety net; the function itself stays around for
--      manual ops use.)
--   2. Creates sync_room_video_history -- one row per play, written from
--      advance_content (so the same source-of-truth records both manual
--      advance and auto-skip plays without per-client logging).
--   3. Extends advance_content to log the outgoing current_content_id
--      before it's swapped out. Keep everything else verbatim from the
--      live v1 body -- this is purely additive.
--   4. Adds suggest_next_video(p_room_id) RPC. MVP picks from a hardcoded
--      vibe pool, dedups against (current + queue + last 10 in history),
--      and either sets current_content_id directly (if nothing playing)
--      or appends to the queue (if a video is playing). Honours
--      room_settings.auto_suggest_enabled (defaults to true when missing).
--   5. Adds set_room_auto_suggest(p_room_id, p_enabled) so the host UI
--      can flip the toggle without touching room_settings JSONB directly.
--
-- Out of scope:
--   - Real recommendation engine (CircleMatchingService / XnScore tie-in).
--     The spec lists those as data sources but the MVP is the vibe pool.
--   - YouTube Data API related-videos fetch (no API key + server-side
--     HTTP from Postgres requires pg_net or an Edge Function).
--   - The lobby's `last_active > 1h ago` filter -- separate concern, not
--     touched here. Persistent rooms still disappear from the lobby
--     after 1h of dead air; lifecycle is unchanged.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Cron unschedule (idempotent, no-op when not scheduled).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deactivate-inactive-rooms') THEN
    PERFORM cron.unschedule('deactivate-inactive-rooms');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Video history table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_room_video_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  video_id          TEXT NOT NULL,
  source            TEXT NOT NULL CHECK (source IN ('youtube', 'uploaded', 'url')),
  duration_seconds  INTEGER,
  metadata          JSONB,
  played_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_room_video_history_room_idx
  ON public.sync_room_video_history (room_id, played_at DESC);

ALTER TABLE public.sync_room_video_history ENABLE ROW LEVEL SECURITY;

-- SELECT for room members. INSERT only via SECURITY DEFINER from
-- advance_content, so no INSERT policy is needed (and not exposing one
-- prevents the client from forging history rows).
DROP POLICY IF EXISTS video_history_select_member ON public.sync_room_video_history;
CREATE POLICY video_history_select_member ON public.sync_room_video_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sync_room_members m
      WHERE m.room_id = sync_room_video_history.room_id
        AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Extend advance_content. The body below is the live v1 verbatim
--    with one addition: log the outgoing current_content_id to
--    sync_room_video_history right at the top, before any state changes.
--    Both manual-advance and R3 auto-skip pass through this function so
--    both paths log automatically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_content(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_queue JSONB;
  v_next JSONB;
  v_next_url TEXT;
  v_remaining_queue JSONB;
  v_outgoing TEXT;
  v_outgoing_source TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- R6 addition: log the video we're skipping past before we swap it out.
  -- Soft-fail on log errors so a logging hiccup never blocks the advance.
  SELECT current_content_id INTO v_outgoing
    FROM sync_rooms WHERE id = p_room_id;
  IF v_outgoing IS NOT NULL THEN
    v_outgoing_source := CASE
      WHEN v_outgoing ILIKE '%youtube.com%' OR v_outgoing ILIKE '%youtu.be%'
        THEN 'youtube'
      ELSE 'url'
    END;
    BEGIN
      INSERT INTO sync_room_video_history (room_id, video_id, source)
      VALUES (p_room_id, v_outgoing, v_outgoing_source);
    EXCEPTION WHEN OTHERS THEN
      -- Swallow -- losing one history row beats failing an advance.
      NULL;
    END;
  END IF;

  SELECT content_queue INTO v_queue
  FROM sync_rooms WHERE id = p_room_id;

  IF v_queue IS NULL OR jsonb_array_length(v_queue) = 0 THEN
    UPDATE sync_rooms
    SET    current_content_id = NULL,
           last_active = NOW()
    WHERE  id = p_room_id;

    DELETE FROM sync_room_votes WHERE room_id = p_room_id;

    RETURN jsonb_build_object(
      'success', true,
      'room_id', p_room_id,
      'advanced', false,
      'reason', 'queue_empty',
      'source', 'advance_content_v2'
    );
  END IF;

  v_next := v_queue -> 0;
  v_next_url := v_next ->> 'url';

  v_remaining_queue := CASE
    WHEN jsonb_array_length(v_queue) <= 1 THEN '[]'::jsonb
    ELSE (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(v_queue) WITH ORDINALITY t(elem, ord)
      WHERE ord > 1
    )
  END;

  UPDATE sync_rooms
  SET    current_content_id = v_next_url,
         content_queue      = v_remaining_queue,
         last_active        = NOW()
  WHERE  id = p_room_id;

  DELETE FROM sync_room_votes WHERE room_id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'advanced', true,
    'new_content', v_next,
    'queue_remaining', jsonb_array_length(v_remaining_queue),
    'source', 'advance_content_v2'
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 4. suggest_next_video. Vibe-keyed pool, dedups against recent state.
--    Sets current_content_id directly when nothing's playing; otherwise
--    appends to content_queue so the next natural advance picks it up.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suggest_next_video(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vibe         TEXT;
  v_room_type    TEXT;
  v_settings     JSONB;
  v_current      TEXT;
  v_pool         TEXT[];
  v_used         TEXT[];
  v_choice       TEXT;
  v_member_check INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT vibe, room_type, room_settings, current_content_id
    INTO v_vibe, v_room_type, v_settings, v_current
    FROM sync_rooms WHERE id = p_room_id;
  IF v_vibe IS NULL AND v_room_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;

  -- Caller must be a room member. Hosts pass naturally; members are
  -- allowed too (so a non-host's empty-queue trigger doesn't fail
  -- silently, although the SyncRoomScreen client only fires this from
  -- the host's instance).
  SELECT 1 INTO v_member_check
    FROM sync_room_members
   WHERE room_id = p_room_id AND user_id = auth.uid()
   LIMIT 1;
  IF v_member_check IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_member');
  END IF;

  -- Per-room opt-out. Missing key defaults to enabled.
  IF COALESCE((v_settings ->> 'auto_suggest_enabled')::boolean, true) = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'auto_suggest_disabled');
  END IF;

  -- Hardcoded MVP pools. The URLs lean toward stable channels (Lofi Girl,
  -- 3Blue1Brown, etc.) but should be replaced by a curated table or an
  -- external recommender in a follow-up.
  v_pool := CASE
    WHEN v_vibe = 'chill' THEN ARRAY[
      'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      'https://www.youtube.com/watch?v=5yx6BWlEVcY',
      'https://www.youtube.com/watch?v=DWcJFNfaw9c',
      'https://www.youtube.com/watch?v=rUxyKA_-grg'
    ]
    WHEN v_vibe = 'chaos' THEN ARRAY[
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=GbpnAGajyMc',
      'https://www.youtube.com/watch?v=ZZ5LpwO-An4'
    ]
    WHEN v_vibe = 'learning' THEN ARRAY[
      'https://www.youtube.com/watch?v=aircAruvnKk',
      'https://www.youtube.com/watch?v=zR3Igc3Rhfg',
      'https://www.youtube.com/watch?v=kQp6NwhBy84',
      'https://www.youtube.com/watch?v=Y8Tko2YC5hA'
    ]
    WHEN v_vibe = 'party' THEN ARRAY[
      'https://www.youtube.com/watch?v=fLexgOxsZu0',
      'https://www.youtube.com/watch?v=3tmd-ClpJxA',
      'https://www.youtube.com/watch?v=09R8_2nJtjg'
    ]
    WHEN v_vibe = 'reverent' OR v_room_type = 'worship' THEN ARRAY[
      'https://www.youtube.com/watch?v=Yr1RHQjEqVA',
      'https://www.youtube.com/watch?v=NlprozGcs80',
      'https://www.youtube.com/watch?v=ywAtTUixpkk'
    ]
    ELSE ARRAY[
      -- Fallback for 'custom' or any unrecognised vibe.
      'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      'https://www.youtube.com/watch?v=aircAruvnKk',
      'https://www.youtube.com/watch?v=5yx6BWlEVcY'
    ]
  END;

  -- Dedup set: current_content_id + everything in the queue + last 10
  -- entries in history. Build as a TEXT[] so we can use != ALL().
  SELECT array_agg(used_url) INTO v_used FROM (
    SELECT v_current AS used_url WHERE v_current IS NOT NULL
    UNION
    SELECT (elem ->> 'url') AS used_url
      FROM sync_rooms r,
           jsonb_array_elements(COALESCE(r.content_queue, '[]'::jsonb)) elem
     WHERE r.id = p_room_id
    UNION
    SELECT video_id
      FROM (
        SELECT video_id FROM sync_room_video_history
         WHERE room_id = p_room_id
         ORDER BY played_at DESC
         LIMIT 10
      ) recent
  ) used_set
  WHERE used_url IS NOT NULL;

  -- Pick a random unused URL. If everything's used, fall back to a
  -- pure-random pick (a repeat is better than failing).
  SELECT candidate INTO v_choice
    FROM unnest(v_pool) AS candidate
   WHERE candidate != ALL(COALESCE(v_used, ARRAY[]::TEXT[]))
   ORDER BY random()
   LIMIT 1;

  IF v_choice IS NULL THEN
    SELECT candidate INTO v_choice
      FROM unnest(v_pool) AS candidate
     ORDER BY random()
     LIMIT 1;
  END IF;

  IF v_choice IS NULL THEN
    -- Pool itself is empty -- shouldn't happen with the CASE above but
    -- guard so the function never errors out.
    RETURN jsonb_build_object('success', false, 'error', 'pool_empty');
  END IF;

  -- Apply: set as current if nothing's playing, otherwise append to queue.
  IF v_current IS NULL THEN
    UPDATE sync_rooms
       SET current_content_id = v_choice,
           last_active = NOW()
     WHERE id = p_room_id;
    RETURN jsonb_build_object(
      'success', true,
      'url', v_choice,
      'placement', 'current',
      'vibe', v_vibe,
      'source', 'pool'
    );
  ELSE
    UPDATE sync_rooms
       SET content_queue = COALESCE(content_queue, '[]'::jsonb)
                           || jsonb_build_array(jsonb_build_object(
                                'url', v_choice,
                                'added_by', 'system',
                                'added_at', NOW()::text
                              )),
           last_active = NOW()
     WHERE id = p_room_id;
    RETURN jsonb_build_object(
      'success', true,
      'url', v_choice,
      'placement', 'queue',
      'vibe', v_vibe,
      'source', 'pool'
    );
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. set_room_auto_suggest. Host-only update to the JSONB flag.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_room_auto_suggest(
  p_room_id UUID,
  p_enabled BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;
  SELECT created_by INTO v_creator FROM sync_rooms WHERE id = p_room_id;
  IF v_creator IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;
  IF v_creator <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'host_only');
  END IF;

  UPDATE sync_rooms
     SET room_settings = COALESCE(room_settings, '{}'::jsonb)
                          || jsonb_build_object('auto_suggest_enabled', p_enabled)
   WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true, 'auto_suggest_enabled', p_enabled);
END;
$$;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '136',
  'persistent_rooms_and_adaptive_queue',
  ARRAY['-- 136: persistent_rooms_and_adaptive_queue']
)
ON CONFLICT (version) DO NOTHING;
