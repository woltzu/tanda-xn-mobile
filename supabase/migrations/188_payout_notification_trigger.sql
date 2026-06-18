-- ════════════════════════════════════════════════════════════════════════════
-- Migration 188: payout_notification_trigger
-- ════════════════════════════════════════════════════════════════════════════
-- `notify_payout_received` trigger on `circle_payouts` — when a row lands
-- with status = 'completed' (either INSERTed in that state, or transitioned
-- to it via UPDATE), drop a `notifications` row of type 'payout_received'
-- for the recipient. The existing fan-out (used by KYC, transfer, goal,
-- tier notifications) picks it up and delivers the Expo push.
--
-- Idempotency: the function early-returns if a `payout_received`
-- notification with the same `data->>'payout_id'` already exists, so
-- retries / engine re-runs can't create duplicates.
--
-- Mirrors the pattern of migrations 180/181/185/187 (SECURITY DEFINER,
-- search_path locked, EXCEPTION sub-block so a trigger failure can't
-- roll back the `circle_payouts` INSERT/UPDATE that fired it).
--
-- Why both INSERT and UPDATE? `PayoutExecutionEngine.executePayout`
-- inserts the row in 'completed' state directly, but the table allows
-- 'scheduled' / 'pending' / 'processing' as transient states for
-- future workflows. The trigger handles both paths so notifications
-- fire as soon as a payout reaches 'completed', whichever path it
-- took.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_payout_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_amount_display TEXT;
  v_existing_id UUID;
BEGIN
  -- Only fire when the row is in 'completed' state. Skip non-completed
  -- inserts and skip UPDATE events that didn't move INTO completed
  -- (e.g., status went from 'completed' to 'completed' via a metadata
  -- update — shouldn't happen, but defensive).
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: if a 'payout_received' notification already exists
  -- for this payout id, skip. Cheap point-lookup; the index on
  -- notifications.type covers the type filter.
  SELECT id
    INTO v_existing_id
    FROM public.notifications
   WHERE type = 'payout_received'
     AND data->>'payout_id' = NEW.id::text
   LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve the circle name for the body copy. Falls back to "your
  -- circle" if the row is gone (very unlikely — both INSERTs land in
  -- the same transaction).
  SELECT name
    INTO v_circle_name
    FROM public.circles
   WHERE id = NEW.circle_id;

  -- Display amount in the row's currency (default USD). Numeric is
  -- truncated to 2 decimals via to_char's FM999G999G990D00 mask.
  IF NEW.currency IS NULL OR NEW.currency = 'USD' THEN
    v_amount_display := '$' || trim(to_char(NEW.amount, 'FM999G999G990D00'));
  ELSE
    v_amount_display := trim(to_char(NEW.amount, 'FM999G999G990D00')) || ' ' || NEW.currency;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    read
  ) VALUES (
    NEW.recipient_id,
    'payout_received',
    'Payout received!',
    'You received ' || v_amount_display || ' from ' || COALESCE(v_circle_name, 'your circle') || '.',
    jsonb_build_object(
      'payout_id', NEW.id,
      'circle_id', NEW.circle_id,
      'amount', NEW.amount,
      'currency', COALESCE(NEW.currency, 'USD')
    ),
    FALSE
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Trigger failure must NOT roll back the circle_payouts INSERT
  -- itself. The wallet credit has already happened; losing the
  -- notification is recoverable (manual resend, or the next dashboard
  -- visit shows the new balance) — losing the payout row would be
  -- catastrophic.
  RAISE NOTICE 'notify_payout_received failed for payout %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_payouts_notify ON public.circle_payouts;
CREATE TRIGGER circle_payouts_notify
  AFTER INSERT OR UPDATE OF status ON public.circle_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payout_received();

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '188',
  'payout_notification_trigger',
  ARRAY['-- 188: payout_notification_trigger']
)
ON CONFLICT (version) DO NOTHING;
