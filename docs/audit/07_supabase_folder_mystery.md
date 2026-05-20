# Mystery of the Other Supabase Folder

Comparing two `supabase` directories:

- **A (active)**: `tanda-xn-mobile/supabase/` — used by the running app
- **B (mystery)**: `OneDrive/Desktop/TandaXn/Supabase/` (note capital S) — purpose unknown until now

## Verdict

**B is an abandoned earlier-iteration backend scaffold.** Same Supabase project, completely different code, last touched January 28 2026 (~4 months stale). It contains migrations and edge functions that were **never applied to the live database**.

Recommendation: **archive or delete B**, after confirming nothing imports from it. Keep the `Docs/` subfolder if it has useful API notes you want to preserve.

## Evidence

### Project pointer

| Location | `supabase/.temp/project-ref` |
|----------|-------------------------------|
| A — `tanda-xn-mobile/supabase/.temp/project-ref` | `fjqdkyjkwqeoafwvnjgv` |
| B — `Supabase/supabase/.temp/project-ref` | `fjqdkyjkwqeoafwvnjgv` |
| Same project? | ✅ Yes |

They point to the same Supabase project (`fjqdkyjkwqeoafwvnjgv` = TandaXn-Dev). So B is NOT for a different project — it's a parallel attempt at the same project.

### Migration files

- **A** has **98 `.sql` files** in `migrations/`
- **B** has **9 `.sql` files** in `migrations/` (top-level, not under `supabase/`)

Filenames in B:

| Filename | Size | mtime |
|----------|------|-------|
| `003_loan_payment_functions.sql` | 8,025 B | 2026-01-27 08:43 |
| `004_contribution_functions.sql` | 12,504 B | 2026-01-27 08:58 |
| `005_notification_system.sql` | 20,635 B | 2026-01-27 11:11 |
| `006_notification_cron.sql` | 6,753 B | 2026-01-27 14:53 |
| `007_dashboard_and_scoring.sql` | 30,916 B | 2026-01-27 15:53 |
| `008_archive_and_lifecycle.sql` | 22,760 B | 2026-01-27 16:04 |
| `009_payment_reminder_cron.sql` | 27,836 B | 2026-01-27 15:40 |
| `010_group_and_loan_operations.sql` | 37,463 B | 2026-01-27 16:34 |
| `011_admin_portal_tables.sql` | 19,831 B | 2026-01-28 01:12 |

**Cross-reference with `schema_migrations`**: of the 9 migration names in B (`admin_portal_tables, archive_and_lifecycle, contribution_functions, dashboard_and_scoring, group_and_loan_operations, loan_payment_functions, notification_cron, notification_system, payment_reminder_cron`), **0 match any migration that was actually applied to production**. The applied list (in `01_applied_migrations.md`) contains things like `fix_wallets`, `complete_setup`, `community_system` — none of those appear in B's migrations.

Conclusion: **none of B's migrations have ever run** on the production database. They are pure dead code.

### Edge functions

- **A** has **18** function directories
- **B** has **8** in `functions/` (top-level)
- **B** also has **8** in `supabase/functions/` (nested) — identical names: True

**Function names in A (`tanda-xn-mobile/supabase/functions/`):**

`_shared`, `api-v1-cases`, `api-v1-elders`, `api-v1-honor`, `api-v1-vouch-check`, `api-webhook-dispatcher`, `cleanup-expired-reservations`, `cycle-progression-cron`, `daily-interest-accrual`, `expire-swap-requests`, `process-autopay`, `process-bank-payouts`, `scoring-pipeline-daily`, `send-payment-reminders`, `update-overdue-obligations`, `webhook-retry-processor`, `xnscore-decay-check`, `xnscore-tenure-bonus`

**Function names in B (`Supabase/functions/`):**

`_shared`, `payout_scheduler`, `process-contribution`, `process-loan-payment`, `scoring_job`, `send-notification`, `tests`, `webhooks_psp`

**Naming convention difference**: A uses dash-case (`scoring-pipeline-daily`, `process-bank-payouts`); B uses underscore-case (`scoring_job`, `payout_scheduler`). This is a strong signal that B is an earlier code style — Supabase guidance has shifted toward dash-case.

**Concept overlap but different implementations**: both have scoring, payout, notification, contribution functions, but the actual files are different. Concept-level overlap shows B was an early architecture sketch later rewritten in A.

### Other items in B

| Item | Purpose |
|------|---------|
| `Supabase/Docs/` | 3 markdown files: `API.md`, `BACKEND_DEPLOYMENT.md`, `BACKEND_SUMMARY.md` |
| `Supabase/env.example` | Template file (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc. with placeholder values — no real creds) |
| `Supabase/supabase.exe` | 44,491,776 B — a standalone copy of the Supabase CLI binary. Identical functionality to the `supabase` in `$PATH`; not needed. |
| `Supabase/supabase/.temp/` | Standard CLI cache directory. Confirms this folder was once an active CLI workspace pointing at the same project. |

### Timeline

File modification times in B all cluster around late January 2026 (latest: 2026-01-28 01:12 on `011_admin_portal_tables.sql`). Compare to A's `tanda-xn-mobile/supabase/migrations/068_create_pending_join_rpc.sql` and onward, plus active edge function development.

**B has not been touched in ~110.0 days.** A is actively used.

## Why this matters

1. **No risk of accidentally applying B's migrations** — they don't run automatically anywhere, and `supabase db push` from `tanda-xn-mobile/supabase/` would never see them.
2. **B does not affect production** — confirmed by name comparison with `schema_migrations` (zero overlap).
3. **Cleanup is safe** — delete or move `Supabase/` (capital S) entirely. Only `Docs/` may be worth preserving if its API.md or BACKEND_SUMMARY.md contains intent not captured elsewhere.
4. **Likely origin**: prior architecture sketch (Jan 2026) that predates `tanda-xn-mobile`'s current migration tree. Was probably someone's first attempt before the project was reorganized into the React Native app's own supabase folder. Never deleted.

**Action requested from user before any cleanup**: confirm you don't need anything in `Supabase/Docs/`, then move/delete the folder.

---
_Generated read-only — no files touched._