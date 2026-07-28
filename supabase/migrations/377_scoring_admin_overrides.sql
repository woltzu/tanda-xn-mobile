-- ═══════════════════════════════════════════════════════════════════════════
-- 377_scoring_admin_overrides.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 2a of the scoring admin controls (Phase 1 = mig 376 freeze/dashboard).
-- Adds manual XnScore override with a full audit trail.
--
-- Key design choice: reuse the existing xn_scores.score_frozen mechanism.
-- recalculate_all_xn_scores() already filters WHERE COALESCE(xs.score_frozen,
-- FALSE) = FALSE, so setting score_frozen=TRUE on override automatically
-- excludes the user from the next pipeline run. No changes to
-- recalculate_all_xn_scores or run_scoring_pipeline needed for the skip —
-- the pipeline already respects the freeze.
--
-- Audit trail lives in a new admin_xnscore_overrides table (per user spec).
-- xnscore_history also gets a row per override / removal so the existing
-- score-history read path surfaces admin actions inline with system events.
--
-- Concurrency:
--   * Partial unique index on (user_id) WHERE active=TRUE — enforces at most
--     one active override per user at the schema level. If a second override
--     arrives, override_xn_score auto-deactivates the prior one FIRST (via
--     an explicit UPDATE), then inserts the new one. Audit is preserved by
--     the two rows.
--
-- FK design:
--   * admin_user_id NOT NULL REFERENCES auth.users(id) — no ON DELETE
--     clause = NO ACTION. Deleting an admin who has historic overrides is
--     blocked; the audit trail is untouchable. Admins are essentially never
--     hard-deleted in practice, so this is safer than SET NULL (which would
--     erase the "who did this" from the audit row).
--   * deactivated_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET
--     NULL — this one CAN go null (the removal actor is less critical than
--     the applier).
--
-- What this migration does NOT touch:
--   * run_scoring_pipeline — no changes; freeze mechanism already handles
--     the skip. Overrides visibility surfaces via a separate RPC.
--   * The pipeline never SEES admin_xnscore_overrides; it only ever reads
--     xn_scores.score_frozen. This keeps the pipeline unaware of the audit
--     concept — the two systems are coupled only through the boolean flag.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. admin_xnscore_overrides table ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_xnscore_overrides (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_score                NUMERIC(5,2) NOT NULL,
  new_score                NUMERIC(5,2) NOT NULL
                             CHECK (new_score >= 0 AND new_score <= 100),
  reason                   TEXT NOT NULL,
  admin_note               TEXT,
  admin_user_id            UUID NOT NULL REFERENCES auth.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at               TIMESTAMPTZ,
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at           TIMESTAMPTZ,
  deactivated_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deactivated_reason       TEXT
);

-- One active override per user, ever.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_xnscore_overrides_active_user
  ON public.admin_xnscore_overrides(user_id)
  WHERE active = TRUE;

