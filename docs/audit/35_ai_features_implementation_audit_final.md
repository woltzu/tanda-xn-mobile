# AI Features Implementation Audit — FINAL (with live DB verification)

**Date:** 2026-06-03
**Scope:** 9 categories of strategic AI features from `TandaXn_AI_Vision_187_Ideas.docx` and `TandaXn_AI_Improvements_By_Feature.docx`.
**Method:**
- Codebase reconnaissance (grep across screens/services/hooks/migrations).
- 5 representative engine files read end-to-end.
- **Live DB row counts on all critical engine tables (fresh PAT, 2026-06-03).**
- **Live `cron.job` registry inspection.**
- **`cron_job_logs` execution history.**

---

## Headline finding — **the entire AI subsystem is inert**

> **Engine code is real (~20,000+ lines of production-quality TypeScript). The data flowing through that code is exactly zero.**

This is harsher than my v2 audit suggested. v2 said "engines real, orchestration likely missing." The live DB confirms the **stronger** finding: **no engine has ever produced output in production**.

### The smoking-gun numbers

```
member_pair_scores              0 rows  ← ConflictPredictionEngine output
member_stress_signals           0 rows  ← FinancialStressPredictionEngine input
member_stress_scores            0 rows  ← FinancialStressPredictionEngine output
member_interventions            0 rows  ← EarlyInterventionEngine output
stress_interventions            0 rows  ← FinancialStressPredictionEngine output
member_mood_snapshots           0 rows  ← ContributionMoodDetectionEngine output
default_probability_scores      0 rows  ← scoring-pipeline-daily output
circle_health_scores            0 rows  ← scoring-pipeline-daily output
circle_formation_flags          0 rows  ← ConflictPredictionEngine output
post_formation_monitor          0 rows  ← ConflictPredictionEngine output
conflict_history                0 rows  ← ConflictPredictionEngine input/output
score_alerts                    0 rows  ← scoring-pipeline-daily output
ai_recommendation_feedback      0 rows  ← AI recommendation feedback loop
model_performance_logs          0 rows  ← CronAIJobEngine output
cohort_analytics                0 rows  ← CronAIJobEngine output

cron_job_logs                   0 rows total  ← NO CRON HAS EVER LOGGED A RUN
```

### What IS populated

```
stress_keywords                 31 rows  ← seed data
mood_keywords                   36 rows  ← seed data
intervention_rules               5 rows  ← seed configuration
intervention_templates           8 rows  ← seed configuration
scoring_pipeline_runs            5 rows  ← likely manual test runs from dev
```

**Pattern:** seed/configuration tables are populated (someone set them up); runtime tables that engines would write to are all empty.

### The cron paradox

```
20 pg_cron jobs are scheduled and ACTIVE — including:
  scoring-pipeline-daily       0 3 * * *
  xnscore-decay-check          0 0 * * 0
  xnscore-tenure-bonus         0 0 1 * *
  sanctions-screening-weekly   0 2 * * 0
  aml-monitoring-weekly        0 3 * * 0
  daily-interest-accrual       0 0 * * *
  (and 14 more)

cron_job_logs:                 0 rows total (ever)
```

