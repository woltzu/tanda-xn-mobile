# Doc 39 — Payout Console

**Status:** Proposed (pre-implementation)
**Date:** 2026-07-27
**Scope:** Defines the admin operational surface — visibility, per-payout
holds, per-circle manual approval, and a platform-wide kill switch —
that gives operators control over payout *timing and execution* without
letting them modify amounts, recipients, or bypass the ledger.

**Related docs:**
- Doc 34 — Ledger (append-only guarantee that Doc 39 must preserve).
- Doc 38 — Circle Closing and Correction Workflow (the ONLY path to
  amend a payout's amount or recipient; Doc 39 explicitly defers to it).
- Doc 40 — Profile Visibility (admin access to member contact info during
  a hold or dispute is logged per Doc 40's `profile_access_log`).

---

## 1. Purpose and Boundaries

### 1.1. Purpose

TandaXn already runs payouts on two paths:

1. **Auto path** — the stripe-webhook calls `should_auto_trigger_payout`
   after every contribution PI succeeds; when all active members of a
   cycle have paid, it stages a Stripe Transfer inline
   (`supabase/migrations/292_auto_payout_trigger.sql`).
2. **Admin path** — `execute_cycle_payout` RPC / `process-circle-payout`
   EF (mig 357, mig 365) for manual dispatch.

Both paths land in the same `circle_payouts` row shape and the same
`ledger_events` `stripe.transfer.paid` record. Today, an admin has no
way to **pause** an auto-payout after all contributions land, no way
to require a **human approval** on a given circle's payouts, and no
kill switch for a platform-wide incident (a Stripe outage, a suspected
fraud wave, a schema migration in flight).

The **Payout Console** adds those three controls plus a single unified
view of what is upcoming, what is executing, and what recently landed.

### 1.2. Boundaries — what admins can and cannot do

**Admins CAN:**
- See every payout in a single dashboard (upcoming / in-flight / recent).
- **Hold** a specific payout with a reason, delaying execution until
  released.
- Toggle a circle into **manual approval mode**, so every payout on
  that circle waits for an admin `approve` action instead of auto-firing.
- **Pause the entire platform** — no Transfers, no auto-fires, no
  admin-path dispatches — behind a 2FA + written-reason gate.
- Release any of the above (unhold, revoke approval mode, resume
  platform).

**Admins CANNOT** (any of the following requires Doc 38's correction
workflow):
- Change the recipient of a payout.
- Change the amount of a payout.
- Skip a member's turn in the rotation.
- Insert a payout out of the cycle's declared order.
- Bypass the `ledger_events` append-only trigger (mig 372).
- Delete a payout row or its `ledger_events` mirror.

**Rationale:** Timing and execution control are operational levers
that a human should have. Amount / recipient / order are financial
truths that must not move without the compensating-entry audit trail
Doc 38 defines. Keeping the two surfaces distinct means an operator
can act fast in an incident without opening a hole through which a
malicious or careless admin could rewrite history.

---

## 2. The Console UI

Single screen, four panes. All data is live (Supabase realtime on the
underlying tables where possible; polled every 15s where not).

### 2.1. Top pane — Live circle invariants

Compact strip of KPIs, refreshed every 15s:

- **Circles with pending payouts (next 7d)** — count + drill-down.
- **Circles in `awaiting_approval`** — count + list.
- **Circles held** — count of circles with at least one held payout.
- **Platform pause state** — badge (`Active` / `Paused`) with an
  age counter if paused.
- **Reconciliation health** — count of `circle_payouts` rows in
  `processing` for more than 30 minutes (a smoke signal that a
  Stripe Transfer is stuck).

The **per-circle closing invariants** from Doc 38's
`get_circle_invariant` are reachable via a "Details" affordance on
any row that shows a circle — the top pane summarises, the drill-in
reveals.

### 2.2. Left column — Upcoming payouts (next 7 days)

Table, sorted by `expected_date ASC`:

| Column | Source |
|--------|--------|
| Circle name | `circles.name` |
| Cycle # | `circle_cycles.cycle_number` |
| Recipient | `circle_cycles.recipient_user_id` → `profiles.display_name` |
| Amount | `circle_cycles.payout_amount` (cents → formatted USD) |
| Expected date | `circle_cycles.expected_payout_date` |
| Status | Derived (see §3.4) |
| Actions | `Hold` / `Approve` (if `awaiting_approval`) / `Details` |

Row-level Status derivation (in priority order):
1. If `platform_settings.payouts_paused = true` → `Platform-paused`.
2. If `circles.payouts_require_approval = true` and a
   `circle_payouts` row for this cycle exists with `status =
   'awaiting_approval'` → `Awaiting approval`.
3. If a `circle_payouts` row exists with `status = 'held'` → `Held`.
4. If all active members have contributed → `Ready`.
5. Otherwise → `Awaiting contributions (N of M paid)`.

### 2.3. Center column — In-flight payouts

Payouts with `circle_payouts.status IN ('processing', 'awaiting_approval')`.

For each, show a **step timeline** so the operator can see where a
stalled transfer is stuck:

| Step | Source |
|------|--------|
| ① `pending_intents` row written | `pending_intents.created_at` |
| ② Stripe Transfer requested | `stripe_transfers.created_at` |
| ③ Stripe Transfer paid | `ledger_events (event_type='stripe.transfer.paid')` |
| ④ Wallet credited | `wallet_transactions (reference_type='circle_payout')` |
| ⑤ Loan auto-repay (if any) | `loan_payments` (via `process_advance_repayment`) |

Any step older than 30 minutes without progressing to the next flags
red. Details panel shows the underlying row IDs so an operator can
open the Stripe dashboard directly.

### 2.4. Right column — Recent history (last 30 days)

Table of `circle_payouts` where `completed_at >= NOW() - INTERVAL
'30 days'` OR `status IN ('failed', 'held', 'reversed')`.

Status badge:
- ✅ `Completed`
- ⚠️ `Held` / `Awaiting approval` / `Reversed`
- ❌ `Failed`

Click-through to a per-payout detail view showing the full step
timeline, ledger event links, and any hold / release event history.

### 2.5. Access control

- All console reads and mutations require `admin_users.is_active =
  true` AND `admin_users.role IN ('super_admin', 'platform_admin',
  'admin')` (roles per mig 269).
- `viewer` and `support` roles get read-only access to panes §2.1–§2.4
  but no action buttons.
- Platform-wide pause (§3.3) requires `super_admin` AND 2FA re-auth
  in the same session.

---

## 3. Three Control Mechanisms

### 3.1. Per-payout Hold

**Purpose:** Pause a single upcoming payout without touching any
other cycle.

**Signature:**
`hold_payout(cycle_id UUID, reason TEXT)` → JSONB summary.

**Preconditions:**
1. Caller is in `admin_users` with `is_active = true` and role in
   {`super_admin`, `platform_admin`, `admin`}.
2. The circle is NOT `closed` (per Doc 38 mig 372 the ledger trigger
   would refuse the `payout.held` event write anyway; explicit
   pre-check for a clean error).
3. No `circle_payouts` row for this cycle already has
   `status = 'completed'`.
4. `reason` is ≥ 20 characters (mirrors Doc 38's justification
   minimum; a hold without a reason is a footgun).

**Behavior:**
1. UPSERT a `circle_payouts` row for `cycle_id` with `status =
   'held'`, `held_at = NOW()`, `held_by_admin_id`, `hold_reason`.
   (If a row already exists in `pending` or `awaiting_approval`,
   update it in place; if none exists yet, insert a stub.)
2. Write a `'payout.held'` ledger event with metadata
   `{ cycle_id, admin_user_id, reason }`.
3. Notify the recipient via the standard notification pipeline
   (`notification_queue`), category `payout_held`, with the reason
   redacted to a short admin-authored user-facing message (the raw
   `reason` is admin-only; see §4.6).
4. Return `{ success, cycle_id, held_at, held_by }`.

**Release:**
`release_payout(cycle_id UUID, release_note TEXT)` → JSONB summary.

- Verifies admin authorization.
- Updates the `circle_payouts` row to `status = 'pending'`.
- Writes a `'payout.released'` ledger event.
- If the cycle would otherwise auto-trigger (all members paid, circle
  active), it does NOT auto-fire on release — the release simply
  clears the hold, and the next contribution PI or an admin manual
  dispatch causes the payout.
- Notifies the recipient.

**Race with auto-trigger:** The `should_auto_trigger_payout` RPC
(mig 292) already refuses to fire if a `circle_payouts` row in
`(scheduled, pending, processing, completed)` exists. Extend that
predicate to also refuse when status is `held` or
`awaiting_approval` (see §5.2). This is the sole coordination point
between auto-path and holds.

### 3.2. Per-circle Manual Approval Mode

**Purpose:** For a circle under heightened scrutiny (fraud
suspicion, member dispute, first-cycle-on-new-elder), require an
admin to approve every payout before it executes.

**Toggle:**
`set_circle_approval_mode(circle_id UUID, require_approval BOOLEAN, reason TEXT)`
→ JSONB summary.

- Updates `circles.payouts_require_approval` (new column, see §5.3).
- Writes a `'circle.approval_mode_changed'` ledger event with the
  reason.
- Notifies the circle's members that approvals are now required (or
  no longer required) with a plain-language explanation.

**When enabled, the payout lifecycle becomes:**
1. All members contribute; webhook fires
   `should_auto_trigger_payout` → returns `should_trigger = FALSE`
   because §5.2's predicate now also checks
   `circles.payouts_require_approval`.
2. Instead of firing the Transfer, the webhook writes a
   `circle_payouts` row with `status = 'awaiting_approval'`.
3. Console shows the row in the center column with an `Approve` action.
4. Admin clicks `Approve` → `approve_payout(cycle_id, note)` RPC:
   - Verifies admin authorization.
   - Writes a `'payout.approval_granted'` ledger event.
   - Transitions `circle_payouts.status` to `pending`.
   - Invokes `execute_cycle_payout(cycle_id)` inline.
5. If admin instead clicks `Hold` → §3.1 hold flow, status goes to
   `held`, no Transfer.

**Un-toggling** approval mode does NOT retroactively execute
`awaiting_approval` rows; those must be individually approved or
held. This is deliberate — turning approval mode off should be a
policy change, not a bulk approval.

### 3.3. Platform-wide Pause (Kill Switch)

**Purpose:** Stop all Transfer creation platform-wide during a Stripe
outage, suspected fraud wave, or in-flight schema migration.

**Signature:**
`activate_platform_pause(reason TEXT, twofa_token TEXT)` → JSONB.

**Preconditions:**
1. Caller has `admin_users.role = 'super_admin'`.
2. `twofa_token` validates against the admin's TOTP (verified in an
   Edge Function that owns the TOTP secret; the RPC receives only
   `twofa_verified BOOLEAN` from the EF, never the raw secret).
