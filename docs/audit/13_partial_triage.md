# PARTIAL Migration Triage

**Scope:** the 26 PARTIAL migrations from `12_schema_reconciliation.md`.
**Goal:** classify each missing object as noise (already effectively applied) or genuinely missing.
**Read-only audit.** No database changes, no file moves.

## Verdict legend

| Verdict | Meaning | Action |
|---------|---------|--------|
| `RLS_RENAMED` | Policy had a friendly-text name (e.g. "Anyone can view circle members") and the table now has policies under modern names (`tablename_select`, `pe_*`). Renamed in Tier 3 RLS cleanup (May 6). | None — fully applied. |
| `AUTH_SCHEMA` | Trigger lives in `auth.*` schema (e.g. `on_auth_user_created` on `auth.users`). My query only scans `public`. | None — fully applied. |
| `REGEX_NOISE` | My regex accidentally captured a SQL keyword (`for`, `where`, etc.) from inside a CREATE INDEX statement, not an actual object name. | None — false positive. |
| `INTENTIONALLY_DROPPED` | Token-system object removed in Tier 2 cleanup (Apr 30 2026) per `CLAUDE.md`. | None — intentional. |
| `DROPPED_VIEW` | One of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup. | None — intentional. |
| `GENUINELY_MISSING` | Live catalog has no trace of this object under any expected name/schema. | **NEEDS MANUAL REVIEW.** |

## Per-migration verdict

| Version | File | Missing items | Overall | Notes |
|---------|------|--------------|---------|-------|
| 001 | `001_create_tables.sql` | 28 | ⚠️ has genuine misses | genuinely:11 · rls:16 · regex:1 |
| 002 | `002_update_tables.sql` | 27 | ⚠️ has genuine misses | genuinely:11 · rls:16 |
| 004 | `004_complete_setup.sql` | 2 | ⚠️ has genuine misses | genuinely:2 |
| 005 | `005_community_system.sql` | 19 | ⚠️ has genuine misses | genuinely:19 |
| 006 | `006_financial_profiles.sql` | 1 | ✅ noise — fully applied | regex:1 |
| 008 | `008_default_cascade.sql` | 13 | ⚠️ has genuine misses | genuinely:11 · rls:2 |
| 010 | `010_payout_order_system.sql` | 4 | ⚠️ has genuine misses | genuinely:1 · rls:3 |
| 011 | `011_contribution_scheduling.sql` | 4 | ⚠️ has genuine misses | genuinely:1 · rls:3 |
| 012 | `012_cycle_progression_cleanup_and_create.sql` | 47 | ⚠️ has genuine misses | genuinely:32 · rls:15 |
| 013 | `013_late_contribution_handling.sql` | 32 | ⚠️ has genuine misses | genuinely:32 |
| 014 | `014_default_cascade_handler.sql` | 42 | ⚠️ has genuine misses | genuinely:40 · dropped:2 |
| 015 | `015_payout_execution_engine.sql` | 4 | ⚠️ has genuine misses | genuinely:4 |
| 016 | `016_circle_dissolution.sql` | 2 | ⚠️ has genuine misses | genuinely:2 |
| 019 | `019_initial_xnscore.sql` | 1 | ⚠️ has genuine misses | genuinely:1 |
| 021 | `021_xnscore_factor_breakdown.sql` | 1 | ⚠️ has genuine misses | genuinely:1 |
| 022 | `022_creditworthiness_assessment.sql` | 1 | ✅ noise — fully applied | dropped:1 |
| 025 | `025_security_fixes.sql` | 12 | ⚠️ has genuine misses | genuinely:9 · dropped:3 |
| 026 | `026_cron_job_logs.sql` | 7 | ⚠️ has genuine misses | genuinely:6 · dropped:1 |
| 034 | `034_user_events.sql` | 1 | ✅ noise — fully applied | dropped:1 |
| 035 | `035_member_financial_profiles.sql` | 23 | ⚠️ has genuine misses | genuinely:23 |
| 050 | `050_cron_ai_trigger_infrastructure.sql` | 2 | ⚠️ has genuine misses | genuinely:2 |
| 055 | `055_mock_to_real_migration_scoring.sql` | 1 | ⚠️ has genuine misses | genuinely:1 |
| 057 | `057_marketplace_system.sql` | 27 | ⚠️ has genuine misses | genuinely:27 |
| 062 | `062_conflict_prediction_engine.sql` | 1 | ⚠️ has genuine misses | genuinely:1 |
| 064 | `064_trip_circle_system.sql` | 16 | ⚠️ has genuine misses | genuinely:15 · dropped:1 |
| 065 | `065_trip_organizer.sql` | 4 | ⚠️ has genuine misses | genuinely:4 |

