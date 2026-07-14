-- ═══════════════════════════════════════════════════════════════════════════
-- 309_refund_excess_contribution_to_completed_circle.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix D from the completion-loop launch plan. Safety net that catches
-- any contribution that lands on a circle whose status has already
-- moved to 'completed' (or 'cancelled') — usually because an autopay
-- request was in flight when the finalization block in mig 310 fired.
--
-- Mechanism:
--   1. Extend the status vocabulary on both source tables to include
--      'refunded' (was pending/paid/late/missed/waived).
--   2. Trigger on circle_contributions AFTER INSERT/UPDATE OF status:
--      when NEW.status becomes 'paid' and the parent circle's status is
--      'completed' or 'cancelled', credit the payer's wallet, insert a
--      wallet_transactions refund row, and flip status to 'refunded'.
--      The flip re-fires the trigger but the first-line guard exits it
--      instantly, so no infinite loop.
--   3. Same trigger installed on `contributions` (autopay-source table).
--   4. Wrapped in BEGIN…EXCEPTION so a refund-side failure never rolls
--      back the parent INSERT — money would just sit in the ledger for
--      admin manual reconciliation instead of blocking the write.
--   5. Decrement circle_cycles.received_contributions if the refund
--      undoes a counter bump from mig 308. Safe no-op if the cycle
--      row is missing or already closed.
--
-- Idempotency:
--   * The status='refunded' flip prevents re-firing.
--   * The first-line guard (NEW.status != 'paid' → exit) covers the
--     status metadata-update case (paid→paid).
--
-- Ordering note:
--   * mig 308's counter-increment trigger and this refund trigger both
--     fire on the same paid transition. 308 fires first (alphabetical
--     'tr_increment_...' < 'tr_refund_...'), bumps received_contribs.
--     Refund trigger then compensates by decrementing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1a. Extend text CHECK on circle_contributions.status ────────────────

ALTER TABLE public.circle_contributions
  DROP CONSTRAINT IF EXISTS circle_contributions_status_check;
ALTER TABLE public.circle_contributions
  ADD  CONSTRAINT circle_contributions_status_check
    CHECK (status = ANY (ARRAY['pending','paid','late','missed','waived','refunded']));

-- ─── 1b. Extend contribution_status enum (used by public.contributions) ───
-- IF NOT EXISTS so re-apply is safe. The new label can't be USED in the
-- same transaction where it's added — the trigger function below only
-- references 'refunded' as a string literal in its body, which is parsed
-- at trigger fire time, so no dependency here.

ALTER TYPE contribution_status ADD VALUE IF NOT EXISTS 'refunded';

-- ─── 2. Trigger fn: circle_contributions (manual path) ───────────────────

CREATE OR REPLACE FUNCTION public.refund_excess_circle_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_circle_status TEXT;
  v_circle_name   TEXT;
  v_wallet_id     UUID;
  v_balance       BIGINT;
  v_amount_cents  BIGINT;
