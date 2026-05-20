# Duplicate Migration Cleanup Plan

Multiple files share the same migration version number. For each cluster, identify which file actually ran in production (cross-ref `01_applied_migrations.md`) and flag the rest.

**Read-only audit — no files have been deleted.**

## A) Number collisions — DIFFERENT features sharing the same version (6)

⚠️ **This is a real bug.** Two different features were given the same migration number, so only ONE could ever run. The other is permanently abandoned at that number unless re-numbered.

### Version `001` — production applied: `create_tables`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `001_create_tables.sql` | ✅ Yes | Keep, rename if you ever want to re-number cleanly |
| `001_dream_feed.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |

### Version `024` — production applied: `cleanup_first`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `024_cleanup_first.sql` | ✅ Yes | Keep, rename if you ever want to re-number cleanly |
| `024_monthly_payment_complete.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |
| `024_monthly_payment_system.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |
| `024_monthly_payment_system_fix.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |

### Version `028` — production applied: `token_incentives`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `028_dream_feed_fixes.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |
| `028_token_incentives.sql` | ✅ Yes | Keep, rename if you ever want to re-number cleanly |

### Version `029` — production applied: `api_white_label`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `029_api_white_label.sql` | ✅ Yes | Keep, rename if you ever want to re-number cleanly |
| `029_feed_storage_bucket.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |

### Version `030` — production applied: `token_api_cron_schedules`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `030_circle_profile_fkeys.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |
| `030_token_api_cron_schedules.sql` | ✅ Yes | Keep, rename if you ever want to re-number cleanly |

### Version `031` — production applied: `(none applied)`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `031_fix_circles_rotation_method.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |
| `031_savings_context_support.sql` | ❌ No — orphaned by collision | Re-number to next free slot (e.g. 069+) if still wanted, else delete |

## B) Duplicate iterations — same feature, multiple versions of the file (9)

These are dev iterations (`_v2`, `_v3`, `_fixed`, `_final`). One ran; the rest are dead code in the repo.

### Version `005` — production applied: `community_system`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `005_community_system.sql` | ✅ Yes | Keep — canonical |
| `005_community_system_fixed.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `011` — production applied: `contribution_scheduling`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `011_contribution_scheduling.sql` | ✅ Yes | Keep — canonical |
| `011_contribution_scheduling_fixed.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `012` — production applied: `cycle_progression_cleanup_and_create`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `012_cycle_progression_cleanup_and_create.sql` | ✅ Yes | Keep — canonical |
| `012_cycle_progression_engine.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `012_cycle_progression_engine_fixed.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `012_cycle_progression_final.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `012_cycle_progression_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `013` — production applied: `late_contribution_handling`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `013_late_contribution_handling.sql` | ✅ Yes | Keep — canonical |
| `013_late_contribution_handling_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `013_late_contribution_handling_v3.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `013_late_contribution_handling_v4.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `014` — production applied: `default_cascade_handler`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `014_default_cascade_handler.sql` | ✅ Yes | Keep — canonical |
| `014_default_cascade_handler_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `015` — production applied: `payout_execution_engine`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `015_payout_execution_engine.sql` | ✅ Yes | Keep — canonical |
| `015_payout_execution_engine_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `015_payout_execution_engine_v3.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `015_payout_execution_engine_v4.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `015_payout_execution_engine_v5.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `023` — production applied: `interest_calculation_complete`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `023_interest_calculation_complete.sql` | ✅ Yes | Keep — canonical |
| `023_interest_calculation_system.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `023_interest_calculation_system_fix.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `025` — production applied: `security_fixes`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `025_security_fixes.sql` | ✅ Yes | Keep — canonical |
| `025_security_fixes_final.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `025_security_fixes_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `025_security_fixes_v3.sql` | ❌ No | Delete after manual review (superseded iteration) |
| `025_security_rls_only.sql` | ❌ No | Delete after manual review (superseded iteration) |

### Version `026` — production applied: `cron_job_logs`

| File | Was this what ran? | Recommendation |
|------|---------------------|----------------|
| `026_cron_job_logs.sql` | ✅ Yes | Keep — canonical |
| `026_cron_job_logs_v2.sql` | ❌ No | Delete after manual review (superseded iteration) |

## Summary

- Number collisions (different features, same #): 6
- Duplicate iterations (same feature, multiple versions): 9
- Total orphan files to review for deletion: 30

**No files have been deleted as part of this audit.**