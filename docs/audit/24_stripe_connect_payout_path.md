# Stripe Connect Payout Path — Map & Honest Assessment

**Date:** 2026-05-21
**Scope:** Trace the full contribute → cycle payout flow. Identify every stub, TODO, and unimplemented step. Answer: if you try a full cycle end-to-end in Stripe test mode tomorrow, where does the wall hit first?
**Method:** Read-only — code, schema, RPC catalog, and live row counts.

> Filename note: the previous file in the series (`23_deferred_b10_profiles.md`) was committed minutes before this doc was requested; this doc was numbered 24 to preserve that record. Renumber if you prefer.

---

## TL;DR — the honest assessment

**Nothing on the Connect payout path is real.** Path A proved that one `payment_intents.create` Edge Function works end-to-end, but **every other Stripe interaction on the contribute-and-payout cycle is a stub returning fake IDs**. The DB tables and React state machine are real and well-thought-out; the Stripe SDK calls inside them are all `// TODO`.

| Layer | State |
|---|---|
| Database schema (10 stripe_* tables, 16 columns on `stripe_connected_accounts`) | ✅ Real |
| React hooks (`useStripeAccount`, `useStripePayments`, `useStripeTransfers`) | ✅ Real (but wrap stubs) |
| Cron Edge Functions (`cycle-progression-cron`, `process-bank-payouts`) | ✅ Real (but call stubs) |
| `StripeConnectEngine.ts` business logic | ✅ Real (orchestration) |
| **Stripe SDK calls inside `StripeConnectEngine.ts`** | ❌ **All 4 stubs returning mock IDs** |
| `execute_cycle_payout` Postgres RPC | ❌ **Does not exist in DB** |
| `process-bank-payouts.initiateStripeTransfer` | ❌ **Stub returning fake transaction IDs** |

If you create two test users and run one cycle, **the first wall hits at Stripe Connect onboarding** — the user taps "set up payouts," the engine generates a `https://connect.stripe.com/setup/e/test_...` URL that doesn't exist, the WebView/browser returns 404. No `Account` is ever created on Stripe. The DB row in `stripe_connected_accounts` has a fake `acct_test_...` ID.

Even if you bypass onboarding and seed test data manually, the next walls follow in order: PI creation is mocked, transfers are mocked, and the payout cron's "Stripe transfer" function is a separate stub that just logs to console.

---

## Code path trace — full cycle, file by file

### Stage 1 — Connected account onboarding (Elder/Recipient)

```
UI screen
  ↓
useStripeAccount.createConnectedAccount() + getOnboardingLink()    hooks/useStripePayments.ts
  ↓
StripeConnectEngine.createConnectedAccount(memberId, email, country)
StripeConnectEngine.generateOnboardingLink(memberId, returnUrl, refreshUrl)
                                                                   services/StripeConnectEngine.ts
  ↓ both internally call:
StripeConnectEngine._createStripeExpressAccount(...)               L638  ❌ STUB
StripeConnectEngine._generateAccountLink(...)                      L655  ❌ STUB
  ↓ would-be Stripe API calls (commented out):
    stripe.accounts.create({ type: 'express', email, country, ... })
    stripe.accountLinks.create({ account, return_url, refresh_url, ... })
```

**UI entry points found:**
- `screens/WithdrawScreen.tsx` — uses `getOnboardingLink`
- `screens/LinkedAccountsScreen.tsx` — uses `getOnboardingLink`
- `context/PaymentContext.tsx` → `setupConnectedAccount()` exposes the same flow

**Stripe API calls actually made:** **0**. The mock returns `acct_test_xxxx` and a fake `https://connect.stripe.com/setup/e/test_xxxx` URL.

**DB tables:** `stripe_connected_accounts` (16 columns including `onboarding_status`, `charges_enabled`, `payouts_enabled`) — schema is correct, but the `stripe_account_id` it stores is fake.

**Live row count today:** `stripe_connected_accounts` = **0 rows**. Nobody has even attempted to onboard.

---

### Stage 2 — Member contribution (money in)

```
screens/MakeContributionScreen.tsx
  ↓
CirclesContext.makeContribution(circleId, amount)                  context/CirclesContext.tsx
  ↓
  supabase.from('circle_contributions').insert({ status: 'paid', ... })
  (NO Stripe call — this is purely a DB write. Wallet balance is not debited.)
```

