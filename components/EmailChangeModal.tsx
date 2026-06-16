// components/EmailChangeModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Bottom-sheet modal launched from PersonalInfoScreen's email row.
// Collects a new email address, validates it, and calls
// AuthContext.requestEmailChange — which in turn calls
// supabase.auth.updateUser({ email }) to fire Supabase's confirmation
// link to the new address.
//
// Until the user clicks that link:
//   - auth.users.email still points to the OLD address (login keeps
//     working with the old email).
//   - auth.users.new_email holds the pending address (PersonalInfoScreen
//     renders a "Pending verification" badge keyed off it).
//
// After they click, AuthCallbackScreen finalises the change and Supabase
// swaps email ↔ new_email. The 167 trigger does NOT touch email — see
// the migration header for why.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const DANGER = "#EF4444";
const SUCCESS_BG = "#ECFDF5";
const SUCCESS_FG = "#047857";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailChangeModal({
  visible,
  currentEmail,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  currentEmail: string;
  onClose: () => void;
  onSubmitted: (newEmail: string) => void;
}) {
  const { t } = useTranslation();
  const { requestEmailChange } = useAuth();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Reset local state every time the sheet reopens. Otherwise the
  // previous attempt's value / sent panel leaks back in.
  useEffect(() => {
    if (visible) {
      setValue("");
      setBusy(false);
      setError(null);
      setSentTo(null);
    }
  }, [visible]);

  const trimmed = value.trim().toLowerCase();
  const canSubmit =
    !busy &&
    trimmed.length > 0 &&
    EMAIL_RE.test(trimmed) &&
    trimmed !== currentEmail.toLowerCase();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await requestEmailChange(trimmed);
      setSentTo(trimmed);
      onSubmitted(trimmed);
    } catch (e: any) {
      setError(e?.message ?? t("email_change.err_submit"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={busy ? undefined : onClose}
    >
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t("email_change.title")}</Text>
          <Text style={styles.subtitle}>{t("email_change.description")}</Text>

          {sentTo ? (
            // Success state — replaces the form once the email has been
            // queued. Closing the sheet from here keeps the form
            // dismissed; reopening it shows a fresh blank form.
            <View style={styles.successPanel}>
              <Ionicons name="mail-outline" size={20} color={SUCCESS_FG} />
              <Text style={styles.successText}>
                {t("email_change.sent_to", { email: sentTo })}
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.label}>{t("email_change.current_label")}</Text>
              <View style={[styles.inputRow, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={18} color={MUTED} />
                <Text style={styles.inputDisabledText} numberOfLines={1}>
                  {currentEmail}
                </Text>
              </View>

              <Text style={styles.label}>{t("email_change.new_label")}</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail" size={18} color={NAVY} />
                <TextInput
                  style={styles.input}
                  value={value}
                  onChangeText={setValue}
                  placeholder={t("email_change.new_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!busy}
                  autoFocus
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {t("email_change.send_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={busy ? undefined : onClose}
            disabled={busy}
          >
            <Text style={styles.cancelText}>
              {sentTo ? t("email_change.close") : t("email_change.cancel")}
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
  title: { fontSize: 17, fontWeight: "800", color: NAVY },
  subtitle: { fontSize: 13, color: MUTED, marginTop: 6, marginBottom: 18 },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  inputDisabled: { backgroundColor: "#F9FAFB" },
  inputDisabledText: { flex: 1, fontSize: 14, color: MUTED },
  input: { flex: 1, fontSize: 15, color: NAVY },
  error: { fontSize: 12, color: DANGER, marginTop: 4, marginBottom: 4 },
  submitBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  successPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SUCCESS_BG,
    padding: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  successText: { flex: 1, fontSize: 13, color: SUCCESS_FG, fontWeight: "600" },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: MUTED },
});
