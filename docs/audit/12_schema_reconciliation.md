# Schema Reconciliation

**Purpose:** compare the live schema against the 64 active migration files
to determine where `schema_migrations` is out of sync with reality.

**Method:** live schema extracted via Supabase Management API (`pg_catalog` + `information_schema`). Each migration file is parsed for the
objects it intends to create (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `CREATE FUNCTION`, `CREATE POLICY`, `CREATE TRIGGER`, `CREATE INDEX`, `CREATE VIEW`, `CREATE TYPE`). Each intended object is checked against the live catalog.

**Source:** project `fjqdkyjkwqeoafwvnjgv` · 346 tables · 5984 columns · 319 functions · 698 policies · 193 triggers · 1242 indexes · 36 views · 436 types

**schema_migrations rows:** 31

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| ✅ FULLY   | All DDL objects this file intends to create exist in live schema |
| ⚠️ PARTIAL | Some intended objects exist, others missing — **MANUAL REVIEW REQUIRED** |
| ❌ NONE    | None of its DDL objects exist in the live schema |
| ⚪ EMPTY   | File contains no detectable DDL (e.g. cleanup/`DROP`/`UPDATE`-only) |

**`sm_match`** = the migration's (version, name) tuple appears in `supabase_migrations.schema_migrations`.

## Summary counts

| Status | Count |
|--------|-------|
| ✅ Fully applied | 36 |
| ⚠️ Partially applied (MANUAL REVIEW) | 26 |
| ❌ Not applied | 0 |
| ⚪ Empty / no DDL | 2 |
| **Total** | **64** |

Sync gap with `schema_migrations`:
- Files marked FULLY: 36
- Of those, also tracked in `schema_migrations`: 7
- FULLY but NOT tracked (silent applies): 29
- Tracked but file status not FULLY: 20

---

## Per-migration status

