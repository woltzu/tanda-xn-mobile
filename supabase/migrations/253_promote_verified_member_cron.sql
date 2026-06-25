-- ═══════════════════════════════════════════════════════════════════════════
-- 253: Automatic promotion to verified_member (daily cron + audit + notify)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Builds on Phase 2 Bucket A migration 248 which shipped:
--   promote_to_verified_member(p_user_id UUID) RETURNS BOOLEAN
--     SECURITY DEFINER, no auth.uid() requirement — accepts any user
--     id and decides eligibility purely from data (xn_score >= 600,
--     sum of community_memberships.circles_completed >= 1, no
--     has_active_default on any circle_members row). No-ops for users
--     already verified or elder.
--
-- This migration wires it up to run automatically:
--   1. promotion_audit_log — append-only transparency record
--   2. promote_eligible_members() — loops members, calls the RPC, on
--      TRUE (actual promotion) writes an audit row + sends a
--      notification to the user
--   3. pg_cron schedule daily at 02:00 UTC
--
-- Spec deviations (verified via read-only audit before writing):
--   • Spec references profiles.clean_cycles_completed — that column
--     doesn't exist. Not needed: the RPC reads circles_completed from
--     community_memberships (SUM across communities) internally.
--   • Spec's registry insert pattern is wrong (recurring bug). Used
--     the correct supabase_microsations.schema_migrations shape.
--   • Trigger-on-circle-completion option (spec section 2) skipped per
--     user direction ("We'll use the cron approach, simpler, works
--     for all users"). circle_cycles exists but trigger is deferred.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. promotion_audit_log — one row per auto-promotion. Lets us answer
--    "when did X get verified" without re-running the eligibility logic.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotion_audit_log (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_role       TEXT         NOT NULL,
  to_role         TEXT         NOT NULL,
  reason          TEXT,
  triggered_by    TEXT         NOT NULL DEFAULT 'auto_cron'
                               CHECK (triggered_by IN ('auto_cron','manual','elder_vote')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promotion_audit_user ON promotion_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_promotion_audit_created ON promotion_audit_log (created_at DESC);

-- RLS — users read their own audit rows; elders read all. Writes
-- via the SECURITY DEFINER RPC only.
ALTER TABLE promotion_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promotion_audit_log_select ON promotion_audit_log;
CREATE POLICY promotion_audit_log_select ON promotion_audit_log
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role LIKE 'elder%')
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 2. promote_eligible_members — daily scan. Calls the existing
--    promote_to_verified_member RPC for every 'member'-role profile.
--    The RPC returns TRUE iff it actually promoted (xn_score ≥ 600,
--    ≥1 completed circle, no active default). On TRUE we record audit
--    + notification.
--
--    Wrapped per-user in a sub-EXCEPTION block so one bad row doesn't
--    abort the whole cron run.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_eligible_members()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_promoted    BOOLEAN;
  v_count       INTEGER := 0;
BEGIN
  FOR v_user_id IN
    SELECT id FROM profiles WHERE role = 'member'
  LOOP
    BEGIN
      v_promoted := promote_to_verified_member(v_user_id);
      IF v_promoted THEN
        v_count := v_count + 1;

        INSERT INTO promotion_audit_log (user_id, from_role, to_role, reason, triggered_by)
        VALUES (v_user_id, 'member', 'verified_member',
                'xn_score >= 600 AND >=1 completed circle AND no active default',
                'auto_cron');

        INSERT INTO notifications (user_id, type, title, body, data, created_at)
        VALUES (
          v_user_id,
          'role_promotion',
          'You are now a Verified Member',
          'You have completed enough circles to be verified. New features are now available.',
          jsonb_build_object('from_role', 'member', 'to_role', 'verified_member'),
          NOW()
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log and continue — promotion is best-effort, missed rows
      -- get picked up tomorrow.
      RAISE WARNING 'promote_eligible_members: % failed: %', v_user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Schedule daily at 02:00 UTC (low-traffic window, after end-of-day
--    rollups have settled). Idempotent via unschedule-then-schedule.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'promote-eligible-members') THEN
    PERFORM cron.unschedule('promote-eligible-members');
  END IF;
END $$;

SELECT cron.schedule(
  'promote-eligible-members',
  '0 2 * * *',
  $cron$SELECT promote_eligible_members();$cron$
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '253',
  'promote_verified_member_cron',
  ARRAY['-- 253: promote_verified_member_cron']
)
ON CONFLICT (version) DO NOTHING;
