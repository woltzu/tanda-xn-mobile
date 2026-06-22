-- ════════════════════════════════════════════════════════════════════════════
-- Migration 232: gathering_reminder_cron
-- Host-a-gathering Bucket C
-- ════════════════════════════════════════════════════════════════════════════
-- Schedules the `gathering-reminder` Edge Function (deployed separately via
-- `supabase functions deploy gathering-reminder --no-verify-jwt`) to run daily
-- at 09:30 UTC. The EF scans community_gatherings for upcoming gatherings
-- whose starts_at lands in the T-24h window and queues
-- `gathering_reminder_24h` notifications for the organizer + every active
-- RSVP'd member.
--
-- 09:30 UTC offset from event-reminder (09:00 UTC, migration 225) so the two
-- crons don't slam the EF host concurrently. The ±1h tolerance band in the
-- EF window handles the half-hour skew.
--
-- Idempotency happens inside the EF itself (notifications table check on
-- `(user_id, type, data->>gathering_id)`) — same shape as event-reminder.
-- No separate `gathering_reminder_sent` table is needed; the dedup we get
-- from a single source of truth (`notifications`) is the same the rest of
-- the notification family uses, and avoids a second table getting out of
-- sync after manual deletions or DSR purges.
--
-- Requirements: pg_cron + pg_net + project vault populated with
-- `project_url` and `service_role_key` secrets (already done for migrations
-- 189 / 225; this migration reuses them).
-- ════════════════════════════════════════════════════════════════════════════

SELECT cron.unschedule('gathering_reminder_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'gathering_reminder_daily'
 );

SELECT cron.schedule(
  'gathering_reminder_daily',
  '30 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/gathering-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '232',
  'gathering_reminder_cron',
  ARRAY['-- 232: gathering_reminder_cron']
)
ON CONFLICT (version) DO NOTHING;
