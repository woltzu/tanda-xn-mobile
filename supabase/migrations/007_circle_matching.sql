-- ============================================================================
-- 007_circle_matching.sql
-- User Connections and Circle Matching Support
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER CONNECTIONS TABLE
-- Stores social connections for the A/B/C/D trust rule
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connected_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Connection type for trust scoring
    -- family, close_friend = Type A (highest trust)
    -- friend, colleague = Type B (high trust)
    -- acquaintance = Type C (moderate trust, though usually inferred from B's connections)
    connection_type VARCHAR(50) NOT NULL CHECK (connection_type IN ('family', 'close_friend', 'friend', 'colleague', 'acquaintance')),

    -- Optional relationship details
    relationship_label VARCHAR(100), -- e.g., "Brother", "Work colleague at Google"

    -- Connection status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'blocked')),

    -- How the connection was made
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'phone_contacts', 'facebook', 'circle_history', 'referral')),

    -- Trust metrics
    circles_together INTEGER DEFAULT 0, -- Number of circles completed together
    successful_circles INTEGER DEFAULT 0, -- Circles completed without issues
    trust_score DECIMAL(5,2) DEFAULT 50.00 CHECK (trust_score >= 0 AND trust_score <= 100),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate connections
    CONSTRAINT unique_user_connection UNIQUE (user_id, connected_user_id),
    -- Prevent self-connection
    CONSTRAINT no_self_connection CHECK (user_id != connected_user_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_connections_user ON user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_connected ON user_connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_user_connections_type ON user_connections(connection_type);
CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status);

-- ============================================================================
-- USER PREFERENCES TABLE
-- Stores user preferences for circle matching
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_circle_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Amount preferences
    preferred_amount_min DECIMAL(12,2),
    preferred_amount_max DECIMAL(12,2),

    -- Frequency preferences (stored as array)
    preferred_frequencies TEXT[] DEFAULT ARRAY['monthly'],

    -- Circle type preferences
    preferred_types TEXT[] DEFAULT ARRAY['traditional'],

    -- Duration preferences (in weeks)
    preferred_duration_min INTEGER,
    preferred_duration_max INTEGER,

    -- Community preferences
    preferred_community_ids UUID[],

    -- Avoidance list (users to not be matched with)
    avoid_user_ids UUID[],

    -- Notification preferences for matching
    notify_new_matches BOOLEAN DEFAULT TRUE,
    notify_friend_joins BOOLEAN DEFAULT TRUE,
    notify_community_circles BOOLEAN DEFAULT TRUE,

    -- Auto-match settings
    auto_match_enabled BOOLEAN DEFAULT FALSE,
    auto_match_min_score INTEGER DEFAULT 80,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_preferences UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_circle_preferences_user ON user_circle_preferences(user_id);

