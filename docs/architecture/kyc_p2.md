# KYC P2 — Automation & Learning

_Last updated 2026-06-14. Schema landed via migration 160._

P2 closes four user-visible loops on the KYC flow: smart-route the Start
CTA based on prior state, auto-submit when every required tile is
uploaded, surface a status-change push notification on every terminal
state transition, and tell the user *exactly* what to fix when the
verification rejects.

## Why we reused `rejection_reason` instead of adding `failure_reason`

The spec called for a new `failure_reason TEXT` column. Discovery showed
that **`kyc_verifications.rejection_reason` and `.rejection_code` already
exist** — the Persona pipeline already writes them. Adding a parallel
column would just split the truth across two fields and force every
write path to dual-stamp them.

So migration 160 keeps the existing columns and adds a SQL helper
(`kyc_reason_humanize`) that maps the Persona code into a small bounded
UX bucket the frontend renders specific copy against:

| `rejection_code` lower | UX bucket |
|---|---|
| `image_quality_low`, `blurry`, `glare`, `low_resolution`, `low_quality` | `image_quality_low` |
| `id_expired`, `document_expired`, `expired` | `id_expired` |
| `face_mismatch`, `selfie_mismatch`, `no_face_detected` | `face_mismatch` |
| anything else | `other` |

The screen mirrors that mapping client-side as `humanizeReason()` so it
doesn't have to round-trip the helper RPC just to pick a banner.

## Data model (migration 160)

| Object | Purpose |
|---|---|
| `kyc_verifications.last_reminded_at TIMESTAMPTZ` | Anchor for a future "re-upload your documents" reminder cron. Set by the rejection branch of the trigger. |
| `kyc_reason_humanize(rejection_code)` | Pure SQL helper. STRICT IMMUTABLE so it inlines. |
| `notify_kyc_status_change()` + `kyc_verifications_status_change` trigger | AFTER UPDATE OF status. Fires only when status changes and only on transitions into `approved` / `rejected` / `expired`. Writes one `notifications` row branched by status and (for rejections) by humanized reason. |

The trigger writes `notifications.type = 'kyc_' || NEW.status` so the
inbox can filter by family.

## Frontend

### `screens/KYCHubScreen.tsx` — smart routing
* On mount, fetches `profiles.country` + the latest `kyc_verifications` row (`id_type`, `tax_id`).
* `routingHint.idType` picks the best default for `KYCDocumentScreen`:
  * resume with the user's prior `id_type` when one exists
  * else `national_id` when `profiles.country` is US/USA
  * else `passport`
* The Start CTA passes `idType` so `KYCDocumentScreen` skips the
  document-type picker (which it was already param-driven for).

### `screens/KYCDocumentScreen.tsx` — auto-submit + failure copy
* New `useEffect` watcher fires `handleSubmit()` once `canSubmit` flips
  to true. `autoFiredRef` keeps it from re-triggering if the screen
  re-mounts. 250ms defer so the uploaded thumbnail renders before the
  navigate-away.
* Auto-submit banner (teal, with `ActivityIndicator`) visible while
  `submitting` is true.
* On mount, one-shot fetch of the latest `kyc_verifications` row.
  When `status='rejected'`, mirrors the SQL `kyc_reason_humanize` to
  pick one of four UI buckets and renders a specific instruction
  banner above the tiles.

## Notification flow

```
kyc_verifications UPDATE status     (Persona webhook handler)
  ↓ AFTER UPDATE OF status trigger
  ↓ skip if NEW.status == OLD.status
  ↓ skip if NEW.status NOT IN (approved, rejected, expired)
  ↓ bucket = kyc_reason_humanize(NEW.rejection_code)
  ↓
notifications INSERT (
  user_id = member_id,
  type    = 'kyc_' || status,
  title/body branched by status + bucket,
  data    = {kyc_id, status, rejection_code, reason_bucket}
)
```

No edge function needed for this loop — the trigger covers it.

## Open follow-ups (not P2)

* **Reminder cron using `last_reminded_at`** — surface a "re-upload
  your documents" notification 48h after a rejection if the user
  hasn't started a new attempt yet. Today the column gets stamped but
  nothing reads it.
* **Document expiry watchdog** — schedule a daily job that flips
  `status = 'expired'` on approved rows whose
  `next_reverification_at < now()`. The trigger will fire the
  expired-status notification automatically once that lands.
* **i18n notification body** — today the trigger inserts English
  strings into `notifications.body`. Localising requires either
  emitting a template id + payload (and rendering on the client) or
  resolving the locale server-side from `profiles.preferred_language`.
  The Send-Money + Score Hub notifications have the same issue —
  worth one shared follow-up.
* **Multi-row history support** — `useKYCStatus` reads the "latest"
  verification, but if a user submits multiple attempts (rejected
  → new attempt), we may show the wrong failure bucket. Once
  `rejection_count` exceeds 1, prefer the most recent row.