| Version | File | Status | Tracked? | Found / Intended | Detail |
|---------|------|--------|----------|------------------|--------|
| 001 | `001_create_tables.sql` | ⚠️ PARTIAL | ✅ | 18/47 | tables:8/8 · functions:3/3 · policies:0/16 · triggers:2/3 · indexes:5/17 |
| 002 | `002_update_tables.sql` | ⚠️ PARTIAL | ✅ | 18/46 | tables:8/8 · functions:3/3 · policies:0/16 · triggers:2/3 · indexes:5/16 |
| 003 | `003_fix_wallets.sql` | ✅ FULLY | ✅ | 6/6 | columns:4/4 · functions:1/1 · triggers:1/1 |
| 004 | `004_complete_setup.sql` | ⚠️ PARTIAL | ✅ | 34/37 | tables:8/8 · columns:4/4 · functions:3/3 · policies:17/19 · triggers:2/3 |
| 005 | `005_community_system.sql` | ⚠️ PARTIAL | ✅ | 67/86 | tables:15/15 · columns:1/1 · functions:4/4 · policies:27/28 · triggers:3/3 · indexes:17/35 |
| 006 | `006_financial_profiles.sql` | ⚠️ PARTIAL | ✅ | 25/26 | tables:3/3 · columns:3/3 · functions:5/5 · policies:6/6 · triggers:2/2 · indexes:6/7 |
| 007 | `007_circle_matching.sql` | ✅ FULLY | ✅ | 34/34 | tables:4/4 · functions:5/5 · policies:11/11 · triggers:4/4 · indexes:10/10 |
| 008 | `008_default_cascade.sql` | ⚠️ PARTIAL | ✅ | 29/42 | tables:6/6 · columns:4/4 · functions:4/4 · policies:3/7 · triggers:0/1 · indexes:12/20 |
| 009 | `009_payout_system.sql` | ✅ FULLY | ✅ | 44/44 | tables:5/5 · columns:10/10 · functions:3/3 · policies:9/9 · triggers:6/6 · indexes:11/11 |
| 010 | `010_payout_order_system.sql` | ⚠️ PARTIAL | ✅ | 44/48 | tables:10/10 · functions:5/5 · policies:8/11 · triggers:4/5 · indexes:17/17 |
| 011 | `011_contribution_scheduling.sql` | ⚠️ PARTIAL | ✅ | 47/51 | tables:6/6 · columns:15/15 · functions:4/4 · policies:4/7 · triggers:2/3 · indexes:16/16 |
| 012 | `012_cycle_progression_cleanup_and_create.sql` | ⚠️ PARTIAL | ✅ | 26/73 | tables:14/14 · columns:6/6 · functions:4/5 · policies:0/15 · triggers:0/4 · indexes:2/27 · views:0/2 |
| 013 | `013_late_contribution_handling.sql` | ⚠️ PARTIAL | ✅ | 23/55 | tables:9/9 · columns:8/8 · functions:4/4 · policies:0/11 · triggers:2/2 · indexes:0/19 · views:0/2 |
| 014 | `014_default_cascade_handler.sql` | ⚠️ PARTIAL | ✅ | 22/64 | tables:8/8 · columns:10/12 · functions:4/4 · policies:0/8 · triggers:0/4 · indexes:0/24 · views:0/4 |
| 015 | `015_payout_execution_engine.sql` | ⚠️ PARTIAL | ✅ | 51/55 | tables:8/8 · columns:4/4 · functions:4/4 · policies:12/12 · triggers:4/4 · indexes:17/19 · views:2/4 |
| 016 | `016_circle_dissolution.sql` | ⚠️ PARTIAL | ✅ | 57/59 | tables:6/6 · functions:16/16 · policies:8/10 · triggers:4/4 · indexes:16/16 · views:3/3 · types:4/4 |
| 017 | `017_member_removal_midcircle.sql` | ✅ FULLY | ✅ | 51/51 | tables:7/7 · functions:11/11 · policies:13/13 · triggers:4/4 · indexes:10/10 · views:3/3 · types:3/3 |
| 018 | `018_position_swapping.sql` | ✅ FULLY | ✅ | 39/39 | tables:3/3 · columns:1/1 · functions:13/13 · policies:7/7 · triggers:1/1 · indexes:9/9 · views:3/3 · types:2/2 |
| 019 | `019_initial_xnscore.sql` | ⚠️ PARTIAL | ✅ | 57/58 | tables:6/6 · columns:1/1 · functions:15/15 · policies:8/8 · triggers:3/4 · indexes:17/17 · views:3/3 · types:4/4 |
| 020 | `020_xnscore_decay_growth.sql` | ✅ FULLY | ✅ | 68/68 | tables:3/3 · columns:20/20 · functions:21/21 · policies:3/3 · triggers:4/4 · indexes:11/11 · views:4/4 · types:2/2 |
| 021 | `021_xnscore_factor_breakdown.sql` | ⚠️ PARTIAL | ✅ | 45/46 | tables:4/4 · columns:4/4 · functions:15/15 · policies:4/4 · triggers:3/3 · indexes:9/9 · views:2/3 · types:4/4 |
| 022 | `022_creditworthiness_assessment.sql` | ⚠️ PARTIAL | ✅ | 78/79 | tables:8/8 · functions:19/19 · policies:8/8 · triggers:6/6 · indexes:25/25 · views:3/4 · types:9/9 |
| 023 | `023_interest_calculation_complete.sql` | ✅ FULLY | ✅ | 63/63 | tables:6/6 · columns:21/21 · functions:14/14 · policies:6/6 · triggers:1/1 · indexes:7/7 · views:3/3 · types:5/5 |
| 024 | `024_cleanup_first.sql` | ⚪ EMPTY | ✅ | 0/0 |  |
| 025 | `025_security_fixes.sql` | ⚠️ PARTIAL | ✅ | 36/48 | policies:6/6 · views:30/42 |
| 026 | `026_cron_job_logs.sql` | ⚠️ PARTIAL | ✅ | 7/14 | tables:2/2 · policies:2/5 · indexes:3/5 · views:0/2 |
| 027 | `027_setup_cron_schedules.sql` | ⚪ EMPTY | ✅ | 0/0 |  |
| 032 | `032_elder_context_support.sql` | ✅ FULLY | — | 8/8 | columns:2/2 · policies:4/4 · indexes:2/2 |
| 033 | `033_feature_gates.sql` | ✅ FULLY | — | 11/11 | tables:2/2 · functions:1/1 · policies:2/2 · triggers:1/1 · indexes:5/5 |
| 034 | `034_user_events.sql` | ⚠️ PARTIAL | — | 10/11 | tables:1/1 · functions:1/1 · policies:2/2 · indexes:6/6 · views:0/1 |
| 035 | `035_member_financial_profiles.sql` | ⚠️ PARTIAL | — | 8/31 | tables:5/5 · functions:3/4 · policies:0/5 · triggers:0/3 · indexes:0/14 |
| 036 | `036_scoring_pipeline.sql` | ✅ FULLY | — | 36/36 | tables:6/6 · functions:8/8 · policies:6/6 · triggers:2/2 · indexes:14/14 |
| 037 | `037_honor_scores.sql` | ✅ FULLY | — | 18/18 | tables:2/2 · columns:1/1 · functions:3/3 · policies:5/5 · triggers:1/1 · indexes:6/6 |
| 038 | `038_honor_score_realignment.sql` | ✅ FULLY | — | 21/21 | tables:3/3 · columns:1/1 · functions:2/2 · policies:8/8 · triggers:1/1 · indexes:6/6 |
| 039 | `039_circle_democracy.sql` | ✅ FULLY | — | 27/27 | tables:3/3 · functions:3/3 · policies:9/9 · triggers:3/3 · indexes:9/9 |
| 040 | `040_graduated_entry.sql` | ✅ FULLY | — | 26/26 | tables:4/4 · columns:1/1 · functions:3/3 · policies:9/9 · triggers:2/2 · indexes:7/7 |
| 041 | `041_circle_insurance_pool.sql` | ✅ FULLY | — | 30/30 | tables:4/4 · columns:2/2 · functions:5/5 · policies:8/8 · triggers:2/2 · indexes:9/9 |
| 042 | `042_dynamic_payout_ordering.sql` | ✅ FULLY | — | 29/29 | tables:4/4 · columns:9/9 · policies:8/8 · triggers:1/1 · indexes:7/7 |
| 043 | `043_notification_priority_engine.sql` | ✅ FULLY | — | 22/22 | tables:3/3 · columns:4/4 · policies:6/6 · triggers:2/2 · indexes:7/7 |
| 044 | `044_sanctions_screening.sql` | ✅ FULLY | — | 30/30 | tables:4/4 · columns:5/5 · policies:9/9 · triggers:2/2 · indexes:10/10 |
| 045 | `045_aml_monitoring.sql` | ✅ FULLY | — | 24/24 | tables:4/4 · columns:3/3 · policies:5/5 · triggers:3/3 · indexes:9/9 |
| 046 | `046_explainable_ai_decisions.sql` | ✅ FULLY | — | 11/11 | tables:2/2 · policies:4/4 · triggers:1/1 · indexes:4/4 |
| 047 | `047_legal_terms_simplifier.sql` | ✅ FULLY | — | 22/22 | tables:4/4 · policies:9/9 · triggers:3/3 · indexes:6/6 |
| 048 | `048_partial_contributions.sql` | ✅ FULLY | — | 11/11 | tables:1/1 · columns:3/3 · policies:2/2 · triggers:1/1 · indexes:4/4 |
| 049 | `049_substitute_member_system.sql` | ✅ FULLY | — | 26/26 | tables:3/3 · policies:10/10 · triggers:3/3 · indexes:10/10 |
| 050 | `050_cron_ai_trigger_infrastructure.sql` | ⚠️ PARTIAL | — | 10/12 | tables:2/2 · policies:2/4 · indexes:6/6 |
| 051 | `051_ai_recommendation_feedback_loop.sql` | ✅ FULLY | — | 17/17 | tables:2/2 · policies:5/5 · triggers:1/1 · indexes:9/9 |
| 052 | `052_circle_match_history_ml_seed.sql` | ✅ FULLY | — | 17/17 | tables:1/1 · columns:7/7 · policies:2/2 · triggers:1/1 · indexes:6/6 |
| 053 | `053_kyc_verification_system.sql` | ✅ FULLY | — | 49/49 | tables:9/9 · functions:1/1 · policies:14/14 · triggers:4/4 · indexes:21/21 |
| 054 | `054_stripe_connect_payment_system.sql` | ✅ FULLY | — | 78/78 | tables:9/9 · functions:3/3 · policies:19/19 · triggers:9/9 · indexes:38/38 |
| 055 | `055_mock_to_real_migration_scoring.sql` | ⚠️ PARTIAL | — | 27/28 | tables:3/3 · functions:3/3 · policies:6/6 · triggers:3/3 · indexes:11/11 · views:1/2 |
| 056 | `056_community_features.sql` | ✅ FULLY | — | 114/114 | tables:13/13 · functions:7/7 · policies:45/45 · triggers:12/12 · indexes:37/37 |
| 057 | `057_marketplace_system.sql` | ⚠️ PARTIAL | — | 53/80 | tables:10/10 · functions:4/4 · policies:28/28 · triggers:9/9 · indexes:2/29 |
| 058 | `058_early_intervention_system.sql` | ✅ FULLY | — | 24/24 | tables:3/3 · functions:2/2 · policies:7/7 · triggers:2/2 · indexes:9/9 · views:1/1 |
| 059 | `059_cross_circle_liquidity.sql` | ✅ FULLY | — | 37/37 | tables:5/5 · functions:3/3 · policies:11/11 · triggers:6/6 · indexes:11/11 · views:1/1 |
| 060 | `060_financial_stress_prediction.sql` | ✅ FULLY | — | 32/32 | tables:4/4 · functions:3/3 · policies:9/9 · triggers:3/3 · indexes:12/12 · views:1/1 |
| 061 | `061_contribution_mood_detection.sql` | ✅ FULLY | — | 45/45 | tables:6/6 · functions:4/4 · policies:16/16 · triggers:4/4 · indexes:14/14 · views:1/1 |
| 062 | `062_conflict_prediction_engine.sql` | ⚠️ PARTIAL | — | 31/32 | tables:4/4 · functions:3/3 · policies:5/5 · triggers:3/3 · indexes:15/15 · views:1/2 |
| 063 | `063_fix_missing_columns_and_rls.sql` | ✅ FULLY | — | 5/5 | columns:4/4 · policies:1/1 |
| 064 | `064_trip_circle_system.sql` | ⚠️ PARTIAL | — | 47/63 | tables:6/6 · functions:1/1 · policies:24/39 · triggers:5/5 · indexes:11/11 · views:0/1 |
| 065 | `065_trip_organizer.sql` | ⚠️ PARTIAL | — | 58/62 | tables:8/8 · policies:31/35 · triggers:5/5 · indexes:14/14 |
| 066 | `066_trip_organizer_fixes.sql` | ✅ FULLY | — | 23/23 | columns:1/1 · functions:2/2 · policies:19/19 · indexes:1/1 |
| 067 | `067_pending_joins.sql` | ✅ FULLY | — | 6/6 | tables:1/1 · policies:3/3 · indexes:2/2 |
| 068 | `068_create_pending_join_rpc.sql` | ✅ FULLY | — | 1/1 | functions:1/1 |

