// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminCircleJoinLogScreen.tsx — admin audit surface for circle joins
// ═══════════════════════════════════════════════════════════════════════════
//
// Reads mig 374's circle_membership_events. Four filter chips:
//   * pending    — status='pending_approval' (actionable — approve / reject)
//   * all        — every event, most recent first
//   * suspicious — suspicious_flag=TRUE
//   * leave      — event_type='leave' (empty until a leave RPC lands)
//
// Route param `circleId?: string` scopes the list to a single circle when
// the caller came from CircleDetail's admin sub-card.
//
// Actions call mig 375's approve_circle_join / reject_circle_join RPCs.
// Both are SECURITY DEFINER gated on admin_users; UI-side gate uses
// useIsAdmin so non-admins can't reach the screen.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { showToast } from "../components/Toast";

type Filter = "pending" | "all" | "suspicious" | "leave";
const FILTERS: Filter[] = ["pending", "all", "suspicious", "leave"];

interface Row {
  id: string;
  circle_id: string;
  user_id: string;
  event_type: string;
  method: string;
  status: string;
  joined_at: string | null;
  left_at: string | null;
  left_reason: string | null;
  left_cycle_number: number | null;
  left_amount_in_flight_cents: number | null;
  suspicious_flag: boolean;
  suspicious_reason: string | null;
  admin_note: string | null;
  circle_name: string | null;
  member_name: string | null;
  member_email: string | null;
}

type RouteParams = { circleId?: string };

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

function methodLabel(m: string): string {
  switch (m) {
    case "quick_join":
      return "QuickJoin";
    case "invite_code":
      return "Invite code";
    case "magic_link":
      return "Magic link";
    case "admin_manual":
      return "Admin/creator";
    case "approval_gate":
      return "Approval gate";
    case "backfill":
      return "Backfill";
    default:
      return m;
  }
}

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  pending_approval: { bg: colors.warningBg, fg: colors.warningLabel, label: "pending" },
  active:           { bg: "#D1FAE5",         fg: colors.successLabel, label: "active"  },
  rejected:         { bg: colors.errorBg,    fg: "#991B1B",           label: "rejected"},
  left:             { bg: "#E2E8F0",         fg: "#475569",           label: "left"    },
};

