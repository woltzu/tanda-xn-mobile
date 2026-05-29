-- ═══════════════════════════════════════════════════════════════════════════
-- 072_goals_v2_fields.sql
-- Extend the existing live goals tables (user_savings_goals /
-- savings_transactions, created in 015) with the V2 goal fields, rather than
-- creating a parallel goals/goal_transactions system. Amounts stay in cents
-- (BIGINT) to match the existing data layer (useGoalActions converts
-- dollars↔cents). All ADDs are idempotent so re-running is safe.
--
-- Not added (already present / reused): emoji, metadata (already exist);
-- locked_until (= lock_end_date), goal_status (= status), completed_at
-- (= achieved_at), and the *_cents amount columns. RLS already exists on both
-- tables (pe_usg_* / pe_st_*), so no new policies here — and since neither
-- table has a DELETE policy, deletion is a soft delete (goal_status) in code.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS goal_type TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS savings_type TEXT,                 -- 'flexible' | 'emergency' | 'locked'
  ADD COLUMN IF NOT EXISTS monthly_contribution_cents BIGINT,
  ADD COLUMN IF NOT EXISTS auto_deposit_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_deposit_day INT,
  ADD COLUMN IF NOT EXISTS linked_circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS circle_payout_action TEXT,         -- 'deposit_all' | 'deposit_percent' | 'ask_each_time'
  ADD COLUMN IF NOT EXISTS circle_payout_percent INT,
  ADD COLUMN IF NOT EXISTS lock_period_months INT;

ALTER TABLE savings_transactions
  ADD COLUMN IF NOT EXISTS fee_cents BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalty_amount_cents BIGINT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_usg_linked_circle ON user_savings_goals(linked_circle_id);

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '072',
  'goals_v2_fields',
  ARRAY['-- 072: goals_v2_fields']
)
ON CONFLICT (version) DO NOTHING;
