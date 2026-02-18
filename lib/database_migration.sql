-- ============================================================================
-- TandaXn Database MIGRATION Script
-- Run this if you already have some tables and need to add missing columns
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING CIRCLES TABLE
-- ============================================================================

-- Add invite_code column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'circles'
                   AND column_name = 'invite_code') THEN
        ALTER TABLE public.circles ADD COLUMN invite_code TEXT;
    END IF;
END $$;

-- Add other potentially missing columns to circles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'name') THEN
        ALTER TABLE public.circles ADD COLUMN name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'type') THEN
        ALTER TABLE public.circles ADD COLUMN type TEXT DEFAULT 'traditional';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'amount') THEN
        ALTER TABLE public.circles ADD COLUMN amount DECIMAL(12, 2) DEFAULT 100;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'frequency') THEN
        ALTER TABLE public.circles ADD COLUMN frequency TEXT DEFAULT 'monthly';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'member_count') THEN
        ALTER TABLE public.circles ADD COLUMN member_count INTEGER DEFAULT 12;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'current_members') THEN
        ALTER TABLE public.circles ADD COLUMN current_members INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'start_date') THEN
        ALTER TABLE public.circles ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'rotation_method') THEN
        ALTER TABLE public.circles ADD COLUMN rotation_method TEXT DEFAULT 'xnscore';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'grace_period_days') THEN
        ALTER TABLE public.circles ADD COLUMN grace_period_days INTEGER DEFAULT 2;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'status') THEN
        ALTER TABLE public.circles ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'emoji') THEN
        ALTER TABLE public.circles ADD COLUMN emoji TEXT DEFAULT '💰';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'description') THEN
        ALTER TABLE public.circles ADD COLUMN description TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'location') THEN
        ALTER TABLE public.circles ADD COLUMN location TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'verified') THEN
        ALTER TABLE public.circles ADD COLUMN verified BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'min_score') THEN
        ALTER TABLE public.circles ADD COLUMN min_score INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'progress') THEN
        ALTER TABLE public.circles ADD COLUMN progress INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'beneficiary_name') THEN
        ALTER TABLE public.circles ADD COLUMN beneficiary_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'beneficiary_reason') THEN
        ALTER TABLE public.circles ADD COLUMN beneficiary_reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'beneficiary_phone') THEN
        ALTER TABLE public.circles ADD COLUMN beneficiary_phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'beneficiary_country') THEN
        ALTER TABLE public.circles ADD COLUMN beneficiary_country TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'is_one_time') THEN
        ALTER TABLE public.circles ADD COLUMN is_one_time BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'is_recurring') THEN
        ALTER TABLE public.circles ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'total_cycles') THEN
        ALTER TABLE public.circles ADD COLUMN total_cycles INTEGER;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'current_cycle') THEN
        ALTER TABLE public.circles ADD COLUMN current_cycle INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'payout_per_cycle') THEN
        ALTER TABLE public.circles ADD COLUMN payout_per_cycle DECIMAL(12, 2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'cycles_completed') THEN
        ALTER TABLE public.circles ADD COLUMN cycles_completed INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'total_payout_to_date') THEN
        ALTER TABLE public.circles ADD COLUMN total_payout_to_date DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'created_by') THEN
        ALTER TABLE public.circles ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'created_at') THEN
        ALTER TABLE public.circles ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = 'circles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.circles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Create unique index on invite_code if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_circles_invite_code ON public.circles(invite_code) WHERE invite_code IS NOT NULL;

-- Create other indexes
CREATE INDEX IF NOT EXISTS idx_circles_created_by ON public.circles(created_by);
CREATE INDEX IF NOT EXISTS idx_circles_status ON public.circles(status);
CREATE INDEX IF NOT EXISTS idx_circles_type ON public.circles(type);

-- ============================================================================
-- 2. CREATE PROFILES TABLE IF NOT EXISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    xn_score INTEGER DEFAULT 75 CHECK (xn_score >= 0 AND xn_score <= 100),
    trust_tier TEXT DEFAULT 'standard',
    country TEXT DEFAULT 'US',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- ============================================================================
