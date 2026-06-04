-- ============================================================================
-- Migration 082: process_member_interventions RPC
-- ============================================================================
-- Implements EarlyInterventionEngine.evaluateAndIntervene() logic as a
-- PL/pgSQL stored procedure so it can be called from any source (cron,
-- Edge Function, manual admin button). Bypasses the React-Native-bound
-- TypeScript engine + Deno-incompatible supabase import.
--
-- TEMPORARY MOCK (documented at top so future readers don't miss it):
-- `default_probability_scores` is currently empty in prod (scoring-pipeline-
-- daily has not run since 2026-03-10 per the audit). We compute a stand-in
-- probability from `profiles.xn_score` using inversion:
--   probability = 100 - xn_score
-- Low XnScore (poor reliability) → high prob → higher-level intervention.
-- When the scoring pipeline starts populating default_probability_scores,
-- swap the candidate CTE for a JOIN to that table.
--
-- ENGINE PARITY: matches what EarlyInterventionEngine.evaluateAndIntervene()
-- does on the TypeScript side:
--   1. Probability → Level via intervention_rules.score_min/score_max range
--   2. Cooldown check (cooldown_hours from rule)
--   3. Max-per-cycle check (last 30 days)
--   4. Template lookup by (level, language) with 'en' fallback
--   5. Variable substitution: {name}, {amount}, {circle}, {days}, {date}
--   6. INSERT with all required NOT NULL columns
--
-- LEVEL RESTRICTION: only L1 and L2 are processed, matching the engine's
-- `if (level > 2) return null` guard. L3-L5 rules exist in seed but no
-- templates are seeded for them.
-- ============================================================================

CREATE OR REPLACE FUNCTION process_member_interventions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate RECORD;
  v_probability NUMERIC;
  v_risk_bucket TEXT;
  v_rule RECORD;
  v_template RECORD;
  v_personalized_text TEXT;
  v_member_name TEXT;
  v_circle_name TEXT;
  v_amount_cents INTEGER;
  v_due_date DATE;
  v_days_until_due INTEGER;
  v_evaluated INTEGER := 0;
  v_created INTEGER := 0;
  v_skipped_no_rule INTEGER := 0;
  v_skipped_level_too_high INTEGER := 0;
  v_skipped_no_template INTEGER := 0;
  v_skipped_cooldown INTEGER := 0;
  v_skipped_max_per_cycle INTEGER := 0;
BEGIN
  -- Iterate over members of active circles with a cached XnScore low enough
  -- to land in ANY intervention rule's range. The lowest rule (L1) starts at
  -- score_min=31, meaning probability >= 31, meaning xn_score <= 69. So the
  -- xn_score < 70 filter is a cheap pre-screen that avoids loading members
  -- who can't possibly trigger an intervention.
  --
  -- DISTINCT ON (p.id) so we evaluate each member exactly once even if
  -- they're in multiple circles. We pick the highest-amount circle for
  -- their context (most economically significant).
  FOR v_candidate IN
    SELECT DISTINCT ON (p.id)
      p.id            AS member_id,
      p.full_name     AS member_name,
      COALESCE(p.language, 'fr') AS language,
      p.xn_score      AS xn_score,
      cm.circle_id    AS circle_id,
      c.name          AS circle_name,
      c.amount        AS circle_amount
    FROM profiles p
    JOIN circle_members cm ON cm.user_id = p.id
    JOIN circles c          ON c.id = cm.circle_id
    WHERE p.xn_score IS NOT NULL
      AND p.xn_score < 70
      AND (c.status IS NULL OR c.status NOT IN ('dissolved', 'archived', 'closed'))
    ORDER BY p.id, c.amount DESC NULLS LAST
  LOOP
    v_evaluated := v_evaluated + 1;

    -- MOCK PROBABILITY (will be replaced once default_probability_scores
    -- is populated by a working scoring-pipeline-daily run).
    v_probability := GREATEST(0, LEAST(100, 100 - v_candidate.xn_score::NUMERIC));

    -- Risk bucket label (matches default_probability_scores.risk_bucket
    -- convention so when we swap the data source, downstream queries
    -- still see the same enum.)
    v_risk_bucket := CASE
      WHEN v_probability >= 76 THEN 'high'
      WHEN v_probability >= 46 THEN 'moderate'
      WHEN v_probability >= 31 THEN 'low_moderate'
      ELSE 'low'
    END;

    -- Find the matching rule (score range + active). Use the LOWEST-level
    -- match so a borderline case gets a soft nudge, not a heavy alert.
    SELECT * INTO v_rule
    FROM intervention_rules
    WHERE is_active = true
      AND score_min <= v_probability
      AND score_max >= v_probability
    ORDER BY level
    LIMIT 1;

    IF NOT FOUND THEN
      v_skipped_no_rule := v_skipped_no_rule + 1;
      CONTINUE;
    END IF;

    -- Engine parity: only L1 and L2 are wired. L3-L5 templates aren't seeded.
    IF v_rule.level > 2 THEN
      v_skipped_level_too_high := v_skipped_level_too_high + 1;
      CONTINUE;
    END IF;

    -- Cooldown check: skip if any intervention of the same level was sent
    -- within cooldown_hours.
    IF EXISTS (
      SELECT 1 FROM member_interventions
      WHERE member_id = v_candidate.member_id
        AND level = v_rule.level
        AND created_at > NOW() - (v_rule.cooldown_hours || ' hours')::INTERVAL
    ) THEN
      v_skipped_cooldown := v_skipped_cooldown + 1;
      CONTINUE;
    END IF;

    -- Max per cycle: skip if level cap reached in last 30 days.
    IF (
      SELECT COUNT(*) FROM member_interventions
      WHERE member_id = v_candidate.member_id
        AND level = v_rule.level
        AND created_at > NOW() - INTERVAL '30 days'
    ) >= v_rule.max_per_cycle THEN
      v_skipped_max_per_cycle := v_skipped_max_per_cycle + 1;
      CONTINUE;
    END IF;

    -- Template lookup for (level, language); fall back to 'en' if missing.
    SELECT * INTO v_template
    FROM intervention_templates
    WHERE level = v_rule.level
      AND language = v_candidate.language
      AND is_active = true
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_template
      FROM intervention_templates
      WHERE level = v_rule.level
        AND language = 'en'
        AND is_active = true
      LIMIT 1;
    END IF;

    IF NOT FOUND THEN
      v_skipped_no_template := v_skipped_no_template + 1;
      CONTINUE;
    END IF;

    -- Build member-context fields. Since we don't have a real
    -- cycle/contribution context in the mock pipeline, we synthesize one:
    -- circle.amount as the contribution amount, due_date as 7 days from
    -- today. When the real scoring pipeline runs, the EF can replace this
    -- with actual cycle_contributions lookups.
    v_member_name := COALESCE(NULLIF(TRIM(v_candidate.member_name), ''), 'Member');
    v_circle_name := COALESCE(NULLIF(TRIM(v_candidate.circle_name), ''), 'your circle');
    v_amount_cents := COALESCE((v_candidate.circle_amount * 100)::INTEGER, 0);
    v_due_date := (CURRENT_DATE + INTERVAL '7 days')::DATE;
    v_days_until_due := 7;

    -- Template variable substitution. Matches the TS engine's
    -- personalizeMessage() replacements: {name}, {amount}, {days}, {circle}, {date}.
    v_personalized_text := v_template.body;
    v_personalized_text := REPLACE(v_personalized_text, '{name}',   v_member_name);
    v_personalized_text := REPLACE(v_personalized_text, '{amount}', (v_amount_cents / 100)::TEXT);
    v_personalized_text := REPLACE(v_personalized_text, '{circle}', v_circle_name);
    v_personalized_text := REPLACE(v_personalized_text, '{days}',   v_days_until_due::TEXT);
    v_personalized_text := REPLACE(v_personalized_text, '{date}',   to_char(v_due_date, 'FMMonth FMDD'));

    -- Insert the intervention row. All NOT-NULL-without-default columns
    -- must be supplied: member_id, level, trigger_score, trigger_bucket,
    -- message_key, message_text. Defaults fill the rest.
    INSERT INTO member_interventions (
      member_id,
      circle_id,
      level,
      trigger_score,
      trigger_bucket,
      trigger_source,
      channel,
      language,
      message_key,
      message_text,
      message_cta,
      contribution_amount_cents,
      contribution_due_date,
      days_until_due,
      options_offered,
      status,
      scheduled_at,
      sent_at
    ) VALUES (
      v_candidate.member_id,
      v_candidate.circle_id,
      v_rule.level,
      v_probability,
      v_risk_bucket,
      'rpc_mock_xnscore',
      v_rule.preferred_channel,
      v_template.language,
      v_template.message_key,
      v_personalized_text,
      v_template.cta_text,
      v_amount_cents,
      v_due_date,
      v_days_until_due,
      COALESCE(v_template.options, '[]'::jsonb),
      'sent',
      NOW(),
      NOW()
    );

    v_created := v_created + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'candidates_evaluated', v_evaluated,
    'interventions_created', v_created,
    'skipped_no_rule', v_skipped_no_rule,
    'skipped_level_too_high', v_skipped_level_too_high,
    'skipped_no_template', v_skipped_no_template,
    'skipped_cooldown', v_skipped_cooldown,
    'skipped_max_per_cycle', v_skipped_max_per_cycle,
    'source', 'mock_xnscore_inversion',
    'note', 'TEMPORARY MOCK: probability = 100 - xn_score. Swap candidate CTE for default_probability_scores when scoring-pipeline-daily is populating it.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_member_interventions()
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.process_member_interventions()
  FROM PUBLIC, anon;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('082', 'intervention_processor', ARRAY['-- 082: process_member_interventions RPC'])
ON CONFLICT (version) DO NOTHING;
