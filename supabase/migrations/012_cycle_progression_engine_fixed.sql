-- Migration: 012_cycle_progression_engine_fixed.sql
-- Description: Cycle Progression Engine - The heartbeat of TandaXn
-- Manages circle lifecycle from formation through completion
-- FIXED: Proper table creation order to avoid foreign key issues
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- PART 1: BASE TABLES (No foreign key dependencies)
-- =====================================================

-- Reserve Funds Table (for reserve coverage functionality)
-- Must be created BEFORE reserve_fund_transactions
CREATE TABLE IF NOT EXISTS reserve_funds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
    last_contribution_at TIMESTAMPTZ,
    last_withdrawal_at TIMESTAMPTZ,
    min_balance DECIMAL(15, 2) DEFAULT 0,
    max_coverage_percent DECIMAL(5, 4) DEFAULT 0.20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id)
);

-- XnScore History
CREATE TABLE IF NOT EXISTS xn_score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    change INTEGER NOT NULL,
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vouches Table
CREATE TABLE IF NOT EXISTS vouches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID NOT NULL REFERENCES profiles(id),
    vouchee_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID REFERENCES circles(id),
    community_id UUID REFERENCES communities(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    vouch_amount DECIMAL(15, 2),
    reason TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    UNIQUE(voucher_id, vouchee_id, circle_id)
);

-- User Payment Methods
CREATE TABLE IF NOT EXISTS user_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN (
        'mtn_momo',
        'orange_money',
        'bank_transfer',
        'paypal',
        'other'
    )),
    account_identifier TEXT NOT NULL,
    account_name TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron Job Logs
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT false,
    duration_ms INTEGER,
    details JSONB DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operations Alerts
CREATE TABLE IF NOT EXISTS ops_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    acknowledged_by UUID REFERENCES profiles(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 2: CIRCLE CYCLES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS circle_cycles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,

    -- Dates
    start_date DATE NOT NULL,
    contribution_deadline DATE NOT NULL,
    grace_period_end DATE,
    expected_payout_date DATE NOT NULL,
    actual_payout_date DATE,

    -- Status (state machine)
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled',
        'collecting',
        'deadline_reached',
        'grace_period',
        'ready_payout',
        'payout_pending',
        'payout_completed',
        'payout_failed',
        'payout_retry',
        'closed',
        'skipped',
        'cancelled'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Financial tracking
    expected_amount DECIMAL(15, 2) NOT NULL,
    collected_amount DECIMAL(15, 2) DEFAULT 0,
    payout_amount DECIMAL(15, 2),
    platform_fee DECIMAL(15, 2) DEFAULT 0,
    late_fees_collected DECIMAL(15, 2) DEFAULT 0,

    -- Recipient
    recipient_user_id UUID REFERENCES profiles(id),
    recipient_position INTEGER,

    -- Contribution tracking
    expected_contributions INTEGER NOT NULL DEFAULT 0,
    received_contributions INTEGER DEFAULT 0,

    -- Grace period tracking
    grace_extensions INTEGER DEFAULT 0,
    max_grace_extensions INTEGER DEFAULT 2,

    -- Payout tracking
    payout_transaction_id TEXT,
    payout_processor TEXT,
    payout_attempts INTEGER DEFAULT 0,
    last_payout_error TEXT,
    last_payout_attempt_at TIMESTAMPTZ,

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id, cycle_number)
);

-- =====================================================
-- PART 3: TABLES WITH FOREIGN KEYS TO CIRCLE_CYCLES
-- =====================================================

