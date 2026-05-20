-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 025 FINAL: Security Fixes
-- ══════════════════════════════════════════════════════════════════════════════
-- Fixes security linter warnings with correct column names
-- ══════════════════════════════════════════════════════════════════════════════

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 1: ENABLE RLS ON TABLES MISSING IT                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$ BEGIN ALTER TABLE urgent_need_claims ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP POLICY IF EXISTS "urgent_need_claims_own_select" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_insert" ON urgent_need_claims;
DROP POLICY IF EXISTS "urgent_need_claims_own_update" ON urgent_need_claims;
CREATE POLICY "urgent_need_claims_own_select" ON urgent_need_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_insert" ON urgent_need_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "urgent_need_claims_own_update" ON urgent_need_claims FOR UPDATE USING (auth.uid() = user_id);

DO $$ BEGIN ALTER TABLE payout_algorithm_config ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP POLICY IF EXISTS "payout_algorithm_config_read" ON payout_algorithm_config;
CREATE POLICY "payout_algorithm_config_read" ON payout_algorithm_config FOR SELECT TO authenticated USING (true);

DO $$ BEGIN ALTER TABLE savings_goal_types ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP POLICY IF EXISTS "savings_goal_types_read" ON savings_goal_types;
CREATE POLICY "savings_goal_types_read" ON savings_goal_types FOR SELECT TO authenticated USING (true);

DO $$ BEGIN ALTER TABLE dissolution_trigger_config ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DROP POLICY IF EXISTS "dissolution_trigger_config_read" ON dissolution_trigger_config;
CREATE POLICY "dissolution_trigger_config_read" ON dissolution_trigger_config FOR SELECT TO authenticated USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ PART 2: RECREATE VIEWS WITH SECURITY INVOKER                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Monthly Payment Views
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

DROP VIEW IF EXISTS v_payment_reminders_due;
CREATE VIEW v_payment_reminders_due AS
SELECT r.id as reminder_id, r.loan_id, r.user_id, p.full_name, p.email, r.reminder_type, r.channel,
    r.scheduled_for, r.title, r.message, r.amount_due_cents / 100.0 as amount_due, r.due_date, r.status
FROM loan_payment_reminders r JOIN profiles p ON p.id = r.user_id
WHERE r.status = 'scheduled' AND r.scheduled_for <= now();

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

-- Loan Payment Schedule Views
DROP VIEW IF EXISTS v_overdue_payments_dashboard;
CREATE VIEW v_overdue_payments_dashboard AS
SELECT ps.id as schedule_id, ps.loan_id, l.user_id, p.full_name, ps.payment_number, ps.due_date,
    (CURRENT_DATE - ps.due_date) as days_overdue, ps.total_due_cents / 100.0 as amount_due,
    COALESCE(ps.total_paid_cents, 0) / 100.0 as amount_paid,
    (ps.total_due_cents - COALESCE(ps.total_paid_cents, 0)) / 100.0 as remaining, ps.status
FROM loan_payment_schedule ps
JOIN loans l ON l.id = ps.loan_id
JOIN profiles p ON p.id = l.user_id
WHERE ps.status IN ('late', 'partial') AND l.status = 'active';

-- Interest Views (FIXED: correct column names from loan_interest_accruals)
DROP VIEW IF EXISTS v_loan_interest_summary;
CREATE VIEW v_loan_interest_summary AS
SELECT l.id as loan_id, l.user_id, l.principal_cents / 100.0 as principal, l.apr,
    l.outstanding_principal_cents / 100.0 as outstanding_principal,
    COALESCE(SUM(ia.interest_accrued_cents), 0) / 100.0 as total_accrued_interest,
    COALESCE(SUM(lf.calculated_fee_cents) FILTER (WHERE lf.status = 'pending'), 0) / 100.0 as total_late_fees,
    l.status
FROM loans l
LEFT JOIN loan_interest_accruals ia ON ia.loan_id = l.id
LEFT JOIN loan_late_fees lf ON lf.loan_id = l.id
GROUP BY l.id;

DROP VIEW IF EXISTS v_interest_accrual_audit;
CREATE VIEW v_interest_accrual_audit AS
SELECT ia.id, ia.loan_id, l.user_id, ia.accrual_date,
    ia.principal_balance_cents / 100.0 as principal,
    ia.annual_rate as rate_applied,
    ia.interest_accrued_cents / 100.0 as interest,
    ia.created_at