3. `reason` is ≥ 50 characters (higher bar than a hold — this is a
   platform-scale action).

**Behavior:**
1. UPSERT `platform_settings.payouts_paused = true`,
   `payouts_paused_at = NOW()`, `payouts_paused_by_admin_id`,
   `payouts_paused_reason`.
2. Write a `'payout.platform_pause_activated'` ledger event
   (`circle_id = NULL`; this event is platform-scoped, not
   circle-scoped, so the Doc 38 trigger does not object).
3. Schedule the recurring alert (see §3.3.1).
4. Notify every active `super_admin` and `platform_admin` via
   in-app + push + email.
5. Return `{ success, paused_at, reason }`.

**Enforcement points** (see §5.2 for the guard predicate):
- `should_auto_trigger_payout` short-circuits with
  `should_trigger = FALSE`.
- `execute_cycle_payout` returns `{ success: false, error:
  'platform_paused' }` and does NOT write any state.
- `process-circle-payout` EF checks `platform_settings.payouts_paused`
  before staging a Stripe Transfer.

**Release:**
`release_platform_pause(release_note TEXT)` → JSONB.
- Requires `super_admin` + 2FA again (do not trust a stale session).
- Sets `payouts_paused = false`, writes
  `'payout.platform_pause_released'` ledger event.
