# TandaXn Ledger — Design (v2)

> **Scope of this document.** A current-state reference for the TandaXn financial ledger — the set of tables, RPCs, triggers, and Stripe integration points that together record every movement of money touching a user wallet. Written from a read-only survey of the code and migrations, not from a prior design brief. Where the implementation and the "ideal" design diverge, this document names both and flags follow-ups rather than papering over the gap.
>
> **Filename convention.** `v2` is the session-local revision tag. The number does not correspond to a migration or a Doc-34-style index; the earlier `34_*` slot in `docs/audit/` is occupied by unrelated drift-audit outputs.

---

## 1. Overview

TandaXn's ledger is a **single-entry, append-only transaction log with balance snapshots**, not a double-entry general ledger. Two tables carry the load:

| Table | Role |
|---|---|
| `user_wallets` | Balance-of-record — one row per user, multi-balance model (main / reserved / committed). Written by every money-moving RPC under a `SELECT … FOR UPDATE` lock. |
| `wallet_transactions` | Append-only ledger — one row per posted movement, carrying `balance_before_cents` + `balance_after_cents` snapshots and a `direction` (credit / debit / internal). |

Every other ledger-adjacent table (`savings_transactions`, `circle_contributions`, `circle_payouts`, `loan_payments`, `pool_transactions`, `insurance_pool_transactions`) is a **domain-specific projection** that either mirrors a `wallet_transactions` row via an FK (`wallet_transaction_id`) or drives one indirectly through an RPC. The user-facing "activity feed" reads from `wallet_transactions`; the accounting truth is the pair `user_wallets` + `wallet_transactions`.

External money (Stripe) is reconciled separately via a **Stripe-event mirror** (`ledger_events`) that is completely independent of `wallet_transactions`. That separation is deliberate: `ledger_events` records "an event confirmed by Stripe", `wallet_transactions` records "a balance change on a TandaXn wallet", and the join between them is the RPCs and triggers that fire in response to Stripe webhooks.

### Design principles the implementation actually follows

1. **Wallet is authoritative.** `user_wallets.main_balance_cents` is the number the app displays. `wallet_transactions` is an audit surface. Balances are NOT recomputed from a running sum of the ledger; the ledger's job is to explain how the wallet arrived at its current number.
2. **Snapshots on every row.** `wallet_transactions.balance_before_cents` and `.balance_after_cents` are both `NOT NULL`. This is how the ledger stays self-verifying: any row lets you spot a break in continuity by checking that `row[N].balance_before == row[N-1].balance_after` per `(wallet_id, balance_type)`.
3. **Service-role writes, user-scoped reads.** Users can SELECT their own rows. All INSERT/UPDATE paths go through SECURITY DEFINER RPCs or triggers that run as service_role. Row-level idempotency and validation live inside those RPCs; they do not live at the schema layer (no CHECK constraints on the taxonomy columns — see §3).
4. **Per-wallet lock, not global.** Concurrency uses `SELECT … FOR UPDATE` on the target `user_wallets` row inside every RPC that mutates a balance. There are no advisory locks and no `SERIALIZABLE` isolation. Two concurrent movements against the same wallet serialize; movements against different wallets don't contend.
5. **Multi-balance model.** A wallet has three positive-only slots — `main`, `reserved`, `committed` — with `total` and `available` as `GENERATED ALWAYS AS ... STORED` columns. Every `wallet_transactions` row names which `balance_type` it moved, so the ledger can reconstruct a per-slot history, not just a total.
6. **Stripe events are the source of truth for money in/out.** `ledger_events` is append-only with a mutation-blocking trigger, keyed by `stripe_event_id UNIQUE`. Nothing crosses the Stripe boundary without leaving a row there.

### Design gaps the implementation currently has

Named up front so they aren't misread as design intent later:

- **No CHECK constraint on `wallet_transactions.transaction_type`, `.direction`, `.balance_type`, or `.transaction_status`.** Values live only as inline comments in `supabase/migrations/015_payout_execution_engine.sql:143-170`. A typo in an RPC can land silently and only surface when the activity-feed UI can't render it.
- **No idempotency key on `wallet_transactions` itself.** Idempotency is enforced at the Stripe boundary (`stripe_payment_intents.idempotency_key`, `stripe_transfers.idempotency_key`, `ledger_events.stripe_event_id`, `pending_intents.client_reference_id`) — never on the wallet-side ledger row. If an RPC accidentally runs twice you get two rows.
- **No pg_cron reconciliation.** `get_reconciliation_summary(start, end)` exists but is on-demand only. Nothing periodically checks that `SUM(wallet_transactions) per wallet == user_wallets.main_balance_cents`.
- **No double-entry pair.** A single row is "the transaction". There is no companion row on a system counterparty account — the wallet moves, the counterparty is implied by `transaction_type` + `reference_type` / `reference_id`.

