-- ═══════════════════════════════════════════════════════════════════════════
-- 293_widen_goal_milestones_check.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: deposits failed with
--   new row for relation "goal_milestones" violates check constraint
--   "goal_milestones_milestone_percent_check"
-- whenever the goal balance first crossed 10% or 90% of target.
--
-- Root cause: three sources of truth were out of sync.
--
--   * DB CHECK constraint (from original schema in
--     lib/tandaxn_complete_schema.sql and confirmed in the 2026-05-20
--     audit dump) — allowed only {25, 50, 75, 100}.
--   * Server-side _record_goal_milestones RPC (migration 078) — inserts
--     for the {10, 25, 50, 75, 90, 100} threshold set.
--   * Client GoalDetailV2Screen.displayMilestones — renders 6 rings for
--     the same {10, 25, 50, 75, 90, 100} set.
--
-- The RPC + client were designed together for 6 milestones. The CHECK
-- was the outlier — a pre-078 relic that nobody widened when 078
-- shipped. Widening the CHECK to match the RPC / client is the
-- minimum-diff fix. No table data has ever contained 10 or 90 (the
-- CHECK rejected them) so there's nothing to backfill.
--
-- Idempotent DROP IF EXISTS + ADD so re-applying the file is safe.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.goal_milestones
  DROP CONSTRAINT IF EXISTS goal_milestones_milestone_percent_check;

ALTER TABLE public.goal_milestones
  ADD CONSTRAINT goal_milestones_milestone_percent_check
  CHECK (milestone_percent = ANY (ARRAY[10, 25, 50, 75, 90, 100]));

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '293',
  'widen_goal_milestones_check',
  ARRAY['-- 293: widen_goal_milestones_check']
)
ON CONFLICT (version) DO NOTHING;
