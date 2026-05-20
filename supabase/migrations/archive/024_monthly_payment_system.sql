-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 024: Monthly Payment System
-- ══════════════════════════════════════════════════════════════════════════════
-- Implements monthly payment disbursement with:
-- - Payment obligation generation and tracking
-- - Autopay configuration and execution
-- - Payment reminders and notifications
-- - Estimated monthly payment calculation (PMT formula)
-- - XnScore integration for payment behavior
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop objects that might exist from partial runs                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_monthly_payment_dashboard CASCADE;
DROP VIEW IF EXISTS v_autopay_queue CASCADE;
DROP VIEW IF EXISTS v_payment_reminders_due CASCADE;
DROP VIEW IF EXISTS v_obligation_summary CASCADE;

DROP FUNCTION IF EXISTS generate_monthly_obligation(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS generate_all_monthly_obligations() CASCADE;
DROP FUNCTION IF EXISTS calculate_estimated_monthly_payment(INTEGER, DECIMAL, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS process_autopay_payment(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_all_autopay() CASCADE;
DROP FUNCTION IF EXISTS schedule_payment_reminders(UUID) CASCADE;
DROP FUNCTION IF EXISTS send_due_reminders() CASCADE;
DROP FUNCTION IF EXISTS mark_reminder_sent(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_autopay_config(UUID, BOOLEAN, UUID, TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_next_payment_obligation(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_payment_obligations(UUID) CASCADE;
DROP FUNCTION IF EXISTS retry_failed_autopay(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_obligation_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_autopay_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_reminder_timestamp() CASCADE;

DROP TABLE IF EXISTS loan_payment_reminders CASCADE;
DROP TABLE IF EXISTS loan_autopay_configs CASCADE;
DROP TABLE IF EXISTS loan_payment_obligations CASCADE;

DROP TYPE IF EXISTS obligation_status CASCADE;
DROP TYPE IF EXISTS autopay_type CASCADE;
DROP TYPE IF EXISTS autopay_status CASCADE;
DROP TYPE IF EXISTS reminder_channel CASCADE;
DROP TYPE IF EXISTS reminder_status CASCADE;
DROP TYPE IF EXISTS reminder_type CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE obligation_status AS ENUM (
    'upcoming',      -- Future payment not yet due
    'due',           -- Payment is due this month
    'partial',       -- Partially paid
    'paid',          -- Fully paid
    'overdue',       -- Past due date
    'skipped',       -- Skipped (e.g., grace period)
    'waived'         -- Waived by admin
);

CREATE TYPE autopay_type AS ENUM (
    'minimum',           -- Pay minimum due amount
    'scheduled',         -- Pay scheduled monthly amount
    'fixed',             -- Pay a fixed custom amount
    'full_balance'       -- Pay entire remaining balance
);

CREATE TYPE autopay_status AS ENUM (
    'active',
    'paused',
    'disabled',
    'failed'
);

CREATE TYPE reminder_channel AS ENUM (
    'push',
    'email',
    'sms',
    'in_app'
);

CREATE TYPE reminder_status AS ENUM (
    'scheduled',
    'sent',
    'failed',
    'cancelled'
);

CREATE TYPE reminder_type AS ENUM (
    'upcoming',          -- 7 days before
    'due_soon',          -- 3 days before
    'due_tomorrow',      -- 1 day before
    'due_today',         -- Day of payment
    'overdue',           -- After due date
    'final_warning'      -- Severe overdue
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ALTER LOANS TABLE - Add Monthly Payment Fields                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Payment scheduling fields
ALTER TABLE loans ADD COLUMN IF NOT EXISTS payment_day_of_month INTEGER DEFAULT 1
    CHECK (payment_day_of_month >= 1 AND payment_day_of_month <= 28);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS estimated_monthly_payment_cents INTEGER;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS first_payment_date DATE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_payment_date DATE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS last_obligation_generated_date DATE;

-- Autopay fields
ALTER TABLE loans ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS autopay_config_id UUID;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS autopay_last_executed_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS autopay_next_scheduled_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS autopay_consecutive_failures INTEGER DEFAULT 0;

-- Reminder fields
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reminder_days_before INTEGER[] DEFAULT ARRAY[7, 3, 1];
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reminder_channels reminder_channel[] DEFAULT ARRAY['push'::reminder_channel, 'in_app'::reminder_channel];
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN DEFAULT TRUE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN PAYMENT OBLIGATIONS TABLE                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Tracks each monthly payment obligation (what is owed each month)

CREATE TABLE loan_payment_obligations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Obligation details
    obligation_number INTEGER NOT NULL,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    due_date DATE NOT NULL,

    -- Amount breakdown (estimated at generation, may adjust)
    estimated_payment_cents INTEGER NOT NULL,
    principal_due_cents INTEGER NOT NULL,
    interest_due_cents INTEGER NOT NULL,
    fees_due_cents INTEGER DEFAULT 0,
    total_due_cents INTEGER NOT NULL,

    -- Actual amounts (updated when paid)
    principal_paid_cents INTEGER DEFAULT 0,
    interest_paid_cents INTEGER DEFAULT 0,
    fees_paid_cents INTEGER DEFAULT 0,
    total_paid_cents INTEGER DEFAULT 0,

    -- Status tracking
    status obligation_status NOT NULL DEFAULT 'upcoming',
    days_overdue INTEGER DEFAULT 0,

    -- Payment tracking
    payment_id UUID REFERENCES loan_payments(id),
    paid_at TIMESTAMPTZ,
    paid_via TEXT,  -- 'manual', 'autopay', 'wallet'

    -- Late fee reference
    late_fee_id UUID REFERENCES loan_late_fees(id),
    late_fee_applied BOOLEAN DEFAULT FALSE,
    late_fee_cents INTEGER DEFAULT 0,

    -- XnScore tracking
    xnscore_event_triggered BOOLEAN DEFAULT FALSE,
    xnscore_adjustment INTEGER,  -- Points added/removed

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT unique_obligation_per_loan UNIQUE(loan_id, obligation_number)
);

CREATE INDEX idx_obligations_loan ON loan_payment_obligations(loan_id);
CREATE INDEX idx_obligations_user ON loan_payment_obligations(user_id);
CREATE INDEX idx_obligations_due_date ON loan_payment_obligations(due_date);
CREATE INDEX idx_obligations_status ON loan_payment_obligations(status);
CREATE INDEX idx_obligations_upcoming ON loan_payment_obligations(due_date)
    WHERE status IN ('upcoming', 'due');

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN AUTOPAY CONFIGS TABLE                                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Stores autopay configuration per loan

CREATE TABLE loan_autopay_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE UNIQUE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Configuration
    autopay_type autopay_type NOT NULL DEFAULT 'scheduled',
    fixed_amount_cents INTEGER,  -- Only for 'fixed' type
    payment_method_id UUID,  -- Reference to payment method
    payment_method_type TEXT,  -- 'card', 'bank_account', 'wallet'

    -- Scheduling
    days_before_due INTEGER DEFAULT 0,  -- 0 = on due date, 1 = day before, etc.
    preferred_time TIME DEFAULT '09:00:00',  -- Time of day to process

    -- Status
    status autopay_status NOT NULL DEFAULT 'active',
    paused_until DATE,
    pause_reason TEXT,

    -- Retry settings
    max_retries INTEGER DEFAULT 3,
    retry_interval_hours INTEGER DEFAULT 24,
    current_retry_count INTEGER DEFAULT 0,

    -- Execution tracking
    last_executed_at TIMESTAMPTZ,
    last_execution_status TEXT,  -- 'success', 'failed', 'insufficient_funds', etc.
    last_execution_error TEXT,
    next_scheduled_at TIMESTAMPTZ,

    -- History
    total_payments_made INTEGER DEFAULT 0,
    total_amount_paid_cents BIGINT DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_autopay_loan ON loan_autopay_configs(loan_id);
CREATE INDEX idx_autopay_user ON loan_autopay_configs(user_id);
CREATE INDEX idx_autopay_status ON loan_autopay_configs(status);
CREATE INDEX idx_autopay_next ON loan_autopay_configs(next_scheduled_at)
    WHERE status = 'active';

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN PAYMENT REMINDERS TABLE                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Tracks scheduled and sent payment reminders

CREATE TABLE loan_payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    obligation_id UUID REFERENCES loan_payment_obligations(id) ON DELETE CASCADE,

    -- Reminder details
    reminder_type reminder_type NOT NULL,
    channel reminder_channel NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    days_before_due INTEGER NOT NULL,

    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    amount_due_cents INTEGER,
    due_date DATE,

    -- Status
    status reminder_status NOT NULL DEFAULT 'scheduled',
    sent_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,

    -- Delivery tracking
    notification_id TEXT,  -- External notification service ID
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reminders_loan ON loan_payment_reminders(loan_id);
CREATE INDEX idx_reminders_user ON loan_payment_reminders(user_id);
CREATE INDEX idx_reminders_scheduled ON loan_payment_reminders(scheduled_for)
    WHERE status = 'scheduled';
CREATE INDEX idx_reminders_obligation ON loan_payment_reminders(obligation_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ESTIMATED MONTHLY PAYMENT CALCULATION (PMT Formula)                         │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- PMT = P * [r(1+r)^n] / [(1+r)^n - 1]
-- Where: P = Principal, r = monthly rate, n = number of payments

CREATE FUNCTION calculate_estimated_monthly_payment(
    p_principal_cents INTEGER,
    p_annual_rate DECIMAL,
    p_term_months INTEGER
)
RETURNS TABLE (
    monthly_payment_cents INTEGER,
    total_payments_cents INTEGER,
    total_interest_cents INTEGER,
    monthly_rate DECIMAL,
    effective_rate DECIMAL
) AS $$
DECLARE
    v_monthly_rate DECIMAL;
    v_payment DECIMAL;
    v_total_payments INTEGER;
    v_total_interest INTEGER;
BEGIN
    -- Handle edge cases
    IF p_term_months <= 0 THEN
        RAISE EXCEPTION 'Term months must be positive';
    END IF;

    IF p_principal_cents <= 0 THEN
        RETURN QUERY SELECT 0::INTEGER, 0::INTEGER, 0::INTEGER, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;

    -- Calculate monthly rate (annual rate / 12)
    v_monthly_rate := p_annual_rate / 12;

    -- Handle 0% APR (interest-free)
    IF p_annual_rate = 0 OR p_annual_rate IS NULL THEN
        v_payment := p_principal_cents::DECIMAL / p_term_months;
        v_total_payments := ROUND(v_payment * p_term_months)::INTEGER;
        RETURN QUERY SELECT
            CEIL(v_payment)::INTEGER,
            v_total_payments,
            0::INTEGER,
            0::DECIMAL,
            0::DECIMAL;
        RETURN;
    END IF;

    -- PMT formula: P * [r(1+r)^n] / [(1+r)^n - 1]
    v_payment := p_principal_cents * (
        (v_monthly_rate * POWER(1 + v_monthly_rate, p_term_months)) /
        (POWER(1 + v_monthly_rate, p_term_months) - 1)
    );

    v_total_payments := ROUND(v_payment * p_term_months)::INTEGER;
    v_total_interest := v_total_payments - p_principal_cents;

    RETURN QUERY SELECT
        CEIL(v_payment)::INTEGER,
        v_total_payments,
        v_total_interest,
        v_monthly_rate,
        p_annual_rate;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GENERATE MONTHLY OBLIGATION                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Creates a payment obligation for the upcoming month

CREATE FUNCTION generate_monthly_obligation(
    p_loan_id UUID,
    p_for_date DATE DEFAULT NULL
)
RETURNS TABLE (
    obligation_id UUID,
    obligation_number INTEGER,
    due_date DATE,
    total_due_cents INTEGER,
    principal_cents INTEGER,
    interest_cents INTEGER,
    already_exists BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_loan RECORD;
    v_existing RECORD;
    v_obligation_num INTEGER;
    v_due_date DATE;
    v_period_start DATE;
    v_period_end DATE;
    v_monthly_payment INTEGER;
    v_interest_for_period INTEGER;
    v_principal_for_period INTEGER;
    v_remaining_principal INTEGER;
    v_new_id UUID;
    v_effective_rate DECIMAL;
    v_target_date DATE;
BEGIN
    -- Get loan details
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;

    -- Only generate for active loans
    IF v_loan.status != 'active' THEN
        RETURN QUERY SELECT NULL::UUID, 0, NULL::DATE, 0, 0, 0, FALSE,
            format('Loan is %s, not active', v_loan.status);
        RETURN;
    END IF;

    -- Determine target date (default to next month if not specified)
    v_target_date := COALESCE(p_for_date,
        CASE
            WHEN v_loan.last_obligation_generated_date IS NULL THEN
                COALESCE(v_loan.first_payment_date,
                    make_date(
                        EXTRACT(YEAR FROM v_loan.created_at)::INTEGER,
                        EXTRACT(MONTH FROM v_loan.created_at)::INTEGER,
                        COALESCE(v_loan.payment_day_of_month, 1)
                    ) + INTERVAL '1 month')::DATE
            ELSE
                (v_loan.last_obligation_generated_date + INTERVAL '1 month')::DATE
        END
    );

    -- Calculate due date based on payment day preference
    v_due_date := make_date(
        EXTRACT(YEAR FROM v_target_date)::INTEGER,
        EXTRACT(MONTH FROM v_target_date)::INTEGER,
        LEAST(COALESCE(v_loan.payment_day_of_month, 1), 28)
    );

    -- Check if obligation already exists for this period
    SELECT * INTO v_existing
    FROM loan_payment_obligations
    WHERE loan_id = p_loan_id
    AND due_date = v_due_date;

    IF FOUND THEN
        RETURN QUERY SELECT v_existing.id, v_existing.obligation_number,
            v_existing.due_date, v_existing.total_due_cents,
            v_existing.principal_due_cents, v_existing.interest_due_cents,
            TRUE, 'Obligation already exists for this period';
        RETURN;
    END IF;

    -- Get next obligation number
    SELECT COALESCE(MAX(obligation_number), 0) + 1
    INTO v_obligation_num
    FROM loan_payment_obligations
    WHERE loan_id = p_loan_id;

    -- Calculate period dates
    v_period_start := v_due_date - INTERVAL '1 month';
    v_period_end := v_due_date - INTERVAL '1 day';

    -- Get estimated monthly payment
    v_monthly_payment := COALESCE(v_loan.estimated_monthly_payment_cents, 0);

    -- If not set, calculate it
    IF v_monthly_payment = 0 THEN
        SELECT monthly_payment_cents INTO v_monthly_payment
        FROM calculate_estimated_monthly_payment(
            v_loan.principal_cents,
            COALESCE(v_loan.apr / 100, 0.10),  -- Default 10% if not set
            COALESCE(v_loan.term_months, 12)
        );
    END IF;

    -- Get effective rate for interest calculation
    v_effective_rate := get_effective_rate(p_loan_id, v_due_date);

    -- Calculate interest for this period (daily accrual for ~30 days)
    SELECT interest_cents INTO v_interest_for_period
    FROM calculate_daily_interest(
        v_loan.outstanding_principal_cents,
        v_effective_rate,
        30  -- Approximate days in month
    );

    -- Principal = Monthly Payment - Interest
    v_principal_for_period := GREATEST(0, v_monthly_payment - v_interest_for_period);

    -- Don't exceed remaining principal
    v_remaining_principal := v_loan.outstanding_principal_cents;
    IF v_principal_for_period > v_remaining_principal THEN
        v_principal_for_period := v_remaining_principal;
        -- Recalculate total if final payment
        v_monthly_payment := v_principal_for_period + v_interest_for_period;
    END IF;

    -- Create the obligation
    INSERT INTO loan_payment_obligations (
        loan_id,
        user_id,
        obligation_number,
        period_start_date,
        period_end_date,
        due_date,
        estimated_payment_cents,
        principal_due_cents,
        interest_due_cents,
        total_due_cents,
        status
    ) VALUES (
        p_loan_id,
        v_loan.user_id,
        v_obligation_num,
        v_period_start,
        v_period_end,
        v_due_date,
        v_monthly_payment,
        v_principal_for_period,
        v_interest_for_period,
        v_monthly_payment,
        CASE
            WHEN v_due_date <= CURRENT_DATE THEN 'due'::obligation_status
            ELSE 'upcoming'::obligation_status
        END
    )
    RETURNING id INTO v_new_id;

    -- Update loan tracking
    UPDATE loans SET
        last_obligation_generated_date = v_due_date,
        next_payment_date = v_due_date,
        estimated_monthly_payment_cents = COALESCE(estimated_monthly_payment_cents, v_monthly_payment),
        updated_at = now()
    WHERE id = p_loan_id;

    -- Schedule reminders for this obligation
    PERFORM schedule_payment_reminders(v_new_id);

    RETURN QUERY SELECT v_new_id, v_obligation_num, v_due_date,
        v_monthly_payment, v_principal_for_period, v_interest_for_period,
        FALSE, 'Obligation created successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GENERATE ALL MONTHLY OBLIGATIONS (Batch Job)                                │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Called by cron job on 1st of each month

CREATE FUNCTION generate_all_monthly_obligations()
RETURNS TABLE (
    loans_processed INTEGER,
    obligations_created INTEGER,
    already_existed INTEGER,
    errors_count INTEGER
) AS $$
DECLARE
    v_loan RECORD;
    v_result RECORD;
    v_processed INTEGER := 0;
    v_created INTEGER := 0;
    v_existed INTEGER := 0;
    v_errors INTEGER := 0;
BEGIN
    FOR v_loan IN
        SELECT id FROM loans
        WHERE status = 'active'
        AND (
            last_obligation_generated_date IS NULL
            OR last_obligation_generated_date < date_trunc('month', CURRENT_DATE)::DATE
        )
    LOOP
        BEGIN
            SELECT * INTO v_result FROM generate_monthly_obligation(v_loan.id);

            IF v_result.already_exists THEN
                v_existed := v_existed + 1;
            ELSE
                v_created := v_created + 1;
            END IF;

            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_created, v_existed, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SCHEDULE PAYMENT REMINDERS                                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Creates reminder records for an obligation based on loan preferences

CREATE FUNCTION schedule_payment_reminders(p_obligation_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_obligation RECORD;
    v_loan RECORD;
    v_reminder_day INTEGER;
    v_channel reminder_channel;
    v_reminder_type reminder_type;
    v_scheduled_time TIMESTAMPTZ;
    v_title TEXT;
    v_message TEXT;
    v_reminders_created INTEGER := 0;
BEGIN
    -- Get obligation details
    SELECT * INTO v_obligation FROM loan_payment_obligations WHERE id = p_obligation_id;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Get loan reminder preferences
    SELECT * INTO v_loan FROM loans WHERE id = v_obligation.loan_id;

    -- Skip if reminders disabled
    IF NOT COALESCE(v_loan.reminders_enabled, TRUE) THEN
        RETURN 0;
    END IF;

    -- Create reminders for each days_before setting
    FOREACH v_reminder_day IN ARRAY COALESCE(v_loan.reminder_days_before, ARRAY[7, 3, 1])
    LOOP
        -- Determine reminder type based on days
        v_reminder_type := CASE
            WHEN v_reminder_day >= 7 THEN 'upcoming'::reminder_type
            WHEN v_reminder_day >= 3 THEN 'due_soon'::reminder_type
            WHEN v_reminder_day = 1 THEN 'due_tomorrow'::reminder_type
            ELSE 'due_today'::reminder_type
        END;

        -- Calculate scheduled time (morning of reminder day)
        v_scheduled_time := (v_obligation.due_date - v_reminder_day)::TIMESTAMPTZ + INTERVAL '9 hours';

        -- Skip if in the past
        IF v_scheduled_time < now() THEN
            CONTINUE;
        END IF;

        -- Generate message
        v_title := format('Payment Due %s',
            CASE
                WHEN v_reminder_day = 0 THEN 'Today'
                WHEN v_reminder_day = 1 THEN 'Tomorrow'
                ELSE format('in %s days', v_reminder_day)
            END
        );

        v_message := format('Your payment of $%s is due on %s. Tap to pay now.',
            (v_obligation.total_due_cents / 100.0)::NUMERIC(10,2),
            to_char(v_obligation.due_date, 'Mon DD, YYYY')
        );

        -- Create reminder for each channel
        FOREACH v_channel IN ARRAY COALESCE(v_loan.reminder_channels, ARRAY['push'::reminder_channel])
        LOOP
            INSERT INTO loan_payment_reminders (
                loan_id,
                user_id,
                obligation_id,
                reminder_type,
                channel,
                scheduled_for,
                days_before_due,
                title,
                message,
                amount_due_cents,
                due_date,
                status
            ) VALUES (
                v_obligation.loan_id,
                v_obligation.user_id,
                p_obligation_id,
                v_reminder_type,
                v_channel,
                v_scheduled_time,
                v_reminder_day,
                v_title,
                v_message,
                v_obligation.total_due_cents,
                v_obligation.due_date,
                'scheduled'::reminder_status
            );

            v_reminders_created := v_reminders_created + 1;
        END LOOP;
    END LOOP;

    RETURN v_reminders_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SEND DUE REMINDERS (Cron Job)                                               │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Marks reminders as ready to send (actual sending via edge function)

CREATE FUNCTION send_due_reminders()
RETURNS TABLE (
    reminders_processed INTEGER,
    reminders_marked INTEGER,
    errors_count INTEGER
) AS $$
DECLARE
    v_reminder RECORD;
    v_processed INTEGER := 0;
    v_marked INTEGER := 0;
    v_errors INTEGER := 0;
BEGIN
    FOR v_reminder IN
        SELECT r.*, o.status as obligation_status
        FROM loan_payment_reminders r
        LEFT JOIN loan_payment_obligations o ON o.id = r.obligation_id
        WHERE r.status = 'scheduled'
        AND r.scheduled_for <= now()
        ORDER BY r.scheduled_for ASC
        LIMIT 100  -- Batch size
    LOOP
        BEGIN
            -- Skip if obligation already paid
            IF v_reminder.obligation_status = 'paid' THEN
                UPDATE loan_payment_reminders
                SET status = 'cancelled', updated_at = now()
                WHERE id = v_reminder.id;
                v_processed := v_processed + 1;
                CONTINUE;
            END IF;

            -- Mark as sent (actual notification sent via edge function)
            UPDATE loan_payment_reminders SET
                status = 'sent',
                sent_at = now(),
                updated_at = now()
            WHERE id = v_reminder.id;

            v_marked := v_marked + 1;
            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_marked, v_errors;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MARK REMINDER SENT                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION mark_reminder_sent(
    p_reminder_id UUID,
    p_notification_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE loan_payment_reminders SET
        status = 'sent',
        sent_at = now(),
        notification_id = p_notification_id,
        updated_at = now()
    WHERE id = p_reminder_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ UPDATE AUTOPAY CONFIG                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_autopay_config(
    p_loan_id UUID,
    p_enabled BOOLEAN,
    p_payment_method_id UUID DEFAULT NULL,
    p_autopay_type TEXT DEFAULT 'scheduled',
    p_fixed_amount_cents INTEGER DEFAULT NULL
)
RETURNS TABLE (
    config_id UUID,
    enabled BOOLEAN,
    autopay_type autopay_type,
    next_scheduled_at TIMESTAMPTZ,
    message TEXT
) AS $$
DECLARE
    v_loan RECORD;
    v_config RECORD;
    v_config_id UUID;
    v_next_obligation RECORD;
    v_next_scheduled TIMESTAMPTZ;
BEGIN
    -- Get loan
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan % not found', p_loan_id;
    END IF;

    -- Get existing config
    SELECT * INTO v_config FROM loan_autopay_configs WHERE loan_id = p_loan_id;

    -- Calculate next scheduled time
    SELECT * INTO v_next_obligation
    FROM loan_payment_obligations
    WHERE loan_id = p_loan_id
    AND status IN ('upcoming', 'due')
    ORDER BY due_date ASC
    LIMIT 1;

    IF v_next_obligation IS NOT NULL THEN
        v_next_scheduled := v_next_obligation.due_date::TIMESTAMPTZ + INTERVAL '9 hours';
    ELSE
        v_next_scheduled := NULL;
    END IF;

    IF p_enabled THEN
        -- Create or update config
        IF v_config IS NULL THEN
            INSERT INTO loan_autopay_configs (
                loan_id, user_id, autopay_type, payment_method_id, fixed_amount_cents,
                status, next_scheduled_at
            ) VALUES (
                p_loan_id, v_loan.user_id, p_autopay_type::autopay_type,
                p_payment_method_id, p_fixed_amount_cents,
                'active', v_next_scheduled
            )
            RETURNING id INTO v_config_id;
        ELSE
            UPDATE loan_autopay_configs SET
                autopay_type = p_autopay_type::autopay_type,
                payment_method_id = COALESCE(p_payment_method_id, payment_method_id),
                fixed_amount_cents = COALESCE(p_fixed_amount_cents, fixed_amount_cents),
                status = 'active',
                next_scheduled_at = v_next_scheduled,
                updated_at = now()
            WHERE loan_id = p_loan_id
            RETURNING id INTO v_config_id;
        END IF;

        -- Update loan
        UPDATE loans SET
            autopay_enabled = TRUE,
            autopay_config_id = v_config_id,
            autopay_next_scheduled_at = v_next_scheduled,
            updated_at = now()
        WHERE id = p_loan_id;

        RETURN QUERY SELECT v_config_id, TRUE, p_autopay_type::autopay_type,
            v_next_scheduled, 'Autopay enabled successfully';
    ELSE
        -- Disable autopay
        IF v_config IS NOT NULL THEN
            UPDATE loan_autopay_configs SET
                status = 'disabled',
                next_scheduled_at = NULL,
                updated_at = now()
            WHERE loan_id = p_loan_id;
        END IF;

        UPDATE loans SET
            autopay_enabled = FALSE,
            autopay_next_scheduled_at = NULL,
            updated_at = now()
        WHERE id = p_loan_id;

        RETURN QUERY SELECT v_config.id, FALSE, v_config.autopay_type,
            NULL::TIMESTAMPTZ, 'Autopay disabled';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PROCESS AUTOPAY PAYMENT                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
-- Processes a single autopay payment

CREATE FUNCTION process_autopay_payment(p_config_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    payment_id UUID,
    amount_cents INTEGER,
    obligation_id UUID,
    error_message TEXT
) AS $$
DECLARE
    v_config RECORD;
    v_loan RECORD;
    v_obligation RECORD;
    v_amount INTEGER;
    v_payment_result RECORD;
BEGIN
    -- Get config
    SELECT * INTO v_config FROM loan_autopay_configs WHERE id = p_config_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::UUID, 'Config not found';
        RETURN;
    END IF;

    -- Check if active
    IF v_config.status != 'active' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::UUID,
            format('Autopay is %s', v_config.status);
        RETURN;
    END IF;

    -- Get loan
    SELECT * INTO v_loan FROM loans WHERE id = v_config.loan_id;
    IF v_loan.status != 'active' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::UUID,
            format('Loan is %s', v_loan.status);
        RETURN;
    END IF;

    -- Get next due obligation
    SELECT * INTO v_obligation
    FROM loan_payment_obligations
    WHERE loan_id = v_config.loan_id
    AND status IN ('due', 'upcoming', 'overdue')
    AND due_date <= CURRENT_DATE + 1  -- Due today or tomorrow
    ORDER BY due_date ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::UUID, 'No payment due';
        RETURN;
    END IF;

    -- Determine amount based on autopay type
    v_amount := CASE v_config.autopay_type
        WHEN 'minimum' THEN v_obligation.total_due_cents
        WHEN 'scheduled' THEN v_obligation.estimated_payment_cents
        WHEN 'fixed' THEN v_config.fixed_amount_cents
        WHEN 'full_balance' THEN v_loan.total_outstanding_cents
        ELSE v_obligation.total_due_cents
    END;

    -- Apply payment using existing function
    SELECT * INTO v_payment_result
    FROM apply_payment_to_loan(
        v_config.loan_id,
        v_amount,
        'autopay',
        v_config.payment_method_id::TEXT,
        NULL
    );

    -- Update obligation
    UPDATE loan_payment_obligations SET
        status = CASE
            WHEN v_payment_result.remaining_principal_cents <= 0 THEN 'paid'::obligation_status
            ELSE 'partial'::obligation_status
        END,
        principal_paid_cents = v_payment_result.principal_paid_cents,
        interest_paid_cents = v_payment_result.interest_paid_cents,
        fees_paid_cents = v_payment_result.fees_paid_cents,
        total_paid_cents = v_amount,
        payment_id = v_payment_result.payment_id,
        paid_at = now(),
        paid_via = 'autopay',
        updated_at = now()
    WHERE id = v_obligation.id;

    -- Update config
    UPDATE loan_autopay_configs SET
        last_executed_at = now(),
        last_execution_status = 'success',
        total_payments_made = total_payments_made + 1,
        total_amount_paid_cents = total_amount_paid_cents + v_amount,
        consecutive_failures = 0,
        current_retry_count = 0,
        updated_at = now()
    WHERE id = p_config_id;

    -- Calculate next scheduled payment
    UPDATE loan_autopay_configs SET
        next_scheduled_at = (
            SELECT due_date::TIMESTAMPTZ + INTERVAL '9 hours'
            FROM loan_payment_obligations
            WHERE loan_id = v_config.loan_id
            AND status IN ('upcoming')
            ORDER BY due_date ASC
            LIMIT 1
        )
    WHERE id = p_config_id;

    -- Trigger XnScore event for on-time payment
    IF v_obligation.due_date >= CURRENT_DATE THEN
        UPDATE loan_payment_obligations SET
            xnscore_event_triggered = TRUE,
            xnscore_adjustment = 3  -- +3 for on-time
        WHERE id = v_obligation.id;
    END IF;

    RETURN QUERY SELECT TRUE, v_payment_result.payment_id, v_amount,
        v_obligation.id, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PROCESS ALL AUTOPAY (Daily Cron Job)                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION process_all_autopay()
RETURNS TABLE (
    configs_processed INTEGER,
    payments_successful INTEGER,
    payments_failed INTEGER,
    total_amount_cents BIGINT
) AS $$
DECLARE
    v_config RECORD;
    v_result RECORD;
    v_processed INTEGER := 0;
    v_successful INTEGER := 0;
    v_failed INTEGER := 0;
    v_total BIGINT := 0;
BEGIN
    FOR v_config IN
        SELECT ac.*
        FROM loan_autopay_configs ac
        JOIN loans l ON l.id = ac.loan_id
        WHERE ac.status = 'active'
        AND l.status = 'active'
        AND ac.next_scheduled_at <= now()
        ORDER BY ac.next_scheduled_at ASC
        LIMIT 50  -- Batch size
    LOOP
        BEGIN
            SELECT * INTO v_result FROM process_autopay_payment(v_config.id);

            IF v_result.success THEN
                v_successful := v_successful + 1;
                v_total := v_total + v_result.amount_cents;
            ELSE
                v_failed := v_failed + 1;

                -- Update failure tracking
                UPDATE loan_autopay_configs SET
                    consecutive_failures = consecutive_failures + 1,
                    current_retry_count = current_retry_count + 1,
                    last_execution_status = 'failed',
                    last_execution_error = v_result.error_message,
                    status = CASE
                        WHEN consecutive_failures + 1 >= max_retries THEN 'failed'::autopay_status
                        ELSE status
                    END,
                    updated_at = now()
                WHERE id = v_config.id;
            END IF;

            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_successful, v_failed, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ RETRY FAILED AUTOPAY                                                        │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION retry_failed_autopay(p_config_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    payment_id UUID,
    amount_cents INTEGER,
    message TEXT
) AS $$
DECLARE
    v_config RECORD;
    v_result RECORD;
BEGIN
    -- Get config
    SELECT * INTO v_config FROM loan_autopay_configs WHERE id = p_config_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Config not found';
        RETURN;
    END IF;

    -- Check retry eligibility
    IF v_config.current_retry_count >= v_config.max_retries THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, 'Max retries exceeded';
        RETURN;
    END IF;

    -- Reset status to active for retry
    UPDATE loan_autopay_configs SET
        status = 'active',
        updated_at = now()
    WHERE id = p_config_id;

    -- Process payment
    SELECT * INTO v_result FROM process_autopay_payment(p_config_id);

    IF v_result.success THEN
        RETURN QUERY SELECT TRUE, v_result.payment_id, v_result.amount_cents,
            'Retry successful';
    ELSE
        RETURN QUERY SELECT FALSE, NULL::UUID, 0, v_result.error_message;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GET NEXT PAYMENT OBLIGATION                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION get_next_payment_obligation(p_loan_id UUID)
RETURNS TABLE (
    obligation_id UUID,
    obligation_number INTEGER,
    due_date DATE,
    days_until_due INTEGER,
    total_due_cents INTEGER,
    principal_due_cents INTEGER,
    interest_due_cents INTEGER,
    fees_due_cents INTEGER,
    status obligation_status,
    is_overdue BOOLEAN,
    late_fee_cents INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.obligation_number,
        o.due_date,
        (o.due_date - CURRENT_DATE)::INTEGER,
        o.total_due_cents,
        o.principal_due_cents,
        o.interest_due_cents,
        o.fees_due_cents,
        o.status,
        o.due_date < CURRENT_DATE,
        COALESCE(o.late_fee_cents, 0)
    FROM loan_payment_obligations o
    WHERE o.loan_id = p_loan_id
    AND o.status IN ('upcoming', 'due', 'overdue', 'partial')
    ORDER BY o.due_date ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GET PAYMENT OBLIGATIONS                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION get_payment_obligations(
    p_loan_id UUID,
    p_status obligation_status[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
    obligation_id UUID,
    obligation_number INTEGER,
    period_start DATE,
    period_end DATE,
    due_date DATE,
    total_due_cents INTEGER,
    total_paid_cents INTEGER,
    remaining_cents INTEGER,
    status obligation_status,
    is_overdue BOOLEAN,
    days_overdue INTEGER,
    late_fee_cents INTEGER,
    paid_at TIMESTAMPTZ,
    paid_via TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.id,
        o.obligation_number,
        o.period_start_date,
        o.period_end_date,
        o.due_date,
        o.total_due_cents,
        o.total_paid_cents,
        (o.total_due_cents - o.total_paid_cents),
        o.status,
        o.due_date < CURRENT_DATE AND o.status NOT IN ('paid', 'waived'),
        CASE
            WHEN o.due_date < CURRENT_DATE THEN (CURRENT_DATE - o.due_date)::INTEGER
            ELSE 0
        END,
        COALESCE(o.late_fee_cents, 0),
        o.paid_at,
        o.paid_via
    FROM loan_payment_obligations o
    WHERE o.loan_id = p_loan_id
    AND (p_status IS NULL OR o.status = ANY(p_status))
    ORDER BY o.due_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ UPDATE OVERDUE OBLIGATIONS (Daily Cron)                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_overdue_obligations()
RETURNS TABLE (
    obligations_updated INTEGER,
    xnscore_events INTEGER,
    late_fees_applied INTEGER
) AS $$
DECLARE
    v_obligation RECORD;
    v_updated INTEGER := 0;
    v_xnscore INTEGER := 0;
    v_fees INTEGER := 0;
    v_days_overdue INTEGER;
    v_fee_result RECORD;
BEGIN
    FOR v_obligation IN
        SELECT o.*, l.loan_product_id
        FROM loan_payment_obligations o
        JOIN loans l ON l.id = o.loan_id
        WHERE o.status IN ('upcoming', 'due', 'partial')
        AND o.due_date < CURRENT_DATE
        AND l.status = 'active'
    LOOP
        BEGIN
            v_days_overdue := CURRENT_DATE - v_obligation.due_date;

            -- Update status to overdue
            UPDATE loan_payment_obligations SET
                status = 'overdue',
                days_overdue = v_days_overdue,
                updated_at = now()
            WHERE id = v_obligation.id;

            v_updated := v_updated + 1;

            -- Apply late fee if past grace period (5 days)
            IF v_days_overdue > 5 AND NOT v_obligation.late_fee_applied THEN
                SELECT * INTO v_fee_result
                FROM apply_late_fee_to_loan(
                    v_obligation.loan_id,
                    v_obligation.id,  -- Note: Using obligation id as schedule id
                    v_days_overdue
                );

                IF v_fee_result.applied THEN
                    UPDATE loan_payment_obligations SET
                        late_fee_applied = TRUE,
                        late_fee_id = v_fee_result.fee_id,
                        late_fee_cents = v_fee_result.fee_cents,
                        fees_due_cents = fees_due_cents + v_fee_result.fee_cents,
                        total_due_cents = total_due_cents + v_fee_result.fee_cents,
                        updated_at = now()
                    WHERE id = v_obligation.id;

                    v_fees := v_fees + 1;
                END IF;
            END IF;

            -- Trigger XnScore event for late payment (only once)
            IF NOT v_obligation.xnscore_event_triggered AND v_days_overdue >= 1 THEN
                UPDATE loan_payment_obligations SET
                    xnscore_event_triggered = TRUE,
                    xnscore_adjustment = -5  -- -5 for late
                WHERE id = v_obligation.id;

                v_xnscore := v_xnscore + 1;
            END IF;

            -- Schedule overdue reminder
            IF v_days_overdue IN (1, 3, 7, 14, 30) THEN
                INSERT INTO loan_payment_reminders (
                    loan_id, user_id, obligation_id,
                    reminder_type, channel, scheduled_for, days_before_due,
                    title, message, amount_due_cents, due_date, status
                ) VALUES (
                    v_obligation.loan_id, v_obligation.user_id, v_obligation.id,
                    CASE
                        WHEN v_days_overdue >= 14 THEN 'final_warning'::reminder_type
                        ELSE 'overdue'::reminder_type
                    END,
                    'push'::reminder_channel,
                    now(),
                    -v_days_overdue,
                    format('Payment %s Days Overdue', v_days_overdue),
                    format('Your payment of $%s is %s days overdue. Pay now to avoid additional fees.',
                        (v_obligation.total_due_cents / 100.0)::NUMERIC(10,2),
                        v_days_overdue),
                    v_obligation.total_due_cents,
                    v_obligation.due_date,
                    'scheduled'::reminder_status
                );
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Continue processing other obligations
        END;
    END LOOP;

    RETURN QUERY SELECT v_updated, v_xnscore, v_fees;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE VIEW v_monthly_payment_dashboard AS
SELECT
    o.id as obligation_id,
    o.loan_id,
    o.user_id,
    p.full_name,
    o.obligation_number,
    o.due_date,
    (o.due_date - CURRENT_DATE) as days_until_due,
    o.total_due_cents / 100.0 as total_due,
    o.total_paid_cents / 100.0 as total_paid,
    (o.total_due_cents - o.total_paid_cents) / 100.0 as remaining,
    o.status,
    o.late_fee_cents / 100.0 as late_fee,
    l.autopay_enabled,
    ac.autopay_type,
    ac.status as autopay_status
FROM loan_payment_obligations o
JOIN loans l ON l.id = o.loan_id
JOIN profiles p ON p.id = o.user_id
LEFT JOIN loan_autopay_configs ac ON ac.loan_id = o.loan_id
WHERE o.status IN ('upcoming', 'due', 'overdue', 'partial')
ORDER BY o.due_date ASC;

CREATE VIEW v_autopay_queue AS
SELECT
    ac.id as config_id,
    ac.loan_id,
    l.user_id,
    p.full_name,
    ac.autopay_type,
    ac.status,
    ac.next_scheduled_at,
    ac.consecutive_failures,
    o.id as next_obligation_id,
    o.due_date as next_due_date,
    o.total_due_cents / 100.0 as next_amount_due,
    l.total_outstanding_cents / 100.0 as total_outstanding
FROM loan_autopay_configs ac
JOIN loans l ON l.id = ac.loan_id
JOIN profiles p ON p.id = l.user_id
LEFT JOIN LATERAL (
    SELECT * FROM loan_payment_obligations
    WHERE loan_id = ac.loan_id
    AND status IN ('upcoming', 'due')
    ORDER BY due_date ASC
    LIMIT 1
) o ON TRUE
WHERE ac.status = 'active'
AND l.status = 'active'
ORDER BY ac.next_scheduled_at ASC;

CREATE VIEW v_payment_reminders_due AS
SELECT
    r.id as reminder_id,
    r.loan_id,
    r.user_id,
    p.full_name,
    p.email,
    r.reminder_type,
    r.channel,
    r.scheduled_for,
    r.title,
    r.message,
    r.amount_due_cents / 100.0 as amount_due,
    r.due_date,
    r.status
FROM loan_payment_reminders r
JOIN profiles p ON p.id = r.user_id
WHERE r.status = 'scheduled'
AND r.scheduled_for <= now()
ORDER BY r.scheduled_for ASC;

CREATE VIEW v_obligation_summary AS
SELECT
    l.id as loan_id,
    l.user_id,
    l.estimated_monthly_payment_cents / 100.0 as monthly_payment,
    l.payment_day_of_month,
    l.autopay_enabled,
    COUNT(o.id) as total_obligations,
    COUNT(o.id) FILTER (WHERE o.status = 'paid') as paid_count,
    COUNT(o.id) FILTER (WHERE o.status IN ('overdue', 'partial')) as overdue_count,
    SUM(o.total_due_cents) / 100.0 as total_due,
    SUM(o.total_paid_cents) / 100.0 as total_paid,
    SUM(o.late_fee_cents) / 100.0 as total_late_fees
FROM loans l
LEFT JOIN loan_payment_obligations o ON o.loan_id = l.id
WHERE l.status = 'active'
GROUP BY l.id;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_obligation_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_obligations_updated
    BEFORE UPDATE ON loan_payment_obligations
    FOR EACH ROW EXECUTE FUNCTION update_obligation_timestamp();

CREATE FUNCTION update_autopay_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_autopay_updated
    BEFORE UPDATE ON loan_autopay_configs
    FOR EACH ROW EXECUTE FUNCTION update_autopay_timestamp();

CREATE FUNCTION update_reminder_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_reminders_updated
    BEFORE UPDATE ON loan_payment_reminders
    FOR EACH ROW EXECUTE FUNCTION update_reminder_timestamp();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE loan_payment_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_autopay_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payment_reminders ENABLE ROW LEVEL SECURITY;

-- Obligations: Users can view their own
CREATE POLICY "obligations_own_select" ON loan_payment_obligations
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "obligations_own_update" ON loan_payment_obligations
    FOR UPDATE USING (user_id = auth.uid());

-- Autopay: Users can view and manage their own
CREATE POLICY "autopay_own_select" ON loan_autopay_configs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "autopay_own_insert" ON loan_autopay_configs
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "autopay_own_update" ON loan_autopay_configs
    FOR UPDATE USING (user_id = auth.uid());

-- Reminders: Users can view their own
CREATE POLICY "reminders_own_select" ON loan_payment_reminders
    FOR SELECT USING (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ GRANT PERMISSIONS                                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

GRANT EXECUTE ON FUNCTION calculate_estimated_monthly_payment(INTEGER, DECIMAL, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_monthly_obligation(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_payment_reminders(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reminder_sent(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_autopay_config(UUID, BOOLEAN, UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION process_autopay_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION retry_failed_autopay(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_payment_obligation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_obligations(UUID, obligation_status[], INTEGER) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 024
-- ══════════════════════════════════════════════════════════════════════════════
