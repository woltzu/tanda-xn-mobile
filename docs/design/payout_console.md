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
   (`notification_queue`), category `payout_held`. Copy is authored
   per §3.1.1 — the hold RPC accepts an optional
   `member_facing_note` parameter; if omitted, the default copy in
   §3.1.1 is sent unmodified. The raw `reason` field is admin-only
   and is never surfaced to the recipient.
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

#### 3.1.1. Notification copy

The hold RPC accepts an optional `member_facing_note TEXT`
parameter. When present, the admin's note is delivered as-is
(subject to `notification_queue`'s length caps). When absent (the
default path), the copy below is sent verbatim across all three
channels — email, push, in-app.

**Member-facing default:**

> **Your payout is on a brief hold.**
>
> Your money is safe with TandaXn. A team member is verifying a
> routine detail before releasing your payout. Most holds resolve
> within 24 hours — we'll notify you as soon as it's released.
> No action is needed from you. If you have questions, tap Help
> below.

**Admin-facing console form (the shape that renders in the admin
UI when placing a hold):**

```
Payout held
  Amount:             $X
  Recipient:          [Name]
  Reason code:        [dropdown — enum]
  Justification:      [free text — min 20 chars, mirrors Doc 38]
  Recipient notified: Yes
  [Release hold] button
```

**Audit trail on every hold action:** the hold write is logged
with `admin_user_id`, timestamp, `reason_code`, and free-text
`justification`. This lands both on `circle_payouts` (the hold
columns from §5.1) and in `ledger_events` as the `payout.held`
row (§4). The two sources overlap deliberately — the
`circle_payouts` snapshot is the fast admin-UI read path, the
`ledger_events` row is the immutable forensic record.

#### 3.1.2. Interaction with lending auto-repay (Doc 36)

`execute_cycle_payout` (mig 357) delegates to
`process_advance_repayment` when the recipient has an active loan
with `target_cycle_id` set to the cycle being paid. Holds interact
with that path in three distinct ways:

1. **Held → released normally.** Loan auto-repay proceeds
   atomically with the payout at release time. No lending-side
   change needed. This is the default happy path.
2. **Held → corrected via Doc 38.** The originally-targeted
   payout never lands, so the loan is orphaned — its
   `target_cycle_id` points at a payout that will never fire, and
   no repayment will ever offset the balance. Admin must decide
   per-case, with a reason code recorded:
   - **(i)** Re-point `target_cycle_id` to the member's next
     scheduled payout (loan continues), OR
   - **(ii)** Emit a `loan.corrected` event zeroing the loan
     balance (platform absorbs the loss).
3. **Held indefinitely (30+ days).** Auto-escalate to platform
   admin: cron job enqueues an alert to `super_admin` /
   `platform_admin` demanding an explicit decision (release,
   correct, or extend). Prevents loans quietly ageing in limbo
   because a hold was placed and forgotten.

**Follow-up task, not this doc's scope:** Doc 36 needs a new
section "Interaction with payout holds and corrections" that
formalises the `loan.corrected` event, the `target_cycle_id`
re-point RPC, and the 30-day escalation cron. Flagged here so it
doesn't fall through the crack.

#### 3.1.3. Concurrency — two admins hold the same payout

Two admins clicking Hold on the same payout at roughly the same
time is a real operational scenario, not a theoretical race. The
ledger's job is to record what happened, so both events are
preserved. UX makes the collision visible instead of hiding it.

**Behavior:**
- **First hold:** normal success path. Writes the
  `circle_payouts` row (status → `held`), writes the
  `payout.held` ledger event, notifies the recipient.
- **Second hold** (fires while the first is still active):
  - Still writes a `payout.held` ledger event, with
    `metadata.secondary_hold: true` and a `metadata.parent_hold_event_id`
    pointing at the first hold. (No dedupe, no UNIQUE index — Option
    (a) in prior draft discussions is adopted.)
  - Does NOT re-UPSERT the `circle_payouts` row (the first admin's
    `held_by_admin_id` + `hold_reason` stay authoritative on the
    payout row itself).
  - RPC response to the second admin surfaces the collision
    directly: `{ success: true, secondary_hold: true, first_holder:
    { admin_user_id, name, held_at, reason } }`.