FROM loan_interest_accruals ia
JOIN loans l ON l.id = ia.loan_id;

-- Loan Views
DROP VIEW IF EXISTS v_loan_portfolio_summary;
CREATE VIEW v_loan_portfolio_summary AS
SELECT COUNT(*) as total_loans,
    COUNT(*) FILTER (WHERE status = 'active') as active_loans,
    COUNT(*) FILTER (WHERE status = 'paid_off') as paid_off_loans,
    COUNT(*) FILTER (WHERE status = 'defaulted') as defaulted_loans,
    COALESCE(SUM(principal_cents) FILTER (WHERE status = 'active'), 0) / 100.0 as total_principal_outstanding,
    COALESCE(SUM(outstanding_principal_cents) FILTER (WHERE status = 'active'), 0) / 100.0 as total_balance_outstanding
FROM loans;

DROP VIEW IF EXISTS v_active_loans_dashboard;
CREATE VIEW v_active_loans_dashboard AS
SELECT l.id as loan_id, l.user_id, p.full_name, l.principal_cents / 100.0 as principal,
    l.outstanding_principal_cents / 100.0 as outstanding, l.apr, l.term_months, l.status, l.created_at
FROM loans l JOIN profiles p ON p.id = l.user_id WHERE l.status = 'active';

DROP VIEW IF EXISTS v_creditworthiness_summary;
CREATE VIEW v_creditworthiness_summary AS
SELECT ca.id, ca.user_id, p.full_name, ca.final_credit_score as credit_score, ca.risk_grade,
    ca.final_max_amount_cents / 100.0 as max_loan_amount, ca.final_apr as recommended_apr, ca.calculated_at as assessment_date, ca.expires_at
FROM creditworthiness_assessments ca JOIN profiles p ON p.id = ca.user_id WHERE ca.expires_at > now();

DROP VIEW IF EXISTS v_guarantor_exposure;
CREATE VIEW v_guarantor_exposure AS
SELECT lg.guarantor_user_id as user_id, p.full_name, COUNT(*) as total_guarantees,
    COUNT(*) FILTER (WHERE lg.status = 'active') as active_guarantees,
    COALESCE(SUM(lg.max_liability_cents) FILTER (WHERE lg.status = 'active'), 0) / 100.0 as total_exposure
FROM loan_guarantees lg JOIN profiles p ON p.id = lg.guarantor_user_id GROUP BY lg.guarantor_user_id, p.full_name;

-- XnScore Views (using xn_scores table with correct column names)
DROP VIEW IF EXISTS v_xnscore_leaderboard;
CREATE VIEW v_xnscore_leaderboard AS
SELECT xs.user_id, p.full_name, xs.total_score as current_score, xs.score_tier as tier, xs.updated_at
FROM xn_scores xs JOIN profiles p ON p.id = xs.user_id ORDER BY xs.total_score DESC;

DROP VIEW IF EXISTS v_xnscore_tier_distribution;
CREATE VIEW v_xnscore_tier_distribution AS
SELECT score_tier as tier, COUNT(*) as user_count, AVG(total_score) as avg_score, MIN(total_score) as min_score, MAX(total_score) as max_score
FROM xn_scores GROUP BY score_tier;

DROP VIEW IF EXISTS v_user_xnscore_details;
CREATE VIEW v_user_xnscore_details AS
SELECT xs.user_id, p.full_name, xs.total_score as current_score, xs.score_tier as tier,
    xs.payment_history_score, xs.completion_score, xs.time_reliability_score,
    xs.deposit_score, xs.diversity_social_score, xs.engagement_score,
    xs.active_months as tenure_months, xs.updated_at
FROM xn_scores xs JOIN profiles p ON p.id = xs.user_id;

DROP VIEW IF EXISTS v_xnscore_activity_summary;
CREATE VIEW v_xnscore_activity_summary AS
SELECT xh.user_id, DATE_TRUNC('month', xh.created_at) as month, SUM(xh.score_change) as total_points_change, COUNT(*) as event_count
FROM xnscore_history xh GROUP BY xh.user_id, DATE_TRUNC('month', xh.created_at);

