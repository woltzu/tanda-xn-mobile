// ═══════════════════════════════════════════════════════════════════════════
// components/AdminErrorState.tsx — admin-screen load-failure surface
// ═══════════════════════════════════════════════════════════════════════════
//
// Rendered in place of a list/detail body when the initial fetch errors
// out. Icon + i18n'd message + retry button. The screens were silently
// swallowing errors before this — the user saw a blank list and didn't
// know whether to refresh or wait.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";

interface AdminErrorStateProps {
  onRetry: () => void;
  message?: string;
}

export default function AdminErrorState({ onRetry, message }: AdminErrorStateProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
      <Text style={styles.message}>{message ?? t("admin.load_failed")}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Ionicons name="refresh" size={16} color="#FFFFFF" />
        <Text style={styles.retryText}>{t("admin.retry")}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: spacing.xl,
  },
  message: {
    fontSize: typography.body,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.accentTeal,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.card,
    marginTop: 4,
  },
  retryText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
});
