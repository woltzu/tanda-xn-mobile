# 30 — Navigation Map

**Source-of-truth files traced:** `App.tsx` (5 navigators, 200+ `<Screen>` registrations), `lib/deepLinking.ts` (linking config), all `navigation.navigate()` / `.replace()` / `.push()` call sites under `screens/`.
**Total screens registered:** 155 (per `docs/audit/04_screen_status.md`, all reachable as registrations).
**Method:** read-only — App.tsx for the registration tree, `grep navigation\.(navigate|push|replace)\(["']X["']` across `screens/` for inbound edges.

---

## Root navigator (always present, no tab bar visible on these)

`Stack.Navigator initialRouteName="Splash"` — the outermost navigator that hosts auth, the tab bar, and modals/deep-link landings.

```
Root Stack
├── Splash                 ← entry; navigates to Welcome or Login based on auth
│   ├─→ Welcome            (unauthenticated)
│   └─→ Login              (returning user)
│
├── Auth flow (no tab bar)
│   ├── Welcome            → Signup, Login
│   ├── Login              → Signup, ForgotPassword
│   ├── Signup             → EmailVerification, Login
│   ├── EmailVerification  → Login, Signup
│   ├── ForgotPassword     → Login
│   ├── ResetPassword      (deep link target: /auth/reset-password)
│   └── AuthCallback       (deep link target: /auth/confirm; magic-link email confirmation)
│
├── MainTabs               ← the BottomTabs navigator (see "Tab bar" below)
│
├── Modal-style screens (registered at ROOT — appear over the tab bar without a tab bar visible)
│   ├── AccessRestricted   (programmatic — triggered when a feature is gated by XnScore)
│   ├── ReportIssue        (also in CirclesStack; ROOT copy is for the Circle Options bottom sheet,
│   │                       which renders via Portal outside CirclesStack's scope — see App.tsx:757)
│   ├── MediationTools     (same Portal pattern)
│   ├── AdminSettings      (same Portal pattern)
│   ├── LeaveCircle        (same Portal pattern)
│   ├── HelpCenter         (also in HomeStack)
│   ├── PaymentHistory     (also in CirclesStack)
│   ├── NotificationPrefs  (also in HomeStack)
│   ├── ManageMembers      (also in CirclesStack)
│   ├── PauseCircle        (also in CirclesStack)
│   ├── CloseCircle        (also in CirclesStack)
│   ├── ExportData         (also in CirclesStack)
│   ├── OversightDashboard (also in CirclesStack)
│   ├── AuditTrail         (also in CirclesStack)
│   └── QRCodeDisplay      (also in CirclesStack)
│
└── Deep-link landings (reachable via URL; users won't see a tab bar)
    ├── CircleInvite          /invite/circle/:circleId         → Signup / Login / CircleDetail
    ├── CommunityInvite       /invite/community/:communityId   (linking config only — no Screen registered;
    │                                                            see "Broken navigation" below)
    ├── QuickJoin             /join/:inviteCode                → QuickJoinPendingConfirmation
    ├── QuickJoinPendingConfirmation                            → QuickJoin
    ├── JoinConfirm           /join-confirm?pending=<id>       → CircleDetail (success path)
    ├── QuickJoinPaymentSuccess
    └── SetPassword           /set-password                    (after magic-link join)
```

---

## Tab bar — `MainTabs` (`Tab.Navigator` in `App.tsx:799-885`)

Five tabs across the bottom. Order matches what the user sees left-to-right.

| Tab key | Label | Stack it opens | Initial route in stack |
|---|---|---|---|
| `Home` | Home | `HomeStackScreen` | `Dashboard` |
| `Circles` | Circles | `CirclesStackScreen` | `CirclesMain` (= `CirclesScreen`) |
| `Action` | (no label, custom orange flame icon, raised) | `ActionScreen` directly (no nested stack) | n/a |
| `Market` | Market | `MarketStackScreen` | `MarketMain` (= `MarketplaceScreen`) |
| `Community` | Community | `CommunityStackScreen` | `CommunityMain` (= `CommunityTabScreen`) |

