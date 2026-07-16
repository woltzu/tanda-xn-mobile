-- ════════════════════════════════════════════════════════════════════════════
-- Migration 348: community_notification_cron
-- ════════════════════════════════════════════════════════════════════════════
-- Schedules the `community-notification` Edge Function (deployed separately
-- via `supabase functions deploy community-notification --no-verify-jwt`) to
-- run every 5 minutes. The EF sweeps unpushed rows on public.notifications
-- WHERE type IN the six community types added by mig 231 / 221 / 347 and
-- push_sent_at IS NULL, POSTs each to Expo, and stamps push_sent_at on
-- success. See supabase/functions/community-notification/index.ts.
--
-- Cadence: 5 minutes. Community events (join requests, arrivals, gatherings,
-- posts) are lower urgency than money-received, which sweeps every minute
-- (mig 180). 5 min keeps notification latency well under the average
-- attention span for a join-request approval while limiting Expo API
-- volume during quiet periods.
--
-- Idempotency comes from push_sent_at itself — the EF's WHERE clause skips
-- already-pushed rows, so an accidental double-schedule (unschedule +
-- reschedule below is defensive) can't cause duplicate deliveries.
--
-- Behavior before the EF is deployed:
--   Every cron tick POSTs to /functions/v1/community-notification. If the
--   function isn't up yet the call returns 404 (or 503); net.http_post
--   captures the response but the cron job itself doesn't fail — it stays
--   scheduled and starts working the moment the EF is deployed. No manual
--   re-registration needed.
--
-- Requirements: pg_cron + pg_net + vault secrets `project_url` and
-- `service_role_key` (already populated for migs 189 / 225 / 232 / etc.).
-- ════════════════════════════════════════════════════════════════════════════

-- Defensive unschedule — makes the migration re-runnable without erroring
-- if a prior partial apply already registered the job.
SELECT cron.unschedule('community_notification_sweeper')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'community_notification_sweeper'
 );

SELECT cron.schedule(
  'community_notification_sweeper',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/community-notification',
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
  '348',
  'community_notification_cron',
  ARRAY['-- 348: community_notification_cron — */5 min schedule for community-notification EF']
)
ON CONFLICT (version) DO NOTHING;
