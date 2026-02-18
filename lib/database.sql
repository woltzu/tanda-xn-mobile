-- ============================================================================
-- TandaXn Database Schema for Circles
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USER PROFILES TABLE
-- Extended user data beyond auth.users
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    xn_score INTEGER DEFAULT 75 CHECK (xn_score >= 0 AND xn_score <= 100),
    trust_tier TEXT DEFAULT 'standard' CHECK (trust_tier IN ('restricted', 'building', 'standard', 'trusted', 'preferred', 'elder')),
    country TEXT DEFAULT 'US',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- ============================================================================
-- 2. CIRCLES TABLE
-- Main circles/tanda groups
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('traditional', 'goal-based', 'emergency', 'family-support', 'beneficiary')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'one-time')),
    member_count INTEGER NOT NULL DEFAULT 12 CHECK (member_count >= 2),
    current_members INTEGER NOT NULL DEFAULT 1 CHECK (current_members >= 0),
    start_date DATE,
    rotation_method TEXT DEFAULT 'xnscore' CHECK (rotation_method IN ('xnscore', 'random', 'manual')),
    grace_period_days INTEGER DEFAULT 2 CHECK (grace_period_days >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    emoji TEXT DEFAULT '💰',
    description TEXT,
    location TEXT,
    verified BOOLEAN DEFAULT FALSE,
    min_score INTEGER DEFAULT 0 CHECK (min_score >= 0 AND min_score <= 100),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    invite_code TEXT UNIQUE NOT NULL,

    -- Beneficiary specific fields
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

    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_circles_invite_code ON public.circles(invite_code);
CREATE INDEX IF NOT EXISTS idx_circles_created_by ON public.circles(created_by);
CREATE INDEX IF NOT EXISTS idx_circles_status ON public.circles(status);
CREATE INDEX IF NOT EXISTS idx_circles_type ON public.circles(type);

-- ============================================================================
-- 3. CIRCLE MEMBERS TABLE
-- Junction table for circle membership
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER, -- Rotation position in the circle
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    guarantee_status TEXT DEFAULT 'unguaranteed' CHECK (guarantee_status IN ('guaranteed', 'unguaranteed', 'vouched')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure a user can only be in a circle once
    UNIQUE(circle_id, user_id)
);

-- Create indexes for membership queries
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON public.circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON public.circle_members(user_id);

-- ============================================================================
-- 4. CONTRIBUTIONS TABLE
-- Track individual contributions to circles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.circle_members(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    cycle INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'late', 'missed')),
    due_date DATE,
    paid_date TIMESTAMPTZ,
    is_on_time BOOLEAN,
    is_early BOOLEAN DEFAULT FALSE,
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for contribution queries
CREATE INDEX IF NOT EXISTS idx_contributions_circle ON public.contributions(circle_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON public.contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON public.contributions(status);

-- ============================================================================
-- 5. PAYOUTS TABLE
-- Track payouts to circle members
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    cycle INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    expected_date DATE,
    actual_date TIMESTAMPTZ,
    transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for payout queries
CREATE INDEX IF NOT EXISTS idx_payouts_circle ON public.payouts(circle_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON public.payouts(recipient_id);

-- ============================================================================
-- 6. INVITED MEMBERS TABLE
-- Track pending invitations to circles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invited_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invited_members_circle ON public.invited_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_invited_members_phone ON public.invited_members(phone);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Users can view profiles of people in their circles
CREATE POLICY "Users can view circle members profiles"
    ON public.profiles FOR SELECT
    USING (
        id IN (
            SELECT cm2.user_id FROM public.circle_members cm1
            JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
            WHERE cm1.user_id = auth.uid()
        )
    );

-- ============================================================================
-- CIRCLES POLICIES
-- ============================================================================

-- Anyone authenticated can view circles (for browsing)
CREATE POLICY "Authenticated users can view circles"
    ON public.circles FOR SELECT
    TO authenticated
    USING (true);

-- Only authenticated users can create circles
CREATE POLICY "Authenticated users can create circles"
    ON public.circles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Circle creators and admins can update their circles
CREATE POLICY "Circle creators can update circles"
    ON public.circles FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.circle_members
            WHERE circle_id = circles.id
            AND user_id = auth.uid()
            AND role IN ('creator', 'admin')
        )
    );

-- Only creators can delete circles (when pending)
CREATE POLICY "Circle creators can delete pending circles"
    ON public.circles FOR DELETE
    USING (created_by = auth.uid() AND status = 'pending');

-- ============================================================================
-- CIRCLE MEMBERS POLICIES
-- ============================================================================

-- Users can view members of circles they belong to
CREATE POLICY "Users can view circle members"
    ON public.circle_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_members.circle_id
            AND cm.user_id = auth.uid()
        )
    );

-- Users can join circles (insert themselves)
CREATE POLICY "Users can join circles"
    ON public.circle_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Circle admins can update member status
CREATE POLICY "Admins can update members"
    ON public.circle_members FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = circle_members.circle_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('creator', 'admin')
        )
    );

-- Users can leave circles (delete their membership)
CREATE POLICY "Users can leave circles"
    ON public.circle_members FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- CONTRIBUTIONS POLICIES
-- ============================================================================

-- Users can view contributions in their circles
CREATE POLICY "Users can view circle contributions"
    ON public.contributions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = contributions.circle_id
            AND cm.user_id = auth.uid()
        )
    );

-- Users can make contributions
CREATE POLICY "Users can make contributions"
    ON public.contributions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- PAYOUTS POLICIES
-- ============================================================================

-- Users can view payouts in their circles
CREATE POLICY "Users can view circle payouts"
    ON public.payouts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = payouts.circle_id
            AND cm.user_id = auth.uid()
        )
    );

-- ============================================================================
-- INVITED MEMBERS POLICIES
-- ============================================================================

-- Users can view invitations for circles they created/admin
CREATE POLICY "Users can view invitations"
    ON public.invited_members FOR SELECT
    USING (
        invited_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.circle_members cm
            WHERE cm.circle_id = invited_members.circle_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('creator', 'admin')
        )
    );

-- Users can create invitations
CREATE POLICY "Users can create invitations"
    ON public.invited_members FOR INSERT
    WITH CHECK (auth.uid() = invited_by);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, display_name, xn_score)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE((NEW.raw_user_meta_data->>'xn_score')::INTEGER, 75)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update circle member count
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

-- Trigger to update member count
DROP TRIGGER IF EXISTS on_circle_member_change ON public.circle_members;
CREATE TRIGGER on_circle_member_change
    AFTER INSERT OR DELETE ON public.circle_members
    FOR EACH ROW EXECUTE FUNCTION public.update_circle_member_count();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_circles_updated_at ON public.circles;
CREATE TRIGGER update_circles_updated_at
    BEFORE UPDATE ON public.circles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

-- Enable realtime for circles table
ALTER PUBLICATION supabase_realtime ADD TABLE public.circles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on tables
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.circles TO authenticated;
GRANT ALL ON public.circle_members TO authenticated;
GRANT ALL ON public.contributions TO authenticated;
GRANT ALL ON public.payouts TO authenticated;
GRANT ALL ON public.invited_members TO authenticated;

-- Grant select for browsing (anonymous users can see public circles)
GRANT SELECT ON public.circles TO anon;

-- ============================================================================
-- DONE! Your database is ready for TandaXn Circles
-- ============================================================================
