-- ═══════════════════════════════════════════════════════════════════════════
-- 378_scoring_big_delta_alerts.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 2b of the scoring admin controls (Phase 1 = mig 376 freeze/dashboard,
-- Phase 2a = mig 377 admin overrides). Adds big-delta alert fan-out to
-- admins after every pipeline run.
--
-- Placement: new step inserted into run_scoring_pipeline AFTER step 4
-- (recalculate_all_xn_scores) so xn_scores.previous_score is freshly
-- populated — the delta = total_score - previous_score is exactly the
-- change this run made. Placed BEFORE step 5 (evaluate_score_alerts —
-- a distinct per-user alert channel not related to admin visibility).
--
-- Threshold: platform_settings.scoring_alert_threshold (mig 376, default
-- 10.00). Users whose |delta| ≥ threshold trigger an alert.
--
-- Fan-out: one notifications row per (member, admin_recipient) pair for
-- every admin where role IN ('super_admin','platform_admin','admin') AND
-- is_active = TRUE. Prod has 1 active admin today, so worst case ~1
-- notification per big-delta member. Even at 100 members × 10 admins the
-- worst-case is 1000 rows/day — trivial for the notifications table.
--
-- Skipped users:
--   * xn_scores.score_frozen = TRUE (per-user freeze, includes mig 377
--     admin overrides via the freeze flag).
--   * xn_scores.previous_score IS NULL (first-run users have no baseline).
--
-- Dedup: NONE for MVP. If pipeline runs twice in a day (manual invoke),
-- admins see duplicate alerts. Follow-up task if it becomes noise; add a
-- partial UNIQUE index on notifications (user_id, type,
-- (data->>'pipeline_run_id'), (data->>'target_user_id'))
-- WHERE type='admin_score_alert'.
--
-- Notification payload:
--   type  = 'admin_score_alert'
--   title = 'XnScore alert: <member_name>'
--   body  = '<member_name> changed <old>→<new> (Δ<sign><delta>)'
--   data  = { user_id, member_name, old_score, new_score, delta,
--             threshold, pipeline_run_id }
--
-- Also modifies get_scoring_dashboard (mig 376) to add a recent_alerts
-- section (last 10 admin_score_alert rows for the calling admin), so the
-- AdminScoringDashboard UI can show a chronological view alongside the
-- bell.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. run_scoring_pipeline — add alerts step ────────────────────────────
-- Full-body rewrite. Preserves mig 376's freeze gate + step 1-7 shape.
-- New block: computes big deltas and fans out admin notifications after
-- step 4. Returns admin_alerts count in the JSONB.
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
  v_admin_alerts INTEGER := 0;
  v_step_timings JSONB := '{}';
  v_errors JSONB := '[]';
  v_step_start TIMESTAMPTZ;
  v_pipeline_start TIMESTAMPTZ := clock_timestamp();
  v_frozen BOOLEAN;
  v_frozen_by UUID;
  v_frozen_at TIMESTAMPTZ;
  v_frozen_reason TEXT;
  v_threshold NUMERIC(5,2);
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
      'admin_alerts',   0,
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

  -- ═══ Step 4.5 (mig 378): Big-delta admin alert fan-out ═══
  -- Fan out one notification per (member × admin) pair for members whose
  -- last-run delta hit the platform threshold. Wrapped in its own BEGIN
  -- block so a fan-out failure doesn't kill the pipeline run.
  v_step_start := clock_timestamp();
  BEGIN
    SELECT COALESCE(scoring_alert_threshold, 10.00) INTO v_threshold
      FROM public.platform_settings WHERE id = 1;

    WITH candidates AS (
      SELECT
        xs.user_id AS target_user_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS member_name,
        xs.total_score    AS new_score,
        xs.previous_score AS old_score,
        (xs.total_score - xs.previous_score) AS delta
      FROM public.xn_scores xs
      LEFT JOIN public.profiles p ON p.id = xs.user_id
      LEFT JOIN auth.users      u ON u.id = xs.user_id
      WHERE xs.previous_score IS NOT NULL
        AND COALESCE(xs.score_frozen, FALSE) = FALSE
        AND ABS(xs.total_score - xs.previous_score) >= v_threshold
    ),
    admins AS (
      SELECT user_id AS admin_uid
        FROM public.admin_users
       WHERE is_active = TRUE
         AND role IN ('super_admin','platform_admin','admin')
    ),
    fanout AS (
      INSERT INTO public.notifications (
        user_id, type, title, body, data, read, created_at
      )
      SELECT
        a.admin_uid,
        'admin_score_alert',
        'XnScore alert: ' || c.member_name,
        c.member_name || ' changed ' ||
          TO_CHAR(c.old_score, 'FM990.00') || ' → ' ||
          TO_CHAR(c.new_score, 'FM990.00') ||
          ' (' ||
          CASE WHEN c.delta >= 0 THEN 'Δ+' ELSE 'Δ' END ||
          TO_CHAR(c.delta, 'FM990.00') || ')',
        jsonb_build_object(
          'target_user_id',   c.target_user_id,
          'member_name',      c.member_name,
          'old_score',        c.old_score,
          'new_score',        c.new_score,
          'delta',            c.delta,
          'threshold',        v_threshold,
          'pipeline_run_id',  v_run_id
        ),
        FALSE,
        NOW()
      FROM candidates c
      CROSS JOIN admins a
      RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_admin_alerts FROM fanout;
  EXCEPTION WHEN OTHERS THEN
    v_errors := v_errors || jsonb_build_object('step', 'admin_alerts', 'error', SQLERRM);
    v_admin_alerts := 0;
  END;
  v_step_timings := v_step_timings || jsonb_build_object(
    'admin_alerts_ms', EXTRACT(MILLISECONDS FROM clock_timestamp() - v_step_start)::INTEGER
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
    'run_id',        v_run_id,
    'profiles',      v_profiles,
    'default_probs', v_defaults,
    'circles',       v_circles,
    'xnscores',      v_xnscores,
    'alerts',        v_alerts,
    'honor_scores',  v_honor,
    'tiers',         v_tiers,
    'admin_alerts',  v_admin_alerts,
    'duration_ms',   EXTRACT(MILLISECONDS FROM clock_timestamp() - v_pipeline_start)::INTEGER,
    'errors',        v_errors,
    'skipped',       FALSE
  );
END;
$$;

-- ─── 2. get_scoring_dashboard — add recent_alerts section ─────────────────
-- Full-body rewrite. Preserves mig 376's biggest_deltas / recent_runs /
-- pipeline_status. Adds recent_alerts (last 10 admin_score_alert rows
-- for the CALLING admin so each admin sees their own alert stream).
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
  v_alerts    JSONB;
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

  -- NEW in mig 378: per-admin recent alerts. Each admin gets their own
  -- stream since notifications rows are per-user (user_id = admin_uid).
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_alerts
    FROM (
      SELECT id, title, body, data, read, read_at, created_at
        FROM public.notifications
       WHERE type = 'admin_score_alert'
         AND user_id = v_admin
       ORDER BY created_at DESC
       LIMIT 10
    ) t;

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
    'recent_alerts',   v_alerts,
    'pipeline_status', v_status,
    'threshold_used',  v_threshold
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_scoring_dashboard(NUMERIC) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_scoring_dashboard(NUMERIC) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '378',
  'scoring_big_delta_alerts',
  ARRAY['-- 378: run_scoring_pipeline gains step 4.5 (big-delta admin alert fan-out via notifications type=admin_score_alert). get_scoring_dashboard adds recent_alerts section.']
)
ON CONFLICT (version) DO NOTHING;
