// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminCirclesScreen.tsx — admin circles list (Bucket B mod 3)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name search. support-role admins see only circles in their
// community via circles.community_id. Tap → AdminCircleDetail.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { colors, radius, typography, spacing } from "../theme/tokens";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import AdminListSkeleton from "../components/AdminListSkeleton";
import AdminErrorState from "../components/AdminErrorState";
import AdminFilterChips from "../components/AdminFilterChips";
import BulkActionBar from "../components/BulkActionBar";
import BulkReasonModal from "../components/BulkReasonModal";
import { showToast } from "../components/Toast";

const NAVY = colors.primaryNavy;
const TEAL = colors.accentTeal;
const MUTED = "#6B7280";

interface CircleRow {
  id: string;
  name: string | null;
  status: string | null;
  amount: number | null;
  member_count: number | null;
  current_members: number | null;
  community_id: string | null;
  community_name: string | null;
  created_at: string | null;
}

export default function AdminCirclesScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<CircleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [communityFilter, setCommunityFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingBulk, setPendingBulk] = useState<"close" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("role, community_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      const role = adminRow?.role as string | undefined;
      const communityId = adminRow?.community_id as string | null | undefined;

      const q = supabase
        .from("circles")
        .select(
          "id, name, status, amount, member_count, current_members, community_id, created_at, communities:community_id(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (role === "support" && communityId) q.eq("community_id", communityId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          ...r,
          community_name: r.communities?.name ?? null,
        })),
      );
    } catch (err) {
      console.warn("[AdminCircles] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(r.name ?? "").toLowerCase().includes(q)) return false;
      if (statusFilter && (r.status ?? "") !== statusFilter) return false;
      if (communityFilter && (r.community_id ?? "") !== communityFilter)
        return false;
      return true;
    });
  }, [rows, query, statusFilter, communityFilter]);

  // Communities derived from result set — keeps support admins constrained
  // to their own community automatically (rows are already scoped above).
  const communityOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.community_id && r.community_name) {
        map.set(r.community_id, r.community_name);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
  }, [rows]);

  const hasActiveFilters = !!query || !!statusFilter || !!communityFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter(null);
    setCommunityFilter(null);
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

  // Only allow closing circles that aren't already terminal — gates the
  // bulk button when the selection is all completed/cancelled.
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  const anyCloseable = selectedRows.some(
    (r) => r.status !== "completed" && r.status !== "cancelled",
  );

  const runBulkClose = useCallback(
    async (reason: string) => {
      if (selectedRows.length === 0) {
        showToast(t("admin_bulk.bulk_requires_selection"), "error");
        return;
      }
      setBulkBusy(true);
      const effectiveReason = reason || "Bulk close via admin hub";
      try {
        const results = await Promise.allSettled(
          selectedRows.map((r) =>
            supabase.rpc("admin_close_group", {
              p_group_id: r.id,
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
        const actionLabel = t("admin_bulk.bulk_close");
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
        <Text style={styles.headerTitle}>{t("admin.circles.title")}</Text>
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
          placeholder={t("admin.circles.search_placeholder")}
          placeholderTextColor={MUTED}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
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
            { value: "forming", label: "forming" },
            { value: "pending", label: "pending" },
            { value: "active", label: "active" },
            { value: "paused", label: "paused" },
            { value: "completed", label: "completed" },
            { value: "cancelled", label: "cancelled" },
          ]}
        />
        {communityOptions.length > 1 ? (
          <AdminFilterChips
            label={t("admin.filter_community")}
            allLabel={t("admin.filter_all")}
            value={communityFilter}
            onChange={setCommunityFilter}
            options={communityOptions}
          />
        ) : null}
      </View>

      {error && rows.length === 0 ? (
        <AdminErrorState onRetry={load} />
      ) : loading && rows.length === 0 ? (
        <AdminListSkeleton rowCount={5} showChip={true} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const inSelectMode = selectedIds.size > 0;
            const selected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() =>
                  inSelectMode
                    ? toggleSelect(item.id)
                    : navigation.navigate("AdminCircleDetail", { circleId: item.id })
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
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name ?? "—"}
                </Text>
                {item.community_name ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.community_name}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  {item.status ?? "—"} ·{" "}
                  {t("admin.circles.members_n", {
                    count: item.current_members ?? 0,
                    total: item.member_count ?? 0,
                  })}{" "}
                  · ${Number(item.amount ?? 0).toLocaleString()}
                </Text>
              </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="refresh-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.circles.empty")}</Text>
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
            key: "close",
            label: t("admin_bulk.bulk_close"),
            onPress: () => setPendingBulk("close"),
            variant: "danger",
            disabled: !anyCloseable,
          },
        ]}
      />

      <BulkReasonModal
        visible={pendingBulk !== null}
        action={t("admin_bulk.bulk_close")}
        count={selectedIds.size}
        variant="danger"
        busy={bulkBusy}
        onCancel={() => setPendingBulk(null)}
        onConfirm={(reason) => runBulkClose(reason)}
      />
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: NAVY, padding: 0 },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FEE2E2",
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
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { borderColor: TEAL, backgroundColor: TEAL },
  rowName: { fontSize: typography.body, color: NAVY, fontWeight: typography.bold },
  rowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
