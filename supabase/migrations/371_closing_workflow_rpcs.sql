-- ═══════════════════════════════════════════════════════════════════════════
-- 371_closing_workflow_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 38 — three RPCs implementing the circle closing + correction flow.
--
-- 1. apply_correction — admin writes a compensating ledger event
--    linked to an original. Original is never modified (append-only).
--
-- 2. close_circle — admin runs the closing invariant; if balanced, writes
--    a 'circle.closed' event with a balance snapshot and sets
--    circles.status='closed'. Otherwise returns a diff report and stays
--    open.
--
-- 3. reopen_circle — hardcoded-UUID-whitelist-only safety valve.
--    Reopens a closed circle back to 'payout_complete' after a written
--    ≥50-char reason. Writes 'circle.reopened' event with the reason.
--    Expected usage <1/year.
--
-- Ordering note for close/reopen relative to the mig 372 trigger (which
-- blocks ledger inserts on closed circles):
--   * close_circle: INSERT 'circle.closed' event first (while status is
--     still payout_complete → trigger allows), THEN UPDATE status='closed'.
--   * reopen_circle: UPDATE status='payout_complete' first (trigger sees
--     open status → allows), THEN INSERT 'circle.reopened' event.
--
-- Synthetic IDs on ledger_events:
--   * stripe_event_id  = 'internal:correction:<uuid>' etc. (unique)
--   * stripe_object_id = 'internal:correction:<original_id>' or the
--     circle_id for close/reopen events (traceable; non-unique).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. apply_correction ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_correction(
  p_original_event_id  UUID,
  p_reason_code        TEXT,
  p_justification      TEXT,
  p_amount_cents_delta INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id       UUID := auth.uid();
  v_original       RECORD;
  v_correction_id  UUID;
  v_synth_event_id TEXT;
BEGIN
  -- Admin gate
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = v_admin_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  -- Reason code enum
  IF p_reason_code NOT IN (
    'webhook_duplicate',
    'stripe_refund',
    'bug_reconciliation',
    'member_dispute_resolved',
    'other_documented'
  ) THEN
    RAISE EXCEPTION 'invalid_reason_code: %', p_reason_code;
  END IF;

  -- Justification length
  IF p_justification IS NULL OR length(trim(p_justification)) < 20 THEN
    RAISE EXCEPTION 'justification_too_short: minimum 20 chars, got %',
      COALESCE(length(trim(p_justification)), 0);
  END IF;

  -- Original event lookup — must exist. Rows are never modified so a
  -- copy is safe to read for its circle_id + amount context.
  SELECT * INTO v_original
    FROM public.ledger_events WHERE id = p_original_event_id;
  IF v_original.id IS NULL THEN
    RAISE EXCEPTION 'original_event_not_found';
  END IF;

  -- If the original event ties to a circle, that circle must not be
  -- closed. The mig 372 trigger also enforces this — we check here for
  -- a clean error message before the insert attempt.
  IF v_original.circle_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.circles
     WHERE id = v_original.circle_id AND status = 'closed'
  ) THEN
    RAISE EXCEPTION 'circle_closed: cannot correct events on a closed circle';
  END IF;

  -- Synthesize a unique event id. UUID suffix guarantees uniqueness even
  -- if the same original is corrected multiple times.
  v_synth_event_id := 'internal:correction:' || gen_random_uuid()::TEXT;

  -- Write the compensating entry. amount_cents carries the SIGNED delta
  -- as passed by the caller; a positive delta is a credit-side offset,
  -- a negative delta a debit-side offset.
  INSERT INTO public.ledger_events (
    stripe_event_id,
    stripe_object_id,
    event_type,
    amount_cents,
    currency,
    user_id,
    recipient_user_id,
    circle_id,
    trip_id,
    cycle_id,
    external_reference_id,
    external_reference_type,
    raw_payload,
    metadata
  ) VALUES (
    v_synth_event_id,
    'internal:correction:' || p_original_event_id::TEXT,
    'correction',
    p_amount_cents_delta,
    COALESCE(v_original.currency, 'USD'),
    v_original.user_id,
    v_original.recipient_user_id,
    v_original.circle_id,
    v_original.trip_id,
    v_original.cycle_id,
    p_original_event_id,
    'ledger_event_correction',
    NULL,
    jsonb_build_object(
      'reason_code',       p_reason_code,
      'justification',     p_justification,
      'original_event_id', p_original_event_id,
      'admin_user_id',     v_admin_id,
      'applied_at',        NOW()
    )
  )
  RETURNING id INTO v_correction_id;

  RETURN jsonb_build_object(
    'success',             TRUE,
    'original_event_id',   p_original_event_id,
    'correction_event_id', v_correction_id,
    'amount_cents_delta',  p_amount_cents_delta,
    'reason_code',         p_reason_code,
    'admin_user_id',       v_admin_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_correction(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_correction(UUID, TEXT, TEXT, INTEGER) TO authenticated;

-- ─── 2. close_circle ────────────────────────────────────────────────────
-- Runs the closing invariant against the actual per-circle tables
-- (circle_contributions, circle_payouts) plus any correction events on
-- ledger_events for this circle. Doc 34's ledger_events is Stripe-only
-- today; per-circle contribution/payout data lives in the app tables.
-- The invariant sums those directly. As more categories move into
-- ledger_events (fees, etc.), extend the sum accordingly.

CREATE OR REPLACE FUNCTION public.close_circle(
  p_circle_id     UUID,
  p_reviewer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id      UUID := auth.uid();
  v_circle        RECORD;
  v_contribs      NUMERIC := 0;
  v_payouts       NUMERIC := 0;
  v_corrections   NUMERIC := 0;
  v_net_cents     BIGINT;
  v_close_event_id UUID;
  v_synth_event_id TEXT;
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = v_admin_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO v_circle FROM public.circles WHERE id = p_circle_id;
  IF v_circle.id IS NULL THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status = 'closed' THEN
    RAISE EXCEPTION 'already_closed';
  END IF;

  -- Compute invariant. Sums are in dollars for contributions/payouts
  -- (their table columns) and cents for corrections (ledger amount_cents).
  SELECT COALESCE(SUM(amount), 0) INTO v_contribs
    FROM public.circle_contributions
   WHERE circle_id = p_circle_id AND status = 'paid';
  SELECT COALESCE(SUM(amount), 0) INTO v_payouts
    FROM public.circle_payouts
   WHERE circle_id = p_circle_id AND status = 'completed';
  SELECT COALESCE(SUM(amount_cents), 0) / 100.0 INTO v_corrections
    FROM public.ledger_events
   WHERE circle_id = p_circle_id AND event_type = 'correction';

  -- net in cents. Positive = collected more than paid out; negative =
  -- paid out more than collected. Corrections shift the delta.
  v_net_cents := ROUND((v_contribs - v_payouts + v_corrections) * 100)::BIGINT;

  IF ABS(v_net_cents) > 1 THEN
    -- Diff report; do not close.
    RETURN jsonb_build_object(
      'success',            FALSE,
      'reason',             'invariant_not_zero',
      'circle_id',          p_circle_id,
      'contributions_total', v_contribs,
      'payouts_total',       v_payouts,
      'corrections_total',   v_corrections,
      'net_cents',           v_net_cents,
      'tolerance_cents',     1
    );
  END IF;

  -- Balanced. Write the close event FIRST (while status is still open,
  -- so the mig 372 trigger allows the insert), THEN flip status.
  v_synth_event_id := 'internal:circle_closed:' || gen_random_uuid()::TEXT;
  INSERT INTO public.ledger_events (
    stripe_event_id,
    stripe_object_id,
    event_type,
    amount_cents,
    currency,
    circle_id,
    external_reference_type,
    metadata
  ) VALUES (
    v_synth_event_id,
    'internal:circle_closed:' || p_circle_id::TEXT,
    'circle.closed',
    v_net_cents,
    'USD',
    p_circle_id,
    'circle_close_snapshot',
    jsonb_build_object(
      'admin_user_id',       v_admin_id,
      'reviewer_note',       p_reviewer_note,
      'contributions_total', v_contribs,
      'payouts_total',       v_payouts,
      'corrections_total',   v_corrections,
      'net_cents',           v_net_cents,
      'closed_at',           NOW()
    )
  )
  RETURNING id INTO v_close_event_id;

  -- Now flip status. All subsequent ledger inserts for this circle are
  -- blocked by the mig 372 trigger.
  UPDATE public.circles
     SET status     = 'closed',
         closed_at  = NOW(),
         updated_at = NOW()
   WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'success',        TRUE,
    'circle_id',      p_circle_id,
    'close_event_id', v_close_event_id,
    'net_cents',      v_net_cents,
    'closed_at',      NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_circle(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_circle(UUID, TEXT) TO authenticated;

-- ─── 3. reopen_circle ───────────────────────────────────────────────────
-- Hardcoded UUID whitelist per Doc 38 §4.1. Placeholder value below —
-- edit the ARRAY literal to the real ops admin UUIDs before use in prod.
-- Whitelist is defined in-body (not a role) precisely because reopening
-- a closed circle is a high-consequence action and should be gated by
-- specific individuals, not by an admin_users membership check.

CREATE OR REPLACE FUNCTION public.reopen_circle(
  p_circle_id UUID,
  p_reason    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id       UUID := auth.uid();
  v_circle         RECORD;
  v_reopen_event_id UUID;
  v_synth_event_id TEXT;
  -- Hardcoded ops-admin whitelist. EDIT BEFORE USE — the placeholder
  -- UUID matches no real user and will cause every call to fail closed.
  v_whitelist UUID[] := ARRAY[
    '00000000-0000-0000-0000-000000000001'::UUID
  ];
BEGIN
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT (v_admin_id = ANY (v_whitelist)) THEN
    RAISE EXCEPTION 'not_in_reopen_whitelist';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 50 THEN
    RAISE EXCEPTION 'reason_too_short: minimum 50 chars, got %',
      COALESCE(length(trim(p_reason)), 0);
  END IF;

  SELECT * INTO v_circle FROM public.circles WHERE id = p_circle_id FOR UPDATE;
  IF v_circle.id IS NULL THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status <> 'closed' THEN
    RAISE EXCEPTION 'not_closed';
  END IF;

  -- Flip status FIRST so the mig 372 trigger allows the reopen event
  -- insert immediately after (trigger reads status = 'payout_complete',
  -- allows). Never reverts to 'active' — the reopened state is
  -- payout_complete pending a fresh close_circle.
  UPDATE public.circles
     SET status     = 'payout_complete',
         closed_at  = NULL,
         updated_at = NOW()
   WHERE id = p_circle_id;

  v_synth_event_id := 'internal:circle_reopened:' || gen_random_uuid()::TEXT;
  INSERT INTO public.ledger_events (
    stripe_event_id,
    stripe_object_id,
    event_type,
    amount_cents,
    currency,
    circle_id,
    external_reference_type,
    metadata
  ) VALUES (
    v_synth_event_id,
    'internal:circle_reopened:' || p_circle_id::TEXT,
    'circle.reopened',
    0,
    'USD',
    p_circle_id,
    'circle_reopen',
    jsonb_build_object(
      'admin_user_id', v_admin_id,
      'reason',        p_reason,
      'reopened_at',   NOW()
    )
  )
  RETURNING id INTO v_reopen_event_id;

  RETURN jsonb_build_object(
    'success',         TRUE,
    'circle_id',       p_circle_id,
    'reopen_event_id', v_reopen_event_id,
    'new_status',      'payout_complete'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_circle(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_circle(UUID, TEXT) TO authenticated;

-- ─── 4. Self-register ────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '371',
  'closing_workflow_rpcs',
  ARRAY['-- 371: apply_correction + close_circle + reopen_circle RPCs']
)
ON CONFLICT (version) DO NOTHING;
