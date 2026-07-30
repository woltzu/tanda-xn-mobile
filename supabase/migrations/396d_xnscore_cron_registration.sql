-- ═══════════════════════════════════════════════════════════════════════════
-- 396d_xnscore_cron_registration.sql
--
-- Registers two pg_cron jobs that invoke the XnScore V3.1 follow-up
-- Edge Functions. Ships AFTER the two EFs are deployed:
--
--   • refresh-xnscore-rolling-averages — 02:00 UTC daily. Calls
--     refresh_all_xnscore_rolling_averages(60) so rolling_avg_60d_score
--     stays fresh for get_effective_xn_score consumers.
--
--   • expire-xnscore-grandfathering — 03:00 UTC daily. Clears
--     grandfathered_score / grandfather_expires_at rows past their
--     window. Purely housekeeping (floor logic already gates on
--     grandfather_expires_at > NOW()).
--
-- Both cron entries invoke the EF via pg_net.http_post (same pattern
-- used by process-notification-queue etc.). EFs are deployed
-- --no-verify-jwt so the POST needs no Authorization header — the RPCs
-- they call are service_role-restricted at the DB layer for the real
-- security gate.
--
-- Idempotent: unschedule-if-exists then reschedule so re-applying the
-- migration doesn't error on duplicate job names.
--
-- Prerequisites:
--   ✅ mig 396b applied (RPCs live: refresh_all_xnscore_rolling_averages,
--     get_effective_xn_score).
--   □  Both EFs deployed to Supabase BEFORE this migration runs — the
--     cron will fire at the next scheduled time (max 24h later) and hit
--     a 404 if the EF isn't up. Cron entry itself doesn't validate the
--     URL.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. refresh-xnscore-rolling-averages — 02:00 UTC daily ───────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-xnscore-rolling-averages-nightly') THEN
    PERFORM cron.unschedule('refresh-xnscore-rolling-averages-nightly');
  END IF;
END $$;

SELECT cron.schedule(
  'refresh-xnscore-rolling-averages-nightly',
  '0 2 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/refresh-xnscore-rolling-averages',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- ─── 2. expire-xnscore-grandfathering — 03:00 UTC daily ──────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-xnscore-grandfathering-nightly') THEN
    PERFORM cron.unschedule('expire-xnscore-grandfathering-nightly');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-xnscore-grandfathering-nightly',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/expire-xnscore-grandfathering',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);

-- ─── 3. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396d',
  'xnscore_cron_registration',
  ARRAY['-- 396d: xnscore_cron_registration']
)
ON CONFLICT (version) DO NOTHING;
