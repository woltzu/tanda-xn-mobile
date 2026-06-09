import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useAuth } from "../context/AuthContext";
import { useKYCStatus, useKYCActions } from "../hooks/useKYCVerification";

// i18n: labelKey resolved per-render via t() so language flips re-paint
// without re-instantiating.
const KYC_STATUS_CONFIG: Record<string, { labelKey: string; color: string; icon: string }> = {
  approved: { labelKey: "kyc_verification.status_approved", color: "#10B981", icon: "checkmark-circle" },
  pending: { labelKey: "kyc_verification.status_pending", color: "#F59E0B", icon: "time" },
  provider_pending: { labelKey: "kyc_verification.status_provider_pending", color: "#3B82F6", icon: "hourglass" },
  provider_review: { labelKey: "kyc_verification.status_provider_review", color: "#8B5CF6", icon: "eye" },
  admin_review: { labelKey: "kyc_verification.status_admin_review", color: "#F59E0B", icon: "person" },
  rejected: { labelKey: "kyc_verification.status_rejected", color: "#EF4444", icon: "close-circle" },
  expired: { labelKey: "kyc_verification.status_expired", color: "#6B7280", icon: "alarm" },
  not_started: { labelKey: "kyc_verification.status_not_started", color: "#6B7280", icon: "document-outline" },
};

const TIER_LABELS: Record<number, { labelKey: string; descKey: string; icon: string }> = {
  0: { labelKey: "kyc_verification.tier_0_label", descKey: "kyc_verification.tier_0_desc", icon: "lock-closed" },
  1: { labelKey: "kyc_verification.tier_1_label", descKey: "kyc_verification.tier_1_desc", icon: "shield-outline" },
  2: { labelKey: "kyc_verification.tier_2_label", descKey: "kyc_verification.tier_2_desc", icon: "shield-half" },
  3: { labelKey: "kyc_verification.tier_3_label", descKey: "kyc_verification.tier_3_desc", icon: "shield-checkmark" },
};

const VERIFICATION_METHODS = [
  {
    key: "persona_standard" as const,
    labelKey: "kyc_verification.method_standard_label",
    descKey: "kyc_verification.method_standard_desc",
    icon: "card-outline",
    tier: 2,
  },
  {
    key: "persona_liveness" as const,
    labelKey: "kyc_verification.method_liveness_label",
    descKey: "kyc_verification.method_liveness_desc",
    icon: "camera-outline",
    tier: 3,
  },
];

