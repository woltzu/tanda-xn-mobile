// ══════════════════════════════════════════════════════════════════════════════
// VerificationMapScreen — verification history map
// ══════════════════════════════════════════════════════════════════════════════
// Phase 2D. Opened from GoalDisbursementMilestonesScreen when a milestone
// is in `released` / `verified` and the goal owner wants to verify visually
// that the elder/admin was actually at the project site.
//
// Pulls the latest verification row for the milestone and renders:
//   • Native — react-native-maps with two pins (project, photo location)
//     and a distance label.
//   • Web — a coords panel + distance (the package has no useful web
//     implementation; we tree-shake it from the bundle via Platform.OS).
// Plus: elder name, timestamp, distance, override note if used, and
// signed thumbnails of every uploaded photo from verification-docs.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Maps = Platform.OS !== "web" ? require("react-native-maps") : null;
const MapView: any = Maps?.default ?? null;
const Marker: any = Maps?.Marker ?? null;

type RouteParams = { milestoneId: string };

type EvidencePhoto = { path: string; bucket: string; source?: string };
type EvidenceShape = {
  photos?: EvidencePhoto[];
  location_text?: string | null;
  gps?: { latitude: number; longitude: number; accuracy?: number | null; captured_at?: string };
  project_gps?: { latitude: number; longitude: number };
  distance_meters?: number;
  override?: { reason?: string; photos_via_camera?: number; gate_state?: string };
};

type VerificationDetail = {
  request_id: string;
  responded_at: string | null;
  responder_name: string | null;
  evidence: EvidenceShape;
  milestone_name: string;
  milestone_status: string;
};

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

