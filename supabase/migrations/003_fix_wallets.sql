-- Fix wallets table and trigger
-- Run this in Supabase SQL Editor

-- First, let's see what columns exist in wallets table
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'wallets';

-- Drop the problematic trigger first
DROP TRIGGER IF EXISTS on_profile_created_wallet ON profiles;
DROP FUNCTION IF EXISTS handle_new_profile_wallet();

-- Check if wallets table exists and add missing columns
DO $$
BEGIN
  -- Add balance column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'balance'
  ) THEN
    ALTER TABLE wallets ADD COLUMN balance DECIMAL(12, 2) DEFAULT 0;
  END IF;

  -- Add currency column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'currency'
  ) THEN
    ALTER TABLE wallets ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;

  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE wallets ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wallets' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE wallets ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END$$;

-- Recreate the wallet creation function
CREATE OR REPLACE FUNCTION handle_new_profile_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_wallet();

-- Create wallets for existing profiles that don't have one
INSERT INTO wallets (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM wallets WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Verify the wallets table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'wallets'
ORDER BY ordinal_position;
