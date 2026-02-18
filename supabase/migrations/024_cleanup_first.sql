-- ══════════════════════════════════════════════════════════════════════════════
-- CLEANUP: Run this first to remove any orphaned objects
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop indexes explicitly (they may be orphaned)
DROP INDEX IF EXISTS idx_obligations_loan;
DROP INDEX IF EXISTS idx_obligations_user;
DROP INDEX IF EXISTS idx_obligations_due_date;
DROP INDEX IF EXISTS idx_obligations_status;
DROP INDEX IF EXISTS idx_obligations_upcoming;
DROP INDEX IF EXISTS idx_autopay_loan;
DROP INDEX IF EXISTS idx_autopay_user;
DROP INDEX IF EXISTS idx_autopay_status;
DROP INDEX IF EXISTS idx_autopay_next;
DROP INDEX IF EXISTS idx_reminders_loan;
DROP INDEX IF EXISTS idx_reminders_user;
DROP INDEX IF EXISTS idx_reminders_scheduled;
DROP INDEX IF EXISTS idx_reminders_obligation;

-- Drop views
DROP VIEW IF EXISTS v_monthly_payment_dashboard CASCADE;
DROP VIEW IF EXISTS v_autopay_queue CASCADE;
DROP VIEW IF EXISTS v_payment_reminders_due CASCADE;
DROP VIEW IF EXISTS v_obligation_summary CASCADE;

-- Drop all functions
DROP FUNCTION IF EXISTS generate_monthly_obligation CASCADE;
DROP FUNCTION IF EXISTS generate_all_monthly_obligations CASCADE;
DROP FUNCTION IF EXISTS calculate_estimated_monthly_payment CASCADE;
DROP FUNCTION IF EXISTS process_autopay_payment CASCADE;
DROP FUNCTION IF EXISTS process_all_autopay CASCADE;
DROP FUNCTION IF EXISTS schedule_payment_reminders CASCADE;
DROP FUNCTION IF EXISTS send_due_reminders CASCADE;
DROP FUNCTION IF EXISTS mark_reminder_sent CASCADE;
DROP FUNCTION IF EXISTS update_autopay_config CASCADE;
DROP FUNCTION IF EXISTS get_next_payment_obligation CASCADE;
DROP FUNCTION IF EXISTS get_payment_obligations CASCADE;
DROP FUNCTION IF EXISTS retry_failed_autopay CASCADE;
DROP FUNCTION IF EXISTS update_overdue_obligations CASCADE;
DROP FUNCTION IF EXISTS update_obligation_timestamp CASCADE;
DROP FUNCTION IF EXISTS update_autopay_timestamp CASCADE;
DROP FUNCTION IF EXISTS update_reminder_timestamp CASCADE;

-- Drop tables
DROP TABLE IF EXISTS loan_payment_reminders CASCADE;
DROP TABLE IF EXISTS loan_autopay_configs CASCADE;
DROP TABLE IF EXISTS loan_payment_obligations CASCADE;

-- Drop types
DROP TYPE IF EXISTS obligation_status CASCADE;
DROP TYPE IF EXISTS autopay_type CASCADE;
DROP TYPE IF EXISTS autopay_status CASCADE;
DROP TYPE IF EXISTS reminder_channel CASCADE;
DROP TYPE IF EXISTS reminder_status CASCADE;
DROP TYPE IF EXISTS reminder_type CASCADE;

-- Done cleanup
SELECT 'Cleanup complete' as status;
