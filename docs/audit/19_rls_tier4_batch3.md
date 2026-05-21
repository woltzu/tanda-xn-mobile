# Tier 4 RLS — Batch 3: Circle Browse + Circle Members Peer Visibility ✅ EXECUTED

**Date:** 2026-05-20
**Scope:** 2 `USING(true)` SELECT policies on the core circle tables
**Result:** ✅ All 5 verification queries pass. Total `USING(true)` in `public`: **54 → 52**.

Third of the Tier 4 batches. Plan in `docs/audit/16_rls_tier4_diagnostic.md`; Batch 1 in `17_rls_tier4_batch1.md`; Batch 2 in `18_rls_tier4_batch2.md`.

**Smoke test on device:** **NOT YET PERFORMED.** User will test manually before tagging.

---

## Why this batch is different from Batch 2

Batches 1 and 2 used a single visibility pattern — `EXISTS` against a membership table. Batch 3 splits across **two different models** because the two tables have different product requirements:

| Table | Model | Why |
|---|---|---|
| `circles` | "browse all live circles" (status-filtered) | Discovery flow — users find circles they haven't joined yet. Membership-EXISTS would break this. |
| `circle_members` | Peer visibility — see fellow members of circles you're in | A member needs to see who else is in their circle, but not into rosters of unrelated circles. |

---

## What changed

| Table | Before | After |
|---|---|---|
| `circles` | `circles_select USING(true)` (SELECT, authenticated) | `circles_browse_select` — `status IS NULL OR status NOT IN ('dissolved','archived','closed')` |
| `circle_members` | `circle_members_select USING(true)` (SELECT, authenticated) | `circle_members_peer_select` — self-referential `EXISTS` on `circle_members` |

**Other policies on these tables (unchanged):**
- `circles_insert` — INSERT policy (with_check only)
- `circles_update` — `USING (auth.uid() = created_by)` — only the creator can update
- `circle_members_insert` — INSERT policy (with_check only)
- `circle_members_delete` — `USING (auth.uid() = user_id)` — only delete own membership

---

## Trade-off notes (deferred refinements)

