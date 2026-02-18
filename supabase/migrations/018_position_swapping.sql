-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 018 v2: Position Swapping System (Clean Install)
-- ══════════════════════════════════════════════════════════════════════════════
-- Drops any partial objects from failed migration, then recreates cleanly
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CLEANUP: Drop existing objects if partial migration occurred               │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS v_circle_swap_statistics CASCADE;
DROP VIEW IF EXISTS v_swap_history_summary CASCADE;
DROP VIEW IF EXISTS v_swap_requests_full CASCADE;

-- Drop functions (they reference tables/enums)
DROP FUNCTION IF EXISTS process_expired_swap_requests() CASCADE;
DROP FUNCTION IF EXISTS get_swap_requests_pending_elder_approval(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_swap_requests_awaiting_confirmation(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_pending_swap_requests_for_user(UUID) CASCADE;
DROP FUNCTION IF EXISTS execute_position_swap(UUID) CASCADE;
DROP FUNCTION IF EXISTS cancel_swap_request(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS elder_decide_swap(UUID, UUID, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS confirm_swap_request(UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS respond_to_swap_request(UUID, UUID, BOOLEAN, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_swap_request(UUID, UUID, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS can_request_swap(UUID, UUID, UUID, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_circle_swap_config(UUID) CASCADE;
DROP FUNCTION IF EXISTS update_swap_timestamp() CASCADE;

-- Drop tables (in order due to foreign keys)
DROP TABLE IF EXISTS member_swap_history CASCADE;
DROP TABLE IF EXISTS position_swap_events CASCADE;
DROP TABLE IF EXISTS position_swap_requests CASCADE;

-- Drop enums
DROP TYPE IF EXISTS swap_event_type CASCADE;
DROP TYPE IF EXISTS swap_request_status CASCADE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TYPE swap_request_status AS ENUM (
    'pending_target',
    'pending_confirmation',
    'pending_elder_approval',
    'approved',
    'executing',
    'completed',
    'rejected',
    'cancelled',
    'expired',
    'elder_denied'
);

CREATE TYPE swap_event_type AS ENUM (
    'request_created',
    'target_accepted',
    'target_rejected',
    'requester_confirmed',
    'requester_cancelled',
    'elder_approved',
    'elder_denied',
    'swap_executed',
    'swap_expired',
    'request_withdrawn'
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TABLES                                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Add swap configuration to circles (idempotent)
ALTER TABLE circles ADD COLUMN IF NOT EXISTS swap_config JSONB DEFAULT '{
    "swaps_enabled": true,
    "require_elder_approval": false,
    "min_xn_score_for_early_position": 70,
    "early_position_threshold": 3,
    "max_swaps_per_cycle": 2,
    "max_swaps_per_member_per_cycle": 1,
    "blackout_cycles_before_payout": 1,
    "request_expiry_hours": 48,
    "cooling_off_hours": 24,
    "swap_fee_percentage": 0
}';

-- Position swap requests table
CREATE TABLE position_swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Requester info
    requester_user_id UUID NOT NULL REFERENCES profiles(id),
    requester_position INTEGER NOT NULL,
    requester_xn_score INTEGER,

    -- Target info
    target_user_id UUID NOT NULL REFERENCES profiles(id),
    target_position INTEGER NOT NULL,
    target_xn_score INTEGER,

    -- Request details
    request_reason TEXT,
    swap_status swap_request_status NOT NULL DEFAULT 'pending_target',

    -- Double confirmation tracking
    target_accepted_at TIMESTAMPTZ,
    target_response_reason TEXT,
    requester_confirmed_at TIMESTAMPTZ,
    requester_confirmation_reason TEXT,

    -- Elder approval tracking
    elder_approved_by UUID REFERENCES profiles(id),
    elder_decision_at TIMESTAMPTZ,
    elder_decision_reason TEXT,

    -- Expiry and timing
    expires_at TIMESTAMPTZ NOT NULL,
    cooling_off_ends_at TIMESTAMPTZ,

    -- Fee tracking
    swap_fee_amount DECIMAL(15,2) DEFAULT 0,
    swap_fee_paid_by TEXT CHECK (swap_fee_paid_by IN ('requester', 'target', 'split', 'waived')),

    -- Execution tracking
    executed_at TIMESTAMPTZ,
    executed_by_system BOOLEAN DEFAULT false,

    -- Metadata
    cycle_number INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT swap_different_users CHECK (requester_user_id != target_user_id),
    CONSTRAINT swap_different_positions CHECK (requester_position != target_position)
);

-- Position swap events (audit trail)
CREATE TABLE position_swap_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    swap_request_id UUID NOT NULL REFERENCES position_swap_requests(id) ON DELETE CASCADE,
    event_type swap_event_type NOT NULL,
    actor_user_id UUID REFERENCES profiles(id),
    actor_role TEXT,
    event_details TEXT,
    xn_score_change INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Member swap history (denormalized for quick lookup)
CREATE TABLE member_swap_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    swap_request_id UUID NOT NULL REFERENCES position_swap_requests(id) ON DELETE CASCADE,
    swap_role TEXT NOT NULL CHECK (swap_role IN ('requester', 'target')),
    old_position INTEGER NOT NULL,
    new_position INTEGER NOT NULL,
    swap_partner_id UUID NOT NULL REFERENCES profiles(id),
    was_generous BOOLEAN DEFAULT false,
    xn_score_impact INTEGER DEFAULT 0,
    cycle_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_swap_requests_circle ON position_swap_requests(circle_id);
CREATE INDEX idx_swap_requests_requester ON position_swap_requests(requester_user_id);
CREATE INDEX idx_swap_requests_target ON position_swap_requests(target_user_id);
CREATE INDEX idx_swap_requests_status ON position_swap_requests(swap_status);
CREATE INDEX idx_swap_requests_expires ON position_swap_requests(expires_at)
    WHERE swap_status IN ('pending_target', 'pending_confirmation', 'pending_elder_approval');
CREATE INDEX idx_swap_events_request ON position_swap_events(swap_request_id);
CREATE INDEX idx_swap_events_actor ON position_swap_events(actor_user_id);
CREATE INDEX idx_swap_history_user ON member_swap_history(user_id);
CREATE INDEX idx_swap_history_circle ON member_swap_history(circle_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get circle swap configuration with defaults
CREATE FUNCTION get_circle_swap_config(p_circle_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_config JSONB;
    v_defaults JSONB := '{
        "swaps_enabled": true,
        "require_elder_approval": false,
        "min_xn_score_for_early_position": 70,
        "early_position_threshold": 3,
        "max_swaps_per_cycle": 2,
        "max_swaps_per_member_per_cycle": 1,
        "blackout_cycles_before_payout": 1,
        "request_expiry_hours": 48,
        "cooling_off_hours": 24,
        "swap_fee_percentage": 0
    }';
BEGIN
    SELECT swap_config INTO v_config FROM circles WHERE id = p_circle_id;
    RETURN v_defaults || COALESCE(v_config, '{}');
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if swap is allowed
CREATE FUNCTION can_request_swap(
    p_circle_id UUID,
    p_requester_id UUID,
    p_target_id UUID,
    p_requester_position INTEGER,
    p_target_position INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_config JSONB;
    v_circle RECORD;
    v_requester_member RECORD;
    v_target_member RECORD;
    v_requester_xn INTEGER;
    v_target_xn INTEGER;
    v_requester_swaps INTEGER;
    v_target_swaps INTEGER;
    v_circle_swaps INTEGER;
    v_cycles_to_payout INTEGER;
BEGIN
    -- Get config
    v_config := get_circle_swap_config(p_circle_id);

    -- Check if swaps are enabled
    IF NOT (v_config->>'swaps_enabled')::BOOLEAN THEN
        RETURN QUERY SELECT false, 'Position swaps are disabled for this circle';
        RETURN;
    END IF;

    -- Get circle details
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Circle not found';
        RETURN;
    END IF;

    -- Check circle status
    IF v_circle.status NOT IN ('active', 'in_progress') THEN
        RETURN QUERY SELECT false, 'Circle must be active to swap positions';
        RETURN;
    END IF;

    -- Verify both users are active members
    SELECT * INTO v_requester_member
    FROM circle_members
    WHERE circle_id = p_circle_id AND user_id = p_requester_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Requester is not an active member';
        RETURN;
    END IF;

    SELECT * INTO v_target_member
    FROM circle_members
    WHERE circle_id = p_circle_id AND user_id = p_target_id AND status = 'active';

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Target is not an active member';
        RETURN;
    END IF;

    -- Check for existing pending swap involving either user
    IF EXISTS (
        SELECT 1 FROM position_swap_requests
        WHERE circle_id = p_circle_id
        AND swap_status IN ('pending_target', 'pending_confirmation', 'pending_elder_approval', 'approved')
        AND (requester_user_id IN (p_requester_id, p_target_id) OR target_user_id IN (p_requester_id, p_target_id))
    ) THEN
        RETURN QUERY SELECT false, 'There is already a pending swap request involving one of these members';
        RETURN;
    END IF;

    -- Get XnScores
    SELECT COALESCE(xn_score, 50) INTO v_requester_xn FROM profiles WHERE id = p_requester_id;
    SELECT COALESCE(xn_score, 50) INTO v_target_xn FROM profiles WHERE id = p_target_id;

    -- Check XnScore for early positions
    IF p_target_position <= (v_config->>'early_position_threshold')::INTEGER THEN
        IF v_requester_xn < (v_config->>'min_xn_score_for_early_position')::INTEGER THEN
            RETURN QUERY SELECT false,
                format('XnScore of %s required for early positions (you have %s)',
                    (v_config->>'min_xn_score_for_early_position')::INTEGER, v_requester_xn);
            RETURN;
        END IF;
    END IF;

    -- Check max swaps per member per cycle
    SELECT COUNT(*) INTO v_requester_swaps
    FROM member_swap_history
    WHERE user_id = p_requester_id
    AND circle_id = p_circle_id
    AND cycle_number = COALESCE(v_circle.current_cycle, 1);

    IF v_requester_swaps >= (v_config->>'max_swaps_per_member_per_cycle')::INTEGER THEN
        RETURN QUERY SELECT false, 'You have reached your swap limit for this cycle';
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_target_swaps
    FROM member_swap_history
    WHERE user_id = p_target_id
    AND circle_id = p_circle_id
    AND cycle_number = COALESCE(v_circle.current_cycle, 1);

    IF v_target_swaps >= (v_config->>'max_swaps_per_member_per_cycle')::INTEGER THEN
        RETURN QUERY SELECT false, 'Target member has reached their swap limit for this cycle';
        RETURN;
    END IF;

    -- Check max swaps per cycle for circle
    SELECT COUNT(*) INTO v_circle_swaps
    FROM position_swap_requests
    WHERE circle_id = p_circle_id
    AND cycle_number = COALESCE(v_circle.current_cycle, 1)
    AND swap_status = 'completed';

    IF v_circle_swaps >= (v_config->>'max_swaps_per_cycle')::INTEGER THEN
        RETURN QUERY SELECT false, 'Maximum swaps for this cycle have been reached';
        RETURN;
    END IF;

    -- Check blackout period (if either position is close to payout)
    v_cycles_to_payout := LEAST(
        p_requester_position - COALESCE(v_circle.current_cycle, 1),
        p_target_position - COALESCE(v_circle.current_cycle, 1)
    );

    IF v_cycles_to_payout >= 0 AND v_cycles_to_payout < (v_config->>'blackout_cycles_before_payout')::INTEGER THEN
        RETURN QUERY SELECT false, 'Cannot swap - too close to payout cycle (blackout period)';
        RETURN;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT true, 'Swap request allowed';
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CORE FUNCTIONS                                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Create a position swap request
CREATE FUNCTION create_swap_request(
    p_circle_id UUID,
    p_requester_id UUID,
    p_target_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_config JSONB;
    v_circle RECORD;
    v_requester_position INTEGER;
    v_target_position INTEGER;
    v_requester_xn INTEGER;
    v_target_xn INTEGER;
    v_can_swap RECORD;
    v_expiry_hours INTEGER;
BEGIN
    -- Get positions
    SELECT position INTO v_requester_position
    FROM circle_members
    WHERE circle_id = p_circle_id AND user_id = p_requester_id AND status = 'active';

    SELECT position INTO v_target_position
    FROM circle_members
    WHERE circle_id = p_circle_id AND user_id = p_target_id AND status = 'active';

    IF v_requester_position IS NULL OR v_target_position IS NULL THEN
        RAISE EXCEPTION 'Could not find positions for members';
    END IF;

    -- Check if swap is allowed
    SELECT * INTO v_can_swap FROM can_request_swap(
        p_circle_id, p_requester_id, p_target_id,
        v_requester_position, v_target_position
    );

    IF NOT v_can_swap.allowed THEN
        RAISE EXCEPTION '%', v_can_swap.reason;
    END IF;

    -- Get config and circle
    v_config := get_circle_swap_config(p_circle_id);
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
    v_expiry_hours := (v_config->>'request_expiry_hours')::INTEGER;

    -- Get XnScores
    SELECT COALESCE(xn_score, 50) INTO v_requester_xn FROM profiles WHERE id = p_requester_id;
    SELECT COALESCE(xn_score, 50) INTO v_target_xn FROM profiles WHERE id = p_target_id;

    -- Create the request
    INSERT INTO position_swap_requests (
        circle_id,
        requester_user_id, requester_position, requester_xn_score,
        target_user_id, target_position, target_xn_score,
        request_reason,
        swap_status,
        expires_at,
        cycle_number
    ) VALUES (
        p_circle_id,
        p_requester_id, v_requester_position, v_requester_xn,
        p_target_id, v_target_position, v_target_xn,
        p_reason,
        'pending_target',
        now() + (v_expiry_hours || ' hours')::INTERVAL,
        COALESCE(v_circle.current_cycle, 1)
    ) RETURNING id INTO v_request_id;

    -- Log the event
    INSERT INTO position_swap_events (
        swap_request_id, event_type, actor_user_id, actor_role, event_details
    ) VALUES (
        v_request_id, 'request_created', p_requester_id, 'requester',
        format('Requested swap: Position %s → Position %s', v_requester_position, v_target_position)
    );

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Target responds to swap request
CREATE FUNCTION respond_to_swap_request(
    p_request_id UUID,
    p_target_id UUID,
    p_accept BOOLEAN,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_request position_swap_requests%ROWTYPE;
    v_config JSONB;
    v_cooling_hours INTEGER;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    -- Verify caller is the target
    IF v_request.target_user_id != p_target_id THEN
        RAISE EXCEPTION 'Only the target member can respond';
    END IF;

    -- Check status
    IF v_request.swap_status != 'pending_target' THEN
        RAISE EXCEPTION 'Request is not pending target response';
    END IF;

    -- Check expiry
    IF v_request.expires_at < now() THEN
        UPDATE position_swap_requests SET swap_status = 'expired', updated_at = now() WHERE id = p_request_id;
        INSERT INTO position_swap_events (swap_request_id, event_type, actor_role, event_details)
        VALUES (p_request_id, 'swap_expired', 'system', 'Request expired before target responded');
        RAISE EXCEPTION 'Request has expired';
    END IF;

    IF p_accept THEN
        -- Get cooling off period
        v_config := get_circle_swap_config(v_request.circle_id);
        v_cooling_hours := (v_config->>'cooling_off_hours')::INTEGER;

        -- Update to pending confirmation (double-confirmation step)
        UPDATE position_swap_requests SET
            swap_status = 'pending_confirmation',
            target_accepted_at = now(),
            target_response_reason = p_reason,
            cooling_off_ends_at = now() + (v_cooling_hours || ' hours')::INTERVAL,
            updated_at = now()
        WHERE id = p_request_id;

        INSERT INTO position_swap_events (
            swap_request_id, event_type, actor_user_id, actor_role, event_details
        ) VALUES (
            p_request_id, 'target_accepted', p_target_id, 'target',
            COALESCE(p_reason, 'Accepted swap request')
        );
    ELSE
        -- Reject the swap
        UPDATE position_swap_requests SET
            swap_status = 'rejected',
            target_response_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        INSERT INTO position_swap_events (
            swap_request_id, event_type, actor_user_id, actor_role, event_details
        ) VALUES (
            p_request_id, 'target_rejected', p_target_id, 'target',
            COALESCE(p_reason, 'Declined swap request')
        );
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Requester confirms the swap (double confirmation anti-coercion measure)
CREATE FUNCTION confirm_swap_request(
    p_request_id UUID,
    p_requester_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_request position_swap_requests%ROWTYPE;
    v_config JSONB;
    v_requires_elder BOOLEAN;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    -- Verify caller is the requester
    IF v_request.requester_user_id != p_requester_id THEN
        RAISE EXCEPTION 'Only the requester can confirm';
    END IF;

    -- Check status
    IF v_request.swap_status != 'pending_confirmation' THEN
        RAISE EXCEPTION 'Request is not pending confirmation';
    END IF;

    -- Check cooling off period
    IF v_request.cooling_off_ends_at IS NOT NULL AND v_request.cooling_off_ends_at > now() THEN
        RAISE EXCEPTION 'Cooling off period has not ended yet. Please wait until %', v_request.cooling_off_ends_at;
    END IF;

    -- Check expiry
    IF v_request.expires_at < now() THEN
        UPDATE position_swap_requests SET swap_status = 'expired', updated_at = now() WHERE id = p_request_id;
        INSERT INTO position_swap_events (swap_request_id, event_type, actor_role, event_details)
        VALUES (p_request_id, 'swap_expired', 'system', 'Request expired before requester confirmed');
        RAISE EXCEPTION 'Request has expired';
    END IF;

    -- Check if elder approval required
    v_config := get_circle_swap_config(v_request.circle_id);
    v_requires_elder := (v_config->>'require_elder_approval')::BOOLEAN;

    -- Update status
    UPDATE position_swap_requests SET
        requester_confirmed_at = now(),
        requester_confirmation_reason = p_reason,
        swap_status = CASE WHEN v_requires_elder THEN 'pending_elder_approval' ELSE 'approved' END,
        updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO position_swap_events (
        swap_request_id, event_type, actor_user_id, actor_role, event_details
    ) VALUES (
        p_request_id, 'requester_confirmed', p_requester_id, 'requester',
        COALESCE(p_reason, 'Confirmed swap request')
    );

    -- If no elder approval needed, execute immediately
    IF NOT v_requires_elder THEN
        PERFORM execute_position_swap(p_request_id);
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Elder approves or denies the swap
CREATE FUNCTION elder_decide_swap(
    p_request_id UUID,
    p_elder_id UUID,
    p_approve BOOLEAN,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_request position_swap_requests%ROWTYPE;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    -- Verify caller is an elder/admin/creator
    IF NOT EXISTS (
        SELECT 1 FROM circle_members
        WHERE circle_id = v_request.circle_id
        AND user_id = p_elder_id
        AND role IN ('elder', 'admin', 'creator')
    ) THEN
        RAISE EXCEPTION 'Only circle Elders can approve/deny swaps';
    END IF;

    -- Check status
    IF v_request.swap_status != 'pending_elder_approval' THEN
        RAISE EXCEPTION 'Request is not pending Elder approval';
    END IF;

    IF p_approve THEN
        UPDATE position_swap_requests SET
            swap_status = 'approved',
            elder_approved_by = p_elder_id,
            elder_decision_at = now(),
            elder_decision_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        INSERT INTO position_swap_events (
            swap_request_id, event_type, actor_user_id, actor_role, event_details
        ) VALUES (
            p_request_id, 'elder_approved', p_elder_id, 'elder',
            COALESCE(p_reason, 'Elder approved the swap')
        );

        -- Execute the swap
        PERFORM execute_position_swap(p_request_id);
    ELSE
        UPDATE position_swap_requests SET
            swap_status = 'elder_denied',
            elder_approved_by = p_elder_id,
            elder_decision_at = now(),
            elder_decision_reason = p_reason,
            updated_at = now()
        WHERE id = p_request_id;

        INSERT INTO position_swap_events (
            swap_request_id, event_type, actor_user_id, actor_role, event_details
        ) VALUES (
            p_request_id, 'elder_denied', p_elder_id, 'elder',
            COALESCE(p_reason, 'Elder denied the swap')
        );
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel a swap request (requester only, before completion)
CREATE FUNCTION cancel_swap_request(
    p_request_id UUID,
    p_user_id UUID,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_request position_swap_requests%ROWTYPE;
    v_xn_penalty INTEGER := 0;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    -- Only requester can cancel, or elder can cancel at any time
    IF v_request.requester_user_id != p_user_id THEN
        IF NOT EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = v_request.circle_id
            AND user_id = p_user_id
            AND role IN ('elder', 'admin', 'creator')
        ) THEN
            RAISE EXCEPTION 'Only the requester or an Elder can cancel this request';
        END IF;
    END IF;

    -- Check status - cannot cancel completed or already cancelled
    IF v_request.swap_status IN ('completed', 'cancelled', 'expired', 'rejected', 'elder_denied') THEN
        RAISE EXCEPTION 'Cannot cancel a request that is already %', v_request.swap_status;
    END IF;

    -- XnScore penalty if cancelling after target accepted
    IF v_request.swap_status IN ('pending_confirmation', 'pending_elder_approval', 'approved') THEN
        v_xn_penalty := -2;
        UPDATE profiles SET xn_score = GREATEST(0, xn_score + v_xn_penalty) WHERE id = v_request.requester_user_id;
    END IF;

    -- Update status
    UPDATE position_swap_requests SET
        swap_status = 'cancelled',
        updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO position_swap_events (
        swap_request_id, event_type, actor_user_id, actor_role, event_details, xn_score_change
    ) VALUES (
        p_request_id, 'requester_cancelled', p_user_id,
        CASE WHEN v_request.requester_user_id = p_user_id THEN 'requester' ELSE 'elder' END,
        COALESCE(p_reason, 'Cancelled swap request'),
        v_xn_penalty
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the position swap (internal function)
CREATE FUNCTION execute_position_swap(p_request_id UUID) RETURNS BOOLEAN AS $$
DECLARE
    v_request position_swap_requests%ROWTYPE;
    v_requester_generous BOOLEAN;
    v_target_generous BOOLEAN;
    v_requester_xn_change INTEGER := 2;
    v_target_xn_change INTEGER := 2;
BEGIN
    -- Get the request
    SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Swap request not found';
    END IF;

    -- Verify status
    IF v_request.swap_status != 'approved' THEN
        RAISE EXCEPTION 'Swap must be approved before execution';
    END IF;

    -- Mark as executing
    UPDATE position_swap_requests SET swap_status = 'executing', updated_at = now() WHERE id = p_request_id;

    -- Perform the swap atomically
    UPDATE circle_members SET position = v_request.target_position, updated_at = now()
    WHERE circle_id = v_request.circle_id AND user_id = v_request.requester_user_id;

    UPDATE circle_members SET position = v_request.requester_position, updated_at = now()
    WHERE circle_id = v_request.circle_id AND user_id = v_request.target_user_id;

    -- Determine generosity (giving up earlier position)
    v_requester_generous := v_request.requester_position < v_request.target_position;
    v_target_generous := v_request.target_position < v_request.requester_position;

    -- Add generosity bonus (+5 for giving up earlier position)
    IF v_requester_generous THEN
        v_requester_xn_change := v_requester_xn_change + 5;
    END IF;
    IF v_target_generous THEN
        v_target_xn_change := v_target_xn_change + 5;
    END IF;

    -- Apply XnScore changes
    UPDATE profiles SET xn_score = LEAST(100, xn_score + v_requester_xn_change) WHERE id = v_request.requester_user_id;
    UPDATE profiles SET xn_score = LEAST(100, xn_score + v_target_xn_change) WHERE id = v_request.target_user_id;

    -- Record history for requester
    INSERT INTO member_swap_history (
        user_id, circle_id, swap_request_id, swap_role,
        old_position, new_position, swap_partner_id,
        was_generous, xn_score_impact, cycle_number
    ) VALUES (
        v_request.requester_user_id, v_request.circle_id, p_request_id, 'requester',
        v_request.requester_position, v_request.target_position, v_request.target_user_id,
        v_requester_generous, v_requester_xn_change, v_request.cycle_number
    );

    -- Record history for target
    INSERT INTO member_swap_history (
        user_id, circle_id, swap_request_id, swap_role,
        old_position, new_position, swap_partner_id,
        was_generous, xn_score_impact, cycle_number
    ) VALUES (
        v_request.target_user_id, v_request.circle_id, p_request_id, 'target',
        v_request.target_position, v_request.requester_position, v_request.requester_user_id,
        v_target_generous, v_target_xn_change, v_request.cycle_number
    );

    -- Mark as completed
    UPDATE position_swap_requests SET
        swap_status = 'completed',
        executed_at = now(),
        executed_by_system = true,
        updated_at = now()
    WHERE id = p_request_id;

    -- Log the event
    INSERT INTO position_swap_events (
        swap_request_id, event_type, actor_role, event_details
    ) VALUES (
        p_request_id, 'swap_executed', 'system',
        format('Positions swapped: %s ↔ %s', v_request.requester_position, v_request.target_position)
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process expired swap requests (scheduled job)
CREATE FUNCTION process_expired_swap_requests() RETURNS INTEGER AS $$
DECLARE
    v_processed INTEGER := 0;
    v_request RECORD;
BEGIN
    FOR v_request IN
        SELECT id FROM position_swap_requests
        WHERE swap_status IN ('pending_target', 'pending_confirmation', 'pending_elder_approval')
        AND expires_at <= now()
    LOOP
        UPDATE position_swap_requests SET swap_status = 'expired', updated_at = now() WHERE id = v_request.id;

        INSERT INTO position_swap_events (swap_request_id, event_type, actor_role, event_details)
        VALUES (v_request.id, 'swap_expired', 'system', 'Request expired without completion');

        v_processed := v_processed + 1;
    END LOOP;

    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ QUERY FUNCTIONS                                                             │
-- └─────────────────────────────────────────────────────────────────────────────┘

-- Get pending swap requests for a user (as target)
CREATE FUNCTION get_pending_swap_requests_for_user(p_user_id UUID)
RETURNS TABLE (
    request_id UUID,
    circle_id UUID,
    circle_name TEXT,
    requester_id UUID,
    requester_name TEXT,
    requester_position INTEGER,
    your_position INTEGER,
    request_reason TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        psr.id,
        psr.circle_id,
        c.name,
        psr.requester_user_id,
        p.full_name,
        psr.requester_position,
        psr.target_position,
        psr.request_reason,
        psr.expires_at,
        psr.created_at
    FROM position_swap_requests psr
    JOIN circles c ON c.id = psr.circle_id
    JOIN profiles p ON p.id = psr.requester_user_id
    WHERE psr.target_user_id = p_user_id
    AND psr.swap_status = 'pending_target'
    AND psr.expires_at > now()
    ORDER BY psr.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get swap requests requiring confirmation (as requester)
CREATE FUNCTION get_swap_requests_awaiting_confirmation(p_user_id UUID)
RETURNS TABLE (
    request_id UUID,
    circle_id UUID,
    circle_name TEXT,
    target_id UUID,
    target_name TEXT,
    your_position INTEGER,
    target_position INTEGER,
    cooling_off_ends_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        psr.id,
        psr.circle_id,
        c.name,
        psr.target_user_id,
        p.full_name,
        psr.requester_position,
        psr.target_position,
        psr.cooling_off_ends_at,
        psr.expires_at
    FROM position_swap_requests psr
    JOIN circles c ON c.id = psr.circle_id
    JOIN profiles p ON p.id = psr.target_user_id
    WHERE psr.requester_user_id = p_user_id
    AND psr.swap_status = 'pending_confirmation'
    AND psr.expires_at > now()
    ORDER BY psr.target_accepted_at DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get swap requests pending Elder approval
CREATE FUNCTION get_swap_requests_pending_elder_approval(p_circle_id UUID)
RETURNS TABLE (
    request_id UUID,
    requester_id UUID,
    requester_name TEXT,
    requester_position INTEGER,
    requester_xn_score INTEGER,
    target_id UUID,
    target_name TEXT,
    target_position INTEGER,
    target_xn_score INTEGER,
    request_reason TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        psr.id,
        psr.requester_user_id,
        rp.full_name,
        psr.requester_position,
        psr.requester_xn_score,
        psr.target_user_id,
        tp.full_name,
        psr.target_position,
        psr.target_xn_score,
        psr.request_reason,
        psr.created_at
    FROM position_swap_requests psr
    JOIN profiles rp ON rp.id = psr.requester_user_id
    JOIN profiles tp ON tp.id = psr.target_user_id
    WHERE psr.circle_id = p_circle_id
    AND psr.swap_status = 'pending_elder_approval'
    ORDER BY psr.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE VIEW v_swap_requests_full AS
SELECT
    psr.*,
    c.name as circle_name,
    rp.full_name as requester_name,
    tp.full_name as target_name,
    ep.full_name as elder_name,
    CASE WHEN psr.expires_at > now() THEN psr.expires_at - now() ELSE NULL END as time_remaining,
    CASE
        WHEN psr.swap_status = 'pending_confirmation' AND psr.cooling_off_ends_at > now()
        THEN psr.cooling_off_ends_at - now()
        ELSE NULL
    END as cooling_off_remaining
FROM position_swap_requests psr
JOIN circles c ON c.id = psr.circle_id
JOIN profiles rp ON rp.id = psr.requester_user_id
JOIN profiles tp ON tp.id = psr.target_user_id
LEFT JOIN profiles ep ON ep.id = psr.elder_approved_by;

CREATE VIEW v_swap_history_summary AS
SELECT
    msh.*,
    c.name as circle_name,
    p.full_name as partner_name,
    CASE
        WHEN msh.old_position < msh.new_position THEN 'gave_up_earlier'
        ELSE 'received_earlier'
    END as swap_direction
FROM member_swap_history msh
JOIN circles c ON c.id = msh.circle_id
JOIN profiles p ON p.id = msh.swap_partner_id;

CREATE VIEW v_circle_swap_statistics AS
SELECT
    circle_id,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE swap_status = 'completed') as completed_swaps,
    COUNT(*) FILTER (WHERE swap_status = 'rejected') as rejected_swaps,
    COUNT(*) FILTER (WHERE swap_status = 'cancelled') as cancelled_swaps,
    COUNT(*) FILTER (WHERE swap_status = 'expired') as expired_swaps,
    AVG(EXTRACT(EPOCH FROM (executed_at - created_at))/3600) FILTER (WHERE swap_status = 'completed') as avg_completion_hours
FROM position_swap_requests
GROUP BY circle_id;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY                                                          │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER TABLE position_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_swap_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_swap_history ENABLE ROW LEVEL SECURITY;

-- Swap requests: Members can view requests in their circles
CREATE POLICY "swap_requests_member_view" ON position_swap_requests FOR SELECT
USING (
    circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
);

-- Swap requests: Users can create requests where they are the requester
CREATE POLICY "swap_requests_create" ON position_swap_requests FOR INSERT
WITH CHECK (requester_user_id = auth.uid());

-- Swap requests: Participants and elders can update
CREATE POLICY "swap_requests_update" ON position_swap_requests FOR UPDATE
USING (
    requester_user_id = auth.uid()
    OR target_user_id = auth.uid()
    OR circle_id IN (
        SELECT circle_id FROM circle_members
        WHERE user_id = auth.uid() AND role IN ('elder', 'admin', 'creator')
    )
);

-- Swap events: Members can view events for swaps in their circles
CREATE POLICY "swap_events_view" ON position_swap_events FOR SELECT
USING (
    swap_request_id IN (
        SELECT id FROM position_swap_requests
        WHERE circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid())
    )
);

-- Swap events: System/functions can insert (via SECURITY DEFINER)
CREATE POLICY "swap_events_insert" ON position_swap_events FOR INSERT
WITH CHECK (true);

-- Swap history: Users can view their own history
CREATE POLICY "swap_history_own_view" ON member_swap_history FOR SELECT
USING (user_id = auth.uid());

-- Swap history: Elders can view history in their circles
CREATE POLICY "swap_history_elder_view" ON member_swap_history FOR SELECT
USING (
    circle_id IN (
        SELECT circle_id FROM circle_members
        WHERE user_id = auth.uid() AND role IN ('elder', 'admin', 'creator')
    )
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE FUNCTION update_swap_timestamp() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_swap_requests_updated
    BEFORE UPDATE ON position_swap_requests
    FOR EACH ROW EXECUTE FUNCTION update_swap_timestamp();

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ REALTIME SUBSCRIPTIONS                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE position_swap_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE position_swap_events;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 018 v2
-- ══════════════════════════════════════════════════════════════════════════════
