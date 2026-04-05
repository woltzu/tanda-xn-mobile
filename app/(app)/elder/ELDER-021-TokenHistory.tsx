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
// ELDER-021 — Token History
// Full paginated transaction history with filters
// ══════════════════════════════════════════════════════════════════════════════

type FilterTab = "all" | "earned" | "spent";

const PAGE_SIZE = 20;

export default function TokenHistoryScreen() {
  const router = useRouter();
  const {
    transactions,
    isLoading,
    loadTransactions,
    refreshBalance,
    formatTokenAmount,
    getCategoryIcon,
  } = useTokens();

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [allLoaded, setAllLoaded] = useState<typeof transactions>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Build query options from the active filter
  const getFilterOptions = useCallback(
    (currentOffset: number) => {
      const opts: { limit: number; offset: number; type?: string } = {
        limit: PAGE_SIZE,
        offset: currentOffset,
      };
      if (activeFilter === "earned") opts.type = "earn";
      if (activeFilter === "spent") opts.type = "spend";
      return opts;
    },
    [activeFilter]
  );

  // Initial load and filter change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setAllLoaded([]);
    loadTransactions(getFilterOptions(0)).then(() => {
      // After loading, check if we got a full page
    });
  }, [activeFilter, loadTransactions, getFilterOptions]);

  // Sync context transactions into local accumulated list on first load
  useEffect(() => {
    if (transactions.length > 0 && offset === 0) {
      setAllLoaded(transactions);
      setHasMore(transactions.length >= PAGE_SIZE);
    }
  }, [transactions, offset]);

  // Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0);
    setHasMore(true);
    setAllLoaded([]);
    try {
      await Promise.all([
        refreshBalance(),
        loadTransactions(getFilterOptions(0)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshBalance, loadTransactions, getFilterOptions]);

  // Load more (pagination)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const newOffset = offset + PAGE_SIZE;
    try {
      await loadTransactions(getFilterOptions(newOffset));
      // After loading, the new transactions are in `transactions`
      setOffset(newOffset);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, loadTransactions, getFilterOptions]);

  // Append newly loaded transactions
  useEffect(() => {
    if (offset > 0 && transactions.length > 0) {
      setAllLoaded((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTxns = transactions.filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTxns];
      });
      setHasMore(transactions.length >= PAGE_SIZE);
    }
  }, [transactions, offset]);

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

  const displayList = allLoaded.length > 0 ? allLoaded : transactions;

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "earned", label: "Earned" },
    { key: "spent", label: "Spent" },
  ];

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
            <Text style={styles.headerTitle}>Token History</Text>
            <Text style={styles.headerSubtitle}>
              All your token transactions
            </Text>
          </View>
        </View>
      </View>

      {/* ── Filter Tabs ── */}
      <View style={styles.filterRow}>
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, isActive && styles.filterTabActive]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive && styles.filterTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Transaction List ── */}
      <ScrollView
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
        {isLoading && displayList.length === 0 ? (
          <ActivityIndicator
            size="large"
            color="#0A2342"
            style={{ marginTop: 60 }}
          />
        ) : displayList.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={56} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Transactions</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === "earned"
                ? "You have not earned any tokens yet. Complete elder activities to start earning."
                : activeFilter === "spent"
                  ? "You have not spent any tokens yet."
                  : "Your transaction history will appear here."}
            </Text>
          </View>
        ) : (
          <>
            {displayList.map((tx) => {
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
                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        { color: isEarn ? "#10B981" : "#EF4444" },
                      ]}
                    >
                      {isEarn ? "+" : ""}
                      {tx.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.txBalanceAfter}>
                      Bal: {tx.balanceAfter.toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* Load More Button */}
            {hasMore && (
              <TouchableOpacity
                style={styles.loadMoreButton}
                onPress={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color="#0A2342" />
                ) : (
                  <Text style={styles.loadMoreText}>Load More</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
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

  // ── Filter Tabs ──
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  filterTabActive: {
    backgroundColor: "#0A2342",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },

  // ── ScrollView ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
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
  txRight: {
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  txBalanceAfter: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },

  // ── Empty State ──
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 18,
  },

  // ── Load More ──
  loadMoreButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A2342",
  },
});
