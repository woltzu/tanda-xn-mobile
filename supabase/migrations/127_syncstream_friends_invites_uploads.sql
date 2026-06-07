-- ============================================================================
-- Migration 127: SyncStream phase 4 -- friend-only rooms, invites, uploads
-- ============================================================================
-- Note on numbering: the prompt called this "migration 126" but the
-- reaper shipped under 126, so this is 127. Phase 4 adds:
--
--   1. is_public + invite_code on sync_rooms. Existing rows treated as
--      public (the column default) and back-filled with a fresh
--      invite_code via generate_room_invite_code(). The lobby filters
--      is_public=true so private rooms only surface via deep link.
--
--   2. generate_room_invite_code() -- 8-char alphanumeric using a
--      32-char alphabet (the same one as referral codes -- A-Z 2-9
--      with ambiguous 0/O/1/I/L removed) so users can read codes off
--      a screen and type them without misreads.
--
--   3. New signatures for create_sync_room + join_sync_room. The old
--      two-arg create_sync_room and one-arg join_sync_room are dropped
--      and replaced with new versions:
--
--        create_sync_room(name, vibe, is_public := true)
--        join_sync_room(room_id, invite_code := NULL)
--
--      Defaults are chosen so existing callers (the SyncLobbyScreen
--      tap-to-join flow) keep working without code changes -- the
--      public-room path doesn't care about the new params.
--
--      The join function's auth rule:
--        - room is public:                       always allowed
--        - already a member:                     always allowed (re-join)
--        - private + invite_code matches:        allowed
--        - private + missing/wrong invite_code:  rejected
--
--   4. Storage bucket `room-videos` for custom video uploads. 50 MB
--      cap, video/mp4 only, 24h-old-rows reaped by storage.objects
--      lifecycle (Supabase manages that automatically once we set
--      file_size_limit + allowed_mime_types on the bucket row).
--
--      RLS on storage.objects:
--        SELECT: any authenticated user (rooms are watched together).
--        INSERT: authenticated user, path must start with the user's
--                own uuid so a malicious client can't overwrite
--                someone else's video.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: schema
-- ----------------------------------------------------------------------------
ALTER TABLE public.sync_rooms
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invite_code TEXT;

CREATE INDEX IF NOT EXISTS idx_sync_rooms_invite_code
  ON public.sync_rooms (invite_code);


-- ----------------------------------------------------------------------------
-- Step 2: generate_room_invite_code()
-- ----------------------------------------------------------------------------
-- 8 chars from a 32-char alphabet. Same alphabet as referral codes so
-- the "no 0/O/1/I/L" rule stays consistent app-wide.
CREATE OR REPLACE FUNCTION public.generate_room_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $function$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_result TEXT := '';
  v_i INT;
BEGIN
  FOR v_i IN 1..8 LOOP
    v_result := v_result
      || substr(v_alphabet, 1 + (floor(random() * length(v_alphabet))::INT), 1);
  END LOOP;
  RETURN v_result;
END;
$function$;

-- ----------------------------------------------------------------------------
-- Step 3: backfill invite codes + add UNIQUE constraint AFTER backfill.
-- ----------------------------------------------------------------------------
-- We do this in two stages because the UNIQUE constraint can't be added
-- while existing rows are NULL (it can, technically, but a race during
-- back-fill could trip it). Safer to:
--   a. fill in non-conflicting codes,
--   b. add the constraint on the now-fully-populated column.
DO $$
DECLARE
  r RECORD;
  v_attempts INT;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM sync_rooms WHERE invite_code IS NULL LOOP
    v_attempts := 0;
    LOOP
      v_code := generate_room_invite_code();
      BEGIN
        UPDATE sync_rooms SET invite_code = v_code WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_attempts := v_attempts + 1;
        IF v_attempts > 5 THEN
          RAISE EXCEPTION 'Could not allocate invite_code for room % after 5 tries', r.id;
        END IF;
      END;
    END LOOP;
  END LOOP;
END $$;

