-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 023 COMPLETE: Interest Calculation System
-- ══════════════════════════════════════════════════════════════════════════════
-- This is a complete, self-contained migration that handles all dependencies.
-- Run this INSTEAD of the original 023 files if you encounter errors.
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop all objects that might exist from partial runs               │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_loan_interest_summary CASCADE;
DROP VIEW IF EXISTS v_payoff_quotes CASCADE;
DROP VIEW IF EXISTS v_overdue_payments_dashboard CASCADE;
DROP VIEW IF EXISTS v_interest_accrual_audit CASCADE;

DROP FUNCTION IF EXISTS calculate_daily_interest(INTEGER, DECIMAL, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_accrued_interest(UUID, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS calculate_promotional_interest(UUID, INTEGER, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS calculate_tiered_interest(INTEGER, JSONB, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_variable_interest(UUID, INTEGER, INTEGER, DATE) CASCADE;
DROP FUNCTION IF EXISTS calculate_payoff_amount(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS apply_payment_to_loan(UUID, INTEGER, TEXT, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_late_fee(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_late_fee(INTEGER, INTEGER, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_loan_late_fee(INTEGER, INTEGER, UUID) CASCADE;
DROP FUNCTION IF EXISTS apply_late_fee_to_loan(UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_current_index_rate(TEXT, DATE) CASCADE;
DROP FUNCTION IF EXISTS check_promotional_rate_expiration(UUID) CASCADE;
DROP FUNCTION IF EXISTS run_daily_interest_accrual() CASCADE;
DROP FUNCTION IF EXISTS run_overdue_check() CASCADE;
DROP FUNCTION IF EXISTS get_effective_rate(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_payoff_quote(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_interest_config(TEXT) CASCADE;
DROP FUNCTION IF EXISTS mark_late_fees_paid(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS update_late_fee_timestamp() CASCADE;

DROP TABLE IF EXISTS loan_interest_accruals CASCADE;
DROP TABLE IF EXISTS loan_rate_changes CASCADE;
DROP TABLE IF EXISTS loan_late_fees CASCADE;
DROP TABLE IF EXISTS market_index_rates CASCADE;
DROP TABLE IF EXISTS loan_payoff_quotes CASCADE;
DROP TABLE IF EXISTS interest_calculation_config CASCADE;

DROP TYPE IF EXISTS interest_rate_type CASCADE;
DROP TYPE IF EXISTS late_fee_type CASCADE;
DROP TYPE IF EXISTS late_fee_status CASCADE;
DROP TYPE IF EXISTS rate_change_reason CASCADE;
DROP TYPE IF EXISTS accrual_trigger CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE interest_rate_type AS ENUM (
    'fixed',
    'risk_based',
    'promotional',
    'tiered',
    'variable'
);

CREATE TYPE late_fee_type AS ENUM (
    'flat',
    'percentage',
    'greater_of'
);

CREATE TYPE late_fee_status AS ENUM (
    'pending',
    'paid',
    'waived',
    'written_off'
);

CREATE TYPE rate_change_reason AS ENUM (
    'promotional_period_ended',
    'index_adjustment',
    'manual_adjustment',
    'credit_improvement',
    'credit_deterioration',
    'rate_reset'
);

CREATE TYPE accrual_trigger AS ENUM (
    'payment',
    'payoff_quote',
    'daily_cron',
    'manual',
    'loan_closure'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ALTER LOANS TABLE                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_rate_type interest_rate_type NOT NULL DEFAULT 'fixed';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS promotional_rate DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS promotional_rate_end_date DATE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS post_promotional_rate DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rate_tiers JSONB;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS index_name TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS index_spread DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rate_cap DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS rate_floor DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS accrued_interest_cents INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_interest_accrual_date TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_interest_paid_cents INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_interest_accrued_cents INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS total_fees_paid_cents INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS effective_apr DECIMAL(6,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_payment_date DATE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_payment_amount_cents INTEGER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ALTER LOAN PAYMENT SCHEDULE                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE loan_payment_schedule ADD COLUMN IF NOT EXISTS xnscore_event_triggered BOOLEAN DEFAULT FALSE;
ALTER TABLE loan_payment_schedule ADD COLUMN IF NOT EXISTS late_fee_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE loan_payment_schedule ADD COLUMN IF NOT EXISTS late_fee_id UUID;
ALTER TABLE loan_payment_schedule ADD COLUMN IF NOT EXISTS days_overdue INTEGER DEFAULT 0;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INTEREST CALCULATION CONFIG                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE interest_calculation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO interest_calculation_config (config_key, config_value, description) VALUES
    ('days_per_year', '365', 'Actual/365 day count convention'),
    ('round_to_cents', 'true', 'Round interest calculations to cents'),
    ('minimum_daily_interest_cents', '1', 'Minimum daily interest to avoid $0'),
    ('late_fee_grace_period_days', '5', 'Days after due date before late fee applies'),
    ('late_fee_flat_cents', '500', 'Default flat late fee ($5)'),
    ('late_fee_percentage', '5.00', 'Default percentage late fee (5%)'),
    ('late_fee_calculation_method', '"greater_of"', 'How to calculate late fee'),
    ('max_apr', '36.00', 'Maximum APR allowed (regulatory)'),
    ('min_apr', '0.00', 'Minimum APR allowed'),
    ('payoff_quote_validity_days', '10', 'How long payoff quotes are valid');

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INTEREST ACCRUAL HISTORY                                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_interest_accruals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    accrual_date DATE NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    days_in_period INTEGER NOT NULL,
    principal_balance_cents INTEGER NOT NULL,
    previous_accrued_interest_cents INTEGER NOT NULL DEFAULT 0,
    rate_type interest_rate_type NOT NULL,
    annual_rate DECIMAL(6,4) NOT NULL,
    daily_rate DECIMAL(12,10) NOT NULL,
    interest_accrued_cents INTEGER NOT NULL,
    cumulative_interest_cents INTEGER NOT NULL,
    tier_breakdown JSONB,
    promotional_days INTEGER,
    standard_days INTEGER,
    triggered_by accrual_trigger NOT NULL,
    triggered_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interest_accruals_loan ON loan_interest_accruals(loan_id);
CREATE INDEX idx_interest_accruals_date ON loan_interest_accruals(accrual_date DESC);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ RATE CHANGE HISTORY                                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_rate_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    effective_date DATE NOT NULL,
    previous_rate DECIMAL(6,4) NOT NULL,
    previous_rate_type interest_rate_type NOT NULL,
    new_rate DECIMAL(6,4) NOT NULL,
    new_rate_type interest_rate_type NOT NULL,
    change_reason rate_change_reason NOT NULL,
    change_notes TEXT,
    index_value_at_change DECIMAL(6,4),
    borrower_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    notification_method TEXT,
    changed_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_changes_loan ON loan_rate_changes(loan_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LATE FEES TABLE                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_late_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    scheduled_payment_id UUID REFERENCES loan_payment_schedule(id),
    fee_type late_fee_type NOT NULL,
    flat_fee_cents INTEGER,
    percentage DECIMAL(5,2),
    calculated_fee_cents INTEGER NOT NULL,
    payment_due_date DATE NOT NULL,
    grace_period_days INTEGER NOT NULL,
    days_past_due INTEGER NOT NULL,
    fee_applied_date DATE NOT NULL,
    status late_fee_status NOT NULL DEFAULT 'pending',
    paid_amount_cents INTEGER DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_id UUID REFERENCES loan_payments(id),
    waived_at TIMESTAMPTZ,
    waived_by UUID REFERENCES profiles(id),
    waive_reason TEXT,
    written_off_at TIMESTAMPTZ,
    write_off_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_late_fees_loan ON loan_late_fees(loan_id);
CREATE INDEX idx_late_fees_status ON loan_late_fees(status);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MARKET INDEX RATES                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE market_index_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    index_name TEXT NOT NULL,
    effective_date DATE NOT NULL,
    rate DECIMAL(6,4) NOT NULL,
    source TEXT,
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_index_date UNIQUE(index_name, effective_date)
);

CREATE INDEX idx_index_rates_name_date ON market_index_rates(index_name, effective_date DESC);

INSERT INTO market_index_rates (index_name, effective_date, rate, source) VALUES
    ('prime', CURRENT_DATE, 0.0850, 'manual'),
    ('sofr', CURRENT_DATE, 0.0530, 'manual'),
    ('fed_funds', CURRENT_DATE, 0.0533, 'manual');

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PAYOFF QUOTES                                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_payoff_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quote_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    outstanding_principal_cents INTEGER NOT NULL,
    accrued_interest_cents INTEGER NOT NULL,
    outstanding_fees_cents INTEGER NOT NULL,
    total_payoff_cents INTEGER NOT NULL,
    per_diem_cents INTEGER NOT NULL,
    current_rate DECIMAL(6,4) NOT NULL,
    rate_type interest_rate_type NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    payment_id UUID REFERENCES loan_payments(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payoff_quotes_loan ON loan_payoff_quotes(loan_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION get_interest_config(p_key TEXT)
RETURNS JSONB AS $$
    SELECT config_value FROM interest_calculation_config WHERE config_key = p_key;
$$ LANGUAGE SQL STABLE;

-- Simple interest calculation
CREATE FUNCTION calculate_daily_interest(
    p_principal_cents INTEGER,
    p_annual_rate DECIMAL,
    p_days INTEGER
)
RETURNS TABLE (
    interest_cents INTEGER,
    daily_rate DECIMAL,
    daily_interest_cents DECIMAL
) AS $$
DECLARE
    v_days_per_year INTEGER := 365;
    v_daily_rate DECIMAL;
    v_interest DECIMAL;
BEGIN
    v_daily_rate := p_annual_rate / v_days_per_year;
    v_interest := p_principal_cents * v_daily_rate * p_days;
    interest_cents := ROUND(v_interest)::INTEGER;
    IF p_days > 0 AND interest_cents < p_days THEN
        interest_cents := p_days;
    END IF;
    daily_rate := v_daily_rate;
    daily_interest_cents := v_interest / GREATEST(p_days, 1);
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get effective rate
CREATE FUNCTION get_effective_rate(
    p_loan_id UUID,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL AS $$
DECLARE
    v_loan RECORD;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    CASE v_loan.interest_rate_type
        WHEN 'fixed', 'risk_based' THEN
            RETURN v_loan.apr / 100;
        WHEN 'promotional' THEN
            IF v_loan.promotional_rate_end_date IS NOT NULL
               AND p_as_of_date < v_loan.promotional_rate_end_date THEN
                RETURN v_loan.promotional_rate;
            ELSE
                RETURN COALESCE(v_loan.post_promotional_rate, v_loan.apr / 100);
            END IF;
        ELSE
            RETURN v_loan.apr / 100;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current index rate
CREATE FUNCTION get_current_index_rate(
    p_index_name TEXT,
    p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL AS $$
    SELECT rate FROM market_index_rates
    WHERE index_name = p_index_name AND effective_date <= p_as_of_date
    ORDER BY effective_date DESC LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ACCRUED INTEREST CALCULATION                                               │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_accrued_interest(
    p_loan_id UUID,
    p_as_of_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    loan_id UUID,
    principal_balance_cents INTEGER,
    accrued_interest_cents INTEGER,
    days_in_period INTEGER,
    period_start_date DATE,
    period_end_date DATE,
    daily_interest_cents INTEGER,
    effective_rate DECIMAL,
    annual_rate_percent DECIMAL,
    rate_type interest_rate_type,
    tier_breakdown JSONB,
    note TEXT
) AS $$
DECLARE
    v_loan RECORD;
    v_period_start DATE;
    v_period_end DATE;
    v_days INTEGER;
    v_effective_rate DECIMAL;
    v_interest_result RECORD;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;

    IF v_loan.status IN ('paid_off', 'defaulted', 'written_off') THEN
        RETURN QUERY SELECT p_loan_id, 0::INTEGER, 0::INTEGER, 0::INTEGER,
            CURRENT_DATE, CURRENT_DATE, 0::INTEGER, 0::DECIMAL, 0::DECIMAL,
            v_loan.interest_rate_type, NULL::JSONB, 'Loan is closed'::TEXT;
        RETURN;
    END IF;

    v_period_start := COALESCE(v_loan.last_interest_accrual_date::DATE, v_loan.created_at::DATE);
    v_period_end := p_as_of_date::DATE;
    v_days := v_period_end - v_period_start;

    IF v_days <= 0 THEN
        v_effective_rate := get_effective_rate(p_loan_id, v_period_end);
        RETURN QUERY SELECT p_loan_id, v_loan.outstanding_principal_cents,
            0::INTEGER, 0::INTEGER, v_period_start, v_period_end, 0::INTEGER,
            v_effective_rate, v_effective_rate * 100,
            v_loan.interest_rate_type, NULL::JSONB, 'No days since last accrual'::TEXT;
        RETURN;
    END IF;

    IF v_loan.outstanding_principal_cents <= 0 THEN
        RETURN QUERY SELECT p_loan_id, 0::INTEGER, 0::INTEGER, v_days,
            v_period_start, v_period_end, 0::INTEGER, 0::DECIMAL, 0::DECIMAL,
            v_loan.interest_rate_type, NULL::JSONB, 'No outstanding principal'::TEXT;
        RETURN;
    END IF;

    v_effective_rate := get_effective_rate(p_loan_id, v_period_end);

    SELECT * INTO v_interest_result
    FROM calculate_daily_interest(v_loan.outstanding_principal_cents, v_effective_rate, v_days);

    RETURN QUERY SELECT p_loan_id, v_loan.outstanding_principal_cents,
        v_interest_result.interest_cents, v_days, v_period_start, v_period_end,
        ROUND(v_interest_result.interest_cents::DECIMAL / GREATEST(v_days, 1))::INTEGER,
        v_effective_rate, v_effective_rate * 100,
        v_loan.interest_rate_type, NULL::JSONB, NULL::TEXT;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PAYOFF CALCULATION                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_payoff_amount(
    p_loan_id UUID,
    p_payoff_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    loan_id UUID,
    payoff_date DATE,
    outstanding_principal_cents INTEGER,
    accrued_interest_cents INTEGER,
    previous_accrued_interest_cents INTEGER,
    outstanding_fees_cents INTEGER,
    total_payoff_cents INTEGER,
    per_diem_cents INTEGER,
    current_rate DECIMAL,
    current_rate_percent DECIMAL,
    rate_type interest_rate_type,
    valid_until DATE,
    note TEXT
) AS $$
DECLARE
    v_loan RECORD;
    v_interest RECORD;
    v_fees_total INTEGER;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Loan % not found', p_loan_id; END IF;

    SELECT * INTO v_interest FROM calculate_accrued_interest(p_loan_id, p_payoff_date::TIMESTAMPTZ);

    SELECT COALESCE(SUM(calculated_fee_cents - COALESCE(paid_amount_cents, 0)), 0)
    INTO v_fees_total FROM loan_late_fees
    WHERE loan_late_fees.loan_id = p_loan_id AND status = 'pending';

    RETURN QUERY SELECT p_loan_id, p_payoff_date,
        v_loan.outstanding_principal_cents,
        v_interest.accrued_interest_cents,
        COALESCE(v_loan.accrued_interest_cents, 0),
        v_fees_total,
        v_loan.outstanding_principal_cents + v_interest.accrued_interest_cents +
            COALESCE(v_loan.accrued_interest_cents, 0) + v_fees_total,
        v_interest.daily_interest_cents,
        v_interest.effective_rate,
        v_interest.annual_rate_percent,
        v_interest.rate_type,
        p_payoff_date + 10,
        format('Add $%s/day after %s',
            ROUND(v_interest.daily_interest_cents::DECIMAL / 100, 2),
            to_char(p_payoff_date, 'MM/DD/YYYY'));
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PAYOFF QUOTE GENERATION                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION generate_payoff_quote(
    p_loan_id UUID,
    p_payoff_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
    v_quote RECORD;
    v_loan RECORD;
    v_quote_id UUID;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    SELECT * INTO v_quote FROM calculate_payoff_amount(p_loan_id, p_payoff_date);

    INSERT INTO loan_payoff_quotes (
        loan_id, user_id, quote_date, valid_until,
        outstanding_principal_cents, accrued_interest_cents, outstanding_fees_cents,
        total_payoff_cents, per_diem_cents, current_rate, rate_type
    ) VALUES (
        p_loan_id, v_loan.user_id, p_payoff_date, v_quote.valid_until,
        v_quote.outstanding_principal_cents,
        v_quote.accrued_interest_cents + v_quote.previous_accrued_interest_cents,
        v_quote.outstanding_fees_cents,
        v_quote.total_payoff_cents, v_quote.per_diem_cents,
        v_quote.current_rate, v_quote.rate_type
    ) RETURNING id INTO v_quote_id;

    RETURN v_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LATE FEE CALCULATION (Using unique name)                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_loan_late_fee(
    p_scheduled_payment_cents INTEGER,
    p_days_past_due INTEGER,
    p_loan_product_id UUID DEFAULT NULL
)
RETURNS TABLE (
    fee_cents INTEGER,
    fee_type late_fee_type,
    flat_fee_cents INTEGER,
    percentage_fee_cents INTEGER,
    grace_period_days INTEGER,
    within_grace_period BOOLEAN
) AS $$
DECLARE
    v_grace_period INTEGER := 5;
    v_flat_fee INTEGER := 500;
    v_percentage DECIMAL := 5.0;
    v_percentage_fee INTEGER;
    v_product RECORD;
BEGIN
    IF p_loan_product_id IS NOT NULL THEN
        SELECT * INTO v_product FROM loan_products WHERE id = p_loan_product_id;
        IF FOUND THEN
            v_grace_period := COALESCE(v_product.grace_period_days, 5);
            v_flat_fee := COALESCE(v_product.late_fee_flat_cents, 500);
            v_percentage := COALESCE(v_product.late_fee_percent, 5.0);
        END IF;
    END IF;

    IF p_days_past_due <= v_grace_period THEN
        RETURN QUERY SELECT 0::INTEGER, 'flat'::late_fee_type,
            v_flat_fee, 0::INTEGER, v_grace_period, TRUE;
        RETURN;
    END IF;

    v_percentage_fee := ROUND(p_scheduled_payment_cents * (v_percentage / 100))::INTEGER;

    IF v_flat_fee >= v_percentage_fee THEN
        RETURN QUERY SELECT v_flat_fee, 'flat'::late_fee_type,
            v_flat_fee, v_percentage_fee, v_grace_period, FALSE;
    ELSE
        RETURN QUERY SELECT v_percentage_fee, 'percentage'::late_fee_type,
            v_flat_fee, v_percentage_fee, v_grace_period, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ APPLY LATE FEE                                                             │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION apply_late_fee_to_loan(
    p_loan_id UUID,
    p_scheduled_payment_id UUID,
    p_days_past_due INTEGER
)
RETURNS TABLE (
    applied BOOLEAN,
    fee_id UUID,
    fee_cents INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_schedule RECORD;
    v_loan RECORD;
    v_existing_fee RECORD;
    v_fee_result RECORD;
    v_fee_id UUID;
BEGIN
    SELECT * INTO v_schedule FROM loan_payment_schedule WHERE id = p_scheduled_payment_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Scheduled payment not found';
        RETURN;
    END IF;

    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;

    SELECT * INTO v_existing_fee FROM loan_late_fees
    WHERE scheduled_payment_id = p_scheduled_payment_id;

    IF FOUND THEN
        RETURN QUERY SELECT FALSE, v_existing_fee.id, v_existing_fee.calculated_fee_cents, 'Fee already applied';
        RETURN;
    END IF;

    SELECT * INTO v_fee_result
    FROM calculate_loan_late_fee(v_schedule.total_due_cents, p_days_past_due, v_loan.loan_product_id);

    IF v_fee_result.within_grace_period THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Within grace period';
        RETURN;
    END IF;

    INSERT INTO loan_late_fees (
        loan_id, scheduled_payment_id, fee_type, flat_fee_cents, percentage,
        calculated_fee_cents, payment_due_date, grace_period_days, days_past_due, fee_applied_date
    ) VALUES (
        p_loan_id, p_scheduled_payment_id, v_fee_result.fee_type, v_fee_result.flat_fee_cents,
        5.0, v_fee_result.fee_cents, v_schedule.due_date, v_fee_result.grace_period_days,
        p_days_past_due, CURRENT_DATE
    ) RETURNING id INTO v_fee_id;

    UPDATE loans SET
        outstanding_fees_cents = COALESCE(outstanding_fees_cents, 0) + v_fee_result.fee_cents,
        total_outstanding_cents = total_outstanding_cents + v_fee_result.fee_cents,
        updated_at = now()
    WHERE id = p_loan_id;

    RETURN QUERY SELECT TRUE, v_fee_id, v_fee_result.fee_cents, 'Late fee applied';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MARK LATE FEES PAID HELPER                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION mark_late_fees_paid(p_loan_id UUID, p_amount_cents INTEGER)
RETURNS VOID AS $$
DECLARE
    v_fee RECORD;
    v_remaining INTEGER := p_amount_cents;
    v_to_pay INTEGER;
BEGIN
    FOR v_fee IN
        SELECT * FROM loan_late_fees
        WHERE loan_id = p_loan_id AND status = 'pending'
        ORDER BY fee_applied_date ASC
    LOOP
        EXIT WHEN v_remaining <= 0;
        v_to_pay := LEAST(v_remaining, v_fee.calculated_fee_cents - COALESCE(v_fee.paid_amount_cents, 0));
        v_remaining := v_remaining - v_to_pay;

        IF v_to_pay + COALESCE(v_fee.paid_amount_cents, 0) >= v_fee.calculated_fee_cents THEN
            UPDATE loan_late_fees SET paid_amount_cents = calculated_fee_cents,
                status = 'paid', paid_at = now(), updated_at = now() WHERE id = v_fee.id;
        ELSE
            UPDATE loan_late_fees SET paid_amount_cents = COALESCE(paid_amount_cents, 0) + v_to_pay,
                updated_at = now() WHERE id = v_fee.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ APPLY PAYMENT TO LOAN                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION apply_payment_to_loan(
    p_loan_id UUID,
    p_payment_amount_cents INTEGER,
    p_payment_method TEXT,
    p_payment_source_id TEXT DEFAULT NULL,
    p_wallet_transaction_id UUID DEFAULT NULL
)
RETURNS TABLE (
    payment_id UUID,
    total_paid_cents INTEGER,
    fees_paid_cents INTEGER,
    interest_paid_cents INTEGER,
    principal_paid_cents INTEGER,
    remaining_principal_cents INTEGER,
    remaining_interest_cents INTEGER,
    remaining_fees_cents INTEGER,
    total_remaining_cents INTEGER,
    loan_status loan_status,
    is_paid_off BOOLEAN,
    overpayment_cents INTEGER
) AS $$
DECLARE
    v_loan RECORD;
    v_interest RECORD;
    v_schedule RECORD;
    v_payment_id UUID;
    v_remaining INTEGER;
    v_fees_paid INTEGER := 0;
    v_interest_paid INTEGER := 0;
    v_principal_paid INTEGER := 0;
    v_total_accrued_interest INTEGER;
    v_pending_fees INTEGER;
    v_new_status loan_status;
    v_is_on_time BOOLEAN;
    v_days_late INTEGER := 0;
    v_new_principal INTEGER;
    v_new_accrued_interest INTEGER;
    v_new_fees INTEGER;
    v_new_total INTEGER;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Loan % not found', p_loan_id; END IF;
    IF v_loan.status != 'active' THEN RAISE EXCEPTION 'Cannot apply payment to % loan', v_loan.status; END IF;

    SELECT * INTO v_interest FROM calculate_accrued_interest(p_loan_id);
    v_total_accrued_interest := v_interest.accrued_interest_cents + COALESCE(v_loan.accrued_interest_cents, 0);

    SELECT COALESCE(SUM(calculated_fee_cents - COALESCE(paid_amount_cents, 0)), 0)
    INTO v_pending_fees FROM loan_late_fees WHERE loan_late_fees.loan_id = p_loan_id AND status = 'pending';

    SELECT * INTO v_schedule FROM loan_payment_schedule
    WHERE loan_payment_schedule.loan_id = p_loan_id AND status IN ('scheduled', 'partial', 'late')
    ORDER BY payment_number ASC LIMIT 1;

    IF v_schedule IS NOT NULL THEN
        v_is_on_time := CURRENT_DATE <= v_schedule.due_date + 5;
        v_days_late := GREATEST(0, CURRENT_DATE - v_schedule.due_date - 5);
    ELSE
        v_is_on_time := TRUE;
    END IF;

    v_remaining := p_payment_amount_cents;

    -- Pay fees first
    IF v_remaining > 0 AND v_pending_fees > 0 THEN
        v_fees_paid := LEAST(v_remaining, v_pending_fees);
        v_remaining := v_remaining - v_fees_paid;
        PERFORM mark_late_fees_paid(p_loan_id, v_fees_paid);
    END IF;

    -- Pay interest
    IF v_remaining > 0 AND v_total_accrued_interest > 0 THEN
        v_interest_paid := LEAST(v_remaining, v_total_accrued_interest);
        v_remaining := v_remaining - v_interest_paid;
    END IF;

    -- Pay principal
    IF v_remaining > 0 AND v_loan.outstanding_principal_cents > 0 THEN
        v_principal_paid := LEAST(v_remaining, v_loan.outstanding_principal_cents);
        v_remaining := v_remaining - v_principal_paid;
    END IF;

    v_new_principal := v_loan.outstanding_principal_cents - v_principal_paid;
    v_new_accrued_interest := v_total_accrued_interest - v_interest_paid;
    v_new_fees := v_pending_fees - v_fees_paid;
    v_new_total := v_new_principal + v_new_accrued_interest + v_new_fees;

    IF v_new_principal <= 0 AND v_new_accrued_interest <= 0 AND v_new_fees <= 0 THEN
        v_new_status := 'paid_off';
    ELSE
        v_new_status := 'active';
    END IF;

    -- Record interest accrual
    INSERT INTO loan_interest_accruals (
        loan_id, accrual_date, period_start_date, period_end_date, days_in_period,
        principal_balance_cents, previous_accrued_interest_cents,
        rate_type, annual_rate, daily_rate,
        interest_accrued_cents, cumulative_interest_cents, triggered_by
    ) VALUES (
        p_loan_id, CURRENT_DATE, v_interest.period_start_date, v_interest.period_end_date,
        v_interest.days_in_period, v_loan.outstanding_principal_cents,
        COALESCE(v_loan.accrued_interest_cents, 0), v_interest.rate_type,
        v_interest.effective_rate, v_interest.effective_rate / 365,
        v_interest.accrued_interest_cents,
        COALESCE(v_loan.total_interest_accrued_cents, 0) + v_interest.accrued_interest_cents,
        'payment'::accrual_trigger
    );

    -- Update loan
    UPDATE loans SET
        outstanding_principal_cents = v_new_principal,
        outstanding_interest_cents = v_new_accrued_interest,
        outstanding_fees_cents = v_new_fees,
        total_outstanding_cents = v_new_total,
        accrued_interest_cents = v_new_accrued_interest,
        last_interest_accrual_date = now(),
        total_interest_paid_cents = COALESCE(total_interest_paid_cents, 0) + v_interest_paid,
        total_interest_accrued_cents = COALESCE(total_interest_accrued_cents, 0) + v_interest.accrued_interest_cents,
        total_fees_paid_cents = COALESCE(total_fees_paid_cents, 0) + v_fees_paid,
        payments_made = payments_made + 1,
        last_payment_date = CURRENT_DATE,
        last_payment_amount_cents = p_payment_amount_cents,
        days_past_due = CASE WHEN v_is_on_time THEN 0 ELSE v_days_late END,
        is_delinquent = NOT v_is_on_time,
        status = v_new_status,
        closed_at = CASE WHEN v_new_status = 'paid_off' THEN now() ELSE NULL END,
        closed_reason = CASE WHEN v_new_status = 'paid_off' THEN 'fully_repaid' ELSE NULL END,
        updated_at = now()
    WHERE id = p_loan_id;

    -- Create payment record
    INSERT INTO loan_payments (
        loan_id, user_id, schedule_id, amount_cents, principal_cents, interest_cents, fees_cents,
        payment_method, payment_source_id, wallet_transaction_id,
        was_on_time, days_late, status, processed_at
    ) VALUES (
        p_loan_id, v_loan.user_id, v_schedule.id, p_payment_amount_cents,
        v_principal_paid, v_interest_paid, v_fees_paid,
        p_payment_method, p_payment_source_id, p_wallet_transaction_id,
        v_is_on_time, v_days_late, 'completed'::loan_payment_status, now()
    ) RETURNING id INTO v_payment_id;

    -- Update schedule if applicable
    IF v_schedule IS NOT NULL THEN
        UPDATE loan_payment_schedule SET
            principal_paid_cents = principal_paid_cents + v_principal_paid,
            interest_paid_cents = interest_paid_cents + v_interest_paid,
            fees_paid_cents = fees_paid_cents + v_fees_paid,
            total_paid_cents = total_paid_cents + p_payment_amount_cents,
            status = CASE
                WHEN principal_paid_cents + v_principal_paid >= principal_due_cents
                     AND interest_paid_cents + v_interest_paid >= interest_due_cents
                THEN 'paid'::payment_schedule_status
                ELSE 'partial'::payment_schedule_status
            END,
            updated_at = now()
        WHERE id = v_schedule.id;
    END IF;

    -- Release guarantees if paid off
    IF v_new_status = 'paid_off' THEN
        UPDATE loan_guarantees SET status = 'released', released_at = now(),
            release_reason = 'loan_paid_off', updated_at = now()
        WHERE loan_guarantees.loan_id = p_loan_id AND status = 'active';

        UPDATE loan_co_signers SET status = 'released', released_at = now(),
            release_reason = 'loan_paid_off', updated_at = now()
        WHERE loan_co_signers.loan_id = p_loan_id AND status = 'active';
    END IF;

    RETURN QUERY SELECT v_payment_id, p_payment_amount_cents,
        v_fees_paid, v_interest_paid, v_principal_paid,
        v_new_principal, v_new_accrued_interest, v_new_fees, v_new_total,
        v_new_status, v_new_status = 'paid_off', v_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ BATCH OPERATIONS                                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION run_daily_interest_accrual()
RETURNS TABLE (loans_processed INTEGER, total_interest_accrued_cents BIGINT, errors_count INTEGER) AS $$
DECLARE
    v_loan RECORD;
    v_interest RECORD;
    v_processed INTEGER := 0;
    v_total_interest BIGINT := 0;
    v_errors INTEGER := 0;
BEGIN
    FOR v_loan IN SELECT * FROM loans WHERE status = 'active' LOOP
        BEGIN
            SELECT * INTO v_interest FROM calculate_accrued_interest(v_loan.id);
            IF v_interest.accrued_interest_cents > 0 THEN
                UPDATE loans SET
                    accrued_interest_cents = COALESCE(accrued_interest_cents, 0) + v_interest.accrued_interest_cents,
                    total_interest_accrued_cents = COALESCE(total_interest_accrued_cents, 0) + v_interest.accrued_interest_cents,
                    last_interest_accrual_date = now(), updated_at = now()
                WHERE id = v_loan.id;

                INSERT INTO loan_interest_accruals (
                    loan_id, accrual_date, period_start_date, period_end_date, days_in_period,
                    principal_balance_cents, rate_type, annual_rate, daily_rate,
                    interest_accrued_cents, cumulative_interest_cents, triggered_by
                ) VALUES (
                    v_loan.id, CURRENT_DATE, v_interest.period_start_date, v_interest.period_end_date,
                    v_interest.days_in_period, v_loan.outstanding_principal_cents,
                    v_interest.rate_type, v_interest.effective_rate, v_interest.effective_rate / 365,
                    v_interest.accrued_interest_cents,
                    COALESCE(v_loan.total_interest_accrued_cents, 0) + v_interest.accrued_interest_cents,
                    'daily_cron'::accrual_trigger
                );
                v_total_interest := v_total_interest + v_interest.accrued_interest_cents;
            END IF;
            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN QUERY SELECT v_processed, v_total_interest, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION run_overdue_check()
RETURNS TABLE (payments_checked INTEGER, late_fees_applied INTEGER, xnscore_events INTEGER, errors_count INTEGER) AS $$
DECLARE
    v_payment RECORD;
    v_checked INTEGER := 0;
    v_fees_applied INTEGER := 0;
    v_xnscore_events INTEGER := 0;
    v_errors INTEGER := 0;
    v_days_past_due INTEGER;
    v_fee_result RECORD;
BEGIN
    FOR v_payment IN
        SELECT ps.*, l.user_id, l.loan_product_id
        FROM loan_payment_schedule ps
        JOIN loans l ON l.id = ps.loan_id
        WHERE ps.status IN ('scheduled', 'partial')
        AND ps.due_date < CURRENT_DATE AND l.status = 'active'
    LOOP
        BEGIN
            v_days_past_due := CURRENT_DATE - v_payment.due_date;

            IF v_days_past_due > 5 AND NOT v_payment.late_fee_applied THEN
                SELECT * INTO v_fee_result
                FROM apply_late_fee_to_loan(v_payment.loan_id, v_payment.id, v_days_past_due);
                IF v_fee_result.applied THEN v_fees_applied := v_fees_applied + 1; END IF;
            END IF;

            IF v_payment.status = 'scheduled' THEN
                UPDATE loan_payment_schedule SET status = 'late', days_overdue = v_days_past_due,
                    updated_at = now() WHERE id = v_payment.id;
            END IF;

            UPDATE loans SET days_past_due = v_days_past_due, is_delinquent = TRUE,
                delinquent_since = COALESCE(delinquent_since, v_payment.due_date), updated_at = now()
            WHERE id = v_payment.loan_id;

            v_checked := v_checked + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;
    RETURN QUERY SELECT v_checked, v_fees_applied, v_xnscore_events, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE VIEW v_loan_interest_summary AS
SELECT l.id as loan_id, l.user_id, p.full_name, l.principal_cents / 100.0 as principal,
    l.outstanding_principal_cents / 100.0 as outstanding_principal,
    l.interest_rate_type, l.apr,
    COALESCE(l.accrued_interest_cents, 0) / 100.0 as accrued_interest,
    COALESCE(l.total_interest_paid_cents, 0) / 100.0 as total_interest_paid,
    l.last_interest_accrual_date, l.promotional_rate, l.promotional_rate_end_date, l.status
FROM loans l JOIN profiles p ON p.id = l.user_id;

CREATE VIEW v_overdue_payments_dashboard AS
SELECT ps.id as schedule_id, ps.loan_id, l.user_id, p.full_name,
    ps.payment_number, ps.due_date, CURRENT_DATE - ps.due_date as days_overdue,
    ps.total_due_cents / 100.0 as amount_due, ps.total_paid_cents / 100.0 as amount_paid,
    (ps.total_due_cents - ps.total_paid_cents) / 100.0 as remaining_due,
    ps.status, ps.late_fee_applied, COALESCE(lf.calculated_fee_cents, 0) / 100.0 as late_fee
FROM loan_payment_schedule ps
JOIN loans l ON l.id = ps.loan_id
JOIN profiles p ON p.id = l.user_id
LEFT JOIN loan_late_fees lf ON lf.scheduled_payment_id = ps.id
WHERE ps.status IN ('scheduled', 'partial', 'late') AND ps.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

CREATE VIEW v_interest_accrual_audit AS
SELECT lia.id, lia.loan_id, l.user_id, lia.accrual_date,
    lia.days_in_period, lia.principal_balance_cents / 100.0 as principal_balance,
    lia.rate_type, lia.annual_rate * 100 as annual_rate_percent,
    lia.interest_accrued_cents / 100.0 as interest_accrued,
    lia.triggered_by, lia.created_at
FROM loan_interest_accruals lia JOIN loans l ON l.id = lia.loan_id
ORDER BY lia.created_at DESC;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE loan_interest_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_rate_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_late_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_index_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payoff_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_calculation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "interest_accruals_own" ON loan_interest_accruals FOR SELECT
USING (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()));

CREATE POLICY "rate_changes_own" ON loan_rate_changes FOR SELECT
USING (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()));

CREATE POLICY "late_fees_own" ON loan_late_fees FOR SELECT
USING (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()));

CREATE POLICY "index_rates_public_read" ON market_index_rates FOR SELECT USING (TRUE);

CREATE POLICY "payoff_quotes_own" ON loan_payoff_quotes FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "config_public_read" ON interest_calculation_config FOR SELECT USING (TRUE);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_late_fee_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_late_fees_updated
    BEFORE UPDATE ON loan_late_fees
    FOR EACH ROW EXECUTE FUNCTION update_late_fee_timestamp();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GRANT PERMISSIONS                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

GRANT EXECUTE ON FUNCTION calculate_daily_interest(INTEGER, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_accrued_interest(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_payoff_amount(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_payoff_quote(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_loan_late_fee(INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_effective_rate(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_index_rate(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_late_fee_to_loan(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_payment_to_loan(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 023 COMPLETE
-- ══════════════════════════════════════════════════════════════════════════════
