// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalDetailV2Screen.tsx — GOALS-006 (v2: Savings Type)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 157-GOALS-006-GoalDetail-v2.jsx.
//
// Detail view for a savings goal. Surfaces the savings type (flexible /
// emergency / locked), interest earned, lock status, milestones, a linked
// circle, and recent activity, with Add Money / Withdraw actions.
//
// NAMING — this is a *new* v2 redesign that coexists with the existing
// production GoalDetailsScreen (route `GoalDetails`, backed by
// SavingsContext). To avoid a singular/plural near-collision, this file +
// its future route both carry the explicit `V2` suffix → route name
// `GoalDetailV2` (added during the registration phase, mirroring the
// Advance Option B precedent). The existing GoalDetails screen is untouched.
//
// NAVIGATION — `onBack` → goBack(). Every action is wired: Add Money →
// GoalAddMoney, Withdraw → GoalWithdraw, Link Circle → GoalLinkCircle,
// Edit → GoalEdit, Milestones → GoalMilestones, See All → GoalActivity
// (each forwards { goalId, goal }; See All also forwards recentActivity).
//
// DATA — when route.params.goalId is set, the goal + transactions are
// fetched via useGoalActions.fetchGoal() and refetched on useFocusEffect
// (so returning from add-money / withdraw / edit / link-circle picks up the
// new state). If only a `goal` object is passed (legacy debug nav from
// GoalsHubV2's mock cards), it's used as-is. While loading we show a
// spinner; on fetch failure or with neither input we show a "Goal not
// found" empty state with a Back action.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useGoalActions } from "../hooks/useGoalActions";
import type {
  Goal as RealGoal,
  GoalMilestone as RealMilestone,
  GoalTransaction as RealTxn,
} from "../types/goals";
import AsyncStorage from "@react-native-async-storage/async-storage";

// AsyncStorage key for "user has seen the GoalAchieved celebration for this
// goal once". When set, the celebration banner stops auto-rendering on
// every focus. The user can still navigate to GoalMilestones manually.
const ACHIEVED_SEEN_KEY = (goalId: string) => `goal_achieved_seen_${goalId}`;

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const RED = "#DC2626";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type SavingsTypeId = "flexible" | "emergency" | "locked";

type TypeInfo = {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  tagline: string;
  apy: number;
};

const SAVINGS_TYPE_INFO: Record<SavingsTypeId, TypeInfo> = {
  flexible: {
    label: "Flexible",
    icon: "🔓",
    color: "#6B7280",
    bgColor: "#F5F7FA",
    tagline: "Withdraw anytime, no penalty",
    apy: 0,
  },
  emergency: {
    label: "Emergency Fund",
    icon: "🛡️",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    tagline: "Protected savings, 10% penalty for non-emergencies",
    apy: 2,
  },
  locked: {
    label: "Locked Savings",
    icon: "🔒",
    color: "#059669",
    bgColor: "#D1FAE5",
    tagline: "No access until maturity, 10% early penalty",
    apy: 4,
  },
};

type LinkedCircle = {
  id: string;
  name: string;
  nextPayout: string;
  payoutAmount: number;
  payoutAction: string;
};

type Goal = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  balance: number;
  target: number;
  interestEarned: number;
  dailyInterest: number;
  progressPercent: number;
  isOnTrack: boolean;
  startDate: string;
  targetDate: string;
  monthlyContribution: number;
  autoDepositEnabled: boolean;
  autoDepositDay: number;
  savingsType: SavingsTypeId;
  apy: number;
  lockEndDate: string | null;
  lockPeriodMonths: number | null;
  linkedCircle: LinkedCircle | null;
  daysActive: number;
};

type Milestone = {
  percent: number;
  achieved: boolean;
  achievedDate?: string;
};

type Activity = {
  type: "interest" | "deposit" | "circle_payout";
  desc: string;
  amount: number;
  date: string;
  isCredit: boolean;
};

type GoalDetailV2Params = {
  goal?: Goal;
  milestones?: Milestone[];
  recentActivity?: Activity[];
};
type GoalDetailV2RouteProp = RouteProp<
  { GoalDetailV2: GoalDetailV2Params },
  "GoalDetailV2"
>;

