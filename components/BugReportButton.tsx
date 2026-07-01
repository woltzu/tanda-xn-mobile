// ═══════════════════════════════════════════════════════════════════════════
// components/BugReportButton.tsx — floating feedback FAB (bugs + ideas)
// ═══════════════════════════════════════════════════════════════════════════
//
// Mounted globally near PayoutListener in App.tsx (inside the auth-gated
// tree, so it only renders for signed-in users). Tap → chooser ("Report
// a bug" / "Share an idea"). Each path opens a form that captures
// the current screen name (from BugReportContext) plus device info,
// uploads an optional screenshot to the private bug-screenshots bucket,
// then inserts a bug_reports row.
//
// Schema (mig 273 + mig 282): bug_reports.type = 'bug' | 'idea'.
//   • Bug    — description (required), screenshot (optional).
//   • Idea   — title (required), category (chip select), description
//              (required), help_why (optional), screenshot (optional).
// The component name stays "BugReportButton" so App.tsx and any other
// importers don't need to change; the user-facing copy is i18n'd via
// the `feedback.*` namespace so the chooser reads neutral.
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
const MAX_TITLE = 80;
const MAX_HELP_WHY = 500;
const SCREENSHOT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

type UploadState = "idle" | "uploading" | "uploaded" | "failed";
type Mode = "chooser" | "bug" | "idea";
type Category = "circle" | "trip" | "payments" | "ux" | "new_feature" | "other";

const CATEGORIES: Category[] = [
  "circle",
  "trip",
  "payments",
  "ux",
  "new_feature",
  "other",
];

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
  const [mode, setMode] = useState<Mode>("chooser");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [helpWhy, setHelpWhy] = useState("");
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");

  // FAB only shows for signed-in users — bug_reports.user_id is NOT NULL
  // and RLS requires auth.uid() = user_id.
  if (!user?.id) return null;

  const resetForm = useCallback(() => {
    setDescription("");
    setTitle("");
    setCategory(null);
    setHelpWhy("");
    setLocalImageUri(null);
    setUploadState("idle");
  }, []);

  const handleOpen = useCallback(() => {
    resetForm();
    setMode("chooser");
    setOpen(true);
  }, [resetForm]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    resetForm();
    setMode("chooser");
  }, [submitting, resetForm]);

  const handleBackToChooser = useCallback(() => {
    if (submitting) return;
    resetForm();
    setMode("chooser");
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
    const ttl = title.trim();
    const why = helpWhy.trim();

    if (!desc) {
      showToast(t("feedback.invalid_description"), "error");
      return;
    }
    if (mode === "idea") {
      if (!ttl) {
        showToast(t("feedback.invalid_title"), "error");
        return;
      }
      if (!category) {
        showToast(t("feedback.invalid_category"), "error");
        return;
      }
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

      const row: Record<string, unknown> = {
        user_id: user!.id,
        type: mode,
        screen_name: screenName || "Unknown",
        description: desc,
        screenshot_url: screenshotUrl,
        device_info: collectDeviceInfo(),
        app_version: appVersion,
      };
      if (mode === "idea") {
        row.title = ttl;
        row.category = category;
        if (why) row.help_why = why;
      }

      const { error: insErr } = await supabase.from("bug_reports").insert(row);
      if (insErr) throw new Error(insErr.message);

      showToast(t("feedback.success"), "success");
      setOpen(false);
      resetForm();
      setMode("chooser");
    } catch (e: any) {
      console.warn("[BugReportButton] submit failed", e);
      showToast(e?.message ?? t("feedback.error"), "error");
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    description,
    title,
    category,
    helpWhy,
    mode,
    localImageUri,
    uploadScreenshot,
    user,
    screenName,
    t,
    resetForm,
  ]);

  const renderChooser = () => (
    <>
      <Text style={styles.title}>{t("feedback.chooser_title")}</Text>
      <Text style={styles.subtitle}>{t("feedback.chooser_subtitle")}</Text>

      <TouchableOpacity
        style={styles.chooserOption}
        onPress={() => setMode("bug")}
        accessibilityRole="button"
      >
        <View style={styles.chooserIconWrap}>
          <Ionicons name="bug-outline" size={22} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chooserOptionTitle}>{t("feedback.bug_option")}</Text>
          <Text style={styles.chooserOptionSub}>
            {t("feedback.bug_option_sub")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.chooserOption}
        onPress={() => setMode("idea")}
        accessibilityRole="button"
      >
        <View style={styles.chooserIconWrap}>
          <Ionicons name="bulb-outline" size={22} color={TEAL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chooserOptionTitle}>{t("feedback.idea_option")}</Text>
          <Text style={styles.chooserOptionSub}>
            {t("feedback.idea_option_sub")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
          <Text style={styles.cancelText}>{t("feedback.cancel")}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderForm = () => (
    <>
      <View style={styles.formHeaderRow}>
        <TouchableOpacity
          onPress={handleBackToChooser}
          style={styles.backInlineBtn}
          accessibilityRole="button"
          disabled={submitting}
        >
          <Ionicons name="arrow-back" size={18} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {mode === "idea" ? t("feedback.idea_title") : t("feedback.bug_title")}
        </Text>
      </View>

      <View style={styles.screenRow}>
        <Text style={styles.screenLabel}>{t("feedback.screen_label")}</Text>
        <Text style={styles.screenValue} numberOfLines={1}>
          {screenName}
        </Text>
      </View>

      {mode === "idea" ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={t("feedback.title_placeholder")}
            placeholderTextColor={MUTED}
            value={title}
            onChangeText={setTitle}
            maxLength={MAX_TITLE}
            editable={!submitting}
          />

          <Text style={styles.label}>{t("feedback.category_label")}</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => {
              const isSel = category === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, isSel && styles.chipSelected]}
                  onPress={() => setCategory(c)}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSel && styles.chipTextSelected,
                    ]}
                  >
                    {t(`feedback.category_${c}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder={t("feedback.description_placeholder")}
        placeholderTextColor={MUTED}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={MAX_DESCRIPTION}
        editable={!submitting}
      />

      {mode === "idea" ? (
        <>
          <Text style={styles.label}>{t("feedback.help_why_label")}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t("feedback.help_why_placeholder")}
            placeholderTextColor={MUTED}
            value={helpWhy}
            onChangeText={setHelpWhy}
            multiline
            maxLength={MAX_HELP_WHY}
            editable={!submitting}
          />
        </>
      ) : null}

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
            {t("feedback.attach_screenshot")}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.cancelBtn, submitting && styles.btnDisabled]}
          onPress={handleClose}
          disabled={submitting}
        >
          <Text style={styles.cancelText}>{t("feedback.cancel")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>{t("feedback.submit")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t("feedback.fab_label")}
        style={[styles.fab, { bottom: Math.max(insets.bottom, 16) + 80 }]}
        onPress={handleOpen}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
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
              {mode === "chooser" ? renderChooser() : renderForm()}
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
  label: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.medium,
  },
  formHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  backInlineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  chooserOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: "#FAFAFA",
  },
  chooserIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,198,174,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  chooserOptionTitle: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
  },
  chooserOptionSub: {
    fontSize: typography.label,
    color: MUTED,
    marginTop: 2,
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
    color: NAVY,
    fontSize: typography.body,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFFFFF",
  },
  chipSelected: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  chipText: {
    fontSize: typography.label,
    color: NAVY,
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: typography.bold,
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
