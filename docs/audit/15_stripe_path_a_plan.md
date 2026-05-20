# Path A — Stripe Test Charge Implementation Plan

**Goal:** prove ONE test charge of `$0.50` using card `4242 4242 4242 4242` works end-to-end. After success:
- A row in `stripe_payment_intents` with `status='succeeded'`
- A row in `stripe_webhook_events` for the `payment_intent.succeeded` event
- A visible charge in the Stripe test-mode dashboard

**Scope explicitly NOT included** (deferred to a future Path B):
- Replacing the 14 stubs inside `services/StripeConnectEngine.ts` — it stays as-is
- Stripe Connect onboarding (`stripe_connected_accounts`)
- KYC enforcement (skip the gate)
- Apple Pay / Google Pay (card only)
- Linking the charge to a real circle contribution row
- Production-mode keys
- Refunds, disputes, retries

**Strategy:** build a minimal parallel path beside `StripeConnectEngine.ts`. Don't touch the 1,953-line stub file — go around it.

---

## Architecture

```
Mobile App                  Supabase Edge Functions                Stripe
─────────                  ──────────────────────                 ──────
User taps "Test charge"
  ↓
POST /functions/v1/create-payment-intent
  Authorization: Bearer <Supabase JWT>
  { amount: 50, currency: 'usd' }
        ⟶
                 ┌──────────────────────────────┐
                 │ create-payment-intent EF     │
                 │ 1. Verify JWT → user_id      │
                 │ 2. stripe.paymentIntents     │
                 │    .create({                 │
                 │     amount: 50,              │           ⟶ Stripe creates PI
                 │     currency: 'usd',         │           ⟵ returns {id, client_secret}
                 │     metadata: {user_id}      │
                 │    })                        │
                 │ 3. INSERT stripe_payment_    │
                 │    intents row               │
                 │ 4. return {clientSecret}     │
                 └──────────────────────────────┘
        ⟵
PaymentSheet.present(clientSecret)
User enters 4242 4242 4242 4242
        ⟶                                              ⟶ Stripe charges card
                                                        ⟵ returns succeeded
                                                        ↓
                                                        ⟶ Stripe POSTs webhook
POST /functions/v1/stripe-webhook
  Stripe-Signature: t=...,v1=...
  { event payload }
                 ┌──────────────────────────────┐
                 │ stripe-webhook EF            │
                 │ 1. Verify Stripe signature   │
                 │    using STRIPE_WEBHOOK_     │
                 │    SECRET                    │
                 │ 2. INSERT stripe_webhook_    │
                 │    events                    │
                 │ 3. UPDATE stripe_payment_    │
                 │    intents.status='succeeded'│
                 └──────────────────────────────┘
Mobile re-fetches PI → sees status='succeeded' → ✅
```

Two NEW Edge Functions. Zero changes to `StripeConnectEngine.ts`.

---

## Required packages

### Server (Supabase Edge Functions — Deno runtime)
- **`stripe`** — imported in EF code as `import Stripe from "npm:stripe@^17"`. No `package.json` needed (Deno resolves `npm:` imports directly).

### Client (`tanda-xn-mobile`)
- **No new installs.** `@stripe/stripe-react-native` is already in `package.json` per the `PaymentContext.tsx` import.

---

## File-change inventory

### NEW files (3)

| Path | Lines (est.) | Purpose |
|---|---|---|
| `supabase/functions/_shared/cors.ts` | ~10 | Standard CORS headers helper |
| `supabase/functions/create-payment-intent/index.ts` | ~70 | Auth user → create Stripe PI → write row → return clientSecret |
| `supabase/functions/stripe-webhook/index.ts` | ~80 | Verify signature → write event row → update PI status |

### MODIFIED files (2)

| Path | Change | Purpose |
|---|---|---|
| `context/PaymentContext.tsx` | +~40 lines | Add `makeTestCharge(amount)` method |
| `screens/AddFundsScreen.tsx` *(or one screen)* | +~15 lines | Add a `__DEV__`-only "Test Charge $0.50" button |

### UNCHANGED — explicitly NOT modified

- `services/StripeConnectEngine.ts` — stays as-is, all 14 stubs intact
- `App.tsx` — `PaymentProvider` is already wired
- `.env.local` — publishable + secret keys already set; webhook secret stays empty (not used client-side)

---

## Step-by-step plan

### Phase 1 — Stripe dashboard setup *(5 min, manual, web)*

