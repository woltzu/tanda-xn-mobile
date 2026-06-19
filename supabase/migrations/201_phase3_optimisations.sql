-- ════════════════════════════════════════════════════════════════════════════
-- Migration 201: phase3_optimisations
-- ════════════════════════════════════════════════════════════════════════════
-- Four optimisation buckets in one migration so they share schema
-- conventions (template tables) and the trigger surface stays coherent:
--
--   1. goal_category_templates          — suggested milestones by category
--   2. milestone_checklist_templates    — verification checklist by category
--   3. profiles.{is_elder, latitude, longitude} + nearby-elder broadcast
--      at verification-requested time + 48 h escalation cron
--   4. providers.total_jobs_completed auto-increment on final-milestone
--      release + auto-upgrade trigger when total reaches 5 (Level N → N+1
--      up to 3).
--
-- Trigger surface: rather than add another trigger to
-- goal_disbursement_milestones, we EXTEND the existing
-- trg_disbursement_milestone_status_change so the verification-requested
-- branch fires the nearby-elder broadcast for elder-method milestones.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. goal_category_templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_category_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  -- Each element: { name, description, default_percent } where percents
  -- sum to 100. The wizard scales them against the goal's target amount.
  milestones JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_category_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gct_public_select ON public.goal_category_templates;
CREATE POLICY gct_public_select ON public.goal_category_templates
  FOR SELECT USING (TRUE);

-- Seed defaults — house/wedding/school/business as a starting set. Admins
-- can refine via UPDATE; new categories added by INSERT.
INSERT INTO public.goal_category_templates (category, milestones) VALUES
  ('house', '[
    {"name": "Foundation poured",       "description": "Footings dug, slab poured, cured.",                 "default_percent": 25},
    {"name": "Walls and roof up",        "description": "Block walls and roof structure in place.",          "default_percent": 35},
    {"name": "Doors, windows, finishes", "description": "Doors, windows, plaster, paint complete.",          "default_percent": 30},
    {"name": "Handover",                 "description": "Final clean-up, keys handed to the owner.",         "default_percent": 10}
  ]'::jsonb),
  ('wedding', '[
    {"name": "Venue secured",            "description": "Venue booked and deposit paid.",                   "default_percent": 30},
    {"name": "Catering + decor confirmed", "description": "Food order, decor, vendors confirmed.",          "default_percent": 30},
    {"name": "Day-of execution",         "description": "Event runs as planned.",                            "default_percent": 30},
    {"name": "Post-event wrap-up",       "description": "Vendor payments closed, photos delivered.",         "default_percent": 10}
  ]'::jsonb),
  ('school', '[
    {"name": "Term 1 enrolment + fees",   "description": "Enrolment confirmed, term 1 fees paid.",          "default_percent": 25},
    {"name": "Term 1 results",            "description": "Term 1 report card received.",                    "default_percent": 25},
    {"name": "Term 2 fees + results",     "description": "Term 2 paid, report received.",                    "default_percent": 25},
    {"name": "End-of-year completion",    "description": "Final results in, year complete.",                "default_percent": 25}
  ]'::jsonb),
  ('business', '[
    {"name": "Registration complete",     "description": "Business registered with the right authority.",   "default_percent": 20},
    {"name": "Premises + equipment",      "description": "Premises secured, equipment installed.",          "default_percent": 35},
    {"name": "Open for business",         "description": "Doors open, first transactions logged.",          "default_percent": 30},
    {"name": "30-day operating proof",    "description": "30 days of activity captured.",                    "default_percent": 15}
  ]'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- ─── 2. milestone_checklist_templates ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.milestone_checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  -- JSONB array of strings the elder ticks off during verification.
  checks JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestone_checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mct_public_select ON public.milestone_checklist_templates;
CREATE POLICY mct_public_select ON public.milestone_checklist_templates
  FOR SELECT USING (TRUE);

INSERT INTO public.milestone_checklist_templates (category, checks) VALUES
  ('house', '[
    "Foundation depth matches plan",
    "Concrete grade visible on packaging or invoice",
    "No visible cracks or water seepage",
    "Walls vertical, corners square",
    "Roof structure secure, no daylight gaps",
    "Doors and windows close cleanly"
  ]'::jsonb),
  ('wedding', '[
    "Venue matches what was booked",
    "Vendor receipts confirm scope",
    "Decor matches the agreed brief",
    "Event ran without major disruption"
  ]'::jsonb),
  ('school', '[
    "Enrolment letter / receipt visible",
    "Report card shows expected term",
    "Attendance record consistent with claim"
  ]'::jsonb),
  ('business', '[
    "Registration certificate present",
    "Premises match the registered address",
    "Equipment matches the invoice",
    "Open-for-business signage and hours visible"
  ]'::jsonb)
