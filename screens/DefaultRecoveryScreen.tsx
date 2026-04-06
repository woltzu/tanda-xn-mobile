import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useUserDefaults } from "../hooks/useDefaultCascade";
import { useLateContributions } from "../hooks/useLateContributions";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  unresolved: { label: "Unresolved", color: "#EF4444", icon: "alert-circle" },
  in_recovery: { label: "In Recovery", color: "#F59E0B", icon: "time" },
  resolved: { label: "Resolved", color: "#10B981", icon: "checkmark-circle" },
  written_off: { label: "Written Off", color: "#6B7280", icon: "close-circle" },
};

export default function DefaultRecoveryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"defaults" | "late">("defaults");

  const {
    defaults,
    unresolvedDefaults,
    totalOwed,
    hasActiveDefaults,
    loading: defaultsLoading,
    error: defaultsError,
    refresh: refreshDefaults,
  } = useUserDefaults();

  const {
    lateContributions,
    loading: lateLoading,
    error: lateError,
    refresh: refreshLate,
  } = useLateContributions();

  const loading = defaultsLoading || lateLoading;

  const handleRefresh = () => {
    refreshDefaults();
    refreshLate();
  };

  const formatCurrency = (amount: number) =>
    `$${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  if (loading && defaults.length === 0 && lateContributions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>Loading recovery data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Default Recovery</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Owed</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalOwed)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Active Defaults</Text>
              <Text style={[styles.summaryValue, { color: hasActiveDefaults ? "#EF4444" : "#10B981" }]}>
                {unresolvedDefaults.length}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Late Payments</Text>
              <Text style={[styles.summaryValue, { color: lateContributions.length > 0 ? "#F59E0B" : "#10B981" }]}>
                {lateContributions.length}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "defaults" && styles.tabActive]}
          onPress={() => setActiveTab("defaults")}
        >
          <Ionicons name="alert-circle-outline" size={16} color={activeTab === "defaults" ? "#00C6AE" : "#6B7280"} />
          <Text style={[styles.tabText, activeTab === "defaults" && styles.tabTextActive]}>
            Defaults ({defaults.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "late" && styles.tabActive]}
          onPress={() => setActiveTab("late")}
        >
          <Ionicons name="time-outline" size={16} color={activeTab === "late" ? "#00C6AE" : "#6B7280"} />
          <Text style={[styles.tabText, activeTab === "late" && styles.tabTextActive]}>
            Late ({lateContributions.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {(defaultsError || lateError) && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{defaultsError || lateError}</Text>
          </View>
        )}

        {/* Defaults Tab */}
        {activeTab === "defaults" && (
          <>
            {defaults.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark" size={48} color="#00C6AE" />
                <Text style={styles.emptyTitle}>No Defaults</Text>
                <Text style={styles.emptySubtitle}>Your account is in good standing</Text>
              </View>
            ) : (
              defaults.map((d) => {
                const status = STATUS_CONFIG[d.default_status] || STATUS_CONFIG.unresolved;
                return (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.card}
                    onPress={() => navigation.navigate("DefaultDetail", { defaultId: d.id })}
                  >
                    <View style={styles.cardHeader}>
                      <View style={[styles.statusBadge, { backgroundColor: status.color + "15" }]}>
                        <Ionicons name={status.icon as any} size={14} color={status.color} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </View>

                    <View style={styles.cardBody}>
                      <Text style={styles.cardAmount}>{formatCurrency(d.total_owed)}</Text>
                      <Text style={styles.cardMeta}>
                        Created {new Date(d.created_at).toLocaleDateString()}
                      </Text>
                    </View>

                    {d.cascade_id && (
                      <View style={styles.cascadeBadge}>
                        <Ionicons name="git-branch-outline" size={12} color="#8B5CF6" />
                        <Text style={styles.cascadeText}>Cascade active</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* Late Contributions Tab */}
        {activeTab === "late" && (
          <>
            {lateContributions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-circle" size={48} color="#00C6AE" />
                <Text style={styles.emptyTitle}>No Late Payments</Text>
                <Text style={styles.emptySubtitle}>All contributions are up to date</Text>
              </View>
            ) : (
              lateContributions.map((lc) => (
                <TouchableOpacity
                  key={lc.id}
                  style={styles.card}
                  onPress={() => navigation.navigate("LateContributionDetail", { lateContributionId: lc.id })}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.lateInfo}>
                      <Text style={styles.cardTitle}>{lc.circle_name || "Circle"}</Text>
                      {lc.cycle_number != null && (
                        <Text style={styles.cardMeta}>Cycle #{lc.cycle_number}</Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </View>

                  <View style={styles.cardBody}>
                    <Text style={styles.cardAmount}>{formatCurrency(lc.amount)}</Text>
                    <View style={styles.overdueRow}>
                      <Ionicons name="time" size={14} color="#EF4444" />
                      <Text style={styles.overdueText}>{lc.days_overdue} days overdue</Text>
                    </View>
                  </View>

                  {lc.total_fees > 0 && (
                    <View style={styles.feeBadge}>
                      <Ionicons name="cash-outline" size={12} color="#F59E0B" />
                      <Text style={styles.feeText}>Fee: {formatCurrency(lc.total_fees)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F5F7FA" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#6B7280" },

  // Header
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },

  // Summary
  summaryCard: { marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 16 },
  summaryRow: { flexDirection: "row", alignItems: "center" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.15)" },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF" },
  tabActive: { backgroundColor: "#00C6AE15", borderWidth: 1, borderColor: "#00C6AE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#00C6AE" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },

  // Cards
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardBody: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342" },
  cardAmount: { fontSize: 20, fontWeight: "700", color: "#0A2342" },
  cardMeta: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  lateInfo: { flex: 1 },

  // Status Badge
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: "600" },

  // Cascade
  cascadeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  cascadeText: { fontSize: 12, color: "#8B5CF6", fontWeight: "500" },

  // Overdue
  overdueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  overdueText: { fontSize: 13, color: "#EF4444", fontWeight: "600" },

  // Fee
  feeBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  feeText: { fontSize: 12, color: "#F59E0B", fontWeight: "500" },
});
