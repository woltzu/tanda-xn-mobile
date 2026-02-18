-- Migration: 013_late_contribution_handling_v4.sql
-- Description: Late Contribution Handling - Trust meets reality (Fixed version v4)
-- Manages the lifecycle of late payments from soft late through default
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- CLEANUP - Drop ALL existing versions of functions
-- =====================================================

-- Drop ALL versions of calculate_late_fee (any signature)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'calculate_late_fee'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- Drop ALL versions of get_user_late_summary
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'get_user_late_summary'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- Drop ALL versions of check_user_restriction
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'check_user_restriction'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- Drop ALL versions of update_late_contribution_timestamp
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname = 'update_late_contribution_timestamp'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- =====================================================
-- DROP VIEWS
-- =====================================================
DROP VIEW IF EXISTS v_payment_plan_progress CASCADE;
DROP VIEW IF EXISTS v_late_contributions_active CASCADE;

-- =====================================================
-- DROP POLICIES SAFELY
-- =====================================================
DO $$
BEGIN
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

-- =====================================================
-- DROP ALL INDEXES
-- =====================================================
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

-- =====================================================
-- DROP TABLES (CASCADE handles dependencies)
-- =====================================================
DROP TABLE IF EXISTS redistribution_responses CASCADE;
DROP TABLE IF EXISTS redistribution_requests CASCADE;
DROP TABLE IF EXISTS user_restrictions CASCADE;
DROP TABLE IF EXISTS late_contribution_events CASCADE;
DROP TABLE IF EXISTS auto_retry_history CASCADE;
DROP TABLE IF EXISTS auto_retry_config CASCADE;
DROP TABLE IF EXISTS payment_plan_installments CASCADE;
DROP TABLE IF EXISTS payment_plans CASCADE;
DROP TABLE IF EXISTS late_contributions CASCADE;
DROP TABLE IF EXISTS late_fee_config CASCADE;

-- =====================================================
-- CREATE LATE FEE CONFIG TABLE
-- =====================================================
CREATE TABLE late_fee_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,

    late_fee_percentage DECIMAL(5, 4) DEFAULT 0.05,
    grace_period_days INTEGER DEFAULT 2,
    enabled BOOLEAN DEFAULT true,

    fee_type TEXT DEFAULT 'percentage',
    flat_fee DECIMAL(12, 2) DEFAULT 500,
    tiered_fees JSONB,
    max_fee DECIMAL(12, 2),
    fee_destination TEXT DEFAULT 'platform',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id)
);

-- =====================================================
-- CREATE LATE CONTRIBUTIONS TABLE
-- =====================================================
CREATE TABLE late_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    contribution_id UUID NOT NULL REFERENCES cycle_contributions(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),

    expected_amount DECIMAL(15, 2) NOT NULL,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    outstanding_amount DECIMAL(15, 2) NOT NULL,
    late_fee_amount DECIMAL(15, 2) DEFAULT 0,

    original_due_date DATE NOT NULL,
    grace_period_end DATE NOT NULL,
    days_late INTEGER DEFAULT 0,

    late_status TEXT NOT NULL DEFAULT 'soft_late',

    soft_late_at TIMESTAMPTZ,
    grace_period_at TIMESTAMPTZ,
    final_warning_at TIMESTAMPTZ,
    defaulted_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    resolution_type TEXT,
    resolution_notes TEXT,

    auto_retry_attempts INTEGER DEFAULT 0,
    last_auto_retry_at TIMESTAMPTZ,
    last_auto_retry_error TEXT,

    payment_plan_id UUID,

    xnscore_impacts JSONB DEFAULT '[]',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(contribution_id)
);

-- =====================================================
-- CREATE PAYMENT PLANS TABLE
-- =====================================================
CREATE TABLE payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    late_contribution_id UUID NOT NULL REFERENCES late_contributions(id),
    circle_id UUID NOT NULL REFERENCES circles(id),

    total_amount DECIMAL(15, 2) NOT NULL,
    number_of_installments INTEGER NOT NULL,
    installment_amount DECIMAL(15, 2) NOT NULL,

    start_date DATE NOT NULL,
    installment_frequency TEXT NOT NULL DEFAULT 'weekly',

    paid_installments INTEGER DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    remaining_amount DECIMAL(15, 2) NOT NULL,

    plan_status TEXT NOT NULL DEFAULT 'active',

    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from late_contributions to payment_plans
