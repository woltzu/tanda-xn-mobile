import "react-native-gesture-handler";
// i18n must be imported before any consumer of useTranslation so the
// resources + sync default ('en') are registered with i18next by the
// time the first <I18nextProvider>-implicit render walks the tree.
import "./i18n";
import { useTranslation } from "react-i18next";
import React, { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import {
  NavigationContainer,
  CommonActions,
  useNavigation,
} from "@react-navigation/native";
import { navigationRef } from "./lib/navigation";
import * as Linking from "expo-linking";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableWithoutFeedback, AppState, Modal } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ScrollDiagnosticProvider } from "./utils/scrollDiagnostics";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { eventService } from "./services/EventService";
import { PreferencesProvider } from "./context/PreferencesContext";
import { useInactivityLock } from "./hooks/useInactivityLock";
import LockScreen from "./screens/LockScreen";
import { CirclesProvider } from "./context/CirclesContext";
import { WalletProvider } from "./context/WalletContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import SplashScreen from "./screens/SplashScreen";
import PayoutReceivedScreen from "./screens/PayoutReceivedScreen";
// Verified Provider Network (Phase 1A / 1B / 1C)
import ProviderListScreen from "./screens/ProviderListScreen";
import ProviderDetailScreen from "./screens/ProviderDetailScreen";
import ProviderApplicationScreen from "./screens/ProviderApplicationScreen";
import GoalProviderPaymentScreen from "./screens/GoalProviderPaymentScreen";
import ProviderDashboardScreen from "./screens/ProviderDashboardScreen";
import ProviderNetworkVerificationScreen from "./screens/ProviderNetworkVerificationScreen";
// Phase 2A — staged disbursement (Dream Escrow). NOT to be confused with
// the existing GoalMilestonesScreen (percentage-based celebration timeline).
import GoalDisbursementMilestonesScreen from "./screens/GoalDisbursementMilestonesScreen";
// Phase 2B — creation wizard + elder/admin verification screen.
import CreateDisbursementMilestonesScreen from "./screens/CreateDisbursementMilestonesScreen";
import MilestoneVerificationScreen from "./screens/MilestoneVerificationScreen";
// Phase 2C — admin verification queue.
import AdminVerificationQueueScreen from "./screens/AdminVerificationQueueScreen";
// Phase 2D — verification history map (project pin + photo location).
import VerificationMapScreen from "./screens/VerificationMapScreen";
// Phase 4 — diaspora-dream goal templates.
import GoalTemplateBrowserScreen from "./screens/GoalTemplateBrowserScreen";
// Phase 5 (templates 2A) — community submissions + admin queue.
import SubmitTemplateScreen from "./screens/SubmitTemplateScreen";
import AdminTemplateQueueScreen from "./screens/AdminTemplateQueueScreen";
import PayoutHistoryScreen from "./screens/PayoutHistoryScreen";
import PayoutListener from "./components/PayoutListener";
import BugReportButton from "./components/BugReportButton";
import LogoHomeButton from "./components/LogoHomeButton";
import { BugReportProvider, useBugReportScreen } from "./context/BugReportContext";
import WelcomeScreen from "./screens/WelcomeScreen";
import LoginScreen from "./screens/LoginScreen";
import MfaChallengeScreen from "./screens/MfaChallengeScreen";
import SignupScreen from "./screens/SignupScreen";
import SignupWelcomeScreen from "./screens/SignupWelcomeScreen";
import OTPScreen from "./screens/OTPScreen";
import EmailVerificationScreen from "./screens/EmailVerificationScreen";
import AuthCallbackScreen from "./screens/AuthCallbackScreen";
import DashboardScreen from "./screens/DashboardScreen";
import HomeScreen from "./screens/HomeScreen";
import WalletScreen from "./screens/WalletScreen";
import WithdrawToBankScreen from "./screens/WithdrawToBankScreen";
import CirclesScreen from "./screens/CirclesScreen";
import CirclesV2Screen from "./screens/CirclesV2Screen";
import ScoreHubScreen from "./screens/ScoreHubScreen";
import CircleHealthScreen from "./screens/CircleHealthScreen";
import AIInsightsScreen from "./screens/AIInsightsScreen";
import EventsScreen from "./screens/EventsScreen";
import CreateEventScreen from "./screens/CreateEventScreen";
import ProfileScreen from "./screens/ProfileScreen";
import PersonalInfoScreen from "./screens/PersonalInfoScreen";
import LanguageRegionScreen from "./screens/LanguageRegionScreen";
import CreateCircleStartScreen from "./screens/CreateCircleStartScreen";
import CreateCircleExpressScreen from "./screens/CreateCircleExpressScreen";
import QuickCircleScreen from "./screens/QuickCircleScreen";
import ReferralScreen from "./screens/ReferralScreen";
// Bucket B (Create-a-circle review): superseded by CreateCircleWizardForm.
// Imports stay commented (rather than deleted) so the screens are easy to
// re-enable if the merged form needs a rollback.
// import CreateCircleDetailsScreen from "./screens/CreateCircleDetailsScreen";
// import CreateCircleScheduleScreen from "./screens/CreateCircleScheduleScreen";
import CreateCircleWizardFormScreen from "./screens/CreateCircleWizardFormScreen";
import CreateCircleInviteScreen from "./screens/CreateCircleInviteScreen";
import CreateCircleSuccessScreen from "./screens/CreateCircleSuccessScreen";
import HowCirclesWorkScreen from "./screens/HowCirclesWorkScreen";
import CircleDetailScreen from "./screens/CircleDetailScreen";
import JoinCircleConfirmScreen from "./screens/JoinCircleConfirmScreen";
import JoinCircleSuccessScreen from "./screens/JoinCircleSuccessScreen";
import MakeContributionScreen from "./screens/MakeContributionScreen";
import ContributionSuccessScreen from "./screens/ContributionSuccessScreen";
import AddFundsScreen from "./screens/AddFundsScreen";
import WithdrawScreen from "./screens/WithdrawScreen";
import WalletTransactionSuccessScreen from "./screens/WalletTransactionSuccessScreen";
import XnScoreDashboardScreen from "./screens/XnScoreDashboardScreen";
import XnScoreHistoryScreen from "./screens/XnScoreHistoryScreen";
import VouchMemberScreen from "./screens/VouchMemberScreen";
// Phase 2 Bucket A — Member Access Tiers governance screens.
import ElderNominationsScreen from "./screens/ElderNominationsScreen";
import IssueExposureVouchScreen from "./screens/IssueExposureVouchScreen";
// Phase 2 (migration 259) — bounded-belonging member search +
// direct-invite surface backed by search_members + can_invite RPCs.
import MemberSearchScreen from "./screens/MemberSearchScreen";
// Phase 2 (migration 264 scaffold) — substitute availability toggle
// + read-only directory. Activation flow lands in a follow-up.
import SubstituteDashboardScreen from "./screens/SubstituteDashboardScreen";
// Phase 2 Bucket B — Resolution Center for critical-tier members.
import ResolutionCenterScreen from "./screens/ResolutionCenterScreen";
import DisputesListScreen from "./screens/DisputesListScreen";
import DisputeDetailScreen from "./screens/DisputeDetailScreen";
import CriticalBanner from "./components/CriticalBanner";
// Honor Bucket A — HonorSystemScreen deleted. Its content was a separate
// vouching-tier story (Newcomer/Guardian/Mentor/Elder/Sage based on vouches
// count) that contradicted the canonical Honor Score tier ladder. Vouching
// lives under the Character pillar on HonorScoreOverviewScreen now.
import AccessRestrictedScreen from "./screens/AccessRestrictedScreen";
import RemittanceScreen from "./screens/RemittanceScreen";
import DomesticSendMoneyScreen from "./screens/DomesticSendMoneyScreen";
import LoanMarketplaceScreen from "./screens/LoanMarketplaceScreen";
import LoanApplicationScreen from "./screens/LoanApplicationScreen";
import LoanDetailsScreen from "./screens/LoanDetailsScreen";
import LoanCalculatorScreen from "./screens/LoanCalculatorScreen";
// V1 goal stack (GoalsHubScreen, CreateGoalScreen, GoalDetailsScreen,
// DepositToGoalScreen, WithdrawFromGoalScreen, EditGoalScreen) was removed
// in the Goals P0 cut-over. V2 is the live path; entry is GoalsHubV2 +
// GoalCreateExpress.
import SavedRecipientsScreen from "./screens/SavedRecipientsScreen";
import AddRecipientScreen from "./screens/AddRecipientScreen";
import CommunityBrowserScreen from "./screens/CommunityBrowserScreen";
import CommunityHubScreen from "./screens/CommunityHubScreen";
import MyCommunitiesScreen from "./screens/MyCommunitiesScreen";
import CreateCommunityScreen from "./screens/CreateCommunityScreen";
// Conflict P1 (2026-06-12): BecomeElder + ElderTrainingHub merged into
// ElderOnboarding; MediationCase + MediationTools merged into ConflictCase.
// Legacy imports retained as commented references so the screens can be
// restored if onboarding telemetry comes back negative.
// import BecomeElderScreen from "./screens/BecomeElderScreen";
import HonorScoreOverviewScreen from "./screens/HonorScoreOverviewScreen";
import VouchSystemScreen from "./screens/VouchSystemScreen";
// import MediationCaseScreen from "./screens/MediationCaseScreen";
// import ElderTrainingHubScreen from "./screens/ElderTrainingHubScreen";
import ConflictCaseScreen from "./screens/ConflictCaseScreen";
import ElderOnboardingScreen from "./screens/ElderOnboardingScreen";
import ElderDashboardScreen from "./screens/ElderDashboardScreen";
import JoinCircleByCodeScreen from "./screens/JoinCircleByCodeScreen";
import QRScannerScreen from "./screens/QRScannerScreen";
import QRCodeDisplayScreen from "./screens/QRCodeDisplayScreen";
import SettingsMainScreen from "./screens/SettingsMainScreen";
import SecuritySettingsScreen from "./screens/SecuritySettingsScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import TwoFactorAuthScreen from "./screens/TwoFactorAuthScreen";
import NotificationPrefsScreen from "./screens/NotificationPrefsScreen";
import NotificationsInboxScreen from "./screens/NotificationsInboxScreen";
import PrivacySettingsScreen from "./screens/PrivacySettingsScreen";
import LinkedAccountsScreen from "./screens/LinkedAccountsScreen";
import ActiveSessionsScreen from "./screens/ActiveSessionsScreen";
import HelpCenterScreen from "./screens/HelpCenterScreen";
import FAQScreen from "./screens/FAQScreen";
import AboutAppScreen from "./screens/AboutAppScreen";
import ReportIssueScreen from "./screens/ReportIssueScreen";
import PaymentHistoryScreen from "./screens/PaymentHistoryScreen";
import LeaveCircleScreen from "./screens/LeaveCircleScreen";
import ManageMembersScreen from "./screens/ManageMembersScreen";
import PauseCircleScreen from "./screens/PauseCircleScreen";
import CloseCircleScreen from "./screens/CloseCircleScreen";
import ExportDataScreen from "./screens/ExportDataScreen";
import AdminSettingsScreen from "./screens/AdminSettingsScreen";
import OversightDashboardScreen from "./screens/OversightDashboardScreen";
// Conflict P1 (2026-06-12): MediationToolsScreen replaced by ConflictCaseScreen.
// import MediationToolsScreen from "./screens/MediationToolsScreen";
import AuditTrailScreen from "./screens/AuditTrailScreen";
import SelectCircleContributionScreen from "./screens/SelectCircleContributionScreen";
// Bucket D — XnScoreProvider retired. Real score reads through
// useXnScoreFromBundle (hooks/useXnScore.ts) backed by get_user_scores;
// no provider needed in the tree.
import { TrustProvider } from "./context/TrustContext";
import { AdvanceProvider } from "./context/AdvanceContext";
import { SavingsProvider } from "./context/SavingsContext";
import { WithdrawalWizardProvider } from "./context/WithdrawalWizardContext";
import { CommunityProvider } from "./context/CommunityContext";
import { ElderProvider } from "./context/ElderContext";
import { FeatureGateProvider } from "./context/FeatureGateContext";
import { FeedProvider } from "./context/FeedContext";
import { MemberProfileProvider } from "./context/MemberProfileContext";
import { NotificationProvider } from "./context/NotificationContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import CircleInviteScreen from "./screens/CircleInviteScreen";
import QuickJoinScreen from "./screens/QuickJoinScreen";
import QuickJoinPendingConfirmationScreen from "./screens/QuickJoinPendingConfirmationScreen";
import JoinConfirmScreen from "./screens/JoinConfirmScreen";
import QuickJoinPaymentSuccessScreen from "./screens/QuickJoinPaymentSuccessScreen";
import SetPasswordScreen from "./screens/SetPasswordScreen";
import GroupChatScreen from "./screens/GroupChatScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import { linkingConfig } from "./lib/deepLinking";
import { PaymentProvider } from './context/PaymentContext';
import { ToastType, registerToastHandler } from './components/Toast';
import OfflineBanner from './components/OfflineBanner';
// Marketplace Screens (Migration 057)
import MarketplaceScreen from "./screens/MarketplaceScreen";
import StoreDetailScreen from "./screens/StoreDetailScreen";
import StoreApplicationScreen from "./screens/StoreApplicationScreen";
import BulkInvitesScreen from "./screens/BulkInvitesScreen";
import BookServiceScreen from "./screens/BookServiceScreen";
import OwnerDashboardScreen from "./screens/OwnerDashboardScreen";
import MarketInsightScreen from "./screens/MarketInsightScreen";
// Feature Screens (AI Engines + Circle Management)
import StressScoreDashboardScreen from "./screens/StressScoreDashboardScreen";
import MoodInsightsScreen from "./screens/MoodInsightsScreen";
import ConflictAlertScreen from "./screens/ConflictAlertScreen";
import DiscoverCirclesScreen from "./screens/DiscoverCirclesScreen";
import InsurancePoolScreen from "./screens/InsurancePoolScreen";
import SubstitutePoolScreen from "./screens/SubstitutePoolScreen";
import CreditReportScreen from "./screens/CreditReportScreen";
import DecisionHistoryScreen from "./screens/DecisionHistoryScreen";
import AIJobsHealthScreen from "./screens/AIJobsHealthScreen";
import PartialContributionScreen from "./screens/PartialContributionScreen";
import PositionSwapScreen from "./screens/PositionSwapScreen";
import CycleTimelineScreen from "./screens/CycleTimelineScreen";
import CycleDetailScreen from "./screens/CycleDetailScreen";
import CreditProfileScreen from "./screens/CreditProfileScreen";
import DefaultRecoveryScreen from "./screens/DefaultRecoveryScreen";
import DefaultDetailScreen from "./screens/DefaultDetailScreen";
import LateContributionDetailScreen from "./screens/LateContributionDetailScreen";
import CircleVotingScreen from "./screens/CircleVotingScreen";
import ProposalDetailScreen from "./screens/ProposalDetailScreen";
import GraduatedEntryScreen from "./screens/GraduatedEntryScreen";
import KYCVerificationScreen from "./screens/KYCVerificationScreen";
import EarlyInterventionScreen from "./screens/EarlyInterventionScreen";
import CrossCircleLendingScreen from "./screens/CrossCircleLendingScreen";
import DynamicPayoutScreen from "./screens/DynamicPayoutScreen";
import LegalDocumentsScreen from "./screens/LegalDocumentsScreen";
import LegalDocumentReaderScreen from "./screens/LegalDocumentReaderScreen";
import CircleVisualizerScreen from "./screens/CircleVisualizerScreen";
// Dream Feed Screens
import DreamFeedScreen from "./screens/DreamFeedScreen";
import CreateDreamPostScreen from "./screens/CreateDreamPostScreen";
import PostDetailScreen from "./screens/PostDetailScreen";
// VDF B.7 (2026-06-21) — DreamPostCommentsScreen deleted; the comment
// icon now routes to PostDetail with focusComment='1' (single comment
// surface, sticky comment input there is the only path).
import UserDreamProfileScreen from "./screens/UserDreamProfileScreen";
import FeedSettingsScreen from "./screens/FeedSettingsScreen";
import SupportDreamScreen from "./screens/SupportDreamScreen";
// Community Sub-screens
import NearYouScreen from "./screens/NearYouScreen";
import NewArrivalsScreen from "./screens/NewArrivalsScreen";
import GatheringsScreen from "./screens/GatheringsScreen";
import CreateGatheringScreen from "./screens/CreateGatheringScreen";
import CommunityMemoryScreen from "./screens/CommunityMemoryScreen";
import CommunityFeedScreen from "./screens/CommunityFeedScreen";
import PostToCommunityScreen from "./screens/PostToCommunityScreen";
// New Tab Screens (Navigation Restructure)
import ActionScreen from "./screens/ActionScreen";
import SyncLobbyScreen from "./screens/SyncLobbyScreen";
import SyncRoomScreen from "./screens/SyncRoomScreen";
import DonationPreferencesScreen from "./screens/DonationPreferencesScreen";
import HostDashboardScreen from "./screens/HostDashboardScreen";
import CommunityTabScreen from "./screens/CommunityTabScreen";
// Trip Circle Screens (8 screens across 3 flows)
import ProviderDiscoveryScreen from "./screens/ProviderDiscoveryScreen";
import ProviderProfileSetupScreen from "./screens/ProviderProfileSetupScreen";
import ProviderVerificationScreen from "./screens/ProviderVerificationScreen";
import CreateTripListingScreen from "./screens/CreateTripListingScreen";
import ProviderTripDashboardScreen from "./screens/ProviderTripDashboardScreen";
// Member-trip-status Bucket A.9 — TripDetailScreen + MemberTripDashboardScreen
// were V0-port scaffolding with mock data, imported but never registered or
// navigated to. Files deleted alongside this import cleanup.
// Trip Organizer Screens (9 screens: organizer + participant)
import OrganizerTripListScreen from "./screens/OrganizerTripListScreen";
import TripUpdatesScreen from "./screens/TripUpdatesScreen";
import CreateTripWizardScreen from "./screens/CreateTripWizardScreen";
import OrganizerTripDashboardScreen from "./screens/OrganizerTripDashboardScreen";
import ItineraryBuilderScreen from "./screens/ItineraryBuilderScreen";
import ParticipantManagerScreen from "./screens/ParticipantManagerScreen";
import ParticipantDetailScreen from "./screens/ParticipantDetailScreen";
import TripPublicPageScreen from "./screens/TripPublicPageScreen";
import MyTripStatusScreen from "./screens/MyTripStatusScreen";
import MyTripsScreen from "./screens/MyTripsScreen";
import LeaveReviewScreen from "./screens/LeaveReviewScreen";
import TripReviewsScreen from "./screens/TripReviewsScreen";
import DocumentSubmissionScreen from "./screens/DocumentSubmissionScreen";
import TripPaymentScreen from "./screens/TripPaymentScreen";
import TripPaymentSuccessScreen from "./screens/TripPaymentSuccessScreen";
import TripPaymentFailedScreen from "./screens/TripPaymentFailedScreen";
import TripPublishSuccessScreen from "./screens/TripPublishSuccessScreen";
import ActivityEditorScreen from "./screens/ActivityEditorScreen";
import ActivityHistoryScreen from "./screens/ActivityHistoryScreen";
import StripeRedirectScreen from "./screens/StripeRedirectScreen";
import PayoutPreferencesScreen from "./screens/PayoutPreferencesScreen";
import WebViewScreen from "./screens/WebViewScreen";
import RequestProviderScreen from "./screens/RequestProviderScreen";
import EditStoreScreen from "./screens/EditStoreScreen";
import ManageServicesScreen from "./screens/ManageServicesScreen";
import ServiceFormScreen from "./screens/ServiceFormScreen";
import StoreBookingsScreen from "./screens/StoreBookingsScreen";
import type { StoreService } from "./services/MarketplaceEngine";
// KYC native flow (Phase KYC-1) — 13 screens that replace the legacy
// WebView-based KYC. Registered under the nested `KycStack`
// navigator below, reachable via navigate('KycStack', { screen: ... }).
import OnboardingWelcomeScreen from "./screens/OnboardingWelcomeScreen";
import VerificationOptionsScreen from "./screens/VerificationOptionsScreen";
import ITINEducationScreen from "./screens/ITINEducationScreen";
import ITINApplicationHelpScreen from "./screens/ITINApplicationHelpScreen";
import InternationalVerificationScreen from "./screens/InternationalVerificationScreen";
import TaxIDEntryScreen from "./screens/TaxIDEntryScreen";
// KYC P1: the legacy "Universe A" screens below are imported only so the
// commented-out registrations below them still parse — the unified
// KYCHubScreen + KYCDocumentScreen replace them as the canonical surfaces.
// Files are intentionally kept for reference until P2 deletes them.
import AccountTiersExplainedScreen from "./screens/AccountTiersExplainedScreen";
import IDVerificationStartScreen from "./screens/IDVerificationStartScreen";
import DocumentUploadScreen from "./screens/DocumentUploadScreen";
import Tier2SuccessScreen from "./screens/Tier2SuccessScreen";
import VerificationHubScreen from "./screens/VerificationHubScreen";
import LimitedModeScreen from "./screens/LimitedModeScreen";
import ITINPendingScreen from "./screens/ITINPendingScreen";
// KYC P1 (2026-06-12): unified hub + single document screen.
import KYCHubScreen from "./screens/KYCHubScreen";
import KYCDocumentScreen from "./screens/KYCDocumentScreen";
// Interest-First KYC entry/success screens (Phase KYC-2). Reached
// from the Dashboard interest card, not from signup.
import UnlockInterestPromptScreen from "./screens/UnlockInterestPromptScreen";
import InterestUnlockedSuccessScreen from "./screens/InterestUnlockedSuccessScreen";
// Advance Payout V2 flow (Stage 8) — 20 screens translated from web
// JSX. The 3 *V2 names are redesigns that coexist with the existing
// AdvanceHub/AdvanceExplanation/AdvanceDetails screens pending a
// future reconciliation; the rest are net-new. Reachable for testing
// via the __DEV__ "Advance V2" button on the Dashboard.
import AdvanceHubV2Screen from "./screens/AdvanceHubV2Screen";
import SmartCalculatorScreen from "./screens/SmartCalculatorScreen";
import AdvanceDetailsV2Screen from "./screens/AdvanceDetailsV2Screen";
import EarlyRepaymentScreen from "./screens/EarlyRepaymentScreen";
import RepaymentConfirmScreen from "./screens/RepaymentConfirmScreen";
import PaymentFailedScreen from "./screens/PaymentFailedScreen";
import PaymentReminderScreen from "./screens/PaymentReminderScreen";
import HardshipRequestScreen from "./screens/HardshipRequestScreen";
import AutopaySetupScreen from "./screens/AutopaySetupScreen";
import CircleAutopaySetupScreen from "./screens/CircleAutopaySetupScreen";
import CircleAutopayManagementScreen from "./screens/CircleAutopayManagementScreen";
import CommunityPreferencesScreen from "./screens/CommunityPreferencesScreen";
import RateBreakdownScreen from "./screens/RateBreakdownScreen";
import AdvanceSettingsScreen from "./screens/AdvanceSettingsScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
import AdminHubScreen from "./screens/AdminHubScreen";
import AdminOverviewScreen from "./screens/AdminOverviewScreen";
import AdminUsersScreen from "./screens/AdminUsersScreen";
import AdminBugReportsScreen from "./screens/AdminBugReportsScreen";
import AdminBugReportDetailScreen from "./screens/AdminBugReportDetailScreen";
import AdminLiquidityAdvancesScreen from "./screens/AdminLiquidityAdvancesScreen";
import AdminUserDetailScreen from "./screens/AdminUserDetailScreen";
import AdminCirclesScreen from "./screens/AdminCirclesScreen";
import AdminCircleDetailScreen from "./screens/AdminCircleDetailScreen";
import AdminTripsScreen from "./screens/AdminTripsScreen";
import AdminTripDetailScreen from "./screens/AdminTripDetailScreen";
import AdminPlatformSettingsScreen from "./screens/AdminPlatformSettingsScreen";
import StripeConnectScreen from "./screens/StripeConnectScreen";
import OrganizerPayoutHistoryScreen from "./screens/OrganizerPayoutHistoryScreen";
import AdminModerationScreen from "./screens/AdminModerationScreen";
import PlatformAuditTrailScreen from "./screens/PlatformAuditTrailScreen";
// Goals flow (GOALS-001..015) — 13 screens translated from web JSX.
// GoalDetailV2 / GoalsHubV2 are redesigns that coexist with the existing
// GoalDetails / GoalsHub production screens (registered above); the rest are
// net-new. Reachable for testing via the __DEV__ "Goals V2" button on the
// Dashboard. Forward navigation between them is still TODO(goals-wiring).
import GoalsHubV2Screen from "./screens/GoalsHubV2Screen";
// V2 dead screens removed in the P1 cut-over: GoalCategorySelect (vanity
// metadata — folded into express form), GoalTypeSelect (now an inline
// expand inside express), GoalCreate (replaced by GoalCreateExpress),
// GoalSetupSuccess (replaced by an inline celebration on GoalDetailV2).
import GoalCreateExpressScreen from "./screens/GoalCreateExpressScreen";
import GoalDetailV2Screen from "./screens/GoalDetailV2Screen";
import GoalLinkCircleScreen from "./screens/GoalLinkCircleScreen";
import GoalMilestonesScreen from "./screens/GoalMilestonesScreen";
import GoalAchievedScreen from "./screens/GoalAchievedScreen";
import GoalBItemsScreen from "./screens/GoalBItemsScreen";
import GoalStoriesScreen from "./screens/GoalStoriesScreen";
import GoalActivityScreen from "./screens/GoalActivityScreen";
import GoalEditScreen from "./screens/GoalEditScreen";

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  MfaChallenge: undefined;
  Signup: { email?: string } | undefined;
  SignupWelcome: undefined;
  ForgotPassword: { email?: string } | undefined;
  ResetPassword: undefined;
  OTP: { phone: string; from?: "login" | "signup" | "profile_edit" };
  // Circle Contribution Autopay — Phase 0.
  // Setup screen can be reached either from CircleDetail (with the
  // circle pre-selected) or from the management screen (where the
  // user picks a circle inside the setup flow).
  CircleAutopaySetup: { circleId?: string; configId?: string } | undefined;
  CircleAutopayManagement: undefined;
  // P2 (language-switcher review): origin/communities split out of
  // LanguageRegionScreen so each screen is single-purpose.
  CommunityPreferences: undefined;
  EmailVerification: { email: string; flow?: "signup" | "recovery" };
  AuthCallback: undefined;
  MainTabs: undefined;
  PersonalInfo: undefined;
  LanguageRegion: undefined;
  // Create Circle Flow
  CreateCircleStart: undefined;
  CreateCircleExpress: undefined;
  QuickCircle: undefined;
  Referral: undefined;
  SyncLobby: undefined;
  SyncRoom: { roomId: string; inviteCode?: string };
  DonationPreferences: undefined;
  HostDashboard: { roomId: string };
  CreateCircleDetails: {
    circleType: string;
  };
  // Bucket B (Create-a-circle review): merged Details + Schedule.
  // `draft` carries the typed CircleDraft accumulated from the Start
  // step. Drops `as any` casts from the wizard's navigation chain.
  CreateCircleWizardForm: {
    draft: import("./lib/circleDraft").CircleDraft;
  };
  CreateCircleSchedule: {
    circleType: string;
    name: string;
    amount: number;
    frequency: string;
    memberCount: number;
    beneficiaryName?: string;
    beneficiaryReason?: string;
    // Beneficiary circle fields
    beneficiaryPhone?: string;
    beneficiaryCountry?: string;
    isRecurring?: boolean;
    totalCycles?: number;
  };
  CreateCircleInvite: {
    circleType: string;
    name: string;
    amount: number;
    frequency: string;
    memberCount: number;
    startDate: string;
    rotationMethod: string;
    gracePeriodDays: number;
    beneficiaryName?: string;
    beneficiaryReason?: string;
    // Beneficiary circle fields
    beneficiaryPhone?: string;
    beneficiaryCountry?: string;
    isRecurring?: boolean;
    totalCycles?: number;
  };
  CreateCircleSuccess: {
    circleType: string;
    name: string;
    amount: number;
    frequency: string;
    memberCount: number;
    startDate: string;
    rotationMethod: string;
    gracePeriodDays: number;
    invitedMembers: Array<{ id: number; name: string; phone: string }>;
    beneficiaryName?: string;
    beneficiaryReason?: string;
    // Beneficiary circle fields
    beneficiaryPhone?: string;
    beneficiaryCountry?: string;
    isRecurring?: boolean;
    totalCycles?: number;
  };
  HowCirclesWork: undefined;
  CircleDetail: { circleId: string };
  // Join Circle Flow. `source` is telemetry metadata identifying where
  // the user entered the flow from — populated by each navigate call
  // site (browse, code, recommended, feed, detail, community,
  // dashboard, deep_link). Treated as an opaque label by the screen.
  // `initialCircle` carries a Circle row resolved out-of-band (e.g. via the
  // invite-code SECURITY DEFINER RPC in migration 286). Needed because a
  // non-member arriving from JoinCircleByCode can't SELECT the circle via
  // client-side RLS — the confirm screen falls back to this payload when
  // the local myCircles/browseCircles/circles lists don't contain the id.
  // `inviteCode` is a plain-string fallback so the confirm screen can
  // re-resolve on the fly if `initialCircle` is dropped by the navigator
  // (e.g. web URL-linking round-trip strips complex nested params).
  // Typed as `any` here to avoid dragging the Circle model into App.tsx.
  JoinCircleConfirm: { circleId: string; source?: string; initialCircle?: any; inviteCode?: string };
  JoinCircleSuccess: { circleId: string; source?: string };
  // Surfaced by the realtime channel in PayoutListener when a
  // circle_payouts INSERT lands for the current user (status = completed),
  // or by tapping a `payout_received` push notification.
  PayoutReceived: {
    payoutId: string;
    circleId: string;
    amount: number;
    currency?: string;
  };
  PayoutHistory: undefined;
  // Contribution Flow
  SelectCircleContribution: undefined;
  MakeContribution: {
    circleId: string;
    // Set by LinkedAccountsScreen when the user returns via the
    // select-a-card flow. Matched against paymentMethods on focus so
    // the just-picked card becomes the active selection.
    selectedPaymentMethodId?: string;
  };
  ContributionSuccess: { circleId: string; amount: number; transactionId?: string };
  // Wallet Flow
  AddFunds: undefined;
  // P0 (kyc-trigger review): optional resume snapshot used by the
  // KYCHub resume effect to land the user back on the Withdraw screen
  // with their previously typed amount + selected payout method.
  Withdraw: {
    resume?: {
      amount?: string;
      selectedMethod?: string | null;
    };
  } | undefined;
  // P0 (kyc-trigger review): optional `resume` snapshot lets the
  // KYCHub resume effect navigate the user back here with their last
  // form state. Schema mirrors useState calls in the screen; the
  // screen reads them in a mount effect and short-circuits when the
  // resume key is absent (the common case).
  DomesticSendMoney: {
    resume?: {
      amount?: string;
      recipientTab?: "new" | "recent";
      selectedMethod?: string;
      recipientName?: string;
      selectedBank?: string;
      accountNumber?: string;
      selectedNetwork?: string;
      phoneNumber?: string;
      selectedLocation?: string;
      fundingSource?: string;
    };
  } | undefined;
  Remittance: undefined;
  WithdrawToBank: undefined;
  WalletTransactionSuccess: {
    type: "add" | "withdraw" | "send";
    amount: number;
    method: string;
    recipientName?: string;
    transactionId: string;
    /** ISO 4217 currency code (e.g. "USD", "NGN"). Defaults to USD on the
     *  success screen for back-compat with older nav calls. */
    currency?: string;
    /** Cross-border display only — the converted amount in the recipient's
     *  currency, shown as a secondary line under the headline. The source
     *  `amount` / `currency` above remain the canonical (debit) values. */
    convertedAmount?: number;
    convertedCurrency?: string;
    /** Send fee in the source currency. When > 0 the success screen
     *  renders a "Fee" row + a "Total debited" row showing amount + fee
     *  — so the user can reconcile the on-screen "$1 sent" with the
     *  larger wallet debit ($1 + $7.99 = $8.99). */
    feeAmount?: number;
    feeCurrency?: string;
  };
  // XnScore Flow
  XnScoreDashboard: undefined;
  XnScoreHistory: undefined;
  // Trust & Honor System — Honor Bucket A retired the HonorSystem route.
  VouchMember: undefined;
  // Phase 2 Bucket A — Member Access Tiers & Vouch governance.
  // ElderNominations: review queue for pending elder_nominations.
  // IssueExposureVouch: form that calls vouch_member RPC; optional
  // memberId prefill when navigated from a member surface.
  ElderNominations: undefined;
  IssueExposureVouch: { memberId?: string } | undefined;
  // Phase 2 (migration 259) — bounded member search. circleId in invite
  // mode; communityId scopes the search; both optional (omit for browse).
  MemberSearch:
    | { circleId?: string; communityId?: string }
    | undefined;
  // Phase 2 (migration 264) — substitute availability toggle + dashboard.
  SubstituteDashboard: undefined;
  // Phase 2 Bucket B — Resolution Center for critical-tier members.
  ResolutionCenter: undefined;
  // Phase 2 — Dispute mediation (migration 261).
  // DisputesList: scoped to circle when circleId supplied, else all
  // disputes the user can see (RLS handles).
  // DisputeDetail: single dispute view with messages + mediator actions.
  DisputesList: { circleId?: string } | undefined;
  DisputeDetail: { disputeId: string };
  AccessRestricted: {
    type: string;
    requiredScore?: number;
    circleId?: string;
  };
  // Loan Marketplace Flow
  LoanMarketplace: undefined;
  LoanApplication: { productId: string };
  LoanDetails: { loanId: string };
  LoanCalculator: undefined;
  // Savings Goals Flow
  // V1 goal route types removed in the P0 cut-over. The live entries are
  // GoalsHubV2, GoalCreateExpress, GoalDetailV2 below.
  EditStore: { storeId: string };
  // Remittance Recipients Flow
  SavedRecipients: undefined;
  AddRecipient: { returnTo?: string };
  // Community Flow
  CommunityBrowser: undefined;
  CommunityFeed: undefined;
  CommunityHub: { communityId: string };
  CreateCommunity: { parentId?: string } | undefined;
  // Phase 1a (migration 131): read-only directory of the user's memberships
  MyCommunities: undefined;
  // Elder Flow
  ElderDashboard: undefined;
  BecomeElder: undefined;
  HonorScoreOverview: undefined;
  VouchSystem: undefined;
  MediationCase: undefined;
  ElderTrainingHub: undefined;
  // Conflict P1 (2026-06-12): merged screens.
  ConflictCase:
    | { caseId?: string; circleId?: string; circleName?: string }
    | undefined;
  ElderOnboarding: undefined;
  // Join Circle by Code Flow. Optional `code` lets a dispatcher (e.g.
  // QuickJoinScreen for authed users) pre-fill the input.
  JoinCircleByCode: { code?: string } | undefined;
  QRScanner: undefined;
  QRCodeDisplay: { circleId: string };
  // Settings Flow
  Settings: undefined;
  SecuritySettings: undefined;
  ChangePassword: undefined;
  TwoFactorAuth: undefined;
  NotificationPrefs: undefined;
  NotificationsInbox: undefined;
  PrivacySettings: undefined;
  LinkedAccounts: {
    // Select-a-card mode: rows show a Select button in place of the
    // more-menu. On tap, we navigate back to `returnScreen` with
    // { ...returnParams, selectedPaymentMethodId }. Absent = normal
    // manage-methods mode.
    selectMode?: boolean;
    returnScreen?: keyof RootStackParamList;
    returnParams?: Record<string, any>;
  } | undefined;
  ActiveSessions: undefined;
  HelpCenter: undefined;
  FAQ: { category?: string; initialQuery?: string } | undefined;
  AboutApp: undefined;
  // Circle Actions Menu Screens
  ReportIssue: { circleName?: string; circleId?: string };
  PaymentHistory: { circleName?: string; circleId?: string };
  LeaveCircle: { circleName?: string; circleId?: string; memberPosition?: number; totalMembers?: number; currentCycle?: number; totalCycles?: number; hasReceivedPayout?: boolean };
  ManageMembers: { circleName?: string; circleId?: string };
  PauseCircle: { circleName?: string; circleId?: string; currentCycle?: number; totalCycles?: number; memberCount?: number };
  CloseCircle: { circleName?: string; circleId?: string; currentCycle?: number; totalCycles?: number; memberCount?: number; totalContributed?: number; outstandingPayouts?: number };
  ExportData: { circleName?: string; circleId?: string };
  AdminSettings: { circleName?: string; circleId?: string };
  OversightDashboard: { circleName?: string; circleId?: string };
  MediationTools: { circleName?: string; circleId?: string };
  AuditTrail: { circleName?: string; circleId?: string };
  // Invite Screens (Deep Linking)
  CircleInvite: { circleId: string; name?: string; emoji?: string; inviter?: string; inviterName?: string; contribution?: number; frequency?: string; members?: number };
  CommunityInvite: { communityId: string; name?: string; icon?: string; inviter?: string; inviterName?: string; members?: number };
  QuickJoin: { inviteCode: string };
  QuickJoinPendingConfirmation: { email: string; circleName: string; amount?: number; inviteCode: string };
  JoinConfirm: undefined;
  QuickJoinPaymentSuccess: { circleName: string; amount?: number; memberCount?: number };
  SetPassword: undefined;
  GroupChat: { circleId: string; circleName: string };
  // Marketplace Flow (Migration 057)
  Marketplace: undefined;
  StoreDetail: { storeId: string; nextPayoutDate?: string; payoutAmount?: number; circleId?: string; circleName?: string };
  StoreApplication: undefined;
  BulkInvites: { storeId: string; storeName?: string; ownerName?: string };
  BookService: {
    storeId: string; storeName: string; storeEmoji: string;
    serviceId?: string; serviceName: string;
    originalAmountCents: number; discountAmountCents: number; finalAmountCents: number;
    memberDiscountPct: number; nextPayoutDate?: string; payoutAmount?: number;
    circleId?: string; circleName?: string; canPayOnPayoutDay?: boolean;
  };
  OwnerDashboard: { storeId: string };
  ManageServices: { storeId: string };
  ServiceForm: { storeId: string; service?: StoreService };
  StoreBookings: { storeId: string };
  MarketInsight: { city?: string; category?: string };
  RequestProvider: undefined;
  WebView: { url: string; title?: string; onComplete?: () => void };
  // Verified Provider Network (Phase 1A / 1B / 1C). initialCategory +
  // initialCountry added in Phase 2B (templates) so the goal-template
  // post-create banner can deep-link with the chip strip pre-filtered.
  ProviderList: { goalId?: string; initialCategory?: string; initialCountry?: string } | undefined;
  ProviderDetail: { providerId: string };
  ProviderApplication: undefined;
  GoalProviderPayment: { goalId: string; providerId: string };
  ProviderDashboard: undefined;
  // ProviderNetworkVerification is the Verified-Provider-Network screen.
  // (`ProviderVerification` already exists for the trip-circle KYC flow.)
  ProviderNetworkVerification: undefined;
  // Phase 2A — staged-disbursement timeline. Distinct from GoalMilestones
  // (celebration). Owner / provider / elder all share this screen with
  // role-aware actions.
  GoalDisbursementMilestones: { goalId: string };
  // Phase 2B — owner creates milestones (sum must match goal target),
  // elder/admin signs off on a milestone with evidence.
  CreateDisbursementMilestones: { goalId: string; providerId: string };
  MilestoneVerification: { milestoneId: string; requestId: string };
  // Phase 2C — admin queue of pending verifications.
  AdminVerificationQueue: undefined;
  // Phase 2D — verification history map (released milestones).
  VerificationMap: { milestoneId: string };
  // Phase 4 — diaspora-dream goal template browser.
  GoalTemplateBrowser: undefined;
  // Phase 5 — community template submission + admin queue.
  SubmitTemplate: undefined;
  AdminTemplateQueue: undefined;
  // Trip Circle Flow
  ProviderDiscovery: undefined;
  ProviderProfileSetup: undefined;
  ProviderVerification: undefined;
  CreateTripListing: undefined;
  ProviderTripDashboard: undefined;
  // TripDetail + MemberTripDashboard removed in Member-trip-status A.9.
  // Trip Organizer Screens
  OrganizerTripList: undefined;
  CreateTripWizard: { tripId?: string; initialStep?: number };
  OrganizerTripDashboard: { tripId: string };
  ItineraryBuilder: { tripId: string };
  ParticipantManager: { tripId: string };
  ParticipantDetail: { tripId: string; participantId: string };
  TripPublicPage: { slug?: string; tripId?: string };
  // Publish-trip Bucket A.1 — alias route for the plural `trips/:slug`
  // URL form. Same component as TripPublicPage. Lets links generated
  // before the share-URL fix still resolve in-app.
  TripPublicPageAlt: { slug?: string; tripId?: string };
  // Publish-trip Bucket B.4 — trip-wide updates feed. Replaces the
  // previously-removed `TripMessages` route. Optional initialActivityId
  // + prefilledMessage land when entered via the "Post update" affordance
  // on ItineraryBuilder (Bucket B.5).
  TripUpdates: {
    tripId: string;
    initialActivityId?: string;
    prefilledMessage?: string;
  };
  MyTripStatus: { tripId: string };
  // Member-trip-status Bucket A.2 — participant trip list.
  MyTrips: undefined;
  // Leave-review Bucket A.7 — post-trip review screen.
  LeaveReview: { participantId: string; tripId: string };
  // Leave-review Bucket B.2 — public list of reviews for a trip.
  TripReviews: { tripId: string };
  DocumentSubmission: { tripId: string; participantId: string; fieldKey: string };
  // Join-trip Bucket A.4 — TripPayment now accepts an optional paymentType
  // so MyTripStatus can route directly into the deposit or full-payment
  // flow without re-prompting the user.
  TripPayment: { tripId: string; participantId: string; paymentType?: 'deposit' | 'full' | 'installment' };
  // Join-trip Bucket A.6 — new success/failed screens for the Stripe
  // PaymentSheet round-trip.
  TripPaymentSuccess: {
    tripId: string;
    participantId: string;
    amountDollars: number;
    paymentType: 'deposit' | 'full' | 'installment';
  };
  TripPaymentFailed: {
    tripId?: string;
    participantId?: string;
    errorMessage?: string;
  };
  TripPublishSuccess: { tripName?: string; destination?: string; startDate?: string; endDate?: string; tripId: string };
  ActivityEditor: { tripId: string; dayId?: string; activityId?: string; existingData?: any };
  ActivityHistory: undefined;
  StripeRedirect: undefined;
  PayoutPreferences: { circleId?: string } | undefined;
  // Feature Screens (AI Engines + Circle Management)
  StressScoreDashboard: undefined;
  MoodInsights: undefined;
  DiscoverCircles: undefined;
  // KYC P0 (2026-06-12): circleId is OPTIONAL — when omitted, the screen
  // renders a circle picker. The prior `string` signature was a lie that
  // CirclesV2Screen exercised at line 256 (no params passed).
  ConflictAlert: { circleId?: string } | undefined;
  InsurancePool: { circleId: string };
  SubstitutePool: undefined;
  CreditReport: undefined;
  DecisionHistory: undefined;
  AIJobsHealth: undefined;
  PartialContribution: { circleId: string; cycleId?: string };
  PositionSwap: { circleId: string };
  CycleTimeline: { circleId: string };
  CycleDetail: { circleId: string; cycleId: string };
  CreditProfile: undefined;
  DefaultRecovery: undefined;
  DefaultDetail: { defaultId: string };
  LateContributionDetail: { lateContributionId: string };
  CircleVoting: { circleId: string };
  ProposalDetail: { proposalId: string };
  GraduatedEntry: undefined;
  KYCVerification: undefined;
  // KYC P1: unified hub + single document screen. The legacy
  // KYCVerification + VerificationHub route names redirect to KYCHub
  // for backward compatibility with existing deep links.
  KYCHub: undefined;
  KYCDocument:
    | {
        idType?:
          | "passport"
          | "national_id"
          | "drivers_license"
          | "residence_permit";
        country?: string;
      }
    | undefined;
  EarlyIntervention: undefined;
  CrossCircleLending: undefined;
  DynamicPayout: { circleId: string };
  LegalDocuments: undefined;
  // P0 (legal-docs review): reader screen for a single active doc.
  // Takes the LegalDocumentType so the reader can refetch via
  // useLegalDocument — keeps the route deep-linkable.
  //
  // P1: optional documentId opens that specific historical version
  // (from the version-history modal); readOnly forces the Accept
  // button hidden regardless of acceptance state. The combination
  // covers "I want to read what I signed last year" without
  // accidentally re-accepting an archived doc.
  LegalDocumentReader: {
    documentType: string;
    documentId?: string;
    readOnly?: boolean;
  };
  CircleVisualizer: { circleId: string };
  // KYC native flow (Phase KYC-1). Routes live inside a nested
  // navigator registered as KycStack; they're listed here so
  // cross-stack typed navigation (navigate('OnboardingWelcome', ...))
  // resolves at compile time even though React Navigation does the
  // hierarchical lookup at runtime.
  KycStack: { screen?: string; params?: object } | undefined;
  OnboardingWelcome: undefined;
  VerificationOptions: { payout?: { amount: number; circleName: string } } | undefined;
  ITINEducation: undefined;
  ITINApplicationHelp: undefined;
  InternationalVerification: undefined;
  TaxIDEntry: undefined;
  AccountTiersExplained: { tier?: 1 | 2 | 3 } | undefined;
  IDVerificationStart: undefined;
  DocumentUpload: { idType: string; side: "front" | "back" };
  Tier2Success: undefined;
  VerificationHub:
    | {
        currentTier?: 1 | 2 | 3;
        verificationStatus?: {
          email?: "completed" | "pending" | "in_progress" | "not_started";
          phone?: "completed" | "pending" | "in_progress" | "not_started";
          identity?: "completed" | "pending" | "in_progress" | "not_started";
          taxId?: "completed" | "pending" | "in_progress" | "not_started";
        };
        itinStatus?: "pending" | "approved" | null;
        pendingPayout?: { amount: number; circleName: string };
      }
    | undefined;
  LimitedMode: { currentTier?: 1 | 2 | 3; reason?: "skipped" | "itin_pending" } | undefined;
  ITINPending:
    | {
        applicationDate?: string;
        estimatedCompletion?: string;
        applicationMethod?: "caa" | "mail";
      }
    | undefined;
  // Interest-First KYC entry/success screens (Phase KYC-2).
  UnlockInterestPrompt: {
    totalInterest: number;
    goalBreakdown?: Array<{ goalName: string; interest: number }>;
  };
  InterestUnlockedSuccess: {
    unlockedAmount: number;
    isFullAccess: boolean;
  };
  // Advance Payout V2 flow (Stage 8). Params are intentionally loose
  // (object/optional) — each screen reads a richer, locally-typed
  // RouteProp internally; these entries exist so navigate() call
  // sites and the navigator typing resolve. advanceId is the common
  // forward-key threaded through the flow.
  AdvanceHubV2: { user?: object } | undefined;
  SmartCalculator:
    | {
        advanceType?: "contribution" | "quick" | "flex" | "premium";
        product?: object;
        xnscore?: number;
      }
    | undefined;
  AdvanceDetailsV2: { advanceId?: string; justCreated?: boolean } | undefined;
  EarlyRepayment:
    | {
        advanceId?: string;
        advance?: object;
        walletBalance?: number;
        paymentMethods?: object[];
      }
    | undefined;
  RepaymentConfirm:
    | {
        repayment?: object;
        advanceId?: string;
        amountPaid?: number;
        feeSaved?: number;
        paidFrom?: string;
      }
    | undefined;
  PaymentFailed: { failureDetails?: object; gracePeriod?: object } | undefined;
  PaymentReminder: { reminder?: object; walletBalance?: number } | undefined;
  HardshipRequest: { advanceId?: string; advance?: object } | undefined;
  AutopaySetup:
    | { activeAdvance?: object; paymentMethods?: object[] }
    | undefined;
  RateBreakdown:
    | { user?: object; rateCalculation?: object; comparison?: object }
    | undefined;
  AdvanceSettings:
    | { user?: object; activeAdvance?: object | null; settings?: object }
    | undefined;
  AdminDashboard:
    | {
        portfolioHealth?: object;
        regionMetrics?: object[];
        calibrationLogs?: object[];
        profitability?: object;
        alerts?: object[];
      }
    | undefined;
  // Admin hub — 8-module landing screen (Bucket A). Lightweight grid
  // that aggregates Overview / KYC / Disputes / Elders + placeholder
  // tiles for Users / Circles / Trips / Settings.
  AdminHub: undefined;
  // Admin Bucket B — module screens (lists + detail views).
  AdminOverview: undefined;
  AdminUsers: undefined;
  AdminUserDetail: { userId: string };
  AdminCircles: undefined;
  AdminCircleDetail: { circleId: string };
  AdminTrips: undefined;
  AdminTripDetail: { tripId: string };
  // Bug Reports admin module (uses bug_reports table from migration 273).
  AdminBugReports: undefined;
  AdminBugReportDetail: { reportId: string };
  AdminLiquidityAdvances: undefined;
  // Admin Bucket C — platform-wide settings (feature flags, templates,
  // system config, admin user roster). Named AdminPlatformSettings to
  // coexist with the per-circle AdminSettings governance screen.
  AdminPlatformSettings: undefined;
  // Stripe Connect onboarding for trip organizers (Bucket A, migration 270).
  StripeConnect: undefined;
  // Stripe Connect payout history (Bucket D) — lists every Stripe Transfer
  // the organizer's trips have produced. Named OrganizerPayoutHistory to
  // coexist with the circle PayoutHistory screen shipped earlier.
  OrganizerPayoutHistory: undefined;
  // Moderation P0 (2026-06-13) — platform-wide content + user-report queue.
  AdminModeration: undefined;
  // Audit Trail P0 (2026-06-13) — immutable platform compliance log.
  PlatformAuditTrail: undefined;
  // Goals flow (GOALS-001..015). Params are intentionally loose — each
  // screen reads a richer locally-typed RouteProp internally with sensible
  // defaults, so these entries exist only so navigate() call sites and the
  // navigator typing resolve. goalId is the common forward-key for wiring.
  GoalsHubV2: undefined;
  GoalCreateExpress: undefined;
  // V2 dead route types removed (GoalCategorySelect, GoalTypeSelect,
  // GoalCreate, GoalSetupSuccess).
  GoalDetailV2: { goalId?: string; goal?: object; justCreated?: boolean } | undefined;
  GoalLinkCircle: { goalId?: string; goal?: object } | undefined;
  GoalMilestones: { goalId?: string; goal?: object } | undefined;
  GoalAchieved: { goalId?: string; goal?: object } | undefined;
  GoalBItems: { goalId?: string; goal?: object } | undefined;
  GoalStories: undefined;
  GoalActivity: { goal?: object; recentActivity?: object[] } | undefined;
  GoalEdit: { goalId?: string; goal?: object } | undefined;
};

