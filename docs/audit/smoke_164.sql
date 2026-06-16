-- Smoke test for migration 164
SELECT 'rpc_grants' AS k, grantee || ':' || privilege_type AS v
  FROM information_schema.routine_privileges
 WHERE routine_schema='public'
   AND routine_name='get_audit_weekly_summary'

UNION ALL

SELECT 'fn_def', p.proname || ':secdef=' || p.prosecdef::text || ',cfg=' || COALESCE(array_to_string(p.proconfig,'|'),'<null>')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname='get_audit_weekly_summary'

UNION ALL

SELECT 'registry', version || ' ' || name
  FROM supabase_migrations.schema_migrations
 WHERE version='164'

UNION ALL

-- Live call — should return a JSONB shape we can inspect.
SELECT 'call', public.get_audit_weekly_summary(7)::TEXT
ORDER BY 1;
