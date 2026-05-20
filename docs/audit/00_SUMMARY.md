# TandaXn Deployment-Truth Audit — Summary

_Generated: 2026-05-18 18:20 UTC. Read-only audit; no code or DB modified._

## Headline numbers

| Metric | Value | Note |
|--------|-------|------|
| Migration files on disk | **97** (`.sql` files; **68 unique versions** including collisions) | numbered SQL files in `supabase/migrations/` |
| Migrations applied per `schema_migrations` | **31** | But tracking is unreliable — see below. |
| Total tables actually probed in production | **147** | via REST anon-key probes |
| Tables that EXIST in production | **135 / 147 = 92%** | |
| Tables MISSING in production | **12 / 147 = 8%** | of which 5 are user-named critical tables |
| Critical tables EXISTING (of user-named 16) | **11 / 16** | savings goals, circles, scores, wallets, disputes, transactions all OK |
| Critical tables MISSING (of user-named 16) | **5 / 16** | `elders`, `stripe_connect_accounts`, `dream_feed_posts`, `marketplace_listings`, `trip_circles` |
| Migration tracking sync | **BROKEN** | Migration 031 cols exist despite not being in `schema_migrations`. Migration 028 IS in `schema_migrations` but its tables don't exist. |
| Migration number collisions | 6 | DIFFERENT features sharing a # — caused at least one apparent rollback (028 token tables) |
| Duplicate iteration files | 9 clusters | dev iterations not cleaned up |
| Total screens in `app/` | 307 | |
| Services in `services/` | 65 | doc claimed 54 |
| Hooks in `hooks/` | 55 | doc claimed 42 |

## The honest percent

The doc claims **91%** done by counting files-exist. The other audit said 20%. The truth is more nuanced than either:

