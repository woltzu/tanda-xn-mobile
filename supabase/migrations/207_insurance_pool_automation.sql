-- ════════════════════════════════════════════════════════════════════════════
-- Migration 207: insurance_pool_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Two background triggers that take the manual "watch the pool" job away
-- from the elders and surface meaningful events as notifications:
--
--   * notify_claim_paid       — fires when an insurance_coverage_claims
--                                row lands or transitions to status
--                                'approved' or 'partial'. Sends one row
--                                to the defaulter and one per elder /
--                                admin / creator of the circle.
--
--   * notify_low_pool_balance — fires when circle_insurance_pools.
--                                balance_cents drops below the safety
--                                threshold (per spec: average per-cycle
--                                contribution × member count × 0.8).
--                                One-shot per dip via last_alerted_at:
--                                the trigger refuses to re-notify until
--                                the balance has recovered above the
--                                threshold (which clears the timestamp).
--
-- Both follow the SECURITY DEFINER + search_path + EXCEPTION pattern from
-- migrations 188/190/195/205. A trigger failure must never roll back the
-- write that fired it (losing a notification is recoverable; losing the
-- claim or the balance update is not).
--
-- Self-registers in supabase_migrations.schema_migrations.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. New column tracking the most recent low-balance alert. NULL = the
--    pool has never been low (or has recovered since the last alert).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.circle_insurance_pools
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notify_claim_paid — fan out to defaulter + elders.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_claim_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_amount_str  TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
BEGIN
  -- Only act on a real transition into a paid state.
  IF NEW.status NOT IN ('approved', 'partial') THEN
    RETURN NEW;
  END IF;
  -- On UPDATE, require a real change. INSERT always passes.
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');
  v_amount_str := '$' || ROUND(NEW.approved_amount_cents / 100.0, 2)::TEXT;

  -- ─── Defaulter notification (single row, idempotent) ────────────────────
  SELECT id INTO v_existing_id
    FROM public.notifications
   WHERE user_id = NEW.defaulter_user_id
     AND type = 'claim_paid'
     AND data->>'claim_id' = NEW.id::text
     AND data->>'status' = NEW.status
   LIMIT 1;
  IF v_existing_id IS NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.defaulter_user_id,
      'claim_paid',
      'Your shortfall was covered',
      'The pool covered ' || v_amount_str || ' for your missed contribution in ' || v_circle_name || '.',
      jsonb_build_object(
        'claim_id',       NEW.id,
        'status',         NEW.status,
        'circle_id',      NEW.circle_id,
        'amount_cents',   NEW.approved_amount_cents,
        'circle_name',    v_circle_name,
        'recipient_role', 'defaulter',
        'i18n_title_key', 'insurance.notification_claim_paid_defaulter_title',
        'i18n_body_key',  'insurance.notification_claim_paid_defaulter_body'
      ),
      FALSE
    );
  END IF;

  -- ─── Elder / admin / creator notifications (one row per recipient) ──────
  FOR v_recipient IN
    SELECT user_id
      FROM public.circle_members
     WHERE circle_id = NEW.circle_id
       AND role IN ('elder', 'admin', 'creator')
       AND status = 'active'
  LOOP
    -- Skip the defaulter if they happen to also be an elder/admin — they
    -- already got the defaulter copy above.
    IF v_recipient.user_id = NEW.defaulter_user_id THEN
      CONTINUE;
    END IF;
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_recipient.user_id
       AND type = 'claim_paid'
       AND data->>'claim_id' = NEW.id::text
       AND data->>'status' = NEW.status
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_recipient.user_id,
        'claim_paid',
        'Pool covered a member',
        'The pool covered ' || v_amount_str || ' for a missed contribution in ' || v_circle_name || '.',
        jsonb_build_object(
          'claim_id',       NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'amount_cents',   NEW.approved_amount_cents,
          'circle_name',    v_circle_name,
          'recipient_role', 'elder',
          'i18n_title_key', 'insurance.notification_claim_paid_elder_title',
          'i18n_body_key',  'insurance.notification_claim_paid_elder_body'
        ),
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_claim_paid failed for claim %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS insurance_coverage_claims_notify ON public.insurance_coverage_claims;
CREATE TRIGGER insurance_coverage_claims_notify
  AFTER INSERT OR UPDATE OF status ON public.insurance_coverage_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_claim_paid();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. notify_low_pool_balance — fire once per dip below the safety threshold.
