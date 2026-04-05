-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 056: Community Features — Arrivals, Gatherings, Memory, Posts,
--                Dream Feed, Near You, Community Messages
-- ══════════════════════════════════════════════════════════════════════════════
-- Implements the full community specification:
--   Screen 1: Community Hub (aggregates all sections)
--   Screen 2: New Arrivals (welcome new members)
--   Screen 3: Gatherings (community events)
--   Screen 4: Create Gathering (event creation)
--   Screen 5: Elders Council (already exists — elder system)
--   Screen 6: Near You (neighborhood discovery)
--   Screen 7: Community Memory (archive)
--   Screen 8: Post to Community (member content)
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  A. COMMUNITY ARRIVALS                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
-- New member arrival cards. Auto-generated when a member completes KYC
-- and has account age < 30 days. Filterable by community pill.

CREATE TABLE IF NOT EXISTS community_arrivals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Display info (denormalized for fast reads)
    first_name TEXT NOT NULL,
    origin_city TEXT,                                -- city in home country
    origin_country TEXT,                             -- e.g. "Côte d'Ivoire"
    origin_country_flag TEXT,                        -- e.g. "🇨🇮"
    current_neighborhood TEXT,                       -- neighborhood in current city (manual, not GPS)
    current_city TEXT,                               -- e.g. "Atlanta"

    -- Status
    is_visible BOOLEAN NOT NULL DEFAULT true,        -- member can toggle off
    welcomed_count INTEGER NOT NULL DEFAULT 0,       -- how many people welcomed them
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, community_id)
);

COMMENT ON TABLE community_arrivals IS 'New member arrival cards shown for first 30 days after KYC completion';

-- Welcome messages sent to arrivals
CREATE TABLE IF NOT EXISTS community_welcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    arrival_id UUID NOT NULL REFERENCES community_arrivals(id) ON DELETE CASCADE,
    welcomer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_visible_in_feed BOOLEAN NOT NULL DEFAULT false,  -- both parties consent to show in feed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(arrival_id, welcomer_user_id)  -- one welcome per person per arrival
);

COMMENT ON TABLE community_welcomes IS 'Welcome messages sent to new arrivals';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  B. GATHERINGS (EVENTS)                                                │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS community_gatherings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    organizer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event details
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN ('community', 'circle', 'elder_session', 'service')),
    location_name TEXT,                              -- e.g. "Georgia Tech Campus"
    location_address TEXT,
    location_lat NUMERIC(10, 7),
    location_lng NUMERIC(10, 7),
    is_virtual BOOLEAN NOT NULL DEFAULT false,
    virtual_link TEXT,

    -- Timing
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'America/New_York',

    -- Audience
    circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,  -- for circle gatherings only
    is_family_welcome BOOLEAN NOT NULL DEFAULT false,
    max_attendees INTEGER,                           -- null = unlimited

    -- Status
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'in_progress', 'completed', 'cancelled')),
    rsvp_count INTEGER NOT NULL DEFAULT 0,

    -- Post-event
    recap_text TEXT,                                 -- organizer writes after event
    recap_photo_url TEXT,
    add_to_memory BOOLEAN NOT NULL DEFAULT false,    -- organizer opts in

    -- Organizer display (denormalized)
    organizer_first_name TEXT NOT NULL,
    organizer_origin TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_gatherings IS 'Community events — meetups, circle gatherings, elder sessions, service events';

CREATE TABLE IF NOT EXISTS gathering_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gathering_id UUID NOT NULL REFERENCES community_gatherings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
    -- For social proof: show faces of people from your circles
    user_first_name TEXT NOT NULL,
    user_avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(gathering_id, user_id)
);

COMMENT ON TABLE gathering_rsvps IS 'RSVP records for community gatherings with social proof data';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  C. COMMUNITY POSTS (FEED CONTENT)                                     │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Content
    post_type TEXT NOT NULL CHECK (post_type IN ('milestone', 'question', 'welcome', 'service_announcement')),
    title TEXT,
    body TEXT NOT NULL,
    photo_url TEXT,

    -- Author display (denormalized)
    author_first_name TEXT NOT NULL,
    author_origin TEXT,
    author_avatar_url TEXT,

    -- Engagement
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,

    -- Moderation
    is_approved BOOLEAN NOT NULL DEFAULT true,       -- auto-approved, flagged if reported
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    flagged_reason TEXT,

    -- Linked content (optional)
    linked_circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
    linked_goal_id UUID,                             -- FK to savings goals if exists
    linked_payout_id UUID,                           -- FK to payouts if exists

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_posts IS 'Member-generated content: milestones, questions, welcomes, service announcements';

