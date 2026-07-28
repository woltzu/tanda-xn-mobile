-- ═══════════════════════════════════════════════════════════════════════════
-- 376_scoring_admin_controls.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 1 of the scoring admin control surface. Adds:
--
--   1. platform_settings singleton (per Doc 39 §5.4 design). Pre-provisions
--      both scoring-freeze columns (used by this migration) and payouts-
--      pause columns (used by Doc 39 when it lands, so we don't churn the
--      table twice).
--
--   2. set_scoring_freeze(p_frozen, p_reason) admin RPC. Writes the flag
--      + audit row to cron_job_logs so freeze/unfreeze events land in the
--      same log the dashboard reads.
--
--   3. get_scoring_dashboard(p_threshold) admin RPC. Returns a single
--      JSONB payload with three sections: biggest deltas, recent pipeline
--      runs, and current pipeline status.
--
--   4. run_scoring_pipeline() rewrite — freeze check at entry blocks
--      steps 1-7 (returns {skipped: true, ...} before touching any
--      compute or writing scoring_pipeline_runs).
--
--   5. refresh_circle_reputation() rewrite — freeze check as defense in
--      depth for step 8 (the reputation loop the EF runs). Returns
--      {success: true, skipped: true, reason: 'scoring_frozen'} per
--      circle so the EF's loop counter doesn't misread as a failure.
--
-- Companion EF change (scoring-pipeline-daily) checks the return value
-- and bails before step 8. Belt-and-suspenders: even if the EF is not
-- redeployed immediately, refresh_circle_reputation short-circuits at
-- the DB layer.
--
-- Community-admin visibility: platform_settings RLS admits any active
-- admin_users row for SELECT (matching Doc 39 §3.3.2 pattern). The
-- toggle RPC checks role in ('super_admin','platform_admin','admin')
-- — community_admin sees state but cannot mutate.
--
-- xnscore_history sparsity (only 3 rows in last 7 days despite 65 runs)
-- is a documented gap for a follow-up doc, NOT fixed here. The "biggest
-- deltas" query uses xn_scores.previous_score, which IS updated every
-- run and is a reliable last-delta source.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. platform_settings singleton ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id                              INT PRIMARY KEY DEFAULT 1
                                    CHECK (id = 1),
  -- Scoring (this migration)
  scoring_frozen                  BOOLEAN NOT NULL DEFAULT FALSE,
  scoring_frozen_at               TIMESTAMPTZ,
  scoring_frozen_by_admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scoring_frozen_reason           TEXT,
  scoring_alert_threshold         NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  -- Payouts (pre-provisioned per Doc 39 §5.4, unused until Doc 39 ships)
  payouts_paused                  BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_paused_at               TIMESTAMPTZ,
  payouts_paused_by_admin_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payouts_paused_reason           TEXT,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Any active admin (all roles) can read. Community-admin visibility is
