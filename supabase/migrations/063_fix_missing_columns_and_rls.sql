-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 063: Fix Missing Columns & RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Fixes three pre-existing runtime errors:
--
-- 1. stripe_customers missing 'name' column
--    StripeConnectEngine.createOrGetCustomer inserts/reads a 'name' column
--    that was never added to the table definition in 054.
--
-- 2. member_contribution_stats missing on_time_count/late_count/missed_count
--    The compute_member_profile function (035) references these columns
--    but the table (011) only has total_payments_made, total_late_payments, etc.
--
-- 3. user_events RLS too strict for anonymous session starts
--    EventService starts logging before the user is fully authenticated,
--    causing "violates row-level security" errors. Allow inserts where
--    user_id matches auth.uid() OR user_id is null (anonymous events).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 1: Add 'name' column to stripe_customers
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stripe_customers
  ADD COLUMN IF NOT EXISTS name TEXT;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Add missing aggregation columns to member_contribution_stats
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE member_contribution_stats
  ADD COLUMN IF NOT EXISTS on_time_count INTEGER DEFAULT 0;

ALTER TABLE member_contribution_stats
  ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0;

ALTER TABLE member_contribution_stats
  ADD COLUMN IF NOT EXISTS missed_count INTEGER DEFAULT 0;


-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 3: Relax user_events INSERT RLS to allow pre-auth event logging
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the strict policy
DROP POLICY IF EXISTS "ue_insert_own" ON user_events;

-- Recreate with relaxed check: allow if user_id matches auth or is null
CREATE POLICY "ue_insert_own" ON user_events
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
  );
