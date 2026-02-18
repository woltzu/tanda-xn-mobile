-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 025 v3: Security Fixes (Final Corrected)
-- ══════════════════════════════════════════════════════════════════════════════
-- Fixes:
-- 1. SECURITY DEFINER views - Convert to SECURITY INVOKER
-- 2. RLS disabled tables - Enable RLS and add policies
-- ══════════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1: ENABLE RLS ON TABLES MISSING IT                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Table: urgent_need_claims
DO $$ BEGIN
    ALTER TABLE urgent_need_claims ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "urgent_need_claims_own_select" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_insert" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_update" ON urgent_need_claims;

CREATE POLICY "urgent_need_claims_own_select" ON urgent_need_claims
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_insert" ON urgent_need_claims
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_update" ON urgent_need_claims
    FOR UPDATE USING (auth.uid() = user_id);

-- Table: payout_algorithm_config (admin only - read for all authenticated)
DO $$ BEGIN
    ALTER TABLE payout_algorithm_config ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "payout_algorithm_config_read" ON payout_algorithm_config;
CREATE POLICY "payout_algorithm_config_read" ON payout_algorithm_config
    FOR SELECT TO authenticated USING (true);

-- Table: savings_goal_types (read-only config table)
DO $$ BEGIN
    ALTER TABLE savings_goal_types ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "savings_goal_types_read" ON savings_goal_types;
CREATE POLICY "savings_goal_types_read" ON savings_goal_types
    FOR SELECT TO authenticated USING (true);

-- Table: dissolution_trigger_config (read-only config table)
DO $$ BEGIN
    ALTER TABLE dissolution_trigger_config ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "dissolution_trigger_config_read" ON dissolution_trigger_config;
CREATE POLICY "dissolution_trigger_config_read" ON dissolution_trigger_config
    FOR SELECT TO authenticated USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2: RECREATE VIEWS WITH SECURITY INVOKER                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- ── v_monthly_payment_dashboard ──────────────────────────────────────────────
DROP VIEW IF EXISTS v_monthly_payment_dashboard;
CREATE VIEW v_monthly_payment_dashboard AS
SELECT o.id as obligation_id, o.loan_id, o.user_id, p.full_name, o.obligation_number, o.due_date,
    (o.due_date - CURRENT_DATE) as days_until_due, o.total_due_cents / 100.0 as total_due,
    o.total_paid_cents / 100.0 as total_paid, (o.total_due_cents - o.total_paid_cents) / 100.0 as remaining,
    o.status, o.late_fee_cents / 100.0 as late_fee, l.autopay_enabled, ac.autopay_type, ac.status as autopay_status
FROM loan_payment_obligations o
JOIN loans l ON l.id = o.loan_id
JOIN profiles p ON p.id = o.user_id
LEFT JOIN loan_autopay_configs ac ON ac.loan_id = o.loan_id
WHERE o.status IN ('upcoming', 'due', 'overdue', 'partial');

-- ── v_autopay_queue ──────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_autopay_queue;
CREATE VIEW v_autopay_queue AS
SELECT ac.id as config_id, ac.loan_id, l.user_id, p.full_name, ac.autopay_type, ac.status, ac.next_scheduled_at,
    ac.consecutive_failures, o.id as next_obligation_id, o.due_date as next_due_date,
    o.total_due_cents / 100.0 as next_amount_due, l.total_outstanding_cents / 100.0 as total_outstanding
FROM loan_autopay_configs ac
JOIN loans l ON l.id = ac.loan_id
JOIN profiles p ON p.id = l.user_id
LEFT JOIN LATERAL (SELECT * FROM loan_payment_obligations WHERE loan_id = ac.loan_id AND status IN ('upcoming', 'due') ORDER BY due_date ASC LIMIT 1) o ON TRUE
WHERE ac.status = 'active' AND l.status = 'active';

