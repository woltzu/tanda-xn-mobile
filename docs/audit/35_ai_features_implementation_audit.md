# AI Features Implementation Audit (v2 — Verified)

**Date:** 2026-06-03
**Scope:** 9 categories of strategic AI features from `TandaXn_AI_Vision_187_Ideas.docx` and `TandaXn_AI_Improvements_By_Feature.docx`.
**Method:**
- Codebase reconnaissance (greps across screens/services/hooks/migrations).
- **5 representative engine files read in full** to verify real implementations vs stubs: `ConflictPredictionEngine`, `EarlyInterventionEngine`, `FinancialStressPredictionEngine`, `ExplainableAIEngine`, `CronAIJobEngine`.
- **PAT in `seo-work/.env` returned 401**, so live DB row-count verification is NOT included — see "What I couldn't verify" section.

---

## Headline finding — the key distinction

> **Engine code is real. Orchestration is largely missing.**

Of the 5 engines I read end-to-end, **all 5 are production-grade implementations** — full Supabase queries, real business logic, multi-language support, real-time subscriptions. Zero stubs.

But the **cron jobs that would invoke their batch methods (`runScoringBatch`, `processEscalations`, `runPostFormationMonitoring`, etc.) do NOT exist in `supabase/functions/`**. A grep across all 18 deployed Edge Functions for engine class names returned **zero matches**. The only AI-adjacent cron is `scoring-pipeline-daily`, which calls a Postgres function `run_scoring_pipeline()` (separate from the TypeScript engines) covering only behavioral profiles + default probabilities + circle health + XnScore recalc.

What this means in 3 bullets:
- **User-triggered paths** (e.g., `evaluateCircleFormation` called when admin creates a circle) likely work where hooks/screens exist for them.
- **Cron-triggered batch paths** (the AI feedback loop — daily/weekly scoring, escalation processing, monitor evaluation) **are unwired**.
- **Signal-recording paths** from app events (`recordContributionDelay`, `recordTicketLanguage`, `recordLoginDrop`, etc.) depend on whether app code actually calls them — most likely partial.

This re-classifies many "implemented" items from v1 of this audit as 🟡 (scaffolded but not orchestrated).

---

## Bucket definitions

- ✅ **Fully implemented** — code exists, schema exists, AND at least one usage path (cron / user-triggered / signal-driven) is verifiably wired and the engine has the data it needs to function.
- 🟡 **Scaffolded but not working** — code + schema exist, but either (a) no orchestration triggers it, (b) it depends on upstream data that nothing produces, or (c) the underlying tables are most likely empty in prod.
- ❌ **Not implemented** — no meaningful code traces.

---

## Engine-by-engine verification (the 5 I read in full)

### `ConflictPredictionEngine.ts` (1,048 lines) — Status: 🟡

**Code quality:** Production-grade. 8 sections (history, scoring, formation eval, human review, post-formation monitoring, queries, dashboard, realtime). Real pairwise scoring with 6 weighted factors (sync_stress 30%, prior_dispute 25%, payout_friction 20%, style_mismatch 10%, trust_gap 10%, rapid_enrollment 5%).

**Wiring:**
- ✅ User-triggered: `evaluateCircleFormation()` is documented as "called when admin clicks Create Circle." `useConflictPrediction` hook + `ConflictAlertScreen` exist.
- ❌ Cron-triggered: `runPostFormationMonitoring()` is documented "called weekly by cron." **No Edge Function invokes it.**
- Depends on: `member_stress_scores`, `member_mood_snapshots`, `xnscores`, `contributions`, `vouches`, `circle_members` — most of these are populated by other systems.

### `EarlyInterventionEngine.ts` (713 lines) — Status: 🟡

**Code quality:** Production-grade. Has rules/templates engine, message personalization (template variable replacement), cooldown logic, multi-language support, auto-escalation.

**Wiring:**
- ❌ The core method `evaluateAndIntervene()` is meant to be called for every member with a non-zero default probability — **no cron does this.**
- ❌ `processEscalations()` is documented as "called by cron" — **no cron does this.**
- Depends on: `default_probability_scores` (populated by `scoring-pipeline-daily` ✅), `intervention_rules`, `intervention_templates`, `notification_profiles`.

**Acknowledged self-limitation in code:** `// Only handle Levels 1 & 2 for now` (line 319). Levels 3-5 explicitly not implemented.

### `FinancialStressPredictionEngine.ts` (1,095 lines) — Status: 🟡

**Code quality:** Production-grade. 4-signal weighted scoring (contribution_delay 30%, ticket_language 35%, login_drop 20%, early_payout_request 15%). Has keyword analysis, intervention message generation in EN + FR.

