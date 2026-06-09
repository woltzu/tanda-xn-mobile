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
  createNavigationContainerRef,
} from "@react-navigation/native";
import * as Linking from "expo-linking";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableWithoutFeedback, AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { eventService } from "./services/EventService";
import { PreferencesProvider } from "./context/PreferencesContext";
import { useInactivityLock } from "./hooks/useInactivityLock";
import LockScreen from "./screens/LockScreen";
import { CirclesProvider } from "./context/CirclesContext";
import { WalletProvider } from "./context/WalletContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import SplashScreen from "./screens/SplashScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import OTPScreen from "./screens/OTPScreen";
import EmailVerificationScreen from "./screens/EmailVerificationScreen";
import AuthCallbackScreen from "./screens/AuthCallbackScreen";
import DashboardScreen from "./screens/DashboardScreen";
import WalletScreen from "./screens/WalletScreen";
import CirclesScreen from "./screens/CirclesScreen";
import ProfileScreen from "./screens/ProfileScreen";
import PersonalInfoScreen from "./screens/PersonalInfoScreen";
import LanguageRegionScreen from "./screens/LanguageRegionScreen";
import CreateCircleStartScreen from "./screens/CreateCircleStartScreen";
import QuickCircleScreen from "./screens/QuickCircleScreen";
import ReferralScreen from "./screens/ReferralScreen";
import CreateCircleDetailsScreen from "./screens/CreateCircleDetailsScreen";
import CreateCircleScheduleScreen from "./screens/CreateCircleScheduleScreen";
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
import SendMoneyScreen from "./screens/SendMoneyScreen";
import WalletTransactionSuccessScreen from "./screens/WalletTransactionSuccessScreen";
import XnScoreDashboardScreen from "./screens/XnScoreDashboardScreen";
import XnScoreHistoryScreen from "./screens/XnScoreHistoryScreen";
import VouchMemberScreen from "./screens/VouchMemberScreen";
import HonorSystemScreen from "./screens/HonorSystemScreen";
import AccessRestrictedScreen from "./screens/AccessRestrictedScreen";
import RemittanceScreen from "./screens/RemittanceScreen";
import DomesticSendMoneyScreen from "./screens/DomesticSendMoneyScreen";
import AdvanceHubScreen from "./screens/AdvanceHubScreen";
import RequestAdvanceScreen from "./screens/RequestAdvanceScreen";
import AdvanceDetailsScreen from "./screens/AdvanceDetailsScreen";
import AdvanceRepaymentScreen from "./screens/AdvanceRepaymentScreen";
import AdvanceExplanationScreen from "./screens/AdvanceExplanationScreen";
import LoanMarketplaceScreen from "./screens/LoanMarketplaceScreen";
import LoanApplicationScreen from "./screens/LoanApplicationScreen";
import LoanDetailsScreen from "./screens/LoanDetailsScreen";
import LoanCalculatorScreen from "./screens/LoanCalculatorScreen";
import LoanDashboardScreen from "./screens/LoanDashboardScreen";
import GoalsHubScreen from "./screens/GoalsHubScreen";
import CreateGoalScreen from "./screens/CreateGoalScreen";
import GoalDetailsScreen from "./screens/GoalDetailsScreen";
import DepositToGoalScreen from "./screens/DepositToGoalScreen";
import WithdrawFromGoalScreen from "./screens/WithdrawFromGoalScreen";
import EditGoalScreen from "./screens/EditGoalScreen";
import SavedRecipientsScreen from "./screens/SavedRecipientsScreen";
import AddRecipientScreen from "./screens/AddRecipientScreen";
import CommunityBrowserScreen from "./screens/CommunityBrowserScreen";
import CommunityHubScreen from "./screens/CommunityHubScreen";
import MyCommunitiesScreen from "./screens/MyCommunitiesScreen";
import CreateCommunityScreen from "./screens/CreateCommunityScreen";
import BecomeElderScreen from "./screens/BecomeElderScreen";
import HonorScoreOverviewScreen from "./screens/HonorScoreOverviewScreen";
import VouchSystemScreen from "./screens/VouchSystemScreen";
import MediationCaseScreen from "./screens/MediationCaseScreen";
import ElderTrainingHubScreen from "./screens/ElderTrainingHubScreen";
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
import MediationToolsScreen from "./screens/MediationToolsScreen";
import AuditTrailScreen from "./screens/AuditTrailScreen";
import SelectCircleContributionScreen from "./screens/SelectCircleContributionScreen";
import { XnScoreProvider } from "./context/XnScoreContext";
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
import ScoreBreakdownScreen from "./screens/ScoreBreakdownScreen";
import CreditProfileScreen from "./screens/CreditProfileScreen";
import DefaultRecoveryScreen from "./screens/DefaultRecoveryScreen";
import DefaultDetailScreen from "./screens/DefaultDetailScreen";
import LateContributionDetailScreen from "./screens/LateContributionDetailScreen";
import CircleVotingScreen from "./screens/CircleVotingScreen";
import GraduatedEntryScreen from "./screens/GraduatedEntryScreen";
import KYCVerificationScreen from "./screens/KYCVerificationScreen";
import EarlyInterventionScreen from "./screens/EarlyInterventionScreen";
import CrossCircleLendingScreen from "./screens/CrossCircleLendingScreen";
import DynamicPayoutScreen from "./screens/DynamicPayoutScreen";
import LegalDocumentsScreen from "./screens/LegalDocumentsScreen";
import CircleVisualizerScreen from "./screens/CircleVisualizerScreen";
// Dream Feed Screens
import DreamFeedScreen from "./screens/DreamFeedScreen";
import CreateDreamPostScreen from "./screens/CreateDreamPostScreen";
import PostDetailScreen from "./screens/PostDetailScreen";
import DreamPostCommentsScreen from "./screens/DreamPostCommentsScreen";
import UserDreamProfileScreen from "./screens/UserDreamProfileScreen";
import FeedSettingsScreen from "./screens/FeedSettingsScreen";
import SupportDreamScreen from "./screens/SupportDreamScreen";
// Community Sub-screens
import NearYouScreen from "./screens/NearYouScreen";
import NewArrivalsScreen from "./screens/NewArrivalsScreen";
import GatheringsScreen from "./screens/GatheringsScreen";
import CreateGatheringScreen from "./screens/CreateGatheringScreen";
import CommunityMemoryScreen from "./screens/CommunityMemoryScreen";
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
import TripDetailScreen from "./screens/TripDetailScreen";
import MemberTripDashboardScreen from "./screens/MemberTripDashboardScreen";
// Trip Organizer Screens (9 screens: organizer + participant)
import OrganizerTripListScreen from "./screens/OrganizerTripListScreen";
import CreateTripWizardScreen from "./screens/CreateTripWizardScreen";
import OrganizerTripDashboardScreen from "./screens/OrganizerTripDashboardScreen";
import ItineraryBuilderScreen from "./screens/ItineraryBuilderScreen";
import ParticipantManagerScreen from "./screens/ParticipantManagerScreen";
import ParticipantDetailScreen from "./screens/ParticipantDetailScreen";
import TripPublicPageScreen from "./screens/TripPublicPageScreen";
import MyTripStatusScreen from "./screens/MyTripStatusScreen";
import DocumentSubmissionScreen from "./screens/DocumentSubmissionScreen";
import TripPaymentScreen from "./screens/TripPaymentScreen";
import TripPublishSuccessScreen from "./screens/TripPublishSuccessScreen";
import ActivityEditorScreen from "./screens/ActivityEditorScreen";
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
import AccountTiersExplainedScreen from "./screens/AccountTiersExplainedScreen";
import IDVerificationStartScreen from "./screens/IDVerificationStartScreen";
import DocumentUploadScreen from "./screens/DocumentUploadScreen";
import Tier2SuccessScreen from "./screens/Tier2SuccessScreen";
import VerificationHubScreen from "./screens/VerificationHubScreen";
import LimitedModeScreen from "./screens/LimitedModeScreen";
import ITINPendingScreen from "./screens/ITINPendingScreen";
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
import AdvanceExplanationV2Screen from "./screens/AdvanceExplanationV2Screen";
import SmartCalculatorScreen from "./screens/SmartCalculatorScreen";
import ApplicationFlowScreen from "./screens/ApplicationFlowScreen";
import AdvanceStatusDashboardScreen from "./screens/AdvanceStatusDashboardScreen";
import AdvanceDetailsV2Screen from "./screens/AdvanceDetailsV2Screen";
import AdvanceHistoryScreen from "./screens/AdvanceHistoryScreen";
import AdvanceApprovalScreen from "./screens/AdvanceApprovalScreen";
import AdvanceDisbursementScreen from "./screens/AdvanceDisbursementScreen";
import AdvanceAgreementScreen from "./screens/AdvanceAgreementScreen";
import EarlyRepaymentScreen from "./screens/EarlyRepaymentScreen";
import RepaymentConfirmScreen from "./screens/RepaymentConfirmScreen";
import PaymentFailedScreen from "./screens/PaymentFailedScreen";
import PaymentReminderScreen from "./screens/PaymentReminderScreen";
import HardshipRequestScreen from "./screens/HardshipRequestScreen";
import AdvanceRejectedScreen from "./screens/AdvanceRejectedScreen";
import AutopaySetupScreen from "./screens/AutopaySetupScreen";
import RateBreakdownScreen from "./screens/RateBreakdownScreen";
import AdvanceSettingsScreen from "./screens/AdvanceSettingsScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
// Goals flow (GOALS-001..015) — 13 screens translated from web JSX.
// GoalDetailV2 / GoalsHubV2 are redesigns that coexist with the existing
// GoalDetails / GoalsHub production screens (registered above); the rest are
// net-new. Reachable for testing via the __DEV__ "Goals V2" button on the
// Dashboard. Forward navigation between them is still TODO(goals-wiring).
import GoalsHubV2Screen from "./screens/GoalsHubV2Screen";
import GoalCategorySelectScreen from "./screens/GoalCategorySelectScreen";
import GoalTypeSelectScreen from "./screens/GoalTypeSelectScreen";
import GoalCreateScreen from "./screens/GoalCreateScreen";
import GoalSetupSuccessScreen from "./screens/GoalSetupSuccessScreen";
import GoalDetailV2Screen from "./screens/GoalDetailV2Screen";
import GoalAddMoneyScreen from "./screens/GoalAddMoneyScreen";
import GoalWithdrawScreen from "./screens/GoalWithdrawScreen";
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
  Signup: undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  OTP: { phone: string };
  EmailVerification: { email: string };
  AuthCallback: undefined;
  MainTabs: undefined;
  PersonalInfo: undefined;
  LanguageRegion: undefined;
  // Create Circle Flow
  CreateCircleStart: undefined;
  QuickCircle: undefined;
  Referral: undefined;
  SyncLobby: undefined;
  SyncRoom: { roomId: string; inviteCode?: string };
  DonationPreferences: undefined;
  HostDashboard: { roomId: string };
  CreateCircleDetails: {
    circleType: string;
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
  // Join Circle Flow
  JoinCircleConfirm: { circleId: string };
  JoinCircleSuccess: { circleId: string };
  // Contribution Flow
  SelectCircleContribution: undefined;
  MakeContribution: { circleId: string };
  ContributionSuccess: { circleId: string; amount: number; transactionId?: string };
  // Wallet Flow
  AddFunds: undefined;
  Withdraw: undefined;
  SendMoney: undefined;
  DomesticSendMoney: undefined;
  Remittance: undefined;
  WalletTransactionSuccess: {
    type: "add" | "withdraw" | "send";
    amount: number;
    method: string;
    recipientName?: string;
    transactionId: string;
  };
  // XnScore Flow
  XnScoreDashboard: undefined;
  XnScoreHistory: undefined;
  // Trust & Honor System
  VouchMember: undefined;
  HonorSystem: undefined;
  AccessRestricted: {
    type: string;
    requiredScore?: number;
    circleId?: string;
  };
  // Advance on Future Payout Flow
  AdvanceHub: undefined;
  RequestAdvance: { payoutId: string };
  AdvanceDetails: { advanceId: string };
  AdvanceRepayment: { advanceId: string };
  AdvanceExplanation: undefined;
  // Loan Marketplace Flow
  LoanMarketplace: undefined;
  LoanApplication: { productId: string };
  LoanDetails: { loanId: string };
  LoanCalculator: undefined;
  LoanDashboard: undefined;
  // Savings Goals Flow
  GoalsHub: undefined;
  CreateGoal: { goalType?: string };
  GoalDetails: { goalId: string };
  DepositToGoal: { goalId: string };
  WithdrawFromGoal: { goalId: string };
  EditGoal: { goalId: string };
  EditStore: { storeId: string };
  // Remittance Recipients Flow
  SavedRecipients: undefined;
  AddRecipient: { returnTo?: string };
  // Community Flow
  CommunityBrowser: undefined;
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
  // Join Circle by Code Flow
  JoinCircleByCode: undefined;
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
  LinkedAccounts: undefined;
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
  // Trip Circle Flow
  ProviderDiscovery: undefined;
  ProviderProfileSetup: undefined;
  ProviderVerification: undefined;
  CreateTripListing: undefined;
  ProviderTripDashboard: undefined;
  TripDetail: { tripId: string };
  MemberTripDashboard: { tripId: string };
  // Trip Organizer Screens
  OrganizerTripList: undefined;
  CreateTripWizard: { tripId?: string; initialStep?: number };
  OrganizerTripDashboard: { tripId: string };
  ItineraryBuilder: { tripId: string };
  ParticipantManager: { tripId: string };
  ParticipantDetail: { tripId: string; participantId: string };
  TripPublicPage: { slug?: string; tripId?: string };
  MyTripStatus: { tripId: string };
  DocumentSubmission: { tripId: string; participantId: string; fieldKey: string };
  TripPayment: { tripId: string; participantId: string };
  TripPublishSuccess: { tripName?: string; destination?: string; startDate?: string; endDate?: string; tripId: string };
  ActivityEditor: { tripId: string; dayId?: string; activityId?: string; existingData?: any };
  // Feature Screens (AI Engines + Circle Management)
  StressScoreDashboard: undefined;
  MoodInsights: undefined;
  DiscoverCircles: undefined;
  ConflictAlert: { circleId: string };
  InsurancePool: { circleId: string };
  SubstitutePool: undefined;
  CreditReport: undefined;
  DecisionHistory: undefined;
  AIJobsHealth: undefined;
  PartialContribution: { circleId: string; cycleId?: string };
  PositionSwap: { circleId: string };
  CycleTimeline: { circleId: string };
  ScoreBreakdown: undefined;
  CreditProfile: undefined;
  DefaultRecovery: undefined;
  DefaultDetail: { defaultId: string };
  LateContributionDetail: { lateContributionId: string };
  CircleVoting: { circleId: string };
  GraduatedEntry: undefined;
  KYCVerification: undefined;
  EarlyIntervention: undefined;
  CrossCircleLending: undefined;
  DynamicPayout: { circleId: string };
  LegalDocuments: undefined;
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
  AdvanceExplanationV2: { user?: object } | undefined;
  SmartCalculator:
    | {
        advanceType?: "contribution" | "quick" | "flex";
        user?: object;
        upcomingPayout?: object;
      }
    | undefined;
  ApplicationFlow:
    | {
        advanceType?: string;
        amount?: number;
        term?: number;
        rate?: number;
        fee?: number;
        total?: number;
        upcomingPayouts?: object[];
        advanceDetails?: object;
      }
    | undefined;
  AdvanceStatusDashboard:
    | {
        user?: object;
        activeAdvances?: object[];
        totalAdvanced?: number;
        totalDue?: number;
      }
    | undefined;
  AdvanceDetailsV2: { advanceId?: string; advance?: object } | undefined;
  AdvanceHistory:
    | {
        pastAdvances?: object[];
        totalAdvanced?: number;
        totalRepaid?: number;
        averageRepayTime?: number;
      }
    | undefined;
  AdvanceApproval:
    | {
        advance?: object;
        advanceId?: string;
        amount?: number;
        total?: number;
        payoutId?: string;
      }
    | undefined;
  AdvanceDisbursement:
    | {
        advanceAmount?: number;
        userBankAccounts?: object[];
        walletBalance?: number;
      }
    | undefined;
  AdvanceAgreement:
    | {
        advance?: object;
        agreementDate?: string;
        userName?: string;
        advanceId?: string;
      }
    | undefined;
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
  AdvanceRejected: { rejection?: object; improvements?: object[]; advanceId?: string } | undefined;
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
  // Goals flow (GOALS-001..015). Params are intentionally loose — each
  // screen reads a richer locally-typed RouteProp internally with sensible
  // defaults, so these entries exist only so navigate() call sites and the
  // navigator typing resolve. goalId is the common forward-key for wiring.
  GoalsHubV2: undefined;
  GoalCategorySelect: undefined;
  GoalTypeSelect: { category?: object } | undefined;
  GoalCreate: { goalType?: object; availableCircles?: object[] } | undefined;
  GoalSetupSuccess: { goal?: object } | undefined;
  GoalDetailV2: { goalId?: string; goal?: object } | undefined;
  GoalAddMoney: { goalId?: string; goal?: object } | undefined;
  GoalWithdraw: { goalId?: string; goal?: object } | undefined;
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

// Navigation ref so the SyncStream deep-link handler in App's effect
// can call .navigate() without needing the useNavigation hook (which
// is only available to children of NavigationContainer).
const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="CircleDetail" component={CircleDetailScreen} />
      <HomeStack.Screen name="GroupChat" component={GroupChatScreen} options={{ headerShown: false }} />
      <HomeStack.Screen name="SendMoney" component={SendMoneyScreen} />
      <HomeStack.Screen name="DomesticSendMoney" component={DomesticSendMoneyScreen} />
      <HomeStack.Screen name="Remittance" component={RemittanceScreen} />
      <HomeStack.Screen name="GoalsHub" component={GoalsHubScreen} />
      <HomeStack.Screen name="CreateGoal" component={CreateGoalScreen} />
      <HomeStack.Screen name="GoalDetails" component={GoalDetailsScreen} />
      <HomeStack.Screen name="DepositToGoal" component={DepositToGoalScreen} />
      <HomeStack.Screen name="WithdrawFromGoal" component={WithdrawFromGoalScreen} />
      <HomeStack.Screen name="EditGoal" component={EditGoalScreen} />
      <HomeStack.Screen name="AdvanceHub" component={AdvanceHubScreen} />
      <HomeStack.Screen name="RequestAdvance" component={RequestAdvanceScreen} />
      <HomeStack.Screen name="AdvanceDetails" component={AdvanceDetailsScreen} />
      <HomeStack.Screen name="AdvanceRepayment" component={AdvanceRepaymentScreen} />
      <HomeStack.Screen name="AdvanceExplanation" component={AdvanceExplanationScreen} />
      <HomeStack.Screen name="LoanMarketplace" component={LoanMarketplaceScreen} />
      <HomeStack.Screen name="LoanApplication" component={LoanApplicationScreen} />
      <HomeStack.Screen name="LoanDetails" component={LoanDetailsScreen} />
      <HomeStack.Screen name="LoanCalculator" component={LoanCalculatorScreen} />
      <HomeStack.Screen name="LoanDashboard" component={LoanDashboardScreen} />
      <HomeStack.Screen name="XnScoreDashboard" component={XnScoreDashboardScreen} />
      <HomeStack.Screen name="XnScoreHistory" component={XnScoreHistoryScreen} />
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
      <HomeStack.Screen name="BecomeElder" component={BecomeElderScreen} />
      <HomeStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <HomeStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <HomeStack.Screen name="MediationCase" component={MediationCaseScreen} />
      <HomeStack.Screen name="ElderTrainingHub" component={ElderTrainingHubScreen} />
      <HomeStack.Screen name="AddFunds" component={AddFundsScreen} />
      <HomeStack.Screen name="WalletMain" component={WalletScreen} />
      <HomeStack.Screen name="Withdraw" component={WithdrawScreen} />
      <HomeStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
      <HomeStack.Screen name="QuickCircle" component={QuickCircleScreen} />
      <HomeStack.Screen name="Referral" component={ReferralScreen} />
      <HomeStack.Screen name="DonationPreferences" component={DonationPreferencesScreen} />
      <HomeStack.Screen name="CreateCircleDetails" component={CreateCircleDetailsScreen} />
      <HomeStack.Screen name="CreateCircleSchedule" component={CreateCircleScheduleScreen} />
      <HomeStack.Screen name="CreateCircleInvite" component={CreateCircleInviteScreen} />
      <HomeStack.Screen name="CreateCircleSuccess" component={CreateCircleSuccessScreen} />
      {/* Conflict Prediction admin/Elder dashboard. Also registered in
          CirclesStack; duplicated here so the __DEV__ debug button on the
          Dashboard (Home tab) can navigate without a tab switch. */}
      <HomeStack.Screen name="ConflictAlert" component={ConflictAlertScreen} />
      {/* Marketplace (Migration 057) */}
      <HomeStack.Screen name="Marketplace" component={MarketplaceScreen} />
      <HomeStack.Screen name="StoreDetail" component={StoreDetailScreen} />
      <HomeStack.Screen name="StoreApplication" component={StoreApplicationScreen} />
      <HomeStack.Screen name="BulkInvites" component={BulkInvitesScreen} />
      <HomeStack.Screen name="BookService" component={BookServiceScreen} />
      <HomeStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
      <HomeStack.Screen name="MarketInsight" component={MarketInsightScreen} />
      {/* Trip Circle Screens */}
      <HomeStack.Screen name="ProviderDiscovery" component={ProviderDiscoveryScreen} />
      <HomeStack.Screen name="ProviderProfileSetup" component={ProviderProfileSetupScreen} />
      <HomeStack.Screen name="ProviderVerification" component={ProviderVerificationScreen} />
      <HomeStack.Screen name="CreateTripListing" component={CreateTripListingScreen} />
      <HomeStack.Screen name="ProviderTripDashboard" component={ProviderTripDashboardScreen} />
      <HomeStack.Screen name="TripDetail" component={TripDetailScreen} />
      <HomeStack.Screen name="MemberTripDashboard" component={MemberTripDashboardScreen} />
      {/* Trip Organizer Screens */}
      <HomeStack.Screen name="OrganizerTripList" component={OrganizerTripListScreen} />
      <HomeStack.Screen name="CreateTripWizard" component={CreateTripWizardScreen} />
      <HomeStack.Screen name="OrganizerTripDashboard" component={OrganizerTripDashboardScreen} />
      <HomeStack.Screen name="ItineraryBuilder" component={ItineraryBuilderScreen} />
      <HomeStack.Screen name="ParticipantManager" component={ParticipantManagerScreen} />
      <HomeStack.Screen name="ParticipantDetail" component={ParticipantDetailScreen} />
      <HomeStack.Screen name="TripPublicPage" component={TripPublicPageScreen} />
      <HomeStack.Screen name="MyTripStatus" component={MyTripStatusScreen} />
      <HomeStack.Screen name="DocumentSubmission" component={DocumentSubmissionScreen} />
      <HomeStack.Screen name="TripPayment" component={TripPaymentScreen} />
      <HomeStack.Screen name="TripPublishSuccess" component={TripPublishSuccessScreen} />
      <HomeStack.Screen name="ActivityEditor" component={ActivityEditorScreen} />
      {/* AI / Financial Insight Screens */}
      <HomeStack.Screen name="StressScoreDashboard" component={StressScoreDashboardScreen} />
      <HomeStack.Screen name="MoodInsights" component={MoodInsightsScreen} />
      <HomeStack.Screen name="DiscoverCircles" component={DiscoverCirclesScreen} />
      {/* DynamicPayoutScreen also registered in CirclesStack at line 931;
          duplicated here so the Dashboard debug chip + CreateCircleSuccess
          screen (both in HomeStack) can navigate without a tab switch. */}
      <HomeStack.Screen name="DynamicPayout" component={DynamicPayoutScreen} />
      {/* InsurancePoolScreen also registered in CirclesStack — duplicated
          here for the Dashboard debug chip (Phase D3 of feat(insurance)). */}
      <HomeStack.Screen name="InsurancePool" component={InsurancePoolScreen} />
      <HomeStack.Screen name="SubstitutePool" component={SubstitutePoolScreen} />
      <HomeStack.Screen name="CreditReport" component={CreditReportScreen} />
      <HomeStack.Screen name="DecisionHistory" component={DecisionHistoryScreen} />
      <HomeStack.Screen name="AIJobsHealth" component={AIJobsHealthScreen} />
      <HomeStack.Screen name="EarlyIntervention" component={EarlyInterventionScreen} />
      <HomeStack.Screen name="ScoreBreakdown" component={ScoreBreakdownScreen} />
      <HomeStack.Screen name="CreditProfile" component={CreditProfileScreen} />
      <HomeStack.Screen name="GraduatedEntry" component={GraduatedEntryScreen} />
      <HomeStack.Screen name="CrossCircleLending" component={CrossCircleLendingScreen} />
      <HomeStack.Screen name="DefaultRecovery" component={DefaultRecoveryScreen} />
      <HomeStack.Screen name="DefaultDetail" component={DefaultDetailScreen} />
      <HomeStack.Screen name="LateContributionDetail" component={LateContributionDetailScreen} />
      <HomeStack.Screen name="KYCVerification" component={KYCVerificationScreen} />
      <HomeStack.Screen name="LegalDocuments" component={LegalDocumentsScreen} />
      {/* Interest-First KYC flow (Phase KYC-2). Entered from the
          Dashboard interest card → UnlockInterestPrompt, then
          branches per VerificationOptions. All screens live in
          HomeStack so the back-button trail leads cleanly back to
          Dashboard. OnboardingWelcome, AccountTiersExplained, and
          VerificationHub from the prior generic KYC flow are
          intentionally NOT registered here — they're unreachable in
          the new flow and stay as orphans until a separate cleanup
          PR with red-emoji approval. */}
      <HomeStack.Screen name="UnlockInterestPrompt" component={UnlockInterestPromptScreen} />
      <HomeStack.Screen name="InterestUnlockedSuccess" component={InterestUnlockedSuccessScreen} />
      <HomeStack.Screen name="VerificationOptions" component={VerificationOptionsScreen} />
      <HomeStack.Screen name="TaxIDEntry" component={TaxIDEntryScreen} />
      <HomeStack.Screen name="ITINEducation" component={ITINEducationScreen} />
      <HomeStack.Screen name="ITINApplicationHelp" component={ITINApplicationHelpScreen} />
      <HomeStack.Screen name="ITINPending" component={ITINPendingScreen} />
      <HomeStack.Screen name="LimitedMode" component={LimitedModeScreen} />
      <HomeStack.Screen name="InternationalVerification" component={InternationalVerificationScreen} />
      <HomeStack.Screen name="IDVerificationStart" component={IDVerificationStartScreen} />
      <HomeStack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      {/* Advance Payout V2 flow (Stage 8). Entered (for now) via the
          __DEV__ "Advance V2" button on the Dashboard → AdvanceHubV2.
          The 3 *V2 screens coexist with the existing non-V2 Advance
          screens registered higher up; reconciliation is a later
          decision. AdminDashboard is staff-only and not linked from
          any user menu. */}
      <HomeStack.Screen name="AdvanceHubV2" component={AdvanceHubV2Screen} />
      <HomeStack.Screen name="AdvanceExplanationV2" component={AdvanceExplanationV2Screen} />
      <HomeStack.Screen name="SmartCalculator" component={SmartCalculatorScreen} />
      <HomeStack.Screen name="ApplicationFlow" component={ApplicationFlowScreen} />
      <HomeStack.Screen name="AdvanceStatusDashboard" component={AdvanceStatusDashboardScreen} />
      <HomeStack.Screen name="AdvanceDetailsV2" component={AdvanceDetailsV2Screen} />
      <HomeStack.Screen name="AdvanceHistory" component={AdvanceHistoryScreen} />
      <HomeStack.Screen name="AdvanceApproval" component={AdvanceApprovalScreen} />
      <HomeStack.Screen name="AdvanceDisbursement" component={AdvanceDisbursementScreen} />
      <HomeStack.Screen name="AdvanceAgreement" component={AdvanceAgreementScreen} />
      <HomeStack.Screen name="EarlyRepayment" component={EarlyRepaymentScreen} />
      <HomeStack.Screen name="RepaymentConfirm" component={RepaymentConfirmScreen} />
      <HomeStack.Screen name="PaymentFailed" component={PaymentFailedScreen} />
      <HomeStack.Screen name="PaymentReminder" component={PaymentReminderScreen} />
      <HomeStack.Screen name="HardshipRequest" component={HardshipRequestScreen} />
      <HomeStack.Screen name="AdvanceRejected" component={AdvanceRejectedScreen} />
      <HomeStack.Screen name="AutopaySetup" component={AutopaySetupScreen} />
      <HomeStack.Screen name="RateBreakdown" component={RateBreakdownScreen} />
      <HomeStack.Screen name="AdvanceSettings" component={AdvanceSettingsScreen} />
      <HomeStack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      {/* Goals flow (GOALS-001..015). Entered (for now) via the __DEV__
          "Goals V2" button on the Dashboard → GoalsHubV2. GoalDetailV2 /
          GoalsHubV2 coexist with the existing GoalDetails / GoalsHub screens
          registered above; reconciliation is a later decision. */}
      <HomeStack.Screen name="GoalsHubV2" component={GoalsHubV2Screen} />
      <HomeStack.Screen name="GoalCategorySelect" component={GoalCategorySelectScreen} />
      <HomeStack.Screen name="GoalTypeSelect" component={GoalTypeSelectScreen} />
      <HomeStack.Screen name="GoalCreate" component={GoalCreateScreen} />
      <HomeStack.Screen name="GoalSetupSuccess" component={GoalSetupSuccessScreen} />
      <HomeStack.Screen name="GoalDetailV2" component={GoalDetailV2Screen} />
      <HomeStack.Screen name="GoalAddMoney" component={GoalAddMoneyScreen} />
      <HomeStack.Screen name="GoalWithdraw" component={GoalWithdrawScreen} />
      <HomeStack.Screen name="GoalLinkCircle" component={GoalLinkCircleScreen} />
      <HomeStack.Screen name="GoalMilestones" component={GoalMilestonesScreen} />
      <HomeStack.Screen name="GoalAchieved" component={GoalAchievedScreen} />
      <HomeStack.Screen name="GoalBItems" component={GoalBItemsScreen} />
      <HomeStack.Screen name="GoalStories" component={GoalStoriesScreen} />
      <HomeStack.Screen name="GoalActivity" component={GoalActivityScreen} />
      <HomeStack.Screen name="GoalEdit" component={GoalEditScreen} />
      {/* Dream Feed Screens (moved from Dreams tab) */}
      <HomeStack.Screen name="DreamFeed" component={DreamFeedScreen} />
      <HomeStack.Screen name="CreateDreamPost" component={CreateDreamPostScreen} />
      <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
      <HomeStack.Screen name="PostComments" component={DreamPostCommentsScreen} />
      <HomeStack.Screen name="UserDreamProfile" component={UserDreamProfileScreen} />
      <HomeStack.Screen name="FeedSettings" component={FeedSettingsScreen} />
      <HomeStack.Screen name="SupportDream" component={SupportDreamScreen} />
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
      <HomeStack.Screen name="HonorSystem" component={HonorSystemScreen} />
      {/* Community Sub-screens (reachable from Community tab too) */}
      <HomeStack.Screen name="NearYou" component={NearYouScreen} />
      <HomeStack.Screen name="NewArrivals" component={NewArrivalsScreen} />
      <HomeStack.Screen name="Gatherings" component={GatheringsScreen} />
      <HomeStack.Screen name="CreateGathering" component={CreateGatheringScreen} />
      <HomeStack.Screen name="CommunityMemory" component={CommunityMemoryScreen} />
      <HomeStack.Screen name="PostToCommunity" component={PostToCommunityScreen} />
    </HomeStack.Navigator>
  );
}

