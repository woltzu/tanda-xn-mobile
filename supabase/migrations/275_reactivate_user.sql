-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 275: reactivate_user
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin-only RPC to undo a prior suspend_user call. Mirror of the
-- existing suspend_user (which sets users.is_suspended = true) plus the
-- profiles.is_active flip the UI relies on for its suspended/active chip.
--
-- Schema reality check (recon 2026-06-27):
--   * `users.is_suspended` — the column suspend_user actually flips
--   * `profiles.is_active` — the column the AdminUserDetailScreen reads
--     to render the Suspended/Active chip and gate the action button
-- These two columns are NOT kept in sync by any trigger today (verified
-- against pg_trigger), so the pre-existing suspend path silently
-- leaves the UI stuck on "Active". reactivate_user writes BOTH columns
-- so the round-trip ends in a consistent state and the screen reflects
-- the change immediately. Fully fixing the suspend side is out of scope
-- for this bucket — flagged in the commit body.
--
-- Spec deviations (documented in commit body):
--   * Registry insert targets supabase_migrations.schema_migrations
--     (per CLAUDE.md; the spec used the wrong table name).
--   * Pre-state check reads users.is_suspended (truth source) instead
--     of the spec's profiles.status field (which doesn't exist).
--   * Writes both users.is_suspended = false AND profiles.is_active =
--     true (UI consistency; see above).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reactivate_user(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_suspended BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Only admins can reactivate users';
  END IF;

  SELECT is_suspended INTO v_is_suspended FROM users WHERE id = p_user_id;
  IF v_is_suspended IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_is_suspended = false THEN
    RAISE EXCEPTION 'User is not suspended';
  END IF;

  UPDATE users
     SET is_suspended = false, updated_at = NOW()
   WHERE id = p_user_id;

  UPDATE profiles
     SET is_active = true, updated_at = NOW()
   WHERE id = p_user_id;

  PERFORM log_elder_action(
    auth.uid(),
    'reactivate_user',
    p_user_id,
    'profile',
    jsonb_build_object('reason', p_reason)
  );

  INSERT INTO notifications (user_id, type, title, body, data, created_at)
  VALUES (
    p_user_id,
    'account_reactivated',
    'Your account has been reactivated',
    'An admin has reactivated your account. You can now use all features.',
    jsonb_build_object('admin_id', auth.uid(), 'reason', p_reason),
    NOW()
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION reactivate_user(UUID, TEXT) TO authenticated;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '275',
  'reactivate_user',
  ARRAY['-- 275: reactivate_user']
)
ON CONFLICT (version) DO NOTHING;
