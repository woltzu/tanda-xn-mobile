-- ═══════════════════════════════════════════════════════════════════════════
-- 379_payout_console_backend.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 39 Phase 1 — Payout Console backend. Adds admin operational control
-- (per-payout hold, per-circle approval gate, platform-wide pause) while
-- preserving the ledger's append-only guarantee.
--
-- Boundaries (from Doc 39):
--   CAN — pause, hold, gate, kill-switch (timing/execution control).
--   CANNOT — change recipient / amount / order / bypass ledger. Amount and
--   recipient changes remain the exclusive job of Doc 38's apply_correction.
--
-- Structure of this migration:
--   1. payout_status ENUM (additive superset per user decision — includes
--      every value the existing CHECK covered plus the new states).
--   2. circle_payouts column shape — status re-typed, hold/release/approval
--      columns added. Existing 8 rows (all status='completed') convert
--      cleanly via the USING cast.
--   3. circles.payouts_require_approval column.
--   4. Four admin RPCs: hold_payout, release_payout, set_circle_approval_mode,
--      toggle_platform_pause. All SECURITY DEFINER with admin_users gates.
--   5. execute_cycle_payout rewrite — three checks at the top (platform pause,
--      held/awaiting_approval status, circle approval mode). Preserves
--      existing body byte-identically after the check block.
--   6. should_auto_trigger_payout rewrite — same three predicates so the
--      webhook path refuses cleanly during pause/hold/gate.
--
-- Ledger events written with the Doc 38 synthetic stripe_event_id pattern
-- (`tandaxn.internal:payout.held:<uuid>` etc.) so the UNIQUE NOT NULL
-- constraint on ledger_events.stripe_event_id is satisfied without a
-- schema change. All circle-scoped events are already blocked on closed
-- circles by mig 372's trigger — the RPCs also pre-check for a friendly
-- error before hitting the trigger.
--
-- Deferrals to later phases:
--   * 2FA gate on toggle_platform_pause — skipped per user Q1 (Phase 1
--     uses a strong client confirmation modal + admin gate; server RPC
--     only enforces super_admin role).
--   * EF-level webhook change that inserts awaiting_approval rows when
--     require_approval=TRUE on a circle whose contributions completed —
--     Phase 3. As an MVP bridge, execute_cycle_payout in this migration
--     inserts the awaiting_approval row inline when it refuses due to
--     approval mode, so the admin console has something to approve
--     without waiting for Phase 3.
--
-- platform_settings.payouts_paused* columns were pre-provisioned in mig
-- 376's platform_settings creation. This migration only implements the
-- RPCs against them.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. payout_status ENUM ────────────────────────────────────────────────
-- Prior migration (in mig 019 or thereabouts) already created public
-- .payout_status as ENUM('scheduled','pending','processing','completed',
-- 'failed') for the `payouts` table's `status` column. Use ALTER TYPE
-- ADD VALUE IF NOT EXISTS for each missing value so the type ends up as
-- the additive superset per user decision.
--
-- Postgres 15+ constraint: new ENUM values added via ALTER TYPE ADD VALUE
-- inside a transaction cannot be used until AFTER the transaction commits.
-- This migration is therefore applied in two calls: first the ALTER TYPE
-- statements alone, then everything else (which uses the new values).
-- Both apply-passes are idempotent — ADD VALUE IF NOT EXISTS is a no-op
-- if the value already exists, and every downstream ALTER / CREATE uses
-- IF NOT EXISTS or CREATE OR REPLACE.
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'held';
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'awaiting_approval';
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'executing';
ALTER TYPE public.payout_status ADD VALUE IF NOT EXISTS 'reversed';

-- ─── 2. circle_payouts — status ENUM + hold/release/approval columns ──────
-- Drop the old CHECK constraint (which references the text-typed values)
-- before we re-type the column. Column data itself is preserved by the
-- USING cast; the 8 existing 'completed' rows convert without loss.
DO $$
DECLARE v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'circle_payouts'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ILIKE '%status%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.circle_payouts DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

-- Drop dependencies of the status column before re-typing:
--   * text-typed default ('scheduled'::text) — restored ENUM-typed below.
--   * circle_payouts_notify trigger — recreated identically below. The
--     trigger function notify_payout_received() compares NEW.status to
--     'completed' as a string literal; Postgres coerces the literal to
--     the ENUM automatically, so the function body needs no change.
DROP TRIGGER IF EXISTS circle_payouts_notify ON public.circle_payouts;