-- Cycle Contributions
CREATE TABLE IF NOT EXISTS cycle_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    member_id UUID REFERENCES circle_members(id),

    -- Expected
    expected_amount DECIMAL(15, 2) NOT NULL,
    due_date DATE NOT NULL,

    -- Actual
    contributed_amount DECIMAL(15, 2) DEFAULT 0,
    contributed_at TIMESTAMPTZ,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',
        'partial',
        'completed',
        'late',
        'missed',
        'excused',
        'covered'
    )),

    -- Timing
    was_on_time BOOLEAN,
    days_late INTEGER DEFAULT 0,

    -- Late fee
    late_fee_amount DECIMAL(15, 2) DEFAULT 0,
    late_fee_paid BOOLEAN DEFAULT false,

    -- Payment reference
    transaction_id TEXT,
    payment_method TEXT,

    -- Grace period
    in_grace_period BOOLEAN DEFAULT false,
    grace_reminder_sent BOOLEAN DEFAULT false,

    -- Covered by reserve or other member
    covered_by TEXT,
    covered_amount DECIMAL(15, 2) DEFAULT 0,

    -- Notifications
    reminder_count INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(cycle_id, user_id)
);

-- Cycle Events
CREATE TABLE IF NOT EXISTS cycle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL CHECK (event_type IN (
        'cycle_created',
        'cycle_started',
        'cycle_start_failed',
        'deadline_reached',
        'deadline_processing_failed',
        'contribution_received',
        'contribution_partial',
        'contribution_late',
        'contribution_missed',
        'contribution_excused',
        'contribution_covered',
        'grace_period_started',
        'grace_period_extended',
        'grace_period_ended',
        'ready_for_payout',
        'payout_initiated',
        'payout_initiation_failed',
        'payout_completed',
        'payout_failed',
        'payout_retried',
        'default_recorded',
        'default_resolved',
        'reserve_used',
        'reserve_partial_coverage',
        'cycle_closed',
        'cycle_skipped',
        'cycle_cancelled',
        'admin_intervention',
        'system_error',
        'webhook_received'
    )),

    -- Context
    user_id UUID REFERENCES profiles(id),
    amount DECIMAL(15, 2),

    -- Details
    details JSONB DEFAULT '{}',

    -- Who/what triggered this
    triggered_by TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN (
        'system',
        'admin',
        'user',
        'webhook',
        'cron'
    )),
    triggered_by_user_id UUID REFERENCES profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Member Defaults
CREATE TABLE IF NOT EXISTS member_defaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id),
    cycle_number INTEGER NOT NULL,

    -- Amount
    expected_amount DECIMAL(15, 2) NOT NULL,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    default_amount DECIMAL(15, 2) NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN (
        'unresolved',
        'partially_resolved',
        'resolved',
        'written_off',
        'disputed'
    )),

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolution_method TEXT,
    resolution_notes TEXT,

    -- Impact tracking
    xn_score_impact INTEGER,
    voucher_impact_propagated BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Circle Completions
CREATE TABLE IF NOT EXISTS circle_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Stats
    total_cycles INTEGER NOT NULL,
    total_contribution_amount DECIMAL(15, 2),
    total_contribution_count INTEGER,
    total_payout_amount DECIMAL(15, 2),
    total_payout_count INTEGER,
    total_defaults INTEGER DEFAULT 0,
    total_late_payments INTEGER DEFAULT 0,
    total_late_fees_collected DECIMAL(15, 2) DEFAULT 0,
    total_platform_fees DECIMAL(15, 2) DEFAULT 0,

    -- Success metrics
    on_time_rate DECIMAL(5, 4),
    completion_rate DECIMAL(5, 4),

    completed_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id)
);

-- Scheduled Notifications
CREATE TABLE IF NOT EXISTS scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    cycle_id UUID REFERENCES circle_cycles(id) ON DELETE CASCADE,

    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'contribution_reminder_early',
        'contribution_reminder_midway',
        'contribution_reminder_urgent',
        'contribution_due_today',
        'grace_period_warning',
        'grace_period_final',
        'payout_upcoming',
        'payout_received',
        'cycle_starting'
    )),

    scheduled_for TIMESTAMPTZ NOT NULL,

    -- Condition check before sending
    condition_check TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
        'scheduled',
        'sent',
        'cancelled',
        'failed',
        'skipped'
    )),

    sent_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,

    -- Payload
    payload JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cycle Engine Runs
