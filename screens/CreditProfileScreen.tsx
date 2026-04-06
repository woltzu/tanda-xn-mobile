import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import {
  useLatestValidAssessment,
  useEligibleLoanProducts,
  useCreditScore,
  useCanApplyForLoans,
} from "../hooks/useCreditworthiness";

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

const getTierColor = (tier: string) => {
  switch (tier) {
    case "excellent": return COLORS.green;
    case "good": return COLORS.teal;
    case "fair": return COLORS.yellow;
    default: return COLORS.red;
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.yellow;
  return COLORS.red;
};

const PRODUCT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  salary_advance: "flash",
  circle_loan: "cash",
  emergency_fund: "medkit",
  business_micro_loan: "briefcase",
};

const formatCents = (c: number) => `$${(c / 100).toLocaleString()}`;

export default function CreditProfileScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const {
    data: assessment,
    isLoading: assessmentLoading,
    refetch: refetchAssessment,
  } = useLatestValidAssessment(user?.id);

  const {
    data: eligibleProducts,
    isLoading: productsLoading,
    refetch: refetchProducts,
  } = useEligibleLoanProducts(user?.id);

  const creditScore = useCreditScore(assessment?.xn_score);
  const { canApply, reason: applyReason, loading: applyLoading } = useCanApplyForLoans(user?.id);

  const loading = assessmentLoading || productsLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchAssessment(), refetchProducts()]);
    setRefreshing(false);
  }, [refetchAssessment, refetchProducts]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
      </View>
    );
  }

  const score = creditScore?.score ?? assessment?.credit_score ?? 0;
  const tier = creditScore?.tier ?? assessment?.risk_grade ?? "fair";
  const tierColor = getTierColor(tier);
  const maxLoan = assessment?.approved_amount_cents ?? 0;
  const maxAdvance = assessment?.max_advance_cents ?? 0;
  const approvalPct = assessment?.approval_likelihood ?? 0;
  const dimensions = assessment?.dimension_scores ?? [];
  const improvementActions = assessment?.improvement_actions ?? [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Credit Profile</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />}
      >
        {/* Credit Score Card */}
        <View style={[styles.card, styles.scoreCard]}>
          <Text style={styles.scoreNumber}>{score}</Text>
          <Text style={[styles.tierLabel, { color: tierColor }]}>
            {String(tier).toUpperCase()}
          </Text>
          <Text style={styles.mutedText}>Creditworthiness Score</Text>

          {/* Limits Row */}
          <View style={styles.limitsRow}>
            <View style={styles.limitCol}>
              <Text style={styles.limitValue}>{formatCents(maxLoan)}</Text>
              <Text style={styles.limitLabel}>Max Loan</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.limitCol}>
              <Text style={styles.limitValue}>{formatCents(maxAdvance)}</Text>
              <Text style={styles.limitLabel}>Max Advance</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.limitCol}>
              <Text style={[styles.limitValue, { color: COLORS.green }]}>{approvalPct}%</Text>
              <Text style={styles.limitLabel}>Approval</Text>
            </View>
          </View>
        </View>

        {/* Assessment Breakdown */}
        {dimensions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Assessment Breakdown</Text>
            {dimensions.map((dim: any, i: number) => {
              const dimScore = dim.score ?? 0;
              const color = getScoreColor(dimScore);
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.dimHeader}>
                    <Text style={styles.dimLabel}>{dim.label ?? dim.dimension}</Text>
                    <Text style={[styles.dimScore, { color }]}>{dimScore}/100</Text>
                  </View>
                  <View style={styles.dimProgressTrack}>
                    <View
                      style={[
                        styles.dimProgressFill,
                        { width: `${dimScore}%`, backgroundColor: color },
                      ]}
                    />
                  </View>
                  {dim.description && (
                    <Text style={[styles.mutedText, { marginTop: 6 }]}>{dim.description}</Text>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Eligible Products */}
        {eligibleProducts && eligibleProducts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Available Products</Text>
            {eligibleProducts.map((product: any, i: number) => {
              const isEligible = product.is_eligible !== false;
              const iconName = PRODUCT_ICONS[product.code] ?? "cash";
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.productRow}>
                    <View
                      style={[
                        styles.productIcon,
                        {
                          backgroundColor: isEligible ? `${COLORS.teal}15` : COLORS.bg,
                        },
                      ]}
                    >
                      <Ionicons
                        name={iconName}
                        size={20}
                        color={isEligible ? COLORS.teal : COLORS.muted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.mutedText}>
                        {isEligible
                          ? `Up to ${formatCents(product.max_amount_cents ?? 0)}`
                          : product.ineligibility_reason ?? "Not eligible"}
                      </Text>
                    </View>
                    {isEligible ? (
                      <TouchableOpacity
                        style={styles.applyBtn}
                        onPress={() => {
                          if (canApply) {
                            navigation.navigate("LoanApplication", {
                              productId: product.id,
                            });
                          } else {
                            Alert.alert("Cannot Apply", applyReason ?? "Not eligible at this time.");
                          }
                        }}
                      >
                        <Text style={styles.applyBtnText}>Apply</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.lockedRow}>
                        <Ionicons name="lock-closed" size={12} color={COLORS.muted} />
                        <Text style={styles.lockedText}>Locked</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* How to Improve */}
        {improvementActions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>How to Improve</Text>
            {improvementActions.map((action: any, i: number) => {
              const actionText = typeof action === "string" ? action : action.description ?? "";
              return (
                <View key={i} style={styles.card}>
                  <View style={styles.actionRow}>
                    <View style={styles.actionNumber}>
                      <Text style={styles.actionNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.actionText}>{actionText}</Text>
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
  headerBtn: { padding: 4 },
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
  scoreCard: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
    marginTop: -8,
    shadowOpacity: 0.1,
    elevation: 4,
  },

  sectionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.navy, marginBottom: 12, marginTop: 12 },
  mutedText: { fontSize: 13, color: COLORS.muted },

  // Score
  scoreNumber: { fontSize: 56, fontWeight: "800", color: COLORS.navy },
  tierLabel: { fontSize: 14, fontWeight: "700", letterSpacing: 2, marginTop: 2 },

  // Limits
  limitsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 20,
    paddingTop: 16,
  },
  limitCol: { alignItems: "center" },
  limitValue: { fontSize: 17, fontWeight: "700", color: COLORS.navy },
  limitLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: COLORS.border },

  // Dimensions
  dimHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dimLabel: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  dimScore: { fontSize: 14, fontWeight: "700" },
  dimProgressTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  dimProgressFill: { height: 6, borderRadius: 3 },

  // Products
  productRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  productName: { fontSize: 14, fontWeight: "600", color: COLORS.navy },
  applyBtn: {
    backgroundColor: COLORS.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  applyBtnText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
  lockedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockedText: { fontSize: 12, color: COLORS.muted },

  // Actions
  actionRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  actionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.teal,
    justifyContent: "center",
    alignItems: "center",
  },
  actionNumberText: { fontSize: 12, fontWeight: "700", color: "#FFF" },
  actionText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 20 },
});
