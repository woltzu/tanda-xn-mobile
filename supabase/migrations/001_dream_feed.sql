-- Dream Feed Tables Migration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/fjqdkyjkwqeoafwvnjgv/sql/new

-- ============================================
-- 1. feed_posts - Core feed table
-- ============================================
CREATE TABLE IF NOT EXISTS feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'dream',
  content text NOT NULL,
  image_url text,
  amount numeric,
  currency text DEFAULT 'USD',
  visibility text NOT NULL DEFAULT 'public',
  related_id text,
  related_type text,
  metadata jsonb DEFAULT '{}',
  likes_count integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  is_auto boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for feed_posts
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_type ON feed_posts(type);
CREATE INDEX IF NOT EXISTS idx_feed_posts_visibility ON feed_posts(visibility);

-- Enable RLS
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_posts
CREATE POLICY "read_public_posts" ON feed_posts FOR SELECT
  USING (visibility = 'public' AND auth.role() = 'authenticated');

CREATE POLICY "read_own_posts" ON feed_posts FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "insert_own_posts" ON feed_posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own_posts" ON feed_posts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "delete_own_posts" ON feed_posts FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 2. feed_likes - Like tracking
-- ============================================
CREATE TABLE IF NOT EXISTS feed_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Indexes for feed_likes
CREATE INDEX IF NOT EXISTS idx_feed_likes_post_id ON feed_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_user_id ON feed_likes(user_id);

-- Enable RLS
ALTER TABLE feed_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_likes
CREATE POLICY "read_likes" ON feed_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "insert_own_likes" ON feed_likes FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own_likes" ON feed_likes FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 3. feed_comments - Comments on posts
-- ============================================
CREATE TABLE IF NOT EXISTS feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for feed_comments
CREATE INDEX IF NOT EXISTS idx_feed_comments_post_id ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_user_id ON feed_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created_at ON feed_comments(created_at DESC);

-- Enable RLS
ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for feed_comments
CREATE POLICY "read_comments" ON feed_comments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "insert_own_comments" ON feed_comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "delete_own_comments" ON feed_comments FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- 4. Helper functions for like/comment counts
-- ============================================

-- Function to increment likes_count
CREATE OR REPLACE FUNCTION increment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feed_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement likes_count
CREATE OR REPLACE FUNCTION decrement_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feed_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment comments_count
CREATE OR REPLACE FUNCTION increment_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feed_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement comments_count
CREATE OR REPLACE FUNCTION decrement_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE feed_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for automatic count updates
CREATE TRIGGER on_like_insert
  AFTER INSERT ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION increment_likes_count();

CREATE TRIGGER on_like_delete
  AFTER DELETE ON feed_likes
  FOR EACH ROW EXECUTE FUNCTION decrement_likes_count();

CREATE TRIGGER on_comment_insert
  AFTER INSERT ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION increment_comments_count();

CREATE TRIGGER on_comment_delete
  AFTER DELETE ON feed_comments
  FOR EACH ROW EXECUTE FUNCTION decrement_comments_count();

-- ============================================
-- 5. Enable realtime for feed_posts
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE feed_posts;
