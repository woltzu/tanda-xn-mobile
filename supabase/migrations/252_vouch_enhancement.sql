-- ═══════════════════════════════════════════════════════════════════════════
-- 252: Vouch enhancement — Honor backing cap, audit log, revoke, expiry cron
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Builds on Phase 2 Bucket A (migration 248) which introduced vouch_member.
-- This migration:
--   1. Adds profiles.max_backing_cents (derived from honor_score)
--   2. Trigger keeps it in sync on honor_score writes; backfills existing rows
--   3. Creates vouch_audit_log for governance traceability
--   4. REPLACES vouch_member to (a) check the backing cap, (b) log to audit
--   5. Adds revoke_vouch RPC (elder-only soft-expire + audit)
--   6. Adds send_vouch_expiry_notifications + daily cron at 09:00 UTC
--
-- Spec deviations (verified via read-only audit):
--   • Registry insert was INSERT INTO supabase_migrations (...) (wrong
--     table). Corrected to supabase_migrations.schema_migrations.
--   • Spec's vouch_member REPLACE dropped the Bucket A hardcoded tier
--     guard (CHECK on exposure_vouches.temporary_tier would still error,
--     but with a less helpful message). Preserved here.
--   • Spec dropped SET search_path = public, pg_temp from all RPCs (Tier
--     4 hardening). Restored.
--   • revoke_vouch's SELECT ... INTO has no LIMIT — defensive LIMIT 1
--     + ORDER BY created_at DESC added in case multiple active vouches
--     somehow coexist (shouldn't, but guards a silent "too many rows"
--     runtime error).
--   • Audit notes profiles.honor_score max in dev is 200, so the cap is
--     effectively $0 for all current users. Forward-looking schema; cap
--     activates organically as honor accumulates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles.max_backing_cents — derived from honor_score.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS max_backing_cents INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN profiles.max_backing_cents IS
  'Cap on a single vouch backing amount, derived from honor_score by '
  'compute_max_backing(). Kept in sync via tr_profiles_update_max_backing '
  'trigger. Read by vouch_member RPC to enforce the cap.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. compute_max_backing — Honor → cents.
