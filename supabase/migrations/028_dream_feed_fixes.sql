-- Dream Feed Fixes: Profile Ensure + Saved Posts
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fjqdkyjkwqeoafwvnjgv/sql/new

-- ============================================
-- 0. FIX: handle_new_profile_wallet() trigger
--    The profiles table uses "id" (not "user_id").
--    A previous migration broke this by referencing NEW.user_id.
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_profile_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance, currency)
  VALUES (NEW.id, 0, 'USD')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 1. ensure_user_profile() — RPC function
--    Called by the app before creating feed posts.
--    Guarantees the auth user has a matching profiles row.
-- ============================================

CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    (SELECT COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
     FROM auth.users WHERE id = auth.uid())
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. Add INSERT policy on profiles for self-creation
--    (Backup — allows client-side upsert if needed)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON profiles
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ============================================
-- 3. feed_saved_posts — Save/bookmark posts
-- ============================================

CREATE TABLE IF NOT EXISTS feed_saved_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_saved_posts_user_id ON feed_saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_saved_posts_post_id ON feed_saved_posts(post_id);

-- Enable RLS
ALTER TABLE feed_saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feed_saved_posts' AND policyname = 'read_own_saved') THEN
    CREATE POLICY "read_own_saved" ON feed_saved_posts FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feed_saved_posts' AND policyname = 'insert_own_saved') THEN
    CREATE POLICY "insert_own_saved" ON feed_saved_posts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'feed_saved_posts' AND policyname = 'delete_own_saved') THEN
    CREATE POLICY "delete_own_saved" ON feed_saved_posts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- 4. Backfill: Create profiles for any auth users
--    that don't have one yet (fixes existing accounts)
-- ============================================

INSERT INTO profiles (id, email, full_name)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email)
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

SELECT 'Dream feed fixes applied successfully!' AS message;
