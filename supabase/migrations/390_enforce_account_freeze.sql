-- ═══════════════════════════════════════════════════════════════════════════
-- 390_enforce_account_freeze.sql
--
-- Cross-flow enforcement of the account-freeze signal from mig 389.
-- profiles.account_frozen_at existed but nothing checked it. This
-- migration adds:
--
--   1. Helper is_account_frozen(uuid) — one place to check the state.
--   2. Freeze checks at the top of every money-moving RPC:
--        join_circle, complete_circle_join, process_send_money,
--        request_withdrawal, request_advance, check_advance_eligibility
--   3. execute_cycle_payout: on frozen recipient, INSERT a
--      circle_payouts row with status='held' + hold_reason=
--      'recipient_frozen'. Piggybacks on the existing hold mechanism
--      (mig 379 / Doc 39) so admins can resolve intentionally instead
--      of the cron retrying forever.
--   4. RLS on user_wallets.UPDATE: additionally require
--      NOT is_account_frozen(auth.uid()). Plugs the direct-wallet-update
--      bypass in useWallet.makeContribution / addFunds (which write
--      user_wallets directly without an RPC). Service-role paths keep
--      working — they bypass RLS.
--   5. admin_freeze_account / admin_unfreeze_account: fan out a
--      notification to the affected user with the reason.
--
-- Follow-ups deliberately NOT in this migration:
--   • Wallet-path contribution / addFunds RPC (correctness refactor).
--     RLS covers it defensively for now.
--   • Autopay EF-side skip: shipped in the same commit as this migration
--     via a stripe-webhook-adjacent EF edit.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Helper: is_account_frozen(user_id) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_account_frozen(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(account_frozen_at IS NOT NULL, FALSE)
  FROM public.profiles
  WHERE id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.is_account_frozen(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_account_frozen(UUID) TO authenticated, service_role;

-- ─── 2. join_circle: block frozen joiner ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_circle(p_circle_id uuid, p_invite_code text DEFAULT NULL::text, p_method text DEFAULT 'invite_code'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_joiner         UUID;
  v_circle         RECORD;
  v_existing       UUID;
  v_member_id      UUID;
  v_new_position   INT;
  v_user_xn_score  INT;
  v_display_name   TEXT;
  v_event_id       UUID;
  v_suspicious     BOOLEAN;
  v_gated          BOOLEAN;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF public.is_account_frozen(v_joiner) THEN
    RAISE EXCEPTION 'account_frozen' USING ERRCODE = '42501';
  END IF;

  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'invalid_circle_id';
  END IF;
  IF p_method NOT IN ('quick_join','invite_code','magic_link','admin_manual') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  SELECT id, name, status, member_count, current_members, min_score,
         invite_code, require_admin_approval_for_joins
    INTO v_circle
  FROM public.circles
  WHERE id = p_circle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'circle_not_joinable';
  END IF;

  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF upper(trim(p_invite_code)) <> v_circle.invite_code THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
  END IF;

  -- Idempotency: existing member â†’ return their row.
  SELECT id INTO v_existing
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = v_joiner;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',          true,
      'already_member',   true,
      'member_id',        v_existing,
      'member_position',  (SELECT cm.position FROM public.circle_members cm WHERE cm.id = v_existing),
      'approval_pending', false,
      'suspicious_flag',  false
    );
  END IF;

  IF v_circle.current_members >= v_circle.member_count THEN
    RAISE EXCEPTION 'circle_full';
  END IF;

  IF COALESCE(v_circle.min_score, 0) > 0 THEN
    SELECT COALESCE(xn_score, 0) INTO v_user_xn_score
    FROM public.profiles WHERE id = v_joiner;
    IF COALESCE(v_user_xn_score, 0) < v_circle.min_score THEN
      RAISE EXCEPTION 'min_score_not_met';
    END IF;
  END IF;

  -- Cluster check + gate check â€” both computed against the same lock window.
  v_suspicious := public._detect_join_cluster(p_circle_id);
  v_gated      := v_circle.require_admin_approval_for_joins;

  IF v_suspicious THEN
    UPDATE public.circles
       SET suspicious_join_count         = suspicious_join_count + 1,
           last_join_cluster_detected_at = NOW(),
           updated_at                    = NOW()
     WHERE id = p_circle_id;
  END IF;

  -- Gated path: write a pending log row, DO NOT insert circle_members.
  IF v_gated THEN
    INSERT INTO public.circle_membership_events (
      circle_id, user_id, event_type, method, status,
      suspicious_flag, suspicious_reason
    )
    VALUES (
      p_circle_id, v_joiner, 'join', p_method, 'pending_approval',
      v_suspicious, CASE WHEN v_suspicious THEN 'cluster:24h_50pct' ELSE NULL END
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
      'success',          true,
      'already_member',   false,
      'member_id',        NULL,
      'member_position',  NULL,
      'approval_pending', true,
      'event_id',         v_event_id,
      'suspicious_flag',  v_suspicious
    );
  END IF;

  -- Un-gated path: same shape as mig 141, plus the log row.
  v_new_position := v_circle.current_members + 1;
  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (p_circle_id, v_joiner, v_new_position, 'member', 'active', NOW())
  RETURNING id INTO v_member_id;

  UPDATE public.circles
     SET current_members = current_members + 1,
         updated_at      = NOW(),
         status = CASE
           WHEN current_members + 1 >= member_count THEN 'active'
           ELSE status
         END
   WHERE id = p_circle_id;

  INSERT INTO public.circle_membership_events (
    circle_id, user_id, event_type, method, status,
    suspicious_flag, suspicious_reason
  )
  VALUES (
    p_circle_id, v_joiner, 'join', p_method, 'active',
    v_suspicious, CASE WHEN v_suspicious THEN 'cluster:24h_50pct' ELSE NULL END
  )
  RETURNING id INTO v_event_id;

  BEGIN
    v_display_name := public.resolve_display_name(v_joiner);
    INSERT INTO public.circle_messages (circle_id, user_id, message_type, body)
    VALUES (
      p_circle_id, v_joiner, 'system',
      v_display_name || ' joined the circle'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[join_circle] system message insert failed circle=%, user=%, err=%',
      p_circle_id, v_joiner, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',          true,
    'already_member',   false,
    'member_id',        v_member_id,
    'member_position',  v_new_position,
    'approval_pending', false,
    'event_id',         v_event_id,
    'suspicious_flag',  v_suspicious
  );
END;
$function$;

-- ─── 3. complete_circle_join: block frozen joiner ────────────────────────

CREATE OR REPLACE FUNCTION public.complete_circle_join(p_pending_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  v_pending RECORD;

  v_user_id UUID;

  v_user_email TEXT;

  v_circle_name TEXT;

  v_circle_amount NUMERIC;

  v_amount_cents BIGINT;

  v_existing_member UUID;

  v_member_id UUID;

  v_user_display_name TEXT;

  v_email_local_part TEXT;

  v_amount_dollars TEXT;

BEGIN

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');

  END IF;
  IF public.is_account_frozen(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'account_frozen');
  END IF;




  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  IF v_user_email IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');

  END IF;



  SELECT * INTO v_pending FROM pending_joins WHERE id = p_pending_id;

  IF v_pending IS NULL THEN

    RETURN jsonb_build_object('success', false, 'error', 'pending_not_found');

  END IF;



  IF LOWER(v_pending.email) <> LOWER(v_user_email) THEN

    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch');

  END IF;



  -- Connect onboarding gate intentionally removed here (reverted from migration

  -- 069). Onboarding enforcement moves to the payout path (Stage 4) for

  -- just-in-time gating. See docs/audit/27_join_gate_revert_decision.md.



  SELECT name, amount INTO v_circle_name, v_circle_amount

  FROM circles WHERE id = v_pending.circle_id;



  v_amount_cents := (v_circle_amount * 100)::bigint;



  IF v_pending.status = 'completed' THEN

    RETURN jsonb_build_object(

      'success', true,

      'already_completed', true,

      'circle_name', v_circle_name,

      'amount', v_circle_amount

    );

  END IF;



  SELECT id INTO v_existing_member FROM circle_members

  WHERE circle_id = v_pending.circle_id AND user_id = v_user_id;



  IF v_existing_member IS NULL THEN

    INSERT INTO circle_members (circle_id, user_id, status, joined_at, role)

    VALUES (v_pending.circle_id, v_user_id, 'active', NOW(), 'member')

    RETURNING id INTO v_member_id;

  ELSE

    v_member_id := v_existing_member;

  END IF;



  INSERT INTO user_wallets (user_id, main_balance_cents, reserved_balance_cents, committed_balance_cents, wallet_status, created_at, updated_at)

  VALUES (v_user_id, 0, 0, 0, 'active', NOW(), NOW())

  ON CONFLICT (user_id) DO NOTHING;



  INSERT INTO circle_contributions (

    circle_id, user_id, member_id, cycle_number, amount, currency,

    due_date, paid_date, status, is_on_time, payment_method, created_at

  )

  VALUES (

    v_pending.circle_id, v_user_id, v_member_id, 1, v_circle_amount, 'USD',

    CURRENT_DATE, NOW(), 'paid', true, 'demo_quickjoin', NOW()

  );



  UPDATE user_wallets

  SET main_balance_cents = main_balance_cents + v_amount_cents,

      updated_at = NOW(),

      last_activity_at = NOW()

  WHERE user_id = v_user_id;



  UPDATE pending_joins

  SET status = 'completed', completed_at = NOW()

  WHERE id = p_pending_id;



  -- Phase 2: post system messages to circle chat (best-effort, non-blocking)

  BEGIN

    SELECT full_name INTO v_user_display_name

    FROM profiles WHERE id = v_user_id;



    IF v_user_display_name IS NULL OR TRIM(v_user_display_name) = '' THEN

      v_email_local_part := split_part(v_user_email, '@', 1);

      IF v_email_local_part IS NOT NULL AND v_email_local_part <> '' THEN

        v_user_display_name := v_email_local_part;

      ELSE

        v_user_display_name := 'A new member';

      END IF;

    END IF;



    IF v_circle_amount = v_circle_amount::int THEN

      v_amount_dollars := v_circle_amount::int::text;

    ELSE

      v_amount_dollars := trim(trailing '0' from v_circle_amount::text);

      v_amount_dollars := trim(trailing '.' from v_amount_dollars);

    END IF;



    INSERT INTO circle_messages (circle_id, user_id, message_type, body)

    VALUES (

      v_pending.circle_id,

      v_user_id,

      'system',

      v_user_display_name || ' joined the circle'

    );



    INSERT INTO circle_messages (circle_id, user_id, message_type, body)

    VALUES (

      v_pending.circle_id,

      v_user_id,

      'system',

      v_user_display_name || ' contributed $' || v_amount_dollars || ' for Cycle 1'

    );



  EXCEPTION WHEN OTHERS THEN

    RAISE WARNING 'Phase 2 system message insert failed for pending_id=%, user_id=%, circle_id=%, error=%',

      p_pending_id, v_user_id, v_pending.circle_id, SQLERRM;

  END;



  RETURN jsonb_build_object(

    'success', true,

    'circle_name', v_circle_name,

    'amount', v_circle_amount,

    'circle_id', v_pending.circle_id,

    'wallet_credited_cents', v_amount_cents

  );



EXCEPTION WHEN OTHERS THEN

  RETURN jsonb_build_object(

    'success', false,

    'error', 'exception',

    'message', SQLERRM

  );

END;

$function$;

-- ─── 4. process_send_money: block frozen sender ──────────────────────────

CREATE OR REPLACE FUNCTION public.process_send_money(p_amount_cents bigint, p_currency text, p_recipient_identifier text, p_method text, p_funding_source text, p_fee_cents bigint DEFAULT 0, p_stripe_intent_id text DEFAULT NULL::text)
 RETURNS TABLE(transfer_id uuid, new_balance_cents bigint, recipient_matched boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$

DECLARE

  v_sender_id      UUID;

  v_recipient_id   UUID;

  v_total_debit    BIGINT;

  v_balance_before BIGINT;

  v_balance_after  BIGINT;

  v_transfer_id    UUID;

  v_status         TEXT;

BEGIN

  -- ──────────────────────────────────────────────────────────────────────

  -- Auth + input validation

  -- ──────────────────────────────────────────────────────────────────────

  v_sender_id := auth.uid();

  IF v_sender_id IS NULL THEN

    RAISE EXCEPTION 'auth_required';

  END IF;
  IF public.is_account_frozen(v_sender_id) THEN
    RAISE EXCEPTION 'account_frozen' USING ERRCODE = '42501';
  END IF;




  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN

    RAISE EXCEPTION 'invalid_amount';

  END IF;

  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN

    RAISE EXCEPTION 'invalid_fee';

  END IF;

  IF p_recipient_identifier IS NULL OR length(trim(p_recipient_identifier)) = 0 THEN

    RAISE EXCEPTION 'missing_recipient';

  END IF;

  IF p_method NOT IN ('wallet','bank','mobile','cash') THEN

    RAISE EXCEPTION 'invalid_method';

  END IF;

  IF p_funding_source NOT IN ('wallet','stripe') THEN

    RAISE EXCEPTION 'invalid_funding_source';

  END IF;



  v_total_debit := p_amount_cents + p_fee_cents;



  -- ──────────────────────────────────────────────────────────────────────

  -- Resolve recipient on TandaXn (phone exact match). Best-effort —

  -- non-matches just leave recipient_user_id NULL and status 'pending'.

  -- ──────────────────────────────────────────────────────────────────────

  SELECT id INTO v_recipient_id

  FROM public.profiles

  WHERE phone = p_recipient_identifier

  LIMIT 1;



  -- ──────────────────────────────────────────────────────────────────────

  -- Debit (wallet-funded path) — locks the row for the duration of the

  -- transaction so a concurrent send/contribution can't oversell.

  -- ──────────────────────────────────────────────────────────────────────

  IF p_funding_source = 'wallet' THEN

    SELECT main_balance_cents INTO v_balance_before

    FROM public.user_wallets

    WHERE user_id = v_sender_id

    FOR UPDATE;



    IF v_balance_before IS NULL THEN

      RAISE EXCEPTION 'no_wallet';

    END IF;

    IF v_balance_before < v_total_debit THEN

      RAISE EXCEPTION 'insufficient_funds';

    END IF;



    UPDATE public.user_wallets

       SET main_balance_cents = main_balance_cents - v_total_debit,

           last_activity_at   = NOW(),

           updated_at         = NOW()

     WHERE user_id = v_sender_id;



    v_balance_after := v_balance_before - v_total_debit;

  ELSE

    -- Stripe-funded path: wallet balance is unchanged. We still read it

    -- so the caller gets a consistent post-send balance to display.

    SELECT main_balance_cents INTO v_balance_after

    FROM public.user_wallets

    WHERE user_id = v_sender_id;

    v_balance_after := COALESCE(v_balance_after, 0);

  END IF;



  -- ──────────────────────────────────────────────────────────────────────

  -- Status — wallet-to-wallet between two TandaXn users is settled

  -- immediately; everything else awaits an external rail confirmation.

  -- ──────────────────────────────────────────────────────────────────────

  IF p_method = 'wallet' AND v_recipient_id IS NOT NULL THEN

    v_status := 'completed';

  ELSE

    v_status := 'pending';

  END IF;



  -- ──────────────────────────────────────────────────────────────────────

  -- Record

  -- ──────────────────────────────────────────────────────────────────────

  INSERT INTO public.money_transfers (

    sender_user_id, recipient_user_id, recipient_external_identifier,

    amount_cents, currency, fee_cents, method, funding_source,

    stripe_payment_intent_id, status

  )

  VALUES (

    v_sender_id, v_recipient_id, p_recipient_identifier,

    p_amount_cents, p_currency, p_fee_cents, p_method, p_funding_source,

    p_stripe_intent_id, v_status

  )

  RETURNING id INTO v_transfer_id;



  RETURN QUERY

    SELECT v_transfer_id, v_balance_after, (v_recipient_id IS NOT NULL);

END;

$function$;

-- ─── 5. request_withdrawal: block frozen user ────────────────────────────

CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount_cents integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id                 UUID := auth.uid();
  v_available_balance_cents INTEGER;
  v_request_id              UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;
  IF public.is_account_frozen(v_user_id) THEN
    RAISE EXCEPTION 'account_frozen' USING ERRCODE = '42501';
  END IF;


  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT available_balance_cents INTO v_available_balance_cents
    FROM public.user_wallets
   WHERE user_id = v_user_id;

  IF v_available_balance_cents IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF p_amount_cents > v_available_balance_cents THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Insert into the existing legacy schema. destination_type = 'bank'
  -- marks this as a bank withdrawal (as opposed to internal reversals
  -- or other legacy destinations); the trigger from mig 257 reads
  -- destination_type = 'withdraw' via a lookup â€” inspect if the gate
  -- misfires. Amount is stored in USD dollars per legacy convention.
  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, destination_type, status
  )
  VALUES (
    v_user_id,
    (p_amount_cents::NUMERIC / 100.0),
    'USD',
    'bank',
    'pending'::public.transaction_status
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$function$;

-- ─── 6. request_advance: block frozen user ───────────────────────────────

CREATE OR REPLACE FUNCTION public.request_advance(p_ui_code text, p_requested_amount_cents bigint, p_term_months integer DEFAULT NULL::integer, p_repayment_preference text DEFAULT 'payout_withholding'::text, p_user_id uuid DEFAULT NULL::uuid, p_target_cycle_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id            UUID;
  v_kyc_status         TEXT;
  v_account_age_days   INT;
  v_xnscore            INT;
  v_completed_circles  INT := 0;
  v_recent_late        INT := 0;
  v_db_code            TEXT;
  v_product            public.loan_products%ROWTYPE;
  v_active_count       INT;
  v_term               INT;
  v_apr                NUMERIC(6,3);
  v_monthly_rate       NUMERIC(20,10);
  v_compound_factor    NUMERIC(30,12);
  v_principal          BIGINT;
  v_origination_fee    BIGINT;
  v_monthly_cents      BIGINT;
  v_total_interest     BIGINT;
  v_total_repayment    BIGINT;
  v_app_id             UUID;
  v_loan_id            UUID;
  v_today              DATE := CURRENT_DATE;
  v_schedule           JSONB := '[]'::JSONB;
  i                    INT;
  v_due_date           DATE;
  v_principal_per      BIGINT;
  v_interest_per       BIGINT;
  v_remainder          BIGINT;
  v_target_cycle_id    UUID;
  v_cycle_owner        UUID;
  v_cycle_paid         DATE;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF public.is_account_frozen(v_user_id) THEN
    RAISE EXCEPTION 'account_frozen' USING ERRCODE = '42501';
  END IF;


  SELECT status
    INTO v_kyc_status
    FROM public.kyc_verifications
   WHERE member_id = v_user_id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;
  IF v_kyc_status IS NULL OR v_kyc_status <> 'approved' THEN
    RAISE EXCEPTION 'eligibility_blocked:kyc_required';
  END IF;

  IF p_requested_amount_cents IS NULL OR p_requested_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_repayment_preference NOT IN ('payout_withholding', 'manual') THEN
    RAISE EXCEPTION 'invalid_repayment_preference';
  END IF;

  v_db_code := CASE p_ui_code
    WHEN 'contribution' THEN 'circle_boost'
    WHEN 'quick'        THEN 'micro_emergency'
    WHEN 'flex'         THEN 'education'
    WHEN 'premium'      THEN 'small_business'
    WHEN 'mortgage'     THEN 'home_country_mortgage'
    ELSE NULL
  END;
  IF v_db_code IS NULL THEN
    RAISE EXCEPTION 'unknown_product:%', p_ui_code;
  END IF;

  SELECT * INTO v_product
  FROM public.loan_products
  WHERE code = v_db_code;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'eligibility_blocked:product_not_configured';
  END IF;
  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'eligibility_blocked:product_inactive';
  END IF;

  IF COALESCE(v_product.min_account_age_days, 0) > 0 THEN
    SELECT EXTRACT(DAY FROM (now() - p.created_at))::INT
      INTO v_account_age_days
      FROM public.profiles p
     WHERE p.id = v_user_id;
    IF v_account_age_days IS NULL OR v_account_age_days < v_product.min_account_age_days THEN
      RAISE EXCEPTION 'eligibility_blocked:account_age_too_low';
    END IF;
  END IF;

  SELECT COALESCE(ROUND(total_score)::INT, 0)
    INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id
    AND cm.status = 'completed';

  IF v_xnscore < v_product.min_xnscore THEN
    RAISE EXCEPTION 'eligibility_blocked:xnscore_too_low';
  END IF;
  IF v_completed_circles < COALESCE(v_product.min_completed_circles, 0) THEN
    RAISE EXCEPTION 'eligibility_blocked:not_enough_completed_circles';
  END IF;

  -- Mig 354 â€” Fix A. Late-payment gate.
  IF COALESCE(v_product.min_recent_ontime_cycles, 0) > 0 THEN
    SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;
    IF v_recent_late > 0 THEN
      RAISE EXCEPTION 'eligibility_blocked:recent_late_contributions';
    END IF;
  END IF;

  -- Mig 356 â€” 1-active-loan gate (primary). Any status='active' loan
  -- blocks a new advance. Doc 36 Â§3 Phase 1 policy.
  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status = 'active'::loan_status;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'eligibility_blocked:active_advance_exists';
  END IF;

  -- Mig 184's â‰¥3 belt. Unreachable given the 1-cap above; retained so
  -- removing the 1-cap later doesn't silently drop the safety net.
  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'eligibility_blocked:too_many_active_advances';
  END IF;

  IF p_requested_amount_cents < v_product.min_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_below_min';
  END IF;
  IF p_requested_amount_cents > v_product.max_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_above_max';
  END IF;
  v_principal := p_requested_amount_cents;

  -- Mig 356 â€” resolve v_target_cycle_id. Caller-supplied wins; else
  -- default to member's earliest upcoming cycle where they are the
  -- recipient, ordered by expected_payout_date NULLS LAST, id.
  IF p_target_cycle_id IS NOT NULL THEN
    SELECT cc.recipient_user_id, cc.actual_payout_date
      INTO v_cycle_owner, v_cycle_paid
    FROM public.circle_cycles cc
    WHERE cc.id = p_target_cycle_id;
    IF v_cycle_owner IS NULL THEN
      RAISE EXCEPTION 'invalid_target_cycle:not_found';
    END IF;
    IF v_cycle_owner IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'invalid_target_cycle:not_recipient';
    END IF;
    IF v_cycle_paid IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_target_cycle:already_paid';
    END IF;
    v_target_cycle_id := p_target_cycle_id;
  ELSE
    -- Default lookup. If the member has no upcoming payout cycle,
    -- v_target_cycle_id stays NULL and the loan falls to manual
    -- repayment â€” not an error, just a design choice.
    SELECT cc.id
      INTO v_target_cycle_id
    FROM public.circle_cycles cc
    WHERE cc.recipient_user_id = v_user_id
      AND cc.actual_payout_date IS NULL
    ORDER BY cc.expected_payout_date NULLS LAST, cc.id
    LIMIT 1;
  END IF;

  v_term := COALESCE(p_term_months, v_product.min_term_months);
  IF v_term < v_product.min_term_months THEN
    v_term := v_product.min_term_months;
  END IF;
  IF v_term > v_product.max_term_months THEN
    v_term := v_product.max_term_months;
  END IF;
  IF v_term IS NULL OR v_term < 1 THEN v_term := 1; END IF;

  v_apr := CASE
    WHEN v_product.base_apr_min IS NULL OR v_product.base_apr_max IS NULL THEN 0
    WHEN v_xnscore <= v_product.min_xnscore THEN v_product.base_apr_max
    WHEN v_xnscore >= 100 THEN v_product.base_apr_min
    ELSE ROUND(
      v_product.base_apr_max
      - ((v_xnscore - v_product.min_xnscore)::NUMERIC
         / NULLIF(100 - v_product.min_xnscore, 0))
        * (v_product.base_apr_max - v_product.base_apr_min),
      3
    )
  END;

  v_origination_fee :=
    ROUND(v_principal * COALESCE(v_product.origination_fee_percent, 0) / 100)::BIGINT;

  IF v_apr > 0 THEN
    v_monthly_rate    := v_apr / 100 / 12;
    v_compound_factor := POWER(1 + v_monthly_rate, v_term);
    v_monthly_cents   := ROUND(
      v_principal * v_monthly_rate * v_compound_factor / (v_compound_factor - 1)
    )::BIGINT;
    v_total_repayment := v_monthly_cents * v_term;
    v_total_interest  := v_total_repayment - v_principal;
  ELSE
    v_total_interest  := 0;
    v_total_repayment := v_principal;
    v_monthly_cents   := CEIL(v_principal::NUMERIC / v_term)::BIGINT;
  END IF;

  INSERT INTO public.loan_applications (
    user_id, loan_product_id,
    requested_amount_cents, approved_amount_cents,
    term_months, purpose, purpose_description,
    apr, origination_fee_cents,
    monthly_payment_cents, total_interest_cents, total_repayment_cents,
    status, status_reason,
    disbursement_method, disbursement_destination,
    disbursed_at, terms_accepted_at,
    repayment_preference,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_product.id,
    v_principal, v_principal,
    v_term,
    CASE p_ui_code
      WHEN 'contribution' THEN 'circle_contribution'::loan_product_purpose
      WHEN 'quick'        THEN 'emergency'::loan_product_purpose
      WHEN 'flex'         THEN 'other'::loan_product_purpose
      WHEN 'premium'      THEN 'business'::loan_product_purpose
      WHEN 'mortgage'     THEN 'other'::loan_product_purpose
    END,
    'Advance via ' || p_ui_code,
    v_apr, v_origination_fee,
    v_monthly_cents, v_total_interest, v_total_repayment,
    'disbursed'::loan_application_status, 'auto_approved',
    'wallet', 'wallet',
    now(), now(),
    p_repayment_preference,
    now(), now()
  )
  RETURNING id INTO v_app_id;

  INSERT INTO public.loans (
    user_id, application_id, loan_product_id,
    principal_cents, apr, term_months,
    origination_fee_cents,
    first_payment_date, final_payment_date,
    monthly_payment_cents,
    outstanding_principal_cents, outstanding_interest_cents,
    outstanding_fees_cents, total_outstanding_cents,
    payments_made, payments_total,
    next_payment_date, next_payment_amount_cents,
    days_past_due, is_delinquent,
    status,
    estimated_monthly_payment_cents,
    autopay_enabled,
    target_cycle_id,      -- Mig 356 â€” new column populated here
    created_at, updated_at
  ) VALUES (
    v_user_id, v_app_id, v_product.id,
    v_principal, v_apr, v_term,
    v_origination_fee,
    (v_today + INTERVAL '1 month')::DATE,
    (v_today + (v_term || ' months')::INTERVAL)::DATE,
    v_monthly_cents,
    v_principal, v_total_interest,
    v_origination_fee, v_total_repayment + v_origination_fee,
    0, v_term,
    (v_today + INTERVAL '1 month')::DATE, v_monthly_cents,
    0, FALSE,
    'active'::loan_status,
    v_monthly_cents,
    p_repayment_preference = 'payout_withholding',
    v_target_cycle_id,
    now(), now()
  )
  RETURNING id INTO v_loan_id;

  v_principal_per := v_principal / v_term;
  v_interest_per  := v_total_interest / v_term;
  v_remainder     := v_principal - (v_principal_per * v_term);

  FOR i IN 1..v_term LOOP
    v_due_date := (v_today + (i || ' months')::INTERVAL)::DATE;

    INSERT INTO public.loan_payment_schedule (
      loan_id, payment_number, due_date,
      principal_due_cents, interest_due_cents, fees_due_cents,
      total_due_cents,
      principal_paid_cents, interest_paid_cents, fees_paid_cents, total_paid_cents,
      status,
      late_fee_cents, late_fee_waived,
      late_fee_applied,
      created_at, updated_at
    ) VALUES (
      v_loan_id, i, v_due_date,
      v_principal_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END),
      v_interest_per,
      0,
      v_principal_per + v_interest_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END),
      0, 0, 0, 0,
      'pending'::loan_payment_status,
      0, FALSE,
      FALSE,
      now(), now()
    );

    v_schedule := v_schedule || jsonb_build_object(
      'payment_number', i,
      'due_date', v_due_date,
      'total_due_cents', v_principal_per + v_interest_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'loan_id', v_loan_id,
    'application_id', v_app_id,
    'status', 'approved',
    'auto_approved', TRUE,
    'product_ui_code', p_ui_code,
    'product_db_code', v_db_code,
    'approved_amount_cents', v_principal,
    'apr', v_apr,
    'term_months', v_term,
    'origination_fee_cents', v_origination_fee,
    'monthly_payment_cents', v_monthly_cents,
    'total_interest_cents', v_total_interest,
    'total_repayment_cents', v_total_repayment,
    'first_payment_date', (v_today + INTERVAL '1 month')::DATE,
    'repayment_preference', p_repayment_preference,
    'target_cycle_id', v_target_cycle_id,
    'repayment_schedule', v_schedule
  );
END;
$function$;

-- ─── 7. check_advance_eligibility: return not_eligible ────────────────────

CREATE OR REPLACE FUNCTION public.check_advance_eligibility(p_ui_code text, p_amount_cents bigint DEFAULT NULL::bigint, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id            UUID;
  v_kyc_status         TEXT;
  v_account_age_days   INT;
  v_xnscore            INT;
  v_completed_circles  INT := 0;
  v_recent_late        INT := 0;
  v_db_code            TEXT;
  v_product            public.loan_products%ROWTYPE;
  v_active_count       INT;
  v_reason             TEXT := NULL;
  v_recommended_cents  BIGINT;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'auth_required');
  END IF;
  IF public.is_account_frozen(v_user_id) THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'account_frozen');
  END IF;


  v_db_code := CASE p_ui_code
    WHEN 'contribution' THEN 'circle_boost'
    WHEN 'quick'        THEN 'micro_emergency'
    WHEN 'flex'         THEN 'education'
    WHEN 'premium'      THEN 'small_business'
    WHEN 'mortgage'     THEN 'home_country_mortgage'
    ELSE NULL
  END;
  IF v_db_code IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'unknown_product');
  END IF;

  SELECT * INTO v_product
  FROM public.loan_products
  WHERE code = v_db_code;
  IF v_product.id IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'product_not_configured');
  END IF;
  IF NOT v_product.is_active THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'product_inactive');
  END IF;

  -- KYC
  SELECT status
    INTO v_kyc_status
    FROM public.kyc_verifications
   WHERE member_id = v_user_id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;
  IF v_kyc_status IS NULL OR v_kyc_status <> 'approved' THEN
    v_reason := 'kyc_required';
  END IF;

  -- Account age
  IF v_reason IS NULL AND COALESCE(v_product.min_account_age_days, 0) > 0 THEN
    SELECT EXTRACT(DAY FROM (now() - p.created_at))::INT
      INTO v_account_age_days
      FROM public.profiles p
     WHERE p.id = v_user_id;
    IF v_account_age_days IS NULL OR v_account_age_days < v_product.min_account_age_days THEN
      v_reason := 'account_age_too_low';
    END IF;
  END IF;

  -- XnScore
  IF v_reason IS NULL THEN
    SELECT COALESCE(ROUND(total_score)::INT, 0)
      INTO v_xnscore
      FROM public.xn_scores
     WHERE user_id = v_user_id;
    IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;
    IF v_xnscore < v_product.min_xnscore THEN
      v_reason := 'xnscore_too_low';
    END IF;
  END IF;

  -- Completed circles
  IF v_reason IS NULL THEN
    SELECT COUNT(*)::INT INTO v_completed_circles
      FROM public.circle_members cm
     WHERE cm.user_id = v_user_id
       AND cm.status = 'completed';
    IF v_completed_circles < COALESCE(v_product.min_completed_circles, 0) THEN
      v_reason := 'not_enough_completed_circles';
    END IF;
  END IF;

  -- Mig 354 â€” Fix A. Late-payment gate.
  IF v_reason IS NULL AND COALESCE(v_product.min_recent_ontime_cycles, 0) > 0 THEN
    SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;
    IF v_recent_late > 0 THEN
      v_reason := 'recent_late_contributions';
    END IF;
  END IF;

  -- Mig 356 â€” 1-active-loan gate. Precedes the â‰¥3 safety net so members
  -- with 1 or 2 active loans see the tighter, more informative reason
  -- ("active_advance_exists") rather than the outer bound.
  IF v_reason IS NULL THEN
    SELECT COUNT(*) INTO v_active_count
      FROM public.loans
     WHERE user_id = v_user_id
       AND status = 'active'::loan_status;
    IF v_active_count >= 1 THEN
      v_reason := 'active_advance_exists';
    END IF;
  END IF;

  -- Legacy â‰¥3 safety net. Mig 354's cap. Should be unreachable with the
  -- 1-cap above active, but kept so removing the 1-cap in a future rollout
  -- doesn't silently drop the belt.
  IF v_reason IS NULL THEN
    IF v_active_count IS NULL THEN
      SELECT COUNT(*) INTO v_active_count
        FROM public.loans
       WHERE user_id = v_user_id
         AND status = 'active'::loan_status;
    END IF;
    IF v_active_count >= 3 THEN
      v_reason := 'too_many_active_advances';
    END IF;
  END IF;

  IF v_reason IS NULL AND p_amount_cents IS NOT NULL THEN
    IF p_amount_cents < v_product.min_amount_cents THEN
      v_reason := 'amount_below_min';
    ELSIF p_amount_cents > v_product.max_amount_cents THEN
      v_reason := 'amount_above_max';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', FALSE,
      'reason',   v_reason,
      'product_ui_code', p_ui_code,
      'product_db_code', v_db_code
    );
  END IF;

  v_recommended_cents := GREATEST(
    v_product.min_amount_cents,
    LEAST(v_product.max_amount_cents,
          FLOOR(v_product.max_amount_cents * 0.6)::BIGINT)
  );

  RETURN jsonb_build_object(
    'eligible', TRUE,
    'reason', NULL,
    'product_ui_code', p_ui_code,
    'product_db_code', v_db_code,
    'min_amount_cents', v_product.min_amount_cents,
    'max_amount_cents', v_product.max_amount_cents,
    'recommended_amount_cents', v_recommended_cents
  );
