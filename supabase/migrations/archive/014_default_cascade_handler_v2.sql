-- Migration: 014_default_cascade_handler_v2.sql
-- Description: Default Cascade Handler - Where one person's failure ripples through the trust network
-- Fixed version with complete cleanup
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- CLEANUP - Drop ALL existing objects
-- =====================================================

-- Drop ALL versions of functions first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname IN ('check_repeat_offender', 'calculate_voucher_reliability', 'get_default_cascade_summary', 'update_defaults_timestamp')
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- Drop views
DROP VIEW IF EXISTS v_active_cascades CASCADE;
DROP VIEW IF EXISTS v_voucher_impact_summary CASCADE;
DROP VIEW IF EXISTS v_recovery_performance CASCADE;
DROP VIEW IF EXISTS v_circle_resolution_stats CASCADE;

-- Drop all indexes that might exist
DROP INDEX IF EXISTS idx_def_user;
DROP INDEX IF EXISTS idx_def_circle;
DROP INDEX IF EXISTS idx_def_community;
DROP INDEX IF EXISTS idx_def_status;
DROP INDEX IF EXISTS idx_def_cascade;
DROP INDEX IF EXISTS idx_def_unresolved;
DROP INDEX IF EXISTS idx_vdi_voucher;
DROP INDEX IF EXISTS idx_vdi_default;
DROP INDEX IF EXISTS idx_vdi_cascade;
DROP INDEX IF EXISTS idx_cdr_default;
DROP INDEX IF EXISTS idx_cdr_circle;
DROP INDEX IF EXISTS idx_cdr_recipient;
DROP INDEX IF EXISTS idx_rp_user;
DROP INDEX IF EXISTS idx_rp_default;
DROP INDEX IF EXISTS idx_rp_status;
DROP INDEX IF EXISTS idx_rpi_plan;
DROP INDEX IF EXISTS idx_rpi_due;
DROP INDEX IF EXISTS idx_sr_user;
DROP INDEX IF EXISTS idx_sr_status;
DROP INDEX IF EXISTS idx_md_user;
DROP INDEX IF EXISTS idx_md_status;
DROP INDEX IF EXISTS idx_ce_cascade;
DROP INDEX IF EXISTS idx_ce_default;
DROP INDEX IF EXISTS idx_ce_type;

-- Drop policies safely
DO $$ BEGIN DROP POLICY IF EXISTS "def_select_policy" ON defaults; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "vdi_select_policy" ON voucher_default_impacts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "cdr_select_policy" ON circle_default_resolutions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "rp_select_policy" ON recovery_plans; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "rpi_select_policy" ON recovery_plan_installments; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "sr_select_policy" ON suspension_reviews; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "md_select_policy" ON member_debts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ce_select_policy" ON cascade_events; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Drop tables in dependency order
DROP TABLE IF EXISTS cascade_events CASCADE;
DROP TABLE IF EXISTS recovery_plan_installments CASCADE;
DROP TABLE IF EXISTS suspension_reviews CASCADE;
DROP TABLE IF EXISTS member_debts CASCADE;
DROP TABLE IF EXISTS circle_default_resolutions CASCADE;
DROP TABLE IF EXISTS voucher_default_impacts CASCADE;
DROP TABLE IF EXISTS recovery_plans CASCADE;
DROP TABLE IF EXISTS defaults CASCADE;

-- =====================================================
-- DEFAULTS TABLE - Main record for each default event
-- =====================================================
CREATE TABLE defaults (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who and where
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    community_id UUID NOT NULL REFERENCES communities(id),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id),
    cycle_number INTEGER NOT NULL,

    -- Link to late contribution
    late_contribution_id UUID REFERENCES late_contributions(id),

    -- Amounts
    original_amount DECIMAL(12,2) NOT NULL,
    late_fees DECIMAL(12,2) DEFAULT 0,
    total_owed DECIMAL(12,2) NOT NULL,
    amount_recovered DECIMAL(12,2) DEFAULT 0,
    amount_written_off DECIMAL(12,2) DEFAULT 0,

    -- Status
    default_status TEXT NOT NULL DEFAULT 'unresolved',

    -- Resolution
    resolution_type TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolution_notes TEXT,

    -- Cascade tracking
    cascade_id UUID NOT NULL,
    cascade_completed BOOLEAN DEFAULT FALSE,
    cascade_completed_at TIMESTAMPTZ,

    -- Impact tracking
    xnscore_impact_applied INTEGER,
    voucher_impacts_applied INTEGER DEFAULT 0,
    circle_impact_type TEXT,
    circle_impact_amount DECIMAL(12,2),

    -- Recovery tracking
    recovery_plan_id UUID,
    last_recovery_attempt_at TIMESTAMPTZ,
    recovery_attempts INTEGER DEFAULT 0,

    -- Flags
    is_repeat_offender BOOLEAN DEFAULT FALSE,
    triggered_suspension_review BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- RECOVERY PLANS TABLE - Path back to good standing
