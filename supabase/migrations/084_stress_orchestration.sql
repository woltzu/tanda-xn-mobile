-- ════════════════════════════════════════════════════════════════════════════
-- Migration 084: Financial Stress Prediction Engine — orchestration layer
-- ════════════════════════════════════════════════════════════════════════════
-- Wires up the existing engine (services/FinancialStressPredictionEngine.ts,
-- migration 060) so it actually produces output. Two SECURITY DEFINER RPCs,
-- both invoked by Edge Function cron wrappers:
--
--   PART A — collect_stress_signals()
--     Scans cycle_contributions for late payments and writes
--     member_stress_signals rows of signal_type='contribution_delay'. This is
--     the ONLY signal type collected in this migration. The engine defines
--     three more (ticket_language, login_drop, early_payout_request) but
--     their upstream data sources don't exist yet (no support_tickets table,
--     no login-frequency aggregation, no advance-request feed verified).
--     Adding those collectors is a follow-up when each source comes online.
--
--   PART B — process_member_stress()
--     Mirrors FinancialStressPredictionEngine.runScoringBatch(). For each
--     member with signals in the last 30 days, groups signals by type,
--     averages values, applies engine WEIGHTS (contribution_delay 30%,
--     ticket_language 35%, login_drop 20%, early_payout_request 15%),
--     INSERTs member_stress_scores. The existing 060 trigger
--     trg_stress_score_status auto-fills status / intervention_triggered /
--     intervention_type from the inserted score. If intervention_triggered
--     and no pending intervention exists, INSERTs a stress_interventions
--     row with localized EN/FR copy ported from the engine's
--     _generateInterventionMessage().
--
-- Honest data caveat (matches the audit-35 worldview):
--   With only Signal A active and the other 3 weights summing to 70%,
--   member_stress_scores will cap at ~30 (max 100 × 30%). Status will stay
--   'green' for every member until the other signal sources come online.
--   No interventions will trigger. This is correct behavior — the engine
--   is faithfully reporting the signal data it has. We're not faking it.
--
-- RLS note:
--   No new policies needed. Both RPCs are SECURITY DEFINER and called from
--   the cron EFs with the service_role key, which bypasses RLS. The member-
--   facing screen reads via the existing 060 own-row SELECT policies.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── PART A: collect_stress_signals() ─────────────────────────────────────

CREATE OR REPLACE FUNCTION collect_stress_signals()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_late RECORD;
  v_signal_value NUMERIC(6,2);
  v_consecutive INTEGER;
  v_frequency INTEGER;
  v_inserted INTEGER := 0;
  v_skipped_dup INTEGER := 0;
  v_members_touched INTEGER;
