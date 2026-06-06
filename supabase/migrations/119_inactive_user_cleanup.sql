-- ============================================================================
-- Migration 119: automated cleanup of inactive users
-- ============================================================================
-- Compliance-driven. Users that haven't signed in for 24+ months are
-- anonymized so we shed PII (KYC documents in particular) while retaining
-- the minimum transaction footprint AML retention rules require us to
-- keep. The actual erasure runs through a SECURITY DEFINER RPC, called
-- monthly by a dedicated Edge Function, scheduled here.
--
-- Schema changes
--   profiles  + last_active_at   timestamptz, mirrors auth.users.last_sign_in_at
--             + is_active        boolean default true (cleared on anonymization)
--             + anonymized_at    timestamptz (stamp on completion; null = active)
--
-- Function
--   delete_inactive_users(
--     p_inactivity_months INTEGER DEFAULT 24,
--     p_dry_run BOOLEAN DEFAULT true,         <-- defaults to dry-run for safety
--     p_max_users INTEGER DEFAULT 1000
--   ) RETURNS JSONB
--
--   Finds candidates via auth.users.last_sign_in_at; skips already-
--   anonymized profiles. For each:
--     1. Cancels pending contributions (status='pending'   -> 'cancelled')
--     2. Cancels in-flight advances    (status IN ('requested','queued')
--                                       -> 'cancelled'). Approved/disbursed/
--                                       repaying advances are intentionally
--                                       NOT touched -- AML.
--     3. Wipes KYC PII from kyc_documents + kyc_verifications + user_kyc.
--     4. Anonymizes the profile row: full_name = 'Deleted User',
--        email = 'deleted_<id>@deleted.tandaxn.com',
--        is_active = false, anonymized_at = NOW().
--   Each user is wrapped in BEGIN..EXCEPTION so a single bad row never
--   aborts the sweep.
--
-- Dry-run-by-default is the safety belt: the cron job has to explicitly
-- pass p_dry_run := false in its RPC call, and an accidental call to
-- the function with no args returns a count without touching anything.
--
-- The EF (supabase/functions/inactive-user-cleanup-cron) writes the
-- result into cron_job_logs so cron-monitor sees it like every other
-- scheduled task.
--
-- Schedule: 0 3 1 * *  (1st of every month at 03:00 UTC), via the cron
-- block at the bottom of this file. Same DO + unschedule idiom as
-- migration 116.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: schema
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active      BOOLEAN     DEFAULT true,
  ADD COLUMN IF NOT EXISTS anonymized_at  TIMESTAMPTZ;

-- Backfill last_active_at from auth.users.last_sign_in_at -- the
-- migration is monthly-cron-adjacent so we want the value to reflect
-- reality on day one rather than NULL.
UPDATE profiles p
SET    last_active_at = au.last_sign_in_at
FROM   auth.users au
WHERE  au.id = p.id
  AND  p.last_active_at IS NULL
  AND  au.last_sign_in_at IS NOT NULL;

-- "Find candidates" hits this often; keep it indexed.
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at
  ON profiles (last_active_at)
  WHERE is_active = true AND anonymized_at IS NULL;