--    Tiers: 900+=$5000, 800+=$2000, 700+=$1000, 600+=$500, else $0.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_max_backing(p_honor_score INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_honor_score IS NULL THEN RETURN 0;
  ELSIF p_honor_score >= 900 THEN RETURN 500000;
  ELSIF p_honor_score >= 800 THEN RETURN 200000;
  ELSIF p_honor_score >= 700 THEN RETURN 100000;
  ELSIF p_honor_score >= 600 THEN RETURN 50000;
  ELSE RETURN 0;
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Trigger + backfill.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_max_backing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.max_backing_cents := compute_max_backing(NEW.honor_score);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_update_max_backing ON profiles;
CREATE TRIGGER tr_profiles_update_max_backing
BEFORE INSERT OR UPDATE OF honor_score ON profiles
FOR EACH ROW EXECUTE FUNCTION update_max_backing();

UPDATE profiles SET max_backing_cents = compute_max_backing(honor_score)
WHERE max_backing_cents IS DISTINCT FROM compute_max_backing(honor_score);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. vouch_audit_log — append-only governance trail.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vouch_audit_log (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id             UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_id            UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action               TEXT         NOT NULL CHECK (action IN ('created','revoked','expired')),
  temporary_tier       TEXT,
  backing_amount_cents INTEGER,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vouch_audit_member ON vouch_audit_log (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vouch_audit_elder ON vouch_audit_log (elder_id, created_at DESC);

-- RLS — public SELECT (members + elders can review the log for their own
-- relationship); writes via SECURITY DEFINER RPCs only.
ALTER TABLE vouch_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vouch_audit_log_select ON vouch_audit_log;
CREATE POLICY vouch_audit_log_select ON vouch_audit_log
  FOR SELECT USING (
    elder_id = auth.uid()
    OR member_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role LIKE 'elder%')
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 5. vouch_member — REPLACE. Adds Honor cap check + audit logging.
--    Preserves Bucket A tier whitelist (matches exposure_vouches.temporary_
--    tier CHECK from migration 247) so the error is meaningful.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vouch_member(
  p_member_id            UUID,
  p_temporary_tier       TEXT,
  p_backing_amount_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elder_id    UUID := auth.uid();
  v_elder_role  TEXT;
  v_max_backing INTEGER;
  v_vouch_id    UUID;
BEGIN
  IF v_elder_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_member_id = v_elder_id THEN
    RAISE EXCEPTION 'Cannot vouch for yourself';
  END IF;

  SELECT role INTO v_elder_role FROM profiles WHERE id = v_elder_id;
  IF v_elder_role IS NULL OR v_elder_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can vouch for members';
  END IF;

  IF p_temporary_tier NOT IN ('newcomer','established','elder','critical') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_temporary_tier;
  END IF;

  IF p_backing_amount_cents IS NULL OR p_backing_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Backing amount must be positive';
  END IF;

  SELECT max_backing_cents INTO v_max_backing FROM profiles WHERE id = v_elder_id;
  IF p_backing_amount_cents > COALESCE(v_max_backing, 0) THEN
    RAISE EXCEPTION 'Backing amount exceeds your limit of $%',
      (COALESCE(v_max_backing, 0) / 100);
  END IF;

  -- Soft-expire any prior active vouch for the same member so this elder
  -- always replaces the prior backing rather than stacking it.
  UPDATE exposure_vouches
  SET expires_at = NOW()
  WHERE member_id = p_member_id AND expires_at > NOW();

  INSERT INTO exposure_vouches (
    elder_id, member_id, temporary_tier, expires_at, backing_amount_cents
  )
  VALUES (
    v_elder_id, p_member_id, p_temporary_tier,
    NOW() + INTERVAL '30 days', p_backing_amount_cents
  )
  RETURNING id INTO v_vouch_id;

  INSERT INTO vouch_audit_log (elder_id, member_id, action, temporary_tier, backing_amount_cents)
  VALUES (v_elder_id, p_member_id, 'created', p_temporary_tier, p_backing_amount_cents);

  RETURN v_vouch_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. revoke_vouch — elder-only soft-expire of the active vouch for a
--    specific member. Captures the snapshot for the audit row BEFORE
--    expiring; LIMIT 1 + ORDER BY guards the SELECT-INTO from a "too many
--    rows" runtime if multiple active vouches somehow coexist.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION revoke_vouch(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elder_id   UUID := auth.uid();
  v_elder_role TEXT;
  v_tier       TEXT;
  v_backing    INTEGER;
BEGIN
  IF v_elder_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_elder_role FROM profiles WHERE id = v_elder_id;
  IF v_elder_role IS NULL OR v_elder_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can revoke vouches';
  END IF;

  SELECT temporary_tier, backing_amount_cents
    INTO v_tier, v_backing
  FROM exposure_vouches
  WHERE member_id = p_member_id AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'No active vouch found for this member';
  END IF;

  UPDATE exposure_vouches
  SET expires_at = NOW()
  WHERE member_id = p_member_id AND expires_at > NOW();

  INSERT INTO vouch_audit_log (elder_id, member_id, action, temporary_tier, backing_amount_cents)
  VALUES (v_elder_id, p_member_id, 'revoked', v_tier, v_backing);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. send_vouch_expiry_notifications — daily T-3 reminder cron.
--    Dedupes via the 7-day "same vouch_id" window so a member doesn't get
--    three pings as the timer counts down. Inserts the English fallback
--    title/body; NotificationPriorityEngine on the client formats the
--    final display text from the type + data jsonb.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION send_vouch_expiry_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v RECORD;
  v_days_left INTEGER;
BEGIN
  FOR v IN
    SELECT
      ev.id, ev.elder_id, ev.member_id, ev.expires_at,
      COALESCE(p1.display_name, p1.full_name, 'an elder') AS elder_name,
      COALESCE(p2.display_name, p2.full_name, 'a member') AS member_name
    FROM exposure_vouches ev
    JOIN profiles p1 ON p1.id = ev.elder_id
    JOIN profiles p2 ON p2.id = ev.member_id
    WHERE ev.expires_at > NOW()
      AND ev.expires_at < NOW() + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = ev.member_id
          AND n.type = 'vouch_expiry_reminder'
          AND n.data->>'vouch_id' = ev.id::text
          AND n.created_at > NOW() - INTERVAL '7 days'
      )
  LOOP
    v_days_left := GREATEST(1, EXTRACT(DAY FROM (v.expires_at - NOW()))::INTEGER);

    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      v.member_id,
      'vouch_expiry_reminder',
      'Your vouch from ' || v.elder_name || ' is expiring soon',
      'Your temporary tier expires in ' || v_days_left || ' day(s). Contact your elder to renew.',
      jsonb_build_object('vouch_id', v.id, 'elder_id', v.elder_id, 'days_left', v_days_left),
      NOW()
    );

    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      v.elder_id,
      'vouch_expiry_reminder',
      'Your vouch for ' || v.member_name || ' is expiring soon',
      'The vouch you gave to ' || v.member_name || ' expires in ' || v_days_left || ' day(s).',
      jsonb_build_object('vouch_id', v.id, 'member_id', v.member_id, 'days_left', v_days_left),
      NOW()
    );
  END LOOP;
END;
$$;

-- Schedule daily at 09:00 UTC. Idempotent via unschedule-then-schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vouch-expiry-reminder') THEN
    PERFORM cron.unschedule('vouch-expiry-reminder');
  END IF;
END $$;

SELECT cron.schedule(
  'vouch-expiry-reminder',
  '0 9 * * *',
  $cron$SELECT send_vouch_expiry_notifications();$cron$
);

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '252',
  'vouch_enhancement',
  ARRAY['-- 252: vouch_enhancement']
)
ON CONFLICT (version) DO NOTHING;