---

## High-risk PARTIAL applications (MANUAL REVIEW REQUIRED)

26 files have some DDL applied and some missing. **Do not auto-fix.** These need eyeballing because the missing pieces could be:

- Genuinely never applied (safe to apply if re-numbered)
- Conditionally skipped at run time (`IF NOT EXISTS` / `IF EXISTS`) — already-effective even though not present as-named
- Renamed objects (e.g., function got refactored to a different name in a later migration)
- Dropped objects (intentionally removed by a later cleanup like Tier 2 token-system removal)

### `001_create_tables.sql` — tables:8/8 · functions:3/3 · policies:0/16 · triggers:2/3 · indexes:5/17

Missing objects:
- **indexes** (12): `for, idx_circle_members_circle_id, idx_circle_members_user_id, idx_circles_type, idx_contributions_circle_id, idx_contributions_user_id, idx_invited_members_circle_id, idx_invited_members_phone, idx_payouts_circle_id, idx_payouts_recipient_id` _… and 2 more_
- **policies** (16): `circle_members.Anyone can view circle members, circle_members.Authenticated users can join circles, circles.Anyone can view circles, circles.Authenticated users can create circles, circles.Circle creators can update their circles, contributions.Users can make contributions, contributions.Users can view contributions in their circles, invited_members.Anyone can view invited members, invited_members.Circle creators can invite members, payouts.Users can view payouts in their circles` _… and 6 more_
- **triggers** (1): `on_auth_user_created`

