-- ════════════════════════════════════════════════════════════════════════════
-- Migration 085: Adapt support_tickets for Stress Signal B (ticket_language)
-- ════════════════════════════════════════════════════════════════════════════
-- IMPORTANT: support_tickets already exists in prod (created by an earlier
-- unregistered migration). Its schema differs from a greenfield design:
--
--   Existing columns: id, user_id (nullable!), category (NOT NULL), subject
--     (NOT NULL), description (NOT NULL), status, priority, assigned_to,
--     created_at, updated_at, resolved_at
--   Missing: language (we need this for stress_keywords lookup)
--
-- This migration ADAPTS the existing table rather than redefining it:
--   1. Adds `language` column (defaults 'en', CHECK matches stress_keywords)
--   2. Adds an INSERT policy so authenticated users can file their own
--      tickets (existing policies only cover SELECT)
--   3. Adds a partial unique index on member_stress_signals so the same
--      ticket can never produce two signal rows even if the trigger fires
--      twice (defense-in-depth against pg_net retries, manual re-runs, etc.)
--
-- Why we deviate from the original spec:
--   The original plan assumed support_tickets had `message` and `language`
--   columns. Reality: the column is `description`, and language is missing.
--   The Edge Function reads from description+subject and falls back to 'en'
--   if language is null. New tickets get the default 'en' until callers
--   start setting it explicitly.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Add language column ──────────────────────────────────────────────

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- CHECK constraint mirrors stress_keywords.language. Skipped if already
-- added (DO block lets us add a named constraint idempotently — there's
-- no native ADD CONSTRAINT IF NOT EXISTS in PG <16).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_language_check'
  ) THEN
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_language_check
      CHECK (language IS NULL OR language IN ('en','fr','es','pt'));
  END IF;
END $$;


-- ─── 2. Allow authenticated users to file their own tickets ──────────────

-- The existing 'Users can view own tickets' policy covers SELECT only;
-- without an INSERT policy users can't actually file a ticket from the
-- mobile client. (Admins-can-manage covers admin flows.)
DROP POLICY IF EXISTS support_tickets_user_insert ON support_tickets;
CREATE POLICY support_tickets_user_insert ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());


-- ─── 3. Idempotency: one ticket → at most one ticket_language signal ─────

-- The stress-analyze-ticket EF will store ticket_id inside raw_data. We
-- add a partial unique index keyed on that JSONB path so the DB enforces
-- "one signal per ticket" no matter how many times the trigger fires
-- (pg_net retries, manual re-invocations, etc.). The Index is partial so
-- it only constrains rows we care about (signal_type='ticket_language'
-- with a non-null ticket_id).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ticket_signal_per_ticket
  ON member_stress_signals((raw_data->>'ticket_id'))
  WHERE signal_type = 'ticket_language'
    AND (raw_data->>'ticket_id') IS NOT NULL;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('085', 'support_tickets_for_stress',
        ARRAY['-- 085: language column + user INSERT policy + dedup index'])
ON CONFLICT (version) DO NOTHING;
