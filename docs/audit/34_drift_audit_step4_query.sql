-- ============================================================================
-- DRIFT AUDIT — Step 4-5 verification query
-- ============================================================================
-- Read-only. Returns 2 result sets.
--
-- 11 cases total: 7 disk_only (file exists, no registry row)
--               + 4 registered_only (registry, no file)
--
-- RESULT SET 1 — DDL signature existence checks
-- For disk_only rows: effect_present=true  → "applied-but-unregistered" (DANGEROUS, backfill needed)
--                     effect_present=false → "authored-but-unapplied"   (dead code or never run)
-- For registered_only rows: effect_present=false → as expected (file was deleted intentionally)
--                          effect_present=true  → registry-vs-disk drift to investigate
-- ============================================================================

SELECT '035' AS version, 'disk_only' AS class,
       'member_behavioral_profiles (table)' AS signature_object,
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='member_behavioral_profiles' AND c.relkind='r') AS effect_present
UNION ALL
SELECT '050', 'disk_only', 'model_performance_logs (table)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='model_performance_logs' AND c.relkind='r')
UNION ALL
SELECT '055', 'disk_only', 'migration_screens (table)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='migration_screens' AND c.relkind='r')
UNION ALL
SELECT '057', 'disk_only', 'marketplace_stores (table)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='marketplace_stores' AND c.relkind='r')
UNION ALL
SELECT '062', 'disk_only', 'conflict_history (table)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='conflict_history' AND c.relkind='r')
UNION ALL
SELECT '064', 'disk_only', 'trip_listings (table; created by 064)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='trip_listings' AND c.relkind='r')
UNION ALL
SELECT '065', 'disk_only', 'trips (table; created by 065)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relname='trips' AND c.relkind='r')
UNION ALL
SELECT '028', 'registered_only', 'any table named token*/tokens (Tier 2 said removed)',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r'
                AND (c.relname LIKE 'token%' OR c.relname IN ('platform_tokens','user_tokens')))
UNION ALL
SELECT '029', 'registered_only', 'any table named api_*/whitelabel_*',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r'
                AND (c.relname LIKE 'api_%' OR c.relname LIKE '%whitelabel%' OR c.relname LIKE '%white_label%'))
UNION ALL
SELECT '030', 'registered_only', 'token/api cron schedule tables',
       EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE n.nspname='public' AND c.relkind='r'
                AND c.relname IN ('token_api_cron_schedules','token_cron_jobs','api_cron_schedules'))
UNION ALL
SELECT '069', 'registered_only',
       'connect_not_ready gate in complete_circle_join (should be FALSE — reverted by 071)',
       (pg_get_functiondef('public.complete_circle_join(uuid)'::regprocedure) ILIKE '%connect_not_ready%')
ORDER BY version;

-- ============================================================================
-- RESULT SET 2 — what the registry remembers about the 4 registered_only versions
-- The statements[] column has the original DDL for 028/029/030. Truncated to
-- 1500 chars so the output is readable. If result set 1's probe missed the
-- right table name (likely for 028/029/030), this preview tells us what they
-- actually created so we can refine the probe.
-- ============================================================================

SELECT
  version,
  name,
  array_length(statements, 1) AS n_statements,
  LEFT(array_to_string(statements, ' || ', '<NULL>'), 1500) AS statements_preview
FROM supabase_migrations.schema_migrations
WHERE version IN ('028','029','030','069')
ORDER BY version;
