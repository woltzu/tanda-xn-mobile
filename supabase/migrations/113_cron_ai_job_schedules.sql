-- ============================================================================
-- Migration 113: CronAIJobEngine #191 -- pg_cron schedules for the two
-- net-new AI jobs (model perf check + cohort analysis).
-- ============================================================================
-- CronAIJobEngine.ts describes 6 jobs but only #4 and #6 are genuinely
-- missing in prod. The other four overlap with scoring-pipeline-daily
-- which already runs at 0 3 * * * and covers default-risk scoring,
-- circle-health recompute, and XnScore recalc. Adding duplicates would
-- waste DB time and risk drift between two recompute paths.
--
-- Net-new jobs scheduled here:
--   weekly-model-performance-check
--     0 5 * * 0   Sundays at 05:00 UTC. Evaluates predictions made ~30
--                 days ago against actual missed-contribution outcomes.
--                 Writes to model_performance_logs and -- on moderate or
--                 severe drift -- emits a model_drift score_alerts row.
--                 (Sunday 03:00 has aml-monitoring-weekly, Sunday 02:00
--                 has sanctions-screening-weekly; 05:00 gives them room.)
--
--   monthly-cohort-analysis
--     0 6 2 * *   2nd of each month at 06:00 UTC. Computes cohort metrics
--                 for join_date (quarter), geography (country), and
--                 referral_source. Upserts into cohort_analytics with the
--                 prior calendar month as period_start/end.
--                 (Day 1 06:00 is reserved for the future
--                 monthly-xnscore-full-recalibration if we ever activate
--                 #5; day 2 keeps cohort analysis on a stable day boundary
--                 even if the prior job runs long.)
--
-- Both EFs always write a cron_job_logs row (success/partial/failed)
-- so AIJobsHealthScreen can render a uniform history across all crons.
-- Both calls go through net.http_post and use the standard service-role
-- header pattern from app.settings.service_role_key (same as every other
-- EF-backed cron in this project).
--
-- Schedule pairs are wrapped in DO blocks with cron.unschedule on the
-- prior jobname so re-running the migration cleanly replaces existing
-- schedules instead of erroring out.
-- ============================================================================


-- Replace any prior schedule so the migration is re-runnable.
DO $$
BEGIN
  PERFORM cron.unschedule('weekly-model-performance-check');
EXCEPTION WHEN OTHERS THEN
  -- Not previously scheduled; ignore.
  NULL;
END $$;

SELECT cron.schedule(
  'weekly-model-performance-check',
  '0 5 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/weekly-model-performance-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


DO $$
BEGIN
  PERFORM cron.unschedule('monthly-cohort-analysis');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'monthly-cohort-analysis',
  '0 6 2 * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/monthly-cohort-analysis',
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
VALUES ('113', 'cron_ai_job_schedules',
        ARRAY['-- 113: CronAIJob #4 + #6 pg_cron schedules'])
ON CONFLICT (version) DO NOTHING;