### `002_update_tables.sql` — tables:8/8 · functions:3/3 · policies:0/16 · triggers:2/3 · indexes:5/16

Missing objects:
- **indexes** (11): `idx_circle_members_circle_id, idx_circle_members_user_id, idx_circles_type, idx_contributions_circle_id, idx_contributions_user_id, idx_invited_members_circle_id, idx_invited_members_phone, idx_payouts_circle_id, idx_payouts_recipient_id, idx_wallet_transactions_wallet_id` _… and 1 more_
- **policies** (16): `circle_members.Anyone can view circle members, circle_members.Authenticated users can join circles, circles.Anyone can view circles, circles.Authenticated users can create circles, circles.Circle creators can update their circles, contributions.Users can make contributions, contributions.Users can view contributions in their circles, invited_members.Anyone can view invited members, invited_members.Circle creators can invite members, payouts.Users can view payouts in their circles` _… and 6 more_
- **triggers** (1): `on_auth_user_created`

### `004_complete_setup.sql` — tables:8/8 · columns:4/4 · functions:3/3 · policies:17/19 · triggers:2/3

Missing objects:
- **policies** (2): `wallet_transactions.wallet_transactions_insert, wallet_transactions.wallet_transactions_select`
- **triggers** (1): `on_auth_user_created`

### `005_community_system.sql` — tables:15/15 · columns:1/1 · functions:4/4 · policies:27/28 · triggers:3/3 · indexes:17/35

Missing objects:
- **indexes** (18): `idx_community_health_community, idx_community_health_date, idx_community_invitations_invitee, idx_community_memberships_role, idx_council_votes_community, idx_council_votes_status, idx_defaults_circle, idx_defaults_community, idx_defaults_status, idx_defaults_user` _… and 8 more_
- **policies** (1): `defaults.defaults_select`