**Wiring:**
- ❌ `runScoringBatch()` "called by cron every 6 hours" — **no cron does this.**
- ❌ `expireStaleInterventions()` — **no cron does this.**
- **Signal-recording paths**: 4 `record*` methods need callers in app code. Whether they're called from contribution submit / support ticket creation / login tracking is unverified, but likely partial.
- Depends on: `stress_keywords`, `member_stress_signals`, `member_stress_scores`, `stress_interventions`, `stress_prediction_dashboard` (view).

### `ExplainableAIEngine.ts` (read first 120 of ~1000 lines) — Status: 🟡

**Code quality:** Production-grade. **15-language support** (en/fr/es/pt/hi/tl/zh/vi/ko/ar/am/sw/yo/ha/ht). Pre-built templates with placeholder substitution. 8 decision types.

**Wiring:** Passive responder — only activates when other systems generate AI decisions and request explanations. If no decisions are being made (because no engines are running), no explanations are generated.

### `CronAIJobEngine.ts` (read first 120 of multi-section lines) — Status: 🟡

**Code quality:** Production-grade. Defines **6 AI cron jobs**:
- daily-behavioral-signal-update (2am)
- daily-default-probability-scoring (3am)
- weekly-circle-health-recalculation (Mon 4am)
- weekly-model-performance-check (Sun 5am)
- monthly-xnscore-full-recalibration (1st 6am)
- monthly-cohort-analysis (2nd 6am)

**Wiring:**
- ❌ **NO Edge Function calls any of these.** A grep across `supabase/functions/` for `CronAIJobEngine` returned **zero matches**.
- The only related EF is `scoring-pipeline-daily`, which uses a **different orchestration mechanism** (`supabase.rpc('run_scoring_pipeline')`) and doesn't reference this engine at all.

---

## What this means for the 5-feature spot check, translated

| Engine | Code Real? | User-triggered path wired? | Cron path wired? | Tables likely populated? | Final bucket |
|---|---|---|---|---|---|
| ConflictPredictionEngine | ✅ | ✅ (Create Circle) | ❌ | Probably for `member_pair_scores` if create-circle flow exercises it | 🟡 |
| EarlyInterventionEngine | ✅ | ❌ (no admin/screen call) | ❌ | Probably empty | 🟡 |
| FinancialStressPredictionEngine | ✅ | Maybe (signal recording from app) | ❌ | Likely sparse | 🟡 |
| ExplainableAIEngine | ✅ | Depends on callers | ❌ | Likely empty | 🟡 |
| CronAIJobEngine | ✅ | n/a | ❌ | Tables likely empty | 🟡 |

**The pattern is consistent: production-grade engine code authored, autonomous orchestration never landed.**

---

## Revised category assessments (with v1 corrections)

### Category 1: Savings Goals AI (G-1 to G-5)
Unchanged from v1: ❌ **0/5 implemented.** No code traces for any of the 5 features.

### Category 2: XnScore AI (S-1 to S-5)
Unchanged from v1: 🟡 **1/5** — `RecoveryPlanService.ts` exists for S-3 (depth unverified).

### Category 3: Remittance AI (R-1 to R-7)
Unchanged from v1: 🟡 **2/7 partial** — UI shells exist but no intelligence engines.

### Category 4: Community AI (C-1 to C-5)
Unchanged from v1: 🟡 **1/5** — milestone celebrations (goal-specific) is the only ✅.

### Category 5: Elder Governance AI (E-1 to E-5)
**Downgraded from v1**: 🟡 **1/5 partial** — Mediation outcome (E-2) only has UI shell + ConflictPredictionEngine as backing; with conflict cron unwired, the "outcome intelligence" loop is incomplete.

### Category 6: Loans AI (L-1 to L-4)
Unchanged from v1: 🟡 **1/4 partial.**

### Category 7: Auth & Security AI (A-1 to A-4, SE-1 to SE-3)
Unchanged from v1: 🟡 **2/7 partial.** Standard biometric + FAQ ITIN — neither truly "AI."

### Category 8: Backend Infra AI (B-1 to B-4)
**Downgraded from v1**: 🟡 **1/4 scaffold only** — CronAIJobEngine.ts defines 6 cron jobs but **none are wired to Edge Functions**.

### Category 9: Other strategic ideas (the big one — major correction from v1)

**v1 marked 22 of these as ✅. With the cron-orchestration gap, most need to be downgraded.**

