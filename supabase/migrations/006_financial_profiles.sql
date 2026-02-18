-- ============================================================================
-- 006_financial_profiles.sql
-- Financial profile system for affordability checks
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FINANCIAL PROFILES TABLE
-- Stores user financial information for affordability calculations
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Income Information
    monthly_income DECIMAL(12,2) DEFAULT 0,
    income_source VARCHAR(50) DEFAULT 'self_reported' CHECK (income_source IN ('self_reported', 'plaid_verified', 'employer_verified')),
    income_verified_at TIMESTAMPTZ,
    income_currency VARCHAR(3) DEFAULT 'USD',

    -- Employment
    employment_status VARCHAR(50) CHECK (employment_status IN ('employed', 'self_employed', 'unemployed', 'retired', 'student', 'other')),
    employer_name VARCHAR(255),
    job_title VARCHAR(255),
    employment_start_date DATE,

    -- Additional Financial Info
    has_emergency_fund BOOLEAN DEFAULT false,
    emergency_fund_months INTEGER DEFAULT 0, -- How many months of expenses covered
    dependents INTEGER DEFAULT 0,

    -- Housing
    housing_status VARCHAR(50) CHECK (housing_status IN ('own', 'rent', 'live_with_family', 'other')),
    monthly_housing_cost DECIMAL(10,2) DEFAULT 0,

    -- Plaid Integration (if connected)
    plaid_access_token TEXT, -- Encrypted
    plaid_item_id VARCHAR(255),
    plaid_last_synced_at TIMESTAMPTZ,

    -- Affordability Limits (can be manually set by admin or auto-calculated)
    max_obligation_ratio DECIMAL(4,3) DEFAULT 0.30, -- Max % of income for circles
    manual_limit_override DECIMAL(12,2), -- Admin can set manual limit
    limit_override_reason TEXT,
    limit_override_by UUID REFERENCES auth.users(id),
    limit_override_at TIMESTAMPTZ,

    -- Risk Assessment
    risk_score INTEGER DEFAULT 50 CHECK (risk_score >= 0 AND risk_score <= 100),
    last_risk_assessment_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_financial_profile UNIQUE (user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_financial_profiles_user_id ON financial_profiles(user_id);

-- ============================================================================
-- INCOME VERIFICATION LOG
-- Track income verification attempts and history
-- ============================================================================

CREATE TABLE IF NOT EXISTS income_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Verification Details
    verification_method VARCHAR(50) NOT NULL CHECK (verification_method IN ('plaid', 'paystub', 'tax_return', 'employer_letter', 'bank_statement', 'manual_review')),
    verification_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'expired')),

    -- Income Data
    reported_income DECIMAL(12,2) NOT NULL,
    verified_income DECIMAL(12,2),
    income_frequency VARCHAR(20) DEFAULT 'monthly',

    -- Documents (if applicable)
    document_urls TEXT[], -- Array of document URLs

    -- Review
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,

    -- Expiry
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ, -- Income verification expires after some time

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_verifications_user_id ON income_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_income_verifications_status ON income_verifications(verification_status);

-- ============================================================================
-- AFFORDABILITY CHECKS LOG
-- Track all affordability checks for auditing and analytics
-- ============================================================================

CREATE TABLE IF NOT EXISTS affordability_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,

    -- Check Details
    check_type VARCHAR(50) DEFAULT 'circle_join' CHECK (check_type IN ('circle_join', 'circle_increase', 'manual_review', 'periodic_review')),

    -- Input Values
    monthly_income_used DECIMAL(12,2) NOT NULL,
    income_was_verified BOOLEAN DEFAULT false,
    current_obligations DECIMAL(12,2) NOT NULL,
    proposed_obligation DECIMAL(12,2) NOT NULL,

    -- Calculated Values
    current_ratio DECIMAL(5,4),
    proposed_ratio DECIMAL(5,4),
    max_allowed_ratio DECIMAL(5,4),

    -- Result
    result VARCHAR(20) NOT NULL CHECK (result IN ('approved', 'denied', 'warning')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

    -- Details
    reasons TEXT[],
    warnings TEXT[],
    recommendations TEXT[],

    -- Override (if admin approved despite failing)
    was_overridden BOOLEAN DEFAULT false,
    override_by UUID REFERENCES auth.users(id),
    override_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affordability_checks_user_id ON affordability_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_affordability_checks_circle_id ON affordability_checks(circle_id);
CREATE INDEX IF NOT EXISTS idx_affordability_checks_created_at ON affordability_checks(created_at);

-- ============================================================================
-- ADD FINANCIAL FIELDS TO PROFILES TABLE (if not exists)
-- ============================================================================

DO $$
BEGIN
    -- Add monthly_income column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'monthly_income') THEN
        ALTER TABLE profiles ADD COLUMN monthly_income DECIMAL(12,2);
    END IF;

    -- Add income_source column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'income_source') THEN
        ALTER TABLE profiles ADD COLUMN income_source VARCHAR(50) DEFAULT 'self_reported';
    END IF;

    -- Add employment_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'employment_status') THEN
        ALTER TABLE profiles ADD COLUMN employment_status VARCHAR(50);
    END IF;
