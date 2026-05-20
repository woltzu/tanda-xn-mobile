-- Migration: 013_late_contribution_handling_v3.sql
-- Description: Late Contribution Handling - Trust meets reality (Fixed version v3)
-- Manages the lifecycle of late payments from soft late through default
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- CLEANUP - Drop existing objects safely
-- Using IF EXISTS to handle partial/missing objects
-- =====================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS v_payment_plan_progress;
DROP VIEW IF EXISTS v_late_contributions_active;

-- Drop functions
DROP FUNCTION IF EXISTS calculate_late_fee(UUID, DECIMAL, INTEGER);
DROP FUNCTION IF EXISTS get_user_late_summary(UUID);
DROP FUNCTION IF EXISTS check_user_restriction(UUID, TEXT);
DROP FUNCTION IF EXISTS update_late_contribution_timestamp();

-- Drop policies (must drop before tables)
DO $$
BEGIN
    -- Late contributions policies
    DROP POLICY IF EXISTS "late_contrib_select" ON late_contributions;
    DROP POLICY IF EXISTS "lc_select_policy" ON late_contributions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "payment_plans_select" ON payment_plans;
    DROP POLICY IF EXISTS "payment_plans_insert" ON payment_plans;
    DROP POLICY IF EXISTS "pp_select_policy" ON payment_plans;
    DROP POLICY IF EXISTS "pp_insert_policy" ON payment_plans;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "installments_select" ON payment_plan_installments;
    DROP POLICY IF EXISTS "ppi_select_policy" ON payment_plan_installments;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "retry_config_select" ON auto_retry_config;
    DROP POLICY IF EXISTS "arc_select_policy" ON auto_retry_config;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "retry_history_select" ON auto_retry_history;
    DROP POLICY IF EXISTS "arh_select_policy" ON auto_retry_history;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "late_events_select" ON late_contribution_events;
    DROP POLICY IF EXISTS "lce_select_policy" ON late_contribution_events;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "redist_select" ON redistribution_requests;
    DROP POLICY IF EXISTS "rr_select_policy" ON redistribution_requests;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "redist_resp_select" ON redistribution_responses;
    DROP POLICY IF EXISTS "redist_resp_update" ON redistribution_responses;
    DROP POLICY IF EXISTS "rresp_select_policy" ON redistribution_responses;
    DROP POLICY IF EXISTS "rresp_update_policy" ON redistribution_responses;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "restrictions_select" ON user_restrictions;
    DROP POLICY IF EXISTS "ur_select_policy" ON user_restrictions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop indexes safely
DROP INDEX IF EXISTS idx_late_contrib_user;
DROP INDEX IF EXISTS idx_late_contrib_cycle;
DROP INDEX IF EXISTS idx_late_contrib_circle;
DROP INDEX IF EXISTS idx_late_contrib_status;
DROP INDEX IF EXISTS idx_late_contrib_unresolved;
DROP INDEX IF EXISTS idx_late_contrib_grace_end;
DROP INDEX IF EXISTS idx_lc_user;
DROP INDEX IF EXISTS idx_lc_cycle;
DROP INDEX IF EXISTS idx_lc_circle;
DROP INDEX IF EXISTS idx_lc_status;
DROP INDEX IF EXISTS idx_lc_unresolved;
DROP INDEX IF EXISTS idx_lc_grace_end;

DROP INDEX IF EXISTS idx_payment_plans_user;
DROP INDEX IF EXISTS idx_payment_plans_status;
DROP INDEX IF EXISTS idx_payment_plans_late;
DROP INDEX IF EXISTS idx_pp_user;
DROP INDEX IF EXISTS idx_pp_status;
DROP INDEX IF EXISTS idx_pp_late;

DROP INDEX IF EXISTS idx_installments_plan;
DROP INDEX IF EXISTS idx_installments_due;
DROP INDEX IF EXISTS idx_ppi_plan;
DROP INDEX IF EXISTS idx_ppi_due;

