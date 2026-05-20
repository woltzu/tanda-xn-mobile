# Payment Blockers — Diagnostic Checklist

**Question:** with KYC + Stripe schema fully applied (per Phase 1), what's actually
blocking a real payment from working end-to-end?

**Answer:** the schema is just one layer. Walking from data → code → config → UI,
there's a clear primary blocker (service code is all stubs) plus a few config gaps.

This doc lists every diagnostic — pre-run results where I could, manual checks
where you need to. **No code, config, or schema changed.** Read-only.

---

## TL;DR — the primary blocker

`services/StripeConnectEngine.ts` is **1,953 lines of code with every actual
Stripe SDK call replaced by a TODO stub returning mock data.** Quoting line 20
of the file directly:

> _"All Stripe SDK calls are stubbed with TODO placeholders returning realistic
> mock data so the system works end-to-end before stripe-node is installed."_

So at runtime:
- A user can "create a Stripe customer" → a fake `stripe_customer_id` lands in `stripe_customers` (5 such test rows exist).
- A user can "create a Stripe Connect account" → ALSO stubbed → no real Stripe account opens.
- A user can "save a payment method" → stubbed → no Stripe payment method exists.
- A user can "make a payment" → stubbed → no charge happens on the Stripe side.

That's why `stripe_payment_intents` = 0 rows and `stripe_webhook_events` = 0 rows in production. **No real payment has ever been initiated** — only mock writes to the local DB.

Secondary blockers (covered below): `STRIPE_WEBHOOK_SECRET` is empty, no Stripe secrets in the Supabase Edge Functions environment, and no Stripe-specific webhook handler is deployed.

---

## Layer 1: Database state ✅ (I already ran)

| Table | Rows | Reading |
|---|---|---|
| `stripe_connected_accounts` | **0** | No user has ever begun Stripe Connect onboarding — no merchant accounts exist |
| `stripe_customers` | **5** | 5 stubbed customer records (matches the StripeConnectEngine stub behaviour) |
| `stripe_payment_methods` | **0** | No card / bank / wallet has been saved |
| `user_payment_methods` | **0** | App's own payment-method table also empty |
| `stripe_payment_intents` | **0** | **No payment has ever been attempted** |
| `stripe_webhook_events` | **0** | **No Stripe webhook has ever fired** at our endpoint |
| `kyc_verifications` | **0** | No user has begun KYC (a likely pre-requisite for payment) |
| `profiles` | **6** | Total app users (dev/test scale) |

**Verdict:** Schema is correct, but absence of activity confirms no real payment flow has ever completed. This is consistent with the code being stubbed.

---

## Layer 2: Service code ❌ (I already inspected)

`services/StripeConnectEngine.ts`:
- 1,953 lines
- 14+ explicit `// TODO: Replace with real Stripe SDK call` markers
- Notable stubs:
  - Line 503: TODO: Call Stripe API to update customer email
  - Line 522: TODO: Replace with real Stripe SDK call (probably `accounts.create`)
  - Line 639/656: same pattern (payment methods)
  - Line 867/903/1005/1026: cancel / refund / update flows
  - Line 1386: **TODO: Replace with real Stripe signature verification** (webhook security)
  - Line 1465: TODO: Submit evidence to Stripe (disputes)
  - Line 1523/1605: payout / connected account updates

**Verdict:** This is the #1 thing to fix. Until at least the customer creation, Connect onboarding, payment intent creation, and webhook verification are real, no money will move.

---

## Layer 3: Edge functions ⚠️ (I already inspected)

Deployed functions visible via `supabase functions list`:

| Function | Updated | Stripe-related? |
|---|---|---|
| `webhooks_psp` | 2026-01-27 | Possibly — but its source isn't in current repo (`supabase/functions/webhooks_psp/` doesn't exist). Deployed from the abandoned `Supabase/` folder. |
| `process-contribution`, `process-loan-payment` | 2026-01-27 | Old design (abandoned backend) |
| `process-autopay`, `daily-interest-accrual`, `send-payment-reminders`, etc. | 2026-02-14+ | Newer — periodic jobs, not Stripe-receiving |
| `api-webhook-dispatcher`, `webhook-retry-processor` | recent | App's internal webhook plumbing |

**Verdict:** **There is no `stripe-webhook` or `stripe-payment-intent` Edge Function deployed.** The Jan-27 `webhooks_psp` is leftover from the abandoned backend scaffold (we already archived its sibling migrations). It might be intercepting Stripe events if the dashboard points there — but no events have arrived (0 rows in `stripe_webhook_events`), so either the dashboard webhook isn't configured OR `webhooks_psp` doesn't write to that table.

---

## Layer 4: Environment vars ⚠️ (I already inspected)

**Mobile app — `tanda-xn-mobile/.env.local`:**
```
STRIPE_PUBLISHABLE_KEY=pk_test_51TEzlc...u4oo5H        ✅ set (TEST mode)
STRIPE_SECRET_KEY=sk_test_51TEzlc...4cg6Qs             ✅ set (TEST mode)
STRIPE_WEBHOOK_SECRET=                                  ❌ EMPTY
STRIPE_ACCOUNT_ID=acct_1TEzlc0J4hVutKjs                ✅ set (platform account, test)
```

