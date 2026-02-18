-- TandaXn Database Schema Update
-- Run this in your Supabase SQL Editor
-- This version handles existing objects gracefully

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE (extends Supabase auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  xn_score INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes (IF NOT EXISTS doesn't work for indexes, so we use DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_email') THEN
    CREATE INDEX idx_profiles_email ON profiles(email);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_phone') THEN
    CREATE INDEX idx_profiles_phone ON profiles(phone);
  END IF;
END$$;

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- CIRCLES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'traditional',
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  member_count INTEGER NOT NULL DEFAULT 1,
  current_members INTEGER DEFAULT 1,
  start_date DATE,
  rotation_method TEXT DEFAULT 'random',
  grace_period_days INTEGER DEFAULT 2,
  status TEXT DEFAULT 'pending',
  emoji TEXT DEFAULT '💰',
  description TEXT,
  location TEXT,
  verified BOOLEAN DEFAULT FALSE,
  min_score INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  invite_code TEXT UNIQUE,
  -- Beneficiary fields
  beneficiary_name TEXT,
  beneficiary_reason TEXT,
  beneficiary_phone TEXT,
  beneficiary_country TEXT,
  is_one_time BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  total_cycles INTEGER,
  current_cycle INTEGER DEFAULT 1,
  payout_per_cycle DECIMAL(10, 2),
  cycles_completed INTEGER DEFAULT 0,
  total_payout_to_date DECIMAL(10, 2) DEFAULT 0,
  -- Metadata
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circles_created_by') THEN
    CREATE INDEX idx_circles_created_by ON circles(created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circles_status') THEN
    CREATE INDEX idx_circles_status ON circles(status);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circles_invite_code') THEN
    CREATE INDEX idx_circles_invite_code ON circles(invite_code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circles_type') THEN
    CREATE INDEX idx_circles_type ON circles(type);
  END IF;
END$$;

-- =============================================
-- CIRCLE MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- Create indexes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circle_members_circle_id') THEN
    CREATE INDEX idx_circle_members_circle_id ON circle_members(circle_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_circle_members_user_id') THEN
    CREATE INDEX idx_circle_members_user_id ON circle_members(user_id);
  END IF;
END$$;

-- Function to update circle member count
CREATE OR REPLACE FUNCTION update_circle_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circles
    SET current_members = current_members + 1,
        updated_at = NOW()
    WHERE id = NEW.circle_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circles
    SET current_members = GREATEST(current_members - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.circle_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update member count
DROP TRIGGER IF EXISTS on_circle_member_change ON circle_members;
CREATE TRIGGER on_circle_member_change
  AFTER INSERT OR DELETE ON circle_members
  FOR EACH ROW EXECUTE FUNCTION update_circle_member_count();

-- =============================================
-- INVITED MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS invited_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES profiles(id),
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invited_members_circle_id') THEN
    CREATE INDEX idx_invited_members_circle_id ON invited_members(circle_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invited_members_phone') THEN
    CREATE INDEX idx_invited_members_phone ON invited_members(phone);
  END IF;
END$$;

-- =============================================
-- CONTRIBUTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  cycle_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'completed',
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_contributions_circle_id') THEN
    CREATE INDEX idx_contributions_circle_id ON contributions(circle_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_contributions_user_id') THEN
    CREATE INDEX idx_contributions_user_id ON contributions(user_id);
  END IF;
END$$;

-- =============================================
-- PAYOUTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES profiles(id),
  amount DECIMAL(10, 2) NOT NULL,
  cycle_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  scheduled_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payouts_circle_id') THEN
    CREATE INDEX idx_payouts_circle_id ON payouts(circle_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payouts_recipient_id') THEN
    CREATE INDEX idx_payouts_recipient_id ON payouts(recipient_id);
  END IF;
END$$;

-- =============================================
-- WALLET TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wallets_user_id') THEN
    CREATE INDEX idx_wallets_user_id ON wallets(user_id);
  END IF;
END$$;

-- Auto-create wallet for new users
CREATE OR REPLACE FUNCTION handle_new_profile_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_wallet ON profiles;
CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_wallet();

-- =============================================
-- WALLET TRANSACTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  balance_after DECIMAL(12, 2),
  description TEXT,
  reference_id TEXT,
  reference_type TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_wallet_transactions_wallet_id') THEN
    CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
  END IF;
END$$;

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invited_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
DO $$
BEGIN
  -- Profiles policies
  DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

  -- Circles policies
  DROP POLICY IF EXISTS "Anyone can view circles" ON circles;
  DROP POLICY IF EXISTS "Authenticated users can create circles" ON circles;
  DROP POLICY IF EXISTS "Circle creators can update their circles" ON circles;

  -- Circle members policies
  DROP POLICY IF EXISTS "Anyone can view circle members" ON circle_members;
  DROP POLICY IF EXISTS "Authenticated users can join circles" ON circle_members;
  DROP POLICY IF EXISTS "Users can leave circles (delete their membership)" ON circle_members;

  -- Invited members policies
  DROP POLICY IF EXISTS "Anyone can view invited members" ON invited_members;
  DROP POLICY IF EXISTS "Circle creators can invite members" ON invited_members;

  -- Contributions policies
  DROP POLICY IF EXISTS "Users can view contributions in their circles" ON contributions;
  DROP POLICY IF EXISTS "Users can make contributions" ON contributions;

  -- Payouts policies
  DROP POLICY IF EXISTS "Users can view payouts in their circles" ON payouts;

  -- Wallets policies
  DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
  DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;

  -- Wallet transactions policies
  DROP POLICY IF EXISTS "Users can view own wallet transactions" ON wallet_transactions;
  DROP POLICY IF EXISTS "Users can create wallet transactions" ON wallet_transactions;
END$$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Circles policies
CREATE POLICY "Anyone can view circles" ON circles
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create circles" ON circles
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Circle creators can update their circles" ON circles
  FOR UPDATE USING (auth.uid() = created_by);

-- Circle members policies
CREATE POLICY "Anyone can view circle members" ON circle_members
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join circles" ON circle_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave circles (delete their membership)" ON circle_members
  FOR DELETE USING (auth.uid() = user_id);

-- Invited members policies
CREATE POLICY "Anyone can view invited members" ON invited_members
  FOR SELECT USING (true);

CREATE POLICY "Circle creators can invite members" ON invited_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM circles
      WHERE circles.id = invited_members.circle_id
      AND circles.created_by = auth.uid()
    )
  );

-- Contributions policies
CREATE POLICY "Users can view contributions in their circles" ON contributions
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = contributions.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can make contributions" ON contributions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payouts policies
CREATE POLICY "Users can view payouts in their circles" ON payouts
  FOR SELECT USING (
    recipient_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM circle_members
      WHERE circle_members.circle_id = payouts.circle_id
      AND circle_members.user_id = auth.uid()
    )
  );

-- Wallets policies
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Wallet transactions policies
CREATE POLICY "Users can view own wallet transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wallets
      WHERE wallets.id = wallet_transactions.wallet_id
      AND wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create wallet transactions" ON wallet_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallets
      WHERE wallets.id = wallet_transactions.wallet_id
      AND wallets.user_id = auth.uid()
    )
  );

-- =============================================
-- ENABLE REALTIME (ignore errors if already enabled)
-- =============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circles;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circle_members;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE contributions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payouts;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END$$;

-- =============================================
-- CREATE PROFILES FOR EXISTING USERS
-- =============================================
INSERT INTO profiles (id, email, phone, full_name)
SELECT
  id,
  email,
  phone,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- Create wallets for existing profiles
INSERT INTO wallets (user_id, balance)
SELECT id, 0 FROM profiles
WHERE id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT (user_id) DO NOTHING;

SELECT 'Database schema updated successfully!' AS message;
