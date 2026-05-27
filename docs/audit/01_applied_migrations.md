# Applied Migrations — Ground Truth

> ## 🔄 STALE — superseded 2026-05-27
>
> This doc is the **2026-05-18 snapshot** showing 31 registered migrations at that time. The current production state is **70 registered migrations** (verified live via Management API on 2026-05-27).
>
> The drift audit in `docs/audit/34_migration_drift_audit_results.md` closed the gap between this snapshot and reality. Of the 39 new registrations since 2026-05-18:
> - 32 were registered via name-only backfill `INSERT`s done over the past week (not captured here)
> - 7 were applied-but-unregistered (drift) and were backfilled by the audit on 2026-05-27: `035`, `050`, `055`, `057`, `062`, `064`, `065`
>
> The snapshot below is preserved as the historical baseline. **Do not rely on the "Total applied: 31" line — it is outdated by 39.** To regenerate a fresh dump, run:
> ```sql
> SELECT version, name, statements IS NOT NULL AS has_statements
> FROM supabase_migrations.schema_migrations ORDER BY version;
> ```

---

## Snapshot — 2026-05-18 (historical)

Source: `supabase_migrations.schema_migrations` (user-supplied paste, dated 2026-05-18)

**Total applied: 31**

| # | Version | Name | On-disk match |
|---|---------|------|---------------|
| 1 | 001 | create_tables | ✅ `001_create_tables.sql` |
| 2 | 002 | update_tables | ✅ `002_update_tables.sql` |
| 3 | 003 | fix_wallets | ✅ `003_fix_wallets.sql` |
| 4 | 004 | complete_setup | ✅ `004_complete_setup.sql` |
| 5 | 005 | community_system | ✅ `005_community_system.sql` |
| 6 | 006 | financial_profiles | ✅ `006_financial_profiles.sql` |
| 7 | 007 | circle_matching | ✅ `007_circle_matching.sql` |
| 8 | 008 | default_cascade | ✅ `008_default_cascade.sql` |
| 9 | 009 | payout_system | ✅ `009_payout_system.sql` |
| 10 | 010 | payout_order_system | ✅ `010_payout_order_system.sql` |
| 11 | 011 | contribution_scheduling | ✅ `011_contribution_scheduling.sql` |
| 12 | 012 | cycle_progression_cleanup_and_create | ✅ `012_cycle_progression_cleanup_and_create.sql` |
| 13 | 013 | late_contribution_handling | ✅ `013_late_contribution_handling.sql` |
| 14 | 014 | default_cascade_handler | ✅ `014_default_cascade_handler.sql` |
| 15 | 015 | payout_execution_engine | ✅ `015_payout_execution_engine.sql` |
| 16 | 016 | circle_dissolution | ✅ `016_circle_dissolution.sql` |
| 17 | 017 | member_removal_midcircle | ✅ `017_member_removal_midcircle.sql` |
| 18 | 018 | position_swapping | ✅ `018_position_swapping.sql` |
| 19 | 019 | initial_xnscore | ✅ `019_initial_xnscore.sql` |
| 20 | 020 | xnscore_decay_growth | ✅ `020_xnscore_decay_growth.sql` |
| 21 | 021 | xnscore_factor_breakdown | ✅ `021_xnscore_factor_breakdown.sql` |
| 22 | 022 | creditworthiness_assessment | ✅ `022_creditworthiness_assessment.sql` |
| 23 | 023 | interest_calculation_complete | ✅ `023_interest_calculation_complete.sql` |
| 24 | 024 | cleanup_first | ✅ `024_cleanup_first.sql` |
| 25 | 025 | security_fixes | ✅ `025_security_fixes.sql` |
| 26 | 026 | cron_job_logs | ✅ `026_cron_job_logs.sql` |
| 27 | 027 | setup_cron_schedules | ✅ `027_setup_cron_schedules.sql` |
| 28 | 028 | token_incentives | ✅ `028_token_incentives.sql` |
| 29 | 029 | api_white_label | ✅ `029_api_white_label.sql` |
| 30 | 030 | token_api_cron_schedules | ✅ `030_token_api_cron_schedules.sql` |
| 31 | 032 | elder_system | ⚠️ Name mismatch — disk has: `032_elder_context_support.sql` |

## Gaps in applied sequence

Version numbers SKIPPED in production: `031`

- `031`: files exist on disk but never applied:
  - `031_fix_circles_rotation_method.sql`
  - `031_savings_context_support.sql`

## Highest version applied vs highest on disk
- Highest applied: `032` (elder_system)
- Highest on disk: `068` — file: `068_create_pending_join_rpc.sql`
- **Gap:** 36 version numbers of on-disk migrations have NEVER run