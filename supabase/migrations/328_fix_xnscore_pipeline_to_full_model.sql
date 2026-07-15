-- ═══════════════════════════════════════════════════════════════════════════
-- 328_fix_xnscore_pipeline_to_full_model.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two fixes surfaced by the XnScore system audit:
--
-- Fix 1 — daily pipeline wired to the wrong scoring model.
--   Mig 324 wired recalculate_xn_score(uuid) unconditionally to
--   calculate_initial_xnscore — which recomputes only the sign-up
--   snapshot (base 20 + verification signals). That worked for the
--   first pass (11 users seeded), but every subsequent daily run
--   RESETS every user's score back to their initial-signals value.
--   Vouches, tenure bonuses, payment reliability, circle completion,
--   community standing — none of it accumulates. Verified in audit:
--   every user is stuck at score=20, tier=critical, tenure_bonus=0,
--   zero vouches, despite all the decay/tenure/adjustment plumbing
--   existing in the schema.
--
--   Fix — recalculate_xn_score becomes conditional:
--     * xn_scores row exists → recalculate_full_xnscore (the
--       5-factor ongoing model: payment reliability, completion,
--       tenure activity, community standing, financial behavior).
--     * no xn_scores row (first-time user) → calculate_initial_xnscore
--       (creates the row from verification signals).
--     * frozen users skipped upstream by recalculate_all_xn_scores;
--       defensive skip here too as belt-and-suspenders.
--
--   With this in place, the pipeline's daily 03:00 UTC run drives
--   scores forward based on actual behavior instead of freezing them
--   at day-1 baseline.
--
-- Fix 2 — age cap curve stretched to 24 months per product intent.
--   Prior curve reached the 100 ceiling at 548 days (18 months). The
--   design intent (per product docs) is 2 years to full trust. The
--   30/90/180/365 middle bands are preserved unchanged so existing
--   users don't lose ceiling headroom — a new 730-day threshold is
--   inserted at the top and the 548-day band's ceiling drops from
--   100 to 95 (Advanced tier). No user in prod is over 550 days old
--   (oldest is Marcus at ~173 days), so no live user's cap moves.
--
-- These are surgical, backward-compatible changes. The 3 legacy /
-- disused scoring RPCs (calculate_initial_xnscore, calculate_full_
-- xnscore, update_xnscore_for_event) stay in place — cleanup is a
-- separate follow-up.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Fix 1 — pipeline branches on row existence ─────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_xn_score(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_has_row  BOOLEAN;
  v_frozen   BOOLEAN;
BEGIN
  SELECT TRUE, COALESCE(score_frozen, FALSE)
    INTO v_has_row, v_frozen
    FROM public.xn_scores
   WHERE user_id = p_user_id
   LIMIT 1;

  -- Frozen users never move — bail before doing any work. Matches the
  -- gate that recalculate_all_xn_scores enforces on the caller side.
  IF v_frozen THEN
    RETURN;
  END IF;

  IF v_has_row THEN
    -- Existing user: recompute via the 5-factor ongoing model so
    -- payment reliability, completion, tenure activity, community
    -- standing, and financial behavior actually feed into the score.
    PERFORM public.recalculate_full_xnscore(p_user_id);
  ELSE
    -- First-time user: bootstrap the row from sign-up signals.
    -- Subsequent daily runs will pick the row up via the branch above.
    PERFORM public.calculate_initial_xnscore(p_user_id);
  END IF;
END;
$$;

-- ─── Fix 2 — age cap curve to 24 months ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_xnscore_age_cap(account_age_days integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN CASE
        WHEN account_age_days <  30  THEN 40    -- Probation (< 1 month)
        WHEN account_age_days <  90  THEN 55    -- Building trust (< 3 months)
        WHEN account_age_days < 180  THEN 70    -- Established (< 6 months)
        WHEN account_age_days < 365  THEN 85    -- Trusted (< 1 year)
        WHEN account_age_days < 548  THEN 90    -- Veteran (< 18 months)
        WHEN account_age_days < 730  THEN 95    -- Advanced (< 24 months) [NEW]
        ELSE                              100   -- Full trust (24+ months)
    END;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '328',
  'fix_xnscore_pipeline_to_full_model',
  ARRAY['-- 328: recalculate_xn_score branches on row existence; age cap stretched to 730 days']
)
ON CONFLICT (version) DO NOTHING;