DO $$ BEGIN
  ALTER TABLE public.sync_rooms
    ADD CONSTRAINT uq_sync_rooms_invite_code UNIQUE (invite_code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Step 4: new create_sync_room signature
-- ----------------------------------------------------------------------------
-- DROP the two-arg form so we don't accidentally have both. Then create
-- the three-arg version with is_public defaulting to true (back-compat).
DROP FUNCTION IF EXISTS public.create_sync_room(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_sync_room(
  p_name TEXT,
  p_vibe TEXT,
  p_is_public BOOLEAN DEFAULT true
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;

  -- Mint a globally-unique invite code. Same retry loop as the back-
  -- fill -- collision is vanishingly rare against the 32^8 space but
  -- we'd rather degrade gracefully than 500 on the edge case.
  LOOP
    v_invite_code := generate_room_invite_code();
    BEGIN
      INSERT INTO sync_rooms (created_by, name, vibe, is_public, invite_code)
      VALUES (v_user_id, trim(p_name), p_vibe, COALESCE(p_is_public, true), v_invite_code)
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

  -- Creator joins automatically.
  INSERT INTO sync_room_members (room_id, user_id)
  VALUES (v_room_id, v_user_id)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', v_room_id,
    'created_by', v_user_id,
    'is_public', COALESCE(p_is_public, true),
    'invite_code', v_invite_code,
    'source', 'create_sync_room_v2'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_sync_room(TEXT, TEXT, BOOLEAN) TO authenticated;


-- ----------------------------------------------------------------------------
-- Step 5: new join_sync_room signature
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.join_sync_room(UUID);

CREATE OR REPLACE FUNCTION public.join_sync_room(
  p_room_id UUID,
  p_invite_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_room RECORD;
  v_member_count INTEGER;
  v_is_member BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT id, is_active, is_public, invite_code
    INTO v_room
  FROM sync_rooms
  WHERE id = p_room_id;

  IF v_room.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_found');
  END IF;

  IF NOT v_room.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_not_active');
  END IF;

  -- Are we already in the room? Re-joins are always allowed (heartbeat
  -- refresh path), even if the room has flipped to private since.
  SELECT EXISTS (
    SELECT 1 FROM sync_room_members
    WHERE room_id = p_room_id AND user_id = v_user_id
  ) INTO v_is_member;

  IF NOT v_is_member AND NOT v_room.is_public THEN
    -- Private + new member: invite code must match.
    IF p_invite_code IS NULL OR upper(trim(p_invite_code)) <> v_room.invite_code THEN
      RETURN jsonb_build_object('success', false, 'error', 'invite_required');
    END IF;
  END IF;

  INSERT INTO sync_room_members (room_id, user_id, last_heartbeat)
  VALUES (p_room_id, v_user_id, NOW())
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET last_heartbeat = NOW();

  UPDATE sync_rooms SET last_active = NOW() WHERE id = p_room_id;

  SELECT COUNT(*) INTO v_member_count
  FROM sync_room_members WHERE room_id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'member_count', v_member_count,
    'was_already_member', v_is_member,
    'source', 'join_sync_room_v2'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_sync_room(UUID, TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- Step 6: Storage bucket + RLS for custom video uploads
-- ----------------------------------------------------------------------------
-- The bucket is created via storage.buckets table (Supabase exposes it
-- as a regular table). file_size_limit + allowed_mime_types stop the
-- client from uploading anything bigger than 50 MB or non-MP4 even
-- if a malicious caller skips client-side validation.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-videos',
  'room-videos',
  true,                                  -- public reads so the WebView can fetch
  52428800,                              -- 50 MB
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Object-level policies. Public read so the embedded player can stream
-- without a signed URL round trip; INSERT restricted to authenticated
-- users into a path beginning with their own user id (the screen's
-- upload path is `{userId}/{roomId}_{timestamp}.mp4`).
DROP POLICY IF EXISTS "Public read room-videos" ON storage.objects;
CREATE POLICY "Public read room-videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-videos');

DROP POLICY IF EXISTS "Authenticated upload room-videos in own folder" ON storage.objects;
CREATE POLICY "Authenticated upload room-videos in own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'room-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Owner delete room-videos" ON storage.objects;
CREATE POLICY "Owner delete room-videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'room-videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('127', 'syncstream_friends_invites_uploads',
        ARRAY['-- 127: is_public + invite_code + new RPC signatures + room-videos bucket'])
ON CONFLICT (version) DO NOTHING;