CREATE TABLE IF NOT EXISTS cycle_engine_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Results
    status TEXT NOT NULL CHECK (status IN (
        'running',
        'success',
        'completed_with_errors',
        'failed'
    )),

    cycles_started INTEGER DEFAULT 0,
    deadlines_processed INTEGER DEFAULT 0,
    grace_periods_started INTEGER DEFAULT 0,
    grace_periods_ended INTEGER DEFAULT 0,
    payouts_initiated INTEGER DEFAULT 0,
    payouts_completed INTEGER DEFAULT 0,
    cycles_closed INTEGER DEFAULT 0,

    errors JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reserve Fund Transactions (depends on reserve_funds)
CREATE TABLE IF NOT EXISTS reserve_fund_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reserve_id UUID NOT NULL REFERENCES reserve_funds(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'deposit',
        'withdrawal',
        'coverage',
        'refund',
        'interest',
        'fee'
    )),
    amount DECIMAL(15, 2) NOT NULL,
    balance_before DECIMAL(15, 2) NOT NULL,
    balance_after DECIMAL(15, 2) NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PART 4: ENHANCE CIRCLES TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'current_cycle_number') THEN
        ALTER TABLE circles ADD COLUMN current_cycle_number INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'current_cycle_id') THEN
        ALTER TABLE circles ADD COLUMN current_cycle_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'incomplete_contribution_policy') THEN
        ALTER TABLE circles ADD COLUMN incomplete_contribution_policy TEXT DEFAULT 'grace_then_proceed';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'grace_period_days') THEN
        ALTER TABLE circles ADD COLUMN grace_period_days INTEGER DEFAULT 2;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'platform_fee_percent') THEN
        ALTER TABLE circles ADD COLUMN platform_fee_percent DECIMAL(5, 4) DEFAULT 0.02;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'completed_at') THEN
        ALTER TABLE circles ADD COLUMN completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- PART 5: INDEXES
-- =====================================================

