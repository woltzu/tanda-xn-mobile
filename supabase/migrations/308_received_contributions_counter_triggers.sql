-- ═══════════════════════════════════════════════════════════════════════════
-- 308_received_contributions_counter_triggers.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- P0 launch blocker discovered during the 2026-07-14 end-to-end test —
-- circle_cycles.received_contributions is never incremented by any code
-- path we run in production:
--
--   * stripe-webhook writes public.circle_contributions on payment success,
--     but does NOT touch circle_cycles.
--   * process-circle-autopay writes public.contributions via the
--     process_circle_autopay_wallet_debit RPC, also does not touch
--     circle_cycles.
--   * The only existing trigger that maintains this counter fires from
--     public.cycle_contributions — a third table that neither path
--     inserts into.
--
-- Result — received_contributions stays 0 forever, cycle-progression-cron
-- never sees "received >= expected", cycles never transition to
-- ready_payout, no payouts ever fire automatically. During the smoke
-- test we bumped the counter by hand; every production cycle has the
-- same latent condition and would silently fail to progress.
--
-- Fix (this migration) —
--   1. AFTER-INSERT/UPDATE-of-status trigger on circle_contributions.
--   2. AFTER-INSERT/UPDATE-of-status trigger on contributions.
--   Both fire only on transitions INTO 'paid' (INSERT with status='paid'
--   or UPDATE where OLD.status != 'paid' AND NEW.status = 'paid') so a
--   pending→paid promotion counts once, a paid→paid metadata update does
--   not double-count. The UPDATE against circle_cycles is wrapped in
--   BEGIN…EXCEPTION so a counter-side failure never rolls back the
--   contribution write itself.
--
-- Backfill — recompute received_contributions for every cycle currently
-- stuck at 0/NULL, counting distinct paying users across BOTH source
-- tables. Uses DISTINCT so historical rows written before mig 304
-- restored the per-(member,cycle) guard don't inflate the count.
-- Cycles that already have received_contributions > 0 are left alone —
-- they may have been set by hand (like Test Circle Payout 4 cycles 1
-- and 2) and we don't want to clobber those.
--
-- Known limitation (out of scope for this migration) — a member could
-- have BOTH a circle_contributions row (manual) and a contributions
-- row (autopay) for the same cycle if autopay landed first and the
-- guard in mig 304 didn't see it. The two triggers would fire
-- independently and double-count that member. Realistic mitigation:
-- extend mig 304's guard to look at both tables. Documented, not fixed
-- here to keep this diff surgical.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Trigger fn for circle_contributions ─────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_received_from_circle_contributions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    BEGIN
      UPDATE public.circle_cycles
         SET received_contributions = COALESCE(received_contributions, 0) + 1,
             updated_at             = NOW()
       WHERE circle_id = NEW.circle_id
         AND cycle_number = NEW.cycle_number;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'increment_received_from_circle_contributions failed for circle % cycle %: %',
        NEW.circle_id, NEW.cycle_number, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_increment_received_from_circle_contribution
  ON public.circle_contributions;
CREATE TRIGGER tr_increment_received_from_circle_contribution
  AFTER INSERT OR UPDATE OF status
  ON public.circle_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_received_from_circle_contributions();

-- ─── 2. Trigger fn for contributions (autopay path) ─────────────────────
-- Same shape. status is the contribution_status enum here; 'paid' is a
-- valid label so the literal compares cleanly.

CREATE OR REPLACE FUNCTION public.increment_received_from_contributions()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'paid'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'paid') THEN
    BEGIN
      UPDATE public.circle_cycles
         SET received_contributions = COALESCE(received_contributions, 0) + 1,
             updated_at             = NOW()
       WHERE circle_id = NEW.circle_id
         AND cycle_number = NEW.cycle_number;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'increment_received_from_contributions failed for circle % cycle %: %',
        NEW.circle_id, NEW.cycle_number, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_increment_received_from_contribution
  ON public.contributions;
CREATE TRIGGER tr_increment_received_from_contribution
  AFTER INSERT OR UPDATE OF status
  ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_received_from_contributions();

-- ─── 3. Backfill ──────────────────────────────────────────────────────────
-- Only touches cycles where the counter hasn't been maintained yet
-- (received_contributions = 0 OR NULL). Counts DISTINCT paying users
-- across both source tables. Cycles with a positive value are left
-- alone.

WITH paid_users AS (
  SELECT circle_id, cycle_number, user_id
    FROM public.circle_contributions
   WHERE status = 'paid'
  UNION
  SELECT circle_id, cycle_number, user_id
    FROM public.contributions
   WHERE status = 'paid'
),
counts AS (
  SELECT circle_id, cycle_number, COUNT(*) AS n
    FROM paid_users
   GROUP BY circle_id, cycle_number
)
UPDATE public.circle_cycles cc
   SET received_contributions = counts.n,
       updated_at             = NOW()
  FROM counts
 WHERE cc.circle_id    = counts.circle_id
   AND cc.cycle_number = counts.cycle_number
   AND COALESCE(cc.received_contributions, 0) = 0;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '308',
  'received_contributions_counter_triggers',
  ARRAY['-- 308: two triggers keep circle_cycles.received_contributions honest + backfill']
)
ON CONFLICT (version) DO NOTHING;
