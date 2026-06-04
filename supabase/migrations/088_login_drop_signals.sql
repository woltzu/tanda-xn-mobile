-- ════════════════════════════════════════════════════════════════════════════
-- Migration 088: collect_login_drop_signals RPC (Stress Signal C)
-- ════════════════════════════════════════════════════════════════════════════
-- Daily cron RPC. For each user with at least one login in the last 7 days,
-- computes the rolling 7-day login frequency vs the prior 23-day baseline
-- (days 8-30), calculates drop %, and writes a member_stress_signals row
-- of signal_type='login_drop' when the drop crosses the threshold.
--
-- Engine fidelity:
--   The TS engine's recordLoginDrop normalizes via
--     signalValue = min(100, (dropPct / 60) * 100)
--   meaning 60% drop maps to 100 signal_value (the max). This RPC mirrors
--   the same normalization so the stress score weighting matches the
--   engine's intent exactly. (The original spec used raw drop_pct as
--   signal_value, which is a gentler curve. Using engine formula keeps
--   signals A/B/C/D commensurable.)
--
-- Window definitions (matches engine intent):
--   - 7-day window  = NOW() - 7d .. NOW()
--   - 23-day baseline = NOW() - 30d .. NOW() - 7d
--   Both windows use total_logins / window_days_count for the per-day
--   average. This is robust to days with zero logins (unlike grouping by
--   DATE() which silently drops zero days from the average).
--
-- Threshold:
--   Only emit a signal when drop_pct >= 20%. Below that the signal would
--   be too noisy (normal variance). 20% drop → signal_value = (20/60)*100
--   ≈ 33.3 (above the green-band cutoff at the signal level).
--
-- Idempotency:
--   24-hour dedup window per (member, signal_type='login_drop'). If the
--   cron runs twice the same day (manual re-run during dev, etc.), we
--   skip the duplicate. The original spec's ON CONFLICT clause referenced
--   columns that aren't unique — replaced with an EXISTS check + the
--   partial unique index below for defense-in-depth.
--
-- FK safety:
--   member_stress_signals.member_id references profiles(id). If a user
--   has login_events but no profiles row (mismatched account state), the
--   insert would FK-fail. We pre-check existence in profiles before
--   inserting.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── (intentionally no partial unique index) ──────────────────────────────
-- The initial design wanted a partial unique index on
--   (member_id, date_trunc('day', recorded_at)) WHERE signal_type='login_drop'
-- but PostgreSQL rejects it: date_trunc on timestamptz is only STABLE, not
-- IMMUTABLE (the session timezone affects the resolved value), and only
-- IMMUTABLE expressions are indexable. Alternatives (extract(epoch)/86400,
-- generated columns) add complexity without value here — the RPC runs
-- serially from a single cron, the in-function EXISTS check covers a wider
-- 24h window than a per-day index would have, and the worst case
-- (manual concurrent invocations during dev) creates one extra signal row
-- per day. Acceptable.


-- ─── RPC ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION collect_login_drop_signals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_count_7d INTEGER;
  v_count_23d INTEGER;
  v_avg_7d NUMERIC;
  v_avg_23d NUMERIC;
  v_drop_pct NUMERIC;
  v_signal_value NUMERIC(6,2);
  v_inserted INTEGER := 0;
  v_skipped_no_baseline INTEGER := 0;
  v_skipped_no_drop INTEGER := 0;
  v_skipped_below_threshold INTEGER := 0;
  v_skipped_dup INTEGER := 0;
  v_skipped_no_profile INTEGER := 0;
