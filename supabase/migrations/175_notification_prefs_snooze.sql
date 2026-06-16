-- 175_notification_prefs_snooze.sql
-- =====================================================================
-- P1 of the Notification preferences review.
--
-- push_snooze_until TIMESTAMPTZ NULL
--   When set to a future timestamp, the server-side dispatcher skips
--   push delivery for this user until the timestamp passes. The
--   "Pause all for 24h" chip writes now()+24h here; the client
--   updates the countdown live and the same column drives any
--   future cron-snoozes (low-battery suppression, etc.).
--
-- Partial index — only configs with an active snooze are indexed, so
-- the dispatcher's "is this user snoozed right now?" check is O(1)
-- and the index stays tiny.
-- =====================================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_snooze_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notification_prefs_active_snooze
  ON public.notification_preferences (user_id)
  WHERE push_snooze_until IS NOT NULL;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '175',
  'notification_prefs_snooze',
  ARRAY['-- 175: notification_prefs_snooze']
)
ON CONFLICT (version) DO NOTHING;