### `006_financial_profiles.sql` — tables:3/3 · columns:3/3 · functions:5/5 · policies:6/6 · triggers:2/2 · indexes:6/7

Missing objects:
- **indexes** (1): `for`

### `008_default_cascade.sql` — tables:6/6 · columns:4/4 · functions:4/4 · policies:3/7 · triggers:0/1 · indexes:12/20

Missing objects:
- **indexes** (8): `idx_installments_due_date, idx_installments_plan, idx_installments_status, idx_payment_plans_status, idx_payment_plans_user, idx_reserve_transactions_community, idx_reserve_transactions_date, idx_reserve_transactions_type`
- **policies** (4): `default_escalations.Users can view own escalations, default_recovery_attempts.Users can view own recovery attempts, payment_plan_installments.Users can view own installments, reserve_fund_transactions.Community members can view reserve transactions`
- **triggers** (1): `trigger_reserve_contribution`

### `010_payout_order_system.sql` — tables:10/10 · functions:5/5 · policies:8/11 · triggers:4/5 · indexes:17/17

Missing objects:
- **policies** (3): `position_swap_requests.Parties can update swap requests, position_swap_requests.Requester can create swap requests, position_swap_requests.Swap request parties can view`
- **triggers** (1): `trigger_swap_requests_updated_at`

### `011_contribution_scheduling.sql` — tables:6/6 · columns:15/15 · functions:4/4 · policies:4/7 · triggers:2/3 · indexes:16/16

Missing objects:
- **policies** (3): `contributions.Circle admins can view all contributions, contributions.Users can view own contributions, late_fee_config.Anyone can view late fee config`
- **triggers** (1): `trigger_contributions_updated_at`

### `012_cycle_progression_cleanup_and_create.sql` — tables:14/14 · columns:6/6 · functions:4/5 · policies:0/15 · triggers:0/4 · indexes:2/27 · views:0/2

Missing objects:
- **functions** (1): `update_cycle_timestamp`
- **indexes** (25): `idx_circle_cycles_circle, idx_circle_cycles_deadline, idx_circle_cycles_payout, idx_circle_cycles_recipient, idx_circle_cycles_scheduled, idx_circle_cycles_status, idx_cron_job_logs_type, idx_cycle_contributions_cycle, idx_cycle_contributions_pending, idx_cycle_contributions_status` _… and 15 more_
- **policies** (15): `circle_completions.Members can view circle completions, circle_cycles.Members can view circle cycles, cron_job_logs.Only admins can view cron logs, cycle_contributions.Users can view own contributions, cycle_engine_runs.Only admins can view engine runs, cycle_events.Members can view cycle events, member_defaults.Users can view own defaults, ops_alerts.Only admins can view ops alerts, reserve_fund_transactions.Leaders can view reserve transactions, reserve_funds.Community members can view reserve` _… and 5 more_
- **triggers** (4): `trigger_circle_cycles_updated, trigger_cycle_contributions_updated, trigger_defaults_updated, trigger_update_cycle_totals`
- **views** (2): `v_active_cycles, v_cycles_needing_attention`

### `013_late_contribution_handling.sql` — tables:9/9 · columns:8/8 · functions:4/4 · policies:0/11 · triggers:2/2 · indexes:0/19 · views:0/2

Missing objects:
- **indexes** (19): `idx_installments_due, idx_installments_plan, idx_late_contrib_circle, idx_late_contrib_cycle, idx_late_contrib_grace_end, idx_late_contrib_status, idx_late_contrib_unresolved, idx_late_contrib_user, idx_late_events_late, idx_late_events_type` _… and 9 more_
- **policies** (11): `auto_retry_config.retry_config_select, auto_retry_history.retry_history_select, late_contribution_events.late_events_select, late_contributions.late_contrib_select, payment_plan_installments.installments_select, payment_plans.payment_plans_insert, payment_plans.payment_plans_select, redistribution_requests.redist_select, redistribution_responses.redist_resp_select, redistribution_responses.redist_resp_update` _… and 1 more_
- **views** (2): `v_late_contributions_active, v_payment_plan_progress`

### `014_default_cascade_handler.sql` — tables:8/8 · columns:10/12 · functions:4/4 · policies:0/8 · triggers:0/4 · indexes:0/24 · views:0/4

