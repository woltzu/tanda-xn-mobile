-- ═══════════════════════════════════════════════════════════════════════════
-- 396c_vouch_reciprocity_and_voucher_bonus_cap.sql
--
-- Prerequisite for mig 396 (savings behavior factor). Closes two vouch-
-- farming vectors before we amplify the incentive to farm:
--
--   1. Vouch reciprocity (Vector 2). The existing dilution formula
--      (POWER(0.5, existing_vouches_received)) only dampens per-vouchee
--      inflation. A reciprocal pair A↔B still scores full 2.0 pts each
--      because each is the OTHER's first-received vouch. Small mutual
--      clusters (5 members all vouching each other) score full points
--      too.
--
--   2. Voucher-given bonus farming. create_vouch applies a flat +0.5 pts
--      to the voucher every time they hand out a vouch. No lifetime cap
--      → a voucher can spam vouches to junk accounts for unlimited
--      accumulation.
--
-- Design:
--   • vouches.reciprocity_multiplier NUMERIC DEFAULT 1.0 — set to 0.25
--     when a reciprocal active vouch exists. Both sides get dampened
--     to 25%.
--   • xn_scores.voucher_bonus_given NUMERIC DEFAULT 0 — tracks lifetime
--     +0.5 bonuses awarded. Cap at 5 pts. Next +0.5 is skipped entirely
--     if applying it would push total > 5 (per spec — strict, not
--     partial).
--   • tr_vouch_reciprocity_check (BEFORE INSERT on vouches) — sets
--     NEW.reciprocity_multiplier, retro-updates the OTHER vouch's
--     multiplier, applies a corrective negative delta to the OTHER
--     vouchee's XnScore. Idempotent — if the other side is already
--     at 0.25 (shouldn't happen except in unlikely races), no retro
--     delta fires.
--   • calculate_community_standing_factor — reads
--     SUM(diluted_vouch_value * COALESCE(reciprocity_multiplier, 1.0))
--     so historical vouches (multiplier=1.0 default) behave unchanged
--     until they expire.
--   • create_vouch — modified to (a) INSERT ... RETURNING id,
--     reciprocity_multiplier so the +vouchee adjustment is multiplied
--     by whatever the trigger set, and (b) enforce the voucher-bonus
--     lifetime cap before applying +0.5.
--
-- Backfill decision (per spec):
--   Apply to NEW vouches only. No bulk scan of historical pairs. Each
--   historical pair remains at multiplier=1.0 until it expires (1-year
--   TTL) or a NEW vouch triggers the reciprocity check that touches it.
--   Historical voucher_bonus_given rows start at 0 — existing voucher
--   bonuses already applied to XnScore remain; only future +0.5
--   awards count toward the new cap.
--
-- Known follow-up (NOT in this migration):
--   • On vouch revocation (A→B revoked while B→A still active), B→A
--     stays at 0.25 forever instead of restoring to 1.0. Small edge
--     case, deferred to mig 397 (vouch cluster analysis) which will
--     touch the revocation path anyway.
--
-- Rollout order this migration is part of:
--   396c (this) → 396a (withdrawal instrumentation) → 396 (savings
--   factor) → 396b (scoring engine hardening).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. vouches.reciprocity_multiplier ────────────────────────────────────
ALTER TABLE vouches
  ADD COLUMN IF NOT EXISTS reciprocity_multiplier NUMERIC(4,3) NOT NULL DEFAULT 1.000;

COMMENT ON COLUMN vouches.reciprocity_multiplier IS
  'mig 396c: multiplier applied to diluted_vouch_value when computing '
  'community_standing points. 1.000 = independent vouch. 0.250 = reciprocal '
  'pair detected at INSERT time (both sides dampened).';

-- Speeds up the reciprocity lookup in the trigger.
CREATE INDEX IF NOT EXISTS vouches_reciprocity_lookup_idx
  ON vouches (voucher_user_id, vouchee_user_id, vouch_status)
  WHERE vouch_status = 'active';

-- ─── 2. xn_scores.voucher_bonus_given ─────────────────────────────────────
ALTER TABLE xn_scores
  ADD COLUMN IF NOT EXISTS voucher_bonus_given NUMERIC(6,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN xn_scores.voucher_bonus_given IS
  'mig 396c: lifetime voucher-given bonus points accumulated. Capped at 5.0. '
  'Existing users start at 0 — historical +0.5 bonuses already in total_score '
  'are NOT retroactively counted here; only future create_vouch calls '
  'increment this column.';

-- ─── 3. BEFORE-INSERT trigger: reciprocity detection + retro-dampen ──────
CREATE OR REPLACE FUNCTION public.vouch_reciprocity_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reciprocal RECORD;
  v_delta NUMERIC;
BEGIN
  -- Only reciprocity-check when the incoming row is active. Revoked /
  -- expired rows never contribute to the community factor anyway.
  IF NEW.vouch_status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  -- Look for an active vouch pointing the other direction.
  SELECT id, diluted_vouch_value, reciprocity_multiplier, vouchee_user_id
    INTO v_reciprocal
    FROM vouches
   WHERE voucher_user_id = NEW.vouchee_user_id
     AND vouchee_user_id = NEW.voucher_user_id
     AND vouch_status    = 'active'
   LIMIT 1;

  IF NOT FOUND THEN
    -- No reciprocal — leave NEW.reciprocity_multiplier at its default 1.0.
    RETURN NEW;
  END IF;

  -- Reciprocal detected. Dampen the incoming row to 0.25 immediately —
  -- create_vouch's RETURNING clause reads this back and multiplies the
  -- +vouchee XnScore adjustment accordingly.
  NEW.reciprocity_multiplier := 0.250;

  -- Retro-update the OTHER vouch IF it isn't already dampened (guards a
  -- pathological double-fire; also ensures re-running the trigger on a
  -- restore doesn't compound the retro-delta).
  IF v_reciprocal.reciprocity_multiplier > 0.250 THEN
    -- Delta on the other vouchee (= NEW.voucher_user_id). Going from
    -- current multiplier (typically 1.0) to 0.25 shrinks their earned
    -- vouch value by (new - old) * diluted_vouch_value. Negative
    -- adjustments bypass the velocity cap and land immediately.
    v_delta := v_reciprocal.diluted_vouch_value
             * (0.250 - v_reciprocal.reciprocity_multiplier);

    UPDATE vouches
       SET reciprocity_multiplier = 0.250
     WHERE id = v_reciprocal.id;

    -- Only fire the adjustment if there's a meaningful delta. Zero-
    -- valued historical vouches (voucher had no xn_scores at vouch time)
    -- otherwise generate noise in xnscore_history.
    IF ABS(v_delta) > 0.001 THEN
      PERFORM public.apply_xnscore_adjustment(
        NEW.voucher_user_id,   -- the OTHER vouchee whose score drops
        v_delta,               -- negative
        'vouch_reciprocity_dampen',
        v_reciprocal.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_vouch_reciprocity_check ON vouches;
CREATE TRIGGER tr_vouch_reciprocity_check
  BEFORE INSERT ON vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.vouch_reciprocity_check();

-- ─── 4. calculate_community_standing_factor — apply multiplier ───────────
-- Only the vouch-value SELECT changes. Everything else preserved byte-
-- for-byte from the pre-396c body so unrelated behavior doesn't drift.
CREATE OR REPLACE FUNCTION public.calculate_community_standing_factor(p_user_id uuid)
 RETURNS TABLE(total_score numeric, vouches_received_score numeric, member_diversity_score numeric, elder_connections_score numeric, vouching_reliability_score numeric, component_details jsonb)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_score_record RECORD;
    v_total_vouch_value DECIMAL := 0;
    v_vouch_count INTEGER := 0;
    v_unique_members INTEGER;
    v_unique_elders INTEGER;
    v_voucher_reliability DECIMAL;

    v_vouch_score DECIMAL := 0;
    v_diversity_score DECIMAL := 0;
    v_elder_score DECIMAL := 0;
    v_reliability_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Mig 396c: multiply diluted_vouch_value by reciprocity_multiplier.
    -- Historical rows have the default 1.000 so their contribution is
    -- unchanged until they expire or a new insert dampens them.
    SELECT COUNT(*),
           COALESCE(SUM(diluted_vouch_value * COALESCE(reciprocity_multiplier, 1.000)), 0)
    INTO v_vouch_count, v_total_vouch_value
    FROM vouches
    WHERE vouchee_user_id = p_user_id AND vouch_status = 'active';

    v_unique_members := COALESCE(v_score_record.unique_circle_members_count, 0);
    v_unique_elders := COALESCE(v_score_record.unique_elders_count, 0);

    v_voucher_reliability := CASE v_score_record.voucher_reliability
        WHEN 'good' THEN 1.0
        WHEN 'warning' THEN 0.7
        WHEN 'poor' THEN 0.4
        WHEN 'restricted' THEN 0.0
        ELSE 1.0
    END;

    v_vouch_score := LEAST(5, (LEAST(v_total_vouch_value, 10) / 10) * 5);
    v_diversity_score := LEAST(4, (LEAST(v_unique_members, 20)::DECIMAL / 20) * 4);
    v_elder_score := LEAST(3, (LEAST(v_unique_elders, 5)::DECIMAL / 5) * 3);
    v_reliability_score := v_voucher_reliability * 3;

    v_details := jsonb_build_object(
        'vouches_received', v_vouch_count,
        'total_vouch_value_effective', ROUND(v_total_vouch_value, 2),
        'unique_circle_members', v_unique_members,
        'unique_elders', v_unique_elders,
        'unique_communities', COALESCE(v_score_record.unique_communities_count, 0),
        'voucher_reliability', v_score_record.voucher_reliability,
        'total_vouchee_defaults', COALESCE(v_score_record.total_vouchee_defaults, 0)
    );

    RETURN QUERY SELECT
        ROUND(v_vouch_score + v_diversity_score + v_elder_score + v_reliability_score, 2),
        ROUND(v_vouch_score, 2),
        ROUND(v_diversity_score, 2),
        ROUND(v_elder_score, 2),
        ROUND(v_reliability_score, 2),
        v_details;
END;
$function$;

-- ─── 5. create_vouch — reciprocity-aware +vouchee, capped +voucher ───────
-- Two changes vs the pre-396c body:
--   (a) INSERT ... RETURNING now also reads reciprocity_multiplier so
--       the +vouchee adjustment is multiplied by whatever the trigger
--       set (1.000 for standalone, 0.250 for reciprocal pairs).
--   (b) The +0.5 voucher-given bonus is skipped entirely if applying it
--       would push voucher_bonus_given past 5.0. When applied, the
--       counter increments so the cap is enforced across future calls.
-- All other lines preserved from the current live body.
CREATE OR REPLACE FUNCTION public.create_vouch(
  p_voucher_id uuid,
  p_vouchee_id uuid,
  p_reason text DEFAULT NULL,
  p_relationship text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_limits          RECORD;
    v_value           RECORD;
    v_vouch_id        UUID;
    v_multiplier      NUMERIC;
    v_effective_value NUMERIC;
    v_current_bonus   NUMERIC;
BEGIN
    SELECT * INTO v_limits FROM public.get_vouch_limits(p_voucher_id);

    IF NOT v_limits.can_vouch THEN
        RAISE EXCEPTION 'Cannot vouch: %', v_limits.reason;
    END IF;

    IF p_voucher_id = p_vouchee_id THEN
        RAISE EXCEPTION 'Cannot vouch for yourself';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.vouches
         WHERE voucher_user_id = p_voucher_id
           AND vouchee_user_id = p_vouchee_id
           AND vouch_status    = 'active'
    ) THEN
        RAISE EXCEPTION 'Already have an active vouch for this user';
    END IF;

    SELECT * INTO v_value FROM public.calculate_vouch_value(p_voucher_id, p_vouchee_id);

    -- INSERT — the BEFORE-INSERT trigger runs here and may set
    -- reciprocity_multiplier to 0.250 if it detects a reciprocal pair.
    -- We read the actual final value back via RETURNING so the +vouchee
    -- adjustment is right the first time (no compensating delta needed).
    INSERT INTO public.vouches (
        voucher_user_id, vouchee_user_id,
        voucher_xnscore_at_vouch,
        vouch_sequence,
        raw_vouch_value, diluted_vouch_value,
        vouch_reason, relationship_type,
        expires_at
    ) VALUES (
        p_voucher_id, p_vouchee_id,
        v_value.voucher_score,
        v_value.sequence_number,
        v_value.raw_value, v_value.diluted_value,
        p_reason, p_relationship,
        NOW() + INTERVAL '1 year'
    )
    RETURNING id, reciprocity_multiplier
      INTO v_vouch_id, v_multiplier;

    v_effective_value := v_value.diluted_value * v_multiplier;

    -- +vouchee adjustment, multiplier-aware.
    PERFORM public.apply_xnscore_adjustment(
        p_vouchee_id, v_effective_value, 'vouch_received', v_vouch_id);

    -- +voucher bonus, capped at 5.0 lifetime. Strict "only apply if next
    -- total <= 5" per spec — no partial fractional award at the boundary.
    SELECT COALESCE(voucher_bonus_given, 0)
      INTO v_current_bonus
      FROM xn_scores
     WHERE user_id = p_voucher_id;

    IF v_current_bonus IS NULL THEN
        -- Voucher has no xn_scores row yet; apply_xnscore_adjustment
        -- would create one. Treat as 0 and let the cap check pass.
        v_current_bonus := 0;
    END IF;

    IF v_current_bonus + 0.5 <= 5.0 THEN
        PERFORM public.apply_xnscore_adjustment(
            p_voucher_id, 0.5, 'vouch_given', v_vouch_id);
        UPDATE xn_scores
           SET voucher_bonus_given = COALESCE(voucher_bonus_given, 0) + 0.5
         WHERE user_id = p_voucher_id;
    ELSE
        RAISE NOTICE '[create_vouch] voucher-bonus cap reached for user % (current=%); +0.5 skipped',
            p_voucher_id, v_current_bonus;
    END IF;

    -- Audit row (unchanged from live). Wrapped so an audit-write failure
    -- doesn't undo the vouch itself.
    BEGIN
        INSERT INTO public.xnscore_vouch_audit_log
            (vouch_id, voucher_id, vouchee_id, action, value_numeric, reason)
        VALUES
            (v_vouch_id, p_voucher_id, p_vouchee_id,
             'created', v_effective_value, p_reason);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'xnscore_vouch_audit_log insert failed for create vouch %: %',
                     v_vouch_id, SQLERRM;
    END;

    RETURN v_vouch_id;
END;
$function$;

-- ─── 6. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396c',
  'vouch_reciprocity_and_voucher_bonus_cap',
  ARRAY['-- 396c: vouch_reciprocity_and_voucher_bonus_cap']
)
ON CONFLICT (version) DO NOTHING;