BEGIN
  -- Only fire on transitions INTO 'paid'.
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN RETURN NEW; END IF;

  -- Read parent circle status + name for the description string.
  SELECT status, name INTO v_circle_status, v_circle_name
    FROM public.circles WHERE id = NEW.circle_id;
  IF v_circle_status IS DISTINCT FROM 'completed'
     AND v_circle_status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_amount_cents := ROUND(NEW.amount * 100)::BIGINT;

    -- Lock wallet row (auto-provision if missing — same pattern as mig 304).
    SELECT id, main_balance_cents INTO v_wallet_id, v_balance
      FROM public.user_wallets WHERE user_id = NEW.user_id FOR UPDATE;
    IF v_wallet_id IS NULL THEN
      INSERT INTO public.user_wallets (user_id, main_balance_cents)
      VALUES (NEW.user_id, 0)
      RETURNING id, main_balance_cents INTO v_wallet_id, v_balance;
    END IF;

    UPDATE public.user_wallets
       SET main_balance_cents = main_balance_cents + v_amount_cents,
           last_activity_at   = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    ) VALUES (
      v_wallet_id, NEW.user_id, 'contribution_refund', 'credit',
      v_amount_cents, 'main',
      v_balance, v_balance + v_amount_cents,
      'circle_contribution', NEW.id,
      'Refund for contribution to closed circle ' || COALESCE(v_circle_name, ''),
      'completed',
      jsonb_build_object(
        'circle_id',     NEW.circle_id,
        'cycle_number',  NEW.cycle_number,
        'source_table',  'circle_contributions',
        'reason',        'circle_' || v_circle_status
      )
    );

    -- Undo the received_contributions bump that mig 308's trigger just
    -- fired for the same row. Safe if the cycle row is missing.
    UPDATE public.circle_cycles
       SET received_contributions = GREATEST(0, COALESCE(received_contributions, 0) - 1),
           updated_at             = NOW()
     WHERE circle_id = NEW.circle_id AND cycle_number = NEW.cycle_number;

    -- Flip status to 'refunded' — re-fires this trigger but the guard
    -- at the top exits before doing any work.
    UPDATE public.circle_contributions
       SET status = 'refunded',
           updated_at = NOW()
     WHERE id = NEW.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'refund_excess_circle_contribution failed for row % on circle %: %',
      NEW.id, NEW.circle_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_refund_excess_circle_contribution
  ON public.circle_contributions;
CREATE TRIGGER tr_refund_excess_circle_contribution
  AFTER INSERT OR UPDATE OF status
  ON public.circle_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_excess_circle_contribution();

-- ─── 3. Trigger fn: contributions (autopay path) ─────────────────────────

CREATE OR REPLACE FUNCTION public.refund_excess_contribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_circle_status TEXT;
  v_circle_name   TEXT;
  v_wallet_id     UUID;
  v_balance       BIGINT;
  v_amount_cents  BIGINT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN RETURN NEW; END IF;

  SELECT status, name INTO v_circle_status, v_circle_name
    FROM public.circles WHERE id = NEW.circle_id;
  IF v_circle_status IS DISTINCT FROM 'completed'
     AND v_circle_status IS DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_amount_cents := ROUND(NEW.amount * 100)::BIGINT;

    SELECT id, main_balance_cents INTO v_wallet_id, v_balance
      FROM public.user_wallets WHERE user_id = NEW.user_id FOR UPDATE;
    IF v_wallet_id IS NULL THEN
      INSERT INTO public.user_wallets (user_id, main_balance_cents)
      VALUES (NEW.user_id, 0)
      RETURNING id, main_balance_cents INTO v_wallet_id, v_balance;
    END IF;

    UPDATE public.user_wallets
       SET main_balance_cents = main_balance_cents + v_amount_cents,
           last_activity_at   = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    ) VALUES (
      v_wallet_id, NEW.user_id, 'contribution_refund', 'credit',
      v_amount_cents, 'main',
      v_balance, v_balance + v_amount_cents,
      'contribution', NEW.id,
      'Refund for autopay contribution to closed circle ' || COALESCE(v_circle_name, ''),
      'completed',
      jsonb_build_object(
        'circle_id',     NEW.circle_id,
        'cycle_number',  NEW.cycle_number,
        'source_table',  'contributions',
        'reason',        'circle_' || v_circle_status
      )
    );

    UPDATE public.circle_cycles
       SET received_contributions = GREATEST(0, COALESCE(received_contributions, 0) - 1),
           updated_at             = NOW()
     WHERE circle_id = NEW.circle_id AND cycle_number = NEW.cycle_number;

    UPDATE public.contributions
       SET status = 'refunded',
           updated_at = NOW()
     WHERE id = NEW.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'refund_excess_contribution failed for row % on circle %: %',
      NEW.id, NEW.circle_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_refund_excess_contribution
  ON public.contributions;
CREATE TRIGGER tr_refund_excess_contribution
  AFTER INSERT OR UPDATE OF status
  ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_excess_contribution();

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '309',
  'refund_excess_contribution_to_completed_circle',
  ARRAY['-- 309: enum/CHECK for refunded + triggers on both contribution tables']
)
ON CONFLICT (version) DO NOTHING;
