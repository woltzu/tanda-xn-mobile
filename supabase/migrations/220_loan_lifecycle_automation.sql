-- ════════════════════════════════════════════════════════════════════════════
-- 220_loan_lifecycle_automation.sql
-- Credit Profile — Bucket C
-- ════════════════════════════════════════════════════════════════════════════
--
-- The loan-domain tables (loans / loan_payments / loan_applications) have no
-- user-facing notification triggers today and never feed the AI Insights
-- screen. This migration closes both gaps:
--
--   1. Four notification triggers on the modern schema:
--        notify_loan_disbursed              (loans INSERT)
--        notify_loan_payment_recorded       (loan_payments INSERT)
--        notify_loan_overdue                (loans UPDATE OF is_delinquent → true)
--        notify_loan_application_status     (loan_applications UPDATE OF status
--                                            → approved / rejected / disbursed)
--
--   2. Two SEPARATE record_ai_decision wrappers (same architectural pattern as
--      migration 219 — small isolated functions, EXCEPTION-wrapped):
--        record_ai_decision_for_loan_disbursed  → 'loan_disbursed'
--        record_ai_decision_for_loan_default    → 'loan_default'
--
--   3. CHECK constraint widening on ai_decisions + explanation_templates to
--      admit 'loan_disbursed' and 'loan_default'.
--
--   4. EN + FR templates for both new types. The engine falls back to 'en'
--      for other languages until backfill.
--
-- Cron note: the existing `check-overdue-payments` job (0 */6 * * *) already
-- calls `check_overdue_loans()` — verified at recon. The Bucket-C goal said
-- "verify, and add if missing"; verified-present, no schedule added. Same
-- result for `send_loan_repayment_reminders` would mean adding a fresh
-- schedule, but BOTH RPCs are schema-stale (they reference borrower_id,
-- groups, users, and old notification columns that no longer exist). The
-- new triggers in this migration target the modern schema and operate on
-- real INSERT / UPDATE events the app actually produces, so the screen is
-- live without depending on those stale RPCs. Cleanup of the stale RPCs is
-- explicitly OUT OF SCOPE for this migration and tracked as separate
-- tech-debt.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: Widen CHECK constraints to include 2 new decision types ──────

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
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved',
    -- New in 220
    'loan_disbursed',
    'loan_default'
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
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved',
    -- New in 220
    'loan_disbursed',
    'loan_default'
  ));

-- ─── PART 2: EN + FR templates for both new decision types ────────────────
-- record_ai_decision interpolates [VAR] placeholders against
-- required_variables — keep variable names ALL CAPS like prior templates.

INSERT INTO public.explanation_templates
  (decision_type, language, template_text, required_variables, active, created_at, updated_at)
VALUES
  ('loan_disbursed', 'en',
   'Your loan of $[AMOUNT] was disbursed to your wallet on [DATE].',
   ARRAY['AMOUNT','DATE'], true, now(), now()),
  ('loan_disbursed', 'fr',
   'Votre prêt de [AMOUNT] $ a été versé dans votre portefeuille le [DATE].',
   ARRAY['AMOUNT','DATE'], true, now(), now()),

  ('loan_default', 'en',
   'Your loan is now overdue by [DAYS] day(s). Please make a payment to avoid further penalties.',
   ARRAY['DAYS'], true, now(), now()),
  ('loan_default', 'fr',
   'Votre prêt est en retard de [DAYS] jour(s). Veuillez effectuer un paiement pour éviter d''autres pénalités.',
   ARRAY['DAYS'], true, now(), now())
ON CONFLICT DO NOTHING;

-- ─── PART 3: Notification triggers (4) ────────────────────────────────────
-- All SECURITY DEFINER with pinned search_path. Each one wraps the insert
-- in an EXCEPTION sub-block so a notification fan-out failure cannot roll
-- back the source-table mutation. Idempotency keys are scoped per-event
-- so re-fires (or trigger re-orderings) don't dup the user's inbox.

-- 3a. notify_loan_disbursed — fires on every loans INSERT.

CREATE OR REPLACE FUNCTION public.notify_loan_disbursed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount_str  TEXT;
  v_existing_id UUID;
