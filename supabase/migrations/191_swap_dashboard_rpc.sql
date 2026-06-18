-- ════════════════════════════════════════════════════════════════════════════
-- Migration 191: swap_dashboard_rpc
-- ════════════════════════════════════════════════════════════════════════════
-- `get_position_swap_dashboard(p_circle_id, p_user_id) RETURNS JSONB`
-- bundles five separate queries the PositionSwap screen used to fire
-- individually into a single round-trip. Mirrors the aggregate pattern of
-- get_dashboard_data / get_circle_join_payload. Client-side, the hook
-- wraps this with a 30s module-level cache (see hooks/usePositionSwapDashboard.ts)
-- to absorb the focus/blur churn from tab switches and back-navigation.
--
-- Output shape (JSONB):
--   {
--     "myPosition": INT | NULL,
--     "members": [{
--       "user_id", "full_name", "position", "xn_score",
--       "payout_date", "is_current_user", "can_swap_with", "swap_reason"
--     }],
--     "myRequests":      [PositionSwapRequest-shaped rows],
--     "pendingRequests": [PendingSwapRequest-shaped rows],
--     "history":         [MemberSwapHistory-shaped rows]
--   }
--
-- SECURITY DEFINER so the function can read circle_members + profiles +
-- position_swap_requests without the caller having direct RLS rights.
-- Authorization is enforced by the function itself — p_user_id must be
-- a member of p_circle_id, otherwise it returns NULL.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_position_swap_dashboard(
  p_circle_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_my_position INT;
  v_members JSONB;
  v_my_requests JSONB;
  v_pending_requests JSONB;
  v_history JSONB;
  v_is_member BOOLEAN;
BEGIN
  -- Authorization: caller must be a member of this circle. The PostgREST
  -- session user (auth.uid) is the SECURITY-INVOKER caller; we use the
  -- explicit p_user_id so the SQL EXPLAIN plan can prune.
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
     WHERE circle_id = p_circle_id
       AND user_id = p_user_id
       AND status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object(
      'myPosition', NULL,
      'members', '[]'::jsonb,
      'myRequests', '[]'::jsonb,
      'pendingRequests', '[]'::jsonb,
      'history', '[]'::jsonb
    );
  END IF;

  -- ─── My position ──────────────────────────────────────────────────────
  SELECT position INTO v_my_position
    FROM public.circle_members
   WHERE circle_id = p_circle_id
     AND user_id = p_user_id
     AND status = 'active';

  -- ─── Members ──────────────────────────────────────────────────────────
  -- Per-row eligibility is computed via can_request_swap(). The function
  -- already gates on circle status, swaps_enabled, blackout cycles, swap
  -- caps, and XnScore for early positions — exactly what the screen
  -- needs to render lock-icons vs swap-pills correctly.
  --
  -- payout_date is sourced from circle_cycles.expected_payout_date for
  -- the row where recipient_user_id matches. If the circle hasn't yet
  -- generated cycles (or this member's position isn't scheduled yet),
  -- the value is NULL — the client renders "TBD" in that case.
  WITH member_rows AS (
    SELECT
      cm.user_id,
      cm.position,
      p.full_name,
      p.xn_score,
      (
        SELECT cc.expected_payout_date
          FROM public.circle_cycles cc
         WHERE cc.circle_id = p_circle_id
           AND cc.recipient_user_id = cm.user_id
         ORDER BY cc.cycle_number ASC
         LIMIT 1
      ) AS payout_date
      FROM public.circle_members cm
      JOIN public.profiles p ON p.id = cm.user_id
     WHERE cm.circle_id = p_circle_id
       AND cm.status = 'active'
  ),
  member_eligibility AS (
    SELECT
      mr.*,
      (mr.user_id = p_user_id) AS is_current_user,
      CASE
        WHEN mr.user_id = p_user_id THEN FALSE
        ELSE COALESCE(
          (SELECT allowed FROM public.can_request_swap(
            p_circle_id, p_user_id, mr.user_id, v_my_position, mr.position
          ) LIMIT 1),
          FALSE
        )
      END AS can_swap_with,
      CASE
        WHEN mr.user_id = p_user_id THEN NULL
        ELSE (SELECT reason FROM public.can_request_swap(
          p_circle_id, p_user_id, mr.user_id, v_my_position, mr.position
        ) LIMIT 1)
      END AS swap_reason
    FROM member_rows mr
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'full_name', full_name,
      'position', position,
      'xn_score', xn_score,
      'payout_date', payout_date,
      'is_current_user', is_current_user,
      'can_swap_with', can_swap_with,
      'swap_reason', swap_reason
    )
    ORDER BY position ASC
  ), '[]'::jsonb)
    INTO v_members
    FROM member_eligibility;

  -- ─── My requests (I initiated) ────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', psr.id,
      'circle_id', psr.circle_id,
      'requester_user_id', psr.requester_user_id,
      'requester_position', psr.requester_position,
      'target_user_id', psr.target_user_id,
      'target_position', psr.target_position,
      'target_name', tp.full_name,
      'swap_status', psr.swap_status,
      'request_reason', psr.request_reason,
      'expires_at', psr.expires_at,
      'cooling_off_ends_at', psr.cooling_off_ends_at,
      'target_accepted_at', psr.target_accepted_at,
      'metadata', psr.metadata,
      'created_at', psr.created_at,
      'updated_at', psr.updated_at
    )
    ORDER BY psr.created_at DESC
  ), '[]'::jsonb)
    INTO v_my_requests
    FROM public.position_swap_requests psr
    JOIN public.profiles tp ON tp.id = psr.target_user_id
   WHERE psr.requester_user_id = p_user_id
     AND psr.circle_id = p_circle_id
     -- Only surface non-terminal swaps in "my requests" — completed/
     -- rejected/cancelled rows belong to history. The screen filters on
     -- swap_status to bucket into action_needed vs awaiting_others.
     AND psr.swap_status IN (
       'pending_target', 'pending_confirmation', 'pending_elder_approval', 'approved'
     );

  -- ─── Pending requests (I'm the target) ────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', psr.id,
      'circle_id', psr.circle_id,
      'requester_user_id', psr.requester_user_id,
      'requester_position', psr.requester_position,
      'requester_name', rp.full_name,
      'target_position', psr.target_position,
      'request_reason', psr.request_reason,
      'expires_at', psr.expires_at,
      'created_at', psr.created_at
    )
    ORDER BY psr.created_at DESC
  ), '[]'::jsonb)
    INTO v_pending_requests
    FROM public.position_swap_requests psr
    JOIN public.profiles rp ON rp.id = psr.requester_user_id
   WHERE psr.target_user_id = p_user_id
     AND psr.circle_id = p_circle_id
     AND psr.swap_status = 'pending_target'
     AND psr.expires_at > now();

  -- ─── History (completed swaps I was part of) ──────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', msh.id,
      'circle_id', msh.circle_id,
      'swap_request_id', msh.swap_request_id,
      'swap_role', msh.swap_role,
      'old_position', msh.old_position,
      'new_position', msh.new_position,
      'swap_partner_id', msh.swap_partner_id,
      'partner_name', pp.full_name,
      'was_generous', msh.was_generous,
      'xn_score_impact', msh.xn_score_impact,
      'cycle_number', msh.cycle_number,
      'created_at', msh.created_at,
      -- Aliases the screen consumes — kept so the client doesn't have
      -- to know about the two naming conventions in member_swap_history
      -- vs the older legacy "from/to" fields some callers expect.
      'from_position', msh.old_position,
      'to_position', msh.new_position
    )
    ORDER BY msh.created_at DESC
  ), '[]'::jsonb)
    INTO v_history
    FROM public.member_swap_history msh
    JOIN public.profiles pp ON pp.id = msh.swap_partner_id
   WHERE msh.user_id = p_user_id
     AND msh.circle_id = p_circle_id;

  RETURN jsonb_build_object(
    'myPosition', v_my_position,
    'members', v_members,
    'myRequests', v_my_requests,
    'pendingRequests', v_pending_requests,
    'history', v_history
  );
END;
$$;

-- Allow authenticated callers to invoke. The function gates membership
-- itself, so we don't need to restrict EXECUTE further.
GRANT EXECUTE ON FUNCTION public.get_position_swap_dashboard(UUID, UUID)
  TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '191',
  'swap_dashboard_rpc',
  ARRAY['-- 191: swap_dashboard_rpc']
)
ON CONFLICT (version) DO NOTHING;
