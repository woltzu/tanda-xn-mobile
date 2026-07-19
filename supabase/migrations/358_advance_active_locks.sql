-- ═══════════════════════════════════════════════════════════════════════════
-- 358_advance_active_locks.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 36 Phase 1 — repayment infrastructure, part 4 of 4.
--
-- Anti-gaming RPCs. When a member has an active advance, two settings
-- that would otherwise change the auto-deduct math must be locked:
--
--   1. `update_contribution_amount(p_circle_id, p_new_amount_cents,
--      p_user_id)` — changing a member's per-cycle contribution amount
--      would alter the expected payout size, which the loan's
--      target_cycle_id was pegged against at request time.
--   2. `update_payout_routing(p_destination, p_user_id)` — flipping the
--      payout destination away from the internal wallet would bypass
--      the auto-deduct entirely.
--
-- Both RPCs enforce the gate first and delegate to the actual UPDATE
-- only when no active advance exists. All exceptions use the
-- 'blocked:active_advance_exists' prefix so callers can pattern-match
-- one string across both RPCs.
--
-- Data model notes for reviewers:
--
--   * update_contribution_amount targets `contribution_reservations`
--     (mig 015) — the per-cycle amount a member has committed to
--     contribute. `circle_members` has no per-member contribution
--     column (verified 2026-07-18); the circle-wide amount lives in
--     `circles.amount` and cannot be changed by a member. If TandaXn
--     later adds a per-member override column on `circle_members`,
--     this RPC's UPDATE target should be revisited.
--   * update_payout_routing targets `user_wallets.default_payout_destination`
--     (mig 015) — a TEXT column with in-code values 'wallet' / 'bank' /
--     'ask_each_time'. No CHECK exists, so the RPC validates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. update_contribution_amount ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_contribution_amount(
  p_circle_id       UUID,
  p_new_amount_cents BIGINT,
  p_user_id         UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_active_count  INT;
  v_updated_count INT;
  v_is_member     BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'circle_id_required';
  END IF;
  IF p_new_amount_cents IS NULL OR p_new_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  -- Membership check — caller must actually be a member of this circle.
  SELECT EXISTS (
    SELECT 1 FROM public.circle_members
    WHERE circle_id = p_circle_id
      AND user_id   = v_user_id
      AND status    = 'active'
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RAISE EXCEPTION 'not_circle_member';
  END IF;

  -- Anti-gaming gate.
  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status  = 'active'::loan_status;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'blocked:active_advance_exists';
  END IF;

  -- Apply the change to future reservations only. Rows whose
  -- reservation_status is already 'consumed'/'released' are historical
  -- and don't move.
  UPDATE public.contribution_reservations
     SET amount_cents = p_new_amount_cents,
         reserved_at  = COALESCE(reserved_at, NOW())
   WHERE user_id  = v_user_id
     AND circle_id = p_circle_id
     AND reservation_status = 'reserved';
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'user_id',           v_user_id,
    'circle_id',         p_circle_id,
    'new_amount_cents',  p_new_amount_cents,
    'reservations_updated', v_updated_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_contribution_amount(UUID, BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_contribution_amount(UUID, BIGINT, UUID) TO authenticated;

-- ─── 2. update_payout_routing ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_payout_routing(
  p_destination TEXT,
  p_user_id     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id       UUID;
  v_active_count  INT;
  v_wallet_exists BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_destination NOT IN ('wallet', 'bank', 'ask_each_time') THEN
    RAISE EXCEPTION 'invalid_destination:%', p_destination;
  END IF;

  -- Anti-gaming gate.
  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status  = 'active'::loan_status;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'blocked:active_advance_exists';
  END IF;

  -- Auto-provision the wallet if the caller doesn't have one yet, so
  -- the UPDATE is guaranteed to hit a row. Matches the same-flavor
  -- provisioning in execute_cycle_payout.
  SELECT EXISTS (SELECT 1 FROM public.user_wallets WHERE user_id = v_user_id)
    INTO v_wallet_exists;
  IF NOT v_wallet_exists THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_user_id, 0);
  END IF;

  UPDATE public.user_wallets
     SET default_payout_destination = p_destination,
         updated_at = NOW()
   WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'user_id',     v_user_id,
    'destination', p_destination
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_payout_routing(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_payout_routing(TEXT, UUID) TO authenticated;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '358',
  'advance_active_locks',
  ARRAY['-- 358: update_contribution_amount + update_payout_routing with active-advance gates']
)
ON CONFLICT (version) DO NOTHING;