---

## Summary counts

| Verdict | Count |
|---------|-------|
| ✅ Fully applied (all misses are noise) | **3** |
| ⚠️ Has at least one GENUINELY_MISSING object | **23** |
| Total PARTIAL files triaged | **26** |

**Implication for Option A:** the `noise` files can be added to the `schema_migrations` INSERT batch alongside the 29 silent-applies. Total expected INSERT rows: **32** if all noise verdicts hold.

---

## Detail per migration

### `001_create_tables.sql` — Genuine Misses

**Total missing items:** 28 of 47 intended.

**GENUINELY_MISSING** (11):
- `indexes/idx_invited_members_circle_id` — index not found in live catalog
- `indexes/idx_wallet_transactions_wallet_id` — index not found in live catalog
- `indexes/idx_circles_type` — index not found in live catalog
- `indexes/idx_circle_members_circle_id` — index not found in live catalog
- `indexes/idx_circle_members_user_id` — index not found in live catalog
- `indexes/idx_invited_members_phone` — index not found in live catalog
- `indexes/idx_contributions_user_id` — index not found in live catalog
- `indexes/idx_payouts_recipient_id` — index not found in live catalog
- _… and 3 more GENUINELY_MISSING items in this category._

**RLS_RENAMED** (16):
- `policies/invited_members.Circle creators can invite members` — friendly-text name; table `invited_members` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circle_members.Anyone can view circle members` — friendly-text name; table `circle_members` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/profiles.Users can update own profile` — friendly-text name; table `profiles` has 4 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/contributions.Users can view contributions in their circles` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circles.Anyone can view circles` — friendly-text name; table `circles` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circles.Authenticated users can create circles` — friendly-text name; table `circles` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/wallet_transactions.Users can create wallet transactions` — friendly-text name; table `wallet_transactions` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/contributions.Users can make contributions` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- _… and 8 more RLS_RENAMED items in this category._

**REGEX_NOISE** (1):
- `indexes/for` — `for` is a SQL keyword caught by my regex from inside a CREATE INDEX clause, not a real index name

### `002_update_tables.sql` — Genuine Misses

**Total missing items:** 27 of 46 intended.

**GENUINELY_MISSING** (11):
- `indexes/idx_invited_members_circle_id` — index not found in live catalog
- `indexes/idx_wallet_transactions_wallet_id` — index not found in live catalog
- `indexes/idx_circles_type` — index not found in live catalog
- `indexes/idx_circle_members_circle_id` — index not found in live catalog
- `indexes/idx_contributions_user_id` — index not found in live catalog
- `indexes/idx_circle_members_user_id` — index not found in live catalog
- `indexes/idx_invited_members_phone` — index not found in live catalog
- `indexes/idx_payouts_recipient_id` — index not found in live catalog
- _… and 3 more GENUINELY_MISSING items in this category._

**RLS_RENAMED** (16):
- `policies/invited_members.Circle creators can invite members` — friendly-text name; table `invited_members` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circle_members.Anyone can view circle members` — friendly-text name; table `circle_members` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/profiles.Users can update own profile` — friendly-text name; table `profiles` has 4 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/contributions.Users can view contributions in their circles` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circles.Anyone can view circles` — friendly-text name; table `circles` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circles.Authenticated users can create circles` — friendly-text name; table `circles` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/wallet_transactions.Users can create wallet transactions` — friendly-text name; table `wallet_transactions` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/contributions.Users can make contributions` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- _… and 8 more RLS_RENAMED items in this category._

### `004_complete_setup.sql` — Genuine Misses

**Total missing items:** 2 of 37 intended.

**GENUINELY_MISSING** (2):
- `policies/wallet_transactions.wallet_transactions_insert` — modern-style name `wallet_transactions_insert` not found; table has 1 other policies
- `policies/wallet_transactions.wallet_transactions_select` — modern-style name `wallet_transactions_select` not found; table has 1 other policies

