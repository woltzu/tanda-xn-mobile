# 33 — Currency Picker & Payment Button Bugs

**Status:** Diagnosed (read-only). No fixes applied. Reported by tester on 2026-05-26.
**Three bugs in scope:** Bug B (priority — Stage 1 Connect health), Bug A (Currency picker), Bug C (Add Card stub).

---

## Bug B — "Link a Bank" → Edge Function returns non-2xx

**Priority:** Highest — this tells you whether the Stage 1 Connect function is healthy.

### What the button does

`screens/LinkedAccountsScreen.tsx:36-45`:
```ts
const handleAddBank = async () => {
  try {
    const onboardingUrl = await setupConnectedAccount("tandaxn://linked-accounts");
    if (onboardingUrl) {
      await Linking.openURL(onboardingUrl);
    }
  } catch (err: any) {
    Alert.alert("Error", err.message || "Failed to start bank account setup.");
  }
};
```

Wired to **four** UI surfaces in `LinkedAccountsScreen` (lines 121, 149, 233, plus the Add Funds banner): the onboarding banner, the bank-accounts section header `+ Add Bank` button, the empty-state `Link a Bank` button, and the linked banner. They all call the same handler.

### Where `setupConnectedAccount` calls

`context/PaymentContext.tsx:301-338`:
```ts
const setupConnectedAccount = useCallback(async (returnUrl: string): Promise<string> => {
  // Stage 1: routes through the create-connect-account Edge Function
  if (!user) throw new Error('User not authenticated');
  try {
    const { data, error } = await supabase.functions.invoke('create-connect-account', {
      body: {},
    });
    if (error) {
      throw new Error(error.message || 'Failed to start Connect onboarding');
    }
    ...
```

**Confirmed: the button invokes your Stage 1 `create-connect-account` Edge Function directly.** No mock fallback, no alternate code path. The "Edge Function returned a non-2xx status code" error from your earlier P3 report is this exact function.

### What the Edge Function does (source: `supabase/functions/create-connect-account/index.ts`)

The function is well-structured. It has exactly **eight** failure modes, each returning a non-2xx with a specific error message:

