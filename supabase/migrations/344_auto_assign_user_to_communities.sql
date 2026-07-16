-- ═══════════════════════════════════════════════════════════════════════════
-- 344_auto_assign_user_to_communities.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 1 of the community redesign: auto-assign every user to their
-- country-of-origin community and city-of-origin community on sign-up
-- (or when they later fill in those profile fields).
--
-- Behavior:
--   * When a profile row is INSERTed with country_of_origin or
--     city_of_origin already set, or when either field is UPDATEd to
--     a new value, the auto-assign function fires.
--   * Finds an existing community of that (type, country) or (type,
--     city) and adds the user as an active member. If no matching
--     community exists, creates one first, then adds.
--   * ON CONFLICT DO NOTHING on the membership INSERT — idempotent;
--     re-running for the same user against the same community is a
--     no-op.
--   * Because the membership INSERT lands on community_memberships,
--     mig 342's tr_auto_arrival_from_membership trigger ALSO fires
--     and creates an arrival card. The user gets both auto-membership
--     AND auto-arrival in one hop.
--
-- Data state today:
--   * 0 profiles have country_of_origin set. Backfill at the end is a
--     no-op; the wiring exists so the first real user with origin
--     data flows through the trigger.
--   * 77 communities exist but none have type set. Auto-assign will
--     create new (type='country', country=X) and (type='city', city=X)
--     communities as needed — coexisting with the existing 77.
--   * Migration is authored to be safe alongside the 12 pre-existing
--     profile triggers (audit_trigger, on_profile_created_wallet,
--     trigger_create_financial_profile, trg_sync_profile_to_auth,
--     tr_profiles_update_max_backing, tr_profiles_sync_elder_permissions,
--     update_profiles_updated_at). The new trigger name sorts after
--     them alphabetically; no ordering dependency in either direction.
--
-- Future-proof follow-ups (not in scope):
--   * Cluster existing communities like "Ivorian in USA" under
--     type='country'/'city' so first-real-user assignment attaches to
--     them instead of creating parallels.
--   * Case-insensitive matching for country_of_origin ('US' vs 'us').
--   * Prompt users to add origin/current fields if empty on profile
--     edit surface — otherwise the whole flow never fires.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Profile columns ────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_of_origin TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_city TEXT;

-- Note: profiles.city already exists and is de-facto the current city
-- today. Not migrating city → current_city automatically; leaving
-- both columns for a follow-up product decision on which to
-- canonicalize.

-- ─── 2. Community columns ──────────────────────────────────────────────

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS type    TEXT;
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS city    TEXT;

-- Helper indexes on the lookup columns — auto_assign does exact-match
-- SELECTs on (type, country) and (type, city) once per profile write,
-- so a small btree pays for itself even at low volume.
CREATE INDEX IF NOT EXISTS idx_communities_type_country
  ON public.communities (type, country) WHERE country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_communities_type_city
  ON public.communities (type, city)    WHERE city    IS NOT NULL;

-- ─── 3. auto_assign_user_to_communities(uuid) ──────────────────────────

CREATE OR REPLACE FUNCTION public.auto_assign_user_to_communities(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_country      TEXT;
  v_city         TEXT;
  v_community_id UUID;
BEGIN
  SELECT country_of_origin, city_of_origin
    INTO v_country, v_city
    FROM public.profiles
   WHERE id = p_user_id;

  -- Country community
  IF v_country IS NOT NULL AND v_country <> '' THEN
    SELECT id INTO v_community_id
      FROM public.communities
     WHERE type = 'country' AND country = v_country
     LIMIT 1;

    IF v_community_id IS NULL THEN
      -- created_by is NOT NULL on communities; auto-generated
      -- communities are "created" by the first member who triggered
      -- the auto-assign flow. Later members of the same community
      -- reuse the row (SELECT above finds it) so created_by
      -- reflects the first triggerer, not a fictitious system user.
      INSERT INTO public.communities (name, type, country, description, created_by)
      VALUES (
        v_country || ' Diaspora',
        'country',
        v_country,
        'Community for ' || v_country || ' diaspora',
        p_user_id
      )
      RETURNING id INTO v_community_id;
    END IF;

    INSERT INTO public.community_memberships
      (community_id, user_id, status, joined_at)
    VALUES
      (v_community_id, p_user_id, 'active', NOW())
    ON CONFLICT (user_id, community_id) DO NOTHING;
  END IF;

  -- City community
  IF v_city IS NOT NULL AND v_city <> '' THEN
    SELECT id INTO v_community_id
      FROM public.communities
     WHERE type = 'city' AND city = v_city
     LIMIT 1;

    IF v_community_id IS NULL THEN
      INSERT INTO public.communities (name, type, country, city, description, created_by)
      VALUES (
        v_city || ' Community',
        'city',
        v_country,
        v_city,
        'Community for ' || v_city || ' area',
        p_user_id
      )
      RETURNING id INTO v_community_id;
    END IF;

    INSERT INTO public.community_memberships
      (community_id, user_id, status, joined_at)
    VALUES
      (v_community_id, p_user_id, 'active', NOW())
    ON CONFLICT (user_id, community_id) DO NOTHING;
  END IF;
END;
$$;

-- ─── 4. Trigger — INSERT + UPDATE OF origin fields ─────────────────────
-- One trigger + one function handles both events. The trigger function
-- inspects TG_OP so INSERT only fires when the origin fields are
-- populated at creation, and UPDATE only fires when either changes.

CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (NEW.country_of_origin IS NOT NULL AND NEW.country_of_origin <> '')
       OR (NEW.city_of_origin IS NOT NULL AND NEW.city_of_origin <> '') THEN
      PERFORM public.auto_assign_user_to_communities(NEW.id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.country_of_origin IS DISTINCT FROM OLD.country_of_origin)
       OR (NEW.city_of_origin IS DISTINCT FROM OLD.city_of_origin) THEN
      PERFORM public.auto_assign_user_to_communities(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_auto_assign_on_profile_change ON public.profiles;

CREATE TRIGGER tr_auto_assign_on_profile_change
  AFTER INSERT OR UPDATE OF country_of_origin, city_of_origin
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_on_profile_change();

-- ─── 5. Backfill — any existing profile with origin data ───────────────
-- No-op today (0 profiles have country_of_origin set), but wires the
-- flow so any pre-existing edge case gets swept up.

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id FROM public.profiles
     WHERE (country_of_origin IS NOT NULL AND country_of_origin <> '')
        OR (city_of_origin    IS NOT NULL AND city_of_origin    <> '')
  LOOP
    PERFORM public.auto_assign_user_to_communities(v_row.id);
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '344',
  'auto_assign_user_to_communities',
  ARRAY['-- 344: origin columns on profiles + type/country/city on communities + auto_assign fn + INSERT/UPDATE trigger + backfill']
)
ON CONFLICT (version) DO NOTHING;
