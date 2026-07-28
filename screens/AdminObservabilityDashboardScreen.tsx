// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminObservabilityDashboardScreen.tsx — mig 394
// ═══════════════════════════════════════════════════════════════════════════
//
// System observability dashboard. Read-only surface on top of
// get_system_observability_dashboard(hours). Four cards:
//   1. User activity (event volume + by category + top users)
//   2. Cron health (per-job rollup: last status, avg exec, failures)
//   3. Stripe webhooks (volume + processing_error rate + last errors)
//   4. Admin actions (top admins + top action types)
//
// Time range selector: 24h / 7d / 30d. Manual refresh via pull.
//
// Explicit deferrals (see mig header):
//   - Edge Function per-endpoint stats → Supabase Log Explorer.
//   - Failed auth counts → auth.audit_log_entries is empty at project
//     level (GOTRUE_AUDIT_LOG_ENABLED off).
//   - Geographic distribution → user_events.geo_country is NULL in prod.
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

interface CategoryRow {
  category: string;
  count: number;
  failures: number;
}
interface TopUserRow {
  user_id: string;
  user_name: string | null;
  count: number;
  failures: number;
}
interface UserActivity {
  total: number;
  total_24h: number;
  total_7d: number;
  total_30d: number;
  window_total: number;
  window_failures: number;
  unique_users_in_window: number;
  by_category: CategoryRow[];
  top_users: TopUserRow[];
}

interface CronRow {
  job_name: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  runs_in_window: number;
  successes_in_window: number;
  failures_in_window: number;
  avg_execution_ms: number | null;
}

interface WebhookTypeRow {
  event_type: string;
  count: number;
  failures: number;
}
interface WebhookError {
  id: string;
  event_type: string;
  processing_error: string | null;
  created_at: string;
}
interface Webhooks {
  total_in_window: number;
  failed_in_window: number;
  by_type: WebhookTypeRow[];
  recent_errors: WebhookError[];
}

interface AdminRow {
  admin_id: string;
  admin_name: string | null;
  count: number;
}
interface ActionRow {
  action: string;
  count: number;
}
interface AdminActions {
  total_in_window: number;
  top_admins: AdminRow[];
  top_actions: ActionRow[];
}

interface Payload {
  generated_at: string;
  window_hours: number;
  window_from: string;
  user_activity: UserActivity;
  cron_health: CronRow[];
  webhooks: Webhooks;
  admin_actions: AdminActions;
}

