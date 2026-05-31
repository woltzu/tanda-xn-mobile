-- ════════════════════════════════════════════════════════════════════════════
-- 077: add_balance_check — CHECK (current_balance_cents >= 0) on user_savings_goals
-- ════════════════════════════════════════════════════════════════════════════
--
-- Defence-in-depth backstop. The transfer_from_goal RPC (migration 073) and
-- the credit_goal_external RPC (migrations 074 / 076) both validate balance
-- before mutating, but the user_savings_goals table itself had no CHECK to
-- catch a future caller that forgets. user_wallets carries the equivalent
-- CHECK (main_balance_cents >= 0); this brings goals in line.
--
-- Safe to apply immediately:
--   - 0 negative balances in production (verified via PAT 2026-05-30).
--   - No existing CHECK constraints on user_savings_goals to collide with.
--   - 0 rows total in this environment — so even a hypothetical bad row
--     can't exist to fail the constraint.
--
-- Idempotency: DO block guards against re-applying. Migration self-registers
-- via the standard schema_migrations INSERT.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_savings_goals'::regclass
      AND conname  = 'current_balance_non_negative'
  ) THEN
    ALTER TABLE public.user_savings_goals
      ADD CONSTRAINT current_balance_non_negative
      CHECK (current_balance_cents >= 0);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '077',
  'add_balance_check',
  ARRAY['-- 077: add_balance_check (CHECK current_balance_cents >= 0 on user_savings_goals)']
)
ON CONFLICT (version) DO NOTHING;
