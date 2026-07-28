// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminDisputeDashboardScreen.tsx — mig 384
// ═══════════════════════════════════════════════════════════════════════════
//
// Admin visibility layer over the disputes table. Powered by mig 384's
// get_admin_dispute_dashboard RPC. Vertical stack:
//   1. Counts strip (active / escalated / SLA-breached / resolved 7d).
//   2. Filter chips (all_active / escalated / sla_breached / recent_resolved).
//   3. List of dispute rows with priority + SLA badge, tap → detail.
//
// Actions live on the detail screen (AdminDisputeDetailScreen).
// Admin-gated via useIsAdmin; readonly gate for non-admins.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type FilterKey = "all_active" | "escalated" | "sla_breached" | "recent_resolved";
const FILTERS: FilterKey[] = ["all_active", "escalated", "sla_breached", "recent_resolved"];

interface OpenRow {
  dispute_id: string;
  circle_id: string | null;
  circle_name: string | null;
  reporter_user_id: string;
  reporter_name: string;
  against_user_id: string | null;
  against_name: string | null;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  escalation_tier: string | null;
  escalated_at: string | null;
  escalated_to_admin_id: string | null;
  escalated_to_name: string | null;
  admin_override: boolean;
  response_at: string | null;
  created_at: string;
  age_hours: number;
  sla_status: "ok" | "warning" | "critical";
  message_count: number;
}

interface ResolvedRow {
  dispute_id: string;
  circle_id: string | null;
  circle_name: string | null;
  reporter_name: string;
  against_name: string | null;
  title: string;
  priority: string;
  status: string;
  resolution: string | null;
  resolution_type: string | null;
  resolved_by: string | null;
  resolver_name: string | null;
  resolved_at: string | null;
  admin_override: boolean;
  override_reason: string | null;
  resolution_hours: number;
}

interface DashboardPayload {
  disputes_open: OpenRow[];
  resolved_recent: ResolvedRow[];
  counts: {
    active: number;
    escalated: number;
    sla_breached: number;
    resolved_7d: number;
  };
  sla_warn_hours: number;
  sla_critical_hours: number;
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

const SLA_STYLE: Record<string, { bg: string; fg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ok:       { bg: "#D1FAE5",           fg: colors.successLabel, icon: "checkmark-circle-outline" },
  warning:  { bg: colors.warningBg,    fg: colors.warningLabel, icon: "warning-outline" },
  critical: { bg: colors.errorBg,      fg: "#991B1B",           icon: "alert-circle-outline" },
};

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  low:      { bg: "#E2E8F0",        fg: "#475569" },
  medium:   { bg: "#DBEAFE",        fg: "#1E40AF" },
  high:     { bg: colors.warningBg, fg: colors.warningLabel },
  urgent:   { bg: colors.errorBg,   fg: "#991B1B" },
};

const TIER_LABEL: Record<string, string> = {
  elder_l2:     "Elder L2",
  global_queue: "Global",
};