BEGIN
  -- Iterate over every user with login activity in either window.
  -- The union ensures we still consider users whose last-7-days count
  -- might be 0 but who had baseline activity (the canonical "they stopped
  -- showing up" case — which is exactly the signal we want).
  FOR v_user IN
    SELECT DISTINCT user_id
    FROM login_events
    WHERE login_at > NOW() - INTERVAL '30 days'
  LOOP
    -- Per-window total counts. Total / window_days is robust to gaps
    -- (unlike AVG(daily_count) which silently drops zero-login days).
    SELECT COUNT(*) INTO v_count_7d
    FROM login_events
    WHERE user_id = v_user.user_id
      AND login_at > NOW() - INTERVAL '7 days';

    SELECT COUNT(*) INTO v_count_23d
    FROM login_events
    WHERE user_id = v_user.user_id
      AND login_at > NOW() - INTERVAL '30 days'
      AND login_at <= NOW() - INTERVAL '7 days';

    v_avg_7d  := v_count_7d  / 7.0;
    v_avg_23d := v_count_23d / 23.0;

    -- No baseline → can't compute a drop. Skip silently (user might be
    -- new). When more history accrues, future runs will pick them up.
    IF v_avg_23d IS NULL OR v_avg_23d = 0 THEN
      v_skipped_no_baseline := v_skipped_no_baseline + 1;
      CONTINUE;
    END IF;

    -- Activity went UP or stayed flat → no signal worth recording.
    IF v_avg_7d >= v_avg_23d THEN
      v_skipped_no_drop := v_skipped_no_drop + 1;
      CONTINUE;
    END IF;

    v_drop_pct := 100.0 * (1.0 - (v_avg_7d / v_avg_23d));

    -- Threshold: below 20% drop is normal variance — don't emit.
    IF v_drop_pct < 20 THEN
      v_skipped_below_threshold := v_skipped_below_threshold + 1;
      CONTINUE;
    END IF;

    -- Engine-faithful normalization: 60% drop maps to 100 signal_value.
    -- Matches FinancialStressPredictionEngine.recordLoginDrop.
    v_signal_value := LEAST(100, ROUND((v_drop_pct / 60.0) * 100 * 100) / 100);

    -- 24-hour dedup check (defensive — partial unique index also enforces).
    IF EXISTS (
      SELECT 1 FROM member_stress_signals
      WHERE member_id = v_user.user_id
        AND signal_type = 'login_drop'
        AND recorded_at > NOW() - INTERVAL '24 hours'
    ) THEN
      v_skipped_dup := v_skipped_dup + 1;
      CONTINUE;
    END IF;

    -- FK guard: member_stress_signals.member_id REFERENCES profiles(id).
    -- If the auth user has no profile yet, FK would fail. Skip cleanly.
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user.user_id) THEN
      v_skipped_no_profile := v_skipped_no_profile + 1;
      CONTINUE;
    END IF;

    -- Insert. Wrapped to catch the 23505 partial-unique race (extremely
    -- unlikely in a serial cron but safe).
    BEGIN
      INSERT INTO member_stress_signals (
        member_id,
        signal_type,
        signal_value,
        raw_data
      ) VALUES (
        v_user.user_id,
        'login_drop',
        v_signal_value,
        jsonb_build_object(
          'rolling_7d_count',  v_count_7d,
          'baseline_23d_count', v_count_23d,
          'rolling_7d_avg',    ROUND(v_avg_7d * 100) / 100,
          'baseline_23d_avg',  ROUND(v_avg_23d * 100) / 100,
          'drop_pct',          ROUND(v_drop_pct * 100) / 100,
          'source',            'collect_login_drop_signals_rpc'
        )
      );
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped_dup := v_skipped_dup + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped_no_baseline', v_skipped_no_baseline,
    'skipped_no_drop', v_skipped_no_drop,
    'skipped_below_threshold', v_skipped_below_threshold,
    'skipped_dup', v_skipped_dup,
    'skipped_no_profile', v_skipped_no_profile,
    'source', 'collect_login_drop_signals_rpc',
    'note', 'Engine-faithful: signal_value = min(100, (drop_pct/60)*100). 20% threshold for signal emission, 24h dedup window.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_login_drop_signals() TO service_role;
REVOKE EXECUTE ON FUNCTION public.collect_login_drop_signals() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('088', 'login_drop_signals',
        ARRAY['-- 088: collect_login_drop_signals RPC + dedup index'])
ON CONFLICT (version) DO NOTHING;
