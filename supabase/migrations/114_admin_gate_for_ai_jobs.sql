-- ============================================================================
-- Migration 114: Admin gate for AIJobsHealthScreen
-- ============================================================================
-- The AIJobsHealthScreen (added in commit ff48113) reads three operational
-- tables:
--   cron_job_logs            (RLS: service_role only)
--   model_performance_logs   (RLS: service_role only)
--   cohort_analytics         (RLS: service_role only)
--
-- That means today no authenticated client can read them at all -- not
-- regular members and not the dev user. The dashboard renders empty as a
-- consequence. The desired posture is:
--   * Members:        still cannot read
--   * Active admins:  can SELECT (no INSERT/UPDATE/DELETE)
--   * service_role:   full access (unchanged, ETL keeps writing)
--
-- The codebase already has an `admin_users` table (id, user_id, email,
-- role, is_active, ...) seeded with one super_admin (Franck). Rather than
-- add a new is_admin column to profiles or duplicate the membership in a
-- new admin_roles table, this migration:
--
--   1. Defines `public.is_admin(p_user_id UUID DEFAULT auth.uid())`
--      RETURNS BOOLEAN. SECURITY DEFINER. Returns true iff p_user_id is
--      present in admin_users with is_active=true.
--   2. Adds an admin SELECT policy on the three target tables so that
--      `is_admin()` users can read.
--
-- Notes:
--   - SECURITY DEFINER + pinned search_path so callers can't shadow
--     admin_users. EXECUTE granted to authenticated only (PUBLIC/anon
--     revoked) so the helper isn't reachable pre-auth.
--   - No service_role policy added on the rs already-protected tables;
--     the existing service_role policies on cron_job_logs /
--     model_performance_logs / cohort_analytics are kept verbatim.
--   - The screen will start rendering real data the moment the migration
--     applies. Until the frontend guard also lands (separate commit hunk),
--     non-admin authenticated users still can't read these tables thanks
--     to the existing RLS plus the strict policy below.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- D1: is_admin() helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM admin_users
    WHERE user_id = p_user_id
      AND is_active = true
  );
$function$;

COMMENT ON FUNCTION public.is_admin(UUID) IS
  'True iff the user has an active row in admin_users. Used by admin-gated '
  'RLS policies (cron_job_logs, model_performance_logs, cohort_analytics) '
  'and by the useIsAdmin frontend hook. SECURITY DEFINER bypasses RLS on '
  'admin_users itself so the policy doesn''t need to be reflexive.';

REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- D2: admin SELECT policies on the three target tables
-- ----------------------------------------------------------------------------
-- Pattern: drop-then-create so migration is re-runnable. Each policy is
-- SELECT-only -- writes stay service_role exclusive.

DROP POLICY IF EXISTS "admins read cron_job_logs" ON cron_job_logs;
CREATE POLICY "admins read cron_job_logs"
  ON cron_job_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins read model_performance_logs" ON model_performance_logs;
CREATE POLICY "admins read model_performance_logs"
  ON model_performance_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins read cohort_analytics" ON cohort_analytics;
CREATE POLICY "admins read cohort_analytics"
  ON cohort_analytics
  FOR SELECT
  TO authenticated
  USING (public.is_admin());


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('114', 'admin_gate_for_ai_jobs',
        ARRAY['-- 114: is_admin() helper + admin SELECT policies for AIJobsHealthScreen'])
ON CONFLICT (version) DO NOTHING;
