# Doc 38 — Circle Closing and Correction Workflow

**Status:** Proposed (pre-implementation)
**Date:** 2026-07-20
**Scope:** Defines the correction workflow (compensating entries) and circle-based closing mechanism for admins, preserving the append-only ledger invariant.

---

## 1. Principles

1. **Ledger is append-only.** Nothing in this doc changes Doc 34's append-only guarantee. Instead of "reverse" we use **compensating entries** — new ledger events that offset the original, with the original left untouched.
2. **Circle-based closing** aligns accounting with product lifecycle. Better than a monthly close because circles have natural start/end boundaries.
3. **All corrections are auditable.** Every correction requires an admin ID, a reason code, and a free-text justification (min 20 chars). The original event is never modified or deleted.

---

## 2. Correction Workflow (NOT Reversal)

### 2.1. New `correction` event type

Add `'correction'` to the `ledger_events.event_type` allowed list (no schema change required beyond a CHECK extension).

### 2.2. Admin RPC: `apply_correction`

**Signature:**
`apply_correction(original_event_id UUID, reason_code TEXT, justification TEXT, amount_cents_delta INT)` → returns JSONB summary.

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `original_event_id` | UUID | The ID of the ledger event being corrected (original event is never modified). |
| `reason_code` | TEXT | Must be one of a fixed enum (see below). |
| `justification` | TEXT | Free-text, **minimum 20 characters**. MANDATORY. |
| `amount_cents_delta` | INT | The offset amount in cents (positive or negative). The correction event will have this amount (sign reversed) to net the balance. |

**Reason codes (enum, not free text):**

- `webhook_duplicate` — Stripe webhook fired twice, duplicate entry.
- `stripe_refund` — A Stripe refund was processed outside the app.
- `bug_reconciliation` — A bug caused an incorrect ledger entry.
- `member_dispute_resolved` — A member dispute was resolved with a compensating entry.
- `other_documented` — Any other valid reason; justification must be exceptionally detailed.

**Behavior:**

1. Verify the caller is an admin (exists in `admin_users` with `is_active = true`).
2. Verify the target circle (if any) is **not** `closed` (see Section 3).
3. Insert a new `ledger_events` row:
   - `event_type = 'correction'`
   - `external_reference_id = original_event_id`
   - `external_reference_type = 'ledger_event_correction'`
   - `amount_cents = amount_cents_delta` (use sign as provided)
   - `metadata` includes: `{ reason_code, justification, original_event_id, admin_user_id }`
   - `timestamp` = NOW()
4. **No modification** to the original event.
5. Return a summary JSON: `{ success, original_event_id, correction_event_id, new_balance_snapshot }`.

### 2.3. Ledger event linkage

Every correction event links back to the original via `external_reference_id` and `external_reference_type`. This creates a traceable chain:

```
original_ledger_event  <--  correction_ledger_event
```

Multiple corrections can be chained if needed (each correction event can itself be corrected, but that is discouraged).

### 2.4. Authorization

All corrections require `admin_users` authorization. The admin's `user_id` is recorded in the correction event's `metadata`, and also written to an `admin_correction_log` table (optional, but recommended for audit).

---

## 3. Circle-Based Closing Mechanism

### 3.1. New circle statuses

Extend `circles.status` enum (or `status` column) with two new values:

- **`payout_complete`** — all scheduled payouts have been made, but the circle has not yet been verified and closed.
- **`closed`** — verified, immutable. No further ledger inserts are allowed for this circle.

**Existing statuses** (`active`, `completed`, `cancelled`, `pending`) remain unchanged.

### 3.2. Closing invariant

A circle may be closed if and only if:

```
SUM(contributions.amount)
  - SUM(payouts.amount)
  - SUM(fees.amount)
  - SUM(corrections.amount)
= 0
```

(with a tolerance of ±$0.01 for rounding).

**Note:** Fees include all `fee.*` event types. Corrections are included in the sum.

### 3.3. `close_circle` RPC

**Signature:**
`close_circle(circle_id UUID, reviewer_note TEXT)` → returns JSONB summary.

**Behavior:**

1. Verify the caller is an admin.
2. Verify the circle is **not** already `closed`.
3. Compute the invariant:
   - Sum all contributions (`event_type = 'contribution'` or similar) for the circle.
   - Sum all payouts (`event_type = 'payout'` or `'circle_payout'`).
   - Sum all fees (`event_type = 'fee.*'`).
   - Sum all corrections (`event_type = 'correction'`).
