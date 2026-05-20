# Five Critical Flows — End-to-End Trace

For each flow: services that handle it, screens that surface it, tables it depends on, and a verdict.

Verdict definitions:
- **WORKING**: All required tables exist and screens/services present.
- **PARTIALLY WORKING**: Some tables/code exist but at least one critical piece is missing.
- **NOT WORKING**: A required table or service is missing.
- **needs runtime test**: Code and tables exist but I can't verify behaviour from static analysis alone.

## Flow A: Create savings goal → deposit → withdraw

**Verdict:** WORKING

**Services found (27):** `AffordabilityService`, `AmlMonitoringEngine`, `CircleMatchingService`, `CommunityFeaturesEngine`, `ContributionProcessingService`, `ContributionSchedulingService`, `CreditworthinessEngine`, `CronJobHandler`, `DefaultCascadeHandler`, `DissolutionEngine` +17 more

**Screens found (26):** `app/(app)/circles/CIRC-406 Emergency Withdrawal.tsx`, `app/(app)/goals/030-GOAL-001-GoalsDashboard.tsx`, `app/(app)/goals/031-GOAL-002-GoalDetail.tsx`, `app/(app)/goals/032-GOAL-003-AddNewGoal.tsx`, `app/(app)/goals/033-GOAL-004-EditGoal.tsx`, `app/(app)/goals/034-GOAL-005-GoalProgress.tsx` +20 more

**Tables required (status from probe):**

| Item | Status |
|------|--------|
| savings_goal_types | EXISTS |
| user_savings_goals | EXISTS |
| savings_transactions | EXISTS |
| Migration 031 (savings_context_support) | NOT APPLIED — savings goal RLS policies + emoji + early-withdrawal-penalty settings missing |

## Flow B: Join circle via invite → contribute → payout schedule

**Verdict:** PARTIALLY WORKING — needs runtime test

**Services found (52):** `AffordabilityService`, `AIRecommendationFeedbackEngine`, `AmlMonitoringEngine`, `AutoRetryService`, `CircleDemocracyEngine`, `CircleMatchHistoryEngine`, `CircleMatchingService`, `CircleResolutionService`, `CommunityFeaturesEngine`, `CommunityHealthService` +42 more

**Screens found (27):** `app/(app)/circles/CIRC-204 Create Circle Invite.tsx`, `app/(app)/circles/CIRC-304 Invite to Circle.tsx`, `app/(app)/circles/CIRC-401 Contributions History.tsx`, `app/(app)/circles/CIRC-402 Make Contribution.tsx`, `app/(app)/circles/CIRC-403 Contribution Success.tsx`, `app/(app)/circles/CIRC-404 Payout Schedule.tsx` +21 more

**Tables required (status from probe):**

| Item | Status |
|------|--------|
| circles | EXISTS |
| circle_members | EXISTS |
| circle_contributions | EXISTS |
| circle_invitations | UNKNOWN |

## Flow C: Trigger XnScore calculation → view on profile

**Verdict:** needs runtime test

**Services found (53):** `AffordabilityService`, `AIRecommendationFeedbackEngine`, `AmlMonitoringEngine`, `CircleDemocracyEngine`, `CircleMatchHistoryEngine`, `CircleMatchingService`, `CommunityHealthService`, `ConflictPredictionEngine`, `ContributionAffordabilityService`, `ContributionMoodDetectionEngine` +43 more

**Screens found (6):** `app/(app)/elder/ELDER-003-HonorScoreOverview.tsx`, `app/(app)/elder/ELDER-004-HonorScoreBreakdown.tsx`, `app/(app)/score/050-SCORE-001-XnScoreDashboard.tsx`, `app/(app)/score/051-SCORE-002-XnScoreHistory.tsx`, `app/(app)/score/052-SCORE-003-HowXnScoreWorks.tsx`, `app/(app)/score/053-SCORE-004-ImproveScoreTips.tsx`

**Tables required (status from probe):**

| Item | Status |
|------|--------|
| xn_scores | EXISTS |
| Migration 019 (initial_xnscore) | APPLIED |
| Migration 020 (decay/growth) | APPLIED |

## Flow D: Open dispute → elder reviews → resolution recorded

**Verdict:** NOT WORKING

**Services found (37):** `AIRecommendationFeedbackEngine`, `AmlMonitoringEngine`, `AutoRetryService`, `CircleDemocracyEngine`, `CircleMatchHistoryEngine`, `CircleResolutionService`, `CommunityFeaturesEngine`, `CommunityHealthService`, `ConflictPredictionEngine`, `CreditworthinessEngine` +27 more

**Screens found (19):** `app/(app)/elder/ELDER-001-BecomeElder.tsx`, `app/(app)/elder/ELDER-002-ApplicationReview.tsx`, `app/(app)/elder/ELDER-003-HonorScoreOverview.tsx`, `app/(app)/elder/ELDER-004-HonorScoreBreakdown.tsx`, `app/(app)/elder/ELDER-005-CommunityStanding.tsx`, `app/(app)/elder/ELDER-006-VoucherSystem.tsx` +13 more

**Tables required (status from probe):**

| Item | Status |
|------|--------|
| disputes | EXISTS |
| elders | MISSING |
| Migration 032 (elder_system) | APPLIED |
| Doc claim of 'Dispute Resolution' | Doc says NOT IMPLEMENTED — consistent |

⚠️ Tables referenced by code but MISSING in production: `elders`

## Flow E: Request loan → underwriting check → approval/denial

**Verdict:** needs runtime test

**Services found (16):** `ContributionSchedulingService`, `CreditworthinessEngine`, `DynamicPayoutOrderingEngine`, `EventService`, `GraduatedEntryEngine`, `index`, `InterestCalculationEngine`, `MemberProfileService`, `MockToRealMigrationEngine`, `MonthlyPaymentEngine` +6 more

**Screens found (2):** `app/(auth)/kyc/KYC-101-UnlockInterestPrompt.tsx`, `app/(auth)/kyc/KYC-108_InterestUnlockedSuccess.tsx`

**Tables required (status from probe):**

| Item | Status |
|------|--------|
| loans | EXISTS |
| loan_applications | EXISTS |
| credit_assessments | UNKNOWN |
| Migration 022 (creditworthiness) | APPLIED |
| Migration 023 (interest) | APPLIED |
| Migration 024 (monthly payment) | APPLIED |