**Tab press behavior:** pressing a tab while inside a nested screen of that tab resets the tab's stack to its root (`App.tsx:855-869`). E.g., if you're on Home → GoalsHub → CreateGoal and you tap the Home tab, you snap back to Dashboard.

---

## Home tab → `HomeStackScreen`

The largest stack — ~75 screens. Dashboard is the hub for everything the user does that isn't strictly a circle/market/community action.

```
Dashboard  (DashboardScreen)
│
├── Header / chrome
│   ├── 🔔 NotificationsInbox
│   ├── 👤 ProfileMain  ← entire Profile flow lives below
│   └── 🔥 XnScoreDashboard  → XnScoreHistory, HelpCenter
│
├── Hero cards
│   ├── WalletMain  → AddFunds, Withdraw, Remittance, LinkedAccounts, HelpCenter
│   │                 │
│   │                 ├── AddFunds → WalletTransactionSuccess (also navigates to "AddPaymentMethod"
│   │                 │                                         which is NOT REGISTERED — see Issues)
│   │                 ├── Withdraw → WalletTransactionSuccess (same "AddPaymentMethod" issue)
│   │                 └── Remittance → WalletTransactionSuccess
│   │                                   ↑ also reached from SendMoney, DomesticSendMoney, SupportDream
│   │
│   ├── XnScoreDashboard → XnScoreHistory
│   └── Circle cards (per active circle)
│        └─→ CircleDetail  ← also reached from Circles tab, see CirclesStack
│
├── Quick actions
│   ├── CreateCircleStart  (also reached from Circles tab + multiple cards)
│   │     → CreateCircleDetails → CreateCircleSchedule → CreateCircleInvite → CreateCircleSuccess → CircleDetail
│   ├── OrganizerTripList  (Trip Organizer entry point)
│   │     → CreateTripWizard → TripPublishSuccess → TripPublicPage / ItineraryBuilder / OrganizerTripDashboard
│   ├── ElderDashboard
│   │     → BecomeElder, VouchSystem, MediationCase, HonorScoreOverview, ElderTrainingHub
│   ├── DreamFeed
│   │     → PostDetail → PostComments, UserDreamProfile, CreateGoal, JoinCircleConfirm, SupportDream
│   │                                                   ↑ JoinCircleConfirm is the BYPASS path — see doc 28
│   │     → CreateDreamPost, FeedSettings, UserDreamProfile
│   │
│   └── (and the Advance / Loans / Goals sub-trees below)
│
├── Wallet sub-tree (also accessible from WalletMain)
│   ├── SendMoney → Remittance, DomesticSendMoney
│   ├── DomesticSendMoney → WalletTransactionSuccess
│   ├── Remittance → SavedRecipients → AddRecipient
│   └── SavedRecipients → AddRecipient, Remittance
│
├── Savings Goals
│   ├── GoalsHub → CreateGoal, GoalDetails, DepositToGoal, WithdrawFromGoal, HelpCenter
│   ├── CreateGoal → GoalDetails (via replace), GoalsHub
│   ├── GoalDetails → WithdrawFromGoal, EditGoal, DepositToGoal, HelpCenter
│   ├── DepositToGoal → GoalDetails (replace)
│   ├── WithdrawFromGoal
│   └── EditGoal
│
├── Advance on Future Payout
│   ├── AdvanceHub → AdvanceExplanation, AdvanceDetails, RequestAdvance, Circles tab (cross-tab nav!), HelpCenter
│   ├── AdvanceExplanation → AdvanceHub
│   ├── RequestAdvance → AdvanceDetails, AdvanceHub, XnScoreDashboard
│   ├── AdvanceDetails → AdvanceRepayment
│   └── AdvanceRepayment → AdvanceDetails
│
├── Loans
│   ├── LoanMarketplace → LoanApplication, LoanDetails, LoanCalculator, "LoanDashboard"❌, AdvanceExplanation, XnScoreDashboard
│   ├── LoanApplication → LoanDetails (replace), HelpCenter
│   ├── LoanDetails
│   └── LoanCalculator → LoanApplication, XnScoreDashboard, HelpCenter
│
├── Contribution flow (cross-tab; same screens also in CirclesStack)
│   ├── SelectCircleContribution → MakeContribution, CreateCircleStart, JoinCircleByCode
│   ├── MakeContribution → ContributionSuccess
│   └── ContributionSuccess → CircleDetail
│
├── Marketplace (also entirety in MarketStack — duplicated registration)
│   ├── Marketplace → StoreDetail, StoreApplication, "RequestProvider"❌
│   ├── StoreDetail → BookService
│   ├── BookService
│   ├── StoreApplication → OwnerDashboard (replace)
│   ├── OwnerDashboard → BulkInvites, "EditStore"❌, "ManageServices"❌, "StoreBookings"❌  ← 4 broken targets
│   ├── BulkInvites
│   └── MarketInsight → StoreApplication
│
├── Trip Circle flow (Provider side — also in MarketStack)
│   ├── ProviderDiscovery → ProviderProfileSetup
│   ├── ProviderProfileSetup → ProviderVerification
│   ├── ProviderVerification → ProviderDiscovery
│   ├── CreateTripListing
│   ├── ProviderTripDashboard → CreateTripListing
│   ├── TripDetail
│   └── MemberTripDashboard
│
├── Trip Organizer flow (organizer side — also in CirclesStack and MarketStack)
│   ├── OrganizerTripList → CreateTripWizard, OrganizerTripDashboard
│   ├── CreateTripWizard → ItineraryBuilder, TripPublishSuccess
│   ├── OrganizerTripDashboard → CreateTripWizard, TripPublicPage
│   ├── ItineraryBuilder → TripPublicPage, ActivityEditor (likely — not greppable in this scan)
│   ├── ParticipantManager → "ParticipantDetail"❌
│   ├── TripPublicPage → MyTripStatus
│   ├── MyTripStatus
│   ├── DocumentSubmission         ← no greppable inbound (likely from MyTripStatus context-driven)
│   ├── TripPayment                ← no greppable inbound (likely from MyTripStatus)
│   ├── TripPublishSuccess → TripPublicPage, ItineraryBuilder, OrganizerTripList, OrganizerTripDashboard
│   └── ActivityEditor             ← no greppable inbound (likely from ItineraryBuilder)
│
├── AI / Financial Insight screens — REGISTERED BUT NO INBOUND NAV FOUND
│   ├── StressScoreDashboard       ← suspected orphan (no navigate target in grep)
│   ├── MoodInsights               ← suspected orphan
│   ├── EarlyIntervention          ← suspected orphan
│   ├── ScoreBreakdown             ← suspected orphan
│   ├── CreditProfile              ← inbound only from LoanApplication via CreditProfile but check
│   ├── GraduatedEntry             ← suspected orphan
│   ├── CrossCircleLending         ← suspected orphan
│   ├── DefaultRecovery            ← suspected orphan
│   ├── KYCVerification            ← suspected orphan (also navigates to "WebView"❌)
│   └── LegalDocuments             ← suspected orphan
│
├── Community sub-screens (mirrors Community tab — exist here for cross-stack access)
│   ├── CommunityBrowser → CommunityHub, CreateCommunity
│   ├── CommunityHub → CreateCircleStart, JoinCircleConfirm, CircleDetail, CommunityHub (self), CreateCommunity
│   ├── CreateCommunity → CommunityHub (replace)
│   ├── NearYou, NewArrivals, Gatherings, CreateGathering, CommunityMemory, PostToCommunity
│
└── Profile flow (avatar in top-right of Dashboard; previously had its own tab — now folded here)
    ├── ProfileMain (ProfileScreen)
    │     → PersonalInfo, SecuritySettings, LinkedAccounts, WalletMain, NotificationPrefs,
    │       HonorSystem, VouchMember, LanguageRegion, PrivacySettings, Settings, HelpCenter,
    │       AboutApp, XnScoreDashboard
    ├── PersonalInfo
    ├── LanguageRegion         ← language picker (relevant to Task 2 / i18n bug)
    ├── SecuritySettings → ChangePassword, TwoFactorAuth, ActiveSessions
    ├── ChangePassword
    ├── TwoFactorAuth
    ├── NotificationPrefs
    ├── PrivacySettings
    ├── LinkedAccounts
    ├── ActiveSessions
    ├── AboutApp
    ├── VouchMember
    ├── HonorSystem → VouchMember
    └── Settings (SettingsMainScreen) → PersonalInfo, HelpCenter
```

