// ══════════════════════════════════════════════════════════════════════════════
// screens/AccountTiersExplainedScreen.tsx — KYC-006 tier comparison
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params (optional): { tier?: 1 | 2 | 3 }
//   defaults to 1 ("Basic" — email + phone only). Phase KYC-2 will
//   read the real tier from the user_verification table via context.
//
// Shows three tier cards (Basic / Verified / Full Access), each with
// a feature list rendered as included (✓) or locked-out (✗). The
// current tier card gets a "CURRENT" badge, completed (lower) tiers
// get a "COMPLETE" badge with a green check, and the *next* tier card
// surfaces an Upgrade button that routes per spec:
//
//   - Upgrade to Tier 2 (Verified)    → IDVerificationStart
//   - Upgrade to Tier 3 (Full Access) → TaxIDEntry
//
// Bottom Continue → VerificationHub (which becomes the hub page once
// the user is mid-flow). Label changes to "Done" when already tier 3.
//
// Translated from KYC screens/06_AccountTiersExplained.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const GREEN = "#059669";

type TierLevel = 1 | 2 | 3;

// i18n: nameKey/requirementKey/textKey resolved per-render via t() at call site.
type Tier = {
  level: TierLevel;
  nameKey: string;
  icon: string;
  requirementKey: string;
  color: string;
  features: { textKey: string; included: boolean }[];
};

const TIERS: Tier[] = [
  {
    level: 1,
    nameKey: "account_tiers.tier_basic_name",
    icon: "🌱",
    requirementKey: "account_tiers.tier_basic_req",
    color: MUTED,
    features: [
      { textKey: "account_tiers.tier_basic_feat_1", included: true },
      { textKey: "account_tiers.tier_basic_feat_2", included: true },
      { textKey: "account_tiers.tier_basic_feat_3", included: true },
      { textKey: "account_tiers.tier_basic_feat_4", included: true },
      { textKey: "account_tiers.tier_basic_feat_5", included: false },
      { textKey: "account_tiers.tier_basic_feat_6", included: false },
      { textKey: "account_tiers.tier_basic_feat_7", included: false },
    ],
  },
  {
    level: 2,
    nameKey: "account_tiers.tier_verified_name",
    icon: "✨",
    requirementKey: "account_tiers.tier_verified_req",
    color: "#3B82F6",
    features: [
      { textKey: "account_tiers.tier_verified_feat_1", included: true },
      { textKey: "account_tiers.tier_verified_feat_2", included: true },
      { textKey: "account_tiers.tier_verified_feat_3", included: true },
      { textKey: "account_tiers.tier_verified_feat_4", included: true },
      { textKey: "account_tiers.tier_verified_feat_5", included: false },
      { textKey: "account_tiers.tier_verified_feat_6", included: false },
    ],
  },
  {
    level: 3,
    nameKey: "account_tiers.tier_full_name",
    icon: "🏆",
    requirementKey: "account_tiers.tier_full_req",
    color: TEAL,
    features: [
      { textKey: "account_tiers.tier_full_feat_1", included: true },
      { textKey: "account_tiers.tier_full_feat_2", included: true },
      { textKey: "account_tiers.tier_full_feat_3", included: true },
      { textKey: "account_tiers.tier_full_feat_4", included: true },
      { textKey: "account_tiers.tier_full_feat_5", included: true },
      { textKey: "account_tiers.tier_full_feat_6", included: true },
    ],
  },
];

type AccountTiersParams = { tier?: TierLevel };
type AccountTiersRouteProp = RouteProp<
  { AccountTiersExplained: AccountTiersParams },
  "AccountTiersExplained"
>;

