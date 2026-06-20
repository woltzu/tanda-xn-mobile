-- ════════════════════════════════════════════════════════════════════════════
-- Migration 216: mood_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Mood Drift Score review.
--
-- Buckets A and B made the screen clear (real data + direction subtitle +
-- top-signal card + tappable suggestions + opt-out reading the real
-- preferences row + i18n sweep) and gave it a HelpSheet + coach mark +
-- per-signal explainer + privacy footer anchored on the "What we measure
-- (and what we don't)" disclosure. The score itself was still drifting in
-- two ways that this migration closes:
--
--   1. Tier crossings were silent. A member whose mood drift score moved
--      from drifting (31–55) into disengaging (56–75) — the band where the
--      HelpSheet says "this is when we may proactively offer help" — got
--      nothing. No notification. The Bucket B coach mark assumes the user
--      opens the screen of their own volition.
--
--   2. The intervention pipeline was reactive only. mood_interventions
--      rows only existed when an admin or a backend job inserted them. A
--      member crossing into disengaging for the first time saw the
--      screen's "Suggested next steps" card (Bucket A) but no real
--      prepared offer (an empathetic check-in, a counsellor referral, a
--      re-engagement nudge tailored to their top signal).
--
-- What this migration does:
--
--   1. CREATE OR REPLACE notify_mood_drift_change. The function already
--      exists in prod (verified via pg_proc) and is already bound to
--      member_mood_snapshots AFTER INSERT via the trigger
--      member_mood_snapshots_decision_trg (verified via pg_trigger). The
--      EXISTING body only calls record_ai_decision (audit) — no
--      notifications, no interventions. The new body:
--
--        a) PRESERVES the record_ai_decision call (audit trail intact),
--           gated by the same delta >= 5 threshold the old body used.
--
--        b) DETECTS tier crossings INTO disengaging / at_risk by
--           comparing NEW.tier against the immediately-prior snapshot
--           row for the same member.
--
--        c) ON A CROSSING: emits a mood_drift_change notification
--           carrying tier / score / top_signal / changed_at + i18n keys.
--           Idempotent on (user_id, type, data->>'changed_at') stamped
--           at date precision so same-day re-scoring doesn't spam.
--
--        d) ON THE FIRST CROSSING IN 30 DAYS: INSERTs a pending
--           mood_interventions row, intervention_type derived from the
--           top signal in NEW.signal_breakdown:
--
--             polarity → empathetic_check_in
--             lexical  → check_in_nudge
--             keyword  → counselor_referral
--             latency  → re_engagement_nudge
--             length   → check_in_nudge
--
--           Also emits a companion mood_intervention_offered notification.
--           Skipped if a non-terminal intervention of the same type
--           already exists for the member (race-safe against admin
--           insertions).
--
--   2. Helper mood_top_signal_key(signal_breakdown JSONB) RETURNS TEXT —
--      pure function that returns the signal key with the highest
--      weighted_value. Same shape as stress_top_stressor_key from
--      migration 215.
--
-- No new trigger is created — the existing
-- member_mood_snapshots_decision_trg already binds the function, so the
-- new body picks up automatically. Adding tr_mood_drift_change would
-- double-fire the function on every INSERT.
--
-- Trigger function: SECURITY DEFINER + pinned search_path +
-- EXCEPTION sub-blocks (a notification or intervention-insert failure
-- must not roll back the member_mood_snapshots INSERT that triggered
-- it; the existing record_ai_decision audit call must also not be lost
-- if the new notification path errors). Mirrors migrations 188 / 205 /
-- 207 / 208 / 209 / 210 / 211 / 212 / 213 / 214 / 215.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Helper: derive top signal key from a signal_breakdown JSONB
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mood_top_signal_key(p_breakdown JSONB)
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
-- 2. notify_mood_drift_change — rewritten in place
-- ─────────────────────────────────────────────────────────────────────────────
-- The existing trigger member_mood_snapshots_decision_trg already binds
-- this function. CREATE OR REPLACE swaps the body; the trigger needs no
-- changes.
CREATE OR REPLACE FUNCTION public.notify_mood_drift_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_score        INTEGER;
  v_delta            INTEGER;
  v_direction        TEXT;
  v_trend            TEXT;
  v_prev_tier        TEXT;
  v_top_signal       TEXT;
  v_changed_at       TEXT;
  v_existing_id      UUID;
  v_prior_alert_cnt  INTEGER;
  v_intervention_type TEXT;
  v_message_title    TEXT;
  v_message_body     TEXT;
