# Tier 4 RLS — Batch 5: Group A Leftovers ✅ EXECUTED

**Date:** 2026-05-21
**Scope:** 5 `USING(true)` policies dropped + 4 new scoped SELECT policies created across 5 tables.
**Result:** ✅ All verification queries pass. Total `USING(true)` in `public`: **29 → 24** (−5).

Fifth of the Tier 4 batches. Plan in `docs/audit/16_rls_tier4_diagnostic.md`; previous batches in `17_…` through `20_…`.

**Smoke test on device:** **NOT YET PERFORMED.** User will test manually before tagging.

---

## Why these five came last

The diagnostic clustered them in Group A ("scope to owner") but each had a subtlety that made a naive `auth.uid() = user_id` rewrite either restrictive-and-wrong or actively broken. Pre-execution per-table analysis (see "Pre-flight findings" below) drove the actual scoping decisions.

| Table | Diagnostic hint | What we did instead | Why |
|---|---|---|---|
| `circle_invitations` | `EXISTS on circle_members` | Inviter ∨ invitee ∨ circle member | Membership-only hides invitations from the very users who need to accept them |
| `community_post_likes` | `auth.uid() = user_id` | Members of post's community (2-hop JOIN) | Owner-only breaks "X likes" / "who liked this" UI |
| `gathering_rsvps` | `auth.uid() = user_id` | Members of gathering's community (2-hop JOIN) | Same shape as likes — breaks "who's coming" |
| `invited_members` | `EXISTS on circle_members` | Inviter ∨ circle member | No `invited_user_id` column — can't scope by invitee; tightening to inviter + members is the right privacy posture |
| `xn_scores` | `auth.uid() = user_id` | **Drop, no replacement** | Owner-scope policy `xnscores_own_full` already exists; "others_limited" was misnamed (RLS can't do per-column filtering) |

---

## What changed

### 1. `circle_invitations`
- **Dropped:** `Anyone can view invitations` (SELECT, authenticated, `USING(true)`)
- **New:** `circle_invitations_scoped_select` — `USING (auth.uid() = invited_by OR auth.uid() = invited_user_id OR public.is_circle_member(circle_id))`
- Reuses the `is_circle_member` SECURITY DEFINER helper from the Batch 3 recursion fix.

### 2. `community_post_likes`
- **Dropped:** `likes_member_select` (SELECT, authenticated, `USING(true)`)
- **New:** `community_post_likes_community_select` — `EXISTS` join through `community_posts → community_memberships`
- Allows any community member to see all likes on posts in their community.

### 3. `gathering_rsvps`
- **Dropped:** `rsvps_member_select` (SELECT, authenticated, `USING(true)`)
- **New:** `gathering_rsvps_community_select` — `EXISTS` join through `community_gatherings → community_memberships`
- Same shape as likes — community-member visibility.

### 4. `invited_members`
- **Dropped:** `invited_members_select` (SELECT, public, `USING(true)`)
- **New:** `invited_members_scoped_select` — `USING (auth.uid() = invited_by OR public.is_circle_member(circle_id))`
- Helper reuse.

### 5. `xn_scores`
- **Dropped:** `xnscores_others_limited` (SELECT, public, `USING(true)`)
- **No replacement** — `xnscores_own_full` (`user_id = auth.uid()`) already covers owner reads.
- Cross-user score visibility (leaderboards, public profile cards) must now go through an RPC/view that filters columns server-side.

---

## Trade-off notes (deferred refinements)

> **`circle_invitations` email/phone-only invites** (where `invited_user_id IS NULL`) are now invisible to the recipient until claimed. A claim flow matching `auth.users.email` to `circle_invitations.email` is required before email/phone invitations become a real product feature. Currently 0 rows in prod. **Tier-4-followup #5.**

> **`community_post_likes` and `gathering_rsvps` use two-hop JOIN EXISTS.** Per-row evaluation joins through the parent table on every read. At scale, promote to SECURITY DEFINER helpers `is_post_visible_to(post_id)` and `is_gathering_visible_to(gathering_id)` to fold the joins into a function call (same pattern as `is_circle_member`). Inline is fine for now — both tables are empty in prod. **Tier-4-followup #6.**

> **`invited_members` privacy improvement (real change at 7 rows).** Non-members can no longer see who's been invited to a circle. If any UI surfaces a "N invites pending" indicator on a circle profile to non-members, that needs to switch to a server-side count via RPC. **Tier-4-followup #7.**

> **`xn_scores` leaderboard breakage.** Any client query that fetches another user's `xn_scores` row directly returns 0 rows. The fix is a `get_public_xn_score(target_user_id uuid)` RPC that exposes only `score_tier`, `total_score`, and similar non-sensitive fields. No leaderboard UI is wired in production today. **Tier-4-followup #8.**

> **Helper consolidation.** `circle_invitations_scoped_select` and `invited_members_scoped_select` both call `public.is_circle_member(uuid)` — the SECURITY DEFINER function we created during the Batch 3 recursion fix. Three policies now share one helper.

---

## Verification results

### (a) `USING(true)` policies remaining on Batch 5 tables
**Result: 0** ✅

### (b) New scoped policies present
**Result: 4 of 4** ✅

| Table | New policy | Pattern |
|---|---|---|
| `circle_invitations` | `circle_invitations_scoped_select` | Inviter OR invitee OR is_circle_member |
| `community_post_likes` | `community_post_likes_community_select` | EXISTS through community_posts |
| `gathering_rsvps` | `gathering_rsvps_community_select` | EXISTS through community_gatherings |
| `invited_members` | `invited_members_scoped_select` | Inviter OR is_circle_member |

### (c) Total `USING(true)` in `public` schema
**Result: 24** ✅ (was 29; dropped by 5 as expected)

### (d) RLS still enabled on all 5 tables
**5/5 rowsecurity = true** ✅

### (e) Per-table policy counts post

| Table | Total policies | USING(true) | SELECTs |
|---|---|---|---|
| `circle_invitations` | 2 | 0 | 1 |
| `community_post_likes` | 4 | 0 | 1 |
| `gathering_rsvps` | 5 | 0 | 1 |
| `invited_members` | 2 | 0 | 1 |
| `xn_scores` | 1 | 0 | 1 |

### (f) `xn_scores` final state
Only `xnscores_own_full` remains: `cmd=SELECT, qual=(user_id = auth.uid())`. Owner sees own. ✅

---

## SQL that ran

```sql
BEGIN;

-- 1. circle_invitations: inviter, named invitee, or circle member.
DROP POLICY IF EXISTS "Anyone can view invitations" ON public.circle_invitations;
CREATE POLICY "circle_invitations_scoped_select"
  ON public.circle_invitations FOR SELECT TO authenticated
  USING (
    auth.uid() = invited_by
    OR auth.uid() = invited_user_id
    OR public.is_circle_member(circle_id)
  );

-- 2. community_post_likes: visible to members of the post's community.
DROP POLICY IF EXISTS "likes_member_select" ON public.community_post_likes;
CREATE POLICY "community_post_likes_community_select"
  ON public.community_post_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_posts cp
      JOIN public.community_memberships cm
        ON cm.community_id = cp.community_id
      WHERE cp.id = community_post_likes.post_id
        AND cm.user_id = auth.uid()
    )
  );

-- 3. gathering_rsvps: visible to members of the gathering's community.
DROP POLICY IF EXISTS "rsvps_member_select" ON public.gathering_rsvps;
CREATE POLICY "gathering_rsvps_community_select"
  ON public.gathering_rsvps FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_gatherings g
      JOIN public.community_memberships cm
        ON cm.community_id = g.community_id
      WHERE g.id = gathering_rsvps.gathering_id
        AND cm.user_id = auth.uid()
    )
  );

-- 4. invited_members: inviter or circle member.
DROP POLICY IF EXISTS "invited_members_select" ON public.invited_members;
CREATE POLICY "invited_members_scoped_select"
  ON public.invited_members FOR SELECT TO authenticated
  USING (
    auth.uid() = invited_by
    OR public.is_circle_member(circle_id)
  );

-- 5. xn_scores: drop misnamed broad policy. xnscores_own_full remains.
DROP POLICY IF EXISTS "xnscores_others_limited" ON public.xn_scores;

COMMIT;
```

---

## Rollback (if needed)

Pre-execution snapshot — paste any subset to restore:

```sql
CREATE POLICY 'Anyone can view invitations' ON public.circle_invitations
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY 'likes_member_select' ON public.community_post_likes
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY 'rsvps_member_select' ON public.gathering_rsvps
  FOR SELECT AS PERMISSIVE TO authenticated USING (true);
CREATE POLICY 'invited_members_select' ON public.invited_members
  FOR SELECT AS PERMISSIVE TO public USING (true);
CREATE POLICY 'xnscores_others_limited' ON public.xn_scores
  FOR SELECT AS PERMISSIVE TO public USING (true);
```

---

## Pending: manual smoke test (user)

| Screen | What to check |
|---|---|
| Circles → Invitations inbox | Invitations for your user_id still visible; no crash |
| Circle details → "X invites pending" badge (if any) | Visible to circle members; not visible to non-members |
| Community Feed → posts with likes | Like counts/avatars still render for community members; empty for non-members |
| Community Gathering → attendees list | RSVP list still renders for community members |
| Profile → XN Score (own) | Still loads via `xnscores_own_full` |
| Anywhere that shows another user's score | Should be empty (intentional — needs RPC migration) |

If anything breaks: rollback SQL above.

---

## Cumulative Tier 4 progress

| Batch | Tables | Policies removed | Total `USING(true)` after |
|---|---|---|---|
| Diagnostic (start) | — | — | **70** |
| Batch 1 (payment/dispute) | 5 | 5 | 65 |
| Batch 2 (community membership) | 8 | 11 | 54 |
| Batch 3 (circles + circle_members) | 2 | 2 | 52 |
| Batch 4 (internal/system → service_role) | 24 | 23 | 29 |
| **Batch 5 (Group A leftovers)** | **5** | **5** | **24** |
| Batches 6+ (planned: Group C confirmation + Group ? triage) | 24 | TBD | TBD |

**66% of the original 70 cleared in five batches** (46 of 70). Remaining 24 = 7 Group C (kept by design, comments applied) + 17 Group ? (manual triage needed).

---

## Status

- ✅ SQL executed and verified (5 drops + 4 new policies, count 29 → 24)
- ⏳ Manual smoke test pending (user)
- ⏳ Tag pending (per user instruction, no tag for this batch alone — likely batched with a cumulative Tier 4 tag later)

---

_Generated 2026-05-21. SQL executed via Supabase Management API. 5 policies dropped, 4 new scoped policies created, 1 misnamed broad policy retired without replacement._
