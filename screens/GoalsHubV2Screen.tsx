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
// NAVIGATION — there is no back button (hub screen). Tapping a goal →
// GoalDetailV2 (forwarding the full goal object so the V2 detail screen
// has data until fetch-by-id lands), "+ New Goal" / empty-state →
// GoalCategorySelect, and stories "See All" / a story row → GoalStories.
//
// Route params (all optional — defaults applied for standalone preview).
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useGoalActions } from "../hooks/useGoalActions";
import type { Goal } from "../types/goals";

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
  // P1 (Bucket B.4): expose the DB goal_status so the new Completed
  // filter pill can split the list.
  status: string;
};

// P1 (Bucket B): the screen has no remaining route-param inputs — the
// goals list, totals, and stories all derive from server state. Kept
// the type alias so the RouteProp doesn't have to be removed everywhere
// at once, but the body is empty.
type GoalsHubV2Params = Record<string, never>;
type GoalsHubV2RouteProp = RouteProp<
  { GoalsHubV2: GoalsHubV2Params },
  "GoalsHubV2"
>;

// P1 (Bucket B): the prior DEFAULT_GOALS mock array seeded the hub with
// fake "First Home in Atlanta" / "US Citizenship" / "Emergency Fund"
// cards when no route param overrode it. Removed — the empty-state
// renders correctly via the cold-load path, and there's no longer a
// route param that could request the mock fallback.

// P0: the prior `DEFAULT_STORIES` array hardcoded "Aminata D." / "Kwame O."
// as the production fallback for an Achievement Stories card. The card
// has no backing data source today, so it was always showing fake names
// to real users. Removed entirely until a real story feed is wired.

// i18n: filter labels resolve per-render via t() at the call site.
const FILTERS = [
  { key: "all", labelKey: "goals_hub_v2.filter_all" },
  { key: "on_track", labelKey: "goals_hub_v2.filter_on_track" },
  { key: "needs_attention", labelKey: "goals_hub_v2.filter_needs_attention" },
  // P1 (Bucket B.4): completed goals still show in "All" but the
  // dedicated pill lets the user find archived wins quickly.
  { key: "completed", labelKey: "goals_hub_v2.filter_completed" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// Map a DB-backed Goal (cents-aware, raw) into the HubGoal shape the
// existing render code expects. Heuristics: progressPercent is straight
// math; `isOnTrack` defaults to true when there's no target_date (we can't
// assess pace without one) and otherwise checks whether the current trajectory
// (current balance + monthly contribution × months remaining) reaches the
// target by the deadline.
function dbGoalToHubGoal(g: Goal): HubGoal {
  const target = g.targetAmount ?? 0;
  const balance = g.currentBalance ?? 0;
  const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;

  let isOnTrack = true;
  if (g.targetDate && target > 0) {
    const due = new Date(g.targetDate);
    const now = new Date();
    const monthsRemaining = Math.max(
      0,
      (due.getFullYear() - now.getFullYear()) * 12 +
        (due.getMonth() - now.getMonth()),
    );
    const projected = balance + (g.monthlyContribution ?? 0) * monthsRemaining;
    isOnTrack = projected >= target;
  }

  // Format target date as "Mon YYYY" (short). Fall back to em dash when no
  // deadline is set so the card still renders cleanly.
  let targetDate = "—";
  if (g.targetDate) {
    try {
      const d = new Date(g.targetDate);
      targetDate = d.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      });
    } catch {
      /* keep — */
    }
  }

  return {
    id: g.id,
    name: g.name,
    emoji: g.emoji || (g.savingsType === "emergency" ? "🛡️" : g.savingsType === "locked" ? "🔒" : "💰"),
    category: g.category || "Savings",
    balance,
    target,
    interestEarned: g.interestEarned ?? 0,
    progressPercent: progress,
    isOnTrack,
    // P0: expose the linked-circle FK so the 🔗 Linked badge on each card
    // can light up. We don't fetch the circle name here (would require a
    // join), but the badge text is a generic "Linked" tag — the FK
    // presence is enough.
    linkedCircle: g.linkedCircleId ?? null,
    monthlyContribution: g.monthlyContribution ?? 0,
    targetDate,
    status: g.status,
  };
}

