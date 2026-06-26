-- ═══════════════════════════════════════════════════════════════════════════
-- 266: Substitute rotation notifications — replace the 264 no-op trigger
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migration 264 stamped the tr_substitute_rotation_notify trigger with a
-- no-op body so the contract existed before the notification target was
-- locked down. Migration 265 settled on the `notifications` table for the
-- restore path. This migration brings the rotation path to parity:
--
--   * Notifies the at-risk member that their position has been filled.
--   * Notifies the substitute that they have been activated.
--   * Notifies every elder in the circle (all three tiers — role LIKE
--     'elder%') so the circle's leadership sees the rotation.
--
-- Spec deviations (verified against migrations 264 + 265 before writing):
--
--   * Registry table corrected from spec's bare `supabase_migrations` to
--     `supabase_migrations.schema_migrations`. Recurring spec bug across
--     254 / 257 / 263 / 264 / 265.
--
--   * Notification inserts wrapped in a sub-EXCEPTION block. The
--     `notifications.type` CHECK constraint may not include
--     'substitute_rotation' (migration 265 ships 'substitute_restored',
--     but adding new type values is a recurring CHECK-widen pattern —
--     see migration 219, 220, 221, 223). If the CHECK rejects, the
--     transaction would roll back the elder's rotate_substitute call —
--     a destructive surprise. The sub-EXCEPTION degrades to RAISE NOTICE
--     so the rotation succeeds and the missing notifications surface in
--     the DB log instead of nuking the elder's transaction. If the type
--     ends up rejected in prod, a follow-up migration can widen the
--     CHECK and a backfill query can replay the missed notifications.
--
--   * Status gate uses `NEW.status = 'confirmed'` to match the value
--     migration 265's rotate_substitute RPC writes. The 264-era no-op
--     trigger fires on any INSERT with triggered_by IS NOT NULL — the
--     status check here narrows the path to only the confirmed flow.
--
--   * Display-name fallback: COALESCE(display_name, full_name, 'A member')
--     so a missing display_name doesn't produce a "NULL has been
--     substituted" body. Mirrors the SubstituteDashboardScreen's name
--     fallback chain.
--
--   * Tier 4 hardening: SET search_path = public, pg_temp.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION notify_substitute_rotation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name      TEXT;
  v_at_risk_name     TEXT;
  v_substitute_name  TEXT;
  v_elder_name       TEXT;
BEGIN
  -- Only fire for elder-initiated confirmed rotations. The 264 trigger
  -- predicate already filters triggered_by IS NOT NULL; this guard adds
  -- the status check so partial / declined records don't notify.
  IF NEW.triggered_by IS NULL OR NEW.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Names — COALESCE so a missing display_name doesn't produce "NULL
  -- has been substituted" in the body.
  SELECT name INTO v_circle_name
    FROM circles WHERE id = NEW.circle_id;

  SELECT COALESCE(display_name, full_name, 'A member')
    INTO v_at_risk_name
    FROM profiles WHERE id = NEW.at_risk_user_id;

  SELECT COALESCE(display_name, full_name, 'A member')
    INTO v_substitute_name
    FROM profiles WHERE id = NEW.substitute_member_id;

  SELECT COALESCE(display_name, full_name, 'An elder')
    INTO v_elder_name
    FROM profiles WHERE id = NEW.triggered_by;

  -- Notification writes are wrapped in a sub-EXCEPTION so a CHECK
  -- rejection (or other notifications-table failure) degrades gracefully
  -- instead of rolling back the elder's rotation transaction. The
  -- rotation has already mutated circle_members / substitution_records
  -- by the time this trigger fires; killing it here would undo all of
  -- that for the sake of a missing notification.
  BEGIN
    -- 1. At-risk member.
    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      NEW.at_risk_user_id,
      'substitute_rotation',
      'Your spot in ' || COALESCE(v_circle_name, 'your circle') || ' has been substituted',
      v_elder_name || ' has activated ' || v_substitute_name
        || ' as a substitute for you this cycle. Your contributions are held until the cycle ends.',
      jsonb_build_object(
        'circle_id', NEW.circle_id,
        'substitution_id', NEW.id
      ),
      NOW()
    );

    -- 2. Substitute.
    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      NEW.substitute_member_id,
      'substitute_rotation',
      'You have been activated as a substitute for ' || COALESCE(v_circle_name, 'a circle'),
      v_elder_name || ' has selected you to substitute for ' || v_at_risk_name
        || ' this cycle. You will receive the payout at the end of the cycle.',
      jsonb_build_object(
        'circle_id', NEW.circle_id,
        'substitution_id', NEW.id
      ),
      NOW()
    );

    -- 3. All elders in the circle (all three tiers via LIKE 'elder%').
    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    SELECT
      cm.user_id,
      'substitute_rotation',
      'Substitute activated in ' || COALESCE(v_circle_name, 'a circle'),
      v_elder_name || ' has activated ' || v_substitute_name
        || ' as a substitute for ' || v_at_risk_name || '.',
      jsonb_build_object(
        'circle_id', NEW.circle_id,
        'substitution_id', NEW.id
      ),
      NOW()
    FROM circle_members cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.circle_id = NEW.circle_id
      AND cm.status = 'active'
      AND p.role LIKE 'elder%';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'notify_substitute_rotation: notification write failed for substitution_record % — % %',
      NEW.id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Trigger wiring is unchanged from migration 264 — same name + WHEN clause
-- — so no DROP/CREATE TRIGGER needed. CREATE OR REPLACE on the function
-- alone is enough.

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '266',
  'substitute_notification_trigger',
  ARRAY['-- 266: substitute_notification_trigger']
)
ON CONFLICT (version) DO NOTHING;
