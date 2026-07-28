// ═══════════════════════════════════════════════════════════════════════════
// components/FrozenBanner.tsx — mig 390
// ═══════════════════════════════════════════════════════════════════════════
//
// Sticky top-of-app banner for account-frozen users. Sits alongside
// CriticalBanner (same App-layout mount) — both can appear together in
// the rare intersection case. Blue color to visually differ from the
// red critical bar.
//
// Tap opens an Alert with the freeze reason (populated by
// admin_freeze_account) and a Contact Support entry.
//
// The banner renders nothing for non-frozen users or while loading,
// so the cost is zero for the ~100% of accounts that are never frozen.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useFreezeStatus } from "../hooks/useFreezeStatus";

const SUPPORT_EMAIL = "support@tandaxn.com";

const FrozenBanner: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isFrozen, reason, isLoading } = useFreezeStatus(user?.id);

  if (isLoading || !isFrozen || !user) return null;

  const handleTap = () => {
    const body = reason
      ? t("account_frozen.detail_body_with_reason", { reason })
      : t("account_frozen.detail_body_no_reason");
    Alert.alert(t("account_frozen.detail_title"), body, [
      {
        text: t("account_frozen.contact_support"),
        onPress: () => {
          const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            t("account_frozen.email_subject"),
          )}`;
          Linking.openURL(url).catch(() => {
            // Non-mailto environment (web without a mail handler): fall
            // back to a plain alert so the user at least sees the address.
            Alert.alert(SUPPORT_EMAIL);
          });
        },
      },
      { text: t("account_frozen.dismiss"), style: "cancel" },
    ]);
  };

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={handleTap}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={t("account_frozen.banner_text")}
    >
      <Ionicons name="snow" size={18} color="#FFFFFF" />
      <Text style={styles.bannerText} numberOfLines={1}>
        {t("account_frozen.banner_text")}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

export default FrozenBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0369A1",
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingTop: Platform.OS === "ios" ? 12 : 10,
  },
  bannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
