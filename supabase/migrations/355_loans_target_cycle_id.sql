-- ═══════════════════════════════════════════════════════════════════════════
-- 355_loans_target_cycle_id.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 36 Phase 1 — repayment infrastructure, part 1 of 4.
--
-- Adds `target_cycle_id` to public.loans so an advance can be bound to the
-- specific circle_cycles row whose payout will auto-repay it. Mig 357's
-- execute_cycle_payout uses this column to look up the loan to deduct when
-- a cycle pays out.
--
-- Design notes:
--
-- 1. `loans` is the actual advance table used by request_advance
--    (mig 184/354). The apparent-alternate `liquidity_advances` (mig 059)
--    exists as scaffolding but is unused — zero INSERTs anywhere in
--    migrations, zero .from('liquidity_advances') in TS. Ignoring it.
--
-- 2. Nullable because:
--    a. Legacy loans predate this column and have no binding. They fall
--       through to the manual repayment path (process_advance_repayment
--       called explicitly) and are unaffected.
--    b. mig 356 extends request_advance to accept target_cycle_id as an
--       optional parameter; server default is "the earliest expected
--       payout cycle for a circle the member belongs to" (tiebreaker:
--       circle_cycles.id).
--
-- 3. ON DELETE SET NULL — circles/cycles are stamped completed rather than
--    deleted, so this branch is a defensive belt. If a cycle IS deleted,
--    the loan reverts to manual repayment posture.
--
-- 4. Index scope — partial on (target_cycle_id, status) filtered to active
--    rows. execute_cycle_payout asks "any active loan targeting this
--    cycle?" and the filter keeps the index small as the table grows.
--
-- The other columns Task 2 mentioned as maybe-missing (next_payment_date,
-- next_payment_amount_cents) already exist on loans (mig 022, verified).
-- Nothing to add for those.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS target_cycle_id UUID
    REFERENCES public.circle_cycles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.loans.target_cycle_id IS
  'The circle_cycles row whose payout will auto-repay this loan. NULL '
  'means the loan is on the manual-repayment path (either legacy or the '
  'caller opted out at request_advance time by passing NULL). Populated '
  'by mig 356 request_advance; consumed by mig 357 execute_cycle_payout.';

CREATE INDEX IF NOT EXISTS idx_loans_target_cycle_active
  ON public.loans (target_cycle_id, status)
  WHERE status = 'active'::loan_status;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '355',
  'loans_target_cycle_id',
  ARRAY['-- 355: add target_cycle_id column to loans + lookup index']
)
ON CONFLICT (version) DO NOTHING;
