-- ════════════════════════════════════════════════════════════════════════════
-- Migration 234: drop_legacy_loan_payment_rpcs
-- Legacy RPC audit — full dead path cleanup
-- ════════════════════════════════════════════════════════════════════════════
--
-- Background:
--   Migration 220's docstring flagged that two loan-related RPCs were schema-
--   stale: send_loan_repayment_reminders + check_overdue_loans. Cleanup was
--   explicitly OUT OF SCOPE there and tracked as separate tech-debt.
--
-- Verification (live prod, 2026-06-22 via Management API):
--
--   1. Function bodies reference dead schema:
--      • check_overdue_contributions   → FROM group_members  (table renamed
--                                          to circle_members long ago)
--      • check_overdue_loans           → borrower_id (col doesn't exist on
--                                          modern loans table; col is user_id)
--                                          + FROM groups (renamed to circles)
--      • send_contribution_reminders   → FROM group_members
--      • send_loan_repayment_reminders → borrower_id
--
--   2. Cron schedule shows BOTH dependent jobs ACTIVE and failing on every
--      run for the entire visible history:
--
--      jobname                   schedule       command (live cron.job)
--      ---------------------     -------------  -------------------------------------
--      check-overdue-payments    0 */6 * * *    SELECT check_overdue_contributions();
--                                               SELECT check_overdue_loans();
--      daily-payment-reminders   0 9 * * *      SELECT run_daily_payment_reminders();
--
--      The last 6 cron.job_run_details rows for both jobs all show:
--        status=failed
--        ERROR: relation "group_members" does not exist
--      (The error surfaces on the FIRST sub-call inside the wrapper or the
--      cron's first statement — so loan RPCs are doubly dead: never reached.)
--
--   3. run_daily_payment_reminders() body has no exception handling and only
--      chains the 4 sub-RPCs. With all 4 broken, the wrapper is structurally
--      dead — the first sub-call aborts the whole transaction.
--
--   4. Modern replacement is already live:
--      • EF cron `send-payment-reminders`      (0 */4 * * *) — every 4h
--      • EF cron `update-overdue-obligations`  (0 1   * * *) — daily 01:00 UTC
--      • Trigger family from migration 220 fires on loans / loan_payments
--        INSERT/UPDATE — event-driven, no polling needed.
--
--   5. Zero callers in TypeScript code, zero Edge Functions reference any of
--      these RPC names. Only matches in `supabase/migrations/220_*.sql`
--      (docstring recon note) and `docs/audit/11_live_schema_dump.sql`.
--
-- Risk: ZERO. Every run has been failing. Removing the failing path stops
-- the silent error spam in `cron.job_run_details` without functional
-- regression — there was no function to regress.
--
-- This migration:
--   1. SELECT cron.unschedule() on both broken jobs (idempotent).
--   2. DROP FUNCTION on the 4 stale RPCs.
--   3. DROP FUNCTION on the now-orphan wrapper.
--   4. Self-register per CLAUDE.md convention.
--
-- Functions/cron NOT touched (intentionally — they're the live path):
--   • EF `send-payment-reminders` cron + EF body
--   • EF `update-overdue-obligations` cron + EF body
--   • notify_loan_* triggers from migration 220
--   • record_ai_decision_for_loan_* wrappers from migration 220
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Unschedule the two broken pg_cron jobs ───────────────────────
-- Idempotent via WHERE EXISTS so re-running the migration is safe.

SELECT cron.unschedule('check-overdue-payments')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'check-overdue-payments'
 );

SELECT cron.unschedule('daily-payment-reminders')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'daily-payment-reminders'
 );

-- ─── PART 2: Drop the four stale in-DB RPCs ───────────────────────────────
-- Order doesn't matter — none of them call each other; only the wrapper
-- calls them, and the wrapper is dropped in PART 3. `IF EXISTS` keeps the
-- migration re-runnable.

DROP FUNCTION IF EXISTS public.send_contribution_reminders();
DROP FUNCTION IF EXISTS public.send_loan_repayment_reminders();
DROP FUNCTION IF EXISTS public.check_overdue_contributions();
DROP FUNCTION IF EXISTS public.check_overdue_loans();

-- ─── PART 3: Drop the wrapper that chained all four ───────────────────────

DROP FUNCTION IF EXISTS public.run_daily_payment_reminders();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '234',
  'drop_legacy_loan_payment_rpcs',
  ARRAY['-- 234: drop_legacy_loan_payment_rpcs']
)
ON CONFLICT (version) DO NOTHING;
