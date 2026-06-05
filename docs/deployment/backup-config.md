# Backup configuration and restore runbook

Supabase's managed backups are the first line of recovery for the
`fjqdkyjkwqeoafwvnjgv` project. This doc records the desired
configuration, how to verify it, and the path to restore.

## Recommended configuration

| Setting | Value | Why |
| --- | --- | --- |
| Daily logical backup | enabled (default) | 7-day rolling, every plan |
| Point-in-Time Recovery (PITR) | enabled | restore to any timestamp in window |
| PITR retention | 7 days minimum, 14 days preferred | covers "noticed Monday what broke Friday" |
| Backup region | same as project (us-east-1) | recovery latency, no transfer fees |

PITR is a Pro-plan add-on. On Free only daily snapshots exist;
escalate the plan before relying on PITR.

## Verify PITR is enabled

1. `https://supabase.com/dashboard/project/fjqdkyjkwqeoafwvnjgv` -> **Database -> Backups**.
2. Confirm:
   - "Point in time recovery" status **Enabled**.
   - Earliest restorable timestamp >= today minus the retention window.
   - Daily backups list at least 7 **Completed** entries.

If **Disabled**, enable from the same panel; WAL streaming takes a
few hours before the first restore point becomes available.

## Restore runbook

### Clone-first (preferred for incident triage)

1. **Database -> Backups -> Restore**, pick a daily backup or PITR
   timestamp, choose **Restore to a new project**. Live project
   untouched.
2. Connect to the clone via the SQL editor and confirm the restored
   state has the rows you expect.
3. If the clone looks correct, dump the affected tables/rows and
   replay against prod inside a transaction.

### Full in-place restore (last resort)

When corruption is too broad for targeted replay:

1. Quiesce writers (`cron.alter_job(active:=false)` for high-traffic
   jobs; consider app-side maintenance mode).
2. **Database -> Backups -> Restore -> Restore in place** at the
   chosen timestamp.
3. Re-enable cron jobs, verify the migration head matches expected.
4. Replay anything between the restore point and the incident from
   audit tables (`ai_decisions`, `cron_job_logs`) where possible.

## CLI: manual / pre-migration dumps

```
# Schema-only
SUPABASE_ACCESS_TOKEN=<pat> supabase db dump \
  --project-ref fjqdkyjkwqeoafwvnjgv \
  --schema public -f dumps/pre-<mig>-schema.sql

# Data-only
SUPABASE_ACCESS_TOKEN=<pat> supabase db dump \
  --project-ref fjqdkyjkwqeoafwvnjgv \
  --data-only -f dumps/pre-<mig>-data.sql
```

Keep dumps under `dumps/` (gitignored) -- they contain row-level data.

## Testing cadence

Backups that aren't periodically restored are aspirational. Quarterly:
restore the latest daily to a clone, log in as a test user, hit one
representative query, tear the clone down. Record wall-clock + any
surprises in `docs/deployment/restore-drills.md` (create on first run).
If a drill fails or takes materially longer than expected, treat as P1.
