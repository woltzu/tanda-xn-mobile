-- ═══════════════════════════════════════════════════════════════════════════
-- 295_goal_milestones_fk_to_user_savings_goals.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: goal_milestones has been unusable since day one because its
--   goal_id FK points to a legacy public.savings_goals table
--   (0 rows in prod), while the app writes every goal to
--   public.user_savings_goals. Every _record_goal_milestones INSERT has
--   failed with
--     23503: insert or update on table "goal_milestones" violates
--     foreign key constraint "goal_milestones_goal_id_fkey"
--   for the entire history of the app.
--
-- Why nobody noticed until now:
--   * Pre-293 the CHECK constraint on milestone_percent rejected 10 and
--     90 before the FK check fired, so users only saw the CHECK error
--     on deposits that crossed 10%.
--   * Migration 293 widened the CHECK to accept {10,25,50,75,90,100},
--     but the FK error immediately took over.
--   * Migration 294 wrapped _record_goal_milestones in an outer
--     EXCEPTION block for deposit-bulletproofing. That IS the correct
--     behaviour — deposits should never fail on a celebration side
--     effect — but it also converted the FK error from "loud crash on
--     every deposit" to "silently swallowed", which is why the Home
--     feed + goal_milestones + Milestones screen have all been showing
--     stale/empty data.
--
-- Fix in three parts:
--   1. Drop the wrong FK.
--   2. Add a fresh FK targeting user_savings_goals (the table the app
--      actually writes to). ON DELETE CASCADE mirrors the existing FK
--      behaviour.
--   3. Backfill: PERFORM _record_goal_milestones for every existing
--      goal so the current balance produces the milestone rows +
--      trigger side-effects (community feed post, notification,
--      Home-feed wallet_transactions row) that never landed. Idempotent
--      by construction — _record_goal_milestones uses ON CONFLICT DO
--      NOTHING on the UNIQUE (goal_id, milestone_percent), and the
--      three trigger functions each carry their own EXCEPTION handlers
--      so a slow feed insert can't stall the backfill.
--
-- Optional cleanup out of scope for this migration: the empty legacy
-- savings_goals table can be dropped once we confirm no other object
-- still references it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Drop the misaligned FK ─────────────────────────────────────────────
ALTER TABLE public.goal_milestones
  DROP CONSTRAINT IF EXISTS goal_milestones_goal_id_fkey;

-- ─── 2. Add the correct FK ─────────────────────────────────────────────────
ALTER TABLE public.goal_milestones
  ADD CONSTRAINT goal_milestones_goal_id_fkey
  FOREIGN KEY (goal_id)
  REFERENCES public.user_savings_goals(id)
  ON DELETE CASCADE;

-- ─── 3. Backfill missing milestone rows for every existing goal ────────────
-- Replays the helper for every goal so:
--   * every threshold currently below the balance produces a
--     goal_milestones row (via ON CONFLICT DO NOTHING),
--   * the three AFTER-INSERT triggers fire once per new row and populate
--     the community feed, the notifications queue, and the Home
--     activity feed (wallet_transactions),
--   * goals that already crossed 100% get flipped to goal_status
--     'completed' if they weren't already.
--
-- The helper's outer EXCEPTION block means one broken goal can't stall
-- the loop for the rest.
DO $$
DECLARE
  v_goal_id UUID;
BEGIN
  FOR v_goal_id IN
    SELECT id FROM public.user_savings_goals
    WHERE target_amount_cents > 0
      AND current_balance_cents > 0
  LOOP
    PERFORM public._record_goal_milestones(v_goal_id);
  END LOOP;
END $$;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '295',
  'goal_milestones_fk_to_user_savings_goals',
  ARRAY['-- 295: repoint goal_milestones.goal_id FK from savings_goals to user_savings_goals + backfill']
)
ON CONFLICT (version) DO NOTHING;