export type TabParamList = {
  Home: undefined;
  Circles: undefined;
  Action: undefined;
  Market: undefined;
  Community: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createStackNavigator();
const CirclesStack = createStackNavigator();
const MarketStack = createStackNavigator();
const CommunityStack = createStackNavigator();
const KycStack = createStackNavigator();
const SyncStack = createStackNavigator();
const ScoreHubStack = createStackNavigator();

// Navigation ref so the SyncStream deep-link handler in App's effect
// can call .navigate() without needing the useNavigation hook (which
// is only available to children of NavigationContainer). The ref now
// lives in lib/navigation.ts so AuthContext can import it without a
// circular runtime dependency (only the RootStackParamList type cycles
// back, and that's erased at runtime via `import type`).

// Parse tandaxn://sync-room?id=...&invite=... links into route params.
// Returns null for anything we don't recognize -- the caller leaves
// the URL alone, letting other handlers (e.g. AuthCallback for
// auth/confirm links) take it. The path can carry only the id; the
// invite code is optional (public rooms don't need one).
function parseSyncRoomUrl(url: string | null | undefined): { roomId: string; inviteCode?: string } | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    if (parsed.hostname !== "sync-room" && parsed.path !== "sync-room") {
      return null;
    }
    const q = parsed.queryParams ?? {};
    const id = typeof q.id === "string" ? q.id : null;
    if (!id) return null;
    const invite = typeof q.invite === "string" ? q.invite : undefined;
    return { roomId: id, inviteCode: invite };
  } catch {
    return null;
  }
}

