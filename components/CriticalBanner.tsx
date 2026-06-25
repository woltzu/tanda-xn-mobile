// ═══════════════════════════════════════════════════════════════════════════
// components/CriticalBanner.tsx — Phase 2 Bucket B
// ═══════════════════════════════════════════════════════════════════════════
//
// Sticky banner that appears at the top of every screen when the signed-in
// user is in critical tier. Tapping routes to ResolutionCenter where they
// can see the reason + request a review.
//
// Mounted once at App-layout level (not per screen) so the user always sees
// it regardless of navigation state. Renders nothing for non-critical users
// or while loading, so the cost of the banner across the entire app is
// zero for the 99%+ of users who are never demoted.
//
// Returning-user critical history (matching across separate accounts) is
// not implemented — see migration 249 header note. Banner currently fires
// on the current account's live tier only.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useResolutionStatus } from "../hooks/useResolutionStatus";

const CriticalBanner: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { isCritical, isLoading } = useResolutionStatus(user?.id);

  if (isLoading || !isCritical || !user) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={() => navigation.navigate("ResolutionCenter")}
      accessibilityRole="button"
      accessibilityLabel={t("resolution_center.banner_text")}
    >
      <Ionicons name="warning" size={18} color="#FFFFFF" />
      <Text style={styles.bannerText} numberOfLines={1}>
        {t("resolution_center.banner_text")}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

export default CriticalBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 10,
    // Sit below the OS status bar; SafeAreaView will handle the inset
    // when mounted inside a Stack screen, but at root we need a small
    // top padding on iOS to clear the notch area.
    paddingTop: Platform.OS === "ios" ? 12 : 10,
  },
  bannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