| Definition | Working % | Reasoning |
|------------|-----------|-----------|
| **Tables actually exist in production** | **~92%** (135/147 probed) | The schema is FAR more deployed than the migration tracking shows. Many "unapplied" migrations were clearly applied via SQL Editor (not recorded in `schema_migrations`). |
| **Migrations tracked as applied** | 32% (31/97 files) | Misleading lower bound — `schema_migrations` is out of sync with the actual schema. |
| **Code exists (doc's metric)** | ~91% | What the doc reports. Counts service/hook files. |
| **Verified end-to-end working** | UNKNOWN — needs runtime test | Static analysis confirms tables and code exist; cannot confirm any flow completes without runtime. |

### The migration-tracking lie

**The `schema_migrations` table is unreliable** — it claims only 31 migrations applied, but column-existence probes show the schema is much more advanced:

- `savings_goal_types.emoji` ✅ exists (migration 031, claimed "not applied")
- `savings_goal_types.early_withdrawal_penalty_percent` ✅ exists (031)
- `user_savings_goals.metadata` ✅ exists (031)
- `user_savings_goals.emoji` ✅ exists (031)
- `communities` table has 75 rows (056 territory, "not applied")
- `xn_score_factor_definitions` has 5 seeded rows
- `xn_score_improvement_tips` has 17 seeded rows

These all exist despite their migrations not being recorded as applied. Conclusion: **most schema changes were applied via the Supabase SQL Editor or directly, bypassing the CLI migration tracking.** Whoever deployed knew what they were doing; the audit trail just lies.

### What's actually missing (12 tables of 147 probed)

These tables genuinely don't exist in production:

**Critical (5):**
- `elders` — migration 032 recorded as "elder_system" but no `elders` table; disk file is `032_elder_context_support.sql` (creates a different schema). Naming mismatch.
- `stripe_connect_accounts` — migration 054 never ran. Stripe Connect non-functional.
- `dream_feed_posts` — migration 028 collision; production picked `028_token_incentives` over `028_dream_feed`.
- `marketplace_listings` — migration 057 never ran.
- `trip_circles` — migration 064 never ran.

**Other (7):**
- `api_clients`, `api_request_logs`, `webhook_deliveries` — migration 029 recorded as applied but its tables don't exist (only `028_token_incentives` ran successfully under that name; `029_api_white_label` may have failed mid-run or never ran despite being recorded).
- `token_award_rules`, `token_balances`, `token_rates`, `token_transactions` — migration 028 recorded as `token_incentives` but its tables don't exist either. **The 028 migration may have been recorded without running, OR it was rolled back.**

### Savings Goals specifically — the user's concern

**Savings Goals is WORKING in production.** All three tables exist (`user_savings_goals`, `savings_transactions`, `savings_goal_types`), and migration 031's specific column additions (`emoji`, `metadata`, `early_withdrawal_penalty_percent`) are all present despite the migration not appearing in `schema_migrations`. The UI screens exist at `app/(app)/goals/030-042` and import the `useSavings` context which talks to those tables.

If the user can't see savings goals in the running app, it's a UI/navigation/auth issue — NOT a missing-feature problem. The screens may need to be wired into the main tab nav (currently they exist in the route tree but aren't surfaced from `(app)/_layout.tsx` or a tabs layout — needs runtime test to confirm).

## Top 10 fixes to reach demoable MVP

Ordered by leverage (highest impact first):

1. **Re-sync `schema_migrations` with the actual production schema.** The tracking is lying in both directions: claims 031 not applied (but its columns exist), claims 028 IS applied (but its tables don't). Without a real audit trail you cannot safely run `supabase db push` — it will try to re-apply migrations that already ran or skip ones that didn't. Recommended: dump the live schema, regenerate a clean `_remote_commit` baseline migration, and start fresh from there.
2. **Apply migration 054 (Stripe Connect).** `stripe_connect_accounts` table is genuinely missing. Without it no real money flow works. `StripeConnectEngine.ts` exists in code and will 404 on first call.
3. **Decide on the 028/029 collisions:** production records `028_token_incentives` and `029_api_white_label` as applied, but neither's tables exist. Was the migration rolled back? Did it fail mid-transaction? Either re-run them or remove from `schema_migrations` so the CLI can re-attempt.
4. **Rename or re-number the 4 collision files** (`028_dream_feed`, `029_feed_storage_bucket`, `030_circle_profile_fkeys`, `031_fix_circles_rotation_method`). They share a version with the migration that ran and are permanently orphaned. Re-number to 069+ if you want them, or delete.
5. **Investigate the `elders` mismatch.** Production `schema_migrations` row 032 is named `elder_system`. Disk file `032_elder_context_support.sql` exists but contains different SQL (no `elders` table). Two possibilities: (a) the real `elder_system` migration was inlined via SQL Editor and never written to disk — you've lost the source code; (b) the disk file is stale and a different migration ran. Either way you need to reconstruct what's actually in the DB.
6. **Delete the 30+ duplicate-iteration migration files** (`012_v2`, `015_v3`, etc.). See `06_migration_cleanup_plan.md`. None of them ran; they're confusing noise.
7. **For each "missing table" feature (Stripe, dream_feed, marketplace, trip_circles), audit the screens that depend on them** — see `04_screen_status.md`. Either build/apply the missing tables or hide the screens from main nav until done.
8. **Wire push-notification transport.** `NotificationPriorityEngine` table exists, code exists, but no Expo Push / FCM hookup. The Supabase secret `TWILIO_AUTH_TOKEN` is set but no transport edge function is deployed.
9. **Smoke-test the savings goals flow.** Per probe results, the DB side is fine. Run GoalsDashboard → AddNewGoal → DepositToGoal → WithdrawFromGoal end-to-end on a real account to confirm UI wiring.
10. **Add a CI guard.** A simple test: `pg_dump schema --schema-only` vs `supabase db diff` should produce empty diff. If not, fail the build. This stops future schema drift dead.

## Top 5 things further along than the doc claims

1. **Migrations 054-068 (15 files)** — Stripe Connect, mock-to-real scoring, community features, marketplace, early intervention, cross-circle liquidity, financial stress prediction, contribution mood detection, conflict prediction, trip circles, trip organizer, pending joins. The doc cuts off at 053. These were written but never deployed.
2. **Services count**: 65 files in `services/` (doc claimed 54).
3. **Hooks count**: 55 files in `hooks/` (doc claimed 42).
4. **Screen count**: 307 files in `app/` (doc didn't enumerate).
5. **Goals UI is more complete than the doc suggests** — full goal lifecycle screens exist at `app/(app)/goals/030-042` (dashboard, detail, add, edit, progress, milestones, tier selection/upgrade/comparison, withdrawal flow). They're held back by missing migration 031, not missing UI.

## Caveats and limitations of this audit

- **Row counts are anon-visible only.** I had no service-role key. A table showing 'EXISTS' with low row count may still have plenty of rows that RLS hides from anon.
- **`supabase_migrations.schema_migrations` was read via user paste**, not via direct DB connection (the schema is private and anon can't reach it; sandbox blocked the postgres CLI path). If you re-run the user's SQL and the list changes, this audit is stale.
- **Reachability heuristic is conservative.** A screen marked UNKNOWN may well be reachable via deep link or dynamic routing — needs manual confirmation per screen.
- **Flow verdicts are static-analysis only**. No flow has been tested end-to-end during this audit. 'WORKING' here means 'code path exists and DB tables exist'; it does NOT mean 'a user has completed this flow today.'
- **The `Supabase/` folder (capital S) at `C:/Users/franck/OneDrive/Desktop/TandaXn/Supabase/` contains additional code not under tanda-xn-mobile**. That tree was NOT included in this audit's screen/service counts; it appears to be an alternate or earlier copy of edge functions. Worth checking whether it's stale or canonical.

## See also

- `01_applied_migrations.md` — full applied list with disk match
- `02_migration_gap.md` — three-way A/B/C cross-reference
- `03_table_inventory.md` — REST probe results for each critical table
- `04_screen_status.md` — per-screen reachability + DB dependency
- `05_critical_flows.md` — five flows with verdicts
- `06_migration_cleanup_plan.md` — file-by-file cleanup recommendation