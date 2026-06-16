-- ============================================================================
-- Migration 163: Audit Trail P2 (Automation & Learning)
-- ============================================================================
-- DISCOVERY: pg_cron is enabled and the `cleanup_audit_logs_nightly` job
-- already runs `cleanup_old_audit_logs()` (scheduled by migration 153).
-- No new schedule needed — this migration only adds the observability +
-- automation layer on top of the existing nightly purge:
--
--   1. audit_cleanup_log — append-only row per cleanup_old_audit_logs
--      invocation. Lets admins see "did the cron run, did it delete
--      anything, did it error" without reading PG logs.
--
--   2. audit_anomalies — surface for the detect-audit-anomalies daily
--      Edge Function. One row per detected pattern with the source
--      audit_logs ids attached.
--
--   3. audit_export_jobs — queue for the async CSV export worker. The
--      PlatformAuditTrailScreen enqueues a job and shows a toast; the
--      process-audit-export Edge Function picks up the row, runs the
--      paged export, writes to Storage, and notifies the user.
--
-- We also wrap `cleanup_old_audit_logs()` so it writes to
-- `audit_cleanup_log` on every run. Existing callers (the pg_cron job)
-- pick up the new body automatically — no schedule change needed.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. audit_cleanup_log
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_cleanup_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  rows_deleted  INTEGER NOT NULL DEFAULT 0,
  duration_ms   INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_cleanup_log_ran_at
  ON public.audit_cleanup_log(ran_at DESC);

ALTER TABLE public.audit_cleanup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acl_admin_select" ON public.audit_cleanup_log;
CREATE POLICY "acl_admin_select"
  ON public.audit_cleanup_log FOR SELECT TO authenticated
  USING (public.is_admin());

COMMENT ON TABLE public.audit_cleanup_log IS
  'One row per cleanup_old_audit_logs() invocation. Admin-readable. '
  'Append-only — no client INSERT path, the wrapped function writes via '
  'SECURITY DEFINER.';


-- ----------------------------------------------------------------------------
-- 2. audit_anomalies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_anomalies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  anomaly_type      TEXT NOT NULL CHECK (anomaly_type IN (
    'failed_login_burst',
    'profile_churn',
    'admin_ban_burst'
  )),
  severity          TEXT NOT NULL CHECK (severity IN ('low','medium','high')),
  description       TEXT NOT NULL,
  related_audit_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  -- Natural dedup key — anomaly_type + signature (e.g., user_id, ip,
  -- admin_id) over a coarse window. The detector populates signature
  -- and ON CONFLICT DO NOTHING skips re-detected runs.
  signature         TEXT NOT NULL,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_note     TEXT,
  UNIQUE (anomaly_type, signature)
);

CREATE INDEX IF NOT EXISTS idx_audit_anomalies_detected
  ON public.audit_anomalies(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_anomalies_unreviewed
  ON public.audit_anomalies(detected_at DESC)
  WHERE reviewed_at IS NULL;

ALTER TABLE public.audit_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aa_admin_select" ON public.audit_anomalies;
DROP POLICY IF EXISTS "aa_admin_update" ON public.audit_anomalies;

CREATE POLICY "aa_admin_select"
  ON public.audit_anomalies FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "aa_admin_update"
  ON public.audit_anomalies FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.audit_anomalies IS
  'Detected anomaly surface. Populated by detect-audit-anomalies (daily). '
  'UNIQUE(anomaly_type, signature) gives the cron natural-key idempotency. '
  'Admins mark reviewed via the PlatformAuditTrailScreen Anomalies tab.';


-- ----------------------------------------------------------------------------
-- 3. audit_export_jobs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_export_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filters       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','running','completed','failed'
  )),
  total_rows    INTEGER,
  file_path     TEXT,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_export_jobs_user_created
  ON public.audit_export_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_export_jobs_status_created
  ON public.audit_export_jobs(status, created_at)
  WHERE status IN ('queued','running');

ALTER TABLE public.audit_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aej_select_own_or_admin" ON public.audit_export_jobs;

-- The job owner sees their own row; admins see everyone's so they can
-- diagnose failures across the fleet.
CREATE POLICY "aej_select_own_or_admin"
  ON public.audit_export_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- No client INSERT / UPDATE policies. Job creation goes through the
-- create_audit_export_job RPC; the worker uses service-role.

COMMENT ON TABLE public.audit_export_jobs IS
  'Async CSV export queue for PlatformAuditTrailScreen. '
  'process-audit-export polls status=queued, runs export_audit_logs, '
  'writes to the audit-exports Storage bucket, and notifies the user.';


-- ----------------------------------------------------------------------------
-- 4. Wrap cleanup_old_audit_logs() to write to audit_cleanup_log
-- ----------------------------------------------------------------------------
-- The original (migration 153) returned the deleted count. The new body
-- keeps that contract for callers that capture it, but also stamps a
-- row in audit_cleanup_log including duration and any caught exception.
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deleted INT := 0;
  v_started TIMESTAMPTZ := clock_timestamp();
  v_dur_ms  INT;
  v_err     TEXT;
BEGIN
  BEGIN
    DELETE FROM public.audit_logs
    WHERE changed_at + (retention_days || ' days')::INTERVAL < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;

  v_dur_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_started)) * 1000;

  INSERT INTO public.audit_cleanup_log (rows_deleted, duration_ms, error_message)
  VALUES (COALESCE(v_deleted, 0), v_dur_ms, v_err);

  -- Re-raise after logging so the pg_cron job surface still shows the
  -- failure in cron.job_run_details. Otherwise an exception silently
  -- vanishes.
  IF v_err IS NOT NULL THEN
    RAISE EXCEPTION '%', v_err;
  END IF;

  RETURN v_deleted;
END;
$function$;

COMMENT ON FUNCTION public.cleanup_old_audit_logs IS
  'P2 wrapper. Deletes expired audit_logs rows, stamps an '
  'audit_cleanup_log row per invocation (rows_deleted + duration), '
  're-raises on failure so pg_cron sees the error.';


-- ----------------------------------------------------------------------------
-- 5. create_audit_export_job RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_audit_export_job(
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'create_audit_export_job: auth required'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'create_audit_export_job: admin required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_export_jobs (user_id, filters)
  VALUES (v_uid, COALESCE(p_filters, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_audit_export_job(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_audit_export_job(JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_audit_export_job IS
  'Admin-only. Enqueues an audit_export_jobs row that '
  'process-audit-export will pick up and turn into a CSV in the '
  'audit-exports Storage bucket.';


-- ----------------------------------------------------------------------------
-- 6. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '163',
  'audit_trail_p2',
  ARRAY['-- 163: audit_cleanup_log + audit_anomalies + audit_export_jobs + cleanup wrapper + export RPC']
)
ON CONFLICT (version) DO NOTHING;
