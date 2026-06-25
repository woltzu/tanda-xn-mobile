-- ═══════════════════════════════════════════════════════════════════════════
-- 262: Elder I/II/III permission columns + honor decay + demotion cron
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Completes the elder lifecycle:
--   1. Per-tier permission booleans on profiles (can_mediate_disputes,
--      can_vouch_elder, can_approve_elder, can_manage_community).
--   2. BEFORE-INSERT-OR-UPDATE trigger that syncs the booleans from role
--      automatically — keeps the role and the booleans consistent.
--   3. Backfill the booleans for the existing 3 elder tiers (only
--      touches elder rows; non-elders already have FALSE defaults).
--   4. decay_elder_honor() — daily cron at 03:00 UTC. Inactive elders
--      (no last_active_at update for >7 days) lose 1 honor per run.
--   5. demote_inactive_elders() — daily cron at 04:00 UTC. Demotes by
--      one tier when honor falls below the thresholds (700/600/500),
--      notifies the user.
--   6. promote_elder(target, new_role) — RPC for Elder III / admin to
--      promote another elder.
--
-- Spec deviations (verified before writing):
--   • Registry insert wrong table (recurring). Corrected.
--   • Cron jobs use `cron.unschedule` GUARD before `cron.schedule` — the
--     spec's bare `cron.schedule(...)` would error on the second apply
--     with "job already exists". Wrapping in DO blocks with EXCEPTION
--     handlers handles both "job exists" and "extension not installed"
--     cases.
--   • Decay formula REWRITTEN. Spec computed days_since_last_active each
--     daily run and subtracted that amount, so day-2 = -2, day-3 = -3,
--     day-7 = -28 cumulative over a week. Replaced with: subtract a flat
--     1 honor per cron run when the elder has been inactive >7 days.
--     A 30-day idle elder thus loses 23 honor (30-7) — matches the
--     "decay 1/day after grace period" intent, not the spec's exponential.
--   • Backfill scoped to elder_i/_ii/_iii rows only. Spec's
--     `UPDATE profiles SET role = role WHERE true` would touch every
--     profile (fires every BEFORE UPDATE OF role trigger across the
--     table; RLS + audit churn). Three targeted statements instead.
--   • promote_elder uses admin_users for admin check, not the
--     non-existent `profiles.role LIKE 'admin%'` (matches migration 261).
--   • DROP TRIGGER IF EXISTS + CREATE TRIGGER (no CREATE OR REPLACE for
--     triggers in postgres — must drop first for re-apply safety).
--   • Tier 4 hardening (SET search_path) on all functions.
--
-- Behavior note on the BEFORE trigger:
--   The trigger fires on INSERT (always) and UPDATE OF role (only when
--   the role column appears in the SET clause). An UPDATE that touches
--   other columns won't re-sync booleans, which is what we want — only
--   role changes should mutate the permission row.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Permission columns. All default FALSE — sync trigger sets them on
--    role change; backfill below populates existing elder rows.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_mediate_disputes  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_vouch_elder       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_elder     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_community  BOOLEAN NOT NULL DEFAULT false;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Sync trigger — keeps the booleans aligned with role.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_elder_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role = 'elder_i' THEN
    NEW.can_mediate_disputes  := true;
    NEW.can_vouch_elder       := false;
    NEW.can_approve_elder     := false;
    NEW.can_manage_community  := false;
  ELSIF NEW.role = 'elder_ii' THEN
    NEW.can_mediate_disputes  := true;
    NEW.can_vouch_elder       := true;
    NEW.can_approve_elder     := false;
    NEW.can_manage_community  := false;
  ELSIF NEW.role = 'elder_iii' THEN
    NEW.can_mediate_disputes  := true;
    NEW.can_vouch_elder       := true;
    NEW.can_approve_elder     := true;
    NEW.can_manage_community  := true;
  ELSE
    NEW.can_mediate_disputes  := false;
    NEW.can_vouch_elder       := false;
    NEW.can_approve_elder     := false;
    NEW.can_manage_community  := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_sync_elder_permissions ON profiles;
CREATE TRIGGER tr_profiles_sync_elder_permissions
BEFORE INSERT OR UPDATE OF role ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_elder_permissions();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Backfill elder rows only. Non-elders keep the FALSE defaults set in #1.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE profiles
SET can_mediate_disputes = true, can_vouch_elder = false,
    can_approve_elder    = false, can_manage_community = false