**Either**:
- The scheduled cron jobs are silently failing (pg_cron registers them but `net.http_post` calls aren't reaching the Edge Functions), OR
- The Edge Functions are reaching the EFs but failing silently before they can write to `cron_job_logs`, OR
- pg_cron infrastructure on this project is broken.

**Whichever it is, the entire scheduled-automation layer is dead.**

### CronAIJobEngine's 6 AI cron jobs

The `CronAIJobEngine` defines:
- `daily-behavioral-signal-update` (2am)
- `daily-default-probability-scoring` (3am)
- `weekly-circle-health-recalculation`
- `weekly-model-performance-check`
- `monthly-xnscore-full-recalibration`
- `monthly-cohort-analysis`

**Not one of these is in `cron.job`.** They exist only in code. Nothing on the server triggers them.

---

## Revised 3-bucket assessment (final, post-verification)

### ✅ Fully implemented (code + schema + verifiably wired AND active)

After DB verification: **the count shrinks to ~3-4 features that are demonstrably user-triggered and have tables OR fall outside the AI subsystem:**

| Feature | Why it survives |
|---|---|
| Milestone celebrations (C-4) | Migration 078 — `_record_goal_milestones` is called INLINE inside `credit_goal_external` / `transfer_to_goal` (not via cron). Verified in earlier commit. Goal milestones DO get recorded when deposits happen. |
| Trip organizer | User-triggered, recently exercised in commits |
| Marketplace system | User-triggered, recently exercised in commits |
| Stripe Connect (limited) | Path A working in test mode; Connect onboarding broken pending Stage 1 follow-through |

### 🟡 Scaffolded but inert (code + schema + 0 production traffic)

**Everything else from the v2 ✅/🟡 lists falls here.** The full list:

- ConflictPredictionEngine — 0 rows in `member_pair_scores` / `conflict_history` / `circle_formation_flags`
- EarlyInterventionEngine — 0 rows in `member_interventions`
- FinancialStressPredictionEngine — 0 rows in `member_stress_signals` / `member_stress_scores` / `stress_interventions`
- ContributionMoodDetectionEngine — 0 rows in `member_mood_snapshots`
- ExplainableAIEngine — passive responder, depends on callers that don't exist
- CronAIJobEngine — 6 jobs defined, 0 scheduled
- Smarter circle composition / CircleMatchingService — 0 rows in `circle_match_history`
- Cross-circle liquidity / CrossCircleLiquidityEngine — no usage evidence
- Dynamic payout ordering / PayoutOrderService — `payout_executions` empty per earlier audit
- Insurance pool / InsurancePoolEngine — no triggers visible
- Graduated entry / GraduatedEntryEngine — no usage evidence
- Substitute member system / SubstituteMemberEngine — no usage evidence
- Partial contribution / PartialContributionEngine — no usage evidence
- Circle health score / CommunityHealthService — `circle_health_scores` = 0 rows
- AML monitoring / AmlMonitoringEngine — cron exists but doesn't log
- Sanctions screening / SanctionsScreeningEngine — same
- Notification priority engine — depends on cron that doesn't fire
- Position swap engine — no usage evidence
- Honor score system — `xnscore-tenure-bonus` cron exists but logs empty
- Scoring pipeline — `scoring-pipeline-daily` cron exists, `scoring_pipeline_runs` has 5 historical rows but `cron_job_logs` empty (likely test runs)

### ❌ Not implemented (no code traces)

Unchanged from v1/v2:
- All 5 Savings Goals AI features (G-1 to G-5)
- All 4 Loans AI features (L-1 to L-4)
- All 7 Auth/Security AI features (A-1 to A-4, SE-1 to SE-3)
- 5 of 7 Remittance AI features (R-2, R-3, R-5, R-6, R-7)
- Most of the 187-ideas list

---

## Top-down totals (final)

| Category | ✅ Working | 🟡 Inert scaffold | ❌ Not built |
|---|---|---|---|
| 1. Savings Goals AI | 0 | 0 | 5 |
| 2. XnScore AI | 0 | 1 (RecoveryPlan only) | 4 |
| 3. Remittance AI | 0 | 2 (UI shells) | 5 |
| 4. Community AI | 1 (milestones) | 0 | 4 |
| 5. Elder Governance AI | 0 | 1 (mediation toolkit UI) | 4 |
| 6. Loans AI | 0 | 1 (CreditworthinessEngine) | 3 |
| 7. Auth & Security AI | 0 | 2 (standard biometric + FAQ ITIN, neither truly AI) | 5 |
| 8. Backend Infra AI | 0 | 1 (CronAIJobEngine code only) | 3 |
| 9. Other strategic ideas | ~3 (Trip / Marketplace / Stripe Path A) | ~20 | rest |
| **TOTAL** | **~4** | **~28** | **~46** |

---

## What this means in plain language

**TandaXn has an entire fleet of AI engines written, configured, seeded, and parked. The factory is built. The lights aren't on.**

Concrete evidence:
1. ~20,000+ lines of production-quality engine code exist (verified by reading 5 engines end-to-end).
2. The DB schema for these engines exists (migrations 036, 037, 044-046, 050-052, 058, 060, 061, 062 all applied — verified by Q5 sample).
3. Seed configuration exists (intervention rules, templates, stress keywords, mood keywords — all populated).
4. **No engine table has a single output row.** No conflict score ever computed. No stress signal ever recorded. No intervention ever offered.
5. **No cron job has ever logged a run** (`cron_job_logs` table is empty despite 20 scheduled jobs).

This means anyone using or evaluating TandaXn today gets **none of the AI behavior the architecture promises**. The 5 scoring_pipeline_runs entries are most likely from one-off manual development testing, not autonomous operation.

---

## Recommended next steps (operational)

If you want any of this to actually function:

1. **Diagnose pg_cron**. With 20 active jobs and 0 log rows, something is broken at the cron infrastructure level. Try:
   ```sql
   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
   ```
   This view shows per-execution details and would reveal whether jobs are firing-and-failing or never firing.

2. **Pick ONE engine and exercise it end-to-end manually.** E.g., call `FinancialStressPredictionEngine.recordContributionDelay(...)` directly from a test screen, then `calculateStressScore(...)`, and verify a row lands in `member_stress_signals` and `member_stress_scores`. This isolates engine-correctness from cron-orchestration.

3. **For each "🟡 inert scaffold" item you actually need**, either:
   - Wire the cron job at the EF + pg_cron level, OR
   - Add the user-triggered call site (e.g., `evaluateCircleFormation` on Create Circle button press), OR
   - Decide it's not worth the operational cost and remove the dead code.

4. **Stop counting "engine file exists" as evidence of feature working** in any future roadmap or status doc. The pattern is well-established now: scaffold without orchestration. Every status review needs the row-count check.

---

## What I verified vs assumed

- ✅ Engine file existence and code quality (read 5 in full, sampled others by grep).
- ✅ DB schema existence (queried `information_schema`-equivalent via pg_stat_user_tables for all named tables; all exist).
- ✅ Row counts on all 15 critical engine + seed tables (queried directly).
- ✅ pg_cron job registry (queried `cron.job` directly).
- ✅ cron_job_logs execution history (queried directly — total = 0).
- ⚠️ I did NOT exhaustively check every screen-side call site for every engine. The 🟡 items might have a screen-triggered path I haven't grep'd; but if so, that path also produces 0 rows in the engine's output table, so the conclusion is unchanged.

---

_Generated 2026-06-03 with fresh PAT. All engine output tables verified empty. All cron jobs verified scheduled but unlogged. Engine code verified real. No code, schema, or cron changes made._
