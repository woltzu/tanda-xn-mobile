-- Read-only diagnostic for migration 069/070 drift.
-- All queries are SELECT-only — no schema/data changes.
-- Output is piped through python sql_run.py < this_file.

-- ── Q1: Are 069 and 070 (and adjacent versions) in schema_migrations? ────────
-- The audit's #1 hardening was "trust schema_migrations." Here we test it.
SELECT version, name, statements IS NOT NULL AS has_statements
FROM supabase_migrations.schema_migrations
WHERE version IN ('067','068','069','070','071')
   OR name ILIKE '%circle_join_connect_gate%'
   OR name ILIKE '%stripe_connected_accounts_event_ordering%'
ORDER BY version;

-- ── Q2: Does the live complete_circle_join contain the Stage 1 gate? ────────
-- The gate is uniquely identifiable by the string 'connect_not_ready'.
SELECT
  proname,
  CASE
    WHEN pg_get_functiondef(p.oid) ILIKE '%connect_not_ready%' THEN 'gate_present'
    ELSE 'gate_absent'
  END AS gate_status,
  length(pg_get_functiondef(p.oid)) AS function_body_chars,
  md5(pg_get_functiondef(p.oid)) AS function_body_md5
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'complete_circle_join';

-- ── Q3: Does stripe_connected_accounts have the 070 column? ─────────────────
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stripe_connected_accounts'
  AND column_name = 'last_account_event_at';

-- ── Q3b: Show all stripe_connected_accounts columns for sanity ──────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stripe_connected_accounts'
ORDER BY ordinal_position;

-- ── Q4: Side check — is the gate's input table actually queryable as-named? ─
-- (Confirms member_id, onboarding_status, payouts_enabled all exist.)
SELECT
  bool_or(column_name = 'member_id')           AS has_member_id,
  bool_or(column_name = 'onboarding_status')   AS has_onboarding_status,
  bool_or(column_name = 'payouts_enabled')     AS has_payouts_enabled
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'stripe_connected_accounts';
