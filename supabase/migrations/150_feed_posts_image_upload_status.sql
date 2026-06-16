-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 150: feed_posts.image_upload_status
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Adds an `image_upload_status` lifecycle marker to feed_posts so the
-- Dream Feed client can render an optimistic UI:
--
--   - 'completed' (DEFAULT) — the row has no image to upload, or the
--                              flyer has already been attached. This is
--                              also the value backfilled onto all rows
--                              that existed before this migration so the
--                              client doesn't paint a "Retry upload"
--                              affordance on historical posts.
--   - 'pending'             — the row was inserted optimistically and a
--                              background image upload is in flight.
--   - 'failed'              — the background upload errored. The client
--                              surfaces a "Retry upload" button on
--                              FeedPostCard so the author can try again.
--
-- CHECK constraint locks the value set. Partial index on (pending|failed)
-- supports the future "stuck-upload" cron without a full-table scan.

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS image_upload_status TEXT NOT NULL DEFAULT 'completed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feed_posts_image_upload_status_check'
  ) THEN
    ALTER TABLE public.feed_posts
      ADD CONSTRAINT feed_posts_image_upload_status_check
      CHECK (image_upload_status IN ('pending', 'completed', 'failed'));
  END IF;
END $$;

-- Partial index — most rows are 'completed' and we never filter by that;
-- the interesting reads are "upload still in flight" and "upload broken,
-- needs the user's attention," which are tiny slices.
CREATE INDEX IF NOT EXISTS feed_posts_image_upload_status_partial_idx
  ON public.feed_posts (image_upload_status)
  WHERE image_upload_status IN ('pending', 'failed');

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '150',
  'feed_posts_image_upload_status',
  ARRAY['-- 150: feed_posts_image_upload_status']
)
ON CONFLICT (version) DO NOTHING;
