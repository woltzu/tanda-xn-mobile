-- ═══════════════════════════════════════════════════════════════════════════
-- 283_get_user_scores_ambiguity_fix.sql
--
-- Fixes: [useXnScoreFromBundle] fetch failed — 42702 "column reference
--        'stress_score' is ambiguous" from the get_user_scores RPC.
--
-- Root cause: the RPC's RETURNS TABLE declares an OUT column
--   `stress_score integer`. Inside the body, the 7-day-ago lookup does:
--       SELECT ROUND(stress_score)::INT INTO v_stress_7d
--         FROM public.member_stress_scores ...
--   Postgres sees two candidates for the bare identifier `stress_score`:
--     (a) the OUT column of the enclosing function, and
--     (b) the column `stress_score` on member_stress_scores.
--   That's the 42702 error the hook surfaces.
--
-- Fix: alias member_stress_scores and qualify the reference (mss.stress_score).
-- Function body is otherwise byte-identical to the current definition; the
-- return shape, arguments, security context, and search_path stay the same.
--
-- (The composite_mood_score reference is already unambiguous — no OUT
--  column shares its name — so mood remains untouched.)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_user_scores(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  xnscore                INTEGER,
  xnscore_tier           TEXT,
  xnscore_delta          INTEGER,
  xnscore_previous       INTEGER,
  xnscore_7d_ago         INTEGER,
  xnscore_percentile     INTEGER,
  honor_score            INTEGER,
  honor_tier             TEXT,
  honor_delta            INTEGER,
  honor_previous         INTEGER,
  honor_7d_ago           INTEGER,
  honor_percentile       INTEGER,
  stress_score           INTEGER,
  stress_status          TEXT,
  stress_trend           TEXT,
  stress_top_signal      TEXT,
  stress_delta           INTEGER,
  stress_previous        INTEGER,
  stress_7d_ago          INTEGER,
  stress_percentile      INTEGER,
  mood_score             INTEGER,
  mood_tier              TEXT,
  mood_trend             TEXT,
  mood_delta             INTEGER,
  mood_previous          INTEGER,
  mood_7d_ago            INTEGER,
  mood_percentile        INTEGER,
  last_updated           TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id    UUID;
  v_xn         public.xn_scores%ROWTYPE;
  v_honor      public.honor_scores%ROWTYPE;
  v_stress     public.member_stress_scores%ROWTYPE;
  v_mood       public.member_mood_snapshots%ROWTYPE;
  v_top_signal TEXT;
  v_last       TIMESTAMPTZ;

  v_xn_7d      INTEGER;
  v_honor_7d   INTEGER;
  v_stress_7d  INTEGER;
  v_mood_7d    INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT * INTO v_xn    FROM public.xn_scores             WHERE user_id   = v_user_id;
  SELECT * INTO v_honor FROM public.honor_scores          WHERE user_id   = v_user_id;
  SELECT * INTO v_stress
    FROM public.member_stress_scores
   WHERE member_id = v_user_id
   ORDER BY created_at DESC
   LIMIT 1;
  SELECT * INTO v_mood
    FROM public.member_mood_snapshots
   WHERE member_id = v_user_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- 7-days-ago lookups. Each table is append-only; we want the latest
  -- row whose timestamp is <= 7 days ago. NULL when there's no history
  -- that old — the frontend hides the anomaly banner in that case.
  SELECT ROUND(score)::INT INTO v_xn_7d
    FROM public.xnscore_history
   WHERE user_id = v_user_id AND created_at <= now() - INTERVAL '7 days'
   ORDER BY created_at DESC LIMIT 1;

  SELECT ROUND(score)::INT INTO v_honor_7d
    FROM public.honor_score_history
   WHERE user_id = v_user_id AND created_at <= now() - INTERVAL '7 days'
   ORDER BY created_at DESC LIMIT 1;

  -- ⚠ `stress_score` on member_stress_scores collides with the OUT
  -- column of this RPC — alias the table so the reference resolves to
  -- the table column and not the enclosing function's OUT param.
  SELECT ROUND(mss.stress_score)::INT INTO v_stress_7d
    FROM public.member_stress_scores mss
   WHERE mss.member_id = v_user_id
     AND mss.created_at <= now() - INTERVAL '7 days'
   ORDER BY mss.created_at DESC LIMIT 1;

  SELECT ROUND(composite_mood_score)::INT INTO v_mood_7d
    FROM public.member_mood_snapshots
   WHERE member_id = v_user_id AND created_at <= now() - INTERVAL '7 days'
   ORDER BY created_at DESC LIMIT 1;

  -- Top stress signal: highest weighted_value in the breakdown. Same
  -- logic as the prior RPC body.
  IF v_stress.signal_breakdown IS NOT NULL
     AND v_stress.signal_breakdown <> '{}'::jsonb THEN
    SELECT key INTO v_top_signal
    FROM (
      SELECT key,
             COALESCE(NULLIF(value->>'weighted_value', '')::NUMERIC, 0) AS w
      FROM jsonb_each(v_stress.signal_breakdown)
      WHERE jsonb_typeof(value) = 'object'
    ) ranked
    ORDER BY w DESC NULLS LAST
    LIMIT 1;
  END IF;

  v_last := GREATEST(
    COALESCE(v_xn.updated_at,     '-infinity'::TIMESTAMPTZ),
    COALESCE(v_honor.updated_at,  '-infinity'::TIMESTAMPTZ),
    COALESCE(v_stress.created_at, '-infinity'::TIMESTAMPTZ),
    COALESCE(v_mood.created_at,   '-infinity'::TIMESTAMPTZ)
  );
  IF v_last = '-infinity'::TIMESTAMPTZ THEN
    v_last := NULL;
  END IF;

  RETURN QUERY SELECT
    -- XnScore
    CASE WHEN v_xn.total_score IS NULL THEN NULL
         ELSE ROUND(v_xn.total_score)::INT END,
    v_xn.score_tier::TEXT,
    CASE WHEN v_xn.previous_score IS NOT NULL AND v_xn.total_score IS NOT NULL
         THEN ROUND(v_xn.total_score - v_xn.previous_score)::INT
         ELSE NULL END,
    CASE WHEN v_xn.previous_score IS NULL THEN NULL
         ELSE ROUND(v_xn.previous_score)::INT END,
    v_xn_7d,
    CASE WHEN v_xn.total_score IS NULL THEN NULL
         ELSE public.get_score_percentile('xn', v_user_id) END,

    -- Honor
    CASE WHEN v_honor.total_score IS NULL THEN NULL
         ELSE ROUND(v_honor.total_score)::INT END,
    v_honor.score_tier,
    CASE WHEN v_honor.previous_score IS NOT NULL AND v_honor.total_score IS NOT NULL
         THEN ROUND(v_honor.total_score - v_honor.previous_score)::INT
         ELSE NULL END,
    CASE WHEN v_honor.previous_score IS NULL THEN NULL
         ELSE ROUND(v_honor.previous_score)::INT END,
    v_honor_7d,
    CASE WHEN v_honor.total_score IS NULL THEN NULL
         ELSE public.get_score_percentile('honor', v_user_id) END,

    -- Stress
    CASE WHEN v_stress.stress_score IS NULL THEN NULL
         ELSE ROUND(v_stress.stress_score)::INT END,
    v_stress.status,
    v_stress.trend,
    v_top_signal,
    CASE WHEN v_stress.previous_score IS NOT NULL AND v_stress.stress_score IS NOT NULL
         THEN ROUND(v_stress.stress_score - v_stress.previous_score)::INT
         ELSE NULL END,
    CASE WHEN v_stress.previous_score IS NULL THEN NULL
         ELSE ROUND(v_stress.previous_score)::INT END,
    v_stress_7d,
    CASE WHEN v_stress.stress_score IS NULL THEN NULL
         ELSE public.get_score_percentile('stress', v_user_id) END,

    -- Mood
    CASE WHEN v_mood.composite_mood_score IS NULL THEN NULL
         ELSE ROUND(v_mood.composite_mood_score)::INT END,
    v_mood.tier,
    v_mood.trend,
    CASE WHEN v_mood.previous_score IS NOT NULL AND v_mood.composite_mood_score IS NOT NULL
         THEN ROUND(v_mood.composite_mood_score - v_mood.previous_score)::INT
         ELSE NULL END,
    CASE WHEN v_mood.previous_score IS NULL THEN NULL
         ELSE ROUND(v_mood.previous_score)::INT END,
    v_mood_7d,
    CASE WHEN v_mood.composite_mood_score IS NULL THEN NULL
         ELSE public.get_score_percentile('mood', v_user_id) END,

    v_last;
END;
$function$;

-- ─── Self-register ─────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '283',
  'get_user_scores_ambiguity_fix',
  ARRAY['-- 283: get_user_scores_ambiguity_fix']
)
ON CONFLICT (version) DO NOTHING;
