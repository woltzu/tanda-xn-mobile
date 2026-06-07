-- ============================================================================
-- Migration 121: referral reward -> wallet credit processing
-- ============================================================================
-- Migration 120 wrote referral_rewards rows when a referral converted
-- (referrer + referred each get a $10 row), but no path actually applied
-- those credits to user_wallets. This migration closes the loop with:
--
--   1. New columns on referral_rewards:
--        processed_at  TIMESTAMPTZ  (NULL = unpaid)
--        notes         TEXT         (ops-readable trace -- "wallet auto-
--                                    created" / "user_wallets row missing"
--                                    / etc.)
--      Plus a partial index on (processed_at) WHERE NULL so the RPC's
--      "find unpaid" scan stays cheap as the table grows.
--
--   2. process_referral_rewards() RPC. For every unpaid row:
--        SELECT ... FOR UPDATE on the recipient's user_wallets row
--        (creates one if missing -- a brand-new referred user might not
--        have a wallet yet),
--        UPDATE user_wallets.main_balance_cents += reward.amount_cents
--        (total_balance_cents + available_balance_cents are GENERATED
--        ALWAYS so they auto-derive),
--        UPDATE referral_rewards.processed_at = NOW() + notes
--      Each row in its own BEGIN..EXCEPTION sub-transaction so one bad
--      record doesn't block the batch. Returns
--        { processed_count, total_amount_cents, errors[], source }.
--
--   3. Schedule: cron 'process-referral-rewards-daily' at 30 3 * * *
--      calling the EF -- same DO + unschedule idiom as migrations 116/118.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: schema
-- ----------------------------------------------------------------------------
ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes        TEXT;

-- Partial index on the "find unpaid" predicate so the daily scan stays
-- O(unpaid) instead of O(all-time-rewards) as the table grows.
CREATE INDEX IF NOT EXISTS idx_referral_rewards_unprocessed
  ON public.referral_rewards (processed_at)
  WHERE processed_at IS NULL;


-- ----------------------------------------------------------------------------
-- Step 2: process_referral_rewards() RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_rewards()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_reward RECORD;
  v_wallet_exists BOOLEAN;
  v_processed_count INTEGER := 0;
  v_total_cents BIGINT := 0;
  v_errors JSONB := '[]'::jsonb;
  v_note TEXT;
BEGIN
  -- ORDER BY created_at so the oldest credit gets applied first; not
  -- strictly necessary but keeps the audit trail intuitive.
  FOR v_reward IN
    SELECT id, user_id, amount_cents, source, referral_id, created_at
    FROM   referral_rewards
    WHERE  processed_at IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN
      v_note := NULL;

      -- Lock the wallet row. If the user doesn't have a wallet, create
      -- one with a zero balance so the credit lands somewhere -- a
      -- brand-new referred user might not have had a wallet created
      -- yet, and we don't want their reward stranded.
      SELECT TRUE INTO v_wallet_exists
      FROM   user_wallets
      WHERE  user_id = v_reward.user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO user_wallets (user_id, main_balance_cents)
        VALUES (v_reward.user_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
        v_note := 'wallet auto-created';
      END IF;

      -- Apply the credit. total_balance_cents + available_balance_cents
      -- are GENERATED ALWAYS off main_balance_cents so we only have to
      -- touch the one column.
      UPDATE user_wallets
      SET    main_balance_cents = main_balance_cents + v_reward.amount_cents,
             last_activity_at   = NOW(),
             updated_at         = NOW()
      WHERE  user_id = v_reward.user_id;

      -- Mark the reward processed. Idempotency is enforced by the
      -- WHERE processed_at IS NULL clause -- a concurrent processor
      -- that already grabbed this row will have set processed_at
      -- non-NULL and our update becomes a no-op.
      UPDATE referral_rewards
      SET    processed_at = NOW(),
             notes        = COALESCE(v_note, 'credited to wallet')
      WHERE  id = v_reward.id
        AND  processed_at IS NULL;

      IF FOUND THEN
        v_processed_count := v_processed_count + 1;
        v_total_cents     := v_total_cents + v_reward.amount_cents;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Per-row failure: capture and continue. Stamp the reward with a
      -- note describing the failure so an operator inspecting unpaid
      -- rows can find the failure cause without trawling logs. We
      -- deliberately do NOT set processed_at so the retry happens next
      -- run.
      BEGIN
        UPDATE referral_rewards
        SET    notes = format('error: %s (last_attempt: %s)', SQLERRM, NOW())
        WHERE  id = v_reward.id;
      EXCEPTION WHEN OTHERS THEN
        -- If even the note update fails, swallow -- the next iteration
        -- still needs to run.
        NULL;
      END;

      v_errors := v_errors || jsonb_build_object(
        'reward_id', v_reward.id,
        'user_id',   v_reward.user_id,
        'error',     SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'processed_count',    v_processed_count,
    'total_amount_cents', v_total_cents,
    'errors',             v_errors,
    'error_count',        jsonb_array_length(v_errors),
    'source',             'process_referral_rewards_v1'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_referral_rewards() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.process_referral_rewards() TO service_role;


-- ----------------------------------------------------------------------------
-- Step 3: schedule the daily cron
-- ----------------------------------------------------------------------------
-- Same DO + cron.unschedule + cron.schedule idiom as migrations 116/118,
-- so re-running this migration cleanly replaces the schedule. Calls the
-- process-referral-rewards-cron EF (deployed in this commit).
DO $$ BEGIN PERFORM cron.unschedule('process-referral-rewards-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'process-referral-rewards-daily',
  '30 3 * * *',                       -- 03:30 UTC daily
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/process-referral-rewards-cron',
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
VALUES ('121', 'referral_reward_processing',
        ARRAY['-- 121: processed_at column + process_referral_rewards() RPC + daily cron'])
ON CONFLICT (version) DO NOTHING;
