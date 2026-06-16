-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 185: tier_change notification trigger (See-tier-status Bucket A)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- evaluate_member_tier (migrations 040 / 094 / 111) appends a row to
-- member_tier_history on every change_type (initial / advancement /
-- demotion / fast_track / manual). record_ai_decision logs the change
-- as an ai_decisions row, but nothing dispatches an off-app push.
-- Users move tiers silently and only see the new badge if they happen
-- to open the app.
--
-- This migration closes that gap with a trigger on member_tier_history:
-- AFTER INSERT WHEN change_type IN ('advancement', 'demotion'), insert
-- a row into `notifications` with type='tier_change'. The same sweeper
-- pattern used for KYC/transfer/goal then handles the push (see new
-- supabase/functions/tier-change-notification — sister to migration 180
-- and the kyc-approval-notification EF).
--
-- Schema notes:
--   - kyc/transfer/goal triggers from earlier work insert title+body in
--     English directly into the row. The client renders them as-is.
--     Localised copy lives in the EF when language preference matters,
--     but for parity we just inline EN here. The client-side notif inbox
--     already pulls these straight from the row.
--   - `notifications.type` has no CHECK constraint (verified live), so
--     we don't need to extend an enum.
--   - We don't track `tier_change_notified_at` on member_tier_history.
--     Idempotency rides on `notifications.push_sent_at` (column added
--     in 182) — the EF filters on push_sent_at IS NULL and stamps it
--     after the Expo POST, so each history row produces exactly one
--     push.

CREATE OR REPLACE FUNCTION public.notify_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title TEXT;
  v_body  TEXT;
BEGIN
  IF NEW.change_type = 'advancement' THEN
    v_title := '🎉 Tier upgraded!';
    v_body  := 'You''ve reached ' || INITCAP(NEW.to_tier) ||
               '. Check your new benefits in the app.';
  ELSIF NEW.change_type = 'demotion' THEN
    v_title := '⚠️ Tier downgraded';
    v_body  := 'You''ve been moved to ' || INITCAP(NEW.to_tier) ||
               '. Open the app to see what changed and how to recover.';
  ELSE
    -- Sub-trigger condition already filters these out, but be defensive.
    RETURN NEW;
  END IF;

  -- Wrap in a sub-block so a notifications-table write failure does NOT
  -- roll back the tier-history insert. Tier evaluation is the system of
  -- record; off-app notification is a courtesy and must never block it.
  BEGIN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      body,
      data,
      created_at
    ) VALUES (
      NEW.user_id,
      'tier_change',
      v_title,
      v_body,
      jsonb_build_object(
        'from_tier',    NEW.from_tier,
        'to_tier',      NEW.to_tier,
        'change_type',  NEW.change_type,
        'xn_score',     NEW.xn_score,
        'circles_completed', NEW.circles_completed
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Soft-fail — never break tier evaluation because the inbox is sad.
    RAISE WARNING 'notify_tier_change: failed to insert notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS member_tier_history_notify ON public.member_tier_history;

CREATE TRIGGER member_tier_history_notify
AFTER INSERT ON public.member_tier_history
FOR EACH ROW
WHEN (NEW.change_type IN ('advancement', 'demotion'))
EXECUTE FUNCTION public.notify_tier_change();

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '185',
  'tier_change_notification',
  ARRAY['-- 185: tier_change_notification']
)
ON CONFLICT (version) DO NOTHING;
