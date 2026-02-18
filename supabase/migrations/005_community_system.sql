-- ============================================================================
-- TANDAXN COMMUNITY SYSTEM - MIGRATION 005
-- ============================================================================
-- Run this in Supabase SQL Editor AFTER running 004_complete_setup.sql
-- This adds the full community feature including:
-- - Communities and sub-communities
-- - Community memberships and roles
-- - Vouching system
-- - Invitations
-- - Defaults and grace periods
-- - Disputes
-- - Community health scores
-- - Elder system
-- ============================================================================

-- ============================================================================
-- STEP 1: Add community_id to circles table
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'community_id') THEN
        ALTER TABLE circles ADD COLUMN community_id UUID;
    END IF;
END$$;

-- ============================================================================
-- STEP 2: Create COMMUNITIES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '👥',
    image_url TEXT,

    -- Hierarchy (sub-communities)
    parent_community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,

    -- Type/Category
    community_type TEXT NOT NULL DEFAULT 'general',
    -- 'diaspora', 'faith', 'professional', 'local', 'school', 'interest', 'general'

    -- Configuration
    join_policy TEXT NOT NULL DEFAULT 'open',
    -- 'open', 'approval_required', 'invite_only', 'vouch_required'

    required_vouches INTEGER DEFAULT 0,
    minimum_xn_score INTEGER DEFAULT 0,
    max_members INTEGER,
    max_defaults_before_removal INTEGER DEFAULT 3,

    -- Privacy
    is_private BOOLEAN DEFAULT FALSE,
    is_discoverable BOOLEAN DEFAULT TRUE,

    -- Status
    status TEXT NOT NULL DEFAULT 'active',
    -- 'forming', 'active', 'paused', 'dissolved'

    -- Regional/Cultural metadata
    region TEXT,
    country_of_origin TEXT,
    primary_language TEXT DEFAULT 'en',

    -- Stats (denormalized for performance)
    member_count INTEGER DEFAULT 0,
    active_circles_count INTEGER DEFAULT 0,
    total_saved DECIMAL(15,2) DEFAULT 0,

    -- Timestamps
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key for circles -> communities
DO $$
BEGIN
    ALTER TABLE circles ADD CONSTRAINT circles_community_id_fkey
        FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- ============================================================================
-- STEP 3: Create COMMUNITY MEMBERSHIPS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,

    -- Role hierarchy: owner > admin > moderator > elder > member
    role TEXT NOT NULL DEFAULT 'member',

    -- Status
    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'active', 'suspended', 'removed', 'left'

    -- Timestamps
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,

    -- Approval tracking
    approved_by UUID REFERENCES profiles(id),
    invited_by UUID REFERENCES profiles(id),

    -- Member stats within this community
    circles_completed INTEGER DEFAULT 0,
    total_contributed DECIMAL(15,2) DEFAULT 0,
    defaults_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, community_id)
);

-- ============================================================================
-- STEP 4: Create MEMBER VOUCHES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.member_vouches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    vouched_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,

    voucher_xn_score_at_time INTEGER NOT NULL,
    vouch_weight DECIMAL(3,2) DEFAULT 1.0,

    status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'revoked', 'expired', 'invalidated_by_default'

    vouch_message TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(voucher_user_id, vouched_user_id, community_id)
);