ALTER TABLE public.circle_payouts
  ALTER COLUMN status DROP DEFAULT;

-- Type conversion. Any writer that would emit a string outside the ENUM
-- would fail here — none do at the moment (all live values are 'completed').
ALTER TABLE public.circle_payouts
  ALTER COLUMN status TYPE public.payout_status
  USING status::text::public.payout_status;

-- Restore the default, now ENUM-typed.
ALTER TABLE public.circle_payouts
  ALTER COLUMN status SET DEFAULT 'scheduled'::public.payout_status;

-- Recreate the trigger identically (only the column TYPE changed; the
-- trigger def references status by name, unchanged).
CREATE TRIGGER circle_payouts_notify
  AFTER INSERT OR UPDATE OF status ON public.circle_payouts
  FOR EACH ROW EXECUTE FUNCTION public.notify_payout_received();

-- New columns. All nullable — an unheld / unapproved payout has NULLs and
-- that's fine. Naming follows mig 376/377 pattern (`_by_admin_id` suffix
-- for FKs to auth.users).
ALTER TABLE public.circle_payouts
  ADD COLUMN IF NOT EXISTS held_at                       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_by_admin_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_reason                   TEXT,
  ADD COLUMN IF NOT EXISTS hold_justification            TEXT,
  ADD COLUMN IF NOT EXISTS released_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by_admin_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_granted_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_granted_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for admin console queries that list held payouts.
CREATE INDEX IF NOT EXISTS idx_circle_payouts_held
  ON public.circle_payouts(circle_id, held_at DESC)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_circle_payouts_awaiting_approval
  ON public.circle_payouts(circle_id, created_at DESC)
  WHERE status = 'awaiting_approval';

-- ─── 3. circles.payouts_require_approval ──────────────────────────────────
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS payouts_require_approval BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 4a. hold_payout RPC ──────────────────────────────────────────────────
-- Admin-gated. Cycle-keyed (not payout_id-keyed) per Doc 39 §3.1 so an
-- admin can preempt a payout whose circle_payouts row hasn't been
-- materialized yet. If a row exists for the cycle, updates it in place;
-- if not, inserts a new stub with status='held'.
--
-- Refuses if the current row is already 'completed' or 'failed' or
-- 'cancelled' (idempotent-safe on the terminal states). Multiple concurrent
-- hold attempts serialize via FOR UPDATE on the circle_payouts row (or on
-- the circle_cycles row if no payout row exists yet).
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
  v_circle       RECORD;
  v_payout_id    UUID;
  v_prev_status  public.payout_status;
  v_event_id     UUID;
  v_notif_body   TEXT;
  v_default_body TEXT := 'Your payout is on a brief hold. Your money is safe with TandaXn. '
                      || 'A team member is verifying a routine detail before releasing your '
                      || 'payout. Most holds resolve within 24 hours — we''ll notify you as '
                      || 'soon as it''s released. No action is needed from you.';
