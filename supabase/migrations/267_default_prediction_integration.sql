-- ═══════════════════════════════════════════════════════════════════════════
-- 267: Default-prediction integration — auto-create substitute_needed_events
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Daily cron that scans active circle members, computes a risk score
-- from their latest stress + mood signals, and creates a
-- `substitute_needed_events` row + notifies the circle's elders when
-- the score crosses 70.
--
-- Spec deviations (verified read-only before writing):
--
--   * Registry table corrected from spec's bare `supabase_migrations` to
--     `supabase_migrations.schema_migrations`. Recurring spec bug across
--     254 / 257 / 263 / 264 / 265 / 266.
--
--   * member_stress_scores.user_id and member_mood_snapshots.user_id
--     do not exist — the column is `member_id` in both tables (FK →
--     profiles.id). Spec was written against an incorrect column name.
--
--   * compute_risk_score: spec COALESCE(v_mood, 0) means a member with
--     no mood snapshot contributes (100 - 0) * 0.4 = 40 baseline risk
--     before stress. Production currently has 0 rows in
--     member_mood_snapshots, so under the spec every member with
--     stress > 50 would be flagged on first cron run — an inbox flood
--     on day 1. Mood now defaults to 50 (neutral), giving a balanced
--     (100 - 50) * 0.4 = 20 baseline. Documented inline.
--
--   * DO $$ ... EXCEPTION WHEN OTHERS THEN -- ignore … END $$ fails to
--     parse — a bare comment is not a statement after EXCEPTION.
--     Replaced with `NULL;` (same fix as migration 265).
--
--   * Tier 4 hardening: SET search_path = public, pg_temp on all
--     function bodies (already in spec).
--
--   * Notification CHECK constraint — verified: `notifications.type`
--     has NO CHECK constraint in prod, so `'substitute_needed'` will
--     be accepted as-is. No CHECK widen needed.
--
--   * Display-name fallback: COALESCE(display_name, full_name,
--     'A member') so a missing display_name doesn't produce "Member
--     at risk: " with a trailing space.
--
-- Day-1 expectation: zero circles are currently in 'active' status
-- (verified — every circle is 'forming' or 'pending'). The cron will
-- be a no-op until circles transition to 'active'.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. compute_risk_score — weighted blend of stress + inverted mood.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_risk_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stress NUMERIC;
  v_mood   NUMERIC;
  v_score  INTEGER;
BEGIN
  -- Latest stress snapshot for the member. Table column is member_id
  -- (FK → profiles.id), not user_id as the spec assumed.
  SELECT stress_score INTO v_stress
  FROM member_stress_scores
  WHERE member_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Latest mood snapshot. Same renamed column.
  SELECT composite_mood_score INTO v_mood
  FROM member_mood_snapshots
  WHERE member_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Missing-data defaults:
  --   * Stress missing → 0 (no signal = no contribution).
  --   * Mood missing → 50 (neutral baseline). The spec used 0, which
  --     after the (100 - mood) inversion adds 40 baseline risk to
  --     every signal-less member — would flood the alert queue on
  --     day 1 since member_mood_snapshots is empty in prod.
  v_stress := COALESCE(v_stress, 0);
  v_mood   := COALESCE(v_mood, 50);

  -- Weighted blend: stress 60%, inverted mood 40% (high mood → low
  -- risk, hence 100 - mood).
  v_score := (v_stress * 0.6 + (100 - v_mood) * 0.4)::INTEGER;

  RETURN v_score;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. create_substitute_needed_events — daily scan + dedup + elder ping.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_substitute_needed_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member       RECORD;
  v_risk_score   INTEGER;
  v_event_count  INTEGER := 0;
  v_at_risk_name TEXT;
BEGIN
  FOR v_member IN
    SELECT
      cm.user_id    AS member_user_id,
      cm.circle_id  AS member_circle_id,
      c.current_cycle_id AS member_cycle_id
    FROM circle_members cm
    JOIN circles c ON c.id = cm.circle_id
    WHERE cm.status = 'active'
      AND c.status  = 'active'
      AND c.current_cycle_id IS NOT NULL
  LOOP
    v_risk_score := compute_risk_score(v_member.member_user_id);

    -- Threshold guard.
    IF v_risk_score < 70 THEN
      CONTINUE;
    END IF;

    -- Dedup: skip if an open event already exists for the same
    -- (circle, at-risk member, cycle) tuple. Without this the cron
    -- would create a fresh open event every run for a sustained
    -- high-risk member.
    IF EXISTS (
      SELECT 1 FROM substitute_needed_events
      WHERE circle_id       = v_member.member_circle_id
        AND at_risk_user_id = v_member.member_user_id
        AND cycle_id        = v_member.member_cycle_id
        AND status          = 'open'
    ) THEN
      CONTINUE;
    END IF;

    -- Create the event.
    INSERT INTO substitute_needed_events (
      circle_id, at_risk_user_id, cycle_id,
      risk_score, reason, status, created_at
    ) VALUES (
      v_member.member_circle_id,
      v_member.member_user_id,
      v_member.member_cycle_id,
      v_risk_score,
      'Default prediction engine flagged high risk (score '
        || v_risk_score || ')',
      'open',
      NOW()
    );

    v_event_count := v_event_count + 1;

    -- Resolve the at-risk member's display name with fallback so the
    -- notification title doesn't end with "Member at risk: ".
    SELECT COALESCE(display_name, full_name, 'A member')
      INTO v_at_risk_name
      FROM profiles WHERE id = v_member.member_user_id;

    -- Notify every active elder in the circle (all three tiers via
    -- LIKE 'elder%').
    INSERT INTO notifications (
      user_id, type, title, body, data, created_at
    )
    SELECT
      cm.user_id,
      'substitute_needed',
      'Member at risk: ' || v_at_risk_name,
      'A member in your circle has been flagged as high risk. '
        || 'Please consider activating a substitute.',
      jsonb_build_object(
        'circle_id', v_member.member_circle_id,
        'user_id',   v_member.member_user_id
      ),
      NOW()
    FROM circle_members cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.circle_id = v_member.member_circle_id
      AND cm.status    = 'active'
      AND p.role LIKE 'elder%';
  END LOOP;

  RETURN v_event_count;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Cron schedule. Daily at 05:00 UTC. Unschedule-first is idempotent.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('default-prediction-scan');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'default-prediction-scan',
  '0 5 * * *',
  'SELECT create_substitute_needed_events();'
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Self-register.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '267',
  'default_prediction_integration',
  ARRAY['-- 267: default_prediction_integration']
)
ON CONFLICT (version) DO NOTHING;