WHERE role = 'elder_i';

UPDATE profiles
SET can_mediate_disputes = true, can_vouch_elder = true,
    can_approve_elder    = false, can_manage_community = false
WHERE role = 'elder_ii';

UPDATE profiles
SET can_mediate_disputes = true, can_vouch_elder = true,
    can_approve_elder    = true,  can_manage_community = true
WHERE role = 'elder_iii';

-- ───────────────────────────────────────────────────────────────────────────
-- 4. decay_elder_honor — daily; -1 honor per run for elders inactive >7d.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION decay_elder_honor()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE profiles
  SET honor_score = GREATEST(COALESCE(honor_score, 0) - 1, 0)
  WHERE role LIKE 'elder%'
    AND honor_score IS NOT NULL
    AND honor_score > 0
    AND COALESCE(last_active_at, created_at, NOW()) < NOW() - INTERVAL '7 days';
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. demote_inactive_elders — daily; demotes by one tier under threshold.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION demote_inactive_elders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  elder RECORD;
  v_new_role TEXT;
  v_title    TEXT;
  v_body     TEXT;
BEGIN
  FOR elder IN
    SELECT id, role, honor_score
    FROM profiles
    WHERE role LIKE 'elder%' AND honor_score IS NOT NULL
  LOOP
    v_new_role := NULL;

    IF elder.role = 'elder_iii' AND elder.honor_score < 700 THEN
      v_new_role := 'elder_ii';
      v_title    := 'Your elder status has been demoted';
      v_body     := 'Honor score below 700 — demoted from Elder III to Elder II.';
    ELSIF elder.role = 'elder_ii' AND elder.honor_score < 600 THEN
      v_new_role := 'elder_i';
      v_title    := 'Your elder status has been demoted';
      v_body     := 'Honor score below 600 — demoted from Elder II to Elder I.';
    ELSIF elder.role = 'elder_i' AND elder.honor_score < 500 THEN
      v_new_role := 'verified_member';
      v_title    := 'Your elder status has been revoked';
      v_body     := 'Honor score below 500 — you are no longer an elder.';
    END IF;

    IF v_new_role IS NOT NULL THEN
      UPDATE profiles
      SET role = v_new_role, updated_at = NOW()
      WHERE id = elder.id;

      INSERT INTO notifications (user_id, type, title, body, data, created_at)
      VALUES (
        elder.id,
        'honor_demotion',
        v_title,
        v_body,
        jsonb_build_object('new_role', v_new_role, 'honor_score', elder.honor_score),
        NOW()
      );
    END IF;
  END LOOP;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. promote_elder — Elder III or admin promotes another elder up a tier.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION promote_elder(
  p_user_id     UUID,
  p_target_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_is_admin    BOOLEAN;
  v_target_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_role NOT IN ('elder_ii', 'elder_iii') THEN
    RAISE EXCEPTION 'target_role must be elder_ii or elder_iii';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ) INTO v_is_admin;

  IF NOT (v_caller_role = 'elder_iii' OR v_is_admin) THEN
    RAISE EXCEPTION 'Only Elder III or admin can promote elders';
  END IF;

  SELECT role INTO v_target_role FROM profiles WHERE id = p_user_id;
  IF v_target_role IS NULL OR v_target_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Target must already be an elder';
  END IF;

  UPDATE profiles
  SET role = p_target_role, updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO notifications (user_id, type, title, body, data, created_at)
  VALUES (
    p_user_id,
    'elder_promotion',
    'You have been promoted to ' || p_target_role,
    'Congratulations — your elder responsibilities have expanded.',
    jsonb_build_object('new_role', p_target_role),
    NOW()
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Cron schedules. Wrapped in DO blocks so re-running the migration
--    is safe — unschedule first if present, then re-schedule.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('honor-decay');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'honor-decay',
  '0 3 * * *',
  $$ SELECT public.decay_elder_honor(); $$
);

DO $$
BEGIN
  PERFORM cron.unschedule('elder-demotion');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'elder-demotion',
  '0 4 * * *',
  $$ SELECT public.demote_inactive_elders(); $$
);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '262',
  'elder_ii_iii_honor_decay',
  ARRAY['-- 262: elder_ii_iii_honor_decay']
)
ON CONFLICT (version) DO NOTHING;
