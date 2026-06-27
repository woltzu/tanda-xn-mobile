// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminOverviewScreen.tsx — admin metrics overview (Bucket B mod 1)
// ═══════════════════════════════════════════════════════════════════════════
//
// Headline counts: users, circles, trips, pending KYC, pending disputes.
// Scoping: super_admin / admin see global; support (≡ community_admin) is
// scoped via admin_users.community_id. Trips don't have a community_id
// column in prod, so trip counts stay global even for support — flagged
// inline.
//
// Reachable from AdminHub's Overview card.
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
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAuth } from "../context/AuthContext";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  newUsers7d: number;
  totalCircles: number;
  activeCircles: number;
  totalPotCents: number;
  totalTrips: number;
  upcomingTrips: number;
  pendingKyc: number;
  scopedToCommunity: boolean;
}

export default function AdminOverviewScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Resolve role + community for scoping.
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("role, community_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const role = adminRow?.role as string | undefined;
      const communityId = adminRow?.community_id as string | null | undefined;
      const scoped = role === "support" && !!communityId;

      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Users counts.
      let scopedUserIds: string[] | null = null;
      if (scoped) {
        const { data: memberships } = await supabase
          .from("community_memberships")
          .select("user_id")
          .eq("community_id", communityId)
          .eq("status", "active");
        scopedUserIds = (memberships ?? []).map((r: any) => r.user_id);
      }
      const usersQ = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (scopedUserIds) usersQ.in("id", scopedUserIds);
      const { count: totalUsers } = await usersQ;

      const activeQ = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (scopedUserIds) activeQ.in("id", scopedUserIds);
      const { count: activeUsers } = await activeQ;

      const newQ = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo);
      if (scopedUserIds) newQ.in("id", scopedUserIds);
      const { count: newUsers7d } = await newQ;

      const kycQ = supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("kyc_status", "pending");
      if (scopedUserIds) kycQ.in("id", scopedUserIds);
      const { count: pendingKyc } = await kycQ;

      // Circles counts.
      const totalCirclesQ = supabase
        .from("circles")
        .select("id", { count: "exact", head: true });
      if (scoped) totalCirclesQ.eq("community_id", communityId);
      const { count: totalCircles } = await totalCirclesQ;

      const activeCirclesQ = supabase
        .from("circles")
        .select("id", { count: "exact", head: true })
        .eq("status", "active");
      if (scoped) activeCirclesQ.eq("community_id", communityId);
      const { count: activeCircles } = await activeCirclesQ;

      // Total pot = sum(amount * member_count) across circles. Two-query
      // approach since postgrest doesn't aggregate without a view.
      const potQ = supabase.from("circles").select("amount, member_count");
      if (scoped) potQ.eq("community_id", communityId);
      const { data: potRows } = await potQ;
      const totalPotCents = (potRows ?? []).reduce(
        (sum: number, r: any) =>
          sum + Math.round((Number(r.amount) || 0) * (Number(r.member_count) || 0) * 100),
        0,
      );

      // Trips counts — no community_id column; counts stay global.
      const { count: totalTrips } = await supabase
        .from("trips")
        .select("id", { count: "exact", head: true });
      const today = new Date().toISOString().slice(0, 10);
      const { count: upcomingTrips } = await supabase
        .from("trips")
        .select("id", { count: "exact", head: true })
        .gte("start_date", today);

      setMetrics({
        totalUsers: totalUsers ?? 0,
        activeUsers: activeUsers ?? 0,
        newUsers7d: newUsers7d ?? 0,
        totalCircles: totalCircles ?? 0,
        activeCircles: activeCircles ?? 0,
        totalPotCents,
        totalTrips: totalTrips ?? 0,
        upcomingTrips: upcomingTrips ?? 0,
        pendingKyc: pendingKyc ?? 0,
        scopedToCommunity: scoped,
      });
    } catch (err) {
      console.warn("[AdminOverview] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (adminLoading || (!metrics && loading)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.mutedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmtUSD = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.overview.title")}</Text>
        <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
          <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {metrics?.scopedToCommunity ? (
          <View style={styles.scopedBanner}>
            <Ionicons name="people-outline" size={16} color="#92400E" />
            <Text style={styles.scopedBannerText}>
              {t("admin.overview.scoped_banner")}
            </Text>
          </View>
        ) : null}

        <Section title={t("admin.overview.users_section")}>
          <Metric label={t("admin.overview.total_users")} value={metrics?.totalUsers ?? 0} />
          <Metric label={t("admin.overview.active_users")} value={metrics?.activeUsers ?? 0} />
          <Metric label={t("admin.overview.new_users")} value={metrics?.newUsers7d ?? 0} />
          <Metric label={t("admin.overview.pending_kyc")} value={metrics?.pendingKyc ?? 0} />
        </Section>

        <Section title={t("admin.overview.circles_section")}>
          <Metric label={t("admin.overview.total_circles")} value={metrics?.totalCircles ?? 0} />
          <Metric label={t("admin.overview.active_circles")} value={metrics?.activeCircles ?? 0} />
          <Metric
            label={t("admin.overview.total_pot")}
            value={fmtUSD(metrics?.totalPotCents ?? 0)}
          />
        </Section>

        <Section title={t("admin.overview.trips_section")}>
          <Metric label={t("admin.overview.total_trips")} value={metrics?.totalTrips ?? 0} />
          <Metric label={t("admin.overview.upcoming_trips")} value={metrics?.upcomingTrips ?? 0} />
        </Section>
      </ScrollView>
    </SafeAreaView>
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

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },
  scopedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  scopedBannerText: {
    flex: 1,
    fontSize: typography.label,
    color: "#92400E",
    fontWeight: typography.medium,
  },
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
    overflow: "hidden",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  metricLabel: { fontSize: typography.body, color: NAVY, fontWeight: typography.medium },
  metricValue: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