// Home Tab Stack - includes Dashboard and related screens
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={HomeScreen} />
      <HomeStack.Screen name="CircleDetail" component={CircleDetailScreen} />
      <HomeStack.Screen name="GroupChat" component={GroupChatScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="DomesticSendMoney" component={DomesticSendMoneyScreen} />
      <HomeStack.Screen name="Remittance" component={RemittanceScreen} />
      {/* V1 goal mounts removed — see notes in the import block above. */}
      <HomeStack.Screen name="LoanMarketplace" component={LoanMarketplaceScreen} />
      <HomeStack.Screen name="LoanApplication" component={LoanApplicationScreen} />
      <HomeStack.Screen name="LoanDetails" component={LoanDetailsScreen} />
      <HomeStack.Screen name="LoanCalculator" component={LoanCalculatorScreen} />
      <HomeStack.Screen name="XnScoreDashboard" component={XnScoreDashboardScreen} />
      <HomeStack.Screen name="XnScoreHistory" component={XnScoreHistoryScreen} />
      <HomeStack.Screen name="ActivityHistory" component={ActivityHistoryScreen} />
      <HomeStack.Screen name="MyTrips" component={MyTripsScreen} />
      <HomeStack.Screen name="StripeRedirect" component={StripeRedirectScreen} />
      <HomeStack.Screen name="PayoutPreferences" component={PayoutPreferencesScreen} />
      <HomeStack.Screen name="SelectCircleContribution" component={SelectCircleContributionScreen} />
      <HomeStack.Screen name="MakeContribution" component={MakeContributionScreen} />
      <HomeStack.Screen name="ContributionSuccess" component={ContributionSuccessScreen} />
      <HomeStack.Screen name="WalletTransactionSuccess" component={WalletTransactionSuccessScreen} />
      <HomeStack.Screen name="SavedRecipients" component={SavedRecipientsScreen} />
      <HomeStack.Screen name="AddRecipient" component={AddRecipientScreen} />
      <HomeStack.Screen name="NotificationsInbox" component={NotificationsInboxScreen} />
      <HomeStack.Screen name="Settings" component={SettingsMainScreen} />
      <HomeStack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <HomeStack.Screen name="FAQ" component={FAQScreen} />
      <HomeStack.Screen name="CommunityBrowser" component={CommunityBrowserScreen} />
      <HomeStack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <HomeStack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <HomeStack.Screen name="MyCommunities" component={MyCommunitiesScreen} />
      <HomeStack.Screen name="ElderDashboard" component={ElderDashboardScreen} />
      {/* Conflict P1 — legacy elder route names alias to ElderOnboarding /
          ConflictCase so any existing deep links keep landing somewhere
          sensible. The dedicated entries below are what new code uses. */}
      <HomeStack.Screen name="BecomeElder" component={ElderOnboardingScreen} />
      <HomeStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <HomeStack.Screen name="ScoreHub" component={ScoreHubScreen} />
      <HomeStack.Screen name="AIInsights" component={AIInsightsScreen} />
      <HomeStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <HomeStack.Screen name="MediationCase" component={ConflictCaseScreen} />
      <HomeStack.Screen name="ElderTrainingHub" component={ElderOnboardingScreen} />
      <HomeStack.Screen name="ConflictCase" component={ConflictCaseScreen} />
      <HomeStack.Screen name="ElderOnboarding" component={ElderOnboardingScreen} />
      <HomeStack.Screen name="AddFunds" component={AddFundsScreen} />
      <HomeStack.Screen name="WalletMain" component={WalletScreen} />
      <HomeStack.Screen name="WithdrawToBank" component={WithdrawToBankScreen} />
      <HomeStack.Screen name="Withdraw" component={WithdrawScreen} />
      <HomeStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
      <HomeStack.Screen name="CreateCircleExpress" component={CreateCircleExpressScreen} />
      <HomeStack.Screen name="QuickCircle" component={QuickCircleScreen} />
      <HomeStack.Screen name="Referral" component={ReferralScreen} />
      <HomeStack.Screen name="DonationPreferences" component={DonationPreferencesScreen} />
      {/* Bucket B (Create-a-circle review): CreateCircleDetails +
          CreateCircleSchedule have been superseded by
          CreateCircleWizardForm. The two old registrations are
          commented rather than deleted so a rollback is a single line
          and so accidental navigation calls fail fast at routing time
          rather than at render. */}
      {/* <HomeStack.Screen name="CreateCircleDetails" component={CreateCircleDetailsScreen} /> */}
      {/* <HomeStack.Screen name="CreateCircleSchedule" component={CreateCircleScheduleScreen} /> */}
      <HomeStack.Screen name="CreateCircleWizardForm" component={CreateCircleWizardFormScreen} />
      <HomeStack.Screen name="CreateCircleInvite" component={CreateCircleInviteScreen} />
      <HomeStack.Screen name="CreateCircleSuccess" component={CreateCircleSuccessScreen} />
      {/* Conflict Prediction admin/Elder dashboard. Also registered in
          CirclesStack. The HomeStack duplicate was removed in Step
          "audit dedup" — ConflictAlert is now reachable from the Circles
          tab only. */}
      {/* Marketplace (Migration 057) */}
      <HomeStack.Screen name="Marketplace" component={MarketplaceScreen} />
      <HomeStack.Screen name="StoreDetail" component={StoreDetailScreen} />
      <HomeStack.Screen name="StoreApplication" component={StoreApplicationScreen} />
      <HomeStack.Screen name="BulkInvites" component={BulkInvitesScreen} />
      <HomeStack.Screen name="BookService" component={BookServiceScreen} />
      <HomeStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
      <HomeStack.Screen name="MarketInsight" component={MarketInsightScreen} />
      {/* Provider-onboarding screens (kept in HomeStack — not part of the
          Trip Organizer flow which now lives in CirclesStack only) */}
      <HomeStack.Screen name="ProviderDiscovery" component={ProviderDiscoveryScreen} />
      <HomeStack.Screen name="ProviderProfileSetup" component={ProviderProfileSetupScreen} />
      <HomeStack.Screen name="ProviderVerification" component={ProviderVerificationScreen} />
      {/* Trip Organizer family deduplicated → CirclesStack canonical only. */}
      {/* AI / Financial Insight Screens */}
      <HomeStack.Screen name="StressScoreDashboard" component={StressScoreDashboardScreen} />
      <HomeStack.Screen name="MoodInsights" component={MoodInsightsScreen} />
      <HomeStack.Screen name="DiscoverCircles" component={DiscoverCirclesScreen} />
      {/* DynamicPayout / InsurancePool / SubstitutePool deduplicated →
          CirclesStack canonical only. */}
      <HomeStack.Screen name="CreditReport" component={CreditReportScreen} />
      <HomeStack.Screen name="DecisionHistory" component={DecisionHistoryScreen} />
      <HomeStack.Screen name="AIJobsHealth" component={AIJobsHealthScreen} />
      <HomeStack.Screen name="EarlyIntervention" component={EarlyInterventionScreen} />
      <HomeStack.Screen name="CreditProfile" component={CreditProfileScreen} />
      <HomeStack.Screen name="GraduatedEntry" component={GraduatedEntryScreen} />
      {/* CrossCircleLending deduplicated → CirclesStack canonical only. */}
      <HomeStack.Screen name="DefaultRecovery" component={DefaultRecoveryScreen} />
      <HomeStack.Screen name="DefaultDetail" component={DefaultDetailScreen} />
      <HomeStack.Screen name="LateContributionDetail" component={LateContributionDetailScreen} />
      {/* KYC P1 (2026-06-12): unified hub + single document screen.
          Legacy KYCVerification + VerificationHub route names point to
          the same KYCHubScreen component so existing deep links keep
          working. */}
      <HomeStack.Screen name="KYCVerification" component={KYCHubScreen} />
      <HomeStack.Screen name="KYCHub" component={KYCHubScreen} />
      <HomeStack.Screen name="KYCDocument" component={KYCDocumentScreen} />
      <HomeStack.Screen name="LegalDocuments" component={LegalDocumentsScreen} />
      <HomeStack.Screen name="LegalDocumentReader" component={LegalDocumentReaderScreen} />
      {/* Interest-First KYC flow (Phase KYC-2). Entered from the
          Dashboard interest card → UnlockInterestPrompt, then folds
          into KYCHub for the actual identity flow. */}
      <HomeStack.Screen name="UnlockInterestPrompt" component={UnlockInterestPromptScreen} />
      <HomeStack.Screen name="InterestUnlockedSuccess" component={InterestUnlockedSuccessScreen} />
      <HomeStack.Screen name="TaxIDEntry" component={TaxIDEntryScreen} />
      <HomeStack.Screen name="LimitedMode" component={LimitedModeScreen} />
      <HomeStack.Screen name="InternationalVerification" component={InternationalVerificationScreen} />
      {/* KYC P1: the following screens are commented out because their
          functionality is now folded into KYCHubScreen + KYCDocumentScreen
          + KYCTiersModal. Files retained for reference; routes will be
          deleted in P2 once a runtime sweep confirms no inbound deep links.
              <HomeStack.Screen name="VerificationOptions" component={VerificationOptionsScreen} />
              <HomeStack.Screen name="ITINEducation" component={ITINEducationScreen} />
              <HomeStack.Screen name="ITINApplicationHelp" component={ITINApplicationHelpScreen} />
              <HomeStack.Screen name="ITINPending" component={ITINPendingScreen} />
              <HomeStack.Screen name="IDVerificationStart" component={IDVerificationStartScreen} />
              <HomeStack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
          */}
      {/* Advance Payout V2 flow (Stage 8). Entered (for now) via the
          __DEV__ "Advance V2" button on the Dashboard → AdvanceHubV2.
          The 3 *V2 screens coexist with the existing non-V2 Advance
          screens registered higher up; reconciliation is a later
          decision. AdminDashboard is staff-only and not linked from
          any user menu. */}
      <HomeStack.Screen name="AdvanceHubV2" component={AdvanceHubV2Screen} />
      <HomeStack.Screen name="SmartCalculator" component={SmartCalculatorScreen} />
      <HomeStack.Screen name="AdvanceDetailsV2" component={AdvanceDetailsV2Screen} />
      <HomeStack.Screen name="EarlyRepayment" component={EarlyRepaymentScreen} />
      <HomeStack.Screen name="RepaymentConfirm" component={RepaymentConfirmScreen} />
      <HomeStack.Screen name="PaymentFailed" component={PaymentFailedScreen} />
      <HomeStack.Screen name="PaymentReminder" component={PaymentReminderScreen} />
      <HomeStack.Screen name="HardshipRequest" component={HardshipRequestScreen} />
      <HomeStack.Screen name="AutopaySetup" component={AutopaySetupScreen} />
      <HomeStack.Screen name="CircleAutopaySetup" component={CircleAutopaySetupScreen} />
      <HomeStack.Screen name="CircleAutopayManagement" component={CircleAutopayManagementScreen} />
      <HomeStack.Screen name="CommunityPreferences" component={CommunityPreferencesScreen} />
      <HomeStack.Screen name="RateBreakdown" component={RateBreakdownScreen} />
      <HomeStack.Screen name="AdvanceSettings" component={AdvanceSettingsScreen} />
      <HomeStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <HomeStack.Screen name="AdminHub" component={AdminHubScreen} />
      <HomeStack.Screen name="AdminOverview" component={AdminOverviewScreen} />
      <HomeStack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <HomeStack.Screen name="AdminUserDetail" component={AdminUserDetailScreen} />
      <HomeStack.Screen name="AdminCircles" component={AdminCirclesScreen} />
      <HomeStack.Screen name="AdminCircleDetail" component={AdminCircleDetailScreen} />
      <HomeStack.Screen name="AdminTrips" component={AdminTripsScreen} />
      <HomeStack.Screen name="AdminTripDetail" component={AdminTripDetailScreen} />
      <HomeStack.Screen name="AdminBugReports" component={AdminBugReportsScreen} />
      <HomeStack.Screen name="AdminBugReportDetail" component={AdminBugReportDetailScreen} />
      <HomeStack.Screen name="AdminLiquidityAdvances" component={AdminLiquidityAdvancesScreen} />
      <HomeStack.Screen name="AdminPlatformSettings" component={AdminPlatformSettingsScreen} />
      {/* StripeConnectScreen is reachable via deep link only; no user-facing menu entry. */}
      <HomeStack.Screen name="StripeConnect" component={StripeConnectScreen} />
      <HomeStack.Screen name="OrganizerPayoutHistory" component={OrganizerPayoutHistoryScreen} />
      <HomeStack.Screen name="AdminModeration" component={AdminModerationScreen} />
      <HomeStack.Screen name="PlatformAuditTrail" component={PlatformAuditTrailScreen} />
      {/* Goals flow (GOALS-001..015). Entered (for now) via the __DEV__
          "Goals V2" button on the Dashboard → GoalsHubV2. GoalDetailV2 /
          GoalsHubV2 coexist with the existing GoalDetails / GoalsHub screens
          registered above; reconciliation is a later decision. */}
      <HomeStack.Screen name="GoalsHubV2" component={GoalsHubV2Screen} />
      <HomeStack.Screen name="GoalCreateExpress" component={GoalCreateExpressScreen} />
      <HomeStack.Screen name="GoalDetailV2" component={GoalDetailV2Screen} />
      <HomeStack.Screen name="GoalLinkCircle" component={GoalLinkCircleScreen} />
      <HomeStack.Screen name="GoalMilestones" component={GoalMilestonesScreen} />
      <HomeStack.Screen name="GoalAchieved" component={GoalAchievedScreen} />
      <HomeStack.Screen name="GoalBItems" component={GoalBItemsScreen} />
      <HomeStack.Screen name="GoalStories" component={GoalStoriesScreen} />
      <HomeStack.Screen name="GoalActivity" component={GoalActivityScreen} />
      <HomeStack.Screen name="GoalEdit" component={GoalEditScreen} />
      {/* Dream Feed family deduplicated → CommunityStack canonical only.
          PostDetail and FeedSettings remain here (not Dream-Feed-specific). */}
      <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
      <HomeStack.Screen name="FeedSettings" component={FeedSettingsScreen} />
      {/* Profile Screens (moved from Profile tab — profile is now avatar in top-right) */}
      <HomeStack.Screen name="ProfileMain" component={ProfileScreen} />
      <HomeStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <HomeStack.Screen name="LanguageRegion" component={LanguageRegionScreen} />
      <HomeStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <HomeStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <HomeStack.Screen name="TwoFactorAuth" component={TwoFactorAuthScreen} />
      <HomeStack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
      <HomeStack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <HomeStack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <HomeStack.Screen name="ActiveSessions" component={ActiveSessionsScreen} />
      <HomeStack.Screen name="AboutApp" component={AboutAppScreen} />
      <HomeStack.Screen name="VouchMember" component={VouchMemberScreen} />
      <HomeStack.Screen name="ElderNominations" component={ElderNominationsScreen} />
      <HomeStack.Screen name="IssueExposureVouch" component={IssueExposureVouchScreen} />
      <HomeStack.Screen name="MemberSearch" component={MemberSearchScreen} />
      <HomeStack.Screen name="SubstituteDashboard" component={SubstituteDashboardScreen} />
      <HomeStack.Screen name="ResolutionCenter" component={ResolutionCenterScreen} />
      <HomeStack.Screen name="DisputesList" component={DisputesListScreen} />
      <HomeStack.Screen name="DisputeDetail" component={DisputeDetailScreen} />
      {/* Community Sub-screens (reachable from Community tab too) */}
      <HomeStack.Screen name="NearYou" component={NearYouScreen} />
      <HomeStack.Screen name="NewArrivals" component={NewArrivalsScreen} />
      <HomeStack.Screen name="Gatherings" component={GatheringsScreen} />
      <HomeStack.Screen name="CreateGathering" component={CreateGatheringScreen} />
      <HomeStack.Screen name="CommunityMemory" component={CommunityMemoryScreen} />
      <HomeStack.Screen name="CommunityFeed" component={CommunityFeedScreen} />
      <HomeStack.Screen name="PostToCommunity" component={PostToCommunityScreen} />
    </HomeStack.Navigator>
  );
}

