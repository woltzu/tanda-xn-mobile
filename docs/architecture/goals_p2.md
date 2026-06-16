# Goals P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 155, on top of the
Send-Money P2 work in migration 154._

P2 adds three flavours of automation on top of the existing goals system:
**suggest** (median target chip + title category chip + spending banner),
**celebrate** (milestone auto-posts to the dream feed), and **manage**
(per-jar round-up toggle for the Round-up Savings goal).

## Data model — what migration 155 adds

| Object | Purpose |
|---|---|
| `feed_posts.linked_goal_id UUID FK` | Typed pointer from milestone posts back to the goal they celebrate. Replaces the stringly-typed `related_id` for this use case. `ON DELETE SET NULL` so a deleted goal doesn't take its celebration history with it. |
| `user_savings_goals.round_up_enabled BOOLEAN DEFAULT TRUE` | Per-jar opt-out for the Round-up sweep introduced in migration 154. Defaults on for every goal so existing rows stay valid. The Send-Money screen now checks both `profiles.round_up_increment > 0` AND `jar.round_up_enabled` before crediting. |
| `goal_auto_post_settings(user_id PK, milestones_enabled, updated_at)` | User-level opt-out for milestone auto-posts. Default state (no row, or `milestones_enabled=true`) = posts enabled. |
| `spending_patterns(id, user_id, category, monthly_avg_cents, suggested_save_cents, last_computed_at, dismissed_at)` | Banner data on the Goals hub. Server-computed; clients SELECT-only. Partial index on `(user_id) WHERE dismissed_at IS NULL` keeps the hub query cheap. |

RLS posture matches the rest of the codebase: SELECT own rows;
INSERT/UPDATE happen only through SECURITY DEFINER RPCs (or service-role
in the edge function).

## Milestone celebration — how the auto-post fires

```
transfer_to_goal RPC (mig 078)
       ↓ updates current_balance_cents
       ↓ calls _record_goal_milestones(p_goal_id)   (mig 078)
       ↓ inserts goal_milestones row at every new 25/50/75/100 crossing
       ↓ idempotency: UNIQUE (goal_id, milestone_percent)
       ↓
goal_milestones AFTER INSERT trigger (mig 155)
       ↓ → post_goal_milestone_to_feed()           SECURITY DEFINER
       ↓ skips goal_type='round_up' (round-up jar shouldn't spam the feed)
       ↓ skips users with goal_auto_post_settings.milestones_enabled=false
       ↓ INSERTs feed_posts (type='milestone', is_auto=true, linked_goal_id)
```

Existing `FeedPostCard.POST_TYPE_CONFIG` already has a `milestone` entry
("Savings Milestone", trophy badge), so the new posts render with the
correct chrome without any frontend changes.

## RPCs

### `suggest_goal_amount() → BIGINT`
Returns the median `target_amount_cents` of the caller's past goals.
`NULL` when no past goals exist — the GoalCreateExpressScreen hides the
chip in that case.

### `dismiss_spending_pattern(p_pattern_id UUID) → BOOLEAN`
Soft-dismisses one of the caller's `spending_patterns` rows. Idempotent;
returns false if already dismissed or not owned by the caller.

## Frontend

### `screens/GoalCreateExpressScreen.tsx`
* **Median target chip** — first amount focus calls `suggestGoalAmount`.
  Chip ("Usually you save $X — use that?") shows when the suggestion is
  > 0 AND the user hasn't typed an amount yet.
* **Title category chip** — local keyword map matches the title against
  a fixed set (Travel, Home, Wedding, Emergency, Electronics, Education,
  Transport, Business). Tapping nudges the title with the canonical
  "{Category} fund".
* Accepts route params `suggestedName` and `suggestedAmount` so the
  Goals-hub spending banner can hand off into a pre-filled form.

### `screens/GoalDetailV2Screen.tsx`
* Detects `goal_type === 'round_up'` and renders a teal toggle card
  ("Auto round-up sends") that flips `round_up_enabled`. Optimistic with
  revert-on-error.

### `screens/GoalsHubV2Screen.tsx`
* Subscribes to `spending_patterns` on focus.
* Renders one banner per active row with category, monthly average,
  suggested save amount, "Create goal" CTA (navigates to
  GoalCreateExpress pre-filled), and "Not now" dismiss.

### `screens/DomesticSendMoneyScreen.tsx`
* Round-up sweep now respects `jar.roundUpEnabled` — the Send-Money P2
  branch becomes a no-op when the user has disabled it on the jar.

### `hooks/useGoalActions.ts`
* `suggestGoalAmount`, `setRoundUpEnabled(goalId, enabled)`,
  `fetchSpendingSuggestions`, `dismissSpendingSuggestion` exported.
* `mapGoalRow` now hydrates `roundUpEnabled`.
* `ensureRoundUpGoal` uses the 🪙 emoji per the P2 spec (was 💰).

### `supabase/functions/suggest-goals-from-spending/index.ts`
* Placeholder edge function. Status `placeholder` until the
  money_transfers / contributions category enrichment lands. For demo,
  seed a row by hand:

```sql
INSERT INTO public.spending_patterns
  (user_id, category, monthly_avg_cents, suggested_save_cents)
VALUES
  ('<user_uuid>', 'dining', 25000, 20000);  -- $250/month → $200 saved
```

## Open follow-ups (not P2)

* Implement the real `suggest-goals-from-spending` aggregation once
  `money_transfers.category` and `contributions.category` exist.
* Per-post opt-out (delete or hide individual auto-posts) — currently
  only user-level opt-out via `goal_auto_post_settings`.
* Schedule the cron for the edge function (Supabase Scheduler or
  pg_cron) once the analytics pass is real.
* Add a "Round-up Savings" highlight on `GoalsHubV2Screen` so the jar
  is visually distinct from goal-with-a-target rows (the 🪙 emoji on
  the row already differentiates, but a chip would help).
* Consider deepening the title-category keyword map and folding it
  into the `category` field on `user_savings_goals` so future
  suggestions can group by category.
