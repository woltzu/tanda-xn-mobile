-- Smoke test for migration 165
SELECT 'bucket' AS k, id || ':public=' || public::text AS v
  FROM storage.buckets WHERE id='audit-exports'

UNION ALL

SELECT 'policy', schemaname || '.' || tablename || ':' || policyname
  FROM pg_policies
 WHERE schemaname='storage' AND policyname='audit_exports_admin_select'

UNION ALL

SELECT 'fn_grants',
       p.proname || ':' || r.grantee || ':' || r.privilege_type
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN information_schema.routine_privileges r
    ON r.specific_name LIKE p.proname || '_%'
   AND r.routine_schema=n.nspname
 WHERE n.nspname='public'
   AND p.proname IN ('claim_audit_export_job','export_audit_logs_for_job')

UNION ALL

SELECT 'fn_def',
       p.proname || ':secdef=' || p.prosecdef::text || ',cfg=' || COALESCE(array_to_string(p.proconfig,'|'),'<null>')
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('claim_audit_export_job','export_audit_logs_for_job')

UNION ALL

SELECT 'registry', version || ' ' || name
  FROM supabase_migrations.schema_migrations
 WHERE version='165'

ORDER BY 1, 2;
