-- ════════════════════════════════════════════════════════════════════════════
-- 229_dream_support_count.sql
-- View Dream Feed Bucket A.3 — surface dream_supports count on feed_posts
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds a trigger-maintained `support_count` column to feed_posts so the
-- client can render "{n} supporters" without a per-post COUNT query.
-- Mirrors the shape of the existing `likes_count` / `comments_count`
-- columns that other triggers maintain.
--
-- One-time backfill at the bottom seeds existing rows from the live
-- dream_supports table. Re-runs are safe: ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS / CREATE TRIGGER,
-- and the backfill UPDATE is idempotent (always recomputes from the
-- source of truth).
--
-- Trigger fires on INSERT and DELETE (UPDATE doesn't make sense for
-- dream_supports — there's no support-state column to flip). On DELETE
-- the row may have already been removed by an ON DELETE CASCADE from
-- feed_posts; the UPDATE just no-ops in that case (WHERE matches zero
-- rows), no need for a special guard.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS support_count INT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.update_dream_support_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feed_posts
       SET support_count = support_count + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- post may already be gone via ON DELETE CASCADE; the UPDATE will
    -- match zero rows and the trigger exits cleanly.
    UPDATE public.feed_posts
       SET support_count = GREATEST(support_count - 1, 0)
     WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[update_dream_support_count] failed: %', SQLERRM;
  -- Don't fail the dream_supports write because the count side-effect
  -- erred. The backfill at deploy time can recover any drift.
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS dream_support_count_insert ON public.dream_supports;
CREATE TRIGGER dream_support_count_insert
AFTER INSERT ON public.dream_supports
FOR EACH ROW
EXECUTE FUNCTION public.update_dream_support_count();

DROP TRIGGER IF EXISTS dream_support_count_delete ON public.dream_supports;
CREATE TRIGGER dream_support_count_delete
AFTER DELETE ON public.dream_supports
FOR EACH ROW
EXECUTE FUNCTION public.update_dream_support_count();

-- One-time backfill. Always recomputes from the source of truth so
-- re-applying this migration corrects any drift introduced by a
-- prior trigger outage.
UPDATE public.feed_posts fp
   SET support_count = sub.cnt
  FROM (
    SELECT post_id, COUNT(*) AS cnt
      FROM public.dream_supports
     GROUP BY post_id
  ) sub
 WHERE fp.id = sub.post_id;

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '229',
  'dream_support_count',
  ARRAY['-- 229: dream_support_count']
)
ON CONFLICT (version) DO NOTHING;
