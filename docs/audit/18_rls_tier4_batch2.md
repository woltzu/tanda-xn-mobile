# Tier 4 RLS — Batch 2: Community Membership Lockdown ✅ EXECUTED

**Date:** 2026-05-20
**Scope:** 11 ops on 8 community-related tables — 8 SELECT rewrites + 3 `_service_all` no-op cleanups
**Result:** ✅ All 5 verification queries pass. Total `USING(true)` in `public`: **65 → 54**.

Second of the Tier 4 batches. Plan lives in `docs/audit/16_rls_tier4_diagnostic.md`; Batch 1 in `docs/audit/17_rls_tier4_batch1.md`.

**Smoke test on device:** **NOT YET PERFORMED.** User will test manually before tagging.

---

## What changed

| Table | Before | After |
|---|---|---|
| `community_members` | `Anyone can view community members USING(true)` (SELECT, authenticated) | `community_members_member_select` — scoped via `community_memberships` EXISTS join |
| `community_circles` | `Anyone can view community circles USING(true)` | `community_circles_member_select` — same pattern |
| `community_feed_items` | `feed_member_select USING(true)` + `feed_service_all USING(true)` | `community_feed_items_member_select` (scoped) + service_all DROPPED (no-op) |
| `community_gatherings` | `gatherings_member_select USING(true)` + `gatherings_service_all USING(true)` | `community_gatherings_member_select` (scoped) + service_all DROPPED |
| `community_arrivals` | `arrivals_member_select USING(true)` + `arrivals_service_all USING(true)` | `community_arrivals_member_select` (scoped) + service_all DROPPED |
| `community_health_scores` | `health_scores_select USING(true)` (public role) | `community_health_scores_member_select` — scoped |
| `community_leaderboard_snapshots` | `leaderboard_select USING(true)` (public role) | `community_leaderboard_member_select` — scoped |
| `elder_council_votes` | `council_votes_select USING(true)` (public role) | `elder_council_votes_member_select` — scoped |

**Pattern for all 8 new policies:**
```sql
USING (EXISTS (
  SELECT 1 FROM public.community_memberships cm
  WHERE cm.community_id = <table>.community_id
    AND cm.user_id = auth.uid()
))
```

Visibility model: **any authenticated user with a row in `community_memberships` for the target row's `community_id` can SELECT.** Other CRUD policies (INSERT/UPDATE/DELETE) on these tables were unchanged — they had appropriate `auth.uid()=user_id`-style scoping already.

---

## Trade-off notes (deferred refinements)

> **`elder_council_votes_member_select` allows any community member to view council votes — including non-elders.** Acceptable since council votes are community-affecting decisions, but you may want to restrict to elders-only later. **Tier-4-followup #1.**
>
> **`community_leaderboard_member_select` shows full leaderboard rows to every community member.** Pseudo-PII (rankings + scores) exposed within the community. Tighten to top-N or anonymise lower ranks later if PII concerns surface. **Tier-4-followup #2.**

---

## Verification results

### (a) Old `USING(true)` policies on these 8 tables
```sql
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND qual='true' AND tablename IN
  ('community_members','community_circles','community_feed_items',
   'community_gatherings','community_arrivals','community_health_scores',
   'community_leaderboard_snapshots','elder_council_votes');
```
**Result: 0 rows** ✅ (was 11)

### (b) New scoped policies exist
**Result: 8 of 8 found** ✅

| Table | New policy | Cmd |
|---|---|---|
| `community_arrivals` | `community_arrivals_member_select` | SELECT |
| `community_circles` | `community_circles_member_select` | SELECT |
| `community_feed_items` | `community_feed_items_member_select` | SELECT |
| `community_gatherings` | `community_gatherings_member_select` | SELECT |
| `community_health_scores` | `community_health_scores_member_select` | SELECT |
| `community_leaderboard_snapshots` | `community_leaderboard_member_select` | SELECT |
| `community_members` | `community_members_member_select` | SELECT |
| `elder_council_votes` | `elder_council_votes_member_select` | SELECT |

### (c) Total `USING(true)` in `public` schema
**Result: 54** ✅ (was 65; dropped by 11 as expected)

### (d) RLS still enabled on all 8 tables
All `rowsecurity = true` ✅

### (e) Policies per table (post)
| Table | Total | USING(true) |
|---|---|---|
| `community_arrivals` | 2 | 0 |
| `community_circles` | 1 | 0 |
| `community_feed_items` | 1 | 0 |
| `community_gatherings` | 3 | 0 |
| `community_health_scores` | 1 | 0 |
| `community_leaderboard_snapshots` | 1 | 0 |
| `community_members` | 3 | 0 |
| `elder_council_votes` | 1 | 0 |

---

## SQL that ran

