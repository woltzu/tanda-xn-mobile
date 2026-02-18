# TandaXn Mobile App - Build Plan

## Current Status: MVP Foundation Complete

### What's Already Built:
- Authentication (email/password, phone OTP)
- User profile & preferences (language, region, community)
- Create Circle flow (5 screens)
- Browse/My Circles with tabs
- Dashboard overview
- Basic Wallet & Profile UI
- CirclesContext for data persistence

---

## PHASE 1: Core Circle Experience (Priority: Critical)
*Goal: Make circles actually functional so users can participate*

### 1.1 Circle Details & Dashboard
- [ ] CircleDetailScreen - View circle info, members, schedule
- [ ] CircleMembersScreen - See all members with XnScores
- [ ] MemberProfileScreen - View individual member details
- [ ] Reference: `CIRC-203`, `CIRC-206`, `CIRC-208`, `CIRC-209`

### 1.2 Join Circle Flow
- [ ] JoinCircleScreen - Request to join a circle
- [ ] JoinReviewScreen - Review terms before joining
- [ ] JoinSuccessScreen - Confirmation
- [ ] Reference: `CIRC-204`, `CIRC-205`

### 1.3 Active Circle Participation
- [ ] ContributionScreen - Make a payment/contribution
- [ ] PayoutScreen - View upcoming/received payouts
- [ ] RotationScheduleScreen - See who's next in line
- [ ] Reference: `CIRC-207`

---

## PHASE 2: Wallet & Payments (Priority: High)
*Goal: Enable money movement - the core value proposition*

### 2.1 Wallet Core
- [ ] WalletHomeScreen - Balance, recent activity (update existing)
- [ ] TransactionHistoryScreen - Full transaction list
- [ ] TransactionDetailScreen - Individual transaction details
- [ ] Reference: `WAL-201`, `WAL-202`, `WAL-203`, `WAL-204`

### 2.2 Add Funds
- [ ] AddFundsScreen - Method selection
- [ ] AddFundsBankScreen - Bank transfer
- [ ] AddFundsCardScreen - Debit card
- [ ] AddFundsConfirmScreen - Confirmation
- [ ] Reference: `WAL-205`, `WAL-206`, `WAL-207`, `WAL-208`

### 2.3 Withdraw Funds
- [ ] WithdrawScreen - Initiate withdrawal
- [ ] WithdrawMethodScreen - Select destination
- [ ] WithdrawConfirmScreen - Review and confirm
- [ ] Reference: `WAL-209`, `WAL-210`, `WAL-211`

### 2.4 Send Money (Within App)
- [ ] SendMoneyScreen - Select recipient
- [ ] SendAmountScreen - Enter amount
- [ ] SendConfirmScreen - Review and send
- [ ] Reference: `WAL-212`, `WAL-213`, `WAL-214`

---

## PHASE 3: Payment Methods & KYC (Priority: High)
*Goal: Connect real bank accounts and verify users*

### 3.1 Payment Methods
- [ ] PaymentMethodsScreen - List linked accounts
- [ ] AddBankAccountScreen - Link bank account
- [ ] AddDebitCardScreen - Link debit card
- [ ] VerifyPaymentScreen - OTP/micro-deposit verification
- [ ] Reference: `PAY-201` through `PAY-211`

### 3.2 KYC/Verification
- [ ] VerificationOptionsScreen - Show verification paths
- [ ] TaxIDScreen - SSN/ITIN entry
- [ ] ITINEducationScreen - Help for undocumented users
- [ ] InternationalVerificationScreen - Non-US verification
- [ ] VerificationSuccessScreen - Completion
- [ ] Reference: `KYC-201` through `KYC-209`

---

## PHASE 4: XnScore & Trust System (Priority: Medium-High)
*Goal: Make the trust score meaningful and actionable*

### 4.1 XnScore Features
- [ ] XnScoreDashboardScreen - Detailed score breakdown
- [ ] XnScoreHistoryScreen - Score changes over time
- [ ] HowItWorksScreen - Education about scoring
- [ ] ImprovementTipsScreen - Actions to improve score
- [ ] Reference: `SCORE-201` through `SCORE-204`

### 4.2 Endorsements & Vouching
- [ ] EndorsementsScreen - Give/receive endorsements
- [ ] RequestVouchScreen - Ask for a vouch
- [ ] VouchHistoryScreen - Track vouching activity
- [ ] Reference: `ELDER-214`, `ELDER-215`, `ELDER-217`

---

## PHASE 5: Cross-Border & Remittance (Priority: Medium-High)
*Goal: Enable "sending money home" - key diaspora feature*

### 5.1 Send Money Internationally
- [ ] SendHomeScreen - Start international transfer
- [ ] SelectRecipientScreen - Choose who to send to
- [ ] AddRecipientScreen - Add new recipient
- [ ] TransferAmountScreen - Enter amount with FX rates
- [ ] DeliveryMethodScreen - Bank, mobile money, cash pickup
- [ ] TransferReviewScreen - Final review
- [ ] TransferProcessingScreen - Status while processing
- [ ] TransferCompleteScreen - Success confirmation
- [ ] Reference: `XBORDER-201` through `XBORDER-208`

