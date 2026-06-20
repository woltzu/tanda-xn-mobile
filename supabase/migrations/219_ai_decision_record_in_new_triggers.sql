-- ════════════════════════════════════════════════════════════════════════════
-- 219_ai_decision_record_in_new_triggers.sql
-- Explainable AI — Bucket C
-- ════════════════════════════════════════════════════════════════════════════
--
-- The newer score-domain and lifecycle triggers (xnscore tier, honor tier,
-- stress status, swap completed, cycle closed, substitution completed,
-- partial-plan completed, dispute resolved) emit user-facing notifications
-- but do NOT call record_ai_decision. That gap means the AI Insights screen
-- has no explanation row for those events.
--
-- Mood drift is already covered (notify_mood_drift_change preserves a legacy
-- record_ai_decision call on |delta| >= 5). Honor / stress SCORE-change
-- triggers also already call record_ai_decision when |delta| >= 5
-- (honor_scores_decision_trg + member_stress_scores_decision_trg). What's
-- missing is the TIER / STATUS-flip side and the lifecycle transitions.
--
-- Architectural choice: rather than rewriting each large user-facing trigger
-- to add a record_ai_decision call inside its EXCEPTION block, this migration
-- adds eight SEPARATE trigger functions (record_ai_decision_for_*) that fire
-- ONLY for the relevant transitions and do nothing other than call
-- record_ai_decision in an isolated EXCEPTION sub-block. The existing
-- user-facing notification functions are left untouched.
--
-- Six new decision_type values are introduced:
--   - stress_status_change   (status-flip flavor of stress)
--   - swap_completed
--   - cycle_state_change
--   - substitution_completed
--   - partial_plan_completed
--   - conflict_resolved
--
-- For xnscore + honor tier flips we reuse the existing tier_advancement /
-- tier_demotion templates (15 languages each).
--
-- Dispatcher dedup: cron jobs ai-insight-notification-every-2-min and
-- ai-weekly-digest-monday are already active (verified at recon time).
-- This migration intentionally does NOT modify notify_ai_insight — the
-- EF gains a defensive dedup pass instead. No double-push happens today
-- (only ai_insight rows are pushed by any EF); the EF dedup is future-proof.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Widen CHECK constraints to include 6 new decision types ──────

ALTER TABLE public.ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;
ALTER TABLE public.ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease',
    'circle_join_rejection', 'liquidity_denial',
    'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message',
    'honor_score_change', 'stress_score_change', 'mood_drift_change',
    -- New in 219
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved'
  ));

ALTER TABLE public.explanation_templates
  DROP CONSTRAINT IF EXISTS explanation_templates_decision_type_check;
ALTER TABLE public.explanation_templates
  ADD CONSTRAINT explanation_templates_decision_type_check
  CHECK (decision_type IN (
    'xnscore_increase', 'xnscore_decrease',
    'circle_join_rejection', 'liquidity_denial',
    'tier_advancement', 'tier_demotion',
    'payout_position', 'intervention_message',
    'honor_score_change', 'stress_score_change', 'mood_drift_change',
    -- New in 219
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved'
  ));

-- ─── PART 2: EN + FR templates for 6 new decision types ───────────────────
-- record_ai_decision interpolates [VAR] placeholders against
-- required_variables. Other languages can be backfilled later — the engine
-- falls back to 'en' when a locale template is missing.

INSERT INTO public.explanation_templates
  (decision_type, language, template_text, required_variables, active, created_at, updated_at)
