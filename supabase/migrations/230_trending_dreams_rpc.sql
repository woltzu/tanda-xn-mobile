-- ════════════════════════════════════════════════════════════════════════════
-- 230_trending_dreams_rpc.sql
-- View Dream Feed Bucket C.5 — server-side Trending sort
-- ════════════════════════════════════════════════════════════════════════════
--
-- Replaces the client-side "Trending" tab — which used to sort the first
-- 20 fetched posts by likes_count — with a Reddit-style weighted score
-- computed across the full feed_posts table:
--
--   raw_score = likes_count * 2 + support_count * 3 + comments_count * 1
--   age_days  = GREATEST(EXTRACT(EPOCH FROM (now() - created_at)) / 86400, 1)
--   score     = raw_score / age_days
--
-- Supports weights:  cheer = 2, support = 3, comment = 1. Support is
-- weighted highest because it costs money. The 1-day floor on age_days
-- prevents fresh posts from getting an infinite score; older posts decay
-- linearly.
--
-- LIMIT/OFFSET pagination so the existing FlatList onEndReached pattern
-- carries over. The hot 20 reach the client in a single round-trip; the
-- next page fires only if the user scrolls past it.
--
-- SECURITY DEFINER + GRANT EXECUTE to authenticated so the RPC bypasses
-- the per-row RLS on feed_posts (the trending list is intentionally
-- public). The same profile-join shape FeedContext.rowToPost expects is
-- returned via the embedded JSON to keep the client mapping unchanged.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_trending_dreams(
  p_limit  INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id                    UUID,
  user_id               UUID,
  type                  TEXT,
  content               TEXT,
  image_url             TEXT,
  image_upload_status   TEXT,
  amount                NUMERIC,
  currency              TEXT,
  visibility            TEXT,
  related_id            UUID,
  related_type          TEXT,
  metadata              JSONB,
  likes_count           INT,
  comments_count        INT,
  support_count         INT,
  is_auto               BOOLEAN,
  created_at            TIMESTAMPTZ,
  hashtags              TEXT[],
  profiles              JSONB,
  trending_score        NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.id,
    fp.user_id,
    fp.type,
    fp.content,
    fp.image_url,
    fp.image_upload_status,
    fp.amount,
    fp.currency,
    fp.visibility,
    fp.related_id,
    fp.related_type,
    fp.metadata,
    fp.likes_count,
    fp.comments_count,
    fp.support_count,
    fp.is_auto,
    fp.created_at,
    fp.hashtags,
    -- Embed the profile join as JSONB so client-side rowToPost can
    -- pick `profiles.full_name` / `profiles.avatar_url` /
    -- `profiles.xn_score` without a separate query.
    jsonb_build_object(
      'full_name',  p.full_name,
      'avatar_url', p.avatar_url,
      'xn_score',   p.xn_score
    ) AS profiles,
    (
      (fp.likes_count * 2 + fp.support_count * 3 + fp.comments_count * 1)::NUMERIC
      / GREATEST(
          EXTRACT(EPOCH FROM (now() - fp.created_at)) / 86400.0,
          1
        )
    ) AS trending_score
  FROM public.feed_posts fp
  LEFT JOIN public.profiles p ON p.id = fp.user_id
  WHERE fp.type = 'dream'
  ORDER BY trending_score DESC, fp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_dreams(INT, INT) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '230',
  'trending_dreams_rpc',
  ARRAY['-- 230: trending_dreams_rpc']
)
ON CONFLICT (version) DO NOTHING;
