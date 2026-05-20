# Tier 4 RLS — Batch 1: Payment / Dispute Lockdown ✅ EXECUTED

**Date:** 2026-05-20
**Scope:** 5 `USING(true)` policies on 5 financial-or-marketplace tables
**Result:** ✅ All 4 verification queries pass. Total `USING(true)` in `public`: **70 → 65**.

This is the first of several Tier 4 RLS batches. The full plan is in `docs/audit/16_rls_tier4_diagnostic.md`.

**Smoke test on device:** **NOT YET PERFORMED.** User will do this manually before tagging the stable release.

---

## What changed

| Table | Before | After |
|---|---|---|
| `payment_provider_transactions` | `Allow all for ... USING (true)` for `public` (ALL cmd) | **No policies** — RLS-enabled table is now locked to `service_role` only |
| `provider_accounts` | `Allow all for ... USING (true)` for `public` (ALL cmd) | 2 owner-scoped policies: `auth.uid() = user_id` (SELECT + ALL) |
| `dispute_cases` | `Allow all for ... USING (true)` for `public` (ALL cmd) | 2 circle-member-scoped policies (SELECT + ALL via `EXISTS` on `circle_members`) |
| `pool_circle_exposure` | `exposure_public_read USING (true)` for `public` (SELECT) | 1 circle-member-scoped policy + the pre-existing service-role policy |
| `liquidity_pool` | `pool_public_read USING (true)` for `public` (SELECT) | **No public read** — only the pre-existing service-role policy remains |

**Bonus finding:** `liquidity_pool` and `pool_circle_exposure` already had `_service` policies scoping to `service_role`. Dropping their open `_public_read` policies left the service-role path intact — no Edge Function disruption.

---

## Note on `dispute_cases` scope (acknowledged trade-off)

> **`dispute_cases_member_select` and `dispute_cases_member_modify` allow any circle member to see AND modify any dispute filed in that circle.** This is acceptable for now (no dispute UI is wired yet — the table is empty in production), but may need refinement before disputes ship to real users. Future refinements to consider:
>
> - **Limit SELECT to involved parties + elder** (filer, respondent, assigned elder) instead of all members
> - **Limit MODIFY to involved parties only** (or to the elder for closing/resolution)
> - **Add a separate policy for "case file" attachments** if sensitive evidence is involved
>
> Track this as a follow-up before the dispute resolution feature ships.

---

## Verification results

### (a) Old `USING(true)` policies on these 5 tables
```sql
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND qual='true'
  AND tablename IN ('payment_provider_transactions','provider_accounts',
                    'dispute_cases','pool_circle_exposure','liquidity_pool');
```
**Result: 0 rows** ✅ (was 5)

### (b) New scoped policies exist
**Result: 5 of 5 found** ✅

| Table | Policy | Cmd |
|---|---|---|
| `dispute_cases` | `dispute_cases_member_select` | SELECT |
| `dispute_cases` | `dispute_cases_member_modify` | ALL |
| `pool_circle_exposure` | `exposure_member_select` | SELECT |
| `provider_accounts` | `provider_accounts_owner_select` | SELECT |
| `provider_accounts` | `provider_accounts_owner_modify` | ALL |

### (c) Total `USING(true)` in `public` schema
**Result: 65** ✅ (was 70; dropped by 5 as expected)

### (d) RLS still enabled on all 5 tables
| Table | rowsecurity |
|---|---|
| `dispute_cases` | true ✅ |
| `liquidity_pool` | true ✅ |
| `payment_provider_transactions` | true ✅ |
| `pool_circle_exposure` | true ✅ |
| `provider_accounts` | true ✅ |

### (e) Policies per affected table (post)
| Table | Total | USING(true) |
|---|---|---|
| `dispute_cases` | 2 | 0 |
| `liquidity_pool` | 1 | 0 |
| `payment_provider_transactions` | 0 | 0 |
| `pool_circle_exposure` | 2 | 0 |
| `provider_accounts` | 2 | 0 |

---

## SQL that ran

