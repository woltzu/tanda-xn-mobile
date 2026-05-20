# Migration Inventory

**Scope:** all `.sql` files in `supabase/migrations/` (excluding subfolders).
**Total files:** 98
**Applied to production:** 31

**Categories:**
- **A — Core money loop**: required for MVP (wallets, contributions, payouts, circles, savings, KYC, Stripe).
- **B — Trust & governance**: scoring, elders, defaults, RLS-hardening, AI/compliance. Phase after core stable.
- **C — Growth & engagement**: dream feed, marketplace, trips, AI recs, tokens. Not needed for first launch.
- **D — Dead / duplicate / superseded**: another file with the same version was applied, or feature was removed.

**Exists-in-prod** column reflects whether the TABLES this file creates currently exist (probed in `03_table_inventory.md`). Functions/columns are marked `? unknown` unless verified.

---

## Category totals

| Category | Count |
|----------|-------|
| A — Core money loop | 19 |
| B — Trust & governance | 39 |
| C — Growth & engagement | 6 |
| D — Dead / duplicate / superseded | 34 |
| ? — Ambiguous (manual review needed) | 0 |

---

## Full inventory

| # | Filename | Cat | Objects Created | Exists in Prod? | Applied? | Notes |
|---|----------|-----|-----------------|------------------|----------|-------|
| --- | `verify_functions.sql` | 🅳 D | (no DDL detected) | — | ❌ | Utility/helper SQL, not a migration. |
| 001 | `001_create_tables.sql` | 🅰️ A | 8 table(s), 3 fn(s), 16 policy(s), 3 trigger(s), 17 index(es), 1 ext | ✅ all | ✅ | MVP money-loop dependency. |
| 001 | `001_dream_feed.sql` | 🅳 D | 3 table(s), 4 fn(s), 11 policy(s), 4 trigger(s), 9 index(es) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 002 | `002_update_tables.sql` | 🅰️ A | 8 table(s), 3 fn(s), 16 policy(s), 3 trigger(s), 16 index(es), 1 ext | ✅ all | ✅ | MVP money-loop dependency. |
| 003 | `003_fix_wallets.sql` | 🅰️ A | 4 col(s), 1 fn(s), 1 trigger(s) | ✅ applied | ✅ | MVP money-loop dependency. |
| 004 | `004_complete_setup.sql` | 🅰️ A | 8 table(s), 4 col(s), 3 fn(s), 19 policy(s), 3 trigger(s), 1 ext | ✅ all | ✅ | MVP money-loop dependency. |
| 005 | `005_community_system.sql` | 🅱️ B | 15 table(s), 1 col(s), 4 fn(s), 28 policy(s), 3 trigger(s), 35 index(es) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 005 | `005_community_system_fixed.sql` | 🅳 D | 15 table(s), 1 col(s), 4 fn(s), 28 policy(s), 3 trigger(s), 20 index(es) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 006 | `006_financial_profiles.sql` | 🅱️ B | 3 table(s), 3 col(s), 5 fn(s), 6 policy(s), 2 trigger(s), 7 index(es), 1 ext | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 007 | `007_circle_matching.sql` | 🅰️ A | 4 table(s), 5 fn(s), 11 policy(s), 4 trigger(s), 10 index(es), 1 ext | ✅ all | ✅ | MVP money-loop dependency. |
| 008 | `008_default_cascade.sql` | 🅱️ B | 6 table(s), 4 col(s), 4 fn(s), 7 policy(s), 1 trigger(s), 20 index(es), 1 ext | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 009 | `009_payout_system.sql` | 🅰️ A | 5 table(s), 10 col(s), 3 fn(s), 9 policy(s), 6 trigger(s), 11 index(es) | ✅ all | ✅ | MVP money-loop dependency. |
| 010 | `010_payout_order_system.sql` | 🅰️ A | 10 table(s), 5 fn(s), 11 policy(s), 5 trigger(s), 17 index(es) | ✅ all | ✅ | MVP money-loop dependency. |
| 011 | `011_contribution_scheduling.sql` | 🅰️ A | 6 table(s), 15 col(s), 4 fn(s), 7 policy(s), 3 trigger(s), 16 index(es) | ✅ all | ✅ | MVP money-loop dependency. |
| 011 | `011_contribution_scheduling_fixed.sql` | 🅳 D | 5 table(s), 35 col(s), 4 fn(s), 5 policy(s), 2 trigger(s), 13 index(es) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 012 | `012_cycle_progression_cleanup_and_create.sql` | 🅰️ A | 14 table(s), 6 col(s), 5 fn(s), 15 policy(s), 4 trigger(s), 27 index(es), 2 view(s) | ✅ all | ✅ | MVP money-loop dependency. |
| 012 | `012_cycle_progression_engine.sql` | 🅳 D | 14 table(s), 6 col(s), 5 fn(s), 14 policy(s), 4 trigger(s), 40 index(es), 2 view(s) | ✅ all | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 012 | `012_cycle_progression_engine_fixed.sql` | 🅳 D | 14 table(s), 6 col(s), 5 fn(s), 15 policy(s), 4 trigger(s), 40 index(es), 2 view(s) | ✅ all | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 012 | `012_cycle_progression_final.sql` | 🅳 D | 14 table(s), 6 col(s), 5 fn(s), 15 policy(s), 4 trigger(s), 22 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 012 | `012_cycle_progression_v2.sql` | 🅳 D | 14 table(s), 6 col(s), 5 fn(s), 15 policy(s), 4 trigger(s), 22 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 013 | `013_late_contribution_handling.sql` | 🅱️ B | 9 table(s), 8 col(s), 4 fn(s), 11 policy(s), 2 trigger(s), 19 index(es), 2 view(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 013 | `013_late_contribution_handling_v2.sql` | 🅳 D | 9 table(s), 8 col(s), 4 fn(s), 11 policy(s), 2 trigger(s), 19 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 013 | `013_late_contribution_handling_v3.sql` | 🅳 D | 10 table(s), 3 col(s), 4 fn(s), 11 policy(s), 2 trigger(s), 19 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 013 | `013_late_contribution_handling_v4.sql` | 🅳 D | 10 table(s), 3 col(s), 4 fn(s), 12 policy(s), 2 trigger(s), 19 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 014 | `014_default_cascade_handler.sql` | 🅱️ B | 8 table(s), 12 col(s), 4 fn(s), 8 policy(s), 4 trigger(s), 24 index(es), 4 view(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 014 | `014_default_cascade_handler_v2.sql` | 🅳 D | 8 table(s), 12 col(s), 4 fn(s), 8 policy(s), 4 trigger(s), 24 index(es), 4 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 015 | `015_payout_execution_engine.sql` | 🅰️ A | 8 table(s), 4 col(s), 4 fn(s), 12 policy(s), 4 trigger(s), 19 index(es), 4 view(s) | ✅ all | ✅ | MVP money-loop dependency. |
| 015 | `015_payout_execution_engine_v2.sql` | 🅳 D | 9 table(s), 4 col(s), 4 fn(s), 13 policy(s), 5 trigger(s), 23 index(es), 4 view(s) | 8/8 | ❌ | Superseded iteration. Canonical version already ran. |
| 015 | `015_payout_execution_engine_v3.sql` | 🅳 D | 11 table(s), 4 col(s), 4 fn(s), 17 policy(s), 7 trigger(s), 27 index(es), 4 view(s) | 8/8 | ❌ | Superseded iteration. Canonical version already ran. |
| 015 | `015_payout_execution_engine_v4.sql` | 🅳 D | 11 table(s), 4 col(s), 5 fn(s), 17 policy(s), 7 trigger(s), 24 index(es), 4 view(s) | 8/8 | ❌ | Superseded iteration. Canonical version already ran. |
| 015 | `015_payout_execution_engine_v5.sql` | 🅳 D | 11 table(s), 4 col(s), 5 fn(s), 17 policy(s), 7 trigger(s), 24 index(es), 4 view(s) | 8/8 | ❌ | Superseded iteration. Canonical version already ran. |
| 016 | `016_circle_dissolution.sql` | 🅱️ B | 6 table(s), 16 fn(s), 10 policy(s), 4 trigger(s), 16 index(es), 3 view(s), 4 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 017 | `017_member_removal_midcircle.sql` | 🅱️ B | 7 table(s), 11 fn(s), 13 policy(s), 4 trigger(s), 10 index(es), 3 view(s), 3 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 018 | `018_position_swapping.sql` | 🅱️ B | 3 table(s), 1 col(s), 13 fn(s), 7 policy(s), 1 trigger(s), 9 index(es), 3 view(s), 2 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 019 | `019_initial_xnscore.sql` | 🅱️ B | 6 table(s), 1 col(s), 15 fn(s), 8 policy(s), 4 trigger(s), 17 index(es), 3 view(s), 4 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 020 | `020_xnscore_decay_growth.sql` | 🅱️ B | 3 table(s), 20 col(s), 21 fn(s), 3 policy(s), 4 trigger(s), 11 index(es), 4 view(s), 2 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 021 | `021_xnscore_factor_breakdown.sql` | 🅱️ B | 4 table(s), 4 col(s), 15 fn(s), 4 policy(s), 3 trigger(s), 9 index(es), 3 view(s), 4 type(s) | ✅ all | ✅ | Trust/governance. Phase after core MVP is stable. |
| 022 | `022_creditworthiness_assessment.sql` | 🅰️ A | 8 table(s), 19 fn(s), 8 policy(s), 6 trigger(s), 25 index(es), 4 view(s), 9 type(s) | ✅ all | ✅ | MVP money-loop dependency. |
| 023 | `023_interest_calculation_complete.sql` | 🅰️ A | 6 table(s), 21 col(s), 14 fn(s), 6 policy(s), 1 trigger(s), 7 index(es), 3 view(s), 5 type(s) | ✅ all | ✅ | MVP money-loop dependency. |
| 023 | `023_interest_calculation_system.sql` | 🅳 D | 6 table(s), 22 col(s), 18 fn(s), 6 policy(s), 1 trigger(s), 14 index(es), 3 view(s), 5 type(s) | ✅ all | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 023 | `023_interest_calculation_system_fix.sql` | 🅳 D | 2 fn(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 024 | `024_cleanup_first.sql` | 🅱️ B | (no DDL detected) | ✅ applied | ✅ | Trust/governance. Phase after core MVP is stable. |
| 024 | `024_monthly_payment_complete.sql` | 🅳 D | 3 table(s), 13 col(s), 16 fn(s), 6 policy(s), 3 trigger(s), 13 index(es), 4 view(s), 6 type(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 024 | `024_monthly_payment_system.sql` | 🅳 D | 3 table(s), 13 col(s), 16 fn(s), 6 policy(s), 3 trigger(s), 13 index(es), 4 view(s), 6 type(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 024 | `024_monthly_payment_system_fix.sql` | 🅳 D | 3 table(s), 13 col(s), 16 fn(s), 6 policy(s), 3 trigger(s), 13 index(es), 4 view(s), 6 type(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 025 | `025_security_fixes.sql` | 🅰️ A | 6 policy(s), 42 view(s) | ✅ applied | ✅ | MVP money-loop dependency. |
| 025 | `025_security_fixes_final.sql` | 🅳 D | 6 policy(s), 42 view(s) | ? unknown | ❌ | Superseded iteration. Canonical version already ran. |
| 025 | `025_security_fixes_v2.sql` | 🅳 D | 6 policy(s), 42 view(s) | ? unknown | ❌ | Superseded iteration. Canonical version already ran. |
| 025 | `025_security_fixes_v3.sql` | 🅳 D | 6 policy(s), 42 view(s) | ? unknown | ❌ | Superseded iteration. Canonical version already ran. |
| 025 | `025_security_rls_only.sql` | 🅳 D | 6 policy(s) | ? unknown | ❌ | Superseded iteration. Canonical version already ran. |
| 026 | `026_cron_job_logs.sql` | 🅰️ A | 2 table(s), 5 policy(s), 5 index(es), 2 view(s) | ✅ all | ✅ | MVP money-loop dependency. |
| 026 | `026_cron_job_logs_v2.sql` | 🅳 D | 2 table(s), 5 policy(s), 5 index(es), 2 view(s) | ✅ all | ❌ | Superseded iteration. Canonical version already ran. |
| 027 | `027_setup_cron_schedules.sql` | 🅰️ A | 2 ext | ✅ applied | ✅ | MVP money-loop dependency. |
| 028 | `028_dream_feed_fixes.sql` | 🅳 D | 1 table(s), 2 fn(s), 4 policy(s), 2 index(es) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 028 | `028_token_incentives.sql` | 🅳 D | 4 table(s), 6 fn(s), 4 policy(s), 3 trigger(s), 6 index(es) | ❌ none | ✅ | Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical r… |
| 029 | `029_api_white_label.sql` | 🅳 D | 3 table(s), 4 fn(s), 3 policy(s), 7 index(es), 1 ext | ❌ none | ✅ | Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical r… |
| 029 | `029_feed_storage_bucket.sql` | 🅳 D | 4 policy(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 030 | `030_circle_profile_fkeys.sql` | 🅳 D | (no DDL detected) | — | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 030 | `030_token_api_cron_schedules.sql` | 🅳 D | (no DDL detected) | ✅ applied | ✅ | Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical r… |
| 031 | `031_fix_circles_rotation_method.sql` | 🅳 D | (no DDL detected) | — | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 031 | `031_savings_context_support.sql` | 🅳 D | 3 col(s), 3 policy(s) | ? unknown | ❌ | Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted. |
| 032 | `032_elder_context_support.sql` | 🅱️ B | 2 col(s), 4 policy(s), 2 index(es) | ✅ applied | ✅ | Trust/governance. Phase after core MVP is stable. |
| 033 | `033_feature_gates.sql` | 🅱️ B | 2 table(s), 1 fn(s), 2 policy(s), 1 trigger(s), 5 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 034 | `034_user_events.sql` | 🅱️ B | 1 table(s), 1 fn(s), 2 policy(s), 6 index(es), 1 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 035 | `035_member_financial_profiles.sql` | 🅱️ B | 5 table(s), 4 fn(s), 5 policy(s), 3 trigger(s), 14 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 036 | `036_scoring_pipeline.sql` | 🅱️ B | 6 table(s), 8 fn(s), 6 policy(s), 2 trigger(s), 14 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 037 | `037_honor_scores.sql` | 🅱️ B | 2 table(s), 1 col(s), 3 fn(s), 5 policy(s), 1 trigger(s), 6 index(es) | 1/1 | ❌ | Trust/governance. Phase after core MVP is stable. |
| 038 | `038_honor_score_realignment.sql` | 🅱️ B | 3 table(s), 1 col(s), 2 fn(s), 8 policy(s), 1 trigger(s), 6 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 039 | `039_circle_democracy.sql` | 🅱️ B | 3 table(s), 3 fn(s), 9 policy(s), 3 trigger(s), 9 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 040 | `040_graduated_entry.sql` | 🅱️ B | 4 table(s), 1 col(s), 3 fn(s), 9 policy(s), 2 trigger(s), 7 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 041 | `041_circle_insurance_pool.sql` | 🅱️ B | 4 table(s), 2 col(s), 5 fn(s), 8 policy(s), 2 trigger(s), 9 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 042 | `042_dynamic_payout_ordering.sql` | 🅱️ B | 4 table(s), 9 col(s), 8 policy(s), 1 trigger(s), 7 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 043 | `043_notification_priority_engine.sql` | 🅱️ B | 3 table(s), 4 col(s), 6 policy(s), 2 trigger(s), 7 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 044 | `044_sanctions_screening.sql` | 🅱️ B | 4 table(s), 5 col(s), 9 policy(s), 2 trigger(s), 10 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 045 | `045_aml_monitoring.sql` | 🅱️ B | 4 table(s), 3 col(s), 5 policy(s), 3 trigger(s), 9 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 046 | `046_explainable_ai_decisions.sql` | 🅱️ B | 2 table(s), 4 policy(s), 1 trigger(s), 4 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 047 | `047_legal_terms_simplifier.sql` | 🅱️ B | 4 table(s), 9 policy(s), 3 trigger(s), 6 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 048 | `048_partial_contributions.sql` | 🅱️ B | 1 table(s), 3 col(s), 2 policy(s), 1 trigger(s), 4 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 049 | `049_substitute_member_system.sql` | 🅱️ B | 3 table(s), 10 policy(s), 3 trigger(s), 10 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 050 | `050_cron_ai_trigger_infrastructure.sql` | 🅱️ B | 2 table(s), 4 policy(s), 6 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 051 | `051_ai_recommendation_feedback_loop.sql` | 🅱️ B | 2 table(s), 5 policy(s), 1 trigger(s), 9 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 052 | `052_circle_match_history_ml_seed.sql` | 🅱️ B | 1 table(s), 7 col(s), 2 policy(s), 1 trigger(s), 6 index(es) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 053 | `053_kyc_verification_system.sql` | 🅰️ A | 9 table(s), 1 fn(s), 14 policy(s), 4 trigger(s), 21 index(es) | ? unknown | ❌ | MVP money-loop dependency. |
| 054 | `054_stripe_connect_payment_system.sql` | 🅰️ A | 9 table(s), 3 fn(s), 19 policy(s), 9 trigger(s), 38 index(es) | ? unknown | ❌ | MVP money-loop dependency. |
| 055 | `055_mock_to_real_migration_scoring.sql` | 🅲 C | 3 table(s), 3 fn(s), 6 policy(s), 3 trigger(s), 11 index(es), 2 view(s) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 056 | `056_community_features.sql` | 🅲 C | 13 table(s), 7 fn(s), 45 policy(s), 12 trigger(s), 37 index(es) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 057 | `057_marketplace_system.sql` | 🅲 C | 10 table(s), 4 fn(s), 28 policy(s), 9 trigger(s), 29 index(es) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 058 | `058_early_intervention_system.sql` | 🅱️ B | 3 table(s), 2 fn(s), 7 policy(s), 2 trigger(s), 9 index(es), 1 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 059 | `059_cross_circle_liquidity.sql` | 🅱️ B | 5 table(s), 3 fn(s), 11 policy(s), 6 trigger(s), 11 index(es), 1 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 060 | `060_financial_stress_prediction.sql` | 🅱️ B | 4 table(s), 3 fn(s), 9 policy(s), 3 trigger(s), 12 index(es), 1 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 061 | `061_contribution_mood_detection.sql` | 🅱️ B | 6 table(s), 4 fn(s), 16 policy(s), 4 trigger(s), 14 index(es), 1 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 062 | `062_conflict_prediction_engine.sql` | 🅱️ B | 4 table(s), 3 fn(s), 5 policy(s), 3 trigger(s), 15 index(es), 2 view(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 063 | `063_fix_missing_columns_and_rls.sql` | 🅱️ B | 4 col(s), 1 policy(s) | ? unknown | ❌ | Trust/governance. Phase after core MVP is stable. |
| 064 | `064_trip_circle_system.sql` | 🅲 C | 6 table(s), 1 fn(s), 39 policy(s), 5 trigger(s), 11 index(es), 1 view(s) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 065 | `065_trip_organizer.sql` | 🅲 C | 8 table(s), 35 policy(s), 5 trigger(s), 14 index(es) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 066 | `066_trip_organizer_fixes.sql` | 🅲 C | 1 col(s), 2 fn(s), 19 policy(s), 1 index(es) | ? unknown | ❌ | Growth/engagement. Not needed for first launch. |
| 067 | `067_pending_joins.sql` | 🅰️ A | 1 table(s), 3 policy(s), 2 index(es) | ? unknown | ❌ | MVP money-loop dependency. |
| 068 | `068_create_pending_join_rpc.sql` | 🅰️ A | 1 fn(s) | ? unknown | ❌ | MVP money-loop dependency. |

---

## Tables-created detail (where verifiable in prod)

| File | Tables created | Prod status |
|------|----------------|-------------|
| `001_create_tables.sql` | `circle_members`, `circles`, `contributions`, `invited_members`, `payouts`, `profiles`, `wallet_transactions`, `wallets` | `circle_members`✅ `circles`✅ `contributions`✅ `invited_members`✅ `payouts`✅ `profiles`✅ `wallet_transactions`✅ `wallets`✅ |
| `001_dream_feed.sql` | `feed_comments`, `feed_likes`, `feed_posts` | `feed_comments`? `feed_likes`? `feed_posts`? |
| `002_update_tables.sql` | `circle_members`, `circles`, `contributions`, `invited_members`, `payouts`, `profiles`, `wallet_transactions`, `wallets` | `circle_members`✅ `circles`✅ `contributions`✅ `invited_members`✅ `payouts`✅ `profiles`✅ `wallet_transactions`✅ `wallets`✅ |
| `004_complete_setup.sql` | `circle_members`, `circles`, `contributions`, `invited_members`, `payouts`, `profiles`, `wallet_transactions`, `wallets` | `circle_members`✅ `circles`✅ `contributions`✅ `invited_members`✅ `payouts`✅ `profiles`✅ `wallet_transactions`✅ `wallets`✅ |
| `005_community_system.sql` | `communities`, `community_activities`, `community_health_scores`, `community_invitations`, `community_leaderboard_snapshots`, `community_memberships`, `default_grace_periods`, `defaults`, `dispute_messages`, `disputes`, `elder_applications`, `elder_council_votes`, `elder_vote_records`, `member_vouches`, `vouch_events` | `communities`✅ `community_activities`✅ `community_health_scores`✅ `community_invitations`✅ `community_leaderboard_snapshots`✅ `community_memberships`✅ `default_grace_periods`✅ `defaults`✅ `dispute_messages`✅ `disputes`✅ `elder_applications`✅ `elder_council_votes`✅ `elder_vote_records`✅ `member_vouches`✅ `vouch_events`✅ |
| `005_community_system_fixed.sql` | `communities`, `community_activities`, `community_health_scores`, `community_invitations`, `community_leaderboard_snapshots`, `community_memberships`, `default_grace_periods`, `defaults`, `dispute_messages`, `disputes`, `elder_applications`, `elder_council_votes`, `elder_vote_records`, `member_vouches`, `vouch_events` | `communities`✅ `community_activities`✅ `community_health_scores`✅ `community_invitations`✅ `community_leaderboard_snapshots`✅ `community_memberships`✅ `default_grace_periods`✅ `defaults`✅ `dispute_messages`✅ `disputes`✅ `elder_applications`✅ `elder_council_votes`✅ `elder_vote_records`✅ `member_vouches`✅ `vouch_events`✅ |
| `006_financial_profiles.sql` | `affordability_checks`, `financial_profiles`, `income_verifications` | `affordability_checks`✅ `financial_profiles`✅ `income_verifications`✅ |
| `007_circle_matching.sql` | `circle_connection_invites`, `circle_match_history`, `user_circle_preferences`, `user_connections` | `circle_connection_invites`✅ `circle_match_history`✅ `user_circle_preferences`✅ `user_connections`✅ |
| `008_default_cascade.sql` | `default_escalations`, `default_payment_plans`, `default_recovery_attempts`, `payment_plan_installments`, `reserve_fund_transactions`, `shared_loss_records` | `default_escalations`✅ `default_payment_plans`✅ `default_recovery_attempts`✅ `payment_plan_installments`✅ `reserve_fund_transactions`✅ `shared_loss_records`✅ |
| `009_payout_system.sql` | `payout_batches`, `payout_fees`, `payout_methods`, `payout_requests`, `payout_schedules` | `payout_batches`✅ `payout_fees`✅ `payout_methods`✅ `payout_requests`✅ `payout_schedules`✅ |
| `010_payout_order_system.sql` | `fairness_credits`, `member_position_history`, `need_declarations`, `payout_algorithm_config`, `payout_order_audit_log`, `payout_orders`, `position_constraints`, `position_preferences`, `position_swap_requests`, `urgent_need_claims` | `fairness_credits`✅ `member_position_history`✅ `need_declarations`✅ `payout_algorithm_config`✅ `payout_order_audit_log`✅ `payout_orders`✅ `position_constraints`✅ `position_preferences`✅ `position_swap_requests`✅ `urgent_need_claims`✅ |
| `011_contribution_scheduling.sql` | `contribution_reminders`, `contribution_schedules`, `contributions`, `late_fee_config`, `member_contribution_stats`, `member_events` | `contribution_reminders`✅ `contribution_schedules`✅ `contributions`✅ `late_fee_config`✅ `member_contribution_stats`✅ `member_events`✅ |
| `011_contribution_scheduling_fixed.sql` | `contribution_reminders`, `contribution_schedules`, `late_fee_config`, `member_contribution_stats`, `member_events` | `contribution_reminders`✅ `contribution_schedules`✅ `late_fee_config`✅ `member_contribution_stats`✅ `member_events`✅ |
| `012_cycle_progression_cleanup_and_create.sql` | `circle_completions`, `circle_cycles`, `cron_job_logs`, `cycle_contributions`, `cycle_engine_runs`, `cycle_events`, `member_defaults`, `ops_alerts`, `reserve_fund_transactions`, `reserve_funds`, `scheduled_notifications`, `user_payment_methods`, `vouches`, `xn_score_history` | `circle_completions`✅ `circle_cycles`✅ `cron_job_logs`✅ `cycle_contributions`✅ `cycle_engine_runs`✅ `cycle_events`✅ `member_defaults`✅ `ops_alerts`✅ `reserve_fund_transactions`✅ `reserve_funds`✅ `scheduled_notifications`✅ `user_payment_methods`✅ `vouches`✅ `xn_score_history`✅ |
| `012_cycle_progression_engine.sql` | `circle_completions`, `circle_cycles`, `cron_job_logs`, `cycle_contributions`, `cycle_engine_runs`, `cycle_events`, `member_defaults`, `ops_alerts`, `reserve_fund_transactions`, `reserve_funds`, `scheduled_notifications`, `user_payment_methods`, `vouches`, `xn_score_history` | `circle_completions`✅ `circle_cycles`✅ `cron_job_logs`✅ `cycle_contributions`✅ `cycle_engine_runs`✅ `cycle_events`✅ `member_defaults`✅ `ops_alerts`✅ `reserve_fund_transactions`✅ `reserve_funds`✅ `scheduled_notifications`✅ `user_payment_methods`✅ `vouches`✅ `xn_score_history`✅ |
| `012_cycle_progression_engine_fixed.sql` | `circle_completions`, `circle_cycles`, `cron_job_logs`, `cycle_contributions`, `cycle_engine_runs`, `cycle_events`, `member_defaults`, `ops_alerts`, `reserve_fund_transactions`, `reserve_funds`, `scheduled_notifications`, `user_payment_methods`, `vouches`, `xn_score_history` | `circle_completions`✅ `circle_cycles`✅ `cron_job_logs`✅ `cycle_contributions`✅ `cycle_engine_runs`✅ `cycle_events`✅ `member_defaults`✅ `ops_alerts`✅ `reserve_fund_transactions`✅ `reserve_funds`✅ `scheduled_notifications`✅ `user_payment_methods`✅ `vouches`✅ `xn_score_history`✅ |
| `012_cycle_progression_final.sql` | `circle_completions`, `circle_cycles`, `cron_job_logs`, `cycle_contributions`, `cycle_engine_runs`, `cycle_events`, `member_defaults`, `ops_alerts`, `reserve_fund_transactions`, `reserve_funds`, `scheduled_notifications`, `user_payment_methods`, `vouches`, `xn_score_history` | `circle_completions`✅ `circle_cycles`✅ `cron_job_logs`✅ `cycle_contributions`✅ `cycle_engine_runs`✅ `cycle_events`✅ `member_defaults`✅ `ops_alerts`✅ `reserve_fund_transactions`✅ `reserve_funds`✅ `scheduled_notifications`✅ `user_payment_methods`✅ `vouches`✅ `xn_score_history`✅ |
| `012_cycle_progression_v2.sql` | `circle_completions`, `circle_cycles`, `cron_job_logs`, `cycle_contributions`, `cycle_engine_runs`, `cycle_events`, `member_defaults`, `ops_alerts`, `reserve_fund_transactions`, `reserve_funds`, `scheduled_notifications`, `user_payment_methods`, `vouches`, `xn_score_history` | `circle_completions`✅ `circle_cycles`✅ `cron_job_logs`✅ `cycle_contributions`✅ `cycle_engine_runs`✅ `cycle_events`✅ `member_defaults`✅ `ops_alerts`✅ `reserve_fund_transactions`✅ `reserve_funds`✅ `scheduled_notifications`✅ `user_payment_methods`✅ `vouches`✅ `xn_score_history`✅ |
| `013_late_contribution_handling.sql` | `auto_retry_config`, `auto_retry_history`, `late_contribution_events`, `late_contributions`, `payment_plan_installments`, `payment_plans`, `redistribution_requests`, `redistribution_responses`, `user_restrictions` | `auto_retry_config`✅ `auto_retry_history`✅ `late_contribution_events`✅ `late_contributions`✅ `payment_plan_installments`✅ `payment_plans`✅ `redistribution_requests`✅ `redistribution_responses`✅ `user_restrictions`✅ |
| `013_late_contribution_handling_v2.sql` | `auto_retry_config`, `auto_retry_history`, `late_contribution_events`, `late_contributions`, `payment_plan_installments`, `payment_plans`, `redistribution_requests`, `redistribution_responses`, `user_restrictions` | `auto_retry_config`✅ `auto_retry_history`✅ `late_contribution_events`✅ `late_contributions`✅ `payment_plan_installments`✅ `payment_plans`✅ `redistribution_requests`✅ `redistribution_responses`✅ `user_restrictions`✅ |
| `013_late_contribution_handling_v3.sql` | `auto_retry_config`, `auto_retry_history`, `late_contribution_events`, `late_contributions`, `late_fee_config`, `payment_plan_installments`, `payment_plans`, `redistribution_requests`, `redistribution_responses`, `user_restrictions` | `auto_retry_config`✅ `auto_retry_history`✅ `late_contribution_events`✅ `late_contributions`✅ `late_fee_config`✅ `payment_plan_installments`✅ `payment_plans`✅ `redistribution_requests`✅ `redistribution_responses`✅ `user_restrictions`✅ |
| `013_late_contribution_handling_v4.sql` | `auto_retry_config`, `auto_retry_history`, `late_contribution_events`, `late_contributions`, `late_fee_config`, `payment_plan_installments`, `payment_plans`, `redistribution_requests`, `redistribution_responses`, `user_restrictions` | `auto_retry_config`✅ `auto_retry_history`✅ `late_contribution_events`✅ `late_contributions`✅ `late_fee_config`✅ `payment_plan_installments`✅ `payment_plans`✅ `redistribution_requests`✅ `redistribution_responses`✅ `user_restrictions`✅ |
| `014_default_cascade_handler.sql` | `cascade_events`, `circle_default_resolutions`, `defaults`, `member_debts`, `recovery_plan_installments`, `recovery_plans`, `suspension_reviews`, `voucher_default_impacts` | `cascade_events`✅ `circle_default_resolutions`✅ `defaults`✅ `member_debts`✅ `recovery_plan_installments`✅ `recovery_plans`✅ `suspension_reviews`✅ `voucher_default_impacts`✅ |
| `014_default_cascade_handler_v2.sql` | `cascade_events`, `circle_default_resolutions`, `defaults`, `member_debts`, `recovery_plan_installments`, `recovery_plans`, `suspension_reviews`, `voucher_default_impacts` | `cascade_events`✅ `circle_default_resolutions`✅ `defaults`✅ `member_debts`✅ `recovery_plan_installments`✅ `recovery_plans`✅ `suspension_reviews`✅ `voucher_default_impacts`✅ |
| `015_payout_execution_engine.sql` | `contribution_reservations`, `payout_executions`, `payout_preferences`, `savings_goal_types`, `savings_transactions`, `user_savings_goals`, `user_wallets`, `wallet_transactions` | `contribution_reservations`✅ `payout_executions`✅ `payout_preferences`✅ `savings_goal_types`✅ `savings_transactions`✅ `user_savings_goals`✅ `user_wallets`✅ `wallet_transactions`✅ |
| `015_payout_execution_engine_v2.sql` | `contribution_reservations`, `money_movements`, `payout_executions`, `payout_preferences`, `savings_goal_types`, `savings_transactions`, `user_savings_goals`, `user_wallets`, `wallet_transactions` | `contribution_reservations`✅ `money_movements`? `payout_executions`✅ `payout_preferences`✅ `savings_goal_types`✅ `savings_transactions`✅ `user_savings_goals`✅ `user_wallets`✅ `wallet_transactions`✅ |
| `015_payout_execution_engine_v3.sql` | `contribution_reservations`, `money_movements`, `payout_executions`, `payout_preferences`, `remittance_recipients`, `savings_goal_types`, `savings_transactions`, `user_bank_accounts`, `user_savings_goals`, `user_wallets`, `wallet_transactions` | `contribution_reservations`✅ `money_movements`? `payout_executions`✅ `payout_preferences`✅ `remittance_recipients`? `savings_goal_types`✅ `savings_transactions`✅ `user_bank_accounts`? `user_savings_goals`✅ `user_wallets`✅ `wallet_transactions`✅ |
| `015_payout_execution_engine_v4.sql` | `contribution_reservations`, `money_movements`, `payout_executions`, `payout_preferences`, `remittance_recipients`, `savings_goal_types`, `savings_transactions`, `user_bank_accounts`, `user_savings_goals`, `user_wallets`, `wallet_transactions` | `contribution_reservations`✅ `money_movements`? `payout_executions`✅ `payout_preferences`✅ `remittance_recipients`? `savings_goal_types`✅ `savings_transactions`✅ `user_bank_accounts`? `user_savings_goals`✅ `user_wallets`✅ `wallet_transactions`✅ |
| `015_payout_execution_engine_v5.sql` | `contribution_reservations`, `money_movements`, `payout_executions`, `payout_preferences`, `remittance_recipients`, `savings_goal_types`, `savings_transactions`, `user_bank_accounts`, `user_savings_goals`, `user_wallets`, `wallet_transactions` | `contribution_reservations`✅ `money_movements`? `payout_executions`✅ `payout_preferences`✅ `remittance_recipients`? `savings_goal_types`✅ `savings_transactions`✅ `user_bank_accounts`? `user_savings_goals`✅ `user_wallets`✅ `wallet_transactions`✅ |
| `016_circle_dissolution.sql` | `dissolution_events`, `dissolution_member_positions`, `dissolution_objections`, `dissolution_requests`, `dissolution_trigger_config`, `dissolution_votes` | `dissolution_events`✅ `dissolution_member_positions`✅ `dissolution_objections`✅ `dissolution_requests`✅ `dissolution_trigger_config`✅ `dissolution_votes`✅ |
| `017_member_removal_midcircle.sql` | `circle_removal_audit`, `circle_removal_settings`, `debt_payments`, `member_debts`, `member_removal_requests`, `payout_order_adjustments`, `removal_votes` | `circle_removal_audit`✅ `circle_removal_settings`✅ `debt_payments`✅ `member_debts`✅ `member_removal_requests`✅ `payout_order_adjustments`✅ `removal_votes`✅ |
| `018_position_swapping.sql` | `member_swap_history`, `position_swap_events`, `position_swap_requests` | `member_swap_history`✅ `position_swap_events`✅ `position_swap_requests`✅ |
| `019_initial_xnscore.sql` | `vouches`, `xn_scores`, `xnscore_fraud_signals`, `xnscore_history`, `xnscore_initial_signals`, `xnscore_queued_increases` | `vouches`✅ `xn_scores`✅ `xnscore_fraud_signals`✅ `xnscore_history`✅ `xnscore_initial_signals`✅ `xnscore_queued_increases`✅ |
| `020_xnscore_decay_growth.sql` | `xnscore_decay_history`, `xnscore_recovery_periods`, `xnscore_tenure_history` | `xnscore_decay_history`✅ `xnscore_recovery_periods`✅ `xnscore_tenure_history`✅ |
| `021_xnscore_factor_breakdown.sql` | `xn_score_breakdown_cache`, `xn_score_factor_components`, `xn_score_factor_definitions`, `xn_score_improvement_tips` | `xn_score_breakdown_cache`✅ `xn_score_factor_components`✅ `xn_score_factor_definitions`✅ `xn_score_improvement_tips`✅ |
| `022_creditworthiness_assessment.sql` | `creditworthiness_assessments`, `loan_applications`, `loan_co_signers`, `loan_guarantees`, `loan_payment_schedule`, `loan_payments`, `loan_products`, `loans` | `creditworthiness_assessments`✅ `loan_applications`✅ `loan_co_signers`✅ `loan_guarantees`✅ `loan_payment_schedule`✅ `loan_payments`✅ `loan_products`✅ `loans`✅ |
| `023_interest_calculation_complete.sql` | `interest_calculation_config`, `loan_interest_accruals`, `loan_late_fees`, `loan_payoff_quotes`, `loan_rate_changes`, `market_index_rates` | `interest_calculation_config`✅ `loan_interest_accruals`✅ `loan_late_fees`✅ `loan_payoff_quotes`✅ `loan_rate_changes`✅ `market_index_rates`✅ |
| `023_interest_calculation_system.sql` | `interest_calculation_config`, `loan_interest_accruals`, `loan_late_fees`, `loan_payoff_quotes`, `loan_rate_changes`, `market_index_rates` | `interest_calculation_config`✅ `loan_interest_accruals`✅ `loan_late_fees`✅ `loan_payoff_quotes`✅ `loan_rate_changes`✅ `market_index_rates`✅ |
| `024_monthly_payment_complete.sql` | `loan_autopay_configs`, `loan_payment_obligations`, `loan_payment_reminders` | `loan_autopay_configs`? `loan_payment_obligations`? `loan_payment_reminders`? |
| `024_monthly_payment_system.sql` | `loan_autopay_configs`, `loan_payment_obligations`, `loan_payment_reminders` | `loan_autopay_configs`? `loan_payment_obligations`? `loan_payment_reminders`? |
| `024_monthly_payment_system_fix.sql` | `loan_autopay_configs`, `loan_payment_obligations`, `loan_payment_reminders` | `loan_autopay_configs`? `loan_payment_obligations`? `loan_payment_reminders`? |
| `026_cron_job_logs.sql` | `cron_job_logs`, `notifications` | `cron_job_logs`✅ `notifications`✅ |
| `026_cron_job_logs_v2.sql` | `cron_job_logs`, `notifications` | `cron_job_logs`✅ `notifications`✅ |
| `028_dream_feed_fixes.sql` | `feed_saved_posts` | `feed_saved_posts`? |
| `028_token_incentives.sql` | `token_award_rules`, `token_balances`, `token_rates`, `token_transactions` | `token_award_rules`❌ `token_balances`❌ `token_rates`❌ `token_transactions`❌ |
| `029_api_white_label.sql` | `api_clients`, `api_request_logs`, `webhook_deliveries` | `api_clients`❌ `api_request_logs`❌ `webhook_deliveries`❌ |
| `033_feature_gates.sql` | `feature_gates`, `user_feature_overrides` | `feature_gates`? `user_feature_overrides`? |
| `034_user_events.sql` | `user_events` | `user_events`? |
| `035_member_financial_profiles.sql` | `member_behavioral_profiles`, `member_network_metrics`, `member_profile_snapshots`, `member_risk_indicators`, `member_session_analytics` | `member_behavioral_profiles`? `member_network_metrics`? `member_profile_snapshots`? `member_risk_indicators`? `member_session_analytics`? |
| `036_scoring_pipeline.sql` | `circle_health_history`, `circle_health_scores`, `default_probability_history`, `default_probability_scores`, `score_alerts`, `scoring_pipeline_runs` | `circle_health_history`? `circle_health_scores`? `default_probability_history`? `default_probability_scores`? `score_alerts`? `scoring_pipeline_runs`? |
| `037_honor_scores.sql` | `honor_score_history`, `honor_scores` | `honor_score_history`? `honor_scores`✅ |
| `038_honor_score_realignment.sql` | `elder_endorsements`, `expertise_domains`, `user_expertise` | `elder_endorsements`? `expertise_domains`? `user_expertise`? |
| `039_circle_democracy.sql` | `circle_governance_settings`, `circle_proposal_votes`, `circle_proposals` | `circle_governance_settings`? `circle_proposal_votes`? `circle_proposals`? |
| `040_graduated_entry.sql` | `fast_track_applications`, `graduated_entry_tiers`, `member_tier_history`, `member_tier_status` | `fast_track_applications`? `graduated_entry_tiers`? `member_tier_history`? `member_tier_status`? |
| `041_circle_insurance_pool.sql` | `circle_insurance_pools`, `insurance_coverage_claims`, `insurance_pool_rate_history`, `insurance_pool_transactions` | `circle_insurance_pools`? `insurance_coverage_claims`? `insurance_pool_rate_history`? `insurance_pool_transactions`? |
| `042_dynamic_payout_ordering.sql` | `cultural_priority_signals`, `midcycle_reorder_requests`, `payout_position_explanations`, `stability_optimization_runs` | `cultural_priority_signals`? `midcycle_reorder_requests`? `payout_position_explanations`? `stability_optimization_runs`? |
| `043_notification_priority_engine.sql` | `member_notification_profiles`, `notification_queue`, `notification_templates` | `member_notification_profiles`? `notification_queue`? `notification_templates`? |
| `044_sanctions_screening.sql` | `sanctions_list_updates`, `sanctions_matches`, `sanctions_review_queue`, `sanctions_screens` | `sanctions_list_updates`? `sanctions_matches`? `sanctions_review_queue`? `sanctions_screens`? |
| `045_aml_monitoring.sql` | `aml_alerts`, `aml_reviews`, `aml_rules`, `sar_filings` | `aml_alerts`? `aml_reviews`? `aml_rules`? `sar_filings`? |
| `046_explainable_ai_decisions.sql` | `ai_decisions`, `explanation_templates` | `ai_decisions`? `explanation_templates`? |
| `047_legal_terms_simplifier.sql` | `ai_simplification_jobs`, `legal_document_content`, `legal_documents`, `member_legal_acceptances` | `ai_simplification_jobs`? `legal_document_content`? `legal_documents`? `member_legal_acceptances`? |
| `048_partial_contributions.sql` | `partial_contribution_plans` | `partial_contribution_plans`? |
| `049_substitute_member_system.sql` | `circle_exit_requests`, `substitute_pool`, `substitution_records` | `circle_exit_requests`? `substitute_pool`? `substitution_records`? |
| `050_cron_ai_trigger_infrastructure.sql` | `cohort_analytics`, `model_performance_logs` | `cohort_analytics`? `model_performance_logs`? |
| `051_ai_recommendation_feedback_loop.sql` | `ai_recommendation_feedback`, `model_feedback_summary` | `ai_recommendation_feedback`? `model_feedback_summary`? |
| `052_circle_match_history_ml_seed.sql` | `match_data_quality_logs` | `match_data_quality_logs`? |
| `053_kyc_verification_system.sql` | `kyc_admin_reviews`, `kyc_decline_reasons`, `kyc_documents`, `kyc_escalation_triggers`, `kyc_experiment_metrics`, `kyc_fallback_scores`, `kyc_fallback_signal_logs`, `kyc_provider_webhooks`, `kyc_verifications` | `kyc_admin_reviews`? `kyc_decline_reasons`? `kyc_documents`? `kyc_escalation_triggers`? `kyc_experiment_metrics`? `kyc_fallback_scores`? `kyc_fallback_signal_logs`? `kyc_provider_webhooks`? `kyc_verifications`? |
| `054_stripe_connect_payment_system.sql` | `stripe_connected_accounts`, `stripe_customers`, `stripe_disputes`, `stripe_payment_intents`, `stripe_payment_methods`, `stripe_payout_schedules`, `stripe_refunds`, `stripe_transfers`, `stripe_webhook_events` | `stripe_connected_accounts`? `stripe_customers`? `stripe_disputes`? `stripe_payment_intents`? `stripe_payment_methods`? `stripe_payout_schedules`? `stripe_refunds`? `stripe_transfers`? `stripe_webhook_events`? |
| `055_mock_to_real_migration_scoring.sql` | `migration_audit_log`, `migration_screens`, `migration_wave_status` | `migration_audit_log`? `migration_screens`? `migration_wave_status`? |
| `056_community_features.sql` | `community_arrivals`, `community_direct_messages`, `community_feed_items`, `community_gatherings`, `community_memory`, `community_post_comments`, `community_post_likes`, `community_posts`, `community_welcomes`, `dream_feed`, `gathering_rsvps`, `near_you_connections`, `near_you_profiles` | `community_arrivals`? `community_direct_messages`? `community_feed_items`? `community_gatherings`? `community_memory`? `community_post_comments`? `community_post_likes`? `community_posts`? `community_welcomes`? `dream_feed`? `gathering_rsvps`? `near_you_connections`? `near_you_profiles`? |
| `057_marketplace_system.sql` | `csv_uploads`, `market_insights`, `marketplace_bookings`, `marketplace_disputes`, `marketplace_stores`, `member_invites`, `provider_requests`, `store_inquiries`, `store_reviews`, `store_services` | `csv_uploads`? `market_insights`? `marketplace_bookings`? `marketplace_disputes`? `marketplace_stores`? `member_invites`? `provider_requests`? `store_inquiries`? `store_reviews`? `store_services`? |
| `058_early_intervention_system.sql` | `intervention_rules`, `intervention_templates`, `member_interventions` | `intervention_rules`? `intervention_templates`? `member_interventions`? |
| `059_cross_circle_liquidity.sql` | `liquidity_advances`, `liquidity_pool`, `pool_circle_exposure`, `pool_transactions`, `pool_utilization_snapshots` | `liquidity_advances`? `liquidity_pool`? `pool_circle_exposure`? `pool_transactions`? `pool_utilization_snapshots`? |
| `060_financial_stress_prediction.sql` | `member_stress_scores`, `member_stress_signals`, `stress_interventions`, `stress_keywords` | `member_stress_scores`? `member_stress_signals`? `stress_interventions`? `stress_keywords`? |
| `061_contribution_mood_detection.sql` | `member_messages`, `member_mood_baselines`, `member_mood_preferences`, `member_mood_snapshots`, `mood_interventions`, `mood_keywords` | `member_messages`? `member_mood_baselines`? `member_mood_preferences`? `member_mood_snapshots`? `mood_interventions`? `mood_keywords`? |
| `062_conflict_prediction_engine.sql` | `circle_formation_flags`, `conflict_history`, `member_pair_scores`, `post_formation_monitor` | `circle_formation_flags`? `conflict_history`? `member_pair_scores`? `post_formation_monitor`? |
| `064_trip_circle_system.sql` | `media_uploads`, `provider_profiles`, `trip_contributions`, `trip_listings`, `trip_members`, `trip_payment_schedules` | `media_uploads`? `provider_profiles`? `trip_contributions`? `trip_listings`? `trip_members`? `trip_payment_schedules`? |
| `065_trip_organizer.sql` | `trip_activities`, `trip_days`, `trip_messages`, `trip_participant_submissions`, `trip_participants`, `trip_payments`, `trip_vendors`, `trips` | `trip_activities`? `trip_days`? `trip_messages`? `trip_participant_submissions`? `trip_participants`? `trip_payments`? `trip_vendors`? `trips`? |
| `067_pending_joins.sql` | `pending_joins` | `pending_joins`? |

---

## Files to keep active (Categories A, B, C)

- **A** · `001_create_tables.sql` — MVP money-loop dependency.
- **A** · `002_update_tables.sql` — MVP money-loop dependency.
- **A** · `003_fix_wallets.sql` — MVP money-loop dependency.
- **A** · `004_complete_setup.sql` — MVP money-loop dependency.
- **A** · `007_circle_matching.sql` — MVP money-loop dependency.
- **A** · `009_payout_system.sql` — MVP money-loop dependency.
- **A** · `010_payout_order_system.sql` — MVP money-loop dependency.
- **A** · `011_contribution_scheduling.sql` — MVP money-loop dependency.
- **A** · `012_cycle_progression_cleanup_and_create.sql` — MVP money-loop dependency.
- **A** · `015_payout_execution_engine.sql` — MVP money-loop dependency.
- **A** · `022_creditworthiness_assessment.sql` — MVP money-loop dependency.
- **A** · `023_interest_calculation_complete.sql` — MVP money-loop dependency.
- **A** · `025_security_fixes.sql` — MVP money-loop dependency.
- **A** · `026_cron_job_logs.sql` — MVP money-loop dependency.
- **A** · `027_setup_cron_schedules.sql` — MVP money-loop dependency.
- **A** · `053_kyc_verification_system.sql` — MVP money-loop dependency.
- **A** · `054_stripe_connect_payment_system.sql` — MVP money-loop dependency.
- **A** · `067_pending_joins.sql` — MVP money-loop dependency.
- **A** · `068_create_pending_join_rpc.sql` — MVP money-loop dependency.
- **B** · `005_community_system.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `006_financial_profiles.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `008_default_cascade.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `013_late_contribution_handling.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `014_default_cascade_handler.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `016_circle_dissolution.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `017_member_removal_midcircle.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `018_position_swapping.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `019_initial_xnscore.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `020_xnscore_decay_growth.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `021_xnscore_factor_breakdown.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `024_cleanup_first.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `032_elder_context_support.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `033_feature_gates.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `034_user_events.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `035_member_financial_profiles.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `036_scoring_pipeline.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `037_honor_scores.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `038_honor_score_realignment.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `039_circle_democracy.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `040_graduated_entry.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `041_circle_insurance_pool.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `042_dynamic_payout_ordering.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `043_notification_priority_engine.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `044_sanctions_screening.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `045_aml_monitoring.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `046_explainable_ai_decisions.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `047_legal_terms_simplifier.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `048_partial_contributions.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `049_substitute_member_system.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `050_cron_ai_trigger_infrastructure.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `051_ai_recommendation_feedback_loop.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `052_circle_match_history_ml_seed.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `058_early_intervention_system.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `059_cross_circle_liquidity.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `060_financial_stress_prediction.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `061_contribution_mood_detection.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `062_conflict_prediction_engine.sql` — Trust/governance. Phase after core MVP is stable.
- **B** · `063_fix_missing_columns_and_rls.sql` — Trust/governance. Phase after core MVP is stable.
- **C** · `055_mock_to_real_migration_scoring.sql` — Growth/engagement. Not needed for first launch.
- **C** · `056_community_features.sql` — Growth/engagement. Not needed for first launch.
- **C** · `057_marketplace_system.sql` — Growth/engagement. Not needed for first launch.
- **C** · `064_trip_circle_system.sql` — Growth/engagement. Not needed for first launch.
- **C** · `065_trip_organizer.sql` — Growth/engagement. Not needed for first launch.
- **C** · `066_trip_organizer_fixes.sql` — Growth/engagement. Not needed for first launch.

## Files recommended for archiving (Category D)

These would move to `supabase/migrations/archive/` (NOT deleted) after your review:

- `verify_functions.sql` — Utility/helper SQL, not a migration.
- `001_dream_feed.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `005_community_system_fixed.sql` — Superseded iteration. Canonical version already ran.
- `011_contribution_scheduling_fixed.sql` — Superseded iteration. Canonical version already ran.
- `012_cycle_progression_engine.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `012_cycle_progression_engine_fixed.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `012_cycle_progression_final.sql` — Superseded iteration. Canonical version already ran.
- `012_cycle_progression_v2.sql` — Superseded iteration. Canonical version already ran.
- `013_late_contribution_handling_v2.sql` — Superseded iteration. Canonical version already ran.
- `013_late_contribution_handling_v3.sql` — Superseded iteration. Canonical version already ran.
- `013_late_contribution_handling_v4.sql` — Superseded iteration. Canonical version already ran.
- `014_default_cascade_handler_v2.sql` — Superseded iteration. Canonical version already ran.
- `015_payout_execution_engine_v2.sql` — Superseded iteration. Canonical version already ran.
- `015_payout_execution_engine_v3.sql` — Superseded iteration. Canonical version already ran.
- `015_payout_execution_engine_v4.sql` — Superseded iteration. Canonical version already ran.
- `015_payout_execution_engine_v5.sql` — Superseded iteration. Canonical version already ran.
- `023_interest_calculation_system.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `023_interest_calculation_system_fix.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `024_monthly_payment_complete.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `024_monthly_payment_system.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `024_monthly_payment_system_fix.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `025_security_fixes_final.sql` — Superseded iteration. Canonical version already ran.
- `025_security_fixes_v2.sql` — Superseded iteration. Canonical version already ran.
- `025_security_fixes_v3.sql` — Superseded iteration. Canonical version already ran.
- `025_security_rls_only.sql` — Superseded iteration. Canonical version already ran.
- `026_cron_job_logs_v2.sql` — Superseded iteration. Canonical version already ran.
- `028_dream_feed_fixes.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `028_token_incentives.sql` — Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical record only — never to be re-applied.
- `029_api_white_label.sql` — Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical record only — never to be re-applied.
- `029_feed_storage_bucket.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `030_circle_profile_fkeys.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `030_token_api_cron_schedules.sql` — Applied in Oct 2025, but feature REMOVED in Tier 2 cleanup (Apr 30 2026). Prod has no token_*/api_* tables. Historical record only — never to be re-applied.
- `031_fix_circles_rotation_method.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.
- `031_savings_context_support.sql` — Number collision: another file with this version was applied. Re-number to 069+ if feature still wanted.

---

## Notes on specific files

- **`028_token_incentives.sql`**, **`029_api_white_label.sql`**, **`030_token_api_cron_schedules.sql`** — Applied to production in October 2025, but the entire token system was REMOVED in **Tier 2 cleanup (Apr 30 2026)** per `CLAUDE.md`. Prod has NO `token_*` or `api_*` tables today. Classified as **D** because the feature is gone and these files will never be re-applied — historical record only. (Per the user's rule: "feature has been replaced".)

- **`031_savings_context_support.sql`** — The CONTENT is Category A intent (savings-goals support is core MVP), but the FILE is classified **D** because of the number collision: neither this file nor `031_fix_circles_rotation_method.sql` has been applied to prod, and they share version 031. Meanwhile, `user_savings_goals`, `savings_transactions`, `savings_goal_types` ALL exist in prod — so the savings tables were created by an *earlier* migration (this file's comment references `015_payout_execution_engine`). What `031_savings_context_support` adds: emoji columns + RLS policies + early withdrawal penalties. **Recommendation:** re-number to next free slot (069+) and apply, OR confirm the additions aren't critical.

- **`031_fix_circles_rotation_method.sql`** — Classified D as collision-loser. Worth a 5-min content check before archiving — if it patches circles rotation logic, may need to be re-numbered and applied.

- **`032_elder_context_support.sql`** — Classified **B** (applied as `elder_system` in `schema_migrations` — filename and recorded name don't match, but the version 032 migration did run; `elder_applications`, `elder_council_votes`, `elder_vote_records` all exist in prod). Filename was likely renamed after the apply. Safe to leave.

- **`054_stripe_connect_payment_system.sql`** — Critical Stripe Connect migration, **NOT APPLIED**. Prod table `stripe_connect_accounts` is MISSING. This blocks any payment functionality. Highest-priority pending migration.

- **`verify_functions.sql`** — No version prefix. One-off diagnostic SQL. Safe to archive as D.

- **Regex limitations:** Files classified by filename + extracted DDL. Files where my regex finds no objects (e.g. `030_circle_profile_fkeys.sql`, `031_fix_circles_rotation_method.sql`, `024_cleanup_first.sql`) likely contain only `ALTER TABLE ... ADD CONSTRAINT`, `DROP`, `REVOKE/GRANT`, or `INSERT` statements — not picked up. Categorization still uses filename keywords + applied-status; the "objects created" column just shows what regex found.

---

_Generated read-only. 98 files inventoried. No files moved or deleted._