-- ── v_payment_reminders_due ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_payment_reminders_due;
CREATE VIEW v_payment_reminders_due AS
SELECT r.id as reminder_id, r.loan_id, r.user_id, p.full_name, p.email, r.reminder_type, r.channel,
    r.scheduled_for, r.title, r.message, r.amount_due_cents / 100.0 as amount_due, r.due_date, r.status
FROM loan_payment_reminders r JOIN profiles p ON p.id = r.user_id
WHERE r.status = 'scheduled' AND r.scheduled_for <= now();

-- ── v_obligation_summary ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_obligation_summary;
CREATE VIEW v_obligation_summary AS
SELECT l.id as loan_id, l.user_id, l.estimated_monthly_payment_cents / 100.0 as monthly_payment,
    l.payment_day_of_month, l.autopay_enabled,
    COUNT(o.id) as total_obligations, COUNT(o.id) FILTER (WHERE o.status = 'paid') as paid_count,
    COUNT(o.id) FILTER (WHERE o.status IN ('overdue', 'partial')) as overdue_count,
    COALESCE(SUM(o.total_due_cents), 0) / 100.0 as total_due, COALESCE(SUM(o.total_paid_cents), 0) / 100.0 as total_paid,
    COALESCE(SUM(o.late_fee_cents), 0) / 100.0 as total_late_fees
FROM loans l LEFT JOIN loan_payment_obligations o ON o.loan_id = l.id
WHERE l.status = 'active' GROUP BY l.id;

-- ── v_overdue_payments_dashboard (FIXED: correct column names and status) ────
DROP VIEW IF EXISTS v_overdue_payments_dashboard;
CREATE VIEW v_overdue_payments_dashboard AS
SELECT
    ps.id as schedule_id,
    ps.loan_id,
    l.user_id,
    p.full_name,
    ps.payment_number,
    ps.due_date,
    (CURRENT_DATE - ps.due_date) as days_overdue,
    ps.total_due_cents / 100.0 as amount_due,
    COALESCE(ps.total_paid_cents, 0) / 100.0 as amount_paid,
    (ps.total_due_cents - COALESCE(ps.total_paid_cents, 0)) / 100.0 as remaining,
    ps.status
FROM loan_payment_schedule ps
JOIN loans l ON l.id = ps.loan_id
JOIN profiles p ON p.id = l.user_id
WHERE ps.status IN ('late', 'partial') AND l.status = 'active';

-- ── v_loan_interest_summary (FIXED: late_fee_status uses 'pending' not 'applied') ─
DROP VIEW IF EXISTS v_loan_interest_summary;
CREATE VIEW v_loan_interest_summary AS
SELECT
    l.id as loan_id,
    l.user_id,
    l.principal_cents / 100.0 as principal,
    l.apr,
    l.outstanding_principal_cents / 100.0 as outstanding_principal,
    COALESCE(SUM(ia.interest_cents), 0) / 100.0 as total_accrued_interest,
    COALESCE(SUM(lf.calculated_fee_cents) FILTER (WHERE lf.status = 'pending'), 0) / 100.0 as total_late_fees,
    l.status
FROM loans l
LEFT JOIN loan_interest_accruals ia ON ia.loan_id = l.id
LEFT JOIN loan_late_fees lf ON lf.loan_id = l.id
GROUP BY l.id;

-- ── v_interest_accrual_audit ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_interest_accrual_audit;
CREATE VIEW v_interest_accrual_audit AS
SELECT
    ia.id,
    ia.loan_id,
    l.user_id,
    ia.accrual_date,
    ia.principal_cents / 100.0 as principal,
    ia.rate_applied,
    ia.interest_cents / 100.0 as interest,
    ia.created_at
FROM loan_interest_accruals ia
JOIN loans l ON l.id = ia.loan_id;

