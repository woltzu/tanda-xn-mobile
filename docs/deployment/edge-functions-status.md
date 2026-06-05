# Edge Functions Deployment Status

Snapshot of every Supabase Edge Function deployed to the `fjqdkyjkwqeoafwvnjgv`
project, taken as part of the Step 1 deployment phase of production
hardening. The live state is the source of truth — re-run

```
curl -s -X GET https://api.supabase.com/v1/projects/fjqdkyjkwqeoafwvnjgv/functions \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN"
```

to confirm any of the rows below before relying on them. Update this file
opportunistically when slugs or `verify_jwt` postures change.

## Auth posture conventions

| Category | `verify_jwt` | Rationale |
| --- | --- | --- |
| Cron-invoked (called by `cron.schedule` via `net.http_post`) | `False` | The pg_cron job runs as `postgres`; there is no end-user JWT to verify. The function should self-authorize via the service-role key it pulls from `Deno.env`. |
| Public webhooks (Stripe, PSP) | `False` | Webhook callers don't carry Supabase JWTs; the function verifies the provider's HMAC signature itself. |
| Partner API endpoints (`api-v1-*`, `api-webhook-dispatcher`) | `False` | These use a custom API-key model implemented in `_shared/apiAuth.ts`, not Supabase JWT. |
| User-initiated (Stripe Connect, contribution flow, financial report) | `True` | Function operates on behalf of the calling user; JWT identifies them. |

## Deployed functions (46 total)

| Slug | Version | `verify_jwt` | Purpose |
| --- | --- | --- | --- |
| advance-signal-cron | v1 | False | Daily signal collection for liquidity-advance pricing |
| api-v1-cases | v1 | False | Partner API: create dispute case |
| api-v1-elders | v1 | False | Partner API: list active elders |
| api-v1-honor | v1 | False | Partner API: read honor score |
| api-v1-vouch-check | v1 | False | Partner API: check active vouches |
| api-webhook-dispatcher | v1 | False | Internal: dispatch partner webhook payloads with HMAC-SHA256 |
| cleanup-expired-reservations | v4 | True | Daily 02:00 UTC cleanup of expired reservations |
| conflict-monitoring-cron | v1 | False | Conflict-orchestration scoring pass |
| create-connect-account | v1 | True | Stripe Connect onboarding for payouts |
| create-payment-intent | v5 | True | Stripe PaymentIntent creation for contributions |
| cycle-progression-cron | v4 | True | Hourly cycle-state advancement |
| daily-interest-accrual | v4 | True | 00:00 UTC accrual against active loans |
| data-quality-cron | v1 | False | Periodic data-integrity sweep |
| early-intervention-cron | v2 | False | Early-warning detection + intervention queue |
| expire-swap-requests | v4 | True | Half-hourly: expire stale position-swap requests |
| generate-financial-report | v1 | True | On-demand credit report (feat(report) #13) |
| graduated-entry-cron | v1 | False | Member tier eval (graduated entry) |
| insurance-pool-rate-cron | v1 | False | Weekly recompute of circle insurance pool rates |
| liquidity-pool-health-cron | v1 | False | Weekly Sunday 04:30 UTC pool-health adjustment (migration 098+115) |
| log-circle-match-interaction | v1 | False | Records viewed/saved/dismissed/applied in `circle_match_history` |
| login-drop-cron | v1 | False | Login-attrition signal collection |
| monthly-cohort-analysis | v2 | False | 2nd of month 06:00 UTC: cohort metrics (migration 113) |
| mood-analyze-message | v1 | False | Per-message mood scoring trigger |
| mood-bridge-cron | v1 | False | Daily mood-signal bridge to scoring |
| mood-scoring-cron | v1 | False | Weekly mood-scoring rollup |
| partial-contribution-lifecycle-cron | v1 | False | Daily lifecycle pass on partial-contribution plans |
| process-autopay | v4 | True | 06:00 UTC autopay execution |
| process-bank-payouts | v4 | True | 08:00 UTC payout batch |
| process-contribution | v5 | True | User-initiated contribution submission |
| process-loan-payment | v5 | True | User-initiated loan payment |
| scoring-pipeline-daily | v1 | False | 03:00 UTC scoring rollup (XnScore, default risk, health, alerts) |
| send-notification | v5 | True | User-initiated notification send |
| send-payment-reminders | v4 | True | Every 4h reminder sweep |
| stress-analyze-ticket | v1 | False | Stress-signal scoring per ticket |
| stress-scoring-cron | v1 | False | Daily stress rollup |
| stress-signal-collection-cron | v1 | False | Daily stress-signal collection |
| stripe-attach-bank-payment-method | v1 | True | Attach bank account to Stripe customer |
| stripe-create-bank-session | v1 | True | Stripe Financial Connections session |
| stripe-webhook | v9 | False | Stripe event ingestion (signature-verified) |
| substitute-lifecycle-cron | v1 | False | Hourly substitute-member lifecycle pass |
| update-overdue-obligations | v4 | True | 01:00 UTC mark overdue |
| webhook-retry-processor | v1 | False | Every-5m retry of failed partner webhook deliveries |
| webhooks_psp | v5 | True | PSP webhook ingestion |
| weekly-model-performance-check | v2 | False | Sun 05:00 UTC: model accuracy + drift (migration 113) |
| xnscore-decay-check | v4 | True | Weekly XnScore decay |
| xnscore-tenure-bonus | v4 | True | Monthly XnScore tenure bonus |

## Deployment phase that produced this file

Newly deployed in this phase (6 functions; all previously written but never uploaded):

- `api-v1-cases`
- `api-v1-elders`
- `api-v1-honor`
- `api-v1-vouch-check`
- `api-webhook-dispatcher`
- `webhook-retry-processor`

All six use the partner-API key model (`_shared/apiAuth.ts`) rather than
Supabase JWT, so they were deployed with `--no-verify-jwt`.

## Local-vs-deployed gaps after this phase

Local directories with **no** deployed counterpart: **none**.

Deployed slugs with **no** local source-of-truth directory under
`supabase/functions/`:

- `process-contribution` (v5) — predates current checkout
- `process-loan-payment` (v5) — predates current checkout
- `send-notification` (v5) — predates current checkout
- `webhooks_psp` (v5) — predates current checkout

These four are still ACTIVE and serving traffic. They should be reverse-
checked into the repo before any redeploy attempt — running
`supabase functions deploy` without a local source dir would fail.

## Re-running the deploy

For a single function:

```
SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy <slug> \
  --project-ref fjqdkyjkwqeoafwvnjgv \
  --no-verify-jwt           # only if appropriate per the table above
```

For the full sweep used in this phase:

```
for slug in api-v1-cases api-v1-elders api-v1-honor \
            api-v1-vouch-check api-webhook-dispatcher \
            webhook-retry-processor; do
  SUPABASE_ACCESS_TOKEN=<pat> supabase functions deploy "$slug" \
    --project-ref fjqdkyjkwqeoafwvnjgv \
    --no-verify-jwt
done
```
