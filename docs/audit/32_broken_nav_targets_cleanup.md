# 32 — Broken Navigation Targets — Cleanup Task

**Status:** Backlog. Live bugs. Not blocking Stage 4, but a tester will hit them.
**Surfaced by:** `docs/audit/30_navigation_map.md` §A (full navigation grep audit, 2026-05-26).
**Effort estimate:** 1–3 hours per cluster depending on whether you register stubs or disable buttons. Per-button work, fully parallelisable.

---

## Problem

11 `navigation.navigate("X")` call sites in the codebase target a route name `X` that has no corresponding `<Stack.Screen name="X" component=…>` anywhere in `App.tsx`. At runtime, tapping the responsible button produces a React Navigation warning (`The action 'NAVIGATE' with payload {"name":"X"} was not handled by any navigator`) and **does nothing** — the user sees a tap with no result.

For a money app, "tap does nothing" is a confidence-killing UX. Worse: the user can't always tell whether the action *should* have done something (it might be a feature they expected to work) or whether they tapped the wrong place. They re-tap, re-tap again, and eventually file a bug or churn.

---

## The 11 broken targets

Grouped by the missing route, with the action needed per cluster.

### Cluster 1 — Wallet / payment-methods (2 call sites)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/AddFundsScreen.tsx:375` | `"AddPaymentMethod"` | Add a card / bank account to the wallet. Likely meant `LinkedAccounts`. |
| `screens/WithdrawScreen.tsx:319` | `"AddPaymentMethod"` | Same — "add a way to withdraw to." |

**Fix options:**
- **(a)** Rename the target to `LinkedAccounts` if that screen covers the "add payment method" UX. Verify the LinkedAccounts screen actually supports the add-flow these buttons want to trigger.
- **(b)** Build a real `AddPaymentMethod` screen if `LinkedAccounts` is a list-only view that doesn't cover the add flow.
- **(c)** Hide the buttons until the destination exists.

### Cluster 2 — KYC web flow (1 call site)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/KYCVerificationScreen.tsx:78` | `"WebView"` | Open a third-party KYC provider's hosted web form. |

**Fix options:**
- **(a)** Open externally via `Linking.openURL(...)` — bypass the navigation system entirely for the third-party page.
- **(b)** Build a thin `WebViewScreen` wrapper around `react-native-webview` and register it.
- **(c)** If KYC is not a near-term need, disable the button (the entire KYCVerificationScreen may be in the orphan candidates list in doc 30 §B anyway).

### Cluster 3 — Trip Organizer (1 call site)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/ParticipantManagerScreen.tsx:154` | `"ParticipantDetail"` | A detail view for a single trip participant — likely showing their submitted documents, payment status, contact info. |

**Fix options:**
- **(a)** Build a real `ParticipantDetail` screen. Likely overlaps `DocumentSubmission` and `TripPayment` per-participant.
- **(b)** Inline the participant detail in `ParticipantManagerScreen` itself (modal or expanded row) instead of a separate screen.
- **(c)** Disable the row tap until the destination exists.

### Cluster 4 — Marketplace Owner (7 call sites, 3 missing screens)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/OwnerDashboardScreen.tsx:40, 139` | `"EditStore"` | Edit storefront name / description / cover photo / category. |
| `screens/OwnerDashboardScreen.tsx:148, 223, 237` | `"ManageServices"` | Add / edit / remove services the store offers. |
| `screens/OwnerDashboardScreen.tsx:157, 171` | `"StoreBookings"` | View incoming bookings, mark complete, contact customer. |

**Fix options:**
- **(a)** Build all three screens. They appear to be core Marketplace owner functionality — if the Marketplace feature is intended to ship, these aren't optional.
- **(b)** Mark the entire Marketplace Owner flow as "Coming Soon" until the screens are built. Tester won't tap dead buttons.
- **(c)** Disable the affected buttons but keep the dashboard read-only.

Worst of the four clusters by count: 7 dead buttons in a single screen. If a tester opens `OwnerDashboardScreen`, every action button they tap does nothing.

### Cluster 5 — Loans (1 call site)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/LoanMarketplaceScreen.tsx:207` | `"LoanDashboard"` | Likely "view my active loans" — a dashboard distinct from the loan marketplace browser. |

**Fix options:**
- **(a)** Build a `LoanDashboard` screen (or repurpose an existing screen if one fits).
- **(b)** If the marketplace already shows active loans inline, change the button to a no-op or scroll-to-section instead of navigating.

### Cluster 6 — Reference / tab-typo (1 call site)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/DreamFeedScreen.tsx:182` | `"CirclesTab"` | Jump to the Circles tab from the Dream Feed. |

**Fix options:**
- **(a)** The tab name in the bottom tab navigator is `Circles`, not `CirclesTab`. Rename the navigate target to `"Circles"`. ~30-second fix.

### Cluster 7 — Trip Provider request (1 call site)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/MarketplaceScreen.tsx:220` | `"RequestProvider"` | Open a "request a provider" form / inquiry flow. |

