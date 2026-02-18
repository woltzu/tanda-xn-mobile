-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 020: XnScore Decay & Growth Over Time
-- ══════════════════════════════════════════════════════════════════════════════
-- Inactive users shouldn't keep high scores. Active users earn tenure bonus.
--
-- Core Principles:
-- 1. Inactivity = Financial inactivity (contributions, payouts, deposits, etc.)
-- 2. Decay is progressive and accelerating
-- 3. Tenure rewards long-term active users (+1/month, max +25)
-- 4. Recovery periods help returning users (1.5x multiplier for 90 days)
-- 5. Minimum score floor prevents total score destruction
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop existing objects if partial migration occurred               │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_decay_at_risk_users CASCADE;
DROP VIEW IF EXISTS v_tenure_eligible_users CASCADE;
DROP VIEW IF EXISTS v_recovery_period_users CASCADE;
DROP VIEW IF EXISTS v_xnscore_activity_summary CASCADE;

DROP FUNCTION IF EXISTS apply_inactivity_decay(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_all_inactivity_decays() CASCADE;
DROP FUNCTION IF EXISTS apply_tenure_bonus(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_all_tenure_bonuses() CASCADE;
DROP FUNCTION IF EXISTS start_recovery_period(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS end_recovery_period(UUID) CASCADE;
DROP FUNCTION IF EXISTS check_and_apply_recovery_multiplier(UUID, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS is_user_financially_active(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_last_financial_activity(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_financial_activity(UUID, TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_decay_rate(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_total_decay_penalty(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS process_daily_decay_check() CASCADE;
DROP FUNCTION IF EXISTS process_monthly_tenure_check() CASCADE;
DROP FUNCTION IF EXISTS record_decay_event(UUID, DECIMAL, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS record_tenure_event(UUID, DECIMAL, INTEGER) CASCADE;

DROP TABLE IF EXISTS xnscore_recovery_periods CASCADE;
DROP TABLE IF EXISTS xnscore_tenure_history CASCADE;
DROP TABLE IF EXISTS xnscore_decay_history CASCADE;

DROP TYPE IF EXISTS recovery_trigger_type CASCADE;
DROP TYPE IF EXISTS decay_reason CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE decay_reason AS ENUM (
    'inactivity_30d',
    'inactivity_60d',
    'inactivity_90d',
    'inactivity_120d',
    'inactivity_180d',
    'inactivity_240d',
    'inactivity_365d',
    'manual_decay',
    'suspension_decay',
    'fraud_decay'
);

CREATE TYPE recovery_trigger_type AS ENUM (
    'first_contribution_after_inactivity',
    'first_payout_received',
    'debt_fully_repaid',
    'suspension_lifted',
    'manual_recovery_granted'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TABLES                                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Decay history tracking
CREATE TABLE xnscore_decay_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Decay details
    decay_reason decay_reason NOT NULL,
    decay_amount DECIMAL(5,2) NOT NULL,
    score_before DECIMAL(5,2) NOT NULL,
    score_after DECIMAL(5,2) NOT NULL,

    -- Inactivity tracking
    days_inactive INTEGER NOT NULL,
    last_financial_activity_at TIMESTAMPTZ,

    -- Cumulative tracking
    total_decay_this_period DECIMAL(5,2) NOT NULL DEFAULT 0,
    decay_events_count INTEGER NOT NULL DEFAULT 1,

    -- Context
    decay_details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenure bonus history
CREATE TABLE xnscore_tenure_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Tenure details
    tenure_month INTEGER NOT NULL, -- Which month (1, 2, 3, etc.)
    bonus_amount DECIMAL(5,2) NOT NULL DEFAULT 1.00,

    -- Score tracking
    score_before DECIMAL(5,2) NOT NULL,
    score_after DECIMAL(5,2) NOT NULL,

    -- Eligibility at time of award
    was_active_this_month BOOLEAN NOT NULL DEFAULT TRUE,
    had_on_time_payment BOOLEAN,
    contribution_count_this_month INTEGER DEFAULT 0,

    -- Cumulative
    total_tenure_bonus_earned DECIMAL(5,2) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_user_tenure_month UNIQUE(user_id, tenure_month)
);

-- Recovery periods tracking
CREATE TABLE xnscore_recovery_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Recovery details
    trigger_type recovery_trigger_type NOT NULL,
    trigger_event_id UUID, -- Reference to contribution, payout, etc.

    -- Period tracking
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Multiplier
    recovery_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.50, -- 1.5x

    -- Score at start
    score_at_start DECIMAL(5,2) NOT NULL,
    decay_total_before_recovery DECIMAL(5,2) DEFAULT 0,

    -- Usage tracking
    bonus_events_during_recovery INTEGER DEFAULT 0,
    total_bonus_earned_during DECIMAL(5,2) DEFAULT 0,

    -- Completion
    ended_at TIMESTAMPTZ,
    ended_reason TEXT,
    score_at_end DECIMAL(5,2),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ALTER EXISTING XN_SCORES TABLE                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Add new columns for decay/growth tracking
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_financial_activity_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS financial_inactive_days INTEGER DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS total_inactivity_penalty DECIMAL(5,2) DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS decay_floor_reached BOOLEAN DEFAULT FALSE;

-- Tenure tracking
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS tenure_bonus DECIMAL(5,2) DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS tenure_months_earned INTEGER DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS tenure_eligible_since TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS next_tenure_check_date DATE;

-- Recovery period tracking
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS in_recovery_period BOOLEAN DEFAULT FALSE;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS recovery_period_id UUID REFERENCES xnscore_recovery_periods(id);
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS recovery_ends_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS recovery_multiplier DECIMAL(3,2) DEFAULT 1.00;

-- Activity tracking enhancement
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_contribution_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_payout_received_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_wallet_deposit_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_savings_activity_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS last_remittance_at TIMESTAMPTZ;

-- Stats
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS contributions_this_month INTEGER DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS on_time_payments_this_month INTEGER DEFAULT 0;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS current_month_start DATE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_decay_history_user ON xnscore_decay_history(user_id);
CREATE INDEX idx_decay_history_created ON xnscore_decay_history(created_at DESC);
CREATE INDEX idx_decay_history_reason ON xnscore_decay_history(decay_reason);

CREATE INDEX idx_tenure_history_user ON xnscore_tenure_history(user_id);
CREATE INDEX idx_tenure_history_month ON xnscore_tenure_history(tenure_month);

CREATE INDEX idx_recovery_periods_user ON xnscore_recovery_periods(user_id);
CREATE INDEX idx_recovery_periods_active ON xnscore_recovery_periods(is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_recovery_periods_ends ON xnscore_recovery_periods(ends_at)
    WHERE is_active = TRUE;

CREATE INDEX idx_xnscores_financial_inactive ON xn_scores(financial_inactive_days DESC)
    WHERE financial_inactive_days >= 30;
CREATE INDEX idx_xnscores_tenure_check ON xn_scores(next_tenure_check_date)
    WHERE next_tenure_check_date IS NOT NULL;
CREATE INDEX idx_xnscores_recovery ON xn_scores(in_recovery_period)
    WHERE in_recovery_period = TRUE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get decay rate for given inactive days
-- Decay Schedule:
-- 30-59 days: -3 points (warning)
-- 60-89 days: -6 points (moderate)
-- 90-119 days: -10 points (significant)
-- 120-179 days: -15 points (severe)
-- 180-239 days: -20 points (critical)
-- 240-364 days: -25 points (near-freeze)
-- 365+ days: Score frozen at minimum floor (15)
CREATE FUNCTION get_decay_rate(p_inactive_days INTEGER)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    RETURN CASE
        WHEN p_inactive_days >= 365 THEN -30.00  -- Freeze at floor
        WHEN p_inactive_days >= 240 THEN -25.00
        WHEN p_inactive_days >= 180 THEN -20.00
        WHEN p_inactive_days >= 120 THEN -15.00
        WHEN p_inactive_days >= 90 THEN -10.00
        WHEN p_inactive_days >= 60 THEN -6.00
        WHEN p_inactive_days >= 30 THEN -3.00
        ELSE 0.00
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate total cumulative decay for given inactive days
CREATE FUNCTION calculate_total_decay_penalty(p_inactive_days INTEGER)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    v_total DECIMAL(5,2) := 0;
BEGIN
    -- Cumulative decay based on thresholds passed
    IF p_inactive_days >= 30 THEN v_total := v_total + 3; END IF;
    IF p_inactive_days >= 60 THEN v_total := v_total + 6; END IF;
    IF p_inactive_days >= 90 THEN v_total := v_total + 10; END IF;
    IF p_inactive_days >= 120 THEN v_total := v_total + 15; END IF;
    IF p_inactive_days >= 180 THEN v_total := v_total + 20; END IF;
    IF p_inactive_days >= 240 THEN v_total := v_total + 25; END IF;
    IF p_inactive_days >= 365 THEN v_total := v_total + 30; END IF;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get the last financial activity timestamp for a user
CREATE FUNCTION get_last_financial_activity(p_user_id UUID)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_last_activity TIMESTAMPTZ;
    v_contribution TIMESTAMPTZ;
    v_payout TIMESTAMPTZ;
    v_wallet TIMESTAMPTZ;
BEGIN
    -- Check contributions (always exists)
    -- Status can be 'completed' or 'late' (both indicate paid)
    SELECT MAX(paid_at) INTO v_contribution
    FROM contributions
    WHERE user_id = p_user_id AND status IN ('completed', 'late');

    -- Check payouts received (always exists)
    SELECT MAX(completed_at) INTO v_payout
    FROM payout_executions
    WHERE recipient_user_id = p_user_id AND execution_status = 'completed';

    -- Check wallet deposits (always exists)
    SELECT MAX(created_at) INTO v_wallet
    FROM wallet_transactions
    WHERE user_id = p_user_id
    AND transaction_type IN ('deposit', 'incoming_transfer')
    AND transaction_status = 'completed';

    -- Note: savings_contributions and remittances tables may not exist yet
    -- They can be added when those features are implemented

    -- Get the most recent activity
    v_last_activity := GREATEST(
        COALESCE(v_contribution, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(v_payout, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(v_wallet, '1970-01-01'::TIMESTAMPTZ)
    );

    -- Return NULL if no activity ever
    IF v_last_activity = '1970-01-01'::TIMESTAMPTZ THEN
        RETURN NULL;
    END IF;

    RETURN v_last_activity;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if user has been financially active within N days
CREATE FUNCTION is_user_financially_active(p_user_id UUID, p_days INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_activity TIMESTAMPTZ;
BEGIN
    v_last_activity := get_last_financial_activity(p_user_id);

    IF v_last_activity IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN v_last_activity >= (now() - (p_days || ' days')::INTERVAL);
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DECAY FUNCTIONS                                                             │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Record a decay event
CREATE FUNCTION record_decay_event(
    p_user_id UUID,
    p_decay_amount DECIMAL,
    p_reason TEXT,
    p_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_score RECORD;
    v_decay_reason decay_reason;
    v_history_id UUID;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Map reason string to enum
    v_decay_reason := CASE
        WHEN p_reason LIKE '%30%' THEN 'inactivity_30d'::decay_reason
        WHEN p_reason LIKE '%60%' THEN 'inactivity_60d'::decay_reason
        WHEN p_reason LIKE '%90%' THEN 'inactivity_90d'::decay_reason
        WHEN p_reason LIKE '%120%' THEN 'inactivity_120d'::decay_reason
        WHEN p_reason LIKE '%180%' THEN 'inactivity_180d'::decay_reason
        WHEN p_reason LIKE '%240%' THEN 'inactivity_240d'::decay_reason
        WHEN p_reason LIKE '%365%' THEN 'inactivity_365d'::decay_reason
        WHEN p_reason LIKE '%manual%' THEN 'manual_decay'::decay_reason
        WHEN p_reason LIKE '%suspend%' THEN 'suspension_decay'::decay_reason
        WHEN p_reason LIKE '%fraud%' THEN 'fraud_decay'::decay_reason
        ELSE 'inactivity_90d'::decay_reason
    END;

    INSERT INTO xnscore_decay_history (
        user_id, decay_reason, decay_amount,
        score_before, score_after,
        days_inactive, last_financial_activity_at,
        total_decay_this_period, decay_details
    ) VALUES (
        p_user_id, v_decay_reason, ABS(p_decay_amount),
        v_score.total_score, GREATEST(15, v_score.total_score + p_decay_amount),
        v_score.financial_inactive_days, v_score.last_financial_activity_at,
        COALESCE(v_score.total_inactivity_penalty, 0) + ABS(p_decay_amount),
        p_details
    )
    RETURNING id INTO v_history_id;

    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql;

-- Apply inactivity decay to a single user
CREATE FUNCTION apply_inactivity_decay(p_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    decay_applied DECIMAL,
    previous_score DECIMAL,
    new_score DECIMAL,
    inactive_days INTEGER,
    decay_reason TEXT
) AS $$
DECLARE
    v_score RECORD;
    v_last_activity TIMESTAMPTZ;
    v_days_inactive INTEGER;
    v_decay_amount DECIMAL;
    v_new_score DECIMAL;
    v_score_floor DECIMAL := 15.00; -- Minimum score floor
    v_threshold_crossed TEXT;
    v_previous_threshold INTEGER;
BEGIN
    -- Get current score
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0, 'User not found'::TEXT;
        RETURN;
    END IF;

    -- Skip if score is frozen
    IF v_score.score_frozen THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score, 0, 'Score frozen'::TEXT;
        RETURN;
    END IF;

    -- Skip if in recovery period (no decay during recovery)
    IF v_score.in_recovery_period AND v_score.recovery_ends_at > now() THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score, 0, 'In recovery period'::TEXT;
        RETURN;
    END IF;

    -- Get last financial activity
    v_last_activity := COALESCE(
        v_score.last_financial_activity_at,
        get_last_financial_activity(p_user_id)
    );

    -- If no activity ever, use account creation date
    IF v_last_activity IS NULL THEN
        SELECT created_at INTO v_last_activity FROM profiles WHERE id = p_user_id;
    END IF;

    -- Calculate days inactive
    v_days_inactive := EXTRACT(DAY FROM (now() - v_last_activity))::INTEGER;

    -- Get the previous threshold that was already applied
    v_previous_threshold := CASE
        WHEN v_score.financial_inactive_days >= 365 THEN 365
        WHEN v_score.financial_inactive_days >= 240 THEN 240
        WHEN v_score.financial_inactive_days >= 180 THEN 180
        WHEN v_score.financial_inactive_days >= 120 THEN 120
        WHEN v_score.financial_inactive_days >= 90 THEN 90
        WHEN v_score.financial_inactive_days >= 60 THEN 60
        WHEN v_score.financial_inactive_days >= 30 THEN 30
        ELSE 0
    END;

    -- Determine if we've crossed a NEW threshold
    v_threshold_crossed := CASE
        WHEN v_days_inactive >= 365 AND v_previous_threshold < 365 THEN 'inactivity_365d'
        WHEN v_days_inactive >= 240 AND v_previous_threshold < 240 THEN 'inactivity_240d'
        WHEN v_days_inactive >= 180 AND v_previous_threshold < 180 THEN 'inactivity_180d'
        WHEN v_days_inactive >= 120 AND v_previous_threshold < 120 THEN 'inactivity_120d'
        WHEN v_days_inactive >= 90 AND v_previous_threshold < 90 THEN 'inactivity_90d'
        WHEN v_days_inactive >= 60 AND v_previous_threshold < 60 THEN 'inactivity_60d'
        WHEN v_days_inactive >= 30 AND v_previous_threshold < 30 THEN 'inactivity_30d'
        ELSE NULL
    END;

    -- If no new threshold crossed, no decay needed
    IF v_threshold_crossed IS NULL THEN
        -- Just update the inactive days counter
        UPDATE xn_scores SET
            financial_inactive_days = v_days_inactive,
            last_financial_activity_at = v_last_activity,
            updated_at = now()
        WHERE xn_scores.user_id = p_user_id;

        RETURN QUERY SELECT TRUE, 0::DECIMAL, v_score.total_score, v_score.total_score, v_days_inactive, 'No new threshold'::TEXT;
        RETURN;
    END IF;

    -- Get decay amount for this threshold
    v_decay_amount := CASE v_threshold_crossed
        WHEN 'inactivity_30d' THEN -3.00
        WHEN 'inactivity_60d' THEN -6.00
        WHEN 'inactivity_90d' THEN -10.00
        WHEN 'inactivity_120d' THEN -15.00
        WHEN 'inactivity_180d' THEN -20.00
        WHEN 'inactivity_240d' THEN -25.00
        WHEN 'inactivity_365d' THEN -30.00
        ELSE 0.00
    END;

    -- Calculate new score (with floor protection)
    v_new_score := GREATEST(v_score_floor, v_score.total_score + v_decay_amount);

    -- Record decay event
    PERFORM record_decay_event(
        p_user_id,
        v_decay_amount,
        v_threshold_crossed,
        jsonb_build_object(
            'days_inactive', v_days_inactive,
            'previous_threshold', v_previous_threshold,
            'last_activity', v_last_activity
        )
    );

    -- Apply the decay using existing adjustment function
    PERFORM apply_xnscore_adjustment(
        p_user_id,
        v_decay_amount,
        v_threshold_crossed,
        NULL
    );

    -- Update tracking fields
    UPDATE xn_scores SET
        financial_inactive_days = v_days_inactive,
        last_financial_activity_at = v_last_activity,
        total_inactivity_penalty = COALESCE(total_inactivity_penalty, 0) + ABS(v_decay_amount),
        decay_floor_reached = (v_new_score <= v_score_floor),
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    RETURN QUERY SELECT TRUE, ABS(v_decay_amount), v_score.total_score, v_new_score, v_days_inactive, v_threshold_crossed;
END;
$$ LANGUAGE plpgsql;

-- Process all inactive users for decay
CREATE FUNCTION process_all_inactivity_decays()
RETURNS TABLE (
    users_processed INTEGER,
    users_decayed INTEGER,
    total_decay_applied DECIMAL
) AS $$
DECLARE
    v_processed INTEGER := 0;
    v_decayed INTEGER := 0;
    v_total_decay DECIMAL := 0;
    v_user RECORD;
    v_result RECORD;
BEGIN
    -- Process all users who may need decay
    FOR v_user IN
        SELECT xs.user_id
        FROM xn_scores xs
        WHERE xs.total_score > 15  -- Above floor
        AND xs.score_frozen = FALSE
        AND (
            xs.last_financial_activity_at IS NULL
            OR xs.last_financial_activity_at < now() - INTERVAL '30 days'
        )
        AND (
            xs.in_recovery_period = FALSE
            OR xs.recovery_ends_at < now()
        )
    LOOP
        v_processed := v_processed + 1;

        SELECT * INTO v_result FROM apply_inactivity_decay(v_user.user_id);

        IF v_result.success AND v_result.decay_applied > 0 THEN
            v_decayed := v_decayed + 1;
            v_total_decay := v_total_decay + v_result.decay_applied;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_decayed, v_total_decay;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TENURE BONUS FUNCTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Record a tenure bonus event
CREATE FUNCTION record_tenure_event(
    p_user_id UUID,
    p_bonus_amount DECIMAL,
    p_month_number INTEGER
)
RETURNS UUID AS $$
DECLARE
    v_score RECORD;
    v_history_id UUID;
    v_total_tenure DECIMAL;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_total_tenure := COALESCE(v_score.tenure_bonus, 0) + p_bonus_amount;

    INSERT INTO xnscore_tenure_history (
        user_id, tenure_month, bonus_amount,
        score_before, score_after,
        was_active_this_month, had_on_time_payment,
        contribution_count_this_month, total_tenure_bonus_earned
    ) VALUES (
        p_user_id, p_month_number, p_bonus_amount,
        v_score.total_score, v_score.total_score + p_bonus_amount,
        TRUE, v_score.on_time_payments_this_month > 0,
        v_score.contributions_this_month, v_total_tenure
    )
    ON CONFLICT (user_id, tenure_month) DO NOTHING
    RETURNING id INTO v_history_id;

    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql;

-- Apply tenure bonus to a single user
CREATE FUNCTION apply_tenure_bonus(p_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    bonus_applied DECIMAL,
    previous_score DECIMAL,
    new_score DECIMAL,
    tenure_month INTEGER,
    reason TEXT
) AS $$
DECLARE
    v_score RECORD;
    v_profile RECORD;
    v_months_since_creation INTEGER;
    v_eligible_month INTEGER;
    v_bonus_amount DECIMAL := 1.00; -- +1 per month
    v_max_tenure_bonus DECIMAL := 25.00; -- Cap at +25
    v_already_earned INTEGER;
    v_new_score DECIMAL;
BEGIN
    -- Get current score
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0, 'User not found'::TEXT;
        RETURN;
    END IF;

    -- Get profile for account age
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

    -- Calculate months since account creation
    v_months_since_creation := EXTRACT(MONTH FROM age(now(), v_profile.created_at))::INTEGER +
                               (EXTRACT(YEAR FROM age(now(), v_profile.created_at))::INTEGER * 12);

    -- Check if already maxed out
    IF COALESCE(v_score.tenure_bonus, 0) >= v_max_tenure_bonus THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score,
            v_score.tenure_months_earned, 'Max tenure bonus reached'::TEXT;
        RETURN;
    END IF;

    -- Check if active this month (must have made at least 1 contribution)
    IF NOT is_user_financially_active(p_user_id, 30) THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score,
            v_score.tenure_months_earned, 'Not active this month'::TEXT;
        RETURN;
    END IF;

    -- Calculate which month they're eligible for
    v_already_earned := COALESCE(v_score.tenure_months_earned, 0);
    v_eligible_month := v_already_earned + 1;

    -- Check if enough time has passed
    IF v_months_since_creation < v_eligible_month THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score,
            v_already_earned, 'Not enough tenure yet'::TEXT;
        RETURN;
    END IF;

    -- Check if this month already granted
    IF EXISTS (
        SELECT 1 FROM xnscore_tenure_history
        WHERE user_id = p_user_id AND tenure_month = v_eligible_month
    ) THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, v_score.total_score, v_score.total_score,
            v_eligible_month, 'Already earned this month'::TEXT;
        RETURN;
    END IF;

    -- Apply recovery multiplier if active
    IF v_score.in_recovery_period AND v_score.recovery_ends_at > now() THEN
        v_bonus_amount := v_bonus_amount * COALESCE(v_score.recovery_multiplier, 1.5);
    END IF;

    -- Cap the bonus if it would exceed max
    IF (COALESCE(v_score.tenure_bonus, 0) + v_bonus_amount) > v_max_tenure_bonus THEN
        v_bonus_amount := v_max_tenure_bonus - COALESCE(v_score.tenure_bonus, 0);
    END IF;

    -- Record tenure event
    PERFORM record_tenure_event(p_user_id, v_bonus_amount, v_eligible_month);

    -- Apply the bonus using existing adjustment function
    PERFORM apply_xnscore_adjustment(
        p_user_id,
        v_bonus_amount,
        format('tenure_bonus_month_%s', v_eligible_month),
        NULL
    );

    -- Update tracking fields
    UPDATE xn_scores SET
        tenure_bonus = COALESCE(tenure_bonus, 0) + v_bonus_amount,
        tenure_months_earned = v_eligible_month,
        next_tenure_check_date = (now() + INTERVAL '1 month')::DATE,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    v_new_score := v_score.total_score + v_bonus_amount;

    RETURN QUERY SELECT TRUE, v_bonus_amount, v_score.total_score, v_new_score,
        v_eligible_month, 'Tenure bonus applied'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Process all users for tenure bonus
CREATE FUNCTION process_all_tenure_bonuses()
RETURNS TABLE (
    users_processed INTEGER,
    users_awarded INTEGER,
    total_bonus_applied DECIMAL
) AS $$
DECLARE
    v_processed INTEGER := 0;
    v_awarded INTEGER := 0;
    v_total_bonus DECIMAL := 0;
    v_user RECORD;
    v_result RECORD;
BEGIN
    -- Process all users who may be eligible
    FOR v_user IN
        SELECT xs.user_id
        FROM xn_scores xs
        JOIN profiles p ON p.id = xs.user_id
        WHERE xs.score_frozen = FALSE
        AND COALESCE(xs.tenure_bonus, 0) < 25  -- Not maxed
        AND (
            xs.next_tenure_check_date IS NULL
            OR xs.next_tenure_check_date <= CURRENT_DATE
        )
    LOOP
        v_processed := v_processed + 1;

        SELECT * INTO v_result FROM apply_tenure_bonus(v_user.user_id);

        IF v_result.success THEN
            v_awarded := v_awarded + 1;
            v_total_bonus := v_total_bonus + v_result.bonus_applied;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_processed, v_awarded, v_total_bonus;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ RECOVERY PERIOD FUNCTIONS                                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Start a recovery period for a returning user
CREATE FUNCTION start_recovery_period(
    p_user_id UUID,
    p_trigger TEXT,
    p_trigger_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_score RECORD;
    v_trigger_type recovery_trigger_type;
    v_recovery_id UUID;
    v_recovery_days INTEGER := 90; -- 90 day recovery period
    v_multiplier DECIMAL := 1.50; -- 1.5x multiplier
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Don't start if already in recovery
    IF v_score.in_recovery_period AND v_score.recovery_ends_at > now() THEN
        RETURN v_score.recovery_period_id;
    END IF;

    -- Must have had significant decay to qualify
    IF COALESCE(v_score.total_inactivity_penalty, 0) < 10 THEN
        RETURN NULL;
    END IF;

    -- Map trigger to enum
    v_trigger_type := CASE
        WHEN p_trigger LIKE '%contribution%' THEN 'first_contribution_after_inactivity'::recovery_trigger_type
        WHEN p_trigger LIKE '%payout%' THEN 'first_payout_received'::recovery_trigger_type
        WHEN p_trigger LIKE '%debt%' OR p_trigger LIKE '%repaid%' THEN 'debt_fully_repaid'::recovery_trigger_type
        WHEN p_trigger LIKE '%suspension%' THEN 'suspension_lifted'::recovery_trigger_type
        ELSE 'manual_recovery_granted'::recovery_trigger_type
    END;

    -- Create recovery period
    INSERT INTO xnscore_recovery_periods (
        user_id, trigger_type, trigger_event_id,
        ends_at, recovery_multiplier,
        score_at_start, decay_total_before_recovery
    ) VALUES (
        p_user_id, v_trigger_type, p_trigger_id,
        now() + (v_recovery_days || ' days')::INTERVAL, v_multiplier,
        v_score.total_score, v_score.total_inactivity_penalty
    )
    RETURNING id INTO v_recovery_id;

    -- Update xn_scores
    UPDATE xn_scores SET
        in_recovery_period = TRUE,
        recovery_period_id = v_recovery_id,
        recovery_ends_at = now() + (v_recovery_days || ' days')::INTERVAL,
        recovery_multiplier = v_multiplier,
        -- Reset inactivity tracking
        financial_inactive_days = 0,
        total_inactivity_penalty = 0,
        decay_floor_reached = FALSE,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Log to history
    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, trigger_id, trigger_details
    ) VALUES (
        p_user_id, v_score.total_score, v_score.total_score, 0,
        'recovery_period_started', v_recovery_id,
        format('90-day recovery period started. 1.5x bonus multiplier active until %s',
            (now() + (v_recovery_days || ' days')::INTERVAL)::DATE)
    );

    RETURN v_recovery_id;
END;
$$ LANGUAGE plpgsql;

-- End a recovery period
CREATE FUNCTION end_recovery_period(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_score RECORD;
    v_recovery RECORD;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND OR NOT v_score.in_recovery_period THEN
        RETURN FALSE;
    END IF;

    -- Update recovery period record
    UPDATE xnscore_recovery_periods SET
        is_active = FALSE,
        ended_at = now(),
        ended_reason = CASE
            WHEN ends_at <= now() THEN 'completed'
            ELSE 'manual_end'
        END,
        score_at_end = v_score.total_score,
        updated_at = now()
    WHERE id = v_score.recovery_period_id;

    -- Update xn_scores
    UPDATE xn_scores SET
        in_recovery_period = FALSE,
        recovery_period_id = NULL,
        recovery_ends_at = NULL,
        recovery_multiplier = 1.00,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Log to history
    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, trigger_details
    ) VALUES (
        p_user_id, v_score.total_score, v_score.total_score, 0,
        'recovery_period_ended', 'Recovery period completed'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Check and apply recovery multiplier to a bonus
CREATE FUNCTION check_and_apply_recovery_multiplier(
    p_user_id UUID,
    p_base_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    v_score RECORD;
    v_multiplied DECIMAL;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN p_base_amount;
    END IF;

    -- Check if in active recovery period
    IF v_score.in_recovery_period AND v_score.recovery_ends_at > now() THEN
        v_multiplied := p_base_amount * COALESCE(v_score.recovery_multiplier, 1.5);

        -- Track usage
        UPDATE xnscore_recovery_periods SET
            bonus_events_during_recovery = bonus_events_during_recovery + 1,
            total_bonus_earned_during = total_bonus_earned_during + (v_multiplied - p_base_amount),
            updated_at = now()
        WHERE id = v_score.recovery_period_id;

        RETURN v_multiplied;
    END IF;

    RETURN p_base_amount;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ACTIVITY TRACKING                                                           │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Update financial activity tracking
CREATE FUNCTION update_financial_activity(
    p_user_id UUID,
    p_activity_type TEXT,
    p_event_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_score RECORD;
    v_was_inactive BOOLEAN;
    v_inactive_days INTEGER;
BEGIN
    SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        -- Create score record if doesn't exist
        PERFORM calculate_initial_xnscore(p_user_id);
        SELECT * INTO v_score FROM xn_scores WHERE user_id = p_user_id;
    END IF;

    -- Check if user was significantly inactive
    v_was_inactive := COALESCE(v_score.financial_inactive_days, 0) >= 30;
    v_inactive_days := COALESCE(v_score.financial_inactive_days, 0);

    -- Update appropriate activity timestamp
    UPDATE xn_scores SET
        last_activity_at = now(),
        last_financial_activity_at = now(),
        financial_inactive_days = 0,
        consecutive_inactive_days = 0,
        last_contribution_at = CASE WHEN p_activity_type = 'contribution' THEN now() ELSE last_contribution_at END,
        last_payout_received_at = CASE WHEN p_activity_type = 'payout' THEN now() ELSE last_payout_received_at END,
        last_wallet_deposit_at = CASE WHEN p_activity_type = 'wallet_deposit' THEN now() ELSE last_wallet_deposit_at END,
        last_savings_activity_at = CASE WHEN p_activity_type = 'savings' THEN now() ELSE last_savings_activity_at END,
        last_remittance_at = CASE WHEN p_activity_type = 'remittance' THEN now() ELSE last_remittance_at END,
        contributions_this_month = CASE
            WHEN p_activity_type = 'contribution' THEN COALESCE(contributions_this_month, 0) + 1
            ELSE contributions_this_month
        END,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Start recovery period if returning from significant inactivity
    IF v_was_inactive AND v_inactive_days >= 60 THEN
        PERFORM start_recovery_period(
            p_user_id,
            p_activity_type || '_after_inactivity',
            p_event_id
        );
    END IF;

    -- End expired recovery periods
    IF v_score.in_recovery_period AND v_score.recovery_ends_at <= now() THEN
        PERFORM end_recovery_period(p_user_id);
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SCHEDULED JOB FUNCTIONS                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Daily decay check (run via cron/pg_cron)
CREATE FUNCTION process_daily_decay_check()
RETURNS JSONB AS $$
DECLARE
    v_decay_result RECORD;
    v_expired_recoveries INTEGER := 0;
    v_user RECORD;
BEGIN
    -- 1. Process inactivity decays
    SELECT * INTO v_decay_result FROM process_all_inactivity_decays();

    -- 2. End expired recovery periods
    FOR v_user IN
        SELECT user_id FROM xn_scores
        WHERE in_recovery_period = TRUE
        AND recovery_ends_at <= now()
    LOOP
        PERFORM end_recovery_period(v_user.user_id);
        v_expired_recoveries := v_expired_recoveries + 1;
    END LOOP;

    -- 3. Reset monthly counters if new month
    UPDATE xn_scores SET
        contributions_this_month = 0,
        on_time_payments_this_month = 0,
        current_month_start = date_trunc('month', now())::DATE
    WHERE current_month_start IS NULL
       OR current_month_start < date_trunc('month', now())::DATE;

    RETURN jsonb_build_object(
        'decay_users_processed', v_decay_result.users_processed,
        'decay_users_decayed', v_decay_result.users_decayed,
        'decay_total_applied', v_decay_result.total_decay_applied,
        'expired_recoveries', v_expired_recoveries,
        'run_at', now()
    );
END;
$$ LANGUAGE plpgsql;

-- Monthly tenure check (run via cron/pg_cron on 1st of month)
CREATE FUNCTION process_monthly_tenure_check()
RETURNS JSONB AS $$
DECLARE
    v_tenure_result RECORD;
BEGIN
    -- Process tenure bonuses
    SELECT * INTO v_tenure_result FROM process_all_tenure_bonuses();

    RETURN jsonb_build_object(
        'tenure_users_processed', v_tenure_result.users_processed,
        'tenure_users_awarded', v_tenure_result.users_awarded,
        'tenure_total_bonus', v_tenure_result.total_bonus_applied,
        'run_at', now()
    );
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REPLACE EXISTING DECAY FUNCTION                                             │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Override the basic decay function from migration 019
CREATE OR REPLACE FUNCTION decay_inactive_scores()
RETURNS INTEGER AS $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM process_all_inactivity_decays();
    RETURN v_result.users_decayed;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Users at risk of decay
CREATE VIEW v_decay_at_risk_users AS
SELECT
    xs.user_id,
    p.full_name,
    p.email,
    xs.total_score,
    xs.score_tier,
    xs.financial_inactive_days,
    xs.last_financial_activity_at,
    xs.total_inactivity_penalty,
    CASE
        WHEN xs.financial_inactive_days >= 240 THEN 'critical'
        WHEN xs.financial_inactive_days >= 180 THEN 'severe'
        WHEN xs.financial_inactive_days >= 120 THEN 'high'
        WHEN xs.financial_inactive_days >= 90 THEN 'moderate'
        WHEN xs.financial_inactive_days >= 60 THEN 'warning'
        WHEN xs.financial_inactive_days >= 30 THEN 'low'
        ELSE 'none'
    END as risk_level,
    CASE
        WHEN xs.financial_inactive_days >= 30 AND xs.financial_inactive_days < 60 THEN 60 - xs.financial_inactive_days
        WHEN xs.financial_inactive_days >= 60 AND xs.financial_inactive_days < 90 THEN 90 - xs.financial_inactive_days
        WHEN xs.financial_inactive_days >= 90 AND xs.financial_inactive_days < 120 THEN 120 - xs.financial_inactive_days
        WHEN xs.financial_inactive_days >= 120 AND xs.financial_inactive_days < 180 THEN 180 - xs.financial_inactive_days
        WHEN xs.financial_inactive_days >= 180 AND xs.financial_inactive_days < 240 THEN 240 - xs.financial_inactive_days
        WHEN xs.financial_inactive_days >= 240 AND xs.financial_inactive_days < 365 THEN 365 - xs.financial_inactive_days
        ELSE NULL
    END as days_until_next_decay,
    get_decay_rate(
        CASE
            WHEN xs.financial_inactive_days < 60 THEN 60
            WHEN xs.financial_inactive_days < 90 THEN 90
            WHEN xs.financial_inactive_days < 120 THEN 120
            WHEN xs.financial_inactive_days < 180 THEN 180
            WHEN xs.financial_inactive_days < 240 THEN 240
            ELSE 365
        END
    ) as next_decay_amount
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id
WHERE xs.financial_inactive_days >= 20  -- Alert before 30 day threshold
AND xs.score_frozen = FALSE
AND xs.total_score > 15
ORDER BY xs.financial_inactive_days DESC;

-- Users eligible for tenure bonus
CREATE VIEW v_tenure_eligible_users AS
SELECT
    xs.user_id,
    p.full_name,
    p.email,
    xs.total_score,
    xs.tenure_bonus,
    xs.tenure_months_earned,
    EXTRACT(MONTH FROM age(now(), p.created_at))::INTEGER +
        (EXTRACT(YEAR FROM age(now(), p.created_at))::INTEGER * 12) as account_months,
    25 - COALESCE(xs.tenure_bonus, 0) as remaining_tenure_bonus,
    xs.next_tenure_check_date,
    xs.contributions_this_month,
    CASE WHEN xs.contributions_this_month > 0 THEN TRUE ELSE FALSE END as active_this_month
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id
WHERE COALESCE(xs.tenure_bonus, 0) < 25
AND xs.score_frozen = FALSE
ORDER BY xs.tenure_months_earned DESC, xs.total_score DESC;

-- Users in recovery period
CREATE VIEW v_recovery_period_users AS
SELECT
    xs.user_id,
    p.full_name,
    p.email,
    xs.total_score,
    xs.in_recovery_period,
    xs.recovery_ends_at,
    xs.recovery_multiplier,
    rp.trigger_type,
    rp.started_at as recovery_started,
    rp.score_at_start,
    rp.decay_total_before_recovery,
    rp.bonus_events_during_recovery,
    rp.total_bonus_earned_during,
    EXTRACT(DAY FROM (xs.recovery_ends_at - now()))::INTEGER as days_remaining
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id
LEFT JOIN xnscore_recovery_periods rp ON rp.id = xs.recovery_period_id
WHERE xs.in_recovery_period = TRUE
AND xs.recovery_ends_at > now()
ORDER BY xs.recovery_ends_at ASC;

-- Activity summary view
CREATE VIEW v_xnscore_activity_summary AS
SELECT
    xs.user_id,
    p.full_name,
    xs.total_score,
    xs.score_tier,

    -- Activity timestamps
    xs.last_financial_activity_at,
    xs.last_contribution_at,
    xs.last_payout_received_at,
    xs.last_wallet_deposit_at,
    xs.last_savings_activity_at,

    -- Inactivity
    xs.financial_inactive_days,
    xs.total_inactivity_penalty,
    xs.decay_floor_reached,

    -- Tenure
    xs.tenure_bonus,
    xs.tenure_months_earned,

    -- Recovery
    xs.in_recovery_period,
    xs.recovery_ends_at,
    xs.recovery_multiplier,

    -- Monthly stats
    xs.contributions_this_month,
    xs.on_time_payments_this_month,

    -- Status
    CASE
        WHEN xs.score_frozen THEN 'frozen'
        WHEN xs.in_recovery_period THEN 'recovering'
        WHEN xs.financial_inactive_days >= 90 THEN 'at_risk'
        WHEN xs.financial_inactive_days >= 30 THEN 'inactive'
        ELSE 'active'
    END as activity_status
FROM xn_scores xs
JOIN profiles p ON p.id = xs.user_id;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE xnscore_decay_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_tenure_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE xnscore_recovery_periods ENABLE ROW LEVEL SECURITY;

-- Decay history: Only own
CREATE POLICY "decay_history_own" ON xnscore_decay_history FOR SELECT
USING (user_id = auth.uid());

-- Tenure history: Only own
CREATE POLICY "tenure_history_own" ON xnscore_tenure_history FOR SELECT
USING (user_id = auth.uid());

-- Recovery periods: Only own
CREATE POLICY "recovery_periods_own" ON xnscore_recovery_periods FOR SELECT
USING (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Trigger to update financial activity on contribution
CREATE OR REPLACE FUNCTION trigger_contribution_activity() RETURNS TRIGGER AS $$
BEGIN
    -- Track when contribution is completed or late (both mean paid)
    IF NEW.status IN ('completed', 'late') AND (OLD IS NULL OR OLD.status NOT IN ('completed', 'late')) THEN
        PERFORM update_financial_activity(NEW.user_id, 'contribution', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_contribution_activity ON contributions;
CREATE TRIGGER tr_contribution_activity
    AFTER INSERT OR UPDATE OF status ON contributions
    FOR EACH ROW EXECUTE FUNCTION trigger_contribution_activity();

-- Trigger to update financial activity on payout
CREATE OR REPLACE FUNCTION trigger_payout_activity() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.execution_status = 'completed' AND (OLD IS NULL OR OLD.execution_status != 'completed') THEN
        PERFORM update_financial_activity(NEW.recipient_user_id, 'payout', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_payout_activity ON payout_executions;
CREATE TRIGGER tr_payout_activity
    AFTER INSERT OR UPDATE OF execution_status ON payout_executions
    FOR EACH ROW EXECUTE FUNCTION trigger_payout_activity();

-- Trigger to update financial activity on wallet deposit
CREATE OR REPLACE FUNCTION trigger_wallet_deposit_activity() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type IN ('deposit', 'incoming_transfer')
       AND NEW.transaction_status = 'completed'
       AND (OLD IS NULL OR OLD.transaction_status != 'completed') THEN
        PERFORM update_financial_activity(NEW.user_id, 'wallet_deposit', NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_wallet_deposit_activity ON wallet_transactions;
CREATE TRIGGER tr_wallet_deposit_activity
    AFTER INSERT OR UPDATE OF transaction_status ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION trigger_wallet_deposit_activity();

-- Update timestamp trigger for recovery periods
CREATE OR REPLACE FUNCTION update_recovery_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_recovery_periods_updated
    BEFORE UPDATE ON xnscore_recovery_periods
    FOR EACH ROW EXECUTE FUNCTION update_recovery_timestamp();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME SUBSCRIPTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE xnscore_decay_history;
ALTER PUBLICATION supabase_realtime ADD TABLE xnscore_recovery_periods;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 020
-- ══════════════════════════════════════════════════════════════════════════════
