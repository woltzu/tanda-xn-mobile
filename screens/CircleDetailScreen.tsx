import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  Share,
  ActivityIndicator,
  Platform,
  Animated,
  RefreshControl,
  FlatList,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { Routes } from "../lib/routes";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
import { colors } from "../theme/tokens";
import { Circle, CircleMember, CircleActivity, useCircles } from "../context/CirclesContext";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../context/AuthContext";
import { useActivePlan } from "../hooks/usePartialContribution";
import { useCircleHealth } from "../hooks/useCircleHealth";
import { useSubstitutePoolSummary } from "../hooks/useSubstituteMember";
import { useCircleProposals } from "../hooks/useCircleDemocracy";
import { useCircleAutopayConfig } from "../hooks/useCircleAutopay";
import { useCircleAutopaySuggestion } from "../hooks/useCircleAutopaySuggestion";
import { useCircleNotificationMute } from "../hooks/useCircleNotificationMute";
import { useCircleDetail } from "../hooks/useCircleDetail";
import { useEventTracker } from "../hooks/useEventTracker";
import { useRoles } from "../hooks/useRoles";
// Phase 2 (migration 257) — critical-tier gate. Intercepts contribute taps
// before the navigation fires; the trigger tr_block_critical_contribution
// would otherwise reject the eventual Stripe-webhook INSERT and the user
// would only learn at payment time. Imperative variant used here so the
// pulse animation on the bottom-bar Contribute button isn't broken by a
// wrapper element.
import { useRestrictedAction } from "../components/RestrictedActionGate";
import { useCircleRiskFlags, MemberRiskFlag } from "../hooks/useCircleRiskFlags";
import MuteCircleSheet from "../components/MuteCircleSheet";
import FileDisputeModal from "../components/FileDisputeModal";
import { showToast } from "../components/Toast";
import { supabase } from "../lib/supabase";

type CircleDetailNavigationProp = StackNavigationProp<RootStackParamList>;
type CircleDetailRouteProp = RouteProp<RootStackParamList, "CircleDetail">;

// User role types for the circle
type UserRole = "member" | "admin" | "elder";

const { width } = Dimensions.get("window");

// Menu item interface for cleaner code
interface MenuItem {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  description?: string;
}

const getCircleTypeLabel = (type: string): string => {
  switch (type) {
    case "traditional":
      return "Rotating Pot";
    case "family-support":
      return "Single Beneficiary";
    case "goal":
    case "goal-based":
      return "Shared Goal";
    case "emergency":
      return "Emergency Pool";
    case "beneficiary":
      return "Flexible Fundraise";
    default:
      return "Savings Circle";
  }
};

const getFrequencyLabel = (frequency: string): string => {
  switch (frequency) {
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    case "one-time":
      return "One-time";
    default:
      return frequency;
  }
};

const getRotationMethodLabel = (method: string): string => {
  switch (method) {
    case "xnscore":
      return "By XnScore";
    case "random":
      return "Random Draw";
    case "manual":
      return "Manual Assignment";
    case "beneficiary":
      return "Fixed Beneficiary";
    default:
      return method;
  }
};

