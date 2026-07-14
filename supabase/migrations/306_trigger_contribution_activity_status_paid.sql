-- ═══════════════════════════════════════════════════════════════════════════
-- 306_trigger_contribution_activity_status_paid.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Companion to 305. That migration fixed the RPC body's enum literal.
-- Re-running the smoke test surfaced a second copy of the same bug on
-- the AFTER-INSERT trigger `trigger_contribution_activity`:
--
--   IF NEW.status IN ('completed', 'late')
--      AND (OLD IS NULL OR OLD.status NOT IN ('completed', 'late'))
--   THEN
--     PERFORM update_financial_activity(...)
--
-- `contributions.status` is the `contribution_status` enum whose labels
-- are ('pending','paid','late','missed','waived'). 'completed' is not a
-- valid label — Postgres tries to cast the string literal on both sides
-- of IN and throws 22P02, aborting the parent INSERT even though the
-- new row's status is 'paid'. Trace observed today:
--
--   ERROR: invalid input value for enum contribution_status: "completed"
--   QUERY: NEW.status IN ('completed', 'late') ...
--   CONTEXT: trigger_contribution_activity() line 4 at IF
--
-- Fix — swap the literal to 'paid'. The trigger's own comment says
-- "when contribution is completed or late (both mean paid)" — so the
-- intent was always to fire on the money-landed state, which is 'paid'
-- in this schema.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_contribution_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Fire on the money-landed transition. 'paid' is the enum label
    -- for "contribution succeeded"; 'late' also means paid but late.
    IF NEW.status IN ('paid', 'late')
       AND (OLD IS NULL OR OLD.status NOT IN ('paid', 'late')) THEN
        PERFORM update_financial_activity(NEW.user_id, 'contribution', NEW.id);
    END IF;
    RETURN NEW;
END;
$function$;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '306',
  'trigger_contribution_activity_status_paid',
  ARRAY['-- 306: trigger_contribution_activity: status IN ''completed''/''late'' → ''paid''/''late''']
)
ON CONFLICT (version) DO NOTHING;
