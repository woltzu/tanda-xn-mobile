// ═══════════════════════════════════════════════════════════════════════════════
// DecisionHistoryScreen — Phase D3 of feat(explainable-ai) #83
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lists the member's AI decisions from `ai_decisions` table via the existing
// useDecisionHistory hook (which subscribes to realtime updates on the
// table). Filter chips for time window (7d / 30d / all) and decision type.
// Cards render the localized `rendered_explanation` directly — the
// migration-110 recorder already handled language resolution + template
// substitution before the row was written, so the screen is just display.
//
// Real entry points that produce decisions:
//   * process_advance_request → liquidity_denial (migration 111)
//   * evaluate_member_tier → tier_advancement / tier_demotion (migration 111)
// Future decision points (xn_score adjustments, circle rejections,
// intervention messages, …) will start populating the same list.
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import {
  useDecisionHistory,
  type DecisionType,
  type AIDecision,
} from "../hooks/useExplainableAI";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#10B981",
  amber: "#D97706",
  red: "#DC2626",
  blue: "#2563EB",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F3F4F6",
  white: "#FFFFFF",
};

type Window = "7d" | "30d" | "all";

// Tier-style metadata per decision_type — keeps the badge + icon
// consistent across rows of the same kind. Label resolution happens at
// the call site via t(`decision_history.type_${type}`) so the
// dictionary stays loc-clean.
const TYPE_STYLE: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  liquidity_denial: {
    icon: "ban-outline",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
  tier_advancement: {
    icon: "trending-up",
    color: "#065F46",
    bg: "#D1FAE5",
  },
  tier_demotion: {
    icon: "trending-down",
    color: "#92400E",
    bg: "#FEF3C7",
  },
  xnscore_increase: {
    icon: "arrow-up-circle-outline",
    color: "#065F46",
    bg: "#D1FAE5",
  },
  xnscore_decrease: {
    icon: "arrow-down-circle-outline",
    color: "#92400E",
    bg: "#FEF3C7",
  },
  circle_join_rejection: {
    icon: "close-circle-outline",
    color: "#991B1B",
    bg: "#FEE2E2",
  },
  intervention_message: {
    icon: "chatbubble-ellipses-outline",
    color: "#1E40AF",
    bg: "#DBEAFE",
  },
  payout_position: {
    icon: "list-outline",
    color: "#374151",
    bg: "#F3F4F6",
  },
  honor_score_change: {
    icon: "ribbon-outline",
    color: "#065F46",
    bg: "#D1FAE5",
  },
  stress_score_change: {
    icon: "pulse-outline",
    color: "#9A3412",
    bg: "#FFEDD5",
  },
  mood_drift_change: {
    icon: "happy-outline",
    color: "#92400E",
    bg: "#FEF3C7",
  },
};

function styleFor(type: string) {
  return (
    TYPE_STYLE[type] ?? {
      icon: "ellipsis-horizontal-circle-outline" as const,
      color: COLORS.muted,
      bg: "#F3F4F6",
    }
  );
}