-- Post comments
CREATE TABLE IF NOT EXISTS community_post_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    author_first_name TEXT NOT NULL,
    author_avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post likes
CREATE TABLE IF NOT EXISTS community_post_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(post_id, user_id)
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  D. COMMUNITY MEMORY (ARCHIVE)                                         │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS community_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Memory content
    memory_type TEXT NOT NULL CHECK (memory_type IN (
        'circle_completion', 'elder_elevation', 'milestone_story',
        'gathering_recap', 'provider_milestone', 'member_count',
        'community_founding', 'payout_milestone', 'custom'
    )),
    title TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,

    -- Attribution
    attributed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    attributed_name TEXT,

    -- Linked content
    linked_gathering_id UUID REFERENCES community_gatherings(id) ON DELETE SET NULL,
    linked_post_id UUID REFERENCES community_posts(id) ON DELETE SET NULL,
    linked_circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,

    -- Moderation (Elder or TandaXn approves within 48h)
    is_approved BOOLEAN NOT NULL DEFAULT false,      -- system events auto-approved
    is_system_generated BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,

    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_memory IS 'Permanent archive of community moments — the community newspaper';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  E. DREAM FEED                                                         │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Single rotating card on Home screen. One dream per day per community.

CREATE TABLE IF NOT EXISTS dream_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Dream content
    goal_title TEXT NOT NULL,                        -- "A home in Abidjan for my family"
    goal_description TEXT,
    goal_illustration_url TEXT,                      -- photo or illustration
    progress_pct NUMERIC(5, 2) DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    progress_phase TEXT DEFAULT 'Building toward it' CHECK (progress_phase IN (
        'Just started', 'Building toward it', 'Halfway there', 'Almost there', 'Achieved'
    )),

    -- Member display (denormalized)
    member_first_name TEXT NOT NULL,
    member_origin_city TEXT,

    -- Settings
    is_active BOOLEAN NOT NULL DEFAULT true,
    opted_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Linked savings goal (optional)
    linked_goal_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, community_id)
);

COMMENT ON TABLE dream_feed IS 'Member dreams/goals shared with community — single rotating card on Home';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  F. NEAR YOU — NEIGHBORHOOD DISCOVERY                                  │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Manual neighborhood, NOT GPS. Member sets this at signup.

CREATE TABLE IF NOT EXISTS near_you_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Location (manual, set by member)
    neighborhood TEXT NOT NULL,                      -- e.g. "Decatur"
    city TEXT NOT NULL,                              -- e.g. "Atlanta"
    state TEXT,                                      -- e.g. "GA"
    country TEXT NOT NULL DEFAULT 'US',

    -- For radius filtering (approximate center of neighborhood)
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7),

    -- Display info (denormalized)
    first_name TEXT NOT NULL,
    origin_city TEXT,
    origin_country TEXT,
    origin_country_flag TEXT,

    -- Shared context (computed at query time, but cached)
    shared_circles TEXT[],                           -- circle names in common
    shared_communities TEXT[],                       -- community names in common

    -- Privacy
    is_discoverable BOOLEAN NOT NULL DEFAULT true,   -- one toggle to turn off entirely
    preferred_radius_miles INTEGER NOT NULL DEFAULT 10 CHECK (preferred_radius_miles IN (5, 10, 25)),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE near_you_profiles IS 'Neighborhood-based discovery — manual location, not GPS tracking';

-- Connection requests from Near You
CREATE TABLE IF NOT EXISTS near_you_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'ignored', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(sender_user_id, recipient_user_id)
);

COMMENT ON TABLE near_you_connections IS 'Say hello connection requests from Near You discovery';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  G. COMMUNITY MESSAGES (DIRECT MESSAGES)                               │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS community_direct_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    -- For welcome messages and connection requests
    source_type TEXT CHECK (source_type IN ('welcome', 'near_you', 'direct')),
    source_id UUID,                                  -- FK to welcome or connection
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_direct_messages IS 'Private messages between members — from welcomes, Near You, or direct';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  H. SYSTEM-GENERATED FEED ITEMS                                        │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Auto-generated content for the community feed (circle completions, payouts, etc.)