Missing objects:
- **columns** (2): `vouches.last_vouchee_default_at, vouches.vouchee_default_count`
- **indexes** (24): `idx_cdr_circle, idx_cdr_default, idx_cdr_recipient, idx_ce_cascade, idx_ce_default, idx_ce_type, idx_def_cascade, idx_def_circle, idx_def_community, idx_def_status` _… and 14 more_
- **policies** (8): `cascade_events.ce_select_policy, circle_default_resolutions.cdr_select_policy, defaults.def_select_policy, member_debts.md_select_policy, recovery_plan_installments.rpi_select_policy, recovery_plans.rp_select_policy, suspension_reviews.sr_select_policy, voucher_default_impacts.vdi_select_policy`
- **triggers** (4): `trg_defaults_ts, trg_member_debts_ts, trg_recovery_plans_ts, trg_suspension_reviews_ts`
- **views** (4): `v_active_cascades, v_circle_resolution_stats, v_recovery_performance, v_voucher_impact_summary`

### `015_payout_execution_engine.sql` — tables:8/8 · columns:4/4 · functions:4/4 · policies:12/12 · triggers:4/4 · indexes:17/19 · views:2/4

Missing objects:
- **indexes** (2): `idx_pe_cr_due, idx_pe_wt_reference`
- **views** (2): `v_pending_reservations, v_wallet_overview`

### `016_circle_dissolution.sql` — tables:6/6 · functions:16/16 · policies:8/10 · triggers:4/4 · indexes:16/16 · views:3/3 · types:4/4

Missing objects:
- **policies** (2): `their.Members can vote, their.Users can view votes`

### `019_initial_xnscore.sql` — tables:6/6 · columns:1/1 · functions:15/15 · policies:8/8 · triggers:3/4 · indexes:17/17 · views:3/3 · types:4/4

Missing objects:
- **triggers** (1): `tr_profile_xnscore_init`

### `021_xnscore_factor_breakdown.sql` — tables:4/4 · columns:4/4 · functions:15/15 · policies:4/4 · triggers:3/3 · indexes:9/9 · views:2/3 · types:4/4

Missing objects:
- **views** (1): `v_user_score_breakdown`

### `022_creditworthiness_assessment.sql` — tables:8/8 · functions:19/19 · policies:8/8 · triggers:6/6 · indexes:25/25 · views:3/4 · types:9/9

Missing objects:
- **views** (1): `v_creditworthiness_summary`

### `025_security_fixes.sql` — policies:6/6 · views:30/42

Missing objects:
- **views** (12): `v_active_cascades, v_active_cycles, v_circle_resolution_stats, v_creditworthiness_summary, v_cycles_needing_attention, v_late_contributions_active, v_payment_plan_progress, v_pending_reservations, v_recovery_performance, v_user_score_breakdown` _… and 2 more_

### `026_cron_job_logs.sql` — tables:2/2 · policies:2/5 · indexes:3/5 · views:0/2

Missing objects:
- **indexes** (2): `idx_notifications_unread, idx_notifications_user_id`
- **policies** (3): `notifications.notifications_own_select, notifications.notifications_own_update, notifications.notifications_service_insert`
- **views** (2): `v_cron_job_stats, v_recent_cron_jobs`

### `034_user_events.sql` — tables:1/1 · functions:1/1 · policies:2/2 · indexes:6/6 · views:0/1

Missing objects:
- **views** (1): `daily_event_summary`

### `035_member_financial_profiles.sql` — tables:5/5 · functions:3/4 · policies:0/5 · triggers:0/3 · indexes:0/14

Missing objects:
- **functions** (1): `update_member_profile_updated_at`
- **indexes** (14): `idx_mbp_computed, idx_mbp_payment_trend, idx_mbp_risk, idx_mbp_user, idx_mnm_influence, idx_mnm_user, idx_mps_date, idx_mps_period, idx_mps_user_date, idx_mri_risk` _… and 4 more_
- **policies** (5): `member_behavioral_profiles.mbp_select_own, member_network_metrics.mnm_select_own, member_profile_snapshots.mps_select_own, member_risk_indicators.mri_select_own, member_session_analytics.msa_select_own`
- **triggers** (3): `trg_mbp_updated_at, trg_mnm_updated_at, trg_mri_updated_at`

### `050_cron_ai_trigger_infrastructure.sql` — tables:2/2 · policies:2/4 · indexes:6/6

Missing objects:
- **policies** (2): `cohort_analytics.cohort_admin_select, model_performance_logs.model_perf_admin_select`

### `055_mock_to_real_migration_scoring.sql` — tables:3/3 · functions:3/3 · policies:6/6 · triggers:3/3 · indexes:11/11 · views:1/2

Missing objects:
- **views** (1): `migration_dashboard`

### `057_marketplace_system.sql` — tables:10/10 · functions:4/4 · policies:28/28 · triggers:9/9 · indexes:2/29

Missing objects:
- **indexes** (27): `idx_bookings_circle, idx_bookings_member, idx_bookings_payout_date, idx_bookings_status, idx_bookings_store, idx_csv_uploads_store, idx_disputes_booking, idx_inquiries_store, idx_inquiries_user, idx_invites_batch` _… and 17 more_

