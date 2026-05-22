# Deferred — Batch 10: `profiles.profiles_select` (Tier 4 RLS)

**Status:** PARKED 2026-05-21. Not scheduled. Single-policy fix that needs design before execution.

## The policy in question
- Table: `public.profiles`
- Policy: `profiles_select` (SELECT, public, `USING (true)`)
- 1 of 13 remaining Group ? `USING(true)` policies after Batch 9.

## Why it can't be a one-line rewrite
- Other users' **public-ish** fields (name, avatar, display tier) are normally visible across the app — circle members, marketplace, post authorship, etc.
- Other users' **sensitive** fields (phone, email, KYC status, address, payment methods linkage) must NOT be visible.
- PostgreSQL RLS is row-level, not column-level — `auth.uid() = id` would hide everything from other users; a permissive policy keeps everything visible.

## Required design before execution
1. Decide the **public field set** explicitly (e.g., `name`, `avatar_url`, `score_tier`, `is_verified`).
2. Either:
   - **(a)** Create a `public_profile(target_user_id uuid)` RPC that returns only the public fields, plus a strict RLS policy `auth.uid() = id` so direct row access is owner-only; OR
   - **(b)** Split `profiles` into `profiles_public` (broadly readable) and `profiles_private` (owner-only) — bigger change.
3. Audit every `supabase.from('profiles').select(...)` call site in `tanda-xn-mobile` and migrate to the RPC where the caller is fetching another user's row.

## When to revisit
- Before any cross-user UI feature that surfaces sensitive profile data ships.
- After privacy review (could be regulatory — KYC fields).

Last touched: 2026-05-21. See `docs/audit/16_rls_tier4_diagnostic.md` for the diagnostic context and `docs/audit/22_rls_tier4_batch9.md` for the most recent batch summary.