-- ─────────────────────────────────────────────────────────────────────────────
-- Threshold = circle.amount × active_member_count × 0.8 (per spec). The
-- multiplier .8 is the 80 % coverage ceiling — at the threshold the pool
-- can still cover one full default cycle.
--
-- Idempotency: last_alerted_at column on the pool. The trigger refuses to
-- re-notify while last_alerted_at is set; recovery above the threshold
-- clears the timestamp so the next dip can fire fresh.
--
-- The trigger fires on UPDATE OF balance_cents — it does NOT fire on the
-- UPDATEs the function itself makes to last_alerted_at, so there's no
-- recursion risk. The function uses AFTER UPDATE so the new balance is
-- already committed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_low_pool_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_threshold_cents BIGINT;
  v_circle_name     TEXT;
  v_recipient       RECORD;
  v_existing_id     UUID;
BEGIN
  -- Skip no-op UPDATEs that don't actually move balance_cents.
  IF OLD.balance_cents = NEW.balance_cents THEN
    RETURN NEW;
  END IF;

  -- Compute the safety threshold for this circle. amount is NUMERIC dollars,
  -- balance_cents is BIGINT cents — convert once.
  SELECT
    ROUND(c.amount * (
      SELECT COUNT(*)::BIGINT
        FROM public.circle_members cm
       WHERE cm.circle_id = c.id AND cm.status = 'active'
    ) * 0.8 * 100)::BIGINT,
    c.name
  INTO v_threshold_cents, v_circle_name
  FROM public.circles c
  WHERE c.id = NEW.circle_id;

  IF v_threshold_cents IS NULL OR v_threshold_cents = 0 THEN
    -- Circle has no contribution amount or no active members — nothing
    -- meaningful to compare against. Bail early.
    RETURN NEW;
  END IF;

  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- ─── Below threshold AND not currently alerted: fire and stamp ──────────
  IF NEW.balance_cents < v_threshold_cents AND NEW.last_alerted_at IS NULL THEN
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'low_pool_balance'
         AND data->>'circle_id' = NEW.circle_id::text
         AND data->>'dip_at' = NOW()::text
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'low_pool_balance',
          'Pool balance is low',
          'The insurance pool for ' || v_circle_name || ' is below the safety threshold.',
          jsonb_build_object(
            'circle_id',       NEW.circle_id,
            'balance_cents',   NEW.balance_cents,
            'threshold_cents', v_threshold_cents,
            'circle_name',     v_circle_name,
            'dip_at',          NOW(),
            'i18n_title_key',  'insurance.notification_low_balance_title',
            'i18n_body_key',   'insurance.notification_low_balance_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

    -- Stamp so we don't re-fire until recovery clears the flag.
    UPDATE public.circle_insurance_pools
       SET last_alerted_at = NOW()
     WHERE id = NEW.id;

  -- ─── Recovered above threshold: clear the flag so the next dip alerts ──
  ELSIF NEW.balance_cents >= v_threshold_cents AND NEW.last_alerted_at IS NOT NULL THEN
    UPDATE public.circle_insurance_pools
       SET last_alerted_at = NULL
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_low_pool_balance failed for circle %: %', NEW.circle_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_insurance_pools_low_balance ON public.circle_insurance_pools;
CREATE TRIGGER circle_insurance_pools_low_balance
  AFTER UPDATE OF balance_cents ON public.circle_insurance_pools
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_pool_balance();


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '207',
  'insurance_pool_automation',
  ARRAY['-- 207: insurance_pool_automation']
)
ON CONFLICT (version) DO NOTHING;
