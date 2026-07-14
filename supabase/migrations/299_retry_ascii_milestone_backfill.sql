-- ═══════════════════════════════════════════════════════════════════════════
-- 299_retry_ascii_milestone_backfill.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Retry the wallet_transactions + feed_posts backfill from migration 298.
-- The prior UPDATEs used a `LIKE E'ðŸŽ‰%'` predicate that included the
-- double-encoded prefix as literal high-Unicode characters. Those
-- characters went through the same broken transport layer (sql_run.py +
-- Management API) that corrupted the original emoji in migration 294 —
-- the pattern was re-encoded once more en route to Postgres and no
-- longer matched the stored bytes, so zero rows were updated.
--
-- This retry uses a pure-ASCII negative predicate:
--     description NOT LIKE 'Milestone reached%'
-- Any row not already in the new format gets rewritten. Idempotent by
-- construction — a second run touches nothing because every previously
-- corrupted row now starts with "Milestone reached".
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── wallet_transactions (Home activity feed) ──────────────────────────────
UPDATE public.wallet_transactions
SET description = 'Milestone reached - you hit '
                  || (metadata->>'milestone_percent')::TEXT
                  || '% of '
                  || COALESCE(
                       (SELECT name FROM public.user_savings_goals
                        WHERE id = (metadata->>'goal_id')::uuid),
                       'your goal')
                  || '.'
WHERE transaction_type = 'goal_milestone'
  AND description NOT LIKE 'Milestone reached%';

-- ─── feed_posts (community / dream feed) ───────────────────────────────────
UPDATE public.feed_posts
SET content = 'Milestone reached - I have hit '
              || (metadata->>'milestone_percent')::TEXT
              || '% of my '
              || COALESCE(
                   (SELECT name FROM public.user_savings_goals
                    WHERE id = (metadata->>'goal_id')::uuid),
                   'savings')
              || ' goal.'
              || COALESCE(' ' || (metadata->>'goal_emoji'), '')
WHERE type = 'milestone'
  AND content NOT LIKE 'Milestone reached%';

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '299',
  'retry_ascii_milestone_backfill',
  ARRAY['-- 299: retry the milestone description backfill using an ASCII-safe predicate']
)
ON CONFLICT (version) DO NOTHING;
