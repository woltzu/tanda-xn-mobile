// ══════════════════════════════════════════════════════════════════════════════
// screens/DocumentUploadScreen.tsx — KYC-008 ID document capture/upload
// ══════════════════════════════════════════════════════════════════════════════
//
// Route params: { idType: IDDocType; side: 'front' | 'back' }
//
// The screen is reached twice per ID — first for the front side, then
// pushed again for the back. After the back is captured, the user lands
// on Tier2Success.
//
// ───── Capture & upload (KYC-2, shipped) ─────
// Real camera + photo-library pick via expo-image-picker. Selected asset
// is uploaded to the `verification-docs` Supabase Storage bucket through
// MediaUploadService.uploadDocument (validates type, size, writes a row
// in media_uploads), then the resulting URL is upserted into
// user_kyc.id_document_{front,back}_url and verification_status moves
// to 'pending'. The pane shows a live preview, a spinner during upload,
// and a success badge; the bottom button morphs from
// "Capture / Choose File" → "Continue" after a successful upload, and
// a "Re-capture" affordance lets the user pick again.
// ─────────────────────────────────────────────
//
// Translated from KYC screens/08_DocumentUpload.jsx.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { supabase } from "../lib/supabase";
import { MediaUploadService } from "../services/MediaUploadService";
import type { IDDocType } from "./IDVerificationStartScreen";

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const CAMERA_BG = "#1a3a5c";

type Side = "front" | "back";
type CaptureMode = "camera" | "upload";

type DocumentUploadParams = {
  idType: IDDocType;
  side: Side;
};
type DocumentUploadRouteProp = RouteProp<
  { DocumentUpload: DocumentUploadParams },
  "DocumentUpload"
>;

// i18n: keys resolved per-render via t() at the call site so language
// flips re-paint without re-instantiating.
const ID_TYPE_LABEL_KEYS: Record<IDDocType, string> = {
  passport: "document_upload.id_label_passport",
  "national-id": "document_upload.id_label_national",
  "drivers-license": "document_upload.id_label_drivers",
  "residence-permit": "document_upload.id_label_permit",
};

const TIP_KEYS: Record<Side, string[]> = {
  front: [
    "document_upload.tip_front_1",
    "document_upload.tip_front_2",
    "document_upload.tip_front_3",
    "document_upload.tip_front_4",
  ],
  back: [
    "document_upload.tip_back_1",
    "document_upload.tip_back_2",
    "document_upload.tip_back_3",
  ],
};