DROP INDEX IF EXISTS idx_retry_history_late;
DROP INDEX IF EXISTS idx_retry_history_user;
DROP INDEX IF EXISTS idx_arh_late;
DROP INDEX IF EXISTS idx_arh_user;

DROP INDEX IF EXISTS idx_late_events_late;
DROP INDEX IF EXISTS idx_late_events_type;
DROP INDEX IF EXISTS idx_lce_late;
DROP INDEX IF EXISTS idx_lce_type;

DROP INDEX IF EXISTS idx_redist_cycle;
DROP INDEX IF EXISTS idx_redist_status;
DROP INDEX IF EXISTS idx_rr_cycle;
DROP INDEX IF EXISTS idx_rr_status;

DROP INDEX IF EXISTS idx_restrictions_user;
DROP INDEX IF EXISTS idx_restrictions_active;
DROP INDEX IF EXISTS idx_ur_user;
DROP INDEX IF EXISTS idx_ur_active;

-- Drop foreign key constraint first
DO $$
BEGIN
    ALTER TABLE late_contributions DROP CONSTRAINT IF EXISTS fk_late_contributions_payment_plan;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Drop tables in dependency order (with CASCADE to handle any remaining deps)
DROP TABLE IF EXISTS redistribution_responses CASCADE;
DROP TABLE IF EXISTS redistribution_requests CASCADE;
DROP TABLE IF EXISTS user_restrictions CASCADE;
DROP TABLE IF EXISTS late_contribution_events CASCADE;
DROP TABLE IF EXISTS auto_retry_history CASCADE;
DROP TABLE IF EXISTS auto_retry_config CASCADE;
DROP TABLE IF EXISTS payment_plan_installments CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;
DROP TABLE IF EXISTS late_contributions CASCADE;

-- =====================================================
-- CREATE LATE FEE CONFIG TABLE IF NOT EXISTS
-- This table may not exist from previous migrations
-- =====================================================
CREATE TABLE IF NOT EXISTS late_fee_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,

    -- Basic config
    late_fee_percentage DECIMAL(5, 4) DEFAULT 0.05, -- 5%
    grace_period_days INTEGER DEFAULT 2,
    enabled BOOLEAN DEFAULT true,

    -- Enhanced config
    fee_type TEXT DEFAULT 'percentage', -- 'percentage', 'flat', 'tiered'
    flat_fee DECIMAL(12, 2) DEFAULT 500, -- 500 XAF
    tiered_fees JSONB,
    max_fee DECIMAL(12, 2),
    fee_destination TEXT DEFAULT 'platform', -- 'platform', 'reserve', 'recipient'

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id)
);

-- =====================================================
-- LATE CONTRIBUTIONS TABLE
-- Detailed record for each late event
-- =====================================================
CREATE TABLE late_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    contribution_id UUID NOT NULL REFERENCES cycle_contributions(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),

    -- Amounts
    expected_amount DECIMAL(15, 2) NOT NULL,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    outstanding_amount DECIMAL(15, 2) NOT NULL,
    late_fee_amount DECIMAL(15, 2) DEFAULT 0,

    -- Timing
    original_due_date DATE NOT NULL,
    grace_period_end DATE NOT NULL,
    days_late INTEGER DEFAULT 0,

    -- Status progression
    -- 'soft_late', 'grace_period', 'final_warning', 'defaulted',
    -- 'paid_late', 'partially_paid', 'covered', 'forgiven', 'payment_plan'
    late_status TEXT NOT NULL DEFAULT 'soft_late',

    -- Status history timestamps
    soft_late_at TIMESTAMPTZ,
    grace_period_at TIMESTAMPTZ,
    final_warning_at TIMESTAMPTZ,
    defaulted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- Resolution details
    resolution_type TEXT,
    resolution_notes TEXT,

    -- Auto-retry tracking
    auto_retry_attempts INTEGER DEFAULT 0,
    last_auto_retry_at TIMESTAMPTZ,
    last_auto_retry_error TEXT,

    -- Payment plan reference (will add FK later)
    payment_plan_id UUID,

    -- XnScore impacts applied
    xnscore_impacts JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(contribution_id)
);