ON CONFLICT (category) DO NOTHING;

-- ─── 3. Profiles GPS + is_elder ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_elder BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_profiles_is_elder
  ON public.profiles (is_elder) WHERE is_elder = TRUE;

-- ─── 3b. Haversine + nearby-elder broadcast ────────────────────────────────
CREATE OR REPLACE FUNCTION public.haversine_meters(
  lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_r CONSTANT DOUBLE PRECISION := 6371000;
  v_dlat DOUBLE PRECISION;
  v_dlng DOUBLE PRECISION;
  v_a DOUBLE PRECISION;
BEGIN
  v_dlat := radians(lat2 - lat1);
  v_dlng := radians(lng2 - lng1);
  v_a := sin(v_dlat / 2) ^ 2
       + cos(radians(lat1)) * cos(radians(lat2)) * sin(v_dlng / 2) ^ 2;
  RETURN v_r * 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
END;
$$;

-- Broadcasts a verification request to every elder profile within 50 km of
-- the project pin. SECURITY DEFINER so the SELECT spans profiles +
-- user_savings_goals regardless of caller RLS. Returns the number of
-- elders notified for observability.
CREATE OR REPLACE FUNCTION public.broadcast_verification_to_nearby_elders(
  p_milestone_id UUID,
  p_radius_meters DOUBLE PRECISION DEFAULT 50000
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT := 0;
  v_goal RECORD;
  v_ms RECORD;
  v_provider RECORD;
BEGIN
  SELECT m.id, m.name, m.goal_id, m.provider_id, m.verification_method,
         g.project_latitude, g.project_longitude, g.name AS goal_name
    INTO v_ms
    FROM public.goal_disbursement_milestones m
    JOIN public.user_savings_goals g ON g.id = m.goal_id
   WHERE m.id = p_milestone_id;
  IF NOT FOUND OR v_ms.verification_method <> 'elder'
     OR v_ms.project_latitude IS NULL OR v_ms.project_longitude IS NULL THEN
    -- No pin or not an elder-method milestone — fall back to the
    -- existing admin fan-out (already handled by the calling trigger).
    RETURN 0;
  END IF;

  SELECT business_name INTO v_provider
    FROM public.providers WHERE id = v_ms.provider_id;

  INSERT INTO public.notifications (user_id, type, title, body, data, read)
    SELECT p.id,
           'milestone_verification_nearby',
           'Verification nearby',
           COALESCE(v_provider.business_name, 'A provider')
             || ' needs sign-off on "' || v_ms.name || '" within ' ||
             (p_radius_meters / 1000)::TEXT || ' km of you.',
           jsonb_build_object(
             'milestone_id', v_ms.id,
             'goal_id', v_ms.goal_id,
             'project_lat', v_ms.project_latitude,
             'project_lng', v_ms.project_longitude
           ),
           FALSE
      FROM public.profiles p
     WHERE p.is_elder = TRUE
       AND p.latitude IS NOT NULL
       AND p.longitude IS NOT NULL
       AND public.haversine_meters(
             p.latitude, p.longitude,
             v_ms.project_latitude, v_ms.project_longitude
           ) <= p_radius_meters;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ─── 3c. Wire the broadcast into the existing status-change trigger ────────
-- The Phase 2A trigger already fans out admin notifications when a
-- milestone hits 'verification_requested'. We extend it to also call
-- broadcast_verification_to_nearby_elders for elder-method milestones.
-- All other branches are unchanged from migration 198.
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

  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status <> 'verified') THEN
    BEGIN
      PERFORM public.process_disbursement_milestone_payment(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'process_disbursement_milestone_payment failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

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

    -- Phase 3 — nearby-elder broadcast in addition to the admin fan-out
    -- above. No-op if not an elder-method milestone or no project pin.
    IF NEW.verification_method = 'elder' THEN
      BEGIN
        PERFORM public.broadcast_verification_to_nearby_elders(NEW.id, 50000);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'broadcast_verification_to_nearby_elders failed for %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

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

-- ─── 3d. 48 h escalation cron ──────────────────────────────────────────────
-- Pending verifications older than 48 h with elder/admin method get
-- re-broadcast to every active admin so they don't rot in the queue.
CREATE OR REPLACE FUNCTION public.escalate_stale_verifications()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_count INT := 0;
BEGIN
  FOR v_row IN
    SELECT v.id, v.milestone_id, m.name AS milestone_name, m.goal_id,
           m.verification_method
      FROM public.goal_disbursement_milestone_verifications v
      JOIN public.goal_disbursement_milestones m ON m.id = v.milestone_id
     WHERE v.status = 'pending'
       AND v.created_at < now() - INTERVAL '48 hours'
       AND m.verification_method IN ('elder', 'admin')
       -- Cheap dedupe: skip if we've already escalated this verification.
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.type = 'milestone_verification_escalated'
            AND n.data->>'verification_id' = v.id::text
       )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
      SELECT a.user_id, 'milestone_verification_escalated',
             'Verification needs attention',
             '"' || v_row.milestone_name || '" has been pending review for over 48 hours.',
             jsonb_build_object(
               'verification_id', v_row.id,
               'milestone_id', v_row.milestone_id,
               'goal_id', v_row.goal_id
             ),
             FALSE
        FROM public.admin_users a WHERE a.is_active;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Cron — every hour. cron.schedule is idempotent on jobname.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('escalate_stale_verifications')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'escalate_stale_verifications');
    PERFORM cron.schedule(
      'escalate_stale_verifications',
      '0 * * * *',
      $cron$SELECT public.escalate_stale_verifications();$cron$
    );
  END IF;
