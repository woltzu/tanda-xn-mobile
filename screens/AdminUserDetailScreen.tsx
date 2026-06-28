// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminUserDetailScreen.tsx — user profile + suspend (Bucket B mod 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// Reads the user's profile, their circle memberships, and their organised
// trips. super_admin/admin can suspend via the existing suspend_user RPC
// (p_user_id uuid, p_reason text). Unsuspend is NOT exposed here — no
// dedicated RPC ships in prod and the toggle path needs an audit-trail
// design decision; the action is deferred to a follow-up bucket.
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
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { showToast } from "../components/Toast";
import AdminErrorState from "../components/AdminErrorState";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  kyc_status: string | null;
  kyc_level: number | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface CircleRow {
  circle_id: string;
  circle_name: string | null;
  status: string | null;
}

interface TripRow {
  id: string;
  destination: string | null;
  status: string | null;
  start_date: string | null;
}

type Params = { AdminUserDetail: { userId: string } };

export default function AdminUserDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminUserDetail">>();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const userId = route.params?.userId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !me?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [profileR, callerR, membershipsR, tripsR] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, kyc_status, kyc_level, role, is_active, created_at",
          )
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", me.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("circle_members")
          .select("circle_id, status, circles:circle_id(name, status)")
          .eq("user_id", userId),
        supabase
          .from("trips")
          .select("id, destination, status, start_date")
          .eq("organizer_id", userId)
          .order("start_date", { ascending: false })
          .limit(50),
      ]);

      setProfile((profileR.data as Profile | null) ?? null);
      setCallerRole((callerR.data as { role?: string } | null)?.role ?? null);
      setCircles(
        ((membershipsR.data ?? []) as any[]).map((r) => ({
          circle_id: r.circle_id,
          circle_name: r.circles?.name ?? null,
          status: r.circles?.status ?? r.status,
        })),
      );
      setTrips((tripsR.data ?? []) as TripRow[]);
    } catch (err) {
      console.warn("[AdminUserDetail] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canSuspend =
    callerRole === "super_admin" || callerRole === "admin";

  const handleSuspend = useCallback(() => {
    if (!profile) return;
    const doIt = async () => {
      setActing(true);
      try {
        const { error } = await supabase.rpc("suspend_user", {
          p_user_id: profile.id,
          p_reason: "Suspended via admin hub",
        });
        if (error) throw new Error(error.message);
        showToast(t("admin.users.suspended_toast"), "success");
        load();
      } catch (err: any) {
        showToast(err?.message ?? t("admin.users.suspend_failed"), "error");
      } finally {
        setActing(false);
      }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(t("admin.users.suspend_confirm"))) {
        doIt();
      }
    } else {
      Alert.alert(t("admin.users.suspend"), t("admin.users.suspend_confirm"), [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        { text: t("admin.users.suspend"), style: "destructive", onPress: doIt },
      ]);
    }
  }, [profile, load, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!profile && error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.users.title")} onBack={() => navigation.goBack()} />
        <AdminErrorState onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.users.title")} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.mutedText}>{t("admin.users.not_found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header
        title={profile.full_name || t("admin.users.no_name")}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title={t("admin.users.section_profile")}>
          <Field label={t("admin.users.email")} value={profile.email ?? "—"} />
          <Field label={t("admin.users.phone")} value={profile.phone ?? "—"} />
          <Field
            label={t("admin.users.kyc_status")}
            value={`${profile.kyc_status ?? "none"} (level ${profile.kyc_level ?? 0})`}
          />
          <Field label={t("admin.users.role")} value={profile.role ?? "member"} />
          <Field
            label={t("admin.users.joined")}
            value={
              profile.created_at
                ? new Date(profile.created_at).toLocaleDateString()
                : "—"
            }
          />
          <Field
            label={t("admin.users.status_label")}
            value={
              profile.is_active === false
                ? t("admin.users.suspended_chip")
                : t("admin.users.active_chip")
            }
          />
        </Section>

        <Section title={t("admin.users.section_circles", { count: circles.length })}>
          {circles.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.users.no_circles")}</Text>
          ) : (
            circles.map((c, i) => (
              <View
                key={c.circle_id}
                style={[styles.subRow, i < circles.length - 1 && styles.subRowBorder]}
              >
                <Text style={styles.subRowName}>{c.circle_name ?? "—"}</Text>
                <Text style={styles.subRowMeta}>{c.status ?? "—"}</Text>
              </View>
            ))
          )}
        </Section>

        <Section title={t("admin.users.section_trips", { count: trips.length })}>
          {trips.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.users.no_trips")}</Text>
          ) : (
            trips.map((tr, i) => (
              <View
                key={tr.id}
                style={[styles.subRow, i < trips.length - 1 && styles.subRowBorder]}
              >
                <Text style={styles.subRowName}>{tr.destination ?? "—"}</Text>
                <Text style={styles.subRowMeta}>
                  {tr.start_date
                    ? new Date(tr.start_date).toLocaleDateString()
                    : "—"}
                  {tr.status ? ` · ${tr.status}` : ""}
                </Text>
              </View>
            ))
          )}
        </Section>

        {canSuspend && profile.is_active !== false ? (
          <TouchableOpacity
            style={[styles.dangerBtn, acting && styles.dangerBtnDisabled]}
            onPress={handleSuspend}
            disabled={acting}
          >
            {acting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerBtnText}>{t("admin.users.suspend")}</Text>
            )}
          </TouchableOpacity>
        ) : null}
        {profile.is_active === false ? (
          <Text style={styles.suspendedNote}>
            {t("admin.users.unsuspend_note")}
          </Text>
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
  fieldValue: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium, flexShrink: 1, textAlign: "right" },
  subRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  subRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F3F4F6" },
  subRowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium },
  subRowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  emptyText: {
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    padding: spacing.md,
  },
  dangerBtn: {
    marginTop: spacing.md,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerBtnDisabled: { opacity: 0.6 },
  dangerBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  suspendedNote: {
    marginTop: spacing.md,
    fontSize: typography.label,
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