---

## 2. Ledger tables

### 2.1 `user_wallets` — balance-of-record

`docs/audit/11_live_schema_dump.sql:8467-8494`, created in `supabase/migrations/015_payout_execution_engine.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID NOT NULL UNIQUE | FK `profiles(id)`. One wallet per user. |
| `main_balance_cents` | BIGINT NOT NULL DEFAULT 0 | Free-to-spend / withdraw. `CHECK ≥ 0`. |
| `reserved_balance_cents` | BIGINT NOT NULL DEFAULT 0 | Earmarked (autopay hold, pending contribution). `CHECK ≥ 0`. |
| `committed_balance_cents` | BIGINT NOT NULL DEFAULT 0 | Committed to a specific downstream obligation. `CHECK ≥ 0`. |
| `total_balance_cents` | BIGINT | `GENERATED ALWAYS AS (main + reserved + committed) STORED`. |
| `available_balance_cents` | BIGINT | `GENERATED ALWAYS AS (main - reserved) STORED`. |
| `wallet_status` | TEXT NOT NULL DEFAULT 'active' | `frozen_reason` + `frozen_at` support freezing. |
| `total_payouts_received_cents` | BIGINT DEFAULT 0 | Lifetime counter, used by Advance eligibility. |
| `total_withdrawals_cents` | BIGINT DEFAULT 0 | Lifetime counter. |
| `money_retention_rate` | NUMERIC DEFAULT 1.0000 | Rolling ratio of money kept vs withdrawn — XnScore signal. |
| `default_payout_destination` | TEXT DEFAULT 'wallet' | Where cycle payouts land unless overridden. |
| `auto_reserve_enabled` | BOOL DEFAULT true | Toggles the autopay reserve behavior. |
| `last_activity_at`, `created_at`, `updated_at` | TIMESTAMPTZ | |

The generated columns are the important detail — the app never sums a total client-side, it reads `total_balance_cents` or `available_balance_cents` directly and trusts them.

### 2.2 `wallet_transactions` — the ledger

`docs/audit/11_live_schema_dump.sql:8682-8704`, created in `supabase/migrations/015_payout_execution_engine.sql`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `wallet_id` | UUID NOT NULL | FK `user_wallets(id)`. |
| `user_id` | UUID NOT NULL | FK `profiles(id)`. Denormalized for RLS + indexed reads. |
| `transaction_type` | TEXT NOT NULL | See taxonomy §3. No CHECK. |
| `direction` | TEXT NOT NULL | `'credit' | 'debit' | 'internal'`. No CHECK. |
| `balance_type` | TEXT NOT NULL | `'main' | 'reserved' | 'committed'`. Names which slot moved. |
| `amount_cents` | BIGINT NOT NULL | Absolute value; sign is implied by `direction`. |
| `balance_before_cents` | BIGINT NOT NULL | Snapshot of the moving slot just before this row was written. |
| `balance_after_cents` | BIGINT NOT NULL | Snapshot immediately after. |
| `reference_type` | TEXT | e.g. `'circle_payout'`, `'loan_disbursement'`, `'goal_deposit'`. |
| `reference_id` | UUID | FK-shaped but not FK-constrained — points into whatever `reference_type` names. |
| `money_movement_id` | UUID | FK `money_movements(id)` when the movement came from the money-movements pipeline. |
| `description` | TEXT NOT NULL | Human-readable one-liner used by the activity feed. |
| `transaction_status` | TEXT NOT NULL DEFAULT 'completed' | `'pending' | 'completed' | 'failed' | 'reversed'`. No CHECK. In practice ~all rows land as `'completed'`. |
| `metadata` | JSONB DEFAULT '{}' | Free-form. Carries downstream FKs, i18n keys, retry counters. |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

Indexes (`015_payout_execution_engine.sql:457-461`): `wallet_id`, `user_id`, `transaction_type`, `created_at`, `(reference_type, reference_id)`.

### 2.3 Domain projections

| Table | Role | FK back to ledger |
|---|---|---|
| `savings_transactions` (`11_live_schema_dump.sql:6980`) | Per-goal deposit / withdrawal / interest log with its own before/after snapshots on `current_balance_cents`. | `wallet_transaction_id UUID` — links the sibling wallet-side row when the movement came from/went to the main wallet. |
| `circle_contributions` (`843-868` + mig 277) | Cycle-level contribution ledger. | `ledger_event_id UUID FK ledger_events`, `pending_intent_id UUID FK pending_intents`. Not linked directly to `wallet_transactions`. |
| `contributions` | Autopay-source contribution table. Uses the `contribution_status` PG enum, extended with `'refunded'` (mig 309). | Not linked. |
| `circle_payouts` (`1202-1222` + mig 278) | Per-cycle payout ledger. | `ledger_event_id`, `pending_intent_id`, `transfer_id text` (Stripe transfer id). |
| `payouts` (`6196`) | Legacy generic payout table. `payout_status` enum. | Not linked. |
| `loan_payments` (`4087-4114`) | Per-payment ledger for advances/loans. | `wallet_transaction_id UUID FK wallet_transactions` — the strongest cross-table link in the codebase. |
| `pool_transactions` (`6275`) | Liquidity-pool movements (capital injection, advance disbursement, fee earned). Has its own CHECK taxonomy. | Not linked. |
| `insurance_pool_transactions` (`3278`) | Insurance-pool CHECK taxonomy. | Not linked. |
| `transactions` (`7728-7767`) | **Legacy generic** transaction table with the fullest CHECK taxonomy. Predates `wallet_transactions`; no live RPC writes to it. | — |

### 2.4 Stripe-side tables (not the wallet ledger, but reconciled against it)

| Table | Role |
|---|---|
| `stripe_payment_intents` (`7396+`) | One row per PI. `purpose` CHECK covers `contribution`, `insurance_premium`, `late_fee`, `loan_repayment`, `wallet_deposit`, `membership_fee`, plus `goal_deposit` added by mig 074. `idempotency_key UNIQUE` (`054:270,280`). |
| `stripe_transfers` (`7520`) | Outbound transfers (payouts to Connect accounts). Purpose CHECK. `idempotency_key UNIQUE`. Status includes `'reversed'`. |
| `stripe_refunds` (`7478`) | Stripe refund objects. Reason CHECK covers `circle_dissolution`, `member_removal`, `overpayment`, `admin_initiated`, and the standard Stripe reasons. |
| `stripe_disputes` (`7364`) | Chargeback tracking. |
| `stripe_webhook_events` (`7539-7560`) | Every incoming webhook, `stripe_event_id UNIQUE`, retry_count. |
| `ledger_events` (mig 276) | Post-processing mirror — one row per confirmed Stripe event that mattered financially. Append-only via `block_ledger_events_mutation` trigger (`276:97-112`). See §7. |
| `pending_intents` (mig 276) | Pre-Stripe anchor — the row written by an EF just before calling Stripe. `client_reference_id UNIQUE`. See §7. |

---

## 3. Transaction taxonomy

The taxonomy is documented but not enforced. All values live as inline comments in the migration that created each table. The DB will accept any string; the discipline is entirely in the RPCs.

### 3.1 `wallet_transactions.transaction_type`

Documented values (`015_payout_execution_engine.sql:143-146`):

- `deposit` — money in from a payment source (Stripe PI succeeded, external transfer).
- `withdrawal` — money out to a payment destination (bank withdrawal).
- `circle_payout` — recipient credit when a cycle payout lands.
- `circle_contribution` — debit when contributing to a circle from the wallet.
- `transfer_in` / `transfer_out` — user-to-user send-money.
- `remittance` — international remittance sub-flow.
- `interest_credit` — savings interest accrual credit.
- `savings_deposit` / `savings_withdrawal` — flows between main wallet and a savings goal.
- `fee` — platform fee deducted.
- `refund` — corrective credit.
- `reserve_allocation` / `reserve_release` — main↔reserved internal moves.
- `commit` / `uncommit` — reserved↔committed internal moves.

Values found in the wild that are NOT in the comment list (drift):
- `contribution_refund` — used by `refund_excess_circle_contribution` (mig 309).
- `wallet_deposit` — used by `wallet_transactions_member_insert` policy comment (mig 303).
- `goal_milestone` — used by the goal-deposit trigger (mig 294).

### 3.2 `direction`

- `credit` — wallet balance goes up.
- `debit` — wallet balance goes down.
- `internal` — reallocation between balance slots on the same wallet (`reserve_allocation`, `commit`); wallet total unchanged.

### 3.3 `balance_type`

Names the wallet slot that moved. `'main'`, `'reserved'`, `'committed'`. A single logical operation (e.g. "commit $50 to circle X") can produce two rows: one `direction='internal', balance_type='main'` debit and one `direction='internal', balance_type='committed'` credit, both with the same `reference_id`.

### 3.4 `transaction_status`

- `pending` — RPC has staged the row but external confirmation hasn't arrived. Rare in practice.
- `completed` — the normal terminal state; the balance move has landed.
- `failed` — the RPC caught an error late; row exists for audit but the balance did NOT move. Also rare.
- `reversed` — historical; documented but not written by any live RPC.

### 3.5 Sibling table taxonomies (with CHECK enforcement)

Not all domain tables are as loose as `wallet_transactions`:

- `circle_contributions.status` — `('pending','paid','late','missed','waived','refunded')` — CHECK enforced (mig 309).
- `circle_payouts.status` — `('scheduled','pending','processing','completed','failed','cancelled')` — CHECK enforced.
- `pool_transactions.type` — `('capital_injection','advance_disbursement','advance_repayment','fee_earned','late_fee_earned','early_repay_discount','default_writeoff','capital_withdrawal','interest_earned')` — CHECK enforced.
- `insurance_pool_transactions.transaction_type` — `('withholding','coverage_payout','distribution','rollover')` — CHECK enforced.
- `stripe_payment_intents.purpose` — 7-value CHECK.
- `stripe_transfers.purpose` — 5-value CHECK.
- `contributions.status` — PG enum `contribution_status`.
- `loan_payments.status` — PG enum `loan_payment_status`.

The pattern: **domain tables that were created after ~mig 050 use enforced CHECKs or enums**; `wallet_transactions` was born in mig 015 without them and was never retro-fitted.

---

## 4. Balances

### 4.1 How the wallet's balance is trusted

The application reads `user_wallets.total_balance_cents` (or `.available_balance_cents`) directly. Neither the client nor the RPCs sum `wallet_transactions` to derive a balance. The ledger is an **audit surface**, not a source of truth.

### 4.2 How the ledger stays self-verifying

Each `wallet_transactions` row carries a `(balance_before_cents, balance_after_cents)` pair. For a given `(wallet_id, balance_type)`, the ledger is **continuous** iff for every consecutive pair of rows ordered by `created_at`:

```
row[N].balance_before_cents == row[N-1].balance_after_cents
```

Nothing in the codebase currently runs that check on a schedule — it's an operational safety net that exists structurally but hasn't been wired to alerting.

### 4.3 Concurrency

Every RPC that mutates a wallet balance locks the row first:

```sql
SELECT id, main_balance_cents, ...
  FROM user_wallets
 WHERE user_id = p_user_id
 FOR UPDATE;
