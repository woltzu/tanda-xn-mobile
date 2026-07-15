// ══════════════════════════════════════════════════════════════════════════════
// MilestoneVerificationScreen — elder / admin / owner sign-off
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2B. Reached from GoalDisbursementMilestones when a milestone is in
// `verification_requested` and the caller is allowed to approve. The
// responder collects evidence (photos, a location string, notes) and either
// approves or rejects via respond_disbursement_verification. The 4-arg
// RPC (migration 197) merges the evidence JSONB into the verification row,
// flips the milestone to verified on approval, and stamps the elder fee
// row when the responder isn't the goal owner.
//
// GPS — Phase 2C adds automatic capture via expo-location on mount. If
// permission is denied or the position lookup errors, the manual text
// field stays in as a fallback so the responder can still attach a
// location description.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

// react-native-maps has no useful web implementation. Import from the
// platform-split shim (components/MapView.tsx for native, .web.tsx for
// web). The prior runtime require() didn't tree-shake — Metro still
// traversed the require path during static analysis and pulled
// codegenNativeCommands into the web bundle.
import MapView, { Marker } from "../components/MapView";
import { supabase } from "../lib/supabase";
import {
  DisbursementMilestone,
  useDisbursementActions,
} from "../hooks/useGoalDisbursementMilestones";

type RouteParams = { milestoneId: string; requestId: string };

type Photo = {
  key: string;
  uri: string;
  storagePath?: string;
  uploading: boolean;
  error?: string;
  // Phase 2D — override mode requires every photo to come from the
  // camera (not the library). Tracked per-photo for the evidence
  // payload audit trail.
  source: "library" | "camera";
};

type GpsState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; latitude: number; longitude: number; accuracy: number | null; capturedAt: string }
  | { status: "denied" }
  | { status: "error"; message: string };

const STORAGE_BUCKET = "verification-docs";
const MAX_PHOTOS = 4;
// Phase 2D geo-gate. 25 meters mirrors a typical small construction
// site where the elder can stand near (but not in) the structure
// being verified.
const GATE_RADIUS_METERS = 25;
// Override (Phase 2D) — when GPS drifts but the elder is genuinely on-
// site, the override path requires more friction.
const OVERRIDE_MIN_PHOTOS = 2;
const OVERRIDE_MIN_REASON_CHARS = 50;

