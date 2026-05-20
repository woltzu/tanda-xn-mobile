# Screen Status — Code-to-Deploy Mapping (CORRECTED v2)

⚠️ **This file supersedes the original 04_screen_status.md.** The original assumed Expo Router with `_layout.tsx` files. There are NONE.

## How navigation actually works

- Entry: `index.ts` → `App.tsx` (929 lines)
- Navigation library: **React Navigation 7** (`@react-navigation/native-stack`, `@react-navigation/bottom-tabs`)
- **NOT** Expo Router. The `expo-router` package is not in dependencies.
- Screens are imported from `./screens/` (155 files) and registered with `<Stack.Screen name=... component=...>`
- 5 tab routes (`Home`, `Circles`, `Action`, `Market`, `Community`) wired to nested stack navigators

## The `app/` folder mystery

`app/` has **305 `.tsx` files** organized as if for Expo Router (`(app)`, `(auth)` groups, kebab-case filenames with spaces like `CIRC-101 Browse Circles.tsx`).

**Imports from `app/` elsewhere in the repo:** 0

→ **The entire `app/` tree is orphaned dead code.** Nothing outside `app/` imports any of those files. They are unreachable in the running app. Most likely: a half-completed Expo Router refactor that was abandoned.

**Recommendation:** treat all 305 files in `app/` as `ORPHAN_REFACTOR`. They consume disk space and confuse audit tooling but don't run.

## Real reachability: the `screens/` folder

**Status definitions:**
- 🟢 **REACHABLE** — imported by `App.tsx` AND its component name appears in a `<Stack.Screen ... component={X}>` or `<Tab.Screen ... component={X}>`
- 🟡 **IMPORTED_NOT_REGISTERED** — imported by `App.tsx` but never used in a Stack.Screen. Dead reference (will show as compile-clean but never navigates).
- 🔴 **ORPHAN_FILE** — file exists in `screens/` but `App.tsx` doesn't import it. Cannot be navigated to from the main app.

## Status totals

| Status | Count |
|--------|-------|
| 🟢 REACHABLE | 155 |
| 🟡 IMPORTED_NOT_REGISTERED | 0 |
| 🔴 ORPHAN_FILE (in screens/) | 0 |
| 🔴 ORPHAN_REFACTOR (in app/) | 305 |
| **Total screen files** | **460** |

**Of the 155 screens/ files, 155 are actually reachable in the running app.**

## Per-screen detail — `screens/` folder

