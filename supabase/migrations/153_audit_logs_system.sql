-- ============================================================================
-- Migration 153: Platform-wide canonical audit log
-- ============================================================================
-- One immutable journal that captures INSERT / UPDATE / DELETE on every
-- compliance-relevant table. Drives the PlatformAuditTrailScreen and any
-- future regulatory export.
--
-- Design notes
--   * One trigger function (`log_audit_event`) used by every per-table
--     trigger so the audit shape stays consistent. SECURITY DEFINER so
--     it bypasses RLS on `audit_logs` (which is otherwise read-only for
--     admins and write-locked for everyone).
--   * `retention_days` lives on the row itself, defaulted by the trigger
--     based on the source table's regulatory weight (financial / KYC →
--     10 years; everything else → 7 years). A nightly cron deletes rows
--     whose `changed_at + retention_days days < now()`.
--   * Two RPCs — `get_audit_logs` (paged JSON for the admin screen) and
--     `export_audit_logs` (CSV text for download). Both gated by
--     `public.is_admin()` and SECURITY DEFINER.
--   * Immutability: REVOKE UPDATE / DELETE / TRUNCATE from every role on
--     `audit_logs`. The trigger and cleanup function use SECURITY DEFINER
--     so they still work (definer = postgres = bypasses the REVOKE).
--   * Backfill: the existing `moderation_actions` and
--     `payout_order_audit_log` rows get mapped into `audit_logs` in one
--     INSERT … SELECT at the end of the migration. New writes flow in
--     automatically via triggers; old data is brought along once.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. audit_logs table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data        JSONB,
  new_data        JSONB,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      INET,
  user_agent      TEXT,
  -- Per-row retention horizon. The trigger sets a higher value for
  -- financial / KYC tables so they survive the standard 7-year purge.
  retention_days  INTEGER NOT NULL DEFAULT 2555 CHECK (retention_days > 0),
  -- Optional backfill marker: rows imported from other audit tables
  -- carry the source name so they can be traced back.
  source          TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record_at
  ON audit_logs(table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by_at
  ON audit_logs(changed_by, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON audit_logs(changed_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs(action);

COMMENT ON TABLE public.audit_logs IS
  'Immutable platform audit journal. Written by per-table AFTER triggers '
  '(log_audit_event) and read by admins through get_audit_logs / '
  'export_audit_logs. No client INSERT/UPDATE/DELETE policies exist.';


-- ----------------------------------------------------------------------------
-- 2. Immutability — no UPDATE / DELETE / TRUNCATE from clients
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin SELECT only. No INSERT policy — only SECURITY DEFINER triggers /
-- RPCs can write. No UPDATE / DELETE policies either — the cleanup
-- function runs with SECURITY DEFINER privileges.
DROP POLICY IF EXISTS "audit_logs_admin_select" ON audit_logs;
CREATE POLICY "audit_logs_admin_select"
  ON audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

-- Belt-and-braces: revoke write grants. SECURITY DEFINER functions run
-- as the function owner (postgres), bypassing these.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. Trigger function — log_audit_event
-- ----------------------------------------------------------------------------
-- One function used by every per-table trigger. Resolves the actor via
-- auth.uid() (works from SECURITY DEFINER), records the change shape as
-- JSONB, and dispatches retention by source table.
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_record_id     UUID;
  v_old_data      JSONB := NULL;
  v_new_data      JSONB := NULL;
  v_changed_by    UUID;
  v_retention     INT;
  v_ip            INET;
  v_user_agent    TEXT;
BEGIN
  -- Resolve action shape.
  IF (TG_OP = 'INSERT') THEN
    v_new_data := to_jsonb(NEW);
    v_record_id := (NEW.id);
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := (NEW.id);
  ELSIF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    v_record_id := (OLD.id);
  END IF;

  -- Actor. auth.uid() works inside a SECURITY DEFINER trigger because
  -- the JWT lives on the session, not the function privilege.
  BEGIN
    v_changed_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  -- IP + user agent — PostgREST puts these into request.headers when
  -- the call originates from a client. Server-side triggers (cron,
  -- service-role) won't populate them; that's fine, the columns are
  -- nullable.
  BEGIN
    v_user_agent := current_setting('request.headers', true)::jsonb->>'user-agent';
    v_ip         := NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', '')::inet;
  EXCEPTION WHEN OTHERS THEN
    v_user_agent := NULL;
    v_ip := NULL;
  END;

  -- Per-table retention horizon. Financial / KYC tables get 10 years
  -- so the row survives the 7-year default purge.
  v_retention := CASE TG_TABLE_NAME
    WHEN 'kyc_verifications'  THEN 3650
    WHEN 'user_wallets'       THEN 3650
    WHEN 'money_transfers'    THEN 3650
    WHEN 'contributions'      THEN 3650
    WHEN 'payouts'            THEN 3650
    WHEN 'moderation_actions' THEN 3650
    ELSE 2555
  END;

  INSERT INTO public.audit_logs (
    table_name, record_id, action,
    old_data, new_data,
    changed_by, ip_address, user_agent,
    retention_days
  )
  VALUES (
    TG_TABLE_NAME, v_record_id, TG_OP,
    v_old_data, v_new_data,
    v_changed_by, v_ip, v_user_agent,
    v_retention
  );

  -- AFTER triggers don't care about the return value but Postgres
  -- complains if the function doesn't return something row-shaped.
  RETURN COALESCE(NEW, OLD);
END;
$function$;

COMMENT ON FUNCTION public.log_audit_event IS
  'Generic AFTER-row trigger used by every audit-attached table. '
  'Writes one row into audit_logs with the change shape, the actor '
  'via auth.uid(), and a per-table retention horizon.';


-- ----------------------------------------------------------------------------
-- 4. Per-table triggers
-- ----------------------------------------------------------------------------
-- Each table gets a single AFTER INSERT / UPDATE / DELETE trigger. The
-- DROP IF EXISTS / CREATE pair makes re-runs idempotent. Trigger name
-- is uniform (`audit_trigger`) for easy bulk lookup.

DROP TRIGGER IF EXISTS audit_trigger ON public.profiles;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.kyc_verifications;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.user_wallets;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.money_transfers;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.money_transfers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.contributions;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.payouts;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.dispute_cases;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.dispute_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.mediation_cases;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.mediation_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- moderation_actions stays as its own table (it has admin-specific
-- columns like duration and source_report_id that don't fit in
-- audit_logs' generic shape) but also writes a parallel audit_logs
-- entry for the unified admin view.
DROP TRIGGER IF EXISTS audit_trigger ON public.moderation_actions;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.moderation_actions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.circles;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.circle_members;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.circle_members
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.feed_posts;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_trigger ON public.community_events;
CREATE TRIGGER audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.community_events
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


-- ----------------------------------------------------------------------------
-- 5. Retention cleanup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM public.audit_logs
  WHERE changed_at + (retention_days || ' days')::INTERVAL < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_audit_logs() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.cleanup_old_audit_logs() TO service_role;

COMMENT ON FUNCTION public.cleanup_old_audit_logs IS
  'Deletes audit_logs rows older than their per-row retention horizon. '
  'Service-role only — invoked nightly via pg_cron (see end of migration).';


-- ----------------------------------------------------------------------------
-- 6. RPC: get_audit_logs
-- ----------------------------------------------------------------------------
-- Returns {rows: [...], total_count: N} so the admin screen can paginate
-- without a second count query. Filters come in as JSONB so the same
-- RPC handles every combination without an explosion of function
-- overloads.
CREATE OR REPLACE FUNCTION public.get_audit_logs(
  p_filters JSONB DEFAULT '{}'::jsonb,
  p_limit   INT   DEFAULT 50,
  p_offset  INT   DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_total INT;
  v_rows  JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'get_audit_logs: admin required'
      USING ERRCODE = '42501';
  END IF;

  -- Materialise the filtered set once.
  CREATE TEMP TABLE _f ON COMMIT DROP AS
  SELECT * FROM public.audit_logs
  WHERE
    (NULLIF(p_filters->>'table_name','')   IS NULL OR table_name = p_filters->>'table_name')
    AND (NULLIF(p_filters->>'action','')   IS NULL OR action     = p_filters->>'action')
    AND (NULLIF(p_filters->>'changed_by','') IS NULL OR changed_by = (p_filters->>'changed_by')::uuid)
    AND (NULLIF(p_filters->>'record_id','')  IS NULL OR record_id  = (p_filters->>'record_id')::uuid)
    AND (NULLIF(p_filters->>'date_from','')  IS NULL OR changed_at >= (p_filters->>'date_from')::timestamptz)
    AND (NULLIF(p_filters->>'date_to','')    IS NULL OR changed_at <= (p_filters->>'date_to')::timestamptz);

  SELECT count(*) INTO v_total FROM _f;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY (p.changed_at) DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT * FROM _f
       ORDER BY changed_at DESC
       LIMIT p_limit OFFSET p_offset
    ) p;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_audit_logs(JSONB, INT, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_audit_logs(JSONB, INT, INT) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_audit_logs IS
  'Admin-only paged audit query. Filters: table_name, action, changed_by, '
  'record_id, date_from, date_to. Returns {rows, total_count}.';


-- ----------------------------------------------------------------------------
-- 7. RPC: export_audit_logs (CSV text)
-- ----------------------------------------------------------------------------
-- Hard-capped at 50000 rows so a runaway filter can't OOM the database.
-- The admin screen passes the same filter shape it uses for get_audit_logs.
CREATE OR REPLACE FUNCTION public.export_audit_logs(
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_csv  TEXT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'export_audit_logs: admin required'
      USING ERRCODE = '42501';
  END IF;

  -- Build the CSV with a header row first.
  WITH filtered AS (
    SELECT * FROM public.audit_logs
    WHERE
      (NULLIF(p_filters->>'table_name','')     IS NULL OR table_name = p_filters->>'table_name')
      AND (NULLIF(p_filters->>'action','')     IS NULL OR action     = p_filters->>'action')
      AND (NULLIF(p_filters->>'changed_by','') IS NULL OR changed_by = (p_filters->>'changed_by')::uuid)
      AND (NULLIF(p_filters->>'record_id','')  IS NULL OR record_id  = (p_filters->>'record_id')::uuid)
      AND (NULLIF(p_filters->>'date_from','')  IS NULL OR changed_at >= (p_filters->>'date_from')::timestamptz)
      AND (NULLIF(p_filters->>'date_to','')    IS NULL OR changed_at <= (p_filters->>'date_to')::timestamptz)
    ORDER BY changed_at DESC
    LIMIT 50000
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
           -- Double any quotes so the CSV stays well-formed.
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

REVOKE EXECUTE ON FUNCTION public.export_audit_logs(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.export_audit_logs(JSONB) TO authenticated, service_role;

COMMENT ON FUNCTION public.export_audit_logs IS
  'Admin-only CSV export of audit_logs. Same filter shape as '
  'get_audit_logs. Capped at 50000 rows for safety.';


-- ----------------------------------------------------------------------------
-- 8. RPC: list_distinct_audit_actors (helper for the user picker)
-- ----------------------------------------------------------------------------
-- The admin screen needs to know which users have audit activity so it
-- can populate the actor dropdown. This RPC returns the distinct set
-- with their email (joined from auth.users) for display.
CREATE OR REPLACE FUNCTION public.list_distinct_audit_actors()
RETURNS TABLE (user_id UUID, email TEXT, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'list_distinct_audit_actors: admin required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT a.changed_by AS user_id,
           u.email::TEXT,
           MAX(a.changed_at) AS last_seen
      FROM public.audit_logs a
 LEFT JOIN auth.users u ON u.id = a.changed_by
     WHERE a.changed_by IS NOT NULL
     GROUP BY a.changed_by, u.email
     ORDER BY MAX(a.changed_at) DESC
     LIMIT 200;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_distinct_audit_actors() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_distinct_audit_actors() TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 9. Backfill from moderation_actions and payout_order_audit_log
-- ----------------------------------------------------------------------------
-- One-shot import so the new admin screen has historical context. The
-- triggers above will now keep moderation_actions in sync going forward,
-- but the pre-153 rows would otherwise be invisible.
INSERT INTO public.audit_logs (
  id, table_name, record_id, action, new_data, changed_by, changed_at,
  retention_days, source
)
SELECT
  gen_random_uuid(),
  'moderation_actions',
  ma.id,
  'INSERT',
  to_jsonb(ma),
  ma.admin_user_id,
  ma.created_at,
  3650,
  'backfill:moderation_actions'
FROM public.moderation_actions ma
LEFT JOIN public.audit_logs a
  ON a.table_name = 'moderation_actions'
 AND a.record_id  = ma.id
WHERE a.id IS NULL;

-- payout_order_audit_log exists if migration 010 ran. We discover its
-- shape at backfill time via to_jsonb so the migration doesn't break
-- if the column list changes upstream.
DO $$
DECLARE
  v_has_table BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='payout_order_audit_log'
  ) INTO v_has_table;
  IF v_has_table THEN
    EXECUTE $insert$
      INSERT INTO public.audit_logs (
        id, table_name, record_id, action, new_data, changed_by, changed_at,
        retention_days, source
      )
      SELECT
        gen_random_uuid(),
        'payout_order_audit_log',
        p.id,
        'INSERT',
        to_jsonb(p),
        NULL,
        COALESCE(p.created_at, now()),
        3650,
        'backfill:payout_order_audit_log'
      FROM public.payout_order_audit_log p
      LEFT JOIN public.audit_logs a
        ON a.table_name = 'payout_order_audit_log'
       AND a.record_id  = p.id
      WHERE a.id IS NULL
    $insert$;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 10. pg_cron schedule (best-effort)
-- ----------------------------------------------------------------------------
-- Tries to schedule a nightly cleanup at 03:00 UTC. If pg_cron is not
-- installed or accessible, we emit a NOTICE and let the migration
-- succeed — the user can run `SELECT cleanup_old_audit_logs();` manually
-- or schedule it via Supabase Scheduler / an Edge Function instead.
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('cleanup_audit_logs_nightly');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    PERFORM cron.schedule(
      'cleanup_audit_logs_nightly',
      '0 3 * * *',
      'SELECT public.cleanup_old_audit_logs();'
    );
    RAISE NOTICE 'cleanup_audit_logs_nightly scheduled via pg_cron';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron schedule skipped (extension may be unavailable): %', SQLERRM;
  END;
END $$;


-- ----------------------------------------------------------------------------
-- 11. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '153',
  'audit_logs_system',
  ARRAY['-- 153: canonical audit_logs + triggers + RPCs + retention']
)
ON CONFLICT (version) DO NOTHING;
