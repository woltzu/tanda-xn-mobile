-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 016: Circle Dissolution System
-- ══════════════════════════════════════════════════════════════════════════════
-- Handles circle dissolution with technical precision and emotional sensitivity
--
-- Three-Tier Dissolution Triggers:
-- 1. EMERGENCY: fraud_detected, catastrophic_default, regulatory_order, member_death
-- 2. VOLUNTARY: member_consensus, goal_achieved, external_opportunity
-- 3. ADMINISTRATIVE: natural_completion, prolonged_inactivity, membership_collapse
--
-- Key Features:
-- - Voting system with configurable thresholds
-- - Objection windows for contested dissolutions
-- - Pro-rata refund calculations based on net position
-- - XnScore impacts based on dissolution type
-- - Complete audit trail
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION TRIGGER ENUM                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
DO $$ BEGIN
    CREATE TYPE dissolution_trigger AS ENUM (
        -- Emergency Tier (Immediate, No Vote Required)
        'fraud_detected',
        'catastrophic_default',
        'regulatory_order',
        'member_death',

        -- Voluntary Tier (Requires Member Vote)
        'member_consensus',
        'goal_achieved',
        'external_opportunity',

        -- Administrative Tier (System-Initiated)
        'natural_completion',
        'prolonged_inactivity',
        'membership_collapse'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION STATUS ENUM                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
DO $$ BEGIN
    CREATE TYPE dissolution_status AS ENUM (
        'proposed',           -- Initial request submitted
        'voting',             -- Vote in progress
        'objection_window',   -- Waiting for objections
        'approved',           -- Approved, pending execution
        'executing',          -- Refund distribution in progress
        'completed',          -- Successfully dissolved
        'rejected',           -- Vote failed
        'cancelled',          -- Cancelled by initiator
        'contested'           -- Under review due to objections
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VOTE TYPE ENUM                                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘
DO $$ BEGIN
    CREATE TYPE dissolution_vote_type AS ENUM (
        'approve',
        'reject',
        'abstain'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ OBJECTION TYPE ENUM                                                         │
-- └─────────────────────────────────────────────────────────────────────────────┘
DO $$ BEGIN
    CREATE TYPE objection_type AS ENUM (
        'calculation_error',
        'process_violation',
        'fraud_claim',
        'timing_dispute',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION TRIGGER CONFIGURATION                                          │
-- │ Defines behavior and requirements for each trigger type                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_trigger_config (
    trigger_type dissolution_trigger PRIMARY KEY,
    tier TEXT NOT NULL CHECK (tier IN ('emergency', 'voluntary', 'administrative')),
    requires_vote BOOLEAN NOT NULL DEFAULT true,
    vote_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.67,  -- 67% approval required
    voting_period_hours INTEGER NOT NULL DEFAULT 72,
    objection_window_hours INTEGER NOT NULL DEFAULT 48,
    can_be_contested BOOLEAN NOT NULL DEFAULT true,
    xn_score_impact INTEGER NOT NULL DEFAULT 0,  -- Impact on XnScore (-100 to +10)
    description TEXT NOT NULL,
    refund_priority TEXT NOT NULL DEFAULT 'pro_rata',  -- pro_rata, fifo, net_position
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default trigger configurations
INSERT INTO dissolution_trigger_config (trigger_type, tier, requires_vote, vote_threshold, voting_period_hours, objection_window_hours, can_be_contested, xn_score_impact, description, refund_priority) VALUES
    -- Emergency Tier (No Vote, Immediate Action)
    ('fraud_detected', 'emergency', false, 0, 0, 24, false, -50, 'Circle dissolved due to detected fraudulent activity', 'net_position'),
    ('catastrophic_default', 'emergency', false, 0, 0, 24, true, -30, 'Circle dissolved due to irrecoverable default situation', 'net_position'),
    ('regulatory_order', 'emergency', false, 0, 0, 0, false, 0, 'Circle dissolved by regulatory or legal order', 'pro_rata'),
    ('member_death', 'emergency', false, 0, 0, 168, true, 0, 'Circle dissolved due to member death with no succession plan', 'pro_rata'),

    -- Voluntary Tier (Requires Vote)
    ('member_consensus', 'voluntary', true, 0.75, 72, 48, true, 0, 'Circle dissolved by mutual member agreement', 'pro_rata'),
    ('goal_achieved', 'voluntary', true, 0.67, 48, 24, false, 5, 'Circle dissolved after achieving collective goal', 'pro_rata'),
    ('external_opportunity', 'voluntary', true, 0.80, 96, 72, true, 0, 'Circle dissolved for external financial opportunity', 'pro_rata'),

    -- Administrative Tier (System-Initiated)
    ('natural_completion', 'administrative', false, 0, 0, 72, true, 10, 'Circle naturally completed all cycles', 'pro_rata'),
    ('prolonged_inactivity', 'administrative', true, 0.51, 168, 96, true, -10, 'Circle dissolved due to extended period of inactivity', 'pro_rata'),
    ('membership_collapse', 'administrative', false, 0, 0, 48, true, -20, 'Circle dissolved due to insufficient remaining members', 'net_position')
ON CONFLICT (trigger_type) DO NOTHING;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION REQUESTS TABLE                                                  │
-- │ Main table tracking dissolution requests                                   │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Request Details
    trigger_type dissolution_trigger NOT NULL,
    status dissolution_status NOT NULL DEFAULT 'proposed',
    reason TEXT NOT NULL,
    evidence_urls TEXT[],  -- Supporting documentation

    -- Initiator Info
    initiated_by UUID REFERENCES auth.users(id),  -- NULL for system-initiated
    initiated_by_system BOOLEAN DEFAULT false,

    -- Voting Tracking
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    total_eligible_voters INTEGER NOT NULL DEFAULT 0,

    -- Objection Window
    objection_window_starts_at TIMESTAMPTZ,
    objection_window_ends_at TIMESTAMPTZ,
    objection_count INTEGER DEFAULT 0,

    -- Financial Summary
    total_pool_amount DECIMAL(15,2) DEFAULT 0,
    total_refund_amount DECIMAL(15,2) DEFAULT 0,
    platform_fee_amount DECIMAL(15,2) DEFAULT 0,

    -- Resolution
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT valid_vote_counts CHECK (votes_for >= 0 AND votes_against >= 0 AND votes_abstain >= 0)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION VOTES TABLE                                                     │
-- │ Individual member votes on dissolution requests                            │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dissolution_request_id UUID NOT NULL REFERENCES dissolution_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Vote Details
    vote dissolution_vote_type NOT NULL,
    vote_weight DECIMAL(5,4) DEFAULT 1.0,  -- Weighted voting if applicable
    reason TEXT,

    -- Timestamps
    voted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure one vote per user per dissolution
    UNIQUE(dissolution_request_id, user_id)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION OBJECTIONS TABLE                                                │
-- │ Formal objections raised during objection window                           │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_objections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dissolution_request_id UUID NOT NULL REFERENCES dissolution_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Objection Details
    objection_type objection_type NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[],

    -- Resolution
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    upheld BOOLEAN,  -- Was the objection valid?

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION MEMBER POSITIONS TABLE                                          │
-- │ Tracks each member's financial position at dissolution                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_member_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dissolution_request_id UUID NOT NULL REFERENCES dissolution_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Contribution Tracking
    total_contributed DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_received DECIMAL(15,2) NOT NULL DEFAULT 0,
    net_position DECIMAL(15,2) NOT NULL DEFAULT 0,  -- contributed - received

    -- Refund Calculation
    refund_share_percentage DECIMAL(8,5) NOT NULL DEFAULT 0,
    calculated_refund DECIMAL(15,2) NOT NULL DEFAULT 0,
    adjusted_refund DECIMAL(15,2) NOT NULL DEFAULT 0,  -- After fees/penalties

    -- Payment Status
    refund_status TEXT DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed', 'disputed')),
    refund_method TEXT,  -- wallet, bank_transfer, mobile_money
    refund_executed_at TIMESTAMPTZ,
    refund_reference TEXT,

    -- XnScore Impact
    xn_score_before INTEGER,
    xn_score_after INTEGER,
    xn_score_change INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Ensure one position record per user per dissolution
    UNIQUE(dissolution_request_id, user_id)
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ DISSOLUTION EVENTS TABLE                                                    │
-- │ Complete audit trail of all dissolution-related events                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS dissolution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dissolution_request_id UUID NOT NULL REFERENCES dissolution_requests(id) ON DELETE CASCADE,

    -- Event Details
    event_type TEXT NOT NULL,
    event_description TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),  -- NULL for system events
    actor_type TEXT DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'admin')),

    -- Event Data
    previous_state JSONB,
    new_state JSONB,
    metadata JSONB DEFAULT '{}',

    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES FOR PERFORMANCE                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Dissolution Requests indexes
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_circle ON dissolution_requests(circle_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_status ON dissolution_requests(status);
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_trigger ON dissolution_requests(trigger_type);
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_initiated_by ON dissolution_requests(initiated_by);
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_voting_ends ON dissolution_requests(voting_ends_at) WHERE status = 'voting';
CREATE INDEX IF NOT EXISTS idx_dissolution_requests_objection_ends ON dissolution_requests(objection_window_ends_at) WHERE status = 'objection_window';

-- Dissolution Votes indexes
CREATE INDEX IF NOT EXISTS idx_dissolution_votes_request ON dissolution_votes(dissolution_request_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_votes_user ON dissolution_votes(user_id);

-- Dissolution Objections indexes
CREATE INDEX IF NOT EXISTS idx_dissolution_objections_request ON dissolution_objections(dissolution_request_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_objections_unresolved ON dissolution_objections(dissolution_request_id) WHERE resolved = false;

-- Dissolution Member Positions indexes
CREATE INDEX IF NOT EXISTS idx_dissolution_member_positions_request ON dissolution_member_positions(dissolution_request_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_member_positions_user ON dissolution_member_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_member_positions_refund_status ON dissolution_member_positions(refund_status);

-- Dissolution Events indexes
CREATE INDEX IF NOT EXISTS idx_dissolution_events_request ON dissolution_events(dissolution_request_id);
CREATE INDEX IF NOT EXISTS idx_dissolution_events_type ON dissolution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dissolution_events_created ON dissolution_events(created_at);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Function to calculate member's net position
CREATE OR REPLACE FUNCTION calculate_member_net_position(
    p_circle_id UUID,
    p_user_id UUID
) RETURNS TABLE (
    total_contributed DECIMAL(15,2),
    total_received DECIMAL(15,2),
    net_position DECIMAL(15,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(CASE WHEN ct.type = 'contribution' THEN ct.amount ELSE 0 END), 0)::DECIMAL(15,2) as total_contributed,
        COALESCE(SUM(CASE WHEN ct.type = 'payout' THEN ct.amount ELSE 0 END), 0)::DECIMAL(15,2) as total_received,
        (COALESCE(SUM(CASE WHEN ct.type = 'contribution' THEN ct.amount ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN ct.type = 'payout' THEN ct.amount ELSE 0 END), 0))::DECIMAL(15,2) as net_position
    FROM circle_transactions ct
    WHERE ct.circle_id = p_circle_id
    AND ct.user_id = p_user_id
    AND ct.status = 'completed';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get vote threshold requirement
CREATE OR REPLACE FUNCTION get_dissolution_vote_threshold(
    p_trigger_type dissolution_trigger
) RETURNS DECIMAL(3,2) AS $$
DECLARE
    v_threshold DECIMAL(3,2);
BEGIN
    SELECT vote_threshold INTO v_threshold
    FROM dissolution_trigger_config
    WHERE trigger_type = p_trigger_type;

    RETURN COALESCE(v_threshold, 0.67);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if dissolution requires voting
CREATE OR REPLACE FUNCTION dissolution_requires_vote(
    p_trigger_type dissolution_trigger
) RETURNS BOOLEAN AS $$
DECLARE
    v_requires_vote BOOLEAN;
BEGIN
    SELECT requires_vote INTO v_requires_vote
    FROM dissolution_trigger_config
    WHERE trigger_type = p_trigger_type;

    RETURN COALESCE(v_requires_vote, true);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get XnScore impact for a trigger type
CREATE OR REPLACE FUNCTION get_dissolution_xn_impact(
    p_trigger_type dissolution_trigger
) RETURNS INTEGER AS $$
DECLARE
    v_impact INTEGER;
BEGIN
    SELECT xn_score_impact INTO v_impact
    FROM dissolution_trigger_config
    WHERE trigger_type = p_trigger_type;

    RETURN COALESCE(v_impact, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CORE DISSOLUTION FUNCTIONS                                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Function to initiate a dissolution request
CREATE OR REPLACE FUNCTION initiate_dissolution(
    p_circle_id UUID,
    p_trigger_type dissolution_trigger,
    p_reason TEXT,
    p_initiated_by UUID DEFAULT NULL,
    p_evidence_urls TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_dissolution_id UUID;
    v_config dissolution_trigger_config%ROWTYPE;
    v_member_count INTEGER;
    v_pool_balance DECIMAL(15,2);
BEGIN
    -- Get trigger configuration
    SELECT * INTO v_config FROM dissolution_trigger_config WHERE trigger_type = p_trigger_type;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid dissolution trigger type: %', p_trigger_type;
    END IF;

    -- Check for existing pending dissolution
    IF EXISTS (
        SELECT 1 FROM dissolution_requests
        WHERE circle_id = p_circle_id
        AND status NOT IN ('completed', 'rejected', 'cancelled')
    ) THEN
        RAISE EXCEPTION 'Circle already has a pending dissolution request';
    END IF;

    -- Get member count
    SELECT COUNT(*) INTO v_member_count
    FROM circle_members
    WHERE circle_id = p_circle_id
    AND status = 'active';

    -- Get current pool balance
    SELECT COALESCE(current_balance, 0) INTO v_pool_balance
    FROM circles
    WHERE id = p_circle_id;

    -- Create dissolution request
    INSERT INTO dissolution_requests (
        circle_id,
        trigger_type,
        status,
        reason,
        evidence_urls,
        initiated_by,
        initiated_by_system,
        total_eligible_voters,
        total_pool_amount,
        voting_starts_at,
        voting_ends_at,
        objection_window_starts_at,
        objection_window_ends_at
    ) VALUES (
        p_circle_id,
        p_trigger_type,
        CASE
            WHEN v_config.requires_vote THEN 'voting'::dissolution_status
            ELSE 'objection_window'::dissolution_status
        END,
        p_reason,
        p_evidence_urls,
        p_initiated_by,
        p_initiated_by IS NULL,
        v_member_count,
        v_pool_balance,
        CASE WHEN v_config.requires_vote THEN now() ELSE NULL END,
        CASE WHEN v_config.requires_vote THEN now() + (v_config.voting_period_hours || ' hours')::INTERVAL ELSE NULL END,
        CASE
            WHEN v_config.requires_vote THEN NULL
            ELSE now()
        END,
        CASE
            WHEN v_config.requires_vote THEN NULL
            ELSE now() + (v_config.objection_window_hours || ' hours')::INTERVAL
        END
    ) RETURNING id INTO v_dissolution_id;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_id,
        actor_type,
        new_state
    ) VALUES (
        v_dissolution_id,
        'dissolution_initiated',
        'Dissolution request initiated with trigger: ' || p_trigger_type::TEXT,
        p_initiated_by,
        CASE WHEN p_initiated_by IS NULL THEN 'system' ELSE 'user' END,
        jsonb_build_object('trigger_type', p_trigger_type, 'reason', p_reason)
    );

    -- Calculate member positions
    PERFORM calculate_all_member_positions(v_dissolution_id);

    RETURN v_dissolution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate all member positions for a dissolution
CREATE OR REPLACE FUNCTION calculate_all_member_positions(
    p_dissolution_id UUID
) RETURNS void AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_member RECORD;
    v_position RECORD;
    v_total_positive_positions DECIMAL(15,2) := 0;
    v_refund_priority TEXT;
BEGIN
    -- Get dissolution details
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    -- Get refund priority from config
    SELECT refund_priority INTO v_refund_priority
    FROM dissolution_trigger_config
    WHERE trigger_type = v_dissolution.trigger_type;

    -- Calculate positions for each member
    FOR v_member IN
        SELECT cm.user_id
        FROM circle_members cm
        WHERE cm.circle_id = v_dissolution.circle_id
        AND cm.status = 'active'
    LOOP
        SELECT * INTO v_position FROM calculate_member_net_position(v_dissolution.circle_id, v_member.user_id);

        INSERT INTO dissolution_member_positions (
            dissolution_request_id,
            user_id,
            total_contributed,
            total_received,
            net_position
        ) VALUES (
            p_dissolution_id,
            v_member.user_id,
            v_position.total_contributed,
            v_position.total_received,
            v_position.net_position
        );

        -- Sum positive positions for refund calculation
        IF v_position.net_position > 0 THEN
            v_total_positive_positions := v_total_positive_positions + v_position.net_position;
        END IF;
    END LOOP;

    -- Calculate refund shares based on priority method
    IF v_refund_priority = 'net_position' THEN
        -- Refund based on net position (those who contributed more than received)
        UPDATE dissolution_member_positions dmp
        SET
            refund_share_percentage = CASE
                WHEN v_total_positive_positions > 0 AND dmp.net_position > 0
                THEN (dmp.net_position / v_total_positive_positions * 100)
                ELSE 0
            END,
            calculated_refund = CASE
                WHEN v_total_positive_positions > 0 AND dmp.net_position > 0
                THEN LEAST(dmp.net_position, v_dissolution.total_pool_amount * (dmp.net_position / v_total_positive_positions))
                ELSE 0
            END
        WHERE dmp.dissolution_request_id = p_dissolution_id;
    ELSE
        -- Pro-rata based on total contributions
        UPDATE dissolution_member_positions dmp
        SET
            refund_share_percentage = CASE
                WHEN (SELECT SUM(total_contributed) FROM dissolution_member_positions WHERE dissolution_request_id = p_dissolution_id) > 0
                THEN (dmp.total_contributed / (SELECT SUM(total_contributed) FROM dissolution_member_positions WHERE dissolution_request_id = p_dissolution_id) * 100)
                ELSE 0
            END,
            calculated_refund = CASE
                WHEN (SELECT SUM(total_contributed) FROM dissolution_member_positions WHERE dissolution_request_id = p_dissolution_id) > 0
                THEN v_dissolution.total_pool_amount * (dmp.total_contributed / (SELECT SUM(total_contributed) FROM dissolution_member_positions WHERE dissolution_request_id = p_dissolution_id))
                ELSE 0
            END
        WHERE dmp.dissolution_request_id = p_dissolution_id;
    END IF;

    -- Set adjusted refund (before fees are applied)
    UPDATE dissolution_member_positions
    SET adjusted_refund = calculated_refund
    WHERE dissolution_request_id = p_dissolution_id;

END;
$$ LANGUAGE plpgsql;

-- Function to cast a dissolution vote
CREATE OR REPLACE FUNCTION cast_dissolution_vote(
    p_dissolution_id UUID,
    p_user_id UUID,
    p_vote dissolution_vote_type,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_existing_vote dissolution_vote_type;
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    -- Check if voting is open
    IF v_dissolution.status != 'voting' THEN
        RAISE EXCEPTION 'Voting is not open for this dissolution request';
    END IF;

    -- Check if voting period has ended
    IF v_dissolution.voting_ends_at < now() THEN
        RAISE EXCEPTION 'Voting period has ended';
    END IF;

    -- Check if user is a member of the circle
    IF NOT EXISTS (
        SELECT 1 FROM circle_members
        WHERE circle_id = v_dissolution.circle_id
        AND user_id = p_user_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User is not an active member of this circle';
    END IF;

    -- Check for existing vote
    SELECT vote INTO v_existing_vote
    FROM dissolution_votes
    WHERE dissolution_request_id = p_dissolution_id
    AND user_id = p_user_id;

    IF FOUND THEN
        -- Update existing vote
        UPDATE dissolution_votes
        SET vote = p_vote, reason = p_reason, updated_at = now()
        WHERE dissolution_request_id = p_dissolution_id
        AND user_id = p_user_id;

        -- Update vote counts
        UPDATE dissolution_requests
        SET
            votes_for = votes_for + CASE WHEN p_vote = 'approve' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'approve' THEN 1 ELSE 0 END,
            votes_against = votes_against + CASE WHEN p_vote = 'reject' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'reject' THEN 1 ELSE 0 END,
            votes_abstain = votes_abstain + CASE WHEN p_vote = 'abstain' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'abstain' THEN 1 ELSE 0 END
        WHERE id = p_dissolution_id;
    ELSE
        -- Insert new vote
        INSERT INTO dissolution_votes (dissolution_request_id, user_id, vote, reason)
        VALUES (p_dissolution_id, p_user_id, p_vote, p_reason);

        -- Update vote counts
        UPDATE dissolution_requests
        SET
            votes_for = votes_for + CASE WHEN p_vote = 'approve' THEN 1 ELSE 0 END,
            votes_against = votes_against + CASE WHEN p_vote = 'reject' THEN 1 ELSE 0 END,
            votes_abstain = votes_abstain + CASE WHEN p_vote = 'abstain' THEN 1 ELSE 0 END
        WHERE id = p_dissolution_id;
    END IF;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_id,
        new_state
    ) VALUES (
        p_dissolution_id,
        'vote_cast',
        'Member cast vote: ' || p_vote::TEXT,
        p_user_id,
        jsonb_build_object('vote', p_vote, 'reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to file an objection
CREATE OR REPLACE FUNCTION file_dissolution_objection(
    p_dissolution_id UUID,
    p_user_id UUID,
    p_objection_type objection_type,
    p_description TEXT,
    p_evidence_urls TEXT[] DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_objection_id UUID;
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    -- Check if objection window is open
    IF v_dissolution.status != 'objection_window' THEN
        RAISE EXCEPTION 'Objection window is not open for this dissolution request';
    END IF;

    -- Check if objection period has ended
    IF v_dissolution.objection_window_ends_at < now() THEN
        RAISE EXCEPTION 'Objection window has ended';
    END IF;

    -- Check if user is a member of the circle
    IF NOT EXISTS (
        SELECT 1 FROM circle_members
        WHERE circle_id = v_dissolution.circle_id
        AND user_id = p_user_id
        AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'User is not an active member of this circle';
    END IF;

    -- Create objection
    INSERT INTO dissolution_objections (
        dissolution_request_id,
        user_id,
        objection_type,
        description,
        evidence_urls
    ) VALUES (
        p_dissolution_id,
        p_user_id,
        p_objection_type,
        p_description,
        p_evidence_urls
    ) RETURNING id INTO v_objection_id;

    -- Update objection count
    UPDATE dissolution_requests
    SET objection_count = objection_count + 1
    WHERE id = p_dissolution_id;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_id,
        new_state
    ) VALUES (
        p_dissolution_id,
        'objection_filed',
        'Objection filed: ' || p_objection_type::TEXT,
        p_user_id,
        jsonb_build_object('objection_type', p_objection_type, 'description', p_description)
    );

    RETURN v_objection_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process voting results
CREATE OR REPLACE FUNCTION process_dissolution_vote_results(
    p_dissolution_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_threshold DECIMAL(3,2);
    v_approval_rate DECIMAL(5,4);
    v_new_status dissolution_status;
    v_config dissolution_trigger_config%ROWTYPE;
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    IF v_dissolution.status != 'voting' THEN
        RAISE EXCEPTION 'Dissolution is not in voting status';
    END IF;

    -- Get config
    SELECT * INTO v_config FROM dissolution_trigger_config WHERE trigger_type = v_dissolution.trigger_type;
    v_threshold := v_config.vote_threshold;

    -- Calculate approval rate (excluding abstentions)
    IF (v_dissolution.votes_for + v_dissolution.votes_against) > 0 THEN
        v_approval_rate := v_dissolution.votes_for::DECIMAL / (v_dissolution.votes_for + v_dissolution.votes_against);
    ELSE
        v_approval_rate := 0;
    END IF;

    -- Determine outcome
    IF v_approval_rate >= v_threshold THEN
        -- Vote passed, move to objection window
        v_new_status := 'objection_window';

        UPDATE dissolution_requests
        SET
            status = v_new_status,
            objection_window_starts_at = now(),
            objection_window_ends_at = now() + (v_config.objection_window_hours || ' hours')::INTERVAL,
            updated_at = now()
        WHERE id = p_dissolution_id;
    ELSE
        -- Vote failed
        v_new_status := 'rejected';

        UPDATE dissolution_requests
        SET
            status = v_new_status,
            resolved_at = now(),
            resolution_notes = 'Vote did not meet threshold. Approval rate: ' || ROUND(v_approval_rate * 100, 2) || '%, Required: ' || ROUND(v_threshold * 100, 2) || '%',
            updated_at = now()
        WHERE id = p_dissolution_id;
    END IF;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_type,
        new_state
    ) VALUES (
        p_dissolution_id,
        'vote_results_processed',
        'Vote results: ' || v_new_status::TEXT || ' (Approval: ' || ROUND(v_approval_rate * 100, 2) || '%)',
        'system',
        jsonb_build_object(
            'approval_rate', v_approval_rate,
            'threshold', v_threshold,
            'votes_for', v_dissolution.votes_for,
            'votes_against', v_dissolution.votes_against,
            'new_status', v_new_status
        )
    );

    RETURN v_new_status::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to finalize objection window
CREATE OR REPLACE FUNCTION finalize_objection_window(
    p_dissolution_id UUID
) RETURNS TEXT AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_unresolved_objections INTEGER;
    v_new_status dissolution_status;
    v_config dissolution_trigger_config%ROWTYPE;
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    IF v_dissolution.status != 'objection_window' THEN
        RAISE EXCEPTION 'Dissolution is not in objection window status';
    END IF;

    -- Get config
    SELECT * INTO v_config FROM dissolution_trigger_config WHERE trigger_type = v_dissolution.trigger_type;

    -- Count unresolved objections
    SELECT COUNT(*) INTO v_unresolved_objections
    FROM dissolution_objections
    WHERE dissolution_request_id = p_dissolution_id
    AND resolved = false;

    IF v_unresolved_objections > 0 AND v_config.can_be_contested THEN
        -- Has unresolved objections, move to contested
        v_new_status := 'contested';
    ELSE
        -- No objections or non-contestable, approve for execution
        v_new_status := 'approved';
    END IF;

    UPDATE dissolution_requests
    SET
        status = v_new_status,
        updated_at = now()
    WHERE id = p_dissolution_id;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_type,
        new_state
    ) VALUES (
        p_dissolution_id,
        'objection_window_finalized',
        'Objection window closed. Status: ' || v_new_status::TEXT || '. Unresolved objections: ' || v_unresolved_objections,
        'system',
        jsonb_build_object('unresolved_objections', v_unresolved_objections, 'new_status', v_new_status)
    );

    RETURN v_new_status::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute dissolution (distribute refunds)
CREATE OR REPLACE FUNCTION execute_dissolution(
    p_dissolution_id UUID,
    p_executed_by UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
    v_config dissolution_trigger_config%ROWTYPE;
    v_member RECORD;
    v_total_refunded DECIMAL(15,2) := 0;
    v_platform_fee DECIMAL(15,2);
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    IF v_dissolution.status != 'approved' THEN
        RAISE EXCEPTION 'Dissolution must be approved before execution';
    END IF;

    -- Update status to executing
    UPDATE dissolution_requests
    SET status = 'executing', updated_at = now()
    WHERE id = p_dissolution_id;

    -- Get config for XnScore impact
    SELECT * INTO v_config FROM dissolution_trigger_config WHERE trigger_type = v_dissolution.trigger_type;

    -- Process each member's refund
    FOR v_member IN
        SELECT * FROM dissolution_member_positions
        WHERE dissolution_request_id = p_dissolution_id
        AND adjusted_refund > 0
    LOOP
        -- Get user's current XnScore
        UPDATE dissolution_member_positions
        SET
            xn_score_before = (SELECT COALESCE(xn_score, 500) FROM profiles WHERE user_id = v_member.user_id),
            xn_score_change = v_config.xn_score_impact
        WHERE id = v_member.id;

        -- Credit refund to user's wallet
        -- Using wallet transaction (assuming wallet infrastructure from migration 015)
        INSERT INTO wallet_transactions (
            user_id,
            type,
            amount,
            balance_type,
            description,
            reference_type,
            reference_id,
            status
        ) VALUES (
            v_member.user_id,
            'credit',
            v_member.adjusted_refund,
            'main',
            'Circle dissolution refund',
            'dissolution',
            p_dissolution_id,
            'completed'
        );

        -- Update user wallet balance
        UPDATE user_wallets
        SET
            main_balance = main_balance + v_member.adjusted_refund,
            updated_at = now()
        WHERE user_id = v_member.user_id;

        -- Update member position status
        UPDATE dissolution_member_positions
        SET
            refund_status = 'completed',
            refund_method = 'wallet',
            refund_executed_at = now(),
            xn_score_after = xn_score_before + v_config.xn_score_impact
        WHERE id = v_member.id;

        -- Update user's XnScore in profiles
        UPDATE profiles
        SET xn_score = GREATEST(0, LEAST(1000, COALESCE(xn_score, 500) + v_config.xn_score_impact))
        WHERE user_id = v_member.user_id;

        v_total_refunded := v_total_refunded + v_member.adjusted_refund;
    END LOOP;

    -- Calculate platform fee (remaining balance)
    v_platform_fee := v_dissolution.total_pool_amount - v_total_refunded;

    -- Update dissolution as completed
    UPDATE dissolution_requests
    SET
        status = 'completed',
        total_refund_amount = v_total_refunded,
        platform_fee_amount = v_platform_fee,
        resolved_at = now(),
        resolved_by = p_executed_by,
        updated_at = now()
    WHERE id = p_dissolution_id;

    -- Update circle status to dissolved
    UPDATE circles
    SET
        status = 'dissolved',
        updated_at = now()
    WHERE id = v_dissolution.circle_id;

    -- Update all circle members to inactive
    UPDATE circle_members
    SET
        status = 'inactive',
        left_at = now(),
        leave_reason = 'circle_dissolved'
    WHERE circle_id = v_dissolution.circle_id;

    -- Record completion event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_id,
        actor_type,
        new_state
    ) VALUES (
        p_dissolution_id,
        'dissolution_completed',
        'Dissolution executed. Total refunded: ' || v_total_refunded || ', Platform fee: ' || v_platform_fee,
        p_executed_by,
        CASE WHEN p_executed_by IS NULL THEN 'system' ELSE 'admin' END,
        jsonb_build_object(
            'total_refunded', v_total_refunded,
            'platform_fee', v_platform_fee,
            'members_refunded', (SELECT COUNT(*) FROM dissolution_member_positions WHERE dissolution_request_id = p_dissolution_id AND refund_status = 'completed')
        )
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel a dissolution request
CREATE OR REPLACE FUNCTION cancel_dissolution(
    p_dissolution_id UUID,
    p_cancelled_by UUID,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_dissolution dissolution_requests%ROWTYPE;
BEGIN
    -- Get dissolution request
    SELECT * INTO v_dissolution FROM dissolution_requests WHERE id = p_dissolution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Dissolution request not found';
    END IF;

    -- Can only cancel if in early stages
    IF v_dissolution.status NOT IN ('proposed', 'voting') THEN
        RAISE EXCEPTION 'Dissolution cannot be cancelled at this stage';
    END IF;

    -- Only initiator or admin can cancel
    IF v_dissolution.initiated_by != p_cancelled_by THEN
        -- Check if admin (would need admin check here)
        RAISE EXCEPTION 'Only the initiator can cancel this dissolution request';
    END IF;

    -- Update status
    UPDATE dissolution_requests
    SET
        status = 'cancelled',
        resolved_at = now(),
        resolved_by = p_cancelled_by,
        resolution_notes = p_reason,
        updated_at = now()
    WHERE id = p_dissolution_id;

    -- Record event
    INSERT INTO dissolution_events (
        dissolution_request_id,
        event_type,
        event_description,
        actor_id,
        new_state
    ) VALUES (
        p_dissolution_id,
        'dissolution_cancelled',
        'Dissolution cancelled: ' || p_reason,
        p_cancelled_by,
        jsonb_build_object('reason', p_reason)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ SCHEDULED JOB FUNCTIONS                                                     │
-- │ To be called by pg_cron or external scheduler                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Function to process expired voting periods
CREATE OR REPLACE FUNCTION process_expired_dissolution_votes()
RETURNS INTEGER AS $$
DECLARE
    v_processed INTEGER := 0;
    v_dissolution RECORD;
BEGIN
    FOR v_dissolution IN
        SELECT id FROM dissolution_requests
        WHERE status = 'voting'
        AND voting_ends_at <= now()
    LOOP
        PERFORM process_dissolution_vote_results(v_dissolution.id);
        v_processed := v_processed + 1;
    END LOOP;

    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to process expired objection windows
CREATE OR REPLACE FUNCTION process_expired_objection_windows()
RETURNS INTEGER AS $$
DECLARE
    v_processed INTEGER := 0;
    v_dissolution RECORD;
BEGIN
    FOR v_dissolution IN
        SELECT id FROM dissolution_requests
        WHERE status = 'objection_window'
        AND objection_window_ends_at <= now()
    LOOP
        PERFORM finalize_objection_window(v_dissolution.id);
        v_processed := v_processed + 1;
    END LOOP;

    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-execute approved dissolutions
CREATE OR REPLACE FUNCTION auto_execute_approved_dissolutions()
RETURNS INTEGER AS $$
DECLARE
    v_executed INTEGER := 0;
    v_dissolution RECORD;
BEGIN
    FOR v_dissolution IN
        SELECT id FROM dissolution_requests
        WHERE status = 'approved'
    LOOP
        PERFORM execute_dissolution(v_dissolution.id);
        v_executed := v_executed + 1;
    END LOOP;

    RETURN v_executed;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS FOR COMMON QUERIES                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Active dissolution requests view
CREATE OR REPLACE VIEW v_active_dissolution_requests AS
SELECT
    dr.*,
    c.name as circle_name,
    dtc.tier,
    dtc.description as trigger_description,
    CASE
        WHEN dr.status = 'voting' THEN dr.voting_ends_at - now()
        WHEN dr.status = 'objection_window' THEN dr.objection_window_ends_at - now()
        ELSE NULL
    END as time_remaining,
    (SELECT COUNT(*) FROM dissolution_votes WHERE dissolution_request_id = dr.id) as total_votes_cast
FROM dissolution_requests dr
JOIN circles c ON c.id = dr.circle_id
JOIN dissolution_trigger_config dtc ON dtc.trigger_type = dr.trigger_type
WHERE dr.status NOT IN ('completed', 'rejected', 'cancelled');

-- Member dissolution summary view
CREATE OR REPLACE VIEW v_member_dissolution_summary AS
SELECT
    dmp.user_id,
    dr.id as dissolution_id,
    dr.circle_id,
    c.name as circle_name,
    dr.trigger_type,
    dr.status,
    dmp.total_contributed,
    dmp.total_received,
    dmp.net_position,
    dmp.calculated_refund,
    dmp.adjusted_refund,
    dmp.refund_status,
    dmp.xn_score_change,
    dv.vote as user_vote
FROM dissolution_member_positions dmp
JOIN dissolution_requests dr ON dr.id = dmp.dissolution_request_id
JOIN circles c ON c.id = dr.circle_id
LEFT JOIN dissolution_votes dv ON dv.dissolution_request_id = dr.id AND dv.user_id = dmp.user_id;

-- Dissolution analytics view
CREATE OR REPLACE VIEW v_dissolution_analytics AS
SELECT
    trigger_type,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
    AVG(total_pool_amount) as avg_pool_amount,
    AVG(total_refund_amount) as avg_refund_amount,
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM dissolution_requests
GROUP BY trigger_type;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Enable RLS on all dissolution tables
ALTER TABLE dissolution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dissolution_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dissolution_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dissolution_member_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dissolution_events ENABLE ROW LEVEL SECURITY;

-- Dissolution Requests policies
CREATE POLICY "Users can view dissolution requests for their circles"
ON dissolution_requests FOR SELECT
USING (
    circle_id IN (
        SELECT circle_id FROM circle_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Members can initiate dissolution for their circles"
ON dissolution_requests FOR INSERT
WITH CHECK (
    circle_id IN (
        SELECT circle_id FROM circle_members WHERE user_id = auth.uid() AND status = 'active'
    )
);

-- Dissolution Votes policies
CREATE POLICY "Users can view votes on their circle dissolutions"
ON dissolution_votes FOR SELECT
USING (
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can vote on their circle dissolutions"
ON dissolution_votes FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
);

CREATE POLICY "Users can update their own votes"
ON dissolution_votes FOR UPDATE
USING (user_id = auth.uid());

-- Dissolution Objections policies
CREATE POLICY "Users can view objections for their circle dissolutions"
ON dissolution_objections FOR SELECT
USING (
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid()
    )
);

CREATE POLICY "Members can file objections for their circle dissolutions"
ON dissolution_objections FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid() AND cm.status = 'active'
    )
);

-- Dissolution Member Positions policies
CREATE POLICY "Users can view their own dissolution positions"
ON dissolution_member_positions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can view positions in their circle dissolutions"
ON dissolution_member_positions FOR SELECT
USING (
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid()
    )
);

-- Dissolution Events policies
CREATE POLICY "Users can view events for their circle dissolutions"
ON dissolution_events FOR SELECT
USING (
    dissolution_request_id IN (
        SELECT dr.id FROM dissolution_requests dr
        JOIN circle_members cm ON cm.circle_id = dr.circle_id
        WHERE cm.user_id = auth.uid()
    )
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_dissolution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_dissolution_requests_updated
    BEFORE UPDATE ON dissolution_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_dissolution_timestamp();

CREATE TRIGGER tr_dissolution_votes_updated
    BEFORE UPDATE ON dissolution_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_dissolution_timestamp();

CREATE TRIGGER tr_dissolution_objections_updated
    BEFORE UPDATE ON dissolution_objections
    FOR EACH ROW
    EXECUTE FUNCTION update_dissolution_timestamp();

CREATE TRIGGER tr_dissolution_member_positions_updated
    BEFORE UPDATE ON dissolution_member_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_dissolution_timestamp();

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 016: Circle Dissolution System
-- ══════════════════════════════════════════════════════════════════════════════