### `062_conflict_prediction_engine.sql` — tables:4/4 · functions:3/3 · policies:5/5 · triggers:3/3 · indexes:15/15 · views:1/2

Missing objects:
- **views** (1): `formation_review_queue`

### `064_trip_circle_system.sql` — tables:6/6 · functions:1/1 · policies:24/39 · triggers:5/5 · indexes:11/11 · views:0/1

Missing objects:
- **policies** (15): `storage.storage_provider_photos_delete, storage.storage_provider_photos_insert, storage.storage_provider_photos_select, storage.storage_provider_photos_update, storage.storage_trip_covers_delete, storage.storage_trip_covers_insert, storage.storage_trip_covers_select, storage.storage_trip_covers_update, storage.storage_trip_media_delete, storage.storage_trip_media_insert` _… and 5 more_
- **views** (1): `trip_summary`

### `065_trip_organizer.sql` — tables:8/8 · policies:31/35 · triggers:5/5 · indexes:14/14

Missing objects:
- **policies** (4): `storage.storage_trip_assets_delete, storage.storage_trip_assets_insert, storage.storage_trip_assets_select, storage.storage_trip_assets_update`


---

## Silent applies — fully present but NOT in `schema_migrations`

29 files appear fully applied in the live schema yet have no row in
`schema_migrations`. These were almost certainly executed directly via the SQL Editor
(or merged from a renamed file), bypassing the migration tracker:

| Version | File | Detail |
|---------|------|--------|
| 032 | `032_elder_context_support.sql` | columns:2/2 · policies:4/4 · indexes:2/2 |
| 033 | `033_feature_gates.sql` | tables:2/2 · functions:1/1 · policies:2/2 · triggers:1/1 · indexes:5/5 |
| 036 | `036_scoring_pipeline.sql` | tables:6/6 · functions:8/8 · policies:6/6 · triggers:2/2 · indexes:14/14 |
| 037 | `037_honor_scores.sql` | tables:2/2 · columns:1/1 · functions:3/3 · policies:5/5 · triggers:1/1 · indexes:6/6 |
| 038 | `038_honor_score_realignment.sql` | tables:3/3 · columns:1/1 · functions:2/2 · policies:8/8 · triggers:1/1 · indexes:6/6 |
| 039 | `039_circle_democracy.sql` | tables:3/3 · functions:3/3 · policies:9/9 · triggers:3/3 · indexes:9/9 |
| 040 | `040_graduated_entry.sql` | tables:4/4 · columns:1/1 · functions:3/3 · policies:9/9 · triggers:2/2 · indexes:7/7 |
| 041 | `041_circle_insurance_pool.sql` | tables:4/4 · columns:2/2 · functions:5/5 · policies:8/8 · triggers:2/2 · indexes:9/9 |
| 042 | `042_dynamic_payout_ordering.sql` | tables:4/4 · columns:9/9 · policies:8/8 · triggers:1/1 · indexes:7/7 |
| 043 | `043_notification_priority_engine.sql` | tables:3/3 · columns:4/4 · policies:6/6 · triggers:2/2 · indexes:7/7 |
| 044 | `044_sanctions_screening.sql` | tables:4/4 · columns:5/5 · policies:9/9 · triggers:2/2 · indexes:10/10 |
| 045 | `045_aml_monitoring.sql` | tables:4/4 · columns:3/3 · policies:5/5 · triggers:3/3 · indexes:9/9 |
| 046 | `046_explainable_ai_decisions.sql` | tables:2/2 · policies:4/4 · triggers:1/1 · indexes:4/4 |
| 047 | `047_legal_terms_simplifier.sql` | tables:4/4 · policies:9/9 · triggers:3/3 · indexes:6/6 |
| 048 | `048_partial_contributions.sql` | tables:1/1 · columns:3/3 · policies:2/2 · triggers:1/1 · indexes:4/4 |
| 049 | `049_substitute_member_system.sql` | tables:3/3 · policies:10/10 · triggers:3/3 · indexes:10/10 |
| 051 | `051_ai_recommendation_feedback_loop.sql` | tables:2/2 · policies:5/5 · triggers:1/1 · indexes:9/9 |
| 052 | `052_circle_match_history_ml_seed.sql` | tables:1/1 · columns:7/7 · policies:2/2 · triggers:1/1 · indexes:6/6 |
| 053 | `053_kyc_verification_system.sql` | tables:9/9 · functions:1/1 · policies:14/14 · triggers:4/4 · indexes:21/21 |
| 054 | `054_stripe_connect_payment_system.sql` | tables:9/9 · functions:3/3 · policies:19/19 · triggers:9/9 · indexes:38/38 |
| 056 | `056_community_features.sql` | tables:13/13 · functions:7/7 · policies:45/45 · triggers:12/12 · indexes:37/37 |
| 058 | `058_early_intervention_system.sql` | tables:3/3 · functions:2/2 · policies:7/7 · triggers:2/2 · indexes:9/9 · views:1/1 |
| 059 | `059_cross_circle_liquidity.sql` | tables:5/5 · functions:3/3 · policies:11/11 · triggers:6/6 · indexes:11/11 · views:1/1 |
| 060 | `060_financial_stress_prediction.sql` | tables:4/4 · functions:3/3 · policies:9/9 · triggers:3/3 · indexes:12/12 · views:1/1 |
| 061 | `061_contribution_mood_detection.sql` | tables:6/6 · functions:4/4 · policies:16/16 · triggers:4/4 · indexes:14/14 · views:1/1 |
| 063 | `063_fix_missing_columns_and_rls.sql` | columns:4/4 · policies:1/1 |
| 066 | `066_trip_organizer_fixes.sql` | columns:1/1 · functions:2/2 · policies:19/19 · indexes:1/1 |
| 067 | `067_pending_joins.sql` | tables:1/1 · policies:3/3 · indexes:2/2 |
| 068 | `068_create_pending_join_rpc.sql` | functions:1/1 |

