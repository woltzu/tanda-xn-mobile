-- ═══════════════════════════════════════════════════════════════════════════
-- 389_chargeback_console.sql — Stripe chargeback management console
--
-- Extends the pre-existing stripe_disputes table (dead scaffolding until
-- now) with the fields the chargeback flow needs, adds account-freeze
-- columns on profiles, and wires four admin RPCs the console screen calls.
--
-- Also opens the door for stripe-webhook to write dispute rows (the EF
-- changes ship separately in the same commit).
--
-- Existing RLS on stripe_disputes (kept untouched):
--   • Members can view their own disputes  → auth.uid() = member_id
--   • Platform admins can view all         → is_platform_admin()   ← legacy
--   • Service role full access
-- We add a new "Admins can view all" policy alongside using the correct
-- admin_users role gate. Policies are additive under RLS OR semantics, so
-- both coexist without regression.
--
-- Screen: AdminChargebackConsoleScreen (client, ships with commit 2).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. stripe_disputes: extend schema ────────────────────────────────────
ALTER TABLE stripe_disputes
  ADD COLUMN IF NOT EXISTS circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_urls TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS frozen_account BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_text TEXT;

-- UNIQUE on stripe_dispute_id (needed for webhook upsert idempotency).
-- Guarded because ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stripe_disputes_stripe_dispute_id_unique'
      AND conrelid = 'public.stripe_disputes'::regclass
  ) THEN
    ALTER TABLE stripe_disputes
      ADD CONSTRAINT stripe_disputes_stripe_dispute_id_unique
      UNIQUE (stripe_dispute_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS stripe_disputes_status_created_idx
  ON stripe_disputes (status, created_at DESC);
CREATE INDEX IF NOT EXISTS stripe_disputes_circle_id_idx
  ON stripe_disputes (circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS stripe_disputes_member_id_idx
  ON stripe_disputes (member_id, created_at DESC);

-- ─── 2. profiles: account-freeze columns ──────────────────────────────────
-- Separate from suspended_until (which is a temporal cool-down). Freeze =
-- indefinite, admin-triggered, chargeback-linked. Cleared explicitly via
-- admin_unfreeze_account. account_frozen_by is the admin's auth.users.id.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_frozen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS account_frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS account_frozen_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_account_frozen_at_idx
  ON profiles (account_frozen_at) WHERE account_frozen_at IS NOT NULL;

-- ─── 3. Additive admin RLS on stripe_disputes ─────────────────────────────
-- The existing "Platform admins can view all disputes" policy uses the
-- legacy is_platform_admin() function whose role check ('platform_admin')
-- doesn't match any live admin_users.role. Rather than mutate the legacy
-- policy (which would risk regressing whatever code path expects it), add
-- a parallel policy keyed on the correct role gate.
DROP POLICY IF EXISTS "Admins can view all stripe disputes" ON stripe_disputes;
CREATE POLICY "Admins can view all stripe disputes"
  ON stripe_disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
        AND admin_users.is_active = TRUE
        AND admin_users.role IN ('super_admin', 'admin')
    )
  );

