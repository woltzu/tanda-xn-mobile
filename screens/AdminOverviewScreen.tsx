// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminOverviewScreen.tsx — admin metrics + 9 charts
// ═══════════════════════════════════════════════════════════════════════════
//
// Top: existing count cards (users / circles / trips).
// Middle: range toggle (7d / 30d / 90d / all).
// Bottom: 9 charts driven by useAdminCharts — user growth (line),
// DAU (bar), circles created (bar), circle-status donut, transaction
// volume (bar), trip revenue (bar), platform fee (line), dispute pie,
// KYC funnel.
//
// Scoping: super_admin / admin see global; support is scoped via
// admin_users.community_id. Trip-side stays global (trips have no
// community_id column — flagged in the existing metric load).
//
// Charts: hand-rolled SVG primitives in components/charts/* — matches
// the existing sparkline pattern (XnScore, CircleHealth, Honor,
// CircleVisualizer) rather than pulling in victory-native + Skia.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAdminScope } from "../hooks/useAdminScope";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import ChartContainer from "../components/charts/ChartContainer";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart, { DonutSlice } from "../components/charts/DonutChart";
import FunnelChart from "../components/charts/FunnelChart";
import {
  useAdminCharts,
  ChartRange,
} from "../hooks/useAdminCharts";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

const RANGE_OPTIONS: ChartRange[] = ["7d", "30d", "90d", "all"];

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
}