-- ============================================================================
-- STEP 5: Create VOUCH EVENTS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vouch_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vouch_id UUID NOT NULL REFERENCES public.member_vouches(id) ON DELETE CASCADE,

    event_type TEXT NOT NULL,
    -- 'created', 'vouchee_defaulted', 'vouchee_completed_circle', 'revoked', 'expired'

    circle_id UUID REFERENCES public.circles(id),
    default_id UUID,

    voucher_score_impact INTEGER DEFAULT 0,
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 6: Create COMMUNITY INVITATIONS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    inviter_user_id UUID NOT NULL REFERENCES profiles(id),

    invitee_user_id UUID REFERENCES profiles(id),
    invitee_email TEXT,
    invitee_phone TEXT,

    invitation_code TEXT UNIQUE,

    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'accepted', 'declined', 'expired', 'revoked'

    personal_message TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 7: Create DEFAULTS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES public.circles(id),
    community_id UUID NOT NULL REFERENCES public.communities(id),
    cycle_number INTEGER NOT NULL,

    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',

    status TEXT NOT NULL DEFAULT 'unresolved',
    -- 'unresolved', 'grace_period', 'recovered', 'partially_recovered',
    -- 'written_off', 'covered_by_reserve', 'covered_by_members'

    covered_by_reserve BOOLEAN DEFAULT FALSE,
    covered_amount DECIMAL(12,2) DEFAULT 0,
    recovered_amount DECIMAL(12,2) DEFAULT 0,

    resolved_at TIMESTAMPTZ,
    resolution_method TEXT,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 8: Create DEFAULT GRACE PERIODS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.default_grace_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_id UUID NOT NULL REFERENCES public.defaults(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES public.circles(id),

    grace_period_days INTEGER NOT NULL DEFAULT 7,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    status TEXT NOT NULL DEFAULT 'active',
    -- 'active', 'payment_made', 'expired', 'extended'

    extension_count INTEGER DEFAULT 0,
    extended_by UUID REFERENCES profiles(id),
    extension_reason TEXT,

    reminders_sent INTEGER DEFAULT 0,
    last_reminder_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 9: Create DISPUTES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reporter_user_id UUID NOT NULL REFERENCES profiles(id),
    against_user_id UUID REFERENCES profiles(id),

    community_id UUID NOT NULL REFERENCES public.communities(id),
    circle_id UUID REFERENCES public.circles(id),
    default_id UUID REFERENCES public.defaults(id),

    type TEXT NOT NULL,
    -- 'missed_contribution', 'fraud_suspicion', 'harassment',
    -- 'rule_violation', 'payout_dispute', 'unfair_removal', 'other'

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    evidence_urls TEXT[],

    priority TEXT NOT NULL DEFAULT 'medium',
    -- 'low', 'medium', 'high', 'critical'

    status TEXT NOT NULL DEFAULT 'open',
    -- 'open', 'under_review', 'investigating', 'awaiting_response',
    -- 'resolved', 'escalated', 'dismissed'

    assigned_to UUID REFERENCES profiles(id),
    escalated_to TEXT,

    resolved_by UUID REFERENCES profiles(id),
    resolution TEXT,
    resolution_type TEXT,
    resolved_at TIMESTAMPTZ,

    response_text TEXT,
    response_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 10: Create DISPUTE MESSAGES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.dispute_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES profiles(id),

    message TEXT NOT NULL,
    message_type TEXT DEFAULT 'message',
    -- 'message', 'evidence', 'decision', 'system'

    attachment_urls TEXT[],
    is_private BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 11: Create COMMUNITY HEALTH SCORES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_health_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,

    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    score INTEGER NOT NULL,
    status TEXT NOT NULL,

    contribution_reliability_score INTEGER,
    contribution_reliability_weight DECIMAL(3,2) DEFAULT 0.40,

    activity_rate_score INTEGER,
    activity_rate_weight DECIMAL(3,2) DEFAULT 0.20,

    default_score INTEGER,
    default_weight DECIMAL(3,2) DEFAULT 0.25,

    growth_score INTEGER,
    growth_weight DECIMAL(3,2) DEFAULT 0.15,

    metrics JSONB NOT NULL,
    recommendations JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 12: Create COMMUNITY ACTIVITIES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,

    actor_user_id UUID REFERENCES profiles(id),

    activity_type TEXT NOT NULL,
    -- 'member_joined', 'member_left', 'circle_created', 'circle_completed',
    -- 'payout_made', 'milestone_reached', 'member_vouched', 'dispute_resolved',
    -- 'community_settings_changed', 'admin_promoted', 'achievement_unlocked'

    circle_id UUID REFERENCES public.circles(id),
    target_user_id UUID REFERENCES profiles(id),

    title TEXT NOT NULL,
    description TEXT,
    metadata JSONB,

    is_public BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 13: Create COMMUNITY LEADERBOARD SNAPSHOTS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,

    period_type TEXT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    leaderboard_type TEXT NOT NULL,
    -- 'total_saved', 'referrals', 'xn_score', 'circles_completed', 'on_time_payments'

    rankings JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 14: Create ELDER APPLICATIONS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.elder_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    community_id UUID NOT NULL REFERENCES public.communities(id),

    status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending', 'under_review', 'approved', 'rejected', 'withdrawn'

    xn_score_at_application INTEGER NOT NULL,
    honor_score_at_application INTEGER,
    circles_completed_at_application INTEGER NOT NULL,
    member_since TIMESTAMPTZ NOT NULL,
    active_disputes_at_application INTEGER DEFAULT 0,

    motivation_statement TEXT,

    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, community_id)
);

