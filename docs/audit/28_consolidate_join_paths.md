# 28 — Consolidate Circle Join Paths

**Status:** Required before Stage 4 (payout).
**Owner:** TBD.
**Blocker of:** Stage 4 — Stripe Connect just-in-time onboarding at payout, and any future join-time invariant (KYC, jurisdiction, capacity, score gate, etc.).
**Surfaced by:** `27_join_gate_revert_decision.md` (the join-gate revert investigation found that 7 of 9 user-facing join paths bypassed the gated RPC entirely).

---

## Problem

The app has **two parallel implementations of "user joins a circle,"** and they can drift independently. One is a SECURITY DEFINER RPC with idempotency, email verification, atomic wallet credit, and (until reverted) the Stripe Connect gate. The other is a plain client-side `INSERT` into `circle_members` from React context with no verification of anything beyond auth state.

The fork is invisible at the call sites — both paths are labeled "join" in code and UI, and the gated and ungated screens have nearly-identical names (`JoinConfirmScreen` vs `JoinCircleConfirmScreen`). Any join-time invariant added in the future must be added in both places, or one of them silently passes. A money app cannot tolerate this for its core membership operation.

---

## Current state — all 9 join paths

| # | Entry point (UI) | Screen reached | Method called | Server-side enforcement | Wallet-credit (demo_quickjoin) |
|---|---|---|---|---|---|
| 1 | `CircleDetailScreen` "Join Circle" button | `JoinCircleConfirmScreen` | `joinCircle()` → direct INSERT into `circle_members` | ❌ none | ❌ none |
| 2 | `CommunityHubScreen` circle card → "Join" | `JoinCircleConfirmScreen` | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 3 | `DreamFeedScreen` circle card → "Join" | `JoinCircleConfirmScreen` | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 4 | `PostDetailScreen` circle link | `JoinCircleConfirmScreen` | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 5 | `JoinCircleByCodeScreen` invite-code entry | `JoinCircleConfirmScreen` | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 6 | `QRScannerScreen` scan a circle QR | `JoinCircleConfirmScreen` | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 7 | `CircleInviteScreen` invite-link landing | (directly calls) | `joinCircle()` direct INSERT | ❌ none | ❌ none |
| 8 | Magic-link email click `/join-confirm?pending=<id>` | `JoinConfirmScreen` | `complete_circle_join` RPC | ✅ full | ✅ yes |
| 9 | QuickJoin URL/QR (server-prepared `pending_joins`) | `QuickJoinScreen` | `complete_circle_join` RPC | ✅ full | ✅ yes |

**7 of 9 paths use the ungated `joinCircle()` from `context/CirclesContext.tsx:587-640`.**
**2 paths use the gated `complete_circle_join(p_pending_id uuid)` RPC** — the ones that require a server-prepared `pending_joins` row.

---

## Required end state

**One join chokepoint.** A single SECURITY DEFINER RPC that every UI path goes through. The client must not be able to INSERT into `circle_members` directly.

### Concrete shape

1. **New unified RPC** — `complete_circle_join_v2(p_circle_id uuid, p_invite_token text NULL)` (working name; final name TBD).
   - Accepts a circle ID directly (current `complete_circle_join` only accepts a `pending_joins` ID).
   - Optionally accepts an invite/QR token for the paths that have one, for audit and rate-limiting purposes.
   - Performs the same writes as today's `complete_circle_join`: dedupe member check, INSERT `circle_members`, INSERT `user_wallets` if missing, INSERT `circle_contributions` (or whatever the post-Stage-2 model is — see note below), system messages.
   - Returns the same JSON shape (`{ success, error?, message?, circle_name?, amount? }`) so error UX can be reused.

2. **Migration of existing `pending_joins`-based RPC.**
   - Decide whether to keep `complete_circle_join(p_pending_id uuid)` as a thin wrapper around the new RPC (for backward compatibility with the magic-link / QuickJoin flows that still create pending rows), or migrate those flows to call the new RPC directly with the resolved circle_id.
   - Recommendation: keep `pending_joins` as the audit + email-verification primitive but route both flows through the same final-step RPC.

3. **RLS lockdown on `circle_members`.**
   - Currently allows authenticated-user INSERT (which is what makes the direct-INSERT bypass work).
   - Tighten to: only `service_role` can INSERT. Authenticated users can only SELECT rows for circles they're a member of (already in place).
   - This makes the new RPC the only writer, structurally — not just by convention.

