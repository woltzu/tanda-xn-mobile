-- ═══════════════════════════════════════════════════════════════════════════
-- 281_adoption_tracking.sql
--
-- Conditional fee + adoption system (Bucket 10).
--
-- Bucket 10 ties the platform fee on premium circles to whether the
-- *creator* has reached the adoption threshold. Until the user crosses
-- the threshold, every premium circle they create is free (0 bps);
-- afterwards, the default 200 bps applies. This lets new users see and
-- use premium types (goal, emergency, family-support, beneficiary)
-- without the fee friction during onboarding.
--
-- Storage decisions:
--   • Thresholds live in `public.settings` (KV jsonb introduced by
--     migration 200 for the elder-fee policy). NOT a feature_gates row
--     — feature_gates is the eligibility-rule registry, not a config
--     store, and its NOT NULL fields make it the wrong table for this.
--   • Adoption state on profiles: `is_adopted BOOLEAN`, `adopted_at
--     TIMESTAMPTZ`. The timestamp is only set the first time a user
--     crosses the threshold; demotion (rare — would require cycles to be
--     voided) clears is_adopted but leaves adopted_at for audit.
--
-- Premium-circle classification:
--   • Migration 279 added is_premium + platform_fee_bps to circles but
--     left "operators flip is_premium independently" — nothing today
--     marks a new circle premium. This migration adds a BEFORE INSERT
--     trigger that derives is_premium from circles.type so the existing
--     create_circle RPC (and any future direct INSERT path) gets the
--     classification and fee for free.
--   • Premium types: 'goal', 'goal-based', 'emergency', 'family-support',
--     'beneficiary'. 'traditional' stays non-premium. Existing rows are
--     NOT backfilled — settled circles keep their original fee.
--   • The trigger only sets is_premium when the inserted row has it
--     defaulted (FALSE / NULL). Admin tooling that needs to override (a
--     "comp this premium circle" toggle, for example) can INSERT with
--     is_premium = TRUE and platform_fee_bps already set — the trigger
--     still recomputes platform_fee_bps from creator adoption to keep
--     the rule consistent. If a future caller needs to pin a specific
--     fee, add a flag column rather than disabling the trigger.
--
-- Cron:
--   • update-adoption-status-daily fires at 03:00 UTC. It walks every
--     profile and re-evaluates. This catches users who just hit the days
--     threshold but haven't created/joined a circle to re-fire any other
--     trigger that would update them. Cost is small (single LOOP per
--     user, all reads against a tiny set of tables).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles: adoption columns ─────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_adopted BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS adopted_at TIMESTAMPTZ;

-- Partial index — most rows are FALSE, so this stays small and only
-- helps the "list all adopted users" query (admin tooling).
CREATE INDEX IF NOT EXISTS idx_profiles_is_adopted
  ON public.profiles(is_adopted) WHERE is_adopted = TRUE;

-- ─── 2. Seed thresholds in settings ────────────────────────────────────────
INSERT INTO public.settings (key, value)
VALUES ('adoption_thresholds', jsonb_build_object(
  'min_cycles_completed', 1,
  'min_account_age_days', 30
))
ON CONFLICT (key) DO NOTHING;