// Circles Tab Stack
function CirclesStackScreen() {
  return (
    <CirclesStack.Navigator screenOptions={{ headerShown: false }}>
      <CirclesStack.Screen name="CirclesMain" component={CirclesScreen} />
      <CirclesStack.Screen name="CircleDetail" component={CircleDetailScreen} />
      <CirclesStack.Screen name="GroupChat" component={GroupChatScreen} options={{ headerShown: false }} />
      <CirclesStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
      <CirclesStack.Screen name="QuickCircle" component={QuickCircleScreen} />
      <CirclesStack.Screen name="CreateCircleDetails" component={CreateCircleDetailsScreen} />
      <CirclesStack.Screen name="CreateCircleSchedule" component={CreateCircleScheduleScreen} />
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
      <CirclesStack.Screen name="PauseCircle" component={PauseCircleScreen} />
      <CirclesStack.Screen name="CloseCircle" component={CloseCircleScreen} />
      <CirclesStack.Screen name="ExportData" component={ExportDataScreen} />
      <CirclesStack.Screen name="AdminSettings" component={AdminSettingsScreen} />
      <CirclesStack.Screen name="ReportIssue" component={ReportIssueScreen} />
      <CirclesStack.Screen name="OversightDashboard" component={OversightDashboardScreen} />
      <CirclesStack.Screen name="MediationTools" component={MediationToolsScreen} />
      <CirclesStack.Screen name="AuditTrail" component={AuditTrailScreen} />
      {/* Circle Feature Screens */}
      <CirclesStack.Screen name="ConflictAlert" component={ConflictAlertScreen} />
      <CirclesStack.Screen name="InsurancePool" component={InsurancePoolScreen} />
      <CirclesStack.Screen name="PartialContribution" component={PartialContributionScreen} />
      <CirclesStack.Screen name="PositionSwap" component={PositionSwapScreen} />
      <CirclesStack.Screen name="CycleTimeline" component={CycleTimelineScreen} />
      <CirclesStack.Screen name="CircleVoting" component={CircleVotingScreen} />
      <CirclesStack.Screen name="DynamicPayout" component={DynamicPayoutScreen} />
      <CirclesStack.Screen name="CircleVisualizer" component={CircleVisualizerScreen} />
      {/* Trip Organizer Screens */}
      <CirclesStack.Screen name="OrganizerTripList" component={OrganizerTripListScreen} />
      <CirclesStack.Screen name="CreateTripWizard" component={CreateTripWizardScreen} />
      <CirclesStack.Screen name="OrganizerTripDashboard" component={OrganizerTripDashboardScreen} />
      <CirclesStack.Screen name="ItineraryBuilder" component={ItineraryBuilderScreen} />
      <CirclesStack.Screen name="ParticipantManager" component={ParticipantManagerScreen} />
      <CirclesStack.Screen name="ParticipantDetail" component={ParticipantDetailScreen} />
      <CirclesStack.Screen name="TripPublicPage" component={TripPublicPageScreen} />
      <CirclesStack.Screen name="MyTripStatus" component={MyTripStatusScreen} />
      <CirclesStack.Screen name="DocumentSubmission" component={DocumentSubmissionScreen} />
      <CirclesStack.Screen name="TripPayment" component={TripPaymentScreen} />
      <CirclesStack.Screen name="TripPublishSuccess" component={TripPublishSuccessScreen} />
      <CirclesStack.Screen name="ActivityEditor" component={ActivityEditorScreen} />
    </CirclesStack.Navigator>
  );
}

