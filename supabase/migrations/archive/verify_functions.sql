-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check all functions from migrations 019-024 exist
-- Run this to verify the database is properly configured
-- ══════════════════════════════════════════════════════════════════════════════

-- Check functions exist by querying pg_proc
SELECT
    p.proname as function_name,
    n.nspname as schema,
    CASE WHEN p.proname IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    -- Migration 019-021: XnScore System
    'calculate_initial_xnscore',
    'record_xnscore_event',
    'get_xnscore_breakdown',
    'calculate_vouch_value',
    'apply_xnscore_decay',
    'apply_tenure_growth',

    -- Migration 022: Creditworthiness Assessment
    'assess_creditworthiness',
    'calculate_dti_ratio',
    'get_risk_grade',
    'calculate_max_loan_amount',

    -- Migration 023: Interest Calculation
    'calculate_daily_interest',
    'calculate_accrued_interest',
    'get_effective_rate',
    'calculate_payoff_amount',
    'apply_payment_to_loan',
    'calculate_loan_late_fee',
    'apply_late_fee_to_loan',

    -- Migration 024: Monthly Payment System
    'calculate_estimated_monthly_payment',
    'generate_monthly_obligation',
    'generate_all_monthly_obligations',
    'schedule_payment_reminders',
    'send_due_reminders',
    'update_autopay_config',
    'process_autopay_payment',
    'process_all_autopay',
    'get_next_payment_obligation',
    'get_payment_obligations',
    'update_overdue_obligations'
)
ORDER BY p.proname;
