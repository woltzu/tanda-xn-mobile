-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 186: ai_decisions wiring for Honor / Stress / Mood / Intervention
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Bucket B of the Explainable AI review. The backend already had:
--   - 8 decision types seeded with templates (migration 046)
--   - record_ai_decision() RPC that renders the template into a
--     ready-to-display string and stores it in ai_decisions
--   - 4 active triggers covering XnScore, tier changes, liquidity denial,
--     and circle-join rejection (migrations 111 + 112)
--
-- This migration closes 4 gaps so AIInsightsScreen and the new
-- ScoreExplainerSheet can render the user's real history for the other
-- scoring metrics:
--
--   (1) Add `honor_score_change`, `stress_score_change`, `mood_drift_change`
--       to `explanation_templates` (EN + FR; other languages can land
--       in a later sweep).
--   (2) Trigger on honor_scores AFTER INSERT — fires record_ai_decision
--       when the delta vs. the previous row is ≥ 5 points.
--   (3) Trigger on member_stress_scores AFTER INSERT — same logic.
--   (4) Trigger on member_mood_snapshots AFTER INSERT — uses the
--       pre-computed `score_delta` + `previous_score` columns the table
--       already carries, so we avoid an extra back-query.
--   (5) Trigger on member_interventions AFTER INSERT — captures the
--       intervention_type/message_text into an `intervention_message`
--       decision so the user sees a record of every nudge they got.
--
-- payout_position is intentionally deferred: positions live across
-- payout_orders.order_data (JSONB blob), member_position_history (per-event
-- rows), and the payout_position_explanations table. Picking the right
-- trigger point needs a separate audit pass; flagging it explicitly here
-- rather than wiring a half-broken trigger.
--
-- All trigger functions wrap the record_ai_decision call in a sub-EXCEPTION
-- block so AI-side failures never roll back the upstream INSERT (matches
-- the pattern used in 111 and 112).

-- ───────────────────────────────────────────────────────────────────────────────
-- 0. Widen the decision_type check constraints on both tables.
--    Migration 046 enumerated 8 types in CHECK constraints; the new types we
--    add here need to be allowed before any INSERTs land. Both tables share
--    the same list so they stay aligned.
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.explanation_templates
  DROP CONSTRAINT IF EXISTS explanation_templates_decision_type_check;

ALTER TABLE public.explanation_templates
  ADD CONSTRAINT explanation_templates_decision_type_check
  CHECK (decision_type = ANY (ARRAY[
    'xnscore_increase'::text,
    'xnscore_decrease'::text,
    'circle_join_rejection'::text,
    'liquidity_denial'::text,
    'tier_advancement'::text,
    'tier_demotion'::text,
    'payout_position'::text,
    'intervention_message'::text,
    'honor_score_change'::text,
    'stress_score_change'::text,
    'mood_drift_change'::text
  ]));

ALTER TABLE public.ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;

ALTER TABLE public.ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type = ANY (ARRAY[
    'xnscore_increase'::text,
    'xnscore_decrease'::text,
    'circle_join_rejection'::text,
    'liquidity_denial'::text,
    'tier_advancement'::text,
    'tier_demotion'::text,
    'payout_position'::text,
    'intervention_message'::text,
    'honor_score_change'::text,
    'stress_score_change'::text,
    'mood_drift_change'::text
  ]));

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Templates (EN + FR; ON CONFLICT DO NOTHING preserves any prior seeding)
-- ───────────────────────────────────────────────────────────────────────────────

INSERT INTO public.explanation_templates (decision_type, language, template_text, required_variables, active)
VALUES
  ('honor_score_change', 'en',
   'Your Honor Score moved [DIRECTION] by [DELTA] points to [NEW_SCORE].',
   ARRAY['DIRECTION','DELTA','NEW_SCORE'], TRUE),
  ('honor_score_change', 'fr',
   'Votre Score d''Honneur a évolué de [DELTA] points ([DIRECTION]) jusqu''à [NEW_SCORE].',
   ARRAY['DIRECTION','DELTA','NEW_SCORE'], TRUE),
  ('stress_score_change', 'en',
   'Your Stress Score moved [DIRECTION] by [DELTA] points to [NEW_SCORE]. Lower is better.',
   ARRAY['DIRECTION','DELTA','NEW_SCORE'], TRUE),
  ('stress_score_change', 'fr',
   'Votre Score de Stress a évolué de [DELTA] points ([DIRECTION]) jusqu''à [NEW_SCORE]. Plus bas est mieux.',
   ARRAY['DIRECTION','DELTA','NEW_SCORE'], TRUE),
  ('mood_drift_change', 'en',
   'Your Mood Drift moved [DIRECTION] by [DELTA] points to [NEW_SCORE]. Trend: [TREND].',
   ARRAY['DIRECTION','DELTA','NEW_SCORE','TREND'], TRUE),
  ('mood_drift_change', 'fr',
   'Votre Dérive d''Humeur a évolué de [DELTA] points ([DIRECTION]) jusqu''à [NEW_SCORE]. Tendance : [TREND].',
   ARRAY['DIRECTION','DELTA','NEW_SCORE','TREND'], TRUE)
ON CONFLICT (decision_type, language) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Honor score change trigger
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_honor_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_score INT;
  v_new_score INT;
  v_delta INT;
  v_direction TEXT;