export default function AdminDisputeDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all_active");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.rpc("get_admin_dispute_dashboard");
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

  const filteredOpen: OpenRow[] = useMemo(() => {
    if (!data) return [];
    switch (filter) {
      case "escalated":
        return data.disputes_open.filter((d) => d.escalation_tier !== null);
      case "sla_breached":
        return data.disputes_open.filter((d) => d.sla_status !== "ok");
      case "all_active":
      default:
        return data.disputes_open;
    }
  }, [filter, data]);

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

  const renderRow = (row: OpenRow) => {
    const slaStyle = SLA_STYLE[row.sla_status] ?? SLA_STYLE.ok;
    const priStyle = PRIORITY_STYLE[row.priority] ?? PRIORITY_STYLE.medium;
    return (
      <TouchableOpacity
        key={row.dispute_id}
        style={styles.row}
        onPress={() => navigation.navigate("AdminDisputeDetail", { disputeId: row.dispute_id })}
        accessibilityRole="button"
      >
        <View style={{ flex: 1 }}>
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
            <View style={[styles.badge, { backgroundColor: priStyle.bg }]}>
              <Text style={[styles.badgeText, { color: priStyle.fg }]}>{row.priority}</Text>
            </View>
          </View>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {row.circle_name ?? "—"} · {row.reporter_name}
            {row.against_name ? ` → ${row.against_name}` : ""}
          </Text>
          <View style={styles.rowFooter}>
            <View style={[styles.badgeSm, { backgroundColor: slaStyle.bg }]}>
              <Ionicons name={slaStyle.icon} size={11} color={slaStyle.fg} />
              <Text style={[styles.badgeSmText, { color: slaStyle.fg }]}>
                {Math.round(row.age_hours)}h
              </Text>
            </View>
            {row.escalation_tier ? (
              <View style={[styles.badgeSm, { backgroundColor: colors.errorBg }]}>
                <Ionicons name="arrow-up-circle-outline" size={11} color="#991B1B" />
                <Text style={[styles.badgeSmText, { color: "#991B1B" }]}>
                  {TIER_LABEL[row.escalation_tier] ?? row.escalation_tier}
                </Text>
              </View>
            ) : null}
            {row.admin_override ? (
              <View style={[styles.badgeSm, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="hammer-outline" size={11} color="#92400E" />
                <Text style={[styles.badgeSmText, { color: "#92400E" }]}>override</Text>
              </View>
            ) : null}
            <Text style={styles.rowSub}>
              {row.assignee_name
                ? t("admin.disputes.assignee", { name: row.assignee_name })
                : t("admin.disputes.unassigned")}
              {" · "}
              {row.message_count} {t("admin.disputes.messages_short")}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderResolvedRow = (row: ResolvedRow) => (
    <TouchableOpacity
      key={row.dispute_id}
      style={styles.row}
      onPress={() => navigation.navigate("AdminDisputeDetail", { disputeId: row.dispute_id })}
      accessibilityRole="button"
    >
      <View style={{ flex: 1 }}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={1}>{row.title}</Text>
          <View style={[styles.badge, { backgroundColor: "#D1FAE5" }]}>
            <Text style={[styles.badgeText, { color: colors.successLabel }]}>resolved</Text>
          </View>
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {row.circle_name ?? "—"} · {row.reporter_name}
        </Text>
        <View style={styles.rowFooter}>
          <Text style={styles.rowSub}>
            {row.resolver_name
              ? t("admin.disputes.resolved_by", { name: row.resolver_name })
              : "—"}
            {" · "}
            {row.resolved_at ? fmtRelative(row.resolved_at) : "—"}
            {" · "}
            {Math.round(row.resolution_hours)}h
          </Text>
          {row.admin_override ? (
            <View style={[styles.badgeSm, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="hammer-outline" size={11} color="#92400E" />
              <Text style={[styles.badgeSmText, { color: "#92400E" }]}>override</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

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
        <Text style={styles.headerTitle}>{t("admin.disputes.title")}</Text>
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
          <View style={styles.countsStrip}>
            <CountCell label={t("admin.disputes.count_active")}       value={data.counts.active}       tone="navy" />
            <CountCell label={t("admin.disputes.count_escalated")}    value={data.counts.escalated}    tone="danger" />
            <CountCell label={t("admin.disputes.count_sla_breached")} value={data.counts.sla_breached} tone="warning" />
            <CountCell label={t("admin.disputes.count_resolved_7d")}  value={data.counts.resolved_7d}  tone="success" />
          </View>

          <View style={styles.filtersWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, filter === f && styles.chipActive]}
                  onPress={() => setFilter(f)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                    {t(`admin.disputes.filter_${f}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {filter === "recent_resolved" ? (
            data.resolved_recent.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.disputes.empty_resolved")}</Text>
            ) : (
              data.resolved_recent.map(renderResolvedRow)
            )
          ) : filteredOpen.length === 0 ? (
            <Text style={styles.emptyText}>{t(`admin.disputes.empty_${filter}`)}</Text>
          ) : (
            filteredOpen.map(renderRow)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CountCell({ label, value, tone }: { label: string; value: number; tone: "navy" | "danger" | "warning" | "success" }) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    navy:    { bg: "#F1F5F9",        fg: colors.primaryNavy },
    danger:  { bg: colors.errorBg,   fg: "#991B1B" },
    warning: { bg: colors.warningBg, fg: colors.warningLabel },
    success: { bg: "#D1FAE5",        fg: colors.successLabel },
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

  filtersWrap: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    backgroundColor: colors.cardBg,
  },
  chipActive: { backgroundColor: colors.primaryNavy, borderColor: colors.primaryNavy },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: "#FFFFFF" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  rowFooter: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  rowSub: { fontSize: 11, color: colors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  badgeSm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeSmText: { fontSize: 10, fontWeight: "700" },

  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    padding: 24,
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
});