### 5.2 Track & History
- [ ] TrackTransferScreen - Real-time tracking
- [ ] TransferHistoryScreen - Past transfers
- [ ] TransferDetailScreen - Individual transfer info
- [ ] Reference: `XBORDER-209`, `XBORDER-210`, `XBORDER-211`

### 5.3 Recipient Management
- [ ] ManageRecipientsScreen - Saved recipients
- [ ] RecipientDetailScreen - Edit recipient info
- [ ] Reference: `XBORDER-212`

---

## PHASE 6: Advance/Loan System (Priority: Medium)
*Goal: Enable users to get advances against their circle position*

### 6.1 Advance Discovery
- [ ] AdvanceHubScreen - Overview of advance options
- [ ] AdvanceExplanationScreen - How it works
- [ ] AdvanceCalculatorScreen - See what you qualify for
- [ ] Reference: `ADV-201`, `ADV-202`, `ADV-203`

### 6.2 Apply for Advance
- [ ] AdvanceApplicationScreen - Apply for advance
- [ ] AdvanceStatusScreen - Track application
- [ ] AdvanceAgreementScreen - Terms acceptance
- [ ] AdvanceDisbursementScreen - Receive funds
- [ ] Reference: `ADV-204`, `ADV-205`, `ADV-211`, `ADV-206`

### 6.3 Repayment
- [ ] AdvanceRepaymentScreen - Make repayments
- [ ] EarlyRepaymentScreen - Pay off early
- [ ] RepaymentHistoryScreen - Past payments
- [ ] Reference: `ADV-207`, `ADV-210`, `ADV-208`

---

## PHASE 7: Goals & Savings (Priority: Medium)
*Goal: Help users set and track savings goals*

### 7.1 Goals Management
- [ ] GoalsDashboardScreen - Overview of all goals
- [ ] GoalDetailScreen - Individual goal progress
- [ ] AddGoalScreen - Create new goal
- [ ] EditGoalScreen - Modify existing goal
- [ ] Reference: `GOAL-201` through `GOAL-204`

### 7.2 Goal Progress
- [ ] GoalProgressScreen - Detailed progress view
- [ ] GoalMilestonesScreen - Achievement tracking
- [ ] GoalWithdrawalScreen - Withdraw from goal
- [ ] Reference: `GOAL-205`, `GOAL-206`, `GOAL-211` through `GOAL-214`

### 7.3 Tier System
- [ ] TierSelectionScreen - Choose saving tier
- [ ] TierUpgradeScreen - Upgrade tier for better rates
- [ ] TierComparisonScreen - Compare tier benefits
- [ ] Reference: `GOAL-207`, `GOAL-208`, `GOAL-209`, `GOAL-210`

---

## PHASE 8: Community & Referrals (Priority: Medium)
*Goal: Drive viral growth through community features*

### 8.1 Referral System
- [ ] ReferralDashboardScreen - Track referrals
- [ ] InviteFriendsScreen - Share invite links
- [ ] ReferralRewardsScreen - View earned rewards
- [ ] ReferralHistoryScreen - Past referrals
- [ ] Reference: `COMM-202`, `COMM-203`, `COMM-205`, `COMM-206`

### 8.2 Community Features
- [ ] CommunityHubScreen - Community home
- [ ] LeaderboardScreen - Top contributors
- [ ] ActivityFeedScreen - Community activity
- [ ] CommunityBrowserScreen - Find communities
- [ ] Reference: `COMM-201`, `COMM-207`, `COMM-209`, `COMM-210`

---

## PHASE 9: Settings & Security (Priority: Medium)
*Goal: Complete user control over their account*

### 9.1 Settings Screens
- [ ] SettingsMainScreen - Main settings menu
- [ ] EditProfileScreen - Update profile info
- [ ] SecuritySettingsScreen - Security options
- [ ] ChangePasswordScreen - Update password
- [ ] TwoFactorSetupScreen - Enable 2FA
- [ ] Reference: `SET-201` through `SET-205`

### 9.2 Privacy & Notifications
- [ ] NotificationSettingsScreen - Push notification prefs
- [ ] PrivacySettingsScreen - Privacy controls
- [ ] StealthModeScreen - Hide from searches
- [ ] BlockListScreen - Manage blocked users
- [ ] Reference: `SET-206`, `SET-207`, `PRIV-201` through `PRIV-206`

### 9.3 Account Management
- [ ] LinkedAccountsScreen - Connected services
- [ ] ActiveSessionsScreen - Device management
- [ ] DataManagementScreen - Export/delete data
- [ ] Reference: `SET-208`, `SET-209`

---