END $$;

-- ============================================================================
-- FUNCTION: Calculate user's current monthly obligations
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_user_obligations(p_user_id UUID)
RETURNS DECIMAL(12,2) AS $$
DECLARE
    total_obligations DECIMAL(12,2) := 0;
BEGIN
    SELECT COALESCE(SUM(
        CASE c.frequency
            WHEN 'weekly' THEN c.amount * 4.33
            WHEN 'biweekly' THEN c.amount * 2.17
            WHEN 'monthly' THEN c.amount
            ELSE c.amount
        END
    ), 0)
    INTO total_obligations
    FROM circle_members cm
    JOIN circles c ON c.id = cm.circle_id
    WHERE cm.user_id = p_user_id
      AND cm.status IN ('active', 'pending')
      AND c.status IN ('active', 'pending', 'forming');

    RETURN total_obligations;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Quick affordability check (can be called from RPC)
-- Returns: can_afford, score, risk_level, max_affordable
-- ============================================================================

CREATE OR REPLACE FUNCTION check_affordability_quick(
    p_user_id UUID,
    p_circle_amount DECIMAL(12,2),
    p_frequency VARCHAR(20) DEFAULT 'monthly'
)
RETURNS TABLE (
    can_afford BOOLEAN,
    score INTEGER,
    risk_level VARCHAR(20),
    current_ratio DECIMAL(5,4),
    proposed_ratio DECIMAL(5,4),
    max_affordable DECIMAL(12,2),
    reason TEXT
) AS $$
DECLARE
    v_monthly_income DECIMAL(12,2);
    v_income_source VARCHAR(50);
    v_adjusted_income DECIMAL(12,2);
    v_current_obligations DECIMAL(12,2);
    v_new_obligation DECIMAL(12,2);
    v_total_obligations DECIMAL(12,2);
    v_current_ratio DECIMAL(5,4);
    v_proposed_ratio DECIMAL(5,4);
    v_max_ratio DECIMAL(5,4) := 0.30; -- Default max ratio
    v_can_afford BOOLEAN;
    v_score INTEGER;
    v_risk_level VARCHAR(20);
    v_max_affordable DECIMAL(12,2);
    v_reason TEXT;
BEGIN
    -- Get user's income
    SELECT COALESCE(fp.monthly_income, p.monthly_income, 0),
           COALESCE(fp.income_source, p.income_source, 'self_reported')
    INTO v_monthly_income, v_income_source
    FROM profiles p
    LEFT JOIN financial_profiles fp ON fp.user_id = p.id
    WHERE p.id = p_user_id;

    -- Check if income is available
    IF v_monthly_income IS NULL OR v_monthly_income = 0 THEN
        RETURN QUERY SELECT
            false::BOOLEAN,
            0::INTEGER,
            'critical'::VARCHAR(20),
            0::DECIMAL(5,4),
            0::DECIMAL(5,4),
            0::DECIMAL(12,2),
            'No income information available. Please complete your financial profile.'::TEXT;
        RETURN;
    END IF;

    -- Adjust income for unverified sources
    v_adjusted_income := CASE
        WHEN v_income_source = 'self_reported' THEN v_monthly_income * 0.80
        ELSE v_monthly_income
    END;

    -- Get current obligations
    v_current_obligations := calculate_user_obligations(p_user_id);

    -- Calculate new obligation in monthly terms
    v_new_obligation := CASE p_frequency
        WHEN 'weekly' THEN p_circle_amount * 4.33
        WHEN 'biweekly' THEN p_circle_amount * 2.17
        WHEN 'monthly' THEN p_circle_amount
        ELSE p_circle_amount
    END;

    v_total_obligations := v_current_obligations + v_new_obligation;

    -- Calculate ratios
    v_current_ratio := v_current_obligations / v_adjusted_income;
    v_proposed_ratio := v_total_obligations / v_adjusted_income;

    -- Calculate max affordable
    v_max_affordable := GREATEST(0, (v_adjusted_income * v_max_ratio) - v_current_obligations);

    -- Determine result
    IF v_proposed_ratio <= 0.15 THEN
        v_can_afford := true;
        v_risk_level := 'low';
        v_score := 90;
        v_reason := 'Comfortably affordable';
    ELSIF v_proposed_ratio <= 0.20 THEN
        v_can_afford := true;
        v_risk_level := 'medium';
        v_score := 75;
        v_reason := 'Affordable with moderate commitment';
    ELSIF v_proposed_ratio <= v_max_ratio THEN
        v_can_afford := true;
        v_risk_level := 'high';
        v_score := 55;
        v_reason := 'Near maximum recommended obligations';
    ELSE
        v_can_afford := false;
        v_risk_level := 'critical';
        v_score := 30;
        v_reason := 'Exceeds maximum recommended obligations (' || ROUND(v_max_ratio * 100) || '% of income)';
    END IF;

    RETURN QUERY SELECT
        v_can_afford,
        v_score,
        v_risk_level,
        v_current_ratio,
        v_proposed_ratio,
        v_max_affordable,
        v_reason;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Log affordability check