BEGIN
  v_new_score := COALESCE(ROUND(NEW.composite_mood_score)::INTEGER, 0);
  v_delta     := COALESCE(ROUND(NEW.score_delta)::INTEGER, 0);
  v_trend     := COALESCE(NEW.trend, 'stable');

  -- ── 2a. PRESERVE existing AI-decision audit ────────────────────────────────
  -- The legacy body called record_ai_decision when there was a previous
  -- score AND |delta| >= 5. Keep that exact behaviour so downstream audit
  -- consumers (admin dashboards, ML feedback) keep getting the same rows.
  IF NEW.previous_score IS NOT NULL AND ABS(v_delta) >= 5 THEN
    v_direction := CASE WHEN v_delta > 0 THEN 'up' ELSE 'down' END;
    BEGIN
      PERFORM public.record_ai_decision(
        NEW.member_id,
        'mood_drift_change',
        v_direction,
        jsonb_build_object(
          'NEW_SCORE', v_new_score,
          'DELTA',     ABS(v_delta),
          'DIRECTION', v_direction,
          'TREND',     v_trend
        ),
        NEW.id,
        'member_mood_snapshots'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[notify_mood_drift_change] record_ai_decision failed: %', SQLERRM;
    END;
  END IF;

  -- ── 2b. Detect tier crossings INTO disengaging / at_risk ───────────────────
  -- Short-circuit when the new tier isn't one of the two we react to.
  IF NEW.tier::TEXT NOT IN ('disengaging', 'at_risk') THEN
    RETURN NEW;
  END IF;

  -- Look up the immediately-prior snapshot for this member. The table is
  -- append-only and ordered by created_at; the prior row's tier tells us
  -- whether this is a crossing or a continuation.
  SELECT tier::TEXT INTO v_prev_tier
    FROM public.member_mood_snapshots
   WHERE member_id = NEW.member_id
     AND id != NEW.id
   ORDER BY created_at DESC
   LIMIT 1;

  -- If the member was already at disengaging / at_risk, this is a
  -- continuation — skip both the notification and the auto-intervention
  -- so we don't spawn a duplicate offer every score window.
  IF v_prev_tier IN ('disengaging', 'at_risk') THEN
    RETURN NEW;
  END IF;

  v_top_signal := public.mood_top_signal_key(NEW.signal_breakdown);
  v_changed_at := TO_CHAR((now() AT TIME ZONE 'UTC')::DATE, 'YYYY-MM-DD');

  -- ── 2c. Tier-crossing notification — idempotent per (user, type, day) ──────
  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'mood_drift_change'
       AND data->>'changed_at' = v_changed_at
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'mood_drift_change',
        'Mood change detected',
        'Your mood drift has shifted to ' || NEW.tier::TEXT || '. Tap to see details.',
        jsonb_build_object(
          'tier',           NEW.tier::TEXT,
          'score',          v_new_score,
          'top_signal',     v_top_signal,
          'changed_at',     v_changed_at,
          'i18n_title_key', 'mood.notification_drift_change_title',
          'i18n_body_key',  'mood.notification_drift_change_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_mood_drift_change] notification insert failed for user %: %', NEW.member_id, SQLERRM;
  END;

  -- ── 2d. Auto-suggest intervention on first crossing in last 30 days ────────
  BEGIN
    SELECT COUNT(*) INTO v_prior_alert_cnt
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'mood_drift_change'
       AND created_at >= (now() - INTERVAL '30 days')
       AND data->>'changed_at' != v_changed_at;

    IF v_prior_alert_cnt = 0 AND v_top_signal IS NOT NULL THEN
      v_intervention_type := CASE v_top_signal
        WHEN 'polarity' THEN 'empathetic_check_in'
        WHEN 'lexical'  THEN 'check_in_nudge'
        WHEN 'keyword'  THEN 'counselor_referral'
        WHEN 'latency'  THEN 're_engagement_nudge'
        WHEN 'length'   THEN 'check_in_nudge'
        ELSE NULL
      END;

      IF v_intervention_type IS NOT NULL THEN
        -- Skip if a non-terminal intervention of this type already
        -- exists for the member — defensive against admin races.
        IF NOT EXISTS (
          SELECT 1 FROM public.mood_interventions
           WHERE member_id = NEW.member_id
             AND intervention_type = v_intervention_type
             AND accepted_at IS NULL
             AND declined_at IS NULL
             AND completed_at IS NULL
             AND expired_at IS NULL
        ) THEN
          v_message_title := CASE v_intervention_type
            WHEN 'empathetic_check_in'  THEN 'A quick check-in'
            WHEN 'check_in_nudge'       THEN 'How are you doing?'
            WHEN 'counselor_referral'   THEN 'Talk to someone who can help'
            WHEN 're_engagement_nudge'  THEN 'Your circles miss you'
            ELSE 'Support available'
          END;
          v_message_body := CASE v_intervention_type
            WHEN 'empathetic_check_in'  THEN 'We''ve noticed your recent messages feel a bit heavier. Want to talk to someone who can listen?'
            WHEN 'check_in_nudge'       THEN 'A short check-in to see how you''re doing. No commitment — just a question.'
            WHEN 'counselor_referral'   THEN 'Stress-related words in your recent messages caught our eye. Our counsellor partners can help — the conversation stays private.'
            WHEN 're_engagement_nudge'  THEN 'You''ve been quieter than usual in your circles. A quick reply often makes everyone feel reconnected.'
            ELSE 'We''ve suggested a next step that may help. Tap to review.'
          END;

          INSERT INTO public.mood_interventions (
            member_id,
            mood_snapshot_id,
            intervention_type,
            tier_at_trigger,
            mood_score_at_trigger,
            message_title,
            message_body,
            triggered_at,
            outcome
          ) VALUES (
            NEW.member_id,
            NEW.id,
            v_intervention_type,
            NEW.tier,
            v_new_score,
            v_message_title,
            v_message_body,
            now(),
            'pending'
          );

          -- Companion intervention-offered notification. Same idempotency
          -- key per day so retries don't spam.
          INSERT INTO public.notifications (user_id, type, title, body, data, read)
          VALUES (
            NEW.member_id,
            'mood_intervention_offered',
            'Support available',
            'We''ve suggested a next step to help with your mood. Tap to review.',
            jsonb_build_object(
              'intervention_type', v_intervention_type,
              'top_signal',        v_top_signal,
              'changed_at',        v_changed_at,
              'i18n_title_key',    'mood.notification_intervention_offered_title',
              'i18n_body_key',     'mood.notification_intervention_offered_body'
            ),
            FALSE
          );
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_mood_drift_change] auto-intervention failed for user %: %', NEW.member_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '216',
  'mood_automation',
  ARRAY['-- 216: mood_automation']
)
ON CONFLICT (version) DO NOTHING;
