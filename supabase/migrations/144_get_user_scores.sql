-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 144: get_user_scores — batched Score Hub fetcher
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Single round-trip replacement for the four hooks the Score Hub used to
-- consult independently (XnScore, Honor, Stress, Mood). Returns one wide row
-- with each score's current value, tier/status, week-over-week delta, plus
-- the highest-weighted stress signal so the hero card can name it inline.
--
-- Source tables (all unique-or-latest per user):
--   xn_scores              — one row per user_id           (migration 019)
--   honor_scores           — one row per user_id           (migration 037)
--   member_stress_scores   — append-only; latest by ctime  (migration 060)
--   member_mood_snapshots  — append-only; latest by ctime  (migration 061)
--
-- Deltas are computed from each row's previous_score column (engines maintain
-- it as the prior value). For stress + mood that delta is also exposed as the
-- generated score_delta column, but we compute it here too so the return shape
-- is uniform.

CREATE OR REPLACE FUNCTION public.get_user_scores(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  xnscore             INT,
  xnscore_tier        TEXT,
  xnscore_delta       INT,
  honor_score         INT,
  honor_tier          TEXT,
  honor_delta         INT,
  stress_score        INT,
  stress_status       TEXT,
  stress_trend        TEXT,
  stress_top_signal   TEXT,
  stress_delta        INT,
  mood_score          INT,
  mood_tier           TEXT,
  mood_trend          TEXT,
  mood_delta          INT,
  last_updated        TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    UUID;
  v_xn         public.xn_scores%ROWTYPE;
  v_honor      public.honor_scores%ROWTYPE;
  v_stress     public.member_stress_scores%ROWTYPE;
  v_mood       public.member_mood_snapshots%ROWTYPE;
  v_top_signal TEXT;
  v_last       TIMESTAMPTZ;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- XnScore (unique by user_id; may be absent for never-scored user)
  SELECT * INTO v_xn
  FROM public.xn_scores
  WHERE user_id = v_user_id;

  -- Honor (unique by user_id; may be absent until first computation)
  SELECT * INTO v_honor
  FROM public.honor_scores
  WHERE user_id = v_user_id;

  -- Stress (latest snapshot — table is append-only)
  SELECT * INTO v_stress
  FROM public.member_stress_scores
  WHERE member_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Mood (latest snapshot — table is append-only)
  SELECT * INTO v_mood
  FROM public.member_mood_snapshots
  WHERE member_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- Top stress signal: the signal_breakdown key whose weighted_value is
  -- highest. Tolerates non-object children and missing weighted_value via
  -- COALESCE → 0. Returns NULL if breakdown is null/empty.
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

  -- last_updated = max wall-clock across the four rows that exist
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
    -- Honor
    CASE WHEN v_honor.total_score IS NULL THEN NULL
         ELSE ROUND(v_honor.total_score)::INT END,
    v_honor.score_tier,
    CASE WHEN v_honor.previous_score IS NOT NULL AND v_honor.total_score IS NOT NULL
         THEN ROUND(v_honor.total_score - v_honor.previous_score)::INT
         ELSE NULL END,
    -- Stress
    CASE WHEN v_stress.stress_score IS NULL THEN NULL
         ELSE ROUND(v_stress.stress_score)::INT END,
    v_stress.status,
    v_stress.trend,
    v_top_signal,
    CASE WHEN v_stress.previous_score IS NOT NULL AND v_stress.stress_score IS NOT NULL
         THEN ROUND(v_stress.stress_score - v_stress.previous_score)::INT
         ELSE NULL END,
    -- Mood
    CASE WHEN v_mood.composite_mood_score IS NULL THEN NULL
         ELSE ROUND(v_mood.composite_mood_score)::INT END,
    v_mood.tier,
    v_mood.trend,
    CASE WHEN v_mood.previous_score IS NOT NULL AND v_mood.composite_mood_score IS NOT NULL
         THEN ROUND(v_mood.composite_mood_score - v_mood.previous_score)::INT
         ELSE NULL END,
    v_last;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_scores(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_scores(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_user_scores(UUID) TO authenticated;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '144',
  'get_user_scores',
  ARRAY['-- 144: get_user_scores']
)
ON CONFLICT (version) DO NOTHING;
