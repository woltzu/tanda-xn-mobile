// ══════════════════════════════════════════════════════════════════════════════
// screens/TemplateGoalProgressScreen.tsx — template-driven goal progress view.
// ══════════════════════════════════════════════════════════════════════════════
//
// Shown instead of GoalDetailV2 for goals created from a goal_templates row.
// GoalCreateExpressScreen switches on `goal.metadata.template_milestones`:
// present → this screen, absent → the regular detail. The template metadata
// gets copied into user_savings_goals.metadata by the create_goal RPC
// (migration 302), and this screen just renders it — no server-side custom-
// milestone tracking. Achievement is a straight balance-vs-cumulative-
// threshold comparison; the celebration mechanism still fires on the fixed
// 10/25/50/75/90/100 arc via _record_goal_milestones and is orthogonal here.
//
// Layout:
//   * Header — goal emoji / name / target amount / progress bar.
//   * Milestones section — each row is one template stage (Foundation 30 /
//     Walls 25 / …) with the cumulative-completion percentage, the dollar
//     amount needed to reach it, and an Achieved/Locked pill.
//   * Cost breakdown — the {item, cost_cents} list from the template.
//   * "Add money" CTA — pre-fills GoalAddMoneySheet with the delta to the
//     next unachieved milestone.
//
// Falls back to a spinner-then-empty-state if the goal fetch returns nothing
// or the metadata blob is missing template_milestones. The router should
// never send us there without template metadata, but the guard keeps the
// screen from crashing on stale route params.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFocusEffect,
  useRoute,
  RouteProp,
} from "@react-navigation/native";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { useGoalActions } from "../hooks/useGoalActions";
import { useWallet } from "../context/WalletContext";
import GoalAddMoneySheet from "../components/GoalAddMoneySheet";
import type { Goal } from "../types/goals";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const GREEN = "#059669";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const CARD = "#FFFFFF";
const BG = "#F5F7FA";
const LOCK_BG = "#F3F4F6";
const LOCK_FG = "#9CA3AF";

type TemplateMilestoneRow = {
  name?: string;
  description?: string;
  default_percent?: number;
  verification_method?: string;
};

type CostBreakdownRow = {
  item?: string;
  cost_cents?: number;
  note?: string;
};

type Params = {
  goalId: string;
  /** Post-create flag from GoalCreateExpress — the caller passes it for
   *  parity with the GoalDetailV2 shape; we render the same fanfare
   *  banner when set. */
  justCreated?: boolean;
};
type RouteType = RouteProp<{ TemplateGoalProgress: Params }, "TemplateGoalProgress">;

// Icon rotation for template stages. Template rows carry a `name`
// (Foundation / Walls / Roof / Finishing / Venue / etc.) — we don't
// try to match each to a specific emoji since the template set is
// open-ended; a walking sequence keeps the timeline visually varied.
const STAGE_EMOJI = ["🏗️", "🧱", "🪟", "🛠️", "🎯", "🏆"] as const;

type Stage = {
  key: string;
  label: string;
  emoji: string;
  weight: number;      // per-phase share, from template
  cumulative: number;  // running sum
  amount: number;      // dollars at completion
  achieved: boolean;
};

function buildStages(
  rows: TemplateMilestoneRow[],
  target: number,
  balance: number,
): Stage[] {
  let cumulative = 0;
  return rows.map((row, idx) => {
    const weight = Number(row.default_percent) || 0;
    cumulative += weight;
    const percent = Math.min(100, Math.max(0, cumulative));
    const amount = Math.round((target * percent) / 100);
    return {
      key: `s${idx}_${(row.name ?? "stage").toLowerCase().replace(/\s+/g, "_")}`,
      label: row.name ?? `Stage ${idx + 1}`,
      emoji: STAGE_EMOJI[idx % STAGE_EMOJI.length],
      weight,
      cumulative: percent,
      amount,
      achieved: balance >= amount,
    };
  });
}

function formatUsd(dollars: number): string {
  return `$${Math.round(dollars).toLocaleString()}`;
}

