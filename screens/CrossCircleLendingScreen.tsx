import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import {
  useLiquidityPool,
  useLiquidityAdvance,
  useLiquidityActions,
} from "../hooks/useCrossCircleLiquidity";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#22C55E",
  yellow: "#EAB308",
  red: "#EF4444",
  bg: "#F5F7FA",
  muted: "#6B7280",
  border: "#E5E7EB",
  white: "#FFFFFF",
};

const formatCents = (c: number) =>
  `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

type TabKey = "overview" | "transfers" | "opportunities";

export default function CrossCircleLendingScreen() {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<TabKey>("overview");

  const { pool, dashboard, loading: poolLoading, refresh: refreshPool } = useLiquidityPool();
  const {
    activeAdvance, advances, hasActiveAdvance, totalRepaid,
    loading: advanceLoading, refresh: refreshAdvance,
  } = useLiquidityAdvance();
  const { checkEligibility, requestAdvance, checking, requesting } = useLiquidityActions();

  const loading = poolLoading || advanceLoading;

  const onRefresh = useCallback(() => {
    refreshPool();
    refreshAdvance();
  }, [refreshPool, refreshAdvance]);

  // Derive display data from hooks
  const totalLent = pool?.totalAdvancedCents ?? 0;
  const interestEarned = dashboard?.totalFeesCollectedCents ?? 0;
  const activeCount = advances.filter(
    (a) => a.status === "approved" || a.status === "disbursed" || a.status === "repaying"
  ).length;

  if (loading && !pool) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.teal} />
        <Text style={styles.loaderText}>Loading liquidity data...</Text>
      </View>
    );
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "transfers", label: "Transfers" },
    { key: "opportunities", label: "Opportunities" },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cross-Circle Lending</Text>
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
        {/* Summary Card */}
        <View style={styles.card}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="swap-horizontal-outline" size={28} color={COLORS.teal} />
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatCents(totalLent)}</Text>
              <Text style={styles.summaryLabel}>Currently Lent</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>
                {formatCents(interestEarned)}
              </Text>
              <Text style={styles.summaryLabel}>Interest Earned</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeCount}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {tab === "overview" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Advances</Text>
            {advances.length === 0 && (
              <View style={styles.emptyCard}>
                <Ionicons name="wallet-outline" size={32} color={COLORS.muted} />
                <Text style={styles.emptyText}>No advances yet</Text>
              </View>
            )}
            {advances.map((adv) => (
              <View key={adv.id} style={styles.card}>
                <View style={styles.circleRow}>
                  <Text style={styles.circleName}>Advance #{adv.id.slice(0, 6)}</Text>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor:
                          adv.status === "repaid"
                            ? COLORS.green
                            : adv.status === "repaying" || adv.status === "disbursed"
                            ? COLORS.teal
                            : COLORS.yellow,
                      },
                    ]}
                  />
                </View>
                <View style={styles.circleStats}>
                  <View>
                    <Text style={styles.statLabel}>Amount</Text>
                    <Text style={styles.statValue}>{formatCents(adv.amountCents)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.statLabel}>Status</Text>
                    <Text style={[styles.statValue, { color: COLORS.teal }]}>{adv.status}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {tab === "transfers" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Transfers</Text>
            {activeAdvance ? (
              <View style={styles.card}>
                <View style={styles.transferRow}>
                  <Text style={styles.transferFrom}>Active Advance</Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.teal} />
                  <Text style={styles.transferTo}>{activeAdvance.status}</Text>
                </View>
                <View style={styles.transferStats}>
                  <View style={styles.transferStat}>
                    <Text style={styles.statLabel}>Amount</Text>
                    <Text style={styles.statValue}>{formatCents(activeAdvance.amountCents)}</Text>
                  </View>
                  <View style={styles.transferStat}>
                    <Text style={styles.statLabel}>Fee Tier</Text>
                    <Text style={styles.statValue}>{activeAdvance.feeTier}</Text>
                  </View>
                  <View style={styles.transferStat}>
                    <Text style={styles.statLabel}>Repaid</Text>
                    <Text style={styles.statValue}>
                      {formatCents(activeAdvance.repaidCents ?? 0)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="swap-horizontal-outline" size={32} color={COLORS.muted} />
                <Text style={styles.emptyText}>No active transfers</Text>
              </View>
            )}
          </View>
        )}

        {tab === "opportunities" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lending Opportunities</Text>
            <Text style={styles.sectionSubtitle}>
              Circles that need liquidity support
            </Text>

            {dashboard && dashboard.utilizationRate < 0.8 ? (
              <View style={styles.card}>
                <View style={styles.oppHeader}>
                  <Text style={styles.circleName}>Pool Available</Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: `${COLORS.green}20` }]}>
                    <Text style={[styles.urgencyText, { color: COLORS.green }]}>HEALTHY</Text>
                  </View>
                </View>
                <View style={styles.oppDetails}>
                  <Text style={styles.oppDetailText}>
                    Pool utilization: {((dashboard.utilizationRate ?? 0) * 100).toFixed(0)}%
                  </Text>
                  <Text style={[styles.oppReturn, { color: COLORS.green }]}>
                    Available: {formatCents(pool?.totalPoolCents ?? 0)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.fundButton}
                  onPress={() => {
                    // Navigate to request advance flow
                  }}
                  disabled={requesting}
                >
                  {requesting ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.fundButtonText}>Request Advance</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons name="trending-up-outline" size={32} color={COLORS.muted} />
                <Text style={styles.emptyText}>No opportunities available right now</Text>
              </View>
            )}
          </View>
        )}
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
  summaryIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.teal}20`,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.navy,
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: COLORS.navy,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.muted,
  },
  tabTextActive: {
    color: COLORS.white,
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
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.muted,
    marginBottom: 12,
    marginTop: -8,
  },
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  circleName: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  circleStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.muted,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.navy,
  },
  lendButton: {
    borderWidth: 1,
    borderColor: `${COLORS.teal}40`,
    backgroundColor: `${COLORS.teal}10`,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  lendButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.teal,
  },
  transferRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  transferFrom: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  transferTo: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
  },
  transferStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  transferStat: {
    alignItems: "center",
  },
  oppHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  urgencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  oppDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  oppDetailText: {
    fontSize: 13,
    color: COLORS.muted,
  },
  oppReturn: {
    fontSize: 13,
    fontWeight: "600",
  },
  fundButton: {
    backgroundColor: COLORS.teal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  fundButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
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
