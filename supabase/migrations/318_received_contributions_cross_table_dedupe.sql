-- ═══════════════════════════════════════════════════════════════════════════
-- 318_received_contributions_cross_table_dedupe.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to mig 308. That migration's two triggers both increment
-- circle_cycles.received_contributions by +1 on every transition into
-- 'paid'. When a member manages to land BOTH a manual contribution
-- (circle_contributions row) AND an autopay contribution (contributions
-- row) for the same cycle — rare but possible when autopay races with
-- an in-flight manual pay before the mig 304 guard sees the other
-- table — the counter goes to N+1 for a single distinct payer.
-- Downstream: cycle-progression-cron flips to `ready_payout` early,
-- payout fires with an incomplete member set, or `received > expected`
-- and the payout math is off.
--
-- Fix — before incrementing, each trigger looks in the OTHER source
-- table for an existing paid row from the same (circle_id, user_id,
-- cycle_number). If found, skip the increment; the other trigger
-- already counted this member. If not found, bump as before.
--
-- Ordering: since the two triggers fire from two different tables, they
-- can't race against each other in a single statement. Postgres row
-- locks on circle_cycles (implicit UPDATE lock) also serialize the
-- counter update if two INSERTs from the two tables land inside the
-- same transaction. The check-then-update sequence is safe because
-- the counter UPDATE itself is atomic and the check is against the
-- committed state of the other table.
--
-- Refund trigger interaction (mig 309): unchanged. Refunds still
-- decrement on flip to 'refunded' via that trigger's own body.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. circle_contributions trigger — check contributions before bump ───

CREATE OR REPLACE FUNCTION public.increment_received_from_circle_contributions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_dup INT;
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN

    -- Cross-table dedupe — has this (user, circle, cycle) already been
    -- counted from a `contributions` (autopay) row?
    SELECT COUNT(*) INTO v_dup
      FROM public.contributions
     WHERE circle_id    = NEW.circle_id
       AND user_id      = NEW.user_id
       AND cycle_number = NEW.cycle_number
       AND status       = 'paid';
    IF v_dup > 0 THEN
      RAISE NOTICE 'increment_received_from_circle_contributions: skip — contributions has a paid row for (%,%,%)',
        NEW.circle_id, NEW.user_id, NEW.cycle_number;
      RETURN NEW;
    END IF;

    BEGIN
      UPDATE public.circle_cycles
         SET received_contributions = COALESCE(received_contributions, 0) + 1,
             updated_at             = NOW()
       WHERE circle_id    = NEW.circle_id
         AND cycle_number = NEW.cycle_number;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'increment_received_from_circle_contributions failed for circle % cycle %: %',
        NEW.circle_id, NEW.cycle_number, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── 2. contributions trigger — mirror check ─────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_received_from_contributions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_dup INT;
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN

    -- Cross-table dedupe — has this (user, circle, cycle) already been
    -- counted from a `circle_contributions` (manual) row?
    SELECT COUNT(*) INTO v_dup
      FROM public.circle_contributions
     WHERE circle_id    = NEW.circle_id
       AND user_id      = NEW.user_id
       AND cycle_number = NEW.cycle_number
       AND status       = 'paid';
    IF v_dup > 0 THEN
      RAISE NOTICE 'increment_received_from_contributions: skip — circle_contributions has a paid row for (%,%,%)',
        NEW.circle_id, NEW.user_id, NEW.cycle_number;
      RETURN NEW;
    END IF;

    BEGIN
      UPDATE public.circle_cycles
         SET received_contributions = COALESCE(received_contributions, 0) + 1,
             updated_at             = NOW()
       WHERE circle_id    = NEW.circle_id
         AND cycle_number = NEW.cycle_number;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'increment_received_from_contributions failed for circle % cycle %: %',
        NEW.circle_id, NEW.cycle_number, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '318',
  'received_contributions_cross_table_dedupe',
  ARRAY['-- 318: both triggers skip if the other source table already counted this user for this cycle']
)
ON CONFLICT (version) DO NOTHING;
