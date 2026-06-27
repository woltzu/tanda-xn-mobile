// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminCircleDetailScreen.tsx — circle detail + force-close
// ═══════════════════════════════════════════════════════════════════════════
//
// Circle info + member list + recent contributions. super_admin/admin can
// force-close via admin_close_group(p_group_id uuid, p_reason text).
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

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Circle {
  id: string;
  name: string | null;
  status: string | null;
  amount: number | null;
  member_count: number | null;
  current_members: number | null;
  community_name: string | null;
  created_at: string | null;
}

interface Member {
  id: string;
  user_id: string;
  status: string | null;
  position: number | null;
  full_name: string | null;
}

interface Contribution {
  id: string;
  user_id: string;
  amount: number | null;
  cycle_number: number | null;
  status: string | null;
  created_at: string | null;
}

type Params = { AdminCircleDetail: { circleId: string } };

export default function AdminCircleDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Params, "AdminCircleDetail">>();
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const circleId = route.params?.circleId;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [callerRole, setCallerRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!circleId || !me?.id) return;
    setLoading(true);
    try {
      const [circleR, callerR, membersR, contribR] = await Promise.all([
        supabase
          .from("circles")
          .select(
            "id, name, status, amount, member_count, current_members, created_at, communities:community_id(name)",
          )
          .eq("id", circleId)
          .maybeSingle(),
        supabase
          .from("admin_users")
          .select("role")
          .eq("user_id", me.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("circle_members")
          .select("id, user_id, status, position, profiles:user_id(full_name)")
          .eq("circle_id", circleId)
          .order("position", { ascending: true, nullsFirst: false }),
        supabase
          .from("circle_contributions")
          .select("id, user_id, amount, cycle_number, status, created_at")
          .eq("circle_id", circleId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const c = circleR.data as any;
      setCircle(
        c
          ? {
              id: c.id,
              name: c.name,
              status: c.status,
              amount: c.amount,
              member_count: c.member_count,
              current_members: c.current_members,
              community_name: c.communities?.name ?? null,
              created_at: c.created_at,
            }
          : null,
      );
      setCallerRole((callerR.data as { role?: string } | null)?.role ?? null);
      setMembers(
        ((membersR.data ?? []) as any[]).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          status: r.status,
          position: r.position,
          full_name: r.profiles?.full_name ?? null,
        })),
      );
      setContributions((contribR.data ?? []) as Contribution[]);
    } catch (err) {
      console.warn("[AdminCircleDetail] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [circleId, me?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const canForceClose =
    (callerRole === "super_admin" || callerRole === "admin") &&
    circle?.status !== "completed" &&
    circle?.status !== "cancelled";

  const handleForceClose = useCallback(() => {
    if (!circle) return;
    const doIt = async () => {
      setActing(true);
      try {
        const { error } = await supabase.rpc("admin_close_group", {
          p_group_id: circle.id,
          p_reason: "Force-closed via admin hub",
        });
        if (error) throw new Error(error.message);
        showToast(t("admin.circles.force_close_toast"), "success");
        load();
      } catch (err: any) {
        showToast(err?.message ?? t("admin.circles.force_close_failed"), "error");
      } finally {
        setActing(false);
      }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(t("admin.circles.force_close_confirm"))) {
        doIt();
      }
    } else {
      Alert.alert(
        t("admin.circles.force_close"),
        t("admin.circles.force_close_confirm"),
        [
          { text: t("common.cancel") || "Cancel", style: "cancel" },
          { text: t("admin.circles.force_close"), style: "destructive", onPress: doIt },
        ],
      );
    }
  }, [circle, load, t]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!circle) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title={t("admin.circles.title")} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.mutedText}>{t("admin.circles.not_found")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <Header title={circle.name ?? "—"} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Section title={t("admin.circles.section_info")}>
          <Field label={t("admin.circles.community")} value={circle.community_name ?? "—"} />
          <Field label={t("admin.circles.status")} value={circle.status ?? "—"} />
          <Field
            label={t("admin.circles.pot")}
            value={`$${Number(circle.amount ?? 0).toLocaleString()}`}
          />
          <Field
            label={t("admin.circles.members")}
            value={`${circle.current_members ?? 0} / ${circle.member_count ?? 0}`}
          />
          <Field
            label={t("admin.circles.created")}
            value={
              circle.created_at
                ? new Date(circle.created_at).toLocaleDateString()
                : "—"
            }
          />
        </Section>

        <Section title={t("admin.circles.section_members", { count: members.length })}>
          {members.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.circles.no_members")}</Text>
          ) : (
            members.map((m, i) => (
              <View
                key={m.id}
                style={[styles.subRow, i < members.length - 1 && styles.subRowBorder]}
              >
                <Text style={styles.subRowName}>
                  {m.position != null ? `#${m.position} · ` : ""}
                  {m.full_name ?? "—"}
                </Text>
                <Text style={styles.subRowMeta}>{m.status ?? "—"}</Text>
              </View>
            ))
          )}
        </Section>

        <Section
          title={t("admin.circles.section_contributions", { count: contributions.length })}
        >
          {contributions.length === 0 ? (
            <Text style={styles.emptyText}>{t("admin.circles.no_contributions")}</Text>
          ) : (
            contributions.map((c, i) => (
              <View
                key={c.id}
                style={[
                  styles.subRow,
                  i < contributions.length - 1 && styles.subRowBorder,
                ]}
              >
                <Text style={styles.subRowName}>
                  ${Number(c.amount ?? 0).toLocaleString()} · cycle {c.cycle_number ?? "—"}
                </Text>
                <Text style={styles.subRowMeta}>
                  {c.status ?? "—"}
                  {c.created_at
                    ? ` · ${new Date(c.created_at).toLocaleDateString()}`
                    : ""}
                </Text>
              </View>
            ))
          )}
        </Section>

        {canForceClose ? (
          <TouchableOpacity
            style={[styles.dangerBtn, acting && styles.dangerBtnDisabled]}
            onPress={handleForceClose}
            disabled={acting}
          >
            {acting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.dangerBtnText}>{t("admin.circles.force_close")}</Text>
            )}
          </TouchableOpacity>
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
  dangerBtn: {
    marginTop: spacing.md,
    backgroundColor: "#DC2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerBtnDisabled: { opacity: 0.6 },
  dangerBtnText: { color: "#FFFFFF", fontSize: typography.body, fontWeight: typography.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