> **`circles_browse_select` lets every authenticated user see every "live" circle in the system, regardless of community.** This is intentional for now — the "Discover circles" flow assumes a global directory. If the product evolves toward community-scoped discovery (only see circles in communities you've joined), tighten this to:
> ```sql
> USING (community_id IS NULL OR EXISTS (
>   SELECT 1 FROM community_memberships cm
>   WHERE cm.community_id = circles.community_id AND cm.user_id = auth.uid()
> ))
> ```
> **Tier-4-followup #3.**

> **`circle_members_peer_select` is self-referential** — the policy on `circle_members` queries `circle_members` again. Postgres handles this without infinite recursion because the predicate uses a constant (`auth.uid()`) rather than recursing through the row being evaluated. Verified by execution against the live DB. No EXPLAIN regression observed.

> **The status filter on `circles` uses string literals.** If `circles.status` is migrated to an enum later, this predicate may need updating. Current production data: column is `text` (USER-DEFINED in Supabase parlance) with no CHECK constraint listing the allowed values — string comparison is safe.

---

## Verification results

### (a) Old `USING(true)` policies on these 2 tables
```sql
SELECT tablename, policyname FROM pg_policies
WHERE schemaname='public' AND qual='true'
  AND tablename IN ('circles','circle_members');
```
**Result: 0 rows** ✅ (was 2)

### (b) New scoped policies exist
**Result: 2 of 2 found** ✅

| Table | New policy | Cmd |
|---|---|---|
| `circle_members` | `circle_members_peer_select` | SELECT |
| `circles` | `circles_browse_select` | SELECT |

### (c) Total `USING(true)` in `public` schema
**Result: 52** ✅ (was 54; dropped by 2 as expected)

### (d) RLS still enabled on both tables
- `circles` — `rowsecurity=true` ✅
- `circle_members` — `rowsecurity=true` ✅

### (e) Policies per table (post)

| Table | Total | USING(true) |
|---|---|---|
| `circles` | 3 (insert / update / browse_select) | 0 |
| `circle_members` | 3 (insert / delete / peer_select) | 0 |

---

## SQL that ran

```sql
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- TIER 4 RLS BATCH 3 — Circle browse + Circle members peer visibility
--
-- 2 policies touched. Different visibility models on the two tables:
--
--  - circles: authenticated users can browse ALL "live" circles (status
--    not dissolved/archived/closed). This preserves the "discover circles"
--    flow where a user can find circles they haven't joined yet.
--
--  - circle_members: members can only see fellow members of circles they
--    themselves are in. Self-referential predicate; safe (constant
--    auth.uid() means it converges without recursion).
-- ─────────────────────────────────────────────────────────────────────────

-- 1. circles: authenticated users can browse all "live" circles.
DROP POLICY IF EXISTS "circles_select" ON public.circles;
CREATE POLICY "circles_browse_select"
  ON public.circles FOR SELECT TO authenticated
  USING (status IS NULL OR status NOT IN ('dissolved', 'archived', 'closed'));

-- 2. circle_members: peer visibility — see fellow members of your circles.
DROP POLICY IF EXISTS "circle_members_select" ON public.circle_members;
CREATE POLICY "circle_members_peer_select"
  ON public.circle_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.circle_members peer
    WHERE peer.circle_id = circle_members.circle_id
      AND peer.user_id = auth.uid()
  ));

COMMIT;
```

---

## Rollback (if needed)

Pre-execution snapshot — paste either or both to restore the previous state:

```sql
CREATE POLICY "circles_select" ON public.circles
  FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY "circle_members_select" ON public.circle_members
  FOR SELECT AS PERMISSIVE TO public USING (true);
```

---

## Pending: manual smoke test (user)

Recommended screens to spot-check before tagging:

| Screen | What to check |
|---|---|
| Circles tab / Circle browser | Should still see ALL live circles; closed/dissolved/archived hidden |
| Circle detail (any circle you're in) | Members list loads with fellow members |
| Circle detail (any circle you're NOT in, accessed by deep link) | Members list should be empty/forbidden — but circle metadata visible |
| Create circle flow | New circle created; you appear in members; nothing breaks |
| Leave circle | After leaving, the circle is still browsable but the members list is now empty for you |

**Edge case to verify:** A user with no circle memberships at all — `circle_members_peer_select` returns 0 rows (correct), but `circles_browse_select` still shows them all live circles for the "Discover" flow.

If anything breaks: rollback SQL above. Paste either statement to restore.

---

## Cumulative Tier 4 progress

| Batch | Tables | Policies removed | Total `USING(true)` after |
|---|---|---|---|
| Diagnostic (start) | — | — | **70** |
| Batch 1 (payment/dispute) | 5 | 5 | 65 |
| Batch 2 (community) | 8 | 11 | 54 |
| **Batch 3 (circles + circle_members)** | **2** | **2** | **52** |
| Batch 4 (planned: post_likes, gathering_rsvps via JOIN) | TBD | TBD | TBD |

**26% through the original 70 in three batches** (18 of 70 cleared so far).

---

## Status

- ✅ SQL executed and verified (2/2 ops landed)
- ⏳ Manual smoke test pending (user)
- ⏳ Tag `stable-2026-05-20-rls-tier4-batch3-shipped` pending (after smoke test)

**Next batch (Batch 4):** Tables with join-only visibility, e.g. `post_likes` (visible iff the underlying post is visible) and `gathering_rsvps` (visible iff the gathering is visible). Requires JOIN through the parent table's RLS — more analysis ahead of execution.

---

_Generated 2026-05-20. SQL executed via Supabase Management API. 2 policies dropped, 2 new scoped policies created._
