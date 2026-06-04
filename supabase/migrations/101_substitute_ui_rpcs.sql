-- ════════════════════════════════════════════════════════════════════════════
-- Migration 101: Substitute Member — UI-facing RPCs
-- Phase D3.3 of feat(substitute).
-- ════════════════════════════════════════════════════════════════════════════
-- User-callable RPCs that the rewritten LeaveCircleScreen and the new
-- SubstitutePoolScreen call directly (replacing engine TS calls that hit
-- column bugs against prod schema, see migration 099 header).
--
-- 5 functions:
--   * evaluate_exit_for_member(p_circle_id UUID)
--       Read-only impact preview for the leave screen. Returns cycles
--       completed, totals, payout-already-received, XnScore delta, and
--       the 80/10/10 split if applicable. Uses auth.uid() so the caller
--       can only evaluate their own circle membership.
--
--   * submit_exit_request(p_circle_id UUID, p_reason TEXT,
--                         p_acknowledged_impact BOOLEAN)
--       Computes evaluation + inserts into circle_exit_requests. The
--       auto-match trigger from migration 099 fires immediately and
--       cascades to substitute matching. Returns {request_id, evaluation,
--       trigger_fired:true}.
--
--   * respond_to_substitution(p_record_id UUID, p_response TEXT)
--       Substitute accepts/declines an offer.
--         accept  → status='admin_pending', confirmed_at, admin_notified_at,
--                   admin notification queued
--         decline → status='declined_substitute', declined_at,
--                   decline counter incremented (suspend at 3 in 90d),
--                   process_substitute_match called with exclusion to
--                   try the next candidate
--
--   * admin_approve_substitution(p_record_id UUID)
--       Calls _execute_substitution_swap(record_id, false) — the full
--       7-step swap. Validates caller is admin/creator/elder of the circle.
--
--   * admin_decline_substitution(p_record_id UUID)
--       status='declined_admin', admin_declined_at, exit_request back to
--       'matching' with substitute_matched_id=NULL. Calls process_substitute_match
--       with exclusion so the same substitute isn't re-offered.
--
-- All 5 are SECURITY DEFINER with pinned search_path. GRANT EXECUTE to
-- authenticated (not service_role like D1/D2) since these are user-facing.
-- auth.uid() checks inside each function enforce per-user ownership.
-- ════════════════════════════════════════════════════════════════════════════


-- ── _build_exit_evaluation (private helper) ────────────────────────────────
-- Computes the impact preview as JSONB. Used by both evaluate_exit_for_member
-- (read-only preview) and submit_exit_request (which feeds the evaluation
-- into the insert).

CREATE OR REPLACE FUNCTION _build_exit_evaluation(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_membership RECORD;
  v_total_cycles INTEGER := 0;
  v_completed_cycles INTEGER := 0;
  v_completion_pct NUMERIC := 0;
  v_payout_already_received BOOLEAN := false;
  v_member_payout_cycle_id UUID;
  v_member_payout_cycle_amount NUMERIC := 0;
  v_original_payout_cents BIGINT := 0;
  v_substitute_share_cents BIGINT := 0;
  v_insurance_share_cents BIGINT := 0;
  v_member_settlement_cents BIGINT := 0;
  v_payout_entitlement_status TEXT := 'not_applicable';
  v_notice_days INTEGER := 7;  -- engine hardcodes 7d; future: compute from cycle dates
  v_xnscore_impact TEXT := 'none';
  v_xnscore_adjustment INTEGER := 0;
BEGIN
  SELECT id, position INTO v_membership
  FROM circle_members
  WHERE user_id = p_user_id
    AND circle_id = p_circle_id
    AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'not an active member of this circle',
      'source', '_build_exit_evaluation'
    );
  END IF;

  -- Cycles using cycle_status (NOT status — column rename from engine)
  SELECT COUNT(*) INTO v_total_cycles
  FROM circle_cycles
  WHERE circle_id = p_circle_id;

  SELECT COUNT(*) INTO v_completed_cycles
  FROM circle_cycles
  WHERE circle_id = p_circle_id
    AND cycle_status IN ('closed', 'payout_pending');

  IF v_total_cycles > 0 THEN
    v_completion_pct := (v_completed_cycles::NUMERIC / v_total_cycles) * 100;
  END IF;

  -- Has the member already received their payout?
  SELECT id, expected_amount
    INTO v_member_payout_cycle_id, v_member_payout_cycle_amount
  FROM circle_cycles
  WHERE circle_id = p_circle_id
    AND recipient_user_id = p_user_id
  LIMIT 1;

  IF v_member_payout_cycle_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM circle_cycles
      WHERE id = v_member_payout_cycle_id AND cycle_status = 'closed'
    ) INTO v_payout_already_received;
  END IF;

  -- 80/10/10 split when payout pending
  IF NOT v_payout_already_received AND v_member_payout_cycle_id IS NOT NULL THEN
    v_original_payout_cents := ROUND(COALESCE(v_member_payout_cycle_amount, 0) * 100)::BIGINT;
    v_substitute_share_cents := ROUND(v_original_payout_cents * 0.80)::BIGINT;
    v_insurance_share_cents := ROUND(v_original_payout_cents * 0.10)::BIGINT;
    v_member_settlement_cents := v_original_payout_cents - v_substitute_share_cents - v_insurance_share_cents;
    v_payout_entitlement_status := 'pending_transfer';
  END IF;

  -- XnScore impact (TS engine D1 logic, line ~407)
  IF v_completion_pct >= 50 AND v_notice_days >= 7 THEN
    v_xnscore_impact := 'none';
    v_xnscore_adjustment := 0;
  ELSIF v_completion_pct >= 25 THEN
    v_xnscore_impact := 'partial';
    v_xnscore_adjustment := -5;
  ELSE
    v_xnscore_impact := 'partial';
    v_xnscore_adjustment := -10;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'notice_days', v_notice_days,
    'cycles_completed', v_completed_cycles,
    'total_cycles', v_total_cycles,
    'completion_percentage', ROUND(v_completion_pct, 2),
    'payout_already_received', v_payout_already_received,
    'payout_entitlement_status', v_payout_entitlement_status,
    'original_payout_amount_cents', v_original_payout_cents,
    'substitute_share_cents', v_substitute_share_cents,
    'insurance_pool_share_cents', v_insurance_share_cents,
    'original_member_settlement_cents', v_member_settlement_cents,
    'xnscore_impact', v_xnscore_impact,
    'xnscore_adjustment', v_xnscore_adjustment,
    'position', v_membership.position
  );
