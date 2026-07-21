-- ═══════════════════════════════════════════════════════════════════════════
-- 373_closing_admin_read_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 38 admin-UI read RPCs. Two functions the correction/closing screens
-- need which the client cannot get directly:
--
--   * get_circle_invariant(circle_id) — same invariant compute as
--     close_circle but read-only. Returns the diff without attempting
--     to close. Used by the invariant status card on every admin view
--     of CircleDetail + by AdminReconciliationScreen's per-row net
--     display.
--
--   * list_circle_ledger_events(circle_id) — ledger_events RLS is
--     service_role only (mig 276), so admins can't SELECT it from the
--     client. This RPC returns the correction-relevant subset scoped
--     to a single circle so CorrectionModal can present a picker of
--     eligible originals.
--
-- Both admin-gated via `admin_users.is_active = TRUE` check on
-- auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. get_circle_invariant ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_circle_invariant(p_circle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id    UUID := auth.uid();
  v_circle      RECORD;
  v_contribs    NUMERIC := 0;
  v_payouts     NUMERIC := 0;
  v_corrections NUMERIC := 0;
  v_net_cents   BIGINT;
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

  SELECT id, name, status, closed_at INTO v_circle
    FROM public.circles WHERE id = p_circle_id;
  IF v_circle.id IS NULL THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_contribs
    FROM public.circle_contributions
   WHERE circle_id = p_circle_id AND status = 'paid';
  SELECT COALESCE(SUM(amount), 0) INTO v_payouts
    FROM public.circle_payouts
   WHERE circle_id = p_circle_id AND status = 'completed';
  SELECT COALESCE(SUM(amount_cents), 0) / 100.0 INTO v_corrections
    FROM public.ledger_events
   WHERE circle_id = p_circle_id AND event_type = 'correction';

  v_net_cents := ROUND((v_contribs - v_payouts + v_corrections) * 100)::BIGINT;

  RETURN jsonb_build_object(
    'circle_id',           p_circle_id,
    'circle_name',         v_circle.name,
    'status',              v_circle.status,
    'closed_at',           v_circle.closed_at,
    'contributions_total', v_contribs,
    'payouts_total',       v_payouts,
    'corrections_total',   v_corrections,
    'net_cents',           v_net_cents,
    'balanced',            ABS(v_net_cents) <= 1,
    'can_close',           v_circle.status IN ('completed','payout_complete','active')
                           AND ABS(v_net_cents) <= 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_circle_invariant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_circle_invariant(UUID) TO authenticated;

-- ─── 2. list_circle_ledger_events ───────────────────────────────────────
-- Returns ledger events tied to a circle, plus a companion column
-- indicating whether the row itself is a correction (so the UI can
-- disable "correct this" for existing corrections if desired).

CREATE OR REPLACE FUNCTION public.list_circle_ledger_events(p_circle_id UUID)
RETURNS TABLE (
  id                     UUID,
  event_type             TEXT,
  amount_cents           BIGINT,
  currency               TEXT,
  external_reference_id  UUID,
  external_reference_type TEXT,
  stripe_event_id        TEXT,
  created_at             TIMESTAMPTZ,
  is_correction          BOOLEAN,
  metadata               JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
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

  RETURN QUERY
  SELECT le.id,
         le.event_type,
         le.amount_cents::BIGINT,
         le.currency,
         le.external_reference_id,
         le.external_reference_type,
         le.stripe_event_id,
         le.created_at,
         (le.event_type = 'correction')::BOOLEAN,
         le.metadata
    FROM public.ledger_events le
   WHERE le.circle_id = p_circle_id
   ORDER BY le.created_at DESC
   LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_circle_ledger_events(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_circle_ledger_events(UUID) TO authenticated;

-- ─── 3. Self-register ────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '373',
  'closing_admin_read_rpcs',
  ARRAY['-- 373: get_circle_invariant + list_circle_ledger_events RPCs']
)
ON CONFLICT (version) DO NOTHING;
