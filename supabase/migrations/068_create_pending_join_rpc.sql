-- ============================================================================
-- 068: create_pending_join RPC (SECURITY DEFINER)
--
-- Runs the pending_joins insert with elevated privileges so it doesn't care
-- what auth state the caller happens to have. Fixes the 401 bug where a
-- stale/expired Authorization: Bearer <user-jwt> on the browser client
-- caused PostgREST to reject the anon-role INSERT even with a valid apikey.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_pending_join(
  p_email TEXT,
  p_invite_code TEXT,
  p_payment_method TEXT,
  p_payment_details_encrypted TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_circle_id UUID;
  v_pending_id UUID;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  IF p_invite_code IS NULL OR p_invite_code = '' THEN
    RAISE EXCEPTION 'invite_code is required';
  END IF;

  -- Look up the circle that owns this invite code
  SELECT id INTO v_circle_id
  FROM circles
  WHERE invite_code = p_invite_code;

  IF v_circle_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code: %', p_invite_code;
  END IF;

  -- Insert pending join
  INSERT INTO pending_joins (
    email, invite_code, circle_id, payment_method,
    payment_details_encrypted, consented_to_rules
  )
  VALUES (
    LOWER(TRIM(p_email)),
    p_invite_code,
    v_circle_id,
    COALESCE(p_payment_method, 'debit_card'),
    p_payment_details_encrypted,
    true
  )
  RETURNING id INTO v_pending_id;

  RETURN v_pending_id;
END;
$$;

-- Allow anyone (anon and authenticated) to call this function
GRANT EXECUTE ON FUNCTION public.create_pending_join(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Verify (should return one row with security_type = 'DEFINER')
-- SELECT routine_name, security_type FROM information_schema.routines WHERE routine_name = 'create_pending_join';
