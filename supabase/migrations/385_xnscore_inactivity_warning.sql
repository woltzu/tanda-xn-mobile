-- ═══════════════════════════════════════════════════════════════════════════
-- 385_xnscore_inactivity_warning.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Preventive-notifications Path B, single gap: XnScore inactivity WARNING
-- fires 3 days before the weekly decay cron would start docking points.
--
-- Investigation background:
--   * process_all_inactivity_decays() keys on xn_scores.last_financial_activity_at
--     and starts applying decay when it's > 30 days old (verified 2026-07-28).
--   * xnscore-decay-check cron runs weekly (Sun 00:00 UTC) — decay is applied
--     silently, no preventive nudge exists.
--   * All other reminder events in the user's original spec are already
--     covered by existing crons (send-payment-reminders, payout-reminder,
--     check-advance-repayments, partial_catch_up_reminder_daily).
--   * notification_preferences.push_reminders + email_reminders already
--     exist (positions 10 + 18) — no toggle schema change needed.
--
-- This migration adds:
--   1. xn_scores.last_inactivity_warning_at TIMESTAMPTZ — 30-day dedup anchor.
--   2. list_xnscore_inactivity_warnings() RPC — returns users at day 27-29
--      inactive who haven't been warned in the last 30 days.
--   3. pg_cron registration for the xnscore-inactivity-warning EF (daily
--      08:00 UTC — offset from the other daily reminders at 09:00).
--
-- The EF itself lands as a companion commit (supabase/functions/
-- xnscore-inactivity-warning/index.ts). Deployment:
--   supabase functions deploy xnscore-inactivity-warning --no-verify-jwt
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Column addition ──────────────────────────────────────────────────
ALTER TABLE public.xn_scores
  ADD COLUMN IF NOT EXISTS last_inactivity_warning_at TIMESTAMPTZ;

COMMENT ON COLUMN public.xn_scores.last_inactivity_warning_at IS
  'Timestamp of the most recent xnscore_inactivity_warning notification. '
  'Used by list_xnscore_inactivity_warnings() for a 30-day dedup — a user '
  'must have gone 30 days without a warning before receiving another. '
  'Added by mig 385.';

-- Partial index for the warning-candidate query. Only rows that could
-- possibly need a warning (recent activity approaching the decay window)
-- are indexed — keeps the index small (~10s of rows out of ~10k members
-- at scale).
CREATE INDEX IF NOT EXISTS idx_xn_scores_approaching_decay
  ON public.xn_scores(last_financial_activity_at DESC)
  WHERE score_frozen = FALSE
    AND total_score > 15;

-- ─── 2. list_xnscore_inactivity_warnings ──────────────────────────────────
-- Returns candidates who:
--   * have been financially inactive for 27-29 days (3-day preemption
--     window before the 30-day decay threshold),
--   * are above the score floor (matches decay eligibility),
--   * are not frozen,
--   * are not in an active recovery period (matches decay eligibility),
--   * either have NEVER been warned OR haven't been warned in 30d (dedup).
--
-- Returns a plain table (not JSONB) so the EF can iterate cleanly. Joins
-- to profiles for display_name so the EF doesn't need a second round-trip.
--
-- No admin gate — this RPC is called only by the EF as service_role. Grants
-- are REVOKE'd from anon and authenticated; service_role has EXECUTE.
CREATE OR REPLACE FUNCTION public.list_xnscore_inactivity_warnings()
RETURNS TABLE(
  user_id                    UUID,
  display_name               TEXT,
  last_financial_activity_at TIMESTAMPTZ,
  days_since_activity        INT,
  total_score                NUMERIC,
  last_inactivity_warning_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
    SELECT
      xs.user_id,
      COALESCE(p.full_name, p.display_name, split_part(u.email, '@', 1), 'Member') AS display_name,
      xs.last_financial_activity_at,
      EXTRACT(DAY FROM NOW() - xs.last_financial_activity_at)::INT AS days_since_activity,
      xs.total_score,
      xs.last_inactivity_warning_at
    FROM public.xn_scores xs
    LEFT JOIN public.profiles p ON p.id = xs.user_id
    LEFT JOIN auth.users     u ON u.id = xs.user_id
    WHERE xs.total_score > 15
      AND xs.score_frozen = FALSE
      AND xs.last_financial_activity_at IS NOT NULL
      -- Warning window: 27-29 days inactive (3 days before the 30-day
      -- decay threshold).
      AND xs.last_financial_activity_at < NOW() - INTERVAL '27 days'
      AND xs.last_financial_activity_at >= NOW() - INTERVAL '30 days'
      -- Recovery-period gate matches process_all_inactivity_decays().
      AND (
        xs.in_recovery_period IS NULL
        OR xs.in_recovery_period = FALSE
        OR xs.recovery_ends_at < NOW()
      )
      -- Dedup: never-warned OR last warned > 30 days ago.
      AND (
        xs.last_inactivity_warning_at IS NULL
        OR xs.last_inactivity_warning_at < NOW() - INTERVAL '30 days'
      );
END;
$$;

REVOKE ALL ON FUNCTION public.list_xnscore_inactivity_warnings() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.list_xnscore_inactivity_warnings() TO service_role;

-- ─── 3. Cron registration ─────────────────────────────────────────────────
-- Daily at 08:00 UTC — offset one hour before the 09:00 UTC block occupied
-- by payout_reminder / event_reminder / gathering_reminder / etc. Keeps
-- the notification queue evenly loaded.
--
-- Uses DO block + cron.unschedule pattern for idempotency: repeated migration
-- runs replace the schedule cleanly rather than errorring on "job already
-- exists".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xnscore-inactivity-warning-daily') THEN
    PERFORM cron.unschedule('xnscore-inactivity-warning-daily');
  END IF;

  PERFORM cron.schedule(
    'xnscore-inactivity-warning-daily',
    '0 8 * * *',
    $CRON$
      SELECT net.http_post(
        url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/xnscore-inactivity-warning',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
          'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
      );
    $CRON$
  );
END $$;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '385',
  'xnscore_inactivity_warning',
  ARRAY['-- 385: xn_scores.last_inactivity_warning_at column + list_xnscore_inactivity_warnings RPC + xnscore-inactivity-warning-daily cron. EF companion required (supabase functions deploy xnscore-inactivity-warning --no-verify-jwt).']
)
ON CONFLICT (version) DO NOTHING;
