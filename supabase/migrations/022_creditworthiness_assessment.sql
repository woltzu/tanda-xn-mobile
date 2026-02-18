-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 022: Creditworthiness Assessment System
-- ══════════════════════════════════════════════════════════════════════════════
-- Serving the credit invisible with behavioral-based lending.
--
-- THE FIVE PILLARS OF CREDITWORTHINESS:
-- 1. XnScore (40% of decision) - Foundational trust score → Credit Score 300-850
-- 2. Circle Health (15%) - Quality of circles user participates in
-- 3. Loan History (20%) - Previous loan performance on TandaXn
-- 4. Capacity (Determines MAX AMOUNT) - Contribution history, wallet, savings
-- 5. Community Collateral (Adjusts APR) - Vouches, elder guarantee, co-signer
--
-- RISK GRADES:
-- A (740-850): Low Risk, 5-8% APR, Max $10,000
-- B (630-739): Moderate Risk, 8-12% APR, Max $5,000
-- C (520-629): Acceptable Risk, 12-18% APR, Max $2,000
-- D (410-519): High Risk, 18-24% APR, Max $500
-- E (<410): Ineligible
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop existing objects if partial migration occurred               │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_loan_portfolio_summary CASCADE;
DROP VIEW IF EXISTS v_active_loans_dashboard CASCADE;
DROP VIEW IF EXISTS v_creditworthiness_summary CASCADE;
DROP VIEW IF EXISTS v_loan_applications_pending CASCADE;
DROP VIEW IF EXISTS v_guarantor_exposure CASCADE;

