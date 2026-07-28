-- ═══════════════════════════════════════════════════════════════════════════
-- 383_member_risk_flags_lockdown.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Closes the fourth linter finding — `member_risk_flags` was created as
-- SECURITY DEFINER (implicit; owner = postgres) and had default schema
-- grants that gave anon + authenticated full privileges (SELECT / INSERT
-- / UPDATE / DELETE / TRUNCATE / TRIGGER / REFERENCES). Anyone with the
-- anon key could query the view directly and see stress + mood scores
-- for every member on the platform.
--
-- The view reads from member_stress_scores + member_mood_snapshots.
-- Both underlying tables have RLS enabled, so the primary defense is
-- flipping the view to security_invoker — it now runs with the caller's
-- permissions, respecting the RLS policies on the underlying tables.
--
-- Then belt-and-suspenders: revoke all privileges from anon +
-- authenticated. The only reader of this view is a SECURITY DEFINER
-- RPC — get_circle_risk_flags(p_circle_id UUID) — that runs as the
-- postgres owner (which still has SELECT via the default owner
-- privilege) and projects the appropriate subset to callers. Client
-- code doesn't read the view directly (verified by grep across the
-- repo — only migration files reference the name).
--
-- Preserves:
--   * postgres owner privileges (implicit, unchanged).
--   * claude_audit SELECT (audit tooling, external to app).
--   * service_role SELECT (re-granted for clarity + idempotency).
--   * get_circle_risk_flags RPC keeps working — it runs as postgres,
--     which retains SELECT on the view.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Flip to security_invoker so the view respects RLS on underlying
--    tables. This is the primary defense: even without the revoke,
--    an authenticated user querying the view would only see rows the
--    underlying RLS policies let them see.
ALTER VIEW public.member_risk_flags SET (security_invoker = TRUE);

-- 2. Revoke every default privilege from anon + authenticated. Views
--    aren't updatable so most of these were already no-ops in practice,
--    but they showed up on any grant audit and left a bad impression.
REVOKE ALL ON public.member_risk_flags FROM anon;
REVOKE ALL ON public.member_risk_flags FROM authenticated;

-- 3. Re-grant SELECT to service_role for internal admin tooling. Idempotent
--    with the existing grant.
GRANT SELECT ON public.member_risk_flags TO service_role;

-- 4. Document the constraints so a future migration doesn't accidentally
--    re-open the view.
COMMENT ON VIEW public.member_risk_flags IS
  'Aggregates latest stress + mood scores into a risk flag per member. '
  'Access restricted to service_role (internal admin tooling) + '
  'claude_audit (audit role). anon and authenticated cannot SELECT — '
  'callers go through the get_circle_risk_flags(circle_id) SECURITY '
  'DEFINER RPC which projects the appropriate subset. security_invoker '
  'is TRUE so RLS on member_stress_scores + member_mood_snapshots is '
  'respected on any direct SELECT that does happen (mig 383, 2026-07-28).';

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '383',
  'member_risk_flags_lockdown',
  ARRAY['-- 383: member_risk_flags → security_invoker + REVOKE ALL from anon/authenticated + preserve service_role SELECT. Clears the fourth linter ERROR. Client access goes through get_circle_risk_flags SECURITY DEFINER RPC.']
)
ON CONFLICT (version) DO NOTHING;
