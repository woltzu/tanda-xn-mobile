# Advance P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 157, on top of the
batched-RPC redesign in migrations 144/145/146/147/148._

P2 adds three notification triggers and one UX nudge on the existing
Advance feature: eligibility opened, repayment due soon, repayment
overdue. The Smart Calculator also surfaces the recommended amount as a
live tooltip with an explainer.

## What landed

### Database (migration 157)
* **`advance_eligibility_cache(user_id, product_code, eligible, max_amount_cents, computed_at)`** — last-known eligibility per (user, product). The daily eligibility cron diffs against this to fire `false → true` notifications without spamming. SELECT-own RLS; service-role writes.
* **`apply_advance_late_penalty(loan_id, days_overdue)`** — SECURITY DEFINER service-role RPC. Adds +200 bps to `loans.apr`, applies a 5%-or-$1-min late fee on the oldest overdue `loan_payment_schedule` row, flips `is_delinquent`. Idempotent per schedule entry via `late_fee_applied`.

### Edge Functions (placeholders ready to deploy)
* **`check-advance-eligibility`** — daily. Iterates `xn_scores` rows updated in the last 7 days. For each `loan_products` row (where `is_active=true`), computes `xnscore >= min_xnscore AND circles_participated >= min_completed_circles`. Notifies on `false → true` transition vs the cache. Always upserts the cache.
* **`check-advance-repayments`** — daily, two passes:
  1. **Reminders** — `loan_payment_schedule` due in 1..3 days, status `pending`. Drops one `advance_repayment_due_soon` notification per `(user, schedule_id)`; idempotency via a contains-lookup on `notifications.data.schedule_id`.
  2. **Escalations** — `loan_payment_schedule` due >7 days ago, status `pending`, `late_fee_applied = false`. Calls `apply_advance_late_penalty`, emits an `advance_repayment_overdue` notification, and (best-effort) notifies circle elders if `loans.application_id → loan_applications.circle_id` resolves.

### Frontend
* **[screens/SmartCalculatorScreen.tsx](screens/SmartCalculatorScreen.tsx)** — recommended-amount chip just below the slider. Three colour states: teal-on-match, navy-on-default, amber when over the recommendation. (i) icon opens a plain-language explainer Alert. A "Use it" button snaps the slider to the recommendation when the user has drifted away.

### i18n
* `smart_calculator.recommend_chip` / `_chip_match` / `_use_cta` / `_info_title` / `_info_body`. EN/FR parity at **5331 leaf keys each**.

## What did NOT land — flagged for P3

**Auto-deduction of advance repayment from circle payouts.** The spec called for ensuring `process_advance_repayment` is "fully wired" to the payout-disbursement path. Verification result:

* `process_advance_repayment` exists (migration 147) and is callable.
* Its only consumer today is the client at [hooks/useAdvanceDashboard.ts:282](hooks/useAdvanceDashboard.ts:282) — invoked manually by the user paying off an advance.
* **No payout-disbursement RPC exists in the codebase**: zero matches for `disburse_payout`, `execute_payout`, or `process_payout` either in `pg_proc` (server side) or `grep -rn` (client side).
* No trigger on `payouts` calls `process_advance_repayment` either.

This means there's no auto-deduction today. Wiring one in requires:

1. A canonical `disburse_payout(payout_id)` RPC that credits the wallet and (when an active advance exists) calls `process_advance_repayment` for the user's outstanding obligation before the wallet credit.
2. A test path (the spec's "Simulate payout" button) — likely a service-role admin RPC + a row in `AdminModerationScreen` or a dedicated admin tool.

Both are financial-path changes that warrant explicit scope approval rather than a quiet edit during a P2 pass — per CLAUDE.md's "Verify before assume" and "Read-only diagnostic first" rules. **Flag as P3.**

## Open follow-ups (not P2)

* Build `disburse_payout` and the test-mode admin path (see above).
* Tier-change detection in `check-advance-eligibility` — today we only notify on the `eligible` boolean flip; future enhancement: notify when `max_amount_cents` grows by ≥ $50 even while staying eligible.
* Per-channel suppression honoring `loans.reminder_channels` and `loans.reminder_days_before` array columns (we hard-code 3 days today; the columns already exist on the loans row).
* Replace the flat +200 bps APR bump with a proper rate-tier transition using `loans.rate_tiers`.
* Customer-facing dispute / waiver flow when a late fee is applied (currently the user can only see the notification — no UI to contest).

## Deployment

```
supabase functions deploy check-advance-eligibility --no-verify-jwt
supabase functions deploy check-advance-repayments --no-verify-jwt
```

Schedule via Supabase Scheduler or pg_cron:
* `check-advance-eligibility` — daily ~05:00 UTC
* `check-advance-repayments` — daily ~05:10 UTC (after eligibility so the
  same notification table isn't being contended)
