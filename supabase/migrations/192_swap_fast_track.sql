-- ════════════════════════════════════════════════════════════════════════════
-- Migration 192: swap_fast_track
-- ════════════════════════════════════════════════════════════════════════════
-- Adds an opt-in "skip cooling-off" path to the position-swap flow. The
-- requester ticks a Switch in the request sheet (`fast_track: true`); the
-- request lands with `metadata.fast_track = true`. When the target accepts,
-- `respond_to_swap_request` reads the flag and sets `cooling_off_ends_at =
-- now()` — i.e., the 24-hour cooling-off window has effectively already
-- ended, so the requester can confirm immediately.
--
-- Why store on the request instead of as a per-acceptance flag:
--   The requester decides at submission whether they're willing to skip
--   the cooling-off — it's a property of the request, not of the target's
--   acceptance. The target sees the resulting "ready to confirm" chip flip
--   to green immediately on accept, which is the consent signal the user
--   spec called for ("both parties must agree").
--
-- Both functions are CREATE OR REPLACEd in place. Adding a default-valued
-- parameter to create_swap_request preserves the existing call sites
-- (positional `(p_circle_id, p_requester_id, p_target_id, p_reason)`
-- continues to compile because p_fast_track defaults to false).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_swap_request(
  p_circle_id UUID,
  p_requester_id UUID,
  p_target_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_fast_track BOOLEAN DEFAULT FALSE
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id UUID;
  v_config JSONB;
  v_circle RECORD;
  v_requester_position INTEGER;
  v_target_position INTEGER;
  v_requester_xn INTEGER;
  v_target_xn INTEGER;
  v_can_swap RECORD;
  v_expiry_hours INTEGER;
BEGIN
  SELECT position INTO v_requester_position
    FROM circle_members
   WHERE circle_id = p_circle_id AND user_id = p_requester_id AND status = 'active';

  SELECT position INTO v_target_position
    FROM circle_members
   WHERE circle_id = p_circle_id AND user_id = p_target_id AND status = 'active';

  IF v_requester_position IS NULL OR v_target_position IS NULL THEN
    RAISE EXCEPTION 'Could not find positions for members';
  END IF;

  SELECT * INTO v_can_swap FROM can_request_swap(
    p_circle_id, p_requester_id, p_target_id,
    v_requester_position, v_target_position
  );

  IF NOT v_can_swap.allowed THEN
    RAISE EXCEPTION '%', v_can_swap.reason;
  END IF;

  v_config := get_circle_swap_config(p_circle_id);
  SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
  v_expiry_hours := (v_config->>'request_expiry_hours')::INTEGER;

  SELECT COALESCE(xn_score, 50) INTO v_requester_xn FROM profiles WHERE id = p_requester_id;
  SELECT COALESCE(xn_score, 50) INTO v_target_xn FROM profiles WHERE id = p_target_id;

  INSERT INTO position_swap_requests (
    circle_id,
    requester_user_id, requester_position, requester_xn_score,
    target_user_id, target_position, target_xn_score,
    request_reason,
    swap_status,
    expires_at,
    cycle_number,
    metadata
  ) VALUES (
    p_circle_id,
    p_requester_id, v_requester_position, v_requester_xn,
    p_target_id, v_target_position, v_target_xn,
    p_reason,
    'pending_target',
    now() + (v_expiry_hours || ' hours')::INTERVAL,
    COALESCE(v_circle.current_cycle, 1),
    -- Persist the fast_track flag on the request itself so the
    -- accepting path can decide whether to honor the skip.
    CASE WHEN p_fast_track THEN jsonb_build_object('fast_track', true)
         ELSE '{}'::jsonb
    END
  ) RETURNING id INTO v_request_id;

  INSERT INTO position_swap_events (
    swap_request_id, event_type, actor_user_id, actor_role, event_details
  ) VALUES (
    v_request_id, 'request_created', p_requester_id, 'requester',
    format('Requested swap: Position %s -> Position %s%s',
      v_requester_position, v_target_position,
      CASE WHEN p_fast_track THEN ' (fast-track)' ELSE '' END
    )
  );

  RETURN v_request_id;
END;
$$;


-- ─── respond_to_swap_request — honors metadata.fast_track on accept ────────
-- When the target accepts a request that was submitted with fast_track,
-- cooling_off_ends_at is stamped at now() instead of now() + cooling_off_hours.
-- The downstream confirm_swap_request still runs its cooling-off check, but
-- the check passes immediately because the deadline is already in the past.
CREATE OR REPLACE FUNCTION public.respond_to_swap_request(
  p_request_id UUID,
  p_target_id UUID,
  p_accept BOOLEAN,
  p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request position_swap_requests%ROWTYPE;
  v_config JSONB;
  v_cooling_hours INTEGER;
  v_fast_track BOOLEAN;
  v_cooling_off_ends TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_request FROM position_swap_requests WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Swap request not found';
  END IF;

  IF v_request.target_user_id != p_target_id THEN
    RAISE EXCEPTION 'Only the target member can respond';
  END IF;

  IF v_request.swap_status != 'pending_target' THEN
    RAISE EXCEPTION 'Request is not pending target response';
  END IF;

  IF v_request.expires_at < now() THEN
    UPDATE position_swap_requests SET swap_status = 'expired', updated_at = now() WHERE id = p_request_id;
    INSERT INTO position_swap_events (swap_request_id, event_type, actor_role, event_details)
    VALUES (p_request_id, 'swap_expired', 'system', 'Request expired before target responded');
    RAISE EXCEPTION 'Request has expired';
  END IF;

  IF p_accept THEN
    v_config := get_circle_swap_config(v_request.circle_id);
    v_cooling_hours := (v_config->>'cooling_off_hours')::INTEGER;
    v_fast_track := COALESCE((v_request.metadata->>'fast_track')::BOOLEAN, FALSE);

    -- Fast-track requests skip the cooling-off window — set ends_at = now()
    -- so the confirm flow's check (cooling_off_ends_at > now()) passes
    -- immediately. We keep the column populated (not NULL) so existing
    -- queries that filter on it continue to work consistently.
    v_cooling_off_ends := CASE
      WHEN v_fast_track THEN now()
      ELSE now() + (v_cooling_hours || ' hours')::INTERVAL
    END;

    UPDATE position_swap_requests SET
      swap_status = 'pending_confirmation',
      target_accepted_at = now(),
      target_response_reason = p_reason,
      cooling_off_ends_at = v_cooling_off_ends,
      updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO position_swap_events (
      swap_request_id, event_type, actor_user_id, actor_role, event_details
    ) VALUES (
      p_request_id, 'target_accepted', p_target_id, 'target',
      COALESCE(p_reason, 'Accepted swap request') ||
        CASE WHEN v_fast_track THEN ' (fast-track honored)' ELSE '' END
    );
  ELSE
    UPDATE position_swap_requests SET
      swap_status = 'rejected',
      target_response_reason = p_reason,
      updated_at = now()
    WHERE id = p_request_id;

    INSERT INTO position_swap_events (
      swap_request_id, event_type, actor_user_id, actor_role, event_details
    ) VALUES (
      p_request_id, 'target_rejected', p_target_id, 'target',
      COALESCE(p_reason, 'Declined swap request')
    );
  END IF;

  RETURN true;
END;
$$;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '192',
  'swap_fast_track',
  ARRAY['-- 192: swap_fast_track']
)
ON CONFLICT (version) DO NOTHING;