```sql
BEGIN;

-- 1. community_members — members can see fellow members
DROP POLICY IF EXISTS "Anyone can view community members" ON public.community_members;
CREATE POLICY "community_members_member_select"
  ON public.community_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
  ));

-- 2. community_circles
DROP POLICY IF EXISTS "Anyone can view community circles" ON public.community_circles;
CREATE POLICY "community_circles_member_select"
  ON public.community_circles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_circles.community_id
      AND cm.user_id = auth.uid()
  ));

-- 3. community_feed_items
DROP POLICY IF EXISTS "feed_member_select" ON public.community_feed_items;
DROP POLICY IF EXISTS "feed_service_all"   ON public.community_feed_items;
CREATE POLICY "community_feed_items_member_select"
  ON public.community_feed_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_feed_items.community_id
      AND cm.user_id = auth.uid()
  ));

-- 4. community_gatherings
DROP POLICY IF EXISTS "gatherings_member_select" ON public.community_gatherings;
DROP POLICY IF EXISTS "gatherings_service_all"   ON public.community_gatherings;
CREATE POLICY "community_gatherings_member_select"
  ON public.community_gatherings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_gatherings.community_id
      AND cm.user_id = auth.uid()
  ));

-- 5. community_arrivals
DROP POLICY IF EXISTS "arrivals_member_select" ON public.community_arrivals;
DROP POLICY IF EXISTS "arrivals_service_all"   ON public.community_arrivals;
CREATE POLICY "community_arrivals_member_select"
  ON public.community_arrivals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_arrivals.community_id
      AND cm.user_id = auth.uid()
  ));

-- 6. community_health_scores
DROP POLICY IF EXISTS "health_scores_select" ON public.community_health_scores;
CREATE POLICY "community_health_scores_member_select"
  ON public.community_health_scores FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_health_scores.community_id
      AND cm.user_id = auth.uid()
  ));

-- 7. community_leaderboard_snapshots
DROP POLICY IF EXISTS "leaderboard_select" ON public.community_leaderboard_snapshots;
CREATE POLICY "community_leaderboard_member_select"
  ON public.community_leaderboard_snapshots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = community_leaderboard_snapshots.community_id
      AND cm.user_id = auth.uid()
  ));

-- 8. elder_council_votes
DROP POLICY IF EXISTS "council_votes_select" ON public.elder_council_votes;
CREATE POLICY "elder_council_votes_member_select"
  ON public.elder_council_votes FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.community_id = elder_council_votes.community_id
      AND cm.user_id = auth.uid()
  ));

COMMIT;
```

---

## Rollback (if needed)

Pre-execution snapshot — paste any/all of these lines to restore the previous state. **Note:** the `_service_all` policies were no-ops anyway (service_role bypasses RLS); you usually don't need to recreate them. But here they are for completeness.

```sql
CREATE POLICY "arrivals_member_select" ON public.community_arrivals FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "arrivals_service_all" ON public.community_arrivals FOR ALL AS PERMISSIVE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can view community circles" ON public.community_circles FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "feed_member_select" ON public.community_feed_items FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "feed_service_all" ON public.community_feed_items FOR ALL AS PERMISSIVE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "gatherings_member_select" ON public.community_gatherings FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "gatherings_service_all" ON public.community_gatherings FOR ALL AS PERMISSIVE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "health_scores_select" ON public.community_health_scores FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "leaderboard_select" ON public.community_leaderboard_snapshots FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "Anyone can view community members" ON public.community_members FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY "council_votes_select" ON public.elder_council_votes FOR SELECT AS PERMISSIVE TO public USING (true);
```

---

## Pending: manual smoke test (user)

Recommended screens to spot-check before tagging:

| Screen | What to check |
|---|---|
| Community Hub / Community Browser | Should still see your own communities; no crashes |
| Community Feed | Empty state expected (0 rows); no crash |
| Community Members list | Members of your community visible; non-members invisible |
| Community Gatherings | No crash; empty state |
| Community Leaderboard | No crash; empty state |
| Elder Council voting view (if your role reaches it) | No crash; empty state |

If anything breaks: see the rollback SQL above. Paste any subset of those `CREATE POLICY` lines to restore.

---

## Cumulative Tier 4 progress

| Batch | Tables | Policies removed | Total `USING(true)` after |
|---|---|---|---|
| Diagnostic (start) | — | — | **70** |
| Batch 1 (payment/dispute) | 5 | 5 (+ 0 no-op cleanup) | 65 |
| **Batch 2 (community)** | **8** | **8 SELECT rewrites + 3 no-op cleanups = 11** | **54** |
| Batch 3 (planned: circle membership) | TBD | TBD | TBD |
| Batch 4 (planned: post_likes, gathering_rsvps via JOIN) | TBD | TBD | TBD |

23% of the way through the original 70 in two batches.

---

## Status

- ✅ SQL executed and verified (11/11 ops landed)
- ⏳ Manual smoke test pending (user)
- ⏳ Tag `stable-2026-05-20-rls-tier4-batch2-shipped` pending (after smoke test)

**Next batch (Batch 3):** circle-membership tables. Requires more analysis because the "browse circles" flow needs to see circles the user isn't in yet — can't use the same EXISTS-on-membership pattern unmodified.

---

_Generated 2026-05-20. SQL executed via Supabase Management API. 11 policies dropped, 8 new scoped policies created._
