-- ============================================================================
-- Migration 159: Dream Feed P2 (Automation & Learning)
-- ============================================================================
-- Three pieces, all server-side so the client doesn't need to know how to
-- normalise hashtags or what counts as "supported":
--
--   1. feed_posts.hashtags TEXT[]                     — auto-filled by a
--      BEFORE INSERT / UPDATE trigger that scans `content` for #words.
--      Stored lowercased without the leading '#'. GIN index for cheap
--      "posts tagged X" lookups when the hashtag-search screen lands.
--
--   2. dream_supports(user_id, post_id, ...)          — the table the
--      remind-dream-support cron joins against. One row per support
--      action. UNIQUE(user_id, post_id) so the cron can use a simple
--      LEFT JOIN ... WHERE supports.user_id IS NULL pattern.
--
--   3. Hashtag-extraction logic via a SECURITY DEFINER trigger function
--      that's called on every feed_posts INSERT/UPDATE of content.
--      Idempotent — re-running on the same content produces the same
--      array (dedup + sort).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. feed_posts.hashtags
-- ----------------------------------------------------------------------------
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS hashtags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN for "posts tagged X" queries. The empty-array default matters here
-- because a btree can't index TEXT[] but GIN handles them efficiently.
CREATE INDEX IF NOT EXISTS idx_feed_posts_hashtags
  ON public.feed_posts USING GIN (hashtags);

COMMENT ON COLUMN public.feed_posts.hashtags IS
  'P2: auto-extracted from content via extract_hashtags() trigger. '
  'Stored lowercased, deduped, without the leading "#".';


-- ----------------------------------------------------------------------------
-- 2. extract_hashtags trigger
-- ----------------------------------------------------------------------------
-- Parses content for ASCII #words (letters, digits, underscores). Drops
-- leading '#', lowercases, dedupes, sorts. Empty content → empty array.
-- BEFORE INSERT OR UPDATE so the value lands in the same row write.
CREATE OR REPLACE FUNCTION public.extract_hashtags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_tags TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NEW.content IS NOT NULL AND length(NEW.content) > 0 THEN
    SELECT COALESCE(
      array_agg(DISTINCT lower(substring(m FROM 2)) ORDER BY lower(substring(m FROM 2))),
      ARRAY[]::TEXT[]
    )
      INTO v_tags
      FROM regexp_matches(NEW.content, '#[A-Za-z0-9_]{1,40}', 'g') AS r(matches),
           LATERAL unnest(r.matches) AS m;
  END IF;

  NEW.hashtags := v_tags;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS feed_posts_extract_hashtags ON public.feed_posts;
CREATE TRIGGER feed_posts_extract_hashtags
  BEFORE INSERT OR UPDATE OF content ON public.feed_posts
  FOR EACH ROW EXECUTE FUNCTION public.extract_hashtags();

COMMENT ON FUNCTION public.extract_hashtags IS
  'BEFORE INSERT/UPDATE trigger on feed_posts. Parses content for ASCII '
  '#words, lowercases + dedupes + sorts them, stores in feed_posts.hashtags. '
  'Idempotent: same content → same array.';


-- ----------------------------------------------------------------------------
-- 3. Backfill — populate hashtags for existing rows
-- ----------------------------------------------------------------------------
-- Touches every row once so the GIN index has data from day 0. The
-- trigger fires automatically on the UPDATE.
UPDATE public.feed_posts SET content = content WHERE TRUE;


-- ----------------------------------------------------------------------------
-- 4. dream_supports
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dream_supports (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id            UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  amount_cents       BIGINT NOT NULL CHECK (amount_cents > 0),
  money_transfer_id  UUID,
  message            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_dream_supports_post
  ON public.dream_supports(post_id);
CREATE INDEX IF NOT EXISTS idx_dream_supports_user_created
  ON public.dream_supports(user_id, created_at DESC);

ALTER TABLE public.dream_supports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ds_select_relevant" ON public.dream_supports;
DROP POLICY IF EXISTS "ds_insert_own"      ON public.dream_supports;

-- A supporter sees their own rows; the dream's author sees rows
-- targeting their own post (so they can show a supporter list).
CREATE POLICY "ds_select_relevant"
  ON public.dream_supports FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.feed_posts fp
       WHERE fp.id = dream_supports.post_id
         AND fp.user_id = auth.uid()
    )
  );

-- Supporters insert their own row. The supported amount comes from the
-- money_transfers row that the SupportDreamScreen creates; this table
-- is the post-side anchor for the cron to join against.
CREATE POLICY "ds_insert_own"
  ON public.dream_supports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.dream_supports IS
  'One row per (supporter, dream). Anchors the remind-dream-support cron '
  'so engagement (likes/comments) without support can be detected via a '
  'LEFT JOIN. The actual money movement still lives in money_transfers; '
  'money_transfer_id back-references it for an audit join.';


-- ----------------------------------------------------------------------------
-- 5. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '159',
  'dream_feed_p2',
  ARRAY['-- 159: feed_posts.hashtags + extract_hashtags trigger + dream_supports']
)
ON CONFLICT (version) DO NOTHING;
