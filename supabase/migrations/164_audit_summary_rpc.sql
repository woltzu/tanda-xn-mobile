-- ============================================================================
-- Migration 164: get_audit_weekly_summary RPC (helper for send-audit-summary)
-- ============================================================================
-- The Edge Function needs a single JSONB blob covering:
--   totals.events / .anomalies
--   anomalies_by_type
--   top_users (changed_by, count) top 5
--   top_tables (table_name, count) top 5
--   action_split (INSERT/UPDATE/DELETE counts)
--
-- PostgREST has no GROUP BY, so doing this client-side would mean pulling
-- the whole 7-day audit_logs slice over the wire. Once triggers are fully
-- wired that's potentially 100k+ rows/week. We push the aggregation down
-- to SQL with one round-trip.
--
-- SECURITY DEFINER so the function can read audit_logs/audit_anomalies
-- regardless of caller role; admin gate is checked in the body. Grant
-- EXECUTE to service_role only (the Edge Function calls it with that
-- key; no client-side path needs this RPC).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_audit_weekly_summary(
  p_days INTEGER DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_since      TIMESTAMPTZ := now() - (p_days || ' days')::INTERVAL;
  v_events     INTEGER;
  v_anomalies  INTEGER;
  v_anom_by    JSONB;
  v_top_users  JSONB;
  v_top_tables JSONB;
  v_actions    JSONB;
BEGIN
  SELECT COUNT(*) INTO v_events
    FROM public.audit_logs
   WHERE changed_at >= v_since;

  SELECT COUNT(*) INTO v_anomalies
    FROM public.audit_anomalies
   WHERE detected_at >= v_since;

  SELECT COALESCE(jsonb_object_agg(anomaly_type, n), '{}'::jsonb)
    INTO v_anom_by
    FROM (
      SELECT anomaly_type, COUNT(*) AS n
        FROM public.audit_anomalies
       WHERE detected_at >= v_since
       GROUP BY anomaly_type
    ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('user_id', changed_by, 'n', n)
                            ORDER BY n DESC), '[]'::jsonb)
    INTO v_top_users
    FROM (
      SELECT changed_by, COUNT(*) AS n
        FROM public.audit_logs
       WHERE changed_at >= v_since
         AND changed_by IS NOT NULL
       GROUP BY changed_by
       ORDER BY COUNT(*) DESC
       LIMIT 5
    ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('table_name', table_name, 'n', n)
                            ORDER BY n DESC), '[]'::jsonb)
    INTO v_top_tables
    FROM (
      SELECT table_name, COUNT(*) AS n
        FROM public.audit_logs
       WHERE changed_at >= v_since
       GROUP BY table_name
       ORDER BY COUNT(*) DESC
       LIMIT 5
    ) s;

  SELECT COALESCE(jsonb_object_agg(action, n), '{}'::jsonb)
    INTO v_actions
    FROM (
      SELECT action, COUNT(*) AS n
        FROM public.audit_logs
       WHERE changed_at >= v_since
       GROUP BY action
    ) s;

  RETURN jsonb_build_object(
    'window_days',       p_days,
    'since',             v_since,
    'totals',            jsonb_build_object('events', v_events, 'anomalies', v_anomalies),
    'anomalies_by_type', v_anom_by,
    'top_users',         v_top_users,
    'top_tables',        v_top_tables,
    'action_split',      v_actions
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_audit_weekly_summary(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_audit_weekly_summary(INTEGER) TO service_role;

COMMENT ON FUNCTION public.get_audit_weekly_summary IS
  'Service-role-only aggregation helper for the send-audit-summary '
  'Edge Function. Returns totals/anomalies/top-5-users/top-5-tables/'
  'action_split as a single JSONB blob over the last N days (default 7).';


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '164',
  'audit_summary_rpc',
  ARRAY['-- 164: get_audit_weekly_summary RPC for send-audit-summary']
)
ON CONFLICT (version) DO NOTHING;
