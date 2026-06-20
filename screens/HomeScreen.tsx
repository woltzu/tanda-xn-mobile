import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  Animated,
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useMemberTier } from "../hooks/useGraduatedEntry";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { useFocusEffect } from "@react-navigation/native";
import { useGoalActions } from "../hooks/useGoalActions";
import type { Goal } from "../types/goals";
import { useCircles, type Circle } from "../context/CirclesContext";
import { useCircleNetBalance } from "../hooks/useCircleNetBalance";
import { useAdvanceDashboard } from "../hooks/useAdvanceDashboard";
import { useScoreHubBadge } from "../hooks/useScoreHubBadge";
import { useXnScoreFromBundle } from "../hooks/useXnScore";
import { useProfileIconBadge } from "../hooks/useProfileIconBadge";
import { useNotificationsBadge } from "../hooks/useNotificationsBadge";
import { useProfile } from "../hooks/useProfile";
import { useEventTracker } from "../hooks/useEventTracker";

// ==========================================================================
// Mock data shrinking. Wallet balance comes from useWallet(), goals balance
// from useGoalActions().fetchGoals(), and as of 2026-06-12 circles come
// from useCircles().myCircles (real UUIDs, real names, real positions).
// What remains here is only the static thresholds + the activity/upcoming/
// expected feeds that don't have their own hook yet.
// ==========================================================================
// Bucket A — `xn_score: 78` was a hardcoded display fallback that the
// credit-score row read every render, so new users with no real score
// (and existing users whose bundle hadn't loaded yet) saw a misleading
// "78" instead of a loading state. The value now comes from the real
// score bundle via useXnScoreFromBundle(); the row renders an em-dash
// while the bundle is loading.
const mockData = {
  has_been_in_circle_30_days: true,
};

const mockGoal = {
  id: "g1",
  name: "New Car",
  currentAmount: 1200,
  targetAmount: 3000,
};

type ActivityRow = {
  id: string;
  direction: "in" | "out";
  descKey: string;
  descParams?: Record<string, string>;
  amount: number;
  date: string;
};

const mockActivity: ActivityRow[] = [
  {
    id: "a1",
    direction: "in",
    descKey: "home_screen.activity_received_payout",
    descParams: { circle: "Family Circle" },
    amount: 200,
    date: "Mar 10",
  },
  {
    id: "a2",
    direction: "out",
    descKey: "home_screen.activity_contributed_to",
    descParams: { circle: "Business Circle" },
    amount: -100,
    date: "Mar 5",
  },
  {
    id: "a3",
    direction: "out",
    descKey: "home_screen.activity_goal_contribution",
    descParams: { goal: mockGoal.name },
    amount: -50,
    date: "Mar 1",
  },
  {
    id: "a4",
    direction: "in",
    descKey: "home_screen.activity_received_advance",
    amount: 300,
    date: "Feb 25",
  },
  {
    id: "a5",
    direction: "out",
    descKey: "home_screen.activity_fee_maintenance",
    amount: -5,
    date: "Feb 20",
  },
];

const mockUpcoming = [
  { id: "u1", date: "Mar 15", name: "Family Circle", amount: 100 },
  { id: "u2", date: "Mar 20", name: "Business Builders", amount: 250 },
];

const mockExpectedPayouts = [
  { id: "p1", date: "Mar 25", name: "Family Circle", amount: 400 },
  { id: "p2", date: "Apr 5", name: "Business Builders", amount: 500 },
];

// ==========================================================================
// Helpers
// ==========================================================================
function formatSigned(amount: number): string {
  const sign = amount > 0 ? "+ " : amount < 0 ? "− " : "";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}