-- the same as Doc 39 §3.3.2 — see the state, cannot mutate.
DROP POLICY IF EXISTS platform_settings_read_admin ON public.platform_settings;
CREATE POLICY platform_settings_read_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- No direct writes from any role — all mutations flow through
-- SECURITY DEFINER RPCs below.
DROP POLICY IF EXISTS platform_settings_service ON public.platform_settings;
CREATE POLICY platform_settings_service ON public.platform_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. set_scoring_freeze RPC ────────────────────────────────────────────
-- Admin-only toggle. Freeze needs a reason (≥ 20 chars, mirrors Doc 38).
-- Unfreeze accepts a shorter or null reason (rationale is the fact that
-- the investigation is complete). Writes to platform_settings AND to
-- cron_job_logs so the dashboard's "recent runs" pane surfaces the
-- freeze/unfreeze event inline with actual pipeline runs.
CREATE OR REPLACE FUNCTION public.set_scoring_freeze(
  p_frozen  BOOLEAN,
  p_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin      UUID;
  v_admin_role TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF p_frozen AND (p_reason IS NULL OR length(trim(p_reason)) < 20) THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  UPDATE public.platform_settings
     SET scoring_frozen             = p_frozen,
         scoring_frozen_at          = CASE WHEN p_frozen THEN NOW() ELSE NULL END,
         scoring_frozen_by_admin_id = CASE WHEN p_frozen THEN v_admin ELSE NULL END,
         scoring_frozen_reason      = CASE WHEN p_frozen THEN p_reason ELSE NULL END,
         updated_at                 = NOW()
   WHERE id = 1;

  -- Audit row inside cron_job_logs. status='success' + records_processed=0
  -- lets the existing dashboard queries surface these as their own row
  -- type without a schema change to the enum.
  INSERT INTO public.cron_job_logs (
    job_name, status, records_processed, records_succeeded, records_failed,
    execution_time_ms, details, started_at, completed_at
  )
  VALUES (
    CASE WHEN p_frozen THEN 'admin.scoring_freeze' ELSE 'admin.scoring_unfreeze' END,
    'success', 0, 0, 0, 0,
    jsonb_build_object(
      'admin_user_id', v_admin,
      'frozen',        p_frozen,
      'reason',        p_reason
    ),
    NOW(), NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'frozen',  p_frozen,
    'reason',  p_reason,
    'by',      v_admin,
    'at',      NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_scoring_freeze(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_scoring_freeze(BOOLEAN, TEXT) TO authenticated;

-- ─── 3. get_scoring_dashboard RPC ─────────────────────────────────────────
-- One call, three sections. p_threshold defaults to platform_settings
-- value; callers can pass an explicit value to override for one query.
CREATE OR REPLACE FUNCTION public.get_scoring_dashboard(
  p_threshold NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin     UUID;
  v_settings  RECORD;
  v_threshold NUMERIC;
  v_deltas    JSONB;
  v_runs      JSONB;
  v_status    JSONB;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = v_admin AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1;
  v_threshold := COALESCE(p_threshold, v_settings.scoring_alert_threshold);

  -- Biggest deltas — |total_score - previous_score| >= threshold, top 20.
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.abs_delta DESC), '[]'::jsonb)
    INTO v_deltas
    FROM (
      SELECT
        xs.user_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS display_name,
        xs.total_score,
        xs.previous_score,
        (xs.total_score - xs.previous_score) AS delta,
        ABS(xs.total_score - xs.previous_score) AS abs_delta,
        xs.initial_calculated_at
      FROM public.xn_scores xs
      LEFT JOIN public.profiles  p ON p.id = xs.user_id
      LEFT JOIN auth.users       u ON u.id = xs.user_id
      WHERE xs.previous_score IS NOT NULL
        AND ABS(xs.total_score - xs.previous_score) >= v_threshold
      ORDER BY ABS(xs.total_score - xs.previous_score) DESC
      LIMIT 20
    ) t;

  -- Recent runs — last 10 across scoring pipeline + freeze audit events.
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_runs
    FROM (
      SELECT id, job_name, status, records_processed, records_succeeded,
             records_failed, execution_time_ms, details, error_message, created_at
        FROM public.cron_job_logs
       WHERE job_name IN (
         'scoring-pipeline-daily',
         'admin.scoring_freeze',
         'admin.scoring_unfreeze'
       )
       ORDER BY created_at DESC
       LIMIT 10
    ) t;

  -- Pipeline status.
  v_status := jsonb_build_object(
    'frozen',           v_settings.scoring_frozen,
    'frozen_at',        v_settings.scoring_frozen_at,
    'frozen_by',        v_settings.scoring_frozen_by_admin_id,
    'frozen_by_name',   (SELECT COALESCE(p.full_name, split_part(u.email, '@', 1))
                           FROM auth.users u
                      LEFT JOIN public.profiles p ON p.id = u.id
                          WHERE u.id = v_settings.scoring_frozen_by_admin_id),
    'frozen_reason',    v_settings.scoring_frozen_reason,
    'threshold',        v_settings.scoring_alert_threshold,
    'last_run_at',      (SELECT created_at FROM public.cron_job_logs
                          WHERE job_name = 'scoring-pipeline-daily'
                          ORDER BY created_at DESC LIMIT 1),
    'last_run_status',  (SELECT status FROM public.cron_job_logs
                          WHERE job_name = 'scoring-pipeline-daily'
                          ORDER BY created_at DESC LIMIT 1),
    'cron_schedule',    '0 3 * * *',
    'cron_note',        'Daily at 03:00 UTC (pg_cron scoring-pipeline-daily)'
  );

  RETURN jsonb_build_object(
    'biggest_deltas',  v_deltas,
    'recent_runs',     v_runs,
    'pipeline_status', v_status,
    'threshold_used',  v_threshold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_scoring_dashboard(NUMERIC) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_scoring_dashboard(NUMERIC) TO authenticated;

-- ─── 4. run_scoring_pipeline — freeze check at entry ──────────────────────
-- Body preserved byte-identically from the pre-mig-376 live definition
-- except:
--   * New freeze check at the top. Returns {skipped: true, ...} BEFORE
--     writing scoring_pipeline_runs (no orphan 'running' row on freeze).
--   * Existing behavior otherwise unchanged.
CREATE OR REPLACE FUNCTION public.run_scoring_pipeline()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id UUID;
  v_profiles INTEGER := 0;
  v_defaults INTEGER := 0;
  v_circles INTEGER := 0;
  v_xnscores INTEGER := 0;
  v_alerts INTEGER := 0;
  v_honor INTEGER := 0;
  v_tiers INTEGER := 0;
  v_step_timings JSONB := '{}';
  v_errors JSONB := '[]';
  v_step_start TIMESTAMPTZ;
  v_pipeline_start TIMESTAMPTZ := clock_timestamp();
  v_frozen BOOLEAN;
  v_frozen_by UUID;
  v_frozen_at TIMESTAMPTZ;
  v_frozen_reason TEXT;
BEGIN
  -- ═══ Freeze gate (mig 376) ═══
  SELECT scoring_frozen, scoring_frozen_by_admin_id, scoring_frozen_at, scoring_frozen_reason
    INTO v_frozen, v_frozen_by, v_frozen_at, v_frozen_reason
    FROM public.platform_settings WHERE id = 1;
  IF v_frozen THEN
    RETURN jsonb_build_object(
      'skipped',        TRUE,
      'reason',         'scoring_frozen',
      'frozen_by',      v_frozen_by,
      'frozen_at',      v_frozen_at,
      'frozen_reason',  v_frozen_reason,
      'run_id',         NULL,
      'profiles',       0,
      'default_probs',  0,
      'circles',        0,
      'xnscores',       0,
      'alerts',         0,
      'honor_scores',   0,
      'tiers',          0,
      'duration_ms',    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
      'errors',         '[]'::JSONB
    );
  END IF;

  INSERT INTO scoring_pipeline_runs (run_date, status, started_at)
  VALUES (CURRENT_DATE, 'running', NOW())
  RETURNING id INTO v_run_id;

  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_member_profiles() INTO v_profiles;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'profiles', 'error', SQLERRM);
    v_profiles := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'profiles_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_default_probabilities() INTO v_defaults;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'default_probabilities', 'error', SQLERRM);
    v_defaults := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'default_probs_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_circle_health_scores() INTO v_circles;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'circle_health', 'error', SQLERRM);
    v_circles := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'circle_health_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT recalculate_all_xn_scores() INTO v_xnscores;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'xnscores', 'error', SQLERRM);
    v_xnscores := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'xnscores_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT evaluate_score_alerts() INTO v_alerts;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'alerts', 'error', SQLERRM);
    v_alerts := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'alerts_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT compute_all_honor_scores() INTO v_honor;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'honor_scores', 'error', SQLERRM);
    v_honor := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'honor_scores_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  v_step_start := clock_timestamp();
  BEGIN
    SELECT evaluate_all_member_tiers() INTO v_tiers;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'tiers', 'error', SQLERRM);
    v_tiers := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'tiers_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
  );

  UPDATE scoring_pipeline_runs SET
    profiles_computed = v_profiles,
    default_probs_computed = v_defaults,
    circle_scores_computed = v_circles,
    xnscores_recalculated = v_xnscores,
    alerts_generated = v_alerts,
    honor_scores_computed = v_honor,
    tiers_evaluated = v_tiers,
    step_timings = v_step_timings,
    total_duration_ms = EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    status = CASE
      WHEN v_errors = '[]'::JSONB THEN 'completed'
      WHEN v_profiles + v_defaults + v_circles + v_xnscores + v_honor + v_tiers > 0 THEN 'partial'
      ELSE 'failed'
    END,
    errors = v_errors,
    completed_at = NOW()
  WHERE id = v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'profiles', v_profiles,
    'default_probs', v_defaults,
    'circles', v_circles,
    'xnscores', v_xnscores,
    'alerts', v_alerts,
    'honor_scores', v_honor,
    'tiers', v_tiers,
    'duration_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    'errors', v_errors,
    'skipped', FALSE
  );