| Step | Failure | Status | Likely cause |
|---|---|---|---|
| 1 | Method not `POST` | 405 | Client misconfig (rare — supabase.functions.invoke uses POST) |
| 2 | Missing `Authorization` header | 401 | JWT not attached — supabase-js usually injects it; possible if user session expired mid-call |
| 3 | JWT can't be exchanged for user | 401 | Token expired / revoked — same fix |
| 4 | User has no email | 400 | Edge case — magic-link users without email? unlikely |
| 5 | `stripe_connected_accounts` lookup fails | 500 | DB connectivity issue or RLS denying service role (shouldn't happen with service_role key) |
| 6 | `stripe.accounts.create(...)` fails | 502 | Stripe API rejected — most common reasons: invalid country code, missing capabilities, Stripe account suspended, **STRIPE_SECRET_KEY missing or test-mode/live-mode mismatch** |
| 7 | DB `INSERT` fails | 500 | Schema mismatch — column doesn't exist, CHECK constraint violated. Function writes `account_type='express'`, `onboarding_status='pending'`, plus 5 bool/string fields. |
| 8 | `stripe.accountLinks.create(...)` fails | 502 | Stripe API rejected — usually because the account isn't in a state that allows links yet |

The function uses `Deno.env.get("STRIPE_SECRET_KEY")!`, `Deno.env.get("SUPABASE_URL")!`, and `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!`. The `!` means if any of these are missing, the function crashes on boot with `TypeError: Deno.env.get(...) is undefined` — Supabase surfaces that as a generic 500 with no body, which matches the "non-2xx" symptom *and* would happen on every invocation (not intermittent).

### My ranked guesses, from most to least likely

1. **`STRIPE_SECRET_KEY` is not set in the Edge Function's secrets** — or it's set in one env (e.g., the project's general secrets) but not in the per-function secrets. The single most common Stripe-on-Supabase error. CLAUDE.md says you re-deployed `stripe-webhook` and `create-payment-intent` after a previous secret change but doesn't mention `create-connect-account`. **If the secret wasn't propagated to this function, this is your bug.**
2. **The function was never deployed** — file exists at `supabase/functions/create-connect-account/index.ts` but `supabase functions deploy create-connect-account` was never run. Calls to invoke it would fail with a 404 (not 2xx). Easy to check: `supabase functions list`.
3. **STRIPE_SECRET_KEY is set but is the wrong mode** — e.g., live key with a test request, or test key against live data. Stripe returns 4xx with a clear message; the function passes it through as 502.
4. **Country code resolution failure** — for a user whose `profiles.country` is empty or invalid, the function falls back to `'US'`. If the user IS in West Africa and `profiles.country` is `'CI'` (Ivory Coast) or `'SN'` (Senegal), Stripe Express may not support those countries for Connect — check Stripe's [supported-country list](https://stripe.com/docs/connect/cross-border-payouts) for Express + transfers capability.
5. **Schema mismatch on `stripe_connected_accounts` INSERT** — function writes `account_type='express'`. Check if the live table has a CHECK constraint on `account_type` that doesn't allow `'express'`.

### How to pull the logs

Two paths. **Pick whichever your CLI is set up for.**

**Path 1 — Supabase CLI (preferred, gives you tail/follow):**

```bash
# In the tanda-xn-mobile repo root:
supabase functions logs create-connect-account --project-ref fjqdkyjkwqeoafwvnjgv

# For real-time tail while you tap the button on device:
supabase functions logs create-connect-account --project-ref fjqdkyjkwqeoafwvnjgv --tail
```

(Requires `supabase login` first if not already authenticated; uses `SUPABASE_ACCESS_TOKEN` or the OAuth flow.)

**Path 2 — Supabase Dashboard:**

1. https://supabase.com/dashboard/project/fjqdkyjkwqeoafwvnjgv/functions
2. Click `create-connect-account` in the function list
3. **Logs** tab — shows recent invocations with stdout/stderr from the `console.log` / `console.error` calls inside the function.

### What to look for in the logs

The function logs these specific strings on error (in `console.error(...)`):
- `"[create-connect-account] lookup failed:"` — step 5 (DB lookup)
- `"[create-connect-account] stripe.accounts.create failed:"` — step 6 (Stripe API)
- `"[create-connect-account] DB insert failed for account"` — step 7 (DB insert)
- `"[create-connect-account] stripe.accountLinks.create failed:"` — step 8 (Stripe API)

If you see **none of these** but the function still 5xxs, that's hypothesis #1 (env var missing — function crashes before any `console.error` runs). If you see one of them, the message after the colon tells you exactly what failed.

### What I'm NOT recommending

- Don't add try/catch around the secret reads — the early crash is actually useful diagnostic signal.
- Don't add retry logic at the client. If the function is genuinely broken, retrying just hides the diagnostic information.
- Don't bypass the Edge Function back to a mock (`StripeConnectEngine`) — the user explicitly chose to route through the real EF; reverting to mock would silently regress your Stage 1 work.

---

## Bug A — Add Currency Wallet "only offers CAD"

**Priority:** Medium. The data and code look correct; this may be a UX confusion rather than a data bug. Worth a screenshot before committing to a fix.

### What I found

The full multi-currency catalog **does exist** and **is referenced by the picker**:

**`components/CurrencySelector.tsx:12`** imports:
```ts
import { useCurrency, CURRENCIES, CURRENCY_REGIONS } from "../context/CurrencyContext";
```

**`context/CurrencyContext.tsx:14-50`** defines `CURRENCIES` as a map of ~20 currencies including XOF, NGN, EUR, GBP, KES, CAD, etc. — every Francophone-West-Africa currency is present with name, symbol, region, flag, and decimals.

**`context/CurrencyContext.tsx:102-110`** defines `CURRENCY_REGIONS` covering 7 regions:
```ts
"North America": ["USD", "CAD", "MXN"],
"Europe": ["EUR", "GBP", "CHF"],
"West Africa": ["XOF", "NGN", "GHS", "GMD", "SLL", "LRD", "GNF"],
"Central Africa": ["XAF"],
"East Africa": ["KES", "TZS", "UGX", "RWF", "BIF", "ETB"],
"Southern Africa": ["ZAR", "ZMW", "MWK", "BWP"],
"Caribbean": ["JMD", "TTD", "BBD", "HTG", "DOP", "XCD"],
```

XOF and NGN are right there in "West Africa." EUR is in "Europe."

**`components/CurrencySelector.tsx:45-50`** filters by `searchQuery`:
```ts
const filteredCurrencies = Object.values(CURRENCIES).filter(
  (c) =>
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.region.toLowerCase().includes(searchQuery.toLowerCase())
);
```
With default `searchQuery === ""`, every currency matches (`.includes("")` is always true). The grouping at lines 53-64 then organizes by region; lines 206-222 render every region with > 0 matching currencies.

**The picker code is correct and the data is correct. The "only CAD" symptom is not in the picker logic itself.**

### What I think you actually saw

Two competing hypotheses:

**Hypothesis 1 (most likely): you saw the SELECTOR BUTTON, not the picker list.**

`WalletScreen.tsx:470-474` invokes `<CurrencySelector>` in **non-compact mode** (no `compact` prop). In non-compact mode, the component renders as a tappable **button** that shows the currently-selected currency's flag + code + name, with a chevron-down icon at the right edge (`CurrencySelector.tsx:95-118`). The full list is *behind* that button — you tap it, an internal modal opens, and **then** you see all the currencies grouped by region.

If you opened the Wallet Screen's "Add Currency Wallet" modal and looked at the button without tapping it, you would see exactly one currency — whatever's currently selected. The chevron-down does suggest "dropdown," but it requires a tap to expand.

The reason it might show CAD specifically (the default in `WalletScreen.tsx:32` is `"NGN"`, not `"CAD"`): I can't reproduce a code path that defaults to CAD. Possibilities:
- A previous tap during the session set it to CAD and the component didn't fully reset.
- Cached state from a hot-reload during development.
- You looked at a different screen with a different default — e.g., AddFunds or a payment-method context where CAD was historically the default.

**Hypothesis 2 (less likely but possible): there's a different picker somewhere with a hardcoded list.**

I grepped for `selectedNewCurrency`, `"CAD"`, `'CAD'`, `Add Currency`, and `addCurrencyWallet` across `screens/`, `components/`, `context/`, `services/`, `hooks/`. The only matches were `WalletContext.tsx`, `WalletScreen.tsx`, and `CurrencyContext.tsx` — none contain a CAD-only list. But it's possible an older deployed bundle (the Vercel web build, last bundled before the recent commits) has a different version of this code.

### Recommended next step (read-only)

**Screenshot the actual "Add Currency Wallet" UI as you saw it.** That will tell us in 5 seconds whether:
- (a) You saw the selector button (Hypothesis 1) — the fix is just better UI affordance to suggest "tap to expand."
- (b) You saw a modal with a list that legitimately contains only CAD (Hypothesis 2) — that points at a screen I haven't found and we'd dig into it.

### Fix options once confirmed

**If Hypothesis 1 (selector button confusion):**
- **(a)** Auto-open the internal picker modal the first time the "Add Currency Wallet" outer modal opens. Skips the "tap one more time" step.
- **(b)** Replace the non-compact selector with a flat list (no internal modal at all), so the full currency list is visible immediately.
- **(c)** Add a hint like "Tap to choose a currency" below the button.

**If Hypothesis 2 (different picker with hardcoded list):**
- We find the file and fix the list to source from `CURRENCIES` / `CURRENCY_REGIONS`.

**Additional consideration regardless of which hypothesis:** the default value `selectedNewCurrency = "NGN"` in `WalletScreen.tsx:32` is good for a Nigerian user but irrelevant for a Senegalese/Ivorian Francophone user. Consider:
- Defaulting to the user's `primaryCurrency` from `CurrencyContext` (which can be set based on origin country in PreferencesContext) — would default to XOF for a user from CI/SN/etc.
- Or just defaulting to `USD` (the most common starting point).

---

## Bug C — "Add a Card" button

**Priority:** Lowest. Confirmed as a stub, no code change needed unless you want to remove the button.

`screens/LinkedAccountsScreen.tsx:47-53`:
```ts
const handleAddCard = () => {
  Alert.alert(
    "Add Card",
    "Card collection coming soon — use Add Funds to save a card.",
    [{ text: "OK" }]
  );
};
```

Wired to the section header `+ Add Card` button (line 245-247) and the empty-state `Add a Card` button (line 327-331). Both show the same Alert: "Card collection coming soon — use Add Funds to save a card."

Not broken — it's a deliberate "coming soon" stub, with a workaround pointer to `AddFunds`. The button is honest about its state.

### Fix options

- **(a) Leave it as is.** The Alert is clear and points to a working workaround.
- **(b) Hide the button entirely until the feature ships.** Less misleading than a button that pops a "coming soon" alert.
- **(c) Build real card collection on top of `StripeConnectEngine.addPaymentMethod`** (which already exists per `PaymentContext.tsx:342-353`). The Stripe React Native SDK has card-collection UIs available. Real work, not tonight.

---

## Bug P2 — Add Funds: mock engine + `stripe_payment_intents.client_secret` schema miss

**Status:** Confirmed reproducible on device (2026-05-26, Metro terminal capture). **NOT fixed** in this investigation — entangled with Stage 2 (the real contribution flow replaces this mock path anyway).

### What the tester saw

Live Metro log when tapping Add Funds on device:

```
[StripeConnectEngine] Mock: Created PI pi_test_... for 10000 usd
ERROR Error adding funds: Failed to create payment intent record:
  Could not find the 'client_secret' column of 'stripe_payment_intents'
  in the schema cache
```

Two stacked problems in one tap:

### Problem 1 — Add Funds is still routed through the MOCK engine

The `[StripeConnectEngine] Mock: Created PI ...` log line is emitted by `StripeConnectEngine` (the in-process mock), not by the `create-payment-intent` Edge Function. So even though `PaymentContext.tsx:504-507` calls the real EF for Connect's setupConnectedAccount path (Bug B above), the Add Funds path is still on the stub.

This is consistent with the comment in `PaymentContext.tsx:302-305` from the Bug B trace:
> "Stage 1: routes through the create-connect-account Edge Function (bypassing StripeConnectEngine's stubs)..."

Stage 1's bypass was *only* for the connect-account path, by design. The other StripeConnectEngine mocks (PI creation, payment-method save, transfers, payouts) are still active and will be replaced by Stage 2 / Stage 3 / Stage 4 in turn.

### Problem 2 — `client_secret` column missing from `stripe_payment_intents`

After the mock PI is "created" in-memory, the code tries to write a row to `stripe_payment_intents` and Postgres rejects:

> `Could not find the 'client_secret' column of 'stripe_payment_intents' in the schema cache`

This is a Supabase-client-side error from `postgrest-js` — it inspects its cached OpenAPI schema for the target table, doesn't find a column named `client_secret`, and refuses to send the INSERT before it even hits Postgres. Two possible meanings:

1. **The column genuinely doesn't exist on the live table.** Cross-check against `docs/audit/11_live_schema_dump.sql:7391-7427` for `stripe_payment_intents` to confirm. If it isn't there, the mock engine is writing to a column that's missing from the deployed schema — either the column was never added or was dropped.
2. **The column exists but the schema cache is stale.** PostgREST refreshes on schema-change events but can fall behind. Less likely; usually self-heals within seconds.

(1) is the working theory because Stage 2 work will define a real `client_secret` column anyway as part of the payment-intent persistence model.

### Why we're not fixing this now

- **Mock-engine elimination is Stage 2's scope.** The whole `StripeConnectEngine` is meant to be retired as the real flows are wired through Edge Functions. Adding a `client_secret` column to satisfy the mock would be throw-away work — the table is going to be reshaped by Stage 2 either way.
- **No user-facing regression from this bug.** Add Funds via mock is a development-only path; production users will hit the real PI flow once Stage 2 lands.
- **Fixing piecemeal risks Stage 2 drift.** If a "hotfix" adds `client_secret` outside the Stage 2 plan, the Stage 2 design has to work around it. Better to absorb it into the Stage 2 schema design from the start.

### What this DOES change

- This is now a **confirmed-reproducible** entry in the Stage 2 prerequisite list, not a hypothetical. Whatever doc captures Stage 2 prep (likely `docs/audit/26_stage2_blocker_fake_autocredit.md` based on the filename, which is currently untracked in your working tree) should reference this reproduction as evidence that the mock-PI path actively breaks today.
- The 2nd surface of `StripeConnectEngine` still being mock (besides Add Funds) is the trip-payment flow (`TripPayment` screen → `StripeConnectEngine.createPaymentIntent`). Same root cause, same fix horizon — Stage 2 retires both together.

### Followup, when Stage 2 starts

1. Either remove the `client_secret` write from `StripeConnectEngine.createPaymentIntent` (since it's about to be replaced) **OR** add `client_secret` to `stripe_payment_intents` in the Stage 2 migration so the mock keeps working until cutover. Whichever Stage 2's design prefers.
2. Replace `StripeConnectEngine.createPaymentIntent` callers with `supabase.functions.invoke('create-payment-intent')` (already exists per `supabase/functions/create-payment-intent/`).
3. Confirm `stripe_payment_intents` schema matches what the real EF writes.

---

## Summary

| Bug | Status | Likely root cause | Action this session |
|---|---|---|---|
| **B** — Link a Bank non-2xx | Confirmed hitting Stage 1 `create-connect-account` EF | `STRIPE_SECRET_KEY` not propagated to the function's secrets, OR function not deployed, OR Stripe live/test-mode mismatch | Pull logs (instructions above) — that single check distinguishes between all 5 ranked hypotheses |
| **A** — Currency picker only CAD | Picker code + data look correct | Most likely UX confusion: the selector button shows one currency; user didn't tap it to expand. Need screenshot to confirm. | Screenshot, then we decide if it's a UX fix or a hidden-second-picker hunt |
| **C** — Add Card stub | Confirmed deliberate stub | Card collection feature not built yet | Optional: hide the button or leave the alert |
| **P2** — Add Funds: mock + schema miss | Confirmed reproducible (live Metro capture 2026-05-26) | Mock `StripeConnectEngine.createPaymentIntent` still active; writes to non-existent `client_secret` column on `stripe_payment_intents` | **None** — entangled with Stage 2; deferred to Stage 2 design |

---

## Links

- `screens/LinkedAccountsScreen.tsx:36-53` — both button handlers
- `context/PaymentContext.tsx:301-338` — `setupConnectedAccount`
- `supabase/functions/create-connect-account/index.ts` — the Stage 1 EF source (untracked in git per recent `git status`; worth committing per CLAUDE.md's "Migration conventions" lesson, though edge functions aren't migrations)
- `components/CurrencySelector.tsx` — the picker
- `context/CurrencyContext.tsx:14-110` — CURRENCIES + CURRENCY_REGIONS data
- `context/WalletContext.tsx:106-124` — CURRENCY_INFO (a second, smaller currency dict — duplicate of CURRENCIES; worth consolidating later)
- `docs/audit/24_stripe_connect_payout_path.md` — Stage 1 Stripe Connect overview
