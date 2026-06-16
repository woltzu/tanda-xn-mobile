-- 173_circle_autopay_automation.sql
-- =====================================================================
-- Phase 2 of Circle Contribution Autopay — round-up integration,
-- missed-contribution suggestions, predictive alerts.
--
-- New columns on circle_autopay_configs:
--   round_up_enabled               BOOLEAN  — opt-in switch
--   pending_round_up_credit_cents  BIGINT   — accumulator
--
-- New table circle_autopay_suggestions:
--   Surfaces a per-(user, circle) banner when the user has missed a
--   contribution and has no active autopay for that circle.
--   reason is a TEXT enum (free-form for now) so we can add more
--   triggers later without a schema bump.
--
-- New functions:
--   apply_round_up_to_circle_autopay(p_user_id, p_debit_amount_cents)
--     Computes the round-up to the next dollar and credits the
--     soonest active config with round_up_enabled=TRUE. Returns the
--     cents credited (0 if no round-up applies or no eligible config).
--     SECURITY DEFINER so it can be invoked from the JWT-scoped
--     authClient inside WalletContext.sendMoney without an RLS round
--     trip.
--
--   detect_missed_circle_contributions()
--     Sweep helper called from the EF. Finds (user, circle) pairs with
--     past-deadline cycles, no contribution row, and no active autopay
--     config, and inserts a suggestion row keyed by UNIQUE
--     (user_id, circle_id). Returns count of rows inserted.
--
-- pg_cron daily schedule
--   pg_cron 1.6.4 is installed. The migration documents the schedule
--   command but does NOT execute it — registration needs the project
--   URL and a service-role bearer, which we don't want to hardcode in
--   a migration. See the comment block at the end.
--
-- Idempotent.
-- =====================================================================

-- ── 1. New columns on circle_autopay_configs ──────────────────────────
ALTER TABLE public.circle_autopay_configs
  ADD COLUMN IF NOT EXISTS round_up_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.circle_autopay_configs
  ADD COLUMN IF NOT EXISTS pending_round_up_credit_cents BIGINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.circle_autopay_configs'::regclass
      AND conname  = 'circle_autopay_configs_credit_nonneg'
  ) THEN
    ALTER TABLE public.circle_autopay_configs
      ADD CONSTRAINT circle_autopay_configs_credit_nonneg
      CHECK (pending_round_up_credit_cents >= 0);
  END IF;
END $$;

-- Helps the round-up RPC find the soonest config to credit in O(log n).
CREATE INDEX IF NOT EXISTS idx_circle_autopay_round_up_next
  ON public.circle_autopay_configs (user_id, next_execution_at)
  WHERE round_up_enabled = TRUE AND status = 'active' AND enabled = TRUE;

