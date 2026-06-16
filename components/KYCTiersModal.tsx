// ══════════════════════════════════════════════════════════════════════════════
// components/KYCTiersModal.tsx — KYC P1 tier-explainer modal
// ══════════════════════════════════════════════════════════════════════════════
//
// Replaces the standalone `AccountTiersExplainedScreen` (501 LoC) from
// Universe A. Same content, surfaced inline as a modal triggered by the
// (?) icon next to the current tier on KYCHubScreen.
//
// Tiers map to the engine's kycTier: 0 = Unverified, 1 = Basic,
// 2 = Standard, 3 = Enhanced. The current tier gets a highlight ring.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";

type Props = {
  visible: boolean;
  currentTier: number;
  onClose: () => void;
};

type TierConfig = {
  tier: 0 | 1 | 2 | 3;
  icon: keyof typeof Ionicons.glyphMap;
  emoji: string;
  color: string;
};

const TIERS: TierConfig[] = [
  { tier: 0, icon: "lock-closed", emoji: "🔒", color: "#6B7280" },
  { tier: 1, icon: "shield-outline", emoji: "🌱", color: "#3B82F6" },
  { tier: 2, icon: "shield-half", emoji: "✨", color: "#00C6AE" },
  { tier: 3, icon: "shield-checkmark", emoji: "🏆", color: "#8B5CF6" },
];

export default function KYCTiersModal({
  visible,
  currentTier,
  onClose,
}: Props) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t("kyc_tiers_modal.title")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t("kyc_tiers_modal.close")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.intro}>{t("kyc_tiers_modal.intro")}</Text>

          <ScrollView
            style={{ maxHeight: 420 }}
            showsVerticalScrollIndicator={false}
          >
            {TIERS.map((tier) => {
              const isCurrent = tier.tier === currentTier;
              return (
                <View
                  key={tier.tier}
                  style={[
                    styles.row,
                    isCurrent && {
                      borderColor: tier.color,
                      backgroundColor: `${tier.color}10`,
                    },
                  ]}
                >
                  <View
                    style={[styles.iconBox, { backgroundColor: `${tier.color}22` }]}
                  >
                    <Ionicons
                      name={tier.icon}
                      size={20}
                      color={tier.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTitleRow}>
                      <Text style={styles.rowTitle}>
                        {t(`kyc_tiers_modal.tier_${tier.tier}_title`)}
                      </Text>
                      {isCurrent ? (
                        <View
                          style={[
                            styles.youBadge,
                            { backgroundColor: tier.color },
                          ]}
                        >
                          <Text style={styles.youBadgeText}>
                            {t("kyc_tiers_modal.you_are_here")}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowBody}>
                      {t(`kyc_tiers_modal.tier_${tier.tier}_body`)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.dismissBtnText}>
              {t("kyc_tiers_modal.dismiss")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  intro: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.cardBg,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  rowBody: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  youBadgeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  dismissBtn: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.primaryNavy,
  },
  dismissBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
