-- ============================================================================
-- TandaXn - CREATE NEW CIRCLE TABLES
-- Run this to create the circles system tables from scratch
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE CIRCLES TABLE
-- ============================================================================
CREATE TABLE public.circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'traditional',
    amount DECIMAL(12, 2) NOT NULL DEFAULT 100,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    member_count INTEGER NOT NULL DEFAULT 12,
    current_members INTEGER NOT NULL DEFAULT 1,
    start_date DATE,
    rotation_method TEXT DEFAULT 'xnscore',
    grace_period_days INTEGER DEFAULT 2,
    status TEXT DEFAULT 'pending',
    emoji TEXT DEFAULT '💰',
    description TEXT,
    location TEXT,
    verified BOOLEAN DEFAULT FALSE,
    min_score INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    invite_code TEXT UNIQUE NOT NULL,
    beneficiary_name TEXT,
    beneficiary_reason TEXT,
    beneficiary_phone TEXT,
    beneficiary_country TEXT,
    is_one_time BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    total_cycles INTEGER,
    current_cycle INTEGER DEFAULT 1,
    payout_per_cycle DECIMAL(12, 2),
    cycles_completed INTEGER DEFAULT 0,
    total_payout_to_date DECIMAL(12, 2) DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for circles
CREATE INDEX idx_circles_invite_code ON public.circles(invite_code);
CREATE INDEX idx_circles_created_by ON public.circles(created_by);
CREATE INDEX idx_circles_status ON public.circles(status);

-- ============================================================================
-- 2. CREATE CIRCLE_MEMBERS TABLE
-- ============================================================================
CREATE TABLE public.circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'active',
    guarantee_status TEXT DEFAULT 'unguaranteed',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

-- Indexes for circle_members
CREATE INDEX idx_circle_members_circle ON public.circle_members(circle_id);
CREATE INDEX idx_circle_members_user ON public.circle_members(user_id);

-- ============================================================================
-- 3. CREATE INVITED_MEMBERS TABLE
-- ============================================================================
CREATE TABLE public.invited_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX idx_invited_members_circle ON public.invited_members(circle_id);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. CREATE RLS POLICIES FOR CIRCLES
-- ============================================================================

-- Anyone logged in can view circles
CREATE POLICY "Anyone can view circles"
    ON public.circles FOR SELECT
    TO authenticated
    USING (true);

-- Users can create circles
CREATE POLICY "Users can create circles"
    ON public.circles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Creators can update their circles
CREATE POLICY "Creators can update circles"
    ON public.circles FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

-- Creators can delete pending circles
CREATE POLICY "Creators can delete circles"
    ON public.circles FOR DELETE
    TO authenticated
    USING (created_by = auth.uid() AND status = 'pending');

-- ============================================================================
-- 6. CREATE RLS POLICIES FOR CIRCLE_MEMBERS
-- ============================================================================

-- Anyone can view members
CREATE POLICY "Anyone can view members"
    ON public.circle_members FOR SELECT
    TO authenticated
    USING (true);

-- Users can join circles (insert themselves)
CREATE POLICY "Users can join circles"
    ON public.circle_members FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can leave circles (delete themselves)
CREATE POLICY "Users can leave circles"
    ON public.circle_members FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- ============================================================================
-- 7. CREATE RLS POLICIES FOR INVITED_MEMBERS
-- ============================================================================

CREATE POLICY "Anyone can view invitations"
    ON public.invited_members FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can create invitations"
    ON public.invited_members FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = invited_by);

-- ============================================================================
-- 8. CREATE TRIGGER TO AUTO-UPDATE MEMBER COUNT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_circle_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.circles
        SET current_members = current_members + 1,
            updated_at = NOW()
        WHERE id = NEW.circle_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.circles
        SET current_members = GREATEST(current_members - 1, 0),
            updated_at = NOW()
        WHERE id = OLD.circle_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_circle_member_change
    AFTER INSERT OR DELETE ON public.circle_members
    FOR EACH ROW EXECUTE FUNCTION public.update_circle_member_count();

-- ============================================================================
-- 9. ENABLE REALTIME FOR CIRCLES
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.circles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.circles TO authenticated;
GRANT ALL ON public.circle_members TO authenticated;
GRANT ALL ON public.invited_members TO authenticated;

-- ============================================================================
-- DONE! Tables created successfully.
-- ============================================================================