### `005_community_system.sql` — Genuine Misses

**Total missing items:** 19 of 86 intended.

**GENUINELY_MISSING** (19):
- `policies/defaults.defaults_select` — modern-style name `defaults_select` not found; table has 1 other policies
- `indexes/idx_council_votes_community` — index not found in live catalog
- `indexes/idx_disputes_assigned` — index not found in live catalog
- `indexes/idx_member_vouches_status` — index not found in live catalog
- `indexes/idx_community_health_community` — index not found in live catalog
- `indexes/idx_community_memberships_role` — index not found in live catalog
- `indexes/idx_leaderboard_community` — index not found in live catalog
- `indexes/idx_defaults_status` — index not found in live catalog
- _… and 11 more GENUINELY_MISSING items in this category._

### `006_financial_profiles.sql` — Fully Applied Noise

**Total missing items:** 1 of 26 intended.

**REGEX_NOISE** (1):
- `indexes/for` — `for` is a SQL keyword caught by my regex from inside a CREATE INDEX clause, not a real index name

### `008_default_cascade.sql` — Genuine Misses

**Total missing items:** 13 of 42 intended.

**GENUINELY_MISSING** (11):
- `policies/default_recovery_attempts.Users can view own recovery attempts` — friendly-text name AND table `default_recovery_attempts` has 0 live policies
- `policies/default_escalations.Users can view own escalations` — friendly-text name AND table `default_escalations` has 0 live policies
- `triggers/trigger_reserve_contribution` — trigger not found in any schema
- `indexes/idx_reserve_transactions_date` — index not found in live catalog
- `indexes/idx_installments_status` — index not found in live catalog
- `indexes/idx_payment_plans_status` — index not found in live catalog
- `indexes/idx_installments_due_date` — index not found in live catalog
- `indexes/idx_reserve_transactions_type` — index not found in live catalog
- _… and 3 more GENUINELY_MISSING items in this category._

