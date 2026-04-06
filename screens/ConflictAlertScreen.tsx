import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  useFormationReview,
  usePostFormationMonitor,
  useConflictHistory,
  useConflictActions,
  type FormationFlag,
  type PostFormationMonitor as MonitorType,
  type ConflictRecord,
} from "../hooks/useConflictPrediction";

type TabKey = "formation" | "monitoring" | "history";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "formation", label: "Formation", icon: "shield-checkmark-outline" },
  { key: "monitoring", label: "Monitoring", icon: "pulse-outline" },
  { key: "history", label: "History", icon: "time-outline" },
];

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  low:      { color: "#10B981", bg: "#ECFDF5", icon: "information-circle-outline" },
  medium:   { color: "#F59E0B", bg: "#FFFBEB", icon: "warning-outline" },
  high:     { color: "#EF4444", bg: "#FEF2F2", icon: "alert-circle-outline" },
  critical: { color: "#991B1B", bg: "#FEE2E2", icon: "skull-outline" },
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  clear:   { label: "Clear", color: "#10B981", bg: "#ECFDF5" },
  caution: { label: "Caution", color: "#F59E0B", bg: "#FFFBEB" },
  warning: { label: "Warning", color: "#EF4444", bg: "#FEF2F2" },
  block:   { label: "Blocked", color: "#991B1B", bg: "#FEE2E2" },
};

