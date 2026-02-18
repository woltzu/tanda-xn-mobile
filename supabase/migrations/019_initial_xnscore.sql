-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 019: Initial XnScore Calculation System
-- ══════════════════════════════════════════════════════════════════════════════
-- The First Line of Defense: Time-Gated Trust System
--
-- Core Principles:
-- 1. Trust is EARNED over time, not manufactured overnight
-- 2. Age-based caps CANNOT be bypassed by any amount of activity
-- 3. Velocity limits prevent burst gaming (+5/week max)
-- 4. Fraud signals are checked at signup
-- 5. Permanent penalties for defaults never decay
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop existing objects if partial migration occurred               │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_xnscore_leaderboard CASCADE;
DROP VIEW IF EXISTS v_user_xnscore_details CASCADE;
DROP VIEW IF EXISTS v_xnscore_tier_distribution CASCADE;

DROP FUNCTION IF EXISTS calculate_initial_xnscore(UUID) CASCADE;
DROP FUNCTION IF EXISTS recalculate_xnscore(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_xnscore_age_cap(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_xnscore_tier(DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS check_velocity_cap(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS apply_xnscore_adjustment(UUID, DECIMAL, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS check_circle_eligibility(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_vouch_limits(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_vouch_value(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS process_queued_score_increases() CASCADE;
DROP FUNCTION IF EXISTS decay_inactive_scores() CASCADE;
DROP FUNCTION IF EXISTS update_xnscore_timestamp() CASCADE;

DROP TABLE IF EXISTS xnscore_queued_increases CASCADE;
DROP TABLE IF EXISTS xnscore_fraud_signals CASCADE;
DROP TABLE IF EXISTS vouches CASCADE;
DROP TABLE IF EXISTS xnscore_history CASCADE;
DROP TABLE IF EXISTS xnscore_initial_signals CASCADE;
DROP TABLE IF EXISTS xn_scores CASCADE;

DROP TYPE IF EXISTS xnscore_tier CASCADE;
DROP TYPE IF EXISTS vouch_status CASCADE;
DROP TYPE IF EXISTS voucher_reliability CASCADE;
DROP TYPE IF EXISTS fraud_review_outcome CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE xnscore_tier AS ENUM (
    'elite',      -- 90-100
    'excellent',  -- 75-89
    'good',       -- 60-74
    'fair',       -- 45-59
    'poor',       -- 25-44
    'critical'    -- 0-24
);

CREATE TYPE vouch_status AS ENUM (
    'active',
    'revoked',
    'expired'
);

CREATE TYPE voucher_reliability AS ENUM (
    'good',
    'warning',
    'poor',
    'restricted'
);

CREATE TYPE fraud_review_outcome AS ENUM (
    'pending',
    'cleared',
    'suspicious',
    'confirmed_fraud'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MAIN TABLES                                                                 │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Main XnScore table
CREATE TABLE xn_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

    -- Current score
    total_score DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    raw_score DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    previous_score DECIMAL(5,2),

    -- Tier
    score_tier xnscore_tier NOT NULL DEFAULT 'poor',

    -- Component scores (max 100 total)
    payment_history_score DECIMAL(5,2) DEFAULT 0,    -- 35 pts max
    completion_score DECIMAL(5,2) DEFAULT 0,          -- 25 pts max
    time_reliability_score DECIMAL(5,2) DEFAULT 0,    -- 20 pts max
    deposit_score DECIMAL(5,2) DEFAULT 0,             -- 10 pts max
    diversity_social_score DECIMAL(5,2) DEFAULT 0,    -- 7 pts max
    engagement_score DECIMAL(5,2) DEFAULT 0,          -- 3 pts max

    -- Initial score tracking (for audit)
    initial_score DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    initial_score_breakdown JSONB NOT NULL DEFAULT '{}',
    initial_calculated_at TIMESTAMPTZ,

    -- Age cap tracking
    age_cap_applied BOOLEAN DEFAULT FALSE,
    max_allowed_score INTEGER NOT NULL DEFAULT 40,
    account_age_days INTEGER NOT NULL DEFAULT 0,

    -- Velocity tracking (anti-gaming)
    points_gained_this_week DECIMAL(5,2) DEFAULT 0,
    week_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    velocity_warnings INTEGER DEFAULT 0,

    -- First circle bonus
    first_circle_bonus_applied BOOLEAN DEFAULT FALSE,
    first_circle_bonus_date TIMESTAMPTZ,

    -- Vouching reliability
    voucher_reliability voucher_reliability DEFAULT 'good',
    total_vouchee_defaults INTEGER DEFAULT 0,

    -- Payment stats
    on_time_payment_pct DECIMAL(5,2) DEFAULT 0,
    payment_streak INTEGER DEFAULT 0,
    best_payment_streak INTEGER DEFAULT 0,
    has_defaults BOOLEAN DEFAULT FALSE,
    default_count INTEGER DEFAULT 0,

    -- Circle stats
    completion_rate DECIMAL(5,2) DEFAULT 0,
    full_cycles_completed INTEGER DEFAULT 0,
    circles_participated INTEGER DEFAULT 0,
    circles_abandoned INTEGER DEFAULT 0,

    -- Diversity stats
    unique_circle_members_count INTEGER DEFAULT 0,
    unique_elders_count INTEGER DEFAULT 0,
    unique_communities_count INTEGER DEFAULT 0,

    -- Activity tracking
    active_months INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    consecutive_inactive_days INTEGER DEFAULT 0,

    -- Calculation metadata
    last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_review_date DATE,
    calculation_trigger TEXT,

    -- Flags
    is_repeat_offender BOOLEAN DEFAULT FALSE,
    has_active_restrictions BOOLEAN DEFAULT FALSE,
    manual_adjustment_applied BOOLEAN DEFAULT FALSE,
    score_frozen BOOLEAN DEFAULT FALSE,
    score_frozen_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initial score signals table
CREATE TABLE xnscore_initial_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

    -- Base
    base_score INTEGER NOT NULL DEFAULT 20,

    -- Verification signals
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_points INTEGER DEFAULT 0,

    phone_verified BOOLEAN DEFAULT FALSE,
    phone_verified_points INTEGER DEFAULT 0,

    id_verified BOOLEAN DEFAULT FALSE,
    id_verified_points INTEGER DEFAULT 0,

    -- Profile signals
    profile_complete BOOLEAN DEFAULT FALSE,
    profile_complete_points INTEGER DEFAULT 0,
    profile_completion_pct INTEGER DEFAULT 0,

    -- Inviter signals
    has_inviter BOOLEAN DEFAULT FALSE,
    inviter_user_id UUID REFERENCES profiles(id),
    inviter_xnscore_at_invite DECIMAL(5,2),
    inviter_points INTEGER DEFAULT 0,

    -- Engagement signals
    joined_circle_quickly BOOLEAN DEFAULT FALSE,
    joined_circle_quickly_points INTEGER DEFAULT 0,
    hours_to_first_circle INTEGER,

    -- Bank signals
    bank_account_linked BOOLEAN DEFAULT FALSE,
    bank_account_age_months INTEGER,
    bank_account_points INTEGER DEFAULT 0,

    -- Plaid signals (if available)
    plaid_connected BOOLEAN DEFAULT FALSE,
    plaid_account_age_days INTEGER,
    plaid_balance_healthy BOOLEAN,
    plaid_nsf_count INTEGER DEFAULT 0,
    plaid_points INTEGER DEFAULT 0,

    -- Calculated totals
    raw_initial_score INTEGER NOT NULL DEFAULT 20,
    capped_initial_score INTEGER NOT NULL DEFAULT 20,
    age_cap_at_creation INTEGER NOT NULL DEFAULT 40,

    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recalculated_count INTEGER DEFAULT 0,
    last_recalculated_at TIMESTAMPTZ
);

-- Score history table
CREATE TABLE xnscore_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    score DECIMAL(5,2) NOT NULL,
    previous_score DECIMAL(5,2),
    score_change DECIMAL(5,2) NOT NULL,

    -- What caused this change
    trigger_event TEXT NOT NULL,
    trigger_id UUID,
    trigger_details TEXT,

    -- Breakdown at time of calculation
    factor_breakdown JSONB,

    -- Cap info
    raw_score_before_cap DECIMAL(5,2),
    age_cap_applied BOOLEAN DEFAULT FALSE,
    age_cap_value INTEGER,

    -- Velocity info
    weekly_points_before DECIMAL(5,2),
    weekly_points_after DECIMAL(5,2),
    velocity_capped BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vouch tracking table
CREATE TABLE vouches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    voucher_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vouchee_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Voucher's score at time of vouch
    voucher_xnscore_at_vouch DECIMAL(5,2) NOT NULL,

    -- Sequence tracking (for dilution)
    vouch_sequence INTEGER NOT NULL DEFAULT 1,

    -- Calculated vouch value (with dilution)
    raw_vouch_value DECIMAL(5,2) NOT NULL,
    diluted_vouch_value DECIMAL(5,2) NOT NULL,

    -- Status
    vouch_status vouch_status NOT NULL DEFAULT 'active',

    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    expires_at TIMESTAMPTZ,

    -- Vouchee default tracking
    vouchee_has_defaulted BOOLEAN DEFAULT FALSE,
    vouchee_default_date TIMESTAMPTZ,
    voucher_penalty_applied BOOLEAN DEFAULT FALSE,
    voucher_penalty_amount DECIMAL(5,2),

    -- Metadata
    vouch_reason TEXT,
    relationship_type TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT vouches_unique_active UNIQUE (voucher_user_id, vouchee_user_id, vouch_sequence)
);

-- Fraud signals table
CREATE TABLE xnscore_fraud_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Device clustering
    device_fingerprint TEXT,
    shared_device_users UUID[],

    -- IP clustering
    ip_cluster_id TEXT,
    registration_ip TEXT,
    shared_ip_users UUID[],

    -- Phone clustering
    phone_prefix TEXT,
    is_voip_number BOOLEAN DEFAULT FALSE,
    shared_phone_prefix_users UUID[],

    -- Email analysis
    email_domain TEXT,
    is_disposable_email BOOLEAN DEFAULT FALSE,
    email_pattern_match TEXT,

    -- Vouch pattern analysis
    vouch_network_cluster_id UUID,
    vouch_reciprocity_score DECIMAL(5,2),
    vouch_velocity_score DECIMAL(5,2),

    -- Circle pattern analysis
    circle_overlap_score DECIMAL(5,2),
    unique_member_diversity DECIMAL(5,2),

    -- Overall fraud score
    fraud_risk_score DECIMAL(5,2) DEFAULT 0,
    risk_factors TEXT[],

    -- Flags
    flagged_for_review BOOLEAN DEFAULT FALSE,
    flagged_at TIMESTAMPTZ,
    flagged_reasons TEXT[],

    -- Review
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_outcome fraud_review_outcome DEFAULT 'pending',
    review_notes TEXT,

    -- Actions taken
    score_frozen BOOLEAN DEFAULT FALSE,
    score_frozen_at TIMESTAMPTZ,
    account_restricted BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queued score increases (for velocity cap overflow)
CREATE TABLE xnscore_queued_increases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    amount DECIMAL(5,2) NOT NULL,
    reason TEXT NOT NULL,
    source_event TEXT,
    source_id UUID,

    process_after DATE NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    actual_amount_applied DECIMAL(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_xnscores_user ON xn_scores(user_id);
CREATE INDEX idx_xnscores_tier ON xn_scores(score_tier);
CREATE INDEX idx_xnscores_total ON xn_scores(total_score DESC);
CREATE INDEX idx_xnscores_frozen ON xn_scores(score_frozen) WHERE score_frozen = TRUE;

CREATE INDEX idx_initial_signals_user ON xnscore_initial_signals(user_id);

CREATE INDEX idx_xnscore_history_user ON xnscore_history(user_id);
CREATE INDEX idx_xnscore_history_created ON xnscore_history(created_at DESC);
CREATE INDEX idx_xnscore_history_trigger ON xnscore_history(trigger_event);

CREATE INDEX idx_vouches_voucher ON vouches(voucher_user_id);
CREATE INDEX idx_vouches_vouchee ON vouches(vouchee_user_id);
CREATE INDEX idx_vouches_status ON vouches(vouch_status) WHERE vouch_status = 'active';

CREATE INDEX idx_fraud_signals_user ON xnscore_fraud_signals(user_id);
CREATE INDEX idx_fraud_signals_flagged ON xnscore_fraud_signals(flagged_for_review)
    WHERE flagged_for_review = TRUE;
CREATE INDEX idx_fraud_signals_device ON xnscore_fraud_signals(device_fingerprint);
CREATE INDEX idx_fraud_signals_risk ON xnscore_fraud_signals(fraud_risk_score DESC);

CREATE INDEX idx_queued_increases_user ON xnscore_queued_increases(user_id);
CREATE INDEX idx_queued_increases_pending ON xnscore_queued_increases(process_after)
    WHERE processed = FALSE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get age-based score cap (PRIMARY anti-gaming mechanism)
CREATE FUNCTION get_xnscore_age_cap(account_age_days INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE
        WHEN account_age_days < 30 THEN 40    -- Probation
        WHEN account_age_days < 90 THEN 55    -- Building trust
        WHEN account_age_days < 180 THEN 70   -- Established
        WHEN account_age_days < 365 THEN 85   -- Trusted
        WHEN account_age_days < 548 THEN 90   -- Veteran (18 months)
        ELSE 100                               -- Full trust (18+ months)
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get tier from score
CREATE FUNCTION get_xnscore_tier(score DECIMAL)
RETURNS xnscore_tier AS $$
BEGIN
    RETURN CASE
        WHEN score >= 90 THEN 'elite'::xnscore_tier
        WHEN score >= 75 THEN 'excellent'::xnscore_tier
        WHEN score >= 60 THEN 'good'::xnscore_tier
        WHEN score >= 45 THEN 'fair'::xnscore_tier
        WHEN score >= 25 THEN 'poor'::xnscore_tier
        ELSE 'critical'::xnscore_tier
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate profile completion percentage
CREATE FUNCTION calculate_profile_completion(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_profile RECORD;
    v_completed INTEGER := 0;
    v_total INTEGER := 10;
BEGIN
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    IF v_profile.full_name IS NOT NULL AND LENGTH(v_profile.full_name) > 0 THEN v_completed := v_completed + 1; END IF;
    IF v_profile.email IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.phone IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.date_of_birth IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.address IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.city IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.country IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.avatar_url IS NOT NULL THEN v_completed := v_completed + 1; END IF;
    IF v_profile.bio IS NOT NULL AND LENGTH(v_profile.bio) >= 20 THEN v_completed := v_completed + 1; END IF;
    IF v_profile.occupation IS NOT NULL THEN v_completed := v_completed + 1; END IF;

    RETURN ROUND((v_completed::DECIMAL / v_total) * 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INITIAL SCORE CALCULATION                                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Calculate initial XnScore for new user
CREATE FUNCTION calculate_initial_xnscore(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    score DECIMAL,
    raw_score DECIMAL,
    tier xnscore_tier,
    age_cap INTEGER,
    age_cap_applied BOOLEAN,
    breakdown JSONB
) AS $$
DECLARE
    v_profile RECORD;
    v_existing_score RECORD;
    v_account_age_days INTEGER;
    v_age_cap INTEGER;

    -- Signal values
    v_base INTEGER := 20;
    v_email_points INTEGER := 0;
    v_phone_points INTEGER := 0;
    v_id_points INTEGER := 0;
    v_profile_points INTEGER := 0;
    v_inviter_points INTEGER := 0;
    v_quick_join_points INTEGER := 0;
    v_bank_points INTEGER := 0;

    v_profile_completion INTEGER;
    v_inviter_id UUID;
    v_inviter_score DECIMAL;
    v_has_circle BOOLEAN;
    v_hours_to_circle INTEGER;

    v_raw_total DECIMAL;
    v_capped_total DECIMAL;
    v_tier xnscore_tier;
    v_breakdown JSONB;
BEGIN
    -- Get profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Check for existing score
    SELECT * INTO v_existing_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF FOUND AND v_existing_score.initial_calculated_at IS NOT NULL THEN
        -- Return existing score
        RETURN QUERY SELECT
            p_user_id,
            v_existing_score.total_score,
            v_existing_score.raw_score,
            v_existing_score.score_tier,
            v_existing_score.max_allowed_score::INTEGER,
            v_existing_score.age_cap_applied,
            v_existing_score.initial_score_breakdown;
        RETURN;
    END IF;

    -- Calculate account age
    v_account_age_days := EXTRACT(DAY FROM (now() - v_profile.created_at))::INTEGER;
    v_age_cap := get_xnscore_age_cap(v_account_age_days);

    -- ═══════════════════════════════════════════════════════════════════
    -- GATHER SIGNALS
    -- ═══════════════════════════════════════════════════════════════════

    -- Email verification (+5)
    IF v_profile.email_verified = TRUE THEN
        v_email_points := 5;
    END IF;

    -- Phone verification (+5)
    IF v_profile.phone_verified = TRUE THEN
        v_phone_points := 5;
    END IF;

    -- ID verification (+10)
    IF v_profile.identity_verified = TRUE THEN
        v_id_points := 10;
    END IF;

    -- Profile completion (+2 if 100%)
    v_profile_completion := calculate_profile_completion(p_user_id);
    IF v_profile_completion >= 100 THEN
        v_profile_points := 2;
    END IF;

    -- Inviter bonus (+1 to +5)
    IF v_profile.invited_by IS NOT NULL THEN
        v_inviter_id := v_profile.invited_by;
        SELECT total_score INTO v_inviter_score
        FROM xn_scores WHERE xn_scores.user_id = v_inviter_id;

        IF v_inviter_score IS NOT NULL THEN
            IF v_inviter_score >= 80 THEN
                v_inviter_points := 5;
            ELSIF v_inviter_score >= 60 THEN
                v_inviter_points := 3;
            ELSE
                v_inviter_points := 1;
            END IF;
        ELSE
            v_inviter_points := 1; -- Any inviter is better than none
        END IF;
    END IF;

    -- Quick circle join (+2 if joined within 1 hour)
    SELECT EXISTS(
        SELECT 1 FROM circle_members
        WHERE circle_members.user_id = p_user_id
    ) INTO v_has_circle;

    IF v_has_circle THEN
        SELECT EXTRACT(EPOCH FROM (MIN(cm.joined_at) - v_profile.created_at))/3600
        INTO v_hours_to_circle
        FROM circle_members cm
        WHERE cm.user_id = p_user_id;

        IF v_hours_to_circle IS NOT NULL AND v_hours_to_circle <= 1 THEN
            v_quick_join_points := 2;
        END IF;
    END IF;

    -- Bank account (+1 to +3) - check if linked
    IF EXISTS(SELECT 1 FROM user_bank_accounts WHERE user_bank_accounts.user_id = p_user_id AND status = 'active') THEN
        v_bank_points := 1;
        -- Could add more points based on Plaid data if available
    END IF;

    -- ═══════════════════════════════════════════════════════════════════
    -- CALCULATE TOTALS
    -- ═══════════════════════════════════════════════════════════════════

    v_raw_total := v_base + v_email_points + v_phone_points + v_id_points +
                   v_profile_points + v_inviter_points + v_quick_join_points + v_bank_points;

    v_capped_total := LEAST(v_raw_total, v_age_cap);
    v_tier := get_xnscore_tier(v_capped_total);

    v_breakdown := jsonb_build_object(
        'base', v_base,
        'email_verified', v_email_points,
        'phone_verified', v_phone_points,
        'id_verified', v_id_points,
        'profile_complete', v_profile_points,
        'inviter_bonus', v_inviter_points,
        'quick_join', v_quick_join_points,
        'bank_linked', v_bank_points,
        'raw_total', v_raw_total,
        'age_cap', v_age_cap,
        'capped_total', v_capped_total
    );

    -- ═══════════════════════════════════════════════════════════════════
    -- STORE INITIAL SIGNALS
    -- ═══════════════════════════════════════════════════════════════════

    INSERT INTO xnscore_initial_signals (
        user_id, base_score,
        email_verified, email_verified_points,
        phone_verified, phone_verified_points,
        id_verified, id_verified_points,
        profile_complete, profile_complete_points, profile_completion_pct,
        has_inviter, inviter_user_id, inviter_xnscore_at_invite, inviter_points,
        joined_circle_quickly, joined_circle_quickly_points, hours_to_first_circle,
        bank_account_linked, bank_account_points,
        raw_initial_score, capped_initial_score, age_cap_at_creation
    ) VALUES (
        p_user_id, v_base,
        v_profile.email_verified, v_email_points,
        v_profile.phone_verified, v_phone_points,
        v_profile.identity_verified, v_id_points,
        v_profile_completion >= 100, v_profile_points, v_profile_completion,
        v_inviter_id IS NOT NULL, v_inviter_id, v_inviter_score, v_inviter_points,
        v_quick_join_points > 0, v_quick_join_points, v_hours_to_circle,
        v_bank_points > 0, v_bank_points,
        v_raw_total::INTEGER, v_capped_total::INTEGER, v_age_cap
    )
    ON CONFLICT (user_id) DO UPDATE SET
        email_verified = EXCLUDED.email_verified,
        email_verified_points = EXCLUDED.email_verified_points,
        phone_verified = EXCLUDED.phone_verified,
        phone_verified_points = EXCLUDED.phone_verified_points,
        id_verified = EXCLUDED.id_verified,
        id_verified_points = EXCLUDED.id_verified_points,
        profile_complete = EXCLUDED.profile_complete,
        profile_complete_points = EXCLUDED.profile_complete_points,
        raw_initial_score = EXCLUDED.raw_initial_score,
        capped_initial_score = EXCLUDED.capped_initial_score,
        recalculated_count = xnscore_initial_signals.recalculated_count + 1,
        last_recalculated_at = now();

    -- ═══════════════════════════════════════════════════════════════════
    -- CREATE OR UPDATE MAIN SCORE RECORD
    -- ═══════════════════════════════════════════════════════════════════

    INSERT INTO xn_scores (
        user_id,
        total_score, raw_score, previous_score,
        score_tier,
        time_reliability_score, diversity_social_score, engagement_score,
        initial_score, initial_score_breakdown, initial_calculated_at,
        age_cap_applied, max_allowed_score, account_age_days,
        points_gained_this_week, week_start_date,
        last_calculated_at, calculation_trigger
    ) VALUES (
        p_user_id,
        v_capped_total, v_raw_total, NULL,
        v_tier,
        0, v_inviter_points, v_profile_points + v_quick_join_points,
        v_capped_total, v_breakdown, now(),
        v_capped_total < v_raw_total, v_age_cap, v_account_age_days,
        0, date_trunc('week', now())::DATE,
        now(), 'initial_calculation'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        raw_score = EXCLUDED.raw_score,
        score_tier = EXCLUDED.score_tier,
        initial_score = EXCLUDED.initial_score,
        initial_score_breakdown = EXCLUDED.initial_score_breakdown,
        initial_calculated_at = EXCLUDED.initial_calculated_at,
        age_cap_applied = EXCLUDED.age_cap_applied,
        max_allowed_score = EXCLUDED.max_allowed_score,
        account_age_days = EXCLUDED.account_age_days,
        last_calculated_at = now(),
        calculation_trigger = 'initial_recalculation',
        updated_at = now();

    -- ═══════════════════════════════════════════════════════════════════
    -- LOG TO HISTORY
    -- ═══════════════════════════════════════════════════════════════════

    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, factor_breakdown,
        raw_score_before_cap, age_cap_applied, age_cap_value,
        weekly_points_before, weekly_points_after, velocity_capped
    ) VALUES (
        p_user_id, v_capped_total, NULL, v_capped_total,
        'initial_calculation', v_breakdown,
        v_raw_total, v_capped_total < v_raw_total, v_age_cap,
        0, 0, FALSE
    );

    -- Return result
    RETURN QUERY SELECT
        p_user_id,
        v_capped_total,
        v_raw_total,
        v_tier,
        v_age_cap,
        v_capped_total < v_raw_total,
        v_breakdown;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VELOCITY CAP CHECKING                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Check velocity cap for score increase
CREATE FUNCTION check_velocity_cap(
    p_user_id UUID,
    p_requested_increase DECIMAL
)
RETURNS TABLE (
    allowed BOOLEAN,
    allowed_increase DECIMAL,
    remaining_this_week DECIMAL,
    velocity_warning BOOLEAN
) AS $$
DECLARE
    v_score RECORD;
    v_weekly_limit DECIMAL := 5.00; -- Max +5 points per week
    v_current_week_start DATE;
    v_remaining DECIMAL;
BEGIN
    v_current_week_start := date_trunc('week', now())::DATE;

    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT TRUE, p_requested_increase, v_weekly_limit, FALSE;
        RETURN;
    END IF;

    -- Check if we're in a new week
    IF v_score.week_start_date < v_current_week_start THEN
        -- Reset for new week
        UPDATE xn_scores SET
            week_start_date = v_current_week_start,
            points_gained_this_week = 0
        WHERE xn_scores.user_id = p_user_id;

        v_remaining := v_weekly_limit;
    ELSE
        v_remaining := v_weekly_limit - v_score.points_gained_this_week;
    END IF;

    IF p_requested_increase <= v_remaining THEN
        RETURN QUERY SELECT
            TRUE,
            p_requested_increase,
            v_remaining - p_requested_increase,
            FALSE;
    ELSE
        RETURN QUERY SELECT
            FALSE,
            GREATEST(0, v_remaining),
            0::DECIMAL,
            TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SCORE ADJUSTMENTS                                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Apply score adjustment
CREATE FUNCTION apply_xnscore_adjustment(
    p_user_id UUID,
    p_adjustment DECIMAL,
    p_trigger_event TEXT,
    p_trigger_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    previous_score DECIMAL,
    new_score DECIMAL,
    actual_adjustment DECIMAL,
    velocity_capped BOOLEAN,
    queued_amount DECIMAL
) AS $$
DECLARE
    v_score RECORD;
    v_profile RECORD;
    v_account_age_days INTEGER;
    v_age_cap INTEGER;
    v_velocity_check RECORD;
    v_actual_adjustment DECIMAL;
    v_new_raw DECIMAL;
    v_new_capped DECIMAL;
    v_queued DECIMAL := 0;
BEGIN
    -- Get current score
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        -- Calculate initial score first
        PERFORM calculate_initial_xnscore(p_user_id);
        SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;
    END IF;

    -- Check if score is frozen
    IF v_score.score_frozen THEN
        RETURN QUERY SELECT FALSE, v_score.total_score, v_score.total_score, 0::DECIMAL, FALSE, 0::DECIMAL;
        RETURN;
    END IF;

    -- Get age cap
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    v_account_age_days := EXTRACT(DAY FROM (now() - v_profile.created_at))::INTEGER;
    v_age_cap := get_xnscore_age_cap(v_account_age_days);

    -- For positive adjustments, check velocity cap
    IF p_adjustment > 0 THEN
        SELECT * INTO v_velocity_check FROM check_velocity_cap(p_user_id, p_adjustment);

        IF NOT v_velocity_check.allowed THEN
            v_actual_adjustment := v_velocity_check.allowed_increase;
            v_queued := p_adjustment - v_actual_adjustment;

            -- Queue the overflow
            IF v_queued > 0 THEN
                INSERT INTO xnscore_queued_increases (
                    user_id, amount, reason, source_event, source_id, process_after
                ) VALUES (
                    p_user_id, v_queued, 'velocity_cap_overflow', p_trigger_event, p_trigger_id,
                    date_trunc('week', now() + INTERVAL '1 week')::DATE
                );
            END IF;
        ELSE
            v_actual_adjustment := p_adjustment;
        END IF;
    ELSE
        -- Negative adjustments bypass velocity (immediate)
        v_actual_adjustment := p_adjustment;
    END IF;

    -- Calculate new scores
    v_new_raw := v_score.raw_score + v_actual_adjustment;
    v_new_capped := LEAST(GREATEST(0, v_new_raw), v_age_cap);

    -- Update score
    UPDATE xn_scores SET
        previous_score = total_score,
        total_score = v_new_capped,
        raw_score = v_new_raw,
        score_tier = get_xnscore_tier(v_new_capped),
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        account_age_days = v_account_age_days,
        points_gained_this_week = CASE
            WHEN v_actual_adjustment > 0 THEN points_gained_this_week + v_actual_adjustment
            ELSE points_gained_this_week
        END,
        last_calculated_at = now(),
        calculation_trigger = p_trigger_event,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Log to history
    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, trigger_id,
        raw_score_before_cap, age_cap_applied, age_cap_value,
        weekly_points_before, weekly_points_after,
        velocity_capped
    ) VALUES (
        p_user_id, v_new_capped, v_score.total_score, v_new_capped - v_score.total_score,
        p_trigger_event, p_trigger_id,
        v_new_raw, v_new_capped < v_new_raw, v_age_cap,
        v_score.points_gained_this_week,
        CASE WHEN v_actual_adjustment > 0 THEN v_score.points_gained_this_week + v_actual_adjustment ELSE v_score.points_gained_this_week END,
        v_queued > 0
    );

    RETURN QUERY SELECT
        TRUE,
        v_score.total_score,
        v_new_capped,
        v_actual_adjustment,
        v_queued > 0,
        v_queued;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CIRCLE ELIGIBILITY CHECK                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Check if user can join a circle based on XnScore
CREATE FUNCTION check_circle_eligibility(
    p_user_id UUID,
    p_circle_id UUID
)
RETURNS TABLE (
    eligible BOOLEAN,
    reason TEXT,
    code TEXT,
    current_score DECIMAL,
    required_score INTEGER,
    position_restrictions JSONB
) AS $$
DECLARE
    v_score RECORD;
    v_circle RECORD;
    v_contribution_amount DECIMAL;
    v_min_required INTEGER;
    v_active_defaults INTEGER;
    v_fraud_frozen BOOLEAN;
    v_position_restrictions JSONB;
BEGIN
    -- Get XnScore
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE, 'No XnScore calculated'::TEXT, 'NO_SCORE'::TEXT,
            0::DECIMAL, 0, '{}'::JSONB;
        RETURN;
    END IF;

    -- Get circle
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE, 'Circle not found'::TEXT, 'CIRCLE_NOT_FOUND'::TEXT,
            v_score.total_score, 0, '{}'::JSONB;
        RETURN;
    END IF;

    v_contribution_amount := v_circle.contribution_amount;

    -- Determine minimum score based on contribution amount
    IF v_contribution_amount >= 1000 THEN
        v_min_required := 75;
    ELSIF v_contribution_amount >= 500 THEN
        v_min_required := 60;
    ELSIF v_contribution_amount >= 200 THEN
        v_min_required := 45;
    ELSE
        v_min_required := 25;
    END IF;

    -- Check minimum score
    IF v_score.total_score < v_min_required THEN
        RETURN QUERY SELECT
            FALSE,
            format('XnScore %s below minimum %s for this circle', v_score.total_score, v_min_required),
            'SCORE_TOO_LOW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check account age for high-value circles
    IF v_contribution_amount >= 500 AND v_score.account_age_days < 90 THEN
        RETURN QUERY SELECT
            FALSE,
            'Account must be at least 90 days old for circles >= $500'::TEXT,
            'ACCOUNT_TOO_NEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    IF v_contribution_amount >= 1000 AND v_score.account_age_days < 180 THEN
        RETURN QUERY SELECT
            FALSE,
            'Account must be at least 180 days old for circles >= $1000'::TEXT,
            'ACCOUNT_TOO_NEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check for active defaults
    SELECT COUNT(*) INTO v_active_defaults
    FROM member_debts
    WHERE member_debts.user_id = p_user_id AND debt_status IN ('pending', 'repaying');

    IF v_active_defaults > 0 THEN
        RETURN QUERY SELECT
            FALSE,
            'Cannot join circles with unresolved debts'::TEXT,
            'HAS_ACTIVE_DEBTS'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check if flagged for fraud
    SELECT score_frozen INTO v_fraud_frozen
    FROM xnscore_fraud_signals
    WHERE xnscore_fraud_signals.user_id = p_user_id;

    IF v_fraud_frozen = TRUE THEN
        RETURN QUERY SELECT
            FALSE,
            'Account under review'::TEXT,
            'FRAUD_REVIEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Calculate position restrictions
    v_position_restrictions := jsonb_build_object(
        'can_take_early_position', v_score.total_score >= 70,
        'can_take_first_position', v_score.total_score >= 80,
        'max_early_position', CASE
            WHEN v_score.total_score >= 80 THEN 1
            WHEN v_score.total_score >= 70 THEN 3
            ELSE CEIL(v_circle.member_count::DECIMAL / 2)
        END
    );

    -- Eligible!
    RETURN QUERY SELECT
        TRUE,
        'Eligible to join'::TEXT,
        'ELIGIBLE'::TEXT,
        v_score.total_score,
        v_min_required,
        v_position_restrictions;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VOUCH SYSTEM                                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get vouch limits for a user
CREATE FUNCTION get_vouch_limits(p_user_id UUID)
RETURNS TABLE (
    can_vouch BOOLEAN,
    reason TEXT,
    active_vouches INTEGER,
    max_vouches INTEGER,
    remaining_vouches INTEGER,
    vouch_power DECIMAL
) AS $$
DECLARE
    v_score RECORD;
    v_active_count INTEGER;
    v_max INTEGER;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'No XnScore'::TEXT, 0, 0, 0, 0::DECIMAL;
        RETURN;
    END IF;

    -- Must have score >= 70 to vouch
    IF v_score.total_score < 70 THEN
        RETURN QUERY SELECT
            FALSE,
            format('XnScore must be >= 70 to vouch (you have %s)', v_score.total_score),
            0, 0, 0, v_score.total_score;
        RETURN;
    END IF;

    -- Check if restricted
    IF v_score.voucher_reliability = 'restricted' THEN
        RETURN QUERY SELECT
            FALSE,
            'Vouching privileges suspended due to vouchee defaults'::TEXT,
            0, 0, 0, v_score.total_score;
        RETURN;
    END IF;

    -- Count active vouches
    SELECT COUNT(*) INTO v_active_count
    FROM vouches
    WHERE voucher_user_id = p_user_id AND vouch_status = 'active';

    -- Max vouches based on score
    IF v_score.total_score >= 90 THEN
        v_max := 5;
    ELSIF v_score.total_score >= 80 THEN
        v_max := 4;
    ELSE
        v_max := 3;
    END IF;

    RETURN QUERY SELECT
        v_active_count < v_max,
        CASE WHEN v_active_count < v_max THEN 'Can vouch'::TEXT ELSE 'Vouch limit reached'::TEXT END,
        v_active_count,
        v_max,
        v_max - v_active_count,
        v_score.total_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate vouch value with dilution
CREATE FUNCTION calculate_vouch_value(
    p_voucher_id UUID,
    p_vouchee_id UUID
)
RETURNS TABLE (
    raw_value DECIMAL,
    diluted_value DECIMAL,
    dilution_factor DECIMAL,
    voucher_score DECIMAL,
    sequence_number INTEGER
) AS $$
DECLARE
    v_voucher_score DECIMAL;
    v_existing_vouches INTEGER;
    v_base_value DECIMAL;
    v_dilution DECIMAL;
BEGIN
    -- Get voucher's score
    SELECT total_score INTO v_voucher_score
    FROM xn_scores WHERE user_id = p_voucher_id;

    IF v_voucher_score IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 1::DECIMAL, 0::DECIMAL, 0;
        RETURN;
    END IF;

    -- Count existing vouches for this vouchee
    SELECT COUNT(*) INTO v_existing_vouches
    FROM vouches
    WHERE vouchee_user_id = p_vouchee_id AND vouch_status = 'active';

    -- Base value based on voucher's score
    IF v_voucher_score >= 90 THEN
        v_base_value := 2.0;
    ELSIF v_voucher_score >= 80 THEN
        v_base_value := 1.5;
    ELSIF v_voucher_score >= 70 THEN
        v_base_value := 1.0;
    ELSE
        v_base_value := 0.5;
    END IF;

    -- Dilution: each additional vouch is worth less
    -- 1st vouch: 100%, 2nd: 50%, 3rd: 25%, etc.
    v_dilution := POWER(0.5, v_existing_vouches);

    RETURN QUERY SELECT
        v_base_value,
        v_base_value * v_dilution,
        v_dilution,
        v_voucher_score,
        v_existing_vouches + 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create a vouch
CREATE FUNCTION create_vouch(
    p_voucher_id UUID,
    p_vouchee_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_relationship TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_limits RECORD;
    v_value RECORD;
    v_vouch_id UUID;
BEGIN
    -- Check if can vouch
    SELECT * INTO v_limits FROM get_vouch_limits(p_voucher_id);

    IF NOT v_limits.can_vouch THEN
        RAISE EXCEPTION 'Cannot vouch: %', v_limits.reason;
    END IF;

    -- Cannot vouch for self
    IF p_voucher_id = p_vouchee_id THEN
        RAISE EXCEPTION 'Cannot vouch for yourself';
    END IF;

    -- Check for existing active vouch
    IF EXISTS (
        SELECT 1 FROM vouches
        WHERE voucher_user_id = p_voucher_id
        AND vouchee_user_id = p_vouchee_id
        AND vouch_status = 'active'
    ) THEN
        RAISE EXCEPTION 'Already have an active vouch for this user';
    END IF;

    -- Calculate vouch value
    SELECT * INTO v_value FROM calculate_vouch_value(p_voucher_id, p_vouchee_id);

    -- Create vouch
    INSERT INTO vouches (
        voucher_user_id, vouchee_user_id,
        voucher_xnscore_at_vouch,
        vouch_sequence,
        raw_vouch_value, diluted_vouch_value,
        vouch_reason, relationship_type,
        expires_at
    ) VALUES (
        p_voucher_id, p_vouchee_id,
        v_value.voucher_score,
        v_value.sequence_number,
        v_value.raw_value, v_value.diluted_value,
        p_reason, p_relationship,
        now() + INTERVAL '1 year' -- Vouches expire after 1 year
    )
    RETURNING id INTO v_vouch_id;

    -- Apply score increase to vouchee
    PERFORM apply_xnscore_adjustment(
        p_vouchee_id,
        v_value.diluted_value,
        'vouch_received',
        v_vouch_id
    );

    -- Small bonus to voucher
    PERFORM apply_xnscore_adjustment(
        p_voucher_id,
        0.5,
        'vouch_given',
        v_vouch_id
    );

    RETURN v_vouch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SCHEDULED FUNCTIONS                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Process queued score increases
CREATE FUNCTION process_queued_score_increases()
RETURNS INTEGER AS $$
DECLARE
    v_processed INTEGER := 0;
    v_queue RECORD;
BEGIN
    FOR v_queue IN
        SELECT * FROM xnscore_queued_increases
        WHERE processed = FALSE
        AND process_after <= CURRENT_DATE
        ORDER BY created_at ASC
    LOOP
        -- Apply the queued increase
        PERFORM apply_xnscore_adjustment(
            v_queue.user_id,
            v_queue.amount,
            'queued_increase_' || v_queue.source_event,
            v_queue.source_id
        );

        -- Mark as processed
        UPDATE xnscore_queued_increases SET
            processed = TRUE,
            processed_at = now(),
            actual_amount_applied = v_queue.amount
        WHERE id = v_queue.id;

        v_processed := v_processed + 1;
    END LOOP;

    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

-- Decay scores for inactive users
CREATE FUNCTION decay_inactive_scores()
RETURNS INTEGER AS $$
DECLARE
    v_decayed INTEGER := 0;
    v_score RECORD;
    v_days_inactive INTEGER;
    v_decay_amount DECIMAL;
BEGIN
    FOR v_score IN
        SELECT * FROM xn_scores
        WHERE last_activity_at < now() - INTERVAL '30 days'
        AND total_score > 0
        AND score_frozen = FALSE
    LOOP
        v_days_inactive := EXTRACT(DAY FROM (now() - v_score.last_activity_at))::INTEGER;

        -- Decay rates
        IF v_days_inactive >= 90 THEN
            v_decay_amount := -10;
        ELSIF v_days_inactive >= 60 THEN
            v_decay_amount := -6;
        ELSIF v_days_inactive >= 30 THEN
            v_decay_amount := -3;
        ELSE
            CONTINUE;
        END IF;

        -- Only apply once per threshold
        IF v_score.consecutive_inactive_days < v_days_inactive THEN
            PERFORM apply_xnscore_adjustment(
                v_score.user_id,
                v_decay_amount,
                format('inactivity_%sd', v_days_inactive),
                NULL
            );

            UPDATE xn_scores SET
                consecutive_inactive_days = v_days_inactive
            WHERE id = v_score.id;

            v_decayed := v_decayed + 1;
        END IF;
    END LOOP;

    RETURN v_decayed;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE VIEW v_user_xnscore_details AS
SELECT
    xs.*,
    p.full_name,
    p.email,
    p.avatar_url,
    p.created_at as account_created_at,
    sis.raw_initial_score,
    sis.capped_initial_score,
    sis.inviter_user_id,
    sis.inviter_xnscore_at_invite,
    (SELECT COUNT(*) FROM vouches WHERE vouchee_user_id = xs.user_id AND vouch_status = 'active') as active_vouches_received,
    (SELECT COUNT(*) FROM vouches WHERE voucher_user_id = xs.user_id AND vouch_status = 'active') as active_vouches_given,
    CASE
        WHEN xs.score_tier = 'elite' THEN '⭐'
        WHEN xs.score_tier = 'excellent' THEN '🏆'
        WHEN xs.score_tier = 'good' THEN '✓'
        WHEN xs.score_tier = 'fair' THEN '⚠️'
        WHEN xs.score_tier = 'poor' THEN '⚡'
        ELSE '🚫'
    END as tier_emoji
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id
LEFT JOIN xnscore_initial_signals sis ON sis.user_id = xs.user_id;

CREATE VIEW v_xnscore_leaderboard AS
SELECT
    xs.user_id,
    p.full_name,
    p.avatar_url,
    xs.total_score,
    xs.score_tier,
    xs.full_cycles_completed,
    xs.on_time_payment_pct,
    xs.payment_streak,
    RANK() OVER (ORDER BY xs.total_score DESC) as rank
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id
WHERE xs.score_frozen = FALSE
ORDER BY xs.total_score DESC;

CREATE VIEW v_xnscore_tier_distribution AS
SELECT
    score_tier,
    COUNT(*) as user_count,
    ROUND(AVG(total_score), 2) as avg_score,
    ROUND(AVG(account_age_days), 0) as avg_account_age_days,
    ROUND(AVG(full_cycles_completed), 1) as avg_cycles_completed
FROM xn_scores
GROUP BY score_tier
ORDER BY
    CASE score_tier
        WHEN 'elite' THEN 1
        WHEN 'excellent' THEN 2
        WHEN 'good' THEN 3
        WHEN 'fair' THEN 4
        WHEN 'poor' THEN 5
        WHEN 'critical' THEN 6
    END;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE xn_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_initial_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_fraud_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_queued_increases ENABLE ROW LEVEL SECURITY;

-- XnScores: Users can view their own, others can see limited info
CREATE POLICY "xnscores_own_full" ON xn_scores FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "xnscores_others_limited" ON xn_scores FOR SELECT
USING (TRUE); -- All can see scores (social feature)

-- Initial signals: Only own
CREATE POLICY "initial_signals_own" ON xnscore_initial_signals FOR SELECT
USING (user_id = auth.uid());

-- History: Only own
CREATE POLICY "history_own" ON xnscore_history FOR SELECT
USING (user_id = auth.uid());

-- Vouches: Can see vouches involving self
CREATE POLICY "vouches_view" ON vouches FOR SELECT
USING (voucher_user_id = auth.uid() OR vouchee_user_id = auth.uid());

CREATE POLICY "vouches_create" ON vouches FOR INSERT
WITH CHECK (voucher_user_id = auth.uid());

-- Fraud signals: Only admins (handled at application level)
CREATE POLICY "fraud_signals_admin" ON xnscore_fraud_signals FOR SELECT
USING (FALSE); -- Blocked by default, admin access via service role

-- Queued increases: Only own
CREATE POLICY "queued_own" ON xnscore_queued_increases FOR SELECT
USING (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_xnscore_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_xnscores_updated
    BEFORE UPDATE ON xn_scores
    FOR EACH ROW EXECUTE FUNCTION update_xnscore_timestamp();

CREATE TRIGGER tr_fraud_signals_updated
    BEFORE UPDATE ON xnscore_fraud_signals
    FOR EACH ROW EXECUTE FUNCTION update_xnscore_timestamp();

-- Auto-calculate initial score for new profiles
CREATE FUNCTION auto_calculate_initial_xnscore() RETURNS TRIGGER AS $$
BEGIN
    -- Queue initial score calculation (don't block insert)
    PERFORM pg_notify('xnscore_calculate', NEW.id::TEXT);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would need to be enabled based on your workflow
-- CREATE TRIGGER tr_profile_xnscore_init
--     AFTER INSERT ON profiles
--     FOR EACH ROW EXECUTE FUNCTION auto_calculate_initial_xnscore();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME SUBSCRIPTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE xn_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE vouches;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ADD XNSCORE COLUMN TO PROFILES (if not exists)                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Add xn_score column to profiles for quick access (denormalized)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xn_score INTEGER DEFAULT 20;

-- Function to sync xn_score to profiles
CREATE OR REPLACE FUNCTION sync_xnscore_to_profile() RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET xn_score = NEW.total_score::INTEGER WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_sync_xnscore
    AFTER INSERT OR UPDATE OF total_score ON xn_scores
    FOR EACH ROW EXECUTE FUNCTION sync_xnscore_to_profile();

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 019
-- ══════════════════════════════════════════════════════════════════════════════
