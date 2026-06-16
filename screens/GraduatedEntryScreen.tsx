import React from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useMemberTier, useTierProgress, useTierLimits } from "../hooks/useGraduatedEntry";
import { getTierByKeyOrFallback, getNextTier, TIER_CATALOG } from "../lib/tiers";
import { Routes } from "../lib/routes";

// Bucket A canonical refactor — the legacy TIER_CONFIG had stale
// bronze/silver/gold/platinum keys that never existed in the live DB. The
// catalog at lib/tiers.ts is the single source of truth. Use
// getTierByKeyOrFallback() at render time for color/icon/label.

export default function GraduatedEntryScreen() {
  const { t } = useTranslation();

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
    demotionPathBack,
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

  const tierConfig = getTierByKeyOrFallback(currentTier);
  const nextTierConfig = getTierByKeyOrFallback(nextTier);
  // Bucket B P1.2 — benefit comparison. `nextTierForBenefits` is null at
  // the top of the ladder, which lets the render path show a "Top tier
  // reached" indicator instead of a misleading "next tier" line.
  const nextTierForBenefits = getNextTier(currentTier);

  // Formatters that work on raw catalog fields — used to compute the next
  // tier's value alongside the current one. The current-tier values come
  // from useTierLimits' pre-formatted strings; for parity we render the
  // catalog fields ourselves so both columns use the same vocabulary.
  const formatCircleSize = (size: number | null): string => {
    if (size === null) return t("graduated_entry.benefit_unlimited");
    if (size === 0) return t("graduated_entry.benefit_none");
    return t("graduated_entry.benefit_n_members", { n: size });
  };
  const formatContribution = (cents: number | null): string => {
    if (cents === null) return t("graduated_entry.benefit_unlimited");
    if (cents === 0) return "$0";
    return t("graduated_entry.benefit_per_month", {
      amount: (cents / 100).toLocaleString(),
    });
  };
  const formatPositionAccess = (p: string): string =>
    p === "any"
      ? t("graduated_entry.position_any")
      : p === "middle_only"
        ? t("graduated_entry.position_middle")
        : t("graduated_entry.position_none");

  if (loading && !tier) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>{t("graduated_entry.loading")}</Text>
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
          <Text style={styles.headerTitle}>{t("screen_headers.graduated_entry")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Tier Badge */}
        <View style={styles.tierBadgeContainer}>
          <LinearGradient colors={[tierConfig.color, tierConfig.bgColor]} style={styles.tierBadge}>
            <Text style={{ fontSize: 28, marginRight: 6 }}>{tierConfig.icon}</Text>
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

        {/* Bucket B P1.3 — demotion path-back action card.
            Renders only for demoted members. Shows what tier they fell to,
            what to focus on, an optional DB-provided narrative
            (demotion_path_back), and chip-buttons that route to the
            specific screens where the recovery work happens. */}
        {isDemoted && (
          <View style={[styles.card, styles.demotionCard]}>
            <View style={styles.demotionHeaderRow}>
              <Ionicons name="arrow-down-circle" size={20} color="#EF4444" />
              <Text style={styles.demotionTitle}>
                {t("demotion.title", { tier: tierConfig.label })}
              </Text>
            </View>
            <Text style={styles.demotionBody}>
              {tier?.previousTier
                ? t("demotion.body_with_prev", {
                    previousTier: getTierByKeyOrFallback(tier.previousTier).label,
                  })
                : t("demotion.body_generic")}
            </Text>
            {demotionReason ? (
              <Text style={styles.demotionReason}>
                {t("demotion.reason_label")}: {demotionReason}
              </Text>
            ) : null}
            {demotionPathBack ? (
              <Text style={styles.demotionPathBack}>{demotionPathBack}</Text>
            ) : null}
            <View style={styles.demotionActionsRow}>
              <TouchableOpacity
                style={styles.demotionChip}
                onPress={() => navigation.navigate(Routes.ScoreHub)}
                accessibilityRole="button"
                accessibilityLabel={t("demotion.action_boost_score")}
              >
                <Ionicons name="trending-up" size={14} color="#0A2342" />
                <Text style={styles.demotionChipText}>
                  {t("demotion.action_boost_score")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demotionChip}
                onPress={() => {
                  const parent = navigation.getParent?.();
                  if (parent) parent.navigate("Circles");
                  else navigation.navigate("Circles");
                }}
                accessibilityRole="button"
                accessibilityLabel={t("demotion.action_complete_circles")}
              >
                <Ionicons name="people" size={14} color="#0A2342" />
                <Text style={styles.demotionChipText}>
                  {t("demotion.action_complete_circles")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Progress Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="trending-up" size={18} color="#00C6AE" />
            <Text style={styles.cardTitle}>{t("graduated_entry.card_progress")}</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>{tierConfig.label}</Text>
              <Text style={styles.progressLabel}>
                {nextTierDef ? nextTierConfig.label : "Max Tier"}
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
              <Text style={styles.statLabel}>{t("final_polish.graduatedentry_xn_score")}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="calendar" size={20} color="#3B82F6" />
              <Text style={styles.statValue}>{accountAge}d</Text>
              <Text style={styles.statLabel}>{t("graduated_entry.stat_account_age")}</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
              <Text style={styles.statValue}>{circlesCompleted}</Text>
              <Text style={styles.statLabel}>{t("graduated_entry.stat_completed")}</Text>
            </View>
          </View>
        </View>

        {/* Limits Card */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="lock-open-outline" size={18} color="#8B5CF6" />
            <Text style={styles.cardTitle}>{t("graduated_entry.card_limits")}</Text>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="people" size={18} color="#3B82F6" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>{t("graduated_entry.label_max_circle_size")}</Text>
              <Text style={styles.limitValue}>{maxCircleSizeFormatted}</Text>
              {nextTierForBenefits ? (
                <View style={styles.limitNextRow}>
                  <Ionicons name="arrow-up" size={11} color="#10B981" />
                  <Text style={styles.limitNextText}>
                    {t("graduated_entry.benefit_next_label", {
                      tier: nextTierForBenefits.label,
                      value: formatCircleSize(nextTierForBenefits.maxCircleSize),
                    })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.limitMaxTier}>
                  {t("graduated_entry.benefit_max_tier_label")}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="cash" size={18} color="#10B981" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>{t("graduated_entry.label_max_contribution")}</Text>
              <Text style={styles.limitValue}>{maxContributionFormatted}</Text>
              {nextTierForBenefits ? (
                <View style={styles.limitNextRow}>
                  <Ionicons name="arrow-up" size={11} color="#10B981" />
                  <Text style={styles.limitNextText}>
                    {t("graduated_entry.benefit_next_label", {
                      tier: nextTierForBenefits.label,
                      value: formatContribution(nextTierForBenefits.maxContributionCents),
                    })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.limitMaxTier}>
                  {t("graduated_entry.benefit_max_tier_label")}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.limitRow}>
            <View style={styles.limitIcon}>
              <Ionicons name="swap-horizontal" size={18} color="#F59E0B" />
            </View>
            <View style={styles.limitInfo}>
              <Text style={styles.limitLabel}>{t("graduated_entry.label_position_access")}</Text>
              <Text style={styles.limitValue}>{formatPositionAccess(positionAccess)}</Text>
              {nextTierForBenefits ? (
                nextTierForBenefits.positionAccess !== positionAccess ? (
                  <View style={styles.limitNextRow}>
                    <Ionicons name="arrow-up" size={11} color="#10B981" />
                    <Text style={styles.limitNextText}>
                      {t("graduated_entry.benefit_next_label", {
                        tier: nextTierForBenefits.label,
                        value: formatPositionAccess(nextTierForBenefits.positionAccess),
                      })}
                    </Text>
                  </View>
                ) : null
              ) : (
                <Text style={styles.limitMaxTier}>
                  {t("graduated_entry.benefit_max_tier_label")}
                </Text>
              )}
            </View>
            {positionRestrictions.middleOnly && (
              <View style={styles.restrictionBadge}>
                <Text style={styles.restrictionText}>{t("graduated_entry.tag_limited")}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Items Card */}
        {actionItems.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="list-circle" size={18} color="#F59E0B" />
              <Text style={styles.cardTitle}>{t("final_polish.graduatedentry_to_advance")}</Text>
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
            <Text style={styles.cardTitle}>{t("graduated_entry.card_all_tiers")}</Text>
          </View>

          {TIER_CATALOG
            .filter((tier) => tier.tierKey !== "critical")
            .map((tier) => {
              const isCurrent = tier.tierKey === currentTier;
              return (
                <View key={tier.tierKey} style={[styles.tierRow, isCurrent && styles.tierRowActive]}>
                  <View style={[styles.tierDot, { backgroundColor: tier.color }]}>
                    <Text style={{ fontSize: 12 }}>{tier.icon}</Text>
                  </View>
                  <Text style={[styles.tierRowLabel, isCurrent && { fontWeight: "700", color: tier.color }]}>
                    {tier.label}
                  </Text>
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: tier.color + "15" }]}>
                      <Text style={[styles.currentBadgeText, { color: tier.color }]}>{t("graduated_entry.badge_current")}</Text>
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

  // Bucket B P1.2 — benefit next-tier comparison line
  limitNextRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  limitNextText: { fontSize: 11, color: "#10B981", fontWeight: "600" },
  limitMaxTier: { fontSize: 11, color: "#8B5CF6", fontWeight: "600", marginTop: 4 },

  // Bucket B P1.3 — demotion path-back card
  demotionCard: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  demotionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  demotionTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#991B1B" },
  demotionBody: { fontSize: 13, color: "#0A2342", lineHeight: 19, marginBottom: 6 },
  demotionReason: { fontSize: 12, color: "#7F1D1D", marginBottom: 6, fontStyle: "italic" },
  demotionPathBack: { fontSize: 12, color: "#7F1D1D", marginBottom: 10, lineHeight: 18 },
  demotionActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  demotionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  demotionChipText: { fontSize: 12, color: "#0A2342", fontWeight: "700" },

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
