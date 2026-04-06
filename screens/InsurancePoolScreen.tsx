import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  useInsurancePool,
  usePoolTransactions,
  usePoolRate,
} from "../hooks/useInsurancePool";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  bg: "#F5F7FA",
  green: "#22C55E",
  yellow: "#EAB308",
  orange: "#F97316",
  red: "#EF4444",
  muted: "#6B7280",
  border: "#E5E7EB",
  card: "#FFFFFF",
};

type TabKey = "overview" | "claims" | "premiums";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "claims", label: "Claims" },
  { key: "premiums", label: "Premiums" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCents = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const getHealthColor = (health: string) => {
  switch (health) {
    case "healthy":
      return COLORS.green;
    case "adequate":
      return COLORS.yellow;
    case "low":
      return COLORS.orange;
    case "critical":
      return COLORS.red;
    default:
      return COLORS.muted;
  }
};

const getHealthLabel = (health: string) =>
  health.charAt(0).toUpperCase() + health.slice(1);

const getClaimIconName = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case "member_default":
      return "alert-circle";
    case "partial_shortfall":
      return "git-branch";
    default:
      return "time-outline";
  }
};

const getClaimIconColor = (type: string) => {
  switch (type) {
    case "member_default":
      return COLORS.red;
    case "partial_shortfall":
      return COLORS.orange;
    default:
      return COLORS.orange;
  }
};

// ─── Route params ────────────────────────────────────────────────────────────