BEGIN
  v_amount_str := TRIM(TO_CHAR(COALESCE(NEW.principal_cents, 0) / 100.0, 'FM999G999G990D00'));
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'loan_disbursed'
       AND data->>'loan_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'loan_disbursed',
        'Loan disbursed',
        'Your loan of $' || v_amount_str || ' has been disbursed to your wallet.',
        jsonb_build_object(
          'loan_id',         NEW.id,
          'amount_cents',    NEW.principal_cents,
          'i18n_title_key',  'loan.notification_disbursed_title',
          'i18n_body_key',   'loan.notification_disbursed_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_loan_disbursed] failed for loan %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_disbursed_notify ON public.loans;
CREATE TRIGGER tr_loan_disbursed_notify
AFTER INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.notify_loan_disbursed();

-- 3b. notify_loan_payment_recorded — fires on every loan_payments INSERT.

CREATE OR REPLACE FUNCTION public.notify_loan_payment_recorded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount_str  TEXT;
  v_existing_id UUID;
BEGIN
  -- Skip non-completed payments (failed / pending) — only confirmed
  -- applications fire a "recorded" notification.
  IF NEW.status IS DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  v_amount_str := TRIM(TO_CHAR(COALESCE(NEW.amount_cents, 0) / 100.0, 'FM999G999G990D00'));
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'loan_payment_recorded'
       AND data->>'payment_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'loan_payment_recorded',
        'Loan payment recorded',
        'Your payment of $' || v_amount_str || ' has been applied to your loan.',
        jsonb_build_object(
          'loan_id',         NEW.loan_id,
          'payment_id',      NEW.id,
          'amount_cents',    NEW.amount_cents,
          'i18n_title_key',  'loan.notification_payment_recorded_title',
          'i18n_body_key',   'loan.notification_payment_recorded_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_loan_payment_recorded] failed for payment %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_payment_recorded_notify ON public.loan_payments;
CREATE TRIGGER tr_loan_payment_recorded_notify
AFTER INSERT ON public.loan_payments
FOR EACH ROW
EXECUTE FUNCTION public.notify_loan_payment_recorded();

-- 3c. notify_loan_overdue — fires when loans.is_delinquent flips to true.

CREATE OR REPLACE FUNCTION public.notify_loan_overdue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_today       TEXT;
BEGIN
  -- Only on the false → true crossing.
  IF NOT (OLD.is_delinquent IS DISTINCT FROM NEW.is_delinquent AND NEW.is_delinquent = TRUE) THEN
    RETURN NEW;
  END IF;
  v_today := TO_CHAR((now() AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD');
  BEGIN
    -- Day-precision idempotency: a flip-flap (true → false → true) on the
    -- same day should not double-notify.
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'loan_overdue'
       AND data->>'loan_id' = NEW.id::text
       AND data->>'flipped_at' = v_today
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'loan_overdue',
        'Loan overdue',
        'Your loan is now overdue. Please make a payment to avoid additional fees.',
        jsonb_build_object(
          'loan_id',         NEW.id,
          'days_past_due',   COALESCE(NEW.days_past_due, 0),
          'flipped_at',      v_today,
          'i18n_title_key',  'loan.notification_overdue_title',
          'i18n_body_key',   'loan.notification_overdue_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_loan_overdue] failed for loan %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_overdue_notify ON public.loans;
CREATE TRIGGER tr_loan_overdue_notify
AFTER UPDATE OF is_delinquent ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.notify_loan_overdue();

-- 3d. notify_loan_application_status — fires on loan_applications status
--      transitions to approved / rejected / disbursed.

CREATE OR REPLACE FUNCTION public.notify_loan_application_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status      TEXT;
  v_existing_id UUID;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  v_status := NEW.status::TEXT;
  IF v_status NOT IN ('approved','rejected','disbursed') THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'loan_application_status'
       AND data->>'application_id' = NEW.id::text
       AND data->>'status' = v_status
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'loan_application_status',
        'Loan application ' || v_status,
        'Your loan application has been ' || v_status || '.',
        jsonb_build_object(
          'application_id',  NEW.id,
          'status',          v_status,
          'i18n_title_key',  'loan.notification_application_status_title',
          'i18n_body_key',   'loan.notification_application_status_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_loan_application_status] failed for application %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_application_status_notify ON public.loan_applications;
CREATE TRIGGER tr_loan_application_status_notify
AFTER UPDATE OF status ON public.loan_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_loan_application_status();

-- ─── PART 4: Separate record_ai_decision wrappers (2) ─────────────────────
-- Mirrors the migration-219 architectural choice: isolated functions that
-- ONLY call record_ai_decision, EXCEPTION-wrapped. Keeps the AI-recording
-- path independent of the user-facing notification fan-out above.

-- 4a. loan_disbursed → record_ai_decision

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_loan_disbursed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount_str TEXT;
  v_date_str   TEXT;
BEGIN
  v_amount_str := TRIM(TO_CHAR(COALESCE(NEW.principal_cents, 0) / 100.0, 'FM999G999G990D00'));
  v_date_str   := TO_CHAR((now() AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD');
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'loan_disbursed',
      v_amount_str,
      jsonb_build_object(
        'AMOUNT', v_amount_str,
        'DATE',   v_date_str
      ),
      NEW.id,
      'loans'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_loan_disbursed] failed for loan %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_disbursed_ai_decision ON public.loans;
CREATE TRIGGER tr_loan_disbursed_ai_decision
AFTER INSERT ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_loan_disbursed();

-- 4b. loan_default → record_ai_decision (fires on is_delinquent crossing).

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_loan_default()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (OLD.is_delinquent IS DISTINCT FROM NEW.is_delinquent AND NEW.is_delinquent = TRUE) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.record_ai_decision(
      NEW.user_id,
      'loan_default',
      COALESCE(NEW.days_past_due, 0)::TEXT,
      jsonb_build_object(
        'DAYS', COALESCE(NEW.days_past_due, 0)::TEXT
      ),
      NEW.id,
      'loans'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_loan_default] failed for loan %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_loan_default_ai_decision ON public.loans;
CREATE TRIGGER tr_loan_default_ai_decision
AFTER UPDATE OF is_delinquent ON public.loans
FOR EACH ROW
EXECUTE FUNCTION public.record_ai_decision_for_loan_default();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '220',
  'loan_lifecycle_automation',
  ARRAY['-- 220: loan_lifecycle_automation']
)
ON CONFLICT (version) DO NOTHING;
