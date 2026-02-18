-- TandaXn Complete Database Setup
-- This script handles ALL cases - fresh install or existing tables
-- Run this in Supabase SQL Editor

-- =============================================
-- STEP 1: Enable extensions
-- =============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- STEP 2: Drop all existing triggers first
-- =============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created_wallet ON profiles;
DROP TRIGGER IF EXISTS on_circle_member_change ON circle_members;

-- =============================================
-- STEP 3: Drop existing functions
-- =============================================
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS handle_new_profile_wallet();
DROP FUNCTION IF EXISTS update_circle_member_count();

-- =============================================
-- STEP 4: Create/Update PROFILES table
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  phone TEXT,
  full_name TEXT,
  avatar_url TEXT,
  xn_score INTEGER DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key if not exists (might fail if already exists, that's OK)
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 5: Create/Update WALLETS table
-- =============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE,
  balance DECIMAL(12, 2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'balance') THEN
    ALTER TABLE wallets ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'currency') THEN
    ALTER TABLE wallets ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'created_at') THEN
    ALTER TABLE wallets ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wallets' AND column_name = 'updated_at') THEN
    ALTER TABLE wallets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END$$;

-- Add foreign key if not exists
DO $$
BEGIN
  ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 6: Create/Update CIRCLES table
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
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for created_by
DO $$
BEGIN
  ALTER TABLE circles ADD CONSTRAINT circles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES profiles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 7: Create/Update CIRCLE_MEMBERS table
-- =============================================
CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL,
  user_id UUID NOT NULL,
  position INTEGER DEFAULT 0,
  role TEXT DEFAULT 'member',
  status TEXT DEFAULT 'active',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(circle_id, user_id)
);

-- Add foreign keys
DO $$
BEGIN
  ALTER TABLE circle_members ADD CONSTRAINT circle_members_circle_id_fkey
    FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TABLE circle_members ADD CONSTRAINT circle_members_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 8: Create/Update INVITED_MEMBERS table
-- =============================================
CREATE TABLE IF NOT EXISTS invited_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL,
  invited_by UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE invited_members ADD CONSTRAINT invited_members_circle_id_fkey
    FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 9: Create/Update CONTRIBUTIONS table
-- =============================================
CREATE TABLE IF NOT EXISTS contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  cycle_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'completed',
  payment_method TEXT,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE contributions ADD CONSTRAINT contributions_circle_id_fkey
    FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 10: Create/Update PAYOUTS table
-- =============================================
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circle_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  cycle_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  scheduled_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE payouts ADD CONSTRAINT payouts_circle_id_fkey
    FOREIGN KEY (circle_id) REFERENCES circles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 11: Create/Update WALLET_TRANSACTIONS table
-- =============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL,
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
  ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- =============================================
-- STEP 12: Create Functions
-- =============================================

-- Function: Auto-create profile when user signs up
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
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Auto-create wallet for new profiles
CREATE OR REPLACE FUNCTION handle_new_profile_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance, currency)
  VALUES (NEW.id, 0, 'USD')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update circle member count
CREATE OR REPLACE FUNCTION update_circle_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE circles SET current_members = current_members + 1, updated_at = NOW()
    WHERE id = NEW.circle_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE circles SET current_members = GREATEST(current_members - 1, 0), updated_at = NOW()
    WHERE id = OLD.circle_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- STEP 13: Create Triggers
-- =============================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_wallet();

CREATE TRIGGER on_circle_member_change
  AFTER INSERT OR DELETE ON circle_members
  FOR EACH ROW EXECUTE FUNCTION update_circle_member_count();

-- =============================================
-- STEP 14: Enable RLS
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invited_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 15: Drop and Recreate ALL Policies
-- =============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all existing policies on our tables
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('profiles', 'wallets', 'circles', 'circle_members', 'invited_members', 'contributions', 'payouts', 'wallet_transactions'))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Wallets
CREATE POLICY "wallets_select" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wallets_update" ON wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "wallets_insert" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Circles
CREATE POLICY "circles_select" ON circles FOR SELECT USING (true);
CREATE POLICY "circles_insert" ON circles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "circles_update" ON circles FOR UPDATE USING (auth.uid() = created_by);

-- Circle Members
CREATE POLICY "circle_members_select" ON circle_members FOR SELECT USING (true);
CREATE POLICY "circle_members_insert" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "circle_members_delete" ON circle_members FOR DELETE USING (auth.uid() = user_id);

-- Invited Members
CREATE POLICY "invited_members_select" ON invited_members FOR SELECT USING (true);
CREATE POLICY "invited_members_insert" ON invited_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM circles WHERE id = circle_id AND created_by = auth.uid())
);

-- Contributions
CREATE POLICY "contributions_select" ON contributions FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM circle_members WHERE circle_id = contributions.circle_id AND user_id = auth.uid())
);
CREATE POLICY "contributions_insert" ON contributions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payouts
CREATE POLICY "payouts_select" ON payouts FOR SELECT USING (
  recipient_id = auth.uid() OR EXISTS (SELECT 1 FROM circle_members WHERE circle_id = payouts.circle_id AND user_id = auth.uid())
);

-- Wallet Transactions
CREATE POLICY "wallet_transactions_select" ON wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM wallets WHERE id = wallet_id AND user_id = auth.uid())
);
CREATE POLICY "wallet_transactions_insert" ON wallet_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM wallets WHERE id = wallet_id AND user_id = auth.uid())
);

-- =============================================
-- STEP 16: Enable Realtime
-- =============================================
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE circles; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE circle_members; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE contributions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payouts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- STEP 17: Sync existing users
-- =============================================
-- Create profiles for any existing auth users
INSERT INTO profiles (id, email, phone, full_name)
SELECT id, email, phone, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Create wallets for any existing profiles
INSERT INTO wallets (user_id, balance, currency)
SELECT id, 0, 'USD' FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- DONE! Verify setup
-- =============================================
SELECT 'Setup complete!' AS status,
  (SELECT COUNT(*) FROM profiles) AS profiles_count,
  (SELECT COUNT(*) FROM wallets) AS wallets_count,
  (SELECT COUNT(*) FROM circles) AS circles_count;