-- ============================================================================
-- STEP 15: Create ELDER COUNCIL VOTES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.elder_council_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID NOT NULL REFERENCES public.communities(id),

    vote_type TEXT NOT NULL,
    -- 'dispute_appeal', 'rule_change', 'member_removal', 'elder_removal', 'precedent'

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    dispute_id UUID REFERENCES public.disputes(id),
    target_user_id UUID REFERENCES profiles(id),

    required_votes INTEGER NOT NULL DEFAULT 3,
    voting_deadline TIMESTAMPTZ NOT NULL,

    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'open',
    -- 'open', 'passed', 'rejected', 'tied', 'expired'

    result TEXT,
    result_implemented_at TIMESTAMPTZ,

    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- STEP 16: Create ELDER VOTE RECORDS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.elder_vote_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    council_vote_id UUID NOT NULL REFERENCES public.elder_council_votes(id) ON DELETE CASCADE,
    elder_user_id UUID NOT NULL REFERENCES profiles(id),

    vote TEXT NOT NULL, -- 'for', 'against', 'abstain'
    voting_power DECIMAL(3,2) DEFAULT 1.0,

    reasoning TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(council_vote_id, elder_user_id)
);

-- ============================================================================
-- STEP 17: Create INDEXES for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_communities_parent ON public.communities(parent_community_id);
CREATE INDEX IF NOT EXISTS idx_communities_type ON public.communities(community_type);
CREATE INDEX IF NOT EXISTS idx_communities_status ON public.communities(status);
CREATE INDEX IF NOT EXISTS idx_communities_discoverable ON public.communities(is_discoverable, status);

CREATE INDEX IF NOT EXISTS idx_community_memberships_community ON public.community_memberships(community_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_user ON public.community_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_status ON public.community_memberships(community_id, status);
CREATE INDEX IF NOT EXISTS idx_community_memberships_role ON public.community_memberships(community_id, role);

CREATE INDEX IF NOT EXISTS idx_member_vouches_vouched ON public.member_vouches(vouched_user_id, community_id);
CREATE INDEX IF NOT EXISTS idx_member_vouches_voucher ON public.member_vouches(voucher_user_id);
CREATE INDEX IF NOT EXISTS idx_member_vouches_status ON public.member_vouches(status);

CREATE INDEX IF NOT EXISTS idx_vouch_events_vouch ON public.vouch_events(vouch_id);

CREATE INDEX IF NOT EXISTS idx_community_invitations_community ON public.community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_invitee ON public.community_invitations(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_community_invitations_code ON public.community_invitations(invitation_code);

CREATE INDEX IF NOT EXISTS idx_defaults_user ON public.defaults(user_id);
CREATE INDEX IF NOT EXISTS idx_defaults_community ON public.defaults(community_id);
CREATE INDEX IF NOT EXISTS idx_defaults_circle ON public.defaults(circle_id);
CREATE INDEX IF NOT EXISTS idx_defaults_status ON public.defaults(status);

CREATE INDEX IF NOT EXISTS idx_grace_periods_default ON public.default_grace_periods(default_id);
CREATE INDEX IF NOT EXISTS idx_grace_periods_expires ON public.default_grace_periods(expires_at, status);

CREATE INDEX IF NOT EXISTS idx_disputes_community ON public.disputes(community_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_assigned ON public.disputes(assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute ON public.dispute_messages(dispute_id);

CREATE INDEX IF NOT EXISTS idx_community_health_community ON public.community_health_scores(community_id);
CREATE INDEX IF NOT EXISTS idx_community_health_date ON public.community_health_scores(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_activities_community ON public.community_activities(community_id);
CREATE INDEX IF NOT EXISTS idx_community_activities_date ON public.community_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_community ON public.community_leaderboard_snapshots(community_id);

CREATE INDEX IF NOT EXISTS idx_elder_applications_community ON public.elder_applications(community_id);
CREATE INDEX IF NOT EXISTS idx_elder_applications_status ON public.elder_applications(status);

CREATE INDEX IF NOT EXISTS idx_council_votes_community ON public.elder_council_votes(community_id);
CREATE INDEX IF NOT EXISTS idx_council_votes_status ON public.elder_council_votes(status);

CREATE INDEX IF NOT EXISTS idx_circles_community ON public.circles(community_id);

-- ============================================================================
-- STEP 18: Enable RLS on all tables
-- ============================================================================
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_vouches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.default_grace_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_council_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_vote_records ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 19: Create RLS Policies
-- ============================================================================

-- COMMUNITIES
CREATE POLICY "communities_select_public" ON public.communities FOR SELECT
USING (status = 'active' AND is_discoverable = TRUE AND is_private = FALSE);

CREATE POLICY "communities_select_member" ON public.communities FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

CREATE POLICY "communities_insert" ON public.communities FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "communities_update" ON public.communities FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
);

-- COMMUNITY MEMBERSHIPS
CREATE POLICY "memberships_select" ON public.community_memberships FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

CREATE POLICY "memberships_insert" ON public.community_memberships FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "memberships_update_own" ON public.community_memberships FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "memberships_update_admin" ON public.community_memberships FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
);

-- MEMBER VOUCHES
CREATE POLICY "vouches_select" ON public.member_vouches FOR SELECT
USING (
    voucher_user_id = auth.uid()
    OR vouched_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

CREATE POLICY "vouches_insert" ON public.member_vouches FOR INSERT
WITH CHECK (voucher_user_id = auth.uid());

CREATE POLICY "vouches_update" ON public.member_vouches FOR UPDATE
USING (voucher_user_id = auth.uid());

-- VOUCH EVENTS
CREATE POLICY "vouch_events_select" ON public.vouch_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.member_vouches mv
        WHERE mv.id = vouch_id
        AND (mv.voucher_user_id = auth.uid() OR mv.vouched_user_id = auth.uid())
    )
);

-- COMMUNITY INVITATIONS
CREATE POLICY "invitations_select" ON public.community_invitations FOR SELECT
USING (
    inviter_user_id = auth.uid()
    OR invitee_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'moderator')
    )
);

