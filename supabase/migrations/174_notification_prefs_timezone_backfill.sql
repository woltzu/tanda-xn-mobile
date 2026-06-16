-- 174_notification_prefs_timezone_backfill.sql
-- =====================================================================
-- P0 of the Notification preferences review.
--
-- notification_preferences.quiet_hours_timezone defaults to 'UTC' and
-- has never been written to reflect the user's actual timezone, so
-- the existing rows DND windows fire against the wrong clock. Since
-- the Profile P2 review (migration 167) we auto-set profiles.timezone
-- to the device's IANA zone on first auth — this migration carries
-- that across to notification_preferences in one pass for existing
-- rows. New-row sync happens client-side in NotificationContext
-- (see the same P0 of this review).
--
-- Targets rows where quiet_hours_timezone IS NULL or 'UTC' and the
-- profile has a non-empty timezone. Leaves users who explicitly set
-- 'UTC' as a different timezone alone — there's no way to tell those
-- two cases apart, but treating the default value as eligible for
-- backfill is the right trade.
--
-- Idempotent — re-running is a no-op once timezones land.
-- =====================================================================

UPDATE public.notification_preferences np
SET quiet_hours_timezone = p.timezone,
    updated_at = now()
FROM public.profiles p
WHERE np.user_id = p.id
  AND (np.quiet_hours_timezone IS NULL OR np.quiet_hours_timezone = 'UTC')
  AND p.timezone IS NOT NULL
  AND p.timezone <> ''
  AND p.timezone <> 'UTC';

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '174',
  'notification_prefs_timezone_backfill',
  ARRAY['-- 174: notification_prefs_timezone_backfill']
)
ON CONFLICT (version) DO NOTHING;
