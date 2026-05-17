# TandaXn — Working notes for Claude

This is the **source-of-truth** repo. The `../v0-tanda-xn` repo contains
build artifacts only (what Vercel serves). Edit code here; never edit
files in `../v0-tanda-xn` except via the deploy flow below.

---

## Working rules (operate by these)

1. **STOP after each step.** Never chain steps unless explicitly told to.
2. **Verify before assume.** Read code / query DB before changing it.
3. **Read-only diagnostic first.** Code/schema changes only after explicit approval.
4. **Never skip hooks** (`--no-verify`, `--no-gpg-sign`) unless asked.
5. **Never amend.** Always create new commits — pre-commit hook failures
   never produce a stashed commit, so `--amend` would mutate the prior commit.
6. **Stage specific files**, not `git add -A`, unless the diff has been
   reviewed end-to-end.
7. **PATs are short-lived.** User generates a fresh Supabase Management API
   PAT per task and revokes after. Don't reuse PATs across sessions.

---

## Repo layout

| Path | Purpose |
|---|---|
| `tanda-xn-mobile/` (this repo) | Expo SDK 54 React Native + react-native-web source |
| `../v0-tanda-xn/` | Build artifacts deployed to Vercel (`https://v0-tanda-xn.vercel.app/`) |

App entry is `App.tsx` (React Navigation + `linkingConfig` from `lib/deepLinking.ts`).
`package.json` has `"main": "index.ts"`. The `app/(app)/...` directory uses
`expo-router` and is **dead scaffolding** — unreachable from the real navigation.

Web prefixes (from `lib/deepLinking.ts`): `https://tandaxn.com`, `https://v0-tanda-xn.vercel.app`.

---

## Supabase

- Project ref: `fjqdkyjkwqeoafwvnjgv`
- Anon key: hardcoded in `lib/supabase.ts` (line ~7).
- Management API base: `https://api.supabase.com/v1/projects/fjqdkyjkwqeoafwvnjgv/`
- **Management API requires `User-Agent: curl/8.0.1`** or it returns Cloudflare
  1010. Native `node`/`requests` UAs are blocked.
- Auth Admin endpoints (e.g. `POST /auth/admin/users`) are **NOT** exposed via
  Management API path — those live on the project-direct
  `https://<ref>.supabase.co/auth/v1/admin/users` and require the
  service-role key, not a Management PAT. For test users, create via SQL CTE
  into `auth.users` + `auth.identities`. **Important:** set the four
  empty-string token columns explicitly (`confirmation_token`,
  `recovery_token`, `email_change_token_new`, `email_change`) — leaving
  them NULL breaks GoTrue's Go SQL Scan and produces a 500 "Database error
  querying schema" on `/auth/v1/token`.

### Helper script

```
python /c/Users/franck/sql_run.py < query.sql
```

Reads SQL from stdin, posts to `/database/query` with the curl UA, prints
JSON response. Reads `SUPABASE_PAT` from env. `STATUS: 201` = success.

---

## Web bundle deploy flow

```bash
# 1. Build (in this repo)
rm -rf dist
npx expo export --platform web --clear

# 2. Copy artifacts to v0 (capture the new bundle hash from step 1 output)
NEW=index-<hash>.js
OLD=$(ls /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/expo-static/static/js/web/)

rm /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/expo-static/static/js/web/$OLD
cp dist/_expo/static/js/web/$NEW /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/expo-static/static/js/web/
cp dist/index.html dist/metadata.json dist/favicon.ico /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/
rm -rf /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/assets
cp -r dist/assets /c/Users/franck/OneDrive/Desktop/TandaXn/v0-tanda-xn/assets

# 3. Patch index.html: /_expo/  →  /expo-static/  (Vercel routing)

# 4. Commit and push v0 — Vercel auto-deploys in ~30-90s
```

Preserve `v0-tanda-xn/docs/migrations/`, `vercel.json`, `fonts/` — never
overwrite or delete these. The fonts in `v0-tanda-xn/fonts/` are static
hashed `.ttf` files copied once from
`assets/node_modules/@expo/vector-icons/build/vendor/.../Fonts/`; refresh
them only if a vector-icons version bump changes their hashes.

### Verify deploy

```bash
curl -s https://v0-tanda-xn.vercel.app/ | grep -oE 'index-[a-f0-9]+\.js'
curl -sI https://v0-tanda-xn.vercel.app/ | grep -i age
# Age: 0 = fresh deploy. Higher = CDN cached.
```

---

## Git tagging convention

`stable-YYYY-MM-DD-event` — usually paired `pre-X` / `X-shipped`.

| Tag | mobile | v0 |
|---|---|---|
| `stable-2026-04-26-pre-chat` | `52b24f8` | `cce67df` |
| `stable-2026-04-26-chat-shipped` | `75f9d57` | `4b428ef` |
| `stable-2026-04-29-pre-phase2` | `75f9d57` | `4b428ef` |
| `stable-2026-04-29-phase2-shipped` | `1670840` | `def9eb5` |
| `stable-2026-04-30-pre-tier2-cleanup` | `1670840` | `def9eb5` |
| `stable-2026-04-30-tier2-cleanup` | `a54f09e` | `eed46cf` |
| `stable-2026-05-06-pre-rls-cleanup` | `a54f09e` | `eed46cf` |
| `stable-2026-05-06-rls-cleanup` | `a54f09e` | `55a83b0` |

