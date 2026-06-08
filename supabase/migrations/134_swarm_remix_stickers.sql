-- =============================================================================
-- 134: swarm_remix_stickers
-- =============================================================================
-- Phase R4a foundation: the sync_room_remixes table + RLS for the SyncStream
-- "Swarm remix" feature. R4a delivers the sticker path only -- voice notes
-- (R4b) and video replies (R4c) follow. The table's media_type CHECK already
-- allows all three values so the later phases don't need an enum migration.
--
-- Insert path is direct (no broadcast_remix RPC): RLS enforces
-- "user_id = auth.uid() AND room membership" on every insert, so a client
-- cannot impersonate or post into a room they haven't joined. SELECT is
-- gated by the same membership check, matching the sync_room_reactions
-- model.
--
-- Also creates the `sync-remix` storage bucket (non-public -- signed URLs
-- only) ready for R4b/R4c. No storage.objects RLS yet; that lands with R4b
-- when the bucket starts receiving uploads.
--
-- Retention: rows older than 24 hours are purged nightly at 03:00 UTC. The
-- same window will apply to future storage objects; their cleanup is wired
-- in R4b alongside the upload path. Picked 24h because remix is meant to
-- be ephemeral -- meme-like, room-bound, not durable content.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sync_room_remixes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  media_type  TEXT NOT NULL CHECK (media_type IN ('sticker', 'voice_note', 'video_reply')),
  media_url   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_room_remixes_room_idx
  ON public.sync_room_remixes (room_id, created_at DESC);

-- Realtime publication. Idempotent guard so re-applying the migration is
-- safe even after the publication has the table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sync_room_remixes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_remixes;
  END IF;
END $$;

ALTER TABLE public.sync_room_remixes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remixes_select ON public.sync_room_remixes;
CREATE POLICY remixes_select ON public.sync_room_remixes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sync_room_members
      WHERE room_id = sync_room_remixes.room_id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS remixes_insert ON public.sync_room_remixes;
CREATE POLICY remixes_insert ON public.sync_room_remixes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.sync_room_members
      WHERE room_id = sync_room_remixes.room_id
        AND user_id = auth.uid()
    )
  );

-- Storage bucket -- non-public, ready for R4b/R4c uploads. No object RLS
-- policies yet; they land in R4b alongside the upload path. Stickers do
-- not use storage so this bucket is effectively unused in R4a.
INSERT INTO storage.buckets (id, name, public)
VALUES ('sync-remix', 'sync-remix', false)
ON CONFLICT (id) DO NOTHING;

-- Retention worker. search_path pinned so a future schema-shadow attack
-- (Tier 4 hardening backlog) cannot redirect this SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.delete_expired_remixes()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.sync_room_remixes
   WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Cron schedule. pg_cron.schedule() errors on duplicate jobname so we
-- guard by unscheduling first if it already exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-expired-remixes-daily') THEN
    PERFORM cron.unschedule('delete-expired-remixes-daily');
  END IF;
  PERFORM cron.schedule(
    'delete-expired-remixes-daily',
    '0 3 * * *',
    'SELECT public.delete_expired_remixes();'
  );
END $$;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '134',
  'swarm_remix_stickers',
  ARRAY['-- 134: swarm_remix_stickers']
)
ON CONFLICT (version) DO NOTHING;
