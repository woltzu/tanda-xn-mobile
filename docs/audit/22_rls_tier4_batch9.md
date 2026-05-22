# Tier 4 RLS — Batch 9: Internal/System Cleanup ✅ EXECUTED

**Date:** 2026-05-21
**Scope:** 4 `USING(true)` SELECT policies dropped from internal engine tables — no replacements (service_role policies kept where present; otherwise service_role bypasses RLS).
**Result:** ✅ All verification queries pass. Total `USING(true)` in `public`: **24 → 20** (−4).

Sixth Tier 4 batch (skipped numbering B6/B7/B8 — those are deferred per user decision). Plan in `docs/audit/16_rls_tier4_diagnostic.md`.

**Smoke test on device:** **NOT YET PERFORMED.** User will test manually before tagging.

---

## What changed

| Table | Dropped | Remaining policies | Rows |
|---|---|---|---|
| `migration_screens` | `migration_screens_authenticated_select` | `migration_screens_service_only` (ALL/service_role) | 44 |
| `migration_wave_status` | `migration_wave_authenticated_select` | `migration_wave_status_service_only` (ALL/service_role) | 3 |
| `pool_utilization_snapshots` | `snapshots_public_read` | `snapshots_service` (ALL/public/USING `auth.role()='service_role'`) | 0 |
| `scoring_pipeline_runs` | `Authenticated users can read pipeline runs` | **none** — service_role bypasses RLS (Batch 1 precedent: `payment_provider_transactions`) | 5 |

Net effect: these 4 tables are now service-role only. Authenticated user reads return 0 rows. Edge Functions and cron jobs that use `SUPABASE_SERVICE_ROLE_KEY` continue to work unchanged.

---

## Verification results

### (a) Total `USING(true)` in `public` schema
**Result: 20** ✅ (was 24; dropped by 4 as expected)

### (b) RLS still enabled on all 4 tables
**4/4 `rowsecurity = true`** ✅

### (c) Policies remaining on touched tables
- `migration_screens` — `migration_screens_service_only` (1 policy, ALL, service_role)
- `migration_wave_status` — `migration_wave_status_service_only` (1 policy, ALL, service_role)
- `pool_utilization_snapshots` — `snapshots_service` (1 policy, ALL, service_role via qual)
- `scoring_pipeline_runs` — **0 policies** (RLS enabled, no policy = deny-all to non-service_role)

### (d) `USING(true)` remaining on these 4 tables
**Result: 0** ✅

### (e) Bonus — tables in `public` with RLS enabled + zero policies
After Batch 9, the set is now **6 tables**, all service-role-only by bypass:
- `default_escalations`
- `default_recovery_attempts`
- `payment_provider_transactions` (since Batch 1)
- `payout_order_audit_log`
- `position_constraints`
- `scoring_pipeline_runs` (added this batch)

This is a deliberate defense-in-depth pattern, not a bug.

---

## SQL that ran

```sql
BEGIN;
DROP POLICY IF EXISTS "migration_screens_authenticated_select"
  ON public.migration_screens;
DROP POLICY IF EXISTS "migration_wave_authenticated_select"
  ON public.migration_wave_status;
DROP POLICY IF EXISTS "snapshots_public_read"
  ON public.pool_utilization_snapshots;
DROP POLICY IF EXISTS "Authenticated users can read pipeline runs"
  ON public.scoring_pipeline_runs;
COMMIT;
```

---

## Rollback (if needed)

```sql
CREATE POLICY "migration_screens_authenticated_select" ON public.migration_screens
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "migration_wave_authenticated_select" ON public.migration_wave_status
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "snapshots_public_read" ON public.pool_utilization_snapshots
  FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "Authenticated users can read pipeline runs" ON public.scoring_pipeline_runs
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
```

---

## Pending: manual smoke test (user)

| Screen | What to check |
|---|---|
| Migration debug screen (if any in admin UI) | Should now return 0 rows for authenticated reads |
| Liquidity engine UI (if any) | Should not reference `pool_utilization_snapshots` directly; reads must go through service-role RPC |
| Scoring pipeline status (admin UI, if any) | Same — admin debug surfaces of `scoring_pipeline_runs` will be empty |

None of these tables are believed to have UI surfaces in production today. If a screen breaks, rollback SQL above + pivot to a service-role RPC for that read.

---

## Cumulative Tier 4 progress

| Batch | Tables | Policies removed | Total `USING(true)` after |
|---|---|---|---|
| Diagnostic (start) | — | — | **70** |
| Batch 1 (payment/dispute) | 5 | 5 | 65 |
| Batch 2 (community membership) | 8 | 11 | 54 |
| Batch 3 (circles + circle_members) | 2 | 2 | 52 |
| Batch 4 (internal/system → service_role) | 24 | 23 | 29 |
| Batch 5 (Group A leftovers) | 5 | 5 | 24 |
| **Batch 9 (internal cleanup)** | **4** | **4** | **20** |

**71% of the original 70 cleared in six executed batches** (50 of 70). Remaining 20:
- **7 Group C** — kept by design, annotated with intent comments (`COMMENT ON POLICY`)
- **13 Group ?** — deferred per user decision (B6/B7/B8 marketplace/community/reference polish, B10 profiles needing RPC design)

---

## Status

- ✅ SQL executed and verified
- ⏳ Manual smoke test pending (user)
- ⏳ No tag yet — per user instruction, cumulative tag (or pause) decided separately

**RLS work paused after this batch** per user direction. Next steps for the remaining 13 Group ? policies (B6, B7, B8, B10) are documented but **not scheduled**.

---

_Generated 2026-05-21. SQL executed via Supabase Management API. 4 policies dropped, 0 new policies created. `scoring_pipeline_runs` joins the "RLS-on, zero policies" set._
