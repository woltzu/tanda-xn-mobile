import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import { RootStackParamList } from "../App";
// Bucket A — XnScoreContext is gone. Score reads from the shared bundle
// cache (same source as the Hub); history rows come from xnscore_history
// via the engine. summary (totalGains / totalLost) is computed inside
// useXnScoreHistory so we don't re-do that math here.
import {
  useXnScoreFromBundle,
  useXnScoreHistory,
} from "../hooks/useXnScore";

type XnScoreHistoryNavigationProp = StackNavigationProp<RootStackParamList>;

// Filter pills correspond to derived buckets over the real trigger_event
// taxonomy. "Gains" / "Losses" route on score_change sign; the rest match
// trigger_event prefixes (contribution_*, circle_*, payout_*, etc.).
type FilterType = "all" | "positive" | "negative" | "contributions" | "circles" | "wallet";

const FILTERS: { id: FilterType; labelKey: string }[] = [
  { id: "all",           labelKey: "xnscore_history.filter_all" },
  { id: "positive",      labelKey: "xnscore_history.filter_positive" },
  { id: "negative",      labelKey: "xnscore_history.filter_negative" },
  { id: "contributions", labelKey: "xnscore_history.filter_contributions" },
  { id: "circles",       labelKey: "xnscore_history.filter_circles" },
  { id: "wallet",        labelKey: "xnscore_history.filter_wallet" },
];

// Server-event-type icon map. Bucket A mirrors the same trigger_event
// tokens xnscore_history emits. Bucket B can replace these strings with
// localized labels.
function getEventStyle(triggerEvent: string) {
  if (triggerEvent.startsWith("contribution_on_time") || triggerEvent.startsWith("contribution_early")) {
    return { icon: "checkmark-circle" as const, color: "#10B981", bg: "#D1FAE5" };
  }
  if (triggerEvent.startsWith("contribution_late") || triggerEvent.includes("default")) {
    return { icon: "alert-circle" as const, color: "#DC2626", bg: "#FEE2E2" };
  }
  if (triggerEvent.startsWith("contribution_")) {
    return { icon: "cash-outline" as const, color: "#00C6AE", bg: "#F0FDFB" };
  }
  if (triggerEvent === "circle_completed") {
    return { icon: "trophy" as const, color: "#F59E0B", bg: "#FEF3C7" };
  }
  if (triggerEvent.startsWith("circle_")) {
    return { icon: "people" as const, color: "#1565C0", bg: "#E3F2FD" };
  }
  if (triggerEvent.startsWith("payout_")) {
    return { icon: "wallet" as const, color: "#1565C0", bg: "#E3F2FD" };
  }
  if (triggerEvent.startsWith("vouch_")) {
    return { icon: "shield-checkmark" as const, color: "#10B981", bg: "#D1FAE5" };
  }
  if (triggerEvent.startsWith("tenure_") || triggerEvent.includes("growth")) {
    return { icon: "trending-up" as const, color: "#6366F1", bg: "#EEF2FF" };
  }
  if (triggerEvent.startsWith("inactivity_") || triggerEvent.includes("decay")) {
    return { icon: "trending-down" as const, color: "#F59E0B", bg: "#FEF3C7" };
  }
  if (triggerEvent.startsWith("referral_") || triggerEvent.startsWith("streak_")) {
    return { icon: "gift" as const, color: "#EC4899", bg: "#FCE7F3" };
  }
  if (triggerEvent === "initial_score") {
    return { icon: "star" as const, color: "#F59E0B", bg: "#FEF3C7" };
  }
  return { icon: "ellipse" as const, color: "#6B7280", bg: "#F5F7FA" };
}

function categoryFor(triggerEvent: string): "contributions" | "circles" | "wallet" | "other" {
  if (triggerEvent.startsWith("contribution_")) return "contributions";
  if (triggerEvent.startsWith("circle_") || triggerEvent.startsWith("payout_")) return "circles";
  if (triggerEvent.startsWith("funds_") || triggerEvent.startsWith("withdrawal") || triggerEvent.startsWith("send_")) return "wallet";
  return "other";
}