// Circles Tab Stack
function CirclesStackScreen() {
  return (
    <CirclesStack.Navigator screenOptions={{ headerShown: false }}>
      <CirclesStack.Screen name="CirclesMain" component={CirclesV2Screen} />
      <CirclesStack.Screen name="CircleDetail" component={CircleDetailScreen} />
      {/* Circle Contribution Autopay — also registered in HomeStack
          above. CircleDetail (which navigates to CircleAutopaySetup
          for "Set up autopay") lives inside CirclesStack, so the
          target must exist on this stack too — otherwise React
          Navigation throws "no navigator handled the action". */}
      <CirclesStack.Screen name="CircleAutopaySetup" component={CircleAutopaySetupScreen} />
      <CirclesStack.Screen name="CircleAutopayManagement" component={CircleAutopayManagementScreen} />
      <CirclesStack.Screen name="GroupChat" component={GroupChatScreen} options={{ headerShown: false }} />
      <CirclesStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
      <CirclesStack.Screen name="CreateCircleExpress" component={CreateCircleExpressScreen} />
      <CirclesStack.Screen name="DiscoverCircles" component={DiscoverCirclesScreen} />
      <CirclesStack.Screen name="CircleHealth" component={CircleHealthScreen} />
      <CirclesStack.Screen name="SubstitutePool" component={SubstitutePoolScreen} />
      <CirclesStack.Screen name="CrossCircleLending" component={CrossCircleLendingScreen} />
      <CirclesStack.Screen name="QuickCircle" component={QuickCircleScreen} />
      {/* Bucket B (Create-a-circle review): see HomeStack above for
          why CreateCircleDetails + CreateCircleSchedule are commented. */}
      {/* <CirclesStack.Screen name="CreateCircleDetails" component={CreateCircleDetailsScreen} /> */}
      {/* <CirclesStack.Screen name="CreateCircleSchedule" component={CreateCircleScheduleScreen} /> */}
      <CirclesStack.Screen name="CreateCircleWizardForm" component={CreateCircleWizardFormScreen} />
      <CirclesStack.Screen name="CreateCircleInvite" component={CreateCircleInviteScreen} />
      <CirclesStack.Screen name="CreateCircleSuccess" component={CreateCircleSuccessScreen} />
      <CirclesStack.Screen name="HowCirclesWork" component={HowCirclesWorkScreen} />
      <CirclesStack.Screen name="JoinCircleConfirm" component={JoinCircleConfirmScreen} />
      <CirclesStack.Screen name="JoinCircleSuccess" component={JoinCircleSuccessScreen} />
      <CirclesStack.Screen name="JoinCircleByCode" component={JoinCircleByCodeScreen} />
      <CirclesStack.Screen name="QRScanner" component={QRScannerScreen} />
      <CirclesStack.Screen name="QRCodeDisplay" component={QRCodeDisplayScreen} />
      <CirclesStack.Screen name="MakeContribution" component={MakeContributionScreen} />
      <CirclesStack.Screen name="ContributionSuccess" component={ContributionSuccessScreen} />
      <CirclesStack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
      <CirclesStack.Screen name="LeaveCircle" component={LeaveCircleScreen} />
      <CirclesStack.Screen name="ManageMembers" component={ManageMembersScreen} />
      {/* MemberSearch also lives in HomeStack. CircleDetail's "Invite by
          name" button calls navigate("MemberSearch") — if the user came
          from the Circles tab (CirclesStack), React Navigation only walks
          the current stack, so we need the screen registered here too.
          Without this, the tab throws
          "NAVIGATE with payload ... was not handled by any navigator". */}
      <CirclesStack.Screen name="MemberSearch" component={MemberSearchScreen} />
      {/* LinkedAccounts also lives in HomeStack. MakeContribution (this
          stack) navigates to LinkedAccounts when the user picks a payment
          method → same cross-stack-navigator failure as MemberSearch. */}
      <CirclesStack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <CirclesStack.Screen name="PauseCircle" component={PauseCircleScreen} />
      <CirclesStack.Screen name="CloseCircle" component={CloseCircleScreen} />
      <CirclesStack.Screen name="ExportData" component={ExportDataScreen} />
      <CirclesStack.Screen name="AdminSettings" component={AdminSettingsScreen} />
      <CirclesStack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <CirclesStack.Screen name="OversightDashboard" component={OversightDashboardScreen} />
      {/* Conflict P1 — legacy name aliased to ConflictCase. */}
      <CirclesStack.Screen name="MediationTools" component={ConflictCaseScreen} />
      <CirclesStack.Screen name="ConflictCase" component={ConflictCaseScreen} />
      <CirclesStack.Screen name="ElderOnboarding" component={ElderOnboardingScreen} />
      <CirclesStack.Screen name="AuditTrail" component={AuditTrailScreen} />
      {/* Circle Feature Screens */}
      <CirclesStack.Screen name="ConflictAlert" component={ConflictAlertScreen} />
      <CirclesStack.Screen name="InsurancePool" component={InsurancePoolScreen} />
      <CirclesStack.Screen name="PartialContribution" component={PartialContributionScreen} />
      <CirclesStack.Screen name="PositionSwap" component={PositionSwapScreen} />
      <CirclesStack.Screen name="CycleTimeline" component={CycleTimelineScreen} />
      <CirclesStack.Screen name="CycleDetail" component={CycleDetailScreen} />
      <CirclesStack.Screen name="CircleVoting" component={CircleVotingScreen} />
      <CirclesStack.Screen name="ProposalDetail" component={ProposalDetailScreen} />
      <CirclesStack.Screen name="DynamicPayout" component={DynamicPayoutScreen} />
      <CirclesStack.Screen name="CircleVisualizer" component={CircleVisualizerScreen} />
      {/* Advance V2 — reachable from both Home (HomeStack) and Circles
          (CirclesStack). Duplicated registration is intentional: each
          tab owns its own nav stack, and the "Manage active advances"
          card on CirclesV2Screen must resolve AdvanceHubV2 inside the
          Circles stack rather than crash to no-match. */}
      <CirclesStack.Screen name="AdvanceHubV2" component={AdvanceHubV2Screen} />
      <CirclesStack.Screen name="SmartCalculator" component={SmartCalculatorScreen} />
      <CirclesStack.Screen name="AdvanceDetailsV2" component={AdvanceDetailsV2Screen} />
      <CirclesStack.Screen name="AdvanceSettings" component={AdvanceSettingsScreen} />
      {/* Trip Organizer Screens */}
      <CirclesStack.Screen name="OrganizerTripList" component={OrganizerTripListScreen} />
      <CirclesStack.Screen name="CreateTripWizard" component={CreateTripWizardScreen} />
      <CirclesStack.Screen name="OrganizerTripDashboard" component={OrganizerTripDashboardScreen} />
      <CirclesStack.Screen name="ItineraryBuilder" component={ItineraryBuilderScreen} />
      <CirclesStack.Screen name="ParticipantManager" component={ParticipantManagerScreen} />
      <CirclesStack.Screen name="ParticipantDetail" component={ParticipantDetailScreen} />
      <CirclesStack.Screen name="TripPublicPage" component={TripPublicPageScreen} />
      <CirclesStack.Screen name="TripPublicPageAlt" component={TripPublicPageScreen} />
      <CirclesStack.Screen name="TripUpdates" component={TripUpdatesScreen} />
      <CirclesStack.Screen name="MyTripStatus" component={MyTripStatusScreen} />
      <CirclesStack.Screen name="MyTrips" component={MyTripsScreen} />
      <CirclesStack.Screen name="PayoutPreferences" component={PayoutPreferencesScreen} />
      <CirclesStack.Screen name="LeaveReview" component={LeaveReviewScreen} />
      <CirclesStack.Screen name="TripReviews" component={TripReviewsScreen} />
      <CirclesStack.Screen name="DocumentSubmission" component={DocumentSubmissionScreen} />
      <CirclesStack.Screen name="TripPayment" component={TripPaymentScreen} />
      <CirclesStack.Screen name="TripPaymentSuccess" component={TripPaymentSuccessScreen} />
      <CirclesStack.Screen name="TripPaymentFailed" component={TripPaymentFailedScreen} />
      <CirclesStack.Screen name="TripPublishSuccess" component={TripPublishSuccessScreen} />
      <CirclesStack.Screen name="ActivityEditor" component={ActivityEditorScreen} />
    </CirclesStack.Navigator>
  );
}

