-- ============================================================================
-- Migration 120: referral program
-- ============================================================================
-- Three tables + one reward function + one trigger. Each referral row
-- carries the referrer / referred pair and a status (pending -> completed
-- on the referred user's first paid contribution).
--
--   referral_codes      one row per user, holds their 8-char shareable code
--   referrals           one row per (referrer, referred) pair, unique on
--                       referred_user_id so a user can only be referred once
--   referral_rewards    one row per credit event ($10 for the referrer +
--                       $10 for the referred at completion, in cents)
--
-- The reward bookkeeping records the credit; the actual wallet payout is
-- left to a downstream EF/cron that reads unpaid rows. This keeps the
-- referral migration self-contained and decouples it from whatever the
-- wallet implementation eventually is.
--
-- The trigger on cycle_contributions fires AFTER UPDATE when status
-- transitions to 'paid' and calls process_referral_reward(NEW.user_id).
-- The reward function is wrapped so it can never block a contribution
-- update even if the referral plumbing has a bug.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One code per user. A second insert for the same user_id should no-op
-- gracefully -- the EF treats the conflict as "already issued, return
-- existing".
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_codes_user_id
  ON public.referral_codes(user_id);


CREATE TABLE IF NOT EXISTS public.referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'expired')),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A user can only be referred once. The apply-referral EF treats a
  -- conflict as "already referred, return error" so a malicious caller
  -- can't reassign credit.
  CONSTRAINT uq_referrals_referred_once UNIQUE (referred_user_id),
  -- Self-referrals get rejected at the application layer too, but
  -- belt + braces.
  CONSTRAINT chk_referrals_not_self CHECK (referrer_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON public.referrals(referrer_id, status);


CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents  INTEGER NOT NULL,
  source        TEXT NOT NULL
                CHECK (source IN ('referred_signup', 'referred_contribution')),
  referral_id   UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Two rows per referral completion (one for each side). The (referral_id,
-- source) pair is the natural idempotency key for the reward function.
-- referral_id is nullable in case we ever record an out-of-band reward
-- not tied to a referrals row (manual ops grant, partner promo, etc.);
-- the function uses (referral_id, source) for its ON CONFLICT lookup,
-- which simply doesn't match NULL rows -- PG treats NULLs as distinct
-- under UNIQUE, so manual rows can't collide. Simpler than a partial
-- index + partial-ON-CONFLICT-WHERE which has parse fragility in some
-- PG versions.
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_rewards_one_per_side
  ON public.referral_rewards(referral_id, source);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user
  ON public.referral_rewards(user_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.referral_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards  ENABLE ROW LEVEL SECURITY;

-- referral_codes: users see their own row. Service role does all writes.
DROP POLICY IF EXISTS "service_all_referral_codes" ON public.referral_codes;
CREATE POLICY "service_all_referral_codes"
  ON public.referral_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "owner_read_referral_codes" ON public.referral_codes;
CREATE POLICY "owner_read_referral_codes"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- referrals: users see rows where they're either the referrer or the
-- referred. Service role does all writes.
DROP POLICY IF EXISTS "service_all_referrals" ON public.referrals;
CREATE POLICY "service_all_referrals"
  ON public.referrals FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "participants_read_referrals" ON public.referrals;
CREATE POLICY "participants_read_referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- referral_rewards: users see their own credits. Service role writes.
DROP POLICY IF EXISTS "service_all_referral_rewards" ON public.referral_rewards;
CREATE POLICY "service_all_referral_rewards"
  ON public.referral_rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "owner_read_referral_rewards" ON public.referral_rewards;
CREATE POLICY "owner_read_referral_rewards"
  ON public.referral_rewards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- process_referral_reward(p_user_id UUID)
-- Called by the trigger below on the referred user's first paid
-- contribution. Idempotent: the partial unique index on
-- referral_rewards(referral_id, source) means a duplicate call after
-- the referral is already completed becomes a no-op via ON CONFLICT.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_reward(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_referral RECORD;
  v_reward_cents INTEGER := 1000;   -- $10 each side, in cents
BEGIN
  -- Find the (single) pending referral where this user is the referred
  -- side. The uq_referrals_referred_once UNIQUE constraint means there
  -- can be at most one row per p_user_id.
  SELECT id, referrer_id
    INTO v_referral
  FROM   referrals
  WHERE  referred_user_id = p_user_id
    AND  status = 'pending'
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'rewarded', false,
      'reason', 'no_pending_referral',
      'source', 'process_referral_reward_v1'
    );
  END IF;

  -- Mark the referral completed first so a concurrent trigger fire
  -- (unlikely but defensive) finds it already-completed and bails.
  UPDATE referrals
  SET    status = 'completed',
         completed_at = NOW()
  WHERE  id = v_referral.id
    AND  status = 'pending';

  -- Insert the two reward rows. ON CONFLICT DO NOTHING uses the
  -- (referral_id, source) partial unique index for idempotency.
  INSERT INTO referral_rewards (user_id, amount_cents, source, referral_id)
  VALUES
    (v_referral.referrer_id, v_reward_cents, 'referred_contribution', v_referral.id),
    (p_user_id,              v_reward_cents, 'referred_signup',       v_referral.id)
  ON CONFLICT (referral_id, source) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'rewarded', true,
    'referral_id', v_referral.id,
    'referrer_id', v_referral.referrer_id,
    'amount_cents_per_side', v_reward_cents,
    'source', 'process_referral_reward_v1'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_referral_reward(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.process_referral_reward(UUID) TO service_role;


-- ----------------------------------------------------------------------------
-- Trigger: fire on cycle_contributions paid-transition
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cycle_contribution_referral_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Only fire on the first transition into 'paid'. The trigger is AFTER
  -- UPDATE so the row is durable before we cascade.
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    -- Wrapped: a referral-plumbing bug should never block contribution
    -- state from advancing.
    BEGIN
      PERFORM process_referral_reward(NEW.user_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'process_referral_reward failed for user=% contribution=%: %',
        NEW.user_id, NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cycle_contribution_referral
  ON public.cycle_contributions;

CREATE TRIGGER trg_cycle_contribution_referral
  AFTER UPDATE ON public.cycle_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.cycle_contribution_referral_trigger();


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('120', 'referral_program',
        ARRAY['-- 120: referral_codes + referrals + referral_rewards + reward trigger'])
ON CONFLICT (version) DO NOTHING;