-- ── v_loan_portfolio_summary ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_loan_portfolio_summary;
CREATE VIEW v_loan_portfolio_summary AS
SELECT
    COUNT(*) as total_loans,
    COUNT(*) FILTER (WHERE status = 'active') as active_loans,
    COUNT(*) FILTER (WHERE status = 'paid_off') as paid_off_loans,
    COUNT(*) FILTER (WHERE status = 'defaulted') as defaulted_loans,
    COALESCE(SUM(principal_cents) FILTER (WHERE status = 'active'), 0) / 100.0 as total_principal_outstanding,
    COALESCE(SUM(outstanding_principal_cents) FILTER (WHERE status = 'active'), 0) / 100.0 as total_balance_outstanding
FROM loans;

-- ── v_active_loans_dashboard ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_active_loans_dashboard;
CREATE VIEW v_active_loans_dashboard AS
SELECT
    l.id as loan_id,
    l.user_id,
    p.full_name,
    l.principal_cents / 100.0 as principal,
    l.outstanding_principal_cents / 100.0 as outstanding,
    l.apr,
    l.term_months,
    l.status,
    l.created_at
FROM loans l
JOIN profiles p ON p.id = l.user_id
WHERE l.status = 'active';

-- ── v_creditworthiness_summary ───────────────────────────────────────────────
DROP VIEW IF EXISTS v_creditworthiness_summary;
CREATE VIEW v_creditworthiness_summary AS
SELECT
    ca.id,
    ca.user_id,
    p.full_name,
    ca.credit_score,
    ca.risk_grade,
    ca.max_loan_amount_cents / 100.0 as max_loan_amount,
    ca.recommended_apr,
    ca.assessment_date,
    ca.expires_at
FROM creditworthiness_assessments ca
JOIN profiles p ON p.id = ca.user_id
WHERE ca.expires_at > now();

-- ── v_guarantor_exposure ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_guarantor_exposure;
CREATE VIEW v_guarantor_exposure AS
SELECT
    lg.guarantor_user_id as user_id,
    p.full_name,
    COUNT(*) as total_guarantees,
    COUNT(*) FILTER (WHERE lg.status = 'active') as active_guarantees,
    COALESCE(SUM(lg.max_liability_cents) FILTER (WHERE lg.status = 'active'), 0) / 100.0 as total_exposure
FROM loan_guarantees lg
JOIN profiles p ON p.id = lg.guarantor_user_id
GROUP BY lg.guarantor_user_id, p.full_name;

-- ── v_xnscore_leaderboard ────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_xnscore_leaderboard;
CREATE VIEW v_xnscore_leaderboard AS
SELECT
    xs.user_id,
    p.full_name,
    xs.current_score,
    xs.tier,
    xs.percentile_rank,
    xs.updated_at
FROM xnscores xs
JOIN profiles p ON p.id = xs.user_id
ORDER BY xs.current_score DESC;

-- ── v_xnscore_tier_distribution ──────────────────────────────────────────────
DROP VIEW IF EXISTS v_xnscore_tier_distribution;
CREATE VIEW v_xnscore_tier_distribution AS
SELECT
    tier,
    COUNT(*) as user_count,
    AVG(current_score) as avg_score,
    MIN(current_score) as min_score,
    MAX(current_score) as max_score
FROM xnscores
GROUP BY tier;

-- ── v_user_xnscore_details ───────────────────────────────────────────────────
DROP VIEW IF EXISTS v_user_xnscore_details;
CREATE VIEW v_user_xnscore_details AS
SELECT
    xs.user_id,
    p.full_name,
    xs.current_score,
    xs.tier,
    xs.lifetime_earnings,
    xs.contribution_score,
    xs.payment_score,
    xs.community_score,
    xs.tenure_months,
    xs.updated_at
FROM xnscores xs
JOIN profiles p ON p.id = xs.user_id;

-- ── v_xnscore_activity_summary ───────────────────────────────────────────────
DROP VIEW IF EXISTS v_xnscore_activity_summary;
CREATE VIEW v_xnscore_activity_summary AS
SELECT
    xh.user_id,
    DATE_TRUNC('month', xh.created_at) as month,
    SUM(xh.points_change) as total_points_change,
    COUNT(*) as event_count
