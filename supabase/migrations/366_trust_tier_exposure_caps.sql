-- ═══════════════════════════════════════════════════════════════════════════
-- 366_trust_tier_exposure_caps.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Trust-tier exposure caps for joining circles. Extends the existing
-- mig 247 system (member_tier_status.max_exposure_cents + can_join_circle
-- RPC + exposure_vouches) to close three known gaps:
--
--   1. Cap enforcement never reached the join RPC. mig 247's can_join_circle
--      shipped, but join_circle (mig 141) doesn't call it. Every join path
--      that flows through join_circle bypasses the cap. Adding a server-
--      side guard closes this — same pattern as mig 356's 1-active-loan
--      partial unique index + RPC gate combo.
--
--   2. Live tier caps drifted from mig 247's design (established at $500
--      instead of $2,000; critical at $500 instead of $0; one newcomer at
--      $0, another at $200,000). New caps land in the config table
--      (graduated_entry_tiers.max_exposure_cents) so every code path
--      reads a single source of truth. Bulk backfill recomputes
--      member_tier_status.max_exposure_cents from that source.
--
--   3. Tier assignment logic didn't consider completed circles. This
--      migration rewrites evaluate_member_tier's tier selection to use
--      the approved OR semantics from the operator:
--         Critical   → is_demoted = TRUE (admin/system-set; not XN-driven)
--         Elite      → XN ≥ 90  OR ≥ 5 completed circles
--         Trusted    → XN ≥ 70  OR ≥ 3 completed circles
--         Established → XN ≥ 50  OR ≥ 1 completed circle
--         Newcomer   → everyone else (low XN with no demotion)
--      Note: the graduated_entry_tiers config table keeps `elder` as an
--      unused legacy tier (xn 75-89 range) — no user is at elder in prod
--      and rewriting the tier ladder to remove it is out of scope. Elder
--      gets the same unlimited cap as Elite for safety.
--
-- One-time reclassification:
--   Five users are currently labeled 'critical' but is_demoted=false —
--   they landed there because mig 247's evaluate_member_tier put low-XN
--   users in the critical row range (0-24). Per the new semantics
--   (Critical = demoted only), those five are reclassified to newcomer.
--   Their XN is still low so their cap stays modest ($1,500) — the change
--   is really about giving them the correct label and demotion state.
--
-- exposure_vouches CHECK gets widened to include 'trusted' and 'elite'
-- so elders can vouch members into either tier.
--
-- can_join_circle gets three fixes:
--   * NULL max_exposure_cents means "unlimited" (elder/elite), not "$500
--     default". No-row (never evaluated) still defaults to newcomer cap.
--   * Voucher tier CASE gains trusted + elite (both unlimited).
--   * Cap comparison returns TRUE outright when the cap is unlimited.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add max_exposure_cents to graduated_entry_tiers ─────────────────

ALTER TABLE public.graduated_entry_tiers
  ADD COLUMN IF NOT EXISTS max_exposure_cents INTEGER;

COMMENT ON COLUMN public.graduated_entry_tiers.max_exposure_cents IS
  'Max total pot (circle member_count × amount × 100) a member of this '
  'tier may join. NULL means unlimited (elder/elite). 0 means blocked '
  '(critical/demoted). Read by evaluate_member_tier + can_join_circle.';

-- Seed the caps per the operator-approved tiering. NULL = unlimited.
UPDATE public.graduated_entry_tiers
   SET max_exposure_cents = CASE tier_key
     WHEN 'critical'    THEN 0
     WHEN 'newcomer'    THEN 150000    -- $1,500
     WHEN 'established' THEN 500000    -- $5,000
     WHEN 'trusted'     THEN 1000000   -- $10,000
     WHEN 'elder'       THEN NULL      -- unlimited (legacy tier, matches elite)
     WHEN 'elite'       THEN NULL      -- unlimited
     ELSE 150000
   END;

-- ─── 2. Widen exposure_vouches CHECK to include trusted + elite ─────────

