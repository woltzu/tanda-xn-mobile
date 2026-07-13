// ══════════════════════════════════════════════════════════════════════════════
// screens/KYCDocumentScreen.tsx — KYC P1 single-screen document upload
// ══════════════════════════════════════════════════════════════════════════════
//
// Merges the prior `IDVerificationStartScreen` + `DocumentUploadScreen`
// (recursive push for the back side) into one screen with up to three
// upload tiles:
//
//   • Front of ID    — required
//   • Back of ID     — optional (passport users skip)
//   • Selfie         — optional, future-proofing for liveness check
//
// On Continue we upsert a `kyc_verifications` row with both URLs and
// `status='provider_pending'`. The Persona webhook (or admin review)
// later flips status to `approved`, which fires
// `trg_sync_kyc_tier_to_profile` and bumps the user's tier.
//
// Route params:
//   idType?: 'passport' | 'national_id' | 'drivers_license' | 'residence_permit'
//   country?: string
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { MediaUploadService } from "../services/MediaUploadService";
import { colors } from "../theme/tokens";

type IdType =
  | "passport"
  | "national_id"
  | "drivers_license"
  | "residence_permit";

type ParamSet = { idType?: IdType; country?: string };
type RouteShape = RouteProp<{ KYCDocument: ParamSet }, "KYCDocument">;

type Side = "front" | "back" | "selfie";
type TileState = {
  localUri: string | null;
  uploadedUrl: string | null;
  uploading: boolean;
};

const idTypeLabels: Record<IdType, string> = {
  passport: "kyc_document.id_label_passport",
  national_id: "kyc_document.id_label_national_id",
  drivers_license: "kyc_document.id_label_drivers_license",
  residence_permit: "kyc_document.id_label_residence_permit",
};

// Passport readers carry the data page on the front only; everything else
// has a meaningful back side so we keep that tile visible.
const needsBackSide = (idType: IdType): boolean => idType !== "passport";

