// ══════════════════════════════════════════════════════════════════════════════
// components/NewRecipientModal.tsx — add-recipient bottom sheet.
// ══════════════════════════════════════════════════════════════════════════════
//
// Opened from DomesticSendMoneyScreen via "Add new recipient" button. Collects
// name + method + identifier, persists via saveRecipient(), and surfaces the
// saved row back through onSaved so the parent can auto-select.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import {
  saveRecipient,
  type RecipientMethod,
  type SavedRecipient,
} from "../hooks/useRecipients";

type Props = {
  visible: boolean;
  userId: string | undefined;
  onClose: () => void;
  onSaved: (recipient: SavedRecipient) => void;
  /**
   * Optional pre-fill values, supplied by the contact picker. Each is loaded
   * into the form on mount AND whenever they change (so re-opening with a
   * new picked contact replaces the previous draft).
   */
  initialName?: string;
  initialIdentifier?: string;
  initialMethod?: RecipientMethod;
};

const METHODS: { id: RecipientMethod; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "wallet", icon: "wallet-outline" },
  { id: "bank", icon: "business-outline" },
  { id: "mobile", icon: "phone-portrait-outline" },
  { id: "cash", icon: "cash-outline" },
];

export default function NewRecipientModal({
  visible,
  userId,
  onClose,
  onSaved,
  initialName,
  initialIdentifier,
  initialMethod,
}: Props) {
  const { t } = useTranslation();

  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [method, setMethod] = useState<RecipientMethod>("wallet");
  const [submitting, setSubmitting] = useState(false);

  // Apply pre-fill values when the modal opens or when the caller swaps them
  // in (e.g., user picks a different contact). Only fires on visibility flip
  // to "open" so manual edits aren't blown away while the modal is up.
  useEffect(() => {
    if (!visible) return;
    setName(initialName ?? "");
    setIdentifier(initialIdentifier ?? "");
    setMethod(initialMethod ?? "wallet");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialName, initialIdentifier, initialMethod]);

  const resetForm = () => {
    setName("");
    setIdentifier("");
    setMethod("wallet");
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert(
        t("new_recipient_modal.auth_title"),
        t("new_recipient_modal.auth_body"),
      );
      return;
    }
    if (!name.trim() || !identifier.trim()) {
      Alert.alert(
        t("new_recipient_modal.validation_title"),
        t("new_recipient_modal.validation_body"),
      );
      return;
    }

    setSubmitting(true);
    const { row, error } = await saveRecipient(
      {
        name: name.trim(),
        identifier: identifier.trim(),
        method,
      },
      userId,
    );
    setSubmitting(false);

    if (error || !row) {
      Alert.alert(
        t("new_recipient_modal.error_title"),
        t("new_recipient_modal.error_body"),
      );
      return;
    }

    resetForm();
    onSaved(row);
    onClose();
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

          <Text style={styles.title}>
            {t("new_recipient_modal.title")}
          </Text>
          <Text style={styles.subtitle}>
            {t("new_recipient_modal.subtitle")}
          </Text>

          {/* Name */}
          <Text style={styles.label}>
            {t("new_recipient_modal.field_name")}
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t("new_recipient_modal.field_name_placeholder")}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="words"
          />

          {/* Method */}
          <Text style={styles.label}>
            {t("new_recipient_modal.field_method")}
          </Text>
          <View style={styles.methodRow}>
            {METHODS.map((m) => {
              const selected = m.id === method;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.methodChip,
                    selected && styles.methodChipSelected,
                  ]}
                  onPress={() => setMethod(m.id)}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={selected ? colors.textWhite : colors.primaryNavy}
                  />
                  <Text
                    style={[
                      styles.methodChipText,
                      selected && styles.methodChipTextSelected,
                    ]}
                  >
                    {t(`new_recipient_modal.method_${m.id}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Identifier */}
          <Text style={styles.label}>
            {t("new_recipient_modal.field_identifier")}
          </Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder={t(
              `new_recipient_modal.field_identifier_placeholder_${method}`,
            )}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
          />
          <Text style={styles.hint}>
            {t("new_recipient_modal.identifier_hint")}
          </Text>

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={onClose}
              disabled={submitting}
              accessibilityRole="button"
            >
              <Text style={styles.btnSecondaryText}>
                {t("new_recipient_modal.btn_cancel")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnPrimary,
                submitting && styles.btnPrimaryDisabled,
              ]}
              onPress={handleSave}
              disabled={submitting}
              accessibilityRole="button"
            >
              {submitting ? (
                <ActivityIndicator color={colors.textWhite} size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>
                  {t("new_recipient_modal.btn_save")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 6,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.screenBg,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 42,
  },
  hint: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
  },
  methodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  methodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodChipSelected: {
    backgroundColor: colors.primaryNavy,
    borderColor: colors.primaryNavy,
  },
  methodChipText: {
    fontSize: 13,
    color: colors.primaryNavy,
    fontWeight: "600",
  },
  methodChipTextSelected: {
    color: colors.textWhite,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderColor: colors.primaryNavy,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: colors.primaryNavy,
    fontWeight: "600",
    fontSize: 14,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.accentTeal,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    color: colors.textWhite,
    fontWeight: "700",
    fontSize: 14,
  },
});
