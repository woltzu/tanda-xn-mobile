-- ════════════════════════════════════════════════════════════════════════════
-- Migration 189: payout_reminder_cron
-- ════════════════════════════════════════════════════════════════════════════
-- Schedules the `payout-reminder` Edge Function (deployed separately via
-- `supabase functions deploy payout-reminder --no-verify-jwt`) to run daily
-- at 09:00 UTC. The EF scans `circle_cycles` for tomorrow's expected
-- payouts and inserts `payout_reminder` notifications.
--
-- Two-step pattern, mirroring the cron rituals used by other notification
-- crons (181's check_goal_deadlines, ai-weekly-digest, etc.):
--   1. Drop any pre-existing job with this name so the migration is
--      re-runnable.
--   2. Schedule the job using cron.schedule(). The command body is a
--      single SQL statement that net.http_post()'s the EF URL.
--
-- Requirements: pg_cron + pg_net extensions enabled on the project.
-- Both are enabled by default on Supabase paid tiers. If a project is
-- self-hosted without them, fall back to the Supabase Schedule UI
-- (Database → Schedule, daily at 09:00 UTC, function payout-reminder).
--
-- Alternative ungated path: Supabase Schedule UI — set the schedule
-- there and skip this migration. The EF body is identical either way.
--
-- The PROJECT_URL and SERVICE_ROLE_KEY substitutions are application
-- vault settings (`vault.create_secret` / `vault.decrypted_secrets`)
-- so the literals never appear in the migration file. If the
-- project's vault isn't populated yet, the cron.schedule() call will
-- still succeed but the EF call will fail at runtime — the user gets
-- a clear "missing secret" error in the cron_job_log table.
-- ════════════════════════════════════════════════════════════════════════════

-- Drop any existing schedule with this name so re-applies are safe.
SELECT cron.unschedule('payout_reminder_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'payout_reminder_daily'
 );

-- Schedule the EF call at 09:00 UTC daily. The EF resolves "tomorrow"
-- itself; this migration only needs to fire the HTTP call.
SELECT cron.schedule(
  'payout_reminder_daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/payout-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '189',
  'payout_reminder_cron',
  ARRAY['-- 189: payout_reminder_cron']
)
ON CONFLICT (version) DO NOTHING;