-- ============================================================================
-- CIRCLE MATCH HISTORY TABLE
-- Track recommendation interactions for ML improvement
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_match_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

    -- Match details at time of recommendation
    match_score INTEGER NOT NULL,
    affordability_score INTEGER,
    trust_score INTEGER,
    compatibility_score INTEGER,

    -- User action
    action VARCHAR(50) NOT NULL CHECK (action IN ('viewed', 'dismissed', 'saved', 'applied', 'joined', 'rejected')),
    action_reason TEXT,

    -- Outcome (if joined)
    completed_successfully BOOLEAN,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_match_history_user ON circle_match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_match_history_circle ON circle_match_history(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_match_history_action ON circle_match_history(action);

-- ============================================================================
-- CIRCLE INVITATIONS FROM CONNECTIONS
-- Track when connections invite each other to circles
-- ============================================================================

CREATE TABLE IF NOT EXISTS circle_connection_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL REFERENCES auth.users(id),
    invitee_user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Invitation details
    connection_type VARCHAR(50), -- The connection type at time of invite
    personal_message TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

    -- Response
    responded_at TIMESTAMPTZ,
    decline_reason TEXT,

    -- Metadata
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_circle_invite UNIQUE (circle_id, inviter_user_id, invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_invites_invitee ON circle_connection_invites(invitee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_circle_invites_circle ON circle_connection_invites(circle_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get user's connection type with another user
CREATE OR REPLACE FUNCTION get_connection_type(p_user_id UUID, p_other_user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_connection_type VARCHAR(50);
BEGIN
    -- Direct connection
    SELECT connection_type INTO v_connection_type
    FROM user_connections
    WHERE user_id = p_user_id
      AND connected_user_id = p_other_user_id
      AND status = 'active';

    IF v_connection_type IS NOT NULL THEN
        RETURN v_connection_type;
    END IF;

    -- Check if friend of friend (Type C)
    IF EXISTS (
        SELECT 1 FROM user_connections uc1
        JOIN user_connections uc2 ON uc1.connected_user_id = uc2.user_id
        WHERE uc1.user_id = p_user_id
          AND uc2.connected_user_id = p_other_user_id
          AND uc1.status = 'active'
          AND uc2.status = 'active'
          AND uc1.connection_type IN ('friend', 'colleague', 'family', 'close_friend')
    ) THEN
        RETURN 'acquaintance';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trust score between two users
CREATE OR REPLACE FUNCTION calculate_trust_score(p_user_id UUID, p_other_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_connection_type VARCHAR(50);
    v_circles_together INTEGER;
    v_successful_circles INTEGER;
    v_base_score INTEGER;
BEGIN
    -- Get connection info
    SELECT connection_type, circles_together, successful_circles
    INTO v_connection_type, v_circles_together, v_successful_circles
    FROM user_connections
    WHERE user_id = p_user_id AND connected_user_id = p_other_user_id AND status = 'active';

    IF v_connection_type IS NULL THEN
        -- Check for indirect connection
        v_connection_type := get_connection_type(p_user_id, p_other_user_id);
        v_circles_together := 0;
        v_successful_circles := 0;
    END IF;

    -- Base score by connection type
    v_base_score := CASE v_connection_type
        WHEN 'family' THEN 90
        WHEN 'close_friend' THEN 85
        WHEN 'friend' THEN 70
        WHEN 'colleague' THEN 65
        WHEN 'acquaintance' THEN 40
        ELSE 20
    END;

    -- Bonus for successful circles together
    IF v_circles_together > 0 THEN
        v_base_score := v_base_score + LEAST(20, v_successful_circles * 5);
    END IF;

    RETURN LEAST(100, v_base_score);
END;
$$ LANGUAGE plpgsql;

-- Function to update connection stats after circle completion
CREATE OR REPLACE FUNCTION update_connection_after_circle()
RETURNS TRIGGER AS $$
BEGIN
    -- When a circle is completed, update connection stats for all member pairs
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Update circles_together for all member pairs
        UPDATE user_connections uc
        SET
            circles_together = circles_together + 1,
            successful_circles = CASE
                WHEN (SELECT COUNT(*) FROM defaults WHERE circle_id = NEW.id AND status = 'unresolved') = 0
                THEN successful_circles + 1
                ELSE successful_circles
            END,
            updated_at = NOW()
        WHERE EXISTS (
            SELECT 1 FROM circle_members cm1
            JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
            WHERE cm1.circle_id = NEW.id
              AND cm1.user_id = uc.user_id
              AND cm2.user_id = uc.connected_user_id
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update connections when circle completes
DROP TRIGGER IF EXISTS trigger_update_connection_after_circle ON circles;
CREATE TRIGGER trigger_update_connection_after_circle
    AFTER UPDATE ON circles
    FOR EACH ROW
    EXECUTE FUNCTION update_connection_after_circle();

-- Function to auto-create connection when users complete a circle together
CREATE OR REPLACE FUNCTION auto_create_connection_from_circle()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Create connections between all members who don't already have one
        INSERT INTO user_connections (user_id, connected_user_id, connection_type, source, circles_together, successful_circles)
        SELECT cm1.user_id, cm2.user_id, 'acquaintance', 'circle_history', 1,
            CASE WHEN (SELECT COUNT(*) FROM defaults WHERE circle_id = NEW.id AND status = 'unresolved') = 0 THEN 1 ELSE 0 END
        FROM circle_members cm1
        JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
        WHERE cm1.circle_id = NEW.id
          AND cm1.user_id != cm2.user_id
          AND cm1.status = 'completed'
          AND cm2.status = 'completed'
        ON CONFLICT (user_id, connected_user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_connection ON circles;
CREATE TRIGGER trigger_auto_create_connection
    AFTER UPDATE ON circles
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_connection_from_circle();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_circle_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_connection_invites ENABLE ROW LEVEL SECURITY;

-- User connections policies
CREATE POLICY "Users can view own connections" ON user_connections
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = connected_user_id);

CREATE POLICY "Users can create own connections" ON user_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON user_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" ON user_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Preferences policies
CREATE POLICY "Users can view own preferences" ON user_circle_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" ON user_circle_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Match history policies
CREATE POLICY "Users can view own match history" ON circle_match_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own match history" ON circle_match_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Circle invites policies
CREATE POLICY "Users can view invites they sent or received" ON circle_connection_invites
    FOR SELECT USING (auth.uid() = inviter_user_id OR auth.uid() = invitee_user_id);

CREATE POLICY "Users can create invites" ON circle_connection_invites
    FOR INSERT WITH CHECK (auth.uid() = inviter_user_id);

CREATE POLICY "Invitees can update invite status" ON circle_connection_invites
    FOR UPDATE USING (auth.uid() = invitee_user_id);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_connections_timestamp ON user_connections;
CREATE TRIGGER trigger_update_user_connections_timestamp
    BEFORE UPDATE ON user_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_update_user_preferences_timestamp ON user_circle_preferences;
CREATE TRIGGER trigger_update_user_preferences_timestamp
    BEFORE UPDATE ON user_circle_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_connection_type(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_trust_score(UUID, UUID) TO authenticated;