-- 3. CREATE CIRCLE_MEMBERS TABLE IF NOT EXISTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER,
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    guarantee_status TEXT DEFAULT 'unguaranteed',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON public.circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON public.circle_members(user_id);

-- ============================================================================
-- 4. CREATE CONTRIBUTIONS TABLE IF NOT EXISTS
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

CREATE INDEX IF NOT EXISTS idx_contributions_circle ON public.contributions(circle_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user ON public.contributions(user_id);

-- ============================================================================
-- 5. CREATE PAYOUTS TABLE IF NOT EXISTS
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

CREATE INDEX IF NOT EXISTS idx_payouts_circle ON public.payouts(circle_id);
CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON public.payouts(recipient_id);

-- ============================================================================
-- 6. CREATE INVITED_MEMBERS TABLE IF NOT EXISTS
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

CREATE INDEX IF NOT EXISTS idx_invited_members_circle ON public.invited_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_invited_members_phone ON public.invited_members(phone);

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invited_members ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. DROP EXISTING POLICIES (if any) AND CREATE NEW ONES
-- ============================================================================

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- CIRCLES POLICIES
DROP POLICY IF EXISTS "Authenticated users can view circles" ON public.circles;
DROP POLICY IF EXISTS "Authenticated users can create circles" ON public.circles;
DROP POLICY IF EXISTS "Circle creators can update circles" ON public.circles;
DROP POLICY IF EXISTS "Circle creators can delete pending circles" ON public.circles;

CREATE POLICY "Authenticated users can view circles"
    ON public.circles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create circles"
    ON public.circles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

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

CREATE POLICY "Circle creators can delete pending circles"
    ON public.circles FOR DELETE
    USING (created_by = auth.uid() AND status = 'pending');

-- CIRCLE_MEMBERS POLICIES
DROP POLICY IF EXISTS "Users can view circle members" ON public.circle_members;
DROP POLICY IF EXISTS "Users can join circles" ON public.circle_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.circle_members;
DROP POLICY IF EXISTS "Users can leave circles" ON public.circle_members;

CREATE POLICY "Users can view circle members"
    ON public.circle_members FOR SELECT
    USING (true);

CREATE POLICY "Users can join circles"
    ON public.circle_members FOR INSERT
    WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Users can leave circles"
    ON public.circle_members FOR DELETE
    USING (user_id = auth.uid());

-- CONTRIBUTIONS POLICIES
DROP POLICY IF EXISTS "Users can view circle contributions" ON public.contributions;
DROP POLICY IF EXISTS "Users can make contributions" ON public.contributions;

CREATE POLICY "Users can view circle contributions"
    ON public.contributions FOR SELECT
    USING (true);

CREATE POLICY "Users can make contributions"
    ON public.contributions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- PAYOUTS POLICIES
DROP POLICY IF EXISTS "Users can view circle payouts" ON public.payouts;

CREATE POLICY "Users can view circle payouts"
    ON public.payouts FOR SELECT
    USING (true);

-- INVITED_MEMBERS POLICIES
DROP POLICY IF EXISTS "Users can view invitations" ON public.invited_members;
DROP POLICY IF EXISTS "Users can create invitations" ON public.invited_members;

CREATE POLICY "Users can view invitations"
    ON public.invited_members FOR SELECT
    USING (true);

CREATE POLICY "Users can create invitations"
    ON public.invited_members FOR INSERT
    WITH CHECK (auth.uid() = invited_by);

-- ============================================================================
-- 9. CREATE FUNCTIONS AND TRIGGERS
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
    )
    ON CONFLICT (id) DO NOTHING;
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
-- 10. ENABLE REALTIME
-- ============================================================================

-- Enable realtime for tables (ignore errors if already enabled)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circles;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================================
-- 11. GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.circles TO authenticated;
GRANT ALL ON public.circle_members TO authenticated;
GRANT ALL ON public.contributions TO authenticated;
GRANT ALL ON public.payouts TO authenticated;
GRANT ALL ON public.invited_members TO authenticated;

GRANT SELECT ON public.circles TO anon;

-- ============================================================================
-- DONE! Migration complete.
-- ============================================================================
