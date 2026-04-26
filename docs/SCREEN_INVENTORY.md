# TandaXn — Screen Inventory

Every `.tsx` file under `screens/` is one screen. As of 2026-04-16 there are **140 screens** and **215 `Stack.Screen` registrations** in `App.tsx` (several are registered in more than one stack so they're reachable from multiple tabs).

Screens are grouped below by the user-facing feature area, **not** by which navigation stack they live in.

Legend:
- **Core** = part of a must-work v1 flow
- **Secondary** = feature exists, less critical for a demo
- **Flagged / advanced** = power-user / admin / ML-driven; some may be stubs
- **?** = status unclear — **NEEDS YOUR INPUT**

---

## 0. Pre-auth / entry

| File | Route | Role | Status |
|---|---|---|---|
| `SplashScreen.tsx` | `Splash` | Initial route. Animated logo, redirects to MainTabs if logged in. | Core |
| `WelcomeScreen.tsx` | `Welcome` | 3-slide intro carousel. Buttons → Signup / Login. | Core |
| `SignupScreen.tsx` | `Signup` | Email/password + phone registration. | Core |
| `LoginScreen.tsx` | `Login` | Email/password login. | Core |
| `OTPScreen.tsx` | `OTP` | SMS OTP verification. | Core |
| `EmailVerificationScreen.tsx` | `EmailVerification` | Post-signup "check your email" screen. | Core |
| `ForgotPasswordScreen.tsx` | `ForgotPassword` | Enter email to get reset link. | Core |
| `ResetPasswordScreen.tsx` | `ResetPassword` | New password entry (deep link target). | Core |
| `AuthCallbackScreen.tsx` | `AuthCallback` | Deep-link landing after Supabase auth redirect. | Core |
| `LockScreen.tsx` | *(conditional render)* | Shown when session is idle-locked; biometric/PIN unlock. | Core |
| `AccessRestrictedScreen.tsx` | `AccessRestricted` | Feature-gate wall. | Secondary |

## 1. Home / Dashboard

| File | Route | Role | Status |
|---|---|---|---|
| `DashboardScreen.tsx` | `Dashboard` | Default landing tab after login. Balance, circles, quick actions, "My Trips" card. | Core |
| `ActionScreen.tsx` | *(no direct route found)* | Generic action confirmation? | ? |

## 2. Circles (rotating savings groups — the core product)

| File | Route | Role | Status |
|---|---|---|---|
| `CirclesScreen.tsx` | `CirclesMain` | List of user's circles + discovery. | Core |
| `CircleDetailScreen.tsx` | `CircleDetail` | Single circle: members, schedule, contributions, payouts. | Core |
| `CircleInviteScreen.tsx` | `CircleInvite` | Share invite link / code. | Core |
| `JoinCircleByCodeScreen.tsx` | `JoinCircleByCode` | Enter invite code. | Core |
| `JoinCircleConfirmScreen.tsx` | `JoinCircleConfirm` | Review circle before joining. | Core |
| `JoinCircleSuccessScreen.tsx` | `JoinCircleSuccess` | Post-join confirmation. | Core |
| `CreateCircleStartScreen.tsx` | `CreateCircleStart` | Wizard step 1. | Core |
| `CreateCircleDetailsScreen.tsx` | `CreateCircleDetails` | Wizard step 2 (name, amount, members). | Core |
| `CreateCircleScheduleScreen.tsx` | `CreateCircleSchedule` | Wizard step 3 (cycle, payout order). | Core |
| `CreateCircleInviteScreen.tsx` | `CreateCircleInvite` | Wizard step 4 (invite members). | Core |
| `CreateCircleSuccessScreen.tsx` | `CreateCircleSuccess` | Wizard completion. | Core |
| `ManageMembersScreen.tsx` | `ManageMembers` | Add/remove/reorder members. | Core |
| `CircleVisualizerScreen.tsx` | `CircleVisualizer` | Visual representation of payout cycle. | Secondary |
| `CircleVotingScreen.tsx` | `CircleVoting` | Member voting (rule changes, mediation). | Secondary |
| `CycleTimelineScreen.tsx` | `CycleTimeline` | Timeline of past/upcoming cycles. | Secondary |
| `PositionSwapScreen.tsx` | `PositionSwap` | Swap payout position with another member. | Secondary |
| `DynamicPayoutScreen.tsx` | `DynamicPayout` | AI-suggested payout ordering. | Flagged |
| `PauseCircleScreen.tsx` | `PauseCircle` | Temporarily pause a circle. | Secondary |
| `CloseCircleScreen.tsx` | `CloseCircle` | Wind down a completed circle. | Secondary |
| `LeaveCircleScreen.tsx` | `LeaveCircle` | Leave a circle mid-cycle. | Secondary |
| `HowCirclesWorkScreen.tsx` | `HowCirclesWork` | Educational / onboarding. | Secondary |
| `VouchMemberScreen.tsx` | `VouchMember` | Vouch for a new member. | Secondary |

## 3. Contributions

| File | Route | Role | Status |
|---|---|---|---|
| `SelectCircleContributionScreen.tsx` | `SelectCircleContribution` | Which circle to contribute to. | Core |
| `MakeContributionScreen.tsx` | `MakeContribution` | Amount + payment method. | Core |
| `ContributionSuccessScreen.tsx` | `ContributionSuccess` | Post-payment confirmation. | Core |
| `PartialContributionScreen.tsx` | `PartialContribution` | Contribute less than required. | Secondary |

## 4. Wallet & Money movement

| File | Route | Role | Status |
|---|---|---|---|
| `WalletScreen.tsx` | `WalletMain` | Balance, transactions, add funds. | Core |
| `AddFundsScreen.tsx` | `AddFunds` | Top up (card / bank). | Core |
| `WithdrawScreen.tsx` | `Withdraw` | Withdraw to bank/mobile money. | Core |
| `SendMoneyScreen.tsx` | `SendMoney` | Send to another user / recipient. | Core |
| `DomesticSendMoneyScreen.tsx` | `DomesticSendMoney` | In-country transfer flow. | Core |
| `RemittanceScreen.tsx` | `Remittance` | Cross-border transfer. | Core |
| `SavedRecipientsScreen.tsx` | `SavedRecipients` | Address book. | Secondary |
| `AddRecipientScreen.tsx` | `AddRecipient` | Add a new recipient. | Secondary |
| `WalletTransactionSuccessScreen.tsx` | `WalletTransactionSuccess` | Generic money-moved confirmation. | Core |
| `PaymentHistoryScreen.tsx` | `PaymentHistory` | Past transactions. | Core |
| `LinkedAccountsScreen.tsx` | `LinkedAccounts` | Connected bank / card accounts. | Secondary |

## 5. Goals

| File | Route | Role | Status |
|---|---|---|---|
| `GoalsHubScreen.tsx` | `GoalsHub` | List of personal savings goals. | Core |
| `CreateGoalScreen.tsx` | `CreateGoal` | New goal wizard. | Core |
| `GoalDetailsScreen.tsx` | `GoalDetails` | Single goal progress. | Core |
| `EditGoalScreen.tsx` | `EditGoal` | Edit goal params. | Secondary |
| `DepositToGoalScreen.tsx` | `DepositToGoal` | Add money to goal. | Core |
| `WithdrawFromGoalScreen.tsx` | `WithdrawFromGoal` | Pull money from goal. | Core |

## 6. Advances / Loans / Credit

| File | Route | Role | Status |
|---|---|---|---|
| `AdvanceHubScreen.tsx` | `AdvanceHub` | Small advances against future contributions. | Core |
| `RequestAdvanceScreen.tsx` | `RequestAdvance` | Apply for advance. | Core |
| `AdvanceDetailsScreen.tsx` | `AdvanceDetails` | Advance status / repayment schedule. | Core |
| `AdvanceRepaymentScreen.tsx` | `AdvanceRepayment` | Repay an advance. | Core |
| `AdvanceExplanationScreen.tsx` | `AdvanceExplanation` | Educational / pricing page. | Secondary |
| `LoanMarketplaceScreen.tsx` | `LoanMarketplace` | Browse loans from partner lenders. | Secondary |
| `LoanApplicationScreen.tsx` | `LoanApplication` | Apply for a partner loan. | Secondary |
| `LoanDetailsScreen.tsx` | `LoanDetails` | Loan status. | Secondary |
| `LoanCalculatorScreen.tsx` | `LoanCalculator` | Payment calculator widget. | Secondary |
| `CreditProfileScreen.tsx` | `CreditProfile` | User's credit summary. | Secondary |
| `CrossCircleLendingScreen.tsx` | `CrossCircleLending` | Lend between circles. | Flagged |

## 7. XnScore (in-app credit score) & related ML

| File | Route | Role | Status |
|---|---|---|---|
| `XnScoreDashboardScreen.tsx` | `XnScoreDashboard` | Main score view. | Core |
| `XnScoreHistoryScreen.tsx` | `XnScoreHistory` | Score history over time. | Secondary |
| `ScoreBreakdownScreen.tsx` | `ScoreBreakdown` | What drives your score. | Secondary |
| `StressScoreDashboardScreen.tsx` | `StressScoreDashboard` | Financial stress indicator. | Flagged |
| `MoodInsightsScreen.tsx` | `MoodInsights` | Contribution-mood ML model. | Flagged |
| `EarlyInterventionScreen.tsx` | `EarlyIntervention` | Shown when risk signals trip. | Flagged |
| `GraduatedEntryScreen.tsx` | `GraduatedEntry` | Tier-up gating. | Flagged |
| `ConflictAlertScreen.tsx` | `ConflictAlert` | Conflict-prediction alert. | Flagged |

## 8. Trip Organizer (most recently worked on)

| File | Route | Role | Status |
|---|---|---|---|
| `OrganizerTripListScreen.tsx` | `OrganizerTripList` | Organizer's list of trips with filter tabs (All/Draft/Published/Past). | Core |
| `CreateTripWizardScreen.tsx` | `CreateTripWizard` | Multi-step wizard: Basics → Details → Pricing → Review → Publish. | Core |
| `OrganizerTripDashboardScreen.tsx` | `OrganizerTripDashboard` | Manage a single trip post-creation. | Core |
| `ItineraryBuilderScreen.tsx` | `ItineraryBuilder` | Day-by-day activity editor. | Core |
| `ActivityEditorScreen.tsx` | `ActivityEditor` | Edit a single activity. | Core |
| `ParticipantManagerScreen.tsx` | `ParticipantManager` | Manage sign-ups, approvals, waitlist. | Core |
| `TripPublicPageScreen.tsx` | `TripPublicPage` | Public shareable trip page (deep-linkable at `/trips/:slug`). | Core |
| `TripPublishSuccessScreen.tsx` | `TripPublishSuccess` | Post-publish confirmation + share link. | Core |
| `MyTripStatusScreen.tsx` | `MyTripStatus` | Participant view of their trip status. | Core |
| `DocumentSubmissionScreen.tsx` | `DocumentSubmission` | Upload passport / visa docs. | Core |
| `TripPaymentScreen.tsx` | `TripPayment` | Pay the trip deposit / full fee. | Core |
| `TripDetailScreen.tsx` | `TripDetail` | Generic trip detail (older, used in Marketplace). | Secondary |
| `MemberTripDashboardScreen.tsx` | `MemberTripDashboard` | Participant's ongoing-trip view. | Secondary |
| `ProviderTripDashboardScreen.tsx` | `ProviderTripDashboard` | Service provider's trip view. | Secondary |
| `CreateTripListingScreen.tsx` | `CreateTripListing` | **Legacy** — pre-wizard trip creation, may be dead code. | ? |

## 9. Marketplace & providers

| File | Route | Role | Status |
|---|---|---|---|
| `MarketplaceScreen.tsx` | `Marketplace` / `MarketMain` | Browse local goods/services/trips. | Core |
| `MarketInsightScreen.tsx` | `MarketInsight` | Analytics for owners. | Secondary |
| `BookServiceScreen.tsx` | `BookService` | Book a marketplace service. | Secondary |
| `StoreDetailScreen.tsx` | `StoreDetail` | Single store page. | Secondary |
| `StoreApplicationScreen.tsx` | `StoreApplication` | Apply to list a store. | Secondary |
| `NearYouScreen.tsx` | `NearYou` | Location-based listings. | Secondary |
| `NewArrivalsScreen.tsx` | `NewArrivals` | Recent listings. | Secondary |
| `OwnerDashboardScreen.tsx` | `OwnerDashboard` | Business-owner analytics. | Secondary |
| `ProviderDiscoveryScreen.tsx` | `ProviderDiscovery` | Find service providers. | Secondary |
| `ProviderProfileSetupScreen.tsx` | `ProviderProfileSetup` | Provider onboarding. | Secondary |
| `ProviderVerificationScreen.tsx` | `ProviderVerification` | KYB for providers. | Secondary |

## 10. Community & social feed

| File | Route | Role | Status |
|---|---|---|---|
| `CommunityTabScreen.tsx` | `CommunityMain` | Community tab home. | Core |
| `CommunityBrowserScreen.tsx` | `CommunityBrowser` | Discover communities. | Secondary |
| `CommunityHubScreen.tsx` | `CommunityHub` | Single community home. | Secondary |
| `CreateCommunityScreen.tsx` | `CreateCommunity` | Start a community. | Secondary |
| `CommunityMemoryScreen.tsx` | `CommunityMemory` | Shared history/media. | Secondary |
| `GatheringsScreen.tsx` | `Gatherings` | IRL events list. | Secondary |
| `CreateGatheringScreen.tsx` | `CreateGathering` | Schedule an event. | Secondary |
| `DreamFeedScreen.tsx` | `DreamFeed` | Aspirational goals feed. | Secondary |
| `CreateDreamPostScreen.tsx` | `CreateDreamPost` | Post a dream / goal. | Secondary |
| `DreamPostCommentsScreen.tsx` | `PostComments` | Comments on a dream. | Secondary |
| `SupportDreamScreen.tsx` | `SupportDream` | Contribute to another user's dream. | Secondary |
| `UserDreamProfileScreen.tsx` | `UserDreamProfile` | Another user's dream profile. | Secondary |
| `PostDetailScreen.tsx` | `PostDetail` | Generic post view. | Secondary |
| `PostToCommunityScreen.tsx` | `PostToCommunity` | Compose community post. | Secondary |
| `FeedSettingsScreen.tsx` | `FeedSettings` | Feed filters. | Secondary |

## 11. Elder / Governance / Trust

| File | Route | Role | Status |
|---|---|---|---|
| `ElderDashboardScreen.tsx` | `ElderDashboard` | Elder role hub. | Flagged |
| `BecomeElderScreen.tsx` | `BecomeElder` | Apply for elder role. | Flagged |
| `ElderTrainingHubScreen.tsx` | `ElderTrainingHub` | Training modules. | Flagged |
| `HonorScoreOverviewScreen.tsx` | `HonorScoreOverview` | Honor / reputation score. | Flagged |
| `HonorSystemScreen.tsx` | `HonorSystem` | Rules of honor system. | Flagged |
| `VouchSystemScreen.tsx` | `VouchSystem` | Vouch overview. | Flagged |
| `MediationCaseScreen.tsx` | `MediationCase` | Conflict mediation case view. | Flagged |
| `MediationToolsScreen.tsx` | `MediationTools` | Elder's mediation toolkit. | Flagged |
| `OversightDashboardScreen.tsx` | `OversightDashboard` | Cross-circle oversight. | Flagged |
| `InsurancePoolScreen.tsx` | `InsurancePool` | Mutual insurance pool. | Flagged |
| `DefaultRecoveryScreen.tsx` | `DefaultRecovery` | Default/collection workflow. | Flagged |

## 12. Notifications

| File | Route | Role | Status |
|---|---|---|---|
| `NotificationsInboxScreen.tsx` | `NotificationsInbox` | In-app notification feed. | Core |
| `NotificationPrefsScreen.tsx` | `NotificationPrefs` | Push/email preferences. | Secondary |

## 13. Profile & Settings

| File | Route | Role | Status |
|---|---|---|---|
| `ProfileScreen.tsx` | `ProfileMain` | User profile tab. | Core |
| `PersonalInfoScreen.tsx` | `PersonalInfo` | Name / DOB / address. | Core |
| `SettingsMainScreen.tsx` | `Settings` | Settings hub. | Core |
| `ChangePasswordScreen.tsx` | `ChangePassword` | Change password. | Core |
| `PrivacySettingsScreen.tsx` | `PrivacySettings` | Privacy toggles. | Secondary |
| `SecuritySettingsScreen.tsx` | `SecuritySettings` | 2FA, sessions, etc. | Secondary |
| `TwoFactorAuthScreen.tsx` | `TwoFactorAuth` | 2FA setup. | Secondary |
| `ActiveSessionsScreen.tsx` | `ActiveSessions` | Devices logged in. | Secondary |
| `LanguageRegionScreen.tsx` | `LanguageRegion` | Language / currency / locale. | Secondary |
| `ExportDataScreen.tsx` | `ExportData` | GDPR data export. | Secondary |
| `LegalDocumentsScreen.tsx` | `LegalDocuments` | TOS / privacy policy. | Secondary |
| `AboutAppScreen.tsx` | `AboutApp` | Version, team, credits. | Secondary |
| `HelpCenterScreen.tsx` | `HelpCenter` | FAQ / support. | Secondary |
| `ReportIssueScreen.tsx` | `ReportIssue` | Bug/abuse report. | Secondary |
| `AuditTrailScreen.tsx` | `AuditTrail` | User activity log. | Flagged |
| `AdminSettingsScreen.tsx` | `AdminSettings` | Super-admin panel. | Flagged |
| `KYCVerificationScreen.tsx` | `KYCVerification` | Identity verification. | Core |
| `QRCodeDisplayScreen.tsx` | `QRCodeDisplay` | Show user's QR (pay / add friend). | Secondary |
| `QRScannerScreen.tsx` | `QRScanner` | Scan a QR code. | Secondary |
| `BulkInvitesScreen.tsx` | `BulkInvites` | Bulk invite import. | Secondary |

---

## Summary counts

| Category | Screens |
|---|---:|
| Pre-auth / entry | 11 |
| Home / Dashboard | 2 |
| Circles | 22 |
| Contributions | 4 |
| Wallet & money | 11 |
| Goals | 6 |
| Advances / Loans / Credit | 11 |
| XnScore / ML | 8 |
| Trip Organizer | 15 |
| Marketplace & providers | 11 |
| Community & social | 15 |
| Elder / Governance / Trust | 11 |
| Notifications | 2 |
| Profile & Settings | 20 |
| **Total** | **149 entries** (140 unique files; some re-counted across tabs) |

---

## Things only you can resolve

> **[NEEDS YOUR INPUT]**
> - [ ] Confirm or correct the **Core / Secondary / Flagged** labels above. I marked ML/governance/mediation features as "Flagged" because they look ambitious and some may still be stubs, but I can't tell from code alone what's production-ready.
> - [ ] **CreateTripListingScreen vs CreateTripWizardScreen** — both exist, wizard is newer. Is the old `CreateTripListing` dead code we can delete?
> - [ ] **ActionScreen.tsx** — I found no navigation entry pointing to it. Orphaned?
> - [ ] Which 10-15 screens are the **demo path** for tomorrow's presentation? That lets us smoke-test exactly that flow on web before you go on stage.
