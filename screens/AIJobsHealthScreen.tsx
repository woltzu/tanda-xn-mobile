// =============================================================================
// AIJobsHealthScreen -- admin monitor for the 6-job CronAIJobEngine fleet.
// =============================================================================
//
// Renders read-only status pulled from existing tables:
//   cron_job_logs           -- per-job recent runs + averages
//   model_performance_logs  -- weekly accuracy + drift verdicts
//   cohort_analytics        -- monthly cohort metrics
//
// Of the 6 jobs CronAIJobEngine defines, only the two net-new ones --
// weekly-model-performance-check and monthly-cohort-analysis -- are
// scheduled by migration 113. The other four (#1 behavioral signals,
// #2 default probability, #3 circle health, #5 XnScore recalibration)
// are still covered by scoring-pipeline-daily, which writes its own
// cron_job_logs rows so the same dashboard reflects them anyway.
//
// Dependencies: hooks/useCronAIJobs (existing), hooks/useIsAdmin (added
// in migration 114 commit). The screen is gated TWO ways:
//   1. Frontend: useIsAdmin -> if false, render an "Access denied" view
//      and skip every data hook so they never run for non-admins.
//   2. Backend: RLS on cron_job_logs / model_performance_logs /
//      cohort_analytics (migration 114) restricts SELECT to admin_users
//      rows + service_role. If somebody bypasses the frontend guard,
//      they still get empty arrays from PostgREST instead of real data.
//
// The Dashboard chip is __DEV__-only, so the visible entry point is dev
// builds only; the guards above also protect prod once the chip is moved
// to a role-gated admin menu.
// =============================================================================

import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  useAIJobHealth,
  useAIJobLogs,
  useModelPerformance,
  useCohortAnalytics,
  type JobHealthSummary,
  type CronJobLog,
} from "../hooks/useCronAIJobs";
import { useIsAdmin } from "../hooks/useIsAdmin";

const COLORS = {
  navy: "#0A2342",
  teal: "#00C6AE",
  green: "#10B981",
  amber: "#D97706",
  red: "#DC2626",
  blue: "#2563EB",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F3F4F6",
  white: "#FFFFFF",
};

function statusColor(status: string | null): string {
  switch (status) {
    case "success": return COLORS.green;
    case "partial": return COLORS.amber;
    case "failed":  return COLORS.red;
    case "running": return COLORS.blue;
    default:         return COLORS.muted;
  }
}

function statusIcon(status: string | null): keyof typeof Ionicons.glyphMap {
  switch (status) {
    case "success": return "checkmark-circle";
    case "partial": return "alert-circle";
    case "failed":  return "close-circle";
    case "running": return "sync-circle";
    default:         return "help-circle-outline";
  }
}

function fmtTime(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtMs(ms: number): string {
  if (!ms) return "--";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined) return "--";
  return `${(n * 100).toFixed(digits)}%`;
}

export default function AIJobsHealthScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading, error: adminError } = useIsAdmin();

  // Early-return BEFORE wiring the data hooks. This isn't just cosmetic:
  // useAIJobHealth/useAIJobLogs/etc. each issue supabase queries on mount,
  // so calling them for a non-admin would (a) spam the network with
  // requests that RLS will reject anyway, and (b) leak job-name metadata
  // via the cron_job_logs.job_name column even when rows return empty.
  // We fail-closed on loading too -- the access-denied frame shows
  // "Checking permissions" until isAdmin resolves.
  if (adminLoading || !isAdmin) {
    return (
      <AccessGate
        loading={adminLoading}
        error={adminError}
        onBack={() => navigation.goBack()}
      />
    );
  }

  return <AIJobsHealthScreenInner />;
}