4. **Remove `joinCircle()` from `CirclesContext.tsx`.**
   - Replace all 7 callers (paths #1-#7 above) with a hook that calls the new RPC.
   - Same external contract on the screen side (one async function, returns success / error).

5. **Single error contract.**
   - Same JSON shape on every failure mode (`'connect_not_ready'`, `'email_mismatch'`, `'pending_not_found'`, `'already_member'`, `'circle_full'`, `'circle_closed'`, future `'kyc_not_complete'`, etc.).
   - Screens render `message` field for human display, log `error` token for analytics.

---

## Acceptance criteria

1. `grep -rn "from('circle_members').insert"` (and `.insert(...)\|from("circle_members"` etc.) in `screens/`, `hooks/`, `services/`, `context/` returns **zero matches** outside the new RPC's server source.
2. RLS on `public.circle_members` has no policy that permits INSERT by `authenticated` role.
3. All 9 entry points listed above (or whatever subset remains after any UX consolidation) call the same single RPC, verified by code grep + a runtime smoke test joining via each path.
4. The RPC supports the existing system-message side-effects (`'<name> joined the circle'`, `'<name> contributed $X for Cycle 1'`) for paths where they apply.
5. Demo auto-credit (`payment_method = 'demo_quickjoin'`) is either consistent across all paths or removed entirely — no path-dependent wallet credit (see open question 1).
6. Stage 4 work can add the JIT Connect check (`onboarding_status='complete' AND payouts_enabled=true`) at one location in the payout codepath and trust it covers every member that exists.

---

## Implementation notes

- The new RPC should be `SECURITY DEFINER` with `SET search_path TO 'public'`, matching the pattern from migrations 067/068/069.
- Use `auth.uid()` for the joiner, not a parameter — never trust the client to say who is joining.
- Wrap the writes in an explicit `BEGIN ... EXCEPTION WHEN OTHERS` so partial inserts don't leave orphan rows (matches the existing `complete_circle_join` pattern).
- Keep the "fire-and-forget" auto-post to the community feed (currently in `joinCircle()` lines 629-639) out of the SQL function — it stays in the client after a successful RPC return.
- Keep `system messages` (currently in `complete_circle_join` lines 125-169) inside the RPC, but unify them across paths so the chat history is consistent regardless of which join path was used.
- Consider whether `setMyCircleIds()` cache-update in the client (CirclesContext line 627) needs preserving — yes; the new client hook should mirror it after the RPC returns success.

---

## Open questions / decisions needed before implementation

1. **Demo auto-credit (`demo_quickjoin`):** the gated path inserts a `circle_contributions` row marked `paid` and credits `user_wallets` by the circle's amount. The ungated path doesn't. The audit doc `26_stage2_blocker_fake_autocredit.md` flags this as a known issue. Decision needed: does the demo auto-credit survive consolidation, or is it removed entirely with Stage 2? The unified RPC's behavior depends on this.

2. **Position assignment:** the ungated path computes `position = current_members + 1` client-side from a read of `circles.current_members`. There's a race condition under concurrent joins. The unified RPC should compute position server-side with a row lock (e.g., `SELECT ... FOR UPDATE` on the `circles` row) or use a sequence-style counter — needs verification of the existing payout/cycle logic's assumptions about position uniqueness and density.

3. **Backward compatibility window:** if the old `complete_circle_join(p_pending_id uuid)` is kept as a wrapper, when can it be removed? The QuickJoin pre-flow creates `pending_joins` rows that point at it. Migration of the QuickJoin flow first, then RPC removal in a later cleanup, seems safe but should be planned.

4. **Capacity check (`isFull`):** currently the `CircleDetailScreen` "Join Circle" button is disabled when `isFull` is true (client-side check, line 800-802). The server-side RPC should enforce this same invariant — relying on the client gate alone is the same class of bug as relying on the client to do email verification.

---

## Risks & migration considerations

- **The fork has existed for an unknown amount of time.** Any production data already in `circle_members` may have been created by either path. Audit script: cross-check `circle_members.created_at` against `pending_joins.completed_at` for matching `(user_id, circle_id)` to see which path each row came from. Doesn't need to be fixed retroactively, but worth knowing the split.
- **RLS lockdown will break the current `joinCircle()` immediately on deploy.** Plan a coordinated rollout: ship the new RPC first, migrate all 7 callers to it in a single commit, then tighten the RLS policy. Don't tighten RLS while the old code is still live.
- **`circle_members` is queried very widely** (40+ call sites at last grep). Read patterns are unaffected by the proposed RLS change — only INSERT is restricted. But it's worth grepping for any other `.insert("circle_members")` outside `CirclesContext.joinCircle` and `CirclesContext.createCircle` to make sure we catch every writer.
- **The `createCircle` flow** also INSERTs a `circle_members` row (the creator becomes a member at creation time, `CirclesContext.tsx:550`). This is a third write path. Decision: does this go through the unified RPC too (probably yes, as part of `createCircle` server-side), or does it stay as a separate path? Recommendation: server-side `createCircle` RPC that creates the circle AND inserts the creator's `circle_members` row in one transaction, no client-side INSERT for either.

---

## Why this is a Stage-4 blocker, not a Stage-4-or-later cleanup

Stage 4 introduces a payout-issuance code path that needs to verify the recipient is onboarded for Stripe Connect payouts. That JIT check is correct only if **every member of every circle reached membership via a path that the system can reason about**. If 7 of 9 join paths bypass the gated RPC today, then the same 7 paths can introduce members the payout system doesn't expect — members with no `pending_joins` row, no audit trail, no consistent error contract. The payout JIT check would still *work* (it queries `stripe_connected_accounts` for the recipient regardless of how they joined), but the broader assumption "we can add invariants at the join point" is false until consolidation is done.

The work should land *before* the Stage 4 payout RPC is built, so the payout RPC can be designed against a clean, single-source-of-truth membership invariant.

---

## Links

- Decision context: `docs/audit/27_join_gate_revert_decision.md`
- Original gate (now-reverted): `supabase/migrations/069_circle_join_connect_gate.sql`
- Fake-autocredit downstream concern: `docs/audit/26_stage2_blocker_fake_autocredit.md`
- Stripe payout path overview: `docs/audit/24_stripe_connect_payout_path.md`
- Orphan edge functions: `docs/audit/25_orphan_edge_functions.md`
