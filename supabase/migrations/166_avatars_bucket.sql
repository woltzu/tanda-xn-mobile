-- ============================================================================
-- Migration 166: avatars Storage bucket + owner-only RLS
-- ============================================================================
-- Backing storage for the AvatarPicker component (P1 of the profile
-- view/edit review). The picker uploads at the canonical path
-- "<user_id>.jpg" (upsert) and writes the bucket-resolved URL back to
-- profiles.avatar_url, so:
--
--   • Bucket is PRIVATE — clients must use a signed URL or rely on
--     authenticated owner-read via these RLS policies. We don't want
--     anonymous fan-out of user faces.
--
--   • RLS is owner-keyed. storage.objects.owner is set automatically
--     to auth.uid() on INSERT, so filtering by `owner = auth.uid()`
--     gives us per-user isolation without parsing the file path. A
--     malicious client cannot read another user's avatar even if they
--     guess the path.
--
--   • One file per user. Upsert collapses repeated uploads to a single
--     storage row; no per-user accumulation of dead images. The
--     consumer is responsible for cache-busting via a query string
--     when displaying the result.
-- ============================================================================

-- 1. Bucket. Idempotent via ON CONFLICT so re-applying the migration
-- in a non-prod env doesn't error.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;


-- 2. RLS policies on storage.objects for the avatars bucket. Drop +
-- recreate so re-applying picks up any wording changes.
DROP POLICY IF EXISTS "avatars_owner_select" ON storage.objects;
CREATE POLICY "avatars_owner_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND owner = auth.uid());

-- Service-role writes bypass RLS (Supabase default) so worker / admin
-- cleanups are unaffected.


-- 3. Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '166',
  'avatars_bucket',
  ARRAY['-- 166: avatars Storage bucket + owner-only RLS']
)
ON CONFLICT (version) DO NOTHING;
