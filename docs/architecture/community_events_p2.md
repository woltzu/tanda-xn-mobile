# Community Events P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 158._

P2 adds four learning surfaces to community events:
**categorise**, **cross-post**, **suggest a price**, and **remind 24h
ahead**. The category is the primary discriminator the rest depend on.

## Data model (migration 158)

| Object | Purpose |
|---|---|
| `community_events.category TEXT` | nullable, CHECK `('birthday','wedding','concert','community','business','other')`. Index on `(category, event_datetime DESC) WHERE category IS NOT NULL` for the price-suggestion query. Nullable so the pre-P2 rows stay valid without a backfill. |
| `community_activity(id, user_id, activity_type, content, related_event_id FK, metadata, is_auto, created_at)` | Separate from `feed_posts` so we don't pollute the dream-feed type CHECK / POST_TYPE_CONFIG. Authenticated SELECT for everyone (public feed by design). Trigger writes via SECURITY DEFINER; no client INSERT path. |
| `post_event_to_community()` AFTER INSERT trigger on `community_events` | Inserts one `community_activity` row per new event with a templated caption ("📅 New event: ... on ... at ..."). |
| `suggest_event_price(category, location_name) → NUMERIC` | Median price of priced same-category, same-location events created in the last 6 months. NULL when no comparables — caller hides the chip. SECURITY DEFINER, `STABLE`. |

## Frontend

### `hooks/useEvents.ts`
* `EventCategory` type + `EVENT_CATEGORIES` const exported. `CommunityEventRow` and `CreateEventInput` extended with `category`.
* `categoriseFromTitle(title)` — keyword map (~25 keywords across 5 categories; 'other' is the default null result). Drives the title-blur auto-categorisation.
* `suggestEventPrice(category, location)` — thin async wrapper around the RPC. Returns `null` on no signal so the caller can hide the chip with a single null-check.

### `screens/CreateEventScreen.tsx`
* New "Category" row of 6 chips below the title.
* On title blur, runs `categoriseFromTitle`. If it returns a category and the user hasn't manually picked one yet, prefills + shows an italic hint ("Auto-set as X based on your title — change it any time.").
* When `category` and `locationName` are both set, calls `suggestEventPrice` and renders a teal chip next to the price field: "Similar events charge $X — use that?". Tapping fills the price input.
* Insert payload now includes `category` — the new column accepts NULL so older code paths stay valid.

### `screens/EventsScreen.tsx` (inline `EventCard`)
* Small uppercase category chip under the title. Hidden when the event row predates the column (`category IS NULL`).
* Card title now lives in a `cardTitleCol` flex container so the chip wraps cleanly under it.

## Edge Function — send-event-reminders

`supabase/functions/send-event-reminders/index.ts`. Daily.

```
events = community_events WHERE event_datetime BETWEEN now AND now+24h  (cap 200)
recipients = profiles  (cap NOTIFICATION_USER_CAP = 5000)
for ev in events:
  for r in recipients:
    if notifications has type='event_reminder' AND data.event_id=ev.id in last 48h:
      skip
    else:
      insert notification (event_id in data.event_id)
```

The recipient set is "all active profiles" today because there's no RSVP
table. When an RSVP table lands, swap the `recipients` query to scope to
interested users. The 48h dupe-check keeps a missed cron run from
double-notifying.

Deployment:
```
supabase functions deploy send-event-reminders --no-verify-jwt
```
Schedule via Supabase Scheduler or pg_cron, daily ~09:00 UTC.

## Open follow-ups (not P2)

* **RSVP / saved-event table** — scope the 24h reminder to interested
  users instead of broadcasting.
* **Unified community feed screen** — UNION `community_activity` with
  `feed_posts` (filtered to public + non-dream types) so events,
  milestones, and dreams share a single chronological surface.
* **Smarter location matching** — `suggest_event_price` matches on exact
  `location_name`. Tokenised match or a `city` column on
  `community_events` would catch close-by alternatives.
* **Per-creator opt-out** for the auto-cross-post (mirror of
  `goal_auto_post_settings`).
* **Localised category keywords** — `categoriseFromTitle` is English-only
  today; add a parallel FR keyword set for francophone titles.