-- =====================================================
CREATE TABLE recovery_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    default_id UUID NOT NULL REFERENCES defaults(id),

    total_debt DECIMAL(12,2) NOT NULL,
    payment_type TEXT NOT NULL,
    number_of_installments INTEGER,
    installment_amount DECIMAL(12,2),
    installment_frequency TEXT,

    start_date DATE,
    expected_completion_date DATE,

    amount_paid DECIMAL(12,2) DEFAULT 0,
    installments_paid INTEGER DEFAULT 0,

    xnscore_recovery_milestones JSONB DEFAULT '[
        {"pctPaid": 25, "xnscoreRecovery": 5},
        {"pctPaid": 50, "xnscoreRecovery": 7},
        {"pctPaid": 75, "xnscoreRecovery": 8},
        {"pctPaid": 100, "xnscoreRecovery": 10}
    ]',
    milestones_achieved JSONB DEFAULT '[]',

    plan_status TEXT NOT NULL DEFAULT 'offered',

    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from defaults to recovery_plans
ALTER TABLE defaults
    ADD CONSTRAINT fk_defaults_recovery_plan
    FOREIGN KEY (recovery_plan_id) REFERENCES recovery_plans(id);

-- =====================================================
-- VOUCHER DEFAULT IMPACTS TABLE
-- =====================================================
CREATE TABLE voucher_default_impacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,
    cascade_id UUID NOT NULL,
    vouch_id UUID NOT NULL REFERENCES vouches(id),

    voucher_user_id UUID NOT NULL REFERENCES profiles(id),
    defaulter_user_id UUID NOT NULL REFERENCES profiles(id),
    community_id UUID NOT NULL REFERENCES communities(id),

    xnscore_impact INTEGER NOT NULL,
    xnscore_before INTEGER NOT NULL,
    xnscore_after INTEGER NOT NULL,

    voucher_total_vouchee_defaults INTEGER NOT NULL,
    voucher_reliability_status TEXT,
    triggered_restriction BOOLEAN DEFAULT FALSE,

    notified_at TIMESTAMPTZ,
    notification_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CIRCLE DEFAULT RESOLUTIONS TABLE
-- =====================================================
CREATE TABLE circle_default_resolutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,
    cascade_id UUID NOT NULL,
    circle_id UUID NOT NULL REFERENCES circles(id),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id),

    shortfall_amount DECIMAL(12,2) NOT NULL,

    resolution_method TEXT NOT NULL,

    amount_from_reserve DECIMAL(12,2) DEFAULT 0,
    amount_from_redistribution DECIMAL(12,2) DEFAULT 0,
    amount_reduced_from_payout DECIMAL(12,2) DEFAULT 0,

    redistribution_request_id UUID REFERENCES redistribution_requests(id),
    members_who_contributed INTEGER DEFAULT 0,

    recipient_user_id UUID NOT NULL REFERENCES profiles(id),
    original_payout_amount DECIMAL(12,2) NOT NULL,
    actual_payout_amount DECIMAL(12,2) NOT NULL,
    payout_reduction DECIMAL(12,2) DEFAULT 0,

    resolution_status TEXT NOT NULL DEFAULT 'pending',
    resolved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- RECOVERY PLAN INSTALLMENTS TABLE
-- =====================================================
CREATE TABLE recovery_plan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    recovery_plan_id UUID NOT NULL REFERENCES recovery_plans(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,

    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,

    installment_status TEXT NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    paid_amount DECIMAL(12,2),
    payment_reference TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(recovery_plan_id, installment_number)
);

-- =====================================================
-- SUSPENSION REVIEWS TABLE
-- =====================================================
CREATE TABLE suspension_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    trigger_default_id UUID NOT NULL REFERENCES defaults(id),

    reason TEXT NOT NULL,
    metrics JSONB NOT NULL,

    review_status TEXT NOT NULL DEFAULT 'pending',

    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    decision_notes TEXT,

    suspension_duration_days INTEGER,
    suspension_ends_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MEMBER DEBTS TABLE
