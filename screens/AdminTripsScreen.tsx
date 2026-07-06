// ═══════════════════════════════════════════════════════════════════════════
// screens/AdminTripsScreen.tsx — admin trips list (Bucket B mod 4)
// ═══════════════════════════════════════════════════════════════════════════
//
// List + name/destination search. support admins are community-scoped
// via the circles.community_id link (trips themselves have no
// community_id — they hang off circles).
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

interface TripRow {
  id: string;
  trip_name: string | null;
  destination: string | null;
  status: string | null;
  price_per_person: number | null;
  start_date: string | null;
  end_date: string | null;
  max_participants: number | null;
}

export default function AdminTripsScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const scope = useAdminScope();
  const [rows, setRows] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [pendingBulk, setPendingBulk] = useState<"cancel" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (scope.loading) return;
    if (scope.noCommunityAssigned) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = supabase
        .from("trips")
        .select(
          "id, trip_name, destination, status, price_per_person, start_date, end_date, max_participants",
        )
        .order("start_date", { ascending: false })
        .limit(200);
      // trips have no community_id column — scope via circles.community_id
      // (pre-resolved in the scope hook so we don't re-query here).
      if (scope.scopedCircleIds) q.in("circle_id", scope.scopedCircleIds);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      setRows((data ?? []) as TripRow[]);
    } catch (err) {
      console.warn("[AdminTrips] load failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, scope.loading, scope.noCommunityAssigned, scope.scopedCircleIds]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rows.filter((r) => {
      if (q) {
        const inName = (r.trip_name ?? "").toLowerCase().includes(q);
        const inDest = (r.destination ?? "").toLowerCase().includes(q);
        if (!inName && !inDest) return false;
      }
      if (statusFilter && (r.status ?? "") !== statusFilter) return false;
      if (dateFilter === "upcoming" || dateFilter === "past") {
        const start = r.start_date ? new Date(r.start_date) : null;
        if (!start) return false;
        const isUpcoming = start.getTime() >= today.getTime();
        if (dateFilter === "upcoming" && !isUpcoming) return false;
        if (dateFilter === "past" && isUpcoming) return false;
      }
      return true;
    });
  }, [rows, query, statusFilter, dateFilter]);

  const hasActiveFilters = !!query || !!statusFilter || !!dateFilter;

  const clearFilters = useCallback(() => {
    setQuery("");
    setStatusFilter(null);
    setDateFilter(null);
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

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIds.has(r.id)),
    [rows, selectedIds],
  );
  // Cancel only makes sense for non-terminal trips. admin_cancel_trip
  // also raises if the trip is already cancelled/completed, so this is a
  // pre-flight gate rather than the only safety check.
  const anyCancellable = selectedRows.some(
    (r) => r.status !== "cancelled" && r.status !== "completed",
  );

  const runBulkCancel = useCallback(
    async (reason: string) => {
      if (selectedRows.length === 0) {
        showToast(t("admin_bulk.bulk_requires_selection"), "error");
        return;
      }
      setBulkBusy(true);
      // admin_cancel_trip defaults reason to NULL; pass null when blank so
      // the RPC's COALESCE fallback ("Trip cancelled") kicks in.
      const effectiveReason = reason || null;
      try {
        const results = await Promise.allSettled(
          selectedRows.map((r) =>
            supabase.rpc("admin_cancel_trip", {
              p_trip_id: r.id,
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
        const actionLabel = t("admin_bulk.bulk_cancel");
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
        <Text style={styles.headerTitle}>{t("admin.trips.title")}</Text>
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
          placeholder={t("admin.trips.search_placeholder")}
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
            { value: "draft", label: "draft" },
            { value: "published", label: "published" },
            { value: "closed", label: "closed" },
            { value: "cancelled", label: "cancelled" },
          ]}
        />
        <AdminFilterChips
          label={t("admin.filter_date_range")}
          allLabel={t("admin.filter_all")}
          value={dateFilter}
          onChange={setDateFilter}
          options={[
            { value: "upcoming", label: t("admin.filter_upcoming") },
            { value: "past", label: t("admin.filter_past") },
          ]}
        />
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
        <AdminListSkeleton rowCount={5} showChip={false} />
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
                    : navigation.navigate("AdminTripDetail", { tripId: item.id })
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
                  {item.trip_name || item.destination || "—"}
                </Text>
                {item.destination && item.trip_name ? (
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.destination}
                  </Text>
                ) : null}
                <Text style={styles.rowMeta}>
                  {item.status ?? "—"} ·{" "}
                  {item.start_date
                    ? new Date(item.start_date).toLocaleDateString()
                    : "—"}
                  {item.end_date
                    ? ` → ${new Date(item.end_date).toLocaleDateString()}`
                    : ""}{" "}
                  · ${Number(item.price_per_person ?? 0).toLocaleString()}
                </Text>
              </View>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="airplane-outline" size={36} color="#CBD5E1" />
              <Text style={styles.mutedText}>{t("admin.trips.empty")}</Text>
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
            key: "cancel",
            label: t("admin_bulk.bulk_cancel"),
            onPress: () => setPendingBulk("cancel"),
            variant: "danger",
            disabled: !anyCancellable,
          },
        ]}
      />

      <BulkReasonModal
        visible={pendingBulk !== null}
        action={t("admin_bulk.bulk_cancel")}
        count={selectedIds.size}
        variant="danger"
        busy={bulkBusy}
        onCancel={() => setPendingBulk(null)}
        onConfirm={(reason) => runBulkCancel(reason)}
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
  rowMeta: { fontSize: typography.label, color: MUTED, marginTop: 2 },
  empty: { alignItems: "center", gap: 10, padding: spacing.xl },
  mutedText: { fontSize: typography.body, color: MUTED, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
});
