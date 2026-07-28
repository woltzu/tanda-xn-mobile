// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminCollectionDashboardScreen.tsx — mig 387 Phase 1
// ═══════════════════════════════════════════════════════════════════════════
//
// Read-only admin surface for contribution collection failures. Reads
// mig 387's get_admin_collection_dashboard RPC. No admin actions in
// Phase 1 (pause/resume/retry deferred until real failure traffic exists).
//
// Vertical stack:
//   1. Counts strip — failures_24h / failures_7d / high_failure_30d /
//      paused_count.
//   2. Failure trends (14d) — inline bar sparkline.
//   3. Recent failures card — union of contribution + autopay failures
//      in last 24h with source tag.
//   4. High-failure members card — users with >= 3 failures in last 30d.
//   5. Paused members card — profiles.collections_paused_at IS NOT NULL.
//
// Admin-gated via useIsAdmin.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";

type FailureSource = "contribution" | "autopay";

interface RecentFailure {
  source: FailureSource;
  row_id: string;
  circle_id: string | null;
  circle_name: string | null;
  user_id: string | null;
  member_name: string | null;
  amount: number | null;
  cycle_number: number | null;
  failure_reason: string | null;
  failure_code: string | null;
  retry_count: number;
  stripe_pi_id: string | null;
  failed_at: string | null;
}

interface HighFailureMember {
  user_id: string;
  member_name: string | null;
  email: string | null;
  failures_30d: number;
  collections_paused_at: string | null;
  latest_failure_at: string | null;
  latest_failure_reason: string | null;
}

interface TrendPoint {
  day: string;
  n: number;
}

interface PausedMember {
  user_id: string;
  member_name: string | null;
  email: string | null;
  collections_paused_at: string;
  collections_paused_by_admin_id: string | null;
  paused_by_name: string | null;
  collections_paused_reason: string | null;
}

interface Counts {
  failures_24h: number;
  failures_7d: number;
  high_failure_members_30d: number;
  paused_count: number;
}

