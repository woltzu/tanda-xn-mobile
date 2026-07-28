-- ═══════════════════════════════════════════════════════════════════════════
-- 382_enable_rls_on_three_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Clears three ERROR-level Supabase linter findings:
--   * substitute_needed_events   — RLS disabled
--   * held_contributions         — RLS disabled
--   * kyc_verification_requests  — RLS disabled
--
-- All three tables are empty in prod (0 rows) so there's no data-visibility
-- change on apply. All existing writers are SECURITY DEFINER RPCs (mig 265,
-- 267, 268) which bypass RLS by design — enabling RLS doesn't break them.
--
-- The fourth linter row (member_risk_flags SECURITY DEFINER view) is
-- addressed separately per user directive — see report notes.
--
-- Policy shapes:
--
-- substitute_needed_events — circle-member READ + admin ALL + service:
--   SubstituteDashboardScreen (screens/SubstituteDashboardScreen.tsx:153)
--   queries this table filtering by circles the caller is an active
--   member of. A member-scoped SELECT policy matches that pattern so the
--   screen keeps working. Admin-only would break the elder-facing UI.
--   Writes stay admin-gated (mig 265's rotate_substitute RPC is
--   SECURITY DEFINER so its inserts bypass this anyway).
--
-- held_contributions — admin + service only (no direct user access):
--   Ledger-adjacent. Per user directive. Any user-facing surface would
--   go through a SECURITY DEFINER RPC that projects only the columns +
--   rows appropriate for the caller.
--
-- kyc_verification_requests — self-read + admin + service:
--   Standard user-owned resource pattern. Users see their own submitted
--   requests; admins review; RPCs (SECURITY DEFINER) handle inserts
--   from mig 268's submission flow.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. substitute_needed_events ──────────────────────────────────────────
ALTER TABLE public.substitute_needed_events ENABLE ROW LEVEL SECURITY;

-- Members of the affected circle SELECT open events for that circle.
-- Mirrors the SubstituteDashboardScreen query which already filters
-- circle_id IN (my active circles).
DROP POLICY IF EXISTS sne_member_read ON public.substitute_needed_events;
CREATE POLICY sne_member_read ON public.substitute_needed_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circle_members cm
     WHERE cm.circle_id = substitute_needed_events.circle_id
       AND cm.user_id   = auth.uid()
       AND cm.status    = 'active'
  ));

-- Admins read + write all.
DROP POLICY IF EXISTS sne_admin ON public.substitute_needed_events;
CREATE POLICY sne_admin ON public.substitute_needed_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS sne_service ON public.substitute_needed_events;
CREATE POLICY sne_service ON public.substitute_needed_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. held_contributions ────────────────────────────────────────────────
ALTER TABLE public.held_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hc_admin ON public.held_contributions;
CREATE POLICY hc_admin ON public.held_contributions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS hc_service ON public.held_contributions;
CREATE POLICY hc_service ON public.held_contributions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 3. kyc_verification_requests ─────────────────────────────────────────
ALTER TABLE public.kyc_verification_requests ENABLE ROW LEVEL SECURITY;

-- User reads their own requests. No INSERT policy for authenticated —
-- mig 268's submission RPC (SECURITY DEFINER) handles inserts, so
-- clients don't insert directly.
DROP POLICY IF EXISTS kvr_self_read ON public.kyc_verification_requests;
CREATE POLICY kvr_self_read ON public.kyc_verification_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins read + write all (review flow).
DROP POLICY IF EXISTS kvr_admin ON public.kyc_verification_requests;
CREATE POLICY kvr_admin ON public.kyc_verification_requests
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS kvr_service ON public.kyc_verification_requests;
CREATE POLICY kvr_service ON public.kyc_verification_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '382',
  'enable_rls_on_three_tables',
  ARRAY['-- 382: enable RLS + policies on substitute_needed_events, held_contributions, kyc_verification_requests. Clears three ERROR-level linter findings. member_risk_flags view left as-is per user directive.']
)
ON CONFLICT (version) DO NOTHING;