-- ============================================================================

CREATE OR REPLACE FUNCTION log_affordability_check(
    p_user_id UUID,
    p_circle_id UUID,
    p_monthly_income DECIMAL(12,2),
    p_income_verified BOOLEAN,
    p_current_obligations DECIMAL(12,2),
    p_proposed_obligation DECIMAL(12,2),
    p_result VARCHAR(20),
    p_score INTEGER,
    p_risk_level VARCHAR(20),
    p_reasons TEXT[],
    p_warnings TEXT[]
)
RETURNS UUID AS $$
DECLARE
    v_check_id UUID;
BEGIN
    INSERT INTO affordability_checks (
        user_id, circle_id, monthly_income_used, income_was_verified,
        current_obligations, proposed_obligation,
        current_ratio, proposed_ratio,
        result, score, risk_level, reasons, warnings
    ) VALUES (
        p_user_id, p_circle_id, p_monthly_income, p_income_verified,
        p_current_obligations, p_proposed_obligation,
        p_current_obligations / NULLIF(p_monthly_income, 0),
        (p_current_obligations + p_proposed_obligation) / NULLIF(p_monthly_income, 0),
        p_result, p_score, p_risk_level, p_reasons, p_warnings
    )
    RETURNING id INTO v_check_id;

    RETURN v_check_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Financial Profiles RLS
ALTER TABLE financial_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own financial profile" ON financial_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own financial profile" ON financial_profiles
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own financial profile" ON financial_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Income Verifications RLS
ALTER TABLE income_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own verifications" ON income_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own verifications" ON income_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Affordability Checks RLS
ALTER TABLE affordability_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own affordability checks" ON affordability_checks
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger for financial_profiles
CREATE OR REPLACE FUNCTION update_financial_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_financial_profile_timestamp ON financial_profiles;
CREATE TRIGGER trigger_update_financial_profile_timestamp
    BEFORE UPDATE ON financial_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_financial_profile_timestamp();

-- Auto-create financial profile when user profile is created
CREATE OR REPLACE FUNCTION create_financial_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO financial_profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_financial_profile ON profiles;
CREATE TRIGGER trigger_create_financial_profile
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_financial_profile_for_user();

-- ============================================================================
-- SAMPLE DATA FOR TESTING (commented out for production)
-- ============================================================================

/*
-- Insert test financial profile
INSERT INTO financial_profiles (
    user_id,
    monthly_income,
    income_source,
    employment_status,
    has_emergency_fund,
    dependents
) VALUES (
    '35545a5f-b71b-46a0-a2de-ad56228dd4cf', -- Replace with actual user ID
    4500.00,
    'self_reported',
    'employed',
    true,
    1
) ON CONFLICT (user_id) DO UPDATE SET
    monthly_income = EXCLUDED.monthly_income,
    employment_status = EXCLUDED.employment_status;
*/

-- ============================================================================
-- GRANTS (if needed for service role)
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION calculate_user_obligations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_affordability_quick(UUID, DECIMAL, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION log_affordability_check(UUID, UUID, DECIMAL, BOOLEAN, DECIMAL, DECIMAL, VARCHAR, INTEGER, VARCHAR, TEXT[], TEXT[]) TO authenticated;
