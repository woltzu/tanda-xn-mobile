-- ════════════════════════════════════════════════════════════════════════════
-- Migration 200: elder_fee_percent
-- ════════════════════════════════════════════════════════════════════════════
-- Replaces the Phase 2C flat $5 elder fee with a 2% fee clamped to
-- [$1, $100]. Fee policy moves out of the SQL function body and into a
-- key-value `settings` table so admins can tweak via UPDATE without a
-- migration.
--
-- The deduction logic in process_disbursement_milestone_payment doesn't
-- change — it already pulls amount_cents from verification_compensation
-- and subtracts it from the provider's release. The only thing that
-- changes is how the comp row's amount_cents is computed at sign-off
-- time.
--
-- verification_compensation gains a `fee_percent` column for audit
-- clarity (records what percent was used so a future policy change
-- doesn't muddle history). Existing rows backfill to NULL because
-- they were stamped with the flat fee.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── settings table ────────────────────────────────────────────────────────
-- Single-table KV store for policy knobs. Value is JSONB so we can store
-- compound objects (like the elder_fee bundle below) without schema
-- churn each time a policy gains a knob.
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Public read for non-secret keys — for now everything is readable so
-- the client can show the fee on the verification screen. Writes go
-- through admin tooling, blocked from the client.
DROP POLICY IF EXISTS settings_public_select ON public.settings;
CREATE POLICY settings_public_select ON public.settings
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS settings_admin_write ON public.settings;
CREATE POLICY settings_admin_write ON public.settings
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a
     WHERE a.user_id = auth.uid() AND a.is_active
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a
     WHERE a.user_id = auth.uid() AND a.is_active
  ));

-- Seed the elder fee policy.
INSERT INTO public.settings (key, value)
VALUES ('elder_fee', jsonb_build_object(
  'percent', 2,
  'min_cents', 100,    -- $1 floor
  'max_cents', 10000   -- $100 ceiling
))
ON CONFLICT (key) DO NOTHING;

-- ─── verification_compensation.fee_percent ─────────────────────────────────
ALTER TABLE public.verification_compensation
  ADD COLUMN IF NOT EXISTS fee_percent NUMERIC(5,2);

-- ─── respond_disbursement_verification — compute fee from settings ─────────
-- 4-arg signature unchanged. The only semantic delta from migration 197 is
-- the comp row's amount_cents: now computed from the settings policy
-- instead of the flat 500. The deduction path in
-- process_disbursement_milestone_payment doesn't need to change.
CREATE OR REPLACE FUNCTION public.respond_disbursement_verification(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_notes TEXT DEFAULT NULL,
  p_evidence JSONB DEFAULT '{}'::jsonb
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
  v_is_elder_admin BOOLEAN;
  v_fee_policy JSONB;
  v_fee_percent NUMERIC;
  v_fee_min BIGINT;
  v_fee_max BIGINT;
  v_comp_amount_cents BIGINT;
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

  v_is_elder_admin :=
    EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = v_caller AND a.is_active);
  v_can_respond := FALSE;
  IF v_ms.verification_method = 'owner' AND v_caller = v_ms.goal_user_id THEN
    v_can_respond := TRUE;
  ELSIF v_ms.verification_method IN ('elder', 'admin') AND v_is_elder_admin THEN
    v_can_respond := TRUE;
  END IF;
  IF v_is_elder_admin THEN
    v_can_respond := TRUE;
  END IF;
  IF NOT v_can_respond THEN
    RAISE EXCEPTION 'Not authorized to respond to this verification' USING ERRCODE = '42501';
  END IF;

  UPDATE public.goal_disbursement_milestone_verifications
     SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
         notes = COALESCE(p_notes, notes),
         evidence = CASE
           WHEN p_evidence IS NULL OR p_evidence = '{}'::jsonb THEN evidence
           ELSE p_evidence
         END,
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

    -- Elder/admin comp: compute from the settings policy. Goal-owner
    -- self-approvals never earn a fee. The clamp ensures the policy
    -- can't be set to something economically nonsensical at runtime.
    IF v_is_elder_admin AND v_caller <> v_ms.goal_user_id THEN
      SELECT value INTO v_fee_policy
        FROM public.settings WHERE key = 'elder_fee';
      v_fee_percent := COALESCE((v_fee_policy->>'percent')::NUMERIC, 2);
      v_fee_min := COALESCE((v_fee_policy->>'min_cents')::BIGINT, 100);
      v_fee_max := COALESCE((v_fee_policy->>'max_cents')::BIGINT, 10000);
      v_comp_amount_cents := GREATEST(
        v_fee_min,
        LEAST(
          v_fee_max,
          ROUND(v_ms.amount_cents::NUMERIC * v_fee_percent / 100)::BIGINT
        )
      );

      BEGIN
        INSERT INTO public.verification_compensation (
          verification_id, milestone_id, responder_user_id,
          amount_cents, fee_percent
        ) VALUES (
          p_request_id, v_ms.id, v_caller,
          v_comp_amount_cents, v_fee_percent
        )
        ON CONFLICT (verification_id) DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'verification_compensation insert failed: %', SQLERRM;
      END;
    END IF;
  ELSE
    UPDATE public.goal_disbursement_milestones
       SET status = 'in_progress',
           updated_at = now()
     WHERE id = v_ms.id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '200',
  'elder_fee_percent',
  ARRAY['-- 200: elder_fee_percent']
)
ON CONFLICT (version) DO NOTHING;