export default function VerificationMapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, "params">>();
  const { t } = useTranslation();
  const { milestoneId } = route.params ?? ({} as RouteParams);

  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!milestoneId) return;
      setLoading(true);
      try {
        // Latest approved verification for this milestone — released
        // milestones always have one; verified-but-not-yet-released
        // milestones have one too. Order desc, limit 1.
        const { data } = await supabase
          .from("goal_disbursement_milestone_verifications")
          .select(
            `
              id,
              responded_at,
              status,
              evidence,
              responder:profiles!responder_user_id(full_name),
              milestone:goal_disbursement_milestones!milestone_id(name, status)
            `,
          )
          .eq("milestone_id", milestoneId)
          .eq("status", "approved")
          .order("responded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        const row = data as any;
        if (!row) {
          setDetail(null);
          setLoading(false);
          return;
        }
        const ev = (row.evidence ?? {}) as EvidenceShape;
        const det: VerificationDetail = {
          request_id: row.id,
          responded_at: row.responded_at,
          responder_name: row.responder?.full_name ?? null,
          evidence: ev,
          milestone_name: row.milestone?.name ?? "",
          milestone_status: row.milestone?.status ?? "",
        };
        setDetail(det);

        // Resolve signed thumbnail URLs from the private bucket. Errors
        // are non-fatal — the screen still renders the map + meta.
        const paths = (ev.photos ?? []).filter((p) => p && p.path && p.bucket);
        if (paths.length > 0) {
          const signed = await Promise.all(
            paths.map(async (p) => {
              const { data: s } = await supabase.storage
                .from(p.bucket)
                .createSignedUrl(p.path, 60 * 10);
              return s?.signedUrl ?? null;
            }),
          );
          if (!cancelled) setPhotoUrls(signed.filter((x): x is string => !!x));
        } else {
          setPhotoUrls([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [milestoneId]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#00C6AE" />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.container}>
        <Header onBack={() => navigation.goBack()} title={t("verification_map.title")} />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={56} color="#9CA3AF" />
          <Text style={styles.emptyText}>{t("verification_map.not_found")}</Text>
        </View>
      </View>
    );
  }

  const project = detail.evidence.project_gps;
  const photoGps = detail.evidence.gps;
  const distance =
    project && photoGps
      ? Math.round(
          haversineMeters(
            project.latitude,
            project.longitude,
            photoGps.latitude,
            photoGps.longitude,
          ),
        )
      : detail.evidence.distance_meters ?? null;

  return (
    <View style={styles.container}>
      <Header onBack={() => navigation.goBack()} title={t("verification_map.title")} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>{detail.milestone_name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={14} color="#6B7280" />
            <Text style={styles.metaText}>
              {detail.responder_name ?? t("verification_map.unknown_responder")}
            </Text>
          </View>
          {detail.responded_at ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {new Date(detail.responded_at).toLocaleString()}
              </Text>
            </View>
          ) : null}
          {distance != null ? (
            <View style={styles.metaRow}>
              <Ionicons name="navigate-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>
                {t("verification_map.distance", { meters: distance })}
              </Text>
            </View>
          ) : null}
          {detail.evidence.location_text ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText} numberOfLines={2}>
                {detail.evidence.location_text}
              </Text>
            </View>
          ) : null}
          {detail.evidence.override ? (
            <View style={styles.overrideBanner}>
              <Ionicons name="warning-outline" size={14} color="#92400E" />
              <Text style={styles.overrideBannerText} numberOfLines={3}>
                {t("verification_map.override_used", {
                  reason: detail.evidence.override.reason ?? "—",
                })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Map / coords panel */}
        {project && photoGps ? (
          Platform.OS !== "web" && MapView && Marker ? (
            <View style={styles.mapWrap}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: (project.latitude + photoGps.latitude) / 2,
                  longitude: (project.longitude + photoGps.longitude) / 2,
                  latitudeDelta: Math.max(
                    Math.abs(project.latitude - photoGps.latitude) * 2.5,
                    0.005,
                  ),
                  longitudeDelta: Math.max(
                    Math.abs(project.longitude - photoGps.longitude) * 2.5,
                    0.005,
                  ),
                }}
              >
                <Marker
                  coordinate={{
                    latitude: project.latitude,
                    longitude: project.longitude,
                  }}
                  title={t("verification_map.project_pin")}
                  pinColor="#1D4ED8"
                />
                <Marker
                  coordinate={{
                    latitude: photoGps.latitude,
                    longitude: photoGps.longitude,
                  }}
                  title={t("verification_map.photo_pin")}
                  pinColor="#059669"
                />
              </MapView>
            </View>
          ) : (
            <View style={styles.mapWeb}>
              <Text style={styles.mapWebTitle}>{t("verification_map.web_title")}</Text>
              <Text style={styles.mapWebText}>
                🔵 {t("verification_map.project_pin")} ·{" "}
                {project.latitude.toFixed(5)}, {project.longitude.toFixed(5)}
              </Text>
              <Text style={styles.mapWebText}>
                🟢 {t("verification_map.photo_pin")} ·{" "}
                {photoGps.latitude.toFixed(5)}, {photoGps.longitude.toFixed(5)}
              </Text>
              {distance != null ? (
                <Text style={styles.mapWebDistance}>
                  {t("verification_map.distance", { meters: distance })}
                </Text>
              ) : null}
            </View>
          )
        ) : (
          <View style={styles.noPinCard}>
            <Ionicons name="map-outline" size={20} color="#92400E" />
            <Text style={styles.noPinText}>
              {!project
                ? t("verification_map.no_project_pin")
                : t("verification_map.no_photo_gps")}
            </Text>
          </View>
        )}

        {/* Photo thumbnails */}
        {photoUrls.length > 0 ? (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>{t("verification_map.photos")}</Text>
            <View style={styles.photoGrid}>
              {photoUrls.map((url) => (
                <Image key={url} source={{ uri: url }} style={styles.photoThumb} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
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
  scrollContent: { padding: 16, paddingBottom: 32 },

  metaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  metaTitle: { fontSize: 16, fontWeight: "800", color: "#0A2342", marginBottom: 8 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  metaText: { fontSize: 13, color: "#374151", flex: 1 },

  overrideBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  overrideBannerText: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },

  mapWrap: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  map: { height: 220, width: "100%" },
  mapWeb: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  mapWebTitle: { fontSize: 13, fontWeight: "800", color: "#0A2342", marginBottom: 4 },
  mapWebText: { fontSize: 12, color: "#374151" },
  mapWebDistance: { fontSize: 14, fontWeight: "800", color: "#0A2342", marginTop: 6 },

  noPinCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  noPinText: { fontSize: 12, color: "#92400E", flex: 1, lineHeight: 16 },

  photoSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0A2342", marginBottom: 10 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
});
