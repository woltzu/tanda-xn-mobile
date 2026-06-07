-- ============================================================================
-- Migration 124: SyncStream -- co-watching rooms backend
-- ============================================================================
-- Phase 1 of SyncStream (the future Action-tab replacement). Pure backend:
--   * 4 tables: sync_rooms, sync_room_members, sync_room_votes,
--               sync_room_reactions
--   * RLS so the realtime channels are safe for any signed-in user
--   * 6 RPCs that encapsulate every room operation a client needs
--   * supabase_realtime publication ADDs so subscribers see live changes
--
-- The phase-1 contract is "any authenticated user can discover any room,
-- join it, queue content, react, and vote to skip." Room creators retain
-- room-update authority. A future phase may scope discovery (friends-only
-- rooms, private rooms, blocklists, etc.); the schema can absorb that
-- via additional columns + tightened policies without table churn.
--
-- Notable spec deviations and why:
--   * The spec listed an "INSERT UPDATE" combined policy on
--     sync_room_votes. RLS policies are FOR exactly one action and
--     INSERT uses WITH CHECK, not USING. Split into two correct
--     policies (votes_insert, votes_update).
--   * realtime publication ADDs are wrapped in DO blocks that tolerate
--     "relation is already member" so re-running this migration on a
--     project where someone already enabled realtime on one of these
--     tables doesn't abort.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  vibe                TEXT NOT NULL
                      CHECK (vibe IN ('chill', 'chaos', 'learning', 'party', 'custom')),
  current_content_id  TEXT,
  content_queue       JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_active         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_rooms_active
  ON public.sync_rooms (is_active, last_active DESC);


