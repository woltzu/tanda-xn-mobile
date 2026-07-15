-- ═══════════════════════════════════════════════════════════════════════════
-- 336_payment_reliability_autopay_date_cast.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One-line fix to calculate_payment_reliability_factor's autopay branch.
--
-- The manual branch (rewritten in mig 332, refined by mig 334's trigger
-- populating is_on_time) evaluates lateness on dates:
--   COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)
-- with the fallback rarely hit because the trigger sets is_on_time
-- explicitly.
--
-- The autopay branch still uses:
--   paid_at <= due_date::timestamptz
-- Which casts due_date (a date) to midnight of that day (00:00). A
-- payment that lands at 2pm on the due date reads as LATE because
-- 14:00 > 00:00.
--
-- Marcus has 3 autopay rows in prod. All three arrived after their
-- due-date midnight, so all three count as late under the current
-- logic — dragging his on_time_rate from 26/26 (100%, +20 pts) down
-- to 23/26 (88%, ~17.69 pts).
--
-- Fix — compare dates, not timestamps:
--   paid_at::date <= due_date
-- Matches what the mig 334 trigger does for circle_contributions.
--
-- Signature unchanged — CREATE OR REPLACE. Full function body
-- reproduced below so the migration is self-contained (Postgres
-- can't partial-apply a function edit).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_payment_reliability_factor(p_user_id uuid)
RETURNS TABLE(
  total_score           numeric,
  on_time_rate_score    numeric,
  streak_bonus_score    numeric,
  no_defaults_score     numeric,
  late_recovery_score   numeric,
  details               jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_contributions   INTEGER := 0;
    v_on_time_contributions INTEGER := 0;
    v_late_contributions    INTEGER := 0;
    v_late_recovered        INTEGER := 0;
    v_on_time_pct           DECIMAL;
    v_score_record          RECORD;

    v_on_time_rate  DECIMAL := 0;
    v_streak_bonus  DECIMAL := 0;
    v_no_defaults   DECIMAL := 0;
    v_late_recovery DECIMAL := 0;
    v_details       JSONB;

    v_autopay_count INTEGER := 0;
    v_manual_count  INTEGER := 0;
    v_has_score     BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    v_has_score := FOUND;

    WITH unified AS (
        -- Autopay path (enum status). Date-vs-date comparison so a
        -- same-day payment made after midnight isn't counted as late
        -- — matches mig 334's trigger semantics for the manual branch.
        SELECT
            status::text AS status,
            CASE
              WHEN status::text = 'paid' THEN
                (paid_at IS NULL OR paid_at::date <= due_date)
              ELSE FALSE
            END AS was_on_time,
            (status::text = 'late') AS was_late,
            (status::text = 'late' AND paid_at IS NOT NULL) AS late_recovered
        FROM contributions
        WHERE user_id = p_user_id

        UNION ALL

        -- Manual path (text status; no 'late' value — infer lateness
        -- from is_on_time / days_late)
        SELECT
            status,
            CASE
              WHEN status = 'paid' THEN
                COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)
              ELSE FALSE
            END,
            (status = 'paid' AND NOT COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)),
            (status = 'paid' AND NOT COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)
                             AND paid_date IS NOT NULL)
        FROM circle_contributions
        WHERE user_id = p_user_id
    )
    SELECT
        COUNT(*) FILTER (WHERE status IN ('paid', 'late')),
        COUNT(*) FILTER (WHERE was_on_time),
        COUNT(*) FILTER (WHERE was_late),
        COUNT(*) FILTER (WHERE late_recovered)
    INTO v_total_contributions, v_on_time_contributions,
         v_late_contributions, v_late_recovered
    FROM unified;

    SELECT COUNT(*) INTO v_autopay_count
      FROM contributions
     WHERE user_id = p_user_id
       AND status::text IN ('paid', 'late');
    SELECT COUNT(*) INTO v_manual_count
      FROM circle_contributions
     WHERE user_id = p_user_id
       AND status IN ('paid', 'late');

    IF v_total_contributions > 0 THEN
        v_on_time_pct := v_on_time_contributions::DECIMAL / v_total_contributions;
        v_on_time_rate := LEAST(20, v_on_time_pct * 20);
    END IF;

    IF v_has_score THEN
        v_streak_bonus := LEAST(8,
          (LEAST(COALESCE(v_score_record.payment_streak, 0), 20)::DECIMAL / 20) * 8);
    END IF;

    IF v_has_score
       AND NOT COALESCE(v_score_record.has_defaults, FALSE) THEN
        v_no_defaults := 5;
    END IF;

    IF v_late_contributions > 0 AND v_late_recovered > 0 THEN
        v_late_recovery := LEAST(2,
          (v_late_recovered::DECIMAL / v_late_contributions) * 2);
    END IF;

    v_details := jsonb_build_object(
        'total_contributions',   v_total_contributions,
        'autopay_contributions', v_autopay_count,
        'manual_contributions',  v_manual_count,
        'on_time_contributions', v_on_time_contributions,
        'on_time_percentage',    ROUND(COALESCE(v_on_time_pct * 100, 0), 1),
        'current_streak',        COALESCE(v_score_record.payment_streak, 0),
        'best_streak',           COALESCE(v_score_record.best_payment_streak, 0),
        'has_defaults',          COALESCE(v_score_record.has_defaults, FALSE),
        'default_count',         COALESCE(v_score_record.default_count, 0),
        'late_payments',         v_late_contributions,
        'late_recovered',        v_late_recovered
    );

    RETURN QUERY SELECT
        ROUND(v_on_time_rate + v_streak_bonus + v_no_defaults + v_late_recovery, 2),
        ROUND(v_on_time_rate, 2),
        ROUND(v_streak_bonus, 2),
        ROUND(v_no_defaults, 2),
        ROUND(v_late_recovery, 2),
        v_details;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '336',
  'payment_reliability_autopay_date_cast',
  ARRAY['-- 336: autopay branch compares paid_at::date <= due_date instead of timestamptz — matches manual branch']
)
ON CONFLICT (version) DO NOTHING;
