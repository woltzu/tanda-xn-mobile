-- ═══════════════════════════════════════════════════════════════════════════
-- 300_goal_milestones_rls_to_user_savings_goals.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: the goal_milestones SELECT policy was still pointing at the legacy
-- public.savings_goals table (0 rows in prod). Every authenticated read
-- against goal_milestones therefore got RLS-denied — the subquery
--     goal_id IN (SELECT id FROM savings_goals WHERE user_id = auth.uid())
-- resolved to an empty set for every caller.
--
-- Second half of the same bug migration 295 fixed on the FK. 295 dropped
-- and re-added the FK to point at user_savings_goals but did NOT rewrite
-- the RLS policy, so the app was inserting milestone rows into the
-- correct table (Trip To Bora Bora has [10] now, Trip To Bali has [10,
-- 25]) but the Milestones screen still rendered "0 of 6 milestones
-- reached" because the SELECT was denied silently before the count
-- ran. Progress bar and total-saved fields didn't need goal_milestones,
-- so they moved correctly — that's why only the milestone strip broke.
--
-- Idempotent DROP + CREATE.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can view own milestones" ON public.goal_milestones;

CREATE POLICY "Users can view own milestones"
  ON public.goal_milestones
  FOR SELECT
  TO authenticated
  USING (
    goal_id IN (
      SELECT id FROM public.user_savings_goals
      WHERE user_id = auth.uid()
    )
  );

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '300',
  'goal_milestones_rls_to_user_savings_goals',
  ARRAY['-- 300: repoint goal_milestones SELECT policy from savings_goals to user_savings_goals']
)
ON CONFLICT (version) DO NOTHING;