function formatPlain(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Locale-aware short date for the Advances subtitle's "Repay by X" line.
// Accepts both date-only ("2026-08-15") and timestamp ("2026-08-15T…")
// inputs from get_advance_dashboard's next_payment_due.date. Falls
// through to the raw string if Date can't parse it — better to show
// the wrong format than to crash the card.
function formatDueDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ==========================================================================
// Component
// ==========================================================================
export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  // Bucket A — no more FALLBACK_TIER mock. `tier` is null until the
  // hook resolves; the render path shows a skeleton pill in that window
  // instead of a fake Bronze badge that lied to cold-start users.
  const { tierDef: tier, loading: tierLoading } = useMemberTier();

  const [showCircleSheet, setShowCircleSheet] = useState(false);
  const [showTierModal, setShowTierModal] = useState(false);
  const [showAiSheet, setShowAiSheet] = useState(false);
  // Soft-verify banner. KYC is deferred until first $-action; this nudge
  // shows from cold-start until the user either taps "Verify" or dismisses
  // it for this session. (Per-session is intentional: persistent dismissal
  // would let the user forget; per-launch would nag.)
  const { isEmailVerified, user } = useAuth();
  // P1 (kyc-trigger review): persistent KYC banner for unverified
  // users. Shown when no kyc row exists yet AND for terminal "needs
  // action" states (rejected, expired). Hidden while the user is
  // mid-flow (pending / review states) so we don't duplicate the
  // Hub's own progress chip. Approved → no banner.
  const kycStatus = user?.kyc?.status;
  const showKycBanner =
    !!user?.id &&
    kycStatus !== "approved" &&
    !["pending", "provider_pending", "provider_review", "admin_review"].includes(
      kycStatus ?? "",
    );
  const handleOpenKycBanner = () => {
    navigation.navigate(Routes.KYCHub);
  };
  // Real wallet balance from WalletContext — already USD-equivalent and
  // in dollars (not cents). Updates reactively after a send: WalletContext
  // calls loadWalletData() at the end of sendMoney(), which re-reads
  // user_wallets.main_balance_cents from Supabase and pushes the new
  // value into the currencies array. The render here re-runs as soon as
  // that state lands.
  const { balance: walletBalance } = useWallet();

  // Real goals from the DB. Replaces the prior `mockData.goals_balance`
  // constant (was $400) and `mockGoal` ("New Car"). Refetches every time
  // the screen comes into focus so a goal created in the Express flow
  // or money added via the bottom-sheets reflects immediately on the
  // user's return to Home.
  const { fetchGoals } = useGoalActions();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const loadGoals = useCallback(async () => {
    setGoalsLoading(true);
    const { data, error } = await fetchGoals();
    if (error) {
      console.warn("[HomeScreen] fetchGoals failed:", (error as any)?.message);
      setGoals([]);
    } else {
      setGoals((data ?? []).filter((g) => g.status === "active"));
    }
    setGoalsLoading(false);
  }, [fetchGoals]);
  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals]),
  );

  // Aggregate balance across all active goals (already in dollars from
  // useGoalActions' centsToDollars mapping).
  const totalGoalsBalance = useMemo(
    () => goals.reduce((acc, g) => acc + (g.currentBalance ?? 0), 0),
    [goals],
  );

  // Pick the most recently created active goal as the "primary" surface
  // on the Goals card. Null when the user has no goals yet → triggers
  // the empty-state CTA further down.
  const primaryGoal = useMemo<Goal | null>(() => {
    if (goals.length === 0) return null;
    return [...goals].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime(),
    )[0];
  }, [goals]);
  const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
  const showVerifyBanner = !isEmailVerified && !verifyBannerDismissed;
  const handleOpenVerify = () => {
    setVerifyBannerDismissed(true);
    // KYC P1: unified KYCHub is the canonical entry point — merges the
    // P0 engine wiring with the prior VerificationHub layout, coach
    // mark, progress chip, and tier-explainer modal.
    navigation.navigate(Routes.KYCHub);
  };

  // Real circles for this user. `myCircles` from CirclesContext is the
  // authoritative source — replaces the prior `mockCircles` constant whose
  // string ids (e.g. "family-circle-1") were not UUIDs and crashed the
  // CircleDetail member fetch with `invalid input syntax for type uuid`.
  const { myCircles } = useCircles();
  const activeCircles = useMemo(
    () => myCircles.filter((c) => c.status === "active"),
    [myCircles],
  );
  const hasActiveCircle = activeCircles.length > 0;

  // Real circle net = payouts received minus contributions made,
  // aggregated across the user's currently-active memberships. Sign
  // convention matches the bottom-sheet rows below: positive net =
  // ahead (received more), negative = owed (put in more).
  const {
    circleNetBalances,
    totalNet: totalCircleNet,
    totalContributed: circleTotalContributed,
    totalReceived: circleTotalReceived,
    loading: circleNetLoading,
    refetch: refetchCircleNet,
  } = useCircleNetBalance();
  const circleNetBalance = totalCircleNet;

  // Refresh circle net on focus. Cheap when the cache is hot (the hook
  // short-circuits to the cached entries); cheap when cold (one round
  // trip with three small selects in parallel).
  useFocusEffect(
    useCallback(() => {
      void refetchCircleNet();
    }, [refetchCircleNet]),
  );

  const totalNet = useMemo(
    () => walletBalance + totalGoalsBalance + circleNetBalance,
    [walletBalance, totalGoalsBalance, circleNetBalance],
  );

  // Per-circle aggregates for the breakdown sheet. Real values now —
  // sums come from the hook's totals so the sheet's totals row
  // matches the per-row entries exactly.
  const circleTotals = useMemo(
    () => ({
      contributed: circleTotalContributed,
      received: circleTotalReceived,
      net: circleNetBalance,
    }),
    [circleTotalContributed, circleTotalReceived, circleNetBalance],
  );

  // Bucket A (Explainable AI) — dynamic "Why this balance?" body. The
  // legacy sheet rendered a single static i18n string for every user;
  // this replaces it with one line per real component (wallet / goals /
  // circle net) plus a dominance summary when one component clearly
  // outsizes the others. Inline English copy per Bucket A spec — i18n
  // arrives in a later bucket if we keep these strings.
  type AiBodyLine = { icon: keyof typeof Ionicons.glyphMap; text: string };
  type AiBody =
    | { empty: true; lines: []; summary: null }
    | { empty: false; lines: AiBodyLine[]; summary: string | null };
  const aiExplanation = useMemo<AiBody>(() => {
    const hasWallet = walletBalance > 0;
    const hasGoals = totalGoalsBalance > 0;
    const hasCircle =
      circleTotals.contributed > 0 ||
      circleTotals.received > 0 ||
      circleTotals.net !== 0;
    if (!hasWallet && !hasGoals && !hasCircle) {
      return { empty: true, lines: [], summary: null };
    }
    const lines: AiBodyLine[] = [];
    if (hasWallet) {
      lines.push({
        icon: "wallet-outline",
        text: `Your wallet has ${formatPlain(walletBalance)} — your liquid cash, available to spend or send.`,
      });
    }
    if (hasGoals) {
      lines.push({
        icon: "flag-outline",
        text: `You've saved ${formatPlain(totalGoalsBalance)} toward your goals.`,
      });
    }
    if (hasCircle) {
      if (circleTotals.net > 0) {
        lines.push({
          icon: "sync-outline",
          text: `Your circle net is ${formatSigned(circleTotals.net)} — you've contributed more than you've received. You're ahead.`,
        });
      } else if (circleTotals.net < 0) {
        lines.push({
          icon: "sync-outline",
          text: `Your circle net is ${formatSigned(circleTotals.net)} — you've received more than you've contributed so far. Stay on top of upcoming contributions.`,
        });
      } else {
        lines.push({
          icon: "sync-outline",
          text: `Your circle net is balanced — contributions and payouts match.`,
        });
      }
    }
    // Dominance: declare a winner when the top component is ≥ 2× the
    // second by absolute magnitude. Avoids over-claiming on close races.
    const components: { key: "wallet" | "goals" | "circle"; amount: number }[] = [
      { key: "wallet", amount: Math.abs(walletBalance) },
      { key: "goals", amount: Math.abs(totalGoalsBalance) },
      { key: "circle", amount: Math.abs(circleTotals.net) },
    ]
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    let summary: string | null = null;
    if (components.length >= 2 && components[0].amount >= 2 * components[1].amount) {
      const top = components[0].key;
      if (top === "wallet") {
        summary = "Your total position is driven by your wallet balance.";
      } else if (top === "goals") {
        summary = "Your total position is anchored by your goal savings.";
      } else if (circleTotals.net > 0) {
        summary =
          "Your circle activity is the biggest contributor to your position.";
      } else {
        summary =
          "Outstanding circle obligations weigh on your position right now.";
      }
    }
    return { empty: false, lines, summary };
  }, [walletBalance, totalGoalsBalance, circleTotals]);

  // Map keyed by circle id so the bottom-sheet loop can look up the
  // per-circle (contributed, received, net) by the activeCircles row's
  // id in O(1).
  const circleNetById = useMemo(() => {
    const m = new Map<string, { contributed: number; received: number; net: number }>();
    for (const e of circleNetBalances) {
      m.set(e.circleId, {
        contributed: e.contributed,
        received: e.received,
        net: e.net,
      });
    }
    return m;
  }, [circleNetBalances]);

  // ── Active advances tile ─────────────────────────────────────────
  // Active advances feed the new "Advances" card below Goals. The
  // hook is shared with AdvanceHubV2Screen and caches by user id, so
  // calling it here is free when the user has already visited the
  // hub. The dashboard's own useFocusEffect handles refetches — no
  // extra one needed here.
  //
  // We deliberately render the advance amount as a positive
  // "available" balance and DO NOT subtract it from totalNet. The
  // wallet balance already reflects the advance being deposited;
  // double-counting it as a liability would understate the user's
  // working capital.
  const { data: advanceDashboard } = useAdvanceDashboard();
  // Bucket A — Open Score Hub entry signal. Drives the colored dot on
  // the top-bar Score Hub icon when stress is red, mood is at risk, or
  // an AI insight notification is unread. Pure read of cache + already-
  // mounted NotificationContext — no extra RPC.
  const scoreHubBadge = useScoreHubBadge();
  // Bucket A — real XnScore for the credit-score row. `score` is
  // null while the bundle is loading or unavailable; the row renders
  // an em-dash in that case.
  const { score: realXnScore, loading: xnScoreLoading } = useXnScoreFromBundle();
  // Open notifications Bucket A — entry-point signal for the bell.
  // Reads from the already-mounted NotificationContext (no new RPC,
  // realtime subscription is shared). Critical when any unread
  // security-category notification exists; attention when any other
  // unread; none otherwise.
  const notificationsBadge = useNotificationsBadge();

  // ────────────────────────────────────────────────────────────────────
  // Open profile Bucket A — entry-point signal.
  // ────────────────────────────────────────────────────────────────────
  // useProfile shares its 60-second cache with ProfileScreen and
  // PersonalInfoScreen, so mounting it here costs nothing in extra
  // round-trips. We need `profile.avatar_url` for the real-avatar
  // render, and useProfileIconBadge re-reads the same shape to decide
  // critical/attention/none.
  const { profile: profileForIcon } = useProfile();
  const profileIconBadge = useProfileIconBadge();
  // Track Image load failures so the icon falls back to the
  // person-circle-outline glyph rather than rendering a broken square.
  // Reset to false whenever the URL changes — a successful re-upload
  // should get another chance to render.
  const [avatarLoadErrored, setAvatarLoadErrored] = useState(false);
  useEffect(() => {
    setAvatarLoadErrored(false);
  }, [profileForIcon?.avatar_url]);

  // ────────────────────────────────────────────────────────────────────
  // Bucket C — first-launch coach mark on the Score Hub icon.
  // ────────────────────────────────────────────────────────────────────
  // One-shot animated pulse (scale 1 → 1.06 → 1) + tooltip beneath the
  // icon. AsyncStorage flag means this never fires twice for the same
  // user. Mirrors the Contribute-button pulse pattern from
  // CircleDetailScreen task #239 for visual consistency. Auto-clears
  // after 4 s; a tap on the icon OR tooltip dismisses immediately.
  const COACH_FLAG_KEY = "@tandaxn_score_hub_icon_seen_v1";
  const [showCoach, setShowCoach] = useState(false);
  const coachPulseAnim = useRef(new Animated.Value(1)).current;
  const coachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_FLAG_KEY);
        if (cancelled || seen) return;
        await AsyncStorage.setItem(COACH_FLAG_KEY, "1");
        if (!cancelled) setShowCoach(true);
      } catch {
        // Best-effort — a failure means the user just doesn't get the
        // coach mark this session; no functional impact.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showCoach) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(coachPulseAnim, {
          toValue: 1.06,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(coachPulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    coachTimerRef.current = setTimeout(() => {
      setShowCoach(false);
    }, 4000);
    return () => {
      loop.stop();
      if (coachTimerRef.current) {
        clearTimeout(coachTimerRef.current);
        coachTimerRef.current = null;
      }
    };
  }, [showCoach, coachPulseAnim]);

  const dismissCoach = useCallback(() => {
    if (coachTimerRef.current) {
      clearTimeout(coachTimerRef.current);
      coachTimerRef.current = null;
    }
    setShowCoach(false);
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Open profile Bucket C — first-launch coach mark on the Profile icon.
  // ────────────────────────────────────────────────────────────────────
  // Symmetric to the Score Hub coach mark above: same pulse curve, same
  // 4 s auto-dismiss, separate AsyncStorage gate so the two icons can
  // teach themselves independently. Tooltip anchors LEFT instead of
  // RIGHT because the Profile icon sits on the left edge of the topBar.
  const PROFILE_COACH_FLAG_KEY = "@tandaxn_profile_icon_seen_v1";
  const [showProfileCoach, setShowProfileCoach] = useState(false);
  const profileCoachPulseAnim = useRef(new Animated.Value(1)).current;
  const profileCoachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(PROFILE_COACH_FLAG_KEY);
        if (cancelled || seen) return;
        await AsyncStorage.setItem(PROFILE_COACH_FLAG_KEY, "1");
        if (!cancelled) setShowProfileCoach(true);
      } catch {
        // Best-effort — no functional impact if AsyncStorage fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showProfileCoach) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(profileCoachPulseAnim, {
          toValue: 1.06,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(profileCoachPulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    profileCoachTimerRef.current = setTimeout(() => {
      setShowProfileCoach(false);
    }, 4000);
    return () => {
      loop.stop();
      if (profileCoachTimerRef.current) {
        clearTimeout(profileCoachTimerRef.current);
        profileCoachTimerRef.current = null;
      }
    };
  }, [showProfileCoach, profileCoachPulseAnim]);

  const dismissProfileCoach = useCallback(() => {
    if (profileCoachTimerRef.current) {
      clearTimeout(profileCoachTimerRef.current);
      profileCoachTimerRef.current = null;
    }
    setShowProfileCoach(false);
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Open notifications Bucket C — first-launch coach mark on the bell.
  // ────────────────────────────────────────────────────────────────────
  // Third symmetric coach mark, completing the top-bar trio. Same pulse
  // curve and 4 s auto-dismiss as the Profile and Score Hub coach
  // marks. Tooltip anchors below the bell, offset right so it sits
  // under the icon (the bell is just left of the Score Hub icon in
  // the topBar).
  const NOTIF_COACH_FLAG_KEY = "@tandaxn_notifications_icon_seen_v1";
  const [showNotifCoach, setShowNotifCoach] = useState(false);
  const notifCoachPulseAnim = useRef(new Animated.Value(1)).current;
  const notifCoachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(NOTIF_COACH_FLAG_KEY);
        if (cancelled || seen) return;
        await AsyncStorage.setItem(NOTIF_COACH_FLAG_KEY, "1");
        if (!cancelled) setShowNotifCoach(true);
      } catch {
        // Best-effort — no functional impact if AsyncStorage fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showNotifCoach) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(notifCoachPulseAnim, {
          toValue: 1.06,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(notifCoachPulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    notifCoachTimerRef.current = setTimeout(() => {
      setShowNotifCoach(false);
    }, 4000);
    return () => {
      loop.stop();
      if (notifCoachTimerRef.current) {
        clearTimeout(notifCoachTimerRef.current);
        notifCoachTimerRef.current = null;
      }
    };
  }, [showNotifCoach, notifCoachPulseAnim]);

  const dismissNotifCoach = useCallback(() => {
    if (notifCoachTimerRef.current) {
      clearTimeout(notifCoachTimerRef.current);
      notifCoachTimerRef.current = null;
    }
    setShowNotifCoach(false);
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Bucket C — telemetry: log every transition of the icon-badge
  // urgency. Fires once per distinct value (the ref prevents same-value
  // re-emits on unrelated re-renders).
  // ────────────────────────────────────────────────────────────────────
  const { track } = useEventTracker();
  const lastBadgeUrgencyRef = useRef<string | null>(null);
  useEffect(() => {
    if (scoreHubBadge.urgency === "none") {
      // Reset so a return-to-attention later still emits.
      lastBadgeUrgencyRef.current = null;
      return;
    }
    if (lastBadgeUrgencyRef.current === scoreHubBadge.urgency) return;
    lastBadgeUrgencyRef.current = scoreHubBadge.urgency;
    track({
      eventType: "score_hub_icon_badge_visible",
      eventCategory: "score",
      eventAction: "icon_badge_visible",
      eventLabel: scoreHubBadge.urgency,
      eventValue: {
        has_urgent_alert: scoreHubBadge.hasUrgentAlert,
        has_unread_insight: scoreHubBadge.hasUnreadInsight,
        has_updated_since_last_visit:
          scoreHubBadge.hasUpdatedSinceLastVisit,
        unread_insight_count: scoreHubBadge.unreadInsightCount,
      },
    });
  }, [
    scoreHubBadge.urgency,
    scoreHubBadge.hasUrgentAlert,
    scoreHubBadge.hasUnreadInsight,
    scoreHubBadge.hasUpdatedSinceLastVisit,
    scoreHubBadge.unreadInsightCount,
    track,
  ]);

  // Open profile Bucket C — telemetry for the Profile icon badge.
  // Same pattern as the Score Hub badge above: ref-guarded so only
  // distinct urgency transitions emit, and resets on 'none' so a
  // later return-to-attention also fires.
  const lastProfileBadgeUrgencyRef = useRef<string | null>(null);
  useEffect(() => {
    if (profileIconBadge.urgency === "none") {
      lastProfileBadgeUrgencyRef.current = null;
      return;
    }
    if (lastProfileBadgeUrgencyRef.current === profileIconBadge.urgency)
      return;
    lastProfileBadgeUrgencyRef.current = profileIconBadge.urgency;
    track({
      eventType: "profile_icon_badge_visible",
      eventCategory: "settings",
      eventAction: "icon_badge_visible",
      eventLabel: profileIconBadge.urgency,
      eventValue: {
        is_critical: profileIconBadge.isCritical,
        has_attention: profileIconBadge.hasAttention,
      },
    });
  }, [
    profileIconBadge.urgency,
    profileIconBadge.isCritical,
    profileIconBadge.hasAttention,
    track,
  ]);

  // Open notifications Bucket C — telemetry for the bell icon badge.
  // Third icon in the trio; same guard pattern. eventCategory is
  // 'system' since NotificationContext is the operational surface;
  // we want this distinct from the profile (settings) and score
  // (score) labels so dashboards can break out engagement per icon.
  const lastNotifBadgeUrgencyRef = useRef<string | null>(null);
  useEffect(() => {
    if (notificationsBadge.urgency === "none") {
      lastNotifBadgeUrgencyRef.current = null;
      return;
    }
    if (lastNotifBadgeUrgencyRef.current === notificationsBadge.urgency)
      return;
    lastNotifBadgeUrgencyRef.current = notificationsBadge.urgency;
    track({
      eventType: "notifications_icon_badge_visible",
      eventCategory: "system",
      eventAction: "icon_badge_visible",
      eventLabel: notificationsBadge.urgency,
      eventValue: {
        unread_count: notificationsBadge.unreadCount,
        critical_count: notificationsBadge.criticalCount,
      },
    });
  }, [
    notificationsBadge.urgency,
    notificationsBadge.unreadCount,
    notificationsBadge.criticalCount,
    track,
  ]);

  const activeAdvances = useMemo(
    () => advanceDashboard?.active_advances ?? [],
    [advanceDashboard],
  );
  const hasActiveAdvances = activeAdvances.length > 0;
  const totalAdvancePrincipal = useMemo(
    () =>
      activeAdvances.reduce(
        (sum, a) => sum + (a.principal_cents || 0),
        0,
      ) / 100,
    [activeAdvances],
  );
  // The dashboard pre-computes the sum of outstanding cents server-
  // side, so reuse it instead of re-iterating the list. `repaid` is
  // derived locally — there's no `repaid_cents` column.
  const totalAdvanceOutstanding =
    (advanceDashboard?.outstanding_balance_cents ?? 0) / 100;
  const totalAdvanceRepaid = Math.max(
    0,
    totalAdvancePrincipal - totalAdvanceOutstanding,
  );
  const advanceRepaidPct =
    totalAdvancePrincipal > 0
      ? Math.min(
          100,
          Math.round((totalAdvanceRepaid / totalAdvancePrincipal) * 100),
        )
      : 0;
  // The dashboard's `next_payment_due.date` already picks the earliest
  // upcoming payment across active loans. Keeping it as a single
  // pre-computed field saves a min() pass over active_advances.
  const earliestAdvanceDueDate =
    advanceDashboard?.next_payment_due?.date ?? null;

  // Progress % for the primary goal card. 0 when there's no goal or no
  // target set, clamped to 100 so a goal that overshot its target doesn't
  // overflow the progress bar.
  const goalProgressPct = useMemo(() => {
    if (!primaryGoal || !primaryGoal.targetAmount || primaryGoal.targetAmount <= 0) {
      return 0;
    }
    const raw =
      ((primaryGoal.currentBalance ?? 0) / primaryGoal.targetAmount) * 100;
    return Math.min(100, Math.round(raw));
  }, [primaryGoal]);

  // P1 eligibility rule (2026-06-12): allow the user to open the Advance
  // hub as long as they are in at least one active circle and their net
  // position isn't negative. The real, score-aware gating happens
  // server-side in get_advance_dashboard / request_advance — the button
  // only needs to surface a meaningful entry point here.
  const advanceEligible =
    circleNetBalance >= 0 &&
    hasActiveCircle &&
    mockData.has_been_in_circle_30_days;

  // ----- Navigation handlers -----
  const handleManageGoals = () => {
    navigation.navigate(Routes.GoalsHubV2);
  };
  const handleRequestAdvance = () => {
    if (!advanceEligible) return;
    navigation.navigate(Routes.AdvanceHubV2);
  };
  const handleCirclePress = (circle: Circle) => {
    navigation.navigate(Routes.CircleDetail, { circleId: circle.id });
  };
  const handleViewCreditReport = () => {
    navigation.navigate(Routes.CreditReport);
  };
  const handleOpenScoreHub = () => {
    navigation.navigate(Routes.ScoreHub);
  };
  const handleOpenProfile = () => {
    navigation.navigate(Routes.ProfileMain);
  };
  const handleOpenNotifications = () => {
    navigation.navigate(Routes.NotificationsInbox);
  };
  const handleOpenWallet = () => {
    navigation.navigate(Routes.WalletMain);
  };
  const handleCreateGoal = () => {
    navigation.navigate(Routes.GoalCreateExpress);
  };
  const handleOpenCircleBreakdown = () => {
    setShowCircleSheet(true);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== KYC BANNER (P1 — persistent, non-dismissible) =====
            Distinct from the dismissible "soft verify" email-verification
            banner below: this one nags every visit until KYC is approved
            (or in a pending state). The dismiss affordance is omitted
            deliberately — the banner is the single source-of-truth that
            money actions remain blocked, and the P0 KYCGate uses the
            same status field so the two surfaces stay in sync. */}
        {showKycBanner ? (
          <View style={styles.kycBanner}>
            <Ionicons
              name="shield-outline"
              size={20}
              color={colors.warningLabel}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.kycBannerTitle}>
                {t("kyc_home_banner.title")}
              </Text>
              <Text style={styles.kycBannerBody}>
                {t("kyc_home_banner.body")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleOpenKycBanner}
              style={styles.kycBannerCta}
              accessibilityRole="button"
              accessibilityLabel={t("kyc_home_banner.button")}
            >
              <Text style={styles.kycBannerCtaText}>
                {t("kyc_home_banner.button")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== SOFT VERIFY BANNER ===== */}
        {showVerifyBanner ? (
          <View style={styles.verifyBanner}>
            <Ionicons
              name="shield-checkmark-outline"
              size={18}
              color={colors.warningAmber}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.verifyBannerTitle}>
                {t("home_screen.verify_banner_title")}
              </Text>
              <Text style={styles.verifyBannerBody}>
                {t("home_screen.verify_banner_body")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleOpenVerify}
              style={styles.verifyBannerCta}
              accessibilityRole="button"
            >
              <Text style={styles.verifyBannerCtaText}>
                {t("home_screen.verify_banner_cta")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setVerifyBannerDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.verify_banner_dismiss_a11y")}
            >
              <Ionicons
                name="close"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== TOP BAR — header icon row =====
            HomeStack has headerShown: false, so all top-bar triggers live
            in-content above the Balance Card. Left: profile (avatar
            replacement). Right: notifications + Score Hub.
            Restores the Profile + Notifications entry points that the
            old DashboardScreen exposed in its avatar/bell pair. */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => {
              // Open profile Bucket C — tap dismisses the coach mark
              // immediately so it doesn't linger over the Profile
              // screen the user is about to land on.
              dismissProfileCoach();
              handleOpenProfile();
            }}
            style={styles.topBarIconBtn}
            accessibilityRole="button"
            accessibilityLabel={(() => {
              const base = t("home_screen.header_profile_a11y");
              // Priority — critical wins over attention. Same single-
              // suffix convention as the Score Hub icon to keep screen-
              // reader labels short.
              if (profileIconBadge.urgency === "critical") {
                return `${base}, ${t(
                  "home_screen.header_profile_kyc_action",
                )}`;
              }
              if (profileIconBadge.urgency === "attention") {
                return `${base}, ${t(
                  "home_screen.header_profile_complete_profile",
                )}`;
              }
              return base;
            })()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View
              style={[
                styles.profileIconWrap,
                {
                  transform: [
                    { scale: showProfileCoach ? profileCoachPulseAnim : 1 },
                  ],
                },
              ]}
            >
              {/* Open profile Bucket A — render the real avatar when
                  useProfile has it. Falls back to person-circle-outline
                  when the URL is null/missing OR the Image fails to
                  load (handled by avatarLoadErrored). */}
              {profileForIcon?.avatar_url && !avatarLoadErrored ? (
                <Image
                  source={{ uri: profileForIcon.avatar_url }}
                  style={styles.profileAvatarImage}
                  onError={() => setAvatarLoadErrored(true)}
                />
              ) : (
                <Ionicons
                  name="person-circle-outline"
                  size={24}
                  color={colors.primaryNavy}
                />
              )}
              {profileIconBadge.urgency !== "none" ? (
                <View
                  style={[
                    styles.profileBadge,
                    profileIconBadge.urgency === "critical"
                      ? styles.profileBadgeCritical
                      : styles.profileBadgeAttention,
                  ]}
                />
              ) : null}
            </Animated.View>
          </TouchableOpacity>

          {/* Open profile Bucket C — first-launch coach mark tooltip.
              Anchored LEFT (Profile icon sits on the left edge of the
              topBar), mirroring the Score Hub tooltip which anchors
              right. Tap-anywhere on the card to dismiss; the icon's
              onPress dismisses too. Auto-clears after 4 s. */}
          {showProfileCoach ? (
            <Pressable
              onPress={dismissProfileCoach}
              style={styles.profileCoachTooltip}
              accessibilityRole="alert"
              accessibilityLabel={t("home_screen.profile_icon_coach")}
            >
              <View style={styles.profileCoachArrow} />
              <Text style={styles.profileCoachText}>
                {t("home_screen.profile_icon_coach")}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            onPress={() => {
              // Bucket C — dismiss the coach mark immediately on tap
              // so it doesn't linger over the inbox screen the user
              // is about to land on.
              dismissNotifCoach();
              handleOpenNotifications();
            }}
            style={[styles.topBarIconBtn, { marginRight: 8 }]}
            accessibilityRole="button"
            accessibilityLabel={(() => {
              const base = t("home_screen.header_notifications_a11y");
              // Priority — critical wins over attention. Same single-
              // suffix convention as the Profile and Score Hub icons
              // to keep screen-reader labels short.
              if (notificationsBadge.urgency === "critical") {
                return `${base}, ${t(
                  "home_screen.header_notifications_security_alert",
                )}`;
              }
              if (
                notificationsBadge.urgency === "attention" &&
                notificationsBadge.unreadCount > 0
              ) {
                return `${base}, ${t(
                  "home_screen.header_notifications_unread_count",
                  { count: notificationsBadge.unreadCount },
                )}`;
              }
              return base;
            })()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View
              style={[
                styles.notificationsIconWrap,
                {
                  transform: [
                    { scale: showNotifCoach ? notifCoachPulseAnim : 1 },
                  ],
                },
              ]}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.primaryNavy}
              />
              {notificationsBadge.urgency !== "none" ? (
                <View
                  style={[
                    styles.notificationsBadge,
                    notificationsBadge.urgency === "critical"
                      ? styles.notificationsBadgeCritical
                      : styles.notificationsBadgeAttention,
                  ]}
                />
              ) : null}
            </Animated.View>
          </TouchableOpacity>

          {/* Open notifications Bucket C — first-launch coach mark
              tooltip. The bell sits between Profile (left) and Score
              Hub (right) in the topBar. Anchored to the right side of
              the topBar with an offset that puts the tooltip under
              the bell rather than under the Score Hub icon. Tap-
              anywhere on the card to dismiss; auto-clears after 4 s. */}
          {showNotifCoach ? (
            <Pressable
              onPress={dismissNotifCoach}
              style={styles.notifCoachTooltip}
              accessibilityRole="alert"
              accessibilityLabel={t("home_screen.notifications_icon_coach")}
            >
              <View style={styles.notifCoachArrow} />
              <Text style={styles.notifCoachText}>
                {t("home_screen.notifications_icon_coach")}
              </Text>
            </Pressable>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              dismissCoach();
              handleOpenScoreHub();
            }}
            style={styles.topBarIconBtn}
            accessibilityRole="button"
            accessibilityLabel={(() => {
              const base = t("home_screen.header_score_hub_a11y");
              // Priority order on a11y suffix:
              //   1. Critical or moderate alert  → "attention needed"
              //   2. Unread AI insight           → "new insight available"
              //   3. Updated since last visit    → "updated since last
              //      visit" (Bucket C — the gentlest of the three; only
              //      announced when nothing harder is present)
              // Screen readers only get one suffix to keep the label short.
              if (scoreHubBadge.hasUrgentAlert) {
                return `${base}, ${t(
                  "home_screen.header_score_hub_attention_needed",
                )}`;
              }
              if (scoreHubBadge.hasUnreadInsight) {
                return `${base}, ${t(
                  "home_screen.header_score_hub_new_insight",
                )}`;
              }
              if (scoreHubBadge.hasUpdatedSinceLastVisit) {
                return `${base}, ${t(
                  "home_screen.header_score_hub_updated",
                )}`;
              }
              return base;
            })()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View
              style={[
                styles.scoreHubIconWrap,
                {
                  transform: [
                    { scale: showCoach ? coachPulseAnim : 1 },
                  ],
                },
              ]}
            >
              {/* Bucket A — switched from stats-chart-outline to
                  pulse-outline so the icon visually echoes the stress
                  card and reads as a live signal rather than a static
                  chart. */}
              <Ionicons
                name="pulse-outline"
                size={22}
                color={colors.primaryNavy}
              />
              {scoreHubBadge.urgency !== "none" ? (
                <View
                  style={[
                    styles.scoreHubBadge,
                    scoreHubBadge.urgency === "critical"
                      ? styles.scoreHubBadgeCritical
                      : styles.scoreHubBadgeAttention,
                  ]}
                />
              ) : null}
            </Animated.View>
          </TouchableOpacity>

          {/* Bucket C — first-launch coach mark tooltip. Anchored to the
              right edge of the top bar so it tracks the Score Hub icon
              regardless of which other top-bar buttons are showing.
              Tap-anywhere on the card to dismiss; the icon's onPress
              also dismisses (see above). Auto-clears after 4 s via the
              setTimeout in the effect that started the pulse. */}
          {showCoach ? (
            <Pressable
              onPress={dismissCoach}
              style={styles.scoreHubCoachTooltip}
              accessibilityRole="alert"
              accessibilityLabel={t("home_screen.score_hub_icon_coach")}
            >
              <View style={styles.scoreHubCoachArrow} />
              <Text style={styles.scoreHubCoachText}>
                {t("home_screen.score_hub_icon_coach")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* ===== MAIN BALANCE CARD ===== */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowCircleSheet(true)}
          style={styles.balanceCardWrap}
          accessibilityRole="button"
          accessibilityLabel={t("home_screen.balance_card_a11y")}
        >
          <LinearGradient
            colors={[colors.primaryNavy, "#143654"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>
              {t("home_screen.total_net_position")}
            </Text>
            <Text style={styles.balanceAmount}>{formatPlain(totalNet)}</Text>

            {/* Tier badge — small chip directly under the big amount.
                Bucket A: skeleton until tier resolves. Don't lie. */}
            {tier ? (
              <TouchableOpacity
                style={styles.tierBadgeRow}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setShowTierModal(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("home_screen.tier_badge_a11y", {
                  tier: tier.label,
                })}
              >
                <View
                  style={[
                    styles.tierBadge,
                    { backgroundColor: `${tier.color}33` },
                  ]}
                >
                  <Text style={styles.tierEmoji}>{tier.icon}</Text>
                  <Text style={styles.tierLabel}>{tier.label}</Text>
                </View>
                <Text style={styles.tierBenefitsLink}>
                  {t("home_screen.tier_benefits_link")}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={colors.textOnNavy}
                />
              </TouchableOpacity>
            ) : (
              <View
                style={styles.tierBadgeRow}
                accessibilityLabel={t("home_screen.tier_loading_a11y")}
              >
                <View style={[styles.tierBadge, styles.tierBadgeSkeleton]}>
                  <Text style={styles.tierSkeletonLabel}>
                    {tierLoading
                      ? t("home_screen.tier_loading_label")
                      : t("home_screen.tier_unavailable_label")}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.divider} />

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenWallet();
              }}
              style={({ pressed }) => [
                styles.breakdownRow,
                styles.breakdownRowTappable,
                pressed && styles.breakdownRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.breakdown_wallet_a11y")}
            >
              <Text style={styles.breakdownLabel}>
                {t("home_screen.wallet")}
              </Text>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownValue}>
                  {formatPlain(walletBalance)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textOnNavy} />
              </View>
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleManageGoals();
              }}
              style={({ pressed }) => [
                styles.breakdownRow,
                styles.breakdownRowTappable,
                pressed && styles.breakdownRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.breakdown_goals_a11y")}
            >
              <Text style={styles.breakdownLabel}>
                {t("home_screen.goals")}
              </Text>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownValue}>
                  {goalsLoading && goals.length === 0
                    ? "—"
                    : formatSigned(totalGoalsBalance)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textOnNavy} />
              </View>
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenCircleBreakdown();
              }}
              style={({ pressed }) => [
                styles.breakdownRow,
                styles.breakdownRowTappable,
                pressed && styles.breakdownRowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.breakdown_circle_net_a11y")}
            >
              <Text style={styles.breakdownLabel}>
                {t("home_screen.circle_net")}
              </Text>
              <View style={styles.breakdownRight}>
                <Text style={styles.breakdownValue}>
                  {circleNetLoading && circleNetBalances.length === 0
                    ? "—"
                    : formatSigned(circleNetBalance)}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textOnNavy} />
              </View>
            </Pressable>

            <TouchableOpacity
              style={styles.whyBalanceRow}
              onPress={(e) => {
                e.stopPropagation?.();
                setShowAiSheet(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.why_balance_link")}
            >
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={colors.textOnNavy}
              />
              <Text style={styles.whyBalanceText}>
                {t("home_screen.why_balance_link")}
              </Text>
            </TouchableOpacity>

            <View style={styles.tapHintRow}>
              <Text style={styles.tapHint}>
                {t("home_screen.tap_for_breakdown")}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textOnNavy} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ===== GOALS CARD ===== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flag-outline" size={18} color={colors.primaryNavy} />
            <Text style={styles.sectionTitle}>
              {t("home_screen.goals_card_title")}
            </Text>
          </View>

          {primaryGoal ? (
            <>
              <Text style={styles.goalPrimaryLabel}>
                {t("home_screen.goals_primary_label")}
              </Text>
              <Text style={styles.goalName}>{primaryGoal.name}</Text>

              <View style={styles.progressBarBg}>
                <View
                  style={[styles.progressBarFill, { width: `${goalProgressPct}%` }]}
                />
              </View>
              <View style={styles.goalAmountRow}>
                <Text style={styles.goalAmountText}>
                  {formatPlain(primaryGoal.currentBalance ?? 0)}
                  <Text style={styles.goalAmountSep}>
                    {" "}
                    / {formatPlain(primaryGoal.targetAmount ?? 0)}
                  </Text>
                </Text>
                <Text style={styles.goalAmountPct}>{goalProgressPct}%</Text>
              </View>
            </>
          ) : (
            <Text style={styles.goalEmptyText}>
              {goalsLoading
                ? t("home_screen.goals_loading", {
                    defaultValue: "Loading your goals…",
                  })
                : t("home_screen.goals_empty", {
                    defaultValue:
                      "No goals yet. Tap Create goal to start saving for what matters.",
                  })}
            </Text>
          )}

          <View style={styles.goalsButtonRow}>
            <TouchableOpacity
              style={[styles.primaryBtn, styles.goalsButtonFlex]}
              onPress={handleManageGoals}
              accessibilityRole="button"
            >
              <Text style={styles.primaryBtnText}>
                {t("home_screen.goals_manage_btn")}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textWhite} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.outlineBtn, styles.goalsButtonFlex]}
              onPress={handleCreateGoal}
              accessibilityRole="button"
              accessibilityLabel={t("home_screen.goals_create_btn")}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={colors.primaryNavy}
              />
              <Text style={styles.outlineBtnText}>
                {t("home_screen.goals_create_btn")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== ADVANCES CARD =====
            Shown only when the user has at least one active advance.
            Loading is hidden behind hasActiveAdvances so there's no
            transient flash for users without advances (the hook
            settles fast from its module-level cache). Spec: surface
            the advance as a positive "available" balance — never
            subtracted from totalNet. */}
        {hasActiveAdvances ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="cash-outline"
                size={18}
                color={colors.primaryNavy}
              />
              <Text style={styles.sectionTitle}>
                {t("home_screen.advances.title")}
              </Text>
            </View>

            <Text style={styles.goalPrimaryLabel}>
              {t("home_screen.advances.subtitle_received", {
                amount: formatPlain(totalAdvancePrincipal),
              })}
              {earliestAdvanceDueDate
                ? " " +
                  t("home_screen.advances.subtitle_repay_by", {
                    date: formatDueDate(earliestAdvanceDueDate),
                  })
                : ""}
            </Text>

            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${advanceRepaidPct}%` },
                ]}
              />
            </View>
            <View style={styles.goalAmountRow}>
              <Text style={styles.goalAmountText}>
                {t("home_screen.advances.progress_label", {
                  repaid: formatPlain(totalAdvanceRepaid),
                  total: formatPlain(totalAdvancePrincipal),
                })}
              </Text>
              <Text style={styles.goalAmountPct}>{advanceRepaidPct}%</Text>
            </View>

            <View style={styles.advancesButtonRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate(Routes.AdvanceHubV2)}
                accessibilityRole="button"
                accessibilityLabel={t("home_screen.advances.button_manage")}
              >
                <Text style={styles.primaryBtnText}>
                  {t("home_screen.advances.button_manage")}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.textWhite}
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* ===== RECENT ACTIVITY CARD ===== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="receipt-outline" size={18} color={colors.primaryNavy} />
            <Text style={styles.sectionTitle}>
              {t("home_screen.recent_activity")}
            </Text>
          </View>

          {mockActivity.map((row, idx) => (
            <View
              key={row.id}
              style={[
                styles.activityRow,
                idx === mockActivity.length - 1 && styles.activityRowLast,
              ]}
            >
              <View
                style={[
                  styles.activityIcon,
                  {
                    backgroundColor:
                      row.direction === "in"
                        ? colors.successBg
                        : colors.warningBg,
                  },
                ]}
              >
                <Ionicons
                  name={
                    row.direction === "in"
                      ? "arrow-down-outline"
                      : "arrow-up-outline"
                  }
                  size={14}
                  color={
                    row.direction === "in"
                      ? colors.successText
                      : colors.warningLabel
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityDesc} numberOfLines={1}>
                  {t(row.descKey, row.descParams ?? {})}
                </Text>
                <Text style={styles.activityDate}>{row.date}</Text>
              </View>
              <Text
                style={[
                  styles.activityAmount,
                  row.amount >= 0
                    ? { color: colors.successText }
                    : { color: colors.textPrimary },
                ]}
              >
                {formatSigned(row.amount)}
              </Text>
            </View>
          ))}
        </View>

        {/* ===== ACTIVE CIRCLES & POSITIONS CARD ===== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color={colors.primaryNavy} />
            <Text style={styles.sectionTitle}>
              {t("home_screen.active_circles")}
            </Text>
          </View>

          {activeCircles.length === 0 ? (
            <View style={styles.circlesEmpty}>
              <Ionicons
                name="people-outline"
                size={28}
                color={colors.textSecondary}
              />
              <Text style={styles.circlesEmptyTitle}>
                {t("home_screen.circles_empty_title")}
              </Text>
              <Text style={styles.circlesEmptyBody}>
                {t("home_screen.circles_empty_body")}
              </Text>
            </View>
          ) : (
            activeCircles.map((circle, idx) => {
              const position =
                circle.myPosition && circle.memberCount
                  ? t("home_screen.circles_position_format", {
                      position: circle.myPosition,
                      total: circle.memberCount,
                    })
                  : t("home_screen.circles_position_next");
              return (
                <TouchableOpacity
                  key={circle.id}
                  style={[
                    styles.circleRow,
                    idx === activeCircles.length - 1 && styles.circleRowLast,
                  ]}
                  onPress={() => handleCirclePress(circle)}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.circleName}>
                      {circle.emoji ? `${circle.emoji}  ` : ""}
                      {circle.name}
                    </Text>
                    <Text style={styles.circleMeta}>
                      {t("home_screen.circles_amount_per_cycle", {
                        amount: circle.amount.toFixed(0),
                        frequency: t(
                          `home_screen.circles_frequency_${circle.frequency}`,
                          { defaultValue: circle.frequency },
                        ),
                      })}
                    </Text>
                    <Text style={styles.circleMeta}>
                      {t("home_screen.circles_position_label")}{" "}
                      <Text style={styles.circlePosition}>{position}</Text>
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ===== FUTURE SNAPSHOT CARD ===== */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={18} color={colors.primaryNavy} />
            <Text style={styles.sectionTitle}>
              {t("home_screen.future_snapshot")}
            </Text>
          </View>

          {/* Upcoming obligations */}
          <Text style={styles.subSectionLabel}>
            {t("home_screen.future_upcoming_title")}
          </Text>
          {mockUpcoming.map((row) => (
            <View key={row.id} style={styles.futureRow}>
              <Text style={styles.futureDate}>{row.date}</Text>
              <Text style={styles.futureName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.futureAmount, { color: colors.textPrimary }]}>
                {formatSigned(-row.amount)}
              </Text>
            </View>
          ))}

          {/* Expected payouts */}
          <Text style={[styles.subSectionLabel, { marginTop: 14 }]}>
            {t("home_screen.future_expected_title")}
          </Text>
          {mockExpectedPayouts.map((row) => (
            <View key={row.id} style={styles.futureRow}>
              <Text style={styles.futureDate}>{row.date}</Text>
              <Text style={styles.futureName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.futureAmount, { color: colors.successText }]}>
                {formatSigned(row.amount)}
              </Text>
            </View>
          ))}

          {/* Credit Report snapshot */}
          <TouchableOpacity
            style={styles.creditRow}
            onPress={handleViewCreditReport}
            accessibilityRole="button"
            accessibilityLabel={t("home_screen.credit_view_full_report")}
          >
            <View style={styles.creditLeft}>
              <Ionicons
                name="trending-up-outline"
                size={16}
                color={colors.primaryNavy}
              />
              <Text style={styles.creditLabel}>
                {t("home_screen.xn_score_label")}
              </Text>
              {realXnScore != null ? (
                <Text style={styles.creditScore}>{realXnScore}</Text>
              ) : xnScoreLoading ? (
                <ActivityIndicator size="small" color={colors.primaryNavy} />
              ) : (
                <Text style={styles.creditScore}>—</Text>
              )}
            </View>
            <View style={styles.creditRight}>
              <Text style={styles.creditLink}>
                {t("home_screen.credit_view_full_report")}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={colors.accentTeal}
              />
            </View>
          </TouchableOpacity>

          {/* Advance V2 button */}
          <TouchableOpacity
            style={[
              styles.advanceBtn,
              !advanceEligible && styles.advanceBtnDisabled,
            ]}
            onPress={handleRequestAdvance}
            disabled={!advanceEligible}
            accessibilityRole="button"
            accessibilityLabel={
              advanceEligible
                ? t("home_screen.advance_btn")
                : t("home_screen.advance_tooltip_ineligible")
            }
          >
            <Ionicons
              name="flash-outline"
              size={16}
              color={advanceEligible ? colors.textWhite : colors.textSecondary}
            />
            <Text
              style={[
                styles.advanceBtnText,
                !advanceEligible && styles.advanceBtnTextDisabled,
              ]}
            >
              {advanceEligible
                ? t("home_screen.advance_btn")
                : t("home_screen.advance_btn_ineligible")}
            </Text>
          </TouchableOpacity>
          {!advanceEligible && (
            <Text style={styles.advanceHint}>
              {t("home_screen.advance_tooltip_ineligible")}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* ===== CIRCLE NET BREAKDOWN BOTTOM SHEET ===== */}
      <Modal
        visible={showCircleSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCircleSheet(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowCircleSheet(false)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>
              {t("home_screen.sheet_title")}
            </Text>
            <Text style={styles.sheetSubtitle}>
              {t("home_screen.sheet_subtitle")}
            </Text>

            <View style={styles.sheetList}>
              {activeCircles.length === 0 ? (
                <Text style={styles.sheetEmpty}>
                  {t("home_screen.circles_empty_body")}
                </Text>
              ) : (
                activeCircles.map((c) => {
                  // Real per-circle figures from useCircleNetBalance.
                  // Falls back to zeros if a circle in `activeCircles`
                  // has no contributions or payouts yet (or if the
                  // membership row landed before the hook's cache
                  // settles) so the row still renders cleanly.
                  const stat = circleNetById.get(c.id);
                  const contributed = stat?.contributed ?? 0;
                  const received = stat?.received ?? 0;
                  const net = stat?.net ?? received - contributed;
                  return (
                    <View key={c.id} style={styles.sheetRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sheetCircleName}>
                          {c.emoji ? `${c.emoji}  ` : ""}
                          {c.name}
                        </Text>
                        <Text style={styles.sheetCircleSub}>
                          {t("home_screen.contributed_received", {
                            contributed: contributed.toFixed(2),
                            received: received.toFixed(2),
                          })}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.sheetCircleNet,
                          net > 0
                            ? { color: colors.successText }
                            : net < 0
                              ? { color: colors.errorText }
                              : { color: colors.textSecondary },
                        ]}
                      >
                        {formatSigned(net)}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.sheetTotalsCard}>
              <View style={styles.sheetTotalsRow}>
                <Text style={styles.sheetTotalsLabel}>
                  {t("home_screen.total_contributed")}
                </Text>
                <Text style={styles.sheetTotalsValue}>
                  {formatPlain(circleTotals.contributed)}
                </Text>
              </View>
              <View style={styles.sheetTotalsRow}>
                <Text style={styles.sheetTotalsLabel}>
                  {t("home_screen.total_received")}
                </Text>
                <Text style={styles.sheetTotalsValue}>
                  {formatPlain(circleTotals.received)}
                </Text>
              </View>
              <View style={[styles.sheetTotalsRow, styles.sheetTotalsRowBold]}>
                <Text style={styles.sheetTotalsLabelBold}>
                  {t("home_screen.net_position")}
                </Text>
                <Text
                  style={[
                    styles.sheetTotalsValueBold,
                    circleTotals.net > 0
                      ? { color: colors.successText }
                      : circleTotals.net < 0
                        ? { color: colors.errorText }
                        : { color: colors.textPrimary },
                  ]}
                >
                  {formatSigned(circleTotals.net)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setShowCircleSheet(false)}
              accessibilityRole="button"
            >
              <Text style={styles.sheetCloseBtnText}>{t("common.close")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== "WHY THIS BALANCE?" AI EXPLAINER SHEET ===== */}
      <Modal
        visible={showAiSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAiSheet(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowAiSheet(false)}
        >
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.aiSheetHeader}>
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={colors.accentTeal}
              />
              <Text style={styles.sheetTitle}>
                {t("home_screen.ai_sheet_title")}
              </Text>
            </View>
            <Text style={styles.sheetSubtitle}>
              {t("home_screen.ai_sheet_subtitle")}
            </Text>

            {/* Bucket A — data-derived body. Replaces the legacy static
                i18n string with per-component lines computed from the
                user's real wallet, goals, and circle net. Empty-state
                copy when nothing is populated yet. */}
            <View style={styles.aiBodyCard}>
              {aiExplanation.empty ? (
                <Text style={styles.aiBodyText}>
                  We don't have enough activity yet to explain your balance.
                  Start saving or join a circle to see insights.
                </Text>
              ) : (
                <>
                  {aiExplanation.lines.map((line, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.aiBodyLineRow,
                        idx > 0 && { marginTop: 10 },
                      ]}
                    >
                      <Ionicons
                        name={line.icon}
                        size={14}
                        color={colors.accentTeal}
                        style={{ marginTop: 3 }}
                      />
                      <Text style={[styles.aiBodyText, { flex: 1 }]}>
                        {line.text}
                      </Text>
                    </View>
                  ))}
                  {aiExplanation.summary ? (
                    <Text style={styles.aiBodySummary}>
                      {aiExplanation.summary}
                    </Text>
                  ) : null}
                </>
              )}
            </View>

            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={() => setShowAiSheet(false)}
              accessibilityRole="button"
            >
              <Text style={styles.sheetCloseBtnText}>{t("common.close")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== TIER BENEFITS MODAL ===== */}
      {/* Gated on `tier` existing — the skeleton badge is non-tappable, so
          if `tier` is null the modal can't open via UI. Belt-and-suspenders
          guard here in case any other code path flips showTierModal. */}
      <Modal
        visible={showTierModal && !!tier}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTierModal(false)}
      >
        <Pressable
          style={styles.tierBackdrop}
          onPress={() => setShowTierModal(false)}
        >
          <Pressable style={styles.tierModal} onPress={() => {}}>
            <View
              style={[
                styles.tierModalHeader,
                { backgroundColor: `${tier?.color ?? "#6B7280"}1A` },
              ]}
            >
              <Text style={styles.tierModalEmoji}>{tier?.icon}</Text>
              <Text style={[styles.tierModalLabel, { color: tier?.color }]}>
                {tier?.label}
              </Text>
            </View>

            <Text style={styles.tierModalTitle}>
              {t("home_screen.tier_benefits_title")}
            </Text>
            <Text style={styles.tierModalBody}>{tier?.featuresSummary}</Text>
            <Text style={styles.tierModalBodyMuted}>{tier?.description}</Text>

            <TouchableOpacity
              style={styles.tierModalClose}
              onPress={() => setShowTierModal(false)}
              accessibilityRole="button"
            >
              <Text style={styles.tierModalCloseText}>{t("common.close")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ==========================================================================
// Styles
// ==========================================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // ----- KYC banner (P1 — persistent, non-dismissible) -----
  kycBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: colors.warningBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginBottom: 12,
  },
  kycBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.warningLabel,
  },
  kycBannerBody: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  kycBannerCta: {
    backgroundColor: colors.primaryNavy,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  kycBannerCtaText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 12,
  },

  // ----- Soft verify banner (email confirmation nudge) -----
  verifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: colors.warningBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
    marginBottom: 12,
  },
  verifyBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.warningLabel,
  },
  verifyBannerBody: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    lineHeight: 14,
  },
  verifyBannerCta: {
    backgroundColor: colors.primaryNavy,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  verifyBannerCtaText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 11,
  },

  // ----- In-content top bar (Score Hub icon) -----
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  topBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  // ----- Bucket A — Score Hub icon badge -----
  // Wrap exists only so the badge can position itself relative to the
  // glyph (not the surrounding button chrome). Same trick used by the
  // notification-bell icons elsewhere — keeps the dot anchored to the
  // visual icon, not the touch target.
  scoreHubIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreHubBadge: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    // Match the button's background so the badge "punches out" against
    // the chip, not the page bg — looks clean on both light and dark.
    borderColor: colors.cardBg,
  },
  scoreHubBadgeCritical: {
    backgroundColor: "#EF4444",
  },
  scoreHubBadgeAttention: {
    backgroundColor: "#F59E0B",
  },
  // ----- Open profile Bucket A — Profile icon avatar + badge -----
  // Mirror of scoreHubIconWrap/scoreHubBadge so the two top-bar icons
  // share dimensions and badge slot. Styles are duplicated rather than
  // shared so a future change to one badge doesn't accidentally drag
  // the other along.
  profileIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  profileBadge: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  profileBadgeCritical: {
    backgroundColor: "#EF4444",
  },
  profileBadgeAttention: {
    backgroundColor: "#F59E0B",
  },
  // ----- Open notifications Bucket A — bell icon badge -----
  // Same dimensions and slot offset as the Score Hub and Profile
  // badges. Styles are duplicated rather than shared so a future tweak
  // to one badge doesn't accidentally drag the other two along.
  notificationsIconWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationsBadge: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.cardBg,
  },
  notificationsBadgeCritical: {
    backgroundColor: "#EF4444",
  },
  notificationsBadgeAttention: {
    backgroundColor: "#F59E0B",
  },
  // ----- Open notifications Bucket C — bell coach mark tooltip -----
  // Anchored relative to the topBar's right edge. The bell sits ~52 px
  // in from the right (Score Hub button 36 px + bell marginRight 8 px
  // + a few px of breathing room). The arrow is offset so it points up
  // at the bell, not the Score Hub button next to it.
  notifCoachTooltip: {
    position: "absolute",
    top: 44,
    right: 18,
    maxWidth: 240,
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  notifCoachArrow: {
    position: "absolute",
    top: -4,
    right: 30,
    width: 8,
    height: 8,
    backgroundColor: colors.primaryNavy,
    transform: [{ rotate: "45deg" }],
  },
  notifCoachText: {
    fontSize: 12,
    color: colors.textWhite,
    lineHeight: 16,
    fontWeight: "500",
  },
  // ----- Open profile Bucket C — first-launch coach mark tooltip -----
  // Mirror of scoreHubCoachTooltip but anchored to the LEFT edge of the
  // topBar instead of the right. Same visual treatment so the two
  // tooltips read as one design language.
  profileCoachTooltip: {
    position: "absolute",
    top: 44,
    left: 0,
    maxWidth: 240,
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  profileCoachArrow: {
    position: "absolute",
    top: -4,
    left: 14,
    width: 8,
    height: 8,
    backgroundColor: colors.primaryNavy,
    transform: [{ rotate: "45deg" }],
  },
  profileCoachText: {
    fontSize: 12,
    color: colors.textWhite,
    lineHeight: 16,
    fontWeight: "500",
  },
  // ----- Bucket C — first-launch coach mark tooltip -----
  // Absolute positioning relative to the topBar parent. Anchored to
  // the right edge of the bar so it tracks the Score Hub icon, which
  // is the rightmost item. The triangle (scoreHubCoachArrow) is a
  // rotated 8px square punching out of the top edge so the card
  // visually points at the icon. Higher z-index than the rest of the
  // top-bar contents so it never gets clipped by an adjacent button.
  scoreHubCoachTooltip: {
    position: "absolute",
    top: 44,
    right: 0,
    maxWidth: 240,
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  scoreHubCoachArrow: {
    position: "absolute",
    top: -4,
    right: 14,
    width: 8,
    height: 8,
    backgroundColor: colors.primaryNavy,
    transform: [{ rotate: "45deg" }],
  },
  scoreHubCoachText: {
    fontSize: 12,
    color: colors.textWhite,
    lineHeight: 16,
    fontWeight: "500",
  },

  // ----- Balance card -----
  balanceCardWrap: {
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 16,
  },
  balanceCard: { borderRadius: 16, padding: 20 },
  balanceLabel: {
    color: colors.textOnNavy,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  balanceAmount: {
    color: colors.textWhite,
    fontSize: 36,
    fontWeight: "700",
    marginBottom: 10,
  },

  // ----- Tier badge inside balance card -----
  tierBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tierEmoji: { fontSize: 12 },
  tierLabel: {
    color: colors.textWhite,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  tierBenefitsLink: {
    color: colors.textOnNavy,
    fontSize: 12,
    textDecorationLine: "underline",
  },
  // Bucket A — skeleton pill shown while useMemberTier resolves. Muted
  // background, neutral text. Non-interactive (not wrapped in a touchable).
  tierBadgeSkeleton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
  },
  tierSkeletonLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginVertical: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  breakdownRowTappable: {
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
  },
  breakdownRowPressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  breakdownLabel: { color: colors.textOnNavy, fontSize: 14 },
  breakdownRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  breakdownValue: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: "600",
  },
  tapHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 12,
  },
  tapHint: {
    color: colors.textOnNavy,
    fontSize: 12,
    fontStyle: "italic",
  },
  whyBalanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  whyBalanceText: {
    color: colors.textOnNavy,
    fontSize: 12,
    textDecorationLine: "underline",
  },

  // ----- Section card (Goals / Activity / Circles / Future) -----
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },

  // ----- Goals -----
  goalPrimaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  // Rendered in place of the progress bar / amount line when the user
  // has no active goals yet (or while the initial fetch is in flight).
  goalEmptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginVertical: 12,
  },
  goalName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
    marginBottom: 10,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accentTeal,
    borderRadius: 4,
  },
  goalAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 8,
    marginBottom: 12,
  },
  goalAmountText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  goalAmountSep: {
    color: colors.textSecondary,
    fontWeight: "400",
  },
  goalAmountPct: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accentTeal,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 12,
  },
  // Same shape as goalsButtonRow but with only one CTA — no flex on
  // the button itself because we don't need to share the row with a
  // second action.
  advancesButtonRow: {
    marginTop: 12,
  },
  primaryBtnText: {
    color: colors.textWhite,
    fontWeight: "600",
    fontSize: 14,
  },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.cardBg,
    borderColor: colors.primaryNavy,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  outlineBtnText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 14,
  },
  goalsButtonRow: {
    flexDirection: "row",
    gap: 8,
  },
  goalsButtonFlex: {
    flex: 1,
  },

  // ----- Activity -----
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityRowLast: { borderBottomWidth: 0 },
  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityDesc: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  activityDate: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: "700",
  },

  // ----- Circles -----
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  circleRowLast: { borderBottomWidth: 0 },
  circleName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  circleMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  circlePosition: {
    color: colors.accentTeal,
    fontWeight: "700",
  },

  // ----- Future Snapshot -----
  subSectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  futureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 10,
  },
  futureDate: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
    width: 50,
  },
  futureName: { flex: 1, fontSize: 13, color: colors.textPrimary },
  futureAmount: { fontSize: 13, fontWeight: "700" },

  creditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
  },
  creditLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  creditLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  creditScore: {
    fontSize: 15,
    color: colors.primaryNavy,
    fontWeight: "700",
    marginLeft: 4,
  },
  creditRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  creditLink: {
    fontSize: 12,
    color: colors.accentTeal,
    fontWeight: "600",
  },
  advanceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  advanceBtnDisabled: {
    backgroundColor: colors.screenBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  advanceBtnText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },
  advanceBtnTextDisabled: { color: colors.textSecondary },
  advanceHint: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    fontStyle: "italic",
  },

  // ----- Bottom sheet -----
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  sheetList: { marginBottom: 14 },
  sheetEmpty: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingVertical: 18,
    textAlign: "center",
  },
  circlesEmpty: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
  },
  circlesEmptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  circlesEmptyBody: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetCircleName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sheetCircleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sheetCircleNet: { fontSize: 15, fontWeight: "700" },
  sheetTotalsCard: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  sheetTotalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  sheetTotalsRowBold: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
    paddingTop: 8,
  },
  sheetTotalsLabel: { fontSize: 13, color: colors.textSecondary },
  sheetTotalsValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  sheetTotalsLabelBold: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  sheetTotalsValueBold: { fontSize: 15, fontWeight: "700" },
  sheetCloseBtn: {
    backgroundColor: colors.primaryNavy,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  sheetCloseBtnText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: "600",
  },

  // ----- AI explainer sheet -----
  aiSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  aiBodyCard: {
    backgroundColor: colors.tealTintBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  aiBodyText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  // Bucket A — per-component dynamic body styles
  aiBodyLineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  aiBodySummary: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 18,
  },

  // ----- Tier benefits modal -----
  tierBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  tierModal: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: "hidden",
  },
  tierModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  tierModalEmoji: { fontSize: 24 },
  tierModalLabel: { fontSize: 18, fontWeight: "700" },
  tierModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  tierModalBody: {
    fontSize: 14,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 6,
    lineHeight: 20,
  },
  tierModalBodyMuted: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    lineHeight: 18,
  },
  tierModalClose: {
    backgroundColor: colors.primaryNavy,
    paddingVertical: 14,
    alignItems: "center",
  },
  tierModalCloseText: {
    color: colors.textWhite,
    fontSize: 15,
    fontWeight: "600",
  },
});
