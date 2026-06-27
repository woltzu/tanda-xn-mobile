// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminTripDetailScreen.tsx — trip detail (Bucket B mod 4)
// ═══════════════════════════════════════════════════════════════════════════
//
// Trip info + participants list. Spec's cancel/refund actions are NOT
// wired here — there is no cancel_trip or refund_trip RPC in prod
// (refund_transaction is generic, not trip-shaped). Action buttons
// surface a "coming soon" toast and the absent RPCs are documented as
// the follow-up gap.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Trip {
  id: string;
  trip_name: string | null;
  destination: string | null;
  description: string | null;
  status: string | null;
  price_per_person: number | null;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
  organizer_name: string | null;
}

interface Participant {
  id: string;
  user_id: string;
  status: string | null;
  full_name: string | null;
}

type Params = { AdminTripDetail: { tripId: string } };

export default function AdminTripDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminTripDetail">>();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const tripId = route.params?.tripId;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tripId || !me?.id) return;
    setLoading(true);
    try {
      const [tripR, callerR, partsR] = await Promise.all([
        supabase
          .from("trips")
          .select(
            "id, trip_name, destination, description, status, price_per_person, start_date, end_date, max_participants, organizer_id, profiles:organizer_id(full_name)",
          )
          .eq("id", tripId)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", me.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("trip_participants")
          .select("id, user_id, status, profiles:user_id(full_name)")
          .eq("trip_id", tripId)
          .limit(100),
      ]);
      const tr = tripR.data as any;
      setTrip(
        tr
          ? {
              id: tr.id,
              trip_name: tr.trip_name,
              destination: tr.destination,
              description: tr.description,
              status: tr.status,
              price_per_person: tr.price_per_person,
              start_date: tr.start_date,
              end_date: tr.end_date,
              max_participants: tr.max_participants,
              organizer_name: tr.profiles?.full_name ?? null,
            }
          : null,
      );
      setCallerRole((callerR.data as { role?: string } | null)?.role ?? null);
      setParticipants(
        ((partsR.data ?? []) as any[]).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          status: r.status,
          full_name: r.profiles?.full_name ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminTripDetail] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [tripId, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canAct = callerRole === "super_admin" || callerRole === "admin";

  const handleComingSoon = () =>
    showToast(t("admin.trips.action_coming_soon"), "info");

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!trip) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.trips.title")} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.mutedText}>{t("admin.trips.not_found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header
        title={trip.trip_name || trip.destination || "—"}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title={t("admin.trips.section_info")}>
          <Field label={t("admin.trips.destination")} value={trip.destination ?? "—"} />
          <Field label={t("admin.trips.organizer")} value={trip.organizer_name ?? "—"} />
          <Field label={t("admin.trips.status")} value={trip.status ?? "—"} />
          <Field
            label={t("admin.trips.dates")}
            value={
              trip.start_date && trip.end_date
                ? `${new Date(trip.start_date).toLocaleDateString()} → ${new Date(
                    trip.end_date,
                  ).toLocaleDateString()}`
                : trip.start_date
                ? new Date(trip.start_date).toLocaleDateString()
                : "—"
            }
          />
          <Field
            label={t("admin.trips.price")}
            value={`$${Number(trip.price_per_person ?? 0).toLocaleString()}`}
          />
          <Field
            label={t("admin.trips.max_participants")}
            value={`${trip.max_participants ?? "—"}`}
          />
        </Section>

        <Section
          title={t("admin.trips.section_participants", { count: participants.length })}
        >
          {participants.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.trips.no_participants")}</Text>
          ) : (
            participants.map((p, i) => (
              <View
                key={p.id}
                style={[styles.subRow, i < participants.length - 1 && styles.subRowBorder]}
              >
                <Text style={styles.subRowName}>{p.full_name ?? "—"}</Text>
                <Text style={styles.subRowMeta}>{p.status ?? "—"}</Text>
              </View>
            ))
          )}
        </Section>

        {canAct ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleComingSoon}>
              <Text style={styles.dangerBtnText}>{t("admin.trips.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.dangerBtn, styles.dangerBtnAlt]}
              onPress={handleComingSoon}
            >
              <Text style={styles.dangerBtnText}>{t("admin.trips.refund")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {canAct ? (
          <Text style={styles.note}>{t("admin.trips.actions_note")}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerBtn} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
    textAlign: "center",
  },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: typography.label,
    color: MUTED,
    fontWeight: typography.bold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    paddingVertical: 8,
  },
  fieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fieldLabel: { fontSize: typography.label, color: MUTED },
  fieldValue: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.medium,
    flexShrink: 1,
    textAlign: "right",
  },
  subRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  subRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F3F4F6" },
  subRowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium },
  subRowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  emptyText: {
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    padding: spacing.md,
  },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: spacing.md },
  dangerBtn: {
    flex: 1,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerBtnAlt: { backgroundColor: "#F59E0B" },
  dangerBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  note: {
    marginTop: 8,
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
