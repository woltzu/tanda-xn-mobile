-- ═══════════════════════════════════════════════════════════════════════════
-- 256: Sensitive signal nudges — risk flags instead of raw scores for elders
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Governance principle (verbatim from spec):
--   "Even elders never see the raw numbers. What an elder receives is a
--    derived, consent-aware nudge: 'Circle X has a member who may miss
--    this cycle, consider reaching out or lining up a substitute.'"
--
-- Pieces:
--   1. compute_risk_flags(stress, mood) — pure data-in/data-out classifier
--      (IMMUTABLE). Thresholds: >=80=high, >=50=medium, else=low.
--   2. member_risk_flags VIEW — joins LATEST stress score + LATEST mood
--      snapshot per member. View's column list excludes raw scores
--      entirely; only risk_flag + risk_reason are projected.
--   3. get_circle_risk_flags(circle_id) RPC — elder-gated. Returns
--      per-member flags for participants of the given circle. Uses
--      SECURITY DEFINER so the RPC can read the underlying score
--      tables even though they're locked down.
--
-- Spec deviations (verified via read-only audit):
--   • Registry insert wrong table (recurring). Corrected to
--     supabase_migrations.schema_migrations.
--   • Spec's `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stress_
--     score / mood_drift_score` is bogus — those columns don't exist
--     on profiles AND no pipeline writes to them. Real data lives in
--     member_stress_scores.stress_score (NUMERIC) and member_mood_
--     snapshots.composite_mood_score (NUMERIC), each time-series.
--     The view joins the LATEST row per member (DISTINCT ON).
--   • Spec's GRANT SELECT TO authenticated on the view would leak
--     flags through the profiles RLS path (migration 255 lets co-
--     community members see profiles, so they'd also see each other's
--     flags). Dropped the grant — access only via the elder-gated RPC.
--   • Tier 4 hardening (SET search_path) added to all functions.
--   • Honest caveat on "hide raw scores from EVERYONE": the raw
--     numeric columns on member_stress_scores / member_mood_snapshots
--     remain readable to anyone with table access. True column-level
--     hiding would require REVOKE SELECT (specific cols), which
--     would break the legitimate self-view dashboards (Stress/Mood
--     screens show the user their own number). Pragmatic stance:
--     scores stay readable; elder-facing UI projects them only as
--     flags via this RPC.
--
-- Threshold caveat: thresholds assume scores are 0-100. mood scores
-- are numeric with no enforced range — verify in dev once real data
-- exists; thresholds may need tuning.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. compute_risk_flags — pure classifier. NULL-safe (NULL >= 80 is NULL,
--    falls through to ELSE → 'low' for members without signal data).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_risk_flags(
  p_stress_score NUMERIC,
  p_mood_drift_score NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(p_stress_score, 0) >= 80 OR COALESCE(p_mood_drift_score, 0) >= 80 THEN
    RETURN 'high';
  ELSIF COALESCE(p_stress_score, 0) >= 50 OR COALESCE(p_mood_drift_score, 0) >= 50 THEN
    RETURN 'medium';
  ELSE
    RETURN 'low';
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. member_risk_flags view. SECURITY INVOKER (default) — runs as the
--    caller, so direct querying inherits the underlying table RLS. The
--    elder RPC below uses SECURITY DEFINER to bypass that and read for
--    any circle member when the caller is an elder.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW member_risk_flags AS
WITH latest_stress AS (
  SELECT DISTINCT ON (member_id) member_id, stress_score
  FROM member_stress_scores
  ORDER BY member_id, score_date DESC, created_at DESC
),
latest_mood AS (
  SELECT DISTINCT ON (member_id) member_id, composite_mood_score
  FROM member_mood_snapshots
  ORDER BY member_id, snapshot_date DESC, created_at DESC
)
SELECT
  p.id AS user_id,
  p.display_name,
  p.full_name,
  compute_risk_flags(s.stress_score, m.composite_mood_score) AS risk_flag,
  CASE
    WHEN COALESCE(s.stress_score, 0) >= 80 THEN 'High stress'
    WHEN COALESCE(m.composite_mood_score, 0) >= 80 THEN 'High mood drift'
    WHEN COALESCE(s.stress_score, 0) >= 50 THEN 'Medium stress'
    WHEN COALESCE(m.composite_mood_score, 0) >= 50 THEN 'Medium mood drift'
    ELSE NULL
  END AS risk_reason
FROM profiles p
LEFT JOIN latest_stress s ON s.member_id = p.id
LEFT JOIN latest_mood m ON m.member_id = p.id;

-- No GRANT to authenticated — access only via the elder RPC below.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. get_circle_risk_flags(circle_id) — elder-only RPC.
--    Uses SECURITY DEFINER so the RPC can read member_stress_scores and
--    member_mood_snapshots irrespective of the caller's profile-RLS view.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_circle_risk_flags(p_circle_id UUID)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  full_name    TEXT,
  risk_flag    TEXT,
  risk_reason  TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can view risk flags';
  END IF;

  RETURN QUERY
  SELECT
    mrf.user_id,
    mrf.display_name,
    mrf.full_name,
    mrf.risk_flag,
    mrf.risk_reason
  FROM circle_members cm
  JOIN member_risk_flags mrf ON mrf.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id
    AND cm.status IN ('active', 'pending', 'paused');
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '256',
  'sensitive_signal_nudges',
  ARRAY['-- 256: sensitive_signal_nudges']
)
ON CONFLICT (version) DO NOTHING;