-- Circle Cycles indexes
CREATE INDEX IF NOT EXISTS idx_circle_cycles_circle ON circle_cycles(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_cycles_status ON circle_cycles(status);
CREATE INDEX IF NOT EXISTS idx_circle_cycles_deadline ON circle_cycles(contribution_deadline)
    WHERE status IN ('collecting', 'deadline_reached');
CREATE INDEX IF NOT EXISTS idx_circle_cycles_payout ON circle_cycles(expected_payout_date)
    WHERE status = 'ready_payout';
CREATE INDEX IF NOT EXISTS idx_circle_cycles_scheduled ON circle_cycles(start_date)
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_circle_cycles_recipient ON circle_cycles(recipient_user_id);

-- Cycle Contributions indexes
CREATE INDEX IF NOT EXISTS idx_cycle_contributions_cycle ON cycle_contributions(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_contributions_user ON cycle_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_cycle_contributions_status ON cycle_contributions(status);
CREATE INDEX IF NOT EXISTS idx_cycle_contributions_pending ON cycle_contributions(cycle_id, status)
    WHERE status IN ('pending', 'partial', 'late');
CREATE INDEX IF NOT EXISTS idx_cycle_contributions_due ON cycle_contributions(due_date)
    WHERE status IN ('pending', 'partial');

-- Cycle Events indexes
CREATE INDEX IF NOT EXISTS idx_cycle_events_cycle ON cycle_events(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_events_circle ON cycle_events(circle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_events_type ON cycle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_cycle_events_created ON cycle_events(created_at);
CREATE INDEX IF NOT EXISTS idx_cycle_events_user ON cycle_events(user_id) WHERE user_id IS NOT NULL;

-- Defaults indexes
CREATE INDEX IF NOT EXISTS idx_defaults_user ON member_defaults(user_id);
CREATE INDEX IF NOT EXISTS idx_defaults_circle ON member_defaults(circle_id);
CREATE INDEX IF NOT EXISTS idx_defaults_status ON member_defaults(status);
CREATE INDEX IF NOT EXISTS idx_defaults_unresolved ON member_defaults(status) WHERE status = 'unresolved';

-- Scheduled Notifications indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user ON scheduled_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_scheduled ON scheduled_notifications(scheduled_for)
    WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_cycle ON scheduled_notifications(cycle_id);

-- Engine Runs indexes
CREATE INDEX IF NOT EXISTS idx_engine_runs_started ON cycle_engine_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_engine_runs_status ON cycle_engine_runs(status);

-- Support tables indexes
CREATE INDEX IF NOT EXISTS idx_xn_score_history_user ON xn_score_history(user_id);
CREATE INDEX IF NOT EXISTS idx_xn_score_history_created ON xn_score_history(created_at);
CREATE INDEX IF NOT EXISTS idx_vouches_voucher ON vouches(voucher_id);
CREATE INDEX IF NOT EXISTS idx_vouches_vouchee ON vouches(vouchee_id);
CREATE INDEX IF NOT EXISTS idx_vouches_circle ON vouches(circle_id);
CREATE INDEX IF NOT EXISTS idx_vouches_active ON vouches(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_primary ON user_payment_methods(user_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_type ON cron_job_logs(job_type);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_executed ON cron_job_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_status ON ops_alerts(status);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_type ON ops_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_open ON ops_alerts(status, created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_reserve ON reserve_fund_transactions(reserve_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_type ON reserve_fund_transactions(transaction_type);

-- =====================================================
-- PART 6: ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE circle_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_engine_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reserve_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xn_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_alerts ENABLE ROW LEVEL SECURITY;

-- Circle Cycles
DROP POLICY IF EXISTS "Members can view circle cycles" ON circle_cycles;
CREATE POLICY "Members can view circle cycles" ON circle_cycles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = circle_cycles.circle_id
            AND user_id = auth.uid()
        )
    );

-- Cycle Contributions
DROP POLICY IF EXISTS "Users can view own contributions" ON cycle_contributions;
CREATE POLICY "Users can view own contributions" ON cycle_contributions
    FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = cycle_contributions.circle_id
            AND user_id = auth.uid()
            AND role IN ('leader', 'admin')
        )
    );

-- Cycle Events
DROP POLICY IF EXISTS "Members can view cycle events" ON cycle_events;
CREATE POLICY "Members can view cycle events" ON cycle_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = cycle_events.circle_id
            AND user_id = auth.uid()
        )
    );

-- Defaults
DROP POLICY IF EXISTS "Users can view own defaults" ON member_defaults;
CREATE POLICY "Users can view own defaults" ON member_defaults
    FOR SELECT USING (user_id = auth.uid());

-- Circle Completions
DROP POLICY IF EXISTS "Members can view circle completions" ON circle_completions;
CREATE POLICY "Members can view circle completions" ON circle_completions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = circle_completions.circle_id
            AND user_id = auth.uid()
        )
    );

-- Scheduled Notifications
DROP POLICY IF EXISTS "Users can view own scheduled notifications" ON scheduled_notifications;
CREATE POLICY "Users can view own scheduled notifications" ON scheduled_notifications
    FOR SELECT USING (user_id = auth.uid());

-- Engine Runs
DROP POLICY IF EXISTS "Only admins can view engine runs" ON cycle_engine_runs;
CREATE POLICY "Only admins can view engine runs" ON cycle_engine_runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- Reserve Funds
DROP POLICY IF EXISTS "Community members can view reserve" ON reserve_funds;
CREATE POLICY "Community members can view reserve" ON reserve_funds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_members
            WHERE community_id = reserve_funds.community_id
            AND user_id = auth.uid()
        )
    );

-- Reserve Fund Transactions
DROP POLICY IF EXISTS "Community leaders can view reserve transactions" ON reserve_fund_transactions;
CREATE POLICY "Community leaders can view reserve transactions" ON reserve_fund_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_members cm
            JOIN reserve_funds rf ON rf.community_id = cm.community_id
            WHERE rf.id = reserve_fund_transactions.reserve_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'leader')
        )
    );

-- XnScore History
DROP POLICY IF EXISTS "Users can view own score history" ON xn_score_history;
CREATE POLICY "Users can view own score history" ON xn_score_history
    FOR SELECT USING (user_id = auth.uid());