FROM xnscore_history xh
GROUP BY xh.user_id, DATE_TRUNC('month', xh.created_at);

-- ── v_decay_at_risk_users ────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_decay_at_risk_users;
CREATE VIEW v_decay_at_risk_users AS
SELECT
    xs.user_id,
    p.full_name,
    xs.current_score,
    xs.last_activity_at,
    (CURRENT_DATE - xs.last_activity_at::DATE) as days_inactive
FROM xnscores xs
JOIN profiles p ON p.id = xs.user_id
WHERE xs.last_activity_at < (now() - INTERVAL '30 days');

-- ── v_tenure_eligible_users ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_tenure_eligible_users;
CREATE VIEW v_tenure_eligible_users AS
SELECT
    xs.user_id,
    p.full_name,
    xs.current_score,
    xs.tenure_months,
    xs.last_tenure_bonus_at
FROM xnscores xs
JOIN profiles p ON p.id = xs.user_id
WHERE xs.tenure_months > 0
AND (xs.last_tenure_bonus_at IS NULL OR xs.last_tenure_bonus_at < (now() - INTERVAL '30 days'));

-- ── v_recovery_period_users ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_recovery_period_users;
CREATE VIEW v_recovery_period_users AS
SELECT
    rp.user_id,
    p.full_name,
    rp.start_date,
    rp.end_date,
    rp.reason,
    rp.status,
    xs.current_score
FROM xnscore_recovery_periods rp
JOIN profiles p ON p.id = rp.user_id
JOIN xnscores xs ON xs.user_id = rp.user_id
WHERE rp.status = 'active';

-- ── v_user_score_breakdown ───────────────────────────────────────────────────
DROP VIEW IF EXISTS v_user_score_breakdown;
CREATE VIEW v_user_score_breakdown AS
SELECT
    sb.user_id,
    p.full_name,
    sb.total_score,
    sb.factor_scores,
    sb.calculation_details,
    sb.calculated_at
FROM score_breakdowns sb
JOIN profiles p ON p.id = sb.user_id;

-- ── v_factor_performance_summary ─────────────────────────────────────────────
DROP VIEW IF EXISTS v_factor_performance_summary;
CREATE VIEW v_factor_performance_summary AS
SELECT
    fd.factor_key,
    fd.factor_name,
    fd.max_points,
    AVG((sb.factor_scores->>fd.factor_key)::NUMERIC) as avg_score,
    COUNT(*) as user_count
FROM score_factor_definitions fd
CROSS JOIN score_breakdowns sb
WHERE sb.factor_scores ? fd.factor_key
GROUP BY fd.factor_key, fd.factor_name, fd.max_points;

-- ── v_improvement_opportunities ──────────────────────────────────────────────
DROP VIEW IF EXISTS v_improvement_opportunities;
CREATE VIEW v_improvement_opportunities AS
SELECT
    sb.user_id,
    p.full_name,
    fd.factor_key,
    fd.factor_name,
    (sb.factor_scores->>fd.factor_key)::NUMERIC as current_score,
    fd.max_points,
    fd.max_points - (sb.factor_scores->>fd.factor_key)::NUMERIC as potential_gain
FROM score_breakdowns sb
JOIN profiles p ON p.id = sb.user_id
CROSS JOIN score_factor_definitions fd
WHERE sb.factor_scores ? fd.factor_key
AND (sb.factor_scores->>fd.factor_key)::NUMERIC < fd.max_points;

-- ── v_active_cascades ────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_active_cascades;
CREATE VIEW v_active_cascades AS
SELECT
    dc.id,
    dc.circle_id,
    dc.defaulting_user_id,
    p.full_name as defaulting_user_name,
    dc.cascade_stage,
    dc.total_default_amount_cents / 100.0 as total_default_amount,
    dc.recovered_amount_cents / 100.0 as recovered_amount,
    dc.status,
    dc.created_at
