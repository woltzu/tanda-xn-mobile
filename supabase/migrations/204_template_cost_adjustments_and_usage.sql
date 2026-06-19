-- ════════════════════════════════════════════════════════════════════════════
-- Migration 204: template_cost_adjustments_and_usage
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 5 (templates 2B). Two narrow tables hanging off goal_templates:
--
--   1. template_cost_adjustments — per-country multiplier so the browser
--      can scale the default target + cost-breakdown items to the
--      member's location ("Costs adjusted for Côte d'Ivoire: $15,000 →
--      $19,500"). One row per (template_id, country); the UNIQUE
--      constraint enforces it.
--
--   2. template_usage — one row per goal-from-template event. Lets us
--      surface "most-used templates" in a future admin dashboard
--      without coupling to user_savings_goals (which already references
--      the goal via FK). Write-once on the user path; admin reads all
--      for analytics.
--
-- Both tables stay narrow on purpose — Phase 2C is where the admin
-- analytics surface lives.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── template_cost_adjustments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_cost_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.goal_templates(id) ON DELETE CASCADE,
  country TEXT NOT NULL,                  -- ISO 3166-1 alpha-2
  multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.0 CHECK (multiplier > 0 AND multiplier <= 10),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, country)
);
-- Spec said DECIMAL(3,2), but that caps at 9.99 — fine for "1.3x" but
-- breaks the day someone wants 10x for the most expensive markets. Bumped
-- to DECIMAL(4,2). CHECK guards against negative / runaway values either
-- way.

CREATE INDEX IF NOT EXISTS idx_template_cost_adjustments_country
  ON public.template_cost_adjustments (country);

ALTER TABLE public.template_cost_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tca_public_select ON public.template_cost_adjustments;
CREATE POLICY tca_public_select ON public.template_cost_adjustments
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS tca_admin_write ON public.template_cost_adjustments;
CREATE POLICY tca_admin_write ON public.template_cost_adjustments
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active
  ));

-- ─── template_usage ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.goal_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.user_savings_goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_usage_template
  ON public.template_usage (template_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_template_usage_user
  ON public.template_usage (user_id);

ALTER TABLE public.template_usage ENABLE ROW LEVEL SECURITY;

-- Users see their own usage rows (could power a "my template history"
-- view later); admins see everyone's for analytics.
DROP POLICY IF EXISTS tu_select ON public.template_usage;
CREATE POLICY tu_select ON public.template_usage
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active
    )
  );

-- Authenticated users insert their own row. UPDATEs and DELETEs are
-- blocked — usage rows are append-only for honest analytics.
DROP POLICY IF EXISTS tu_insert ON public.template_usage;
CREATE POLICY tu_insert ON public.template_usage
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '204',
  'template_cost_adjustments_and_usage',
  ARRAY['-- 204: template_cost_adjustments_and_usage']
)
ON CONFLICT (version) DO NOTHING;