Tag both repos at the same logical state. Push tags explicitly
(`git push origin <tag>` — `git push` does not push tags).

Mobile is at the same commit for `pre-rls-cleanup` and `rls-cleanup` because
Tier 3 was DB-only (no source changes). v0 differs because the migration
docs were committed there.

---

## What's shipped

- **Phase 1 (Apr 26)**: Real-time circle group chat. `circle_messages` table + RLS
  + `GroupChatScreen.tsx` realtime subscription.
- **Phase 2 (Apr 29)**: System messages on circle join. `complete_circle_join`
  RPC posts two `circle_messages` rows ("X joined…" / "X contributed $Y for Cycle 1")
  via SECURITY DEFINER, bypassing RLS. Frontend has defensive null/empty body
  guard. Sub-EXCEPTION block in RPC ensures chat-write failures don't roll back
  the join transaction.
- **Tier 2 cleanup (Apr 30)**: Stripe `.single()` → `.maybeSingle()` (406 fix);
  full token system removed (~2900 LoC, 7 files deleted) — TandaXn does NOT
  use platform tokens; Elders monetize via Stripe Connect (USD).
  Three `TODO(elder-payouts)` stubs in `context/ElderContext.tsx` mark where
  future Stripe USD payouts go (vouching, dispute resolution, course completion).
- **Tier 3 RLS cleanup (May 6)**: Enabled RLS on `marketplace_providers`.
  Dropped 18 unused SECURITY DEFINER views in `public` (V0-port leftovers
  exposing PII/financial data via anon key). Converted 36 used SECURITY
  DEFINER views to SECURITY INVOKER + revoked anon SELECT. All 56 ERROR-level
  Supabase advisor lints cleared (638 → 583 lints, 56 → 0 ERRORs). DB-only
  work — no source changes. Migration docs in
  `v0-tanda-xn/docs/migrations/2026-05-06-rls-*.sql`.

---

## Known anomalies / dead scaffolding

- **`services/XnScoreEngine.ts:1003`** — stray closing brace, blocks
  `tsc --noEmit`. Pre-existing since `0d74951` (Send Money screen fixes).
  Build still works because Metro/Babel strips types without invoking `tsc`.
  1-character delete will fix.
- **`app/(app)/...`** — unreachable expo-router files. Real entry is `App.tsx`.
  Don't add features here; don't trust them as live code.
- **`user_events` 401 on sign-out** — `EventService` logs sign-out with
  already-revoked session, gets 401, self-disables for 5 min. Fix: log
  before `signOut()` or guard with auth check.
- **`aria-hidden` focus retention warning** — modal/screen transition
  accessibility hygiene. Not regression-caused.
- **Console warnings that are fine and expected**: `useNativeDriver`,
  `expo-notifications` listener, `QRCode library not available`.

---

## Active backlog

### Next priority — Tier 4 RLS hardening (41 `USING (true)` policies)

After Tier 3 (May 6), 583 advisor lints remain (0 ERRORs). The next-priority
chunk is the **41 `rls_policy_always_true`** WARN lints — RLS policies that
are effectively no-ops because their `USING` clause is literally `true`.
Tables look secure (`rls_enabled = true`) but the rule lets everyone through.

Approach (mirrors Tier 3 batches):
1. Read-only diagnostic — query `pg_policy` filtered to `pg_get_expr(polqual,
   polrelid) = 'true'` in `public` schema. Get full list with table + role
   coverage + cmd type.
2. Per-table classification in batches of ~10:
   - **A. Replace with scoped condition** — most policies should be
     `auth.uid() = user_id` or membership-based.
   - **B. Restrict by role** — `USING (auth.role() = 'service_role')` for
     internal-only tables.
   - **C. Document and keep** — only if the table is genuinely public-read
     (e.g. reference data already published anyway).
3. Per-batch SQL with verification, smoke test, tag.

Note: 1 of the 41 is `marketplace_providers.service_all` from Tier 3 —
service-role-only by design, low concern. May be re-classified rather than
rewritten.

### Rest of Tier 4 (lower priority, in rough order)

- 272 SECURITY DEFINER functions exposed to anon/authenticated
  (136 anon-callable + 136 authenticated-callable; same set, two lints each).
  Per-function review: SECURITY INVOKER conversion or REVOKE EXECUTE.
- 260 `function_search_path_mutable` — mechanical fix. Add
  `SET search_path = public, pg_temp` to each function definition. Compounds
  with the SECURITY DEFINER set above (an attacker who can shadow a schema
  could redirect a SECURITY DEFINER function to malicious code).
- 5 `public_bucket_allows_listing` — verify each storage bucket is
  intentionally listable (e.g. avatars yes, KYC docs no).