-- ── 2. circle_autopay_suggestions table ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_autopay_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id     UUID NOT NULL REFERENCES public.circles(id)  ON DELETE CASCADE,
  reason        TEXT NOT NULL DEFAULT 'missed_contribution',
  suggested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circle_autopay_suggestions_user_circle_unique UNIQUE (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_autopay_suggestions_user_active
  ON public.circle_autopay_suggestions (user_id)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.circle_autopay_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_autopay_suggestions_owner_select ON public.circle_autopay_suggestions;
CREATE POLICY circle_autopay_suggestions_owner_select
  ON public.circle_autopay_suggestions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owner can dismiss — but not insert (that's the EF's job).
DROP POLICY IF EXISTS circle_autopay_suggestions_owner_update ON public.circle_autopay_suggestions;
CREATE POLICY circle_autopay_suggestions_owner_update
  ON public.circle_autopay_suggestions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS circle_autopay_suggestions_service_all ON public.circle_autopay_suggestions;
CREATE POLICY circle_autopay_suggestions_service_all
  ON public.circle_autopay_suggestions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. apply_round_up_to_circle_autopay RPC ──────────────────────────
-- Credits the soonest-due active autopay config for this user.
-- Strategy choice: a single round-up event credits exactly ONE config
-- (the soonest). Splitting across multiple configs would mean the
-- same cent reduces multiple contributions, which is double-spending.
-- "Earliest upcoming" maximises the user's chance of seeing the
-- discount on their next bill.
CREATE OR REPLACE FUNCTION public.apply_round_up_to_circle_autopay(
  p_user_id            UUID,
  p_debit_amount_cents BIGINT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_round_up_cents INTEGER;
  v_target_id UUID;
BEGIN
  IF p_debit_amount_cents IS NULL OR p_debit_amount_cents <= 0 THEN
    RETURN 0;
  END IF;
  -- Round up to nearest dollar (100 cents). When the debit is already
  -- a whole dollar, round-up is zero — no credit applied.
  v_round_up_cents := (100 - (p_debit_amount_cents % 100)) % 100;
  IF v_round_up_cents = 0 THEN
    RETURN 0;
  END IF;

  -- Find the soonest active config with round-up enabled.
  SELECT id INTO v_target_id
  FROM public.circle_autopay_configs
  WHERE user_id = p_user_id
    AND round_up_enabled = TRUE
    AND status = 'active'
    AND enabled = TRUE
  ORDER BY next_execution_at NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_target_id IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE public.circle_autopay_configs
     SET pending_round_up_credit_cents = pending_round_up_credit_cents + v_round_up_cents
   WHERE id = v_target_id;

  RETURN v_round_up_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_round_up_to_circle_autopay(UUID, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_round_up_to_circle_autopay(UUID, BIGINT) TO authenticated, service_role;

-- ── 4. detect_missed_circle_contributions RPC ────────────────────────
-- Service-role only. Called from the EF at the end of each daily run.
-- Idempotent via UNIQUE(user_id, circle_id) — re-running won't
-- duplicate suggestions for users who already dismissed one.
CREATE OR REPLACE FUNCTION public.detect_missed_circle_contributions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  WITH missed AS (
    SELECT DISTINCT cm.user_id, cm.circle_id
    FROM public.circle_members cm
    JOIN public.circle_cycles cc ON cc.circle_id = cm.circle_id
    WHERE cc.contribution_deadline < CURRENT_DATE
      AND cc.cycle_status IN ('active', 'collecting', 'completed')
      -- No payment row for this (user, circle, cycle)
      AND NOT EXISTS (
        SELECT 1 FROM public.contributions c
        WHERE c.user_id = cm.user_id
          AND c.circle_id = cm.circle_id
          AND c.cycle_number = cc.cycle_number
          AND c.status != 'failed'
      )
      -- And no active autopay config already
      AND NOT EXISTS (
        SELECT 1 FROM public.circle_autopay_configs cap
        WHERE cap.user_id = cm.user_id
          AND cap.circle_id = cm.circle_id
          AND cap.status = 'active'
      )
  ),
  ins AS (
    INSERT INTO public.circle_autopay_suggestions (user_id, circle_id, reason)
    SELECT user_id, circle_id, 'missed_contribution' FROM missed
    ON CONFLICT (user_id, circle_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;
  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.detect_missed_circle_contributions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_missed_circle_contributions() TO service_role;

-- ── 5. updated_at trigger for suggestions ────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_circle_autopay_suggestions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_autopay_suggestions_updated_at ON public.circle_autopay_suggestions;
CREATE TRIGGER trg_circle_autopay_suggestions_updated_at
BEFORE UPDATE ON public.circle_autopay_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.touch_circle_autopay_suggestions_updated_at();

-- ── 6. pg_cron registration (NOT auto-applied) ───────────────────────
-- pg_cron 1.6.4 is installed. Run the following ONCE from the SQL
-- Editor after deploying the EF + setting the service-role secret on
-- the project. The schedule fires once a day at 04:00 UTC.
--
--   SELECT cron.schedule(
--     'process-circle-autopay-daily',
--     '0 4 * * *',
--     $$
--       SELECT net.http_post(
--         url:='https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/process-circle-autopay',
--         headers:=jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--         ),
--         body:='{}'::jsonb
--       );
--     $$
--   );
--
-- The service_role_key needs to be set as a Postgres parameter
-- (ALTER SYSTEM SET app.settings.service_role_key = 'sb_...';) — never
-- hardcoded in the cron command body.
--
-- To inspect or unschedule:
--   SELECT * FROM cron.job WHERE jobname = 'process-circle-autopay-daily';
--   SELECT cron.unschedule('process-circle-autopay-daily');

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '173',
  'circle_autopay_automation',
  ARRAY['-- 173: circle_autopay_automation']
)
ON CONFLICT (version) DO NOTHING;
