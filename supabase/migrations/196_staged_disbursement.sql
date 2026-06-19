-- ════════════════════════════════════════════════════════════════════════════
-- Migration 196: staged_disbursement
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2A — Dream Escrow / staged disbursement foundation. Replaces the
-- single lump-sum `process_goal_provider_payment` flow with a milestone-
-- by-milestone release.
--
-- Naming discriminator (vs the pre-existing `goal_milestones` celebration
-- table — see migration 078 / 181 / hooks/useGoalActions.ts): every new
-- object lives under `goal_disbursement_*` so the two milestone concepts
-- don't collide.
--
-- New tables:
--   - goal_disbursement_milestones        — the staged-payment work items
--   - goal_disbursement_milestone_verifications — pending verification request
--
-- Column additions:
--   - user_savings_goals.disbursement_type ('lump_sum' | 'staged')
--   - providers.max_project_value_cents (cap derived from verification_level)
--
-- Status state machine for milestones:
--   pending → in_progress (provider accepts, escrow locks)
--           → verification_requested (provider requests review)
--           → verified (elder/owner approves)
--           → released (auto, via trigger; money moves)
--           → failed (refunded — funds never deducted from goal)
--
-- The `verified → released` transition fires the payment trigger which
-- runs `process_disbursement_milestone_payment` and moves money atomically.
-- Notifications fan out on key transitions.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_milestone_status_enum') THEN
    CREATE TYPE public.disbursement_milestone_status_enum AS ENUM (
      'pending', 'in_progress', 'verification_requested',
      'verified', 'released', 'failed'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_escrow_status_enum') THEN
    CREATE TYPE public.disbursement_escrow_status_enum AS ENUM (
      'not_started', 'funds_reserved', 'funds_locked', 'released', 'refunded'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_verification_method_enum') THEN
    CREATE TYPE public.disbursement_verification_method_enum AS ENUM (
      'elder', 'document', 'admin', 'owner'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_verification_status_enum') THEN
    CREATE TYPE public.disbursement_verification_status_enum AS ENUM (
      'pending', 'approved', 'rejected'
    );
  END IF;
END$$;

-- ─── user_savings_goals.disbursement_type ───────────────────────────────
ALTER TABLE public.user_savings_goals
  ADD COLUMN IF NOT EXISTS disbursement_type TEXT NOT NULL DEFAULT 'lump_sum';

-- ─── providers.max_project_value_cents ──────────────────────────────────
-- Cap derived from verification_level. NULL = unlimited (Level 3).
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS max_project_value_cents BIGINT;

-- Maintain the cap automatically from verification_level. Admins can
-- override by UPDATEing the column directly afterward.
CREATE OR REPLACE FUNCTION public.set_provider_max_project_value()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.verification_level = 1 THEN
    NEW.max_project_value_cents := 100000;        -- $1,000
  ELSIF NEW.verification_level = 2 THEN
    NEW.max_project_value_cents := 500000;        -- $5,000
  ELSE
    NEW.max_project_value_cents := NULL;          -- Level 3 = unlimited
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_set_max_value ON public.providers;
CREATE TRIGGER providers_set_max_value
  BEFORE INSERT OR UPDATE OF verification_level ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_provider_max_project_value();

-- Backfill existing rows so the cap reflects their current level.
UPDATE public.providers SET verification_level = verification_level;

-- ─── goal_disbursement_milestones ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_disbursement_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.user_savings_goals(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  status public.disbursement_milestone_status_enum NOT NULL DEFAULT 'pending',
  verification_method public.disbursement_verification_method_enum NOT NULL DEFAULT 'owner',
  escrow_status public.disbursement_escrow_status_enum NOT NULL DEFAULT 'not_started',
  funds_reserved_at TIMESTAMPTZ,
  funds_locked_at TIMESTAMPTZ,
  provider_accepted_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  released_amount_cents BIGINT,
  retention_percent INTEGER NOT NULL DEFAULT 10 CHECK (retention_percent BETWEEN 0 AND 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (goal_id, order_index)
);
CREATE INDEX IF NOT EXISTS idx_disb_milestones_goal ON public.goal_disbursement_milestones (goal_id);
CREATE INDEX IF NOT EXISTS idx_disb_milestones_provider ON public.goal_disbursement_milestones (provider_id);

DROP TRIGGER IF EXISTS goal_disbursement_milestones_touch ON public.goal_disbursement_milestones;
CREATE TRIGGER goal_disbursement_milestones_touch
  BEFORE UPDATE ON public.goal_disbursement_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ─── goal_disbursement_milestone_verifications ──────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_disbursement_milestone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.goal_disbursement_milestones(id) ON DELETE CASCADE,
  requester_user_id UUID NOT NULL REFERENCES public.profiles(id),
  status public.disbursement_verification_status_enum NOT NULL DEFAULT 'pending',
  notes TEXT,
  responder_user_id UUID REFERENCES public.profiles(id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (milestone_id, status) DEFERRABLE INITIALLY DEFERRED
);
-- Index for the "pending verifications waiting on me" elder/owner queries.
CREATE INDEX IF NOT EXISTS idx_disb_verifications_status
  ON public.goal_disbursement_milestone_verifications (status);

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.goal_disbursement_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_disbursement_milestone_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gdm_select ON public.goal_disbursement_milestones;
CREATE POLICY gdm_select ON public.goal_disbursement_milestones
  FOR SELECT
  USING (
    -- Goal owner sees their own milestones, provider sees rows assigned
    -- to them, admins see all.
    EXISTS (SELECT 1 FROM public.user_savings_goals g WHERE g.id = goal_id AND g.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.providers p WHERE p.id = provider_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = TRUE)
  );

-- INSERTs / UPDATEs / DELETEs go through SECURITY DEFINER RPCs — block
-- direct writes from the client to keep the state machine clean.
DROP POLICY IF EXISTS gdm_no_direct_writes ON public.goal_disbursement_milestones;
CREATE POLICY gdm_no_direct_writes ON public.goal_disbursement_milestones
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS gdmv_select ON public.goal_disbursement_milestone_verifications;
CREATE POLICY gdmv_select ON public.goal_disbursement_milestone_verifications
  FOR SELECT
  USING (
    requester_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.goal_disbursement_milestones m
        JOIN public.user_savings_goals g ON g.id = m.goal_id
       WHERE m.id = milestone_id AND g.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS gdmv_no_direct_writes ON public.goal_disbursement_milestone_verifications;
CREATE POLICY gdmv_no_direct_writes ON public.goal_disbursement_milestone_verifications
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- ─── RPC: create_goal_disbursement_milestones ───────────────────────────
-- Goal owner attaches a provider and a list of milestones to a goal. Sum
-- of amounts must equal user_savings_goals.target_amount_cents. Flips
-- the goal to disbursement_type='staged'.
CREATE OR REPLACE FUNCTION public.create_goal_disbursement_milestones(
  p_goal_id UUID,
  p_provider_id UUID,
  p_milestones JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_goal RECORD;
  v_provider RECORD;
  v_sum BIGINT := 0;
  v_count INT := 0;
  v_ms JSONB;
  v_inserted_ids UUID[] := '{}'::UUID[];
  v_new_id UUID;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id, name, target_amount_cents, disbursement_type
    INTO v_goal FROM public.user_savings_goals WHERE id = p_goal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found';
  END IF;
  IF v_goal.user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the goal owner can set milestones' USING ERRCODE = '42501';
  END IF;

  -- Block re-staging once any milestone has moved past pending — the
  -- escrow state machine is in flight.
  IF EXISTS (
    SELECT 1 FROM public.goal_disbursement_milestones
     WHERE goal_id = p_goal_id AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Milestones already in progress for this goal — cannot re-stage';
  END IF;

  SELECT id, user_id, business_name, verification_status, is_active, max_project_value_cents
    INTO v_provider FROM public.providers WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found';
  END IF;
  IF v_provider.verification_status <> 'verified' OR NOT v_provider.is_active THEN
    RAISE EXCEPTION 'Provider is not currently accepting work';
  END IF;
  IF v_provider.max_project_value_cents IS NOT NULL
     AND v_goal.target_amount_cents > v_provider.max_project_value_cents THEN
    RAISE EXCEPTION 'Project exceeds provider verification-level cap';
  END IF;

  -- Validate JSONB and sum amounts.
  IF jsonb_typeof(p_milestones) <> 'array' OR jsonb_array_length(p_milestones) = 0 THEN
    RAISE EXCEPTION 'Milestones payload must be a non-empty array';
  END IF;

  FOR v_ms IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
    v_count := v_count + 1;
    v_sum := v_sum + COALESCE((v_ms->>'amount_cents')::BIGINT, 0);
  END LOOP;
  IF v_sum <> v_goal.target_amount_cents THEN
    RAISE EXCEPTION 'Sum of milestone amounts (%) must equal goal target (%)',
      v_sum, v_goal.target_amount_cents;
  END IF;

  -- Wipe any old pending rows then insert fresh. Pending-only check
  -- above guarantees no in-flight escrow is lost.
  DELETE FROM public.goal_disbursement_milestones
   WHERE goal_id = p_goal_id;

  FOR v_ms IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
    INSERT INTO public.goal_disbursement_milestones (
      goal_id, provider_id, name, description, order_index, amount_cents,
      verification_method, retention_percent
    ) VALUES (
      p_goal_id, p_provider_id,
      COALESCE(v_ms->>'name', 'Milestone'),
      v_ms->>'description',
      COALESCE((v_ms->>'order_index')::INT, 0),
      (v_ms->>'amount_cents')::BIGINT,
      COALESCE((v_ms->>'verification_method')::public.disbursement_verification_method_enum, 'owner'),
      COALESCE((v_ms->>'retention_percent')::INT, 10)
    )
    RETURNING id INTO v_new_id;
    v_inserted_ids := array_append(v_inserted_ids, v_new_id);
  END LOOP;

  UPDATE public.user_savings_goals
     SET disbursement_type = 'staged', updated_at = now()
   WHERE id = p_goal_id;

  -- Provider notification — they have new work.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_provider.user_id,
      'milestone_new_contract',
      'New project assigned',
      'You have ' || v_count::text || ' milestone(s) waiting on ' || COALESCE(v_goal.name, 'a goal') || '.',
      jsonb_build_object(
        'goal_id', p_goal_id,
        'provider_id', p_provider_id,
        'milestone_count', v_count
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'milestone_ids', to_jsonb(v_inserted_ids),
    'count', v_count
  );
END;
$$;

-- ─── RPC: accept_disbursement_milestone ─────────────────────────────────
-- Provider accepts the work. Escrow flips from not_started → funds_locked.
-- No money movement; funds remain in the goal until release.
CREATE OR REPLACE FUNCTION public.accept_disbursement_milestone(
  p_milestone_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_ms RECORD;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.status, p.user_id AS provider_user_id, m.goal_id
    INTO v_ms
    FROM public.goal_disbursement_milestones m
    JOIN public.providers p ON p.id = m.provider_id
   WHERE m.id = p_milestone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  IF v_ms.provider_user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the assigned provider can accept' USING ERRCODE = '42501';
  END IF;
  IF v_ms.status <> 'pending' THEN
    RAISE EXCEPTION 'Milestone is not pending';
  END IF;

  UPDATE public.goal_disbursement_milestones
     SET status = 'in_progress',
         escrow_status = 'funds_locked',
         provider_accepted_at = now(),
         funds_locked_at = now(),
         updated_at = now()
   WHERE id = p_milestone_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ─── RPC: request_disbursement_verification ─────────────────────────────
CREATE OR REPLACE FUNCTION public.request_disbursement_verification(
  p_milestone_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_ms RECORD;
  v_request_id UUID;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.id, m.status, p.user_id AS provider_user_id, m.goal_id, m.name
    INTO v_ms
    FROM public.goal_disbursement_milestones m
    JOIN public.providers p ON p.id = m.provider_id
   WHERE m.id = p_milestone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  IF v_ms.provider_user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the assigned provider can request verification' USING ERRCODE = '42501';
  END IF;
  IF v_ms.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Milestone is not in progress';
  END IF;

  -- One pending verification request per milestone — the unique index
  -- on (milestone_id, status) is deferrable so a rejected->pending
  -- cycle can land within the same transaction; reject all existing
  -- pending rows first.
  UPDATE public.goal_disbursement_milestone_verifications
     SET status = 'rejected',
         responded_at = now()
   WHERE milestone_id = p_milestone_id AND status = 'pending';

  INSERT INTO public.goal_disbursement_milestone_verifications (
    milestone_id, requester_user_id, notes
  ) VALUES (
    p_milestone_id, v_caller, p_notes
  ) RETURNING id INTO v_request_id;

  UPDATE public.goal_disbursement_milestones
     SET status = 'verification_requested',
         updated_at = now()
   WHERE id = p_milestone_id;

  RETURN jsonb_build_object('success', TRUE, 'request_id', v_request_id);
END;
$$;

-- ─── RPC: respond_disbursement_verification ─────────────────────────────
-- Goal owner / elder / admin approves or rejects. Approving flips the
-- milestone status to 'verified', which fires the payment trigger.
CREATE OR REPLACE FUNCTION public.respond_disbursement_verification(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_req RECORD;
  v_ms RECORD;
  v_can_respond BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req FROM public.goal_disbursement_milestone_verifications
   WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verification request not found';
  END IF;
  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already responded';
  END IF;

  SELECT m.*, g.user_id AS goal_user_id
    INTO v_ms
    FROM public.goal_disbursement_milestones m
    JOIN public.user_savings_goals g ON g.id = m.goal_id
   WHERE m.id = v_req.milestone_id;

  -- Authorization: goal owner can respond to 'owner'-method requests;
  -- elders/admins for 'elder'/'admin'-method requests. We additionally
  -- allow admins to respond to anything — escape valve for support.
  v_can_respond := FALSE;
  IF v_ms.verification_method = 'owner' AND v_caller = v_ms.goal_user_id THEN
    v_can_respond := TRUE;
  ELSIF v_ms.verification_method IN ('elder', 'admin') THEN
    IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = v_caller AND a.is_active) THEN
      v_can_respond := TRUE;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = v_caller AND a.is_active) THEN
    v_can_respond := TRUE;
  END IF;
  IF NOT v_can_respond THEN
    RAISE EXCEPTION 'Not authorized to respond to this verification' USING ERRCODE = '42501';
  END IF;

  UPDATE public.goal_disbursement_milestone_verifications
     SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
         notes = COALESCE(p_notes, notes),
         responder_user_id = v_caller,
         responded_at = now()
   WHERE id = p_request_id;

  IF p_approved THEN
    UPDATE public.goal_disbursement_milestones
       SET status = 'verified',
           verified_by = v_caller,
           verified_at = now(),
           updated_at = now()
     WHERE id = v_ms.id;
    -- The status_verified trigger downstream calls
    -- process_disbursement_milestone_payment.
  ELSE
    UPDATE public.goal_disbursement_milestones
       SET status = 'in_progress',
           updated_at = now()
     WHERE id = v_ms.id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ─── Internal: process_disbursement_milestone_payment ───────────────────
-- Atomic money movement triggered when a milestone reaches 'verified'.
-- Mirrors the Phase 1B `process_goal_provider_payment` pattern but scoped
-- to a single milestone with retention math.
CREATE OR REPLACE FUNCTION public.process_disbursement_milestone_payment(
  p_milestone_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ms RECORD;
  v_goal RECORD;
  v_provider RECORD;
  v_wallet_id UUID;
  v_wallet_main_before BIGINT;
  v_wallet_main_after BIGINT;
  v_goal_balance_after BIGINT;
  v_release_amount BIGINT;
  v_retention_amount BIGINT;
  v_is_final BOOLEAN;
  v_retention_accumulated BIGINT := 0;
BEGIN
  SELECT * INTO v_ms FROM public.goal_disbursement_milestones
   WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  IF v_ms.status <> 'verified' THEN
    RAISE EXCEPTION 'Milestone not in verified state';
  END IF;

  SELECT * INTO v_goal FROM public.user_savings_goals
   WHERE id = v_ms.goal_id FOR UPDATE;
  SELECT id, user_id, business_name INTO v_provider
    FROM public.providers WHERE id = v_ms.provider_id;

  -- Retention math: hold back retention_percent on every milestone, then
  -- release the accumulated retention on the FINAL milestone (the one
  -- with the highest order_index for this goal).
  v_retention_amount := (v_ms.amount_cents * v_ms.retention_percent) / 100;
  v_release_amount := v_ms.amount_cents - v_retention_amount;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.goal_disbursement_milestones m2
     WHERE m2.goal_id = v_ms.goal_id
       AND m2.order_index > v_ms.order_index
  ) INTO v_is_final;

  IF v_is_final THEN
    -- Sum retention held back from previously released milestones on the
    -- same goal and tack it onto this release.
    SELECT COALESCE(SUM((m.amount_cents * m.retention_percent) / 100), 0)
      INTO v_retention_accumulated
      FROM public.goal_disbursement_milestones m
     WHERE m.goal_id = v_ms.goal_id
       AND m.order_index < v_ms.order_index
       AND m.status = 'released';
    v_release_amount := v_release_amount + v_retention_amount + v_retention_accumulated;
    v_retention_amount := 0;
  END IF;

  IF v_goal.current_balance_cents < v_release_amount THEN
    RAISE EXCEPTION 'Goal balance is insufficient for the release';
  END IF;

  v_goal_balance_after := v_goal.current_balance_cents - v_release_amount;

  -- Debit goal
  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_withdrawals_cents = COALESCE(total_withdrawals_cents, 0) + v_release_amount,
         updated_at = now()
   WHERE id = v_goal.id;

  INSERT INTO public.savings_transactions (
    user_id, savings_goal_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    source, metadata
  ) VALUES (
    v_goal.user_id, v_goal.id, 'milestone_release', 'completed',
    v_release_amount,
    v_goal.current_balance_cents, v_goal_balance_after,
    'goal_disbursement',
    jsonb_build_object(
      'milestone_id', v_ms.id,
      'provider_id', v_ms.provider_id,
      'retention_held_cents', v_retention_amount,
      'final', v_is_final
    )
  );

  -- Credit provider wallet
  SELECT id, main_balance_cents
    INTO v_wallet_id, v_wallet_main_before
    FROM public.user_wallets
   WHERE user_id = v_provider.user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_provider.user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_wallet_main_before;
  END IF;
  v_wallet_main_after := v_wallet_main_before + v_release_amount;

  UPDATE public.user_wallets
     SET main_balance_cents = v_wallet_main_after,
         total_balance_cents = COALESCE(total_balance_cents, 0) + v_release_amount,
         last_activity_at = now(),
         updated_at = now()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    balance_type, direction, description, reference_id, reference_type,
    metadata
  ) VALUES (
    v_provider.user_id, v_wallet_id, 'milestone_release', 'completed',
    v_release_amount, v_wallet_main_before, v_wallet_main_after,
    'main', 'credit',
    'Milestone release: ' || COALESCE(v_ms.name, 'milestone'),
    v_ms.id, 'goal_disbursement_milestones',
    jsonb_build_object(
      'goal_id', v_goal.id,
      'goal_name', v_goal.name,
      'milestone_id', v_ms.id,
      'final', v_is_final
    )
  );

  -- Mark released
  UPDATE public.goal_disbursement_milestones
     SET status = 'released',
         escrow_status = 'released',
         released_at = now(),
         released_amount_cents = v_release_amount,
         updated_at = now()
   WHERE id = v_ms.id;

  -- Roll the goal_provider_links row (paid_amount += release_amount)
  INSERT INTO public.goal_provider_links (
    goal_id, provider_id, status, total_amount_cents, paid_amount_cents
  ) VALUES (
    v_goal.id, v_ms.provider_id, 'active', v_ms.amount_cents, v_release_amount
  )
  ON CONFLICT (goal_id, provider_id) DO UPDATE
    SET status = 'active',
        total_amount_cents = public.goal_provider_links.total_amount_cents + EXCLUDED.total_amount_cents,
        paid_amount_cents = public.goal_provider_links.paid_amount_cents + EXCLUDED.paid_amount_cents,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', TRUE,
    'release_amount_cents', v_release_amount,
    'goal_balance_after_cents', v_goal_balance_after,
    'final', v_is_final
  );
END;
$$;

-- ─── RPC: refund_disbursement_milestone ─────────────────────────────────
-- Goal owner cancels a milestone before release. No money moved (funds
-- never left the goal); we flip escrow to 'refunded' and status to
-- 'failed' for the audit trail.
CREATE OR REPLACE FUNCTION public.refund_disbursement_milestone(
  p_milestone_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_ms RECORD;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT m.*, g.user_id AS goal_user_id
    INTO v_ms
    FROM public.goal_disbursement_milestones m
    JOIN public.user_savings_goals g ON g.id = m.goal_id
   WHERE m.id = p_milestone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  IF v_ms.goal_user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the goal owner can cancel' USING ERRCODE = '42501';
  END IF;
  IF v_ms.status NOT IN ('pending', 'in_progress', 'verification_requested') THEN
    RAISE EXCEPTION 'Cannot cancel a % milestone', v_ms.status;
  END IF;

  UPDATE public.goal_disbursement_milestones
     SET status = 'failed',
         escrow_status = 'refunded',
         notes = COALESCE(p_reason, notes),
         updated_at = now()
   WHERE id = p_milestone_id;

  -- Reject any open verification request.
  UPDATE public.goal_disbursement_milestone_verifications
     SET status = 'rejected', responded_at = now(), responder_user_id = v_caller
   WHERE milestone_id = p_milestone_id AND status = 'pending';

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ─── Trigger: auto-pay on verified ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_disbursement_milestone_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal RECORD;
  v_provider RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT g.user_id, g.name INTO v_goal
    FROM public.user_savings_goals g WHERE g.id = NEW.goal_id;
  SELECT p.user_id, p.business_name INTO v_provider
    FROM public.providers p WHERE p.id = NEW.provider_id;

  -- verified → fire the payment processor
  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status <> 'verified') THEN
    BEGIN
      PERFORM public.process_disbursement_milestone_payment(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'process_disbursement_milestone_payment failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- in_progress / funds_locked (provider accept)
  IF NEW.status = 'in_progress' AND (TG_OP = 'INSERT' OR OLD.status <> 'in_progress') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read) VALUES (
        v_provider.user_id, 'milestone_escrow_locked',
        'Funds reserved',
        'Funds are reserved in escrow for "' || NEW.name || '".',
        jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- verification_requested → notify goal owner (and admins for elder/admin methods)
  IF NEW.status = 'verification_requested' AND (TG_OP = 'INSERT' OR OLD.status <> 'verification_requested') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read) VALUES (
        v_goal.user_id, 'milestone_verification_requested',
        'Verification requested',
        v_provider.business_name || ' requested verification for "' || NEW.name || '".',
        jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
    IF NEW.verification_method IN ('elder', 'admin') THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
        SELECT a.user_id, 'milestone_verification_requested',
               'Verification needed',
               v_provider.business_name || ' is awaiting your review on "' || NEW.name || '".',
               jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
               FALSE
          FROM public.admin_users a WHERE a.is_active;
    END IF;
  END IF;

  -- released → notify both
  IF NEW.status = 'released' AND (TG_OP = 'INSERT' OR OLD.status <> 'released') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read) VALUES (
        v_provider.user_id, 'milestone_released',
        'Payment released',
        'You received $' || trim(to_char(COALESCE(NEW.released_amount_cents, NEW.amount_cents)::numeric / 100, 'FM999G999G990D00'))
          || ' for "' || NEW.name || '".',
        jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
        FALSE
      );
      INSERT INTO public.notifications (user_id, type, title, body, data, read) VALUES (
        v_goal.user_id, 'milestone_released',
        'Milestone released',
        'You released $' || trim(to_char(COALESCE(NEW.released_amount_cents, NEW.amount_cents)::numeric / 100, 'FM999G999G990D00'))
          || ' to ' || v_provider.business_name || ' for "' || NEW.name || '".',
        jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- failed → notify provider
  IF NEW.status = 'failed' AND (TG_OP = 'INSERT' OR OLD.status <> 'failed') THEN
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read) VALUES (
        v_provider.user_id, 'milestone_escrow_refunded',
        'Milestone cancelled',
        '"' || NEW.name || '" was cancelled and funds returned to the goal.',
        jsonb_build_object('milestone_id', NEW.id, 'goal_id', NEW.goal_id),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goal_disbursement_milestones_status_trg ON public.goal_disbursement_milestones;
CREATE TRIGGER goal_disbursement_milestones_status_trg
  AFTER INSERT OR UPDATE OF status ON public.goal_disbursement_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_disbursement_milestone_status_change();

-- ─── Grants ────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.create_goal_disbursement_milestones(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_disbursement_milestone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_disbursement_verification(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_disbursement_verification(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_disbursement_milestone(UUID, TEXT) TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '196',
  'staged_disbursement',
  ARRAY['-- 196: staged_disbursement']
)
ON CONFLICT (version) DO NOTHING;