const DEFAULT_GOAL: Goal = {
  id: "g1",
  name: "Emergency Fund",
  emoji: "🛡️",
  category: "Financial Freedom",
  balance: 8500.0,
  target: 25000.0,
  interestEarned: 52.4,
  dailyInterest: 0.47,
  progressPercent: 34,
  isOnTrack: true,
  startDate: "Jan 15, 2025",
  targetDate: "Dec 2027",
  monthlyContribution: 500,
  autoDepositEnabled: true,
  autoDepositDay: 1,
  savingsType: "emergency",
  apy: 2,
  lockEndDate: null,
  lockPeriodMonths: null,
  linkedCircle: {
    id: "c1",
    name: "Home Buyers Circle",
    nextPayout: "Feb 15, 2026",
    payoutAmount: 2000,
    payoutAction: "deposit_all",
  },
  daysActive: 45,
};

const DEFAULT_MILESTONES: Milestone[] = [
  { percent: 10, achieved: true, achievedDate: "Jan 28, 2025" },
  { percent: 25, achieved: true, achievedDate: "Feb 10, 2026" },
  { percent: 50, achieved: false },
  { percent: 75, achieved: false },
  { percent: 100, achieved: false },
];

const DEFAULT_ACTIVITY: Activity[] = [
  { type: "interest", desc: "Daily interest", amount: 0.47, date: "Today", isCredit: true },
  { type: "deposit", desc: "Auto-deposit", amount: 500, date: "Feb 1", isCredit: true },
  { type: "interest", desc: "Daily interest", amount: 0.46, date: "Jan 31", isCredit: true },
  {
    type: "circle_payout",
    desc: "From Home Buyers Circle",
    amount: 2000,
    date: "Jan 15",
    isCredit: true,
  },
  { type: "deposit", desc: "Manual deposit", amount: 1000, date: "Jan 10", isCredit: true },
];

// ── viewModel mappers ─────────────────────────────────────────────────────
// The DB-backed Goal (from useGoalActions.fetchGoal) is leaner than what
// this screen's render expects (mock-derived shape). These mappers compute
// the missing fields client-side (progressPercent, daysActive, apy from the
// savings tier) and fill the rest with safe defaults, so the render below
// stays unchanged for both real and legacy passed-goal data.
// linkedCircle: the DB only stores the FK id; the rich payout details
// (name / nextPayout / payoutAmount) need a separate circle fetch we haven't
// wired yet, so we render a minimal placeholder card when a goal is linked.

function defaultDescForType(t: RealTxn["type"]): string {
  switch (t) {
    case "deposit":
      return "Deposit";
    case "withdrawal":
      return "Withdrawal";
    case "interest_credit":
      return "Interest";
    case "circle_payout":
      return "Circle payout";
    case "penalty":
      return "Penalty";
    case "transfer_in":
      return "Transfer in";
    case "transfer_out":
      return "Transfer out";
    default:
      return "Activity";
  }
}

function mapRealGoalToRender(real: RealGoal): Goal {
  const target = real.targetAmount || 0;
  const balance = real.currentBalance || 0;
  const progressPercent =
    target > 0 ? Math.min(100, Math.round((balance / target) * 1000) / 10) : 0;
  const apy =
    real.savingsType === "locked"
      ? 4
      : real.savingsType === "emergency"
      ? 2
      : 0;
  const daysActive = real.createdAt
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(real.createdAt).getTime()) / 86_400_000
        )
      )
    : 0;
  return {
    id: real.id,
    name: real.name,
    emoji: real.emoji ?? "🎯",
    category: real.category ?? "",
    balance,
    target,
    interestEarned: real.interestEarned ?? 0,
    dailyInterest: 0, // not tracked on the row yet
    progressPercent,
    isOnTrack: real.status === "active",
    startDate: real.createdAt,
    targetDate: real.targetDate ?? "",
    monthlyContribution: real.monthlyContribution ?? 0,
    autoDepositEnabled: real.autoDepositEnabled,
    autoDepositDay: real.autoDepositDay ?? 1,
    savingsType: (real.savingsType ?? "flexible") as SavingsTypeId,
    apy,
    lockEndDate: real.lockEndDate ?? null,
    lockPeriodMonths: real.lockPeriodMonths ?? null,
    linkedCircle: real.linkedCircleId
      ? {
          id: real.linkedCircleId,
          name: "Linked Circle",
          nextPayout: "—",
          payoutAmount: 0,
          payoutAction: real.circlePayoutAction ?? "deposit_all",
        }
      : null,
    daysActive,
  };
}

