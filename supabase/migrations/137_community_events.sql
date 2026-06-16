-- =============================================================================
-- 137: community_events
-- =============================================================================
-- Community-posted events surfaced inside the Community tab's EventsScreen.
-- Any authenticated user can create an event; events are publicly readable
-- (so logged-out share targets work). Owners can edit/delete their own.
--
-- Storage bucket `event-flyers` is public-read. Uploads are scoped to
-- `{user_id}/...` so the INSERT RLS policy can verify ownership without
-- trusting client-supplied paths.
-- =============================================================================

CREATE TABLE IF NOT EXISTS community_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  event_datetime     TIMESTAMPTZ NOT NULL,
  location_name      TEXT NOT NULL,
  full_address       TEXT NOT NULL,
  price              NUMERIC,
  price_description  TEXT,
  description        TEXT NOT NULL,
  image_url          TEXT,
  contact_info       JSONB,
  age_range          TEXT,
  prizes             TEXT,
  presented_by       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for the upcoming-events query (the only hot path: ORDER BY event_datetime ASC WHERE event_datetime >= now()).
CREATE INDEX IF NOT EXISTS community_events_datetime_idx
  ON community_events (event_datetime);

-- Index for "my events" queries on profile screens.
CREATE INDEX IF NOT EXISTS community_events_user_id_idx
  ON community_events (user_id);

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

ALTER TABLE community_events ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone (anon + authenticated) can view all events.
DROP POLICY IF EXISTS "community_events_select_all" ON community_events;
CREATE POLICY "community_events_select_all"
  ON community_events
  FOR SELECT
  USING (true);

-- INSERT: authenticated users can create events as themselves.
DROP POLICY IF EXISTS "community_events_insert_own" ON community_events;
CREATE POLICY "community_events_insert_own"
  ON community_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: only the creator can update.
DROP POLICY IF EXISTS "community_events_update_own" ON community_events;
CREATE POLICY "community_events_update_own"
  ON community_events
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: only the creator can delete.
DROP POLICY IF EXISTS "community_events_delete_own" ON community_events;
CREATE POLICY "community_events_delete_own"
  ON community_events
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- STORAGE BUCKET: event-flyers (public-read)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-flyers',
  'event-flyers',
  TRUE,
  10485760, -- 10 MB cap per flyer
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS — path convention: {user_id}/{filename}
-- (foldername[1] = user_id is enforced server-side)

-- INSERT: authenticated user can upload to their own user_id folder.
DROP POLICY IF EXISTS "event_flyers_insert_own_folder" ON storage.objects;
CREATE POLICY "event_flyers_insert_own_folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-flyers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: anyone can read (bucket is public).
DROP POLICY IF EXISTS "event_flyers_select_all" ON storage.objects;
CREATE POLICY "event_flyers_select_all"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'event-flyers');

-- UPDATE / DELETE: only the uploader.
DROP POLICY IF EXISTS "event_flyers_update_own" ON storage.objects;
CREATE POLICY "event_flyers_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-flyers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "event_flyers_delete_own" ON storage.objects;
CREATE POLICY "event_flyers_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-flyers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '137',
  'community_events',
  ARRAY['-- 137: community_events']
)
ON CONFLICT (version) DO NOTHING;