---

## Circles tab → `CirclesStackScreen`

~35 screens. `CirclesMain` (`CirclesScreen`) is the list. Tapping a circle goes to `CircleDetail`.

```
CirclesMain  (CirclesScreen — list of My Circles + Browse)
│
├── + Create Circle button   → CreateCircleStart  → CreateCircleDetails → CreateCircleSchedule
│                                                  → CreateCircleInvite → CreateCircleSuccess
│                                                  → CircleDetail (final)
│
├── Join by code button       → JoinCircleByCode  → JoinCircleConfirm → JoinCircleSuccess → MainTabs / CircleDetail
│                                                  → QRScanner       → JoinCircleConfirm
│
├── HowCirclesWork button     → HowCirclesWork    → CreateCircleStart
│
└── Circle card tap           → CircleDetail
                                 │
                                 ├── Group chat button   → GroupChat
                                 ├── 💰 Contribute       → MakeContribution → ContributionSuccess
                                 ├── 🚪 Join button      → JoinCircleConfirm → JoinCircleSuccess
                                 │                         (the BYPASS path — see doc 28)
                                 │
                                 ├── ⚙️ Circle Options bottom sheet (renders via Portal)
                                 │   ├── AdminSettings
                                 │   ├── LeaveCircle
                                 │   ├── ReportIssue
                                 │   ├── PaymentHistory
                                 │   ├── NotificationPrefs
                                 │   ├── ManageMembers
                                 │   ├── PauseCircle
                                 │   ├── CloseCircle
                                 │   ├── ExportData
                                 │   ├── OversightDashboard
                                 │   ├── MediationTools
                                 │   ├── AuditTrail
                                 │   ├── HelpCenter
                                 │   └── QRCodeDisplay
                                 │
                                 └── Circle feature screens (registered, NO greppable inbound — orphans?)
                                     ConflictAlert, InsurancePool, PartialContribution, PositionSwap,
                                     CycleTimeline, CircleVoting, DynamicPayout, CircleVisualizer
```

