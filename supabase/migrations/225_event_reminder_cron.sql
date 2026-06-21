-- ════════════════════════════════════════════════════════════════════════════
-- Migration 225: event_reminder_cron
-- ════════════════════════════════════════════════════════════════════════════
-- Schedules the `event-reminder` Edge Function (deployed separately via
-- `supabase functions deploy event-reminder --no-verify-jwt`) to run daily
-- at 09:00 UTC. The EF scans `community_events` for tomorrow's events and
-- queues `event_reminder_24h` notifications for the creator + every active
-- member of the communities the creator belongs to.
--
-- Mirrors the payout_reminder_cron migration (189). Two-step pattern:
--   1. Drop any pre-existing job with this name so the migration is
--      re-runnable.
--   2. Schedule the job using cron.schedule(). The command body is a
--      single SQL statement that net.http_post()'s the EF URL.
--
-- Requirements: pg_cron + pg_net + project vault populated with
-- `project_url` and `service_role_key` secrets (already done for 189's
-- payout-reminder; this migration reuses them).
-- ════════════════════════════════════════════════════════════════════════════

SELECT cron.unschedule('event_reminder_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'event_reminder_daily'
 );

SELECT cron.schedule(
  'event_reminder_daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/event-reminder',
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
  '225',
  'event_reminder_cron',
  ARRAY['-- 225: event_reminder_cron']
)
ON CONFLICT (version) DO NOTHING;