**Supabase Edge Function secrets (via `supabase secrets list`):**
```
SENDGRID_API_KEY              ✅
SUPABASE_ANON_KEY             ✅
SUPABASE_DB_URL               ✅
SUPABASE_SERVICE_ROLE_KEY     ✅
SUPABASE_URL                  ✅
TWILIO_ACCOUNT_SID            ✅
TWILIO_AUTH_TOKEN             ✅
STRIPE_SECRET_KEY             ❌ NOT SET
STRIPE_WEBHOOK_SECRET         ❌ NOT SET
STRIPE_PUBLISHABLE_KEY        ❌ NOT SET
```

**Verdict:** Even if the Edge Functions had Stripe code, they have no Stripe credentials. The mobile app has test-mode keys but no webhook secret, so server-side webhook signature verification will fail (which is why the StripeConnectEngine line 1386 marks signature verification as TODO).

---

## Layer 5: App wiring ⚠️ (I already inspected)

`context/PaymentContext.tsx`:
- Imports `@stripe/stripe-react-native` (native-only; stubbed on web)
- Hardcodes a fallback `pk_test_*` publishable key (matches `.env.local`)
- Imports `StripeConnectEngine` for server-side ops (which is all stubbed)
- Exposes `confirmPayment`, `initPaymentSheet`, `presentPaymentSheet`
- **`PaymentProvider` IS in `App.tsx`'s provider tree** (line ~882)

`App.tsx`:
- Zero direct `Stripe` imports
- Relies entirely on `PaymentContext` for Stripe interaction

**Verdict:** App-level wiring is in place. When the service stubs get replaced with real SDK calls, the UI should connect through. The PaymentSheet flow (Apple Pay / Google Pay / card entry) is plumbed.

---

## Layer 6: Stripe Dashboard ❓ (MANUAL — you must check)

You can verify these at https://dashboard.stripe.com/test (or `/live`):

### 6a. API mode
- **Question:** are the `pk_test_*` / `sk_test_*` keys in `.env.local` from the TEST mode of the dashboard, or have you flipped to live mode?
- **Check:** open the dashboard, look at the toggle in the top-right (`Test mode` vs `Live mode`). Then `Developers → API keys` and confirm the test publishable key matches.
- **Verdict matters:** test-mode keys won't move real money. To launch, you need `pk_live_*` and `sk_live_*` — and you cannot get live keys until your Stripe account is approved (KYC for the platform).

### 6b. Webhook endpoint configuration
- **Question:** is a webhook endpoint configured to receive Stripe events, and where does it point?
- **Check:** `Developers → Webhooks → Endpoints`. Look for an HTTPS URL pointing at one of your Supabase Edge Functions (e.g., `https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/webhooks_psp` or a new `stripe-webhook` function).
- **Verdict matters:** if none configured, Stripe will never call back when a payment succeeds/fails. The DB will never know.

### 6c. Webhook signing secret
- **Question:** what's the secret? It must match what the receiving Edge Function uses to verify event signatures.
- **Check:** on the webhook endpoint's detail page, click "Reveal" next to "Signing secret". It looks like `whsec_xxxxxxx`.
- **Verdict matters:** if `STRIPE_WEBHOOK_SECRET` is empty (it is) or wrong, every incoming webhook will fail signature verification.

### 6d. Subscribed events
- **Question:** which events does Stripe forward to us?
- **Check:** webhook endpoint detail → "Events". For TandaXn's use case you want at minimum:
  - `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
  - `charge.succeeded`, `charge.failed`, `charge.refunded`
  - `payment_method.attached`, `payment_method.detached`
  - `customer.updated`, `customer.deleted`
  - Connect: `account.updated`, `account.application.deauthorized`
  - Payouts: `payout.paid`, `payout.failed`
  - Disputes: `charge.dispute.created`, `charge.dispute.closed`
- **Verdict matters:** missing event subscriptions = silent failures.

### 6e. Stripe Connect platform setup
- **Question:** is the Stripe account configured as a Connect platform (required to onboard users as connected accounts)?
- **Check:** `Settings → Connect settings → Platform settings`. Required: business profile, branding, support contact, terms.
- **Verdict matters:** without platform setup, `stripe.accounts.create({type: 'express'})` fails.

### 6f. Apple Pay / Google Pay setup
- **Question:** are Apple Pay and Google Pay enabled at the Stripe platform level for the connected accounts?
- **Check:** `Payment methods` settings in dashboard.
- **Verdict matters:** the PaymentSheet shows Apple/Google Pay only if enabled here AND on the device.

---

## Layer 7: Manual code verification (you can grep — quick)

```bash
# In tanda-xn-mobile/

# 1. How many "TODO: Replace with real Stripe SDK call" markers remain?
grep -c "TODO.*real Stripe" services/StripeConnectEngine.ts

# 2. Is stripe-node (server SDK) installed?
grep '"stripe"' package.json

