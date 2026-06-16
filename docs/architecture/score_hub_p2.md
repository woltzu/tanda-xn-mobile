# Score Hub P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 156, on top of the
batched-RPC redesign in migration 144._

P2 layers four learning surfaces on top of the existing Score Hub:
a one-action plan, an anomaly banner, a 7-dot sparkline per card, and a
percentile label. A daily Edge Function (`check-score-changes`) drops
notifications when a score crosses a threshold so the user isn't
surprised by the next visit.

## Why no new score-history table

The audit found three already exist (`xnscore_history`,
`xn_score_history`, `honor_score_history`) plus the generic
`score_history`. Every current/snapshot table already carries a
`previous_score` column. Adding a fourth would be schema spam. Migration
156 deliberately **only adds**:

* `score_notification_log` — idempotency anchor for the daily Edge
  Function. One row per `(user_id, score_type, snapshot_score)`.
* Extends `get_user_scores` from 16 → 28 columns to surface the per-score
  `*_previous`, `*_7d_ago`, and `*_percentile` the UI needs.
* `get_score_percentile(score_type, user_id)` — thin wrapper for a
  single-score re-query. Mock today; see "Open follow-ups" below.

## get_user_scores — extended return

For each of the four families (`xn` / `honor` / `stress` / `mood`):

```
score          current value (rounded INT)
tier|status    current tier (string)
delta          current − previous (INT)
previous       raw previous_score
7d_ago         latest history row <= 7 days ago
percentile     mock 10..90 (stable per user+type)
```

Plus `stress_top_signal` (from the JSONB breakdown) and `last_updated`.

### 7-days-ago resolution

| Family | Source | Field |
|---|---|---|
| XnScore | `xnscore_history` | `score` |
| Honor | `honor_score_history` | `score` |
| Stress | `member_stress_scores` | `stress_score` |
| Mood | `member_mood_snapshots` | `composite_mood_score` |

All four are read with the same pattern: latest row whose `created_at <=
now() - INTERVAL '7 days'`. NULL when the user has no history that old —
the anomaly banner hides in that case.

## ScoreHubScreen UX

### Action plan card
* Inserted at the top of the scroll, above the hero alert.
* Picks one rule-based message tied to the worst-performing score.
  Priority: stress (red/orange) → mood (at_risk/disengaging) → low XN
  (<60) → low honor (<50). Returns null for healthy users → card hides.
* Dismissable for 7 days via `AsyncStorage` key
  `@tandaxn_score_hub_action_plan_dismissed_v1`. Re-shows automatically
  after a week — drift towards better days is information too.

### Anomaly banner
* Below the action plan, above the navy header.
* Triggers: XN drop ≥ 10, stress jump ≥ 15, mood drift ≥ 10 either way.
* Highest absolute swing wins when several scores moved.
* Hides when no `*_7d_ago` value exists (new account).

### Sparkline
* 7 bars per score card. Inputs: `current`, `previous`, `7d_ago`. Today
  these three known points are linearly interpolated into a 7-bar series
  so the chart has something honest to show without per-day history.
* The XN card's sparkline is white-tinted to read against the navy
  gradient.
* Real implementation needs a daily-score series — see "Open follow-ups".

### Percentile label
* "Top X% of users" for higher-is-better scores (XN, honor, mood).
* "Lower than X% of users" for stress (inverse — lower is better).
* Today a deterministic mock derived from `hashtext(user_id ‖ type)` so
  the value is stable per user; real percentile requires a
  `score_percentiles` materialised view across all users.

## Daily notifier — check-score-changes

`supabase/functions/check-score-changes/index.ts`. Service-role. Cron-
triggered.

```
xn_scores         WHERE updated_at >= now() - 24h
  → delta = total_score - previous_score
  → notify if |delta| >= 5 OR tier changed
member_stress_scores  latest snapshot per user, last 36h
  → notify if |delta| >= 5
member_mood_snapshots latest snapshot per user, last 36h
  → notify when tier ∈ {at_risk, disengaging} OR |delta| >= 10
```

Every notification first writes a `score_notification_log` row via
`ON CONFLICT DO NOTHING`. If the insert was a no-op (duplicate snapshot
score), the user-facing `notifications` row is skipped. That makes the
function safe to re-run.

Deployment:
```
supabase functions deploy check-score-changes --no-verify-jwt
```
Schedule via Supabase Scheduler or pg_cron.

## Open follow-ups (not P2)

* Real `score_percentiles` materialised view (`percent_rank()` across all
  users per score type), refreshed by the nightly score-recompute cron.
  Replace the hash-based mock in `get_score_percentile` once it lands.
* Real daily score-snapshot table → drives a full 30-day sparkline. The
  existing history tables capture every change event; a daily
  rollup view would be cheaper for the UI.
* Tier-change detection in the XnScore branch of `check-score-changes` —
  needs a `previous_tier` column or a tier comparison against the prior
  notification log row.
* AI-driven action plan (replace the rule table with an LLM call that
  reads the user's recent activity + score factors).
* First-visit explainer already exists (coach-mark gated by
  `@tandaxn_score_hub_seen_v1`). No P2 change.
