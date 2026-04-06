import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useActiveIntervention, useInterventionHistory } from "../hooks/useEarlyIntervention";

const LEVEL_CONFIG: Record<number, { label: string; color: string; icon: string; bgColor: string }> = {
  1: { label: "Gentle Nudge", color: "#3B82F6", icon: "notifications-outline", bgColor: "#EFF6FF" },
  2: { label: "Urgent Alert", color: "#F59E0B", icon: "alert-circle", bgColor: "#FFFBEB" },
  3: { label: "Final Warning", color: "#EF4444", icon: "warning", bgColor: "#FEF2F2" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  sent: { label: "Sent", color: "#3B82F6", icon: "paper-plane" },
  viewed: { label: "Viewed", color: "#8B5CF6", icon: "eye" },
  engaged: { label: "Engaged", color: "#F59E0B", icon: "hand-left" },
  paid: { label: "Paid", color: "#10B981", icon: "checkmark-circle" },
  accepted: { label: "Accepted", color: "#10B981", icon: "thumbs-up" },
  expired: { label: "Expired", color: "#6B7280", icon: "time" },
  escalated: { label: "Escalated", color: "#EF4444", icon: "arrow-up-circle" },
  resolved: { label: "Resolved", color: "#10B981", icon: "checkmark-done" },
};

export default function EarlyInterventionScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [respondingAction, setRespondingAction] = useState<string | null>(null);

  const {
    intervention,
    hasIntervention,
    isLevel1,
    isLevel2,
    hasOptions,
    loading: activeLoading,
    markViewed,
    markEngaged,
    respondWithAction,
    refresh: refreshActive,
  } = useActiveIntervention();

  const {
    interventions: historyItems,
    totalInterventions,
    defaultsPrevented,
    preventionRate,
    loading: historyLoading,
    refresh: refreshHistory,
  } = useInterventionHistory();

  const loading = activeLoading || historyLoading;

  const handleRefresh = () => {
    refreshActive();
    refreshHistory();
  };

  const handleRespond = async (action: string) => {
    setRespondingAction(action);
    try {
      const result = await respondWithAction(action);
      if (result) {
        Alert.alert("Response Recorded", `Your response "${action}" has been recorded.`);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit response.");
    } finally {
      setRespondingAction(null);
    }
  };

  const levelConfig = intervention ? (LEVEL_CONFIG[intervention.level] || LEVEL_CONFIG[1]) : LEVEL_CONFIG[1];

  if (loading && !intervention && historyItems.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>Loading interventions...</Text>
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
          <Text style={styles.headerTitle}>Early Intervention</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalInterventions}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#10B981" }]}>{defaultsPrevented}</Text>
            <Text style={styles.summaryLabel}>Prevented</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: "#00C6AE" }]}>{preventionRate}%</Text>
            <Text style={styles.summaryLabel}>Success Rate</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "active" && styles.tabActive]}
          onPress={() => setActiveTab("active")}
        >
          <Ionicons
            name="notifications"
            size={16}
            color={activeTab === "active" ? "#00C6AE" : "#6B7280"}
          />
          <Text style={[styles.tabText, activeTab === "active" && styles.tabTextActive]}>
            Active{hasIntervention ? " (1)" : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "history" && styles.tabActive]}
          onPress={() => setActiveTab("history")}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={activeTab === "history" ? "#00C6AE" : "#6B7280"}
          />
          <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
            History ({historyItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {/* Active Tab */}
        {activeTab === "active" && (
          <>
            {!hasIntervention ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark" size={48} color="#10B981" />
                <Text style={styles.emptyTitle}>All Clear</Text>
                <Text style={styles.emptySubtitle}>
                  You have no active interventions. Keep up the good work!
                </Text>
              </View>
            ) : (
              <View style={[styles.interventionCard, { borderLeftColor: levelConfig.color, backgroundColor: levelConfig.bgColor }]}>
                {/* Level Badge */}
                <View style={styles.interventionHeader}>
                  <View style={[styles.levelBadge, { backgroundColor: levelConfig.color + "20" }]}>
                    <Ionicons name={levelConfig.icon as any} size={16} color={levelConfig.color} />
                    <Text style={[styles.levelText, { color: levelConfig.color }]}>
                      Level {intervention!.level} - {levelConfig.label}
                    </Text>
                  </View>
                  <Text style={styles.interventionDate}>
                    {new Date(intervention!.createdAt || intervention!.created_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Message */}
                <Text style={styles.interventionMessage}>
                  {intervention!.messageBody || intervention!.message || "You have a pending action that requires your attention."}
                </Text>

                {/* Channel Info */}
                {intervention!.channel && (
                  <View style={styles.channelRow}>
                    <Ionicons
                      name={
                        intervention!.channel === "push" ? "phone-portrait-outline" :
                        intervention!.channel === "sms" ? "chatbubble-outline" :
                        intervention!.channel === "email" ? "mail-outline" :
                        "notifications-outline"
                      }
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.channelText}>
                      via {intervention!.channel.charAt(0).toUpperCase() + intervention!.channel.slice(1)}
                    </Text>
                  </View>
                )}

                {/* Action Buttons */}
                {intervention!.status === "sent" && (
                  <TouchableOpacity style={styles.viewedBtn} onPress={markViewed}>
                    <Ionicons name="eye-outline" size={16} color="#3B82F6" />
                    <Text style={styles.viewedBtnText}>Mark as Viewed</Text>
                  </TouchableOpacity>
                )}

                {/* Options */}
                {hasOptions && intervention!.optionsOffered && (
                  <View style={styles.optionsSection}>
                    <Text style={styles.optionsTitle}>Available Actions</Text>
                    {intervention!.optionsOffered.map((option: any, index: number) => {
                      const optionKey = typeof option === "string" ? option : option.key || option.label;
                      const optionLabel = typeof option === "string" ? option : option.label || option.key;
                      const isResponding = respondingAction === optionKey;

                      return (
                        <TouchableOpacity
                          key={index}
                          style={styles.optionBtn}
                          onPress={() => handleRespond(optionKey)}
                          disabled={isResponding || respondingAction !== null}
                        >
                          {isResponding ? (
                            <ActivityIndicator size="small" color="#00C6AE" />
                          ) : (
                            <>
                              <Ionicons name="arrow-forward-circle" size={18} color="#00C6AE" />
                              <Text style={styles.optionBtnText}>{optionLabel}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Quick Actions */}
                {!hasOptions && intervention!.status !== "sent" && (
                  <View style={styles.quickActions}>
                    <TouchableOpacity
                      style={styles.payNowBtn}
                      onPress={() => handleRespond("pay_now")}
                      disabled={respondingAction !== null}
                    >
                      {respondingAction === "pay_now" ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="cash" size={16} color="#FFFFFF" />
                          <Text style={styles.payNowText}>Pay Now</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.planBtn}
                      onPress={() => handleRespond("request_plan")}
                      disabled={respondingAction !== null}
                    >
                      <Ionicons name="calendar-outline" size={16} color="#00C6AE" />
                      <Text style={styles.planBtnText}>Payment Plan</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <>
            {historyItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No History</Text>
                <Text style={styles.emptySubtitle}>Past interventions will appear here.</Text>
              </View>
            ) : (
              historyItems.map((item) => {
                const itemLevel = LEVEL_CONFIG[item.level] || LEVEL_CONFIG[1];
                const itemStatus = STATUS_CONFIG[item.status] || STATUS_CONFIG.sent;
                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View style={[styles.historyLevelDot, { backgroundColor: itemLevel.color }]}>
                        <Ionicons name={itemLevel.icon as any} size={12} color="#FFFFFF" />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>Level {item.level} - {itemLevel.label}</Text>
                        <Text style={styles.historyDate}>
                          {new Date(item.createdAt || item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={[styles.historyStatusBadge, { backgroundColor: itemStatus.color + "15" }]}>
                        <Ionicons name={itemStatus.icon as any} size={12} color={itemStatus.color} />
                        <Text style={[styles.historyStatusText, { color: itemStatus.color }]}>
                          {itemStatus.label}
                        </Text>
                      </View>
                    </View>

                    {item.messageBody || item.message ? (
                      <Text style={styles.historyMessage} numberOfLines={2}>
                        {item.messageBody || item.message}
                      </Text>
                    ) : null}

                    {item.defaultPrevented && (
                      <View style={styles.preventedBadge}>
                        <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                        <Text style={styles.preventedText}>Default Prevented</Text>
                      </View>
                    )}

                    {item.memberResponse && (
                      <View style={styles.responseBadge}>
                        <Ionicons name="chatbubble-ellipses-outline" size={12} color="#3B82F6" />
                        <Text style={styles.responseText}>Response: {item.memberResponse}</Text>
                      </View>
                    )}
                  </View>
                );
              })
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
  summaryRow: { flexDirection: "row", alignItems: "center", marginTop: 16, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, padding: 14 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  summaryLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  summaryDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.15)" },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: "#FFFFFF" },
  tabActive: { backgroundColor: "#00C6AE15", borderWidth: 1, borderColor: "#00C6AE" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  tabTextActive: { color: "#00C6AE" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: "#6B7280", marginTop: 4, textAlign: "center", paddingHorizontal: 24 },

  // Intervention Card
  interventionCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  interventionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  levelText: { fontSize: 12, fontWeight: "600" },
  interventionDate: { fontSize: 11, color: "#6B7280" },
  interventionMessage: { fontSize: 14, color: "#0A2342", lineHeight: 20, marginBottom: 12 },

  channelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  channelText: { fontSize: 12, color: "#6B7280" },

  viewedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#3B82F6", marginBottom: 10 },
  viewedBtnText: { fontSize: 13, fontWeight: "600", color: "#3B82F6" },

  // Options
  optionsSection: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 12 },
  optionsTitle: { fontSize: 13, fontWeight: "600", color: "#0A2342", marginBottom: 8 },
  optionBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: "#E5E7EB" },
  optionBtnText: { fontSize: 14, color: "#0A2342", fontWeight: "500" },

  // Quick Actions
  quickActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  payNowBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#00C6AE", paddingVertical: 12, borderRadius: 10 },
  payNowText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  planBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFFFFF", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "#00C6AE" },
  planBtnText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },

  // History Card
  historyCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  historyHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  historyLevelDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 8 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 13, fontWeight: "600", color: "#0A2342" },
  historyDate: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  historyStatusBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  historyStatusText: { fontSize: 11, fontWeight: "600" },
  historyMessage: { fontSize: 13, color: "#6B7280", lineHeight: 18, marginBottom: 6 },

  preventedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDF4", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  preventedText: { fontSize: 11, color: "#10B981", fontWeight: "600" },

  responseBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  responseText: { fontSize: 11, color: "#3B82F6", fontWeight: "500" },
});