END;
$$;


-- ── evaluate_exit_for_member (read-only preview) ───────────────────────────

CREATE OR REPLACE FUNCTION evaluate_exit_for_member(p_circle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  RETURN _build_exit_evaluation(v_user_id, p_circle_id);
END;
$$;


-- ── submit_exit_request ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION submit_exit_request(
  p_circle_id UUID,
  p_reason TEXT,
  p_acknowledged_impact BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_eval JSONB;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  IF NOT p_acknowledged_impact THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'must acknowledge exit impact before submitting'
    );
  END IF;

  IF p_reason NOT IN ('financial_hardship', 'relocation', 'life_change', 'other') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'invalid reason; must be one of financial_hardship, relocation, life_change, other'
    );
  END IF;

  -- Block duplicate active exit_requests
  SELECT id INTO v_existing_id
  FROM circle_exit_requests
  WHERE member_id = v_user_id
    AND circle_id = p_circle_id
    AND status IN ('pending', 'approved', 'matching', 'matched', 'substituted')
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'an active exit request already exists for this circle',
      'existing_request_id', v_existing_id
    );
  END IF;

  v_eval := _build_exit_evaluation(v_user_id, p_circle_id);
  IF (v_eval->>'success')::BOOLEAN = false THEN
    RETURN v_eval;
  END IF;

  -- Insert — trigger auto_match_on_exit_submit (migration 099) fires the
  -- match cascade. The trigger flips status to 'matching' and runs
  -- process_substitute_match.
  INSERT INTO circle_exit_requests (
    member_id, circle_id, reason_category, reason_details, exit_date_requested,
    notice_days, cycles_completed, total_cycles,
    payout_entitlement_status, original_payout_amount_cents,
    substitute_share_cents, insurance_pool_share_cents,
    original_member_settlement_cents,
    xnscore_impact, xnscore_adjustment,
    status
  ) VALUES (
    v_user_id, p_circle_id, p_reason, NULL, CURRENT_DATE,
    (v_eval->>'notice_days')::INTEGER,
    (v_eval->>'cycles_completed')::INTEGER,
    (v_eval->>'total_cycles')::INTEGER,
    v_eval->>'payout_entitlement_status',
    (v_eval->>'original_payout_amount_cents')::BIGINT,
    (v_eval->>'substitute_share_cents')::BIGINT,
    (v_eval->>'insurance_pool_share_cents')::BIGINT,
    (v_eval->>'original_member_settlement_cents')::BIGINT,
    v_eval->>'xnscore_impact',
    (v_eval->>'xnscore_adjustment')::INTEGER,
    'pending'  -- triggers auto-match
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_new_id,
    'evaluation', v_eval,
    'note', 'auto-match trigger fired; check substitution_records for offer.'
  );
END;
$$;


