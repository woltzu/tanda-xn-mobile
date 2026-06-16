-- ============================================================================
-- Migration 165: audit-exports bucket + worker helper RPCs
-- ============================================================================
-- process-audit-export needs three things this migration provides:
--
--   1. The `audit-exports` private Storage bucket (the worker uploads
--      CSVs here; admins download via signed URL).
--
--   2. RLS on `storage.objects` so admins can list/read every file in
--      the bucket. The worker writes with service-role and bypasses RLS;
--      anon/authenticated non-admins are blocked.
--
--   3. Two RPCs the worker calls:
--       - `claim_audit_export_job()` — atomically marks the oldest
--         queued job as 'running' and returns the row. Uses
--         FOR UPDATE SKIP LOCKED so concurrent worker invocations
--         can never claim the same job.
--       - `export_audit_logs_for_job(p_job_id)` — job-scoped twin of
--         the existing `export_audit_logs(p_filters)` RPC. Validates
--         the job's owner is admin, then runs the same CSV-build query
--         with the job's stored filters. Returns the CSV text.
--
-- The existing `export_audit_logs(p_filters)` keeps working for the
-- screen's small-result path (inline download). The new RPC is just
-- the worker-callable equivalent without the `auth.uid()` gate
-- (service-role has no session, so that gate would always fail).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. audit-exports bucket
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-exports', 'audit-exports', false)
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Storage RLS — admins read any object in audit-exports
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_exports_admin_select" ON storage.objects;
CREATE POLICY "audit_exports_admin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audit-exports' AND public.is_admin());

-- Service-role bypasses RLS for INSERT/UPDATE/DELETE (worker uploads),
-- and no policy exists for anon — so the bucket is locked down outside
-- the admin/worker paths.


-- ----------------------------------------------------------------------------
-- 3a. claim_audit_export_job
-- ----------------------------------------------------------------------------
-- Single-job atomic claim. Returns NULL if there's nothing queued.
-- SKIP LOCKED keeps two concurrent worker invocations from claiming
-- the same row.
CREATE OR REPLACE FUNCTION public.claim_audit_export_job()
RETURNS public.audit_export_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_row public.audit_export_jobs;
BEGIN
  WITH next_job AS (
    SELECT id
      FROM public.audit_export_jobs
     WHERE status = 'queued'
     ORDER BY created_at ASC
     FOR UPDATE SKIP LOCKED
     LIMIT 1
  )
  UPDATE public.audit_export_jobs aej
     SET status     = 'running',
         started_at = now()
    FROM next_job
   WHERE aej.id = next_job.id
  RETURNING aej.* INTO v_row;

  RETURN v_row;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_audit_export_job() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_audit_export_job() TO service_role;

COMMENT ON FUNCTION public.claim_audit_export_job IS
  'Worker-only atomic claim. Pops the oldest queued audit_export_jobs '
  'row, marks status=running, returns the row. SKIP LOCKED makes '
  'parallel workers safe.';


-- ----------------------------------------------------------------------------
-- 3b. export_audit_logs_for_job
-- ----------------------------------------------------------------------------
-- Mirror of `export_audit_logs(p_filters)` but takes a job id. We
-- look up the job, verify its owner is currently admin (defence in
-- depth — they were admin at job creation time per the RLS gate in
-- create_audit_export_job, but might have been revoked since), and
-- run the same CSV-build query with the stored filters.
CREATE OR REPLACE FUNCTION public.export_audit_logs_for_job(
  p_job_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_job     public.audit_export_jobs;
  v_csv     TEXT;
BEGIN
  SELECT * INTO v_job FROM public.audit_export_jobs WHERE id = p_job_id;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'export_audit_logs_for_job: job % not found', p_job_id
      USING ERRCODE = '42704';
  END IF;
  IF NOT public.is_admin(v_job.user_id) THEN
    RAISE EXCEPTION 'export_audit_logs_for_job: job owner no longer admin'
      USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT * FROM public.audit_logs
    WHERE
      (NULLIF(v_job.filters->>'table_name','')     IS NULL OR table_name = v_job.filters->>'table_name')
      AND (NULLIF(v_job.filters->>'action','')     IS NULL OR action     = v_job.filters->>'action')
      AND (NULLIF(v_job.filters->>'changed_by','') IS NULL OR changed_by = (v_job.filters->>'changed_by')::uuid)
      AND (NULLIF(v_job.filters->>'record_id','')  IS NULL OR record_id  = (v_job.filters->>'record_id')::uuid)
      AND (NULLIF(v_job.filters->>'date_from','')  IS NULL OR changed_at >= (v_job.filters->>'date_from')::timestamptz)
      AND (NULLIF(v_job.filters->>'date_to','')    IS NULL OR changed_at <= (v_job.filters->>'date_to')::timestamptz)
    ORDER BY changed_at DESC
    LIMIT 200000  -- background path: 4x the inline 50k cap
  )
  SELECT
    'id,changed_at,table_name,record_id,action,changed_by,ip_address,user_agent,old_data,new_data'
    || E'\n'
    || COALESCE(
         string_agg(
           '"' || id::text || '","'
           || changed_at::text || '","'
           || table_name || '","'
           || record_id::text || '","'
           || action || '","'
           || COALESCE(changed_by::text, '') || '","'
           || COALESCE(ip_address::text, '') || '","'
           || REPLACE(COALESCE(user_agent, ''), '"', '""') || '","'
           || REPLACE(COALESCE(old_data::text, ''), '"', '""') || '","'
           || REPLACE(COALESCE(new_data::text, ''), '"', '""') || '"',
           E'\n'
         ),
         ''
       )
    INTO v_csv
    FROM filtered;

  RETURN v_csv;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.export_audit_logs_for_job(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.export_audit_logs_for_job(UUID) TO service_role;

COMMENT ON FUNCTION public.export_audit_logs_for_job IS
  'Worker-only job-scoped CSV builder. Validates job owner is still '
  'admin, then runs the export with the stored filters (cap 200k). '
  'Inline screen path keeps using export_audit_logs(p_filters).';


-- ----------------------------------------------------------------------------
-- 4. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '165',
  'audit_export_worker',
  ARRAY['-- 165: audit-exports bucket + claim_audit_export_job + export_audit_logs_for_job']
)
ON CONFLICT (version) DO NOTHING;