type InsurancePoolRouteParams = {
  InsurancePool: { circleId: string };
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function InsurancePoolScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<InsurancePoolRouteParams, "InsurancePool">>();
  const { circleId } = route.params;

  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Real hooks
  const {
    pool,
    loading: poolLoading,
    error: poolError,
    refetch: refetchPool,
    balanceFormatted,
    rateFormatted,
  } = useInsurancePool(circleId);

  const {
    transactions,
    loading: txLoading,
    error: txError,
    refetch: refetchTx,
    totals,
  } = usePoolTransactions(circleId);

  const {
    currentRate,
    rateFormatted: rateDisplayFormatted,
    rateHistory,
    loading: rateLoading,
    refetch: refetchRate,
  } = usePoolRate(circleId);

  const loading = poolLoading || txLoading || rateLoading;

  const onRefresh = useCallback(() => {
    refetchPool();
    refetchTx();
    refetchRate();
  }, [refetchPool, refetchTx, refetchRate]);

  // Derived data
  const claimTransactions = transactions.filter(
    (t) => t.transactionType === "coverage_payout"
  );
  const premiumTransactions = transactions.filter(
    (t) => t.transactionType === "withholding"
  );
  const premiumRatePct = currentRate * 100;
  const poolHealth = pool
    ? pool.balanceCents > pool.balanceCents * 0.8
      ? "healthy"
      : pool.balanceCents > pool.balanceCents * 0.5
      ? "adequate"
      : pool.balanceCents > pool.balanceCents * 0.2
      ? "low"
      : "critical"
    : "healthy";

  // ─── Loading State ───────────────────────────────────────────────────────

  if (poolLoading && !pool) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loadingText}>Loading insurance pool...</Text>
      </View>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────

  if (poolError && !pool) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color={COLORS.red} />
        <Text style={styles.errorText}>{poolError}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refetchPool}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Insurance Pool</Text>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="information-circle-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      >
        {/* Pool Balance Card */}
        <View style={styles.balanceCard}>
          <Ionicons
            name="shield-checkmark"
            size={40}
            color={COLORS.teal}
            style={styles.shieldIcon}
          />
          {pool?.circleName && (
            <Text style={styles.circleName}>{pool.circleName}</Text>
          )}
          <Text style={styles.balanceAmount}>{balanceFormatted}</Text>
          <Text style={styles.balanceLabel}>Pool Balance</Text>

          {/* Health Status */}
          <View style={styles.healthRow}>
            <View
              style={[
                styles.healthDot,
                { backgroundColor: getHealthColor(poolHealth) },
              ]}
            />
            <Text
              style={[styles.healthText, { color: getHealthColor(poolHealth) }]}
            >
              {getHealthLabel(poolHealth)}
            </Text>
            {pool && (
              <Text style={styles.coverageText}>
                {((pool.balanceCents / (totals.totalWithheldCents || 1)) * 100).toFixed(0)}%
                coverage ratio
              </Text>
            )}
          </View>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{rateDisplayFormatted}</Text>
              <Text style={styles.statLabel}>Premium Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {pool
                  ? formatCents(
                      Math.round(pool.balanceCents * currentRate)
                    )
                  : "$0.00"}
              </Text>
              <Text style={styles.statLabel}>Your Premium</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {pool?.memberCount ?? 0}
              </Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <View style={styles.tabContent}>
            {/* How It Works */}
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.card}>
              {[
                {
                  num: 1,
                  title: "Small Premium Each Cycle",
                  desc: `${premiumRatePct.toFixed(1)}% of your contribution goes to the pool`,
                },
                {
                  num: 2,
                  title: "Pool Covers Shortfalls",
                  desc: "If someone can't pay or uses partial mode, the pool covers the gap",
                },
                {
                  num: 3,
                  title: "Circle Stays on Track",
                  desc: "Payouts happen on time regardless of individual shortfalls",
                },
              ].map((step, i) => (
                <View key={step.num} style={[styles.stepRow, i > 0 && styles.stepRowSpaced]}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNum}>{step.num}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Pool Breakdown */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
              Pool Breakdown
            </Text>
            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total Premiums Collected</Text>
                <Text style={styles.breakdownValue}>
                  {formatCents(totals.totalWithheldCents)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total Claims Paid</Text>
                <Text style={[styles.breakdownValue, { color: COLORS.orange }]}>
                  -{formatCents(totals.totalPayoutsCents)}
                </Text>
              </View>
              <View style={styles.breakdownDivider} />
              <View style={[styles.breakdownRow, { paddingTop: 12 }]}>
                <Text style={styles.breakdownTotalLabel}>Current Balance</Text>
                <Text style={styles.breakdownTotalValue}>
                  {balanceFormatted}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ─── CLAIMS TAB ──────────────────────────────────────────── */}
        {activeTab === "claims" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Claim History</Text>
            <Text style={styles.sectionSubtitle}>
              All claims are anonymous — member identities are protected
            </Text>

            {claimTransactions.length === 0 && !txLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>No claims yet</Text>
              </View>
            )}

            {claimTransactions.map((claim) => (
              <View key={claim.id} style={styles.card}>
                <View style={styles.claimHeader}>
                  <View style={styles.claimTypeRow}>
                    <Ionicons
                      name={getClaimIconName(claim.description || "")}
                      size={16}
                      color={getClaimIconColor(claim.description || "")}
                    />
                    <Text style={styles.claimType}>
                      {(claim.description || claim.transactionType).replace(/_/g, " ")}
                    </Text>
                  </View>
                  <Text style={styles.claimDate}>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.claimBody}>
                  <Text style={styles.claimAmount}>
                    {formatCents(Math.abs(claim.amountCents))}
                  </Text>
                  <View style={styles.claimStatusPill}>
                    <Text style={styles.claimStatusText}>Paid</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── PREMIUMS TAB ────────────────────────────────────────── */}
        {activeTab === "premiums" && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Premium Payments</Text>
            <Text style={styles.sectionSubtitle}>
              Your {premiumRatePct.toFixed(1)}% contribution to the pool each cycle
            </Text>

            {premiumTransactions.length === 0 && !txLoading && (
              <View style={styles.emptyState}>
                <Ionicons name="wallet-outline" size={40} color={COLORS.muted} />
                <Text style={styles.emptyText}>No premiums collected yet</Text>
              </View>
            )}

            {premiumTransactions.map((premium) => (
              <View key={premium.id} style={[styles.card, styles.premiumCard]}>
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>
                    {premium.description || "Premium Withholding"}
                  </Text>
                  <Text style={styles.premiumDate}>
                    {new Date(premium.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.premiumAmount}>
                  {formatCents(premium.amountCents)}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
              </View>
            ))}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  // Loading / Error
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.muted,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.red,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 32,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: COLORS.teal,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  // Header
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Balance Card
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  shieldIcon: {
    marginBottom: 8,
  },
  circleName: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: COLORS.navy,
  },
  balanceLabel: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
  },

  // Health
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  healthText: {
    fontSize: 13,
    fontWeight: "600",
  },
  coverageText: {
    fontSize: 12,
    color: COLORS.muted,
    marginLeft: 10,
  },

  // Quick Stats
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  statBlock: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: COLORS.navy,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.muted,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  // Tab Content
  tabContent: {
    gap: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 8,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },

  // How It Works steps
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepRowSpaced: {
    marginTop: 16,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.teal,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 12,
    color: COLORS.muted,
    lineHeight: 18,
  },

  // Breakdown
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  breakdownLabel: {
    fontSize: 13,
    color: COLORS.muted,
  },
  breakdownValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  breakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
  },
  breakdownTotalValue: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.teal,
  },

  // Claims
  claimHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  claimTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  claimType: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
    textTransform: "capitalize",
  },
  claimDate: {
    fontSize: 11,
    color: COLORS.muted,
  },
  claimBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  claimAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
  },
  claimStatusPill: {
    backgroundColor: `${COLORS.green}20`,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  claimStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.green,
  },

  // Premiums
  premiumCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  premiumInfo: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.navy,
  },
  premiumDate: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  premiumAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.navy,
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
  },
});
