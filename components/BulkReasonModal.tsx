// ═══════════════════════════════════════════════════════════════════════════
// components/BulkReasonModal.tsx — confirm-with-reason for bulk admin ops
// ═══════════════════════════════════════════════════════════════════════════
//
// Shared confirmation modal for bulk suspend/reactivate/close/cancel.
// Shows a title with the action name and selected count, a multiline
// reason TextInput (optional), Cancel/Confirm. Mirrors the inline
// modals already used on AdminUserDetail + AdminTripDetail so the
// admin UI is visually consistent.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useTranslation } from "react-i18next";
import { colors, typography, spacing } from "../theme/tokens";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Props {
  visible: boolean;
  action: string; // e.g. "Suspend" — substituted into i18n templates
  count: number;
  variant?: "primary" | "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export default function BulkReasonModal({
  visible,
  action,
  count,
  variant = "primary",
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {t("admin_bulk.bulk_confirm_title", { action })}
          </Text>
          <Text style={styles.message}>
            {t("admin_bulk.bulk_confirm_message", { action, count })}
          </Text>
          <TextInput
            style={styles.input}
            placeholder={t("admin_bulk.bulk_reason_placeholder")}
            placeholderTextColor={MUTED}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            maxLength={500}
            editable={!busy}
          />
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={busy}
              style={[styles.cancelBtn, busy && styles.disabled]}
            >
              <Text style={styles.cancelText}>
                {t("admin.users.modal_cancel")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(reason.trim())}
              disabled={busy}
              style={[
                styles.confirmBtn,
                variant === "danger" && styles.confirmBtnDanger,
                busy && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>
                  {t("admin.users.modal_confirm")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  message: { fontSize: typography.body, color: NAVY },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    color: NAVY,
    fontSize: typography.body,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  cancelText: { color: MUTED, fontWeight: typography.medium },
  confirmBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: TEAL,
    minWidth: 96,
    alignItems: "center",
  },
  confirmBtnDanger: { backgroundColor: "#DC2626" },
  confirmText: { color: "#FFFFFF", fontWeight: typography.bold },
  disabled: { opacity: 0.6 },
});