-- ----------------------------------------------------------------------------
-- Step 2: delete_inactive_users()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_inactive_users(
  p_inactivity_months INTEGER DEFAULT 24,
  p_dry_run BOOLEAN DEFAULT true,
  p_max_users INTEGER DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_user RECORD;
  v_users_processed INTEGER := 0;
  v_users_anonymized INTEGER := 0;
  v_contributions_cancelled INTEGER := 0;
  v_advances_cancelled INTEGER := 0;
  v_kyc_rows_deleted INTEGER := 0;
  v_per_user_contribs INTEGER;
  v_per_user_advances INTEGER;
  v_per_user_kyc INTEGER;
  v_errors TEXT[] := ARRAY[]::TEXT[];
  v_candidate_count INTEGER;
BEGIN
  v_cutoff := NOW() - (p_inactivity_months || ' months')::INTERVAL;

  -- How many candidates exist before we touch anything? Always
  -- computed; surfaces in the JSONB return whether or not we delete.
  SELECT COUNT(*) INTO v_candidate_count
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE p.is_active = true
    AND p.anonymized_at IS NULL
    AND au.last_sign_in_at IS NOT NULL
    AND au.last_sign_in_at < v_cutoff;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'cutoff', v_cutoff,
      'inactivity_months', p_inactivity_months,
      'candidate_count', v_candidate_count,
      'note', 'No rows changed. Re-run with p_dry_run := false to apply.',
      'source', 'delete_inactive_users_v1'
    );
  END IF;

  -- Real run: loop up to p_max_users candidates.
  FOR v_user IN
    SELECT au.id, au.last_sign_in_at
    FROM   auth.users au
    JOIN   profiles  p  ON p.id = au.id
    WHERE  p.is_active = true
      AND  p.anonymized_at IS NULL
      AND  au.last_sign_in_at IS NOT NULL
      AND  au.last_sign_in_at < v_cutoff
    ORDER BY au.last_sign_in_at ASC          -- oldest-inactive first
    LIMIT  p_max_users
  LOOP
    v_users_processed := v_users_processed + 1;
    v_per_user_contribs := 0;
    v_per_user_advances := 0;
    v_per_user_kyc      := 0;

    BEGIN
      -- (1) Cancel pending contributions
      UPDATE cycle_contributions
      SET    status = 'cancelled', updated_at = NOW()
      WHERE  user_id = v_user.id
        AND  status = 'pending';
      GET DIAGNOSTICS v_per_user_contribs = ROW_COUNT;

      -- (2) Cancel in-flight advances. We deliberately do NOT touch
      --     approved/disbursed/repaying advances: those represent
      --     funds in motion and AML rules require us to preserve the
      --     trail.
      UPDATE liquidity_advances
      SET    status = 'cancelled', updated_at = NOW()
      WHERE  member_id = v_user.id
        AND  status IN ('requested', 'queued');
      GET DIAGNOSTICS v_per_user_advances = ROW_COUNT;

      -- (3) Wipe KYC PII. Each table is best-effort -- a missing
      --     table on a future schema shouldn't break the sweep.
      BEGIN
        DELETE FROM kyc_documents     WHERE user_id = v_user.id;
        GET DIAGNOSTICS v_per_user_kyc = ROW_COUNT;
      EXCEPTION WHEN undefined_table THEN NULL; END;

      BEGIN
        DELETE FROM kyc_verifications WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL; END;

      BEGIN
        DELETE FROM user_kyc          WHERE user_id = v_user.id;
      EXCEPTION WHEN undefined_table THEN NULL; END;

      -- (4) Anonymize the profile row. Keep the row so historical
      --     foreign keys (transactions, payouts, audit logs) still
      --     resolve, but strip every identifier.
      UPDATE profiles
      SET    full_name      = 'Deleted User',
             email          = 'deleted_' || v_user.id::TEXT || '@deleted.tandaxn.com',
             is_active      = false,
             anonymized_at  = NOW(),
             updated_at     = NOW()
      WHERE  id = v_user.id;

      v_users_anonymized        := v_users_anonymized + 1;
      v_contributions_cancelled := v_contributions_cancelled + v_per_user_contribs;
      v_advances_cancelled      := v_advances_cancelled + v_per_user_advances;
      v_kyc_rows_deleted        := v_kyc_rows_deleted + v_per_user_kyc;

    EXCEPTION WHEN OTHERS THEN
      -- One bad user row should not abort the whole sweep.
      v_errors := array_append(v_errors,
        format('%s: %s', v_user.id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'dry_run', false,
    'cutoff', v_cutoff,
    'inactivity_months', p_inactivity_months,
    'candidate_count', v_candidate_count,
    'users_processed', v_users_processed,
    'users_anonymized', v_users_anonymized,
    'contributions_cancelled', v_contributions_cancelled,
    'advances_cancelled', v_advances_cancelled,
    'kyc_rows_deleted', v_kyc_rows_deleted,
    'errors', to_jsonb(v_errors),
    'source', 'delete_inactive_users_v1'
  );
END;
$function$;


-- ----------------------------------------------------------------------------
-- Grants (service_role only -- this is an admin operation, not callable
-- by end users)
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.delete_inactive_users(INTEGER, BOOLEAN, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_inactive_users(INTEGER, BOOLEAN, INTEGER)
  TO service_role;


-- ----------------------------------------------------------------------------
-- Schedule the monthly cron. Calls the inactive-user-cleanup-cron EF
-- (deployed in the same commit as this migration).
-- ----------------------------------------------------------------------------
DO $$ BEGIN PERFORM cron.unschedule('inactive-user-cleanup-monthly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'inactive-user-cleanup-monthly',
  '0 3 1 * *',                          -- 1st of every month at 03:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/inactive-user-cleanup-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('119', 'inactive_user_cleanup',
        ARRAY['-- 119: delete_inactive_users() + monthly EF cron'])
ON CONFLICT (version) DO NOTHING;
