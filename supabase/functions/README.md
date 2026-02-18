# TandaXn Edge Functions

This directory contains Supabase Edge Functions that run scheduled jobs (cron) for the TandaXn platform.

## Functions Overview

| Function | Schedule | Purpose |
|----------|----------|---------|
| `daily-interest-accrual` | Daily 00:00 UTC | Accrue daily interest on active loans |
| `process-autopay` | Daily 06:00 UTC | Execute autopay for due payment obligations |
| `send-payment-reminders` | Every 4 hours | Send payment reminder notifications |
| `update-overdue-obligations` | Daily 01:00 UTC | Mark late obligations, apply fees |
| `xnscore-decay-check` | Weekly (Sunday) | Apply inactivity decay to XnScores |
| `xnscore-tenure-bonus` | Monthly (1st) | Award tenure bonuses to users |
| `cycle-progression-cron` | Hourly | Progress circle cycles through states |
| `process-bank-payouts` | Daily 08:00 UTC | Execute bank/mobile money transfers |
| `cleanup-expired-reservations` | Daily 02:00 UTC | Release expired wallet reservations |
| `expire-swap-requests` | Hourly | Expire unanswered swap requests |

## Deployment

### Deploy all functions:
```bash
supabase functions deploy daily-interest-accrual
supabase functions deploy process-autopay
supabase functions deploy send-payment-reminders
supabase functions deploy update-overdue-obligations
supabase functions deploy xnscore-decay-check
supabase functions deploy xnscore-tenure-bonus
supabase functions deploy cycle-progression-cron
supabase functions deploy process-bank-payouts
supabase functions deploy cleanup-expired-reservations
supabase functions deploy expire-swap-requests
```

### Or deploy all at once:
```bash
supabase functions deploy
```

## Setting Up Cron Schedules

After deploying, set up cron schedules in Supabase Dashboard:

1. Go to **Database** → **Extensions** → Enable `pg_cron`
2. Go to **SQL Editor** and run:

```sql
-- Daily Interest Accrual (midnight UTC)
SELECT cron.schedule(
  'daily-interest-accrual',
  '0 0 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-interest-accrual',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Process Autopay (6am UTC)
SELECT cron.schedule(
  'process-autopay',
  '0 6 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-autopay',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Send Payment Reminders (every 4 hours)
SELECT cron.schedule(
  'send-payment-reminders',
  '0 */4 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-payment-reminders',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Update Overdue Obligations (1am UTC)
SELECT cron.schedule(
  'update-overdue-obligations',
  '0 1 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-overdue-obligations',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- XnScore Decay Check (Sundays at midnight)
SELECT cron.schedule(
  'xnscore-decay-check',
  '0 0 * * 0',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/xnscore-decay-check',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- XnScore Tenure Bonus (1st of month at midnight)
SELECT cron.schedule(
  'xnscore-tenure-bonus',
  '0 0 1 * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/xnscore-tenure-bonus',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Cycle Progression (every hour)
SELECT cron.schedule(
  'cycle-progression-cron',
  '0 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cycle-progression-cron',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Process Bank Payouts (8am UTC)
SELECT cron.schedule(
  'process-bank-payouts',
  '0 8 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-bank-payouts',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Cleanup Expired Reservations (2am UTC)
SELECT cron.schedule(
  'cleanup-expired-reservations',
  '0 2 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-expired-reservations',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);

-- Expire Swap Requests (every hour at :30)
SELECT cron.schedule(
  'expire-swap-requests',
  '30 * * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/expire-swap-requests',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

## Environment Variables

Each function requires these environment variables (automatically set by Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access

## Testing Functions Locally

```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test a function
curl -X POST http://localhost:54321/functions/v1/daily-interest-accrual \
  -H "Authorization: Bearer YOUR_LOCAL_SERVICE_KEY" \
  -H "Content-Type: application/json"
```

## Monitoring

All functions log their execution to the `cron_job_logs` table. View stats:

```sql
-- Recent job runs
SELECT * FROM v_recent_cron_jobs;

-- Job statistics
SELECT * FROM v_cron_job_stats;

-- Failed jobs in last 24 hours
SELECT * FROM cron_job_logs
WHERE status = 'failed'
AND created_at > now() - interval '24 hours';
```

## Function Details

### daily-interest-accrual
- Fetches all active loans with outstanding principal
- Calculates daily interest: `(principal × APR) ÷ 365`
- Creates accrual records in `loan_interest_accruals`
- Updates loan `outstanding_principal_cents`

### process-autopay
- Fetches active autopay configs
- Checks for due payment obligations
- Calculates payment amount based on autopay type
- Debits user wallet, credits loan
- Awards XnScore points for on-time payments

### send-payment-reminders
- Fetches scheduled reminders due for sending
- Sends via push/email/SMS based on channel
- Updates reminder status to 'sent' or 'failed'
- TODO: Integrate with Firebase, SendGrid, Twilio

### update-overdue-obligations
- Finds unpaid obligations past due date
- Updates status to 'overdue' after grace period
- Applies late fees (5% of amount due)
- Deducts XnScore points (-5 for late)

### xnscore-decay-check
- Finds users inactive for 30+ days
- Applies decay: 1-3 points/week based on inactivity
- Respects recovery periods (exempt from decay)
- Floor at 10 points minimum

### xnscore-tenure-bonus
- Awards monthly bonuses based on tenure
- 0-6 months: +0.5/month
- 7-12 months: +1/month
- 13-24 months: +1.5/month
- 24+ months: +2/month

### cycle-progression-cron
- Progresses cycles through state machine
- States: scheduled → collecting → deadline_reached → grace_period → ready_payout → payout_completed → closed
- Triggers appropriate notifications at each transition

### process-bank-payouts
- Fetches pending payout executions
- Initiates transfers via Stripe/Flutterwave/Mobile Money
- Updates payout status
- TODO: Integrate with actual payment gateways

### cleanup-expired-reservations
- Finds reservations 7+ days past due date
- Releases funds back to user's available balance
- Records wallet transactions

### expire-swap-requests
- Finds swap requests past expiry time
- Updates status to 'expired'
- Notifies requesters

## TODO

- [ ] Integrate push notifications (Firebase/Expo)
- [ ] Integrate email service (Resend/SendGrid)
- [ ] Integrate SMS service (Twilio/Africa's Talking)
- [ ] Integrate payment gateway (Stripe/Flutterwave)
- [ ] Add retry logic with exponential backoff
- [ ] Add alerting for failed jobs