BEGIN
  v_new_score := COALESCE(ROUND(NEW.total_score)::INT, 0);

  SELECT COALESCE(ROUND(total_score)::INT, 0)
    INTO v_prev_score
    FROM public.honor_scores
   WHERE user_id = NEW.user_id
     AND id <> NEW.id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;

  -- First-ever honor score: nothing to compare to. Skip.
  IF v_prev_score IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := v_new_score - v_prev_score;
  IF ABS(v_delta) < 5 THEN
    RETURN NEW;
  END IF;

  v_direction := CASE WHEN v_delta > 0 THEN 'up' ELSE 'down' END;

  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'honor_score_change',
      v_direction,
      jsonb_build_object(
        'NEW_SCORE', v_new_score,
        'DELTA', ABS(v_delta),
        'DIRECTION', v_direction
      ),
      NEW.id,
      'honor_scores'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_honor_score_change] record_ai_decision failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS honor_scores_decision_trg ON public.honor_scores;
CREATE TRIGGER honor_scores_decision_trg
  AFTER INSERT ON public.honor_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_honor_score_change();

-- ───────────────────────────────────────────────────────────────────────────────
-- 3. Stress score change trigger
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_stress_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_score INT;
  v_new_score INT;
  v_delta INT;
  v_direction TEXT;
BEGIN
  v_new_score := COALESCE(ROUND(NEW.stress_score)::INT, 0);

  SELECT COALESCE(ROUND(stress_score)::INT, 0)
    INTO v_prev_score
    FROM public.member_stress_scores
   WHERE member_id = NEW.member_id
     AND id <> NEW.id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;

  IF v_prev_score IS NULL THEN
    RETURN NEW;
  END IF;

  v_delta := v_new_score - v_prev_score;
  IF ABS(v_delta) < 5 THEN
    RETURN NEW;
  END IF;

  v_direction := CASE WHEN v_delta > 0 THEN 'up' ELSE 'down' END;

  BEGIN
    PERFORM public.record_ai_decision(
      NEW.member_id,
      'stress_score_change',
      v_direction,
      jsonb_build_object(
        'NEW_SCORE', v_new_score,
        'DELTA', ABS(v_delta),
        'DIRECTION', v_direction
      ),
      NEW.id,
      'member_stress_scores'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_stress_score_change] record_ai_decision failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_stress_scores_decision_trg ON public.member_stress_scores;
CREATE TRIGGER member_stress_scores_decision_trg
  AFTER INSERT ON public.member_stress_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stress_score_change();

-- ───────────────────────────────────────────────────────────────────────────────
-- 4. Mood drift change trigger
-- Uses the pre-computed `score_delta` + `previous_score` columns the
-- table already carries, so no back-query is needed.
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_mood_drift_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_score INT;
  v_delta     INT;
  v_direction TEXT;
  v_trend     TEXT;
BEGIN
  v_new_score := COALESCE(ROUND(NEW.composite_mood_score)::INT, 0);
  v_delta     := COALESCE(ROUND(NEW.score_delta)::INT, 0);
  v_trend     := COALESCE(NEW.trend, 'stable');

  -- First-ever snapshot has no previous to compare to.
  IF NEW.previous_score IS NULL THEN
    RETURN NEW;
  END IF;

  IF ABS(v_delta) < 5 THEN
    RETURN NEW;
  END IF;

  v_direction := CASE WHEN v_delta > 0 THEN 'up' ELSE 'down' END;

  BEGIN
    PERFORM public.record_ai_decision(
      NEW.member_id,
      'mood_drift_change',
      v_direction,
      jsonb_build_object(
        'NEW_SCORE', v_new_score,
        'DELTA', ABS(v_delta),
        'DIRECTION', v_direction,
        'TREND', v_trend
      ),
      NEW.id,
      'member_mood_snapshots'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_mood_drift_change] record_ai_decision failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_mood_snapshots_decision_trg ON public.member_mood_snapshots;
CREATE TRIGGER member_mood_snapshots_decision_trg
  AFTER INSERT ON public.member_mood_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mood_drift_change();

-- ───────────────────────────────────────────────────────────────────────────────
-- 5. Intervention message trigger
-- member_interventions.message_text is already a rendered, human-readable
-- string. We pass it through MESSAGE so the existing intervention_message
-- template (seeded in migration 046) can substitute it verbatim. If 046's
-- template uses different placeholders, the renderer falls through to the
-- literal text — no row is lost.
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_intervention_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_message TEXT;
  v_level   TEXT;
BEGIN
  v_message := COALESCE(NEW.message_text, 'Intervention triggered');
  v_level   := COALESCE(NEW.level, 'info');

  BEGIN
    PERFORM public.record_ai_decision(
      NEW.member_id,
      'intervention_message',
      v_level,
      jsonb_build_object(
        'MESSAGE', v_message,
        'LEVEL', v_level
      ),
      NEW.id,
      'member_interventions'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_intervention_message] record_ai_decision failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_interventions_decision_trg ON public.member_interventions;
CREATE TRIGGER member_interventions_decision_trg
  AFTER INSERT ON public.member_interventions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_intervention_message();

-- ───────────────────────────────────────────────────────────────────────────────
-- 6. payout_position — DEFERRED.
-- Templates already exist (migration 046, en + 14 others). The correct
-- trigger point depends on which of three plausible sources actually
-- writes positions in prod:
--   - payout_orders.order_data (JSONB blob; coarse, one row per circle)
--   - member_position_history  (per-event rows; cleanest)
--   - payout_position_explanations (already an explanation surface — odd)
-- A separate discovery pass picks the right one before wiring; leaving a
-- placeholder comment here rather than wiring a half-broken trigger.
-- ───────────────────────────────────────────────────────────────────────────────

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '186',
  'record_score_intervention_decisions',
  ARRAY['-- 186: record_score_intervention_decisions']
)
ON CONFLICT (version) DO NOTHING;
