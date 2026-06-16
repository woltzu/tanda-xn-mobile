-- ============================================================================
-- Migration 156: Score Hub P2 (Automation & Learning)
-- ============================================================================
-- The audit found three score-history tables already exist
-- (`xnscore_history`, `xn_score_history`, `honor_score_history`, plus the
-- generic `score_history`) and every current/snapshot table carries a
-- `previous_score` column. So this migration deliberately does NOT create
-- yet another history table. Instead it:
--
--   1. Rebuilds `get_user_scores` to return the additional fields the
--      Score Hub P2 UX needs: per-score previous, 7d-ago, and
--      percentile. The previous/7d-ago come straight from the existing
--      tables; the percentile is a deterministic mock today with a TODO
--      pointing at the real implementation.
--   2. Adds `get_score_percentile(score_type)` as a thin wrapper so the
--      frontend can re-query a single score's percentile without re-
--      fetching the rest of the bundle.
--   3. Creates `score_notification_log` — append-only idempotency anchor
--      so the daily `check-score-changes` Edge Function (shipped in the
--      same checkpoint as a placeholder) doesn't drop the same "your
--      XnScore changed" notification twice when invoked back-to-back.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. score_notification_log
-- ----------------------------------------------------------------------------
-- One row per (user, score_type, snapshot_score). The PK doubles as the
-- idempotency key — the Edge Function does `ON CONFLICT DO NOTHING` and
-- only emits a notifications row when the insert actually wrote.
CREATE TABLE IF NOT EXISTS public.score_notification_log (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_type     TEXT NOT NULL CHECK (score_type IN ('xn','honor','stress','mood')),
  snapshot_score INTEGER NOT NULL,
  tier_after     TEXT,
  delta          INTEGER,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, score_type, snapshot_score)
);

CREATE INDEX IF NOT EXISTS idx_score_notif_log_user_sent
  ON public.score_notification_log(user_id, sent_at DESC);

ALTER TABLE public.score_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snl_select_own" ON public.score_notification_log;
CREATE POLICY "snl_select_own"
  ON public.score_notification_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT policy for clients — the edge function writes via
-- service-role and bypasses RLS.

COMMENT ON TABLE public.score_notification_log IS
  'Idempotency anchor for the daily check-score-changes Edge Function. '
  'One row per (user, score_type, snapshot_score) prevents duplicate '
  '"your score changed" notifications when the cron re-runs.';


-- ----------------------------------------------------------------------------
-- 2. get_score_percentile (mock with TODO)
-- ----------------------------------------------------------------------------
-- Returns a stable 10..90 percentile derived from a hash of the user-id
-- and score type, so the UI doesn't flap between renders. Real
-- implementation needs a percent_rank() pass across all users for the
-- score type — too expensive to compute on every screen open. Future
-- work: materialise into a `score_percentiles` view refreshed by the
-- nightly cron alongside score recompute.
CREATE OR REPLACE FUNCTION public.get_score_percentile(
  p_score_type TEXT,
  p_user_id    UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid  UUID := COALESCE(p_user_id, auth.uid());
  v_hash BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_score_type NOT IN ('xn','honor','stress','mood') THEN
    RAISE EXCEPTION 'get_score_percentile: bad score_type %', p_score_type;
  END IF;

  -- TODO(2026-Q3): replace with percent_rank() over the actual score
  -- distribution. For now we hash (user_id, score_type) to a stable
  -- integer in [10, 90] so the value doesn't flap on re-render and the
  -- frontend can wire the label up today.
  v_hash := abs(hashtext(v_uid::TEXT || ':' || p_score_type));
  RETURN 10 + (v_hash % 81)::INT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_score_percentile(TEXT, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_score_percentile(TEXT, UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_score_percentile IS
  'P2 mock — returns a stable 10..90 percentile for the caller''s score. '
  'Real implementation deferred until score_percentiles materialised view '
  'is built.';


-- ----------------------------------------------------------------------------
-- 3. get_user_scores — extended return
-- ----------------------------------------------------------------------------
-- Drop + recreate because RETURNS TABLE changes can't be done with
-- CREATE OR REPLACE alone. Existing callers (ScoreHubScreen via the
-- four-hooks-collapsed-into-one batch read from mig 144) re-fetch on
-- mount, so a drop is safe.
DROP FUNCTION IF EXISTS public.get_user_scores(UUID);

CREATE OR REPLACE FUNCTION public.get_user_scores(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  xnscore             INTEGER,
  xnscore_tier        TEXT,
  xnscore_delta       INTEGER,
  xnscore_previous    INTEGER,
  xnscore_7d_ago      INTEGER,
  xnscore_percentile  INTEGER,

  honor_score         INTEGER,
  honor_tier          TEXT,
  honor_delta         INTEGER,
  honor_previous      INTEGER,
  honor_7d_ago        INTEGER,
  honor_percentile    INTEGER,

  stress_score        INTEGER,
  stress_status       TEXT,
  stress_trend        TEXT,
  stress_top_signal   TEXT,
  stress_delta        INTEGER,
  stress_previous     INTEGER,
  stress_7d_ago       INTEGER,
  stress_percentile   INTEGER,

  mood_score          INTEGER,
  mood_tier           TEXT,
  mood_trend          TEXT,
  mood_delta          INTEGER,
  mood_previous       INTEGER,
  mood_7d_ago         INTEGER,
  mood_percentile     INTEGER,

  last_updated        TIMESTAMPTZ
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

  SELECT ROUND(stress_score)::INT INTO v_stress_7d
    FROM public.member_stress_scores
   WHERE member_id = v_user_id AND created_at <= now() - INTERVAL '7 days'
   ORDER BY created_at DESC LIMIT 1;

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

REVOKE EXECUTE ON FUNCTION public.get_user_scores(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_scores(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_user_scores IS
  'Batched read of all four score families plus P2 extras: per-score '
  'previous, 7-days-ago, and percentile. Percentile is a stable mock '
  'until score_percentiles materialised view lands.';


-- ----------------------------------------------------------------------------
-- 4. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '156',
  'score_hub_p2',
  ARRAY['-- 156: get_user_scores P2 fields + get_score_percentile + score_notification_log']
)
ON CONFLICT (version) DO NOTHING;
