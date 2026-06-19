-- ════════════════════════════════════════════════════════════════════════════
-- Migration 199: goal_project_location
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2D — adds the project's physical location to user_savings_goals so
-- the staged-disbursement verification flow can geo-gate elder sign-off
-- (default radius 25m).
--
-- Columns are nullable. The geo-gate degrades gracefully when both are
-- NULL — the verification screen renders a "no project pin set" notice
-- and allows the verification without a distance check. Once the goal
-- owner pins the project (in the milestone creation wizard, Phase 2D),
-- subsequent verifications check distance.
--
-- DOUBLE PRECISION over NUMERIC because GPS-grade precision is fine at
-- 8-byte floats and the math (Haversine) is faster than NUMERIC. The
-- pin won't be used for billing or audit-critical math, just gating.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_savings_goals
  ADD COLUMN IF NOT EXISTS project_latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS project_longitude DOUBLE PRECISION;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '199',
  'goal_project_location',
  ARRAY['-- 199: goal_project_location']
)
ON CONFLICT (version) DO NOTHING;
