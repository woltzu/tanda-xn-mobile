-- Migration: 010_payout_order_system.sql
-- Description: Hybrid Payout Order Determination System
-- The algorithm that decides who gets paid when - the heart of TandaXn
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- POSITION PREFERENCES (Member Bids)
-- Members express their preference for payout positions
-- =====================================================
CREATE TABLE IF NOT EXISTS position_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Preference type
    preference_type TEXT NOT NULL CHECK (preference_type IN (
        'need_early',      -- "I NEED an early position" (1-3)
        'prefer_early',    -- "I PREFER early but am flexible" (1-5)
        'flexible',        -- "I'm FLEXIBLE - assign me anywhere"
        'prefer_late'      -- "I PREFER a later position"
    )),

    -- Additional commitments for 'need_early'
    auto_pay_agreed BOOLEAN DEFAULT false,
    position_lock_agreed BOOLEAN DEFAULT false,

    -- Optional context
    reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, circle_id)
);

-- =====================================================
-- NEED DECLARATIONS
-- Members declare why they need the money
-- =====================================================
CREATE TABLE IF NOT EXISTS need_declarations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Need category
    category TEXT NOT NULL CHECK (category IN (
        'emergency',       -- Medical emergency, urgent crisis
        'medical',         -- Medical expenses (non-emergency)
        'education',       -- Education costs
        'school_fees',     -- School fees with deadline
        'housing',         -- Housing deposit, rent
        'legal',           -- Legal/immigration deadline
        'wedding',         -- Wedding/ceremony
        'ceremony',        -- Other ceremony (funeral, naming, etc.)
        'business',        -- Business investment
        'investment',      -- Other investment
        'travel',          -- Travel (with booked dates)
        'major_purchase',  -- Major purchase (car, appliance)
        'general'          -- General savings, no specific goal
    )),

    -- Details
    description TEXT,
    target_date DATE,                    -- When do they need the money by
    target_amount DECIMAL(15, 2),        -- How much do they need

    -- Urgency indicators
    has_deadline BOOLEAN DEFAULT false,
    deadline_date DATE,
    urgency_score INTEGER DEFAULT 0,     -- Calculated urgency 0-100

    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES profiles(id),
    verification_documents TEXT[],       -- URLs to uploaded docs
    verification_notes TEXT,
    verified_at TIMESTAMPTZ,

    -- Claim limits
    is_urgent_claim BOOLEAN DEFAULT false,  -- Can only claim "urgent" once per 12 months

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, circle_id)
);

-- =====================================================
-- FAIRNESS CREDITS
-- Accumulated from being flexible in past circles
-- =====================================================
CREATE TABLE IF NOT EXISTS fairness_credits (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL DEFAULT 0,

    -- History tracking
    credits_earned_total INTEGER DEFAULT 0,
    credits_spent_total INTEGER DEFAULT 0,

    -- Last flexibility bonus
    last_flexible_circle_id UUID REFERENCES circles(id),
    last_flexible_date TIMESTAMPTZ,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PAYOUT ORDERS (Final Determined Order)
-- The actual order for a circle
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- The order itself (JSONB array)
    -- [{position: 1, userId: uuid, scores: {...}, compositeScore: 85, assignedReason: '...'}]
    order_data JSONB NOT NULL,

    -- Algorithm metadata
    algorithm_version TEXT NOT NULL DEFAULT 'hybrid_v1',
    weights JSONB DEFAULT '{"preference": 0.25, "need": 0.30, "risk": 0.30, "fairness": 0.15}',

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'draft',      -- Being calculated
        'active',     -- Current active order
        'modified',   -- Has been modified (swaps)
        'archived',   -- Old order (circle completed)
        'recalculated' -- Was recalculated (member change)
    )),

    -- Modification tracking
    modifications JSONB DEFAULT '[]',
    -- [{type: 'swap', user1: uuid, user2: uuid, timestamp: ...}]

    modification_count INTEGER DEFAULT 0,

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,              -- When order became immutable
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id)
);

-- =====================================================
-- PAYOUT ORDER AUDIT LOG
-- Full calculation details for audit/dispute resolution
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_order_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    payout_order_id UUID NOT NULL REFERENCES payout_orders(id) ON DELETE CASCADE,

    -- Full calculation details
    member_profiles JSONB NOT NULL,
    -- [{userId, xnScore, preference, need, scores: {preference, need, risk, fairness}}]

    -- Algorithm inputs
    algorithm_inputs JSONB,
    -- {circleConfig, weights, constraints, etc.}

    -- Calculation steps (for debugging)
    calculation_steps JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- POSITION SWAP REQUESTS