-- =====================================================
-- PAYMENT PLANS TABLE
-- For members who can't pay in full
-- =====================================================
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    late_contribution_id UUID NOT NULL REFERENCES late_contributions(id),
    circle_id UUID NOT NULL REFERENCES circles(id),

    -- Plan details
    total_amount DECIMAL(15, 2) NOT NULL,
    number_of_installments INTEGER NOT NULL,
    installment_amount DECIMAL(15, 2) NOT NULL,

    -- Schedule
    start_date DATE NOT NULL,
    installment_frequency TEXT NOT NULL DEFAULT 'weekly',

    -- Progress
    paid_installments INTEGER DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    remaining_amount DECIMAL(15, 2) NOT NULL,

    -- Status
    plan_status TEXT NOT NULL DEFAULT 'active',

    -- Approval
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Now add the FK from late_contributions to payment_plans
ALTER TABLE late_contributions
    ADD CONSTRAINT fk_late_contributions_payment_plan
    FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id);

-- =====================================================
-- PAYMENT PLAN INSTALLMENTS TABLE
-- =====================================================
CREATE TABLE payment_plan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    payment_plan_id UUID NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,

    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE NOT NULL,

    installment_status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(15, 2),
    transaction_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(payment_plan_id, installment_number)
);

-- =====================================================
-- AUTO-RETRY CONFIGURATION
-- =====================================================
CREATE TABLE auto_retry_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID UNIQUE REFERENCES circles(id) ON DELETE CASCADE,

    enabled BOOLEAN DEFAULT true,
    max_retries INTEGER DEFAULT 3,
    retry_interval_hours INTEGER DEFAULT 24,
    retry_on_days INTEGER[],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUTO-RETRY HISTORY
-- =====================================================
CREATE TABLE auto_retry_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    late_contribution_id UUID NOT NULL REFERENCES late_contributions(id) ON DELETE CASCADE,
    contribution_id UUID NOT NULL REFERENCES cycle_contributions(id),
    user_id UUID NOT NULL REFERENCES profiles(id),

    attempt_number INTEGER NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    success BOOLEAN NOT NULL,
    error_code TEXT,
    error_message TEXT,
    transaction_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LATE CONTRIBUTION EVENTS
-- =====================================================
CREATE TABLE late_contribution_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    late_contribution_id UUID NOT NULL REFERENCES late_contributions(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    user_id UUID NOT NULL REFERENCES profiles(id),

    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REDISTRIBUTION REQUESTS
-- =====================================================
CREATE TABLE redistribution_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    defaulted_user_id UUID NOT NULL REFERENCES profiles(id),

    total_amount DECIMAL(15, 2) NOT NULL,
    amount_per_member DECIMAL(15, 2) NOT NULL,

    members_requested INTEGER NOT NULL,
    members_accepted INTEGER DEFAULT 0,
    amount_collected DECIMAL(15, 2) DEFAULT 0,

    request_status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REDISTRIBUTION RESPONSES
-- =====================================================
CREATE TABLE redistribution_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    redistribution_id UUID NOT NULL REFERENCES redistribution_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),

    requested_amount DECIMAL(15, 2) NOT NULL,
    response_status TEXT NOT NULL DEFAULT 'pending',

    responded_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(15, 2),
    transaction_id TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(redistribution_id, user_id)
);

