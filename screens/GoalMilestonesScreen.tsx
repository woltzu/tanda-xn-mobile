// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalMilestonesScreen.tsx — GOALS-011
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 162-GOALS-011-GoalMilestones.jsx.
//
// Milestone timeline (First Deposit → 10% → 25% → 50% → 75% → 90% → 100%)
// with a top progress summary, an orange "next milestone" card (with a
// mini progress bar + Add Money), the timeline itself (vertical connector
// line + achieved/locked dots), and a motivation card.
//
// NAVIGATION — translation-only batch. onBack → goBack(); Add Money (next
// card + bottom CTA) resolves to a "coming soon" Alert placeholder tagged
// TODO(goals-wiring) (forward target: GoalAddMoney).
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useGoalActions } from "../hooks/useGoalActions";
import { useWallet } from "../context/WalletContext";
import GoalAddMoneySheet from "../components/GoalAddMoneySheet";
import type { GoalMilestone as RealMilestone } from "../types/goals";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type MilestonesGoal = {
  id: string;
  name: string;
  emoji: string;
  balance: number;
  target: number;
  progressPercent: number;
  startDate: string;
};

type Milestone = {
  id: string;
  type: string;
  label: string;
  emoji: string;
  percent: number;
  achieved: boolean;
  achievedDate: string | null;
  amount: number;
  message: string;
};

type GoalMilestonesParams = {
  goalId?: string;
  goal?: MilestonesGoal;
  // Raw rows from goal_milestones (forwarded by GoalDetailV2's
  // handleViewMilestones after migration 078). When present, we skip the
  // fetch; otherwise we pull them via useGoalActions.fetchGoal. Legacy
  // callers that pass nothing fall back to DEFAULT_MILESTONES (mock).
  milestones?: RealMilestone[];
};
type GoalMilestonesRouteProp = RouteProp<
  { GoalMilestones: GoalMilestonesParams },
  "GoalMilestones"
>;

const DEFAULT_GOAL: MilestonesGoal = {
  id: "g1",
  name: "First Home in Atlanta",
  emoji: "🏠",
  balance: 8500.0,
  target: 25000.0,
  progressPercent: 34,
  startDate: "Jan 15, 2025",
};

const DEFAULT_MILESTONES: Milestone[] = [
  { id: "m1", type: "first_deposit", label: "First Deposit", emoji: "🚀", percent: 0, achieved: true, achievedDate: "Jan 15, 2025", amount: 500, message: "Your journey begins!" },
  { id: "m2", type: "percent_10", label: "10% Milestone", emoji: "🌱", percent: 10, achieved: true, achievedDate: "Feb 1, 2025", amount: 2500, message: "1 in 10 steps taken!" },
  { id: "m3", type: "percent_25", label: "25% Milestone", emoji: "💪", percent: 25, achieved: true, achievedDate: "Mar 10, 2025", amount: 6250, message: "Quarter of the way there!" },
  { id: "m4", type: "percent_50", label: "Halfway!", emoji: "🏔️", percent: 50, achieved: false, achievedDate: null, amount: 12500, message: "The summit is in sight!" },
  { id: "m5", type: "percent_75", label: "75% Milestone", emoji: "🏃", percent: 75, achieved: false, achievedDate: null, amount: 18750, message: "Sprint to the finish!" },
  { id: "m6", type: "percent_90", label: "Almost There!", emoji: "🔥", percent: 90, achieved: false, achievedDate: null, amount: 22500, message: "One final push!" },
  { id: "m7", type: "goal_achieved", label: "Goal Achieved!", emoji: "🏆", percent: 100, achieved: false, achievedDate: null, amount: 25000, message: "YOU DID IT!" },
];

// Canonical milestone definitions used when we have real DB rows. Mirrors
// the percentage thresholds that _record_goal_milestones (migration 078)
// inserts. First Deposit isn't tracked in goal_milestones (skipped per the
// approved scope) — we synthesize it from goal.balance > 0 with the
// earliest real-milestone reachedAt as a date proxy.
type MilestoneTemplate = Omit<Milestone, "achieved" | "achievedDate" | "amount">;
const PERCENT_TEMPLATES: MilestoneTemplate[] = [
  { id: "m10", type: "percent_10", label: "10% Milestone", emoji: "🌱", percent: 10, message: "1 in 10 steps taken!" },
  { id: "m25", type: "percent_25", label: "25% Milestone", emoji: "💪", percent: 25, message: "Quarter of the way there!" },
  { id: "m50", type: "percent_50", label: "Halfway!", emoji: "🏔️", percent: 50, message: "The summit is in sight!" },
  { id: "m75", type: "percent_75", label: "75% Milestone", emoji: "🏃", percent: 75, message: "Sprint to the finish!" },
  { id: "m90", type: "percent_90", label: "Almost There!", emoji: "🔥", percent: 90, message: "One final push!" },
  { id: "m100", type: "goal_achieved", label: "Goal Achieved!", emoji: "🏆", percent: 100, message: "YOU DID IT!" },
];

function formatMilestoneDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Build the screen's 7-row milestone list from real DB rows + the goal.
 * First Deposit row: synthesized (achieved iff goal.balance > 0). Percent
 * rows: amount = goal.target * pct/100; achieved iff a matching DB row
 * exists; achievedDate from that row's reachedAt.
 */
function buildMilestonesFromReal(
  real: RealMilestone[],
  goal: MilestonesGoal
): Milestone[] {
  const byPct = new Map<number, RealMilestone>(
    real.map((r) => [r.milestonePercent, r])
  );

  // First-deposit synthesis. Date proxy: earliest real-milestone date —
  // not exactly right (the user may have made many small deposits before
  // crossing 10%) but the best approximation without querying
  // savings_transactions for the oldest row. Flagged as a follow-up.
  const firstDepositAchieved = goal.balance > 0;
  const firstDepositDate = real
    .map((r) => r.reachedAt)
    .sort()[0]
    ? formatMilestoneDate(real.map((r) => r.reachedAt).sort()[0])
    : null;
  const firstDeposit: Milestone = {
    id: "m0_first_deposit",
    type: "first_deposit",
    label: "First Deposit",
    emoji: "🚀",
    percent: 0,
    amount: 0,
    achieved: firstDepositAchieved,
    achievedDate: firstDepositAchieved ? firstDepositDate : null,
    message: "Your journey begins!",
  };

  const percentRows: Milestone[] = PERCENT_TEMPLATES.map((tpl) => {
    const row = byPct.get(tpl.percent);
    return {
      ...tpl,
      amount: Math.round((goal.target * tpl.percent) / 100),
      achieved: !!row,
      achievedDate: row ? formatMilestoneDate(row.reachedAt) : null,
    };
  });

  return [firstDeposit, ...percentRows];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function GoalMilestonesScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<GoalMilestonesRouteProp>();
  const { fetchGoal } = useGoalActions();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const goalId = route.params?.goalId ?? goal.id;

  // Real DB rows. The route param is a paint-first optimisation
  // (GoalDetailV2 forwards its current cache so this screen renders
  // without a spinner), but we ALWAYS refetch fresh on mount / focus
  // because:
  //   * the caller may pass a stale snapshot (e.g. balance was already
  //     past 10% but the parent's cache pre-dates the deposit that
  //     crossed it), and
  //   * the previous guard `if (route.params?.milestones) return`
  //     treated an empty array as "already supplied inline" — but
  //     Boolean([]) === true, so an empty-array forward silently
  //     skipped the fetch and the screen was left stuck on the
  //     zero-milestone state until a full remount.
  const [realMilestones, setRealMilestones] = useState<RealMilestone[]>(
    route.params?.milestones ?? []
  );

  const refetchMilestones = useCallback(async () => {
    if (!UUID_RE.test(goalId)) return; // mock / preview mode
    const { data, error } = await fetchGoal(goalId);
    if (error || !data) return;
    setRealMilestones(data.milestones);
  }, [goalId, fetchGoal]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!UUID_RE.test(goalId)) return;
      const { data, error } = await fetchGoal(goalId);
      if (cancelled || error || !data) return;
      setRealMilestones(data.milestones);
    })();
    return () => {
      cancelled = true;
    };
  }, [goalId, fetchGoal]);

  // Refetch every time the screen regains focus — covers the deposit-
  // then-back flow where the user navigates away, deposits (which
  // atomically records a new goal_milestones row via
  // _record_goal_milestones), and returns to this screen expecting
  // the new milestone to be lit.
  useFocusEffect(
    useCallback(() => {
      void refetchMilestones();
    }, [refetchMilestones]),
  );

  // Decide whether to render the mock-driven canonical 7 rows (legacy
  // preview / debug nav) or the real-data-driven set. We treat the
  // presence of a UUID goalId as the marker for "real mode".
  const milestones: Milestone[] = UUID_RE.test(goalId)
    ? buildMilestonesFromReal(realMilestones, goal)
    : DEFAULT_MILESTONES;

  const achievedCount = milestones.filter((m) => m.achieved).length;
  const nextIndex = milestones.findIndex((m) => !m.achieved);
  const nextMilestone = nextIndex >= 0 ? milestones[nextIndex] : undefined;
  const amountToNext = nextMilestone ? nextMilestone.amount - goal.balance : 0;

  // Progress within the band between the previous milestone and the next one.
  const prevAmount = nextIndex > 0 ? milestones[nextIndex - 1].amount : 0;
  const nextProgressPct = nextMilestone
    ? Math.max(
        0,
        Math.min(
          100,
          ((goal.balance - prevAmount) / (nextMilestone.amount - prevAmount)) * 100
        )
      )
    : 0;

  // Motivation line uses the first two words of the goal name (web parity).
  const nameWords = goal.name.split(" ");
  const shortName = [nameWords[0], nameWords[1]].filter(Boolean).join(" ");

  // ── Add-money sheet wiring ───────────────────────────────────────────────
  // Both the orange "Add Money" chip on the next-milestone card AND the
  // bottom-fixed "Add Money to Reach Next Milestone" CTA now open the same
  // GoalAddMoneySheet (already used by GoalDetailV2). Amount pre-fills to
  // the delta needed to reach the next milestone — e.g. at $500 / $5000
  // and next=25%, the sheet opens pre-populated with $750.
  //
  // Guarded on real mode: the mock-preview path (goalId not a UUID) still
  // shows the "Coming soon" alert since the RPC would 404 on a made-up id.
  const { balance: walletBalance } = useWallet();
  const [sheetVisible, setSheetVisible] = useState(false);
  const sheetPrefill =
    amountToNext > 0 && amountToNext <= (nextMilestone?.amount ?? 0)
      ? amountToNext
      : undefined;
  const isRealMode = UUID_RE.test(goalId);
  const openAddMoney = () => {
    if (!isRealMode) {
      Alert.alert("Add Money", "This will be available soon.");
      return;
    }
    setSheetVisible(true);
  };

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
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerKicker} numberOfLines={1}>
                {goal.emoji} {goal.name}
              </Text>
              <Text style={styles.headerTitle}>{t("screen_headers.goal_milestones")}</Text>
            </View>
          </View>

          {/* Progress summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{achievedCount}</Text>
              <Text style={styles.summaryLabel}>{t("final_polish.goalmilestones_milestones_hit")}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{goal.progressPercent.toFixed(1)}%</Text>
              <Text style={styles.summaryLabel}>{t("final_polish.goalmilestones_progress")}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: TEAL }]}>
                {milestones.length - achievedCount}
              </Text>
              <Text style={styles.summaryLabel}>{t("final_polish.goalmilestones_to_go")}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Next milestone card */}
          {nextMilestone && (
            <LinearGradient
              colors={["#F59E0B", "#D97706"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextCard}
            >
              <View style={styles.nextTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextKicker}>{t("final_polish.goalmilestones_next_milestone")}</Text>
                  <View style={styles.nextTitleRow}>
                    <Text style={styles.nextEmoji}>{nextMilestone.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nextLabel}>{nextMilestone.label}</Text>
                      <Text style={styles.nextAmount}>
                        ${amountToNext.toLocaleString()} to unlock
                      </Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={openAddMoney}
                  accessibilityRole="button"
                  style={styles.nextAddButton}
                >
                  <Text style={styles.nextAddText}>{t("final_polish.goalmilestones_add_money")}</Text>
                </TouchableOpacity>
              </View>

              {/* Mini progress to next */}
              <View style={styles.nextProgressTrack}>
                <View
                  style={[styles.nextProgressFill, { width: `${nextProgressPct}%` }]}
                />
              </View>
            </LinearGradient>
          )}

          {/* Timeline */}
          <View style={styles.card}>
            <Text style={styles.cardHeading}>{t("final_polish.goalmilestones_your_journey")}</Text>

            <View style={styles.timeline}>
              {/* Connector line behind the dots */}
              <View style={styles.timelineLine} />

              {milestones.map((milestone, idx) => {
                const isNext = idx === nextIndex;
                return (
                  <View key={milestone.id} style={styles.timelineItem}>
                    {/* Dot / icon */}
                    {milestone.achieved ? (
                      <LinearGradient
                        colors={[TEAL, GREEN]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.dot}
                      >
                        <Text style={styles.dotEmoji}>{milestone.emoji}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.dot, styles.dotLocked]}>
                        <Text style={styles.dotLockedEmoji}>🔒</Text>
                      </View>
                    )}

                    {/* Content */}
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineLabelRow}>
                        <Text
                          style={[
                            styles.timelineLabel,
                            { color: milestone.achieved ? NAVY : "#9CA3AF" },
                          ]}
                        >
                          {milestone.label}
                        </Text>
                        {milestone.achieved && (
                          <View style={styles.achievedBadge}>
                            <Text style={styles.achievedBadgeText}>✓ Achieved</Text>
                          </View>
                        )}
                      </View>

                      <Text
                        style={[
                          styles.timelineMeta,
                          { color: milestone.achieved ? MUTED : "#9CA3AF" },
                        ]}
                      >
                        {milestone.percent > 0
                          ? `${milestone.percent}% of target`
                          : "Start saving"}{" "}
                        • ${milestone.amount.toLocaleString()}
                      </Text>

                      {milestone.achieved && milestone.achievedDate && (
                        <Text style={styles.timelineMessage}>
                          🎉 {milestone.message} — {milestone.achievedDate}
                        </Text>
                      )}

                      {!milestone.achieved && isNext && (
                        <View style={styles.unlockBox}>
                          <Text style={styles.unlockText}>
                            ⭐ $
                            {Math.max(
                              0,
                              milestone.amount - goal.balance
                            ).toLocaleString()}{" "}
                            more to unlock this milestone
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Motivation card */}
          <View style={styles.motivationCard}>
            <Text style={styles.motivationText}>
              "Every milestone is proof that discipline works. Keep going —{" "}
              {shortName} is within reach."
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ===== BOTTOM CTA ===== */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={openAddMoney}
          accessibilityRole="button"
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            Add Money to Reach Next Milestone
          </Text>
        </TouchableOpacity>
      </View>

      {isRealMode && (
        <GoalAddMoneySheet
          visible={sheetVisible}
          goalId={goalId}
          goalName={goal.name}
          walletBalance={walletBalance}
          prefillAmount={sheetPrefill}
          onClose={() => setSheetVisible(false)}
          onSuccess={() => {
            setSheetVisible(false);
            void refetchMilestones();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: { paddingTop: 20, paddingBottom: 60, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  headerKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
  },
  summaryItem: { alignItems: "center" },
  summaryValue: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },

  contentWrap: { marginTop: -30, paddingHorizontal: 16 },

  // Next milestone card
  nextCard: { borderRadius: 16, padding: 18, marginBottom: 16 },
  nextTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  nextKicker: { fontSize: 11, color: "rgba(255,255,255,0.8)" },
  nextTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  nextEmoji: { fontSize: 28 },
  nextLabel: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  nextAmount: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  nextAddButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  nextAddText: { fontSize: 13, fontWeight: "700", color: "#D97706" },
  nextProgressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 14,
  },
  nextProgressFill: { height: 6, backgroundColor: "#FFFFFF", borderRadius: 3 },

  // Timeline
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardHeading: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 16,
  },
  timeline: { position: "relative" },
  timelineLine: {
    position: "absolute",
    left: 22.5,
    top: 24,
    bottom: 24,
    width: 3,
    backgroundColor: BORDER,
    borderRadius: 2,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 12,
  },
  dot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  dotEmoji: { fontSize: 22 },
  dotLocked: { backgroundColor: BORDER },
  dotLockedEmoji: { fontSize: 18 },
  timelineContent: { flex: 1, paddingTop: 4 },
  timelineLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timelineLabel: { fontSize: 15, fontWeight: "600" },
  achievedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#F0FDFB",
  },
  achievedBadgeText: { fontSize: 10, fontWeight: "600", color: GREEN },
  timelineMeta: { fontSize: 13, marginTop: 4 },
  timelineMessage: { fontSize: 11, color: GREEN, marginTop: 4 },
  unlockBox: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  unlockText: { fontSize: 11, color: "#92400E" },

  // Motivation
  motivationCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: NAVY,
    borderRadius: 14,
  },
  motivationText: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 22,
    textAlign: "center",
  },

  // Bottom CTA
  bottomBar: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  primaryButtonText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
