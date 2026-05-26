# 27 — Join-Gate Revert Decision

**Status:** Decided. Reverted via migration 071.
**Date:** 2026-05-26.
**Supersedes the design from:** migration 069 (`circle_join_connect_gate`), now removed.
**Replaces with design tracked in:** Stage 4 (JIT Connect onboarding at payout). Consolidation prerequisite: `docs/audit/28_consolidate_join_paths.md`.

---

## TL;DR

Migration 069 added a Connect-onboarding gate inside the `complete_circle_join` RPC: if the joiner had no `stripe_connected_accounts` row with `onboarding_status = 'complete' AND payouts_enabled = true`, the RPC returned `connect_not_ready` and refused the join. The migration was authored, applied to production, and registered in `schema_migrations` correctly.

After first device test, **the gate was reverted by deliberate design choice, not by bug fix**. Onboarding moves to the payout path (Stage 4) for just-in-time enforcement, reducing new-member friction. Migration 071 restores `complete_circle_join` to its pre-069 body.

---

## Verification of the gate state in production

To make this decision on primary evidence (not the cached `docs/audit/11_live_schema_dump.sql`, which was found to be stale), three read-only queries ran against the live DB on 2026-05-26 via `docs/audit/27_migration_069_070_drift_check.sql`:

| Query | Result | Interpretation |
|---|---|---|
| `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version IN ('067','068','069','070','071')` | Returned rows for 067 (`pending_joins`), 068 (`create_pending_join_rpc`), 069 (`circle_join_connect_gate`), 070 (`stripe_connected_accounts_event_ordering`) | 069 **registered**. 070 **registered**. |
| `pg_get_functiondef('public.complete_circle_join(uuid)'::regprocedure)` | Returned function body containing the `Stage 1 gate` comment block, `IF NOT EXISTS (SELECT 1 FROM public.stripe_connected_accounts WHERE member_id = v_user_id AND onboarding_status = 'complete' AND payouts_enabled = true) THEN RETURN 'connect_not_ready'` | Gate **live** in production. |
| `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='stripe_connected_accounts' AND column_name='last_account_event_at'` | One row returned | 070's column **live** in production. |

**Conclusion: migration tracking is honest on this evidence.** `schema_migrations` registration, the actual function body, and the actual table schema all agree. The earlier "applied + no drift" report was correct. The dump file was stale (dated 2026-05-18; the queries ran 2026-05-26) and should not be relied on as a primary source.

---

## Reason for reversal

The gate would have fired correctly. The problem isn't with the gate; it's with the *design choice to gate at join time at all*.

In a tontine, a member's payout doesn't happen at join — it happens on their turn in the rotation, often many cycles away. Forcing Connect onboarding at join time:
- Penalises conversion: a member whose payout is ~6 months away is asked to do paperwork for something they don't immediately need.
- Front-loads compliance friction: the user is least committed at first tap and most committed by the time their turn approaches.
- Creates an awkward UX wall ("Payout setup required before joining") that demos badly.

Just-in-time enforcement at the payout path:
- Same EXISTS check (`onboarding_status = 'complete' AND payouts_enabled = true`), same correctness guarantee.
- Triggered only when relevant: at payout issuance, the member's turn has arrived and the friction is justified by the imminent benefit.
- Cleanly handles a "not ready yet" state: the payout is held, the member is notified, the rotation pauses for them — *not* the entire join is blocked.

---

## Side-discovery during the investigation (NOT closed by this revert)

Tracing the failure mode of the gate revealed that **the gate only ever protected 2 of 9 join paths**. The other 7 use a client-side `INSERT INTO circle_members` from `CirclesContext.joinCircle()` and bypass the RPC entirely.

| Paths through `complete_circle_join` (gated) | Paths through `joinCircle()` (ungated) |
|---|---|
| Magic-link email → `JoinConfirmScreen` | `CircleDetailScreen` "Join Circle" button |
| QuickJoin URL/QR → `QuickJoinScreen` | `CommunityHubScreen` circle card |
| | `DreamFeedScreen` circle card |
| | `PostDetailScreen` circle link |
| | `JoinCircleByCodeScreen` → `JoinCircleConfirmScreen` |
| | `QRScannerScreen` → `JoinCircleConfirmScreen` |
| | `CircleInviteScreen` invite-link landing |

