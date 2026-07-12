-- ═══════════════════════════════════════════════════════════════════════════
-- 292_auto_payout_trigger.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Auto-payout support: expose a single read-only decision function the
-- stripe-webhook calls after every circle_contribution payment_intent
-- .succeeded event. When the incoming contribution completes the cycle
-- (all active members have paid at least once), the RPC returns the
-- recipient + amount + Stripe Connect account id the webhook needs to
-- stage the Transfer inline.
--
-- Gates (ALL must hold for should_trigger = TRUE):
--   * circles.status = 'active'                   ← not forming/pending/paused
--   * circle_cycles row exists for (circle,#)    ← nothing to pay to otherwise
--   * cycle.recipient_user_id IS NOT NULL         ← someone must receive
--   * recipient has stripe_connect_account_id     ← payout destination exists
--   * cycle.payout_amount > 0                     ← nothing to pay
--   * COUNT(circle_members WHERE active) > 0      ← the RPC doesn't fire for
--                                                   solo/empty circles
--   * COUNT(DISTINCT paid contributors) >=        ← last contribution just
--     COUNT(active members)                        landed
--   * NO circle_payouts row in
--     (scheduled|pending|processing|completed)    ← blocks admin+auto race and
--                                                   post-completion re-firing
--
-- Idempotency ownership: the RPC does NOT insert or lock rows itself —
-- it's a pure decision. The webhook uses pending_intents.UNIQUE
-- (client_reference_id = 'client_ref_payout_<cycle_id>') and the Stripe
-- idempotency key ('payout-<cycle_id>') to collapse concurrent triggers.
-- Both values are IDENTICAL to what process-circle-payout (admin path)
-- uses, so an admin manual trigger racing this webhook resolves to a
-- single Transfer regardless of which side lands first.
--
-- DISTINCT user_id is deliberate: the contribution table permits
-- multiple rows per (member, cycle) for the partial-pool / catch-up
-- flow (see docblock in stripe-webhook line 549). Counting rows
-- naively would over-count a member who paid in two installments and
-- fire the trigger before other members finished.
--
-- SECURITY DEFINER + service_role only: the webhook is the only caller.
-- Not authenticated-callable — clients should get "has this cycle paid
-- out" via existing is_cycle_paid_out or by reading circle_payouts.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION should_auto_trigger_payout(
  p_circle_id UUID,
  p_cycle_number INT
) RETURNS TABLE (
  should_trigger              BOOLEAN,
  cycle_id                    UUID,
  recipient_user_id           UUID,
  payout_amount_cents         INT,
  stripe_connect_account_id   TEXT,
  paid_count                  INT,
  expected_count              INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_status  TEXT;
  v_cycle_id       UUID;
  v_recipient      UUID;
  v_payout_amount  NUMERIC;
  v_stripe_account TEXT;
  v_expected       INT;
  v_paid           INT;
  v_existing       INT;
BEGIN
  -- Circle status gate — anything other than 'active' short-circuits.
  SELECT c.status INTO v_circle_status FROM circles c WHERE c.id = p_circle_id;
  IF v_circle_status IS DISTINCT FROM 'active' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 0, NULL::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Resolve the cycle row.
  SELECT cc.id, cc.recipient_user_id, cc.payout_amount
  INTO v_cycle_id, v_recipient, v_payout_amount
  FROM circle_cycles cc
  WHERE cc.circle_id = p_circle_id AND cc.cycle_number = p_cycle_number
  LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 0, NULL::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Any live payout row for this cycle blocks the auto-trigger. Covers
  -- both admin-manual (in flight) and prior auto-trigger runs. We include
  -- 'scheduled' even though process-circle-payout doesn't emit it —
  -- future writers might, and the block is cheap.
  SELECT COUNT(*) INTO v_existing
  FROM circle_payouts cp
  WHERE cp.cycle_id = v_cycle_id
    AND cp.status IN ('scheduled', 'pending', 'processing', 'completed');

  -- Resolve recipient's Stripe Connect account. NULL is not a hard fail
  -- here — we still return the counts so the webhook log can distinguish
  -- "not-all-paid" from "all-paid-but-no-Stripe-account".
  IF v_recipient IS NOT NULL THEN
    SELECT p.stripe_connect_account_id INTO v_stripe_account
    FROM profiles p WHERE p.id = v_recipient;
  END IF;

  -- Active-member count for this circle.
  SELECT COUNT(*) INTO v_expected
  FROM circle_members cm
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  -- Distinct paid contributors this cycle. DISTINCT prevents the
  -- partial-pool flow from over-counting.
  SELECT COUNT(DISTINCT user_id) INTO v_paid
  FROM circle_contributions
  WHERE circle_id = p_circle_id
    AND cycle_number = p_cycle_number
    AND status = 'paid';

  RETURN QUERY SELECT
    (
      v_existing = 0
      AND v_expected > 0
      AND v_paid >= v_expected
      AND v_recipient IS NOT NULL
      AND v_stripe_account IS NOT NULL
      AND v_payout_amount IS NOT NULL
      AND v_payout_amount > 0
    ),
    v_cycle_id,
    v_recipient,
    COALESCE(ROUND(v_payout_amount * 100)::INT, 0),
    v_stripe_account,
    v_paid,
    v_expected;
END;
$$;

REVOKE ALL ON FUNCTION should_auto_trigger_payout(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION should_auto_trigger_payout(UUID, INT) TO service_role;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '292',
  'auto_payout_trigger',
  ARRAY['-- 292: auto_payout_trigger']
)
ON CONFLICT (version) DO NOTHING;
