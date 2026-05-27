# 33 — Currency Picker & Payment Button Bugs

**Status:** Diagnosed (read-only). No fixes applied. Reported by tester on 2026-05-26.
**Three bugs in scope:** Bug B (priority — Stage 1 Connect health), Bug A (Currency picker), Bug C (Add Card stub).

---

## Bug B — "Link a Bank" → Edge Function returns non-2xx — RESOLVED

**Status:** Resolved at diagnosis (2026-05-26). **No code change needed.** Stripe Connect was simply not enabled on the Stripe account.

### Resolution (from live dashboard logs after device tap)

Pulled the function's logs from the Supabase Dashboard (`Functions → create-connect-account → Logs`) while tapping "Link a Bank" on device. The function ran cleanly and Stripe rejected the `accounts.create` call with:

```
[create-connect-account] stripe.accounts.create failed: You can only create
new accounts if you've signed up for Connect, which you can do at
https://dashboard.stripe.com/connect
```

That maps to Hypothesis #3 in the original ranked list (Stripe-side rejection). The function boots, authenticates, looks up the existing row, resolves the country, and only then tries to create the Stripe account — at which point Stripe returns its standard "Connect not enabled on this account" error message. The function correctly surfaces this as a 502 (Stripe's failure, not the function's) per its own design.

### What this confirms about the Stage 1 function itself