-- Vouches
DROP POLICY IF EXISTS "Vouchers and vouchees can view vouches" ON vouches;
CREATE POLICY "Vouchers and vouchees can view vouches" ON vouches
    FOR SELECT USING (voucher_id = auth.uid() OR vouchee_id = auth.uid());

-- Payment Methods
DROP POLICY IF EXISTS "Users can view own payment methods" ON user_payment_methods;
CREATE POLICY "Users can view own payment methods" ON user_payment_methods
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own payment methods" ON user_payment_methods;
CREATE POLICY "Users can manage own payment methods" ON user_payment_methods
    FOR ALL USING (user_id = auth.uid());

-- Cron Job Logs
DROP POLICY IF EXISTS "Only admins can view cron logs" ON cron_job_logs;
CREATE POLICY "Only admins can view cron logs" ON cron_job_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND status = 'active')
    );

-- Ops Alerts
DROP POLICY IF EXISTS "Only admins can view ops alerts" ON ops_alerts;
CREATE POLICY "Only admins can view ops alerts" ON ops_alerts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND status = 'active')
    );

-- =====================================================
-- PART 7: FUNCTIONS
-- =====================================================

-- Function to calculate cycle dates based on frequency
CREATE OR REPLACE FUNCTION calculate_cycle_dates(
    p_circle_start_date DATE,
    p_frequency TEXT,
    p_cycle_number INTEGER
) RETURNS TABLE (
    start_date DATE,
    contribution_deadline DATE,
    expected_payout_date DATE
) AS $$
DECLARE
    v_start DATE;
    v_deadline DATE;
    v_payout DATE;