**Trip Organizer screens are ALSO registered in CirclesStack** (`App.tsx:600-611`) — same trip set as HomeStack/MarketStack. Reachable from any circles-context navigation to a trip screen.

---

## Action tab → `ActionScreen`

Single screen, NO nested stack. Just `ActionScreen` itself.

```
Action (ActionScreen)
│
├── "Find your community" → CommunityBrowser (cross-stack to Home/Community)
└── "Browse communities" → CommunityBrowser
```

The big orange flame icon in the middle of the tab bar opens this single screen, which is currently a community-discovery shortcut.

---

## Market tab → `MarketStackScreen`

~22 screens. Storefronts + trip flows.

```
MarketMain (MarketplaceScreen)
│
├── Store card tap      → StoreDetail → BookService
├── Apply to be owner   → StoreApplication → OwnerDashboard (replace)
└── "Request provider"  → "RequestProvider"❌  (NOT REGISTERED — see Issues)

OwnerDashboard branches (4 broken targets — see Issues):
  → "EditStore"❌, BulkInvites, "ManageServices"❌, "StoreBookings"❌

Trip flows duplicated from HomeStack / CirclesStack:
  Provider side  : ProviderDiscovery, ProviderProfileSetup, ProviderVerification, CreateTripListing,
                   ProviderTripDashboard, TripDetail, MemberTripDashboard
  Organizer side : OrganizerTripList, CreateTripWizard, OrganizerTripDashboard, ItineraryBuilder,
                   ParticipantManager, TripPublicPage, MyTripStatus, DocumentSubmission, TripPayment,
                   TripPublishSuccess, ActivityEditor

MarketInsight → StoreApplication
```

---

## Community tab → `CommunityStackScreen`

~18 screens.

