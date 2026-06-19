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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Animated,
  Easing,
  Modal,
  Pressable,
  Switch,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useGoalActions } from "../hooks/useGoalActions";
import { useWallet } from "../context/WalletContext";
import GoalAddMoneySheet from "../components/GoalAddMoneySheet";
import GoalWithdrawSheet from "../components/GoalWithdrawSheet";
import { showToast } from "../components/Toast";
import { supabase } from "../lib/supabase";

// P1 (Bucket B.6): once-per-session compound RPC cache. The plpgsql
// short-circuits cheaply with reason='no_days_elapsed' when called
// twice in the same calendar day, but the round-trip still costs a
// network hop per focus event. Coarse module-scope Set survives
// component remounts and tab switches but resets on app restart —
// which is the right cadence for daily interest accrual.
const compoundedGoalIdsThisSession = new Set<string>();

// P2 (Bucket C.3): per-goal "you're ahead" dismiss flag. Stored as the
// ISO timestamp of the dismissal; banner stays hidden for 7 days.
const AHEAD_DISMISSED_KEY = (goalId: string) =>
  `@tandaxn_goal_ahead_dismissed_${goalId}`;
const AHEAD_DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const AHEAD_THRESHOLD = 1.1;
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
  // Only populated when we have full circle details (name + payout). When
  // the goal has an FK but the circle row hasn't been fetched, `linkedCircle`
  // stays null and the FK is exposed via `linkedCircleId` so the render
  // can hide the card entirely instead of showing "$0 on —".
  linkedCircle: LinkedCircle | null;
  linkedCircleId: string | null;
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