export default function DocumentUploadScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<DocumentUploadRouteProp>();
  const { t } = useTranslation();
  const idType = route.params?.idType ?? "passport";
  const side = route.params?.side ?? "front";

  const [captureMode, setCaptureMode] = useState<CaptureMode>("camera");
  // Local preview URI (asset picked but maybe not yet uploaded).
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // Set after MediaUploadService.uploadDocument returns success. Drives the
  // bottom-bar button transition from "Capture / Choose" → "Continue".
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const idTypeLabel = ID_TYPE_LABEL_KEYS[idType] ? t(ID_TYPE_LABEL_KEYS[idType]) : t("document_upload.id_label_default");
  const tipsForSide = TIP_KEYS[side];

  // ── Aspect ratio used both for the on-screen pane and the cropper ───────
  // Passport (booklet open) reads as 4:3; ID cards / licences / permits as 3:2.
  const cropAspect: [number, number] = idType === "passport" ? [4, 3] : [3, 2];

  // ── Upload + DB write ───────────────────────────────────────────────────
  // Called after the user picks an asset from camera or library. Uploads to
  // the verification-docs bucket via MediaUploadService, then upserts the
  // resulting URL into user_kyc.id_document_{front,back}_url. Status moves
  // to 'pending' (the user has submitted but hasn't been verified yet).
  const uploadAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setPreviewUri(asset.uri);
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(t("document_upload.alert_signin_title"), t("document_upload.alert_signin_body"));
        return;
      }

      const filename =
        asset.fileName ?? `${idType}-${side}-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";

      const res = await MediaUploadService.uploadDocument(
        { uri: asset.uri, type: mimeType, name: filename },
        { entityType: "kyc_id_document", entityId: user.id }
      );

      if (!res.success || !res.url) {
        setPreviewUri(null);
        Alert.alert(t("document_upload.alert_upload_failed_title"), res.error ?? t("document_upload.alert_upload_failed_default"));
        return;
      }

      // Persist the URL on the user's kyc_verifications row (KYC P0 wired
      // the user-flow screens onto the engine table — the prior orphan
      // `user_kyc` write never reached the trigger that updates
      // `profiles.tier`). We use `member_id` as the natural key for the
      // upsert and move the row to `provider_pending` so the Persona
      // webhook can later flip it to `approved` (which then fires
      // `trg_sync_kyc_tier_to_profile`).
      const sideColumn =
        side === "front" ? "id_document_front_url" : "id_document_back_url";

      const { error: dbErr } = await supabase
        .from("kyc_verifications")
        .upsert(
          {
            member_id: user.id,
            kyc_type: "persona",
            provider: "persona",
            provider_reference_id: "manual_upload",
            id_type: idType,
            [sideColumn]: res.url,
            status: "provider_pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );

      if (dbErr) {
        // File is already in storage, so don't roll back the preview —
        // the user can re-tap Continue (which will re-attempt). Surface
        // the underlying error so we know what went wrong.
        console.warn("[DocumentUpload] user_kyc upsert failed", dbErr);
        Alert.alert(
          t("document_upload.alert_saved_record_failed_title"),
          t("document_upload.alert_saved_record_failed_body", { error: dbErr.message })
        );
        return;
      }

      setUploadedUrl(res.url);
    } catch (err: any) {
      setPreviewUri(null);
      console.error("[DocumentUpload] uploadAsset error", err);
      Alert.alert(t("document_upload.alert_upload_error_title"), err?.message ?? t("document_upload.alert_upload_error_default"));
    } finally {
      setUploading(false);
    }
  };

  // ── Camera capture ──────────────────────────────────────────────────────
  const pickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("document_upload.alert_camera_perm_title"),
          t("document_upload.alert_camera_perm_body")
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: cropAspect,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadAsset(result.assets[0]);
    } catch (err: any) {
      console.error("[DocumentUpload] pickFromCamera error", err);
      Alert.alert(t("document_upload.alert_camera_error_title"), err?.message ?? t("document_upload.alert_camera_error_default"));
    }
  };

  // ── Gallery pick ────────────────────────────────────────────────────────
  const pickFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          t("document_upload.alert_library_perm_title"),
          t("document_upload.alert_library_perm_body")
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: cropAspect,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      await uploadAsset(result.assets[0]);
    } catch (err: any) {
      console.error("[DocumentUpload] pickFromLibrary error", err);
      Alert.alert(t("document_upload.alert_picker_error_title"), err?.message ?? t("document_upload.alert_picker_error_default"));
    }
  };

  // ── Bottom-bar button: picks based on captureMode, OR proceeds if uploaded ──
  const handlePrimary = () => {
    if (uploading) return;
    if (uploadedUrl) {
      if (side === "front") {
        // Push a new instance so back-button takes the user back to
        // the front capture (rather than reusing the same instance).
        navigation.push(Routes.DocumentUpload, { idType, side: "back" });
      } else {
        navigation.navigate(Routes.Tier2Success);
      }
      return;
    }
    if (captureMode === "camera") {
      pickFromCamera();
    } else {
      pickFromLibrary();
    }
  };

  // ── Reset to allow a new pick ───────────────────────────────────────────
  const handleRecapture = () => {
    setPreviewUri(null);
    setUploadedUrl(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{idTypeLabel}</Text>
          <Text style={styles.headerSubtitle}>
            {side === "front" ? t("document_upload.side_front") : t("document_upload.side_back")}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Camera/Upload Area */}
        <View style={styles.contentWrap}>
          <View
            style={[
              styles.cameraPane,
              {
                aspectRatio: idType === "passport" ? 4 / 3 : 3 / 2,
              },
            ]}
          >
            {previewUri ? (
              /* Picked-asset preview — fills the pane */
              <Image
                source={{ uri: previewUri }}
                style={styles.previewImage}
                resizeMode="cover"
                accessibilityLabel={`Preview of captured ${side} side`}
              />
            ) : (
              /* Empty-pane placeholder (the document frame + position text) */
              <View
                style={[
                  styles.documentFrame,
                  {
                    borderRadius: idType === "passport" ? 12 : 8,
                  },
                ]}
              >
                <View style={styles.documentIconBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={32}
                    color="rgba(255,255,255,0.5)"
                  />
                </View>
                <Text style={styles.positionText}>
                  {t("document_upload.position_prefix")}{idTypeLabel.toLowerCase()}{t("document_upload.position_suffix")}
                </Text>
              </View>
            )}

            {/* Corner markers stay overlaid in both states so the pane still
                reads as a camera frame. */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Upload-in-flight overlay */}
            {uploading && (
              <View style={styles.uploadOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.uploadOverlayText}>{t("document_upload.uploading")}</Text>
              </View>
            )}

            {/* Success badge when upload finished */}
            {!uploading && uploadedUrl && (
              <View style={styles.successBadge} pointerEvents="none">
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.successBadgeText}>{t("document_upload.uploaded_badge")}</Text>
              </View>
            )}
          </View>

          {/* Re-capture link — only shown when a preview exists */}
          {previewUri && !uploading && (
            <TouchableOpacity
              style={styles.recaptureRow}
              onPress={handleRecapture}
              accessibilityRole="button"
              accessibilityLabel="Take or pick a different photo"
            >
              <Ionicons name="refresh" size={16} color={TEAL} />
              <Text style={styles.recaptureText}>{t("document_upload.recapture")}</Text>
            </TouchableOpacity>
          )}

          {/* Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>{t("document_upload.tips_title")}</Text>
            <View style={styles.tipsList}>
              {tipsForSide.map((tipKey, idx) => (
                <View key={idx} style={styles.tipRow}>
                  <Ionicons name="checkmark" size={14} color={TEAL} />
                  <Text style={styles.tipText}>{t(tipKey)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                captureMode === "camera" && styles.modeButtonActive,
              ]}
              onPress={() => setCaptureMode("camera")}
              accessibilityRole="button"
              accessibilityState={{ selected: captureMode === "camera" }}
            >
              <Ionicons name="camera-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modeButtonText}>{t("document_upload.mode_camera")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                captureMode === "upload" && styles.modeButtonActive,
              ]}
              onPress={() => setCaptureMode("upload")}
              accessibilityRole="button"
              accessibilityState={{ selected: captureMode === "upload" }}
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modeButtonText}>{t("document_upload.mode_upload")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action — gradient fade replicating the web version */}
      <LinearGradient
        colors={["transparent", NAVY]}
        locations={[0, 0.4]}
        style={styles.bottomBar}
        pointerEvents="box-none"
      >
        {uploadedUrl ? (
          /* After successful upload — Continue advances the flow */
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handlePrimary}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel={side === "front" ? "Continue to back side" : "Continue to success"}
          >
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
            <Text style={styles.captureButtonText}>
              {side === "front" ? t("document_upload.continue_back") : t("document_upload.continue_done")}
            </Text>
          </TouchableOpacity>
        ) : captureMode === "camera" ? (
          <TouchableOpacity
            style={[styles.captureButton, uploading && styles.buttonDisabled]}
            onPress={handlePrimary}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel={`Capture ${side}`}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="ellipse-outline" size={22} color="#FFFFFF" />
                <Text style={styles.captureButtonText}>
                  {side === "front" ? t("document_upload.capture_front") : t("document_upload.capture_back")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.buttonDisabled]}
            onPress={handlePrimary}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Choose file"
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
                <Text style={styles.uploadButtonText}>{t("document_upload.choose_file")}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NAVY },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },

  contentWrap: { paddingHorizontal: 20 },

  cameraPane: {
    backgroundColor: CAMERA_BG,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 20,
    position: "relative",
  },
  documentFrame: {
    width: "90%",
    height: "85%",
    borderWidth: 3,
    borderColor: "rgba(0,198,174,0.6)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  documentIconBox: {
    width: 80,
    height: 60,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  // Corner markers — using 3px-wide L-shaped corners.
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: TEAL,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: TEAL,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: TEAL,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: TEAL,
  },

  tipsCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  tipsList: { gap: 8 },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tipText: { fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1 },

  modeToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modeButtonActive: {
    backgroundColor: TEAL,
  },
  modeButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: TEAL,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    borderStyle: "dashed",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // ── Preview & upload-state styles ─────────────────────────────────────
  previewImage: {
    width: "100%",
    height: "100%",
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  uploadOverlayText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  successBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,198,174,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  successBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  recaptureRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginBottom: 8,
  },
  recaptureText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: "600",
  },
});