BEGIN
  -- Iterate over every late contribution. Filter to NOT NULL days_late > 0
  -- (the schema allows NULL; was_on_time=true rows might have days_late
  -- nulled out, so we both null-check and threshold-check).
  --
  -- NOTE: We use cycle_contributions.user_id (NOT NULL FK to profiles.id),
  -- not the nullable cycle_contributions.member_id. user_id is the
  -- canonical member identifier in this schema.
  FOR v_late IN
    SELECT
      cc.id            AS contribution_id,
      cc.user_id       AS member_id,
      cc.cycle_id,
      cc.circle_id,
      cc.due_date,
      cc.contributed_at,
      cc.days_late
    FROM cycle_contributions cc
    WHERE cc.days_late IS NOT NULL
      AND cc.days_late > 0
  LOOP
    -- Dedup: skip if we already have a contribution_delay signal for this
    -- (member, cycle) pair within the last 7 days. Without this, a daily
    -- cron would generate redundant rows for the same late cycle on each
    -- run until the contribution finally settles. The window is 7 days
    -- (not 30) so that if days_late grows from 1 → 5 we still capture
    -- the worsening picture as the consecutive_late_count climbs.
    IF EXISTS (
      SELECT 1 FROM member_stress_signals
      WHERE member_id = v_late.member_id
        AND signal_type = 'contribution_delay'
        AND cycle_id = v_late.cycle_id
        AND recorded_at > NOW() - INTERVAL '7 days'
    ) THEN
      v_skipped_dup := v_skipped_dup + 1;
      CONTINUE;
    END IF;

    -- consecutive_late_count: count of consecutive late cycles ending at
    -- this cycle. Cheap path: count how many other late contributions this
    -- member has within the last 60 days. Less precise than the TS engine's
    -- definition but adequate for the bonus.
    SELECT COUNT(*) INTO v_consecutive
    FROM cycle_contributions
    WHERE user_id = v_late.member_id
      AND days_late > 0
      AND due_date >= CURRENT_DATE - INTERVAL '60 days'
      AND due_date <= v_late.due_date;

    -- frequency_of_late: total historical late count, for raw_data context.
    SELECT COUNT(*) INTO v_frequency
    FROM cycle_contributions
    WHERE user_id = v_late.member_id
      AND days_late > 0;

    -- Map days_late to 0-100 signal_value per the agreed curve:
    --   1d=20, 2d=35, 3d=50, 4d=65, 5d=80, 6d=95, 7d+=100
    -- Formula: LEAST(100, 5 + days_late * 15)
    -- (Steeper than the TS engine's daysLate/30*100 — better signal for a
    -- once-daily scan where missing a single day is meaningful.)
    v_signal_value := LEAST(100, 5 + v_late.days_late * 15);

    -- Optional consecutive bonus (matches TS engine's recordContributionDelay)
    v_signal_value := LEAST(100,
      v_signal_value + LEAST(30, GREATEST(0, v_consecutive - 1) * 10)
    );

    INSERT INTO member_stress_signals (
      member_id,
      signal_type,
      signal_value,
      raw_data,
      circle_id,
      cycle_id
    ) VALUES (
      v_late.member_id,
      'contribution_delay',
      v_signal_value,
      jsonb_build_object(
        'days_late',              v_late.days_late,
        'expected_date',          v_late.due_date,
        'actual_date',            v_late.contributed_at,
        'consecutive_late_count', v_consecutive,
        'frequency_of_late',      v_frequency,
        'source',                 'collect_stress_signals_rpc',
        'contribution_id',        v_late.contribution_id
      ),
      v_late.circle_id,
      v_late.cycle_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Count distinct members touched (could also be tracked inline but this
  -- post-hoc count is cheaper and clear).
  SELECT COUNT(DISTINCT member_id) INTO v_members_touched
  FROM member_stress_signals
  WHERE signal_type = 'contribution_delay'
    AND recorded_at > NOW() - INTERVAL '5 minutes';

  RETURN jsonb_build_object(
    'success', true,
    'signals_inserted', v_inserted,
    'signals_skipped_dup', v_skipped_dup,
    'members_touched', v_members_touched,
    'signal_type', 'contribution_delay',
    'source', 'collect_stress_signals_rpc',
    'note', 'Only contribution_delay is collected here. Add the other 3 signal types as their upstream sources come online.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.collect_stress_signals() TO service_role;
REVOKE EXECUTE ON FUNCTION public.collect_stress_signals() FROM PUBLIC, anon, authenticated;


-- ─── PART B: process_member_stress() ──────────────────────────────────────

CREATE OR REPLACE FUNCTION process_member_stress()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member RECORD;
  v_score_row RECORD;
  v_avg_contrib NUMERIC; v_count_contrib INTEGER;
  v_avg_ticket NUMERIC;  v_count_ticket INTEGER;
  v_avg_login NUMERIC;   v_count_login INTEGER;
  v_avg_payout NUMERIC;  v_count_payout INTEGER;
  v_breakdown JSONB;
  v_composite NUMERIC(5,2);
  v_previous NUMERIC; v_trend TEXT;
  v_member_lang TEXT;
  v_member_name TEXT;
  v_amount_cents INTEGER;
  v_msg_title TEXT; v_msg_body TEXT;
  v_installments JSONB;
  v_scored INTEGER := 0;
  v_interventions INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Iterate members who have at least one signal in the last 30 days.
  -- (Matches engine.runScoringBatch's filter.)
  FOR v_member IN
    SELECT DISTINCT member_id
    FROM member_stress_signals
    WHERE recorded_at > NOW() - INTERVAL '30 days'
  LOOP
    BEGIN
      -- Group + average by signal type. Empty types remain 0 — engine-
      -- faithful: a missing signal contributes 0, not "redistribute weight."
      SELECT
        COALESCE(AVG(CASE WHEN signal_type = 'contribution_delay'   THEN signal_value END), 0),
        COUNT(*)         FILTER (WHERE signal_type = 'contribution_delay'),
        COALESCE(AVG(CASE WHEN signal_type = 'ticket_language'      THEN signal_value END), 0),
        COUNT(*)         FILTER (WHERE signal_type = 'ticket_language'),
        COALESCE(AVG(CASE WHEN signal_type = 'login_drop'           THEN signal_value END), 0),
        COUNT(*)         FILTER (WHERE signal_type = 'login_drop'),
        COALESCE(AVG(CASE WHEN signal_type = 'early_payout_request' THEN signal_value END), 0),
        COUNT(*)         FILTER (WHERE signal_type = 'early_payout_request')
        INTO
          v_avg_contrib, v_count_contrib,
          v_avg_ticket,  v_count_ticket,
          v_avg_login,   v_count_login,
          v_avg_payout,  v_count_payout
      FROM member_stress_signals
      WHERE member_id = v_member.member_id
        AND recorded_at > NOW() - INTERVAL '30 days';

      -- Weights match the TS engine WEIGHTS const exactly.
      v_composite := LEAST(100, GREATEST(0,
        v_avg_contrib * 0.30
        + v_avg_ticket  * 0.35
        + v_avg_login   * 0.20
        + v_avg_payout  * 0.15
      ));

      -- Build the breakdown JSON in the exact same shape as the engine's
      -- SignalBreakdown so the dashboard screen renders without changes.
      v_breakdown := jsonb_build_object(
        'contribution_delay', jsonb_build_object(
          'raw_value',      v_avg_contrib,
          'weighted_value', v_avg_contrib * 0.30,
          'weight',         0.30,
          'signals_used',   v_count_contrib),
        'ticket_language', jsonb_build_object(
          'raw_value',      v_avg_ticket,
          'weighted_value', v_avg_ticket * 0.35,
          'weight',         0.35,
          'signals_used',   v_count_ticket),
        'login_drop', jsonb_build_object(
          'raw_value',      v_avg_login,
          'weighted_value', v_avg_login * 0.20,
          'weight',         0.20,
          'signals_used',   v_count_login),
        'early_payout_request', jsonb_build_object(
          'raw_value',      v_avg_payout,
          'weighted_value', v_avg_payout * 0.15,
          'weight',         0.15,
          'signals_used',   v_count_payout)
      );

      -- Previous score for trend computation.
      SELECT stress_score INTO v_previous
      FROM member_stress_scores
      WHERE member_id = v_member.member_id
      ORDER BY score_date DESC, created_at DESC
      LIMIT 1;

      v_trend := CASE
        WHEN v_previous IS NULL THEN NULL
        WHEN v_composite - v_previous > 5  THEN 'worsening'
        WHEN v_composite - v_previous < -5 THEN 'improving'
        ELSE 'stable'
      END;

      -- INSERT — the existing trg_stress_score_status BEFORE INSERT trigger
      -- (migration 060) auto-fills status + intervention_triggered +
      -- intervention_type from the inserted stress_score. We pull those
      -- post-insert via RETURNING.
      INSERT INTO member_stress_scores (
        member_id,
        stress_score,
        signal_breakdown,
        previous_score,
        trend,
        scoring_model,
        signals_count,
        scoring_window_days
      ) VALUES (
        v_member.member_id,
        v_composite,
        v_breakdown,
        v_previous,
        v_trend,
        'weighted_rule_v1',
        v_count_contrib + v_count_ticket + v_count_login + v_count_payout,
        30
      )
      RETURNING id, status, intervention_triggered, intervention_type
        INTO v_score_row;

      v_scored := v_scored + 1;

      -- If trigger flipped intervention_triggered, AND the member doesn't
      -- already have a pending intervention, create the offer.
      IF v_score_row.intervention_triggered
         AND NOT EXISTS (
           SELECT 1 FROM stress_interventions
           WHERE member_id = v_member.member_id
             AND outcome = 'pending'
         )
      THEN
        -- Look up member language (FR / EN supported in the engine).
        SELECT COALESCE(language, 'en'), full_name
          INTO v_member_lang, v_member_name
        FROM profiles WHERE id = v_member.member_id;
        v_member_lang := COALESCE(v_member_lang, 'en');
        IF v_member_lang NOT IN ('en', 'fr') THEN
          v_member_lang := 'en';
        END IF;

        -- Pull the most recent late contribution amount as the restructure
        -- baseline. NULL if not applicable.
        SELECT (expected_amount * 100)::INTEGER INTO v_amount_cents
        FROM cycle_contributions
        WHERE user_id = v_member.member_id
          AND days_late > 0
        ORDER BY due_date DESC
        LIMIT 1;
        v_amount_cents := COALESCE(v_amount_cents, 0);

        -- Localized copy ported from FinancialStressPredictionEngine.
        -- _generateInterventionMessage(). The {amount} placeholder is
        -- expanded inline here (engine uses string interpolation).
        IF v_score_row.intervention_type = 'payment_restructure' THEN
          IF v_member_lang = 'fr' THEN
            v_msg_title := 'Nous sommes là pour vous';
            v_msg_body  := format(
              'Nous avons remarqué que ce mois-ci pourrait être serré. Nous pouvons diviser %s en deux paiements. Pas de pénalité. Dites-le nous.',
              CASE WHEN v_amount_cents > 0
                   THEN '$' || (v_amount_cents / 100)::TEXT
                   ELSE 'votre contribution' END);
          ELSE
            v_msg_title := 'We''re here to help';
            v_msg_body  := format(
              'We noticed things might be tight this month. We can split %s into two payments. No penalty, no judgment. Just let us know.',
              CASE WHEN v_amount_cents > 0
                   THEN '$' || (v_amount_cents / 100)::TEXT
                   ELSE 'your contribution' END);
          END IF;

          -- Two installments, due every 2 weeks, matching engine logic.
          IF v_amount_cents > 0 THEN
            v_installments := jsonb_build_array(
              jsonb_build_object(
                'amount_cents', CEIL(v_amount_cents::NUMERIC / 2)::INTEGER,
                'due_date',     to_char(CURRENT_DATE + INTERVAL '14 days', 'YYYY-MM-DD')),
              jsonb_build_object(
                'amount_cents', v_amount_cents - CEIL(v_amount_cents::NUMERIC / 2)::INTEGER,
                'due_date',     to_char(CURRENT_DATE + INTERVAL '28 days', 'YYYY-MM-DD'))
            );
          ELSE
            v_installments := NULL;
          END IF;

        ELSIF v_score_row.intervention_type = 'counselor_referral' THEN
          IF v_member_lang = 'fr' THEN
            v_msg_title := 'Soutien financier gratuit disponible';
            v_msg_body  := 'Nous travaillons avec des conseillers financiers certifiés qui peuvent vous aider — gratuitement et en toute confidentialité. Souhaitez-vous une recommandation?';
          ELSE
            v_msg_title := 'Free financial support available';
            v_msg_body  := 'We''ve partnered with certified financial counselors who can help — completely free and confidential. Would you like a referral?';
          END IF;
          v_installments := NULL;

        ELSE
          v_msg_title := 'Support available';
          v_msg_body  := 'We''re here to help.';
          v_installments := NULL;
        END IF;

        INSERT INTO stress_interventions (
          member_id,
          stress_score_id,
          intervention_type,
          stress_score_at_trigger,
          stress_status,
          message_title,
          message_body,
          language,
          original_amount_cents,
          installment_count,
          installment_amounts
        ) VALUES (
          v_member.member_id,
          v_score_row.id,
          v_score_row.intervention_type,
          v_composite,
          v_score_row.status,
          v_msg_title,
          v_msg_body,
          v_member_lang,
          NULLIF(v_amount_cents, 0),
          CASE WHEN v_score_row.intervention_type = 'payment_restructure' THEN 2 ELSE NULL END,
          v_installments
        );

        v_interventions := v_interventions + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
        format('member %s: %s', v_member.member_id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'scored', v_scored,
    'interventions_created', v_interventions,
    'errors', v_errors,
    'source', 'process_member_stress_rpc',
    'note', 'Until ticket_language / login_drop / early_payout_request collectors exist, only contribution_delay (30% weight) drives scores. Maximum possible composite = 30 → status stays green. No interventions will trigger. This is correct, not a bug.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_member_stress() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_member_stress() FROM PUBLIC, anon, authenticated;


-- ─── Index helping the dedup window check in collect_stress_signals ──────
-- The existing idx_stress_signals_member_type covers (member_id, signal_type,
-- recorded_at DESC) — perfect prefix for the EXISTS subquery. No new index
-- needed for the basic dedup. We do want a faster path for cycle_id matching:
CREATE INDEX IF NOT EXISTS idx_stress_signals_cycle_dedup
  ON member_stress_signals(member_id, signal_type, cycle_id, recorded_at DESC)
  WHERE cycle_id IS NOT NULL;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('084', 'stress_orchestration',
        ARRAY['-- 084: collect_stress_signals + process_member_stress RPCs'])
ON CONFLICT (version) DO NOTHING;
