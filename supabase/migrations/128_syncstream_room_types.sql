-- ============================================================================
-- Migration 128: SyncStream phase 5 -- room types + configurable settings
-- ============================================================================
-- Adds three columns + three RPCs:
--
--   room_type      enum-like text, drives the default room_settings the
--                  client applies at creation. CHECK constraint pins the
--                  five known types so a typo can't leak in.
--   room_settings  JSONB carrying the per-room overrides:
--                    auto_skip_allowed             bool
--                    skip_voter_role               'anyone'|'host_only'
--                    reaction_emojis               text[]
--                    remix_available_post_service  bool
--                    ai_prompt_style               text
--                    vibe_labels                   text[]
--                  Storing all five together as one JSONB column means a
--                  future setting lands without a schema migration and a
--                  client running old code that doesn't know about it
--                  still works fine (it just ignores the field).
--   ended_at       nullable timestamptz set by end_sync_room(). Drives
--                  the remix-post-service availability check.
--
-- RPCs replaced:
--   create_sync_room(name, vibe, is_public, room_type, room_settings)
--   vote_skip(room_id)  -- now reads auto_skip_allowed + skip_voter_role
-- RPC added:
--   end_sync_room(room_id)
--
-- room_settings back-fill: existing rows get sensible defaults keyed on
-- room_type. Today every existing row is room_type='general' (the
-- default), so the back-fill is uniform; but the code is shaped to
-- handle the cross-type case for free.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: schema
-- ----------------------------------------------------------------------------
ALTER TABLE public.sync_rooms
  ADD COLUMN IF NOT EXISTS room_type TEXT NOT NULL DEFAULT 'general'
    CHECK (room_type IN ('general', 'worship', 'movie_night', 'study_group', 'town_hall')),
  ADD COLUMN IF NOT EXISTS room_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.sync_rooms.room_settings IS
  'Per-room override map: auto_skip_allowed (bool), skip_voter_role '
  '(''anyone''|''host_only''), reaction_emojis (text[]), '
  'remix_available_post_service (bool), ai_prompt_style (text), '
  'vibe_labels (text[]). Missing keys fall back to type defaults '
  'baked into the client (config/sync-room-presets.ts).';

CREATE INDEX IF NOT EXISTS idx_sync_rooms_room_type
  ON public.sync_rooms (room_type) WHERE is_active = true;


-- ----------------------------------------------------------------------------
-- Step 2: back-fill room_settings on existing rows
-- ----------------------------------------------------------------------------
-- Use jsonb_build_object so a future column-default migration on
-- room_settings doesn't get clobbered.
WITH defaults AS (
  SELECT 'general' AS rt, jsonb_build_object(
    'auto_skip_allowed', true,
    'skip_voter_role', 'anyone',
    'reaction_emojis', jsonb_build_array('👍','😂','😮','❤️','🔥'),
    'remix_available_post_service', false,
    'ai_prompt_style', 'general'
  ) AS s
  UNION ALL SELECT 'worship', jsonb_build_object(
    'auto_skip_allowed', false,
    'skip_voter_role', 'host_only',
    'reaction_emojis', jsonb_build_array('🙏','❤️','😢','🕊️'),
    'remix_available_post_service', true,
    'ai_prompt_style', 'post_sermon_discussion',
    'vibe_labels', jsonb_build_array('reverent','celebratory','solemn','joyful')
  )
  UNION ALL SELECT 'movie_night', jsonb_build_object(
    'auto_skip_allowed', true,
    'skip_voter_role', 'anyone',
    'reaction_emojis', jsonb_build_array('😂','🔥','💀','🎬'),
    'remix_available_post_service', false,
    'ai_prompt_style', 'movie_trivia'
  )
  UNION ALL SELECT 'study_group', jsonb_build_object(
    'auto_skip_allowed', true,
    'skip_voter_role', 'host_only',
    'reaction_emojis', jsonb_build_array('🙋','📚','✨'),
    'remix_available_post_service', false,
    'ai_prompt_style', 'discussion_questions'
  )
  UNION ALL SELECT 'town_hall', jsonb_build_object(
    'auto_skip_allowed', true,
    'skip_voter_role', 'host_only',
    'reaction_emojis', jsonb_build_array('👍','👎','🗳️'),
    'remix_available_post_service', false,
    'ai_prompt_style', 'q_and_a'
  )
)
UPDATE public.sync_rooms r
SET    room_settings = d.s
FROM   defaults d
WHERE  r.room_type = d.rt
  AND  r.room_settings = '{}'::jsonb;