**Alternate "real" path through Stripe** — if it were wired up:
```
PaymentContext.createContribution(amount, currency, circleId, cycleId)
  ↓
StripeConnectEngine.createPaymentIntent({ purpose: 'contribution', ... })
  ↓
StripeConnectEngine._createStripePaymentIntent(...)                L894  ❌ STUB
  ↓ would-be Stripe API call (commented out):
    stripe.paymentIntents.create({ amount, currency, customer, ... })
```

**Stripe API calls actually made by contribute flow:** **0**. `circle_contributions` is updated but nothing happens at Stripe.

**Note:** there's also a parallel Edge Function `create-payment-intent` (Path A, just shipped) that DOES call Stripe — but the contribute UI doesn't use it. Path A only powers the `__DEV__` test button on `AddFundsScreen`. The real contribute flow bypasses it entirely.

**Live row count:** `circle_contributions` = **2 rows** (from earlier `makeContribution` smoke tests — both DB-only, no Stripe trace).

---

### Stage 3 — Cycle progression (deadline → ready_payout)

```
SUPABASE CRON (hourly)
  ↓
supabase/functions/cycle-progression-cron/index.ts
  ↓ State machine: scheduled → collecting → deadline_reached → grace_period → ready_payout
  ↓ When status reaches 'ready_payout' AND expected_payout_date ≤ today:
    supabase.rpc('execute_cycle_payout', { p_cycle_id })          ❌ RPC DOES NOT EXIST
    ↓ fallback (line 170):
    UPDATE circle_cycles SET status='payout_pending'
    "Awaiting manual payout processing"
```

**Confirmed via `pg_proc` query:** `public.execute_cycle_payout` does **not exist** in the live DB. So in production today, every cycle that hits `ready_payout` gets stuck in `payout_pending` indefinitely. There's no code path that picks it up from there.

**Live row count:** `circle_cycles` = **0 rows**. The state machine has never run on real data.

---

### Stage 4 — Payout execution (money out)

There are **two parallel and non-converging** payout execution paths in the codebase. Neither moves money.

#### Path 4a — `process-bank-payouts` (the Edge Function)

```
SUPABASE CRON (daily 08:00 UTC)
  ↓
supabase/functions/process-bank-payouts/index.ts
  ↓ Queries payout_executions WHERE execution_status='pending'
  ↓ For each, dispatches by destination_type:
    case 'bank':         initiateStripeTransfer(...)              L26   ❌ STUB
    case 'mobile_money': initiateMobileMoneyTransfer(...)         L62   ❌ STUB
    case 'flutterwave':  initiateFlutterwaveTransfer(...)         L43   ❌ STUB
  ↓ All three stubs return:
    { success: true, transaction_id: 'stripe_${Date.now()}_...' }
  ↓ payout_executions.execution_status ← 'processing' or 'completed' (based on stub's fake response)
```

**The `initiateStripeTransfer` function does not import the Stripe SDK at all.** It just `console.log()`s and returns a fake ID. The payout pipeline appears to work — statuses transition, logs accumulate — but nothing leaves Stripe's balance.

**Live row count:** `payout_executions` = **0 rows**. No one has ever entered this code path.

#### Path 4b — `StripeConnectEngine.createTransfer` (the React-side service)

```
useStripeTransfers.createTransfer(...)                            hooks/useStripePayments.ts:344
  ↓
StripeConnectEngine.createTransfer(params)                        services/StripeConnectEngine.ts:931
  ↓
StripeConnectEngine._createStripeTransfer(...)                    L1019  ❌ STUB
  ↓ would-be Stripe API call (commented out):
    stripe.transfers.create({ amount, currency, destination, ... })
  ↓ stripe_transfers row created with fake tr_test_xxxx ID
```

**No UI screen currently calls this path.** It exists in case a manual admin-initiated transfer is ever wired up.

**Live row count:** `stripe_transfers` = **0 rows**.

---

## Every TODO / stub on the payout path

### `services/StripeConnectEngine.ts` (1953 lines, ~14 Stripe-related TODOs)