-- When members want to swap positions
-- =====================================================
CREATE TABLE IF NOT EXISTS position_swap_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Requester
    requester_id UUID NOT NULL REFERENCES profiles(id),
    requester_current_position INTEGER NOT NULL,

    -- Target
    target_user_id UUID NOT NULL REFERENCES profiles(id),
    target_current_position INTEGER NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',    -- Awaiting response
        'accepted',   -- Target accepted
        'declined',   -- Target declined
        'completed',  -- Swap executed
        'expired',    -- Request expired
        'cancelled'   -- Requester cancelled
    )),

    -- Messaging
    requester_message TEXT,
    response_message TEXT,

    -- Timing
    expires_at TIMESTAMPTZ NOT NULL,
    responded_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- POSITION CONSTRAINTS
-- Hard constraints on position assignments
-- =====================================================
CREATE TABLE IF NOT EXISTS position_constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Constraints
    min_position INTEGER DEFAULT 1,
    max_position INTEGER,
    locked_position INTEGER,            -- If set, must be exactly this position
    must_be_locked BOOLEAN DEFAULT false,

    -- Reason for constraints
    constraint_reasons JSONB DEFAULT '[]',
    -- ['new_member', 'high_risk', 'low_xnscore', 'verified_emergency']

    -- Risk level that generated constraints
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
    risk_score INTEGER,

    calculated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, circle_id)
);

-- =====================================================
-- MEMBER POSITION HISTORY
-- Track positions across circles for fairness
-- =====================================================
CREATE TABLE IF NOT EXISTS member_position_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    position INTEGER NOT NULL,
    total_positions INTEGER NOT NULL,
    position_percentile DECIMAL(5, 4),   -- e.g., 0.75 = 75th percentile (later)

    -- Preference that was expressed
    preference_type TEXT,

    -- What they actually got vs wanted
    got_preferred_position BOOLEAN,

    -- Circle outcome
    circle_completed BOOLEAN DEFAULT false,
    payout_received BOOLEAN DEFAULT false,
    payout_date DATE,
    payout_amount DECIMAL(15, 2),

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, circle_id)
);

-- =====================================================
-- URGENT NEED CLAIMS TRACKING
-- Limit urgent claims to once per 12 months
-- =====================================================
CREATE TABLE IF NOT EXISTS urgent_need_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    need_declaration_id UUID REFERENCES need_declarations(id),

    category TEXT NOT NULL,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Next eligible date
    next_eligible_date DATE NOT NULL,

    -- Was the claim verified?
    verified BOOLEAN DEFAULT false
);

-- =====================================================
-- ALGORITHM WEIGHTS CONFIGURATION
-- Configurable per circle or platform-wide
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_algorithm_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Scope (NULL = platform default)
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

    -- Weights (must sum to 1.0)
    preference_weight DECIMAL(4, 3) DEFAULT 0.25,
    need_weight DECIMAL(4, 3) DEFAULT 0.30,
    risk_weight DECIMAL(4, 3) DEFAULT 0.30,
    fairness_weight DECIMAL(4, 3) DEFAULT 0.15,

    -- Constraint thresholds
    new_member_max_percentile DECIMAL(4, 3) DEFAULT 0.25,   -- Top 25% blocked
    high_risk_max_percentile DECIMAL(4, 3) DEFAULT 0.30,    -- Top 30% blocked
    very_high_risk_max_percentile DECIMAL(4, 3) DEFAULT 0.50, -- Top 50% blocked
    low_xnscore_max_percentile DECIMAL(4, 3) DEFAULT 0.40,  -- Top 40% blocked

    -- XnScore thresholds
    min_xnscore_for_early DECIMAL(5, 2) DEFAULT 60,
    min_xnscore_for_position_1 DECIMAL(5, 2) DEFAULT 70,

    -- New member definition
    new_member_months INTEGER DEFAULT 3,
    new_member_min_circles INTEGER DEFAULT 1,

    -- Fairness credit values
    flexibility_credit_bonus INTEGER DEFAULT 5,
    prefer_late_credit_bonus INTEGER DEFAULT 7,
    early_position_credit_cost INTEGER DEFAULT 10,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Only one active config per scope
    UNIQUE(circle_id),
    UNIQUE(community_id)
);

