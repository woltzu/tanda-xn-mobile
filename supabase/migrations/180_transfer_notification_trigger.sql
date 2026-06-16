-- ════════════════════════════════════════════════════════════════════════════
-- Migration 180: transfer_notification_trigger
-- ════════════════════════════════════════════════════════════════════════════
-- Purpose:
--   After-insert trigger on money_transfers that drops an in-app
--   `notifications` row whenever a transfer settles for the recipient
--   above a configurable USD threshold. The `transfer-notification`
--   Edge Function sweeps the resulting rows and dispatches Expo Push
--   payloads off-app — same shape as migration 160 + the
--   kyc-approval-notification function.
--
-- Why a trigger instead of writing the row from the app:
--   The current send path (WalletContext.sendMoney) executes from
--   the sender's session and can't write a notifications row owned
--   by the recipient — RLS rejects the cross-user insert. The
--   trigger runs as the table's owner and bypasses RLS, which keeps
--   the security model tight while still surfacing the notification
--   on the recipient's device.
--
-- Filter conditions:
--   * NEW.recipient_user_id IS NOT NULL  — outbound external
--     transfers (recipient_user_id = NULL) skip — there is no
--     in-app user to notify on the other side.
--   * NEW.status = 'completed'           — pending / failed
--     transitions don't emit a notification.
--   * NEW.amount_cents >= TRANSFER_NOTIFY_THRESHOLD_CENTS (10000 =
--     $100). Below the threshold the noise/value ratio drops fast;
--     users still see the row in Wallet → Recent Activity.
--
-- The trigger fires on both INSERT-as-completed AND
-- UPDATE-of-status-to-completed so a transfer that lands in
-- 'pending' and is later finalised by the bank webhook also
-- generates a notification.
--
-- Idempotency:
--   notifications already has no uniqueness constraint on
--   (user_id, type, data). To avoid a double-notification when a
--   transfer is INSERTed pending and UPDATEd to completed, the
--   trigger guards via the OLD.status check on UPDATE so the row
--   is only emitted on the actual pending→completed transition.
--   For INSERT-as-completed we emit unconditionally. The Edge
--   Function dedupes on the notifications.id PK, so a re-run is a
--   no-op.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_money_transfer_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_name TEXT;
  v_amount_dollars NUMERIC;
  v_threshold_cents INTEGER := 10000;  -- $100
BEGIN
  -- Bail early on the cases we don't notify for.
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.amount_cents, 0) < v_threshold_cents THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only emit when status actually transitioned to
  -- completed — re-saving a completed row shouldn't re-notify.
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Resolve sender display name. Falls back to a neutral placeholder
  -- if the sender row is missing or has no full_name set.
  SELECT COALESCE(NULLIF(p.full_name, ''), NULL)
    INTO v_sender_name
    FROM public.profiles p
   WHERE p.id = NEW.sender_user_id;

  v_amount_dollars := (NEW.amount_cents::NUMERIC / 100);

  -- Insert the in-app row. The Edge Function will pick it up and
  -- POST to the Expo Push API; the row itself is the "in-box"
  -- surface inside NotificationContext.
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    read
  ) VALUES (
    NEW.recipient_user_id,
    'money_received',
    'Money received',
    CASE
      WHEN v_sender_name IS NOT NULL
        THEN 'You received $' || TO_CHAR(v_amount_dollars, 'FM999G999G990D00') || ' from ' || v_sender_name || '.'
      ELSE
        'You received $' || TO_CHAR(v_amount_dollars, 'FM999G999G990D00') || '.'
    END,
    jsonb_build_object(
      'transfer_id', NEW.id,
      'amount_cents', NEW.amount_cents,
      'currency', NEW.currency,
      'sender_user_id', NEW.sender_user_id,
      'sender_name', v_sender_name
    ),
    FALSE
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Trigger failure must NOT roll back the underlying transfer.
  -- Log via NOTICE and continue — the row is still written to
  -- money_transfers and the user will still see it in Recent
  -- Activity. A future re-run of the Edge Function won't recover
  -- the missed notification, but the money flow is intact.
  RAISE NOTICE 'notify_money_transfer_received failed for transfer %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS money_transfers_notify_received_insert ON public.money_transfers;
CREATE TRIGGER money_transfers_notify_received_insert
  AFTER INSERT ON public.money_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_money_transfer_received();

DROP TRIGGER IF EXISTS money_transfers_notify_received_update ON public.money_transfers;
CREATE TRIGGER money_transfers_notify_received_update
  AFTER UPDATE OF status ON public.money_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_money_transfer_received();

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '180',
  'transfer_notification_trigger',
  ARRAY['-- 180: transfer_notification_trigger']
)
ON CONFLICT (version) DO NOTHING;