```sql
BEGIN;

-- 1. payment_provider_transactions: webhook plumbing only — service_role writes from Edge Functions
DROP POLICY IF EXISTS "Allow all for payment_provider_transactions"
  ON public.payment_provider_transactions;

-- 2. provider_accounts: marketplace provider records — user sees own
DROP POLICY IF EXISTS "Allow all for provider_accounts"
  ON public.provider_accounts;
CREATE POLICY "provider_accounts_owner_select"
  ON public.provider_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "provider_accounts_owner_modify"
  ON public.provider_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. dispute_cases: circle-scoped.
--    NOTE: these policies allow ANY circle member to see and modify ANY
--    dispute filed within that circle. Acceptable for now; may need
--    refinement later (e.g., restrict modify to involved parties only,
--    or limit visibility to dispute participants + elder).
DROP POLICY IF EXISTS "Allow all for dispute_cases"
  ON public.dispute_cases;
CREATE POLICY "dispute_cases_member_select"
  ON public.dispute_cases FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = dispute_cases.circle_id
      AND cm.user_id = auth.uid()
  ));
CREATE POLICY "dispute_cases_member_modify"
  ON public.dispute_cases FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = dispute_cases.circle_id
      AND cm.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = dispute_cases.circle_id
      AND cm.user_id = auth.uid()
  ));

-- 4. pool_circle_exposure: cross-circle liquidity — only members of the circle see it
DROP POLICY IF EXISTS "exposure_public_read"
  ON public.pool_circle_exposure;
CREATE POLICY "exposure_member_select"
  ON public.pool_circle_exposure FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circle_members cm
    WHERE cm.circle_id = pool_circle_exposure.circle_id
      AND cm.user_id = auth.uid()
  ));

-- 5. liquidity_pool: global pool state — service_role only (cross-circle engine, no direct UI read)
DROP POLICY IF EXISTS "pool_public_read"
  ON public.liquidity_pool;

COMMIT;
```

---

## Rollback (if needed)

Pre-execution snapshot — paste any/all of these lines to restore the previous state:

```sql
CREATE POLICY "Allow all for dispute_cases" ON public.dispute_cases
  FOR ALL AS PERMISSIVE TO public USING (true);
CREATE POLICY "pool_public_read" ON public.liquidity_pool
  FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "pool_service" ON public.liquidity_pool
  FOR ALL AS PERMISSIVE TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK (true);
CREATE POLICY "Allow all for payment_provider_transactions" ON public.payment_provider_transactions
  FOR ALL AS PERMISSIVE TO public USING (true);
CREATE POLICY "exposure_public_read" ON public.pool_circle_exposure
  FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "exposure_service" ON public.pool_circle_exposure
  FOR ALL AS PERMISSIVE TO public USING ((auth.role() = 'service_role'::text)) WITH CHECK (true);
CREATE POLICY "Allow all for provider_accounts" ON public.provider_accounts
  FOR ALL AS PERMISSIVE TO public USING (true);
```

Note: `pool_service` and `exposure_service` were pre-existing service-role policies that were NOT dropped by the batch. They appear in this snapshot for completeness but you don't need to recreate them on rollback — they're still in place.

---

## Pending: manual smoke test (user)

The user will manually test these screens on a device build before tagging:

| Screen / flow | What to check |
|---|---|
| Open the **Dispute UI** from a circle (if reachable) | No crash; empty state expected (table has 0 rows in prod) |
| **Marketplace provider profile** (if any `provider_accounts` rows exist) | Owner sees own; non-owner sees blank/403 |
| **Cross-circle liquidity** UI (likely not wired yet per `00_SUMMARY.md`) | Should be no-op — backend feature, no UI |
| **Stripe webhook** ingestion (future) | `payment_provider_transactions` writes from Edge Function service_role — needs Path A to be active to exercise |

If anything breaks during smoke test:
1. Run the rollback SQL above (any subset of the 7 statements)
2. Tag NOT created — fix forward by adjusting the new policies

---

## Status

- ✅ SQL executed and verified
- ⏳ Manual smoke test pending (user)
- ⏳ Tag `stable-2026-05-20-rls-tier4-batch1-shipped` pending (after smoke test)

**Next batch:** see `docs/audit/16_rls_tier4_diagnostic.md` for the remaining 65 policies. Batch 2 candidate (per the diagnostic's Group A list): community / circle membership tables (~10 policies).

---

_Generated 2026-05-20. SQL executed via Supabase Management API. 5 policies dropped, 5 new scoped policies created._