VALUES
  ('stress_status_change', 'en',
   'Your Stress Score is now [NEW_STATUS] (score [NEW_SCORE]/100). Top stressor: [TOP_STRESSOR].',
   ARRAY['NEW_STATUS','NEW_SCORE','TOP_STRESSOR'], true, now(), now()),
  ('stress_status_change', 'fr',
   'Votre Score de Stress est maintenant [NEW_STATUS] (score [NEW_SCORE]/100). Facteur principal : [TOP_STRESSOR].',
   ARRAY['NEW_STATUS','NEW_SCORE','TOP_STRESSOR'], true, now(), now()),

  ('swap_completed', 'en',
   'Your position swap in [CIRCLE_NAME] is complete. Your new payout position is #[NEW_POSITION].',
   ARRAY['CIRCLE_NAME','NEW_POSITION'], true, now(), now()),
  ('swap_completed', 'fr',
   'Votre échange de position dans [CIRCLE_NAME] est terminé. Votre nouvelle position de paiement est #[NEW_POSITION].',
   ARRAY['CIRCLE_NAME','NEW_POSITION'], true, now(), now()),

  ('cycle_state_change', 'en',
   'Cycle [CYCLE_NUMBER] of [CIRCLE_NAME] is now [CYCLE_STATUS].',
   ARRAY['CYCLE_NUMBER','CIRCLE_NAME','CYCLE_STATUS'], true, now(), now()),
  ('cycle_state_change', 'fr',
   'Le cycle [CYCLE_NUMBER] de [CIRCLE_NAME] est maintenant [CYCLE_STATUS].',
   ARRAY['CYCLE_NUMBER','CIRCLE_NAME','CYCLE_STATUS'], true, now(), now()),

  ('substitution_completed', 'en',
   'A substitution for [CIRCLE_NAME] is complete. [SUBSTITUTE_NAME] has joined as the new member.',
   ARRAY['CIRCLE_NAME','SUBSTITUTE_NAME'], true, now(), now()),
  ('substitution_completed', 'fr',
   'Une substitution pour [CIRCLE_NAME] est terminée. [SUBSTITUTE_NAME] a rejoint comme nouveau membre.',
   ARRAY['CIRCLE_NAME','SUBSTITUTE_NAME'], true, now(), now()),

  ('partial_plan_completed', 'en',
   'Your flexible payment plan for [CIRCLE_NAME] is fully paid. Thank you for staying current.',
   ARRAY['CIRCLE_NAME'], true, now(), now()),
  ('partial_plan_completed', 'fr',
   'Votre plan de paiement flexible pour [CIRCLE_NAME] est entièrement réglé. Merci d''être à jour.',
   ARRAY['CIRCLE_NAME'], true, now(), now()),

  ('conflict_resolved', 'en',
   'A dispute in [CIRCLE_NAME] has been [RESOLUTION].',
   ARRAY['CIRCLE_NAME','RESOLUTION'], true, now(), now()),
  ('conflict_resolved', 'fr',
   'Un litige dans [CIRCLE_NAME] a été [RESOLUTION].',
   ARRAY['CIRCLE_NAME','RESOLUTION'], true, now(), now())
ON CONFLICT DO NOTHING;

-- ─── PART 3: Eight SEPARATE record_ai_decision trigger functions ──────────
-- Each function is SECURITY DEFINER with pinned search_path and wraps the
-- record_ai_decision call in EXCEPTION WHEN OTHERS so an AI-recording
-- failure cannot roll back the source-table mutation.

-- 3a. xnscore tier change → tier_advancement / tier_demotion ──────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_xnscore_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_direction TEXT;
  v_decision_type TEXT;
BEGIN
  IF OLD.score_tier IS NOT DISTINCT FROM NEW.score_tier THEN
    RETURN NEW;
  END IF;
  v_direction := CASE
    WHEN CASE OLD.score_tier WHEN 'elite' THEN 6 WHEN 'excellent' THEN 5
                              WHEN 'good' THEN 4 WHEN 'fair' THEN 3
                              WHEN 'poor' THEN 2 ELSE 1 END
       < CASE NEW.score_tier WHEN 'elite' THEN 6 WHEN 'excellent' THEN 5
                              WHEN 'good' THEN 4 WHEN 'fair' THEN 3
                              WHEN 'poor' THEN 2 ELSE 1 END
    THEN 'up' ELSE 'down' END;
  v_decision_type := CASE WHEN v_direction = 'up' THEN 'tier_advancement' ELSE 'tier_demotion' END;
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      v_decision_type,
      NEW.score_tier::TEXT,
      jsonb_build_object(
        'PREVIOUS_TIER',      OLD.score_tier::TEXT,
        'TIER_NAME',          NEW.score_tier::TEXT,
        'FEATURE_UNLOCKED',   'increased trust and higher advance limits',
        'FACTOR_DESCRIPTION', 'a decline in your XnScore',
        'SPECIFIC_ACTION',    'make on-time contributions, complete circles, and avoid defaults',
        'NEW_SCORE',          COALESCE(NEW.total_score::TEXT, '0')
      ),
      NEW.id,
      'xn_scores'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_xnscore_tier] failed for user %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_xnscore_tier_ai_decision ON public.xn_scores;
CREATE TRIGGER tr_xnscore_tier_ai_decision
AFTER UPDATE OF score_tier ON public.xn_scores
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_xnscore_tier();

-- 3b. honor tier change → tier_advancement / tier_demotion ────────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_honor_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_direction TEXT;
  v_decision_type TEXT;
