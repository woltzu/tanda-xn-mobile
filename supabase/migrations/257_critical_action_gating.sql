-- ═══════════════════════════════════════════════════════════════════════════
-- 257: Critical tier action gating — block financial/trust actions
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Governance principle: members at member_tier_status.current_tier = 'critical'
-- can VIEW the app and CONTACT SUPPORT, but cannot perform any financial or
-- trust action until they resolve their status via the Resolution Center
-- (migration 249).
--
-- Pieces:
--   1. can_perform_action(user_id, action_type) — boolean, IMMUTABLE-ish
--      classifier. Returns FALSE only when the user's current tier is
--      'critical'; all other tiers (or missing rows) return TRUE.
--   2. enforce_action_permission(user_id, action_type) — RAISEs if blocked.
--   3. vouch_member — gated at top by injecting the enforce call into the
--      EXISTING migration-252 body (NOT replacing). Preserves: tier whitelist,
--      backing-cap check, audit-log write, soft-expire of prior vouch.
--   4. Four BEFORE INSERT triggers on the tables that back the flows the
--      spec described as RPCs but which are actually direct-write paths:
--        a. circle_contributions       (action 'contribute')
--        b. payout_requests            (action 'request_payout')
--        c. withdrawal_requests        (action 'withdraw')
--        d. circle_invitations         (action 'invite')
--      Trigger-level gating is correct for these because no RPC exists to
--      inject into — contributions land via Stripe webhook → table write,
--      invites/withdrawals via direct PostgREST inserts. A trigger gates
--      ALL entry points uniformly.
--
-- Spec deviations (verified before writing):
--   • Registry insert wrong table (recurring). Corrected.
--   • Spec creates contribute_to_circle / request_payout / withdraw_from_
--     _wallet / invite_member RPCs as empty stubs ("rest of logic — keep
--     existing"). VERIFIED: none of those RPCs exist in prod
--     (pg_proc query). Creating them as empty stubs would either do
--     nothing (no caller invokes them) or, if any client mistakenly
--     called them, silently drop the write. Pivoted to trigger-based
--     gating on the real tables.
--   • Spec's vouch_member REPLACE would erase migration 252's body
--     (tier whitelist, backing cap, audit log, soft-expire). Injected
--     the enforce call as the first statement and kept the rest verbatim.
--   • Tier 4 hardening (SET search_path) added.
--   • Vote-on-dispute gating skipped — no dispute RPC or table surface
--     exists yet (spec called it a placeholder).
--
-- Attack-surface caveat: triggers gate the WRITER, but a critical
-- member's writes are blocked regardless of caller. The same trigger
-- function fires for elder-impersonating or admin paths — by design,
-- since the policy is "the critical member cannot have their funds move."
-- If a future workflow needs an elder to push a payout on a critical
-- member's behalf (e.g. forced restitution), this gate will need a bypass.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. can_perform_action — classifier. Returns FALSE only for tier='critical'.
--    Missing rows / unknown tiers are treated as "allowed" (least surprising
--    default — a brand-new user before tier assignment shouldn't be locked
--    out). This is the same posture the Bucket B Resolution Center uses.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_perform_action(
  p_user_id     UUID,
  p_action_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tier TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT current_tier INTO v_tier
  FROM member_tier_status
  WHERE user_id = p_user_id;

  -- Critical = blocked from every action_type. Other tiers (or no row) = allowed.
  -- p_action_type is reserved for future per-action policy carve-outs
  -- (e.g. "withdraw blocked but invite allowed") — accepted now for
  -- forward-compat, not yet inspected.
  RETURN COALESCE(v_tier, 'newcomer') <> 'critical';
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. enforce_action_permission — RAISE shim around can_perform_action.
--    Error message is matched on the client (see lib/critical_messages.ts)
--    to surface the Resolution Center deeplink in toasts.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_action_permission(
  p_user_id     UUID,
  p_action_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT can_perform_action(p_user_id, p_action_type) THEN
    RAISE EXCEPTION 'critical_account_restricted: action % blocked. Resolve via Resolution Center to continue.', p_action_type
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. vouch_member — inject the gate into the existing migration-252 body.
--    Body below is migration 252's body verbatim with the PERFORM added as
--    the first statement after authentication check.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION vouch_member(
  p_member_id            UUID,
  p_temporary_tier       TEXT,
  p_backing_amount_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_elder_id    UUID := auth.uid();
  v_elder_role  TEXT;
  v_max_backing INTEGER;
  v_vouch_id    UUID;
BEGIN
  IF v_elder_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 257 GATE: critical elders cannot vouch.
  PERFORM enforce_action_permission(v_elder_id, 'vouch');

  IF p_member_id = v_elder_id THEN
    RAISE EXCEPTION 'Cannot vouch for yourself';
  END IF;

  SELECT role INTO v_elder_role FROM profiles WHERE id = v_elder_id;
  IF v_elder_role IS NULL OR v_elder_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can vouch for members';
  END IF;

  IF p_temporary_tier NOT IN ('newcomer','established','elder','critical') THEN
    RAISE EXCEPTION 'Invalid tier: %', p_temporary_tier;
  END IF;

  IF p_backing_amount_cents IS NULL OR p_backing_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Backing amount must be positive';
  END IF;

  SELECT max_backing_cents INTO v_max_backing FROM profiles WHERE id = v_elder_id;
  IF p_backing_amount_cents > COALESCE(v_max_backing, 0) THEN
    RAISE EXCEPTION 'Backing amount exceeds your limit of $%',
      (COALESCE(v_max_backing, 0) / 100);
  END IF;

  -- Soft-expire any prior active vouch for the same member so this elder
  -- always replaces the prior backing rather than stacking it.
  UPDATE exposure_vouches
  SET expires_at = NOW()
  WHERE member_id = p_member_id AND expires_at > NOW();

  INSERT INTO exposure_vouches (
    elder_id, member_id, temporary_tier, expires_at, backing_amount_cents
  )
  VALUES (
    v_elder_id, p_member_id, p_temporary_tier,
    NOW() + INTERVAL '30 days', p_backing_amount_cents
  )
  RETURNING id INTO v_vouch_id;

  INSERT INTO vouch_audit_log (elder_id, member_id, action, temporary_tier, backing_amount_cents)
  VALUES (v_elder_id, p_member_id, 'created', p_temporary_tier, p_backing_amount_cents);

  RETURN v_vouch_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4a. BEFORE INSERT trigger on circle_contributions — gates 'contribute'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_block_critical_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM enforce_action_permission(NEW.user_id, 'contribute');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_critical_contribution ON circle_contributions;
CREATE TRIGGER tr_block_critical_contribution
BEFORE INSERT ON circle_contributions
FOR EACH ROW EXECUTE FUNCTION trg_block_critical_contribution();

-- ───────────────────────────────────────────────────────────────────────────
-- 4b. BEFORE INSERT trigger on payout_requests — gates 'request_payout'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_block_critical_payout_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM enforce_action_permission(NEW.user_id, 'request_payout');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_critical_payout_request ON payout_requests;
CREATE TRIGGER tr_block_critical_payout_request
BEFORE INSERT ON payout_requests
FOR EACH ROW EXECUTE FUNCTION trg_block_critical_payout_request();

-- ───────────────────────────────────────────────────────────────────────────
-- 4c. BEFORE INSERT trigger on withdrawal_requests — gates 'withdraw'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_block_critical_withdrawal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM enforce_action_permission(NEW.user_id, 'withdraw');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_critical_withdrawal ON withdrawal_requests;
CREATE TRIGGER tr_block_critical_withdrawal
BEFORE INSERT ON withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION trg_block_critical_withdrawal();

-- ───────────────────────────────────────────────────────────────────────────
-- 4d. BEFORE INSERT trigger on circle_invitations — gates 'invite'.
--     Attribution column is 'invited_by' (verified), not 'user_id'.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_block_critical_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM enforce_action_permission(NEW.invited_by, 'invite');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_block_critical_invitation ON circle_invitations;
CREATE TRIGGER tr_block_critical_invitation
BEFORE INSERT ON circle_invitations
FOR EACH ROW EXECUTE FUNCTION trg_block_critical_invitation();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '257',
  'critical_action_gating',
  ARRAY['-- 257: critical_action_gating']
)
ON CONFLICT (version) DO NOTHING;
