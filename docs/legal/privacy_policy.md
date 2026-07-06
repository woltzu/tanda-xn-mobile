# TandaXn Privacy Policy

> **⚠ DRAFT — NOT LEGALLY REVIEWED.** This document is a starting point
> for review by TandaXn's counsel. Do not publish or link to it until
> reviewed. Placeholders are marked in **[SQUARE BRACKETS]** and MUST be
> replaced.

**Effective Date:** [YYYY-MM-DD]
**Last Updated:** [YYYY-MM-DD]

## 1. Who we are

TandaXn is operated by **[TandaXn, Inc.]**, a Delaware corporation
registered in **[Delaware, USA]** and doing business from **[Atlanta,
Georgia, USA]** ("TandaXn," "we," "our," or "us"). This Privacy Policy
describes how we collect, use, share, and protect the information you
give us when you use the TandaXn mobile application, our website
[tandaxn.com], and any related services (collectively, the "Service").

You can reach our Privacy team at **privacy@tandaxn.com** or by mail at
**[Street, City, State, ZIP, USA]**.

## 2. What information we collect

### 2.1 Information you give us directly

- **Account information.** Email address, full name, password (hashed —
  we never see the plaintext), preferred language, and optionally your
  phone number for OTP sign-in.
- **Profile information.** Optional profile picture, city/region, and
  short bio if you choose to complete them.
- **Financial information.** Bank account details (via Stripe — see §5),
  card payment credentials (handled and stored by Stripe, never by us),
  amounts contributed and received in savings circles, wallet balances
  and transaction history.
- **Community content.** Circle names and rules you create, messages you
  send in circle group chats, posts you make in the community feed,
  photos you upload with a post or dream, event RSVPs, and reviews you
  submit.
- **KYC / identity verification.** If your account requires identity
  verification (e.g., higher payout tiers, elder role), you may be asked
  to upload a government-issued ID, a selfie, and proof of address.
- **Support communications.** Whatever you send to support@tandaxn.com
  or in-app feedback.

### 2.2 Information we collect automatically

- **Device information.** Device model, operating system version,
  screen size, and app version. Used to render the app correctly and
  triage bugs.
- **Session information.** IP address, User-Agent string, session start
  time, and Authentication Assurance Level (AAL1 vs AAL2 for two-factor).
  Used to power the "Active sessions" screen and detect suspicious sign-ins.
- **Approximate location.** Only when you use a feature that needs it
  (verifying a milestone on the ground, providing goods or services as a
  Verified Provider). We never track your location in the background.
- **Usage analytics.** In-app events like which screens you visit and
  which features you use. Aggregated to a per-account level to power the
  in-app dashboards and improve the product. We do NOT use third-party
  analytics SDKs (Mixpanel, Amplitude, Google Analytics) at this time.

### 2.3 Information from third parties

- **Stripe** provides confirmation that a card charge succeeded, a bank
  transfer landed, or a customer identity verification passed. We never
  receive the full card number, CVV, or unmasked bank credentials.
- **Supabase** (our infrastructure vendor — see §5) hosts our database
  and authentication service. Supabase does not have access to plaintext
  passwords.

## 3. How we use your information

- Provide, maintain, and improve the Service.
- Process contributions, payouts, and withdrawals.
- Send you transactional messages (payout received, cycle deadline,
  new sign-in, etc.).
- Enforce our Terms of Service (§8 of the ToS) and prevent fraud.
- Comply with legal obligations — including U.S. federal and state
  anti-money-laundering (AML), Know Your Customer (KYC), and tax
  reporting requirements.
- Compute your **XnScore** and **Honor Score** — internal, private
  measures of your contribution history and community standing that
  unlock features. These scores are visible only to you and are not
  sold or shared externally.
- With your consent, send you marketing communications you can opt out
  of at any time.

## 4. Our legal basis (EEA / UK users)

If you are located in the European Economic Area, the United Kingdom, or
Switzerland, we rely on the following legal bases under the GDPR / UK
GDPR:

