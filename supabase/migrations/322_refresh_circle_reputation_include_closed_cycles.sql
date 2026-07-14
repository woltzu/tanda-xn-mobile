-- ═══════════════════════════════════════════════════════════════════════════
-- 322_refresh_circle_reputation_include_closed_cycles.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to 321. First test run against Test Circle Payout 5 (2
-- completed cycles, both members paid) returned raw_counts all zero —
-- the filter `cyc.cycle_status = 'payout_completed'` matched no rows.
--
-- Reason: cycle-progression-cron transitions the state machine as
-- collecting → deadline_reached/grace_period → ready_payout →
-- payout_completed → **closed**. `payout_completed` is a fleeting
-- intermediate; once the next hourly tick sees it, the cron flips
-- to `closed` (see the case at cycle-progression-cron/index.ts:184).
-- Every cycle that actually distributed money has already moved to
-- `closed`. Cycles stuck in `payout_completed` are ones the cron
-- hasn't visited yet — a tiny live window.
--
-- Fix: filter on both `payout_completed` AND `closed`. Explicitly
-- exclude `payout_pending` (payout attempted but failed — no money
-- moved, shouldn't count for reputation).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.refresh_circle_reputation(p_circle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
BEGIN
  SELECT cycles_completed, total_cycles, member_count
    INTO v_cycles_completed, v_total_cycles, v_member_count
    FROM public.circles WHERE id = p_circle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'circle_not_found');
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

  -- Total expected contributions — from cycles that actually paid out.
  SELECT COALESCE(SUM(expected_contributions), 0)
    INTO v_total_expected
    FROM public.circle_cycles
   WHERE circle_id = p_circle_id
     AND cycle_status IN ('payout_completed', 'closed');

  -- Per-contribution aggregates, dedupe by (user_id, cycle_number).
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
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '322',
  'refresh_circle_reputation_include_closed_cycles',
  ARRAY['-- 322: reputation reads from cycle_status IN (payout_completed, closed)']
)
ON CONFLICT (version) DO NOTHING;
