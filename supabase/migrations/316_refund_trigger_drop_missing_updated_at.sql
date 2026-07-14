-- ═══════════════════════════════════════════════════════════════════════════
-- 316_refund_trigger_drop_missing_updated_at.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- mig 309's refund_excess_circle_contribution had a subtle bug: its
-- final UPDATE tried to touch `circle_contributions.updated_at`, but
-- that column doesn't exist on this table (only `created_at` is
-- present — see the launch smoke test today, which pulled the actual
-- column list). The BEGIN…EXCEPTION handler in that trigger swallowed
-- the error silently, so refunds looked like no-ops without any
-- visible failure.
--
-- Also — `contributions` (autopay-source table) DOES have updated_at
-- (verified via information_schema), so the sibling
-- refund_excess_contribution() trigger from mig 309 is fine as-is.
-- Only the circle_contributions branch needs the fix.
--
-- Fix — drop the `updated_at = NOW()` clause from the final UPDATE.
-- Everything else in mig 309's function body stays byte-identical.
-- ═══════════════════════════════════════════════════════════════════════════

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

    UPDATE public.circle_cycles
       SET received_contributions = GREATEST(0, COALESCE(received_contributions, 0) - 1),
           updated_at             = NOW()
     WHERE circle_id = NEW.circle_id AND cycle_number = NEW.cycle_number;

    -- Flip status to 'refunded' — no updated_at on circle_contributions.
    UPDATE public.circle_contributions
       SET status = 'refunded'
     WHERE id = NEW.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'refund_excess_circle_contribution failed for row % on circle %: %',
      NEW.id, NEW.circle_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Drop the smoke-test scaffold table (was only used during today's launch
-- verification to trace which checkpoint the trigger reached).
DROP TABLE IF EXISTS public.debug_refund_trigger_log;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '316',
  'refund_trigger_drop_missing_updated_at',
  ARRAY['-- 316: fix refund trigger — circle_contributions has no updated_at']
)
ON CONFLICT (version) DO NOTHING;
