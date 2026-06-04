-- ════════════════════════════════════════════════════════════════════════════
-- Migration 110: Explainable AI — SQL-side recorder
-- D1 of feat(explainable-ai) #83.
-- ════════════════════════════════════════════════════════════════════════════
-- The TS ExplainableAIEngine (1,014 LOC) records decisions via supabase-js
-- INSERTs from the client. But most decision points are PL/pgSQL functions
-- (check_liquidity_advance_eligibility, evaluate_member_tier,
-- compute_circle_reputation, …) that can't reach client-side code. We need
-- a SQL twin so those functions can record decisions inline.
--
-- This migration ships ONE function:
--
--   record_ai_decision(
--     p_member_id UUID,
--     p_decision_type TEXT,
--     p_decision_value TEXT,
--     p_explanation_data JSONB,
--     p_source_event_id UUID DEFAULT NULL,
--     p_source_event_type TEXT DEFAULT NULL
--   ) → JSONB
--
-- Logic:
--   1. Resolve language from profiles.language with 'en' fallback.
--   2. Look up active template for (decision_type, language) in
--      explanation_templates. If none for the user's language, fall back
--      to the English template. Both fallbacks are silent — we'd rather
--      have an English explanation than no explanation.
--   3. Render: simple `[VAR]` → explanation_data->>'VAR' substitution.
--      Missing variables remain as literal `[VAR]` so the gap is visible
--      in the rendered text (debuggable).
--   4. INSERT INTO ai_decisions with rendered_explanation + chosen language.
--   5. Return JSONB summary including the new decision_id, rendered text,
--      language used, and a fallback_used flag.
--
-- SECURITY DEFINER. Granted to service_role only — other SECURITY DEFINER
-- functions (the decision-point gates we wire in D2) will invoke it via
-- their elevated context.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.record_ai_decision(
  p_member_id UUID,
  p_decision_type TEXT,
  p_decision_value TEXT,
  p_explanation_data JSONB,
  p_source_event_id UUID DEFAULT NULL,
  p_source_event_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lang TEXT;
  v_template RECORD;
  v_fallback_used BOOLEAN := false;
  v_rendered TEXT;
  v_var TEXT;
  v_value TEXT;
  v_decision_id UUID;
BEGIN
  -- (1) Resolve member language
  SELECT COALESCE(language, 'en') INTO v_lang
  FROM profiles WHERE id = p_member_id;

  IF v_lang IS NULL THEN
    v_lang := 'en';
  END IF;

  -- (2) Find active template for that language
  SELECT id, template_text, required_variables, language INTO v_template
  FROM explanation_templates
  WHERE decision_type = p_decision_type
    AND language = v_lang
    AND active = true
  LIMIT 1;

  IF NOT FOUND THEN
    -- Fall back to English
    SELECT id, template_text, required_variables, language INTO v_template
    FROM explanation_templates
    WHERE decision_type = p_decision_type
      AND language = 'en'
      AND active = true
    LIMIT 1;

    v_fallback_used := true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('No active template found for decision_type=%s', p_decision_type)
      );
    END IF;
  END IF;

  -- (3) Render: `[VAR]` → explanation_data->>'VAR'. Missing vars stay as
  -- literal `[VAR]` so the gap is visible in the output (debug-friendly).
  v_rendered := v_template.template_text;

  IF v_template.required_variables IS NOT NULL THEN
    FOREACH v_var IN ARRAY v_template.required_variables LOOP
      v_value := p_explanation_data->>v_var;
      IF v_value IS NOT NULL THEN
        v_rendered := REPLACE(v_rendered, '[' || v_var || ']', v_value);
      END IF;
    END LOOP;
  END IF;

  -- (4) INSERT
  INSERT INTO ai_decisions (
    member_id, decision_type, decision_value,
    explanation_key, explanation_data, rendered_explanation, language,
    source_event_id, source_event_type, notification_sent
  ) VALUES (
    p_member_id, p_decision_type, p_decision_value,
    v_template.id::TEXT, p_explanation_data, v_rendered, v_template.language,
    p_source_event_id, p_source_event_type, false
  )
  RETURNING id INTO v_decision_id;

  -- (5) Return summary
  RETURN jsonb_build_object(
    'success', true,
    'decision_id', v_decision_id,
    'language_used', v_template.language,
    'fallback_to_english', v_fallback_used,
    'rendered_explanation', v_rendered,
    'source', 'record_ai_decision_rpc'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.record_ai_decision(UUID, TEXT, TEXT, JSONB, UUID, TEXT)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_ai_decision(UUID, TEXT, TEXT, JSONB, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('110', 'explainable_ai_recorder',
        ARRAY['-- 110: ExplainableAI D1 — SQL-side record_ai_decision()'])
ON CONFLICT (version) DO NOTHING;
