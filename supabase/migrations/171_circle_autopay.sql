-- 171_circle_autopay.sql
-- =====================================================================
-- Phase 0 of Circle Contribution Autopay.
--
-- Two new tables:
--
--   circle_autopay_configs
--     - One row per (user, circle) pair (UNIQUE).
--     - Holds the user's saved autopay preference: payment method,
--       amount, schedule type, enabled flag, next execution timestamp.
--     - status mirrors the loan-autopay pattern: 'active' / 'paused' /
--       'disabled'. 'paused' is what the cron sets after 3 failures
--       (Phase 1); 'disabled' is what soft-delete from the UI sets.
--
--   circle_autopay_log
--     - One row per cron-attempted execution. Always inserted, even
--       when status='skipped' (user manually contributed before the
--       cron ran). Drives the management screen's history view in
--       a future phase and gives us forensics for support tickets.
--
-- Indexes:
--   - configs (user_id, enabled)          — list "my autopay configs"
--   - configs (circle_id, status)         — per-circle audit
--   - configs (next_execution_at)         — cron sweep
--   - log (config_id, created_at DESC)    — history view
--
-- RLS:
--   - configs: owner has full SELECT/INSERT/UPDATE/DELETE (auth.uid()
--     = user_id); service_role has UPDATE for the cron + INSERT for
--     re-enabling from notifications.
--   - log: owner has SELECT only (writes are cron-only); service_role
--     has ALL.
--
-- Schema choices verified against live shape on 2026-06-15:
--   - circles.amount is numeric (dollars), not cents. We store
--     amount_cents here to keep money math integer-safe.
--   - circle_cycles.contribution_deadline is the "due date" the EF
--     uses to drive next_execution_at.
-- =====================================================================

-- ── 1. circle_autopay_configs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_autopay_configs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id                 UUID NOT NULL REFERENCES public.circles(id)  ON DELETE CASCADE,
  -- payment_method_id is nullable: NULL + payment_method_type='wallet'
  -- means pay from the user's TandaXn wallet. For card / bank, we
  -- store the stripe_payment_methods.id (an app-managed UUID, not
  -- the Stripe pm_xxx id).
  payment_method_id         UUID,
  payment_method_type       TEXT NOT NULL CHECK (payment_method_type IN (
                              'wallet', 'card', 'us_bank_account'
                            )),
  enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
  contribution_amount_cents INTEGER NOT NULL CHECK (contribution_amount_cents > 0),
  schedule_type             TEXT NOT NULL DEFAULT 'on_due' CHECK (schedule_type IN (
                              'on_due', 'days_before'
                            )),
  -- Ignored when schedule_type = 'on_due'.
  days_before               INTEGER NOT NULL DEFAULT 0 CHECK (days_before >= 0 AND days_before <= 30),
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                              'active', 'paused', 'disabled'
                            )),
  last_executed_at          TIMESTAMPTZ,
  next_execution_at         TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circle_autopay_configs_user_circle_unique UNIQUE (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_autopay_user_enabled
  ON public.circle_autopay_configs (user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_circle_autopay_circle_status
  ON public.circle_autopay_configs (circle_id, status);

-- Cron sweep index — partial so we only index actionable rows.
CREATE INDEX IF NOT EXISTS idx_circle_autopay_next_exec_due
  ON public.circle_autopay_configs (next_execution_at)
  WHERE enabled = TRUE AND status = 'active';

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.touch_circle_autopay_configs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_autopay_configs_updated_at ON public.circle_autopay_configs;
CREATE TRIGGER trg_circle_autopay_configs_updated_at
BEFORE UPDATE ON public.circle_autopay_configs
FOR EACH ROW
EXECUTE FUNCTION public.touch_circle_autopay_configs_updated_at();

-- ── 2. circle_autopay_log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_autopay_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id       UUID NOT NULL REFERENCES public.circle_autopay_configs(id) ON DELETE CASCADE,
  scheduled_date  DATE NOT NULL,
  executed_at     TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message   TEXT,
  amount_cents    INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circle_autopay_log_config_created
  ON public.circle_autopay_log (config_id, created_at DESC);

-- ── 3. RLS ───────────────────────────────────────────────────────────
ALTER TABLE public.circle_autopay_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_autopay_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_autopay_configs_owner_select ON public.circle_autopay_configs;
CREATE POLICY circle_autopay_configs_owner_select
  ON public.circle_autopay_configs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS circle_autopay_configs_owner_insert ON public.circle_autopay_configs;
CREATE POLICY circle_autopay_configs_owner_insert
  ON public.circle_autopay_configs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS circle_autopay_configs_owner_update ON public.circle_autopay_configs;
CREATE POLICY circle_autopay_configs_owner_update
  ON public.circle_autopay_configs FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS circle_autopay_configs_owner_delete ON public.circle_autopay_configs;
CREATE POLICY circle_autopay_configs_owner_delete
  ON public.circle_autopay_configs FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS circle_autopay_configs_service_all ON public.circle_autopay_configs;
CREATE POLICY circle_autopay_configs_service_all
  ON public.circle_autopay_configs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Log: owners read only; cron writes via service role.
DROP POLICY IF EXISTS circle_autopay_log_owner_select ON public.circle_autopay_log;
CREATE POLICY circle_autopay_log_owner_select
  ON public.circle_autopay_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.circle_autopay_configs c
      WHERE c.id = circle_autopay_log.config_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS circle_autopay_log_service_all ON public.circle_autopay_log;
CREATE POLICY circle_autopay_log_service_all
  ON public.circle_autopay_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '171',
  'circle_autopay',
  ARRAY['-- 171: circle_autopay']
)
ON CONFLICT (version) DO NOTHING;