// P1 (Bucket B.7): the screen now relies on goalId only. The prior
// `goal` route param was a stale-data shortcut — passing the whole
// viewModel let the screen render before fetchGoal resolved, but the
// fetched goal always overwrote it and the duplicated payload was
// a footgun for stale reads. We accept it in the type for one cycle
// to keep older deep-link payloads from crashing TS, but the runtime
// ignores it.
type GoalDetailV2Params = {
  goalId?: string;
  /** @deprecated — pass goalId only; this field is ignored. */
  goal?: Goal;
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
  linkedCircleId: "c1",
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
    // P0: do NOT build a placeholder LinkedCircle. The DB row only stores
    // the FK; rendering name="Linked Circle" / nextPayout="—" / payoutAmount=0
    // surfaced "$0 on —" in the UI. Leave `linkedCircle` null until we have
    // a real circle fetch; track the FK separately so the render can hide
    // the card without showing the "Link a Circle" CTA to an already-linked
    // user.
    linkedCircle: null,
    linkedCircleId: real.linkedCircleId ?? null,
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
  const { t } = useTranslation();

  const goalId = (route.params as { goalId?: string } | undefined)?.goalId;

  // P1 (Bucket B.7): drop the `goal` route param. The screen now
  // always fetches by goalId — a brief spinner instead of pre-rendering
  // possibly-stale data is the cleaner tradeoff.
  const { fetchGoal, setRoundUpEnabled, updateGoal, deleteGoal } = useGoalActions();
  // P2 (migration 155) — local state for the round-up toggle on the
  // Round-up Savings jar. Initialised from the DB row inside loadGoal()
  // below; flipping calls the helper and refetches.
  const [roundUpEnabled, setRoundUpEnabledLocal] = useState<boolean>(true);
  const [roundUpSaving, setRoundUpSaving] = useState(false);
  const [isRoundUpJar, setIsRoundUpJar] = useState(false);
  const { balance: walletBalance } = useWallet();
  const [showAddMoneySheet, setShowAddMoneySheet] = useState(false);
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);
  // One-shot celebration when arriving from GoalCreateExpress. Reads the
  // route param on mount and fires a single Alert so the user lands with
  // immediate feedback. The alert is intentionally lightweight — a
  // richer inline confetti banner is a follow-up polish item.
  const justCreated = !!(
    (route.params as { justCreated?: boolean } | undefined)?.justCreated
  );
  useEffect(() => {
    if (justCreated) {
      Alert.alert(
        t("goal_detail.celebration_title"),
        t("goal_detail.celebration_body"),
      );
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [goal, setGoal] = useState<Goal | null>(null);
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
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(!!goalId);

  // P2 (Bucket C.3) — ahead-of-schedule banner dismiss state.
  const [aheadDismissedAt, setAheadDismissedAt] = useState<number | null>(null);

  // P2 (Bucket C.5) — quick-edit target sheet.
  const [quickEditVisible, setQuickEditVisible] = useState(false);
  const [quickEditAmount, setQuickEditAmount] = useState<number>(0);
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  // P2 (Bucket C.4) — animated progress bar.
  // The Animated.Value lives across the screen's lifetime so successive
  // refetches (deposits, withdrawals) animate from the prior width
  // rather than snapping. Width can't use the native driver, so we keep
  // useNativeDriver=false here.
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Phase 1B — Verified Provider Network integration. Two pieces of
  // state live here: the provider_category the goal owner tagged on
  // create (so we know if the goal calls for a provider at all), and
  // the most recently linked provider via goal_provider_links (so we
  // can summarise "Paid to X" or "Active with X" inline).
  const [providerCategory, setProviderCategory] = useState<string | null>(null);
  const [linkedProvider, setLinkedProvider] = useState<{
    link_id: string;
    provider_id: string;
    business_name: string;
    status: string;
    paid_amount_cents: number;
  } | null>(null);
  // Phase 2A — staged-disbursement summary. When disbursement_type='staged'
  // we render a compact "N of M complete" card linking to the milestones
  // screen.
  const [disbursementType, setDisbursementType] = useState<string | null>(null);
  const [milestoneCounts, setMilestoneCounts] = useState<{
    total: number;
    released: number;
  } | null>(null);

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

    // Phase 1B — pull provider_category + the most recently linked
    // provider for this goal. Two-query parallel fan-out so the goal
    // render isn't blocked on either result.
    void (async () => {
      try {
        const [catRes, linkRes, milestoneRes] = await Promise.all([
          supabase
            .from("user_savings_goals")
            .select("provider_category, disbursement_type")
            .eq("id", goalId)
            .maybeSingle(),
          supabase
            .from("goal_provider_links")
            .select("id, provider_id, status, paid_amount_cents, providers!provider_id(business_name)")
            .eq("goal_id", goalId)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("goal_disbursement_milestones")
            .select("id, status")
            .eq("goal_id", goalId),
        ]);
        setProviderCategory((catRes.data as any)?.provider_category ?? null);
        setDisbursementType((catRes.data as any)?.disbursement_type ?? null);
        const link = linkRes.data as any;
        if (link) {
          setLinkedProvider({
            link_id: link.id,
            provider_id: link.provider_id,
            business_name: link.providers?.business_name ?? "—",
            status: link.status,
            paid_amount_cents: link.paid_amount_cents ?? 0,
          });
        } else {
          setLinkedProvider(null);
        }
        const allMs = (milestoneRes.data ?? []) as any[];
        if (allMs.length > 0) {
          setMilestoneCounts({
            total: allMs.length,
            released: allMs.filter((m) => m.status === "released").length,
          });
        } else {
          setMilestoneCounts(null);
        }
      } catch {
        // Non-fatal; the section just won't appear if the lookup fails.
      }
    })();
    // P2 — sync the round-up toggle with the DB row (default true if NULL).
    setRoundUpEnabledLocal(data.goal.roundUpEnabled ?? true);
    setIsRoundUpJar(data.goal.goalType === "round_up");

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
  //
  // Compound interest is invoked BEFORE loadGoal so the fetched balance
  // reflects today's accrual. The RPC short-circuits cheaply with
  // reason='no_days_elapsed' when called twice in the same calendar day,
  // so wiring it to every focus event is safe — one extra round-trip
  // when nothing's changed. The compoundingThisFocus ref guards against
  // React StrictMode's intentional double-invocation of effects in dev
  // (without it we'd issue two compound RPCs per focus in development).
  // P1 (Bucket B.6): compound is gated by the module-scope
  // `compoundedGoalIdsThisSession` Set declared above the component.
  // First focus per session = one RPC; subsequent focuses just
  // refresh the goal row (cheap select, no RPC). This swaps the old
  // "reset-on-blur" ref for a session-stable cache that survives
  // remounts and tab switches.
  useFocusEffect(
    useCallback(() => {
      if (!goalId) return;
      let cancelled = false;
      const compoundThenLoad = async () => {
        if (!compoundedGoalIdsThisSession.has(goalId)) {
          compoundedGoalIdsThisSession.add(goalId);
          try {
            await supabase.rpc("compound_interest_for_goal", {
              p_goal_id: goalId,
            });
          } catch (e) {
            // Non-fatal — screen still renders the (pre-compound)
            // balance. Most likely cause for a real error: migration 081
            // hasn't been applied yet on this environment.
            console.warn("[GoalDetailV2] compound_interest_for_goal failed", e);
            // Bail the session cache so a retry can happen on next
            // focus instead of permanently silencing.
            compoundedGoalIdsThisSession.delete(goalId);
          }
        }
        if (!cancelled) loadGoal();
      };
      compoundThenLoad();
      return () => {
        cancelled = true;
      };
    }, [goalId, loadGoal])
  );

  // Adapter from DB-shape RealMilestone[] (id, goalId, milestonePercent,
  // reachedAt, celebrated) to the chip-row's display shape (percent,
  // achieved, achievedDate). The DB only writes a row when a threshold
  // has been crossed, so any threshold present in `milestones` is
  // achieved; the rest are still locked. The full GoalMilestones screen
  // does its own mapping via buildMilestonesFromReal — we pass `milestones`
  // unchanged via route params on navigation (see handleViewMilestones).
  const displayMilestones = useMemo(() => {
    const thresholds = [10, 25, 50, 75, 90, 100];
    const achievedSet = new Set(milestones.map((m) => m.milestonePercent));
    return thresholds.map((percent) => ({
      percent,
      achieved: achievedSet.has(percent),
      achievedDate: milestones.find((m) => m.milestonePercent === percent)
        ?.reachedAt,
    }));
  }, [milestones]);

  // P0: recent activity comes from the real transactions list only. The
  // prior fallback to `DEFAULT_ACTIVITY` showed fake "Daily interest /
  // Auto-deposit" rows to users who had no real history; the legacy
  // `route.params.recentActivity` debug path is unreachable from the
  // current Hub nav. Empty array → empty-state row below.
  const recentActivity = useMemo<Activity[]>(() => {
    if (transactions) return mapRealTxnsToActivities(transactions);
    return [];
  }, [transactions]);

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
          <Text style={styles.emptyTitle}>{t("goal_detail.not_found_title")}</Text>
          <Text style={styles.emptyBody}>
            We couldn't load this goal. Try again from the goals list.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
          >
            <Text style={styles.emptyButtonText}>{t("goal_detail.back")}</Text>
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

  // P1 (Bucket B.1): the ellipsis now opens a bottom-sheet menu.
  // The four menu actions are wired below as the user's spec
  // requested: Edit / Mark complete / Delete / Share.
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleEditGoal = () => {
    closeMenu();
    // Pass the viewModel goal — GoalEdit reads name / target /
    // monthlyContribution / autoDepositEnabled / emoji / targetDate
    // from it so the form pre-fills without a second fetch.
    navigation.navigate(Routes.GoalEdit, {
      goalId: goal.id,
      goal: {
        id: goal.id,
        name: goal.name,
        emoji: goal.emoji,
        target: goal.target,
        monthlyContribution: goal.monthlyContribution,
        autoDepositEnabled: goal.autoDepositEnabled,
        targetDate: goal.targetDate || null,
      },
    });
  };

  // P1 (Bucket B.3): manual mark-complete. The completion trigger from
  // migration 078 only fires at balance >= target — this lets the user
  // close out a goal early (e.g. they hit "good enough" or the goal
  // was a Round-up jar with no target). Confirm copy depends on
  // whether they're still short of target.
  const handleMarkComplete = () => {
    closeMenu();
    const remaining = Math.max(0, (goal.target ?? 0) - (goal.balance ?? 0));
    const bodyKey =
      remaining > 0
        ? "goal_detail.complete_body_short"
        : "goal_detail.complete_body_ready";
    Alert.alert(
      t("goal_detail.complete_title"),
      t(bodyKey, { amount: remaining.toLocaleString() }),
      [
        { text: t("goal_detail.cancel"), style: "cancel" },
        {
          text: t("goal_detail.menu_complete"),
          style: "default",
          onPress: async () => {
            const { error } = await updateGoal(goal.id, { status: "completed" });
            if (error) {
              Alert.alert(
                t("goal_detail.complete_failed_title"),
                (error as { message?: string })?.message ??
                  t("goal_detail.try_again"),
              );
              return;
            }
            showToast(t("goal_detail.toast_completed"), "success");
            navigation.navigate(Routes.GoalAchieved as any, {
              goalId: goal.id,
              goal,
            });
          },
        },
      ],
    );
  };

  // P1 (Bucket B.2): delete with a single confirm. deleteGoal is a soft
  // delete (goal_status='closed') per useGoalActions — recoverable at
  // the DB layer even though there's no UI for restoring yet.
  const handleDelete = () => {
    closeMenu();
    Alert.alert(
      t("goal_detail.delete_title"),
      t("goal_detail.delete_body"),
      [
        { text: t("goal_detail.cancel"), style: "cancel" },
        {
          text: t("goal_detail.menu_delete"),
          style: "destructive",
          onPress: async () => {
            const { error } = await deleteGoal(goal.id);
            if (error) {
              Alert.alert(
                t("goal_detail.delete_failed_title"),
                (error as { message?: string })?.message ??
                  t("goal_detail.try_again"),
              );
              return;
            }
            showToast(t("goal_detail.toast_archived"), "success");
            navigation.navigate(Routes.GoalsHubV2 as any);
          },
        },
      ],
    );
  };

  const handleShareProgress = () => {
    closeMenu();
    // P1: Share is a polish-future item — flagged in the audit's
    // Bucket C list. The menu entry is here so the surface is
    // discoverable; tapping shows a coming-soon toast for now.
    showToast(t("goal_detail.share_coming_soon"), "info");
  };

  // P2 (Bucket C.3) — projection math for the "you're ahead" banner.
  //
  // Linear pace = balance / days_since_start. Project forward to
  // target_date. If the projection clears target × 1.10, surface a
  // banner suggesting a new target = current target × 1.10 (rounded
  // to the nearest $100 so the chip reads as a clean number).
  const aheadProjection = useMemo(() => {
    if (!goal.target || goal.target <= 0) return null;
    if (!goal.targetDate) return null;
    if (realStatus === "completed") return null;
    const due = new Date(goal.targetDate);
    if (isNaN(due.getTime())) return null;
    const today = new Date();
    const daysUntil = Math.max(
      0,
      Math.ceil((due.getTime() - today.getTime()) / 86_400_000),
    );
    // Need at least 7 days of history to extrapolate — short windows
    // are noisy ("user deposited $50 yesterday so they'll have a
    // million by Friday" is the kind of false positive we want to
    // skip).
    if (goal.daysActive < 7) return null;
    if (daysUntil <= 0) return null;
    const dailyRate = goal.balance / goal.daysActive;
    const projected = goal.balance + dailyRate * daysUntil;
    if (projected <= goal.target * AHEAD_THRESHOLD) return null;
    // Round suggested target up to nearest $100.
    const raw = goal.target * 1.1;
    const suggested = Math.ceil(raw / 100) * 100;
    return { projected, suggested };
  }, [
    goal.balance,
    goal.target,
    goal.targetDate,
    goal.daysActive,
    realStatus,
  ]);

  // Load any persisted dismiss timestamp from AsyncStorage on mount.
  useEffect(() => {
    let cancelled = false;
    if (!goal.id) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AHEAD_DISMISSED_KEY(goal.id));
        if (cancelled) return;
        const ms = raw ? new Date(raw).getTime() : NaN;
        setAheadDismissedAt(Number.isFinite(ms) ? ms : null);
      } catch {
        if (!cancelled) setAheadDismissedAt(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [goal.id]);

  const showAheadBanner =
    !!aheadProjection &&
    (aheadDismissedAt === null ||
      Date.now() - aheadDismissedAt >= AHEAD_DISMISS_WINDOW_MS);

  const handleDismissAhead = async () => {
    const now = new Date();
    setAheadDismissedAt(now.getTime());
    try {
      await AsyncStorage.setItem(
        AHEAD_DISMISSED_KEY(goal.id),
        now.toISOString(),
      );
    } catch {
      /* best-effort */
    }
  };

  // Open the quick-edit sheet pre-filled with the +10% suggestion when
  // launched from the ahead banner, or with the current target when
  // launched via long-press on the target breakdown.
  const openQuickEdit = (prefill: number) => {
    setQuickEditAmount(Math.round(prefill));
    setQuickEditVisible(true);
  };

  const handleQuickEditSave = async () => {
    if (quickEditAmount <= 0) return;
    setQuickEditSaving(true);
    const { error } = await updateGoal(goal.id, {
      targetAmount: quickEditAmount,
    });
    setQuickEditSaving(false);
    if (error) {
      Alert.alert(
        t("goal_detail.quick_edit_failed_title"),
        (error as { message?: string })?.message ?? t("goal_detail.try_again"),
      );
      return;
    }
    setQuickEditVisible(false);
    showToast(t("goal_detail.quick_edit_toast"), "success");
    loadGoal();
  };

  // P2 (Bucket C.4) — animate the progress bar to the current value
  // whenever it changes. The Animated.Value is initialised at 0 (see
  // ref above), so the first paint after fetch animates from 0 → real
  // progress. Subsequent refetches (deposits, withdrawals) animate
  // from the prior progress.
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: goal.progressPercent ?? 0,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      // Width can't use the native driver — keep this on the JS thread.
      useNativeDriver: false,
    }).start();
  }, [goal.progressPercent, progressAnim]);
  const animatedProgressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });
  // Replaced full-screen navigation with bottom-sheet modals — same
  // atomic RPC paths (transfer_to_goal / transfer_from_goal) under the
  // hood, but one less screen transition per deposit / withdrawal.
  const handleAddMoney = () => setShowAddMoneySheet(true);
  const handleWithdraw = () => setShowWithdrawSheet(true);
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
              onPress={openMenu}
              accessibilityRole="button"
              accessibilityLabel={t("goal_detail.menu_a11y")}
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
            <Text style={styles.balanceLabel}>{t("goal_detail.total_value")}</Text>
            <Text style={styles.balanceValue}>
              $
              {totalWithInterest.toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </Text>

            {/* Breakdown */}
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{t("goal_detail.breakdown_saved")}</Text>
                <Text style={styles.breakdownValue}>
                  ${goal.balance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>{t("goal_detail.breakdown_interest")}</Text>
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
              {/* P2 (Bucket C.5) — long-press the target value to open
                  the inline quick-edit sheet without leaving Detail.
                  Tap remains a no-op so users don't accidentally edit
                  when scrolling. */}
              <Pressable
                style={styles.breakdownItem}
                onLongPress={() => openQuickEdit(goal.target)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={t("goal_detail.quick_edit_a11y")}
              >
                <Text style={styles.breakdownLabel}>{t("goal_detail.breakdown_target")}</Text>
                <Text style={styles.breakdownValue}>
                  ${goal.target.toLocaleString()}
                </Text>
              </Pressable>
            </View>

            {/* P2 (Bucket C.4) — progress bar now animates between
                values rather than snapping. Animated.View can't host
                LinearGradient as a child while keeping width animated,
                so we wrap the gradient in an Animated.View and clip
                via overflow:hidden on the track. */}
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[styles.progressFillWrap, { width: animatedProgressWidth }]}
                >
                  <LinearGradient
                    colors={[TEAL, "#00E5CC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.progressFillGradient}
                  />
                </Animated.View>
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
          {/* P2 (Bucket C.3) — ahead-of-schedule nudge. Suggests
              raising the target by 10% when the linear projection
              clears target × 1.10. Dismissible for 7 days per goal. */}
          {showAheadBanner && aheadProjection && (
            <View style={styles.aheadBanner}>
              <View style={styles.aheadBannerIcon}>
                <Ionicons name="trending-up" size={20} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aheadBannerTitle}>
                  {t("goal_detail.ahead_title")}
                </Text>
                <Text style={styles.aheadBannerBody}>
                  {t("goal_detail.ahead_body", {
                    amount: aheadProjection.suggested.toLocaleString(),
                  })}
                </Text>
                <View style={styles.aheadBannerActions}>
                  <TouchableOpacity
                    style={styles.aheadBannerPrimary}
                    onPress={() => openQuickEdit(aheadProjection.suggested)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.aheadBannerPrimaryText}>
                      {t("goal_detail.ahead_cta_raise")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.aheadBannerGhost}
                    onPress={handleDismissAhead}
                    accessibilityRole="button"
                  >
                    <Text style={styles.aheadBannerGhostText}>
                      {t("goal_detail.ahead_cta_dismiss")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

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
                <Text style={styles.celebrationBannerDismissText}>{t("goal_detail.dismiss")}</Text>
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
                <Text style={styles.typeCardApyLabel}>{t("goal_detail.apy_label")}</Text>
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
                      <Text style={styles.lockMutedLabel}>{t("goal_detail.unlocks_label")}</Text>
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
                    <Text style={styles.interestTitle}>{t("goal_detail.interest_section_title")}</Text>
                  </View>
                  <Text style={styles.interestValue}>
                    ${goal.interestEarned.toFixed(2)}
                  </Text>
                  <Text style={styles.interestSub}>
                    +${goal.dailyInterest.toFixed(2)}/day • {goal.apy}% APY
                  </Text>
                </View>
                <View style={styles.interestActiveBox}>
                  <Text style={styles.interestActiveLabel}>{t("goal_detail.interest_active")}</Text>
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
              {displayMilestones.map((m, idx) => (
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
                  {idx < displayMilestones.length - 1 && (
                    <View
                      style={[
                        styles.milestoneConnector,
                        {
                          backgroundColor:
                            m.achieved && displayMilestones[idx + 1]?.achieved
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
              {displayMilestones.filter((m) => m.achieved).length} of{" "}
              {displayMilestones.length} milestones reached
            </Text>
          </TouchableOpacity>

          {/* Linked circle — three cases:
              1. Full circle details fetched → show the rich card.
              2. FK set but no details (current backend default) → render
                 nothing. The prior placeholder showed "$0 on —" to users
                 with linked circles, which was confusing. Hiding entirely
                 is the P0 fix.
              3. No FK at all → show the dashed "Link a Circle" CTA. */}
          {goal.linkedCircle ? (
            <View style={styles.card}>
              <View style={styles.linkedHeaderRow}>
                <View style={styles.linkedHeaderLeft}>
                  <View style={styles.linkedIconBox}>
                    <Text style={styles.linkedIconEmoji}>🔗</Text>
                  </View>
                  <View>
                    <Text style={styles.linkedKicker}>{t("goal_detail.linked_kicker")}</Text>
                    <Text style={styles.linkedName}>{goal.linkedCircle.name}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={handleLinkCircle}
                  accessibilityRole="button"
                >
                  <Text style={styles.linkAction}>{t("goal_detail.edit")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.payoutBox}>
                <View>
                  <Text style={styles.payoutLabel}>{t("goal_detail.next_payout")}</Text>
                  <Text style={styles.payoutValue}>
                    ${goal.linkedCircle.payoutAmount.toLocaleString()} on{" "}
                    {goal.linkedCircle.nextPayout}
                  </Text>
                </View>
                <View style={styles.autoTransferTag}>
                  <Text style={styles.autoTransferText}>{t("final_polish.goaldetailv2_auto_transfer_on")}</Text>
                </View>
              </View>
            </View>
          ) : goal.linkedCircleId ? null : (
            <TouchableOpacity
              onPress={handleLinkCircle}
              activeOpacity={0.8}
              accessibilityRole="button"
              style={styles.linkCircleButton}
            >
              <Text style={styles.linkCircleEmoji}>🔗</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkCircleTitle}>{t("goal_detail.link_circle_title")}</Text>
                <Text style={styles.linkCircleBody}>{t("goal_detail.link_circle_body")}</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Verified Provider Network (Phase 1B). Either shows a
              summary of the linked provider OR a "Find a provider" CTA
              when the goal is tagged with a provider_category. */}
          {linkedProvider ? (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate(Routes.ProviderDetail as any, {
                  providerId: linkedProvider.provider_id,
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeading}>
                  {t("goal_detail.provider_linked_title")}
                </Text>
                <Text style={styles.linkAction}>{t("goal_detail.see_all")}</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#0A2342" }}>
                {linkedProvider.business_name}
              </Text>
              <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                {t("goal_detail.provider_paid_so_far", {
                  amount: `$${(linkedProvider.paid_amount_cents / 100).toFixed(2)}`,
                })}{" "}
                · {linkedProvider.status}
              </Text>
            </TouchableOpacity>
          ) : (
            realStatus === "active" && providerCategory ? (
              <TouchableOpacity
                style={styles.linkCircleButton}
                onPress={() =>
                  navigation.navigate(Routes.ProviderList as any, {
                    goalId: goal.id,
                  })
                }
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.linkCircleEmoji}>🛠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.linkCircleTitle}>
                    {t("goal_detail.find_provider_title")}
                  </Text>
                  <Text style={styles.linkCircleBody}>
                    {t("goal_detail.find_provider_body")}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : null
          )}

          {/* Phase 2B — "Create milestones" CTA. Shown only when there's
              a linked provider AND no disbursement milestones exist yet
              (so the screen doesn't double up with the progress card
              below). Goal owner only — the gate is already enforced by
              the create RPC, but we hide the affordance for clarity. */}
          {linkedProvider && !milestoneCounts && realStatus === "active" ? (
            <TouchableOpacity
              style={styles.linkCircleButton}
              onPress={() =>
                navigation.navigate(Routes.CreateDisbursementMilestones as any, {
                  goalId: goal.id,
                  providerId: linkedProvider.provider_id,
                })
              }
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Text style={styles.linkCircleEmoji}>🧱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkCircleTitle}>
                  {t("goal_detail.create_milestones_title")}
                </Text>
                <Text style={styles.linkCircleBody}>
                  {t("goal_detail.create_milestones_body")}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Phase 2A — staged-disbursement summary. Visible only when
              the goal has milestones configured (disbursement_type
              switches to 'staged' when create_goal_disbursement_milestones
              runs). Renders a compact progress card linking to the full
              milestones screen. */}
          {disbursementType === "staged" && milestoneCounts ? (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate(Routes.GoalDisbursementMilestones as any, {
                  goalId: goal.id,
                })
              }
              accessibilityRole="button"
            >
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardHeading}>
                  {t("goal_detail.milestones_section_title")}
                </Text>
                <Text style={styles.linkAction}>
                  {t("goal_detail.view_milestones_button")}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: "#0A2342", fontWeight: "700", marginTop: 4 }}>
                {t("goal_detail.milestones_count", {
                  done: milestoneCounts.released,
                  total: milestoneCounts.total,
                })}
              </Text>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: "#E5E7EB", marginTop: 8 }}>
                <View
                  style={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: "#00C6AE",
                    width: `${Math.round(
                      (milestoneCounts.released / Math.max(milestoneCounts.total, 1)) * 100,
                    )}%`,
                  }}
                />
              </View>
            </TouchableOpacity>
          ) : null}

          {/* Recent activity */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>{t("goal_detail.section_recent_activity")}</Text>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(Routes.GoalActivity, {
                    goal,
                    recentActivity,
                  })
                }
                accessibilityRole="button"
              >
                <Text style={styles.linkAction}>{t("goal_detail.see_all")}</Text>
              </TouchableOpacity>
            </View>

            {recentActivity.length === 0 ? (
              <Text style={styles.activityEmpty}>
                {t("goal_detail.activity_empty")}
              </Text>
            ) : (
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
            )}
          </View>

          {/* ===== P2 — Round-up jar toggle ===== */}
          {/* Only renders for goal_type='round_up'. Flips
              user_savings_goals.round_up_enabled so future sends stop
              sweeping into this jar (existing balance is preserved). */}
          {isRoundUpJar ? (
            <View style={styles.roundUpCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roundUpTitle}>
                  {t("goal_detail.round_up_toggle_title")}
                </Text>
                <Text style={styles.roundUpBody}>
                  {t("goal_detail.round_up_toggle_body")}
                </Text>
              </View>
              <Switch
                value={roundUpEnabled}
                disabled={roundUpSaving}
                onValueChange={async (next) => {
                  setRoundUpSaving(true);
                  const prev = roundUpEnabled;
                  setRoundUpEnabledLocal(next);
                  const { error } = await setRoundUpEnabled(goal.id, next);
                  setRoundUpSaving(false);
                  if (error) {
                    setRoundUpEnabledLocal(prev);
                    Alert.alert(
                      t("goal_detail.round_up_save_failed_title"),
                      (error as { message?: string })?.message ?? "",
                    );
                  }
                }}
                trackColor={{ false: "#D1D5DB", true: "#A7F3D0" }}
                thumbColor={roundUpEnabled ? "#00C6AE" : "#F3F4F6"}
              />
            </View>
          ) : null}
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
          <Text style={styles.addMoneyText}>{t("goal_detail.add_money")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleWithdraw}
          accessibilityRole="button"
          style={styles.withdrawButton}
        >
          <Text style={styles.withdrawText}>{t("goal_detail.withdraw")}</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom-sheet modals — replace the full-screen GoalAddMoneyScreen
          and GoalWithdrawScreen for the common wallet-funded paths. */}
      <GoalAddMoneySheet
        visible={showAddMoneySheet}
        goalId={goal.id}
        goalName={goal.name}
        walletBalance={walletBalance ?? 0}
        onClose={() => setShowAddMoneySheet(false)}
        onSuccess={() => loadGoal()}
      />
      <GoalWithdrawSheet
        visible={showWithdrawSheet}
        goalId={goal.id}
        goalName={goal.name}
        goalBalance={goal.balance ?? 0}
        penaltyPercent={
          goal.savingsType === "flexible" ? 0 : 10
        }
        onClose={() => setShowWithdrawSheet(false)}
        onSuccess={() => loadGoal()}
      />

      {/* P1 (Bucket B.1) — Goal options bottom-sheet. Mirrors the
          shape of MethodActionsSheet / the wallet coach mark. Four
          actions: Edit, Mark complete, Delete (destructive), Share. */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeMenu}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <Text style={styles.menuTitle}>{t("goal_detail.menu_title")}</Text>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleEditGoal}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: "#F0FDFB" }]}>
                <Ionicons name="create-outline" size={18} color={TEAL} />
              </View>
              <Text style={styles.menuRowText}>{t("goal_detail.menu_edit")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleMarkComplete}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color={GREEN} />
              </View>
              <Text style={styles.menuRowText}>{t("goal_detail.menu_complete")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleShareProgress}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="share-outline" size={18} color="#1D4ED8" />
              </View>
              <Text style={styles.menuRowText}>{t("goal_detail.menu_share")}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowDestructive]}
              onPress={handleDelete}
              accessibilityRole="button"
            >
              <View style={[styles.menuIconBox, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="trash-outline" size={18} color={RED} />
              </View>
              <Text style={[styles.menuRowText, { color: RED }]}>
                {t("goal_detail.menu_delete")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuCancel}
              onPress={closeMenu}
              accessibilityRole="button"
            >
              <Text style={styles.menuCancelText}>{t("goal_detail.cancel")}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* P2 (Bucket C.5) — quick-edit target sheet. Same bottom-sheet
          shape as the options menu. Opens long-press on the target
          number or from the ahead banner's "Raise target" CTA. */}
      <Modal
        visible={quickEditVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQuickEditVisible(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setQuickEditVisible(false)}
        >
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuHandle} />
            <Text style={styles.quickEditTitle}>
              {t("goal_detail.quick_edit_title")}
            </Text>
            <Text style={styles.quickEditSub}>
              {t("goal_detail.quick_edit_sub", {
                current: goal.target.toLocaleString(),
              })}
            </Text>

            <View style={styles.quickEditInputWrap}>
              <Text style={styles.quickEditCurrency}>$</Text>
              <TextInput
                value={String(quickEditAmount)}
                onChangeText={(s) =>
                  setQuickEditAmount(Number(s.replace(/[^0-9]/g, "")) || 0)
                }
                keyboardType="numeric"
                style={styles.quickEditInput}
                editable={!quickEditSaving}
              />
            </View>

            {/* Quick chips around the suggested suggestion. The ahead
                banner already opens with the +10% value pre-filled, but
                explicit chips keep this useful for the long-press path
                where the suggestion is just the current target. */}
            <View style={styles.quickEditChipsRow}>
              {[1.05, 1.1, 1.25].map((mult) => {
                const amt = Math.ceil((goal.target * mult) / 100) * 100;
                const isActive = quickEditAmount === amt;
                return (
                  <TouchableOpacity
                    key={mult}
                    style={[
                      styles.quickEditChip,
                      isActive && styles.quickEditChipActive,
                    ]}
                    onPress={() => setQuickEditAmount(amt)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.quickEditChipText,
                        isActive && styles.quickEditChipTextActive,
                      ]}
                    >
                      ${amt.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.quickEditActions}>
              <TouchableOpacity
                style={styles.menuCancel}
                onPress={() => setQuickEditVisible(false)}
                disabled={quickEditSaving}
                accessibilityRole="button"
              >
                <Text style={styles.menuCancelText}>
                  {t("goal_detail.cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickEditSave,
                  (quickEditSaving || quickEditAmount <= 0) &&
                    styles.quickEditSaveDisabled,
                ]}
                onPress={handleQuickEditSave}
                disabled={quickEditSaving || quickEditAmount <= 0}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: quickEditSaving || quickEditAmount <= 0,
                  busy: quickEditSaving,
                }}
              >
                {quickEditSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.quickEditSaveText}>
                    {t("goal_detail.quick_edit_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  // P2 (Bucket C.4) — Animated.View wrapper around the gradient fill.
  // The wrapper carries the animated width; the gradient inside fills
  // it to 100% so the animation is one-dimensional.
  progressFillWrap: { height: 10, borderRadius: 5, overflow: "hidden" },
  progressFillGradient: { flex: 1, height: 10, borderRadius: 5 },
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
  activityEmpty: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    paddingVertical: 12,
  },

  // P1 (Bucket B.1) — Goal options bottom-sheet menu.
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 32,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  menuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuRowDestructive: { borderBottomWidth: 0 },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuRowText: { flex: 1, fontSize: 15, fontWeight: "600", color: NAVY },
  menuCancel: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  menuCancelText: { fontSize: 14, fontWeight: "700", color: MUTED },

  // P2 (Bucket C.3) — ahead-of-schedule banner.
  aheadBanner: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 14,
  },
  aheadBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  aheadBannerTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 4 },
  aheadBannerBody: { fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 17 },
  aheadBannerActions: { flexDirection: "row", gap: 8 },
  aheadBannerPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: GREEN,
  },
  aheadBannerPrimaryText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  aheadBannerGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  aheadBannerGhostText: { fontSize: 12, fontWeight: "700", color: MUTED },

  // P2 (Bucket C.5) — quick-edit target bottom sheet.
  quickEditTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
    paddingHorizontal: 6,
  },
  quickEditSub: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  quickEditInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F5F7FA",
    marginBottom: 12,
  },
  quickEditCurrency: { fontSize: 24, fontWeight: "700", color: NAVY },
  quickEditInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "700",
    color: NAVY,
    marginLeft: 4,
    padding: 0,
  },
  quickEditChipsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  quickEditChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  quickEditChipActive: { borderWidth: 2, borderColor: TEAL, backgroundColor: "#F0FDFB" },
  quickEditChipText: { fontSize: 12, fontWeight: "600", color: MUTED },
  quickEditChipTextActive: { color: GREEN },
  quickEditActions: { flexDirection: "row", gap: 10 },
  quickEditSave: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  quickEditSaveDisabled: { backgroundColor: BORDER },
  quickEditSaveText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
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

  // P2 — Round-up jar toggle card.
  roundUpCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F0FDFB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginTop: 16,
  },
  roundUpTitle: { fontSize: 14, fontWeight: "700", color: NAVY },
  roundUpBody: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 16 },

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