**RLS_RENAMED** (2):
- `policies/payment_plan_installments.Users can view own installments` — friendly-text name; table `payment_plan_installments` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/reserve_fund_transactions.Community members can view reserve transactions` — friendly-text name; table `reserve_fund_transactions` has 1 live policies (likely renamed in Tier 3 RLS cleanup)

### `010_payout_order_system.sql` — Genuine Misses

**Total missing items:** 4 of 48 intended.

**GENUINELY_MISSING** (1):
- `triggers/trigger_swap_requests_updated_at` — trigger not found in any schema

**RLS_RENAMED** (3):
- `policies/position_swap_requests.Requester can create swap requests` — friendly-text name; table `position_swap_requests` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/position_swap_requests.Parties can update swap requests` — friendly-text name; table `position_swap_requests` has 3 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/position_swap_requests.Swap request parties can view` — friendly-text name; table `position_swap_requests` has 3 live policies (likely renamed in Tier 3 RLS cleanup)

### `011_contribution_scheduling.sql` — Genuine Misses

**Total missing items:** 4 of 51 intended.

**GENUINELY_MISSING** (1):
- `triggers/trigger_contributions_updated_at` — trigger not found in any schema

**RLS_RENAMED** (3):
- `policies/contributions.Users can view own contributions` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/contributions.Circle admins can view all contributions` — friendly-text name; table `contributions` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/late_fee_config.Anyone can view late fee config` — friendly-text name; table `late_fee_config` has 1 live policies (likely renamed in Tier 3 RLS cleanup)

### `012_cycle_progression_cleanup_and_create.sql` — Genuine Misses

**Total missing items:** 47 of 73 intended.

**GENUINELY_MISSING** (32):
- `functions/update_cycle_timestamp` — function not found in live `pg_proc`
- `triggers/trigger_circle_cycles_updated` — trigger not found in any schema
- `triggers/trigger_defaults_updated` — trigger not found in any schema
- `triggers/trigger_update_cycle_totals` — trigger not found in any schema
- `triggers/trigger_cycle_contributions_updated` — trigger not found in any schema
- `indexes/idx_circle_cycles_scheduled` — index not found in live catalog
- `indexes/idx_cycle_contributions_cycle` — index not found in live catalog
- `indexes/idx_cycle_contributions_pending` — index not found in live catalog
- _… and 24 more GENUINELY_MISSING items in this category._

**RLS_RENAMED** (15):
- `policies/cron_job_logs.Only admins can view cron logs` — friendly-text name; table `cron_job_logs` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/xn_score_history.Users can view own score history` — friendly-text name; table `xn_score_history` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/user_payment_methods.Users can manage own payment methods` — friendly-text name; table `user_payment_methods` has 2 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/scheduled_notifications.Users can view own scheduled notifications` — friendly-text name; table `scheduled_notifications` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/cycle_engine_runs.Only admins can view engine runs` — friendly-text name; table `cycle_engine_runs` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/circle_cycles.Members can view circle cycles` — friendly-text name; table `circle_cycles` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/member_defaults.Users can view own defaults` — friendly-text name; table `member_defaults` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- `policies/cycle_events.Members can view cycle events` — friendly-text name; table `cycle_events` has 1 live policies (likely renamed in Tier 3 RLS cleanup)
- _… and 7 more RLS_RENAMED items in this category._

### `013_late_contribution_handling.sql` — Genuine Misses

**Total missing items:** 32 of 55 intended.

**GENUINELY_MISSING** (32):
- `policies/payment_plans.payment_plans_select` — modern-style name `payment_plans_select` not found; table has 2 other policies
- `policies/user_restrictions.restrictions_select` — modern-style name `restrictions_select` not found; table has 1 other policies
- `policies/redistribution_responses.redist_resp_select` — modern-style name `redist_resp_select` not found; table has 2 other policies
- `policies/redistribution_requests.redist_select` — modern-style name `redist_select` not found; table has 1 other policies
- `policies/redistribution_responses.redist_resp_update` — modern-style name `redist_resp_update` not found; table has 2 other policies
- `policies/payment_plans.payment_plans_insert` — modern-style name `payment_plans_insert` not found; table has 2 other policies
- `policies/auto_retry_config.retry_config_select` — modern-style name `retry_config_select` not found; table has 1 other policies
- `policies/payment_plan_installments.installments_select` — modern-style name `installments_select` not found; table has 1 other policies
- _… and 24 more GENUINELY_MISSING items in this category._

### `014_default_cascade_handler.sql` — Genuine Misses

**Total missing items:** 42 of 64 intended.

**GENUINELY_MISSING** (40):
- `columns/vouches.last_vouchee_default_at` — table `vouches` exists but column `last_vouchee_default_at` is not in `information_schema.columns`
- `columns/vouches.vouchee_default_count` — table `vouches` exists but column `vouchee_default_count` is not in `information_schema.columns`
- `policies/cascade_events.ce_select_policy` — modern-style name `ce_select_policy` not found; table has 1 other policies
- `policies/voucher_default_impacts.vdi_select_policy` — modern-style name `vdi_select_policy` not found; table has 1 other policies
- `policies/defaults.def_select_policy` — modern-style name `def_select_policy` not found; table has 1 other policies
- `policies/suspension_reviews.sr_select_policy` — modern-style name `sr_select_policy` not found; table has 1 other policies
- `policies/recovery_plans.rp_select_policy` — modern-style name `rp_select_policy` not found; table has 1 other policies
- `policies/recovery_plan_installments.rpi_select_policy` — modern-style name `rpi_select_policy` not found; table has 1 other policies
- _… and 32 more GENUINELY_MISSING items in this category._

**DROPPED_VIEW** (2):
- `views/v_voucher_impact_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)
- `views/v_circle_resolution_stats` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `015_payout_execution_engine.sql` — Genuine Misses

**Total missing items:** 4 of 55 intended.

**GENUINELY_MISSING** (4):
- `indexes/idx_pe_cr_due` — index not found in live catalog
- `indexes/idx_pe_wt_reference` — index not found in live catalog
- `views/v_pending_reservations` — view not found in live catalog
- `views/v_wallet_overview` — view not found in live catalog

### `016_circle_dissolution.sql` — Genuine Misses

**Total missing items:** 2 of 59 intended.

**GENUINELY_MISSING** (2):
- `policies/their.Users can view votes` — friendly-text name AND table `their` has 0 live policies
- `policies/their.Members can vote` — friendly-text name AND table `their` has 0 live policies