| File | Component | Status |
|------|-----------|--------|
| `AboutAppScreen.tsx` | AboutAppScreen | 🟢 REACHABLE |
| `AccessRestrictedScreen.tsx` | AccessRestrictedScreen | 🟢 REACHABLE |
| `ActionScreen.tsx` | ActionScreen | 🟢 REACHABLE |
| `ActiveSessionsScreen.tsx` | ActiveSessionsScreen | 🟢 REACHABLE |
| `ActivityEditorScreen.tsx` | ActivityEditorScreen | 🟢 REACHABLE |
| `AddFundsScreen.tsx` | AddFundsScreen | 🟢 REACHABLE |
| `AddRecipientScreen.tsx` | AddRecipientScreen | 🟢 REACHABLE |
| `AdminSettingsScreen.tsx` | AdminSettingsScreen | 🟢 REACHABLE |
| `AdvanceDetailsScreen.tsx` | AdvanceDetailsScreen | 🟢 REACHABLE |
| `AdvanceExplanationScreen.tsx` | AdvanceExplanationScreen | 🟢 REACHABLE |
| `AdvanceHubScreen.tsx` | AdvanceHubScreen | 🟢 REACHABLE |
| `AdvanceRepaymentScreen.tsx` | AdvanceRepaymentScreen | 🟢 REACHABLE |
| `AuditTrailScreen.tsx` | AuditTrailScreen | 🟢 REACHABLE |
| `AuthCallbackScreen.tsx` | AuthCallbackScreen | 🟢 REACHABLE |
| `BecomeElderScreen.tsx` | BecomeElderScreen | 🟢 REACHABLE |
| `BookServiceScreen.tsx` | BookServiceScreen | 🟢 REACHABLE |
| `BulkInvitesScreen.tsx` | BulkInvitesScreen | 🟢 REACHABLE |
| `ChangePasswordScreen.tsx` | ChangePasswordScreen | 🟢 REACHABLE |
| `CircleDetailScreen.tsx` | CircleDetailScreen | 🟢 REACHABLE |
| `CircleInviteScreen.tsx` | CircleInviteScreen | 🟢 REACHABLE |
| `CircleVisualizerScreen.tsx` | CircleVisualizerScreen | 🟢 REACHABLE |
| `CircleVotingScreen.tsx` | CircleVotingScreen | 🟢 REACHABLE |
| `CirclesScreen.tsx` | CirclesScreen | 🟢 REACHABLE |
| `CloseCircleScreen.tsx` | CloseCircleScreen | 🟢 REACHABLE |
| `CommunityBrowserScreen.tsx` | CommunityBrowserScreen | 🟢 REACHABLE |
| `CommunityHubScreen.tsx` | CommunityHubScreen | 🟢 REACHABLE |
| `CommunityMemoryScreen.tsx` | CommunityMemoryScreen | 🟢 REACHABLE |
| `CommunityTabScreen.tsx` | CommunityTabScreen | 🟢 REACHABLE |
| `ConflictAlertScreen.tsx` | ConflictAlertScreen | 🟢 REACHABLE |
| `ContributionSuccessScreen.tsx` | ContributionSuccessScreen | 🟢 REACHABLE |
| `CreateCircleDetailsScreen.tsx` | CreateCircleDetailsScreen | 🟢 REACHABLE |
| `CreateCircleInviteScreen.tsx` | CreateCircleInviteScreen | 🟢 REACHABLE |
| `CreateCircleScheduleScreen.tsx` | CreateCircleScheduleScreen | 🟢 REACHABLE |
| `CreateCircleStartScreen.tsx` | CreateCircleStartScreen | 🟢 REACHABLE |
| `CreateCircleSuccessScreen.tsx` | CreateCircleSuccessScreen | 🟢 REACHABLE |
| `CreateCommunityScreen.tsx` | CreateCommunityScreen | 🟢 REACHABLE |
| `CreateDreamPostScreen.tsx` | CreateDreamPostScreen | 🟢 REACHABLE |
| `CreateGatheringScreen.tsx` | CreateGatheringScreen | 🟢 REACHABLE |
| `CreateGoalScreen.tsx` | CreateGoalScreen | 🟢 REACHABLE |
| `CreateTripListingScreen.tsx` | CreateTripListingScreen | 🟢 REACHABLE |
| `CreateTripWizardScreen.tsx` | CreateTripWizardScreen | 🟢 REACHABLE |
| `CreditProfileScreen.tsx` | CreditProfileScreen | 🟢 REACHABLE |
| `CrossCircleLendingScreen.tsx` | CrossCircleLendingScreen | 🟢 REACHABLE |
| `CycleTimelineScreen.tsx` | CycleTimelineScreen | 🟢 REACHABLE |
| `DashboardScreen.tsx` | DashboardScreen | 🟢 REACHABLE |
| `DefaultRecoveryScreen.tsx` | DefaultRecoveryScreen | 🟢 REACHABLE |
| `DepositToGoalScreen.tsx` | DepositToGoalScreen | 🟢 REACHABLE |
| `DocumentSubmissionScreen.tsx` | DocumentSubmissionScreen | 🟢 REACHABLE |
| `DomesticSendMoneyScreen.tsx` | DomesticSendMoneyScreen | 🟢 REACHABLE |
| `DreamFeedScreen.tsx` | DreamFeedScreen | 🟢 REACHABLE |
| `DreamPostCommentsScreen.tsx` | DreamPostCommentsScreen | 🟢 REACHABLE |
| `DynamicPayoutScreen.tsx` | DynamicPayoutScreen | 🟢 REACHABLE |
| `EarlyInterventionScreen.tsx` | EarlyInterventionScreen | 🟢 REACHABLE |
| `EditGoalScreen.tsx` | EditGoalScreen | 🟢 REACHABLE |
| `ElderDashboardScreen.tsx` | ElderDashboardScreen | 🟢 REACHABLE |
| `ElderTrainingHubScreen.tsx` | ElderTrainingHubScreen | 🟢 REACHABLE |
| `EmailVerificationScreen.tsx` | EmailVerificationScreen | 🟢 REACHABLE |
| `ExportDataScreen.tsx` | ExportDataScreen | 🟢 REACHABLE |
| `FeedSettingsScreen.tsx` | FeedSettingsScreen | 🟢 REACHABLE |
| `ForgotPasswordScreen.tsx` | ForgotPasswordScreen | 🟢 REACHABLE |
| `GatheringsScreen.tsx` | GatheringsScreen | 🟢 REACHABLE |
| `GoalDetailsScreen.tsx` | GoalDetailsScreen | 🟢 REACHABLE |
| `GoalsHubScreen.tsx` | GoalsHubScreen | 🟢 REACHABLE |
| `GraduatedEntryScreen.tsx` | GraduatedEntryScreen | 🟢 REACHABLE |
| `GroupChatScreen.tsx` | GroupChatScreen | 🟢 REACHABLE |
| `HelpCenterScreen.tsx` | HelpCenterScreen | 🟢 REACHABLE |
| `HonorScoreOverviewScreen.tsx` | HonorScoreOverviewScreen | 🟢 REACHABLE |
| `HonorSystemScreen.tsx` | HonorSystemScreen | 🟢 REACHABLE |
| `HowCirclesWorkScreen.tsx` | HowCirclesWorkScreen | 🟢 REACHABLE |
| `InsurancePoolScreen.tsx` | InsurancePoolScreen | 🟢 REACHABLE |
| `ItineraryBuilderScreen.tsx` | ItineraryBuilderScreen | 🟢 REACHABLE |
| `JoinCircleByCodeScreen.tsx` | JoinCircleByCodeScreen | 🟢 REACHABLE |
| `JoinCircleConfirmScreen.tsx` | JoinCircleConfirmScreen | 🟢 REACHABLE |
| `JoinCircleSuccessScreen.tsx` | JoinCircleSuccessScreen | 🟢 REACHABLE |
| `JoinConfirmScreen.tsx` | JoinConfirmScreen | 🟢 REACHABLE |
| `KYCVerificationScreen.tsx` | KYCVerificationScreen | 🟢 REACHABLE |
| `LanguageRegionScreen.tsx` | LanguageRegionScreen | 🟢 REACHABLE |
| `LeaveCircleScreen.tsx` | LeaveCircleScreen | 🟢 REACHABLE |
| `LegalDocumentsScreen.tsx` | LegalDocumentsScreen | 🟢 REACHABLE |
| `LinkedAccountsScreen.tsx` | LinkedAccountsScreen | 🟢 REACHABLE |
| `LoanApplicationScreen.tsx` | LoanApplicationScreen | 🟢 REACHABLE |
| `LoanCalculatorScreen.tsx` | LoanCalculatorScreen | 🟢 REACHABLE |
| `LoanDetailsScreen.tsx` | LoanDetailsScreen | 🟢 REACHABLE |
| `LoanMarketplaceScreen.tsx` | LoanMarketplaceScreen | 🟢 REACHABLE |
| `LockScreen.tsx` | LockScreen | 🟢 REACHABLE |
| `LoginScreen.tsx` | LoginScreen | 🟢 REACHABLE |
| `MakeContributionScreen.tsx` | MakeContributionScreen | 🟢 REACHABLE |
| `ManageMembersScreen.tsx` | ManageMembersScreen | 🟢 REACHABLE |
| `MarketInsightScreen.tsx` | MarketInsightScreen | 🟢 REACHABLE |
| `MarketplaceScreen.tsx` | MarketplaceScreen | 🟢 REACHABLE |
| `MediationCaseScreen.tsx` | MediationCaseScreen | 🟢 REACHABLE |
| `MediationToolsScreen.tsx` | MediationToolsScreen | 🟢 REACHABLE |
| `MemberTripDashboardScreen.tsx` | MemberTripDashboardScreen | 🟢 REACHABLE |
| `MoodInsightsScreen.tsx` | MoodInsightsScreen | 🟢 REACHABLE |
| `MyTripStatusScreen.tsx` | MyTripStatusScreen | 🟢 REACHABLE |
| `NearYouScreen.tsx` | NearYouScreen | 🟢 REACHABLE |
| `NewArrivalsScreen.tsx` | NewArrivalsScreen | 🟢 REACHABLE |
| `NotificationPrefsScreen.tsx` | NotificationPrefsScreen | 🟢 REACHABLE |
| `NotificationsInboxScreen.tsx` | NotificationsInboxScreen | 🟢 REACHABLE |
| `OTPScreen.tsx` | OTPScreen | 🟢 REACHABLE |
| `OrganizerTripDashboardScreen.tsx` | OrganizerTripDashboardScreen | 🟢 REACHABLE |
| `OrganizerTripListScreen.tsx` | OrganizerTripListScreen | 🟢 REACHABLE |
| `OversightDashboardScreen.tsx` | OversightDashboardScreen | 🟢 REACHABLE |
| `OwnerDashboardScreen.tsx` | OwnerDashboardScreen | 🟢 REACHABLE |
| `PartialContributionScreen.tsx` | PartialContributionScreen | 🟢 REACHABLE |
| `ParticipantManagerScreen.tsx` | ParticipantManagerScreen | 🟢 REACHABLE |
| `PauseCircleScreen.tsx` | PauseCircleScreen | 🟢 REACHABLE |
| `PaymentHistoryScreen.tsx` | PaymentHistoryScreen | 🟢 REACHABLE |
| `PersonalInfoScreen.tsx` | PersonalInfoScreen | 🟢 REACHABLE |
| `PositionSwapScreen.tsx` | PositionSwapScreen | 🟢 REACHABLE |
| `PostDetailScreen.tsx` | PostDetailScreen | 🟢 REACHABLE |
| `PostToCommunityScreen.tsx` | PostToCommunityScreen | 🟢 REACHABLE |
| `PrivacySettingsScreen.tsx` | PrivacySettingsScreen | 🟢 REACHABLE |
| `ProfileScreen.tsx` | ProfileScreen | 🟢 REACHABLE |
| `ProviderDiscoveryScreen.tsx` | ProviderDiscoveryScreen | 🟢 REACHABLE |
| `ProviderProfileSetupScreen.tsx` | ProviderProfileSetupScreen | 🟢 REACHABLE |
| `ProviderTripDashboardScreen.tsx` | ProviderTripDashboardScreen | 🟢 REACHABLE |
| `ProviderVerificationScreen.tsx` | ProviderVerificationScreen | 🟢 REACHABLE |
| `QRCodeDisplayScreen.tsx` | QRCodeDisplayScreen | 🟢 REACHABLE |
| `QRScannerScreen.tsx` | QRScannerScreen | 🟢 REACHABLE |
| `QuickJoinPaymentSuccessScreen.tsx` | QuickJoinPaymentSuccessScreen | 🟢 REACHABLE |
| `QuickJoinPendingConfirmationScreen.tsx` | QuickJoinPendingConfirmationScreen | 🟢 REACHABLE |
| `QuickJoinScreen.tsx` | QuickJoinScreen | 🟢 REACHABLE |
| `RemittanceScreen.tsx` | RemittanceScreen | 🟢 REACHABLE |
| `ReportIssueScreen.tsx` | ReportIssueScreen | 🟢 REACHABLE |
| `RequestAdvanceScreen.tsx` | RequestAdvanceScreen | 🟢 REACHABLE |
| `ResetPasswordScreen.tsx` | ResetPasswordScreen | 🟢 REACHABLE |
| `SavedRecipientsScreen.tsx` | SavedRecipientsScreen | 🟢 REACHABLE |
| `ScoreBreakdownScreen.tsx` | ScoreBreakdownScreen | 🟢 REACHABLE |
| `SecuritySettingsScreen.tsx` | SecuritySettingsScreen | 🟢 REACHABLE |
| `SelectCircleContributionScreen.tsx` | SelectCircleContributionScreen | 🟢 REACHABLE |
| `SendMoneyScreen.tsx` | SendMoneyScreen | 🟢 REACHABLE |
| `SetPasswordScreen.tsx` | SetPasswordScreen | 🟢 REACHABLE |
| `SettingsMainScreen.tsx` | SettingsMainScreen | 🟢 REACHABLE |
| `SignupScreen.tsx` | SignupScreen | 🟢 REACHABLE |
| `SplashScreen.tsx` | SplashScreen | 🟢 REACHABLE |
| `StoreApplicationScreen.tsx` | StoreApplicationScreen | 🟢 REACHABLE |
| `StoreDetailScreen.tsx` | StoreDetailScreen | 🟢 REACHABLE |
| `StressScoreDashboardScreen.tsx` | StressScoreDashboardScreen | 🟢 REACHABLE |
| `SupportDreamScreen.tsx` | SupportDreamScreen | 🟢 REACHABLE |
| `TripDetailScreen.tsx` | TripDetailScreen | 🟢 REACHABLE |
| `TripPaymentScreen.tsx` | TripPaymentScreen | 🟢 REACHABLE |
| `TripPublicPageScreen.tsx` | TripPublicPageScreen | 🟢 REACHABLE |
| `TripPublishSuccessScreen.tsx` | TripPublishSuccessScreen | 🟢 REACHABLE |
| `TwoFactorAuthScreen.tsx` | TwoFactorAuthScreen | 🟢 REACHABLE |
| `UserDreamProfileScreen.tsx` | UserDreamProfileScreen | 🟢 REACHABLE |
| `VouchMemberScreen.tsx` | VouchMemberScreen | 🟢 REACHABLE |
| `VouchSystemScreen.tsx` | VouchSystemScreen | 🟢 REACHABLE |
| `WalletScreen.tsx` | WalletScreen | 🟢 REACHABLE |
| `WalletTransactionSuccessScreen.tsx` | WalletTransactionSuccessScreen | 🟢 REACHABLE |
| `WelcomeScreen.tsx` | WelcomeScreen | 🟢 REACHABLE |
| `WithdrawFromGoalScreen.tsx` | WithdrawFromGoalScreen | 🟢 REACHABLE |
| `WithdrawScreen.tsx` | WithdrawScreen | 🟢 REACHABLE |
| `XnScoreDashboardScreen.tsx` | XnScoreDashboardScreen | 🟢 REACHABLE |
| `XnScoreHistoryScreen.tsx` | XnScoreHistoryScreen | 🟢 REACHABLE |

