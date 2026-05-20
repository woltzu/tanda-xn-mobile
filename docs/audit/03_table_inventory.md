# Critical Table Inventory

Method: REST API probes using anon key. Status meanings:

- **EXISTS** = REST returned 2xx. Table exists. `Total` shown = count visible to anon role under current RLS.
- **EXISTS_FORBIDDEN** = 401/403. Table exists but anon role blocked by RLS. Existence confirmed.
- **MISSING** = 404 PGRST205 (schema cache doesn't know it). Table does not exist in production.
- **UNKNOWN** = other error — needs manual check.

⚠️ Row counts are **anon-visible only**. True totals require service-role access.

## Critical tables (user-named)

| Table | Status | Anon-visible rows | Anon-visible total |
|-------|--------|-------------------|--------------------|
| `user_savings_goals` | ✅ EXISTS | 0 | 0 |
| `savings_transactions` | ✅ EXISTS | 0 | 0 |
| `savings_goal_types` | ✅ EXISTS | 0 | 0 |
| `circles` | ✅ EXISTS | 1 | 4 |
| `circle_members` | ✅ EXISTS | 1 | 8 |
| `circle_contributions` | ✅ EXISTS | 0 | 0 |
| `xn_scores` | ✅ EXISTS | 0 | 0 |
| `honor_scores` | ✅ EXISTS | 0 | 0 |
| `elders` | ❌ MISSING | 0 | 0 |
| `disputes` | ✅ EXISTS | 0 | 0 |
| `wallets` | ✅ EXISTS | 0 | 0 |
| `transactions` | ✅ EXISTS | 0 | 0 |
| `stripe_connected_accounts` | ✅ EXISTS | 0 | 0 |
| `dream_feed_posts` | ❌ MISSING | 0 | 0 |
| `marketplace_listings` | ❌ MISSING | 0 | 0 |
| `trip_circles` | ❌ MISSING | 0 | 0 |

## Other tables found in applied migrations (sampled)

| Table | Status | Anon-visible rows | Anon-visible total |
|-------|--------|-------------------|--------------------|
| `affordability_checks` | ✅ EXISTS | 0 | 0 |
| `api_clients` | ❌ MISSING | 0 | 0 |
| `api_request_logs` | ❌ MISSING | 0 | 0 |
| `auto_retry_config` | ✅ EXISTS | 0 | 0 |
| `auto_retry_history` | ✅ EXISTS | 0 | 0 |
| `cascade_events` | ✅ EXISTS | 0 | 0 |
| `circle_completions` | ✅ EXISTS | 0 | 0 |
| `circle_connection_invites` | ✅ EXISTS | 0 | 0 |
| `circle_cycles` | ✅ EXISTS | 0 | 0 |
| `circle_default_resolutions` | ✅ EXISTS | 0 | 0 |
| `circle_match_history` | ✅ EXISTS | 0 | 0 |
| `circle_removal_audit` | ✅ EXISTS | 0 | 0 |
| `circle_removal_settings` | ✅ EXISTS | 0 | 0 |
| `communities` | ✅ EXISTS | 1 | 75 |
| `community_activities` | ✅ EXISTS | 0 | 0 |
| `community_health_scores` | ✅ EXISTS | 0 | 0 |
| `community_invitations` | ✅ EXISTS | 0 | 0 |
| `community_leaderboard_snapshots` | ✅ EXISTS | 0 | 0 |
| `community_memberships` | ✅ EXISTS | 0 | 0 |
| `contribution_reminders` | ✅ EXISTS | 0 | 0 |
| `contribution_reservations` | ✅ EXISTS | 0 | 0 |
| `contribution_schedules` | ✅ EXISTS | 0 | 0 |
| `contributions` | ✅ EXISTS | 0 | 0 |
| `creditworthiness_assessments` | ✅ EXISTS | 0 | 0 |
| `cron_job_logs` | ✅ EXISTS | 0 | 0 |
| `cycle_contributions` | ✅ EXISTS | 0 | 0 |
| `cycle_engine_runs` | ✅ EXISTS | 0 | 0 |
| `cycle_events` | ✅ EXISTS | 0 | 0 |
| `debt_payments` | ✅ EXISTS | 0 | 0 |
| `default_escalations` | ✅ EXISTS | 0 | 0 |
| `default_grace_periods` | ✅ EXISTS | 0 | 0 |
| `default_payment_plans` | ✅ EXISTS | 0 | 0 |
| `default_recovery_attempts` | ✅ EXISTS | 0 | 0 |
| `defaults` | ✅ EXISTS | 0 | 0 |
| `dispute_messages` | ✅ EXISTS | 0 | 0 |
| `dissolution_events` | ✅ EXISTS | 0 | 0 |
| `dissolution_member_positions` | ✅ EXISTS | 0 | 0 |
| `dissolution_objections` | ✅ EXISTS | 0 | 0 |
| `dissolution_requests` | ✅ EXISTS | 0 | 0 |
| `dissolution_trigger_config` | ✅ EXISTS | 0 | 0 |
| `dissolution_votes` | ✅ EXISTS | 0 | 0 |
| `elder_applications` | ✅ EXISTS | 0 | 0 |
| `elder_council_votes` | ✅ EXISTS | 0 | 0 |
| `elder_vote_records` | ✅ EXISTS | 0 | 0 |
| `fairness_credits` | ✅ EXISTS | 0 | 0 |
| `financial_profiles` | ✅ EXISTS | 0 | 0 |
| `income_verifications` | ✅ EXISTS | 0 | 0 |
| `interest_calculation_config` | ✅ EXISTS | 1 | 10 |
| `invited_members` | ✅ EXISTS | 1 | 7 |
| `late_contribution_events` | ✅ EXISTS | 0 | 0 |
| `late_contributions` | ✅ EXISTS | 0 | 0 |
| `late_fee_config` | ✅ EXISTS | 0 | 0 |
| `loan_applications` | ✅ EXISTS | 0 | 0 |
| `loan_co_signers` | ✅ EXISTS | 0 | 0 |
| `loan_guarantees` | ✅ EXISTS | 0 | 0 |
| `loan_interest_accruals` | ✅ EXISTS | 0 | 0 |
| `loan_late_fees` | ✅ EXISTS | 0 | 0 |
| `loan_payment_schedule` | ✅ EXISTS | 0 | 0 |
| `loan_payments` | ✅ EXISTS | 0 | 0 |
| `loan_payoff_quotes` | ✅ EXISTS | 0 | 0 |
| `loan_products` | ✅ EXISTS | 1 | 4 |
| `loan_rate_changes` | ✅ EXISTS | 0 | 0 |
| `loans` | ✅ EXISTS | 0 | 0 |
| `market_index_rates` | ✅ EXISTS | 1 | 3 |
| `member_contribution_stats` | ✅ EXISTS | 0 | 0 |
| `member_debts` | ✅ EXISTS | 0 | 0 |
| `member_defaults` | ✅ EXISTS | 0 | 0 |
| `member_events` | ✅ EXISTS | 0 | 0 |
| `member_position_history` | ✅ EXISTS | 0 | 0 |
| `member_removal_requests` | ✅ EXISTS | 0 | 0 |
| `member_swap_history` | ✅ EXISTS | 0 | 0 |
| `member_vouches` | ✅ EXISTS | 0 | 0 |
| `need_declarations` | ✅ EXISTS | 0 | 0 |
| `notifications` | ✅ EXISTS | 0 | 0 |
| `ops_alerts` | ✅ EXISTS | 0 | 0 |
| `payment_plan_installments` | ✅ EXISTS | 0 | 0 |
| `payment_plans` | ✅ EXISTS | 0 | 0 |
| `payout_algorithm_config` | ✅ EXISTS | 0 | 0 |
| `payout_batches` | ✅ EXISTS | 0 | 0 |
| `payout_executions` | ✅ EXISTS | 0 | 0 |
| `payout_fees` | ✅ EXISTS | 0 | 0 |
| `payout_methods` | ✅ EXISTS | 0 | 0 |
| `payout_order_adjustments` | ✅ EXISTS | 0 | 0 |
| `payout_order_audit_log` | ✅ EXISTS | 0 | 0 |
| `payout_orders` | ✅ EXISTS | 0 | 0 |
| `payout_preferences` | ✅ EXISTS | 0 | 0 |
| `payout_requests` | ✅ EXISTS | 0 | 0 |
| `payout_schedules` | ✅ EXISTS | 0 | 0 |
| `payouts` | ✅ EXISTS | 0 | 0 |
| `position_constraints` | ✅ EXISTS | 0 | 0 |
| `position_preferences` | ✅ EXISTS | 0 | 0 |
| `position_swap_events` | ✅ EXISTS | 0 | 0 |
| `position_swap_requests` | ✅ EXISTS | 0 | 0 |
| `profiles` | ✅ EXISTS | 1 | 6 |
| `recovery_plan_installments` | ✅ EXISTS | 0 | 0 |
| `recovery_plans` | ✅ EXISTS | 0 | 0 |
| `redistribution_requests` | ✅ EXISTS | 0 | 0 |
| `redistribution_responses` | ✅ EXISTS | 0 | 0 |
| `removal_votes` | ✅ EXISTS | 0 | 0 |
| `reserve_fund_transactions` | ✅ EXISTS | 0 | 0 |
| `reserve_funds` | ✅ EXISTS | 0 | 0 |
| `scheduled_notifications` | ✅ EXISTS | 0 | 0 |
| `shared_loss_records` | ✅ EXISTS | 0 | 0 |
| `suspension_reviews` | ✅ EXISTS | 0 | 0 |
| `token_award_rules` | ❌ MISSING | 0 | 0 |
| `token_balances` | ❌ MISSING | 0 | 0 |
| `token_rates` | ❌ MISSING | 0 | 0 |
| `token_transactions` | ❌ MISSING | 0 | 0 |
| `urgent_need_claims` | ✅ EXISTS | 0 | 0 |
| `user_circle_preferences` | ✅ EXISTS | 0 | 0 |
| `user_connections` | ✅ EXISTS | 0 | 0 |
| `user_payment_methods` | ✅ EXISTS | 0 | 0 |
| `user_restrictions` | ✅ EXISTS | 0 | 0 |
| `user_wallets` | ✅ EXISTS | 0 | 0 |
| `vouch_events` | ✅ EXISTS | 0 | 0 |
| `voucher_default_impacts` | ✅ EXISTS | 0 | 0 |
| `vouches` | ✅ EXISTS | 0 | 0 |
| `wallet_transactions` | ✅ EXISTS | 0 | 0 |
| `webhook_deliveries` | ❌ MISSING | 0 | 0 |
| `xn_score_breakdown_cache` | ✅ EXISTS | 0 | 0 |
| `xn_score_factor_components` | ✅ EXISTS | 1 | 17 |
| `xn_score_factor_definitions` | ✅ EXISTS | 1 | 5 |
| `xn_score_history` | ✅ EXISTS | 0 | 0 |
| `xn_score_improvement_tips` | ✅ EXISTS | 1 | 17 |
| `xnscore_decay_history` | ✅ EXISTS | 0 | 0 |
| `xnscore_fraud_signals` | ✅ EXISTS | 0 | 0 |
| `xnscore_history` | ✅ EXISTS | 0 | 0 |
| `xnscore_initial_signals` | ✅ EXISTS | 0 | 0 |
| `xnscore_queued_increases` | ✅ EXISTS | 0 | 0 |
| `xnscore_recovery_periods` | ✅ EXISTS | 0 | 0 |
| `xnscore_tenure_history` | ✅ EXISTS | 0 | 0 |

## Status totals

- EXISTS: 136
- MISSING: 11

> **2026-05-20 correction:** the original `stripe_connect_accounts` row was a probe-list typo. The actual table is `stripe_connected_accounts` (past participle) — exists in prod with 16 columns, 2 RLS policies, 6 indexes. Migration `054_stripe_connect_payment_system.sql` is fully applied. See `docs/audit/12_schema_reconciliation.md` for the live-schema-driven verification.