BEGIN
  -- Admin gate.
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

  -- Input validation.
  IF p_reason_code IS NULL
     OR p_reason_code NOT IN ('investigation','webhook_delay','documentation_check','other') THEN
    RAISE EXCEPTION 'invalid_reason_code';
  END IF;
  IF p_justification IS NULL OR length(trim(p_justification)) < 20 THEN
    RAISE EXCEPTION 'justification_too_short';
  END IF;

  -- Lock the cycle row + verify circle not closed (mig 372 would block the
  -- ledger insert anyway, but explicit pre-check gives a clean error).
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

  -- Find any existing payout row for this cycle (LOCK it if present).
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
    -- No row yet — insert a stub. Minimal required fields; amount populated
    -- from cycle.payout_amount for downstream visibility.
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

  -- Ledger event. Synthetic stripe_event_id per Doc 38 pattern.
  v_event_id := gen_random_uuid();
  INSERT INTO public.ledger_events (
    stripe_event_id, event_type, amount_cents, currency,
    user_id, recipient_user_id, circle_id, cycle_id, metadata
  )
  VALUES (
    'tandaxn.internal:payout.held:' || v_event_id::text,
    'payout.held',
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

  -- Notification to the recipient. Best-effort — never blocks the hold.
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

-- ─── 4b. release_payout RPC ───────────────────────────────────────────────
-- Two-tier permission: (a) super_admin / platform_admin can release any
-- hold; (b) admin role can release only holds they themselves placed.
-- Doc 39 §3.1 Release: safe path — does NOT auto-execute. Flips status
-- back to 'scheduled' and lets the next cron tick or admin dispatch fire.
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
  v_approval_id UUID;
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

  -- Find + lock the held / awaiting_approval row.
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

  -- Permission: admin role can only release their own hold. Higher roles
  -- can release anything.
  IF v_admin_role = 'admin'
     AND v_payout.status = 'held'
     AND v_payout.held_by_admin_id IS DISTINCT FROM v_admin THEN
    RAISE EXCEPTION 'not_original_holder';
  END IF;

  -- Flip back to scheduled. Do NOT execute inline — next natural trigger
  -- fires the payout.
  UPDATE public.circle_payouts
     SET status                       = 'scheduled',
         released_at                  = NOW(),
         released_by_admin_id         = v_admin,
         approval_granted_at          = CASE WHEN v_payout.status = 'awaiting_approval'
                                             THEN NOW() ELSE approval_granted_at END,
         approval_granted_by_admin_id = CASE WHEN v_payout.status = 'awaiting_approval'
                                             THEN v_admin ELSE approval_granted_by_admin_id END
   WHERE id = v_payout.id;

  -- Ledger: payout.released always. If the release also grants approval,
  -- write a separate payout.approval_granted event so the audit trail
  -- shows both actions distinctly.
  v_event_id := gen_random_uuid();
  INSERT INTO public.ledger_events (
    stripe_event_id, event_type, amount_cents, currency,
    user_id, recipient_user_id, circle_id, cycle_id, metadata
  )
  VALUES (
    'tandaxn.internal:payout.released:' || v_event_id::text,
    'payout.released',
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
    v_approval_id := gen_random_uuid();
    INSERT INTO public.ledger_events (
      stripe_event_id, event_type, amount_cents, currency,
      user_id, recipient_user_id, circle_id, cycle_id, metadata
    )
    VALUES (
      'tandaxn.internal:payout.approval_granted:' || v_approval_id::text,
      'payout.approval_granted',
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

-- ─── 4c. set_circle_approval_mode RPC ─────────────────────────────────────
-- Toggles circles.payouts_require_approval. Does NOT retroactively re-gate
-- existing awaiting_approval rows (turning approval off is a policy change,
-- not a bulk approve).
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

  v_event_id := gen_random_uuid();
  INSERT INTO public.ledger_events (
    stripe_event_id, event_type, amount_cents, currency,
    user_id, circle_id, metadata
  )
  VALUES (
    'tandaxn.internal:circle.approval_mode_changed:' || v_event_id::text,
    'circle.approval_mode_changed',
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

-- ─── 4d. toggle_platform_pause RPC ────────────────────────────────────────
-- Single toggle covering activate + release per user Q1 (2FA deferred).
-- Server-side gate: super_admin only. Activation reason ≥ 50 chars per
-- Doc 39 §3.3 (higher bar than a per-payout hold — this is platform-scale).
-- Release reason optional (the rationale IS that the investigation ended).
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

  v_event_id := gen_random_uuid();
  IF p_activate THEN
    INSERT INTO public.ledger_events (
      stripe_event_id, event_type, amount_cents, currency, user_id, metadata
    )
    VALUES (
      'tandaxn.internal:payout.platform_pause_activated:' || v_event_id::text,
      'payout.platform_pause_activated',
      0, 'USD', v_admin,
      jsonb_build_object(
        'admin_user_id',   v_admin,
        'reason',          trim(p_reason),
        'twofa_verified',  FALSE
      )
    );
  ELSE
    INSERT INTO public.ledger_events (
      stripe_event_id, event_type, amount_cents, currency, user_id, metadata
    )
    VALUES (
      'tandaxn.internal:payout.platform_pause_released:' || v_event_id::text,
      'payout.platform_pause_released',
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

-- ─── 5. execute_cycle_payout — add three checks at the top ────────────────
-- Body preserved byte-identically from the pre-mig-379 live definition
-- except the new gate block. Three refusals:
--   a. platform_settings.payouts_paused = TRUE → error 'platform_paused'
--   b. circle_payouts row exists with status 'held' → error 'payout_held'
--   c. circle_payouts row exists with status 'awaiting_approval' →
--      error 'awaiting_approval'
--   d. circles.payouts_require_approval = TRUE AND no circle_payouts row
--      exists yet → insert an awaiting_approval stub inline and refuse.
--      This bridges Phase 1 → Phase 3: the console can approve without
--      waiting for the webhook-side EF change. Once Phase 3 lands, the
--      webhook will create the row first and this branch becomes a
--      no-op (row exists → caught by check (c) above).
CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  -- ═══ Doc 39 (mig 379) three-check gate ═══
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
  -- awaiting_approval stub so the console sees it — MVP bridge until
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
  -- ═══ End three-check gate ═══

  SELECT * INTO v_cycle FROM public.circle_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cycle_not_found');
  END IF;
  IF v_cycle.recipient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_recipient');
  END IF;

  -- Mig 361 — phantom-payout guard.
  IF COALESCE(v_cycle.collected_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_contributions_collected');
  END IF;

  -- Mig 365 — all-members-paid guard.
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
$$;

-- ─── 6. should_auto_trigger_payout — three new predicates ─────────────────
-- Body preserved from live except the three new gates. Extends the
-- existing 'live payout row' check to also cover 'held' and
-- 'awaiting_approval' statuses.
CREATE OR REPLACE FUNCTION public.should_auto_trigger_payout(
  p_circle_id UUID,
  p_cycle_number INTEGER
)
RETURNS TABLE(should_trigger BOOLEAN, cycle_id UUID, recipient_user_id UUID,
              payout_amount_cents INTEGER, stripe_connect_account_id TEXT,
              paid_count INTEGER, expected_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_status     TEXT;
  v_cycle_id          UUID;
  v_recipient         UUID;
  v_payout_amount     NUMERIC;
  v_stripe_account    TEXT;
  v_expected          INT;
  v_paid              INT;
  v_existing          INT;
  v_paused            BOOLEAN;
  v_require_approval  BOOLEAN;
BEGIN
  -- Doc 39: platform pause short-circuit.
  SELECT payouts_paused INTO v_paused FROM public.platform_settings WHERE id = 1;
  IF v_paused THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 0, NULL::TEXT, 0, 0;
    RETURN;
  END IF;

  -- Circle status gate — anything other than 'active' short-circuits.
  -- Also pull require_approval in the same query.
  SELECT c.status, c.payouts_require_approval
    INTO v_circle_status, v_require_approval
    FROM circles c WHERE c.id = p_circle_id;
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

  -- Doc 39: any live payout row blocks the auto-trigger. Extended from the
  -- pre-mig-379 set to include 'held' and 'awaiting_approval'.
  SELECT COUNT(*) INTO v_existing
  FROM circle_payouts cp
  WHERE cp.cycle_id = v_cycle_id
    AND cp.status IN ('scheduled', 'pending', 'processing', 'completed',
                      'held', 'awaiting_approval', 'ready', 'executing');

  -- Doc 39: if approval gate is on, refuse auto-trigger regardless.
  -- The webhook (Phase 3) will insert an awaiting_approval row separately.
  -- For MVP without Phase 3, execute_cycle_payout inserts the stub inline.
  IF v_require_approval THEN
    RETURN QUERY SELECT FALSE, v_cycle_id, v_recipient, 0, NULL::TEXT, 0, 0;
    RETURN;
  END IF;

  IF v_recipient IS NOT NULL THEN
    SELECT p.stripe_connect_account_id INTO v_stripe_account
    FROM profiles p WHERE p.id = v_recipient;
  END IF;

  SELECT COUNT(*) INTO v_expected
  FROM circle_members cm
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

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

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '379',
  'payout_console_backend',
  ARRAY['-- 379: payout_status ENUM + circle_payouts hold/approval columns + circles.payouts_require_approval + 4 admin RPCs (hold_payout, release_payout, set_circle_approval_mode, toggle_platform_pause) + execute_cycle_payout & should_auto_trigger_payout 3-check gate.']
)
ON CONFLICT (version) DO NOTHING;