1. Open https://dashboard.stripe.com/test (confirm top-right toggle shows **Test mode**)
2. **Developers → Webhooks → Add endpoint**
3. Endpoint URL: `https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/stripe-webhook`
4. Subscribe to events (minimum):
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `payment_intent.processing`
5. On the endpoint detail page, **"Reveal signing secret"** → copy the `whsec_…` string. Needed for Phase 2.

**Verify:** the endpoint shows under "Webhook endpoints" with status "Enabled".

### Phase 2 — Supabase secrets *(5 min, CLI)*

```bash
cd tanda-xn-mobile/
supabase secrets set STRIPE_SECRET_KEY="sk_test_..."          # from seo-work/.env (key STRIPE_SECRET_KEY_PATH_A)
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_..."        # from Phase 1 step 5
```

> Test-mode Stripe keys are stashed in `seo-work/.env` (gitignored) under `STRIPE_PUBLISHABLE_KEY_PATH_A` and `STRIPE_SECRET_KEY_PATH_A`. They are NOT in this committed plan doc.

**Verify:** `supabase secrets list` shows both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with digest hashes.

### Phase 3 — Create the two Edge Functions *(30–45 min)*

**3a. `supabase/functions/_shared/cors.ts`** — sketch:

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
```

**3b. `supabase/functions/create-payment-intent/index.ts`** — sketch:

```typescript
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-09-30.acacia" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1. Extract user from JWT
  const authHeader = req.headers.get("Authorization")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return new Response(JSON.stringify({error: "unauth"}), { status: 401, headers: corsHeaders });

  // 2. Parse request body
  const { amount, currency = "usd" } = await req.json();
  if (!Number.isInteger(amount) || amount < 50)
    return new Response(JSON.stringify({error: "amount must be integer cents ≥ 50"}), { status: 400, headers: corsHeaders });

  // 3. Create PI on Stripe
  const intent = await stripe.paymentIntents.create({
    amount, currency,
    metadata: { user_id: user.id, test_charge: "true", source: "path_a_smoke_test" },
    automatic_payment_methods: { enabled: true },
  });

  // 4. INSERT into stripe_payment_intents
  //    (VERIFY column names against live schema before coding —
  //     stripe_connected_accounts uses member_id not user_id; this table may differ)
  await supabase.from("stripe_payment_intents").insert({
    stripe_payment_intent_id: intent.id,
    member_id: user.id,
    amount, currency,
    status: intent.status,
    client_secret: intent.client_secret,
    metadata: intent.metadata,
  });

  return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

**3c. `supabase/functions/stripe-webhook/index.ts`** — sketch:

```typescript
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-09-30.acacia" });
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")!;
  const body = await req.text();

  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Signature failed: ${err.message}`, { status: 400 });
  }

  // 2. Idempotency
  const { error: insErr } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
    received_at: new Date().toISOString(),
  });
  if (insErr && !insErr.message.includes("duplicate")) {
    return new Response(`db insert failed: ${insErr.message}`, { status: 500 });
  }
  if (insErr) return new Response("duplicate event, already processed", { status: 200 });

  // 3. Handle specific events
  if (event.type.startsWith("payment_intent.")) {
    const pi = event.data.object as Stripe.PaymentIntent;
    await supabase.from("stripe_payment_intents")
      .update({ status: pi.status, last_event_at: new Date().toISOString() })
      .eq("stripe_payment_intent_id", pi.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**Pre-coding gotcha:** verify exact column names for `stripe_payment_intents` and `stripe_webhook_events` against the live schema. From the Phase 0 audit we know `stripe_connected_accounts` uses `member_id` not `user_id` — these two tables may follow the same convention or may differ. A single `SELECT column_name FROM information_schema.columns WHERE table_name IN ('stripe_payment_intents','stripe_webhook_events')` resolves it.

### Phase 4 — Modify `PaymentContext.tsx` *(15–20 min)*

Add `makeTestCharge` method:

```typescript
const makeTestCharge = async (amountCents: number = 50): Promise<{ ok: boolean; error?: string }> => {
  if (!user) return { ok: false, error: "Not logged in" };

  // 1. Call Edge Function
  const { data, error } = await supabase.functions.invoke("create-payment-intent", {
    body: { amount: amountCents, currency: "usd" },
  });
  if (error || !data?.clientSecret) return { ok: false, error: error?.message ?? "no clientSecret" };

  // 2. Init PaymentSheet
  const initResult = await initPaymentSheet({
    merchantDisplayName: "TandaXn Test",
    paymentIntentClientSecret: data.clientSecret,
    style: "automatic",
  });
  if (initResult.error) return { ok: false, error: initResult.error.message };

  // 3. Present sheet
  const presentResult = await presentPaymentSheet();
  if (presentResult.error) {
    if (presentResult.error.code === "Canceled") return { ok: false, error: "User cancelled" };
    return { ok: false, error: presentResult.error.message };
  }
  return { ok: true };
};

// Expose in context value
const value = { ...existing, makeTestCharge };
```

### Phase 5 — Wire a test button *(10 min)*

Recommended location: `screens/AddFundsScreen.tsx`. Add inside the JSX:

```tsx
{__DEV__ && (
  <TouchableOpacity
    style={{ padding: 16, marginTop: 16, backgroundColor: "#FF6B6B", borderRadius: 8 }}
    onPress={async () => {
      const r = await makeTestCharge(50);
      Alert.alert(r.ok ? "Test charge OK" : "Test charge FAILED", r.error ?? "");
    }}>
    <Text style={{ color: "white", fontWeight: "600", textAlign: "center" }}>
      ⚠️ DEV: Test charge $0.50
    </Text>
  </TouchableOpacity>
)}
```

`__DEV__` gates the button to development builds only — no production exposure.

### Phase 6 — Deploy + smoke test *(15 min)*

```bash
cd tanda-xn-mobile/

# Deploy
supabase functions deploy create-payment-intent
supabase functions deploy stripe-webhook --no-verify-jwt   # webhooks are unauthenticated; signature is the auth

# Confirm
supabase functions list   # both ACTIVE

# Run on device (NOT web — Stripe RN is native-only)
npx expo run:ios          # OR npx expo run:android

# In app: AddFundsScreen → tap "DEV: Test charge $0.50"
# PaymentSheet → 4242 4242 4242 4242, 12/29, 123, 12345 → Pay
```

### Phase 7 — Verify *(5 min)*

```sql
-- Should show new row, status='succeeded'
SELECT stripe_payment_intent_id, status, amount, currency, metadata, created_at
FROM stripe_payment_intents ORDER BY created_at DESC LIMIT 5;

-- Should show 2-3 rows for this PI's status transitions
SELECT stripe_event_id, event_type, received_at
FROM stripe_webhook_events ORDER BY received_at DESC LIMIT 10;
```

Stripe dashboard: https://dashboard.stripe.com/test/payments — see the `$0.50 USD` test charge.

---

## Confirmation checklist

- [ ] PaymentSheet displayed on device
- [ ] User entered test card and confirmed
- [ ] Alert showed "Test charge OK"
- [ ] `stripe_payment_intents` has 1 new row with `status='succeeded'`
- [ ] `stripe_webhook_events` has ≥1 row for this PI
- [ ] Stripe dashboard test-mode shows the charge

If any fails, the failure phase identifies the bug location.

---

## Rollback

- **Disable dev button:** delete `{__DEV__ && (...)}` from `AddFundsScreen.tsx`
- **Stop webhooks:** disable endpoint at Stripe dashboard (one click)
- **Disable Edge Functions:** `supabase functions delete create-payment-intent stripe-webhook`
- **Revert code:** `git revert <commit>` removes both new files cleanly

No schema changes, nothing to clean up in the DB beyond the test PI row (harmless to leave).

---

## Estimated effort

| Phase | Duration | What |
|---|---|---|
| 1 | 5 min | Stripe dashboard webhook setup |
| 2 | 5 min | `supabase secrets set` |
| 3 | 30–45 min | Write two Edge Functions |
| 4 | 15–20 min | `PaymentContext.makeTestCharge` |
| 5 | 10 min | Wire the dev button |
| 6 | 15 min | Deploy + smoke test |
| 7 | 5 min | Verify in DB and dashboard |
| **Total** | **~1.5–2 hr** | focused work |

Add 30–45 min buffer for debugging unknowns → realistic **~2.5 hr**.

---

## What this PROVES vs does NOT prove

✅ Proves: client ↔ Edge Function ↔ Stripe ↔ webhook ↔ DB plumbing works.
❌ Does not prove: Connect onboarding, payouts, refunds, disputes, KYC gates, Apple/Google Pay, production mode, the 14 other `StripeConnectEngine.ts` stubs.

---

_Plan written 2026-05-20. Stripe test keys for execution are stashed in `seo-work/.env` (gitignored) — not in this doc._
