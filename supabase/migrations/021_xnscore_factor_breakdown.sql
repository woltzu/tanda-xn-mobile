-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 021: XnScore Factor Breakdown System
-- ══════════════════════════════════════════════════════════════════════════════
-- Score transparency transforms XnScore from a mysterious number into a trust roadmap.
--
-- 5 Scoring Factors:
-- 1. Payment Reliability (35% weight) - 35 pts max
-- 2. Circle Completion (20% weight) - 20 pts max
-- 3. Tenure & Activity (15% weight) - 15 pts max
-- 4. Community Standing (15% weight) - 15 pts max
-- 5. Financial Behavior (15% weight) - 15 pts max
--
-- Features:
-- - Component-level score tracking
-- - Improvement tips generation
-- - Score breakdown caching
-- - Factor history over time
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop existing objects if partial migration occurred               │
-- └─────────────────────────────────────────────────────────────────────────────┘

DROP VIEW IF EXISTS v_user_score_breakdown CASCADE;
DROP VIEW IF EXISTS v_factor_performance_summary CASCADE;
DROP VIEW IF EXISTS v_improvement_opportunities CASCADE;

DROP FUNCTION IF EXISTS calculate_score_breakdown(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_score_breakdown(UUID) CASCADE;
DROP FUNCTION IF EXISTS refresh_score_breakdown(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_improvement_tips(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_factor_percentile(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_payment_reliability_factor(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_circle_completion_factor(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_tenure_activity_factor(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_community_standing_factor(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_financial_behavior_factor(UUID) CASCADE;
DROP FUNCTION IF EXISTS process_all_breakdown_refreshes() CASCADE;
DROP FUNCTION IF EXISTS recalculate_full_xnscore(UUID) CASCADE;

DROP TABLE IF EXISTS xn_score_breakdown_cache CASCADE;
DROP TABLE IF EXISTS xn_score_improvement_tips CASCADE;
DROP TABLE IF EXISTS xn_score_factor_components CASCADE;
DROP TABLE IF EXISTS xn_score_factor_definitions CASCADE;

DROP TYPE IF EXISTS factor_trend CASCADE;
DROP TYPE IF EXISTS factor_status CASCADE;
DROP TYPE IF EXISTS tip_priority CASCADE;
DROP TYPE IF EXISTS tip_category CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE factor_status AS ENUM (
    'excellent',    -- 90%+ of max
    'good',         -- 70-89% of max
    'fair',         -- 50-69% of max
    'needs_work',   -- 30-49% of max
    'critical'      -- <30% of max
);

CREATE TYPE factor_trend AS ENUM (
    'improving',
    'stable',
    'declining'
);

CREATE TYPE tip_priority AS ENUM (
    'high',
    'medium',
    'low'
);

CREATE TYPE tip_category AS ENUM (
    'payment',
    'completion',
    'tenure',
    'community',
    'financial'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ FACTOR DEFINITIONS TABLE                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE xn_score_factor_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_key TEXT NOT NULL UNIQUE,

    -- Display info
    factor_name TEXT NOT NULL,
    factor_description TEXT NOT NULL,
    factor_icon TEXT, -- Emoji or icon name

    -- Scoring
    weight_percentage INTEGER NOT NULL, -- 15, 20, 35 etc.
    max_points DECIMAL(5,2) NOT NULL,

    -- Components this factor includes
    component_count INTEGER NOT NULL DEFAULT 0,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ FACTOR COMPONENTS TABLE                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE xn_score_factor_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    factor_id UUID NOT NULL REFERENCES xn_score_factor_definitions(id) ON DELETE CASCADE,
    component_key TEXT NOT NULL,

    -- Display info
    component_name TEXT NOT NULL,
    component_description TEXT NOT NULL,

    -- Scoring
    max_points DECIMAL(5,2) NOT NULL,
    calculation_formula TEXT, -- For documentation

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    show_in_breakdown BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_factor_component UNIQUE(factor_id, component_key)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ IMPROVEMENT TIPS TABLE                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE xn_score_improvement_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Targeting
    factor_key TEXT NOT NULL,
    component_key TEXT, -- NULL means applies to whole factor

    -- Tip content
    tip_title TEXT NOT NULL,
    tip_description TEXT NOT NULL,
    tip_action TEXT NOT NULL, -- Specific action user can take

    -- Conditions for showing
    min_score_threshold DECIMAL(5,2), -- Show if score below this
    max_score_threshold DECIMAL(5,2), -- Show if score above this
    condition_query TEXT, -- Optional SQL condition

    -- Metadata
    priority tip_priority NOT NULL DEFAULT 'medium',
    category tip_category NOT NULL,
    potential_points DECIMAL(5,2), -- How many points this could add

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ BREAKDOWN CACHE TABLE                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE xn_score_breakdown_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

    -- Total score
    total_score DECIMAL(5,2) NOT NULL,

    -- Factor scores
    payment_reliability_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    payment_reliability_status factor_status NOT NULL DEFAULT 'needs_work',
    payment_reliability_trend factor_trend NOT NULL DEFAULT 'stable',

    circle_completion_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    circle_completion_status factor_status NOT NULL DEFAULT 'needs_work',
    circle_completion_trend factor_trend NOT NULL DEFAULT 'stable',

    tenure_activity_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    tenure_activity_status factor_status NOT NULL DEFAULT 'needs_work',
    tenure_activity_trend factor_trend NOT NULL DEFAULT 'stable',

    community_standing_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    community_standing_status factor_status NOT NULL DEFAULT 'needs_work',
    community_standing_trend factor_trend NOT NULL DEFAULT 'stable',

    financial_behavior_score DECIMAL(5,2) NOT NULL DEFAULT 0,
    financial_behavior_status factor_status NOT NULL DEFAULT 'needs_work',
    financial_behavior_trend factor_trend NOT NULL DEFAULT 'stable',

    -- Detailed breakdown JSON
    factor_breakdown JSONB NOT NULL DEFAULT '{}',
    component_breakdown JSONB NOT NULL DEFAULT '{}',

    -- Improvement tips
    improvement_tips JSONB NOT NULL DEFAULT '[]',
    top_improvement_potential DECIMAL(5,2) DEFAULT 0,

    -- Percentiles
    overall_percentile INTEGER,
    factor_percentiles JSONB DEFAULT '{}',

    -- Cache metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '1 hour'),
    calculation_version INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ALTER XN_SCORES TABLE                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Add breakdown-related columns
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS factor_scores JSONB DEFAULT '{}';
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS breakdown_cached_at TIMESTAMPTZ;
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS improvement_tips_cache JSONB DEFAULT '[]';
ALTER TABLE xn_scores ADD COLUMN IF NOT EXISTS top_improvement_factor TEXT;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_factor_definitions_key ON xn_score_factor_definitions(factor_key);
CREATE INDEX idx_factor_definitions_active ON xn_score_factor_definitions(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_factor_components_factor ON xn_score_factor_components(factor_id);
CREATE INDEX idx_factor_components_key ON xn_score_factor_components(component_key);

CREATE INDEX idx_improvement_tips_factor ON xn_score_improvement_tips(factor_key);
CREATE INDEX idx_improvement_tips_active ON xn_score_improvement_tips(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_improvement_tips_priority ON xn_score_improvement_tips(priority);

CREATE INDEX idx_breakdown_cache_user ON xn_score_breakdown_cache(user_id);
CREATE INDEX idx_breakdown_cache_expires ON xn_score_breakdown_cache(expires_at);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SEED FACTOR DEFINITIONS                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Insert the 5 scoring factors
INSERT INTO xn_score_factor_definitions (factor_key, factor_name, factor_description, factor_icon, weight_percentage, max_points, component_count, display_order) VALUES
(
    'payment_reliability',
    'Payment Reliability',
    'How consistently you make on-time contributions to your circles. This is the most heavily weighted factor because payment behavior directly impacts other members.',
    '💳',
    35,
    35.00,
    4,
    1
),
(
    'circle_completion',
    'Circle Completion',
    'Your track record of completing full circle cycles without abandonment. Completing circles shows commitment and reliability to other members.',
    '🔄',
    20,
    20.00,
    3,
    2
),
(
    'tenure_activity',
    'Tenure & Activity',
    'How long you have been an active member and your ongoing engagement with the platform. Longer tenure with consistent activity builds trust.',
    '⏳',
    15,
    15.00,
    3,
    3
),
(
    'community_standing',
    'Community Standing',
    'Your reputation within the TandaXn community including vouches received, diversity of connections, and peer trust.',
    '🤝',
    15,
    15.00,
    4,
    4
),
(
    'financial_behavior',
    'Financial Behavior',
    'Your financial habits including wallet usage, deposit patterns, and responsible financial activity on the platform.',
    '📊',
    15,
    15.00,
    3,
    5
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SEED FACTOR COMPONENTS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Payment Reliability Components (35 pts max)
INSERT INTO xn_score_factor_components (factor_id, component_key, component_name, component_description, max_points, calculation_formula, display_order)
SELECT
    f.id,
    comp.component_key,
    comp.component_name,
    comp.component_description,
    comp.max_points,
    comp.calculation_formula,
    comp.display_order
FROM xn_score_factor_definitions f
CROSS JOIN (VALUES
    ('on_time_rate', 'On-Time Payment Rate', 'Percentage of payments made on time or early', 20.00, 'on_time_payments / total_payments * 20', 1),
    ('payment_streak', 'Current Payment Streak', 'Consecutive on-time payments', 8.00, 'MIN(streak, 20) / 20 * 8', 2),
    ('no_defaults', 'No Defaults', 'Never having defaulted on a payment', 5.00, 'has_defaults ? 0 : 5', 3),
    ('late_payment_recovery', 'Late Payment Recovery', 'Making up late payments within grace period', 2.00, 'recovered_late_payments / total_late * 2', 4)
) AS comp(component_key, component_name, component_description, max_points, calculation_formula, display_order)
WHERE f.factor_key = 'payment_reliability';

-- Circle Completion Components (20 pts max)
INSERT INTO xn_score_factor_components (factor_id, component_key, component_name, component_description, max_points, calculation_formula, display_order)
SELECT
    f.id,
    comp.component_key,
    comp.component_name,
    comp.component_description,
    comp.max_points,
    comp.calculation_formula,
    comp.display_order
FROM xn_score_factor_definitions f
CROSS JOIN (VALUES
    ('completion_rate', 'Completion Rate', 'Percentage of circles completed vs joined', 12.00, 'completed_circles / joined_circles * 12', 1),
    ('full_cycle_bonus', 'Full Cycle Completions', 'Number of full cycles completed', 5.00, 'MIN(full_cycles, 10) / 10 * 5', 2),
    ('no_abandonment', 'No Abandonment', 'Never having abandoned a circle mid-cycle', 3.00, 'abandoned_circles == 0 ? 3 : 0', 3)
) AS comp(component_key, component_name, component_description, max_points, calculation_formula, display_order)
WHERE f.factor_key = 'circle_completion';

-- Tenure & Activity Components (15 pts max)
INSERT INTO xn_score_factor_components (factor_id, component_key, component_name, component_description, max_points, calculation_formula, display_order)
SELECT
    f.id,
    comp.component_key,
    comp.component_name,
    comp.component_description,
    comp.max_points,
    comp.calculation_formula,
    comp.display_order
FROM xn_score_factor_definitions f
CROSS JOIN (VALUES
    ('account_age', 'Account Age', 'How long you have been a member', 5.00, 'MIN(months, 18) / 18 * 5', 1),
    ('tenure_bonus', 'Tenure Bonus', 'Monthly activity bonus accumulated over time', 7.00, 'MIN(tenure_bonus, 25) / 25 * 7', 2),
    ('recent_activity', 'Recent Activity', 'Activity level in the last 30 days', 3.00, 'has_recent_activity ? 3 : 0', 3)
) AS comp(component_key, component_name, component_description, max_points, calculation_formula, display_order)
WHERE f.factor_key = 'tenure_activity';

-- Community Standing Components (15 pts max)
INSERT INTO xn_score_factor_components (factor_id, component_key, component_name, component_description, max_points, calculation_formula, display_order)
SELECT
    f.id,
    comp.component_key,
    comp.component_name,
    comp.component_description,
    comp.max_points,
    comp.calculation_formula,
    comp.display_order
FROM xn_score_factor_definitions f
CROSS JOIN (VALUES
    ('vouches_received', 'Vouches Received', 'Trust vouches from other members', 5.00, 'MIN(total_vouch_value, 10) / 10 * 5', 1),
    ('member_diversity', 'Member Diversity', 'Number of unique circle members interacted with', 4.00, 'MIN(unique_members, 20) / 20 * 4', 2),
    ('elder_connections', 'Elder Connections', 'Number of different elders trusted you', 3.00, 'MIN(unique_elders, 5) / 5 * 3', 3),
    ('vouching_reliability', 'Vouching Reliability', 'How reliable your vouches are (vouchees not defaulting)', 3.00, 'voucher_reliability_score * 3', 4)
) AS comp(component_key, component_name, component_description, max_points, calculation_formula, display_order)
WHERE f.factor_key = 'community_standing';

-- Financial Behavior Components (15 pts max)
INSERT INTO xn_score_factor_components (factor_id, component_key, component_name, component_description, max_points, calculation_formula, display_order)
SELECT
    f.id,
    comp.component_key,
    comp.component_name,
    comp.component_description,
    comp.max_points,
    comp.calculation_formula,
    comp.display_order
FROM xn_score_factor_definitions f
CROSS JOIN (VALUES
    ('wallet_usage', 'Wallet Usage', 'Regular use of TandaXn wallet for deposits', 6.00, 'wallet_activity_score * 6', 1),
    ('payout_retention', 'Payout Retention', 'Keeping payouts in TandaXn ecosystem', 5.00, 'retention_rate * 5', 2),
    ('savings_engagement', 'Savings Engagement', 'Using savings goals feature', 4.00, 'has_savings_goals ? 4 : 0', 3)
) AS comp(component_key, component_name, component_description, max_points, calculation_formula, display_order)
WHERE f.factor_key = 'financial_behavior';

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SEED IMPROVEMENT TIPS                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Payment Reliability Tips
INSERT INTO xn_score_improvement_tips (factor_key, component_key, tip_title, tip_description, tip_action, min_score_threshold, max_score_threshold, priority, category, potential_points) VALUES
('payment_reliability', 'on_time_rate', 'Improve On-Time Payments', 'Your on-time payment rate is below 80%. Setting up auto-pay can help ensure you never miss a payment.', 'Enable auto-pay for your circles in Settings > Payment Preferences', NULL, 16.00, 'high', 'payment', 4.00),
('payment_reliability', 'payment_streak', 'Build Your Streak', 'You can earn bonus points by maintaining a payment streak. Keep making on-time payments!', 'Make your next 5 payments on time to boost your streak', NULL, 6.00, 'medium', 'payment', 2.00),
('payment_reliability', 'no_defaults', 'Recover from Default', 'A past default is hurting your score. Focus on making consistent on-time payments to rebuild trust.', 'Complete 6 consecutive on-time payments to begin recovery', NULL, 0.00, 'high', 'payment', 2.00),
('payment_reliability', NULL, 'Payment Excellence', 'Excellent payment reliability! Keep maintaining this to unlock premium circles.', 'Continue your great payment habits', 30.00, NULL, 'low', 'payment', 0.00);

-- Circle Completion Tips
INSERT INTO xn_score_improvement_tips (factor_key, component_key, tip_title, tip_description, tip_action, min_score_threshold, max_score_threshold, priority, category, potential_points) VALUES
('circle_completion', 'completion_rate', 'Complete Your Circles', 'Completing circles shows reliability. Make sure to stay committed until the end.', 'Stay in your current circle until completion', NULL, 10.00, 'high', 'completion', 3.00),
('circle_completion', 'full_cycle_bonus', 'Join More Circles', 'Completing more full cycles will boost this score component.', 'Join a new circle once your current one completes', NULL, 3.00, 'medium', 'completion', 2.00),
('circle_completion', 'no_abandonment', 'Avoid Abandonment', 'Abandoning a circle severely impacts your score. If facing hardship, request position swap instead.', 'Use position swap feature if needed instead of leaving', NULL, 0.00, 'high', 'completion', 3.00);

-- Tenure & Activity Tips
INSERT INTO xn_score_improvement_tips (factor_key, component_key, tip_title, tip_description, tip_action, min_score_threshold, max_score_threshold, priority, category, potential_points) VALUES
('tenure_activity', 'tenure_bonus', 'Earn Tenure Bonus', 'Stay active each month to earn +1 tenure point (up to +25 total).', 'Make at least one contribution this month', NULL, 5.00, 'medium', 'tenure', 1.00),
('tenure_activity', 'recent_activity', 'Stay Active', 'Your recent activity has declined. Make a contribution or deposit to stay active.', 'Make a wallet deposit or circle contribution within the next 7 days', NULL, 1.00, 'high', 'tenure', 2.00),
('tenure_activity', 'account_age', 'Time Builds Trust', 'Your account is still young. Continue being a good member and your score will naturally increase over time.', 'Keep participating regularly for the next few months', NULL, 3.00, 'low', 'tenure', 1.00);

-- Community Standing Tips
INSERT INTO xn_score_improvement_tips (factor_key, component_key, tip_title, tip_description, tip_action, min_score_threshold, max_score_threshold, priority, category, potential_points) VALUES
('community_standing', 'vouches_received', 'Get Vouched', 'Ask trusted members who know you to vouch for you. Vouches from high-score members are worth more.', 'Request a vouch from a member you have completed a circle with', NULL, 3.00, 'medium', 'community', 2.00),
('community_standing', 'member_diversity', 'Diversify Connections', 'Join circles with new members to expand your network and improve this score.', 'Join a circle with at least 3 members you have not circled with before', NULL, 2.50, 'medium', 'community', 1.50),
('community_standing', 'elder_connections', 'Connect with Elders', 'Having different elders trust you shows broader community acceptance.', 'Complete circles with different elders', NULL, 2.00, 'low', 'community', 1.00),
('community_standing', 'vouching_reliability', 'Vouch Wisely', 'Only vouch for people you truly trust. If your vouchees default, it affects your reliability.', 'Be selective about who you vouch for', NULL, 2.00, 'medium', 'community', 1.00);

-- Financial Behavior Tips
INSERT INTO xn_score_improvement_tips (factor_key, component_key, tip_title, tip_description, tip_action, min_score_threshold, max_score_threshold, priority, category, potential_points) VALUES
('financial_behavior', 'wallet_usage', 'Use Your Wallet', 'Making regular deposits to your TandaXn wallet shows financial commitment.', 'Make a wallet deposit this week', NULL, 4.00, 'medium', 'financial', 2.00),
('financial_behavior', 'payout_retention', 'Keep Money in TandaXn', 'Keeping your payouts in the TandaXn wallet shows trust in the platform.', 'Keep at least 50% of your next payout in your wallet', NULL, 3.00, 'medium', 'financial', 2.00),
('financial_behavior', 'savings_engagement', 'Start Saving', 'Using savings goals shows financial responsibility and long-term thinking.', 'Create a savings goal in the Savings section', NULL, 2.00, 'low', 'financial', 2.00);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get factor status from score percentage
CREATE FUNCTION get_factor_status(score DECIMAL, max_score DECIMAL)
RETURNS factor_status AS $$
DECLARE
    pct DECIMAL;
BEGIN
    IF max_score = 0 THEN
        RETURN 'critical'::factor_status;
    END IF;

    pct := (score / max_score) * 100;

    RETURN CASE
        WHEN pct >= 90 THEN 'excellent'::factor_status
        WHEN pct >= 70 THEN 'good'::factor_status
        WHEN pct >= 50 THEN 'fair'::factor_status
        WHEN pct >= 30 THEN 'needs_work'::factor_status
        ELSE 'critical'::factor_status
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get factor trend by comparing to previous period
CREATE FUNCTION get_factor_trend(current_score DECIMAL, previous_score DECIMAL)
RETURNS factor_trend AS $$
BEGIN
    IF previous_score IS NULL THEN
        RETURN 'stable'::factor_trend;
    END IF;

    IF current_score > previous_score + 0.5 THEN
        RETURN 'improving'::factor_trend;
    ELSIF current_score < previous_score - 0.5 THEN
        RETURN 'declining'::factor_trend;
    ELSE
        RETURN 'stable'::factor_trend;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ FACTOR CALCULATION FUNCTIONS                                                │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Calculate Payment Reliability Factor (35 pts max)
CREATE FUNCTION calculate_payment_reliability_factor(p_user_id UUID)
RETURNS TABLE (
    total_score DECIMAL,
    on_time_rate_score DECIMAL,
    payment_streak_score DECIMAL,
    no_defaults_score DECIMAL,
    late_recovery_score DECIMAL,
    component_details JSONB
) AS $$
DECLARE
    v_total_contributions INTEGER;
    v_on_time_contributions INTEGER;
    v_late_contributions INTEGER;
    v_late_recovered INTEGER;
    v_on_time_pct DECIMAL;
    v_score_record RECORD;

    v_on_time_rate DECIMAL := 0;
    v_streak_bonus DECIMAL := 0;
    v_no_defaults DECIMAL := 0;
    v_late_recovery DECIMAL := 0;
    v_details JSONB;
BEGIN
    -- Get score record
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    -- Count contributions
    SELECT
        COUNT(*) FILTER (WHERE status IN ('completed', 'late')),
        COUNT(*) FILTER (WHERE status = 'completed' AND (paid_at <= due_date OR paid_at IS NULL)),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'late' AND paid_at IS NOT NULL)
    INTO v_total_contributions, v_on_time_contributions, v_late_contributions, v_late_recovered
    FROM contributions
    WHERE user_id = p_user_id;

    -- Calculate on-time rate (20 pts max)
    IF v_total_contributions > 0 THEN
        v_on_time_pct := v_on_time_contributions::DECIMAL / v_total_contributions;
        v_on_time_rate := LEAST(20, v_on_time_pct * 20);
    END IF;

    -- Calculate streak bonus (8 pts max)
    IF v_score_record IS NOT NULL THEN
        v_streak_bonus := LEAST(8, (LEAST(v_score_record.payment_streak, 20)::DECIMAL / 20) * 8);
    END IF;

    -- No defaults bonus (5 pts)
    IF v_score_record IS NOT NULL AND NOT COALESCE(v_score_record.has_defaults, FALSE) THEN
        v_no_defaults := 5;
    END IF;

    -- Late recovery bonus (2 pts max)
    IF v_late_contributions > 0 AND v_late_recovered > 0 THEN
        v_late_recovery := LEAST(2, (v_late_recovered::DECIMAL / v_late_contributions) * 2);
    END IF;

    v_details := jsonb_build_object(
        'total_contributions', v_total_contributions,
        'on_time_contributions', v_on_time_contributions,
        'on_time_percentage', ROUND(COALESCE(v_on_time_pct * 100, 0), 1),
        'current_streak', COALESCE(v_score_record.payment_streak, 0),
        'best_streak', COALESCE(v_score_record.best_payment_streak, 0),
        'has_defaults', COALESCE(v_score_record.has_defaults, FALSE),
        'default_count', COALESCE(v_score_record.default_count, 0),
        'late_payments', v_late_contributions,
        'late_recovered', v_late_recovered
    );

    RETURN QUERY SELECT
        ROUND(v_on_time_rate + v_streak_bonus + v_no_defaults + v_late_recovery, 2),
        ROUND(v_on_time_rate, 2),
        ROUND(v_streak_bonus, 2),
        ROUND(v_no_defaults, 2),
        ROUND(v_late_recovery, 2),
        v_details;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate Circle Completion Factor (20 pts max)
CREATE FUNCTION calculate_circle_completion_factor(p_user_id UUID)
RETURNS TABLE (
    total_score DECIMAL,
    completion_rate_score DECIMAL,
    full_cycle_score DECIMAL,
    no_abandonment_score DECIMAL,
    component_details JSONB
) AS $$
DECLARE
    v_score_record RECORD;
    v_circles_joined INTEGER;
    v_circles_completed INTEGER;
    v_circles_abandoned INTEGER;
    v_full_cycles INTEGER;
    v_completion_pct DECIMAL;

    v_completion_rate DECIMAL := 0;
    v_cycle_bonus DECIMAL := 0;
    v_no_abandon DECIMAL := 0;
    v_details JSONB;
BEGIN
    -- Get score record
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    v_circles_joined := COALESCE(v_score_record.circles_participated, 0);
    v_circles_abandoned := COALESCE(v_score_record.circles_abandoned, 0);
    v_full_cycles := COALESCE(v_score_record.full_cycles_completed, 0);
    v_circles_completed := v_circles_joined - v_circles_abandoned;

    -- Calculate completion rate (12 pts max)
    IF v_circles_joined > 0 THEN
        v_completion_pct := v_circles_completed::DECIMAL / v_circles_joined;
        v_completion_rate := LEAST(12, v_completion_pct * 12);
    END IF;

    -- Full cycle bonus (5 pts max)
    v_cycle_bonus := LEAST(5, (LEAST(v_full_cycles, 10)::DECIMAL / 10) * 5);

    -- No abandonment bonus (3 pts)
    IF v_circles_abandoned = 0 AND v_circles_joined > 0 THEN
        v_no_abandon := 3;
    END IF;

    v_details := jsonb_build_object(
        'circles_joined', v_circles_joined,
        'circles_completed', v_circles_completed,
        'circles_abandoned', v_circles_abandoned,
        'completion_percentage', ROUND(COALESCE(v_completion_pct * 100, 0), 1),
        'full_cycles_completed', v_full_cycles,
        'completion_rate', ROUND(COALESCE(v_score_record.completion_rate, 0), 1)
    );

    RETURN QUERY SELECT
        ROUND(v_completion_rate + v_cycle_bonus + v_no_abandon, 2),
        ROUND(v_completion_rate, 2),
        ROUND(v_cycle_bonus, 2),
        ROUND(v_no_abandon, 2),
        v_details;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate Tenure & Activity Factor (15 pts max)
CREATE FUNCTION calculate_tenure_activity_factor(p_user_id UUID)
RETURNS TABLE (
    total_score DECIMAL,
    account_age_score DECIMAL,
    tenure_bonus_score DECIMAL,
    recent_activity_score DECIMAL,
    component_details JSONB
) AS $$
DECLARE
    v_score_record RECORD;
    v_profile RECORD;
    v_account_months INTEGER;
    v_tenure_bonus DECIMAL;
    v_is_active BOOLEAN;

    v_age_score DECIMAL := 0;
    v_tenure_score DECIMAL := 0;
    v_activity_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    -- Get score and profile records
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

    IF v_score_record IS NULL OR v_profile IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Calculate account age in months
    v_account_months := EXTRACT(MONTH FROM age(now(), v_profile.created_at))::INTEGER +
                        (EXTRACT(YEAR FROM age(now(), v_profile.created_at))::INTEGER * 12);

    v_tenure_bonus := COALESCE(v_score_record.tenure_bonus, 0);
    v_is_active := is_user_financially_active(p_user_id, 30);

    -- Account age score (5 pts max) - based on 18 month cap
    v_age_score := LEAST(5, (LEAST(v_account_months, 18)::DECIMAL / 18) * 5);

    -- Tenure bonus score (7 pts max) - based on max 25 tenure bonus
    v_tenure_score := LEAST(7, (v_tenure_bonus / 25) * 7);

    -- Recent activity score (3 pts)
    IF v_is_active THEN
        v_activity_score := 3;
    END IF;

    v_details := jsonb_build_object(
        'account_age_months', v_account_months,
        'account_age_days', COALESCE(v_score_record.account_age_days, 0),
        'tenure_bonus_earned', v_tenure_bonus,
        'tenure_months_earned', COALESCE(v_score_record.tenure_months_earned, 0),
        'max_tenure_bonus', 25,
        'is_recently_active', v_is_active,
        'last_activity_at', v_score_record.last_financial_activity_at,
        'financial_inactive_days', COALESCE(v_score_record.financial_inactive_days, 0),
        'in_recovery_period', COALESCE(v_score_record.in_recovery_period, FALSE)
    );

    RETURN QUERY SELECT
        ROUND(v_age_score + v_tenure_score + v_activity_score, 2),
        ROUND(v_age_score, 2),
        ROUND(v_tenure_score, 2),
        ROUND(v_activity_score, 2),
        v_details;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate Community Standing Factor (15 pts max)
CREATE FUNCTION calculate_community_standing_factor(p_user_id UUID)
RETURNS TABLE (
    total_score DECIMAL,
    vouches_received_score DECIMAL,
    member_diversity_score DECIMAL,
    elder_connections_score DECIMAL,
    vouching_reliability_score DECIMAL,
    component_details JSONB
) AS $$
DECLARE
    v_score_record RECORD;
    v_total_vouch_value DECIMAL := 0;
    v_vouch_count INTEGER := 0;
    v_unique_members INTEGER;
    v_unique_elders INTEGER;
    v_voucher_reliability DECIMAL;

    v_vouch_score DECIMAL := 0;
    v_diversity_score DECIMAL := 0;
    v_elder_score DECIMAL := 0;
    v_reliability_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    -- Get score record
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Calculate vouch value received
    SELECT COUNT(*), COALESCE(SUM(diluted_vouch_value), 0)
    INTO v_vouch_count, v_total_vouch_value
    FROM vouches
    WHERE vouchee_user_id = p_user_id AND vouch_status = 'active';

    v_unique_members := COALESCE(v_score_record.unique_circle_members_count, 0);
    v_unique_elders := COALESCE(v_score_record.unique_elders_count, 0);

    -- Voucher reliability (1.0 = good, 0.0 = restricted)
    v_voucher_reliability := CASE v_score_record.voucher_reliability
        WHEN 'good' THEN 1.0
        WHEN 'warning' THEN 0.7
        WHEN 'poor' THEN 0.4
        WHEN 'restricted' THEN 0.0
        ELSE 1.0
    END;

    -- Vouches received score (5 pts max)
    v_vouch_score := LEAST(5, (LEAST(v_total_vouch_value, 10) / 10) * 5);

    -- Member diversity score (4 pts max)
    v_diversity_score := LEAST(4, (LEAST(v_unique_members, 20)::DECIMAL / 20) * 4);

    -- Elder connections score (3 pts max)
    v_elder_score := LEAST(3, (LEAST(v_unique_elders, 5)::DECIMAL / 5) * 3);

    -- Vouching reliability score (3 pts max)
    v_reliability_score := v_voucher_reliability * 3;

    v_details := jsonb_build_object(
        'vouches_received', v_vouch_count,
        'total_vouch_value', ROUND(v_total_vouch_value, 2),
        'unique_circle_members', v_unique_members,
        'unique_elders', v_unique_elders,
        'unique_communities', COALESCE(v_score_record.unique_communities_count, 0),
        'voucher_reliability', v_score_record.voucher_reliability,
        'total_vouchee_defaults', COALESCE(v_score_record.total_vouchee_defaults, 0)
    );

    RETURN QUERY SELECT
        ROUND(v_vouch_score + v_diversity_score + v_elder_score + v_reliability_score, 2),
        ROUND(v_vouch_score, 2),
        ROUND(v_diversity_score, 2),
        ROUND(v_elder_score, 2),
        ROUND(v_reliability_score, 2),
        v_details;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate Financial Behavior Factor (15 pts max)
CREATE FUNCTION calculate_financial_behavior_factor(p_user_id UUID)
RETURNS TABLE (
    total_score DECIMAL,
    wallet_usage_score DECIMAL,
    payout_retention_score DECIMAL,
    savings_engagement_score DECIMAL,
    component_details JSONB
) AS $$
DECLARE
    v_score_record RECORD;
    v_wallet RECORD;
    v_wallet_deposits INTEGER := 0;
    v_total_deposited DECIMAL := 0;
    v_retention_rate DECIMAL := 0;
    v_has_savings BOOLEAN := FALSE;

    v_wallet_score DECIMAL := 0;
    v_retention_score DECIMAL := 0;
    v_savings_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    -- Get score record
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    -- Get wallet info
    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Count wallet deposits
    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_wallet_deposits, v_total_deposited
    FROM wallet_transactions
    WHERE user_id = p_user_id
    AND transaction_type = 'deposit'
    AND transaction_status = 'completed';

    -- Calculate retention rate from payout preferences
    SELECT COALESCE(pp.wallet_percentage, 0)::DECIMAL / 100
    INTO v_retention_rate
    FROM payout_preferences pp
    WHERE pp.user_id = p_user_id;

    v_retention_rate := COALESCE(v_retention_rate, 0);

    -- Check for savings goals
    SELECT EXISTS(
        SELECT 1 FROM savings_goals WHERE user_id = p_user_id AND is_active = TRUE
    ) INTO v_has_savings;

    -- Wallet usage score (6 pts max)
    -- Based on deposit frequency and total deposited
    IF v_wallet_deposits > 0 THEN
        v_wallet_score := LEAST(6, (LEAST(v_wallet_deposits, 12)::DECIMAL / 12) * 6);
    END IF;

    -- Payout retention score (5 pts max)
    v_retention_score := v_retention_rate * 5;

    -- Savings engagement score (4 pts)
    IF v_has_savings THEN
        v_savings_score := 4;
    END IF;

    v_details := jsonb_build_object(
        'wallet_balance', COALESCE(v_wallet.available_balance, 0),
        'total_deposited', ROUND(v_total_deposited, 2),
        'deposit_count', v_wallet_deposits,
        'payout_retention_rate', ROUND(v_retention_rate * 100, 1),
        'has_savings_goals', v_has_savings,
        'last_wallet_deposit', v_score_record.last_wallet_deposit_at
    );

    RETURN QUERY SELECT
        ROUND(v_wallet_score + v_retention_score + v_savings_score, 2),
        ROUND(v_wallet_score, 2),
        ROUND(v_retention_score, 2),
        ROUND(v_savings_score, 2),
        v_details;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ MAIN BREAKDOWN FUNCTIONS                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Calculate complete score breakdown
CREATE FUNCTION calculate_score_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
    v_previous_cache RECORD;

    v_total_calculated DECIMAL;
    v_breakdown JSONB;
    v_components JSONB;
    v_tips JSONB;
BEGIN
    -- Get current score
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User score not found');
    END IF;

    -- Get previous cache for trend calculation
    SELECT * INTO v_previous_cache FROM xn_score_breakdown_cache WHERE user_id = p_user_id;

    -- Calculate each factor
    SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
    SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
    SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
    SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
    SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);

    -- Sum calculated total
    v_total_calculated := COALESCE(v_payment.total_score, 0) +
                          COALESCE(v_completion.total_score, 0) +
                          COALESCE(v_tenure.total_score, 0) +
                          COALESCE(v_community.total_score, 0) +
                          COALESCE(v_financial.total_score, 0);

    -- Build factor breakdown
    v_breakdown := jsonb_build_object(
        'payment_reliability', jsonb_build_object(
            'score', COALESCE(v_payment.total_score, 0),
            'max_score', 35,
            'weight', 35,
            'status', get_factor_status(COALESCE(v_payment.total_score, 0), 35)::TEXT,
            'trend', get_factor_trend(COALESCE(v_payment.total_score, 0), v_previous_cache.payment_reliability_score)::TEXT,
            'components', jsonb_build_object(
                'on_time_rate', jsonb_build_object('score', v_payment.on_time_rate_score, 'max', 20),
                'payment_streak', jsonb_build_object('score', v_payment.payment_streak_score, 'max', 8),
                'no_defaults', jsonb_build_object('score', v_payment.no_defaults_score, 'max', 5),
                'late_recovery', jsonb_build_object('score', v_payment.late_recovery_score, 'max', 2)
            ),
            'details', v_payment.component_details
        ),
        'circle_completion', jsonb_build_object(
            'score', COALESCE(v_completion.total_score, 0),
            'max_score', 20,
            'weight', 20,
            'status', get_factor_status(COALESCE(v_completion.total_score, 0), 20)::TEXT,
            'trend', get_factor_trend(COALESCE(v_completion.total_score, 0), v_previous_cache.circle_completion_score)::TEXT,
            'components', jsonb_build_object(
                'completion_rate', jsonb_build_object('score', v_completion.completion_rate_score, 'max', 12),
                'full_cycle', jsonb_build_object('score', v_completion.full_cycle_score, 'max', 5),
                'no_abandonment', jsonb_build_object('score', v_completion.no_abandonment_score, 'max', 3)
            ),
            'details', v_completion.component_details
        ),
        'tenure_activity', jsonb_build_object(
            'score', COALESCE(v_tenure.total_score, 0),
            'max_score', 15,
            'weight', 15,
            'status', get_factor_status(COALESCE(v_tenure.total_score, 0), 15)::TEXT,
            'trend', get_factor_trend(COALESCE(v_tenure.total_score, 0), v_previous_cache.tenure_activity_score)::TEXT,
            'components', jsonb_build_object(
                'account_age', jsonb_build_object('score', v_tenure.account_age_score, 'max', 5),
                'tenure_bonus', jsonb_build_object('score', v_tenure.tenure_bonus_score, 'max', 7),
                'recent_activity', jsonb_build_object('score', v_tenure.recent_activity_score, 'max', 3)
            ),
            'details', v_tenure.component_details
        ),
        'community_standing', jsonb_build_object(
            'score', COALESCE(v_community.total_score, 0),
            'max_score', 15,
            'weight', 15,
            'status', get_factor_status(COALESCE(v_community.total_score, 0), 15)::TEXT,
            'trend', get_factor_trend(COALESCE(v_community.total_score, 0), v_previous_cache.community_standing_score)::TEXT,
            'components', jsonb_build_object(
                'vouches_received', jsonb_build_object('score', v_community.vouches_received_score, 'max', 5),
                'member_diversity', jsonb_build_object('score', v_community.member_diversity_score, 'max', 4),
                'elder_connections', jsonb_build_object('score', v_community.elder_connections_score, 'max', 3),
                'vouching_reliability', jsonb_build_object('score', v_community.vouching_reliability_score, 'max', 3)
            ),
            'details', v_community.component_details
        ),
        'financial_behavior', jsonb_build_object(
            'score', COALESCE(v_financial.total_score, 0),
            'max_score', 15,
            'weight', 15,
            'status', get_factor_status(COALESCE(v_financial.total_score, 0), 15)::TEXT,
            'trend', get_factor_trend(COALESCE(v_financial.total_score, 0), v_previous_cache.financial_behavior_score)::TEXT,
            'components', jsonb_build_object(
                'wallet_usage', jsonb_build_object('score', v_financial.wallet_usage_score, 'max', 6),
                'payout_retention', jsonb_build_object('score', v_financial.payout_retention_score, 'max', 5),
                'savings_engagement', jsonb_build_object('score', v_financial.savings_engagement_score, 'max', 4)
            ),
            'details', v_financial.component_details
        )
    );

    -- Get improvement tips
    SELECT get_improvement_tips(p_user_id, 5) INTO v_tips;

    RETURN jsonb_build_object(
        'user_id', p_user_id,
        'total_score', v_score_record.total_score,
        'calculated_total', ROUND(v_total_calculated, 2),
        'tier', v_score_record.score_tier,
        'factors', v_breakdown,
        'improvement_tips', v_tips,
        'calculated_at', now()
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get improvement tips for a user
CREATE FUNCTION get_improvement_tips(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS JSONB AS $$
DECLARE
    v_tips JSONB := '[]';
    v_tip RECORD;
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
BEGIN
    -- Get current scores
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
    SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
    SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
    SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
    SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);

    -- Get applicable tips
    FOR v_tip IN
        SELECT
            t.*,
            CASE t.factor_key
                WHEN 'payment_reliability' THEN
                    CASE t.component_key
                        WHEN 'on_time_rate' THEN v_payment.on_time_rate_score
                        WHEN 'payment_streak' THEN v_payment.payment_streak_score
                        WHEN 'no_defaults' THEN v_payment.no_defaults_score
                        ELSE v_payment.total_score
                    END
                WHEN 'circle_completion' THEN
                    CASE t.component_key
                        WHEN 'completion_rate' THEN v_completion.completion_rate_score
                        WHEN 'full_cycle_bonus' THEN v_completion.full_cycle_score
                        WHEN 'no_abandonment' THEN v_completion.no_abandonment_score
                        ELSE v_completion.total_score
                    END
                WHEN 'tenure_activity' THEN
                    CASE t.component_key
                        WHEN 'account_age' THEN v_tenure.account_age_score
                        WHEN 'tenure_bonus' THEN v_tenure.tenure_bonus_score
                        WHEN 'recent_activity' THEN v_tenure.recent_activity_score
                        ELSE v_tenure.total_score
                    END
                WHEN 'community_standing' THEN
                    CASE t.component_key
                        WHEN 'vouches_received' THEN v_community.vouches_received_score
                        WHEN 'member_diversity' THEN v_community.member_diversity_score
                        WHEN 'elder_connections' THEN v_community.elder_connections_score
                        WHEN 'vouching_reliability' THEN v_community.vouching_reliability_score
                        ELSE v_community.total_score
                    END
                WHEN 'financial_behavior' THEN
                    CASE t.component_key
                        WHEN 'wallet_usage' THEN v_financial.wallet_usage_score
                        WHEN 'payout_retention' THEN v_financial.payout_retention_score
                        WHEN 'savings_engagement' THEN v_financial.savings_engagement_score
                        ELSE v_financial.total_score
                    END
            END as current_score
        FROM xn_score_improvement_tips t
        WHERE t.is_active = TRUE
        ORDER BY t.priority, t.potential_points DESC
    LOOP
        -- Check if tip applies based on thresholds
        IF (v_tip.max_score_threshold IS NULL OR v_tip.current_score <= v_tip.max_score_threshold)
           AND (v_tip.min_score_threshold IS NULL OR v_tip.current_score >= v_tip.min_score_threshold)
        THEN
            v_tips := v_tips || jsonb_build_object(
                'id', v_tip.id,
                'factor', v_tip.factor_key,
                'component', v_tip.component_key,
                'title', v_tip.tip_title,
                'description', v_tip.tip_description,
                'action', v_tip.tip_action,
                'priority', v_tip.priority,
                'potential_points', v_tip.potential_points,
                'current_score', ROUND(v_tip.current_score, 2)
            );

            IF jsonb_array_length(v_tips) >= p_limit THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;

    RETURN v_tips;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get cached or fresh breakdown
CREATE FUNCTION get_score_breakdown(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_cache RECORD;
    v_breakdown JSONB;
BEGIN
    -- Check for valid cache
    SELECT * INTO v_cache
    FROM xn_score_breakdown_cache
    WHERE user_id = p_user_id
    AND expires_at > now();

    IF FOUND THEN
        -- Return cached breakdown
        RETURN jsonb_build_object(
            'user_id', p_user_id,
            'total_score', v_cache.total_score,
            'tier', (SELECT score_tier FROM xn_scores WHERE user_id = p_user_id),
            'factors', jsonb_build_object(
                'payment_reliability', jsonb_build_object(
                    'score', v_cache.payment_reliability_score,
                    'max_score', 35,
                    'status', v_cache.payment_reliability_status,
                    'trend', v_cache.payment_reliability_trend
                ),
                'circle_completion', jsonb_build_object(
                    'score', v_cache.circle_completion_score,
                    'max_score', 20,
                    'status', v_cache.circle_completion_status,
                    'trend', v_cache.circle_completion_trend
                ),
                'tenure_activity', jsonb_build_object(
                    'score', v_cache.tenure_activity_score,
                    'max_score', 15,
                    'status', v_cache.tenure_activity_status,
                    'trend', v_cache.tenure_activity_trend
                ),
                'community_standing', jsonb_build_object(
                    'score', v_cache.community_standing_score,
                    'max_score', 15,
                    'status', v_cache.community_standing_status,
                    'trend', v_cache.community_standing_trend
                ),
                'financial_behavior', jsonb_build_object(
                    'score', v_cache.financial_behavior_score,
                    'max_score', 15,
                    'status', v_cache.financial_behavior_status,
                    'trend', v_cache.financial_behavior_trend
                )
            ),
            'improvement_tips', v_cache.improvement_tips,
            'percentiles', v_cache.factor_percentiles,
            'cached', TRUE,
            'calculated_at', v_cache.calculated_at
        );
    END IF;

    -- Calculate fresh breakdown
    v_breakdown := calculate_score_breakdown(p_user_id);

    -- Update cache
    PERFORM refresh_score_breakdown(p_user_id);

    RETURN v_breakdown;
END;
$$ LANGUAGE plpgsql;

-- Refresh breakdown cache
CREATE FUNCTION refresh_score_breakdown(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_breakdown JSONB;
    v_score_record RECORD;
    v_tips JSONB;
BEGIN
    -- Calculate breakdown
    v_breakdown := calculate_score_breakdown(p_user_id);

    IF v_breakdown ? 'error' THEN
        RETURN FALSE;
    END IF;

    -- Get tips
    v_tips := get_improvement_tips(p_user_id, 5);

    -- Upsert cache
    INSERT INTO xn_score_breakdown_cache (
        user_id, total_score,
        payment_reliability_score, payment_reliability_status, payment_reliability_trend,
        circle_completion_score, circle_completion_status, circle_completion_trend,
        tenure_activity_score, tenure_activity_status, tenure_activity_trend,
        community_standing_score, community_standing_status, community_standing_trend,
        financial_behavior_score, financial_behavior_status, financial_behavior_trend,
        factor_breakdown, improvement_tips,
        calculated_at, expires_at
    ) VALUES (
        p_user_id,
        (v_breakdown->>'total_score')::DECIMAL,
        (v_breakdown->'factors'->'payment_reliability'->>'score')::DECIMAL,
        (v_breakdown->'factors'->'payment_reliability'->>'status')::factor_status,
        (v_breakdown->'factors'->'payment_reliability'->>'trend')::factor_trend,
        (v_breakdown->'factors'->'circle_completion'->>'score')::DECIMAL,
        (v_breakdown->'factors'->'circle_completion'->>'status')::factor_status,
        (v_breakdown->'factors'->'circle_completion'->>'trend')::factor_trend,
        (v_breakdown->'factors'->'tenure_activity'->>'score')::DECIMAL,
        (v_breakdown->'factors'->'tenure_activity'->>'status')::factor_status,
        (v_breakdown->'factors'->'tenure_activity'->>'trend')::factor_trend,
        (v_breakdown->'factors'->'community_standing'->>'score')::DECIMAL,
        (v_breakdown->'factors'->'community_standing'->>'status')::factor_status,
        (v_breakdown->'factors'->'community_standing'->>'trend')::factor_trend,
        (v_breakdown->'factors'->'financial_behavior'->>'score')::DECIMAL,
        (v_breakdown->'factors'->'financial_behavior'->>'status')::factor_status,
        (v_breakdown->'factors'->'financial_behavior'->>'trend')::factor_trend,
        v_breakdown->'factors',
        v_tips,
        now(),
        now() + INTERVAL '1 hour'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_score = EXCLUDED.total_score,
        payment_reliability_score = EXCLUDED.payment_reliability_score,
        payment_reliability_status = EXCLUDED.payment_reliability_status,
        payment_reliability_trend = EXCLUDED.payment_reliability_trend,
        circle_completion_score = EXCLUDED.circle_completion_score,
        circle_completion_status = EXCLUDED.circle_completion_status,
        circle_completion_trend = EXCLUDED.circle_completion_trend,
        tenure_activity_score = EXCLUDED.tenure_activity_score,
        tenure_activity_status = EXCLUDED.tenure_activity_status,
        tenure_activity_trend = EXCLUDED.tenure_activity_trend,
        community_standing_score = EXCLUDED.community_standing_score,
        community_standing_status = EXCLUDED.community_standing_status,
        community_standing_trend = EXCLUDED.community_standing_trend,
        financial_behavior_score = EXCLUDED.financial_behavior_score,
        financial_behavior_status = EXCLUDED.financial_behavior_status,
        financial_behavior_trend = EXCLUDED.financial_behavior_trend,
        factor_breakdown = EXCLUDED.factor_breakdown,
        improvement_tips = EXCLUDED.improvement_tips,
        calculated_at = EXCLUDED.calculated_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- Also update main xn_scores table
    UPDATE xn_scores SET
        factor_scores = v_breakdown->'factors',
        breakdown_cached_at = now(),
        improvement_tips_cache = v_tips,
        top_improvement_factor = (v_tips->0->>'factor')
    WHERE xn_scores.user_id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Full score recalculation based on factors
CREATE FUNCTION recalculate_full_xnscore(p_user_id UUID)
RETURNS TABLE (
    success BOOLEAN,
    previous_score DECIMAL,
    new_score DECIMAL,
    factor_totals JSONB
) AS $$
DECLARE
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
    v_new_raw DECIMAL;
    v_new_capped DECIMAL;
    v_age_cap INTEGER;
BEGIN
    -- Get current score
    SELECT * INTO v_score_record FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Calculate all factors
    SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
    SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
    SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
    SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
    SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);

    -- Sum up raw score
    v_new_raw := COALESCE(v_payment.total_score, 0) +
                 COALESCE(v_completion.total_score, 0) +
                 COALESCE(v_tenure.total_score, 0) +
                 COALESCE(v_community.total_score, 0) +
                 COALESCE(v_financial.total_score, 0);

    -- Apply age cap
    v_age_cap := get_xnscore_age_cap(v_score_record.account_age_days);
    v_new_capped := LEAST(v_new_raw, v_age_cap);

    -- Update score
    UPDATE xn_scores SET
        previous_score = total_score,
        raw_score = v_new_raw,
        total_score = v_new_capped,
        score_tier = get_xnscore_tier(v_new_capped),
        payment_history_score = v_payment.total_score,
        completion_score = v_completion.total_score,
        time_reliability_score = v_tenure.total_score,
        diversity_social_score = v_community.total_score,
        deposit_score = v_financial.total_score,
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        last_calculated_at = now(),
        calculation_trigger = 'full_recalculation',
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Refresh breakdown cache
    PERFORM refresh_score_breakdown(p_user_id);

    RETURN QUERY SELECT
        TRUE,
        v_score_record.total_score,
        v_new_capped,
        jsonb_build_object(
            'payment_reliability', v_payment.total_score,
            'circle_completion', v_completion.total_score,
            'tenure_activity', v_tenure.total_score,
            'community_standing', v_community.total_score,
            'financial_behavior', v_financial.total_score,
            'raw_total', v_new_raw,
            'age_cap', v_age_cap,
            'capped_total', v_new_capped
        );
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- User score breakdown view
CREATE VIEW v_user_score_breakdown AS
SELECT
    c.user_id,
    p.full_name,
    p.email,
    xs.total_score,
    xs.score_tier,
    c.payment_reliability_score,
    c.payment_reliability_status,
    c.circle_completion_score,
    c.circle_completion_status,
    c.tenure_activity_score,
    c.tenure_activity_status,
    c.community_standing_score,
    c.community_standing_status,
    c.financial_behavior_score,
    c.financial_behavior_status,
    c.improvement_tips,
    c.calculated_at,
    c.expires_at,
    CASE
        WHEN c.expires_at > now() THEN TRUE
        ELSE FALSE
    END as cache_valid
FROM xn_score_breakdown_cache c
JOIN profiles p ON p.id = c.user_id
JOIN xn_scores xs ON xs.user_id = c.user_id;

-- Factor performance summary
CREATE VIEW v_factor_performance_summary AS
SELECT
    'payment_reliability' as factor,
    35 as max_score,
    ROUND(AVG(payment_reliability_score), 2) as avg_score,
    COUNT(*) FILTER (WHERE payment_reliability_status = 'excellent') as excellent_count,
    COUNT(*) FILTER (WHERE payment_reliability_status = 'good') as good_count,
    COUNT(*) FILTER (WHERE payment_reliability_status = 'fair') as fair_count,
    COUNT(*) FILTER (WHERE payment_reliability_status = 'needs_work') as needs_work_count,
    COUNT(*) FILTER (WHERE payment_reliability_status = 'critical') as critical_count
FROM xn_score_breakdown_cache
UNION ALL
SELECT
    'circle_completion', 20,
    ROUND(AVG(circle_completion_score), 2),
    COUNT(*) FILTER (WHERE circle_completion_status = 'excellent'),
    COUNT(*) FILTER (WHERE circle_completion_status = 'good'),
    COUNT(*) FILTER (WHERE circle_completion_status = 'fair'),
    COUNT(*) FILTER (WHERE circle_completion_status = 'needs_work'),
    COUNT(*) FILTER (WHERE circle_completion_status = 'critical')
FROM xn_score_breakdown_cache
UNION ALL
SELECT
    'tenure_activity', 15,
    ROUND(AVG(tenure_activity_score), 2),
    COUNT(*) FILTER (WHERE tenure_activity_status = 'excellent'),
    COUNT(*) FILTER (WHERE tenure_activity_status = 'good'),
    COUNT(*) FILTER (WHERE tenure_activity_status = 'fair'),
    COUNT(*) FILTER (WHERE tenure_activity_status = 'needs_work'),
    COUNT(*) FILTER (WHERE tenure_activity_status = 'critical')
FROM xn_score_breakdown_cache
UNION ALL
SELECT
    'community_standing', 15,
    ROUND(AVG(community_standing_score), 2),
    COUNT(*) FILTER (WHERE community_standing_status = 'excellent'),
    COUNT(*) FILTER (WHERE community_standing_status = 'good'),
    COUNT(*) FILTER (WHERE community_standing_status = 'fair'),
    COUNT(*) FILTER (WHERE community_standing_status = 'needs_work'),
    COUNT(*) FILTER (WHERE community_standing_status = 'critical')
FROM xn_score_breakdown_cache
UNION ALL
SELECT
    'financial_behavior', 15,
    ROUND(AVG(financial_behavior_score), 2),
    COUNT(*) FILTER (WHERE financial_behavior_status = 'excellent'),
    COUNT(*) FILTER (WHERE financial_behavior_status = 'good'),
    COUNT(*) FILTER (WHERE financial_behavior_status = 'fair'),
    COUNT(*) FILTER (WHERE financial_behavior_status = 'needs_work'),
    COUNT(*) FILTER (WHERE financial_behavior_status = 'critical')
FROM xn_score_breakdown_cache;

-- Improvement opportunities view
CREATE VIEW v_improvement_opportunities AS
SELECT
    c.user_id,
    p.full_name,
    xs.total_score,
    xs.score_tier,
    (tip->>'factor')::TEXT as factor,
    (tip->>'title')::TEXT as tip_title,
    (tip->>'priority')::TEXT as priority,
    (tip->>'potential_points')::DECIMAL as potential_points
FROM xn_score_breakdown_cache c
JOIN profiles p ON p.id = c.user_id
JOIN xn_scores xs ON xs.user_id = c.user_id,
jsonb_array_elements(c.improvement_tips) as tip
ORDER BY c.user_id, (tip->>'potential_points')::DECIMAL DESC;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE xn_score_factor_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE xn_score_factor_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE xn_score_improvement_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE xn_score_breakdown_cache ENABLE ROW LEVEL SECURITY;

-- Factor definitions: Public read
CREATE POLICY "factor_definitions_public_read" ON xn_score_factor_definitions FOR SELECT
USING (is_active = TRUE);

-- Factor components: Public read
CREATE POLICY "factor_components_public_read" ON xn_score_factor_components FOR SELECT
USING (TRUE);

-- Improvement tips: Public read
CREATE POLICY "improvement_tips_public_read" ON xn_score_improvement_tips FOR SELECT
USING (is_active = TRUE);

-- Breakdown cache: Only own
CREATE POLICY "breakdown_cache_own" ON xn_score_breakdown_cache FOR SELECT
USING (user_id = auth.uid());

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Update factor definition timestamp
CREATE OR REPLACE FUNCTION update_factor_definition_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_factor_definitions_updated
    BEFORE UPDATE ON xn_score_factor_definitions
    FOR EACH ROW EXECUTE FUNCTION update_factor_definition_timestamp();

-- Update breakdown cache timestamp
CREATE OR REPLACE FUNCTION update_breakdown_cache_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_breakdown_cache_updated
    BEFORE UPDATE ON xn_score_breakdown_cache
    FOR EACH ROW EXECUTE FUNCTION update_breakdown_cache_timestamp();

-- Invalidate cache on score change
CREATE OR REPLACE FUNCTION invalidate_breakdown_cache_on_score_change() RETURNS TRIGGER AS $$
BEGIN
    -- Mark cache as expired when score changes significantly
    IF ABS(NEW.total_score - COALESCE(OLD.total_score, 0)) >= 1 THEN
        UPDATE xn_score_breakdown_cache
        SET expires_at = now() - INTERVAL '1 second'
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_invalidate_breakdown_cache
    AFTER UPDATE OF total_score ON xn_scores
    FOR EACH ROW EXECUTE FUNCTION invalidate_breakdown_cache_on_score_change();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME SUBSCRIPTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE xn_score_breakdown_cache;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 021
-- ══════════════════════════════════════════════════════════════════════════════
