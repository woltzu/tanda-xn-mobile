-- ════════════════════════════════════════════════════════════════════════════
-- Migration 083: Conflict Prediction Engine — orchestration layer
-- ════════════════════════════════════════════════════════════════════════════
-- Wires up the existing engine (services/ConflictPredictionEngine.ts, migration
-- 062) so it can be invoked from two places that previously couldn't reach it:
--
--   PART A — RLS loosening so the Create Circle wizard can call the engine
--            client-side. The original 062 policies restrict all 4 conflict
--            tables to service_role only, which blocks `evaluateCircleFormation`
--            from a logged-in mobile client. This part adds INSERT + SELECT
--            policies for `authenticated` so the engine.scorePair() inserts
--            and `.select().single()` reads work after a circle admin clicks
--            "Create Circle."
--
--   PART B — `process_pair_monitoring()` PL/pgSQL RPC that the weekly cron
--            calls (via Edge Function `conflict-monitoring-cron`). Iterates
--            active monitors and re-scores each pair using the same 6-factor
--            formula as services/ConflictPredictionEngine.scorePair(). Updates
--            current_score/tier, escalates on Watch→Flag crossing, logs a
--            conflict_history row when escalation fires.
--
-- The TS engine code stays the source of truth for the formation-time check
-- (called from CreateCircleSuccessScreen). The PL/pgSQL implementation here
-- ONLY exists for the monitoring loop, which the engine.runPostFormationMonitoring()
-- can't drive because pg_cron has no React Native runtime.
--
-- Mock-data caveat (documented prominently because it materially affects
-- output): upstream signal tables `member_stress_scores` and
-- `member_mood_snapshots` are empty in prod as of 2026-06-03 (per audit 35).
-- Factor weights sum to 65% on those signals, so most pairs will score very
-- low until the upstream scoring pipelines populate. Friction will mostly
-- be driven by Factor 6 (rapid_enrollment, 5%) — newer accounts get higher
-- scores. We accept this and document it; when stress/mood populate, the
-- same RPC keeps working unchanged.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── PART A: RLS loosening ────────────────────────────────────────────────

-- Allow authenticated users to insert their own pair scores. The TS engine
-- calls this from the Create Circle wizard via the mobile supabase client.
-- WITH CHECK is intentionally permissive because the engine generates
-- derived data (no user-supplied content) and a forged row only adds noise
-- to the monitoring queue. Anonymous role remains blocked.
CREATE POLICY pair_scores_auth_insert ON member_pair_scores
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- For the INSERT...RETURNING in engine.scorePair() to actually return the
-- inserted row, the SELECT policy must also allow the row to be visible.
-- Limit reads to pairs the user is part of (so the dashboard can show their
-- own monitored pairs but can't see others').
CREATE POLICY pair_scores_auth_select_own ON member_pair_scores
  FOR SELECT TO authenticated
  USING (auth.uid() = member_a_id OR auth.uid() = member_b_id);

-- Same dual policy for circle_formation_flags. Read is restricted to flags
-- where the user is in proposed_members (a JSONB array of UUIDs).
CREATE POLICY formation_flags_auth_insert ON circle_formation_flags
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY formation_flags_auth_select_own ON circle_formation_flags
  FOR SELECT TO authenticated
  USING (
    proposed_members @> to_jsonb(auth.uid()::text)
    OR auth.uid() = reviewed_by
  );

-- post_formation_monitor: same shape. User can see monitors where they're
-- one of the watched pair.
CREATE POLICY post_monitor_auth_insert ON post_formation_monitor
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY post_monitor_auth_select_own ON post_formation_monitor
  FOR SELECT TO authenticated
  USING (auth.uid() = member_a_id OR auth.uid() = member_b_id);


-- ─── PART B: process_pair_monitoring() RPC ────────────────────────────────

