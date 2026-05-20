-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 030: Cron Schedules for Token & Webhook Edge Functions
-- ══════════════════════════════════════════════════════════════════════════════

-- Remove existing schedules if re-running
SELECT cron.unschedule('token-council-monthly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'token-council-monthly');

SELECT cron.unschedule('webhook-retry-processor')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'webhook-retry-processor');

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 1. TOKEN COUNCIL MONTHLY — 1st of every month at 01:00 UTC                 │
-- │    Awards 100 tokens to active Elders who participated in council           │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
    'token-council-monthly',
    '0 1 1 * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/token-council-monthly',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 2. WEBHOOK RETRY PROCESSOR — Every 5 minutes                               │
-- │    Re-attempts failed webhook deliveries                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
    'webhook-retry-processor',
    '*/5 * * * *',
    $$
    SELECT net.http_post(
        url := current_setting('app.settings.edge_function_url', true) || '/webhook-retry-processor',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $$
);

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 030
-- ══════════════════════════════════════════════════════════════════════════════
