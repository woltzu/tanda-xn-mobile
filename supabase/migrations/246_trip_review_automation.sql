-- ════════════════════════════════════════════════════════════════════════════
-- 246 — trip_review_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Leave-review Bucket C: ship the missing automation around trip_reviews
-- (Bucket A only delivered the table + submission RPC). This migration adds:
--   1. send_trip_review_reminders() RPC + daily cron — nudges participants
--      who haven't reviewed 3-14 days after trip end (max once a week).
--   2. notify_organizer_on_trip_review trigger — pings the organizer when
--      a new review lands.
--   3. record_ai_decision_for_trip_review trigger — records an AI decision
--      so the rating shows up on the organizer's AI Insights screen.
--   4. ai_decisions.decision_type CHECK widened to include 'trip_review'.
--
-- IMPORTANT CORRECTIONS vs. spec draft:
--   • CHECK is widened ADDITIVELY, not replaced. The live constraint
--     accepts 27 types (xnscore_increase…trip_participant_action). The
--     spec's draft would drop 20 of those and instantly break every other
--     automation trigger that records an AI decision. We rebuild the same
--     27 + add 'trip_review'.
--   • profiles.full_name (codebase convention — see useProfileBatch) instead
--     of display_name. Both columns exist; full_name is what the rest of the
--     app reads.
--   • Registry insert via supabase_migrations.schema_migrations per
--     CLAUDE.md template.
--   • Cron schedule is wrapped in pg_cron.unschedule-if-exists so re-running
--     the migration doesn't error with "job already exists".
--   • SET search_path = public, pg_temp on every SECURITY DEFINER function
--     per Tier 4 hardening.
--   • Local variables renamed (v_organizer_id, v_trip_name, v_reviewer_name)
--     to avoid shadowing NEW column references.
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. send_trip_review_reminders — daily cron target
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION send_trip_review_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      tp.id        AS participant_id,
      tp.user_id   AS user_id,
      tp.trip_id   AS trip_id,
      t.trip_name  AS trip_name
    FROM trip_participants tp
    JOIN trips t ON t.id = tp.trip_id
    WHERE tp.status = 'confirmed'
      AND t.end_date < CURRENT_DATE - INTERVAL '3 days'
      AND t.end_date >= CURRENT_DATE - INTERVAL '14 days'
      AND NOT EXISTS (
        SELECT 1 FROM trip_reviews
        WHERE trip_participant_id = tp.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = tp.user_id
          AND type = 'trip_review_reminder'
          AND data->>'trip_id' = t.id::text
          AND created_at > NOW() - INTERVAL '7 days'
      )
  LOOP
    INSERT INTO notifications (
      user_id, type, title, body, data, created_at
    ) VALUES (
      r.user_id,
      'trip_review_reminder',
      'How was ' || COALESCE(r.trip_name, 'your trip') || '?',
      'Your trip ended recently. Leave a review to help the community!',
      jsonb_build_object(
        'trip_id', r.trip_id,
        'participant_id', r.participant_id
      ),
      NOW()
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION send_trip_review_reminders() TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Daily cron — 09:00 UTC. Idempotent unschedule-if-exists.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'trip-review-reminder';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'trip-review-reminder',
  '0 9 * * *',
  $cron$ SELECT public.send_trip_review_reminders() $cron$
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. notify_organizer_on_trip_review — fires on trip_reviews INSERT.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_organizer_on_trip_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name      TEXT;
  v_reviewer_name  TEXT;
BEGIN
  -- Self-reviews (rare edge case: organizer joined their own trip and
  -- submitted) would notify the organizer of their own review. Suppress.
  IF NEW.organizer_id = NEW.reviewer_id THEN
    RETURN NEW;
  END IF;

  SELECT t.trip_name INTO v_trip_name
  FROM trips t WHERE t.id = NEW.trip_id;

  SELECT p.full_name INTO v_reviewer_name
  FROM profiles p WHERE p.id = NEW.reviewer_id;

  INSERT INTO notifications (
    user_id, type, title, body, data, created_at
  ) VALUES (
    NEW.organizer_id,
    'trip_review_submitted',
    'New review for ' || COALESCE(v_trip_name, 'your trip'),
    COALESCE(v_reviewer_name, 'A participant')
      || ' rated you ' || NEW.rating || ' stars. See what they said.',
    jsonb_build_object(
      'trip_id',   NEW.trip_id,
      'review_id', NEW.id
    ),
    NOW()
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_review_submitted_notify ON trip_reviews;
CREATE TRIGGER tr_trip_review_submitted_notify
AFTER INSERT ON trip_reviews
FOR EACH ROW
EXECUTE FUNCTION notify_organizer_on_trip_review();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. record_ai_decision_for_trip_review — feeds the organizer's
--    AI Insights screen with the new review event.
--
-- record_ai_decision signature (verified live):
--   (p_member_id uuid, p_decision_type text, p_decision_value text,
--    p_explanation_data jsonb, p_source_event_id uuid DEFAULT NULL,
--    p_source_event_type text DEFAULT NULL)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_ai_decision_for_trip_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name TEXT;
BEGIN
  IF NEW.organizer_id = NEW.reviewer_id THEN
    RETURN NEW;
  END IF;

  SELECT t.trip_name INTO v_trip_name
  FROM trips t WHERE t.id = NEW.trip_id;

  PERFORM public.record_ai_decision(
    NEW.organizer_id,
    'trip_review',
    'Received a ' || NEW.rating || '-star review for '
      || COALESCE(v_trip_name, 'a trip'),
    jsonb_build_object(
      'TRIP_NAME',   COALESCE(v_trip_name, ''),
      'RATING',      NEW.rating,
      'REVIEW_TEXT', COALESCE(NEW.review_text, 'No text')
    ),
    NEW.id,
    'trip_review'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_review_ai_decision ON trip_reviews;
CREATE TRIGGER tr_trip_review_ai_decision
AFTER INSERT ON trip_reviews
FOR EACH ROW
EXECUTE FUNCTION record_ai_decision_for_trip_review();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. ai_decisions.decision_type CHECK widen — ADDITIVE (see header note).
--    27 existing types + 'trip_review' = 28.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;

ALTER TABLE ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type = ANY (ARRAY[
    'xnscore_increase',
    'xnscore_decrease',
    'circle_join_rejection',
    'liquidity_denial',
    'tier_advancement',
    'tier_demotion',
    'payout_position',
    'intervention_message',
    'honor_score_change',
    'stress_score_change',
    'mood_drift_change',
    'stress_status_change',
    'swap_completed',
    'cycle_state_change',
    'substitution_completed',
    'partial_plan_completed',
    'conflict_resolved',
    'loan_disbursed',
    'loan_default',
    'community_post_published',
    'community_post_milestone',
    'event_created',
    'gathering_created',
    'trip_published',
    'trip_update_posted',
    'trip_participant_paid',
    'trip_participant_action',
    'trip_review'
  ]));

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Self-register per CLAUDE.md template.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '246',
  'trip_review_automation',
  ARRAY['-- 246: trip_review_automation']
)
ON CONFLICT (version) DO NOTHING;