CREATE POLICY "invitations_insert" ON public.community_invitations FOR INSERT
WITH CHECK (
    inviter_user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- DEFAULTS
CREATE POLICY "defaults_select" ON public.defaults FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

-- GRACE PERIODS
CREATE POLICY "grace_periods_select" ON public.default_grace_periods FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.defaults d
        JOIN public.community_memberships cm ON cm.community_id = d.community_id
        WHERE d.id = default_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

-- DISPUTES
CREATE POLICY "disputes_select" ON public.disputes FOR SELECT
USING (
    reporter_user_id = auth.uid()
    OR against_user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

CREATE POLICY "disputes_insert" ON public.disputes FOR INSERT
WITH CHECK (
    reporter_user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- DISPUTE MESSAGES
CREATE POLICY "dispute_messages_select" ON public.dispute_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.disputes d
        WHERE d.id = dispute_id
        AND (
            d.reporter_user_id = auth.uid()
            OR d.against_user_id = auth.uid()
            OR d.assigned_to = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.community_memberships cm
                WHERE cm.community_id = d.community_id
                AND cm.user_id = auth.uid()
                AND cm.status = 'active'
                AND cm.role IN ('owner', 'admin', 'elder')
            )
        )
    )
);

CREATE POLICY "dispute_messages_insert" ON public.dispute_messages FOR INSERT
WITH CHECK (sender_user_id = auth.uid());

-- COMMUNITY ACTIVITIES
CREATE POLICY "activities_select" ON public.community_activities FOR SELECT
USING (
    is_public = TRUE
    AND EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- COMMUNITY HEALTH SCORES
CREATE POLICY "health_scores_select" ON public.community_health_scores FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

-- LEADERBOARD SNAPSHOTS
CREATE POLICY "leaderboard_select" ON public.community_leaderboard_snapshots FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
);

-- ELDER APPLICATIONS
CREATE POLICY "elder_applications_select" ON public.elder_applications FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin')
    )
);

CREATE POLICY "elder_applications_insert" ON public.elder_applications FOR INSERT
WITH CHECK (user_id = auth.uid());