export default function KYCVerificationScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [startingMethod, setStartingMethod] = useState<string | null>(null);

  const {
    verification,
    isVerified,
    isPending,
    isRejected,
    isExpired,
    needsReview,
    kycTier,
    canRetry,
    attemptsRemaining,
    hasDeadline,
    deadlineDays,
    loading,
    error,
    refresh,
  } = useKYCStatus(user?.id);

  const { initializeVerification, initiating } = useKYCActions();

  const handleStartVerification = async (method: "persona_standard" | "persona_liveness") => {
    if (!user?.id) return;

    setStartingMethod(method);
    try {
      const result = await initializeVerification(user.id, method);
      if (result?.inquiryUrl) {
        // WebViewScreen is now wired; navigate into it with the provider's
        // inquiry URL. Phase 0's "Coming Soon" Alert was the holding pattern
        // before this screen existed. Title kept consistent with what KYC
        // providers expect users to see in the header.
        navigation.navigate(Routes.WebView, {
          url: result.inquiryUrl,
          title: t("kyc_verification.webview_title"),
        });
      } else if (result?.inquiryId) {
        Alert.alert(t("kyc_verification.alert_started_title"), t("kyc_verification.alert_started_body"));
        refresh();
      }
    } catch (err: any) {
      Alert.alert(t("kyc_verification.alert_error_title"), err.message || t("kyc_verification.alert_error_default"));
    } finally {
      setStartingMethod(null);
    }
  };

  const statusConfig = KYC_STATUS_CONFIG[verification?.status || "not_started"] || KYC_STATUS_CONFIG.not_started;
  const tierInfo = TIER_LABELS[kycTier] || TIER_LABELS[0];

  if (loading && !verification) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.loadingText}>{t("kyc_verification.loading")}</Text>
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
          <Text style={styles.headerTitle}>{t("kyc_verification.header")}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusCircle, { borderColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={36} color={statusConfig.color} />
          </View>
          <Text style={styles.statusLabel}>{t(statusConfig.labelKey)}</Text>
          <View style={styles.tierPill}>
            <Ionicons name={tierInfo.icon as any} size={14} color="#FFFFFF" />
            <Text style={styles.tierPillText}>{t("kyc_verification.tier_pill", { tier: kycTier, label: t(tierInfo.labelKey) })}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Deadline Warning */}
        {hasDeadline && deadlineDays != null && deadlineDays <= 14 && (
          <View style={styles.warningBanner}>
            <Ionicons name="alarm" size={18} color="#F59E0B" />
            <View style={styles.warningInfo}>
              <Text style={styles.warningTitle}>{t("kyc_verification.deadline_title")}</Text>
              <Text style={styles.warningText}>
                {deadlineDays === 0
                  ? t("kyc_verification.deadline_today")
                  : deadlineDays === 1
                    ? t("kyc_verification.deadline_one")
                    : t("kyc_verification.deadline_other", { count: deadlineDays })}
              </Text>
            </View>
          </View>
        )}

        {/* Current Status Detail */}
        {verification && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="information-circle" size={18} color="#3B82F6" />
              <Text style={styles.cardTitle}>{t("kyc_verification.details_title")}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("kyc_verification.details_status")}</Text>
              <View style={[styles.detailBadge, { backgroundColor: statusConfig.color + "15" }]}>
                <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
                <Text style={[styles.detailBadgeText, { color: statusConfig.color }]}>{t(statusConfig.labelKey)}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("kyc_verification.details_type")}</Text>
              <Text style={styles.detailValue}>
                {verification.kycType === "fallback" ? t("kyc_verification.details_type_fallback") : t("kyc_verification.details_type_full")}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t("kyc_verification.details_tier")}</Text>
              <Text style={styles.detailValue}>{t("kyc_verification.details_tier_value", { tier: kycTier, label: t(tierInfo.labelKey) })}</Text>
            </View>

            {verification.verifiedAt && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("kyc_verification.details_verified_on")}</Text>
                <Text style={styles.detailValue}>
                  {new Date(verification.verifiedAt).toLocaleDateString()}
                </Text>
              </View>
            )}

            {isRejected && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>{t("kyc_verification.details_attempts")}</Text>
                <Text style={[styles.detailValue, { color: attemptsRemaining <= 1 ? "#EF4444" : "#0A2342" }]}>
                  {attemptsRemaining}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Verified State */}
        {isVerified && (
          <View style={styles.successCard}>
            <Ionicons name="shield-checkmark" size={40} color="#10B981" />
            <Text style={styles.successTitle}>{t("kyc_verification.success_title")}</Text>
            <Text style={styles.successText}>
              {t("kyc_verification.success_text")}
            </Text>

            {kycTier < 3 && (
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => handleStartVerification("persona_liveness")}
                disabled={initiating}
              >
                <Ionicons name="arrow-up-circle" size={16} color="#8B5CF6" />
                <Text style={styles.upgradeBtnText}>{t("kyc_verification.upgrade_btn")}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pending State */}
        {isPending && (
          <View style={styles.pendingCard}>
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text style={styles.pendingTitle}>{t("kyc_verification.pending_title")}</Text>
            <Text style={styles.pendingText}>
              {needsReview
                ? t("kyc_verification.pending_text_review")
                : t("kyc_verification.pending_text_processing")}
            </Text>
          </View>
        )}

        {/* Start / Retry Verification */}
        {(!verification || isRejected || isExpired) && (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="rocket-outline" size={18} color="#00C6AE" />
              <Text style={styles.cardTitle}>
                {isRejected ? t("kyc_verification.retry_title") : t("kyc_verification.start_title")}
              </Text>
            </View>

            {isRejected && !canRetry && (
              <View style={styles.blockedBanner}>
                <Ionicons name="hand-left" size={16} color="#EF4444" />
                <Text style={styles.blockedText}>
                  {t("kyc_verification.blocked_text")}
                </Text>
              </View>
            )}

            {(!isRejected || canRetry) && (
              <>
                <Text style={styles.methodsIntro}>
                  {t("kyc_verification.methods_intro")}
                </Text>

                {VERIFICATION_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={styles.methodCard}
                    onPress={() => handleStartVerification(method.key)}
                    disabled={initiating}
                  >
                    <View style={styles.methodIcon}>
                      <Ionicons name={method.icon as any} size={24} color="#00C6AE" />
                    </View>
                    <View style={styles.methodInfo}>
                      <Text style={styles.methodLabel}>{t(method.labelKey)}</Text>
                      <Text style={styles.methodDesc}>{t(method.descKey)}</Text>
                      <View style={styles.methodTier}>
                        <Ionicons name="shield-outline" size={12} color="#8B5CF6" />
                        <Text style={styles.methodTierText}>{t("kyc_verification.method_tier_hint", { tier: method.tier })}</Text>
                      </View>
                    </View>
                    {startingMethod === method.key ? (
                      <ActivityIndicator size="small" color="#00C6AE" />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* Tier Breakdown */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="layers-outline" size={18} color="#0A2342" />
            <Text style={styles.cardTitle}>{t("kyc_verification.tiers_title")}</Text>
          </View>

          {Object.entries(TIER_LABELS).map(([tier, info]) => {
            const tierNum = Number(tier);
            const isCurrent = tierNum === kycTier;
            const isUnlocked = tierNum <= kycTier;
            return (
              <View key={tier} style={[styles.tierRow, isCurrent && styles.tierRowActive]}>
                <View style={[styles.tierDot, { backgroundColor: isUnlocked ? "#10B981" : "#D1D5DB" }]}>
                  {isUnlocked ? (
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.tierDotText}>{tier}</Text>
                  )}
                </View>
                <View style={styles.tierInfo}>
                  <Text style={[styles.tierLabel, isCurrent && { fontWeight: "700", color: "#0A2342" }]}>
                    {t(info.labelKey)}
                  </Text>
                  <Text style={styles.tierDesc}>{t(info.descKey)}</Text>
                </View>
                {isCurrent && (
                  <View style={styles.currentPill}>
                    <Text style={styles.currentPillText}>{t("kyc_verification.current_pill")}</Text>
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

  // Status
  statusContainer: { alignItems: "center", marginTop: 20 },
  statusCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginTop: 10 },
  tierPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginTop: 8 },
  tierPillText: { fontSize: 12, color: "#FFFFFF", fontWeight: "500" },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  errorText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Warning
  warningBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FFFBEB", padding: 14, borderRadius: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
  warningInfo: { flex: 1 },
  warningTitle: { fontSize: 14, fontWeight: "700", color: "#92400E" },
  warningText: { fontSize: 13, color: "#92400E", marginTop: 2 },

  // Card
  card: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0A2342" },

  // Detail Rows
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  detailLabel: { fontSize: 13, color: "#6B7280" },
  detailValue: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  detailBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  detailBadgeText: { fontSize: 12, fontWeight: "600" },

  // Success
  successCard: { alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 12, padding: 24, marginBottom: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  successTitle: { fontSize: 18, fontWeight: "700", color: "#10B981", marginTop: 10 },
  successText: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, lineHeight: 20 },
  upgradeBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, backgroundColor: "#8B5CF615", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  upgradeBtnText: { fontSize: 13, fontWeight: "600", color: "#8B5CF6" },

  // Pending
  pendingCard: { alignItems: "center", backgroundColor: "#EFF6FF", borderRadius: 12, padding: 24, marginBottom: 12, borderWidth: 1, borderColor: "#BFDBFE" },
  pendingTitle: { fontSize: 18, fontWeight: "700", color: "#3B82F6", marginTop: 14 },
  pendingText: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, lineHeight: 20 },

  // Blocked
  blockedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 10, marginBottom: 12 },
  blockedText: { fontSize: 13, color: "#EF4444", flex: 1 },

  // Methods
  methodsIntro: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  methodCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 12, backgroundColor: "#F5F7FA", marginBottom: 8 },
  methodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#00C6AE15", alignItems: "center", justifyContent: "center", marginRight: 12 },
  methodInfo: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: "600", color: "#0A2342" },
  methodDesc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  methodTier: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  methodTierText: { fontSize: 11, color: "#8B5CF6", fontWeight: "500" },

  // Tier Breakdown
  tierRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  tierRowActive: { backgroundColor: "#F5F7FA", borderRadius: 8, paddingHorizontal: 8, marginHorizontal: -8 },
  tierDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 10 },
  tierDotText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  tierInfo: { flex: 1 },
  tierLabel: { fontSize: 14, color: "#0A2342" },
  tierDesc: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  currentPill: { backgroundColor: "#00C6AE15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  currentPillText: { fontSize: 11, fontWeight: "600", color: "#00C6AE" },
});