export default function CircleDetailScreen() {
  const navigation = useNavigation<CircleDetailNavigationProp>();
  const route = useRoute<CircleDetailRouteProp>();
  const { t } = useTranslation();
  const { circleId } = route.params;
  const { circles, browseCircles, myCircles } = useCircles();
  // Aggregate members + activities + 30 s cache lives in this hook; the
  // refresh() handle below covers pull-to-refresh, realtime events, and
  // future "I just contributed, bust the cache" callers.
  const {
    members,
    activities,
    isLoadingMembers,
    isLoadingActivities,
    fetchData,
    refresh,
  } = useCircleDetail(circleId);
  const { user } = useAuth();
  // Phase 1 of Circle Contribution Autopay — drives the "Autopay
  // enabled" badge below. Single network call, 60-s cached in the
  // hook; null when the user has no autopay for this circle.
  const { config: autopayConfig } = useCircleAutopayConfig(circleId);
  const autopayActive =
    !!autopayConfig &&
    autopayConfig.enabled &&
    autopayConfig.status === "active";
  const autopayPaused =
    !!autopayConfig && autopayConfig.status === "paused";
  // Phase 2 — missed-contribution suggestion banner. detect_missed_circle_contributions
  // inserts a row when the user missed a cycle without having autopay
  // set up. Banner is dismissible.
  const { suggestion: autopaySuggestion, dismiss: dismissSuggestion } =
    useCircleAutopaySuggestion(circleId);
  const showAutopaySuggestion =
    !!autopaySuggestion && !autopayActive && !autopayPaused;
  // Phase 2 (notification-prefs review): per-circle notification mute.
  // Tapping the bell opens the bottom sheet; the screen renders a
  // "Muted" pill near the circle name when active.
  const {
    isMuted: circleMuted,
    mute: muteCircle,
    unmute: unmuteCircle,
  } = useCircleNotificationMute(circleId);
  // Phase 2 — sensitive signal nudges (migration 256). Elders see a
  // derived low/medium/high flag on each member row; non-elders skip
  // the RPC entirely. The RPC also enforces elder-only server-side.
  // Distinct from `isElder` further down (that's userRole === 'elder',
  // a per-circle role); this is the app-wide governance role.
  const { isElder: isAppElder } = useRoles(user?.id);
  const { isBlocked: isContributeBlocked, showBlockedAlert: showContributeBlocked } =
    useRestrictedAction();
  const { flags: riskFlags } = useCircleRiskFlags(
    isAppElder ? circleId : undefined,
  );
  const riskMap = useMemo(() => {
    const m = new Map<string, MemberRiskFlag>();
    for (const f of riskFlags) m.set(f.user_id, f);
    return m;
  }, [riskFlags]);
  const [muteSheetOpen, setMuteSheetOpen] = useState(false);
  // Phase 2 — file-dispute modal state (mounted at the bottom of this screen).
  const [fileDisputeOpen, setFileDisputeOpen] = useState(false);
  const handleMute = async (durationDays: number | null) => {
    try {
      await muteCircle(durationDays);
      showToast(t("mute_circle.toast_muted"), "success");
    } catch {
      showToast(t("mute_circle.toast_failed"), "error");
    }
  };
  const handleUnmute = async () => {
    try {
      await unmuteCircle();
      showToast(t("mute_circle.toast_unmuted"), "success");
    } catch {
      showToast(t("mute_circle.toast_failed"), "error");
    }
  };

  const [activeTab, setActiveTab] = useState<"overview" | "members" | "activity">("overview");
  const [showMenu, setShowMenu] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);

  // First-visit coach mark on the Contribute hero. Per-user one-shot
  // gated by AsyncStorage; auto-dismisses after 4 s or on tap of the
  // tooltip / CTA. Ref-guarded so StrictMode double-mount doesn't
  // re-trigger it after the user has already seen it within this
  // session.
  const HERO_COACH_KEY = "@tandaxn_circle_detail_hero_seen_v1";
  const [showHeroCoach, setShowHeroCoach] = useState(false);
  const heroCoachChecked = useRef(false);
  useEffect(() => {
    if (heroCoachChecked.current) return;
    heroCoachChecked.current = true;
    let cancelled = false;
    AsyncStorage.getItem(HERO_COACH_KEY)
      .then((v) => {
        if (cancelled || v) return;
        setShowHeroCoach(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!showHeroCoach) return;
    const tid = setTimeout(() => dismissHeroCoach(), 4000);
    return () => clearTimeout(tid);
    // dismissHeroCoach is stable; intentionally omitted from deps to avoid
    // resetting the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHeroCoach]);
  const dismissHeroCoach = () => {
    setShowHeroCoach(false);
    AsyncStorage.setItem(HERO_COACH_KEY, "1").catch(() => undefined);
  };

  // Telemetry. The `opened` event is ref-guarded so React StrictMode
  // double-mounts don't double-emit. Tab switches and Contribute taps
  // fire on every interaction. Realtime events fire from inside the
  // channel callbacks below.
  const { track } = useEventTracker();
  const openedTrackedRef = useRef(false);
  const trackTabSwitch = (tab: "overview" | "members" | "activity") => {
    if (tab === activeTab) return;
    track({
      eventType: "circle_detail_tab_switched",
      eventCategory: "savings",
      eventAction: "tab_switched",
      eventLabel: tab,
      eventValue: { circleId, tabName: tab },
    });
    setActiveTab(tab);
  };
  const trackContributeTap = (origin: "hero" | "bottom_bar") => {
    track({
      eventType: "circle_detail_contribute_tapped",
      eventCategory: "savings",
      eventAction: "contribute_tapped",
      eventLabel: origin,
      eventValue: { circleId, origin },
    });
  };

  // P2 (first-launch review): when the user lands on a circle detail
  // for the very first time after their initial circle join (myCircles
  // length === 1) AND the shown-flag isn't already set, kick off a
  // 5-second pulse around the Contribute button. The AsyncStorage
  // flag is the one-shot gate — once written, never pulses again.
  const HIGHLIGHT_FLAG_KEY = "@tandaxn_onboarding_highlight_contribute_v1";
  const [shouldPulse, setShouldPulse] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if ((myCircles?.length ?? 0) !== 1) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(HIGHLIGHT_FLAG_KEY);
        if (cancelled || seen) return;
        await AsyncStorage.setItem(HIGHLIGHT_FLAG_KEY, "1");
        if (!cancelled) setShouldPulse(true);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myCircles?.length]);

  useEffect(() => {
    if (!shouldPulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Auto-clear after 5 s so the pulse isn't permanent if the user
    // sits on the screen without tapping Contribute.
    pulseTimerRef.current = setTimeout(() => {
      setShouldPulse(false);
    }, 5000);
    return () => {
      loop.stop();
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }
    };
  }, [shouldPulse, pulseAnim]);


  // Phase D4 of feat(partial). Active partial-contribution plan for this
  // member + this circle (driven by the migration 102 RPCs, surfaced via
  // the existing useActivePlan hook which queries partial_contribution_plans
  // directly — that read is clean against prod schema).
  const {
    plan: partialPlan,
    hasPlan: hasPartialPlan,
    catchUpProgress: partialProgress,
    nextCatchUpDate: partialNextDue,
    remainingAmount: partialRemaining,
  } = useActivePlan(user?.id, circleId);

  // Phase D3 of feat(circle-health). Circle health score driven by the
  // (now-fixed) compute_circle_health_score function in migration 104.
  // Initial load + realtime updates from the nightly scoring-pipeline cron.
  const {
    health: circleHealth,
    recomputing: healthRecomputing,
    recompute: recomputeHealth,
    statusVisual: healthStatusVisual,
    trendVisual: healthTrendVisual,
    scoreDelta: healthDelta,
  } = useCircleHealth(circleId);

  // Substitute Pool Bucket B — global active-substitute count for the
  // entry row added below the icon strip. The hook keeps itself fresh via
  // a postgres_changes subscription on substitute_pool.
  const { overview: substituteOverview } = useSubstitutePoolSummary();
  const substituteAvailableCount = substituteOverview?.totalActive ?? 0;

  // Voting Bucket A — open-count badge on the header voting icon. Uses the
  // same hook that drives the voting screen so it stays in sync (the hook
  // subscribes to postgres_changes on circle_proposals).
  const { activeProposals: openProposalsForBadge } = useCircleProposals(circleId);
  const openProposalCount = openProposalsForBadge.length;

  // Find the circle in all available sources: user circles, my circles, or browse circles
  const circle = [...circles, ...myCircles, ...browseCircles].find((c) => c.id === circleId);

  // Fetch members and activities when screen is focused or circleId changes.
  // `fetchData()` is cache-aware so re-focuses inside the 30 s TTL don't
  // refire the round-trips.
  useFocusEffect(
    React.useCallback(() => {
      fetchData({ showSpinner: true });
    }, [fetchData])
  );

  // Pull-to-refresh — busts the cache and re-runs the aggregate fetch +
  // refreshCircles via the hook.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh({ skipSpinner: true });
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  // Realtime subscriptions: keep the screen in sync without forcing the
  // user to leave + return. Both handlers call refresh() which busts the
  // 30 s cache and re-runs members + activities + circle row in parallel
  // — that's the canonical sync path so the cache stays consistent across
  // focuses, refreshes, and live events. Channels are torn down on
  // unmount/circle change so a navigated-back-to session doesn't
  // accumulate them.
  useEffect(() => {
    if (!circleId) return;
    const contribChannel = supabase
      .channel(`circle-detail:contributions:${circleId}`)
      .on(
        // supabase-js v2 narrows postgres_changes via a string-literal
        // overload that the channel-builder type doesn't expose, hence the cast.
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "contributions",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload: { eventType?: string }) => {
          track({
            eventType: "circle_detail_realtime_event_received",
            eventCategory: "savings",
            eventAction: "realtime_event_received",
            eventLabel: "contributions",
            eventValue: {
              circleId,
              table: "contributions",
              event: payload?.eventType ?? "INSERT",
            },
          });
          refresh({ skipSpinner: true });
        }
      )
      .subscribe();

    const membersChannel = supabase
      .channel(`circle-detail:members:${circleId}`)
      .on(
        // supabase-js v2 narrows postgres_changes via a string-literal
        // overload that the channel-builder type doesn't expose, hence the cast.
        "postgres_changes" as any,
        {
          event: "*", // INSERT or DELETE
          schema: "public",
          table: "circle_members",
          filter: `circle_id=eq.${circleId}`,
        },
        (payload: { eventType?: string }) => {
          track({
            eventType: "circle_detail_realtime_event_received",
            eventCategory: "savings",
            eventAction: "realtime_event_received",
            eventLabel: "circle_members",
            eventValue: {
              circleId,
              table: "circle_members",
              event: payload?.eventType ?? "*",
            },
          });
          refresh({ skipSpinner: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contribChannel);
      supabase.removeChannel(membersChannel);
    };
  }, [circleId, refresh, track]);

  if (!circle) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[colors.primaryNavy, "#143654"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.cardBg} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("circle_detail.not_found_header")}</Text>
        </LinearGradient>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t("circle_detail.not_found_body")}</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>{t("circle_detail.btn_go_back")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isOneTime = circle.frequency === "one-time";
  const hasBeneficiary = circle.beneficiaryName;
  const totalPot = circle.amount * circle.memberCount;
  const paidMembers = members.filter((m) => m.hasPaid).length;
  const paymentProgress = members.length > 0 ? (paidMembers / members.length) * 100 : 0;

  // Check if user is a member of this circle (circle is in myCircles)
  const isMember = myCircles.some((c) => c.id === circleId);
  const spotsLeft = circle.memberCount - circle.currentMembers;
  const isFull = spotsLeft <= 0;

  // Authoritative invite code from the server (gen_invite_code() — migration
  // 141). The previous line built a fake code from `name.slice(0,10) + year`,
  // which never matched the real value stored in `circles.invite_code` — so
  // every "Share" handed out a code the lookup couldn't find.
  const inviteCode = circle.inviteCode ?? "";

  // Local feedback when the user taps "Copy" — flips to true for ~1.6s.
  const [codeCopied, setCodeCopied] = useState(false);
  const handleCopyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1600);
  };

  // Menu actions
  const handleInviteMembers = async () => {
    try {
      // Surface the raw code on its own line so the recipient can paste it
      // directly into "Have an invite code?" — many users on iMessage /
      // WhatsApp won't click the link and need the code visible.
      await Share.share({
        message:
          `You've been invited to join ${circle.name} on TandaXn!\n\n` +
          `Invite code: ${inviteCode}\n\n` +
          `Or tap to join instantly: https://v0-tanda-xn.vercel.app/join/${inviteCode}`,
        title: `Join ${circle.name}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleGroupChat = () => {
    navigation.navigate("GroupChat", { circleId: circle.id, circleName: circle.name });
  };

  const handleCircleSettings = () => {
    setShowMenu(false);
    navigation.navigate("AdminSettings", { circleName: circle?.name || "", circleId });
  };

  const handleLeaveCircle = () => {
    setShowMenu(false);
    navigation.navigate("LeaveCircle", {
      circleName: circle.name,
      circleId,
      memberPosition: circle.myPosition || 1,
      totalMembers: circle.memberCount,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      hasReceivedPayout: false,
    });
  };

  // Phase D2 of feat(position-swap) #18. PositionSwapScreen was registered
  // in CirclesStack but had no navigation entry point — entirely orphan
  // despite the entire backend (14 RPCs + cron + EF) being deployed and
  // ready. This menu item makes the lifecycle reachable.
  const handleSwapPosition = () => {
    setShowMenu(false);
    navigation.navigate("PositionSwap", { circleId });
  };

  // Determine user's role in this circle
  const getUserRole = (): UserRole => {
    // Check if user is the creator (admin)
    if (circle.createdBy === user?.id) return "admin";

    // Check members for admin/elder status
    const currentUserMember = members.find(m => m.isCurrentUser);
    if (currentUserMember?.role === "creator" || currentUserMember?.role === "admin") return "admin";
    if (currentUserMember?.role === "elder") return "elder";

    return "member";
  };

  const userRole = getUserRole();
  const isAdmin = userRole === "admin";
  const isElder = userRole === "elder";

  // `opened` telemetry. Waits for the role to be derivable from the
  // current members list so the role label is accurate; until then we
  // re-render and fire once.
  useEffect(() => {
    if (openedTrackedRef.current) return;
    openedTrackedRef.current = true;
    track({
      eventType: "circle_detail_opened",
      eventCategory: "savings",
      eventAction: "opened",
      eventLabel: userRole,
      eventValue: { circleId, role: userRole },
    });
  }, [track, circleId, userRole]);

  // === ALL USERS Menu Handlers ===
  const handleViewCircleRules = () => {
    setShowMenu(false);
    Alert.alert(
      "Circle Rules",
      `${circle.name} Rules:\n\n` +
      `1. Contribution: $${circle.amount} ${getFrequencyLabel(circle.frequency).toLowerCase()}\n` +
      `2. Grace Period: ${circle.gracePeriodDays} day(s)\n` +
      `3. Payout Order: ${getRotationMethodLabel(circle.rotationMethod)}\n` +
      `4. Members: ${circle.memberCount} total\n\n` +
      `Late payments may affect your XnScore and standing in the circle.`,
      [{ text: "Got It" }]
    );
  };

  const handleShareCircle = async () => {
    setShowMenu(false);
    try {
      await Share.share({
        message:
          `You've been invited to join ${circle.name} on TandaXn!\n\n` +
          `Invite code: ${inviteCode}\n\n` +
          `Or tap to join instantly: https://v0-tanda-xn.vercel.app/join/${inviteCode}`,
        title: `Share ${circle.name}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleHelpSupport = () => {
    setShowMenu(false);
    navigation.navigate("HelpCenter");
  };

  const handleReportIssue = () => {
    setShowMenu(false);
    navigation.navigate("ReportIssue", { circleName: circle.name, circleId });
  };

  // Phase 2 — file a formal dispute against another member of this circle.
  // Modal is mounted at the bottom of this screen.
  const handleFileDispute = () => {
    setShowMenu(false);
    setFileDisputeOpen(true);
  };

  // Phase 2 — navigate to the list of disputes filed in this circle.
  // RLS limits results to disputes the caller can see.
  const handleViewDisputes = () => {
    setShowMenu(false);
    navigation.navigate("DisputesList", { circleId });
  };

  // === REGULAR MEMBER Menu Handlers ===
  const handlePaymentHistory = () => {
    setShowMenu(false);
    navigation.navigate("PaymentHistory", { circleId });
  };

  const handlePaymentReminders = () => {
    setShowMenu(false);
    Alert.alert(
      "Payment Reminders",
      "Set up your payment reminders",
      [
        { text: t("circle_detail.alert_reminder_1d"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_1d_body")) },
        { text: t("circle_detail.alert_reminder_3d"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_3d_body")) },
        { text: t("circle_detail.alert_reminder_1w"), onPress: () => Alert.alert(t("circle_detail.alert_reminder_set_title"), t("circle_detail.alert_reminder_1w_body")) },
        { text: "Manage All", onPress: () => navigation.navigate("NotificationPrefs") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // === ADMIN Menu Handlers ===
  const handleManageMembers = () => {
    setShowMenu(false);
    navigation.navigate("ManageMembers", { circleName: circle.name, circleId });
  };

  const handlePauseCircle = () => {
    setShowMenu(false);
    navigation.navigate("PauseCircle", {
      circleName: circle.name,
      circleId,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      memberCount: circle.currentMembers,
    });
  };

  const handleCloseCircle = () => {
    setShowMenu(false);
    navigation.navigate("CloseCircle", {
      circleName: circle.name,
      circleId,
      currentCycle: circle.currentCycle || 1,
      totalCycles: circle.memberCount,
      memberCount: circle.currentMembers,
      totalContributed: circle.amount * circle.currentMembers * (circle.currentCycle || 1),
      outstandingPayouts: circle.memberCount - (circle.currentCycle || 1),
    });
  };

  const handleExportData = () => {
    setShowMenu(false);
    navigation.navigate("ExportData", { circleName: circle.name, circleId });
  };

  const handleAdminSettings = () => {
    setShowMenu(false);
    navigation.navigate("AdminSettings", { circleName: circle.name, circleId });
  };

  // === ELDER Menu Handlers ===
  const handleOversightDashboard = () => {
    setShowMenu(false);
    navigation.navigate("OversightDashboard", { circleName: circle.name, circleId });
  };

  const handleMediationTools = () => {
    setShowMenu(false);
    // Conflict P1 (2026-06-12): MediationTools is now an alias for the merged
    // ConflictCaseScreen — but route by the canonical name so callers can
    // find the navigation target without crossing the alias.
    navigation.navigate("ConflictCase", { circleName: circle.name, circleId });
  };

  const handleAuditTrail = () => {
    setShowMenu(false);
    navigation.navigate("AuditTrail", { circleName: circle.name, circleId });
  };

  // Method-specific help body for the (?) icon next to the rotation
  // method label. Same vocabulary as the Create-circle wizard so
  // returning users see consistent copy.
  const showRotationHelp = (method: string) => {
    const bodyKey =
      method === "xnscore"
        ? "circle_detail.help_rotation_xnscore_body"
        : method === "manual"
        ? "circle_detail.help_rotation_manual_body"
        : method === "random"
        ? "circle_detail.help_rotation_random_body"
        : method === "beneficiary"
        ? "circle_detail.help_rotation_beneficiary_body"
        : "circle_detail.help_rotation_generic_body";
    Alert.alert(t("circle_detail.help_rotation_title"), t(bodyKey));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getNextPayoutDate = () => {
    const start = new Date(circle.startDate);
    const now = new Date();
    let next = new Date(start);

    while (next <= now) {
      switch (circle.frequency) {
        case "daily":
          next.setDate(next.getDate() + 1);
          break;
        case "weekly":
          next.setDate(next.getDate() + 7);
          break;
        case "biweekly":
          next.setDate(next.getDate() + 14);
          break;
        case "monthly":
          next.setMonth(next.getMonth() + 1);
          break;
        default:
          return start;
      }
    }
    return next;
  };

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Next-contribution hero — answers "when do I owe money?" up
          front. Only meaningful for members of a recurring circle; one-
          time and beneficiary circles already surface the relevant
          info in their dedicated cards.

          "Your turn" variant: when the member's position matches the
          current cycle, they're about to *receive* the payout — swap
          the copy and accent so the screen leads with the celebration
          instead of the contribution prompt. */}
      {isMember && !isOneTime ? (
        (() => {
          // Priority order: payout-received (24h after) > your-turn >
          // next-contribution. The first two are time-limited celebration
          // states; the third is the default daily prompt.
          const latestUserPayout = activities
            .filter((a) => a.type === "payout" && a.isCurrentUser)
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            )[0];
          const payoutWithin24h =
            !!latestUserPayout &&
            Date.now() - new Date(latestUserPayout.timestamp).getTime() <
              24 * 60 * 60 * 1000;
          const isYourTurn =
            !payoutWithin24h &&
            !!circle.myPosition &&
            circle.myPosition === (circle.currentCycle ?? 1) &&
            !hasBeneficiary;

          let label: string;
          let iconName: "trophy" | "calendar" | "checkmark-circle";
          let iconColor: string;
          let iconBg: string;
          let cardExtraStyle = undefined as any;

          if (payoutWithin24h) {
            label = t("circle_detail.hero_payout_received", {
              amount: latestUserPayout!.amount ?? 0,
              date: formatDate(latestUserPayout!.timestamp),
            });
            iconName = "checkmark-circle";
            iconColor = colors.successLabel;
            iconBg = "rgba(5,150,105,0.18)";
            cardExtraStyle = styles.heroNextCardReceived;
          } else if (isYourTurn) {
            label = t("circle_detail.hero_your_turn", {
              amount: circle.amount * circle.memberCount,
              date: formatDate(getNextPayoutDate().toISOString()),
            });
            iconName = "trophy";
            iconColor = colors.warningLabel;
            iconBg = "rgba(245,158,11,0.18)";
            cardExtraStyle = styles.heroNextCardYourTurn;
          } else {
            label = t("circle_detail.hero_next_contribution", {
              amount: circle.amount,
              date: formatDate(getNextPayoutDate().toISOString()),
              cycle: circle.currentCycle ?? 1,
              total: circle.memberCount,
            });
            iconName = "calendar";
            iconColor = colors.primaryNavy;
            iconBg = "rgba(0,198,174,0.15)";
          }

          return (
            <TouchableOpacity
              style={[styles.heroNextCard, cardExtraStyle]}
              activeOpacity={0.85}
              onPress={() => {
                if (payoutWithin24h) {
                  // Post-payout card routes to the user's wallet —
                  // the contribution prompt isn't relevant for 24 h.
                  navigation.navigate("WalletMain" as never);
                  return;
                }
                if (isContributeBlocked) return showContributeBlocked();
                trackContributeTap("hero");
                navigation.navigate("MakeContribution", { circleId });
              }}
              accessibilityRole="button"
            >
              <View style={[styles.heroNextIcon, { backgroundColor: iconBg }]}>
                <Ionicons name={iconName} size={22} color={iconColor} />
              </View>
              <Text style={styles.heroNextText}>{label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.primaryNavy} />
            </TouchableOpacity>
          );
        })()
      ) : null}

      {/* Hero CTA — large primary Contribute button. Pairs with the
          hero-next-contribution card above so the answer to "what do I
          do?" is one tap away without scrolling. The sticky bottom-bar
          Contribute remains as the redundant safety net for users who
          scroll past this. */}
      {isMember ? (
        <>
          <TouchableOpacity
            style={styles.contributeHeroCta}
            activeOpacity={0.85}
            onPress={() => {
              if (showHeroCoach) dismissHeroCoach();
              if (isContributeBlocked) return showContributeBlocked();
              trackContributeTap("hero");
              navigation.navigate("MakeContribution", { circleId });
            }}
            accessibilityRole="button"
          >
            <Ionicons name="wallet" size={22} color={colors.cardBg} />
            <Text style={styles.contributeHeroCtaText}>
              {t("circle_detail.contribute_now_cta", { amount: circle.amount })}
            </Text>
          </TouchableOpacity>

          {showHeroCoach ? (
            <TouchableOpacity
              style={styles.heroCoachTip}
              onPress={dismissHeroCoach}
              accessibilityRole="button"
              accessibilityLabel={t("circle_detail.coach_hero_tip")}
            >
              <Ionicons name="arrow-up" size={14} color={colors.primaryNavy} />
              <Text style={styles.heroCoachTipText}>
                {t("circle_detail.coach_hero_tip")}
              </Text>
              <Ionicons name="close" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      {/* Hero strip — promotes the two highest-stakes facts (next
          payout date + your payout position) above the Circle Details
          card where they used to be buried. Only renders when both
          would be meaningful: rotating circles, member view. */}
      {isMember && !isOneTime && !hasBeneficiary ? (
        <View style={styles.heroStripRow}>
          <View style={styles.heroStripChip}>
            <Ionicons name="cash-outline" size={14} color="#00897B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroStripLabel}>
                {t("circle_detail.hero_next_payout")}
              </Text>
              <Text style={styles.heroStripValue}>
                {formatDate(getNextPayoutDate().toISOString())}
              </Text>
            </View>
          </View>
          {circle.myPosition ? (
            <View style={styles.heroStripChip}>
              <Ionicons name="trophy-outline" size={14} color={colors.warningLabel} />
              <View style={{ flex: 1 }}>
                <Text style={styles.heroStripLabel}>
                  {t("circle_detail.hero_your_position")}
                </Text>
                <Text style={styles.heroStripValue}>
                  {t("circle_detail.position_format", {
                    position: circle.myPosition,
                    total: circle.memberCount,
                  })}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* "Your payout in N cycles" countdown chip. Only when:
            - user is a rotating-circle member with a known position
            - they're NOT the current payer (the hero already says "your turn")
            - their position is later in the rotation than the current cycle
          Estimated date = today + (cycleSpan × frequencyMs). frequencyMs
          uses the same period table as getNextPayoutDate. */}
      {isMember && !isOneTime && !hasBeneficiary && circle.myPosition ? (
        (() => {
          const currentCycle = circle.currentCycle ?? 1;
          const cyclesAway = circle.myPosition - currentCycle;
          if (cyclesAway <= 0) return null;
          const periodMs =
            circle.frequency === "daily"
              ? 24 * 60 * 60 * 1000
              : circle.frequency === "weekly"
              ? 7 * 24 * 60 * 60 * 1000
              : circle.frequency === "biweekly"
              ? 14 * 24 * 60 * 60 * 1000
              : 30 * 24 * 60 * 60 * 1000;
          const eta = new Date(Date.now() + cyclesAway * periodMs);
          return (
            <View style={styles.payoutCountdownChip}>
              <Ionicons name="time-outline" size={14} color={colors.primaryNavy} />
              <Text style={styles.payoutCountdownText}>
                {t("circle_detail.payout_in_cycles", {
                  cycles: cyclesAway,
                  date: formatDate(eta.toISOString()),
                })}
              </Text>
            </View>
          );
        })()
      ) : null}

      {/* Compact icon strip — Invite · Chat · Autopay · Mute. Demoted
          from the equal-weight 5-button Quick Actions card; Contribute
          now lives as the hero CTA above. */}
      {isMember ? (
        <View style={styles.iconActionsRow}>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={handleInviteMembers}
            accessibilityRole="button"
            accessibilityLabel={t("circle_detail.action_invite_members")}
          >
            <View style={[styles.iconActionIcon, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="share-social-outline" size={18} color="#6366F1" />
            </View>
            <Text style={styles.iconActionLabel} numberOfLines={1}>
              {t("circle_detail.action_invite_members_short")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={handleGroupChat}
            accessibilityRole="button"
            accessibilityLabel={t("circle_detail.action_group_chat")}
          >
            <View style={[styles.iconActionIcon, { backgroundColor: colors.warningBg }]}>
              <Ionicons name="chatbubbles-outline" size={18} color={colors.warningAmber} />
            </View>
            <Text style={styles.iconActionLabel} numberOfLines={1}>
              {t("circle_detail.action_group_chat_short")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => navigation.navigate("CircleAutopaySetup", { circleId })}
            accessibilityRole="button"
            accessibilityLabel={t("circle_detail.action_set_up_autopay")}
          >
            <View style={[styles.iconActionIcon, { backgroundColor: colors.successBg }]}>
              <Ionicons name="repeat-outline" size={18} color="#047857" />
            </View>
            <Text style={styles.iconActionLabel} numberOfLines={1}>
              {t("circle_detail.action_set_up_autopay_short")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => setMuteSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t(
              circleMuted
                ? "circle_detail.action_unmute_circle"
                : "circle_detail.action_mute_circle",
            )}
          >
            <View style={[styles.iconActionIcon, { backgroundColor: "#F3F4F6" }]}>
              <Ionicons
                name={circleMuted ? "notifications-off" : "notifications-outline"}
                size={18}
                color={circleMuted ? colors.warningLabel : colors.primaryNavy}
              />
            </View>
            <Text style={styles.iconActionLabel} numberOfLines={1}>
              {t(
                circleMuted
                  ? "circle_detail.action_unmute_short"
                  : "circle_detail.action_mute_short",
              )}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Substitute Pool Bucket B — entry row. Surfaces the live global
          active-substitute count so circles in setup mode (or experiencing
          churn) discover the safety net without leaving the circle screen.
          No params on navigation — the screen is member-centric, not
          per-circle. Visible only to members of the circle. */}
      {isMember ? (
        <TouchableOpacity
          style={styles.substituteRow}
          onPress={() =>
            navigation.navigate(Routes.SubstitutePool as never)
          }
          accessibilityRole="button"
          accessibilityLabel={t("circle_detail.substitute_pool_row_title")}
        >
          <View style={[styles.substituteRowIcon, { backgroundColor: colors.successBg }]}>
            <Ionicons name="people-circle-outline" size={20} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.substituteRowTitle}>
              {t("circle_detail.substitute_pool_row_title")}
            </Text>
            <Text style={styles.substituteRowSubtitle}>
              {t("circle_detail.substitute_pool_row", {
                count: substituteAvailableCount,
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {/* Phase 2 (circle autopay) — missed-contribution banner. Sits
          near the top of Overview so it's one of the first things users
          see when returning to the circle after missing a cycle. */}
      {showAutopaySuggestion && (
        <View style={styles.suggestionBanner}>
          <Ionicons name="alert-circle" size={20} color={colors.warningLabel} />
          <View style={{ flex: 1 }}>
            <Text style={styles.suggestionTitle}>
              {t("circle_detail.autopay_suggestion_title")}
            </Text>
            <Text style={styles.suggestionBody}>
              {t("circle_detail.autopay_suggestion_body")}
            </Text>
            <View style={styles.suggestionActions}>
              <TouchableOpacity
                style={styles.suggestionCta}
                onPress={() =>
                  navigation.navigate("CircleAutopaySetup", { circleId })
                }
              >
                <Text style={styles.suggestionCtaText}>
                  {t("circle_detail.autopay_suggestion_cta")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestionDismiss}
                onPress={dismissSuggestion}
              >
                <Text style={styles.suggestionDismissText}>
                  {t("circle_detail.autopay_suggestion_dismiss")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("circle_detail.stat_contribution")}</Text>
          <Text style={styles.statValue}>${circle.amount}</Text>
          <Text style={styles.statSubtext}>per {isOneTime ? "member" : getFrequencyLabel(circle.frequency).toLowerCase()}</Text>
          {/* Phase 1 (circle autopay): tappable pill — active or
              paused. Tap routes to management so the user can adjust
              the schedule or retry. */}
          {(autopayActive || autopayPaused) && (
            <TouchableOpacity
              style={[
                styles.autopayBadge,
                autopayPaused && styles.autopayBadgePaused,
              ]}
              onPress={() => navigation.navigate("CircleAutopayManagement")}
              accessibilityRole="button"
            >
              <Ionicons
                name={autopayPaused ? "alert-circle" : "checkmark-circle"}
                size={11}
                color={autopayPaused ? colors.warningLabel : "#047857"}
              />
              <Text
                style={[
                  styles.autopayBadgeText,
                  autopayPaused && styles.autopayBadgeTextPaused,
                ]}
              >
                {t(
                  autopayPaused
                    ? "circle_detail.autopay_paused_badge"
                    : "circle_detail.autopay_enabled_badge",
                )}
              </Text>
            </TouchableOpacity>
          )}
          {/* Phase 2 (notification-prefs review): "Muted" pill when
              the user has an active circle-scoped mute. */}
          {circleMuted && (
            <View style={[styles.autopayBadge, styles.mutedBadge]}>
              <Ionicons name="notifications-off" size={11} color="#1F2937" />
              <Text style={[styles.autopayBadgeText, styles.mutedBadgeText]}>
                {t("circle_detail.muted_badge")}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("circle_detail.stat_total_pot")}</Text>
          <Text style={[styles.statValue, { color: colors.accentTeal }]}>${totalPot.toLocaleString()}</Text>
          <Text style={styles.statSubtext}>{circle.memberCount} members</Text>
        </View>
      </View>

      {/* Reputation Card — Step 4 of feat(circle-reputation) #14.
          Always renders. Shows the score (0–100) with tiered color, a
          short interpretation, and the premium benefits unlocked when
          score >= 80. For a brand-new circle with score=0 (no
          inheritance, no completion), shows a "building trust"
          placeholder so the user knows the slot exists. */}
      {(() => {
        const score = circle.reputationScore ?? 0;
        let tier: {
          label: string;
          color: string;
          bg: string;
          summary: string;
        };
        if (score >= 90) {
          tier = {
            label: "ELITE",
            color: "#B45309",
            bg: colors.warningBg,
            summary: "Elite reputation — premium benefits unlocked.",
          };
        } else if (score >= 70) {
          tier = {
            label: "EXCELLENT",
            color: colors.successLabel,
            bg: "#D1FAE5",
            summary:
              score >= 80
                ? "Excellent reputation — qualifies for premium benefits."
                : "Excellent reputation — almost qualifying for premium benefits.",
          };
        } else if (score >= 40) {
          tier = {
            label: "BUILDING",
            color: colors.warningLabel,
            bg: colors.warningBg,
            summary: "Building trust — keep contributing on time.",
          };
        } else if (score > 0) {
          tier = {
            label: "AT RISK",
            color: "#991B1B",
            bg: colors.errorBg,
            summary: "Reputation at risk — defaults are eroding trust.",
          };
        } else {
          tier = {
            label: "NEW",
            color: "#374151",
            bg: "#F3F4F6",
            summary:
              "Building trust — complete this circle to earn a reputation score.",
          };
        }
        return (
          <View
            style={[styles.repCard, { borderLeftColor: tier.color }]}
          >
            <View style={styles.repHeader}>
              <View>
                <View
                  style={[styles.repBadge, { backgroundColor: tier.bg }]}
                >
                  <Text style={[styles.repBadgeLabel, { color: tier.color }]}>
                    REPUTATION · {tier.label}
                  </Text>
                </View>
                <Text style={styles.repCardTitle}>{t("circle_detail.rep_card_title")}</Text>
              </View>
              <View style={styles.repScoreBox}>
                <Text style={[styles.repScore, { color: tier.color }]}>
                  {Math.round(score)}
                </Text>
                <Text style={styles.repScoreOver}>/100</Text>
              </View>
            </View>

            <View style={styles.repScoreBar}>
              <View
                style={[
                  styles.repScoreBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, score))}%`,
                    backgroundColor: tier.color,
                  },
                ]}
              />
            </View>

            <Text style={styles.repSummary}>{tier.summary}</Text>

            {score >= 80 && (
              <View style={styles.repBenefitsBlock}>
                <View style={styles.repBenefitRow}>
                  <Ionicons name="trending-down" size={14} color={colors.successLabel} />
                  <Text style={styles.repBenefitText}>
                    0.5% lower insurance fee
                  </Text>
                </View>
                <View style={styles.repBenefitRow}>
                  <Ionicons name="trending-up" size={14} color={colors.successLabel} />
                  <Text style={styles.repBenefitText}>
                    90% advance limit (instead of 80%)
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })()}

      {/* Circle Health Card — Phase D3 of feat(circle-health).
          Renders once the scoring pipeline has populated a score for
          this circle (one row in circle_health_scores per circle, kept
          fresh nightly by scoring-pipeline-daily cron). Shows status
          badge, score, trend, 4 component bars, and a Refresh button
          calling the recompute_circle_health RPC. */}
      {circleHealth && healthStatusVisual && (
        <View
          style={[
            styles.healthCard,
            { borderLeftColor: healthStatusVisual.color },
          ]}
        >
          <View style={styles.healthHeader}>
            <View
              style={[
                styles.healthBadge,
                { backgroundColor: healthStatusVisual.bg },
              ]}
            >
              <Text style={styles.healthBadgeEmoji}>{healthStatusVisual.emoji}</Text>
              <Text
                style={[styles.healthBadgeLabel, { color: healthStatusVisual.color }]}
              >
                {healthStatusVisual.label}
              </Text>
            </View>
            <View style={styles.healthScoreBox}>
              <Text
                style={[styles.healthScore, { color: healthStatusVisual.color }]}
              >
                {Math.round(circleHealth.health_score)}
              </Text>
              <Text style={styles.healthScoreOver}>/100</Text>
            </View>
          </View>

          <View style={styles.healthScoreBar}>
            <View
              style={[
                styles.healthScoreBarFill,
                {
                  width: `${Math.max(0, Math.min(100, circleHealth.health_score))}%`,
                  backgroundColor: healthStatusVisual.color,
                },
              ]}
            />
          </View>

          {healthTrendVisual && (
            <View style={styles.healthTrendRow}>
              <Text style={styles.healthTrendEmoji}>{healthTrendVisual.emoji}</Text>
              <Text style={[styles.healthTrendLabel, { color: healthTrendVisual.color }]}>
                {healthTrendVisual.label}
              </Text>
              {healthDelta !== null && healthDelta !== 0 && (
                <Text style={styles.healthDelta}>
                  {healthDelta > 0 ? "+" : ""}
                  {healthDelta.toFixed(1)} from last run
                </Text>
              )}
            </View>
          )}

          <View style={styles.healthGrid}>
            {[
              {
                label: "Contribution",
                value: circleHealth.contribution_reliability_score,
              },
              {
                label: "Member Quality",
                value: circleHealth.member_quality_score,
              },
              {
                label: "Financial Stability",
                value: circleHealth.financial_stability_score,
              },
              {
                label: "Social Cohesion",
                value: circleHealth.social_cohesion_score,
              },
            ].map((c) => (
              <View key={c.label} style={styles.healthGridItem}>
                <Text style={styles.healthGridLabel}>{c.label}</Text>
                <View style={styles.healthGridBarBg}>
                  <View
                    style={[
                      styles.healthGridBarFill,
                      {
                        width: `${Math.max(0, Math.min(100, c.value))}%`,
                        backgroundColor: healthStatusVisual.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.healthGridValue}>{Math.round(c.value)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.healthFooter}>
            <Text style={styles.healthFooterText}>
              Updated {formatDate(circleHealth.last_computed_at)}
            </Text>
            <TouchableOpacity
              style={styles.healthRefresh}
              onPress={recomputeHealth}
              disabled={healthRecomputing}
              accessibilityRole="button"
              accessibilityLabel="Refresh circle health score"
            >
              {healthRecomputing ? (
                <Ionicons name="refresh" size={14} color={colors.textSecondary} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={14} color="#2563EB" />
                  <Text style={styles.healthRefreshText}>{t("circle_detail.health_refresh")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active Partial Plan Card — Phase D4 of feat(partial).
          Renders only when the current user has an active partial-
          contribution plan for this circle. Real entry point for plan
          management — no debug-only guard. Tapping "View plan details"
          navigates to PartialContributionScreen, which resolves the
          active cycle from circle_cycles when cycleId is omitted. */}
      {isMember && hasPartialPlan && partialPlan && (
        <View style={styles.partialPlanCard}>
          <View style={styles.partialPlanHeader}>
            <View style={styles.partialPlanIcon}>
              <Ionicons name="calendar-outline" size={20} color={colors.accentTeal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partialPlanBadge}>{t("circle_detail.partial_plan_badge")}</Text>
              <Text style={styles.partialPlanTitle}>
                ${partialRemaining.toFixed(2)} remaining
              </Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${partialProgress.percentage}%`, backgroundColor: colors.accentTeal },
              ]}
            />
          </View>
          <View style={styles.partialPlanProgressRow}>
            <Text style={styles.partialPlanProgressLabel}>
              {partialProgress.paid} of {partialProgress.total} catch-ups paid
            </Text>
            <Text style={styles.partialPlanProgressPct}>
              {partialProgress.percentage}%
            </Text>
          </View>

          {partialNextDue && (
            <View style={styles.partialPlanNextRow}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.partialPlanNextText}>
                Next catch-up due {partialNextDue}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.partialPlanButton}
            onPress={() =>
              navigation.navigate("PartialContribution", {
                circleId,
                cycleId: partialPlan.cycleId,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="View Flexible Payment plan details"
          >
            <Text style={styles.partialPlanButtonText}>{t("circle_detail.partial_plan_btn")}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.accentTeal} />
          </TouchableOpacity>
        </View>
      )}

      {/* Payment Progress */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("circle_detail.card_current_status")}</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${paymentProgress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {paidMembers} of {members.length} members have paid
          </Text>
        </View>

        {paymentProgress < 100 && (
          <View style={styles.paymentAlert}>
            <Ionicons name="time-outline" size={18} color={colors.warningAmber} />
            <Text style={styles.paymentAlertText}>
              Waiting for {members.length - paidMembers} more payments
            </Text>
          </View>
        )}
      </View>

      {/* Beneficiary Info */}
      {hasBeneficiary && (
        <View style={styles.beneficiaryCard}>
          <View style={styles.beneficiaryIcon}>
            <Ionicons name="person-circle" size={32} color={colors.accentTeal} />
          </View>
          <View style={styles.beneficiaryInfo}>
            <Text style={styles.beneficiaryLabel}>{t("circle_detail.beneficiary_label")}</Text>
            <Text style={styles.beneficiaryName}>{circle.beneficiaryName}</Text>
            {circle.beneficiaryReason && (
              <Text style={styles.beneficiaryReason}>{circle.beneficiaryReason}</Text>
            )}
          </View>
          <Text style={styles.beneficiaryAmount}>${totalPot.toLocaleString()}</Text>
        </View>
      )}

      {/* Invite Code — visible to everyone viewing the circle.
          Reads circle.inviteCode (server-set by gen_invite_code() in migration
          141). The user can copy or share from here, so they don't have to
          go back to the create-success screen to find the code. */}
      {isMember && inviteCode ? (
        <View style={styles.inviteCard}>
          <View style={styles.inviteCardHeader}>
            <Ionicons name="key-outline" size={16} color={colors.accentTeal} />
            <Text style={styles.inviteCardTitle}>
              {t("circle_detail.invite_code_title")}
            </Text>
          </View>
          <View style={styles.inviteCodeChipRow}>
            <Text
              style={styles.inviteCodeChip}
              accessibilityRole="text"
              accessibilityLabel={t("circle_detail.invite_code_a11y", {
                code: inviteCode.split("").join(" "),
              })}
              selectable
            >
              {inviteCode}
            </Text>
          </View>
          <View style={styles.inviteActionsRow}>
            <TouchableOpacity
              style={[
                styles.inviteActionBtn,
                styles.inviteActionBtnOutline,
                codeCopied && styles.inviteActionBtnCopied,
              ]}
              onPress={handleCopyCode}
              accessibilityRole="button"
              accessibilityLabel={t("circle_detail.invite_btn_copy")}
            >
              <Ionicons
                name={codeCopied ? "checkmark" : "copy-outline"}
                size={16}
                color={codeCopied ? colors.cardBg : colors.primaryNavy}
              />
              <Text
                style={[
                  styles.inviteActionBtnOutlineText,
                  codeCopied && styles.inviteActionBtnCopiedText,
                ]}
              >
                {codeCopied
                  ? t("circle_detail.invite_btn_copied")
                  : t("circle_detail.invite_btn_copy")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inviteActionBtn, styles.inviteActionBtnPrimary]}
              onPress={handleShareCircle}
              accessibilityRole="button"
              accessibilityLabel={t("circle_detail.invite_btn_share")}
            >
              <Ionicons
                name="share-social-outline"
                size={16}
                color={colors.cardBg}
              />
              <Text style={styles.inviteActionBtnPrimaryText}>
                {t("circle_detail.invite_btn_share")}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Phase 2 (migration 259) — direct invite-by-name surface.
              Sits below the share-code row so the implicit-distribution
              path (Share API) stays the primary, but power users in the
              circle's community can pick a known person from search and
              fire the invite without the recipient ever needing the
              code. Server-side gating (can_invite + tr_block_critical_
              invitation) is the real authority; this row is always
              visible to members and the search screen owns the
              critical-tier "can't invite" banner. */}
          <TouchableOpacity
            style={styles.inviteByNameBtn}
            onPress={() =>
              navigation.navigate("MemberSearch", { circleId: circle.id })
            }
            accessibilityRole="button"
            accessibilityLabel={t("circle_detail.invite_btn_search")}
          >
            <Ionicons name="person-add-outline" size={16} color={colors.primaryNavy} />
            <Text style={styles.inviteByNameBtnText}>
              {t("circle_detail.invite_btn_search")}
            </Text>
          </TouchableOpacity>
          <Text style={styles.inviteHelpText}>
            {t("circle_detail.invite_help")}
          </Text>
        </View>
      ) : null}

      {/* Circle Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("circle_detail.card_circle_details")}</Text>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_start_date")}</Text>
          <Text style={styles.detailValue}>{formatDate(circle.startDate)}</Text>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="repeat-outline" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_frequency")}</Text>
          <Text style={styles.detailValue}>{getFrequencyLabel(circle.frequency)}</Text>
        </View>

        {!isOneTime && !hasBeneficiary && (
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="shuffle-outline" size={18} color={colors.textSecondary} />
            </View>
            <Text style={styles.detailLabel}>{t("circle_detail.detail_payout_order")}</Text>
            <Text style={styles.detailValue}>{getRotationMethodLabel(circle.rotationMethod)}</Text>
            <TouchableOpacity
              onPress={() => showRotationHelp(circle.rotationMethod)}
              accessibilityRole="button"
              accessibilityLabel={t("circle_detail.help_rotation_title")}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Ionicons
                name="help-circle-outline"
                size={16}
                color={colors.textSecondary}
                style={{ marginLeft: 6 }}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.detailRow}>
          <View style={styles.detailIcon}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
          </View>
          <Text style={styles.detailLabel}>{t("circle_detail.detail_grace_period")}</Text>
          <Text style={styles.detailValue}>
            {circle.gracePeriodDays === 0 ? "None" : `${circle.gracePeriodDays} day${circle.gracePeriodDays > 1 ? "s" : ""}`}
          </Text>
        </View>

        {/* Next-payout date and Your Position used to live here as
            rows. Promoted to the hero strip above so they're not
            buried inside the details card. The Details card now holds
            the static metadata only. */}
      </View>
    </View>
  );

  const renderMemberRow = ({ item: member }: { item: CircleMember }) => {
    const memberIsAdmin = member.role === "creator" || member.role === "admin";
    const memberIsElder = member.role === "elder";
    const isMe = member.isCurrentUser;
    // Risk badge: only populated when current user is an elder (RPC
    // gated server-side). Lookup is by auth user_id, which lives on
    // member.odictId — NOT member.id (that's the circle_members row id).
    const riskEntry = isAppElder ? riskMap.get(member.odictId) : undefined;

    const handleRiskBadgePress = () => {
      if (!riskEntry) return;
      const reasonText = riskEntry.risk_reason
        ? `${t("risk.reason_prefix")}${riskEntry.risk_reason}`
        : t(`risk.${riskEntry.risk_flag}`);
      Alert.alert(t(`risk.${riskEntry.risk_flag}`), reasonText);
    };

    return (
      <View style={[styles.memberCard, isMe && styles.memberCardMe]}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {member.name.charAt(0).toUpperCase()}
          </Text>
          {memberIsAdmin && (
            <View style={styles.adminBadge}>
              <Ionicons name="star" size={10} color={colors.cardBg} />
            </View>
          )}
        </View>

        <View style={styles.memberInfo}>
          <View style={styles.memberNameRow}>
            <Text style={styles.memberName}>{member.name}</Text>
            {isMe && (
              <View style={styles.mePill}>
                <Text style={styles.mePillText}>
                  {t("circle_detail.member_badge_me")}
                </Text>
              </View>
            )}
            {memberIsAdmin && (
              <View style={styles.adminTag}>
                <Text style={styles.adminTagText}>
                  {member.role === "creator" ? "Creator" : "Admin"}
                </Text>
              </View>
            )}
            {memberIsElder && (
              <View style={[styles.adminTag, { backgroundColor: "#EEF2FF" }]}>
                <Text style={[styles.adminTagText, { color: "#6366F1" }]}>{t("circle_detail.tag_elder")}</Text>
              </View>
            )}
            {riskEntry && (
              <TouchableOpacity
                onPress={handleRiskBadgePress}
                style={[styles.riskBadge, styles[`riskBadge_${riskEntry.risk_flag}` as keyof typeof styles] as any]}
                accessibilityRole="button"
                accessibilityLabel={t(`risk.${riskEntry.risk_flag}`)}
              >
                <Text style={[styles.riskBadgeText, styles[`riskBadgeText_${riskEntry.risk_flag}` as keyof typeof styles] as any]}>
                  {t(`risk.${riskEntry.risk_flag}`)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.memberPhone}>{member.phone || member.email || t("circle_detail.member_no_contact")}</Text>
        </View>

        <View style={styles.memberRight}>
          <View style={styles.xnScoreBadge}>
            <Text style={styles.xnScoreText}>{member.xnScore}</Text>
          </View>
          {!hasBeneficiary && !isOneTime && member.position > 0 && (
            <Text style={styles.positionText}>
              {t("circle_detail.position_format", {
                position: member.position,
                total: circle.memberCount,
              })}
            </Text>
          )}
          {member.hasPaid ? (
            <Ionicons name="checkmark-circle" size={20} color={colors.accentTeal} />
          ) : (
            <Ionicons name="time-outline" size={20} color={colors.warningAmber} />
          )}
        </View>
      </View>
    );
  };

  const renderMembersTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>
        {members.length} Member{members.length !== 1 ? "s" : ""}
      </Text>

      {isLoadingMembers ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
          <Text style={styles.loadingText}>{t("circle_detail.loading_members")}</Text>
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyMembersContainer}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyMembersText}>{t("circle_detail.empty_no_members")}</Text>
        </View>
      ) : (
        // FlatList inside the outer ScrollView — scrollEnabled={false}
        // defers scroll to the parent and avoids the nested-virtualized-
        // list warning. keyExtractor uses member.id to stabilize re-orders.
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          renderItem={renderMemberRow}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  // Helper to format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case "contribution": return "wallet";
      case "payout": return "cash-outline";
      case "joined": return "person-add";
      case "created": return "add-circle";
      case "left": return "exit-outline";
      default: return "ellipse";
    }
  };

  const getActivityColor = (type: string): { bg: string; icon: string } => {
    switch (type) {
      case "contribution": return { bg: colors.tealTintBg, icon: colors.accentTeal };
      case "payout": return { bg: "#D1FAE5", icon: "#10B981" };
      case "joined": return { bg: "#EEF2FF", icon: "#6366F1" };
      case "created": return { bg: colors.warningBg, icon: colors.warningAmber };
      case "left": return { bg: colors.errorBg, icon: colors.errorText };
      default: return { bg: "#F3F4F6", icon: colors.textSecondary };
    }
  };

  const renderActivityTab = () => {
    // Collapse to the last 7 days by default; tapping "Show earlier"
    // reveals the full list. Activity feeds on old circles can be long
    // (one row per contribution × member-count × cycles), so showing
    // the recent slice up front keeps the scroll length reasonable.
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const cutoffMs = Date.now() - SEVEN_DAYS_MS;
    const recentActivities = activities.filter(
      (a) => new Date(a.timestamp).getTime() >= cutoffMs,
    );
    const earlierCount = activities.length - recentActivities.length;
    const visibleActivities = showAllActivities ? activities : recentActivities;

    return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>{t("circle_detail.section_recent_activity")}</Text>

      {isLoadingActivities ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.accentTeal} />
          <Text style={styles.loadingText}>{t("circle_detail.loading_activities")}</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.emptyActivities}>
          <Ionicons name="time-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyActivitiesText}>{t("circle_detail.empty_no_activity")}</Text>
          <Text style={styles.emptyActivitiesSubtext}>
            Activity will appear here once members start contributing
          </Text>
        </View>
      ) : (
        visibleActivities.map((activity) => {
          const colors = getActivityColor(activity.type);
          return (
            <View key={activity.id} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: colors.bg }]}>
                <Ionicons
                  name={getActivityIcon(activity.type) as any}
                  size={18}
                  color={colors.icon}
                />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityText}>
                  {activity.type === "contribution" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> contributed{" "}
                      <Text style={styles.activityBold}>${activity.amount?.toLocaleString()}</Text>
                    </>
                  )}
                  {activity.type === "payout" && (
                    activity.isCurrentUser ? (
                      <Text style={[styles.activityBold, { color: "#059669" }]}>
                        {t("circle_detail.activity_you_received", {
                          amount: activity.amount?.toLocaleString() ?? "0",
                        })}
                      </Text>
                    ) : (
                      <Text>
                        <Text style={styles.activityBold}>{activity.userName}</Text>
                        {" "}
                        {t("circle_detail.activity_received", {
                          amount: activity.amount?.toLocaleString() ?? "0",
                        })}
                      </Text>
                    )
                  )}
                  {activity.type === "joined" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> joined the circle
                    </>
                  )}
                  {activity.type === "created" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> created this circle
                    </>
                  )}
                  {activity.type === "left" && (
                    <>
                      <Text style={styles.activityBold}>{activity.userName}</Text> left the circle
                    </>
                  )}
                </Text>
                <Text style={styles.activityTime}>{formatRelativeTime(activity.timestamp)}</Text>
              </View>
            </View>
          );
        })
      )}

      {/* Expander — only render when there are older events outside
          the 7-day window and we haven't already revealed them. */}
      {!showAllActivities && earlierCount > 0 ? (
        <TouchableOpacity
          style={styles.showEarlierBtn}
          onPress={() => setShowAllActivities(true)}
          accessibilityRole="button"
        >
          <Ionicons name="chevron-down" size={14} color={colors.primaryNavy} />
          <Text style={styles.showEarlierText}>
            {t("circle_detail.activity_show_earlier", { count: earlierCount })}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentTeal}
            colors={[colors.accentTeal]}
          />
        }
      >
        {/* Header */}
        <LinearGradient colors={[colors.primaryNavy, "#143654"]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.cardBg} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {/* Timeline + Voting were rendered as inline tabs but
                  actually navigated away to other screens — confusing
                  and broke back-stack expectations. Promoted to header
                  icon buttons so the tab bar holds only true panes. */}
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() =>
                  navigation.navigate(Routes.CycleTimeline as never, { circleId } as never)
                }
                accessibilityRole="button"
                accessibilityLabel={t("circle_detail.tab_timeline")}
              >
                <Ionicons name="time-outline" size={20} color={colors.cardBg} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() =>
                  navigation.navigate(Routes.CircleVoting as never, { circleId } as never)
                }
                accessibilityRole="button"
                accessibilityLabel={t("circle_detail.tab_voting")}
              >
                <Ionicons name="reader-outline" size={20} color={colors.cardBg} />
                {openProposalCount > 0 && (
                  <View style={styles.headerActionBadge}>
                    <Text style={styles.headerActionBadgeText}>
                      {openProposalCount > 9 ? "9+" : openProposalCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() => setShowMenu(true)}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.cardBg} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Circle Info */}
          <View style={styles.circleInfo}>
            <View style={styles.circleIconContainer}>
              <Text style={styles.circleEmoji}>{circle.emoji}</Text>
            </View>
            <Text style={styles.circleName}>{circle.name}</Text>
            <View style={styles.circleTypeBadge}>
              <Text style={styles.circleTypeText}>{getCircleTypeLabel(circle.type)}</Text>
            </View>
            {circle.verified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={14} color={colors.accentTeal} />
                <Text style={styles.verifiedText}>{t("circle_detail.tag_verified")}</Text>
              </View>
            )}
          </View>

          {/* Tabs — all three switch inline panes. Timeline + Voting
              moved to header icon buttons above (they navigated away,
              not switched panes). */}
          <View style={styles.tabsContainer}>
            {(["overview", "members", "activity"] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => trackTabSwitch(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </LinearGradient>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "members" && renderMembersTab()}
        {activeTab === "activity" && renderActivityTab()}
      </ScrollView>

      {/* Bottom Action Button */}
      <View style={styles.bottomBar}>
        {isMember ? (
          <Animated.View
            style={{
              transform: [{ scale: shouldPulse ? pulseAnim : 1 }],
              borderRadius: 14,
              shadowColor: shouldPulse ? colors.accentTeal : "transparent",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: shouldPulse ? 0.6 : 0,
              shadowRadius: shouldPulse ? 14 : 0,
              elevation: shouldPulse ? 8 : 0,
            }}
          >
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => {
                // Tapping Contribute clears the pulse immediately —
                // user has acknowledged the affordance.
                if (shouldPulse) setShouldPulse(false);
                if (isContributeBlocked) return showContributeBlocked();
                trackContributeTap("bottom_bar");
                navigation.navigate("MakeContribution", { circleId });
              }}
            >
              <Ionicons name="wallet-outline" size={20} color={colors.cardBg} />
              <Text style={styles.payButtonText}>Contribute ${circle.amount}</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[styles.payButton, isFull && styles.payButtonDisabled]}
            onPress={() => !isFull && navigation.navigate("JoinCircleConfirm", { circleId, source: "detail" })}
            disabled={isFull}
          >
            <Ionicons name="people" size={20} color={colors.cardBg} />
            <Text style={styles.payButtonText}>
              {isFull ? "Circle Full" : "Join Circle"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Floating Help Button */}
      <TouchableOpacity
        style={styles.floatingHelp}
        onPress={() => navigation.navigate("HelpCenter")}
      >
        <Ionicons name="chatbubble-ellipses" size={24} color={colors.cardBg} />
        <Text style={styles.floatingHelpText}>{t("final_polish.circledetail_help")}</Text>
      </TouchableOpacity>

      {/* Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.menuContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.menuHeader}>
                <View>
                  <Text style={styles.menuTitle}>{t("circle_detail.menu_title")}</Text>
                  <View style={styles.menuRoleBadge}>
                    <Ionicons
                      name={isAdmin ? "shield-checkmark" : isElder ? "eye" : "person"}
                      size={12}
                      color={isAdmin ? "#F59E0B" : isElder ? "#6366F1" : colors.accentTeal}
                    />
                    <Text style={[
                      styles.menuRoleText,
                      { color: isAdmin ? "#F59E0B" : isElder ? "#6366F1" : colors.accentTeal }
                    ]}>
                      {isAdmin ? "Admin" : isElder ? "Elder" : "Member"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setShowMenu(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* === ALL USERS Section === */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_general")}</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handleViewCircleRules}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.tealTintBg }]}>
                    <Ionicons name="document-text-outline" size={20} color={colors.accentTeal} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_rules")}</Text>
                    <Text style={styles.menuItemDesc}>Terms, contributions & guidelines</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleShareCircle}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="share-social-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_share")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_share_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => {
                  setShowMenu(false);
                  navigation.navigate("QRCodeDisplay", { circleId });
                }}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.tealTintBg }]}>
                    <Ionicons name="qr-code-outline" size={20} color={colors.accentTeal} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_qr")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_qr_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleHelpSupport}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.warningBg }]}>
                    <Ionicons name="help-circle-outline" size={20} color={colors.warningAmber} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>Help & Support</Text>
                    <Text style={styles.menuItemDesc}>FAQs, tutorials & contact</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleReportIssue}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.errorBg }]}>
                    <Ionicons name="flag-outline" size={20} color={colors.errorText} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_report")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_report_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Phase 2 — File a formal dispute against another member. */}
                <TouchableOpacity style={styles.menuItem} onPress={handleFileDispute}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.warningBg }]}>
                    <Ionicons name="document-text-outline" size={20} color={colors.warningLabel} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("dispute.file_button")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Phase 2 — View the list of disputes for this circle. */}
                <TouchableOpacity style={styles.menuItem} onPress={handleViewDisputes}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Ionicons name="list-outline" size={20} color="#1E40AF" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("dispute.view_disputes")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* === MEMBER Section === */}
              <View style={styles.menuSection}>
                <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_your_activity")}</Text>

                <TouchableOpacity style={styles.menuItem} onPress={handlePaymentHistory}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.tealTintBg }]}>
                    <Ionicons name="receipt-outline" size={20} color={colors.accentTeal} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_payment_history")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_payment_history_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handlePaymentReminders}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons name="notifications-outline" size={20} color="#6366F1" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_reminders")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_reminders_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {/* Swap Position — Phase D2 of feat(position-swap) #18.
                    Was missing for the entire engine's lifetime
                    despite full backend (14 RPCs + hourly cron + EF). */}
                <TouchableOpacity style={styles.menuItem} onPress={handleSwapPosition}>
                  <View style={[styles.menuItemIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Ionicons name="swap-horizontal" size={20} color="#1D4ED8" />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={styles.menuItemText}>{t("circle_detail.menu_swap_position")}</Text>
                    <Text style={styles.menuItemDesc}>
                      Trade your payout position with another member
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={handleLeaveCircle}>
                  <View style={[styles.menuItemIcon, { backgroundColor: colors.errorBg }]}>
                    <Ionicons name="exit-outline" size={20} color={colors.errorText} />
                  </View>
                  <View style={styles.menuItemContent}>
                    <Text style={[styles.menuItemText, { color: colors.errorText }]}>{t("circle_detail.menu_leave_circle")}</Text>
                    <Text style={styles.menuItemDesc}>{t("circle_detail.menu_leave_desc")}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* === ADMIN Section (only visible to admins) === */}
              {isAdmin && (
                <View style={styles.menuSection}>
                  <View style={styles.menuSectionHeader}>
                    <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_admin_controls")}</Text>
                    <View style={styles.adminBadgeSmall}>
                      <Ionicons name="shield-checkmark" size={10} color={colors.cardBg} />
                    </View>
                  </View>

                  {/* "Edit Details" was a "Coming soon" Alert stub. Hidden
                      until name + emoji editing is actually wired —
                      shipping a row that only opens an alert reads as
                      broken even when the underlying intent is "later". */}

                  <TouchableOpacity style={styles.menuItem} onPress={handleManageMembers}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="people-outline" size={20} color="#6366F1" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_manage_members")}</Text>
                      <Text style={styles.menuItemDesc}>Add, remove & assign roles</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handlePauseCircle}>
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.warningBg }]}>
                      <Ionicons name="pause-circle-outline" size={20} color={colors.warningAmber} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_pause")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_pause_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleExportData}>
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.tealTintBg }]}>
                      <Ionicons name="download-outline" size={20} color={colors.accentTeal} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_export")}</Text>
                      <Text style={styles.menuItemDesc}>PDF, CSV & audit reports</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleAdminSettings}>
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.screenBg }]}>
                      <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_admin_settings")}</Text>
                      <Text style={styles.menuItemDesc}>Contributions, visibility & more</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleCloseCircle}>
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.errorBg }]}>
                      <Ionicons name="close-circle-outline" size={20} color={colors.errorText} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={[styles.menuItemText, { color: colors.errorText }]}>{t("circle_detail.menu_close_circle")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_close_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* === ELDER Section (only visible to elders) === */}
              {(isElder || isAdmin) && (
                <View style={styles.menuSection}>
                  <View style={styles.menuSectionHeader}>
                    <Text style={styles.menuSectionTitle}>{t("circle_detail.menu_oversight_tools")}</Text>
                    <View style={[styles.adminBadgeSmall, { backgroundColor: "#6366F1" }]}>
                      <Ionicons name="eye" size={10} color={colors.cardBg} />
                    </View>
                  </View>

                  <TouchableOpacity style={styles.menuItem} onPress={handleOversightDashboard}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#EEF2FF" }]}>
                      <Ionicons name="analytics-outline" size={20} color="#6366F1" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_oversight_dashboard")}</Text>
                      <Text style={styles.menuItemDesc}>Circle health & compliance</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleMediationTools}>
                    <View style={[styles.menuItemIcon, { backgroundColor: "#FCE7F3" }]}>
                      <Ionicons name="hand-left-outline" size={20} color="#EC4899" />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_mediation")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_mediation_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={handleAuditTrail}>
                    <View style={[styles.menuItemIcon, { backgroundColor: colors.tealTintBg }]}>
                      <Ionicons name="list-outline" size={20} color={colors.accentTeal} />
                    </View>
                    <View style={styles.menuItemContent}>
                      <Text style={styles.menuItemText}>{t("circle_detail.menu_audit")}</Text>
                      <Text style={styles.menuItemDesc}>{t("circle_detail.menu_audit_desc")}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Phase 2 (notification-prefs review) — per-circle mute sheet.
          Persists to circle_notification_overrides via the hook. */}
      <MuteCircleSheet
        visible={muteSheetOpen}
        circleName={circle?.name ?? ""}
        isMuted={circleMuted}
        onClose={() => setMuteSheetOpen(false)}
        onMute={handleMute}
        onUnmute={handleUnmute}
      />

      {/* Phase 2 — File dispute modal. Members list comes from useCircleDetail;
          exclude self. Uses odictId (auth user_id), not the circle_members row id. */}
      <FileDisputeModal
        visible={fileDisputeOpen}
        onClose={() => setFileDisputeOpen(false)}
        circleId={circleId}
        members={members
          .filter((m) => !m.isCurrentUser)
          .map((m) => ({ userId: m.odictId, name: m.name }))}
        onFiled={(id) =>
          navigation.navigate("DisputeDetail", { disputeId: id })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screenBg,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.cardBg,
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerActionBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  headerActionBadgeText: {
    color: colors.cardBg,
    fontSize: 10,
    fontWeight: "700",
  },
  circleInfo: {
    alignItems: "center",
    paddingBottom: 20,
  },
  circleIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  circleEmoji: {
    fontSize: 36,
  },
  circleName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.cardBg,
    marginBottom: 8,
  },
  circleTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  circleTypeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.accentTeal,
    fontWeight: "600",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: 4,
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.cardBg,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: colors.primaryNavy,
  },
  tabContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  statSubtext: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Phase 1 — circle autopay status pill that sits under the
  // contribution amount in the stat card.
  autopayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.successBg,
  },
  autopayBadgePaused: { backgroundColor: colors.warningBg },
  autopayBadgeText: { fontSize: 10, fontWeight: "800", color: "#047857" },
  autopayBadgeTextPaused: { color: colors.warningLabel },
  // Phase 2 — muted-circle pill (sits next to the autopay pill).
  mutedBadge: { backgroundColor: "#F3F4F6", marginTop: 4 },
  mutedBadgeText: { color: "#1F2937" },

  // Phase 2 — missed-contribution suggestion banner.
  heroNextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.tealTintBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    marginBottom: 16,
  },
  heroNextIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,198,174,0.15)",
  },
  heroNextText: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryNavy,
    fontWeight: "600",
    lineHeight: 18,
  },
  heroNextCardYourTurn: {
    backgroundColor: colors.warningBg,
    borderColor: "#F59E0B",
  },
  heroNextCardReceived: {
    backgroundColor: colors.successBg,
    borderColor: "#059669",
  },
  payoutCountdownChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.screenBg,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payoutCountdownText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  contributeHeroCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.accentTeal,
    marginBottom: 16,
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  contributeHeroCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.cardBg,
  },
  heroCoachTip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: "#F59E0B",
    alignSelf: "center",
    marginTop: -8,
    marginBottom: 16,
  },
  heroCoachTipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  heroStripRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  heroStripChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroStripLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroStripValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 2,
  },
  iconActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  iconActionBtn: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primaryNavy,
    textAlign: "center",
  },

  // Substitute Pool Bucket B — entry row
  substituteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  substituteRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  substituteRowTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  substituteRowSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberCardMe: {
    backgroundColor: colors.tealTintBg,
    borderColor: colors.accentTeal,
  },
  mePill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.accentTeal,
  },
  mePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.cardBg,
    letterSpacing: 0.3,
  },
  showEarlierBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  showEarlierText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  suggestionBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    backgroundColor: colors.warningBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 16,
  },
  suggestionTitle: { fontSize: 14, fontWeight: "700", color: colors.warningLabel },
  suggestionBody: {
    fontSize: 12,
    color: colors.warningLabel,
    lineHeight: 17,
    marginTop: 4,
  },
  suggestionActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    alignItems: "center",
  },
  suggestionCta: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: colors.warningLabel,
    borderRadius: 10,
  },
  suggestionCtaText: { fontSize: 12, fontWeight: "700", color: colors.cardBg },
  suggestionDismiss: { paddingVertical: 8 },
  suggestionDismissText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.warningLabel,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
    marginBottom: 14,
  },

  // ── Invite Code card ──────────────────────────────────────────────────
  inviteCard: {
    backgroundColor: colors.tealTintBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  inviteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  inviteCardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#00897B",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  inviteCodeChipRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  inviteCodeChip: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.primaryNavy,
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "center",
  },
  inviteActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  inviteActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  inviteActionBtnOutline: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
  },
  inviteActionBtnOutlineText: {
    color: colors.primaryNavy,
    fontSize: 13,
    fontWeight: "700",
  },
  inviteActionBtnCopied: {
    backgroundColor: colors.primaryNavy,
    borderColor: colors.primaryNavy,
  },
  inviteActionBtnCopiedText: {
    color: colors.cardBg,
  },
  inviteActionBtnPrimary: {
    backgroundColor: colors.accentTeal,
  },
  inviteActionBtnPrimaryText: {
    color: colors.cardBg,
    fontSize: 13,
    fontWeight: "700",
  },
  inviteByNameBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F9FAFB",
  },
  inviteByNameBtnText: {
    color: colors.primaryNavy,
    fontSize: 13,
    fontWeight: "700",
  },
  inviteHelpText: {
    fontSize: 11,
    color: colors.successLabel,
    marginTop: 10,
    lineHeight: 16,
    fontStyle: "italic",
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accentTeal,
    borderRadius: 4,
  },
  partialPlanCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.accentTeal,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  partialPlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  partialPlanIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#00C6AE15",
    justifyContent: "center",
    alignItems: "center",
  },
  partialPlanBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.accentTeal,
    letterSpacing: 0.6,
  },
  partialPlanTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 2,
  },
  partialPlanProgressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  partialPlanProgressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  partialPlanProgressPct: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  partialPlanNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  partialPlanNextText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  partialPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#00C6AE15",
  },
  partialPlanButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  healthCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  healthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  healthBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  healthBadgeEmoji: { fontSize: 14 },
  healthBadgeLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  healthScoreBox: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  healthScore: { fontSize: 28, fontWeight: "800" },
  healthScoreOver: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  healthScoreBar: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  healthScoreBarFill: { height: 6, borderRadius: 3 },
  healthTrendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  healthTrendEmoji: { fontSize: 14 },
  healthTrendLabel: { fontSize: 13, fontWeight: "700" },
  healthDelta: { fontSize: 12, color: colors.textSecondary, marginLeft: 4 },
  healthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  healthGridItem: { flex: 1, minWidth: "44%" },
  healthGridLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 4 },
  healthGridBarBg: {
    height: 4,
    backgroundColor: "#F3F4F6",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 3,
  },
  healthGridBarFill: { height: 4, borderRadius: 2 },
  healthGridValue: { fontSize: 12, fontWeight: "700", color: "#1F2937" },
  healthFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  healthFooterText: { fontSize: 11, color: colors.textSecondary },
  healthRefresh: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  healthRefreshText: { fontSize: 12, fontWeight: "700", color: "#2563EB" },
  repCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  repHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  repBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  repBadgeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  repCardTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryNavy },
  repScoreBox: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  repScore: { fontSize: 32, fontWeight: "800" },
  repScoreOver: { fontSize: 13, color: colors.textSecondary, fontWeight: "600" },
  repScoreBar: {
    height: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  repScoreBarFill: { height: 6, borderRadius: 3 },
  repSummary: { fontSize: 13, color: "#374151", lineHeight: 18 },
  repBenefitsBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 6,
  },
  repBenefitRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  repBenefitText: { fontSize: 12, color: colors.successLabel, fontWeight: "600" },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paymentAlert: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.warningBg,
    padding: 10,
    borderRadius: 8,
  },
  paymentAlertText: {
    fontSize: 12,
    color: colors.warningLabel,
    flex: 1,
  },
  beneficiaryCard: {
    backgroundColor: colors.tealTintBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.accentTeal,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  beneficiaryIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,198,174,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  beneficiaryInfo: {
    flex: 1,
  },
  beneficiaryLabel: {
    fontSize: 11,
    color: "#00897B",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  beneficiaryName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryNavy,
    marginTop: 2,
  },
  beneficiaryReason: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  beneficiaryAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.screenBg,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  actionsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primaryNavy,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyMembersContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyMembersText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryNavy,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  memberAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.cardBg,
  },
  adminBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  adminTag: {
    backgroundColor: colors.warningBg,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  adminTagText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.warningLabel,
  },
  riskBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  riskBadge_low: { backgroundColor: "#DCFCE7" },
  riskBadge_medium: { backgroundColor: colors.warningBg },
  riskBadge_high: { backgroundColor: colors.errorBg },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  riskBadgeText_low: { color: "#166534" },
  riskBadgeText_medium: { color: colors.warningLabel },
  riskBadgeText_high: { color: "#991B1B" },
  memberPhone: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  memberRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  xnScoreBadge: {
    backgroundColor: colors.tealTintBg,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  xnScoreText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  positionText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
  },
  activityBold: {
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyActivities: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyActivitiesText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 12,
  },
  emptyActivitiesSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBg,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentTeal,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 10,
  },
  payButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.cardBg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: "center",
  },
  errorButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.cardBg,
  },
  // Menu Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  menuRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  menuRoleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  menuSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  menuSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  adminBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingLeft: 4,
    gap: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primaryNavy,
  },
  menuItemDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  floatingHelp: {
    position: "absolute",
    bottom: 100,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.accentTeal,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  floatingHelpText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.cardBg,
  },
});
