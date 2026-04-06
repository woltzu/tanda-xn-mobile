import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  useScoreBreakdownWithHelpers,
  useImprovementTips,
} from "../hooks/useScoreBreakdown";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  bg: "#F5F7FA",
  white: "#FFFFFF",
  muted: "#6B7280",
  border: "#E5E7EB",
};

const FACTOR_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  payment_history: "card",
  circle_completion: "refresh",
  vouch_network: "people",
  community: "chatbubbles",
  account_age: "time",
  disputes: "shield-checkmark",
};

const getTierColor = (tier: string) => {
  switch (tier) {
    case "excellent": return COLORS.green;
    case "good": return COLORS.teal;
    case "fair": return COLORS.yellow;
    case "poor": return COLORS.red;
    default: return COLORS.muted;
  }
};

const getScoreColor = (percentage: number) => {
  if (percentage >= 80) return COLORS.green;
  if (percentage >= 60) return COLORS.yellow;
  return COLORS.red;
};

const getPriorityStyle = (priority: string) => {
  switch (priority) {
    case "high": return { bg: `${COLORS.red}15`, text: COLORS.red };
    case "medium": return { bg: `${COLORS.yellow}15`, text: COLORS.yellow };
    case "low": return { bg: `${COLORS.green}15`, text: COLORS.green };
    default: return { bg: `${COLORS.muted}15`, text: COLORS.muted };
  }
};

export default function ScoreBreakdownScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const {
    breakdown,
    factorStatuses,
    healthScore,
    isLoading,
    error,
    refetch,
  } = useScoreBreakdownWithHelpers(user?.id);

  const {
    data: tips,
    isLoading: tipsLoading,
  } = useImprovementTips(user?.id, 5);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const xnScore = breakdown?.total_score ?? 0;
  const tier = breakdown?.tier ?? "fair";
  const tierColor = getTierColor(tier);
  const scoreDelta = breakdown?.score_delta ?? 0;
  const recentEvents = breakdown?.recent_events ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>XnScore Breakdown</Text>
        <TouchableOpacity>
          <Ionicons name="help-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* Score Card */}
        <View style={styles.card}>
          <View style={styles.scoreCardContent}>
            <View style={[styles.scoreCircle, { borderColor: tierColor }]}>
              <Text style={[styles.scoreNumber, { color: tierColor }]}>{xnScore}</Text>
            </View>
            <Text style={[styles.tierLabel, { color: tierColor }]}>
              {tier.toUpperCase()}
            </Text>
            <View style={styles.deltaRow}>
              <Ionicons
                name={scoreDelta >= 0 ? "arrow-up" : "arrow-down"}
                size={14}
                color={scoreDelta >= 0 ? COLORS.green : COLORS.red}
              />
              <Text
                style={[
                  styles.deltaText,
                  { color: scoreDelta >= 0 ? COLORS.green : COLORS.red },
                ]}
              >
                {scoreDelta >= 0 ? "+" : ""}
                {scoreDelta} since last update
              </Text>
            </View>
          </View>
        </View>

        {/* Score Factors */}
        <Text style={styles.sectionTitle}>Score Factors</Text>
        {factorStatuses?.map((factor: any) => {
          const color = getScoreColor(factor.percentage);
          const iconName = FACTOR_ICONS[factor.key] ?? "analytics";
          return (
            <View key={factor.key} style={styles.card}>
              <View style={styles.factorHeader}>
                <View style={[styles.factorIcon, { backgroundColor: `${color}20` }]}>
                  <Ionicons name={iconName} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.factorName}>{factor.name}</Text>
                  <Text style={styles.mutedText}>
                    {factor.statusInfo?.weight ?? 0}% of total
                  </Text>
                </View>
                <View style={styles.factorScoreCol}>
                  <Text style={[styles.factorScore, { color }]}>{factor.score}</Text>
                  <Text style={styles.factorMax}>/{factor.maxScore}</Text>
                </View>
              </View>
              <View style={styles.factorProgressTrack}>
                <View
                  style={[
                    styles.factorProgressFill,
                    { width: `${factor.percentage}%`, backgroundColor: color },
                  ]}
                />
              </View>
              {factor.statusInfo?.detail && (
                <Text style={[styles.mutedText, { marginTop: 6 }]}>{factor.statusInfo.detail}</Text>
              )}
            </View>
          );
        })}

        {/* Recent Events */}
        {recentEvents.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Score Events</Text>
            {recentEvents.map((event: any, i: number) => {
              const positive = (event.impact ?? 0) > 0;
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.eventRow}>
                    <View
                      style={[
                        styles.eventIcon,
                        { backgroundColor: positive ? `${COLORS.green}15` : `${COLORS.red}15` },
                      ]}
                    >
                      <Ionicons
                        name={positive ? "add" : "remove"}
                        size={14}
                        color={positive ? COLORS.green : COLORS.red}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventText}>{event.description ?? event.event}</Text>
                      <Text style={styles.mutedText}>{event.date}</Text>
                    </View>
                    <Text
                      style={[
                        styles.eventImpact,
                        { color: positive ? COLORS.green : COLORS.red },
                      ]}
                    >
                      {positive ? "+" : ""}{event.impact}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* Tips */}
        {tips && tips.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>How to Improve</Text>
            {tips.map((tip: any, i: number) => {
              const priority = getPriorityStyle(tip.priority ?? "low");
              const iconName = FACTOR_ICONS[tip.factor_key] ?? "bulb";
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.tipRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
                      <Text style={[styles.priorityText, { color: priority.text }]}>
                        {(tip.priority ?? "tip").toUpperCase()}
                      </Text>
                    </View>
                    <Ionicons name={iconName} size={18} color={COLORS.teal} />
                    <Text style={styles.tipText}>{tip.description ?? tip.text}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12, marginTop: 8 },
  mutedText: { fontSize: 13, color: COLORS.muted },

  // Score card
  scoreCardContent: { alignItems: "center", paddingVertical: 12 },
  scoreCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  scoreNumber: { fontSize: 48, fontWeight: "800" },
  tierLabel: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  deltaText: { fontSize: 13, fontWeight: "600" },

  // Factors
  factorHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  factorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  factorName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  factorScoreCol: { flexDirection: "row", alignItems: "baseline" },
  factorScore: { fontSize: 20, fontWeight: "800" },
  factorMax: { fontSize: 13, color: COLORS.muted },
  factorProgressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  factorProgressFill: { height: 6, borderRadius: 3 },

  // Events
  eventRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  eventText: { fontSize: 14, fontWeight: "500", color: COLORS.navy },
  eventImpact: { fontSize: 16, fontWeight: "800" },

  // Tips
  tipRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  priorityBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  priorityText: { fontSize: 9, fontWeight: "700" },
  tipText: { flex: 1, fontSize: 13, color: "#374151" },
});
