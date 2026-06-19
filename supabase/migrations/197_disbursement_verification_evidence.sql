-- ════════════════════════════════════════════════════════════════════════════
-- Migration 197: disbursement_verification_evidence
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2B — adds the evidence + compensation surface to the staged-
-- disbursement verification flow:
--
--   1. `evidence` JSONB column on goal_disbursement_milestone_verifications
--      so the responder can attach photos (storage URLs / paths), location,
--      and free-text notes alongside their approve/reject decision.
--
--   2. `verification_compensation` table — when an elder or admin signs
--      off on a milestone, they earn a flat fee. The row is the audit
--      record; actual payout is a Phase 2C concern.
--
--   3. `respond_disbursement_verification` is REPLACEd with a 4-arg
--      signature that accepts `p_evidence JSONB`. The previous 3-arg
--      signature is dropped to avoid the dual-overload that caught us
--      out on migration 192.
--
-- All notification fan-out continues to flow through the status-change
-- trigger added in migration 196 — this migration only extends the
-- responder's surface, not the state machine.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── evidence column ───────────────────────────────────────────────────────
ALTER TABLE public.goal_disbursement_milestone_verifications
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── verification_compensation ────────────────────────────────────────────
-- One row per signed-off verification by an elder/admin. amount_cents is
-- stamped at insert time so a future fee policy change doesn't rewrite
-- history. status='earned' on insert; Phase 2C will mark 'paid' once the
-- payout runs.
CREATE TABLE IF NOT EXISTS public.verification_compensation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.goal_disbursement_milestone_verifications(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES public.goal_disbursement_milestones(id) ON DELETE CASCADE,
  responder_user_id UUID NOT NULL REFERENCES public.profiles(id),
  amount_cents BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'earned' CHECK (status IN ('earned', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (verification_id)
);
CREATE INDEX IF NOT EXISTS idx_verif_comp_responder
  ON public.verification_compensation (responder_user_id);

ALTER TABLE public.verification_compensation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vc_select ON public.verification_compensation;
CREATE POLICY vc_select ON public.verification_compensation
  FOR SELECT
  USING (
    responder_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active)
  );
-- Writes go through the SECURITY DEFINER RPC only.
DROP POLICY IF EXISTS vc_no_direct_writes ON public.verification_compensation;
CREATE POLICY vc_no_direct_writes ON public.verification_compensation
  FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- ─── respond_disbursement_verification — replace with 4-arg signature ────
-- Drop the 3-arg from migration 196 so we don't end up with two overloads
-- (the migration 192 lesson). The 4-arg signature is a strict superset
-- so the client just passes the new {} default on the old call sites.
DROP FUNCTION IF EXISTS public.respond_disbursement_verification(UUID, BOOLEAN, TEXT);

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
  v_comp_amount_cents BIGINT := 500;  -- $5 elder fee (Phase 2B default)
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
  -- elders/admins for 'elder'/'admin'-method requests. Admins always.
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

    -- Elder/admin compensation row. Goal-owner self-approvals don't earn
    -- a fee. Idempotent via UNIQUE(verification_id) — re-applying the
    -- same response (if we ever allow it) won't double-pay.
    IF v_is_elder_admin AND v_caller <> v_ms.goal_user_id THEN
      BEGIN
        INSERT INTO public.verification_compensation (
          verification_id, milestone_id, responder_user_id, amount_cents
        ) VALUES (
          p_request_id, v_ms.id, v_caller, v_comp_amount_cents
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

GRANT EXECUTE ON FUNCTION public.respond_disbursement_verification(UUID, BOOLEAN, TEXT, JSONB)
  TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '197',
  'disbursement_verification_evidence',
  ARRAY['-- 197: disbursement_verification_evidence']
)
ON CONFLICT (version) DO NOTHING;
