import React, { useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  useMyExplanation,
  useStabilityScore,
  useDynamicOrderActions,
} from "../hooks/useDynamicPayoutOrdering";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  bg: "#F5F7FA",
  muted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

type RouteParams = { DynamicPayout: { circleId: string } };

const formatCents = (c: number) =>
  `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

export default function DynamicPayoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "DynamicPayout">>();
  const { circleId } = route.params;

  const {
    explanation, loading: expLoading, positionText, componentsByImpact, refetch: refetchExp,
  } = useMyExplanation(circleId);

  const {
    run, loading: stabLoading, breakdown, grade, refetch: refetchStab,
  } = useStabilityScore(circleId);

  const { optimizing, error: actionError } = useDynamicOrderActions(circleId);

  const loading = expLoading || stabLoading;

  const onRefresh = useCallback(() => {
    refetchExp();
    refetchStab();
  }, [refetchExp, refetchStab]);

  const getStatusColor = (impact: string) => {
    switch (impact) {
      case "positive": return COLORS.green;
      case "negative": return COLORS.red;
      default: return COLORS.muted;
    }
  };

  const getGradeColor = (g: string | null) => {
    if (!g) return COLORS.muted;
    if (g === "A") return COLORS.green;
    if (g === "B") return COLORS.teal;
    if (g === "C") return COLORS.yellow;
    if (g === "D") return COLORS.orange;
    return COLORS.red;
  };

  if (loading && !explanation && !run) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loaderText}>Loading payout schedule...</Text>
      </View>
    );
  }

  const members = run?.candidateOrderings?.[0]?.ordering ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout Schedule</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={22} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* Next Payout / Position Card */}
        <View style={styles.card}>
          <Text style={styles.cardSubtitle}>Your Position</Text>
          <Text style={styles.bigNumber}>
            {positionText?.position ?? "--"}
          </Text>
          <Text style={styles.tealLabel}>
            Range: {positionText?.range ?? "N/A"}
          </Text>
          {positionText?.summary ? (
            <Text style={styles.summaryText}>{positionText.summary}</Text>
          ) : null}

          {/* Stability Grade */}
          {grade && (
            <View style={styles.gradeBadge}>
              <Text style={[styles.gradeText, { color: getGradeColor(grade) }]}>
                Stability: {grade} ({breakdown?.overall ?? ""})
              </Text>
            </View>
          )}
        </View>

        {/* Payout Order */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout Order</Text>

          <View style={styles.methodBadge}>
            <Ionicons name="sparkles-outline" size={16} color={COLORS.teal} />
            <Text style={styles.methodText}>Dynamic ordering based on trust & need</Text>
          </View>

          {members.length > 0 ? (
            members.map((member: any, idx: number) => {
              const isYou = member.isCurrentUser === true;
              const isCompleted = member.status === "completed";
              return (
                <View
                  key={member.memberId ?? idx}
                  style={[styles.memberRow, isYou && styles.memberRowHighlight]}
                >
                  <View
                    style={[
                      styles.positionCircle,
                      {
                        backgroundColor: isCompleted
                          ? COLORS.green
                          : member.status === "upcoming"
                          ? COLORS.teal
                          : "#D1D5DB",
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={16} color={COLORS.white} />
                    ) : (
                      <Text style={styles.positionNumber}>{idx + 1}</Text>
                    )}
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isYou && { fontWeight: "800" }]}>
                      {member.memberName ?? `Member ${idx + 1}`}
                    </Text>
                  </View>
                  <View style={styles.memberScores}>
                    <Text style={styles.scoreText}>
                      Score: {member.compositeScore?.toFixed(0) ?? "--"}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={28} color={COLORS.muted} />
              <Text style={styles.emptyText}>Order not yet determined</Text>
            </View>
          )}
        </View>

        {/* How Order Is Determined */}
        {componentsByImpact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How Order Is Determined</Text>

            {explanation?.components.map((factor, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.factorHeader}>
                  <Text style={styles.factorName}>{factor.factorName}</Text>
                  <Text style={[styles.factorWeight, { color: getStatusColor(factor.impact) }]}>
                    {factor.impact}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(factor.weight * 100, 100)}%`,
                        backgroundColor: getStatusColor(factor.impact),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.factorDesc}>{factor.humanText}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="calendar-outline" size={20} color={COLORS.teal} />
            <Text style={styles.statCardValue}>
              {run?.stabilityBreakdown?.overall?.toFixed(0) ?? "--"}
            </Text>
            <Text style={styles.statCardLabel}>Stability</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color={COLORS.teal} />
            <Text style={styles.statCardValue}>
              {breakdown?.collapseRisk ?? "--"}
            </Text>
            <Text style={styles.statCardLabel}>Collapse Risk</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people-outline" size={20} color={COLORS.teal} />
            <Text style={styles.statCardValue}>{members.length}</Text>
            <Text style={styles.statCardLabel}>Members</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.navy,
    textAlign: "center",
    marginVertical: 4,
  },
  tealLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.teal,
    textAlign: "center",
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
  },
  gradeBadge: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: `${COLORS.teal}10`,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 12,
  },
  methodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: `${COLORS.teal}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  methodText: {
    fontSize: 12,
    fontWeight: "500",
    color: COLORS.teal,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  memberRowHighlight: {
    borderWidth: 2,
    borderColor: COLORS.teal,
  },
  positionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  positionNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  memberScores: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  factorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  factorName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  factorWeight: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  factorDesc: {
    fontSize: 12,
    color: COLORS.muted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statCardValue: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 6,
  },
  statCardLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 8,
  },
});