export default function AccountTiersExplainedScreen() {
  const navigation = useTypedNavigation();
  const { t } = useTranslation();
  const route = useRoute<AccountTiersRouteProp>();
  const currentTier = route.params?.tier ?? 1;
  const currentTierData = TIERS[currentTier - 1];

  const handleUpgrade = (targetLevel: TierLevel) => {
    if (targetLevel === 2) {
      navigation.navigate(Routes.IDVerificationStart);
    } else if (targetLevel === 3) {
      navigation.navigate(Routes.TaxIDEntry);
    }
  };

  const handleContinue = () => {
    navigation.navigate(Routes.KYCHub);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient
          colors={[NAVY, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={t("account_tiers.a11y_back")}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{t("screen_headers.account_tiers")}</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.headerSubtitle}>
            {t("account_tiers.header_subtitle")}
          </Text>
        </LinearGradient>

        <View style={styles.contentWrap}>
          {/* Current level badge */}
          <View style={styles.currentLevelCard}>
            <View
              style={[
                styles.currentLevelIcon,
                { backgroundColor: currentTierData.color },
              ]}
            >
              <Text style={styles.currentLevelEmoji}>
                {currentTierData.icon}
              </Text>
            </View>
            <View>
              <Text style={styles.currentLevelLabel}>{t("account_tiers.current_level_label")}</Text>
              <Text style={styles.currentLevelName}>
                {t("account_tiers.tier_name_label", { level: currentTier, name: t(currentTierData.nameKey) })}
              </Text>
            </View>
          </View>

          {/* Tier cards */}
          <View style={styles.tiersList}>
            {TIERS.map((tier) => {
              const isCurrent = tier.level === currentTier;
              const isLocked = tier.level > currentTier;
              const isCompleted = tier.level < currentTier;
              const isNext = tier.level === currentTier + 1;

              return (
                <View
                  key={tier.level}
                  style={[
                    styles.tierCard,
                    isCurrent && {
                      borderWidth: 2,
                      borderColor: tier.color,
                      margin: -1,
                    },
                    isLocked && { opacity: 0.7 },
                  ]}
                >
                  {/* Status badge */}
                  {isCurrent && (
                    <View
                      style={[
                        styles.tierBadge,
                        { backgroundColor: tier.color },
                      ]}
                    >
                      <Text style={styles.tierBadgeText}>{t("account_tiers.badge_current")}</Text>
                    </View>
                  )}
                  {isCompleted && (
                    <View
                      style={[styles.tierBadge, { backgroundColor: GREEN }]}
                    >
                      <Text style={styles.tierBadgeText}>{t("account_tiers.badge_complete")}</Text>
                    </View>
                  )}

                  {/* Tier header */}
                  <View style={styles.tierHeader}>
                    <View
                      style={[
                        styles.tierIconBox,
                        {
                          backgroundColor: isLocked
                            ? "#F5F7FA"
                            : `${tier.color}20`,
                        },
                      ]}
                    >
                      <Text style={styles.tierIcon}>
                        {isLocked ? "🔒" : tier.icon}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tierName}>
                        {t("account_tiers.tier_name_label", { level: tier.level, name: t(tier.nameKey) })}
                      </Text>
                      <Text style={styles.tierRequirement}>
                        {t("account_tiers.requires_label", { req: t(tier.requirementKey) })}
                      </Text>
                    </View>
                  </View>

                  {/* Features */}
                  <View style={styles.featuresList}>
                    {tier.features.map((feature, fIdx) => (
                      <View key={fIdx} style={styles.featureRow}>
                        {feature.included ? (
                          <Ionicons name="checkmark" size={16} color={GREEN} />
                        ) : (
                          <Ionicons
                            name="close-circle-outline"
                            size={16}
                            color="#D1D5DB"
                          />
                        )}
                        <Text
                          style={[
                            styles.featureText,
                            !feature.included && styles.featureTextDisabled,
                          ]}
                        >
                          {t(feature.textKey)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Upgrade button for next tier */}
                  {isNext && (
                    <TouchableOpacity
                      style={[styles.upgradeButton, { backgroundColor: tier.color }]}
                      onPress={() => handleUpgrade(tier.level)}
                      accessibilityRole="button"
                      accessibilityLabel={t("account_tiers.a11y_upgrade", { name: t(tier.nameKey) })}
                    >
                      <Text style={styles.upgradeButtonText}>
                        {t("account_tiers.btn_upgrade", { name: t(tier.nameKey) })}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* ITIN note */}
          <View style={styles.itinCallout}>
            <Text style={styles.itinEmoji}>💡</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.itinTitle}>
                {t("account_tiers.itin_title")}
              </Text>
              <Text style={styles.itinBody}>
                {t("account_tiers.itin_body")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
          accessibilityRole="button"
          accessibilityLabel={
            currentTier < 3 ? t("account_tiers.a11y_continue") : t("account_tiers.a11y_done")
          }
        >
          <Text style={styles.continueButtonText}>
            {currentTier < 3 ? t("account_tiers.btn_continue") : t("account_tiers.btn_done")}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F7FA" },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20 },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },

  contentWrap: { padding: 20 },

  currentLevelCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  currentLevelIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  currentLevelEmoji: { fontSize: 24 },
  currentLevelLabel: { fontSize: 12, color: MUTED },
  currentLevelName: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },

  tiersList: { gap: 16 },

  tierCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    position: "relative",
  },
  tierBadge: {
    position: "absolute",
    top: -10,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 1,
  },
  tierBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  tierHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  tierIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tierIcon: { fontSize: 22 },
  tierName: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
  },
  tierRequirement: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },

  featuresList: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: {
    fontSize: 13,
    color: "#374151",
    flex: 1,
  },
  featureTextDisabled: {
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },

  upgradeButton: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  itinCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
  },
  itinEmoji: { fontSize: 18 },
  itinTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E40AF",
  },
  itinBody: {
    fontSize: 12,
    color: "#3B82F6",
    lineHeight: 18,
    marginTop: 4,
  },

  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  continueButton: {
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: TEAL,
    alignItems: "center",
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
