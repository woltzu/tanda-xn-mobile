-- ═══════════════════════════════════════════════════════════════════════════
-- 381_payout_console_stripe_object_id_fix.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix for mig 379's four admin RPCs. All INSERTs into ledger_events omitted
-- the stripe_object_id column, which is NOT NULL — so every call to
-- hold_payout / release_payout / set_circle_approval_mode /
-- toggle_platform_pause has been failing at the ledger-write step with:
--
--   23502: null value in column "stripe_object_id" of relation
--          "ledger_events" violates not-null constraint
--
-- The error bubbled up to the client but the AdminPayoutConsoleScreen
-- surfaced it via showToast() — and toasts render under the Modal's
-- z-layer on React Native, so users saw no feedback at all. The
-- companion commit switches the modal error path to Alert.alert.
--
-- Note: mig 371 (Doc 38 close/correction/reopen RPCs) DID include
-- stripe_object_id in its INSERTs; those RPCs are unaffected. The bug
-- was mine alone in mig 379.
--
-- Fix pattern: stripe_object_id gets the SAME synthetic value as
-- stripe_event_id — for internal (non-Stripe-originated) events these
-- fields both point at "this event", and duplicating satisfies the
-- NOT NULL constraint without a schema change. No UNIQUE on
-- stripe_object_id (verified) so duplicates across rows are also fine.
--
-- This migration is a pure CREATE OR REPLACE of the four RPCs. Bodies
-- are byte-identical to mig 379 except for the INSERT column list +
-- VALUES tuple. Grants preserved (REVOKE + GRANT re-issued).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── hold_payout ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.hold_payout(
  p_cycle_id            UUID,
  p_reason_code         TEXT,
  p_justification       TEXT,
  p_member_facing_note  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin        UUID;
  v_admin_role   TEXT;
  v_cycle        RECORD;
  v_payout_id    UUID;
  v_prev_status  public.payout_status;
  v_event_id     UUID;
  v_event_sid    TEXT;
  v_notif_body   TEXT;
  v_default_body TEXT := 'Your payout is on a brief hold. Your money is safe with TandaXn. '
                      || 'A team member is verifying a routine detail before releasing your '
                      || 'payout. Most holds resolve within 24 hours — we''ll notify you as '
                      || 'soon as it''s released. No action is needed from you.';
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF p_reason_code IS NULL
     OR p_reason_code NOT IN ('investigation','webhook_delay','documentation_check','other') THEN
    RAISE EXCEPTION 'invalid_reason_code';
  END IF;
  IF p_justification IS NULL OR length(trim(p_justification)) < 20 THEN
    RAISE EXCEPTION 'justification_too_short';
  END IF;

  SELECT cc.id, cc.circle_id, cc.recipient_user_id, cc.cycle_number, cc.payout_amount,
         c.status AS circle_status, c.name AS circle_name
    INTO v_cycle
    FROM public.circle_cycles cc
    JOIN public.circles c ON c.id = cc.circle_id
   WHERE cc.id = p_cycle_id
   FOR UPDATE OF cc;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cycle_not_found';
  END IF;
  IF v_cycle.circle_status = 'closed' THEN
    RAISE EXCEPTION 'circle_closed';
  END IF;

  SELECT id, status
    INTO v_payout_id, v_prev_status
    FROM public.circle_payouts
   WHERE cycle_id = p_cycle_id
   FOR UPDATE;

  IF v_payout_id IS NOT NULL THEN
    IF v_prev_status IN ('completed','failed','cancelled','reversed') THEN
      RAISE EXCEPTION 'payout_already_terminal';
    END IF;
    UPDATE public.circle_payouts
       SET status              = 'held',
           held_at             = NOW(),
           held_by_admin_id    = v_admin,
           hold_reason         = p_reason_code,
           hold_justification  = trim(p_justification)
     WHERE id = v_payout_id;
  ELSE
    INSERT INTO public.circle_payouts (
      circle_id, cycle_id, cycle_number, recipient_id,
      amount, amount_cents, currency, status,
      held_at, held_by_admin_id, hold_reason, hold_justification, metadata
    )
    VALUES (
      v_cycle.circle_id, v_cycle.id, v_cycle.cycle_number, v_cycle.recipient_user_id,
      COALESCE(v_cycle.payout_amount, 0),
      COALESCE(ROUND(v_cycle.payout_amount * 100)::BIGINT, 0),
      'USD', 'held',
      NOW(), v_admin, p_reason_code, trim(p_justification),
      jsonb_build_object('origin', 'hold_payout')
    )
    RETURNING id INTO v_payout_id;
  END IF;

  v_event_id  := gen_random_uuid();
  v_event_sid := 'tandaxn.internal:payout.held:' || v_event_id::text;
  INSERT INTO public.ledger_events (
    stripe_event_id, stripe_object_id, event_type, amount_cents, currency,
    user_id, recipient_user_id, circle_id, cycle_id, metadata
  )
  VALUES (
    v_event_sid, v_event_sid, 'payout.held',
    0, 'USD',
    v_admin, v_cycle.recipient_user_id, v_cycle.circle_id, v_cycle.id,
    jsonb_build_object(
      'payout_id',          v_payout_id,
      'admin_user_id',      v_admin,
      'reason_code',        p_reason_code,
      'justification',      trim(p_justification),
      'member_facing_note', p_member_facing_note,
      'prev_status',        v_prev_status
    )
  );

  BEGIN
    v_notif_body := COALESCE(NULLIF(trim(p_member_facing_note), ''), v_default_body);
    INSERT INTO public.notifications (
      user_id, type, title, body, data
    )
    VALUES (
      v_cycle.recipient_user_id,
      'payout_held',
      'Your payout is on a brief hold',
      v_notif_body,
      jsonb_build_object(
        'cycle_id',   v_cycle.id,
        'circle_id',  v_cycle.circle_id,
        'payout_id',  v_payout_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[hold_payout] notification insert failed cycle=%, err=%',
      p_cycle_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',      TRUE,
    'payout_id',    v_payout_id,
    'cycle_id',     v_cycle.id,
    'prev_status',  v_prev_status,
    'held_at',      NOW(),
    'held_by',      v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.hold_payout(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.hold_payout(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ─── release_payout ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_payout(
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_payout      RECORD;
  v_event_id    UUID;
  v_event_sid   TEXT;
  v_approval_id UUID;
  v_approval_sid TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  SELECT id, circle_id, cycle_id, recipient_id, status,
         held_by_admin_id, hold_reason
    INTO v_payout
    FROM public.circle_payouts
   WHERE cycle_id = p_cycle_id
     AND status IN ('held','awaiting_approval')
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_active_hold';
  END IF;

  IF v_admin_role = 'admin'
     AND v_payout.status = 'held'
     AND v_payout.held_by_admin_id IS DISTINCT FROM v_admin THEN
    RAISE EXCEPTION 'not_original_holder';
  END IF;

  UPDATE public.circle_payouts
     SET status                       = 'scheduled',
         released_at                  = NOW(),
         released_by_admin_id         = v_admin,
         approval_granted_at          = CASE WHEN v_payout.status = 'awaiting_approval'
                                             THEN NOW() ELSE approval_granted_at END,
         approval_granted_by_admin_id = CASE WHEN v_payout.status = 'awaiting_approval'
                                             THEN v_admin ELSE approval_granted_by_admin_id END
   WHERE id = v_payout.id;

  v_event_id  := gen_random_uuid();
  v_event_sid := 'tandaxn.internal:payout.released:' || v_event_id::text;
  INSERT INTO public.ledger_events (
    stripe_event_id, stripe_object_id, event_type, amount_cents, currency,
    user_id, recipient_user_id, circle_id, cycle_id, metadata
  )
  VALUES (
    v_event_sid, v_event_sid, 'payout.released',
    0, 'USD',
    v_admin, v_payout.recipient_id, v_payout.circle_id, v_payout.cycle_id,
    jsonb_build_object(
      'payout_id',         v_payout.id,
      'admin_user_id',     v_admin,
      'prev_status',       v_payout.status,
      'original_holder',   v_payout.held_by_admin_id
    )
  );

  IF v_payout.status = 'awaiting_approval' THEN
    v_approval_id  := gen_random_uuid();
    v_approval_sid := 'tandaxn.internal:payout.approval_granted:' || v_approval_id::text;
    INSERT INTO public.ledger_events (
      stripe_event_id, stripe_object_id, event_type, amount_cents, currency,
      user_id, recipient_user_id, circle_id, cycle_id, metadata
    )
    VALUES (
      v_approval_sid, v_approval_sid, 'payout.approval_granted',
      0, 'USD',
      v_admin, v_payout.recipient_id, v_payout.circle_id, v_payout.cycle_id,
      jsonb_build_object(
        'payout_id',     v_payout.id,
        'admin_user_id', v_admin
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success',        TRUE,
    'payout_id',      v_payout.id,
    'cycle_id',       v_payout.cycle_id,
    'new_status',     'scheduled',
    'released_by',    v_admin,
    'was_approval',   (v_payout.status = 'awaiting_approval')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_payout(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.release_payout(UUID) TO authenticated;

-- ─── set_circle_approval_mode ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_circle_approval_mode(
  p_circle_id       UUID,
  p_require_approval BOOLEAN,
  p_reason          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_circle      RECORD;
  v_event_id    UUID;
  v_event_sid   TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  SELECT id, status INTO v_circle FROM public.circles WHERE id = p_circle_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status = 'closed' THEN
    RAISE EXCEPTION 'circle_closed';
  END IF;

  UPDATE public.circles
     SET payouts_require_approval = p_require_approval,
         updated_at               = NOW()
   WHERE id = p_circle_id;

  v_event_id  := gen_random_uuid();
  v_event_sid := 'tandaxn.internal:circle.approval_mode_changed:' || v_event_id::text;
  INSERT INTO public.ledger_events (
    stripe_event_id, stripe_object_id, event_type, amount_cents, currency,
    user_id, circle_id, metadata
  )
  VALUES (
    v_event_sid, v_event_sid, 'circle.approval_mode_changed',
    0, 'USD',
    v_admin, p_circle_id,
    jsonb_build_object(
      'admin_user_id',    v_admin,
      'require_approval', p_require_approval,
      'reason',           trim(p_reason)
    )
  );

  RETURN jsonb_build_object(
    'success',          TRUE,
    'circle_id',        p_circle_id,
    'require_approval', p_require_approval,
    'set_by',           v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_approval_mode(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_circle_approval_mode(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── toggle_platform_pause ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_platform_pause(
  p_activate BOOLEAN,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_event_id    UUID;
  v_event_sid   TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'super_admin_required';
  END IF;

  IF p_activate AND (p_reason IS NULL OR length(trim(p_reason)) < 50) THEN
    RAISE EXCEPTION 'activation_reason_too_short';
  END IF;

  UPDATE public.platform_settings
     SET payouts_paused              = p_activate,
         payouts_paused_at           = CASE WHEN p_activate THEN NOW() ELSE NULL END,
         payouts_paused_by_admin_id  = CASE WHEN p_activate THEN v_admin ELSE NULL END,
         payouts_paused_reason       = CASE WHEN p_activate THEN trim(p_reason) ELSE NULL END,
         updated_at                  = NOW()
   WHERE id = 1;

  v_event_id  := gen_random_uuid();
  IF p_activate THEN
    v_event_sid := 'tandaxn.internal:payout.platform_pause_activated:' || v_event_id::text;
    INSERT INTO public.ledger_events (
      stripe_event_id, stripe_object_id, event_type, amount_cents, currency, user_id, metadata
    )
    VALUES (
      v_event_sid, v_event_sid, 'payout.platform_pause_activated',
      0, 'USD', v_admin,
      jsonb_build_object(
        'admin_user_id',   v_admin,
        'reason',          trim(p_reason),
        'twofa_verified',  FALSE
      )
    );
  ELSE
    v_event_sid := 'tandaxn.internal:payout.platform_pause_released:' || v_event_id::text;
    INSERT INTO public.ledger_events (
      stripe_event_id, stripe_object_id, event_type, amount_cents, currency, user_id, metadata
    )
    VALUES (
      v_event_sid, v_event_sid, 'payout.platform_pause_released',
      0, 'USD', v_admin,
      jsonb_build_object(
        'admin_user_id', v_admin,
        'release_note',  COALESCE(trim(p_reason), '')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'paused',  p_activate,
    'by',      v_admin,
    'at',      NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_platform_pause(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.toggle_platform_pause(BOOLEAN, TEXT) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '381',
  'payout_console_stripe_object_id_fix',
  ARRAY['-- 381: fix hold_payout / release_payout / set_circle_approval_mode / toggle_platform_pause — populate stripe_object_id (NOT NULL) on ledger_events INSERTs. Mig 379 had all four RPCs silently failing at 23502.']
)
ON CONFLICT (version) DO NOTHING;