-- Insert platform default config
INSERT INTO payout_algorithm_config (
    preference_weight, need_weight, risk_weight, fairness_weight
) VALUES (0.25, 0.30, 0.30, 0.15)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_position_preferences_circle ON position_preferences(circle_id);
CREATE INDEX IF NOT EXISTS idx_position_preferences_user ON position_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_need_declarations_circle ON need_declarations(circle_id);
CREATE INDEX IF NOT EXISTS idx_need_declarations_user ON need_declarations(user_id);
CREATE INDEX IF NOT EXISTS idx_need_declarations_category ON need_declarations(category);
CREATE INDEX IF NOT EXISTS idx_need_declarations_verified ON need_declarations(verified);

CREATE INDEX IF NOT EXISTS idx_payout_orders_circle ON payout_orders(circle_id);
CREATE INDEX IF NOT EXISTS idx_payout_orders_status ON payout_orders(status);

CREATE INDEX IF NOT EXISTS idx_swap_requests_circle ON position_swap_requests(circle_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_requester ON position_swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_target ON position_swap_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_swap_requests_status ON position_swap_requests(status);
CREATE INDEX IF NOT EXISTS idx_swap_requests_expires ON position_swap_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_position_history_user ON member_position_history(user_id);
CREATE INDEX IF NOT EXISTS idx_position_history_circle ON member_position_history(circle_id);

CREATE INDEX IF NOT EXISTS idx_urgent_claims_user ON urgent_need_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_urgent_claims_next_eligible ON urgent_need_claims(next_eligible_date);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE position_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE need_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_order_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_position_history ENABLE ROW LEVEL SECURITY;

-- Position Preferences - users can manage their own
DROP POLICY IF EXISTS "Users can manage own position preferences" ON position_preferences;
CREATE POLICY "Users can manage own position preferences" ON position_preferences
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Circle members can view preferences" ON position_preferences;
CREATE POLICY "Circle members can view preferences" ON position_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = position_preferences.circle_id
            AND user_id = auth.uid()
        )
    );

-- Need Declarations - own management, limited view for others
DROP POLICY IF EXISTS "Users can manage own need declarations" ON need_declarations;
CREATE POLICY "Users can manage own need declarations" ON need_declarations
    FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Circle admins can view need declarations" ON need_declarations;
CREATE POLICY "Circle admins can view need declarations" ON need_declarations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = need_declarations.circle_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'organizer')
        )
    );

-- Fairness Credits - users see own only
DROP POLICY IF EXISTS "Users can view own fairness credits" ON fairness_credits;
CREATE POLICY "Users can view own fairness credits" ON fairness_credits
    FOR SELECT USING (user_id = auth.uid());

-- Payout Orders - circle members can view
DROP POLICY IF EXISTS "Circle members can view payout order" ON payout_orders;
CREATE POLICY "Circle members can view payout order" ON payout_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = payout_orders.circle_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Circle admins can manage payout orders" ON payout_orders;
CREATE POLICY "Circle admins can manage payout orders" ON payout_orders
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = payout_orders.circle_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'organizer')
        )
    );

