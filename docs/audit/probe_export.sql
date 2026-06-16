-- A. Confirm export_audit_logs RPC exists + its signature
SELECT 'fn_sig' AS k,
       p.proname || '(' || pg_get_function_arguments(p.oid) || ') → ' ||
       pg_get_function_result(p.oid) AS v
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('export_audit_logs')

UNION ALL

-- B. RPC body for export_audit_logs (so the worker can mirror filter semantics)
SELECT 'fn_body',
       LEFT(pg_get_functiondef(p.oid), 4000)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname='public' AND p.proname='export_audit_logs'

UNION ALL

-- C. Storage buckets — does audit-exports exist?
SELECT 'bucket', id || ' (public=' || public::text || ')'
  FROM storage.buckets

ORDER BY 1, 2;