BEGIN
  IF OLD.score_tier IS NOT DISTINCT FROM NEW.score_tier THEN
    RETURN NEW;
  END IF;
  v_direction := CASE
    WHEN CASE OLD.score_tier::TEXT
            WHEN 'Grand Elder' THEN 5 WHEN 'Elder' THEN 4
            WHEN 'Respected'  THEN 3 WHEN 'Trusted' THEN 2
            ELSE 1 END
       < CASE NEW.score_tier::TEXT
            WHEN 'Grand Elder' THEN 5 WHEN 'Elder' THEN 4
            WHEN 'Respected'  THEN 3 WHEN 'Trusted' THEN 2
            ELSE 1 END
    THEN 'up' ELSE 'down' END;
  v_decision_type := CASE WHEN v_direction = 'up' THEN 'tier_advancement' ELSE 'tier_demotion' END;
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      v_decision_type,
      NEW.score_tier::TEXT,
      jsonb_build_object(
        'PREVIOUS_TIER',      OLD.score_tier::TEXT,
        'TIER_NAME',          NEW.score_tier::TEXT,
        'FEATURE_UNLOCKED',   'higher community standing and more vouching weight',
        'FACTOR_DESCRIPTION', 'a decline in your Honor Score',
        'SPECIFIC_ACTION',    'continue vouching reliably, complete mediations, and avoid disputes',
        'NEW_SCORE',          COALESCE(NEW.total_score::TEXT, '0')
      ),
      NEW.id,
      'honor_scores'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_honor_tier] failed for user %: %', NEW.user_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_honor_tier_ai_decision ON public.honor_scores;
CREATE TRIGGER tr_honor_tier_ai_decision
AFTER UPDATE OF score_tier ON public.honor_scores
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_honor_tier();

-- 3c. stress status change → stress_status_change ─────────────────────────
-- Fires on INSERT (member_stress_scores is append-only) when status
-- crosses INTO orange / red from green / yellow. Mirrors the gate in
-- notify_stress_status_change so the two stay in lockstep.

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_stress_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_status TEXT;
  v_top_stressor TEXT;
BEGIN
  IF NEW.status NOT IN ('orange','red') THEN
    RETURN NEW;
  END IF;
  SELECT status INTO v_prev_status
    FROM public.member_stress_scores
   WHERE member_id = NEW.member_id AND id != NEW.id
   ORDER BY created_at DESC LIMIT 1;
  IF v_prev_status IN ('orange','red') THEN
    RETURN NEW;
  END IF;
  v_top_stressor := public.stress_top_stressor_key(NEW.signal_breakdown);
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.member_id,
      'stress_status_change',
      NEW.status,
      jsonb_build_object(
        'NEW_STATUS',   NEW.status,
        'NEW_SCORE',    COALESCE(NEW.stress_score::TEXT, '0'),
        'TOP_STRESSOR', COALESCE(v_top_stressor, 'unknown')
      ),
      NEW.id,
      'member_stress_scores'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_stress_status] failed for member %: %', NEW.member_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_stress_status_ai_decision ON public.member_stress_scores;
CREATE TRIGGER tr_stress_status_ai_decision
AFTER INSERT ON public.member_stress_scores
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_stress_status();

-- 3d. swap completed → swap_completed ─────────────────────────────────────
-- Records two decisions per completion: one for the requester (their new
-- position is the target_position) and one for the target (their new
-- position is the requester_position).

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_swap_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.swap_status = NEW.swap_status THEN
    RETURN NEW;
  END IF;
  IF NEW.swap_status <> 'completed' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.requester_user_id,
      'swap_completed',
      'completed',
      jsonb_build_object(
        'CIRCLE_NAME',  v_circle_name,
        'NEW_POSITION', COALESCE(NEW.target_position::TEXT, '?')
      ),
      NEW.id,
      'position_swap_requests'
    );
    PERFORM public.record_ai_decision(
      NEW.target_user_id,
      'swap_completed',
      'completed',
      jsonb_build_object(
        'CIRCLE_NAME',  v_circle_name,
        'NEW_POSITION', COALESCE(NEW.requester_position::TEXT, '?')
      ),
      NEW.id,
      'position_swap_requests'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_swap_completion] failed for swap %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_swap_completion_ai_decision ON public.position_swap_requests;
CREATE TRIGGER tr_swap_completion_ai_decision
AFTER UPDATE OF swap_status ON public.position_swap_requests
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_swap_completion();

