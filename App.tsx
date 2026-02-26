import "react-native-gesture-handler";
import React, { useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, TouchableWithoutFeedback } from "react-native";
import Toast, { ToastType, registerToastHandler } from "./components/Toast";
import { AuthProvider, useAuth } from "./context/AuthContext";
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
import { CommunityProvider } from "./context/CommunityContext";
import { ElderProvider } from "./context/ElderContext";
import { NotificationProvider } from "./context/NotificationContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import CircleInviteScreen from "./screens/CircleInviteScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import { linkingConfig } from "./lib/deepLinking";
// Dream Feed imports
import { FeedProvider } from "./context/FeedContext";
import DreamFeedScreen from "./screens/DreamFeedScreen";
import CreateDreamPostScreen from "./screens/CreateDreamPostScreen";
import PostDetailScreen from "./screens/PostDetailScreen";
import DreamPostCommentsScreen from "./screens/DreamPostCommentsScreen";
import UserDreamProfileScreen from "./screens/UserDreamProfileScreen";
import FeedSettingsScreen from "./screens/FeedSettingsScreen";
import SupportDreamScreen from "./screens/SupportDreamScreen";

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
  // Savings Goals Flow
  GoalsHub: undefined;
  CreateGoal: { goalType?: string };
  GoalDetails: { goalId: string };
  DepositToGoal: { goalId: string };
  WithdrawFromGoal: { goalId: string };
  EditGoal: { goalId: string };
  // Remittance Recipients Flow
  SavedRecipients: undefined;
  AddRecipient: { returnTo?: string };
  // Community Flow
  CommunityBrowser: undefined;
  CommunityHub: { communityId: string };
  CreateCommunity: { parentId?: string } | undefined;
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
  // Dream Feed Flow
  DreamFeed: undefined;
  CreateDreamPost: undefined;
  PostDetail: { postId: string };
  PostComments: { postId: string };
  UserDreamProfile: { userId: string };
  FeedSettings: undefined;
  // Support Dream Flow
  SupportDream: {
    postId: string;
    authorName: string;
    authorAvatar?: string;
    goalName: string;
    goalEmoji: string;
    targetAmount: number;
    currentBalance: number;
  };
};

export type TabParamList = {
  Home: undefined;
  Dreams: undefined;
  Wallet: undefined;
  Circles: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const HomeStack = createStackNavigator();
const DreamsStack = createStackNavigator();
const WalletStack = createStackNavigator();
const CirclesStack = createStackNavigator();
const ProfileStack = createStackNavigator();

// Home Tab Stack - includes Dashboard and related screens
function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="Dashboard" component={DashboardScreen} />
      <HomeStack.Screen name="CircleDetail" component={CircleDetailScreen} />
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
      <HomeStack.Screen name="CommunityBrowser" component={CommunityBrowserScreen} />
      <HomeStack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <HomeStack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <HomeStack.Screen name="ElderDashboard" component={ElderDashboardScreen} />
      <HomeStack.Screen name="BecomeElder" component={BecomeElderScreen} />
      <HomeStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <HomeStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <HomeStack.Screen name="MediationCase" component={MediationCaseScreen} />
      <HomeStack.Screen name="ElderTrainingHub" component={ElderTrainingHubScreen} />
      <HomeStack.Screen name="AddFunds" component={AddFundsScreen} />
      <HomeStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
      <HomeStack.Screen name="CreateCircleDetails" component={CreateCircleDetailsScreen} />
      <HomeStack.Screen name="CreateCircleSchedule" component={CreateCircleScheduleScreen} />
      <HomeStack.Screen name="CreateCircleInvite" component={CreateCircleInviteScreen} />
      <HomeStack.Screen name="CreateCircleSuccess" component={CreateCircleSuccessScreen} />
      {/* Dream screens accessible from Dashboard widget */}
      <HomeStack.Screen name="PostDetail" component={PostDetailScreen} />
      <HomeStack.Screen name="PostComments" component={DreamPostCommentsScreen} />
      <HomeStack.Screen name="UserDreamProfile" component={UserDreamProfileScreen} />
      {/* Feed action screen reachable from PostDetail */}
      <HomeStack.Screen name="JoinCircleConfirm" component={JoinCircleConfirmScreen} />
    </HomeStack.Navigator>
  );
}

// Dreams Tab Stack
function DreamsStackScreen() {
  return (
    <DreamsStack.Navigator screenOptions={{ headerShown: false }}>
      <DreamsStack.Screen name="DreamFeed" component={DreamFeedScreen} />
      <DreamsStack.Screen name="CreateDreamPost" component={CreateDreamPostScreen} />
      <DreamsStack.Screen name="PostDetail" component={PostDetailScreen} />
      <DreamsStack.Screen name="PostComments" component={DreamPostCommentsScreen} />
      <DreamsStack.Screen name="UserDreamProfile" component={UserDreamProfileScreen} />
      <DreamsStack.Screen name="FeedSettings" component={FeedSettingsScreen} />
      {/* Screens reachable from feed actions */}
      <DreamsStack.Screen name="CreateGoal" component={CreateGoalScreen} />
      <DreamsStack.Screen name="XnScoreDashboard" component={XnScoreDashboardScreen} />
      <DreamsStack.Screen name="JoinCircleConfirm" component={JoinCircleConfirmScreen} />
      <DreamsStack.Screen name="SupportDream" component={SupportDreamScreen} />
      <DreamsStack.Screen name="WalletTransactionSuccess" component={WalletTransactionSuccessScreen} />
    </DreamsStack.Navigator>
  );
}

