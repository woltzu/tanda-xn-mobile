// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminNotificationHealthScreen.tsx — mig 392
// ═══════════════════════════════════════════════════════════════════════════
//
// Visibility-only dashboard for the notification delivery pipeline.
// Reads get_notification_health_dashboard() (admin-only RPC) and shows:
//   1. Push tokens summary (total / active / stale >30d + platform breakdown)
//   2. Notifications volume (24h / 7d / 30d + push_sent coverage + read rate)
//   3. Top notification types (last 30d)
//   4. Preferences opt-out counts (master toggles + marketing per-channel)
//   5. Recent 20 notifications (audit log)
//
// Deliberately does not attempt to show Resend delivery / bounce data
// (no live email pipeline yet) or notification_queue delivery status
// (table is empty because EFs write directly to `notifications`).
// Extend the RPC + this screen when those become real, don't build a
// separate surface.
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

interface PushTokensSummary {
  total: number;
  active: number;
  inactive: number;
  stale_30d: number;
  by_platform: Record<string, number>;
}

interface NotificationsSummary {
  total: number;
  last_24h: number;
  last_7d: number;
  last_30d: number;
  push_sent_last_7d: number;
  read_last_7d: number;
}

interface ByTypeRow {
  type: string;
  count: number;
}

interface PreferencesSummary {
  total_users: number;
  push_disabled: number;
  email_disabled: number;
  sms_disabled: number;
  quiet_hours_on: number;
  push_snoozed: number;
  marketing_push_off: number;
  marketing_email_off: number;
}

