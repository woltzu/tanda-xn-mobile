-- ═══════════════════════════════════════════════════════════════════════════
-- 294_bulletproof_goal_deposit_and_home_feed_milestone.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two aligned goals:
--
-- A. Make transfer_to_goal / credit_goal_external bulletproof — the money
--    movement and milestone recording must succeed even if any downstream
--    celebration side-effect (feed post, notification, new wallet-txn row)
--    blows up.
--
-- B. Surface goal-milestone crossings in the Home activity feed. The feed
--    hook `useRecentActivity` reads wallet_transactions filtered by
--    user_id — so a new AFTER-INSERT trigger on goal_milestones writes a
--    zero-amount informational row into wallet_transactions.
--
-- Current state of the triggers on goal_milestones (pre-294):
--   * goal_milestone_auto_post   (mig 155)  → feed_posts row (community
--                                              dream feed). NOT wrapped in
--                                              an EXCEPTION handler — a
--                                              feed_posts RLS or column
--                                              mismatch would take the
--                                              whole deposit down.
--   * goal_milestones_notify     (mig 181)  → notifications row for the
--                                              goal owner. Already wrapped.
--
-- What 294 does:
--   1. Redefine _record_goal_milestones with an outer EXCEPTION block so
--      any error inside (helper body OR a downstream trigger that itself
--      fails) is swallowed. Money movement + savings_transactions row are
--      guaranteed to survive.
--   2. Redefine post_goal_milestone_to_feed to wrap its body in EXCEPTION
--      (matches the pattern in migration 181's notify_goal_milestone).
--   3. Add post_goal_milestone_to_home_feed + attach it as a new AFTER
--      INSERT trigger, wrapped in EXCEPTION.
--
-- Idempotency: goal_milestones already carries UNIQUE (goal_id,
-- milestone_percent) plus ON CONFLICT DO NOTHING in _record_goal_milestones
-- (migration 078). Each crossing fires the new home-feed trigger exactly
-- once — no dedupe needed here.
--
-- No RLS change. wallet_transactions.SELECT policy already scopes to
-- user_id = auth.uid(); the new row inherits the goal owner's user_id
-- and shows up in their feed. Home feed doesn't have circle-visibility
-- fan-out — the community-feed post + notification cover cross-user
-- awareness. Widening to co-members can be a later step if wanted.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Bulletproof _record_goal_milestones ────────────────────────────────
CREATE OR REPLACE FUNCTION public._record_goal_milestones(p_goal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target     BIGINT;
  v_balance    BIGINT;
  v_threshold  INT;
  v_thresholds INT[] := ARRAY[10, 25, 50, 75, 90, 100];
BEGIN
  BEGIN
    SELECT target_amount_cents, current_balance_cents
      INTO v_target, v_balance
    FROM public.user_savings_goals
    WHERE id = p_goal_id;

    -- No goal, no target, or zero target → nothing to compute.
    IF v_target IS NULL OR v_target <= 0 OR v_balance IS NULL THEN
      RETURN;
    END IF;

    -- Multiply-before-divide to preserve integer precision.
    FOREACH v_threshold IN ARRAY v_thresholds LOOP
      IF v_balance * 100 >= v_threshold::BIGINT * v_target THEN
        INSERT INTO public.goal_milestones (goal_id, milestone_percent, reached_at)
        VALUES (p_goal_id, v_threshold, NOW())
        ON CONFLICT (goal_id, milestone_percent) DO NOTHING;
      END IF;
    END LOOP;

    -- 100 %+ → mark completed. Preserves original completed_at.
    IF v_balance * 100 >= 100::BIGINT * v_target THEN
      UPDATE public.user_savings_goals
         SET goal_status  = 'completed',
             completed_at = COALESCE(completed_at, NOW()),
             updated_at   = NOW()
       WHERE id = p_goal_id
         AND goal_status <> 'completed';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Belt-and-suspenders: if the milestone helper (or any trigger it
    -- fires) explodes, the enclosing transfer_to_goal / credit_goal_
    -- external transaction still commits the wallet debit + goal credit.
    -- Users NEVER see a "Deposit failed" for a downstream celebration
    -- bug. The failure is logged for the DB owner to investigate.
    RAISE NOTICE '[_record_goal_milestones] silenced for goal %: %', p_goal_id, SQLERRM;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public._record_goal_milestones(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._record_goal_milestones(UUID)
  FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._record_goal_milestones(UUID) TO service_role;

-- ─── 2. Bulletproof post_goal_milestone_to_feed (community feed) ───────────
CREATE OR REPLACE FUNCTION public.post_goal_milestone_to_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id    UUID;
  v_goal_name  TEXT;
  v_goal_emoji TEXT;
  v_goal_type  TEXT;
  v_opted_in   BOOLEAN;
  v_content    TEXT;
BEGIN
  BEGIN
    SELECT user_id, name, emoji, goal_type
      INTO v_user_id, v_goal_name, v_goal_emoji, v_goal_type
      FROM public.user_savings_goals
     WHERE id = NEW.goal_id;

    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Don't auto-post the Round-up Savings jar (would spam the feed).
    IF COALESCE(v_goal_type, '') = 'round_up' THEN
      RETURN NEW;
    END IF;

    -- User-level opt-out. Missing row OR TRUE → posts are on (default).
    SELECT milestones_enabled
      INTO v_opted_in
      FROM public.goal_auto_post_settings
     WHERE user_id = v_user_id;
    IF v_opted_in IS FALSE THEN
      RETURN NEW;
    END IF;

    v_content :=
      '🎉 I''ve reached ' || NEW.milestone_percent::TEXT
      || '% of my ' || COALESCE(v_goal_name, 'savings')
      || ' goal!'
      || COALESCE(' ' || v_goal_emoji, '');

    INSERT INTO public.feed_posts (
      user_id, type, content, visibility, is_auto, linked_goal_id, metadata
    ) VALUES (
      v_user_id,
      'milestone',
      v_content,
      'public',
      TRUE,
      NEW.goal_id,
      jsonb_build_object(
        'milestone_percent', NEW.milestone_percent,
        'goal_id',           NEW.goal_id,
        'goal_emoji',        v_goal_emoji,
        'auto_source',       'goal_milestone'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- feed_posts RLS / column drift / whatever — never bubble up to
    -- the milestone insert. The trigger returning NEW without inserting
    -- into feed_posts is the acceptable degraded state.
    RAISE NOTICE '[post_goal_milestone_to_feed] silenced for milestone %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- Trigger DDL is unchanged (still AFTER INSERT). We recreate it defensively
-- so re-running the file after a manual drop is safe.
DROP TRIGGER IF EXISTS goal_milestone_auto_post ON public.goal_milestones;
CREATE TRIGGER goal_milestone_auto_post
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.post_goal_milestone_to_feed();

-- ─── 3. New: post_goal_milestone_to_home_feed (Home activity feed) ─────────
CREATE OR REPLACE FUNCTION public.post_goal_milestone_to_home_feed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id   UUID;
  v_goal_name TEXT;
  v_wallet_id UUID;
  v_balance   BIGINT;
  v_desc      TEXT;
BEGIN
  BEGIN
    SELECT user_id, name INTO v_user_id, v_goal_name
    FROM public.user_savings_goals
    WHERE id = NEW.goal_id;

    IF v_user_id IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT id, main_balance_cents INTO v_wallet_id, v_balance
    FROM public.user_wallets
    WHERE user_id = v_user_id
    LIMIT 1;

    -- No wallet → no home-feed row. The community-feed post + push
    -- notification still fire from the sibling triggers.
    IF v_wallet_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_desc := '🎉 You reached ' || NEW.milestone_percent::TEXT
              || '% of ' || COALESCE(v_goal_name, 'your goal') || '!';

    -- amount_cents = 0 + direction='internal' + balance_before ==
    -- balance_after: this is an informational row for the feed only, no
    -- ledger effect. useRecentActivity renders whatever's in description,
    -- and cents=0 is safely handled (direction 'in' vs 'out' becomes 'in'
    -- because the cents comparison in the hook is >=).
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id,
      transaction_type, direction,
      amount_cents,
      balance_type, balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status,
      metadata
    ) VALUES (
      v_wallet_id, v_user_id,
      'goal_milestone', 'internal',
      0,
      'main', COALESCE(v_balance, 0), COALESCE(v_balance, 0),
      'goal_milestone', NEW.id,
      v_desc, 'completed',
      jsonb_build_object(
        'milestone_percent', NEW.milestone_percent,
        'goal_id',           NEW.goal_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Home-feed insert must NEVER take down the milestone insert. Log
    -- and swallow. Manual reconciliation can add the row later if
    -- needed.
    RAISE NOTICE '[post_goal_milestone_to_home_feed] silenced for milestone %: %',
                 NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS goal_milestone_home_feed ON public.goal_milestones;
CREATE TRIGGER goal_milestone_home_feed
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.post_goal_milestone_to_home_feed();

COMMENT ON FUNCTION public.post_goal_milestone_to_home_feed IS
  'AFTER-INSERT trigger on goal_milestones. Inserts a zero-amount '
  'wallet_transactions row (transaction_type=goal_milestone, direction='
  'internal) so the Home activity feed (useRecentActivity, reads '
  'wallet_transactions) shows the milestone crossing. Failures are '
  'silently swallowed — deposits stay bulletproof.';

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '294',
  'bulletproof_goal_deposit_and_home_feed_milestone',
  ARRAY['-- 294: bulletproof _record_goal_milestones + wallet_transactions milestone insert']
)
ON CONFLICT (version) DO NOTHING;
