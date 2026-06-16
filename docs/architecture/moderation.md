# Moderation system

_Last updated 2026-06-13. Schema landed via migration 152._

The moderation system lets any signed-in user flag a piece of content or
another user, and lets platform admins act on what gets flagged. It is
deliberately separate from circle-internal dispute resolution.

## Two universes: don't conflate them

| Concept | Scope | Detection | Who acts | Where it lives |
|---|---|---|---|---|
| **Platform Admin** | Whole app | row in `admin_users` → `public.is_admin()` | Admins on this surface | `content_reports`, `user_reports`, `moderation_actions` |
| **Circle Admin** | One circle | `circle_members.role='admin'` | The circle's admin | `circles.*`, `circle_*` tables |
| **Elder** | Cross-circle | `elder_*` tables | Elders mediate disputes | `dispute_cases`, `mediation_*` |

These are three different roles for three different problem shapes.
A platform admin is _not_ a super-circle-admin. They cannot dictate
circle rules; they can only act on content reports, user reports, and
suspensions/bans.

## Data model

### `content_reports`
A user flagged a piece of user-generated content.

* polymorphic over `content_type` (`dream_post` / `comment` / `event`
  / `circle_message`) — no FK on `content_id`, the type discriminator
  is the table dispatcher
* `reason` is one of `spam` / `harassment` / `inappropriate` / `other`
* `status` lifecycle: `pending` → `reviewed` / `dismissed`
* RLS: reporter reads their own; admin reads all + updates

### `user_reports`
A user reported another user (platform-level — distinct from circle
disputes).

* `reason` adds `impersonation` to the content-report set
* `status` lifecycle: `pending` → `reviewed` / `dismissed` / `action_taken`
* A reporter cannot file two _pending_ reports against the same target —
  partial unique index `(reporter, reported) WHERE status='pending'`
* RLS: same shape as `content_reports`

### `moderation_actions`
Append-only audit log. Every dismiss / warn / delete / suspend / ban
lands here, written through one of two RPCs (never by clients
directly).

* `action` ∈ `warn` / `suspend` / `ban` / `delete_content` / `dismiss_report`
* `target_type` ∈ `user` / `content`
* RLS: admin SELECT only; no client INSERT

### `profiles` additions
* `suspended_until TIMESTAMPTZ` — set by the `suspend` action, cleared
  by the `auto-expire-suspensions` Edge Function when it falls in the
  past
* `banned BOOLEAN DEFAULT false` — set by the `ban` action

## RPCs

### `apply_moderation_action`
Sole entry point for moderation side-effects. Validates admin, writes
the audit row, mutates the target, drops a notification when the target
is a user.

* `p_action TEXT` — `warn | suspend | ban | delete_content | dismiss_report`
* `p_target_type TEXT` — `user | content`
* `p_target_id UUID`
* `p_reason TEXT` (required)
* `p_duration INTERVAL` (required for `suspend`)
* `p_source_report_id UUID`, `p_source_report_kind TEXT` (optional pointer
  back to the report that triggered the action)

Special: on `delete_content` it dispatches a polymorphic `DELETE` against
`feed_posts` / `feed_comments` / `community_events` / `circle_messages`
based on the `content_type` recorded in `content_reports`, then
auto-dismisses every other `pending` content_report on the same
`content_id` (so duplicate reports of the same post collapse).

User-targeted actions also drop a `notifications` row of type
`moderation_<action>` so the affected user sees what happened and why.

### `resolve_report`
Closes a content_report or user_report row.

* `p_report_id UUID`
* `p_report_kind TEXT` — `content | user`
* `p_action_taken TEXT` — `dismiss | warn | suspend | ban | delete_content`
* `p_admin_notes TEXT`

Maps the action verb to a row status:
* `dismiss` → `dismissed`
* anything else → `reviewed` (content reports) or `action_taken` (user reports)

The action vs. no-action distinction lives in `moderation_actions`, not
in the report row, so we don't duplicate state.

## Frontend surfaces

### Filing reports — `components/ReportButton.tsx`
Reusable trigger + bottom-sheet. Two modes:
* `kind="content"` → `content_reports.insert`
* `kind="user"` → `user_reports.insert`

Hides itself when `ownerUserId === auth.uid()`. Surfaces it's wired into:
* `components/FeedPostCard.tsx` — dream posts (and video posts)
* `components/FeedCommentItem.tsx` — comments
* `screens/EventsScreen.tsx` (inline `EventCard`) — events
* `screens/GroupChatScreen.tsx` (inline `renderMessage`) — circle messages
* `screens/UserDreamProfileScreen.tsx` — report-the-user variant

### Admin queue — `screens/AdminModerationScreen.tsx`
Two-tab queue (content, users). Guarded by `useIsAdmin()` and by the
RLS policies on the underlying tables (defense in depth). Subscribes to
realtime INSERTs on both tables so new pending rows appear at the top
without a manual refresh. Detail modal per row with action buttons that
call `apply_moderation_action()` then `resolve_report()`.

### Entry — `screens/ProfileScreen.tsx`
"Admin tools" section, rendered only when `useIsAdmin()` resolves
positive. Contains:
* Moderation queue → `AdminModerationScreen`
* AI Jobs Health → `AIJobsHealthScreen` (previously dev-only)
* Advance portfolio → `AdminDashboardScreen` (now gated)

## Automation

* **Auto-dismiss on content delete** — `apply_moderation_action` with
  `delete_content` closes every other pending report on the same
  `content_id` in one statement.
* **Auto-expire suspensions** — `supabase/functions/auto-expire-suspensions`.
  Daily cron clears `profiles.suspended_until` rows whose timestamp is
  in the past. Service-role auth. No audit row written (the original
  `suspend` action is already in `moderation_actions`; expiration is
  passive).
* **Notification on user-targeted action** — `apply_moderation_action`
  inserts a `notifications` row of type `moderation_<action>` for warn /
  suspend / ban, so the affected user gets surfaced reasoning.

## Open follow-ups (not P0)

* Severity scoring per-content (so the admin queue can pre-sort)
* Keyword auto-flag (insert pending `content_reports` from a keyword
  scan; admin still has to confirm)
* Repeat-offender heuristic (auto-escalate to suspend after N confirmed
  reports against the same user)
* Public transparency log — read-only view of `moderation_actions`
  summary stats for the community