export default function TemplateGoalProgressScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<RouteType>();
  const goalId = route.params?.goalId;

  const { fetchGoal } = useGoalActions();
  const { balance: walletBalance } = useWallet();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);
  const [sheetVisible, setSheetVisible] = useState(false);

  const load = useCallback(async () => {
    if (!goalId) return;
    const { data } = await fetchGoal(goalId);
    if (data?.goal) setGoal(data.goal);
    setLoading(false);
  }, [goalId, fetchGoal]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refetch on focus so returning from the Add-Money sheet's onSuccess (or
  // any other side-door) picks up fresh balance + achievement.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  const metadata = (goal?.metadata ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(metadata.template_milestones)
    ? (metadata.template_milestones as TemplateMilestoneRow[])
    : [];
  const cost = Array.isArray(metadata.template_cost_breakdown)
    ? (metadata.template_cost_breakdown as CostBreakdownRow[])
    : [];
  const templateName =
    typeof metadata.template_name === "string"
      ? (metadata.template_name as string)
      : undefined;

  if (!goal || rows.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <View style={styles.centerFill}>
          <Text style={styles.emptyEmoji}>🔎</Text>
          <Text style={styles.emptyTitle}>Template details missing</Text>
          <Text style={styles.emptyBody}>
            We couldn't load this goal's template. Open the goal from the
            hub for the standard detail view.
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

  const target = goal.targetAmount ?? 0;
  const balance = goal.currentBalance ?? 0;
  const progressPct = target > 0
    ? Math.min(100, Math.max(0, (balance / target) * 100))
    : 0;

  const stages = buildStages(rows, target, balance);
  const nextIndex = stages.findIndex((s) => !s.achieved);
  const nextStage = nextIndex >= 0 ? stages[nextIndex] : undefined;
  const amountToNext = nextStage
    ? Math.max(0, nextStage.amount - balance)
    : 0;
  const achievedCount = stages.filter((s) => s.achieved).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <LinearGradient colors={[NAVY, "#143654"]} style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              {templateName ? (
                <Text style={styles.headerKicker} numberOfLines={1}>
                  {templateName}
                </Text>
              ) : null}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {goal.emoji ? `${goal.emoji} ` : ""}
                {goal.name}
              </Text>
            </View>
          </View>

          <View style={styles.headerAmountRow}>
            <Text style={styles.headerAmount}>{formatUsd(balance)}</Text>
            <Text style={styles.headerAmountOf}>of {formatUsd(target)}</Text>
          </View>

          <View style={styles.headerProgressBg}>
            <View
              style={[
                styles.headerProgressFill,
                { width: `${progressPct}%` },
              ]}
            />
          </View>

          <View style={styles.headerCountsRow}>
            <View style={styles.headerCountItem}>
              <Text style={styles.headerCountValue}>{achievedCount}</Text>
              <Text style={styles.headerCountLabel}>Achieved</Text>
            </View>
            <View style={styles.headerCountDiv} />
            <View style={styles.headerCountItem}>
              <Text style={styles.headerCountValue}>
                {progressPct.toFixed(1)}%
              </Text>
              <Text style={styles.headerCountLabel}>Progress</Text>
            </View>
            <View style={styles.headerCountDiv} />
            <View style={styles.headerCountItem}>
              <Text style={[styles.headerCountValue, { color: TEAL }]}>
                {stages.length - achievedCount}
              </Text>
              <Text style={styles.headerCountLabel}>To go</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* ── Milestones ─────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.card}>
            {stages.map((s, idx) => (
              <View
                key={s.key}
                style={[
                  styles.stageRow,
                  idx < stages.length - 1 && styles.stageRowBorder,
                ]}
              >
                <View
                  style={[
                    styles.stageIcon,
                    s.achieved
                      ? { backgroundColor: `${GREEN}20` }
                      : { backgroundColor: LOCK_BG },
                  ]}
                >
                  {s.achieved ? (
                    <Ionicons name="checkmark" size={18} color={GREEN} />
                  ) : (
                    <Text style={styles.stageEmoji}>{s.emoji}</Text>
                  )}
                </View>

                <View style={styles.stageBody}>
                  <View style={styles.stageTopRow}>
                    <Text style={styles.stageLabel}>{s.label}</Text>
                    <Text style={styles.stagePercent}>
                      {s.cumulative.toFixed(0)}%
                    </Text>
                  </View>
                  <Text style={styles.stageAmount}>
                    {formatUsd(s.amount)}
                    <Text style={styles.stageAmountMuted}>
                      {" "}
                      cumulative
                    </Text>
                  </Text>
                  <View style={styles.stageProgressBg}>
                    <View
                      style={[
                        styles.stageProgressFill,
                        {
                          width: `${
                            s.amount > 0
                              ? Math.min(100, (balance / s.amount) * 100)
                              : 0
                          }%`,
                          backgroundColor: s.achieved ? GREEN : TEAL,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.stagePill}>
                    <Text
                      style={[
                        styles.stagePillText,
                        s.achieved
                          ? { color: GREEN }
                          : { color: LOCK_FG },
                      ]}
                    >
                      {s.achieved ? "Achieved" : "Locked"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* ── Cost breakdown ─────────────────────────────────── */}
          {cost.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Cost breakdown</Text>
              <View style={styles.card}>
                {cost.map((c, idx) => (
                  <View
                    key={`${c.item ?? "item"}-${idx}`}
                    style={[
                      styles.costRow,
                      idx < cost.length - 1 && styles.costRowBorder,
                    ]}
                  >
                    <Text style={styles.costItem} numberOfLines={2}>
                      {c.item ?? `Item ${idx + 1}`}
                    </Text>
                    <Text style={styles.costAmount}>
                      {formatUsd((c.cost_cents ?? 0) / 100)}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Justified motivation strip if this is the post-create landing.
              Same treatment GoalDetailV2 uses so the shape reads familiar. */}
          {route.params?.justCreated ? (
            <View style={styles.celebrateBanner}>
              <Ionicons name="sparkles" size={18} color={TEAL} />
              <Text style={styles.celebrateText}>
                Your goal is set — first deposit unlocks the timeline.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => setSheetVisible(true)}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>
            {nextStage
              ? `Add ${formatUsd(amountToNext)} to reach ${nextStage.label}`
              : "Add money"}
          </Text>
        </TouchableOpacity>
      </View>

      <GoalAddMoneySheet
        visible={sheetVisible}
        goalId={goal.id}
        goalName={goal.name}
        walletBalance={walletBalance}
        prefillAmount={nextStage ? amountToNext : undefined}
        onClose={() => setSheetVisible(false)}
        onSuccess={() => {
          setSheetVisible(false);
          void load();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerKicker: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },

  headerAmountRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  headerAmount: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  headerAmountOf: { color: "rgba(255,255,255,0.65)", fontSize: 14 },

  headerProgressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginTop: 12,
    overflow: "hidden",
  },
  headerProgressFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 4,
  },

  headerCountsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  headerCountItem: { alignItems: "center", flex: 1 },
  headerCountValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  headerCountLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    marginTop: 2,
  },
  headerCountDiv: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  content: { padding: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 10,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
  },

  stageRow: { flexDirection: "row", paddingVertical: 14, gap: 12 },
  stageRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stageEmoji: { fontSize: 18 },
  stageBody: { flex: 1 },
  stageTopRow: { flexDirection: "row", justifyContent: "space-between" },
  stageLabel: { fontSize: 14, fontWeight: "700", color: NAVY },
  stagePercent: { fontSize: 13, fontWeight: "700", color: TEAL },
  stageAmount: { fontSize: 12, color: NAVY, marginTop: 2, fontWeight: "600" },
  stageAmountMuted: { color: MUTED, fontWeight: "400" },
  stageProgressBg: {
    marginTop: 8,
    height: 5,
    borderRadius: 3,
    backgroundColor: LOCK_BG,
    overflow: "hidden",
  },
  stageProgressFill: { height: "100%", borderRadius: 3 },
  stagePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: LOCK_BG,
  },
  stagePillText: { fontSize: 10, fontWeight: "700" },

  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  costRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  costItem: { flex: 1, fontSize: 13, color: NAVY, marginRight: 12 },
  costAmount: { fontSize: 13, fontWeight: "700", color: NAVY },

  celebrateBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#E6FCF7",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  celebrateText: { fontSize: 12, color: NAVY, flex: 1, fontWeight: "600" },

  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: CARD,
  },
  primaryButton: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 6 },
  emptyBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  emptyButton: {
    borderWidth: 1,
    borderColor: NAVY,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  emptyButtonText: { color: NAVY, fontWeight: "700", fontSize: 13 },
});
