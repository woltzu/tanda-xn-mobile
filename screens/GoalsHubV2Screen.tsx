// ══════════════════════════════════════════════════════════════════════════════
// screens/GoalsHubV2Screen.tsx — GOALS-001 (v2 hub)
// ══════════════════════════════════════════════════════════════════════════════
//
// Translated from web JSX: 152-GOALS-001-GoalsHub.jsx.
//
// Goals dashboard: total saved + interest earned summary, filterable goal
// list (all / on-track / needs-attention), achievement stories, and a
// "link a circle" pro-tip. Entry point of the Goals flow.
//
// NAMING — a production GoalsHubScreen.tsx already exists, so this v2
// redesign takes the V2 suffix → future route `GoalsHubV2` (per the
// established conflict rule). The existing hub is untouched.
//
// NAVIGATION — translation-only batch. There is no back button (hub
// screen). Forward actions (open goal, create goal, view stories) resolve
// to "coming soon" Alert placeholders tagged TODO(goals-wiring); real
// navigation is wired during the registration phase.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
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
const GREEN = "#059669";
const AMBER = "#D97706";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";

type HubGoal = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  balance: number;
  target: number;
  interestEarned: number;
  progressPercent: number;
  isOnTrack: boolean;
  linkedCircle: string | null;
  monthlyContribution: number;
  targetDate: string;
};

type Story = {
  id: string;
  userName: string;
  goalType: string;
  emoji: string;
  headline: string;
  photoUrl: string | null;
  monthsToAchieve: number;
};

type GoalsHubV2Params = {
  totalSaved?: number;
  totalInterestEarned?: number;
  goals?: HubGoal[];
  achievementStories?: Story[];
};
type GoalsHubV2RouteProp = RouteProp<
  { GoalsHubV2: GoalsHubV2Params },
  "GoalsHubV2"
>;

const DEFAULT_GOALS: HubGoal[] = [
  {
    id: "g1",
    name: "First Home in Atlanta",
    emoji: "🏠",
    category: "Financial Freedom",
    balance: 8500,
    target: 25000,
    interestEarned: 52.4,
    progressPercent: 34,
    isOnTrack: true,
    linkedCircle: "Home Buyers Circle",
    monthlyContribution: 500,
    targetDate: "Dec 2027",
  },
  {
    id: "g2",
    name: "US Citizenship",
    emoji: "🗽",
    category: "Personal Transformation",
    balance: 3200,
    target: 8000,
    interestEarned: 28.15,
    progressPercent: 40,
    isOnTrack: true,
    linkedCircle: null,
    monthlyContribution: 300,
    targetDate: "Jun 2026",
  },
  {
    id: "g3",
    name: "Emergency Fund",
    emoji: "🆘",
    category: "Financial Freedom",
    balance: 750,
    target: 10000,
    interestEarned: 8.77,
    progressPercent: 7.5,
    isOnTrack: false,
    linkedCircle: null,
    monthlyContribution: 200,
    targetDate: "Dec 2026",
  },
];

const DEFAULT_STORIES: Story[] = [
  {
    id: "s1",
    userName: "Aminata D.",
    goalType: "First Home",
    emoji: "🏠",
    headline: "Closed on my first home after 2 years!",
    photoUrl: null,
    monthsToAchieve: 24,
  },
  {
    id: "s2",
    userName: "Kwame O.",
    goalType: "US Citizenship",
    emoji: "🗽",
    headline: "Took the oath last month!",
    photoUrl: null,
    monthsToAchieve: 18,
  },
];