END;
$function$;

-- ─── 8. execute_cycle_payout: hold on frozen recipient ───────────────────

CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cycle              RECORD;
  v_circle             RECORD;
  v_circle_name        TEXT;
  v_payout_id          UUID;
  v_gross_cents        BIGINT;
  v_repayment_cents    BIGINT := 0;
  v_net_cents          BIGINT;
  v_amount             NUMERIC;
  v_existing           UUID;
  v_wallet_id          UUID;
  v_balance_before     BIGINT;
  v_balance_after_credit BIGINT;
  v_balance_after      BIGINT;
  v_wallet_tx_id       UUID;
  v_wallet_tx_debit_id UUID;
  v_circle_finalized   BOOLEAN := FALSE;
  v_loan_id            UUID;
  v_loan_outstanding   BIGINT;
  v_repay_receipt      JSONB;
  v_actual_paid        INT;
  v_paused             BOOLEAN;
  v_require_approval   BOOLEAN;
  v_existing_status    public.payout_status;
  v_gate_payout_id     UUID;
BEGIN
  -- â•�â•�â•� Doc 39 (mig 379) three-check gate â•�â•�â•�
  SELECT payouts_paused INTO v_paused FROM public.platform_settings WHERE id = 1;
  IF v_paused THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'platform_paused');
  END IF;

  SELECT id, status INTO v_gate_payout_id, v_existing_status
    FROM public.circle_payouts
   WHERE cycle_id = p_cycle_id
   LIMIT 1;
  IF v_existing_status = 'held' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'payout_held',
                              'payout_id', v_gate_payout_id);
  END IF;
  IF v_existing_status = 'awaiting_approval' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'awaiting_approval',
                              'payout_id', v_gate_payout_id);
  END IF;

  -- Circle-level approval mode. If ON and no row exists yet, insert an
  -- awaiting_approval stub so the console sees it â€” MVP bridge until
  -- Phase 3's webhook change lands. If OFF or a live row already exists,
  -- proceed to the normal flow.
  IF v_gate_payout_id IS NULL THEN
    SELECT c.payouts_require_approval, cc.circle_id, cc.recipient_user_id,
           cc.cycle_number, cc.payout_amount, c.name
      INTO v_require_approval, v_cycle.circle_id, v_cycle.recipient_user_id,
           v_cycle.cycle_number, v_cycle.payout_amount, v_circle_name
      FROM public.circle_cycles cc
      JOIN public.circles c ON c.id = cc.circle_id
     WHERE cc.id = p_cycle_id;
    IF v_require_approval THEN
      INSERT INTO public.circle_payouts (
        circle_id, cycle_id, cycle_number, recipient_id,
        amount, amount_cents, currency, status, metadata
      )
      VALUES (
        v_cycle.circle_id, p_cycle_id, v_cycle.cycle_number, v_cycle.recipient_user_id,
        COALESCE(v_cycle.payout_amount, 0),
        COALESCE(ROUND(v_cycle.payout_amount * 100)::BIGINT, 0),
        'USD', 'awaiting_approval',
        jsonb_build_object('origin', 'execute_cycle_payout_gate')
      )
      RETURNING id INTO v_gate_payout_id;
      RETURN jsonb_build_object('success', FALSE, 'error', 'awaiting_approval',
                                'payout_id', v_gate_payout_id, 'created', TRUE);
    END IF;
  END IF;
  -- â•�â•�â•� End three-check gate â•�â•�â•�

  SELECT * INTO v_cycle FROM public.circle_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cycle_not_found');
  END IF;
  IF v_cycle.recipient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_recipient');
  END IF;

  -- Mig 390 — recipient-freeze hold. On frozen recipient we do NOT error
  -- (that would loop the cycle-progression cron). Insert a circle_payouts
  -- row in the existing 'held' state so admins can resolve intentionally
  -- via unfreeze + re-execute, matching the manual hold_payout flow.
  IF public.is_account_frozen(v_cycle.recipient_user_id) THEN
    INSERT INTO public.circle_payouts (
      circle_id, cycle_id, cycle_number, recipient_id,
      amount, amount_cents, currency, status,
      held_at, hold_reason, hold_justification, metadata
    )
    VALUES (
      v_cycle.circle_id, v_cycle.id, v_cycle.cycle_number, v_cycle.recipient_user_id,
      COALESCE(v_cycle.payout_amount, 0),
      COALESCE(ROUND(v_cycle.payout_amount * 100)::BIGINT, 0),
      'USD', 'held',
      NOW(), 'other',
      'System-generated hold: recipient account is frozen. Payout will resume when the account is unfrozen.',
      jsonb_build_object('origin', 'execute_cycle_payout', 'auto_hold_reason', 'recipient_frozen')
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_payout_id;

    -- Notify recipient (best-effort; not fatal).
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        v_cycle.recipient_user_id,
        'payout_held',
        'Your payout is on hold',
        'Your circle payout is held because your account is frozen. '
        || 'Please contact support to resolve.',
        jsonb_build_object(
          'cycle_id',   v_cycle.id,
          'circle_id',  v_cycle.circle_id,
          'reason',     'recipient_frozen'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[execute_cycle_payout] recipient-frozen notification insert failed cycle=%, err=%',
        p_cycle_id, SQLERRM;
    END;

    RETURN jsonb_build_object('success', FALSE, 'error', 'recipient_frozen',
                              'held', TRUE, 'payout_id', v_payout_id);
  END IF;


  -- Mig 361 â€” phantom-payout guard.
  IF COALESCE(v_cycle.collected_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_contributions_collected');
  END IF;

  -- Mig 365 â€” all-members-paid guard.
  SELECT COUNT(DISTINCT user_id) INTO v_actual_paid
    FROM (
      SELECT user_id
        FROM public.circle_contributions
       WHERE circle_id = v_cycle.circle_id
         AND cycle_number = v_cycle.cycle_number
         AND status = 'paid'
      UNION
      SELECT user_id
        FROM public.contributions
       WHERE circle_id = v_cycle.circle_id
         AND cycle_number = v_cycle.cycle_number
         AND status = 'paid'
    ) paid_users;
  IF COALESCE(v_actual_paid, 0) < COALESCE(v_cycle.expected_contributions, 0) THEN
    RETURN jsonb_build_object(
      'success',  FALSE,
      'error',    'payout_blocked: not_all_members_contributed',
      'received', COALESCE(v_actual_paid, 0),
      'expected', COALESCE(v_cycle.expected_contributions, 0)
    );
  END IF;

  v_amount := COALESCE(v_cycle.payout_amount, v_cycle.collected_amount, 0);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'zero_amount');
  END IF;
  v_gross_cents := ROUND(v_amount * 100)::BIGINT;

  SELECT id INTO v_existing
    FROM public.circle_payouts
   WHERE cycle_id = p_cycle_id
      OR metadata->>'cycle_id' = p_cycle_id::text
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'payout_id', v_existing,
      'idempotent', TRUE
    );
  END IF;

  SELECT * INTO v_circle FROM public.circles WHERE id = v_cycle.circle_id;
  v_circle_name := COALESCE(v_circle.name, 'your circle');

  INSERT INTO public.circle_payouts (
    circle_id, cycle_id, cycle_number, recipient_id,
    amount, amount_cents, currency, status,
    payment_method, metadata, completed_at
  )
  VALUES (
    v_cycle.circle_id, v_cycle.id, v_cycle.cycle_number, v_cycle.recipient_user_id,
    v_amount, v_gross_cents, 'USD', 'completed',
    'internal_wallet',
    jsonb_build_object(
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number,
      'origin',        'execute_cycle_payout'
    ),
    NOW()
  )
  RETURNING id INTO v_payout_id;

  SELECT id, main_balance_cents INTO v_wallet_id, v_balance_before
    FROM public.user_wallets
   WHERE user_id = v_cycle.recipient_user_id
   FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_cycle.recipient_user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_balance_before;
  END IF;

  SELECT id, total_outstanding_cents
    INTO v_loan_id, v_loan_outstanding
  FROM public.loans
  WHERE user_id = v_cycle.recipient_user_id
    AND target_cycle_id = p_cycle_id
    AND status = 'active'::loan_status
    AND autopay_enabled = TRUE
  FOR UPDATE;

  IF v_loan_id IS NOT NULL AND COALESCE(v_loan_outstanding, 0) > 0 THEN
    v_repayment_cents := LEAST(
      FLOOR(v_gross_cents::NUMERIC * 0.80)::BIGINT,
      v_loan_outstanding
    );
  END IF;

  v_net_cents := v_gross_cents - v_repayment_cents;

  v_balance_after_credit := v_balance_before + v_gross_cents;
  v_balance_after        := v_balance_before + v_net_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_gross_cents,
         last_activity_at = NOW()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, direction,
    amount_cents, balance_type,
    balance_before_cents, balance_after_cents,
    reference_type, reference_id,
    description, transaction_status, metadata
  )
  VALUES (
    v_wallet_id, v_cycle.recipient_user_id, 'circle_payout', 'credit',
    v_gross_cents, 'main',
    v_balance_before, v_balance_after_credit,
    'circle_payout', v_payout_id,
    'Payout from ' || v_circle_name,
    'completed',
    jsonb_build_object(
      'circle_id',     v_cycle.circle_id,
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number,
      'gross_cents',   v_gross_cents,
      'repayment_cents', v_repayment_cents,
      'net_cents',     v_net_cents
    )
  )
  RETURNING id INTO v_wallet_tx_id;

  IF v_repayment_cents > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    )
    VALUES (
      v_wallet_id, v_cycle.recipient_user_id, 'advance_repayment', 'debit',
      v_repayment_cents, 'main',
      v_balance_after_credit, v_balance_after,
      'loan', v_loan_id,
      'Advance auto-repayment from ' || v_circle_name || ' payout',
      'completed',
      jsonb_build_object(
        'cycle_id',   v_cycle.id,
        'payout_id',  v_payout_id,
        'loan_id',    v_loan_id,
        'source',     'execute_cycle_payout',
        'cap_pct',    80,
        'gross_cents', v_gross_cents
      )
    )
    RETURNING id INTO v_wallet_tx_debit_id;

    SELECT public.process_advance_repayment(
      v_loan_id,
      v_repayment_cents,
      'payout',
      v_wallet_tx_debit_id,
      v_payout_id::text,
      v_cycle.recipient_user_id
    ) INTO v_repay_receipt;
  END IF;

  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         last_payout_error      = NULL,
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  IF v_circle.total_cycles IS NOT NULL
     AND v_cycle.cycle_number >= v_circle.total_cycles THEN
    UPDATE public.circles
       SET status           = 'completed',
           completed_at     = NOW(),
           cycles_completed = v_circle.total_cycles,
           updated_at       = NOW()
     WHERE id = v_cycle.circle_id
       AND status <> 'completed';
    v_circle_finalized := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'payout_id',          v_payout_id,
    'wallet_tx_id',       v_wallet_tx_id,
    'gross_cents',        v_gross_cents,
    'repayment_cents',    v_repayment_cents,
    'net_cents',          v_net_cents,
    'amount_cents',       v_gross_cents,
    'balance_after_cents', v_balance_after,
    'circle_finalized',   v_circle_finalized,
    'advance_repayment',  CASE
      WHEN v_repayment_cents > 0 THEN jsonb_build_object(
        'loan_id',           v_loan_id,
        'wallet_tx_debit_id', v_wallet_tx_debit_id,
        'receipt',           v_repay_receipt
      )
      ELSE NULL
    END
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE public.circle_cycles
     SET last_payout_error      = LEFT(SQLERRM, 500),
         last_payout_attempt_at = NOW(),
         payout_attempts        = COALESCE(payout_attempts, 0) + 1
   WHERE id = p_cycle_id;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$function$;

