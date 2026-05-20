-- =====================================================
-- 031: SAVINGS CONTEXT SUPPORT
-- Adds missing RLS policies, emoji column, metadata JSONB,
-- and early withdrawal penalties for savings goals system.
-- =====================================================

-- 1. INSERT policy for savings_transactions (only SELECT exists in 015)
CREATE POLICY "pe_st_insert" ON savings_transactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. UPDATE policy for savings_transactions (for status updates)
CREATE POLICY "pe_st_update" ON savings_transactions
  FOR UPDATE USING (user_id = auth.uid());

-- 3. Add emoji column to savings_goal_types for UI display
ALTER TABLE savings_goal_types ADD COLUMN IF NOT EXISTS emoji TEXT;

UPDATE savings_goal_types SET emoji = CASE code
  WHEN 'emergency' THEN '🛡️'
  WHEN 'education' THEN '📚'
  WHEN 'housing' THEN '🏠'
  WHEN 'business' THEN '💼'
  WHEN 'family' THEN '👨‍👩‍👧'
  WHEN 'general' THEN '🎯'
  WHEN 'locked' THEN '🔒'
END WHERE emoji IS NULL;

-- 4. Set early withdrawal penalties (defaults were 0 in seed data)
UPDATE savings_goal_types SET early_withdrawal_penalty_percent = CASE code
  WHEN 'locked' THEN 10.00
  WHEN 'housing' THEN 3.00
  WHEN 'education' THEN 2.00
  WHEN 'business' THEN 2.00
  ELSE 0
END;

-- 5. Add metadata JSONB for auto-save settings on user goals
ALTER TABLE user_savings_goals ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6. Add emoji column to user_savings_goals for custom goal emoji
ALTER TABLE user_savings_goals ADD COLUMN IF NOT EXISTS emoji TEXT;

-- 7. SELECT policy for savings_goal_types (reference table, readable by all authenticated users)
ALTER TABLE savings_goal_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sgt_select_authenticated" ON savings_goal_types
  FOR SELECT USING (auth.role() = 'authenticated');