// Market Tab Stack — The Community Economy
function MarketStackScreen() {
  return (
    <MarketStack.Navigator screenOptions={{ headerShown: false }}>
      <MarketStack.Screen name="MarketMain" component={MarketplaceScreen} />
      <MarketStack.Screen name="StoreDetail" component={StoreDetailScreen} />
      <MarketStack.Screen name="StoreApplication" component={StoreApplicationScreen} />
      <MarketStack.Screen name="BulkInvites" component={BulkInvitesScreen} />
      <MarketStack.Screen name="BookService" component={BookServiceScreen} />
      <MarketStack.Screen name="OwnerDashboard" component={OwnerDashboardScreen} />
      <MarketStack.Screen name="MarketInsight" component={MarketInsightScreen} />
      {/* Trip Circle Screens */}
      <MarketStack.Screen name="ProviderDiscovery" component={ProviderDiscoveryScreen} />
      <MarketStack.Screen name="ProviderProfileSetup" component={ProviderProfileSetupScreen} />
      <MarketStack.Screen name="ProviderVerification" component={ProviderVerificationScreen} />
      <MarketStack.Screen name="CreateTripListing" component={CreateTripListingScreen} />
      <MarketStack.Screen name="ProviderTripDashboard" component={ProviderTripDashboardScreen} />
      <MarketStack.Screen name="TripDetail" component={TripDetailScreen} />
      <MarketStack.Screen name="MemberTripDashboard" component={MemberTripDashboardScreen} />
      {/* Trip Organizer Screens */}
      <MarketStack.Screen name="OrganizerTripList" component={OrganizerTripListScreen} />
      <MarketStack.Screen name="CreateTripWizard" component={CreateTripWizardScreen} />
      <MarketStack.Screen name="OrganizerTripDashboard" component={OrganizerTripDashboardScreen} />
      <MarketStack.Screen name="ItineraryBuilder" component={ItineraryBuilderScreen} />
      <MarketStack.Screen name="ParticipantManager" component={ParticipantManagerScreen} />
      <MarketStack.Screen name="ParticipantDetail" component={ParticipantDetailScreen} />
      <MarketStack.Screen name="TripPublicPage" component={TripPublicPageScreen} />
      <MarketStack.Screen name="MyTripStatus" component={MyTripStatusScreen} />
      <MarketStack.Screen name="DocumentSubmission" component={DocumentSubmissionScreen} />
      <MarketStack.Screen name="TripPayment" component={TripPaymentScreen} />
      <MarketStack.Screen name="TripPublishSuccess" component={TripPublishSuccessScreen} />
      <MarketStack.Screen name="ActivityEditor" component={ActivityEditorScreen} />
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
      <CommunityStack.Screen name="CommunityBrowser" component={CommunityBrowserScreen} />
      <CommunityStack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <CommunityStack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <CommunityStack.Screen name="MyCommunities" component={MyCommunitiesScreen} />
      <CommunityStack.Screen name="NearYou" component={NearYouScreen} />
      <CommunityStack.Screen name="NewArrivals" component={NewArrivalsScreen} />
      <CommunityStack.Screen name="Gatherings" component={GatheringsScreen} />
      <CommunityStack.Screen name="CreateGathering" component={CreateGatheringScreen} />
      <CommunityStack.Screen name="CommunityMemory" component={CommunityMemoryScreen} />
      <CommunityStack.Screen name="PostToCommunity" component={PostToCommunityScreen} />
      <CommunityStack.Screen name="ElderDashboard" component={ElderDashboardScreen} />
      <CommunityStack.Screen name="BecomeElder" component={BecomeElderScreen} />
      <CommunityStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <CommunityStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <CommunityStack.Screen name="MediationCase" component={MediationCaseScreen} />
      <CommunityStack.Screen name="ElderTrainingHub" component={ElderTrainingHubScreen} />
      {/* Profile accessible from avatar in community */}
      <CommunityStack.Screen name="ProfileMain" component={ProfileScreen} />
      <CommunityStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <CommunityStack.Screen name="Settings" component={SettingsMainScreen} />
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

  const { resetTimer } = useInactivityLock({
    onLock: lockApp,
    isAuthenticated,
    isLocked,
  });

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

  // If user is authenticated but locked, show lock screen
  if (isAuthenticated && isLocked) {
    return <LockScreen />;
  }

  // Wrap navigation in TouchableWithoutFeedback to reset timer on any touch
  return (
    <TouchableWithoutFeedback onPress={resetTimer} accessible={false}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" />
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
          <Stack.Screen name="Signup" component={SignupScreen} />
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
          <Stack.Screen name="MediationTools" component={MediationToolsScreen} />
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
    <SafeAreaProvider>
    <PreferencesProvider>
      <AuthProvider>
        <PaymentProvider>
        <CurrencyProvider>
          <CirclesProvider>
            <WalletProvider>
              <XnScoreProvider>
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
              </XnScoreProvider>
            </WalletProvider>
          </CirclesProvider>
        </CurrencyProvider>
        </PaymentProvider>
      </AuthProvider>
    </PreferencesProvider>
    </SafeAreaProvider>
  );
}
