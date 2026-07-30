-- ═══════════════════════════════════════════════════════════════════════════
-- 396_savings_behavior_factor.sql
--
-- Adds savings behavior as a 6th XnScore factor (10 pts). Rebalances
-- financial_behavior so its total stays at 15. Snapshots every user's
-- pre-mig score for the 30-day transparency panel + 60-day grandfathering
-- floor (only users whose new score is LOWER get grandfathered — users
-- who gain get the gain immediately).
--
-- Prerequisites (must be live BEFORE this mig):
--   ✅ 396c — vouch reciprocity + voucher-bonus cap (closes vouch-farming
--          vector before we amplify the incentive to farm).
--   ✅ 396a — savings ledger prep (CHECK on transaction_type + indexes +
--          wallet_transactions row on transfer_from_goal — gives the
--          anti-gaming logic below real ledger data to work with).
--
-- Follow-up (must ship before rollout completes):
--   □  396b — scoring engine hardening (Vectors 5,6,10,13,16). Extends
--          the grandfathering window by another 60 days when it lands so
--          users get one continuous protection period across both mig
--          score changes.
--
-- Order of operations INSIDE this migration (matters — do not reorder):
--   1. Create snapshot table.
--   2. Add xn_scores columns (savings_score, grandfathered_score,
--      grandfather_expires_at).
--   3. Snapshot every user's CURRENT total_score + factor_scores BEFORE
--      any RPC changes. This is the pre-mig baseline the grandfather
--      floor compares against.
--   4. Rewrite get_xnscore_age_cap for the 110-pt total (linear 1.10x
--      of the current caps, rounded).
--   5. Create calculate_savings_behavior_factor (new 10-pt factor with
--      the anti-gaming safeguards: net-consistency threshold, wash-
--      rebate subtraction, sustained-balance time-weighted, weighted
--      goals with 30-day min + category cap).
--   6. Rewrite calculate_financial_behavior_factor — remove the 4-pt
--      binary savings_score, rebalance wallet 6→8 + retention 5→7 so
--      the total stays at 15. Keep savings_score in the return signature
--      (set to 0) for backward compat with admin surfaces that read it.
--   7. Rewrite recalculate_full_xnscore — add savings to the sum + JSONB,
--      apply grandfather floor at the end.
--   8. Run recalculate_all_xn_scores inline. Prod has ~13 xn_scores rows
--      per prior probe, so the loop is instantaneous. Users with
--      score_frozen=TRUE are skipped by the loop's own gate (no
--      grandfathering needed for them either — their score wasn't going
--      to change anyway).
--   9. Populate grandfathering ONLY for users whose new score is LOWER.
--      Users who gained (new > pre) get the gain immediately.
--  10. Self-register.
--
-- Deliberately NOT in this migration:
--   • No client-side transparency-panel UI. That's separate (a screen
--     tab reading xnscore_pre_savings_snapshot for 30 days post-rollout).
--   • No comms notification. That's a one-shot SQL fired 7 days before
--     THIS migration lands — ideally by a human on a schedule; if we
--     ship this without that comms window, users get the change
--     unannounced.
--   • No expire-xnscore-grandfathering EF. Small housekeeping cron
--     that clears expired columns once the window closes — build after
--     mig 396b lands and the extended window is set.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Snapshot table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS xnscore_pre_savings_snapshot (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pre_total_score   NUMERIC NOT NULL,
  pre_factor_scores JSONB   NOT NULL,
  snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE xnscore_pre_savings_snapshot IS
  'mig 396: one row per user, snapshotting total_score + factor_scores '
  'JUST BEFORE the savings-factor recalc ran. Drives the 30-day '
  'transparency panel (score-change preview) and the grandfathering '
  'floor comparison. Rows persist beyond the 30-day window for audit.';

-- ─── 2. xn_scores columns for savings + grandfathering ───────────────────
ALTER TABLE xn_scores
  ADD COLUMN IF NOT EXISTS savings_score            NUMERIC(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grandfathered_score      NUMERIC,
  ADD COLUMN IF NOT EXISTS grandfather_expires_at   TIMESTAMPTZ;

COMMENT ON COLUMN xn_scores.savings_score IS
  'mig 396: savings behavior factor (0-10 pts). Populated by '
  'recalculate_full_xnscore from calculate_savings_behavior_factor.';
COMMENT ON COLUMN xn_scores.grandfathered_score IS
  'mig 396: floor value applied to total_score while grandfather window '
  'is active. Set only for users whose new score is LOWER than their '
  'pre-mig baseline.';
COMMENT ON COLUMN xn_scores.grandfather_expires_at IS
  'mig 396: timestamp when the grandfather floor stops applying. Set '
  'to NOW()+60d at mig 396 apply time; extended by mig 396b to '
  'MAX(existing, NOW()+60d) so users get one continuous window covering '
  'both score changes.';

-- ─── 3. Snapshot BEFORE any RPC changes ──────────────────────────────────
-- Idempotent: ON CONFLICT DO NOTHING so re-running the migration in a
-- recovery scenario doesn't overwrite the original baseline.
INSERT INTO xnscore_pre_savings_snapshot (user_id, pre_total_score, pre_factor_scores)
SELECT user_id, total_score, COALESCE(factor_scores, '{}'::jsonb)
  FROM xn_scores
ON CONFLICT (user_id) DO NOTHING;

-- ─── 4. Age cap scaled to 110-pt total ───────────────────────────────────
-- Linear 1.10x of the current caps, rounded to nearest integer. Preserves
-- the semantic (probation ≈ 40% of max, veteran ≈ 90%, full trust = 100%).
CREATE OR REPLACE FUNCTION public.get_xnscore_age_cap(account_age_days integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    RETURN CASE
        WHEN account_age_days <  30  THEN  44   -- Probation
        WHEN account_age_days <  90  THEN  61   -- Building trust
        WHEN account_age_days < 180  THEN  77   -- Established
        WHEN account_age_days < 365  THEN  94   -- Trusted
        WHEN account_age_days < 548  THEN  99   -- Veteran
        WHEN account_age_days < 730  THEN 105   -- Advanced
        ELSE                              110   -- Full trust (24+ months)
    END;
END;
$function$;

-- ─── 5. calculate_savings_behavior_factor — new 10-pt factor ─────────────
-- Sub-components (4+3+2+1 = 10):
--   • consistency (4): months in last 12 where net deposits ≥ threshold.
--     Threshold = GREATEST($10, 0.10 × median active-circle amount).
--   • net inflow (3): 6-month deposits minus rebound deposits (a deposit
--     within 30 days after a withdrawal of ≥80% of the deposit amount).
--     Log-scaled: LN(1 + net_dollars) / LN(1001) * 3.
--   • sustained balance (2): time-weighted average balance across all
--     user's savings goals over last 6 months. Log-scaled same as above.
--   • weighted goals (1): achieved goals with ≥30-day lifespan, weighted
--     by LN(1 + amount) × time_bonus, capped per unique category, total
--     capped at 1.
CREATE OR REPLACE FUNCTION public.calculate_savings_behavior_factor(p_user_id uuid)
RETURNS TABLE(
  total_score               NUMERIC,
  consistency_score         NUMERIC,
  net_inflow_score          NUMERIC,
  sustained_balance_score   NUMERIC,
  weighted_goals_score      NUMERIC,
  details                   JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_threshold_dollars   NUMERIC;
  v_median_circle       NUMERIC;
  v_qualifying_months   INT := 0;
  v_deposits_dollars    NUMERIC := 0;
  v_rebound_dollars     NUMERIC := 0;
  v_net_inflow_dollars  NUMERIC := 0;
  v_avg_balance_dollars NUMERIC := 0;
  v_weighted_goals_pts  NUMERIC := 0;

  v_consistency_pts     NUMERIC := 0;
  v_inflow_pts          NUMERIC := 0;
  v_sustained_pts       NUMERIC := 0;
  v_goals_pts           NUMERIC := 0;

  v_window_start        TIMESTAMPTZ := NOW() - INTERVAL '6 months';
  v_details             JSONB;
BEGIN
  -- ── Threshold: floor $10, else 10% of median active-circle amount ──
  SELECT COALESCE(
           percentile_cont(0.5) WITHIN GROUP (ORDER BY c.amount),
           100.00
         )
    INTO v_median_circle
    FROM circle_members cm
    JOIN circles c ON c.id = cm.circle_id
   WHERE cm.user_id = p_user_id AND cm.status = 'active';

  v_threshold_dollars := GREATEST(10.00, 0.10 * COALESCE(v_median_circle, 100.00));

  -- ── Sub 1: consistency (max 4). Months in last 12 with NET deposits
  -- ── (deposits − withdrawals in same month) ≥ threshold.
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', NOW() - INTERVAL '11 months'),
      date_trunc('month', NOW()),
      INTERVAL '1 month'
    ) AS month_start
  ),
  per_month AS (
    SELECT m.month_start,
           COALESCE(SUM(CASE WHEN st.transaction_type = 'deposit'    THEN st.amount_cents ELSE 0 END), 0) / 100.0 AS deposits_d,
           COALESCE(SUM(CASE WHEN st.transaction_type = 'withdrawal' THEN st.amount_cents ELSE 0 END), 0) / 100.0 AS withdrawals_d
      FROM months m
      LEFT JOIN savings_transactions st
             ON st.user_id = p_user_id
            AND st.transaction_status = 'completed'
            AND st.created_at >= m.month_start
            AND st.created_at <  m.month_start + INTERVAL '1 month'
     GROUP BY m.month_start
  )
  SELECT COUNT(*)::INT
    INTO v_qualifying_months
    FROM per_month
   WHERE (deposits_d - withdrawals_d) >= v_threshold_dollars;

  v_consistency_pts := LEAST(4.0, (v_qualifying_months::NUMERIC / 12.0) * 4.0);

  -- ── Sub 2: cumulative net inflow (max 3). Deposits in last 6 months
  -- ── minus rebound deposits (deposit within 30 days after a withdrawal
  -- ── of ≥80% of the deposit amount — the wash-trading signature).
  WITH windowed_deposits AS (
    SELECT id, amount_cents, created_at
      FROM savings_transactions
     WHERE user_id = p_user_id
       AND transaction_type = 'deposit'
       AND transaction_status = 'completed'
       AND created_at > v_window_start
  ),
  rebound_ids AS (
    SELECT d.id, d.amount_cents
      FROM windowed_deposits d
     WHERE EXISTS (
       SELECT 1 FROM savings_transactions w
        WHERE w.user_id = p_user_id
          AND w.transaction_type = 'withdrawal'
          AND w.transaction_status = 'completed'
          AND w.created_at >= d.created_at - INTERVAL '30 days'
          AND w.created_at <  d.created_at
          AND w.amount_cents >= (d.amount_cents::NUMERIC * 0.80)
     )
  )
  SELECT
    COALESCE((SELECT SUM(amount_cents) FROM windowed_deposits), 0) / 100.0,
    COALESCE((SELECT SUM(amount_cents) FROM rebound_ids), 0) / 100.0
  INTO v_deposits_dollars, v_rebound_dollars;

  v_net_inflow_dollars := GREATEST(0, v_deposits_dollars - v_rebound_dollars);
  v_inflow_pts := LEAST(3.0, LN(1 + v_net_inflow_dollars) / LN(1001.0) * 3.0);

  -- ── Sub 3: sustained balance (max 2). Per goal, compute time-weighted
  -- ── average balance over last 6 months, then SUM across goals for the
  -- ── user's total-savings-held-over-time. Handles carry-in (last event
  -- ── before window) so a goal that sat untouched with $500 still counts.
  WITH carry_ins AS (
    SELECT DISTINCT ON (savings_goal_id)
           savings_goal_id,
           balance_after_cents,
           v_window_start AS event_at
      FROM savings_transactions
     WHERE user_id = p_user_id
       AND transaction_status = 'completed'
       AND created_at <= v_window_start
     ORDER BY savings_goal_id, created_at DESC
  ),
  in_window AS (
    SELECT savings_goal_id, balance_after_cents, created_at AS event_at
      FROM savings_transactions
     WHERE user_id = p_user_id
       AND transaction_status = 'completed'
       AND created_at >  v_window_start
       AND created_at <= NOW()
  ),
  all_events AS (
    SELECT * FROM carry_ins
    UNION ALL
    SELECT * FROM in_window
  ),
  windowed AS (
    SELECT savings_goal_id,
           balance_after_cents,
           event_at,
           COALESCE(
             LEAD(event_at) OVER (PARTITION BY savings_goal_id ORDER BY event_at),
             NOW()
           ) AS next_at
      FROM all_events
  ),
  weighted AS (
    SELECT savings_goal_id,
           balance_after_cents * EXTRACT(EPOCH FROM (next_at - event_at)) AS b_secs,
           EXTRACT(EPOCH FROM (next_at - event_at)) AS secs
      FROM windowed
     WHERE next_at > event_at
  ),
  per_goal_avg AS (
    SELECT savings_goal_id,
           COALESCE(SUM(b_secs) / NULLIF(SUM(secs), 0), 0) AS goal_avg_cents
      FROM weighted
     GROUP BY savings_goal_id
  )
  SELECT COALESCE(SUM(goal_avg_cents), 0) / 100.0
    INTO v_avg_balance_dollars
    FROM per_goal_avg;

  v_sustained_pts := LEAST(2.0, LN(1 + v_avg_balance_dollars) / LN(1001.0) * 2.0);

  -- ── Sub 4: weighted goals achieved (max 1). Log-weighted by target
  -- ── amount + time-bonus decayed by time-to-achievement. 30-day min
  -- ── lifespan. Category cap: at most ONE achievement counts per
  -- ── unique category (take the best-scoring one). Rows with NULL
  -- ── category all fall into a single '(uncategorized)' bucket.
  WITH achieved AS (
    SELECT g.id,
           g.target_amount_cents,
           COALESCE(g.category, '(uncategorized)') AS category,
           g.created_at,
           COALESCE(g.completed_at, g.updated_at) AS achieved_at
      FROM user_savings_goals g
     WHERE g.user_id = p_user_id
       AND g.target_amount_cents > 0
       AND g.current_balance_cents >= g.target_amount_cents
       AND COALESCE(g.completed_at, g.updated_at) - g.created_at >= INTERVAL '30 days'
  ),
  scored AS (
    SELECT category,
           (LN(1 + target_amount_cents / 100.0) / LN(10001.0))
           * CASE
               WHEN EXTRACT(EPOCH FROM (achieved_at - created_at)) / (86400*30) <= 3  THEN 1.00
               WHEN EXTRACT(EPOCH FROM (achieved_at - created_at)) / (86400*30) <= 12 THEN 0.85
               WHEN EXTRACT(EPOCH FROM (achieved_at - created_at)) / (86400*30) <= 24 THEN 0.70
               ELSE 0.50
             END AS goal_pts
      FROM achieved
  ),
  per_category AS (
    SELECT category, MAX(goal_pts) AS best_pts
      FROM scored
     GROUP BY category
  )
  SELECT COALESCE(SUM(best_pts), 0)
    INTO v_weighted_goals_pts
    FROM per_category;

  v_goals_pts := LEAST(1.0, v_weighted_goals_pts);

  v_details := jsonb_build_object(
    'threshold_dollars',        v_threshold_dollars,
    'median_circle_amount',     v_median_circle,
    'qualifying_months',        v_qualifying_months,
    'deposits_dollars_6mo',     v_deposits_dollars,
    'rebound_dollars_6mo',      v_rebound_dollars,
    'net_inflow_dollars_6mo',   v_net_inflow_dollars,
    'avg_balance_dollars_6mo',  v_avg_balance_dollars,
    'weighted_goals_raw',       v_weighted_goals_pts
  );

  RETURN QUERY SELECT
    ROUND(v_consistency_pts + v_inflow_pts + v_sustained_pts + v_goals_pts, 2),
    ROUND(v_consistency_pts, 2),
    ROUND(v_inflow_pts, 2),
    ROUND(v_sustained_pts, 2),
    ROUND(v_goals_pts, 2),
    v_details;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_savings_behavior_factor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_savings_behavior_factor(uuid)
  TO authenticated, service_role;

-- ─── 6. calculate_financial_behavior_factor — rebalanced to 15 without savings ─
-- Removes the 4-pt binary v_savings_score (moved to
-- calculate_savings_behavior_factor). Rebalances wallet 6→8 + retention
-- 5→7 so total stays at 15. savings_score is kept in the return TABLE
-- signature (set to 0) for backward compat with admin surfaces that may
-- destructure it.
CREATE OR REPLACE FUNCTION public.calculate_financial_behavior_factor(p_user_id uuid)
RETURNS TABLE(
  total_score NUMERIC,
  wallet_score NUMERIC,
  retention_score NUMERIC,
  savings_score NUMERIC,
  details JSONB
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_score_record RECORD;
    v_wallet RECORD;
    v_wallet_deposits INTEGER := 0;
    v_total_deposited_cents BIGINT := 0;
    v_retention_rate DECIMAL := 0;

    v_wallet_score DECIMAL := 0;
    v_retention_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    SELECT * INTO v_wallet FROM user_wallets WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(amount_cents), 0)
    INTO v_wallet_deposits, v_total_deposited_cents
    FROM wallet_transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'wallet_deposit'
      AND transaction_status = 'completed';

    v_retention_rate := COALESCE(v_wallet.money_retention_rate, 0);

    -- Mig 396 rebalance:
    --   wallet_score cap 6 → 8 (12 deposits cap → 8 pts at cap)
    --   retention_score cap 5 → 7 (0-1 rate × 7)
    --   savings_score removed (relocated to calculate_savings_behavior_factor)
    IF v_wallet_deposits > 0 THEN
        v_wallet_score := LEAST(8, (LEAST(v_wallet_deposits, 12)::DECIMAL / 12) * 8);
    END IF;

    v_retention_score := v_retention_rate * 7;

    v_details := jsonb_build_object(
        'wallet_balance', ROUND(COALESCE(v_wallet.available_balance_cents, 0) / 100.0, 2),
        'total_deposited', ROUND(v_total_deposited_cents / 100.0, 2),
        'deposit_count', v_wallet_deposits,
        'payout_retention_rate', ROUND(v_retention_rate * 100, 1),
        'last_wallet_deposit', v_score_record.last_wallet_deposit_at,
        'savings_score_relocated_note',
          'mig 396: savings moved to calculate_savings_behavior_factor'
    );

    -- savings_score kept in return signature for backward compat, always 0.
    RETURN QUERY SELECT
        ROUND(v_wallet_score + v_retention_score, 2),
        ROUND(v_wallet_score, 2),
        ROUND(v_retention_score, 2),
        0::DECIMAL,
        v_details;
END;
$function$;

-- ─── 7. recalculate_full_xnscore — add savings factor + grandfather floor ─
-- Adds the 6th factor call. Sum now includes savings. factor_scores
-- JSONB gets savings_behavior. Grandfathering floor applied after age
-- cap — final score = MAX(computed, grandfathered) while
-- grandfather_expires_at > NOW().
CREATE OR REPLACE FUNCTION public.recalculate_full_xnscore(p_user_id uuid)
RETURNS TABLE(success boolean, previous_score numeric, new_score numeric, breakdown jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
    v_savings RECORD;
    v_new_raw DECIMAL := 0;
    v_new_capped DECIMAL;
    v_new_final DECIMAL;
    v_age_cap INTEGER;
    v_factor_errors JSONB := '{}'::JSONB;
    v_grandfather_applied BOOLEAN := FALSE;

    v_payment_score NUMERIC := 0;
    v_completion_score NUMERIC := 0;
    v_tenure_score NUMERIC := 0;
    v_community_score NUMERIC := 0;
    v_financial_score NUMERIC := 0;
    v_savings_score NUMERIC := 0;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    BEGIN
        PERFORM sync_circle_completion_counters(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('completion_sync', SQLERRM);
    END;

    BEGIN
        PERFORM sync_payment_streak(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('payment_streak_sync', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
        v_payment_score := COALESCE(v_payment.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('payment_reliability', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
        v_completion_score := COALESCE(v_completion.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('circle_completion', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
        v_tenure_score := COALESCE(v_tenure.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('tenure_activity', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
        v_community_score := COALESCE(v_community.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('community_standing', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);
        v_financial_score := COALESCE(v_financial.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('financial_behavior', SQLERRM);
    END;

    -- Mig 396: new 6th factor.
    BEGIN
        SELECT * INTO v_savings FROM calculate_savings_behavior_factor(p_user_id);
        v_savings_score := COALESCE(v_savings.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('savings_behavior', SQLERRM);
    END;

    v_new_raw := GREATEST(
        v_payment_score + v_completion_score + v_tenure_score
          + v_community_score + v_financial_score + v_savings_score,
        COALESCE(v_score_record.raw_score, 20)
    );

    v_age_cap := get_xnscore_age_cap(v_score_record.account_age_days);
    v_new_capped := LEAST(v_new_raw, v_age_cap);

    -- Mig 396: grandfather floor. When the window is active AND a floor
    -- exists AND the floor is higher than the computed score, hold at
    -- the floor. Users who GAINED points get the gain (floor is lower
    -- than new score → LEAST/GREATEST no-op).
    v_new_final := v_new_capped;
    IF v_score_record.grandfather_expires_at IS NOT NULL
       AND v_score_record.grandfather_expires_at > NOW()
       AND v_score_record.grandfathered_score IS NOT NULL
       AND v_score_record.grandfathered_score > v_new_capped THEN
        v_new_final := v_score_record.grandfathered_score;
        v_grandfather_applied := TRUE;
    END IF;

    UPDATE xn_scores SET
        previous_score = total_score,
        raw_score = v_new_raw,
        total_score = v_new_final,
        score_tier = get_xnscore_tier(v_new_final),
        payment_history_score = v_payment_score,
        completion_score = v_completion_score,
        time_reliability_score = v_tenure_score,
        diversity_social_score = v_community_score,
        deposit_score = v_financial_score,
        savings_score = v_savings_score,
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        factor_scores = jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'savings_behavior',    v_savings_score,
            'errors',              v_factor_errors,
            'grandfather_applied', v_grandfather_applied
        ),
        last_calculated_at = now(),
        calculation_trigger = 'full_recalculation',
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    RETURN QUERY SELECT
        TRUE,
        v_score_record.total_score,
        v_new_final,
        jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'savings_behavior',    v_savings_score,
            'raw_total',           v_new_raw,
            'age_cap',             v_age_cap,
            'capped_total',        v_new_capped,
            'final_total',         v_new_final,
            'grandfather_applied', v_grandfather_applied,
            'errors',              v_factor_errors
        );
END;
$function$;

-- ─── 8. Recompute all xn_scores with new logic ────────────────────────────
-- Runs the loop inline. Prod has ~13 xn_scores rows; loop is instant.
-- Frozen scores skipped by the loop's own gate.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'mig 396: recalculated % xn_scores rows', v_count;
END $$;

-- ─── 9. Populate grandfathering ONLY for users whose new < pre ────────────
-- Floor-only per spec. Users who gained keep the gain. Users who lost
-- get held at pre-mig level for 60 days. mig 396b will extend this
-- window when it lands (UPDATE with GREATEST so users get one
-- continuous protection period covering both score changes).
UPDATE xn_scores xs
   SET grandfathered_score    = pre.pre_total_score,
       grandfather_expires_at = NOW() + INTERVAL '60 days'
  FROM xnscore_pre_savings_snapshot pre
 WHERE xs.user_id = pre.user_id
   AND pre.pre_total_score > xs.total_score;

-- After UPDATE, re-run recalc so the newly-floored users' total_score
-- reflects the grandfathered value. Second pass — cheap given the row
-- count, and the recalculate_full_xnscore body will now see the
-- grandfather columns populated and apply the floor.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'mig 396: post-grandfather recalc touched % rows', v_count;
END $$;

-- ─── 10. Self-register ───────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396',
  'savings_behavior_factor',
  ARRAY['-- 396: savings_behavior_factor']
)
ON CONFLICT (version) DO NOTHING;
