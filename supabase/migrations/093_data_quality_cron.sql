-- ════════════════════════════════════════════════════════════════════════════
-- Migration 093: run_data_quality_check RPC for circle_match_history
-- ════════════════════════════════════════════════════════════════════════════
-- Weekly data-quality cron for the ML seed pipeline (migration 052's intent
-- was to ship this; never did). Inspects circle_match_history rows from
-- the last 7 days and writes a metrics row to match_data_quality_logs.
--
-- Real-schema fixes vs original spec:
--   - match_data_quality_logs columns are check_date, period_start,
--     period_end, total_records, records_with_snapshots, records_missing_*,
--     view/join/dismiss/return/share counts, outcomes_pending/labeled/overdue,
--     snapshot_completeness_score, outcome_labeling_score,
--     overall_quality_score, issues JSONB. The spec's proposed columns
--     (log_date, total_rows, missing_fields_count, out_of_range_count)
--     don't exist. Using the real names.
--   - circle_match_history columns are `action` and `circle_id`, NOT
--     `interaction_type` and `recommended_circle_id`.
--
-- Outcomes are considered "overdue" if they've been pending for 60+ days
-- after a 'joined' action (per the engine's labeling cadence).
--
-- Quality scores (0-100):
--   snapshot_completeness_score = % records with both member + circle snapshots
--   outcome_labeling_score      = % joined records with non-pending outcome
--   overall_quality_score       = average of the two
--
-- Issues array surfaces specific problems for the dashboard:
--   - missing_snapshot (count of incomplete records)
--   - overdue_labeling (count of joined records past 60d without outcome)
--   - low_volume (total records < 10)
--   - action_imbalance (when view:other ratio looks unhealthy)
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION run_data_quality_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_period_start DATE := (NOW() - INTERVAL '7 days')::DATE;
  v_period_end DATE := NOW()::DATE;
  v_total INTEGER := 0;
  v_with_snapshots INTEGER := 0;
  v_missing_member INTEGER := 0;
  v_missing_circle INTEGER := 0;
  v_missing_session INTEGER := 0;
  v_views INTEGER := 0;
  v_joins INTEGER := 0;
  v_dismisses INTEGER := 0;
  v_returns INTEGER := 0;
  v_shares INTEGER := 0;
  v_outcomes_pending INTEGER := 0;
  v_outcomes_labeled INTEGER := 0;
  v_outcomes_overdue INTEGER := 0;
  v_snapshot_score INTEGER := 0;
  v_outcome_score INTEGER := 0;
  v_overall_score INTEGER := 0;
  v_issues JSONB := '[]'::jsonb;
  v_log_id UUID;
BEGIN
  -- Volume metrics: rows from the last 7-day window
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE
      member_profile_snapshot IS NOT NULL
        AND member_profile_snapshot <> '{}'::jsonb
        AND circle_profile_snapshot IS NOT NULL
        AND circle_profile_snapshot <> '{}'::jsonb),
    COUNT(*) FILTER (WHERE
      member_profile_snapshot IS NULL OR member_profile_snapshot = '{}'::jsonb),
    COUNT(*) FILTER (WHERE
      circle_profile_snapshot IS NULL OR circle_profile_snapshot = '{}'::jsonb),
    COUNT(*) FILTER (WHERE
      session_context IS NULL OR session_context = '{}'::jsonb),
    COUNT(*) FILTER (WHERE action = 'viewed'),
    COUNT(*) FILTER (WHERE action = 'joined'),
    COUNT(*) FILTER (WHERE action = 'dismissed'),
    COUNT(*) FILTER (WHERE action = 'returned'),
    COUNT(*) FILTER (WHERE action = 'shared')
  INTO
    v_total, v_with_snapshots, v_missing_member, v_missing_circle,
    v_missing_session, v_views, v_joins, v_dismisses, v_returns, v_shares
  FROM circle_match_history
  WHERE created_at >= NOW() - INTERVAL '7 days';

  -- Outcome labeling: only meaningful for joined records (where outcome
  -- makes sense to track). Pending = not labeled. Overdue = pending and
  -- the join was 60+ days ago (typical circle cycle completion).
  SELECT
    COUNT(*) FILTER (WHERE
      action = 'joined'
        AND (outcome_label IS NULL OR outcome_label = 'pending')),
    COUNT(*) FILTER (WHERE
      action = 'joined'
        AND outcome_label IS NOT NULL
        AND outcome_label <> 'pending'),
    COUNT(*) FILTER (WHERE
      action = 'joined'
        AND (outcome_label IS NULL OR outcome_label = 'pending')
        AND created_at < NOW() - INTERVAL '60 days')
  INTO v_outcomes_pending, v_outcomes_labeled, v_outcomes_overdue
  FROM circle_match_history;
  -- Note: this is a LIFETIME calculation, not 7d. Pending outcomes can
  -- live longer than the period window.

  -- Quality scores
  IF v_total > 0 THEN
    v_snapshot_score := ROUND((v_with_snapshots::NUMERIC / v_total) * 100);
  END IF;
  IF (v_outcomes_pending + v_outcomes_labeled) > 0 THEN
    v_outcome_score := ROUND(
      (v_outcomes_labeled::NUMERIC / (v_outcomes_pending + v_outcomes_labeled)) * 100
    );
  END IF;
  v_overall_score := (v_snapshot_score + v_outcome_score) / 2;

  -- Issues array — surface specific findings
  IF v_total < 10 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'low_volume',
      'severity', 'info',
      'message', format('Only %s match history rows in the last 7 days', v_total),
      'count', v_total
    ));
  END IF;
  IF v_missing_member > 0 OR v_missing_circle > 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'missing_snapshot',
      'severity', 'warning',
      'message', format('%s rows missing profile snapshots (%s member, %s circle)',
                        v_missing_member + v_missing_circle,
                        v_missing_member, v_missing_circle),
      'count', v_missing_member + v_missing_circle
    ));
  END IF;
  IF v_missing_session > v_total / 2 AND v_total > 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'missing_session',
      'severity', 'warning',
      'message', format('%s of %s rows missing session_context',
                        v_missing_session, v_total),
      'count', v_missing_session
    ));
  END IF;
  IF v_outcomes_overdue > 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'overdue_labeling',
      'severity', 'critical',
      'message', format('%s joined records pending outcome for 60+ days',
                        v_outcomes_overdue),
      'count', v_outcomes_overdue
    ));
  END IF;
  IF v_views > 100 AND (v_joins + v_dismisses + v_returns + v_shares) = 0 THEN
    v_issues := v_issues || jsonb_build_array(jsonb_build_object(
      'type', 'action_imbalance',
      'severity', 'warning',
      'message', 'Many views but no engagement actions — recommendation quality may be low'
    ));
  END IF;

  INSERT INTO match_data_quality_logs (
    check_date, period_start, period_end,
    total_records, records_with_snapshots,
    records_missing_member_snapshot, records_missing_circle_snapshot,
    records_missing_session_context,
    view_count, join_count, dismiss_count, return_count, share_count,
    outcomes_pending, outcomes_labeled, outcomes_overdue,
    snapshot_completeness_score, outcome_labeling_score,
    overall_quality_score, issues
  ) VALUES (
    CURRENT_DATE, v_period_start, v_period_end,
    v_total, v_with_snapshots,
    v_missing_member, v_missing_circle, v_missing_session,
    v_views, v_joins, v_dismisses, v_returns, v_shares,
    v_outcomes_pending, v_outcomes_labeled, v_outcomes_overdue,
    v_snapshot_score, v_outcome_score, v_overall_score, v_issues
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'total_records', v_total,
    'overall_quality_score', v_overall_score,
    'snapshot_completeness_score', v_snapshot_score,
    'outcome_labeling_score', v_outcome_score,
    'issues_count', jsonb_array_length(v_issues),
    'source', 'run_data_quality_check_rpc'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_data_quality_check() TO service_role;
REVOKE EXECUTE ON FUNCTION public.run_data_quality_check() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('093', 'data_quality_cron',
        ARRAY['-- 093: run_data_quality_check RPC for ML training pipeline'])
ON CONFLICT (version) DO NOTHING;
