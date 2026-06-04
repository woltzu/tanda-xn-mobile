import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useCircles } from "../context/CirclesContext";
import { useOrganizerTrips } from "../hooks/useTripOrganizer";
import { useXnScore } from "../context/XnScoreContext";
import { useWallet } from "../context/WalletContext";
import { useAdvance, LOAN_PRODUCTS, ELIGIBILITY_TIERS } from "../context/AdvanceContext";
import { useSavings } from "../context/SavingsContext";
import { useCommunity } from "../context/CommunityContext";
import { useElder } from "../context/ElderContext";
import { useNotifications } from "../context/NotificationContext";
import { useActiveIntervention } from "../hooks/useEarlyIntervention";
import { useUserDefaults } from "../hooks/useDefaultCascade";
import { useLateContributions } from "../hooks/useLateContributions";
import { useInterest } from "../hooks/useInterest";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RootStackParamList, TabParamList } from "../App";
import { Routes } from "../lib/routes";
import { colors, radius, typography } from "../theme/tokens";
import { ProgressBar } from "../components/ui";
import { useOnboarding } from "../context/OnboardingContext";
import DreamFeedWidget from "../components/DreamFeedWidget";

type DashboardScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, "Home">,
  StackNavigationProp<RootStackParamList>
>;

// Design tokens
const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GOLD = "#E8A842";
const BG = "#F5F7FA";
const CARD_BG = "#FFFFFF";
const TEXT_DARK = "#1F2937";
const TEXT_SECONDARY = "#6B7280";
const BORDER = "#E5E7EB";
const SUCCESS = "#10B981";
const WARNING = "#F59E0B";

// Circle accent color rotation
const CIRCLE_ACCENTS = [TEAL, GOLD, NAVY, TEAL, GOLD];

// Trip status pill colors — mirrors OrganizerTripListScreen for visual consistency
const TRIP_STATUS_COLORS: Record<
  "draft" | "published" | "closed" | "cancelled",
  { bg: string; text: string }
> = {
  draft: { bg: "#E5E7EB", text: "#6B7280" },
  published: { bg: "rgba(0,198,174,0.15)", text: TEAL },
  closed: { bg: "rgba(10,35,66,0.12)", text: NAVY },
  cancelled: { bg: "#FEE2E2", text: "#DC2626" },
};

// Trip card date formatter — matches OrganizerTripListScreen output
const formatTripDates = (start: string, end: string): string => {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${s.toLocaleDateString("en-US", opts)} — ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
  } catch {
    return `${start} — ${end}`;
  }
};

