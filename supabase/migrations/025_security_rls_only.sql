-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 025: Security Fixes - RLS ONLY (Safe Version)
-- ══════════════════════════════════════════════════════════════════════════════
-- This migration ONLY enables RLS on the 4 tables that have it disabled.
-- It does NOT touch any views to avoid schema mismatch errors.
-- The SECURITY DEFINER views are lower priority and can be addressed later.
-- ══════════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ ENABLE RLS ON TABLES MISSING IT                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- 1. urgent_need_claims - Enable RLS with user-specific policies
DO $$
BEGIN
    ALTER TABLE urgent_need_claims ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS already enabled or table does not exist for urgent_need_claims';
END $$;

DROP POLICY IF EXISTS "urgent_need_claims_own_select" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_insert" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_update" ON urgent_need_claims;

CREATE POLICY "urgent_need_claims_own_select" ON urgent_need_claims
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_insert" ON urgent_need_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_update" ON urgent_need_claims
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. payout_algorithm_config - Enable RLS with read-only for authenticated users
DO $$
BEGIN
    ALTER TABLE payout_algorithm_config ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS already enabled or table does not exist for payout_algorithm_config';
END $$;

DROP POLICY IF EXISTS "payout_algorithm_config_read" ON payout_algorithm_config;
CREATE POLICY "payout_algorithm_config_read" ON payout_algorithm_config
    FOR SELECT TO authenticated USING (true);

-- 3. savings_goal_types - Enable RLS with read-only for authenticated users
DO $$
BEGIN
    ALTER TABLE savings_goal_types ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS already enabled or table does not exist for savings_goal_types';
END $$;

DROP POLICY IF EXISTS "savings_goal_types_read" ON savings_goal_types;
CREATE POLICY "savings_goal_types_read" ON savings_goal_types
    FOR SELECT TO authenticated USING (true);

-- 4. dissolution_trigger_config - Enable RLS with read-only for authenticated users
DO $$
BEGIN
    ALTER TABLE dissolution_trigger_config ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RLS already enabled or table does not exist for dissolution_trigger_config';
END $$;

DROP POLICY IF EXISTS "dissolution_trigger_config_read" ON dissolution_trigger_config;
CREATE POLICY "dissolution_trigger_config_read" ON dissolution_trigger_config
    FOR SELECT TO authenticated USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 025 (RLS ONLY)
-- ══════════════════════════════════════════════════════════════════════════════
-- NOTE: The SECURITY DEFINER views are a lower-priority issue and will be
-- addressed in a future migration after proper schema verification.
-- ══════════════════════════════════════════════════════════════════════════════
