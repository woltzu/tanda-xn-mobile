"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTokens } from "@/context/TokenContext";

// ══════════════════════════════════════════════════════════════════════════════
// ELDER-020 — Token Dashboard
// Main overview of the elder token incentives system
// ══════════════════════════════════════════════════════════════════════════════

export default function TokenDashboardScreen() {
  const router = useRouter();
  const {
    balance,
    lifetimeEarned,
    lifetimeSpent,
    balanceUsd,
    transactions,
    awardRules,
    isLoading,
    error,
    refreshBalance,
    loadTransactions,
    formatTokenAmount,
    getCategoryIcon,
    getCategoryLabel,
  } = useTokens();

  const [refreshing, setRefreshing] = useState(false);

  // Load recent transactions on mount
  useEffect(() => {
    loadTransactions({ limit: 5 });
  }, [loadTransactions]);

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshBalance(), loadTransactions({ limit: 5 })]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, loadTransactions]);

  // Format relative date
  const formatRelativeDate = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Scroll to "How to Earn" section
  const scrollViewRef = React.useRef<ScrollView>(null);
  const howToEarnY = React.useRef(0);

  const scrollToEarn = () => {
    scrollViewRef.current?.scrollTo({ y: howToEarnY.current, animated: true });
  };

  return (
    <View style={styles.container}>
      {/* ── Navy Gradient Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Token Rewards</Text>
            <Text style={styles.headerSubtitle}>
              Earn and redeem TXN tokens
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#0A2342"
            colors={["#0A2342"]}
          />
        }
      >
        {/* ── Error Banner ── */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Balance Card ── */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your Balance</Text>
          <Text style={styles.balanceAmount}>
            {isLoading && !refreshing ? "..." : balance.toLocaleString()}
          </Text>
          <Text style={styles.balanceCurrency}>TXN</Text>
          <Text style={styles.balanceUsd}>
            {"\u2248"} ${balanceUsd.toFixed(2)} USD
          </Text>

          {/* Lifetime Stats */}
          <View style={styles.lifetimeRow}>
            <View style={styles.lifetimeStat}>
              <Ionicons name="trending-up" size={16} color="#10B981" />
              <Text style={styles.lifetimeValue}>
                {lifetimeEarned.toLocaleString()}
              </Text>
              <Text style={styles.lifetimeLabel}>Earned</Text>
            </View>
            <View style={styles.lifetimeDivider} />
            <View style={styles.lifetimeStat}>
              <Ionicons name="trending-down" size={16} color="#EF4444" />
              <Text style={styles.lifetimeValue}>
                {lifetimeSpent.toLocaleString()}
              </Text>
              <Text style={styles.lifetimeLabel}>Spent</Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.earnButton]}
            onPress={scrollToEarn}
          >
            <Ionicons name="star-outline" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Earn More</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.redeemButton]}
            onPress={() => router.push("/(app)/elder/ELDER-022-RedeemTokens")}
          >
            <Ionicons name="gift-outline" size={20} color="#0A2342" />
            <Text style={[styles.actionButtonText, { color: "#0A2342" }]}>
              Redeem
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent Activity ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity
              onPress={() =>
                router.push("/(app)/elder/ELDER-021-TokenHistory")
              }
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {isLoading && transactions.length === 0 ? (
            <ActivityIndicator
              size="small"
              color="#0A2342"
              style={{ marginVertical: 20 }}
            />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptySubtext}>
                Start earning tokens by completing elder activities
              </Text>
            </View>
          ) : (
            transactions.slice(0, 5).map((tx) => {
              const isEarn = tx.amount > 0;
              const iconName = getCategoryIcon(tx.category) as any;
              return (
                <View key={tx.id} style={styles.txRow}>
                  <View
                    style={[
                      styles.txIcon,
                      {
                        backgroundColor: isEarn
                          ? "rgba(16,185,129,0.1)"
                          : "rgba(239,68,68,0.1)",
                      },
                    ]}
                  >
                    <Ionicons
                      name={iconName}
                      size={20}
                      color={isEarn ? "#10B981" : "#EF4444"}
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txDescription} numberOfLines={1}>
                      {tx.description}
                    </Text>
                    <Text style={styles.txDate}>
                      {formatRelativeDate(tx.createdAt)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { color: isEarn ? "#10B981" : "#EF4444" },
                    ]}
                  >
                    {isEarn ? "+" : ""}
                    {tx.amount.toLocaleString()}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* ── How to Earn ── */}
        <View
          style={styles.section}
          onLayout={(e) => {
            howToEarnY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionTitle}>How to Earn</Text>
          <Text style={styles.sectionSubtitle}>
            Complete these activities to earn TXN tokens
          </Text>

          {awardRules.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="information-circle-outline"
                size={40}
                color="#D1D5DB"
              />
              <Text style={styles.emptyText}>
                No earning rules available yet
              </Text>
            </View>
          ) : (
            awardRules.map((rule) => {
              const iconName = getCategoryIcon(rule.eventType) as any;
              return (
                <View key={rule.id} style={styles.ruleCard}>
                  <View style={styles.ruleIconWrap}>
                    <Ionicons name={iconName} size={22} color="#0A2342" />
                  </View>
                  <View style={styles.ruleInfo}>
                    <Text style={styles.ruleName}>
                      {getCategoryLabel(rule.eventType)}
                    </Text>
                    <Text style={styles.ruleDesc} numberOfLines={2}>
                      {rule.description}
                    </Text>
                    {rule.maxPerDay != null && (
                      <Text style={styles.ruleLimit}>
                        Max {rule.maxPerDay}/day
                        {rule.maxPerMonth != null
                          ? ` | ${rule.maxPerMonth}/month`
                          : ""}
                      </Text>
                    )}
                  </View>
                  <View style={styles.ruleTokenBadge}>
                    <Text style={styles.ruleTokenAmount}>
                      +{rule.tokenAmount}
                    </Text>
                    <Text style={styles.ruleTokenLabel}>TXN</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },

  // ── Header ──
  header: {
    backgroundColor: "#0A2342",
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  // ── ScrollView ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },

  // ── Error ──
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: "#DC2626",
  },

  // ── Balance Card ──
  balanceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#0A2342",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0A2342",
    letterSpacing: -1,
  },
  balanceCurrency: {
    fontSize: 16,
    fontWeight: "600",
    color: "#10B981",
    marginTop: -4,
    marginBottom: 4,
  },
  balanceUsd: {
    fontSize: 15,
    color: "#6B7280",
    marginBottom: 16,
  },
  lifetimeRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 16,
  },
  lifetimeStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  lifetimeValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333333",
  },
  lifetimeLabel: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  lifetimeDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#F3F4F6",
  },

  // ── Action Buttons ──
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  earnButton: {
    backgroundColor: "#10B981",
  },
  redeemButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#0A2342",
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // ── Sections ──
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0A2342",
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },

  // ── Transaction Row ──
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: {
    flex: 1,
  },
  txDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  txDate: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "700",
  },

  // ── Empty State ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 24,
  },

  // ── Award Rule Cards ──
  ruleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  ruleIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleInfo: {
    flex: 1,
  },
  ruleName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333333",
  },
  ruleDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  ruleLimit: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  ruleTokenBadge: {
    alignItems: "center",
    backgroundColor: "rgba(16,185,129,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ruleTokenAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  ruleTokenLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#10B981",
  },
});
