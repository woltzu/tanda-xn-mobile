-- 397: Enable RLS + self-read / admin-read policies on the two XnScore
--      pre-migration snapshot tables. Fixes rls_disabled_in_public
--      linter ERRORs on public.xnscore_pre_savings_snapshot and
--      public.xnscore_pre_396b_snapshot.
--
-- Both tables carry per-user total_score + factor_scores breakdowns
-- (created by mig 396 and 396b). Without RLS, any authenticated JWT
-- could SELECT the entire snapshot — exposing every user's trust
-- score and factor decomposition. This locks reads to:
--   - the user themselves               (user_id = auth.uid())
--   - active super_admin / admin only   (for the transparency panel)
-- service_role bypasses RLS as always. Writes stay closed under the
-- default-deny that follows enabling RLS with only SELECT policies
-- defined — snapshot inserts happen via SECURITY DEFINER paths in
-- mig 396 / 396b or via service_role directly.

-- ─── 1. Enable RLS ────────────────────────────────────────────────────────
-- ALTER ... ENABLE ROW LEVEL SECURITY is a no-op if already enabled.
ALTER TABLE public.xnscore_pre_savings_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xnscore_pre_396b_snapshot    ENABLE ROW LEVEL SECURITY;

-- ─── 2. Self-read policies ────────────────────────────────────────────────
-- CREATE POLICY has no IF NOT EXISTS; DROP first for idempotency.
DROP POLICY IF EXISTS xnscore_pre_savings_snapshot_self_read
  ON public.xnscore_pre_savings_snapshot;
CREATE POLICY xnscore_pre_savings_snapshot_self_read
  ON public.xnscore_pre_savings_snapshot
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS xnscore_pre_396b_snapshot_self_read
  ON public.xnscore_pre_396b_snapshot;
CREATE POLICY xnscore_pre_396b_snapshot_self_read
  ON public.xnscore_pre_396b_snapshot
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── 3. Admin-read policies (super_admin + admin) ─────────────────────────
-- Matches the gate used in mig 389 / 380 / 373 — active AND correct role.
-- Legacy 'platform_admin' rows (per mig 389 comment) are excluded by design.
DROP POLICY IF EXISTS xnscore_pre_savings_snapshot_admin_read
  ON public.xnscore_pre_savings_snapshot;
CREATE POLICY xnscore_pre_savings_snapshot_admin_read
  ON public.xnscore_pre_savings_snapshot
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS xnscore_pre_396b_snapshot_admin_read
  ON public.xnscore_pre_396b_snapshot;
CREATE POLICY xnscore_pre_396b_snapshot_admin_read
  ON public.xnscore_pre_396b_snapshot
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
        AND is_active = TRUE
        AND role IN ('super_admin', 'admin')
    )
  );

-- ─── 4. Self-register ─────────────────────────────────────────────────────
-- Per CLAUDE.md convention. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '397',
  'xnscore_snapshot_rls',
  ARRAY['-- 397: xnscore_snapshot_rls']
)
ON CONFLICT (version) DO NOTHING;