- **UI toast (second admin):** *"This payout was just held by
  [first admin's name] at [timestamp]. Your hold has also been
  recorded."* No false-success confusion; both admins see the
  shared state.
- **Release semantics unchanged:** a single `release_payout`
  clears the `circle_payouts.status = 'held'`. The two ledger
  rows remain as-is — releasing does not retroactively "merge"
  them. `release_payout` writes one `payout.released` event; if
  operators want to indicate that the release resolves both
  holds, the release_note can mention it, but no schema-level
  linkage is required.

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

#### 3.3.2. Community-admin visibility

`community_admin` role (mig 269 — scoped to a single community)
sees the platform-pause badge in the top pane so they can explain
to their members why circles aren't paying out. They do NOT see
the activate/release buttons — the kill switch is `super_admin`
only.

**Badge is actionable in a limited way.** Tapping it reveals:
- **Who** activated the pause
  (`payouts_paused_by_admin_id` → display name).
- **When** it was activated (`payouts_paused_at`, formatted as
  relative + absolute).
- **The reason** (`payouts_paused_reason`).

Rationale: silence + broken payouts + no explanation reads to
members as a platform failure. Giving community admins the
"who, when, why" lets them respond with confidence instead of
guessing. This is read-only enrichment of what they can already
see (the badge itself); no elevation of write privilege.

The `get_platform_pause_state()` RPC (§5.5) returns this payload
to any active admin regardless of role. The community-admin's
console renders the details in a tooltip / expandable panel on
badge tap; the buttons rendered next to the badge for
`super_admin` (`Release pause`) are omitted from the
`community_admin` render.

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

### 5.1. `circle_payouts.status` — convert to ENUM

Replace `circle_payouts.status`'s current unconstrained TEXT column
with a Postgres ENUM type. ENUM is preferred over a CHECK constraint:
values are validated at insert time, `ALTER TYPE ADD VALUE` is
idempotent and cheap for future additions, and the type is a first-
class object that surfaces in `pg_type` (easier to audit than a CHECK
expression embedded in the table definition).

```sql
CREATE TYPE public.payout_status AS ENUM (
  'pending', 'processing', 'completed', 'failed',
  'reversed', 'held', 'awaiting_approval'
);

ALTER TABLE public.circle_payouts
  ALTER COLUMN status TYPE public.payout_status
  USING status::public.payout_status;
```

**Code sweep required in the same migration PR.** Grep every writer
that touches `circle_payouts.status` and confirm the string value it
writes is a member of the ENUM. Any writer using an invalid string
will fail the `USING status::payout_status` cast at migration time —
the migration will abort with a clear error, and the offending
writer must be fixed in the same PR before the migration lands.

Search targets (non-exhaustive):
- `supabase/migrations/*.sql` — grep `circle_payouts` with a nearby
  SET/VALUES/INSERT INTO clause.
- `supabase/functions/**/*.ts` — grep `.from("circle_payouts")` for
  edge-function writers.
- `context/`, `services/` — client side rarely writes this column
  directly, but sweep to be sure.

New columns (unchanged from prior draft):

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

### 7.1. Resolved decisions

The five open questions in prior drafts of this section are all
resolved. Their answers landed in the relevant sections above:

| # | Question | Decision | Where |
|---|----------|----------|-------|
| 1 | Formal CHECK vs inline comment for `circle_payouts.status`? | Neither — use a Postgres ENUM type + in-PR writer sweep. | §5.1 |
| 2 | Should `community_admin` see the platform-pause badge? | Yes, and the badge is actionable (who/when/why on tap). Buttons remain `super_admin` only. | §3.3.2 |
| 3 | Notification wording for holds? | Optional `member_facing_note` on the hold RPC with a documented default copy sent verbatim across email / push / in-app. | §3.1.1 |
| 4 | Lending auto-repay interaction with holds? | Three scenarios documented (released-normally, corrected-via-Doc-38, held-30d+). Doc 36 gets a follow-up section for the schema-level pieces. | §3.1.2 |
| 5 | Concurrency on hold — two admins, same payout? | Option (a) — accept both ledger events. UX surfaces the collision (`secondary_hold: true` + toast naming the first holder). | §3.1.3 |

### 7.2. Remaining edge case — Platform-pause vs per-payout hold interaction

Per-payout holds (§3.1) and the platform-wide pause (§3.3) are
**independent locks**. The release of one does not release the
other. Concretely:

1. Admin holds payout X via `hold_payout` → `circle_payouts.status
   = 'held'`.
2. Platform pause activates via `activate_platform_pause` →
   `platform_settings.payouts_paused = true`.
3. Platform pause releases via `release_platform_pause` →
   `platform_settings.payouts_paused = false`.
4. **Payout X stays held.** The per-payout hold on X survives the
   pause lifecycle untouched.

Console UI already reflects this via §2.2's row-level status
derivation: `Platform-paused` outranks `Held` while the pause is
active, and once the pause clears, the `Held` state re-surfaces
in the row.

**Implementation-time verification:** confirm
`release_platform_pause` writes only to
`platform_settings.payouts_paused` — it must NOT touch any
`circle_payouts.status = 'held'` rows. A one-line unit test on
the RPC (assert row count unchanged on `circle_payouts WHERE
status = 'held'` across activate/release cycle) is enough. Flag
here so this is not silently dropped during implementation.

---
