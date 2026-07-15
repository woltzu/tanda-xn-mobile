-- ═══════════════════════════════════════════════════════════════════════════
-- 325_profiles_address_occupation.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- calculate_profile_completion (called by calculate_initial_xnscore, which
-- is called by the daily recalculate_all_xn_scores) checks 10 profile
-- fields. After mig 319 + 324 unblocked email_verified / identity_verified /
-- invited_by, mig 324's backfill loop threw on the FIRST profile field it
-- couldn't find:
--   ERROR 42703: record "v_profile" has no field "address"
--
-- Auditing calculate_profile_completion's full reads:
--   full_name, email, phone, date_of_birth, city, country, avatar_url,
--   bio, occupation, address
--
-- Missing on the live schema: `address` and `occupation`. Everything
-- else was already there.
--
-- Fix — add both columns nullable / default NULL. The scoring math
-- treats NULL as "not provided" → doesn't count toward profile_completion.
-- Follow-up backfill re-runs recalculate_all_xn_scores now that all
-- v_profile.* reads resolve.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address    TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT;

-- Re-run the backfill now that the profile chain is complete.
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'Backfilled % xn_scores rows (after address/occupation fix)', v_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '325',
  'profiles_address_occupation',
  ARRAY['-- 325: add profiles.address + occupation to complete calculate_profile_completion chain']
)
ON CONFLICT (version) DO NOTHING;
