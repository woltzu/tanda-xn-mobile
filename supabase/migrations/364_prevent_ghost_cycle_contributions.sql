-- ═══════════════════════════════════════════════════════════════════════════
-- 364_prevent_ghost_cycle_contributions.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Defensive trigger: reject INSERTs into circle_contributions when the
-- (circle_id, cycle_number) tuple has no matching circle_cycles row.
--
-- Surfaced by the 2026-07-14/2026-07-19 ghost-cycle-6 incident on TCP 3
-- and TCP 4 (and the wider audit that found 25+ orphan contribution
-- rows across the DB totaling $2,465). Some client path was capturing
-- Stripe money for cycle_number values that had no corresponding
-- circle_cycles row — the money was in Stripe, the app said "you
-- contributed", and nothing on the backend could reconcile it against
-- an actual cycle.
--
-- This trigger blocks the write at the DB boundary. A client attempt
-- to contribute to a nonexistent cycle now fails fast with a typed
-- error rather than silently capturing money into orphan rows.
--
-- Companion client-side fix (find the code path that generates
-- cycle_number for the contribution UI) is still needed and tracked
-- separately — this migration is defense-in-depth only.
--
-- Existing orphan rows are NOT touched by this trigger (BEFORE INSERT
-- only fires on new rows). Legacy orphans need a separate cleanup
-- + Stripe-side refunds.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_contribution_cycle_exists()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.circle_cycles
     WHERE circle_id = NEW.circle_id
       AND cycle_number = NEW.cycle_number
  ) THEN
    RAISE EXCEPTION
      'contribution_targets_nonexistent_cycle: circle_id=% cycle_number=%',
      NEW.circle_id, NEW.cycle_number
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_contribution_cycle_exists
  ON public.circle_contributions;

CREATE TRIGGER trg_guard_contribution_cycle_exists
  BEFORE INSERT ON public.circle_contributions
  FOR EACH ROW EXECUTE FUNCTION public.guard_contribution_cycle_exists();

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '364',
  'prevent_ghost_cycle_contributions',
  ARRAY['-- 364: BEFORE INSERT guard rejecting contributions to nonexistent cycles']
)
ON CONFLICT (version) DO NOTHING;