FROM default_cascades dc
JOIN profiles p ON p.id = dc.defaulting_user_id
WHERE dc.status = 'active';

-- ── v_voucher_impact_summary ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_voucher_impact_summary;
CREATE VIEW v_voucher_impact_summary AS
SELECT
    vi.voucher_id as user_id,
    p.full_name,
    COUNT(*) as total_vouches,
    SUM(vi.impact_amount_cents) / 100.0 as total_impact_amount,
    AVG(vi.xnscore_adjustment) as avg_xnscore_impact
FROM voucher_impacts vi
JOIN profiles p ON p.id = vi.voucher_id
GROUP BY vi.voucher_id, p.full_name;

-- ── v_recovery_performance ───────────────────────────────────────────────────
DROP VIEW IF EXISTS v_recovery_performance;
CREATE VIEW v_recovery_performance AS
SELECT
    rp.id,
    rp.user_id,
    p.full_name,
    rp.total_debt_cents / 100.0 as total_debt,
    rp.paid_amount_cents / 100.0 as paid_amount,
    rp.remaining_amount_cents / 100.0 as remaining_amount,
    rp.status,
    rp.completion_percentage
FROM recovery_plans rp
JOIN profiles p ON p.id = rp.user_id;

-- ── v_circle_resolution_stats ────────────────────────────────────────────────
DROP VIEW IF EXISTS v_circle_resolution_stats;
CREATE VIEW v_circle_resolution_stats AS
SELECT
    cr.circle_id,
    c.name as circle_name,
    COUNT(*) as total_resolutions,
    SUM(cr.amount_cents) / 100.0 as total_amount,
    AVG(cr.amount_cents) / 100.0 as avg_amount
FROM circle_resolutions cr
JOIN circles c ON c.id = cr.circle_id
GROUP BY cr.circle_id, c.name;

-- ── v_payment_plan_progress ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_payment_plan_progress;
CREATE VIEW v_payment_plan_progress AS
SELECT
    pp.id,
    pp.user_id,
    p.full_name,
    pp.total_amount_cents / 100.0 as total_amount,
    pp.paid_amount_cents / 100.0 as paid_amount,
    pp.installment_amount_cents / 100.0 as installment_amount,
    pp.installments_completed,
    pp.total_installments,
    pp.next_payment_date,
    pp.status
FROM payment_plans pp
JOIN profiles p ON p.id = pp.user_id
WHERE pp.status = 'active';

-- ── v_user_debts ─────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_user_debts;
CREATE VIEW v_user_debts AS
SELECT
    md.id,
    md.debtor_id as user_id,
    p.full_name,
    md.circle_id,
    c.name as circle_name,
    md.amount_cents / 100.0 as amount,
    md.paid_amount_cents / 100.0 as paid_amount,
    md.status,
    md.created_at
FROM member_debts md
JOIN profiles p ON p.id = md.debtor_id
JOIN circles c ON c.id = md.circle_id
WHERE md.status != 'paid';

-- ── v_active_dissolution_requests ────────────────────────────────────────────
DROP VIEW IF EXISTS v_active_dissolution_requests;
CREATE VIEW v_active_dissolution_requests AS
SELECT
    dr.id,
    dr.circle_id,
    c.name as circle_name,
    dr.requested_by,
    p.full_name as requester_name,
    dr.reason,
    dr.status,
    dr.voting_ends_at,
    dr.created_at
FROM dissolution_requests dr
JOIN circles c ON c.id = dr.circle_id
JOIN profiles p ON p.id = dr.requested_by
WHERE dr.status = 'pending';

-- ── v_dissolution_analytics ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_dissolution_analytics;
CREATE VIEW v_dissolution_analytics AS
SELECT
    DATE_TRUNC('month', dr.created_at) as month,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE dr.status = 'approved') as approved_count,
    COUNT(*) FILTER (WHERE dr.status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE dr.status = 'pending') as pending_count
