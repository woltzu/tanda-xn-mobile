-- ═══════════════════════════════════════════════════════════════════════════
-- 323_circles_reputation_score_nullable.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- mig 320's ADD COLUMN IF NOT EXISTS was a no-op — a prior "Step 1"
-- version of the reputation feature had already added the column with
-- NOT NULL DEFAULT 0. My RPC (mig 321/322) tried to UPDATE ... SET
-- reputation_score = NULL for 0-cycle circles and hit 23502
-- "null value in column ... violates not-null constraint".
--
-- Fix — drop the NOT NULL. The DEFAULT stays at whatever it was (fine
-- for new rows, but the RPC always writes explicitly so it doesn't
-- matter). Also backfill existing 0-cycle circles to NULL so the
-- "New circle" UI placeholder path renders correctly.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.circles ALTER COLUMN reputation_score DROP NOT NULL;

-- Backfill: 0-cycle circles should have NULL score.
UPDATE public.circles
   SET reputation_score = NULL
 WHERE COALESCE(cycles_completed, 0) = 0
   AND reputation_score IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '323',
  'circles_reputation_score_nullable',
  ARRAY['-- 323: drop NOT NULL on circles.reputation_score + backfill 0-cycle to NULL']
)
ON CONFLICT (version) DO NOTHING;
