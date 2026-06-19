-- ════════════════════════════════════════════════════════════════════════════
-- Migration 203: template_submissions
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2A of the goal-templates expansion. Adds the community-submission
-- pipeline only — submitters create rows here, admins triage them, and
-- approval inserts a curated copy into the canonical `goal_templates`
-- table from Phase 4. The Phase 2B follow-on (`template_cost_adjustments`,
-- `template_usage`) ships as migration 204 once the submission flow is
-- stable.
--
-- Submitter writes are restricted to their own rows. Admins read+update
-- every row through `admin_users.is_active`. UPDATE on the submitter
-- path is blocked once status leaves 'pending' so the audit trail
-- (admin_notes, reviewed_by) stays admin-owned.
--
-- A trigger fans an admin notification out on INSERT so the queue
-- surfaces quickly. Mirrors the pattern from the staged-disbursement
-- verification queue (migration 196's status-change trigger).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.template_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'house', 'wedding', 'business', 'school', 'other'
  )),
  name TEXT NOT NULL,
  description TEXT,
  target_cents BIGINT,
  timeline_months INTEGER,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  cost_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_categories TEXT[],
  country TEXT,                                        -- ISO 3166-1 alpha-2
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  votes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  approved_template_id UUID REFERENCES public.goal_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_template_submissions_status
  ON public.template_submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_submissions_user
  ON public.template_submissions (user_id);

ALTER TABLE public.template_submissions ENABLE ROW LEVEL SECURITY;

-- Submitter reads their own rows; admin reads all.
DROP POLICY IF EXISTS template_submissions_select ON public.template_submissions;
CREATE POLICY template_submissions_select ON public.template_submissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active
    )
  );

-- Authenticated users can submit, but only on behalf of themselves.
DROP POLICY IF EXISTS template_submissions_insert ON public.template_submissions;
CREATE POLICY template_submissions_insert ON public.template_submissions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only admins update; this keeps admin_notes, reviewed_at, status owned by
-- the review path. Submitters can't edit once submitted — a re-submission
-- needs a new row.
DROP POLICY IF EXISTS template_submissions_admin_update ON public.template_submissions;
CREATE POLICY template_submissions_admin_update ON public.template_submissions
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active));

-- ─── Admin notification trigger ─────────────────────────────────────────────
-- One notification per active admin per submission. Best-effort per-admin
-- failure inside an EXCEPTION block so a stuck row can't block the fan-out.
CREATE OR REPLACE FUNCTION public.notify_template_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_submitter TEXT;
  v_admin RECORD;
BEGIN
  SELECT full_name INTO v_submitter FROM public.profiles WHERE id = NEW.user_id;
  v_submitter := COALESCE(v_submitter, 'A member');

  FOR v_admin IN
    SELECT user_id FROM public.admin_users WHERE is_active = TRUE
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_admin.user_id,
        'template_submission_received',
        'New template submission',
        v_submitter || ' submitted a ' || NEW.category || ' template: "' || NEW.name || '".',
        jsonb_build_object(
          'submission_id', NEW.id,
          'category', NEW.category,
          'name', NEW.name
        ),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS template_submissions_notify ON public.template_submissions;
CREATE TRIGGER template_submissions_notify
  AFTER INSERT ON public.template_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_template_submission();

-- ─── Approval RPC ───────────────────────────────────────────────────────────
-- Inserts the submission into goal_templates and flips status='approved'
-- in one transaction. Stamps approved_template_id on the submission so
-- the audit trail links the two rows.
CREATE OR REPLACE FUNCTION public.approve_template_submission(
  p_submission_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_sub RECORD;
  v_template_id UUID;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = v_caller AND is_active
  ) THEN
    RAISE EXCEPTION 'Only admins can approve submissions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.template_submissions
   WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;
  IF v_sub.status <> 'pending' THEN
    RAISE EXCEPTION 'Submission is already %', v_sub.status;
  END IF;
  -- Approved templates must use a valid goal_templates category. 'other'
  -- isn't allowed there — the admin must re-categorize before approving.
  IF v_sub.category NOT IN ('house', 'wedding', 'business', 'school') THEN
    RAISE EXCEPTION 'Submission category must be house / wedding / business / school before approval';
  END IF;

  INSERT INTO public.goal_templates (
    category, name, description, icon,
    default_target_cents, default_timeline_months,
    milestones, cost_breakdown, provider_categories,
    is_active, created_by
  ) VALUES (
    v_sub.category, v_sub.name, v_sub.description, NULL,
    v_sub.target_cents, v_sub.timeline_months,
    v_sub.milestones, v_sub.cost_breakdown, v_sub.provider_categories,
    TRUE, v_sub.user_id
  )
  RETURNING id INTO v_template_id;

  UPDATE public.template_submissions
     SET status = 'approved',
         admin_notes = COALESCE(p_admin_notes, admin_notes),
         reviewed_at = now(),
         reviewed_by = v_caller,
         approved_template_id = v_template_id
   WHERE id = p_submission_id;

  -- Notify the submitter.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_sub.user_id,
      'template_submission_approved',
      'Your template was approved',
      'Your "' || v_sub.name || '" template is now live in the browser.',
      jsonb_build_object(
        'submission_id', p_submission_id,
        'template_id', v_template_id
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE, 'template_id', v_template_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_template_submission(
  p_submission_id UUID,
  p_admin_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_sub RECORD;
BEGIN
  v_caller := auth.uid();
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = v_caller AND is_active
  ) THEN
    RAISE EXCEPTION 'Only admins can reject submissions' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sub FROM public.template_submissions
   WHERE id = p_submission_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;
  IF v_sub.status <> 'pending' THEN
    RAISE EXCEPTION 'Submission is already %', v_sub.status;
  END IF;

  UPDATE public.template_submissions
     SET status = 'rejected',
         admin_notes = p_admin_notes,
         reviewed_at = now(),
         reviewed_by = v_caller
   WHERE id = p_submission_id;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_sub.user_id,
      'template_submission_rejected',
      'Template not approved',
      'Your "' || v_sub.name || '" submission needs changes. See admin notes for details.',
      jsonb_build_object(
        'submission_id', p_submission_id,
        'admin_notes', p_admin_notes
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_template_submission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_template_submission(UUID, TEXT) TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '203',
  'template_submissions',
  ARRAY['-- 203: template_submissions']
)
ON CONFLICT (version) DO NOTHING;