const RANGES: Array<{ hours: number; labelKey: string }> = [
  { hours: 24, labelKey: "admin.observability.range_24h" },
  { hours: 168, labelKey: "admin.observability.range_7d" },
  { hours: 720, labelKey: "admin.observability.range_30d" },
];

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

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function AdminObservabilityDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.rpc(
        "get_system_observability_dashboard",
        { p_hours_back: hours },
      );
      if (err) throw new Error(err.message);
      setData(res as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [hours]);

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
        <Text style={styles.headerTitle}>
          {t("admin.observability.title")}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Time range chips — always visible */}
      <View style={styles.rangeStrip}>
        {RANGES.map((r) => (
          <TouchableOpacity
            key={r.hours}
            style={[styles.rangeChip, hours === r.hours && styles.rangeChipActive]}
            onPress={() => setHours(r.hours)}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.rangeChipText,
                hours === r.hours && styles.rangeChipTextActive,
              ]}
            >
              {t(r.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentTeal}
            />
          }
        >
          {/* User activity */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pulse-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.observability.user_activity_title")}
              </Text>
            </View>
            <View style={styles.countsStrip}>
              <CountCell
                label={t("admin.observability.events_window")}
                value={data.user_activity.window_total}
                tone="navy"
              />
              <CountCell
                label={t("admin.observability.unique_users")}
                value={data.user_activity.unique_users_in_window}
                tone="navy"
              />
              <CountCell
                label={t("admin.observability.failures")}
                value={data.user_activity.window_failures}
                tone={
                  data.user_activity.window_failures > 0 ? "warning" : "neutral"
                }
              />
              <CountCell
                label={t("admin.observability.total_all_time")}
                value={data.user_activity.total}
                tone="neutral"
              />
            </View>
            <Text style={styles.subLine}>
              {t("admin.observability.failure_rate", {
                pct: pct(
                  data.user_activity.window_failures,
                  data.user_activity.window_total,
                ),
              })}
            </Text>

            <Text style={styles.sectionLabel}>
              {t("admin.observability.by_category")}
            </Text>
            {data.user_activity.by_category.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.by_category_empty")}
              </Text>
            ) : (
              data.user_activity.by_category.map((c) => (
                <View key={c.category} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {c.category}
                  </Text>
                  <Text style={styles.kvVal}>
                    {c.count}
                    {c.failures > 0 ? ` · ${c.failures} fail` : ""}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.sectionLabel}>
              {t("admin.observability.top_users")}
            </Text>
            {data.user_activity.top_users.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.top_users_empty")}
              </Text>
            ) : (
              data.user_activity.top_users.map((u) => (
                <View key={u.user_id} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {u.user_name ?? u.user_id.slice(0, 8) + "…"}
                  </Text>
                  <Text style={styles.kvVal}>
                    {u.count}
                    {u.failures > 0 ? ` · ${u.failures} fail` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Cron health */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.observability.cron_health_title", {
                  count: data.cron_health.length,
                })}
              </Text>
            </View>
            {data.cron_health.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.cron_empty")}
              </Text>
            ) : (
              data.cron_health.map((c) => {
                const tone =
                  c.last_status === "failure"
                    ? "danger"
                    : c.failures_in_window > 0
                    ? "warning"
                    : "neutral";
                return (
                  <View key={c.job_name} style={styles.cronRow}>
                    <View style={styles.cronHeader}>
                      <Text style={styles.cronJob} numberOfLines={1}>
                        {c.job_name}
                      </Text>
                      <View
                        style={[
                          styles.statusPill,
                          tone === "danger" && styles.pillDanger,
                          tone === "warning" && styles.pillWarning,
                          tone === "neutral" && styles.pillNeutral,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            tone === "danger" && { color: "#991B1B" },
                            tone === "warning" && { color: colors.warningLabel },
                            tone === "neutral" && { color: "#475569" },
                          ]}
                        >
                          {c.last_status ?? "—"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.cronMeta} numberOfLines={2}>
                      {t("admin.observability.cron_runs", {
                        runs: c.runs_in_window,
                        fail: c.failures_in_window,
                      })}
                      {c.avg_execution_ms != null
                        ? " · " +
                          t("admin.observability.cron_avg_ms", {
                            ms: c.avg_execution_ms,
                          })
                        : ""}
                      {c.last_run_at
                        ? " · " + fmtRelative(c.last_run_at)
                        : ""}
                    </Text>
                    {c.last_error ? (
                      <Text style={styles.cronError} numberOfLines={2}>
                        {c.last_error}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {/* Webhooks */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="git-network-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.observability.webhooks_title")}
              </Text>
            </View>
            <View style={styles.countsStrip}>
              <CountCell
                label={t("admin.observability.webhooks_total")}
                value={data.webhooks.total_in_window}
                tone="navy"
              />
              <CountCell
                label={t("admin.observability.webhooks_failed")}
                value={data.webhooks.failed_in_window}
                tone={
                  data.webhooks.failed_in_window > 0 ? "danger" : "success"
                }
              />
            </View>
            <Text style={styles.sectionLabel}>
              {t("admin.observability.webhooks_by_type")}
            </Text>
            {data.webhooks.by_type.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.webhooks_by_type_empty")}
              </Text>
            ) : (
              data.webhooks.by_type.map((r) => (
                <View key={r.event_type} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {r.event_type}
                  </Text>
                  <Text style={styles.kvVal}>
                    {r.count}
                    {r.failures > 0 ? ` · ${r.failures} fail` : ""}
                  </Text>
                </View>
              ))
            )}

            {data.webhooks.recent_errors.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>
                  {t("admin.observability.webhooks_recent_errors")}
                </Text>
                {data.webhooks.recent_errors.map((e) => (
                  <View key={e.id} style={styles.errorRow}>
                    <Text style={styles.errorRowType} numberOfLines={1}>
                      {e.event_type} · {fmtRelative(e.created_at)}
                    </Text>
                    <Text style={styles.errorRowText} numberOfLines={3}>
                      {e.processing_error}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>

          {/* Admin actions */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.observability.admin_actions_title")}
              </Text>
            </View>
            <View style={styles.countsStrip}>
              <CountCell
                label={t("admin.observability.admin_total")}
                value={data.admin_actions.total_in_window}
                tone="navy"
              />
            </View>
            <Text style={styles.sectionLabel}>
              {t("admin.observability.admin_top_admins")}
            </Text>
            {data.admin_actions.top_admins.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.admin_top_admins_empty")}
              </Text>
            ) : (
              data.admin_actions.top_admins.map((a) => (
                <View key={a.admin_id} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {a.admin_name ?? a.admin_id.slice(0, 8) + "…"}
                  </Text>
                  <Text style={styles.kvVal}>{a.count}</Text>
                </View>
              ))
            )}

            <Text style={styles.sectionLabel}>
              {t("admin.observability.admin_top_actions")}
            </Text>
            {data.admin_actions.top_actions.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.observability.admin_top_actions_empty")}
              </Text>
            ) : (
              data.admin_actions.top_actions.map((r) => (
                <View key={r.action} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {r.action}
                  </Text>
                  <Text style={styles.kvVal}>{r.count}</Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.footerNote}>
            {t("admin.observability.deferrals_note")}
          </Text>
          <Text style={styles.generatedAt}>
            {t("admin.observability.generated_at", {
              rel: fmtRelative(data.generated_at),
            })}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
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
    navy: { bg: "#F1F5F9", fg: colors.primaryNavy },
    success: { bg: "#D1FAE5", fg: colors.successLabel },
    warning: { bg: colors.warningBg, fg: colors.warningLabel },
    danger: { bg: colors.errorBg, fg: "#991B1B" },
    neutral: { bg: "#E2E8F0", fg: "#475569" },
  };
  const s = toneMap[tone];
  return (
    <View style={[styles.countCell, { backgroundColor: s.bg }]}>
      <Text style={[styles.countValue, { color: s.fg }]}>{value}</Text>
      <Text style={[styles.countLabel, { color: s.fg }]} numberOfLines={2}>
        {label}
      </Text>
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
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  rangeStrip: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    paddingBottom: 6,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  rangeChipActive: {
    backgroundColor: colors.primaryNavy,
    borderColor: colors.primaryNavy,
  },
  rangeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  rangeChipTextActive: { color: "#FFFFFF" },

  scroll: { padding: 12, paddingTop: 4 },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryNavy,
  },

  countsStrip: { flexDirection: "row", gap: 8, marginBottom: 4 },
  countCell: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 74,
  },
  countValue: { fontSize: 20, fontWeight: "800" },
  countLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
  },

  subLine: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },

  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  kvKey: { flex: 1, fontSize: 12, color: colors.textPrimary },
  kvVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryNavy,
    marginLeft: 12,
  },

  cronRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 3,
  },
  cronHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  cronJob: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  cronMeta: { fontSize: 11, color: colors.textSecondary },
  cronError: {
    fontSize: 11,
    color: "#991B1B",
    fontStyle: "italic",
    marginTop: 2,
  },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillDanger: { backgroundColor: colors.errorBg },
  pillWarning: { backgroundColor: colors.warningBg },
  pillNeutral: { backgroundColor: "#E2E8F0" },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  errorRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 2,
  },
  errorRowType: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  errorRowText: {
    fontSize: 11,
    color: "#991B1B",
    fontStyle: "italic",
  },

  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },
  errorText: {
    marginTop: 12,
    color: colors.errorText,
    textAlign: "center",
    fontSize: 13,
  },
  blockedText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primaryNavy,
  },
  retryText: { color: "#FFFFFF", fontWeight: "700" },

  footerNote: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  generatedAt: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    padding: 8,
  },
});