-- =====================================================
CREATE TABLE member_debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    original_default_id UUID REFERENCES defaults(id),

    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,

    amount_paid DECIMAL(12,2) DEFAULT 0,

    debt_status TEXT NOT NULL DEFAULT 'outstanding',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CASCADE EVENTS TABLE - Audit trail
-- =====================================================
CREATE TABLE cascade_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    cascade_id UUID NOT NULL,
    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,

    target_user_id UUID REFERENCES profiles(id),
    target_type TEXT,

    details JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ENHANCE EXISTING TABLES
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'member_default_policy') THEN
        ALTER TABLE circles ADD COLUMN member_default_policy TEXT DEFAULT 'warn_only';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'has_active_default') THEN
        ALTER TABLE circle_members ADD COLUMN has_active_default BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'last_default_at') THEN
        ALTER TABLE circle_members ADD COLUMN last_default_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'scrutiny_level') THEN
        ALTER TABLE circle_members ADD COLUMN scrutiny_level TEXT DEFAULT 'normal';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'requires_balance_check') THEN
        ALTER TABLE circle_members ADD COLUMN requires_balance_check BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'removed_due_to_default_id') THEN
        ALTER TABLE circle_members ADD COLUMN removed_due_to_default_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'has_active_restrictions') THEN
        ALTER TABLE profiles ADD COLUMN has_active_restrictions BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'restriction_count') THEN
        ALTER TABLE profiles ADD COLUMN restriction_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'is_repeat_offender') THEN
        ALTER TABLE profiles ADD COLUMN is_repeat_offender BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'total_defaults') THEN
        ALTER TABLE profiles ADD COLUMN total_defaults INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vouches' AND column_name = 'vouchee_default_count') THEN
        ALTER TABLE vouches ADD COLUMN vouchee_default_count INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'vouches' AND column_name = 'last_vouchee_default_at') THEN
        ALTER TABLE vouches ADD COLUMN last_vouchee_default_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- INDEXES (using unique names)
-- =====================================================
CREATE INDEX idx_dch_def_user ON defaults(user_id);
CREATE INDEX idx_dch_def_circle ON defaults(circle_id);
CREATE INDEX idx_dch_def_community ON defaults(community_id);
CREATE INDEX idx_dch_def_status ON defaults(default_status);
CREATE INDEX idx_dch_def_cascade ON defaults(cascade_id);
CREATE INDEX idx_dch_def_unresolved ON defaults(user_id, default_status)
    WHERE default_status = 'unresolved';

CREATE INDEX idx_dch_vdi_voucher ON voucher_default_impacts(voucher_user_id);
CREATE INDEX idx_dch_vdi_default ON voucher_default_impacts(default_id);
CREATE INDEX idx_dch_vdi_cascade ON voucher_default_impacts(cascade_id);

CREATE INDEX idx_dch_cdr_default ON circle_default_resolutions(default_id);
CREATE INDEX idx_dch_cdr_circle ON circle_default_resolutions(circle_id);
CREATE INDEX idx_dch_cdr_recipient ON circle_default_resolutions(recipient_user_id);

CREATE INDEX idx_dch_rp_user ON recovery_plans(user_id);
CREATE INDEX idx_dch_rp_default ON recovery_plans(default_id);
CREATE INDEX idx_dch_rp_status ON recovery_plans(plan_status);

CREATE INDEX idx_dch_rpi_plan ON recovery_plan_installments(recovery_plan_id);
CREATE INDEX idx_dch_rpi_due ON recovery_plan_installments(due_date)
    WHERE installment_status = 'pending';

CREATE INDEX idx_dch_sr_user ON suspension_reviews(user_id);
CREATE INDEX idx_dch_sr_status ON suspension_reviews(review_status);

CREATE INDEX idx_dch_md_user ON member_debts(user_id);
CREATE INDEX idx_dch_md_status ON member_debts(debt_status);

CREATE INDEX idx_dch_ce_cascade ON cascade_events(cascade_id);
CREATE INDEX idx_dch_ce_default ON cascade_events(default_id);
CREATE INDEX idx_dch_ce_type ON cascade_events(event_type);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_default_impacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_default_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspension_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cascade_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "dch_def_select" ON defaults
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = defaults.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
    );