END$$;

-- ─── 4. Provider auto-upgrade ──────────────────────────────────────────────
-- 4a. Auto-increment providers.total_jobs_completed when a final
-- milestone releases. The "final milestone" is the one with the highest
-- order_index on the goal — same definition used in
-- process_disbursement_milestone_payment for retention release.
--
-- 4b. Auto-upgrade trigger reacts to total_jobs_completed crossing 5
-- (Phase 3 threshold), bumps verification_level by 1 up to 3, and
-- notifies the provider.
CREATE OR REPLACE FUNCTION public.trg_milestone_completed_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_final BOOLEAN;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF OLD.status = 'released' OR NEW.status <> 'released' THEN
    RETURN NEW;
  END IF;
  -- Final milestone = no row with a higher order_index on the same goal.
  SELECT NOT EXISTS (
    SELECT 1 FROM public.goal_disbursement_milestones m2
     WHERE m2.goal_id = NEW.goal_id
       AND m2.order_index > NEW.order_index
  ) INTO v_is_final;
  IF v_is_final THEN
    UPDATE public.providers
       SET total_jobs_completed = COALESCE(total_jobs_completed, 0) + 1,
           updated_at = now()
     WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goal_disbursement_milestones_count
  ON public.goal_disbursement_milestones;
CREATE TRIGGER goal_disbursement_milestones_count
  AFTER UPDATE OF status ON public.goal_disbursement_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_milestone_completed_count();

-- Auto-upgrade
CREATE OR REPLACE FUNCTION public.trg_provider_auto_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_level INT;
BEGIN
  IF NEW.total_jobs_completed IS NULL
     OR NEW.total_jobs_completed < 5
     OR NEW.verification_level >= 3 THEN
    RETURN NEW;
  END IF;
  -- Don't loop on rows that didn't cross the threshold this update.
  IF OLD.total_jobs_completed = NEW.total_jobs_completed THEN
    RETURN NEW;
  END IF;
  v_new_level := NEW.verification_level + 1;
  UPDATE public.providers
     SET verification_level = v_new_level,
         updated_at = now()
   WHERE id = NEW.id;
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.user_id,
      'provider_verification_upgraded',
      'You levelled up',
      'After ' || NEW.total_jobs_completed::TEXT
        || ' completed jobs your provider listing reached Level '
        || v_new_level::TEXT || '.',
      jsonb_build_object(
        'provider_id', NEW.id,
        'old_level', NEW.verification_level,
        'new_level', v_new_level,
        'trigger', 'auto'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_auto_upgrade ON public.providers;
CREATE TRIGGER providers_auto_upgrade
  AFTER UPDATE OF total_jobs_completed ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_provider_auto_upgrade();

-- ─── Grants ────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.haversine_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_verification_to_nearby_elders(UUID, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.escalate_stale_verifications() TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '201',
  'phase3_optimisations',
  ARRAY['-- 201: phase3_optimisations']
)
ON CONFLICT (version) DO NOTHING;
