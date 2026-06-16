# Orphan Edge Functions — Source Recovered & Schema Reality Check

**Date:** 2026-05-21
**Scope:** Download the 4 Edge Functions that are deployed to Supabase but have no local source (`process-contribution`, `process-loan-payment`, `send-notification`, `webhooks_psp`). Inspect each for real Stripe SDK usage. Determine whether they materially change the conclusion in `24_stripe_connect_payout_path.md`.
**Method:** Read-only — fetched via Management API `/functions/{slug}/body` (returns ESZIP2 bundle), extracted original TypeScript from embedded sourcemaps, cross-checked referenced tables against live schema.

> Source files saved to `C:\Users\franck\seo-work\orphan_efs\` for future reference (not committed to repo).

---

## TL;DR

**These are real, full-featured Edge Functions — but they belong to a defunct parallel architecture.**

They use the real Stripe SDK (`stripe@14.10.0` from esm.sh) with proper signature verification — **not stubs**. However, they reference a **completely different database schema** (`ledger`, `contributions`, `plans`, `users`, etc.) than the current production schema (`circle_contributions`, `profiles`, etc.). Of the 16 table names they reference, **4 don't exist** in the live DB, and the other 12 exist but **mostly have 0 rows**. They have **never been called** in production (zero entries in `cron_job_logs`).

**Net effect on Connect payout assessment:** unchanged. The orphan EFs are dead deployed code. The active payout path is still fully stubbed.

---

## What I recovered

All 4 ESZIP bundles fetched (~570 KB each) and original TypeScript extracted from embedded sourcemaps. Each function has a single `index.ts` plus shared helpers in a `../types.ts` file (not extracted in detail — the helpers are utilities like `createServiceClient`, `corsHeaders`, `TandaXnError`).

| Function | Source size | Deployed | Version | Recovered |
|---|---|---|---|---|
| `process-contribution` | 22,354 chars | Jan 27, 2026 | v5 | ✅ |
| `process-loan-payment` | 19,837 chars | Jan 27, 2026 | v3 | ✅ |
| `send-notification` | 22,334 chars | Jan 27, 2026 | v3 | ✅ |
| `webhooks_psp` | 18,971 chars | Jan 27, 2026 | v3 | ✅ |

---

## Per-function findings

### `process-contribution` — real PoC, dead schema

**Purpose** (from file header):
> Handles circle contribution payments including:
> - Payment validation
> - Wallet balance updates
> - Transaction creation
> - Late fee application
> - XnScore recalculation
> - Notification sending
> - Failed payment handling

**Architecture:** REST endpoint. Accepts `POST { circle_id, amount, payment_method, idempotency_key }`. Looks up circle, checks member status, debits wallet, records contribution, recalculates XnScore.

**Stripe SDK usage:** None directly. This function only does **wallet-internal** debits — no real Stripe charge. (Payment authorization is expected to come from `webhooks_psp` upstream.)

**Tables referenced:**
- `contributions` (NOT `circle_contributions`) — 0 rows in live DB
- `circle_members` — 8 rows ✓ (shared with local schema)
- `circles` — 4 rows ✓ (shared)
- `xn_score_factors` — 0 rows
- `xn_score_history` — 0 rows
- `wallets` (NOT `user_wallets`) — 6 rows
- `transactions` (NOT `wallet_transactions`) — 0 rows
- `webhooks` — **MISSING** ❌
- `audit_events` — **MISSING** ❌
- `ledger` — **MISSING** ❌

**Verdict:** Would error out on the first `supabase.from('ledger').insert(...)` call because the table doesn't exist. **Cannot run.** Never has — confirmed by 0 cron_job_logs entries.

---

### `process-loan-payment` — real PoC, dead schema

**Purpose:** Loan payment processing with interest/principal split, early payoff bonus, XnScore updates.

**Stripe SDK usage:** None directly — also wallet-internal.

**Tables referenced:** `loans`, `loan_payments`, `wallets`, `xn_score_factors`, `xn_score_history`, `transactions`, `webhooks`, `audit_events`, `ledger`. Same pattern — most exist with 0 rows, but `webhooks`, `audit_events`, `ledger` MISSING.

**Verdict:** Same as above. Cannot run.

---

### `send-notification` — real notification dispatcher

**Purpose:** Push (Expo Push Service), Email (SendGrid/Postmark — config TBD), and in-app notifications. Can be called directly or by a cron job to drain a queue.

**Stripe SDK usage:** None.

**Tables referenced:** `user_profiles`, `push_tokens`, `notifications`, `ledger`, `webhooks`, `audit_events`. `ledger`, `webhooks`, `audit_events` MISSING.

**Verdict:** Cannot run — same FK/missing-table problem.

---

### `webhooks_psp` — THE Stripe webhook handler (real and functional, if reachable)

**Purpose** (from file header):
> Handles incoming webhooks from payment service providers (Wave, M-Pesa, Stripe)
> 1. Verify webhook signatures
> 2. Process payment events idempotently
> 3. Update plans and ledger
> 4. Handle both deposits (collection) and payouts

**Stripe SDK usage — REAL:**
```typescript
const stripe = await import("https://esm.sh/stripe@14.10.0");
const stripeInstance = new stripe.default(Deno.env.get("STRIPE_SECRET_KEY") || "", { ... });
const event = stripeInstance.webhooks.constructEvent(payload, signature, secret);
```
Full signature verification, idempotency via `stripe_${event.id}` keys, handlers for:
- `processStripeDeposit` (payment_intent.succeeded equivalent)
- `processStripeDepositFailed`
- `processStripePayout` (transfer.paid equivalent — **the payout-side handler exists**)
- `processStripePayoutFailed`

**Tables referenced:** `plans`, `payouts`, `users`, `webhooks`, `audit_events`, `ledger`. **THREE of these are MISSING** (`plans`, `webhooks`, `audit_events`, `ledger`). The other two (`users`, `payouts`) exist but have 0 rows.

**Verdict:** This is the **most architecturally relevant** orphan — its design pattern (verify signature → branch by event.type → call dedicated handler → update ledger) is exactly what Path A's `stripe-webhook` function should look like at production scale. But as-deployed it errors immediately on the first `supabase.from('plans').update(...)`. Dead code that was *almost* the right design.

---

## Cross-check — referenced tables vs live schema

| Table referenced by orphans | Exists in live DB? | Row count | Local-schema equivalent |
|---|---|---|---|
| `ledger` | ❌ MISSING | — | Maybe `wallet_transactions`? |
| `contributions` | ✅ | 0 | `circle_contributions` (2 rows — local) |
| `loans` | ✅ | 0 | `loans` (same name, 0 rows) |
| `loan_payments` | ✅ | 0 | — |
| `payouts` | ✅ | 0 | `payout_executions` (0 rows) |
| `plans` | ❌ MISSING | — | — |
| `users` | ✅ | 0 | `profiles` (6 rows — local) |
| `user_profiles` | ✅ | 0 | `profiles` (6 rows) |
| `wallets` | ✅ | **6** | `user_wallets` (4 rows — local) |
| `xn_score_factors` | ✅ | 0 | `xn_scores` (0 rows — different shape) |
| `xn_score_history` | ✅ | 0 | — |
| `transactions` | ✅ | 0 | `wallet_transactions` (0 rows) |
| `webhooks` | ❌ MISSING | — | `stripe_webhook_events` (6 rows — Path A) |
| `audit_events` | ❌ MISSING | — | — |
| `push_tokens` | ✅ | 0 | — |
| `notifications` | ✅ | 0 | — |

**4 tables MISSING entirely.** The orphan EFs were written against a schema that no longer exists — looks like a `ledger` + `plans`-based earlier architecture that got migrated to the current `circle_contributions` + `payout_executions` model. The migration left the orphan EFs deployed but stranded.

**Curiosity: `wallets` has 6 rows.** The local code uses `user_wallets` (4 rows). Worth a future cleanup — there are likely two wallet tables in production with overlapping but inconsistent data.

---

## Were they ever called?

```sql
SELECT job_name, count(*), max(started_at)
FROM cron_job_logs
WHERE job_name IN ('process-contribution','process-loan-payment','send-notification','webhooks_psp');
```

**Result: 0 rows.** Not once.

And `stripe_webhook_events` (the Path A table) has 6 rows from your earlier smoke test — all written by the NEW `stripe-webhook` function, not by `webhooks_psp`.

So: **deployed Jan 27, 2026; never called; tables they need don't exist; their replacement (Path A's `stripe-webhook`) has been working since 2026-05-21 against a different table.**

---

## Does this change the Connect payout assessment?

**No.** The active codebase's payout path is still fully stubbed exactly as described in `24_stripe_connect_payout_path.md`:
- `StripeConnectEngine.ts` stubs at lines 638, 655, 894, 1019 — unchanged.
- `process-bank-payouts.initiateStripeTransfer` stub — unchanged.
- `execute_cycle_payout` Postgres RPC — still missing.
- Onboarding 404 wall — still the first wall.

The orphan EFs **could** have been useful if their referenced schema still existed — `webhooks_psp` in particular has good architecture worth borrowing. But borrowing means **re-writing against the current schema**, not just rewiring.

---

## Recommendations (NOT proposing work — just noting options for when you decide)

1. **Treat them as dead code.** Leave them deployed (harmless — they error on first call and Stripe webhooks aren't pointed at them) OR `supabase functions delete` them to clean up the deployment list. The latter is reversible from the recovered source.
2. **Borrow design from `webhooks_psp`.** Its handler structure (verify signature → branch by event type → dispatch to per-event handler → idempotency table) is exactly the pattern Path A's `stripe-webhook` should evolve to as more events get handled. The local source is recoverable from `seo-work/orphan_efs/webhooks_psp__functions_webhooks_psp_index.ts` if you want to reference it.
3. **Investigate the `wallets` vs `user_wallets` divergence.** 6 rows in `wallets`, 4 in `user_wallets`. Possibly a long-standing data-model split that should be reconciled before scale.
4. **Source-code review:** the orphan EFs were apparently the output of an earlier "production-ready" sprint. Worth checking git history for when the schema shifted away from this naming — would help understand the timeline of the architectural pivot.

---

## Confidence

- **ESZIP source extraction**: high. Used the embedded sourcemap `sourcesContent` arrays which contain the original TypeScript verbatim. First 80 lines of each `index.ts` printed and verified.
- **Schema cross-check**: high. Queried `information_schema.tables` against the canonical list of orphan-referenced tables.
- **"Never called" finding**: high. `cron_job_logs` has zero rows for all four function names. (Caveat: if the function was invoked via HTTP POST rather than a cron, it wouldn't show in `cron_job_logs` — but neither HTTP webhook traffic appears in `webhooks` or `stripe_webhook_events`, and the missing tables would have caused errors that should surface in Edge Function platform logs we can't see from here.)
- **Architectural-pivot inference**: medium. The schema delta is real; the *reason* for the pivot is inferred from naming patterns rather than git archaeology.

---

_Generated 2026-05-21. Read-only investigation. 4 orphan EF sources recovered to `seo-work/orphan_efs/` for reference. No code, schema, or deployment changes made._
