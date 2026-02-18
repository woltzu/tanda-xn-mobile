-- ============================================================================
-- TANDAXN - DROP OLD TABLES AND RECREATE FRESH
--
-- WARNING: This will DELETE all existing data in these tables!
-- Run this FIRST, then run tandaxn_complete_schema.sql
-- ============================================================================

-- Drop tables in reverse dependency order (children first, then parents)

-- Section 10: Audit & System
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Section 9: Elder System
DROP TABLE IF EXISTS public.training_enrollments CASCADE;
DROP TABLE IF EXISTS public.training_courses CASCADE;
DROP TABLE IF EXISTS public.mediation_cases CASCADE;
DROP TABLE IF EXISTS public.elder_stats CASCADE;
DROP TABLE IF EXISTS public.elder_profiles CASCADE;

-- Section 8: Communities
DROP TABLE IF EXISTS public.community_circles CASCADE;
DROP TABLE IF EXISTS public.community_members CASCADE;
DROP TABLE IF EXISTS public.communities CASCADE;

-- Section 7: Savings Goals
DROP TABLE IF EXISTS public.goal_milestones CASCADE;
DROP TABLE IF EXISTS public.goal_transactions CASCADE;
DROP TABLE IF EXISTS public.savings_goals CASCADE;

-- Section 6: Loans/Advances
DROP TABLE IF EXISTS public.future_payouts CASCADE;
DROP TABLE IF EXISTS public.loan_repayments CASCADE;
DROP TABLE IF EXISTS public.loan_applications CASCADE;
DROP TABLE IF EXISTS public.loan_products CASCADE;

-- Section 5: Trust & Vouching
DROP TABLE IF EXISTS public.trust_tier_history CASCADE;
DROP TABLE IF EXISTS public.security_deposits CASCADE;
DROP TABLE IF EXISTS public.honor_badges CASCADE;
DROP TABLE IF EXISTS public.vouch_records CASCADE;
DROP TABLE IF EXISTS public.trust_profiles CASCADE;

-- Section 4: XnScore
DROP TABLE IF EXISTS public.score_benefits CASCADE;
DROP TABLE IF EXISTS public.score_history CASCADE;
DROP TABLE IF EXISTS public.score_events CASCADE;
DROP TABLE IF EXISTS public.xn_scores CASCADE;

-- Section 3: Wallet & Transactions
DROP TABLE IF EXISTS public.remittances CASCADE;
DROP TABLE IF EXISTS public.exchange_rates CASCADE;
DROP TABLE IF EXISTS public.payment_methods CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.wallet_balances CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;

-- Section 2: Circles
DROP TABLE IF EXISTS public.circle_activity CASCADE;
DROP TABLE IF EXISTS public.circle_invitations CASCADE;
DROP TABLE IF EXISTS public.circle_payouts CASCADE;
DROP TABLE IF EXISTS public.circle_contributions CASCADE;
DROP TABLE IF EXISTS public.circle_members CASCADE;
DROP TABLE IF EXISTS public.invited_members CASCADE;
DROP TABLE IF EXISTS public.circles CASCADE;

-- Section 1: User Management
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.user_verifications CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_circle_member_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_community_member_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;

-- ============================================================================
-- DONE! Old tables dropped. Now run tandaxn_complete_schema.sql
-- ============================================================================