// Haversine distance in meters between two lat/lng points.
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let photoCounter = 0;
const newPhotoKey = () => `p_${++photoCounter}`;

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function uriToUint8Array(uri: string): Promise<Uint8Array> {
  // Both web and native respond to fetch() against a local URI / data URL.
  const res = await fetch(uri);
  const blob = await res.blob();
  // FileReader is available in both Hermes and web; ArrayBuffer is the
  // common surface the Supabase Storage SDK expects.
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

export default function MilestoneVerificationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { milestoneId, requestId } = route.params ?? ({} as RouteParams);

  const [milestone, setMilestone] = useState<DisbursementMilestone | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [projectPin, setProjectPin] = useState<{ lat: number; lng: number } | null>(null);
  // Phase 3 — verification checklist sourced from
  // milestone_checklist_templates by the goal's category. Items render
  // as toggleable rows; checked state stamped into evidence.checklist.
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [ctxLoading, setCtxLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [locationText, setLocationText] = useState("");
  const [gps, setGps] = useState<GpsState>({ status: "idle" });
  const [notes, setNotes] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  // Phase 2D override — gates a heavier evidence requirement when GPS
  // drift puts the elder >25m from the project pin but they're
  // genuinely on-site.
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  const { submitting, respondVerification } = useDisbursementActions();

  // Phase 2C — request location permission and capture once on mount.
  // We don't block the rest of the screen on this; failures fall through
  // to the manual text field. Web bundles don't surface useful coords
  // through expo-location, so we treat Platform.OS === 'web' as "denied"
  // to keep the responder on the manual path.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "web") {
        if (!cancelled) setGps({ status: "denied" });
        return;
      }
      setGps({ status: "requesting" });
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== "granted") {
          setGps({ status: "denied" });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setGps({
          status: "granted",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        });
      } catch (e: any) {
        if (cancelled) return;
        setGps({ status: "error", message: e?.message ?? "Location lookup failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!milestoneId) return;
      setCtxLoading(true);
      const { data } = await supabase
        .from("goal_disbursement_milestones")
        .select(
          // Phase 2D — pull project pin. Phase 3 — also goal.category so
          // we can fetch the matching checklist template.
          "*, provider:providers!provider_id(business_name), goal:user_savings_goals!goal_id(project_latitude, project_longitude, category)",
        )
        .eq("id", milestoneId)
        .maybeSingle();
      if (cancelled) return;
      const row = data as any;
      setMilestone((row as DisbursementMilestone) ?? null);
      setProviderName(row?.provider?.business_name ?? "");
      const lat = row?.goal?.project_latitude;
      const lng = row?.goal?.project_longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        setProjectPin({ lat, lng });
      } else {
        setProjectPin(null);
      }
      setCtxLoading(false);

      // Phase 3 — pull the checklist template for the goal's category.
      // No category → no checklist; the rest of the screen still works.
      const category = row?.goal?.category;
      if (category) {
        const { data: tpl } = await supabase
          .from("milestone_checklist_templates")
          .select("checks")
          .eq("category", category)
          .maybeSingle();
        if (!cancelled && tpl?.checks && Array.isArray(tpl.checks)) {
          setChecklist(tpl.checks as string[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [milestoneId]);

  // Phase 2D — derive distance + gate decision in one place. Returns one
  // of: 'no_pin' (project pin missing), 'no_gps' (elder hasn't granted
  // location or capture failed), 'in_range' (≤25m), 'out_of_range' (>25m).
  // The gate is permissive on no_pin and no_gps — the verification still
  // requires photos + notes; the gate just doesn't add a hard radius check.
  const distanceMeters = useMemo(() => {
    if (!projectPin || gps.status !== "granted") return null;
    return haversineMeters(
      gps.latitude,
      gps.longitude,
      projectPin.lat,
      projectPin.lng,
    );
  }, [projectPin, gps]);
  const gateState: "checking" | "no_pin" | "no_gps" | "in_range" | "out_of_range" =
    gps.status === "requesting"
      ? "checking"
      : !projectPin
      ? "no_pin"
      : gps.status !== "granted"
      ? "no_gps"
      : (distanceMeters ?? Infinity) <= GATE_RADIUS_METERS
      ? "in_range"
      : "out_of_range";
  const gateBlocking = gateState === "out_of_range" && !overrideOn;

  const handlePickPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    // Phase 2D — override mode forces the camera path. The library
    // picker can't prove the elder is on-site so it's disabled.
    if (overrideOn) {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== "granted") {
        Alert.alert(
          t("verification.permission_denied_title"),
          t("verification.camera_permission_denied_body"),
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      const uri = result.assets[0].uri;
      const key = newPhotoKey();
      setPhotos((prev) => [...prev, { key, uri, uploading: true, source: "camera" }]);
      void uploadPhoto(key, uri);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert(t("verification.permission_denied_title"), t("verification.permission_denied_body"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    const key = newPhotoKey();
    setPhotos((prev) => [...prev, { key, uri, uploading: true, source: "library" }]);
    void uploadPhoto(key, uri);
  };

  const uploadPhoto = async (key: string, uri: string) => {
    try {
      const bytes = await uriToUint8Array(uri);
      const ext = (uri.split(".").pop() ?? "jpg").split("?")[0].toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext) ? ext : "jpg";
      // Path scheme: milestone-evidence/{milestoneId}/{ts}_{key}.{ext}
      // Falls under the existing verification-docs bucket's RLS — only
      // authenticated members can read their own uploads.
      const path = `milestone-evidence/${milestoneId}/${key}_${Math.floor(
        bytes.length,
      )}.${safeExt}`;
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, bytes, {
          contentType: `image/${safeExt === "jpg" ? "jpeg" : safeExt}`,
          upsert: true,
        });
      if (error) throw error;
      setPhotos((prev) =>
        prev.map((p) =>
          p.key === key ? { ...p, uploading: false, storagePath: path } : p,
        ),
      );
    } catch (e: any) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.key === key
            ? { ...p, uploading: false, error: e?.message ?? "Upload failed" }
            : p,
        ),
      );
    }
  };

  const removePhoto = (key: string) => {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  };

  const uploadsPending = photos.some((p) => p.uploading);
  const usablePhotoCount = photos.filter((p) => p.storagePath).length;
  const cameraPhotoCount = photos.filter(
    (p) => p.storagePath && p.source === "camera",
  ).length;

  // Phase 2D — approve gate. In override mode we need ≥2 camera-sourced
  // photos AND ≥50-char reason. In normal mode we need ≥1 usable photo
  // and the geo-gate must NOT be blocking (out_of_range + no override).
  const canApprove =
    !submitting &&
    !uploadsPending &&
    milestone !== null &&
    (overrideOn
      ? cameraPhotoCount >= OVERRIDE_MIN_PHOTOS &&
        overrideReason.trim().length >= OVERRIDE_MIN_REASON_CHARS
      : !gateBlocking && usablePhotoCount >= 1);
  const canReject = !submitting && rejectReason.trim().length > 0;

  const handleApprove = async () => {
    if (!canApprove || !milestone) return;
    const evidence: Record<string, unknown> = {
      photos: photos
        .filter((p) => p.storagePath)
        .map((p) => ({
          path: p.storagePath,
          bucket: STORAGE_BUCKET,
          source: p.source,
        })),
      location_text: locationText.trim() || null,
      captured_at: new Date().toISOString(),
    };
    if (gps.status === "granted") {
      evidence.gps = {
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        captured_at: gps.capturedAt,
      };
    }
    if (projectPin) {
      evidence.project_gps = {
        latitude: projectPin.lat,
        longitude: projectPin.lng,
      };
    }
    if (distanceMeters !== null) {
      evidence.distance_meters = Math.round(distanceMeters);
    }
    if (overrideOn) {
      evidence.override = {
        reason: overrideReason.trim(),
        photos_via_camera: cameraPhotoCount,
        gate_state: gateState,
      };
    }
    if (checklist.length > 0) {
      evidence.checklist = {
        items: checklist,
        checked: checklist.filter((c) => !!checked[c]),
      };
    }
    const res = await respondVerification(
      requestId,
      true,
      notes.trim() || undefined,
      evidence,
    );
    if (!res.ok) {
      Alert.alert(t("verification.error_title"), res.message ?? "");
      return;
    }
    Alert.alert(
      t("verification.approved_title"),
      t("verification.approved_body"),
    );
    navigation.goBack();
  };

  const handleReject = async () => {
    if (!canReject) return;
    const res = await respondVerification(
      requestId,
      false,
      rejectReason.trim(),
      {},
    );
    if (!res.ok) {
      Alert.alert(t("verification.error_title"), res.message ?? "");
      return;
    }
    navigation.goBack();
  };

  if (ctxLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!milestone) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("verification.title")} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("verification.not_found")}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("verification.title")} />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Milestone summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryName}>{milestone.name}</Text>
            {milestone.description ? (
              <Text style={styles.summaryDesc}>{milestone.description}</Text>
            ) : null}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("verification.provider")}</Text>
              <Text style={styles.summaryValue}>{providerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("verification.amount")}</Text>
              <Text style={styles.summaryValue}>{fmt(milestone.amount_cents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{t("verification.retention")}</Text>
              <Text style={styles.summaryValue}>{milestone.retention_percent}%</Text>
            </View>
          </View>

          {mode !== "reject" ? (
            <>
              {/* Phase 2D — Geo-gate. Chip + map + override. The gate is
                  permissive when project pin is missing or GPS is denied
                  (chip explains why); strict only when both are present. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("verification.gate_section_title")}
                </Text>

                {gateState === "checking" ? (
                  <View style={styles.gpsRow}>
                    <ActivityIndicator size="small" color="#00C6AE" />
                    <Text style={styles.gpsRowText}>
                      {t("verification.gps_requesting")}
                    </Text>
                  </View>
                ) : gateState === "in_range" ? (
                  <View style={[styles.gpsChip, styles.gpsChipOk]}>
                    <Ionicons name="checkmark-circle" size={14} color="#065F46" />
                    <Text style={styles.gpsChipText}>
                      {t("verification.within_range", {
                        meters: Math.round(distanceMeters ?? 0),
                      })}
                    </Text>
                  </View>
                ) : gateState === "out_of_range" ? (
                  <View style={[styles.gpsChip, styles.gpsChipDanger]}>
                    <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                    <Text style={[styles.gpsChipText, { color: "#B91C1C" }]}>
                      {t("verification.outside_range", {
                        meters: Math.round(distanceMeters ?? 0),
                        radius: GATE_RADIUS_METERS,
                      })}
                    </Text>
                  </View>
                ) : gateState === "no_pin" ? (
                  <View style={[styles.gpsChip, styles.gpsChipWarn]}>
                    <Ionicons name="information-circle-outline" size={14} color="#92400E" />
                    <Text style={[styles.gpsChipText, { color: "#92400E" }]}>
                      {t("verification.no_project_pin")}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.gpsChip, styles.gpsChipWarn]}>
                    <Ionicons name="location-outline" size={14} color="#92400E" />
                    <Text style={[styles.gpsChipText, { color: "#92400E" }]}>
                      {gps.status === "denied"
                        ? t("verification.gps_denied")
                        : t("verification.gps_error")}
                    </Text>
                  </View>
                )}

                {/* Project + elder coords detail line. Always rendered
                    when GPS is granted so the responder can sanity-check
                    the pin before approving. */}
                {gps.status === "granted" ? (
                  <Text style={styles.gpsCoords}>
                    {t("verification.your_location_label")} {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                  </Text>
                ) : null}
                {projectPin ? (
                  <Text style={styles.gpsCoords}>
                    {t("verification.project_location_label")} {projectPin.lat.toFixed(5)}, {projectPin.lng.toFixed(5)}
                  </Text>
                ) : null}

                {/* Map view — react-native-maps on native, coords panel on web. */}
                {projectPin && gps.status === "granted" ? (
                  Platform.OS !== "web" ? (
                    <View style={styles.mapWrap}>
                      <MapView
                        style={styles.map}
                        initialRegion={{
                          latitude: (projectPin.lat + gps.latitude) / 2,
                          longitude: (projectPin.lng + gps.longitude) / 2,
                          latitudeDelta: Math.max(
                            Math.abs(projectPin.lat - gps.latitude) * 2.5,
                            0.005,
                          ),
                          longitudeDelta: Math.max(
                            Math.abs(projectPin.lng - gps.longitude) * 2.5,
                            0.005,
                          ),
                        }}
                      >
                        <Marker
                          coordinate={{
                            latitude: projectPin.lat,
                            longitude: projectPin.lng,
                          }}
                          title={t("verification.project_location")}
                          pinColor="#1D4ED8"
                        />
                        <Marker
                          coordinate={{
                            latitude: gps.latitude,
                            longitude: gps.longitude,
                          }}
                          title={t("verification.your_location")}
                          pinColor="#059669"
                        />
                      </MapView>
                    </View>
                  ) : (
                    <View style={styles.mapWeb}>
                      <Text style={styles.mapWebTitle}>
                        {t("verification.web_map_title")}
                      </Text>
                      <Text style={styles.mapWebText}>
                        🔵 {t("verification.project_location")} ·{" "}
                        {projectPin.lat.toFixed(5)}, {projectPin.lng.toFixed(5)}
                      </Text>
                      <Text style={styles.mapWebText}>
                        🟢 {t("verification.your_location")} ·{" "}
                        {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
                      </Text>
                      <Text style={styles.mapWebDistance}>
                        {t("verification.distance", {
                          meters: Math.round(distanceMeters ?? 0),
                        })}
                      </Text>
                    </View>
                  )
                ) : null}

                {/* Override toggle — only surfaced when the gate is
                    blocking. Requires 2 camera photos + 50-char reason. */}
                {gateState === "out_of_range" ? (
                  <View style={styles.overrideBlock}>
                    <View style={styles.overrideRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.overrideTitle}>
                          {t("verification.override_toggle")}
                        </Text>
                        <Text style={styles.overrideBody}>
                          {t("verification.override_required")}
                        </Text>
                      </View>
                      <Switch
                        value={overrideOn}
                        onValueChange={setOverrideOn}
                        trackColor={{ false: "#E5E7EB", true: "#F59E0B" }}
                      />
                    </View>
                    {overrideOn ? (
                      <>
                        <Text style={styles.overridePinNote}>
                          {t("verification.override_pin_deferred")}
                        </Text>
                        <Text style={styles.fieldLabel}>
                          {t("verification.override_reason_label", {
                            min: OVERRIDE_MIN_REASON_CHARS,
                          })}
                        </Text>
                        <TextInput
                          style={[styles.input, styles.inputMultiline]}
                          value={overrideReason}
                          onChangeText={setOverrideReason}
                          placeholder={t("verification.override_reason_placeholder")}
                          placeholderTextColor="#9CA3AF"
                          multiline
                          maxLength={500}
                        />
                        <Text style={styles.overrideCount}>
                          {overrideReason.trim().length}/{OVERRIDE_MIN_REASON_CHARS}
                        </Text>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>

              {/* Phase 3 — verification checklist. Sourced from the
                  category template; reviewer ticks what's been observed
                  and the result is captured in evidence.checklist. */}
              {checklist.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {t("verification.checklist_title")}
                  </Text>
                  <Text style={styles.sectionBody}>
                    {t("verification.checklist_body")}
                  </Text>
                  {checklist.map((item) => {
                    const isChecked = !!checked[item];
                    return (
                      <TouchableOpacity
                        key={item}
                        style={styles.checklistRow}
                        onPress={() =>
                          setChecked((prev) => ({ ...prev, [item]: !isChecked }))
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isChecked }}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isChecked && styles.checkboxOn,
                          ]}
                        >
                          {isChecked ? (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          ) : null}
                        </View>
                        <Text style={styles.checklistText}>{item}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Photo evidence — add-tile disabled when the gate blocks. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("verification.photo_upload_label")}
                </Text>
                <Text style={styles.sectionBody}>
                  {overrideOn
                    ? t("verification.photo_upload_override_body", {
                        min: OVERRIDE_MIN_PHOTOS,
                      })
                    : t("verification.photo_upload_body", { max: MAX_PHOTOS })}
                </Text>
                <View style={styles.photoGrid}>
                  {photos.map((p) => (
                    <View key={p.key} style={styles.photoTile}>
                      <Image source={{ uri: p.uri }} style={styles.photoImage} />
                      {p.uploading ? (
                        <View style={styles.photoOverlay}>
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        </View>
                      ) : p.error ? (
                        <View style={[styles.photoOverlay, { backgroundColor: "rgba(239,68,68,0.6)" }]}>
                          <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.photoCheck}>
                          <Ionicons
                            name={p.source === "camera" ? "camera" : "checkmark"}
                            size={14}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() => removePhoto(p.key)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photos.length < MAX_PHOTOS && !gateBlocking ? (
                    <TouchableOpacity
                      style={[styles.photoTile, styles.photoAdd]}
                      onPress={handlePickPhoto}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name={overrideOn ? "camera" : "camera-outline"}
                        size={24}
                        color="#6B7280"
                      />
                      <Text style={styles.photoAddText}>
                        {overrideOn
                          ? t("verification.add_photo_camera")
                          : t("verification.add_photo")}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {gateBlocking ? (
                  <Text style={styles.cameraDisabledNote}>
                    {t("verification.camera_disabled")}
                  </Text>
                ) : null}
              </View>

              {/* Manual location field — kept as a supplement so the
                  responder can add a human-readable address. */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {t("verification.location_label")}
                </Text>
                <Text style={styles.sectionBody}>
                  {t("verification.gps_manual_body_supplement")}
                </Text>
                <TextInput
                  style={styles.input}
                  value={locationText}
                  onChangeText={setLocationText}
                  placeholder={t("verification.gps_placeholder")}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t("verification.notes_label")}</Text>
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t("verification.notes_placeholder")}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={500}
                />
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t("verification.reject_reason_label")}</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder={t("verification.reject_reason_placeholder")}
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                autoFocus
              />
            </View>
          )}
        </ScrollView>

        <View style={styles.bottomBar}>
          {mode === "reject" ? (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
                onPress={() => setMode(null)}
                disabled={submitting}
              >
                <Text style={styles.btnSecondaryText}>
                  {t("verification.back")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnDanger, { flex: 1 }, !canReject && styles.btnDisabled]}
                onPress={handleReject}
                disabled={!canReject}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnDangerText}>
                    {t("verification.confirm_reject")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { flex: 1, marginRight: 8 }]}
                onPress={() => setMode("reject")}
                disabled={submitting}
              >
                <Text style={styles.btnSecondaryText}>
                  {t("verification.reject")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  { flex: 1 },
                  !canApprove && styles.btnDisabled,
                ]}
                onPress={handleApprove}
                disabled={!canApprove}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>
                    {t("verification.confirm_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F7FA" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  emptyText: { fontSize: 14, color: "#6B7280" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#FFFFFF" },
  scrollContent: { padding: 16, paddingBottom: 96 },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryName: { fontSize: 17, fontWeight: "800", color: "#0A2342" },
  summaryDesc: { fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 8 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: "#6B7280" },
  summaryValue: { fontSize: 13, fontWeight: "700", color: "#0A2342" },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342" },
  sectionBody: { fontSize: 12, color: "#6B7280", marginTop: 4, marginBottom: 8 },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoTile: {
    width: 92,
    height: 92,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  photoImage: { width: "100%", height: "100%" },
  photoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,35,66,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoCheck: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderStyle: "dashed",
    backgroundColor: "#FFFFFF",
    gap: 4,
  },
  photoAddText: { fontSize: 11, color: "#6B7280", fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0A2342",
    backgroundColor: "#FFFFFF",
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },

  bottomBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  btn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#00C6AE" },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnSecondary: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  btnSecondaryText: { color: "#0A2342", fontSize: 14, fontWeight: "700" },
  btnDanger: { backgroundColor: "#EF4444" },
  btnDangerText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },

  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  gpsRowText: { fontSize: 13, color: "#6B7280" },
  gpsChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 6,
  },
  gpsChipOk: { backgroundColor: "#D1FAE5" },
  gpsChipWarn: { backgroundColor: "#FEF3C7" },
  gpsChipDanger: { backgroundColor: "#FEE2E2" },
  gpsChipText: { fontSize: 12, fontWeight: "700", color: "#065F46" },
  gpsCoords: { fontSize: 11, color: "#6B7280", marginTop: 6 },

  mapWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  map: { height: 180, width: "100%" },
  mapWeb: {
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  mapWebTitle: { fontSize: 13, fontWeight: "800", color: "#0A2342" },
  mapWebText: { fontSize: 12, color: "#374151" },
  mapWebDistance: { fontSize: 13, fontWeight: "700", color: "#0A2342", marginTop: 4 },

  overrideBlock: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  overrideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  overrideTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  overrideBody: { fontSize: 11, color: "#92400E", marginTop: 2 },
  overridePinNote: {
    fontSize: 11,
    color: "#92400E",
    marginTop: 10,
    fontStyle: "italic",
  },
  overrideCount: { fontSize: 11, color: "#6B7280", marginTop: 4, alignSelf: "flex-end" },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#0A2342", marginTop: 10, marginBottom: 6 },

  cameraDisabledNote: { fontSize: 11, color: "#B91C1C", marginTop: 8 },

  checklistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#9CA3AF",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxOn: { backgroundColor: "#059669", borderColor: "#059669" },
  checklistText: { flex: 1, fontSize: 13, color: "#0A2342" },
});
