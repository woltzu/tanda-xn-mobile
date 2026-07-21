-- ═══════════════════════════════════════════════════════════════════════════
-- 372_closing_ledger_trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 38 §3.4 — DB-level enforcement of the closed-circle immutability
-- rule. BEFORE INSERT trigger on ledger_events rejects any insert whose
-- circle_id references a circle with status = 'closed'. Prevents the
-- honor-system gap where an admin (or any code path with INSERT access)
-- could write ledger events to a supposedly-frozen circle.
--
-- Trigger is BEFORE INSERT — the row never lands, no cleanup needed.
-- SECURITY DEFINER + pinned search_path so the check runs consistently
-- regardless of caller.
--
-- Interaction with mig 371 RPCs:
--   * close_circle: writes 'circle.closed' event FIRST (status still
--     'payout_complete', trigger allows), THEN flips status='closed'.
--     No self-block.
--   * reopen_circle: flips status='payout_complete' FIRST (via UPDATE),
--     THEN inserts 'circle.reopened' event. Trigger sees the transaction-
--     local view where status is already 'payout_complete', allows.
--   * apply_correction: pre-checks status='closed' in its body for a
--     clean error message. Trigger is defense-in-depth.
--
-- Events with circle_id IS NULL (e.g. non-circle-scoped Stripe events)
-- fall through unchecked.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.block_ledger_insert_on_closed_circle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.circle_id IS NOT NULL THEN
    IF (SELECT status FROM public.circles WHERE id = NEW.circle_id) = 'closed' THEN
      RAISE EXCEPTION
        'ledger_insert_blocked: circle % is closed; reopen it first via reopen_circle', NEW.circle_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_ledger_insert_on_closed_circle
  ON public.ledger_events;

CREATE TRIGGER tr_block_ledger_insert_on_closed_circle
  BEFORE INSERT ON public.ledger_events
  FOR EACH ROW EXECUTE FUNCTION public.block_ledger_insert_on_closed_circle();

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '372',
  'closing_ledger_trigger',
  ARRAY['-- 372: BEFORE INSERT trigger blocks ledger_events on closed circles']
)
ON CONFLICT (version) DO NOTHING;
