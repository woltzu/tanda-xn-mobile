-- ═══════════════════════════════════════════════════════════════════════════
-- 286_resolve_circle_by_invite_code.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes the "Invite code not found" bug introduced by migration 255.
--
-- Migration 255 tightened `circles` SELECT RLS to caller = creator / active
-- community member / current circle member. That closed the invite-code
-- lookup path: a friend who has ONLY the code (not yet in the community, not
-- yet a circle member) matches no branch of the policy, so the client-side
-- `.eq("invite_code", ...).maybeSingle()` returns null, and the UI shows
-- "Invite code not found."
--
-- Fix: a SECURITY DEFINER RPC that resolves an invite code to a minimal
-- circle row for any authenticated user. Bypasses RLS by design — the code
-- itself is the capability. Anonymous callers still can't touch it (grant
-- is authenticated-only), and there's no listing / enumeration path: the
-- caller must present the exact code, so this is not a discovery leak.
--
-- Return set mirrors CircleRow in CirclesContext.tsx so rowToCircle() maps
-- cleanly. Discovery-blocking-side note: no `created_by` in the return set
-- would be a subtle regression because JoinCircleConfirmScreen doesn't use
-- it, but we include it anyway to keep the shape identical (rowToCircle
-- reads it).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.resolve_circle_by_invite_code(p_code TEXT)
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
  progress              NUMERIC,
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
  -- Auth gate — signed-out callers get nothing. Anon key is separately
  -- revoked below so this is defence-in-depth, not the primary control.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- Trim and validate before matching. Below 4 chars is short of any
  -- gen_invite_code output (8 chars) or legacy vanity codes, so bail
  -- rather than run a full-table equality scan with a partial code.
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
    -- Only surface circles in a joinable state. Matches join_circle's own
    -- accepted-status set (see migration 141).
    AND c.status IN ('pending', 'active');
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_circle_by_invite_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_circle_by_invite_code(TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_circle_by_invite_code(TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_circle_by_invite_code(TEXT) IS
  'Resolves an invite code to a minimal circle row for an authenticated caller. '
  'Bypasses circles RLS so users who have the code (but are not yet members / in '
  'the community) can look the circle up before joining. Migration 286.';

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '286',
  'resolve_circle_by_invite_code',
  ARRAY['-- 286: resolve_circle_by_invite_code']
)
ON CONFLICT (version) DO NOTHING;