### `019_initial_xnscore.sql` — Genuine Misses

**Total missing items:** 1 of 58 intended.

**GENUINELY_MISSING** (1):
- `triggers/tr_profile_xnscore_init` — trigger not found in any schema

### `021_xnscore_factor_breakdown.sql` — Genuine Misses

**Total missing items:** 1 of 46 intended.

**GENUINELY_MISSING** (1):
- `views/v_user_score_breakdown` — view not found in live catalog

### `022_creditworthiness_assessment.sql` — Fully Applied Noise

**Total missing items:** 1 of 79 intended.

**DROPPED_VIEW** (1):
- `views/v_creditworthiness_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `025_security_fixes.sql` — Genuine Misses

**Total missing items:** 12 of 48 intended.

**GENUINELY_MISSING** (9):
- `views/v_active_cycles` — view not found in live catalog
- `views/v_wallet_overview` — view not found in live catalog
- `views/v_user_score_breakdown` — view not found in live catalog
- `views/v_pending_reservations` — view not found in live catalog
- `views/v_payment_plan_progress` — view not found in live catalog
- `views/v_active_cascades` — view not found in live catalog
- `views/v_late_contributions_active` — view not found in live catalog
- `views/v_recovery_performance` — view not found in live catalog
- _… and 1 more GENUINELY_MISSING items in this category._

**DROPPED_VIEW** (3):
- `views/v_creditworthiness_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)
- `views/v_voucher_impact_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)
- `views/v_circle_resolution_stats` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `026_cron_job_logs.sql` — Genuine Misses

**Total missing items:** 7 of 14 intended.

**GENUINELY_MISSING** (6):
- `policies/notifications.notifications_own_update` — modern-style name `notifications_own_update` not found; table has 3 other policies
- `policies/notifications.notifications_service_insert` — modern-style name `notifications_service_insert` not found; table has 3 other policies
- `policies/notifications.notifications_own_select` — modern-style name `notifications_own_select` not found; table has 3 other policies
- `indexes/idx_notifications_unread` — index not found in live catalog
- `indexes/idx_notifications_user_id` — index not found in live catalog
- `views/v_recent_cron_jobs` — view not found in live catalog

**DROPPED_VIEW** (1):
- `views/v_cron_job_stats` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `034_user_events.sql` — Fully Applied Noise

**Total missing items:** 1 of 11 intended.

**DROPPED_VIEW** (1):
- `views/daily_event_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `035_member_financial_profiles.sql` — Genuine Misses

**Total missing items:** 23 of 31 intended.

**GENUINELY_MISSING** (23):
- `functions/update_member_profile_updated_at` — function not found in live `pg_proc`
- `policies/member_behavioral_profiles.mbp_select_own` — modern-style name `mbp_select_own` not found; table has 2 other policies
- `policies/member_risk_indicators.mri_select_own` — modern-style name `mri_select_own` not found; table has 2 other policies
- `policies/member_profile_snapshots.mps_select_own` — modern-style name `mps_select_own` not found; table has 2 other policies
- `policies/member_network_metrics.mnm_select_own` — modern-style name `mnm_select_own` not found; table has 2 other policies
- `policies/member_session_analytics.msa_select_own` — modern-style name `msa_select_own` not found; table has 2 other policies
- `triggers/trg_mri_updated_at` — trigger not found in any schema
- `triggers/trg_mnm_updated_at` — trigger not found in any schema
- _… and 15 more GENUINELY_MISSING items in this category._

### `050_cron_ai_trigger_infrastructure.sql` — Genuine Misses

**Total missing items:** 2 of 12 intended.

**GENUINELY_MISSING** (2):
- `policies/model_performance_logs.model_perf_admin_select` — modern-style name `model_perf_admin_select` not found; table has 1 other policies
- `policies/cohort_analytics.cohort_admin_select` — modern-style name `cohort_admin_select` not found; table has 1 other policies

### `055_mock_to_real_migration_scoring.sql` — Genuine Misses

**Total missing items:** 1 of 28 intended.

**GENUINELY_MISSING** (1):
- `views/migration_dashboard` — view not found in live catalog

### `057_marketplace_system.sql` — Genuine Misses

**Total missing items:** 27 of 80 intended.