## PHASE 10: Elder/Mediation System (Priority: Lower)
*Goal: Community governance and dispute resolution*

### 10.1 Become an Elder
- [ ] BecomeElderScreen - Application to become elder
- [ ] ElderApplicationScreen - Detailed application
- [ ] ElderTrainingScreen - Training materials
- [ ] Reference: `ELDER-201`, `ELDER-202`, `ELDER-212`

### 10.2 Elder Functions
- [ ] HonorScoreScreen - Elder reputation
- [ ] CaseQueueScreen - Pending mediations
- [ ] MediationToolkitScreen - Tools for resolution
- [ ] RulingTemplatesScreen - Standard rulings
- [ ] Reference: `ELDER-203`, `ELDER-209`, `ELDER-210`, `ELDER-211`

---

## PHASE 11: Help & Support (Priority: Lower)
*Goal: Self-service support for users*

### 11.1 Help Center
- [ ] HelpCenterScreen - Main help hub
- [ ] FAQScreen - Frequently asked questions
- [ ] ContactSupportScreen - Get human help
- [ ] Reference: `SET-210`, `HELP-201` through `HELP-204`

### 11.2 Legal & About
- [ ] AboutScreen - App info
- [ ] TermsScreen - Terms of service
- [ ] PrivacyPolicyScreen - Privacy policy
- [ ] Reference: `SET-211`, `LEGAL-201`, `LEGAL-202`

---

## PHASE 12: Polish & Edge Cases (Priority: Ongoing)
*Goal: Handle all edge cases gracefully*

### 12.1 Error & Empty States
- [ ] EmptyCirclesState - No circles yet
- [ ] EmptyWalletState - No transactions
- [ ] EmptyGoalsState - No goals yet
- [ ] NetworkErrorScreen - Connection issues
- [ ] Reference: `EMPTY-201`, `EMPTY-202`, `ERROR-201`

### 12.2 Onboarding Improvements
- [ ] GoalSelectionScreen - What are you saving for?
- [ ] ProfileSetupScreen - Enhanced profile setup
- [ ] ReadyToExploreScreen - Onboarding complete
- [ ] Reference: `AUTH-205`, `AUTH-206`, `AUTH-207`, `AUTH-209`

### 12.3 Re-engagement
- [ ] WelcomeBackScreen - Returning users
- [ ] WhatsNewScreen - Feature updates
- [ ] SessionExpiredScreen - Re-authentication
- [ ] Reference: `RETURN-201`, `RETURN-203`, `RETURN-205`

---

## Backend/API Development (Parallel Track)

### Database Schema (Supabase)
- [ ] Users table (extends auth.users)
- [ ] Circles table
- [ ] Circle_members junction table
- [ ] Transactions table
- [ ] Contributions table
- [ ] Payouts table
- [ ] Goals table
- [ ] Recipients table (for remittance)
- [ ] Endorsements table
- [ ] Notifications table

### API Endpoints (Supabase Functions or Edge)
- [ ] Circle management APIs
- [ ] Payment processing integration
- [ ] KYC verification integration
- [ ] Push notification service
- [ ] Exchange rate API integration
- [ ] Remittance provider integration

### Third-Party Integrations
- [ ] Plaid (bank linking)
- [ ] Stripe (card processing)
- [ ] Twilio (SMS/OTP)
- [ ] SendGrid (email)
- [ ] Push notification service
- [ ] FX rate provider
- [ ] Remittance rails (Wise, Remitly API, etc.)

---

## Recommended Build Order Summary

| Phase | Priority | Est. Screens | Dependencies |
|-------|----------|--------------|--------------|
| 1. Core Circle | Critical | 7 | None |
| 2. Wallet | High | 12 | Phase 1 |
| 3. Payment/KYC | High | 9 | Phase 2 |
| 4. XnScore | Medium-High | 7 | Phase 1 |
| 5. Cross-Border | Medium-High | 11 | Phase 2, 3 |
| 6. Advance | Medium | 9 | Phase 1, 2, 3 |
| 7. Goals | Medium | 11 | Phase 2 |
| 8. Community | Medium | 8 | Phase 1 |
| 9. Settings | Medium | 11 | None |
| 10. Elder | Lower | 8 | Phase 4, 8 |
| 11. Help | Lower | 5 | None |
| 12. Polish | Ongoing | 7 | All |

**Total: ~105 screens to build**

---

## Quick Wins (Can Build Anytime)
1. Settings screens (standalone)
2. Help Center (standalone)
3. XnScore dashboard (uses existing data)
4. Notification settings
5. Empty states (improve UX immediately)

---

## Notes

- Each phase builds on previous phases
- Backend work can run in parallel with frontend
- V0 reference files provide detailed UI specs
- Focus on Phase 1-3 for a functional MVP
- Phases 5-6 (Cross-border, Advance) are key differentiators
- Phase 10 (Elder) is unique to TandaXn's trust model
