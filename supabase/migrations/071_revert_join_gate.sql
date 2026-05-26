-- ============================================================================
-- Migration 071: Revert the Stage 1 Connect onboarding gate from migration 069
-- ============================================================================
-- Migration 069 added a 17-line gate to complete_circle_join that returned
-- 'connect_not_ready' if the joiner had no completed Stripe Connect account.
-- That gate was correctly applied to production (verified via pg_get_functiondef
-- and schema_migrations registration), but the design was reconsidered after
-- the gate's first device smoke test:
--
--   1. New-member friction: forcing Connect onboarding at join time penalises
--      conversion for members whose payout turn is many rounds away in the
--      tontine rotation.
--   2. Just-in-time alternative: the same EXISTS check (onboarding_status =
--      'complete' AND payouts_enabled = true) can run at payout-issuance time,
--      blocking only the specific payout that needs Connect, not the join.
--   3. Side-discovery during investigation: 7 of 9 user-facing join paths
--      bypass complete_circle_join entirely via a client-side INSERT into
--      circle_members (CirclesContext.tsx joinCircle()). The gate only ever
--      covered 2 of 9 paths anyway. Consolidating to a single chokepoint is
--      tracked in docs/audit/28_consolidate_join_paths.md as a required
--      Stage-4 prerequisite.
--
-- This migration restores complete_circle_join to its pre-069 body — byte-
-- identical to the live function definition recorded in
-- docs/audit/11_live_schema_dump.sql before migration 069 was applied. The
-- only change vs. the 069-applied form is the removal of the 17-line gate
-- block between the email-mismatch check and the SELECT name, amount lookup.
--
-- See also:
--   docs/audit/27_join_gate_revert_decision.md  (design decision record)
--   docs/audit/28_consolidate_join_paths.md     (Stage-4 prerequisite)
--   supabase/migrations/070_stripe_connected_accounts_event_ordering.sql
--     (kept — still needed for webhook idempotency)
-- ============================================================================

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

-- Self-register so applying this file is sufficient — registration cannot be
-- skipped by a manual deploy step. Lesson from 071's first deploy: the
-- CREATE OR REPLACE applied via SQL Editor / sql_run.py but the
-- schema_migrations row never landed, producing inverse drift (live change
-- but unrecorded). ON CONFLICT keeps the file idempotent so it can be
-- re-applied safely. This pattern is now the repo convention for every new
-- migration — see CLAUDE.md "Migration conventions".
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '071',
  'revert_join_gate',
  ARRAY['-- 071: revert_join_gate']
)
ON CONFLICT (version) DO NOTHING;