interface DashboardPayload {
  recent_failures_24h: RecentFailure[];
  high_failure_members: HighFailureMember[];
  failure_trends_14d: TrendPoint[];
  paused_members: PausedMember[];
  counts: Counts;
  generated_at: string;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diffMs = Date.now() - t;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminCollectionDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.rpc("get_admin_collection_dashboard");
      if (err) throw new Error(err.message);
      setData(res as DashboardPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (adminLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentTeal} />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.blockedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A2342" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.collection.title")}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accentTeal} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={40} color={colors.errorText} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : !data ? null : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentTeal} />
          }
        >
          {/* Counts strip */}
          <View style={styles.countsStrip}>
            <CountCell label={t("admin.collection.count_24h")} value={data.counts.failures_24h}         tone={data.counts.failures_24h > 0 ? "danger" : "success"} />
            <CountCell label={t("admin.collection.count_7d")}  value={data.counts.failures_7d}          tone={data.counts.failures_7d  > 0 ? "warning" : "success"} />
            <CountCell label={t("admin.collection.count_high")} value={data.counts.high_failure_members_30d} tone="warning" />
            <CountCell label={t("admin.collection.count_paused")} value={data.counts.paused_count}      tone="neutral" />
          </View>

          {/* Trends card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.collection.trends_title")}</Text>
            </View>
            <TrendsBars points={data.failure_trends_14d} />
            {data.failure_trends_14d.every((p) => p.n === 0) ? (
              <Text style={styles.trendsEmpty}>{t("admin.collection.trends_empty")}</Text>
            ) : null}
          </View>

          {/* Recent failures (24h) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.collection.recent_title", { count: data.recent_failures_24h.length })}
              </Text>
            </View>
            {data.recent_failures_24h.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.collection.recent_empty")}</Text>
            ) : (
              data.recent_failures_24h.map((f) => (
                <View key={`${f.source}-${f.row_id}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {f.member_name ?? "—"}
                      </Text>
                      <View
                        style={[
                          styles.badge,
                          f.source === "autopay" ? styles.badgeAutopay : styles.badgeContribution,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color:
                                f.source === "autopay"
                                  ? colors.warningLabel
                                  : "#991B1B",
                            },
                          ]}
                        >
                          {t(`admin.collection.source_${f.source}`)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {f.circle_name ?? "—"}
                      {f.amount != null ? ` · $${Number(f.amount).toFixed(2)}` : ""}
                      {f.cycle_number != null ? ` · cycle ${f.cycle_number}` : ""}
                      {" · "}
                      {fmtRelative(f.failed_at)}
                    </Text>
                    {f.failure_reason ? (
                      <Text style={styles.rowReason} numberOfLines={2}>
                        {f.failure_code ? `[${f.failure_code}] ` : ""}
                        {f.failure_reason}
                      </Text>
                    ) : null}
                    {f.retry_count > 0 ? (
                      <Text style={styles.rowSub}>
                        {t("admin.collection.retry_count", { n: f.retry_count })}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          {/* High-failure members (30d) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.collection.high_title", { count: data.high_failure_members.length })}
              </Text>
            </View>
            <Text style={styles.cardSubtitle}>{t("admin.collection.high_subtitle")}</Text>
            {data.high_failure_members.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.collection.high_empty")}</Text>
            ) : (
              data.high_failure_members.map((m) => (
                <View key={m.user_id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {m.member_name ?? m.email ?? "—"}
                      </Text>
                      <View style={[styles.badge, styles.badgeCount]}>
                        <Text style={[styles.badgeText, { color: "#991B1B" }]}>
                          {t("admin.collection.fail_count", { n: m.failures_30d })}
                        </Text>
                      </View>
                    </View>
                    {m.latest_failure_reason ? (
                      <Text style={styles.rowReason} numberOfLines={2}>
                        {m.latest_failure_reason}
                      </Text>
                    ) : null}
                    <Text style={styles.rowSub}>
                      {m.latest_failure_at
                        ? t("admin.collection.latest_failure", { rel: fmtRelative(m.latest_failure_at) })
                        : "—"}
                      {m.collections_paused_at
                        ? ` · ${t("admin.collection.already_paused")}`
                        : ""}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Paused members */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pause-circle-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.collection.paused_title", { count: data.paused_members.length })}
              </Text>
            </View>
            {data.paused_members.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.collection.paused_empty")}</Text>
            ) : (
              data.paused_members.map((p) => (
                <View key={p.user_id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {p.member_name ?? p.email ?? "—"}
                    </Text>
                    <Text style={styles.rowSub}>
                      {t("admin.collection.paused_by", {
                        name: p.paused_by_name ?? "—",
                        rel: fmtRelative(p.collections_paused_at),
                      })}
                    </Text>
                    {p.collections_paused_reason ? (
                      <Text style={styles.rowReason} numberOfLines={2}>
                        "{p.collections_paused_reason}"
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>

          <Text style={styles.generatedAt}>
            {t("admin.collection.generated_at", { rel: fmtRelative(data.generated_at) })}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TrendsBars({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.n));
  return (
    <View style={trendStyles.wrap}>
      <View style={trendStyles.barsRow}>
        {points.map((p) => {
          const heightPct = (p.n / max) * 100;
          const isEmpty = p.n === 0;
          return (
            <View key={p.day} style={trendStyles.barCol}>
              <View style={trendStyles.barTrack}>
                <View
                  style={[
                    trendStyles.barFill,
                    {
                      height: `${Math.max(isEmpty ? 3 : 10, heightPct)}%`,
                      backgroundColor: isEmpty ? colors.border : "#991B1B",
                    },
                  ]}
                />
              </View>
              <Text style={trendStyles.barLabel}>{fmtDay(p.day).slice(-2)}</Text>
              {p.n > 0 ? <Text style={trendStyles.barCount}>{p.n}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CountCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral" | "navy";
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    navy:    { bg: "#F1F5F9",        fg: colors.primaryNavy },
    success: { bg: "#D1FAE5",        fg: colors.successLabel },
    warning: { bg: colors.warningBg, fg: colors.warningLabel },
    danger:  { bg: colors.errorBg,   fg: "#991B1B" },
    neutral: { bg: "#E2E8F0",        fg: "#475569" },
  };
  const s = toneMap[tone];
  return (
    <View style={[styles.countCell, { backgroundColor: s.bg }]}>
      <Text style={[styles.countValue, { color: s.fg }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: s.fg }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: "#0A2342",
  },
  backBtn: {
    width: 38, height: 38,
    alignItems: "center", justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  scroll: { padding: 12 },

  countsStrip: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  countCell: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  countValue: { fontSize: 22, fontWeight: "800" },
  countLabel: { fontSize: 10, fontWeight: "700", textAlign: "center", marginTop: 4 },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.primaryNavy },
  cardSubtitle: { fontSize: 11, color: colors.textSecondary, fontStyle: "italic", marginTop: -4 },
  trendsEmpty: {
    fontSize: 11, color: colors.textSecondary, fontStyle: "italic",
    textAlign: "center", paddingTop: 4,
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  rowTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowReason: { fontSize: 11, color: colors.textPrimary, fontStyle: "italic", marginTop: 4 },
  rowSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  badgeContribution: { backgroundColor: colors.errorBg },
  badgeAutopay:      { backgroundColor: colors.warningBg },
  badgeCount:        { backgroundColor: colors.errorBg },

  emptyText: {
    fontSize: 12, color: colors.textSecondary, fontStyle: "italic",
    textAlign: "center", paddingVertical: 12,
  },
  errorText: { marginTop: 12, color: colors.errorText, textAlign: "center", fontSize: 13 },
  blockedText: { marginTop: 12, color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryNavy,
  },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  generatedAt: {
    fontSize: 11, color: colors.textSecondary, textAlign: "center", padding: 8,
  },
});

const trendStyles = StyleSheet.create({
  wrap: { paddingVertical: 6 },
  barsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 2,
    height: 90,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: "80%",
    height: 60,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    borderRadius: 3,
  },
  barFill: { width: "100%", borderRadius: 3 },
  barLabel: { fontSize: 9, color: colors.textSecondary, marginTop: 4 },
  barCount: { fontSize: 9, fontWeight: "700", color: "#991B1B", marginTop: 1 },
});
