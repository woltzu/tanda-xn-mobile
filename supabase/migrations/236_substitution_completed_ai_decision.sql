-- ════════════════════════════════════════════════════════════════════════════
-- Migration 236: substitution_completed_ai_decision
-- Substitution Visibility — Bucket C.3
-- ════════════════════════════════════════════════════════════════════════════
--
-- Migration 208's notify_substitution_state_change writes notifications
-- rows for every state flip (pending_confirmation, admin_pending,
-- completed, declined_*, expired) — but it does NOT call
-- record_ai_decision. So the 'substitution_completed' explanation
-- template (EN + FR, present since earlier migrations; verified live
-- 2026-06-22) never lands as an AI Insights card. ai_decisions has 0
-- rows of decision_type='substitution_completed' today.
--
-- This migration follows the same isolated-wrapper pattern used by
-- migrations 219 / 220 / 223 / 231 / 233 for similar gaps:
--   • Separate AFTER UPDATE trigger (NOT folded into the existing
--     notify trigger) so a record_ai_decision failure can't roll back
--     the notification fan-out.
--   • EXCEPTION sub-block inside the wrapper so the same isolation
--     applies the other direction.
--   • Fires only when status flips into 'completed' (the terminal
--     success state). Declined / expired terminals don't need an AI
--     card — the existing template wording is success-shaped.
--
-- Schema verified live (2026-06-22):
--   • ai_decisions CHECK already admits 'substitution_completed'
--     (added in an earlier migration; no CHECK widen needed here).
--   • explanation_templates already has EN + FR rows for
--     'substitution_completed' with required_variables =
--     ['CIRCLE_NAME', 'SUBSTITUTE_NAME']. No template INSERT needed.
--   • substitution_records.entry_cycle_id / circle_id /
--     substitute_member_id / exiting_member_id columns confirmed.
--
-- Self-registers per CLAUDE.md convention.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_substitution_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name      TEXT;
  v_substitute_name  TEXT;
BEGIN
  -- Resolve display names. COALESCE chain mirrors notify_event_created
  -- (migration 223) and notify_substitution_state_change (migration 208).
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  SELECT COALESCE(display_name, full_name, 'A substitute')
    INTO v_substitute_name
    FROM public.profiles
   WHERE id = NEW.substitute_member_id;
  v_substitute_name := COALESCE(v_substitute_name, 'A substitute');

  BEGIN
    -- The 'substitution_completed' decision goes to the EXITING member
    -- (the one whose slot was filled — the audit subject). The substitute
    -- and elders already receive notification rows from migration 208's
    -- trigger; this one row is enough for the AI Insights surface.
    PERFORM public.record_ai_decision(
      NEW.exiting_member_id,
      'substitution_completed',
      v_circle_name,
      jsonb_build_object(
        'CIRCLE_NAME',     v_circle_name,
        'SUBSTITUTE_NAME', v_substitute_name
      ),
      NEW.id,
      'substitution_records'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_substitution_completed] failed for record %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Trigger only fires on the status transition INTO 'completed'.
-- AFTER UPDATE OF status with a WHEN guard avoids re-firing on
-- unrelated column updates (updated_at, completed_at, etc.).

DROP TRIGGER IF EXISTS tr_substitution_completed_ai_decision ON public.substitution_records;
CREATE TRIGGER tr_substitution_completed_ai_decision
AFTER UPDATE OF status ON public.substitution_records
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
EXECUTE FUNCTION public.record_ai_decision_for_substitution_completed();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '236',
  'substitution_completed_ai_decision',
  ARRAY['-- 236: substitution_completed_ai_decision']
)
ON CONFLICT (version) DO NOTHING;
