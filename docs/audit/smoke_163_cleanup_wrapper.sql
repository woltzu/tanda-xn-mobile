-- Run the wrapped cleanup once + verify a row landed in audit_cleanup_log
SELECT public.cleanup_old_audit_logs() AS deleted_count;

SELECT 'log_row' AS k,
       rows_deleted::text || ' rows / ' ||
       COALESCE(duration_ms::text, 'n/a') || ' ms / err=' ||
       COALESCE(error_message, '<none>') AS v
  FROM public.audit_cleanup_log
 ORDER BY ran_at DESC
 LIMIT 1;
