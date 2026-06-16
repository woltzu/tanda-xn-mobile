-- ════════════════════════════════════════════════════════════════════════════
-- Migration 182: push_notification_columns
-- ════════════════════════════════════════════════════════════════════════════
-- Two additions so the three push-dispatcher Edge Functions
-- (transfer-notification, goal-notification, kyc-approval-notification)
-- can stop running in stub mode:
--
-- 1. profiles.expo_push_token TEXT — the most recent Expo push token
--    the user's device produced. Written by NotificationContext on app
--    start after the user grants notification permissions, read by the
--    Edge Functions when dispatching.
--
-- 2. notifications.push_sent_at TIMESTAMPTZ — the idempotency cursor.
--    Set by the EF after a successful Expo POST so a single
--    notification row isn't pushed twice. The sweep queries filter to
--    push_sent_at IS NULL.
--
-- The existing `public.push_tokens` table + `register_push_token` RPC
-- (multi-device history) keep working unchanged — they live alongside
-- this column. The column is the cheap-read denormalisation the EFs
-- need.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles.expo_push_token ────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

COMMENT ON COLUMN public.profiles.expo_push_token IS
  'Most recent Expo push token for this user''s device. Written by '
  'NotificationContext on app start after the user grants permissions; '
  'read by the three push-dispatcher Edge Functions. The fuller '
  'multi-device history lives in public.push_tokens.';

-- ─── 2. notifications.push_sent_at ──────────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.notifications.push_sent_at IS
  'Set by the dispatch Edge Functions after a successful POST to the '
  'Expo Push API. The sweep queries skip rows where this is not null '
  'so a single notification row isn''t pushed twice.';

-- Partial index — only rows still awaiting dispatch are indexed. The
-- table is dominated by long-tail read rows; this stays tiny and
-- speeds up the EF sweep significantly.
CREATE INDEX IF NOT EXISTS notifications_push_unsent_idx
  ON public.notifications (created_at)
 WHERE push_sent_at IS NULL;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '182',
  'push_notification_columns',
  ARRAY['-- 182: push_notification_columns']
)
ON CONFLICT (version) DO NOTHING;
