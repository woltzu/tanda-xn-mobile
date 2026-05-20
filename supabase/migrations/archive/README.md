# Archived Migrations

This folder contains **34 SQL migration files** that have been classified as **Category D — Dead / duplicate / superseded** by the audit in `docs/audit/10_migration_inventory.md`.

**These files are archived, not deleted.** They remain in version control for historical reference.

## Why they're here

Three sub-categories:

### 1. Superseded iterations (18 files)

Same feature, multiple versions on disk (`_v2`, `_v3`, `_fixed`, `_final`, etc.). The canonical version of each cluster ran in production; the rest are dev iterations that were never applied. Examples:

- `015_payout_execution_engine_v2.sql` through `..._v5.sql` — version 1 was applied
- `025_security_fixes_v2.sql` / `_v3.sql` / `_final.sql` / `_rls_only.sql` — `025_security_fixes.sql` was applied
- `012_cycle_progression_engine.sql` / `_engine_fixed.sql` / `_final.sql` / `_v2.sql` — `012_cycle_progression_cleanup_and_create.sql` was applied
- `013_late_contribution_handling_v2.sql` / `_v3.sql` / `_v4.sql` — base file was applied
- `011_contribution_scheduling_fixed.sql`, `005_community_system_fixed.sql`, `014_default_cascade_handler_v2.sql`, `023_interest_calculation_system*.sql`, `024_monthly_payment_*.sql`, `026_cron_job_logs_v2.sql`

### 2. Number collisions (13 files)

Two completely different features were given the same migration number; only one could ever run. The other is permanently orphaned at that number unless re-numbered to a free slot (069+). Examples:

- `001_dream_feed.sql` (collided with `001_create_tables.sql`)
- `028_dream_feed_fixes.sql` (collided with `028_token_incentives.sql`)
- `029_feed_storage_bucket.sql` (collided with `029_api_white_label.sql`)
- `030_circle_profile_fkeys.sql` (collided with `030_token_api_cron_schedules.sql`) — **verified already-applied in prod** (all 3 FKs exist; see `10_migration_inventory.md` Step-1 triage)
- `031_fix_circles_rotation_method.sql` + `031_savings_context_support.sql` (collided with each other; neither applied via schema_migrations, but **both verified already-applied in prod** via Step-1 triage)
- Plus all the `024_monthly_payment_*.sql` files that collided with `024_cleanup_first.sql`
- Plus the `023_interest_calculation_system*.sql` files that collided with `023_interest_calculation_complete.sql`

### 3. Applied but feature removed (3 files)

These migrations DID run in production in October 2025, but the entire token-incentives system was removed in **Tier 2 cleanup (Apr 30 2026)** (see `CLAUDE.md` → "What's shipped"). Prod has NO `token_*` or `api_*` tables today. These files are kept as historical record of what once was:

- `028_token_incentives.sql`
- `029_api_white_label.sql`
- `030_token_api_cron_schedules.sql`

### 4. Non-migration utility files (1 file)

- `verify_functions.sql` — has no version prefix; a one-off diagnostic SQL.

## Do not run these files

`supabase db push` from the parent folder will (by design) not pick up files in this `archive/` subfolder. If you ever need to revive a feature from here:

1. Read its content carefully — most of these are stale relative to current schema.
2. **Re-number** to the next free version slot (currently `069+`).
3. **Test against a non-production database first.**
4. Submit as a normal new migration.

## Full classification

See `docs/audit/10_migration_inventory.md` for the complete inventory with per-file objects-created details, prod-existence checks, and category rationale. The Step-1 triage results for the three "ambiguous looking" files (`030_circle_profile_fkeys.sql`, `031_fix_circles_rotation_method.sql`, `031_savings_context_support.sql`) are in that document under "Notes on specific files" — all three confirmed as already-present-in-prod and safe to archive.

---

*Archived: 2026-05-20. No content was modified — files were moved via `git mv` to preserve rename history.*