CREATE TABLE IF NOT EXISTS public.sync_room_members (
  room_id         UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_room_members_room
  ON public.sync_room_members (room_id);


CREATE TABLE IF NOT EXISTS public.sync_room_votes (
  room_id    UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_skip  BOOLEAN NOT NULL DEFAULT false,
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_room_votes_room
  ON public.sync_room_votes (room_id);


CREATE TABLE IF NOT EXISTS public.sync_room_reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  emoji       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_room_reactions_room
  ON public.sync_room_reactions (room_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- Step 2: RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.sync_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_reactions ENABLE ROW LEVEL SECURITY;

-- rooms: anyone signed in can discover; only creator updates room state
-- (queue mutations + content advance go through SECURITY DEFINER RPCs
-- which bypass this policy by design).
DROP POLICY IF EXISTS rooms_select ON public.sync_rooms;
CREATE POLICY rooms_select
  ON public.sync_rooms FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS rooms_update ON public.sync_rooms;
CREATE POLICY rooms_update
  ON public.sync_rooms FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- members: anyone can see members (for the presence list); join/leave
-- only as yourself.
DROP POLICY IF EXISTS members_select ON public.sync_room_members;
CREATE POLICY members_select
  ON public.sync_room_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS members_insert ON public.sync_room_members;
CREATE POLICY members_insert
  ON public.sync_room_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS members_update ON public.sync_room_members;
CREATE POLICY members_update
  ON public.sync_room_members FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS members_delete ON public.sync_room_members;
CREATE POLICY members_delete
  ON public.sync_room_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- votes: split the spec's combined policy into a correct INSERT (with
-- WITH CHECK) and a separate UPDATE (with USING).
DROP POLICY IF EXISTS votes_select ON public.sync_room_votes;
CREATE POLICY votes_select
  ON public.sync_room_votes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS votes_insert ON public.sync_room_votes;
CREATE POLICY votes_insert
  ON public.sync_room_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS votes_update ON public.sync_room_votes;
CREATE POLICY votes_update
  ON public.sync_room_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- reactions: anyone can see, you can only insert your own.
DROP POLICY IF EXISTS reactions_select ON public.sync_room_reactions;
CREATE POLICY reactions_select
  ON public.sync_room_reactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS reactions_insert ON public.sync_room_reactions;
CREATE POLICY reactions_insert
  ON public.sync_room_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- Step 3: RPCs
-- ----------------------------------------------------------------------------
-- Each is SECURITY DEFINER with pinned search_path. They encapsulate
-- the few multi-step operations a client needs (so RLS can stay simple)
-- and return a JSONB summary the client can show without a second
-- round trip.
--
-- All six grant EXECUTE to authenticated.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_sync_room(
  p_name TEXT,
  p_vibe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_room_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  INSERT INTO sync_rooms (created_by, name, vibe)
  VALUES (v_user_id, trim(p_name), p_vibe)
  RETURNING id INTO v_room_id;

  -- Creator joins their own room automatically.
  INSERT INTO sync_room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', v_room_id,
    'created_by', v_user_id,
    'source', 'create_sync_room_v1'
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.join_sync_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- Verify the room exists and is active.
  IF NOT EXISTS (SELECT 1 FROM sync_rooms WHERE id = p_room_id AND is_active) THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_active');
  END IF;

  INSERT INTO sync_room_members (room_id, user_id, last_heartbeat)
  VALUES (p_room_id, v_user_id, NOW())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET last_heartbeat = NOW();

  -- Bump last_active on the room so empty-room reapers know it's hot.
  UPDATE sync_rooms SET last_active = NOW() WHERE id = p_room_id;

  SELECT COUNT(*) INTO v_member_count
  FROM sync_room_members WHERE room_id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'member_count', v_member_count,
    'source', 'join_sync_room_v1'
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.leave_sync_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_count INTEGER;
  v_marked_inactive BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  DELETE FROM sync_room_members
  WHERE room_id = p_room_id AND user_id = v_user_id;

  -- Drop the caller's skip vote so the threshold maths stay consistent.
  DELETE FROM sync_room_votes
  WHERE room_id = p_room_id AND user_id = v_user_id;

  SELECT COUNT(*) INTO v_member_count
  FROM sync_room_members WHERE room_id = p_room_id;

  -- If the room emptied out, mark it inactive so the lobby filters it
  -- out without us having to delete the row (which would lose history
  -- on reactions etc.).
  IF v_member_count = 0 THEN
    UPDATE sync_rooms SET is_active = false WHERE id = p_room_id;
    v_marked_inactive := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'member_count', v_member_count,
    'marked_inactive', v_marked_inactive,
    'source', 'leave_sync_room_v1'
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.add_to_queue(
  p_room_id UUID,
  p_content_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_queue_length INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_content_url IS NULL OR length(trim(p_content_url)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'content_url_required');
  END IF;

  -- Caller must be a current member of the room.
  IF NOT EXISTS (
    SELECT 1 FROM sync_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_room');
  END IF;

  -- Append. content_queue is jsonb[], so wrap the entry as a single-
  -- element array and concat. Entries are objects so a future field
  -- (title, duration, added_by, etc.) lands without a schema change.
  UPDATE sync_rooms
  SET    content_queue = content_queue || jsonb_build_array(jsonb_build_object(
           'url',      trim(p_content_url),
           'added_by', v_user_id,
           'added_at', NOW()
         )),
         last_active   = NOW()
  WHERE  id = p_room_id;

  SELECT jsonb_array_length(content_queue) INTO v_queue_length
  FROM sync_rooms WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'queue_length', v_queue_length,
    'source', 'add_to_queue_v1'
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.vote_skip(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_member_count INTEGER;
  v_skip_count INTEGER;
  v_threshold INTEGER;
  v_advanced BOOLEAN := false;
  v_advance_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sync_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_room');
  END IF;

  -- Upsert the vote. Re-voting just stamps voted_at so the client can
  -- show "voted just now" feedback without double-counting.
  INSERT INTO sync_room_votes (room_id, user_id, vote_skip, voted_at)
  VALUES (p_room_id, v_user_id, true, NOW())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET vote_skip = true, voted_at = NOW();

  -- Threshold = ceil(member_count / 2). Auto-advance the moment the
  -- skip count crosses it. This is the only place we read the live
  -- member + vote counts in the same statement window.
  SELECT COUNT(*) INTO v_member_count
  FROM sync_room_members WHERE room_id = p_room_id;

  SELECT COUNT(*) INTO v_skip_count
  FROM sync_room_votes
  WHERE room_id = p_room_id AND vote_skip = true;

  v_threshold := GREATEST(1, (v_member_count + 1) / 2);  -- ceil(n/2) for n >= 1

  IF v_skip_count >= v_threshold THEN
    v_advance_result := advance_content(p_room_id);
    v_advanced := true;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'member_count', v_member_count,
    'skip_count', v_skip_count,
    'threshold', v_threshold,
    'advanced', v_advanced,
    'advance_result', v_advance_result,
    'source', 'vote_skip_v1'
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.advance_content(p_room_id UUID)
RETURNS JSONB
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
BEGIN
  -- Either a member or the room creator can advance; the vote_skip
  -- caller is verified to be a member upstream, but a stand-alone
  -- advance_content call (e.g. on natural content end) shouldn't
  -- require it.
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT content_queue INTO v_queue
  FROM sync_rooms WHERE id = p_room_id;

  IF v_queue IS NULL OR jsonb_array_length(v_queue) = 0 THEN
    UPDATE sync_rooms
    SET    current_content_id = NULL,
           last_active = NOW()
    WHERE  id = p_room_id;

    -- Still clear skip votes so the next round starts clean.
    DELETE FROM sync_room_votes WHERE room_id = p_room_id;

    RETURN jsonb_build_object(
      'success', true,
      'room_id', p_room_id,
      'advanced', false,
      'reason', 'queue_empty',
      'source', 'advance_content_v1'
    );
  END IF;

  v_next := v_queue -> 0;
  v_next_url := v_next ->> 'url';

  -- Drop the head and the leading element from the queue.
  v_remaining_queue := CASE
    WHEN jsonb_array_length(v_queue) <= 1 THEN '[]'::jsonb
    ELSE (SELECT jsonb_agg(elem) FROM jsonb_array_elements(v_queue) WITH ORDINALITY t(elem, ord) WHERE ord > 1)
  END;

  UPDATE sync_rooms
  SET    current_content_id = v_next_url,
         content_queue      = v_remaining_queue,
         last_active        = NOW()
  WHERE  id = p_room_id;

  -- Clear any skip votes for the new track.
  DELETE FROM sync_room_votes WHERE room_id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'advanced', true,
    'new_content', v_next,
    'queue_remaining', jsonb_array_length(v_remaining_queue),
    'source', 'advance_content_v1'
  );
END;
$function$;


-- ----------------------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.create_sync_room(TEXT, TEXT)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_sync_room(UUID)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_sync_room(UUID)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_to_queue(UUID, TEXT)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.vote_skip(UUID)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_content(UUID)                     TO authenticated;


-- ----------------------------------------------------------------------------
-- Step 4: realtime publication
-- ----------------------------------------------------------------------------
-- Each ADD is wrapped in a DO block because ALTER PUBLICATION ... ADD
-- TABLE errors if the table is already a member. We swallow the
-- duplicate_object exception so this migration is re-runnable.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_rooms;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_votes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('124', 'syncstream_rooms',
        ARRAY['-- 124: SyncStream phase 1 -- tables + RLS + 6 RPCs + realtime'])
ON CONFLICT (version) DO NOTHING;