- Cancels the recurring alert.
- Notifies all `super_admin` / `platform_admin` that payouts have
  resumed.
- Does NOT retroactively fire any payouts. Cycles that had ready
  contributions during the pause will next fire when their next
  contribution PI lands, or when an admin dispatches them manually.

#### 3.3.1. Recurring alert while paused

- pg_cron job runs every 4 hours: if
  `platform_settings.payouts_paused = true` AND `payouts_paused_at
  < NOW() - INTERVAL '4 hours'`, enqueue a notification to every
  active `super_admin` and `platform_admin` reminding them the
  platform is still paused, showing `paused_at`, `paused_by`, and
  the reason.
- The alert is idempotent per 4-hour window (dedupes on
  `notification_queue.dedupe_key`).
- Rationale: a platform pause is a very expensive state to leave
  running by accident. The friction of the recurring alert makes
  "forgot to unpause" unlikely.

---

## 4. New Ledger Event Types

Add the following values to `ledger_events.event_type`'s allowed set.
The `ledger_events` block trigger (mig 276 + Doc 38 mig 372) enforces
append-only; the values here are event *types*, not new columns —
schema shape is unchanged.

| `event_type` | Circle-scoped? | `amount_cents` | Metadata keys | Written by |
|--------------|----------------|-----------------|---------------|------------|
| `payout.held` | Yes (`circle_id` set) | 0 | `cycle_id`, `admin_user_id`, `reason` | `hold_payout` |
| `payout.released` | Yes | 0 | `cycle_id`, `admin_user_id`, `release_note` | `release_payout` |
| `payout.approval_granted` | Yes | 0 | `cycle_id`, `admin_user_id`, `note` | `approve_payout` |
| `payout.platform_pause_activated` | No (`circle_id` NULL) | 0 | `admin_user_id`, `reason`, `twofa_verified: true` | `activate_platform_pause` |
| `payout.platform_pause_released` | No | 0 | `admin_user_id`, `release_note` | `release_platform_pause` |
| `circle.approval_mode_changed` | Yes | 0 | `require_approval: bool`, `admin_user_id`, `reason` | `set_circle_approval_mode` |