interface RecentRow {
  id: string;
  type: string;
  title: string | null;
  user_id: string;
  user_name: string | null;
  channel_used: string | null;
  push_sent_at: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

interface Payload {
  generated_at: string;
  push_tokens: PushTokensSummary;
  notifications: NotificationsSummary;
  by_type: ByTypeRow[];
  preferences: PreferencesSummary;
  recent: RecentRow[];
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

function pct(numerator: number, denominator: number): string {
  if (!denominator) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function AdminNotificationHealthScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.rpc(
        "get_notification_health_dashboard",
      );
      if (err) throw new Error(err.message);
      setData(res as Payload);
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
        <Text style={styles.headerTitle}>
          {t("admin.notification_health.title")}
        </Text>
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentTeal}
            />
          }
        >
          {/* Notifications volume */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="paper-plane-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.notification_health.volume_title")}
              </Text>
            </View>
            <View style={styles.countsStrip}>
              <CountCell
                label={t("admin.notification_health.count_24h")}
                value={data.notifications.last_24h}
                tone="navy"
              />
              <CountCell
                label={t("admin.notification_health.count_7d")}
                value={data.notifications.last_7d}
                tone="navy"
              />
              <CountCell
                label={t("admin.notification_health.count_30d")}
                value={data.notifications.last_30d}
                tone="navy"
              />
              <CountCell
                label={t("admin.notification_health.count_total")}
                value={data.notifications.total}
                tone="neutral"
              />
            </View>
            <Text style={styles.subLine}>
              {t("admin.notification_health.push_coverage", {
                pct: pct(
                  data.notifications.push_sent_last_7d,
                  data.notifications.last_7d,
                ),
                sent: data.notifications.push_sent_last_7d,
                total: data.notifications.last_7d,
              })}
            </Text>
            <Text style={styles.subLine}>
              {t("admin.notification_health.read_rate", {
                pct: pct(
                  data.notifications.read_last_7d,
                  data.notifications.last_7d,
                ),
                read: data.notifications.read_last_7d,
                total: data.notifications.last_7d,
              })}
            </Text>
          </View>

          {/* Push tokens */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="phone-portrait-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.notification_health.tokens_title")}
              </Text>
            </View>
            <View style={styles.countsStrip}>
              <CountCell
                label={t("admin.notification_health.tokens_active")}
                value={data.push_tokens.active}
                tone={data.push_tokens.active > 0 ? "success" : "neutral"}
              />
              <CountCell
                label={t("admin.notification_health.tokens_inactive")}
                value={data.push_tokens.inactive}
                tone="neutral"
              />
              <CountCell
                label={t("admin.notification_health.tokens_stale")}
                value={data.push_tokens.stale_30d}
                tone={data.push_tokens.stale_30d > 0 ? "warning" : "neutral"}
              />
              <CountCell
                label={t("admin.notification_health.tokens_total")}
                value={data.push_tokens.total}
                tone="neutral"
              />
            </View>
            <Text style={styles.sectionLabel}>
              {t("admin.notification_health.tokens_by_platform")}
            </Text>
            {Object.keys(data.push_tokens.by_platform ?? {}).length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.notification_health.tokens_by_platform_empty")}
              </Text>
            ) : (
              Object.entries(data.push_tokens.by_platform).map(([p, n]) => (
                <View key={p} style={styles.kvRow}>
                  <Text style={styles.kvKey}>{p}</Text>
                  <Text style={styles.kvVal}>{String(n)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Top types */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="pricetag-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.notification_health.by_type_title")}
              </Text>
            </View>
            {data.by_type.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.notification_health.by_type_empty")}
              </Text>
            ) : (
              data.by_type.map((r) => (
                <View key={r.type} style={styles.kvRow}>
                  <Text style={styles.kvKey} numberOfLines={1}>
                    {r.type}
                  </Text>
                  <Text style={styles.kvVal}>{r.count}</Text>
                </View>
              ))
            )}
          </View>

          {/* Preferences opt-outs */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="options-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.notification_health.prefs_title", {
                  count: data.preferences.total_users,
                })}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_push_off")}
              </Text>
              <Text style={styles.kvVal}>{data.preferences.push_disabled}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_email_off")}
              </Text>
              <Text style={styles.kvVal}>{data.preferences.email_disabled}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_sms_off")}
              </Text>
              <Text style={styles.kvVal}>{data.preferences.sms_disabled}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_quiet_hours")}
              </Text>
              <Text style={styles.kvVal}>{data.preferences.quiet_hours_on}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_snoozed")}
              </Text>
              <Text style={styles.kvVal}>{data.preferences.push_snoozed}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_marketing_push_off")}
              </Text>
              <Text style={styles.kvVal}>
                {data.preferences.marketing_push_off}
              </Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>
                {t("admin.notification_health.prefs_marketing_email_off")}
              </Text>
              <Text style={styles.kvVal}>
                {data.preferences.marketing_email_off}
              </Text>
            </View>
          </View>

          {/* Recent audit log */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="list-outline" size={16} color={colors.primaryNavy} />
              <Text style={styles.cardTitle}>
                {t("admin.notification_health.recent_title", {
                  count: data.recent.length,
                })}
              </Text>
            </View>
            {data.recent.length === 0 ? (
              <Text style={styles.emptyText}>
                {t("admin.notification_health.recent_empty")}
              </Text>
            ) : (
              data.recent.map((r) => (
                <View key={r.id} style={styles.recentRow}>
                  <View style={styles.recentHeader}>
                    <Text style={styles.recentType} numberOfLines={1}>
                      {r.type}
                    </Text>
                    <Text style={styles.recentTime}>
                      {fmtRelative(r.created_at)}
                    </Text>
                  </View>
                  {r.title ? (
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                  ) : null}
                  <Text style={styles.recentMeta} numberOfLines={1}>
                    {r.user_name ?? r.user_id.slice(0, 8) + "…"}
                    {" · "}
                    {r.push_sent_at
                      ? t("admin.notification_health.recent_pushed", {
                          rel: fmtRelative(r.push_sent_at),
                        })
                      : t("admin.notification_health.recent_no_push")}
                    {" · "}
                    {r.read
                      ? t("admin.notification_health.recent_read")
                      : t("admin.notification_health.recent_unread")}
                  </Text>
                </View>
              ))
            )}
          </View>

          <Text style={styles.generatedAt}>
            {t("admin.notification_health.generated_at", {
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
  scroll: { padding: 12 },

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

  subLine: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
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
  kvKey: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
  },
  kvVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryNavy,
    marginLeft: 12,
  },

  recentRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 2,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentType: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryNavy,
  },
  recentTime: { fontSize: 11, color: colors.textSecondary },
  recentTitle: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  recentMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
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
  generatedAt: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    padding: 8,
  },
});