-- ─── 4. Admin helper: notify all active admins of a new chargeback ────────
-- Internal helper called from within the webhook path (not user-facing).
-- SECURITY DEFINER so it can INSERT into notifications regardless of the
-- caller's own privileges. Idempotency: relies on the webhook itself
-- being called once per Stripe event (stripe_webhook_events UNIQUE on
-- stripe_event_id already guarantees this at the outer layer).
CREATE OR REPLACE FUNCTION notify_admins_new_chargeback(p_dispute_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dispute stripe_disputes%ROWTYPE;
  v_amount_dollars NUMERIC;
  v_member_name TEXT;
  v_inserted INT := 0;
BEGIN
  SELECT * INTO v_dispute FROM stripe_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN
    RAISE WARNING 'notify_admins_new_chargeback: dispute % not found', p_dispute_id;
    RETURN 0;
  END IF;

  SELECT full_name INTO v_member_name FROM profiles WHERE id = v_dispute.member_id;
  v_amount_dollars := (v_dispute.amount_cents::NUMERIC) / 100;

  INSERT INTO notifications (user_id, type, title, body, data)
  SELECT
    au.user_id,
    'chargeback.new',
    'New chargeback filed',
    format(
      '%s disputed $%s (%s). Evidence due %s.',
      COALESCE(v_member_name, 'A member'),
      to_char(v_amount_dollars, 'FM999,999,990.00'),
      COALESCE(v_dispute.reason, 'unknown reason'),
      COALESCE(to_char(v_dispute.evidence_due_by, 'YYYY-MM-DD HH24:MI TZ'), 'unspecified')
    ),
    jsonb_build_object(
      'dispute_id', v_dispute.id,
      'stripe_dispute_id', v_dispute.stripe_dispute_id,
      'amount_cents', v_dispute.amount_cents,
      'member_id', v_dispute.member_id,
      'circle_id', v_dispute.circle_id,
      'evidence_due_by', v_dispute.evidence_due_by
    )
  FROM admin_users au
  WHERE au.is_active = TRUE
    AND au.role IN ('super_admin', 'admin');

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION notify_admins_new_chargeback(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION notify_admins_new_chargeback(UUID) TO service_role;

-- ─── 5. RPC: get_chargeback_dashboard() ───────────────────────────────────
-- Returns open + recently-closed disputes with impact info. Admin-only.
-- Ordering: needs_response first (deadline-sorted asc — nearest due
-- surfaces first), then under_review by responded_at desc, then resolved
-- last. Screen filters/collapses closed rows client-side.
CREATE OR REPLACE FUNCTION get_chargeback_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('super_admin', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_out ORDER BY row_out->>'sort_key')
    FROM (
      SELECT jsonb_build_object(
        'dispute_id',           sd.id,
        'stripe_dispute_id',    sd.stripe_dispute_id,
        'status',               sd.status,
        'reason',               sd.reason,
        'amount_cents',         sd.amount_cents,
        'currency',             sd.currency,
        'evidence_due_by',      sd.evidence_due_by,
        'hours_until_deadline', CASE
          WHEN sd.evidence_due_by IS NULL THEN NULL
          ELSE EXTRACT(EPOCH FROM (sd.evidence_due_by - NOW())) / 3600
        END,
        'evidence_submitted',   sd.evidence_submitted,
        'evidence_urls',        sd.evidence_urls,
        'admin_notes',          sd.admin_notes,
        'responded_at',         sd.responded_at,
        'resolved_at',          sd.resolved_at,
        'frozen_account',       sd.frozen_account,
        'created_at',           sd.created_at,
        'member_id',            sd.member_id,
        'member_full_name',     p.full_name,
        'member_email',         p.email,
        'member_frozen_at',     p.account_frozen_at,
        'circle_id',            sd.circle_id,
        'circle_name',          c.name,
        'circle_active_members',(
          SELECT COUNT(*) FROM circle_members cm
          WHERE cm.circle_id = sd.circle_id AND cm.status = 'active'
        ),
        'stripe_pi_text',       sd.stripe_payment_intent_text,
        'sort_key', CASE
          WHEN sd.status IN ('needs_response','warning_needs_response')
            THEN '1_' || COALESCE(to_char(sd.evidence_due_by, 'YYYYMMDDHH24MI'), '999999999999')
          WHEN sd.status IN ('under_review','warning_under_review')
            THEN '2_' || to_char(COALESCE(sd.responded_at, sd.created_at), 'YYYYMMDDHH24MI')
          ELSE '3_' || to_char(sd.created_at, 'YYYYMMDDHH24MI')
        END
      ) AS row_out
      FROM stripe_disputes sd
      LEFT JOIN profiles p ON p.id = sd.member_id
      LEFT JOIN circles c ON c.id = sd.circle_id
      WHERE sd.created_at > NOW() - INTERVAL '180 days'
      ORDER BY sd.created_at DESC
      LIMIT 500
    ) AS ordered
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION get_chargeback_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_chargeback_dashboard() TO authenticated;

-- ─── 6. RPC: admin_respond_to_chargeback ──────────────────────────────────
-- Records evidence URLs + notes, flips status to under_review, stamps
-- responded_at. Does NOT push the evidence to Stripe — that's a separate
-- operational step (Dashboard or a future EF). This is the DB-side log
-- of what evidence was assembled.
CREATE OR REPLACE FUNCTION admin_respond_to_chargeback(
  p_dispute_id UUID,
  p_evidence_urls TEXT[],
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_admin_id UUID := auth.uid();
  v_dispute stripe_disputes%ROWTYPE;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = v_admin_id AND is_active = TRUE
      AND role IN ('super_admin', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = '42501';
  END IF;

  IF p_evidence_urls IS NULL OR array_length(p_evidence_urls, 1) IS NULL THEN
    RAISE EXCEPTION 'evidence_urls_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_dispute FROM stripe_disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_dispute.status IN ('won', 'lost', 'charge_refunded', 'warning_closed') THEN
    RAISE EXCEPTION 'dispute_already_closed' USING ERRCODE = '22023';
  END IF;

  UPDATE stripe_disputes SET
    evidence_urls      = p_evidence_urls,
    evidence_submitted = TRUE,
    admin_notes        = COALESCE(p_notes, admin_notes),
    responded_at       = NOW(),
    status             = CASE
      WHEN status IN ('warning_needs_response') THEN 'warning_under_review'
      ELSE 'under_review'
    END,
    updated_at         = NOW()
  WHERE id = p_dispute_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id,
    'chargeback.respond',
    'stripe_dispute',
    p_dispute_id,
    jsonb_build_object(
      'evidence_urls', p_evidence_urls,
      'notes', p_notes,
      'stripe_dispute_id', v_dispute.stripe_dispute_id,
      'prior_status', v_dispute.status
    )
  );

  RETURN jsonb_build_object('success', TRUE, 'dispute_id', p_dispute_id);
END;
$$;

REVOKE ALL ON FUNCTION admin_respond_to_chargeback(UUID, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_respond_to_chargeback(UUID, TEXT[], TEXT) TO authenticated;

-- ─── 7. RPC: admin_freeze_account ─────────────────────────────────────────
-- Stamps account_frozen_at + reason + admin_id. Idempotent — repeat calls
-- update the reason and refresh the timestamp. Logs to admin_audit_log.
-- If p_dispute_id is provided, also flips the dispute's frozen_account flag
-- so the console shows the freeze happened as part of dispute handling.
CREATE OR REPLACE FUNCTION admin_freeze_account(
  p_user_id UUID,
  p_reason TEXT,
  p_dispute_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id, 'frozen_at', NOW());
END;
$$;

REVOKE ALL ON FUNCTION admin_freeze_account(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_freeze_account(UUID, TEXT, UUID) TO authenticated;

-- ─── 8. RPC: admin_unfreeze_account ───────────────────────────────────────
-- Clears the freeze columns. Logs to admin_audit_log with the previous
-- reason so the audit trail preserves what the freeze was for.
CREATE OR REPLACE FUNCTION admin_unfreeze_account(
  p_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION admin_unfreeze_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_unfreeze_account(UUID, TEXT) TO authenticated;

-- ─── 9. Self-register ─────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '389',
  'chargeback_console',
  ARRAY['-- 389: chargeback_console']
)
ON CONFLICT (version) DO NOTHING;