-- Chronological reads (dashboard "recent overrides").
CREATE INDEX IF NOT EXISTS idx_admin_xnscore_overrides_created
  ON public.admin_xnscore_overrides(created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.admin_xnscore_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_xnscore_overrides_read_admin ON public.admin_xnscore_overrides;
CREATE POLICY admin_xnscore_overrides_read_admin ON public.admin_xnscore_overrides
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS admin_xnscore_overrides_service ON public.admin_xnscore_overrides;
CREATE POLICY admin_xnscore_overrides_service ON public.admin_xnscore_overrides
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. override_xn_score RPC ─────────────────────────────────────────────
-- Admin-gated. Auto-deactivates any existing active override for this user
-- (audit preserved via the pair of rows). Sets xn_scores.score_frozen=TRUE
-- so the pipeline's existing freeze filter excludes this user until the
-- override is removed.
CREATE OR REPLACE FUNCTION public.override_xn_score(
  p_user_id     UUID,
  p_new_score   NUMERIC,
  p_reason      TEXT,
  p_admin_note  TEXT DEFAULT NULL,
  p_expires_at  TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_old_score   NUMERIC(5,2);
  v_override_id UUID;
  v_history_id  UUID;
  v_delta       NUMERIC(5,2);
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF p_new_score IS NULL OR p_new_score < 0 OR p_new_score > 100 THEN
    RAISE EXCEPTION 'invalid_score_range';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Capture old score (may be NULL if user has no xn_scores row yet — that
  -- happens for freshly-created users. Default to 20.00 which is the
  -- mig 019 seed value for new members).
  SELECT total_score INTO v_old_score
    FROM public.xn_scores WHERE user_id = p_user_id;
  v_old_score := COALESCE(v_old_score, 20.00);
  v_delta     := p_new_score - v_old_score;

  -- Auto-deactivate any existing active override for this user. Preserves
  -- audit via the row (active=FALSE, deactivated_at set, deactivated_reason
  -- explains it was superseded).
  UPDATE public.admin_xnscore_overrides
     SET active                  = FALSE,
         deactivated_at          = NOW(),
         deactivated_by_admin_id = v_admin,
         deactivated_reason      = 'superseded_by_new_override'
   WHERE user_id = p_user_id AND active = TRUE;

  -- Insert the new override.
  INSERT INTO public.admin_xnscore_overrides (
    user_id, old_score, new_score, reason, admin_note,
    admin_user_id, expires_at
  )
  VALUES (
    p_user_id, v_old_score, p_new_score, p_reason, p_admin_note,
    v_admin, p_expires_at
  )
  RETURNING id INTO v_override_id;

  -- UPSERT the xn_scores row. score_frozen=TRUE excludes this user from
  -- the daily pipeline's recalculate_all_xn_scores loop until removal.
  INSERT INTO public.xn_scores (
    user_id, total_score, previous_score, score_frozen, initial_calculated_at
  )
  VALUES (p_user_id, p_new_score, v_old_score, TRUE, NOW())
  ON CONFLICT (user_id) DO UPDATE
     SET total_score    = EXCLUDED.total_score,
         previous_score = EXCLUDED.previous_score,
         score_frozen   = TRUE;

  -- Write xnscore_history row so the existing score-history read path
  -- surfaces this event inline with system triggers (vouches, inactivity).
  INSERT INTO public.xnscore_history (
    user_id, score, previous_score, score_change,
    trigger_event, trigger_id, trigger_details
  )
  VALUES (
    p_user_id, p_new_score, v_old_score, v_delta,
    'admin_override', v_override_id, p_reason
  )
  RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'override_id', v_override_id,
    'history_id',  v_history_id,
    'user_id',     p_user_id,
    'old_score',   v_old_score,
    'new_score',   p_new_score,
    'delta',       v_delta,
    'expires_at',  p_expires_at,
    'admin',       v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.override_xn_score(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.override_xn_score(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ)
  TO authenticated;

-- ─── 3. remove_xn_score_override RPC ──────────────────────────────────────
-- Admin-gated. Clears the freeze so the next pipeline run recomputes the
-- score from source. The override row is preserved (active=FALSE) as an
-- immutable audit record.
CREATE OR REPLACE FUNCTION public.remove_xn_score_override(
  p_user_id  UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_override    RECORD;
  v_current     NUMERIC(5,2);
  v_history_id  UUID;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','platform_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  SELECT * INTO v_override
    FROM public.admin_xnscore_overrides
   WHERE user_id = p_user_id AND active = TRUE
   LIMIT 1;
  IF v_override IS NULL THEN
    RAISE EXCEPTION 'no_active_override';
  END IF;

  UPDATE public.admin_xnscore_overrides
     SET active                  = FALSE,
         deactivated_at          = NOW(),
         deactivated_by_admin_id = v_admin,
         deactivated_reason      = COALESCE(p_reason, 'admin_removed')
   WHERE id = v_override.id;

  -- Clear the freeze so the next daily pipeline run recomputes this
  -- user's score from source. total_score is left at the current
  -- overridden value until then; the pipeline will overwrite it.
  UPDATE public.xn_scores
     SET score_frozen = FALSE
   WHERE user_id = p_user_id;

  SELECT total_score INTO v_current
    FROM public.xn_scores WHERE user_id = p_user_id;

  INSERT INTO public.xnscore_history (
    user_id, score, previous_score, score_change,
    trigger_event, trigger_id, trigger_details
  )
  VALUES (
    p_user_id, v_current, v_current, 0,
    'admin_override_removed', v_override.id, COALESCE(p_reason, 'admin_removed')
  )
  RETURNING id INTO v_history_id;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'override_id',        v_override.id,
    'history_id',         v_history_id,
    'user_id',            p_user_id,
    'score_at_removal',   v_current,
    'admin',              v_admin
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_xn_score_override(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.remove_xn_score_override(UUID, TEXT) TO authenticated;

-- ─── 4. get_active_xnscore_overrides RPC ──────────────────────────────────
-- Admin-gated. Returns array of active override rows joined to profiles for
-- display. Consumed by the AdminScoringDashboard "Active overrides" card.
CREATE OR REPLACE FUNCTION public.get_active_xnscore_overrides()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_rows  JSONB;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = v_admin AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        o.id,
        o.user_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS member_name,
        o.old_score,
        o.new_score,
        (o.new_score - o.old_score) AS delta,
        o.reason,
        o.admin_note,
        o.admin_user_id,
        COALESCE(ap.full_name, split_part(au.email, '@', 1), 'Admin') AS admin_name,
        o.created_at,
        o.expires_at,
        (o.expires_at IS NOT NULL AND o.expires_at <= NOW()) AS is_expired
      FROM public.admin_xnscore_overrides o
      LEFT JOIN public.profiles  p  ON p.id  = o.user_id
      LEFT JOIN auth.users       u  ON u.id  = o.user_id
      LEFT JOIN public.profiles  ap ON ap.id = o.admin_user_id
      LEFT JOIN auth.users       au ON au.id = o.admin_user_id
      WHERE o.active = TRUE
    ) t;

  RETURN jsonb_build_object('overrides', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_xnscore_overrides() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_active_xnscore_overrides() TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '377',
  'scoring_admin_overrides',
  ARRAY['-- 377: admin_xnscore_overrides table + override_xn_score + remove_xn_score_override + get_active_xnscore_overrides. Reuses xn_scores.score_frozen for pipeline skip; no changes to run_scoring_pipeline.']
)
ON CONFLICT (version) DO NOTHING;
