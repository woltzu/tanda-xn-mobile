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
// NAVIGATION — translation-only batch. `onBack` → goBack(); every forward
// action (Add Money, Withdraw, Link Circle, Edit, Milestones, See All)
// resolves to a "coming soon" Alert placeholder. Real navigation is wired
// in the registration phase once the sibling goal screens are registered.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
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
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";

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

export default function GoalDetailV2Screen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalDetailV2RouteProp>();

  const goal = route.params?.goal ?? DEFAULT_GOAL;
  const milestones = route.params?.milestones ?? DEFAULT_MILESTONES;
  const recentActivity = route.params?.recentActivity ?? DEFAULT_ACTIVITY;

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

  // TODO(goals-wiring): replace each placeholder with typed navigation:
  //   onAddMoney      → Routes.GoalAddMoney
  //   onWithdraw      → Routes.GoalWithdraw
  //   onLinkCircle    → Routes.GoalLinkCircle
  //   onEditGoal      → Routes.EditGoal
  //   onViewMilestones→ Routes.GoalMilestones
  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

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
              onPress={() => comingSoon("Edit Goal")}
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
            onPress={() => comingSoon("Milestones")}
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
                  onPress={() => comingSoon("Link a Circle")}
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
              onPress={() => comingSoon("Link a Circle")}
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
                onPress={() => comingSoon("All Activity")}
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
          onPress={() => comingSoon("Add Money")}
          accessibilityRole="button"
          style={styles.addMoneyButton}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addMoneyText}>Add Money</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => comingSoon("Withdraw")}
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
