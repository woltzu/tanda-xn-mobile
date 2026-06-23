-- ════════════════════════════════════════════════════════════════════════════
-- Migration 241: Join-trip Bucket A — participant payment columns + RPC + triggers
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the participant payment loop end-to-end. Adds two audit columns
-- on trip_participants, the central RPC record_trip_payment_succeeded()
-- the stripe-webhook calls when a trip_* PI succeeds, a participant-paid
-- notification trigger, and an AI-decision wrapper. Mirrors the
-- isolated-wrapper pattern from migrations 238/240.
--
-- Spec deviations corrected (verified against live DB 2026-06-22):
--   1. trip_payments has NO `trip_id` column — only `trip_participant_id`
--      (FK → trip_participants). The spec's RPC tried to INSERT a `trip_id`
--      that doesn't exist; corrected to derive trip_id from the participant
--      lookup and only persist trip_participant_id.
--   2. trip_payments.amount is DECIMAL(10,2) DOLLARS, not cents. Stripe PI
--      payloads carry the charge in `amount` (cents integer). The RPC
--      divides by 100 at the boundary.
--   3. No `insert_notification` helper exists. We INSERT INTO public.notifications
--      directly using the same column list as migration 238's
--      notify_trip_participant_joined.
--   4. `record_ai_decision` is a six-positional-arg function
--      (member_id, decision_type, decision_value, explanation_data,
--      source_event_id, source_event_type) per migration 218 — the spec
--      passed five.
--   5. ai_decisions CHECK constraint is named `ai_decisions_decision_type_check`
--      (migration 238), not `decision_type_check`. Drop + re-add by the
--      canonical name and rebuild the entire allowed list — this widen
--      adds 'trip_participant_paid' on top of every existing value (else
--      we silently drop other domains' allowed types).
--   6. Migration registry uses the canonical
--      `supabase_migrations.schema_migrations (version, name, statements)`
--      per CLAUDE.md, NOT the spec's `supabase_migrations`.
--   7. Spec's RPC pulled amount + payment_type from PI metadata as strings.
--      We let the EF stamp those into metadata and read them defensively
--      with COALESCE so a missing field doesn't crash the RPC.
--   8. Status promotion: when a deposit lands and the participant is
--      still 'pending', flip them to 'confirmed' AND stamp confirmed_at.
--      Spec's CASE forced 'confirmed' for both branches but didn't bother
--      setting confirmed_at on the deposit branch — fixed here so the
--      organizer dashboard's "confirmed since" timestamp is meaningful.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Add audit columns ────────────────────────────────────────────────
-- cancelled_at: cancel timestamp (engine A.1 fix #3 writes here now);
-- last_payment_reminder_at: stamped by the future C.2 reminder cron so
-- we don't re-ping daily.
ALTER TABLE public.trip_participants
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trip_participants_unpaid_pending
  ON public.trip_participants (registered_at)
  WHERE status = 'pending' AND payment_status = 'unpaid';

-- ─── 2. record_trip_payment_succeeded RPC ────────────────────────────────
-- Webhook-callable atomic write: INSERT trip_payments + recompute
-- total_paid + flip payment_status + (if deposit threshold crossed)
-- promote participant pending→confirmed. SECURITY DEFINER because the
-- webhook EF runs as service_role and never has the participant's JWT.
--
-- p_payment_intent_id  → the Stripe PI id (recorded on the row for audit)
-- p_pi_payload         → the full PI JSON; we read metadata + the cents
--                        amount from this rather than trusting the caller
--                        to pre-parse, so a future webhook author can't
--                        accidentally invoke us with malformed args.
CREATE OR REPLACE FUNCTION public.record_trip_payment_succeeded(
  p_payment_intent_id TEXT,
  p_pi_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_participant_id  UUID;
  v_payment_type    TEXT;
  v_amount_cents    BIGINT;
  v_amount_dollars  NUMERIC(12,2);
  v_trip_id         UUID;
  v_organizer_id    UUID;
  v_user_id         UUID;
  v_price           NUMERIC(12,2);
  v_deposit         NUMERIC(12,2);
  v_new_total       NUMERIC(12,2);
  v_new_status      TEXT;
  v_promote_to_confirmed BOOLEAN;
  v_payment_id      UUID;
BEGIN
  -- Idempotency: if we've already recorded this PI as succeeded, return
  -- the existing row id and exit. Mirrors the credit_goal_external
  -- pattern in migration 074 — Stripe retries land at the duplicate
  -- ack in the webhook event table, but defence-in-depth here lets the
  -- RPC be safely called manually.
  SELECT id INTO v_payment_id
    FROM public.trip_payments
   WHERE stripe_payment_intent_id = p_payment_intent_id
     AND status = 'succeeded'
   LIMIT 1;
  IF v_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'payment_id', v_payment_id
    );
  END IF;

  -- Pull the fields we need from the PI payload. Metadata strings are
  -- the source of truth for participant_id + payment_type; Stripe's
  -- top-level `amount` is the source of truth for the charge in cents.
  v_participant_id := NULLIF(p_pi_payload->'metadata'->>'trip_participant_id', '')::UUID;
  v_payment_type   := COALESCE(p_pi_payload->'metadata'->>'payment_type', 'full');
  v_amount_cents   := (p_pi_payload->>'amount')::BIGINT;

  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION '[record_trip_payment_succeeded] PI % missing metadata.trip_participant_id', p_payment_intent_id;
  END IF;
  IF v_amount_cents IS NULL OR v_amount_cents < 50 THEN
    RAISE EXCEPTION '[record_trip_payment_succeeded] PI % has invalid amount %', p_payment_intent_id, v_amount_cents;
  END IF;

  v_amount_dollars := v_amount_cents::NUMERIC / 100;

  -- Resolve the trip + pricing context from the participant row. We
  -- prefer this over trusting metadata.trip_id so the RPC stays correct
  -- even if a future PI omits or mis-stamps it.
  SELECT tp.trip_id, t.organizer_id, t.price_per_person, t.deposit_amount, tp.user_id
    INTO v_trip_id, v_organizer_id, v_price, v_deposit, v_user_id
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
   WHERE tp.id = v_participant_id;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION '[record_trip_payment_succeeded] trip_participant % not found', v_participant_id;
  END IF;

  -- Insert the payment row. trip_payments only has trip_participant_id
  -- (no direct trip_id), which is why we resolved trip context above
  -- rather than persisting it here.
  INSERT INTO public.trip_payments (
    trip_participant_id,
    amount,
    payment_type,
    stripe_payment_intent_id,
    status,
    paid_at
  ) VALUES (
    v_participant_id,
    v_amount_dollars,
    v_payment_type,
    p_payment_intent_id,
    'succeeded',
    NOW()
  )
  RETURNING id INTO v_payment_id;

  -- Recompute total from all succeeded rows (don't trust client deltas).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_new_total
    FROM public.trip_payments
   WHERE trip_participant_id = v_participant_id
     AND status = 'succeeded';

  -- Derive payment_status from the recomputed total vs trip thresholds.
  -- Tiers mirror the values the participant's `payment_status` CHECK
  -- already enforces in migration 065.
  IF v_price IS NOT NULL AND v_new_total >= v_price THEN
    v_new_status := 'paid_in_full';
  ELSIF v_deposit IS NOT NULL AND v_deposit > 0 AND v_new_total >= v_deposit THEN
    v_new_status := 'deposit_paid';
  ELSE
    v_new_status := 'partial';
  END IF;

  -- Promote to confirmed if (a) we crossed the deposit/full threshold AND
  -- (b) the participant is still pending. Waitlist → confirmed is NOT
  -- triggered here — that's a seat-availability decision the organizer
  -- (or a future cron) makes separately.
  v_promote_to_confirmed := v_new_status IN ('deposit_paid', 'paid_in_full');

  UPDATE public.trip_participants
     SET total_paid     = v_new_total,
         payment_status = v_new_status,
         status         = CASE
                            WHEN v_promote_to_confirmed AND status = 'pending'
                              THEN 'confirmed'
                            ELSE status
                          END,
         confirmed_at   = CASE
                            WHEN v_promote_to_confirmed AND status = 'pending' AND confirmed_at IS NULL
                              THEN NOW()
                            ELSE confirmed_at
                          END,
         updated_at     = NOW()
   WHERE id = v_participant_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'payment_id', v_payment_id,
    'trip_id', v_trip_id,
    'participant_id', v_participant_id,
    'amount_dollars', v_amount_dollars,
    'payment_type', v_payment_type,
    'new_payment_status', v_new_status,
    'promoted_to_confirmed', v_promote_to_confirmed
  );
END;
$$;

-- ─── 3. notify_trip_participant_paid trigger ─────────────────────────────
-- Fires when a trip_payments row lands with status='succeeded' (either via
-- the RPC above or any future direct insert path). Recipient is the
-- organizer; participant name uses the display_name → full_name fallback
-- chain mirroring migration 238.
CREATE OR REPLACE FUNCTION public.notify_trip_participant_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name    TEXT;
  v_organizer_id UUID;
  v_who          TEXT;
  v_trip_id      UUID;
BEGIN
  -- Pull trip + participant context. JOIN through trip_participants
  -- because trip_payments has no direct trip_id.
  SELECT t.trip_name, t.organizer_id, t.id,
         COALESCE(p.display_name, p.full_name, 'A traveller')
    INTO v_trip_name, v_organizer_id, v_trip_id, v_who
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
    LEFT JOIN public.profiles p ON p.id = tp.user_id
   WHERE tp.id = NEW.trip_participant_id;

  IF v_organizer_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_organizer_id,
      'trip_participant_paid',
      'Payment received: ' || COALESCE(v_trip_name, 'your trip'),
      COALESCE(v_who, 'A traveller') || ' paid $' || NEW.amount::text
        || ' for "' || COALESCE(v_trip_name, 'your trip') || '"',
      jsonb_build_object(
        'trip_id',         v_trip_id,
        'trip_name',       v_trip_name,
        'participant_id',  NEW.trip_participant_id,
        'payment_id',      NEW.id,
        'amount',          NEW.amount,
        'payment_type',    NEW.payment_type,
        'participant_name', v_who,
        'i18n_title_key',  'trip.notification_participant_paid_title',
        'i18n_body_key',   'trip.notification_participant_paid_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_trip_participant_paid] failed for payment %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_paid_notify ON public.trip_payments;
CREATE TRIGGER tr_trip_participant_paid_notify
AFTER INSERT ON public.trip_payments
FOR EACH ROW
WHEN (NEW.status = 'succeeded')
EXECUTE FUNCTION public.notify_trip_participant_paid();

-- Also fire on UPDATE when status transitions into succeeded (e.g. a
-- pending row that the webhook later promotes). Idempotency at the
-- consumer side is the participant's own notification dedup, but we
-- gate the trigger on a real state change so a no-op UPDATE doesn't
-- re-fire.
DROP TRIGGER IF EXISTS tr_trip_participant_paid_notify_upd ON public.trip_payments;
CREATE TRIGGER tr_trip_participant_paid_notify_upd
AFTER UPDATE OF status ON public.trip_payments
FOR EACH ROW
WHEN (NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded')
EXECUTE FUNCTION public.notify_trip_participant_paid();

-- ─── 4. AI decision: widen CHECK + wrapper trigger ───────────────────────
-- Same separate-wrapper pattern as migrations 219/220/223/231/236/238/240
-- so an AI insert failure cannot roll back the notification fan-out.
ALTER TABLE public.ai_decisions
  DROP CONSTRAINT IF EXISTS ai_decisions_decision_type_check;

ALTER TABLE public.ai_decisions
  ADD CONSTRAINT ai_decisions_decision_type_check
  CHECK (decision_type = ANY (ARRAY[
    'xnscore_increase'::text,
    'xnscore_decrease'::text,
    'circle_join_rejection'::text,
    'liquidity_denial'::text,
    'tier_advancement'::text,
    'tier_demotion'::text,
    'payout_position'::text,
    'intervention_message'::text,
    'honor_score_change'::text,
    'stress_score_change'::text,
    'mood_drift_change'::text,
    'stress_status_change'::text,
    'swap_completed'::text,
    'cycle_state_change'::text,
    'substitution_completed'::text,
    'partial_plan_completed'::text,
    'conflict_resolved'::text,
    'loan_disbursed'::text,
    'loan_default'::text,
    'community_post_published'::text,
    'community_post_milestone'::text,
    'event_created'::text,
    'gathering_created'::text,
    'trip_published'::text,
    'trip_update_posted'::text,
    'trip_participant_paid'::text
  ]));

CREATE OR REPLACE FUNCTION public.record_ai_decision_for_trip_participant_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_name TEXT;
  v_user_id   UUID;
  v_trip_id   UUID;
BEGIN
  SELECT tp.user_id, t.id, t.trip_name
    INTO v_user_id, v_trip_id, v_trip_name
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
   WHERE tp.id = NEW.trip_participant_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.record_ai_decision(
      v_user_id,                                          -- p_member_id (the participant)
      'trip_participant_paid',                            -- p_decision_type
      'Paid $' || NEW.amount::text                        -- p_decision_value
        || ' (' || NEW.payment_type || ')',
      jsonb_build_object(
        'TRIP_ID',      v_trip_id,
        'TRIP_NAME',    COALESCE(v_trip_name, ''),
        'AMOUNT',       NEW.amount,
        'PAYMENT_TYPE', NEW.payment_type,
        'PI_ID',        NEW.stripe_payment_intent_id
      ),                                                  -- p_explanation_data
      NEW.id,                                             -- p_source_event_id
      'trip_payment'                                      -- p_source_event_type
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[record_ai_decision_for_trip_participant_paid] failed for payment %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_participant_paid_ai_decision ON public.trip_payments;
CREATE TRIGGER tr_trip_participant_paid_ai_decision
AFTER INSERT ON public.trip_payments
FOR EACH ROW
WHEN (NEW.status = 'succeeded')
EXECUTE FUNCTION public.record_ai_decision_for_trip_participant_paid();

DROP TRIGGER IF EXISTS tr_trip_participant_paid_ai_decision_upd ON public.trip_payments;
CREATE TRIGGER tr_trip_participant_paid_ai_decision_upd
AFTER UPDATE OF status ON public.trip_payments
FOR EACH ROW
WHEN (NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded')
EXECUTE FUNCTION public.record_ai_decision_for_trip_participant_paid();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '241',
  'trip_participant_payment',
  ARRAY['-- 241: trip_participant_payment']
)
ON CONFLICT (version) DO NOTHING;