export default function KYCDocumentScreen() {
  const navigation = useTypedNavigation();
  const route = useRoute<RouteShape>();
  const { t } = useTranslation();
  const { user } = useAuth();

  const idType: IdType = route.params?.idType ?? "national_id";
  const showBack = needsBackSide(idType);

  const [front, setFront] = useState<TileState>({
    localUri: null,
    uploadedUrl: null,
    uploading: false,
  });
  const [back, setBack] = useState<TileState>({
    localUri: null,
    uploadedUrl: null,
    uploading: false,
  });
  const [selfie, setSelfie] = useState<TileState>({
    localUri: null,
    uploadedUrl: null,
    uploading: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const tileSetter: Record<Side, (s: TileState) => void> = {
    front: setFront,
    back: setBack,
    selfie: setSelfie,
  };
  const tileState: Record<Side, TileState> = { front, back, selfie };

  // ── Pick + upload a single tile ──────────────────────────────────────
  const handlePick = async (side: Side) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(
        t("kyc_document.perm_title"),
        t("kyc_document.perm_body"),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];

    tileSetter[side]({ localUri: asset.uri, uploadedUrl: null, uploading: true });
    if (!user?.id) {
      Alert.alert(
        t("kyc_document.auth_required_title"),
        t("kyc_document.auth_required_body"),
      );
      tileSetter[side]({ localUri: null, uploadedUrl: null, uploading: false });
      return;
    }

    const filename =
      asset.fileName ?? `${idType}-${side}-${Date.now()}.jpg`;
    const mimeType = asset.mimeType ?? "image/jpeg";
    const res = await MediaUploadService.uploadDocument(
      { uri: asset.uri, type: mimeType, name: filename },
      { entityType: "kyc_id_document", entityId: user.id },
    );
    if (!res.success || !res.url) {
      tileSetter[side]({ localUri: null, uploadedUrl: null, uploading: false });
      Alert.alert(
        t("kyc_document.upload_failed_title"),
        res.error ?? t("kyc_document.upload_failed_default"),
      );
      return;
    }
    tileSetter[side]({
      localUri: asset.uri,
      uploadedUrl: res.url,
      uploading: false,
    });
  };

  // ── Help-icon prompts ────────────────────────────────────────────────
  const showHelp = (side: Side) => {
    Alert.alert(
      t(`kyc_document.help_${side}_title`),
      t(`kyc_document.help_${side}_body`),
    );
  };

  // ── KYC P2: failure-reason instruction ────────────────────────────────
  // Pulled from the latest kyc_verifications row's rejection_code. Maps
  // to one of four UI buckets via mirroring of the SQL kyc_reason_humanize
  // helper. NULL = no prior rejection.
  type ReasonBucket = "image_quality_low" | "id_expired" | "face_mismatch" | "other";
  const humanizeReason = (code: string | null | undefined): ReasonBucket | null => {
    if (!code) return null;
    const c = code.toLowerCase();
    if (
      [
        "image_quality_low",
        "blurry",
        "glare",
        "low_resolution",
        "low_quality",
      ].includes(c)
    )
      return "image_quality_low";
    if (["id_expired", "document_expired", "expired"].includes(c))
      return "id_expired";
    if (["face_mismatch", "selfie_mismatch", "no_face_detected"].includes(c))
      return "face_mismatch";
    return "other";
  };
  const [failureBucket, setFailureBucket] = useState<ReasonBucket | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase
      .from("kyc_verifications")
      .select("status, rejection_code")
      .eq("member_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const row = data as { status: string; rejection_code: string | null };
        if (row.status === "rejected") {
          setFailureBucket(humanizeReason(row.rejection_code));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // ── Submit ───────────────────────────────────────────────────────────
  const canSubmit =
    !!front.uploadedUrl &&
    (!showBack || !!back.uploadedUrl) &&
    !submitting;

  // ── KYC P2: auto-submit watcher ──────────────────────────────────────
  // Once every required tile is uploaded the user shouldn't have to tap a
  // separate Continue button — fire handleSubmit once. autoFiredRef
  // prevents the watcher from re-triggering after handleSubmit completes
  // and the screen briefly comes back into focus.
  const autoFiredRef = useRef(false);
  useEffect(() => {
    if (autoFiredRef.current) return;
    if (!canSubmit) return;
    autoFiredRef.current = true;
    // Defer one tick so the upload-complete tile rerenders and the user
    // sees their photo land before the screen navigates away.
    setTimeout(() => {
      handleSubmit();
    }, 250);
  }, [canSubmit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    if (!canSubmit) return;
    if (!user?.id) {
      Alert.alert(
        t("kyc_document.auth_required_title"),
        t("kyc_document.auth_required_body"),
      );
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("kyc_verifications")
      .upsert(
        {
          member_id: user.id,
          kyc_type: "persona",
          provider: "persona",
          provider_reference_id: "manual_upload",
          id_type: idType,
          id_document_front_url: front.uploadedUrl,
          id_document_back_url: back.uploadedUrl,
          selfie_url: selfie.uploadedUrl,
          status: "provider_pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "member_id" },
      );
    setSubmitting(false);

    if (error) {
      // Preserve the raw error for diagnostics — the previous version
      // swallowed it behind a generic "Check your connection" alert,
      // which masked the real RLS deny that this flow was hitting.
      console.error("[KYCDocument] submit failed:", error);
      Alert.alert(
        t("kyc_document.submit_failed_title"),
        `${t("kyc_document.submit_failed_body")}\n\n${error.message}`,
      );
      return;
    }
    navigation.navigate(Routes.KYCHub);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />

      <LinearGradient
        colors={["#0A2342", "#143654"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>
            {t("kyc_document.header_title")}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t("kyc_document.header_subtitle_for", {
              id: t(idTypeLabels[idType]),
            })}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressChip}>
          <Ionicons name="ellipse" size={8} color={colors.accentTeal} />
          <Text style={styles.progressChipText}>
            {t("kyc_document.progress_chip")}
          </Text>
        </View>

        {/* KYC P2 — specific instruction from the prior rejection. Bucketed
            via humanizeReason. NULL when no prior rejection or status is
            no longer 'rejected'. */}
        {failureBucket ? (
          <View style={styles.p2FailureBanner}>
            <Ionicons name="alert-circle" size={16} color="#B45309" />
            <Text style={styles.p2FailureText}>
              {t(`kyc_document.failure_${failureBucket}`)}
            </Text>
          </View>
        ) : null}

        {/* KYC P2 — auto-submit banner. Briefly visible between the last
            tile upload and the navigate to KYCHub. submitting === true
            means handleSubmit is already in-flight. */}
        {submitting ? (
          <View style={styles.p2AutoSubmitBanner}>
            <ActivityIndicator size="small" color="#0A2342" />
            <Text style={styles.p2AutoSubmitText}>
              {t("kyc_document.auto_submit_banner")}
            </Text>
          </View>
        ) : null}

        <Tile
          state={front}
          required
          labelKey="kyc_document.tile_front_label"
          emptyKey="kyc_document.tile_front_empty"
          onPick={() => handlePick("front")}
          onHelp={() => showHelp("front")}
        />

        {showBack ? (
          <Tile
            state={back}
            required
            labelKey="kyc_document.tile_back_label"
            emptyKey="kyc_document.tile_back_empty"
            onPick={() => handlePick("back")}
            onHelp={() => showHelp("back")}
          />
        ) : null}

        <Tile
          state={selfie}
          required={false}
          labelKey="kyc_document.tile_selfie_label"
          emptyKey="kyc_document.tile_selfie_empty"
          onPick={() => handlePick("selfie")}
          onHelp={() => showHelp("selfie")}
        />

        <Text style={styles.footnote}>
          {t("kyc_document.footnote_privacy")}
        </Text>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name="paper-plane-outline"
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.submitBtnText}>
                {t("kyc_document.submit_btn")}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// Tile — single upload surface with help icon, thumbnail, and pick button.
// ══════════════════════════════════════════════════════════════════════════

function Tile({
  state,
  required,
  labelKey,
  emptyKey,
  onPick,
  onHelp,
}: {
  state: TileState;
  required: boolean;
  labelKey: string;
  emptyKey: string;
  onPick: () => void;
  onHelp: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.tile}>
      <View style={styles.tileLabelRow}>
        <Text style={styles.tileLabel}>
          {t(labelKey)}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <TouchableOpacity
          onPress={onHelp}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t("kyc_document.help_a11y")}
        >
          <Ionicons
            name="help-circle-outline"
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {state.localUri ? (
        <Image
          source={{ uri: state.localUri }}
          style={styles.tileImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.tilePlaceholder}>
          <Ionicons
            name="image-outline"
            size={28}
            color={colors.textSecondary}
          />
          <Text style={styles.tileEmptyText}>{t(emptyKey)}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.tileBtn}
        onPress={onPick}
        disabled={state.uploading}
        accessibilityRole="button"
      >
        {state.uploading ? (
          <ActivityIndicator color={colors.primaryNavy} size="small" />
        ) : (
          <>
            <Ionicons
              name={state.localUri ? "refresh-outline" : "cloud-upload-outline"}
              size={16}
              color={colors.primaryNavy}
            />
            <Text style={styles.tileBtnText}>
              {state.localUri
                ? t("kyc_document.btn_replace")
                : t("kyc_document.btn_pick")}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },

  progressChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: colors.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressChipText: { fontSize: 11, fontWeight: "700", color: colors.primaryNavy },

  // KYC P2 — banners
  p2FailureBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    marginBottom: 12,
  },
  p2FailureText: { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17 },
  p2AutoSubmitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#F0FDFB",
    borderWidth: 1,
    borderColor: colors.accentTeal,
    marginBottom: 12,
  },
  p2AutoSubmitText: { flex: 1, fontSize: 12, color: "#0A2342", fontWeight: "600" },

  tile: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  tileLabel: { fontSize: 14, fontWeight: "600", color: colors.textPrimary },
  required: { color: colors.errorText, fontWeight: "700" },
  tileImage: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    marginBottom: 10,
  },
  tilePlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  tileEmptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  tileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryNavy,
    backgroundColor: colors.cardBg,
  },
  tileBtnText: {
    color: colors.primaryNavy,
    fontWeight: "700",
    fontSize: 13,
  },

  footnote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 8,
    fontStyle: "italic",
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.cardBg,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentTeal,
  },
  submitBtnDisabled: { backgroundColor: colors.border },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