-- ── respond_to_substitution ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION respond_to_substitution(
  p_record_id UUID,
  p_response TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_admin_id UUID;
  v_match_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  IF p_response NOT IN ('accept', 'decline') THEN
    RETURN jsonb_build_object('success', false, 'error', 'response must be accept or decline');
  END IF;

  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'substitution_record not found');
  END IF;

  IF v_record.substitute_member_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'only the matched substitute can respond');
  END IF;

  IF v_record.status <> 'pending_confirmation' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'record not in pending_confirmation state',
      'current_status', v_record.status
    );
  END IF;

  IF v_record.confirmation_deadline < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'confirmation deadline has passed');
  END IF;

  IF p_response = 'accept' THEN
    UPDATE substitution_records
    SET status = 'admin_pending',
        confirmed_at = NOW(),
        admin_notified_at = NOW()
    WHERE id = p_record_id;

    -- Notify circle admin (mirrors I1 _notifyCircleAdmin 'substitution_approval')
    SELECT user_id INTO v_admin_id
    FROM circle_members
    WHERE circle_id = v_record.circle_id
      AND role IN ('admin', 'creator')
    ORDER BY (role = 'creator') DESC
    LIMIT 1;

    IF v_admin_id IS NOT NULL THEN
      INSERT INTO notification_queue (member_id, notification_type, title, body, data)
      VALUES (
        v_admin_id, 'circle_events',
        'A substitute member is ready — your approval is needed',
        'A verified substitute has confirmed availability. You have 24 hours to approve or decline. No response will auto-approve.',
        jsonb_build_object(
          'substitutionRecordId', p_record_id,
          'substituteMemberId', v_user_id,
          'circleId', v_record.circle_id,
          'eventType', 'substitution_approval'
        )
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'response', 'accept',
      'new_status', 'admin_pending'
    );
  END IF;

  -- p_response = 'decline'
  UPDATE substitution_records
  SET status = 'declined_substitute', declined_at = NOW()
  WHERE id = p_record_id;

  -- Track decline (TS G1)
  UPDATE substitute_pool
  SET decline_count_90d = decline_count_90d + 1,
      last_decline_at = NOW(),
      status = CASE WHEN decline_count_90d + 1 >= 3 THEN 'suspended' ELSE status END,
      suspended_at = CASE WHEN decline_count_90d + 1 >= 3 THEN NOW() ELSE suspended_at END
  WHERE member_id = v_user_id;

  -- Flip exit_request back to 'matching' and try next candidate
  UPDATE circle_exit_requests
  SET status = 'matching', substitute_matched_id = NULL
  WHERE id = v_record.exit_request_id;

  v_match_result := process_substitute_match(v_record.exit_request_id, v_user_id);

  IF (v_match_result->>'matched')::BOOLEAN = false THEN
    UPDATE circle_exit_requests
    SET status = 'expired', payout_entitlement_status = 'forfeited'
    WHERE id = v_record.exit_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'response', 'decline',
    'new_status', 'declined_substitute',
    'next_match_result', v_match_result
  );
END;
$$;


-- ── admin_approve_substitution ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_approve_substitution(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_is_admin BOOLEAN;
  v_swap_error TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'substitution_record not found');
  END IF;

  -- Validate caller is admin/creator/elder of the circle (mirrors RLS pattern)
  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = v_record.circle_id
      AND user_id = v_user_id
      AND role IN ('admin', 'creator', 'treasurer')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'caller is not an admin of this circle');
  END IF;

  IF v_record.status NOT IN ('admin_pending', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'record not in admin_pending or confirmed state',
      'current_status', v_record.status
    );
  END IF;

  v_swap_error := _execute_substitution_swap(p_record_id, false);

  IF v_swap_error IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_swap_error);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', p_record_id,
    'note', 'swap completed; circle_members updated, exit_request completed.'
  );
END;
$$;


-- ── admin_decline_substitution ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_decline_substitution(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_is_admin BOOLEAN;
  v_match_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'substitution_record not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = v_record.circle_id
      AND user_id = v_user_id
      AND role IN ('admin', 'creator', 'treasurer')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'caller is not an admin of this circle');
  END IF;

  IF v_record.status <> 'admin_pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'record not in admin_pending state',
      'current_status', v_record.status
    );
  END IF;

  UPDATE substitution_records
  SET status = 'declined_admin', admin_declined_at = NOW()
  WHERE id = p_record_id;

  -- Reset exit_request to matching and try next candidate, excluding the
  -- substitute the admin just rejected
  UPDATE circle_exit_requests
  SET status = 'matching', substitute_matched_id = NULL
  WHERE id = v_record.exit_request_id;

  v_match_result := process_substitute_match(
    v_record.exit_request_id,
    v_record.substitute_member_id
  );

  IF (v_match_result->>'matched')::BOOLEAN = false THEN
    UPDATE circle_exit_requests
    SET status = 'expired', payout_entitlement_status = 'forfeited'
    WHERE id = v_record.exit_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', p_record_id,
    'next_match_result', v_match_result
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
-- Different from D1/D2: these are user-facing, so grant to `authenticated`.
-- Each function enforces per-user ownership via auth.uid() checks.

GRANT EXECUTE ON FUNCTION public.evaluate_exit_for_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_exit_request(UUID, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_substitution(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_substitution(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decline_substitution(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.evaluate_exit_for_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_exit_request(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_substitution(UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_approve_substitution(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_decline_substitution(UUID) FROM PUBLIC, anon;

-- _build_exit_evaluation is private (only called by the two public RPCs above)
REVOKE EXECUTE ON FUNCTION public._build_exit_evaluation(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._build_exit_evaluation(UUID, UUID) TO service_role;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('101', 'substitute_ui_rpcs',
        ARRAY['-- 101: SubstituteMemberEngine D3 — user-facing UI RPCs'])
ON CONFLICT (version) DO NOTHING;
