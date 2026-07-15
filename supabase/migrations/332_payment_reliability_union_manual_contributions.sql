-- ═══════════════════════════════════════════════════════════════════════════
-- 332_payment_reliability_union_manual_contributions.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to mig 330. That migration fixed the enum bug in
-- calculate_payment_reliability_factor, but the RPC still reads ONLY from
-- the `contributions` table (autopay path). Real user contributions flow
-- through `circle_contributions` (manual path).
--
-- Prod data snapshot (2026-07-15):
--   contributions        : 3 rows  ← what the RPC currently sees
--   circle_contributions : 44 rows ← 94% of activity, invisible to RPC
--
-- Every user's payment_reliability sits at 0 because the RPC finds no
-- rows in `contributions` for them and never looks at
-- `circle_contributions`.
--
-- Fix — rewrite the count query to UNION both tables into a normalized
-- CTE and compute the same 4 numbers (total, on_time, late,
-- late_recovered) across the union. Score shape unchanged, so no
-- downstream reader needs to know.
--
-- Schema notes surfaced during investigation:
--   * contributions.status is enum contribution_status
--     (pending/paid/late/missed/waived/refunded); paid_at is timestamptz.
--   * circle_contributions.status is text; ONLY 'paid' and 'refunded'
--     appear in the wild — no explicit 'late' value. Lateness lives on
--     is_on_time boolean and days_late integer. paid_date is timestamptz.
--   * Refunded rows are excluded from the total (they cancel out).
--
-- Also fixed two pre-existing bugs in the same RPC surfaced by the first
-- verification run against real data:
--
--   * `v_score_record IS NOT NULL` on a partial-null record returns FALSE
--     in PL/pgSQL — row-wise IS NOT NULL requires *every* field non-null.
--     xn_scores has ~17 nullable timestamp columns that are NULL on any
--     row that hasn't yet had its first review/tenure check/etc. Effect:
--     no_defaults (+5) and streak_bonus (+0-8) were dead code for every
--     user. Fix: use `FOUND` after the SELECT INTO instead.
--
--   * was_late for the manual branch defaulted to "not late" when
--     is_on_time IS NULL, even when paid_date > due_date. Effect: every
--     truly-late manual payment was counted as neither on-time nor late,
--     silently dropping it from both the on_time_rate numerator and the
--     late_recovery bonus. Fix: fall through to the paid_date/due_date
--     comparison, matching the was_on_time branch.
--
-- Signature unchanged, so CREATE OR REPLACE (no DROP needed).
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
    v_has_score := FOUND;  -- reliable existence check; record IS NOT NULL fails on partial-null rows

    -- Unified view: both autopay (`contributions`) and manual
    -- (`circle_contributions`) into one row shape so downstream FILTERs
    -- see every payment.
    WITH unified AS (
        -- Autopay path (enum status)
        SELECT
            status::text AS status,
            CASE
              WHEN status::text = 'paid' THEN
                (paid_at IS NULL OR paid_at <= due_date::timestamptz)
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
            -- Late = paid but NOT on-time. Mirrors the was_on_time
            -- COALESCE chain so is_on_time IS NULL doesn't silently
            -- drop truly-late rows (paid_date > due_date).
            (status = 'paid' AND NOT COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)),
            -- Late recovered = paid AND late AND has payment record
            -- (always the case here since circle_contributions rows are
            -- only inserted when a payment happens).
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

    -- Per-source breakdown for details / debugging visibility.
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
  '332',
  'payment_reliability_union_manual_contributions',
  ARRAY['-- 332: payment reliability RPC UNIONs contributions + circle_contributions']
)
ON CONFLICT (version) DO NOTHING;