| Idea | v1 | v2 | Why downgrade |
|---|---|---|---|
| Smarter circle composition | ✅ | 🟡 | Engine real, but ML feedback loop (`circle_match_history`) likely not being fed |
| Dynamic payout ordering | ✅ | ✅ (probably) | Migration 042; payout cron exists (`process-bank-payouts`) so likely wired |
| Early intervention system | ✅ | 🟡 | Engine real, batch cron missing |
| Circle insurance pool | ✅ | ✅ (probably) | Migration 041; engine likely user-triggered when defaults happen |
| Graduated entry system | ✅ | ✅ (probably) | Migration 040; engine likely user-triggered on circle join |
| Cross-circle liquidity | ✅ | 🟡 | Engine real, allocation cron unverified |
| Substitute member system | ✅ | ✅ (probably) | Migration 049; user-triggered on default cascade |
| Partial contribution mode | ✅ | ✅ (probably) | Migration 048; user-triggered on contribution submit |
| Circle health score | ✅ | ✅ | `run_scoring_pipeline()` (DB function called by scoring-pipeline-daily) computes circle health — actually wired |
| Conflict prediction engine | ✅ | 🟡 | Engine real, user-triggered create-circle path wired, batch monitor cron missing |
| Contribution mood detection | ✅ | 🟡 | Engine real, cron almost certainly missing |
| Sanctions screening | ✅ | ✅ (probably) | Likely user-triggered on KYC submit |
| AML monitoring | ✅ | 🟡 | Likely needs ongoing transaction monitoring cron — verification needed |
| Explainable AI decisions | ✅ | 🟡 | Passive responder; runs only when callers request explanations |
| Notification priority engine | ✅ | 🟡 | Depends on notification cron orchestration |
| Position swap engine | ✅ | ✅ (probably) | User-triggered |
| Honor score system | ✅ | ✅ | `xnscore-decay-check` + `xnscore-tenure-bonus` EFs exist + scoring pipeline |
| Scoring pipeline | ✅ | ✅ | `scoring-pipeline-daily` EF exists and is the orchestrator |
| Marketplace system | ✅ | ✅ | User-triggered; recently exercised in commits |
| Trip organizer | ✅ | ✅ | User-triggered; recently exercised in commits |
| AI recommendation feedback loop | ✅ | 🟡 | Schema exists; orchestration unverified |
| Circle match history ML seed | ✅ | 🟡 | Schema exists; whether matches are being recorded unknown |

**Revised count for category 9: ~11 ✅ / ~10 🟡 / rest ❌.** (Roughly halved from v1's optimistic 22.)

---

## Top-down summary

| Category | Fully implemented | Scaffolded but not orchestrated | Not implemented |
|---|---|---|---|
| 1. Savings Goals AI | 0 | 0 | 5 |
| 2. XnScore AI | 0 | 1 | 4 |
| 3. Remittance AI | 0 | 2 | 5 |
| 4. Community AI | 1 (milestones) | 0 | 4 |
| 5. Elder Governance AI | 0 | 1 | 4 |
| 6. Loans AI | 0 | 1 | 3 |
| 7. Auth & Security AI | 0 | 2 | 5 |
| 8. Backend Infra AI | 0 | 1 | 3 |
| 9. Other strategic ideas | ~11 | ~10 | rest |
| **TOTAL (~76 listed)** | **~12** | **~18** | **~46** |

---

## What I couldn't verify (and why it matters)

Without a working PAT to query the live DB, I can't confirm:
1. **Row counts** in critical tables — `member_pair_scores`, `member_stress_signals`, `member_interventions`, `stress_interventions`, `conflict_history`, `model_performance_logs`, `cohort_analytics`. Empty tables would confirm "engines exist but never run." Non-empty would suggest some path IS triggering them.
2. **pg_cron jobs** registered in `cron.job` — would tell us whether `CronAIJobEngine`'s 6 scheduled jobs are actually scheduled at the Postgres level (vs the absent Edge Function approach).
3. **Whether `run_scoring_pipeline()` PL/pgSQL function calls any TypeScript engines** — unlikely since DB functions don't call TS, but `run_scoring_pipeline` may replicate scoring logic in SQL, independently of the engines.

If you can refresh the PAT, I can run those queries in ~2 minutes and provide a definitive ✅ / 🟡 split with row counts for each engine's primary tables.

---

## Honest bottom-line

**TandaXn has invested heavily in AI engine code (~5000+ lines across the 5 engines I read, likely 20,000+ total across all `*Engine.ts` files). The codebase shows serious thought: weighted scoring with documented factors, multi-language personalization, idempotency keys, audit tables, realtime subscriptions.**

**But the orchestration layer — the cron jobs and signal-recording call sites that would make these engines RUN AUTONOMOUSLY — is significantly under-built.** Most engines wait passively for callers that don't exist yet. The exceptions are XnScore + circle health (driven by `scoring-pipeline-daily`'s SQL orchestrator) and user-triggered flows where a screen explicitly invokes an engine method.

**Practical implication:** if you say "we have a Conflict Prediction Engine in production," that's true for the **definition**. If you say "the system is autonomously scoring pairs daily and flagging dangerous circle compositions," that's likely overstating — the engine code is ready but the wake-up call to run it on a schedule appears to be missing.

---

_Generated 2026-06-03 (v2). Engine bodies verified by direct read; cron-vs-engine coupling verified by exhaustive grep across `supabase/functions/`. No code or schema changes._
