-- ═══════════════════════════════════════════════════════════════════════════
-- 345_community_join_requests.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 2 of the Community redesign: user-initiated join requests +
-- elder approval flow. Auto-assignment from mig 344 stays unchanged
-- (users still land in their origin country/city communities
-- automatically); everything else now goes through this request-review
-- pipeline.
--
-- Model:
--   * User clicks "Request to Join" on a community they aren't a
--     member of → row lands in community_join_requests with
--     status='pending'.
--   * Any active elder or owner of that community sees pending
--     requests in their Elder dashboard and can approve/reject.
--   * On approve: RPC inserts into community_memberships (which
--     cascades through mig 342's arrival trigger, mig 344's already-
--     wired NULL guard for origin fields, and the community counter
--     trigger from mig 251/etc.). Request row flips to 'approved'
--     with reviewer + timestamp.
--   * On reject: request row flips to 'rejected' with reviewer +
--     timestamp + optional reason. No membership created.
--
-- Existing prod state at time of writing (2026-07-16):
--   community_memberships: 79 rows across 77 communities. Roles
--   breakdown: owner 73, elder 4, member 5. All 4 elders belong to
--   Marcus (35545a5f) across four communities, each at tier='Junior'.
--   That means only Marcus can approve/reject requests for those
--   four communities today; every other community's approval queue
--   falls to owners.
--
-- Note on existing process_join_request RPC:
--   pg_proc shows a process_join_request(p_admin_id, p_group_id,
--   p_user_id, p_action, p_reason) — that function is for the
--   CIRCLES/groups flow (references `groups` and `group_members`
--   tables). Unrelated to communities. We add three distinct RPCs
--   here to keep the community + circle paths cleanly separated.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id  UUID         NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  status        TEXT         NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','approved','rejected','withdrawn')),
  reason        TEXT,        -- user's optional message on request
  requested_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reviewed_by   UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   TIMESTAMPTZ,
  reviewer_note TEXT,        -- elder's optional message on approve/reject
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, community_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_pending_by_community
  ON public.community_join_requests (community_id, status, requested_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_join_requests_by_user
  ON public.community_join_requests (user_id, requested_at DESC);

-- ─── 2. RLS ───────────────────────────────────────────────────────────

ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- User can INSERT their own request via the RPC; direct-table INSERT is
-- allowed too for completeness. The check that the user isn't already
-- a member lives in the create RPC (below).
DROP POLICY IF EXISTS join_requests_insert_own ON public.community_join_requests;
CREATE POLICY join_requests_insert_own ON public.community_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- User can SELECT their own requests. Elders/owners of the community
-- can SELECT any request against their community.
DROP POLICY IF EXISTS join_requests_select ON public.community_join_requests;
CREATE POLICY join_requests_select ON public.community_join_requests
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.community_memberships cm
       WHERE cm.user_id      = auth.uid()
         AND cm.community_id = community_join_requests.community_id
         AND cm.role         IN ('elder', 'owner')
         AND cm.status       = 'active'
    )
  );

-- Only elders/owners can UPDATE (approve/reject). The RPCs below use
-- SECURITY DEFINER so they bypass RLS on the actual write, but the
-- policy is still worth having in case direct-table UPDATEs ever
-- happen from the app.
DROP POLICY IF EXISTS join_requests_update_elder ON public.community_join_requests;
CREATE POLICY join_requests_update_elder ON public.community_join_requests
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.community_memberships cm
       WHERE cm.user_id      = auth.uid()
         AND cm.community_id = community_join_requests.community_id
         AND cm.role         IN ('elder', 'owner')
         AND cm.status       = 'active'
    )
  );

-- User can withdraw their own pending request (DELETE own).
DROP POLICY IF EXISTS join_requests_delete_own_pending ON public.community_join_requests;
CREATE POLICY join_requests_delete_own_pending ON public.community_join_requests
  FOR DELETE TO authenticated USING (
    user_id = auth.uid() AND status = 'pending'
  );