CREATE TABLE IF NOT EXISTS community_feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    feed_type TEXT NOT NULL CHECK (feed_type IN (
        'circle_completion', 'payout_moment', 'elder_session',
        'new_arrivals_summary', 'milestone_story', 'question',
        'welcome', 'service_announcement', 'gathering_posted',
        'community_milestone'
    )),

    -- Content
    title TEXT NOT NULL,
    body TEXT,
    photo_url TEXT,
    icon_name TEXT,                                  -- Ionicons name for display
    accent_color TEXT DEFAULT '#00C6AE',

    -- Attribution
    attributed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    attributed_name TEXT,

    -- Linked content
    linked_post_id UUID REFERENCES community_posts(id) ON DELETE SET NULL,
    linked_gathering_id UUID REFERENCES community_gatherings(id) ON DELETE SET NULL,
    linked_circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}',                     -- flexible data per feed type
    is_system_generated BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE community_feed_items IS 'Aggregated feed items — both system-generated and member-created';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  I. INDEXES                                                            │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Arrivals
CREATE INDEX idx_arrivals_community ON community_arrivals(community_id);
CREATE INDEX idx_arrivals_user ON community_arrivals(user_id);
CREATE INDEX idx_arrivals_visible ON community_arrivals(community_id, is_visible, expires_at) WHERE is_visible = true;
CREATE INDEX idx_welcomes_arrival ON community_welcomes(arrival_id);
CREATE INDEX idx_welcomes_welcomer ON community_welcomes(welcomer_user_id);

