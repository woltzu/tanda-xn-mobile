// components/MethodActionsSheet.tsx
// ─────────────────────────────────────────────────────────────────────────────
// P1 (payment-methods review): bottom-sheet action menu opened when the
// user taps the ⋮ on a saved payment method row in LinkedAccountsScreen.
// Replaces the stacked Alert.alert / Alert.alert chain used in P0 with a
// single sheet that matches the patterns in AvatarPicker.tsx,
// EmailChangeModal.tsx, and CountryPicker.tsx.
//
// Caller wiring:
//   <MethodActionsSheet
//     visible={openMethod !== null}
//     method={openMethod}
//     onClose={() => setOpenMethod(null)}
//     onSetPrimary={handleSetPrimary}
//     onRemove={handleRemoveAccount}
//   />
//
// The sheet does NOT confirm "are you sure?" inline for Remove — the
// caller's handler shows a destructive-style Alert (kept from P0 because
// removal is irreversible). Set-Primary is single-tap; the screen toast
// confirms the change.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SavedPaymentMethod } from "../context/PaymentContext";

const NAVY = "#0A2342";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const DANGER = "#EF4444";
const TEAL = "#00C6AE";

export default function MethodActionsSheet({
  visible,
  method,
  onClose,
  onSetPrimary,
  onRemove,
}: {
  visible: boolean;
  method: SavedPaymentMethod | null;
  onClose: () => void;
  onSetPrimary: (m: SavedPaymentMethod) => void;
  onRemove: (m: SavedPaymentMethod) => void;
}) {
  const { t } = useTranslation();

  // Pick the right "•••• xxxx" subtitle without leaking placeholder data.
  const last4 =
    method?.bankLast4 ?? method?.cardLast4 ?? null;

  // Tapping a row should close the sheet THEN invoke the handler, so the
  // sheet animates away before any follow-on Alert (Remove) opens. We
  // schedule the action on the next frame for the same reason.
  const dispatch = (fn: () => void) => {
    onClose();
    setTimeout(fn, 0);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          {method ? (
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {method.label}
              </Text>
              {last4 ? (
                <Text style={styles.subtitle}>{`•••• ${last4}`}</Text>
              ) : null}
              {method.isDefault ? (
                <View style={styles.primaryPill}>
                  <Ionicons name="checkmark-circle" size={11} color={TEAL} />
                  <Text style={styles.primaryPillText}>
                    {t("linked_accounts_v2.badge_primary")}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {method && !method.isDefault ? (
            <Row
              icon="star-outline"
              label={t("linked_accounts_v2.action_set_primary")}
              onPress={() => dispatch(() => onSetPrimary(method))}
            />
          ) : null}
          {method ? (
            <Row
              icon="trash-outline"
              label={t("linked_accounts_v2.action_remove")}
              tone="danger"
              onPress={() => dispatch(() => onRemove(method))}
            />
          ) : null}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>
              {t("linked_accounts_v2.action_cancel")}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: "danger";
  onPress: () => void;
}) {
  const fg = tone === "danger" ? DANGER : NAVY;
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={20} color={fg} />
      <Text style={[styles.rowLabel, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,35,66,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  header: {
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 6,
  },
  title: { fontSize: 16, fontWeight: "800", color: NAVY },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 2 },
  primaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F0FDFB",
  },
  primaryPillText: { fontSize: 10, fontWeight: "800", color: TEAL },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: MUTED },
});