ALTER TABLE late_contributions
    ADD CONSTRAINT fk_late_contributions_payment_plan
    FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(id);

-- =====================================================
-- CREATE PAYMENT PLAN INSTALLMENTS TABLE
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
-- CREATE AUTO-RETRY CONFIG TABLE
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
-- CREATE AUTO-RETRY HISTORY TABLE
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
-- CREATE LATE CONTRIBUTION EVENTS TABLE
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
-- CREATE REDISTRIBUTION REQUESTS TABLE
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
-- CREATE REDISTRIBUTION RESPONSES TABLE
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
-- CREATE USER RESTRICTIONS TABLE
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
-- CREATE INDEXES
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
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE late_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_retry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_contribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE redistribution_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Late fee config - circle leaders or public platform config
CREATE POLICY "lfc_select_policy" ON late_fee_config
    FOR SELECT USING (
        circle_id IS NULL OR
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = late_fee_config.circle_id AND user_id = auth.uid())
    );

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
-- CREATE FUNCTIONS
-- =====================================================

-- Function to check if user has active restrictions
CREATE FUNCTION check_user_restriction(
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
CREATE FUNCTION get_user_late_summary(p_user_id UUID)
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
CREATE FUNCTION calculate_late_fee(
    p_circle_id UUID,
    p_outstanding_amount DECIMAL,
    p_days_late INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    v_config RECORD;
    v_fee DECIMAL := 0;
    v_tier RECORD;
BEGIN
    SELECT * INTO v_config FROM late_fee_config WHERE circle_id = p_circle_id;

    IF v_config IS NULL THEN
        SELECT * INTO v_config FROM late_fee_config WHERE circle_id IS NULL LIMIT 1;
    END IF;

    IF v_config IS NULL THEN
        RETURN 0;
    END IF;

    IF NOT COALESCE(v_config.enabled, true) THEN
        RETURN 0;
    END IF;

    IF p_days_late <= COALESCE(v_config.grace_period_days, 2) THEN
        RETURN 0;
    END IF;

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

    IF v_config.max_fee IS NOT NULL THEN
        v_fee := LEAST(v_fee, v_config.max_fee);
    END IF;

    RETURN ROUND(v_fee, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger function for timestamps
CREATE FUNCTION update_late_contribution_timestamp()
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
-- CREATE VIEWS
-- =====================================================

CREATE VIEW v_late_contributions_active AS
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

CREATE VIEW v_payment_plan_progress AS
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
GRANT SELECT ON late_fee_config TO authenticated;
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

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE late_fee_config IS 'Late fee configuration per circle or platform default';
COMMENT ON TABLE late_contributions IS 'Tracks late payment lifecycle from soft late through default';
COMMENT ON TABLE payment_plans IS 'Installment plans for members who cannot pay in full';
COMMENT ON TABLE payment_plan_installments IS 'Individual installments within a payment plan';
COMMENT ON TABLE auto_retry_config IS 'Per-circle automatic payment retry settings';
COMMENT ON TABLE auto_retry_history IS 'History of automatic payment retry attempts';
COMMENT ON TABLE late_contribution_events IS 'Audit trail for late contribution handling';
COMMENT ON TABLE redistribution_requests IS 'Requests for other members to cover defaulted amounts';
COMMENT ON TABLE redistribution_responses IS 'Member responses to redistribution requests';
COMMENT ON TABLE user_restrictions IS 'Active restrictions on user accounts';
COMMENT ON FUNCTION check_user_restriction(UUID, TEXT) IS 'Check if user has an active restriction of given type';
COMMENT ON FUNCTION calculate_late_fee(UUID, DECIMAL, INTEGER) IS 'Calculate late fee based on circle config and days late';