## `app/` folder — sample (first 50 of 305 files)

All are ORPHAN_REFACTOR. Truncated for brevity — full list is the union of `app/(app)/**.tsx` and `app/(auth)/**.tsx`.

| File | Size |
|------|------|
| `app/(app)/account/ACCOUNT-001-VerificationPending.tsx` | 3,871 B |
| `app/(app)/account/ACCOUNT-002-AccountLocked.tsx` | 2,524 B |
| `app/(app)/circles/CIRC-101 Browse Circles.tsx` | 22,861 B |
| `app/(app)/circles/CIRC-102 Circle Details Preview.tsx` | 28,184 B |
| `app/(app)/circles/CIRC-103 Circle Type Explainer.tsx` | 14,203 B |
| `app/(app)/circles/CIRC-104 Circle Comparison.tsx` | 16,659 B |
| `app/(app)/circles/CIRC-105 Circle Rules & Terms.tsx` | 16,267 B |
| `app/(app)/circles/CIRC-106 Circle FAQ.tsx` | 17,202 B |
| `app/(app)/circles/CIRC-107 Join Circle Confirmation.tsx` | 20,282 B |
| `app/(app)/circles/CIRC-108 Join Circle Success.tsx` | 17,210 B |
| `app/(app)/circles/CIRC-201 Create Circle Start.tsx` | 12,777 B |
| `app/(app)/circles/CIRC-202 Create Circle Details.tsx` | 16,810 B |
| `app/(app)/circles/CIRC-203 Create Circle Schedule.tsx` | 19,078 B |
| `app/(app)/circles/CIRC-204 Create Circle Invite.tsx` | 14,401 B |
| `app/(app)/circles/CIRC-205 Create Circle Review.tsx` | 14,971 B |
| `app/(app)/circles/CIRC-206 Create Circle Success.tsx` | 15,316 B |
| `app/(app)/circles/CIRC-301 Circle Dashboard.tsx` | 19,664 B |
| `app/(app)/circles/CIRC-302 Circle Members.tsx` | 11,561 B |
| `app/(app)/circles/CIRC-303 Member Profile.tsx` | 15,254 B |
| `app/(app)/circles/CIRC-304 Invite to Circle.tsx` | 18,242 B |
| `app/(app)/circles/CIRC-305 Circle Settings.tsx` | 24,153 B |
| `app/(app)/circles/CIRC-306 Leave Circle.tsx` | 17,773 B |
| `app/(app)/circles/CIRC-307 Circle Chat.tsx` | 8,996 B |
| `app/(app)/circles/CIRC-308 Pending Join Requests.tsx` | 15,655 B |
| `app/(app)/circles/CIRC-309 Report Member.tsx` | 15,996 B |
| `app/(app)/circles/CIRC-401 Contributions History.tsx` | 14,758 B |
| `app/(app)/circles/CIRC-402 Make Contribution.tsx` | 18,176 B |
| `app/(app)/circles/CIRC-403 Contribution Success.tsx` | 13,435 B |
| `app/(app)/circles/CIRC-404 Payout Schedule.tsx` | 16,572 B |
| `app/(app)/circles/CIRC-405 Payout Details.tsx` | 15,715 B |
| `app/(app)/circles/CIRC-406 Emergency Withdrawal.tsx` | 22,918 B |
| `app/(app)/community/060-COMM-001-CommunityHub.tsx` | 15,905 B |
| `app/(app)/community/061-COMM-002-ReferralDashboard.tsx` | 19,614 B |
| `app/(app)/community/062-COMM-003-InviteFriends.tsx` | 14,751 B |
| `app/(app)/community/063-COMM-004-ShareReferralLink.tsx` | 12,227 B |
| `app/(app)/community/064-COMM-005-ReferralRewards.tsx` | 16,239 B |
| `app/(app)/community/065-COMM-006-ReferralHistory.tsx` | 12,959 B |
| `app/(app)/community/066-COMM-007-CommunityLeaderboard.tsx` | 13,742 B |
| `app/(app)/community/067-COMM-008-Endorsements.tsx` | 16,717 B |
| `app/(app)/community/068-COMM-009-CommunityActivityFeed.tsx` | 13,335 B |
| `app/(app)/community/COMM-NEW-CommunityBrowser.tsx` | 19,724 B |
| `app/(app)/community/COMM-NEW-CommunityHub.tsx` | 19,299 B |
| `app/(app)/community/COMM-NEW-CreateCircleWithCommunity.tsx` | 30,818 B |
| `app/(app)/community/COMM-NEW-CreateCommunity.tsx` | 17,817 B |
| `app/(app)/cross-border/XBOR-DIA-CommunityIntelligence.tsx` | 19,876 B |
| `app/(app)/cross-border/XBOR-MOB-MobileMoneySelection.tsx` | 17,111 B |
| `app/(app)/cross-border/XBORDER-001-SendMoneyHome.tsx` | 18,801 B |
| `app/(app)/cross-border/XBORDER-002-SelectRecipient.tsx` | 9,669 B |
| `app/(app)/cross-border/XBORDER-003-AddNewRecipient.tsx` | 15,998 B |
| `app/(app)/cross-border/XBORDER-004-EnterAmount.tsx` | 26,936 B |
| ... and 255 more | |