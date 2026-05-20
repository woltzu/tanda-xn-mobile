# Salvaged from the Abandoned Supabase/ Backend

Three docs in `OneDrive/Desktop/TandaXn/Supabase/Docs/` (October 2025) describe an earlier version of the product. Most of it is now obsolete or already captured in `tanda-xn-mobile/docs/`. This file extracts what's **architecturally meaningful** and **not already documented elsewhere**.

Sources:
- `API.md` (29 KB) — REST API contract
- `BACKEND_DEPLOYMENT.md` (12 KB) — Supabase deploy + cron setup
- `BACKEND_SUMMARY.md` (12 KB) — Oct 29 2025 delivery summary

---

## 1. The original product (October 2025) — Bill-Pay Plans

This is the biggest hidden context: **TandaXn started as a bill-pay savings product**, not a tontine-first app. The current product (tontines + savings goals + advances + community + marketplace + trips) is a pivot from that.

The Oct 2025 design centred on a `plans` primitive:

```
A "plan" = user gives platform money for N days, vendor (e.g. landlord) receives
funds at maturity, user earns interest + optional reward.
```

Key shape (from `API.md` POST /plans):
- `plan_type`: `bill_pay`
- `principal`: ≤ $500 OR ≤ user's `max_outstanding_usd`
- `tenor_days`: ∈ {15, 30, 90, 180, 360}
- `rate_apr`: derived from tenor, admin-overridable
- `vendor_id`: required for bill_pay
- `bill_reference`: e.g. `RENT-NOV-2025`
- On maturity: pay vendor, return interest+reward to user
- Early exit: 10% of principal as fee, vendor payout cancelled

`vendors` table (now absent from current schema):
- `type`: landlord, etc.
- `payout_method`: bank_transfer (routing + account)
- Verification: 1–2 business days
- Re-verification required after payout-detail changes

**Why this matters now:** the existing `ADVANCE-*` screens (`app/(app)/loans/ADVANCE-001..019`) are the descendants of this concept, but the schema and product framing have changed. If anyone asks "why does the app reference plans/vendors anywhere?", this is the origin. No `vendors`, `plans`, or `bill_references` tables exist in production today — confirmed in `03_table_inventory.md`.

---

## 2. Scoring algorithm v1 (Oct 2025)

The current XnScore (in `019_initial_xnscore.sql`) uses a 5-factor model with weights 35/25/20/10/7/3. The Oct 2025 design used a simpler formula for rotation ordering in tontines:

```
Score = (on_time_rate     * 40)
      + (contribution_rate * 30)
      + (tenure_bonus      * 10)
      - (default_penalty   * 20)
      - (already_paid_penalty * 50)

Range: 0–100, higher = earlier rotation
```

Notable: the `already_paid_penalty * 50` heavily de-prioritises members who have already received a payout — this enforces strict rotation fairness. The current XnScore doesn't expose this term explicitly; rotation logic may have moved into a different service (`PayoutOrderService.ts` / `DynamicPayoutOrderingEngine.ts`). Worth comparing if rotation feels wrong.

---

## 3. KYC tier system v1 vs v2

| | Oct 2025 design | Current (per `TANDAXN_SYSTEMS_STATUS_v2.md`) |
|---|---|---|
| Levels | 0, 1, 2 | 0, 1, 2, 3, 4 |
| Gating dimension | `max_outstanding_usd` (single $ cap) | Per-tier max contribution AND max withdrawal |
| KYC provider | **Smile Identity** | **Persona** (migration 053) |
| Doc types accepted | drivers_license, document_country, selfie + front + back | Document + liveness (Persona standard) |

**Pivot note:** Smile Identity → Persona is a real change. If anyone finds references to Smile in the codebase, they're vestigial.

---

## 4. PSP integration patterns worth preserving

These implementation details are not documented elsewhere:

### Stripe — events to subscribe to (full list)

When configuring `https://your-project.supabase.co/functions/v1/webhooks_psp?provider=stripe`:
- `charge.succeeded` / `charge.failed`
- `payment_intent.succeeded` / `payment_intent.payment_failed`
- `payout.paid` / `payout.failed`

### M-Pesa BillRefNumber routing convention

```
BillRefNumber = "<user_id>:<plan_id>"   (UUID:UUID, colon-delimited)
```

This is how an M-Pesa paybill payment carries enough context for the webhook to route the money to the right user + plan/contribution. Pattern is reusable for circles (`<user_id>:<circle_id>`) if M-Pesa is ever wired up.

### Wave webhook events

- `payment.received` / `payment.failed`
- `disbursement.success` / `disbursement.failed`

Signature header: `x-wave-signature`.

### Multi-PSP funding-instructions response shape

Single endpoint returns rails for all three providers at once:

```json
"funding_instructions": {
  "stripe_client_secret": "pi_...",
  "wave_payment_url": "https://pay.wave.com/...",
  "mpesa_paybill": "12345",
  "mpesa_account": "<user_id>:<plan_id>"
}
```

If a future feature needs to surface "pick how you want to pay" choices, this is a cleaner shape than per-provider endpoints.

---

## 5. pg_cron + service-role calling pattern

Documented in `BACKEND_DEPLOYMENT.md` Step 6. The current `027_setup_cron_schedules.sql` probably does the same, but the trick is worth recording explicitly:

```sql
-- One-time setup: store the service role key as a database setting
ALTER DATABASE postgres
  SET app.settings.service_role_key TO '<your-service-role-key>';

-- Then in any cron job, read it back via current_setting:
SELECT cron.schedule(
  'process-payouts', '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/payout_scheduler',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'x-supabase-invocation-type', 'scheduled'
    )
  );
  $$
);
```

The `current_setting('app.settings.service_role_key')` indirection keeps the secret out of `cron.job_run_details` logs. Verify migration 027 follows this pattern; if it inlines the key, that's a small leak.

---

## 6. Rate limit baseline (v1)

If/when the app moves to custom Edge Function endpoints (it currently talks directly to Postgres via supabase-js), these were the originally proposed per-user limits:

| Endpoint class | Limit |
|---|---|
| General API | 100 req/min |
| Deposit endpoints | 10 req/min |
| KYC endpoints | 5 req/hour |

Standard headers: `X-RateLimit-Limit`, `-Remaining`, `-Reset`.

---

## 7. Error envelope (v1)

```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {...} } }
```

Named codes worth keeping as a vocabulary (HTTP status in parens):
`UNAUTHORIZED (401)`, `FORBIDDEN (403)`, `NOT_FOUND (404)`, `VALIDATION_ERROR (400)`, `INSUFFICIENT_FUNDS (400)`, `LIMIT_EXCEEDED (400)`, `KYC_REQUIRED (403)`, `VENDOR_NOT_VERIFIED (400)`, `PLAN_NOT_ACTIVE (400)`, `RATE_LIMIT_EXCEEDED (429)`, `PSP_ERROR (500)`, `INTERNAL_ERROR (500)`.

---

## 8. Tontine v1 conventions

Some specific defaults from the original group-creation contract:

- `invite_code` format: `TXG-NYC-RENT-5A7B` (prefix `TXG-`, scope, topic, 4-hex shard) — human-readable, shareable
- `grace_period_hours`: 48 (current schema may have moved to days/cycles — verify)
- `penalty_rate`: 10% of contribution amount on late payment
- `platform_topup_enabled`: boolean — if true, platform fronts missed contributions to keep the cycle moving
- `size_target`: required member count before a `forming` group goes `active`

The current app's `CIRC-101..308` screens likely re-implement most of this. Cross-checking these defaults against the actual schema (`circles.grace_period_*`, `circles.penalty_rate`, `circles.size_target`) is worth doing once.

---

## 9. Historical baseline — the "40% done" estimate (Oct 29 2025)

`BACKEND_SUMMARY.md` ends with this self-assessment:

> "You're ~40% done with the technical build."
> 
> Still needed: User-facing APIs (20%), Mobile app (30%), Admin dashboard (10%).
> 
> Total remaining: 6–12 months of work (with proper team)

**This is a useful anchor.** Seven months later (May 2026), where we actually are per `00_SUMMARY.md`:
- Mobile app: largely built (155 reachable screens, App.tsx 929 lines, 65 services, 55 hooks)
- User-facing APIs: never built as standalone Edge Functions — the mobile app calls Postgres directly via supabase-js
- Admin dashboard: separate repo at `tanda-xn-admin/` exists but not audited here
- Schema: 92% of tables present despite 32% migration-tracking ratio (the well-documented sync break)

So: the architecture actually pivoted away from "user-facing Edge Functions + mobile app" toward "mobile app + direct Supabase access + business logic in service classes." The 40% baseline + 6–12 month estimate were predicting a different shape of project than what got built.

---

## 10. PSP and third-party choices (Oct 2025 vs now)

| Need | Oct 2025 plan | Current |
|---|---|---|
| Card payments | Stripe | Stripe Connect (migration 054 — NOT APPLIED in production yet) |
| Mobile money (West Africa) | Wave | not implemented |
| Mobile money (East Africa) | M-Pesa | not implemented |
| KYC | Smile Identity | Persona (migration 053 applied) |
| Email | SendGrid | SendGrid (per `supabase secrets list`) |
| SMS | Twilio | Twilio (per `supabase secrets list`) |
| Push | not specified | not implemented (NotificationPriorityEngine has table but no transport) |

**Open questions raised by this comparison** (worth confirming before next product cycle):
- Is Wave still planned, or dropped?
- Is M-Pesa still planned, or dropped?
- Is the WhatsApp / SMS marketing intent the same as Oct 2025?

These changed priorities aren't documented anywhere else.

---

## What was NOT salvaged (and why)

- **Step-by-step deploy commands** — already done; current cron is in migration 027.
- **Cost estimates** — already vague, now outdated.
- **Production checklist (security/monitoring/compliance)** — same generic content as any Supabase project; nothing TandaXn-specific.
- **Encouraging notes** ("Good luck!", "🚀") — fluff.
- **Sandbox test card numbers** — public Stripe testing info.
- **"Learning path" week-by-week schedule** — generic Supabase tutorial.
- **Pricing-tier breakdowns of Supabase Edge** — Supabase docs are the source of truth.

---

## Recommendation

After reading this, the only piece of `Supabase/Docs/` worth keeping in the repo is **this summary**. The originals can be deleted along with the rest of `Supabase/` once you confirm the items above are either (a) already known, (b) intentionally pivoted away from, or (c) worth tracking as a follow-up.

No files have been moved or deleted as part of writing this.