END;
$$;

-- ─── 5. refresh_circle_reputation — freeze check at entry ─────────────────
-- Defense in depth for step 8 (called from the scoring-pipeline-daily EF
-- in a per-circle loop). If freeze is active and the EF hasn't been
-- redeployed with the check yet, this makes step 8 a no-op per circle.
-- Returns success:true + skipped:true so the EF's success/fail counter
-- doesn't misread the freeze as a per-circle failure.
--
-- Body preserved byte-identically from live definition except:
--   * New freeze check after the circle_not_found early-return.
--   * Existing behavior otherwise unchanged.
CREATE OR REPLACE FUNCTION public.refresh_circle_reputation(p_circle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_cycles_completed         INT;
  v_total_cycles             INT;
  v_member_count             INT;
  v_initial_median           NUMERIC;
  v_total_expected           NUMERIC;
  v_on_time_count            NUMERIC;
  v_paid_total               NUMERIC;
  v_defaults                 NUMERIC;
  v_very_late                NUMERIC;
  v_late_fee                 NUMERIC;
  v_contribution_reliability NUMERIC;
  v_completion_or_activity   NUMERIC;
  v_default_penalty          NUMERIC;
  v_performance_score        NUMERIC;
  v_prior_weight             NUMERIC;
  v_performance_weight       NUMERIC;
  v_reputation_score         NUMERIC;
  v_frozen                   BOOLEAN;
BEGIN
  SELECT cycles_completed, total_cycles, member_count
    INTO v_cycles_completed, v_total_cycles, v_member_count
    FROM public.circles WHERE id = p_circle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'circle_not_found');
  END IF;

  -- ═══ Freeze gate (mig 376) ═══
  -- Return success + skipped so the EF's per-circle counter doesn't
  -- misread the intentional no-op as a failure.
  SELECT scoring_frozen INTO v_frozen FROM public.platform_settings WHERE id = 1;
  IF v_frozen THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'skipped', TRUE,
      'reason',  'scoring_frozen'
    );
  END IF;

  v_cycles_completed := COALESCE(v_cycles_completed, 0);

  IF v_cycles_completed = 0 THEN
    UPDATE public.circles
       SET reputation_score = NULL, reputation_updated_at = NOW()
     WHERE id = p_circle_id;
    RETURN jsonb_build_object('success', TRUE, 'score', NULL, 'cycles', 0);
  END IF;

  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.xn_score)::NUMERIC
    INTO v_initial_median
    FROM public.circle_members cm
    JOIN public.profiles p ON p.id = cm.user_id
   WHERE cm.circle_id = p_circle_id
     AND cm.status = 'active'
     AND p.xn_score IS NOT NULL;
  v_initial_median := COALESCE(v_initial_median, 50);

  SELECT COALESCE(SUM(expected_contributions), 0)
    INTO v_total_expected
    FROM public.circle_cycles
   WHERE circle_id = p_circle_id
     AND cycle_status IN ('payout_completed', 'closed');

  WITH raw AS (
    SELECT 0 AS pref, cc.user_id, cc.cycle_number,
           cc.status::TEXT AS status, cc.paid_date, cyc.contribution_deadline
      FROM public.circle_contributions cc
      JOIN public.circle_cycles cyc
        ON cyc.circle_id    = cc.circle_id
       AND cyc.cycle_number = cc.cycle_number
     WHERE cc.circle_id = p_circle_id
       AND cc.status IN ('paid','late','missed','waived')
       AND cyc.cycle_status IN ('payout_completed', 'closed')
    UNION ALL
    SELECT 1 AS pref, c.user_id, c.cycle_number,
           c.status::TEXT AS status, c.paid_date, cyc.contribution_deadline
      FROM public.contributions c
      JOIN public.circle_cycles cyc
        ON cyc.circle_id    = c.circle_id
       AND cyc.cycle_number = c.cycle_number
     WHERE c.circle_id = p_circle_id
       AND c.status IN ('paid','late','missed','waived')
       AND cyc.cycle_status IN ('payout_completed', 'closed')
  ),
  deduped AS (
    SELECT DISTINCT ON (user_id, cycle_number)
           status, paid_date, contribution_deadline
      FROM raw
     ORDER BY user_id, cycle_number, pref
  ),
  categorized AS (
    SELECT status,
           CASE
             WHEN paid_date IS NULL OR contribution_deadline IS NULL THEN 'unknown'
             WHEN paid_date <= contribution_deadline + INTERVAL '7 days'  THEN 'on_time'
             WHEN paid_date <= contribution_deadline + INTERVAL '14 days' THEN 'late_fee'
             ELSE 'very_late'
           END AS bucket
      FROM deduped
  )
  SELECT
      COUNT(*) FILTER (WHERE status = 'paid' AND bucket = 'on_time'),
      COUNT(*) FILTER (WHERE status = 'paid'),
      COUNT(*) FILTER (WHERE status = 'missed'),
      COUNT(*) FILTER (WHERE status = 'paid' AND bucket = 'very_late'),
      COUNT(*) FILTER (WHERE status = 'paid' AND bucket = 'late_fee')
    INTO
      v_on_time_count, v_paid_total, v_defaults, v_very_late, v_late_fee
    FROM categorized;

  IF v_total_expected > 0 THEN
    v_contribution_reliability := (v_on_time_count * 100.0 / v_total_expected);
  ELSE
    v_contribution_reliability := 50;
  END IF;

  v_default_penalty := 100
    - COALESCE(v_defaults  * 60.0 / NULLIF(v_defaults + v_paid_total, 0), 0)
    - COALESCE(v_very_late * 20.0 / NULLIF(v_paid_total, 0), 0)
    - COALESCE(v_late_fee  *  4.0 / NULLIF(v_paid_total, 0), 0);
  v_default_penalty := GREATEST(0, LEAST(100, v_default_penalty));

  IF v_total_cycles IS NOT NULL AND v_total_cycles > 0 THEN
    v_completion_or_activity := LEAST(100, v_cycles_completed * 100.0 / v_total_cycles);
  ELSE
    SELECT LEAST(100, COUNT(*) * 100.0 / 4)
      INTO v_completion_or_activity
      FROM public.circle_cycles
     WHERE circle_id = p_circle_id
       AND cycle_status IN ('payout_completed', 'closed')
       AND expected_payout_date >= (NOW() - INTERVAL '12 months');
    v_completion_or_activity := COALESCE(v_completion_or_activity, 50);
  END IF;

  v_performance_score :=
      COALESCE(v_contribution_reliability, 50) * 0.5
    + COALESCE(v_completion_or_activity,   50) * 0.3
    + COALESCE(v_default_penalty,         100) * 0.2;

  v_prior_weight := CASE
    WHEN v_cycles_completed <= 0 THEN 1.0
    WHEN v_cycles_completed  = 1 THEN 0.7
    WHEN v_cycles_completed  = 2 THEN 0.5
    WHEN v_cycles_completed  = 3 THEN 0.3
    ELSE 0.1
  END;
  v_performance_weight := 1.0 - v_prior_weight;

  v_reputation_score := ROUND(
      GREATEST(0, LEAST(100,
          (v_prior_weight       * v_initial_median)
        + (v_performance_weight * v_performance_score)
      )),
      2
  );

  UPDATE public.circles
     SET reputation_score      = v_reputation_score,
         reputation_updated_at = NOW()
   WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'score',   v_reputation_score,
    'cycles',  v_cycles_completed,
    'components', jsonb_build_object(
      'initial_median',           v_initial_median,
      'contribution_reliability', v_contribution_reliability,
      'completion_or_activity',   v_completion_or_activity,
      'default_penalty',          v_default_penalty,
      'performance_score',        v_performance_score,
      'prior_weight',             v_prior_weight,
      'performance_weight',       v_performance_weight,
      'raw_counts', jsonb_build_object(
        'total_expected', v_total_expected,
        'on_time',        v_on_time_count,
        'paid_total',     v_paid_total,
        'defaults',       v_defaults,
        'very_late',      v_very_late,
        'late_fee',       v_late_fee
      )
    )
  );
END;
$$;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '376',
  'scoring_admin_controls',
  ARRAY['-- 376: platform_settings + set_scoring_freeze + get_scoring_dashboard + run_scoring_pipeline freeze gate + refresh_circle_reputation freeze gate']
)
ON CONFLICT (version) DO NOTHING;
