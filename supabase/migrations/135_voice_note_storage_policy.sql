-- =============================================================================
-- 135: voice_note_storage_policy
-- =============================================================================
-- Phase R4b: voice notes for SyncStream remix. R4a created the
-- sync_room_remixes table (sticker path only) and the sync-remix bucket
-- (non-public, no object policies yet). This migration:
--
--   1. Adds duration_seconds INTEGER to sync_room_remixes for voice/video.
--   2. Adds storage.objects RLS policies on the sync-remix bucket:
--      - INSERT: authenticated user can write to {roomId}/{userId}/* iff
--                they are a member of {roomId}.
--      - SELECT: authenticated user can read {roomId}/* iff they are a
--                member of {roomId}. Required for createSignedUrl to
--                succeed for room peers (signed URLs require SELECT
--                permission on the object row to generate).
--   3. Extends delete_expired_remixes() to also purge orphan storage
--      objects in the sync-remix bucket older than 24 hours -- catches
--      uploads that succeeded but whose DB-row insert failed, plus the
--      normal retention sweep.
--
-- Path convention: {roomId}/{userId}/{timestamp}.{ext}
--   foldername[1] = roomId   (used for room membership check)
--   foldername[2] = userId   (used for ownership check on INSERT)
-- This shape:
--   - Lets the INSERT policy enforce ownership without trusting the
--     client to send a particular path.
--   - Lets the SELECT policy enforce membership without joining
--     sync_room_remixes (so signed-URL generation is one hop).
--   - Lets retention prune by-room or by-user with one LIKE filter.
-- =============================================================================

ALTER TABLE public.sync_room_remixes
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- INSERT policy: client-uploaded object must live under
-- {roomId}/{userId}/, where the user IS the auth.uid() and IS a
-- member of the room.
DROP POLICY IF EXISTS sync_remix_objects_insert ON storage.objects;
CREATE POLICY sync_remix_objects_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sync-remix'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.sync_room_members m
      WHERE m.room_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
    )
  );

-- SELECT policy: any authenticated room member can read any object
-- under {roomId}/*. Required so the receiving client can call
-- createSignedUrl(media_url, 3600) and have it return a URL.
DROP POLICY IF EXISTS sync_remix_objects_select ON storage.objects;
CREATE POLICY sync_remix_objects_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sync-remix'
    AND EXISTS (
      SELECT 1 FROM public.sync_room_members m
      WHERE m.room_id::text = (storage.foldername(name))[1]
        AND m.user_id = auth.uid()
    )
  );

-- Retention: extend the existing function to also drop orphan storage
-- objects. Same 24h window. SECURITY DEFINER + search_path still
-- pinned. Storage cleanup runs after the table cleanup so deleted-row
-- objects are caught in the same sweep.
CREATE OR REPLACE FUNCTION public.delete_expired_remixes()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.sync_room_remixes
   WHERE created_at < NOW() - INTERVAL '24 hours';
  DELETE FROM storage.objects
   WHERE bucket_id = 'sync-remix'
     AND created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '135',
  'voice_note_storage_policy',
  ARRAY['-- 135: voice_note_storage_policy']
)
ON CONFLICT (version) DO NOTHING;
