// ═══════════════════════════════════════════════════════════════════════════
// components/FileDisputeModal.tsx — Phase 2, migration 261
// ═══════════════════════════════════════════════════════════════════════════
//
// Bottom-sheet-style modal that lets a circle member file a dispute against
// another member. Members are supplied by the caller (CircleDetailScreen
// already has them via useCircleDetail).
//
// Field "type" is not exposed to the user — defaults to 'member_complaint'
// on the RPC side.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFileDispute } from "../hooks/useDisputes";
import { showToast } from "./Toast";

export interface FileDisputeMember {
  /** auth user_id of the member (NOT the circle_members row id) */
  userId: string;
  name: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  circleId: string;
  members: FileDisputeMember[];
  /** Called with the new dispute id after a successful submit. */
  onFiled?: (disputeId: string) => void;
}

export default function FileDisputeModal({
  visible,
  onClose,
  circleId,
  members,
  onFiled,
}: Props) {
  const { t } = useTranslation();
  const { fileDispute, isSubmitting } = useFileDispute();

  const [againstId, setAgainstId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const canSubmit = useMemo(
    () =>
      !!againstId &&
      title.trim().length > 0 &&
      description.trim().length > 0 &&
      !isSubmitting,
    [againstId, title, description, isSubmitting],
  );

  const reset = () => {
    setAgainstId(null);
    setTitle("");
    setDescription("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || !againstId) return;
    try {
      const id = await fileDispute({
        circleId,
        againstUserId: againstId,
        title: title.trim(),
        description: description.trim(),
      });
      showToast(t("dispute.resolve_success"), "success");
      reset();
      onClose();
      onFiled?.(id);
    } catch (e: any) {
      showToast(e?.message ?? "Failed to file dispute", "error");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("dispute.file_modal_title")}</Text>
            <TouchableOpacity onPress={handleClose} accessibilityRole="button">
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Against */}
            <Text style={styles.label}>{t("dispute.against")}</Text>
            {members.length === 0 ? (
              <Text style={styles.helperText}>
                {t("circle_detail.empty_no_members")}
              </Text>
            ) : (
              <View style={styles.memberPicker}>
                {members.map((m) => {
                  const selected = m.userId === againstId;
                  return (
                    <TouchableOpacity
                      key={m.userId}
                      style={[
                        styles.memberChip,
                        selected && styles.memberChipSelected,
                      ]}
                      onPress={() => setAgainstId(m.userId)}
                    >
                      <Text
                        style={[
                          styles.memberChipText,
                          selected && styles.memberChipTextSelected,
                        ]}
                      >
                        {m.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Title */}
            <Text style={[styles.label, styles.labelSpaced]}>
              {t("dispute.file_modal_title")}
            </Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t("dispute.file_modal_title")}
              placeholderTextColor="#9CA3AF"
              maxLength={200}
            />

            {/* Description */}
            <Text style={[styles.label, styles.labelSpaced]}>
              {t("dispute.reason")}
            </Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={description}
              onChangeText={setDescription}
              placeholder={t("dispute.reason")}
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{t("dispute.submit")}</Text>
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
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingTop: 12,
    ...(Platform.OS === "ios"
      ? { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } }
      : { elevation: 16 }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  body: { paddingHorizontal: 20 },
  bodyContent: { paddingTop: 16, paddingBottom: 12 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  labelSpaced: { marginTop: 18 },
  helperText: { fontSize: 13, color: "#6B7280", fontStyle: "italic" },
  memberPicker: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
  },
  memberChipSelected: {
    backgroundColor: "#E0F2FE",
    borderColor: "#0284C7",
  },
  memberChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  memberChipTextSelected: { color: "#0369A1", fontWeight: "700" },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  submitBtn: {
    backgroundColor: "#00C6AE",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