export default function GoalsHubV2Screen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const {
    fetchGoals,
    fetchSpendingSuggestions,
    dismissSpendingSuggestion,
  } = useGoalActions();

  // P2 (migration 155) — server-computed spending insights. Today
  // populated manually for demo; a future weekly Edge Function will
  // fill spending_patterns from money_transfers + contributions.
  // Empty array = no banner; null = still loading.
  const [suggestions, setSuggestions] = useState<
    | { id: string; category: string; monthlyAvg: number; suggestedSave: number }[]
    | null
  >(null);

  const loadSuggestions = useCallback(async () => {
    const { data } = await fetchSpendingSuggestions();
    if (data) {
      setSuggestions(
        data.map((s) => ({
          id: s.id,
          category: s.category,
          monthlyAvg: s.monthlyAvg,
          suggestedSave: s.suggestedSave,
        })),
      );
    } else {
      setSuggestions([]);
    }
  }, [fetchSpendingSuggestions]);

  const handleSuggestionAccept = (s: {
    id: string;
    category: string;
    suggestedSave: number;
  }) => {
    navigation.navigate(Routes.GoalCreateExpress as any, {
      suggestedName: t("goals_hub_v2.spending_default_name", {
        category: s.category,
      }),
      suggestedAmount: s.suggestedSave,
    });
  };

  const handleSuggestionDismiss = async (id: string) => {
    const { data } = await dismissSpendingSuggestion(id);
    if (data) {
      setSuggestions((prev) => (prev ?? []).filter((s) => s.id !== id));
    }
  };

  // Real goals from the DB. Replaces the prior route-param + mock fallback
  // that hid newly-created goals from the user — the hub was showing
  // `DEFAULT_GOALS` until something explicitly passed `goals` via params,
  // which the express create flow never did.
  const [dbGoals, setDbGoals] = useState<HubGoal[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchGoals();
    if (error) {
      console.warn("[GoalsHubV2] fetchGoals failed:", (error as any)?.message);
      setDbGoals([]);
    } else {
      // Hide soft-deleted / closed goals so the hub only shows active
      // and completed targets the user actually cares about.
      const active = (data ?? []).filter(
        (g) => g.status === "active" || g.status === "completed",
      );
      setDbGoals(active.map(dbGoalToHubGoal));
    }
    setLoading(false);
  }, [fetchGoals]);

  // Refetch every time the hub comes into focus — covers the "create new
  // goal then navigate back" case the user reported (Trip To Bali wasn't
  // showing).
  useFocusEffect(
    useCallback(() => {
      loadGoals();
      loadSuggestions();
    }, [loadGoals, loadSuggestions]),
  );

  const goals = dbGoals ?? [];

  // Live totals derived from real goals. Falls back to a reasonable empty
  // state when the user has no goals yet.
  const totalSaved = goals.reduce((acc, g) => acc + g.balance, 0);
  const totalInterestEarned = goals.reduce(
    (acc, g) => acc + g.interestEarned,
    0,
  );

  const [filter, setFilter] = useState<FilterKey>("all");

  const filteredGoals = goals.filter((g) => {
    if (filter === "on_track") return g.status !== "completed" && g.isOnTrack;
    if (filter === "needs_attention")
      return g.status !== "completed" && !g.isOnTrack;
    if (filter === "completed") return g.status === "completed";
    return true;
  });

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
              <Text style={styles.headerKicker}>{t("goals_hub_v2.kicker")}</Text>
              <Text style={styles.headerTitle}>{t("goals_hub_v2.title")}</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate(Routes.GoalCreateExpress)}
              accessibilityRole="button"
              accessibilityLabel="New goal"
              style={styles.newGoalButton}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.newGoalText}>{t("goals_hub_v2.new_goal")}</Text>
            </TouchableOpacity>
          </View>

          {/* Total summary */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t("goals_hub_v2.total_saved")}</Text>
              <Text style={styles.summaryValue}>
                $
                {totalSaved.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>{t("goals_hub_v2.interest_earned")}</Text>
              <Text style={[styles.summaryValue, { color: TEAL }]}>
                +${totalInterestEarned.toFixed(2)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ===== CONTENT ===== */}
        <View style={styles.contentWrap}>
          {/* P2 — Spending-pattern suggestion banners. Today the
              spending_patterns table is hand-seeded for demo; a future
              suggest-goals-from-spending edge function will fill it
              from money_transfers + contributions weekly. Caller can
              dismiss each row; the partial index keeps the read cheap. */}
          {suggestions && suggestions.length > 0 ? (
            <View style={{ marginBottom: 16, gap: 10 }}>
              {suggestions.map((s) => (
                <View key={s.id} style={styles.suggestionBanner}>
                  <View style={styles.suggestionIcon}>
                    <Ionicons name="bulb-outline" size={18} color="#0A2342" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionTitle}>
                      {t("goals_hub_v2.spending_title", {
                        category: s.category,
                        amount: `$${Math.round(s.monthlyAvg).toLocaleString()}`,
                      })}
                    </Text>
                    <Text style={styles.suggestionBody}>
                      {t("goals_hub_v2.spending_body", {
                        amount: `$${Math.round(s.suggestedSave).toLocaleString()}`,
                      })}
                    </Text>
                    <View style={styles.suggestionActions}>
                      <TouchableOpacity
                        style={styles.suggestionPrimary}
                        onPress={() => handleSuggestionAccept(s)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.suggestionPrimaryText}>
                          {t("goals_hub_v2.spending_cta_create")}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.suggestionGhost}
                        onPress={() => handleSuggestionDismiss(s.id)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.suggestionGhostText}>
                          {t("goals_hub_v2.spending_cta_dismiss")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

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
                    {t(tab.labelKey)}
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
                onPress={() =>
                  // P1 (Bucket B.7): goalId only — the detail screen
                  // fetches the goal itself rather than rendering a
                  // potentially-stale passed object.
                  navigation.navigate(Routes.GoalDetailV2, {
                    goalId: goal.id,
                  })
                }
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
                        {goal.category} • {t("goals_hub_v2.target_prefix")}: {goal.targetDate}
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
                      {goal.isOnTrack ? t("goals_hub_v2.status_on_track") : t("goals_hub_v2.status_behind")}
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
                      {t("goals_hub_v2.of_target", { amount: goal.target.toLocaleString() })}
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
                    {t("goals_hub_v2.percent_complete", { percent: goal.progressPercent })}
                  </Text>
                </View>

                {/* Footer */}
                <View style={styles.goalFooter}>
                  <View style={styles.earnedRow}>
                    <Text style={styles.earnedEmoji}>📈</Text>
                    <Text style={styles.earnedText}>
                      {t("goals_hub_v2.earned_suffix", { amount: goal.interestEarned.toFixed(2) })}
                    </Text>
                  </View>
                  {goal.linkedCircle && (
                    <View style={styles.linkedTag}>
                      <Text style={styles.linkedTagEmoji}>🔗</Text>
                      <Text style={styles.linkedTagText}>{t("goals_hub_v2.linked_tag")}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Loading indicator — only while the initial fetch is in flight
              AND we don't yet have any data to show. Avoids the empty-state
              flash that confused users into thinking their goals were gone. */}
          {loading && dbGoals === null ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={TEAL} />
            </View>
          ) : null}

          {/* Phase 4 — template browser banner. Visible to users who
              already have goals (the empty state has its own secondary
              button). Subtle enough not to compete with the goals list. */}
          {!loading && filteredGoals.length > 0 ? (
            <TouchableOpacity
              style={styles.templateBanner}
              onPress={() => navigation.navigate(Routes.GoalTemplateBrowser as any)}
              accessibilityRole="button"
            >
              <Text style={styles.templateBannerIcon}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.templateBannerTitle}>
                  {t("goals_hub_v2.template_banner_title")}
                </Text>
                <Text style={styles.templateBannerBody}>
                  {t("goals_hub_v2.template_banner_body")}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#5B21B6" />
            </TouchableOpacity>
          ) : null}

          {/* Empty state */}
          {!loading && filteredGoals.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🎯</Text>
              <Text style={styles.emptyTitle}>{t("goals_hub_v2.empty_title")}</Text>
              <Text style={styles.emptyBody}>
                {t("goals_hub_v2.empty_body")}
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate(Routes.GoalCreateExpress)}
                accessibilityRole="button"
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>
                  {t("goals_hub_v2.empty_cta")}
                </Text>
              </TouchableOpacity>
              {/* Phase 4 — secondary action: browse templates. Surfaces
                  the diaspora-dream templates (house / wedding / business
                  / school) to first-time users who don't know where to
                  start. */}
              <TouchableOpacity
                onPress={() => navigation.navigate(Routes.GoalTemplateBrowser as any)}
                accessibilityRole="button"
                style={styles.emptyTemplateButton}
              >
                <Text style={styles.emptyTemplateButtonText}>
                  {t("goals_hub_v2.empty_template_cta")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* P0: Achievement Stories card removed. The prior render
              backed the card with `DEFAULT_STORIES` (hardcoded
              "Aminata D." / "Kwame O." names) because no real story
              feed exists yet. Restore this card when a real source
              lands; the styles for storyRow / storyAvatar / storyName /
              storyHeadline remain in the StyleSheet for that future
              wire-up. */}

          {/* Tip card */}
          <LinearGradient
            colors={["#059669", "#047857"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tipCard}
          >
            <Text style={styles.tipEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{t("goals_hub_v2.tip_title")}</Text>
              <Text style={styles.tipBody}>{t("goals_hub_v2.tip_body")}</Text>
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

  // P2 — spending-pattern suggestion banner
  suggestionBanner: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 4 },
  suggestionBody: { fontSize: 12, color: MUTED, marginBottom: 10, lineHeight: 17 },
  suggestionActions: { flexDirection: "row", gap: 8 },
  suggestionPrimary: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: NAVY,
  },
  suggestionPrimaryText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  suggestionGhost: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  suggestionGhostText: { fontSize: 12, fontWeight: "700", color: MUTED },

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

  // Loading row — slim flex shown above the goal list during the initial
  // fetch. Brief; goes away as soon as fetchGoals() resolves.
  loadingRow: {
    paddingVertical: 24,
    alignItems: "center",
  },

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
  emptyTemplateButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyTemplateButtonText: { fontSize: 13, fontWeight: "700", color: "#5B21B6" },
  templateBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F5F3FF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  templateBannerIcon: { fontSize: 22 },
  templateBannerTitle: { fontSize: 13, fontWeight: "800", color: "#5B21B6" },
  templateBannerBody: { fontSize: 11, color: "#5B21B6", marginTop: 2 },

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
