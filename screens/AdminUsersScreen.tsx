// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminUsersScreen.tsx — admin users list (Bucket B mod 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name/email search. support-role admins see only members of their
// community (via community_memberships join). Tap → AdminUserDetail.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { AppFlashList } from "../components/AppFlashList";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useAdminScope } from "../hooks/useAdminScope";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";
import BulkActionBar from "../components/BulkActionBar";
import BulkReasonModal from "../components/BulkReasonModal";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = colors.textSecondary;

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  kyc_status: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export default function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kycFilter, setKycFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingBulk, setPendingBulk] = useState<"suspend" | "reactivate" | null>(
    null,
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    // Block load while scope is still resolving — otherwise we'd fire an
    // unscoped query and a scoped one back-to-back.
    if (scope.loading) return;
    // Misconfigured support admin (role=support, no community_id): refuse
    // to load anything. The screen renders an empty-state banner instead.
    if (scope.noCommunityAssigned) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = supabase
        .from("profiles")
        .select("id, full_name, email, kyc_status, role, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (scope.scopedUserIds) q.in("id", scope.scopedUserIds);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows((data ?? []) as UserRow[]);
    } catch (err) {
      console.warn("[AdminUsers] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, scope.loading, scope.noCommunityAssigned, scope.scopedUserIds]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const inName = (r.full_name ?? "").toLowerCase().includes(q);
        const inEmail = (r.email ?? "").toLowerCase().includes(q);
        if (!inName && !inEmail) return false;
      }
      if (kycFilter && (r.kyc_status ?? "none") !== kycFilter) return false;
      if (statusFilter === "active" && r.is_active === false) return false;
      if (statusFilter === "suspended" && r.is_active !== false) return false;
      if (roleFilter && (r.role ?? "member") !== roleFilter) return false;
      return true;
    });
  }, [rows, query, kycFilter, statusFilter, roleFilter]);

  // Role options come from the loaded rows so we don't hardcode the long
  // tail of elder/tier roles. Sorted for deterministic ordering.
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.role) set.add(r.role);
    });
    return Array.from(set)
      .sort()
      .map((value) => ({ value, label: value }));
  }, [rows]);

  const hasActiveFilters =
    !!query || !!kycFilter || !!statusFilter || !!roleFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setKycFilter(null);
    setStatusFilter(null);
    setRoleFilter(null);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((r) => r.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Restrict the suspend / reactivate buttons to homogenous selections so
  // the operation makes sense — mixing both states would either no-op
  // half the rows or do the wrong thing.
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const allActive =
    selectedRows.length > 0 && selectedRows.every((r) => r.is_active !== false);
  const allSuspended =
    selectedRows.length > 0 && selectedRows.every((r) => r.is_active === false);

  const runBulk = useCallback(
    async (kind: "suspend" | "reactivate", reason: string) => {
      if (selectedRows.length === 0) {
        showToast(t("admin_bulk.bulk_requires_selection"), "error");
        return;
      }
      setBulkBusy(true);
      // suspend_user requires a non-null reason; default to a generic
      // string if the operator left the textbox empty.
      const effectiveReason =
        reason ||
        (kind === "suspend"
          ? "Bulk suspend via admin hub"
          : "Bulk reactivate via admin hub");
      const rpcName = kind === "suspend" ? "suspend_user" : "reactivate_user";
      try {
        const results = await Promise.allSettled(
          selectedRows.map((r) =>
            supabase.rpc(rpcName, {
              p_user_id: r.id,
              p_reason: effectiveReason,
            }),
          ),
        );
        const failed = results.filter(
          (x) =>
            x.status === "rejected" ||
            (x.status === "fulfilled" && (x as any).value?.error),
        ).length;
        const ok = selectedRows.length - failed;
        const actionLabel =
          kind === "suspend"
            ? t("admin_bulk.bulk_suspend")
            : t("admin_bulk.bulk_reactivate");
        if (ok > 0) {
          showToast(
            t("admin_bulk.bulk_success", { action: actionLabel, count: ok }),
            "success",
          );
        }
        if (failed > 0) {
          showToast(
            t("admin_bulk.bulk_partial_failure", { count: failed }),
            "error",
          );
        }
        clearSelection();
        setPendingBulk(null);
        load();
      } catch (err: any) {
        showToast(err?.message ?? "Bulk action failed", "error");
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedRows, t, clearSelection, load],
  );

  if (adminLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.screenBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={NAVY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.users.title")}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={selectedIds.size > 0 ? clearSelection : selectAllFiltered}
            style={styles.headerTextBtn}
          >
            <Text style={styles.headerTextBtnLabel}>
              {selectedIds.size > 0
                ? t("admin_bulk.clear_selection")
                : t("admin_bulk.select_all")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={load} style={styles.headerBtn} disabled={loading}>
            <Ionicons name="refresh" size={22} color={loading ? "#CBD5E1" : NAVY} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} />
        <TextInput
          style={styles.searchInput}
          placeholder={t("admin.users.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {hasActiveFilters ? (
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>{t("admin.clear_filters")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtersWrap}>
        <AdminFilterChips
          label={t("admin.filter_status")}
          allLabel={t("admin.filter_all")}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "active", label: t("admin.users.active_chip") },
            { value: "suspended", label: t("admin.users.suspended_chip") },
          ]}
        />
        <AdminFilterChips
          label={t("admin.filter_kyc")}
          allLabel={t("admin.filter_all")}
          value={kycFilter}
          onChange={setKycFilter}
          options={[
            { value: "none", label: "none" },
            { value: "pending", label: "pending" },
            { value: "verified", label: "verified" },
            { value: "rejected", label: "rejected" },
          ]}
        />
        {roleOptions.length > 1 ? (
          <AdminFilterChips
            label={t("admin.filter_role")}
            allLabel={t("admin.filter_all")}
            value={roleFilter}
            onChange={setRoleFilter}
            options={roleOptions}
          />
        ) : null}
      </View>

      {scope.noCommunityAssigned ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={36} color="#CBD5E1" />
          <Text style={styles.mutedText}>
            {t("admin.no_community_assigned")}
          </Text>
        </View>
      ) : error && rows.length === 0 ? (
        <AdminErrorState onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <AdminListSkeleton rowCount={5} showChip={true} />
      ) : (
        <AppFlashList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          estimatedItemSize={80}
          renderItem={({ item }) => {
            const inSelectMode = selectedIds.size > 0;
            const selected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() =>
                  inSelectMode
                    ? toggleSelect(item.id)
                    : navigation.navigate("AdminUserDetail", { userId: item.id })
                }
                onLongPress={() => toggleSelect(item.id)}
              >
                {inSelectMode ? (
                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkboxChecked,
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={14} color={colors.cardBg} />
                    ) : null}
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.full_name || t("admin.users.no_name")}
                </Text>
                <Text style={styles.rowEmail} numberOfLines={1}>
                  {item.email ?? "—"}
                </Text>
                <View style={styles.rowMeta}>
                  <Chip label={`KYC: ${item.kyc_status ?? "none"}`} />
                  {item.role && item.role !== "member" ? (
                    <Chip label={item.role} />
                  ) : null}
                  {item.is_active === false ? (
                    <Chip label={t("admin.users.suspended_chip")} tone="danger" />
                  ) : null}
                </View>
              </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.users.empty")}</Text>
            </View>
          }
        />
      )}

      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={clearSelection}
        busy={bulkBusy}
        actions={[
          {
            key: "suspend",
            label: t("admin_bulk.bulk_suspend"),
            onPress: () => setPendingBulk("suspend"),
            variant: "danger",
            disabled: !allActive,
          },
          {
            key: "reactivate",
            label: t("admin_bulk.bulk_reactivate"),
            onPress: () => setPendingBulk("reactivate"),
            variant: "primary",
            disabled: !allSuspended,
          },
        ]}
      />

      <BulkReasonModal
        visible={pendingBulk !== null}
        action={
          pendingBulk === "suspend"
            ? t("admin_bulk.bulk_suspend")
            : t("admin_bulk.bulk_reactivate")
        }
        count={selectedIds.size}
        variant={pendingBulk === "suspend" ? "danger" : "primary"}
        busy={bulkBusy}
        onCancel={() => setPendingBulk(null)}
        onConfirm={(reason) => pendingBulk && runBulk(pendingBulk, reason)}
      />
    </SafeAreaView>
  );
}

function Chip({ label, tone }: { label: string; tone?: "danger" }) {
  return (
    <View
      style={[
        styles.chip,
        tone === "danger" && { backgroundColor: colors.errorBg, borderColor: "#FCA5A5" },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === "danger" && { color: "#991B1B" },
        ]}
      >
        {label}
      </Text>
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
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerTextBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  headerTextBtnLabel: { fontSize: 12, color: NAVY, fontWeight: typography.bold },
  headerTitle: { fontSize: typography.sectionHeader, fontWeight: typography.bold, color: NAVY },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: NAVY, padding: 0 },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.errorBg,
  },
  clearBtnText: { fontSize: 11, color: "#991B1B", fontWeight: typography.bold },
  filtersWrap: { gap: 10, paddingBottom: spacing.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 40, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 8,
  },
  rowSelected: {
    backgroundColor: "rgba(0,198,174,0.10)",
    borderWidth: 1,
    borderColor: TEAL,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: TEAL, backgroundColor: TEAL },
  rowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  rowEmail: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,198,174,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.35)",
  },
  chipText: { fontSize: 11, color: NAVY, fontWeight: typography.bold },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