-- 3e. cycle state change → cycle_state_change ─────────────────────────────
-- Records one decision per significant cycle transition for the recipient
-- (the member whose payout this cycle is). Fans out by recording only for
-- the recipient — non-recipient members already receive the user-facing
-- notification via notify_cycle_state_change.

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_cycle_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
BEGIN
  IF OLD.cycle_status IS NOT DISTINCT FROM NEW.cycle_status THEN
    RETURN NEW;
  END IF;
  -- Only the recipient gets a personal AI decision; this keeps the
  -- ai_decisions table from exploding on every cycle event for every
  -- member of every circle.
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Limit to the transitions that meaningfully affect the recipient.
  IF NEW.cycle_status NOT IN ('collecting','payout_ready','cycle_closed') THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.recipient_user_id,
      'cycle_state_change',
      NEW.cycle_status::TEXT,
      jsonb_build_object(
        'CYCLE_NUMBER',  COALESCE(NEW.cycle_number::TEXT, '?'),
        'CIRCLE_NAME',   v_circle_name,
        'CYCLE_STATUS',  NEW.cycle_status::TEXT
      ),
      NEW.id,
      'circle_cycles'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_cycle_state] failed for cycle %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_cycle_state_ai_decision ON public.circle_cycles;
CREATE TRIGGER tr_cycle_state_ai_decision
AFTER UPDATE OF cycle_status ON public.circle_cycles
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_cycle_state();

-- 3f. substitution completed → substitution_completed ─────────────────────
-- Records for both the exiting member and the substitute on completion.

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_substitution_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name     TEXT;
  v_substitute_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  SELECT full_name INTO v_substitute_name FROM public.profiles WHERE id = NEW.substitute_member_id;
  v_substitute_name := COALESCE(v_substitute_name, 'A substitute');
  BEGIN
    -- Substitute
    PERFORM public.record_ai_decision(
      NEW.substitute_member_id,
      'substitution_completed',
      'completed',
      jsonb_build_object(
        'CIRCLE_NAME',     v_circle_name,
        'SUBSTITUTE_NAME', v_substitute_name
      ),
      NEW.id,
      'substitution_records'
    );
    -- Exiting member
    IF NEW.exiting_member_id IS NOT NULL THEN
      PERFORM public.record_ai_decision(
        NEW.exiting_member_id,
        'substitution_completed',
        'completed',
        jsonb_build_object(
          'CIRCLE_NAME',     v_circle_name,
          'SUBSTITUTE_NAME', v_substitute_name
        ),
        NEW.id,
        'substitution_records'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_substitution_completion] failed for record %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_substitution_completion_ai_decision ON public.substitution_records;
CREATE TRIGGER tr_substitution_completion_ai_decision
AFTER UPDATE OF status ON public.substitution_records
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_substitution_completion();

-- 3g. partial plan completed → partial_plan_completed ─────────────────────

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_partial_plan_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.member_id,
      'partial_plan_completed',
      'completed',
      jsonb_build_object(
        'CIRCLE_NAME', v_circle_name
      ),
      NEW.id,
      'partial_contribution_plans'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_partial_plan_completion] failed for plan %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_partial_plan_completion_ai_decision ON public.partial_contribution_plans;
CREATE TRIGGER tr_partial_plan_completion_ai_decision
AFTER UPDATE OF status ON public.partial_contribution_plans
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_partial_plan_completion();

-- 3h. dispute resolution → conflict_resolved ──────────────────────────────
-- Records for both complainant and respondent when the dispute moves to
-- resolved / dismissed. Skips the elder_l2 / global_queue tier flips
-- (those are about escalation, not resolution).

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_dispute_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_resolution  TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('resolved','dismissed') THEN
    RETURN NEW;
  END IF;
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  v_resolution := NEW.status;
  BEGIN
    IF NEW.complainant_id IS NOT NULL THEN
      PERFORM public.record_ai_decision(
        NEW.complainant_id,
        'conflict_resolved',
        v_resolution,
        jsonb_build_object(
          'CIRCLE_NAME', v_circle_name,
          'RESOLUTION',  v_resolution
        ),
        NEW.id,
        'dispute_cases'
      );
    END IF;
    IF NEW.respondent_id IS NOT NULL THEN
      PERFORM public.record_ai_decision(
        NEW.respondent_id,
        'conflict_resolved',
        v_resolution,
        jsonb_build_object(
          'CIRCLE_NAME', v_circle_name,
          'RESOLUTION',  v_resolution
        ),
        NEW.id,
        'dispute_cases'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_dispute_resolution] failed for dispute %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_dispute_resolution_ai_decision ON public.dispute_cases;
CREATE TRIGGER tr_dispute_resolution_ai_decision
AFTER UPDATE OF status ON public.dispute_cases
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_dispute_resolution();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '219',
  'ai_decision_record_in_new_triggers',
  ARRAY['-- 219: ai_decision_record_in_new_triggers']
)
ON CONFLICT (version) DO NOTHING;