const FILTERS = [
  { key: "all", label: "All Goals" },
  { key: "on_track", label: "On Track" },
  { key: "needs_attention", label: "Needs Attention" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function GoalsHubV2Screen() {
  const navigation = useTypedNavigation();
  const route = useRoute<GoalsHubV2RouteProp>();

  const totalSaved = route.params?.totalSaved ?? 12450.0;
  const totalInterestEarned = route.params?.totalInterestEarned ?? 89.32;
  const goals = route.params?.goals ?? DEFAULT_GOALS;
  const achievementStories = route.params?.achievementStories ?? DEFAULT_STORIES;

  const [filter, setFilter] = useState<FilterKey>("all");

  const filteredGoals = goals.filter((g) => {
    if (filter === "on_track") return g.isOnTrack;
    if (filter === "needs_attention") return !g.isOnTrack;
    return true;
  });

  // TODO(goals-wiring): wire to typed navigation once registered:
  //   onGoalPress  → Routes.GoalDetailV2 { goal }
  //   onCreateGoal → Routes.GoalCategorySelect
  //   onViewStories / onViewStory → Routes.GoalStories
  const comingSoon = (label: string) =>
    Alert.alert(label, "This will be available soon.");

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
            <View>
              <Text style={styles.headerKicker}>MY GOALS</Text>
              <Text style={styles.headerTitle}>Achieve Your Dreams</Text>
            </View>
            <TouchableOpacity
              onPress={() => comingSoon("Create Goal")}
              accessibilityRole="button"
              accessibilityLabel="New goal"
              style={styles.newGoalButton}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.newGoalText}>New Goal</Text>
            </TouchableOpacity>
          </View>

          {/* Total summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>TOTAL SAVED</Text>
              <Text style={styles.summaryValue}>
                $
                {totalSaved.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>INTEREST EARNED</Text>
              <Text style={[styles.summaryValue, { color: TEAL }]}>
                +${totalInterestEarned.toFixed(2)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* Filter tabs */}
          <View style={styles.filterRow}>
            {FILTERS.map((tab) => {
              const isActive = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setFilter(tab.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isActive && styles.filterTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Goals list */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            {filteredGoals.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                onPress={() => comingSoon(goal.name)}
                activeOpacity={0.85}
                accessibilityRole="button"
                style={styles.goalCard}
              >
                {/* Goal header */}
                <View style={styles.goalHeader}>
                  <View style={styles.goalHeaderLeft}>
                    <View style={styles.goalEmojiBox}>
                      <Text style={styles.goalEmoji}>{goal.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.goalName}>{goal.name}</Text>
                      <Text style={styles.goalMeta}>
                        {goal.category} • Target: {goal.targetDate}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: goal.isOnTrack ? "#F0FDFB" : "#FEF3C7",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: goal.isOnTrack ? GREEN : AMBER },
                      ]}
                    >
                      {goal.isOnTrack ? "On Track" : "Behind"}
                    </Text>
                  </View>
                </View>

                {/* Progress */}
                <View style={{ marginBottom: 12 }}>
                  <View style={styles.progressLabelRow}>
                    <Text style={styles.progressBalance}>
                      ${goal.balance.toLocaleString()}
                    </Text>
                    <Text style={styles.progressTarget}>
                      of ${goal.target.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${goal.progressPercent}%`,
                          backgroundColor: goal.isOnTrack ? TEAL : "#F59E0B",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPct}>
                    {goal.progressPercent}% complete
                  </Text>
                </View>

                {/* Footer */}
                <View style={styles.goalFooter}>
                  <View style={styles.earnedRow}>
                    <Text style={styles.earnedEmoji}>📈</Text>
                    <Text style={styles.earnedText}>
                      +${goal.interestEarned.toFixed(2)} earned
                    </Text>
                  </View>
                  {goal.linkedCircle && (
                    <View style={styles.linkedTag}>
                      <Text style={styles.linkedTagEmoji}>🔗</Text>
                      <Text style={styles.linkedTagText}>Linked</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Empty state */}
          {filteredGoals.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>No Goals Yet</Text>
              <Text style={styles.emptyBody}>
                Start your journey to achieving the life you came here to build.
              </Text>
              <TouchableOpacity
                onPress={() => comingSoon("Create Goal")}
                accessibilityRole="button"
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>
                  Create Your First Goal
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Achievement stories */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeading}>🏆 Achievement Stories</Text>
              <TouchableOpacity
                onPress={() => comingSoon("Achievement Stories")}
                accessibilityRole="button"
              >
                <Text style={styles.linkAction}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              {achievementStories.map((story) => (
                <TouchableOpacity
                  key={story.id}
                  onPress={() => comingSoon(story.userName)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  style={styles.storyRow}
                >
                  <View style={styles.storyAvatar}>
                    <Text style={styles.storyAvatarEmoji}>{story.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.storyName}>{story.userName}</Text>
                    <Text style={styles.storyHeadline}>{story.headline}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tip card */}
          <LinearGradient
            colors={["#059669", "#047857"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tipCard}
          >
            <Text style={styles.tipEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Pro Tip: Link a Circle</Text>
              <Text style={styles.tipBody}>
                When you link a Circle to a Goal, your Circle payouts
                automatically flow into your Goal — accelerating your progress
                with forced savings.
              </Text>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
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
    marginBottom: 24,
  },
  headerKicker: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  newGoalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  newGoalText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  summaryRow: { flexDirection: "row", justifyContent: "space-around" },
  summaryItem: { alignItems: "center" },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)" },
  summaryValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },

  contentWrap: { marginTop: -50, paddingHorizontal: 16 },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  filterPillActive: { backgroundColor: NAVY },
  filterText: { fontSize: 12, fontWeight: "600", color: MUTED },
  filterTextActive: { color: "#FFFFFF" },

  goalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  goalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  goalEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0FDFB",
    alignItems: "center",
    justifyContent: "center",
  },
  goalEmoji: { fontSize: 22 },
  goalName: { fontSize: 15, fontWeight: "600", color: NAVY },
  goalMeta: { fontSize: 11, color: MUTED, marginTop: 2 },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "600" },

  progressLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressBalance: { fontSize: 13, fontWeight: "600", color: NAVY },
  progressTarget: { fontSize: 12, color: MUTED },
  progressTrack: {
    height: 8,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 11, color: MUTED, marginTop: 4 },

  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  earnedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  earnedEmoji: { fontSize: 12 },
  earnedText: { fontSize: 12, color: GREEN, fontWeight: "500" },
  linkedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
  },
  linkedTagEmoji: { fontSize: 10 },
  linkedTagText: { fontSize: 10, color: "#1D4ED8", fontWeight: "500" },

  // Empty state
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, color: NAVY, marginTop: 16, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: MUTED, textAlign: "center", lineHeight: 21 },
  emptyButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: TEAL,
  },
  emptyButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  cardHeading: { fontSize: 15, fontWeight: "600", color: NAVY },
  linkAction: { fontSize: 12, fontWeight: "600", color: TEAL },

  // Stories
  storyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: "#F5F7FA",
    borderRadius: 12,
  },
  storyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  storyAvatarEmoji: { fontSize: 18 },
  storyName: { fontSize: 13, fontWeight: "600", color: NAVY },
  storyHeadline: { fontSize: 12, color: MUTED, marginTop: 2 },

  // Tip
  tipCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  tipEmoji: { fontSize: 24 },
  tipTitle: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  tipBody: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginTop: 6,
    lineHeight: 18,
  },
});
