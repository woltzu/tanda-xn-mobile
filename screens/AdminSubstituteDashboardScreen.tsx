// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminSubstituteDashboardScreen.tsx — mig 386 Phase 1
// ═══════════════════════════════════════════════════════════════════════════
//
// Admin visibility surface for the substitute matching system. Read-only —
// action RPCs (reassign / cancel / force-match) are deferred to Phase 2
// until real traffic exists (all four substitute tables have 0 rows in
// prod today).
//
// Reads mig 386's get_admin_substitute_dashboard RPC. Four sections
// stacked vertically (mobile-first, matches AdminScoringDashboard /
// AdminPayoutConsole patterns):
//
//   1. Pool health strip — active / suspended / removed / freq_decliners /
//      avg reliability / lifetime substitutions.
//   2. Open at-risk events — substitute_needed_events WHERE status='open'.
//      Age hours + risk score.
//   3. Pending matches — substitution_records awaiting confirmation.
//      Hours-until-deadline countdown.
//   4. Risky matches — substitutes with zero history in the target circle.
//      Flags for admin review.
//
// Admin-gated via useIsAdmin. No modals in Phase 1 — every card is
// read-only.
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

interface AtRiskEvent {
  event_id: string;
  circle_id: string;
  circle_name: string | null;
  at_risk_user_id: string;
  at_risk_name: string | null;
  cycle_id: string | null;
  risk_score: number | null;
  reason: string | null;
  status: string;
  created_at: string;
  age_hours: number;
}

interface PendingMatch {
  record_id: string;
  circle_id: string;
  circle_name: string | null;
  exit_request_id: string | null;
  exiting_member_id: string | null;
  exiting_name: string | null;
  at_risk_user_id: string | null;
  at_risk_name: string | null;
  substitute_member_id: string;
  substitute_name: string | null;
  original_payout_position: number | null;
  payout_entitlement_transfer_cents: number | null;
  confirmation_deadline: string | null;
  auto_approved: boolean;
  status: string;
  created_at: string;
  hours_until_deadline: number;
}

interface PoolHealth {
  active_count: number;
  suspended_count: number;
  removed_count: number;
  frequent_decliners: number;
  avg_reliability: number | null;
  total_substitutions_lifetime: number;
}

interface RiskyMatch {
  record_id: string;
  circle_id: string;
  circle_name: string | null;
  substitute_member_id: string;
  substitute_name: string | null;
  exiting_member_id: string | null;
  at_risk_user_id: string | null;
  status: string;
  auto_approved: boolean;
  confirmation_deadline: string | null;
  created_at: string;
  in_pool: number;
  pool_reliability: number;
}