-- Gatherings
CREATE INDEX idx_gatherings_community ON community_gatherings(community_id);
CREATE INDEX idx_gatherings_organizer ON community_gatherings(organizer_user_id);
CREATE INDEX idx_gatherings_upcoming ON community_gatherings(community_id, starts_at) WHERE status = 'upcoming';
CREATE INDEX idx_gatherings_type ON community_gatherings(event_type);
CREATE INDEX idx_gatherings_circle ON community_gatherings(circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX idx_rsvps_gathering ON gathering_rsvps(gathering_id);
CREATE INDEX idx_rsvps_user ON gathering_rsvps(user_id);

-- Posts
CREATE INDEX idx_posts_community ON community_posts(community_id);
CREATE INDEX idx_posts_author ON community_posts(author_user_id);
CREATE INDEX idx_posts_type ON community_posts(community_id, post_type);
CREATE INDEX idx_posts_approved ON community_posts(community_id, created_at DESC) WHERE is_approved = true AND is_flagged = false;
CREATE INDEX idx_post_comments_post ON community_post_comments(post_id);
CREATE INDEX idx_post_likes_post ON community_post_likes(post_id);
CREATE INDEX idx_post_likes_user ON community_post_likes(user_id);

-- Memory
CREATE INDEX idx_memory_community ON community_memory(community_id);
CREATE INDEX idx_memory_type ON community_memory(community_id, memory_type);
CREATE INDEX idx_memory_date ON community_memory(community_id, event_date DESC);
CREATE INDEX idx_memory_approved ON community_memory(community_id, event_date DESC) WHERE is_approved = true;

-- Dream Feed
CREATE INDEX idx_dream_community ON dream_feed(community_id) WHERE is_active = true;
CREATE INDEX idx_dream_user ON dream_feed(user_id);

-- Near You
CREATE INDEX idx_near_you_city ON near_you_profiles(city, state) WHERE is_discoverable = true;
CREATE INDEX idx_near_you_coords ON near_you_profiles(lat, lng) WHERE is_discoverable = true AND lat IS NOT NULL;
CREATE INDEX idx_near_you_user ON near_you_profiles(user_id);
CREATE INDEX idx_connections_sender ON near_you_connections(sender_user_id);
CREATE INDEX idx_connections_recipient ON near_you_connections(recipient_user_id);
CREATE INDEX idx_connections_pending ON near_you_connections(recipient_user_id) WHERE status = 'pending';

-- Direct Messages
CREATE INDEX idx_dm_sender ON community_direct_messages(sender_user_id, created_at DESC);
CREATE INDEX idx_dm_recipient ON community_direct_messages(recipient_user_id, created_at DESC);
CREATE INDEX idx_dm_unread ON community_direct_messages(recipient_user_id) WHERE is_read = false;
CREATE INDEX idx_dm_conversation ON community_direct_messages(
    LEAST(sender_user_id, recipient_user_id),
    GREATEST(sender_user_id, recipient_user_id),
    created_at DESC
);

-- Feed Items
CREATE INDEX idx_feed_community ON community_feed_items(community_id, created_at DESC);
CREATE INDEX idx_feed_type ON community_feed_items(community_id, feed_type);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  J. TRIGGERS                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Generic updated_at trigger (reuse if exists)
CREATE OR REPLACE FUNCTION update_community_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_arrivals_updated_at BEFORE UPDATE ON community_arrivals
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();
CREATE TRIGGER trg_gatherings_updated_at BEFORE UPDATE ON community_gatherings
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON community_posts
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();
CREATE TRIGGER trg_dream_feed_updated_at BEFORE UPDATE ON dream_feed
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();
CREATE TRIGGER trg_near_you_updated_at BEFORE UPDATE ON near_you_profiles
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();
CREATE TRIGGER trg_connections_updated_at BEFORE UPDATE ON near_you_connections
    FOR EACH ROW EXECUTE FUNCTION update_community_updated_at();

-- Auto-increment welcomed_count when a welcome is sent
CREATE OR REPLACE FUNCTION increment_welcome_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE community_arrivals
    SET welcomed_count = welcomed_count + 1
    WHERE id = NEW.arrival_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_welcome_count
    AFTER INSERT ON community_welcomes
    FOR EACH ROW EXECUTE FUNCTION increment_welcome_count();

-- Auto-increment RSVP count
CREATE OR REPLACE FUNCTION update_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'going' THEN
        UPDATE community_gatherings SET rsvp_count = rsvp_count + 1 WHERE id = NEW.gathering_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'going' THEN
        UPDATE community_gatherings SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = OLD.gathering_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'going' AND NEW.status != 'going' THEN
            UPDATE community_gatherings SET rsvp_count = GREATEST(rsvp_count - 1, 0) WHERE id = NEW.gathering_id;
        ELSIF OLD.status != 'going' AND NEW.status = 'going' THEN
            UPDATE community_gatherings SET rsvp_count = rsvp_count + 1 WHERE id = NEW.gathering_id;
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rsvp_count
    AFTER INSERT OR UPDATE OR DELETE ON gathering_rsvps
    FOR EACH ROW EXECUTE FUNCTION update_rsvp_count();

-- Auto-update post like/comment counts
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_likes_count
    AFTER INSERT OR DELETE ON community_post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_comments_count
    AFTER INSERT OR DELETE ON community_post_comments
    FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Auto-generate feed item when a post is created
CREATE OR REPLACE FUNCTION generate_post_feed_item()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO community_feed_items (
        community_id, feed_type, title, body, photo_url,
        attributed_user_id, attributed_name, linked_post_id,
        is_system_generated
    ) VALUES (
        NEW.community_id,
        NEW.post_type,
        COALESCE(NEW.title, NEW.author_first_name || ' shared a ' || NEW.post_type),
        LEFT(NEW.body, 200),
        NEW.photo_url,
        NEW.author_user_id,
        NEW.author_first_name,
        NEW.id,
        false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_to_feed
    AFTER INSERT ON community_posts
    FOR EACH ROW
    WHEN (NEW.is_approved = true)
    EXECUTE FUNCTION generate_post_feed_item();

-- Auto-generate feed item when a gathering is created
CREATE OR REPLACE FUNCTION generate_gathering_feed_item()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO community_feed_items (
        community_id, feed_type, title, body,
        attributed_user_id, attributed_name, linked_gathering_id,
        icon_name, is_system_generated
    ) VALUES (
        NEW.community_id,
        'gathering_posted',
        NEW.title,
        NEW.description,
        NEW.organizer_user_id,
        NEW.organizer_first_name,
        NEW.id,
        CASE NEW.event_type
            WHEN 'elder_session' THEN 'school-outline'
            WHEN 'service' THEN 'storefront-outline'
            WHEN 'circle' THEN 'people-outline'
            ELSE 'calendar-outline'
        END,
        true
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_gathering_to_feed
    AFTER INSERT ON community_gatherings
    FOR EACH ROW EXECUTE FUNCTION generate_gathering_feed_item();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  K. ROW LEVEL SECURITY                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Arrivals
ALTER TABLE community_arrivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_arrivals FORCE ROW LEVEL SECURITY;
CREATE POLICY arrivals_member_select ON community_arrivals FOR SELECT TO authenticated USING (true);
CREATE POLICY arrivals_own_update ON community_arrivals FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY arrivals_service_all ON community_arrivals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Welcomes
ALTER TABLE community_welcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_welcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY welcomes_member_select ON community_welcomes FOR SELECT TO authenticated USING (true);
CREATE POLICY welcomes_member_insert ON community_welcomes FOR INSERT TO authenticated WITH CHECK (welcomer_user_id = auth.uid());
CREATE POLICY welcomes_service_all ON community_welcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Gatherings
ALTER TABLE community_gatherings ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_gatherings FORCE ROW LEVEL SECURITY;
CREATE POLICY gatherings_member_select ON community_gatherings FOR SELECT TO authenticated USING (true);
CREATE POLICY gatherings_member_insert ON community_gatherings FOR INSERT TO authenticated WITH CHECK (organizer_user_id = auth.uid());
CREATE POLICY gatherings_own_update ON community_gatherings FOR UPDATE TO authenticated USING (organizer_user_id = auth.uid());
CREATE POLICY gatherings_service_all ON community_gatherings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RSVPs
ALTER TABLE gathering_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE gathering_rsvps FORCE ROW LEVEL SECURITY;
CREATE POLICY rsvps_member_select ON gathering_rsvps FOR SELECT TO authenticated USING (true);
CREATE POLICY rsvps_member_insert ON gathering_rsvps FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY rsvps_own_update ON gathering_rsvps FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY rsvps_own_delete ON gathering_rsvps FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY rsvps_service_all ON gathering_rsvps FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Posts
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts FORCE ROW LEVEL SECURITY;
CREATE POLICY posts_member_select ON community_posts FOR SELECT TO authenticated USING (is_approved = true AND is_flagged = false);
CREATE POLICY posts_member_insert ON community_posts FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());
CREATE POLICY posts_own_update ON community_posts FOR UPDATE TO authenticated USING (author_user_id = auth.uid());
CREATE POLICY posts_service_all ON community_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Post Comments
ALTER TABLE community_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_comments FORCE ROW LEVEL SECURITY;
CREATE POLICY comments_member_select ON community_post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY comments_member_insert ON community_post_comments FOR INSERT TO authenticated WITH CHECK (author_user_id = auth.uid());
CREATE POLICY comments_service_all ON community_post_comments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Post Likes
ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_post_likes FORCE ROW LEVEL SECURITY;
CREATE POLICY likes_member_select ON community_post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY likes_member_insert ON community_post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY likes_own_delete ON community_post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY likes_service_all ON community_post_likes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Memory
ALTER TABLE community_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_memory FORCE ROW LEVEL SECURITY;
CREATE POLICY memory_member_select ON community_memory FOR SELECT TO authenticated USING (is_approved = true);
CREATE POLICY memory_member_insert ON community_memory FOR INSERT TO authenticated WITH CHECK (attributed_user_id = auth.uid());
CREATE POLICY memory_service_all ON community_memory FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Dream Feed
ALTER TABLE dream_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_feed FORCE ROW LEVEL SECURITY;
CREATE POLICY dream_member_select ON dream_feed FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY dream_own_manage ON dream_feed FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY dream_service_all ON dream_feed FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Near You
ALTER TABLE near_you_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_you_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY near_you_member_select ON near_you_profiles FOR SELECT TO authenticated USING (is_discoverable = true);
CREATE POLICY near_you_own_manage ON near_you_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY near_you_service_all ON near_you_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Connections
ALTER TABLE near_you_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE near_you_connections FORCE ROW LEVEL SECURITY;
CREATE POLICY connections_own_select ON near_you_connections FOR SELECT TO authenticated
    USING (sender_user_id = auth.uid() OR recipient_user_id = auth.uid());
CREATE POLICY connections_member_insert ON near_you_connections FOR INSERT TO authenticated WITH CHECK (sender_user_id = auth.uid());
CREATE POLICY connections_own_update ON near_you_connections FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid());
CREATE POLICY connections_service_all ON near_you_connections FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Direct Messages
ALTER TABLE community_direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_direct_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY dm_own_select ON community_direct_messages FOR SELECT TO authenticated
    USING (sender_user_id = auth.uid() OR recipient_user_id = auth.uid());
CREATE POLICY dm_member_insert ON community_direct_messages FOR INSERT TO authenticated WITH CHECK (sender_user_id = auth.uid());
CREATE POLICY dm_own_update ON community_direct_messages FOR UPDATE TO authenticated USING (recipient_user_id = auth.uid());
CREATE POLICY dm_service_all ON community_direct_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Feed Items
ALTER TABLE community_feed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_feed_items FORCE ROW LEVEL SECURITY;
CREATE POLICY feed_member_select ON community_feed_items FOR SELECT TO authenticated USING (true);
CREATE POLICY feed_service_all ON community_feed_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  L. REALTIME                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

ALTER PUBLICATION supabase_realtime ADD TABLE community_feed_items;
ALTER PUBLICATION supabase_realtime ADD TABLE community_direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE gathering_rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE community_post_comments;
