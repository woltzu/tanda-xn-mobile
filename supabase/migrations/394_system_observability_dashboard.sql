-- ═══════════════════════════════════════════════════════════════════════════
-- 394_system_observability_dashboard.sql
--
-- Adds a single admin RPC that surfaces system observability from tables
-- that already exist:
--   • user_events         (12k+ rows; client activity + outcomes)
--   • cron_job_logs       (pg_cron / EF cron runs with status + timing)
--   • stripe_webhook_events (every Stripe event with processing_error)
--   • admin_audit_log     (every admin action from mig 389+)
--
-- Deliberately DOES NOT touch the Supabase Management API. Reasons:
--   • PATs rotate weekly (see CLAUDE.md) — a Vault-stored PAT-in-plpgsql
--     path would break every Sunday.
--   • Management API requires a curl User-Agent or Cloudflare returns
--     1010; pg_net's default UA is blocked.
--   • The four sources above already carry enough signal for a launch
--     team eye-check without external HTTP.
--
-- Deferrals (documented, out of scope for this migration):
--   • Edge Function per-endpoint invocation counts — only in Supabase's
--     Log Explorer, not in the DB. Use the Supabase dashboard for that.
--   • Failed auth / credential stuffing — auth.audit_log_entries is
--     empty (GoTrue audit logging is disabled at the project level).
--     login_events has no failure column. Enabling
--     GOTRUE_AUDIT_LOG_ENABLED requires a project-level env change and
--     is not addressable from a migration.
--   • Geographic distribution — user_events.ip_address / geo_country /
--     geo_city columns exist but are NULL on every row today. Populating
--     them needs client-side instrumentation, out of scope here.
--
-- When those prerequisites land, extend this RPC — don't build a
-- parallel one.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_system_observability_dashboard(
  p_hours_back INT DEFAULT 24
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_hours INT;
  v_now TIMESTAMPTZ := NOW();
  v_from TIMESTAMPTZ;
  v_user_activity JSONB;
  v_cron_health JSONB;
  v_webhooks JSONB;
  v_admin_actions JSONB;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'get_system_observability_dashboard: admin required'
      USING ERRCODE = '42501';
  END IF;

  -- Clamp the window to [1h, 30d]. Anything outside would produce a
  -- meaningless dashboard and stress the queries.
  v_hours := GREATEST(1, LEAST(COALESCE(p_hours_back, 24), 720));
  v_from := v_now - (v_hours || ' hours')::INTERVAL;

  -- ── User activity ───────────────────────────────────────────────────
  -- Volume, category breakdown, top users, failure count. Geo is
  -- deliberately not included because the columns are always NULL today.
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'total_24h', COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '24 hours'),
    'total_7d',  COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '7 days'),
    'total_30d', COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '30 days'),
    'window_total', COUNT(*) FILTER (WHERE created_at > v_from),
    'window_failures', COUNT(*) FILTER (
      WHERE created_at > v_from AND outcome = 'failure'
    ),
    'unique_users_in_window', COUNT(DISTINCT user_id) FILTER (
      WHERE created_at > v_from AND user_id IS NOT NULL
    ),
    'by_category', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC)
      FROM (
        SELECT jsonb_build_object(
          'category', COALESCE(event_category, '(none)'),
          'count', COUNT(*),
          'failures', COUNT(*) FILTER (WHERE outcome = 'failure')
        ) AS row_out
        FROM user_events
        WHERE created_at > v_from
        GROUP BY event_category
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) c
    ), '[]'::jsonb),
    'top_users', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC)
      FROM (
        SELECT jsonb_build_object(
          'user_id', ue.user_id,
          'user_name', p.full_name,
          'count', COUNT(*),
          'failures', COUNT(*) FILTER (WHERE ue.outcome = 'failure')
        ) AS row_out
        FROM user_events ue
        LEFT JOIN profiles p ON p.id = ue.user_id
        WHERE ue.created_at > v_from
          AND ue.user_id IS NOT NULL
        GROUP BY ue.user_id, p.full_name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) u
    ), '[]'::jsonb)
  ) INTO v_user_activity
  FROM user_events;

  -- ── Cron health ─────────────────────────────────────────────────────
  -- Per-job rollup: last run status, avg execution, success/failure
  -- counts in the window. Bounded LIMIT because job set may grow.
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'last_run_at') DESC NULLS LAST), '[]'::jsonb)
    INTO v_cron_health
  FROM (
    SELECT jsonb_build_object(
      'job_name', job_name,
      'last_run_at', MAX(started_at),
      'last_status', (
        SELECT status FROM cron_job_logs c2
        WHERE c2.job_name = c1.job_name
        ORDER BY started_at DESC LIMIT 1
      ),
      'last_error', (
        SELECT error_message FROM cron_job_logs c2
        WHERE c2.job_name = c1.job_name
          AND error_message IS NOT NULL
        ORDER BY started_at DESC LIMIT 1
      ),
      'runs_in_window', COUNT(*),
      'successes_in_window', COUNT(*) FILTER (WHERE status = 'success'),
      'failures_in_window', COUNT(*) FILTER (WHERE status = 'failure'),
      'avg_execution_ms', ROUND(AVG(execution_time_ms)::NUMERIC, 0)
    ) AS row_out
    FROM cron_job_logs c1
    WHERE started_at > v_from
    GROUP BY job_name
    ORDER BY MAX(started_at) DESC
    LIMIT 30
  ) cron;

  -- ── Stripe webhook activity ─────────────────────────────────────────
  SELECT jsonb_build_object(
    'total_in_window', COUNT(*),
    'failed_in_window', COUNT(*) FILTER (WHERE processing_error IS NOT NULL),
    'by_type', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC)
      FROM (
        SELECT jsonb_build_object(
          'event_type', event_type,
          'count', COUNT(*),
          'failures', COUNT(*) FILTER (WHERE processing_error IS NOT NULL)
        ) AS row_out
        FROM stripe_webhook_events
        WHERE created_at > v_from
        GROUP BY event_type
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb),
    'recent_errors', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'created_at') DESC)
      FROM (
        SELECT jsonb_build_object(
          'id', id,
          'event_type', event_type,
          'processing_error', processing_error,
          'created_at', created_at
        ) AS row_out
        FROM stripe_webhook_events
        WHERE created_at > v_from AND processing_error IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
      ) e
    ), '[]'::jsonb)
  ) INTO v_webhooks
  FROM stripe_webhook_events
  WHERE created_at > v_from;

  -- ── Admin action volume ─────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total_in_window', COUNT(*),
    'top_admins', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC)
      FROM (
        SELECT jsonb_build_object(
          'admin_id', a.admin_id,
          'admin_name', p.full_name,
          'count', COUNT(*)
        ) AS row_out
        FROM admin_audit_log a
        LEFT JOIN profiles p ON p.id = a.admin_id
        WHERE a.created_at > v_from AND a.admin_id IS NOT NULL
        GROUP BY a.admin_id, p.full_name
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) u
    ), '[]'::jsonb),
    'top_actions', COALESCE((
      SELECT jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC)
      FROM (
        SELECT jsonb_build_object(
          'action', action,
          'count', COUNT(*)
        ) AS row_out
        FROM admin_audit_log
        WHERE created_at > v_from
        GROUP BY action
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) t
    ), '[]'::jsonb)
  ) INTO v_admin_actions
  FROM admin_audit_log
  WHERE created_at > v_from;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'window_hours', v_hours,
    'window_from', v_from,
    'user_activity', v_user_activity,
    'cron_health', v_cron_health,
    'webhooks', v_webhooks,
    'admin_actions', v_admin_actions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_observability_dashboard(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_system_observability_dashboard(INT) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '394',
  'system_observability_dashboard',
  ARRAY['-- 394: system_observability_dashboard']
)
ON CONFLICT (version) DO NOTHING;
