-- ═══════════════════════════════════════════════════════════════════════════
-- 298_ascii_milestone_descriptions.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: the milestone celebration string in wallet_transactions.description
-- (from post_goal_milestone_to_home_feed, migration 294) and in
-- feed_posts.content (from post_goal_milestone_to_feed, migration 155)
-- both contain a leading emoji. On existing production rows the emoji
-- has been double-encoded — the U+1F389 bytes `f0 9f 8e 89` were
-- interpreted as Latin-1 characters and re-encoded as UTF-8, yielding
-- `c3b0 c5b8 c5bd e280b0` (ð Ÿ Ž ‰). Some devices render that garbled
-- prefix as "ÖÝÝ%" or similar.
--
-- The double-encoding happened at the transport layer between the SQL
-- source file and Postgres when migration 294 was originally applied
-- (sql_run.py / Management API mishandled the multi-byte literal).
-- Any future migration that includes a literal emoji would hit the
-- same class of bug, so this fix goes pure-ASCII in both trigger
-- functions:
--   * "Milestone reached — you hit N% of {name}."  (wallet_transactions)
--   * "Milestone reached — I've hit N% of my {name} goal."  (feed_posts)
--
-- And backfills existing broken rows in both tables. Both statements are
-- idempotent: the UPDATE only touches rows whose description still
-- contains the double-encoded sequence.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. post_goal_milestone_to_home_feed — pure-ASCII rewrite ──────────────
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

    IF v_wallet_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Pure ASCII — no emoji. Prior versions embedded a party-popper
    -- (U+1F389) that the sql_run.py transport double-encoded into
    -- broken bytes on some devices.
    v_desc := 'Milestone reached - you hit ' || NEW.milestone_percent::TEXT
              || '% of ' || COALESCE(v_goal_name, 'your goal') || '.';

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
    RAISE NOTICE '[post_goal_milestone_to_home_feed] silenced for milestone %: %',
                 NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

-- Trigger DDL unchanged (still AFTER INSERT), but recreated defensively.
DROP TRIGGER IF EXISTS goal_milestone_home_feed ON public.goal_milestones;
CREATE TRIGGER goal_milestone_home_feed
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.post_goal_milestone_to_home_feed();

-- ─── 2. post_goal_milestone_to_feed — pure-ASCII rewrite ────────────────────
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

    -- Round-up jar opt-out (unchanged).
    IF COALESCE(v_goal_type, '') = 'round_up' THEN
      RETURN NEW;
    END IF;

    -- User-level opt-out (unchanged).
    SELECT milestones_enabled
      INTO v_opted_in
      FROM public.goal_auto_post_settings
     WHERE user_id = v_user_id;
    IF v_opted_in IS FALSE THEN
      RETURN NEW;
    END IF;

    -- Pure ASCII. The goal's own emoji (v_goal_emoji) is USER data
    -- inserted through the app, which handles UTF-8 correctly at that
    -- transport layer — leave it appended so users still see their
    -- chosen decoration; strip only the trigger-side emoji that was
    -- getting double-encoded.
    v_content :=
      'Milestone reached - I have hit ' || NEW.milestone_percent::TEXT
      || '% of my ' || COALESCE(v_goal_name, 'savings')
      || ' goal.'
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
    RAISE NOTICE '[post_goal_milestone_to_feed] silenced for milestone %: %',
                 NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS goal_milestone_auto_post ON public.goal_milestones;
CREATE TRIGGER goal_milestone_auto_post
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW EXECUTE FUNCTION public.post_goal_milestone_to_feed();

-- ─── 3. Backfill wallet_transactions rows ──────────────────────────────────
-- Double-encoded prefix pattern: bytes c3b0 c5b8 c5bd e280b0 20 which
-- decode as the four-character sequence `ð Ÿ Ž ‰ `. Match on that
-- literal so the UPDATE is idempotent — a row that's already been
-- rewritten to pure ASCII no longer matches.
UPDATE public.wallet_transactions
SET description = 'Milestone reached - you hit '
                  || (metadata->>'milestone_percent')::TEXT
                  || '% of '
                  || COALESCE(
                       (SELECT name FROM public.user_savings_goals
                        WHERE id = (metadata->>'goal_id')::uuid),
                       'your goal')
                  || '.'
WHERE transaction_type = 'goal_milestone'
  AND description LIKE E'ðŸŽ‰%';

-- ─── 4. Backfill feed_posts rows ───────────────────────────────────────────
UPDATE public.feed_posts
SET content = 'Milestone reached - I have hit '
              || (metadata->>'milestone_percent')::TEXT
              || '% of my '
              || COALESCE(
                   (SELECT name FROM public.user_savings_goals
                    WHERE id = (metadata->>'goal_id')::uuid),
                   'savings')
              || ' goal.'
              || COALESCE(' ' || (metadata->>'goal_emoji'), '')
WHERE type = 'milestone'
  AND content LIKE E'ðŸŽ‰%';

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '298',
  'ascii_milestone_descriptions',
  ARRAY['-- 298: rewrite milestone triggers to pure ASCII + backfill double-encoded rows']
)
ON CONFLICT (version) DO NOTHING;
