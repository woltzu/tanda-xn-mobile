-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 027: Setup Cron Schedules for Edge Functions
-- ══════════════════════════════════════════════════════════════════════════════
-- This sets up pg_cron to automatically call edge functions on schedule
-- ══════════════════════════════════════════════════════════════════════════════

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step 3: Remove existing schedules (if re-running)
SELECT cron.unschedule('daily-interest-accrual') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-interest-accrual');
SELECT cron.unschedule('process-autopay') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-autopay');
SELECT cron.unschedule('send-payment-reminders') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-payment-reminders');
SELECT cron.unschedule('update-overdue-obligations') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'update-overdue-obligations');
SELECT cron.unschedule('xnscore-decay-check') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xnscore-decay-check');
SELECT cron.unschedule('xnscore-tenure-bonus') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'xnscore-tenure-bonus');
SELECT cron.unschedule('cycle-progression-cron') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cycle-progression-cron');
SELECT cron.unschedule('process-bank-payouts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-bank-payouts');
SELECT cron.unschedule('cleanup-expired-reservations') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-reservations');
SELECT cron.unschedule('expire-swap-requests') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-swap-requests');

-- ══════════════════════════════════════════════════════════════════════════════
-- CRON SCHEDULE REFERENCE:
-- ┌───────────── minute (0 - 59)
-- │ ┌───────────── hour (0 - 23)
-- │ │ ┌───────────── day of month (1 - 31)
-- │ │ │ ┌───────────── month (1 - 12)
-- │ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
-- │ │ │ │ │
-- * * * * *
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 1. DAILY INTEREST ACCRUAL - Every day at midnight UTC                       │
-- │    Accrues daily interest on all active loans                               │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'daily-interest-accrual',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/daily-interest-accrual',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 2. PROCESS AUTOPAY - Every day at 6:00 AM UTC                               │
-- │    Executes autopay for due payment obligations                             │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'process-autopay',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/process-autopay',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 3. SEND PAYMENT REMINDERS - Every 4 hours                                   │
-- │    Sends push/email/SMS reminders for upcoming and overdue payments         │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'send-payment-reminders',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/send-payment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 4. UPDATE OVERDUE OBLIGATIONS - Every day at 1:00 AM UTC                    │
-- │    Marks late obligations as overdue and applies late fees                  │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'update-overdue-obligations',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/update-overdue-obligations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 5. XNSCORE DECAY CHECK - Every Sunday at midnight UTC                       │
-- │    Applies inactivity decay to dormant users' XnScores                      │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'xnscore-decay-check',
  '0 0 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/xnscore-decay-check',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 6. XNSCORE TENURE BONUS - 1st of every month at midnight UTC                │
-- │    Awards monthly tenure bonuses to eligible users                          │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'xnscore-tenure-bonus',
  '0 0 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/xnscore-tenure-bonus',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 7. CYCLE PROGRESSION - Every hour                                           │
-- │    Auto-progresses circle cycles through their state machine                │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'cycle-progression-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/cycle-progression-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 8. PROCESS BANK PAYOUTS - Every day at 8:00 AM UTC                          │
-- │    Executes pending bank/mobile money transfers                             │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'process-bank-payouts',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/process-bank-payouts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 9. CLEANUP EXPIRED RESERVATIONS - Every day at 2:00 AM UTC                  │
-- │    Releases expired wallet reservations back to available balance           │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'cleanup-expired-reservations',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/cleanup-expired-reservations',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ 10. EXPIRE SWAP REQUESTS - Every hour at :30                                │
-- │     Expires unanswered position swap requests                               │
-- └─────────────────────────────────────────────────────────────────────────────┘
SELECT cron.schedule(
  'expire-swap-requests',
  '30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/expire-swap-requests',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: View all scheduled jobs
-- ══════════════════════════════════════════════════════════════════════════════
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 027
-- ══════════════════════════════════════════════════════════════════════════════
