-- 169_autopay_configs_unique.sql
-- =====================================================================
-- P2 of the Advance repayment autopay review.
--
-- 1. UNIQUE constraint on loan_autopay_configs (user_id, loan_id).
--    Until now AutopaySetupScreen had to SELECT-then-INSERT-or-UPDATE
--    because the table allowed multiple configs per (user, loan)
--    pair. The new constraint backs a real upsert via
--    INSERT ... ON CONFLICT (user_id, loan_id) DO UPDATE.
--
--    Safe to apply: the table is empty in production
--    (pg_stat_user_tables.n_live_tup = 0 confirmed 2026-06-15).
--
-- 2. Two covering indexes for the queries that run hot:
--    - idx_loan_autopay_user_status  — useAutopay hook reads "any
--      active config for this user".
--    - idx_loan_autopay_loan_status  — process-autopay cron reads
--      "active configs for this loan tonight".
--
-- 3. user_preferences.advance_reminder_days — the global default
--    that the NotificationPrefsScreen chip row writes to. Per-advance
--    overrides still live on loan_autopay_configs.days_before_due;
--    this column is the source-of-truth when the user creates a
--    fresh autopay config (or cascades a new default to all configs).
--
-- Idempotent — all DDL guarded.
-- =====================================================================

-- ── 1. UNIQUE constraint ─────────────────────────────────────────────
-- DO block lets us idempotently add the constraint without erroring
-- if a previous run already attached it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.loan_autopay_configs'::regclass
      AND conname  = 'loan_autopay_configs_user_loan_unique'
  ) THEN
    ALTER TABLE public.loan_autopay_configs
      ADD CONSTRAINT loan_autopay_configs_user_loan_unique
      UNIQUE (user_id, loan_id);
  END IF;
END $$;

-- ── 2. Covering indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loan_autopay_user_status
  ON public.loan_autopay_configs (user_id, status);

CREATE INDEX IF NOT EXISTS idx_loan_autopay_loan_status
  ON public.loan_autopay_configs (loan_id, status);

-- ── 3. user_preferences.advance_reminder_days ───────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS advance_reminder_days INTEGER DEFAULT 3;

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '169',
  'autopay_configs_unique',
  ARRAY['-- 169: autopay_configs_unique']
)
ON CONFLICT (version) DO NOTHING;