**`stripe_event_id` handling:** These are TandaXn-originated events, not
Stripe-originated. Following the Doc 38 pattern for correction /
close / reopen events, synthesise a `stripe_event_id` of the form
`tandaxn.internal:payout.{held,released,approval_granted,platform_pause_activated,platform_pause_released,circle.approval_mode_changed}:{event_uuid}`
to satisfy the `UNIQUE NOT NULL` constraint without a schema change.

**Doc 38 interaction:** All the circle-scoped events above are blocked
on `closed` circles by mig 372. This is desirable — you cannot hold
or approve a payout on a closed circle; the only remedial path is
Doc 38's `reopen_circle`.

---

## 5. Backend Changes Required

### 5.1. `circle_payouts.status` — new values

Add `'held'` and `'awaiting_approval'` to whatever the current
`status` allowed-set is. Mig 278 notes the existing set covers
`'pending'`, `'processing'`, `'completed'`, etc. (no CHECK on the
current column). Formalising the CHECK is scope for the implementation
migration; at minimum, the code paths must recognise the two new values.

New columns:

```sql
ALTER TABLE public.circle_payouts
  ADD COLUMN IF NOT EXISTS held_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_by_admin_id    UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hold_reason         TEXT,
  ADD COLUMN IF NOT EXISTS released_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by_admin_id UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_granted_by_admin_id UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL;
```

All new columns are nullable — a `completed` payout that never
touched the hold/approval path has all NULLs and that's fine. The
timestamps also let us reconstruct the operational history without
joining `ledger_events`, which is preferable for admin UI reads.

### 5.2. Guard predicate (auto-trigger + admin dispatch)

Rewrite `should_auto_trigger_payout` (mig 292) to add three new
short-circuits:

```sql
-- Platform-wide pause
IF (SELECT payouts_paused FROM public.platform_settings LIMIT 1) THEN
  RETURN QUERY SELECT FALSE, NULL::UUID, NULL::UUID, 0, NULL::TEXT, 0, 0;
  RETURN;
END IF;

-- Circle requires manual approval → do not auto-fire; the webhook
-- will insert an 'awaiting_approval' row instead.
SELECT payouts_require_approval INTO v_require_approval
FROM public.circles WHERE id = p_circle_id;
IF v_require_approval THEN
  RETURN QUERY SELECT FALSE, v_cycle_id, v_recipient, v_payout_amount::INT,
                      v_stripe_account, v_paid, v_expected;
  RETURN;
END IF;

-- Existing pending/processing/completed check, extended:
IF EXISTS (
  SELECT 1 FROM public.circle_payouts
  WHERE cycle_id = v_cycle_id
    AND status IN ('scheduled','pending','processing','completed',
                   'held','awaiting_approval')
) THEN
  RETURN QUERY SELECT FALSE, v_cycle_id, v_recipient, v_payout_amount::INT,
                      v_stripe_account, v_paid, v_expected;
  RETURN;
END IF;
```

Mirror the same three checks in `execute_cycle_payout` (mig 357/365)
so an admin's manual dispatch also refuses when paused / mode-approval /
already held.

### 5.3. `circles.payouts_require_approval`

```sql
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS payouts_require_approval BOOLEAN NOT NULL DEFAULT FALSE;
```

- Default FALSE — existing behavior is preserved.
- Read-hot column; index only if the console's list-circles query
  proves slow (unlikely; circle counts are small).

### 5.4. `platform_settings` — new table

