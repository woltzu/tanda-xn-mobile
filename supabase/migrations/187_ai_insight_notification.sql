-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 187: ai_decisions → notifications + weekly-digest cadence column
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Bucket C of the Explainable AI review. Closes two gaps:
--
--   (1) ai_decisions writes silently — there's no push delivery path. The
--       trigger added here inserts a `notifications` row of type
--       `ai_insight` on every ai_decisions INSERT. A companion Edge
--       Function (ai-insight-notification) sweeps the unsent rows and
--       fires the Expo push, mirroring the pattern used by
--       kyc-approval-notification (migration 180) and
--       tier-change-notification (migration 185).
--
--   (2) The weekly digest has no "did we already send one this week"
--       memo. Adds `profiles.last_digest_sent_at` so the
--       ai-weekly-digest EF can dedup per-user per-week.
--
-- The trigger also stamps `ai_decisions.notification_sent = TRUE` so the
-- column finally carries the meaning it was named for (audit baseline
-- noted it as "present but unused"). Body is truncated to 140 chars to
-- stay under Expo's payload sweet spot — the full rendered_explanation
-- remains on the ai_decisions row and the notifications.data carries
-- decision_id, so the client can fetch it on tap if needed.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. profiles.last_digest_sent_at
-- Used by the ai-weekly-digest EF as the per-user idempotency marker.
-- Indexed sorting NULLs first so first-time users (no prior digest) sit
-- at the front of the candidate scan.
-- ───────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_last_digest_sent_idx
  ON public.profiles (last_digest_sent_at NULLS FIRST);

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. notify_ai_insight trigger
-- AFTER INSERT on ai_decisions. Inserts a notifications row, then
-- updates the ai_decisions row's notification_sent flag. Both writes
-- live inside a single sub-EXCEPTION block so AI-side failures cannot
-- roll back the upstream record_ai_decision call.
-- ───────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_ai_insight()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_body TEXT;
  v_raw  TEXT;
BEGIN
  v_raw := COALESCE(NEW.rendered_explanation, '');
  IF length(v_raw) = 0 THEN
    -- Nothing to surface; rare (template fallback failed). Skip silently.
    RETURN NEW;
  END IF;

  v_body := substr(v_raw, 1, 140);
  IF length(v_raw) > 140 THEN
    v_body := v_body || '…';
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, created_at)
    VALUES (
      NEW.member_id,
      'ai_insight',
      'New insight',
      v_body,
      jsonb_build_object(
        'decision_id', NEW.id,
        'decision_type', NEW.decision_type
      ),
      now()
    );

    UPDATE public.ai_decisions
       SET notification_sent = TRUE
     WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_ai_insight] failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ai_decisions_notification_trg ON public.ai_decisions;
CREATE TRIGGER ai_decisions_notification_trg
  AFTER INSERT ON public.ai_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ai_insight();

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '187',
  'ai_insight_notification',
  ARRAY['-- 187: ai_insight_notification']
)
ON CONFLICT (version) DO NOTHING;