**GENUINELY_MISSING** (27):
- `indexes/idx_stores_status` — index not found in live catalog
- `indexes/idx_invites_store` — index not found in live catalog
- `indexes/idx_provider_requests_category_city` — index not found in live catalog
- `indexes/idx_stores_badge` — index not found in live catalog
- `indexes/idx_invites_csv` — index not found in live catalog
- `indexes/idx_inquiries_store` — index not found in live catalog
- `indexes/idx_bookings_status` — index not found in live catalog
- `indexes/idx_csv_uploads_store` — index not found in live catalog
- _… and 19 more GENUINELY_MISSING items in this category._

### `062_conflict_prediction_engine.sql` — Genuine Misses

**Total missing items:** 1 of 32 intended.

**GENUINELY_MISSING** (1):
- `views/formation_review_queue` — view not found in live catalog

### `064_trip_circle_system.sql` — Genuine Misses

**Total missing items:** 16 of 63 intended.

**GENUINELY_MISSING** (15):
- `policies/storage.storage_trip_covers_select` — table `storage` has 0 live policies; storage_trip_covers_select likely never created
- `policies/storage.storage_verification_docs_select` — table `storage` has 0 live policies; storage_verification_docs_select likely never created
- `policies/storage.storage_verification_docs_insert` — table `storage` has 0 live policies; storage_verification_docs_insert likely never created
- `policies/storage.storage_provider_photos_select` — table `storage` has 0 live policies; storage_provider_photos_select likely never created
- `policies/storage.storage_trip_media_delete` — table `storage` has 0 live policies; storage_trip_media_delete likely never created
- `policies/storage.storage_provider_photos_insert` — table `storage` has 0 live policies; storage_provider_photos_insert likely never created
- `policies/storage.storage_trip_covers_insert` — table `storage` has 0 live policies; storage_trip_covers_insert likely never created
- `policies/storage.storage_trip_covers_update` — table `storage` has 0 live policies; storage_trip_covers_update likely never created
- _… and 7 more GENUINELY_MISSING items in this category._

**DROPPED_VIEW** (1):
- `views/trip_summary` — likely one of the 18 SECURITY DEFINER views dropped in Tier 3 RLS cleanup (May 6)

### `065_trip_organizer.sql` — Genuine Misses

**Total missing items:** 4 of 62 intended.

**GENUINELY_MISSING** (4):
- `policies/storage.storage_trip_assets_select` — table `storage` has 0 live policies; storage_trip_assets_select likely never created
- `policies/storage.storage_trip_assets_insert` — table `storage` has 0 live policies; storage_trip_assets_insert likely never created
- `policies/storage.storage_trip_assets_delete` — table `storage` has 0 live policies; storage_trip_assets_delete likely never created
- `policies/storage.storage_trip_assets_update` — table `storage` has 0 live policies; storage_trip_assets_update likely never created

---

## Action list — what GENUINELY_MISSING actually looks like

Total GENUINELY_MISSING objects across all PARTIAL files: **256**

| Category | Count | Examples |
|----------|-------|----------|
| columns | 2 | `vouches.last_vouchee_default_at`, `vouches.vouchee_default_count` |
| functions | 2 | `update_cycle_timestamp`, `update_member_profile_updated_at` |
| indexes | 161 | `idx_invited_members_circle_id`, `idx_wallet_transactions_wallet_id`, `idx_circles_type` _…_ |
| policies | 55 | `wallet_transactions.wallet_transactions_insert`, `wallet_transactions.wallet_transactions_select`, `defaults.defaults_select` _…_ |
| triggers | 15 | `trigger_reserve_contribution`, `trigger_swap_requests_updated_at`, `trigger_contributions_updated_at` _…_ |
| views | 21 | `v_active_cycles`, `v_cycles_needing_attention`, `v_late_contributions_active` _…_ |

These are real holes in the live schema. Each needs an individual call:
- _Could be conditionally created (`IF NOT EXISTS`) and the conditions weren't met → safe to leave._
- _Could be intentionally removed in a later sweep we don't know about → safe to leave._
- _Could be a real bug → needs re-applying via a renumbered migration._

**Recommendation:** flag these in the recon for follow-up, but do NOT block Option A on them. Option A only inserts schema_migrations rows for files where ALL misses are noise.

---

_Read-only triage. No code, file, or database changes made._