import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useXnScore } from "../context/XnScoreContext";
import { useWallet } from "../context/WalletContext";
import { useAdvance, LOAN_PRODUCTS, ELIGIBILITY_TIERS } from "../context/AdvanceContext";
import { useSavings } from "../context/SavingsContext";
import { useCommunity } from "../context/CommunityContext";
import { useElder } from "../context/ElderContext";
import { useNotifications } from "../context/NotificationContext";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabParamList } from "../App";
import { colors, radius, typography } from "../theme/tokens";
import { ProgressBar } from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";
import { OnboardingTooltipManager } from "../components/OnboardingTooltip";
import { CommunitySuggestionBubble } from "../components/CommunitySuggestions";
import { ProfileCompletionCard, OnboardingProgressSteps } from "../components/ProfileCompletionCard";

type DashboardScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, "Home">,
  StackNavigationProp<RootStackParamList>
>;

// No mock data - new users see clean slate with $0 balances

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user, signOut } = useAuth();
  const { myCircles } = useCircles();
  const { score } = useXnScore();
  const { balance: walletBalance } = useWallet();
  const {
    getAdvanceTier,
    getTierInfo,
    activeLoans: activeAdvances,
    getTotalOutstanding,
    getEligibilityTier
  } = useAdvance();
  const {
    getTotalSavings,
    getTotalInterestEarned,
    getActiveGoals
  } = useSavings();
  const { myCommunities } = useCommunity();
  const {
    isElder,
    elderProfile,
    elderStats,
    getHonorScoreTier,
    getElderTierInfo,
  } = useElder();
  const { unreadCount } = useNotifications();
  const {
    isOnboardingComplete,
    profileCompletion,
    suggestedCommunities,
    pendingInvite,
    completeStep,
  } = useOnboarding();

  // Get savings data
  const activeGoals = getActiveGoals();
  const totalSavings = getTotalSavings();

  // Get loan eligibility
  const eligibilityTierKey = getEligibilityTier(score);
  const eligibilityTier = ELIGIBILITY_TIERS[eligibilityTierKey];

  // Calculate advance eligibility
  const advanceTier = getAdvanceTier(score);
  const tierInfo = getTierInfo(advanceTier);

  // Combine circles for display
  const displayCircles = myCircles.map(circle => ({
    id: circle.id,
    name: circle.name,
    emoji: circle.emoji,
    members: circle.currentMembers,
    contribution: circle.amount,
    frequency: circle.frequency.charAt(0).toUpperCase() + circle.frequency.slice(1),
    myPosition: circle.myPosition || 1,
    progress: circle.progress,
  }));

  // Real data only - new users see $0 (clean slate)
  const circlesContributed = myCircles.reduce((sum, c) => sum + c.amount, 0);
  const goalsTotal = totalSavings;
  const actualWalletBalance = walletBalance;
  const totalWealth = actualWalletBalance + goalsTotal + circlesContributed;

  // Check if user is new (no data yet)
  const isNewUser = totalWealth === 0 && myCircles.length === 0 && activeGoals.length === 0 && myCommunities.length === 0;

  const handleSignOut = async () => {
    await signOut();
    (navigation as any).reset({
      index: 0,
      routes: [{ name: "Splash" }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1 — TOP HEADER (NAVY) - NO GRADIENT */}
        <View style={styles.header}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || "User"} 👋</Text>
            </View>

            <View style={styles.headerRight}>
              {/* Score Badge - Teal tint bg + teal text (allowed) */}
              <TouchableOpacity
                style={styles.scoreBadge}
                onPress={() => navigation.navigate("XnScoreDashboard")}
                accessibilityLabel={`XnScore ${Math.round(score * 10) / 10}`}
                accessibilityRole="button"
              >
                <Ionicons name="star" size={14} color={colors.accentTeal} />
                <Text style={styles.scoreText}>{Math.round(score * 10) / 10}</Text>
              </TouchableOpacity>

              {/* Bell Icon */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate("NotificationsInbox" as any)}
                accessibilityLabel="Notifications"
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={20} color={colors.textOnNavy} />
                {unreadCount > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.badgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Avatar */}
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={() => navigation.getParent()?.navigate("Profile")}
                accessibilityLabel="Profile"
                accessibilityRole="button"
              >
                <Text style={styles.avatarInitial}>
                  {(user?.name || "U").charAt(0)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Section */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
            <Text style={styles.balanceAmount}>
              ${totalWealth.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.balanceSubtext}>Here's where your money is:</Text>
          </View>
        </View>

        {/* SECTION 2 — BREAKDOWN ROW (NEUTRAL) */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownItem}>
            <Ionicons name="sync-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.breakdownValue}>
              ${circlesContributed.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.breakdownLabel}>In Circles</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownItem}>
            <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.breakdownValue}>
              ${goalsTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.breakdownLabel}>Goals</Text>
          </View>
          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownItem}>
            <Ionicons name="wallet-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.breakdownValue}>
              ${actualWalletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.breakdownLabel}>Available</Text>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* WELCOME CARD FOR NEW USERS */}
          {isNewUser && (
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeHeader}>
                <View style={styles.welcomeIconBg}>
                  <Ionicons name="sparkles" size={24} color={colors.accentTeal} />
                </View>
                <View style={styles.welcomeTextContainer}>
                  <Text style={styles.welcomeTitle}>Welcome to TandaXn!</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Let's build your financial future together
                  </Text>
                </View>
              </View>
              <View style={styles.welcomeSteps}>
                <View style={styles.welcomeStep}>
                  <View style={[styles.welcomeStepNumber, { backgroundColor: colors.tealTintBg }]}>
                    <Text style={[styles.welcomeStepNumberText, { color: colors.accentTeal }]}>1</Text>
                  </View>
                  <Text style={styles.welcomeStepText}>Add funds to your wallet</Text>
                </View>
                <View style={styles.welcomeStep}>
                  <View style={[styles.welcomeStepNumber, { backgroundColor: "#EEF2FF" }]}>
                    <Text style={[styles.welcomeStepNumberText, { color: "#6366F1" }]}>2</Text>
                  </View>
                  <Text style={styles.welcomeStepText}>Join or start a savings circle</Text>
                </View>
                <View style={styles.welcomeStep}>
                  <View style={[styles.welcomeStepNumber, { backgroundColor: colors.successBg }]}>
                    <Text style={[styles.welcomeStepNumberText, { color: colors.successText }]}>3</Text>
                  </View>
                  <Text style={styles.welcomeStepText}>Create goals & grow your savings</Text>
                </View>
              </View>
            </View>
          )}

          {/* SECTION 3 — PRIMARY ACTIONS ROW (ONE FILLED CTA ONLY) */}
          <View style={styles.actionsRow}>
            {/* Add Money - PRIMARY (filled teal) */}
            <TouchableOpacity
              style={styles.primaryActionBtn}
              onPress={() => navigation.navigate("AddFunds")}
              accessibilityLabel="Add Money"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color={colors.textWhite} />
              <Text style={styles.primaryActionText}>Add Money</Text>
            </TouchableOpacity>

            {/* Pay Circle - SECONDARY (outline teal) */}
            <TouchableOpacity
              style={styles.secondaryActionBtn}
              onPress={() => navigation.navigate("SelectCircleContribution" as any)}
              accessibilityLabel="Pay Circle"
              accessibilityRole="button"
            >
              <Ionicons name="sync-outline" size={18} color={colors.accentTeal} />
              <Text style={styles.secondaryActionText}>Pay Circle</Text>
            </TouchableOpacity>

            {/* Send Money - NEUTRAL (outline gray) */}
            <TouchableOpacity
              style={styles.neutralActionBtn}
              onPress={() => navigation.navigate("SendMoney")}
              accessibilityLabel="Send Money"
              accessibilityRole="button"
            >
              <Ionicons name="paper-plane-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.neutralActionText}>Send Money</Text>
            </TouchableOpacity>

            {/* Save for Goal - NEUTRAL (outline gray) */}
            <TouchableOpacity
              style={styles.neutralActionBtn}
              onPress={() => navigation.navigate("GoalsHub")}
              accessibilityLabel="Save for Goal"
              accessibilityRole="button"
            >
              <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.neutralActionText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* SECTION 4 — COMING UP (LIGHT TINT CARDS) */}
          {myCircles.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>COMING UP</Text>
              <View style={styles.comingUpRow}>
                {/* Payment Due - Warning tint */}
                <TouchableOpacity
                  style={[styles.comingUpCard, { backgroundColor: colors.warningBg }]}
                  onPress={() => navigation.navigate("SelectCircleContribution" as any)}
                  accessibilityLabel="Payment due"
                  accessibilityRole="button"
                >
                  <Text style={[styles.comingUpLabel, { color: colors.warningLabel }]}>
                    PAYMENT DUE
                  </Text>
                  <Text style={[styles.comingUpAmount, { color: colors.warningAmber }]}>
                    ${myCircles[0]?.amount || 0}
                  </Text>
                  <Text style={[styles.comingUpSub, { color: colors.warningLabel }]}>
                    {myCircles[0]?.name || "Circle"} • Next cycle
                  </Text>
                </TouchableOpacity>

                {/* Your Payout - Success tint */}
                <View style={[styles.comingUpCard, { backgroundColor: colors.successBg }]}>
                  <Text style={[styles.comingUpLabel, { color: colors.successLabel }]}>
                    YOUR PAYOUT
                  </Text>
                  <Text style={[styles.comingUpAmount, { color: colors.successText }]}>
                    ${(myCircles[0]?.amount * myCircles[0]?.currentMembers || 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.comingUpSub, { color: colors.successLabel }]}>
                    {myCircles[0]?.name || "Circle"} • Position #{myCircles[0]?.myPosition || 1}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GET STARTED</Text>
              <View style={styles.comingUpRow}>
                {/* Join a Circle CTA */}
                <TouchableOpacity
                  style={[styles.comingUpCard, { backgroundColor: colors.tealTintBg }]}
                  onPress={() => navigation.navigate("CreateCircleStart")}
                  accessibilityLabel="Start a circle"
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle" size={28} color={colors.accentTeal} style={{ marginBottom: 8 }} />
                  <Text style={[styles.comingUpLabel, { color: colors.accentTeal }]}>
                    START A CIRCLE
                  </Text>
                  <Text style={[styles.emptySubtitle, { marginTop: 4 }]}>
                    Save with friends & family
                  </Text>
                </TouchableOpacity>

                {/* Create a Goal CTA */}
                <TouchableOpacity
                  style={[styles.comingUpCard, { backgroundColor: "#EEF2FF" }]}
                  onPress={() => navigation.navigate("CreateGoal", {})}
                  accessibilityLabel="Create a goal"
                  accessibilityRole="button"
                >
                  <Ionicons name="flag" size={28} color="#6366F1" style={{ marginBottom: 8 }} />
                  <Text style={[styles.comingUpLabel, { color: "#6366F1" }]}>
                    SET A GOAL
                  </Text>
                  <Text style={[styles.emptySubtitle, { marginTop: 4 }]}>
                    Earn up to 7% APY
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PROFILE COMPLETION CARD - Show for new users */}
          {isNewUser && profileCompletion < 100 && (
            <ProfileCompletionCard compact />
          )}

          {/* COMMUNITY SUGGESTIONS - Show for new users without communities */}
          {myCommunities.length === 0 && suggestedCommunities.length > 0 && (
            <CommunitySuggestionBubble />
          )}

          {/* SECTION 4.5 — ADVANCE PAYOUT (REQUEST EARLY PAYOUT) */}
          {myCircles.length > 0 && advanceTier !== "none" && (
            <TouchableOpacity
              style={styles.advancePayoutCard}
              onPress={() => navigation.navigate("AdvanceHub" as any)}
              accessibilityLabel="Request advance payout"
              accessibilityRole="button"
            >
              <View style={styles.advancePayoutLeft}>
                <View style={styles.advancePayoutIconContainer}>
                  <Ionicons name="flash" size={24} color={colors.accentTeal} />
                </View>
                <View style={styles.advancePayoutInfo}>
                  <Text style={styles.advancePayoutTitle}>Advance Payout</Text>
                  <Text style={styles.advancePayoutDesc}>
                    Get up to ${Math.floor((myCircles[0]?.amount * myCircles[0]?.currentMembers || 0) * 0.8).toLocaleString()} early
                  </Text>
                  <Text style={styles.advancePayoutFee}>
                    Small fee applies • Instant to wallet
                  </Text>
                </View>
              </View>
              <View style={styles.advancePayoutRight}>
                <View style={[styles.advanceEligibleBadge, { backgroundColor: colors.tealTintBg }]}>
                  <Text style={[styles.advanceEligibleText, { color: colors.accentTeal }]}>Eligible</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          )}

          {/* SECTION 5 — WALLET CARD (UTILITY) */}
          <TouchableOpacity
            style={styles.walletCard}
            onPress={() => navigation.navigate("Wallet")}
            accessibilityLabel="View wallet"
            accessibilityRole="button"
          >
            <View style={styles.walletLeft}>
              <View style={styles.walletIconContainer}>
                <Ionicons name="card" size={20} color={colors.primaryNavy} />
              </View>
              <View>
                <Text style={styles.walletLabel}>Wallet</Text>
                <Text style={styles.walletCurrency}>Available • USD</Text>
              </View>
            </View>
            <View style={styles.walletRight}>
              <Text style={styles.walletAmount}>
                ${actualWalletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>

          {/* SECTION 6 — GOALS (TEAL ONLY FOR PROGRESS + APY PILL) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>My Goals</Text>
                <View style={[styles.apyPill, { backgroundColor: colors.tealTintBg }]}>
                  <Text style={[styles.apyPillText, { color: colors.accentTeal }]}>
                    Up to 7% APY
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("GoalsHub")}
                accessibilityLabel="See all goals"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {activeGoals.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyCard}
                onPress={() => navigation.navigate("CreateGoal", {})}
                accessibilityLabel="Create your first goal"
                accessibilityRole="button"
              >
                <View style={styles.emptyIcon}>
                  <Ionicons name="flag-outline" size={32} color={colors.accentTeal} />
                </View>
                <View style={styles.emptyText}>
                  <Text style={styles.emptyTitle}>Start saving for a goal</Text>
                  <Text style={styles.emptySubtitle}>Earn up to 7% APY on your savings</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
              </TouchableOpacity>
            ) : (
              activeGoals.slice(0, 2).map((goal: any) => {
                const progress = goal.progress || (goal.currentBalance / goal.targetAmount) * 100;
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.goalCard}
                    onPress={() => navigation.navigate("GoalsHub")}
                    accessibilityLabel={`Goal: ${goal.name}`}
                    accessibilityRole="button"
                  >
                    <View style={styles.goalIconContainer}>
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                      <Text style={styles.goalDetails}>
                        ${(goal.balance || goal.currentBalance || 0).toLocaleString()} of ${(goal.target || goal.targetAmount || 0).toLocaleString()}
                      </Text>
                      <ProgressBar
                        progress={progress}
                        height={3}
                        fillColor={colors.accentTeal}
                        trackColor={colors.border}
                        style={{ marginTop: 6 }}
                      />
                    </View>
                    <View style={styles.goalInterest}>
                      <Text style={styles.interestEarned}>
                        +${(goal.interest || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.interestStatus}>earned</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {activeGoals.length > 0 && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate("CreateGoal", {})}
                accessibilityLabel="Add new goal"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={16} color={colors.accentTeal} />
                <Text style={styles.addButtonText}>Add New Goal</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* SECTION 7 — CIRCLES (NEUTRAL, OPTIONAL TEAL PILL) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>My Circles</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.primaryNavy }]}>
                  <Text style={styles.countBadgeText}>{displayCircles.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("Circles")}
                accessibilityLabel="See all circles"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {displayCircles.length === 0 ? (
              <TouchableOpacity
                style={styles.emptyCard}
                onPress={() => navigation.navigate("CreateCircleStart")}
                accessibilityLabel="Create your first circle"
                accessibilityRole="button"
              >
                <View style={styles.emptyIcon}>
                  <Ionicons name="add-circle-outline" size={32} color={colors.accentTeal} />
                </View>
                <View style={styles.emptyText}>
                  <Text style={styles.emptyTitle}>Create your first circle</Text>
                  <Text style={styles.emptySubtitle}>Start saving with friends and family</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
              </TouchableOpacity>
            ) : (
              displayCircles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.circleCard}
                  onPress={() => navigation.navigate("CircleDetail", { circleId: circle.id })}
                  accessibilityLabel={`Circle: ${circle.name}`}
                  accessibilityRole="button"
                >
                  <View style={styles.circleIconContainer}>
                    <Text style={styles.circleEmoji}>{circle.emoji}</Text>
                  </View>
                  <View style={styles.circleInfo}>
                    <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
                    <Text style={styles.circleDetails}>
                      {circle.members} members • ${circle.contribution}/{circle.frequency.toLowerCase().slice(0, 2)}
                    </Text>
                    <ProgressBar
                      progress={circle.progress}
                      height={3}
                      fillColor={colors.accentTeal}
                      trackColor={colors.border}
                      style={{ marginTop: 6 }}
                    />
                  </View>
                  <View style={styles.circlePosition}>
                    <Text style={styles.positionNumber}>#{circle.myPosition}</Text>
                    {circle.myPosition <= 2 && (
                      <View style={[styles.turnPill, { backgroundColor: colors.tealTintBg }]}>
                        <Text style={[styles.turnPillText, { color: colors.accentTeal }]}>Your turn</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* SECTION 8 — COMMUNITIES (NEUTRAL) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>My Communities</Text>
                <View style={[styles.countBadge, { backgroundColor: "#6366F1" }]}>
                  <Text style={styles.countBadgeText}>{myCommunities.length}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("CommunityBrowser")}
                accessibilityLabel="See all communities"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>

            {myCommunities.length === 0 ? (
              <TouchableOpacity
                style={[styles.emptyCard, { borderColor: "#6366F1" }]}
                onPress={() => navigation.navigate("CommunityBrowser")}
                accessibilityLabel="Join a community"
                accessibilityRole="button"
              >
                <View style={[styles.emptyIcon, { backgroundColor: "rgba(99, 102, 241, 0.1)" }]}>
                  <Ionicons name="people-circle-outline" size={32} color="#6366F1" />
                </View>
                <View style={styles.emptyText}>
                  <Text style={styles.emptyTitle}>Join a Community</Text>
                  <Text style={styles.emptySubtitle}>Connect with diaspora, faith, and local groups</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6366F1" />
              </TouchableOpacity>
            ) : (
              myCommunities.slice(0, 2).map((community) => (
                <TouchableOpacity
                  key={community.id}
                  style={styles.circleCard}
                  onPress={() => navigation.navigate("CommunityHub", { communityId: community.id })}
                  accessibilityLabel={`Community: ${community.name}`}
                  accessibilityRole="button"
                >
                  <View style={[styles.circleIconContainer, { backgroundColor: "#EEF2FF" }]}>
                    <Text style={styles.circleEmoji}>{community.icon}</Text>
                  </View>
                  <View style={styles.circleInfo}>
                    <Text style={styles.circleName} numberOfLines={1}>{community.name}</Text>
                    <Text style={styles.circleDetails}>
                      {community.members.toLocaleString()} members • {community.circles} circles
                    </Text>
                  </View>
                  {community.role === "elder" && (
                    <View style={[styles.countBadge, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.countBadgeText, { color: colors.warningLabel }]}>ELDER</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* SECTION 9 — ELDER SYSTEM (AMBER ONLY HERE) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Elder System</Text>
                {isElder && elderProfile?.status === "approved" ? (
                  <View style={[styles.countBadge, { backgroundColor: colors.accentTeal }]}>
                    <Text style={styles.countBadgeText}>
                      {getElderTierInfo(elderProfile.tier).icon} {elderProfile.tier}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.countBadge, { backgroundColor: colors.textSecondary }]}>
                    <Text style={styles.countBadgeText}>Not Enrolled</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("ElderDashboard" as any)}
                accessibilityLabel="View elder dashboard"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>View</Text>
              </TouchableOpacity>
            </View>

            {isElder && elderProfile?.status === "approved" ? (
              <TouchableOpacity
                style={styles.elderCard}
                onPress={() => navigation.navigate("ElderDashboard" as any)}
                accessibilityLabel="Elder dashboard"
                accessibilityRole="button"
              >
                <View style={styles.elderTop}>
                  <View style={styles.elderScoreSection}>
                    {/* Reputation Score - AMBER (allowed here only) */}
                    <View style={[styles.elderScoreBadge, { backgroundColor: colors.warningBg }]}>
                      <Text style={[styles.elderScoreValue, { color: colors.warningAmber }]}>
                        {elderProfile.honorScore}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.elderScoreLabel}>Honor Score</Text>
                      <Text style={[styles.elderTierText, { color: colors.warningLabel }]}>
                        {getHonorScoreTier(elderProfile.honorScore).tier}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.elderStats}>
                    <TouchableOpacity style={styles.elderStatItem} onPress={() => navigation.navigate("ElderDashboard" as any)}>
                      <Text style={styles.elderStatValue}>{elderProfile.totalCasesResolved}</Text>
                      <Text style={styles.elderStatLabel}>Resolved</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.elderStatItem} onPress={() => navigation.navigate("VouchSystem" as any)}>
                      <Text style={styles.elderStatValue}>{elderStats?.activeVouches || 0}</Text>
                      <Text style={styles.elderStatLabel}>Vouches</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.emptyCard, { backgroundColor: colors.tealTintBg, borderColor: colors.accentTeal }]}
                onPress={() => navigation.navigate("BecomeElder" as any)}
                accessibilityLabel="Become an elder"
                accessibilityRole="button"
              >
                <View style={[styles.emptyIcon, { backgroundColor: "rgba(0, 198, 174, 0.15)" }]}>
                  <Ionicons name="shield" size={32} color={colors.accentTeal} />
                </View>
                <View style={styles.emptyText}>
                  <Text style={styles.emptyTitle}>Become an Elder</Text>
                  <Text style={styles.emptySubtitle}>Mediate disputes, vouch for members, earn rewards</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.accentTeal} />
              </TouchableOpacity>
            )}
          </View>

          {/* SECTION 10 — LOANS & FINANCING */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Loans & Financing</Text>
                <View style={[styles.premiumBadge, { backgroundColor: colors.tealTintBg }]}>
                  <Text style={[styles.premiumBadgeText, { color: colors.accentTeal }]}>Premium</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate("LoanMarketplace")}
                accessibilityLabel="Browse all loans"
                accessibilityRole="button"
              >
                <Text style={styles.seeAllText}>Browse All</Text>
              </TouchableOpacity>
            </View>

            {/* Loan Product Cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.loanCardsContainer}
            >
              {/* Quick Advance */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "small_advance" })}
                accessibilityLabel="Quick Advance"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: colors.tealTintBg }]}>
                  <Ionicons name="flash" size={24} color={colors.accentTeal} />
                </View>
                <Text style={styles.loanProductName}>Quick Advance</Text>
                <Text style={styles.loanProductRange}>$50 - $1,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: colors.tealTintBg }]}>
                  <Text style={[styles.loanRateBadgeText, { color: colors.accentTeal }]}>From 1%</Text>
                </View>
              </TouchableOpacity>

              {/* Education Loan */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "education_loan" })}
                accessibilityLabel="Education Loan"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="school" size={24} color="#6366F1" />
                </View>
                <Text style={styles.loanProductName}>Education Loan</Text>
                <Text style={styles.loanProductRange}>$500 - $5,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={[styles.loanRateBadgeText, { color: "#6366F1" }]}>From 4.49%</Text>
                </View>
              </TouchableOpacity>

              {/* Business Loan */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "business_loan" })}
                accessibilityLabel="Business Loan"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: "#FEF3C7" }]}>
                  <Ionicons name="briefcase" size={24} color="#D97706" />
                </View>
                <Text style={styles.loanProductName}>Business Loan</Text>
                <Text style={styles.loanProductRange}>$1,000 - $10,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Text style={[styles.loanRateBadgeText, { color: "#D97706" }]}>From 6.49%</Text>
                </View>
              </TouchableOpacity>

              {/* Vehicle Loan */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "vehicle_loan" })}
                accessibilityLabel="Vehicle Loan"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: "#DBEAFE" }]}>
                  <Ionicons name="car" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.loanProductName}>Vehicle Loan</Text>
                <Text style={styles.loanProductRange}>$2,000 - $15,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: "#DBEAFE" }]}>
                  <Text style={[styles.loanRateBadgeText, { color: "#3B82F6" }]}>From 4.49%</Text>
                </View>
              </TouchableOpacity>

              {/* Home Improvement */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "home_improvement" })}
                accessibilityLabel="Home Improvement"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: "#FCE7F3" }]}>
                  <Ionicons name="hammer" size={24} color="#EC4899" />
                </View>
                <Text style={styles.loanProductName}>Home Improvement</Text>
                <Text style={styles.loanProductRange}>$1,000 - $20,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: "#FCE7F3" }]}>
                  <Text style={[styles.loanRateBadgeText, { color: "#EC4899" }]}>From 5.49%</Text>
                </View>
              </TouchableOpacity>

              {/* Mortgage */}
              <TouchableOpacity
                style={styles.loanProductCard}
                onPress={() => navigation.navigate("LoanApplication", { productId: "mortgage" })}
                accessibilityLabel="Mortgage"
                accessibilityRole="button"
              >
                <View style={[styles.loanProductIcon, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="home" size={24} color="#10B981" />
                </View>
                <Text style={styles.loanProductName}>Home Mortgage</Text>
                <Text style={styles.loanProductRange}>$10,000 - $100,000</Text>
                <View style={[styles.loanRateBadge, { backgroundColor: "#D1FAE5" }]}>
                  <Text style={[styles.loanRateBadgeText, { color: "#10B981" }]}>From 5.99%</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Calculator & Marketplace Buttons */}
            <View style={styles.loanActionsRow}>
              <TouchableOpacity
                style={styles.loanActionBtn}
                onPress={() => navigation.navigate("LoanCalculator" as any)}
                accessibilityLabel="Loan Calculator"
                accessibilityRole="button"
              >
                <Ionicons name="calculator-outline" size={18} color={colors.accentTeal} />
                <Text style={styles.loanActionBtnText}>Calculator</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loanActionBtn}
                onPress={() => navigation.navigate("LoanMarketplace")}
                accessibilityLabel="Marketplace"
                accessibilityRole="button"
              >
                <Ionicons name="storefront-outline" size={18} color={colors.accentTeal} />
                <Text style={styles.loanActionBtnText}>Marketplace</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter" as any)}
        accessibilityLabel="Help"
        accessibilityRole="button"
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.textWhite} />
        <Text style={styles.floatingHelpText}>Help</Text>
      </TouchableOpacity>

      {/* Onboarding Tooltips */}
      {!isOnboardingComplete && (
        <OnboardingTooltipManager screen="Dashboard" />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // SECTION 1 — HEADER (NAVY, NO GRADIENT)
  header: {
    backgroundColor: colors.primaryNavy,
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: typography.bodySmall,
    color: colors.textOnNavy,
  },
  userName: {
    fontSize: typography.userName,
    fontWeight: typography.semibold,
    color: colors.textOnNavy,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    gap: 4,
  },
  scoreText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.whiteTransparent10,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.whiteTransparent20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
  balanceSection: {
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: typography.labelSmall,
    letterSpacing: 1,
    color: colors.whiteTransparent70,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: typography.balanceNumber,
    fontWeight: typography.bold,
    color: colors.textWhite, // ONLY pure white here
    letterSpacing: -1,
  },
  balanceSubtext: {
    fontSize: typography.label,
    color: colors.whiteTransparent70,
    marginTop: 4,
  },

  // SECTION 2 — BREAKDOWN ROW (NEUTRAL)
  breakdownRow: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  breakdownValue: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
    marginTop: 4,
  },
  breakdownLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },

  content: {
    padding: 16,
  },

  // WELCOME CARD FOR NEW USERS
  welcomeCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accentTeal,
  },
  welcomeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeIconBg: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  welcomeSubtitle: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },
  welcomeSteps: {
    gap: 10,
  },
  welcomeStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  welcomeStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeStepNumberText: {
    fontSize: 12,
    fontWeight: typography.bold,
  },
  welcomeStepText: {
    fontSize: typography.body,
    color: colors.primaryNavy,
  },

  // SECTION 3 — ACTIONS ROW
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  primaryActionBtn: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.button,
    gap: 4,
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: typography.bold,
    color: colors.textWhite,
    flexShrink: 1,
  },
  secondaryActionBtn: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.accentTeal,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: radius.button,
    gap: 4,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
    flexShrink: 1,
  },
  neutralActionBtn: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: radius.button,
    gap: 4,
  },
  neutralActionText: {
    fontSize: 12,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    flexShrink: 1,
  },

  // SECTION 4 — COMING UP
  section: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  comingUpRow: {
    flexDirection: "row",
    gap: 8,
  },
  comingUpCard: {
    flex: 1,
    padding: 12,
    borderRadius: radius.medium,
  },
  comingUpLabel: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  comingUpAmount: {
    fontSize: 20,
    fontWeight: typography.bold,
  },
  comingUpSub: {
    fontSize: typography.labelSmall,
    marginTop: 2,
  },

  // SECTION 4.5 — ADVANCE PAYOUT CARD
  advancePayoutCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    borderStyle: "solid",
  },
  advancePayoutLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  advancePayoutIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    backgroundColor: colors.tealTintBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  advancePayoutInfo: {
    flex: 1,
  },
  advancePayoutTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  advancePayoutDesc: {
    fontSize: typography.bodySmall,
    fontWeight: typography.bold,
    color: colors.accentTeal,
    marginTop: 2,
  },
  advancePayoutFee: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  advancePayoutRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  advanceEligibleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  advanceEligibleText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
  },

  // SECTION 5 — WALLET CARD
  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  walletLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  walletIconContainer: {
    width: 42,
    height: 42,
    borderRadius: radius.medium,
    backgroundColor: colors.navyTintBg,
    alignItems: "center",
    justifyContent: "center",
  },
  walletLabel: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  walletCurrency: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  walletRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  walletAmount: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },

  // SECTION 6 — GOALS
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: typography.bodyLarge,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  apyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  apyPillText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
  },
  seeAllText: {
    fontSize: typography.label,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },
  goalCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    padding: 12,
    marginBottom: 8,
  },
  goalIconContainer: {
    width: 42,
    height: 42,
    borderRadius: radius.medium,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  goalEmoji: {
    fontSize: 18,
  },
  goalInfo: {
    flex: 1,
    marginRight: 12,
  },
  goalName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  goalDetails: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  goalInterest: {
    alignItems: "flex-end",
  },
  interestEarned: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.successText,
  },
  interestStatus: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.tealTintBg,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    borderRadius: radius.medium,
    borderStyle: "dashed",
  },
  addButtonText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // SECTION 7 — CIRCLES
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
    color: colors.textWhite,
  },
  circleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    padding: 12,
    marginBottom: 8,
  },
  circleIconContainer: {
    width: 42,
    height: 42,
    borderRadius: radius.medium,
    backgroundColor: colors.primaryNavy,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  circleEmoji: {
    fontSize: 18,
  },
  circleInfo: {
    flex: 1,
    marginRight: 12,
  },
  circleName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  circleDetails: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  circlePosition: {
    alignItems: "flex-end",
  },
  positionNumber: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  turnPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  turnPillText: {
    fontSize: 9,
    fontWeight: typography.semibold,
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tealTintBg,
    borderRadius: radius.medium,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    borderStyle: "dashed",
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    backgroundColor: "rgba(0, 198, 174, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emptyText: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
  },
  emptySubtitle: {
    fontSize: typography.label,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // SECTION 9 — ELDER
  elderCard: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    padding: 14,
  },
  elderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  elderScoreSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  elderScoreBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  elderScoreValue: {
    fontSize: 20,
    fontWeight: typography.bold,
  },
  elderScoreLabel: {
    fontSize: typography.labelSmall,
    color: colors.textSecondary,
  },
  elderTierText: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
  },
  elderStats: {
    flexDirection: "row",
    gap: 16,
  },
  elderStatItem: {
    alignItems: "center",
  },
  elderStatValue: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: colors.primaryNavy,
  },
  elderStatLabel: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },

  // SECTION 10 — LOANS & FINANCING
  premiumBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  premiumBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
  },
  loanCardsContainer: {
    paddingVertical: 4,
    gap: 10,
  },
  loanProductCard: {
    width: 140,
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  loanProductIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.medium,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  loanProductName: {
    fontSize: typography.body,
    fontWeight: typography.semibold,
    color: colors.primaryNavy,
    textAlign: "center",
    marginBottom: 4,
  },
  loanProductRange: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  loanRateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  loanRateBadgeText: {
    fontSize: typography.caption,
    fontWeight: typography.semibold,
  },
  loanActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  loanActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: colors.screenBg,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loanActionBtnText: {
    fontSize: typography.bodySmall,
    fontWeight: typography.semibold,
    color: colors.accentTeal,
  },

  // FLOATING HELP
  floatingHelp: {
    position: "absolute",
    bottom: 24,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
    // @ts-ignore - web-only property for proper click handling
    cursor: "pointer",
  } as any,
  floatingHelpText: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: colors.textWhite,
  },
});