-- ----------------------------------------------------------------------------
-- Step 3: create_sync_room v3
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_sync_room(TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.create_sync_room(
  p_name TEXT,
  p_vibe TEXT,
  p_is_public BOOLEAN DEFAULT true,
  p_room_type TEXT DEFAULT 'general',
  p_room_settings JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_room_id UUID;
  v_invite_code TEXT;
  v_attempts INT := 0;
  v_settings JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  IF p_room_type NOT IN ('general', 'worship', 'movie_night', 'study_group', 'town_hall') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_room_type');
  END IF;

  -- Caller can pass a complete settings object (the client does this
  -- by merging the type preset with any user overrides). When NULL,
  -- the server applies the type-specific preset itself so that
  -- downstream functions (vote_skip in particular) can trust
  -- room_settings to be populated and don't need a parallel preset
  -- map. Keeps the "always have a working default" invariant even if
  -- a future caller forgets to merge the preset.
  IF p_room_settings IS NULL OR p_room_settings = '{}'::jsonb THEN
    v_settings := CASE p_room_type
      WHEN 'worship' THEN jsonb_build_object(
        'auto_skip_allowed', false,
        'skip_voter_role', 'host_only',
        'reaction_emojis', jsonb_build_array('🙏','❤️','😢','🕊️'),
        'remix_available_post_service', true,
        'ai_prompt_style', 'post_sermon_discussion',
        'vibe_labels', jsonb_build_array('reverent','celebratory','solemn','joyful')
      )
      WHEN 'movie_night' THEN jsonb_build_object(
        'auto_skip_allowed', true,
        'skip_voter_role', 'anyone',
        'reaction_emojis', jsonb_build_array('😂','🔥','💀','🎬'),
        'remix_available_post_service', false,
        'ai_prompt_style', 'movie_trivia'
      )
      WHEN 'study_group' THEN jsonb_build_object(
        'auto_skip_allowed', true,
        'skip_voter_role', 'host_only',
        'reaction_emojis', jsonb_build_array('🙋','📚','✨'),
        'remix_available_post_service', false,
        'ai_prompt_style', 'discussion_questions'
      )
      WHEN 'town_hall' THEN jsonb_build_object(
        'auto_skip_allowed', true,
        'skip_voter_role', 'host_only',
        'reaction_emojis', jsonb_build_array('👍','👎','🗳️'),
        'remix_available_post_service', false,
        'ai_prompt_style', 'q_and_a'
      )
      ELSE jsonb_build_object(
        'auto_skip_allowed', true,
        'skip_voter_role', 'anyone',
        'reaction_emojis', jsonb_build_array('👍','😂','😮','❤️','🔥'),
        'remix_available_post_service', false,
        'ai_prompt_style', 'general'
      )
    END;
  ELSE
    v_settings := p_room_settings;
  END IF;

  LOOP
    v_invite_code := generate_room_invite_code();
    BEGIN
      INSERT INTO sync_rooms (
        created_by, name, vibe, is_public, invite_code,
        room_type, room_settings
      )
      VALUES (
        v_user_id, trim(p_name), p_vibe, COALESCE(p_is_public, true), v_invite_code,
        p_room_type, v_settings
      )
      RETURNING id INTO v_room_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempts := v_attempts + 1;
      IF v_attempts > 5 THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'invite_code_collision_after_5_tries'
        );
      END IF;
    END;
  END LOOP;

  INSERT INTO sync_room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', v_room_id,
    'created_by', v_user_id,
    'is_public', COALESCE(p_is_public, true),
    'invite_code', v_invite_code,
    'room_type', p_room_type,
    'room_settings', v_settings,
    'source', 'create_sync_room_v3'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_sync_room(TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated;


-- ----------------------------------------------------------------------------
-- Step 4: vote_skip v2 -- honors auto_skip_allowed + skip_voter_role
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.vote_skip(UUID);

CREATE OR REPLACE FUNCTION public.vote_skip(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_room RECORD;
  v_member_count INTEGER;
  v_skip_count INTEGER;
  v_threshold INTEGER;
  v_advanced BOOLEAN := false;
  v_advance_result JSONB;
  v_auto_skip BOOLEAN;
  v_voter_role TEXT;
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

  SELECT id, created_by, room_settings INTO v_room
  FROM sync_rooms WHERE id = p_room_id;

  -- room_settings may be {} on a brand-new room created without
  -- presets; defaults match config/sync-room-presets.ts 'general'.
  v_auto_skip  := COALESCE((v_room.room_settings ->> 'auto_skip_allowed')::BOOLEAN, true);
  v_voter_role := COALESCE(v_room.room_settings ->> 'skip_voter_role', 'anyone');

  IF NOT v_auto_skip THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'skip_not_allowed',
      'note', 'This room''s skip vote is disabled (see room_settings.auto_skip_allowed).'
    );
  END IF;

  IF v_voter_role = 'host_only' AND v_user_id <> v_room.created_by THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'skip_host_only'
    );
  END IF;

  INSERT INTO sync_room_votes (room_id, user_id, vote_skip, voted_at)
  VALUES (p_room_id, v_user_id, true, NOW())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET vote_skip = true, voted_at = NOW();

  SELECT COUNT(*) INTO v_member_count
  FROM sync_room_members WHERE room_id = p_room_id;

  SELECT COUNT(*) INTO v_skip_count
  FROM sync_room_votes
  WHERE room_id = p_room_id AND vote_skip = true;

  -- host_only rooms advance the moment the host votes (the host IS
  -- the threshold). For 'anyone' rooms the threshold is ceil(n/2)
  -- as before.
  IF v_voter_role = 'host_only' THEN
    v_threshold := 1;
  ELSE
    v_threshold := GREATEST(1, (v_member_count + 1) / 2);
  END IF;

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
    'voter_role', v_voter_role,
    'advanced', v_advanced,
    'advance_result', v_advance_result,
    'source', 'vote_skip_v2'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.vote_skip(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- Step 5: end_sync_room (host stops the service)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_sync_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_room RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT id, created_by, ended_at INTO v_room
  FROM sync_rooms WHERE id = p_room_id;

  IF v_room.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;

  IF v_room.created_by <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'host_only');
  END IF;

  IF v_room.ended_at IS NOT NULL THEN
    -- Idempotent: a second tap on End just confirms the timestamp.
    RETURN jsonb_build_object(
      'success', true,
      'room_id', p_room_id,
      'ended_at', v_room.ended_at,
      'already_ended', true,
      'source', 'end_sync_room_v1'
    );
  END IF;

  UPDATE sync_rooms
  SET    ended_at = NOW(),
         is_active = false   -- lobby filters is_active; ended rooms drop off
  WHERE  id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'ended_at', NOW(),
    'already_ended', false,
    'source', 'end_sync_room_v1'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.end_sync_room(UUID) TO authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('128', 'syncstream_room_types',
        ARRAY['-- 128: room_type + room_settings + ended_at; v3 create_sync_room; v2 vote_skip; end_sync_room'])
ON CONFLICT (version) DO NOTHING;
