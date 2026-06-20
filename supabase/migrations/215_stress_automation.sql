-- ════════════════════════════════════════════════════════════════════════════
-- Migration 215: stress_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Stress Score review.
--
-- Buckets A and B made the screen clear (real data + direction subtitle +
-- top-stressor card + suggestions when no active intervention + i18n
-- sweep) and gave it a HelpSheet + coach mark + per-signal explainer +
-- chart polish + privacy footer. The score itself was still drifting in
-- two ways that this migration closes:
--
--   1. Status crossings were silent. A member whose stress score moved
--      from yellow into orange (61–80) — the band where the screen says
--      "this is when we may proactively offer help" — got nothing. No
--      notification, no pre-prepared intervention. The user had to open
--      the screen on their own to find out something had changed.
--
--   2. The intervention pipeline was reactive only. stress_interventions
--      rows only existed when an admin or a backend job inserted them.
--      For a member crossing into orange for the first time, that meant
--      seeing the screen's "Suggested next steps" placeholder rather
--      than a real prepared offer (a payment-restructuring plan, a
--      counsellor referral, etc.).
--
-- This migration adds:
--
--   1. notify_stress_status_change trigger on member_stress_scores AFTER
--      INSERT. The table is append-only (one row per scoring window per
--      member); the trigger looks up the immediately-prior row for the
--      same member and only fires when the NEW row's status is
--      'orange'/'red' AND the prior status was not. Emits a
--      stress_status_change notification carrying status / score /
--      top_stressor / changed_at. Idempotent on
--      (user_id, type, data->>'changed_at') stamped at date precision.
--      Carries i18n_title_key / i18n_body_key in data.
--
--   2. Auto-suggest intervention on first orange transition. When the
--      same INSERT detects the FIRST orange/red crossing in the last
--      30 days (so the user only gets one auto-suggestion per stress
--      episode, not one per day they sit at orange), the trigger
--      function INSERTs a pending stress_interventions row. The
--      intervention_type is derived from the top stressor in
--      signal_breakdown:
--
--        contribution_delay   → payment_restructuring
--        ticket_language      → counselor_referral
--        login_drop           → check_in_nudge
--        early_payout_request → liquidity_advance
--
--      The screen's existing intervention card (Bucket A/B) then renders
--      the row's message_title + message_body and lets the user
--      accept / decline.
--
-- All trigger functions: SECURITY DEFINER + pinned
-- search_path = public, pg_temp + EXCEPTION sub-block so a fan-out /
-- intervention-insert failure can't roll back the score row that
-- triggered it. Mirrors migrations 188 / 205 / 207 / 208 / 209 / 210 /
-- 211 / 212 / 213 / 214.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: derive top stressor key from a signal_breakdown JSONB
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns the signal key (e.g. 'contribution_delay') with the highest
-- weighted_value, or NULL when the JSON is empty / malformed.
CREATE OR REPLACE FUNCTION public.stress_top_stressor_key(p_breakdown JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF p_breakdown IS NULL OR jsonb_typeof(p_breakdown) != 'object' THEN
    RETURN NULL;
  END IF;

  SELECT k INTO v_key
    FROM jsonb_each(p_breakdown) AS j(k, v)
   WHERE jsonb_typeof(j.v) = 'object'
     AND (j.v->>'weighted_value') IS NOT NULL
   ORDER BY (j.v->>'weighted_value')::DECIMAL DESC
   LIMIT 1;

  RETURN v_key;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notify_stress_status_change trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_stress_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_status         TEXT;
  v_top_stressor        TEXT;
  v_changed_at          TEXT;
  v_existing_id         UUID;
  v_intervention_type   TEXT;
  v_prior_alert_count   INTEGER;
  v_message_title       TEXT;
  v_message_body        TEXT;
BEGIN
  -- Only react to transitions INTO orange / red. Yellow / green and
  -- back-to-green sit silent — we don't want to nag a recovering user.
  IF NEW.status NOT IN ('orange', 'red') THEN
    RETURN NEW;
  END IF;

  -- Find the immediately-prior row for this member. The table is
  -- append-only and ordered by created_at; the prior row's status
  -- tells us whether this is a crossing or a continuation.
  SELECT status INTO v_prev_status
    FROM public.member_stress_scores
   WHERE member_id = NEW.member_id
     AND id != NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  -- If the member was already at orange/red, this is a continuation —
  -- skip the notification (and skip the auto-intervention so we don't
  -- spawn a duplicate offer every score window).
  IF v_prev_status IN ('orange', 'red') THEN
    RETURN NEW;
  END IF;

  v_top_stressor := public.stress_top_stressor_key(NEW.signal_breakdown);

  -- Date-precision idempotency: one notification per (user, type, day).
  -- The trigger fires on each INSERT; same-day re-scoring shouldn't
  -- spam the user.
  v_changed_at := TO_CHAR((now() AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD');

  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'stress_status_change'
       AND data->>'changed_at' = v_changed_at
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'stress_status_change',
        'Stress Score alert',
        'Your stress score is now ' || NEW.status || '. Tap to see details and suggested actions.',
        jsonb_build_object(
          'status',        NEW.status,
          'score',         NEW.stress_score,
          'top_stressor',  v_top_stressor,
          'changed_at',    v_changed_at,
          'i18n_title_key', 'stress.notification_status_change_title',
          'i18n_body_key',  'stress.notification_status_change_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_stress_status_change notification insert failed for user %: %', NEW.member_id, SQLERRM;
  END;

  -- Auto-suggest intervention on the first orange/red crossing in the
  -- last 30 days. This ensures a recovering member who slips again
  -- next month gets a fresh offer; same-episode dailies don't spawn
  -- duplicates because the check looks at notifications, not stress
  -- rows — and we only INSERT a notification on the crossing edge.
  BEGIN
    SELECT COUNT(*) INTO v_prior_alert_count
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'stress_status_change'
       AND created_at >= (now() - INTERVAL '30 days')
       AND data->>'changed_at' != v_changed_at;

    IF v_prior_alert_count = 0 AND v_top_stressor IS NOT NULL THEN
      v_intervention_type := CASE v_top_stressor
        WHEN 'contribution_delay'   THEN 'payment_restructuring'
        WHEN 'ticket_language'      THEN 'counselor_referral'
        WHEN 'login_drop'           THEN 'check_in_nudge'
        WHEN 'early_payout_request' THEN 'liquidity_advance'
        ELSE NULL
      END;

      IF v_intervention_type IS NOT NULL THEN
        -- Skip if the member already has a pending / offered
        -- intervention for this exact type — defensive against any
        -- race with admin-initiated rows.
        IF NOT EXISTS (
          SELECT 1 FROM public.stress_interventions
           WHERE member_id = NEW.member_id
             AND intervention_type = v_intervention_type
             AND accepted_at IS NULL
             AND declined_at IS NULL
             AND completed_at IS NULL
             AND expired_at IS NULL
        ) THEN
          v_message_title := CASE v_intervention_type
            WHEN 'payment_restructuring' THEN 'A restructured plan could help'
            WHEN 'counselor_referral'    THEN 'Talk to someone who can help'
            WHEN 'check_in_nudge'        THEN 'Quick check-in'
            WHEN 'liquidity_advance'     THEN 'A bridging advance is available'
            ELSE 'Support available'
          END;
          v_message_body := CASE v_intervention_type
            WHEN 'payment_restructuring' THEN 'We can split your next contribution into smaller payments. Review the plan below.'
            WHEN 'counselor_referral'    THEN 'Our counsellor partners can help you talk through what''s on. The conversation stays private.'
            WHEN 'check_in_nudge'        THEN 'A short check-in to see how you''re doing. No commitment — just a question.'
            WHEN 'liquidity_advance'     THEN 'A small bridging advance may be calmer than juggling cycles. Tap to review the options.'
            ELSE 'We''ve suggested a next step that may help. Tap to review.'
          END;

          INSERT INTO public.stress_interventions (
            member_id,
            stress_score_id,
            intervention_type,
            stress_score_at_trigger,
            stress_status,
            message_title,
            message_body,
            offered_at,
            outcome
          ) VALUES (
            NEW.member_id,
            NEW.id,
            v_intervention_type,
            NEW.stress_score,
            NEW.status,
            v_message_title,
            v_message_body,
            now(),
            'pending'
          );

          -- Optional companion notification for the intervention offer.
          -- Same idempotency key per day so retries don't spam.
          INSERT INTO public.notifications (user_id, type, title, body, data, read)
          VALUES (
            NEW.member_id,
            'stress_intervention_offered',
            'Support available',
            'We''ve suggested a next step to help reduce your stress. Tap to review.',
            jsonb_build_object(
              'intervention_type', v_intervention_type,
              'top_stressor',      v_top_stressor,
              'changed_at',        v_changed_at,
              'i18n_title_key',    'stress.notification_intervention_offered_title',
              'i18n_body_key',     'stress.notification_intervention_offered_body'
            ),
            FALSE
          );
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_stress_status_change auto-intervention failed for user %: %', NEW.member_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_stress_status_change ON public.member_stress_scores;
CREATE TRIGGER tr_stress_status_change
  AFTER INSERT ON public.member_stress_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stress_status_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '215',
  'stress_automation',
  ARRAY['-- 215: stress_automation']
)
ON CONFLICT (version) DO NOTHING;
