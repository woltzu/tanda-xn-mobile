# Google Play — Submission Copy (TandaXn)

> **Status: DRAFT.** Review by legal + marketing before submission.
> All external URLs below are **placeholders** — replace before publish.
> Character counts are Google Play Console's 2026 limits.

---

## App title (30-char limit)

```
TandaXn — Savings Circles
```

**24 / 30.**

---

## Short description (80-char limit — shown in search + Play Store cards)

```
Rotating savings circles for groups, families, and diaspora communities.
```

**72 / 80.**

Alternates:
- `Save together with people you trust. Take turns being paid out.` (61)
- `Modern tontines — save, take turns, build your credit history.` (61)

---

## Full description (4,000-char limit, HTML-lite formatting supported)

```
🌍 Save together. Grow together.

TandaXn is a community savings app built around one simple idea: money is
easier to save when you save together. It brings the age-old tradition of
tontines — also known as rotating savings circles, susu, sou-sou, or hui —
into a modern app that anyone with a smartphone can use.


✨ HOW IT WORKS

Create a savings circle, invite the people you trust, and agree on the
amount each member will contribute per cycle. Every cycle, the pot is paid
out to one member. When the last member is paid, everyone has received the
same amount back — but the discipline of saving with a group has replaced
the loneliness of saving alone.


👥 WHO IT'S FOR

• Diaspora communities pooling money to send back home
• Groups of friends saving for a shared goal — travel, weddings, gifts
• Small businesses building a cash buffer with trusted partners
• Anyone who saves better with a group than alone


⭐ KEY FEATURES

• Savings circles — set the amount, cycle length, and members. We handle
  the schedule and reminders.
• Group trips — pool money and installments toward a shared destination.
• Dreams — a lightweight goal tracker to keep everyone motivated.
• Community feed — cheer each other on and share what your circle is up
  to.
• Trust score — a private measure of your contribution history that
  unlocks larger circles and better terms.
• Wallet — top up from your bank card, withdraw to your bank account.
• Real 2FA — sign in with a code from Google Authenticator or any TOTP
  app.
• Session control — see every device signed in and revoke the ones you
  don't recognize.


🔐 SECURITY & PRIVACY

Your money and data get bank-level care. Passwords are hashed, never
stored in plain text. Payments are processed by Stripe. Two-factor
authentication is available for every account. We never sell your data,
and you can request full export or deletion from your profile.


📱 SUPPORT

Questions? Feedback? Reach us at support@tandaxn.com. We reply within
one business day.

TandaXn is available in English and French. More languages are on the
roadmap.
```

**~1,900 / 4,000 chars.** Google Play favours emoji headers + tight bullet
lists — the above matches that pattern.

---

## Category

- **App category:** Finance
- **Tags:** savings, community, fintech, family

## Content rating (via IARC questionnaire)

- Everyone (E) is unlikely — the app handles real money and has 2FA prompts
  which pull the rating up. Aim for **Teen** or **Everyone 10+** in the
  IARC questionnaire; be prepared to answer Yes on "In-app purchases" and
  "Real money gambling" = No (this is a savings pool, not gambling — flag
  this explicitly in the questionnaire notes).

## Target audience (Play requires an age range)

- Primary: 18+ (financial apps default; 13–17 is possible but adds
  parental-consent overhead we don't need for launch).

---

## Contact + URLs (replace placeholders)

| Field | Value |
|---|---|
| Website           | https://tandaxn.com                     *(placeholder)* |
| Support email     | support@tandaxn.com                     *(placeholder)* |
| Support phone     | *(leave blank; Play doesn't require it)*                |
| Privacy Policy    | https://tandaxn.com/privacy             *(placeholder)* |

**Blocker:** Privacy Policy URL is required for Play submission and MUST
be reachable at review time.

---

## Data safety form — pre-filled answers

Google Play requires a "Data safety" section separate from the description.
Draft answers below; verify against the actual code before submission.

| Data type            | Collected? | Shared with third parties? | Purpose |
|---|---|---|---|
| Email address        | Yes | No | Account creation, communication |
| Name                 | Yes | No | Profile display |
| Phone number         | Yes | No | Optional; used for phone-based OTP sign-in |
| Photos               | Yes (avatar, post images) | No | Profile personalization, community feed |
| Payment info         | Yes | Yes — Stripe | Process card payments and payouts |
| Location (coarse)    | Yes (only when verifying providers/goals) | No | Milestone verification |
| Device / other IDs   | Yes (user_agent, IP) | No | Security (session list, anomaly detection) |
| App activity         | Yes | No | Feature analytics, in-app tips |

**Encryption in transit:** Yes (TLS to Supabase + Stripe).
**User can request deletion:** Yes (Profile → Delete Account, or
support@tandaxn.com).

## Ads

- **Contains ads:** No.
- **In-app purchases:** No (contributions go to peer members, not to
  TandaXn — this is peer-to-peer commerce, not IAP. Confirm this in the
  Play Console pricing form.)

## Government/financial app disclosure

Google now asks financial apps for extra disclosure. Prepare:
- Business registration doc (Delaware Certificate — already in `docs/legal/`).
- Money-services registration (state MSB / MTL — status TBD; the launch
  plan doc discusses this).