-- ─── 3. evaluate_adoption_status — read-only assessment ────────────────────
-- Returns the user's current adoption state PLUS the raw progress values
-- so the UI can render "cycles X / Y, days A / B" hints without a second
-- fetch.
CREATE OR REPLACE FUNCTION public.evaluate_adoption_status(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id  UUID;
  v_cfg      JSONB;
  v_min_cyc  INT;
  v_min_days INT;
  v_cycles   INT;
  v_age_days INT;
  v_eligible BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  SELECT value INTO v_cfg
    FROM public.settings WHERE key = 'adoption_thresholds';
  v_min_cyc  := COALESCE((v_cfg->>'min_cycles_completed')::INT, 1);
  v_min_days := COALESCE((v_cfg->>'min_account_age_days')::INT, 30);

  -- Cycles where the user was an active member and the cycle has
  -- reached a terminal completed state.
  SELECT COUNT(DISTINCT cc.id)::INT INTO v_cycles
    FROM public.circle_cycles cc
    JOIN public.circle_members cm
      ON cm.circle_id = cc.circle_id
     AND cm.user_id   = v_user_id
   WHERE cc.cycle_status IN ('closed', 'completed', 'payout_completed');

  SELECT EXTRACT(DAY FROM (NOW() - created_at))::INT
    INTO v_age_days
    FROM public.profiles WHERE id = v_user_id;

  v_eligible := COALESCE(v_cycles, 0)   >= v_min_cyc
            AND COALESCE(v_age_days, 0) >= v_min_days;

  RETURN jsonb_build_object(
    'user_id',          v_user_id,
    'is_adopted',       v_eligible,
    'cycles_completed', COALESCE(v_cycles, 0),
    'account_age_days', COALESCE(v_age_days, 0),
    'threshold_cycles', v_min_cyc,
    'threshold_days',   v_min_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_adoption_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evaluate_adoption_status(UUID)
  TO authenticated, service_role;

-- ─── 4. update_adoption_status — writes back to profiles ───────────────────
-- Idempotent. Stamps adopted_at only on the first promotion; demotion
-- leaves the timestamp for audit.
CREATE OR REPLACE FUNCTION public.update_adoption_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status      JSONB;
  v_was_adopted BOOLEAN;
  v_is_adopted  BOOLEAN;
BEGIN
  SELECT is_adopted INTO v_was_adopted
    FROM public.profiles WHERE id = p_user_id;

  v_status     := public.evaluate_adoption_status(p_user_id);
  v_is_adopted := (v_status->>'is_adopted')::BOOLEAN;

  IF v_is_adopted AND COALESCE(v_was_adopted, FALSE) = FALSE THEN
    UPDATE public.profiles
       SET is_adopted = TRUE,
           adopted_at = NOW()
     WHERE id = p_user_id;
  ELSIF v_is_adopted = FALSE AND COALESCE(v_was_adopted, FALSE) = TRUE THEN
    UPDATE public.profiles
       SET is_adopted = FALSE
     WHERE id = p_user_id;
  END IF;

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.update_adoption_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_adoption_status(UUID) TO service_role;

-- ─── 5. update_adoption_for_all_users — cron entry point ───────────────────
CREATE OR REPLACE FUNCTION public.update_adoption_for_all_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    BEGIN
      PERFORM public.update_adoption_status(r.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[update_adoption_for_all_users] failed for %: %',
        r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.update_adoption_for_all_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_adoption_for_all_users() TO service_role;

-- ─── 6. is_user_adopted — convenience boolean for clients ──────────────────
CREATE OR REPLACE FUNCTION public.is_user_adopted(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_adopted BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  SELECT is_adopted INTO v_adopted
    FROM public.profiles WHERE id = v_user_id;
  RETURN COALESCE(v_adopted, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.is_user_adopted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_adopted(UUID)
  TO authenticated, service_role;

-- ─── 7. BEFORE INSERT trigger on circles ───────────────────────────────────
-- Derives is_premium from type when the caller hasn't already set it,
-- then computes platform_fee_bps from creator adoption status. Kept
-- separate from create_circle so direct INSERTs and any future RPC
-- create paths inherit the rule automatically.
CREATE OR REPLACE FUNCTION public.apply_adoption_conditional_fee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_premium_types TEXT[] := ARRAY[
    'goal', 'goal-based', 'emergency', 'family-support', 'beneficiary'
  ];
  v_creator_adopted BOOLEAN;
BEGIN
  -- Only override is_premium when the row was left at the column default
  -- (FALSE). Callers that deliberately INSERT is_premium=TRUE keep their
  -- explicit choice — useful for admin tooling that needs to mark a
  -- traditional circle premium.
  IF NEW.is_premium IS NULL OR NEW.is_premium = FALSE THEN
    NEW.is_premium := NEW.type = ANY(v_premium_types);
  END IF;

  SELECT COALESCE(is_adopted, FALSE) INTO v_creator_adopted
    FROM public.profiles WHERE id = NEW.created_by;

  NEW.platform_fee_bps := CASE
    WHEN NEW.is_premium AND COALESCE(v_creator_adopted, FALSE) THEN 200
    ELSE 0
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_adoption_conditional_fee_trigger ON public.circles;
CREATE TRIGGER apply_adoption_conditional_fee_trigger
  BEFORE INSERT ON public.circles
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_adoption_conditional_fee();

-- ─── 8. Daily cron — re-evaluate every profile at 03:00 UTC ────────────────
DO $$
DECLARE v_existing INT;
BEGIN
  SELECT COUNT(*) INTO v_existing
    FROM cron.job WHERE jobname = 'update-adoption-status-daily';
  IF v_existing = 0 THEN
    PERFORM cron.schedule(
      'update-adoption-status-daily',
      '0 3 * * *',
      $cron$ SELECT public.update_adoption_for_all_users(); $cron$
    );
  END IF;
END $$;

-- ─── Self-register ─────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '281',
  'adoption_tracking',
  ARRAY['-- 281: adoption_tracking']
)
ON CONFLICT (version) DO NOTHING;