```
CommunityMain (CommunityTabScreen)
│
├── Browse / cards           → CommunityBrowser → CommunityHub → CreateCommunity / CreateCircleStart / JoinCircleConfirm / CircleDetail
├── New arrivals tile        → NewArrivals
├── Gatherings tile          → Gatherings → CreateGathering
├── Near you                 → NearYou
├── Community memory         → CommunityMemory
├── Avatar (top-right)       → ProfileMain  ← Profile flow accessible from here too
└── Elder section
    └── ElderDashboard       → BecomeElder, VouchSystem, MediationCase, HonorScoreOverview, ElderTrainingHub
```

---

## Cross-stack & programmatic-only entry points

- **Settings → PersonalInfo, HelpCenter** — Settings screen reachable via `ProfileMain` (Home/Community stacks) AND via the standalone `SettingsMainScreen` route.
- **CircleDetail** — registered in BOTH `HomeStack` AND `CirclesStack`. Which one you land in depends on whether you tapped a circle card on Dashboard (Home tab) or on the Circles list (Circles tab). Both go to the same screen component.
- **GroupChat** — same dual registration as CircleDetail.
- **AccessRestricted** — root-Stack registration, no greppable `navigation.navigate("AccessRestricted")` call. Likely triggered programmatically by `FeatureGateContext` when a user hits a score-gated screen. Worth confirming if you need this UX path.
- **AdvanceHub `→ Circles tab`** (`AdvanceHubScreen.tsx:238`) — cross-tab navigation. Tapping a button on the Advance Hub jumps the user to the Circles tab.

---

## Deep linking (`lib/deepLinking.ts`)

URL prefixes: `https://tandaxn.com`, `https://v0-tanda-xn.vercel.app`, plus the Expo dev `Linking.createURL("/")`.

