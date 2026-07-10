// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminLiquidityAdvancesScreen.tsx — admin queue for liquidity advances
// ═══════════════════════════════════════════════════════════════════════════
//
// Lists liquidity_advances rows for admin triage. Status filter chips at
// the top (requested / approved / disbursed / all). Inline action buttons:
//   * requested → Approve (calls process_advance_request RPC with '30_day'
//                 tier; RPC re-checks eligibility and auto-rejects on fail)
//                 + Reject (direct UPDATE to status='rejected').
//   * approved  → Disburse (invokes disburse-liquidity-advance EF, gated
//                 by feature_gates.lending_enabled).
//   * disbursed / rejected / ... → terminal, no actions.
//
// Scoping: super_admin / admin only. The advance pool isn't community-
// scoped, so support admins don't see this queue.
//
// Note on the approve tier: this v1 hard-codes '30_day' for simplicity.
// 60_day flow exists at the RPC layer but the UI doesn't surface a tier
// picker yet — a future iteration can add a long-press menu.
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
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useIsAdmin } from "../hooks/useIsAdmin";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = colors.textSecondary;

interface AdvanceRow {
  id: string;
  member_id: string;
  circle_id: string;
  requested_amount_cents: number;
  approved_amount_cents: number | null;
  expected_payout_cents: number;
  fee_amount_cents: number | null;
  fee_pct: number | null;
  status: string;
  created_at: string | null;
  rejection_reason: string | null;
  // Joined
  member_full_name: string | null;
  member_email: string | null;
  circle_name: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  requested:  { bg: colors.warningBg, fg: colors.warningLabel },
  approved:   { bg: "#DBEAFE", fg: "#1E40AF" },
  disbursed:  { bg: "#D1FAE5", fg: colors.successLabel },
  repaying:   { bg: "#E0E7FF", fg: "#3730A3" },
  repaid:     { bg: "#D1FAE5", fg: colors.successLabel },
  rejected:   { bg: colors.errorBg, fg: "#991B1B" },
  cancelled:  { bg: colors.border, fg: "#374151" },
  defaulted:  { bg: colors.errorBg, fg: "#7F1D1D" },
  queued:     { bg: "#F3E8FF", fg: "#6B21A8" },
};

type StatusFilter = "requested" | "approved" | "disbursed" | "all";

export default function AdminLiquidityAdvancesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [rows, setRows] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("requested");
  const [rowActionId, setRowActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      let query = supabase
        .from("liquidity_advances")
        .select(
          "id, member_id, circle_id, requested_amount_cents, approved_amount_cents, expected_payout_cents, fee_amount_cents, fee_pct, status, created_at, rejection_reason, profiles:member_id(full_name, email), circles:circle_id(name)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      const { data, error: qErr } = await query;
      if (qErr) throw qErr;
      setRows(
        (data ?? []).map((r: any) => ({
          id: r.id,
          member_id: r.member_id,
          circle_id: r.circle_id,
          requested_amount_cents: Number(r.requested_amount_cents) || 0,
          approved_amount_cents:
            r.approved_amount_cents == null ? null : Number(r.approved_amount_cents),
          expected_payout_cents: Number(r.expected_payout_cents) || 0,
          fee_amount_cents:
            r.fee_amount_cents == null ? null : Number(r.fee_amount_cents),
          fee_pct: r.fee_pct == null ? null : Number(r.fee_pct),
          status: r.status,
          created_at: r.created_at,
          rejection_reason: r.rejection_reason,
          member_full_name: r.profiles?.full_name ?? null,
          member_email: r.profiles?.email ?? null,
          circle_name: r.circles?.name ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminLiquidityAdvances] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = useCallback(
    async (id: string) => {
      setRowActionId(id);
      try {
        const { data, error } = await supabase.rpc("process_advance_request", {
          p_advance_id: id,
          p_repayment_tier: "30_day",
        });
        if (error) throw error;
        const decision = (data as { decision?: string } | null)?.decision;
        if (decision === "rejected") {
          // RPC may auto-reject if eligibility check fails at approval time.
          showToast(
            t("admin_liquidity_advances.auto_rejected", {
              reason: (data as any)?.reason_text ?? "ineligible",
            }),
            "info",
          );
        } else {
          showToast(t("admin_liquidity_advances.approve_success"), "success");
        }
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t("admin_liquidity_advances.approve_failed", { detail: msg }),
          "error",
        );
      } finally {
        setRowActionId(null);
      }
    },
    [load, t],
  );

  const handleReject = useCallback(
    async (id: string) => {
      setRowActionId(id);
      try {
        const { error } = await supabase
          .from("liquidity_advances")
          .update({
            status: "rejected",
            rejection_reason: "Rejected by admin",
          })
          .eq("id", id)
          .eq("status", "requested");
        if (error) throw error;
        showToast(t("admin_liquidity_advances.reject_success"), "success");
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t("admin_liquidity_advances.reject_failed", { detail: msg }),
          "error",
        );
      } finally {
        setRowActionId(null);
      }
    },
    [load, t],
  );

  const handleDisburse = useCallback(
    async (id: string) => {
      setRowActionId(id);
      try {
        const { data, error } = await supabase.functions.invoke(
          "disburse-liquidity-advance",
          { body: { advance_id: id } },
        );
        if (error) {
          // FunctionsHttpError surfaces a 403 from the EF as a context error.
          // We surface the EF's reason when available.
          const reason = (data as any)?.reason ?? (error as any)?.message ?? "";
          if (reason === "lending_disabled") {
            showToast(
              t("admin_liquidity_advances.lending_disabled"),
              "error",
            );
          } else {
            showToast(
              t("admin_liquidity_advances.disburse_failed", { detail: String(reason) }),
              "error",
            );
          }
          return;
        }
        showToast(t("admin_liquidity_advances.disburse_success"), "success");
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showToast(
          t("admin_liquidity_advances.disburse_failed", { detail: msg }),
          "error",
        );
      } finally {
        setRowActionId(null);
      }
    },
    [load, t],
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filterOptions = useMemo(
    () =>
      [
        { value: "requested", label: t("admin_liquidity_advances.filter_requested") },
        { value: "approved",  label: t("admin_liquidity_advances.filter_approved") },
        { value: "disbursed", label: t("admin_liquidity_advances.filter_disbursed") },
        { value: "all",       label: t("admin_liquidity_advances.filter_all") },
      ] as Array<{ value: StatusFilter; label: string }>,
    [t],
  );

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

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#CBD5E1" />
          <Text style={styles.mutedText}>{t("admin.not_authorized")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fmtUSDFromCents = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin_liquidity_advances.title")}</Text>
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.filterRow}>
        <AdminFilterChips
          options={filterOptions}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
      </View>

      {loading && !rows.length ? (
        <AdminListSkeleton rowCount={4} />
      ) : error ? (
        <AdminErrorState onRetry={load} />
      ) : (
        <AppFlashList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          estimatedItemSize={80}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
          }
          ListEmptyComponent={
            <View style={styles.emptyFrame}>
              <Ionicons name="cash-outline" size={40} color="#CBD5E1" />
              <Text style={styles.mutedText}>
                {t("admin_liquidity_advances.empty")}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const statusColors = STATUS_COLORS[item.status] ?? STATUS_COLORS.requested;
            const isBusy = rowActionId === item.id;
            const dateStr = item.created_at
              ? new Date(item.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "—";
            const memberLabel =
              item.member_full_name ?? item.member_email ?? item.member_id.slice(0, 8);
            const feeCents =
              item.fee_amount_cents ??
              (item.fee_pct != null
                ? Math.round((item.requested_amount_cents * item.fee_pct) / 100)
                : 0);

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {memberLabel}
                  </Text>
                  <View
                    style={[styles.statusChip, { backgroundColor: statusColors.bg }]}
                  >
                    <Text style={[styles.statusChipText, { color: statusColors.fg }]}>
                      {t(`admin_liquidity_advances.status_${item.status}`, item.status)}
                    </Text>
                  </View>
                </View>

                {item.circle_name ? (
                  <Text style={styles.subline} numberOfLines={1}>
                    {item.circle_name}
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>
                      {t("admin_liquidity_advances.amount")}
                    </Text>
                    <Text style={styles.metaValue}>
                      {fmtUSDFromCents(item.requested_amount_cents)}
                    </Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>
                      {t("admin_liquidity_advances.payout")}
                    </Text>
                    <Text style={styles.metaValue}>
                      {fmtUSDFromCents(item.expected_payout_cents)}
                    </Text>
                  </View>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>
                      {t("admin_liquidity_advances.fee")}
                    </Text>
                    <Text style={styles.metaValue}>
                      {fmtUSDFromCents(feeCents)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.dateLine}>
                  {t("admin_liquidity_advances.date")}: {dateStr}
                </Text>

                {item.rejection_reason ? (
                  <Text style={styles.rejectionReason} numberOfLines={3}>
                    {t("admin_liquidity_advances.rejection_reason")}: {item.rejection_reason}
                  </Text>
                ) : null}

                {item.status === "requested" ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.approveBtn, isBusy && styles.actionBtnBusy]}
                      onPress={() => handleApprove(item.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.cardBg} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color={colors.cardBg} />
                          <Text style={styles.actionBtnText}>
                            {t("admin_liquidity_advances.approve")}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.rejectBtn, isBusy && styles.actionBtnBusy]}
                      onPress={() => handleReject(item.id)}
                      disabled={isBusy}
                    >
                      <Ionicons name="close" size={16} color="#991B1B" />
                      <Text style={[styles.actionBtnText, { color: "#991B1B" }]}>
                        {t("admin_liquidity_advances.reject")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : item.status === "approved" ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.disburseBtn, isBusy && styles.actionBtnBusy]}
                      onPress={() => handleDisburse(item.id)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={colors.cardBg} />
                      ) : (
                        <>
                          <Ionicons name="send" size={16} color={colors.cardBg} />
                          <Text style={styles.actionBtnText}>
                            {t("admin_liquidity_advances.disburse")}
                          </Text>
                        </>
                      )}
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
  safeArea: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: typography.sectionHeader,
    fontWeight: typography.bold,
    color: NAVY,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listContent: { padding: spacing.lg, paddingBottom: 40 },
  emptyFrame: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },

  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  memberName: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: typography.bold,
    color: NAVY,
  },
  subline: { fontSize: typography.label, color: MUTED },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: typography.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: 4,
  },
  metaCell: { flex: 1 },
  metaLabel: {
    fontSize: 11,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: typography.body,
    color: NAVY,
    fontWeight: typography.bold,
    marginTop: 2,
  },
  dateLine: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  rejectionReason: {
    fontSize: typography.label,
    color: "#991B1B",
    fontStyle: "italic",
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnBusy: { opacity: 0.6 },
  approveBtn: { backgroundColor: TEAL },
  rejectBtn: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  disburseBtn: { backgroundColor: NAVY },
  actionBtnText: {
    fontSize: typography.label,
    fontWeight: typography.bold,
    color: colors.cardBg,
  },
});