function humanize(triggerEvent: string): string {
  return triggerEvent
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function XnScoreHistoryScreen() {
  const navigation = useNavigation<XnScoreHistoryNavigationProp>();
  const { t } = useTranslation();

  const { score, loading: scoreLoading } = useXnScoreFromBundle();
  // 100 rows covers a few months of activity for a typical user. The
  // existing hook returns a `summary` block with gains/losses tallies so
  // the header summary cards read straight from there.
  const { history, summary, loading: historyLoading, refetch: refetchHistory } =
    useXnScoreHistory(undefined, 100);

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchHistory();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return (history ?? []).filter((event: any) => {
      const triggerEvent = String(event.trigger_event ?? "");
      const change = Number(event.score_change ?? 0);
      switch (activeFilter) {
        case "positive":
          return change > 0;
        case "negative":
          return change < 0;
        case "contributions":
          return categoryFor(triggerEvent) === "contributions";
        case "circles":
          return categoryFor(triggerEvent) === "circles";
        case "wallet":
          return categoryFor(triggerEvent) === "wallet";
        default:
          return true;
      }
    });
  }, [history, activeFilter]);

  // Group by ISO date (yyyy-mm-dd) so events on the same day collapse
  // under a single header. Keys are insertion-ordered, matching the
  // hook's descending-by-created_at sort.
  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredHistory.forEach((event: any) => {
      const iso = event.created_at as string | null;
      const dateKey = iso ? iso.slice(0, 10) : "—";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(event);
    });
    return groups;
  }, [filteredHistory]);

  const totalGained = summary?.totalGained != null ? Number(summary.totalGained.toFixed(1)) : 0;
  const totalLost = summary?.totalLost != null ? Number(summary.totalLost.toFixed(1)) : 0;
  const initialLoading = scoreLoading && historyLoading && history.length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("xnscore_history.header_title")}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("xnscore_history.label_current")}</Text>
            <Text style={styles.summaryValue}>{score ?? "—"}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("xnscore_history.label_total_gained")}</Text>
            <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>+{totalGained}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t("xnscore_history.label_total_lost")}</Text>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>-{totalLost}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter pills */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                activeFilter === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => setActiveFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.id && styles.filterTextActive,
                ]}
              >
                {t(filter.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00C6AE" />}
      >
        {initialLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#00C6AE" />
            <Text style={styles.loadingText}>{t("xnscore_history.loading")}</Text>
          </View>
        ) : Object.keys(groupedHistory).length > 0 ? (
          Object.entries(groupedHistory).map(([dateKey, events]) => (
            <View key={dateKey} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{formatDate(dateKey)}</Text>
              {events.map((event: any, idx: number) => {
                const triggerEvent = String(event.trigger_event ?? "");
                const eventStyle = getEventStyle(triggerEvent);
                const change = Number(event.score_change ?? 0);
                return (
                  <View key={event.id ?? `${dateKey}-${idx}`} style={styles.eventCard}>
                    <View style={styles.eventLeft}>
                      <View style={[styles.eventIcon, { backgroundColor: eventStyle.bg }]}>
                        <Ionicons name={eventStyle.icon} size={20} color={eventStyle.color} />
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventDescription}>{humanize(triggerEvent)}</Text>
                        {event.velocity_capped ? (
                          <Text style={styles.eventBadge}>
                            {t("xnscore_history.velocity_capped")}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.eventRight}>
                      <Text
                        style={[
                          styles.eventPoints,
                          { color: change >= 0 ? "#00C6AE" : "#DC2626" },
                        ]}
                      >
                        {change >= 0 ? "+" : ""}{Number(change.toFixed(2))}
                      </Text>
                      <Text style={styles.eventPointsLabel}>
                        {t("xnscore_history.points_label")}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t("xnscore_history.empty_title")}</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === "all"
                ? t("xnscore_history.empty_body_all")
                : t("xnscore_history.empty_body_filtered")}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  placeholder: { width: 40 },

  summaryRow: { flexDirection: "row", gap: 10 },
  summaryCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 12, alignItems: "center" },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  filterContainer: { backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F5F7FA", marginRight: 8 },
  filterButtonActive: { backgroundColor: "#0A2342" },
  filterText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  filterTextActive: { color: "#FFFFFF" },

  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  loadingState: { paddingVertical: 60, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 13, color: "#6B7280" },

  dateGroup: { marginBottom: 20 },
  dateHeader: { fontSize: 13, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },
  eventCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eventLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  eventIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  eventInfo: { flex: 1 },
  eventDescription: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 2 },
  eventBadge: { fontSize: 11, fontWeight: "600", color: "#F59E0B" },
  eventRight: { alignItems: "flex-end" },
  eventPoints: { fontSize: 16, fontWeight: "700" },
  eventPointsLabel: { fontSize: 11, color: "#9CA3AF" },

  emptyState: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: "#6B7280", textAlign: "center", paddingHorizontal: 24 },
});