interface DashboardPayload {
  open_at_risk: AtRiskEvent[];
  pending_matches: PendingMatch[];
  pool_health: PoolHealth;
  risky_matches: RiskyMatch[];
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

function fmtHoursUntil(h: number): string {
  if (!Number.isFinite(h)) return "—";
  if (h < 1) {
    const mins = Math.max(0, Math.round(h * 60));
    return `${mins}m`;
  }
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

const RISK_STYLE = (score: number | null): { bg: string; fg: string; label: string } => {
  const s = score ?? 0;
  if (s >= 80) return { bg: colors.errorBg, fg: "#991B1B", label: `${s}` };
  if (s >= 50) return { bg: colors.warningBg, fg: colors.warningLabel, label: `${s}` };
  return { bg: "#E2E8F0", fg: "#475569", label: `${s}` };
};

export default function AdminSubstituteDashboardScreen() {
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
      const { data: res, error: err } = await supabase.rpc("get_admin_substitute_dashboard");
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
        <Text style={styles.headerTitle}>{t("admin.substitutes.title")}</Text>
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
          {/* Card 1 — Pool health strip */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="people-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>{t("admin.substitutes.pool_health_title")}</Text>
            </View>
            <View style={styles.statsGrid}>
              <StatCell label={t("admin.substitutes.stat_active")}       value={data.pool_health.active_count}       tone="success" />
              <StatCell label={t("admin.substitutes.stat_suspended")}    value={data.pool_health.suspended_count}    tone="warning" />
              <StatCell label={t("admin.substitutes.stat_removed")}      value={data.pool_health.removed_count}      tone="neutral" />
              <StatCell label={t("admin.substitutes.stat_frequent_decliners")} value={data.pool_health.frequent_decliners} tone="danger" />
              <StatCell
                label={t("admin.substitutes.stat_avg_reliability")}
                value={data.pool_health.avg_reliability !== null ? Number(data.pool_health.avg_reliability).toFixed(1) : "—"}
                tone="navy"
              />
              <StatCell label={t("admin.substitutes.stat_lifetime_subs")} value={data.pool_health.total_substitutions_lifetime} tone="navy" />
            </View>
          </View>

          {/* Card 2 — Open at-risk events */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.substitutes.at_risk_title", { count: data.open_at_risk.length })}
              </Text>
            </View>
            {data.open_at_risk.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.substitutes.at_risk_empty")}</Text>
            ) : (
              data.open_at_risk.map((e) => {
                const rs = RISK_STYLE(e.risk_score);
                return (
                  <View key={e.event_id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {e.at_risk_name ?? "—"}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: rs.bg }]}>
                          <Text style={[styles.badgeText, { color: rs.fg }]}>
                            {t("admin.substitutes.risk", { score: rs.label })}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {e.circle_name ?? "—"}
                        {" · "}
                        {t("admin.substitutes.age", { rel: fmtRelative(e.created_at) })}
                      </Text>
                      {e.reason ? (
                        <Text style={styles.rowReason} numberOfLines={2}>{e.reason}</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Card 3 — Pending matches (awaiting confirmation) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="hourglass-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.substitutes.pending_title", { count: data.pending_matches.length })}
              </Text>
            </View>
            {data.pending_matches.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.substitutes.pending_empty")}</Text>
            ) : (
              data.pending_matches.map((m) => {
                const hoursLeft = m.hours_until_deadline;
                const dlStyle: { bg: string; fg: string } =
                  hoursLeft < 6
                    ? { bg: colors.errorBg, fg: "#991B1B" }
                    : hoursLeft < 24
                    ? { bg: colors.warningBg, fg: colors.warningLabel }
                    : { bg: "#D1FAE5", fg: colors.successLabel };
                return (
                  <View key={m.record_id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {m.substitute_name ?? "—"}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: dlStyle.bg }]}>
                          <Text style={[styles.badgeText, { color: dlStyle.fg }]}>
                            {t("admin.substitutes.deadline_in", { dur: fmtHoursUntil(hoursLeft) })}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {m.circle_name ?? "—"}
                        {" · "}
                        {t("admin.substitutes.substituting_for", {
                          name: m.exiting_name ?? m.at_risk_name ?? "—",
                        })}
                      </Text>
                      <Text style={styles.rowSub}>
                        {m.auto_approved
                          ? t("admin.substitutes.auto_approved")
                          : t("admin.substitutes.manual_approval")}
                        {m.original_payout_position != null
                          ? ` · ${t("admin.substitutes.payout_position", { pos: m.original_payout_position })}`
                          : ""}
                        {m.payout_entitlement_transfer_cents
                          ? ` · $${(m.payout_entitlement_transfer_cents / 100).toFixed(2)}`
                          : ""}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Card 4 — Risky matches (no history in circle) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="warning-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.substitutes.risky_title", { count: data.risky_matches.length })}
              </Text>
            </View>
            <Text style={styles.cardSubtitle}>{t("admin.substitutes.risky_subtitle")}</Text>
            {data.risky_matches.length === 0 ? (
              <Text style={styles.emptyText}>{t("admin.substitutes.risky_empty")}</Text>
            ) : (
              data.risky_matches.map((r) => (
                <View key={r.record_id} style={[styles.row, styles.rowRisky]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {r.substitute_name ?? "—"}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: colors.errorBg }]}>
                        <Ionicons name="alert-circle" size={11} color="#991B1B" />
                        <Text style={[styles.badgeText, { color: "#991B1B", marginLeft: 3 }]}>
                          {t("admin.substitutes.no_history_tag")}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {r.circle_name ?? "—"}
                      {" · "}
                      {fmtRelative(r.created_at)}
                    </Text>
                    <Text style={styles.rowSub}>
                      {r.in_pool > 0
                        ? t("admin.substitutes.in_pool_reliability", {
                            score: Number(r.pool_reliability).toFixed(1),
                          })
                        : t("admin.substitutes.not_in_pool")}
                      {" · "}
                      {r.auto_approved
                        ? t("admin.substitutes.auto_approved")
                        : t("admin.substitutes.manual_approval")}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Meta */}
          <Text style={styles.generatedAt}>
            {t("admin.substitutes.generated_at", { rel: fmtRelative(data.generated_at) })}
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "navy" | "success" | "warning" | "danger" | "neutral";
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
    <View style={[styles.statCell, { backgroundColor: s.bg }]}>
      <Text style={[styles.statValue, { color: s.fg }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: s.fg }]} numberOfLines={2}>{label}</Text>
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

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    flexBasis: "31%",
    flexGrow: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 68,
  },
  statValue: { fontSize: 20, fontWeight: "800" },
  statLabel: { fontSize: 9, fontWeight: "700", textAlign: "center", marginTop: 3 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  rowRisky: { backgroundColor: colors.errorBg, marginHorizontal: -4, paddingHorizontal: 8, borderRadius: 6 },
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
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  emptyText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
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
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    padding: 8,
  },
});