// Market Tab Stack — The Community Economy
function MarketStackScreen() {
  return (
    <MarketStack.Navigator screenOptions={{ headerShown: false }}>
      {/* Marketplace-replace — the Market tab's initial route now lands on
          the Verified Provider Network list. The old MarketplaceScreen is
          still imported above so the HomeStack registration at
          `name="Marketplace"` continues to work for any legacy deep
          links / nav.navigate("Marketplace") call sites. */}
      <MarketStack.Screen name="MarketMain" component={ProviderListScreen} />
      <MarketStack.Screen name="StoreDetail" component={StoreDetailScreen} />
      <MarketStack.Screen name="StoreApplication" component={StoreApplicationScreen} />
      <MarketStack.Screen name="BulkInvites" component={BulkInvitesScreen} />
      <MarketStack.Screen name="BookService" component={BookServiceScreen} />
      <MarketStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
      <MarketStack.Screen name="MarketInsight" component={MarketInsightScreen} />
      {/* Provider-onboarding screens (kept in MarketStack — not part of the
          Trip Organizer flow which now lives in CirclesStack only) */}
      <MarketStack.Screen name="ProviderDiscovery" component={ProviderDiscoveryScreen} />
      <MarketStack.Screen name="ProviderProfileSetup" component={ProviderProfileSetupScreen} />
      <MarketStack.Screen name="ProviderVerification" component={ProviderVerificationScreen} />
      {/* Trip Organizer family deduplicated → CirclesStack canonical only. */}
      {/* Provider-request form — closes the dead RequestProvider nav target
          that lived in RootStackParamList without a screen attached. */}
      <MarketStack.Screen name="RequestProvider" component={RequestProviderScreen} />
      {/* Store-owner edit form — closes 2 dead nav targets from
          OwnerDashboardScreen's header + "Edit Store" tile. */}
      <MarketStack.Screen name="EditStore" component={EditStoreScreen} />
      {/* Store-owner service CRUD — closes 3 dead `ManageServices` targets
          on OwnerDashboardScreen. ServiceForm presents modally so the
          form covers the list rather than pushing a new card onto the
          stack — matches add/edit-row UX in the rest of the app. */}
      <MarketStack.Screen name="ManageServices" component={ManageServicesScreen} />
      <MarketStack.Screen
        name="ServiceForm"
        component={ServiceFormScreen}
        options={{ presentation: 'modal' }}
      />
      {/* Store-owner booking management — closes 2 dead `StoreBookings`
          targets from OwnerDashboardScreen's "Bookings" tile and the
          "See All" link on the Recent Bookings section. */}
      <MarketStack.Screen name="StoreBookings" component={StoreBookingsScreen} />
    </MarketStack.Navigator>
  );
}