- 1 `extension_in_public` — move the offending Postgres extension from
  `public` to `extensions` schema (one ALTER EXTENSION).
- 4 `rls_enabled_no_policy` (INFO) — `default_escalations`,
  `default_recovery_attempts`, `payout_order_audit_log`, `position_constraints`.
  Currently locked down to service_role only by absence of policies; either
  add explicit "deny all" comment-policy or document why empty is intentional.

### Tier 4 (audit / observability) — Unknown deletion path for `auth.users`

On 2026-05-11, ~7 confirmed test users (`vjekimagui+verifytest*`, `+polish*`,
`+passwordfix*`, `+authdiag*`) disappeared from `auth.users` between the Bug
D backfill query (15:00 UTC, 11 users present) and the Bug B/C diagnostic
(17:00 UTC, 4 users remaining). 2-hour window with no scheduled cron run
that could explain it.

Investigation completed read-only via Management API:

- **No DELETE/UPDATE triggers on `auth.users`** — only `on_auth_user_created`
  (INSERT). Nothing automatic deletes via trigger.
- **`cleanup_old_data()` cron** (Sat 3am) — body confirmed: cleans
  `notifications`, `notification_queue`, trims `xn_score_history`. Does
  NOT touch `auth.users`.
- **`process_pending_deletions()` cron** (daily 4am) — body confirmed: loops
  over `user_deletion_requests` WHERE `status='pending' AND retention_end_date
  <= CURRENT_DATE`. **`user_deletion_requests` table is empty (0 rows).**
- **No retention/TTL config** in Supabase auth config (`mailer_autoconfirm`,
  `*_otp_exp` only).
- **`auth.audit_log_entries` table is empty (0 rows total, ever).** Audit
  logging into this table is disabled or never enabled for this project, so
  there is NO DB-side audit trail of `auth.users` mutations — not even normal
  signups.

**Highest-likelihood remaining hypothesis**: manual deletion via Supabase
Dashboard's Auth admin UI. That action calls `auth.admin.deleteUser` directly,
bypasses `user_deletion_requests`, leaves no audit trail in `public` schema,
and only logs in Supabase's internal observability dashboard (Logs → Auth
logs tab — not queryable from Management API DB path).

**Risk**: if cause is not manual-Dashboard (i.e., something else is silently
deleting users), real user data is at risk in production. **Action before
launch**: (1) confirm with project-admin humans whether deletion was manual
on 2026-05-11; (2) if not, escalate to Supabase support to identify the
caller via internal logs; (3) consider enabling `auth.audit_log_entries`
logging via `GOTRUE_AUDIT_LOG_ENABLED` env or equivalent.

**Action before launch**: enable Supabase audit logging (Pro tier feature).
Required for any future incident investigation of user data anomalies.

---
### 2026-05-17 — Bug C2 shipped but unsmoke-tested

**What shipped:** SetPasswordScreen "Skip for now" button now opens an
Alert.alert modal warning that without a password, the user will only
be able to sign in via email magic-link. Code committed in
`a68a46c` and present in production bundle
`index-80cfcdddab781b9721ef0a2c867b627d.js` (verified via grep for
"Skip password setup").

**Why untested:** Reaching SetPasswordScreen as a password-less user
requires a magic-link sign-in path. The Login screen's "Forgot
password?" button triggers `resetPasswordForEmail()` → routes to
`/reset-password` (ResetPasswordScreen, a different screen). There is
no obvious UI affordance on the Login screen to trigger
`signInWithOtp()` for an existing password-less user. Magic-link sign-in
exists in the codebase but is not wired to the Login screen.

**Risk of untested ship:** Low. Diff was 15 lines, code-reviewed
before commit, both fix strings verified in production bundle. Fix is
contained to a single button onPress handler — no schema, no RPC, no
auth side effects.

**Open Tier 4 follow-up:** Add a "Sign in with email link" affordance
to the Login screen for QuickJoin / magic-link-only users. Without
this, password-less users created via QuickJoin have no entry path
back to the app once their initial session expires.
---

### Smaller items (carryover from Tier 2)

- Fix `services/XnScoreEngine.ts:1003` stray brace (1-char, ~5 min,
  unblocks `tsc --noEmit`).
- Fix `user_events` 401 on sign-out (move log before `signOut()` or guard
  with auth check, ~10 min).
- `makeContribution` `due_date NOT NULL` fix (~10 min).
- Phase D polish: already-in-circle screen + Dashboard join toast (~30 min).
- Wallet refresh on Dashboard after navigation back (~30 min).
- Audit `aria-hidden` focus retention warnings (hygiene).

---

## Test user (Phase 2 smoke test)

Created via SQL CTE on Apr 29:
- email: `phase2test@tandaxn.dev`
- password: `Phase2Test!2026`
- UUID: `4a11046b-ed30-4a10-b5b8-e55a37abf46b`
- Joined Cercle Abidjan 2026 (`32775dac-b75d-4d99-a41e-5b4aabf3771c`),
  contributed $100, has 2 system messages authored.
- Real DB resident — clean up before formal demo if needed.