export default function AdminCircleJoinLogScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<Record<string, RouteParams>, string>>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const scopedCircleId = route.params?.circleId ?? undefined;

  const [filter, setFilter] = useState<Filter>(scopedCircleId ? "all" : "pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from("circle_membership_events")
        .select(
          "id, circle_id, user_id, event_type, method, status, joined_at, left_at, " +
            "left_reason, left_cycle_number, left_amount_in_flight_cents, " +
            "suspicious_flag, suspicious_reason, admin_note, " +
            "circles:circle_id(name), profiles:user_id(full_name, email)",
        )
        .order("joined_at", { ascending: false, nullsFirst: false })
        .limit(200);

      if (scopedCircleId) q = q.eq("circle_id", scopedCircleId);

      switch (filter) {
        case "pending":
          q = q.eq("status", "pending_approval");
          break;
        case "suspicious":
          q = q.eq("suspicious_flag", true);
          break;
        case "leave":
          q = q.eq("event_type", "leave");
          break;
        // "all" → no additional filter
      }

      const { data, error: err } = await q;
      if (err) throw new Error(err.message);
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        circle_id: r.circle_id,
        user_id: r.user_id,
        event_type: r.event_type,
        method: r.method,
        status: r.status,
        joined_at: r.joined_at,
        left_at: r.left_at,
        left_reason: r.left_reason,
        left_cycle_number: r.left_cycle_number,
        left_amount_in_flight_cents: r.left_amount_in_flight_cents,
        suspicious_flag: !!r.suspicious_flag,
        suspicious_reason: r.suspicious_reason,
        admin_note: r.admin_note,
        circle_name: r.circles?.name ?? null,
        member_name: r.profiles?.full_name ?? null,
        member_email: r.profiles?.email ?? null,
      }));
      setRows(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [filter, scopedCircleId]);

  useEffect(() => {
    if (!adminLoading && isAdmin) load();
  }, [adminLoading, isAdmin, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const doApprove = async (row: Row) => {
    setActingOn(row.id);
    try {
      const { data, error: err } = await supabase.rpc("approve_circle_join", {
        p_event_id: row.id,
        p_admin_note: null,
      });
      if (err) throw new Error(err.message);
      if (!(data as any)?.success) {
        throw new Error("approval_failed");
      }
      showToast(t("admin.join_log.approved_toast"), "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setActingOn(null);
    }
  };

  const doReject = (row: Row) => {
    Alert.alert(
      t("admin.join_log.reject_confirm_title"),
      t("admin.join_log.reject_confirm_body", { name: row.member_name ?? row.member_email ?? "" }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.join_log.reject_btn"),
          style: "destructive",
          onPress: async () => {
            setActingOn(row.id);
            try {
              const { data, error: err } = await supabase.rpc("reject_circle_join", {
                p_event_id: row.id,
                p_admin_note: null,
              });
              if (err) throw new Error(err.message);
              if (!(data as any)?.success) throw new Error("rejection_failed");
              showToast(t("admin.join_log.rejected_toast"), "info");
              await load();
            } catch (err) {
              showToast(err instanceof Error ? err.message : String(err), "error");
            } finally {
              setActingOn(null);
            }
          },
        },
      ],
    );
  };

  const pendingCount = useMemo(
    () => (filter === "pending" ? rows.length : 0),
    [filter, rows.length],
  );

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
          {t("admin.join_log.title")}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      {scopedCircleId ? (
        <View style={styles.scopeBanner}>
          <Ionicons name="funnel-outline" size={14} color={colors.warningLabel} />
          <Text style={styles.scopeBannerText}>
            {t("admin.join_log.scoped_to_circle")}
          </Text>
        </View>
      ) : null}

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
                {t(`admin.join_log.filter_${f}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && rows.length === 0 ? (
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
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentTeal}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="checkmark-done-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyText}>
                {t(`admin.join_log.empty_${filter}`)}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.active;
            const isActing = actingOn === item.id;
            const canAct = item.status === "pending_approval";
            return (
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.member_name ?? item.member_email ?? "(no name)"}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.fg }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowCircle} numberOfLines={1}>
                    {item.circle_name ?? item.circle_id.slice(0, 8)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {item.event_type === "leave"
                      ? `${t("admin.join_log.left")} · ${fmtRelative(item.left_at ?? item.joined_at)}`
                      : `${methodLabel(item.method)} · ${fmtRelative(item.joined_at)}`}
                  </Text>
                  {item.suspicious_flag ? (
                    <View style={styles.suspiciousRow}>
                      <Ionicons name="alert-circle" size={12} color={colors.errorText} />
                      <Text style={styles.suspiciousText}>
                        {item.suspicious_reason ?? "suspicious"}
                      </Text>
                    </View>
                  ) : null}
                  {item.admin_note ? (
                    <Text style={styles.adminNote} numberOfLines={2}>
                      {t("admin.join_log.admin_note_prefix")}: {item.admin_note}
                    </Text>
                  ) : null}
                </View>
                {canAct ? (
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn, isActing && styles.actionBtnDisabled]}
                      onPress={() => doApprove(item)}
                      disabled={isActing}
                      accessibilityRole="button"
                    >
                      {isActing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          <Text style={styles.actionApproveText}>
                            {t("admin.join_log.approve_btn")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn, isActing && styles.actionBtnDisabled]}
                      onPress={() => doReject(item)}
                      disabled={isActing}
                      accessibilityRole="button"
                    >
                      <Ionicons name="close" size={14} color="#991B1B" />
                      <Text style={styles.actionRejectText}>
                        {t("admin.join_log.reject_btn")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
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
  scopeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.warningBg,
    borderBottomWidth: 1,
    borderBottomColor: "#FCD34D",
  },
  scopeBannerText: { fontSize: 12, color: colors.warningLabel, fontWeight: "600" },
  filtersWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBg,
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
  listContent: { padding: 12 },
  row: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  rowMain: { gap: 3 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  rowName: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  rowCircle: { fontSize: 12, color: colors.textPrimary, fontWeight: "500" },
  rowMeta: { fontSize: 12, color: colors.textSecondary },
  suspiciousRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  suspiciousText: { fontSize: 11, color: colors.errorText, fontWeight: "600" },
  adminNote: { fontSize: 11, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" },
  rowActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtn: { backgroundColor: colors.primaryNavy },
  rejectBtn: { backgroundColor: colors.errorBg, borderWidth: 1, borderColor: "#FCA5A5" },
  actionBtnDisabled: { opacity: 0.6 },
  actionApproveText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  actionRejectText: { color: "#991B1B", fontSize: 13, fontWeight: "700" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  emptyText: { marginTop: 12, color: colors.textSecondary, textAlign: "center" },
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
