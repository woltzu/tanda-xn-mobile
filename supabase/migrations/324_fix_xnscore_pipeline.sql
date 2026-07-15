-- ═══════════════════════════════════════════════════════════════════════════
-- 324_fix_xnscore_pipeline.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes the daily scoring pipeline's Step 4 (XnScore recalculation),
-- which has been returning `xnscores: 0` every day since the pipeline
-- was deployed. Three stacked bugs unblocked in one migration:
--
-- Bug A — profiles was missing two columns that
-- calculate_initial_xnscore reads via v_profile.*:
--   * identity_verified (line 74)
--   * invited_by        (line 87)
-- (email_verified was fixed in mig 319. These two were latent behind
-- that — you only see them once the first one is unblocked.)
--
-- Bug B — recalculate_xn_score(uuid) did not exist as an RPC. The
-- caller recalculate_all_xn_scores loops over xn_scores calling this
-- function per user; every call threw "function does not exist", the
-- loop's EXCEPTION handler swallowed each one, and v_count never
-- incremented. This migration creates the RPC as a thin wrapper
-- around calculate_initial_xnscore. To make it a real "recalculate"
-- (not a "return existing"), the wrapper NULLs initial_calculated_at
-- first — that bypasses the early-return branch at the top of
-- calculate_initial_xnscore and forces a fresh compute + upsert.
--
-- Bug C — recalculate_all_xn_scores iterated `FROM xn_scores WHERE
-- score_frozen = false`. xn_scores was empty (0 rows — no user had
-- ever had a score row created), so the loop iterated 0 times. The
-- rewrite iterates over `profiles` with a LEFT JOIN to xn_scores to
-- preserve the score_frozen skip. New users get their first score row
-- on the next run automatically.
--
-- Backfill at the tail: one call to recalculate_all_xn_scores() so
-- every existing profile lands an xn_scores row now, without waiting
-- for tonight's 03:00 UTC cron.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Missing profile columns ─────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 2. recalculate_xn_score wrapper ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_xn_score(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Force full recompute — calculate_initial_xnscore short-circuits at
  -- its top if initial_calculated_at IS NOT NULL. NULL it first so the
  -- daily recalc actually recalculates. First-time users have no
  -- xn_scores row yet, so the UPDATE is a harmless no-op for them.
  UPDATE public.xn_scores
     SET initial_calculated_at = NULL
   WHERE user_id = p_user_id
     AND score_frozen = FALSE;

  PERFORM public.calculate_initial_xnscore(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_xn_score(UUID) TO service_role;

-- ─── 3. Rewrite recalculate_all_xn_scores ───────────────────────────────

CREATE OR REPLACE FUNCTION public.recalculate_all_xn_scores()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count   INTEGER := 0;
  v_user_id UUID;
BEGIN
  -- Iterate over profiles, skipping frozen scores. LEFT JOIN so users
  -- without an xn_scores row yet (first-timers) are still included.
  FOR v_user_id IN
    SELECT p.id
      FROM public.profiles p
      LEFT JOIN public.xn_scores xs ON xs.user_id = p.id
     WHERE COALESCE(xs.score_frozen, FALSE) = FALSE
  LOOP
    BEGIN
      PERFORM public.recalculate_xn_score(v_user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalculate_xn_score failed for user %: %',
        v_user_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ─── 4. One-shot backfill ───────────────────────────────────────────────
-- Runs immediately so xn_scores populates without waiting for tonight's
-- 03:00 UTC pipeline run. Errors are swallowed per-user by the loop's
-- EXCEPTION handler (same pattern the pipeline itself uses).

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'Backfilled % xn_scores rows', v_count;
END $$;

-- ─── Self-register ──────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '324',
  'fix_xnscore_pipeline',
  ARRAY['-- 324: unblock XnScore recalc — missing profile cols + missing wrapper RPC + empty-table loop']
)
ON CONFLICT (version) DO NOTHING;