FROM dissolution_requests dr
GROUP BY DATE_TRUNC('month', dr.created_at);

-- ── v_member_dissolution_summary ─────────────────────────────────────────────
DROP VIEW IF EXISTS v_member_dissolution_summary;
CREATE VIEW v_member_dissolution_summary AS
SELECT
    dmp.user_id,
    p.full_name,
    dmp.dissolution_id,
    dmp.refund_amount_cents / 100.0 as refund_amount,
    dmp.status,
    dmp.processed_at
FROM dissolution_member_positions dmp
JOIN profiles p ON p.id = dmp.user_id;

-- ── v_active_removal_requests ────────────────────────────────────────────────
DROP VIEW IF EXISTS v_active_removal_requests;
CREATE VIEW v_active_removal_requests AS
SELECT
    rr.id,
    rr.circle_id,
    c.name as circle_name,
    rr.member_id,
    p.full_name as member_name,
    rr.requested_by,
    rr.reason,
    rr.status,
    rr.voting_ends_at
FROM removal_requests rr
JOIN circles c ON c.id = rr.circle_id
JOIN profiles p ON p.id = rr.member_id
WHERE rr.status = 'pending';

-- ── v_removal_statistics ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_removal_statistics;
CREATE VIEW v_removal_statistics AS
SELECT
    c.id as circle_id,
    c.name as circle_name,
    COUNT(*) as total_removals,
    COUNT(*) FILTER (WHERE rr.status = 'approved') as approved_removals,
    COUNT(*) FILTER (WHERE rr.status = 'rejected') as rejected_removals
FROM circles c
LEFT JOIN removal_requests rr ON rr.circle_id = c.id
GROUP BY c.id, c.name;

-- ── v_swap_requests_full ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_swap_requests_full;
CREATE VIEW v_swap_requests_full AS
SELECT
    sr.id,
    sr.circle_id,
    c.name as circle_name,
    sr.requester_id,
    p1.full_name as requester_name,
    sr.target_id,
    p2.full_name as target_name,
    sr.requester_position,
    sr.target_position,
    sr.status,
    sr.created_at
FROM swap_requests sr
JOIN circles c ON c.id = sr.circle_id
JOIN profiles p1 ON p1.id = sr.requester_id
JOIN profiles p2 ON p2.id = sr.target_id;

-- ── v_swap_history_summary ───────────────────────────────────────────────────
DROP VIEW IF EXISTS v_swap_history_summary;
CREATE VIEW v_swap_history_summary AS
SELECT
    sr.circle_id,
    c.name as circle_name,
    COUNT(*) as total_swaps,
    COUNT(*) FILTER (WHERE sr.status = 'completed') as completed_swaps,
    COUNT(*) FILTER (WHERE sr.status = 'rejected') as rejected_swaps
FROM swap_requests sr
JOIN circles c ON c.id = sr.circle_id
GROUP BY sr.circle_id, c.name;

-- ── v_circle_swap_statistics ─────────────────────────────────────────────────
DROP VIEW IF EXISTS v_circle_swap_statistics;
CREATE VIEW v_circle_swap_statistics AS
SELECT
    c.id as circle_id,
    c.name as circle_name,
    sc.max_swaps_per_cycle,
    sc.cooling_off_days,
    COUNT(sr.id) as total_swap_requests,
    COUNT(sr.id) FILTER (WHERE sr.status = 'completed') as completed_swaps
FROM circles c
LEFT JOIN swap_configs sc ON sc.circle_id = c.id
LEFT JOIN swap_requests sr ON sr.circle_id = c.id
GROUP BY c.id, c.name, sc.max_swaps_per_cycle, sc.cooling_off_days;

