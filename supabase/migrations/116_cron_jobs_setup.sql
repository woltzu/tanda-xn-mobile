-- ============================================================================
-- Migration 116: schedule remaining required cron jobs
-- ============================================================================
-- Step 2 of production hardening. Diff'ed cron.job against the
-- 14-job expected list:
--   already scheduled (3): scoring-pipeline-daily,
--                          weekly-model-performance-check,
--                          monthly-cohort-analysis
--   scheduled here (11):   insurance-pool-rate-weekly,
--                          login-drop-collection-daily,
--                          advance-signal-collection-daily,
--                          stress-signal-collection-daily,
--                          stress-scoring-daily,
--                          mood-bridge-daily,
--                          mood-scoring-weekly,
--                          substitute-lifecycle-hourly,
--                          partial-contribution-lifecycle-daily,
--                          data-quality-weekly,
--                          webhook-retry-processor
--
-- Pattern: each job is wrapped in a DO block that calls cron.unschedule
-- inside BEGIN..EXCEPTION (so re-running the migration is safe even when
-- the job wasn't previously scheduled), then cron.schedule with the
-- standard net.http_post(...) command using the service-role key from
-- app.settings.service_role_key. Same idiom as the existing scheduled
-- jobs in cron.job (e.g. scoring-pipeline-daily, daily-interest-accrual).
--
-- Schedule overlaps to be aware of (these are intentional, the prompt
-- spec puts them at the same minute; pg_cron runs each in its own
-- session and the work is read-mostly for that minute):
--   * 02:00 UTC daily: cleanup-expired-reservations (existing) +
--     stress-signal-collection-daily (new) + partial-contribution-
--     lifecycle-daily (new)
--   * 04:00 UTC daily: login-drop-collection-daily (new) +
--     stress-scoring-daily (new) + process-deletions (existing)
--   * 04:30 UTC Sundays: insurance-pool-rate-weekly (new) +
--     mood-scoring-weekly (new)
-- If load becomes an issue we can stagger by a few minutes in a
-- follow-up; for MVP they coexist fine.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. insurance-pool-rate-weekly  (Sun 04:30 UTC)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('insurance-pool-rate-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'insurance-pool-rate-weekly',
  '30 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/insurance-pool-rate-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 2. login-drop-collection-daily  (04:00 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('login-drop-collection-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'login-drop-collection-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/login-drop-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 3. advance-signal-collection-daily  (03:45 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('advance-signal-collection-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'advance-signal-collection-daily',
  '45 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/advance-signal-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 4. stress-signal-collection-daily  (02:00 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('stress-signal-collection-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'stress-signal-collection-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/stress-signal-collection-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 5. stress-scoring-daily  (04:00 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('stress-scoring-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'stress-scoring-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/stress-scoring-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 6. mood-bridge-daily  (01:30 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('mood-bridge-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'mood-bridge-daily',
  '30 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/mood-bridge-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 7. mood-scoring-weekly  (Sun 04:30 UTC)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('mood-scoring-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'mood-scoring-weekly',
  '30 4 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/mood-scoring-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 8. substitute-lifecycle-hourly  (every hour at :00)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('substitute-lifecycle-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'substitute-lifecycle-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/substitute-lifecycle-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 9. partial-contribution-lifecycle-daily  (02:00 UTC daily)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('partial-contribution-lifecycle-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'partial-contribution-lifecycle-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/partial-contribution-lifecycle-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 10. data-quality-weekly  (Mon 05:00 UTC)
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('data-quality-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'data-quality-weekly',
  '0 5 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/data-quality-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- ----------------------------------------------------------------------------
-- 11. webhook-retry-processor  (every 5 minutes)
-- ----------------------------------------------------------------------------
-- High-frequency cron, intentionally aggressive: the partner-API
-- webhook delivery model has 5 backoff steps (30s, 2m, 8m, 32m, 2h)
-- and the processor needs to fire often enough that the 30s and 2m
-- buckets actually get attempted promptly.
DO $$ BEGIN PERFORM cron.unschedule('webhook-retry-processor');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'webhook-retry-processor',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/webhook-retry-processor',
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
VALUES ('116', 'cron_jobs_setup',
        ARRAY['-- 116: schedule 11 missing cron jobs (Step 2 of prod hardening)'])
ON CONFLICT (version) DO NOTHING;