- ✅ Deployed and reachable
- ✅ `STRIPE_SECRET_KEY` is set (the function reaches step 6 — if the secret were missing, it would never log that tag, it'd crash on boot)
- ✅ Auth path works (JWT validated, `getUser()` succeeded, user has email)
- ✅ `stripe_connected_accounts` table lookup works (step 5 passed cleanly)
- ✅ Error reporting works (the `console.error` tag came through)
- ✅ HTTP status mapping works (returned 502 as designed for Stripe-side failures)

The function is structurally healthy. The blocker was external.

### The one-time fix (dashboard-only, no code)

Enable Connect on the Stripe account that owns the `STRIPE_SECRET_KEY` Supabase secret:
1. https://dashboard.stripe.com/connect (in **test mode**, since `STRIPE_SECRET_KEY` is the test key per CLAUDE.md's Stripe section)
2. Click through Connect signup. This is a Stripe-side toggle, not a code or config change in this repo.
3. Once enabled, retry "Link a Bank" on device. The function should now reach step 6 successfully, create the Stripe Express account, write the row, and return an `onboardingUrl` for the device to open.

### Stage 1 has never actually completed end-to-end

This bug means every "Link a Bank" tap since the Stage 1 function was deployed has hit the Stripe-Connect-not-enabled wall and returned 502. **No member has ever successfully created a Stripe Connect account through this app.** The DB table `stripe_connected_accounts` is presumably empty in production (confirmable with `SELECT count(*) FROM public.stripe_connected_accounts;` — expected: 0, or whatever count from manual test inserts, but no real flow-created rows).

Once Connect is enabled on the dashboard, **the real Stage 1 acceptance test is now runnable for the first time**:

1. Open the app as an authenticated user.
2. Linked Accounts → "Link a Bank".
3. Stripe-hosted onboarding page should open in the device's browser (the `onboardingUrl` returned by step 6).
4. Complete onboarding (test-mode shortcuts apply).
5. Stripe's webhook (`stripe-webhook` Edge Function, `account.updated` branch) should fire and update the row's `onboarding_status` / `payouts_enabled`.
6. Re-open the app → Linked Accounts should show the linked bank account.
7. **Verification queries:**
   ```sql
   SELECT id, member_id, stripe_account_id, onboarding_status,
          payouts_enabled, charges_enabled, last_account_event_at
   FROM public.stripe_connected_accounts
   ORDER BY created_at DESC LIMIT 5;
   ```
   Expect one new row per linking attempt, with `stripe_account_id` starting `acct_...`, `onboarding_status` transitioning `pending → in_progress → complete`, and `last_account_event_at` populated once the webhook fires.

This is the test that closes out Stage 1 properly. It hasn't been runnable until now because the Stripe-side prerequisite (Connect signup) was missing.

### Original ranked hypotheses — what each one actually was

For the record, the 5 hypotheses listed earlier in this doc map to the live log this way:

| Original hypothesis | What it would have shown | Outcome |
|---|---|---|
| **#1** `STRIPE_SECRET_KEY` missing | No log entry, generic 500 | ❌ Not this |
| **#2** Function not deployed | No log entry at all, 404 | ❌ Not this |
| **#3** Stripe live/test mismatch or Stripe rejection | `[create-connect-account] stripe.accounts.create failed: <Stripe message>` | ✅ **This was it** — Stripe-side rejection, not key mismatch but Connect-not-enabled |
| **#4** Unsupported country code | Same tag as #3 with country-related message | ❌ Not this |
| **#5** Schema CHECK violation on INSERT | `[create-connect-account] DB insert failed for account` (function never reaches this) | ❌ Not this |

So the grep cheat sheet did what it was designed to do — pointed straight at the Stripe-side cause via the specific tag, no guessing.

---

## Bug B — "Link a Bank" → Edge Function returns non-2xx (ORIGINAL DIAGNOSIS, kept for record)

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

## Bug A — Add Currency Wallet picker tap does nothing (RE-DIAGNOSED)

**Status:** Confirmed real bug after device verification. The earlier "UX confusion" theory is **wrong** — the user tapped the CAD button and it produced **no expansion, no list, no modal**. Re-investigating reveals a different root cause: nested React Native Modal.

### What the device confirmed

Tap CAD button (the `<CurrencySelector>` button rendered inside the "Add Currency Wallet" outer modal) → nothing happens. No animation, no inner modal, no error. The tap registers (since `TouchableOpacity` always provides a touch-down opacity flash) but the expected inner picker modal never appears.

### Root cause — nested Modal on iOS

The structure is `<Modal>` inside `<Modal>`:

**`WalletScreen.tsx:451-485`** renders the outer "Add Currency Wallet" modal:
```jsx
<Modal
  visible={showAddCurrencyModal}
  animationType="slide"
  transparent={true}
  ...
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>
      ...
      <CurrencySelector
        selectedCurrency={selectedNewCurrency}
        onSelect={setSelectedNewCurrency}
        label="Currency"
      />
      ...
```

**`components/CurrencySelector.tsx:32-129`** renders the inner picker modal (non-compact mode):
```jsx
const [modalVisible, setModalVisible] = useState(false);
...
<TouchableOpacity
  onPress={() => !disabled && setModalVisible(true)}  // ← THIS fires on tap
  ...
>
  ...the CAD/NGN/etc. button visual...
</TouchableOpacity>

<CurrencyModal visible={modalVisible} ... />        // ← This Modal tries to open but iOS blocks it
```

When the user taps the CAD button:
1. `onPress` correctly fires `setModalVisible(true)`. React state updates. The inner `<CurrencyModal>` component's `visible` prop changes from `false` to `true`.
2. React Native's `<Modal>` calls into the native iOS layer to present the modal via `UIViewController.present(_:animated:)`.
3. **iOS rejects the call silently.** Apple's `UIViewController` only allows one modal presentation at a time per view controller, and the outer `<Modal>` is already presented on the same root VC. The inner modal's `present(...)` call is dropped without an exception.
4. The user sees nothing change. No error in the JS console, no error in the native log (unless you have verbose `UIViewController` logging enabled).

This is a [known React Native limitation](https://github.com/facebook/react-native/issues/26892) — multiple Modals on the same hierarchy don't compose on iOS the way they do on Android (where Android renders modals as overlay layers, not VC presentations).

### Why my earlier "UX confusion" theory was wrong

I assumed tapping the CurrencySelector button would open the inner modal — which is what the code says happens *outside* of a parent modal context. I didn't account for the WalletScreen rendering it inside its own `<Modal>`. The code is correct; the integration is broken. UX confusion would have meant "user looked at button, didn't tap" — but the user did tap. Different bug class entirely.

### How to verify this is the cause (read-only, optional)

`CurrencySelector` is also used by `screens/MakeContributionScreen.tsx`, but there it uses a different exported component — `QuickCurrencyPicker` (line 386), which renders a horizontal scroll inline, not a modal-opening button. So MakeContributionScreen is **not** a counter-example to the nested-modal theory.

A direct test would be: tap the same `<CurrencySelector>` in any context where it's NOT inside a `<Modal>`. If it works there, the nested-modal hypothesis is confirmed. Currently no such context exists in the codebase (WalletScreen is the only consumer of the full `<CurrencySelector>`), so this would require a temporary test render.

### Fix options

**(A) Remove the outer "Add Currency Wallet" wrapper modal.** Instead, the "+ Add Currency" tap directly opens `<CurrencySelector>`'s internal picker. The outer modal currently adds only a header ("Add Currency Wallet"), a subtitle, the selector, and an "Add NGN Wallet" CTA — most of which can be redesigned into the picker's own footer / header.

- **Pros:** Eliminates the nesting entirely. Cleanest fix. Removes a redundant modal layer that the user never needed.
- **Cons:** Requires moving the "Add Wallet" CTA into the picker, which currently lives in `WalletScreen` not `CurrencySelector`. Either pass an `onConfirm` callback to `CurrencySelector`, or call `addCurrencyWallet` directly in the picker's `onSelect`. Touches 2 files but is a clean refactor.

**(B) Switch the inner Modal to inline rendering.** Make `<CurrencySelector>` render the picker list **inline** (in-place expansion) when `modalVisible` is true, instead of using a native `<Modal>`. The picker becomes a collapsible section inside the parent modal's scroll, no nested modal.

- **Pros:** Minimal change to `CurrencySelector` — just replace `<Modal>` with a conditionally rendered `<View>` with absolute positioning or `flex` integration.
- **Cons:** Changes the UX everywhere `<CurrencySelector>` is rendered, including any future non-nested contexts. If the picker is a long list, inline expansion can push surrounding UI badly.

**(C) Replace `react-native`'s `<Modal>` with `react-native-modal` (community library).** This library renders modals as positioned overlays in the React tree instead of via UIKit presentation, so nesting works natively.

- **Pros:** Drop-in API compatibility. Solves the general problem (any current or future nested modal will work).
- **Cons:** Adds a dependency. Requires touching both modals (outer and inner). Bundles a fair amount of code (~50KB) for what could be solved with refactor alone.

**(D) State-machine the two modals so only one is open at a time.** Tapping the CurrencySelector button closes the outer "Add Currency Wallet" modal first, then opens the picker. After picking, re-opens the outer modal with the new value selected. Convoluted UX (user sees flash, modal closes, modal opens) and easy to get wrong.

- Not recommended.

### Recommendation

**Option A.** The outer modal is doing very little — a header, a subtitle, and an "Add Wallet" CTA. All three can move into `<CurrencySelector>`'s own modal (either by extending the component's props with `onConfirm` / `confirmLabel`, or by replacing the wrapper entirely with a direct invocation of the existing internal modal). Total touch: `WalletScreen.tsx` and `components/CurrencySelector.tsx`, ~30 lines of net change.

Option B would also work and is slightly smaller in code change, but introduces an inline-expansion UX pattern that other call sites might not want.

### Adjacent observation while re-reading

`WalletScreen.tsx:32` sets `selectedNewCurrency` default to `"NGN"`. That's a sensible default for a Nigerian user but irrelevant for the Francophone West African beachhead. Once Bug A is fixed and the picker actually opens, consider defaulting to:
- `preferences.language.code === 'fr' && country in ['CI','SN','ML','BF','BJ','TG','NE'] ? 'XOF' : 'NGN'` — naive but covers the Francophone diaspora case
- Or, more robustly, source from `CurrencyContext.primaryCurrency` which can be inferred from origin country in PreferencesContext

Not part of the bug fix; flagging because it's adjacent code that's about to be touched.

---

## Bug A — Add Currency Wallet "only offers CAD" (ORIGINAL DIAGNOSIS, kept for record)

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
| **B** — Link a Bank non-2xx | ✅ **RESOLVED at diagnosis** — Stripe Connect not enabled on the test-mode Stripe account | Stripe-side prerequisite, not a code bug | Enable Connect at https://dashboard.stripe.com/connect; **no code change**. Then run the Stage 1 acceptance test for the first time. |
| **A** — Currency picker tap does nothing | ✅ Confirmed real bug — nested React Native Modal | Inner `<Modal>` inside `CurrencySelector` can't open because outer "Add Currency Wallet" `<Modal>` in `WalletScreen` already holds the iOS UIViewController. Earlier "UX confusion" theory was wrong. | Fix option A: remove outer modal wrapper, open `CurrencySelector`'s picker directly. ~30 lines across 2 files. |
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
