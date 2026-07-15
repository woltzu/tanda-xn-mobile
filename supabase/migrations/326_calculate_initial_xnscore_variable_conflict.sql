-- ═══════════════════════════════════════════════════════════════════════════
-- 326_calculate_initial_xnscore_variable_conflict.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to migs 319 + 324 + 325 — after unblocking every missing
-- profile column, calculate_initial_xnscore surfaced a fourth bug: its
-- INSERT INTO xnscore_initial_signals (user_id, ...) has an ambiguous
-- `user_id` reference. The function is declared
-- RETURNS TABLE(user_id uuid, ...) so PL/pgSQL treats user_id as an
-- output variable — colliding with the target column name in the
-- ON CONFLICT (user_id) clause. Error observed today:
--   42702: column reference "user_id" is ambiguous
--
-- Fix — same pattern we used in mig 313 for execute_cycle_payout: add
-- #variable_conflict use_column directive at the top of the function
-- body. PL/pgSQL then prefers the SQL column when a name matches both
-- a variable and a column, which is what we want everywhere in this
-- function.
--
-- Function body is byte-identical to the prior deploy apart from the
-- one-line directive addition.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.calculate_initial_xnscore(p_user_id uuid)
 RETURNS TABLE(user_id uuid, score numeric, raw_score numeric, tier xnscore_tier, age_cap integer, age_cap_applied boolean, breakdown jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
#variable_conflict use_column

DECLARE

    v_profile RECORD;

    v_existing_score RECORD;

    v_account_age_days INTEGER;

    v_age_cap INTEGER;



    -- Signal values

    v_base INTEGER := 20;

    v_email_points INTEGER := 0;

    v_phone_points INTEGER := 0;

    v_id_points INTEGER := 0;

    v_profile_points INTEGER := 0;

    v_inviter_points INTEGER := 0;

    v_quick_join_points INTEGER := 0;

    v_bank_points INTEGER := 0;



    v_profile_completion INTEGER;

    v_inviter_id UUID;

    v_inviter_score DECIMAL;

    v_has_circle BOOLEAN;

    v_hours_to_circle INTEGER;



    v_raw_total DECIMAL;

    v_capped_total DECIMAL;

    v_tier xnscore_tier;

    v_breakdown JSONB;

BEGIN

    -- Get profile

    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;



    IF NOT FOUND THEN

        RAISE EXCEPTION 'User not found: %', p_user_id;

    END IF;



    -- Check for existing score

    SELECT * INTO v_existing_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;



    IF FOUND AND v_existing_score.initial_calculated_at IS NOT NULL THEN

        -- Return existing score

        RETURN QUERY SELECT

            p_user_id,

            v_existing_score.total_score,

            v_existing_score.raw_score,

            v_existing_score.score_tier,

            v_existing_score.max_allowed_score::INTEGER,

            v_existing_score.age_cap_applied,

            v_existing_score.initial_score_breakdown;

        RETURN;

    END IF;



    -- Calculate account age

    v_account_age_days := EXTRACT(DAY FROM (now() - v_profile.created_at))::INTEGER;

    v_age_cap := get_xnscore_age_cap(v_account_age_days);



    -- ═══════════════════════════════════════════════════════════════════

    -- GATHER SIGNALS

    -- ═══════════════════════════════════════════════════════════════════



    -- Email verification (+5)

    IF v_profile.email_verified = TRUE THEN

        v_email_points := 5;

    END IF;



    -- Phone verification (+5)

    IF v_profile.phone_verified = TRUE THEN

        v_phone_points := 5;

    END IF;



    -- ID verification (+10)

    IF v_profile.identity_verified = TRUE THEN

        v_id_points := 10;

    END IF;



    -- Profile completion (+2 if 100%)

    v_profile_completion := calculate_profile_completion(p_user_id);

    IF v_profile_completion >= 100 THEN

        v_profile_points := 2;

    END IF;



    -- Inviter bonus (+1 to +5)

    IF v_profile.invited_by IS NOT NULL THEN

        v_inviter_id := v_profile.invited_by;

        SELECT total_score INTO v_inviter_score

        FROM xn_scores WHERE xn_scores.user_id = v_inviter_id;



        IF v_inviter_score IS NOT NULL THEN

            IF v_inviter_score >= 80 THEN

                v_inviter_points := 5;

            ELSIF v_inviter_score >= 60 THEN

                v_inviter_points := 3;

            ELSE

                v_inviter_points := 1;

            END IF;

        ELSE

            v_inviter_points := 1; -- Any inviter is better than none

        END IF;

    END IF;



    -- Quick circle join (+2 if joined within 1 hour)

    SELECT EXISTS(

        SELECT 1 FROM circle_members

        WHERE circle_members.user_id = p_user_id

    ) INTO v_has_circle;



    IF v_has_circle THEN

        SELECT EXTRACT(EPOCH FROM (MIN(cm.joined_at) - v_profile.created_at))/3600

        INTO v_hours_to_circle

        FROM circle_members cm

        WHERE cm.user_id = p_user_id;



        IF v_hours_to_circle IS NOT NULL AND v_hours_to_circle <= 1 THEN

            v_quick_join_points := 2;

        END IF;

    END IF;



    -- Bank account (+1 to +3) - check if linked

    IF EXISTS(SELECT 1 FROM user_bank_accounts WHERE user_bank_accounts.user_id = p_user_id AND status = 'active') THEN

        v_bank_points := 1;

        -- Could add more points based on Plaid data if available

    END IF;



    -- ═══════════════════════════════════════════════════════════════════

    -- CALCULATE TOTALS

    -- ═══════════════════════════════════════════════════════════════════



    v_raw_total := v_base + v_email_points + v_phone_points + v_id_points +

                   v_profile_points + v_inviter_points + v_quick_join_points + v_bank_points;



    v_capped_total := LEAST(v_raw_total, v_age_cap);

    v_tier := get_xnscore_tier(v_capped_total);



    v_breakdown := jsonb_build_object(

        'base', v_base,

        'email_verified', v_email_points,

        'phone_verified', v_phone_points,

        'id_verified', v_id_points,

        'profile_complete', v_profile_points,

        'inviter_bonus', v_inviter_points,

        'quick_join', v_quick_join_points,

        'bank_linked', v_bank_points,

        'raw_total', v_raw_total,

        'age_cap', v_age_cap,

        'capped_total', v_capped_total

    );



    -- ═══════════════════════════════════════════════════════════════════

    -- STORE INITIAL SIGNALS

    -- ═══════════════════════════════════════════════════════════════════



    INSERT INTO xnscore_initial_signals (

        user_id, base_score,

        email_verified, email_verified_points,

        phone_verified, phone_verified_points,

        id_verified, id_verified_points,

        profile_complete, profile_complete_points, profile_completion_pct,

        has_inviter, inviter_user_id, inviter_xnscore_at_invite, inviter_points,

        joined_circle_quickly, joined_circle_quickly_points, hours_to_first_circle,

        bank_account_linked, bank_account_points,

        raw_initial_score, capped_initial_score, age_cap_at_creation

    ) VALUES (

        p_user_id, v_base,

        v_profile.email_verified, v_email_points,

        v_profile.phone_verified, v_phone_points,

        v_profile.identity_verified, v_id_points,

        v_profile_completion >= 100, v_profile_points, v_profile_completion,

        v_inviter_id IS NOT NULL, v_inviter_id, v_inviter_score, v_inviter_points,

        v_quick_join_points > 0, v_quick_join_points, v_hours_to_circle,

        v_bank_points > 0, v_bank_points,

        v_raw_total::INTEGER, v_capped_total::INTEGER, v_age_cap

    )

    ON CONFLICT (user_id) DO UPDATE SET

        email_verified = EXCLUDED.email_verified,

        email_verified_points = EXCLUDED.email_verified_points,

        phone_verified = EXCLUDED.phone_verified,

        phone_verified_points = EXCLUDED.phone_verified_points,

        id_verified = EXCLUDED.id_verified,

        id_verified_points = EXCLUDED.id_verified_points,

        profile_complete = EXCLUDED.profile_complete,

        profile_complete_points = EXCLUDED.profile_complete_points,

        raw_initial_score = EXCLUDED.raw_initial_score,

        capped_initial_score = EXCLUDED.capped_initial_score,

        recalculated_count = xnscore_initial_signals.recalculated_count + 1,

        last_recalculated_at = now();



    -- ═══════════════════════════════════════════════════════════════════

    -- CREATE OR UPDATE MAIN SCORE RECORD

    -- ═══════════════════════════════════════════════════════════════════



    INSERT INTO xn_scores (

        user_id,

        total_score, raw_score, previous_score,

        score_tier,

        time_reliability_score, diversity_social_score, engagement_score,

        initial_score, initial_score_breakdown, initial_calculated_at,

        age_cap_applied, max_allowed_score, account_age_days,

        points_gained_this_week, week_start_date,

        last_calculated_at, calculation_trigger

    ) VALUES (

        p_user_id,

        v_capped_total, v_raw_total, NULL,

        v_tier,

        0, v_inviter_points, v_profile_points + v_quick_join_points,

        v_capped_total, v_breakdown, now(),

        v_capped_total < v_raw_total, v_age_cap, v_account_age_days,

        0, date_trunc('week', now())::DATE,

        now(), 'initial_calculation'

    )

    ON CONFLICT (user_id) DO UPDATE SET

        total_score = EXCLUDED.total_score,

        raw_score = EXCLUDED.raw_score,

        score_tier = EXCLUDED.score_tier,

        initial_score = EXCLUDED.initial_score,

        initial_score_breakdown = EXCLUDED.initial_score_breakdown,

        initial_calculated_at = EXCLUDED.initial_calculated_at,

        age_cap_applied = EXCLUDED.age_cap_applied,

        max_allowed_score = EXCLUDED.max_allowed_score,

        account_age_days = EXCLUDED.account_age_days,

        last_calculated_at = now(),

        calculation_trigger = 'initial_recalculation',

        updated_at = now();



    -- ═══════════════════════════════════════════════════════════════════

    -- LOG TO HISTORY

    -- ═══════════════════════════════════════════════════════════════════



    INSERT INTO xnscore_history (

        user_id, score, previous_score, score_change,

        trigger_event, factor_breakdown,

        raw_score_before_cap, age_cap_applied, age_cap_value,

        weekly_points_before, weekly_points_after, velocity_capped

    ) VALUES (

        p_user_id, v_capped_total, NULL, v_capped_total,

        'initial_calculation', v_breakdown,

        v_raw_total, v_capped_total < v_raw_total, v_age_cap,

        0, 0, FALSE

    );



    -- Return result

    RETURN QUERY SELECT

        p_user_id,

        v_capped_total,

        v_raw_total,

        v_tier,

        v_age_cap,

        v_capped_total < v_raw_total,

        v_breakdown;

END;

$function$
;

-- Backfill again now that all four layers are unblocked.
DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'Backfilled % xn_scores rows (after variable_conflict fix)', v_count;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '326',
  'calculate_initial_xnscore_variable_conflict',
  ARRAY['-- 326: add #variable_conflict use_column to calculate_initial_xnscore']
)
ON CONFLICT (version) DO NOTHING;