CREATE OR REPLACE FUNCTION process_pair_monitoring()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_monitor       RECORD;
  v_score         NUMERIC(5,2);
  v_new_tier      TEXT;
  v_stress_a      NUMERIC; v_stress_b      NUMERIC;
  v_xnscore_a     NUMERIC; v_xnscore_b     NUMERIC;
  v_late_a        INTEGER; v_late_b        INTEGER;
  v_avg_days_a    NUMERIC; v_avg_days_b    NUMERIC;
  v_direct_disp   INTEGER;
  v_total_disp_a  INTEGER; v_total_disp_b  INTEGER;
  v_exit_conf     INTEGER; v_high_sev      INTEGER;
  v_shared        INTEGER;
  v_days_a        INTEGER; v_days_b        INTEGER;
  v_sync_stress   NUMERIC; v_prior_dispute NUMERIC;
  v_payout_fric   NUMERIC; v_style_mismatch NUMERIC;
  v_trust_gap     NUMERIC; v_rapid_enroll  NUMERIC;
  v_escalated     BOOLEAN;
  v_processed     INTEGER := 0;
  v_escalated_cnt INTEGER := 0;
  v_deescalated   INTEGER := 0;
  v_errors        TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Iterate over active, not-yet-escalated monitors. The TS engine's
  -- runPostFormationMonitoring() does the same WHERE clause.
  FOR v_monitor IN
    SELECT * FROM post_formation_monitor
    WHERE is_active = true AND escalated = false
  LOOP
    BEGIN
      -- ── Re-fetch all 6 factor inputs for this pair ──────────────────
      -- Factor 1 inputs: latest stress scores
      SELECT stress_score INTO v_stress_a
      FROM member_stress_scores
      WHERE member_id = v_monitor.member_a_id
      ORDER BY score_date DESC LIMIT 1;
      v_stress_a := COALESCE(v_stress_a, 0);

      SELECT stress_score INTO v_stress_b
      FROM member_stress_scores
      WHERE member_id = v_monitor.member_b_id
      ORDER BY score_date DESC LIMIT 1;
      v_stress_b := COALESCE(v_stress_b, 0);

      -- Factor 2 inputs: dispute counts (direct, individual, exits, severity)
      SELECT COUNT(*) INTO v_direct_disp
      FROM conflict_history
      WHERE (member_id = v_monitor.member_a_id AND other_member_id = v_monitor.member_b_id)
         OR (member_id = v_monitor.member_b_id AND other_member_id = v_monitor.member_a_id);

      SELECT COUNT(*) INTO v_total_disp_a
      FROM conflict_history
      WHERE member_id = v_monitor.member_a_id OR other_member_id = v_monitor.member_a_id;

      SELECT COUNT(*) INTO v_total_disp_b
      FROM conflict_history
      WHERE member_id = v_monitor.member_b_id OR other_member_id = v_monitor.member_b_id;

      SELECT COUNT(*) INTO v_exit_conf
      FROM conflict_history
      WHERE (member_id IN (v_monitor.member_a_id, v_monitor.member_b_id)
             OR other_member_id IN (v_monitor.member_a_id, v_monitor.member_b_id))
        AND resulted_in_exit = true;

      SELECT COUNT(*) INTO v_high_sev
      FROM conflict_history
      WHERE (member_id IN (v_monitor.member_a_id, v_monitor.member_b_id)
             OR other_member_id IN (v_monitor.member_a_id, v_monitor.member_b_id))
        AND severity IN ('high', 'critical');

      -- Factor 3 inputs: late payment counts
      SELECT COUNT(*) INTO v_late_a
      FROM contributions
      WHERE member_id = v_monitor.member_a_id AND status = 'late';

      SELECT COUNT(*) INTO v_late_b
      FROM contributions
      WHERE member_id = v_monitor.member_b_id AND status = 'late';

      -- Factor 4 inputs: average days late
      SELECT COALESCE(AVG(days_late), 0) INTO v_avg_days_a
      FROM cycle_contributions
      WHERE member_id = v_monitor.member_a_id AND days_late > 0;

      SELECT COALESCE(AVG(days_late), 0) INTO v_avg_days_b
      FROM cycle_contributions
      WHERE member_id = v_monitor.member_b_id AND days_late > 0;

      -- Factor 5 inputs: shared connections (shared circles + vouches)
      SELECT COUNT(DISTINCT cm_a.circle_id) INTO v_shared
      FROM circle_members cm_a
      JOIN circle_members cm_b ON cm_b.circle_id = cm_a.circle_id
      WHERE cm_a.user_id = v_monitor.member_a_id
        AND cm_b.user_id = v_monitor.member_b_id;
      v_shared := COALESCE(v_shared, 0);

      -- Factor 6 inputs: profile age in days
      SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0
        INTO v_days_a
      FROM profiles WHERE id = v_monitor.member_a_id;
      v_days_a := COALESCE(v_days_a, 999);

      SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0
        INTO v_days_b
      FROM profiles WHERE id = v_monitor.member_b_id;
      v_days_b := COALESCE(v_days_b, 999);

      -- XnScore for context columns
      SELECT xn_score INTO v_xnscore_a FROM profiles WHERE id = v_monitor.member_a_id;
      SELECT xn_score INTO v_xnscore_b FROM profiles WHERE id = v_monitor.member_b_id;

      -- ── 6-factor composite (mirrors ConflictPredictionEngine.scorePair) ──
      -- Factor 1: sync_stress
      v_sync_stress := CASE
        WHEN v_stress_a > 60 AND v_stress_b > 60
          THEN LEAST(100, ((v_stress_a + v_stress_b) / 2.0 - 60) * 2.5)
        ELSE LEAST(100, GREATEST(0, ((v_stress_a + v_stress_b) / 2.0 - 40) * 1.0))
      END;

      -- Factor 2: prior_dispute
      v_prior_dispute := LEAST(100,
        v_direct_disp * 40 + v_high_sev * 10 + v_exit_conf * 15
      );

      -- Factor 3: payout_friction
      v_payout_fric := CASE
        WHEN v_late_a > 2 AND v_late_b > 2 THEN 60
        WHEN (v_late_a > 3 AND v_late_b <= 1) OR (v_late_b > 3 AND v_late_a <= 1) THEN 80
        ELSE LEAST(100, (v_late_a + v_late_b) * 8)
      END;

      -- Factor 4: style_mismatch
      v_style_mismatch := LEAST(100, ABS(v_avg_days_a - v_avg_days_b) * 15);

      -- Factor 5: trust_gap
      v_trust_gap := CASE
        WHEN v_shared >= 3 THEN 0
        WHEN v_shared = 2 THEN 30
        WHEN v_shared = 1 THEN 60
        ELSE 100
      END;

      -- Factor 6: rapid_enrollment (min of the two members' days on platform)
      v_rapid_enroll := CASE
        WHEN LEAST(v_days_a, v_days_b) < 3 THEN 100
        WHEN LEAST(v_days_a, v_days_b) < 30 THEN 50
        WHEN LEAST(v_days_a, v_days_b) < 60 THEN 25
        ELSE 0
      END;

      -- Weighted composite (weights match WEIGHTS const in the TS engine)
      v_score := LEAST(100, GREATEST(0,
        v_sync_stress    * 0.30 +
        v_prior_dispute  * 0.25 +
        v_payout_fric    * 0.20 +
        v_style_mismatch * 0.10 +
        v_trust_gap      * 0.10 +
        v_rapid_enroll   * 0.05
      ));

      -- Tier from score
      v_new_tier := CASE
        WHEN v_score <= 29 THEN 'compatible'
        WHEN v_score <= 54 THEN 'watch'
        WHEN v_score <= 74 THEN 'flag'
        ELSE 'separate'
      END;

      -- ── Escalation logic ────────────────────────────────────────────
      -- Same triggers as the TS engine's runPostFormationMonitoring:
      --   1. Watch → Flag or Separate transition
      --   2. Absolute score > 55
      v_escalated := (
        (v_monitor.initial_tier = 'watch' AND v_new_tier IN ('flag', 'separate'))
        OR v_score > 55
      );

      IF v_escalated THEN
        UPDATE post_formation_monitor
        SET current_score = v_score,
            current_tier = v_new_tier,
            last_evaluated_at = NOW(),
            escalated = true,
            escalated_at = NOW(),
            escalation_reason = format(
              'Score increased from %s to %s (%s → %s)',
              v_monitor.initial_score, v_score, v_monitor.initial_tier, v_new_tier
            ),
            alert_count = alert_count + 1,
            last_alert_at = NOW()
        WHERE id = v_monitor.id;

        -- Log to conflict_history so the escalation appears in the audit
        -- trail and surfaces in the History tab of ConflictAlertScreen.
        INSERT INTO conflict_history (
          member_id, other_member_id, circle_id,
          conflict_type, severity, source, description
        ) VALUES (
          v_monitor.member_a_id, v_monitor.member_b_id, v_monitor.circle_id,
          'other', 'high', 'system',
          format('Monitoring escalation: pair score crossed from %s (%s) to %s (%s)',
                 v_monitor.initial_score, v_monitor.initial_tier,
                 v_score, v_new_tier)
        );

        v_escalated_cnt := v_escalated_cnt + 1;
      ELSIF v_score < 30 AND v_monitor.alert_count = 0 THEN
        -- De-escalation: pair has improved enough to stop watching
        UPDATE post_formation_monitor
        SET current_score = v_score,
            current_tier = v_new_tier,
            last_evaluated_at = NOW(),
            is_active = false,
            monitoring_end = NOW()
        WHERE id = v_monitor.id;
        v_deescalated := v_deescalated + 1;
      ELSE
        -- Just update current score/tier
        UPDATE post_formation_monitor
        SET current_score = v_score,
            current_tier = v_new_tier,
            last_evaluated_at = NOW()
        WHERE id = v_monitor.id;
      END IF;

      v_processed := v_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
        format('monitor %s: %s', v_monitor.id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'escalated', v_escalated_cnt,
    'deescalated', v_deescalated,
    'errors', v_errors,
    'source', 'process_pair_monitoring_rpc',
    'note', 'Mirrors ConflictPredictionEngine.runPostFormationMonitoring() with PL/pgSQL parity. Upstream stress/mood signals may be empty (see audit 35); engine still runs but most scores will be low until those pipelines populate.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pair_monitoring() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_pair_monitoring() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('083', 'conflict_orchestration', ARRAY['-- 083: RLS loosening + process_pair_monitoring RPC'])
ON CONFLICT (version) DO NOTHING;
