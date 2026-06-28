// ═══════════════════════════════════════════════════════════════════════════
// components/BulkActionBar.tsx — sticky bottom bar for bulk admin actions
// ═══════════════════════════════════════════════════════════════════════════
//
// Renders when selectedCount > 0. Left: count + "Clear". Right: action
// buttons (primary / danger / secondary). Sits over the screen via
// absolute positioning at the bottom so it doesn't displace content.
// ═══════════════════════════════════════════════════════════════════════════

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors, typography, spacing } from "../theme/tokens";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

export interface BulkAction {
  key: string;
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "secondary";
  disabled?: boolean;
}

interface Props {
  selectedCount: number;
  actions: BulkAction[];
  onClearSelection: () => void;
  busy?: boolean;
}

export default function BulkActionBar({
  selectedCount,
  actions,
  onClearSelection,
  busy,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  if (selectedCount === 0) return null;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, 8) + 8 },
      ]}
    >
      <View style={styles.left}>
        <Text style={styles.count}>
          {t("admin_bulk.selected_count", { count: selectedCount })}
        </Text>
        <TouchableOpacity
          onPress={onClearSelection}
          style={styles.clearBtn}
          disabled={busy}
        >
          <Text style={styles.clearText}>
            {t("admin_bulk.clear_selection")}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
      >
        {actions.map((a) => (
          <TouchableOpacity
            key={a.key}
            onPress={a.onPress}
            disabled={busy || a.disabled}
            style={[
              styles.btn,
              a.variant === "danger" && styles.btnDanger,
              a.variant === "secondary" && styles.btnSecondary,
              (busy || a.disabled) && styles.btnDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.btnText,
                  a.variant === "secondary" && styles.btnTextSecondary,
                ]}
              >
                {a.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 6,
    elevation: 12,
    zIndex: 100,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  count: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  clearText: { fontSize: 12, color: MUTED, fontWeight: typography.bold },
  actionsRow: { flexDirection: "row", gap: 8, paddingBottom: 2 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: TEAL,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDanger: { backgroundColor: "#DC2626" },
  btnSecondary: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#FFFFFF", fontWeight: typography.bold, fontSize: 13 },
  btnTextSecondary: { color: NAVY },
});
