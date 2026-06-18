-- ════════════════════════════════════════════════════════════════════════════
-- Migration 193: provider_network
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 1A foundation for the Verified Provider Network. Adds four tables
-- and one column on user_savings_goals so diaspora members can pay
-- community-vetted providers (builders, teachers, clinics, etc.) directly
-- from a goal jar.
--
-- Graduated verification — `verification_level`:
--   1  Basic     — Elder endorsement only (Phase 1A focus)
--   2  Standard  — Elder endorsement + uploaded documents
--   3  Premium   — Elder + documents + admin site visit
--
-- `verification_status` reflects WHERE in the pipeline the application is.
-- A provider only appears in the public list when verification_status =
-- 'verified' AND is_active = true (RLS gates the public SELECT).
--
-- The four tables are scoped so Phase 1B (payment integration via
-- goal_provider_links → SendMoney flow) can land without further schema
-- migration — total_amount_cents / paid_amount_cents are already in place.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Enums ─────────────────────────────────────────────────────────────────
-- Provider categories. ENUM gives the screen a stable filter set.
-- Adding values later is a one-way ALTER TYPE ADD VALUE — keep this list
-- conservative for now; new values can be appended without dropping.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_category_enum') THEN
    CREATE TYPE public.provider_category_enum AS ENUM (
      'construction',
      'education',
      'healthcare',
      'agriculture',
      'retail',
      'legal_finance',
      'services',
      'other'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_verification_status_enum') THEN
    CREATE TYPE public.provider_verification_status_enum AS ENUM (
      'pending', 'verified', 'rejected'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_verification_step_type_enum') THEN
    CREATE TYPE public.provider_verification_step_type_enum AS ENUM (
      'elder_endorsement', 'document_upload', 'admin_site_visit'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_verification_step_status_enum') THEN
    CREATE TYPE public.provider_verification_step_status_enum AS ENUM (
      'pending', 'in_progress', 'completed', 'rejected'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'goal_provider_link_status_enum') THEN
    CREATE TYPE public.goal_provider_link_status_enum AS ENUM (
      'pending', 'active', 'completed', 'cancelled'
    );
  END IF;
END$$;

-- ─── providers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  category public.provider_category_enum NOT NULL,
  country TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  years_experience INTEGER,
  verification_level INTEGER NOT NULL DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 3),
  verification_status public.provider_verification_status_enum NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  verification_documents JSONB DEFAULT '[]'::jsonb,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  total_jobs_completed INTEGER DEFAULT 0,
  total_jobs_failed INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One provider per user. If a user wants a second listing they reuse
  -- the row (or we lift this in a later phase).
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_providers_status_active
  ON public.providers (verification_status, is_active);
CREATE INDEX IF NOT EXISTS idx_providers_category_country
  ON public.providers (category, country);

-- ─── provider_reviews ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.user_savings_goals(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text TEXT,
  categories JSONB DEFAULT '{}'::jsonb,
  -- TRUE iff this review is attached to a goal_provider_links row that
  -- has at least one paid_amount_cents > 0 — the "verified purchase"
  -- badge in the UI. Phase 1B's payment flow sets this on link advance.
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One review per (provider, reviewer). Edits update in place.
  UNIQUE (provider_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider
  ON public.provider_reviews (provider_id);

-- ─── goal_provider_links ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goal_provider_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.user_savings_goals(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES public.goal_milestones(id) ON DELETE SET NULL,
  status public.goal_provider_link_status_enum NOT NULL DEFAULT 'pending',
  total_amount_cents BIGINT NOT NULL DEFAULT 0,
  paid_amount_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (goal_id, provider_id)
);
CREATE INDEX IF NOT EXISTS idx_goal_provider_links_provider
  ON public.goal_provider_links (provider_id);

-- ─── provider_verification_steps ──────────────────────────────────────────
-- Mirrors the verification pipeline. Each provider has up to one row per
-- step_type. Level 1 (Basic) ships only the elder_endorsement row;
-- Level 2/3 will add document_upload / admin_site_visit rows in later
-- phases as the verification flow expands.
CREATE TABLE IF NOT EXISTS public.provider_verification_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  step_type public.provider_verification_step_type_enum NOT NULL,
  status public.provider_verification_step_status_enum NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, step_type)
);

-- ─── user_savings_goals.provider_category ─────────────────────────────────
-- Lets a user tag a goal with the kind of provider they expect to pay.
-- The list screen filters on this when launched from a goal context.
ALTER TABLE public.user_savings_goals
  ADD COLUMN IF NOT EXISTS provider_category TEXT;

-- ─── Rating aggregation trigger ───────────────────────────────────────────
-- Recomputes providers.rating_avg + rating_count whenever a review row
-- lands, updates, or is deleted. Kept SECURITY DEFINER so RLS doesn't
-- block the providers UPDATE; recomputed from scratch so concurrent
-- writes don't accumulate drift.
CREATE OR REPLACE FUNCTION public.recompute_provider_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id UUID;
BEGIN
  v_provider_id := COALESCE(NEW.provider_id, OLD.provider_id);
  IF v_provider_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  UPDATE public.providers p
     SET rating_avg = COALESCE((
           SELECT ROUND(AVG(rating)::NUMERIC, 2)
             FROM public.provider_reviews
            WHERE provider_id = v_provider_id
         ), 0),
         rating_count = COALESCE((
           SELECT COUNT(*)
             FROM public.provider_reviews
            WHERE provider_id = v_provider_id
         ), 0),
         updated_at = now()
   WHERE p.id = v_provider_id;
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'recompute_provider_rating failed for provider %: %', v_provider_id, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS provider_reviews_recompute ON public.provider_reviews;
CREATE TRIGGER provider_reviews_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.provider_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recompute_provider_rating();

-- ─── updated_at trigger (shared) ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS providers_touch ON public.providers;
CREATE TRIGGER providers_touch
  BEFORE UPDATE ON public.providers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS goal_provider_links_touch ON public.goal_provider_links;
CREATE TRIGGER goal_provider_links_touch
  BEFORE UPDATE ON public.goal_provider_links
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_provider_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_verification_steps ENABLE ROW LEVEL SECURITY;

-- providers
DROP POLICY IF EXISTS providers_public_select ON public.providers;
CREATE POLICY providers_public_select ON public.providers
  FOR SELECT
  USING (
    -- Public sees verified + active rows; owners always see their own
    -- (so they can monitor an in-flight application); admins see all.
    (verification_status = 'verified' AND is_active = TRUE)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS providers_owner_insert ON public.providers;
CREATE POLICY providers_owner_insert ON public.providers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS providers_owner_or_admin_update ON public.providers;
CREATE POLICY providers_owner_or_admin_update ON public.providers
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

-- provider_reviews
DROP POLICY IF EXISTS provider_reviews_public_select ON public.provider_reviews;
CREATE POLICY provider_reviews_public_select ON public.provider_reviews
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS provider_reviews_auth_insert ON public.provider_reviews;
CREATE POLICY provider_reviews_auth_insert ON public.provider_reviews
  FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

DROP POLICY IF EXISTS provider_reviews_owner_update ON public.provider_reviews;
CREATE POLICY provider_reviews_owner_update ON public.provider_reviews
  FOR UPDATE USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS provider_reviews_owner_delete ON public.provider_reviews;
CREATE POLICY provider_reviews_owner_delete ON public.provider_reviews
  FOR DELETE USING (reviewer_id = auth.uid());

-- goal_provider_links — goal owner only across SELECT/INSERT/UPDATE.
DROP POLICY IF EXISTS goal_provider_links_owner_all ON public.goal_provider_links;
CREATE POLICY goal_provider_links_owner_all ON public.goal_provider_links
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_savings_goals g
       WHERE g.id = goal_provider_links.goal_id
         AND g.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_savings_goals g
       WHERE g.id = goal_provider_links.goal_id
         AND g.user_id = auth.uid()
    )
  );

-- provider_verification_steps — provider owner or admin.
DROP POLICY IF EXISTS provider_verification_steps_select ON public.provider_verification_steps;
CREATE POLICY provider_verification_steps_select ON public.provider_verification_steps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
       WHERE p.id = provider_verification_steps.provider_id
         AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS provider_verification_steps_insert ON public.provider_verification_steps;
CREATE POLICY provider_verification_steps_insert ON public.provider_verification_steps
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.providers p
       WHERE p.id = provider_verification_steps.provider_id
         AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS provider_verification_steps_update ON public.provider_verification_steps;
CREATE POLICY provider_verification_steps_update ON public.provider_verification_steps
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.providers p
       WHERE p.id = provider_verification_steps.provider_id
         AND p.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.admin_users a
       WHERE a.user_id = auth.uid() AND a.is_active = TRUE
    )
  );

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '193',
  'provider_network',
  ARRAY['-- 193: provider_network']
)
ON CONFLICT (version) DO NOTHING;