- **Contractual necessity** — most of the processing above is needed to
  provide the Service you signed up for.
- **Legitimate interest** — securing the platform, preventing fraud,
  improving product quality.
- **Legal obligation** — AML, KYC, and tax reporting.
- **Consent** — for optional marketing communications and for uploading
  data types (e.g., ID documents) where consent applies under local law.

## 5. Who we share information with

We do not sell your data. We share it only with:

- **Stripe, Inc.** — payment processing. See Stripe's privacy notice at
  https://stripe.com/privacy.
- **Supabase, Inc.** — our database, authentication, and storage
  provider. See Supabase's privacy notice at
  https://supabase.com/privacy.
- **Other members of your savings circle** — the name you set on your
  profile, the amounts you contribute and receive within *that circle
  only*, and messages you send in that circle's group chat. Members of
  a circle cannot see your data from other circles.
- **Government or law enforcement** — when required by valid legal
  process (subpoena, court order, or applicable regulation).
- **Successors in interest** — if TandaXn is acquired, merges, or
  transfers assets, personal information may transfer with it. We will
  notify affected users in advance.

We never share your data with advertisers, data brokers, or analytics
vendors.

## 6. How we store and protect your information

- **Encryption in transit.** All communication between the app and our
  servers is protected by TLS 1.2 or higher.
- **Encryption at rest.** Databases and object storage are encrypted at
  rest by our infrastructure providers.
- **Password storage.** Passwords are hashed with bcrypt (via Supabase
  Auth) — we never store plaintext passwords and we never see yours.
- **Two-factor authentication.** Every account can enable TOTP-based
  2FA. We recommend it for accounts with active balances or larger
  circles.
- **Session management.** You can review and revoke every active
  session from Profile → Security → Active Sessions at any time.
- **Retention.** Account data is retained for the life of your account
  and for **[7 years]** after account closure to satisfy U.S. financial
  record-keeping requirements. Circle transaction history is retained
  for the full retention period even after account deletion, in a
  pseudonymised form.

## 7. Your rights and choices

Depending on where you live, you may have some or all of the following
rights. To exercise any of them, email **privacy@tandaxn.com**.

- **Access** — request a copy of the personal information we hold about
  you.
- **Correction** — ask us to fix inaccurate information.
- **Deletion** — ask us to delete your personal information. Note that
  we cannot delete records we are legally required to retain (see §6).
- **Portability** — receive your information in a machine-readable
  format.
- **Object / restrict** — object to certain processing or ask us to
  restrict it.
- **Withdraw consent** — for any processing that relies on your consent.
- **Complain** — lodge a complaint with your local supervisory
  authority (e.g., the ICO in the UK, your state Attorney General in
  the US).

California residents: TandaXn does not sell or share personal
information as defined under the CCPA / CPRA. You still have the right
to know, delete, correct, and limit — see the process above.

## 8. Children's privacy

TandaXn is not directed to children under **13** (or the equivalent
minimum age in your country). We do not knowingly collect personal
information from children. If you believe a child has provided
information to us, contact **privacy@tandaxn.com** so we can delete it.

## 9. International transfers

We are headquartered in the United States. If you access the Service
from outside the U.S., your information will be transferred to and
processed in the United States. Where required, we rely on Standard
Contractual Clauses or other lawful transfer mechanisms.

## 10. Cookies and similar technologies (web only)

The **[tandaxn.com]** website uses only strictly necessary cookies —
for session management, remember-me tokens, and security. We do not use
advertising, tracking, or third-party analytics cookies at this time.

## 11. Changes to this Policy

We will notify you of material changes by email and by an in-app banner
at least 14 days before they take effect. Continued use of the Service
after the effective date constitutes acceptance of the updated policy.

## 12. Contact us

Privacy team — **privacy@tandaxn.com**
Support — **support@tandaxn.com**
Mail — **[TandaXn, Inc., Street, City, State, ZIP, USA]**

---

*This document is a template and does not constitute legal advice.
Have counsel review before publication.*
