# Admin Moderation P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 162, on top of the
Option B moderation surface from migration 152._

P2 layers four automation loops on the existing admin queue:
**auto-flag** content reports against a curated keyword list, **auto-
dismiss** reports when the author deletes their own row before review,
**auto-escalate** repeat offenders to suspensions and bans, and **digest**
the week's moderation activity to every admin.

## Data model (migration 162)

| Object | Purpose |
|---|---|
| `moderation_keywords(id, keyword, severity, created_at)` | Admin-curated wordlist. UNIQUE on keyword so the trigger doesn't double-count. Admin-only RLS — the list itself is sensitive (it reveals what we flag on). |
| `content_reports.priority TEXT NOT NULL DEFAULT 'normal'` + CHECK in `low/normal/high` | Drives queue order. Default is `'normal'`; the auto-flag trigger bumps to `'high'`. |
| `content_reports.tags TEXT[] NOT NULL DEFAULT '{}'` | Carries "Auto-flagged: kw" tags from the trigger and any later admin annotation. |
| `user_reports.priority` + `.tags` | Same shape — admin treats both lists identically. |
| `check_content_for_keywords(p_content) → TEXT[]` | Returns the matched keywords (case-insensitive, whole-word regex `\m…\M`). |
| `auto_flag_content_report()` BEFORE INSERT trigger on `content_reports` | Polymorphic content fetch → keyword scan → stamps priority + tags. |
| `auto_dismiss_reports_on_content_delete()` AFTER DELETE triggers on `feed_posts` / `feed_comments` / `community_events` / `circle_messages` | Bulk-dismisses pending content_reports with the "content_removed" tag. |
| Extended `moderation_actions.action` CHECK | Adds `auto_suspend` + `auto_ban` so the repeat-offender cron can log distinct verbs. |

### Why a BEFORE INSERT trigger instead of an Edge Function

The spec offered both. The trigger wins because:
1. It runs in the same transaction as the report INSERT, so priority
   never lags behind the row landing.
2. It scales with the report rate, not on a fixed cron cadence — a
   spam wave sees instant uplift.
3. Idempotency is automatic: each report row fires the trigger exactly
   once at INSERT time. No catch-up logic.

## Edge Functions

| Function | Cadence | Job |
|---|---|---|
| `check-repeat-offenders` | daily | 3 warnings/30d → `auto_suspend` (7 days), 2 suspensions/90d → `auto_ban`. Idempotent via same-day lookup on existing `auto_*` actions per target user. |
| `detect-report-spikes` | daily | ≥5 reports against one content author in 24h → bulk priority='high' + 'spike_detected' tag on those reports + admin_alert notification (throttled 48h per admin / author pair). |
| `send-admin-digest` | weekly (Mon 08:00 UTC) | Counts last 7d new/resolved reports + per-action tallies. One admin_digest notification per active admin_users row. Dupe-skipped over 6-day window. |

All three are service-role and skip-on-conflict idempotent. Deploy:

```
supabase functions deploy check-repeat-offenders --no-verify-jwt
supabase functions deploy detect-report-spikes --no-verify-jwt
supabase functions deploy send-admin-digest --no-verify-jwt
```

Schedule via Supabase Scheduler or pg_cron — daily ~07:00 / 07:10 and
weekly Monday ~08:00 UTC respectively.

## Frontend — `screens/AdminModerationScreen.tsx`

* `ContentReport` and `UserReport` types now expose `priority?` and
  `tags?: string[]`.
* `sortByPriority(rows)` is applied at fetch time so the queue always
  leads with high-priority items.
* New **priority pill** between the type badge and the date (hidden
  when priority is `normal`). Red on `high`, indigo-on-white on `low`.
* New **tag chip row** at the bottom of each card. Shows the first 4
  tags (typically `Auto-flagged: kw` + any later admin tags like
  `spike_detected` or `content_removed`).

## i18n + docs

- 14 new keys under `moderation_p2.*`. EN/FR parity at
  **5375 leaf keys each**.

## Seeding the keyword list

The migration leaves `moderation_keywords` empty by design — wordlists
are jurisdiction-specific and we'd rather ship none than ship the wrong
ones. Operator seeds via the admin path:

```sql
INSERT INTO moderation_keywords (keyword, severity) VALUES
  ('scam',          'high'),
  ('crypto giveaway','high'),
  ('hate-speech-1', 'high');
```

Once a row exists, every subsequent `content_reports.INSERT` runs through
the keyword check.

## Open follow-ups (not P2)

* **Localised keyword scan** — the regex is ASCII whole-word; French
  accented words wouldn't match. Either dual-list (en / fr) or move to
  `unicode` regex with `\b` semantics.
* **Auto-flag for the originating content INSERT** — today only
  content_reports are scanned. A future trigger could pre-flag
  `feed_posts.INSERT` so the content lands in the admin queue without a
  reporter even filing.
* **Severity-aware action** — `moderation_keywords.severity` is recorded
  but not yet read. A future enhancement: severity='high' → priority
  jumps to 'high' (current behaviour), severity='medium' → priority
  bumps to 'normal' but no automatic admin alert. Today all hits jump
  to 'high'.
* **Per-admin digest preferences** — opt-out / cadence override
  (weekly / daily / off) keyed by admin_users row.
* **Surface auto-escalation in the UI** — the new
  `moderation_actions.action` enum values are written by the cron but
  the AdminModerationScreen action labels haven't been extended to
  render `auto_suspend` / `auto_ban`. Quick follow-up in the same
  screen.