**Implication:** even with the gate live, the most common entry points (in-app discovery, invite codes, QR scan, circle detail) wrote directly into `circle_members` with no server-side enforcement. The "gate" was misleadingly named — it gated one path while leaving seven open.

**Action taken:** flagged as a required Stage-4 prerequisite. The full consolidation task — collapse `joinCircle()` into a single SECURITY DEFINER RPC, lock down `circle_members` INSERT to `service_role` via RLS — is specified in `docs/audit/28_consolidate_join_paths.md`. The JIT Connect check at payout is the right chokepoint anyway, but it presumes join is itself well-defined; that presumption requires the consolidation.

---

## What changed in this revert (manifest)

| Change | File | Action |
|---|---|---|
| Migration source removed | `supabase/migrations/069_circle_join_connect_gate.sql` | Deleted from disk (was untracked in git; no history rewrite needed) |
| Counter-migration added | `supabase/migrations/071_revert_join_gate.sql` | New file. Restores pre-069 function body. Needs to be applied to production for the revert to take effect. |
| Client comments updated | `screens/QuickJoinScreen.tsx:448-460`, `screens/JoinConfirmScreen.tsx:162-176` | Comments referencing the `connect_not_ready` gate now document the design choice and link here + to doc 28. |
| Diagnostic SQL preserved | `docs/audit/27_migration_069_070_drift_check.sql` | Was untracked. Now committed alongside this decision doc for future re-verification of drift questions. |
| Decision doc | `docs/audit/27_join_gate_revert_decision.md` | This file. |
| Follow-up task spec | `docs/audit/28_consolidate_join_paths.md` | Separate, written earlier — defines the Stage-4 prerequisite. |

---

## What was deliberately NOT changed

| Thing | Why kept |
|---|---|
| `supabase/migrations/070_stripe_connected_accounts_event_ordering.sql` | Adds `last_account_event_at` for stripe-webhook idempotency. Still needed; works regardless of when onboarding happens. |
| `supabase/functions/create-connect-account/` | Still the right way to start Connect onboarding — just invoked from the payout path (Stage 4) instead of the join path. |
| `supabase/functions/stripe-webhook/index.ts` (account.updated branch) | Still tracks Connect account status changes; still needs to mark accounts ready/restricted for the JIT check. |
| `public.stripe_connected_accounts` table + its RLS | Required for any Connect path. |

---

## Lessons learned (process)

1. **Don't use `docs/audit/11_live_schema_dump.sql` as a primary source for "what's in production right now."** It's a snapshot, dated, and can be a week or more stale. For any time-sensitive question, run live `pg_get_functiondef` / `information_schema.columns` queries via `python sql_run.py < query.sql`.
2. **When verifying that a migration applied without drift, check both `schema_migrations` registration AND the affected DDL in the same query session, fingerprinted (MD5'd) for comparison.** A registration-only check, or a body-only check, can pass while drift is silently present. The query template in `docs/audit/27_migration_069_070_drift_check.sql` is the correct shape.
3. **"X was applied with no drift" is a claim that requires both axes verified.** If only one axis was checked, the right phrasing is "registered" or "DDL matches expected" — not "no drift."
4. **A gate is only useful if all paths flow through it.** Before adding any future invariant to a multi-path workflow, enumerate the paths first. The 9-path inventory in `28_consolidate_join_paths.md` is the standard for any future join-time check.

---

## Re-litigation policy

This decision is final for Stage 1–3. The JIT-at-payout design is the chosen path. Re-opening the join-time-gate idea should only happen if:
- Stage 4's JIT check proves unreliable (e.g., race conditions at payout time that can't be fixed at the payout layer), OR
- A regulatory requirement materialises that explicitly demands KYC/Connect at join time, not at payout time.

In either case, the right action is *not* to re-introduce migration 069, but to design the gate with awareness of all 9 join paths (now 1 path after the consolidation work in doc 28).