-- ELDER COUNCIL VOTES
CREATE POLICY "council_votes_select" ON public.elder_council_votes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.community_memberships cm
        WHERE cm.community_id = community_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

-- ELDER VOTE RECORDS
CREATE POLICY "vote_records_select" ON public.elder_vote_records FOR SELECT
USING (
    elder_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.elder_council_votes ecv
        JOIN public.community_memberships cm ON cm.community_id = ecv.community_id
        WHERE ecv.id = council_vote_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'admin', 'elder')
    )
);

CREATE POLICY "vote_records_insert" ON public.elder_vote_records FOR INSERT
WITH CHECK (elder_user_id = auth.uid());

-- ============================================================================
-- STEP 20: Create FUNCTIONS
-- ============================================================================

-- Function to update community member count
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE public.communities
        SET member_count = member_count + 1,
            updated_at = NOW()
        WHERE id = NEW.community_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE public.communities
            SET member_count = member_count + 1,
                updated_at = NOW()
            WHERE id = NEW.community_id;
        ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
            UPDATE public.communities
            SET member_count = GREATEST(0, member_count - 1),
                updated_at = NOW()
            WHERE id = NEW.community_id;
        END IF;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE public.communities
        SET member_count = GREATEST(0, member_count - 1),
            updated_at = NOW()
        WHERE id = OLD.community_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for member count
DROP TRIGGER IF EXISTS trigger_update_community_member_count ON public.community_memberships;
CREATE TRIGGER trigger_update_community_member_count
AFTER INSERT OR UPDATE OR DELETE ON public.community_memberships
FOR EACH ROW EXECUTE FUNCTION update_community_member_count();

-- Function to auto-approve membership when vouch requirements are met
CREATE OR REPLACE FUNCTION check_vouch_requirements()
RETURNS TRIGGER AS $$
DECLARE
    required_vouches INTEGER;
    current_vouches INTEGER;
BEGIN
    SELECT c.required_vouches INTO required_vouches
    FROM public.communities c
    WHERE c.id = NEW.community_id;

    IF required_vouches > 0 THEN
        SELECT COUNT(*) INTO current_vouches
        FROM public.member_vouches mv
        WHERE mv.vouched_user_id = NEW.vouched_user_id
        AND mv.community_id = NEW.community_id
        AND mv.status = 'active';

        IF current_vouches >= required_vouches THEN
            UPDATE public.community_memberships
            SET status = 'active',
                joined_at = NOW(),
                updated_at = NOW()
            WHERE user_id = NEW.vouched_user_id
            AND community_id = NEW.community_id
            AND status = 'pending';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for vouch requirements
DROP TRIGGER IF EXISTS trigger_check_vouch_requirements ON public.member_vouches;
CREATE TRIGGER trigger_check_vouch_requirements
AFTER INSERT ON public.member_vouches
FOR EACH ROW EXECUTE FUNCTION check_vouch_requirements();

-- Function to log community activities
CREATE OR REPLACE FUNCTION log_community_activity(
    p_community_id UUID,
    p_actor_user_id UUID,
    p_activity_type TEXT,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_circle_id UUID DEFAULT NULL,
    p_target_user_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO public.community_activities (
        community_id, actor_user_id, activity_type, title,
        description, circle_id, target_user_id, metadata
    )
    VALUES (
        p_community_id, p_actor_user_id, p_activity_type, p_title,
        p_description, p_circle_id, p_target_user_id, p_metadata
    )
    RETURNING id INTO activity_id;

    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-add community creator as owner
CREATE OR REPLACE FUNCTION add_community_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.community_memberships (
        user_id,
        community_id,
        role,
        status,
        joined_at
    )
    VALUES (
        NEW.created_by,
        NEW.id,
        'owner',
        'active',
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-add creator as owner
DROP TRIGGER IF EXISTS trigger_add_community_creator ON public.communities;
CREATE TRIGGER trigger_add_community_creator
AFTER INSERT ON public.communities
FOR EACH ROW EXECUTE FUNCTION add_community_creator_as_owner();

-- ============================================================================
-- STEP 21: Enable Realtime for community tables
-- ============================================================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE communities; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE community_memberships; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE community_activities; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE disputes; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DONE! Verify setup
-- ============================================================================
SELECT 'Community system setup complete!' AS status;