```sql
CREATE TABLE public.platform_settings (
  id                          INT PRIMARY KEY DEFAULT 1
                                 CHECK (id = 1),  -- singleton
  payouts_paused              BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_paused_at           TIMESTAMPTZ,
  payouts_paused_by_admin_id  UUID REFERENCES public.admin_users(user_id) ON DELETE SET NULL,
  payouts_paused_reason       TEXT,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_settings (id, payouts_paused)
  VALUES (1, FALSE)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_settings_read_admin ON public.platform_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = TRUE
  ));

CREATE POLICY platform_settings_service ON public.platform_settings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- Singleton via the `id = 1` CHECK — cleaner than a settings table
  designed for many rows that only ever holds one.
- Writes go through `activate_platform_pause` /
  `release_platform_pause` SECURITY DEFINER RPCs; no direct
  authenticated-role write path.

### 5.5. Admin read RPCs for the console

Following Doc 38's `get_circle_invariant` /
`list_circle_ledger_events` pattern:

- `list_upcoming_payouts(p_days INT DEFAULT 7)` — powers left column.
- `list_in_flight_payouts()` — powers center column.
- `list_recent_payouts(p_days INT DEFAULT 30)` — powers right column.
- `get_platform_pause_state()` — top pane badge.

All are SECURITY DEFINER, gated on `admin_users` membership, and
return only rows the caller's role scope permits (per mig 269 —
`community_admin` sees only their community's circles;
`platform_admin` and `super_admin` see all).

### 5.6. 2FA verification for platform pause

The 2FA gate is enforced in an Edge Function
(`admin-verify-2fa`) that:
1. Validates the caller's TOTP against the admin's stored secret.
2. Returns a short-lived JWT (`2fa_verified: true`, exp 5 min).
3. The RPC `activate_platform_pause` accepts this JWT as
   `twofa_token` and verifies its signature + freshness + admin
   claim.

**Do NOT** store the TOTP secret in Postgres reachable from the
service role — keep it in Supabase Vault or an equivalent
KMS-backed store the EF can read and no other surface can.

### 5.7. Doc 40 access-log integration

When an admin uses the console to view a recipient's profile card
(e.g., clicking the recipient name to see contact info during a
hold investigation), the read flows through
`log_privileged_profile_read` (Doc 40 §6.2). The reason is
`reason_code = 'payout_investigation'`, with a `justification` that
references the held payout's `cycle_id`.

Console reads of the payout list itself (recipient name, amount,
status) do NOT trigger the profile access log — those fields are
already `Elders/Admins`-tier visible for the involved circle per Doc
40 §3, no privileged escalation.

---

## 6. What This Does NOT Do

Explicit non-goals, called out so the boundary is not eroded in
implementation:

1. **Cannot change the recipient of a payout.** The recipient is
   `circle_cycles.recipient_user_id`, established at cycle creation.
   A wrong recipient requires cycle rescheduling, which is a Doc 38
   correction (compensating entry) plus a `cycle_recipient_reassigned`
   event that Doc 38 must define — not a payout-console lever.
2. **Cannot change the amount of a payout.** The amount is
   `circle_cycles.payout_amount`. Amount adjustments (e.g., a
   member left mid-cycle, changing the pool size) go through Doc
   38's `apply_correction` on the relevant contribution / payout
   events, with a compensating `correction` event netting the
   ledger.
3. **Cannot skip a member's turn.** Skipping = reordering. The
   payout order is `circle_cycles.cycle_number` plus each row's
   `recipient_user_id`. Reordering requires updating the cycle
   rows, which is a scheduling change — out of scope. If a member
   is unable to receive (e.g., a frozen Stripe Connect account),
   the operational path is: hold the current payout, resolve the
   Connect issue, then release. Skipping is not offered.
4. **Cannot bypass the ledger.** All actions in this doc write
   `ledger_events` rows. The mig 372 trigger continues to enforce
   that no ledger event lands on a `closed` circle. No console
   action circumvents this — attempting a hold on a closed circle
   is rejected with a clear error, not silently permitted.
5. **Cannot execute out-of-cycle order.** The auto-trigger and
   `execute_cycle_payout` both key on `circle_cycles.cycle_number`
   and refuse to fire a cycle N+1 payout while cycle N is
   incomplete. The console exposes no override for this — a stuck
   cycle N is a Doc 38 or engineering conversation, not a
   console button.
6. **Does not delete history.** Held / approved / paused events
   are recorded permanently. Releasing a hold does NOT remove the
   `payout.held` event; it writes a companion `payout.released`
   event. The operational history is fully reconstructable from
   `ledger_events` alone.
7. **Does not schedule future actions.** No "hold this payout at
   date X" or "auto-release at date Y". Each hold and release is
   an explicit admin action, right now. Automation of any of this
   is a future-doc conversation and should be gated on real
   operational evidence that it's needed.

---

## 7. Open Questions for the Implementation Phase

1. **CHECK on `circle_payouts.status`** — mig 278 noted the column
   currently has no formal CHECK. Should the implementation migration
   introduce one (enumerating `pending / processing / completed /
   failed / reversed / held / awaiting_approval`), or continue with
   the inline-comment convention the codebase uses today? A CHECK
   is safer; a CHECK is also a coordination point across every
   writer, so needs a code sweep.
2. **`community_admin` scope on platform pause** — a
   `community_admin` sees only their community's data (per mig
   269). The platform pause is inherently platform-scoped; should a
   `community_admin` see the pause badge in the top pane at all, or
   is that a `platform_admin` / `super_admin`-only surface?
   Recommendation: show the badge (they should know why their
   circles aren't paying out); hide the buttons.
3. **Notification wording** for hold / approval / pause — needs a
   copy pass with product before shipping. Especially §3.1(3)
   "reason redacted" — who authors the user-facing summary?
   Proposal: hold RPC accepts an optional `member_facing_note`
   parameter; if omitted, uses a generic "Your payout is
   temporarily held for review." string.
4. **Interaction with lending auto-repay** — `execute_cycle_payout`
   (mig 357) delegates to `process_advance_repayment` when the
   recipient has an active loan. If a payout is `held` after
   contributions are collected but before execution, the loan's
   `target_cycle_id` still points at that cycle. On `release_payout`,
   the auto-repay proceeds normally. On indefinite hold + Doc 38
   correction of the payout, the loan's `target_cycle_id` must be
   re-pointed or the loan itself corrected. This is a lending-doc
   conversation, flagged here so it isn't missed.
5. **Concurrency: two admins hold the same payout** — the UPSERT
   in §3.1 is race-tolerant (last-writer-wins on `held_by_admin_id`),
   but the ledger event is a permanent record and there'd be two
   `payout.held` rows for a single actual hold. Options: (a) accept
   the redundant events as forensic detail; (b) add a UNIQUE partial
   index on `ledger_events (metadata->>'cycle_id', event_type)
   WHERE event_type = 'payout.held' AND (no subsequent released
   event)`. Recommendation: (a) — the ledger's job is to record
   what happened; two admins clicking the same button is what
   happened.

---
