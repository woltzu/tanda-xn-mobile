# Migration Gap Analysis

Three-way cross-reference: applied (production) vs on-disk (source).

## A) Applied AND on disk (exact match) — 30

| Version | Applied name | Disk file |
|---------|--------------|-----------|
| 001 | `create_tables` | `001_create_tables.sql` |
| 002 | `update_tables` | `002_update_tables.sql` |
| 003 | `fix_wallets` | `003_fix_wallets.sql` |
| 004 | `complete_setup` | `004_complete_setup.sql` |
| 005 | `community_system` | `005_community_system.sql` |
| 006 | `financial_profiles` | `006_financial_profiles.sql` |
| 007 | `circle_matching` | `007_circle_matching.sql` |
| 008 | `default_cascade` | `008_default_cascade.sql` |
| 009 | `payout_system` | `009_payout_system.sql` |
| 010 | `payout_order_system` | `010_payout_order_system.sql` |
| 011 | `contribution_scheduling` | `011_contribution_scheduling.sql` |
| 012 | `cycle_progression_cleanup_and_create` | `012_cycle_progression_cleanup_and_create.sql` |
| 013 | `late_contribution_handling` | `013_late_contribution_handling.sql` |
| 014 | `default_cascade_handler` | `014_default_cascade_handler.sql` |
| 015 | `payout_execution_engine` | `015_payout_execution_engine.sql` |
| 016 | `circle_dissolution` | `016_circle_dissolution.sql` |
| 017 | `member_removal_midcircle` | `017_member_removal_midcircle.sql` |
| 018 | `position_swapping` | `018_position_swapping.sql` |
| 019 | `initial_xnscore` | `019_initial_xnscore.sql` |
| 020 | `xnscore_decay_growth` | `020_xnscore_decay_growth.sql` |
| 021 | `xnscore_factor_breakdown` | `021_xnscore_factor_breakdown.sql` |
| 022 | `creditworthiness_assessment` | `022_creditworthiness_assessment.sql` |
| 023 | `interest_calculation_complete` | `023_interest_calculation_complete.sql` |
| 024 | `cleanup_first` | `024_cleanup_first.sql` |
| 025 | `security_fixes` | `025_security_fixes.sql` |
| 026 | `cron_job_logs` | `026_cron_job_logs.sql` |
| 027 | `setup_cron_schedules` | `027_setup_cron_schedules.sql` |
| 028 | `token_incentives` | `028_token_incentives.sql` |
| 029 | `api_white_label` | `029_api_white_label.sql` |
| 030 | `token_api_cron_schedules` | `030_token_api_cron_schedules.sql` |

## B) Applied to production but NO exact-name file on disk — 1

⚠️ These migrations RAN in production but the source file with that exact name isn't in the repo. This is the dangerous case — production state we can't reproduce.

| Version | Applied name | Disk files at same version | Fuzzy match? |
|---------|--------------|------------------------------|--------------|
| 032 | `elder_system` | `032_elder_context_support.sql` | — |

## C) On disk but NOT applied — 67

### C.1) Pending — version has NO applied migration (38)

These are migrations that have NEVER run in production. They may be:
- New work waiting to be pushed
- Abandoned dev iterations
- Blocked by an error that prevented application