---

## NOT applied — pending migrations

_All migrations have at least some footprint in the live schema._

---

## Options for resolving the sync gap

These are **alternatives, not steps** — you pick one and tell me to execute. No execution yet.

### Option A — Update `schema_migrations` to reflect reality

**What it does:** insert version rows into `supabase_migrations.schema_migrations` for every
FULLY-applied file that isn't already tracked. The result: `schema_migrations` becomes a true
ledger of what's actually in the database.

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
  ('032', 'elder_context_support', ARRAY[]::text[]),
  ('033', 'feature_gates', ARRAY[]::text[]),
  ('036', 'scoring_pipeline', ARRAY[]::text[]),
  -- (one row per silent-applied migration)
;
```

**Approximate rows to insert:** 29 (the silent-apply list above)

**Pros:**
- Quick — a single `INSERT` transaction.
- Non-destructive — no schema changes.
- Preserves all 68 migration filenames intact for git history / forensics.
- Future `supabase db push` will see the tracker is up to date.

**Cons / risks:**
- If a file's APPLIED content (in production) differs from its DISK content, this hides the drift.
  e.g., a migration that was tweaked in SQL Editor then committed to git with a different body —
  this option marks both as identical without verifying.
- PARTIAL applications stay PARTIAL — this option doesn't fix them, just labels FULLY ones.
- The dual-store problem persists: the source of truth is now split between `schema_migrations`
  (says: these versions are applied) and the actual content (which may have diverged).

**Recommended when:** you trust that the disk content matches production, you want minimum disruption,
and you accept that future drift detection is best-effort.

### Option B — Generate a new baseline migration; reset the tracker

**What it does:** treat the live schema as the new baseline. Dump it to a single migration file
(`100_baseline_2026-05-20.sql`), archive the existing 64 active files, then reset `schema_migrations`
to contain only the new baseline.

```bash
# Roughly:
supabase db dump --linked --schema public --schema-only > 100_baseline_2026-05-20.sql
# Move existing 64 files to supabase/migrations/archive-pre-baseline/
# Truncate schema_migrations and insert one row for 100_baseline
```

**Pros:**
- Clean slate. Tracker and disk are guaranteed to match the database (one file = the full schema).
- Future drift detection is exact — any new migration is a delta vs the known-good baseline.
- New contributors don't have to wade through 64 files with mixed apply status.

**Cons / risks:**
- Loses per-feature migration history. `git blame` on a future schema change can't trace back to
  the original migration (e.g. which migration first added `circles.rotation_method`).
- Larger commit, more review surface area.
- If the baseline dump itself is incomplete (custom roles, grants, extensions, search_path)
  you discover that only when a fresh dev environment fails to spin up.
- Requires moving the 64 active files to a NEW archive folder — increases the on-disk archive size.

**Recommended when:** you're about to onboard new developers, you want clean future drift detection,
and you accept losing per-migration history for a cleaner present.

### Recommendation

Pick **Option A** if you want low risk and you trust that the 31 tracked + 29 silent-applied
migrations all match their disk content. Pick **Option B** if you're about to spin up another dev
environment or onboard contributors, and you want the schema-tracker store to be authoritative going forward.

Either way: the PARTIAL files above are a separate decision (resolve those first regardless).

---

_Read-only audit. No database changes, no migration runs, no file moves._