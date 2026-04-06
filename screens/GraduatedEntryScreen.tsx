import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { useMemberTier, useTierProgress, useTierLimits } from "../hooks/useGraduatedEntry";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; gradient: [string, string] }> = {
  newcomer: { label: "Newcomer", color: "#6B7280", icon: "person-outline", gradient: ["#6B7280", "#9CA3AF"] },
  bronze: { label: "Bronze", color: "#CD7F32", icon: "shield-outline", gradient: ["#CD7F32", "#D4A574"] },
  silver: { label: "Silver", color: "#C0C0C0", icon: "shield-half", gradient: ["#9CA3AF", "#C0C0C0"] },
  gold: { label: "Gold", color: "#F59E0B", icon: "shield", gradient: ["#F59E0B", "#FBBF24"] },
  platinum: { label: "Platinum", color: "#8B5CF6", icon: "diamond", gradient: ["#8B5CF6", "#A78BFA"] },
  critical: { label: "Critical", color: "#EF4444", icon: "warning", gradient: ["#EF4444", "#F87171"] },
};

export default function GraduatedEntryScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const {
    tier,
    tierDef,
    nextTierDef,
    limits,
    actionItems,
    progressPct,
    isDemoted,
    demotionReason,
    loading: tierLoading,
    error: tierError,
    refetch: refetchTier,
  } = useMemberTier();

  const {
    currentTier,
    currentTierDef: progressTierDef,
    nextTier,
    xnScore,
    accountAge,
    circlesCompleted,
    loading: progressLoading,
    refetch: refetchProgress,
  } = useTierProgress();

  const {
    maxCircleSize,
    maxContributionCents,
    positionAccess,
    positionRestrictions,
    maxContributionFormatted,
    maxCircleSizeFormatted,
    loading: limitsLoading,
    refetch: refetchLimits,
  } = useTierLimits();

  const loading = tierLoading || progressLoading || limitsLoading;

  const handleRefresh = () => {
    refetchTier();
    refetchProgress();
    refetchLimits();
  };

  const tierConfig = TIER_CONFIG[currentTier] || TIER_CONFIG.newcomer;

  if (loading && !tier) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>Loading tier status...</Text>
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
          <Text style={styles.headerTitle}>My Tier Status</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tier Badge */}
        <View style={styles.tierBadgeContainer}>
          <LinearGradient colors={tierConfig.gradient} style={styles.tierBadge}>
            <Ionicons name={tierConfig.icon as any} size={32} color="#FFFFFF" />
            <Text style={styles.tierName}>{tierConfig.label}</Text>
          </LinearGradient>
          {isDemoted && (
            <View style={styles.demotionBanner}>
              <Ionicons name="arrow-down-circle" size={14} color="#EF4444" />
              <Text style={styles.demotionText}>Demoted: {demotionReason || "Performance review"}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {tierError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{tierError}</Text>
          </View>
        )}

        {/* Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trending-up" size={18} color="#00C6AE" />
            <Text style={styles.cardTitle}>Tier Progress</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{tierConfig.label}</Text>
              <Text style={styles.progressLabel}>
                {nextTierDef ? TIER_CONFIG[nextTier || ""]?.label || "Next Tier" : "Max Tier"}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progressPct, 100)}%`, backgroundColor: tierConfig.color }]} />
            </View>
            <Text style={styles.progressPct}>{Math.round(progressPct)}% complete</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="star" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>{xnScore}</Text>
              <Text style={styles.statLabel}>XN Score</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={20} color="#3B82F6" />
              <Text style={styles.statValue}>{accountAge}d</Text>
              <Text style={styles.statLabel}>Account Age</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
              <Text style={styles.statValue}>{circlesCompleted}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Limits Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="lock-open-outline" size={18} color="#8B5CF6" />
            <Text style={styles.cardTitle}>Your Tier Limits</Text>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="people" size={18} color="#3B82F6" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>Max Circle Size</Text>
              <Text style={styles.limitValue}>{maxCircleSizeFormatted}</Text>
            </View>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="cash" size={18} color="#10B981" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>Max Contribution</Text>
              <Text style={styles.limitValue}>{maxContributionFormatted}</Text>
            </View>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="swap-horizontal" size={18} color="#F59E0B" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>Position Access</Text>
              <Text style={styles.limitValue}>
                {positionAccess === "any"
                  ? "All positions"
                  : positionAccess === "middle_only"
                  ? "Middle positions only"
                  : "Restricted"}
              </Text>
            </View>
            {positionRestrictions.middleOnly && (
              <View style={styles.restrictionBadge}>
                <Text style={styles.restrictionText}>Limited</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Items Card */}
        {actionItems.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="list-circle" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>To Advance</Text>
            </View>

            {actionItems.map((item: any, index: number) => (
              <View key={index} style={styles.actionItem}>
                <View style={[styles.actionDot, { backgroundColor: item.completed ? "#10B981" : "#D1D5DB" }]}>
                  {item.completed && <Ionicons name="checkmark" size={10} color="#FFFFFF" />}
                </View>
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionText, item.completed && styles.actionTextDone]}>
                    {item.label || item.description || `Action ${index + 1}`}
                  </Text>
                  {item.progress != null && (
                    <View style={styles.actionProgressBg}>
                      <View style={[styles.actionProgressFill, { width: `${Math.min(item.progress, 100)}%` }]} />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Tier Definitions */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="layers-outline" size={18} color="#0A2342" />
            <Text style={styles.cardTitle}>All Tiers</Text>
          </View>

          {Object.entries(TIER_CONFIG)
            .filter(([key]) => key !== "critical")
            .map(([key, config]) => {
              const isCurrent = key === currentTier;
              return (
                <View key={key} style={[styles.tierRow, isCurrent && styles.tierRowActive]}>
                  <View style={[styles.tierDot, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon as any} size={14} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.tierRowLabel, isCurrent && { fontWeight: "700", color: config.color }]}>
                    {config.label}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: config.color + "15" }]}>
                      <Text style={[styles.currentBadgeText, { color: config.color }]}>Current</Text>
                    </View>
                  )}
                </View>
              );
            })}
        </View>

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
  header: { paddingTop: 56, paddingBottom: 24, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },

  // Tier Badge
  tierBadgeContainer: { alignItems: "center", marginTop: 20 },
  tierBadge: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  tierName: { fontSize: 12, fontWeight: "700", color: "#FFFFFF", marginTop: 4 },
  demotionBanner: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10, backgroundColor: "rgba(239,68,68,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  demotionText: { fontSize: 12, color: "#EF4444", fontWeight: "600" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Card
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342" },

  // Progress
  progressSection: { marginBottom: 16 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  progressLabel: { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  progressBarBg: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressPct: { fontSize: 12, color: "#6B7280", marginTop: 4, textAlign: "right" },

  // Stats Grid
  statsGrid: { flexDirection: "row", gap: 8 },
  statCard: { flex: 1, alignItems: "center", backgroundColor: "#F5F7FA", borderRadius: 10, paddingVertical: 12 },
  statValue: { fontSize: 18, fontWeight: "700", color: "#0A2342", marginTop: 4 },
  statLabel: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  // Limits
  limitRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  limitIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F7FA", alignItems: "center", justifyContent: "center", marginRight: 12 },
  limitInfo: { flex: 1 },
  limitLabel: { fontSize: 12, color: "#6B7280" },
  limitValue: { fontSize: 15, fontWeight: "600", color: "#0A2342", marginTop: 2 },
  restrictionBadge: { backgroundColor: "#F59E0B15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  restrictionText: { fontSize: 11, color: "#F59E0B", fontWeight: "600" },

  // Action Items
  actionItem: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 10 },
  actionDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  actionInfo: { flex: 1 },
  actionText: { fontSize: 14, color: "#0A2342" },
  actionTextDone: { color: "#9CA3AF", textDecorationLine: "line-through" },
  actionProgressBg: { height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, marginTop: 6, overflow: "hidden" },
  actionProgressFill: { height: 4, backgroundColor: "#00C6AE", borderRadius: 2 },

  // Tier List
  tierRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tierRowActive: { backgroundColor: "#F5F7FA", borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  tierDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 10 },
  tierRowLabel: { flex: 1, fontSize: 14, color: "#0A2342" },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currentBadgeText: { fontSize: 11, fontWeight: "600" },
});
