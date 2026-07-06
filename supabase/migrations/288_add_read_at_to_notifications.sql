-- ═══════════════════════════════════════════════════════════════════════════
-- 288_add_read_at_to_notifications.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The `mark_notification_read` and `mark_all_notifications_read` RPCs
-- were shipped assuming `read_at` and `updated_at` existed on
-- `notifications`; both columns were never actually added. Every call to
-- either RPC now fails at the UPDATE with
--   ERROR: 42703 column "read_at" of relation "notifications" does not exist
-- and the RPC returns FALSE / 0 rows. The client keeps its optimistic
-- flip so the inbox looks right in-session, but the row on disk still
-- has read = FALSE — every reload re-shows the same notifications as
-- unread and the log fills with the same 42703 error.
--
-- Add both columns and an index on (user_id, read_at DESC) that the
-- inbox's "recently-read" sort will use as soon as the client reads it.
-- IF NOT EXISTS on the columns keeps the migration idempotent — if it
-- gets re-applied for any reason, the second run is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS read_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: any row already marked read but with a NULL read_at gets
-- created_at as a best-effort stamp. Better than leaving NULL — a
-- future "sort by recently read" query would drop those rows.
UPDATE public.notifications
SET read_at = created_at
WHERE read = TRUE AND read_at IS NULL;

-- Same idea for updated_at — never NULL after this.
UPDATE public.notifications
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Index for the inbox's read/unread partition. Partial on read = TRUE
-- keeps it small (unread queue has its own separate index elsewhere).
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at
  ON public.notifications (user_id, read_at DESC)
  WHERE read = TRUE;

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '288',
  'add_read_at_to_notifications',
  ARRAY['-- 288: add_read_at_to_notifications']
)
ON CONFLICT (version) DO NOTHING;