-- =====================================================
-- USER RESTRICTIONS
-- =====================================================
CREATE TABLE user_restrictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    restriction_type TEXT NOT NULL,
    reason TEXT NOT NULL,

    related_default_id UUID,
    related_circle_id UUID REFERENCES circles(id),

    active_until TIMESTAMPTZ,
    lifted_at TIMESTAMPTZ,
    lifted_by UUID REFERENCES profiles(id),
    lift_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK for related_default_id if member_defaults exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'member_defaults') THEN
        ALTER TABLE user_restrictions
        ADD CONSTRAINT fk_user_restrictions_default
        FOREIGN KEY (related_default_id) REFERENCES member_defaults(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- ENHANCE CIRCLES TABLE
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'default_handling_policy') THEN
        ALTER TABLE circles ADD COLUMN default_handling_policy TEXT DEFAULT 'proceed_reduced';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'reveal_late_members') THEN
        ALTER TABLE circles ADD COLUMN reveal_late_members BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'grace_config') THEN
        ALTER TABLE circles ADD COLUMN grace_config JSONB DEFAULT '{
            "gracePeriodStartDay": 2,
            "finalWarningStartDay": 5,
            "defaultDay": 7,
            "softLateXnScoreImpact": -5,
            "gracePeriodXnScoreImpact": -5,
            "finalWarningXnScoreImpact": -10,
            "defaultXnScoreImpact": -30
        }';
    END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_lc_user ON late_contributions(user_id);
CREATE INDEX idx_lc_cycle ON late_contributions(cycle_id);
CREATE INDEX idx_lc_circle ON late_contributions(circle_id);
CREATE INDEX idx_lc_status ON late_contributions(late_status);
CREATE INDEX idx_lc_unresolved ON late_contributions(late_status)
    WHERE late_status NOT IN ('paid_late', 'partially_paid', 'covered', 'forgiven');
CREATE INDEX idx_lc_grace_end ON late_contributions(grace_period_end)
    WHERE late_status IN ('soft_late', 'grace_period', 'final_warning');

CREATE INDEX idx_pp_user ON payment_plans(user_id);
CREATE INDEX idx_pp_status ON payment_plans(plan_status);
CREATE INDEX idx_pp_late ON payment_plans(late_contribution_id);

CREATE INDEX idx_ppi_plan ON payment_plan_installments(payment_plan_id);
CREATE INDEX idx_ppi_due ON payment_plan_installments(due_date)
    WHERE installment_status = 'pending';

CREATE INDEX idx_arh_late ON auto_retry_history(late_contribution_id);
CREATE INDEX idx_arh_user ON auto_retry_history(user_id);

CREATE INDEX idx_lce_late ON late_contribution_events(late_contribution_id);
CREATE INDEX idx_lce_type ON late_contribution_events(event_type);

CREATE INDEX idx_rr_cycle ON redistribution_requests(cycle_id);
CREATE INDEX idx_rr_status ON redistribution_requests(request_status);

CREATE INDEX idx_ur_user ON user_restrictions(user_id);
CREATE INDEX idx_ur_active ON user_restrictions(user_id, restriction_type)
    WHERE lifted_at IS NULL;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE late_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_retry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_contribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;

-- Late Contributions policies
CREATE POLICY "lc_select_policy" ON late_contributions
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = late_contributions.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
    );

-- Payment Plans policies
CREATE POLICY "pp_select_policy" ON payment_plans
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pp_insert_policy" ON payment_plans
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Installments policies
CREATE POLICY "ppi_select_policy" ON payment_plan_installments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM payment_plans WHERE id = payment_plan_installments.payment_plan_id AND user_id = auth.uid())
    );

-- Auto-retry config policies
CREATE POLICY "arc_select_policy" ON auto_retry_config
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = auto_retry_config.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
    );

-- Auto-retry history policies
CREATE POLICY "arh_select_policy" ON auto_retry_history
    FOR SELECT USING (user_id = auth.uid());

-- Late events policies
CREATE POLICY "lce_select_policy" ON late_contribution_events
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = late_contribution_events.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
    );

-- Redistribution requests policies
CREATE POLICY "rr_select_policy" ON redistribution_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = redistribution_requests.circle_id AND user_id = auth.uid())
    );