DO $$
DECLARE v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
    FROM pg_constraint
   WHERE conrelid = 'public.exposure_vouches'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%temporary_tier%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.exposure_vouches DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.exposure_vouches
  ADD CONSTRAINT exposure_vouches_temporary_tier_check
  CHECK (temporary_tier IN ('newcomer','established','trusted','elder','elite','critical'));

-- ─── 3. Rewrite evaluate_member_tier ────────────────────────────────────
-- Body preserved from the pre-366 definition (mig 267's version) except:
--   * Tier selection: replace the range-based lookup with OR logic
--     (XN ≥ threshold OR ≥ N completed). is_demoted forces critical.
--   * INSERT/UPDATE: also write max_exposure_cents (read from config).
-- Everything else — progress_pct, action_items, member_tier_history
-- INSERT, record_ai_decision call, JSON return — kept identical.

CREATE OR REPLACE FUNCTION public.evaluate_member_tier(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_xn RECORD;
  v_profile RECORD;
  v_current RECORD;
  v_tier RECORD;
  v_new_tier_key TEXT;
  v_new_tier_number INTEGER;
  v_previous_tier TEXT;
  v_changed BOOLEAN := false;
  v_change_type TEXT;
  v_reason TEXT;
  v_next_tier RECORD;
  v_progress_pct INTEGER := 0;
  v_action_items JSONB := '[]';
  v_score INTEGER;
  v_age INTEGER;
  v_completed INTEGER;
  v_defaults INTEGER;
  v_prev_tier_record RECORD;
  v_is_demoted BOOLEAN := FALSE;
BEGIN
  -- Live XN + account age (fallback to profiles column if xn_scores empty).
  SELECT total_score, account_age_days INTO v_xn
    FROM xn_scores WHERE user_id = p_user_id;
  IF v_xn IS NULL THEN
    SELECT
      COALESCE(xn_score, 0)::INTEGER,
      GREATEST(0, EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::INTEGER
    INTO v_score, v_age
    FROM profiles WHERE id = p_user_id;
    v_score := COALESCE(v_score, 0);
    v_age := COALESCE(v_age, 0);
  ELSE
    v_score := COALESCE(ROUND(v_xn.total_score), 0);
    v_age := COALESCE(v_xn.account_age_days, 0);
  END IF;

  -- Behavioral counts (completed + defaults).
  SELECT circles_completed, default_count INTO v_profile
    FROM member_behavioral_profiles WHERE user_id = p_user_id;
  v_completed := COALESCE(v_profile.circles_completed, 0);
  v_defaults := COALESCE(v_profile.default_count, 0);

  -- Read prior state — is_demoted is admin-set and persists across
  -- eval runs. Critical is only reachable via is_demoted=TRUE going
  -- forward.
  SELECT * INTO v_current FROM member_tier_status WHERE user_id = p_user_id;
  v_is_demoted := COALESCE(v_current.is_demoted, FALSE);

  -- Mig 366 — tier selection. OR semantics (XN OR completed) per the
  -- approved operator spec. Critical requires is_demoted; low XN alone
  -- lands you at newcomer.
  IF v_is_demoted THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'critical';
  ELSIF v_score >= 90 OR v_completed >= 5 THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'elite';
  ELSIF v_score >= 70 OR v_completed >= 3 THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'trusted';
  ELSIF v_score >= 50 OR v_completed >= 1 THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'established';
  ELSE
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'newcomer';
  END IF;

  -- Belt: if the config table is missing the row we picked, fall back
  -- to critical (fail-closed).
  IF v_tier IS NULL THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'critical';
  END IF;

  v_new_tier_key := v_tier.tier_key;
  v_new_tier_number := v_tier.tier_number;

  IF v_current IS NULL THEN
    v_changed := true;
    v_change_type := 'initial';
    v_previous_tier := NULL;
    v_reason := format('Initial tier assignment: %s (XnScore %s, completed %s)',
                       v_tier.label, v_score, v_completed);
  ELSIF v_current.current_tier != v_new_tier_key THEN
    v_changed := true;
    v_previous_tier := v_current.current_tier;
    IF v_new_tier_number > v_current.tier_number THEN
      v_change_type := 'advancement';
      v_reason := format('Advanced from %s to %s (XnScore %s, completed %s)',
                         v_current.current_tier, v_new_tier_key, v_score, v_completed);
    ELSE
      v_change_type := 'demotion';
      v_reason := format('Demoted from %s to %s (XnScore %s, completed %s)',
                         v_current.current_tier, v_new_tier_key, v_score, v_completed);
    END IF;
  ELSE
    v_previous_tier := v_current.previous_tier;
  END IF;

  -- Progress toward next tier (unchanged — reads xn_score_min from config
  -- for the tier one number above). Slightly less accurate now that tier
  -- selection uses OR semantics; kept for existing UI compatibility.
  SELECT * INTO v_next_tier
    FROM graduated_entry_tiers WHERE tier_number = v_new_tier_number + 1;

  IF v_next_tier IS NOT NULL THEN
    IF (v_next_tier.xn_score_min - v_tier.xn_score_min) > 0 THEN
      v_progress_pct := LEAST(100, GREATEST(0,
        ROUND(((v_score - v_tier.xn_score_min)::DECIMAL /
               (v_next_tier.xn_score_min - v_tier.xn_score_min)) * 100)
      ));
    END IF;
    IF v_score < v_next_tier.xn_score_min THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'xn_score',
        'message', format('Earn %s more XnScore points to reach %s',
                          v_next_tier.xn_score_min - v_score, v_next_tier.label),
        'current', v_score,
        'required', v_next_tier.xn_score_min
      );
    END IF;
    IF v_age < v_next_tier.min_account_age_days THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'account_age',
        'message', format('%s more days on platform needed for %s',
                          v_next_tier.min_account_age_days - v_age, v_next_tier.label),
        'current', v_age,
        'required', v_next_tier.min_account_age_days
      );
    END IF;
  ELSE
    v_progress_pct := 100;
  END IF;

  INSERT INTO member_tier_status (
    user_id, current_tier, tier_number, previous_tier, tier_achieved_at,
    is_demoted, demotion_reason, demotion_path_back,
    max_circle_size, max_contribution_cents, max_exposure_cents, position_access,
    xn_score_at_eval, account_age_at_eval, circles_completed_at_eval,
    next_tier, progress_pct, action_items
  ) VALUES (
    p_user_id, v_new_tier_key, v_new_tier_number, v_previous_tier,
    CASE WHEN v_changed THEN NOW() ELSE COALESCE(v_current.tier_achieved_at, NOW()) END,
    -- Preserve prior is_demoted flag; do NOT auto-flip on tier drops
    -- (mig 366 change from previous behavior). Admins set is_demoted
    -- explicitly via a separate action; eval respects the flag.
    v_is_demoted,
    CASE WHEN v_change_type = 'demotion' THEN v_reason ELSE v_current.demotion_reason END,
    CASE WHEN v_change_type = 'demotion' THEN
      format('Raise your XnScore back to %s or complete another circle to regain %s status',
             COALESCE(v_next_tier.xn_score_min, v_tier.xn_score_min),
             COALESCE(v_previous_tier, v_new_tier_key))
    ELSE v_current.demotion_path_back END,
    v_tier.max_circle_size, v_tier.max_contribution_cents,
    v_tier.max_exposure_cents,   -- mig 366 addition
    v_tier.position_access,
    v_score, v_age, v_completed,
    CASE WHEN v_next_tier IS NOT NULL THEN v_next_tier.tier_key ELSE NULL END,
    v_progress_pct, v_action_items
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier = EXCLUDED.current_tier,
    tier_number = EXCLUDED.tier_number,
    previous_tier = CASE WHEN v_changed THEN v_previous_tier ELSE member_tier_status.previous_tier END,
    tier_achieved_at = CASE WHEN v_changed THEN NOW() ELSE member_tier_status.tier_achieved_at END,
    -- is_demoted purposely NOT overwritten by eval anymore (mig 366).
    -- The flag is admin-controlled; eval reads it, doesn't set it.
    max_circle_size = EXCLUDED.max_circle_size,
    max_contribution_cents = EXCLUDED.max_contribution_cents,
    max_exposure_cents = EXCLUDED.max_exposure_cents,   -- mig 366 addition
    position_access = EXCLUDED.position_access,
    xn_score_at_eval = EXCLUDED.xn_score_at_eval,
    account_age_at_eval = EXCLUDED.account_age_at_eval,
    circles_completed_at_eval = EXCLUDED.circles_completed_at_eval,
    next_tier = EXCLUDED.next_tier,
    progress_pct = EXCLUDED.progress_pct,
    action_items = EXCLUDED.action_items,
    updated_at = NOW();

  IF v_changed THEN
    INSERT INTO member_tier_history (
      user_id, from_tier, to_tier, change_type, reason,
      xn_score, account_age_days, circles_completed
    ) VALUES (
      p_user_id, v_previous_tier, v_new_tier_key, v_change_type, v_reason,
      v_score, v_age, v_completed
    );

    IF v_change_type IN ('advancement', 'demotion') THEN
      SELECT label INTO v_prev_tier_record
        FROM graduated_entry_tiers WHERE tier_key = v_previous_tier;

      BEGIN
        IF v_change_type = 'advancement' THEN
          PERFORM record_ai_decision(
            p_user_id, 'tier_advancement', v_new_tier_key,
            jsonb_build_object(
              'PREVIOUS_TIER', COALESCE(v_prev_tier_record.label, v_previous_tier),
              'TIER_NAME', v_tier.label,
              'FEATURE_UNLOCKED', format(
                'max pot up to $%s, circles up to %s members',
                COALESCE(ROUND(v_tier.max_exposure_cents / 100.0)::TEXT, 'unlimited'),
                COALESCE(v_tier.max_circle_size::TEXT, 'unlimited'))
            ),
            p_user_id, 'member_tier_change'
          );
        ELSE
          PERFORM record_ai_decision(
            p_user_id, 'tier_demotion', v_new_tier_key,
            jsonb_build_object(
              'PREVIOUS_TIER', COALESCE(v_prev_tier_record.label, v_previous_tier),
              'TIER_NAME', v_tier.label,
              'FACTOR_DESCRIPTION', format('your XnScore moved to %s', v_score),
              'SPECIFIC_ACTION', 'make on-time contributions, complete circles, and avoid defaults to recover'
            ),
            p_user_id, 'member_tier_change'
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'record_ai_decision failed for tier change of %: %', p_user_id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'previous_tier', v_previous_tier,
    'new_tier', v_new_tier_key,
    'tier_number', v_new_tier_number,
    'changed', v_changed,
    'change_type', COALESCE(v_change_type, 'none'),
    'xn_score', v_score,
    'account_age', v_age,
    'circles_completed', v_completed,
    'progress_pct', v_progress_pct,
    'max_circle_size', v_tier.max_circle_size,
    'max_contribution_cents', v_tier.max_contribution_cents,
    'max_exposure_cents', v_tier.max_exposure_cents,
    'position_access', v_tier.position_access,
    'source', CASE WHEN v_xn IS NULL THEN 'profiles_fallback' ELSE 'xn_scores' END
  );
END;
$function$;

-- ─── 4. Reclassify the 5 mis-labeled 'critical' users to 'newcomer' ─────
-- Currently 5 rows have current_tier='critical' and is_demoted=false.
-- Under mig 366 semantics, Critical requires demotion. Flipping them to
-- newcomer and re-running evaluate_all_member_tiers below reconciles
-- everything from source of truth.

UPDATE member_tier_status
   SET current_tier = 'newcomer',
       tier_number = 1,
       updated_at = NOW()
 WHERE current_tier = 'critical'
   AND COALESCE(is_demoted, FALSE) = FALSE;

-- ─── 5. Full recompute for every user with a tier row ───────────────────
-- Uses evaluate_member_tier (rewritten above) so every row's
-- max_exposure_cents + current_tier gets set from the same source-of-
-- truth config table. Any drift from mig 247's original backfill
-- self-corrects here.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM member_tier_status LOOP
    PERFORM evaluate_member_tier(r.user_id);
  END LOOP;
END $$;

-- ─── 6. Rewrite can_join_circle ─────────────────────────────────────────
-- Three fixes:
--   * NULL max_exposure_cents means "unlimited" (elder/elite), not
--     "$500 default". Return TRUE outright in that case.
--   * No-row (user never evaluated) defaults to newcomer cap (150000).
--   * Voucher tier CASE gains trusted + elite (both unlimited).

CREATE OR REPLACE FUNCTION public.can_join_circle(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_count       INTEGER;
  v_amount             NUMERIC;
  v_pot_cents          BIGINT;
  v_max_exposure_cents INTEGER;
  v_has_row            BOOLEAN := FALSE;
  v_own_unlimited      BOOLEAN := FALSE;
  v_voucher_tier       TEXT;
  v_voucher_cap        INTEGER;
  v_voucher_unlimited  BOOLEAN := FALSE;
BEGIN
  -- Circle dimensions. NULL on either side → fail closed.
  SELECT member_count, amount INTO v_member_count, v_amount
    FROM circles WHERE id = p_circle_id;
  IF v_member_count IS NULL OR v_amount IS NULL THEN
    RETURN FALSE;
  END IF;
  v_pot_cents := (v_member_count * v_amount * 100)::BIGINT;

  -- Own tier cap.
  SELECT max_exposure_cents INTO v_max_exposure_cents
    FROM member_tier_status WHERE user_id = p_user_id;

  IF FOUND THEN
    v_has_row := TRUE;
    IF v_max_exposure_cents IS NULL THEN
      -- Elder/elite: unlimited.
      v_own_unlimited := TRUE;
    END IF;
  ELSE
    -- Never evaluated → newcomer default (mig 366 raised from $500 → $1,500).
    v_max_exposure_cents := 150000;
  END IF;

  -- Active vouch override — take the HIGHER of own cap vs voucher cap.
  SELECT temporary_tier INTO v_voucher_tier
    FROM exposure_vouches
   WHERE member_id = p_user_id
     AND expires_at > NOW()
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_voucher_tier IS NOT NULL THEN
    -- Mig 366: extended to trusted + elite. NULL = unlimited.
    v_voucher_cap := CASE v_voucher_tier
      WHEN 'newcomer'    THEN 150000
      WHEN 'established' THEN 500000
      WHEN 'trusted'     THEN 1000000
      WHEN 'elder'       THEN NULL
      WHEN 'elite'       THEN NULL
      WHEN 'critical'    THEN 0
      ELSE 150000
    END;
    IF v_voucher_cap IS NULL THEN
      v_voucher_unlimited := TRUE;
    END IF;
  END IF;

  -- Unlimited wins from either source.
  IF v_own_unlimited OR v_voucher_unlimited THEN
    RETURN TRUE;
  END IF;

  -- Own or voucher cap, whichever is higher.
  IF v_voucher_cap IS NOT NULL AND v_voucher_cap > v_max_exposure_cents THEN
    v_max_exposure_cents := v_voucher_cap;
  END IF;

  -- Zero cap = blocked (critical).
  IF v_max_exposure_cents = 0 THEN
    RETURN FALSE;
  END IF;

  RETURN v_pot_cents <= v_max_exposure_cents;
END;
$$;

-- ─── 7. Add server-side guard to join_circle ────────────────────────────
-- Adds one check right after circle_not_joinable, before the invite-code
-- check. Every path that reaches join_circle now hits the exposure cap.
-- Body byte-identical to the mig 141/142 version except for the new IF.

CREATE OR REPLACE FUNCTION public.join_circle(
  p_circle_id uuid,
  p_invite_code text DEFAULT NULL::text
)
RETURNS TABLE(member_id uuid, member_position integer, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_joiner         UUID;
  v_circle         RECORD;
  v_existing       UUID;
  v_member_id      UUID;
  v_new_position   INT;
  v_user_xn_score  INT;
  v_display_name   TEXT;
  v_post_count     INT;
  v_max_exposure   INT;   -- mig 366 — for the error message
  v_cap_display    TEXT;  -- mig 366
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'invalid_circle_id';
  END IF;

  SELECT id, name, status, member_count, current_members, min_score, invite_code
    INTO v_circle
  FROM public.circles
  WHERE id = p_circle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'circle_not_joinable';
  END IF;

  -- Mig 366 — exposure-cap guard. Server-side enforcement so every
  -- join path (client, deep link, admin, direct RPC) is subject to the
  -- tier cap, not just the two screens that opted into useExposureCap.
  -- Error message includes the user's current cap so the UI can surface
  -- it without a second round-trip. Prefix `exposure_cap_exceeded:` keeps
  -- the substring-match pattern the client uses for typed error routing.
  IF NOT public.can_join_circle(v_joiner, p_circle_id) THEN
    SELECT max_exposure_cents INTO v_max_exposure
      FROM public.member_tier_status WHERE user_id = v_joiner;
    v_cap_display := CASE
      WHEN v_max_exposure IS NULL THEN '$1,500 (default limit)'
      WHEN v_max_exposure = 0     THEN '$0 (your account is currently restricted)'
      ELSE '$' || trim(to_char(v_max_exposure / 100, 'FM999G999G990'))
    END;
    RAISE EXCEPTION
      'exposure_cap_exceeded: This circle exceeds your trust tier limit of %. Complete more circles or improve your XnScore to unlock larger circles.',
      v_cap_display;
  END IF;

  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF upper(trim(p_invite_code)) <> v_circle.invite_code THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
  END IF;

  SELECT id INTO v_existing
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = v_joiner;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY
      SELECT v_existing,
             (SELECT cm.position FROM public.circle_members cm WHERE cm.id = v_existing),
             TRUE;
    RETURN;
  END IF;

  IF v_circle.current_members >= v_circle.member_count THEN
    RAISE EXCEPTION 'circle_full';
  END IF;

  IF COALESCE(v_circle.min_score, 0) > 0 THEN
    SELECT COALESCE(xn_score, 0) INTO v_user_xn_score
    FROM public.profiles WHERE id = v_joiner;
    IF COALESCE(v_user_xn_score, 0) < v_circle.min_score THEN
      RAISE EXCEPTION 'min_score_not_met';
    END IF;
  END IF;

  v_new_position := v_circle.current_members + 1;

  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (p_circle_id, v_joiner, v_new_position, 'member', 'active', NOW())
  RETURNING id INTO v_member_id;

  SELECT current_members INTO v_post_count
  FROM public.circles WHERE id = p_circle_id;

  IF v_post_count >= v_circle.member_count THEN
    UPDATE public.circles
       SET status = 'active', updated_at = NOW()
     WHERE id = p_circle_id AND status = 'pending';
  ELSE
    UPDATE public.circles
       SET updated_at = NOW()
     WHERE id = p_circle_id;
  END IF;

  BEGIN
    v_display_name := public.resolve_display_name(v_joiner);
    INSERT INTO public.circle_messages (circle_id, user_id, message_type, body)
    VALUES (
      p_circle_id, v_joiner, 'system',
      v_display_name || ' joined the circle'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[join_circle] system message insert failed circle=%, user=%, err=%',
      p_circle_id, v_joiner, SQLERRM;
  END;

  RETURN QUERY SELECT v_member_id, v_new_position, FALSE;
END;
$function$;

-- ─── 8. Self-register ────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '366',
  'trust_tier_exposure_caps',
  ARRAY['-- 366: trust-tier exposure caps + join_circle guard + eval rewrite']
)
ON CONFLICT (version) DO NOTHING;