// Wallet Tab Stack
function WalletStackScreen() {
  return (
    <WalletStack.Navigator screenOptions={{ headerShown: false }}>
      <WalletStack.Screen name="WalletMain" component={WalletScreen} />
      <WalletStack.Screen name="AddFunds" component={AddFundsScreen} />
      <WalletStack.Screen name="Withdraw" component={WithdrawScreen} />
      <WalletStack.Screen name="SendMoney" component={SendMoneyScreen} />
      <WalletStack.Screen name="DomesticSendMoney" component={DomesticSendMoneyScreen} />
      <WalletStack.Screen name="Remittance" component={RemittanceScreen} />
      <WalletStack.Screen name="WalletTransactionSuccess" component={WalletTransactionSuccessScreen} />
      <WalletStack.Screen name="SavedRecipients" component={SavedRecipientsScreen} />
      <WalletStack.Screen name="AddRecipient" component={AddRecipientScreen} />
    </WalletStack.Navigator>
  );
}

// Circles Tab Stack
function CirclesStackScreen() {
  return (
    <CirclesStack.Navigator screenOptions={{ headerShown: false }}>
      <CirclesStack.Screen name="CirclesMain" component={CirclesScreen} />
      <CirclesStack.Screen name="CircleDetail" component={CircleDetailScreen} />
      <CirclesStack.Screen name="CreateCircleStart" component={CreateCircleStartScreen} />
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
    </CirclesStack.Navigator>
  );
}

// Profile Tab Stack
function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
      <ProfileStack.Screen name="LanguageRegion" component={LanguageRegionScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsMainScreen} />
      <ProfileStack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <ProfileStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <ProfileStack.Screen name="TwoFactorAuth" component={TwoFactorAuthScreen} />
      <ProfileStack.Screen name="NotificationPrefs" component={NotificationPrefsScreen} />
      <ProfileStack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <ProfileStack.Screen name="LinkedAccounts" component={LinkedAccountsScreen} />
      <ProfileStack.Screen name="ActiveSessions" component={ActiveSessionsScreen} />
      <ProfileStack.Screen name="HelpCenter" component={HelpCenterScreen} />
      <ProfileStack.Screen name="AboutApp" component={AboutAppScreen} />
      <ProfileStack.Screen name="XnScoreDashboard" component={XnScoreDashboardScreen} />
      <ProfileStack.Screen name="XnScoreHistory" component={XnScoreHistoryScreen} />
      <ProfileStack.Screen name="VouchMember" component={VouchMemberScreen} />
      <ProfileStack.Screen name="HonorSystem" component={HonorSystemScreen} />
      <ProfileStack.Screen name="CommunityBrowser" component={CommunityBrowserScreen} />
      <ProfileStack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <ProfileStack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <ProfileStack.Screen name="ElderDashboard" component={ElderDashboardScreen} />
      <ProfileStack.Screen name="BecomeElder" component={BecomeElderScreen} />
      <ProfileStack.Screen name="HonorScoreOverview" component={HonorScoreOverviewScreen} />
      <ProfileStack.Screen name="VouchSystem" component={VouchSystemScreen} />
      <ProfileStack.Screen name="MediationCase" component={MediationCaseScreen} />
      <ProfileStack.Screen name="ElderTrainingHub" component={ElderTrainingHubScreen} />
    </ProfileStack.Navigator>
  );
}

// Component that wraps the app content and handles inactivity lock
function AppContent() {
  const { isAuthenticated, isLocked, lockApp } = useAuth();

  const { resetTimer } = useInactivityLock({
    onLock: lockApp,
    isAuthenticated,
    isLocked,
  });

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
          {/* Main App with Tab Bar */}
          <Stack.Screen name="MainTabs" component={MainTabs} />
          {/* Modal screens that should appear over tabs without tab bar */}
          <Stack.Screen name="AccessRestricted" component={AccessRestrictedScreen} />
          {/* Deep Link Invite Screens */}
          <Stack.Screen name="CircleInvite" component={CircleInviteScreen} />
        </Stack.Navigator>
      </View>
    </TouchableWithoutFeedback>
  );
}

function MainTabs() {
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
          height: 65,
        },
        tabBarActiveTintColor: "#00C6AE",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "home";

          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Dreams") {
            iconName = focused ? "sparkles" : "sparkles-outline";
          } else if (route.name === "Wallet") {
            iconName = focused ? "wallet" : "wallet-outline";
          } else if (route.name === "Circles") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
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
            // If there are screens in the stack, pop to the first screen
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
      <Tab.Screen name="Home" component={HomeStackScreen} />
      <Tab.Screen name="Dreams" component={DreamsStackScreen} />
      <Tab.Screen name="Wallet" component={WalletStackScreen} />
      <Tab.Screen name="Circles" component={CirclesStackScreen} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} />
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
    <PreferencesProvider>
      <AuthProvider>
        <CurrencyProvider>
          <CirclesProvider>
            <WalletProvider>
              <XnScoreProvider>
                <TrustProvider>
                  <AdvanceProvider>
                    <SavingsProvider>
                      <CommunityProvider>
                        <ElderProvider>
                          <NotificationProvider>
                            <OnboardingProvider>
                              <FeedProvider>
                                <NavigationContainer linking={linkingConfig}>
                                  <AppContent />
                                </NavigationContainer>
                                <Toast
                                  visible={toast.visible}
                                  message={toast.message}
                                  type={toast.type}
                                  duration={toast.duration}
                                  onDismiss={dismissToast}
                                />
                              </FeedProvider>
                            </OnboardingProvider>
                          </NotificationProvider>
                        </ElderProvider>
                      </CommunityProvider>
                    </SavingsProvider>
                  </AdvanceProvider>
                </TrustProvider>
              </XnScoreProvider>
            </WalletProvider>
          </CirclesProvider>
        </CurrencyProvider>
      </AuthProvider>
    </PreferencesProvider>
  );
}
