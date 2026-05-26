# 29 — Full Migration Drift Audit (Pending, Stage-4 Prep)

**Status:** Pending. Scheduled before Stage 4 payout work begins.
**Surfaced by:** `27_join_gate_revert_decision.md` (071 incident: live change but no registry row, until manually backfilled).
**Effort estimate:** 30–60 minutes once started.
**Risk level:** Read-only diagnostic. Cannot affect prod.

---

## Why this is needed

The 071 incident on 2026-05-26 proved that the deploy ritual in this repo can — and has — skipped the `schema_migrations` registration step while still applying the DDL. We caught and fixed 071, but **we have no evidence the same thing didn't happen for an earlier migration that nobody noticed.**

Per `docs/audit/01_applied_migrations.md` (dated 2026-05-18), only 31 of 98 on-disk migrations had registry rows at that time. The gap has grown since (069, 070 applied since; 071 applied today). There are two ways that gap is composed today:

1. **Authored but never applied** — file on disk, no registry row, no DDL effect in prod. *(The harmless case — equivalent to a forgotten branch.)*
2. **Applied but not registered** — file on disk, no registry row, DDL effect IS in prod. *(The dangerous case — the registry lies about what's been done.)*

Before Stage 4 introduces any payout machinery, we should know which migrations are in category 2.

---

## What the audit will produce

A single doc — `30_migration_drift_audit_results.md` or similar — listing every migration version `001..070` with:

| version | filename on disk? | in `schema_migrations`? | DDL effect verified in live? | classification |
|---|---|---|---|---|

Classifications:
- `applied + registered + effect-present` — clean
- `applied + registered + effect-absent` — registry says yes, DDL was reverted later or never took
- `applied-but-unregistered` — **dangerous**; treat like 071 was
- `authored-but-unapplied` — file on disk, never ran; either dead code or a TODO

The first three need follow-up. The fourth informs `02_migration_gap.md`.

---

## How to run

1. **List on-disk migrations:**
   ```bash
   ls supabase/migrations/*.sql | sed 's|.*/||' | sort
   ```

2. **List registered migrations:**
   ```sql
   SELECT version, name, statements IS NOT NULL AS has_statements
   FROM supabase_migrations.schema_migrations
   ORDER BY version;
   ```
   Run via `python /c/Users/franck/sql_run.py < query.sql`.

3. **For each version that's registered, sample-verify a DDL effect.**
   Strategy: read the migration file to identify its primary effect (a function `CREATE OR REPLACE`, a `CREATE TABLE`, an `ALTER TABLE ADD COLUMN`, an `INSERT` into a config table, etc.). Then write a targeted query against `pg_proc`, `information_schema.tables`, `information_schema.columns`, or the affected data, and confirm. The query template in `docs/audit/27_migration_069_070_drift_check.sql` is the pattern.

4. **For each version that's on-disk but not registered, check if the DDL effect is present anyway** — this is the category-2 hunt. Same targeted-query approach. A `YES, DDL present` answer here means 071-style drift.

5. **Record results in the new audit doc.** For any drift found, write a backfill INSERT (mirroring what was done for 071) and document the fix.

---

## What this audit does NOT do

- It does not re-apply or re-run any migration. Read-only throughout.
- It does not modify `schema_migrations` rows beyond the explicit backfill INSERTs flagged in the results, and each one is documented before execution.
- It does not address the underlying tracking gap going forward — that's handled by the self-registration convention now documented in `CLAUDE.md` (Migration conventions section). This audit closes the **historical** gap; the convention prevents the **future** gap.

---

## Why it's not done tonight

Two reasons:
1. **Effort timing.** 30–60 min of focused work; tonight was already a long session.
2. **Not Stage-4-blocking yet.** As long as the convention is in place going forward, Stage 4 work can proceed against a known-clean baseline of "everything from 071 onward is registered correctly." The audit closes the historical tail, which can land any time before the payout RPC is first written.

If during Stage 4 work any anomaly appears that smells like "did the DDL really apply?" — accelerate this audit immediately.

---

## Links

- `docs/audit/27_join_gate_revert_decision.md` — the lesson that motivated this
- `docs/audit/27_migration_069_070_drift_check.sql` — the query template
- `docs/audit/01_applied_migrations.md` — the stale 2026-05-18 baseline; update as part of this audit
- `docs/audit/02_migration_gap.md` — also touches the same data; reconcile during this audit
- `CLAUDE.md` "Migration conventions" — the going-forward fix
