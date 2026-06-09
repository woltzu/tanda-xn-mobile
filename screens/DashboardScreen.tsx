import React, { useMemo, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
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
import { useStressIntervention } from "../hooks/useFinancialStressPrediction";
import { useMoodIntervention } from "../hooks/useContributionMoodDetection";
import { useMemberTier } from "../hooks/useGraduatedEntry";
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

// i18n: getGreeting takes the t() function so the greeting is localized.
// Kept as a regular function (not a hook) so it can stay a pure utility.
function getGreeting(t: (k: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("dashboard.greeting_morning");
  if (hour < 17) return t("dashboard.greeting_afternoon");
  return t("dashboard.greeting_evening");
}

// ─── Tier helpers (Phase D3 of feat(tier)) ────────────────────────────────
// Map graduated_entry_tiers.tier_key → color/bg/emoji. Values mirror the
// engine's seeded definitions in migration 040.
function getTierColor(tierKey: string): string {
  switch (tierKey) {
    case "critical": return "#991B1B";
    case "newcomer": return "#EF4444";
    case "established": return "#F59E0B";
    case "trusted": return "#10B981";
    case "elder": return "#8B5CF6";
    case "elite": return "#FFD700";
    default: return "#6B7280";
  }
}
function getTierBg(tierKey: string): string {
  switch (tierKey) {
    case "critical": return "#FEE2E2";
    case "newcomer": return "#FEF2F2";
    case "established": return "#FEF3C7";
    case "trusted": return "#D1FAE5";
    case "elder": return "#EDE9FE";
    case "elite": return "#FEF9C3";
    default: return "#F3F4F6";
  }
}
function getTierEmoji(tierKey: string): string {
  switch (tierKey) {
    case "critical": return "\u{1F6AB}";       // 🚫
    case "newcomer": return "\u{1F331}";       // 🌱
    case "established": return "\u{26A1}";     // ⚡
    case "trusted": return "\u{2713}";         // ✓
    case "elder": return "\u{1F3C6}";          // 🏆
    case "elite": return "\u{2B50}";           // ⭐
    default: return "\u{1F535}";               // 🔵
  }
}

export default function DashboardScreen() {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Active early-intervention banner. The hook handles its own auth
  // (via useAuth internally) and subscribes to member_interventions
  // realtime so dismissals + new arrivals reflect without a refresh.
  const {
    intervention,
    hasIntervention,
    markEngaged,
  } = useActiveIntervention();

  // Active stress-intervention card (Phase D3 of feat(stress)). Pulls the
  // member's pending stress_interventions row (if any) and subscribes
  // to realtime updates so accept/decline taps on StressScoreDashboard
  // also clear the card here. hasActiveIntervention is false (and the
  // card hidden) until the scoring cron lands a member into orange/red
  // and creates an offer — which currently won't happen because only
  // Signal A is producing data. Wiring is correct end-to-end; it's
  // gated on signal data we don't have yet.
  const {
    activeIntervention: stressIntervention,
    hasActiveIntervention: hasStressIntervention,
  } = useStressIntervention();

  // Active mood-intervention card (Phase D3 of feat(mood)). Pulls the
  // pending mood_interventions row from process_member_mood (migration
  // 091) and subscribes to realtime. Hidden until a snapshot crosses
  // score=30 (drifting → warm_checkin), 55 (disengaging → contribution_
  // pause), or 75 (at_risk → human_outreach, requires_review). Whole
  // card is tappable → MoodInsightsScreen.
  // Note: hook returns `hasActive` (not hasActiveIntervention as the
  // spec naming would suggest); aliased for clarity.
  const {
    activeIntervention: moodIntervention,
    hasActive: hasMoodIntervention,
  } = useMoodIntervention();

  // Member tier (Phase D3 of feat(tier)). Reads from member_tier_status
  // which is now populated daily by graduated-entry-cron (Phase D2). The
  // hook auto-subscribes to realtime so tier advancement is reflected
  // without a refresh.
  const { status: tierStatus } = useMemberTier();

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
      const text =
        diffDays === 0
          ? t("dashboard.pulse_due_today", { circle: circleWithDueSoon.name })
          : diffDays === 1
            ? t("dashboard.pulse_due_tomorrow", { circle: circleWithDueSoon.name })
            : t("dashboard.pulse_due_in_days", {
                circle: circleWithDueSoon.name,
                count: diffDays,
              });
      return {
        icon: "\uD83D\uDD14",
        text,
        cta: t("dashboard.pulse_view_cta"),
        action: () => navigation.navigate("CircleDetail", { circleId: circleWithDueSoon.id }),
      };
    }

    if (pendingInvite) {
      return {
        icon: "\uD83D\uDCEC",
        text: t("dashboard.pulse_invite_pending"),
        cta: t("dashboard.pulse_view_cta"),
        action: () => navigation.getParent()?.navigate("Circles"),
      };
    }

    if (myCircles.length === 0) {
      return {
        icon: "\uD83C\uDFE0",
        text: t("dashboard.pulse_welcome_home"),
        cta: t("dashboard.pulse_start_cta"),
        action: () => navigation.navigate("CreateCircleStart"),
      };
    }

    if (isElder && elderProfile?.status === "approved") {
      return {
        icon: "\uD83D\uDEE1\uFE0F",
        text: t("dashboard.pulse_elder", {
          name: user?.name || "",
          count: elderStats?.activeVouches || 0,
        }),
        cta: t("dashboard.pulse_view_cta"),
        action: () => navigation.navigate("ElderDashboard" as any),
      };
    }

    // Default community message
    return {
      icon: "\uD83C\uDF1F",
      text: t("dashboard.pulse_default"),
      cta: t("dashboard.pulse_view_cta"),
      action: () => navigation.getParent()?.navigate("Community"),
    };
  }, [myCircles, pendingInvite, isElder, elderProfile, elderStats, user, t]);

  // Status badge for circle cards
  const getCircleStatus = (circle: typeof displayCircles[0]) => {
    if (circle.progress >= 80) return { label: t("dashboard.circle_status_on_track"), color: SUCCESS };
    if (circle.progress >= 50) return { label: t("dashboard.circle_status_due_soon"), color: WARNING };
    return { label: t("dashboard.circle_status_building"), color: TEAL };
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
              <Text style={styles.greeting}>{getGreeting(t)}</Text>
              <Text style={styles.brandName}>{t("dashboard.brand_name")}</Text>
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

          {/* DEBUG ONLY — entry point for the Conflict Prediction admin
              dashboard (Phase D3 of feat(conflict)). Passes the first
              circle's id so the Monitoring + History tabs have data scope;
              the Formation tab is circle-agnostic and shows all pending
              reviews. Replace with a real admin/Elder entry point once an
              Elder UI exists. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.ConflictAlert, {
                circleId: myCircles[0]?.id ?? "",
              })}
              accessibilityLabel="Open Conflict Alerts (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="shield-half-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Conflict Alerts (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the Financial Wellness screen
              (Phase D3 of feat(stress)). The screen already shows the
              member's full stress breakdown + history + active
              intervention; this chip just makes it reachable without
              waiting for an intervention to land. Remove once a real
              entry point (e.g. a Wellness card on the Dashboard) is
              wired. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.StressScoreDashboard)}
              accessibilityLabel="Open Stress Score (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="pulse-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Stress Score (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the Mood Insights screen
              (Phase D3 of feat(mood)). The screen already shows the
              member's mood drift score + 5-signal breakdown + history
              + active intervention + opt-out toggle. This chip makes
              it reachable without waiting for the weekly scoring cron
              to land an intervention. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.MoodInsights)}
              accessibilityLabel="Open Mood Insights (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="happy-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Mood Insights (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the Discover Circles screen
              (Phase C of feat(circle)). The screen surfaces the existing
              CircleMatchingService recommendations (826 LOC, totally
              dormant before this commit) and logs interactions to
              circle_match_history for ML training data. Remove once a
              real entry (e.g. "Discover" tab) is added. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.DiscoverCircles)}
              accessibilityLabel="Open Discover Circles (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="compass-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Discover Circles (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the Graduated Entry screen
              (Phase D3 of feat(tier)). The screen (341 LOC) shows the
              member's current tier, action items for next tier,
              fast-track form, and tier history. The tier card below
              already exposes the headline data; this chip is the path
              to the deeper detail screen until a real menu entry exists. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.GraduatedEntry)}
              accessibilityLabel="Open Tier Status (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="ribbon-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Tier Status (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the DynamicPayoutScreen
              (Option A of feat(payout)). The screen (467 LOC) shows the
              computed payout order + per-member explanations. Hidden if
              the user has no circles (the screen needs a circleId
              param). Tap from CreateCircleSuccess after computing AI
              order is the real entry; this chip is for direct preview. */}
          {__DEV__ && myCircles.length > 0 && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.DynamicPayout, {
                circleId: myCircles[0]?.id ?? "",
              })}
              accessibilityLabel="Open Payout Ordering (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Payout Ordering (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for the InsurancePoolScreen
              (Phase D3 of feat(insurance)). The screen (794 LOC) shows
              the per-circle pool: current rate, balance, withholding
              transactions, claims, rate history. Hidden if user has no
              circles. The pool itself is now wired:
                - Contributions auto-withhold via the trigger from D1
                - Weekly rate cron from D2 recalculates per AI algorithm
              Remove once a real admin-area entry to the pool exists. */}
          {__DEV__ && myCircles.length > 0 && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.InsurancePool, {
                circleId: myCircles[0]?.id ?? "",
              })}
              accessibilityLabel="Open Insurance Pool (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Insurance Pool (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for CrossCircleLendingScreen
              (Phase D4 of feat(liquidity)). Platform-level pool that
              advances members against their future payout (3-5% flat
              fee, hardcoded in CrossCircleLiquidityEngine.ts). The pool
              is now wired:
                - Server-side eligibility + auto-approval (migration 097)
                - Weekly safety-knob auto-tune cron (migration 098 + EF
                  liquidity-pool-health-cron from D3)
              Shown unconditionally under __DEV__ — the pool is
              platform-wide, not per-circle. Remove once a real entry
              point exists in the standard navigation. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.CrossCircleLending)}
              accessibilityLabel="Open Cross Circle Lending (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="swap-horizontal-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Cross Circle Lending (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for SubstitutePoolScreen
              (Phase D3 of feat(substitute)). Member section: eligibility
              check, opt-in form, current pool stats, pending offers inbox
              (accept/decline). Admin section (visible only if user is
              creator/admin in any circle): pending admin_pending records
              with approve/decline and live 24h auto-approval countdown.
              The engine is now wired:
                - check_substitute_pool_eligibility for opt-in gate (101)
                - submit_exit_request + auto-match trigger (099 + 101)
                - respond_to_substitution accept/decline (101)
                - admin_approve/decline_substitution (101)
                - Lifecycle cron auto-approves at 24h, expires at 48h,
                  resets decline counters at 90d (100 + EF)
              Shown unconditionally under __DEV__ — eligibility is enforced
              inside the screen. Remove once a real entry point exists. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.SubstitutePool)}
              accessibilityLabel="Open Substitute Pool (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="people-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Substitute Pool (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point for PartialContributionScreen.
              Phase D4 of feat(partial). Hidden if the user has no circles
              (the screen needs a circleId). The screen resolves the active
              cycle from circle_cycles on mount when cycleId is omitted, so
              we only need to pass circleId.
              The real user-facing entry points are:
                - MakeContributionScreen "Insufficient Balance" alert
                - MakeContributionScreen tertiary CTA
                - CircleDetail active-plan card (when a plan exists)
              This chip exists for fast QA without going through those flows. */}
          {__DEV__ && myCircles.length > 0 && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                navigation.navigate(Routes.PartialContribution, {
                  circleId: myCircles[0]?.id ?? "",
                })
              }
              accessibilityLabel="Open Partial Contribution (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="pie-chart-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Partial Contribution (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point to the Circle Health card on
              CircleDetail. Phase D3 of feat(circle-health). Navigates to
              the first circle's detail screen, where the health card
              renders if the scoring-pipeline cron has populated a score.
              Hidden when myCircles.length === 0. The real user-facing
              entry is the health card itself on CircleDetail — this chip
              just makes it one tap from the Dashboard during QA. */}
          {__DEV__ && myCircles.length > 0 && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                navigation.navigate(Routes.CircleDetail, {
                  circleId: myCircles[0]?.id ?? "",
                })
              }
              accessibilityLabel="Open Circle Health (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="pulse-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Circle Health (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point to PositionSwapScreen.
              Phase D2 of feat(position-swap) #18. The whole engine
              (14 RPCs + hourly cron + EF + 906-LOC service + screen)
              has been deployed since migration 018 with no navigation
              entry from anywhere in the app. The chip + the kebab
              menu item on CircleDetail fix that. Real entry: the
              "Swap Position" item in CircleDetail's 3-dot menu. */}
          {__DEV__ && myCircles.length > 0 && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                navigation.navigate("PositionSwap" as any, {
                  circleId: myCircles[0]?.id ?? "",
                })
              }
              accessibilityLabel="Open Position Swap (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Position Swap (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point to CreditReportScreen.
              Feature #13. Always available under __DEV__ since the
              report works even with no circles (it just shows empty
              transaction history + falls back to profiles.xn_score).
              The real user-facing entry is meant to be a Settings or
              Profile menu item — added here as the 14th debug chip
              for fast QA. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => navigation.navigate(Routes.CreditReport)}
              accessibilityLabel="Open Credit Report (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>Credit Report (debug)</Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY — entry point to DecisionHistoryScreen.
              Phase D3 of feat(explainable-ai) #83. 16th debug chip.
              Shows the running log of AI decisions made about the
              member (liquidity_denial, tier_advancement, etc.) with
              the localized rendered_explanation from
              record_ai_decision. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                navigation.navigate(Routes.DecisionHistory as never)
              }
              accessibilityLabel="Open Explainable AI decision history (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="bulb-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>
                Explainable AI (debug)
              </Text>
            </TouchableOpacity>
          )}

          {/* DEBUG ONLY -- entry point to AIJobsHealthScreen.
              CronAIJobEngine #191. 17th debug chip. Read-only admin
              dashboard showing fleet status across all AI cron jobs
              (cron_job_logs), default-probability model accuracy +
              drift (model_performance_logs), and cohort retention
              metrics (cohort_analytics). The new weekly + monthly
              EFs scheduled via migration 113 surface here too. */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                navigation.navigate(Routes.AIJobsHealth as never)
              }
              accessibilityLabel="Open AI Job Fleet (debug)"
              accessibilityRole="button"
            >
              <Ionicons name="pulse-outline" size={14} color="#FFFFFF" />
              <Text style={styles.debugButtonText}>
                AI Job Fleet (debug)
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ========== 1a-prime. MEMBER TIER CARD ========== */}
        {/* Phase D3 of feat(tier). Shows current tier + progress to next.
            Renders for every member with a member_tier_status row (now
            populated by graduated-entry-cron via the profiles.xn_score
            fallback in migration 094). Card color and icon come from the
            engine's seeded tier definitions in graduated_entry_tiers.
            Whole card is tappable → GraduatedEntryScreen for the deep view. */}
        {tierStatus && (
          <TouchableOpacity
            style={[
              styles.tierCard,
              { backgroundColor: getTierBg(tierStatus.currentTier),
                borderColor: getTierColor(tierStatus.currentTier) },
            ]}
            onPress={() => navigation.navigate(Routes.GraduatedEntry)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`View ${tierStatus.currentTier} tier details`}
          >
            <View style={[
              styles.tierIcon,
              { backgroundColor: getTierColor(tierStatus.currentTier) + "22" },
            ]}>
              <Text style={styles.tierEmoji}>{getTierEmoji(tierStatus.currentTier)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.tierLabelRow}>
                <Text style={[styles.tierLabel, { color: getTierColor(tierStatus.currentTier) }]}>
                  {tierStatus.currentTier.charAt(0).toUpperCase() + tierStatus.currentTier.slice(1)}
                </Text>
                {tierStatus.nextTier ? (
                  <Text style={styles.tierProgress}>
                    {tierStatus.progressPct}% to {tierStatus.nextTier.charAt(0).toUpperCase() + tierStatus.nextTier.slice(1)}
                  </Text>
                ) : (
                  <Text style={styles.tierProgress}>Maxed out</Text>
                )}
              </View>
              <View style={styles.tierProgressTrack}>
                <View
                  style={[
                    styles.tierProgressFill,
                    {
                      width: `${Math.min(100, tierStatus.progressPct)}%`,
                      backgroundColor: getTierColor(tierStatus.currentTier),
                    },
                  ]}
                />
              </View>
              <Text style={styles.tierFooter} numberOfLines={1}>
                {tierStatus.maxCircleSize === null || tierStatus.maxCircleSize === 0
                  ? (tierStatus.maxCircleSize === 0 ? "Cannot join circles yet" : "Unlimited access")
                  : `Up to ${tierStatus.maxCircleSize}-member circles · $${Math.round((tierStatus.maxContributionCents ?? 0) / 100)}/mo cap`}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={getTierColor(tierStatus.currentTier)}
            />
          </TouchableOpacity>
        )}

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
                  <Text style={styles.interventionPrimaryBtnText}>{t("dashboard.intervention_got_it")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ========== 1a-ter. STRESS INTERVENTION CARD ========== */}
        {/* Phase D3 of feat(stress). Renders when a pending
            stress_interventions row exists for this member (hook filters
            on outcome='pending'). Color and CTA copy adapt to the
            intervention_type:
              - 'payment_restructure' → orange tone (less severe)
              - 'counselor_referral'  → red tone (more severe)
            Whole card is tappable — opens StressScoreDashboard where the
            member can review the breakdown and accept/decline. Distinct
            from the amber Early Intervention card above (which is a
            soft nudge from the score-pipeline engine); this is a
            concrete restructure/referral offer from the stress engine. */}
        {hasStressIntervention && stressIntervention && (
          <TouchableOpacity
            style={[
              styles.stressCard,
              stressIntervention.interventionType === "counselor_referral"
                ? styles.stressCardRed
                : styles.stressCardOrange,
            ]}
            onPress={() => navigation.navigate(Routes.StressScoreDashboard)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open stress wellness details"
          >
            <View style={[
              styles.stressIcon,
              stressIntervention.interventionType === "counselor_referral"
                ? styles.stressIconRed
                : styles.stressIconOrange,
            ]}>
              <Ionicons
                name={stressIntervention.interventionType === "counselor_referral"
                  ? "heart-circle"
                  : "wallet-outline"}
                size={22}
                color={stressIntervention.interventionType === "counselor_referral"
                  ? "#991B1B"
                  : "#9A3412"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[
                styles.stressTitle,
                stressIntervention.interventionType === "counselor_referral"
                  ? { color: "#991B1B" }
                  : { color: "#9A3412" },
              ]}>
                {stressIntervention.messageTitle}
              </Text>
              <Text style={[
                styles.stressBody,
                stressIntervention.interventionType === "counselor_referral"
                  ? { color: "#7F1D1D" }
                  : { color: "#7C2D12" },
              ]} numberOfLines={3}>
                {stressIntervention.messageBody}
              </Text>
              <View style={styles.stressCtaRow}>
                <Text style={[
                  styles.stressCtaText,
                  stressIntervention.interventionType === "counselor_referral"
                    ? { color: "#991B1B" }
                    : { color: "#9A3412" },
                ]}>
                  {t("dashboard.intervention_view_details")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={stressIntervention.interventionType === "counselor_referral"
                    ? "#991B1B"
                    : "#9A3412"}
                />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* ========== 1a-quater. MOOD INTERVENTION CARD ========== */}
        {/* Phase D3 of feat(mood). Renders when a pending mood_intervention
            exists for this member (hook filters on outcome IN
            ('pending','pending_review','sent','viewed')). Color adapts to
            tier_at_trigger from the snapshot that triggered the offer:
              - 'drifting'    → yellow (warm_checkin, soft nudge)
              - 'disengaging' → orange (contribution_pause, moderate)
              - 'at_risk'     → red    (human_outreach, requires_review)
            Whole card opens MoodInsightsScreen where the member sees the
            full 5-signal breakdown, accept/decline buttons, and the
            opt-out toggle. Engine title/body localized EN/FR by the RPC. */}
        {hasMoodIntervention && moodIntervention && (
          <TouchableOpacity
            style={[
              styles.moodCard,
              moodIntervention.tierAtTrigger === "at_risk" ? styles.moodCardRed :
              moodIntervention.tierAtTrigger === "disengaging" ? styles.moodCardOrange :
              styles.moodCardYellow,
            ]}
            onPress={() => navigation.navigate(Routes.MoodInsights)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open mood insights"
          >
            <View style={[
              styles.moodIcon,
              moodIntervention.tierAtTrigger === "at_risk" ? styles.moodIconRed :
              moodIntervention.tierAtTrigger === "disengaging" ? styles.moodIconOrange :
              styles.moodIconYellow,
            ]}>
              <Ionicons
                name={moodIntervention.tierAtTrigger === "at_risk" ? "heart" : "chatbubble-ellipses-outline"}
                size={22}
                color={
                  moodIntervention.tierAtTrigger === "at_risk" ? "#991B1B" :
                  moodIntervention.tierAtTrigger === "disengaging" ? "#9A3412" :
                  "#92400E"
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[
                styles.moodTitle,
                moodIntervention.tierAtTrigger === "at_risk" ? { color: "#991B1B" } :
                moodIntervention.tierAtTrigger === "disengaging" ? { color: "#9A3412" } :
                { color: "#92400E" },
              ]}>
                {moodIntervention.messageTitle}
              </Text>
              <Text style={[
                styles.moodBody,
                moodIntervention.tierAtTrigger === "at_risk" ? { color: "#7F1D1D" } :
                moodIntervention.tierAtTrigger === "disengaging" ? { color: "#7C2D12" } :
                { color: "#78350F" },
              ]} numberOfLines={3}>
                {moodIntervention.messageBody}
              </Text>
              <View style={styles.moodCtaRow}>
                <Text style={[
                  styles.moodCtaText,
                  moodIntervention.tierAtTrigger === "at_risk" ? { color: "#991B1B" } :
                  moodIntervention.tierAtTrigger === "disengaging" ? { color: "#9A3412" } :
                  { color: "#92400E" },
                ]}>
                  {t("dashboard.intervention_view_details")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={
                    moodIntervention.tierAtTrigger === "at_risk" ? "#991B1B" :
                    moodIntervention.tierAtTrigger === "disengaging" ? "#9A3412" :
                    "#92400E"
                  }
                />
              </View>
            </View>
          </TouchableOpacity>
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
            <Text style={styles.walletCardLabel}>{t("dashboard.wallet_label")}</Text>
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
              <Text style={styles.recoveryBannerTitle}>{t("dashboard.recovery_title")}</Text>
              <Text style={styles.recoveryBannerSubtitle} numberOfLines={2}>
                {t("dashboard.recovery_subtitle")}
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
                  {t("dashboard.interest_earned")}
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
                  {t("dashboard.interest_accruing")}
                </Text>
                <Text style={styles.interestCardAmount}>
                  ${totalAccruedInterest.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.interestCardCta}>{t("dashboard.interest_unlock")}</Text>
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
            <Text style={styles.sectionTitle}>{t("dashboard.section_your_circles")}</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Circles")}
              accessibilityLabel="Manage circles"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>{t("dashboard.section_manage")}</Text>
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
                  <Text style={styles.circleMembers}>
                    {t("dashboard.circle_members_count", { count: circle.members })}
                  </Text>
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
              <Text style={styles.newCircleText}>{t("dashboard.circle_start_new")}</Text>
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
              <Text style={styles.arrivalBold}>{t("dashboard.arrival_strip_count_bold")}</Text>
              {t("dashboard.arrival_strip_suffix")}
            </Text>
          </View>
          <Text style={styles.arrivalCta}>{t("dashboard.arrival_strip_cta")}</Text>
        </TouchableOpacity>

        {/* ========== 5b. MY TRIPS \u2014 real preview when trips exist, static tile as empty state ========== */}
        {organizerTrips.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("dashboard.section_my_trips")}</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate("OrganizerTripList" as any)}
                accessibilityLabel="See all my trips"
                accessibilityRole="button"
              >
                <Text style={styles.sectionLink}>{t("dashboard.section_see_all")}</Text>
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
                          {t(`dashboard.trip_status_${statusKey}`, {
                            defaultValue:
                              statusKey.charAt(0).toUpperCase() + statusKey.slice(1),
                          })}
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
                <Text style={styles.tripSeeMoreText}>{t("dashboard.trip_see_all_card")}</Text>
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
                <Text style={styles.tripOrganizerTitle}>{t("dashboard.trips_empty_title")}</Text>
                <Text style={styles.tripOrganizerDesc}>{t("dashboard.trips_empty_desc")}</Text>
              </View>
            </View>
            <View style={styles.tripOrganizerCta}>
              <Text style={styles.tripOrganizerCtaText}>{t("dashboard.trips_empty_cta")}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ========== 6. COMMUNITY FEED ========== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t("dashboard.section_community")}</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Community")}
              accessibilityLabel="Explore community"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>{t("dashboard.section_explore")}</Text>
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
            <Text style={styles.sectionTitle}>{t("dashboard.section_near_you")}</Text>
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate("Market")}
              accessibilityLabel="See all services"
              accessibilityRole="button"
            >
              <Text style={styles.sectionLink}>{t("dashboard.section_see_all_caps")}</Text>
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
                    {service.elderEndorsed
                      ? t("dashboard.service_elder_endorsed")
                      : t("dashboard.service_trusted")}
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

  // ── Stress intervention card (Phase D3 of feat(stress)) ──────────────
  // Two color variants share dimensions / layout; only background +
  // border tone change with intervention_type. Whole card is touchable
  // and navigates to StressScoreDashboard.
  stressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  stressCardOrange: {
    backgroundColor: "#FFEDD5",   // orange-100
    borderColor: "#FDBA74",       // orange-300
  },
  stressCardRed: {
    backgroundColor: "#FEE2E2",   // red-100
    borderColor: "#FCA5A5",       // red-300
  },
  stressIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  stressIconOrange: {
    backgroundColor: "#FED7AA",   // orange-200
  },
  stressIconRed: {
    backgroundColor: "#FECACA",   // red-200
  },
  stressTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 4,
  },
  stressBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  stressCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  stressCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Mood intervention card (Phase D3 of feat(mood)) ──────────────────
  // Three color variants share layout; tone shifts with tier_at_trigger.
  // Engine bands: drifting=warm_checkin (yellow), disengaging=
  // contribution_pause (orange), at_risk=human_outreach (red).
  moodCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  moodCardYellow: {
    backgroundColor: "#FEF3C7",   // amber-100
    borderColor: "#FCD34D",       // amber-300
  },
  moodCardOrange: {
    backgroundColor: "#FFEDD5",   // orange-100
    borderColor: "#FDBA74",       // orange-300
  },
  moodCardRed: {
    backgroundColor: "#FEE2E2",   // red-100
    borderColor: "#FCA5A5",       // red-300
  },
  moodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  moodIconYellow: {
    backgroundColor: "#FDE68A",   // amber-200
  },
  moodIconOrange: {
    backgroundColor: "#FED7AA",   // orange-200
  },
  moodIconRed: {
    backgroundColor: "#FECACA",   // red-200
  },
  moodTitle: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 4,
  },
  moodBody: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  moodCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  moodCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ── Tier card (Phase D3 of feat(tier)) ───────────────────────────────
  // Single horizontal card showing tier emoji + label + progress to next
  // tier + access summary. Background and border tone follow the tier's
  // color from graduated_entry_tiers seed data.
  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  tierIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tierEmoji: {
    fontSize: 18,
  },
  tierLabelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  tierProgress: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
  },
  tierProgressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
    marginBottom: 6,
  },
  tierProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  tierFooter: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "500",
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