| Line | What's stubbed | Real Stripe call that should be there |
|---|---|---|
| 503 | Customer email update | `stripe.customers.update()` |
| 522 | (Stripe customer create — wrapper) | `stripe.customers.create()` |
| 639 | **Connected account creation** | `stripe.accounts.create({ type: 'express', ... })` |
| 656 | **Onboarding link generation** | `stripe.accountLinks.create()` |
| 867 | PI cancellation | `stripe.paymentIntents.cancel()` |
| 894 | **Payment intent creation** (the cycle-contribution path) | `stripe.paymentIntents.create()` |
| 1005 | Transfer reversal | `stripe.transfers.createReversal()` |
| 1019 | **Transfer creation** (Section G) | `stripe.transfers.create()` |
| 1026 | (alternate payout create — duplicate marker) | `stripe.payouts.create()` |
| 1187 | ContributionProcessingService trigger (orchestration) | n/a (just dead code) |
| 1386 | Webhook signature verification | `stripe.webhooks.constructEvent()` |
| 1465 | Dispute evidence submission | `stripe.disputes.update()` |
| 1523 | KYC capability update | `stripe.accounts.update()` |
| 1605 | Connected account update | `stripe.accounts.update()` |

**Bold** = on the main contribute → payout cycle path. The bold rows are the blockers.

### `supabase/functions/process-bank-payouts/index.ts`

| Line | What's stubbed |
|---|---|
| 17 | `// TODO: Replace with actual Stripe/Flutterwave implementations` |
| 32 | `initiateStripeTransfer` — STUB, returns fake `stripe_${Date.now()}_...` |
| 51 | `initiateFlutterwaveTransfer` — STUB, returns fake `flw_*` |
| 69 | `initiateMobileMoneyTransfer` — STUB, returns fake `momo_*` |
| 252 | `'mpesa', // TODO: Get from user preferences` — hardcoded provider |

### `supabase/functions/cycle-progression-cron/index.ts`

| Line | Issue |
|---|---|
| 163 | Calls `execute_cycle_payout` RPC — **RPC does not exist in DB**; silently falls back to `status='payout_pending'` |

### Postgres functions

| Expected | Status |
|---|---|
| `public.execute_cycle_payout(p_cycle_id uuid)` | ❌ Missing — cycle-progression-cron's primary handoff doesn't exist |

### Deployed Edge Functions missing from local source

Four functions are deployed on Supabase but have **no local source code** in `supabase/functions/`:
- `process-loan-payment` (v3, deployed Jan 27)
- `process-contribution` (v3, deployed Jan 27)
- `send-notification` (v3, deployed Jan 27)
- `webhooks_psp` (v3, deployed Jan 27)

These predate this repo's current commit history. Worth fetching with `supabase functions download <name>` to see if any are doing real payment work that local code doesn't reflect. **Possible parallel reality** — flag for investigation.

---

## The 3 `TODO(elder-payouts)` markers — NOT on this path

`context/ElderContext.tsx` lines 1151, 1259, 1360 — confirmed. Each follows the same template:

```typescript
// TODO(elder-payouts): When Stripe Connect onboarding ships,
// wire a USD payout here for the Elder action that previously
// awarded tokens. See Elder Economy spec: paid expertise
```

| Line | Elder action | Replaces what |
|---|---|---|
| 1151 | Vouching | Token reward |
| 1259 | Dispute resolution | Token reward |
| 1360 | Course completion | Token reward |

These are **Elder-economy rewards** — USD payouts to elders for activities they perform. They sit on a **parallel** path to the circle contribution → cycle payout flow. They share the underlying Connect onboarding step (Stage 1), so they're blocked by the same upstream stub, but they're not on the main money-pool-to-recipient path.

Conclusion: fixing the Elder TODOs requires Stage 1 (onboarding) to be real, plus a separate "elder reward" payout codepath. They are out of scope for proving a contribute → payout cycle works.

---

## "If I create two test users and run one cycle, what breaks first?"

Honest sequence of walls, assuming you start at the top of the flow:

| Order | Wall | What you'll see |
|---|---|---|
| 1 | **Onboarding link is a fake URL** (`stripe.accountLinks.create` is stubbed at L656) | User taps "Set up payouts" → browser opens `https://connect.stripe.com/setup/e/test_1747...` → **404 Page Not Found**. No `Account` object exists on Stripe. |
| 2 | If you bypass #1 by manually creating a Stripe Connect account in the dashboard and forging a `stripe_connected_accounts` row with the real `acct_...` ID, the **contribution PI is mocked** (L894) | User taps "Contribute" → `circle_contributions` row inserted with `status='paid'` but no Stripe charge fires. No row in `stripe_payment_intents`. No money on the platform's Stripe balance to pay out from later. |
| 3 | If you bypass #2 by using the new Path A `create-payment-intent` Edge Function to charge real test cards, **`execute_cycle_payout` RPC doesn't exist** | When `cycle-progression-cron` fires hourly, the cycle reaches `ready_payout`, then the RPC call returns "RPC not found," and the cycle gets stuck in `payout_pending`. Nothing automatic picks it up. |
| 4 | If you bypass #3 by manually inserting a `payout_executions` row to trigger `process-bank-payouts`, **the bank transfer function is stubbed** (L26-41 of `process-bank-payouts`) | Cron runs at 08:00 UTC, logs "💳 STRIPE: Transfer $X USD to acct_xxx", marks the payout `completed`, generates a fake `stripe_xxxxxx_xxx` transaction ID. **No `stripe.transfers.create` call. No money leaves your platform balance.** |
| 5 | (If you somehow got past #4, the `StripeConnectEngine.createTransfer` path on line 931 has its own separate `_createStripeTransfer` stub at L1019 that also doesn't call Stripe.) | Symmetric to #4. |

**You hit wall #1 before you can even attempt #2.** The earliest place to start fixing things is `_createStripeExpressAccount` (L638) + `_generateAccountLink` (L655) in `StripeConnectEngine.ts` — those would need to be ported to either a new Edge Function (the Path A pattern) or to a real server-side runtime that has the Stripe Node SDK installed.

---

## Minimum work to get one full test-mode cycle through

Listed in dependency order. **Not proposing this work** — just sizing it for you.

1. **Connect onboarding Edge Function** (~150 LoC). New EF `create-connect-account` that calls `stripe.accounts.create({ type: 'express', ... })` + `stripe.accountLinks.create(...)`. Mirror the Path A pattern (`create-payment-intent` is the template). Replace the two L638/L655 stubs to call this EF instead.
2. **Real contribution PaymentIntent path** (~50 LoC). Route `PaymentContext.createContribution` and/or `CirclesContext.makeContribution` through the existing `create-payment-intent` EF (purpose='contribution', not 'wallet_deposit'). The EF already exists; it just needs a different purpose value and a circle_id parameter.
3. **`execute_cycle_payout` Postgres function** OR **a new `execute-cycle-payout` Edge Function**. ~80 LoC SQL or ~120 LoC TS. Reads the cycle's contributions, computes net amount after platform fee, inserts a `payout_executions` row, transitions cycle status. (Probably easier as an EF that calls a Postgres helper.)
4. **Real Stripe transfer in `process-bank-payouts`** (~60 LoC). Replace `initiateStripeTransfer` stub at L26 with a real `stripe.transfers.create({ destination: connected_account_id, amount, currency })`. Needs `STRIPE_SECRET_KEY` env var (already set per Path A).
5. **Webhook handlers for new event types** (~50 LoC each). `account.updated` (onboarding status changes), `transfer.created` / `transfer.failed` (payout outcome). Extend existing `stripe-webhook` EF — its idempotency + signature verification is already correct.
6. **`stripe_connected_accounts` member_id NOT NULL FK** — confirm the FK works when an account is created server-side. (Currently the table has 16 columns and looks complete; only the contents are fake.)

Rough estimate: **2-3 focused days of work** to land a real, observable cycle in Stripe test mode, assuming you keep KYC enforcement deferred (test-mode Express accounts can skip it).

---

## Confidence

- **DB state findings** (row counts, RPC absence, table schemas) — high, queried live via Management API.
- **Code-path tracing** — high, all files read in full or in directly relevant chunks.
- **Four-functions-missing-locally finding** — high, cross-referenced deployed `functions list` against local `supabase/functions/`. Recommend `supabase functions download` to investigate.
- **Estimated effort** — medium. Could easily slip to 5 days if KYC, webhooks, or onboarding redirects misbehave on first contact.

---

_Generated 2026-05-21. Read-only — no code or schema changes. References: `services/StripeConnectEngine.ts`, `supabase/functions/{process-bank-payouts,cycle-progression-cron}/index.ts`, `hooks/useStripePayments.ts`, `context/ElderContext.tsx` (lines 1151, 1259, 1360)._