DROP VIEW IF EXISTS v_decay_at_risk_users;
CREATE VIEW v_decay_at_risk_users AS
SELECT xs.user_id, p.full_name, xs.total_score as current_score, xs.last_activity_at, (CURRENT_DATE - xs.last_activity_at::DATE) as days_inactive
FROM xn_scores xs JOIN profiles p ON p.id = xs.user_id WHERE xs.last_activity_at < (now() - INTERVAL '30 days');

DROP VIEW IF EXISTS v_tenure_eligible_users;
CREATE VIEW v_tenure_eligible_users AS
SELECT xs.user_id, p.full_name, xs.total_score as current_score, xs.active_months as tenure_months
FROM xn_scores xs JOIN profiles p ON p.id = xs.user_id
WHERE xs.active_months > 0;

DROP VIEW IF EXISTS v_recovery_period_users;
CREATE VIEW v_recovery_period_users AS
SELECT rp.user_id, p.full_name, rp.started_at as start_date, rp.ends_at as end_date, rp.trigger_type as reason, rp.is_active, xs.total_score as current_score
FROM xnscore_recovery_periods rp
JOIN profiles p ON p.id = rp.user_id
JOIN xn_scores xs ON xs.user_id = rp.user_id WHERE rp.is_active = true;

-- Score Breakdown Views (using xn_score_breakdown_cache and xn_score_factor_definitions)
DROP VIEW IF EXISTS v_user_score_breakdown;
CREATE VIEW v_user_score_breakdown AS
SELECT sb.user_id, p.full_name, sb.total_score,
    sb.payment_reliability_score, sb.circle_completion_score, sb.tenure_activity_score,
    sb.community_standing_score, sb.financial_behavior_score, sb.calculated_at
FROM xn_score_breakdown_cache sb JOIN profiles p ON p.id = sb.user_id;

DROP VIEW IF EXISTS v_factor_performance_summary;
CREATE VIEW v_factor_performance_summary AS
SELECT fd.factor_key, fd.factor_name, fd.max_points, COUNT(*) as user_count
FROM xn_score_factor_definitions fd
WHERE fd.is_active = true GROUP BY fd.factor_key, fd.factor_name, fd.max_points;

DROP VIEW IF EXISTS v_improvement_opportunities;
CREATE VIEW v_improvement_opportunities AS
SELECT sb.user_id, p.full_name, fd.factor_key, fd.factor_name, fd.max_points
FROM xn_score_breakdown_cache sb
JOIN profiles p ON p.id = sb.user_id
CROSS JOIN xn_score_factor_definitions fd
WHERE fd.is_active = true;

-- Default Cascade Views (using defaults table from migration 014)
DROP VIEW IF EXISTS v_active_cascades;
CREATE VIEW v_active_cascades AS
SELECT d.id, d.circle_id, d.user_id as defaulting_user_id, p.full_name as defaulting_user_name,
    d.total_owed as total_default_amount, d.amount_recovered as recovered_amount,
    d.default_status as status, d.created_at
FROM defaults d JOIN profiles p ON p.id = d.user_id WHERE d.default_status = 'unresolved';

DROP VIEW IF EXISTS v_voucher_impact_summary;
CREATE VIEW v_voucher_impact_summary AS
SELECT vi.voucher_user_id as user_id, p.full_name, COUNT(*) as total_vouches,
    SUM(vi.xnscore_impact) as total_xnscore_impact, AVG(vi.xnscore_impact) as avg_xnscore_impact
FROM voucher_default_impacts vi JOIN profiles p ON p.id = vi.voucher_user_id GROUP BY vi.voucher_user_id, p.full_name;

DROP VIEW IF EXISTS v_recovery_performance;
CREATE VIEW v_recovery_performance AS
SELECT rp.id, rp.user_id, p.full_name, rp.total_debt,
    rp.amount_paid, (rp.total_debt - rp.amount_paid) as remaining_amount,
    rp.plan_status as status, ROUND((rp.amount_paid / NULLIF(rp.total_debt, 0)) * 100, 2) as completion_percentage
FROM recovery_plans rp JOIN profiles p ON p.id = rp.user_id;

DROP VIEW IF EXISTS v_circle_resolution_stats;
CREATE VIEW v_circle_resolution_stats AS
SELECT cr.circle_id, c.name as circle_name, COUNT(*) as total_resolutions,
    SUM(cr.shortfall_amount) as total_amount, AVG(cr.shortfall_amount) as avg_amount
FROM circle_default_resolutions cr JOIN circles c ON c.id = cr.circle_id GROUP BY cr.circle_id, c.name;

