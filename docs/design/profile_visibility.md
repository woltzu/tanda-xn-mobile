# Doc 40 — Profile Visibility Design

**Status:** Proposed (pre-implementation)
**Date:** 2026-07-27
**Scope:** Defines what a member's profile exposes to whom, the controls
members have over that exposure, and the audit trail that keeps
elder/admin access accountable.

**Related docs:**
- Doc 37 — Circle Reputation (referenced; defines XnScore, vouches, and
  the reputation surface Doc 40 controls visibility on).
- Doc 38 — Circle Closing and Correction Workflow (defines the admin
  scope Doc 40's access log records against).
- Migration 133 — `community_privacy_controls` (established the
  opt-out + audit-log pattern reused here).

---

## 1. Overview

### 1.1. Purpose

Members bring real financial and personal data into TandaXn. A rotating
savings circle only works when other members can trust each other's
reliability signals, but that trust must not require broadcasting
everything to everyone. Doc 40 defines the boundary: what each viewer
sees, what the member controls, and what the platform records.

### 1.2. Guiding principles

1. **Trust through evidence, not exposure.** Reliability signals
   (XnScore, contribution status, payout position) are visible to
   people who need them to make decisions — not to the whole app.
2. **Sensitive categories opt-in by default.** Faith, life stage,
   identity/health-based community membership is not visible unless
   the member explicitly opts in.
3. **Wallet is private, always.** Balance is never visible to any
   other viewer, including elders and admins.
4. **Every privileged access is logged.** When an elder or admin sees
   member contact info, the fact is recorded and the member can view
   the log.
5. **Members cannot hide reliability.** XnScore, contribution status,
   and payout position within a circle are core to how circles work.
   Members can restrict WHO sees them via circle membership, but they
   cannot toggle them off for circle co-members.

---

## 2. Visibility Tiers

Four tiers, each strictly narrower than the previous:

| Tier | Who is in it | Default reach |
|------|--------------|---------------|
| **All Members** | Any signed-in TandaXn user | App-wide surfaces (community rosters, marketplace, event lists). |
| **Circle Members** | Members of a circle the viewer and target share. Also includes **invite context** — the inviter and the invitee during an active circle invitation. | Reliability + reputation signals (XnScore, vouches, contribution status). |
| **Elders/Admins** | Elders in a circle the viewer and target share (during active disputes/escalations only); platform admins (KYC purposes only). | Contact info, KYC metadata. **Event-triggered and logged** — see §6. |
| **Self** | The target member themselves | Everything, including wallet balance and their own access log. |

**Notes:**

- A viewer can occupy multiple tiers simultaneously (an elder in a
  shared circle is both `Circle Members` and `Elders/Admins`), and
  sees the union of the tiers they qualify for.
- The `Elders/Admins` tier is **not** ambient — see §6 for the
  event-triggered access model.

---

## 3. Data Points Visibility Matrix

| Data point | All Members | Circle Members | Elders/Admins | Self | Member can toggle? |
|------------|-------------|----------------|---------------|------|--------------------|
| Display name | ✅ | ✅ | ✅ | ✅ | ❌ (name is required) |
| Avatar | ✅ | ✅ | ✅ | ✅ | ❌ (can change, not hide) |
| Bio | ✅ | ✅ | ✅ | ✅ | ✅ (can leave empty) |
| City | ❌ default (per §5) | ✅ default | ✅ | ✅ | ✅ (via category toggle) |
| Country of residence | ❌ default (per §5) | ✅ default | ✅ | ✅ | ✅ (via category toggle) |
| Country of origin | ❌ default (per §5) | ✅ default | ✅ | ✅ | ✅ (via category toggle) |
| Communities (Geographic) | ✅ default | ✅ | ✅ | ✅ | ✅ (§5) |
| Communities (Professional) | ✅ default | ✅ | ✅ | ✅ | ✅ (§5) |
| Communities (Life Stage) | ❌ default | ✅ if opt-in | ✅ | ✅ | ✅ (§5) |
| Communities (Faith & Religion) | ❌ default | ✅ if opt-in | ✅ | ✅ | ✅ (§5) |
| Communities (Identity/Health) | ❌ default | ✅ if opt-in | ✅ | ✅ | ✅ (§5) |
| **XnScore** | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ (see §4) |
| **XnScore factor breakdown** | ❌ | ❌ | ❌ | ✅ | ❌ (self-only) |
| **Contribution status** (within a circle) | ❌ | ✅ (shared circle only) | ✅ | ✅ | ❌ (core to circle mechanics) |
| **Payout position** (within a circle) | ❌ | ✅ (shared circle only) | ✅ | ✅ | ❌ (core to circle mechanics) |
| Active circle count | ✅ | ✅ | ✅ | ✅ | ❌ |
| Completed circles count | ✅ | ✅ | ✅ | ✅ | ❌ |
| Default history (aggregate: count) | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ |
| Default history (per-circle detail) | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Vouches Given** (count + list, see §7) | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ |
| **Vouches Received** | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ |
| **Vouches that ended in default** (counter) | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ |
| Trust tier | ❌ | ✅ (shared circle) + invite context | ✅ | ✅ | ❌ |
| KYC level (verified / pending / none) | ❌ | ✅ (shared circle only) | ✅ | ✅ | ❌ |
| KYC document images / extracted PII | ❌ | ❌ | ✅ (platform admin only, logged) | ✅ | ❌ |
| Email address | ❌ | ❌ | ✅ (event-triggered, logged — §6) | ✅ | ❌ |
| Phone number | ❌ | ❌ | ✅ (event-triggered, logged — §6) | ✅ | ❌ |
| Physical address | ❌ | ❌ | ✅ (platform admin only, KYC-triggered, logged) | ✅ | ❌ |
| **Wallet balance** | ❌ | ❌ | ❌ | ✅ | ❌ (always private) |
| Wallet transaction history | ❌ | ❌ | ❌ (except case-specific ledger events surfaced under Doc 38) | ✅ | ❌ |
| Stripe Connect payout account | ❌ | ❌ | ❌ | ✅ | ❌ |
| Marketplace provider profile (if member is a Verified Provider) | ✅ | ✅ | ✅ | ✅ | ✅ (member can hide the provider profile itself) |
| Access log (§8) | ❌ | ❌ | ❌ | ✅ | ❌ |

**Legend:**
- ✅ = visible in that tier by default.
- ❌ = not visible in that tier.
- "Invite context" = the inviter (when they extend an invite) and the
  invitee (once the invite is accepted or pending) each see the
  reputation surface for the other party for the duration of the
  invite/join flow.

---

## 4. XnScore Visibility (Revision 1)

**Rule:** XnScore is visible only to (a) members in a shared circle
with the target, and (b) parties in an active circle invitation
context (both inviter and invitee).

**Not visible:**
- App-wide (community rosters, marketplace listings, comment threads).
- To elders/admins outside a shared circle or an escalated dispute.
- To any member who is *browsing* a circle they haven't joined — the
  score reveals only once the join is committed or the invite is
  pending.

**Why:**
- XnScore is a reliability signal for people about to trust the
  member with their money. It is not a public rating.
- Broadcasting the score everywhere would incentivise gaming (users
  optimising for the number) and stigmatise low-scored users who are
  perfectly good members of non-financial community surfaces.

**Factor breakdown** (which signals contributed to the score, at what
weight) remains **self-only** in all tiers. Circle co-members see the
composite number, not its components.

**Enforcement location:** at the API layer, in the profile-read RPC
(§9). The client's `HonorScoreOverviewScreen` respects the same
rule — score is not returned in the payload for viewers who do not
qualify, so the client cannot render it.

---

## 5. Communities Visibility (Revision 2)

Community memberships are visible per-category, not as a single
"communities on / off" toggle. Each member picks per category.

### 5.1. Category defaults

| Category | Default visibility | Included community types |
|----------|--------------------|--------------------------|
| **Geographic** | ✅ ON | `local`, `diaspora` (city, country of residence, country of origin, regional groups). |
| **Professional** | ✅ ON | `professional`, `school` (employer, industry, alumni networks). |
| **Life Stage** | ❌ OFF | Age/family-status-adjacent groups (parents, retirees, new-arrivals). Includes `interest` and `general` groups whose `metadata.category = 'life_stage'`. |
| **Faith & Religion** | ❌ OFF | `faith` and any `sync_room`-derived worship community. |
| **Identity/Health** | ❌ OFF | Groups whose `metadata.category` is `identity` or `health` (LGBTQ+, chronic illness support, recovery, etc.). |

**Why these defaults:**

- **Geographic** and **Professional** are the categories members
  already share publicly in most social contexts (LinkedIn, city on
  their profile). Making them ON by default matches expectation.
- **Life Stage**, **Faith & Religion**, and **Identity/Health** are
  the categories that expose the member to targeted discrimination
  or unwanted outreach. Opt-in respects that even when the member
  has joined the underlying community for their own benefit.

### 5.2. Toggle mechanics

- Each category is a single boolean per user, stored per-category
  (not per-community).
- A category toggle set to ON exposes membership in **every** community
  of that category the member belongs to; OFF hides all of them from
  the `All Members` tier.
- Circle co-members and elders/admins see the full community list
  regardless of category toggles — the toggle governs the `All Members`
  tier only. (Rationale: a circle co-member evaluating whether to lend
  through you should see the full context; a random app user should
  not.)

### 5.3. Schema addition

`communities` table needs a `metadata.category` value in
`{'geographic', 'professional', 'life_stage', 'faith', 'identity',
'health'}`. Existing rows will be back-filled by:
- `community_type IN ('local', 'diaspora')` → `'geographic'`
- `community_type IN ('professional', 'school')` → `'professional'`
- `community_type = 'faith'` → `'faith'`
- `community_type = 'sync_room'` → `'faith'` (worship-derived)
- All others → surfaced to admin for manual classification (no
  auto-default; unclassified communities remain visible per legacy
  behavior until reviewed).

The per-user category-visibility settings live in a new
`profile_visibility_prefs` table (see §9).

---

## 6. Elder/Admin Access (Revision 3)

Elder and platform-admin access to contact info is **event-triggered
and logged**. There is no ambient "elders see everything" tier.

### 6.1. Access classes

**(a) Elder in shared circle, during an active dispute or escalation:**

- Elder sees email + phone number of the members involved in the
  dispute, for as long as the dispute is `open` or `pending_review`.
- Access is recorded in the access log (§8) with:
  - `viewer_id` = elder's user_id
  - `viewer_role = 'circle_elder'`
  - `reason = 'dispute:' || dispute_id`
  - `data_class = 'contact_info'`
  - `granted_at`, `expires_at` (dispute close time)
- Once the dispute is resolved and closed, access ends. Elder can no
  longer read the contact info via the standard path.

**(b) Platform admin, KYC review:**

- Admin sees email, phone, physical address, and KYC document images
  for members in the KYC review queue.
- Access is recorded with:
  - `viewer_role = 'platform_admin'`
  - `reason = 'kyc_review:' || kyc_submission_id`
  - `data_class = 'kyc_pii'`

**(c) Platform admin, other:**

- Any other admin-initiated read of contact info (fraud investigation,
  law-enforcement request, compliance audit) requires:
  - An admin-visible modal that captures a `reason_code` from a fixed
    enum (`fraud_investigation`, `legal_request`, `compliance_audit`,
    `other_documented`) plus a free-text justification (min 20 chars —
    mirrors Doc 38's correction workflow).
  - A log row is written with that reason and justification.
- The member is notified in-app that their contact info was accessed
  (subject to law-enforcement holdback where legally required — see
  §6.3).

**(d) General elder tier (no shared circle):**

- **No special access.** An elder who is not in a shared circle with
  the target has the same view as any `All Members`-tier viewer.
- This is a deliberate departure from V1's "elder = universal read"
  pattern. Elder status is respected within the circles where it is
  earned; it does not confer app-wide privilege.

### 6.2. Log write mechanics

All privileged reads flow through a single RPC:
`log_privileged_profile_read(target_user_id, data_class, reason_code, justification)`.

The RPC is `SECURITY DEFINER`, records the access, and returns the
data. If the caller does not qualify (e.g., an elder invoking under
`data_class='kyc_pii'` — not their scope), it returns
`{success: false, error: 'unauthorized'}` and does NOT return the
data. The log is written only when the read is served.

### 6.3. Member notification

By default, the member is notified in-app within 1 hour of any
privileged read of their contact info. Exceptions:
- Law-enforcement or compliance holds may suppress notification for
  up to 30 days, then auto-notify. Suppression requires a specific
  `reason_code` and is itself logged.

---

## 7. Vouches Given (Revision 4)

### 7.1. Visibility

`Vouches Given` is a distinct signal from `Vouches Received`.

- **Default tier:** Circle Members + invite context.
- **Fields exposed:**
  - Count of vouches given (all-time and last-12-months).
  - Count of **vouches given that ended in default** by the vouchee.
  - List of vouchee names (visible to circle co-members only; hidden
    from invite-context viewers to prevent phishing / social-engineering
    of the invitee's network).

### 7.2. Rationale for the "ended in default" counter

- Giving a vouch is a reputational bet. Vouchers with a history of
  vouching for members who then defaulted have shown poor judgment.
- Circle co-members and inviting parties deserve to see that pattern
  before trusting the voucher's future vouches.

### 7.3. Retracted vouches

- The fact of retraction is visible (counter of retracted vouches).
- The **reason** for retraction is private to the voucher and the
  vouchee — not visible to other circle members. Rationale:
  retraction reasons often contain sensitive interpersonal context
  ("I found out they're going through a divorce"); publicising them
  would discourage retraction in cases where it is warranted.

### 7.4. Dependency on Doc 37

Doc 37 defines the vouch data model (`exposure_vouches` table,
default recording, retraction workflow). Doc 40 governs visibility.
If Doc 37 changes the underlying columns, the visibility rules here
must be re-reviewed.

---

## 8. Profile Access Log (Revision 5)

Members can view a log of every privileged read (§6) of their
profile. Standard privacy-forward-fintech pattern.

### 8.1. Table schema

```sql
CREATE TABLE public.profile_access_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewer_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  viewer_role     TEXT NOT NULL CHECK (viewer_role IN (
                    'circle_elder',
                    'platform_admin'
                  )),
  data_class      TEXT NOT NULL CHECK (data_class IN (
                    'contact_info',
                    'kyc_pii',
                    'financial_history_full'
                  )),
  reason_code     TEXT NOT NULL,
  justification   TEXT,
  circle_id       UUID REFERENCES public.circles(id) ON DELETE SET NULL,
  dispute_id      UUID REFERENCES public.disputes(id) ON DELETE SET NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  notified_at     TIMESTAMPTZ,
  notification_suppressed_until TIMESTAMPTZ,
  suppressed_reason TEXT
);

CREATE INDEX idx_profile_access_log_target ON public.profile_access_log(target_user_id, granted_at DESC);
CREATE INDEX idx_profile_access_log_viewer ON public.profile_access_log(viewer_user_id, granted_at DESC);
```

**RLS:**
- Target member reads their own rows: `USING (target_user_id = auth.uid())`.
- Viewers read their own audit trail (accountability):
  `USING (viewer_user_id = auth.uid())` for review before an audit.
- Service-role has full access.
- No other client reads.

### 8.2. What the member sees

A "Who accessed my info" screen showing:
- Viewer's display name (elder or admin, per role label).
- Role label ("Circle Elder — {Circle Name}" or "TandaXn Admin").
- Data class in plain language ("email + phone" for
  `contact_info`, "ID documents" for `kyc_pii`).
- Reason ("Dispute in Cercle Abidjan 2026", "KYC review", etc.).
- When (relative time — "2 days ago").
- Whether access has expired (for time-bounded dispute access).

**Not shown to the member:**
- Free-text justification (kept internal — reduces surface for
  social-engineering the viewer via a member complaint).
- Row IDs, viewer's raw user_id.

### 8.3. Retention

- Rows are retained indefinitely by default. This is a compliance
  surface — members and regulators may need to review historic access
  years later.
- No cron job deletes them. Any purge must be justified in writing
  and go through a manual admin flow (out of scope for Doc 40).

---

## 9. User Controls

### 9.1. What members CAN toggle

Stored in a new table:

```sql
CREATE TABLE public.profile_visibility_prefs (
  user_id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  show_geographic        BOOLEAN NOT NULL DEFAULT true,
  show_professional      BOOLEAN NOT NULL DEFAULT true,
  show_life_stage        BOOLEAN NOT NULL DEFAULT false,
  show_faith             BOOLEAN NOT NULL DEFAULT false,
  show_identity_health   BOOLEAN NOT NULL DEFAULT false,
  show_bio               BOOLEAN NOT NULL DEFAULT true,
  show_marketplace_link  BOOLEAN NOT NULL DEFAULT true,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- Community categories (per-category, per §5.1).
- Bio (can leave empty; the toggle controls whether the field even
  renders on the profile card for non-circle viewers).
- Marketplace provider link (if the member is a Verified Provider).

Toggles are applied at the API layer — the profile-read RPC returns
the reduced payload to viewers who do not qualify for the hidden
fields.

### 9.2. What members CANNOT toggle

- **XnScore, contribution status, payout position** to circle
  co-members. These are core to circle mechanics; hiding them would
  break the trust model.
- **Default history** to circle co-members and invite context.
  Hiding would let a serial defaulter re-onboard silently.
- **KYC PII from platform admins** for KYC review. Non-negotiable
  compliance requirement.
- **Existence in the app.** There is no "invisible mode"; other
  members can always search by name / display name if they know it.
- **Display name, avatar** cannot be hidden (though they can be
  changed or replaced with placeholders).

---

## 10. Dependencies

### 10.1. Doc 37 — Circle Reputation

Doc 37 defines:
- XnScore data model and factor computation.
- `exposure_vouches` table (issued, received, retracted, defaulted).
- Trust tier assignment logic.

Doc 40 controls the **visibility** of these signals but does not
compute them. If Doc 37 introduces a new reputation signal (e.g.,
"streak of on-time contributions"), Doc 40 must be revised to add a
row to the §3 matrix.

### 10.2. Communities system

- `communities.metadata.category` addition per §5.3 is a Doc 40
  requirement — migration must add + back-fill this before the
  category toggles can ship.
- Existing `community_type` values remain unchanged; the new
  `metadata.category` layer is a super-category grouping for
  visibility purposes.

### 10.3. Doc 38 — Circle Closing and Correction Workflow

- Doc 38's `admin_users` table and `SECURITY DEFINER` admin RPCs
  are the authorization surface Doc 40's access log records against.
- Doc 38's correction-reason enum pattern (fixed enum + free-text
  justification with min length) is reused verbatim in §6.1(c) for
  admin-initiated contact-info reads.

### 10.4. Migration 133 — Community privacy controls

- Migration 133 established the `inference_audit_log` +
  per-user-opt-out pattern for a related concern (community
  inference). Doc 40's `profile_access_log` follows the same shape:
  SECURITY DEFINER writes, RLS-restricted reads.
- The `set_inference_opt_out` RPC pattern (RPC derives identity from
  `auth.uid()`, refuses a `user_id` parameter from the client) is
  reused for the visibility-toggle RPCs implied by §9.1.

### 10.5. Open questions for the implementation phase

1. **Elder "escalation" trigger definition** (§6.1(a)) — needs a
   concrete signal. Options: (a) elder invoked `create_dispute` on a
   circle payment; (b) member flagged a payment; (c) a manual
   "escalate to elder" button. Decide before schema lands.
2. **Notification wording** for §6.3 — needs a copy pass with legal
   review.
3. **Marketplace provider profile hiding** (§9.1
   `show_marketplace_link`) — does hiding the profile hide it from
   the marketplace search index too, or only from the profile card?
   Interacts with existing marketplace filtering; needs a dedicated
   review.
4. **Communities category back-fill** (§5.3) — the manual admin
   review of unclassified communities needs a UI. Out of scope for
   Doc 40 itself.

---
