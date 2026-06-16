# Audit trail

_Last updated 2026-06-13. Schema landed via migration 153._

A single immutable journal — `public.audit_logs` — captures INSERT /
UPDATE / DELETE on every compliance-relevant table. Platform admins
read it; nobody writes through the client, ever.

## Two screens, two scopes — do not conflate

| Screen | Scope | Reads | Audience |
|---|---|---|---|
| `screens/AuditTrailScreen.tsx` | One circle | (today: mock array; rewrite pending) | Circle admin |
| `screens/PlatformAuditTrailScreen.tsx` | Whole platform | `get_audit_logs` / `export_audit_logs` RPC over `audit_logs` | Platform admin |

The per-circle "Audit Trail" is still the legacy mock UI. It is the
**circle activity log**, not a compliance audit. Until that screen is
rewritten against real circle tables, keep the two scopes mentally
distinct.

## Data model

### `audit_logs`
```
id              uuid primary key
table_name      text                -- source table
record_id       uuid                -- pk on the source row
action          text CHECK INSERT|UPDATE|DELETE
old_data        jsonb               -- pre-change row, null on INSERT
new_data        jsonb               -- post-change row, null on DELETE
changed_by      uuid → auth.users   -- via auth.uid() inside trigger
changed_at      timestamptz default now()
ip_address      inet                -- from request.headers if available
user_agent      text                -- ditto
retention_days  int default 2555    -- per-row purge horizon
source          text                -- backfill marker; null for live rows
```

### Indexes
```
(table_name, record_id, changed_at DESC)   -- "what happened to this row?"
(changed_by, changed_at DESC)              -- "what did this user do?"
(changed_at)                               -- retention sweep
(action)                                   -- INSERT/UPDATE/DELETE filter
```

### Immutability posture
* `audit_logs_admin_select` policy — admins SELECT only.
* Belt-and-braces: `REVOKE INSERT, UPDATE, DELETE, TRUNCATE … FROM
  PUBLIC, anon, authenticated`.
* SECURITY DEFINER trigger and cleanup function bypass the REVOKE
  (definer = postgres). Triggers can write; clients cannot.

## Trigger function

`public.log_audit_event()` — one function, attached to every audited
table via `AFTER INSERT OR UPDATE OR DELETE … FOR EACH ROW`.
SECURITY DEFINER, pinned `search_path`.

It:
1. Reads `OLD` / `NEW` based on `TG_OP` and serialises them with
   `to_jsonb()`.
2. Calls `auth.uid()` for the actor. Returns NULL when no JWT is on
   the session (cron, service-role triggers).
3. Pulls `user-agent` and `x-forwarded-for` from
   `current_setting('request.headers', true)` when PostgREST set them.
4. Maps the source `TG_TABLE_NAME` to a retention horizon:

   | Source table | `retention_days` |
   |---|---|
   | `kyc_verifications`, `user_wallets`, `money_transfers`, `contributions`, `payouts`, `moderation_actions` | 3650 (10 years) |
   | Everything else | 2555 (7 years) |

5. INSERTs one row into `audit_logs`.

### Tables watched
`profiles`, `kyc_verifications`, `user_wallets`, `money_transfers`,
`contributions`, `payouts`, `dispute_cases`, `mediation_cases`,
`moderation_actions`, `circles`, `circle_members`, `feed_posts`,
`community_events`. (13 total — verify against migration 153 if you
expect another.)

Each table has a uniformly-named `audit_trigger` so a bulk lookup by
trigger name surfaces the whole set.

## RPCs

### `get_audit_logs(p_filters jsonb, p_limit int, p_offset int)`
Returns `{rows: [...], total_count: int}`. Filter keys (all optional):
`table_name`, `action`, `changed_by`, `record_id`, `date_from`,
`date_to`. Admin gate via `public.is_admin()`. Pagination is
offset-based (50/page on the screen).

### `export_audit_logs(p_filters jsonb)`
Returns CSV text. Same filter shape. Hard-capped at 50000 rows so a
runaway filter can't OOM the database. The admin screen turns the
text into a Blob and triggers a browser download on web; on native
it logs the row count (deeper share-sheet wiring is out of scope).

### `list_distinct_audit_actors()`
Returns `(user_id, email, last_seen)` for up to 200 distinct actors
in `audit_logs`. Powers the actor picker on the admin screen.

### `cleanup_old_audit_logs()`
Deletes rows whose `changed_at + retention_days` is in the past.
Service-role only. Scheduled by the same migration via
`cron.schedule('cleanup_audit_logs_nightly', '0 3 * * *', …)` —
best-effort: if `pg_cron` isn't available the migration emits a NOTICE
and you can wire a Supabase Scheduler or Edge Function instead.

## Backfill

The migration ends with two `INSERT … SELECT` blocks that map the
existing `moderation_actions` rows and any `payout_order_audit_log`
rows into `audit_logs` with `source='backfill:<table>'`. Future rows
on those tables flow in automatically via the new triggers, so no
ongoing dual-write.

## Frontend

### `screens/PlatformAuditTrailScreen.tsx`
Admin-gated via `useIsAdmin()`. Filters (table / action / actor /
record id / date range), paged list (50/page, "Load more"), detail
modal that diffs `old_data` vs `new_data` and pretty-prints the raw
JSON. Export-CSV button on web; native shows a row count toast.

### Entry
`screens/ProfileScreen.tsx` → "Admin tools" section → "Audit Trail".
The section itself is gated by `useIsAdmin()`, so non-admins never
see the row.

## Open follow-ups (not P0)

* Rewrite the per-circle `AuditTrailScreen.tsx` to read real
  contributions / payouts / dispute_cases / circle_members joins
  rather than the mock array.
* Native share-sheet for the CSV export (expo-sharing + temp file).
* Real-time subscription on `audit_logs` so the admin screen
  tail-follows new entries.
* Saved filter presets ("last 24h", "all KYC changes", etc.).
* Anomaly banner — surface "N failures from one actor in M minutes".
* Verify the `cleanup_audit_logs_nightly` cron is actually running
  (the migration tries to schedule it but pg_cron availability is
  project-specific).
* Decide whether `moderation_actions` keeps its own table now that
  every row is mirrored into `audit_logs`. It still has admin-specific
  columns (`duration`, `source_report_id`) that don't compress into
  the generic `new_data` shape, so the dual-store is justified — but
  noting it for future cleanup.
