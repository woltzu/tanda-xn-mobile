-- ═══════════════════════════════════════════════════════════════════════════
-- 317_cancel_circle_rpc.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- cancel_circle(p_circle_id UUID) — admin-triggered circle cancellation
-- that refunds every paid contribution back to its member's wallet in a
-- single transaction, then flips the circle to status='cancelled'. Once
-- cancelled, mig 315's guard block on circles.status keeps future
-- contributions out (via the create-circle-contribution-intent EF) and
-- mig 309's refund trigger catches anything that slips through.
--
-- Auth model:
--   * Admin can always cancel any circle (admin_users row exists +
--     is_active=true).
--   * The circle's creator can cancel their own circle.
-- Anyone else → auth_denied.
--
-- Refund semantics (per spec):
--   Sum paid contributions across BOTH source tables (circle_contributions
--   and contributions) per user, credit each user's wallet by the sum,
--   and flip those contribution rows to status='refunded' (both tables
--   accept the value — CHECK extended in mig 309a for circle_contributions
--   and enum extended in mig 309b for contributions).
--
--   Simplification: refund every paid contribution regardless of whether
--   the payer already received a payout. In the common "cancel during
--   collection, before any payout" case this is exactly right. In an
--   "cancel mid-circle after some payouts fired" case it can over-refund
--   people who already took money out of the pot — flagged for admin
--   awareness but out of scope for launch (documented here so a future
--   audit RPC can net against circle_payouts).
--
-- Idempotency:
--   * status guard at the top — already-cancelled / already-completed
--     circles short-circuit with success=false + a reason.
--   * refund trigger (mig 309) won't fire on 'paid'→'refunded' — its
--     guard is `NEW.status IS DISTINCT FROM 'paid'` → true → exits.
--   * counter trigger (mig 308) also skips — its guard requires NEW.status
--     = 'paid'.
--
-- Atomicity:
--   Wrapped in outer BEGIN…EXCEPTION. If any single refund throws (bad
--   FK, arithmetic overflow, downstream trigger failure), the whole
--   RPC rolls back to the initial savepoint — no partial refunds and
--   the circle stays in its pre-call state.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cancel_circle(p_circle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_caller           UUID;
  v_is_admin         BOOLEAN;
  v_circle_row       RECORD;
  v_refund_row       RECORD;
  v_wallet_id        UUID;
  v_balance_before   BIGINT;
  v_amount_cents     BIGINT;
  v_refund_wt_id     UUID;
  v_members_refunded INT := 0;
  v_total_cents      BIGINT := 0;
BEGIN
  -- Auth: caller must be admin OR the circle's creator.
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'auth_required');
  END IF;

  SELECT * INTO v_circle_row FROM public.circles WHERE id = p_circle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'circle_not_found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = v_caller AND is_active = TRUE
  ) INTO v_is_admin;

  IF NOT v_is_admin AND v_circle_row.created_by <> v_caller THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'auth_denied');
  END IF;

  -- Lifecycle guard — can't cancel a circle that's already done.
  IF v_circle_row.status = 'completed' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error',   'already_completed',
      'message', 'circle has already run to completion; cancel not allowed'
    );
  END IF;
  IF v_circle_row.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'circle_id', p_circle_id,
      'members_refunded', 0,
      'total_refunded_cents', 0
    );
  END IF;

  -- Aggregate paid contributions per user across both source tables.
  -- The CTE de-duplicates the union so a member is one row regardless
  -- of which table their contribution landed in. amount is NUMERIC
  -- dollars in both tables; sum then convert to cents once.
  FOR v_refund_row IN
    WITH paid_by_user AS (
      SELECT user_id, SUM(amount) AS total_dollars
        FROM (
          SELECT user_id, amount
            FROM public.circle_contributions
           WHERE circle_id = p_circle_id AND status = 'paid'
          UNION ALL
          SELECT user_id, amount
            FROM public.contributions
           WHERE circle_id = p_circle_id AND status = 'paid'
        ) src
       GROUP BY user_id
       HAVING SUM(amount) > 0
    )
    SELECT user_id, total_dollars FROM paid_by_user
  LOOP
    v_amount_cents := ROUND(v_refund_row.total_dollars * 100)::BIGINT;

    -- Auto-provision wallet + lock the row. Same pattern as mig 304.
    SELECT id, main_balance_cents INTO v_wallet_id, v_balance_before
      FROM public.user_wallets
     WHERE user_id = v_refund_row.user_id
     FOR UPDATE;
    IF v_wallet_id IS NULL THEN
      INSERT INTO public.user_wallets (user_id, main_balance_cents)
      VALUES (v_refund_row.user_id, 0)
      RETURNING id, main_balance_cents INTO v_wallet_id, v_balance_before;
    END IF;

    UPDATE public.user_wallets
       SET main_balance_cents = main_balance_cents + v_amount_cents,
           last_activity_at   = NOW()
     WHERE id = v_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    )
    VALUES (
      v_wallet_id, v_refund_row.user_id, 'circle_cancellation_refund', 'credit',
      v_amount_cents, 'main',
      v_balance_before, v_balance_before + v_amount_cents,
      'circle', p_circle_id,
      'Refund for cancelled circle: ' || COALESCE(v_circle_row.name, ''),
      'completed',
      jsonb_build_object(
        'circle_id',     p_circle_id,
        'cancelled_by',  v_caller,
        'is_admin',      v_is_admin,
        'total_dollars', v_refund_row.total_dollars
      )
    )
    RETURNING id INTO v_refund_wt_id;

    -- Mark contributions refunded across both tables. Both use 'refunded'
    -- as a valid status (CHECK on circle_contributions + enum on
    -- contributions, both extended in mig 309).
    UPDATE public.circle_contributions
       SET status = 'refunded'
     WHERE circle_id = p_circle_id
       AND user_id = v_refund_row.user_id
       AND status = 'paid';

    UPDATE public.contributions
       SET status = 'refunded',
           updated_at = NOW()
     WHERE circle_id = p_circle_id
       AND user_id = v_refund_row.user_id
       AND status = 'paid';

    v_members_refunded := v_members_refunded + 1;
    v_total_cents      := v_total_cents + v_amount_cents;
  END LOOP;

  -- Flip circle to cancelled. Use end_date as the cancellation
  -- timestamp — circles has no dedicated cancelled_at column (only
  -- end_date, which is otherwise unused in the cancellation flow).
  UPDATE public.circles
     SET status     = 'cancelled',
         end_date   = NOW()::DATE,
         updated_at = NOW()
   WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'success',              TRUE,
    'circle_id',            p_circle_id,
    'members_refunded',     v_members_refunded,
    'total_refunded_cents', v_total_cents,
    'cancelled_by',         v_caller,
    'is_admin',             v_is_admin
  );

EXCEPTION WHEN OTHERS THEN
  -- On any failure the transaction rolls back to before the RPC ran.
  -- Return the error so the admin UI can surface it.
  RETURN jsonb_build_object(
    'success', FALSE,
    'error',   'rpc_failed',
    'detail',  LEFT(SQLERRM, 500)
  );
END;
$function$;

-- Callable by authenticated users; body enforces admin-or-creator check.
GRANT EXECUTE ON FUNCTION public.cancel_circle(uuid) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '317',
  'cancel_circle_rpc',
  ARRAY['-- 317: cancel_circle RPC — admin/creator triggered, refunds all paid contributions']
)
ON CONFLICT (version) DO NOTHING;