export default function AdminOverviewScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>("30d");

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (scope.loading) return;
    if (scope.noCommunityAssigned) {
      setMetrics(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const scoped = scope.isSupport && !!scope.communityId;
      const communityId = scope.communityId;
      const scopedUserIds = scope.scopedUserIds;
      const scopedCircleIds = scope.scopedCircleIds;

      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

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

      const potQ = supabase.from("circles").select("amount, member_count");
      if (scoped) potQ.eq("community_id", communityId);
      const { data: potRows } = await potQ;
      const totalPotCents = (potRows ?? []).reduce(
        (sum: number, r: any) =>
          sum +
          Math.round(
            (Number(r.amount) || 0) * (Number(r.member_count) || 0) * 100,
          ),
        0,
      );

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
      });
    } catch (err) {
      console.warn("[AdminOverview] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    scope.loading,
    scope.noCommunityAssigned,
    scope.isSupport,
    scope.communityId,
    scope.scopedUserIds,
    scope.scopedCircleIds,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const chartScope = useMemo(
    () => ({
      scopedUserIds: scope.scopedUserIds,
      scopedCircleIds: scope.scopedCircleIds,
    }),
    [scope.scopedUserIds, scope.scopedCircleIds],
  );
  const charts = useAdminCharts(range, chartScope);

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }
  if (!metrics && error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <Header onBack={() => navigation.goBack()} loading={loading} onReload={load} t={t} />
        <AdminErrorState onRetry={load} />
      </SafeAreaView>
    );
  }
  if (!metrics && loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <Header onBack={() => navigation.goBack()} loading={loading} onReload={load} t={t} />
        <AdminListSkeleton rowCount={5} showChip={false} />
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

  const fmtUSD = (n: number) =>
    `$${Math.round(n).toLocaleString("en-US")}`;
  const fmtUSDFromCents = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;

  const refreshAll = () => {
    load();
    charts.refetch();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.overview.title")}</Text>
        <TouchableOpacity
          onPress={refreshAll}
          style={styles.headerBtn}
          disabled={loading || charts.loading}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={loading || charts.loading ? "#CBD5E1" : NAVY}
          />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {scope.noCommunityAssigned ? (
          <View style={styles.scopedBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#92400E" />
            <Text style={styles.scopedBannerText}>
              {t("admin.no_community_assigned")}
            </Text>
          </View>
        ) : scope.isSupport && scope.communityId ? (
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
            value={fmtUSDFromCents(metrics?.totalPotCents ?? 0)}
          />
        </Section>

        <Section title={t("admin.overview.trips_section")}>
          <Metric label={t("admin.overview.total_trips")} value={metrics?.totalTrips ?? 0} />
          <Metric label={t("admin.overview.upcoming_trips")} value={metrics?.upcomingTrips ?? 0} />
        </Section>

        {/* Range toggle for charts. */}
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              onPress={() => setRange(r)}
              style={[styles.rangePill, range === r && styles.rangePillActive]}
            >
              <Text
                style={[
                  styles.rangePillText,
                  range === r && styles.rangePillTextActive,
                ]}
              >
                {t(`admin.overview.charts.time_range_${r}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 9 charts. ChartContainer handles loading/error per card so a
            slow query doesn't blank the rest. */}
        <ChartContainer
          title={t("admin.overview.charts.user_growth")}
          subtitle={t("admin.overview.total_users") + ": " + (charts.data?.totals.totalUsers ?? 0)}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.userGrowth.length}
          onRetry={charts.refetch}
        >
          {charts.data ? <LineChart points={charts.data.userGrowth} /> : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.daily_active")}
          subtitle={`avg ${charts.data?.totals.avgDau ?? 0}/${range}`}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.dailyActiveUsers.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <BarChart
              points={charts.data.dailyActiveUsers}
              summaryValue={String(charts.data.totals.avgDau)}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.circles_created")}
          subtitle={t("admin.overview.total_circles") + ": " + (charts.data?.totals.circlesCreated ?? 0)}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.circlesCreated.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <BarChart
              points={charts.data.circlesCreated}
              summaryValue={String(charts.data.totals.circlesCreated)}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.active_vs_total")}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.circleStatus.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <DonutChart
              slices={(charts.data.circleStatus as unknown) as DonutSlice[]}
              centerValue={String(charts.data.totals.totalCircles)}
              centerLabel={t("admin.overview.total_circles")}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.transaction_volume")}
          subtitle={fmtUSD(charts.data?.totals.transactionVolume ?? 0)}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.transactionVolume.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <BarChart
              points={charts.data.transactionVolume}
              summaryValue={fmtUSD(charts.data.totals.transactionVolume)}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.trip_revenue")}
          subtitle={fmtUSD(charts.data?.totals.tripRevenue ?? 0)}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.tripRevenue.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <BarChart
              points={charts.data.tripRevenue}
              summaryValue={fmtUSD(charts.data.totals.tripRevenue)}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.platform_fee")}
          subtitle={fmtUSD(charts.data?.totals.platformFee ?? 0)}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.platformFee.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <LineChart
              points={charts.data.platformFee}
              formatValue={(v) => fmtUSD(v)}
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.disputes")}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.disputes.length}
          onRetry={charts.refetch}
        >
          {charts.data ? (
            <DonutChart
              slices={(charts.data.disputes as unknown) as DonutSlice[]}
              centerValue={String(charts.data.totals.openDisputes)}
              centerLabel="open"
            />
          ) : null}
        </ChartContainer>

        <ChartContainer
          title={t("admin.overview.charts.kyc_funnel")}
          loading={charts.loading && !charts.data}
          error={charts.error}
          empty={!charts.loading && !charts.data?.kycFunnel.length}
          onRetry={charts.refetch}
          height={170}
        >
          {charts.data ? <FunnelChart stages={charts.data.kycFunnel} /> : null}
        </ChartContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  onBack,
  loading,
  onReload,
  t,
}: {
  onBack: () => void;
  loading: boolean;
  onReload: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="arrow-back" size={24} color={NAVY} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{t("admin.overview.title")}</Text>
      <TouchableOpacity onPress={onReload} style={styles.headerBtn} disabled={loading}>
        <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
      </TouchableOpacity>
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
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
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
  rangeRow: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  rangePill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  rangePillActive: {
    backgroundColor: TEAL,
    borderColor: TEAL,
  },
  rangePillText: {
    fontSize: 12,
    color: NAVY,
    fontWeight: typography.medium,
  },
  rangePillTextActive: { color: "#FFFFFF", fontWeight: typography.bold },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
});
