-- ═══════════════════════════════════════════════════════════════════════════
-- 314_auto_create_connection_from_circle_qualified.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- auto_create_connection_from_circle() fires on circles UPDATE. It has
-- never actually run in production because no code path ever set
-- circles.status='completed' before mig 310's finalization block
-- landed today.
--
-- Two problems the smoke test surfaced when the finalization block
-- fired for the first time:
--
--   1. Ambiguous `status` in the sub-SELECT:
--        SELECT COUNT(*) FROM defaults
--         WHERE circle_id = NEW.id AND status = 'unresolved'
--      NEW here is a circles row; NEW.status='completed'. Postgres
--      couldn't disambiguate the unqualified `status` between
--      defaults.status (the intended target) and NEW.status —
--      threw 42702 and rolled back the whole UPDATE, which rolled
--      back the parent execute_cycle_payout, which stamped the
--      cycle as payout_pending.
--
--   2. Semantic bug: the outer WHERE has cm1.status = 'completed'
--      AND cm2.status = 'completed'. circle_members.status is
--      'active' / 'inactive' / etc. — no member row ever has
--      status='completed'. So even if the trigger ran, the INSERT
--      would find zero matching cm pairs. This means the trigger's
--      "create acquaintance connections between members of the
--      completed circle" side-effect has never done anything, and
--      still won't after this fix. Not this migration's job to
--      rewrite the semantics — just to stop the ambiguity from
--      aborting the payout finalization.
--
-- Fix — table-alias `defaults` as `d` and use `d.status` in the
-- subquery. Also qualify `d.circle_id` for consistency. Everything
-- else is byte-identical to the prior deploy.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_create_connection_from_circle()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
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
                 AND d.status = 'unresolved'
            ) = 0 THEN 1
            ELSE 0
          END
        FROM circle_members cm1
        JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
        WHERE cm1.circle_id = NEW.id
          AND cm1.user_id != cm2.user_id
          AND cm1.status = 'completed'
          AND cm2.status = 'completed'
        ON CONFLICT (user_id, connected_user_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '314',
  'auto_create_connection_from_circle_qualified',
  ARRAY['-- 314: qualify defaults.status in trigger sub-SELECT so NEW.status doesnt collide']
)
ON CONFLICT (version) DO NOTHING;