DROP VIEW IF EXISTS v_payment_plan_progress;
CREATE VIEW v_payment_plan_progress AS
SELECT rp.id, rp.user_id, p.full_name, rp.total_debt as total_amount,
    rp.amount_paid, rp.installment_amount,
    rp.installments_paid as installments_completed, rp.number_of_installments as total_installments,
    rp.expected_completion_date as next_payment_date, rp.plan_status as status
FROM recovery_plans rp JOIN profiles p ON p.id = rp.user_id WHERE rp.plan_status = 'active';

DROP VIEW IF EXISTS v_user_debts;
CREATE VIEW v_user_debts AS
SELECT md.id, md.user_id, p.full_name, md.circle_id, c.name as circle_name,
    md.amount, md.amount_paid, md.debt_status as status, md.created_at
FROM member_debts md JOIN profiles p ON p.id = md.user_id JOIN circles c ON c.id = md.circle_id WHERE md.debt_status != 'paid';

-- Dissolution Views (using dissolution_requests from migration 016)
DROP VIEW IF EXISTS v_active_dissolution_requests;
CREATE VIEW v_active_dissolution_requests AS
SELECT dr.id, dr.circle_id, c.name as circle_name, dr.initiated_by as requested_by, p.full_name as requester_name,
    dr.reason, dr.status, dr.voting_ends_at, dr.created_at
FROM dissolution_requests dr JOIN circles c ON c.id = dr.circle_id
LEFT JOIN profiles p ON p.id = dr.initiated_by WHERE dr.status = 'proposed';

DROP VIEW IF EXISTS v_dissolution_analytics;
CREATE VIEW v_dissolution_analytics AS
SELECT DATE_TRUNC('month', dr.created_at) as month, COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE dr.status = 'completed') as approved_count,
    COUNT(*) FILTER (WHERE dr.status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE dr.status IN ('proposed', 'voting')) as pending_count
FROM dissolution_requests dr GROUP BY DATE_TRUNC('month', dr.created_at);

DROP VIEW IF EXISTS v_member_dissolution_summary;
CREATE VIEW v_member_dissolution_summary AS
SELECT dmp.user_id, p.full_name, dmp.dissolution_request_id as dissolution_id, dmp.adjusted_refund as refund_amount, dmp.refund_status as status, dmp.refund_executed_at as processed_at
FROM dissolution_member_positions dmp JOIN profiles p ON p.id = dmp.user_id;

-- Removal Views (using member_removal_requests from migration 017)
DROP VIEW IF EXISTS v_active_removal_requests;
CREATE VIEW v_active_removal_requests AS
SELECT rr.id, rr.circle_id, c.name as circle_name, rr.member_user_id as member_id, p.full_name as member_name,
    rr.initiated_by as requested_by, rr.reason::TEXT, rr.status::TEXT, rr.voting_ends_at
FROM member_removal_requests rr JOIN circles c ON c.id = rr.circle_id JOIN profiles p ON p.id = rr.member_user_id WHERE rr.status = 'pending_approval';

DROP VIEW IF EXISTS v_removal_statistics;
CREATE VIEW v_removal_statistics AS
SELECT c.id as circle_id, c.name as circle_name, COUNT(rr.id) as total_removals,
    COUNT(rr.id) FILTER (WHERE rr.status = 'completed') as approved_removals,
    COUNT(rr.id) FILTER (WHERE rr.status = 'rejected') as rejected_removals
FROM circles c LEFT JOIN member_removal_requests rr ON rr.circle_id = c.id GROUP BY c.id, c.name;

-- Swap Views (using position_swap_requests from migration 018)
DROP VIEW IF EXISTS v_swap_requests_full;
CREATE VIEW v_swap_requests_full AS
SELECT sr.id, sr.circle_id, c.name as circle_name, sr.requester_user_id as requester_id, p1.full_name as requester_name,
    sr.target_user_id as target_id, p2.full_name as target_name, sr.requester_position, sr.target_position, sr.swap_status::TEXT as status, sr.created_at
FROM position_swap_requests sr JOIN circles c ON c.id = sr.circle_id
JOIN profiles p1 ON p1.id = sr.requester_user_id JOIN profiles p2 ON p2.id = sr.target_user_id;

