-- ═══════════════════════════════════════════════════════════════════════════
-- 287_fix_resolve_circle_by_invite_code_progress_type.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix a type mismatch in migration 286's `resolve_circle_by_invite_code`
-- RPC. I declared `progress NUMERIC` in the RETURNS TABLE, but
-- `circles.progress` is `integer` on the live table (int4). Every call to
-- the function fails with:
--   ERROR: structure of query does not match function result type
--   Returned type integer does not match expected type numeric in column 17
--
-- Column 17 is `progress`. Rest of the declared shape is verified against
-- information_schema.columns and matches (member_count / current_members /
-- min_score / grace_period_days / total_cycles / current_cycle /
-- cycles_completed are all integer; amount / payout_per_cycle /
-- total_payout_to_date / reputation_score are all numeric).
--
-- DROP + CREATE (rather than CREATE OR REPLACE) because Postgres refuses to
-- change a function's return type via REPLACE. The client contract is
-- unchanged — TypeScript widens integer to number the same way it widens
-- numeric, so no client edit is needed.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.resolve_circle_by_invite_code(TEXT);

CREATE FUNCTION public.resolve_circle_by_invite_code(p_code TEXT)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  type                  TEXT,
  amount                NUMERIC,
  frequency             TEXT,
  member_count          INT,
  current_members       INT,
  start_date            DATE,
  rotation_method       TEXT,
  grace_period_days     INT,
  status                TEXT,
  emoji                 TEXT,
  description           TEXT,
  location              TEXT,
  verified              BOOLEAN,
  min_score             INT,
  progress              INT,          -- was NUMERIC in migration 286; live column is int4
  invite_code           TEXT,
  beneficiary_name      TEXT,
  beneficiary_reason    TEXT,
  beneficiary_phone     TEXT,
  beneficiary_country   TEXT,
  is_one_time           BOOLEAN,
  is_recurring          BOOLEAN,
  total_cycles          INT,
  current_cycle         INT,
  payout_per_cycle      NUMERIC,
  cycles_completed      INT,
  total_payout_to_date  NUMERIC,
  reputation_score      NUMERIC,
  community_id          UUID,
  created_by            UUID,
  created_at            TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_code IS NULL OR length(trim(p_code)) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.type,
    c.amount,
    c.frequency,
    c.member_count,
    c.current_members,
    c.start_date,
    c.rotation_method,
    c.grace_period_days,
    c.status,
    c.emoji,
    c.description,
    c.location,
    c.verified,
    c.min_score,
    c.progress,
    c.invite_code,
    c.beneficiary_name,
    c.beneficiary_reason,
    c.beneficiary_phone,
    c.beneficiary_country,
    c.is_one_time,
    c.is_recurring,
    c.total_cycles,
    c.current_cycle,
    c.payout_per_cycle,
    c.cycles_completed,
    c.total_payout_to_date,
    c.reputation_score,
    c.community_id,
    c.created_by,
    c.created_at,
    c.updated_at
  FROM public.circles c
  WHERE c.invite_code = upper(trim(p_code))
    AND c.status IN ('pending', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_circle_by_invite_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_circle_by_invite_code(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_circle_by_invite_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_circle_by_invite_code(TEXT) IS
  'Resolves an invite code to a minimal circle row for an authenticated caller. '
  'Bypasses circles RLS so users who have the code (but are not yet members / in '
  'the community) can look the circle up before joining. Migration 287 fixes the '
  'progress column type (int, not numeric).';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '287',
  'fix_resolve_circle_by_invite_code_progress_type',
  ARRAY['-- 287: fix_resolve_circle_by_invite_code_progress_type']
)
ON CONFLICT (version) DO NOTHING;