-- ─── 9. admin_freeze_account: notify user ────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_freeze_account(p_user_id uuid, p_reason text, p_dispute_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_admin_id UUID := auth.uid();
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = v_admin_id AND is_active = TRUE
      AND role IN ('super_admin', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE profiles SET
    account_frozen_at     = NOW(),
    account_frozen_reason = p_reason,
    account_frozen_by     = v_admin_id
  WHERE id = p_user_id;

  IF p_dispute_id IS NOT NULL THEN
    UPDATE stripe_disputes SET frozen_account = TRUE, updated_at = NOW()
      WHERE id = p_dispute_id AND member_id = p_user_id;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'account.freeze',
    'profile',
    p_user_id,
    jsonb_build_object(
      'reason', p_reason,
      'dispute_id', p_dispute_id
    )
  );

  -- Mig 390 — notify the frozen user directly so they know why actions
  -- are now blocked. Best-effort; not fatal (audit trail is authoritative).
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'account.frozen',
      'Your account has been frozen',
      'Your TandaXn account has been temporarily frozen. Reason: ' || p_reason
        || E'\n\nUntil an admin unfreezes your account, you cannot contribute, '
        || 'receive payouts, request advances, or move money. Please contact '
        || 'support if you believe this was in error.',
      jsonb_build_object('reason', p_reason, 'dispute_id', p_dispute_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[admin_freeze_account] user notification insert failed user=%, err=%',
      p_user_id, SQLERRM;
  END;


  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'frozen_at', NOW());
END;
$function$;

-- ─── 10. admin_unfreeze_account: notify user ─────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_unfreeze_account(p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_admin_id UUID := auth.uid();
  v_prior_reason TEXT;
  v_prior_frozen_at TIMESTAMPTZ;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = v_admin_id AND is_active = TRUE
      AND role IN ('super_admin', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;

  SELECT account_frozen_reason, account_frozen_at
    INTO v_prior_reason, v_prior_frozen_at
  FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_prior_frozen_at IS NULL THEN
    RAISE EXCEPTION 'account_not_frozen' USING ERRCODE = '22023';
  END IF;

  UPDATE profiles SET
    account_frozen_at     = NULL,
    account_frozen_reason = NULL,
    account_frozen_by     = NULL
  WHERE id = p_user_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'account.unfreeze',
    'profile',
    p_user_id,
    jsonb_build_object(
      'unfreeze_reason', p_reason,
      'prior_freeze_reason', v_prior_reason,
      'prior_frozen_at', v_prior_frozen_at
    )
  );

  -- Mig 390 — notify the user their account is unfrozen. Best-effort.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_user_id,
      'account.unfrozen',
      'Your account has been restored',
      'Your TandaXn account is no longer frozen. You can now resume '
      || 'contributions, payouts, advances, and money transfers.',
      jsonb_build_object('unfreeze_reason', p_reason)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[admin_unfreeze_account] user notification insert failed user=%, err=%',
      p_user_id, SQLERRM;
  END;


  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$function$;

-- ─── 11. RLS: block frozen user's direct wallet updates ──────────────────
-- The client's useWallet.makeContribution / addFunds paths update
-- user_wallets directly (no RPC in the middle). Adding the freeze check
-- to pe_uw_update is the only defensive layer we can plant without a
-- correctness refactor of those client paths. Service-role bypasses RLS,
-- so payouts / webhook credits keep working.
DROP POLICY IF EXISTS pe_uw_update ON public.user_wallets;
CREATE POLICY pe_uw_update ON public.user_wallets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND NOT public.is_account_frozen(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND NOT public.is_account_frozen(auth.uid()));

-- ─── 12. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '390',
  'enforce_account_freeze',
  ARRAY['-- 390: enforce_account_freeze']
)
ON CONFLICT (version) DO NOTHING;
