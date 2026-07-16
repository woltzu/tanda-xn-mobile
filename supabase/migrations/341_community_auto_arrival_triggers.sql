-- ═══════════════════════════════════════════════════════════════════════════
-- 341_community_auto_arrival_triggers.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes Bug 2 from the community-tab audit: mig 056 was designed to
-- auto-generate a community_arrivals row when a member completed KYC,
-- but the trigger was never created. New members joining a community
-- did NOT show up on the "New arrivals" section of the community tab
-- unless a row was manually inserted.
--
-- Scope decision (product):
--   * Primary trigger: fires on community_members INSERT. Simplest
--     and most useful — the moment a user joins a community they
--     appear on that community's arrivals feed. This is what a "new
--     arrival" naturally means, and it works regardless of KYC state.
--   * KYC-completion trigger DEFERRED: for a KYC-verified user who
--     is already a community member, they'd already have an arrival
--     from the membership INSERT above — the KYC trigger would just
--     be a duplicate (UNIQUE(user_id, community_id) would drop it).
--     For a KYC-verified user with zero communities, we don't know
--     which community to arrive them into. So the KYC trigger adds
--     zero value on top of the membership trigger. Skipping it.
--
-- Column mapping — profile → arrivals:
--   full_name              → first_name         (split on space, first token)
--   country_of_origin      → origin_country
--   city                   → current_city
--   origin_city, origin_country_flag, current_neighborhood → NULL
--     (profiles has no fields for these; users can complete their
--      arrival details from a future edit surface)
--
-- Idempotency: community_arrivals has UNIQUE(user_id, community_id),
-- so the trigger uses ON CONFLICT DO NOTHING. A member who leaves +
-- rejoins the same community will keep their original arrival row
-- (its 30-day expiry stays put — this matches "welcome cards shown
-- for first 30 days" semantics from mig 056).
--
-- Backfill: every existing (user_id, community_id) pair in
-- community_members that doesn't already have an arrivals row gets
-- one, with the arrival timestamped to the membership's joined_at
-- (or NOW() if that's null) so the 30-day expiry window feels
-- historically accurate.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Trigger function ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_arrival_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_profile     RECORD;
  v_first_name  TEXT;
BEGIN
  SELECT full_name, country_of_origin, city
    INTO v_profile
    FROM public.profiles
   WHERE id = NEW.user_id;

  -- Best-effort first-name extraction. Fall back to a generic label
  -- if the profile row is missing or full_name is empty; the arrival
  -- card still renders with a reasonable placeholder.
  v_first_name := COALESCE(
    NULLIF(split_part(COALESCE(v_profile.full_name, ''), ' ', 1), ''),
    'New member'
  );

  BEGIN
    INSERT INTO public.community_arrivals
      (user_id, community_id, first_name, origin_country, current_city)
    VALUES
      (NEW.user_id, NEW.community_id, v_first_name,
       v_profile.country_of_origin, v_profile.city)
    ON CONFLICT (user_id, community_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the membership INSERT on an arrival-write failure.
    RAISE NOTICE 'auto_arrival_from_membership failed for user % / community %: %',
                 NEW.user_id, NEW.community_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ─── 2. Trigger — AFTER INSERT on community_members ─────────────────────

DROP TRIGGER IF EXISTS tr_auto_arrival_from_membership
  ON public.community_members;

CREATE TRIGGER tr_auto_arrival_from_membership
  AFTER INSERT ON public.community_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_arrival_from_membership();

-- ─── 3. Backfill — existing memberships without arrivals ────────────────

INSERT INTO public.community_arrivals
  (user_id, community_id, first_name, origin_country, current_city,
   created_at, expires_at)
SELECT
  cm.user_id,
  cm.community_id,
  COALESCE(NULLIF(split_part(COALESCE(p.full_name, ''), ' ', 1), ''),
           'New member') AS first_name,
  p.country_of_origin,
  p.city,
  COALESCE(cm.joined_at, NOW()) AS created_at,
  -- Preserve the "30 days after joining" welcome-window semantics
  -- even for backfilled rows. For members who joined > 30 days ago,
  -- their arrival card is already expired and won't render.
  COALESCE(cm.joined_at, NOW()) + INTERVAL '30 days' AS expires_at
FROM public.community_members cm
LEFT JOIN public.profiles p ON p.id = cm.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_arrivals ca
   WHERE ca.user_id = cm.user_id
     AND ca.community_id = cm.community_id
);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '341',
  'community_auto_arrival_triggers',
  ARRAY['-- 341: AFTER INSERT trigger on community_members auto-inserts community_arrivals; backfill for existing memberships']
)
ON CONFLICT (version) DO NOTHING;
