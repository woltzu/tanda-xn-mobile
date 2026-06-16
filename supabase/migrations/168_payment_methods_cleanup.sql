-- 168_payment_methods_cleanup.sql
-- =====================================================================
-- P2 of the Manage payment methods review.
--
-- 1. DROP the dead payment_methods table.
--    - Confirmed 0 rows (pg_stat_user_tables) on 2026-06-15.
--    - No FK references TO it from any other table.
--    - Zero source-code references (grep -F 'from("payment_methods")'
--      returns nothing in screens/, hooks/, services/, context/).
--    - Schema is the mobile-money sketch from the abandoned backend
--      (phone_number, network, billing_address.jsonb). The app is
--      US-only / Stripe-only — it has never used this table.
--
-- 2. DO NOT drop user_payment_methods.
--    - Confirmed 0 rows, BUT three live source files read from it:
--        services/CycleProgressionEngine.ts:974
--        hooks/useLateContributions.ts:428
--        services/AutoRetryService.ts:457
--      The reads currently fail closed (no row → "no active payment
--      method" error). Dropping the table would change the failure
--      mode to "relation does not exist".
--    - Future cleanup: repoint those reads to stripe_payment_methods
--      OR delete the feature paths. Either way, that's its own change.
--      Tracked as a P3 follow-up; not in scope for this migration.
--
-- 3. ADD two new default-flag columns to stripe_payment_methods:
--      default_for_payin  — card the user contributes / sends with.
--      default_for_payout — bank the user receives payouts to.
--    The existing is_default conflates both. We keep it as a
--    short-term mirror (no app code change in this migration writes
--    to the new columns yet — frontend work is staged separately).
--
-- 4. ENFORCE "at most one of each per member" via UNIQUE PARTIAL
--    INDEXES. Postgres CHECK constraints can't reference other rows;
--    a unique partial index is the canonical Postgres pattern for
--    "at most one row matching predicate P." The index doubles as
--    the lookup index per the brief.
--
-- Idempotent: every DDL guarded with IF (NOT) EXISTS. Self-registers
-- at the bottom.
-- =====================================================================

-- ── 1. Drop the dead table ────────────────────────────────────────────
DROP TABLE IF EXISTS public.payment_methods CASCADE;

-- ── 2. Add the two default-flag columns ───────────────────────────────
ALTER TABLE public.stripe_payment_methods
  ADD COLUMN IF NOT EXISTS default_for_payin BOOLEAN DEFAULT FALSE;

ALTER TABLE public.stripe_payment_methods
  ADD COLUMN IF NOT EXISTS default_for_payout BOOLEAN DEFAULT FALSE;

-- ── 3. UNIQUE partial indexes — "at most one default-X per member" ─────
-- Status filter is included so a removed (status='removed') row that
-- still carries a TRUE flag doesn't block re-setting a default on an
-- active card.
DROP INDEX IF EXISTS public.uq_stripe_pm_default_payin;
CREATE UNIQUE INDEX uq_stripe_pm_default_payin
  ON public.stripe_payment_methods (member_id)
  WHERE default_for_payin = true AND status = 'active';

DROP INDEX IF EXISTS public.uq_stripe_pm_default_payout;
CREATE UNIQUE INDEX uq_stripe_pm_default_payout
  ON public.stripe_payment_methods (member_id)
  WHERE default_for_payout = true AND status = 'active';

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '168',
  'payment_methods_cleanup',
  ARRAY['-- 168: payment_methods_cleanup']
)
ON CONFLICT (version) DO NOTHING;