function AccessGate({
  loading,
  error,
  onBack,
}: {
  loading: boolean;
  error: string | null;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("ai_health.header")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.deniedBox}>
        {loading ? (
          <>
            <ActivityIndicator color={COLORS.teal} />
            <Text style={styles.deniedTitle}>{t("ai_health.denied_checking")}</Text>
            <Text style={styles.deniedBody}>
              Confirming your admin role with the server.
            </Text>
          </>
        ) : (
          <>
            <Ionicons
              name="lock-closed-outline"
              size={36}
              color={COLORS.red}
            />
            <Text style={styles.deniedTitle}>{t("ai_health.denied_title")}</Text>
            <Text style={styles.deniedBody}>
              This screen surfaces operational metrics restricted to active
              admins. Ask an admin to add you to the team if you need access.
            </Text>
            {error ? (
              <Text style={styles.deniedError}>Reason: {error}</Text>
            ) : null}
            <TouchableOpacity style={styles.deniedBtn} onPress={onBack}>
              <Text style={styles.deniedBtnText}>{t("ai_health.btn_go_back")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function AIJobsHealthScreenInner() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const health = useAIJobHealth();
  const logs = useAIJobLogs(undefined, 20);
  const perf = useModelPerformance("default_probability", 6);
  const cohorts = useCohortAnalytics(undefined, 12);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([health.refresh(), logs.refresh(), perf.refresh(), cohorts.refresh()]);
    setRefreshing(false);
  };

  const loading = health.loading || logs.loading || perf.loading || cohorts.loading;

  const summaries: JobHealthSummary[] = health.summaries;

  // Group cohorts by type for compact display
  const cohortsByType = useMemo(() => {
    const m = new Map<string, typeof cohorts.cohorts>();
    for (const c of cohorts.cohorts) {
      const arr = m.get(c.cohortType) ?? [];
      arr.push(c);
      m.set(c.cohortType, arr);
    }
    return Array.from(m.entries());
  }, [cohorts.cohorts]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("ai_health.header")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.teal} />
        }
      >
        {/* Fleet overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewLabel}>{t("ai_health.overview_label")}</Text>
          <View style={styles.overviewRow}>
            <View style={styles.overviewStat}>
              <Text style={styles.overviewValue}>{health.overallSuccessRate}%</Text>
              <Text style={styles.overviewSub}>success rate</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text
                style={[
                  styles.overviewValue,
                  { color: health.allHealthy ? COLORS.green : COLORS.amber },
                ]}
              >
                {health.allHealthy ? "Healthy" : "Attention"}
              </Text>
              <Text style={styles.overviewSub}>{health.jobCount} jobs</Text>
            </View>
            <View style={styles.overviewStat}>
              <Text
                style={[
                  styles.overviewValue,
                  {
                    color:
                      health.totalRecentFailures > 0 ? COLORS.red : COLORS.muted,
                  },
                ]}
              >
                {health.totalRecentFailures}
              </Text>
              <Text style={styles.overviewSub}>recent failures</Text>
            </View>
          </View>
        </View>

        {/* Per-job summaries */}
        <Text style={styles.sectionTitle}>Jobs</Text>
        {loading && summaries.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.teal} />
          </View>
        ) : summaries.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("ai_health.empty_history")}</Text>
          </View>
        ) : (
          summaries.map((s) => (
            <View
              key={s.jobName}
              style={[
                styles.jobCard,
                { borderLeftColor: statusColor(s.lastStatus) },
              ]}
            >
              <View style={styles.jobHeader}>
                <Ionicons
                  name={statusIcon(s.lastStatus)}
                  size={18}
                  color={statusColor(s.lastStatus)}
                />
                <Text style={styles.jobName}>{s.jobName}</Text>
              </View>
              <View style={styles.jobMetrics}>
                <View style={styles.jobMetric}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_last_run")}</Text>
                  <Text style={styles.metricValue}>{fmtTime(s.lastRunAt)}</Text>
                </View>
                <View style={styles.jobMetric}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_success_rate")}</Text>
                  <Text style={styles.metricValue}>
                    {Math.round(s.successRate * 100)}%
                  </Text>
                </View>
                <View style={styles.jobMetric}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_avg_runtime")}</Text>
                  <Text style={styles.metricValue}>
                    {fmtMs(s.avgExecutionTimeMs)}
                  </Text>
                </View>
                <View style={styles.jobMetric}>
                  <Text style={styles.metricLabel}>Runs (20)</Text>
                  <Text style={styles.metricValue}>{s.totalRuns}</Text>
                </View>
              </View>
              {s.recentFailures > 0 ? (
                <Text style={styles.jobAlert}>
                  {s.recentFailures} failure(s) in last 5 runs
                </Text>
              ) : null}
            </View>
          ))
        )}

        {/* Model performance */}
        <Text style={styles.sectionTitle}>{t("ai_health.section_model")}</Text>
        <View style={styles.modelCard}>
          {perf.latestAccuracy === null ? (
            <Text style={styles.muted}>{t("ai_health.empty_eval")}</Text>
          ) : (
            <>
              <View style={styles.modelGrid}>
                <View style={styles.modelCell}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_accuracy")}</Text>
                  <Text style={styles.modelBig}>
                    {fmtPct(perf.latestAccuracy)}
                  </Text>
                </View>
                <View style={styles.modelCell}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_precision")}</Text>
                  <Text style={styles.modelBig}>
                    {fmtPct(perf.latestPrecision)}
                  </Text>
                </View>
                <View style={styles.modelCell}>
                  <Text style={styles.metricLabel}>{t("ai_health.metric_recall")}</Text>
                  <Text style={styles.modelBig}>
                    {fmtPct(perf.latestRecall)}
                  </Text>
                </View>
                <View style={styles.modelCell}>
                  <Text style={styles.metricLabel}>F1</Text>
                  <Text style={styles.modelBig}>
                    {fmtPct(perf.latestF1)}
                  </Text>
                </View>
              </View>
              <View style={styles.modelTrend}>
                <Text style={styles.metricLabel}>{t("ai_health.metric_trend")}</Text>
                <Text
                  style={[
                    styles.trendValue,
                    {
                      color:
                        perf.accuracyTrend === "improving"
                          ? COLORS.green
                          : perf.accuracyTrend === "declining"
                          ? COLORS.red
                          : COLORS.muted,
                    },
                  ]}
                >
                  {perf.accuracyTrend}
                </Text>
                {perf.hasDrift ? (
                  <View
                    style={[
                      styles.driftBadge,
                      {
                        backgroundColor:
                          perf.driftSeverity === "severe"
                            ? "#FEE2E2"
                            : perf.driftSeverity === "moderate"
                            ? "#FEF3C7"
                            : "#E5E7EB",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.driftText,
                        {
                          color:
                            perf.driftSeverity === "severe"
                              ? "#991B1B"
                              : perf.driftSeverity === "moderate"
                              ? "#92400E"
                              : "#374151",
                        },
                      ]}
                    >
                      drift: {perf.driftSeverity}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.muted}>
                {perf.evaluationCount} evaluation(s) on file
                {perf.openDriftAlerts > 0
                  ? ` -- ${perf.openDriftAlerts} open drift alert(s)`
                  : ""}
              </Text>
            </>
          )}
        </View>

        {/* Cohort analytics */}
        <Text style={styles.sectionTitle}>{t("ai_health.section_cohort")}</Text>
        {cohorts.cohorts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("ai_health.empty_cohort")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.cohortSummary}>
              <View style={styles.cohortStat}>
                <Text style={styles.metricLabel}>{t("ai_health.metric_retention")}</Text>
                <Text style={styles.cohortBig}>
                  {cohorts.avgRetentionRate}%
                </Text>
              </View>
              <View style={styles.cohortStat}>
                <Text style={styles.metricLabel}>{t("ai_health.metric_avg_xnscore")}</Text>
                <Text style={styles.cohortBig}>
                  {cohorts.avgXnScore.toFixed(1)}
                </Text>
              </View>
              <View style={styles.cohortStat}>
                <Text style={styles.metricLabel}>{t("ai_health.metric_members")}</Text>
                <Text style={styles.cohortBig}>{cohorts.totalMembers}</Text>
              </View>
            </View>
            {cohortsByType.map(([type, rows]) => (
              <View key={type} style={styles.cohortGroup}>
                <Text style={styles.cohortGroupTitle}>{type}</Text>
                {rows.slice(0, 5).map((c) => (
                  <View key={c.id} style={styles.cohortRow}>
                    <Text style={styles.cohortLabel}>{c.cohortLabel}</Text>
                    <Text style={styles.cohortMeta}>
                      {c.memberCount} mem - retention{" "}
                      {Math.round(c.retentionRate * 100)}% - xn{" "}
                      {c.avgXnscore.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {/* Recent logs (last 20 across all jobs) */}
        <Text style={styles.sectionTitle}>{t("ai_health.section_runs")}</Text>
        {logs.logs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{t("ai_health.empty_runs")}</Text>
          </View>
        ) : (
          logs.logs.map((l: CronJobLog) => (
            <View key={l.id} style={styles.logRow}>
              <Ionicons
                name={statusIcon(l.status)}
                size={14}
                color={statusColor(l.status)}
              />
              <Text style={styles.logJob}>{l.jobName}</Text>
              <Text style={styles.logTime}>{fmtTime(l.createdAt)}</Text>
              <Text style={styles.logMs}>{fmtMs(l.executionTimeMs)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.navy,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: { padding: 8, minWidth: 40, minHeight: 40 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { flex: 1 },

  overviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  overviewLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  overviewRow: { flexDirection: "row", gap: 12 },
  overviewStat: { flex: 1, alignItems: "center" },
  overviewValue: { fontSize: 22, fontWeight: "700", color: COLORS.navy },
  overviewSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.navy,
    letterSpacing: 0.4,
    marginTop: 8,
    marginBottom: 8,
  },

  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  jobHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  jobName: { fontSize: 13, fontWeight: "700", color: COLORS.navy, flex: 1 },
  jobMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  jobMetric: { minWidth: 80 },
  metricLabel: {
    fontSize: 10,
    color: COLORS.muted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricValue: { fontSize: 13, color: COLORS.navy, fontWeight: "600", marginTop: 2 },
  jobAlert: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.red,
    fontWeight: "600",
  },

  modelCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  modelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 12 },
  modelCell: { minWidth: 70 },
  modelBig: { fontSize: 18, fontWeight: "700", color: COLORS.navy, marginTop: 2 },
  modelTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  trendValue: { fontSize: 13, fontWeight: "700" },
  driftBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  driftText: { fontSize: 11, fontWeight: "700" },

  cohortSummary: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
    marginBottom: 12,
  },
  cohortStat: { flex: 1, alignItems: "center" },
  cohortBig: { fontSize: 18, fontWeight: "700", color: COLORS.navy, marginTop: 2 },
  cohortGroup: { marginBottom: 12 },
  cohortGroupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  cohortRow: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cohortLabel: { fontSize: 13, fontWeight: "700", color: COLORS.navy },
  cohortMeta: { fontSize: 11, color: COLORS.muted },

  logRow: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logJob: { fontSize: 12, color: COLORS.navy, fontWeight: "600", flex: 1 },
  logTime: { fontSize: 11, color: COLORS.muted },
  logMs: {
    fontSize: 11,
    color: COLORS.muted,
    fontFamily: "monospace",
    minWidth: 50,
    textAlign: "right",
  },

  deniedBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  deniedTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.navy,
    marginTop: 8,
  },
  deniedBody: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },
  deniedError: {
    fontSize: 11,
    color: COLORS.red,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: 4,
  },
  deniedBtn: {
    marginTop: 16,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  deniedBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },

  loadingBox: { paddingVertical: 32, alignItems: "center" },
  emptyBox: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.muted, fontSize: 13 },
  muted: { color: COLORS.muted, fontSize: 12 },
});
