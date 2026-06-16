// components/MuteCircleSheet.tsx
// ─────────────────────────────────────────────────────────────────────────────
// P2 of the Notification preferences review. Bottom-sheet picker for
// muting circle-scoped notifications. Three durations + an Unmute
// row when the user already has an active mute.
//
// Mirrors AvatarPicker / MethodActionsSheet pattern.
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

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BORDER = "#E5E7EB";
const MUTED = "#6B7280";
const DANGER = "#EF4444";

export default function MuteCircleSheet({
  visible,
  circleName,
  isMuted,
  onClose,
  onMute,
  onUnmute,
}: {
  visible: boolean;
  circleName: string;
  isMuted: boolean;
  onClose: () => void;
  // Pass null for forever.
  onMute: (durationDays: number | null) => void;
  onUnmute: () => void;
}) {
  const { t } = useTranslation();

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

          <Text style={styles.title}>
            {t("mute_circle.title")}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {circleName}
          </Text>

          <Row
            icon="time-outline"
            label={t("mute_circle.week")}
            onPress={() => dispatch(() => onMute(7))}
          />
          <Row
            icon="calendar-outline"
            label={t("mute_circle.month")}
            onPress={() => dispatch(() => onMute(30))}
          />
          <Row
            icon="moon-outline"
            label={t("mute_circle.forever")}
            onPress={() => dispatch(() => onMute(null))}
          />

          {isMuted && (
            <Row
              icon="notifications-outline"
              label={t("mute_circle.unmute")}
              tone="active"
              onPress={() => dispatch(onUnmute)}
            />
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t("mute_circle.cancel")}</Text>
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
  tone?: "active";
  onPress: () => void;
}) {
  const fg = tone === "active" ? TEAL : NAVY;
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
  title: { fontSize: 16, fontWeight: "800", color: NAVY },
  subtitle: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 6,
  },
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