DROP FUNCTION IF EXISTS assess_creditworthiness(UUID, INTEGER, INTEGER, TEXT, TEXT, UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_xnscore_credit_score(DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS calculate_circle_health_adjustment(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_loan_history_adjustment(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_capacity(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_community_collateral(UUID, UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_risk_grade(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_score_based_limit(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_base_apr(INTEGER, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_repayment(INTEGER, DECIMAL, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_preflight_eligibility(UUID, UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS check_elder_guarantee_capacity(UUID) CASCADE;
DROP FUNCTION IF EXISTS check_cosigner_capacity(UUID) CASCADE;
DROP FUNCTION IF EXISTS check_shared_circle(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_loan_application(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS approve_loan_application(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS disburse_loan(UUID) CASCADE;
DROP FUNCTION IF EXISTS record_loan_payment(UUID, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS process_loan_default(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_payment_schedule(UUID) CASCADE;

DROP TABLE IF EXISTS loan_payments CASCADE;
DROP TABLE IF EXISTS loan_payment_schedule CASCADE;
DROP TABLE IF EXISTS loan_co_signers CASCADE;
DROP TABLE IF EXISTS loan_guarantees CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS loan_applications CASCADE;
DROP TABLE IF EXISTS creditworthiness_assessments CASCADE;
DROP TABLE IF EXISTS loan_products CASCADE;

DROP TYPE IF EXISTS loan_product_purpose CASCADE;
DROP TYPE IF EXISTS risk_grade CASCADE;
DROP TYPE IF EXISTS loan_application_status CASCADE;
DROP TYPE IF EXISTS loan_status CASCADE;
DROP TYPE IF EXISTS payment_schedule_status CASCADE;
DROP TYPE IF EXISTS loan_payment_status CASCADE;
DROP TYPE IF EXISTS guarantee_status CASCADE;
DROP TYPE IF EXISTS cosigner_status CASCADE;
DROP TYPE IF EXISTS credit_recommendation CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE loan_product_purpose AS ENUM (
    'emergency',
    'circle_contribution',
    'education',
    'business',
    'medical',
    'other'
);

CREATE TYPE risk_grade AS ENUM (
    'A', -- 740-850: Low Risk
    'B', -- 630-739: Moderate Risk
    'C', -- 520-629: Acceptable Risk
    'D', -- 410-519: High Risk
    'E'  -- <410: Ineligible
);

CREATE TYPE loan_application_status AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected',
    'accepted',      -- User accepted terms
    'disbursed',
    'cancelled',
    'expired'
);

CREATE TYPE loan_status AS ENUM (
    'active',
    'paid_off',
    'defaulted',
    'written_off',
    'in_collections'
);

CREATE TYPE payment_schedule_status AS ENUM (
    'scheduled',
    'partial',
    'paid',
    'late',
    'missed',
    'waived'
);

CREATE TYPE loan_payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
);

CREATE TYPE guarantee_status AS ENUM (
    'pending',
    'active',
    'released',
    'called',
    'paid'
);

CREATE TYPE cosigner_status AS ENUM (
    'pending',
    'active',
    'released',
    'called',
    'paid'
);

CREATE TYPE credit_recommendation AS ENUM (
    'approve',
    'approve_with_conditions',
    'manual_review',
    'reject'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN PRODUCTS TABLE                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,

    -- Display
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,

    -- Eligibility
    min_xnscore INTEGER NOT NULL,
    min_account_age_days INTEGER NOT NULL,
    min_completed_circles INTEGER DEFAULT 0,

    -- Amounts (in cents)
    min_amount_cents INTEGER NOT NULL,
    max_amount_cents INTEGER NOT NULL,

    -- Terms
    min_term_months INTEGER NOT NULL,
    max_term_months INTEGER NOT NULL,
    allowed_terms INTEGER[] NOT NULL,

    -- Rates
    base_apr_min DECIMAL(5,2) NOT NULL,
    base_apr_max DECIMAL(5,2) NOT NULL,

    -- Fees
    origination_fee_percent DECIMAL(5,2) DEFAULT 0,
    late_fee_flat_cents INTEGER DEFAULT 500,
    late_fee_percent DECIMAL(5,2) DEFAULT 5.00,
    grace_period_days INTEGER DEFAULT 5,

    -- Purpose restrictions
    allowed_purposes loan_product_purpose[] NOT NULL,

    -- Requirements
    requires_elder_guarantee BOOLEAN DEFAULT FALSE,
    requires_cosigner BOOLEAN DEFAULT FALSE,
    min_guarantee_amount_cents INTEGER,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CREDITWORTHINESS ASSESSMENTS TABLE                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE creditworthiness_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Assessment context
    loan_product_id UUID REFERENCES loan_products(id),
    requested_amount_cents INTEGER NOT NULL,
    requested_term_months INTEGER NOT NULL,
    loan_purpose loan_product_purpose NOT NULL,

    -- PILLAR 1: XnScore
    xnscore_at_assessment DECIMAL(5,2) NOT NULL,
    xnscore_base_credit_score INTEGER NOT NULL,

    -- PILLAR 2: Circle Health
    circle_health_score DECIMAL(5,2),
    circle_health_adjustment INTEGER NOT NULL DEFAULT 0,
    avg_circle_risk_score DECIMAL(5,2),
    circles_assessed INTEGER DEFAULT 0,

    -- PILLAR 3: Loan History
    loan_history_score DECIMAL(5,2),
    loan_history_adjustment INTEGER NOT NULL DEFAULT 0,
    loans_repaid_count INTEGER DEFAULT 0,
    loans_defaulted_count INTEGER DEFAULT 0,
    total_late_payments INTEGER DEFAULT 0,
    has_active_delinquency BOOLEAN DEFAULT FALSE,

    -- FINAL CREDIT SCORE
    raw_credit_score INTEGER NOT NULL,
    final_credit_score INTEGER NOT NULL,
    risk_grade risk_grade NOT NULL,

    -- PILLAR 4: Capacity
    contribution_capacity_cents INTEGER NOT NULL DEFAULT 0,
    wallet_capacity_cents INTEGER NOT NULL DEFAULT 0,
    savings_capacity_cents INTEGER NOT NULL DEFAULT 0,
    total_capacity_cents INTEGER NOT NULL DEFAULT 0,
    existing_obligations_cents INTEGER DEFAULT 0,
    score_based_limit_cents INTEGER NOT NULL,
    final_max_amount_cents INTEGER NOT NULL,

    -- PILLAR 5: Community Collateral
    vouch_count INTEGER DEFAULT 0,
    vouch_discount_percent DECIMAL(5,2) DEFAULT 0,
    elder_guarantee_user_id UUID REFERENCES profiles(id),
    elder_guarantee_coverage_percent DECIMAL(5,2),
    elder_guarantee_discount_percent DECIMAL(5,2) DEFAULT 0,
    co_signer_user_id UUID REFERENCES profiles(id),
    co_signer_xnscore DECIMAL(5,2),
    co_signer_discount_percent DECIMAL(5,2) DEFAULT 0,
    total_community_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,

    -- RATES
    base_apr DECIMAL(5,2) NOT NULL,
    final_apr DECIMAL(5,2) NOT NULL,

    -- DECISION
    is_eligible BOOLEAN NOT NULL,
    rejection_reasons TEXT[],
    approved_amount_cents INTEGER,

    -- REPAYMENT CALCULATION
    monthly_payment_cents INTEGER,
    total_interest_cents INTEGER,
    total_repayment_cents INTEGER,

    -- RECOMMENDATION
    system_recommendation credit_recommendation NOT NULL,
    recommended_conditions TEXT[],

    -- Metadata
    assessment_version TEXT DEFAULT 'v1.0',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Audit
    factor_breakdown JSONB NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN APPLICATIONS TABLE                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Link to assessment
    assessment_id UUID NOT NULL REFERENCES creditworthiness_assessments(id),

    -- Loan details
    loan_product_id UUID NOT NULL REFERENCES loan_products(id),
    requested_amount_cents INTEGER NOT NULL,
    approved_amount_cents INTEGER,
    term_months INTEGER NOT NULL,
    purpose loan_product_purpose NOT NULL,
    purpose_description TEXT,

    -- Collateral references
    elder_guarantee_id UUID,
    co_signer_id UUID,

    -- Terms
    apr DECIMAL(5,2) NOT NULL,
    origination_fee_cents INTEGER DEFAULT 0,
    monthly_payment_cents INTEGER NOT NULL,
    total_interest_cents INTEGER NOT NULL,
    total_repayment_cents INTEGER NOT NULL,

    -- Status
    status loan_application_status NOT NULL DEFAULT 'pending',
    status_reason TEXT,

    -- Review
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- User acceptance
    terms_accepted_at TIMESTAMPTZ,
    terms_accepted_ip TEXT,

    -- Disbursement
    disbursed_at TIMESTAMPTZ,
    disbursement_method TEXT,
    disbursement_destination TEXT,

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOANS TABLE                                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Link to application
    application_id UUID NOT NULL REFERENCES loan_applications(id),

    -- Loan details
    loan_product_id UUID NOT NULL REFERENCES loan_products(id),
    principal_cents INTEGER NOT NULL,
    apr DECIMAL(5,2) NOT NULL,
    term_months INTEGER NOT NULL,

    -- Fees
    origination_fee_cents INTEGER DEFAULT 0,

    -- Schedule
    first_payment_date DATE NOT NULL,
    final_payment_date DATE NOT NULL,
    monthly_payment_cents INTEGER NOT NULL,

    -- Balances
    outstanding_principal_cents INTEGER NOT NULL,
    outstanding_interest_cents INTEGER NOT NULL DEFAULT 0,
    outstanding_fees_cents INTEGER DEFAULT 0,
    total_outstanding_cents INTEGER NOT NULL,

    -- Payment tracking
    payments_made INTEGER DEFAULT 0,
    payments_total INTEGER NOT NULL,
    next_payment_date DATE,
    next_payment_amount_cents INTEGER,

    -- Delinquency
    days_past_due INTEGER DEFAULT 0,
    is_delinquent BOOLEAN DEFAULT FALSE,
    delinquent_since DATE,

    -- Status
    status loan_status NOT NULL DEFAULT 'active',

    -- Closure
    closed_at TIMESTAMPTZ,
    closed_reason TEXT,

    -- Collateral references
    elder_guarantee_id UUID,
    co_signer_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN PAYMENT SCHEDULE TABLE                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_payment_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,

    payment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,

    -- Amounts due
    principal_due_cents INTEGER NOT NULL,
    interest_due_cents INTEGER NOT NULL,
    fees_due_cents INTEGER DEFAULT 0,
    total_due_cents INTEGER NOT NULL,

    -- Amounts paid
    principal_paid_cents INTEGER DEFAULT 0,
    interest_paid_cents INTEGER DEFAULT 0,
    fees_paid_cents INTEGER DEFAULT 0,
    total_paid_cents INTEGER DEFAULT 0,

    -- Status
    status payment_schedule_status NOT NULL DEFAULT 'scheduled',

    paid_at TIMESTAMPTZ,

    -- Late fees
    late_fee_cents INTEGER DEFAULT 0,
    late_fee_waived BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_loan_payment_number UNIQUE(loan_id, payment_number)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN PAYMENTS TABLE                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Schedule reference
    schedule_id UUID REFERENCES loan_payment_schedule(id),

    -- Amount
    amount_cents INTEGER NOT NULL,

    -- Allocation
    principal_cents INTEGER NOT NULL,
    interest_cents INTEGER NOT NULL,
    fees_cents INTEGER DEFAULT 0,

    -- Payment source
    payment_method TEXT NOT NULL,
    payment_source_id TEXT,

    -- Timing
    was_on_time BOOLEAN NOT NULL,
    days_late INTEGER DEFAULT 0,

    -- Processing
    status loan_payment_status NOT NULL DEFAULT 'pending',

    processed_at TIMESTAMPTZ,
    failure_reason TEXT,

    -- External references
    wallet_transaction_id UUID REFERENCES wallet_transactions(id),
    external_transfer_id TEXT,

    -- XnScore impact
    xnscore_event_triggered BOOLEAN DEFAULT FALSE,
    xnscore_adjustment_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN GUARANTEES TABLE (Elder Guarantees)                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_guarantees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The guarantor (Elder)
    guarantor_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    guarantor_xnscore_at_guarantee DECIMAL(5,2) NOT NULL,

    -- The borrower
    borrower_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Guarantee details
    loan_application_id UUID REFERENCES loan_applications(id),
    loan_id UUID REFERENCES loans(id),

    coverage_percent DECIMAL(5,2) NOT NULL,
    max_liability_cents INTEGER NOT NULL,

    -- Status
    status guarantee_status NOT NULL DEFAULT 'pending',

    -- If guarantee is called (borrower defaults)
    called_at TIMESTAMPTZ,
    called_amount_cents INTEGER,
    paid_at TIMESTAMPTZ,
    paid_amount_cents INTEGER,

    -- Acceptance
    accepted_at TIMESTAMPTZ,
    accepted_ip TEXT,

    -- Release
    released_at TIMESTAMPTZ,
    release_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN CO-SIGNERS TABLE                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE loan_co_signers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The co-signer
    co_signer_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    co_signer_xnscore_at_signing DECIMAL(5,2) NOT NULL,

    -- The primary borrower
    borrower_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Loan reference
    loan_application_id UUID REFERENCES loan_applications(id),
    loan_id UUID REFERENCES loans(id),

    -- Relationship
    relationship_to_borrower TEXT,
    shared_circle_id UUID REFERENCES circles(id),

    -- Liability
    liability_type TEXT NOT NULL DEFAULT 'joint',
    max_liability_cents INTEGER,

    -- Status
    status cosigner_status NOT NULL DEFAULT 'pending',

    -- Acceptance
    accepted_at TIMESTAMPTZ,
    accepted_ip TEXT,

    -- Release
    released_at TIMESTAMPTZ,
    release_reason TEXT,

    -- If called
    called_at TIMESTAMPTZ,
    called_amount_cents INTEGER,
    paid_at TIMESTAMPTZ,
    paid_amount_cents INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_loan_products_code ON loan_products(code);
CREATE INDEX idx_loan_products_active ON loan_products(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_assessments_user ON creditworthiness_assessments(user_id);
CREATE INDEX idx_assessments_created ON creditworthiness_assessments(created_at DESC);
CREATE INDEX idx_assessments_eligible ON creditworthiness_assessments(is_eligible);
CREATE INDEX idx_assessments_expires ON creditworthiness_assessments(expires_at);

CREATE INDEX idx_applications_user ON loan_applications(user_id);
CREATE INDEX idx_applications_status ON loan_applications(status);
CREATE INDEX idx_applications_expires ON loan_applications(expires_at) WHERE status IN ('pending', 'approved');

CREATE INDEX idx_loans_user ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_next_payment ON loans(next_payment_date) WHERE status = 'active';
CREATE INDEX idx_loans_delinquent ON loans(is_delinquent) WHERE is_delinquent = TRUE;

CREATE INDEX idx_payment_schedule_loan ON loan_payment_schedule(loan_id);
CREATE INDEX idx_payment_schedule_due ON loan_payment_schedule(due_date, status);

CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);
CREATE INDEX idx_loan_payments_user ON loan_payments(user_id);
CREATE INDEX idx_loan_payments_status ON loan_payments(status);

CREATE INDEX idx_guarantees_guarantor ON loan_guarantees(guarantor_user_id);
CREATE INDEX idx_guarantees_borrower ON loan_guarantees(borrower_user_id);
CREATE INDEX idx_guarantees_loan ON loan_guarantees(loan_id);
CREATE INDEX idx_guarantees_status ON loan_guarantees(status);

CREATE INDEX idx_cosigners_cosigner ON loan_co_signers(co_signer_user_id);
CREATE INDEX idx_cosigners_borrower ON loan_co_signers(borrower_user_id);
CREATE INDEX idx_cosigners_loan ON loan_co_signers(loan_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SEED LOAN PRODUCTS                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

INSERT INTO loan_products (
    code, name, description, icon,
    min_xnscore, min_account_age_days, min_completed_circles,
    min_amount_cents, max_amount_cents,
    min_term_months, max_term_months, allowed_terms,
    base_apr_min, base_apr_max,
    origination_fee_percent, late_fee_flat_cents, late_fee_percent, grace_period_days,
    allowed_purposes,
    requires_elder_guarantee, requires_cosigner,
    display_order
) VALUES
(
    'micro_emergency',
    'Micro Emergency Loan',
    'Quick cash for urgent needs. Fast approval for trusted members.',
    '🚨',
    40, 90, 0,
    10000, 50000,  -- $100 - $500
    1, 3, '{1,2,3}',
    15.00, 21.00,
    1.00, 500, 5.00, 5,
    '{emergency,medical,other}',
    FALSE, FALSE,
    1
),
(
    'circle_boost',
    'Circle Boost Loan',
    'Catch up on circle contributions. Auto-deducted from your next payout.',
    '🔄',
    50, 120, 1,
    20000, 200000,  -- $200 - $2,000
    3, 6, '{3,6}',
    12.00, 18.00,
    0.50, 500, 5.00, 5,
    '{circle_contribution}',
    FALSE, FALSE,
    2
),
(
    'education',
    'Education Loan',
    'Invest in yourself. School fees, courses, and certifications.',
    '📚',
    60, 180, 1,
    50000, 500000,  -- $500 - $5,000
    6, 12, '{6,9,12}',
    10.00, 15.00,
    0.75, 1000, 5.00, 7,
    '{education}',
    FALSE, FALSE,
    3
),
(
    'small_business',
    'Small Business Loan',
    'Grow your business. Working capital, inventory, and equipment.',
    '💼',
    70, 365, 2,
    100000, 1000000,  -- $1,000 - $10,000
    6, 12, '{6,12}',
    8.00, 12.00,
    1.00, 1500, 5.00, 7,
    '{business}',
    TRUE, FALSE,  -- Requires Elder guarantee for >$5k
    4
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Calculate credit score from XnScore (0-100 → 300-850)
CREATE FUNCTION calculate_xnscore_credit_score(p_xnscore DECIMAL)
RETURNS INTEGER AS $$
BEGIN
    -- Formula: CreditScore = 300 + (XnScore × 5.5)
    RETURN LEAST(850, GREATEST(300, ROUND(300 + (p_xnscore * 5.5))::INTEGER));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get risk grade from credit score
CREATE FUNCTION get_risk_grade(p_credit_score INTEGER)
RETURNS risk_grade AS $$
BEGIN
    RETURN CASE
        WHEN p_credit_score >= 740 THEN 'A'::risk_grade
        WHEN p_credit_score >= 630 THEN 'B'::risk_grade
        WHEN p_credit_score >= 520 THEN 'C'::risk_grade
        WHEN p_credit_score >= 410 THEN 'D'::risk_grade
        ELSE 'E'::risk_grade
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get score-based loan limit
CREATE FUNCTION get_score_based_limit(p_credit_score INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE
        WHEN p_credit_score >= 740 THEN 1000000  -- $10,000
        WHEN p_credit_score >= 630 THEN 500000   -- $5,000
        WHEN p_credit_score >= 520 THEN 200000   -- $2,000
        WHEN p_credit_score >= 410 THEN 50000    -- $500
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get base APR for risk grade
CREATE FUNCTION get_base_apr(
    p_credit_score INTEGER,
    p_risk_grade risk_grade,
    p_loan_product_id UUID DEFAULT NULL
)
RETURNS DECIMAL AS $$
DECLARE
    v_product RECORD;
    v_min_apr DECIMAL;
    v_max_apr DECIMAL;
    v_score_ratio DECIMAL;
BEGIN
    -- Get product-specific rates if available
    IF p_loan_product_id IS NOT NULL THEN
        SELECT * INTO v_product FROM loan_products WHERE id = p_loan_product_id;
        IF FOUND THEN
            v_min_apr := v_product.base_apr_min;
            v_max_apr := v_product.base_apr_max;
        END IF;
    END IF;

    -- Default rates by grade if no product
    IF v_min_apr IS NULL THEN
        v_min_apr := CASE p_risk_grade
            WHEN 'A' THEN 5.00
            WHEN 'B' THEN 8.00
            WHEN 'C' THEN 12.00
            WHEN 'D' THEN 18.00
            ELSE NULL
        END;
        v_max_apr := CASE p_risk_grade
            WHEN 'A' THEN 8.00
            WHEN 'B' THEN 12.00
            WHEN 'C' THEN 18.00
            WHEN 'D' THEN 24.00
            ELSE NULL
        END;
    END IF;

    IF v_min_apr IS NULL THEN
        RETURN NULL; -- Ineligible
    END IF;

    -- Linear interpolation within grade (higher score = lower APR)
    -- For grade A (740-850): at 740, get max APR; at 850, get min APR
    v_score_ratio := CASE p_risk_grade
        WHEN 'A' THEN LEAST(1.0, GREATEST(0, (p_credit_score - 740)::DECIMAL / 110))
        WHEN 'B' THEN LEAST(1.0, GREATEST(0, (p_credit_score - 630)::DECIMAL / 110))
        WHEN 'C' THEN LEAST(1.0, GREATEST(0, (p_credit_score - 520)::DECIMAL / 110))
        WHEN 'D' THEN LEAST(1.0, GREATEST(0, (p_credit_score - 410)::DECIMAL / 110))
        ELSE 0
    END;

    RETURN ROUND(v_max_apr - (v_score_ratio * (v_max_apr - v_min_apr)), 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate monthly payment (amortization)
CREATE FUNCTION calculate_repayment(
    p_principal_cents INTEGER,
    p_apr DECIMAL,
    p_term_months INTEGER
)
RETURNS TABLE (
    monthly_payment_cents INTEGER,
    total_interest_cents INTEGER,
    total_repayment_cents INTEGER
) AS $$
DECLARE
    v_monthly_rate DECIMAL;
    v_monthly_payment DECIMAL;
BEGIN
    v_monthly_rate := p_apr / 100 / 12;

    IF v_monthly_rate = 0 THEN
        monthly_payment_cents := ROUND(p_principal_cents::DECIMAL / p_term_months);
        total_interest_cents := 0;
        total_repayment_cents := p_principal_cents;
    ELSE
        -- Standard amortization formula
        v_monthly_payment := p_principal_cents *
            (v_monthly_rate * POWER(1 + v_monthly_rate, p_term_months)) /
            (POWER(1 + v_monthly_rate, p_term_months) - 1);

        monthly_payment_cents := ROUND(v_monthly_payment);
        total_repayment_cents := monthly_payment_cents * p_term_months;
        total_interest_cents := total_repayment_cents - p_principal_cents;
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PILLAR 2: CIRCLE HEALTH ADJUSTMENT                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_circle_health_adjustment(p_user_id UUID)
RETURNS TABLE (
    score DECIMAL,
    adjustment INTEGER,
    avg_risk_score DECIMAL,
    circle_count INTEGER,
    details JSONB
) AS $$
DECLARE
    v_memberships RECORD;
    v_total_risk DECIMAL := 0;
    v_circle_count INTEGER := 0;
    v_avg_risk DECIMAL;
    v_health_score DECIMAL;
    v_adjustment INTEGER;
BEGIN
    -- Get active circle memberships with their risk scores
    FOR v_memberships IN
        SELECT
            cm.circle_id,
            c.name as circle_name,
            COALESCE(
                (SELECT risk_score FROM circle_risk_assessments
                 WHERE circle_id = cm.circle_id
                 ORDER BY calculated_at DESC LIMIT 1),
                50 -- Default to 50 if no assessment
            ) as risk_score
        FROM circle_members cm
        JOIN circles c ON c.id = cm.circle_id
        WHERE cm.user_id = p_user_id
        AND cm.status = 'active'
    LOOP
        v_total_risk := v_total_risk + v_memberships.risk_score;
        v_circle_count := v_circle_count + 1;
    END LOOP;

    IF v_circle_count = 0 THEN
        -- No active circles - neutral
        RETURN QUERY SELECT
            50::DECIMAL,
            0,
            NULL::DECIMAL,
            0,
            jsonb_build_object('note', 'No active circle memberships')::JSONB;
        RETURN;
    END IF;

    v_avg_risk := v_total_risk / v_circle_count;
    v_health_score := 100 - v_avg_risk; -- Lower risk = higher health

    -- Adjustment: (health - 50) capped at ±50
    v_adjustment := GREATEST(-50, LEAST(50, ROUND(v_health_score - 50)));

    RETURN QUERY SELECT
        ROUND(v_health_score, 2),
        v_adjustment,
        ROUND(v_avg_risk, 2),
        v_circle_count,
        jsonb_build_object(
            'avg_circle_risk', ROUND(v_avg_risk, 2),
            'circle_count', v_circle_count,
            'health_interpretation', CASE
                WHEN v_avg_risk < 30 THEN 'healthy'
                WHEN v_avg_risk < 50 THEN 'average'
                ELSE 'elevated_risk'
            END
        )::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PILLAR 3: LOAN HISTORY ADJUSTMENT                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_loan_history_adjustment(p_user_id UUID)
RETURNS TABLE (
    score DECIMAL,
    adjustment INTEGER,
    repaid_count INTEGER,
    defaulted_count INTEGER,
    late_payments INTEGER,
    has_active_delinquency BOOLEAN,
    details JSONB
) AS $$
DECLARE
    v_loans RECORD;
    v_adjustment INTEGER := 0;
    v_score DECIMAL := 50;
    v_repaid INTEGER := 0;
    v_defaulted INTEGER := 0;
    v_late INTEGER := 0;
    v_early_payoffs INTEGER := 0;
    v_has_delinquency BOOLEAN := FALSE;
    v_total_loans INTEGER := 0;
BEGIN
    -- Aggregate loan history
    SELECT
        COUNT(*) FILTER (WHERE status = 'paid_off'),
        COUNT(*) FILTER (WHERE status = 'defaulted'),
        COUNT(*) FILTER (WHERE closed_reason = 'early_payoff'),
        COUNT(*),
        COALESCE(SUM(
            (SELECT COUNT(*) FROM loan_payments lp
             WHERE lp.loan_id = l.id AND lp.was_on_time = FALSE)
        ), 0),
        EXISTS(SELECT 1 FROM loans WHERE user_id = p_user_id AND status = 'active' AND days_past_due > 0)
    INTO v_repaid, v_defaulted, v_early_payoffs, v_total_loans, v_late, v_has_delinquency
    FROM loans l
    WHERE l.user_id = p_user_id;

    IF v_total_loans = 0 THEN
        -- No loan history - neutral
        RETURN QUERY SELECT
            50::DECIMAL,
            0,
            0,
            0,
            0,
            FALSE,
            jsonb_build_object('note', 'No prior loan history')::JSONB;
        RETURN;
    END IF;

    -- Positive: Loans repaid (+25 each, max +75)
    v_adjustment := v_adjustment + LEAST(75, v_repaid * 25);

    -- Positive: Perfect payment record (+25)
    IF v_late = 0 AND v_repaid > 0 THEN
        v_adjustment := v_adjustment + 25;
    END IF;

    -- Positive: Early payoffs (+10 each, max +30)
    v_adjustment := v_adjustment + LEAST(30, v_early_payoffs * 10);

    -- Negative: Late payments (-15 each)
    v_adjustment := v_adjustment - (v_late * 15);

    -- Negative: Defaults (-50 each)
    v_adjustment := v_adjustment - (v_defaulted * 50);

    -- Cap at ±100
    v_adjustment := GREATEST(-100, LEAST(100, v_adjustment));

    -- Score (0-100)
    v_score := GREATEST(0, LEAST(100, 50 + v_adjustment));

    RETURN QUERY SELECT
        ROUND(v_score, 2),
        v_adjustment,
        v_repaid,
        v_defaulted,
        v_late::INTEGER,
        v_has_delinquency,
        jsonb_build_object(
            'total_loans', v_total_loans,
            'early_payoffs', v_early_payoffs,
            'interpretation', CASE
                WHEN v_adjustment > 50 THEN 'excellent'
                WHEN v_adjustment > 0 THEN 'good'
                WHEN v_adjustment = 0 THEN 'neutral'
                WHEN v_adjustment > -50 THEN 'concerning'
                ELSE 'poor'
            END
        )::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PILLAR 4: CAPACITY CALCULATION                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION calculate_capacity(p_user_id UUID)
RETURNS TABLE (
    contribution_capacity_cents INTEGER,
    wallet_capacity_cents INTEGER,
    savings_capacity_cents INTEGER,
    total_capacity_cents INTEGER,
    existing_obligations_cents INTEGER,
    net_capacity_cents INTEGER,
    details JSONB
) AS $$
DECLARE
    v_avg_contribution DECIMAL;
    v_contribution_count INTEGER;
    v_wallet_balance INTEGER;
    v_flexible_savings INTEGER;
    v_locked_savings INTEGER;
    v_active_loan_obligations INTEGER;

    v_contribution_cap INTEGER;
    v_wallet_cap INTEGER;
    v_savings_cap INTEGER;
    v_total_cap INTEGER;
    v_net_cap INTEGER;
BEGIN
    -- A. Contribution history (last 6 months)
    SELECT
        COALESCE(AVG(amount), 0),
        COUNT(*)
    INTO v_avg_contribution, v_contribution_count
    FROM contributions
    WHERE user_id = p_user_id
    AND status IN ('completed', 'late')
    AND paid_at >= now() - INTERVAL '6 months';

    -- Contribution capacity = avg × 3 months runway
    v_contribution_cap := ROUND(v_avg_contribution * 3);

    -- B. Wallet balance
    SELECT COALESCE(available_balance, 0)
    INTO v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id;

    -- Wallet capacity = 50% of balance
    v_wallet_cap := ROUND(v_wallet_balance * 0.5);

    -- C. Savings goals
    SELECT
        COALESCE(SUM(CASE WHEN goal_type != 'locked' THEN current_balance ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN goal_type = 'locked' THEN current_balance ELSE 0 END), 0)
    INTO v_flexible_savings, v_locked_savings
    FROM savings_goals
    WHERE user_id = p_user_id AND is_active = TRUE;

    -- Savings capacity = flexible × 50% + locked × 25%
    v_savings_cap := ROUND((v_flexible_savings * 0.5) + (v_locked_savings * 0.25));

    -- Total capacity
    v_total_cap := v_contribution_cap + v_wallet_cap + v_savings_cap;

    -- Existing obligations
    SELECT COALESCE(SUM(outstanding_principal_cents), 0)
    INTO v_active_loan_obligations
    FROM loans
    WHERE user_id = p_user_id AND status = 'active';

    -- Net capacity (reduce by 50% of existing obligations)
    v_net_cap := GREATEST(0, v_total_cap - ROUND(v_active_loan_obligations * 0.5));

    RETURN QUERY SELECT
        v_contribution_cap,
        v_wallet_cap,
        v_savings_cap,
        v_total_cap,
        v_active_loan_obligations,
        v_net_cap,
        jsonb_build_object(
            'avg_monthly_contribution', ROUND(v_avg_contribution / 100, 2),
            'contribution_months_analyzed', v_contribution_count,
            'wallet_balance', ROUND(v_wallet_balance::DECIMAL / 100, 2),
            'flexible_savings', ROUND(v_flexible_savings::DECIMAL / 100, 2),
            'locked_savings', ROUND(v_locked_savings::DECIMAL / 100, 2),
            'active_loan_debt', ROUND(v_active_loan_obligations::DECIMAL / 100, 2)
        )::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PILLAR 5: COMMUNITY COLLATERAL                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Check Elder guarantee capacity
CREATE FUNCTION check_elder_guarantee_capacity(p_elder_user_id UUID)
RETURNS TABLE (
    can_guarantee BOOLEAN,
    active_guarantees INTEGER,
    total_guaranteed_cents INTEGER,
    remaining_capacity_cents INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_active INTEGER;
    v_total_guaranteed INTEGER;
    v_max_guarantees INTEGER := 3;
    v_max_guaranteed INTEGER := 500000; -- $5,000
BEGIN
    SELECT COUNT(*), COALESCE(SUM(max_liability_cents), 0)
    INTO v_active, v_total_guaranteed
    FROM loan_guarantees
    WHERE guarantor_user_id = p_elder_user_id
    AND status = 'active';

    IF v_active >= v_max_guarantees THEN
        RETURN QUERY SELECT
            FALSE, v_active, v_total_guaranteed,
            0,
            'Maximum of 3 active guarantees reached';
        RETURN;
    END IF;

    IF v_total_guaranteed >= v_max_guaranteed THEN
        RETURN QUERY SELECT
            FALSE, v_active, v_total_guaranteed,
            0,
            'Maximum guarantee amount ($5,000) reached';
        RETURN;
    END IF;

    RETURN QUERY SELECT
        TRUE, v_active, v_total_guaranteed,
        v_max_guaranteed - v_total_guaranteed,
        'Eligible to guarantee';
END;
$$ LANGUAGE plpgsql STABLE;

-- Check co-signer capacity
CREATE FUNCTION check_cosigner_capacity(p_cosigner_user_id UUID)
RETURNS TABLE (
    can_cosign BOOLEAN,
    active_cosigns INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_active INTEGER;
    v_max_cosigns INTEGER := 2;
BEGIN
    SELECT COUNT(*)
    INTO v_active
    FROM loan_co_signers
    WHERE co_signer_user_id = p_cosigner_user_id
    AND status = 'active';

    IF v_active >= v_max_cosigns THEN
        RETURN QUERY SELECT FALSE, v_active, 'Maximum of 2 active co-signs reached';
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_active, 'Eligible to co-sign';
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if two users share a circle
CREATE FUNCTION check_shared_circle(p_user1 UUID, p_user2 UUID)
RETURNS UUID AS $$
DECLARE
    v_circle_id UUID;
BEGIN
    SELECT cm1.circle_id INTO v_circle_id
    FROM circle_members cm1
    JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = p_user1
    AND cm2.user_id = p_user2
    AND cm1.status = 'active'
    AND cm2.status = 'active'
    LIMIT 1;

    RETURN v_circle_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate community collateral discount
CREATE FUNCTION calculate_community_collateral(
    p_user_id UUID,
    p_elder_guarantee_user_id UUID,
    p_cosigner_user_id UUID,
    p_approved_amount_cents INTEGER
)
RETURNS TABLE (
    vouch_count INTEGER,
    vouch_discount DECIMAL,
    elder_xnscore DECIMAL,
    elder_coverage_percent DECIMAL,
    elder_discount DECIMAL,
    cosigner_xnscore DECIMAL,
    cosigner_discount DECIMAL,
    total_discount DECIMAL,
    details JSONB
) AS $$
DECLARE
    v_vouches INTEGER;
    v_vouch_discount DECIMAL := 0;
    v_elder_score DECIMAL;
    v_elder_coverage DECIMAL := 0;
    v_elder_discount DECIMAL := 0;
    v_elder_capacity RECORD;
    v_cosigner_score DECIMAL;
    v_cosigner_discount DECIMAL := 0;
    v_cosigner_capacity RECORD;
    v_shared_circle UUID;
    v_total_discount DECIMAL;
    v_max_discount DECIMAL := 7.0; -- Maximum 7% APR discount
BEGIN
    -- A. Vouch discount (max -2% APR)
    SELECT COUNT(DISTINCT voucher_user_id) INTO v_vouches
    FROM vouches
    WHERE vouchee_user_id = p_user_id AND vouch_status = 'active';

    IF v_vouches >= 10 THEN v_vouch_discount := 2.0;
    ELSIF v_vouches >= 6 THEN v_vouch_discount := 1.0;
    ELSIF v_vouches >= 3 THEN v_vouch_discount := 0.5;
    END IF;

    -- B. Elder guarantee discount (max -3% APR)
    IF p_elder_guarantee_user_id IS NOT NULL THEN
        SELECT total_score INTO v_elder_score
        FROM xn_scores WHERE user_id = p_elder_guarantee_user_id;

        -- Elder must have XnScore >= 80
        IF v_elder_score IS NOT NULL AND v_elder_score >= 80 THEN
            SELECT * INTO v_elder_capacity FROM check_elder_guarantee_capacity(p_elder_guarantee_user_id);

            IF v_elder_capacity.can_guarantee THEN
                -- Default 50% coverage
                v_elder_coverage := 50;

                IF v_elder_coverage >= 100 THEN v_elder_discount := 3.0;
                ELSIF v_elder_coverage >= 50 THEN v_elder_discount := 2.0;
                ELSIF v_elder_coverage >= 25 THEN v_elder_discount := 1.0;
                END IF;
            END IF;
        END IF;
    END IF;

    -- C. Co-signer discount (max -1.5% APR)
    IF p_cosigner_user_id IS NOT NULL THEN
        SELECT total_score INTO v_cosigner_score
        FROM xn_scores WHERE user_id = p_cosigner_user_id;

        -- Co-signer must have XnScore >= 60
        IF v_cosigner_score IS NOT NULL AND v_cosigner_score >= 60 THEN
            -- Must share a circle
            v_shared_circle := check_shared_circle(p_user_id, p_cosigner_user_id);

            IF v_shared_circle IS NOT NULL THEN
                SELECT * INTO v_cosigner_capacity FROM check_cosigner_capacity(p_cosigner_user_id);

                IF v_cosigner_capacity.can_cosign THEN
                    v_cosigner_discount := 1.5;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Total discount (capped)
    v_total_discount := LEAST(v_max_discount, v_vouch_discount + v_elder_discount + v_cosigner_discount);

    RETURN QUERY SELECT
        v_vouches,
        v_vouch_discount,
        v_elder_score,
        v_elder_coverage,
        v_elder_discount,
        v_cosigner_score,
        v_cosigner_discount,
        v_total_discount,
        jsonb_build_object(
            'vouch_count', v_vouches,
            'vouch_discount_applied', v_vouch_discount > 0,
            'elder_eligible', v_elder_score >= 80,
            'elder_coverage', v_elder_coverage,
            'cosigner_eligible', v_cosigner_score >= 60,
            'shared_circle_id', v_shared_circle,
            'max_discount', v_max_discount
        )::JSONB;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ PREFLIGHT ELIGIBILITY CHECK                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION check_preflight_eligibility(
    p_user_id UUID,
    p_loan_product_id UUID,
    p_requested_amount_cents INTEGER,
    p_requested_term_months INTEGER
)
RETURNS TABLE (
    eligible BOOLEAN,
    reasons TEXT[]
) AS $$
DECLARE
    v_reasons TEXT[] := '{}';
    v_profile RECORD;
    v_xnscore RECORD;
    v_product RECORD;
    v_account_age_days INTEGER;
    v_active_loans INTEGER;
    v_recent_default BOOLEAN;
    v_active_delinquency BOOLEAN;
BEGIN
    -- Get user data
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    SELECT * INTO v_xnscore FROM xn_scores WHERE user_id = p_user_id;

    IF p_loan_product_id IS NOT NULL THEN
        SELECT * INTO v_product FROM loan_products WHERE id = p_loan_product_id;
    END IF;

    -- Check if user exists and has XnScore
    IF v_xnscore IS NULL THEN
        v_reasons := array_append(v_reasons, 'No credit history - XnScore not yet calculated');
        RETURN QUERY SELECT FALSE, v_reasons;
        RETURN;
    END IF;

    -- Check minimum XnScore
    IF v_product IS NOT NULL AND v_xnscore.total_score < v_product.min_xnscore THEN
        v_reasons := array_append(v_reasons,
            format('XnScore %s below minimum %s for this product', v_xnscore.total_score, v_product.min_xnscore));
    ELSIF v_xnscore.total_score < 40 THEN
        v_reasons := array_append(v_reasons,
            format('XnScore %s below minimum 40 for any loan', v_xnscore.total_score));
    END IF;

    -- Check account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_profile.created_at))::INTEGER;

    IF v_product IS NOT NULL AND v_account_age_days < v_product.min_account_age_days THEN
        v_reasons := array_append(v_reasons,
            format('Account age %s days below minimum %s days', v_account_age_days, v_product.min_account_age_days));
    ELSIF v_account_age_days < 90 THEN
        v_reasons := array_append(v_reasons, 'Account must be at least 90 days old');
    END IF;

    -- Check for active delinquency
    SELECT EXISTS(
        SELECT 1 FROM loans
        WHERE user_id = p_user_id AND status = 'active' AND days_past_due > 30
    ) INTO v_active_delinquency;

    IF v_active_delinquency THEN
        v_reasons := array_append(v_reasons, 'Currently delinquent on existing loan');
    END IF;

    -- Check for recent default
    SELECT EXISTS(
        SELECT 1 FROM loans
        WHERE user_id = p_user_id
        AND status = 'defaulted'
        AND closed_at > now() - INTERVAL '6 months'
    ) INTO v_recent_default;

    IF v_recent_default THEN
        v_reasons := array_append(v_reasons, 'Default within last 6 months');
    END IF;

    -- Check loan stacking
    SELECT COUNT(*) INTO v_active_loans
    FROM loans WHERE user_id = p_user_id AND status = 'active';

    IF v_active_loans >= 2 THEN
        v_reasons := array_append(v_reasons, 'Maximum of 2 active loans allowed');
    END IF;

    -- Check product-specific requirements
    IF v_product IS NOT NULL THEN
        IF p_requested_amount_cents < v_product.min_amount_cents THEN
            v_reasons := array_append(v_reasons,
                format('Amount below product minimum of $%s', v_product.min_amount_cents / 100));
        END IF;

        IF p_requested_amount_cents > v_product.max_amount_cents THEN
            v_reasons := array_append(v_reasons,
                format('Amount exceeds product maximum of $%s', v_product.max_amount_cents / 100));
        END IF;

        IF NOT (p_requested_term_months = ANY(v_product.allowed_terms)) THEN
            v_reasons := array_append(v_reasons,
                format('Term %s months not available for this product', p_requested_term_months));
        END IF;
    END IF;

    -- Check KYC verification
    IF NOT COALESCE(v_profile.identity_verified, FALSE) THEN
        v_reasons := array_append(v_reasons, 'Identity verification required');
    END IF;

    RETURN QUERY SELECT array_length(v_reasons, 1) IS NULL OR array_length(v_reasons, 1) = 0, v_reasons;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MAIN ASSESSMENT FUNCTION                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION assess_creditworthiness(
    p_user_id UUID,
    p_requested_amount_cents INTEGER,
    p_requested_term_months INTEGER,
    p_loan_purpose loan_product_purpose,
    p_loan_product_code TEXT DEFAULT NULL,
    p_elder_guarantee_user_id UUID DEFAULT NULL,
    p_cosigner_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_product RECORD;
    v_xnscore RECORD;

    -- Pillar 1
    v_xnscore_value DECIMAL;
    v_base_credit_score INTEGER;

    -- Pillar 2
    v_circle_health RECORD;

    -- Pillar 3
    v_loan_history RECORD;

    -- Final score
    v_raw_credit_score INTEGER;
    v_final_credit_score INTEGER;
    v_risk_grade risk_grade;

    -- Pillar 4
    v_capacity RECORD;
    v_score_based_limit INTEGER;
    v_product_limit INTEGER;
    v_final_max_amount INTEGER;
    v_approved_amount INTEGER;

    -- Pillar 5
    v_community RECORD;

    -- APR
    v_base_apr DECIMAL;
    v_final_apr DECIMAL;
    v_apr_floor DECIMAL := 5.0;

    -- Repayment
    v_repayment RECORD;

    -- Decision
    v_is_eligible BOOLEAN;
    v_rejection_reasons TEXT[];
    v_recommendation credit_recommendation;
    v_conditions TEXT[] := '{}';

    -- Preflight
    v_preflight RECORD;

    -- Result
    v_assessment_id UUID;
BEGIN
    -- Get loan product
    IF p_loan_product_code IS NOT NULL THEN
        SELECT * INTO v_product FROM loan_products WHERE code = p_loan_product_code AND is_active = TRUE;
    END IF;

    -- Get XnScore
    SELECT * INTO v_xnscore FROM xn_scores WHERE user_id = p_user_id;

    IF v_xnscore IS NULL THEN
        -- Cannot assess without XnScore
        INSERT INTO creditworthiness_assessments (
            user_id, loan_product_id, requested_amount_cents, requested_term_months, loan_purpose,
            xnscore_at_assessment, xnscore_base_credit_score,
            raw_credit_score, final_credit_score, risk_grade,
            score_based_limit_cents, final_max_amount_cents,
            base_apr, final_apr,
            is_eligible, rejection_reasons, system_recommendation,
            expires_at, factor_breakdown
        ) VALUES (
            p_user_id, v_product.id, p_requested_amount_cents, p_requested_term_months, p_loan_purpose,
            0, 300,
            300, 300, 'E'::risk_grade,
            0, 0,
            0, 0,
            FALSE, ARRAY['No XnScore calculated'], 'reject'::credit_recommendation,
            now() + INTERVAL '48 hours', '{}'::JSONB
        )
        RETURNING id INTO v_assessment_id;

        RETURN v_assessment_id;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- PREFLIGHT CHECKS
    -- ═══════════════════════════════════════════════════════════════════

    SELECT * INTO v_preflight FROM check_preflight_eligibility(
        p_user_id, v_product.id, p_requested_amount_cents, p_requested_term_months
    );

    IF NOT v_preflight.eligible THEN
        INSERT INTO creditworthiness_assessments (
            user_id, loan_product_id, requested_amount_cents, requested_term_months, loan_purpose,
            xnscore_at_assessment, xnscore_base_credit_score,
            raw_credit_score, final_credit_score, risk_grade,
            score_based_limit_cents, final_max_amount_cents,
            base_apr, final_apr,
            is_eligible, rejection_reasons, system_recommendation,
            expires_at, factor_breakdown
        ) VALUES (
            p_user_id, v_product.id, p_requested_amount_cents, p_requested_term_months, p_loan_purpose,
            v_xnscore.total_score, calculate_xnscore_credit_score(v_xnscore.total_score),
            calculate_xnscore_credit_score(v_xnscore.total_score),
            calculate_xnscore_credit_score(v_xnscore.total_score),
            get_risk_grade(calculate_xnscore_credit_score(v_xnscore.total_score)),
            0, 0,
            0, 0,
            FALSE, v_preflight.reasons, 'reject'::credit_recommendation,
            now() + INTERVAL '48 hours',
            jsonb_build_object('preflight_failed', TRUE, 'reasons', v_preflight.reasons)
        )
        RETURNING id INTO v_assessment_id;

        RETURN v_assessment_id;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- PILLAR 1: XNSCORE → CREDIT SCORE
    -- ═══════════════════════════════════════════════════════════════════

    v_xnscore_value := v_xnscore.total_score;
    v_base_credit_score := calculate_xnscore_credit_score(v_xnscore_value);

    -- ═══════════════════════════════════════════════════════════════════
    -- PILLAR 2: CIRCLE HEALTH
    -- ═══════════════════════════════════════════════════════════════════

    SELECT * INTO v_circle_health FROM calculate_circle_health_adjustment(p_user_id);

    -- ═══════════════════════════════════════════════════════════════════
    -- PILLAR 3: LOAN HISTORY
    -- ═══════════════════════════════════════════════════════════════════

    SELECT * INTO v_loan_history FROM calculate_loan_history_adjustment(p_user_id);

    -- ═══════════════════════════════════════════════════════════════════
    -- CALCULATE FINAL CREDIT SCORE
    -- ═══════════════════════════════════════════════════════════════════

    v_raw_credit_score := v_base_credit_score + v_circle_health.adjustment + v_loan_history.adjustment;
    v_final_credit_score := GREATEST(300, LEAST(850, v_raw_credit_score));
    v_risk_grade := get_risk_grade(v_final_credit_score);

    -- Check if eligible based on final score
    IF v_risk_grade = 'E' THEN
        v_is_eligible := FALSE;
        v_rejection_reasons := ARRAY['Credit score below minimum threshold'];
        v_recommendation := 'reject'::credit_recommendation;
    ELSE
        v_is_eligible := TRUE;
        v_rejection_reasons := NULL;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- PILLAR 4: CAPACITY
    -- ═══════════════════════════════════════════════════════════════════

    SELECT * INTO v_capacity FROM calculate_capacity(p_user_id);

    v_score_based_limit := get_score_based_limit(v_final_credit_score);
    v_product_limit := COALESCE(v_product.max_amount_cents, 1000000);

    v_final_max_amount := LEAST(
        v_capacity.net_capacity_cents,
        v_score_based_limit,
        v_product_limit
    );

    v_approved_amount := LEAST(p_requested_amount_cents, v_final_max_amount);

    -- Check if approved amount meets minimum
    IF v_is_eligible AND v_approved_amount < COALESCE(v_product.min_amount_cents, 10000) THEN
        v_is_eligible := FALSE;
        v_rejection_reasons := ARRAY['Approved amount below minimum threshold'];
        v_recommendation := 'reject'::credit_recommendation;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- PILLAR 5: COMMUNITY COLLATERAL
    -- ═══════════════════════════════════════════════════════════════════

    SELECT * INTO v_community FROM calculate_community_collateral(
        p_user_id, p_elder_guarantee_user_id, p_cosigner_user_id, v_approved_amount
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- CALCULATE FINAL APR
    -- ═══════════════════════════════════════════════════════════════════

    v_base_apr := get_base_apr(v_final_credit_score, v_risk_grade, v_product.id);

    IF v_base_apr IS NOT NULL THEN
        v_final_apr := GREATEST(v_apr_floor, v_base_apr - v_community.total_discount);
    ELSE
        v_final_apr := 0;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- CALCULATE REPAYMENT
    -- ═══════════════════════════════════════════════════════════════════

    IF v_is_eligible THEN
        SELECT * INTO v_repayment FROM calculate_repayment(
            v_approved_amount, v_final_apr, p_requested_term_months
        );
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- GENERATE RECOMMENDATION
    -- ═══════════════════════════════════════════════════════════════════

    IF v_is_eligible THEN
        IF v_risk_grade = 'D' THEN
            v_recommendation := 'approve_with_conditions'::credit_recommendation;
            v_conditions := array_append(v_conditions, 'Require Elder guarantee or co-signer');
        ELSIF v_loan_history.defaulted_count > 0 THEN
            v_recommendation := 'approve_with_conditions'::credit_recommendation;
            v_conditions := array_append(v_conditions, 'Previous default on record - monitor closely');
        ELSIF v_final_credit_score < 500 THEN
            v_recommendation := 'manual_review'::credit_recommendation;
            v_conditions := array_append(v_conditions, 'Borderline score - manual review required');
        ELSE
            v_recommendation := 'approve'::credit_recommendation;
        END IF;

        IF v_approved_amount < p_requested_amount_cents THEN
            v_conditions := array_append(v_conditions,
                format('Approved amount ($%s) less than requested ($%s)',
                    v_approved_amount / 100, p_requested_amount_cents / 100));
        END IF;
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- CREATE ASSESSMENT RECORD
    -- ═══════════════════════════════════════════════════════════════════

    INSERT INTO creditworthiness_assessments (
        user_id, loan_product_id, requested_amount_cents, requested_term_months, loan_purpose,

        -- Pillar 1
        xnscore_at_assessment, xnscore_base_credit_score,

        -- Pillar 2
        circle_health_score, circle_health_adjustment, avg_circle_risk_score, circles_assessed,

        -- Pillar 3
        loan_history_score, loan_history_adjustment, loans_repaid_count, loans_defaulted_count,
        total_late_payments, has_active_delinquency,

        -- Final score
        raw_credit_score, final_credit_score, risk_grade,

        -- Pillar 4
        contribution_capacity_cents, wallet_capacity_cents, savings_capacity_cents,
        total_capacity_cents, existing_obligations_cents, score_based_limit_cents, final_max_amount_cents,

        -- Pillar 5
        vouch_count, vouch_discount_percent,
        elder_guarantee_user_id, elder_guarantee_coverage_percent, elder_guarantee_discount_percent,
        co_signer_user_id, co_signer_xnscore, co_signer_discount_percent,
        total_community_discount_percent,

        -- APR
        base_apr, final_apr,

        -- Decision
        is_eligible, rejection_reasons, approved_amount_cents,
        monthly_payment_cents, total_interest_cents, total_repayment_cents,
        system_recommendation, recommended_conditions,

        -- Metadata
        expires_at, factor_breakdown
    ) VALUES (
        p_user_id, v_product.id, p_requested_amount_cents, p_requested_term_months, p_loan_purpose,

        v_xnscore_value, v_base_credit_score,

        v_circle_health.score, v_circle_health.adjustment, v_circle_health.avg_risk_score, v_circle_health.circle_count,

        v_loan_history.score, v_loan_history.adjustment, v_loan_history.repaid_count, v_loan_history.defaulted_count,
        v_loan_history.late_payments, v_loan_history.has_active_delinquency,

        v_raw_credit_score, v_final_credit_score, v_risk_grade,

        v_capacity.contribution_capacity_cents, v_capacity.wallet_capacity_cents, v_capacity.savings_capacity_cents,
        v_capacity.total_capacity_cents, v_capacity.existing_obligations_cents, v_score_based_limit, v_final_max_amount,

        v_community.vouch_count, v_community.vouch_discount,
        p_elder_guarantee_user_id, v_community.elder_coverage_percent, v_community.elder_discount,
        p_cosigner_user_id, v_community.cosigner_xnscore, v_community.cosigner_discount,
        v_community.total_discount,

        COALESCE(v_base_apr, 0), COALESCE(v_final_apr, 0),

        v_is_eligible, v_rejection_reasons, CASE WHEN v_is_eligible THEN v_approved_amount ELSE NULL END,
        v_repayment.monthly_payment_cents, v_repayment.total_interest_cents, v_repayment.total_repayment_cents,
        v_recommendation, NULLIF(v_conditions, '{}'),

        now() + INTERVAL '48 hours',
        jsonb_build_object(
            'pillar1', jsonb_build_object('xnscore', v_xnscore_value, 'base_credit_score', v_base_credit_score),
            'pillar2', v_circle_health.details,
            'pillar3', v_loan_history.details,
            'pillar4', v_capacity.details,
            'pillar5', v_community.details,
            'final_score', jsonb_build_object('raw', v_raw_credit_score, 'capped', v_final_credit_score),
            'apr', jsonb_build_object('base', v_base_apr, 'discount', v_community.total_discount, 'final', v_final_apr)
        )
    )
    RETURNING id INTO v_assessment_id;

    RETURN v_assessment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ LOAN APPLICATION FUNCTIONS                                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Create loan application from assessment
CREATE FUNCTION create_loan_application(
    p_assessment_id UUID,
    p_user_id UUID,
    p_purpose_description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_assessment RECORD;
    v_application_id UUID;
BEGIN
    -- Get assessment
    SELECT * INTO v_assessment FROM creditworthiness_assessments WHERE id = p_assessment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assessment not found';
    END IF;

    IF v_assessment.user_id != p_user_id THEN
        RAISE EXCEPTION 'Assessment does not belong to user';
    END IF;

    IF NOT v_assessment.is_eligible THEN
        RAISE EXCEPTION 'Assessment shows user is not eligible';
    END IF;

    IF v_assessment.expires_at < now() THEN
        RAISE EXCEPTION 'Assessment has expired';
    END IF;

    -- Create application
    INSERT INTO loan_applications (
        user_id, assessment_id, loan_product_id,
        requested_amount_cents, approved_amount_cents, term_months,
        purpose, purpose_description,
        apr, origination_fee_cents,
        monthly_payment_cents, total_interest_cents, total_repayment_cents,
        status, expires_at
    ) VALUES (
        p_user_id, p_assessment_id, v_assessment.loan_product_id,
        v_assessment.requested_amount_cents, v_assessment.approved_amount_cents, v_assessment.requested_term_months,
        v_assessment.loan_purpose, p_purpose_description,
        v_assessment.final_apr, 0,
        v_assessment.monthly_payment_cents, v_assessment.total_interest_cents, v_assessment.total_repayment_cents,
        CASE
            WHEN v_assessment.system_recommendation = 'approve' THEN 'approved'::loan_application_status
            ELSE 'pending'::loan_application_status
        END,
        now() + INTERVAL '7 days'
    )
    RETURNING id INTO v_application_id;

    RETURN v_application_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate payment schedule for a loan
CREATE FUNCTION generate_payment_schedule(p_loan_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_loan RECORD;
    v_payment_num INTEGER := 1;
    v_remaining_principal INTEGER;
    v_monthly_rate DECIMAL;
    v_payment_date DATE;
    v_principal_portion INTEGER;
    v_interest_portion INTEGER;
BEGIN
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan not found';
    END IF;

    v_remaining_principal := v_loan.principal_cents;
    v_monthly_rate := v_loan.apr / 100 / 12;
    v_payment_date := v_loan.first_payment_date;

    WHILE v_payment_num <= v_loan.term_months LOOP
        -- Calculate interest for this period
        v_interest_portion := ROUND(v_remaining_principal * v_monthly_rate);

        -- Principal is payment minus interest
        IF v_payment_num < v_loan.term_months THEN
            v_principal_portion := v_loan.monthly_payment_cents - v_interest_portion;
        ELSE
            -- Last payment: remaining principal
            v_principal_portion := v_remaining_principal;
        END IF;

        -- Insert schedule entry
        INSERT INTO loan_payment_schedule (
            loan_id, payment_number, due_date,
            principal_due_cents, interest_due_cents, total_due_cents
        ) VALUES (
            p_loan_id, v_payment_num, v_payment_date,
            v_principal_portion, v_interest_portion, v_principal_portion + v_interest_portion
        );

        v_remaining_principal := v_remaining_principal - v_principal_portion;
        v_payment_date := v_payment_date + INTERVAL '1 month';
        v_payment_num := v_payment_num + 1;
    END LOOP;

    RETURN v_payment_num - 1;
END;
$$ LANGUAGE plpgsql;

-- Disburse approved loan
CREATE FUNCTION disburse_loan(p_application_id UUID)
RETURNS UUID AS $$
DECLARE
    v_application RECORD;
    v_loan_id UUID;
    v_first_payment DATE;
BEGIN
    SELECT * INTO v_application FROM loan_applications WHERE id = p_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Application not found';
    END IF;

    IF v_application.status != 'accepted' THEN
        RAISE EXCEPTION 'Application not in accepted status';
    END IF;

    -- Calculate first payment date (1 month from now)
    v_first_payment := (now() + INTERVAL '1 month')::DATE;

    -- Create loan
    INSERT INTO loans (
        user_id, application_id, loan_product_id,
        principal_cents, apr, term_months,
        origination_fee_cents,
        first_payment_date, final_payment_date, monthly_payment_cents,
        outstanding_principal_cents, outstanding_interest_cents, total_outstanding_cents,
        payments_total, next_payment_date, next_payment_amount_cents,
        elder_guarantee_id, co_signer_id
    ) VALUES (
        v_application.user_id, p_application_id, v_application.loan_product_id,
        v_application.approved_amount_cents, v_application.apr, v_application.term_months,
        v_application.origination_fee_cents,
        v_first_payment,
        v_first_payment + (v_application.term_months - 1) * INTERVAL '1 month',
        v_application.monthly_payment_cents,
        v_application.approved_amount_cents,
        0,
        v_application.approved_amount_cents,
        v_application.term_months,
        v_first_payment,
        v_application.monthly_payment_cents,
        v_application.elder_guarantee_id,
        v_application.co_signer_id
    )
    RETURNING id INTO v_loan_id;

    -- Generate payment schedule
    PERFORM generate_payment_schedule(v_loan_id);

    -- Update application status
    UPDATE loan_applications SET
        status = 'disbursed',
        disbursed_at = now(),
        updated_at = now()
    WHERE id = p_application_id;

    -- Activate guarantees/co-signers
    UPDATE loan_guarantees SET
        status = 'active',
        loan_id = v_loan_id,
        updated_at = now()
    WHERE loan_application_id = p_application_id;

    UPDATE loan_co_signers SET
        status = 'active',
        loan_id = v_loan_id,
        updated_at = now()
    WHERE loan_application_id = p_application_id;

    -- Apply XnScore bonus for loan approval
    PERFORM apply_xnscore_adjustment(
        v_application.user_id,
        2, -- +2 points for loan approval
        'loan.approved',
        v_loan_id
    );

    RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record loan payment
CREATE FUNCTION record_loan_payment(
    p_loan_id UUID,
    p_amount_cents INTEGER,
    p_payment_method TEXT,
    p_payment_source_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_loan RECORD;
    v_schedule RECORD;
    v_payment_id UUID;
    v_is_on_time BOOLEAN;
    v_days_late INTEGER;
    v_principal_allocation INTEGER;
    v_interest_allocation INTEGER;
    v_fees_allocation INTEGER;
BEGIN
    -- Get loan
    SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Loan not found';
    END IF;

    -- Get next scheduled payment
    SELECT * INTO v_schedule
    FROM loan_payment_schedule
    WHERE loan_id = p_loan_id AND status IN ('scheduled', 'partial', 'late')
    ORDER BY payment_number ASC
    LIMIT 1;

    -- Determine if on time
    v_is_on_time := CURRENT_DATE <= v_schedule.due_date + 5; -- 5 day grace period
    v_days_late := GREATEST(0, CURRENT_DATE - v_schedule.due_date - 5);

    -- Allocate payment (interest first, then principal, then fees)
    v_interest_allocation := LEAST(p_amount_cents, v_schedule.interest_due_cents - v_schedule.interest_paid_cents);
    v_principal_allocation := LEAST(p_amount_cents - v_interest_allocation, v_schedule.principal_due_cents - v_schedule.principal_paid_cents);
    v_fees_allocation := p_amount_cents - v_interest_allocation - v_principal_allocation;

    -- Create payment record
    INSERT INTO loan_payments (
        loan_id, user_id, schedule_id,
        amount_cents, principal_cents, interest_cents, fees_cents,
        payment_method, payment_source_id,
        was_on_time, days_late, status
    ) VALUES (
        p_loan_id, v_loan.user_id, v_schedule.id,
        p_amount_cents, v_principal_allocation, v_interest_allocation, v_fees_allocation,
        p_payment_method, p_payment_source_id,
        v_is_on_time, v_days_late, 'completed'::loan_payment_status
    )
    RETURNING id INTO v_payment_id;

    -- Update schedule
    UPDATE loan_payment_schedule SET
        principal_paid_cents = principal_paid_cents + v_principal_allocation,
        interest_paid_cents = interest_paid_cents + v_interest_allocation,
        fees_paid_cents = fees_paid_cents + v_fees_allocation,
        total_paid_cents = total_paid_cents + p_amount_cents,
        status = CASE
            WHEN (principal_paid_cents + v_principal_allocation) >= principal_due_cents
                 AND (interest_paid_cents + v_interest_allocation) >= interest_due_cents
            THEN 'paid'::payment_schedule_status
            ELSE 'partial'::payment_schedule_status
        END,
        paid_at = CASE
            WHEN (principal_paid_cents + v_principal_allocation) >= principal_due_cents
            THEN now()
            ELSE NULL
        END,
        updated_at = now()
    WHERE id = v_schedule.id;

    -- Update loan balances
    UPDATE loans SET
        outstanding_principal_cents = outstanding_principal_cents - v_principal_allocation,
        outstanding_interest_cents = outstanding_interest_cents - v_interest_allocation,
        outstanding_fees_cents = outstanding_fees_cents - v_fees_allocation,
        total_outstanding_cents = outstanding_principal_cents - v_principal_allocation +
                                  outstanding_interest_cents - v_interest_allocation +
                                  outstanding_fees_cents - v_fees_allocation,
        payments_made = payments_made + 1,
        days_past_due = 0,
        is_delinquent = FALSE,
        delinquent_since = NULL,
        next_payment_date = (
            SELECT due_date FROM loan_payment_schedule
            WHERE loan_id = p_loan_id AND status IN ('scheduled', 'partial')
            ORDER BY payment_number ASC LIMIT 1
        ),
        updated_at = now()
    WHERE id = p_loan_id;

    -- Check if loan is paid off
    IF (SELECT outstanding_principal_cents FROM loans WHERE id = p_loan_id) <= 0 THEN
        UPDATE loans SET
            status = 'paid_off',
            closed_at = now(),
            closed_reason = 'full_payment'
        WHERE id = p_loan_id;

        -- Release guarantees and co-signers
        UPDATE loan_guarantees SET
            status = 'released',
            released_at = now(),
            release_reason = 'loan_paid_off'
        WHERE loan_id = p_loan_id;

        UPDATE loan_co_signers SET
            status = 'released',
            released_at = now(),
            release_reason = 'loan_paid_off'
        WHERE loan_id = p_loan_id;
    END IF;

    -- Apply XnScore event
    PERFORM apply_xnscore_adjustment(
        v_loan.user_id,
        CASE WHEN v_is_on_time THEN 3 ELSE -5 END,
        CASE WHEN v_is_on_time THEN 'loan.repaid_on_time' ELSE 'loan.payment_late' END,
        v_payment_id
    );

    UPDATE loan_payments SET xnscore_event_triggered = TRUE WHERE id = v_payment_id;

    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE VIEW v_creditworthiness_summary AS
SELECT
    ca.id,
    ca.user_id,
    p.full_name,
    p.email,
    ca.xnscore_at_assessment,
    ca.final_credit_score,
    ca.risk_grade,
    ca.is_eligible,
    ca.approved_amount_cents / 100.0 as approved_amount,
    ca.final_apr,
    ca.monthly_payment_cents / 100.0 as monthly_payment,
    ca.system_recommendation,
    ca.calculated_at,
    ca.expires_at,
    lp.name as product_name
FROM creditworthiness_assessments ca
JOIN profiles p ON p.id = ca.user_id
LEFT JOIN loan_products lp ON lp.id = ca.loan_product_id;

CREATE VIEW v_active_loans_dashboard AS
SELECT
    l.id,
    l.user_id,
    p.full_name,
    lp.name as product_name,
    l.principal_cents / 100.0 as principal,
    l.apr,
    l.outstanding_principal_cents / 100.0 as outstanding_principal,
    l.payments_made,
    l.payments_total,
    l.next_payment_date,
    l.next_payment_amount_cents / 100.0 as next_payment_amount,
    l.days_past_due,
    l.is_delinquent,
    l.status
FROM loans l
JOIN profiles p ON p.id = l.user_id
JOIN loan_products lp ON lp.id = l.loan_product_id
WHERE l.status = 'active';

CREATE VIEW v_loan_portfolio_summary AS
SELECT
    lp.name as product_name,
    COUNT(*) as total_loans,
    COUNT(*) FILTER (WHERE l.status = 'active') as active_loans,
    COUNT(*) FILTER (WHERE l.status = 'paid_off') as paid_off_loans,
    COUNT(*) FILTER (WHERE l.status = 'defaulted') as defaulted_loans,
    SUM(l.principal_cents) / 100.0 as total_principal,
    SUM(l.outstanding_principal_cents) FILTER (WHERE l.status = 'active') / 100.0 as outstanding_principal,
    AVG(l.apr) as avg_apr,
    COUNT(*) FILTER (WHERE l.is_delinquent) as delinquent_count
FROM loans l
JOIN loan_products lp ON lp.id = l.loan_product_id
GROUP BY lp.name;

CREATE VIEW v_guarantor_exposure AS
SELECT
    g.guarantor_user_id,
    p.full_name as guarantor_name,
    COUNT(*) FILTER (WHERE g.status = 'active') as active_guarantees,
    SUM(g.max_liability_cents) FILTER (WHERE g.status = 'active') / 100.0 as total_liability,
    500000 / 100.0 - COALESCE(SUM(g.max_liability_cents) FILTER (WHERE g.status = 'active'), 0) / 100.0 as remaining_capacity
FROM loan_guarantees g
JOIN profiles p ON p.id = g.guarantor_user_id
GROUP BY g.guarantor_user_id, p.full_name;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditworthiness_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payment_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_guarantees ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_co_signers ENABLE ROW LEVEL SECURITY;

-- Loan products: Public read
CREATE POLICY "loan_products_public_read" ON loan_products FOR SELECT
USING (is_active = TRUE);

-- Assessments: Own only
CREATE POLICY "assessments_own" ON creditworthiness_assessments FOR SELECT
USING (user_id = auth.uid());

-- Applications: Own only
CREATE POLICY "applications_own" ON loan_applications FOR SELECT
USING (user_id = auth.uid());

-- Loans: Own only
CREATE POLICY "loans_own" ON loans FOR SELECT
USING (user_id = auth.uid());

-- Payment schedule: Own loans only
CREATE POLICY "schedule_own" ON loan_payment_schedule FOR SELECT
USING (loan_id IN (SELECT id FROM loans WHERE user_id = auth.uid()));

-- Payments: Own only
CREATE POLICY "payments_own" ON loan_payments FOR SELECT
USING (user_id = auth.uid());

-- Guarantees: Guarantor or borrower
CREATE POLICY "guarantees_view" ON loan_guarantees FOR SELECT
USING (guarantor_user_id = auth.uid() OR borrower_user_id = auth.uid());

-- Co-signers: Co-signer or borrower
CREATE POLICY "cosigners_view" ON loan_co_signers FOR SELECT
USING (co_signer_user_id = auth.uid() OR borrower_user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_loan_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_loan_products_updated
    BEFORE UPDATE ON loan_products
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

CREATE TRIGGER tr_loan_applications_updated
    BEFORE UPDATE ON loan_applications
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

CREATE TRIGGER tr_loans_updated
    BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

CREATE TRIGGER tr_payment_schedule_updated
    BEFORE UPDATE ON loan_payment_schedule
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

CREATE TRIGGER tr_guarantees_updated
    BEFORE UPDATE ON loan_guarantees
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

CREATE TRIGGER tr_cosigners_updated
    BEFORE UPDATE ON loan_co_signers
    FOR EACH ROW EXECUTE FUNCTION update_loan_timestamp();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME SUBSCRIPTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE loans;
ALTER PUBLICATION supabase_realtime ADD TABLE loan_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE loan_payment_schedule;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 022
-- ══════════════════════════════════════════════════════════════════════════════
