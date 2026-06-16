# Conflict Resolution P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 161, on top of the
P0 architecture in `conflict_resolution.md`._

P2 closes four loops on the existing Conflict Resolution flow:
**auto-create** a dispute when a contribution lands in `late` / `missed`,
**auto-resolve** it when the same contribution flips to `paid`,
**escalate** disputes that go stale via a daily Edge Function, and let
elders **batch-resolve** similar cases from the Elder Dashboard.

## Data model (migration 161)

| Object | Purpose |
|---|---|
| `dispute_cases.auto_created BOOLEAN DEFAULT false` | UI badge driver. True when the contributions trigger inserted the row. |
| `dispute_cases.escalation_tier TEXT` | NULL by default. Set to `'elder_l2'` after 48h of no activity; `'global_queue'` after 7d. CHECK keeps the set bounded. |
| `idx_dispute_cases_status_updated(status, updated_at DESC)` | Stale-dispute scan for the Edge Function. |
| `idx_dispute_cases_auto_open(circle_id, respondent_id) WHERE auto_created` | Auto-resolve trigger lookup. (The `status='open'` partial filter couldn't go on the index because `status::TEXT` isn't IMMUTABLE — handled in the WHERE.) |

### Why `dispute_cases` not `disputes` / `circle_conflicts`

The audit found three tables: `dispute_cases` (the only one actually
consumed by the app, written by ReportIssueScreen and read by
ElderContext), `disputes` (orphan), and no `circle_conflicts`. Migration
161 binds to `dispute_cases` because that's where the live wiring is.
The P2 "unify into circle_conflicts" plan from
`conflict_resolution.md` stays on the open list.

### complainant_id for auto rows

`dispute_cases.complainant_id` is NOT NULL. For auto rows we set it to
the affected member (`NEW.member_id` from the contributions trigger).
The UI reads `auto_created=true` and renders the "AUTO" pill so the
"complainant = themselves" reads as system attribution, not user input.
A future migration could either relax the NOT NULL or introduce a
synthetic `system_user_id` constant.

## Trigger flow

### Auto-create

```
UPDATE contributions SET status = ...                  ← scheduler or admin
    ↓ AFTER UPDATE OF status trigger
    ↓ NEW.status IN ('late','missed') AND OLD.status ≠ NEW.status
    ↓ skip if a prior auto-dispute already names this contribution_id
    ↓
INSERT INTO dispute_cases (
  circle_id, complainant_id=member_id, respondent_id=member_id,
  dispute_type='missed_contribution', status='open',
  description='Auto: contribution due ... was flagged as ...',
  auto_created=TRUE
)
```

### Auto-resolve

```
UPDATE contributions SET status = 'paid'               ← when paid
    ↓ AFTER UPDATE OF status trigger
    ↓ NEW.status = 'paid' AND OLD.status ≠ 'paid'
    ↓
UPDATE dispute_cases SET status='resolved', resolution += '...', resolved_at = now()
 WHERE id = oldest open auto dispute for (circle_id, member_id)
    ↓ if a row was updated, also:
INSERT INTO circle_messages (
  user_id=member_id, body='Dispute resolved — payment received.',
  message_type='system'
)                                                      ← best-effort
```

The system row matches the existing Phase 2 system-message pattern from
`circle_messages`.

## Edge Function — escalate-stale-disputes

`supabase/functions/escalate-stale-disputes/index.ts`. Daily. Two
passes:

```
Pass 1 (48h+ stale, tier NULL):
  → escalation_tier = 'elder_l2'
  → notify every elder in the circle (type='dispute_escalated_l2')

Pass 2 (7d+ stale, tier NULL or 'elder_l2'):
  → escalation_tier = 'global_queue'
  → notify every active admin_users row (type='dispute_escalated_global')
```

Idempotency is the `escalation_tier` value itself — the `WHERE` filters
exclude rows already at the target tier. Each escalation also stamps
`updated_at` so the next tier's 7d clock starts from the bump.

Deployment:
```
supabase functions deploy escalate-stale-disputes --no-verify-jwt
```
Schedule daily ~06:00 UTC.

## P0 notification path — verified

The spec asked us to verify the P0 dispute notification fan-out works.
`CirclesContext.reportMember` at lines 1342-1430 inserts one
`notifications` row per circle elder when a dispute is filed. Insert
target table is `notifications`; columns match the other notification
producers in the codebase. No fix needed — the path is sound.

## Frontend

### `screens/ElderDashboardScreen.tsx` — batch mode
* "Select cases" toggle in a new "Active cases" section.
* Each active row becomes a checkbox; selecting any reveals a sticky
  navy action bar at the bottom of the screen.
* Three actions: **Resolve** (loops `submitRuling` with a templated
  batch ruling + explanation), **Warn** (no-op TODO until an elder
  warning path lands in ElderContext), **Escalate** (loops
  `escalateCase` with the batch reason).
* Tapping a row outside batch mode still navigates to ConflictCase as
  before.

### `screens/ConflictCaseScreen.tsx` — visual surface
* New teal "AUTO" pill next to the severity/status pills when
  `case.autoCreated`.
* New amber escalation banner under the pill row when
  `case.escalationTier === 'elder_l2'`. Red variant for `'global_queue'`.

### `context/ElderContext.tsx`
* `MediationCase` type now exposes `autoCreated?: boolean` and
  `escalationTier?: 'elder_l2' | 'global_queue' | null`.

## i18n + parity

- 14 new keys under `conflict_p2.*` (badge, two escalation banner
  strings, six batch UI strings, three batch action defaults). EN/FR
  parity at **5360 leaf keys each**.

## Open follow-ups (not P2)

* **Elder warning primitive** — `runBatch('warn')` is a no-op TODO. A
  `warnMember(caseId, message)` method on ElderContext that posts a
  `moderation_actions` row (mig 152) and a notification would land
  this naturally.
* **MediationCase hydration of `autoCreated` + `escalationTier`** —
  the type fields are declared but the mapper in ElderContext doesn't
  yet read the columns. Adding `auto_created` + `escalation_tier` to
  the SELECT and mapping them to the camelCase fields is the last
  step before the UI pills go live for non-mock data.
* **Unify into `circle_conflicts`** (deferred from P0 doc). Once the
  table lands, the auto-create trigger moves over; the screen reads
  from the union.
* **Per-tier audience tuning** — today every elder of the circle gets
  the L2 escalation; a future refinement could route to the
  highest-tier elder first.
