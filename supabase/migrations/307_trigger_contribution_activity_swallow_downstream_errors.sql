-- ═══════════════════════════════════════════════════════════════════════════
-- 307_trigger_contribution_activity_swallow_downstream_errors.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Third failure surfaced by the launch smoke test, downstream from
-- 305/306. Chain observed:
--
--   INSERT INTO contributions (status='paid', ...)                (1)
--     → trigger_contribution_activity()                            (2)
--       → update_financial_activity(user_id, 'contribution', id)   (3)
--         → calculate_initial_xnscore(user_id)                     (4)
--           → references v_profile.email_verified                  (5)
--
-- profiles has no email_verified column (only phone_verified /
-- kyc_verified_at). Step (5) throws 42703, cascading up through the
-- trigger and rolling back (1). Same symptom as 306 — every contribution
-- write aborts, wallet debit rolls back, autopay logs 'failed'.
--
-- Two ways to fix:
--   A. Fix calculate_initial_xnscore to reference the correct column
--      (risky — unknown other callers).
--   B. Make the analytics trigger fire-and-forget so a downstream
--      analytics failure never aborts the money movement.
--
-- (B) matches the pattern already used in execute_cycle_payout (304)
-- and notify_payout_received (188): money movement is the invariant;
-- side-effect analytics are nice-to-have. Wrap the PERFORM in a
-- BEGIN…EXCEPTION so any error inside update_financial_activity is
-- logged via NOTICE and swallowed. The parent INSERT commits.
--
-- (A) can still happen later — this migration is the safety net, not
-- the excuse to leave calculate_initial_xnscore broken.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_contribution_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.status IN ('paid', 'late')
       AND (OLD IS NULL OR OLD.status NOT IN ('paid', 'late')) THEN
        BEGIN
            PERFORM update_financial_activity(NEW.user_id, 'contribution', NEW.id);
        EXCEPTION WHEN OTHERS THEN
            -- Analytics side-effect only. A downstream failure (missing
            -- column, missing helper RPC, etc.) must not roll back the
            -- money-landed INSERT that fired us. Log for observability;
            -- the contribution + wallet debit stand.
            RAISE NOTICE 'trigger_contribution_activity: update_financial_activity failed for user % contribution %: %',
                NEW.user_id, NEW.id, SQLERRM;
        END;
    END IF;
    RETURN NEW;
END;
$function$;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '307',
  'trigger_contribution_activity_swallow_downstream_errors',
  ARRAY['-- 307: fault-tolerant trigger — never abort contribution INSERT on analytics-side error']
)
ON CONFLICT (version) DO NOTHING;
