-- ═══════════════════════════════════════════════════════════════════════════
-- 320_add_circle_reputation_score.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 37 v3 — Circle Reputation. Add the two columns that mig 321's
-- refresh_circle_reputation RPC writes to.
--
-- NULL semantics: a circle with 0 completed cycles keeps reputation_score
-- NULL forever (until it completes its first cycle). The UI renders
-- NULL as "New circle — complete this circle to earn a reputation
-- score" per the existing CircleDetailScreen card. Only circles with
-- ≥ 1 completed cycle carry a numeric score.
--
-- DECIMAL(5,2) is intentional — scores are 0–100 so max meaningful
-- value is 100.00; the 5-digit precision leaves room for a tiny buffer
-- without silently rounding at 99.99.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS reputation_score DECIMAL(5,2);
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS reputation_updated_at TIMESTAMPTZ;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '320',
  'add_circle_reputation_score',
  ARRAY['-- 320: circles.reputation_score + reputation_updated_at (Doc 37 v3)']
)
ON CONFLICT (version) DO NOTHING;