| Version | File | Size |
|---------|------|------|
| 031 | `031_fix_circles_rotation_method.sql` | 1,239 B |
| 031 | `031_savings_context_support.sql` | 1,901 B |
| 033 | `033_feature_gates.sql` | 16,309 B |
| 034 | `034_user_events.sql` | 4,060 B |
| 035 | `035_member_financial_profiles.sql` | 33,327 B |
| 036 | `036_scoring_pipeline.sql` | 49,659 B |
| 037 | `037_honor_scores.sql` | 28,117 B |
| 038 | `038_honor_score_realignment.sql` | 26,942 B |
| 039 | `039_circle_democracy.sql` | 22,883 B |
| 040 | `040_graduated_entry.sql` | 29,138 B |
| 041 | `041_circle_insurance_pool.sql` | 31,437 B |
| 042 | `042_dynamic_payout_ordering.sql` | 13,815 B |
| 043 | `043_notification_priority_engine.sql` | 18,503 B |
| 044 | `044_sanctions_screening.sql` | 14,725 B |
| 045 | `045_aml_monitoring.sql` | 17,471 B |
| 046 | `046_explainable_ai_decisions.sql` | 40,542 B |
| 047 | `047_legal_terms_simplifier.sql` | 11,403 B |
| 048 | `048_partial_contributions.sql` | 7,644 B |
| 049 | `049_substitute_member_system.sql` | 14,735 B |
| 050 | `050_cron_ai_trigger_infrastructure.sql` | 13,277 B |
| 051 | `051_ai_recommendation_feedback_loop.sql` | 11,411 B |
| 052 | `052_circle_match_history_ml_seed.sql` | 8,258 B |
| 053 | `053_kyc_verification_system.sql` | 30,752 B |
| 054 | `054_stripe_connect_payment_system.sql` | 34,467 B |
| 055 | `055_mock_to_real_migration_scoring.sql` | 22,063 B |
| 056 | `056_community_features.sql` | 38,201 B |
| 057 | `057_marketplace_system.sql` | 32,388 B |
| 058 | `058_early_intervention_system.sql` | 20,147 B |
| 059 | `059_cross_circle_liquidity.sql` | 21,466 B |
| 060 | `060_financial_stress_prediction.sql` | 17,215 B |
| 061 | `061_contribution_mood_detection.sql` | 22,666 B |
| 062 | `062_conflict_prediction_engine.sql` | 15,443 B |
| 063 | `063_fix_missing_columns_and_rls.sql` | 3,827 B |
| 064 | `064_trip_circle_system.sql` | 23,547 B |
| 065 | `065_trip_organizer.sql` | 24,340 B |
| 066 | `066_trip_organizer_fixes.sql` | 8,181 B |
| 067 | `067_pending_joins.sql` | 2,173 B |
| 068 | `068_create_pending_join_rpc.sql` | 2,001 B |

### C.2) Orphan duplicates — version DID apply, but using a different filename (29)

These files exist alongside the one that actually ran. Likely dev iterations / superseded versions. Safe to delete after manual review.

| Version | Disk file (orphan) | Production applied this name instead |
|---------|---------------------|--------------------------------------|
| 001 | `001_dream_feed.sql` | `create_tables` |
| 005 | `005_community_system_fixed.sql` | `community_system` |
| 011 | `011_contribution_scheduling_fixed.sql` | `contribution_scheduling` |
| 012 | `012_cycle_progression_engine.sql` | `cycle_progression_cleanup_and_create` |
| 012 | `012_cycle_progression_engine_fixed.sql` | `cycle_progression_cleanup_and_create` |
| 012 | `012_cycle_progression_final.sql` | `cycle_progression_cleanup_and_create` |
| 012 | `012_cycle_progression_v2.sql` | `cycle_progression_cleanup_and_create` |
| 013 | `013_late_contribution_handling_v2.sql` | `late_contribution_handling` |
| 013 | `013_late_contribution_handling_v3.sql` | `late_contribution_handling` |
| 013 | `013_late_contribution_handling_v4.sql` | `late_contribution_handling` |
| 014 | `014_default_cascade_handler_v2.sql` | `default_cascade_handler` |
| 015 | `015_payout_execution_engine_v2.sql` | `payout_execution_engine` |
| 015 | `015_payout_execution_engine_v3.sql` | `payout_execution_engine` |
| 015 | `015_payout_execution_engine_v4.sql` | `payout_execution_engine` |
| 015 | `015_payout_execution_engine_v5.sql` | `payout_execution_engine` |
| 023 | `023_interest_calculation_system.sql` | `interest_calculation_complete` |
| 023 | `023_interest_calculation_system_fix.sql` | `interest_calculation_complete` |
| 024 | `024_monthly_payment_complete.sql` | `cleanup_first` |
| 024 | `024_monthly_payment_system.sql` | `cleanup_first` |
| 024 | `024_monthly_payment_system_fix.sql` | `cleanup_first` |
| 025 | `025_security_fixes_final.sql` | `security_fixes` |
| 025 | `025_security_fixes_v2.sql` | `security_fixes` |
| 025 | `025_security_fixes_v3.sql` | `security_fixes` |
| 025 | `025_security_rls_only.sql` | `security_fixes` |
| 026 | `026_cron_job_logs_v2.sql` | `cron_job_logs` |
| 028 | `028_dream_feed_fixes.sql` | `token_incentives` |
| 029 | `029_feed_storage_bucket.sql` | `api_white_label` |
| 030 | `030_circle_profile_fkeys.sql` | `token_api_cron_schedules` |
| 032 | `032_elder_context_support.sql` | `elder_system` |

## Summary

- **Applied AND on disk (matched name):** 30
- **Applied but no exact file on disk:** 1
- **Pending (version never applied, files exist):** 37 versions, 38 files
- **Orphan duplicates (same version, different file ran):** 29
- **Total files on disk:** 97 (numbered)