| URL pattern | Resolves to |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/confirm` | Auth screens (root Stack) |
| `/invite/circle/:circleId` | `CircleInvite` (root Stack) |
| `/invite/community/:communityId` | `CommunityInvite` — **but no `<Stack.Screen>` registered** (linking config refers to it; navigation will fail. See Issues.) |
| `/join/:inviteCode` | `QuickJoin` |
| `/join-confirm` (with `?pending=<id>`) | `JoinConfirm` (the gated path — see doc 27) |
| `/set-password` | `SetPassword` |
| `/home`, `/circles`, `/action`, `/market`, `/community` | the five tabs |
| `/circle/:circleId` | `CircleDetail` |
| `/community/:communityId` | `CommunityHub` |
| `/goals`, `/goals/create` | `GoalsHub`, `CreateGoal` |
| `/dreams`, `/dreams/post/:postId`, `/dreams/user/:userId` | `DreamFeed`, `PostDetail`, `UserDreamProfile` |
| `/wallet`, `/profile`, `/settings` | `WalletMain`, `ProfileMain`, `Settings` |

---

## Issues found

### A. Navigation calls to UNREGISTERED routes (will silently fail or crash)

These are `navigation.navigate("X")` call sites where `"X"` has no corresponding `<Stack.Screen name="X" component=…>` anywhere in `App.tsx`. Tapping the relevant button at runtime will produce a "no screen named X" warning and do nothing (or hard error depending on RN version).

| Caller (file:line) | Bad target | Notes |
|---|---|---|
| `AddFundsScreen.tsx:375` | `"AddPaymentMethod"` | Likely meant `LinkedAccounts`? |
| `WithdrawScreen.tsx:319` | `"AddPaymentMethod"` | Same. |
| `KYCVerificationScreen.tsx:78` | `"WebView"` | No WebView screen exists. |
| `CycleTimelineScreen.tsx:269` | `"Payment"` | Likely meant `MakeContribution` or `TripPayment`. |
| `DefaultRecoveryScreen.tsx:148, 192` | `"DefaultDetail"`, `"LateContributionDetail"` | Neither screen exists. |
| `ParticipantManagerScreen.tsx:154` | `"ParticipantDetail"` | Missing screen. |
| `OwnerDashboardScreen.tsx:40, 139, 148, 157, 171, 223, 237` | `"EditStore"`, `"ManageServices"`, `"StoreBookings"` | Three missing screens, 7 broken nav buttons. |
| `LoanMarketplaceScreen.tsx:207` | `"LoanDashboard"` | Missing — maybe meant `LoanMarketplace` itself? |
| `DreamFeedScreen.tsx:182` | `"CirclesTab"` | Almost certainly meant tab key `Circles`. |
| `MarketplaceScreen.tsx:220` | `"RequestProvider"` | Listed in `RootStackParamList` but no Screen registration. |
| Linking config `CommunityInvite` | (no screen) | URL `/invite/community/:id` will not resolve to a screen. |

### B. Registered screens with NO `navigation.navigate()` inbound from any screen

These are screens registered in App.tsx but no other `.tsx` file under `screens/` contains `navigation.navigate("X")` targeting them. They could still be reachable via deep link, initial route, conditional/programmatic navigation, or hooks/context-driven `dispatch()` — so this isn't a confirmed orphan list, it's a **candidate** list to verify manually.

- AI / financial insight cluster: `StressScoreDashboard`, `MoodInsights`, `EarlyIntervention`, `ScoreBreakdown`, `CreditProfile` (referenced in LoanApplication? confirm), `GraduatedEntry`, `CrossCircleLending`, `DefaultRecovery`, `KYCVerification`, `LegalDocuments`
- Circle feature cluster: `ConflictAlert`, `InsurancePool`, `PartialContribution`, `PositionSwap`, `CircleVoting`, `DynamicPayout`, `CircleVisualizer`
- Trip leaf screens: `DocumentSubmission`, `TripPayment`, `ActivityEditor`, `TripDetail`, `MemberTripDashboard`, `ProviderTripDashboard`
- Modal cluster: `AccessRestricted` (triggered by FeatureGateContext, not direct navigate)

If you tap into the running app and find these unreachable from any UI button, they're either:
- Dead code from a half-finished feature (most likely for the AI cluster)
- Reachable only through code paths I didn't grep (notifications, push handlers, deep links that aren't in `lib/deepLinking.ts`)
- Programmatically routed (from context / from a hook)

### C. Duplicate registrations across stacks (intentional, but confusing)

Trip Organizer (11 screens) is registered in **3 places**: HomeStack, CirclesStack, MarketStack. Same component, three navigator scopes. Same for marketplace screens (HomeStack + MarketStack) and Profile screens (HomeStack + CommunityStack).

This is intentional — it means you can reach trip screens from any tab and they stay in that tab's stack — but it makes "where am I in the navigation tree" non-obvious. Tab-press resets handle this: switching tabs always pops back to the tab root.

### D. Confusingly-similar screen names

- `JoinConfirm` (root Stack, deep-link target, gated via `complete_circle_join` RPC) vs `JoinCircleConfirm` (CirclesStack, ungated `joinCircle()` direct INSERT). Two different join paths — see doc 28.
- `Settings` (the SettingsMainScreen) vs the various per-feature `…Settings` screens (NotificationPrefs, SecuritySettings, PrivacySettings, FeedSettings, AdminSettings).

---

## How to use this map

- **"How do I reach X?"** — `Ctrl+F` the screen name in this doc. If it appears in a tree branch, the path is shown. If it appears only in Issues §B, it may not be reachable via UI.
- **"What can I do from screen X?"** — find X in the tree; its outgoing arrows (`→ Y`) are its navigation children.
- **"Why doesn't this button work?"** — check Issues §A. If the button's target is in that table, the button is dead.
- **"Why are there two screens with similar names?"** — Issues §D.

---

## Links

- `docs/audit/04_screen_status.md` — confirms all 155 are *registered* (this doc is about *reachable*).
- `docs/audit/27_join_gate_revert_decision.md` — context on the JoinConfirm vs JoinCircleConfirm fork.
- `docs/audit/28_consolidate_join_paths.md` — Stage-4 prerequisite to collapse the 9 join paths to 1.
- `App.tsx:436-558` — HomeStack source.
- `App.tsx:561-614` — CirclesStack source.
- `App.tsx:617-649` — MarketStack source.
- `App.tsx:652-677` — CommunityStack source.
- `App.tsx:799-885` — Tab navigator source.
- `lib/deepLinking.ts` — URL→Screen mapping.
