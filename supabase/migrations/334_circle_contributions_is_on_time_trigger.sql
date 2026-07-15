-- ═══════════════════════════════════════════════════════════════════════════
-- 334_circle_contributions_is_on_time_trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Gap 1 of the two remaining pre-launch XnScore gaps.
--
-- Problem: circle_contributions.is_on_time is NULL on 22 of 23 of
-- Marcus's paid rows (and similar for every other user). None of the
-- three insert sites populate it:
--
--   * supabase/functions/stripe-webhook/index.ts — INSERT/UPDATE to
--     status='paid', sets paid_date/payment_method but not is_on_time.
--   * context/CirclesContext.tsx (wallet path) — INSERT with
--     status='paid' from client, sets due_date + paid_date via defaults
--     but not is_on_time.
--   * (create-circle-contribution-intent only inserts pending_intents,
--     not circle_contributions.)
--
-- The scoring RPC (mig 332) falls back to `paid_date <= due_date`
-- comparison when is_on_time IS NULL, but that fallback is fragile:
--   * date_col <= date_col cast to timestamptz turns the date into
--     midnight of that day, so a same-day-as-due payment at 2pm reads
--     as LATE.
--   * The row's due_date is not always the true deadline — the
--     stripe-webhook INSERT-new-row branch sets due_date = TODAY
--     because it's inserting for a payment that arrived without a
--     pre-existing scheduled row.
--
-- Fix: BEFORE trigger on circle_contributions that computes is_on_time
-- and days_late at write time, reading the true deadline from
-- circle_cycles.contribution_deadline (with grace_period_end as the
-- effective cutoff) and falling back to the row's own due_date only
-- when no cycle row exists. Fires on:
--   * INSERT of any row (populates from the start)
--   * UPDATE OF status, paid_date (stripe-webhook flips a pending row
--     to paid, or paid_date gets backfilled later)
--
-- Grace period counts as on time — matches the user-visible framing
-- ("you have N days of grace"). If a UX design change later wants
-- strict-deadline on-time and grace-as-late, this is the one place
-- to change it.
--
-- Backfill: no-op UPDATE that lists the columns in an OF-clause fires
-- the trigger for every row without duplicating logic. Only touches
-- rows that need it (is_on_time IS NULL AND status in ('paid','late')).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.compute_circle_contribution_on_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_deadline  DATE;
    v_grace_end DATE;
    v_cutoff    DATE;
BEGIN
    -- Only compute for paid rows with a payment timestamp. Pending
    -- rows have no is_on_time signal to compute — they haven't been
    -- paid yet. Late/missed rows are set by whatever pipeline flips
    -- them to that status; if it also populates paid_date it lands
    -- through the OF paid_date branch on UPDATE.
    IF NEW.status = 'paid' AND NEW.paid_date IS NOT NULL THEN
        -- Prefer the cycle's declared deadline (source of truth).
        -- Fall back to the row's due_date only when no cycle row
        -- exists (ad-hoc contributions, legacy data).
        SELECT contribution_deadline, grace_period_end
          INTO v_deadline, v_grace_end
          FROM public.circle_cycles
         WHERE circle_id    = NEW.circle_id
           AND cycle_number = NEW.cycle_number
         LIMIT 1;

        IF v_deadline IS NULL THEN
            v_deadline := NEW.due_date;
        END IF;

        -- Grace window counts as on time.
        v_cutoff := COALESCE(v_grace_end, v_deadline);

        NEW.is_on_time := (NEW.paid_date::date <= v_cutoff);

        IF NEW.is_on_time THEN
            NEW.days_late := 0;
        ELSE
            -- days_late measured against the hard deadline, not the
            -- grace end — so a payment 3 days past deadline within a
            -- 5-day grace window shows is_on_time=TRUE + days_late=0
            -- (grace consumed it), and one 8 days past deadline shows
            -- is_on_time=FALSE + days_late=8.
            NEW.days_late := GREATEST(0, (NEW.paid_date::date - v_deadline)::INTEGER);
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_compute_is_on_time
  ON public.circle_contributions;

CREATE TRIGGER tr_compute_is_on_time
  BEFORE INSERT OR UPDATE OF status, paid_date
  ON public.circle_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_circle_contribution_on_time();

-- ─── Backfill existing rows via no-op UPDATE ────────────────────────────
-- The OF-clause on the trigger definition means UPDATE ... SET status
-- = status fires the trigger for every matching row, regardless of
-- whether the value actually changes.
UPDATE public.circle_contributions
   SET status = status
 WHERE is_on_time IS NULL
   AND status = 'paid'
   AND paid_date IS NOT NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '334',
  'circle_contributions_is_on_time_trigger',
  ARRAY['-- 334: BEFORE trigger computes is_on_time/days_late from circle_cycles deadline + backfill']
)
ON CONFLICT (version) DO NOTHING;
