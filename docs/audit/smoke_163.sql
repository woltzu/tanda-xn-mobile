-- Smoke test for migration 163

-- A. Tables exist with the expected columns
SELECT 'tables' AS k, table_name AS v
  FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('audit_cleanup_log','audit_anomalies','audit_export_jobs')

UNION ALL

-- B. RLS enabled on all three
SELECT 'rls', n.nspname || '.' || c.relname || '=' || c.relrowsecurity::text
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname='public'
   AND c.relname IN ('audit_cleanup_log','audit_anomalies','audit_export_jobs')

UNION ALL

-- C. Policies exist
SELECT 'policy', schemaname || '.' || tablename || ':' || policyname
  FROM pg_policies
 WHERE schemaname='public'
   AND tablename IN ('audit_cleanup_log','audit_anomalies','audit_export_jobs')

UNION ALL

-- D. cleanup_old_audit_logs is now SECURITY DEFINER with pinned search_path
SELECT 'fn_def', p.proname || ':secdef=' || p.prosecdef::text || ',config=' || COALESCE(array_to_string(p.proconfig,'|'),'<null>')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('cleanup_old_audit_logs','create_audit_export_job')

UNION ALL

-- E. Registry row landed
SELECT 'registry', version || ' ' || name
  FROM supabase_migrations.schema_migrations
 WHERE version='163'

ORDER BY 1, 2;
