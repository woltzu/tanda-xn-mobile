# Audit Trail P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migrations 163–165 on top of
the audit-trail surface from migration 153._

P2 layers three automation loops on the existing audit pipe: **scheduled
retention** that logs every cleanup pass, **anomaly detection** that
surfaces pattern bursts the cron operator wouldn't catch by reading rows
linearly, and a **background CSV export** queue so admins can pull
multi-hundred-thousand-row slices without a screen-blocking download.

## Data model (migrations 163 / 164 / 165)

| Object | Source | Purpose |
|---|---|---|
| `audit_cleanup_log(id, ran_at, rows_deleted, duration_ms, error_message)` | mig 163 | One row per `cleanup_old_audit_logs()` invocation. Admin-readable. Lets the operator see "did the nightly cron run, did it delete anything, did it error" without crawling PG logs. |
| `audit_anomalies(id, detected_at, anomaly_type, severity, description, related_audit_ids UUID[], signature, reviewed_at, reviewed_by, reviewed_note)` with `UNIQUE(anomaly_type, signature)` | mig 163 | Detected-anomaly surface. The `detect-audit-anomalies` daily run upserts with `ignoreDuplicates`; the natural-key UNIQUE handles re-detection across days without growing the table. |
| `audit_export_jobs(id, user_id, filters, status, total_rows, file_path, error_message, created_at, started_at, completed_at)` | mig 163 | Async CSV export queue. Own-row + admin-all RLS. Status pipeline: `queued → running → completed | failed`. |
| `cleanup_old_audit_logs() → INTEGER` (wrapped) | mig 163 | Same return contract as mig 153 — still deletes expired rows. Now also stamps an `audit_cleanup_log` row and re-raises on failure so the pg_cron job surface still sees the error. |
| `create_audit_export_job(p_filters) → UUID` | mig 163 | Admin-only enqueue path (callable from the screen). Inserts into `audit_export_jobs`. |
| `get_audit_weekly_summary(p_days INT DEFAULT 7) → JSONB` | mig 164 | Service-role-only digest aggregation. Single round-trip → totals / anomalies / top-5 users / top-5 tables / action_split. Pushes all GROUP BY work down to SQL — important once triggers fully populate `audit_logs` (no client-side scan of 100k+ rows). |
| `claim_audit_export_job() → audit_export_jobs` | mig 165 | Worker-only atomic pop. `FOR UPDATE SKIP LOCKED` makes two parallel workers safe — neither can claim the same row. |
| `export_audit_logs_for_job(p_job_id UUID) → TEXT` | mig 165 | Service-role twin of the inline `export_audit_logs(p_filters)` RPC. Re-validates the job owner is still admin at build time (defence in depth — they were admin at job-creation time per `create_audit_export_job`'s gate, but might have been revoked since). 200 k row cap (4× the inline 50 k path). |
| `audit-exports` Storage bucket (private) + `audit_exports_admin_select` policy on `storage.objects` | mig 165 | Worker writes CSVs here under `<job_id>.csv`; admins read via signed URL. Service-role bypasses RLS for INSERT/UPDATE/DELETE. anon path is closed. |

### Why a daily Edge Function for anomalies, not a trigger

The moderation P2 review went the opposite way (BEFORE INSERT trigger
over Edge Function) because reports are scanned one at a time against
keywords. Audit anomalies are different: they're aggregate over a time
window — "5+ failed logins from the same IP in 10 minutes". A trigger
can't see the window; it only sees one row at insert time. So an
out-of-band scan is the only shape that works for this rule family.

The trade-off is detection latency (up to one day) vs trigger
overhead per row. Audit volume is dominated by writes that don't
need real-time anomaly check, so daily is the right cadence.

## Three detection rules + their data sources

| Rule | Source | Bucket | Threshold | Severity | Live data today? |
|---|---|---|---|---|---|
| `failed_login_burst` | `auth.audit_log_entries` (via `.schema('auth')`) | 10 min × IP | > 5 attempts | high | **No** — table is empty. GoTrue audit logging is disabled for this project (CLAUDE.md flags this as a launch-blocker). Rule will start producing the day Pro-tier audit logging is enabled — no code change. |
| `profile_churn` | `audit_logs WHERE table_name='profiles' AND action='UPDATE'` | 1 h × user_id | > 10 changes | medium | **Yes** — the `audit_trigger` on `profiles` is live from mig 153. |
| `admin_ban_burst` | `moderation_actions WHERE action IN (ban,suspend,auto_ban,auto_suspend)` | 1 day × admin_user_id | > 3 actions | high | **Yes** — `moderation_actions` is live from mig 152; CHECK constraint extended in mig 162 to admit the auto_* values. |

`failed_login_burst` is wrapped in its own try/catch in the Edge
Function — if the auth-schema query fails for any reason (RLS, missing
table, permission), it logs a warning and the other two rules still
run.

Signatures (cron-stable buckets that key the UNIQUE dedup):

- `failed_login_burst` → `ip|YYYY-MM-DDTHH:M0Z`
- `profile_churn` → `user_id|YYYY-MM-DDTHH:00Z`
- `admin_ban_burst` → `admin_id|YYYY-MM-DD`

`related_audit_ids` carries forensic links: for `profile_churn` it's
the `audit_logs.id` values inside the bucket; for `admin_ban_burst`
the detector back-joins `audit_logs` on
`(table_name='moderation_actions', record_id IN <claimed moderation_actions.id>)`
so the screen can link straight to the underlying entries.

## Edge Functions

| Function | Cadence | Job |
|---|---|---|
| `detect-audit-anomalies` | daily ~07:20 UTC | Runs the three rules above. Upserts `audit_anomalies` with `ignoreDuplicates: true` on `(anomaly_type, signature)`. For freshly-inserted `severity='high'` rows, fans out `admin_alert` notifications to every active `admin_users` row — 48 h dupe guard via `notifications.data.anomaly_signature` contains-lookup (same pattern as `detect-report-spikes`). |
| `send-audit-summary` | weekly Monday 08:10 UTC | One `rpc('get_audit_weekly_summary', {p_days: 7})` round-trip → totals / anomalies / top-N / action split. One `admin_audit_digest` notification per active admin. Body is a human one-liner; `data` carries the full JSONB so the screen can render rich content. 6-day dupe guard. |
| `process-audit-export` | every 5 min via pg_cron (recommended) | Drains up to 5 jobs per invocation. Per job: `claim_audit_export_job` → `export_audit_logs_for_job` → upload `<job_id>.csv` to `audit-exports` bucket → mark `completed` → fan out `admin_audit_export_ready` notification. Per-job try/catch; one failure does not abort the batch. |

All three are service-role functions. Deploy:

```
supabase functions deploy detect-audit-anomalies --no-verify-jwt
supabase functions deploy send-audit-summary    --no-verify-jwt
supabase functions deploy process-audit-export  --no-verify-jwt
```

Scheduling: daily ~07:20 UTC for the detector, weekly Monday 08:10 UTC
for the digest, every 5 minutes (or HTTP-triggered from
`create_audit_export_job`) for the worker.

## Frontend — `PlatformAuditTrailScreen` (three tabs)

The pre-existing single-body layout is now wrapped in a tab strip. Tab
state is local; the screen owns no other navigation state.

| Tab | Hook | Notes |
|---|---|---|
| **Logs** | (unchanged) | Same paged list + filter sheet + detail modal as Phase 1 from migration 153. The header **Export** button is the only behaviour change: it now enqueues a background job and switches to Exports — no more inline blob download. |
| **Anomalies** | `useAuditAnomalies` | Severity pill + type label + description + related-audit count + **Mark reviewed** button. Sorted unreviewed-first → severity (high→low) → recency. Unreviewed count drives an amber tab badge. |
| **Exports** | `useAuditExports` | Status pill + filter summary + row count when complete. **Download CSV** opens a 5-minute signed URL via `Linking.openURL` (works on web and native). Realtime path is primary (subscribes to `notifications` INSERTs filtered to `user_id=eq.<me>`); 5 s polling is the fallback that auto-stops once the queue is drained. Session-scoped `newReadyCount` drives a teal tab badge, cleared on tap. |

### Hook design notes

- **`useAuditAnomalies`** — `markReviewed(id, note?)` does a direct
  PostgREST UPDATE; the `aa_admin_update` policy in mig 163 gates
  client write. Sort happens client-side because PostgREST has no
  multi-key sort with case-aware tie-breaking; the result set is
  capped at 500 anyway.
- **`useAuditExports`** —
  - Polling effect depends on the `jobs` array: it kicks in when
    any element is `queued`/`running` and exits via cleanup once
    every job is terminal. No persistent timer.
  - Realtime subscription depends on `jobs.length` (not the userId
    directly) because the auth-user fetch is async and we need to
    wire the channel after `userIdRef.current` populates. The
    `jobs.length` re-trigger is a deliberate signal.
  - `getDownloadUrl` returns a tuple `{url, error}` instead of
    throwing — the screen disambiguates download-vs-open failures.

## i18n + docs

- 30 new keys under `platform_audit_p2.*`. EN/FR parity at
  **5405 leaf keys each**.

## Operational checklist before launch

These are the things that must be true for the P2 surface to work as
designed in production:

1. **GoTrue audit logging enabled** — `auth.audit_log_entries` is empty
   today. Without it, `failed_login_burst` produces zero anomalies even
   if attempts are happening. Required for the launch-readiness flag in
   CLAUDE.md's Tier 4 backlog regardless.
2. **`process-audit-export` schedule** — without it, `audit_export_jobs`
   sits in `queued` forever and the screen polls indefinitely. Pick
   either pg_cron every 5 min or HTTP trigger from
   `create_audit_export_job` (cron is simpler).
3. **`audit_trigger` on tables we care about** — mig 153 wired
   triggers on 13 tables; new high-write tables added later won't show
   in the audit trail unless the trigger is also added to them. The
   `top_tables` rollup in `get_audit_weekly_summary` makes drift
   visible.

## Open follow-ups (not P2)

- **`audit_logs.changed_by` is NULL on every existing row.** The
  `audit_trigger` from mig 153 doesn't capture the session user. Until
  it does, the `top_users` field in the weekly digest will always be
  empty and the actor picker in the Logs tab is starved of data.
  Fix: extend the trigger to write `NEW.changed_by = auth.uid()`
  (or read from a `SET LOCAL audit.session_user_id` GUC if SECURITY
  DEFINER call paths obscure `auth.uid()`).
- **`source` column unset.** Same trigger limitation — `source` is
  always NULL today. Could be populated by tagging the call site
  (`'trigger'` for trigger writes, `'admin_api'` for the moderation
  RPCs, etc.).
- **No paged worker.** `export_audit_logs_for_job` returns the full
  CSV as a single TEXT blob (200 k cap). At very large slices, the
  worker has to materialise the whole string in memory before upload.
  A streaming variant would chunk via offset/limit and append to the
  Storage object. Premature for current volume.
- **No notifications-table cleanup for ready notifications.** Each
  export creates a notification row; over time the `notifications`
  table accumulates indefinitely. There's a `cleanup_old_data()`
  cron already (per CLAUDE.md) but verify it covers
  `admin_audit_export_ready`.
- **Anomaly review note is write-once via screen.** No edit-or-clear
  affordance in the UI; the `reviewed_note` column is empty in the
  current happy path (the screen passes `undefined`). Add an
  optional reason input next to the Mark-reviewed button if admins
  need to leave a trail.
- **`Linking.openURL` on web opens in a new tab.** That's fine for
  CSV download (browser saves on Content-Disposition), but if the
  bucket Content-Type is wrong it may render inline. Confirm
  `text/csv` is preserved through the signed URL path; if not, fall
  back to the blob-download trick from the old inline export for the
  web platform specifically.