// Community Tab Stack — The Living Village
function CommunityStackScreen() {
  return (
    <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
      <CommunityStack.Screen name="CommunityMain" component={CommunityTabScreen} />
      <CommunityStack.Screen name="Events" component={EventsScreen} />
      <CommunityStack.Screen name="CreateEvent" component={CreateEventScreen} />
      <CommunityStack.Screen name="DreamFeed" component={DreamFeedScreen} />
      <CommunityStack.Screen name="CreateDreamPost" component={CreateDreamPostScreen} />
      <CommunityStack.Screen name="UserDreamProfile" component={UserDreamProfileScreen} />
      <CommunityStack.Screen name="SupportDream" component={SupportDreamScreen} />
      <CommunityStack.Screen name="CommunityBrowser" component={CommunityBrowserScreen} />
      <CommunityStack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <CommunityStack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <CommunityStack.Screen name="MyCommunities" component={MyCommunitiesScreen} />
      <CommunityStack.Screen name="NearYou" component={NearYouScreen} />
      <CommunityStack.Screen name="NewArrivals" component={NewArrivalsScreen} />
      <CommunityStack.Screen name="Gatherings" component={GatheringsScreen} />
      <CommunityStack.Screen name="CreateGathering" component={CreateGatheringScreen} />
      <CommunityStack.Screen name="CommunityMemory" component={CommunityMemoryScreen} />
      <CommunityStack.Screen name="CommunityFeed" component={CommunityFeedScreen} />
      <CommunityStack.Screen name="PostToCommunity" component={PostToCommunityScreen} />
      <CommunityStack.Screen name="ElderDashboard" component={ElderDashboardScreen} />
      {/* Conflict P1 — legacy elder route names aliased to merged screens. */}
      <CommunityStack.Screen name="BecomeElder" component={ElderOnboardingScreen} />
      <CommunityStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <CommunityStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <CommunityStack.Screen name="MediationCase" component={ConflictCaseScreen} />
      <CommunityStack.Screen name="ElderTrainingHub" component={ElderOnboardingScreen} />
      <CommunityStack.Screen name="ConflictCase" component={ConflictCaseScreen} />
      <CommunityStack.Screen name="ElderOnboarding" component={ElderOnboardingScreen} />
      {/* Profile accessible from avatar in community */}
      <CommunityStack.Screen name="ProfileMain" component={ProfileScreen} />
      <CommunityStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <CommunityStack.Screen name="Settings" component={SettingsMainScreen} />
      {/* Payment settings reachable from ProfileScreen "Payment methods"
          row. ProfileScreen also lives in HomeStack (where LinkedAccounts
          is originally registered) but when ProfileScreen is entered via
          the Community-tab avatar tap, the current navigator is
          CommunityStack — the navigate walks up this stack, doesn't find
          LinkedAccounts, and throws. Register here too so the row works
          from either entry point. */}
      <CommunityStack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
    </CommunityStack.Navigator>
  );
}