BEGIN
    v_start := p_circle_start_date;

    CASE p_frequency
        WHEN 'weekly' THEN
            v_start := p_circle_start_date + ((p_cycle_number - 1) * INTERVAL '7 days');
            v_deadline := v_start + INTERVAL '5 days';
            v_payout := v_start + INTERVAL '7 days';

        WHEN 'biweekly' THEN
            v_start := p_circle_start_date + ((p_cycle_number - 1) * INTERVAL '14 days');
            v_deadline := v_start + INTERVAL '10 days';
            v_payout := v_start + INTERVAL '14 days';

        WHEN 'monthly' THEN
            v_start := p_circle_start_date + ((p_cycle_number - 1) * INTERVAL '1 month');
            v_deadline := v_start + INTERVAL '25 days';
            v_payout := (DATE_TRUNC('month', v_start) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

        WHEN 'quarterly' THEN
            v_start := p_circle_start_date + ((p_cycle_number - 1) * INTERVAL '3 months');
            v_deadline := v_start + INTERVAL '80 days';
            v_payout := (DATE_TRUNC('month', v_start + INTERVAL '3 months') - INTERVAL '1 day')::DATE;

        ELSE
            v_start := p_circle_start_date + ((p_cycle_number - 1) * INTERVAL '1 month');
            v_deadline := v_start + INTERVAL '25 days';
            v_payout := (DATE_TRUNC('month', v_start) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END CASE;

    RETURN QUERY SELECT v_start, v_deadline, v_payout;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to create all cycles for a circle
CREATE OR REPLACE FUNCTION generate_circle_cycles(
    p_circle_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_circle RECORD;
    v_cycle_number INTEGER;
    v_dates RECORD;
    v_cycles_created INTEGER := 0;
BEGIN
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;

    IF v_circle IS NULL THEN
        RAISE EXCEPTION 'Circle not found: %', p_circle_id;
    END IF;

    FOR v_cycle_number IN 1..v_circle.total_cycles LOOP
        SELECT * INTO v_dates FROM calculate_cycle_dates(
            v_circle.start_date::DATE,
            COALESCE(v_circle.contribution_frequency, 'monthly'),
            v_cycle_number
        );

        INSERT INTO circle_cycles (
            circle_id,
            cycle_number,
            start_date,
            contribution_deadline,
            expected_payout_date,
            status,
            expected_contributions,
            expected_amount
        )
        VALUES (
            p_circle_id,
            v_cycle_number,
            v_dates.start_date,
            v_dates.contribution_deadline,
            v_dates.expected_payout_date,
            'scheduled',
            v_circle.max_members,
            v_circle.contribution_amount * v_circle.max_members
        )
        ON CONFLICT (circle_id, cycle_number) DO NOTHING;

        IF FOUND THEN
            v_cycles_created := v_cycles_created + 1;
        END IF;
    END LOOP;

    RETURN v_cycles_created;
END;
$$ LANGUAGE plpgsql;

-- Function to get cycle status summary
CREATE OR REPLACE FUNCTION get_cycle_status_summary(p_cycle_id UUID)
RETURNS TABLE (
    total_expected INTEGER,
    total_received INTEGER,
    total_pending INTEGER,
    total_late INTEGER,
    total_missed INTEGER,
    collected_amount DECIMAL,
    expected_amount DECIMAL,
    collection_percentage DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_expected,
        COUNT(*) FILTER (WHERE cc.status = 'completed')::INTEGER as total_received,
        COUNT(*) FILTER (WHERE cc.status IN ('pending', 'partial'))::INTEGER as total_pending,
        COUNT(*) FILTER (WHERE cc.status = 'late')::INTEGER as total_late,
        COUNT(*) FILTER (WHERE cc.status = 'missed')::INTEGER as total_missed,
        COALESCE(SUM(cc.contributed_amount), 0) as collected_amount,
        COALESCE(SUM(cc.expected_amount), 0) as expected_amount,
        CASE
            WHEN SUM(cc.expected_amount) > 0
            THEN ROUND(SUM(cc.contributed_amount) / SUM(cc.expected_amount) * 100, 2)
            ELSE 0
        END as collection_percentage
    FROM cycle_contributions cc
    WHERE cc.cycle_id = p_cycle_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update cycle totals
CREATE OR REPLACE FUNCTION update_cycle_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE circle_cycles SET
        collected_amount = (
            SELECT COALESCE(SUM(contributed_amount), 0)
            FROM cycle_contributions
            WHERE cycle_id = NEW.cycle_id
            AND status IN ('completed', 'covered')
        ),
        received_contributions = (
            SELECT COUNT(*)
            FROM cycle_contributions
            WHERE cycle_id = NEW.cycle_id
            AND status IN ('completed', 'covered')
        ),
        late_fees_collected = (
            SELECT COALESCE(SUM(late_fee_amount), 0)
            FROM cycle_contributions
            WHERE cycle_id = NEW.cycle_id
            AND late_fee_paid = true
        ),
        updated_at = NOW()
    WHERE id = NEW.cycle_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cycle_totals ON cycle_contributions;
CREATE TRIGGER trigger_update_cycle_totals
    AFTER INSERT OR UPDATE ON cycle_contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_cycle_totals();

-- Timestamp triggers
CREATE OR REPLACE FUNCTION update_cycle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_circle_cycles_updated ON circle_cycles;
CREATE TRIGGER trigger_circle_cycles_updated
    BEFORE UPDATE ON circle_cycles
    FOR EACH ROW EXECUTE FUNCTION update_cycle_timestamp();

DROP TRIGGER IF EXISTS trigger_cycle_contributions_updated ON cycle_contributions;
CREATE TRIGGER trigger_cycle_contributions_updated
    BEFORE UPDATE ON cycle_contributions
    FOR EACH ROW EXECUTE FUNCTION update_cycle_timestamp();

DROP TRIGGER IF EXISTS trigger_defaults_updated ON member_defaults;
CREATE TRIGGER trigger_defaults_updated
    BEFORE UPDATE ON member_defaults
    FOR EACH ROW EXECUTE FUNCTION update_cycle_timestamp();

-- =====================================================
-- PART 8: VIEWS
-- =====================================================

-- View: Current cycle status across all circles
CREATE OR REPLACE VIEW v_active_cycles AS
SELECT
    c.id as circle_id,
    c.name as circle_name,
    c.community_id,
    cc.id as cycle_id,
    cc.cycle_number,
    cc.status,
    cc.expected_contributions,
    cc.received_contributions,
    cc.collected_amount,
    cc.expected_amount,
    cc.contribution_deadline,
    cc.expected_payout_date,
    cc.recipient_user_id,
    p.full_name as recipient_name,
    CASE
        WHEN cc.status = 'collecting' AND cc.contribution_deadline < CURRENT_DATE
        THEN 'overdue'
        WHEN cc.status = 'grace_period' AND cc.grace_period_end < CURRENT_DATE
        THEN 'grace_expired'
        WHEN cc.status = 'payout_pending' AND cc.status_changed_at < NOW() - INTERVAL '3 days'
        THEN 'payout_stuck'
        ELSE 'normal'
    END as attention_status
FROM circle_cycles cc
JOIN circles c ON cc.circle_id = c.id
LEFT JOIN profiles p ON cc.recipient_user_id = p.id
WHERE cc.status NOT IN ('closed', 'cancelled', 'skipped');

-- View: Cycles needing attention
CREATE OR REPLACE VIEW v_cycles_needing_attention AS
SELECT * FROM v_active_cycles
WHERE attention_status != 'normal'
   OR status IN ('payout_failed', 'payout_retry')
ORDER BY
    CASE status
        WHEN 'payout_failed' THEN 1
        WHEN 'grace_period' THEN 2
        WHEN 'deadline_reached' THEN 3
        ELSE 4
    END,
    contribution_deadline;

-- =====================================================
-- PART 9: GRANTS
-- =====================================================
GRANT SELECT ON circle_cycles TO authenticated;
GRANT SELECT ON cycle_contributions TO authenticated;
GRANT SELECT ON cycle_events TO authenticated;
GRANT SELECT ON member_defaults TO authenticated;
GRANT SELECT ON circle_completions TO authenticated;
GRANT SELECT ON scheduled_notifications TO authenticated;
GRANT SELECT ON v_active_cycles TO authenticated;
GRANT SELECT ON v_cycles_needing_attention TO authenticated;
GRANT SELECT ON cron_job_logs TO authenticated;
GRANT SELECT ON ops_alerts TO authenticated;
GRANT SELECT ON reserve_funds TO authenticated;
GRANT SELECT ON xn_score_history TO authenticated;
GRANT SELECT ON vouches TO authenticated;
GRANT ALL ON user_payment_methods TO authenticated;

-- =====================================================
-- PART 10: COMMENTS
-- =====================================================
COMMENT ON TABLE circle_cycles IS 'One record per cycle in a circle - tracks the full lifecycle';
COMMENT ON TABLE cycle_contributions IS 'Individual contribution tracking per member per cycle';
COMMENT ON TABLE cycle_events IS 'Audit trail for all cycle state changes';
COMMENT ON TABLE member_defaults IS 'Track member defaults for XnScore and platform integrity';
COMMENT ON TABLE circle_completions IS 'Summary record when a circle completes all cycles';
COMMENT ON TABLE scheduled_notifications IS 'Contribution reminders and other scheduled notifications';
COMMENT ON TABLE cycle_engine_runs IS 'Track cycle progression engine execution for monitoring';
COMMENT ON TABLE cron_job_logs IS 'Log of all cron job executions';
COMMENT ON TABLE ops_alerts IS 'Alerts for operations team review';
COMMENT ON TABLE reserve_funds IS 'Community reserve funds for covering defaults';
COMMENT ON TABLE xn_score_history IS 'History of XnScore changes for auditing';
COMMENT ON TABLE vouches IS 'Member vouching relationships';
COMMENT ON TABLE user_payment_methods IS 'User payment method destinations for payouts';
COMMENT ON FUNCTION calculate_cycle_dates IS 'Calculate start, deadline, and payout dates for a cycle';
COMMENT ON FUNCTION generate_circle_cycles IS 'Pre-generate all cycles for a circle';
COMMENT ON FUNCTION get_cycle_status_summary IS 'Get contribution status summary for a cycle';
COMMENT ON VIEW v_active_cycles IS 'Current status of all active cycles';
COMMENT ON VIEW v_cycles_needing_attention IS 'Cycles that need admin attention';