export default function ConflictAlertScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const circleId = (route.params as any)?.circleId as string;

  const [activeTab, setActiveTab] = useState<TabKey>("formation");

  // Wire to real hooks
  const formation = useFormationReview();
  const monitor = usePostFormationMonitor(circleId);
  const history = useConflictHistory(circleId);
  const actions = useConflictActions();

  const isRefreshing =
    (activeTab === "formation" && formation.loading) ||
    (activeTab === "monitoring" && monitor.loading) ||
    (activeTab === "history" && history.loading);

  const handleRefresh = useCallback(() => {
    if (activeTab === "formation") formation.refresh();
    else if (activeTab === "monitoring") monitor.refresh();
    else history.refresh();
  }, [activeTab, formation, monitor, history]);

  // ── Formation review handlers ──────────────────────────────────────────────
  const handleReview = useCallback((flag: FormationFlag, outcome: "approved" | "rejected" | "override") => {
    Alert.alert(
      `${outcome.charAt(0).toUpperCase() + outcome.slice(1)} Formation`,
      `Are you sure you want to ${outcome} this formation?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: outcome === "rejected" ? "destructive" : "default",
          onPress: async () => {
            try {
              await actions.resolveConflict(flag.id, outcome);
              formation.refresh();
            } catch {
              Alert.alert("Error", "Failed to process review.");
            }
          },
        },
      ]
    );
  }, [actions, formation]);

  // ── Resolve conflict handler ───────────────────────────────────────────────
  const handleResolve = useCallback((conflict: ConflictRecord) => {
    Alert.alert(
      "Resolve Conflict",
      "Mark this conflict as resolved?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resolve",
          onPress: async () => {
            try {
              await actions.resolveConflict(conflict.id, "manual", "Resolved from mobile");
              history.refresh();
            } catch {
              Alert.alert("Error", "Failed to resolve conflict.");
            }
          },
        },
      ]
    );
  }, [actions, history]);

  // ── Formation tab ──────────────────────────────────────────────────────────
  const renderFormationTab = () => {
    if (formation.loading && formation.pendingReviews.length === 0) {
      return <LoadingPlaceholder />;
    }

    if (formation.pendingReviews.length === 0) {
      return (
        <EmptyState
          icon="shield-checkmark"
          title="No pending reviews"
          subtitle="All circle formations have been reviewed"
        />
      );
    }

    return formation.pendingReviews.map((flag) => {
      const tier = TIER_CONFIG[flag.frictionTier] ?? TIER_CONFIG.clear;
      return (
        <View key={flag.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.tierPill, { backgroundColor: tier.bg }]}>
              <View style={[styles.tierDot, { backgroundColor: tier.color }]} />
              <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
            </View>
            <Text style={styles.cardTimestamp}>
              {new Date(flag.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <Text style={styles.cardTitle}>Formation Review Required</Text>

          {flag.flaggedPairs && flag.flaggedPairs.length > 0 && (
            <View style={styles.pairsList}>
              {flag.flaggedPairs.map((pair: any, idx: number) => (
                <View key={idx} style={styles.pairRow}>
                  <Ionicons name="people-outline" size={16} color="#6B7280" />
                  <Text style={styles.pairText}>
                    {pair.memberAName ?? pair.memberAId} - {pair.memberBName ?? pair.memberBId}
                  </Text>
                  <Text style={[styles.pairScore, { color: (pair.score ?? 0) >= 0.7 ? "#EF4444" : "#F59E0B" }]}>
                    {((pair.score ?? 0) * 100).toFixed(0)}%
                  </Text>
                </View>
              ))}
            </View>
          )}

          {flag.notes && (
            <Text style={styles.cardNotes}>{flag.notes}</Text>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleReview(flag, "approved")}
              disabled={actions.submitting}
            >
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.overrideBtn]}
              onPress={() => handleReview(flag, "override")}
              disabled={actions.submitting}
            >
              <Ionicons name="swap-horizontal" size={16} color="#F59E0B" />
              <Text style={[styles.actionBtnText, { color: "#F59E0B" }]}>Override</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReview(flag, "rejected")}
              disabled={actions.submitting}
            >
              <Ionicons name="close" size={16} color="#EF4444" />
              <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    });
  };

  // ── Monitoring tab ─────────────────────────────────────────────────────────
  const renderMonitoringTab = () => {
    if (monitor.loading && monitor.monitors.length === 0) {
      return <LoadingPlaceholder />;
    }

    if (monitor.monitors.length === 0) {
      return (
        <EmptyState
          icon="pulse"
          title="No active monitors"
          subtitle="No pairs are currently being monitored in this circle"
        />
      );
    }

    return (
      <>
        {monitor.hasEscalations && (
          <View style={styles.escalationBanner}>
            <Ionicons name="warning" size={20} color="#EF4444" />
            <Text style={styles.escalationText}>
              {monitor.escalated.length} escalated pair{monitor.escalated.length !== 1 ? "s" : ""} require attention
            </Text>
          </View>
        )}

        {/* Stats bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{monitor.activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{monitor.escalated.length}</Text>
            <Text style={styles.statLabel}>Escalated</Text>
          </View>
        </View>

        {monitor.monitors.map((m) => (
          <View key={m.id} style={[styles.card, m.escalated && styles.escalatedCard]}>
            <View style={styles.cardHeader}>
              <View style={styles.monitorMeta}>
                <Ionicons
                  name={m.escalated ? "alert-circle" : "eye-outline"}
                  size={18}
                  color={m.escalated ? "#EF4444" : "#00C6AE"}
                />
                <Text style={[styles.monitorStatus, { color: m.escalated ? "#EF4444" : "#00C6AE" }]}>
                  {m.escalated ? "Escalated" : "Watching"}
                </Text>
              </View>
              <Text style={styles.cardTimestamp}>
                {new Date(m.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.pairRow}>
              <Ionicons name="people" size={16} color="#0A2342" />
              <Text style={styles.pairTextBold}>
                {(m as any).memberAName ?? "Member A"} - {(m as any).memberBName ?? "Member B"}
              </Text>
            </View>

            {(m as any).frictionScore != null && (
              <View style={styles.scoreBar}>
                <View style={styles.scoreTrack}>
                  <View
                    style={[
                      styles.scoreFill,
                      {
                        width: `${Math.min(((m as any).frictionScore ?? 0) * 100, 100)}%`,
                        backgroundColor: (m as any).frictionScore >= 0.7 ? "#EF4444" : (m as any).frictionScore >= 0.4 ? "#F59E0B" : "#10B981",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.scoreText}>
                  {(((m as any).frictionScore ?? 0) * 100).toFixed(0)}%
                </Text>
              </View>
            )}

            {(m as any).reason && (
              <Text style={styles.cardNotes}>{(m as any).reason}</Text>
            )}
          </View>
        ))}
      </>
    );
  };

  // ── History tab ────────────────────────────────────────────────────────────
  const renderHistoryTab = () => {
    if (history.loading && history.conflicts.length === 0) {
      return <LoadingPlaceholder />;
    }

    if (history.conflicts.length === 0) {
      return (
        <EmptyState
          icon="time"
          title="No conflict history"
          subtitle="No conflicts have been recorded for this circle"
        />
      );
    }

    return (
      <>
        {/* Summary bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{history.conflicts.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>{history.unresolvedCount}</Text>
            <Text style={styles.statLabel}>Unresolved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: "#EF4444" }]}>{history.highSeverityCount}</Text>
            <Text style={styles.statLabel}>High Severity</Text>
          </View>
        </View>

        {history.conflicts.map((conflict) => {
          const sev = SEVERITY_CONFIG[conflict.severity] ?? SEVERITY_CONFIG.low;
          const isResolved = !!conflict.resolvedAt;

          return (
            <View key={conflict.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.severityPill, { backgroundColor: sev.bg }]}>
                  <Ionicons name={sev.icon as any} size={14} color={sev.color} />
                  <Text style={[styles.severityLabel, { color: sev.color }]}>
                    {conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)}
                  </Text>
                </View>
                <View style={[styles.statusPill, isResolved ? styles.resolvedPill : styles.unresolvedPill]}>
                  <Text style={[styles.statusText, { color: isResolved ? "#10B981" : "#F59E0B" }]}>
                    {isResolved ? "Resolved" : "Open"}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{conflict.conflictType ?? "Conflict"}</Text>
              <Text style={styles.cardTimestamp}>
                {new Date(conflict.createdAt).toLocaleDateString()}
              </Text>

              {conflict.description && (
                <Text style={styles.cardNotes} numberOfLines={3}>{conflict.description}</Text>
              )}

              {!isResolved && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.resolveBtn]}
                  onPress={() => handleResolve(conflict)}
                  disabled={actions.submitting}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Resolve</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conflict Alerts</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            // Badge counts
            let badge = 0;
            if (tab.key === "formation") badge = formation.pendingReviews.length;
            else if (tab.key === "monitoring") badge = monitor.escalated.length;
            else if (tab.key === "history") badge = history.unresolvedCount;

            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? "#00C6AE" : "rgba(255,255,255,0.5)"}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.section}>
          {activeTab === "formation" && renderFormationTab()}
          {activeTab === "monitoring" && renderMonitoringTab()}
          {activeTab === "history" && renderHistoryTab()}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function LoadingPlaceholder() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#00C6AE" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={56} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },

  // Header
  header: { paddingTop: 60, paddingBottom: 4, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },

  // Tab bar
  tabBar: { flexDirection: "row", marginBottom: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#00C6AE" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.5)" },
  tabLabelActive: { color: "#FFFFFF" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },

  // Content
  content: { flex: 1 },
  section: { paddingHorizontal: 20, marginTop: 16 },

  // Cards
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  escalatedCard: { borderColor: "#FCA5A5", borderWidth: 1.5 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginBottom: 6 },
  cardTimestamp: { fontSize: 12, color: "#9CA3AF" },
  cardNotes: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 8 },

  // Tier pill
  tierPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierLabel: { fontSize: 12, fontWeight: "600" },

  // Severity pill
  severityPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  severityLabel: { fontSize: 12, fontWeight: "600" },

  // Status pill
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  resolvedPill: { backgroundColor: "#ECFDF5" },
  unresolvedPill: { backgroundColor: "#FFFBEB" },
  statusText: { fontSize: 12, fontWeight: "600" },

  // Pairs list
  pairsList: { marginTop: 8, gap: 6 },
  pairRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  pairText: { flex: 1, fontSize: 13, color: "#6B7280" },
  pairTextBold: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0A2342" },
  pairScore: { fontSize: 13, fontWeight: "700" },

  // Score bar (monitoring)
  scoreBar: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  scoreTrack: { flex: 1, height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden" },
  scoreFill: { height: 6, borderRadius: 3 },
  scoreText: { fontSize: 13, fontWeight: "700", color: "#0A2342", width: 36, textAlign: "right" },

  // Escalation banner
  escalationBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#FCA5A5" },
  escalationText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#EF4444" },

  // Stats row
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statBox: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#0A2342" },
  statLabel: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Monitor meta
  monitorMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  monitorStatus: { fontSize: 13, fontWeight: "600" },

  // Action buttons
  actionRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  approveBtn: { flex: 1, backgroundColor: "#00C6AE" },
  overrideBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#F59E0B" },
  rejectBtn: { flex: 1, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#EF4444" },
  resolveBtn: { alignSelf: "flex-start", backgroundColor: "#00C6AE", marginTop: 12 },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center" },

  // Loading
  loadingContainer: { alignItems: "center", paddingVertical: 60 },
  loadingText: { fontSize: 14, color: "#9CA3AF", marginTop: 12 },
});