CREATE POLICY "dch_vdi_select" ON voucher_default_impacts
    FOR SELECT USING (
        voucher_user_id = auth.uid() OR defaulter_user_id = auth.uid()
    );

CREATE POLICY "dch_cdr_select" ON circle_default_resolutions
    FOR SELECT USING (
        recipient_user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM circle_members WHERE circle_id = circle_default_resolutions.circle_id AND user_id = auth.uid())
    );

CREATE POLICY "dch_rp_select" ON recovery_plans
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "dch_rpi_select" ON recovery_plan_installments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM recovery_plans WHERE id = recovery_plan_installments.recovery_plan_id AND user_id = auth.uid())
    );

CREATE POLICY "dch_sr_select" ON suspension_reviews
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "dch_md_select" ON member_debts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "dch_ce_select" ON cascade_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM defaults d
            WHERE d.id = cascade_events.default_id
            AND (
                d.user_id = auth.uid() OR
                EXISTS (SELECT 1 FROM circle_members WHERE circle_id = d.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
            )
        )
    );

-- =====================================================
-- FUNCTIONS
-- =====================================================

CREATE FUNCTION check_repeat_offender(p_user_id UUID)
RETURNS TABLE (
    is_repeat_offender BOOLEAN,
    total_defaults INTEGER,
    defaults_last_12_months INTEGER,
    unresolved_defaults INTEGER,
    requires_suspension_review BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) >= 2 FROM defaults WHERE user_id = p_user_id),
        (SELECT COUNT(*)::INTEGER FROM defaults WHERE user_id = p_user_id),
        (SELECT COUNT(*)::INTEGER FROM defaults WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '12 months'),
        (SELECT COUNT(*)::INTEGER FROM defaults WHERE user_id = p_user_id AND default_status = 'unresolved'),
        (
            (SELECT COUNT(*) >= 3 FROM defaults WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '12 months') OR
            (SELECT COUNT(*) >= 2 FROM defaults WHERE user_id = p_user_id AND default_status = 'unresolved') OR
            (SELECT COUNT(*) >= 5 FROM defaults WHERE user_id = p_user_id)
        );
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION calculate_voucher_reliability(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_total_vouchee_defaults INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_vouchee_defaults
    FROM voucher_default_impacts
    WHERE voucher_user_id = p_user_id;

    IF v_total_vouchee_defaults >= 5 THEN
        RETURN 'restricted';
    ELSIF v_total_vouchee_defaults >= 3 THEN
        RETURN 'poor';
    ELSIF v_total_vouchee_defaults >= 2 THEN
        RETURN 'warning';
    ELSE
        RETURN 'good';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION get_default_cascade_summary(p_cascade_id UUID)
RETURNS TABLE (
    default_id UUID,
    defaulter_name TEXT,
    total_owed DECIMAL,
    amount_recovered DECIMAL,
    default_status TEXT,
    vouchers_impacted INTEGER,
    resolution_method TEXT,
    payout_reduction DECIMAL,
    recovery_plan_status TEXT,
    cascade_completed BOOLEAN,
    events_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        p.full_name,
        d.total_owed,
        d.amount_recovered,
        d.default_status,
        d.voucher_impacts_applied,
        cdr.resolution_method,
        cdr.payout_reduction,
        rp.plan_status,
        d.cascade_completed,
        (SELECT COUNT(*)::INTEGER FROM cascade_events WHERE cascade_id = p_cascade_id)
    FROM defaults d
    JOIN profiles p ON d.user_id = p.id
    LEFT JOIN circle_default_resolutions cdr ON d.id = cdr.default_id
    LEFT JOIN recovery_plans rp ON d.recovery_plan_id = rp.id
    WHERE d.cascade_id = p_cascade_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_defaults_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_defaults_updated
    BEFORE UPDATE ON defaults
    FOR EACH ROW EXECUTE FUNCTION update_defaults_timestamp();

CREATE TRIGGER trg_recovery_plans_updated
    BEFORE UPDATE ON recovery_plans
    FOR EACH ROW EXECUTE FUNCTION update_defaults_timestamp();

CREATE TRIGGER trg_suspension_reviews_updated
    BEFORE UPDATE ON suspension_reviews
    FOR EACH ROW EXECUTE FUNCTION update_defaults_timestamp();

CREATE TRIGGER trg_member_debts_updated
    BEFORE UPDATE ON member_debts
    FOR EACH ROW EXECUTE FUNCTION update_defaults_timestamp();

-- =====================================================
-- VIEWS
-- =====================================================

CREATE VIEW v_active_cascades AS
SELECT
    d.id as default_id,
    d.cascade_id,
    p.email as defaulter_email,
    p.full_name as defaulter_name,
    c.name as circle_name,
    d.total_owed,
    d.amount_recovered,
    d.default_status,
    d.cascade_completed,
    d.created_at,
    COUNT(ce.id) as cascade_events_count
FROM defaults d
JOIN profiles p ON d.user_id = p.id
JOIN circles c ON d.circle_id = c.id
LEFT JOIN cascade_events ce ON d.cascade_id = ce.cascade_id
WHERE d.created_at >= NOW() - INTERVAL '30 days'
GROUP BY d.id, p.email, p.full_name, c.name
ORDER BY d.created_at DESC;

CREATE VIEW v_voucher_impact_summary AS
SELECT
    p.id as voucher_id,
    p.email,
    p.full_name,
    COUNT(vdi.id) as vouchees_defaulted,
    SUM(vdi.xnscore_impact) as total_xnscore_impact,
    MAX(vdi.voucher_reliability_status) as current_status,
    BOOL_OR(vdi.triggered_restriction) as has_restriction
FROM voucher_default_impacts vdi
JOIN profiles p ON vdi.voucher_user_id = p.id
GROUP BY p.id, p.email, p.full_name
HAVING COUNT(vdi.id) >= 1
ORDER BY COUNT(vdi.id) DESC;

CREATE VIEW v_recovery_performance AS
SELECT
    plan_status,
    COUNT(*) as count,
    SUM(total_debt) as total_debt,
    SUM(amount_paid) as total_recovered,
    ROUND(SUM(amount_paid) / NULLIF(SUM(total_debt), 0) * 100, 2) as recovery_rate
FROM recovery_plans
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY plan_status;

CREATE VIEW v_circle_resolution_stats AS
SELECT
    resolution_method,
    COUNT(*) as count,
    SUM(shortfall_amount) as total_shortfall,
    SUM(amount_from_reserve) as from_reserve,
    SUM(amount_from_redistribution) as from_redistribution,
    SUM(amount_reduced_from_payout) as reduced_payouts,
    AVG(payout_reduction) as avg_payout_reduction
FROM circle_default_resolutions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY resolution_method
ORDER BY count DESC;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT ON defaults TO authenticated;
GRANT SELECT ON voucher_default_impacts TO authenticated;
GRANT SELECT ON circle_default_resolutions TO authenticated;
GRANT SELECT ON recovery_plans TO authenticated;
GRANT SELECT ON recovery_plan_installments TO authenticated;
GRANT SELECT ON suspension_reviews TO authenticated;
GRANT SELECT ON member_debts TO authenticated;
GRANT SELECT ON cascade_events TO authenticated;
GRANT SELECT ON v_active_cascades TO authenticated;
GRANT SELECT ON v_voucher_impact_summary TO authenticated;
GRANT SELECT ON v_recovery_performance TO authenticated;
GRANT SELECT ON v_circle_resolution_stats TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE defaults IS 'Main record for each default event in a circle';
COMMENT ON TABLE voucher_default_impacts IS 'Tracks XnScore and status impacts on vouchers when their vouchees default';
COMMENT ON TABLE circle_default_resolutions IS 'Records how each circle handled the shortfall from a default';
COMMENT ON TABLE recovery_plans IS 'Payment plans for defaulters to repay their debt and recover XnScore';
COMMENT ON TABLE recovery_plan_installments IS 'Individual payment schedule for recovery plans';
COMMENT ON TABLE suspension_reviews IS 'Reviews triggered for repeat offenders';
COMMENT ON TABLE member_debts IS 'Outstanding debts when members are removed after receiving payout';
COMMENT ON TABLE cascade_events IS 'Complete audit trail of all cascade actions';
COMMENT ON FUNCTION check_repeat_offender(UUID) IS 'Check if user qualifies as repeat offender and needs suspension review';
COMMENT ON FUNCTION calculate_voucher_reliability(UUID) IS 'Calculate voucher reliability status based on vouchee defaults';
COMMENT ON FUNCTION get_default_cascade_summary(UUID) IS 'Get comprehensive summary of a default cascade';