**Fix options:**
- **(a)** `"RequestProvider"` is listed in `RootStackParamList` in `App.tsx:378` but never registered with `<Stack.Screen>`. Either add the registration (if the screen exists) or remove the param-list entry (if it doesn't).
- **(b)** Disable / hide the button until the screen exists.

### Cluster 8 — Default recovery (2 call sites)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `screens/DefaultRecoveryScreen.tsx:148` | `"DefaultDetail"` | Detail view of a specific default record. |
| `screens/DefaultRecoveryScreen.tsx:192` | `"LateContributionDetail"` | Detail view of a specific late contribution. |

**Fix options:**
- **(a)** Build both detail screens. They sound like real reporting / oversight tools.
- **(b)** `DefaultRecoveryScreen` itself is in doc 30 §B's orphan candidates — it may already be unreachable. Confirm reachability first; if it's an orphan, both these targets are downstream of an unreachable screen and the cleanup can be deferred until the parent is removed.

### Cluster 9 — Deep-link `CommunityInvite` (linking config)

| Caller | Bad target | Suspected intent |
|---|---|---|
| `lib/deepLinking.ts:38` | `CommunityInvite: "invite/community/:communityId"` | A URL `https://tandaxn.com/invite/community/<id>` should open a community-invite landing screen. |

**Fix options:**
- **(a)** Register a `CommunityInvite` screen (analogous to the existing `CircleInvite` at `screens/CircleInviteScreen.tsx`). The URL is documented in `parseInviteUrl()` at line 105-115 of the same file, so the parsing side is built — only the screen registration is missing.
- **(b)** Remove the URL pattern from `linkingConfig` if community invites are not a near-term feature. Currently any user who clicks a `/invite/community/...` link gets routed to the app and lands... nowhere useful.

---

## Acceptance criteria

A future PR closes this task when:

1. **Every `navigation.navigate(X)` call in `screens/` resolves to a registered screen.** Verifiable by grepping each call's target against the `<Stack.Screen name=...>` registrations in `App.tsx`. Run:
   ```bash
   # Set diff: nav targets that are NOT in registered screens
   grep -hoE 'navigation\.(navigate|push|replace)\(["'\''][A-Za-z]+["'\'']' screens/**/*.tsx \
     | grep -oE '["'\''][A-Za-z]+["'\'']' | sort -u > /tmp/targets.txt
   grep -oE '<(Stack|HomeStack|CirclesStack|MarketStack|CommunityStack|Tab)\.Screen name="[A-Za-z]+"' App.tsx \
     | grep -oE '"[A-Za-z]+"' | sort -u > /tmp/registered.txt
   comm -23 /tmp/targets.txt /tmp/registered.txt
   ```
   Should return empty.

2. **`lib/deepLinking.ts` does not reference any unregistered route name** in `linkingConfig.config.screens`. Same set-diff approach as above, against the linking config.

3. **No `navigation.navigate(X)` call where `X` is misspelled** (e.g. `"CirclesTab"` vs `"Circles"`). The set-diff in (1) catches these as a side effect.

---

## Risks of deferring

- **Per-tester bug:** every external tester taps these buttons exactly once and writes a bug report. Each cluster generates a duplicate-suspect "X button doesn't work" ticket.
- **App-store reviewer:** Apple / Google reviewers often tap every visible button during review. A dead button on a financial app is review-rejection-worthy at worst, "needs follow-up" at best.
- **Customer support load:** "I tapped X and nothing happened" is one of the highest-volume support categories for early-stage apps. Each broken target adds to the queue.
- **Compounding tech debt:** the longer these sit, the harder it is to know whether the missing screen was supposed to exist (real feature, missing implementation) or whether the button was wrong (call site bug). Decisions are easier to make while the feature intent is fresh.

---

## Suggested ordering when this is picked up

1. **Cluster 6 (CirclesTab typo)** — 30 seconds, no-brainer, ship as a one-liner.
2. **Cluster 4 (OwnerDashboard, 7 buttons)** — biggest user-visible impact. Either build the 3 screens, or label the Marketplace Owner flow as "Coming Soon" until they exist.
3. **Cluster 1 (AddPaymentMethod)** — wallet flow, customer-visible.
4. **Cluster 9 (CommunityInvite deep link)** — registers the screen or removes the URL pattern. Pair with a check that any existing community invites haven't been shared in the wild yet.
5. **Cluster 7 (RequestProvider)** — clarify whether the screen was intended.
6. **Cluster 5 (LoanDashboard)** — depends on whether the Loans feature is in the launch scope.
7. **Cluster 2 (KYC WebView)** — depends on KYC vendor / Stage-N timing.
8. **Clusters 3 & 8 (ParticipantDetail, DefaultDetail, LateContributionDetail)** — confirm parent screens are reachable first; if orphan, defer to the Stage-4 cleanup pass.

---

## Links

- `docs/audit/30_navigation_map.md` §A — the original survey listing.
- `App.tsx` — the registration source-of-truth.
- `lib/deepLinking.ts` — the deep-link configuration.
- `docs/audit/29_full_migration_drift_audit_pending.md` — similar style (read-only audit, fix-later) for the migration-tracking side.