4. If the sum is **not** within ±$0.01 of zero:
   - Return a `diff_report` JSON showing the breakdown.
   - **Do not close** the circle.
5. If the sum is zero:
   - Write a `'circle.closed'` ledger event with a snapshot of all balances at that moment.
   - Set `circles.status = 'closed'` and `circles.closed_at = NOW()`.
   - Return success.

### 3.4. Database enforcement: BEFORE INSERT trigger on `ledger_events`

To ensure immutability, add a `BEFORE INSERT` trigger on `ledger_events` that:

```sql
IF NEW.circle_id IS NOT NULL AND (SELECT status FROM circles WHERE id = NEW.circle_id) = 'closed' THEN
  RAISE EXCEPTION 'ledger_insert_blocked: circle is closed';
END IF;
```

This prevents any new ledger entries for a `closed` circle, even via direct SQL.

**Important:** The trigger must be `SECURITY DEFINER` or use `SET search_path` to avoid bypass.

---

## 4. Reopening (Rare Safety Valve)

### 4.1. `reopen_circle` RPC

**Restricted to a hardcoded admin UUID whitelist** (not role-based).
**Signature:**
`reopen_circle(circle_id UUID, reason TEXT)` → returns JSONB summary.

**Requirements:**
- `reason` must be at least 50 characters.
- The caller must be in a hardcoded UUID list (e.g., `['00000000-0000-0000-0000-000000000001']`).
- Writes a `'circle.reopened'` ledger event with the reason.
- Sets `circles.status = 'payout_complete'` (never `'active'`).
- Expected usage: <1/year.

**Rationale:** This is a safety valve for exceptional cases (e.g., a critical bug). Not intended for routine use.

---

## 5. Admin UI Requirements

### 5.1. Correction UI

- In the circle detail page (admin view), show a "Correction" button/flow.
- Allow the admin to select an existing ledger event and enter:
  - Reason code (dropdown from the allowed list)
  - Justification (free-text, min 20 chars)
  - Amount delta (positive or negative)
- After submission, show a preview of the compensating entry before confirmation.
- Show full audit trail: original event, correction event, admin ID, timestamp, reason.

### 5.2. Closing status visibility

- On every circle page (admin and member views), show a **closing invariant status**:
  - If net = 0: `Net: $0.00 ✓`
  - If net ≠ 0: `Net: $X.XX ⚠` (with a drill-down to the breakdown)
- Once `closed`, mark the circle clearly as **"Closed"** and make the entire page read-only.

### 5.3. Closed circle read-only mode

- No "Contribute", "Payout", or "Correction" actions are available.
- All data is visible but immutable.
- A "Closed" banner is displayed prominently.

---

## 6. What This Does NOT Do

| Does NOT do | Why |
|-------------|-----|
| Provide a "reverse transaction" button | That would violate append-only. Instead, we use compensating entries. |
| Allow admins to modify or delete ledger rows | The original event is never touched. |
| Rewrite history | All actions are additive. |
| Let admins change balances directly | Only via compensating entries with reason codes and justifications. |
| Replace monthly accounting | Circles are closed individually, aligning with product lifecycle. |

---

## 7. Dependencies

| Document | Link |
|----------|------|
| **Doc 34 — Ledger Design** | The `ledger_events` table is extended with `'correction'` and `'circle.closed'` event types. The append-only guarantee remains intact. |
| **Doc 35 — Fee Strategy** | Corrections for fee entries follow the same workflow. |
| **Doc 36 — Lending Staged** | Corrections for lending events will use the same mechanism when those products are live. |

---

## 8. Migration Plan (High-Level)

| Migration | Contents |
|-----------|----------|
| **370** | Add `correction` to `ledger_events.event_type` CHECK; add `closed_at` to `circles`; extend `circles.status` CHECK with `'payout_complete'` and `'closed'`. |
| **371** | Create `apply_correction` RPC; create `close_circle` RPC; create `reopen_circle` RPC. |
| **372** | Create BEFORE INSERT trigger on `ledger_events` to block inserts on `closed` circles. |

Each migration self-registers (`INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES (...) ON CONFLICT DO NOTHING;`).

---

**End of document.**