// Static near-you services data
const NEAR_YOU_SERVICES = [
  { id: "1", emoji: "\uD83C\uDF5D", name: "Maman Cuisine", provider: "Awa D.", distance: "0.4 mi", bg: "#FEF3C7", trusted: true, elderEndorsed: false },
  { id: "2", emoji: "\u2702\uFE0F", name: "Salon Beaute", provider: "Marie K.", distance: "0.7 mi", bg: "#FCE7F3", trusted: true, elderEndorsed: true },
  { id: "3", emoji: "\u2696\uFE0F", name: "Legal Aid", provider: "Jean M.", distance: "1.2 mi", bg: "#DBEAFE", trusted: true, elderEndorsed: false },
  { id: "4", emoji: "\uD83D\uDCE6", name: "Ship to Africa", provider: "Koffi Express", distance: "2.1 mi", bg: "#ECFDF5", trusted: true, elderEndorsed: true },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { user } = useAuth();

  // Active early-intervention banner. The hook handles its own auth
  // (via useAuth internally) and subscribes to member_interventions
  // realtime so dismissals + new arrivals reflect without a refresh.
  const {
    intervention,
    hasIntervention,
    markEngaged,
  } = useActiveIntervention();

  // Safety net: catch users who landed here without going through
  // SetPassword (e.g. closed the tab between QuickJoin success and the
  // password screen). Runs ONCE per mount via a ref guard, never on
  // re-render. Only redirects when password_set is false AND
  // password_skipped_at is null — silent no-op for everyone else.
  const passwordCheckRan = useRef<boolean>(false);
  useEffect(() => {
    if (passwordCheckRan.current) return;
    passwordCheckRan.current = true;
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("password_set, password_skipped_at")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.log("[Dashboard] password-check profile read error", { error });
          return;
        }
        if (
          profile &&
          profile.password_set === false &&
          profile.password_skipped_at == null
        ) {
          console.log("[Dashboard] redirecting to SetPassword (mid-flow recovery)", {
            userId: user.id,
          });
          navigation.navigate("SetPassword" as any);
        }
      } catch (err) {
        console.log("[Dashboard] password-check error", { error: err });
      }
    })();
    return () => { cancelled = true; };
    // user.id is stable per session; intentionally only checking once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const { myCircles } = useCircles();
  const { trips: organizerTrips, refresh: refreshOrganizerTrips } = useOrganizerTrips();

  // Re-fetch trips when the Dashboard regains focus (e.g. after creating a
  // trip in the wizard) so newly-created trips appear without a hard reload.
  useFocusEffect(
    useCallback(() => {
      refreshOrganizerTrips();
    }, [refreshOrganizerTrips])
  );
  const { score } = useXnScore();
  const { balance: walletBalance } = useWallet();
  const { hasActiveDefaults } = useUserDefaults();
  const { lateContributions } = useLateContributions();
  const hasRecoveryItems = hasActiveDefaults || lateContributions.length > 0;
  const { totalAccruedInterest, isInterestUnlocked } = useInterest();
  const hasInterestToShow = totalAccruedInterest > 0;
  const {
    getAdvanceTier,
    getTierInfo,
    activeLoans: activeAdvances,
    getTotalOutstanding,
    getEligibilityTier,
  } = useAdvance();
  const {
    getTotalSavings,
    getTotalInterestEarned,
    getActiveGoals,
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

  // Map circles for display
  const displayCircles = myCircles.map((circle, index) => ({
    id: circle.id,
    name: circle.name,
    emoji: circle.emoji,
    members: circle.currentMembers,
    contribution: circle.amount,
    frequency: circle.frequency.charAt(0).toUpperCase() + circle.frequency.slice(1),
    myPosition: circle.myPosition || 1,
    progress: circle.progress,
    accent: CIRCLE_ACCENTS[index % CIRCLE_ACCENTS.length],
  }));

  // Pulse banner logic
  const pulseBanner = useMemo(() => {
    // Check for contribution due soon (within 3 days)
    const circleWithDueSoon = myCircles.find((c) => {
      if (!c.nextContributionDate) return false;
      const dueDate = new Date(c.nextContributionDate);
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    });

    if (circleWithDueSoon) {
      const dueDate = new Date(circleWithDueSoon.nextContributionDate!);
      const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const dayText = diffDays === 0 ? "today" : diffDays === 1 ? "tomorrow" : `in ${diffDays} days`;
      return {
        icon: "\uD83D\uDD14",
        text: `${circleWithDueSoon.name} circle contributes ${dayText}. You're all set.`,
        cta: "View",
        action: () => navigation.navigate("CircleDetail", { circleId: circleWithDueSoon.id }),
      };
    }

    if (pendingInvite) {
      return {
        icon: "\uD83D\uDCEC",
        text: "You have a circle invite pending. Check it out!",
        cta: "View",
        action: () => navigation.getParent()?.navigate("Circles"),
      };
    }

    if (myCircles.length === 0) {
      return {
        icon: "\uD83C\uDFE0",
        text: "Welcome home! Start by joining or creating a circle.",
        cta: "Start",
        action: () => navigation.navigate("CreateCircleStart"),
      };
    }

    if (isElder && elderProfile?.status === "approved") {
      return {
        icon: "\uD83D\uDEE1\uFE0F",
        text: `Elder ${user?.name || ""}  your community looks up to you. ${elderStats?.activeVouches || 0} active vouches.`,
        cta: "View",
        action: () => navigation.navigate("ElderDashboard" as any),
      };
    }

    // Default community message
    return {
      icon: "\uD83C\uDF1F",
      text: "Your community is growing. Stay connected and keep building together.",
      cta: "View",
      action: () => navigation.getParent()?.navigate("Community"),
    };
  }, [myCircles, pendingInvite, isElder, elderProfile, elderStats, user]);

  // Status badge for circle cards
  const getCircleStatus = (circle: typeof displayCircles[0]) => {
    if (circle.progress >= 80) return { label: "On Track", color: SUCCESS };
    if (circle.progress >= 50) return { label: "Due Soon", color: WARNING };
    return { label: "Building", color: TEAL };
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========== 1. TOP BAR (Navy background) ========== */}
        <View style={styles.header}>
          <View style={styles.topBar}>
            {/* Left: Greeting + Brand */}
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.brandName}>TandaXn</Text>
            </View>

            {/* Right: Bell + Avatar + Elder badge */}
            <View style={styles.headerRight}>
              {/* Notification Bell */}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => navigation.navigate("NotificationsInbox" as any)}
                accessibilityLabel="Notifications"
                accessibilityRole="button"
              >
                <Ionicons name="notifications-outline" size={22} color={colors.textOnNavy} />
                {unreadCount > 0 && (
                  <View style={styles.notificationDot} />
                )}
              </TouchableOpacity>

              {/* Avatar */}
              <TouchableOpacity
                style={styles.avatarButton}
                onPress={() => navigation.navigate("ProfileMain" as any)}
                accessibilityLabel="Profile"
                accessibilityRole="button"
              >
                <Text style={styles.avatarInitial}>
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>

              {/* Elder Badge */}
              {isElder && elderProfile?.status === "approved" && (
                <TouchableOpacity
                  style={styles.elderBadge}
                  onPress={() => navigation.navigate("XnScoreDashboard")}
                  accessibilityLabel="Elder status"
                  accessibilityRole="button"
                >
                  <Text style={styles.elderBadgeText}>
                    {getElderTierInfo(elderProfile.tier).icon}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* DEBUG ONLY — entry point to walk the translated Advance V2
              flow during development. Gated on __DEV__ so it never
              ships to production builds. Remove once a real entry
              point (e.g. an Advance card) is wired. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.AdvanceHubV2)}
              accessibilityLabel="Open Advance V2 flow (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="construct-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Advance V2 (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point to walk the translated Goals V2
              flow during development. Gated on __DEV__ so it never ships.
              Remove once a real entry point (e.g. a Goals card) is wired. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.GoalsHubV2)}
              accessibilityLabel="Open Goals V2 flow (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="trophy-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Goals V2 (debug)</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========== 1a-bis. EARLY INTERVENTION CARD ========== */}
        {/* Only renders when an unresolved intervention exists for this
            member (hook filters to status IN 'sent'|'viewed'|'engaged').
            Tap "Got it" → markEngaged() flips status to 'engaged' and the
            realtime subscription clears the banner. Amber color matches
            the engine's WARNING tone, distinct from the red recovery
            banner below (which is a stronger signal). */}
        {hasIntervention && intervention && (
          <View style={styles.interventionCard}>
            <View style={styles.interventionIcon}>
              <Ionicons name="hand-left-outline" size={22} color="#92400E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.interventionTitle} numberOfLines={4}>
                {intervention.messageText}
              </Text>
              <View style={styles.interventionActions}>
                <TouchableOpacity
                  style={styles.interventionPrimaryBtn}
                  onPress={() => { markEngaged(); }}
                  accessibilityRole="button"
                  accessibilityLabel="Acknowledge intervention"
                >
                  <Text style={styles.interventionPrimaryBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ========== 1b. WALLET BALANCE CARD ========== */}
        <TouchableOpacity
          style={styles.walletCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("WalletMain")}
          accessibilityLabel="Open wallet"
          accessibilityRole="button"
        >
          <View style={styles.walletCardIcon}>
            <Ionicons name="wallet-outline" size={22} color={TEAL} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletCardLabel}>My Wallet</Text>
            <Text style={styles.walletCardBalance}>${walletBalance.toFixed(2)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {/* ========== 1c. RECOVERY ALERT BANNER (red — only when active) ========== */}
        {/* Conditional on hasActiveDefaults OR lateContributions.length > 0.
            Placed above the Pulse banner so users see overdue items first
            without scrolling. */}
        {hasRecoveryItems && (
          <TouchableOpacity
            style={styles.recoveryBanner}
            onPress={() => navigation.navigate(Routes.DefaultRecovery)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open default recovery"
          >
            <View style={styles.recoveryBannerIcon}>
              <Ionicons name="warning" size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recoveryBannerTitle}>Overdue contributions</Text>
              <Text style={styles.recoveryBannerSubtitle} numberOfLines={2}>
                You have pending defaults or late payments. Resolve now.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}

        {/* ========== 1d. INTEREST CARD (Interest-First KYC entry) ========== */}
        {/* Orange "accruing" variant nudges the user into the KYC flow;
            green "earned" variant celebrates an unlocked balance.
            Hidden when the user has no accrued interest at all. */}
        {hasInterestToShow && (
          isInterestUnlocked ? (
            <View style={styles.interestCardGreen}>
              <View style={styles.interestCardIcon}>
                <Text style={styles.interestCardEmoji}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.interestCardLabelGreen}>
                  Interest earned
                </Text>
                <Text style={styles.interestCardAmount}>
                  ${totalAccruedInterest.toFixed(2)}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.interestCardOrange}
              onPress={() =>
                navigation.navigate(Routes.UnlockInterestPrompt, {
                  totalInterest: totalAccruedInterest,
                })
              }
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Unlock $${totalAccruedInterest.toFixed(2)} of interest`}
            >
              <View style={styles.interestCardIcon}>
                <Text style={styles.interestCardEmoji}>📈</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.interestCardLabelOrange}>
                  Interest accruing
                </Text>
                <Text style={styles.interestCardAmount}>
                  ${totalAccruedInterest.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.interestCardCta}>Unlock now →</Text>
            </TouchableOpacity>
          )
        )}

        {/* ========== 2. PULSE BANNER (Teal gradient) ========== */}
        <TouchableOpacity
          style={styles.pulseBanner}
          onPress={pulseBanner.action}
          activeOpacity={0.85}
          accessibilityLabel={pulseBanner.text}
          accessibilityRole="button"
        >
          <View style={styles.pulseIconContainer}>
            <Text style={styles.pulseIcon}>{pulseBanner.icon}</Text>
          </View>
          <Text style={styles.pulseText} numberOfLines={2}>
            {pulseBanner.text}
          </Text>
          <Text style={styles.pulseCta}>{pulseBanner.cta} {"\u2192"}</Text>
        </TouchableOpacity>

        {/* ========== 3. YOUR CIRCLES (Horizontal scroll) ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Circles</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Circles")}
              accessibilityLabel="Manage circles"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.circlesScroll}
          >
            {displayCircles.map((circle) => {
              const status = getCircleStatus(circle);
              return (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.circleCard}
                  onPress={() => navigation.navigate("CircleDetail", { circleId: circle.id })}
                  accessibilityLabel={`Circle: ${circle.name}`}
                  accessibilityRole="button"
                >
                  <View style={[styles.circleEmojiContainer, { backgroundColor: `${circle.accent}18` }]}>
                    <Text style={styles.circleEmoji}>{circle.emoji}</Text>
                  </View>
                  <Text style={styles.circleName} numberOfLines={1}>{circle.name}</Text>
                  <Text style={styles.circleMembers}>{circle.members} members</Text>
                  <View style={styles.circleProgressTrack}>
                    <View
                      style={[
                        styles.circleProgressFill,
                        { width: `${Math.min(circle.progress, 100)}%`, backgroundColor: circle.accent },
                      ]}
                    />
                  </View>
                  <View style={styles.circleBottom}>
                    <Text style={[styles.circlePercent, { color: circle.accent }]}>
                      {Math.round(circle.progress)}%
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${status.color}18` }]}>
                      <Text style={[styles.statusBadgeText, { color: status.color }]}>
                        {status.label}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Start New Circle card */}
            <TouchableOpacity
              style={styles.newCircleCard}
              onPress={() => navigation.navigate("CreateCircleStart")}
              accessibilityLabel="Start a new circle"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={28} color={TEAL} />
              <Text style={styles.newCircleText}>Start a{"\n"}new circle</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ========== 4. KENTE DIVIDER ========== */}
        <View style={styles.kenteDivider}>
          <View style={[styles.kenteStripe, { backgroundColor: "#C67B5C" }]} />
          <View style={[styles.kenteStripe, { backgroundColor: GOLD }]} />
          <View style={[styles.kenteStripe, { backgroundColor: "#2D6A4F" }]} />
          <View style={[styles.kenteStripe, { backgroundColor: GOLD }]} />
        </View>

        {/* ========== 5. ARRIVAL STRIP ========== */}
        <TouchableOpacity
          style={styles.arrivalStrip}
          onPress={() => navigation.getParent()?.navigate("Community")}
          activeOpacity={0.8}
          accessibilityLabel="New neighbors arrived this week"
          accessibilityRole="button"
        >
          <View style={styles.arrivalLeft}>
            {/* Face stack - 3 overlapping avatar circles */}
            <View style={styles.faceStack}>
              <View style={[styles.faceCircle, { backgroundColor: "#DBEAFE", zIndex: 3 }]}>
                <Text style={styles.faceEmoji}>{"\uD83D\uDE4B\u200D\u2640\uFE0F"}</Text>
              </View>
              <View style={[styles.faceCircle, { backgroundColor: "#FCE7F3", left: -8, zIndex: 2 }]}>
                <Text style={styles.faceEmoji}>{"\uD83D\uDE4B\u200D\u2642\uFE0F"}</Text>
              </View>
              <View style={[styles.faceCircle, { backgroundColor: "#FEF3C7", left: -16, zIndex: 1 }]}>
                <Text style={styles.faceEmoji}>{"\uD83D\uDE4B"}</Text>
              </View>
            </View>
            <Text style={styles.arrivalText}>
              <Text style={styles.arrivalBold}>3 new neighbors</Text> arrived this week
            </Text>
          </View>
          <Text style={styles.arrivalCta}>Welcome {"\u2192"}</Text>
        </TouchableOpacity>

        {/* ========== 5b. MY TRIPS \u2014 real preview when trips exist, static tile as empty state ========== */}
        {organizerTrips.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Trips</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("OrganizerTripList" as any)}
                accessibilityLabel="See all my trips"
                accessibilityRole="button"
              >
                <Text style={styles.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tripsScroll}
            >
              {organizerTrips.slice(0, 6).map((trip) => {
                const statusKey = (trip.status as "draft" | "published" | "closed" | "cancelled");
                const statusColor = TRIP_STATUS_COLORS[statusKey] ?? TRIP_STATUS_COLORS.draft;
                return (
                  <TouchableOpacity
                    key={trip.id}
                    style={styles.tripCard}
                    onPress={() =>
                      navigation.navigate("OrganizerTripDashboard" as any, { tripId: trip.id })
                    }
                    accessibilityLabel={`Trip: ${trip.name}`}
                    accessibilityRole="button"
                  >
                    {trip.coverPhotoUrl ? (
                      <Image source={{ uri: trip.coverPhotoUrl }} style={styles.tripCover} />
                    ) : (
                      <View style={[styles.tripCover, styles.tripCoverPlaceholder]}>
                        <Text style={{ fontSize: 28 }}>{"\u2708\uFE0F"}</Text>
                      </View>
                    )}
                    <View style={styles.tripCardBody}>
                      <Text style={styles.tripName} numberOfLines={1}>
                        {trip.name}
                      </Text>
                      <Text style={styles.tripDates} numberOfLines={1}>
                        {formatTripDates(trip.startDate, trip.endDate)}
                      </Text>
                      <View
                        style={[styles.tripStatusPill, { backgroundColor: statusColor.bg }]}
                      >
                        <Text style={[styles.tripStatusPillText, { color: statusColor.text }]}>
                          {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* See-all card mirrors the "Start a new circle" pattern */}
              <TouchableOpacity
                style={styles.tripSeeMoreCard}
                onPress={() => navigation.navigate("OrganizerTripList" as any)}
                accessibilityLabel="See all my trips"
                accessibilityRole="button"
              >
                <Ionicons name="arrow-forward" size={24} color={TEAL} />
                <Text style={styles.tripSeeMoreText}>See all{"\n"}trips</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.tripOrganizerCard}
            onPress={() => navigation.navigate("OrganizerTripList" as any)}
            activeOpacity={0.85}
            accessibilityLabel="View my trips"
            accessibilityRole="button"
          >
            <View style={styles.tripOrganizerLeft}>
              <View style={styles.tripOrganizerIcon}>
                <Text style={{ fontSize: 26 }}>{"\u2708\uFE0F"}</Text>
              </View>
              <View style={styles.tripOrganizerText}>
                <Text style={styles.tripOrganizerTitle}>My Trips</Text>
                <Text style={styles.tripOrganizerDesc}>
                  Organize, manage & track all your group trips
                </Text>
              </View>
            </View>
            <View style={styles.tripOrganizerCta}>
              <Text style={styles.tripOrganizerCtaText}>Open {"\u2192"}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ========== 6. COMMUNITY FEED ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Community</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Community")}
              accessibilityLabel="Explore community"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>Explore</Text>
            </TouchableOpacity>
          </View>

          <DreamFeedWidget
            onViewAll={() => {
              navigation.navigate("DreamFeed" as any);
            }}
            onPostPress={(postId) => {
              navigation.navigate("PostDetail" as any, { postId });
            }}
          />
        </View>

        {/* ========== 7. NEAR YOU SERVICES (Horizontal scroll) ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Near You</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Market")}
              accessibilityLabel="See all services"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesScroll}
          >
            {NEAR_YOU_SERVICES.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.serviceCard}
                onPress={() => navigation.getParent()?.navigate("Market")}
                accessibilityLabel={`Service: ${service.name}`}
                accessibilityRole="button"
              >
                <View style={[styles.serviceEmojiContainer, { backgroundColor: service.bg }]}>
                  <Text style={styles.serviceEmoji}>{service.emoji}</Text>
                </View>
                <Text style={styles.serviceName} numberOfLines={1}>{service.name}</Text>
                <Text style={styles.serviceProvider} numberOfLines={1}>{service.provider}</Text>
                <Text style={styles.serviceDistance}>{service.distance}</Text>
                <View style={styles.trustRow}>
                  <View style={[styles.trustDot, { backgroundColor: service.elderEndorsed ? GOLD : SUCCESS }]} />
                  <Text style={styles.trustLabel}>
                    {service.elderEndorsed ? "Elder Endorsed" : "Trusted"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ========== 8. Bottom spacing for tab bar ========== */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    paddingBottom: 0,
  },

  // ===== 1. TOP BAR =====
  header: {
    backgroundColor: NAVY,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  // DEBUG ONLY — Advance V2 entry button (gated on __DEV__ in JSX).
  debugButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  debugButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    fontFamily: "System",
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.3,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "700",
    color: GOLD,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: NAVY,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TEAL,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  elderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(232,168,66,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  elderBadgeText: {
    fontSize: 14,
  },

  // ===== 1b. WALLET CARD =====
  // Early-intervention banner — sits between the header and the wallet card.
  // Amber/warm palette (mirrors the engine's WARNING tone token), distinct
  // from the harder-red recoveryBanner below which fires for actual overdue
  // payments. Soft-dismiss via the "Got it" → markEngaged() handler.
  interventionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
    gap: 12,
  },
  interventionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
  interventionTitle: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
    fontWeight: "500",
  },
  interventionActions: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  interventionPrimaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  interventionPrimaryBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },

  walletCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  walletCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,198,174,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  walletCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  walletCardBalance: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },

  // ===== 1c. RECOVERY ALERT BANNER =====
  recoveryBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 10,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  recoveryBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  recoveryBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  recoveryBannerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.92)",
    marginTop: 2,
  },

  // ===== 1d. INTEREST CARD (KYC-2.3) =====
  // Two visual variants share the same base shape:
  //   - Orange (accruing): nudge into UnlockInterestPrompt
  //   - Green (unlocked): celebratory, no tap action
  interestCardOrange: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 12,
  },
  interestCardGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 12,
  },
  interestCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  interestCardEmoji: { fontSize: 20 },
  interestCardLabelOrange: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  interestCardLabelGreen: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
  },
  interestCardAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
    marginTop: 2,
  },
  interestCardCta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#92400E",
  },

  // ===== 2. PULSE BANNER =====
  pulseBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    marginHorizontal: 16,
    marginTop: -1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  pulseIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  pulseIcon: {
    fontSize: 18,
  },
  pulseText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  pulseCta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 10,
  },

  // ===== 3. YOUR CIRCLES =====
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
  },
  circlesScroll: {
    paddingRight: 16,
    gap: 12,
  },
  circleCard: {
    width: 134,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  circleEmojiContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  circleEmoji: {
    fontSize: 20,
  },
  circleName: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
    marginBottom: 2,
  },
  circleMembers: {
    fontSize: 11,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    fontVariant: ["tabular-nums"],
    marginBottom: 10,
  },
  circleProgressTrack: {
    height: 3,
    backgroundColor: BORDER,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  circleProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  circleBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  circlePercent: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  newCircleCard: {
    width: 134,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  newCircleText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
    textAlign: "center",
    lineHeight: 18,
  },

  // ===== 4. KENTE DIVIDER =====
  kenteDivider: {
    flexDirection: "row",
    height: 4,
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
    opacity: 0.35,
  },
  kenteStripe: {
    flex: 1,
  },

  // ===== 5. ARRIVAL STRIP =====
  arrivalStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ECFDF5",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  arrivalLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  faceStack: {
    flexDirection: "row",
    width: 60,
    marginRight: 10,
  },
  faceCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ECFDF5",
  },
  faceEmoji: {
    fontSize: 13,
  },
  arrivalText: {
    fontSize: 13,
    color: TEXT_DARK,
    flex: 1,
    lineHeight: 18,
  },
  arrivalBold: {
    fontWeight: "700",
  },
  arrivalCta: {
    fontSize: 13,
    fontWeight: "700",
    color: SUCCESS,
    marginLeft: 8,
  },

  // ===== 5b. TRIP ORGANIZER CTA =====
  tripOrganizerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tripOrganizerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  tripOrganizerIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FFF7ED",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  tripOrganizerText: {
    flex: 1,
  },
  tripOrganizerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
    marginBottom: 3,
  },
  tripOrganizerDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    lineHeight: 17,
  },
  tripOrganizerCta: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginLeft: 10,
  },
  tripOrganizerCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ===== 5c. MY TRIPS PREVIEW (horizontal scroll, mirrors Your Circles idiom) =====
  tripsScroll: {
    paddingRight: 16,
    gap: 12,
  },
  tripCard: {
    width: 220,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  tripCover: {
    width: "100%",
    height: 100,
  },
  tripCoverPlaceholder: {
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  tripCardBody: {
    padding: 12,
  },
  tripName: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  tripDates: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 3,
  },
  tripStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 8,
  },
  tripStatusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tripSeeMoreCard: {
    width: 110,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  tripSeeMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEAL,
    textAlign: "center",
    lineHeight: 18,
  },

  // ===== 7. NEAR YOU SERVICES =====
  servicesScroll: {
    paddingRight: 16,
    gap: 12,
  },
  serviceCard: {
    width: 150,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  serviceEmojiContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  serviceEmoji: {
    fontSize: 22,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: "700",
    color: TEXT_DARK,
    marginBottom: 2,
  },
  serviceProvider: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 2,
  },
  serviceDistance: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trustDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trustLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
});
