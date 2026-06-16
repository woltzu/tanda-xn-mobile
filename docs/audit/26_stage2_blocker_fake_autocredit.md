# Stage 2 Blocker — Fake Auto-Credit in `complete_circle_join`

**Logged:** 2026-05-21 (during Stage 1 build)
**Status:** Flagged, intentionally NOT addressed in Stage 1.

## What's there

The unchanged body of `public.complete_circle_join(p_pending_id uuid)` (preserved verbatim through migration 069) does three things after the new Connect gate passes:

1. Inserts a `circle_contributions` row with `status='paid'`, `payment_method='demo_quickjoin'`, `is_on_time=true`.
2. Increments `user_wallets.main_balance_cents` by `(v_circle_amount * 100)`.
3. Marks the pending-join row as completed.

None of these touch Stripe. The "contribution" is a database-only side-effect that materializes money out of thin air — the same shape as a real `circle_contributions` insert that would follow a successful `payment_intent.succeeded` webhook, but no charge ever fires.

## Why it survived Stage 1

Stage 1 is "onboarding only." Real-money charges are Stage 2. The auto-credit behavior is harmless for the join-gate smoke test: it lets the existing join flow continue producing the rows downstream code expects, so we can verify the gate works without rewriting the contribution path.

## Why Stage 2 must replace it

Stage 2 introduces real Stripe charges through `create-payment-intent` (already shipped via Path A) plus the Connect-transfer flow. **Two contribution paths cannot coexist** — if both run on a single join, the wallet gets credited twice (once by the fake auto-credit, once by the real `payment_intent.succeeded` webhook handler) and the `circle_contributions` table accumulates duplicate rows.

## Required Stage 2 work (recorded, not assigned)

1. Remove lines that **fake the contribution** in `complete_circle_join`:
   - The `INSERT INTO circle_contributions (...) VALUES (..., 'paid', ..., 'demo_quickjoin', ...)` block.
   - The `UPDATE user_wallets SET main_balance_cents = main_balance_cents + v_amount_cents` block.
2. Keep the member-insert and pending-join-status-update — those are about join completion, not money.
3. Wire the join flow to instead trigger a real `create-payment-intent` call for the first cycle's contribution, with `purpose='contribution'` and `circle_id`/`cycle_id` parameters.
4. The wallet credit (or pool credit) happens in the `payment_intent.succeeded` webhook branch, NOT in the RPC.

## Risk if forgotten

If Stage 2 adds the real charge path WITHOUT removing the fake credit, every new join double-credits the joining member's wallet. Reconciliation against the Stripe dashboard will reveal it eventually, but it's the kind of bug that lands in production before anyone notices.

## Cross-references

- `docs/audit/24_stripe_connect_payout_path.md` — original Stripe Connect path audit.
- `supabase/migrations/069_circle_join_connect_gate.sql` — Stage 1 migration that left this in place.
- `seo-work/migration_069_rollback.sql` — pre-Stage-1 function body (also contains the fake auto-credit).
- Webhook reconciliation rule (per architecture decision 2026-05-21): "Webhooks are the ONLY source of truth for money state. No status advances on app-code optimism — only on a verified Stripe webhook." This rule cannot hold while `demo_quickjoin` still exists in the join RPC.

---

_Note logged during Stage 1 build at user request. Do not address in Stage 1. First thing to fix in Stage 2._
