# Dream Feed P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 159._

P2 closes three loops on top of the existing dream feed: server-side
hashtag extraction, a dream-support engagement nudge, and a goal-linked
caption suggestion on the create screen. The milestone-auto-post path
shipped with Goals P2 (migration 155) and was confirmed in place during
discovery — no additional wiring needed here.

## Verification — milestone auto-post (mig 155)

Spec called for ensuring 25/50/75/100% goal crossings auto-post to the
dream feed. Verified in the database — trigger `goal_milestone_auto_post`
is attached to `goal_milestones` AFTER INSERT and routes through
`post_goal_milestone_to_feed()`, which writes `feed_posts (type='milestone',
is_auto=true, linked_goal_id)`. Honours `goal_auto_post_settings.milestones_enabled`
opt-out and skips `goal_type='round_up'` jars. No P2 change.

## Data model (migration 159)

| Object | Purpose |
|---|---|
| `feed_posts.hashtags TEXT[]` | Auto-extracted from `content`. Stored lowercased, deduped, sorted, without the leading `#`. GIN index for cheap "posts tagged X" lookups when a hashtag-search screen lands. |
| `extract_hashtags()` BEFORE INSERT/UPDATE trigger | Runs on every write that touches `content`. Regex `#[A-Za-z0-9_]{1,40}`. Idempotent: same content → same array. |
| `dream_supports(user_id, post_id, amount_cents, money_transfer_id, message, created_at)` | One row per (supporter, dream). `UNIQUE(user_id, post_id)` makes the cron's LEFT JOIN cheap. RLS: supporter sees own; dream author sees rows targeting their post (for a future supporters list). |
| Backfill | Touches every `feed_posts` row once to populate `hashtags` from the existing content. The trigger fires automatically on each UPDATE. |

## Frontend

### `context/FeedContext.tsx`
* `FeedPost.hashtags: string[]` added. `FeedPostRow.hashtags?: string[] | null` mirrored. `rowToPost` hydrates with empty-array fallback.

### `components/FeedPostCard.tsx`
* Renders a teal chip row under the post content for any non-empty
  `hashtags` array. Chips render `#tag` with no onPress handler — tap is
  reserved for a future hashtag-search screen.

### `screens/CreateDreamPostScreen.tsx`
* New "Share progress on {goal}?" chip above the caption input.
* `suggestedGoal` = highest-`updatedAt` from `getActiveGoals()`. Chip is
  hidden when no active goal exists, when the user has already typed a
  caption, or when they've already picked a goal manually.
* Accepting the chip pre-fills the caption ("Latest update on X: ")
  and calls `setSelectedGoal(suggestedGoal)` so the post lands linked.

## Edge Function — remind-dream-support

`supabase/functions/remind-dream-support/index.ts`. Daily.

```
likes    = feed_likes    WHERE created_at >= now() - 7d  (cap 5000)
comments = feed_comments WHERE created_at >= now() - 7d  (cap 5000)
pairs    = unique (user_id, post_id) across both
posts    = feed_posts WHERE id IN pairs.post_id
supports = dream_supports WHERE post_id IN pairs.post_id

for pair in pairs:
  skip if pair already in supports
  skip if post.user_id == pair.user_id     (self-engagement)
  skip if post.type != 'dream'             (no milestone nudges)
  skip if notifications has type='dream_support_reminder'
         AND data.post_id = pair.post_id   in last 14 days
  insert notification (type=dream_support_reminder)
```

Notification body: `You cared about "{first 60 chars of content}…" —
want to chip in and help it happen?`. Deep link uses
`data.post_id` so the existing FeedPostDetail handler can route.

Deployment:
```
supabase functions deploy remind-dream-support --no-verify-jwt
```
Schedule daily ~10:00 UTC (after the goal-milestone trigger fires its
own posts and before the user's morning notification check).

## Open follow-ups (not P2)

* **Hashtag search screen** — the GIN index is ready; FeedPostCard
  chips just need an onPress handler that navigates to a new
  `HashtagSearch` route.
* **Wire SupportDreamScreen to insert into `dream_supports`** — today
  the existing SupportDreamScreen creates a `money_transfers` row
  (P0.1 from the Dream Feed audit) but doesn't write the
  post-side anchor. Until that wire lands, the cron will keep nudging
  even after successful supports. Quick follow-up: extend
  SupportDreamScreen's success path to `INSERT INTO dream_supports
  (user_id, post_id, amount_cents, money_transfer_id) VALUES (...)
  ON CONFLICT DO NOTHING`.
* **Localised hashtag extraction** — current regex is ASCII only.
  French accented hashtags (`#épargne`, `#famille`) would need
  `[\p{L}\p{N}_]` matching, which requires the `pgcrypto` regex flag
  or a switch to `unicode` patterns.
* **Per-post opt-out for the reminder** — currently the cron
  re-nudges the same engager about a different post after 14 days. A
  dedicated "Don't remind me" mark would help.