# 3. Is the PaymentContext actually used by any contribution screen?
grep -rn "usePayment\|PaymentContext" screens/ | head

# 4. Are there any "TODO(elder-payouts)" stubs from the May 17 commit?
grep -rn "TODO(elder-payouts)" context/ services/
```

**Expected current results:**
- `grep -c TODO`: should show 14+ (the stubs)
- `"stripe"` in package.json: probably **absent** (only `@stripe/stripe-react-native` is installed — for the client-side PaymentSheet — not `stripe`, the server SDK). This is what the file header was hinting at.
- `usePayment` references: probably present in `WAL-201..204-AddFunds*` and contribution screens
- `TODO(elder-payouts)`: 3 hits expected per CLAUDE.md

---

## Layer 8: Runtime checks (you must do on device)

Once Layers 1-7 above are remediated, the final smoke test is:

1. On a real device (iOS or Android, NOT web — Stripe RN is native-only): trigger a "Make Contribution" or "Add Funds" flow.
2. Watch the JS console + native logs for any Stripe error.
3. Watch the `stripe_payment_intents` table: a row should appear with status `requires_payment_method` → `requires_confirmation` → `succeeded`.
4. Watch the `stripe_webhook_events` table: should receive `payment_intent.created` then `payment_intent.succeeded`.
5. Watch the `circle_contributions` (or `contributions`) table: should receive a new row credited to the user/circle/cycle.

If any step doesn't produce its expected row, that's where the next bug lives.

---

## Priority-ordered list of blockers

Counting down from the most-blocking to least:

| # | Blocker | Where | Effort |
|---|---------|-------|--------|
| 1 | Stripe service code is all stubs | `services/StripeConnectEngine.ts` 14+ TODOs | **High** — install `stripe` server SDK, wire 8-10 critical SDK calls (`customers.create`, `accounts.create`, `paymentIntents.create`, `webhooks.constructEvent`, etc.) |
| 2 | `STRIPE_WEBHOOK_SECRET` is empty | `.env.local` | **Low** — copy from Stripe dashboard once the webhook endpoint is configured |
| 3 | No Stripe secrets in Edge Functions env | `supabase secrets set …` | **Low** — `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...` |
| 4 | No `stripe-webhook` Edge Function deployed | `supabase/functions/` | **Medium** — add a function that receives Stripe events, verifies signature, writes to `stripe_webhook_events`, dispatches to the right handler |
| 5 | Webhook endpoint may not be configured in Stripe dashboard | dashboard.stripe.com | **Low** — once Edge Function URL exists, add it in dashboard |
| 6 | Stripe Connect platform settings | dashboard.stripe.com | **Low/Medium** — fill out platform profile, branding, terms |
| 7 | No KYC has ever been completed | `kyc_verifications` | **Medium** — Persona SDK needs to actually invoke a real flow; check Persona dashboard |
| 8 | Test mode → live mode keys (final step) | `.env.local` + dashboard | **Low** — done last, after end-to-end test mode succeeds |

---

## Minimum viable cut list (just enough to receive ONE test payment)

In strict order, just to see a `payment_intent.succeeded` for a test card:

1. **Install `stripe` server SDK** — `npm install stripe` in either the mobile repo (for Edge Function bundling) or in a fresh Edge Function workspace
2. **Replace stubs in `StripeConnectEngine.ts` Section F (Payment Intents)** — just the `createPaymentIntent` and `confirmPaymentIntent` SDK calls
3. **Deploy a `stripe-webhook` Edge Function** — with signature verification using `STRIPE_WEBHOOK_SECRET`
4. **Configure the webhook endpoint at Stripe dashboard** → `https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/stripe-webhook`
5. **Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` via `supabase secrets set`** for the Edge Function
6. **Copy `STRIPE_WEBHOOK_SECRET` into `.env.local`** so any client-side verification works
7. **Smoke test from a real device** with test card `4242 4242 4242 4242`

This minimal set leaves Connect onboarding, KYC, Apple Pay, payouts, refunds, disputes for later. Get to "I can charge a card and see the row land" first.

---

## Stripe Connect onboarding ≠ blocker for first payment

A small clarification: **Connect onboarding is for users RECEIVING payouts** (e.g., elders getting paid for mediation, providers in the marketplace). Direct contributions where the user PAYS the platform don't strictly require Connect — the user just needs a Stripe payment method.

So `stripe_connected_accounts = 0` is fine for first-payment testing. You only need Connect once you want to PAY OUT to a specific user (vs. crediting the circle pool which is internal).

---

## Recommendation

Before any code changes, **decide the scope**:

- **A.** "I just want to prove one card charge works end-to-end in test mode" — do the Minimum Viable Cut List above. ~1 day of work.
- **B.** "I want the full payment loop: contributions in, payouts out, Connect for elders/providers, KYC enforcement" — multi-week project. Each TODO in `StripeConnectEngine.ts` is a real method.
- **C.** "Pause Stripe work, focus on something else first" — fine. Schema is ready when you come back.

---

_Read-only diagnostic. No code, schema, secrets, or dashboard configuration changed._