```

Two concurrent movements against the same wallet serialize (second one waits). Two movements against different wallets don't contend. No `pg_advisory_lock`. No `SERIALIZABLE` isolation.

RPCs that use this pattern (non-exhaustive):
- `process_wallet_credit` / `process_wallet_debit` (`015:623`, `015:698`) — the canonical helpers.
- `execute_cycle_payout` (`304:123`).
- `refund_excess_circle_contribution` (`309:87`), `refund_excess_contribution` (`309:180`).
- `process_send_money` (`140:147`).
- `process_advance_repayment` (`147:83`).

### 4.4 Multi-slot arithmetic

An "internal" move (e.g. reserving $50) posts two rows:

| # | direction | balance_type | amount | balance_before | balance_after |
|---|---|---|---|---|---|
| 1 | internal | main | 5000 | 20000 | 15000 |
| 2 | internal | reserved | 5000 | 3000 | 8000 |

Both rows share `reference_type` + `reference_id`. The wallet's `total_balance_cents` is unchanged (`main` down 5000, `reserved` up 5000 → generated total identical). The `available_balance_cents` generated column drops from 17000 to 7000 (main - reserved).

---

## 5. Idempotency

The ledger is protected against duplication at the **Stripe boundary**, not at the wallet row.

### 5.1 What's protected

| Layer | Key | Enforced by |
|---|---|---|
| Stripe outbound (PI, transfer, refund creation) | `idempotency_key` on the corresponding table | `UNIQUE` constraints (`054:280`, `054:366`) — reproducing the same request replays the same intent. |
| Stripe inbound (webhook) | `stripe_event_id` | `stripe_webhook_events.stripe_event_id UNIQUE` (dump `7560`). |
| Ledger event mirror | `stripe_event_id` | `ledger_events.stripe_event_id UNIQUE` (mig 276:63) + append-only mutation trigger. |
| Client-initiated Stripe calls | `client_reference_id` | `pending_intents.client_reference_id UNIQUE` (mig 276:33) — a client picks a UUID before calling the EF; the EF's INSERT of the intent row will 23505 on retry. |

### 5.2 What's not protected

`wallet_transactions` has no idempotency column. An RPC that accidentally runs twice (double-tapped button, retried edge function without the pattern above) will write two rows and double-apply the balance change. The mitigating factors:

- Every mutating RPC takes `FOR UPDATE` on the wallet, so racing double-runs serialize. This prevents split-brain balance corruption, but it does NOT prevent two sequential double-runs from double-applying.
- The RPCs that money-move from external sources (`create-payment-intent`, `create-circle-contribution-intent`, `disburse-liquidity-advance`) rely on the Stripe-side keys above. The double-tap protection is inherited from Stripe, not from the wallet.
- The RPCs that money-move internally (`execute_cycle_payout`, `transfer_to_goal`, `process_send_money`) have their own guard patterns — usually a status check on the source row (e.g. "only process if `cycle.status='pending_payout'`") that flips atomically inside the same transaction. Once flipped, a retry short-circuits.

**Follow-up worth naming.** A future migration could add `idempotency_key TEXT UNIQUE` to `wallet_transactions` and have each producer RPC compute a deterministic key from `(reference_type, reference_id, direction, balance_type)`. That would push double-run protection from "each RPC's private convention" to a schema-level invariant.

---

## 6. Reversals and refunds

Reversals in this system are **new forward rows**, not row-level updates. The ledger is append-only per the RLS policy set (mig 303: `wallet_transactions_member_insert` FOR INSERT, no UPDATE/DELETE policies — service_role only).

### 6.1 The refund shape

When money needs to come back to a user's wallet after they contributed (e.g. circle dissolution, member removal, cycle completion overpayment), the flow is:

1. **Domain trigger fires** — e.g. `refund_excess_circle_contribution` on `circles.status` transitioning to `'completed'` with unallocated contributions (`309:57-149`).
2. **Trigger locks the recipient wallet** with `SELECT ... FOR UPDATE`.
3. **Trigger INSERTs a `wallet_transactions` row** with:
   - `transaction_type = 'contribution_refund'`
   - `direction = 'credit'`
   - `balance_type = 'main'`
   - `reference_type = 'circle_contributions'`, `reference_id = <original_contribution_id>`
   - `amount_cents = <refund amount>`
   - Snapshots taken from the just-locked wallet row.
4. **Trigger UPDATEs `user_wallets.main_balance_cents += amount`.**
5. **Trigger UPDATEs the source `circle_contributions.status = 'refunded'`** (or the `contributions.status` enum equivalent — mig 309 extended both).

Nothing on the original row is changed. The refund is a new forward row that credits the wallet.

### 6.2 Stripe-side refunds

Stripe refunds go through `supabase/functions/process-refunds/index.ts`:

1. EF writes `pending_intents(intent_type='refund', client_reference_id=<UUID>)`.
2. EF calls Stripe `refunds.create()`.
3. Stripe webhook fires `charge.refunded`.
4. `stripe-webhook` EF writes a `ledger_events` row (via `writeLedgerEvent`).
5. Downstream trigger writes the corresponding wallet-side `wallet_transactions` row.

The pairing between the Stripe object and the wallet-side row is by `reference_type` / `reference_id`, not by a direct FK.

### 6.3 Reversals (chargebacks, transfer reversals)

Chargebacks land in `stripe_disputes`. Transfer reversals are tracked in `stripe_transfers.reversed_at` + `.reversal_reason`. Neither currently has a codified wallet-side flow — the operational assumption is that a live dispute triggers manual review and a service-role RPC posts the corrective `wallet_transactions` row.

**Follow-up worth naming.** A `dispute_lost → wallet_debit` automation would close the loop, but requires design on whose balance takes the loss (recipient wallet? platform pool?).

---

## 7. Reconciliation

### 7.1 The two-anchor design

The reconciliation surface separates concerns cleanly:

- **`pending_intents`** — written by the client-facing EF (e.g. `create-circle-contribution-intent`) **before** calling Stripe. Carries `client_reference_id UNIQUE`, `intent_type ('charge'|'transfer'|'refund')`, `amount_cents`, and the domain-object FKs (`circle_id`, `trip_id`, `cycle_id`, `user_id`).
- **`ledger_events`** — written by the `stripe-webhook` EF **after** Stripe confirms. Carries `stripe_event_id UNIQUE`, `event_type`, `amount_cents`, `stripe_fee_cents`, the same domain-object FKs, plus `raw_payload JSONB` for full replay. Append-only via `block_ledger_events_mutation` trigger — updates and deletes hard-fail.

The pairing: a Stripe event confirms an intent → the webhook resolves the intent via `external_reference_id` and writes a ledger row. `pending_intents` that never get a matching `ledger_events` row are the reconciliation exception queue.

### 7.2 The reconciliation query

`get_reconciliation_summary(start_date, end_date)` (mig 276:118-153, refreshed in 279:40-79) returns per-day:

- `total_charges_cents`
- `total_transfers_cents`
- `total_refunds_cents`
- `net_cents`
- `total_stripe_fees_cents`

All figures are computed from `ledger_events`. There is no query that cross-checks `SUM(wallet_transactions where direction='credit') - SUM(direction='debit')` against `SUM(user_wallets.total_balance_cents)`. That check exists structurally (thanks to the snapshot design) but is not wired.

### 7.3 Cron

**No pg_cron job runs reconciliation.** `027_setup_cron_schedules.sql` schedules:

- `daily-interest-accrual` (00:00 UTC)
- `process-autopay` (06:00)
- `send-payment-reminders` (every 4h)
- `update-overdue-obligations` (01:00)
- `process-bank-payouts` (08:00)
- `cleanup-expired-reservations` (02:00)

Reconciliation is on-demand via the RPC above.

**Follow-up worth naming.** A daily EF that (a) runs `get_reconciliation_summary(yesterday, today)`, (b) checks for unmatched `pending_intents` older than N minutes, (c) checks `wallet_transactions` continuity per `(wallet_id, balance_type)`, and (d) posts anomalies to a `reconciliation_alerts` table (or an ops channel) would close the biggest observability gap in the current design.

---

## 8. Security

### 8.1 RLS by table

| Table | SELECT | INSERT | UPDATE / DELETE |
|---|---|---|---|
| `user_wallets` | `user_id = auth.uid()` (mig 015:493) | none (service_role only, via RPC-side wallet auto-provisioning) | `user_id = auth.uid()` (mig 015:496) — narrow enough that only wallet-owner service-role writes matter in practice |
| `wallet_transactions` | `user_id = auth.uid()` (mig 015:499) | `user_id = auth.uid()` (mig 303:36 — narrow "member_insert" policy) | none — service_role only |
| `ledger_events` | service_role only (mig 276:91) | service_role only | UPDATE/DELETE blocked at trigger layer regardless of role |
| `pending_intents` | service_role only (mig 276:56) | service_role only | service_role only |
| `loans` | `user_id = auth.uid()` (mig 022:2147) | none | none — service_role only |
| `loan_payments` | (no user-facing policy — service_role only in practice) | | |

### 8.2 What this means

- **Users can read their own ledger and their own wallet.** They cannot see anyone else's rows. RLS enforces this at the query layer, not the RPC layer.
- **All money-moving writes happen in SECURITY DEFINER RPCs** that run as postgres/service_role. The wallet's daily-life protection is not "the app has good manners" — it's that no `authenticated` role has UPDATE on `user_wallets.main_balance_cents` or INSERT on `wallet_transactions` outside the narrow member-insert policy (which itself gates on `auth.uid() = user_id`).
- **`ledger_events` cannot be mutated by anyone.** The block trigger fires regardless of role. This is the strongest tamper-evident property in the schema.

### 8.3 Auditability

Every mutating RPC posts to `wallet_transactions` before returning. The row's `metadata JSONB` carries the raw context of the decision (which cycle, which payment intent, which trigger). The `ledger_events` row on the Stripe side carries `raw_payload JSONB` — the entire Stripe event. Between the two, any dispute has a fully-replayable trail.

What's NOT captured:
- **Actor.** `wallet_transactions` doesn't carry a "who initiated" field for cases where the movement is admin-initiated. The initiator is implied by `reference_type` / `metadata` but not first-class.
- **Reason for status transitions.** A `wallet_transactions.transaction_status` of `'failed'` doesn't carry a structured reason column — the failure lives in the RPC's error message or in `metadata`.

---

## 9. Stage 2 integration

Stage 2 in this codebase covers **member-to-member movements, community-scoped movements, and lending**. The ledger already handles all three; nothing new is required at the schema layer for typical Stage 2 flows.

### 9.1 Contributions

Cycle contribution from wallet:

1. Client calls `process_circle_contribution` (or the autopay equivalent in `172_circle_autopay_execution.sql`).
2. RPC locks the contributor's wallet, verifies `available_balance_cents ≥ amount`, and posts `wallet_transactions(transaction_type='circle_contribution', direction='debit', balance_type='main', reference_type='circle_contributions', reference_id=<contribution_id>)`.
3. RPC updates `circle_contributions.status='paid'` (or `'late'`) and `user_wallets.main_balance_cents -= amount`.

Autopay adds a reserve step:

1. On cycle-open, `reserve_contribution` posts an internal move `main → reserved` (two rows sharing `reference_id`).
2. On due date, autopay debits from `reserved` (`reserve_release`) and posts the actual contribution.

### 9.2 Lending (advances / loans)

Disbursement:

1. `disburse-liquidity-advance` EF writes `pending_intents(intent_type='transfer')`.
2. Advance is disbursed via Stripe transfer OR via a wallet credit (per the `disbursement_method` on `liquidity_advances`).
3. If wallet: `process_wallet_credit(transaction_type='loan_disbursement', reference_type='loans', reference_id=<loan.id>)`.

Repayment:

1. `process_advance_repayment` (mig 147) locks the wallet, debits main, posts `wallet_transactions(transaction_type='loan_repayment')`.
2. RPC also writes a `loan_payments` row with `wallet_transaction_id` FK pointing back — the single strongest cross-table link in the codebase.

### 9.3 Community-scoped movements

There is no per-community wallet or per-community balance today. Community-scoped movements (e.g. community-pool contributions in a hypothetical future feature) would need either:

- A new table (`community_wallets`) mirroring `user_wallets`.
- OR extending `user_wallets` with a nullable `community_id` column and revisiting the "one wallet per user" invariant.

Neither is implemented. Any future Stage 2 feature that moves money on behalf of a community rather than a user would need to make this decision explicitly.

### 9.4 Savings

`transfer_to_goal` (mig 301) is the canonical example of the ledger crossing between `wallet_transactions` and `savings_transactions`. It posts two rows atomically (one debit on the wallet side, one deposit on the savings side) and links them via `savings_transactions.wallet_transaction_id`. Interest accrual (`daily-interest-accrual` cron) posts credits on the savings side only — interest doesn't flow back to the main wallet unless the user withdraws.

---

## 10. Error handling

### 10.1 In-RPC failures

RPCs that mutate the wallet use the same defensive pattern:

```sql
BEGIN
  -- validate inputs
  IF <precondition> THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = ...;
  -- lock the wallet
  SELECT ... FROM user_wallets WHERE user_id = p_user_id FOR UPDATE;
  -- post the ledger row FIRST
  INSERT INTO wallet_transactions (...) VALUES (...);
  -- then update the balance
  UPDATE user_wallets SET main_balance_cents = ...;
  RETURN <result>;