-- Service role can do everything (for triggers + admin flows).
DROP POLICY IF EXISTS join_requests_service_all ON public.community_join_requests;
CREATE POLICY join_requests_service_all ON public.community_join_requests
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ─── 3. RPCs ─────────────────────────────────────────────────────────

-- 3a. request_to_join_community — user-initiated
CREATE OR REPLACE FUNCTION public.request_to_join_community(
  p_community_id UUID,
  p_reason       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community_id) THEN
    RAISE EXCEPTION 'community_not_found';
  END IF;

  -- Already a member — nothing to do
  IF EXISTS (
    SELECT 1 FROM public.community_memberships
     WHERE user_id      = v_user_id
       AND community_id = p_community_id
       AND status       = 'active'
  ) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  -- Idempotent — if a pending request exists, return its id instead
  -- of inserting a duplicate. Approved/rejected requests get a fresh
  -- row (the unique constraint will fire; caller should handle).
  SELECT id INTO v_request_id
    FROM public.community_join_requests
   WHERE user_id = v_user_id AND community_id = p_community_id
     AND status = 'pending'
   LIMIT 1;

  IF v_request_id IS NOT NULL THEN
    RETURN v_request_id;
  END IF;

  INSERT INTO public.community_join_requests
    (user_id, community_id, reason)
  VALUES
    (v_user_id, p_community_id, p_reason)
  ON CONFLICT (user_id, community_id) DO UPDATE
     SET status       = 'pending',
         reason       = EXCLUDED.reason,
         requested_at = NOW(),
         reviewed_by  = NULL,
         reviewed_at  = NULL,
         reviewer_note = NULL,
         updated_at   = NOW()
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- 3b. approve_community_join_request — elder-initiated
CREATE OR REPLACE FUNCTION public.approve_community_join_request(
  p_request_id UUID,
  p_note       TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_request     RECORD;
BEGIN
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_request
    FROM public.community_join_requests
   WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- Reviewer must be elder or owner of the community
  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships
     WHERE user_id      = v_reviewer_id
       AND community_id = v_request.community_id
       AND role         IN ('elder', 'owner')
       AND status       = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Insert membership. ON CONFLICT DO NOTHING for safety (shouldn't
  -- happen since we checked already_a_member on create, but a race
  -- with a manual insert is defensible).
  INSERT INTO public.community_memberships
    (user_id, community_id, status, joined_at)
  VALUES
    (v_request.user_id, v_request.community_id, 'active', NOW())
  ON CONFLICT (user_id, community_id) DO NOTHING;

  -- Flip request state
  UPDATE public.community_join_requests
     SET status        = 'approved',
         reviewed_by   = v_reviewer_id,
         reviewed_at   = NOW(),
         reviewer_note = p_note,
         updated_at    = NOW()
   WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

-- 3c. reject_community_join_request — elder-initiated
CREATE OR REPLACE FUNCTION public.reject_community_join_request(
  p_request_id UUID,
  p_note       TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_reviewer_id UUID := auth.uid();
  v_request     RECORD;
BEGIN
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_request
    FROM public.community_join_requests
   WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_memberships
     WHERE user_id      = v_reviewer_id
       AND community_id = v_request.community_id
       AND role         IN ('elder', 'owner')
       AND status       = 'active'
  ) THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  UPDATE public.community_join_requests
     SET status        = 'rejected',
         reviewed_by   = v_reviewer_id,
         reviewed_at   = NOW(),
         reviewer_note = p_note,
         updated_at    = NOW()
   WHERE id = p_request_id;

  RETURN TRUE;
END;
$$;

-- Lock down execution surface
REVOKE ALL ON FUNCTION public.request_to_join_community(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_community_join_request(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_community_join_request(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_to_join_community(UUID, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_community_join_request(UUID, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_community_join_request(UUID, TEXT)      TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '345',
  'community_join_requests',
  ARRAY['-- 345: community_join_requests table + RLS + request_to_join_community / approve_community_join_request / reject_community_join_request RPCs']
)
ON CONFLICT (version) DO NOTHING;
