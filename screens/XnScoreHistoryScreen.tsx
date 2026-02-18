import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../App";
import { useXnScore, ScoreEvent, ScoreEventType } from "../context/XnScoreContext";

type XnScoreHistoryNavigationProp = StackNavigationProp<RootStackParamList>;

type FilterType = "all" | "positive" | "negative" | "contributions" | "circles" | "wallet";

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "positive", label: "Gains" },
  { id: "negative", label: "Losses" },
  { id: "contributions", label: "Contributions" },
  { id: "circles", label: "Circles" },
  { id: "wallet", label: "Wallet" },
];

export default function XnScoreHistoryScreen() {
  const navigation = useNavigation<XnScoreHistoryNavigationProp>();
  const { score, history, tips } = useXnScore();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const getEventIcon = (type: ScoreEventType) => {
    switch (type) {
      case "contribution_made":
        return { icon: "cash-outline", color: "#00C6AE", bg: "#F0FDFB" };
      case "contribution_on_time":
        return { icon: "checkmark-circle", color: "#10B981", bg: "#D1FAE5" };
      case "contribution_early":
        return { icon: "timer-outline", color: "#059669", bg: "#D1FAE5" };
      case "contribution_late":
        return { icon: "alert-circle", color: "#DC2626", bg: "#FEE2E2" };
      case "payout_received":
        return { icon: "wallet", color: "#1565C0", bg: "#E3F2FD" };
      case "circle_joined":
        return { icon: "people", color: "#1565C0", bg: "#E3F2FD" };
      case "circle_completed":
        return { icon: "trophy", color: "#F59E0B", bg: "#FEF3C7" };
      case "referral_bonus":
        return { icon: "gift", color: "#EC4899", bg: "#FCE7F3" };
      case "streak_bonus":
        return { icon: "flame", color: "#F59E0B", bg: "#FEF3C7" };
      case "funds_added":
        return { icon: "add-circle", color: "#00C6AE", bg: "#F0FDFB" };
      case "withdrawal":
        return { icon: "arrow-up-circle", color: "#F59E0B", bg: "#FEF3C7" };
      case "send_money":
        return { icon: "send", color: "#6366F1", bg: "#EEF2FF" };
      case "account_verified":
        return { icon: "shield-checkmark", color: "#10B981", bg: "#D1FAE5" };
      case "profile_completed":
        return { icon: "person-circle", color: "#6366F1", bg: "#EEF2FF" };
      case "initial_score":
        return { icon: "star", color: "#F59E0B", bg: "#FEF3C7" };
      default:
        return { icon: "ellipse", color: "#6B7280", bg: "#F5F7FA" };
    }
  };

  const getEventCategory = (type: ScoreEventType): string => {
    switch (type) {
      case "contribution_made":
      case "contribution_on_time":
      case "contribution_early":
      case "contribution_late":
        return "contributions";
      case "circle_joined":
      case "circle_completed":
      case "payout_received":
        return "circles";
      case "funds_added":
      case "withdrawal":
      case "send_money":
        return "wallet";
      default:
        return "other";
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((event) => {
      switch (activeFilter) {
        case "positive":
          return event.points > 0;
        case "negative":
          return event.points < 0;
        case "contributions":
          return getEventCategory(event.type) === "contributions";
        case "circles":
          return getEventCategory(event.type) === "circles";
        case "wallet":
          return getEventCategory(event.type) === "wallet";
        default:
          return true;
      }
    });
  }, [history, activeFilter]);

  // Group events by date
  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: ScoreEvent[] } = {};
    filteredHistory.forEach((event) => {
      const dateKey = event.date;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(event);
    });
    return groups;
  }, [filteredHistory]);

  // Calculate totals
  const totalGains = history.filter((e) => e.points > 0).reduce((sum, e) => sum + e.points, 0);
  const totalLosses = Math.abs(history.filter((e) => e.points < 0).reduce((sum, e) => sum + e.points, 0));

  const incompleteTips = tips.filter((tip) => !tip.completed);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>XnScore™ History</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Current Score</Text>
            <Text style={styles.summaryValue}>{score}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Gained</Text>
            <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>+{totalGains}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Lost</Text>
            <Text style={[styles.summaryValue, { color: "#DC2626" }]}>-{totalLosses}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
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
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tips Section - Only show on "all" filter */}
        {activeFilter === "all" && incompleteTips.length > 0 && (
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>Tips to Earn More Points</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tipsScroll}
            >
              {incompleteTips.slice(0, 4).map((tip) => (
                <View key={tip.id} style={styles.tipCard}>
                  <View style={styles.tipHeader}>
                    <Ionicons name="bulb" size={18} color="#F59E0B" />
                    <Text style={styles.tipPoints}>+{tip.potentialPoints}</Text>
                  </View>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.tipDescription} numberOfLines={2}>
                    {tip.description}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* History List */}
        {Object.keys(groupedHistory).length > 0 ? (
          Object.entries(groupedHistory).map(([date, events]) => (
            <View key={date} style={styles.dateGroup}>
              <Text style={styles.dateHeader}>{date}</Text>
              {events.map((event) => {
                const eventStyle = getEventIcon(event.type);
                return (
                  <View key={event.id} style={styles.eventCard}>
                    <View style={styles.eventLeft}>
                      <View style={[styles.eventIcon, { backgroundColor: eventStyle.bg }]}>
                        <Ionicons
                          name={eventStyle.icon as keyof typeof Ionicons.glyphMap}
                          size={20}
                          color={eventStyle.color}
                        />
                      </View>
                      <View style={styles.eventInfo}>
                        <Text style={styles.eventDescription}>{event.description}</Text>
                        <Text style={styles.eventType}>
                          {event.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.eventRight}>
                      <Text
                        style={[
                          styles.eventPoints,
                          { color: event.points >= 0 ? "#00C6AE" : "#DC2626" },
                        ]}
                      >
                        {event.points >= 0 ? "+" : ""}{event.points}
                      </Text>
                      <Text style={styles.eventPointsLabel}>points</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No History</Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === "all"
                ? "Your score history will appear here as you use TandaXn"
                : `No ${activeFilter} events found`}
            </Text>
          </View>
        )}

        {/* Score Legend - XnScore™ V3.0 Algorithm */}
        <View style={styles.legendSection}>
          <Text style={styles.sectionTitle}>How XnScore™ Points Are Earned</Text>
          <View style={styles.legendCard}>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#00C6AE" }]} />
                <Text style={styles.legendText}>Make a contribution</Text>
              </View>
              <Text style={styles.legendPoints}>+1.5</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                <Text style={styles.legendText}>On-time payment bonus</Text>
              </View>
              <Text style={styles.legendPoints}>+0.8</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#059669" }]} />
                <Text style={styles.legendText}>Early payment bonus</Text>
              </View>
              <Text style={styles.legendPoints}>+1.2</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#1565C0" }]} />
                <Text style={styles.legendText}>Join a circle</Text>
              </View>
              <Text style={styles.legendPoints}>+1.5</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                <Text style={styles.legendText}>Complete a circle</Text>
              </View>
              <Text style={styles.legendPoints}>+5</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#EC4899" }]} />
                <Text style={styles.legendText}>Add funds to wallet</Text>
              </View>
              <Text style={styles.legendPoints}>+0.3</Text>
            </View>
            <View style={styles.legendDivider} />
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#DC2626" }]} />
                <Text style={styles.legendText}>Late payment penalty</Text>
              </View>
              <Text style={[styles.legendPoints, { color: "#DC2626" }]}>-2</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                <Text style={styles.legendText}>Withdrawal</Text>
              </View>
              <Text style={[styles.legendPoints, { color: "#F59E0B" }]}>-0.2</Text>
            </View>
          </View>
          <Text style={styles.legendFooter}>Score range: 0-100 • Min 25 to join circles</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  filterContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F5F7FA",
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#0A2342",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  tipsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 12,
  },
  tipsScroll: {
    gap: 12,
  },
  tipCard: {
    width: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 12,
  },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  tipPoints: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
    marginBottom: 4,
  },
  tipDescription: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 10,
  },
  eventCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  eventLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  eventInfo: {
    flex: 1,
  },
  eventDescription: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0A2342",
    marginBottom: 2,
  },
  eventType: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  eventRight: {
    alignItems: "flex-end",
  },
  eventPoints: {
    fontSize: 18,
    fontWeight: "700",
  },
  eventPointsLabel: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  legendSection: {
    marginTop: 20,
  },
  legendCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  legendLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 14,
    color: "#374151",
  },
  legendPoints: {
    fontSize: 14,
    fontWeight: "600",
    color: "#00C6AE",
  },
  legendDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  legendFooter: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 12,
  },
});
