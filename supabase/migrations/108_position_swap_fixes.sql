-- ════════════════════════════════════════════════════════════════════════════
-- Migration 108: Position Swap — runtime fix
-- D2 of feat(position-swap) #18.
-- ════════════════════════════════════════════════════════════════════════════
-- Surfaced during D2 SQL smoke test of the existing 14 swap RPCs (migration
-- 018):
--
--   confirm_swap_request crashed at runtime with:
--     ERROR 42804: column "swap_status" is of type swap_request_status but
--     expression is of type text
--
--   The CASE expression returns plain TEXT and Postgres can't auto-cast it
--   to the swap_request_status ENUM (unlike a bare string literal in an
--   UPDATE SET, where the column type is known to the planner). The other
--   13 swap RPCs use bare literals (or one branch each), so only this one
--   surfaced the bug. Every confirm-from-requester would have failed in
--   prod — fortunately position_swap_requests has 0 rows, so no user has
--   yet hit it.
--
-- Fix: cast the CASE result to swap_request_status explicitly.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.confirm_swap_request(
  p_request_id UUID,
  p_requester_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_request position_swap_requests%ROWTYPE;
  v_config JSONB;
  v_requires_elder BOOLEAN;
BEGIN
  SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap request not found';
  END IF;

  IF v_request.requester_user_id != p_requester_id THEN
    RAISE EXCEPTION 'Only the requester can confirm';
  END IF;

  IF v_request.swap_status != 'pending_confirmation' THEN
    RAISE EXCEPTION 'Request is not pending confirmation';
  END IF;

  IF v_request.cooling_off_ends_at IS NOT NULL
     AND v_request.cooling_off_ends_at > now() THEN
    RAISE EXCEPTION 'Cooling off period has not ended yet. Please wait until %',
      v_request.cooling_off_ends_at;
  END IF;

  IF v_request.expires_at < now() THEN
    UPDATE position_swap_requests
    SET swap_status = 'expired', updated_at = now()
    WHERE id = p_request_id;
    INSERT INTO position_swap_events (swap_request_id, event_type, actor_role, event_details)
    VALUES (p_request_id, 'swap_expired', 'system', 'Request expired before requester confirmed');
    RAISE EXCEPTION 'Request has expired';
  END IF;

  v_config := get_circle_swap_config(v_request.circle_id);
  v_requires_elder := (v_config->>'require_elder_approval')::BOOLEAN;

  -- FIX (D2): cast the CASE result to swap_request_status. Without the
  -- cast, the expression evaluates to TEXT and Postgres rejects the
  -- assignment to the ENUM column with 42804.
  UPDATE position_swap_requests SET
    requester_confirmed_at = now(),
    requester_confirmation_reason = p_reason,
    swap_status = (
      CASE WHEN v_requires_elder THEN 'pending_elder_approval'
           ELSE 'approved'
      END
    )::swap_request_status,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO position_swap_events (
    swap_request_id, event_type, actor_user_id, actor_role, event_details
  ) VALUES (
    p_request_id, 'requester_confirmed', p_requester_id, 'requester',
    COALESCE(p_reason, 'Confirmed swap request')
  );

  IF NOT v_requires_elder THEN
    PERFORM execute_position_swap(p_request_id);
  END IF;

  RETURN true;
END;
$function$;


-- ── execute_position_swap — remove writes to nonexistent updated_at ────────
-- Second bug surfaced after the cast fix above: the function UPDATEs
-- circle_members.updated_at, but circle_members has no such column. The
-- two UPDATEs that perform the actual position swap both fail with
-- 42703 column does not exist. This would block every actual swap from
-- completing — silently waiting until a real user tried it.

CREATE OR REPLACE FUNCTION public.execute_position_swap(p_request_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_request position_swap_requests%ROWTYPE;
  v_requester_generous BOOLEAN;
  v_target_generous BOOLEAN;
  v_requester_xn_change INTEGER := 2;
  v_target_xn_change INTEGER := 2;
BEGIN
  SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap request not found';
  END IF;

  IF v_request.swap_status != 'approved' THEN
    RAISE EXCEPTION 'Swap must be approved before execution';
  END IF;

  UPDATE position_swap_requests
  SET swap_status = 'executing', updated_at = now()
  WHERE id = p_request_id;

  -- FIX (D2): circle_members has no updated_at column — drop it from the
  -- swap UPDATEs. Only `position` changes on the swap.
  UPDATE circle_members
  SET position = v_request.target_position
  WHERE circle_id = v_request.circle_id
    AND user_id = v_request.requester_user_id;

  UPDATE circle_members
  SET position = v_request.requester_position
  WHERE circle_id = v_request.circle_id
    AND user_id = v_request.target_user_id;

  v_requester_generous := v_request.requester_position < v_request.target_position;
  v_target_generous := v_request.target_position < v_request.requester_position;

  IF v_requester_generous THEN
    v_requester_xn_change := v_requester_xn_change + 5;
  END IF;
  IF v_target_generous THEN
    v_target_xn_change := v_target_xn_change + 5;
  END IF;

  UPDATE profiles
  SET xn_score = LEAST(100, xn_score + v_requester_xn_change)
  WHERE id = v_request.requester_user_id;
  UPDATE profiles
  SET xn_score = LEAST(100, xn_score + v_target_xn_change)
  WHERE id = v_request.target_user_id;

  INSERT INTO member_swap_history (
    user_id, circle_id, swap_request_id, swap_role,
    old_position, new_position, swap_partner_id,
    was_generous, xn_score_impact, cycle_number
  ) VALUES (
    v_request.requester_user_id, v_request.circle_id, p_request_id, 'requester',
    v_request.requester_position, v_request.target_position, v_request.target_user_id,
    v_requester_generous, v_requester_xn_change, v_request.cycle_number
  );

  INSERT INTO member_swap_history (
    user_id, circle_id, swap_request_id, swap_role,
    old_position, new_position, swap_partner_id,
    was_generous, xn_score_impact, cycle_number
  ) VALUES (
    v_request.target_user_id, v_request.circle_id, p_request_id, 'target',
    v_request.target_position, v_request.requester_position, v_request.requester_user_id,
    v_target_generous, v_target_xn_change, v_request.cycle_number
  );

  UPDATE position_swap_requests SET
    swap_status = 'completed',
    executed_at = now(),
    executed_by_system = true,
    updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO position_swap_events (
    swap_request_id, event_type, actor_role, event_details
  ) VALUES (
    p_request_id, 'swap_executed', 'system',
    format('Positions swapped: %s <-> %s', v_request.requester_position, v_request.target_position)
  );

  RETURN true;
END;
$function$;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('108', 'position_swap_fixes',
        ARRAY['-- 108: PositionSwap D2 — confirm_swap_request ENUM cast + execute_position_swap circle_members.updated_at fix'])
ON CONFLICT (version) DO NOTHING;