-- Swap Requests - involved parties only
DROP POLICY IF EXISTS "Swap request parties can view" ON position_swap_requests;
CREATE POLICY "Swap request parties can view" ON position_swap_requests
    FOR SELECT USING (
        requester_id = auth.uid() OR target_user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Requester can create swap requests" ON position_swap_requests;
CREATE POLICY "Requester can create swap requests" ON position_swap_requests
    FOR INSERT WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Parties can update swap requests" ON position_swap_requests;
CREATE POLICY "Parties can update swap requests" ON position_swap_requests
    FOR UPDATE USING (
        requester_id = auth.uid() OR target_user_id = auth.uid()
    );

-- Position History - users see own
DROP POLICY IF EXISTS "Users can view own position history" ON member_position_history;
CREATE POLICY "Users can view own position history" ON member_position_history
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to check if user can claim urgent need
CREATE OR REPLACE FUNCTION can_claim_urgent_need(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_claim_date DATE;
BEGIN
    SELECT MAX(next_eligible_date) INTO last_claim_date
    FROM urgent_need_claims
    WHERE user_id = p_user_id AND verified = true;

    IF last_claim_date IS NULL THEN
        RETURN true;
    END IF;

    RETURN CURRENT_DATE >= last_claim_date;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate position percentile
CREATE OR REPLACE FUNCTION calculate_position_percentile(
    p_position INTEGER,
    p_total_positions INTEGER
)
RETURNS DECIMAL(5, 4) AS $$
BEGIN
    IF p_total_positions = 0 THEN
        RETURN 0.50;
    END IF;
    RETURN p_position::DECIMAL / p_total_positions::DECIMAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update position history when payout order is created
CREATE OR REPLACE FUNCTION update_position_history()
RETURNS TRIGGER AS $$
DECLARE
    order_entry JSONB;
    member_id UUID;
    pos INTEGER;
    total_pos INTEGER;
BEGIN
    -- Get total positions from order data
    total_pos := jsonb_array_length(NEW.order_data);

    -- Iterate through order entries
    FOR order_entry IN SELECT * FROM jsonb_array_elements(NEW.order_data)
    LOOP
        member_id := (order_entry->>'userId')::UUID;
        pos := (order_entry->>'position')::INTEGER;

        -- Insert or update position history
        INSERT INTO member_position_history (
            user_id, circle_id, position, total_positions, position_percentile
        ) VALUES (
            member_id,
            NEW.circle_id,
            pos,
            total_pos,
            calculate_position_percentile(pos, total_pos)
        )
        ON CONFLICT (user_id, circle_id) DO UPDATE SET
            position = EXCLUDED.position,
            total_positions = EXCLUDED.total_positions,
            position_percentile = EXCLUDED.position_percentile;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_position_history ON payout_orders;
CREATE TRIGGER trigger_update_position_history
    AFTER INSERT OR UPDATE ON payout_orders
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION update_position_history();

-- Function to expire old swap requests
CREATE OR REPLACE FUNCTION expire_old_swap_requests()
RETURNS void AS $$
BEGIN
    UPDATE position_swap_requests
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_payout_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_position_preferences_updated_at ON position_preferences;
CREATE TRIGGER trigger_position_preferences_updated_at
    BEFORE UPDATE ON position_preferences
    FOR EACH ROW EXECUTE FUNCTION update_payout_order_updated_at();

DROP TRIGGER IF EXISTS trigger_need_declarations_updated_at ON need_declarations;
CREATE TRIGGER trigger_need_declarations_updated_at
    BEFORE UPDATE ON need_declarations
    FOR EACH ROW EXECUTE FUNCTION update_payout_order_updated_at();

DROP TRIGGER IF EXISTS trigger_payout_orders_updated_at ON payout_orders;
CREATE TRIGGER trigger_payout_orders_updated_at
    BEFORE UPDATE ON payout_orders
    FOR EACH ROW EXECUTE FUNCTION update_payout_order_updated_at();

DROP TRIGGER IF EXISTS trigger_swap_requests_updated_at ON position_swap_requests;
CREATE TRIGGER trigger_swap_requests_updated_at
    BEFORE UPDATE ON position_swap_requests
    FOR EACH ROW EXECUTE FUNCTION update_payout_order_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON position_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON need_declarations TO authenticated;
GRANT SELECT, UPDATE ON fairness_credits TO authenticated;
GRANT SELECT ON payout_orders TO authenticated;
GRANT SELECT ON payout_order_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON position_swap_requests TO authenticated;
GRANT SELECT ON position_constraints TO authenticated;
GRANT SELECT ON member_position_history TO authenticated;
GRANT SELECT ON payout_algorithm_config TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE position_preferences IS 'Member preferences for payout positions (bidding)';
COMMENT ON TABLE need_declarations IS 'Member declarations of why they need the money';
COMMENT ON TABLE fairness_credits IS 'Accumulated flexibility credits for fair position assignment';
COMMENT ON TABLE payout_orders IS 'Final calculated payout order for each circle';
COMMENT ON TABLE payout_order_audit_log IS 'Full calculation audit trail for disputes';
COMMENT ON TABLE position_swap_requests IS 'Requests to swap positions between members';
COMMENT ON TABLE position_constraints IS 'Hard constraints on position assignments per member';
COMMENT ON TABLE member_position_history IS 'Historical record of positions for fairness tracking';
COMMENT ON TABLE payout_algorithm_config IS 'Configurable weights and thresholds for the algorithm';