-- ── v_wallet_overview ────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_wallet_overview;
CREATE VIEW v_wallet_overview AS
SELECT
    w.id as wallet_id,
    w.user_id,
    p.full_name,
    w.available_balance_cents / 100.0 as available_balance,
    w.reserved_balance_cents / 100.0 as reserved_balance,
    w.total_balance_cents / 100.0 as total_balance,
    w.currency,
    w.updated_at
FROM wallets w
JOIN profiles p ON p.id = w.user_id;

-- ── v_pending_reservations ───────────────────────────────────────────────────
DROP VIEW IF EXISTS v_pending_reservations;
CREATE VIEW v_pending_reservations AS
SELECT
    cr.id,
    cr.wallet_id,
    w.user_id,
    p.full_name,
    cr.amount_cents / 100.0 as amount,
    cr.purpose,
    cr.expires_at,
    cr.status
FROM contribution_reservations cr
JOIN wallets w ON w.id = cr.wallet_id
JOIN profiles p ON p.id = w.user_id
WHERE cr.status = 'pending';

-- ── v_money_retention_stats ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_money_retention_stats;
CREATE VIEW v_money_retention_stats AS
SELECT
    DATE_TRUNC('month', pe.created_at) as month,
    COUNT(*) as total_payouts,
    SUM(pe.amount_cents) / 100.0 as total_amount,
    SUM(CASE WHEN pe.destination_type = 'wallet' THEN pe.amount_cents ELSE 0 END) / 100.0 as retained_in_wallet,
    SUM(CASE WHEN pe.destination_type != 'wallet' THEN pe.amount_cents ELSE 0 END) / 100.0 as withdrawn
FROM payout_executions pe
GROUP BY DATE_TRUNC('month', pe.created_at);

-- ── v_payout_analytics ───────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_payout_analytics;
CREATE VIEW v_payout_analytics AS
SELECT
    pe.id,
    pe.user_id,
    p.full_name,
    pe.amount_cents / 100.0 as amount,
    pe.destination_type,
    pe.status,
    pe.created_at
FROM payout_executions pe
JOIN profiles p ON p.id = pe.user_id;

-- ── v_late_contributions_active ──────────────────────────────────────────────
DROP VIEW IF EXISTS v_late_contributions_active;
CREATE VIEW v_late_contributions_active AS
SELECT
    lc.id,
    lc.circle_id,
    c.name as circle_name,
    lc.user_id,
    p.full_name,
    lc.amount_cents / 100.0 as amount,
    lc.days_late,
    lc.penalty_cents / 100.0 as penalty,
    lc.status
FROM late_contributions lc
JOIN circles c ON c.id = lc.circle_id
JOIN profiles p ON p.id = lc.user_id
WHERE lc.status = 'pending';

-- ── v_cycles_needing_attention ───────────────────────────────────────────────
DROP VIEW IF EXISTS v_cycles_needing_attention;
CREATE VIEW v_cycles_needing_attention AS
SELECT
    cc.id as cycle_id,
    cc.circle_id,
    c.name as circle_name,
    cc.cycle_number,
    cc.status,
    cc.start_date,
    cc.end_date
FROM circle_cycles cc
JOIN circles c ON c.id = cc.circle_id
WHERE cc.status IN ('in_progress', 'delayed');

-- ── v_active_cycles ──────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_active_cycles;
CREATE VIEW v_active_cycles AS
SELECT
    cc.id as cycle_id,
    cc.circle_id,
    c.name as circle_name,
    cc.cycle_number,
    cc.total_contributions_expected,
    cc.total_contributions_received,
    cc.payout_recipient_id,
    p.full_name as recipient_name,
    cc.status
FROM circle_cycles cc
JOIN circles c ON c.id = cc.circle_id
LEFT JOIN profiles p ON p.id = cc.payout_recipient_id
WHERE cc.status = 'in_progress';

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 025 v3: Security Fixes
-- ══════════════════════════════════════════════════════════════════════════════