function mapRealTxnsToActivities(txns: RealTxn[]): Activity[] {
  return txns.map((t) => {
    const isCredit =
      t.type === "deposit" ||
      t.type === "interest_credit" ||
      t.type === "circle_payout" ||
      t.type === "transfer_in";
    const renderType: Activity["type"] =
      t.type === "interest_credit"
        ? "interest"
        : t.type === "circle_payout"
        ? "circle_payout"
        : "deposit";
    const date = t.createdAt
      ? new Date(t.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "";
    return {
      type: renderType,
      desc: t.description ?? defaultDescForType(t.type),
      amount: t.amount,
      date,
      isCredit,
    };
  });
}

export default function GoalDetailV2Screen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalDetailV2RouteProp>();

  const goalId = (route.params as { goalId?: string } | undefined)?.goalId;
  const passedGoal = (route.params?.goal as Goal | undefined) ?? null;

  // Real backend: fetch the goal + its transactions when a goalId is given.
  // If a fully-formed render-shaped goal was passed instead (legacy debug
  // nav from GoalsHubV2's mock cards), use it as-is.
  const { fetchGoal } = useGoalActions();
  const [goal, setGoal] = useState<Goal | null>(passedGoal);
  const [transactions, setTransactions] = useState<RealTxn[] | null>(null);
  const [milestones, setMilestones] = useState<RealMilestone[]>([]);
  // Raw status from the DB row — kept separate from the viewModel `goal`
  // because the viewModel mapping drops the status field. Used to gate
  // the celebration banner below.
  const [realStatus, setRealStatus] = useState<string | null>(null);
  const [hasSeenCelebration, setHasSeenCelebration] = useState<boolean>(false);
  // Per-session dismissal — separate from the persisted "seen" flag so
  // tapping Dismiss hides the banner for THIS session only. After a fresh
  // launch, if the user still hasn't seen the celebration, the banner
  // returns (and Dismiss isn't a permanent silence).
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!!goalId);

  const loadGoal = useCallback(async () => {
    if (!goalId) return;
    setLoading(true);
    const { data, error } = await fetchGoal(goalId);
    if (error || !data) {
      Alert.alert(
        "Couldn't load goal",
        (error as { message?: string } | null)?.message ??
          "This goal couldn't be loaded."
      );
      setLoading(false);
      return;
    }
    setGoal(mapRealGoalToRender(data.goal));
    setTransactions(data.transactions);
    setMilestones(data.milestones);
    setRealStatus(data.goal.status);

    // Look up persisted "seen" flag. Errors are non-fatal (treated as
    // not-seen) — worst case the user sees the banner an extra time.
    try {
      const seen = await AsyncStorage.getItem(ACHIEVED_SEEN_KEY(goalId));
      setHasSeenCelebration(seen === "true");
    } catch {
      setHasSeenCelebration(false);
    }
    setLoading(false);
  }, [goalId, fetchGoal]);

  // Refetch whenever the screen comes back into focus — covers returning
  // from add-money / withdraw / edit / link-circle.
  useFocusEffect(
    useCallback(() => {
      if (goalId) loadGoal();
    }, [goalId, loadGoal])
  );

  // Milestones aren't tracked in the DB; derive `achieved` from current
  // progress. Falls back to passed/mocks for the legacy debug path.
  const milestones = useMemo<Milestone[]>(() => {
    if (!goal) {
      return (
        (route.params?.milestones as Milestone[] | undefined) ?? DEFAULT_MILESTONES
      );
    }
    return DEFAULT_MILESTONES.map((m) => ({
      ...m,
      achieved: goal.progressPercent >= m.percent,
    }));
  }, [goal, route.params?.milestones]);

  // Recent activity: prefer fetched transactions; fall back to passed params
  // / mock for the legacy debug path.
  const recentActivity = useMemo<Activity[]>(() => {
    if (transactions) return mapRealTxnsToActivities(transactions);
    return (
      (route.params?.recentActivity as Activity[] | undefined) ?? DEFAULT_ACTIVITY
    );
  }, [transactions, route.params?.recentActivity]);

  if (loading && !goal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (!goal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centerFill}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyTitle}>Goal not found</Text>
          <Text style={styles.emptyBody}>
            We couldn't load this goal. Try again from the goals list.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const typeInfo = SAVINGS_TYPE_INFO[goal.savingsType] || SAVINGS_TYPE_INFO.flexible;
  const remainingAmount = goal.target - goal.balance;
  const totalWithInterest = goal.balance + goal.interestEarned;

  // Lock status (locked type only)
  const getLockStatus = () => {
    if (goal.savingsType !== "locked" || !goal.lockEndDate) return null;
    const lockEnd = new Date(goal.lockEndDate);
    const now = new Date();
    const diffTime = lockEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      daysRemaining: Math.max(0, diffDays),
      isEnded: diffDays <= 0,
      endDate: lockEnd.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    };
  };
  const lockStatus = getLockStatus();

  const handleEditGoal = () =>
    navigation.navigate(Routes.GoalEdit, { goalId: goal.id, goal });
  const handleAddMoney = () =>
    navigation.navigate(Routes.GoalAddMoney, { goalId: goal.id, goal });
  const handleWithdraw = () =>
    navigation.navigate(Routes.GoalWithdraw, { goalId: goal.id, goal });
  const handleLinkCircle = () =>
    navigation.navigate(Routes.GoalLinkCircle, { goalId: goal.id, goal });
  // Forward real milestones via route params so GoalMilestonesScreen can
  // skip its own DB round-trip on first paint. Empty array is fine — the
  // milestones screen treats it as "nothing achieved yet".
  const handleViewMilestones = () =>
    navigation.navigate(Routes.GoalMilestones, {
      goalId: goal.id,
      goal,
      milestones,
    });

  // Celebration banner gates and handler. Visible when the goal is
  // completed AND the user hasn't permanently dismissed via "View
  // celebration" AND hasn't tapped Dismiss this session.
  const showCelebrationBanner =
    realStatus === "completed" && !hasSeenCelebration && !bannerDismissed;

  const handleViewCelebration = async () => {
    try {
      await AsyncStorage.setItem(ACHIEVED_SEEN_KEY(goal.id), "true");
    } catch {
      // Storage failure is non-fatal — worst case the banner returns on
      // next mount. Still navigate so the user sees the celebration.
    }
    setHasSeenCelebration(true);
    navigation.navigate(Routes.GoalAchieved as any, {
      goalId: goal.id,
      goal,
    });
  };
  const handleDismissCelebrationBanner = () => setBannerDismissed(true);

  const activityIcon = (type: Activity["type"]) =>
    type === "interest" ? "📈" : type === "circle_payout" ? "🔄" : "💰";
  const activityIconBg = (type: Activity["type"]) =>
    type === "interest" ? "#F0FDFB" : type === "circle_payout" ? "#EFF6FF" : "#FEF3C7";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Top bar */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.headerTitleRow}>
              <Text style={styles.headerEmoji}>{goal.emoji}</Text>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {goal.name}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleEditGoal}
              accessibilityRole="button"
              accessibilityLabel="Goal options"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Savings type badge */}
          <View style={styles.badgeWrap}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeIcon}>{typeInfo.icon}</Text>
              <Text style={styles.typeBadgeLabel}>{typeInfo.label}</Text>
              <Text style={styles.typeBadgeDot}>•</Text>
              <Text
                style={[
                  styles.typeBadgeApy,
                  { color: goal.apy > 0 ? TEAL : "rgba(255,255,255,0.7)" },
                ]}
              >
                {goal.apy}% APY
              </Text>
            </View>
          </View>

          {/* Balance display */}
          <View style={{ alignItems: "center" }}>
            <Text style={styles.balanceLabel}>TOTAL VALUE</Text>
            <Text style={styles.balanceValue}>
              $
              {totalWithInterest.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>

            {/* Breakdown */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Saved</Text>
                <Text style={styles.breakdownValue}>
                  ${goal.balance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Interest</Text>
                <Text
                  style={[
                    styles.breakdownValue,
                    { color: goal.apy > 0 ? TEAL : "rgba(255,255,255,0.5)" },
                  ]}
                >
                  {goal.apy > 0 ? `+$${goal.interestEarned.toFixed(2)}` : "$0.00"}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Target</Text>
                <Text style={styles.breakdownValue}>
                  ${goal.target.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={[TEAL, "#00E5CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.progressFill,
                    { width: `${goal.progressPercent}%` },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>
                  {goal.progressPercent}% complete
                </Text>
                <Text style={styles.progressLabel}>
                  ${remainingAmount.toLocaleString()} to go
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Celebration banner — visible only when the goal is completed
              and the user hasn't permanently dismissed via View Celebration
              (AsyncStorage flag) or temporarily via Dismiss (per-session). */}
          {showCelebrationBanner && (
            <View style={styles.celebrationBanner}>
              <TouchableOpacity
                style={styles.celebrationBannerLeft}
                onPress={handleViewCelebration}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="View goal achievement celebration"
              >
                <Text style={styles.celebrationBannerText}>
                  🎉 Goal achieved! View celebration {"→"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.celebrationBannerDismiss}
                onPress={handleDismissCelebrationBanner}
                accessibilityRole="button"
                accessibilityLabel="Dismiss celebration banner"
              >
                <Text style={styles.celebrationBannerDismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Savings type card */}
          <View
            style={[
              styles.typeCard,
              { backgroundColor: typeInfo.bgColor, borderColor: `${typeInfo.color}30` },
            ]}
          >
            <View style={styles.typeCardTop}>
              <View style={styles.typeCardLeft}>
                <View style={styles.typeCardIconBox}>
                  <Text style={styles.typeCardIcon}>{typeInfo.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeCardLabel}>{typeInfo.label}</Text>
                  <Text style={styles.typeCardTagline}>{typeInfo.tagline}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={[
                    styles.typeCardApy,
                    { color: goal.apy > 0 ? GREEN : "#9CA3AF" },
                  ]}
                >
                  {goal.apy}%
                </Text>
                <Text style={styles.typeCardApyLabel}>APY</Text>
              </View>
            </View>

            {/* Lock status (locked type) */}
            {goal.savingsType === "locked" && lockStatus && (
              <View style={styles.lockStatusRow}>
                {lockStatus.isEnded ? (
                  <View style={styles.lockEndedRow}>
                    <Text style={styles.lockEndedEmoji}>🎉</Text>
                    <Text style={styles.lockEndedText}>
                      Lock ended — withdraw freely!
                    </Text>
                  </View>
                ) : (
                  <>
                    <View>
                      <Text style={styles.lockMutedLabel}>Unlocks</Text>
                      <Text style={styles.lockEndDate}>{lockStatus.endDate}</Text>
                    </View>
                    <View style={styles.lockDaysBox}>
                      <Text style={[styles.lockDaysValue, { color: typeInfo.color }]}>
                        {lockStatus.daysRemaining}
                      </Text>
                      <Text style={styles.lockDaysLabel}>days left</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Interest card (types with interest) */}
          {goal.apy > 0 && (
            <LinearGradient
              colors={["#059669", "#047857"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.interestCard}
            >
              <View style={styles.interestDecor} />
              <View style={styles.interestInner}>
                <View style={{ flex: 1 }}>
                  <View style={styles.interestTitleRow}>
                    <Text style={styles.interestTitleEmoji}>📈</Text>
                    <Text style={styles.interestTitle}>INTEREST EARNED</Text>
                  </View>
                  <Text style={styles.interestValue}>
                    ${goal.interestEarned.toFixed(2)}
                  </Text>
                  <Text style={styles.interestSub}>
                    +${goal.dailyInterest.toFixed(2)}/day • {goal.apy}% APY
                  </Text>
                </View>
                <View style={styles.interestActiveBox}>
                  <Text style={styles.interestActiveLabel}>Active</Text>
                  <Text style={styles.interestActiveValue}>
                    {goal.daysActive} days
                  </Text>
                </View>
              </View>
            </LinearGradient>
          )}

          {/* No-interest notice (flexible) */}
          {goal.apy === 0 && (
            <View style={styles.noInterestCard}>
              <Text style={styles.noInterestEmoji}>💡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.noInterestTitle}>
                  Flexible savings don't earn interest
                </Text>
                <Text style={styles.noInterestBody}>
                  Upgrade to Emergency (2% APY) or Locked (4% APY) to earn
                  interest
                </Text>
              </View>
            </View>
          )}

          {/* Milestones */}
          <TouchableOpacity
            onPress={handleViewMilestones}
            activeOpacity={0.8}
            accessibilityRole="button"
            style={styles.card}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>🎯 Milestones</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>

            <View style={styles.milestoneRow}>
              {milestones.map((m, idx) => (
                <View key={idx} style={styles.milestoneItem}>
                  <View
                    style={[
                      styles.milestoneDot,
                      { backgroundColor: m.achieved ? TEAL : BORDER },
                    ]}
                  >
                    <Text
                      style={[
                        styles.milestoneDotText,
                        { color: m.achieved ? "#FFFFFF" : "#9CA3AF" },
                      ]}
                    >
                      {m.achieved ? "✓" : `${m.percent}%`}
                    </Text>
                  </View>
                  {idx < milestones.length - 1 && (
                    <View
                      style={[
                        styles.milestoneConnector,
                        {
                          backgroundColor:
                            m.achieved && milestones[idx + 1]?.achieved
                              ? TEAL
                              : BORDER,
                        },
                      ]}
                    />
                  )}
                </View>
              ))}
            </View>

            <Text style={styles.milestoneSummary}>
              {milestones.filter((m) => m.achieved).length} of {milestones.length}{" "}
              milestones reached
            </Text>
          </TouchableOpacity>

          {/* Linked circle */}
          {goal.linkedCircle ? (
            <View style={styles.card}>
              <View style={styles.linkedHeaderRow}>
                <View style={styles.linkedHeaderLeft}>
                  <View style={styles.linkedIconBox}>
                    <Text style={styles.linkedIconEmoji}>🔗</Text>
                  </View>
                  <View>
                    <Text style={styles.linkedKicker}>LINKED CIRCLE</Text>
                    <Text style={styles.linkedName}>{goal.linkedCircle.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleLinkCircle}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkAction}>Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.payoutBox}>
                <View>
                  <Text style={styles.payoutLabel}>Next payout</Text>
                  <Text style={styles.payoutValue}>
                    ${goal.linkedCircle.payoutAmount.toLocaleString()} on{" "}
                    {goal.linkedCircle.nextPayout}
                  </Text>
                </View>
                <View style={styles.autoTransferTag}>
                  <Text style={styles.autoTransferText}>Auto-transfer ON</Text>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleLinkCircle}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={styles.linkCircleButton}
            >
              <Text style={styles.linkCircleEmoji}>🔗</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkCircleTitle}>Link a Circle</Text>
                <Text style={styles.linkCircleBody}>
                  Auto-transfer Circle payouts to this goal
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Recent activity */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>Recent Activity</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(Routes.GoalActivity, {
                    goal,
                    recentActivity,
                  })
                }
                accessibilityRole="button"
              >
                <Text style={styles.linkAction}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {recentActivity.slice(0, 4).map((item, idx) => (
                <View key={idx} style={styles.activityRow}>
                  <View style={styles.activityLeft}>
                    <View
                      style={[
                        styles.activityIconBox,
                        { backgroundColor: activityIconBg(item.type) },
                      ]}
                    >
                      <Text style={styles.activityIcon}>
                        {activityIcon(item.type)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.activityDesc}>{item.desc}</Text>
                      <Text style={styles.activityDate}>{item.date}</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.activityAmount,
                      { color: item.isCredit ? GREEN : RED },
                    ]}
                  >
                    {item.isCredit ? "+" : "-"}$
                    {item.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ===== BOTTOM ACTIONS ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={handleAddMoney}
          accessibilityRole="button"
          style={styles.addMoneyButton}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addMoneyText}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleWithdraw}
          accessibilityRole="button"
          style={styles.withdrawButton}
        >
          <Text style={styles.withdrawText}>Withdraw</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },

  // Loading / empty states (shown before the real goal renders below)
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: TEAL,
  },
  emptyButtonText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 80, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  headerEmoji: { fontSize: 24 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  badgeWrap: { alignItems: "center", marginBottom: 16 },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
  },
  typeBadgeIcon: { fontSize: 14 },
  typeBadgeLabel: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  typeBadgeDot: { fontSize: 12, color: "rgba(255,255,255,0.8)" },
  typeBadgeApy: { fontSize: 12, fontWeight: "700" },

  balanceLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 42,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -1,
  },
  breakdownRow: { flexDirection: "row", gap: 20, marginTop: 12 },
  breakdownItem: { alignItems: "center" },
  breakdownDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  breakdownLabel: { fontSize: 10, color: "rgba(255,255,255,0.6)" },
  breakdownValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 2,
  },

  progressWrap: { width: "100%", maxWidth: 300, marginTop: 20 },
  progressTrack: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: { height: 10, borderRadius: 5 },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressLabel: { fontSize: 12, color: "rgba(255,255,255,0.8)" },

  contentWrap: { marginTop: -50, paddingHorizontal: 16 },

  // Celebration banner — yellow-tinted with a teal CTA. Sits at the top of
  // contentWrap so it visually overlaps the hero gradient's bottom edge,
  // making it the first thing the user sees on a completed goal.
  celebrationBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  celebrationBannerLeft: {
    flex: 1,
    paddingRight: 8,
  },
  celebrationBannerText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400E",
  },
  celebrationBannerDismiss: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
  },
  celebrationBannerDismissText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },

  // Savings type card
  typeCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
  },
  typeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  typeCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  typeCardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  typeCardIcon: { fontSize: 22 },
  typeCardLabel: { fontSize: 14, fontWeight: "600", color: NAVY },
  typeCardTagline: { fontSize: 11, color: MUTED, marginTop: 2 },
  typeCardApy: { fontSize: 20, fontWeight: "700" },
  typeCardApyLabel: { fontSize: 10, color: MUTED, marginTop: 2 },

  lockStatusRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lockEndedRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  lockEndedEmoji: { fontSize: 16 },
  lockEndedText: { fontSize: 13, fontWeight: "600", color: GREEN },
  lockMutedLabel: { fontSize: 11, color: MUTED },
  lockEndDate: { fontSize: 13, fontWeight: "600", color: NAVY, marginTop: 2 },
  lockDaysBox: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    alignItems: "center",
  },
  lockDaysValue: { fontSize: 18, fontWeight: "700" },
  lockDaysLabel: { fontSize: 9, color: MUTED, marginTop: 2 },

  // Interest card
  interestCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    overflow: "hidden",
  },
  interestDecor: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  interestInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  interestTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  interestTitleEmoji: { fontSize: 14 },
  interestTitle: { fontSize: 11, color: "rgba(255,255,255,0.9)" },
  interestValue: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  interestSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  interestActiveBox: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    alignItems: "center",
  },
  interestActiveLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)" },
  interestActiveValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 2,
  },

  // No-interest notice
  noInterestCard: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  noInterestEmoji: { fontSize: 20 },
  noInterestTitle: { fontSize: 13, fontWeight: "500", color: MUTED },
  noInterestBody: { fontSize: 11, color: "#9CA3AF", marginTop: 4 },

  // Card header
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeading: { fontSize: 14, fontWeight: "600", color: NAVY },
  linkAction: { fontSize: 12, fontWeight: "600", color: TEAL },

  // Milestones
  milestoneRow: { flexDirection: "row", alignItems: "center" },
  milestoneItem: { flex: 1, flexDirection: "row", alignItems: "center" },
  milestoneDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneDotText: { fontSize: 11, fontWeight: "600" },
  milestoneConnector: { flex: 1, height: 3, marginLeft: 4 },
  milestoneSummary: { marginTop: 10, fontSize: 12, color: MUTED },

  // Linked circle
  linkedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  linkedHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  linkedIconEmoji: { fontSize: 18 },
  linkedKicker: { fontSize: 11, color: MUTED },
  linkedName: { fontSize: 14, fontWeight: "600", color: NAVY, marginTop: 2 },
  payoutBox: {
    padding: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  payoutLabel: { fontSize: 11, color: MUTED },
  payoutValue: { fontSize: 14, fontWeight: "600", color: GREEN, marginTop: 2 },
  autoTransferTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: GREEN,
  },
  autoTransferText: { fontSize: 10, fontWeight: "600", color: "#FFFFFF" },

  linkCircleButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TEAL,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  linkCircleEmoji: { fontSize: 20 },
  linkCircleTitle: { fontSize: 14, fontWeight: "600", color: TEAL },
  linkCircleBody: { fontSize: 11, color: MUTED, marginTop: 2 },

  // Activity
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 10,
  },
  activityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  activityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIcon: { fontSize: 16 },
  activityDesc: { fontSize: 13, fontWeight: "500", color: NAVY },
  activityDate: { fontSize: 11, color: MUTED, marginTop: 2 },
  activityAmount: { fontSize: 14, fontWeight: "600" },

  // Bottom actions
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: "row",
    gap: 12,
  },
  addMoneyButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addMoneyText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  withdrawButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  withdrawText: { fontSize: 15, fontWeight: "600", color: NAVY },
});