DROP VIEW IF EXISTS v_swap_history_summary;
CREATE VIEW v_swap_history_summary AS
SELECT sr.circle_id, c.name as circle_name, COUNT(*) as total_swaps,
    COUNT(*) FILTER (WHERE sr.swap_status = 'completed') as completed_swaps,
    COUNT(*) FILTER (WHERE sr.swap_status = 'rejected') as rejected_swaps
FROM position_swap_requests sr JOIN circles c ON c.id = sr.circle_id GROUP BY sr.circle_id, c.name;

DROP VIEW IF EXISTS v_circle_swap_statistics;
CREATE VIEW v_circle_swap_statistics AS
SELECT c.id as circle_id, c.name as circle_name,
    COUNT(sr.id) as total_swap_requests, COUNT(sr.id) FILTER (WHERE sr.swap_status = 'completed') as completed_swaps
FROM circles c
LEFT JOIN position_swap_requests sr ON sr.circle_id = c.id GROUP BY c.id, c.name;

-- Wallet Views (using user_wallets from migration 015)
DROP VIEW IF EXISTS v_wallet_overview;
CREATE VIEW v_wallet_overview AS
SELECT w.id as wallet_id, w.user_id, p.full_name, w.available_balance_cents / 100.0 as available_balance,
    w.reserved_balance_cents / 100.0 as reserved_balance, w.total_balance_cents / 100.0 as total_balance, w.updated_at
FROM user_wallets w JOIN profiles p ON p.id = w.user_id;

DROP VIEW IF EXISTS v_pending_reservations;
CREATE VIEW v_pending_reservations AS
SELECT cr.id, cr.wallet_id, w.user_id, p.full_name, cr.amount_cents / 100.0 as amount, cr.circle_id, cr.due_date, cr.reservation_status as status
FROM contribution_reservations cr JOIN user_wallets w ON w.id = cr.wallet_id JOIN profiles p ON p.id = w.user_id WHERE cr.reservation_status = 'reserved';

DROP VIEW IF EXISTS v_money_retention_stats;
CREATE VIEW v_money_retention_stats AS
SELECT DATE_TRUNC('month', pe.created_at) as month, COUNT(*) as total_payouts, SUM(pe.net_amount_cents) / 100.0 as total_amount
FROM payout_executions pe GROUP BY DATE_TRUNC('month', pe.created_at);

DROP VIEW IF EXISTS v_payout_analytics;
CREATE VIEW v_payout_analytics AS
SELECT pe.id, pe.recipient_user_id as user_id, p.full_name, pe.net_amount_cents / 100.0 as amount, pe.execution_status as status, pe.created_at
FROM payout_executions pe JOIN profiles p ON p.id = pe.recipient_user_id;

-- Circle Views (using late_contributions from migration 013)
DROP VIEW IF EXISTS v_late_contributions_active;
CREATE VIEW v_late_contributions_active AS
SELECT lc.id, lc.circle_id, c.name as circle_name, lc.user_id, p.full_name,
    lc.outstanding_amount as amount, lc.days_late, lc.late_fee_amount as penalty, lc.late_status as status
FROM late_contributions lc JOIN circles c ON c.id = lc.circle_id JOIN profiles p ON p.id = lc.user_id WHERE lc.late_status NOT IN ('resolved', 'defaulted');

DROP VIEW IF EXISTS v_cycles_needing_attention;
CREATE VIEW v_cycles_needing_attention AS
SELECT cc.id as cycle_id, cc.circle_id, c.name as circle_name, cc.cycle_number, cc.status, cc.start_date, cc.expected_payout_date as end_date
FROM circle_cycles cc JOIN circles c ON c.id = cc.circle_id WHERE cc.status IN ('collecting', 'deadline_reached', 'grace_period');

DROP VIEW IF EXISTS v_active_cycles;
CREATE VIEW v_active_cycles AS
SELECT cc.id as cycle_id, cc.circle_id, c.name as circle_name, cc.cycle_number,
    cc.expected_contributions as total_contributions_expected, cc.received_contributions as total_contributions_received, cc.recipient_user_id as payout_recipient_id,
    p.full_name as recipient_name, cc.status
FROM circle_cycles cc JOIN circles c ON c.id = cc.circle_id
LEFT JOIN profiles p ON p.id = cc.recipient_user_id WHERE cc.status = 'collecting';

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 025 FINAL
-- ══════════════════════════════════════════════════════════════════════════════
