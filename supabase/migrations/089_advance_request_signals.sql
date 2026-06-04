-- ════════════════════════════════════════════════════════════════════════════
-- Migration 089: collect_advance_request_signals RPC (Stress Signal D)
-- ════════════════════════════════════════════════════════════════════════════
-- Daily cron RPC. For each member with liquidity_advances activity in the
-- last 30 days (excluding cancelled-by-user requests), counts how many
-- advances they've requested in this cycle window, applies the engine's
-- tier formula + urgency boost, and writes a member_stress_signals row of
-- signal_type='early_payout_request' when the threshold is crossed.
--
-- Why liquidity_advances (not one of the spec's guessed names):
--   The spec mentioned advance_requests / advance_applications / payout_advances
--   as likely names; none exist. The real table from the project's Advance
--   feature is liquidity_advances (members request advances against expected
--   circle payouts). Its member_id already FK-references profiles(id), and
--   it has all the columns the engine's recordEarlyPayoutRequest needs:
--     - member_id
--     - status (CHECK in {requested,approved,disbursed,repaying,repaid,
--                          defaulted,rejected,cancelled,queued})
--     - requested_amount_cents
--     - expected_payout_cents
--     - payout_date  -- for urgency calculation (daysBeforePayout)
--     - created_at
--
-- Engine-faithful scoring (matches recordEarlyPayoutRequest in
-- services/FinancialStressPredictionEngine.ts):
--   baseValue = CASE requestsThisCycle WHEN 1 THEN 40
--                                       WHEN 2 THEN 70
--                                       ELSE 100  -- 3+
--               END
--   urgencyBoost = (daysBeforePayout < 7) ? 20 : 0
--   signalValue  = min(100, baseValue + urgencyBoost)
--
-- (The spec's "fixed signal_value=75" alternative discards the count
-- gradation. With the engine formula, 1 request maps to a much weaker
-- signal than 3+ — important difference for the 15% weight.)
--
-- Status filter: include every status EXCEPT 'cancelled'. The user pulling
-- back is the only outcome that doesn't indicate stress. 'rejected' still
-- counts (the user TRIED, that's the signal). 'defaulted' still counts
-- (the original request was a stress indicator regardless of repayment).
--
-- Idempotency: 24h dedup window per (member, signal_type='early_payout_request')
-- via EXISTS check. Same shape as Signal C — no partial unique index
-- because date_trunc on timestamptz isn't IMMUTABLE.
--
-- FK note: member_stress_signals.member_id REFERENCES profiles(id), and
-- liquidity_advances.member_id REFERENCES profiles(id) ON DELETE RESTRICT.
-- The chain guarantees any member_id we read from liquidity_advances is
-- valid in profiles — no FK guard needed (unlike Signals B/C where the
-- source tables FK to auth.users).
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION collect_advance_request_signals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_request_count INTEGER;
  v_min_days_to_payout INTEGER;
  v_base_value INTEGER;
  v_urgency_boost INTEGER;
  v_signal_value NUMERIC(6,2);
  v_inserted INTEGER := 0;
  v_skipped_dup INTEGER := 0;
  v_skipped_zero INTEGER := 0;
BEGIN
  -- Iterate over members with ANY advance activity in last 30 days,
  -- excluding user-cancelled requests.
  FOR v_user IN
    SELECT DISTINCT member_id
    FROM liquidity_advances
    WHERE created_at > NOW() - INTERVAL '30 days'
      AND status <> 'cancelled'
  LOOP
    -- Count + earliest upcoming payout date for this member's recent advances
    SELECT
      COUNT(*),
      MIN(GREATEST(0, (payout_date - CURRENT_DATE)))
      INTO v_request_count, v_min_days_to_payout
    FROM liquidity_advances
    WHERE member_id = v_user.member_id
      AND created_at > NOW() - INTERVAL '30 days'
      AND status <> 'cancelled';

    -- Defensive — distinct member with status<>cancelled in window must
    -- have count >= 1. If somehow 0, skip.
    IF v_request_count = 0 THEN
      v_skipped_zero := v_skipped_zero + 1;
      CONTINUE;
    END IF;

    -- Engine tier formula
    v_base_value := CASE
      WHEN v_request_count = 1 THEN 40
      WHEN v_request_count = 2 THEN 70
      ELSE 100
    END;

    -- Urgency boost — if any of this member's advances has payout date
    -- within 7 days, +20. Mirrors engine's "daysBeforePayout < 7".
    v_urgency_boost := CASE
      WHEN v_min_days_to_payout IS NOT NULL AND v_min_days_to_payout < 7 THEN 20
      ELSE 0
    END;

    v_signal_value := LEAST(100, v_base_value + v_urgency_boost);

    -- 24-hour dedup
    IF EXISTS (
      SELECT 1 FROM member_stress_signals
      WHERE member_id = v_user.member_id
        AND signal_type = 'early_payout_request'
        AND recorded_at > NOW() - INTERVAL '24 hours'
    ) THEN
      v_skipped_dup := v_skipped_dup + 1;
      CONTINUE;
    END IF;

    INSERT INTO member_stress_signals (
      member_id,
      signal_type,
      signal_value,
      raw_data
    ) VALUES (
      v_user.member_id,
      'early_payout_request',
      v_signal_value,
      jsonb_build_object(
        'request_count_30d',   v_request_count,
        'min_days_to_payout',  v_min_days_to_payout,
        'base_value',          v_base_value,
        'urgency_boost',       v_urgency_boost,
        'source',              'collect_advance_request_signals_rpc'
      )
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped_dup', v_skipped_dup,
    'skipped_zero', v_skipped_zero,
    'source', 'collect_advance_request_signals_rpc',
    'note', 'Engine-faithful count-tier formula (1=40, 2=70, 3+=100) + urgency boost (+20 if any payout_date within 7 days). 24h dedup window. Source table: liquidity_advances.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_advance_request_signals() TO service_role;
REVOKE EXECUTE ON FUNCTION public.collect_advance_request_signals() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('089', 'advance_request_signals',
        ARRAY['-- 089: collect_advance_request_signals RPC'])
ON CONFLICT (version) DO NOTHING;