// Sync Tab Stack -- SyncStream (replaces the legacy Action tab as part
// of feat(syncstream) phase 2). Lobby lists active rooms; Room is the
// per-room shared-watch experience driven by the migration-124 RPCs +
// realtime subscriptions.
function SyncStackScreen() {
  return (
    <SyncStack.Navigator screenOptions={{ headerShown: false }}>
      <SyncStack.Screen name="SyncLobby" component={SyncLobbyScreen} />
      <SyncStack.Screen name="SyncRoom" component={SyncRoomScreen} />
      <SyncStack.Screen name="HostDashboard" component={HostDashboardScreen} />
    </SyncStack.Navigator>
  );
}

// DEPRECATED — Interest-First KYC (Phase KYC-2) uses individual
// HomeStack screens, not this nested stack. The factory is kept
// here as dormant reference; the root <Stack.Screen name="KycStack">
// registration further down is commented out so this code path is
// unreachable at runtime. Future cleanup PR can delete this
// function + the OnboardingWelcome / AccountTiersExplained /
// VerificationHub imports that only feed it.
//
// Original purpose (Phase KYC-1): nested 13-screen stack mounted
// between auth and MainTabs, entered via navigate('KycStack',
// { screen: 'OnboardingWelcome' }).
function KycStackScreen() {
  return (
    <KycStack.Navigator screenOptions={{ headerShown: false }}>
      <KycStack.Screen name="OnboardingWelcome" component={OnboardingWelcomeScreen} />
      <KycStack.Screen name="VerificationOptions" component={VerificationOptionsScreen} />
      <KycStack.Screen name="ITINEducation" component={ITINEducationScreen} />
      <KycStack.Screen name="ITINApplicationHelp" component={ITINApplicationHelpScreen} />
      <KycStack.Screen name="InternationalVerification" component={InternationalVerificationScreen} />
      <KycStack.Screen name="TaxIDEntry" component={TaxIDEntryScreen} />
      <KycStack.Screen name="AccountTiersExplained" component={AccountTiersExplainedScreen} />
      <KycStack.Screen name="IDVerificationStart" component={IDVerificationStartScreen} />
      <KycStack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <KycStack.Screen name="Tier2Success" component={Tier2SuccessScreen} />
      <KycStack.Screen name="VerificationHub" component={VerificationHubScreen} />
      <KycStack.Screen name="LimitedMode" component={LimitedModeScreen} />
      <KycStack.Screen name="ITINPending" component={ITINPendingScreen} />
    </KycStack.Navigator>
  );
}

