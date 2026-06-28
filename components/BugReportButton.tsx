// ═══════════════════════════════════════════════════════════════════════════
// components/BugReportButton.tsx — floating bug-report FAB + modal
// ═══════════════════════════════════════════════════════════════════════════
//
// Mounted globally near PayoutListener in App.tsx (inside the auth-gated
// tree, so it only renders for signed-in users). Opens a modal that
// captures description + optional screenshot, then inserts a
// bug_reports row with screen_name (from BugReportContext) + device
// info + app version.
//
// Storage: screenshot uploads to the private `bug-screenshots` bucket
// under `<uid>/<timestamp>-<rand>.jpg`. We store a 30-day signed URL
// on the row (consistent with AvatarPicker); admin tooling can
// re-sign if it expires.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useBugReportScreen } from "../context/BugReportContext";
import { showToast } from "./Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";
const MAX_DESCRIPTION = 1000;
const SCREENSHOT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type UploadState = "idle" | "uploading" | "uploaded" | "failed";

function collectDeviceInfo() {
  const platform =
    Platform.OS === "web"
      ? "web"
      : `${Platform.OS}${Platform.Version ? ` ${Platform.Version}` : ""}`;
  return {
    platform,
    os: Platform.OS,
    os_version: String(Platform.Version ?? ""),
    is_web: Platform.OS === "web",
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent ?? null : null,
  };
}

export default function BugReportButton() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { screenName } = useBugReportScreen();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");

  // FAB only shows for signed-in users — bug_reports.user_id is NOT NULL
  // and RLS requires auth.uid() = user_id.
  if (!user?.id) return null;

  const resetForm = useCallback(() => {
    setDescription("");
    setLocalImageUri(null);
    setUploadState("idle");
  }, []);

  const handleOpen = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    resetForm();
  }, [submitting, resetForm]);

  const handlePickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setLocalImageUri(result.assets[0].uri);
      setUploadState("idle");
    } catch (e) {
      console.warn("[BugReportButton] pick failed", e);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setLocalImageUri(null);
    setUploadState("idle");
  }, []);

  const uploadScreenshot = useCallback(
    async (uri: string): Promise<string | null> => {
      if (!user?.id) return null;
      setUploadState("uploading");
      try {
        // Resize to max 1600 long-edge so triage previews stay snappy
        // without sacrificing detail.
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1600 } }],
          { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG },
        );
        const buf = await fetch(manipulated.uri).then((r) => r.arrayBuffer());
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;
        const path = `${user.id}/${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("bug-screenshots")
          .upload(path, buf, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from("bug-screenshots")
          .createSignedUrl(path, SCREENSHOT_SIGNED_URL_TTL_SECONDS);
        if (signErr || !signed?.signedUrl) {
          throw signErr ?? new Error("createSignedUrl returned empty");
        }
        setUploadState("uploaded");
        return signed.signedUrl;
      } catch (e) {
        console.warn("[BugReportButton] upload failed", e);
        setUploadState("failed");
        return null;
      }
    },
    [user?.id],
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    const desc = description.trim();
    if (!desc) {
      showToast(t("bug_report.invalid_description"), "error");
      return;
    }
    setSubmitting(true);
    try {
      let screenshotUrl: string | null = null;
      if (localImageUri) {
        screenshotUrl = await uploadScreenshot(localImageUri);
        // Upload failure is non-fatal — the textual report still ships.
      }

      const appVersion =
        (Constants?.expoConfig as { version?: string } | undefined)?.version ??
        null;

      const { error: insErr } = await supabase.from("bug_reports").insert({
        user_id: user!.id,
        screen_name: screenName || "Unknown",
        description: desc,
        screenshot_url: screenshotUrl,
        device_info: collectDeviceInfo(),
        app_version: appVersion,
      });
      if (insErr) throw new Error(insErr.message);

      showToast(t("bug_report.success"), "success");
      setOpen(false);
      resetForm();
    } catch (e: any) {
      console.warn("[BugReportButton] submit failed", e);
      showToast(e?.message ?? t("bug_report.error"), "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    description,
    localImageUri,
    uploadScreenshot,
    user,
    screenName,
    t,
    resetForm,
  ]);

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t("bug_report.report_button")}
        style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 80 }]}
        onPress={handleOpen}
        activeOpacity={0.85}
      >
        <Ionicons name="bug-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.backdrop}
        >
          <View style={styles.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.title}>{t("bug_report.title")}</Text>
              <Text style={styles.subtitle}>{t("bug_report.subtitle")}</Text>

              <View style={styles.screenRow}>
                <Text style={styles.screenLabel}>
                  {t("bug_report.screen_label")}
                </Text>
                <Text style={styles.screenValue} numberOfLines={1}>
                  {screenName}
                </Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder={t("bug_report.description_placeholder")}
                placeholderTextColor={MUTED}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={MAX_DESCRIPTION}
                editable={!submitting}
              />

              {localImageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Image
                    source={{ uri: localImageUri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={handleRemoveImage}
                    disabled={submitting}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  {uploadState === "uploading" ? (
                    <View style={styles.imageBadge}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.attachBtn}
                  onPress={handlePickImage}
                  disabled={submitting}
                >
                  <Ionicons name="image-outline" size={18} color={TEAL} />
                  <Text style={styles.attachText}>
                    {t("bug_report.attach_screenshot")}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, submitting && styles.btnDisabled]}
                  onPress={handleClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelText}>{t("bug_report.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, submitting && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitText}>
                      {t("bug_report.submit")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
    zIndex: 9999,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    maxHeight: "90%",
  },
  sheetContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  subtitle: {
    fontSize: typography.body,
    color: MUTED,
  },
  screenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  screenLabel: { fontSize: typography.label, color: MUTED },
  screenValue: {
    fontSize: typography.label,
    color: NAVY,
    fontWeight: typography.bold,
    flexShrink: 1,
    textAlign: "right",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    minHeight: 120,
    textAlignVertical: "top",
    color: NAVY,
    fontSize: typography.body,
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 10,
    paddingVertical: spacing.sm,
  },
  attachText: { color: TEAL, fontSize: typography.body, fontWeight: typography.medium },
  imagePreviewWrap: {
    position: "relative",
    width: "100%",
    height: 160,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  imagePreview: { width: "100%", height: "100%" },
  imageRemoveBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  imageBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  cancelText: { color: MUTED, fontWeight: typography.medium },
  submitBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: TEAL,
    minWidth: 120,
    alignItems: "center",
  },
  submitText: { color: "#FFFFFF", fontWeight: typography.bold },
  btnDisabled: { opacity: 0.6 },
});