EXCEPTION WHEN OTHERS THEN
  -- structured error return — transaction rolls back automatically
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
```

Rollback on exception is automatic — the RPC is one transaction, so a partial `INSERT` + failed `UPDATE` cannot leave the wallet out of sync with the ledger.

### 10.2 Edge-function failures

EFs (`create-payment-intent`, `disburse-liquidity-advance`, etc.) that call Stripe follow the pattern:

1. Write `pending_intents` with a fresh `client_reference_id`.
2. Call Stripe.
3. Return the Stripe response.

If step 2 fails, the `pending_intents` row survives without a matching `ledger_events`. It becomes reconciliation-exception material (see §7). The EF does not retry — the client is expected to retry with a fresh `client_reference_id`, or the reconciliation process is expected to notice and resolve.

If step 1 succeeds but step 3 (return path) fails, the client doesn't know whether the Stripe call landed. The `client_reference_id UNIQUE` protects against a client-side retry accidentally creating two intents — the second call will 23505 on the INSERT.

### 10.3 Webhook processing failures

`stripe-webhook` EF is idempotent by `stripe_event_id UNIQUE` — reprocessing the same event is a no-op at the `ledger_events` write. Downstream side effects (updating `circle_payouts.status`, writing recipient `wallet_transactions` row for activity-feed display) can double-fire if not additionally guarded. In practice, most side effects are also guarded on status transitions ("only credit if status is not already `completed`").

### 10.4 Retry infrastructure

- **`webhook_deliveries`** (referenced by `supabase/functions/webhook-retry-processor/index.ts`) — outbound webhook retry queue. Backoff `{2:120s, 3:480s, 4:1920s, 5:7200s}`.
- **`auto_retry_config`** + **`auto_retry_history`** (dump `732-765`) — per-circle autopay retry state for failed contribution debits.
- **No generic ledger-write retry queue.** A failed `wallet_transactions` write inside an RPC rolls back the whole RPC; there is no dead-letter row to inspect afterwards.

---

## 11. Follow-ups (design-level)

Named in one place so future work has a checklist:

1. **Enforce the taxonomy.** Add CHECK constraints (or PG enums) on `wallet_transactions.transaction_type`, `.direction`, `.balance_type`, `.transaction_status` matching the documented value sets. Backfill any drift values found in the wild before landing the CHECK.
2. **Add wallet-side idempotency.** `wallet_transactions.idempotency_key TEXT UNIQUE` + a producer discipline that derives the key from `(reference_type, reference_id, direction, balance_type)`. Would move double-run protection from "each RPC's private convention" to a schema-level invariant.
3. **Wire reconciliation to cron.** Daily EF that runs `get_reconciliation_summary`, checks for stale `pending_intents`, checks continuity of `(balance_before, balance_after)` snapshots on `wallet_transactions`, and posts anomalies to an ops surface.
4. **First-class initiator on `wallet_transactions`.** Add `initiated_by UUID` + `initiator_kind TEXT` so admin-initiated movements are queryable without JSONB spelunking.
5. **Codified chargeback → wallet-debit path.** Currently manual; a lost-dispute automation would close the loop.
6. **Community-wallet decision.** If any Stage 2 feature moves money on behalf of a community rather than a user, decide before writing code whether to add `community_wallets` or extend `user_wallets` with a nullable `community_id`.
7. **`transactions` table cleanup.** The legacy generic `transactions` table (dump `7728-7767`) has the fullest CHECK taxonomy in the schema but no live writers. Either resurrect as an alternative canonical ledger or drop after confirming zero readers.

---

## Appendix A — Life of a cycle payout

Concrete trace of the most complex ledger flow, showing every row that changes:

1. **Cron opens the cycle.** `cycle-progression-cron` marks the cycle `payout_pending`.
2. **Payout method resolved.** Recipient's `default_payout_destination` determines whether the payout goes to their TandaXn wallet (`'wallet'`) or via Stripe transfer to their Connect account (`'bank'`).

**If wallet:**

3. `execute_cycle_payout(p_cycle_id)` (mig 304, revised 310/312/313) runs as SECURITY DEFINER.
4. RPC locks the recipient's `user_wallets` row.
5. INSERT into `wallet_transactions`:
   - `transaction_type='circle_payout'`, `direction='credit'`, `balance_type='main'`
   - `reference_type='circle_payouts'`, `reference_id=<payout_row_id>`
   - Snapshots taken from just-locked wallet.
6. UPDATE `user_wallets.main_balance_cents += amount`, `total_payouts_received_cents += amount`.
7. UPDATE `circle_payouts.status='completed'`, `actual_date=now()`.
8. UPDATE `circles.current_cycle = current_cycle + 1` (or mark `completed` if last cycle).

**If bank (Stripe transfer):**

3. EF `process-circle-payout` writes `pending_intents(intent_type='transfer', client_reference_id=<UUID>, amount_cents, circle_id, cycle_id, user_id=<recipient>)`.
4. EF calls Stripe `transfers.create()` with the pending_intent id as idempotency key.
5. Stripe returns the transfer object. `stripe_transfers` row is written by the webhook, not the EF.
6. Later, Stripe webhook `transfer.paid` fires.
7. `stripe-webhook` EF writes `ledger_events(stripe_event_id, event_type='transfer.paid', amount_cents, stripe_fee_cents)`.
8. Same webhook updates `circle_payouts.status='completed'`.
9. Same webhook posts a **display-only** `wallet_transactions` row for the recipient (`stripe-webhook/index.ts:874-928`) with `balance_before_cents === balance_after_cents` (bank payout doesn't change the app wallet balance).

The `balance_before === balance_after` on the display-only row is a deliberate signal: this row exists so the recipient's Home Recent Activity shows "You received $X" — the money is real, it just isn't in the TandaXn wallet.

---

## Appendix B — Life of a wallet deposit

Trace of the simplest inbound-money flow:

1. Client (mobile app) calls `create-payment-intent` EF with `purpose='wallet_deposit'`, `amount_cents`, and a fresh `idempotency_key = crypto.randomUUID()`.
2. EF inserts `stripe_payment_intents(idempotency_key, status='requires_payment_method', purpose='wallet_deposit', ...)`.
3. EF calls Stripe `paymentIntents.create()` with the idempotency key.
4. EF returns `clientSecret` to client.
5. Client confirms the PI via Stripe.js.
6. Stripe fires `payment_intent.succeeded` webhook.
7. `stripe-webhook` EF's `writeLedgerEvent` inserts `ledger_events(stripe_event_id, event_type='payment_intent.succeeded', amount_cents, stripe_fee_cents, user_id, external_reference_id=<pi_id>)`.
8. Same webhook updates `stripe_payment_intents.status='succeeded'`.
9. Same webhook (based on `metadata.purpose`) calls the credit RPC. For `wallet_deposit`: `process_wallet_credit(p_user_id, p_amount_cents, p_transaction_type='deposit', p_reference_type='stripe_payment_intents', p_reference_id=<pi_id>, p_description='Wallet deposit', p_metadata={...})`.
10. `process_wallet_credit` locks the wallet, inserts `wallet_transactions`, updates `user_wallets.main_balance_cents`.

At no point does the client write anything ledger-adjacent — every write flows through the webhook. Double-tap protection comes from the Stripe idempotency key (step 2/3) and the `stripe_event_id UNIQUE` on the webhook side (step 7).