function labelFor(type: string, tr: (k: string, opts?: any) => string): string {
  const key = `decision_history.type_${type}`;
  const translated = tr(key);
  if (translated !== key) return translated;
  return type.replace(/_/g, " ");
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function DecisionHistoryScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [windowFilter, setWindowFilter] = useState<Window>("30d");
  const [typeFilter, setTypeFilter] = useState<DecisionType | "all">("all");
  const [refreshing, setRefreshing] = useState(false);

  const filters = useMemo(() => {
    const f: { fromDate?: string; decisionType?: DecisionType; limit?: number } = {
      limit: 100,
    };
    if (windowFilter !== "all") {
      const days = windowFilter === "7d" ? 7 : 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      f.fromDate = d.toISOString();
    }
    if (typeFilter !== "all") f.decisionType = typeFilter;
    return f;
  }, [windowFilter, typeFilter]);

  const { decisions, loading, error, refetch, totalDecisions } =
    useDecisionHistory(user?.id, filters);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Group by decision_type for the section headers
  const grouped = useMemo(() => {
    const map = new Map<string, AIDecision[]>();
    for (const d of decisions) {
      const k = d.decisionType ?? "unknown";
      const arr = map.get(k) ?? [];
      arr.push(d);
      map.set(k, arr);
    }
    // Sort sections by latest decision within them, desc
    return Array.from(map.entries()).sort((a, b) => {
      const aLatest = new Date(a[1][0]?.createdAt ?? 0).getTime();
      const bLatest = new Date(b[1][0]?.createdAt ?? 0).getTime();
      return bLatest - aLatest;
    });
  }, [decisions]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("decision_history.header")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.teal}
          />
        }
      >
        {/* Window filter */}
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>{t("decision_history.filter_label")}</Text>
          <View style={styles.segment}>
            {(["7d", "30d", "all"] as Window[]).map((w) => (
              <TouchableOpacity
                key={w}
                style={[
                  styles.segItem,
                  windowFilter === w && styles.segItemActive,
                ]}
                onPress={() => setWindowFilter(w)}
              >
                <Text
                  style={[
                    styles.segText,
                    windowFilter === w && styles.segTextActive,
                  ]}
                >
                  {w === "7d"
                    ? t("decision_history.filter_7d")
                    : w === "30d"
                    ? t("decision_history.filter_30d")
                    : t("decision_history.filter_all")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Type filter — chip strip */}
        <View style={styles.chipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {(
              [
                "all",
                "liquidity_denial",
                "tier_advancement",
                "tier_demotion",
                "xnscore_increase",
                "xnscore_decrease",
                "honor_score_change",
                "stress_score_change",
                "mood_drift_change",
                "circle_join_rejection",
              ] as Array<DecisionType | "all">
            ).map((type) => {
              const s = type === "all" ? null : styleFor(type);
              const active = typeFilter === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    active && {
                      backgroundColor: s ? s.color : COLORS.navy,
                      borderColor: s ? s.color : COLORS.navy,
                    },
                  ]}
                  onPress={() => setTypeFilter(type)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active && { color: "#FFFFFF" },
                    ]}
                  >
                    {type === "all"
                      ? t("decision_history.all_types_chip")
                      : labelFor(type, t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Body */}
        {loading && !refreshing && decisions.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.teal} />
            <Text style={styles.muted}>{t("decision_history.loading")}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : decisions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="document-text-outline" size={36} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>{t("decision_history.empty_title")}</Text>
            <Text style={styles.emptyBody}>
              {t("decision_history.empty_body")}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.summary}>
              {t("decision_history.count_in_window", {
                count: totalDecisions,
              })}
            </Text>

            {grouped.map(([type, rows]) => {
              const s = styleFor(type);
              return (
                <View key={type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: s.bg }]}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                    </View>
                    <Text style={styles.sectionTitle}>{labelFor(type, t)}</Text>
                    <Text style={styles.sectionCount}>
                      {rows.length}
                    </Text>
                  </View>

                  {rows.map((d) => (
                    <View
                      key={d.id}
                      style={[
                        styles.card,
                        { borderLeftColor: s.color },
                      ]}
                    >
                      {d.renderedExplanation ? (
                        <Text style={styles.cardExplanation}>
                          {d.renderedExplanation}
                        </Text>
                      ) : (
                        <Text style={styles.cardExplanationMuted}>
                          {t("decision_history.no_render_fallback")}
                        </Text>
                      )}
                      <View style={styles.cardMeta}>
                        {d.decisionValue && (
                          <Text style={styles.metaValue}>
                            {t("decision_history.value_label")} {d.decisionValue}
                          </Text>
                        )}
                        <View style={{ flex: 1 }} />
                        <Text style={styles.metaTime}>
                          {fmtDate(d.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },

  filterRow: { marginBottom: 12 },
  filterLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 3,
    gap: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  segItemActive: { backgroundColor: COLORS.navy },
  segText: { fontSize: 12, fontWeight: "700", color: COLORS.muted },
  segTextActive: { color: "#FFFFFF" },

  chipsRow: { marginBottom: 14 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipText: { fontSize: 12, color: COLORS.navy, fontWeight: "600" },

  summary: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 10,
  },

  section: { marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.navy,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardExplanation: {
    fontSize: 14,
    color: COLORS.navy,
    lineHeight: 20,
  },
  cardExplanationMuted: {
    fontSize: 13,
    fontStyle: "italic",
    color: COLORS.muted,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  metaValue: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: "monospace",
  },
  metaTime: {
    fontSize: 11,
    color: COLORS.muted,
  },

  loadingBox: { alignItems: "center", gap: 8, paddingVertical: 32 },
  muted: { color: COLORS.muted, fontSize: 13 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: "#991B1B" },
  emptyBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 4,
  },
  emptyBody: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 19,
  },
});
