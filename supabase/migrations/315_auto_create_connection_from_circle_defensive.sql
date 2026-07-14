-- ═══════════════════════════════════════════════════════════════════════════
-- 315_auto_create_connection_from_circle_defensive.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to 314. Qualifying the sub-SELECT with `d.status` in mig 314
-- exposed a deeper bug: `defaults` has no `status` column — the real
-- column is `default_status`. The original unqualified reference threw
-- "ambiguous" because NEW.status (circles row) was a candidate; with the
-- qualification, PG went looking for `defaults.status` and correctly
-- reported "does not exist".
--
-- Also — the outer WHERE compares circle_members.status to 'completed',
-- but that column's value space is 'active'/'inactive'/etc. — never
-- 'completed'. Result: the trigger's INSERT-SELECT has never matched
-- any rows, meaning the "create acquaintance connections between
-- circle members on completion" side-effect has never done anything.
-- The whole trigger is dead-on-arrival scaffolding for a feature that
-- would need a proper rewrite.
--
-- Rather than try to guess the original intent, this migration wraps
-- the whole trigger body in BEGIN…EXCEPTION so a definitely-broken
-- analytics trigger can never abort a real money-movement UPDATE on
-- circles. If the "connections" feature is ever wanted, replace this
-- body with a correct implementation — but the safety net stays.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_create_connection_from_circle()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
        BEGIN
            INSERT INTO user_connections (
              user_id, connected_user_id, connection_type, source,
              circles_together, successful_circles
            )
            SELECT
              cm1.user_id,
              cm2.user_id,
              'acquaintance',
              'circle_history',
              1,
              CASE
                WHEN (
                  SELECT COUNT(*)
                    FROM defaults d
                   WHERE d.circle_id = NEW.id
                     AND d.default_status = 'unresolved'
                ) = 0 THEN 1
                ELSE 0
              END
            FROM circle_members cm1
            JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
            WHERE cm1.circle_id = NEW.id
              AND cm1.user_id != cm2.user_id
              AND cm1.status = 'active'
              AND cm2.status = 'active'
            ON CONFLICT (user_id, connected_user_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            -- Analytics side-effect only. If the connection-creation
            -- INSERT throws (bad value, schema drift, etc.), log and
            -- swallow — the money-landed UPDATE on circles must never
            -- be rolled back by an analytics failure.
            RAISE NOTICE 'auto_create_connection_from_circle failed for circle %: %',
              NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '315',
  'auto_create_connection_from_circle_defensive',
  ARRAY['-- 315: swallow trigger errors + use correct defaults.default_status + cm.status=active']
)
ON CONFLICT (version) DO NOTHING;
