-- 400: refresh_score_breakdown → SECURITY DEFINER
--
-- Follow-up to mig 398 / 399. Once the RECORD-field drift was corrected,
-- the RPC ran to completion under a service-role connection but failed
-- from the authenticated client with:
--
--   new row violates row-level security policy for table
--   "xn_score_breakdown_cache"
--
-- Cause: xn_score_breakdown_cache has RLS enabled but only ONE policy
-- (`breakdown_cache_own`, SELECT only, USING user_id = auth.uid()).
-- No INSERT / UPDATE / DELETE policy exists, so any write from an
-- authenticated JWT is default-denied — regardless of the permissive
-- table-level GRANTs. refresh_score_breakdown was SECURITY INVOKER
-- and therefore inherited the caller's auth.role().
--
-- Flip to SECURITY DEFINER so the function runs as its owner
-- (postgres, verified via pg_proc.proowner). postgres bypasses RLS
-- and owns the cache table with full privileges — no GRANT changes
-- needed. Same treatment implicitly covers the UPDATE on xn_scores
-- inside the same function body (writes breakdown_cached_at etc.),
-- which would have been the next RLS wall to hit.
--
-- Standard SECURITY DEFINER hardening included: SET search_path
-- pinned to public, pg_temp so a shadow schema can't redirect the
-- function's table references.
--
-- Not addressed here (filed as follow-ups):
--   * refresh_score_breakdown(p_user_id) accepts an arbitrary
--     p_user_id — post-DEFINER, any authenticated user can trigger a
--     recompute for any other user_id. No data disclosure (the
--     function returns BOOLEAN; the SELECT RLS still gates the cache
--     read), only a small nuisance-compute vector. Would need
--     auth.uid() = p_user_id OR is_admin() guard inside the function.
--   * get_score_breakdown(p_user_id) has the SAME p_user_id-vs-caller
--     mismatch and returns the FULL breakdown JSON — that IS a
--     disclosure. Belongs to its own migration.

ALTER FUNCTION public.refresh_score_breakdown(uuid)
  SECURITY DEFINER
  SET search_path = public, pg_temp;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '400',
  'refresh_score_breakdown_security_definer',
  ARRAY['-- 400: refresh_score_breakdown_security_definer']
)
ON CONFLICT (version) DO NOTHING;
