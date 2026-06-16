// ══════════════════════════════════════════════════════════════════════════════
// components/ReportButton.tsx — universal report-content / report-user sheet
// ══════════════════════════════════════════════════════════════════════════════
//
// Renders a small "flag" trigger that opens a bottom-sheet modal asking for
// a reason + optional details, then inserts into either content_reports or
// user_reports (depending on `kind`). One component, two surfaces.
//
// Props:
//   kind          – "content" | "user"
//   contentType   – required when kind="content": 'dream_post' | 'comment'
//                   | 'event' | 'circle_message'
//   targetId      – uuid of the content row, or of the reported user
//   ownerUserId   – the content author / target user. If this matches the
//                   current viewer's auth.uid(), we never render the
//                   button (you can't report yourself).
//   compact       – true for inline use inside a dense row (smaller hit area)
//   variant       – "icon" | "text" — defaults to "icon" (3-dot menu style).
//
// The trigger is a single icon TouchableOpacity. On press we open a Modal
// with the reason picker and a description box. Submit calls Supabase and
// shows a Toast on success/error. The component owns its own modal state —
// callers don't need to thread anything through.
//
// Schema lives in migration 152.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "./Toast";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const TEXT = "#111827";
const RED = "#DC2626";

export type ReportKind = "content" | "user";
export type ReportContentType =
  | "dream_post"
  | "comment"
  | "event"
  | "circle_message";

// Content reports accept 4 reasons; user reports add "impersonation"
// because it only applies to people. The schema CHECK enforces this.
const CONTENT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;
const USER_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "impersonation",
  "other",
] as const;

type Props = {
  kind: ReportKind;
  contentType?: ReportContentType;
  targetId: string;
  ownerUserId?: string;
  compact?: boolean;
  variant?: "icon" | "text";
};

export default function ReportButton({
  kind,
  contentType,
  targetId,
  ownerUserId,
  compact = false,
  variant = "icon",
}: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Don't render when there's nobody to report or you'd be reporting
  // yourself. The owner check is the most common skip path.
  if (!user?.id) return null;
  if (ownerUserId && ownerUserId === user.id) return null;

  const reasons = kind === "content" ? CONTENT_REASONS : USER_REASONS;

  const reset = () => {
    setReason(null);
    setDetails("");
  };

  const onClose = () => {
    if (submitting) return;
    setOpen(false);
    reset();
  };

  const onSubmit = async () => {
    if (!reason) {
      showToast(t("moderation.report_pick_reason"), "error");
      return;
    }
    setSubmitting(true);
    try {
      if (kind === "content") {
        if (!contentType) {
          showToast(t("moderation.report_missing_type"), "error");
          setSubmitting(false);
          return;
        }
        const { error } = await supabase.from("content_reports").insert({
          reporter_user_id: user.id,
          content_type: contentType,
          content_id: targetId,
          reason,
          details: details.trim() || null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_reports").insert({
          reporter_user_id: user.id,
          reported_user_id: targetId,
          reason,
          details: details.trim() || null,
        });
        if (error) {
          // The partial unique index on (reporter, reported) WHERE
          // status='pending' surfaces a duplicate report attempt as
          // postgres error 23505. Translate to a friendlier message.
          if ((error as any).code === "23505") {
            showToast(t("moderation.report_duplicate"), "info");
            setOpen(false);
            reset();
            setSubmitting(false);
            return;
          }
          throw error;
        }
      }
      showToast(t("moderation.report_thanks"), "success");
      setOpen(false);
      reset();
    } catch (e: any) {
      showToast(
        t("moderation.report_failed", { msg: e?.message ?? "error" }),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={compact ? styles.triggerCompact : styles.trigger}
        accessibilityRole="button"
        accessibilityLabel={t("moderation.report_btn")}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        {variant === "icon" ? (
          <Ionicons
            name="flag-outline"
            size={compact ? 14 : 16}
            color={MUTED}
          />
        ) : (
          <Text style={styles.triggerText}>{t("moderation.report_btn")}</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {kind === "content"
                ? t("moderation.sheet_title_content")
                : t("moderation.sheet_title_user")}
            </Text>
            <Text style={styles.sheetSub}>
              {t("moderation.sheet_sub")}
            </Text>

            <View style={styles.reasonsCol}>
              {reasons.map((r) => {
                const selected = reason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.reasonRow,
                      selected && styles.reasonRowActive,
                    ]}
                    onPress={() => setReason(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={selected ? TEAL : MUTED}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reasonLabel}>
                        {t(`moderation.reason_${r}_label`)}
                      </Text>
                      <Text style={styles.reasonHint}>
                        {t(`moderation.reason_${r}_hint`)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>
              {t("moderation.details_label")}
            </Text>
            <TextInput
              style={styles.input}
              value={details}
              onChangeText={setDetails}
              placeholder={t("moderation.details_placeholder")}
              placeholderTextColor={MUTED}
              multiline
              maxLength={500}
              editable={!submitting}
            />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
              >
                <Text style={styles.cancelBtnText}>
                  {t("moderation.btn_cancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (!reason || submitting) && styles.submitBtnDisabled,
                ]}
                onPress={onSubmit}
                disabled={!reason || submitting}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {t("moderation.btn_submit")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed-outline" size={12} color={MUTED} />
              <Text style={styles.privacyText}>
                {t("moderation.privacy_note")}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  triggerCompact: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  triggerText: {
    fontSize: 12,
    color: RED,
    fontWeight: "600",
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 35, 66, 0.55)",
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
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 16,
    lineHeight: 18,
  },

  reasonsCol: { gap: 8, marginBottom: 14 },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#F9FAFB",
  },
  reasonRowActive: {
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  reasonLabel: { fontSize: 13, fontWeight: "700", color: TEXT },
  reasonHint: { fontSize: 11, color: MUTED, marginTop: 2 },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 14,
  },

  actionsRow: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: MUTED },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: TEAL,
  },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitBtnText: { fontSize: 13, fontWeight: "800", color: "#FFFFFF" },

  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  privacyText: { fontSize: 11, color: MUTED, flex: 1 },
});