-- Redistribution responses policies
CREATE POLICY "rresp_select_policy" ON redistribution_responses
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "rresp_update_policy" ON redistribution_responses
    FOR UPDATE USING (user_id = auth.uid());

-- User restrictions policies
CREATE POLICY "ur_select_policy" ON user_restrictions
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to check if user has active restrictions
CREATE OR REPLACE FUNCTION check_user_restriction(
    p_user_id UUID,
    p_restriction_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_restrictions
        WHERE user_id = p_user_id
        AND restriction_type = p_restriction_type
        AND lifted_at IS NULL
        AND (active_until IS NULL OR active_until > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get late contribution summary for a user
CREATE OR REPLACE FUNCTION get_user_late_summary(p_user_id UUID)
RETURNS TABLE (
    total_late_contributions INTEGER,
    total_defaults INTEGER,
    total_outstanding DECIMAL,
    active_payment_plans INTEGER,
    has_restrictions BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM late_contributions WHERE user_id = p_user_id),
        (SELECT COUNT(*)::INTEGER FROM late_contributions WHERE user_id = p_user_id AND late_status = 'defaulted'),
        COALESCE((SELECT SUM(outstanding_amount) FROM late_contributions WHERE user_id = p_user_id AND late_status NOT IN ('paid_late', 'covered', 'forgiven')), 0::DECIMAL),
        (SELECT COUNT(*)::INTEGER FROM payment_plans WHERE user_id = p_user_id AND plan_status = 'active'),
        EXISTS (SELECT 1 FROM user_restrictions WHERE user_id = p_user_id AND lifted_at IS NULL);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate late fee
CREATE OR REPLACE FUNCTION calculate_late_fee(
    p_circle_id UUID,
    p_outstanding_amount DECIMAL,
    p_days_late INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    v_config RECORD;
    v_fee DECIMAL := 0;
    v_tier RECORD;
BEGIN
    -- Get late fee config for circle
    SELECT * INTO v_config FROM late_fee_config WHERE circle_id = p_circle_id;

    -- If no config, try platform default (null circle_id)
    IF v_config IS NULL THEN
        SELECT * INTO v_config FROM late_fee_config WHERE circle_id IS NULL LIMIT 1;
    END IF;

    -- If still no config, return 0
    IF v_config IS NULL THEN
        RETURN 0;
    END IF;

    -- Check if enabled
    IF NOT COALESCE(v_config.enabled, true) THEN
        RETURN 0;
    END IF;

    -- Check grace days
    IF p_days_late <= COALESCE(v_config.grace_period_days, 2) THEN
        RETURN 0;
    END IF;

    -- Calculate based on fee type
    CASE COALESCE(v_config.fee_type, 'percentage')
        WHEN 'flat' THEN
            v_fee := COALESCE(v_config.flat_fee, 500);

        WHEN 'percentage' THEN
            v_fee := p_outstanding_amount * COALESCE(v_config.late_fee_percentage, 0.05);

        WHEN 'tiered' THEN
            IF v_config.tiered_fees IS NOT NULL THEN
                FOR v_tier IN SELECT * FROM jsonb_to_recordset(v_config.tiered_fees) AS x(days_late INTEGER, fee DECIMAL)
                    ORDER BY days_late DESC
                LOOP
                    IF p_days_late >= v_tier.days_late THEN
                        v_fee := v_tier.fee;
                        EXIT;
                    END IF;
                END LOOP;
            END IF;
        ELSE
            v_fee := p_outstanding_amount * 0.05;
    END CASE;

    -- Apply max fee cap
    IF v_config.max_fee IS NOT NULL THEN
        v_fee := LEAST(v_fee, v_config.max_fee);
    END IF;

    RETURN ROUND(v_fee, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for timestamps
CREATE OR REPLACE FUNCTION update_late_contribution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_late_contrib_ts
    BEFORE UPDATE ON late_contributions
    FOR EACH ROW EXECUTE FUNCTION update_late_contribution_timestamp();

CREATE TRIGGER trg_payment_plans_ts
    BEFORE UPDATE ON payment_plans
    FOR EACH ROW EXECUTE FUNCTION update_late_contribution_timestamp();

-- =====================================================
-- VIEWS
-- =====================================================

-- View: Active late contributions needing attention
CREATE OR REPLACE VIEW v_late_contributions_active AS
SELECT
    lc.*,
    c.name as circle_name,
    p.full_name as user_name,
    p.email as user_email,
    EXTRACT(EPOCH FROM (lc.grace_period_end::timestamp - NOW())) / 3600 as hours_until_default,
    CASE
        WHEN lc.late_status = 'final_warning' THEN 1
        WHEN lc.late_status = 'grace_period' THEN 2
        WHEN lc.late_status = 'soft_late' THEN 3
        ELSE 4
    END as priority_order
FROM late_contributions lc
JOIN circles c ON lc.circle_id = c.id
JOIN profiles p ON lc.user_id = p.id
WHERE lc.late_status IN ('soft_late', 'grace_period', 'final_warning')
ORDER BY priority_order, lc.grace_period_end;

-- View: Payment plan progress
CREATE OR REPLACE VIEW v_payment_plan_progress AS
SELECT
    pp.*,
    p.full_name as user_name,
    c.name as circle_name,
    (SELECT COUNT(*) FROM payment_plan_installments ppi WHERE ppi.payment_plan_id = pp.id AND ppi.installment_status = 'paid') as paid_count,
    (SELECT MIN(ppi2.due_date) FROM payment_plan_installments ppi2 WHERE ppi2.payment_plan_id = pp.id AND ppi2.installment_status = 'pending') as next_due_date,
    ROUND((pp.paid_amount / NULLIF(pp.total_amount, 0)) * 100, 2) as completion_percentage
FROM payment_plans pp
JOIN profiles p ON pp.user_id = p.id
JOIN circles c ON pp.circle_id = c.id
WHERE pp.plan_status = 'active';

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT ON late_contributions TO authenticated;
GRANT SELECT, INSERT ON payment_plans TO authenticated;
GRANT SELECT ON payment_plan_installments TO authenticated;
GRANT SELECT ON auto_retry_config TO authenticated;
GRANT SELECT ON auto_retry_history TO authenticated;
GRANT SELECT ON late_contribution_events TO authenticated;
GRANT SELECT ON redistribution_requests TO authenticated;
GRANT SELECT, UPDATE ON redistribution_responses TO authenticated;
GRANT SELECT ON user_restrictions TO authenticated;
GRANT SELECT ON v_late_contributions_active TO authenticated;
GRANT SELECT ON v_payment_plan_progress TO authenticated;
GRANT SELECT ON late_fee_config TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE late_contributions IS 'Tracks late payment lifecycle from soft late through default';
COMMENT ON TABLE payment_plans IS 'Installment plans for members who cannot pay in full';
COMMENT ON TABLE payment_plan_installments IS 'Individual installments within a payment plan';
COMMENT ON TABLE auto_retry_config IS 'Per-circle automatic payment retry settings';
COMMENT ON TABLE auto_retry_history IS 'History of automatic payment retry attempts';
COMMENT ON TABLE late_contribution_events IS 'Audit trail for late contribution handling';
COMMENT ON TABLE redistribution_requests IS 'Requests for other members to cover defaulted amounts';
COMMENT ON TABLE redistribution_responses IS 'Member responses to redistribution requests';
COMMENT ON TABLE user_restrictions IS 'Active restrictions on user accounts';
COMMENT ON FUNCTION check_user_restriction IS 'Check if user has an active restriction of given type';
COMMENT ON FUNCTION calculate_late_fee IS 'Calculate late fee based on circle config and days late';
