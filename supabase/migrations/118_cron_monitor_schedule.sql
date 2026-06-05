-- ============================================================================
-- Migration 118: hourly schedule for cron-monitor EF
-- ============================================================================
-- Pairs with migration 117 (alerts table) and the cron-monitor EF
-- deployed in this phase. The monitor self-logs into cron_job_logs so
-- it shows up in its own dashboard; the missed-run check inside the
-- EF includes 'cron-monitor' itself with a 60-minute interval, which
-- means a permanent monitor outage will eventually emit a self-alert
-- the next time SOME later monitor run succeeds.
--
-- Schedule: 0 * * * * (top of every hour). Same DO + unschedule
-- pattern as the other 11 jobs from migration 116 so the migration is
-- re-runnable.
-- ============================================================================

DO $$ BEGIN PERFORM cron.unschedule('cron-monitor-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'cron-monitor-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/cron-monitor',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('118', 'cron_monitor_schedule',
        ARRAY['-- 118: hourly cron-monitor schedule'])
ON CONFLICT (version) DO NOTHING;