// Score Hub Tab Stack — single-screen stack so the Score Hub tab follows the
// same navigator pattern as Home/Circles/Market/Community. Deep-dive routes
// (CreditReport, XnScoreDashboard, etc.) live in HomeStack and are reached via
// cross-tab navigation, so they don't need to be re-registered here.
function ScoreHubStackScreen() {
  return (
    <ScoreHubStack.Navigator screenOptions={{ headerShown: false }}>
      <ScoreHubStack.Screen name="ScoreHubMain" component={ScoreHubScreen} />
    </ScoreHubStack.Navigator>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NAVIGATION HELPER - Extract active route name from nested navigators
// ══════════════════════════════════════════════════════════════════════════════
function getActiveRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes[state.index];
  if (route.state) {
    return getActiveRouteName(route.state);
  }
  return route.name;
}

// Component that wraps the app content and handles inactivity lock
function AppContent() {
  const { user, isAuthenticated, isLocked, lockApp } = useAuth();
  const { setScreenName } = useBugReportScreen();

  const { resetTimer } = useInactivityLock({
    onLock: lockApp,
    isAuthenticated,
    isLocked,
  });

  // Feed the active route name into BugReportContext so the FAB modal
  // can stamp it onto each report. Subscribes to navigationRef rather
  // than reading state inline so it picks up nested-stack transitions.
  React.useEffect(() => {
    const apply = () => {
      const state = navigationRef.getRootState?.();
      const route = state ? getActiveRouteName(state) : undefined;
      if (route) setScreenName(route);
    };
    apply();
    const unsub = navigationRef.addListener?.("state", apply);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [setScreenName]);

  // SyncStream deep-link handler. Listens for tandaxn://sync-room?id=...
  // intents (both cold-open via getInitialURL and warm via the url event).
  // We only act once isAuthenticated -- a logged-out user landing on an
  // invite link should clear the auth stack first; we re-fire once they
  // sign in by re-reading the initial URL.
  React.useEffect(() => {
    if (!isAuthenticated) return;

    const handle = (url: string | null) => {
      const parsed = parseSyncRoomUrl(url);
      if (!parsed) return;
      // Use navigationRef so this works even if the user isn't
      // currently on a screen with useNavigation context (e.g. the
      // first paint after signup).
      if (navigationRef.isReady()) {
        navigationRef.navigate("SyncRoom", {
          roomId: parsed.roomId,
          inviteCode: parsed.inviteCode,
        });
      }
    };

    // Cold open (the app was launched by the URL).
    Linking.getInitialURL().then(handle).catch(() => {});

    // Warm open (the app was already running).
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, [isAuthenticated]);

  // ── Event Logging: Set user ID when authenticated ─────────────────────
  React.useEffect(() => {
    if (user?.id) {
      eventService.setUserId(user.id);
    } else {
      eventService.setUserId(null);
    }
  }, [user?.id]);

  // ── Event Logging: App lifecycle tracking ──────────────────────────────
  React.useEffect(() => {
    eventService.startSession();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        eventService.startSession();
      } else if (nextState === 'background' || nextState === 'inactive') {
        eventService.endSession();
      }
    });
    return () => {
      subscription.remove();
      eventService.endSession();
    };
  }, []);

  // Render the lock screen as a Modal OVERLAY (not a replacement). The
  // previous version returned <LockScreen /> in place of the navigator,
  // which unmounted the entire navigation tree — so after unlock the
  // navigator remounted at initialRouteName="Splash", and any transient
  // auth-state hiccup during the password re-verify could land the user
  // on the Login screen. With an overlay, the navigation state under the
  // lock is preserved: unlock dismisses the modal and the user is back
  // on whatever screen they were on (Wallet, Send Money, etc).
  const lockOverlay =
    isAuthenticated && isLocked ? (
      <Modal
        visible
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        // Hardware back must NOT dismiss the lock — onRequestClose left as
        // a no-op so Android's back button can't bypass the gate.
        onRequestClose={() => {}}
      >
        <LockScreen />
      </Modal>
    ) : null;

  // Wrap navigation in TouchableWithoutFeedback to reset timer on any touch
  return (
    <TouchableWithoutFeedback onPress={resetTimer} accessible={false}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
        {lockOverlay}
        {/* Global amber band when the device is offline. Self-renders to
            null when isOffline is false, so there's zero layout cost in
            the happy path. Sits above the Navigator so it overlays every
            route, including auth screens. */}
        <OfflineBanner />
        {/* No-render listener: subscribes to circle_payouts INSERTs for
            the current user and routes them to the PayoutReceived
            modal when the app is foreground. Push-tap routing for the
            backgrounded case is handled by NotificationContext. */}
        <PayoutListener />
        {/* Floating bug-report FAB. Self-hides when no auth user (RLS
            requires auth.uid() = user_id). Reads current screen name
            from BugReportContext (fed by onStateChange below). */}
        <BugReportButton />
        {/* Global brand-mark overlay — small flame + "TandaXn" pill in
            the top-left that navigates to the Home tab from any screen.
            Self-hides when no auth user (unauthenticated tree already
            has its own branding). */}
        <LogoHomeButton />
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: "#0A2342" },
          }}
        >
          {/* Auth Flow - No tab bar */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          {/* 2FA challenge — reached from LoginScreen when signIn
              resolves with { requiresMfa: true }. AuthContext holds
              pendingMfa which forces isAuthenticated=false, so this
              screen stays inside the auth stack until the code is
              verified. */}
          <Stack.Screen name="MfaChallenge" component={MfaChallengeScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="SignupWelcome" component={SignupWelcomeScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="OTP" component={OTPScreen} />
          <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
          <Stack.Screen name="AuthCallback" component={AuthCallbackScreen} options={{ headerShown: false }} />
          {/* KycStack DEPRECATED — the Interest-First KYC flow
              (Phase KYC-2) uses individual screens registered in
              HomeStack instead. The KycStackScreen factory below is
              kept dormant; the registration line is intentionally
              commented out so the route is no longer reachable. A
              future cleanup PR can delete the factory + 13 KYC
              imports under red-emoji approval. */}
          {/* <Stack.Screen name="KycStack" component={KycStackScreen} /> */}
          {/* Main App with Tab Bar */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
          {/* Modal screens that should appear over tabs without tab bar */}
          <Stack.Screen name="AccessRestricted" component={AccessRestrictedScreen} />
          {/* Modal-style screen reachable from CircleDetail's Circle Options sheet.
              The sheet renders via a portal outside CirclesStack's subtree, so
              useNavigation() inside it returns the root Stack — hence this
              registration in addition to the one in CirclesStack at line ~586. */}
          <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
          {/* Same root-Stack fallback for MediationTools — same Circle Options
              sheet, same Portal escapes CirclesStack scope. Existing
              CirclesStack registration at line ~589 is kept (duplicate is fine). */}
          {/* Conflict P1 (2026-06-12): MediationTools now aliases to the
              merged ConflictCaseScreen. The root-Stack registration stays
              so the Circle Options Portal route resolves regardless of
              which navigator's prop the closure captured. */}
          <Stack.Screen name="MediationTools" component={ConflictCaseScreen} />
          <Stack.Screen name="ConflictCase" component={ConflictCaseScreen} />
          <Stack.Screen name="ElderOnboarding" component={ElderOnboardingScreen} />
          {/* Remaining Circle Options sheet items — same Portal pattern as
              ReportIssue/MediationTools. Each is also registered in CirclesStack
              (and a few elsewhere); the root-Stack duplicate ensures
              navigate() resolves no matter which navigator's prop the modal
              closure captures. Added 2026-05-20 alongside ReportIssue fix. */}
          <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
          <Stack.Screen name="LeaveCircle" component={LeaveCircleScreen} />
          <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
          <Stack.Screen name="PaymentHistory" component={PaymentHistoryScreen} />
          <Stack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
          <Stack.Screen name="ManageMembers" component={ManageMembersScreen} />
          <Stack.Screen name="PauseCircle" component={PauseCircleScreen} />
          <Stack.Screen name="CloseCircle" component={CloseCircleScreen} />
          <Stack.Screen name="ExportData" component={ExportDataScreen} />
          <Stack.Screen name="OversightDashboard" component={OversightDashboardScreen} />
          <Stack.Screen name="AuditTrail" component={AuditTrailScreen} />
          <Stack.Screen name="QRCodeDisplay" component={QRCodeDisplayScreen} />
          {/* PayoutReceived — transparent-modal "🎉 Payout received!"
              sheet. Mounted on the root Stack so the realtime listener
              + push-tap router can reach it from any screen. */}
          <Stack.Screen
            name="PayoutReceived"
            component={PayoutReceivedScreen}
            options={{
              presentation: "transparentModal",
              animation: "fade",
            }}
          />
          <Stack.Screen name="PayoutHistory" component={PayoutHistoryScreen} />
          {/* Verified Provider Network (Phase 1A) — browse providers, view
              a provider profile, apply to become one. */}
          <Stack.Screen name="ProviderList" component={ProviderListScreen} />
          <Stack.Screen name="ProviderDetail" component={ProviderDetailScreen} />
          <Stack.Screen name="ProviderApplication" component={ProviderApplicationScreen} />
          <Stack.Screen name="GoalProviderPayment" component={GoalProviderPaymentScreen} />
          <Stack.Screen name="ProviderDashboard" component={ProviderDashboardScreen} />
          <Stack.Screen name="ProviderNetworkVerification" component={ProviderNetworkVerificationScreen} />
          <Stack.Screen name="GoalDisbursementMilestones" component={GoalDisbursementMilestonesScreen} />
          <Stack.Screen name="CreateDisbursementMilestones" component={CreateDisbursementMilestonesScreen} />
          <Stack.Screen name="MilestoneVerification" component={MilestoneVerificationScreen} />
          <Stack.Screen name="AdminVerificationQueue" component={AdminVerificationQueueScreen} />
          <Stack.Screen name="VerificationMap" component={VerificationMapScreen} />
          <Stack.Screen name="GoalTemplateBrowser" component={GoalTemplateBrowserScreen} />
          <Stack.Screen name="SubmitTemplate" component={SubmitTemplateScreen} />
          <Stack.Screen name="AdminTemplateQueue" component={AdminTemplateQueueScreen} />
          {/* Deep Link Invite Screens */}
          <Stack.Screen name="CircleInvite" component={CircleInviteScreen} />
          {/* Public frictionless join — reachable unauthenticated at /join/:inviteCode */}
          <Stack.Screen name="QuickJoin" component={QuickJoinScreen} />
          <Stack.Screen name="QuickJoinPendingConfirmation" component={QuickJoinPendingConfirmationScreen} />
          {/* Magic-link landing page at /join-confirm?pending=<id> */}
          <Stack.Screen name="JoinConfirm" component={JoinConfirmScreen} />
          <Stack.Screen name="QuickJoinPaymentSuccess" component={QuickJoinPaymentSuccessScreen} />
          {/* Optional password setup right after first magic-link join */}
          <Stack.Screen name="SetPassword" component={SetPasswordScreen} />
          {/* Generic in-app web view (KYC inquiry forms, terms pages, etc.).
              Modal presentation so it overlays the current tab without
              disturbing the stack underneath. */}
          <Stack.Screen
            name="WebView"
            component={WebViewScreen}
            options={{ presentation: 'modal' }}
          />
        </Stack.Navigator>
      </View>
    </TouchableWithoutFeedback>
  );
}

function MainTabs() {
  // i18n: localized tab labels. useTranslation triggers a re-render
  // when i18n.changeLanguage fires, so swapping the user's language
  // updates the tab bar without an app restart.
  const { t } = useTranslation();
  const { isEmailVerified, user } = useAuth();
  const navigation = useNavigation<any>();

  // Email-verification gate. If a session lands here with email not
  // confirmed (signed up + tapped "Already have an account?" before
  // clicking the link, or a session that survived an expired link),
  // bounce to EmailVerification with the email param. The screen
  // there subscribes to onAuthStateChange and bounces back when
  // verification completes, so this gate isn't a re-entry trap.
  React.useEffect(() => {
    if (!isEmailVerified && user?.email) {
      navigation.reset({
        index: 0,
        routes: [{ name: "EmailVerification", params: { email: user.email } }],
      });
    }
  }, [isEmailVerified, user?.email, navigation]);

  return (
    // Phase 2 Bucket B — mount CriticalBanner above MainTabs so the
    // sticky red bar appears on every authenticated screen. Unsigned
    // pre-MainTabs screens (Login, SignUp, OTP, EmailVerification)
    // never see it, which is correct — there's no user to restrict.
    <View style={{ flex: 1 }}>
      <CriticalBanner />
      <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarActiveTintColor: "#00C6AE",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Circles") {
            iconName = focused ? "people-circle" : "people-circle-outline";
          } else if (route.name === "Action") {
            // Custom center button — icon handled in tabBarButton
            return (
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: "#0A2342",
                justifyContent: "center",
                alignItems: "center",
                marginTop: -20,
                shadowColor: "#0A2342",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 8,
                elevation: 8,
              }}>
                <Ionicons name="flame" size={28} color="#E8A842" />
              </View>
            );
          } else if (route.name === "Market") {
            iconName = focused ? "storefront" : "storefront-outline";
          } else if (route.name === "Community") {
            iconName = focused ? "earth" : "earth-outline";
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
      screenListeners={({ route, navigation }) => ({
        tabPress: (e) => {
          // When a tab is pressed, reset that tab's stack to root
          const state = navigation.getState();
          const currentRoute = state.routes.find((r: any) => r.name === route.name);

          if (currentRoute && currentRoute.state && currentRoute.state.index > 0) {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: route.name }],
              })
            );
          }
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{ tabBarLabel: t("tabs.home") }}
      />
      <Tab.Screen
        name="Circles"
        component={CirclesStackScreen}
        options={{ tabBarLabel: t("tabs.circles") }}
      />
      {/* Action tab key is preserved -- the center-button visual is keyed
          off route.name === "Action" in the tabBarIcon switch above --
          but the component now points at the SyncStack (feat(syncstream)
          phase 2). The legacy ActionScreen import stays in case a
          rollback is needed; remove after Sync ships to TestFlight. */}
      <Tab.Screen
        name="Action"
        component={SyncStackScreen}
        options={{
          tabBarLabel: "",
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketStackScreen}
        options={{ tabBarLabel: t("tabs.market") }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityStackScreen}
        options={{ tabBarLabel: t("tabs.community") }}
      />
      </Tab.Navigator>
    </View>
  );
}

export default function App() {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
    duration?: number;
  }>({ visible: false, message: "", type: "success" });

  // Register global toast handler on mount
  React.useEffect(() => {
    registerToastHandler(({ message, type, duration }) => {
      setToast({ visible: true, message, type, duration });
    });
  }, []);

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
    <ScrollDiagnosticProvider>
    <AuthProvider>
      <PreferencesProvider>
        <PaymentProvider>
        <CurrencyProvider>
          <CirclesProvider>
            <WalletProvider>
                <TrustProvider>
                  <AdvanceProvider>
                    <SavingsProvider>
                      <WithdrawalWizardProvider>
                      <FeedProvider>
                      <CommunityProvider>
                        <ElderProvider>
                        <FeatureGateProvider>
                        <MemberProfileProvider>
                          <NotificationProvider>
                            <OnboardingProvider>
                              <BugReportProvider>
                                <NavigationContainer
                                  ref={navigationRef}
                                  linking={linkingConfig}
                                  onStateChange={(state) => {
                                    const currentRoute = getActiveRouteName(state);
                                    if (currentRoute) {
                                      eventService.trackScreenView(currentRoute);
                                    }
                                  }}
                                >
                                  <AppContent />
                                </NavigationContainer>
                              </BugReportProvider>
                            </OnboardingProvider>
                          </NotificationProvider>
                        </MemberProfileProvider>
                        </FeatureGateProvider>
                        </ElderProvider>
                      </CommunityProvider>
                      </FeedProvider>
                      </WithdrawalWizardProvider>
                    </SavingsProvider>
                  </AdvanceProvider>
                </TrustProvider>
            </WalletProvider>
          </CirclesProvider>
        </CurrencyProvider>
        </PaymentProvider>
      </PreferencesProvider>
    </AuthProvider>
    </ScrollDiagnosticProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
