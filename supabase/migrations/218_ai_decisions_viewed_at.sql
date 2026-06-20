-- ════════════════════════════════════════════════════════════════════════════
-- 218_ai_decisions_viewed_at.sql
-- Explainable AI — Bucket B
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds per-decision read-state tracking so the AI Insights screen can:
--   1. Show a "New" pill on insight cards the user has not seen yet
--   2. Dim cards once they've been viewed
--   3. Support an explicit "mark all read" affordance
--
-- viewed_at is set by hooks/useExplainableAI.markDecisionViewed() (auto-fired
-- on card visibility ≥ 2 s or on tap) and markAllViewed() (the future
-- mark-all-read button). Index supports the "first 3 days unviewed" filter
-- the screen uses to choose between "New" and a fade.
--
-- Naming sequence note: 217 is intentionally skipped — reserved for a future
-- audit cleanup migration. Decision-history / Explainable-AI work continues
-- at 218 → 219.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.ai_decisions
  ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ai_decisions_viewed_at
  ON public.ai_decisions (viewed_at);

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '218',
  'ai_decisions_viewed_at',
  ARRAY['-- 218: ai_decisions_viewed_at']
)
ON CONFLICT (version) DO NOTHING;
