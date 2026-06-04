-- ════════════════════════════════════════════════════════════════════════════
-- Migration 086: support_tickets → stress-analyze-ticket EF trigger
-- ════════════════════════════════════════════════════════════════════════════
-- Fires AFTER INSERT ON support_tickets to invoke the stress-analyze-ticket
-- Edge Function asynchronously via pg_net. The EF runs keyword analysis and
-- inserts the corresponding member_stress_signals row.
--
-- Why pg_net instead of inline PL/pgSQL keyword analysis:
--   The engine's analyzeText has nuanced logic (severity weighting per
--   keyword, urgency floors, multi-token keywords like "lost job"). Porting
--   it to SQL would duplicate ~30 LOC of business logic in two languages.
--   pg_net + EF keeps the truth in one place (TypeScript engine), and the
--   trigger becomes a simple "notify" — same model as Supabase's own
--   Database Webhooks.
--
-- URL + auth header strategy:
--   - URL hardcoded to the project's functions URL. Matches the pattern
--     already used by daily-interest-accrual, process-autopay, etc. (see
--     `SELECT command FROM cron.job` for examples).
--   - Auth header uses current_setting('app.settings.service_role_key',
--     true). If that GUC isn't set (it isn't in this project today), the
--     header degrades to "Bearer " — that's fine because the EF is
--     deployed --no-verify-jwt. The trigger still reaches the EF.
--     If/when the project sets the GUC, the same trigger gets proper auth
--     without code change.
--
-- Failure mode:
--   net.http_post is fire-and-forget. The trigger returns NEW regardless
--   of EF response — a failed POST does NOT block ticket creation. This
--   matches the contract: ticket filing must succeed even if the stress
--   pipeline is down. Failures show up in net._http_response and the EF's
--   own error logs; not as a user-facing error.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.notify_stress_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url TEXT := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/stress-analyze-ticket';
  v_srk TEXT;
BEGIN
  -- Match the pattern used by the project's existing cron jobs. NULL is
  -- fine because the EF is deployed --no-verify-jwt.
  v_srk := COALESCE(current_setting('app.settings.service_role_key', true), '');

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_srk,
      'Content-Type',  'application/json'
    ),
    body := jsonb_build_object('ticketId', NEW.id)
  );

  RETURN NEW;
END;
$$;

-- Grant execute to the right roles. The trigger runs as SECURITY DEFINER
-- (function owner = postgres), so the calling user doesn't need direct
-- EXECUTE — but we tighten anyway.
REVOKE EXECUTE ON FUNCTION public.notify_stress_ticket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_stress_ticket() TO authenticated, service_role;

DROP TRIGGER IF EXISTS ticket_stress_trigger ON support_tickets;
CREATE TRIGGER ticket_stress_trigger
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stress_ticket();


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('086', 'ticket_stress_trigger',
        ARRAY['-- 086: AFTER INSERT trigger → stress-analyze-ticket EF'])
ON CONFLICT (version) DO NOTHING;
